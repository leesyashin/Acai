// 3D appliance art for the game and the menus: the scenes of js/kitchen3d.js drawn by the shared
// WebGL renderer of js/gl3d.js.
//   createView(kind)          live picture of a station: a 2D canvas redrawn when its state
//                             changes or while it animates
//   pictureMarkup(kind, o, size, fallback)   <img> (data URL, cached) for menu markup
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
function pixelRatio() {
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  return Math.max(1, Math.min(3, dpr * getScale()));
}

// Values that only move an animation along (progress, a lid or door on its way): when drawing is
// slow (a software WebGL renderer) these updates and the animation frames are spaced out so the
// game stays responsive; a state change is always drawn at once.
const SOFT = new Set(['progress', 'remaining', 'lid', 'door']);
let cost = 0; // running average of one draw in ms

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
      if (h === hard && s === soft) return true;
      const now = performance.now();
      if (h === hard && now - at < (cost > 4 ? Math.min(250, cost * 5) : 0)) return true;
      const ok = r.drawTo(canvas, SCENES[kind](o, t, frame), Math.round(frame.w * pr), Math.round(frame.h * pr));
      const end = performance.now();
      // only animation frames count: a new state may build meshes and textures once
      if (h === hard) cost = cost ? cost * 0.8 + (end - now) * 0.2 : end - now;
      at = end;
      hard = ok ? h : null;
      soft = ok ? s : null;
      return ok;
    },
    invalidate() {
      hard = null;
    },
  };
}

// A copy of a view's current picture (drag ghosts), cssWidth wide.
export function snapshot(view, cssWidth) {
  const src = view.el;
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  c.getContext('2d').drawImage(src, 0, 0);
  const k = cssWidth / parseFloat(src.style.width || src.width);
  c.style.width = `${Math.round(parseFloat(src.style.width) * k)}px`;
  c.style.height = `${Math.round(parseFloat(src.style.height) * k)}px`;
  c.style.display = 'block';
  return c;
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
