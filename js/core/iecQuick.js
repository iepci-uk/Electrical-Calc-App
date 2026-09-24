// ============================================================
// IEC 60909 simplified method
// Source: "Short-Circuit Calculations USED.xls", sheet "IEC"
//   Transformer: Ik = c.Sr / (√3.Vs.(uk + c.Sr/S"kq)) x qty
//   Generator:   Ik = c.Sr / (√3.Ur.X"d) x qty
//   Motor:       Ik = c.(ILR/Ir).Pr / (√3.Ur.cosφ.η) x qty
//   Total Ik = IkT + IkG + IkM
// Units: MVA, MW, kV  ->  kA
// Note: the sheet types 1.1 into each formula; here the c input is used.
// ============================================================

export const QUICK_DEFAULTS = {
  c: 1.1,          // voltage factor (IEC 60909, max. currents)
  skq: 5000,       // network short-circuit power S"kq (MVA)
  transformers: [
    { name: 'Transformer A', qty: 1, vp: 6.6, vs: 20, sr: 16, uk: 10 },
    { name: 'Transformer B', qty: 0, vp: 6.6, vs: 20, sr: 40, uk: 11 },
    { name: 'Transformer C', qty: 0, vp: 6.6, vs: 20, sr: 40, uk: 11 },
  ],
  generators: [
    { name: 'Generator A', qty: 0, ur: 0.4, sr: 10, xd: 12 },
    { name: 'Generator B', qty: 0, ur: 0.4, sr: 10, xd: 12 },
    { name: 'Generator C', qty: 0, ur: 0.4, sr: 10, xd: 12 },
  ],
  motors: [
    { name: 'Motor A', qty: 0, ur: 12, pr: 8, pf: 0.85, eta: 1, ilr: 5 },
    { name: 'Motor B', qty: 0, ur: 12, pr: 8, pf: 0.85, eta: 1, ilr: 5 },
    { name: 'Motor C', qty: 0, ur: 12, pr: 8, pf: 0.85, eta: 1, ilr: 5 },
  ],
};

const SQ3 = Math.sqrt(3);

export function transformerIk(t, c, skq) {
  if (!t.qty) return 0;
  return ((c * t.sr) / (SQ3 * t.vs * (t.uk / 100 + (c * t.sr) / skq))) * t.qty;
}

export function generatorIk(g, c) {
  if (!g.qty) return 0;
  return ((c * g.sr) / (SQ3 * g.ur * (g.xd / 100))) * g.qty;
}

export function motorIk(m, c) {
  if (!m.qty) return 0;
  return ((c * m.ilr * m.pr) / (SQ3 * m.ur * m.pf * (m.eta || 1))) * m.qty;
}

export function validateQuick(q) {
  const errors = [];
  const pos = (v) => Number.isFinite(v) && v > 0;
  if (!pos(q.c)) errors.push('Voltage factor c must be greater than 0');
  if (!pos(q.skq)) errors.push('Network short-circuit power must be greater than 0');
  const check = (list, fields, kind) => list.forEach((it) => {
    if (!(Number.isFinite(it.qty) && it.qty >= 0)) errors.push(`${it.name}: quantity cannot be negative`);
    if (it.qty > 0) fields.forEach((f) => { if (!pos(it[f])) errors.push(`${it.name}: ${f} must be greater than 0`); });
  });
  check(q.transformers, ['vs', 'sr', 'uk'], 'T');
  check(q.generators, ['ur', 'sr', 'xd'], 'G');
  check(q.motors, ['ur', 'pr', 'pf', 'ilr'], 'M');
  return errors;
}

export function calculateQuick(q) {
  const errors = validateQuick(q);
  if (errors.length) return { ok: false, errors };

  const t = q.transformers.map((x) => ({ name: x.name, qty: x.qty, v: x.vs, ik: transformerIk(x, q.c, q.skq) }));
  const g = q.generators.map((x) => ({ name: x.name, qty: x.qty, v: x.ur, ik: generatorIk(x, q.c) }));
  const m = q.motors.map((x) => ({ name: x.name, qty: x.qty, v: x.ur, ik: motorIk(x, q.c) }));
  const sum = (list) => list.reduce((a, b) => a + b.ik, 0);
  const IkT = sum(t), IkG = sum(g), IkM = sum(m);

  // Warn when the currents being added are at different voltages
  const warnings = [];
  const voltages = [...t, ...g, ...m].filter((x) => x.qty > 0).map((x) => x.v);
  if (new Set(voltages).size > 1) {
    warnings.push(`Sources are at different voltages (${[...new Set(voltages)].join(', ')} kV). Currents can only be added at the same bus voltage.`);
  }
  return { ok: true, IkT, IkG, IkM, total: IkT + IkG + IkM, items: { t, g, m }, warnings };
}
