export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const uiRoot = () => document.getElementById('ui');
export const hudRoot = () => document.getElementById('hud');

export function show(node) {
  const ui = uiRoot();
  ui.innerHTML = '';
  if (node) ui.appendChild(node);
  return node;
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function ordSuffix(n) { return ordinal(n).replace(String(n), ''); }

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function fmtTime(t) {
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

export function loading(on, text = 'Loading…', tip = '') {
  const el = document.getElementById('loading');
  el.classList.toggle('hidden', !on);
  if (on) el.innerHTML = `<div class="spinner"></div><div>${esc(text)}</div>${tip ? `<div class="loading-tip">💡 ${esc(tip)}</div>` : ''}`;
}

/** A simple doodle pad for working out multi-step problems. */
export function scratchPad(canvas) {
  const g = canvas.getContext('2d');
  const fit = () => {
    const r = canvas.getBoundingClientRect();
    canvas.width = r.width * devicePixelRatio;
    canvas.height = r.height * devicePixelRatio;
    g.scale(devicePixelRatio, devicePixelRatio);
    g.lineCap = g.lineJoin = 'round';
    g.lineWidth = 3;
    g.strokeStyle = '#1b2a6b';
  };
  requestAnimationFrame(fit);
  let drawing = false;
  const pt = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener('pointerdown', (e) => { drawing = true; canvas.setPointerCapture(e.pointerId); g.beginPath(); g.moveTo(...pt(e)); });
  canvas.addEventListener('pointermove', (e) => { if (!drawing) return; g.lineTo(...pt(e)); g.stroke(); });
  canvas.addEventListener('pointerup', () => { drawing = false; });
  return { clear: () => { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, canvas.width, canvas.height); g.restore(); } };
}
