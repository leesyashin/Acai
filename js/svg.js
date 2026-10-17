// Shared SVG drawing helpers for the art modules (js/art.js, js/art-food.js, js/art-kitchen.js).
// Pure module (no DOM access): every helper returns markup strings.

import { createRng } from './rng.js';

// ---------------------------------------------------------------- palette
export const INK = '#2a1236';
export const WHITE = '#ffffff';
export const PINK = '#ff3d8b';
export const LAGOON = '#18c2c9';
export const MANGO = '#ffb627';
export const LEAF = '#2fbf71';
export const CREAM = '#fff4df';
export const WOOD = '#c97d43';
export const WOOD_D = '#8e4f22';
export const PURPLE = '#6c2a8f';
export const DANGER = '#ff4d4d';
export const SHADE_DIR = Math.PI / 4; // light from top-left → shade bottom-right
export const FONT = `'Lilita One', 'Trebuchet MS', system-ui, sans-serif`;

// ---------------------------------------------------------------- helpers
export const f = (n) => Math.round(n * 10) / 10;
let idSeq = 0;
export const uid = (p) => `af-${p}-${(++idSeq).toString(36)}`;

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export const rngFor = (key) => createRng(hashStr(String(key)));

// Small cache for id-free, language-independent art that is redrawn often.
const memoCache = new Map();
export function memo(key, draw) {
  let v = memoCache.get(key);
  if (v === undefined) {
    v = draw();
    if (memoCache.size >= 400) memoCache.delete(memoCache.keys().next().value);
    memoCache.set(key, v);
  }
  return v;
}

export function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mix(a, b, k) {
  const A = rgb(a);
  const B = rgb(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('')}`;
}
export const lighten = (c, k) => mix(c, WHITE, k);
export const darken = (c, k) => mix(c, INK, k);
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Outline width in viewBox units so it renders ~2.8 px at the used size (clamped).
export function ow(vb, size, min, max) {
  return f(Math.min(max, Math.max(min, (2.8 * vb) / Math.max(1, Number(size) || vb))));
}

export function svgWrap(w, h, vw, vh, body, extra = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" width="${f(w)}" height="${f(h)}" aria-hidden="true" focusable="false" stroke-linejoin="round" stroke-linecap="round"${extra}>${body}</svg>`;
}

// Line colour of outlines. withInk() swaps it while one picture is drawn (art is drawn
// synchronously, so the swap never leaks into another picture).
let ink = INK;
export function withInk(color, draw) {
  const prev = ink;
  ink = color;
  try {
    return draw();
  } finally {
    ink = prev;
  }
}

// Round joins/caps are set once on the root <svg> (see svgWrap) and inherited.
export const stroke = (w, color = ink) => ` stroke="${color}" stroke-width="${f(w)}"`;
export const op = (o) => ` opacity="${o}"`;
export const tf = (s) => ` transform="${s}"`;
export const circle = (cx, cy, r, fill, a = '') => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${fill}"${a}/>`;
export const ellipse = (cx, cy, rx, ry, fill, a = '') => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"${a}/>`;
export const path = (d, fill, a = '') => `<path d="${d}" fill="${fill}"${a}/>`;
export const rect = (x, y, w, h, r, fill, a = '') => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}" fill="${fill}"${a}/>`;
export const g = (transform, body, a = '') => `<g transform="${transform}"${a}>${body}</g>`;
export const line = (d, color, w, a = '') => path(d, 'none', stroke(w, color) + a);
// Coloured line with an ink outline (stems, straws, handles, drizzles).
export const tube = (d, color, w, sw) => line(d, ink, w + sw * 2) + line(d, color, w);
// Filled shape: fill, inner details, then the outline on top so details never cover it.
export const shape = (d, fill, sw, inner = '') => path(d, fill) + inner + path(d, 'none', stroke(sw));
export const gloss = (cx, cy, rx, ry, rot = -35, o = 0.55) => ellipse(cx, cy, rx, ry, WHITE, op(o) + tf(`rotate(${f(rot)} ${f(cx)} ${f(cy)})`));
export const rrect = (x, y, w, h, r) => `M${f(x + r)} ${f(y)}H${f(x + w - r)}Q${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + r)}V${f(y + h - r)}Q${f(x + w)} ${f(y + h)} ${f(x + w - r)} ${f(y + h)}H${f(x + r)}Q${f(x)} ${f(y + h)} ${f(x)} ${f(y + h - r)}V${f(y + r)}Q${f(x)} ${f(y)} ${f(x + r)} ${f(y)}Z`;

