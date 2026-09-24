// ============================================================
// Saves projects on the phone (browser storage).
// Everything is wrapped in try/catch: private mode or a full disk
// must never break the calculator.
// ============================================================
import { QUICK_DEFAULTS } from './core/iecQuick.js';
import { NETWORK_SETTINGS } from './core/constants.js';

const KEY = 'iepci-calc.projects.v1';
const CURRENT = 'iepci-calc.current.v1';
const clone = (o) => JSON.parse(JSON.stringify(o));
const uid = () => Math.random().toString(36).slice(2, 10);

// The example network from the design sheet
export function exampleNetwork() {
  const cable = (length, runs, r, x, preset) => ({ type: 'cable', length, runs, r, x, preset });
  return {
    settings: clone(NETWORK_SETTINGS),
    transformer: { enabled: true, networkMVA: 500, hvVolts: 13800, kva: 2000, uk: 6.5, lvVolts: 400 },
    generator: { enabled: true, count: 5, mva: 1, volts: 400, xd: 15, cableLength: 15, cableRuns: 4, cableR: 0.17, cableX: 0.14 },
    transformerBranch: [cable(15, 8, 0.14, 0.14, 'Cu 4 x 1C x 300 mm²')],
    generatorBranch: [],
    chain: [
      { type: 'point', name: 'Main LV switchboard', motors: { enabled: false } },
      { type: 'breaker', x: 0.00015, r: 0 },
      { type: 'busbar', length: 5, bars: 2, area: 1300, material: 'Cu' },
      { type: 'breaker', x: 0.00015, r: 0 },
      cable(15, 8, 0.14, 0.14, 'Cu 4 x 1C x 300 mm²'),
      { type: 'point', name: 'MDB-1', motors: { enabled: true, count: 3, kw: 406, eta: 0.9, pf: 0.8, cableLength: 15, cableRuns: 4, cableR: 0.175, cableX: 0.125 } },
      { type: 'breaker', x: 0.00015, r: 0 },
      { type: 'busway', length: 60, bars: 2, area: 800, material: 'Cu' },
      cable(15, 2, 0.175, 0.125, 'Cu 4C x 240 mm²'),
      { type: 'tapoff', x: 0.00015, r: 0 },
      { type: 'point', name: 'SMDB top floor', motors: { enabled: false } },
    ],
  };
}

export function newProject(name = 'New project') {
  return {
    id: uid(), name, client: '', ref: '', engineer: '',
    updated: new Date().toISOString(),
    quick: clone(QUICK_DEFAULTS),
    network: exampleNetwork(),
  };
}

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}
function writeAll(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch { return false; }
}

export const store = {
  list: () => readAll().sort((a, b) => b.updated.localeCompare(a.updated)),
  get: (id) => readAll().find((p) => p.id === id) || null,
  save(project) {
    project.updated = new Date().toISOString();
    const list = readAll().filter((p) => p.id !== project.id);
    list.push(project);
    return writeAll(list);
  },
  remove(id) { writeAll(readAll().filter((p) => p.id !== id)); },
  duplicate(project) {
    const copy = { ...clone(project), id: uid(), name: `${project.name} (copy)` };
    this.save(copy);
    return copy;
  },
  currentId: () => { try { return localStorage.getItem(CURRENT); } catch { return null; } },
  setCurrent: (id) => { try { localStorage.setItem(CURRENT, id); } catch { /* ignore */ } },
  // Import a project file shared by a colleague
  importJSON(text) {
    const p = JSON.parse(text);
    if (!p || !p.network || !p.quick) throw new Error('Not an IEPCI Calc project file');
    p.id = uid();
    // Fill any settings added in newer app versions
    p.network.settings = { ...NETWORK_SETTINGS, ...p.network.settings };
    this.save(p);
    return p;
  },
};
