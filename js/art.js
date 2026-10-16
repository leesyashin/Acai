// Cartoon art for Açaí Fever – every export returns an inline <svg> string.
// Look: bright flat cartoon, round shapes, thick ink outline, one shade + one
// highlight per shape, light from the top-left. Pure module (no DOM access):
// the same input always draws the same picture (pseudo-randomness is derived
// from a hash of the input). Ids inside <defs> are unique per call.

import { ING } from './data.js';
import { createRng } from './rng.js';
import { registerStrings, t } from './i18n.js';

registerStrings({
  de: { 'art.menu': 'Menü', 'art.neon': 'Açaí', 'art.logoTop': 'Açaí', 'art.logoBottom': 'Fever' },
  en: { 'art.menu': 'Menu', 'art.neon': 'Açaí', 'art.logoTop': 'Açaí', 'art.logoBottom': 'Fever' },
});

// ---------------------------------------------------------------- palette
const INK = '#2a1236';
const WHITE = '#ffffff';
const PINK = '#ff3d8b';
const LAGOON = '#18c2c9';
const MANGO = '#ffb627';
const LEAF = '#2fbf71';
const CREAM = '#fff4df';
const WOOD = '#c97d43';
const WOOD_D = '#8e4f22';
const PURPLE = '#6c2a8f';
const DANGER = '#ff4d4d';
const SHADE_DIR = Math.PI / 4; // light from top-left → shade bottom-right
const FONT = `'Lilita One', 'Trebuchet MS', system-ui, sans-serif`;

// ---------------------------------------------------------------- helpers
const f = (n) => Math.round(n * 10) / 10;
let idSeq = 0;
const uid = (p) => `af-${p}-${(++idSeq).toString(36)}`;

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const rngFor = (key) => createRng(hashStr(String(key)));

// Small cache for id-free, language-independent art that is redrawn often.
const memoCache = new Map();
function memo(key, draw) {
  let v = memoCache.get(key);
  if (v === undefined) {
    v = draw();
    if (memoCache.size >= 400) memoCache.delete(memoCache.keys().next().value);
    memoCache.set(key, v);
  }
  return v;
}

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, k) {
  const A = rgb(a);
  const B = rgb(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('')}`;
}
const lighten = (c, k) => mix(c, WHITE, k);
const darken = (c, k) => mix(c, INK, k);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Outline width in viewBox units so it renders ~2.8 px at the used size (clamped).
function ow(vb, size, min, max) {
  return f(Math.min(max, Math.max(min, (2.8 * vb) / Math.max(1, Number(size) || vb))));
}

function svgWrap(w, h, vw, vh, body, extra = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" width="${f(w)}" height="${f(h)}" aria-hidden="true" focusable="false" stroke-linejoin="round" stroke-linecap="round"${extra}>${body}</svg>`;
}

// Round joins/caps are set once on the root <svg> (see svgWrap) and inherited.
const stroke = (w, color = INK) => ` stroke="${color}" stroke-width="${f(w)}"`;
const op = (o) => ` opacity="${o}"`;
const tf = (s) => ` transform="${s}"`;
const circle = (cx, cy, r, fill, a = '') => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${fill}"${a}/>`;
const ellipse = (cx, cy, rx, ry, fill, a = '') => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"${a}/>`;
const path = (d, fill, a = '') => `<path d="${d}" fill="${fill}"${a}/>`;
const rect = (x, y, w, h, r, fill, a = '') => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}" fill="${fill}"${a}/>`;
const g = (transform, body, a = '') => `<g transform="${transform}"${a}>${body}</g>`;
const line = (d, color, w, a = '') => path(d, 'none', stroke(w, color) + a);
// Coloured line with an ink outline (stems, straws, handles, drizzles).
const tube = (d, color, w, sw) => line(d, INK, w + sw * 2) + line(d, color, w);
// Filled shape: fill, inner details, then the outline on top so details never cover it.
const shape = (d, fill, sw, inner = '') => path(d, fill) + inner + path(d, 'none', stroke(sw));
const gloss = (cx, cy, rx, ry, rot = -35, o = 0.55) => ellipse(cx, cy, rx, ry, WHITE, op(o) + tf(`rotate(${f(rot)} ${f(cx)} ${f(cy)})`));
const rrect = (x, y, w, h, r) => `M${f(x + r)} ${f(y)}H${f(x + w - r)}Q${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + r)}V${f(y + h - r)}Q${f(x + w)} ${f(y + h)} ${f(x + w - r)} ${f(y + h)}H${f(x + r)}Q${f(x)} ${f(y + h)} ${f(x)} ${f(y + h - r)}V${f(y + r)}Q${f(x)} ${f(y)} ${f(x + r)} ${f(y)}Z`;

// Crescent-shaped shade inside a circle, on the side `ang` points to.
function crescent(cx, cy, r, ang, d, fill, a = '') {
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
function ball(cx, cy, r, fill, shadeCol, sw, hi = 0.6) {
  return circle(cx, cy, r, fill, stroke(sw)) + crescent(cx, cy, r - sw * 0.5, SHADE_DIR, r * 0.42, shadeCol) +
    gloss(cx - r * 0.36, cy - r * 0.4, r * 0.3, r * 0.19, -35, hi);
}

// Leaf from its base (x,y) pointing at `deg`; lower half shaded, light midrib.
function leaf(x, y, len, wid, deg, fill, sw, vein = true) {
  const d = `M0 0Q${f(len * 0.42)} ${f(-wid)} ${f(len)} 0Q${f(len * 0.58)} ${f(wid)} 0 0Z`;
  const sh = `M0 0Q${f(len * 0.58)} ${f(wid)} ${f(len)} 0Q${f(len * 0.5)} ${f(wid * 0.3)} 0 0Z`;
  const v = vein ? line(`M${f(len * 0.12)} 0Q${f(len * 0.5)} ${f(-wid * 0.1)} ${f(len * 0.8)} 0`, lighten(fill, 0.4), Math.max(0.8, sw * 0.45)) : '';
  return g(`translate(${f(x)} ${f(y)}) rotate(${f(deg)})`, shape(d, fill, sw, path(sh, darken(fill, 0.22)) + v));
}

// Broad leaf with side veins (mint, logo leaves).
function bigLeaf(x, y, len, wid, deg, fill, sw) {
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
function blobPath(cx, cy, r, rng, n = 7, jit = 0.2, sy = 1) {
  const pts = [];
  const a0 = rng.next() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * Math.PI * 2;
    const rr = r * (1 - jit + rng.next() * jit * 2);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * sy]);
  }
  return smoothClosed(pts);
}

function smoothClosed(pts) {
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

function smoothOpen(pts) {
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const q = i === pts.length - 2 ? pts[i + 1] : [(p[0] + pts[i + 1][0]) / 2, (p[1] + pts[i + 1][1]) / 2];
    d += `Q${f(p[0])} ${f(p[1])} ${f(q[0])} ${f(q[1])}`;
  }
  return d;
}