// Crescent-shaped shade inside a circle, on the side `ang` points to.
export function crescent(cx, cy, r, ang, d, fill, a = '') {
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  const c2x = cx - ux * d;
  const c2y = cy - uy * d;
  const mx = cx - (ux * d) / 2;
  const my = cy - (uy * d) / 2;
  const h = Math.sqrt(Math.max(0, r * r - (d * d) / 4));
  const p1 = [mx - uy * h, my + ux * h];
  const p2 = [mx + uy * h, my - ux * h];
  const q = [cx + ux * r, cy + uy * r];
  const q2 = [c2x + ux * r, c2y + uy * r];
  const s1 = (p1[0] - cx) * (q[1] - cy) - (p1[1] - cy) * (q[0] - cx) > 0 ? 1 : 0;
  const s2 = (p2[0] - c2x) * (q2[1] - c2y) - (p2[1] - c2y) * (q2[0] - c2x) > 0 ? 1 : 0;
  const R = f(r);
  return path(`M${f(p1[0])} ${f(p1[1])}A${R} ${R} 0 1 ${s1} ${f(p2[0])} ${f(p2[1])}A${R} ${R} 0 0 ${s2} ${f(p1[0])} ${f(p1[1])}Z`, fill, a);
}

// Shaded, glossy, outlined ball (berries, beads, fruit).
export function ball(cx, cy, r, fill, shadeCol, sw, hi = 0.6) {
  return circle(cx, cy, r, fill, stroke(sw)) + crescent(cx, cy, r - sw * 0.5, SHADE_DIR, r * 0.42, shadeCol) +
    gloss(cx - r * 0.36, cy - r * 0.4, r * 0.3, r * 0.19, -35, hi);
}

// Leaf from its base (x,y) pointing at `deg`; lower half shaded, light midrib.
export function leaf(x, y, len, wid, deg, fill, sw, vein = true) {
  const d = `M0 0Q${f(len * 0.42)} ${f(-wid)} ${f(len)} 0Q${f(len * 0.58)} ${f(wid)} 0 0Z`;
  const sh = `M0 0Q${f(len * 0.58)} ${f(wid)} ${f(len)} 0Q${f(len * 0.5)} ${f(wid * 0.3)} 0 0Z`;
  const v = vein ? line(`M${f(len * 0.12)} 0Q${f(len * 0.5)} ${f(-wid * 0.1)} ${f(len * 0.8)} 0`, lighten(fill, 0.4), Math.max(0.8, sw * 0.45)) : '';
  return g(`translate(${f(x)} ${f(y)}) rotate(${f(deg)})`, shape(d, fill, sw, path(sh, darken(fill, 0.22)) + v));
}

// Broad leaf with side veins (mint, logo leaves).
export function bigLeaf(x, y, len, wid, deg, fill, sw) {
  let veins = line(`M${f(len * 0.08)} 0L${f(len * 0.86)} 0`, lighten(fill, 0.35), Math.max(0.8, sw * 0.5));
  for (const k of [0.3, 0.5, 0.7]) {
    const bx = len * k;
    veins += line(`M${f(bx)} 0L${f(bx + len * 0.12)} ${f(-wid * 0.32)}M${f(bx)} 0L${f(bx + len * 0.12)} ${f(wid * 0.32)}`, lighten(fill, 0.35), Math.max(0.7, sw * 0.38));
  }
  const d = `M0 0C${f(len * 0.2)} ${f(-wid * 0.75)} ${f(len * 0.75)} ${f(-wid * 0.7)} ${f(len)} 0C${f(len * 0.75)} ${f(wid * 0.7)} ${f(len * 0.2)} ${f(wid * 0.75)} 0 0Z`;
  const sh = `M0 0C${f(len * 0.2)} ${f(wid * 0.75)} ${f(len * 0.75)} ${f(wid * 0.7)} ${f(len)} 0C${f(len * 0.7)} ${f(wid * 0.3)} ${f(len * 0.2)} ${f(wid * 0.3)} 0 0Z`;
  return g(`translate(${f(x)} ${f(y)}) rotate(${f(deg)})`, shape(d, fill, sw, path(sh, darken(fill, 0.2)) + veins));
}

// Smooth blob through n jittered points around a circle.
export function blobPath(cx, cy, r, rng, n = 7, jit = 0.2, sy = 1) {
  const pts = [];
  const a0 = rng.next() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * Math.PI * 2;
    const rr = r * (1 - jit + rng.next() * jit * 2);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * sy]);
  }
  return smoothClosed(pts);
}

export function smoothClosed(pts) {
  const n = pts.length;
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const m = mid(pts[n - 1], pts[0]);
  let d = `M${f(m[0])} ${f(m[1])}`;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = mid(p, pts[(i + 1) % n]);
    d += `Q${f(p[0])} ${f(p[1])} ${f(q[0])} ${f(q[1])}`;
  }
  return `${d}Z`;
}

