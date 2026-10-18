// 3D appliance art for the game and the menus: the scenes of js/kitchen3d.js drawn by the shared
// WebGL renderer of js/gl3d.js.
//   createView(kind)          live picture of a station: a 2D canvas redrawn when its state
//                             changes or while it animates
//   pictureMarkup(kind, o, size, fallback)   <img> (data URL, cached) for menu markup
//   still(kind, o)            a static picture at the view's size (the ingredient containers):
//                             drawn once per state and pixel ratio, every call gets a copy;
//                             prepareStills() draws them ahead in idle time
// Without WebGL (or after a lost context that does not come back) has3D() is false and the
// callers keep the drawn SVG art of js/art.js.

import { getRenderer } from './gl3d.js';
import { SCENES, VIEWS, fitFrame, isAnimated } from './kitchen3d.js';
import { getScale } from './stage.js';

export function has3D() {
  const r = getRenderer();
  return !!r && !r.lost;
}

// Device pixels per stage pixel (the stage is scaled to the window), capped for big screens.
export function pixelRatio() {
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  return Math.max(1, Math.min(3, dpr * getScale()));
}

// Values that only move an animation along (progress, a lid or door on its way): when drawing is
// slow (a software WebGL renderer) these updates and the animation frames are spaced out so the
// game stays responsive; a state change is always drawn at once.
const SOFT = new Set(['progress', 'remaining', 'lid', 'door']);
let cost = 0; // running average of one animation frame in ms
// The animation frames of all views share one budget: after any draw, no view draws an animation
// frame for a gap that grows with the cost (5 × the cost, at most 250 ms – or as long as a frame
// itself when one takes longer), and of the views waiting, the one drawn longest ago goes next. So
// the game keeps at least half of the main thread however many appliances animate at once (two
// blenders and the machine drew back to back before, 2–9 fps with software WebGL); one animating
// view redraws as often as ever. Nothing is held back while drawing is fast (a GPU).
let freeAt = 0; // when the next animation frame may be drawn
const waiting = new Map(); // canvas → [end of its last draw, when it last asked for a frame]
const WAIT_STALE = 1000; // ms: a view that stopped asking (stopped animating, left the screen)
const gap = () => (cost > 4 ? Math.min(Math.max(250, cost), cost * 5) : 0);
function myTurn(key, at, now) {
  waiting.set(key, [at, now]);
  if (now < freeAt) return false;
  for (const [k, [a, asked]] of waiting) {
    if (now - asked > WAIT_STALE) waiting.delete(k);
    else if (a < at) return false;
  }
  return true;
}

export function createView(kind, className = '') {
  const frame = VIEWS[kind];
  const canvas = document.createElement('canvas');
  canvas.className = `g-3d g-3d-${kind}${className ? ` ${className}` : ''}`;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.width = `${frame.w}px`;
  canvas.style.height = `${frame.h}px`;
  let hard = null;
  let soft = null;
  let at = 0;
  return {
    el: canvas,
    // Draws the appliance in state o at time t (seconds); skips the work when nothing changed.
    draw(o, t = 0) {
      const r = getRenderer();
      if (!r || r.lost) return false;
      const pr = pixelRatio();
      const h = `${pr}|${JSON.stringify(o, (k, v) => (SOFT.has(k) ? undefined : v))}`;
      const s = `${JSON.stringify(o)}${isAnimated(kind, o) ? `|${t}` : ''}`;
      if (h === hard && s === soft) {
        waiting.delete(canvas);
        return true;
      }
      const now = performance.now();
      if (h === hard && cost > 4 && !myTurn(canvas, at, now)) return true;
      const ok = r.drawTo(canvas, SCENES[kind](o, t, frame), Math.round(frame.w * pr), Math.round(frame.h * pr));
      const end = performance.now();
      // only animation frames count: a new state may build meshes and textures once
      if (h === hard) cost = cost ? cost * 0.8 + (end - now) * 0.2 : end - now;
      at = end;
      freeAt = end + gap();
      waiting.delete(canvas);
      hard = ok ? h : null;
      soft = ok ? s : null;
      return ok;
    },
    invalidate() {
      hard = null;
    },
  };
}

