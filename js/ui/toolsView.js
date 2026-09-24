// Screen 3: quick tools that engineers use alongside fault calculations
import { transformerQuick, cableThermal, voltageDrop } from '../core/tools.js';
import { selectBreaker } from '../core/impedance.js';
import { K_FACTORS, CABLE_PRESETS } from '../core/constants.js';
import { num, select, fmt } from './dom.js';

// Tool inputs live in memory only (not part of a project)
export const toolInputs = {
  tq: { kva: 2000, volts: 400, uk: 6.5 },
  th: { iscKA: 25, time: 0.4, k: 143, area: 240 },
  vd: { current: 400, length: 80, runs: 1, r: 0.175, x: 0.125, pf: 0.85, volts: 400, preset: 'Cu 4C x 240 mm²' },
  br: { isc: 37.4, ipeak: 80.6 },
};
const out = {};

const tool = (id, title, hint, body, result) => `<section class="card" id="tool-${id}">
  <h2>${title}</h2><p class="hint">${hint}</p>${body}
  <button type="button" class="primary small" data-action="run" data-tool="${id}">Calculate</button>
  ${result ? `<div class="tool-out">${result}</div>` : ''}</section>`;

export const toolsView = {
  id: 'tools',
  render() {
    const t = toolInputs;
    return `
    ${tool('tq', 'Transformer full-load & max fault current', 'Worst case with an infinite upstream network: Isc = FLC / Uk.',
      `<div class="grid2">${num('tools.tq.kva', 'Rating', 'kVA', t.tq.kva, { half: true })}${num('tools.tq.volts', 'Secondary', 'V', t.tq.volts, { half: true })}${num('tools.tq.uk', 'Impedance Uk', '%', t.tq.uk, { half: true })}</div>`,
      out.tq && `Full-load current <b>${fmt(out.tq.flc, 1)} A</b> · Max. LV fault <b>${fmt(out.tq.iscMax, 2)} kA</b>`)}

    ${tool('th', 'Cable short-circuit withstand', 'Adiabatic equation S ≥ I·√t / k (IEC 60364-5-54, BS 7671 543.1.3). Use the protective device clearing time.',
      `<div class="grid2">${num('tools.th.iscKA', 'Fault current', 'kA', t.th.iscKA, { half: true })}${num('tools.th.time', 'Clearing time', 's', t.th.time, { half: true })}
       ${select('tools.th.k', 'Conductor / insulation', t.th.k, K_FACTORS.map((k) => ({ value: k.k, label: `${k.label} k=${k.k}` })), { half: true, kind: 'num' })}
       ${num('tools.th.area', 'Chosen size', 'mm²', t.th.area, { half: true })}</div>`,
      out.th && `Minimum size <b>${fmt(out.th.sMin, 1)} mm²</b>${out.th.ok === null ? '' : ` · Chosen cable withstands <b>${fmt(out.th.withstandKA, 1)} kA</b> for ${toolInputs.th.time} s · <span class="${out.th.ok ? 'pass' : 'fail'}">${out.th.ok ? 'PASS' : 'FAIL'}</span>`}`)}

    ${tool('vd', 'Voltage drop (3-phase)', 'Uses BS 7671 mV/A/m values: Vd = (r·cosφ + x·sinφ) × I × L / 1000 / runs.',
      `${select('tools.vd.preset', 'Cable type', t.vd.preset, [{ value: '', label: 'Custom' }, ...CABLE_PRESETS.map((c) => ({ value: c.label, label: c.label }))])}
       <div class="grid2">${num('tools.vd.current', 'Load current', 'A', t.vd.current, { half: true })}${num('tools.vd.length', 'Length', 'm', t.vd.length, { half: true })}
       ${num('tools.vd.runs', 'Parallel runs', 'runs', t.vd.runs, { half: true })}${num('tools.vd.pf', 'cos φ', '', t.vd.pf, { half: true })}
       ${num('tools.vd.r', 'r', 'mV/A/m', t.vd.r, { half: true })}${num('tools.vd.x', 'x', 'mV/A/m', t.vd.x, { half: true })}
       ${num('tools.vd.volts', 'System voltage', 'V', t.vd.volts, { half: true })}</div>`,
      out.vd && `Voltage drop <b>${fmt(out.vd.vd, 2)} V</b> = <b>${fmt(out.vd.percent, 2)} %</b> <span class="${out.vd.percent <= 5 ? 'pass' : 'fail'}">${out.vd.percent <= 5 ? '≤ 5%' : '> 5%'}</span>`)}

    ${tool('br', 'Breaker breaking & making capacity', 'Picks the lowest common Icu with Icu ≥ Isc and Icm = n × Icu ≥ peak (IEC 60947-2 Table 2).',
      `<div class="grid2">${num('tools.br.isc', 'Fault current Isc', 'kA', t.br.isc, { half: true })}${num('tools.br.ipeak', 'Peak current', 'kA', t.br.ipeak, { half: true })}</div>`,
      out.br !== undefined && (out.br ? `Select <b>Icu ≥ ${out.br.icu} kA</b> · Icm = ${out.br.n} × ${out.br.icu} = <b>${out.br.icm} kA</b>` : 'Above 150 kA. Review the design.'))}
    `;
  },
  actions: {
    run(p, ds, ctx) {
      const t = toolInputs[ds.tool];
      if (Object.entries(t).some(([k, v]) => k !== 'preset' && !(Number.isFinite(v) && v >= 0))) { ctx.toast('Check the inputs'); return; }
      if (ds.tool === 'tq') out.tq = transformerQuick(t);
      if (ds.tool === 'th') out.th = cableThermal(t);
      if (ds.tool === 'vd') out.vd = voltageDrop(t);
      if (ds.tool === 'br') out.br = selectBreaker(t.isc, t.ipeak);
      ctx.rerender(`#tool-${ds.tool}`);
    },
  },
  onChange(p, path, value) {
    if (path === 'tools.vd.preset') {
      const c = CABLE_PRESETS.find((x) => x.label === value);
      if (c) { toolInputs.vd.r = c.r; toolInputs.vd.x = c.x; return true; }
    }
    return false;
  },
};
