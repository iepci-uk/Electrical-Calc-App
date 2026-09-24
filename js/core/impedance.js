// ============================================================
// Impedance Method - network builder
// Source: "Short Circuit Calculations.xls"
//   sheets "Impedance Analyses Method" and "Bus-way S.C."
//
// How it works:
//   1. Each source (utility + transformer, and/or generator sets)
//      gives a starting R and X, referred to the LV side.
//   2. Each source has its own "branch" of elements (e.g. its cable,
//      incomer breaker, switchboard busbar).
//   3. Both branches then feed one common "chain" of elements.
//   4. Wherever the chain has a "point", the fault current is worked out
//      from each source, and the higher value is the design value.
//   5. Motors at a point add their contribution (subtransient I"sc).
//
// All impedances are Ohm per phase. Currents are kA.
// ============================================================
import { NETWORK_SETTINGS, RHO, BREAKER_ICU, nFactor } from './constants.js';

const SQ3 = Math.sqrt(3);

// ---------- Element impedances ----------

// Cable, from BS 7671 mV/A/m (3-phase) values
export function cableRX({ length, runs, r, x }) {
  return {
    R: (length * (r / SQ3)) / (runs * 1000),
    X: (length * (x / SQ3)) / (runs * 1000),
  };
}

// Busbar or bus-way: n bars in parallel, each `area` mm²
export function busbarRX({ length, bars, area, material = 'Cu' }, s = NETWORK_SETTINGS) {
  const rho = RHO[material] ?? RHO.Cu;
  return {
    R: (rho * length) / (area * 1000) / bars,
    X: (s.xPerMetre * length) / bars,
  };
}

// Split an impedance magnitude into R and X.
// Sheet method: X = Z and R = f.X. Exact method: |R + jX| = Z.
function splitZ(Z, rFactor, exact) {
  const X = exact ? Z / Math.sqrt(1 + rFactor ** 2) : Z;
  return { R: rFactor * X, X };
}

// Utility network + main transformer, referred to transformer LV side
export function transformerSourceRX(src, s = NETWORK_SETTINGS) {
  const Zn = src.hvVolts ** 2 / (src.networkMVA * 1e6);
  const ratio = (src.lvVolts / src.hvVolts) ** 2;
  const net = { R: s.netRFactor * Zn * ratio, X: s.netXFactor * Zn * ratio };
  const Ztr = (src.lvVolts ** 2 * (src.uk / 100)) / (src.kva * 1000);
  const tr = splitZ(Ztr, s.trafoRFactor, s.exactZ);
  return {
    V: src.lvVolts,
    parts: [
      { label: `Network ${src.networkMVA} MVA`, ...net },
      { label: `Transformer ${src.kva} kVA, ${src.uk}%`, ...tr },
    ],
  };
}

// N identical generator sets in parallel, each with its own cable
export function generatorSourceRX(g, s = NETWORK_SETTINGS) {
  const Zg = (g.volts ** 2 * (g.xd / 100)) / (g.mva * 1e6) / g.count;
  const gen = splitZ(Zg, s.genRFactor, s.exactZ);
  const parts = [{ label: `Generators ${g.count} x ${g.mva} MVA, X"d ${g.xd}%`, ...gen }];
  if (g.cableLength > 0) {
    const c = cableRX({ length: g.cableLength, runs: g.cableRuns, r: g.cableR, x: g.cableX });
    parts.push({ label: `Generator cables (${g.count} sets in parallel)`, R: c.R / g.count, X: c.X / g.count });
  }
  return { V: g.volts, parts };
}

// Impedance of one chain/branch element (not points, not transformers)
export function elementRX(el, s = NETWORK_SETTINGS) {
  switch (el.type) {
    case 'cable': return cableRX(el);
    case 'busbar':
    case 'busway': return busbarRX(el, s);
    case 'breaker': return { R: el.r ?? 0, X: el.x ?? s.xBreaker };
    case 'tapoff': return { R: el.r ?? 0, X: el.x ?? s.xBreaker };
    case 'impedance': return { R: el.r, X: el.x };
    default: return { R: 0, X: 0 };
  }
}

