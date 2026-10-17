// Food art for Açaí Fever: the clear plastic cup with its layers, toppings, ingredient icons,
// the ingredient bowls on the counter, frozen packs and smoothie cups. Realistic, glossy look:
// shapes are filled with their colour and shaded with the shared gradients from svg.js
// (light from the top left), thin outlines in a darker shade of the fill. Pure module.

import { ING } from './data.js';
import {
  WHITE, f, rngFor, memo, mix, lighten, svgWrap, stroke, op, tf, circle, ellipse, path, rect, g, line,
  rrect, smoothClosed, smoothOpen, polyPath, paint, lit, litEllipse, litCircle, softShadow, edge, registerDefs,
} from './svg.js';

// ======================================================================
// Pieces – one function per kind, drawn around (x, y) with size s (viewBox units)
// ======================================================================
const FOOD = {
  bananaFlesh: '#fbf0c4',
  bananaRim: '#efd88a',
  bananaSeed: '#b08a4c',
  berry: '#38407e',
  berryBloom: '#9fb0e6',
  strawberry: '#e0263b',
  strawberryCore: '#ffd2d4',
  strawberryFlesh: '#ff7d88',
  mango: '#ffb21e',
  mangoDark: '#f08700',
  kiwi: '#7fbf35',
  kiwiCore: '#f2f5cf',
  kiwiSkin: '#6b4c26',
  granola: '#c98a3f',
  granolaDark: '#8f5a22',
  oat: '#f2d9a0',
  coconut: '#fffcf3',
  cacao: '#5b3120',
  mint: '#3fae55',
};

const ew = (s) => Math.max(0.7, s * 0.08); // outline width for a piece of size s

// Chia seeds as short round-capped strokes, one path per colour (hundreds of seeds stay a few elements).
const CHIA = ['#1f1f1f', '#7d7a74', '#d6cfc2', '#3d3b38', '#a59f95'];
function chiaSeeds(points, rng, w = 1.7, len = 1.1) {
  const by = CHIA.map(() => '');
  points.forEach(([x, y], i) => {
    const a = rng.next() * Math.PI;
    by[i % CHIA.length] += `M${f(x)} ${f(y)}l${f(Math.cos(a) * len)} ${f(Math.sin(a) * len)}`;
  });
  return CHIA.map((c, i) => (by[i] ? line(by[i], c, w) : '')).join('');
}

function bananaSlice(x, y, s, rng, tilt = 0.62) {
  const ry = s * tilt;
  const th = s * 0.2;
  let d = ellipse(x, y + th, s, ry, FOOD.bananaRim, stroke(ew(s), edge(FOOD.bananaRim, 0.3)));
  d += ellipse(x, y, s, ry, FOOD.bananaFlesh, stroke(ew(s) * 0.8, mix(FOOD.bananaRim, '#c9a24a', 0.4)));
  d += ellipse(x, y, s * 0.62, ry * 0.62, 'none', stroke(Math.max(0.5, s * 0.06), '#f1dc98') + op(0.8));
  // the soft star of seeds in the middle of a banana slice
  let seeds = '';
  const a0 = rng.next() * Math.PI;
  for (let i = 0; i < 3; i++) {
    const a = a0 + (i / 3) * Math.PI * 2;
    seeds += ellipse(x + Math.cos(a) * s * 0.17, y + Math.sin(a) * ry * 0.17, s * 0.07, s * 0.045, FOOD.bananaSeed, op(0.75));
  }
  d += seeds + ellipse(x, y, s * 0.1, s * 0.07, '#d9bd7a', op(0.6));
  d += litEllipse(x, y, s, ry, 'sph-soft');
  return d + ellipse(x - s * 0.38, y - ry * 0.4, s * 0.28, ry * 0.16, WHITE, op(0.55) + tf(`rotate(-12 ${f(x - s * 0.38)} ${f(y - ry * 0.4)})`));
}

// Strawberry half, cut face up: red rim, pale core, seeds on the skin.
function strawberryHalf(x, y, s, rng) {
  const rot = f((rng.next() - 0.5) * 70);
  const heart = (k, dy = 0) => `M0 ${f(s * k + dy)}C${f(-s * 1.2 * k)} ${f(s * 0.35 * k + dy)} ${f(-s * 0.98 * k)} ${f(-s * 0.9 * k + dy)} 0 ${f(-s * 0.62 * k + dy)}C${f(s * 0.98 * k)} ${f(-s * 0.9 * k + dy)} ${f(s * 1.2 * k)} ${f(s * 0.35 * k + dy)} 0 ${f(s * k + dy)}Z`;
  let b = path(heart(1), FOOD.strawberry, stroke(ew(s), edge(FOOD.strawberry, 0.45)));
  b += path(heart(0.8, s * 0.03), FOOD.strawberryFlesh);
  b += path(heart(0.56, s * 0.05), mix(FOOD.strawberryCore, FOOD.strawberryFlesh, 0.2));
  b += path(`M0 ${f(-s * 0.36)}C${f(-s * 0.16)} 0 ${f(-s * 0.07)} ${f(s * 0.36)} 0 ${f(s * 0.6)}C${f(s * 0.07)} ${f(s * 0.36)} ${f(s * 0.16)} 0 0 ${f(-s * 0.36)}Z`, FOOD.strawberryCore, op(0.9));
  // seed dots along the skin
  for (let i = 0; i < 7; i++) {
    const t = (i + 0.5) / 7;
    const a = Math.PI * (0.15 + t * 1.7);
    b += circle(Math.cos(a) * s * 0.86, Math.sin(a) * s * 0.7 - s * 0.05, Math.max(0.35, s * 0.05), '#ffe6a3', op(0.85));
  }
  b += lit(heart(1), 'sph-soft');
  b += ellipse(-s * 0.48, -s * 0.28, s * 0.16, s * 0.3, WHITE, op(0.45) + tf(`rotate(25 ${f(-s * 0.48)} ${f(-s * 0.28)})`));
  return g(`translate(${f(x)} ${f(y)}) rotate(${rot}) scale(1 0.86)`, b);
}

function blueberry(x, y, s) {
  let d = circle(x, y, s, FOOD.berry, stroke(ew(s) * 0.9, '#1d2148'));
  d += circle(x - s * 0.15, y - s * 0.2, s * 0.78, FOOD.berryBloom, op(0.28));
  d += litCircle(x, y, s, 'sph');
  // crown
  const cx = x + s * 0.18;
  const cy = y - s * 0.3;
  let crown = '';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    crown += `${i ? 'L' : 'M'}${f(cx + Math.cos(a) * s * 0.3)} ${f(cy + Math.sin(a) * s * 0.18)}L${f(cx + Math.cos(a + 0.63) * s * 0.12)} ${f(cy + Math.sin(a + 0.63) * s * 0.08)}`;
  }
  d += path(`${crown}Z`, '#1c1f3f', op(0.85)) + ellipse(cx, cy, s * 0.08, s * 0.05, '#7d86c4', op(0.7));
  return d + circle(x - s * 0.38, y - s * 0.36, s * 0.16, WHITE, op(0.7));
}

function mangoCube(x, y, s, rng) {
  const rot = f((rng.next() - 0.5) * 40);
  const h = s * 0.62;
  const r = s * 0.22;
  let b = path(rrect(-s, -s * 0.55, s * 2, s * 1.1 + h, r), FOOD.mangoDark, stroke(ew(s), edge(FOOD.mangoDark, 0.45)));
  b += path(rrect(-s, -s * 0.55 + h * 0.9, s * 2, s * 1.1, r), mix(FOOD.mangoDark, '#d96d00', 0.3), op(0.6));
  b += path(rrect(-s, -s * 0.85, s * 2, s * 1.5, r), FOOD.mango, stroke(ew(s) * 0.8, edge(FOOD.mango, 0.3)));
  b += path(rrect(-s, -s * 0.85, s * 2, s * 1.5, r), paint('sph-soft'));
  // juicy fibres and a wet highlight
  b += line(`M${f(-s * 0.6)} ${f(-s * 0.4)}L${f(s * 0.5)} ${f(s * 0.3)}M${f(-s * 0.2)} ${f(-s * 0.6)}L${f(s * 0.7)} ${f(-s * 0.1)}`, '#ffd56a', Math.max(0.4, s * 0.07), op(0.6));
  b += ellipse(-s * 0.45, -s * 0.5, s * 0.38, s * 0.13, WHITE, op(0.6));
  return g(`translate(${f(x)} ${f(y)}) rotate(${rot})`, b);
}

function kiwiSlice(x, y, s, rng, tilt = 0.64) {
  const ry = s * tilt;
  const th = s * 0.16;
  let d = ellipse(x, y + th, s, ry, FOOD.kiwiSkin, stroke(ew(s) * 0.8, edge(FOOD.kiwiSkin, 0.4)));
  d += ellipse(x, y, s, ry, '#93744a');
  d += ellipse(x, y, s * 0.92, ry * 0.92, FOOD.kiwi);
  // light rays from the core
  let rays = '';
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.next() * 0.2;
    rays += `M${f(x + Math.cos(a) * s * 0.3)} ${f(y + Math.sin(a) * ry * 0.3)}L${f(x + Math.cos(a) * s * 0.8)} ${f(y + Math.sin(a) * ry * 0.8)}`;
  }
  d += line(rays, '#c4e47e', Math.max(0.4, s * 0.06), op(0.8));
  // seed ring: round dots along an ellipse
  const rr = s * 0.4;
  const gap = (Math.PI * (rr + ry * 0.4)) / 12;
  d += ellipse(x, y, rr, ry * 0.4, 'none', stroke(Math.max(0.8, s * 0.11), '#1b1a12') + ` stroke-dasharray="0.01 ${f(gap)}"`);
  d += ellipse(x, y, s * 0.26, ry * 0.26, FOOD.kiwiCore);
  d += litEllipse(x, y, s * 0.92, ry * 0.92, 'sph-soft');
  return d + ellipse(x - s * 0.4, y - ry * 0.42, s * 0.24, ry * 0.14, WHITE, op(0.6));
}

function granolaCluster(x, y, s, rng) {
  const d0 = blobPath(x, y, s, rng, 9, 0.32);
  const tone = mix(FOOD.granola, FOOD.granolaDark, rng.next() * 0.3);
  let d = path(d0, tone, stroke(ew(s), edge(tone, 0.4)));
  // toasted oat flakes stuck together, dark crevices, sometimes a nut or a raisin
  for (let i = 0; i < 3; i++) {
    const ox = x + (rng.next() - 0.5) * s * 1.2;
    const oy = y + (rng.next() - 0.5) * s;
    const oat = mix(FOOD.oat, tone, 0.1 + rng.next() * 0.3);
    d += ellipse(ox, oy, s * 0.28, s * 0.16, oat, stroke(Math.max(0.3, s * 0.04), edge(oat, 0.25)) + tf(`rotate(${f(rng.next() * 180)} ${f(ox)} ${f(oy)})`));
  }
  d += circle(x + (rng.next() - 0.5) * s, y + (rng.next() - 0.5) * s * 0.8, s * 0.1, FOOD.granolaDark, op(0.8));
  const extra = rng.next();
  if (extra < 0.3) d += ellipse(x + s * 0.2, y + s * 0.15, s * 0.32, s * 0.22, '#ecc893', stroke(Math.max(0.4, s * 0.05), '#a8743a'));
  else if (extra < 0.45) d += ellipse(x - s * 0.25, y + s * 0.1, s * 0.2, s * 0.16, '#4a1f2a', stroke(Math.max(0.3, s * 0.04), '#2a0f16'));
  d += lit(d0, 'sph');
  return d;
}

