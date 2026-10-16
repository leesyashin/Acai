// Fixed 1280×800 logical stage, scaled to fit the available area (letterboxed).
// All screens render inside #stage and work in stage pixels.

export const STAGE_W = 1280;
export const STAGE_H = 800;

let appEl = null;
let wrapEl = null;
let stageEl = null;
let scale = 1;
const listeners = new Set();

export function initStage(app, wrap, stage) {
  appEl = app;
  wrapEl = wrap;
  stageEl = stage;
  fit();
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 120));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
  // The page itself never zooms (touch-action: none on html/body in base.css). iOS Safari also
  // fires its own pinch events; cancelling them covers iOS versions without touch-action support.
  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  return stageEl;
}

export function fit() {
  if (!appEl || !stageEl) return;
  const cs = getComputedStyle(appEl);
  const availW = appEl.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const availH = appEl.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  scale = Math.max(0.1, Math.min(availW / STAGE_W, availH / STAGE_H));
  wrapEl.style.width = `${STAGE_W * scale}px`;
  wrapEl.style.height = `${STAGE_H * scale}px`;
  stageEl.style.transform = `scale(${scale})`;
  stageEl.style.setProperty('--stage-scale', String(scale));
  for (const fn of listeners) fn(scale);
}

export function getScale() {
  return scale;
}

export function getStageEl() {
  return stageEl;
}

// Convert viewport (client) coordinates to stage coordinates.
export function toStage(clientX, clientY) {
  const r = stageEl.getBoundingClientRect();
  const s = r.width / STAGE_W || scale;
  return { x: (clientX - r.left) / s, y: (clientY - r.top) / s };
}

// Rect of an element in stage coordinates.
export function stageRect(el) {
  const r = el.getBoundingClientRect();
  const a = toStage(r.left, r.top);
  const s = stageEl.getBoundingClientRect().width / STAGE_W || scale;
  return { x: a.x, y: a.y, w: r.width / s, h: r.height / s, cx: a.x + r.width / s / 2, cy: a.y + r.height / s / 2 };
}

export function onStageResize(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
