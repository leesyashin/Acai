// Food art for Açaí Fever: the clear plastic cup with its layers, toppings, ingredient icons, what
// lies in the ingredient containers (and the containers drawn without WebGL), frozen packs and
// the glasses of fruit matcha. Realistic, glossy look:
// shapes are filled with their colour and shaded with the shared gradients from svg.js
// (light from the top left), thin outlines in a darker shade of the fill. Pure module.

import { ING } from './data.js';
import {
  WHITE, f, rngFor, memo, mix, lighten, svgWrap, stroke, op, tf, circle, ellipse, path, rect, g, line,
  rrect, smoothClosed, smoothOpen, polyPath, paint, lit, litEllipse, litCircle, softShadow, edge,
} from './svg.js';
import { section } from './geo3d.js';
import { PANTRY_VIEW, PANTRY_ELEV, PANTRY_GEO, pantryPoint, pantryTop, pantryKind } from './pantry3d.js';

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

// Coconut chip heaped in the shell: a thin curled white shard, some with a sliver of brown skin.
function coconutChip(x, y, s, rng) {
  const rot = f(rng.next() * 360);
  const h = s * (0.42 + rng.next() * 0.2);
  const d = `M${f(-s)} ${f(h * 0.1)}C${f(-s * 0.5)} ${f(-h * 1.1)} ${f(s * 0.45)} ${f(-h * 1.2)} ${f(s)} ${f(-h * 0.15)}C${f(s * 0.55)} ${f(h * 0.55)} ${f(-s * 0.4)} ${f(h * 0.75)} ${f(-s)} ${f(h * 0.1)}Z`;
  const skin = rng.next() < 0.4 ? line(`M${f(-s * 0.8)} ${f(h * 0.35)}Q${f(-s * 0.1)} ${f(h * 0.85)} ${f(s * 0.75)} ${f(h * 0.2)}`, '#9a7650', Math.max(0.4, s * 0.12), op(0.8)) : '';
  return g(`translate(${f(x)} ${f(y)}) rotate(${rot})`,
    path(d, FOOD.coconut, stroke(Math.max(0.3, s * 0.07), '#cbbd9f')) + path(d, paint('sph-soft')) + skin +
    line(`M${f(-s * 0.6)} ${f(-h * 0.3)}Q0 ${f(-h * 0.85)} ${f(s * 0.6)} ${f(-h * 0.4)}`, WHITE, Math.max(0.3, s * 0.1), op(0.9)));
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

// Sauce colours: a zigzag drizzle over the top and runs down the inside of the wall; also the honey
// dipper and the spoonfuls a drag carries.
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

// ======================================================================
// Ingredient containers on the risers (viewBox 96×112 = PANTRY_VIEW of js/pantry3d.js, seen from
// above at PANTRY_ELEV like the 3D models): brushed stainless trays of fruit, a clip-top jar of
// granola, honey, chia and peanut butter in glass, a squeeze bottle of chocolate sauce, half a
// coconut of flakes, a walnut bowl of cacao nibs, mint on a board. With WebGL the containers are 3D
// pictures and binFillSVG() draws only what lies in or on them; binSVG() draws all of it (no WebGL).
// Both place every piece with pantryPoint(), so it lies where the 3D container is.
// ======================================================================
const PV = PANTRY_VIEW;
const pt = (x, y, z) => pantryPoint([x, y, z]);
const SIN_P = Math.sin(PANTRY_ELEV);
const TAU = Math.PI * 2;
const ryOf = (r) => r * SIN_P; // a horizontal circle of radius r is an ellipse r × ryOf(r)

// Screen points of a horizontal ring of radius r at height y around (x, z); its plan is the 3D
// lathe's cross-section (sq, depth). a0 → a1: 0 is the right end, π/2 the front.
function ringPts(r, y, { x = 0, z = 0, sq = 0, depth = 1, a0 = 0, a1 = TAU, n = 56 } = {}) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const [X, Z] = section(a, sq, depth);
    out.push(pt(x + X * r, y, z + Z * r));
  }
  return out;
}
const openPath = (pts) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}`;

// Evenly spread points over a dome of radius R and height H above (x, y, z) (sunflower spiral),
// back to front, so nearer pieces are drawn over farther ones.
function dome(n, R, H, x, y, z, rng, edge = 0.94) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const rr = Math.sqrt((i + 0.5) / n) * edge;
    const a = i * 2.39996 + (rng.next() - 0.5) * 0.4;
    const u = Math.cos(a) * rr;
    const v = Math.sin(a) * rr;
    const p = pt(x + u * R, y + H * Math.max(0, 1 - u * u - v * v) ** 0.7, z + v * R);
    out.push({ x: p[0], y: p[1], k: rr });
  }
  return out.sort((a, b) => a.y - b.y);
}
// A piece's small contact shadow, offset away from the light (top left).
const dropShadow = (x, y, rx, ry, o = 0.2) => ellipse(x + rx * 0.18, y + ry * 0.9, rx, ry, '#1d0f08', op(o));

// ---------------------------------------------------------------- what lies in or on a container
// Fruit fills its tray almost to the rim: a bed in the fruit's colour, the pieces neatly in rows
// (staggered like a deli counter), each with a little shadow.
const TRAY_FILL = {
  banana: { bed: '#e6cf86', draw: bananaSlice, s: 8.4, cols: 6, rows: 5 },
  strawberry: { bed: '#b0172c', draw: strawberryHalf, s: 7.8, cols: 6, rows: 5 },
  blueberry: { bed: '#1d2049', draw: blueberry, s: 4.4, cols: 10, rows: 7, top: 16 },
  mango: { bed: '#df7f08', draw: mangoCube, s: 4.7, cols: 8, rows: 6 },
  kiwi: { bed: '#557f20', draw: kiwiSlice, s: 8.4, cols: 6, rows: 5 },
};
const BED_Y = 17;

function trayFill(id) {
  const spec = TRAY_FILL[id];
  const T = pantryTop(id);
  const rng = rngFor(`tray-${id}`);
  const k = (BED_Y - T.floor) / (T.rim - T.floor);
  const hx = T.fx + (T.hx - T.fx) * k; // inside of the tray at the bed's height
  const hz = T.fz + (T.hz - T.fz) * k;
  const bed = polyPath(ringPts(hx - 0.4, BED_Y, { z: T.cz, sq: T.sq, depth: T.depth }));
  let s = path(bed, spec.bed) + path(bed, paint('sph-soft'), op(0.7));
  const pieces = [];
  const { s: size, cols, rows } = spec;
  const mx = size * 0.95;
  const dx = (2 * (hx - mx)) / (cols - 1);
  for (let r = 0; r < rows; r++) {
    const z = -hz + size * 0.75 + ((2 * hz - size * 1.3) * r) / (rows - 1);
    const off = r % 2 ? 0.5 : 0;
    for (let i = 0; i < cols - (off ? 1 : 0); i++) {
      const x = -hx + mx + (i + off) * dx + (rng.next() - 0.5) * dx * 0.22;
      pieces.push({ x, y: BED_Y + 0.6 + rng.next() * 0.8, z: z + (rng.next() - 0.5) * 2, s: size * (0.92 + rng.next() * 0.16) });
    }
  }
  // a second layer heaped in the middle (berries)
  for (let i = 0; i < (spec.top || 0); i++) {
    const a = rng.next() * TAU;
    const rr = Math.sqrt(rng.next()) * 0.62;
    pieces.push({ x: Math.cos(a) * rr * hx, y: BED_Y + size * 0.95, z: Math.sin(a) * rr * hz, s: size * (0.92 + rng.next() * 0.16) });
  }
  // every piece's footprint (about its size) stays inside the pan's rounded corners: the plan of the 3D
  // pan is |x / hx|^n + |z / hz|^n = 1 (see section()), a piece outside it is moved in toward the middle
  const n = 2 + 8 * T.sq;
  const inside = (p) => {
    const q = (Math.abs(p.x) / (hx - p.s)) ** n + (Math.abs(p.z) / (hz - p.s)) ** n;
    return q > 1 ? { ...p, x: p.x * q ** (-1 / n), z: p.z * q ** (-1 / n) } : p;
  };
  const placed = pieces.map(inside).map((p) => ({ ...p, at: pt(p.x, p.y, T.cz + p.z) })).sort((a, b) => a.at[1] - b.at[1]);
  for (const p of placed) {
    const [x, y] = p.at;
    s += dropShadow(x, y, p.s * 0.92, p.s * 0.34, 0.22) + spec.draw(x, y, p.s, rng, 0.62);
  }
  return s;
}

// Granola heaped up in the jar's mouth: a mound in the colour of the granola under the glass, toasted
// clusters on it (big enough that their oat flakes read, flattened by the view like the fruit pieces)
// and loose oat flakes, some over the rim.
const GRANOLA_BODY = '#a9692b'; // the 3D granola's colour (js/pantry3d.js MAT.granola)
function jarHeap(id) {
  const T = pantryTop(id);
  const rng = rngFor(`heap-${id}`);
  const R = T.r - 1.4;
  const c = pt(T.x, T.y - 0.6, T.z);
  const flat = (x, y, body) => g(`translate(${f(x)} ${f(y)}) scale(1 0.8) translate(${f(-x)} ${f(-y)})`, body);
  let s = ellipse(c[0], c[1], R + 0.6, ryOf(R + 0.6), GRANOLA_BODY) + ellipse(c[0], c[1], R + 0.6, ryOf(R + 0.6), paint('sph-soft'), op(0.6));
  for (const p of dome(13, R - 2.5, 5, T.x, T.y - 0.4, T.z, rng, 0.9)) {
    const size = 4.6 + rng.next() * 1.2;
    s += dropShadow(p.x, p.y, size * 0.9, size * 0.32, 0.2) + flat(p.x, p.y, granolaCluster(p.x, p.y, size, rng));
  }
  for (const p of dome(10, R + 1.5, 4, T.x, T.y, T.z, rng, 1)) {
    const a = rng.next() * 180;
    s += ellipse(p.x, p.y, 1.9, 0.95, '#e2c084', stroke(0.3, '#a8773f') + tf(`rotate(${f(a)} ${f(p.x)} ${f(p.y)})`));
  }
  return s;
}

// Shredded coconut (a fluffy white mound of fine curls) or cacao nibs heaped in a round container.
const BOWL_HEAP = {
  coconut: { bed: '#f1ebdf', H: 8, shreds: 210 },
  cacao: { bed: '#3b1d10', draw: cacaoNib, n: 120, s: 2.4, H: 7, ds: 0.6 },
};
function bowlHeap(id) {
  const T = pantryTop(id);
  const spec = BOWL_HEAP[id];
  const rng = rngFor(`heap-${id}`);
  const R = T.r - 1;
  const c = pt(T.x, T.y - 1, T.z);
  // the heap's body: an ellipse at the rim and a dome above it, shaded like the pieces
  const top = pt(T.x, T.y + spec.H, T.z);
  const body = `M${f(c[0] - R)} ${f(c[1])}C${f(c[0] - R)} ${f(top[1] - 1)} ${f(c[0] - R * 0.5)} ${f(top[1] - ryOf(R) * 0.6)} ${f(c[0])} ${f(top[1] - ryOf(R) * 0.6)}` +
    `C${f(c[0] + R * 0.5)} ${f(top[1] - ryOf(R) * 0.6)} ${f(c[0] + R)} ${f(top[1] - 1)} ${f(c[0] + R)} ${f(c[1])}A${f(R)} ${f(ryOf(R))} 0 0 1 ${f(c[0] - R)} ${f(c[1])}Z`;
  let s = path(body, spec.bed) + path(body, paint('sph-soft'), op(0.9));
  if (spec.shreds) {
    // fine curls all over the mound: shadowed ones first, then the lit ones
    const shade = [];
    const lit = [];
    for (const p of dome(spec.shreds, R, spec.H, T.x, T.y - 0.5, T.z, rng)) {
      const a = rng.next() * Math.PI;
      const l = 1.4 + rng.next() * 1.6;
      const d = `M${f(p.x - Math.cos(a) * l)} ${f(p.y - Math.sin(a) * l * 0.6)}q${f(Math.cos(a + 1) * l)} ${f(Math.sin(a + 1) * l * 0.6)} ${f(Math.cos(a) * l * 2)} ${f(Math.sin(a) * l * 1.2)}`;
      (rng.next() < 0.35 ? shade : lit).push(d);
    }
    s += line(shade.join(''), '#b9ad97', 0.9, op(0.8)) + line(lit.join(''), WHITE, 1, op(0.95));
    return s;
  }
  for (const p of dome(spec.n, R, spec.H, T.x, T.y - 0.5, T.z, rng)) {
    const size = spec.s * (0.85 + rng.next() * 0.3);
    s += dropShadow(p.x, p.y, size * spec.ds, size * 0.3 * spec.ds, 0.16) + spec.draw(p.x, p.y, size, rng);
  }
  return s;
}

// A fresh mint leaf lying on the board (from its stalk at x, y along +x, turned by deg): ovate with a
// pointed tip and a toothed edge, its own shade of green, the deep-set veins darker than the leaf
// and a soft sheen on its upper half.
const MINT_TONES = ['#45a655', '#51b461', '#3e9c4d', '#5bbc69'];
function boardLeaf(x, y, len, wid, deg, rng) {
  const top = [];
  const bot = [];
  const n = 12;
  for (let i = 1; i < n; i++) {
    const k = i / n;
    const w = wid * Math.sin(Math.PI * k ** 0.78) ** 0.8 * (i % 2 ? 1 : 0.9);
    top.push([len * k, -w]);
    bot.push([len * k, w]);
  }
  const d = `M0 0${top.map(([a, b]) => `L${f(a)} ${f(b)}`).join('')}L${f(len)} 0${bot.reverse().map(([a, b]) => `L${f(a)} ${f(b)}`).join('')}Z`;
  let veins = `M${f(len * 0.03)} 0L${f(len * 0.9)} 0`;
  for (const k of [0.22, 0.4, 0.57, 0.73]) {
    const w = wid * 0.62 * Math.sin(Math.PI * (k + 0.1)) ** 0.7;
    veins += `M${f(len * k)} 0Q${f(len * (k + 0.06))} ${f(-w * 0.5)} ${f(len * (k + 0.15))} ${f(-w)}M${f(len * k)} 0Q${f(len * (k + 0.06))} ${f(w * 0.5)} ${f(len * (k + 0.15))} ${f(w)}`;
  }
  const col = MINT_TONES[Math.floor(rng.next() * MINT_TONES.length)];
  const sw = Math.max(0.3, wid * 0.06);
  return g(`translate(${f(x)} ${f(y)}) rotate(${f(deg)})`,
    path(d, col, stroke(sw, '#24723a')) + path(d, paint('sph-soft')) + line(veins, '#23703a', sw, op(0.7)) +
    ellipse(len * 0.42, -wid * 0.42, len * 0.24, wid * 0.16, WHITE, op(0.3)));
}

// A sprig of mint lying on its side (drawn along +x from its cut end at x, y, then turned by deg): a
// stem that thins toward the tip with a pair of leaves at each node, the pairs turned 90° to each
// other (one lies flat, spread to both sides; in the next one a leaf stands up over the stem, its
// partner lies under it); big leaves low on the stem, small ones up to a tuft at the tip.
function mintStem(x, y, len, deg, rng) {
  let under = '';
  let over = '';
  [0.22, 0.47, 0.68, 0.84].forEach((t, i) => {
    const l = len * 0.44 * (1 - t * 0.68) * (0.9 + rng.next() * 0.2);
    const w = l * 0.54;
    const at = len * t;
    if (i % 2 === 0) {
      const a = 62 - i * 7 + (rng.next() - 0.5) * 14;
      under += boardLeaf(at, 0, l, w, -a, rng) + boardLeaf(at, 0, l * 0.94, w * 0.96, a + (rng.next() - 0.5) * 12, rng);
    } else {
      under += boardLeaf(at, 0.4, l * 0.55, w * 0.85, 104 + (rng.next() - 0.5) * 16, rng);
      over += boardLeaf(at, -0.4, l * 0.66, w * 1.05, -100 + (rng.next() - 0.5) * 18, rng);
    }
  });
  over += boardLeaf(len * 0.95, 0, len * 0.12, len * 0.065, -26, rng) + boardLeaf(len * 0.95, 0, len * 0.11, len * 0.06, 28, rng) +
    boardLeaf(len * 0.96, 0, len * 0.1, len * 0.05, 0, rng);
  const sw = Math.max(0.6, len * 0.022);
  const stem = `M0 ${f(-sw)}Q${f(len * 0.5)} ${f(-sw * 0.9 - len * 0.015)} ${f(len)} ${f(-sw * 0.3)}L${f(len)} ${f(sw * 0.3)}Q${f(len * 0.5)} ${f(sw * 0.9 - len * 0.015)} 0 ${f(sw)}Z`;
  return g(`translate(${f(x)} ${f(y)}) rotate(${f(deg)})`, under + path(stem, '#2f7d3b', stroke(0.4, '#1d5a28')) + ellipse(0, 0, sw * 0.7, sw, '#9ccf8a') + over);
}

// Fresh mint lying on the board: three sprigs and a few loose leaves, seen from above like the board;
// its back left corner stays free for the layer badge.
function boardMint(id) {
  const T = pantryTop(id);
  const rng = rngFor('board-mint');
  const flat = (px, py, body) => g(`translate(${f(px)} ${f(py)}) scale(1 ${f(SIN_P + 0.22)}) translate(${f(-px)} ${f(-py)})`, body);
  let s = '';
  for (const [x, z, deg, len] of [[-31, -20, -4, 62], [-8, -4, 10, 44], [-32, 9, -12, 56]]) {
    const [px, py] = pt(T.x + x, T.y + 1, T.z + z);
    const r = (deg * Math.PI) / 180;
    const sx = px + Math.cos(r) * len * 0.5 + 1;
    const sy = py + Math.sin(r) * len * 0.42 + 2.5;
    s += ellipse(sx, sy, len * 0.5, 4.5, '#1d0f08', op(0.13) + tf(`rotate(${f(deg * 0.84)} ${f(sx)} ${f(sy)})`));
    s += flat(px, py, mintStem(px, py, len, deg, rng));
  }
  for (const [x, z, deg, l] of [[22, -18, 32, 13], [30, 4, -150, 12], [8, 16, 168, 10]]) {
    const [px, py] = pt(T.x + x, T.y + 1, T.z + z);
    s += ellipse(px + 1, py + 2, l * 0.45, 2.4, '#1d0f08', op(0.12)) + flat(px, py, boardLeaf(px - l / 2, py, l, l * 0.5, deg, rng));
  }
  return s;
}

function fillOf(id) {
  if (TRAY_FILL[id]) return trayFill(id);
  if (id === 'granola') return jarHeap(id);
  if (BOWL_HEAP[id]) return bowlHeap(id);
  if (id === 'mint') return boardMint(id);
  return '';
}

// ---------------------------------------------------------------- the drawn containers (no WebGL)
const STEEL = { face: '#c3c9cf', top: '#e4e8eb', inside: '#959fa8', floor: '#b5bcc3', line: '#6f7a85' };

// Stainless tray: outer wall, flange, inside; the front part (outer wall and the flange's front
// half) is drawn again over the fruit.
function trayDrawn(front) {
  const G = PANTRY_GEO.tray;
  const o = { z: G.cz, sq: G.sq, depth: G.depth };
  const fl = G.hx + G.lip + 0.2;
  const fy = G.h + 1.2;
  const inner = G.hx - 0.9;
  const iy = G.h + 0.9;
  const half = (r, y) => ringPts(r, y, { ...o, a0: 0, a1: Math.PI, n: 40 });
  const wall = polyPath([...half(G.bottom, 0.5), ...half(fl, fy).reverse()]);
  let s = '';
  if (!front) {
    const c = pt(0, 0, G.cz);
    s += softShadow(c[0] + 2, c[1] + 2, G.bottom + 7, ryOf(G.bottom * G.depth) + 6);
  }
  s += path(wall, STEEL.face, stroke(0.6, STEEL.line)) + path(wall, paint('steel', STEEL.face), op(0.8)) + path(wall, paint('down-dark'), op(0.3));
  if (front) {
    const band = polyPath([...half(fl, fy), ...half(inner, iy).reverse()]);
    s += path(band, STEEL.top, stroke(0.5, STEEL.line)) + path(band, paint('steel', STEEL.top), op(0.55));
    s += line(openPath(ringPts(fl - 0.4, fy + 0.3, { ...o, a0: 0.25 * Math.PI, a1: 0.8 * Math.PI, n: 24 })), WHITE, 0.9, op(0.85));
    return s;
  }
  const flange = `${polyPath(ringPts(fl, fy, o))}${polyPath(ringPts(inner, iy, o))}`;
  s += path(flange, STEEL.top, stroke(0.5, STEEL.line) + ' fill-rule="evenodd"') + path(flange, paint('steel-v', STEEL.top), op(0.5) + ' fill-rule="evenodd"');
  const opening = polyPath(ringPts(inner, iy, o));
  s += path(opening, STEEL.inside) + path(opening, paint('steel-in', STEEL.inside), op(0.7));
  const floor = polyPath(ringPts(G.bottom - 2.4, 1.1, o));
  s += path(floor, STEEL.floor) + path(floor, paint('steel', STEEL.floor), op(0.4));
  // the flange catches the key light on its back left
  s += line(openPath(ringPts(fl - 0.4, fy + 0.3, { ...o, a0: 1.05 * Math.PI, a1: 1.55 * Math.PI, n: 20 })), WHITE, 1.1, op(0.9));
  return s;
}

// Glass jar body (straight wall, shoulder, neck) around (x, z), as one outline.
function jarOutline({ x, z, r, h, mouth, neck }) {
  const n = mouth + 1.5;
  const B = pt(x, 0, z);
  const S = pt(x, h - 6, z);
  const N = pt(x, h, z);
  const T = pt(x, h + neck, z);
  return `M${f(B[0] - r)} ${f(S[1])}V${f(B[1])}A${f(r)} ${f(ryOf(r))} 0 0 0 ${f(B[0] + r)} ${f(B[1])}V${f(S[1])}` +
    `C${f(B[0] + r)} ${f(N[1] + 2.5)} ${f(B[0] + n)} ${f(N[1] + 1.5)} ${f(B[0] + n)} ${f(N[1])}V${f(T[1])}` +
    `A${f(n)} ${f(ryOf(n))} 0 0 0 ${f(B[0] - n)} ${f(T[1])}V${f(N[1])}C${f(B[0] - n)} ${f(N[1] + 1.5)} ${f(B[0] - r)} ${f(N[1] + 2.5)} ${f(B[0] - r)} ${f(S[1])}Z`;
}
// Inner radius of a jar at height y (straight wall, then the shoulder up to the mouth).
const jarInner = ({ r, h, mouth }, y) => (y <= h - 6 ? r - 1.6 : Math.max(mouth - 0.3, r - 1.6 - ((y - (h - 6)) / 6) * (r - 1.6 - mouth)));
// What fills a jar (or glass) up to `level`: its front seen through the glass (with `inside` drawn on
// it, under its shading) and its top surface.
function jarContent(G, level, col, top, inside = '') {
  const { x, z, r } = G;
  const ri = (y) => jarInner(G, y);
  const B = pt(x, 1.6, z);
  const L = pt(x, level, z);
  const rl = ri(level);
  const d = `M${f(L[0] - rl)} ${f(L[1])}L${f(B[0] - r + 1.6)} ${f(B[1])}A${f(r - 1.6)} ${f(ryOf(r - 1.6))} 0 0 0 ${f(B[0] + r - 1.6)} ${f(B[1])}` +
    `L${f(L[0] + rl)} ${f(L[1])}A${f(rl)} ${f(ryOf(rl))} 0 0 0 ${f(L[0] - rl)} ${f(L[1])}Z`;
  return path(d, col) + inside + path(d, paint('cyl'), op(0.75)) + ellipse(L[0], L[1], rl, ryOf(rl), top) + ellipse(L[0], L[1], rl, ryOf(rl), paint('sph-soft'), op(0.6));
}
function glassOver(G) {
  const d = jarOutline(G);
  const n = G.mouth + 1.5;
  const T = pt(G.x, G.h + G.neck, G.z);
  const B = pt(G.x, 0, G.z);
  let s = path(d, paint('glass', 'none')) + path(d, 'none', stroke(0.7, '#8fb1bd') + op(0.75));
  s += ellipse(T[0], T[1], n, ryOf(n), 'none', stroke(1.3, '#f4fbfd') + op(0.95)) + ellipse(T[0], T[1], n - 1.2, ryOf(n - 1.2), 'none', stroke(0.6, '#8fb1bd') + op(0.7));
  s += path(`M${f(B[0] - G.r + 2)} ${f(B[1] - 1)}A${f(G.r - 2)} ${f(ryOf(G.r - 2))} 0 0 0 ${f(B[0] + G.r - 2)} ${f(B[1] - 1)}`, 'none', stroke(1.6, '#e8f6f9') + op(0.8));
  s += line(`M${f(B[0] - G.r + 3.4)} ${f(B[1] - ryOf(G.r) - 2)}V${f(T[1] + 8)}`, WHITE, 1.8, op(0.7));
  s += line(`M${f(B[0] + G.r - 2.6)} ${f(B[1] - ryOf(G.r) - 3)}V${f(T[1] + 10)}`, WHITE, 0.8, op(0.55));
  return s;
}

// A ring of radius rr on the clip-top jar's open lid, ly above its underside (the lid swung back by
// lidOpen about its hinge, like the 3D lid), as screen points.
function lidRing(G, rr, ly, n = 40) {
  const { hinge } = G.lid;
  const d = -hinge[2]; // the lid's centre lies this far in front of the hinge when closed
  const c = Math.cos(G.lidOpen);
  const sn = Math.sin(G.lidOpen);
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const lz = Math.sin(a) * rr + d;
    out.push(pt(G.x + Math.cos(a) * rr, hinge[1] + c * ly + sn * lz, G.z + hinge[2] - sn * ly + c * lz));
  }
  return out;
}

function clipJarDrawn() {
  const G = PANTRY_GEO.clipJar;
  const top = G.h + G.neck;
  const c = pt(G.x, 0, G.z);
  const T = pt(G.x, top, G.z);
  const n = G.mouth + 1.5;
  let s = softShadow(c[0] + 1.5, c[1] + 1.5, G.r + 4, ryOf(G.r) + 3.5);
  // the glass lid swung back behind the mouth, its orange seal toward the player
  const lid = polyPath(lidRing(G, G.lid.r, 1));
  s += path(lid, '#eef8fa', op(0.6) + stroke(0.7, '#8fb1bd')) + path(lid, paint('glass', 'none'));
  s += path(polyPath(lidRing(G, G.mouth + 1.2, -0.7)), 'none', stroke(2.1, '#e9652b'));
  // the granola packed behind the glass: toasted clusters in a few tones close together (the dark gaps
  // between them are the filling's own colour) and light oat flakes, narrower toward the sides
  const rng = rngFor('jar-granola');
  const tones = ['#c98a3f', '#b5772f', '#d9a45a', '#a0642a'];
  const blobs = tones.map(() => '');
  let flakes = '';
  const blob = (x, y, rx, ry, deg) => { // an ellipse turned by deg as a subpath
    const dx = Math.cos((deg * Math.PI) / 180) * rx;
    const dy = Math.sin((deg * Math.PI) / 180) * rx;
    const arc = `${f(rx)} ${f(ry)} ${f(deg)} 1 0`;
    return `M${f(x - dx)} ${f(y - dy)}A${arc} ${f(x + dx)} ${f(y + dy)}A${arc} ${f(x - dx)} ${f(y - dy)}Z`;
  };
  for (let i = 0; i < 360; i++) {
    const a = rng.next() * Math.PI;
    const y = 2 + rng.next() * (top - 3.5);
    const r = jarInner(G, y) - 0.4;
    const [px, py] = pt(G.x + Math.cos(a) * r, y, G.z + Math.sin(a) * r);
    const k = 0.45 + 0.55 * Math.sin(a); // foreshortened toward the sides
    if (i % 5 === 4) flakes += blob(px, py, 1.3 * k, 0.65, rng.next() * 180);
    else blobs[i % tones.length] += blob(px, py, (1.6 + rng.next() * 1.1) * k, 1.2 + rng.next() * 0.6, rng.next() * 180);
  }
  const packed = blobs.map((d, i) => path(d, tones[i])).join('') + path(flakes, '#ecd39c');
  s += jarContent(G, top - 0.8, '#8a5020', '#8a501d', packed);
  s += glassOver(G);
  // the bail: a wire ring around the neck and the lever lying back to the lid's hinge
  const yN = top - 1.6;
  const rn = G.mouth + 2.2;
  const { hinge } = G.lid;
  const lever = [[-rn, yN, 0], [-rn - 0.5, yN + 2.4, -G.mouth * 0.72], [-7, hinge[1] + 1.2, hinge[2] - 0.6], [7, hinge[1] + 1.2, hinge[2] - 0.6], [rn + 0.5, yN + 2.4, -G.mouth * 0.72], [rn, yN, 0]]
    .map(([x, y, z]) => pt(G.x + x, y, G.z + z));
  const N = pt(G.x, yN, G.z);
  s += line(openPath(lever), '#6f7a85', 1.9) + line(openPath(lever), '#e6eaee', 1);
  s += ellipse(N[0], N[1], rn, ryOf(rn), 'none', stroke(1.9, '#6f7a85')) + ellipse(N[0], N[1], rn, ryOf(rn), 'none', stroke(1, '#e6eaee'));
  return s + ellipse(T[0] - n * 0.45, T[1] + ryOf(n) * 0.6, 2.2, 1, WHITE, op(0.8));
}

// A paper label over the front of a jar (radius r, from y0 to y1, ±1.05 rad around the front).
function jarLabelDrawn(G, y0, y1, kind) {
  const o = { x: G.x, z: G.z, a0: Math.PI / 2 - 1.05, a1: Math.PI / 2 + 1.05, n: 16 };
  const band = polyPath([...ringPts(G.r + 0.2, y0, o), ...ringPts(G.r + 0.2, y1, o).reverse()]);
  const [cx, cy] = pt(G.x, (y0 + y1) / 2, G.z + G.r);
  let s;
  if (kind === 'honey') {
    s = path(band, '#f0dcae');
    let hex = '';
    for (let row = 0; row < 3; row++) {
      for (let col = -2; col <= (row % 2 ? 1 : 2); col++) {
        const hx = cx + col * 6.2 + (row % 2 ? 3.1 : 0);
        const hy = cy - 5.4 + row * 5.4;
        hex += `M${f(hx + 3.2)} ${f(hy)}${[1, 2, 3, 4, 5].map((k) => `L${f(hx + Math.cos((k * Math.PI) / 3) * 3.2)} ${f(hy + Math.sin((k * Math.PI) / 3) * 3.2)}`).join('')}Z`;
      }
    }
    s += line(hex, '#c47d0e', 0.9);
  } else {
    s = path(band, '#c8322b') + ellipse(cx, cy, 9.5, 6.4, '#f4e6cc') + peanutPod(cx, cy, 5.6, 0);
  }
  return s + path(band, paint('cyl'), op(0.6));
}

function honeyDrawn() {
  const G = PANTRY_GEO.honey;
  const c = pt(G.x, 0, G.z);
  const L = G.lid;
  const lc = pt(L.x, 0, L.z);
  const lt = pt(L.x, 4.8, L.z);
  // the gold lid lies beside the jar
  let s = softShadow(lc[0] + 1.5, lc[1] + 1, L.r + 3, ryOf(L.r) + 2.5) + softShadow(c[0] + 1.5, c[1] + 1.5, G.r + 4, ryOf(G.r) + 3.5);
  const skirt = `M${f(lc[0] - L.r)} ${f(lt[1])}V${f(lc[1])}A${f(L.r)} ${f(ryOf(L.r))} 0 0 0 ${f(lc[0] + L.r)} ${f(lc[1])}V${f(lt[1])}Z`;
  s += path(skirt, '#b98b2f', stroke(0.6, '#7a5a1a')) + path(skirt, paint('cyl'), op(0.8));
  s += ellipse(lt[0], lt[1], L.r, ryOf(L.r), '#e2bd62', stroke(0.6, '#8f6a22')) + ellipse(lt[0], lt[1], L.r, ryOf(L.r), paint('sph'), op(0.8));
  s += jarContent(G, G.level, '#e08a0c', '#f7b33c');
  s += ellipse(c[0] - 4, pt(G.x, G.level, G.z)[1] + 1, 3.5, 1.2, '#fff1c2', op(0.6));
  // the dipper leans out of the honey, up to the right
  const d = pt(G.x + 3, G.level + 1, G.z);
  s += g(`translate(${f(d[0])} ${f(d[1])}) scale(0.74) translate(${f(-d[0])} ${f(-d[1])})`, honeyDipper(d[0], d[1], -54, SAUCE.honey.col, SAUCE.honey.hi, SAUCE.honey.dark));
  s += glassOver(G) + jarLabelDrawn(G, 12, 32, 'honey');
  return s;
}

function peanutDrawn() {
  const G = PANTRY_GEO.peanut;
  const c = pt(G.x, 0, G.z);
  const L = G.lid;
  const lc = pt(L.x, 0, L.z);
  const lt = pt(L.x, L.h, L.z);
  let s = softShadow(c[0] + 1.5, c[1] + 1.5, G.r + 4, ryOf(G.r) + 3.5) + softShadow(lc[0] + 1.5, lc[1] + 1, L.r + 3, ryOf(L.r) + 2.5);
  // the red lid lies beside the jar, top up: its knurled skirt and glossy top
  const skirt = `M${f(lc[0] - L.r)} ${f(lt[1])}V${f(lc[1])}A${f(L.r)} ${f(ryOf(L.r))} 0 0 0 ${f(lc[0] + L.r)} ${f(lc[1])}V${f(lt[1])}Z`;
  let ribs = '';
  for (let k = 1; k < 18; k++) {
    const x = lc[0] - Math.cos((k / 18) * Math.PI) * L.r;
    const y = lc[1] + Math.sin((k / 18) * Math.PI) * ryOf(L.r);
    ribs += `M${f(x)} ${f(y - 0.6)}V${f(y - (lc[1] - lt[1]) + 0.6)}`;
  }
  s += path(skirt, '#b8352c', stroke(0.6, '#6e1611')) + line(ribs, '#7d1a14', 0.7, op(0.7)) + path(skirt, paint('cyl'), op(0.75));
  s += ellipse(lt[0], lt[1], L.r, ryOf(L.r), '#c23a30', stroke(0.6, '#6e1611')) + ellipse(lt[0], lt[1], L.r, ryOf(L.r), paint('sph'), op(0.7));
  s += line(openPath(ringPts(L.r - 0.8, L.h, { x: L.x, z: L.z, a0: 1.05 * Math.PI, a1: 1.5 * Math.PI, n: 12 })), WHITE, 0.9, op(0.75));
  s += jarContent(G, G.level, '#c4853f', '#d9a462');
  const t = pt(G.x, G.level + 0.8, G.z);
  s += line(`M${f(t[0] - 8)} ${f(t[1] + 1)}Q${f(t[0])} ${f(t[1] - 3)} ${f(t[0] + 8)} ${f(t[1])}M${f(t[0] - 5)} ${f(t[1] + 3)}Q${f(t[0] + 1)} ${f(t[1] + 1)} ${f(t[0] + 6)} ${f(t[1] + 3)}`, '#eec58f', 1, op(0.8));
  // the spoon: its bowl in the peanut butter, the handle over the rim to the back right
  s += ellipse(t[0] + 1, t[1] + 0.5, 4.2, 2.2, paint('steel', '#cfd6dc'), stroke(0.6, '#5f6a75'));
  s += line(`M${f(t[0] + 4)} ${f(t[1] - 1)}L${f(t[0] + 16)} ${f(t[1] - 18)}`, '#5f6a75', 2.4) + line(`M${f(t[0] + 4)} ${f(t[1] - 1)}L${f(t[0] + 16)} ${f(t[1] - 18)}`, '#dfe5ea', 1.4);
  s += glassOver(G) + jarLabelDrawn(G, 13, 33, 'peanut');
  return s;
}

function chiaDrawn() {
  const G = PANTRY_GEO.chia;
  const B = pt(G.x, 0, G.z);
  const T = pt(G.x, G.h, G.z);
  const L = pt(G.x, G.level, G.z);
  const rl = G.rb + ((G.level - 2) / G.h) * (G.rt - G.rb) - 1.4;
  const outline = `M${f(T[0] - G.rt)} ${f(T[1])}L${f(B[0] - G.rb)} ${f(B[1])}A${f(G.rb)} ${f(ryOf(G.rb))} 0 0 0 ${f(B[0] + G.rb)} ${f(B[1])}L${f(T[0] + G.rt)} ${f(T[1])}A${f(G.rt)} ${f(ryOf(G.rt))} 0 0 0 ${f(T[0] - G.rt)} ${f(T[1])}Z`;
  let s = softShadow(B[0] + 1.5, B[1] + 1.5, G.rb + 4, ryOf(G.rb) + 3.5);
  const seeds = `M${f(L[0] - rl)} ${f(L[1])}L${f(B[0] - G.rb + 1.4)} ${f(B[1] - 1.5)}A${f(G.rb - 1.4)} ${f(ryOf(G.rb - 1.4))} 0 0 0 ${f(B[0] + G.rb - 1.4)} ${f(B[1] - 1.5)}L${f(L[0] + rl)} ${f(L[1])}A${f(rl)} ${f(ryOf(rl))} 0 0 0 ${f(L[0] - rl)} ${f(L[1])}Z`;
  s += path(seeds, '#46423d');
  // seeds on the front of the filling and on its top
  const rng = rngFor('weck-chia');
  const pts = [];
  for (let i = 0; i < 110; i++) {
    const y = 2.4 + rng.next() * (G.level - 2.8);
    const a = 0.06 * Math.PI + rng.next() * 0.88 * Math.PI;
    const r = G.rb - 1.6 + ((y - 2) / G.h) * (G.rt - G.rb);
    pts.push(pt(G.x + Math.cos(a) * r, y, G.z + Math.sin(a) * r));
  }
  for (let i = 0; i < 70; i++) {
    const a = rng.next() * TAU;
    const k = Math.sqrt(rng.next()) * 0.95;
    pts.push(pt(G.x + Math.cos(a) * k * rl, G.level, G.z + Math.sin(a) * k * rl));
  }
  s += chiaSeeds(pts, rng, 1.2, 0.7);
  s += path(seeds, paint('cyl'), op(0.6));
  // the round measuring spoon on the seeds, its handle over the rim toward the front right (like the
  // 3D spoon: turned by sp.turn about y, scaled by sp.k)
  const sp = G.spoon;
  const along = [Math.cos(sp.turn), -Math.sin(sp.turn)]; // the handle's direction in x, z
  const at = (u, v) => pt(G.x + sp.x + along[0] * u * sp.k, G.level + 0.5 + v * sp.k, G.z + sp.z + along[1] * u * sp.k);
  const S = at(0, 1.4);
  const R = 4.9 * sp.k;
  const handle = openPath([[4.4, 2.4], [9, 4.8], [14, 7.2], [19.5, 8.2]].map(([u, v]) => at(u, v)));
  s += ellipse(S[0], S[1], R, ryOf(R), paint('steel', '#e3e8ec'), stroke(0.6, '#5f6a75')) + ellipse(S[0], S[1] + 0.3, R - 1.6, ryOf(R - 1.6), '#3e3a35');
  s += line(handle, '#5f6a75', 2.6) + line(handle, '#eef2f5', 1.5);
  s += path(outline, paint('glass', 'none')) + path(outline, 'none', stroke(0.7, '#8fb1bd') + op(0.75));
  s += ellipse(T[0], T[1], G.rt, ryOf(G.rt), 'none', stroke(1.4, '#f4fbfd') + op(0.95));
  s += line(`M${f(B[0] - G.rb + 2.5)} ${f(B[1] - ryOf(G.rb) - 1)}L${f(T[0] - G.rt + 3)} ${f(T[1] + 4)}`, WHITE, 1.6, op(0.7));
  return s;
}

function bottleDrawn() {
  const G = PANTRY_GEO.bottle;
  const B = pt(G.x, 0, G.z);
  const S = pt(G.x, G.h - 6, G.z);
  const N = pt(G.x, G.h + 1, G.z);
  const r = G.r;
  const body = `M${f(B[0] - r)} ${f(S[1])}V${f(B[1])}A${f(r)} ${f(ryOf(r))} 0 0 0 ${f(B[0] + r)} ${f(B[1])}V${f(S[1])}C${f(B[0] + r)} ${f(N[1] + 3)} ${f(B[0] + 8.4)} ${f(N[1] + 1)} ${f(B[0] + 8.4)} ${f(N[1])}H${f(B[0] - 8.4)}C${f(B[0] - 8.4)} ${f(N[1] + 1)} ${f(B[0] - r)} ${f(N[1] + 3)} ${f(B[0] - r)} ${f(S[1])}Z`;
  let s = softShadow(B[0] + 1.5, B[1] + 1.5, r + 4, ryOf(r) + 3.5);
  s += path(body, '#3d1e10', stroke(0.7, '#1f0d05')) + path(body, paint('cyl'), op(0.9));
  // label with chocolate running down from its top edge
  const l0 = pt(G.x, G.label[0], G.z)[1] + ryOf(r);
  const l1 = pt(G.x, G.label[1], G.z)[1] + ryOf(r);
  let drips = `M${f(B[0] - r)} ${f(l1)}`;
  for (let i = 0; i < 6; i++) {
    const x = B[0] - r + (i + 0.5) * ((2 * r) / 6);
    drips += `L${f(x - 1.6)} ${f(l1)}Q${f(x)} ${f(l1 + 3 + (i % 3) * 1.6)} ${f(x + 1.6)} ${f(l1)}`;
  }
  s += path(`M${f(B[0] - r)} ${f(l1)}V${f(l0)}A${f(r)} ${f(ryOf(r) * 0.4)} 0 0 0 ${f(B[0] + r)} ${f(l0)}V${f(l1)}Z`, '#f3e7d3');
  s += path(`${drips}H${f(B[0] + r)}V${f(l1 - 1.4)}H${f(B[0] - r)}Z`, '#4a2312');
  s += ellipse(B[0], (l0 + l1) / 2 + 2, 4.6, 3, '#7a3f1d', tf(`rotate(-20 ${f(B[0])} ${f((l0 + l1) / 2 + 2)})`));
  s += path(`M${f(B[0] - r)} ${f(l1)}V${f(l0)}A${f(r)} ${f(ryOf(r) * 0.4)} 0 0 0 ${f(B[0] + r)} ${f(l0)}V${f(l1)}Z`, paint('cyl'), op(0.7));
  // the cap and its nozzle
  const C0 = pt(G.x, G.h + 0.6, G.z);
  const C1 = pt(G.x, G.h + 7.6, G.z);
  const tip = pt(G.x, G.h + 18.4, G.z);
  const cap = `M${f(C0[0] - 8.9)} ${f(C0[1])}V${f(C1[1])}L${f(C1[0] - 5.6)} ${f(C1[1] - 1)}L${f(tip[0] - 1.4)} ${f(tip[1] + 1.4)}Q${f(tip[0])} ${f(tip[1] - 0.6)} ${f(tip[0] + 1.4)} ${f(tip[1] + 1.4)}L${f(C1[0] + 5.6)} ${f(C1[1] - 1)}L${f(C1[0] + 8.9)} ${f(C1[1])}V${f(C0[1])}A${f(8.9)} ${f(ryOf(8.9))} 0 0 1 ${f(C0[0] - 8.9)} ${f(C0[1])}Z`;
  s += path(cap, '#2a130a', stroke(0.6, '#120703')) + path(cap, paint('cyl'), op(0.85));
  s += line(`M${f(B[0] - r + 3)} ${f(B[1] - 4)}V${f(S[1] - 2)}`, WHITE, 1.6, op(0.45));
  return s;
}

// Half a coconut or the walnut bowl: the outer shell, the rim and the inside; the front part (the
// shell's front and the front half of the rim) is drawn again over the flakes or nibs.
function roundDrawn(id, front) {
  const coco = id === 'coconut';
  const T = pantryTop(id);
  const G = coco ? PANTRY_GEO.coconut : PANTRY_GEO.bowl;
  const R = G.r;
  const C = pt(0, T.y, T.z);
  const bottom = pt(0, coco ? -G.sink : 0, T.z + (coco ? R * 0.42 : R * 0.55))[1];
  const col = coco ? { shell: '#6e4527', line: '#3b2213', rim: '#fbf7ee', inside: '#efe5d0' } : { shell: '#8d5c37', line: '#4b2b16', rim: '#a36d43', inside: '#7a4b2a' };
  const shell = `M${f(C[0] - R)} ${f(C[1])}C${f(C[0] - R)} ${f(bottom - 2)} ${f(C[0] - R * 0.5)} ${f(bottom)} ${f(C[0])} ${f(bottom)}C${f(C[0] + R * 0.5)} ${f(bottom)} ${f(C[0] + R)} ${f(bottom - 2)} ${f(C[0] + R)} ${f(C[1])}A${f(R)} ${f(ryOf(R))} 0 0 1 ${f(C[0] - R)} ${f(C[1])}Z`;
  let s = '';
  if (!front) s += softShadow(C[0] + 2, bottom - 1, R * 0.8, 5);
  s += path(shell, col.shell, stroke(0.7, col.line));
  const rng = rngFor(`shell-${id}`);
  let grain = '';
  for (let i = 0; i < (coco ? 30 : 12); i++) {
    const x = C[0] - R * 0.85 + rng.next() * R * 1.7;
    const y = C[1] + 2 + rng.next() * (bottom - C[1] - 4);
    grain += coco ? `M${f(x)} ${f(y)}l${f(2 + rng.next() * 3)} ${f(rng.next() * 2 - 1)}` : `M${f(x)} ${f(y)}q${f(6 + rng.next() * 6)} ${f(rng.next() * 2 - 1)} ${f(14 + rng.next() * 8)} ${f(rng.next() * 1.4 - 0.7)}`;
  }
  s += line(grain, coco ? '#a77748' : '#5e3a20', coco ? 0.8 : 0.7, op(0.6)) + path(shell, paint('sph-soft'), op(0.9));
  const ri = coco ? G.flesh : R - 3.2;
  if (front) {
    const band = `M${f(C[0] - R)} ${f(C[1])}A${f(R)} ${f(ryOf(R))} 0 0 0 ${f(C[0] + R)} ${f(C[1])}L${f(C[0] + ri)} ${f(C[1])}A${f(ri)} ${f(ryOf(ri))} 0 0 1 ${f(C[0] - ri)} ${f(C[1])}Z`;
    s += path(band, col.rim, stroke(0.5, col.line)) + path(band, paint('down'), op(0.4));
    return s;
  }
  s += ellipse(C[0], C[1], R, ryOf(R), col.rim, stroke(0.6, col.line));
  s += ellipse(C[0], C[1] + 0.3, ri, ryOf(ri), col.inside) + ellipse(C[0], C[1] + 0.3, ri, ryOf(ri), paint('up-dark'), op(0.5));
  return s;
}

function boardDrawn() {
  const G = PANTRY_GEO.board;
  const a = pt(-G.hx, G.h, -2 * G.hz);
  const b = pt(G.hx, G.h, 0);
  const e = pt(0, 0, 0)[1];
  let s = softShadow((a[0] + b[0]) / 2 + 2, e - 2, G.hx + 4, 7);
  s += path(rrect(a[0], b[1] - 2, b[0] - a[0], e - b[1] + 2, 2.4), '#9b6837');
  s += path(rrect(a[0], a[1], b[0] - a[0], b[1] - a[1], 3), '#cf9f66', stroke(0.6, '#8a5a2b'));
  const rng = rngFor('board-grain');
  let grain = '';
  for (let i = 0; i < 9; i++) {
    const y = a[1] + 3 + rng.next() * (b[1] - a[1] - 6);
    const x = a[0] + 4 + rng.next() * 30;
    grain += `M${f(x)} ${f(y)}q${f(18 + rng.next() * 10)} ${f(rng.next() * 2 - 1)} ${f(40 + rng.next() * 14)} ${f(rng.next() * 1.6 - 0.8)}`;
  }
  s += line(grain, '#a8743f', 0.8, op(0.55)) + path(rrect(a[0], a[1], b[0] - a[0], b[1] - a[1], 3), paint('down'), op(0.5));
  return s;
}

function containerDrawn(id, front) {
  switch (pantryKind(id)) {
    case 'tray': return trayDrawn(front);
    case 'coconut': case 'bowl': return roundDrawn(id, front);
    case 'clipJar': return front ? '' : clipJarDrawn();
    case 'honey': return front ? '' : honeyDrawn();
    case 'peanut': return front ? '' : peanutDrawn();
    case 'chia': return front ? '' : chiaDrawn();
    case 'bottle': return front ? '' : bottleDrawn();
    case 'board': return front ? '' : boardDrawn();
    default: return '';
  }
}

// The ingredient's container with what is in it, drawn (no WebGL): w × w·112/96 px.
export function binSVG(id, w = 84) {
  const h = Math.round((w * PV.h) / PV.w);
  return memo(`bin|${id}|${w}`, () => {
    const body = pantryKind(id) ? containerDrawn(id, false) + fillOf(id) + containerDrawn(id, true) : g('translate(26 30) scale(0.44)', iconBody(id));
    return svgWrap(w, h, PV.w, PV.h, body);
  });
}

// What lies in or on the ingredient's container, drawn over its 3D picture (same box as binSVG); ''
// when all of it is 3D (honey, chia, peanut butter, chocolate).
export function binFillSVG(id, w = 84) {
  if (!pantryTop(id)) return '';
  const h = Math.round((w * PV.h) / PV.w);
  return memo(`binfill|${id}|${w}`, () => svgWrap(w, h, PV.w, PV.h, fillOf(id)));
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
// Cup stack (viewBox 120×185) and the free spot on the counter (viewBox 200×200). The stacked cups
// are the cups of bowlSVG at 44/64 of its scale, so cupStackSVG(w) stacks the cups of bowlSVG(1.146 w).
// ======================================================================
export function cupStackSVG(w = 90) {
  const h = Math.round((w * 185) / 120);
  return memo(`stack|${w}`, () => {
    const cx = 60;
    const rim = { rx: 44, ry: 13 };
    const bot = { y: 171, rx: 29, ry: 9.6 };
    const n = 7;
    const step = 9;
    const topY = 80 - (n - 1) * step; // rim of the top cup
    const lowRimY = 80;
    const wallX = (y) => rim.rx + ((y - lowRimY) / (bot.y - lowRimY)) * (bot.rx - rim.rx);
    const body = `M${cx - rim.rx} ${topY}V${lowRimY}L${f(cx - bot.rx)} ${bot.y}A${bot.rx} ${bot.ry} 0 0 0 ${f(cx + bot.rx)} ${bot.y}L${cx + rim.rx} ${lowRimY}V${topY}A${rim.rx} ${rim.ry} 0 0 0 ${cx - rim.rx} ${topY}Z`;
    let s = softShadow(62, 175, 46, 9);
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
    return svgWrap(w, h, 120, 185, s);
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
// Matcha glass (viewBox 100×100): a tall clear tumbler with a thick base, its bottom at y = 95.
// A fruit matcha is an iced matcha latte in three layers: the fruit's purée at the bottom, milk,
// then the matcha with a little foam on top, ice cubes, a paper straw and the fruit on the rim.
// ======================================================================
// (the kiwi's a vivid green with big black seeds, clearly apart from the olive matcha over it, even at
// the order bubble's 64 px, BUBBLE_GLASS in js/game-view.js)
const MATCHA_FRUIT_COLORS = { banana: '#f3d35c', strawberry: '#e5384f', blueberry: '#5d3f9e', mango: '#ffa623', kiwi: '#4fbf3f' };
const fruitColor = (id) => MATCHA_FRUIT_COLORS[id] || MATCHA_FRUIT_COLORS.strawberry;
// the seeds in a kiwi or strawberry purée (the others: lighter fibres): colour, size
const PUREE_SEEDS = { kiwi: ['#16130b', 1.5], strawberry: ['#ffe08a', 1] };
export const matchaFruitColorOf = fruitColor;
const GL = { top: 21, rx: 24, ry: 4.6, bot: 91.4, brx: 20.6, bry: 3.6, floor: 85.5 };
const glassX = (y) => GL.rx + ((y - GL.top) * (GL.brx - GL.rx)) / (GL.bot - GL.top); // half width at y
const GLASS_BODY = `M${50 - GL.rx} ${GL.top}L${f(50 - GL.brx)} ${GL.bot}A${GL.brx} ${GL.bry} 0 0 0 ${f(50 + GL.brx)} ${GL.bot}L${50 + GL.rx} ${GL.top}A${GL.rx} ${GL.ry} 0 0 0 ${50 - GL.rx} ${GL.top}Z`;
// the liquid levels of a full glass: purée up to PUREE_Y, milk up to MILK_Y, matcha up to FULL_Y
const PUREE_Y = 71;
const MILK_Y = 53;
const FULL_Y = 28;
// The milk and the matcha poured over it (the 3D machine's stream takes the same colours) and the
// share of the pour that is milk: the glass fills with milk first, the matcha settles on top.
export const MATCHA_COLORS = { milk: '#f4efe3', matcha: '#7f9f37', light: '#a9c45a', foam: '#e3ebc0' };
export const MATCHA_MILK = (PUREE_Y - MILK_Y) / (PUREE_Y - FULL_Y);
// The paper straw of a ready glass, from inside the drink (x0, y0) up to its tip (x1, y1), w wide with
// round ends: short enough that it stays clear of the machine's collar and nozzle head above the
// glass (tests/kitchen3d.test.mjs checks it).
export const MATCHA_STRAW = { x0: 56.6, y0: FULL_Y + 1.5, x1: 67, y1: 9, w: 6 };

function garnish(id, x, y) {
  const rng = rngFor(`garnish-${id}`);
  if (id === 'banana') return bananaSlice(x, y, 9, rng, 0.9);
  if (id === 'strawberry') return strawberryHalf(x, y, 9, rng);
  if (id === 'kiwi') return kiwiSlice(x, y, 9, rng, 0.9);
  if (id === 'mango') return mangoCube(x - 2, y + 2, 5.5, rng) + mangoCube(x + 6, y - 2, 5, rng);
  if (id === 'blueberry') return blueberry(x - 4, y + 1, 4.6) + blueberry(x + 5, y - 1, 4.6) + blueberry(x + 1, y - 6, 4.2);
  return '';
}

// A band of liquid inside the glass from y0 (top) down to y1, its top surface an ellipse.
function liquidBand(y0, y1, inset = 2.2) {
  const l0 = 50 - glassX(y0) + inset;
  const r0 = 50 + glassX(y0) - inset;
  const l1 = 50 - glassX(y1) + inset;
  const r1 = 50 + glassX(y1) - inset;
  const ry = GL.ry * (glassX(y0) / GL.rx) * 0.82;
  return `M${f(l0)} ${f(y0)}L${f(l1)} ${f(y1)}A${f((r1 - l1) / 2)} ${f(ry)} 0 0 0 ${f(r1)} ${f(y1)}L${f(r0)} ${f(y0)}A${f((r0 - l0) / 2)} ${f(ry)} 0 0 1 ${f(l0)} ${f(y0)}Z`;
}
const surfaceRy = (y) => GL.ry * (glassX(y) / GL.rx) * 0.82;

// One ice cube in the glass (seen through the side): a rounded, slightly turned square.
function iceCube(x, y, s, rot) {
  const d = rrect(-s, -s, s * 2, s * 2, s * 0.38);
  let b = path(d, '#ffffff', op(0.24) + stroke(0.7, '#ffffff'));
  b += path(rrect(-s * 0.7, -s * 0.72, s * 1.1, s * 0.5, s * 0.2), '#ffffff', op(0.42));
  b += line(`M${f(s * 0.55)} ${f(-s * 0.4)}L${f(s * 0.62)} ${f(s * 0.55)}`, '#b9d3dc', 0.8, op(0.6));
  return g(`translate(${f(x)} ${f(y)}) rotate(${rot})`, b);
}

// opts.fill (mixing): how much of the milk and matcha is in (0–1; the purée is in from the start);
// while it runs in, the glass draws the stream from above unless opts.stream is false (the 3D
// machine pours its own); opts.from: the y (of the 100 viewBox) the stream starts at – the drawn
// machine's nozzle tip (MATCHA_POUR_FROM), else the top of the box.
export function matchaGlassSVG(fruitId = null, state = 'ready', size = 70, opts = null) {
  const st = state === 'mixing' || state === 'ready' ? state : 'empty';
  const fill = st === 'ready' ? 1 : st === 'mixing' ? Math.round(Math.max(0, Math.min(1, Number(opts?.fill) || 0)) * 12) / 12 : 0;
  const stream = st === 'mixing' && fill > 0 && !(opts && opts.stream === false);
  const from = stream ? Math.round(Math.max(0, Math.min(GL.top, Number(opts?.from) || 0)) * 10) / 10 : 0;
  return memo(`mg|${fruitId}|${st}|${size}|${fill}|${stream}|${from}`, () => drawMatchaGlass(fruitId, st, size, fill, stream, from));
}

function drawMatchaGlass(fruitId, state, size, fill, stream, from) {
  const fruit = ING[fruitId]?.matcha ? fruitId : 'strawberry';
  const C = MATCHA_COLORS;
  let s = softShadow(51, 95.5, 27, 4.2);
  // the far wall and the inside of the glass
  s += path(GLASS_BODY, paint('plastic-in', '#eaf6fa'), op(0.9));
  const full = state !== 'empty';
  const top = full ? PUREE_Y - (PUREE_Y - FULL_Y) * fill : GL.floor;
  if (full) {
    // purée at the bottom (a few seeds or fibres of the fruit), milk, then matcha with its foam
    const pc = fruitColor(fruit);
    s += path(liquidBand(PUREE_Y, GL.floor), pc) + path(liquidBand(PUREE_Y, GL.floor), paint('cyl'));
    const rng = rngFor(`puree-${fruit}`);
    const [dot, k] = PUREE_SEEDS[fruit] || [lighten(pc, 0.4), 1];
    for (let i = 0; i < 9; i++) {
      const y = PUREE_Y + 3 + rng.next() * (GL.floor - PUREE_Y - 5);
      s += ellipse(50 + (rng.next() - 0.5) * 2 * (glassX(y) - 6), y, 0.9 * k, 0.6 * k, dot, op(0.75));
    }
    if (fill > 0) {
      const milkTop = Math.max(top, MILK_Y);
      s += path(liquidBand(milkTop, PUREE_Y + 1.5), C.milk) + path(liquidBand(milkTop, PUREE_Y + 1.5), paint('cyl-soft'), op(0.45));
      // the purée bleeds a little into the milk
      s += path(liquidBand(PUREE_Y - 2.5, PUREE_Y + 1.5), mix(pc, C.milk, 0.55), op(0.75));
      if (top < MILK_Y) {
        s += path(liquidBand(top, MILK_Y + 1), C.matcha) + path(liquidBand(top, MILK_Y + 1), paint('cyl'));
        // a cloudy edge where the matcha meets the milk
        s += path(liquidBand(MILK_Y - 1, MILK_Y + 3.5), mix(C.matcha, C.milk, 0.55), op(0.85));
        s += path(liquidBand(MILK_Y + 2, MILK_Y + 5.5), mix(C.matcha, C.milk, 0.8), op(0.6));
      }
      // ice cubes in the upper part of the liquid
      const ice = [[42, 7, 5.6, -14], [57, 12, 5.2, 18], [47, 19, 4.8, 8]];
      for (const [x, dy, r, rot] of ice) if (top + dy + r < PUREE_Y) s += iceCube(x, top + dy, r, rot);
      // the surface: foam on the matcha, milk while only milk is in
      const sc = top < MILK_Y ? C.foam : mix(C.milk, '#ffffff', 0.4);
      s += ellipse(50, top, glassX(top) - 2.2, surfaceRy(top), sc) + ellipse(48, top - 0.4, glassX(top) - 8, surfaceRy(top) * 0.55, '#ffffff', op(0.35));
      if (top < MILK_Y) for (const [x, dx] of [[38, 0], [60, 1], [52, -1]]) s += circle(x + dx, top + 0.4, 0.9, '#ffffff', op(0.6));
    }
  }
  if (stream) {
    // the stream from the machine above (the drawn machine; the 3D machine pours its own)
    const col = fill < MATCHA_MILK ? C.milk : C.light;
    const yEnd = full ? top : GL.floor;
    const jet = `M47.6 ${f(from)}H52.4L51.8 ${f(yEnd)}H48.2Z`;
    s += path(jet, col) + path(jet, paint('cyl'));
    s += ellipse(50, yEnd, 5.5, 1.6, lighten(col, 0.4));
  }
  // the straw and the fruit on the rim of a ready glass (the straw stands in the drink, behind the front wall)
  if (state === 'ready') {
    const S = MATCHA_STRAW;
    const at = (t) => [S.x0 + (S.x1 - S.x0) * t, S.y0 + (S.y1 - S.y0) * t];
    const straw = `M${S.x0} ${f(S.y0)}L${S.x1} ${S.y1}`;
    s += line(straw, '#7a8f3c', S.w) + line(straw, '#f6f1e4', S.w - 1.2);
    // printed stripes of a paper straw
    for (const t of [0.2, 0.5, 0.8]) {
      const [x, y] = at(t);
      s += line(`M${f(x - 2.2)} ${f(y + 1.6)}L${f(x + 2.2)} ${f(y - 0.8)}`, '#86a83f', 1.6);
    }
    const [hx0, hy0] = at(0.05);
    const [hx1, hy1] = at(0.93);
    s += line(`M${f(hx0 + 0.4)} ${f(hy0)}L${f(hx1 - 0.2)} ${f(hy1)}`, '#ffffff', 1.1, op(0.75));
  }
  // the near wall: clear glass, condensation, highlights, the thick base
  s += path(GLASS_BODY, paint('glass', '#ffffff'), op(0.55));
  if (full) {
    const rng = rngFor(`drops-matcha-${fruit}`);
    for (let i = 0; i < 10; i++) {
      const y = Math.max(top + 3, GL.top + 6) + rng.next() * (GL.floor - Math.max(top + 3, GL.top + 6));
      const x = 50 + (rng.next() < 0.5 ? -1 : 1) * (glassX(y) - 2.5 - rng.next() * 9);
      const r = 0.6 + rng.next() * 0.8;
      s += circle(x, y, r, WHITE, op(0.6)) + circle(x + r * 0.3, y + r * 0.35, r * 0.5, '#000000', op(0.12));
    }
  }
  s += path(`M${f(50 - GL.brx + 0.6)} ${GL.floor}A${GL.brx - 0.6} ${f(GL.bry)} 0 0 0 ${f(50 + GL.brx - 0.6)} ${GL.floor}L${f(50 + GL.brx)} ${GL.bot}A${GL.brx} ${GL.bry} 0 0 1 ${f(50 - GL.brx)} ${GL.bot}Z`, '#dceef4', op(0.65));
  s += ellipse(50, GL.floor, GL.brx - 0.8, GL.bry * 0.9, 'none', stroke(0.9, '#ffffff') + op(0.8));
  s += line(`M${50 - GL.rx + 4} ${GL.top + 6}L${f(50 - GL.brx + 3.4)} ${GL.bot - 6}`, WHITE, 3, op(0.6));
  s += line(`M${50 - GL.rx + 9} ${GL.top + 9}L${f(50 - GL.brx + 7.5)} ${GL.bot - 26}`, WHITE, 1.1, op(0.45));
  s += line(`M${50 + GL.rx - 3.5} ${GL.top + 7}L${f(50 + GL.brx - 3)} ${GL.bot - 7}`, WHITE, 1.6, op(0.55));
  s += path(GLASS_BODY, 'none', stroke(1.1, '#6f909c') + op(0.65));
  s += ellipse(50, GL.top, GL.rx, GL.ry, 'none', stroke(2, '#ffffff') + op(0.95));
  s += path(`M${50 - GL.rx} ${GL.top + 0.9}A${GL.rx} ${GL.ry} 0 0 0 ${50 + GL.rx} ${GL.top + 0.9}`, 'none', stroke(0.7, '#7f9fab') + op(0.7));
  if (state === 'ready') s += garnish(fruit, 30, GL.top - 2);
  return svgWrap(size, size, 100, 100, s);
}

// ======================================================================
// What the player carries while dragging from a container (viewBox 100×100): a handful of pieces or
// coconut chips, a spoonful of nibs or peanut butter, the measuring spoon of chia seeds, a mint
// sprig, the honey dipper dripping honey, the chocolate's whole squeeze bottle tipped to pour
// ======================================================================
const HANDFUL = {
  banana: { n: 5, r: 22, size: 19 },
  strawberry: { n: 5, r: 21, size: 18 },
  blueberry: { n: 8, r: 20, size: 11 },
  mango: { n: 6, r: 20, size: 12 },
  kiwi: { n: 4, r: 21, size: 19 },
  granola: { n: 8, r: 22, size: 12 },
  coconut: { n: 11, r: 21, size: 14, draw: coconutChip },
};

function spoon(body) {
  let s = softShadow(46, 82, 34, 6);
  s += path('M64 64L92 86Q95 89 92 92Q89 95 86 92L58 70Z', paint('steel', '#cfd6dc'), stroke(1, '#5f6a75'));
  s += ellipse(42, 58, 30, 18, paint('steel-v', '#cfd6dc'), stroke(1.2, '#5f6a75'));
  s += ellipse(42, 56, 26, 14, paint('steel-in', '#a9b2bb'));
  return s + body + line('M20 52Q30 44 44 43', WHITE, 1.6, op(0.6));
}

// The chia glass's round measuring spoon (a deep steel cup on a flat handle).
function measuringSpoon(body) {
  let s = softShadow(44, 84, 30, 6);
  s += path('M62 60L93 74Q96 76 94.5 79Q93 82 90 80.6L59 67Z', paint('steel', '#cfd6dc'), stroke(1, '#5f6a75')) + line('M64 62L91 74.6', WHITE, 1.2, op(0.7));
  const cup = 'M18 54Q19 80 42 80Q65 80 66 54Z';
  s += path(cup, paint('steel-v', '#cfd6dc'), stroke(1.2, '#5f6a75')) + path(cup, paint('cyl'), op(0.5));
  s += ellipse(42, 54, 24, 10, '#7d8792', stroke(1.2, '#5f6a75')) + ellipse(42, 54, 22, 8.6, paint('steel-in', '#a9b2bb'));
  return s + body + line('M22 62Q24 74 34 77', WHITE, 2, op(0.6));
}

// The chocolate's squeeze bottle tipped over to pour, a thread of sauce from its nozzle.
function pouringBottle() {
  const c = SAUCE.chocolate;
  let s = softShadow(40, 92, 24, 4.5);
  s += path('M24 66C25 76 22 82 23 88A4.4 4.4 0 0 0 31.6 88C32 82 29 76 30 66Z', c.col, stroke(0.9, c.dark)) + circle(25.4, 88, 1.2, WHITE, op(0.6));
  const bottle = squeezeBottle(50, 92, 30, 74, '#3d1e10', '#f3e7d3', '#2a130a', ellipse(50, 66, 6, 4, '#7a3f1d'));
  return s + g('rotate(-148 50 50) translate(0 -8)', bottle);
}

export function scoopSVG(id, size = 84) {
  return memo(`scoop|${id}|${size}`, () => {
    const rng = rngFor(`scoop-${id}`);
    let s = '';
    const hand = HANDFUL[id];
    if (hand) {
      s += softShadow(50, 84, 32, 6);
      const spec = PIECES[id] || {};
      const pts = [];
      for (let i = 0; i < hand.n; i++) {
        const a = (i / hand.n) * Math.PI * 2 + rng.next() * 0.5;
        const r = i === 0 ? 0 : hand.r * (0.7 + rng.next() * 0.4);
        pts.push({ x: 50 + Math.cos(a) * r, y: 56 + Math.sin(a) * r * 0.62 - (i === 0 ? 10 : 0) });
      }
      pts.sort((p, q) => p.y - q.y);
      const draw = hand.draw || spec.draw;
      for (const p of pts) s += draw(p.x, p.y, hand.size * (0.9 + rng.next() * 0.2), rng, 0.72);
    } else if (id === 'honey') {
      const c = SAUCE.honey;
      // the dipper lifted out of the bowl, honey running off its head
      s += softShadow(34, 94, 20, 3.5);
      s += path('M22 76C23 82 21 86 22 89A4.6 4.6 0 0 0 31 89C31 85 27 82 28 76Z', c.col, stroke(0.9, c.dark)) + circle(24.6, 89.4, 1.3, WHITE, op(0.8));
      s += g('translate(28 66) scale(1.85) translate(-28 -66)', honeyDipper(28, 66, -38, c.col, c.hi, c.dark));
    } else if (id === 'chocolate') {
      s += pouringBottle();
    } else if (SAUCE[id]) {
      const c = SAUCE[id];
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
      s += measuringSpoon(seeds);
    } else if (id === 'cacao') {
      let nibs = '';
      for (let i = 0; i < 16; i++) nibs += cacaoNib(22 + rng.next() * 40, 44 + rng.next() * 12, 3.2 + rng.next() * 1.4, rng);
      s += spoon(nibs);
    } else {
      s += iconBody(id);
    }
    return svgWrap(size, size, 100, 100, s);
  });
}