function blobPath(cx, cy, r, rng, n = 7, jit = 0.2) {
  const pts = [];
  const a0 = rng.next() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * Math.PI * 2;
    const rr = r * (1 - jit + rng.next() * jit * 2);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.85]);
  }
  return smoothClosed(pts);
}

// Curled coconut chip: white top, a sliver of the brown inner skin on one edge.
function coconutFlake(x, y, s, rng) {
  const rot = f(rng.next() * 180);
  const d = `M${f(-s)} ${f(s * 0.2)}Q${f(-s * 0.2)} ${f(-s * 0.6)} ${f(s)} ${f(-s * 0.15)}Q${f(s * 0.2)} ${f(s * 0.15)} ${f(-s)} ${f(s * 0.2)}Z`;
  return g(`translate(${f(x)} ${f(y)}) rotate(${rot})`,
    path(`M${f(-s)} ${f(s * 0.32)}Q${f(s * 0.2)} ${f(s * 0.3)} ${f(s)} ${f(-s * 0.05)}`, 'none', stroke(Math.max(0.4, s * 0.12), '#a2805c') + op(0.7)) +
    path(d, FOOD.coconut, stroke(Math.max(0.35, s * 0.07), '#bfae90')) + path(d, paint('sph-soft')) +
    path(`M${f(-s * 0.7)} ${f(s * 0.05)}Q${f(-s * 0.1)} ${f(-s * 0.35)} ${f(s * 0.7)} ${f(-s * 0.15)}`, 'none', stroke(Math.max(0.3, s * 0.08), WHITE) + op(0.9)));
}

function cacaoNib(x, y, s, rng) {
  const rot = f(rng.next() * 360);
  const pts = [[-s, -s * 0.2], [-s * 0.15, -s * 0.9], [s * 0.9, -s * 0.35], [s * 0.6, s * 0.75], [-s * 0.55, s * 0.65]];
  return g(`translate(${f(x)} ${f(y)}) rotate(${rot})`,
    path(polyPath(pts), FOOD.cacao, stroke(Math.max(0.35, s * 0.1), '#2a140b')) +
    path(polyPath([[-s * 0.15, -s * 0.9], [s * 0.9, -s * 0.35], [s * 0.05, -s * 0.05]]), '#8a5638') +
    path(polyPath([[s * 0.9, -s * 0.35], [s * 0.6, s * 0.75], [s * 0.05, -s * 0.05]]), '#3e1e10'));
}

function mintLeaf(x, y, len, wid, deg) {
  const L = len;
  const Wd = wid;
  // slightly serrated edge
  const top = [];
  const bot = [];
  const n = 7;
  for (let i = 1; i < n; i++) {
    const k = i / n;
    const w = Wd * Math.sin(Math.PI * k) ** 0.8 * (i % 2 ? 1 : 0.88);
    top.push([L * k, -w]);
    bot.push([L * k, w]);
  }
  const d = `M0 0${top.map(([a, b]) => `L${f(a)} ${f(b)}`).join('')}L${f(L)} 0${bot.reverse().map(([a, b]) => `L${f(a)} ${f(b)}`).join('')}Z`;
  let veins = `M${f(L * 0.05)} 0L${f(L * 0.92)} 0`;
  for (const k of [0.28, 0.48, 0.68]) veins += `M${f(L * k)} 0L${f(L * (k + 0.14))} ${f(-Wd * 0.5)}M${f(L * k)} 0L${f(L * (k + 0.14))} ${f(Wd * 0.5)}`;
  return g(`translate(${f(x)} ${f(y)}) rotate(${f(deg)})`,
    path(d, FOOD.mint, stroke(Math.max(0.5, Wd * 0.08), '#1f6b30')) + path(d, paint('sph-soft')) +
    line(veins, '#8fd99a', Math.max(0.4, Wd * 0.08), op(0.8)) +
    ellipse(L * 0.35, -Wd * 0.3, L * 0.18, Wd * 0.12, WHITE, op(0.35)));
}

function mintSprig(x, y, k = 1) {
  return mintLeaf(x, y, 22 * k, 9 * k, -150) + mintLeaf(x, y, 24 * k, 10 * k, -35) + mintLeaf(x + 1, y - 2, 18 * k, 8 * k, -95) +
    line(`M${f(x)} ${f(y)}l${f(-1 * k)} ${f(5 * k)}`, '#2c7a3a', Math.max(0.8, 1.6 * k));
}

// ======================================================================
// The cup (viewBox 200×200): clear PET cup, 3/4 view from above
// ======================================================================
const RIM = { cx: 100, cy: 50, rx: 64, ry: 19 };
const BOT = { cx: 100, cy: 182, rx: 42, ry: 14 };
const WALL = 2.4; // plastic thickness (inner surface is inset by this much)
const SURF_Y = 60; // purée surface (centre of its ellipse)

const halfAt = (y) => RIM.rx + ((y - RIM.cy) / (BOT.cy - RIM.cy)) * (BOT.rx - RIM.rx);
const ryAt = (y) => RIM.ry + ((y - RIM.cy) / (BOT.cy - RIM.cy)) * (BOT.ry - RIM.ry);
const SURF = { cx: 100, cy: SURF_Y, rx: halfAt(SURF_Y) - WALL, ry: ryAt(SURF_Y) - 1 };

const CUP_BODY = `M${f(RIM.cx - RIM.rx)} ${RIM.cy}L${f(BOT.cx - BOT.rx)} ${BOT.cy}A${BOT.rx} ${BOT.ry} 0 0 0 ${f(BOT.cx + BOT.rx)} ${BOT.cy}L${f(RIM.cx + RIM.rx)} ${RIM.cy}A${RIM.rx} ${RIM.ry} 0 0 0 ${f(RIM.cx - RIM.rx)} ${RIM.cy}Z`;
const CUP_FRONT = `M${f(RIM.cx - RIM.rx)} ${RIM.cy}A${RIM.rx} ${RIM.ry} 0 0 0 ${f(RIM.cx + RIM.rx)} ${RIM.cy}L${f(BOT.cx + BOT.rx)} ${BOT.cy}A${BOT.rx} ${BOT.ry} 0 0 1 ${f(BOT.cx - BOT.rx)} ${BOT.cy}Z`;

// Inside of the cup from the purée surface down: back half of the surface ellipse on top.
function pureeBody(yTop) {
  const hwT = halfAt(yTop) - WALL;
  const ryT = ryAt(yTop) - 1;
  const yB = BOT.cy - 2.5;
  const hwB = BOT.rx - WALL;
  const ryB = BOT.ry - 2;
  return `M${f(100 - hwT)} ${f(yTop)}L${f(100 - hwB)} ${f(yB)}A${f(hwB)} ${f(ryB)} 0 0 0 ${f(100 + hwB)} ${f(yB)}L${f(100 + hwT)} ${f(yTop)}A${f(hwT)} ${f(ryT)} 0 0 0 ${f(100 - hwT)} ${f(yTop)}Z`;
}

// Colours of the blended bases (cup and blender jug).
const PUREE = {
  acai: { main: '#4d1a5e', light: '#7c3a92', dark: '#2c0c36', fleck: '#a06ab8' },
  pitaya: { main: '#e2266f', light: '#ff6aa6', dark: '#9c0f47', fleck: '#2a0f1c' },
  spirulina: { main: '#1f8fcf', light: '#68c6f2', dark: '#0d5a8a', fleck: '#d6f2ff' },
};
export const pureeOf = (id) => PUREE[id] || PUREE.acai;

function pureeInCup(base) {
  const p = pureeOf(base);
  const body = pureeBody(SURF_Y);
  let s = path(body, p.main);
  // sorbet pressed against the plastic: soft streaks and a few air pockets
  const rng = rngFor(`puree-${base}`);
  let streaks = '';
  for (let i = 0; i < 7; i++) {
    const x0 = 56 + rng.next() * 88;
    const y0 = 76 + rng.next() * 80;
    streaks += `M${f(x0)} ${f(y0)}q${f(6 + rng.next() * 8)} ${f(4 + rng.next() * 6)} ${f(14 + rng.next() * 10)} ${f(rng.next() * 6 - 3)}`;
  }
  s += line(streaks, p.light, 3.4, op(0.28));
  let darks = '';
  for (let i = 0; i < 6; i++) {
    const x0 = 58 + rng.next() * 84;
    const y0 = 80 + rng.next() * 84;
    darks += `M${f(x0)} ${f(y0)}q${f(8 + rng.next() * 6)} ${f(-3 - rng.next() * 4)} ${f(16 + rng.next() * 8)} ${f(rng.next() * 4)}`;
  }
  s += line(darks, p.dark, 3, op(0.3));
  for (let i = 0; i < 10; i++) {
    const x0 = 58 + rng.next() * 84;
    const y0 = 74 + rng.next() * 96;
    s += ellipse(x0, y0, 1 + rng.next() * 1.6, 0.8 + rng.next(), p.fleck, op(0.5));
  }
  s += path(body, paint('cyl'));
  // the surface: a shiny lid of sorbet with a swirl
  const sw = SURF;
  s += ellipse(sw.cx, sw.cy, sw.rx, sw.ry, mix(p.main, p.light, 0.35));
  s += line(`M${f(sw.cx - 30)} ${f(sw.cy + 2)}C${f(sw.cx - 26)} ${f(sw.cy - 10)} ${f(sw.cx + 18)} ${f(sw.cy - 12)} ${f(sw.cx + 22)} ${f(sw.cy - 2)}C${f(sw.cx + 26)} ${f(sw.cy + 8)} ${f(sw.cx - 4)} ${f(sw.cy + 10)} ${f(sw.cx - 6)} ${f(sw.cy + 2)}`, p.light, 3, op(0.7));
  s += litEllipse(sw.cx, sw.cy, sw.rx, sw.ry, 'sph-soft');
  s += ellipse(sw.cx - 22, sw.cy - 6, 14, 3.2, WHITE, op(0.45) + tf(`rotate(-8 ${sw.cx - 22} ${sw.cy - 6})`));
  return s;
}

// Points on the top of the cup: u ∈ [-1, 1] across, v ∈ [-1, 1] back → front; the pile is heaped
// in the middle so it rises above the rim like a real loaded cup.
const HEAP = 15;
function onTop(u, v) {
  const x = SURF.cx + u * SURF.rx * 0.92;
  const y = SURF.cy + v * SURF.ry * 0.82 - HEAP * (1 - u * u) * (1 - 0.35 * v * v);
  return { x, y };
}

// size = piece size, cols × rows grid per sector (scaled down with more sectors)
const PIECES = {
  banana: { size: 11.5, draw: bananaSlice, band: '#f6e3a4' },
  granola: { size: 8, draw: granolaCluster, dense: 1.1, band: '#b9792f' },
  strawberry: { size: 11, draw: strawberryHalf, band: '#e8424f' },
  blueberry: { size: 6.2, draw: blueberry, band: '#2f3670' },
  mango: { size: 7.6, draw: mangoCube, band: '#ffa21a' },
  kiwi: { size: 11, draw: kiwiSlice, band: '#86c23a' },
};

