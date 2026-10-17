// Kitchen art for Açaí Fever: the commercial blender, the smoothie machine, the trash can and
// the back wall of the café. Same realistic look as art-food.js (shared gradients from svg.js).
// Pure module.

import { ING } from './data.js';
import { t } from './i18n.js';
import {
  WHITE, f, rngFor, memo, mix, lighten, esc, uid, svgWrap, stroke, op, tf, circle, ellipse, path, rect, g, line,
  rrect, paint, lit, litCircle, softShadow, edge,
} from './svg.js';
import { cupArt, pureeOf } from './art-food.js';

const FONT = `'Lilita One', 'Trebuchet MS', system-ui, sans-serif`;
const OK = '#2fbf71';
const BAD = '#ff4d4d';
const LAGOON = '#18c2c9';

// ======================================================================
// Blender (viewBox 150×150): black motor base, clear jug, black lid
// ======================================================================
const JUG_TOP = 34;
const JUG_BOT = 102;
const jugL = (y) => 36 + ((y - JUG_TOP) * 12) / (JUG_BOT - JUG_TOP);
const jugR = (y) => 114 - ((y - JUG_TOP) * 12) / (JUG_BOT - JUG_TOP);
const JUG = `M36 ${JUG_TOP}L48 ${JUG_BOT - 3}Q48.5 ${JUG_BOT} 52 ${JUG_BOT}H98Q101.5 ${JUG_BOT} 102 ${JUG_BOT - 3}L114 ${JUG_TOP}Z`;

// Contents from yTop down to the jug floor, inset from the plastic. data-fill names the level for tests.
function jugFill(yTop, col, inset = 3) {
  const y2 = JUG_BOT - 3;
  const d = `M${f(jugL(yTop) + inset)} ${f(yTop)}H${f(jugR(yTop) - inset)}L${f(jugR(y2) - inset)} ${y2}H${f(jugL(y2) + inset)}Z`;
  return `<path data-fill="${f(yTop)}" d="${d}" fill="${col}"/>` + path(d, paint('cyl'));
}

// portions/maxPortions: bowls left in a ready jug – the level drops with every pour (the lamps
// on the base repeat the count). Callers without portions get a full jug.
function blenderContents(state, p, progress, portions, maxPortions) {
  const surf = (y, c, dip = 0) => path(`M${f(jugL(y) + 3)} ${y}Q75 ${y + 4 + dip} ${f(jugR(y) - 3)} ${y}Q75 ${y - 4} ${f(jugL(y) + 3)} ${y}Z`, c);
  if (state === 'blending') {
    const y = 52;
    const turn = (progress || 0) * Math.PI * 6;
    let s = jugFill(y, p.main) + surf(y, p.light, 10);
    // vortex and swirling streaks
    for (let i = 0; i < 3; i++) {
      const yy = 64 + i * 11;
      const w = Math.sin(turn + i) * 4;
      s += line(`M${f(jugL(yy) + 6 + w)} ${yy}Q75 ${yy + 7} ${f(jugR(yy) - 6 + w)} ${yy - 2}`, p.light, 3, op(0.55));
    }
    s += path(`M68 ${y + 1}Q75 ${y + 16} 82 ${y + 1}Z`, p.dark, op(0.6));
    for (const [x, yy, r] of [[60, 70, 1.8], [88, 80, 1.5], [70, 90, 1.3], [92, 64, 1.2]]) s += circle(x, yy, r, WHITE, op(0.7));
    return s;
  }
  if (state === 'ready') {
    // full → 50; 1 of 2 → 66; 2 of 3 → 61, 1 of 3 → 71. A ready jug always keeps a clear layer.
    const n = Math.max(1, maxPortions || 1);
    const k = Math.max(1, Math.min(n, portions ?? n));
    const y = Math.round(50 + (1 - k / n) * 32);
    return jugFill(y, p.main) + surf(y, mix(p.main, p.light, 0.5)) + ellipse(62, y - 0.5, 10, 1.6, WHITE, op(0.5)) +
      line(`M56 ${y + 12}Q60 ${Math.min(92, y + 28)} 58 96`, p.light, 2.6, op(0.4));
  }
  if (state === 'overflowing') {
    return jugFill(37, p.main, 2.5) + line('M56 52Q60 74 58 96', p.light, 2.6, op(0.4));
  }
  if (state === 'ruined') {
    const sl = '#7d6f5c';
    let s = jugFill(58, sl);
    s += path(`M${f(jugL(58) + 3)} 58Q52 50 62 57Q70 50 78 57Q88 49 96 57Q102 52 ${f(jugR(58) - 3)} 58Z`, '#8f826d');
    for (const [x, y, r] of [[58, 74, 4], [84, 82, 5], [70, 92, 3.2], [92, 68, 2.5]]) s += circle(x, y, r, '#5d5446', op(0.9));
    s += circle(66, 56, 3, '#a7c070', op(0.8)) + circle(88, 54, 2.2, '#a7c070', op(0.8));
    return s;
  }
  return '';
}