export function smoothOpen(pts) {
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const q = i === pts.length - 2 ? pts[i + 1] : [(p[0] + pts[i + 1][0]) / 2, (p[1] + pts[i + 1][1]) / 2];
    d += `Q${f(p[0])} ${f(p[1])} ${f(q[0])} ${f(q[1])}`;
  }
  return d;
}

export const polyPath = (pts) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`;

export function starPoints(cx, cy, ro, ri, n = 5, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro;
    const a = rot + (i * Math.PI) / n;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

export const sparkle = (x, y, r, fill = WHITE, a = '') =>
  path(`M${f(x)} ${f(y - r)}Q${f(x)} ${f(y)} ${f(x + r)} ${f(y)}Q${f(x)} ${f(y)} ${f(x)} ${f(y + r)}Q${f(x)} ${f(y)} ${f(x - r)} ${f(y)}Q${f(x)} ${f(y)} ${f(x)} ${f(y - r)}Z`, fill, a);

// Union of circles with one outer outline (clouds, curls, steam, afro).
export function puffs(list, fill, sw, shadeCol = null) {
  let s = '';
  for (const [x, y, r] of list) s += circle(x, y, r + sw, ink);
  for (const [x, y, r] of list) s += circle(x, y, r, fill);
  if (shadeCol) for (const [x, y, r] of list) s += crescent(x, y, r * 0.92, SHADE_DIR, r * 0.35, shadeCol, op(0.55));
  return s;
}

// Palm frond pointing along +x and drooping: smooth upper edge, toothed lower edge.
export function frondPath(len, wid, sag) {
  const n = 10;
  const rib = (k) => [k * len, sag * len * k * k];
  const up = [[0, 0]];
  const dn = [];
  for (let i = 1; i < n; i++) {
    const k = i / n;
    const [x, y] = rib(k);
    const l = Math.hypot(len, 2 * sag * len * k);
    const nx = (-2 * sag * len * k) / l;
    const ny = len / l;
    const w = wid * Math.sin(Math.PI * k) ** 0.65;
    up.push([x - nx * w * 0.75, y - ny * w * 0.75]);
    const tooth = i % 2 ? 1.2 : 0.4;
    dn.push([x + nx * w * tooth - (i % 2) * len * 0.04, y + ny * w * tooth]);
  }
  up.push(rib(1));
  return `${smoothOpen(up)}${dn.reverse().map(([x, y]) => `L${f(x)} ${f(y)}`).join('')}Z`;
}

export function frond(x, y, len, wid, deg, fill, sw, sag = 0.25) {
  const sg = Math.cos((deg * Math.PI) / 180) < 0 ? -Math.abs(sag) : Math.abs(sag);
  return g(`translate(${f(x)} ${f(y)}) rotate(${f(deg)})`,
    shape(frondPath(len, wid, sg), fill, sw, line(`M0 0Q${f(len * 0.5)} ${f(sg * len * 0.25)} ${f(len * 0.96)} ${f(sg * len * 0.92)}`, darken(fill, 0.3), Math.max(1, sw * 0.7))));
}

// ---------------------------------------------------------------- shared paint servers
// The realistic art shades shapes with a few shared gradients (url(#af-…)) that sit in one hidden
// <svg> in the page (artDefsSVG(), inserted once by main.js). A shape is filled with its own colour
// and an overlay with the same outline adds the light: one set of neutral gradients serves every
// colour, and memoised art stays free of ids. Material fills name a plain fallback colour.
export const ART_DEFS_ID = 'af-defs';

const stops = (list) => list.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}"${a < 1 ? ` stop-opacity="${a}"` : ''}/>`).join('');
const linear = (id, [x1, y1, x2, y2], list) => `<linearGradient id="af-${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops(list)}</linearGradient>`;
const radial = (id, [cx, cy, r, fx = cx, fy = cy], list) => `<radialGradient id="af-${id}" cx="${cx}" cy="${cy}" r="${r}" fx="${fx}" fy="${fy}">${stops(list)}</radialGradient>`;
const B = '#000000';
const W = '#ffffff';