function sectorPoints(i, n, size, dense, rng) {
  const u0 = -1 + (2 * i) / n;
  const u1 = -1 + (2 * (i + 1)) / n;
  const width = (u1 - u0) * SURF.rx * 0.92;
  const cols = Math.max(1, Math.round((width / (size * 1.55)) * dense));
  const rows = Math.max(2, Math.round(((SURF.ry * 1.64) / (size * 1.0)) * dense));
  const pts = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const u = u0 + ((c + 0.5 + (r % 2 ? 0.25 : -0.25)) / cols) * (u1 - u0) + (rng.next() - 0.5) * 0.06;
      const v = -0.95 + (r / Math.max(1, rows - 1)) * 1.9 + (rng.next() - 0.5) * 0.12;
      const uu = Math.max(-0.97, Math.min(0.97, u));
      // stay inside the ellipse
      if (uu * uu + v * v * 0.55 > 1.05) continue;
      pts.push(onTop(uu, v));
    }
  }
  return pts.sort((a, b) => a.y - b.y);
}

function midOnCup(mid) {
  let s = '';
  const n = mid.length;
  mid.forEach((id, i) => {
    const spec = PIECES[id];
    if (!spec) return;
    const rng = rngFor(`top-${id}-${i}-${n}`);
    const size = spec.size * (n >= 3 ? 0.86 : 1);
    for (const p of sectorPoints(i, n, size, spec.dense || 1, rng)) s += spec.draw(p.x, p.y, size * (0.9 + rng.next() * 0.2), rng);
  });
  return s;
}

// Sauce: a zigzag drizzle over the top and runs down the inside of the wall.
const SAUCE = {
  honey: { col: '#f2a81d', hi: '#ffe08a', dark: '#b86f05', alpha: 0.92 },
  peanut: { col: '#c5853f', hi: '#e8b87a', dark: '#8a5320', alpha: 1 },
  chocolate: { col: '#4a2312', hi: '#a0674a', dark: '#2a1007', alpha: 1 },
};

function sauceDrizzle(id, k) {
  const c = SAUCE[id];
  const ang = [-0.35, 0.5, 1.25][k % 3];
  const n = 7;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = -0.85 + (1.7 * i) / n;
    const v = (i % 2 ? 1 : -1) * Math.sqrt(Math.max(0, 1 - u * u)) * 0.85;
    const ru = u * Math.cos(ang) - v * Math.sin(ang) * 0.6;
    const rv = u * Math.sin(ang) + v * Math.cos(ang);
    const p = onTop(Math.max(-0.95, Math.min(0.95, ru)), Math.max(-0.95, Math.min(0.95, rv)));
    pts.push([p.x, p.y - 3]);
  }
  const d = smoothOpen(pts);
  return line(d, c.dark, 4.6, op(0.9)) + line(d, c.col, 3.4) + line(d, c.hi, 1.1, op(0.85) + tf('translate(-0.5 -0.9)'));
}

// Runs of sauce on the inner wall, seen through the plastic: a wide swirl and a few drips.
function sauceRuns(id, k) {
  const c = SAUCE[id];
  const rng = rngFor(`runs-${id}-${k}`);
  const wallX = (u, y) => 100 + u * (halfAt(y) - WALL - 2);
  let s = '';
  // swirl: a ribbon that winds down the front of the cup
  const y0 = 70 + k * 6;
  const y1 = 128 + rng.next() * 26;
  const u0 = k % 2 ? 0.7 : -0.75;
  const u1 = -u0 * 0.5;
  const w0 = 9;
  const w1 = 4;
  const a = [wallX(u0, y0), y0];
  const b = [wallX((u0 + u1) / 2 + 0.25 * Math.sign(u0), (y0 + y1) / 2), (y0 + y1) / 2];
  const e = [wallX(u1, y1), y1];
  const ribbon = `M${f(a[0])} ${f(a[1] - w0)}Q${f(b[0])} ${f(b[1] - w0)} ${f(e[0])} ${f(e[1] - w1)}Q${f(e[0] + 4 * Math.sign(u1 - u0))} ${f(e[1])} ${f(e[0])} ${f(e[1] + w1)}Q${f(b[0])} ${f(b[1] + w0 * 0.8)} ${f(a[0])} ${f(a[1] + w0 * 0.6)}Z`;
  s += path(ribbon, c.col, op(0.9 * c.alpha)) + path(ribbon, paint('cyl-soft'));
  s += path(`M${f(a[0])} ${f(a[1] - w0 * 0.4)}Q${f(b[0])} ${f(b[1] - w0 * 0.5)} ${f(e[0])} ${f(e[1] - w1 * 0.3)}`, 'none', stroke(1.1, c.hi) + op(0.7));
  // drips from the rim: wide where they leave the top, a thin neck, a round drop at the end
  for (const u of [-0.42, 0.36].map((v) => v + (rng.next() - 0.5) * 0.2 + k * 0.14)) {
    const yTop = SURF_Y + SURF.ry * Math.sqrt(Math.max(0, 1 - u * u)) - 4;
    const x = wallX(u, yTop);
    const len = 12 + rng.next() * 14;
    const w = 3.4 + rng.next() * 1.4;
    const yEnd = yTop + len;
    const x2 = wallX(u, yEnd);
    const neck = w * 0.38;
    const d = `M${f(x - w)} ${f(yTop)}Q${f(x - w * 0.45)} ${f(yTop + len * 0.45)} ${f(x2 - neck)} ${f(yEnd - w * 1.3)}A${f(w * 0.8)} ${f(w * 0.8)} 0 1 0 ${f(x2 + neck)} ${f(yEnd - w * 1.3)}Q${f(x + w * 0.45)} ${f(yTop + len * 0.45)} ${f(x + w)} ${f(yTop)}Z`;
    s += path(d, c.col, op(0.9 * c.alpha)) + path(d, paint('cyl-soft')) +
      ellipse(x2 - w * 0.25, yEnd - w * 0.75, w * 0.22, w * 0.3, c.hi, op(0.8));
  }
  return s;
}

// The layers seen through the side of the cup: every fruit/crunch goes in as a band (like a
// layered açaí cup), with purée in between; the top of the cup carries the same items.
function midBands(mid) {
  const list = mid.filter((id) => PIECES[id]).slice(0, 3);
  const n = list.length;
  if (!n) return '';
  const ys = { 1: [118], 2: [102, 142], 3: [92, 122, 152] }[n];
  let s = '';
  list.forEach((id, i) => {
    const spec = PIECES[id];
    const rng = rngFor(`band-${id}-${i}-${n}`);
    const y = ys[i];
    const h = n === 3 ? 7 : 8;
    const hwT = halfAt(y - h) - WALL;
    const hwB = halfAt(y + h) - WALL;
    // wavy top and bottom edges between the walls
    const top = [];
    const bot = [];
    for (let k = 0; k <= 6; k++) {
      const u = -1 + k / 3;
      top.push([100 + u * hwT, y - h + Math.sin(k * 1.7 + i) * 2.2 + (rng.next() - 0.5) * 2]);
      bot.push([100 + u * hwB, y + h + Math.sin(k * 1.3 + i * 2) * 2.4 + (rng.next() - 0.5) * 2]);
    }
    const d = `${smoothOpen(top)}L${f(bot[6][0])} ${f(bot[6][1])}${smoothOpen(bot.slice().reverse()).replace(/^M/, 'L')}Z`;
    s += path(d, spec.band);
    // a row of pieces pressed against the plastic
    const count = Math.round((hwT * 2) / (spec.size * 1.5));
    for (let k = 0; k < count; k++) {
      const x = 100 - hwT + ((k + 0.5) / count) * hwT * 2 + (rng.next() - 0.5) * 3;
      const yy = y + (rng.next() - 0.5) * h * 0.8;
      s += spec.draw(x, yy, spec.size * 0.62, rng, 0.9);
    }
    s += path(d, paint('cyl'));
  });
  return s;
}

function sprinkleOnCup(id) {
  const rng = rngFor(`sprinkle-${id}`);
  let s = '';
  if (id === 'coconut') {
    for (let i = 0; i < 16; i++) {
      const p = onTop(rng.next() * 1.8 - 0.9, rng.next() * 1.8 - 0.9);
      s += coconutFlake(p.x, p.y - 3, 3.6 + rng.next() * 1.6, rng);
    }
  } else if (id === 'chia') {
    const pts = [];
    for (let i = 0; i < 80; i++) {
      const p = onTop(rng.next() * 1.9 - 0.95, rng.next() * 1.9 - 0.95);
      pts.push([p.x, p.y - 2]);
    }
    s += chiaSeeds(pts, rng, 1.8, 0.9);
  } else if (id === 'cacao') {
    for (let i = 0; i < 18; i++) {
      const p = onTop(rng.next() * 1.8 - 0.9, rng.next() * 1.8 - 0.9);
      s += cacaoNib(p.x, p.y - 3, 2.2 + rng.next() * 1.4, rng);
    }
  }
  return s;
}

function topOnCup(top) {
  let s = '';
  top.filter((id) => SAUCE[id]).forEach((id, k) => { s += sauceDrizzle(id, k); });
  for (const id of top) if (!SAUCE[id] && id !== 'mint') s += sprinkleOnCup(id);
  if (top.includes('mint')) {
    const p = onTop(0.32, -0.25);
    s += mintSprig(p.x, p.y - 4, 0.95);
  }
  return s;
}

function cupPrint() {
  // the café's logo printed in white on the cup: three açaí berries under a palm leaf
  const y = 132;
  const leafD = 'M0 0C4 -7 12 -9 19 -6C14 -1 7 2 0 0Z';
  return g('', path(leafD, WHITE, tf(`translate(${f(97)} ${f(y - 22)}) rotate(-24)`) + op(0.88)) +
    circle(95, y - 17, 3.6, WHITE, op(0.88)) + circle(103.5, y - 17.5, 3.6, WHITE, op(0.88)) + circle(99, y - 23, 3.4, WHITE, op(0.88)) +
    `<text x="100" y="${y}" text-anchor="middle" font-family="'Lilita One', 'Trebuchet MS', sans-serif" font-size="15" letter-spacing="1" fill="#ffffff" opacity="0.88">AÇAÍ</text>` +
    `<text x="100" y="${y + 14}" text-anchor="middle" font-family="'Lilita One', 'Trebuchet MS', sans-serif" font-size="11" letter-spacing="2.4" fill="#ffffff" opacity="0.88">FEVER</text>`);
}

function droplets(rng, n) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const y = 74 + rng.next() * 100;
    const side = rng.next() < 0.5 ? -1 : 1;
    const x = 100 + side * (halfAt(y) - 5 - rng.next() * 18);
    const r = 0.9 + rng.next() * 1.3;
    s += circle(x, y, r, WHITE, op(0.6)) + circle(x + r * 0.3, y + r * 0.35, r * 0.55, '#000000', op(0.12));
  }
  return s;
}

