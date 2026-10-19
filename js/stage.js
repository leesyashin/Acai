// Fixed 1280×800 logical stage, scaled to fit the available area (letterboxed).
// All screens render inside #stage and work in stage pixels.
// Full-bleed mode (touch devices, an installed app): the stage still fits the window, but the screens' art runs on
// into the bands round it up to the window's edges, like a native game. html.is-bleed is set then, and #stage gets
// --bx / --by: the stage px the window reaches beyond the stage on either side (0 otherwise). Bars and HUDs use
// them to sit at the window's edges (css/base.css).

import { artDefsSVG, ART_DEFS_ID } from './art.js'; // via art.js: every art module has registered its defs

export const STAGE_W = 1280;
export const STAGE_H = 800;

let appEl = null;
let wrapEl = null;
let stageEl = null;
let scale = 1;
const bleedQuery = typeof matchMedia === 'function'
  ? matchMedia('(pointer: coarse), (display-mode: standalone), (display-mode: fullscreen)')
  : null;
const listeners = new Set();
const layers = new Set(); // more boxes scaled like #stage (the leaving screen of a transition, js/curtain.js)

export function initStage(app, wrap, stage) {
  appEl = app;
  wrapEl = wrap;
  stageEl = stage;
  // the shared gradients every picture shades with (one hidden <svg>, see js/svg.js)
  if (!document.getElementById(ART_DEFS_ID)) document.body.insertAdjacentHTML('afterbegin', artDefsSVG());
  fit();
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 120));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
  bleedQuery?.addEventListener?.('change', fit); // a 2-in-1 switching between laptop and tablet mode
  // The page itself never zooms (touch-action: none on html/body in base.css). Safari also fires its
  // own pinch events (iOS touch, Mac trackpad); cancelling them covers iOS versions without
  // touch-action support and Safari on the Mac, where touch-action does not apply to trackpads.
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, preventDefault, { passive: false });
  }
  // Trackpad and mouse wheel (MacBook): Chrome, Edge and Firefox deliver a pinch as ctrl+wheel events
  // and zoom the page, leaving the stage half outside the window; a two-finger swipe sideways goes
  // back in the history and ends a running level. So every wheel event is cancelled – except a plain vertical
  // one over a scroller ([data-scroll], the level map). Wheel listeners on window are passive unless declared otherwise.
  window.addEventListener('wheel', onWheel, { passive: false });
  // Force Touch trackpads: a firm press while dragging must not open Look Up or a preview (Safari).
  document.addEventListener('webkitmouseforcewillbegin', preventDefault);
  return stageEl;
}

function preventDefault(e) {
  if (e.cancelable) e.preventDefault();
}

function onWheel(e) {
  const scroller = !e.ctrlKey && !e.metaKey && Math.abs(e.deltaY) > Math.abs(e.deltaX) && e.target.closest?.('[data-scroll]');
  if (!scroller) preventDefault(e);
}

export function isBleed() {
  return !!bleedQuery?.matches;
}

export function fit() {
  if (!appEl || !stageEl) return;
  const bleed = isBleed();
  document.documentElement.classList.toggle('is-bleed', bleed);
  const cs = getComputedStyle(appEl);
  const availW = appEl.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const availH = appEl.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  scale = Math.max(0.1, Math.min(availW / STAGE_W, availH / STAGE_H));
  wrapEl.style.width = `${STAGE_W * scale}px`;
  wrapEl.style.height = `${STAGE_H * scale}px`;
  stageEl.style.transform = `scale(${scale})`;
  stageEl.style.setProperty('--stage-scale', String(scale));
  const bx = bleed ? Math.max(0, (appEl.clientWidth / scale - STAGE_W) / 2) : 0;
  const by = bleed ? Math.max(0, (appEl.clientHeight / scale - STAGE_H) / 2) : 0;
  stageEl.style.setProperty('--bx', `${Math.ceil(bx)}px`);
  stageEl.style.setProperty('--by', `${Math.ceil(by)}px`);
  for (const el of layers) el.style.transform = `scale(${scale})`;
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

export function addStageLayer(el) {
  layers.add(el);
  el.style.transform = `scale(${scale})`;
}

export function onStageResize(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