function motorBase(state, o) {
  const d = 'M44 106H106Q111 106 112 111L116 139Q117 145 111 145H39Q33 145 34 139L38 111Q39 106 44 106Z';
  let s = path(d, paint('black', '#1d1d22'), stroke(1, '#000000'));
  s += line('M42 112L39 138', WHITE, 1.6, op(0.25)) + line('M44 107.5H106', WHITE, 1, op(0.3));
  // control panel
  s += path(rrect(48, 114, 54, 24, 6), '#2a2a31', stroke(1, '#4a4a54'));
  s += path(rrect(48, 114, 54, 24, 6), paint('down'));
  const ang = { empty: -150, blending: 20, ready: -90, overflowing: -30, ruined: -150 }[state] ?? -150;
  const a = (ang * Math.PI) / 180;
  s += circle(60, 126, 7.5, paint('steel', '#cfd6dc'), stroke(1, '#0e0e12')) + litCircle(60, 126, 7.5, 'sph');
  s += line(`M60 126L${f(60 + Math.cos(a) * 5.5)} ${f(126 + Math.sin(a) * 5.5)}`, '#1d1d22', 2);
  const n = Math.max(1, Math.min(4, o.maxPortions || 2));
  const left = state === 'ready' || state === 'overflowing' ? Math.max(0, Math.min(n, o.portions ?? n)) : 0;
  const gap = Math.min(10, 26 / Math.max(1, n - 1));
  const r = Math.min(3.4, gap * 0.36);
  for (let i = 0; i < n; i++) {
    const x = 85 + (i - (n - 1) / 2) * gap;
    const on = i < left;
    if (on) s += circle(x, 126, r * 2.2, OK, op(0.3));
    s += circle(x, 126, r, on ? '#5df09a' : '#4a4a52', stroke(0.8, on ? '#1f8a4c' : '#202026'));
  }
  if (state === 'blending') s += circle(98, 118.5, 1.6, '#ffcf3a') + circle(98, 118.5, 3.4, '#ffcf3a', op(0.3));
  return s;
}

function lid() {
  return path(rrect(32, 25, 86, 11, 5), paint('black-v', '#2a2a31'), stroke(1, '#000000')) +
    line('M38 28.5H96', WHITE, 1.4, op(0.35)) +
    path(rrect(64, 16, 22, 11, 4), paint('black-v', '#2a2a31'), stroke(1, '#000000')) + line('M68 18.5H80', WHITE, 1.2, op(0.35));
}

function badge(cx, cy, fill, inner) {
  return circle(cx, cy + 2, 13.5, '#000000', op(0.22)) + circle(cx, cy, 13.5, WHITE) + circle(cx, cy, 11, fill) + litCircle(cx, cy, 11, 'sph-soft') + inner;
}

export function blenderSVG(opts = {}, size = 150) {
  const o = opts || {};
  const state = ['empty', 'blending', 'ready', 'overflowing', 'ruined'].includes(o.state) ? o.state : 'empty';
  // progress is quantised so the cache stays small while the ring still moves smoothly
  const p = state === 'blending' ? Math.round(Math.max(0, Math.min(1, Number(o.progress) || 0)) * 48) / 48 : 0;
  const key = `x|${state}|${o.base}|${p}|${o.portions}|${o.maxPortions}|${o.badge !== false}|${size}`;
  return memo(key, () => drawBlender(state, o, p, size));
}

