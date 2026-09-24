// Screen 4: project details, saved projects, import / export
import { store } from '../store.js';
import { text, esc } from './dom.js';

export const projectsView = {
  id: 'projects',
  render(p) {
    const list = store.list();
    return `
      <section class="card">
        <h2>This project</h2>
        ${text('name', 'Project name', p.name)}
        <div class="grid2">
          ${text('client', 'Client', p.client, { half: true })}
          ${text('ref', 'Reference no.', p.ref, { half: true })}
          ${text('engineer', 'Engineer', p.engineer, { half: true })}
        </div>
        <p class="hint">Saved automatically on this device.</p>
        <div class="row-btns">
          <button type="button" class="secondary" data-action="exportJSON">Share project file</button>
          <button type="button" class="secondary" data-action="print">Print / PDF report</button>
        </div>
      </section>

      <section class="card">
        <h2>Saved projects</h2>
        <div class="row-btns">
          <button type="button" class="primary small" data-action="newProject">+ New project</button>
          <label class="secondary file-btn">Import file<input type="file" accept=".json,application/json" id="importFile" hidden></label>
        </div>
        <ul class="plist">
          ${list.map((x) => `<li class="${x.id === p.id ? 'current' : ''}">
            <button type="button" class="plink" data-action="open" data-id="${x.id}">
              <b>${esc(x.name)}</b><small>${esc(x.client || '')} ${new Date(x.updated).toLocaleString()}</small>
            </button>
            <button type="button" class="icon" data-action="dup" data-id="${x.id}" aria-label="Duplicate">⧉</button>
            <button type="button" class="icon danger" data-action="del" data-id="${x.id}" aria-label="Delete">✕</button>
          </li>`).join('')}
        </ul>
      </section>`;
  },
  actions: {
    newProject(p, ds, ctx) { ctx.openProject(null); },
    open(p, ds, ctx) { ctx.openProject(ds.id); },
    dup(p, ds, ctx) { const src = store.get(ds.id); if (src) ctx.openProject(store.duplicate(src).id); },
    del(p, ds, ctx) {
      const x = store.get(ds.id);
      if (!x || !confirm(`Delete "${x.name}"? This cannot be undone.`)) return;
      store.remove(ds.id);
      if (ds.id === p.id) ctx.openProject(store.list()[0]?.id ?? null); else ctx.rerender();
    },
    exportJSON(p, ds, ctx) { ctx.exportJSON(); },
    print(p, ds, ctx) { ctx.print(); },
  },
  onChange(p, path) { return false; },
};
