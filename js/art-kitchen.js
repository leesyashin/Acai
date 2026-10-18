// Kitchen art for Açaí Fever: the commercial blender, the smoothie machine, the trash can, the work
// counter in perspective with its freezer and risers, and the back wall of the café. Same realistic
// look as art-food.js (shared gradients from svg.js). Pure module.

import { ING } from './data.js';
import { t } from './i18n.js';
import {
  WHITE, f, rngFor, memo, mix, lighten, esc, uid, svgWrap, stroke, op, tf, circle, ellipse, path, rect, g, line,
  rrect, paint, lit, litCircle, softShadow, edge, registerDefs,
} from './svg.js';
import { cupArt, pureeOf, ingredientArt, packIcon } from './art-food.js';

const FONT = `'Lilita One', 'Trebuchet MS', system-ui, sans-serif`;
const BOWL_RIM_COL = '#86614a';
const OK = '#2fbf71';
const BAD = '#ff4d4d';
const LAGOON = '#18c2c9';

// ======================================================================
// Blender (viewBox 150×150), seen from above and from the right like everything on the counter:
// black motor base (top face, right side, front with the controls), clear jug, round black lid
// ======================================================================
const JUG_TOP = 34;
const JUG_BOT = 102;
const jugL = (y) => 36 + ((y - JUG_TOP) * 12) / (JUG_BOT - JUG_TOP);
const jugR = (y) => 114 - ((y - JUG_TOP) * 12) / (JUG_BOT - JUG_TOP);
const JUG = `M36 ${JUG_TOP}L48 ${JUG_BOT - 3}A27 4.5 0 0 0 102 ${JUG_BOT - 3}L114 ${JUG_TOP}Z`;

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
  const side = 'M112 112.6L118.4 105.4V136.6Q118.4 139 117 140.8L112 146Z';
  const top = 'M40.6 112L46 105.8Q47.2 104.6 49 104.6H115.6Q119.6 104.6 117.6 107.4L113.4 112Z';
  const front = rrect(35, 112, 78, 34, 6.5);
  let s = path(side, '#09090c', stroke(1, '#000000')) + line('M114 113V142', WHITE, 1, op(0.12));
  s += path(front, paint('black', '#1d1d22'), stroke(1, '#000000'));
  s += path(top, '#3d3d46', stroke(1, '#000000')) + path(top, paint('gloss'), op(0.18));
  s += line('M41 113.4H109', '#b9c2ca', 1.3, op(0.7)) + line('M40 118L38.6 140', WHITE, 1.4, op(0.18));
  // control panel
  s += path(rrect(45, 118.5, 58, 22, 6), '#26262d', stroke(1, '#4a4a54'));
  s += path(rrect(45, 118.5, 58, 22, 6), paint('down'), op(0.8));
  const ang = { empty: -150, blending: 20, ready: -90, overflowing: -30, ruined: -150 }[state] ?? -150;
  const a = (ang * Math.PI) / 180;
  s += circle(57.5, 129.5, 7.5, paint('steel', '#cfd6dc'), stroke(1, '#0e0e12')) + litCircle(57.5, 129.5, 7.5, 'sph');
  s += line(`M57.5 129.5L${f(57.5 + Math.cos(a) * 5.5)} ${f(129.5 + Math.sin(a) * 5.5)}`, '#1d1d22', 2);
  const n = Math.max(1, Math.min(4, o.maxPortions || 2));
  const left = state === 'ready' || state === 'overflowing' ? Math.max(0, Math.min(n, o.portions ?? n)) : 0;
  const gap = Math.min(10, 26 / Math.max(1, n - 1));
  const r = Math.min(3.4, gap * 0.36);
  for (let i = 0; i < n; i++) {
    const x = 84 + (i - (n - 1) / 2) * gap;
    const on = i < left;
    if (on) s += circle(x, 129.5, r * 2.2, OK, op(0.3));
    s += circle(x, 129.5, r, on ? '#5df09a' : '#4a4a52', stroke(0.8, on ? '#1f8a4c' : '#202026'));
  }
  if (state === 'blending') s += circle(97, 122, 1.6, '#ffcf3a') + circle(97, 122, 3.4, '#ffcf3a', op(0.3));
  return s;
}