function cupBody(bowl) {
  const b = bowl || {};
  const base = ING[b.base]?.layer === 'base' ? b.base : null;
  const mid = (b.mid || []).filter((id) => ING[id]);
  const top = (b.top || []).filter((id) => ING[id]);
  let s = softShadow(104, 186, 58, 13);
  // far wall and the inside of the empty cup
  s += path(CUP_BODY, paint('plastic-in', '#eaf6fa'));
  if (!base) {
    s += ellipse(BOT.cx, BOT.cy - 2, BOT.rx - WALL, BOT.ry - 2.5, '#dcecf1', op(0.8));
    s += ellipse(BOT.cx, BOT.cy - 2, BOT.rx - WALL, BOT.ry - 2.5, 'none', stroke(1.2, '#a9c6d1') + op(0.8));
  } else {
    s += pureeInCup(base);
  }
  // back half of the rim (behind everything piled on top)
  s += path(`M${RIM.cx - RIM.rx} ${RIM.cy}A${RIM.rx} ${RIM.ry} 0 0 1 ${RIM.cx + RIM.rx} ${RIM.cy}`, 'none', stroke(3.2, '#f4fbfd') + op(0.95));
  s += path(`M${RIM.cx - RIM.rx + 3} ${RIM.cy + 1}A${RIM.rx - 3} ${RIM.ry - 2} 0 0 1 ${RIM.cx + RIM.rx - 3} ${RIM.cy + 1}`, 'none', stroke(1, '#9ab9c5') + op(0.6));
  if (base) {
    s += midBands(mid);
    top.filter((id) => SAUCE[id]).forEach((id, k) => { s += sauceRuns(id, k); });
    s += midOnCup(mid) + topOnCup(top);
  }
  // front wall: clear plastic with bright edges, highlights and the print
  s += path(CUP_FRONT, paint('plastic', '#ffffff'), op(0.95));
  if (base) s += droplets(rngFor(`drops-${base}`), 9);
  s += line(`M${f(RIM.cx - RIM.rx + 9)} ${RIM.cy + 14}L${f(BOT.cx - BOT.rx + 7)} ${BOT.cy - 6}`, WHITE, 4.5, op(0.55));
  s += line(`M${f(RIM.cx - RIM.rx + 18)} ${RIM.cy + 18}L${f(BOT.cx - BOT.rx + 14)} ${BOT.cy - 30}`, WHITE, 1.6, op(0.45));
  s += line(`M${f(RIM.cx + RIM.rx - 7)} ${RIM.cy + 12}L${f(BOT.cx + BOT.rx - 5)} ${BOT.cy - 8}`, WHITE, 2, op(0.5));
  s += cupPrint();
  // base ring and the rolled lip in front
  s += path(`M${BOT.cx - BOT.rx} ${BOT.cy}A${BOT.rx} ${BOT.ry} 0 0 0 ${BOT.cx + BOT.rx} ${BOT.cy}`, 'none', stroke(3, '#ffffff') + op(0.7));
  s += path(`M${BOT.cx - BOT.rx + 2} ${BOT.cy - 5}A${BOT.rx - 2} ${BOT.ry - 2} 0 0 0 ${BOT.cx + BOT.rx - 2} ${BOT.cy - 5}`, 'none', stroke(1, '#9ab9c5') + op(0.55));
  s += path(CUP_BODY, 'none', stroke(1.1, '#8fb0bd') + op(0.55));
  s += path(`M${RIM.cx - RIM.rx} ${RIM.cy}A${RIM.rx} ${RIM.ry} 0 0 0 ${RIM.cx + RIM.rx} ${RIM.cy}`, 'none', stroke(3.6, '#ffffff') + op(0.95));
  s += path(`M${RIM.cx - RIM.rx} ${RIM.cy + 1.8}A${RIM.rx} ${RIM.ry} 0 0 0 ${RIM.cx + RIM.rx} ${RIM.cy + 1.8}`, 'none', stroke(0.9, '#8fb0bd') + op(0.7));
  return s;
}

export function bowlSVG(bowl, size = 150) {
  const b = bowl || {};
  return memo(`b|${b.base}|${(b.mid || []).join()}|${(b.top || []).join()}|${size}`, () => svgWrap(size, size, 200, 200, cupBody(b)));
}

// the cup drawing without its <svg> wrapper (logo, menu board)
export { cupBody as cupArt };
// the drawing of an ingredient icon (viewBox 100×100) without its <svg> wrapper (stock under the counter)
export { iconBody as ingredientArt };

// ======================================================================
// Ingredient icons (viewBox 100×100): bubbles, chips, shop cards, drag ghosts
// ======================================================================
function longLeaf(x, y, len, wid, deg, col) {
  const d = `M0 0C${f(len * 0.25)} ${f(-wid)} ${f(len * 0.7)} ${f(-wid * 0.8)} ${f(len)} 0C${f(len * 0.7)} ${f(wid * 0.8)} ${f(len * 0.25)} ${f(wid)} 0 0Z`;
  return g(`translate(${f(x)} ${f(y)}) rotate(${f(deg)})`,
    path(d, col, stroke(1.2, edge(col, 0.35))) + path(d, paint('sph-soft')) +
    line(`M${f(len * 0.06)} 0Q${f(len * 0.5)} ${f(-wid * 0.12)} ${f(len * 0.9)} 0`, lighten(col, 0.35), 1.3, op(0.8)));
}

function acaiBerry(x, y, r) {
  return circle(x, y, r, '#34113f', stroke(1.2, '#170619')) + circle(x - r * 0.1, y - r * 0.1, r * 0.82, '#6a3a80', op(0.25)) +
    litCircle(x, y, r, 'sph') + circle(x + r * 0.05, y - r * 0.72, r * 0.18, '#1d0a22') + circle(x - r * 0.38, y - r * 0.36, r * 0.18, WHITE, op(0.75));
}

function squeezeBottle(x, y, w, h, body, label, cap, labelText = '') {
  const d = `M${f(x - w / 2)} ${f(y - h * 0.62)}Q${f(x - w / 2)} ${f(y - h * 0.72)} ${f(x - w * 0.3)} ${f(y - h * 0.74)}H${f(x + w * 0.3)}Q${f(x + w / 2)} ${f(y - h * 0.72)} ${f(x + w / 2)} ${f(y - h * 0.62)}V${f(y - h * 0.06)}Q${f(x + w / 2)} ${f(y)} ${f(x + w * 0.4)} ${f(y)}H${f(x - w * 0.4)}Q${f(x - w / 2)} ${f(y)} ${f(x - w / 2)} ${f(y - h * 0.06)}Z`;
  let s = path(d, body, stroke(1.2, edge(body, 0.4))) + path(d, paint('cyl'));
  s += rect(x - w / 2, y - h * 0.5, w, h * 0.3, 0, label) + rect(x - w / 2, y - h * 0.5, w, h * 0.3, 0, paint('cyl-soft'));
  if (labelText) s += labelText;
  // cap + nozzle
  s += path(`M${f(x - w * 0.34)} ${f(y - h * 0.74)}V${f(y - h * 0.86)}Q${f(x)} ${f(y - h * 0.9)} ${f(x + w * 0.34)} ${f(y - h * 0.86)}V${f(y - h * 0.74)}Z`, cap, stroke(1, edge(cap, 0.4)));
  s += path(`M${f(x - w * 0.09)} ${f(y - h * 0.87)}L${f(x - w * 0.05)} ${f(y - h)}H${f(x + w * 0.05)}L${f(x + w * 0.09)} ${f(y - h * 0.87)}Z`, cap, stroke(1, edge(cap, 0.4)));
  s += path(`M${f(x - w * 0.34)} ${f(y - h * 0.74)}V${f(y - h * 0.86)}Q${f(x)} ${f(y - h * 0.9)} ${f(x + w * 0.34)} ${f(y - h * 0.86)}V${f(y - h * 0.74)}Z`, paint('cyl'));
  s += line(`M${f(x - w * 0.3)} ${f(y - h * 0.6)}V${f(y - h * 0.1)}`, WHITE, w * 0.08, op(0.5));
  return s;
}

function glassJar(x, y, w, h, fill, lid, inner = '') {
  const body = rrect(x - w / 2, y - h, w, h, w * 0.18);
  let s = path(body, '#eef7f9', stroke(1.2, '#9fb6bf'));
  s += path(rrect(x - w / 2 + 2.5, y - h * 0.78, w - 5, h * 0.78 - 2.5, w * 0.15), fill) + inner;
  s += path(body, paint('glass'));
  s += line(`M${f(x - w * 0.3)} ${f(y - h * 0.8)}V${f(y - h * 0.18)}`, WHITE, w * 0.08, op(0.65));
  s += path(rrect(x - w / 2 - 2, y - h - 8, w + 4, 11, 3), lid, stroke(1.1, edge(lid, 0.4))) + path(rrect(x - w / 2 - 2, y - h - 8, w + 4, 11, 3), paint('cyl'));
  return s;
}

function peanutPod(x, y, s, deg) {
  const d = `M${f(-s)} 0C${f(-s)} ${f(-s * 0.7)} ${f(-s * 0.35)} ${f(-s * 0.75)} 0 ${f(-s * 0.42)}C${f(s * 0.35)} ${f(-s * 0.75)} ${f(s)} ${f(-s * 0.7)} ${f(s)} 0C${f(s)} ${f(s * 0.7)} ${f(s * 0.35)} ${f(s * 0.75)} 0 ${f(s * 0.42)}C${f(-s * 0.35)} ${f(s * 0.75)} ${f(-s)} ${f(s * 0.7)} ${f(-s)} 0Z`;
  let dots = '';
  for (const [a, b] of [[-0.55, -0.15], [-0.4, 0.25], [0.45, -0.2], [0.6, 0.2], [0.15, 0.05], [-0.15, -0.25]]) dots += circle(a * s, b * s, Math.max(0.5, s * 0.06), '#b98547', op(0.7));
  return g(`translate(${f(x)} ${f(y)}) rotate(${f(deg)})`, path(d, '#e2b277', stroke(1.1, '#a87a44')) + dots + path(d, paint('sph-soft')));
}