function drawBlender(state, o, prog, size) {
  const p = pureeOf(ING[o.base]?.layer === 'base' ? o.base : 'acai');
  let s = softShadow(76, 145, 52, 6);
  if (state === 'blending') s += line('M22 52Q16 64 22 76M14 58Q10 64 14 70M134 104Q140 96 138 86', '#5b4b66', 2.4, op(0.5));
  // handle (behind the jug's right edge)
  s += path('M108 42H124Q132 42 131 50L128 84Q127 92 119 92H104', 'none', stroke(9, '#141418'));
  s += path('M108 42H124Q132 42 131 50L128 84Q127 92 119 92H104', 'none', stroke(3, '#3c3c44') + op(0.8));
  // jug: far wall tint, contents, blade, near wall
  s += path(JUG, paint('plastic-in', '#eaf6fa'));
  s += blenderContents(state, p, prog, o.portions, o.maxPortions);
  s += path(`M62 ${JUG_BOT - 5}L88 ${JUG_BOT - 9}M62 ${JUG_BOT - 9}L88 ${JUG_BOT - 5}`, 'none', stroke(2.6, '#aeb7c1'));
  s += circle(75, JUG_BOT - 7, 2.6, '#7f8a95');
  s += path(JUG, paint('plastic', '#ffffff'));
  s += line('M43 42L52 96', WHITE, 3.4, op(0.6)) + line('M52 42L53.5 56', WHITE, 1.6, op(0.5)) + line('M108 42L99 96', WHITE, 1.4, op(0.45));
  for (const y of [50, 62, 74, 86]) s += line(`M${f(jugL(y) + 4)} ${y}H${f(jugL(y) + 10)}`, WHITE, 1.3, op(0.75));
  s += path(JUG, 'none', stroke(1.2, '#6f909c') + op(0.7));
  // collar between jug and base
  s += path(rrect(45, 99, 60, 9, 3), paint('black-v', '#2a2a31'), stroke(1, '#000000'));
  if (state === 'overflowing') {
    const foam = 'M30 37C20 35 22 19 36 21C38 7 58 5 64 15C72 3 96 5 98 17C114 13 124 27 114 37Z';
    s += path(foam, p.main, stroke(1.2, edge(p.main))) + lit(foam, 'sph-soft') + ellipse(48, 21, 8, 3, WHITE, op(0.45));
    for (const [x, y1, y2, w] of [[36, 34, 64, 6], [112, 34, 54, 5], [72, 37, 46, 4.5]]) {
      s += path(`M${x - w / 2} ${y1}V${y2 - w / 2}A${w / 2} ${w / 2} 0 0 0 ${x + w / 2} ${y2 - w / 2}V${y1}Z`, p.main, stroke(1, edge(p.main))) + line(`M${x - w * 0.15} ${y1 + 2}V${y2 - w}`, p.light, 1, op(0.7));
    }
    s += ellipse(38, 108, 11, 3, p.main, stroke(1, edge(p.main)));
    s += g('translate(-20 -3) rotate(-22 75 32)', lid());
  } else {
    s += lid();
  }
  if (state === 'ruined') {
    s += line('M52 18Q46 12 52 6Q58 0 52 -6M98 18Q92 12 98 6Q104 0 98 -6M75 14Q69 8 75 2', '#8fa86a', 2.6, op(0.9));
    s += circle(26, 40, 2.2, '#1d1d22') + ellipse(24.2, 37.4, 2.4, 1.4, WHITE, op(0.85)) + ellipse(28, 37.4, 2.4, 1.4, WHITE, op(0.85));
  }
  s += motorBase(state, o);
  // decorative use (shop cards, badge:false): no status badge, so a ✓ never reads as "already bought"
  if (o.badge !== false) s += statusBadge(state, prog);
  return svgWrap(size, size, 150, 150, s);
}

// Status badge at the blender's top right (viewBox units of blenderSVG): progress ring, ✓, !, spoiled.
function statusBadge(state, prog) {
  if (state === 'blending') {
    const r = 8;
    const len = 2 * Math.PI * r;
    // data-ring: the game view updates this ring's dasharray in place instead of re-rendering the art
    return circle(127, 24, 13.5, '#000000', op(0.22)) + circle(127, 22, 13.5, WHITE) + circle(127, 22, r, 'none', stroke(4.5, '#e1e8ee')) +
      `<circle data-ring="${f(len)}" opacity="${prog > 0 ? 1 : 0}" cx="127" cy="22" r="${r}" fill="none" stroke="${LAGOON}" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="${f(len * prog)} ${f(len)}" transform="rotate(-90 127 22)"/>`;
  }
  if (state === 'ready') return badge(127, 22, OK, line('M121 22.5L125.5 27L133.5 18', WHITE, 3.4));
  if (state === 'overflowing') return badge(127, 22, BAD, rect(125.2, 14, 3.6, 10.5, 1.8, WHITE) + circle(127, 28.5, 2.1, WHITE));
  if (state === 'ruined') {
    return badge(127, 22, '#7d6e8a', rect(122, 18, 10, 10, 2, WHITE) + rect(120, 15, 14, 2.6, 1.3, WHITE) + line('M125.3 20.5V25.5M128.7 20.5V25.5', '#7d6e8a', 1.3));
  }
  return '';
}