// Round collar on the base the jug sits in.
function collar() {
  return path('M46 99V105A29 4.4 0 0 0 104 105V99Z', paint('black', '#1d1d22'), stroke(1, '#000000')) +
    ellipse(75, 99, 29, 4.4, '#33333b', stroke(1, '#000000')) + line('M50 104Q60 107.6 75 107.8', WHITE, 1, op(0.25));
}

// Round lid seen from above: its rim band, the top and the plug in the middle.
function lid() {
  let s = path('M33 27.5V32A42 6.5 0 0 0 117 32V27.5Z', paint('black', '#2a2a31'), stroke(1, '#000000'));
  s += ellipse(75, 27.5, 42, 6.5, '#383840', stroke(1, '#000000')) + ellipse(75, 27.5, 42, 6.5, paint('down'), op(0.45));
  s += ellipse(75, 28, 31, 4.2, '#25252c') + line('M38 30.4Q54 35 75 35', WHITE, 1, op(0.3));
  s += path('M65 19V25.5A10 2.6 0 0 0 85 25.5V19Z', paint('black', '#2a2a31'), stroke(1, '#000000'));
  s += ellipse(75, 19, 10, 2.6, '#4a4a54', stroke(0.8, '#000000')) + path('M45 25.4A41 6 0 0 1 72 21.4', 'none', stroke(1.2, '#ffffff') + op(0.3));
  return s;
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
  let s = softShadow(80, 146, 56, 6.5);
  if (state === 'blending') s += line('M22 52Q16 64 22 76M14 58Q10 64 14 70M134 104Q140 96 138 86', '#5b4b66', 2.4, op(0.5));
  s += motorBase(state, o);
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
  s += collar();
  if (state === 'overflowing') {
    const foam = 'M30 37C20 35 22 19 36 21C38 7 58 5 64 15C72 3 96 5 98 17C114 13 124 27 114 37Z';
    s += path(foam, p.main, stroke(1.2, edge(p.main))) + lit(foam, 'sph-soft') + ellipse(48, 21, 8, 3, WHITE, op(0.45));
    for (const [x, y1, y2, w] of [[36, 34, 64, 6], [112, 34, 54, 5], [72, 37, 46, 4.5]]) {
      s += path(`M${x - w / 2} ${y1}V${y2 - w / 2}A${w / 2} ${w / 2} 0 0 0 ${x + w / 2} ${y2 - w / 2}V${y1}Z`, p.main, stroke(1, edge(p.main))) + line(`M${x - w * 0.15} ${y1 + 2}V${y2 - w}`, p.light, 1, op(0.7));
    }
    s += ellipse(46, 108.6, 11, 2.6, p.main, stroke(1, edge(p.main)));
    s += g('translate(-20 -3) rotate(-22 75 32)', lid());
  } else {
    s += lid();
  }
  if (state === 'ruined') {
    s += line('M52 18Q46 12 52 6Q58 0 52 -6M98 18Q92 12 98 6Q104 0 98 -6M75 14Q69 8 75 2', '#8fa86a', 2.6, op(0.9));
    s += circle(26, 40, 2.2, '#1d1d22') + ellipse(24.2, 37.4, 2.4, 1.4, WHITE, op(0.85)) + ellipse(28, 37.4, 2.4, 1.4, WHITE, op(0.85));
  }
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
export const SMOOTHIE_CUP_SIZE = 0.33;

export function smoothieMachineSVG(slotCount = 1, size = 200) {
  const n = slotCount >= 2 ? 2 : 1;
  return memo(`m|${n}|${size}`, () => {
    const xs = SMOOTHIE_SLOT_X[n].map((q) => q * 200);
    let s = softShadow(98, 193, 98, 7);
    s += rect(34, 185, 18, 10, 3, '#1d1d22') + rect(150, 185, 18, 10, 3, '#1d1d22');
    // white body seen from above and from the left: top face, left side, front
    const side = 'M22 34L11 22V176L22 189Z';
    const top = 'M22 34L11 22Q11 19 14 19H176Q179 19 181 21L190 31Z';
    s += path(side, '#cdd2d7', stroke(1.2, '#7f8a95')) + path(side, paint('down-dark'), op(0.35));
    s += path(top, '#ffffff', stroke(1.2, '#7f8a95')) + path(top, paint('down-dark'), op(0.12));
    const body = rrect(22, 30, 168, 160, 12);
    s += path(body, '#f5f6f7', stroke(1.2, '#7f8a95')) + path(body, paint('cyl-soft'), op(0.45)) + path(body, paint('down'), op(0.35));
    s += line('M30 36H182', WHITE, 2, op(0.9)) + line('M27 44V182', WHITE, 2.2, op(0.7));
    // açaí-purple head panel with the display and two status lights
    s += path(rrect(32, 38, 148, 44, 12), '#6c2a8f', stroke(1, '#3d1352')) + path(rrect(32, 38, 148, 44, 12), paint('down'));
    s += path(rrect(64, 44, 84, 32, 8), '#14161c', stroke(1, '#000000')) + path(rrect(64, 44, 84, 32, 8), paint('down'), op(0.6));
    s += path('M94 50H118L114.8 70H97.2Z', '#ff6fa8', op(0.95)) + path('M94 50H118L117.4 54H94.6Z', '#ffd3e6');
    s += line('M109 51L114 44.5', '#ffd3e6', 2) + circle(106, 60, 14, '#ff6fa8', op(0.12));
    s += circle(48, 60, 6.5, '#ffb627', stroke(1, '#a8690a')) + litCircle(48, 60, 6.5, 'sph');
    s += circle(164, 60, 6.5, OK, stroke(1, '#1f7a4a')) + litCircle(164, 60, 6.5, 'sph');
    // the bay the cups stand in: dark, lit by an LED strip, its right wall catching the light
    s += path(rrect(32, 90, 148, 94, 10), '#1f2229', stroke(1, '#0c0d10'));
    s += path('M170 92L178 100V176L170 182Z', '#3a3f48', op(0.9));
    s += path(rrect(32, 90, 148, 94, 10), paint('down'), op(0.5));
    s += line('M40 94H170', '#e9fbff', 2, op(0.85)) + rect(40, 95, 130, 10, 0, '#bff4ff', op(0.08));
    s += line('M44 104L70 176M58 104L78 150', WHITE, 2, op(0.08));
    // nozzles
    for (const x of xs) {
      s += path(`M${x - 11} 91H${x + 11}L${x + 6.5} 104H${x - 6.5}Z`, paint('steel', '#cfd6dc'), stroke(1, '#6f7a85'));
      s += rect(x - 3.5, 103, 7, 5, 2, '#5b6570');
    }
    // drip tray: grille seen from above, steel front edge
    let grate = '';
    for (let x = 44; x < 168; x += 7) grate += `M${x} 168.5L${x - 1.6} 176.5`;
    s += path('M40 166H172L176 178H36Z', paint('steel-v', '#cfd6dc'), stroke(1, '#6f7a85'));
    s += line(grate, '#6f7a85', 2, op(0.8));
    s += path(rrect(35, 177.5, 142, 7, 3), paint('steel-v', '#dfe4e9'), stroke(1, '#6f7a85')) + line('M38 179H174', WHITE, 1.2, op(0.85));
    return svgWrap(size, size, 200, 200, s);
  });
}

// ======================================================================
// Trash can (viewBox 100×100): stainless pedal bin
// ======================================================================
export function trashSVG(size = 64) {
  return memo(`t|${size}`, () => {
    let s = softShadow(52, 95, 36, 5);
    // round stainless pedal bin seen from above: body, foot ring, pedal, domed lid
    const body = 'M22 34V86A28 7 0 0 0 78 86V34Z';
    s += path(body, paint('steel', '#cfd6dc'), stroke(1.2, '#5f6a75'));
    s += line('M30 40V88', WHITE, 3, op(0.5)) + line('M71 40V89', '#000000', 2, op(0.12));
    s += path('M22 81A28 7 0 0 0 78 81V86A28 7 0 0 1 22 86Z', '#26262d', op(0.85));
    s += path('M40 89.6L42 85.6H58L60 89.6Q60 93 57 93H43Q40 93 40 89.6Z', '#1d1d22', stroke(1, '#000000')) + line('M43 87.4H57', WHITE, 1, op(0.35));
    s += path('M20 30.5V34.5A30 8 0 0 0 80 34.5V30.5Z', '#2a2a31', stroke(1, '#000000'));
    s += ellipse(50, 30.5, 30, 8, paint('steel-v', '#dfe4e9'), stroke(1.2, '#5f6a75'));
    s += ellipse(50, 30.5, 30, 8, paint('sph'), op(0.7)) + path('M27 28.6A24 5.6 0 0 1 56 23.4', 'none', stroke(1.6, '#ffffff') + op(0.75));
    return svgWrap(size, size, 100, 100, s);
  });
}

// ======================================================================
// Work counter (1280×462 stage px under the pass, stage y 338–800): a terrazzo worktop seen from
// above at an angle – far edge in the pass's shadow, chips shrinking toward the back – its
// rounded front edge and a strip of the cabinet below it: the freezer's front panel on the left,
// the tops of open oak shelves with the café's stock under an LED strip
// ======================================================================
const COUNTER_W = 1280;
const COUNTER_H = 462;
const COUNTER_EDGE_Y = 404; // front edge of the worktop (stage y 742)
const COUNTER_LIP = 14; // the rounded front edge; the cabinet strip starts below it (stage y 756)
const SHELF_POSTS = [300, 516, 732, 948, 1150];
// The stock is drawn for a shelf whose top is at y 372 and moved down into the cabinet strip, where
// only its upper part shows above the bottom of the screen; STOCK_LIFT keeps the tops of the crates in view.
const STOCK_TOP = 372;
const STOCK_LIFT = 16;

// Terrazzo chips on the worktop, in perspective: sampled evenly on the slab, projected toward a
// horizon far above the screen, so they get smaller and flatter toward the back.
function terrazzo(W, edgeY) {
  const rng = rngFor('terrazzo');
  const A = -900;
  const B = edgeY - A;
  const zFar = B / -A;
  const cols = ['#fbf9f5', '#fbf9f5', '#c4bbb0', '#a59b90', '#d8a7b8', '#b9a6cf', '#a9cbb6', '#77706a'];
  const by = cols.map(() => '');
  for (let i = 0; i < 1500; i++) {
    const z = 1 + rng.next() * (zFar - 1);
    const X = 640 + (rng.next() * 2 - 1) * (680 * z);
    const x = 640 + (X - 640) / z;
    const y = A + B / z;
    if (x < -8 || x > W + 8) continue;
    const big = rng.next();
    const R = (big < 0.76 ? 0.9 + rng.next() * 1.2 : big < 0.97 ? 2.2 + rng.next() * 2.2 : 4.4 + rng.next() * 2.6) / z;
    const squash = 0.44 / z;
    const a0 = rng.next() * Math.PI * 2;
    let d = '';
    for (let k = 0; k < 5; k++) {
      const a = a0 + (k / 5) * Math.PI * 2 + (rng.next() - 0.5) * 0.6;
      const r = R * (0.6 + rng.next() * 0.4);
      d += `${k ? 'L' : 'M'}${f(x + Math.cos(a) * r)} ${f(y + Math.sin(a) * r * squash)}`;
    }
    by[Math.floor(rng.next() * cols.length)] += `${d}Z`;
  }
  return cols.map((c, i) => (by[i] ? path(by[i], c, op(c === '#fbf9f5' ? 0.95 : 0.7)) : '')).join('');
}

// --- stock on the open shelves (drawn standing on the shelf floor just below the screen, y = base)
function stockCrate(x, base, w, h, fill) {
  let s = fill;
  const front = `M${x} ${base - h}H${x + w}V${base}H${x}Z`;
  s += path(front, '#c99a5f', stroke(1, '#7d5226'));
  for (let k = 1; k < 3; k++) s += line(`M${x} ${base - h + (h * k) / 3}H${x + w}`, '#8f6331', 1.6, op(0.7));
  s += line(`M${x + 3} ${base - h + 2}H${x + w - 3}`, '#f2d3a0', 1.2, op(0.8));
  s += path(front, paint('cyl-soft'));
  return s;
}

function stockIcon(id, x, y, k) {
  return g(`translate(${f(x)} ${f(y)}) scale(${k})`, ingredientArt(id));
}

function bowlStack(x, base) {
  let s = '';
  for (let i = 0; i < 4; i++) {
    const y = base - 8 - i * 7;
    s += path(`M${x - 26} ${y - 6}C${x - 26} ${y + 4} ${x - 12} ${y + 8} ${x} ${y + 8}C${x + 12} ${y + 8} ${x + 26} ${y + 4} ${x + 26} ${y - 6}Z`, '#fbfaf6', stroke(0.9, '#a2988c'));
    s += path(`M${x - 26} ${y - 6}A26 5 0 0 0 ${x + 26} ${y - 6}`, 'none', stroke(1.6, BOWL_RIM_COL));
  }
  const y = base - 8 - 3 * 7 - 6;
  s += ellipse(x, y, 26, 5, '#f1ede6', stroke(1.6, BOWL_RIM_COL));
  return s + path(`M${x - 26} ${base - 30}V${base}H${x + 26}V${base - 30}Z`, paint('cyl-soft'), op(0.6));
}

function kraftBag(x, base, w, h, label) {
  const bag = `M${x + 3} ${base - h}L${x + w - 3} ${base - h}L${x + w} ${base}H${x}Z`;
  let s = path(bag, '#c8a27a', stroke(1, '#8a6a48')) + path(bag, paint('cyl'), op(0.6));
  s += path(`M${x + 2} ${base - h - 7}H${x + w - 2}L${x + w - 3} ${base - h + 1}H${x + 3}Z`, '#b58e66', stroke(1, '#8a6a48'));
  s += path(rrect(x + 7, base - h + 12, w - 14, 18, 3), '#fbf6ec');
  s += `<text x="${f(x + w / 2)}" y="${f(base - h + 25)}" text-anchor="middle" font-family="${FONT}" font-size="10" letter-spacing="0.5" fill="#6b4a2f">${esc(label)}</text>`;
  return s;
}

function stock() {
  const base = 456;
  let s = g('translate(318 386) scale(0.42)', cupStackShape()) + g('translate(368 380) scale(0.46)', cupStackShape());
  s += bowlStack(460, base);
  s += stockCrate(530, base, 110, 40,
    stockIcon('banana', 516, 368, 0.7) + stockIcon('banana', 564, 364, 0.68) + stockIcon('banana', 540, 380, 0.64));
  s += kraftBag(656, base, 62, 58, 'GRANOLA');
  s += stockCrate(748, base, 110, 40,
    stockIcon('mango', 740, 386, 0.56) + stockIcon('kiwi', 790, 390, 0.5) + stockIcon('mango', 808, 384, 0.5));
  s += stockIcon('honey', 862, 400, 0.6) + stockIcon('peanut', 904, 402, 0.56);
  s += stockIcon('coconut', 958, 398, 0.62) + stockIcon('coconut', 1004, 404, 0.56);
  s += stockCrate(1060, base, 82, 34, stockIcon('strawberry', 1052, 398, 0.5) + stockIcon('strawberry', 1090, 396, 0.5) + stockIcon('blueberry', 1072, 404, 0.42));
  s += kraftBag(1164, base, 70, 52, 'AÇAÍ');
  return s;
}

function underCounter(W, C, H) {
  let s = rect(0, C, W, H - C, 0, '#5a4334') + rect(0, C, W, H - C, 0, paint('down-dark'), op(0.6));
  // LED strip under the apron: warm light falling on the stock
  for (let i = 0; i < SHELF_POSTS.length - 1; i++) {
    const cx = (SHELF_POSTS[i] + SHELF_POSTS[i + 1]) / 2;
    s += ellipse(cx, C + 14, (SHELF_POSTS[i + 1] - SHELF_POSTS[i]) * 0.55, 44, paint('warm-glow'), op(0.9));
  }
  s += g(`translate(0 ${C - STOCK_TOP - STOCK_LIFT})`, stock());
  // oak posts between the compartments, the apron under the worktop edge
  for (const x of SHELF_POSTS) {
    s += rect(x - 5, C, 10, H - C, 0, '#c99b63') + rect(x - 5, C, 10, H - C, 0, paint('cyl')) + line(`M${x - 4.4} ${C}V${H}`, '#8f6331', 1, op(0.6));
  }
  s += rect(0, C, W, 10, 0, '#c99b63') + rect(0, C, W, 10, 0, paint('down'), op(0.7)) + line(`M0 ${C + 10}H${W}`, '#3b2a22', 1.2, op(0.5));
  s += rect(0, C, W, 4, 0, '#3b2a22', op(0.35));
  return s;
}

// Fruit basket and a jar of paper straws on the free worktop in front of the machine (drawn at
// 1:1 around the basket's foot at (1046, 334), then scaled into place by counterSVG).
const DECOR_AT = { x: 1098, y: 300, scale: 0.72 };

function worktopDecor() {
  let s = softShadow(1046, 330, 70, 11) + softShadow(1124, 318, 22, 5);
  // wicker basket: belly in front of the heaped fruit, woven texture, rim
  const belly = 'M984 292C986 318 1010 334 1046 334C1082 334 1106 318 1108 292Z';
  s += ellipse(1046, 292, 62, 16, '#7a5532');
  s += stockIcon('banana', 990, 230, 0.66) + stockIcon('mango', 1036, 236, 0.58) + stockIcon('kiwi', 1062, 252, 0.5) + stockIcon('strawberry', 1012, 258, 0.42);
  s += path(belly, '#c48b4e', stroke(1, '#7a5532'));
  let weave = '';
  for (let x = 992; x < 1104; x += 9) weave += `M${x} 294L${x + 7} 330M${x + 9} 294L${x + 2} 330`;
  s += `<g clip-path="url(#af-clip-basket)">${line(weave, '#9c6a37', 1.4, op(0.55))}</g>`;
  s += path(belly, paint('cyl-soft')) + path('M984 292A62 16 0 0 0 1108 292', 'none', stroke(4.5, '#a97440')) + path('M986 291A60 14.5 0 0 0 1106 291', 'none', stroke(1.4, '#e5b87f') + op(0.8));
  // glass jar of striped paper straws
  for (const [x2, y2, c] of [[1112, 244, '#ff6fa8'], [1122, 238, '#6c2a8f'], [1132, 246, '#2fbf71'], [1118, 250, '#ffb627']]) {
    s += line(`M${f(1124 + (x2 - 1124) * 0.3)} 304L${x2} ${y2}`, '#ffffff', 4.2) + line(`M${f(1124 + (x2 - 1124) * 0.3)} 304L${x2} ${y2}`, c, 4.2, ' stroke-dasharray="3 3"');
  }
  s += path('M1108 270V312A16 4 0 0 0 1140 312V270Z', '#e8f4f8', op(0.5)) + path('M1108 270V312A16 4 0 0 0 1140 312V270Z', paint('glass'));
  s += ellipse(1124, 270, 16, 4, 'none', stroke(1.4, '#ffffff') + op(0.9)) + path('M1108 270V312A16 4 0 0 0 1140 312V270', 'none', stroke(1, '#8fb0bd'));
  return s;
}
registerDefs('<clipPath id="af-clip-basket"><path d="M984 292C986 318 1010 334 1046 334C1082 334 1106 318 1108 292Z"/></clipPath>');

export function counterSVG(width = COUNTER_W, height = COUNTER_H) {
  const W = COUNTER_W;
  const H = COUNTER_H;
  const E = COUNTER_EDGE_Y;
  const C = E + COUNTER_LIP;
  const topId = uid('ctr');
  const lipId = uid('ctr');
  let s = `<defs><linearGradient id="${topId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4ccc1"/><stop offset="0.22" stop-color="#e0d9cf"/><stop offset="1" stop-color="#ebe6de"/></linearGradient>` +
    `<linearGradient id="${lipId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbfaf7"/><stop offset="0.3" stop-color="#ece7e0"/><stop offset="0.75" stop-color="#d0c8bd"/><stop offset="1" stop-color="#a99f93"/></linearGradient></defs>`;
  // worktop
  s += rect(0, 0, W, E, 0, `url(#${topId})`);
  s += terrazzo(W, E);
  // the pendant lamps reflected in the polished stone, the pass's shadow along the far edge
  for (const [x, rx] of [[150, 150], [380, 170], [900, 170], [1160, 150]]) s += ellipse(x, 84, rx, 32, paint('glow'), op(0.38));
  s += rect(0, 0, W, 40, 0, paint('up-dark'), op(0.55)) + rect(0, 0, W, 8, 0, '#3b2a22', op(0.18));
  s += g(`translate(${DECOR_AT.x} ${DECOR_AT.y}) scale(${DECOR_AT.scale}) translate(-1046 -334)`, worktopDecor());
  // cabinet: open shelves with the stock, the freezer's front panel on the left
  s += underCounter(W, C, H);
  const fp = `M18 ${C}H298V${H + 4}H18Z`;
  s += path(fp, '#eef0f1') + path(fp, paint('steel-v'), op(0.5)) + path(fp, 'none', stroke(1, '#8f99a4'));
  s += rect(18, C, 280, 12, 0, paint('up-dark'), op(0.8));
  let vents = '';
  for (let x = 40; x < 280; x += 10) vents += `M${x} ${H - 9}V${H - 3}`;
  s += line(vents, '#5b6570', 2.2, op(0.55));
  // rounded front edge of the worktop, casting its shadow on the cabinet
  s += rect(0, E, W, COUNTER_LIP, 0, `url(#${lipId})`);
  s += line(`M0 ${E + 0.8}H${W}`, WHITE, 1.6, op(0.95));
  s += line(`M0 ${E + 4}H${W}`, WHITE, 1, op(0.35));
  s += rect(0, C, W, 10, 0, paint('up-dark'), op(0.7));
  return svgWrap(width, height, W, H, s, ' preserveAspectRatio="none"');
}

// ======================================================================
// Chest freezer built into the left end of the counter (viewBox 284×186, its bottom edge on the
// worktop's front edge): 'well' is the steel frame, the frosty inside and the sliding glass lid
// pushed to the back over the spare packs – the base packs stand in front of it – and 'rim' is
// the front of the frame, drawn over the packs so they stand inside
// ======================================================================
const FZ_OUT = 'M14 2H272Q278 2 278.4 8L283.6 180Q284 186 278 186H6Q0 186 0.4 180L7.6 8Q8 2 14 2Z';
const FZ_IN = 'M24 12H262L272 176H12Z';
const FZ_BACK = 'M24 12H262L260 62H30Z';
const FZ_LEFT = 'M24 12L30 62L22 176H12Z';
const FZ_FLOOR = 'M30 62H260L266 176H22Z';
const FZ_GLASS = 'M24 12H262L265.4 70H20.4Z';
const FZ_FRONT = 'M0.4 180L1 172H283L283.6 180Q284 186 278 186H6Q0 186 0.4 180Z';

function frostDots(box, rng, n, w) {
  let s = '';
  for (let i = 0; i < n; i++) s += `M${f(box[0] + rng.next() * (box[2] - box[0]))} ${f(box[1] + rng.next() * (box[3] - box[1]))}h0.01`;
  return line(s, WHITE, w, op(0.85));
}

const crystal = (x, y, r) => path(`M${f(x)} ${f(y - r * 2)}L${f(x + r * 0.5)} ${f(y - r * 0.5)}L${f(x + r * 2)} ${f(y)}L${f(x + r * 0.5)} ${f(y + r * 0.5)}L${f(x)} ${f(y + r * 2)}L${f(x - r * 0.5)} ${f(y + r * 0.5)}L${f(x - r * 2)} ${f(y)}L${f(x - r * 0.5)} ${f(y - r * 0.5)}Z`, WHITE, op(0.8));

function freezerWell() {
  const rng = rngFor('freezer');
  let s = path(FZ_OUT, paint('steel-v', '#dfe4e9'), stroke(1, '#6f7a85'));
  s += line('M16 4.4H270', WHITE, 1.4, op(0.9));
  // the cold inside: back wall, the left wall facing the player, the floor in the shadow of the walls
  s += path(FZ_IN, '#b4cfdc');
  s += path(FZ_BACK, '#d3e6ee') + path(FZ_BACK, paint('down-dark'), op(0.3));
  s += path(FZ_LEFT, '#9ab8c8') + path(FZ_LEFT, paint('cyl'), op(0.5));
  s += path(FZ_FLOOR, '#c5dce6') + path(FZ_FLOOR, paint('up-dark'), op(0.35));
  s += path('M30 62H260L261 70H29Z', '#7d9aab', op(0.35));
  s += ellipse(150, 120, 120, 46, paint('glow'), op(0.55));
  // spare packs leaning against the back wall, under the glass
  ['acai', 'pitaya', 'acai', 'spirulina', 'pitaya', 'acai'].forEach((id, i) => {
    s += g(`translate(${32 + i * 37} ${14 + (i % 2) * 3}) rotate(${(i % 3) * 3 - 3} 22 24)`, packIcon(id, 44));
  });
  // the glass lid slid back: tinted pane, reflections, rime on its edges, a steel handle bar
  s += path(FZ_GLASS, '#dff2f8', op(0.5));
  s += line('M64 14L40 68M102 14L82 68M112 14L104 32', WHITE, 6, op(0.32));
  s += frostDots([26, 13, 262, 19], rng, 70, 2.4) + frostDots([22, 16, 36, 66], rng, 30, 2) + frostDots([248, 16, 264, 66], rng, 24, 2);
  s += path(FZ_GLASS, 'none', stroke(1.2, '#7f9fad'));
  s += path(rrect(32, 65, 224, 9, 4.5), paint('steel-v', '#dfe4e9'), stroke(1, '#5f6a75')) + line('M38 67.4H250', WHITE, 1.3, op(0.9));
  s += rect(34, 74, 220, 5, 2, '#000000', op(0.12));
  // rime along the open part, crystals on the walls
  s += frostDots([13, 78, 26, 172], rng, 34, 2) + frostDots([32, 80, 260, 86], rng, 26, 1.6);
  for (let i = 0; i < 9; i++) s += crystal(44 + rng.next() * 200, 90 + rng.next() * 18, 1 + rng.next() * 1.1);
  s += path(FZ_IN, 'none', stroke(1.4, '#5f6a75') + op(0.9));
  return s;
}

function freezerRim() {
  const rng = rngFor('freezer-rim');
  let s = path(FZ_FRONT, paint('steel-v', '#dfe4e9'), stroke(1, '#7f8a95'));
  s += line('M2 173.4H282', '#ffffff', 1.4, op(0.95));
  s += frostDots([14, 168, 270, 175], rng, 60, 2.4);
  s += path('M10 176H274', 'none', stroke(1.2, '#7f8a95') + op(0.8));
  return s;
}

export function freezerSVG(part = 'well', width = 284, height = 186) {
  return memo(`fz|${part}|${width}|${height}`, () => svgWrap(width, height, 284, 186, part === 'rim' ? freezerRim() : freezerWell()));
}

// ======================================================================
// Slim oak riser an ingredient row stands on (w × h px, drawn 1:1): a top face narrowing toward the
// back, its front edge (RISER_FRONT px tall, from h − RISER_FRONT − 3; the layer label sits on it,
// css/game.css places it there) and a soft shadow on the worktop below it
// ======================================================================
const RISER_FRONT = 16;

export function riserSVG(w, h) {
  return memo(`riser|${w}|${h}`, () => {
    const F = RISER_FRONT;
    const t = h - F - 3; // front edge of the top face
    const inset = 6;
    const top = `M${inset + 6} 1H${w - inset - 6}Q${w - inset} 1 ${w - inset + 0.6} 6L${w - 0.6} ${t - 4}Q${w} ${t} ${w - 6} ${t}H6Q0 ${t} 0.6 ${t - 4}L${inset - 0.6} 6Q${inset} 1 ${inset + 6} 1Z`;
    const front = `M0.6 ${t - 3}Q1 ${t} 6 ${t}H${w - 6}Q${w - 1} ${t} ${w - 0.6} ${t - 3}L${w} ${t + F - 4}Q${w} ${t + F} ${w - 6} ${t + F}H6Q0 ${t + F} 0 ${t + F - 4}Z`;
    let s = path(rrect(3, t + F - 5, w - 6, 8, 4), '#3b2a22', op(0.22)) + path(rrect(10, t + F - 2, w - 20, 5, 2.5), '#3b2a22', op(0.14));
    s += path(top, '#dcb27c', stroke(1, '#a8743f'));
    const rng = rngFor(`riser-${w}`);
    let grain = '';
    for (let i = 0; i < Math.round(w / 30); i++) {
      const y = 5 + rng.next() * (t - 9);
      const x = 6 + rng.next() * (w - 60);
      grain += `M${f(x)} ${f(y)}q${f(18 + rng.next() * 20)} ${f(rng.next() * 2 - 1)} ${f(40 + rng.next() * 40)} ${f(rng.next() * 1.6 - 0.8)}`;
    }
    s += line(grain, '#b98446', 1, op(0.4));
    s += path(top, paint('glow'), op(0.3)) + path(top, paint('down'), op(0.5));
    s += path(front, '#b98146', stroke(1, '#7d5226')) + path(front, paint('down-dark'), op(0.55));
    let planks = '';
    for (let x = 90 + rng.next() * 60; x < w - 40; x += 140 + rng.next() * 90) planks += `M${f(x)} ${t + 2}V${t + F - 2}`;
    s += line(planks, '#7d5226', 1, op(0.35));
    s += line(`M6 ${t + 0.8}H${w - 6}`, '#f6d9a8', 1.2, op(0.9));
    return svgWrap(w, h, w, h, s);
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