export function elementLabel(el) {
  switch (el.type) {
    case 'cable': return `Cable ${el.runs} run(s) x ${el.length} m${el.preset ? ' ' + el.preset : ''}`;
    case 'busbar': return `Busbar ${el.bars} x ${el.area} mm² ${el.material || 'Cu'}, ${el.length} m`;
    case 'busway': return `Bus-way ${el.bars} x ${el.area} mm² ${el.material || 'Cu'}, ${el.length} m`;
    case 'breaker': return `Circuit breaker${el.name ? ' ' + el.name : ''}`;
    case 'tapoff': return 'Tap-off unit';
    case 'impedance': return `Fixed impedance${el.name ? ' ' + el.name : ''}`;
    case 'transformer': return `LV/LV transformer ${el.kva} kVA ${el.vp}/${el.vs} V`;
    case 'point': return `Fault point: ${el.name}`;
    default: return el.type;
  }
}

// ---------- Fault at one point ----------

export function faultFromRX(R, X, V, s = NETWORK_SETTINGS) {
  const f = 1 + s.alpha * (s.ambientTemp - 30);
  const Rt = R * f;
  const Xt = s.tempOnX ? X * f : X;
  const Z = Math.sqrt(Rt ** 2 + Xt ** 2);
  const Isc = V / (SQ3 * Z) / 1000;
  const RX = Rt / Xt;
  const k = 1.02 + 0.98 * Math.exp(-3 * RX);
  return { R, X, Rt, Xt, Z, V, tempFactor: f, Isc, RX, k, Ipeak: Math.SQRT2 * k * Isc };
}

// Motor group feeding back into a fault (sheet rows 467-484)
export function motorContribution(m, V, s = NETWORK_SETTINGS) {
  const Xm = (s.motorXFactor * V ** 2) / ((m.kw * 1000) / (m.eta * m.pf));
  const Rm = Math.cos(Math.asin(s.motorXFactor)) * Xm;
  const c = m.cableLength > 0
    ? cableRX({ length: m.cableLength, runs: m.cableRuns, r: m.cableR, x: m.cableX })
    : { R: 0, X: 0 };
  const one = faultFromRX(Rm + c.R, Xm + c.X, V, s);
  const Im = one.Isc * m.count;
  // Peak: √2.k.Im (the sheet used R/X in place of k - see README)
  return { Xm, Rm, perMotor: one.Isc, Im, k: one.k, Ipeak: Math.SQRT2 * one.k * Im };
}

// Smallest standard breaker with Icu >= Ik" and n.Icu >= ip
export function selectBreaker(IscKA, IpeakKA) {
  const icu = BREAKER_ICU.find((r) => r >= IscKA && nFactor(r) * r >= IpeakKA);
  return icu ? { icu, icm: +(nFactor(icu) * icu).toFixed(1), n: nFactor(icu) } : null;
}

// ---------- Whole network ----------

function walk(start, branch, chain, s, sourceKey, pointsOut, warnings) {
  let R = start.parts.reduce((a, p) => a + p.R, 0);
  let X = start.parts.reduce((a, p) => a + p.X, 0);
  let V = start.V;
  const path = start.parts.map((p) => ({ label: p.label, R: p.R, X: p.X }));

  const apply = (el) => {
    if (el.type === 'point') return;
    if (el.type === 'transformer') {
      if (Math.abs(el.vp - V) > 0.01 * V) warnings.add(`${elementLabel(el)}: primary ${el.vp} V does not match upstream ${V} V`);
      const ratio = (el.vs / el.vp) ** 2;
      R *= ratio; X *= ratio;
      path.push({ label: `Upstream referred to ${el.vs} V (x${ratio.toFixed(4)})`, R: 0, X: 0, note: true });
      const tr = splitZ((el.vs ** 2 * (el.uk / 100)) / (el.kva * 1000), s.trafoRFactor, s.exactZ);
      R += tr.R; X += tr.X; V = el.vs;
      path.push({ label: elementLabel(el), ...tr });
      return;
    }
    const z = elementRX(el, s);
    R += z.R; X += z.X;
    path.push({ label: elementLabel(el), ...z });
  };

  branch.forEach(apply);
  chain.forEach((el, idx) => {
    apply(el);
    if (el.type === 'point') {
      const res = faultFromRX(R, X, V, s);
      pointsOut[idx] ??= { index: idx, name: el.name, el };
      pointsOut[idx][sourceKey] = { ...res, path: path.map((p) => ({ ...p })) };
    }
  });
}

