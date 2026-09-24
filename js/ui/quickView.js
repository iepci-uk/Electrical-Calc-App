// Screen 1: IEC 60909 simplified method (workbook "Short-Circuit Calculations USED.xls")
import { calculateQuick } from '../core/iecQuick.js';
import { num, text, fmt, esc, errorBox, warnBox } from './dom.js';

const GROUPS = {
  transformers: {
    title: 'Transformers', item: 'Transformer',
    blank: { qty: 1, vp: 11, vs: 0.4, sr: 1, uk: 6 },
    fields: (p, it) => [
      num(`${p}.vp`, 'Primary voltage', 'kV', it.vp, { half: true }),
      num(`${p}.vs`, 'Secondary voltage', 'kV', it.vs, { half: true }),
      num(`${p}.sr`, 'Rated power Sr', 'MVA', it.sr, { half: true }),
      num(`${p}.uk`, 'Impedance ukr', '%', it.uk, { half: true }),
    ],
  },
  generators: {
    title: 'Generators', item: 'Generator',
    blank: { qty: 1, ur: 0.4, sr: 1, xd: 12 },
    fields: (p, it) => [
      num(`${p}.ur`, 'Rated voltage Ur', 'kV', it.ur, { half: true }),
      num(`${p}.sr`, 'Rated power Sr', 'MVA', it.sr, { half: true }),
      num(`${p}.xd`, 'Subtransient X"d', '%', it.xd, { half: true }),
    ],
  },
  motors: {
    title: 'Motors', item: 'Motor',
    blank: { qty: 1, ur: 0.4, pr: 0.1, pf: 0.85, eta: 0.95, ilr: 6 },
    fields: (p, it) => [
      num(`${p}.ur`, 'Rated voltage Ur', 'kV', it.ur, { half: true }),
      num(`${p}.pr`, 'Active power Pr', 'MW', it.pr, { half: true }),
      num(`${p}.pf`, 'cos φ', '', it.pf, { half: true }),
      num(`${p}.eta`, 'Efficiency η', '', it.eta, { half: true }),
      num(`${p}.ilr`, 'Locked rotor ILR/Ir', '× Ir', it.ilr, { half: true }),
    ],
  },
};

function groupCard(key, list) {
  const g = GROUPS[key];
  const items = list.map((it, i) => {
    const p = `quick.${key}.${i}`;
    return `<div class="item ${it.qty > 0 ? '' : 'off'}">
      <div class="item-head">
        <input class="item-name" type="text" data-path="${p}.name" data-kind="text" value="${esc(it.name)}" aria-label="Name">
        <div class="stepper">
          <button type="button" data-action="qty" data-group="${key}" data-i="${i}" data-d="-1" aria-label="Less">−</button>
          <input type="number" inputmode="numeric" data-path="${p}.qty" value="${it.qty}" aria-label="Quantity">
          <button type="button" data-action="qty" data-group="${key}" data-i="${i}" data-d="1" aria-label="More">+</button>
        </div>
        <button type="button" class="icon" data-action="removeItem" data-group="${key}" data-i="${i}" aria-label="Remove">✕</button>
      </div>
      <div class="grid2">${g.fields(p, it).join('')}</div>
    </div>`;
  }).join('');
  return `<section class="card">
    <h2>${g.title}</h2>
    <p class="hint">Quantity 0 = not included.</p>
    ${items}
    <button type="button" class="secondary" data-action="addItem" data-group="${key}">+ Add ${g.item.toLowerCase()}</button>
  </section>`;
}

function results(r) {
  if (!r) return '';
  if (!r.ok) return `<div id="quickResult">${errorBox(r.errors)}</div>`;
  const rows = [...r.items.t, ...r.items.g, ...r.items.m].filter((x) => x.qty > 0)
    .map((x) => `<tr><td>${esc(x.name)} × ${x.qty}</td><td class="num">${x.v} kV</td><td class="num">${fmt(x.ik, 3)} kA</td></tr>`).join('');
  return `<section class="card result" id="quickResult">
    <h2>Result</h2>
    <div class="kpi main"><div class="kpi-label">Initial short-circuit current I"k = IkT + IkG + IkM</div>
      <div class="kpi-value">${fmt(r.total, 3)} <small>kA</small></div></div>
    <div class="mini three"><div>IkT <b>${fmt(r.IkT, 2)}</b></div><div>IkG <b>${fmt(r.IkG, 2)}</b></div><div>IkM <b>${fmt(r.IkM, 2)}</b></div></div>
    ${warnBox(r.warnings)}
    <table class="tbl"><thead><tr><th>Source</th><th class="num">Voltage</th><th class="num">I"k</th></tr></thead><tbody>${rows}</tbody></table>
  </section>`;
}

export const quickView = {
  id: 'quick',
  render(p, state) {
    const q = p.quick;
    return `
      <section class="card">
        <h2>Power system</h2>
        <p class="hint">IEC 60909 simplified method. No cable impedance is included.</p>
        <div class="grid2">
          ${num('quick.c', 'Voltage factor c', '', q.c, { half: true })}
          ${num('quick.skq', 'Network S"kq', 'MVA', q.skq, { half: true })}
        </div>
      </section>
      ${groupCard('transformers', q.transformers)}
      ${groupCard('generators', q.generators)}
      ${groupCard('motors', q.motors)}
      <button type="button" class="primary sticky" data-action="calculate">Calculate</button>
      ${results(state.quick)}`;
  },
  actions: {
    calculate(p, ds, ctx) { ctx.state.quick = calculateQuick(p.quick); ctx.rerender('#quickResult'); },
    qty(p, ds, ctx) {
      const it = p.quick[ds.group][+ds.i];
      it.qty = Math.max(0, (it.qty || 0) + Number(ds.d));
      ctx.save(); ctx.rerender();
    },
    addItem(p, ds, ctx) {
      const g = GROUPS[ds.group];
      const list = p.quick[ds.group];
      list.push({ name: `${g.item} ${String.fromCharCode(65 + list.length)}`, ...g.blank });
      ctx.save(); ctx.rerender();
    },
    removeItem(p, ds, ctx) {
      p.quick[ds.group].splice(+ds.i, 1);
      ctx.save(); ctx.rerender();
    },
  },
};