// The badge alone (size px wide), laid over the 3D blender; empty markup for an empty blender.
export function blenderBadgeSVG(state, size = 30) {
  return memo(`xb|${state}|${size}`, () => {
    const s = statusBadge(state, 0);
    if (!s) return '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="112 6.5 30 32" width="${f(size)}" height="${f((size * 32) / 30)}" aria-hidden="true" focusable="false" stroke-linejoin="round" stroke-linecap="round">${s}</svg>`;
  });
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
  return memo(`m|${n}|${size}`, () => {
    const xs = SMOOTHIE_SLOT_X[n].map((q) => q * 200);
    let s = softShadow(100, 192, 92, 8);
    s += rect(30, 184, 18, 10, 3, '#1d1d22') + rect(152, 184, 18, 10, 3, '#1d1d22');
    // steel body
    s += path(rrect(14, 28, 172, 162, 16), paint('steel', '#cfd6dc'), stroke(1.2, '#6f7a85'));
    s += line('M20 40V178', WHITE, 2.4, op(0.6));
    // dark glass back where the cups stand
    s += path(rrect(26, 80, 148, 98, 10), '#1f2229', stroke(1, '#0c0d10'));
    s += path(rrect(26, 80, 148, 98, 10), paint('down'));
    s += line('M34 88L64 170M48 88L70 140', WHITE, 2, op(0.1));
    // head with the display
    s += path(rrect(8, 8, 184, 74, 18), paint('steel-v', '#dfe4e9'), stroke(1.2, '#6f7a85'));
    s += line('M24 14H150', WHITE, 2, op(0.8));
    s += path(rrect(54, 20, 92, 46, 10), '#14161c', stroke(1, '#000000'));
    s += path(rrect(54, 20, 92, 46, 10), paint('down'));
    // display: a glowing smoothie cup and two status dots
    s += path('M88 30H112L108.5 56H91.5Z', '#ff6fa8', op(0.95)) + path('M88 30H112L111.3 35H88.7Z', '#ffd3e6');
    s += line('M103 31L109 22', '#ffd3e6', 2.2);
    s += circle(100, 43, 18, '#ff6fa8', op(0.12));
    s += circle(30, 44, 6.5, '#ffb627', stroke(1, '#a8690a')) + litCircle(30, 44, 6.5, 'sph');
    s += circle(170, 44, 6.5, OK, stroke(1, '#1f7a4a')) + litCircle(170, 44, 6.5, 'sph');
    // nozzles
    for (const x of xs) {
      s += path(`M${x - 12} 80H${x + 12}L${x + 7} 94H${x - 7}Z`, paint('steel', '#cfd6dc'), stroke(1, '#6f7a85'));
      s += rect(x - 3.5, 93, 7, 5, 2, '#5b6570');
    }
    // drip tray
    let grate = '';
    for (let x = 30; x < 172; x += 8) grate += `M${x} 177V185`;
    s += path(rrect(20, 172, 160, 16, 5), paint('steel-v', '#cfd6dc'), stroke(1.2, '#6f7a85'));
    s += line(grate, '#7f8a95', 2.2) + line('M26 175H174', WHITE, 1.4, op(0.8));
    return svgWrap(size, size, 200, 200, s);
  });
}

// ======================================================================
// Trash can (viewBox 100×100): stainless pedal bin
// ======================================================================
export function trashSVG(size = 64) {
  return memo(`t|${size}`, () => {
    let s = softShadow(50, 95, 34, 5);
    const body = 'M22 34H78L75 88Q74.5 94 68 94H32Q25.5 94 25 88Z';
    s += path(body, paint('steel', '#cfd6dc'), stroke(1.2, '#5f6a75'));
    s += line('M30 40L32 88', WHITE, 3, op(0.55)) + line('M70 40L68 88', '#000000', 2, op(0.12));
    s += path('M25 86H75', 'none', stroke(1, '#7f8a95') + op(0.8));
    // pedal
    s += path(rrect(38, 89, 24, 7, 2.5), '#1d1d22', stroke(1, '#000000')) + line('M41 91H58', WHITE, 1, op(0.3));
    // lid
    s += path('M19 34Q19 22 50 20Q81 22 81 34Z', paint('black-v', '#2a2a31'), stroke(1.2, '#000000'));
    s += line('M27 29Q38 24 54 24', WHITE, 1.6, op(0.35));
    s += path(rrect(18, 32, 64, 5, 2), paint('steel-v', '#dfe4e9'), stroke(1, '#5f6a75'));
    return svgWrap(size, size, 100, 100, s);
  });
}

// ======================================================================
// Café back wall (1280×330 stage px; the lower part stays calm behind the customers)
// ======================================================================
function pendant(x, cordLen, glowId) {
  const y = cordLen;
  let s = line(`M${x} 0V${y}`, '#1d1d22', 1.6);
  s += ellipse(x, y + 26, 70, 46, `url(#${glowId})`);
  s += path(`M${x - 22} ${y + 20}Q${x - 20} ${y} ${x} ${y}Q${x + 20} ${y} ${x + 22} ${y + 20}Z`, paint('black-v', '#2a2a31'), stroke(1, '#000000'));
  s += line(`M${x - 14} ${y + 8}Q${x - 6} ${y + 3} ${x + 4} ${y + 3}`, WHITE, 1.4, op(0.35));
  s += ellipse(x, y + 20, 22, 3.6, '#2a2a31');
  s += ellipse(x, y + 21, 9, 5, '#fff3c8') + circle(x, y + 22, 3, WHITE);
  return s;
}

