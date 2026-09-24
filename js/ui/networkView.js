// Screen 2: Impedance method network builder (workbook "Short Circuit Calculations.xls")
import { calculateNetwork, elementLabel } from '../core/impedance.js';
import { CABLE_PRESETS } from '../core/constants.js';
import { num, text, toggle, select, fmt, mOhm, esc, errorBox, warnBox } from './dom.js';

export const ELEMENT_TYPES = [
  { value: 'cable', label: 'Cable' },
  { value: 'breaker', label: 'Circuit breaker' },
  { value: 'busbar', label: 'Switchboard busbar' },
  { value: 'busway', label: 'Bus-way / riser' },
  { value: 'tapoff', label: 'Tap-off unit' },
  { value: 'transformer', label: 'LV/LV transformer' },
  { value: 'impedance', label: 'Fixed impedance (R, X)' },
  { value: 'point', label: '📍 Fault point (switchboard)' },
];

const ICONS = { cable: '〰', breaker: '⏻', busbar: '▭', busway: '▥', tapoff: '⊤', transformer: '⧉', impedance: 'Ω', point: '📍' };

const noMotors = { enabled: false, count: 1, kw: 100, eta: 0.9, pf: 0.8, cableLength: 0, cableRuns: 1, cableR: 0.175, cableX: 0.125 };

export function blankElement(type) {
  switch (type) {
    case 'cable': return { type, length: 20, runs: 1, r: 0.175, x: 0.125, preset: 'Cu 4C x 240 mm²' };
    case 'busbar': return { type, length: 3, bars: 1, area: 800, material: 'Cu' };
    case 'busway': return { type, length: 30, bars: 1, area: 800, material: 'Cu' };
    case 'breaker': return { type, x: 0.00015, r: 0 };
    case 'tapoff': return { type, x: 0.00015, r: 0 };
    case 'transformer': return { type, kva: 1000, uk: 6.5, vp: 400, vs: 230 };
    case 'impedance': return { type, name: '', r: 0, x: 0 };
    case 'point': return { type, name: 'New board', motors: { ...noMotors } };
    default: return { type };
  }
}

const presetOptions = [{ value: '', label: 'Custom (enter r and x)' }, ...CABLE_PRESETS.map((c) => ({ value: c.label, label: c.label }))];

function cableFields(p, el, prefix = '') {
  // prefix lets the generator/motor cables reuse this (cableLength, cableRuns ...)
  const k = (name) => (prefix ? `${prefix}${name[0].toUpperCase()}${name.slice(1)}` : name);
  return `
    ${prefix ? '' : select(`${p}.preset`, 'Cable type', el.preset || '', presetOptions)}
    <div class="grid2">
      ${num(`${p}.${k('length')}`, 'Length', 'm', el[k('length')], { half: true })}
      ${num(`${p}.${k('runs')}`, 'Parallel runs', 'runs', el[k('runs')], { half: true })}
      ${num(`${p}.${k('r')}`, 'r (BS 7671)', 'mV/A/m', el[k('r')], { half: true })}
      ${num(`${p}.${k('x')}`, 'x (BS 7671)', 'mV/A/m', el[k('x')], { half: true })}
    </div>`;
}