const ICONS = {
  acai() {
    let s = softShadow(50, 91, 36, 6);
    s += longLeaf(48, 64, 46, 10, -150, '#2c8a48') + longLeaf(52, 64, 46, 10, -30, '#37a257') + longLeaf(50, 60, 34, 8, -92, '#2f944e');
    s += line('M50 52Q51 40 58 32', '#6b4425', 2.6);
    for (const [x, y, r] of [[50, 50, 11], [37, 62, 12], [63, 62, 12], [26, 77, 11.5], [50, 76, 12.5], [74, 77, 11.5]]) s += acaiBerry(x, y, r);
    return s;
  },

  pitaya() {
    let s = softShadow(50, 90, 38, 6);
    // scales around the half fruit
    for (const [x, y, deg] of [[16, 62, 200], [84, 62, -20], [24, 80, 150], [76, 80, 30], [50, 88, 90]]) {
      s += g(`translate(${x} ${y}) rotate(${deg})`, path('M0 -5C8 -6 16 -3 20 0C16 3 8 6 0 5Z', '#ef4f8f', stroke(1, '#a8124f')) + path('M12 -3C16 -2 19 -1 20 0C18 1 15 2 12 3Z', '#8fc33a'));
    }
    const body = 'M14 52C14 76 32 90 50 90C68 90 86 76 86 52Z';
    s += path(body, '#e8347f', stroke(1.3, '#9c0f47')) + path(body, paint('down-dark'));
    s += ellipse(50, 52, 36, 15, '#f9d6e6', stroke(1.2, '#c0155a'));
    s += ellipse(50, 52.5, 32, 12.5, '#d81f6e');
    const rng = rngFor('pitaya-seeds');
    for (let i = 0; i < 46; i++) {
      const a = rng.next() * Math.PI * 2;
      const r = Math.sqrt(rng.next());
      s += ellipse(50 + Math.cos(a) * r * 28, 52.5 + Math.sin(a) * r * 10.5, 0.9, 0.6, '#1a0610');
    }
    s += litEllipse(50, 52.5, 32, 12.5, 'sph-soft') + ellipse(38, 48, 10, 2.6, WHITE, op(0.45));
    return s;
  },

  spirulina() {
    let s = softShadow(50, 90, 38, 6);
    // wooden scoop with a heap of blue powder
    s += path('M60 66L94 52Q97 51 98 54Q99 57 96 58L64 74Z', '#d9a25e', stroke(1.2, '#8f5f2a')) + line('M66 67L94 55', '#f2c98f', 1.4, op(0.8));
    s += ellipse(42, 70, 32, 16, '#c88a45', stroke(1.3, '#7e5022')) + ellipse(42, 68, 28, 12, '#a86d32');
    const heap = 'M16 68C18 50 30 40 42 40C54 40 66 50 68 68C60 74 24 74 16 68Z';
    s += path(heap, '#1d97d6', stroke(1.2, '#0b5f8f')) + path(heap, paint('sph'));
    const rng = rngFor('spirulina-dust');
    for (let i = 0; i < 26; i++) s += circle(18 + rng.next() * 48, 44 + rng.next() * 26, 0.7 + rng.next() * 0.9, i % 3 ? '#7fd3f5' : '#0b6fa8', op(0.8));
    s += ellipse(34, 48, 7, 3, WHITE, op(0.5) + tf('rotate(-25 34 48)'));
    for (const [x, y] of [[12, 84], [76, 86], [84, 80], [20, 90]]) s += circle(x, y, 1.6, '#1d97d6', op(0.8));
    return s;
  },

  banana() {
    let s = softShadow(52, 88, 38, 6);
    const body = 'M14 42C16 74 52 92 86 62C90 58 92 50 88 46C76 64 40 70 22 40C20 36 14 36 14 42Z';
    const under = 'M14 42C16 74 52 92 86 62C80 72 50 84 26 64C18 56 15 50 14 42Z';
    s += path(body, '#f6d23a', stroke(1.4, '#b88a12')) + path(under, '#e2a91a', op(0.9)) + path(body, paint('sph-soft'));
    s += line('M24 46C36 64 64 68 84 52', '#fff3a6', 2.4, op(0.75));
    s += line('M20 50C30 70 60 78 84 60', '#c9901a', 1, op(0.6));
    s += path('M86 47L94 38Q96 36 94 34L91 33Q89 33 88 36L84 46Z', '#7c8f2b', stroke(1.1, '#4d5a17'));
    s += ellipse(14.5, 41, 3, 3.6, '#4a3418');
    return s;
  },

  granola() {
    let s = softShadow(50, 90, 40, 7);
    const rng = rngFor('granola-icon');
    const pts = [[50, 42, 11], [35, 54, 12], [64, 53, 12], [22, 70, 11], [48, 68, 13], [76, 69, 11.5], [34, 82, 11], [62, 82, 12], [50, 56, 9]];
    for (const [x, y, r] of pts.sort((a, b) => a[1] - b[1])) s += granolaCluster(x, y, r, rng);
    return s;
  },

  strawberry() {
    let s = softShadow(50, 91, 32, 6);
    const body = 'M50 92C30 88 14 66 18 46C21 34 34 30 50 34C66 30 79 34 82 46C86 66 70 88 50 92Z';
    s += path(body, '#e1223a', stroke(1.4, '#8f0f1f')) + path(body, paint('sph'));
    const rng = rngFor('strawberry-seeds');
    for (const [x, y] of [[33, 48], [47, 46], [62, 47], [27, 60], [41, 59], [56, 60], [70, 59], [33, 72], [48, 73], [63, 71], [42, 84], [56, 84], [75, 52], [24, 52]]) {
      const dx = (rng.next() - 0.5) * 2;
      s += ellipse(x + dx, y, 1.8, 2.4, '#b3101f', op(0.6)) + ellipse(x + dx, y - 0.4, 1.1, 1.7, '#ffe08a');
    }
    s += ellipse(32, 50, 6, 10, WHITE, op(0.4) + tf('rotate(30 32 50)'));
    for (const deg of [200, 160, 115, 65, 20, -20]) s += longLeaf(50, 36, 17, 5.6, deg, '#2f9b45');
    s += line('M50 34Q50 22 56 16', '#3b7d2a', 3);
    return s;
  },

  blueberry() {
    let s = softShadow(50, 90, 36, 6);
    return s + blueberry(50, 42, 17) + blueberry(31, 66, 18) + blueberry(69, 67, 18);
  },

  mango() {
    let s = softShadow(56, 88, 38, 6);
    const body = 'M62 14C84 14 96 36 90 56C84 76 62 82 48 76C32 70 30 52 38 36C44 22 50 14 62 14Z';
    s += path(body, '#ffb21e', stroke(1.4, '#b56a00'));
    s += path('M62 14C80 14 92 28 92 42C82 32 70 26 56 24C52 20 56 15 62 14Z', '#ff5f3d', op(0.75));
    s += ellipse(48, 32, 9, 5, '#a8c63a', op(0.6) + tf('rotate(-40 48 32)'));
    s += path(body, paint('sph'));
    s += line('M62 15L64 7', '#6b4425', 2.6) + longLeaf(64, 9, 26, 7, -12, '#3a9a4c');
    s += mangoCube(24, 74, 10, rngFor('mango-a')) + mangoCube(46, 84, 9, rngFor('mango-b'));
    return s;
  },

  kiwi() {
    let s = softShadow(52, 90, 38, 6);
    // whole kiwi behind
    s += ellipse(66, 52, 26, 30, '#8a6a3c', stroke(1.3, '#4f3a1d') + tf('rotate(20 66 52)'));
    const rng = rngFor('kiwi-fuzz');
    for (let i = 0; i < 30; i++) {
      const a = rng.next() * Math.PI * 2;
      const r = Math.sqrt(rng.next()) * 22;
      s += circle(66 + Math.cos(a) * r, 52 + Math.sin(a) * r * 1.1, 0.8, '#5f4524', op(0.6));
    }
    s += ellipse(66, 52, 26, 30, paint('sph'), tf('rotate(20 66 52)'));
    // cut half in front
    s += kiwiSlice(38, 64, 30, rngFor('kiwi-icon'), 0.92);
    return s;
  },

  honey() {
    let s = softShadow(50, 91, 34, 6);
    s += glassJar(46, 90, 50, 52, '#f2a81d', '#d79a3c',
      path('M24 50Q46 56 68 50V54Q46 60 24 54Z', '#ffd36b', op(0.7)) + ellipse(46, 66, 11, 7, '#fff4cf', op(0.85)) +
      path(polyPath([[46, 61], [50.5, 63.5], [50.5, 68.5], [46, 71], [41.5, 68.5], [41.5, 63.5]]), '#f2a81d', stroke(0.9, '#b8740c')));
    // honey dipper
    s += line('M62 30L86 6', '#a8743a', 4.2) + line('M62 30L86 6', '#d9a25e', 2.6);
    s += g('rotate(-45 62 32)', path(rrect(52, 26, 20, 13, 6), '#d9a25e', stroke(1.1, '#8f5f2a')) + line('M56 28V37M61 27V38M66 28V37', '#a8743a', 1.4) + path(rrect(52, 26, 20, 13, 6), paint('cyl-soft')));
    s += path('M56 40C56 46 52 48 52 52A4 4 0 0 0 60 52C60 48 56 46 56 40Z', '#f2a81d', stroke(0.9, '#b8740c')) + circle(54.5, 51, 1.2, WHITE, op(0.8));
    return s;
  },

  coconut() {
    let s = softShadow(50, 90, 40, 7);
    const shell = 'M12 50C12 78 30 90 50 90C70 90 88 78 88 50Z';
    s += path(shell, '#6e4423', stroke(1.4, '#3a2210'));
    const rng = rngFor('coconut-fibre');
    let fib = '';
    for (let i = 0; i < 22; i++) {
      const x = 18 + rng.next() * 64;
      const y = 56 + rng.next() * 30;
      fib += `M${f(x)} ${f(y)}l${f(3 + rng.next() * 4)} ${f(rng.next() * 3 - 1)}`;
    }
    s += line(fib, '#9a6a3c', 1.1, op(0.7)) + path(shell, paint('sph-soft'));
    s += ellipse(50, 50, 38, 15, '#fffaf0', stroke(1.2, '#c9bba0'));
    s += ellipse(50, 51.5, 30, 10.5, '#ede2cc') + path('M20 51.5A30 10.5 0 0 1 80 51.5A30 6 0 0 0 20 51.5Z', '#d8c9ac');
    s += ellipse(40, 47, 12, 2.4, WHITE, op(0.6));
    s += coconutFlake(18, 86, 6, rngFor('cf1')) + coconutFlake(32, 92, 5, rngFor('cf2')) + coconutFlake(84, 88, 5.5, rngFor('cf3'));
    return s;
  },

  chia() {
    let s = softShadow(50, 90, 38, 6);
    const bowl = 'M14 58Q16 88 50 88Q84 88 86 58Z';
    s += path(bowl, '#f7f4ef', stroke(1.3, '#b8b0a4')) + path(bowl, paint('cyl-soft')) + line('M22 66Q32 80 48 82', WHITE, 2.4, op(0.8));
    const heap = 'M16 59C22 36 78 36 84 59A34 8 0 0 1 16 59Z';
    s += path(heap, '#5a5752', stroke(1.1, '#2c2a27'));
    const rng = rngFor('chia-icon');
    const pts = [];
    for (let i = 0; i < 80; i++) {
      const x = 20 + rng.next() * 60;
      const topY = 58 - 19 * (1 - ((x - 50) / 32) ** 2);
      pts.push([x, topY + 1.5 + rng.next() * Math.max(1, 58 - topY)]);
    }
    s += chiaSeeds(pts, rng, 2, 1.1);
    s += path(heap, paint('sph-soft'));
    for (const [x, y] of [[10, 92], [90, 90], [84, 94], [16, 95]]) s += ellipse(x, y, 1.6, 1.1, '#3a3a3a');
    return s;
  },

  peanut() {
    let s = softShadow(48, 91, 36, 6);
    s += glassJar(44, 90, 50, 54, '#c5853f', '#d6402f',
      path('M21 52Q34 46 44 52Q54 58 67 50', 'none', stroke(2.4, '#e2ae6f')) + rect(19, 62, 50, 18, 2, '#fff8e8', op(0.95)) +
      peanutPod(44, 71, 7, -12));
    s += peanutPod(78, 84, 9, -28) + peanutPod(84, 70, 7.5, 40);
    return s;
  },

  chocolate() {
    let s = softShadow(50, 91, 32, 6);
    s += squeezeBottle(46, 90, 34, 76, '#4a2312', '#f3e6d6', '#2a1007',
      ellipse(46, 63, 9, 6, '#4a2312') + circle(43, 61.5, 1.8, '#a0674a', op(0.9)));
    // a drop and a little puddle
    s += ellipse(76, 88, 13, 4, '#4a2312', stroke(0.9, '#2a1007')) + ellipse(72, 87, 5, 1.2, '#a0674a', op(0.7));
    s += path('M76 60C80 68 83 72 83 76A7 7 0 0 1 69 76C69 72 72 68 76 60Z', '#4a2312', stroke(0.9, '#2a1007')) + ellipse(73.5, 75, 1.6, 3, '#a0674a', op(0.8));
    return s;
  },

  mint() {
    let s = softShadow(50, 90, 30, 6);
    s += line('M50 92Q48 80 50 66', '#2c7a3a', 3.4);
    s += mintLeaf(49, 76, 38, 15, -152) + mintLeaf(51, 76, 38, 15, -28) + mintLeaf(50, 66, 34, 13, -120) + mintLeaf(50, 66, 34, 13, -60) + mintLeaf(50, 58, 28, 11, -90);
    return s;
  },

  cacao() {
    let s = softShadow(50, 90, 38, 6);
    const pod = 'M50 8C68 12 76 34 72 54C68 70 58 78 50 80C42 78 32 70 28 54C24 34 32 12 50 8Z';
    s += g('rotate(-30 50 44)', path(pod, '#d9822b', stroke(1.3, '#7a3f0c')) +
      line('M50 11C43 30 43 60 50 77M50 11C57 30 57 60 50 77M42 13C31 30 31 60 42 74M58 13C69 30 69 60 58 74', '#9c5214', 1.4, op(0.7)) +
      path(pod, paint('sph')));
    const rng = rngFor('cacao-icon');
    for (const [x, y, r] of [[30, 82, 7], [44, 86, 8], [58, 84, 7.5], [70, 88, 6.5], [38, 76, 6], [52, 76, 6.5], [64, 78, 6]]) s += cacaoNib(x, y, r, rng);
    return s;
  },
};