const PAINTS = [
  // overlays: light from the top left, neutral so they work on any colour
  radial('sph', [0.38, 0.32, 0.78, 0.3, 0.24], [[0, W, 0.62], [0.2, W, 0.2], [0.42, W, 0], [0.68, B, 0.06], [1, B, 0.42]]),
  radial('sph-soft', [0.4, 0.34, 0.8, 0.34, 0.28], [[0, W, 0.35], [0.3, W, 0.06], [0.55, B, 0], [1, B, 0.3]]),
  linear('cyl', [0, 0, 1, 0], [[0, B, 0.42], [0.1, B, 0.14], [0.24, W, 0.26], [0.36, W, 0.06], [0.55, B, 0], [0.8, B, 0.16], [1, B, 0.46]]),
  linear('cyl-soft', [0, 0, 1, 0], [[0, B, 0.24], [0.24, W, 0.16], [0.5, B, 0], [1, B, 0.28]]),
  linear('down', [0, 0, 0, 1], [[0, W, 0.34], [0.45, W, 0], [1, B, 0.3]]),
  linear('down-dark', [0, 0, 0, 1], [[0, B, 0], [1, B, 0.38]]),
  linear('up-dark', [0, 0, 0, 1], [[0, B, 0.38], [1, B, 0]]),
  linear('gloss', [0, 0, 0, 1], [[0, W, 0.9], [1, W, 0]]),
  linear('gloss-x', [0, 0, 1, 0], [[0, W, 0], [0.5, W, 0.85], [1, W, 0]]),
  radial('shadow', [0.5, 0.5, 0.5], [[0, B, 0.42], [0.55, B, 0.2], [1, B, 0]]),
  radial('glow', [0.5, 0.5, 0.5], [[0, W, 0.9], [0.5, W, 0.35], [1, W, 0]]),
  radial('warm-glow', [0.5, 0.5, 0.5], [[0, '#ffe2a8', 0.75], [0.45, '#ffcf7a', 0.25], [1, '#ffcf7a', 0]]),
  // clear PET: almost invisible in the middle, bright at the edges (Fresnel)
  linear('plastic', [0, 0, 1, 0], [[0, W, 0.7], [0.07, W, 0.24], [0.2, W, 0.08], [0.5, W, 0.02], [0.78, W, 0.06], [0.93, W, 0.3], [1, W, 0.72]]),
  linear('plastic-in', [0, 0, 1, 0], [[0, '#cfe6ee', 0.5], [0.3, '#eaf6fa', 0.22], [0.7, '#eaf6fa', 0.22], [1, '#cfe6ee', 0.55]]),
  // brushed stainless steel
  linear('steel', [0, 0, 1, 0], [[0, '#9aa4ae'], [0.12, '#e9eef2'], [0.3, '#bfc8d0'], [0.52, '#f6f8fa'], [0.74, '#b6bfc8'], [0.9, '#dde3e8'], [1, '#a3adb7']]),
  linear('steel-v', [0, 0, 0, 1], [[0, '#f5f7f9'], [0.35, '#d8dee3'], [0.7, '#c2cad1'], [1, '#9ea8b2']]),
  linear('steel-in', [0, 0, 0, 1], [[0, '#7d8792'], [0.4, '#a9b2bb'], [1, '#d6dce1']]),
  linear('steel-rim', [0, 0, 0, 1], [[0, '#ffffff'], [0.5, '#d9dfe4'], [1, '#8f99a4']]),
  // matte black appliance plastic
  linear('black', [0, 0, 1, 0], [[0, '#0f0f13'], [0.18, '#3a3a43'], [0.34, '#26262d'], [0.7, '#1a1a20'], [1, '#08080a']]),
  linear('black-v', [0, 0, 0, 1], [[0, '#4a4a54'], [0.25, '#2a2a31'], [1, '#121216']]),
  // glass
  linear('glass', [0, 0, 1, 0], [[0, '#d8f1f6', 0.75], [0.1, W, 0.35], [0.3, W, 0.1], [0.7, W, 0.06], [0.9, W, 0.3], [1, '#d8f1f6', 0.8]]),
];

// Art modules add their own shared clip paths here when they load (fixed geometry, so one
// definition in the page serves every picture that uses it).
const EXTRA_DEFS = [];
export function registerDefs(markup) {
  if (!EXTRA_DEFS.includes(markup)) EXTRA_DEFS.push(markup);
}

export function artDefsSVG() {
  return `<svg id="${ART_DEFS_ID}" xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden"><defs>${PAINTS.join('')}${EXTRA_DEFS.join('')}</defs></svg>`;
}

// Paint references: url(#af-…) with a fallback colour (no defs in the page → plain fill, never black).
export const paint = (id, fallback = 'none') => `url(#af-${id}) ${fallback}`;
// The same outline once more, filled with a light overlay.
export const lit = (d, kind = 'sph', a = '') => path(d, paint(kind), a);
export const litEllipse = (cx, cy, rx, ry, kind = 'sph', a = '') => ellipse(cx, cy, rx, ry, paint(kind), a);
export const litCircle = (cx, cy, r, kind = 'sph', a = '') => circle(cx, cy, r, paint(kind), a);
// Soft contact shadow on the surface an object stands on.
export const softShadow = (cx, cy, rx, ry, o = 1) => ellipse(cx, cy, rx, ry, paint('shadow'), o < 1 ? op(o) : '');
// Darker shade for thin outlines of realistic shapes.
export const edge = (c, k = 0.42) => mix(c, '#1b0d16', k);