function elementFields(p, el) {
  switch (el.type) {
    case 'cable': return cableFields(p, el);
    case 'busbar':
    case 'busway': return `<div class="grid2">
        ${num(`${p}.length`, 'Length', 'm', el.length, { half: true })}
        ${num(`${p}.bars`, 'Bars in parallel', 'no.', el.bars, { half: true })}
        ${num(`${p}.area`, 'Area per bar', 'mm²', el.area, { half: true })}
        ${select(`${p}.material`, 'Material', el.material, [{ value: 'Cu', label: 'Copper' }, { value: 'Al', label: 'Aluminium' }], { half: true })}
      </div>`;
    case 'breaker':
    case 'tapoff': return `<div class="grid2">
        ${num(`${p}.x`, 'Reactance X', 'Ω', el.x, { half: true })}
        ${num(`${p}.r`, 'Resistance R', 'Ω', el.r, { half: true })}</div>`;
    case 'impedance': return `${text(`${p}.name`, 'Description', el.name)}<div class="grid2">
        ${num(`${p}.r`, 'R', 'Ω', el.r, { half: true })}${num(`${p}.x`, 'X', 'Ω', el.x, { half: true })}</div>`;
    case 'transformer': return `<div class="grid2">
        ${num(`${p}.kva`, 'Rating', 'kVA', el.kva, { half: true })}
        ${num(`${p}.uk`, 'Impedance Uk', '%', el.uk, { half: true })}
        ${num(`${p}.vp`, 'Primary', 'V', el.vp, { half: true })}
        ${num(`${p}.vs`, 'Secondary', 'V', el.vs, { half: true })}</div>`;
    case 'point': {
      const m = el.motors || noMotors;
      return `${text(`${p}.name`, 'Board / point name', el.name)}
        ${toggle(`${p}.motors.enabled`, 'Motors feed this point (adds I"sc)', m.enabled)}
        ${m.enabled ? `<div class="sub">
          <div class="grid2">
            ${num(`${p}.motors.count`, 'Number of motors', 'no.', m.count, { half: true })}
            ${num(`${p}.motors.kw`, 'Power each', 'kW', m.kw, { half: true })}
            ${num(`${p}.motors.eta`, 'Efficiency η', '', m.eta, { half: true })}
            ${num(`${p}.motors.pf`, 'cos φ', '', m.pf, { half: true })}
          </div>
          <div class="hint">Motor cable (0 m = none)</div>
          ${cableFields(`${p}.motors`, m, 'cable')}
        </div>` : ''}`;
    }
    default: return '';
  }
}

function elementList(listKey, list, title, hint) {
  const items = list.map((el, i) => {
    const p = `network.${listKey}.${i}`;
    return `<div class="el ${el.type === 'point' ? 'is-point' : ''}">
      <div class="el-head">
        <span class="el-icon" aria-hidden="true">${ICONS[el.type] || '•'}</span>
        <span class="el-title">${esc(elementLabel(el))}</span>
        <span class="el-tools">
          <button type="button" class="icon" data-action="move" data-list="${listKey}" data-i="${i}" data-d="-1" aria-label="Move up">↑</button>
          <button type="button" class="icon" data-action="move" data-list="${listKey}" data-i="${i}" data-d="1" aria-label="Move down">↓</button>
          <button type="button" class="icon" data-action="copyEl" data-list="${listKey}" data-i="${i}" aria-label="Duplicate">⧉</button>
          <button type="button" class="icon danger" data-action="removeEl" data-list="${listKey}" data-i="${i}" aria-label="Delete">✕</button>
        </span>
      </div>
      <details class="el-body" ${el._open ? 'open' : ''} data-list="${listKey}" data-i="${i}"><summary>Edit</summary>${elementFields(p, el)}</details>
    </div>`;
  }).join('<div class="link-line" aria-hidden="true"></div>');

  const options = ELEMENT_TYPES.filter((t) => listKey === 'chain' || t.value !== 'point');
  return `<section class="card">
    <h2>${title}</h2><p class="hint">${hint}</p>
    ${items || '<p class="empty">No elements yet.</p>'}
    <div class="add-row">
      <div class="input-unit"><select id="add-${listKey}">${options.map((o) => `<option value="${o.value}">${o.label}</option>`).join('')}</select></div>
      <button type="button" class="secondary small" data-action="addEl" data-list="${listKey}">+ Add</button>
    </div>
  </section>`;
}

function sourcesCard(n) {
  const t = n.transformer, g = n.generator;
  return `<section class="card">
    <h2>Sources</h2>
    ${toggle('network.transformer.enabled', 'Utility + main transformer', t.enabled)}
    ${t.enabled ? `<div class="grid2">
      ${num('network.transformer.networkMVA', 'Upstream fault level', 'MVA', t.networkMVA, { half: true })}
      ${num('network.transformer.hvVolts', 'Primary voltage', 'V', t.hvVolts, { half: true })}
      ${num('network.transformer.kva', 'Transformer rating', 'kVA', t.kva, { half: true })}
      ${num('network.transformer.uk', 'Impedance Uk', '%', t.uk, { half: true })}
      ${num('network.transformer.lvVolts', 'Secondary voltage', 'V', t.lvVolts, { half: true })}
    </div>` : ''}
    <hr>
    ${toggle('network.generator.enabled', 'Standby generator sets', g.enabled)}
    ${g.enabled ? `<div class="grid2">
      ${num('network.generator.count', 'Sets in parallel', 'no.', g.count, { half: true })}
      ${num('network.generator.mva', 'Rating each', 'MVA', g.mva, { half: true })}
      ${num('network.generator.volts', 'Voltage', 'V', g.volts, { half: true })}
      ${num('network.generator.xd', 'Subtransient X"d', '%', g.xd, { half: true })}
    </div>
    <div class="hint">Cable per generator set</div>
    ${cableFields('network.generator', g, 'cable')}` : ''}
  </section>`;
}