function plantPot(x, y, k = 1) {
  let s = softShadow(x, y + 30 * k, 26 * k, 5 * k);
  const rng = rngFor(`plant-${x}`);
  const leafCol = ['#2f8a4a', '#3aa35a', '#277a40'];
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.34 + (rng.next() - 0.5) * 0.2;
    const len = (30 + rng.next() * 18) * k;
    const ex = x + Math.cos(a) * len;
    const ey = y + Math.sin(a) * len;
    s += line(`M${x} ${y}Q${f(x + Math.cos(a) * len * 0.4)} ${f(y + Math.sin(a) * len * 0.6)} ${f(ex)} ${f(ey)}`, '#2a6b36', 1.6 * k);
    const L = 18 * k;
    const W = 9 * k;
    const deg = (a * 180) / Math.PI;
    s += g(`translate(${f(ex)} ${f(ey)}) rotate(${f(deg)})`, path(`M0 0C${f(L * 0.3)} ${f(-W)} ${f(L * 0.8)} ${f(-W * 0.6)} ${f(L)} 0C${f(L * 0.8)} ${f(W * 0.6)} ${f(L * 0.3)} ${f(W)} 0 0Z`, leafCol[i % 3], stroke(0.8, '#1d5a2c')) + line(`M2 0H${f(L * 0.85)}`, '#7fd398', 0.8, op(0.7)));
  }
  const pot = `M${x - 18 * k} ${y}H${x + 18 * k}L${x + 14 * k} ${y + 30 * k}H${x - 14 * k}Z`;
  s += path(pot, '#e9e2d6', stroke(1, '#b3a894')) + path(pot, paint('cyl-soft')) + rect(x - 19 * k, y - 3 * k, 38 * k, 6 * k, 2 * k, '#f4efe6', stroke(1, '#b3a894'));
  return s;
}

function hangingPlant(x, y, len) {
  const rng = rngFor(`vine-${x}`);
  let s = '';
  for (let v = -1; v <= 1; v++) {
    const vx = x + v * 9;
    const l = len * (0.7 + rng.next() * 0.4);
    s += line(`M${vx} ${y}Q${vx + v * 6} ${y + l * 0.5} ${vx + v * 3} ${y + l}`, '#2a6b36', 1.2);
    for (let k = 0.15; k < 1; k += 0.14) {
      const lx = vx + v * 6 * k + (rng.next() - 0.5) * 6;
      const ly = y + l * k;
      s += ellipse(lx + 4, ly, 5.2, 3.4, rng.next() < 0.5 ? '#3aa35a' : '#2f8a4a', stroke(0.6, '#1d5a2c') + tf(`rotate(${f(rng.next() * 60 - 30)} ${f(lx + 4)} ${f(ly)})`));
    }
  }
  return s;
}

function jar(x, y, w, h, fill, dots) {
  let s = softShadow(x + w / 2, y + h, w * 0.6, 3);
  s += path(rrect(x, y, w, h, 6), '#eef7f9', stroke(1, '#9fb6bf'));
  s += path(rrect(x + 3, y + h * 0.3, w - 6, h * 0.7 - 3, 4), fill);
  const rng = rngFor(`jar-${x}`);
  for (let i = 0; i < 10; i++) s += circle(x + 5 + rng.next() * (w - 10), y + h * 0.35 + rng.next() * (h * 0.6 - 6), 1.8 + rng.next() * 1.2, dots);
  s += path(rrect(x, y, w, h, 6), paint('glass'));
  s += line(`M${x + 6} ${y + 6}V${y + h - 8}`, WHITE, 2.4, op(0.6));
  s += path(rrect(x - 2, y - 6, w + 4, 8, 3), '#c99a63', stroke(1, '#8f6331')) + path(rrect(x - 2, y - 6, w + 4, 8, 3), paint('cyl-soft'));
  return s;
}

function miniCup(x, y, k, base) {
  return g(`translate(${f(x - 100 * k)} ${f(y - 100 * k)}) scale(${k})`, cupArt({ base, mid: [], top: [] }));
}

