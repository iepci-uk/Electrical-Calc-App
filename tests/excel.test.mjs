// ============================================================
// These tests prove the app gives the same answers as the Excel
// workbooks. Run:  npm test
// If one fails after a code change, the app no longer matches Excel.
// ============================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateQuick, QUICK_DEFAULTS } from '../js/core/iecQuick.js';
import { calculateNetwork, motorContribution } from '../js/core/impedance.js';
import { NETWORK_SETTINGS } from '../js/core/constants.js';

const near = (a, b, tol = 1e-4) => assert.ok(Math.abs(a - b) < tol, `expected ${b}, got ${a}`);
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---------- Workbook 2: IEC sheet ----------
test('IEC quick method matches sheet (B10 = 4.9079 kA)', () => {
  const r = calculateQuick(clone(QUICK_DEFAULTS));
  near(r.IkT, 4.90792346297209, 1e-9);
  near(r.total, 4.90792346297209, 1e-9);
});

// ---------- Workbook 1: Impedance method ----------
const cable = (length, runs, r, x) => ({ type: 'cable', length, runs, r, x });
const cb = () => ({ type: 'breaker' });
const bus = (length, bars, area) => ({ type: 'busbar', length, bars, area, material: 'Cu' });
const way = (length, bars, area) => ({ type: 'busway', length, bars, area, material: 'Cu' });
const point = (name, motors) => ({ type: 'point', name, motors });

const baseNetwork = () => ({
  settings: {},
  transformer: { enabled: true, networkMVA: 500, hvVolts: 13800, kva: 2000, uk: 6.5, lvVolts: 400 },
  generator: { enabled: true, count: 5, mva: 1, volts: 400, xd: 15, cableLength: 15, cableRuns: 4, cableR: 0.17, cableX: 0.14 },
  transformerBranch: [cable(15, 8, 0.14, 0.14)],
  generatorBranch: [],
  chain: [point('Fault A')],
});

test('Fault A: transformer side (B60, B62) and generator side (B69, B71)', () => {
  const r = calculateNetwork(baseNetwork());
  assert.equal(r.ok, true);
  const p = r.points[0];
  near(p.fromTransformer.Isc, 37.384262, 1e-5);
  near(p.fromTransformer.Ipeak, 80.575354, 1e-5);
  near(p.fromGenerator.Isc, 44.342709, 1e-5);
  near(p.fromGenerator.Ipeak, 107.632761, 1e-5);
});

test('Fault B: MDB-1 & MDB-2 (B83, K83, B98, K98)', () => {
  const n = baseNetwork();
  n.transformerBranch = [cable(15, 8, 0.14, 0.14), cb(), bus(5, 2, 1300), cb()];
  n.generatorBranch = [cb(), bus(5, 4, 1300), cb()];
  n.chain = [cable(15, 8, 0.14, 0.14), point('Fault B')];
  const p = calculateNetwork(n).points[0];
  near(p.fromTransformer.Isc, 32.611928, 1e-5);
  near(p.fromTransformer.Ipeak, 70.164733, 1e-5);
  near(p.fromGenerator.Isc, 39.103546, 1e-5);
  near(p.fromGenerator.Ipeak, 92.863422, 1e-5);
  near(p.design.Isc, 39.103546, 1e-5); // F99 = MAX
});

test('Bus-way sheet: Lighting SMDB 1st floor from transformer (B28 = 17.127, K28 = 35.540)', () => {
  const n = baseNetwork();
  n.generator.enabled = false;
  // ATS-3 board fed from the main transformer (Impedance sheet rows 121-129)
  n.transformerBranch = [cable(15, 8, 0.14, 0.14), cb(), bus(5, 2, 800), cb(), cable(15, 5, 0.14, 0.14)];
  // Bus-way riser to 1st floor (Bus-way sheet rows 13-28)
  n.chain = [cb(), bus(2.4, 2, 800), cb(), way(60, 2, 800), cable(15, 2, 0.175, 0.125), { type: 'tapoff' }, point('SMDP-L-1F')];
  const p = calculateNetwork(n).points[0];
  near(p.fromTransformer.Isc, 17.1270142036648, 1e-6);
  near(p.fromTransformer.Ipeak, 35.5399753165176, 1e-6);
});

test('HVAC motor contribution (H480 = 6.5605 kA for 3 x 406 kW)', () => {
  const m = motorContribution(
    { count: 3, kw: 406, eta: 0.9, pf: 0.8, cableLength: 15, cableRuns: 4, cableR: 0.175, cableX: 0.125 },
    400, NETWORK_SETTINGS);
  near(m.Xm, 0.070936, 1e-6);
  near(m.Im, 6.5605, 1e-4);
});

test('validation catches missing fault point', () => {
  const n = baseNetwork();
  n.chain = [];
  assert.equal(calculateNetwork(n).ok, false);
});

// ---------- Tools (hand-checked values) ----------
import { transformerQuick, cableThermal, voltageDrop } from '../js/core/tools.js';
import { selectBreaker } from '../js/core/impedance.js';

test('tools: transformer FLC, adiabatic check, voltage drop, breaker', () => {
  const t = transformerQuick({ kva: 2000, volts: 400, uk: 6.5 });
  near(t.flc, 2886.75, 0.01);
  near(t.iscMax, 44.412, 0.001);
  const th = cableThermal({ iscKA: 25, time: 0.4, k: 143, area: 240 });
  near(th.sMin, 110.56, 0.01);
  assert.equal(th.ok, true);
  const vd = voltageDrop({ current: 400, length: 80, runs: 1, r: 0.175, x: 0.125, pf: 0.85, volts: 400 });
  near(vd.vd, 6.867, 0.001);
  // 44.34 kA with 107.6 kA peak needs 50 kA (42 kA x 2.2 = 92.4 < 107.6)
  assert.equal(selectBreaker(44.34, 107.6).icu, 50);
});
