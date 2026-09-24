// ============================================================
// Quick engineering tools that support short-circuit design
// ============================================================
const SQ3 = Math.sqrt(3);

// Transformer full-load current (A) and max LV fault (kA, infinite upstream)
export function transformerQuick({ kva, volts, uk }) {
  const flc = (kva * 1000) / (SQ3 * volts);
  const iscMax = flc / (uk / 100) / 1000;
  return { flc, iscMax };
}

// Adiabatic check (IEC 60364-5-54 / BS 7671 543.1.3):  S >= I.√t / k
export function cableThermal({ iscKA, time, k, area }) {
  const sMin = (iscKA * 1000 * Math.sqrt(time)) / k;           // mm²
  const withstandKA = area > 0 ? (k * area) / Math.sqrt(time) / 1000 : null; // kA for `time`
  return { sMin, withstandKA, ok: area > 0 ? area >= sMin : null };
}

// 3-phase voltage drop from BS 7671 mV/A/m values
// Uses r.cosφ + x.sinφ (more accurate than using z at all power factors)
export function voltageDrop({ current, length, runs, r, x, pf, volts }) {
  const sin = Math.sqrt(1 - pf ** 2);
  const mvam = r * pf + x * sin;
  const vd = (mvam * current * length) / 1000 / runs;
  return { vd, percent: (vd / volts) * 100, mvam };
}