export function shopSceneSVG(width = 1280, height = 330) {
  const W = 1280;
  const H = 330;
  const wallId = uid('wall');
  const glowId = uid('glow');
  const skyId = uid('sky');
  const seaId = uid('sea');
  const winClip = uid('win');
  let s = `<defs><linearGradient id="${wallId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4ece2"/><stop offset="1" stop-color="#e9dccb"/></linearGradient>` +
    `<radialGradient id="${glowId}" cx="0.5" cy="0.3" r="0.6"><stop offset="0" stop-color="#ffdca0" stop-opacity="0.55"/><stop offset="0.5" stop-color="#ffd58c" stop-opacity="0.18"/><stop offset="1" stop-color="#ffd58c" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="${skyId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd0f2"/><stop offset="1" stop-color="#d6f1fb"/></linearGradient>` +
    `<linearGradient id="${seaId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1fa2c4"/><stop offset="1" stop-color="#5fd2d8"/></linearGradient>` +
    `<clipPath id="${winClip}"><rect x="478" y="86" width="324" height="140" rx="6"/></clipPath></defs>`;
  s += rect(0, 0, W, H, 0, `url(#${wallId})`);
  // soft plaster texture
  const rng = rngFor('wall-texture');
  let tex = '';
  for (let i = 0; i < 70; i++) tex += ellipse(rng.next() * W, 20 + rng.next() * 210, 20 + rng.next() * 50, 6 + rng.next() * 12, '#ffffff', op(0.12));
  s += tex;
  // fluted oak panel along the bottom of the wall
  s += rect(0, 232, W, 98, 0, '#d2a874');
  let flutes = '';
  for (let x = 0; x < W; x += 14) flutes += `M${x + 0.5} 236V330`;
  s += line(flutes, '#a77a46', 2, op(0.7));
  let shine = '';
  for (let x = 6; x < W; x += 14) shine += `M${x} 236V330`;
  s += line(shine, '#ecc896', 2.4, op(0.6));
  s += rect(0, 232, W, 98, 0, paint('down-dark'));
  s += rect(0, 226, W, 8, 0, '#6b4a33') + rect(0, 226, W, 3, 0, '#8d6649');

  // window with a beach view
  let view = rect(478, 86, 324, 140, 0, `url(#${skyId})`);
  view += circle(740, 120, 30, '#fff6c4', op(0.5)) + circle(740, 120, 18, '#fffbe2');
  for (const [cx, cy, k] of [[540, 116, 1], [650, 104, 0.8]]) {
    view += ellipse(cx, cy, 28 * k, 8 * k, WHITE, op(0.85)) + ellipse(cx + 12 * k, cy - 5 * k, 16 * k, 8 * k, WHITE, op(0.85)) + ellipse(cx - 12 * k, cy - 3 * k, 12 * k, 6 * k, WHITE, op(0.8));
  }
  view += rect(478, 168, 324, 58, 0, `url(#${seaId})`) + rect(478, 168, 324, 3, 0, '#178fb0', op(0.6));
  view += line('M500 190q10 -4 20 0M590 202q10 -4 20 0M680 186q10 -4 20 0M720 210q10 -4 20 0M540 214q10 -4 20 0', WHITE, 1.6, op(0.6));
  view += path('M478 214Q560 200 640 210T802 206V226H478Z', '#f2d7a2');
  // palm silhouette
  view += line('M770 226Q764 190 776 150', '#8a6a4a', 5);
  for (const deg of [-160, -120, -70, -30, 10]) {
    const a = (deg * Math.PI) / 180;
    view += path(`M776 150Q${f(776 + Math.cos(a) * 30)} ${f(150 + Math.sin(a) * 30 - 10)} ${f(776 + Math.cos(a) * 54)} ${f(150 + Math.sin(a) * 54 + 6)}Q${f(776 + Math.cos(a) * 28)} ${f(150 + Math.sin(a) * 28 + 2)} 776 150Z`, '#2f8a4a', op(0.92));
  }
  s += path(rrect(470, 78, 340, 156, 10), '#2a2a31');
  s += `<g clip-path="url(#${winClip})">${view}</g>`;
  s += rect(638, 86, 4, 140, 0, '#2a2a31');
  s += line('M500 92L540 222M560 92L580 150', WHITE, 8, op(0.16));
  s += path(rrect(462, 230, 356, 10, 3), '#e9e2d6', stroke(1, '#b3a894'));

  // menu boards (left): two black boards with the bowls and prices
  const board = (x, y, w, h) => path(rrect(x, y, w, h, 6), '#23252b', stroke(2, '#121317')) + path(rrect(x, y, w, h, 6), paint('down')) + line(`M${x + 8} ${y + 6}H${x + w - 8}`, WHITE, 1, op(0.15));
  s += line('M96 60V78M260 60V78', '#1d1d22', 1.6) + board(70, 76, 216, 140);
  s += `<text x="178" y="104" text-anchor="middle" font-family="${FONT}" font-size="22" fill="#ffffff" letter-spacing="2">${esc(t('art.menu'))}</text>`;
  s += line('M100 112H256', '#ffffff', 1, op(0.3));
  // tiny cups on the board: just the purée (the toppings would not be visible at this size)
  const items = [['acai', '5'], ['pitaya', '7'], ['spirulina', '9']];
  items.forEach(([base, price], i) => {
    const y = 136 + i * 28;
    s += miniCup(102, y + 4, 0.15, base);
    s += line(`M122 ${y + 2}H226`, '#ffffff', 1.2, op(0.25) + ' stroke-dasharray="2 4"');
    s += circle(240, y, 7, '#ffcf3a', stroke(1, '#a8690a')) + `<text x="254" y="${y + 6}" font-family="${FONT}" font-size="17" fill="#ffffff">${price}</text>`;
  });

  // shelves (right) with jars, a stack of cups and plants
  const shelf = (x, y, w) => path(rrect(x, y, w, 8, 2), '#c49465', stroke(1, '#7d5531')) + rect(x, y + 8, w, 3, 0, '#000000', op(0.12));
  s += shelf(950, 150, 270) + shelf(980, 212, 230);
  s += jar(966, 108, 34, 42, '#c98a3f', '#8f5a22') + jar(1008, 112, 30, 38, '#3a1446', '#6a3a80');
  s += plantPot(1080, 120, 0.85);
  s += g('translate(1118 98) scale(0.36)', cupStackShape());
  s += jar(1170, 112, 32, 38, '#f2e7cf', '#d6c49f');
  s += hangingPlant(1010, 220, 70) + plantPot(1180, 182, 0.9);
  // little light box standing on the shelf
  s += softShadow(1095, 212, 46, 4) + path(rrect(1052, 176, 86, 36, 6), '#23252b', stroke(1, '#121317')) + path(rrect(1052, 176, 86, 36, 6), paint('down'));
  s += `<text x="1095" y="201" text-anchor="middle" font-family="${FONT}" font-size="19" fill="#ffffff" letter-spacing="1.5">açaí</text>`;
  s += circle(1062, 186, 2.6, '#2fbf71') + circle(1128, 186, 2.6, '#ff3d8b');

  // pendant lamps with a warm glow
  for (const [x, len] of [[150, 30], [380, 24], [900, 24], [1160, 30]]) s += pendant(x, len, glowId);
  // ceiling beam
  s += rect(0, 0, W, 10, 0, '#4e3626') + rect(0, 10, W, 4, 0, '#000000', op(0.12));
  return svgWrap(width, height, W, H, s, ' preserveAspectRatio="xMidYMid slice"');
}