function unknownIcon() {
  return circle(50, 50, 32, '#d8cde0', stroke(1.5, '#8e7aa0'));
}

function iconBody(id) {
  return ING[id] && ICONS[id] ? ICONS[id]() : unknownIcon();
}

export function ingredientIcon(id, size = 64) {
  return memo(`i|${id}|${size}`, () => svgWrap(size, size, 100, 100, iconBody(id)));
}

// ======================================================================
// Ingredient bowls on the counter (viewBox 100×72): white stoneware with a brown rim, seen from
// above at an angle like everything on the counter, heaped with the ingredient; the sauces fill
// their bowl and keep a dipper or a spoon in it
// ======================================================================
const BWL = { cx: 50, cy: 30, rx: 46, ry: 15, foot: 61, frx: 22, fry: 4.6 };
const BWL_L = BWL.cx - BWL.rx;
const BWL_R = BWL.cx + BWL.rx;
const BOWL_WALL = `M${BWL_L} ${BWL.cy}C${BWL_L} ${BWL.cy + 18} ${BWL.cx - BWL.frx - 13} ${BWL.foot} ${BWL.cx - BWL.frx} ${BWL.foot}` +
  `A${BWL.frx} ${BWL.fry} 0 0 0 ${BWL.cx + BWL.frx} ${BWL.foot}C${BWL.cx + BWL.frx + 13} ${BWL.foot} ${BWL_R} ${BWL.cy + 18} ${BWL_R} ${BWL.cy}` +
  `A${BWL.rx} ${BWL.ry} 0 0 1 ${BWL_L} ${BWL.cy}Z`;
const RIM_BACK = `M${BWL_L} ${BWL.cy}A${BWL.rx} ${BWL.ry} 0 0 1 ${BWL_R} ${BWL.cy}`;
const RIM_FRONT = `M${BWL_L} ${BWL.cy}A${BWL.rx} ${BWL.ry} 0 0 0 ${BWL_R} ${BWL.cy}`;
const BOWL_RIM = '#86614a';
registerDefs(`<clipPath id="af-clip-bowl"><path d="${BOWL_WALL}"/></clipPath>`);

// A point of the heap: (u, v) across / back → front inside the rim, raised into a dome of height H.
function heapAt(u, v, H) {
  const h = H * Math.max(0, 1 - u * u - v * v) ** 0.6;
  return { x: BWL.cx + u * (BWL.rx - 5), y: BWL.cy + v * (BWL.ry - 2.5) - h };
}

// The heap as seen from the front: its highest point for every u, closed along the front rim.
function heapOutline(H) {
  const pts = [[BWL_L + 1.5, BWL.cy + 0.5]];
  for (let i = 1; i < 12; i++) {
    const u = -1 + (2 * i) / 12;
    let y = Infinity;
    for (let k = 0; k <= 20; k++) {
      const v = -1 + k / 10;
      if (u * u + v * v <= 1) y = Math.min(y, heapAt(u, v, H).y);
    }
    pts.push([BWL.cx + u * (BWL.rx - 4), y - 1]);
  }
  pts.push([BWL_R - 1.5, BWL.cy + 0.5]);
  return `${smoothOpen(pts)}A${BWL.rx - 1.5} ${BWL.ry - 1} 0 0 1 ${BWL_L + 1.5} ${BWL.cy + 0.5}Z`;
}

const BOWL_FOOD = {
  banana: { bed: '#efd98f', piece: 8.6, draw: bananaSlice, cols: 6, rows: 4, H: 11 },
  granola: { bed: '#a96d2c', piece: 5.8, draw: granolaCluster, cols: 9, rows: 5, H: 12 },
  strawberry: { bed: '#c8172d', piece: 8, draw: strawberryHalf, cols: 6, rows: 4, H: 11 },
  blueberry: { bed: '#262b5c', piece: 4.7, draw: blueberry, cols: 11, rows: 6, H: 12 },
  mango: { bed: '#f08d0a', piece: 5.3, draw: mangoCube, cols: 9, rows: 5, H: 11 },
  kiwi: { bed: '#5e9a24', piece: 8.6, draw: kiwiSlice, cols: 6, rows: 4, H: 10 },
  coconut: { bed: '#e4d9c3', piece: 5.4, draw: coconutFlake, cols: 9, rows: 6, H: 11 },
  cacao: { bed: '#3a1d10', piece: 3.3, draw: cacaoNib, cols: 14, rows: 8, H: 10 },
};

function heapGrid(cols, rows, H, rng) {
  const pts = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let u = -1 + (2 * (c + 0.5 + (r % 2 ? 0.22 : -0.22))) / cols + (rng.next() - 0.5) * 0.08;
      let v = -1 + (2 * (r + 0.5)) / rows + (rng.next() - 0.5) * 0.12;
      const d = u * u + v * v;
      if (d > 0.92) {
        const k = Math.sqrt(0.92 / d);
        u *= k;
        v *= k;
      }
      pts.push(heapAt(u, v, H));
    }
  }
  return pts.sort((a, b) => a.y - b.y);
}

function foodHeap(id) {
  const spec = BOWL_FOOD[id];
  const rng = rngFor(`bowl-${id}`);
  const outline = heapOutline(spec.H);
  let s = path(outline, spec.bed) + path(outline, paint('sph-soft'));
  for (const p of heapGrid(spec.cols, spec.rows, spec.H, rng)) s += spec.draw(p.x, p.y, spec.piece * (0.88 + rng.next() * 0.24), rng);
  return s;
}

function chiaHeap() {
  const rng = rngFor('bowl-chia');
  const outline = heapOutline(10);
  let s = path(outline, '#55514b');
  const pts = [];
  for (let i = 0; i < 340; i++) {
    const a = rng.next() * Math.PI * 2;
    const r = Math.sqrt(rng.next()) * 0.97;
    const p = heapAt(Math.cos(a) * r, Math.sin(a) * r, 10);
    pts.push([p.x, p.y + 0.6]);
  }
  return s + chiaSeeds(pts, rng, 1.7, 0.95) + path(outline, paint('sph-soft'));
}

function mintHeap() {
  const rng = rngFor('bowl-mint');
  let s = path(heapOutline(9), '#2a6a34');
  for (const p of heapGrid(6, 3, 9, rng)) {
    const a = rng.next() * 360;
    s += mintLeaf(p.x - 5, p.y + 1, 13.5, 5.8, a) + mintLeaf(p.x + 1, p.y, 12, 5.2, a + 140 + rng.next() * 60);
  }
  return s;
}

const SAUCE_BOWL = {
  honey: { col: '#f2a21a', hi: '#ffe38f', dark: '#b8740c' },
  peanut: { col: '#c98b47', hi: '#eec58f', dark: '#8a5320' },
  chocolate: { col: '#4a2312', hi: '#a5705a', dark: '#24100a' },
};
const SAUCE_TOP = { cx: 50, cy: 31.5, rx: 41.5, ry: 12.4 };

// Wooden honey dipper (grooved head at hx, hy; handle up to the right), honey running off the head.
function honeyDipper(hx, hy, deg, col, hi, dark, coat = true) {
  let s = path(`M${hx + 4} ${hy - 1.8}L${hx + 42} ${hy - 2.6}Q${hx + 45} ${hy} ${hx + 42} ${hy + 2.6}L${hx + 4} ${hy + 1.8}Z`, '#d9a25e', stroke(1, '#8f5f2a'));
  s += line(`M${hx + 6} ${hy - 0.6}L${hx + 40} ${hy - 1.2}`, '#f2c98f', 1, op(0.8));
  s += path(rrect(hx - 9, hy - 7, 15, 14, 6), '#d9a25e', stroke(1, '#8f5f2a'));
  s += line(`M${hx - 5.5} ${hy - 6.6}V${hy + 6.6}M${hx - 1.5} ${hy - 6.8}V${hy + 6.8}M${hx + 2.5} ${hy - 6.6}V${hy + 6.6}`, '#a8743a', 1.3);
  s += path(rrect(hx - 9, hy - 7, 15, 14, 6), paint('cyl-soft'));
  if (coat) {
    const blob = `M${hx - 10} ${hy - 2}C${hx - 10} ${hy + 6} ${hx - 6} ${hy + 9} ${hx - 2} ${hy + 9}C${hx + 3} ${hy + 9} ${hx + 7} ${hy + 6} ${hx + 7} ${hy}C${hx + 4} ${hy + 3} ${hx - 6} ${hy + 3} ${hx - 10} ${hy - 2}Z`;
    s += path(blob, col, stroke(0.8, dark) + op(0.95)) + line(`M${hx - 7} ${hy + 3}Q${hx - 3} ${hy + 6} ${hx + 3} ${hy + 4}`, hi, 1.2, op(0.8));
  }
  return g(`rotate(${f(deg)} ${f(hx)} ${f(hy)})`, s);
}

