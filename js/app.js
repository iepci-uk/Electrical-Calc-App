// ============================================================
// App shell: tabs, saving, and wiring the screens together.
// Formulas are NOT here - they live in js/core/.
// ============================================================
import { BRAND } from './config.js';
import { store, newProject } from './store.js';
import { NETWORK_SETTINGS } from './core/constants.js';
import { $, $$, setPath, toast, download, fmt } from './ui/dom.js';
import { quickView } from './ui/quickView.js';
import { networkView } from './ui/networkView.js';
import { toolsView, toolInputs } from './ui/toolsView.js';
import { projectsView } from './ui/projectsView.js';
import { buildReport } from './ui/report.js';

const VIEWS = { network: networkView, quick: quickView, tools: toolsView, projects: projectsView };
const state = {};            // last results per screen (kept in memory)
let project;
let current = 'network';
let saveTimer;

// ---------- Branding ----------
document.title = BRAND.appName;
$('#brandName').textContent = BRAND.appName;
document.documentElement.style.setProperty('--primary', BRAND.primaryColor);
document.documentElement.style.setProperty('--accent', BRAND.accentColor);

// ---------- Project loading / saving ----------
function openProject(id) {
  project = (id && store.get(id)) || null;
  if (!project) {
    project = newProject(id === null && store.list().length ? 'New project' : 'Example (design sheet)');
    store.save(project);
  }
  store.setCurrent(project.id);
  Object.keys(state).forEach((k) => delete state[k]);
  state.stale = {};
  render();
}

function saveSoon() {
  clearTimeout(saveTimer);
  $('#saveState').textContent = 'Saving…';
  saveTimer = setTimeout(() => {
    const ok = store.save(project);
    $('#saveState').textContent = ok ? 'Saved' : 'Not saved (storage full or blocked)';
  }, 400);
}

// ---------- Rendering ----------
function render(scrollTo) {
  const y = window.scrollY;
  $('#view').innerHTML = VIEWS[current].render(project, state);
  $('#projectName').textContent = project.name;
  $$('.tab').forEach((t) => t.setAttribute('aria-current', t.dataset.tab === current ? 'page' : 'false'));
  if (state.stale?.[current]) $$('.result').forEach((r) => r.classList.add('stale'));
  if (scrollTo && $(scrollTo)) $(scrollTo).scrollIntoView({ behavior: 'smooth', block: 'start' });
  else window.scrollTo(0, y);
}

function go(tab) {
  if (!VIEWS[tab]) return;
  current = tab;
  try { history.replaceState(null, '', `#${tab}`); } catch { /* ignore */ }
  render();
  window.scrollTo(0, 0);
}

// ---------- Shared actions ----------
const ctx = {
  state,
  save: saveSoon,
  rerender: render,
  toast,
  openProject,
  resetSettings() { project.network.settings = { ...NETWORK_SETTINGS }; saveSoon(); render(); toast('Settings reset'); },
  exportJSON() {
    const safe = project.name.replace(/[^\w-]+/g, '_');
    download(`${safe}.iepci.json`, JSON.stringify(project, null, 2), 'application/json');
  },
  exportCSV() {
    const r = state.network;
    if (!r?.ok) return toast('Calculate first');
    const head = ['Point', 'Voltage V', 'Isc from transformer kA', 'Peak from transformer kA', 'Isc from generator kA', 'Peak from generator kA', 'Motors kA', 'Design Isc kA', 'Design peak kA', 'Min Icu kA'];
    const rows = r.points.map((p) => [p.name, p.V, p.fromTransformer?.Isc, p.fromTransformer?.Ipeak, p.fromGenerator?.Isc, p.fromGenerator?.Ipeak, p.motors?.Im, p.design.Isc, p.design.Ipeak, p.breaker?.icu]
      .map((v) => (typeof v === 'number' ? v.toFixed(3) : `"${String(v ?? '').replace(/"/g, '""')}"`)).join(','));
    download(`${project.name.replace(/[^\w-]+/g, '_')}_short_circuit.csv`, [head.join(','), ...rows].join('\n'), 'text/csv');
  },
  print() {
    $('#report').innerHTML = buildReport(project);
    window.print();
  },
};

// ---------- Events ----------
function readInput(el) {
  if (el.dataset.kind === 'bool') return el.checked;
  if (el.dataset.kind === 'text') return el.value;
  if (el.tagName === 'SELECT' && el.dataset.kind !== 'num') return el.value;
  return el.value === '' ? NaN : parseFloat(el.value);
}

function onInput(e) {
  const el = e.target;
  const path = el.dataset.path;
  if (!path) return;
  // Checkboxes and dropdowns are handled on "change" only
  if (e.type === 'input' && (el.type === 'checkbox' || el.tagName === 'SELECT')) return;
  const isTool = path.startsWith('tools.');
  setPath(isTool ? { tools: toolInputs } : project, path, readInput(el));
  if (!isTool) {
    saveSoon();
    (state.stale ??= {})[current] = true;
    $$('.result').forEach((r) => r.classList.add('stale'));
  }
  if (path === 'name') $('#projectName').textContent = project.name;
  const needsRender = VIEWS[current].onChange?.(project, path, readInput(el));
  if (needsRender || el.type === 'checkbox') render();
}

$('#view').addEventListener('input', onInput);
$('#view').addEventListener('change', onInput);

$('#view').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const fn = VIEWS[current].actions?.[btn.dataset.action];
  if (btn.dataset.action === 'calculate' && state.stale) state.stale[current] = false;
  if (fn) fn(project, btn.dataset, ctx);
});

// Remember which element cards are open, so re-rendering keeps them open
$('#view').addEventListener('toggle', (e) => {
  const d = e.target;
  if (!d.classList?.contains('el-body')) return;
  const el = project.network[d.dataset.list]?.[+d.dataset.i];
  if (el) el._open = d.open;
}, true);

$('#view').addEventListener('change', async (e) => {
  if (e.target.id !== 'importFile' || !e.target.files[0]) return;
  try {
    const p = store.importJSON(await e.target.files[0].text());
    openProject(p.id);
    toast('Project imported');
  } catch (err) { toast(err.message || 'Could not read file'); }
});

$$('.tab').forEach((t) => t.addEventListener('click', () => go(t.dataset.tab)));
$('#projectName').addEventListener('click', () => go('projects'));

// ---------- Start ----------
const startTab = location.hash.slice(1);
if (VIEWS[startTab]) current = startTab;
openProject(store.currentId());

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// Exposed for quick debugging in the browser console
window.iepci = { get project() { return project; }, state, fmt };