function settingsCard(s) {
  return `<section class="card"><details><summary>Calculation settings</summary>
    <div class="grid2">
      ${num('network.settings.ambientTemp', 'Max ambient temp.', '°C', s.ambientTemp, { half: true })}
      ${num('network.settings.alpha', 'Temp. coefficient α', '/°C', s.alpha, { half: true })}
      ${num('network.settings.netXFactor', 'Network X / Zn', '', s.netXFactor, { half: true })}
      ${num('network.settings.netRFactor', 'Network R / Zn', '', s.netRFactor, { half: true })}
      ${num('network.settings.trafoRFactor', 'Transformer R / X', '', s.trafoRFactor, { half: true })}
      ${num('network.settings.genRFactor', 'Generator R / X', '', s.genRFactor, { half: true })}
      ${num('network.settings.xPerMetre', 'Busbar X per metre', 'Ω/m', s.xPerMetre, { half: true })}
      ${num('network.settings.motorXFactor', 'Motor X factor', '', s.motorXFactor, { half: true })}
    </div>
    ${toggle('network.settings.tempOnX', 'Apply temperature factor to X as well (design sheet)', s.tempOnX)}
    ${toggle('network.settings.exactZ', 'Split transformer/generator Z exactly into R and X', s.exactZ)}
    <button type="button" class="link" data-action="resetSettings">Reset to design sheet values</button>
  </details></section>`;
}

function sourceCell(r) {
  return r ? `${fmt(r.Isc, 2)}<small> / ${fmt(r.Ipeak, 1)}</small>` : '-';
}

function workingTable(label, r) {
  if (!r) return '';
  const rows = r.path.map((p) => `<tr class="${p.note ? 'note' : ''}"><td>${esc(p.label)}</td><td class="num">${p.note ? '' : mOhm(p.R)}</td><td class="num">${p.note ? '' : mOhm(p.X)}</td></tr>`).join('');
  return `<h4>${label}</h4><table class="tbl small"><thead><tr><th>Element</th><th class="num">R mΩ</th><th class="num">X mΩ</th></tr></thead><tbody>${rows}
    <tr class="tot"><td>Total × temp. factor ${fmt(r.tempFactor, 4)}</td><td class="num">${mOhm(r.Rt)}</td><td class="num">${mOhm(r.Xt)}</td></tr>
    </tbody></table>
    <p class="formula">Z' = ${mOhm(r.Z)} mΩ · Isc = ${r.V} / (√3 × Z') = ${fmt(r.Isc, 3)} kA · R/X = ${fmt(r.RX, 3)} · k = ${fmt(r.k, 3)} · I'sc = √2·k·Isc = ${fmt(r.Ipeak, 3)} kA</p>`;
}

function pointResult(pt) {
  const b = pt.breaker;
  return `<div class="point-res">
    <div class="pr-head"><b>📍 ${esc(pt.name)}</b><span class="tag">${pt.V} V</span></div>
    <div class="kpis">
      <div class="kpi main"><div class="kpi-label">Design I${pt.motors ? '"' : ''}sc (${esc(pt.design.governing)})</div><div class="kpi-value">${fmt(pt.design.Isc, 2)} <small>kA</small></div></div>
      <div class="kpi"><div class="kpi-label">Peak I'sc</div><div class="kpi-value">${fmt(pt.design.Ipeak, 2)} <small>kA</small></div></div>
    </div>
    <table class="tbl"><thead><tr><th>From</th><th class="num">Isc / peak kA</th></tr></thead><tbody>
      ${pt.fromTransformer ? `<tr><td>Transformer</td><td class="num">${sourceCell(pt.fromTransformer)}</td></tr>` : ''}
      ${pt.fromGenerator ? `<tr><td>Generator</td><td class="num">${sourceCell(pt.fromGenerator)}</td></tr>` : ''}
      ${pt.motors ? `<tr><td>Motors (added)</td><td class="num">${fmt(pt.motors.Im, 2)}<small> / ${fmt(pt.motors.Ipeak, 1)}</small></td></tr>` : ''}
    </tbody></table>
    <p class="advice">${b
      ? `Breakers here: <b>Icu ≥ ${b.icu} kA</b> (making capacity Icm = ${b.n} × Icu = ${b.icm} kA ≥ ${fmt(pt.design.Ipeak, 1)} kA peak).`
      : 'Fault level is above common LV breaker ratings. Review the design.'}</p>
    <details class="steps"><summary>Show working</summary>
      ${workingTable('From transformer', pt.fromTransformer)}
      ${workingTable('From generator', pt.fromGenerator)}
      ${pt.motors ? `<p class="formula">Motors: Xm = ${fmt(pt.motors.Xm * 1000, 3)} mΩ, Rm = ${fmt(pt.motors.Rm * 1000, 3)} mΩ each; ${fmt(pt.motors.perMotor, 3)} kA per motor; peak = √2 × k(${fmt(pt.motors.k, 3)}) × Im</p>` : ''}
    </details>
  </div>`;
}