function sauceInBowl(id) {
  const c = SAUCE_BOWL[id];
  const { cx, cy, rx, ry } = SAUCE_TOP;
  let s = ellipse(cx, cy - 1.4, rx + 1.4, ry + 0.8, c.dark, op(0.3)); // stain on the wall above the surface
  s += ellipse(cx, cy, rx, ry, c.col) + ellipse(cx, cy, rx, ry, paint('sph-soft'));
  if (id === 'peanut') {
    // spread with the spoon: soft ridges and a few peanut halves
    for (const [dy, k, col, w, o] of [[-6, 0.62, c.hi, 2, 0.75], [-1, 0.8, c.dark, 1.3, 0.4], [4, 0.66, c.hi, 1.8, 0.6], [8, 0.42, c.dark, 1.2, 0.35]]) {
      s += line(`M${f(cx - rx * k)} ${f(cy + dy + 2)}Q${cx} ${f(cy + dy - 5)} ${f(cx + rx * k)} ${f(cy + dy + 1)}`, col, w, op(o));
    }
    s += peanutPod(cx - 20, cy - 2, 4.2, -18) + peanutPod(cx + 2, cy + 5, 4, 24);
  } else {
    s += line(`M${cx - 24} ${cy + 2}C${cx - 20} ${cy - 6} ${cx + 6} ${cy - 8} ${cx + 15} ${cy - 2}C${cx + 21} ${cy + 3} ${cx + 3} ${cy + 7} ${cx - 3} ${cy + 3}`, c.hi, 1.7, op(id === 'honey' ? 0.75 : 0.5));
    if (id === 'honey') {
      for (const [x, y, r] of [[cx - 8, cy + 4, 1.3], [cx + 20, cy + 3, 1], [cx - 26, cy - 1, 0.9]]) s += circle(x, y, r, '#fff1c2', op(0.75));
    }
  }
  s += ellipse(cx - 17, cy - 5.5, 13, 2.4, WHITE, op(id === 'chocolate' ? 0.32 : 0.5) + tf(`rotate(-6 ${cx - 17} ${cy - 5.5})`));
  if (id === 'honey') {
    s += honeyDipper(cx + 4, cy + 1, -32, c.col, c.hi, c.dark);
  } else {
    // steel spoon: its bowl sunk in the sauce, the handle leaning on the back rim
    const h = 'M57 30L91 10Q95 8.4 96.4 11Q97.4 13.6 93.4 15.2L59.4 33.4Z';
    s += ellipse(57.4, 31.2, 5.6, 2.2, c.dark, op(0.5));
    s += path(h, paint('steel', '#cfd6dc'), stroke(0.9, '#5f6a75')) + line('M60 30.4L92 11.6', WHITE, 1, op(0.8));
    s += ellipse(57.4, 31.6, 4.2, 1.6, c.col) + ellipse(56, 31, 1.6, 0.6, c.hi, op(0.8));
  }
  return s;
}

function bowlShell(inner) {
  let s = softShadow(53, 63.5, 45, 7.5) + ellipse(BWL.cx, BWL.foot + 0.8, BWL.frx + 2, BWL.fry, '#000000', op(0.18));
  // inside: the far wall above the food, then the back half of the rim
  s += ellipse(BWL.cx, BWL.cy, BWL.rx, BWL.ry, '#f3f0ea') + ellipse(BWL.cx, BWL.cy + 4, BWL.rx - 8, BWL.ry - 5, '#5a4a3c', op(0.08));
  s += path(RIM_BACK, 'none', stroke(2.4, BOWL_RIM));
  s += inner;
  // outer wall: white glaze lit from the top left, speckles, an unglazed foot ring
  let wall = path(BOWL_WALL, '#fdfcf9') + path(BOWL_WALL, paint('cyl-soft'), op(0.8)) + path(BOWL_WALL, paint('down-dark'), op(0.22));
  const rng = rngFor('bowl-speckles');
  let dots = '';
  for (let i = 0; i < 34; i++) dots += `M${f(8 + rng.next() * 84)} ${f(BWL.cy + 2 + rng.next() * 30)}h0.01`;
  wall += line(dots, '#8c8378', 1, op(0.45));
  const foot = `M${BWL.cx - BWL.frx} ${BWL.foot - 2.4}A${BWL.frx} ${BWL.fry} 0 0 0 ${BWL.cx + BWL.frx} ${BWL.foot - 2.4}V${BWL.foot + 2}H${BWL.cx - BWL.frx}Z`;
  wall += path(foot, '#d9c3a3') + path(foot, paint('cyl-soft'));
  wall += line(`M${BWL_L + 6} ${BWL.cy + 8}C${BWL_L + 8} ${BWL.cy + 17} ${BWL_L + 14} ${BWL.cy + 25} ${BWL_L + 25} ${BWL.foot - 3}`, WHITE, 2.6, op(0.75));
  s += `<g clip-path="url(#af-clip-bowl)">${wall}</g>`;
  s += path(BOWL_WALL, 'none', stroke(0.9, '#a2988c'));
  // front half of the rim over the food, with the glaze catching the light
  s += path(RIM_FRONT, 'none', stroke(2.6, BOWL_RIM));
  s += path(`M${BWL_L + 2} ${BWL.cy - 0.6}A${BWL.rx - 2} ${BWL.ry - 1.2} 0 0 0 ${BWL_R - 2} ${BWL.cy - 0.6}`, 'none', stroke(0.9, '#fff6ea') + op(0.55));
  s += path(`M${BWL_L + 6} ${BWL.cy - 6}A${BWL.rx - 3} ${BWL.ry - 1.5} 0 0 1 ${BWL.cx - 10} ${BWL.cy - BWL.ry + 1.2}`, 'none', stroke(1, '#fff6ea') + op(0.55));
  return s;
}

export function binSVG(id, w = 84) {
  const h = Math.round((w * 72) / 100);
  return memo(`bin|${id}|${w}`, () => {
    let inner;
    if (SAUCE_BOWL[id]) inner = sauceInBowl(id);
    else if (id === 'chia') inner = chiaHeap();
    else if (id === 'mint') inner = mintHeap();
    else if (BOWL_FOOD[id]) inner = foodHeap(id);
    else inner = g('translate(30 2) scale(0.4)', iconBody(id));
    return svgWrap(w, h, 100, 72, bowlShell(inner));
  });
}

// ======================================================================
// Frozen fruit pack (viewBox 100×100): a frosty sachet like the real açaí packs
// ======================================================================
const PACK_COL = { acai: '#5a1f73', pitaya: '#e0266f', spirulina: '#1f86c6' };

export function packIcon(baseId, size = 72) {
  return memo(`p|${baseId}|${size}`, () => drawPack(ING[baseId]?.layer === 'base' ? baseId : 'acai', size));
}

function drawPack(id, size) {
  const col = PACK_COL[id] || ING[id].color;
  const body = 'M20 18H80Q86 50 83 84Q82 92 74 92H26Q18 92 17 84Q14 50 20 18Z';
  let s = softShadow(50, 93, 36, 5);
  let inner = path(body, paint('cyl'));
  // wrinkles of the soft foil
  inner += line('M24 40Q30 46 26 58M74 34Q70 44 76 52M30 76Q40 72 48 80M60 82Q66 74 74 78', '#ffffff', 1.2, op(0.28));
  inner += line('M26 44Q32 50 28 62M72 38Q68 48 74 56', '#000000', 1, op(0.18));
  // label with the fruit
  inner += path(rrect(27, 38, 46, 40, 9), '#fbf7f2', stroke(1, mix(col, '#000000', 0.25)));
  inner += g('translate(31 39) scale(0.38)', iconBody(id));
  inner += path(rrect(27, 38, 46, 40, 9), paint('sph-soft'));
  // frost
  inner += path('M17 78Q24 72 31 78Q39 84 47 78Q55 72 63 78Q71 84 79 77Q82 75 84 76L83 84Q82 92 74 92H26Q18 92 17 84Z', '#ffffff', op(0.55));
  const rng = rngFor(`frost-${id}`);
  for (let i = 0; i < 22; i++) inner += circle(20 + rng.next() * 60, 22 + rng.next() * 68, 0.5 + rng.next() * 1.2, '#ffffff', op(0.5 + rng.next() * 0.4));
  inner += line('M24 24Q20 52 23 84', '#ffffff', 3.2, op(0.45));
  let p = path(body, col, stroke(1.2, mix(col, '#000000', 0.45))) + inner;
  // crimped seal on top
  let zig = 'M18 26V12';
  for (let x = 18; x < 82; x += 4) zig += `L${f(x + 2)} 8L${f(x + 4)} 12`;
  zig += 'V26Z';
  p += path(zig, lighten(col, 0.25), stroke(1, mix(col, '#000000', 0.4))) + path(zig, paint('down'));
  let ridges = '';
  for (let x = 21; x < 80; x += 4) ridges += `M${x} 13V25`;
  p += line(ridges, mix(col, '#000000', 0.3), 0.8, op(0.5)) + path('M18 20H82', 'none', stroke(1.6, '#ffffff') + op(0.5));
  s += g('rotate(-4 50 55)', p);
  return svgWrap(size, size, 100, 100, s);
}

// ======================================================================
// Cup stack (viewBox 120×200) and the free spot on the counter (viewBox 200×200)
// ======================================================================
export function cupStackSVG(w = 90) {
  const h = Math.round((w * 200) / 120);
  return memo(`stack|${w}`, () => {
    const cx = 60;
    const rim = { rx: 44, ry: 13 };
    const bot = { y: 186, rx: 30, ry: 9.5 };
    const n = 7;
    const step = 9;
    const topY = 80 - (n - 1) * step; // rim of the top cup
    const lowRimY = 80;
    const wallX = (y) => rim.rx + ((y - lowRimY) / (bot.y - lowRimY)) * (bot.rx - rim.rx);
    const body = `M${cx - rim.rx} ${topY}V${lowRimY}L${f(cx - bot.rx)} ${bot.y}A${bot.rx} ${bot.ry} 0 0 0 ${f(cx + bot.rx)} ${bot.y}L${cx + rim.rx} ${lowRimY}V${topY}A${rim.rx} ${rim.ry} 0 0 0 ${cx - rim.rx} ${topY}Z`;
    let s = softShadow(62, 190, 46, 9);
    s += path(body, paint('plastic-in', '#eaf6fa'));
    s += ellipse(cx, bot.y - 2, bot.rx - 2, bot.ry - 2, '#dcecf1', op(0.8));
    // the top cup's opening
    s += ellipse(cx, topY, rim.rx - 2, rim.ry - 2, '#f2fafc', op(0.7));
    s += path(`M${cx - rim.rx + 3} ${topY + 1}A${rim.rx - 3} ${rim.ry - 2} 0 0 1 ${cx + rim.rx - 3} ${topY + 1}`, 'none', stroke(1, '#9ab9c5') + op(0.6));
    s += path(body, paint('plastic', '#ffffff'));
    // a rim for every nested cup
    for (let i = 0; i < n; i++) {
      const y = topY + i * step;
      s += path(`M${cx - rim.rx} ${y}A${rim.rx} ${rim.ry} 0 0 0 ${cx + rim.rx} ${y}`, 'none', stroke(i === 0 ? 3.2 : 2.4, '#ffffff') + op(i === 0 ? 0.95 : 0.85));
      s += path(`M${cx - rim.rx + 1} ${y + 1.6}A${rim.rx - 1} ${rim.ry} 0 0 0 ${cx + rim.rx - 1} ${y + 1.6}`, 'none', stroke(0.8, '#88a9b6') + op(0.7));
    }
    s += path(`M${cx - rim.rx} ${topY}A${rim.rx} ${rim.ry} 0 0 1 ${cx + rim.rx} ${topY}`, 'none', stroke(3, '#ffffff') + op(0.9));
    s += line(`M${cx - rim.rx + 7} ${lowRimY + 6}L${f(cx - bot.rx + 5)} ${bot.y - 8}`, WHITE, 3.4, op(0.5));
    s += line(`M${cx + rim.rx - 6} ${lowRimY + 6}L${f(cx + bot.rx - 4)} ${bot.y - 8}`, WHITE, 1.6, op(0.45));
    s += line(`M${cx - rim.rx + 3} ${topY + 4}V${lowRimY}`, WHITE, 2.4, op(0.5));
    s += path(body, 'none', stroke(1, '#8fb0bd') + op(0.6));
    s += path(`M${f(cx - bot.rx)} ${bot.y}A${bot.rx} ${bot.ry} 0 0 0 ${f(cx + bot.rx)} ${bot.y}`, 'none', stroke(2.6, '#ffffff') + op(0.7));
    void wallX;
    return svgWrap(w, h, 120, 200, s);
  });
}