// Small stack of cups for the shelf (same drawing as the counter stack, without a shadow).
function cupStackShape() {
  const cx = 60;
  let s = '';
  for (let i = 5; i >= 0; i--) {
    const y = 40 + i * 9;
    s += path(`M${cx - 44} ${y}A44 13 0 0 0 ${cx + 44} ${y}`, 'none', stroke(3, '#ffffff') + op(0.95));
  }
  s += path(`M${cx - 44} 40V85L${cx - 30} 186H${cx + 30}L${cx + 44} 85V40A44 13 0 0 0 ${cx - 44} 40Z`, paint('plastic', '#ffffff'));
  s += path(`M${cx - 44} 40V85L${cx - 30} 186H${cx + 30}L${cx + 44} 85V40`, 'none', stroke(2, '#8fb0bd'));
  return s;
}

// ======================================================================
// Decor (viewBox 120×120): bought in the shop, stands in the café
// ======================================================================
function monsteraLeaf(x, y, len, deg, col) {
  const L = len;
  const W = len * 0.82;
  // heart-shaped leaf with the typical slits
  let d = `M0 0C${f(L * 0.05)} ${f(-W * 0.55)} ${f(L * 0.55)} ${f(-W * 0.62)} ${f(L)} ${f(-W * 0.05)}C${f(L * 0.6)} ${f(W * 0.6)} ${f(L * 0.08)} ${f(W * 0.58)} 0 0Z`;
  let slits = '';
  for (const k of [0.3, 0.52, 0.72]) {
    slits += `M${f(L * k)} ${f(-W * 0.04)}L${f(L * (k + 0.08))} ${f(-W * 0.42 * (1.1 - k * 0.6))}`;
    slits += `M${f(L * k)} ${f(W * 0.02)}L${f(L * (k + 0.06))} ${f(W * 0.44 * (1.1 - k * 0.6))}`;
  }
  const leafCol = col;
  return g(`translate(${f(x)} ${f(y)}) rotate(${f(deg)})`,
    path(d, leafCol, stroke(0.9, '#1d5a2c')) + path(d, paint('sph-soft')) +
    line(slits, '#f4ece2', Math.max(1, L * 0.035)) +
    line(`M${f(L * 0.04)} 0Q${f(L * 0.5)} ${f(-W * 0.06)} ${f(L * 0.94)} ${f(-W * 0.05)}`, lighten(leafCol, 0.35), 1.1, op(0.85)));
}