function results(r) {
  if (!r) return '';
  if (!r.ok) return `<div id="netResult">${errorBox(r.errors)}</div>`;
  return `<section class="card result" id="netResult">
    <h2>Results</h2>
    ${warnBox(r.warnings)}
    <table class="tbl summary"><thead><tr><th>Point</th><th class="num">Isc kA</th><th class="num">Peak kA</th><th class="num">Icu</th></tr></thead><tbody>
      ${r.points.map((p) => `<tr><td>${esc(p.name)}</td><td class="num">${fmt(p.design.Isc, 2)}</td><td class="num">${fmt(p.design.Ipeak, 1)}</td><td class="num">${p.breaker ? p.breaker.icu : '>150'}</td></tr>`).join('')}
    </tbody></table>
    ${r.points.map(pointResult).join('')}
    <div class="row-btns">
      <button type="button" class="secondary" data-action="exportCSV">Export CSV</button>
      <button type="button" class="secondary" data-action="print">Print / PDF report</button>
    </div>
  </section>`;
}

export const networkView = {
  id: 'network',
  render(p, state) {
    const n = p.network;
    return `
      <p class="intro">Build the supply path from source to each switchboard. Every 📍 point gets its own fault level.</p>
      ${sourcesCard(n)}
      ${n.transformer.enabled ? elementList('transformerBranch', n.transformerBranch, 'Transformer branch', 'Elements only on the transformer side (e.g. transformer cables, main LV board).') : ''}
      ${n.generator.enabled ? elementList('generatorBranch', n.generatorBranch, 'Generator branch', 'Elements only on the generator side (e.g. synch. panel breaker and busbar).') : ''}
      ${elementList('chain', n.chain, 'Common distribution path', 'In order from the source side. Add 📍 points where you need the fault level.')}
      ${settingsCard(n.settings)}
      <button type="button" class="primary sticky" data-action="calculate">Calculate</button>
      ${results(state.network)}`;
  },
  actions: {
    calculate(p, ds, ctx) { ctx.state.network = calculateNetwork(p.network); ctx.rerender('#netResult'); },
    addEl(p, ds, ctx) {
      const type = document.getElementById(`add-${ds.list}`).value;
      const el = blankElement(type); el._open = true;
      p.network[ds.list].push(el);
      ctx.save(); ctx.rerender();
    },
    removeEl(p, ds, ctx) { p.network[ds.list].splice(+ds.i, 1); ctx.save(); ctx.rerender(); },
    copyEl(p, ds, ctx) {
      const list = p.network[ds.list];
      list.splice(+ds.i + 1, 0, JSON.parse(JSON.stringify(list[+ds.i])));
      ctx.save(); ctx.rerender();
    },
    move(p, ds, ctx) {
      const list = p.network[ds.list]; const i = +ds.i; const j = i + Number(ds.d);
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      ctx.save(); ctx.rerender();
    },
    resetSettings(p, ds, ctx) { ctx.resetSettings(); },
    exportCSV(p, ds, ctx) { ctx.exportCSV(); },
    print(p, ds, ctx) { ctx.print(); },
  },
  // When a cable preset is chosen, copy its r and x into the element
  onChange(p, path, value) {
    if (path.endsWith('.preset')) {
      const preset = CABLE_PRESETS.find((c) => c.label === value);
      if (preset) {
        const base = path.slice(0, -'.preset'.length).split('.');
        const el = base.reduce((o, k) => o[k], p);
        el.r = preset.r; el.x = preset.x;
        return true; // re-render so the r and x boxes update
      }
    }
    if (path.endsWith('.enabled') || path.endsWith('.name')) return path.endsWith('.enabled');
    return false;
  },
};