// Where a cup goes: a round white coaster on the counter with a dashed outline of a cup on it.
export function cupSpotSVG(size = 150) {
  return memo(`spot|${size}`, () => {
    let s = softShadow(104, 186, 66, 14);
    s += path('M40 179V183A60 15 0 0 0 160 183V179Z', '#d6d0c7', stroke(1, '#a39a8f'));
    s += ellipse(100, 179, 60, 15, '#f8f6f2', stroke(1, '#a39a8f'));
    s += ellipse(100, 179, 47, 11, 'none', stroke(1.4, '#ddd6cc'));
    s += ellipse(84, 175, 30, 5, WHITE, op(0.8));
    // dashed cup outline: "a cup goes here"
    s += path(CUP_BODY, '#ffffff', op(0.16));
    s += path(CUP_BODY, 'none', stroke(2.4, '#8f877e') + op(0.55) + ' stroke-dasharray="7 7"');
    s += path(`M${RIM.cx - RIM.rx} ${RIM.cy}A${RIM.rx} ${RIM.ry} 0 0 0 ${RIM.cx + RIM.rx} ${RIM.cy}`, 'none', stroke(2.4, '#8f877e') + op(0.55) + ' stroke-dasharray="7 7"');
    return svgWrap(size, size, 200, 200, s);
  });
}

// ======================================================================
// Smoothie cup (viewBox 100×100); the cup's bottom sits at y = 96
// ======================================================================
const SMOOTHIE_COLORS = { banana: '#f8e27a', strawberry: '#f45d78', blueberry: '#7b5cc9', mango: '#ffb53b', kiwi: '#9dcc4a' };
const smoothieColor = (id) => SMOOTHIE_COLORS[id] || '#f58fb4';

function garnish(id, x, y) {
  const rng = rngFor(`garnish-${id}`);
  if (id === 'banana') return bananaSlice(x, y, 9, rng, 0.9);
  if (id === 'strawberry') return strawberryHalf(x, y, 9, rng);
  if (id === 'kiwi') return kiwiSlice(x, y, 9, rng, 0.9);
  if (id === 'mango') return mangoCube(x - 2, y + 2, 5.5, rng) + mangoCube(x + 6, y - 2, 5, rng);
  if (id === 'blueberry') return blueberry(x - 4, y + 1, 4.6) + blueberry(x + 5, y - 1, 4.6) + blueberry(x + 1, y - 6, 4.2);
  return '';
}

export function cupSVG(fruitId = null, state = 'ready', size = 70) {
  return memo(`c|${fruitId}|${state}|${size}`, () => drawSmoothieCup(fruitId, state, size));
}

function drawSmoothieCup(fruitId, state, size) {
  const col = smoothieColor(fruitId);
  const top = 36;
  const bot = 95;
  const xl = (y) => 22 + ((y - top) * 9) / (bot - top);
  const xr = (y) => 78 - ((y - top) * 9) / (bot - top);
  const body = `M22 ${top}L31 ${bot - 2}Q31.5 ${bot} 34 ${bot}H66Q68.5 ${bot} 69 ${bot - 2}L78 ${top}Z`;
  let s = softShadow(51, 96, 30, 4.5);
  s += path(body, paint('plastic-in', '#eaf6fa'));
  if (state !== 'empty') {
    const lvl = state === 'mixing' ? 70 : top + 3;
    const fill = `M${f(xl(lvl) + 2)} ${lvl}L${f(xl(bot - 2) + 2)} ${bot - 2.5}H${f(xr(bot - 2) - 2)}L${f(xr(lvl) - 2)} ${lvl}Z`;
    s += path(fill, col) + path(fill, paint('cyl'));
    s += ellipse(50, lvl, (xr(lvl) - xl(lvl)) / 2 - 2, 3.4, lighten(col, 0.25));
    if (state === 'mixing') {
      s += path(`M47 0H53L52.5 ${lvl}H47.5Z`, col) + path(`M47 0H53L52.5 ${lvl}H47.5Z`, paint('cyl'));
      s += ellipse(50, lvl, 6, 1.8, lighten(col, 0.4));
      for (const [x, y] of [[40, 80], [58, 86], [46, 90]]) s += circle(x, y, 1.4, WHITE, op(0.7));
    } else {
      let seeds = '';
      const rng = rngFor(`smoothie-${fruitId}`);
      for (let i = 0; i < 12; i++) seeds += circle(30 + rng.next() * 40, top + 10 + rng.next() * 46, 0.6 + rng.next() * 0.6, lighten(col, 0.4), op(0.6));
      s += seeds;
    }
  }
  s += path(body, paint('plastic', '#ffffff'));
  s += line(`M26 ${top + 6}L33 ${bot - 6}`, WHITE, 3.4, op(0.55)) + line(`M74 ${top + 6}L68 ${bot - 6}`, WHITE, 1.4, op(0.5));
  s += path(body, 'none', stroke(0.8, '#8fb0bd') + op(0.6));
  s += ellipse(50, top, 28, 5, 'none', stroke(2.2, '#ffffff') + op(0.95));
  if (state === 'ready') {
    // dome lid with a straw, fruit on the rim
    const dome = `M21 ${top}C21 ${top - 22} 79 ${top - 22} 79 ${top}Z`;
    s += path(dome, lighten(col, 0.2), op(0.85)) + path(dome, paint('plastic', '#ffffff'));
    s += path(`M21 ${top}C21 ${top - 22} 79 ${top - 22} 79 ${top}`, 'none', stroke(1, '#8fb0bd') + op(0.7));
    s += line(`M31 ${top - 6}Q38 ${top - 15} 50 ${top - 16}`, WHITE, 2.2, op(0.8));
    s += line(`M58 ${top - 10}L70 2`, '#c2185b', 5.6) + line(`M58 ${top - 10}L70 2`, '#ff6fa8', 4) + line(`M59.5 ${top - 12}L70.5 1`, '#ffffff', 1.2, op(0.6));
    s += ellipse(50, top, 29, 5.4, 'none', stroke(1.6, '#ffffff') + op(0.95));
    s += garnish(fruitId, 27, top - 6);
  }
  return svgWrap(size, size, 100, 100, s);
}

// ======================================================================
// What the player carries while dragging from a bowl (viewBox 100×100): a handful of pieces, a
// spoonful of seeds, nibs or sauce, a mint sprig, the honey dipper dripping honey
// ======================================================================
const HANDFUL = {
  banana: { n: 5, r: 22, size: 19 },
  strawberry: { n: 5, r: 21, size: 18 },
  blueberry: { n: 8, r: 20, size: 11 },
  mango: { n: 6, r: 20, size: 12 },
  kiwi: { n: 4, r: 21, size: 19 },
  granola: { n: 8, r: 22, size: 12 },
};

function spoon(body) {
  let s = softShadow(46, 82, 34, 6);
  s += path('M64 64L92 86Q95 89 92 92Q89 95 86 92L58 70Z', paint('steel', '#cfd6dc'), stroke(1, '#5f6a75'));
  s += ellipse(42, 58, 30, 18, paint('steel-v', '#cfd6dc'), stroke(1.2, '#5f6a75'));
  s += ellipse(42, 56, 26, 14, paint('steel-in', '#a9b2bb'));
  return s + body + line('M20 52Q30 44 44 43', WHITE, 1.6, op(0.6));
}

export function scoopSVG(id, size = 84) {
  return memo(`scoop|${id}|${size}`, () => {
    const rng = rngFor(`scoop-${id}`);
    let s = '';
    const hand = HANDFUL[id];
    if (hand) {
      s += softShadow(50, 84, 32, 6);
      const spec = PIECES[id];
      const pts = [];
      for (let i = 0; i < hand.n; i++) {
        const a = (i / hand.n) * Math.PI * 2 + rng.next() * 0.5;
        const r = i === 0 ? 0 : hand.r * (0.7 + rng.next() * 0.4);
        pts.push({ x: 50 + Math.cos(a) * r, y: 56 + Math.sin(a) * r * 0.62 - (i === 0 ? 10 : 0) });
      }
      pts.sort((p, q) => p.y - q.y);
      for (const p of pts) s += spec.draw(p.x, p.y, hand.size * (0.9 + rng.next() * 0.2), rng, 0.72);
    } else if (id === 'honey') {
      const c = SAUCE_BOWL.honey;
      // the dipper lifted out of the bowl, honey running off its head
      s += softShadow(34, 94, 20, 3.5);
      s += path('M22 76C23 82 21 86 22 89A4.6 4.6 0 0 0 31 89C31 85 27 82 28 76Z', c.col, stroke(0.9, c.dark)) + circle(24.6, 89.4, 1.3, WHITE, op(0.8));
      s += g('translate(28 66) scale(1.85) translate(-28 -66)', honeyDipper(28, 66, -38, c.col, c.hi, c.dark));
    } else if (SAUCE_BOWL[id]) {
      const c = SAUCE_BOWL[id];
      const heap = 'M18 56C20 40 34 33 46 35C58 36 67 44 66 56Q42 62 18 56Z';
      let body = path(heap, c.col, stroke(1, c.dark)) + path(heap, paint('sph-soft'));
      body += line('M24 50Q40 40 58 46M28 55Q44 47 62 52', c.hi, 1.6, op(id === 'peanut' ? 0.7 : 0.45));
      body += ellipse(34, 42, 8, 2.6, WHITE, op(0.5) + tf('rotate(-18 34 42)'));
      if (id === 'chocolate') body += path('M36 66C37 74 34 78 35 83A4.4 4.4 0 0 0 43.6 83C44 78 41 74 42 66Z', c.col, stroke(0.9, c.dark)) + circle(37.6, 83, 1.2, WHITE, op(0.6));
      else body += peanutPod(52, 44, 4.4, 20);
      s += spoon(body);
    } else if (id === 'mint') {
      s += softShadow(50, 86, 26, 5) + mintSprig(52, 72, 2.2);
    } else if (id === 'chia') {
      let seeds = path('M18 56C22 38 62 38 66 56Z', '#57534d');
      const pts = [];
      for (let i = 0; i < 80; i++) {
        const x = 20 + rng.next() * 44;
        const top = 56 - 15 * (1 - ((x - 42) / 24) ** 2);
        pts.push([x, top + 1 + rng.next() * Math.max(1, 56 - top)]);
      }
      seeds += chiaSeeds(pts, rng, 1.8, 1);
      s += spoon(seeds);
    } else if (id === 'cacao') {
      let nibs = '';
      for (let i = 0; i < 16; i++) nibs += cacaoNib(22 + rng.next() * 40, 44 + rng.next() * 12, 3.2 + rng.next() * 1.4, rng);
      s += spoon(nibs);
    } else if (id === 'coconut') {
      let flakes = '';
      for (let i = 0; i < 12; i++) flakes += coconutFlake(22 + rng.next() * 40, 44 + rng.next() * 12, 5 + rng.next() * 2, rng);
      s += spoon(flakes);
    } else {
      s += iconBody(id);
    }
    return svgWrap(size, size, 100, 100, s);
  });
}