const DECOR = {
  plants() {
    let s = softShadow(60, 116, 30, 4);
    const stems = 'M60 86Q52 70 38 58M60 86Q60 62 62 38M60 86Q70 70 86 56M60 86Q50 82 30 80';
    s += line(stems, '#2a6b36', 2.2);
    s += monsteraLeaf(38, 58, 34, -150, '#2f8a4a') + monsteraLeaf(86, 56, 32, -30, '#37a257');
    s += monsteraLeaf(62, 40, 36, -92, '#3aa35a') + monsteraLeaf(30, 80, 24, 172, '#2a7d43');
    // ceramic pot
    const pot = 'M38 86H82L78 113Q77.5 116 74 116H46Q42.5 116 42 113Z';
    s += path(pot, '#efe9e0', stroke(1, '#a99f92')) + path(pot, paint('cyl'));
    s += path('M43 100H77', 'none', stroke(3, '#c97d43') + op(0.85));
    s += path(rrect(35, 81, 50, 7, 3), '#f7f3ec', stroke(1, '#a99f92')) + path(rrect(35, 81, 50, 7, 3), paint('cyl-soft'));
    return s;
  },

  jukebox() {
    let s = softShadow(60, 116, 42, 4);
    const body = 'M24 112V56A36 36 0 0 1 96 56V112Z';
    s += path(body, '#7a3a24', stroke(1, '#3d1a0f')) + path(body, paint('cyl'));
    // glowing tubes in the arch
    for (const [inset, col] of [[6, '#ffb627'], [11, '#ff3d8b'], [16, '#18c2c9']]) {
      const r = 36 - inset;
      s += path(`M${24 + inset} 108V56A${r} ${r} 0 0 1 ${96 - inset} 56V108`, 'none', stroke(7, col) + op(0.25));
      s += path(`M${24 + inset} 108V56A${r} ${r} 0 0 1 ${96 - inset} 56V108`, 'none', stroke(3.6, col));
      s += path(`M${24 + inset} 108V56A${r} ${r} 0 0 1 ${96 - inset} 56V108`, 'none', stroke(1.2, '#ffffff') + op(0.7));
    }
    // record window
    const win = 'M44 78V62A16 16 0 0 1 76 62V78Z';
    s += path(win, '#1c1a24', stroke(1, '#000000'));
    s += ellipse(60, 70, 12, 4, '#0c0b10', stroke(0.8, '#3a3346')) + circle(60, 70, 2.4, '#ff3d8b');
    s += path(win, paint('glass'));
    // chrome speaker grille
    s += path(rrect(44, 82, 32, 22, 4), paint('steel', '#cfd6dc'), stroke(1, '#5f6a75'));
    let bars = '';
    for (let y = 86; y < 102; y += 3) bars += `M47 ${y}H73`;
    s += line(bars, '#7f8a95', 1.2);
    for (const [x, c] of [[48, '#ffb627'], [54, '#2fbf71'], [66, '#18c2c9'], [72, '#ff3d8b']]) s += circle(x, 80, 1.6, c);
    s += path(rrect(20, 108, 80, 8, 3), paint('steel-v', '#dfe4e9'), stroke(1, '#5f6a75'));
    const note = (x, y, c) => line(`M${x + 4} ${y}V${y - 12}Q${x + 9} ${y - 10} ${x + 10} ${y - 6}`, '#3b2a33', 1.6) + ellipse(x, y, 4.4, 3.4, c, tf(`rotate(-20 ${x} ${y})`));
    s += note(10, 36, '#18c2c9') + note(102, 24, '#ffb627') + note(108, 50, '#2fbf71');
    return s;
  },

  seating() {
    let s = softShadow(56, 114, 54, 5);
    // velvet armchair
    const back = 'M10 102C6 70 14 50 40 48C64 46 74 60 72 100Z';
    s += path(back, '#d9467f', stroke(1, '#7a1a42')) + path(back, paint('sph'));
    s += line('M28 54V96M44 51V96M58 54V96', '#a8285c', 1.4, op(0.6));
    const seat = 'M6 96Q6 86 18 86H64Q76 86 76 96V104Q76 110 68 110H14Q6 110 6 104Z';
    s += path(seat, '#e65a91', stroke(1, '#7a1a42')) + path(seat, paint('down'));
    s += line('M14 116L16 110M68 116L66 110', '#6b4a33', 3);
    // side table with a smoothie
    s += line('M96 96V116M88 116H104', '#1d1d22', 2.6);
    s += ellipse(96, 94, 16, 4.6, '#f4f1ec', stroke(1, '#a99f92')) + ellipse(96, 93.4, 16, 4, paint('sph-soft'));
    const glass = 'M89 70H103L101 92H91Z';
    s += path(glass, '#ffb53b', stroke(0.9, '#8fb0bd')) + path(glass, paint('plastic', '#ffffff'));
    s += path('M88 70C88 62 104 62 104 70Z', '#ffd38a', op(0.7)) + path('M88 70C88 62 104 62 104 70Z', paint('plastic', '#ffffff'));
    s += line('M99 66L104 54', '#ff6fa8', 2.4);
    return s;
  },

  neon() {
    const word = esc(t('art.neon'));
    const txt = (a) => `<text x="60" y="72" text-anchor="middle" font-family="${FONT}" font-size="34" textLength="76" lengthAdjust="spacingAndGlyphs"${a}>${word}</text>`;
    let s = line('M24 32L60 10L96 32', '#3b2a33', 1.2) + circle(60, 10, 2.4, paint('steel', '#cfd6dc'), stroke(0.8, '#5f6a75'));
    s += path(rrect(8, 30, 104, 62, 10), '#241732', stroke(1, '#0f0a16'));
    s += path(rrect(8, 30, 104, 62, 10), paint('glass'));
    for (const [x, y] of [[16, 38], [104, 38], [16, 84], [104, 84]]) s += circle(x, y, 2.2, paint('steel', '#cfd6dc'), stroke(0.6, '#5f6a75'));
    s += txt(` fill="none" stroke="#ff3d8b" stroke-width="10" stroke-linejoin="round" opacity="0.22"`);
    s += txt(` fill="none" stroke="#ff5fa2" stroke-width="4" stroke-linejoin="round"`);
    s += txt(` fill="none" stroke="#ffe3f1" stroke-width="1.3" stroke-linejoin="round"`);
    s += line('M28 82Q60 90 92 80', '#18c2c9', 7, op(0.22)) + line('M28 82Q60 90 92 80', '#5ee6ea', 2.6) + line('M28 82Q60 90 92 80', '#e6feff', 0.9);
    return s;
  },
};

export function decorSVG(id, size = 120) {
  const draw = DECOR[id];
  return svgWrap(size, size, 120, 120, draw ? draw() : '');
}