// A copy of a view's current picture (drag ghosts) at scale × its size on the counter, cropped to
// box = [x0, y0, x1, y1] (CSS px of the canvas, default the whole canvas): a canvas keeps headroom
// (an overflowing blender's lid) the ghost does not need, and the ghost is centred on the pointer.
// Only drawImage: reading a live canvas's pixels back would stall the GPU, and Chromium may then
// keep that canvas on the CPU, which makes every later frame drawn into it slow.
export function snapshot(view, scale = 1, box = null) {
  const src = view.el;
  const css = parseFloat(src.style.width) || src.width;
  const k = (src.width / css) || 1; // canvas px per CSS px
  const b = box || [0, 0, css, src.height / k];
  const x0 = Math.max(0, Math.floor(b[0] * k));
  const y0 = Math.max(0, Math.floor(b[1] * k));
  const x1 = Math.min(src.width, Math.ceil(b[2] * k));
  const y1 = Math.min(src.height, Math.ceil(b[3] * k));
  const c = document.createElement('canvas');
  c.width = Math.max(1, x1 - x0);
  c.height = Math.max(1, y1 - y0);
  c.getContext('2d').drawImage(src, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
  c.style.width = `${Math.round((c.width / k) * scale)}px`;
  c.style.height = `${Math.round((c.height / k) * scale)}px`;
  c.style.display = 'block';
  return c;
}

// A picture that never changes (an ingredient container): the view drawn in state o once per
// pixel ratio into a cached canvas, copied (drawImage only) into `target` or a new canvas of the
// view's CSS size. null without WebGL. The cache holds the pictures of the current pixel ratio only
// (a resized window draws them again; the old ones are not needed any more).
const stills = new Map();
let stillsPr = 0;
function stillSource(kind, o) {
  const r = getRenderer();
  if (!r || r.lost || !SCENES[kind]) return null;
  const pr = pixelRatio();
  if (pr !== stillsPr) {
    stills.clear();
    stillsPr = pr;
  }
  const key = `${kind}|${JSON.stringify(o)}`;
  let src = stills.get(key);
  if (!src) {
    const frame = VIEWS[kind];
    src = document.createElement('canvas');
    if (!r.drawTo(src, SCENES[kind](o, 0, frame), Math.round(frame.w * pr), Math.round(frame.h * pr))) return null;
    stills.set(key, src);
  }
  return src;
}
export function still(kind, o, target = null) {
  const src = stillSource(kind, o);
  if (!src) return null;
  const frame = VIEWS[kind];
  const c = target || document.createElement('canvas');
  if (!target) {
    c.className = `g-3d g-3d-${kind}`;
    c.setAttribute('aria-hidden', 'true');
  }
  c.width = src.width; // also clears it
  c.height = src.height;
  c.getContext('2d').drawImage(src, 0, 0);
  c.style.width = `${frame.w}px`;
  c.style.height = `${frame.h}px`;
  return c;
}

// Draws the still pictures of `states` into the cache ahead, one per idle moment, so the first level
// does not have to (software WebGL takes ~10 ms a picture). Harmless without WebGL.
export function prepareStills(kind, states) {
  const idle = (typeof window !== 'undefined' && window.requestIdleCallback) || ((fn) => setTimeout(fn, 16));
  const list = states.slice();
  const next = () => {
    const o = list.shift();
    if (!o) return;
    try {
      if (!stillSource(kind, o)) return;
    } catch (err) {
      console.warn('[art3d] preparing a picture failed', err);
      return;
    }
    idle(next);
  };
  idle(next);
}

const pictures = new Map();
let scratch = null;

// Data URL of the appliance in state o fitted into a size×size square, or null without WebGL.
export function picture(kind, o, size, t = 0) {
  const r = getRenderer();
  if (!r || r.lost || !SCENES[kind]) return null;
  const pr = pixelRatio();
  const key = `${kind}|${size}|${pr}|${t}|${JSON.stringify(o)}`;
  let url = pictures.get(key);
  if (!url) {
    const px = Math.round(size * pr);
    scratch = scratch || document.createElement('canvas');
    if (!r.drawTo(scratch, SCENES[kind](o, t, fitFrame(VIEWS[kind], size)), px, px)) return null;
    url = scratch.toDataURL('image/png');
    if (pictures.size >= 80) pictures.delete(pictures.keys().next().value);
    pictures.set(key, url);
  }
  return url;
}

// Creates the WebGL context and draws one small picture, so the shader is compiled before the
// first picture that counts is needed. Harmless without WebGL.
export function warm3D() {
  try {
    picture('blender', { state: 'empty' }, 24);
  } catch (err) {
    console.warn('[art3d] warm-up failed', err);
  }
}

// <img> markup of picture(), or fallback() (the SVG art) when there is no 3D.
export function pictureMarkup(kind, o, size, fallback, t = 0) {
  const url = picture(kind, o, size, t);
  return url
    ? `<img class="art3d" src="${url}" width="${size}" height="${size}" alt="" draggable="false">`
    : fallback();
}
