// Small helpers shared by all screens.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const fmt = (n, dp = 2) => (Number.isFinite(n)
  ? n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })
  : '-');

// Ohm values: show as milli-ohm so numbers stay readable
export const mOhm = (n) => (Number.isFinite(n) ? (n * 1000).toFixed(4) : '-');

// Read a value from an object with a path like "network.chain.2.length"
export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}
export function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => o[k], obj);
  target[last] = value;
}

// A number input bound to a project path
export function num(path, label, unit, value, opts = {}) {
  return `<label class="field${opts.half ? ' half' : ''}">
    <span>${label}</span>
    <div class="input-unit"><input type="number" inputmode="decimal" step="any"
      data-path="${path}" value="${Number.isFinite(value) ? value : ''}">${unit ? `<em>${unit}</em>` : ''}</div>
  </label>`;
}

export function text(path, label, value, opts = {}) {
  return `<label class="field${opts.half ? ' half' : ''}"><span>${label}</span>
    <div class="input-unit"><input type="text" data-path="${path}" data-kind="text" value="${esc(value)}"></div></label>`;
}

export function toggle(path, label, checked) {
  return `<label class="toggle"><input type="checkbox" data-path="${path}" data-kind="bool" ${checked ? 'checked' : ''}>
    <span class="switch"></span><span>${label}</span></label>`;
}

export function select(path, label, value, options, opts = {}) {
  return `<label class="field${opts.half ? ' half' : ''}"><span>${label}</span>
    <div class="input-unit"><select data-path="${path}" data-kind="${opts.kind || 'text'}">
    ${options.map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
    </select></div></label>`;
}

export function errorBox(list) {
  if (!list?.length) return '';
  return `<div class="errors" role="alert">${list.map((e) => `<div>• ${esc(e)}</div>`).join('')}</div>`;
}

export function warnBox(list) {
  if (!list?.length) return '';
  return `<div class="warn">${list.map((e) => `<div>⚠ ${esc(e)}</div>`).join('')}</div>`;
}

export function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 1800);
}

// Trigger a file download (CSV / JSON)
export function download(filename, content, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