const polyPath = (pts) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`;

function starPoints(cx, cy, ro, ri, n = 5, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro;
    const a = rot + (i * Math.PI) / n;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

const sparkle = (x, y, r, fill = WHITE, a = '') =>
  path(`M${f(x)} ${f(y - r)}Q${f(x)} ${f(y)} ${f(x + r)} ${f(y)}Q${f(x)} ${f(y)} ${f(x)} ${f(y + r)}Q${f(x)} ${f(y)} ${f(x - r)} ${f(y)}Q${f(x)} ${f(y)} ${f(x)} ${f(y - r)}Z`, fill, a);

// Union of circles with one outer outline (clouds, curls, steam, afro).
function puffs(list, fill, sw, shadeCol = null) {
  let s = '';
  for (const [x, y, r] of list) s += circle(x, y, r + sw, INK);
  for (const [x, y, r] of list) s += circle(x, y, r, fill);
  if (shadeCol) for (const [x, y, r] of list) s += crescent(x, y, r * 0.92, SHADE_DIR, r * 0.35, shadeCol, op(0.55));
  return s;
}

// Palm frond pointing along +x and drooping: smooth upper edge, toothed lower edge.
function frondPath(len, wid, sag) {
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

function frond(x, y, len, wid, deg, fill, sw, sag = 0.25) {
  const sg = Math.cos((deg * Math.PI) / 180) < 0 ? -Math.abs(sag) : Math.abs(sag);
  return g(`translate(${f(x)} ${f(y)}) rotate(${f(deg)})`,
    shape(frondPath(len, wid, sg), fill, sw, line(`M0 0Q${f(len * 0.5)} ${f(sg * len * 0.25)} ${f(len * 0.96)} ${f(sg * len * 0.92)}`, darken(fill, 0.3), Math.max(1, sw * 0.7))));
}

// ======================================================================
// Ingredient icons (viewBox 100×100)
// ======================================================================

function seedSpiral(cx, cy, rMax, n, rx, ry, fill) {
  let s = '';
  for (let i = 1; i <= n; i++) {
    const rr = rMax * Math.sqrt(i / n);
    const a = i * 2.39996;
    s += ellipse(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, rx, ry, fill, tf(`rotate(${f((a * 180) / Math.PI)} ${f(cx + Math.cos(a) * rr)} ${f(cy + Math.sin(a) * rr)})`));
  }
  return s;
}

function crownStar(x, y, r, col, sw) {
  return path(polyPath(starPoints(x, y, r, r * 0.45)), col, stroke(Math.max(0.6, sw * 0.45))) + circle(x, y, r * 0.28, darken(col, 0.35));
}

function granolaChunk(x, y, r, rng, sw, ing, i) {
  const d = blobPath(x, y, r, rng, 7, 0.27);
  const base = i % 2 ? ing.color : mix(ing.color, ing.color2, 0.3);
  let oats = '';
  for (let k = 0; k < 2; k++) {
    const ox = x + (rng.next() - 0.55) * r * 1.1;
    const oy = y + (rng.next() - 0.6) * r * 0.9;
    const a = rng.next() * Math.PI;
    oats += `M${f(ox)} ${f(oy)}l${f(Math.cos(a) * r * 0.3)} ${f(Math.sin(a) * r * 0.3)}`;
  }
  let inner = crescent(x, y, r * 0.68, SHADE_DIR, r * 0.42, ing.color2, op(0.75));
  inner += line(oats, '#f6dca6', Math.max(1, r * 0.24));
  if (i % 3 === 0) inner += circle(x + r * 0.3, y + r * 0.1, r * 0.17, '#5a2440');
  inner += gloss(x - r * 0.38, y - r * 0.42, r * 0.24, r * 0.12, -30, 0.5);
  return path(d, base, stroke(sw)) + inner;
}

function peanutShell(x, y, s, deg, sw) {
  const d = `M${f(-s)} 0C${f(-s)} ${f(-s * 0.7)} ${f(-s * 0.35)} ${f(-s * 0.75)} 0 ${f(-s * 0.42)}C${f(s * 0.35)} ${f(-s * 0.75)} ${f(s)} ${f(-s * 0.7)} ${f(s)} 0C${f(s)} ${f(s * 0.7)} ${f(s * 0.35)} ${f(s * 0.75)} 0 ${f(s * 0.42)}C${f(-s * 0.35)} ${f(s * 0.75)} ${f(-s)} ${f(s * 0.7)} ${f(-s)} 0Z`;
  const dots = [[-0.55, -0.15], [-0.4, 0.25], [0.45, -0.2], [0.6, 0.2], [0.15, 0.05]].map(([a, b]) => circle(a * s, b * s, Math.max(0.6, s * 0.07), '#b98547')).join('');
  return g(`translate(${f(x)} ${f(y)}) rotate(${f(deg)})`, shape(d, '#e9bb7a', sw, path(`M${f(s)} 0C${f(s)} ${f(s * 0.7)} ${f(s * 0.35)} ${f(s * 0.75)} 0 ${f(s * 0.42)}C${f(s * 0.2)} ${f(s * 0.3)} ${f(s * 0.6)} ${f(s * 0.4)} ${f(s)} 0Z`, '#cf9a58') + dots));
}

const ICONS = {
  acai(sw, ing) {
    // a little heap of dark açaí berries in front of two palm leaflets
    let s = leaf(46, 80, 50, 16, -142, '#23a35e', sw) + leaf(54, 80, 50, 16, -38, LEAF, sw);
    const main = mix(ing.color, ing.color2, 0.3);
    const pts = [[50, 40], [38, 58], [62, 58], [26, 76], [50, 77], [74, 76]];
    for (const [x, y] of pts) s += ball(x, y, 13, main, darken(ing.color, 0.25), sw, 0.7) + circle(x + 5, y - 7, 1.8, lighten(ing.color2, 0.35));
    return s;
  },

  pitaya(sw, ing) {
    const cx = 50;
    const cy = 52;
    const r = 33;
    let s = '';
    for (let i = 0; i < 8; i++) {
      const deg = (i / 8) * 360 - 68;
      const a = (deg * Math.PI) / 180;
      const bx = cx + Math.cos(a) * (r - 5);
      const by = cy + Math.sin(a) * (r - 5);
      s += leaf(bx, by, 17, 8, deg, '#e8277b', sw * 0.85, false);
      s += leaf(bx + Math.cos(a) * 9, by + Math.sin(a) * 9, 8, 5, deg, '#8fd14f', sw * 0.7, false);
    }
    s += circle(cx, cy, r, '#c2185b', stroke(sw));
    s += circle(cx, cy, r - 5, '#ffc2dc');
    s += circle(cx, cy, r - 8, ing.color) + crescent(cx, cy, r - 8, SHADE_DIR, 7, darken(ing.color, 0.15));
    s += seedSpiral(cx, cy, r - 13, 24, 1.9, 1.3, INK);
    s += gloss(cx - 12, cy - 13, 8, 4.5, -40, 0.5);
    return s;
  },

  spirulina(sw, ing) {
    const wood = '#e6a65d';
    let s = tube('M66 70L90 42', wood, 10, sw);
    const cup = 'M12 58Q13 90 44 90Q75 90 76 58Z';
    s += shape(cup, wood, sw, path('M44 90Q75 90 76 58L67 60Q67 84 44 86Z', darken(wood, 0.18)) + gloss(24, 72, 3.5, 8, 10, 0.45));
    const dome = 'M13 58C14 22 74 22 75 58A31 8 0 0 1 13 58Z';
    const domeShade = 'M75 58C75 40 68 30 56 26C66 36 68 50 62 65.5A31 8 0 0 0 75 58Z';
    let specks = '';
    for (const [x, y, c] of [[38, 44, 1], [52, 38, 1], [60, 50, 0], [28, 52, 1], [46, 56, 0], [36, 34, 0], [66, 44, 1]]) {
      specks += circle(x, y, 2, c ? ing.color2 : darken(ing.color, 0.3));
    }
    s += shape(dome, ing.color, sw, path(domeShade, darken(ing.color, 0.2)) + specks + gloss(32, 37, 9, 5, -30, 0.5));
    s += sparkle(86, 18, 7) + sparkle(86, 18, 7, 'none', stroke(sw * 0.45)) + circle(18, 24, 3, ing.color2, stroke(sw * 0.5)) + circle(90, 64, 2.5, ing.color, stroke(sw * 0.5));
    return s;
  },

  banana(sw, ing) {
    const body = 'M16 40C20 80 70 92 88 36C70 58 34 60 16 40Z';
    const sh = 'M16 40C20 80 70 92 88 36C76 70 36 76 16 40Z';
    let s = tube('M86 38L92 23', '#9a7a32', 5.5, sw) + circle(92.5, 22, 3.4, '#5a3d1c', stroke(sw * 0.6));
    s += shape(body, ing.color, sw, path(sh, ing.color2) + line('M27 52C42 64 60 63 74 51', WHITE, 4, op(0.6)));
    s += circle(16.5, 40.5, 3.4, '#5a3d1c', stroke(sw * 0.6));
    return s;
  },

  granola(sw, ing) {
    const rng = rngFor('granola-icon');
    const chunks = [[50, 34, 12], [34, 48, 13], [66, 48, 13], [50, 58, 14], [20, 70, 12], [80, 70, 12], [36, 76, 14], [64, 77, 14], [50, 84, 11]];
    return chunks.map(([x, y, r], i) => granolaChunk(x, y, r, rng, sw, ing, i)).join('');
  },

  strawberry(sw, ing) {
    const body = 'M50 92C28 86 12 62 18 44C22 32 36 28 50 33C64 28 78 32 82 44C88 62 72 86 50 92Z';
    const sh = 'M50 92C72 86 88 62 82 44C80 39 77 36 73 34C78 56 70 78 50 92Z';
    let seeds = '';
    for (const [x, y] of [[34, 47], [50, 45], [66, 47], [27, 59], [42, 59], [58, 59], [73, 59], [35, 71], [50, 72], [65, 71], [43, 82], [57, 82]]) {
      seeds += ellipse(x, y, 1.7, 2.5, '#ffe9a0');
    }
    let s = shape(body, ing.color, sw, path(sh, darken(ing.color, 0.22)) + seeds + gloss(30, 46, 7, 4, -50));
    const green = ing.color2;
    for (const deg of [200, 160, 95, 20, -20]) s += leaf(50, 34, 19, 8, deg, green, sw * 0.85, false);
    s += tube('M50 32Q50 22 57 15', green, 4.5, sw * 0.85);
    return s;
  },

  blueberry(sw, ing) {
    let s = '';
    for (const [x, y, r] of [[50, 38, 18], [31, 64, 19.5], [69, 65, 19.5]]) {
      s += ball(x, y, r, ing.color, ing.color2, sw) + crownStar(x + r * 0.1, y - r * 0.32, r * 0.32, ing.color2, sw);
    }
    return s;
  },

  mango(sw, ing) {
    // whole mango with a blush, plus juicy cubes in front
    const body = 'M60 12C84 12 96 36 90 56C84 76 62 84 46 78C30 72 28 52 36 36C42 22 48 12 60 12Z';
    let s = tube('M60 13L62 5', WOOD_D, 3.5, sw) + leaf(62, 8, 26, 11, -14, LEAF, sw);
    s += shape(body, ing.color, sw,
      path('M60 12C80 12 92 26 92 40C84 30 72 24 58 22C54 18 56 13 60 12Z', '#ff6a3d', op(0.85)) +
      path('M90 56C84 76 62 84 46 78C64 76 80 66 86 48Z', ing.color2) +
      ellipse(48, 30, 7, 4, '#9ccf3a', op(0.7) + tf('rotate(-40 48 30)')) + gloss(44, 44, 4.5, 9, 20, 0.5));
    s += cubePiece(22, 70, 9.5, -12, ing, sw) + cubePiece(44, 84, 9.5, 8, ing, sw) + cubePiece(30, 52, 8.5, 18, ing, sw);
    return s;
  },

  kiwi(sw, ing) {
    const cx = 50;
    const cy = 50;
    const r = 38;
    let s = circle(cx, cy, r, ing.color2) + circle(cx, cy, r - 6, ing.color) + crescent(cx, cy, r - 6, SHADE_DIR, 7, darken(ing.color, 0.15));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.2;
      s += line(`M${f(cx + Math.cos(a) * 12)} ${f(cy + Math.sin(a) * 12)}L${f(cx + Math.cos(a) * 28)} ${f(cy + Math.sin(a) * 28)}`, lighten(ing.color, 0.35), 1.8, op(0.8));
    }
    s += ellipse(cx, cy, 10, 9, '#f2f7cf');
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const x = cx + Math.cos(a) * 15.5;
      const y = cy + Math.sin(a) * 14.5;
      s += ellipse(x, y, 1.4, 3, INK, tf(`rotate(${f((a * 180) / Math.PI + 90)} ${f(x)} ${f(y)})`));
    }
    s += gloss(cx - 15, cy - 16, 8, 4, -40, 0.45);
    s += circle(cx, cy, r - 6, 'none', stroke(Math.max(0.8, sw * 0.4), darken(ing.color2, 0.2)));
    s += circle(cx, cy, r, 'none', stroke(sw));
    return s;
  },

  honey(sw, ing) {
    let s = tube('M58 30L84 9', WOOD, 5, sw) + ellipse(85, 8, 6, 4.5, WOOD, stroke(sw) + tf('rotate(-40 85 8)'));
    const pot = 'M30 40C12 48 12 84 30 92H70C88 84 88 48 70 40Z';
    const label = ellipse(50, 68, 16, 11, CREAM, stroke(sw * 0.7)) +
      path(polyPath([[50, 61.5], [55.6, 64.75], [55.6, 71.25], [50, 74.5], [44.4, 71.25], [44.4, 64.75]]), MANGO, stroke(sw * 0.55));
    s += shape(pot, ing.color, sw, path('M70 40C88 48 88 84 70 92H62C78 82 78 52 64 40Z', ing.color2) + gloss(28, 60, 4.5, 11, 10, 0.5) + label);
    s += shape(rrect(22, 28, 56, 13, 6), WOOD, sw, line('M28 32H60', WHITE, 2.5, op(0.4)));
    const drip = 'M23 34C23 25 77 25 77 34C77 37 73 37 71 35C67 38 62 35 59 37V46C59 50 53 50 53 46V38C49 39 45 35 41 38C37 40 31 36 29 38C26 39 23 37 23 34Z';
    s += shape(drip, '#ffd35a', sw, gloss(36, 30, 6, 2, 0, 0.7));
    return s;
  },

  coconut(sw, ing) {
    const shell = WOOD_D;
    let fibres = '';
    for (const [x, y] of [[26, 66], [40, 78], [60, 82], [74, 70], [50, 70]]) fibres += line(`M${x} ${y}l5 3`, darken(shell, 0.3), 1.6, op(0.7));
    let s = shape('M14 50C14 80 32 92 50 92C68 92 86 80 86 50Z', shell, sw,
      path('M86 50C86 80 68 92 50 92C66 86 76 72 77 54Z', darken(shell, 0.25)) + fibres + line('M20 60C22 72 28 80 36 85', lighten(shell, 0.3), 3, op(0.6)));
    s += ellipse(50, 50, 36, 17, ing.color, stroke(sw));
    s += ellipse(50, 51.5, 27.5, 11.5, ing.color2) + path('M22.5 51.5A27.5 11.5 0 0 1 77.5 51.5A27.5 7 0 0 0 22.5 51.5Z', darken(ing.color2, 0.12)) + ellipse(50, 51.5, 27.5, 11.5, 'none', stroke(sw * 0.5));
    const chip = (x, y, deg) => g(`translate(${x} ${y}) rotate(${deg})`, shape(rrect(-9, -3.6, 18, 7.2, 3.4), ing.color, sw * 0.7, line('M-5.5 1.4H5.5', ing.color2, 1.8) + line('M-6.5 -2.2H6.5', '#a8723f', 1.8)));
    s += chip(16, 88, -18) + chip(30, 93, 12) + chip(22, 80, 30) + chip(86, 90, -10);
    return s;
  },

  chia(sw) {
    const dish = '#7fd3dd';
    let s = shape('M14 60Q16 90 50 90Q84 90 86 60Z', dish, sw, path('M50 90Q84 90 86 60L77 62Q75 84 50 86Z', darken(dish, 0.2)) + line('M20 70Q34 82 50 83', WHITE, 2.5, op(0.6)));
    const rng = rngFor('chia-icon');
    let seeds = '';
    const cols = ['#222222', '#7c7c7c', '#d9d2c2', '#3a3a3a'];
    for (let i = 0; i < 34; i++) {
      const x = 22 + rng.next() * 56;
      const topY = 61 - 26 * (1 - ((x - 50) / 34) ** 2);
      const y = topY + 3 + rng.next() * (63 - topY - 3);
      seeds += ellipse(x, y, 2.3, 1.5, cols[i % 4], tf(`rotate(${f(rng.next() * 180)} ${f(x)} ${f(y)})`));
    }
    s += shape('M16 61C20 28 80 28 84 61A34 9 0 0 1 16 61Z', '#4a4a4a', sw, seeds + gloss(36, 42, 8, 4, -30, 0.35));
    for (const [x, y] of [[10, 94], [92, 92], [86, 96], [18, 97]]) s += ellipse(x, y, 2, 1.4, '#333333');
    return s;
  },

  peanut(sw, ing) {
    let s = shape(rrect(20, 34, 60, 58, 9), ing.color, sw,
      path('M80 43V83Q80 92 71 92H64Q72 88 72 80V40Z', ing.color2) + path('M26 40Q40 46 50 40Q60 34 74 40', 'none', stroke(3, lighten(ing.color, 0.3))) + line('M27 46V84', WHITE, 4, op(0.55)));
    s += rect(20, 54, 60, 24, 2, CREAM, stroke(sw * 0.8)) + peanutShell(50, 66, 10, -10, sw * 0.7);
    s += shape(rrect(17, 20, 66, 16, 6), DANGER, sw, line('M28 24V32M39 24V32M50 24V32M61 24V32M72 24V32', darken(DANGER, 0.25), 2) + line('M22 25H40', WHITE, 2.5, op(0.5)));
    s += peanutShell(80, 88, 11, -28, sw * 0.85);
    return s;
  },

  chocolate(sw, ing) {
    const body = 'M32 42Q32 34 40 34H60Q68 34 68 42V86Q68 92 62 92H38Q32 92 32 86Z';
    let s = path('M46 18L48 7H52L54 18Z', PINK, stroke(sw));
    s += shape('M37 35L43 18H57L63 35Z', PINK, sw, line('M44 22L41 32', WHITE, 2.5, op(0.5)));
    const label = rect(32, 54, 36, 24, 2, CREAM, stroke(sw * 0.7)) + path('M32 54H68V58Q65 64 61 58Q57 62 53 58Q49 66 45 58Q41 62 37 58Q35 60 32 58Z', ing.color);
    s += shape(body, ing.color, sw, path('M68 42V86Q68 92 62 92H58Q63 88 63 82V38Z', ing.color2) + line('M37 42V86', WHITE, 3.5, op(0.35)) + label);
    s += ellipse(80, 89, 13, 4.5, ing.color, stroke(sw * 0.8)) + gloss(76, 88, 5, 1.4, 0, 0.5);
    s += shape('M82 58C86 66 90 70 90 75A8 8 0 0 1 74 75C74 70 78 66 82 58Z', ing.color, sw * 0.85, gloss(79, 74, 2, 3.5, 20, 0.55));
    return s;
  },

  mint(sw, ing) {
    let s = tube('M50 92Q48 84 50 74', ing.color2, 5, sw);
    s += bigLeaf(49, 76, 46, 32, -150, ing.color, sw);
    s += bigLeaf(51, 76, 46, 32, -30, ing.color, sw);
    s += bigLeaf(50, 70, 40, 28, -90, lighten(ing.color, 0.1), sw);
    return s;
  },

  cacao(sw, ing) {
    // ribbed orange cacao pod, two beans and a few nibs
    const pod = '#e8892f';
    const podPath = 'M50 6C70 10 80 34 76 56C72 74 60 84 50 86C40 84 28 74 24 56C20 34 30 10 50 6Z';
    let s = g('rotate(-28 50 46)', tube('M50 8V0', '#6b8f2a', 4, sw) + shape(podPath, pod, sw,
      path('M50 6C70 10 80 34 76 56C72 74 60 84 50 86C62 72 66 40 58 10Z', darken(pod, 0.22)) +
      line('M50 9C42 30 42 62 50 83M50 9C58 30 58 62 50 83M44 10C30 28 30 62 44 80M56 10C70 28 70 62 56 80', darken(pod, 0.3), 2) +
      line('M32 30C29 40 29 52 32 60', WHITE, 3, op(0.5))));
    const bean = (x, y, deg) => g(`translate(${x} ${y}) rotate(${deg})`, ellipse(0, 0, 10, 6.5, '#8a4a2a', stroke(sw * 0.85)) + line('M-7 0Q0 -1.5 7 0', ing.color2, 1.6) + gloss(-4, -2.5, 3, 1.4, -10, 0.5));
    s += bean(70, 80, -18) + bean(84, 64, 30);
    const nibs = [[24, 84, 8, 10], [42, 88, 9, -15], [58, 92, 7, 30]];
    for (const [x, y, r, deg] of nibs) {
      const pts = [[-r, -r * 0.3], [-r * 0.2, -r * 0.85], [r * 0.9, -r * 0.4], [r * 0.7, r * 0.6], [-r * 0.5, r * 0.7]];
      s += g(`translate(${x} ${y}) rotate(${deg})`, shape(polyPath(pts), ing.color, sw * 0.85, path(polyPath([[-r * 0.2, -r * 0.85], [r * 0.9, -r * 0.4], [r * 0.1, -r * 0.1]]), lighten(ing.color, 0.3)) + path(polyPath([[r * 0.9, -r * 0.4], [r * 0.7, r * 0.6], [r * 0.1, -r * 0.1]]), ing.color2)));
    }
    return s;
  },
};

function unknownIcon(sw) {
  return circle(50, 50, 34, '#d8cde0', stroke(sw)) + `<text x="50" y="64" text-anchor="middle" font-family="${FONT}" font-size="40" fill="${INK}">?</text>`;
}

function iconBody(id, sw) {
  const ing = ING[id];
  return ing && ICONS[id] ? ICONS[id](sw, ing) : unknownIcon(sw);
}

export function ingredientIcon(id, size = 64) {
  return memo(`i|${id}|${size}`, () => {
    const sw = ow(100, size, 3.6, 6.4);
    return svgWrap(size, size, 100, 100, ellipse(50, 94, 32, 5, INK, op(0.16)) + iconBody(id, sw));
  });
}

// ======================================================================
// Frozen base pack (viewBox 100×100)
// ======================================================================
const PACK_COLORS = { acai: '#7b3a96', pitaya: '#ff3d8b', spirulina: '#2a9fd8' };

export function packIcon(baseId, size = 72) {
  return memo(`p|${baseId}|${size}`, () => drawPack(baseId, size));
}

function drawPack(baseId, size) {
  const id = ING[baseId] ? baseId : 'acai';
  const col = PACK_COLORS[id] || ING[id].color;
  const sw = ow(100, size, 3.4, 6.5);
  const body = 'M18 20H82Q90 54 85 85Q84 94 73 94H27Q16 94 15 85Q10 54 18 20Z';
  let zig = 'M16 23V12';
  for (let x = 16; x < 84; x += 6.8) zig += `L${f(x + 3.4)} 7L${f(x + 6.8)} 12`;
  zig += 'V23Z';
  let s = ellipse(50, 96, 32, 4, INK, op(0.16));
  let inner = path('M82 20Q90 54 85 85Q84 94 73 94H66Q77 88 77 76Q79 48 74 20Z', darken(col, 0.2));
  inner += line('M23 30Q19 56 22 82', WHITE, 4.5, op(0.45));
  // frost rim along the bottom and the top seal
  inner += path('M14 78Q22 72 30 78Q38 84 46 78Q54 72 62 78Q70 84 78 78Q83 75 87 78L85 85Q84 94 73 94H27Q16 94 15 85Z', WHITE, op(0.6));
  inner += path('M18 20H82L83 28Q76 33 68 28Q60 23 52 28Q44 33 36 28Q28 23 18 29Z', WHITE, op(0.45));
  inner += circle(50, 57, 25, CREAM, stroke(sw * 0.8));
  const k = 0.44;
  inner += g(`translate(${f(50 - 50 * k)} ${f(57 - 52 * k)}) scale(${k})`, iconBody(id, sw / k));
  let s2 = shape(body, col, sw, inner);
  s2 += shape(zig, lighten(col, 0.4), sw, line('M19 17H81', WHITE, 2, op(0.5)));
  const flake = 'M80 30V48M72 34.5L88 43.5M72 43.5L88 34.5';
  s2 += line(flake, INK, 6) + line(flake, WHITE, 2.8) + sparkle(22, 40, 4.5) + sparkle(78, 70, 4);
  s += g('rotate(-5 50 55)', s2);
  return svgWrap(size, size, 100, 100, s);
}

// ======================================================================
// Bowl (viewBox 200×200) – coconut shell, 3/4 top view
// ======================================================================
const RIM = { cx: 100, cy: 88, rx: 92, ry: 48 };
const INNER = { cx: 100, cy: 88, rx: 81, ry: 40 };
const SURF = { cx: 100, cy: 86, rx: 68, ry: 29 };
const SHELL = '#93531f';
const RIM_COL = '#fff2dc';

const surfHalf = (x) => {
  const u = (x - SURF.cx) / SURF.rx;
  return SURF.ry * Math.sqrt(Math.max(0, 1 - u * u));
};
const domeLift = (x) => {
  const u = (x - SURF.cx) / SURF.rx;
  return 4 * Math.max(0, 1 - u * u);
};

function cubePiece(x, y, s, deg, ing, sw) {
  return g(`translate(${f(x)} ${f(y)}) rotate(${f(deg)})`,
    rect(-s, -s * 0.55, s * 2, s * 1.7, s * 0.42, ing.color2, stroke(sw)) +
    rect(-s, -s, s * 2, s * 1.6, s * 0.42, ing.color, stroke(sw)) +
    gloss(-s * 0.35, -s * 0.45, s * 0.42, s * 0.2, -10, 0.65));
}

function slicePiece(x, y, s, ing, sw) {
  const ry = s * 0.74;
  const th = Math.max(2, s * 0.24);
  const kiwi = ing.id === 'kiwi';
  let d = ellipse(x, y + th, s, ry, kiwi ? darken(ing.color2, 0.1) : '#e9c95a', stroke(sw));
  d += ellipse(x, y, s, ry, kiwi ? ing.color2 : '#fff2bd', stroke(sw));
  if (kiwi) {
    d += ellipse(x, y, s * 0.82, ry * 0.82, ing.color) + ellipse(x, y, s * 0.3, ry * 0.3, '#f2f7cf');
    const seedR = s * 0.52;
    d += ellipse(x, y, seedR, ry * 0.52, 'none', stroke(Math.max(1, s * 0.13)) + ` stroke-dasharray="0.1 ${f(seedR * 0.62)}"`);
  } else {
    d += ellipse(x, y, s * 0.62, ry * 0.62, 'none', stroke(Math.max(0.8, sw * 0.4), '#f0d070'));
    let seeds = '';
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 - 1.2;
      seeds += `M${f(x + Math.cos(a) * s * 0.16)} ${f(y + Math.sin(a) * ry * 0.16)}h0`;
    }
    d += line(seeds, '#9a7a44', Math.max(1.2, s * 0.15));
  }
  return d + gloss(x - s * 0.42, y - ry * 0.38, s * 0.24, ry * 0.17, -15, 0.6);
}

function halfPiece(x, y, s, ing, sw, rng) {
  const rot = f((rng.next() - 0.5) * 60);
  const heart = (k, dy = 0) => `M0 ${f(s * k + dy)}C${f(-s * 1.15 * k)} ${f(s * 0.3 * k + dy)} ${f(-s * 0.95 * k)} ${f(-s * 0.85 * k + dy)} 0 ${f(-s * 0.6 * k + dy)}C${f(s * 0.95 * k)} ${f(-s * 0.85 * k + dy)} ${f(s * 1.15 * k)} ${f(s * 0.3 * k + dy)} 0 ${f(s * k + dy)}Z`;
  let body = path(heart(1), ing.color, stroke(sw)) + path(heart(0.72, s * 0.04), '#ffc9cc');
  body += path(`M0 ${f(-s * 0.32)}C${f(-s * 0.2)} 0 ${f(-s * 0.08)} ${f(s * 0.42)} 0 ${f(s * 0.62)}C${f(s * 0.08)} ${f(s * 0.42)} ${f(s * 0.2)} 0 0 ${f(-s * 0.32)}Z`, '#ff8a92');
  body += path(`M${f(-s * 0.32)} ${f(-s * 0.72)}Q0 ${f(-s * 0.48)} ${f(s * 0.32)} ${f(-s * 0.72)}Q0 ${f(-s * 0.95)} ${f(-s * 0.32)} ${f(-s * 0.72)}Z`, ing.color2, stroke(sw * 0.8));
  body += gloss(-s * 0.55, -s * 0.15, s * 0.14, s * 0.26, 20, 0.55);
  return g(`translate(${f(x)} ${f(y)}) rotate(${rot}) scale(1 0.84)`, body);
}

function berryPiece(x, y, s, ing, sw) {
  const cx = x + s * 0.15;
  const cy = y - s * 0.32;
  const a = s * 0.26;
  return ball(x, y, s, ing.color, ing.color2, sw) + line(`M${f(cx - a)} ${f(cy - a)}l${f(2 * a)} ${f(2 * a)}m0 ${f(-2 * a)}l${f(-2 * a)} ${f(2 * a)}`, ing.color2, Math.max(0.8, s * 0.2));
}

// size = piece radius, sp = spacing factor (<1 overlaps), k = max size relative to the sector width
const MID_STYLES = {
  slices: { size: 15, sp: 0.78, k: 0.8 },
  halves: { size: 14, sp: 0.9, k: 0.72 },
  berries: { size: 7.4, sp: 0.95, k: 0.42 },
  cubes: { size: 8.2, sp: 1.02, k: 0.45 },
  pile: { size: 10.5, sp: 0.88, k: 0.55 },
};

// Each layer-2 ingredient gets its own band across the surface (like a real açaí bowl).
function sectorsFor(n) {
  if (n === 1) return [{ cx: 100, hw: 36 }];
  const w = (SURF.rx * 2) / n;
  return Array.from({ length: n }, (_, i) => ({ cx: SURF.cx - SURF.rx + w * (i + 0.5), hw: w / 2 - 1 }));
}

function gridPoints(sec, size, sp, rng) {
  const cols = Math.max(1, Math.round((sec.hw * 2) / (size * 2 * sp)));
  const xMin = Math.max(sec.cx - sec.hw + size * 0.75, SURF.cx - SURF.rx + size * 0.9);
  const xMax = Math.min(sec.cx + sec.hw - size * 0.75, SURF.cx + SURF.rx - size * 0.9);
  const pitchY = size * 2 * 0.72 * sp;
  const pts = [];
  for (let c = 0; c < cols; c++) {
    const xc = cols === 1 ? sec.cx : xMin + ((xMax - xMin) * c) / (cols - 1);
    const rows = Math.max(1, Math.round((1.6 * surfHalf(xc)) / pitchY) + 1);
    for (let r = 0; r < rows; r++) {
      const v = rows === 1 ? 0 : (r / (rows - 1) - 0.5) * 1.6;
      const x = xc + (r % 2 ? 1 : -1) * Math.min(size * 0.35, sec.hw * 0.2) * (cols === 1 ? 1 : 0.5) + (rng.next() - 0.5) * 2.5;
      pts.push({ x, y: SURF.cy + v * surfHalf(x) - domeLift(x) + (rng.next() - 0.5) * 2 });
    }
  }
  return pts.sort((a, b) => a.y - b.y);
}

function midItems(mid, sw) {
  const secs = sectorsFor(mid.length);
  const isw = sw * 0.62;
  let s = '';
  mid.forEach((id, i) => {
    const ing = ING[id];
    const style = MID_STYLES[ing.style] ? ing.style : 'pile';
    const spec = MID_STYLES[style];
    const sec = secs[i];
    const rng = rngFor(`mid-${id}-${i}-${mid.length}`);
    const size = Math.min(spec.size, sec.hw * spec.k * 1.25);
    gridPoints(sec, size, spec.sp, rng).forEach((p, j) => {
      if (style === 'slices') s += slicePiece(p.x, p.y, size, ing, isw);
      else if (style === 'halves') s += halfPiece(p.x, p.y, size, ing, isw, rng);
      else if (style === 'berries') s += berryPiece(p.x, p.y, size, ing, isw);
      else if (style === 'cubes') s += cubePiece(p.x, p.y, size, (rng.next() - 0.5) * 30, ing, isw);
      else s += granolaChunk(p.x, p.y, size, rng, isw, ing, j);
    });
  });
  return s;
}

function scatter(id, n) {
  const rng = rngFor(`scatter-${id}`);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = rng.next() * Math.PI * 2;
    const r = Math.sqrt((i + rng.next()) / n) * 0.88;
    const x = SURF.cx + Math.cos(a) * r * SURF.rx;
    pts.push({ x, y: SURF.cy + Math.sin(a) * r * SURF.ry - domeLift(x) - 3, rot: rng.next() * 180, k: 0.8 + rng.next() * 0.4 });
  }
  return pts.sort((p, q) => p.y - q.y);
}

function drizzle(ing, k, sw) {
  const ang = [-0.45, 0.6, 1.35, 0.1][k % 4];
  const n = [7, 6, 8, 5][k % 4];
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = -0.86 + (1.72 * i) / n;
    const v = (i % 2 ? 1 : -1) * Math.sqrt(Math.max(0, 1 - u * u)) * 0.8;
    const ru = u * Math.cos(ang) - v * Math.sin(ang);
    const rv = u * Math.sin(ang) + v * Math.cos(ang);
    const x = SURF.cx + ru * SURF.rx;
    pts.push([x, SURF.cy + rv * SURF.ry - domeLift(x) - 4]);
  }
  const d = smoothOpen(pts);
  return line(d, INK, 4.8 + sw * 1.3) + line(d, ing.color, 4.8) + line(d, lighten(ing.color, 0.55), 1.4, op(0.75) + tf('translate(-0.6 -1.2)'));
}

function sprinkles(ing, sw) {
  let s = '';
  if (ing.style === 'flakes') {
    for (const p of scatter(ing.id, 14)) {
      s += g(`translate(${f(p.x)} ${f(p.y)}) rotate(${f(p.rot)}) scale(${f(p.k * 1.6)})`,
        path('M-5 1.6Q0 -3.8 5 1.6Q0 -0.6 -5 1.6Z', ing.color, stroke(sw * 0.4)));
    }
  } else if (ing.style === 'seeds') {
    const cols = ['#e2dccd', '#9a9a9a', '#2b2b2b', '#c9c1b1', '#5e5e5e'];
    const by = cols.map(() => '');
    scatter(ing.id, 46).forEach((p, i) => {
      const a = (p.rot * Math.PI) / 180;
      by[i % 5] += `M${f(p.x)} ${f(p.y)}l${f(Math.cos(a) * 1.3)} ${f(Math.sin(a) * 1.3)}`;
    });
    s += line(by.join(''), '#1f1f1f', 3.4);
    cols.forEach((c, i) => { s += line(by[i], c, 2.4); });
  } else {
    for (const p of scatter(ing.id, 12)) {
      const r = 4.2 * p.k;
      s += g(`translate(${f(p.x)} ${f(p.y)}) rotate(${f(p.rot)})`, path(polyPath([[-r, -r * 0.2], [-r * 0.1, -r], [r, -r * 0.3], [r * 0.6, r * 0.8], [-r * 0.6, r * 0.7]]), ing.color, stroke(sw * 0.45)) + circle(-r * 0.2, -r * 0.35, r * 0.3, lighten(ing.color, 0.35)));
    }
  }
  return s;
}

function mintSprig(ing, sw, x, y) {
  return bigLeaf(x, y, 28, 18, -155, ing.color, sw * 0.7) + bigLeaf(x, y, 30, 19, -40, ing.color, sw * 0.7) + bigLeaf(x, y - 2, 22, 14, -98, lighten(ing.color, 0.1), sw * 0.7);
}

function topItems(top, sw) {
  const isw = sw * 0.62;
  const styleOf = (id) => ING[id].style;
  let s = '';
  top.filter((id) => styleOf(id) === 'drizzle').forEach((id, k) => { s += drizzle(ING[id], k, isw); });
  for (const id of top) if (!['drizzle', 'leaves'].includes(styleOf(id))) s += sprinkles(ING[id], isw);
  top.filter((id) => styleOf(id) === 'leaves').forEach((id, k) => { s += mintSprig(ING[id], sw, k ? 66 : 136, k ? 66 : 68); });
  return s;
}

function bowlShell(sw) {
  const body = 'M8 88C10 142 52 184 100 184C148 184 190 142 192 88Z';
  let fib = '';
  for (const [x, y, a] of [[30, 120, 32], [48, 148, 22], [76, 168, 8], [124, 168, -8], [152, 150, -22], [170, 122, -32], [100, 154, 0], [64, 136, 18], [136, 136, -18]]) {
    fib += line(`M${x - 4} ${y}h8`, darken(SHELL, 0.32), 2, op(0.55) + tf(`rotate(${a} ${x} ${y})`));
  }
  return shape(body, SHELL, sw,
    path('M192 88C190 142 148 184 100 184C138 176 176 146 179 96Z', darken(SHELL, 0.25)) + fib +
    line('M22 116C26 138 40 158 58 168', lighten(SHELL, 0.35), 5, op(0.55)));
}

function puree(ing, sw) {
  const main = mix(ing.color, ing.color2, 0.35);
  return shape('M19 88A81 40 0 0 0 181 88C176 42 24 42 19 88Z', main, sw * 0.8,
    path('M19 88A81 40 0 0 0 181 88A81 30 0 0 1 19 88Z', darken(main, 0.25)) +
    line('M60 82C60 64 102 60 116 72C130 84 110 96 94 90C84 86 86 76 96 77', ing.color2, 5, op(0.85)) +
    line('M134 64C148 68 158 76 158 86', ing.color2, 4, op(0.6)) +
    gloss(62, 64, 18, 6, -12, 0.4));
}

function emptyInside(sw) {
  return ellipse(INNER.cx, INNER.cy, INNER.rx, INNER.ry, '#6e3a18') +
    ellipse(100, 100, 58, 22, '#93552a') + gloss(76, 96, 16, 5, -8, 0.25) +
    path('M19 88A81 40 0 0 1 181 88A81 30 0 0 0 19 88Z', darken('#6e3a18', 0.3), op(0.6)) +
    ellipse(INNER.cx, INNER.cy, INNER.rx, INNER.ry, 'none', stroke(sw * 0.8));
}

function bowlBody(bowl, sw) {
  const b = bowl || {};
  const base = ING[b.base];
  const mid = (b.mid || []).filter((id) => ING[id]);
  const top = (b.top || []).filter((id) => ING[id]);
  let s = ellipse(100, 186, 74, 8, INK, op(0.16));
  s += bowlShell(sw);
  s += ellipse(RIM.cx, RIM.cy, RIM.rx, RIM.ry, RIM_COL, stroke(sw));
  s += line('M28 64Q56 46 100 44', WHITE, 3, op(0.6));
  s += base ? ellipse(INNER.cx, INNER.cy, INNER.rx, INNER.ry, '#6e3a18') + puree(base, sw) : emptyInside(sw);
  s += midItems(mid, sw) + topItems(top, sw);
  // front lip of the rim covers whatever sits on the front edge
  s += path('M8 88A92 48 0 0 0 192 88L181 88A81 40 0 0 1 19 88Z', RIM_COL);
  s += line('M24 108Q40 120 70 129', WHITE, 3, op(0.75));
  s += line('M8 88A92 48 0 0 0 192 88', INK, sw) + line('M19 88A81 40 0 0 0 181 88', INK, sw * 0.8);
  return s;
}

export function bowlSVG(bowl, size = 150) {
  const b = bowl || {};
  return memo(`b|${b.base}|${(b.mid || []).join()}|${(b.top || []).join()}|${size}`, () => {
    const sw = ow(200, size, 3.4, 7.5);
    return svgWrap(size, size, 200, 200, bowlBody(b, sw));
  });
}

// ======================================================================
// Smoothie cup (viewBox 100×100); the cup's bottom sits at y = 96
// ======================================================================
const SMOOTHIE_COLORS = { banana: '#fff0a0', strawberry: '#ff7f93', blueberry: '#8f72db', mango: '#ffbf47', kiwi: '#a8d65a' };
const smoothieColor = (id) => SMOOTHIE_COLORS[id] || (ING[id] ? lighten(ING[id].color, 0.2) : '#ff86b8');

function garnish(id, x, y, sw) {
  const ing = ING[id];
  if (!ing) return berryPiece(x, y, 6, ING.blueberry, sw);
  if (ing.style === 'slices') return g(`rotate(-20 ${x} ${y})`, slicePiece(x, y, 11.5, ing, sw));
  if (ing.style === 'halves') return halfPiece(x, y, 11.5, ing, sw, rngFor('garnish'));
  if (ing.style === 'cubes') return cubePiece(x - 3, y + 2, 7.5, -15, ing, sw) + cubePiece(x + 8, y - 3, 6.5, 12, ing, sw);
  if (ing.style === 'berries') return berryPiece(x - 5, y + 2, 7, ing, sw) + berryPiece(x + 7, y - 1, 7, ing, sw);
  return g(`translate(${x - 9} ${y - 9}) scale(0.18)`, iconBody(id, sw / 0.18));
}

export function cupSVG(fruitId = null, state = 'ready', size = 70) {
  return memo(`c|${fruitId}|${state}|${size}`, () => drawCup(fruitId, state, size));
}

function drawCup(fruitId, state, size) {
  const sw = ow(100, size, 3.2, 6.5);
  const col = smoothieColor(fruitId);
  const yTop = 38;
  const yBot = 96;
  const wl = (y) => 18 + ((y - yTop) * 8) / (yBot - yTop);
  const wr = (y) => 82 - ((y - yTop) * 8) / (yBot - yTop);
  const cup = `M18 ${yTop}H82L74.5 ${yBot - 3}Q74 ${yBot} 70 ${yBot}H30Q26 ${yBot} 25.5 ${yBot - 3}Z`;
  let s = ellipse(50, 97, 28, 3, INK, op(0.18));
  if (state === 'mixing') s += tube('M50 0V66', col, 7, sw * 0.8);
  s += path(cup, '#e6f7fd', op(0.75));
  if (state !== 'empty') {
    const lvl = state === 'mixing' ? 66 : yTop + 1;
    const xl = wl(lvl) + 2.5;
    const xr = wr(lvl) - 2.5;
    const b = yBot - 2.5;
    s += path(`M${f(xl)} ${lvl}H${f(xr)}L${f(wr(b) - 2.5)} ${f(b)}H${f(wl(b) + 2.5)}Z`, col);
    s += path(`M${f(xr)} ${lvl}L${f(wr(b) - 2.5)} ${f(b)}H${f(wr(b) - 10)}L${f(xr - 8)} ${lvl}Z`, darken(col, 0.15), op(0.8));
    s += ellipse(50, lvl, (xr - xl) / 2, 3.5, lighten(col, 0.3));
    if (state === 'mixing') {
      s += line('M36 78Q50 72 64 80M38 88Q50 84 62 89', lighten(col, 0.45), 2.5, op(0.9));
      s += circle(44, 75, 2, WHITE, op(0.8)) + circle(58, 85, 1.5, WHITE, op(0.8));
    }
  }
  s += line('M25 44L30 90', WHITE, 4.5, op(0.8)) + line('M33 46L34 56', WHITE, 2.5, op(0.6));
  s += circle(50, 72, 10, CREAM, stroke(sw * 0.6)) + g('translate(50 72) scale(1.25) translate(-50 -72)', path('M50 77C44 73 45 68 47.5 68C49 68 50 70 50 70C50 70 51 68 52.5 68C55 68 56 73 50 77Z', PINK));
  s += path(cup, 'none', stroke(sw));
  s += ellipse(50, yTop, 32, 5, 'none', stroke(sw));
  if (state === 'ready') {
    s += path('M22 38C24 24 76 24 78 38Z', lighten(col, 0.3)) + line('M34 33Q44 27 56 29', WHITE, 2.4, op(0.7));
    s += tube('M60 34L73 2', PINK, 6.5, sw * 0.8) + line('M60 34L73 2', WHITE, 6.5, ' stroke-dasharray="4 5"');
    s += path('M17 38C17 11 83 11 83 38Z', '#e6f7fd', op(0.45)) + line('M26 29Q31 19 42 16', WHITE, 3, op(0.85));
    s += path('M17 38C17 11 83 11 83 38', 'none', stroke(sw));
    s += garnish(fruitId, 29, 24, sw * 0.8);
  }
  return svgWrap(size, size, 100, 100, s);
}

// ======================================================================
// Customers (viewBox 160×160): head + shoulders, the counter hides the rest
// ======================================================================
const SKINS = ['#ffe3cc', '#f8cfa8', '#eab38a', '#d39668', '#b27449', '#8d5634', '#64391f', '#f2c2a0'];
const HAIR_NATURAL = ['#2b1a12', '#4a2b18', '#6e4123', '#a8652f', '#d9a24a', '#f0cf7a', '#b5432f', '#d8d3cd', '#1c1418'];
const HAIR_FUN = ['#8a4fd6', '#ff5fa2', '#2a9fd8', '#2fbf71'];
const HAIR_STYLES = ['short', 'spiky', 'curly', 'afro', 'long', 'bob', 'bun', 'ponytail', 'braids', 'bald'];
const SHIRTS = ['#ff3d8b', '#18c2c9', '#ffb627', '#2fbf71', '#7b3a96', '#ff7a59', '#4656c9', '#fff4df', '#f7e14f', '#ff9ec7', '#3fb6ff'];
const PATTERNS = ['plain', 'plain', 'stripes', 'dots', 'hawaii', 'collar'];
const ACCESSORIES = ['none', 'none', 'glasses', 'sunglasses', 'cap', 'earrings', 'headband', 'beard'];
const ACCENTS = ['#ff3d8b', '#18c2c9', '#ffb627', '#2fbf71', '#7b3a96', '#ff4d4d', '#ffffff', '#4656c9'];

export const LOOK_OPTIONS = { skins: SKINS, hairStyles: HAIR_STYLES, accessories: ACCESSORIES, patterns: PATTERNS };

export function randomLook(rng) {
  const fallback = createRng(1);
  const next = typeof rng === 'function' ? rng : rng && rng.next ? () => rng.next() : fallback.next;
  const pick = (arr) => arr[Math.min(arr.length - 1, Math.floor(next() * arr.length))];
  let hairStyle = pick(HAIR_STYLES);
  let accessory = pick(ACCESSORIES);
  if (accessory === 'cap' && ['afro', 'bun', 'curly', 'spiky'].includes(hairStyle)) hairStyle = pick(['short', 'long', 'ponytail', 'bald', 'bob']);
  if (accessory === 'headband' && hairStyle === 'bald') accessory = 'earrings';
  const hair = next() < 0.16 ? pick(HAIR_FUN) : pick(HAIR_NATURAL);
  const shirt = pick(SHIRTS);
  let shirt2 = pick(ACCENTS);
  if (shirt2 === shirt || (shirt2 === WHITE && shirt === '#fff4df')) shirt2 = shirt === PINK ? WHITE : PINK;
  let accent = pick(ACCENTS);
  if (accent === WHITE && accessory !== 'headband') accent = INK;
  return { skin: pick(SKINS), hair, hairStyle, shirt, shirt2, pattern: pick(PATTERNS), accessory, accent };
}

export function lookFromSeed(seed) {
  const n = typeof seed === 'number' ? seed : hashStr(String(seed));
  return randomLook(createRng((n >>> 0) * 2654435761 + 7));
}

function normLook(look) {
  if (look === null || look === undefined || typeof look !== 'object') return lookFromSeed(look ?? 1);
  const d = lookFromSeed(hashStr(JSON.stringify(look)));
  return { ...d, ...look };
}

const HX = 80;
const HY = 66;
const HR = 34;

function hairBack(L, sw) {
  const hc = L.hair;
  switch (L.hairStyle) {
    case 'afro': {
      const list = [[HX, 54, 42]];
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        list.push([HX + Math.cos(a) * 40, 54 + Math.sin(a) * 36, 12]);
      }
      return puffs(list, hc, sw, darken(hc, 0.2));
    }
    case 'curly':
      return puffs([[50, 62, 14], [110, 62, 14], [56, 42, 16], [104, 42, 16], [80, 34, 18], [46, 80, 10], [114, 80, 10]], hc, sw, darken(hc, 0.2));
    case 'bob':
      return shape('M44 62C36 86 40 100 46 106Q80 114 114 106C120 100 124 86 116 62Z', hc, sw, path('M116 62C124 86 120 100 114 106Q104 109 96 110C110 96 112 80 110 64Z', darken(hc, 0.2)));
    case 'long':
      return shape('M46 58C38 88 42 116 40 126Q80 134 120 126C118 116 122 88 114 58Z', darken(hc, 0.15), sw);
    case 'ponytail':
      return shape('M106 40C132 38 140 72 130 102C126 112 115 110 117 99C125 76 117 57 104 54Z', hc, sw, path('M130 102C126 112 115 110 117 99C124 92 128 84 130 74C134 84 133 94 130 102Z', darken(hc, 0.2))) +
        circle(110, 47, 6, L.accent === INK ? PINK : L.accent, stroke(sw));
    case 'bun':
      return ball(HX, 27, 14, hc, darken(hc, 0.2), sw, 0.35);
    default:
      return '';
  }
}

function braid(x0, y0, x1, y1, hc, accent, sw) {
  let s = '';
  const n = 6;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const x = x0 + (x1 - x0) * k;
    const y = y0 + (y1 - y0) * k;
    s += ellipse(x, y, 6.5 - k * 1.2, 6.8, hc, stroke(sw * 0.85)) + line(`M${f(x - 3)} ${f(y - 2)}Q${f(x)} ${f(y + 1)} ${f(x + 3)} ${f(y - 2)}`, darken(hc, 0.3), 1.4);
  }
  return s + rect(x1 - 4.5, y1 + 5, 9, 4.5, 2, accent === INK ? PINK : accent, stroke(sw * 0.7)) + path(`M${f(x1 - 4)} ${f(y1 + 9)}L${f(x1)} ${f(y1 + 18)}L${f(x1 + 4)} ${f(y1 + 9)}Z`, hc, stroke(sw * 0.7));
}

// Hair that falls in front of the shoulders.
function hairSide(L, sw) {
  const hc = L.hair;
  if (L.hairStyle === 'long') {
    return shape('M47 60C40 92 44 118 36 138Q48 144 60 134C54 116 54 94 56 76Z', hc, sw, path('M47 60C42 90 46 118 40 136Q46 138 50 136C46 116 46 90 50 64Z', lighten(hc, 0.15), op(0.6))) +
      shape('M113 60C120 92 116 118 124 138Q112 144 100 134C106 116 106 94 104 76Z', hc, sw, path('M113 60C118 92 114 118 120 136Q116 138 112 137C114 116 112 90 108 68Z', darken(hc, 0.2)));
  }
  if (L.hairStyle === 'braids') return braid(49, 86, 45, 128, hc, L.accent, sw) + braid(111, 86, 115, 128, hc, L.accent, sw);
  return '';
}

function hairFront(L, sw) {
  const hc = L.hair;
  const hi = line('M60 37Q70 31 84 31', lighten(hc, 0.4), 3, op(0.7));
  switch (L.hairStyle) {
    case 'short':
      return shape('M46 70C42 40 58 26 80 26C102 26 118 40 114 70C110 60 106 54 101 50C90 57 70 57 58 48C53 55 49 62 46 70Z', hc, sw, path('M114 70C110 60 106 54 101 50C108 46 112 40 110 34C116 42 117 56 114 70Z', darken(hc, 0.2)) + hi);
    case 'spiky':
      return shape('M46 70C44 54 45 44 50 38L52 22L62 32L70 17L79 30L89 16L95 31L106 22L107 39C113 46 116 56 114 70C110 60 106 54 101 50C90 57 70 57 58 48C53 55 49 62 46 70Z', hc, sw, path('M114 70C110 60 106 54 101 50C106 46 108 42 107 39C113 46 116 56 114 70Z', darken(hc, 0.2)) + hi);
    case 'long':
    case 'bob':
      return shape('M44 76C40 40 60 26 80 26C100 26 120 40 116 76C112 60 104 50 94 44C90 50 84 52 80 44C76 52 70 50 64 44C56 50 48 60 44 76Z', hc, sw, path('M116 76C112 60 104 50 94 44C100 40 106 36 108 32C118 42 120 60 116 76Z', darken(hc, 0.2)) + hi);
    case 'bun':
    case 'ponytail':
    case 'braids':
      return shape('M46 66C44 40 62 28 80 28C98 28 116 40 114 66C108 52 96 44 80 44C64 44 52 52 46 66Z', hc, sw,
        path('M114 66C108 52 96 44 82 44C96 40 106 36 108 34C114 42 116 54 114 66Z', darken(hc, 0.2)) +
        (L.hairStyle === 'braids' ? line('M80 29V44', darken(hc, 0.35), 2) : line('M64 34Q74 38 84 34M92 32Q100 36 104 42', darken(hc, 0.3), 1.6)) + hi);
    case 'curly':
    case 'afro': {
      const list = [[HX, 40, 18]];
      const n = L.hairStyle === 'afro' ? 9 : 8;
      for (let i = 0; i < n; i++) {
        const a = Math.PI * (1.08 + (0.84 * i) / (n - 1));
        list.push([HX + Math.cos(a) * 32, 64 + Math.sin(a) * 30, L.hairStyle === 'afro' ? 8 : 9.5]);
      }
      return puffs(list, hc, sw * 0.9, darken(hc, 0.18)) + line('M62 36Q70 30 80 30', lighten(hc, 0.4), 3, op(0.6));
    }
    case 'bald':
      return gloss(66, 42, 10, 5.5, -25, 0.55) + path('M47 70C46 62 47 58 50 55Q51 62 50 72Z', hc, stroke(sw * 0.7)) + path('M113 70C114 62 113 58 110 55Q109 62 110 72Z', hc, stroke(sw * 0.7));
    default:
      return '';
  }
}

function eyes(mood, skinFace) {
  const lx = 67;
  const rx = 93;
  const y = 71;
  if (mood === 'happy') {
    return line(`M${lx - 6} ${y + 1}Q${lx} ${y - 8} ${lx + 6} ${y + 1}M${rx - 6} ${y + 1}Q${rx} ${y - 8} ${rx + 6} ${y + 1}`, INK, 3.6);
  }
  const dx = mood === 'impatient' ? 1.8 : 0;
  let s = '';
  for (const x of [lx, rx]) s += ellipse(x + dx, y, 4.6, 5.8, INK) + circle(x + dx - 1.5, y - 2.2, 1.7, WHITE);
  if (mood === 'impatient') {
    for (const x of [lx, rx]) s += path(`M${x - 7} ${y - 8}H${x + 7}V${y - 0.5}H${x - 7}Z`, skinFace) + line(`M${x - 6} ${y - 0.5}H${x + 6}`, INK, 2.6);
  } else if (mood === 'angry') {
    s += path(`M${lx - 7} ${y - 9}H${lx + 7}V${y - 1}L${lx - 7} ${y - 6}Z`, skinFace) + line(`M${lx - 6} ${y - 5.6}L${lx + 6} ${y - 1.3}`, INK, 2.6);
    s += path(`M${rx - 7} ${y - 9}H${rx + 7}V${y - 6}L${rx - 7} ${y - 1}Z`, skinFace) + line(`M${rx - 6} ${y - 1.3}L${rx + 6} ${y - 5.6}`, INK, 2.6);
  }
  return s;
}

function brows(mood, color) {
  const d = {
    happy: 'M60 60Q66 53 73 58M87 58Q94 53 100 60',
    neutral: 'M60 59.5Q66 56.5 73 58.5M87 58.5Q94 56.5 100 59.5',
    impatient: 'M60 61L73 60M87 56Q94 52 100 56.5',
    angry: 'M59 55L74 62M86 62L101 55',
  }[mood] || 'M60 59.5Q66 56.5 73 58.5M87 58.5Q94 56.5 100 59.5';
  return line(d, color, mood === 'angry' ? 4.2 : 3.6);
}

function mouth(mood, sw) {
  switch (mood) {
    case 'happy':
      return shape('M68 85Q80 101 92 85Q80 89 68 85Z', '#8a1f3c', sw * 0.8, ellipse(80, 91.5, 4.5, 2, '#ff6f91'));
    case 'impatient':
      return line('M71 89Q75.5 86.5 80 89Q84.5 91.5 89 89', INK, 3);
    case 'angry':
      return rect(69, 85, 22, 9.5, 4.5, WHITE, stroke(sw * 0.8)) + line('M70 89.75H90M76 85.5V94M84 85.5V94', INK, 1.6);
    default:
      return line('M72 87Q80 92.5 88 87', INK, 3);
  }
}

function shirtPattern(L) {
  const c = L.shirt2;
  let s = '';
  if (L.pattern === 'stripes') {
    for (let y = 117; y < 162; y += 11) s += rect(0, y, 160, 5, 0, c, op(0.9));
  } else if (L.pattern === 'dots') {
    for (let y = 119, r = 0; y < 164; y += 12, r++) for (let x = 14 + (r % 2) * 7; x < 150; x += 14) s += circle(x, y, 3, c);
  } else if (L.pattern === 'hawaii') {
    for (const [x, y] of [[32, 140], [58, 128], [104, 129], [128, 146], [80, 152], [44, 158], [118, 162]]) {
      s += leaf(x, y, 10, 5, 30, LEAF, 0.8, false);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        s += circle(x + Math.cos(a) * 3.4, y + Math.sin(a) * 3.4, 2.8, c);
      }
      s += circle(x, y, 1.8, MANGO);
    }
  }
  return s;
}

function torso(L, sw, skinNeck) {
  const d = 'M14 162C14 126 36 108 80 108C124 108 146 126 146 162Z';
  const id = uid('torso');
  const pat = L.pattern && L.pattern !== 'plain' && L.pattern !== 'collar'
    ? `<defs><clipPath id="${id}"><path d="${d}"/></clipPath></defs><g clip-path="url(#${id})">${shirtPattern(L)}</g>` : '';
  let s = shape(d, L.shirt, sw, pat + path('M146 162C146 126 124 108 96 108C120 118 130 138 128 162Z', darken(L.shirt, 0.2), op(0.8)) + line('M30 138C34 125 44 117 58 113', WHITE, 4, op(0.35)));
  s += shape('M65 108Q80 126 95 108Z', skinNeck, sw);
  if (L.pattern === 'collar') {
    s += shape('M65 107L80 119L70 128Z', WHITE, sw * 0.8) + shape('M95 107L80 119L90 128Z', WHITE, sw * 0.8);
    s += circle(80, 131, 2.2, WHITE, stroke(sw * 0.6)) + circle(80, 143, 2.2, WHITE, stroke(sw * 0.6));
  }
  return s;
}

function accessory(L, sw) {
  const a = L.accent;
  switch (L.accessory) {
    case 'glasses':
      return line('M76 70Q80 67 84 70M58 69L47 66M102 69L113 66', INK, 2.6) +
        circle(67, 71, 9.5, WHITE, op(0.25)) + circle(93, 71, 9.5, WHITE, op(0.25)) +
        circle(67, 71, 9.5, 'none', stroke(4.4)) + circle(93, 71, 9.5, 'none', stroke(4.4)) +
        circle(67, 71, 9.5, 'none', stroke(2, a)) + circle(93, 71, 9.5, 'none', stroke(2, a));
    case 'sunglasses':
      return line('M76 69Q80 66 84 69M56 68L47 66M104 68L113 66', INK, 2.8) +
        path(rrect(55, 63, 23, 15, 6), INK) + path(rrect(82, 63, 23, 15, 6), INK) +
        line('M59 74L66 66M86 74L93 66', WHITE, 2.2, op(0.55)) + line('M55 66H78M82 66H105', a === INK ? PINK : a, 2.4);
    case 'cap': {
      const c = a === INK ? PINK : a;
      return shape('M46 52C44 22 116 22 114 52Q80 44 46 52Z', c, sw, path('M114 52C116 30 100 22 88 24C104 30 108 40 108 50Z', darken(c, 0.2)) + line('M80 25V48', darken(c, 0.25), 1.8) + gloss(62, 36, 8, 4, -30, 0.45)) +
        shape('M44 51Q80 41 116 51Q121 56 113 58Q80 50 47 58Q39 56 44 51Z', darken(c, 0.12), sw) + circle(80, 24.5, 3, darken(c, 0.25), stroke(sw * 0.6));
    }
    case 'earrings':
      return circle(46, 82, 4, 'none', stroke(4.6)) + circle(46, 82, 4, 'none', stroke(2.2, '#ffcf3a')) + circle(114, 82, 4, 'none', stroke(4.6)) + circle(114, 82, 4, 'none', stroke(2.2, '#ffcf3a'));
    case 'headband': {
      const c = a === INK ? PINK : a;
      const petals = [];
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2 - Math.PI / 2;
        petals.push([104 + Math.cos(ang) * 4.6, 40 + Math.sin(ang) * 4.6, 3.8]);
      }
      return tube('M47 55C54 33 106 33 113 55', c, 6, sw * 0.8) + puffs(petals, c === WHITE ? PINK : WHITE, sw * 0.6) + circle(104, 40, 2.6, MANGO, stroke(sw * 0.5));
    }
    default:
      return '';
  }
}

function moodExtras(mood, sw) {
  if (mood === 'impatient') {
    return g('translate(116 50)', shape('M0 -10C4 -3 7 1 7 5A7 7 0 0 1 -7 5C-7 1 -4 -3 0 -10Z', '#7fd3f5', sw * 0.8, gloss(-2.5, 3, 1.6, 2.6, 15, 0.8)));
  }
  if (mood === 'angry') {
    const steam = (x, y, k) => puffs([[x, y, 7 * k], [x - 7 * k, y + 5 * k, 5 * k], [x + 7 * k, y + 4 * k, 5.5 * k], [x + 2 * k, y - 7 * k, 5 * k]], '#f4eff8', sw * 0.8);
    const vein = line('M-7 -2Q-2 -2 -2 -7M2 -7Q2 -2 7 -2M7 2Q2 2 2 7M-2 7Q-2 2 -7 2', DANGER, 2.6);
    return steam(26, 34, 1) + steam(134, 30, 1.1) + g('translate(102 44)', line('M-7 -2Q-2 -2 -2 -7M2 -7Q2 -2 7 -2M7 2Q2 2 2 7M-2 7Q-2 2 -7 2', WHITE, 5) + vein);
  }
  return '';
}

export function customerSVG(look, mood = 'neutral', size = 160) {
  const L = normLook(look);
  const sw = ow(160, size, 2.6, 6);
  const angry = mood === 'angry';
  const skinFace = angry ? mix(L.skin, '#ff5a5a', 0.35) : L.skin;
  const skinNeck = darken(L.skin, 0.12);
  let s = hairBack(L, sw);
  s += rect(69, 86, 22, 28, 8, skinNeck, stroke(sw));
  s += torso(L, sw, skinNeck);
  s += hairSide(L, sw);
  for (const x of [46, 114]) s += circle(x, 71, 7.5, skinFace, stroke(sw)) + circle(x + (x < 80 ? 1 : -1), 72, 3.4, darken(skinFace, 0.15));
  s += circle(HX, HY, HR, skinFace) + crescent(HX, HY, HR, 0.35, 7, darken(skinFace, 0.1)) + circle(HX, HY, HR, 'none', stroke(sw));
  const blush = { happy: 0.55, neutral: 0.35, impatient: 0.18, angry: 0 }[mood] ?? 0.3;
  if (blush) s += ellipse(58, 82, 6.5, 3.8, '#ff6f91', op(blush)) + ellipse(102, 82, 6.5, 3.8, '#ff6f91', op(blush));
  s += eyes(mood, skinFace);
  s += brows(mood, ['bald'].includes(L.hairStyle) || L.hair === '#d8d3cd' ? darken(L.hair, 0.45) : darken(L.hair, 0.3));
  s += ellipse(80, 79, 3.6, 2.6, darken(skinFace, 0.18));
  if (L.accessory === 'beard') {
    s += shape('M47 70C46 96 62 109 80 109C98 109 114 96 113 70C108 84 100 92 92 90C86 85 74 85 68 90C60 92 52 84 47 70Z', L.hair, sw, path('M113 70C114 96 98 109 80 109C96 104 106 92 108 80Z', darken(L.hair, 0.2)));
  }
  s += mouth(mood, sw);
  s += hairFront(L, sw);
  s += accessory(L, sw);
  s += moodExtras(mood, sw);
  return svgWrap(size, size, 160, 160, s);
}

// ======================================================================
// Blender (viewBox 150×150)
// ======================================================================
const JUG_TOP = 36;
const JUG_BOT = 104;
const jugL = (y) => 38 + ((y - JUG_TOP) * 9) / (JUG_BOT - JUG_TOP);
const jugR = (y) => 112 - ((y - JUG_TOP) * 9) / (JUG_BOT - JUG_TOP);
const JUG = `M38 ${JUG_TOP}H112L103 ${JUG_BOT}H47Z`;

function jugFill(yTop, inset = 3) {
  const y2 = JUG_BOT - 2;
  return `M${f(jugL(yTop) + inset)} ${f(yTop)}H${f(jugR(yTop) - inset)}L${f(jugR(y2) - inset)} ${y2}H${f(jugL(y2) + inset)}Z`;
}

function badge(cx, cy, fill, inner, sw) {
  return circle(cx, cy + 2, 14, INK, op(0.25)) + circle(cx, cy, 14, fill, stroke(sw)) + inner;
}

// portions/maxPortions: bowls left in a ready jug – the fill level drops with every pour
// (the dots on the motor base repeat the count). Callers without portions get a full jug.
function blenderContents(state, ing, progress, portions, maxPortions) {
  const main = mix(ing.color, ing.color2, 0.35);
  const lite = ing.color2;
  const surf = (y, c, dip = 0) => path(`M${f(jugL(y) + 3)} ${y}Q75 ${y + 4 + dip} ${f(jugR(y) - 3)} ${y}Q75 ${y - 4} ${f(jugL(y) + 3)} ${y}Z`, c);
  if (state === 'blending') {
    const y = 54;
    const wob = Math.sin((progress || 0) * Math.PI * 6) * 3;
    return path(jugFill(y), main) + surf(y, lite, 8) +
      line(`M${f(52 + wob)} 70Q75 82 ${f(98 + wob)} 68`, lite, 3.5, op(0.85)) + line(`M${f(56 - wob)} 86Q75 95 ${f(95 - wob)} 84`, lite, 3, op(0.7)) +
      circle(62, 76, 2, WHITE, op(0.7)) + circle(88, 90, 1.6, WHITE, op(0.7));
  }
  if (state === 'ready') {
    // full → 50; 1 of 2 → 66; 2 of 3 → 61, 1 of 3 → 71 (near the jug ticks at 52/66/80). A ready jug always keeps a clear layer.
    const n = Math.max(1, maxPortions || 1);
    const k = Math.max(1, Math.min(n, portions ?? n));
    const y = Math.round(50 + (1 - k / n) * 32);
    return path(jugFill(y), main) + surf(y, lite) + gloss(58, y, 9, 1.8, 0, 0.6) +
      line(`M54 ${y + 12}Q60 ${Math.min(90, y + 28)} 58 94`, lighten(main, 0.25), 3, op(0.5));
  }
  // overflowing keeps the brim-full jug + foam blob: that silhouette is the warning, the dots carry the count
  if (state === 'overflowing') {
    return path(jugFill(38, 2.5), main) + line('M54 52Q60 74 58 94', lighten(main, 0.25), 3, op(0.5));
  }
  if (state === 'ruined') {
    const sl = '#8c806d';
    return path(jugFill(58), sl) + path(`M${f(jugL(58) + 3)} 58Q52 50 62 57Q70 50 78 57Q88 49 96 57Q102 52 ${f(jugR(58) - 3)} 58Z`, '#9d917d') +
      circle(58, 74, 4, '#6f6556') + circle(84, 82, 5, '#6f6556') + circle(70, 92, 3.2, '#6f6556') + circle(92, 68, 2.5, '#6f6556') +
      circle(66, 55, 3, 'none', stroke(1.6, '#5c5346')) + circle(90, 53, 2.2, 'none', stroke(1.6, '#5c5346'));
  }
  return '';
}

function motorBase(state, o, sw) {
  const d = 'M42 109H108Q114 109 115 115L119 139Q120 145 114 145H36Q30 145 31 139L35 115Q36 109 42 109Z';
  let s = shape(d, PINK, sw, path('M108 109Q114 109 115 115L119 139Q120 145 114 145H100Q108 128 102 109Z', darken(PINK, 0.18)) + line('M40 117L37 138', WHITE, 3, op(0.45)));
  s += rect(46, 116, 58, 21, 8, CREAM, stroke(sw * 0.8));
  const ang = { empty: -150, blending: 20, ready: -90, overflowing: -30, ruined: -150 }[state] ?? -150;
  const a = (ang * Math.PI) / 180;
  s += circle(59, 126.5, 7.5, LAGOON, stroke(sw * 0.8)) + line(`M59 126.5L${f(59 + Math.cos(a) * 5)} ${f(126.5 + Math.sin(a) * 5)}`, INK, 2.4);
  const n = Math.max(1, Math.min(4, o.maxPortions || 2));
  const left = state === 'ready' || state === 'overflowing' ? Math.max(0, Math.min(n, o.portions ?? n)) : 0;
  // portion lamps right of the dial; spacing shrinks for 4 so they stay clear of the dial and inside the panel
  const gap = Math.min(11, 30 / Math.max(1, n - 1));
  const r = Math.min(4.4, gap * 0.38);
  for (let i = 0; i < n; i++) {
    s += circle(85 + (i - (n - 1) / 2) * gap, 126.5, r, i < left ? LEAF : '#e3d9ea', stroke(sw * 0.6));
  }
  return s;
}

export function blenderSVG(opts = {}, size = 150) {
  const o = opts || {};
  const state = ['empty', 'blending', 'ready', 'overflowing', 'ruined'].includes(o.state) ? o.state : 'empty';
  // progress is quantised so the cache stays small while the ring still moves smoothly
  const p = state === 'blending' ? Math.round(Math.max(0, Math.min(1, Number(o.progress) || 0)) * 48) / 48 : 0;
  const key = `x|${state}|${o.base}|${p}|${o.portions}|${o.maxPortions}|${o.badge !== false}|${size}`;
  return memo(key, () => drawBlender(state, o, p, size));
}

function drawBlender(state, o, p, size) {
  const ing = ING[o.base] && ING[o.base].layer === 'base' ? ING[o.base] : ING.acai;
  const sw = ow(150, size, 2.8, 6);
  const main = mix(ing.color, ing.color2, 0.35);
  let s = ellipse(75, 146, 50, 4.5, INK, op(0.18));
  if (state === 'blending') s += line('M24 52Q18 64 24 76M16 58Q12 64 16 70M136 106Q142 98 140 88', INK, 3, op(0.55));
  s += tube('M110 48C132 46 134 54 132 66L128 88C126 96 118 98 106 96', LAGOON, 7, sw);
  s += path(JUG, '#e6f7fc', op(0.6));
  s += blenderContents(state, ing, p, o.portions, o.maxPortions);
  s += path(`M60 ${JUG_BOT - 4}L90 ${JUG_BOT - 8}M60 ${JUG_BOT - 8}L90 ${JUG_BOT - 4}`, 'none', stroke(3, '#9aa7b6'));
  s += line('M45 44L52 98', WHITE, 4, op(0.75)) + line('M56 44L57.5 58', WHITE, 2.5, op(0.6));
  for (const y of [52, 66, 80]) s += line(`M${f(jugR(y) - 10)} ${y}H${f(jugR(y) - 4)}`, INK, 1.8, op(0.35));
  s += path(JUG, 'none', stroke(sw));
  s += rect(44, 101, 62, 9, 3, darken(LAGOON, 0.2), stroke(sw));
  const lid = shape(rrect(34, 27, 82, 11, 5), LAGOON, sw, line('M40 31H74', WHITE, 2.5, op(0.5))) + shape(rrect(65, 19, 20, 10, 4), darken(LAGOON, 0.2), sw);
  if (state === 'overflowing') {
    const blob = 'M32 38C22 36 24 20 38 22C40 8 60 6 66 16C74 4 98 6 100 18C116 14 126 28 116 38Z';
    s += shape(blob, main, sw, path('M116 38C126 28 116 14 100 18C108 22 110 30 104 38Z', darken(main, 0.2)) + gloss(48, 22, 8, 3.5, -15, 0.55));
    s += tube('M36 36V62', main, 7, sw) + tube('M112 36L113 52', main, 6, sw) + tube('M70 38V46', main, 5, sw);
    s += ellipse(36, 110, 11, 3.2, main, stroke(sw * 0.8));
    s += g('translate(-20 -3) rotate(-22 75 32)', lid);
  } else {
    s += lid;
  }
  if (state === 'ruined') {
    s += line('M52 18Q46 12 52 6Q58 0 52 -6M98 18Q92 12 98 6Q104 0 98 -6', '#8fa86a', 3, op(0.9));
    s += line('M75 16Q69 10 75 4', '#8fa86a', 3, op(0.9));
    s += circle(28, 40, 2.5, INK) + ellipse(26, 37, 2.6, 1.6, WHITE, stroke(0.8) + op(0.9)) + ellipse(30.5, 37, 2.6, 1.6, WHITE, stroke(0.8) + op(0.9));
  }
  s += motorBase(state, o, sw);
  if (o.badge === false) {
    // decorative use (shop cards): no status badge, so a ✓ never reads as "already bought"
  } else if (state === 'blending') {
    const r = 8.5;
    const len = 2 * Math.PI * r;
    // data-ring: the game view updates this ring's dasharray in place instead of re-rendering the art
    s += badge(127, 22, WHITE, circle(127, 22, r, 'none', stroke(5, '#e3d9ea')) +
      `<circle data-ring="${f(len)}" opacity="${p > 0 ? 1 : 0}" cx="127" cy="22" r="${r}" fill="none" stroke="${LAGOON}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${f(len * p)} ${f(len)}" transform="rotate(-90 127 22)"/>`, sw);
  } else if (state === 'ready') {
    s += badge(127, 22, LEAF, line('M120.5 22.5L125 27L134 17.5', WHITE, 3.8), sw);
  } else if (state === 'overflowing') {
    s += badge(127, 22, DANGER, rect(125, 13, 4, 11.5, 2, WHITE) + circle(127, 29, 2.3, WHITE), sw);
  } else if (state === 'ruined') {
    s += badge(127, 22, '#7d6e8a', rect(121.5, 18, 11, 11, 2, WHITE) + rect(119.5, 15, 15, 3, 1.5, WHITE) + line('M125 20.5V26.5M129 20.5V26.5', '#7d6e8a', 1.4), sw);
  }
  return svgWrap(size, size, 150, 150, s);
}

// ======================================================================
// Smoothie machine (viewBox 200×200, cups drawn separately)
// SMOOTHIE_SLOT_X[slotCount] → x fractions (of the machine width) of each cup centre.
// SMOOTHIE_SLOT_Y → y fraction where the bottom edge of a cup element of
// size SMOOTHIE_CUP_SIZE × machine size should sit.
// ======================================================================
export const SMOOTHIE_SLOT_X = [[0.5], [0.5], [0.3, 0.7]];
export const SMOOTHIE_SLOT_Y = 0.885;
export const SMOOTHIE_CUP_SIZE = 0.36;

export function smoothieMachineSVG(slotCount = 1, size = 200) {
  const n = slotCount >= 2 ? 2 : 1;
  const xs = SMOOTHIE_SLOT_X[n].map((p) => p * 200);
  const sw = ow(200, size, 3, 7);
  let s = ellipse(100, 193, 88, 5, INK, op(0.18));
  s += rect(34, 184, 16, 10, 3, INK) + rect(150, 184, 16, 10, 3, INK);
  s += shape(rrect(16, 30, 168, 158, 20), LAGOON, sw, path('M184 50V168Q184 188 164 188H158Q170 180 170 166V40Q170 34 166 30H164Q184 30 184 50Z', darken(LAGOON, 0.2)) + line('M24 92V170', WHITE, 4, op(0.4)));
  let tiles = '';
  for (let x = 46; x < 172; x += 18) tiles += line(`M${x} 84V172`, lighten(LAGOON, 0.25), 1.2, op(0.35));
  for (let y = 100; y < 172; y += 18) tiles += line(`M30 ${y}H170`, lighten(LAGOON, 0.25), 1.2, op(0.35));
  s += shape(rrect(28, 80, 144, 96, 14), darken(LAGOON, 0.45), sw * 0.8, tiles + path('M28 94Q28 80 42 80H158Q172 80 172 94V100H28Z', INK, op(0.25)));
  s += shape(rrect(8, 8, 184, 74, 22), PINK, sw, path('M8 62V60Q8 82 30 82H170Q192 82 192 60V62Q192 72 182 74H18Q8 72 8 62Z', darken(PINK, 0.2)) + line('M28 18H110', WHITE, 3, op(0.45)));
  // emblem: a little smoothie cup in a cream medallion
  s += circle(100, 42, 22, CREAM, stroke(sw * 0.8));
  s += tube('M103 32L110 20', LAGOON, 3, sw * 0.5) + path('M89 32H111L107 56H93Z', MANGO, stroke(sw * 0.6)) + path('M89 32H111L110.2 38H89.8Z', PINK, stroke(sw * 0.6));
  s += circle(38, 42, 6, MANGO, stroke(sw * 0.7)) + circle(162, 42, 6, LEAF, stroke(sw * 0.7)) + gloss(36, 40, 2, 1.2, -30, 0.8) + gloss(160, 40, 2, 1.2, -30, 0.8);
  for (const x of xs) {
    s += path(`M${x - 11} 80H${x + 11}L${x + 6} 94H${x - 6}Z`, '#d6dde6', stroke(sw * 0.8)) + rect(x - 3, 93, 6, 4, 1.5, '#9aa7b6', stroke(sw * 0.5));
    s += circle(x, 70, 3.2, WHITE, stroke(sw * 0.5));
  }
  let grate = '';
  for (let x = 30; x < 172; x += 10) grate += line(`M${x} 178V184`, '#8d9aab', 2);
  s += shape(rrect(20, 174, 160, 14, 5), '#cfd8e3', sw, grate + line('M26 177H174', WHITE, 1.6, op(0.7)));
  return svgWrap(size, size, 200, 200, s);
}

// ======================================================================
// Small UI icons (viewBox 100×100)
// ======================================================================
export function trashSVG(size = 64) {
  const sw = ow(100, size, 3.2, 7);
  const M = '#9fb3c8';
  const MD = '#7389a3';
  let s = ellipse(50, 95, 30, 4, INK, op(0.18));
  s += tube('M40 23V18Q40 13 45 13H55Q60 13 60 18V23', '#c4d3e2', 4.5, sw);
  s += shape('M23 34H77L71 88Q70 93 65 93H35Q30 93 29 88Z', M, sw,
    path('M77 34L71 88Q70 93 65 93H61L67 34Z', MD) + line('M39 44L41 84M50 44V84M61 44L59 84', MD, 3.4) + line('M30 42L34 84', WHITE, 3.5, op(0.5)));
  s += shape(rrect(16, 22, 68, 13, 6), '#c4d3e2', sw, line('M22 26.5H64', WHITE, 2.5, op(0.7)));
  return svgWrap(size, size, 100, 100, s);
}

export function coinSVG(size = 40) {
  const sw = ow(100, size, 3.4, 8);
  const G = '#ffcf3a';
  const GD = '#e3920c';
  let s = circle(50, 55, 40, GD, stroke(sw));
  s += circle(50, 48, 40, G) + crescent(50, 48, 40, SHADE_DIR, 8, '#ffb81c') + circle(50, 48, 40, 'none', stroke(sw));
  s += circle(50, 48, 28, 'none', stroke(4, GD) + op(0.7));
  s += path('M33 48H67Q66 68 50 68Q34 68 33 48Z', '#ffe27a', stroke(3.4, GD)) + path('M36 48Q50 34 64 48Z', '#ffe27a', stroke(3.4, GD));
  s += sparkle(30, 30, 9) + gloss(68, 70, 4, 2, -35, 0.4);
  return svgWrap(size, size, 100, 100, s);
}

const HEART = 'M50 88C20 68 8 50 12 33C16 18 36 12 50 28C64 12 84 18 88 33C92 50 80 68 50 88Z';

export function heartSVG(filled = true, size = 40) {
  const sw = ow(100, size, 3.4, 8);
  const inner = filled
    ? path('M50 88C80 68 92 50 88 33C87 28 84 24 80 22C86 44 72 66 50 80Z', '#d92e57') + gloss(29, 33, 9, 6, -35, 0.75) + circle(42, 26, 2.6, WHITE, op(0.8))
    : path('M50 88C80 68 92 50 88 33C87 28 84 24 80 22C86 44 72 66 50 80Z', '#bfb0c9');
  return svgWrap(size, size, 100, 100, shape(HEART, filled ? '#ff4d6d' : '#ddd3e4', sw, inner));
}

export function starSVG(filled = true, size = 40) {
  const sw = ow(100, size, 3.4, 8);
  const pts = starPoints(50, 54, 46, 21);
  const d = polyPath(pts);
  const shade = polyPath([[50, 54], pts[2], pts[3], pts[4], pts[5], pts[6]]);
  const inner = filled
    ? path(shade, '#ffa91f') + gloss(38, 38, 7, 4.5, -35, 0.75)
    : path(shade, '#c3b5cc');
  return svgWrap(size, size, 100, 100, path(d, filled ? '#ffd23f' : '#ddd3e4') + inner + path(d, 'none', stroke(sw * 1.1)));
}

export function clockSVG(size = 40) {
  const sw = ow(100, size, 3.4, 8);
  let s = shape(rrect(42, 5, 16, 9, 3), PINK, sw) + rect(46, 12, 8, 9, 0, '#c4d3e2', stroke(sw * 0.8));
  s += g('rotate(42 50 57)', shape(rrect(45, 12, 10, 9, 3), PINK, sw * 0.9));
  s += circle(50, 57, 38, MANGO) + crescent(50, 57, 38, SHADE_DIR, 8, '#f09a12') + circle(50, 57, 38, 'none', stroke(sw));
  s += circle(50, 57, 28.5, CREAM, stroke(sw * 0.8));
  s += line('M50 32V37M75 57H70M50 82V77M25 57H30', INK, 3.2);
  s += line('M50 57V38', INK, 4.4) + line('M50 57L63 64', PINK, 4.4) + circle(50, 57, 4, INK);
  s += gloss(36, 44, 6, 3.5, -35, 0.7);
  return svgWrap(size, size, 100, 100, s);
}

export function lockSVG(size = 40) {
  const sw = ow(100, size, 3.4, 8);
  let s = tube('M32 50V36C32 14 68 14 68 36V50', '#c9c2d6', 8, sw) + line('M35 36C36 24 44 20 50 20', WHITE, 2.5, op(0.6));
  s += shape(rrect(20, 44, 60, 48, 12), MANGO, sw, path('M80 56V80Q80 92 68 92H62Q72 88 72 78V44H68Q80 44 80 56Z', '#f09a12') + line('M27 52V82', WHITE, 4, op(0.5)));
  s += circle(50, 63, 7, INK) + path('M46 64L43 81H57L54 64Z', INK);
  return svgWrap(size, size, 100, 100, s);
}

// ======================================================================
// Decor (viewBox 120×120)
// ======================================================================
function monsteraPath(len, wid) {
  const L = len;
  const W = wid;
  return polyPath([
    [0, 0], [L * 0.06, -W * 0.42], [L * 0.24, -W * 0.52], [L * 0.3, -W * 0.18], [L * 0.38, -W * 0.5], [L * 0.56, -W * 0.44],
    [L * 0.6, -W * 0.14], [L * 0.68, -W * 0.36], [L * 0.86, -W * 0.22], [L, 0], [L * 0.86, W * 0.24], [L * 0.7, W * 0.38],
    [L * 0.64, W * 0.13], [L * 0.56, W * 0.46], [L * 0.38, W * 0.52], [L * 0.32, W * 0.17], [L * 0.24, W * 0.52], [L * 0.06, W * 0.44],
  ]);
}

function monstera(x, y, len, wid, deg, fill, sw) {
  const d = monsteraPath(len, wid);
  return g(`translate(${f(x)} ${f(y)}) rotate(${f(deg)})`, shape(d, fill, sw,
    path(`M0 0L${f(len * 0.86)} ${f(wid * 0.24)}L${f(len)} 0Z`, darken(fill, 0.2), op(0.8)) +
    line(`M${f(len * 0.04)} 0L${f(len * 0.9)} 0`, lighten(fill, 0.3), Math.max(1, sw * 0.6))));
}

const DECOR = {
  plants(sw) {
    const pot = '#ff7a59';
    let s = ellipse(60, 115, 30, 4, INK, op(0.18));
    s += tube('M60 84Q50 70 36 58', '#1d8a3e', 3, sw) + tube('M60 84Q60 60 60 40', '#1d8a3e', 3, sw) + tube('M60 84Q72 70 86 56', '#1d8a3e', 3, sw) + tube('M60 84Q50 80 30 78', '#1d8a3e', 3, sw);
    s += monstera(38, 60, 36, 32, -150, '#2fbf5a', sw) + monstera(86, 58, 34, 30, -28, '#28a84f', sw);
    s += monstera(60, 42, 38, 34, -92, '#34c763', sw) + monstera(32, 78, 26, 22, 175, '#23994a', sw);
    s += shape('M38 84H82L77 114H43Z', pot, sw, path('M82 84L77 114H69L73 84Z', darken(pot, 0.2)) + line('M42 98L48 92L54 98L60 92L66 98L72 92L78 98', CREAM, 2.5) + line('M44 90L47 110', WHITE, 3, op(0.4)));
    s += shape(rrect(34, 79, 52, 10, 4), lighten(pot, 0.15), sw);
    return s;
  },

  jukebox(sw) {
    let s = ellipse(60, 116, 42, 4, INK, op(0.18));
    s += shape('M24 112V54A36 36 0 0 1 96 54V112Z', PINK, sw, path('M96 54V112H86V56A26 26 0 0 0 70 30A36 36 0 0 1 96 54Z', darken(PINK, 0.2)) + line('M30 100V56', WHITE, 3, op(0.4)));
    s += tube('M33 108V56A27 27 0 0 1 87 56V108', MANGO, 5, sw * 0.8);
    s += tube('M41 108V58A19 19 0 0 1 79 58V108', LAGOON, 4, sw * 0.8);
    for (const [x, y] of [[33, 80], [33, 96], [87, 80], [87, 96], [41.5, 40], [78.5, 40], [60, 29]]) s += circle(x, y, 1.8, WHITE);
    s += shape('M47 76V61A13 13 0 0 1 73 61V76Z', '#3b1556', sw * 0.8, ellipse(60, 69, 10, 3.6, INK, stroke(1, '#8a5bb0')) + circle(60, 69, 2.2, PINK) + line('M51 62Q54 56 60 55', WHITE, 1.8, op(0.6)));
    let grille = '';
    for (let y = 87; y < 104; y += 4) grille += line(`M48 ${y}H72`, '#8a5bb0', 1.6);
    s += shape(rrect(45, 82, 30, 24, 5), '#3b1556', sw * 0.8, grille);
    s += circle(49, 79, 1.8, MANGO) + circle(55, 79, 1.8, LEAF) + circle(65, 79, 1.8, LAGOON) + circle(71, 79, 1.8, WHITE);
    s += shape(rrect(19, 108, 82, 9, 3), darken(PINK, 0.28), sw);
    const note = (x, y, c) => line(`M${x + 4.5} ${y}V${y - 14}Q${x + 10} ${y - 12} ${x + 11} ${y - 7}`, INK, 2.2) + ellipse(x, y, 5.2, 4, c, stroke(sw * 0.7) + tf(`rotate(-20 ${x} ${y})`));
    s += note(10, 36, LAGOON) + note(102, 24, MANGO) + note(108, 50, LEAF);
    return s;
  },

  seating(sw) {
    let s = ellipse(60, 114, 56, 5, INK, op(0.18));
    // slouchy pink bean bag
    s += shape('M8 106C2 86 12 58 34 50C48 45 62 52 68 66C76 82 76 98 70 106C56 115 22 116 8 106Z', PINK, sw,
      path('M70 106C56 115 22 116 8 106C30 108 56 104 62 90C68 78 66 64 60 56C72 66 76 90 70 106Z', darken(PINK, 0.2)) +
      line('M20 80Q38 94 60 80', darken(PINK, 0.3), 2.4) + line('M38 52Q42 70 38 84', darken(PINK, 0.15), 1.6, ' stroke-dasharray="3 3"') +
      line('M16 74Q20 60 32 55', WHITE, 3.5, op(0.5)));
    // tufted lagoon pouf
    s += shape('M74 84V104Q94 116 114 104V84Z', LAGOON, sw, path('M114 84V104Q106 109 98 111V86Z', darken(LAGOON, 0.2)) + rect(74, 92, 40, 5, 0, CREAM, op(0.9)) + line('M78 88V102', WHITE, 3, op(0.45)));
    s += ellipse(94, 84, 20, 7, lighten(LAGOON, 0.3), stroke(sw)) + circle(94, 84, 1.8, darken(LAGOON, 0.35)) + circle(85, 83, 1.4, darken(LAGOON, 0.25)) + circle(103, 83, 1.4, darken(LAGOON, 0.25));
    // little wooden stool with a smoothie
    s += line('M50 96L46 116M60 98V117M70 96L74 116', WOOD_D, 3.4);
    s += ellipse(60, 95, 17, 5.5, WOOD, stroke(sw)) + line('M48 94Q56 91 64 92', WHITE, 2, op(0.5));
    s += path('M53 76H67L65 93H55Z', '#ffbf47', stroke(sw * 0.8)) + path('M52 76C52 69 68 69 68 76Z', '#e6f7fd', stroke(sw * 0.8)) + line('M63 72L68 62', PINK, 2.4);
    return s;
  },

  neon(sw) {
    const word = esc(t('art.neon'));
    const txt = (a) => `<text x="60" y="73" text-anchor="middle" font-family="${FONT}" font-size="34" textLength="76" lengthAdjust="spacingAndGlyphs"${a}>${word}</text>`;
    let s = line('M24 32L60 10L96 32', INK, 1.6) + circle(60, 10, 2.6, '#9aa7b6', stroke(1));
    s += rect(8, 30, 104, 62, 12, '#3b1556', stroke(sw));
    s += rect(14, 36, 92, 50, 8, 'none', stroke(1.4, '#6c2a8f'));
    for (const [x, y] of [[16, 38], [104, 38], [16, 84], [104, 84]]) s += circle(x, y, 2, '#9aa7b6');
    s += txt(` fill="none" stroke="${PINK}" stroke-width="9" stroke-linejoin="round" opacity="0.25"`);
    s += txt(` fill="none" stroke="#ff5fa2" stroke-width="4" stroke-linejoin="round"`);
    s += txt(` fill="none" stroke="#ffe3f1" stroke-width="1.4" stroke-linejoin="round"`);
    s += line('M28 82Q60 90 92 80', LAGOON, 7, op(0.25)) + line('M28 82Q60 90 92 80', '#5ee6ea', 2.6) + line('M28 82Q60 90 92 80', '#e6feff', 0.9);
    return s;
  },
};

export function decorSVG(id, size = 120) {
  const sw = ow(120, size, 2.6, 6);
  const draw = DECOR[id];
  return svgWrap(size, size, 120, 120, draw ? draw(sw) : '');
}

// ======================================================================
// Shop back wall (1280×330 stage px; lower 60 % kept calm)
// ======================================================================
function palmTree(x, y, h, lean, sw, frondLen = 90) {
  const tx = x + lean;
  const ty = y - h;
  const cx = x + lean * 0.15;
  const cy = y - h * 0.5;
  let rings = '';
  for (let i = 1; i < 9; i++) {
    const k = i / 9;
    const px = (1 - k) * (1 - k) * x + 2 * k * (1 - k) * cx + k * k * tx;
    const py = (1 - k) * (1 - k) * y + 2 * k * (1 - k) * cy + k * k * ty;
    rings += line(`M${f(px - 8 + k * 3)} ${f(py)}q${f(8 - k * 3)} 4 ${f(16 - k * 6)} 0`, darken(WOOD, 0.3), 2);
  }
  let s = shape(`M${x - 10} ${y}Q${f(cx - 8)} ${f(cy)} ${f(tx - 5)} ${f(ty)}L${f(tx + 5)} ${f(ty)}Q${f(cx + 8)} ${f(cy)} ${x + 10} ${y}Z`, WOOD, sw, rings);
  const greens = ['#2fbf71', '#23a35e', '#36cf7c'];
  [-168, -128, -92, -52, -14, 22, 160].forEach((deg, i) => { s += frond(tx, ty, frondLen * (i % 2 ? 0.95 : 1.05), frondLen * 0.2, deg, greens[i % 3], sw, 0.3); });
  s += ball(tx - 6, ty + 6, 7, '#8e4f22', '#5a3d1c', sw) + ball(tx + 7, ty + 7, 7, '#8e4f22', '#5a3d1c', sw);
  return s;
}

function miniBowl(x, y, col) {
  return path(`M${x - 13} ${y}Q${x - 12} ${y + 12} ${x} ${y + 12}Q${x + 12} ${y + 12} ${x + 13} ${y}Z`, SHELL, stroke(2.2)) +
    path(`M${x - 11} ${y}Q${x} ${y - 10} ${x + 11} ${y}Z`, col, stroke(2.2)) + circle(x + 3, y - 4, 2, MANGO);
}

export function shopSceneSVG(width = 1280, height = 330) {
  const W = 1280;
  const H = 330;
  const sw = 3;
  let s = rect(0, 0, W, H, 0, '#ffe6c4');
  for (let x = 40; x < W; x += 80) s += line(`M${x} 80V250`, '#f5d3a4', 3);
  // calm lower wall: pastel lagoon wainscot
  s += rect(0, 252, W, 78, 0, '#9fe0d6');
  for (let x = 20; x < W; x += 40) s += line(`M${x} 258V330`, '#8ad3c8', 2);
  s += rect(0, 246, W, 10, 0, WOOD, stroke(sw));

  // window with sea view
  const clip = uid('win');
  let view = rect(470, 112, 340, 140, 0, '#c4f1ff');
  view += circle(744, 156, 24, '#fff3a6') + circle(744, 156, 34, '#fff3a6', op(0.35));
  view += puffs([[540, 148, 12], [556, 142, 14], [572, 150, 10]], WHITE, 0);
  view += rect(470, 192, 340, 60, 0, '#56d4dc') + rect(470, 192, 340, 6, 0, '#3cbfd0');
  view += line('M500 214q8 -5 16 0M580 226q8 -5 16 0M660 210q8 -5 16 0M700 236q8 -5 16 0M540 240q8 -5 16 0', WHITE, 2, op(0.7));
  view += path('M520 194Q546 176 572 194Z', '#ffe2a6', stroke(2)) + line('M546 186Q548 176 544 168', WOOD, 2.5) + path('M544 168q-10 -2 -14 6M544 168q10 -4 14 4M544 168q-2 -8 -10 -10', 'none', stroke(3, '#23a35e'));
  view += path('M650 200H690L684 208H656Z', WHITE, stroke(2)) + path('M670 198V176L686 198Z', PINK, stroke(2));
  view += palmTree(800, 262, 120, -30, 2.4, 70);
  s += `<defs><clipPath id="${clip}"><rect x="482" y="124" width="316" height="114" rx="12"/></clipPath></defs>`;
  s += shape(rrect(466, 108, 348, 146, 22), WOOD, sw, line('M474 118H700', lighten(WOOD, 0.3), 3, op(0.7)));
  s += `<g clip-path="url(#${clip})">${view}</g>`;
  s += path(rrect(482, 124, 316, 114, 12), 'none', stroke(sw));
  s += line('M520 130L560 232M600 130L616 170', WHITE, 6, op(0.35));
  s += shape(rrect(456, 236, 368, 14, 6), darken(WOOD, 0.15), sw);

  // menu board (left)
  let menu = '';
  menu += line('M100 120L180 98L260 120', '#8e4f22', 2.5) + circle(180, 98, 4, '#9aa7b6', stroke(2));
  menu += shape(rrect(70, 114, 220, 122, 16), WOOD, sw) + shape(rrect(82, 126, 196, 98, 10), '#fffaf0', sw * 0.8);
  menu += `<text x="180" y="156" text-anchor="middle" font-family="${FONT}" font-size="28" fill="${PINK}" stroke="${INK}" stroke-width="5" paint-order="stroke fill" stroke-linejoin="round">${esc(t('art.menu'))}</text>`;
  [['#6a2b84', 5], [PINK, 6], ['#2a9fd8', 7]].forEach(([c, price], i) => {
    const y = 172 + i * 18;
    menu += miniBowl(108, y, c) + line(`M126 ${y + 4}H222`, '#c9b49a', 2, ' stroke-dasharray="2 5"');
    menu += circle(236, y + 3, 7, '#ffcf3a', stroke(2)) + `<text x="252" y="${y + 9}" font-family="${FONT}" font-size="17" fill="${PURPLE}">${price}</text>`;
  });
  s += g('translate(34 0)', menu);

  // shelf (right)
  let shelf = '';
  shelf += path('M994 186L1006 186L1006 204Z', WOOD_D, stroke(2)) + path('M1196 186L1208 186L1196 204Z', WOOD_D, stroke(2));
  shelf += shape(rrect(976, 176, 252, 12, 4), WOOD, sw);
  const jar = (x, fill, top) => shape(rrect(x, 128, 38, 48, 8), '#eaf8fd', sw, rect(x + 4, 146, 30, 26, 5, fill) + top + line(`M${x + 7} 136V166`, WHITE, 3, op(0.7))) + shape(rrect(x - 2, 120, 42, 10, 4), '#d79b5f', sw);
  let gran = '';
  for (const [dx, dy] of [[8, 152], [16, 158], [26, 151], [12, 165], [24, 166], [30, 160]]) gran += circle(dx, dy, 3, '#a8692a');
  shelf += jar(990, '#d9973f', g('translate(990 0)', gran));
  let ber = '';
  for (const [dx, dy] of [[9, 152], [18, 156], [27, 151], [12, 165], [23, 166], [31, 162]]) ber += circle(dx, dy, 4, '#7b3a96', stroke(1));
  shelf += jar(1040, '#c9a7e0', g('translate(1040 0)', ber));
  for (let i = 0; i < 3; i++) {
    const y = 170 - i * 9;
    shelf += path(`M${1098 + i * 2} ${y}Q${1100 + i * 2} ${y + 8} ${1124} ${y + 8}Q${1148 - i * 2} ${y + 8} ${1150 - i * 2} ${y}Z`, SHELL, stroke(2.4)) + ellipse(1124, y, 26 - i * 2, 4, RIM_COL, stroke(2.4));
  }
  shelf += leaf(1188, 148, 28, 12, -120, LEAF, 2.4) + leaf(1188, 148, 30, 12, -60, '#23a35e', 2.4) + leaf(1188, 148, 22, 10, -90, '#36cf7c', 2.4);
  shelf += shape('M1172 146H1204L1200 176H1176Z', PINK, sw, line('M1176 156H1201', CREAM, 2.5));

  s += g('translate(-40 0)', shelf);

  // string lights below the awning
  let wire = 'M-20 96';
  const bulbs = [];
  const cols = [MANGO, PINK, LAGOON, LEAF, '#ffffff'];
  for (let x0 = -20; x0 < W + 40; x0 += 160) {
    wire += `Q${x0 + 80} 134 ${x0 + 160} 96`;
    for (let k = 1; k < 4; k++) {
      const tt = k / 4;
      bulbs.push([x0 + 160 * tt, 96 + 2 * tt * (1 - tt) * 38]);
    }
  }
  s += line(wire, INK, 2);
  bulbs.forEach(([x, y], i) => {
    const c = cols[i % cols.length];
    s += circle(x, y + 10, 11, c, op(0.25)) + rect(x - 3, y, 6, 5, 1.5, INK) + ellipse(x, y + 10, 5, 6.5, c, stroke(2)) + circle(x - 1.6, y + 8, 1.5, WHITE, op(0.8));
  });

  // striped awning with scalloped edge
  let aw = '';
  let awShadow = '';
  for (let i = 0; i < W / 64; i++) {
    const x = i * 64;
    const c = i % 2 ? CREAM : PINK;
    const sc = `M${x} 0H${x + 64}V70A32 18 0 0 1 ${x} 70Z`;
    awShadow += path(sc, INK, op(0.1) + tf('translate(0 10)'));
    aw += path(sc, c) + path(`M${x} 60H${x + 64}V70A32 18 0 0 1 ${x} 70Z`, darken(c, 0.16)) + path(sc, 'none', stroke(sw));
  }
  s += awShadow + aw + rect(0, 0, W, 14, 0, WOOD_D, stroke(sw));

  // palm leaves peeking in at the corners
  s += frond(-14, 100, 120, 24, -10, '#2fbf71', sw, 0.3) + frond(-18, 128, 84, 20, 22, '#23a35e', sw, 0.3);
  s += frond(1294, 100, 120, 24, 190, '#2fbf71', sw, 0.3) + frond(1298, 128, 84, 20, 158, '#23a35e', sw, 0.3);
  return svgWrap(width, height, W, H, s, ' preserveAspectRatio="xMidYMid slice"');
}

// ======================================================================
// Logo (viewBox 560×300)
// ======================================================================
export function logoSVG(width = 560) {
  const W = 560;
  const H = 300;
  const sw = ow(W, width, 3, 8);
  const gA = uid('logoA');
  const gB = uid('logoB');
  let s = `<defs><linearGradient id="${gA}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6b8"/><stop offset="0.55" stop-color="#ffd23f"/><stop offset="1" stop-color="#ff9f1c"/></linearGradient>` +
    `<linearGradient id="${gB}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb3d6"/><stop offset="0.55" stop-color="#ff5fa2"/><stop offset="1" stop-color="#e81f76"/></linearGradient></defs>`;
  s += bigLeaf(446, 124, 118, 66, -62, '#2fbf71', sw) + bigLeaf(456, 130, 92, 54, -18, '#23a35e', sw) + bigLeaf(436, 130, 100, 54, -116, '#36cf7c', sw);
  s += g('translate(356 58) scale(0.9) rotate(6 100 100)', bowlBody({ base: 'acai', mid: ['banana', 'strawberry', 'blueberry'], top: ['coconut', 'honey', 'mint'] }, 4.4));
  const word = (str, x, y, fs, len, fill) => {
    const base = `x="${x}" y="${y}" text-anchor="middle" font-family="${FONT}" font-size="${fs}" textLength="${len}" lengthAdjust="spacingAndGlyphs" stroke-linejoin="round" paint-order="stroke fill"`;
    return `<text ${base} fill="${INK}" stroke="${INK}" stroke-width="${f(sw * 5)}" transform="translate(0 9)">${esc(str)}</text>` +
      `<text ${base} fill="url(#${fill})" stroke="${INK}" stroke-width="${f(sw * 5)}">${esc(str)}</text>` +
      `<text ${base} fill="none" stroke="${WHITE}" stroke-width="2.5" opacity="0.5" transform="translate(-2 -3)">${esc(str)}</text>`;
  };
  s += g('rotate(-6 200 150)', word(t('art.logoTop'), 190, 142, 132, 300, gA) + word(t('art.logoBottom'), 214, 262, 118, 330, gB));
  s += sparkle(42, 44, 14, WHITE, stroke(2)) + sparkle(372, 266, 10, WHITE, stroke(2)) + sparkle(540, 40, 9, WHITE, stroke(2));
  return svgWrap(width, (width * H) / W, W, H, s);
}

// ======================================================================
// Level map background (1280×800): sunny beach promenade
// ======================================================================
export function mapBackgroundSVG(width = 1280, height = 800) {
  const W = 1280;
  const H = 800;
  const sw = 3;
  const sky = uid('sky');
  const sea = uid('sea');
  let s = `<defs><linearGradient id="${sky}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fd6ff"/><stop offset="1" stop-color="#cdf4ff"/></linearGradient>` +
    `<linearGradient id="${sea}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1fb0c9"/><stop offset="1" stop-color="#5fe0e0"/></linearGradient></defs>`;
  s += rect(0, 0, W, 210, 0, `url(#${sky})`);
  s += circle(1090, 92, 100, '#fff7c2', op(0.3)) + circle(1090, 92, 72, '#fff7c2', op(0.45)) + ball(1090, 92, 48, '#ffe066', '#ffcf3a', sw, 0.5);
  s += puffs([[170, 92, 26], [204, 76, 34], [242, 90, 26], [210, 100, 22]], WHITE, sw);
  s += puffs([[560, 60, 18], [584, 50, 24], [612, 62, 18]], WHITE, sw);
  s += puffs([[860, 120, 20], [890, 106, 28], [924, 118, 20]], WHITE, sw);
  s += line('M380 70q8 -8 16 0q8 -8 16 0M700 110q6 -6 12 0q6 -6 12 0M440 140q6 -6 12 0q6 -6 12 0', INK, 2.5);
  s += rect(0, 200, W, 150, 0, `url(#${sea})`) + rect(0, 200, W, 8, 0, '#178fb0');
  s += path('M250 206Q330 168 410 206Z', '#ffe2a6', stroke(sw)) + palmTree(334, 196, 46, 10, 2.2, 34);
  let waves = '';
  const rng = rngFor('map-waves');
  for (let i = 0; i < 26; i++) {
    const x = rng.next() * W;
    const y = 222 + rng.next() * 100;
    waves += `M${f(x)} ${f(y)}q10 -7 20 0`;
  }
  s += line(waves, WHITE, 2.5, op(0.65));
  // sailboat in open sea right of node 16 (clear of level nodes, star pills and the road bulge),
  // drawn after the wave strokes so no wave crosses its sails
  s += g('translate(400 0)', path('M760 246H820L810 260H770Z', WHITE, stroke(sw)) + path('M790 244V200L824 244Z', PINK, stroke(sw)) + path('M788 244V210L764 244Z', MANGO, stroke(sw)));
  // shore foam + sand
  let foam = 'M0 336';
  for (let x = 0; x < W; x += 80) foam += `Q${x + 40} 318 ${x + 80} 336`;
  s += path(`${foam}V800H0Z`, '#f3d394');
  let sand = 'M0 352';
  for (let x = 0; x < W; x += 80) sand += `Q${x + 40} 338 ${x + 80} 352`;
  s += path(`${foam}V350H0Z`, WHITE, op(0.9)) + line(foam, INK, 2, op(0.25));
  s += path(`${sand}V800H0Z`, '#ffe2a6');
  for (const [x, y, rx, ry] of [[320, 470, 160, 30], [940, 560, 190, 34], [600, 690, 220, 30], [120, 610, 120, 24], [1150, 420, 120, 22]]) s += ellipse(x, y, rx, ry, '#fbd590', op(0.55));
  const dots = rngFor('map-sand');
  let grains = '';
  for (let i = 0; i < 90; i++) grains += circle(dots.next() * W, 370 + dots.next() * 360, 1.6, '#e9c27a', op(0.7));
  s += grains;
  // boardwalk along the bottom edge
  let boards = '';
  for (let x = 0; x < W; x += 46) boards += line(`M${x} 742V800`, darken(WOOD, 0.28), 2);
  s += shape(`M-4 740H${W + 4}V804H-4Z`, WOOD, sw, boards + line(`M0 750H${W}`, lighten(WOOD, 0.3), 3, op(0.6)));
  for (let x = 40; x < W; x += 200) s += rect(x - 6, 714, 12, 30, 3, WOOD_D, stroke(sw));
  let rope = `M34 718`;
  for (let x = 40; x < W; x += 200) rope += `Q${x + 100} 740 ${x + 200} 718`;
  s += line(rope, '#e9d3a8', 3.5) + line(rope, INK, 1, op(0.4));
  // beach props near the edges
  const canopy = 'M-72 0A72 40 0 0 1 72 0Q54 11 36 0Q18 11 0 0Q-18 11 -36 0Q-54 11 -72 0Z';
  const stripes = path('M0 -40A72 40 0 0 0 -72 0Q-54 11 -36 0Q-18 -22 0 -40Z', PINK) + path('M0 -40Q4 -20 0 0Q18 11 36 0Q18 -22 0 -40Z', PINK);
  s += g('translate(132 596) rotate(-10) scale(0.8)', line('M0 -36V112', '#9aa7b6', 5) + line('M0 -36V112', INK, 1.2, op(0.4)) +
    shape(canopy, CREAM, sw, stripes + line('M-48 -24Q-30 -38 -8 -38', WHITE, 3, op(0.6))) + circle(0, -42, 4, PINK, stroke(sw * 0.8)));
  s += g('rotate(-8 170 670)', shape(rrect(110, 640, 120, 56, 8), LAGOON, sw, line('M130 640V696M150 640V696', WHITE, 6, op(0.8))));
  // beach ball on open sand between road rows 1 and 2 (no level node, star pill or road nearby)
  s += ball(540, 600, 22, WHITE, '#d9d2e0', sw) + path('M540 578A22 22 0 0 1 562 600H540Z', PINK) + path('M540 622A22 22 0 0 1 518 600H540Z', LAGOON) + circle(540, 600, 22, 'none', stroke(sw));
  const starfish = (x, y, k, deg) => g(`translate(${x} ${y}) rotate(${deg}) scale(${k})`, path(polyPath(starPoints(0, 0, 16, 7)), '#ff8a5c', stroke(sw / k)) + circle(0, 0, 2, '#ffd0b8'));
  s += starfish(380, 420, 1, 12) + starfish(1180, 520, 0.8, -20) + starfish(860, 760, 0.7, 30);
  const shell = (x, y, deg) => g(`translate(${x} ${y}) rotate(${deg})`, path('M0 10L-12 -2Q0 -16 12 -2Z', '#ffd6e6', stroke(2.4)) + line('M0 10L-6 -6M0 10V-9M0 10L6 -6', '#e8a0bd', 1.6));
  // shells sit in the sand pockets between road rows (the old spots hid under node 15 and the left road loop)
  s += shell(350, 600, -10) + shell(945, 460, 15) + shell(560, 770, 0);
  s += palmTree(62, 700, 310, 64, sw, 110) + palmTree(1222, 690, 290, -60, sw, 104);
  return svgWrap(width, height, W, H, s, ' preserveAspectRatio="xMidYMid slice"');
}