export function validateNetwork(n) {
  const errors = [];
  const pos = (v) => Number.isFinite(v) && v > 0;
  const nonneg = (v) => Number.isFinite(v) && v >= 0;
  const t = n.transformer, g = n.generator;
  if (!t.enabled && !g.enabled) errors.push('Turn on at least one source (transformer or generator)');
  if (t.enabled) ['networkMVA', 'hvVolts', 'kva', 'uk', 'lvVolts'].forEach((k) => { if (!pos(t[k])) errors.push(`Transformer source: ${k} must be greater than 0`); });
  if (g.enabled) ['count', 'mva', 'volts', 'xd'].forEach((k) => { if (!pos(g[k])) errors.push(`Generator source: ${k} must be greater than 0`); });
  if (g.enabled && g.cableLength > 0 && !pos(g.cableRuns)) errors.push('Generator cable runs must be greater than 0');
  const all = [...n.transformerBranch, ...n.generatorBranch, ...n.chain];
  all.forEach((el, i) => {
    const name = elementLabel(el);
    if (el.type === 'cable' && (!nonneg(el.length) || !pos(el.runs) || !nonneg(el.r) || !nonneg(el.x))) errors.push(`${name}: check length, runs, r and x`);
    if ((el.type === 'busbar' || el.type === 'busway') && (!nonneg(el.length) || !pos(el.bars) || !pos(el.area))) errors.push(`${name}: check length, bars and area`);
    if (el.type === 'transformer' && !['kva', 'uk', 'vp', 'vs'].every((k) => pos(el[k]))) errors.push(`${name}: all values must be greater than 0`);
    if (el.type === 'point' && el.motors?.enabled && !['count', 'kw', 'eta', 'pf'].every((k) => pos(el.motors[k]))) errors.push(`${el.name}: check motor data`);
  });
  if (!n.chain.some((e) => e.type === 'point')) errors.push('Add at least one fault point to the chain');
  return errors;
}

export function calculateNetwork(n) {
  const errors = validateNetwork(n);
  if (errors.length) return { ok: false, errors };
  const s = { ...NETWORK_SETTINGS, ...n.settings };
  const warnings = new Set();
  const pts = {};

  if (n.transformer.enabled) walk(transformerSourceRX(n.transformer, s), n.transformerBranch, n.chain, s, 'fromTransformer', pts, warnings);
  if (n.generator.enabled) walk(generatorSourceRX(n.generator, s), n.generatorBranch, n.chain, s, 'fromGenerator', pts, warnings);
  if (n.transformer.enabled && n.generator.enabled && n.transformer.lvVolts !== n.generator.volts) {
    warnings.add(`Transformer LV (${n.transformer.lvVolts} V) and generator (${n.generator.volts} V) voltages differ`);
  }

  const points = Object.values(pts).sort((a, b) => a.index - b.index).map((p) => {
    const sources = ['fromTransformer', 'fromGenerator'].filter((k) => p[k]);
    const m = p.el.motors?.enabled ? motorContribution(p.el.motors, p[sources[0]].V, s) : null;
    // Design value = worst case over the sources (plus motors if present)
    let Isc = 0, Ipeak = 0, governing = '';
    sources.forEach((k) => {
      const i = p[k].Isc + (m ? m.Im : 0);
      const ip = p[k].Ipeak + (m ? m.Ipeak : 0);
      if (i > Isc) { Isc = i; governing = k === 'fromTransformer' ? 'Transformer' : 'Generator'; }
      Ipeak = Math.max(Ipeak, ip);
    });
    return {
      index: p.index, name: p.name, V: p[sources[0]].V,
      fromTransformer: p.fromTransformer || null,
      fromGenerator: p.fromGenerator || null,
      motors: m,
      design: { Isc, Ipeak, governing },
      breaker: selectBreaker(Isc, Ipeak),
    };
  });
  return { ok: true, points, warnings: [...warnings], settings: s };
}
