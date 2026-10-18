// Kitchen art for Açaí Fever: the stand blender, the matcha machine, the trash can, the work
// counter in perspective with its freezer and risers, and the back wall of the café. Same realistic
// look as art-food.js (shared gradients from svg.js). Pure module.

import { ING } from './data.js';
import { t } from './i18n.js';
import {
  WHITE, f, rngFor, memo, mix, lighten, esc, uid, svgWrap, stroke, op, tf, circle, ellipse, path, rect, g, line,
  rrect, paint, lit, litCircle, softShadow, edge, registerDefs,
} from './svg.js';
import { pureeOf, ingredientArt, packIcon } from './art-food.js';
import { MATCHA_GEO, MACHINE_SLOT_X, GLASS_Z, VIEWS, ELEV, machinePoint } from './kitchen3d.js';

const FONT = `'Lilita One', 'Trebuchet MS', system-ui, sans-serif`;
const BOWL_RIM_COL = '#86614a';
const OK = '#2fbf71';
const BAD = '#ff4d4d';
const LAGOON = '#18c2c9';

// ======================================================================
// Blender (viewBox 150×150), the drawn version of the 3D stand blender (js/kitchen3d.js) for
// browsers without WebGL: brushed stainless motor base with a black glass band that dips into a V
// (display, portion LEDs), the big start/stop dial and the brand line; a fluted glass jug with the
// scale on the left, the spout on the left and a clear handle on the right; black lid, clear cap.
// ======================================================================
const BX = 74; // centre line of jug and base
const JUG_TOP = 32;
const JUG_BOT = 89;
// half width of the jug at height y (wider at the top)
const jugW = (y) => 19 + ((JUG_BOT - y) * 7) / (JUG_BOT - JUG_TOP);
const jugL = (y) => BX - jugW(y);
const jugR = (y) => BX + jugW(y);
const JUG = `M${f(jugL(JUG_TOP))} ${JUG_TOP}L${f(jugL(JUG_BOT) + 1)} ${JUG_BOT - 2}Q${f(jugL(JUG_BOT) + 1.4)} ${JUG_BOT} ${f(jugL(JUG_BOT) + 4)} ${JUG_BOT}H${f(jugR(JUG_BOT) - 4)}Q${f(jugR(JUG_BOT) - 1.4)} ${JUG_BOT} ${f(jugR(JUG_BOT) - 1)} ${JUG_BOT - 2}L${f(jugR(JUG_TOP))} ${JUG_TOP}Z`;
// the motor base: a trapezoid from the shoulder (y 95) to the plinth (y 142)
const BASE_T = 95;
const BASE_B = 142;
const baseW = (y) => 25.5 + ((y - BASE_T) * 4) / (BASE_B - BASE_T);
const BAND = 104; // lower edge of the black band at the sides; its V reaches y 113 in the middle

// Contents from yTop down to the jug floor, inset from the plastic. data-fill names the level for tests.
function jugFill(yTop, col, inset = 3) {
  const y2 = JUG_BOT - 3;
  const d = `M${f(jugL(yTop) + inset)} ${f(yTop)}H${f(jugR(yTop) - inset)}L${f(jugR(y2) - inset)} ${y2}H${f(jugL(y2) + inset)}Z`;
  return `<path data-fill="${f(yTop)}" d="${d}" fill="${col}"/>` + path(d, paint('cyl'));
}

// portions/maxPortions: bowls left in a ready jug – the level drops with every pour (the lamps
// on the base repeat the count). Callers without portions get a full jug.
function blenderContents(state, p, progress, portions, maxPortions) {
  const surf = (y, c, dip = 0) => path(`M${f(jugL(y) + 3)} ${y}Q${BX} ${y + 4 + dip} ${f(jugR(y) - 3)} ${y}Q${BX} ${y - 4} ${f(jugL(y) + 3)} ${y}Z`, c);
  if (state === 'blending') {
    const y = 52;
    const turn = (progress || 0) * Math.PI * 6;
    let s = jugFill(y, p.main) + surf(y, p.light, 10);
    // vortex and swirling streaks
    for (let i = 0; i < 3; i++) {
      const yy = 63 + i * 8;
      const w = Math.sin(turn + i) * 3;
      s += line(`M${f(jugL(yy) + 5 + w)} ${yy}Q${BX} ${yy + 6} ${f(jugR(yy) - 5 + w)} ${yy - 2}`, p.light, 2.6, op(0.55));
    }
    s += path(`M${BX - 6} ${y + 1}Q${BX} ${y + 14} ${BX + 6} ${y + 1}Z`, p.dark, op(0.6));
    for (const [x, yy, r] of [[BX - 13, 68, 1.7], [BX + 12, 77, 1.4], [BX - 4, 83, 1.2], [BX + 15, 62, 1.1]]) s += circle(x, yy, r, WHITE, op(0.7));
    return s;
  }
  if (state === 'ready') {
    // full → 50; 1 of 2 → 66; 2 of 3 → 61, 1 of 3 → 71. A ready jug always keeps a clear layer.
    const n = Math.max(1, maxPortions || 1);
    const k = Math.max(1, Math.min(n, portions ?? n));
    const y = Math.round(50 + (1 - k / n) * 32);
    return jugFill(y, p.main) + surf(y, mix(p.main, p.light, 0.5)) + ellipse(BX - 10, y - 0.5, 8, 1.4, WHITE, op(0.5)) +
      line(`M${BX - 15} ${y + 10}Q${BX - 12} ${Math.min(84, y + 24)} ${BX - 14} 86`, p.light, 2.2, op(0.4));
  }
  if (state === 'overflowing') {
    return jugFill(35, p.main, 2.5) + line(`M${BX - 15} 50Q${BX - 12} 70 ${BX - 14} 86`, p.light, 2.2, op(0.4));
  }
  if (state === 'ruined') {
    const sl = '#7d6f5c';
    let s = jugFill(58, sl);
    s += path(`M${f(jugL(58) + 3)} 58Q${BX - 20} 51 ${BX - 11} 57Q${BX - 4} 51 ${BX + 3} 57Q${BX + 11} 50 ${BX + 17} 57Q${BX + 21} 53 ${f(jugR(58) - 3)} 58Z`, '#8f826d');
    for (const [x, y, r] of [[BX - 13, 72, 3.6], [BX + 9, 79, 4.4], [BX - 3, 84, 2.8], [BX + 15, 66, 2.3]]) s += circle(x, y, r, '#5d5446', op(0.9));
    s += circle(BX - 7, 56, 2.7, '#a7c070', op(0.8)) + circle(BX + 13, 54, 2, '#a7c070', op(0.8));
    return s;
  }
  return '';
}

// The trapezoid of the base between two heights (its sides lean in toward the top).
function baseShape(y0, y1, r = 0) {
  const L = (y) => BX - baseW(y);
  const R = (y) => BX + baseW(y);
  if (!r) return `M${f(L(y0))} ${y0}H${f(R(y0))}L${f(R(y1))} ${y1}H${f(L(y1))}Z`;
  return `M${f(L(y0) + r)} ${y0}H${f(R(y0) - r)}Q${f(R(y0))} ${y0} ${f(R(y0 + r))} ${y0 + r}L${f(R(y1 - r))} ${y1 - r}Q${f(R(y1))} ${y1} ${f(R(y1) - r)} ${y1}` +
    `H${f(L(y1) + r)}Q${f(L(y1))} ${y1} ${f(L(y1 - r))} ${y1 - r}L${f(L(y0 + r))} ${y0 + r}Q${f(L(y0))} ${y0} ${f(L(y0) + r)} ${y0}Z`;
}

function motorBase(state, o) {
  let s = path(rrect(BX - 27.5, BASE_B - 3, 55, 7, 2.6), '#141418', stroke(0.8, '#000000'));
  const body = baseShape(BASE_T, BASE_B, 4);
  s += path(body, paint('steel', '#c9d0d6'), stroke(1, '#6c7680')) + path(body, paint('down-dark'), op(0.3));
  for (const x of [-18, -9, 6, 15]) s += line(`M${BX + x} 112V140`, WHITE, 0.7, op(0.18));
  // black glass band with the V on the front
  const v = (dy = 0) => `M${f(BX - baseW(BAND))} ${BAND + dy}L${BX - 4} ${111.6 + dy}Q${BX} ${113.6 + dy} ${BX + 4} ${111.6 + dy}L${f(BX + baseW(BAND))} ${BAND + dy}`;
  const bandPath = `M${f(BX - baseW(BASE_T) + 4)} ${BASE_T}H${f(BX + baseW(BASE_T) - 4)}Q${f(BX + baseW(BASE_T))} ${BASE_T} ${f(BX + baseW(BASE_T + 4))} ${BASE_T + 4}L${f(BX + baseW(BAND))} ${BAND}` +
    `L${BX + 4} 111.6Q${BX} 113.6 ${BX - 4} 111.6L${f(BX - baseW(BAND))} ${BAND}L${f(BX - baseW(BASE_T + 4))} ${BASE_T + 4}Q${f(BX - baseW(BASE_T))} ${BASE_T} ${f(BX - baseW(BASE_T) + 4)} ${BASE_T}Z`;
  s += line(v(0.9), '#000000', 1.4, op(0.25));
  s += path(bandPath, '#15161b', stroke(0.9, '#000000')) + path(bandPath, paint('down'), op(0.35));
  s += line(v(-0.5), '#c6d0da', 0.8, op(0.55)) + line(`M${f(BX - baseW(BASE_T) + 4)} ${BASE_T + 1}H${f(BX + baseW(BASE_T) - 4)}`, WHITE, 0.8, op(0.3));
  // display: 00:00 idle, the seconds left while blending (00:05 … 00:01), ✓, a red ! or Err
  const disp = (txt, col) => `<text x="${BX}" y="102.2" text-anchor="middle" font-family="'Courier New', monospace" font-weight="700" font-size="6.6" letter-spacing="0.2" fill="${col}">${txt}</text>`;
  if (state === 'ready') s += line(`M${BX - 3} 99.6L${BX - 0.8} 101.8L${BX + 3.4} 97.2`, '#58ff9c', 1.4);
  else if (state === 'overflowing') s += disp('!', '#ff5a5a');
  else if (state === 'ruined') s += disp('Err', '#ff5a5a');
  else {
    const secs = secsLeft(state, o);
    s += disp(`00:${secs < 10 ? '0' : ''}${secs}`, state === 'blending' ? '#5ff2ff' : '#e8f0f8');
  }
  s += circle(BX - 15.5, 100, 1, '#dfe6ee', op(0.8)) + `<text x="${BX + 15.5}" y="102" text-anchor="middle" font-family="${FONT}" font-size="4.4" fill="#dfe6ee" opacity="0.85">P</text>`;
  // portion LEDs in the V
  const n = Math.max(1, Math.min(4, o.maxPortions || 2));
  const left = state === 'ready' || state === 'overflowing' ? Math.max(0, Math.min(n, o.portions ?? n)) : 0;
  for (let i = 0; i < n; i++) {
    const x = BX + (i - (n - 1) / 2) * 4.6;
    const on = i < left;
    if (on) s += circle(x, 107.4, 3.2, OK, op(0.3));
    s += circle(x, 107.4, 1.5, on ? '#5df09a' : '#3c3d44', stroke(0.5, on ? '#1f8a4c' : '#202026'));
  }
  // the dial: ticks on the right, chrome ring, black cap with Start / Stop (two tiny lines and a thin
  // divider like the 3D knob's print), pointer
  const K = [BX, 124.5];
  for (let i = 0; i <= 10; i++) {
    const a = ((-90 + i * 13) * Math.PI) / 180;
    const r1 = 12.2 + i * 0.12;
    s += line(`M${f(K[0] + Math.cos(a) * 11.4)} ${f(K[1] + Math.sin(a) * 11.4)}L${f(K[0] + Math.cos(a) * r1)} ${f(K[1] + Math.sin(a) * r1)}`, '#2a2d33', 0.55);
  }
  for (const a of [150, 185, 220]) s += circle(K[0] + Math.cos((a * Math.PI) / 180) * 13, K[1] + Math.sin((a * Math.PI) / 180) * 13, 0.9, '#2a2d33');
  s += circle(K[0], K[1] + 0.8, 10.6, '#000000', op(0.25));
  s += circle(K[0], K[1], 10.2, paint('steel', '#cfd6dc'), stroke(0.8, '#5c6670')) + litCircle(K[0], K[1], 10.2, 'sph');
  s += circle(K[0], K[1], 7.4, paint('black-v', '#1d1d22'), stroke(0.6, '#000000'));
  const knobText = (txt, y) => `<text x="${K[0]}" y="${y}" text-anchor="middle" font-family="Nunito, 'Trebuchet MS', Arial, sans-serif" font-weight="800" font-size="2.4" fill="${WHITE}" opacity="0.85">${txt}</text>`;
  s += knobText('Start', K[1] - 1) + rect(K[0] - 3.2, K[1] - 0.2, 6.4, 0.35, 0.15, WHITE, op(0.6)) + knobText('Stop', K[1] + 2.6);
  const ang = ((state === 'blending' ? 30 : -90) * Math.PI) / 180;
  s += line(`M${f(K[0] + Math.cos(ang) * 8)} ${f(K[1] + Math.sin(ang) * 8)}L${f(K[0] + Math.cos(ang) * 9.9)} ${f(K[1] + Math.sin(ang) * 9.9)}`, WHITE, 1.4);
  s += `<text x="${BX}" y="139.2" text-anchor="middle" font-family="${FONT}" font-size="3.6" letter-spacing="0.7" fill="#25272c">AÇAÍ FEVER</text>`;
  return s;
}

// The jug's black collar on top of the base.
function collar() {
  return path(rrect(BX - 21, 86.5, 42, 9.5, 2.6), paint('black-v', '#1d1d22'), stroke(0.9, '#000000')) + line(`M${BX - 18} 88.4H${BX + 18}`, WHITE, 0.9, op(0.25));
}

// Black lid seen a little from above (top face, front edge), the spout cover on the left, the tab
// on the right and the clear measuring cap in the middle.
function lid() {
  const outline = `M${BX - 33} 31.2Q${BX - 31} 27.6 ${BX - 27} 26.2Q${BX - 26} 24 ${BX - 22} 24H${BX + 25}Q${BX + 29} 24 ${BX + 29.6} 26.6H${BX + 33.4}Q${BX + 35} 26.6 ${BX + 35} 28.2V29.4Q${BX + 35} 30.6 ${BX + 33.4} 30.6H${BX + 29.8}V31.6Q${BX + 29.6} 34 ${BX + 26} 34H${BX - 24}Q${BX - 28} 34 ${BX - 29} 32.6Z`;
  let s = path(outline, '#1b1c21', stroke(1, '#000000'));
  s += path(`M${BX - 27} 26.2Q${BX - 26} 24 ${BX - 22} 24H${BX + 25}Q${BX + 29} 24 ${BX + 29.6} 26.6Q${BX + 29} 28.6 ${BX + 25} 28.8H${BX - 22}Q${BX - 26} 28.6 ${BX - 27} 26.2Z`, '#3a3b43');
  s += line(`M${BX - 22} 25H${BX + 22}`, WHITE, 0.8, op(0.3)) + line(`M${BX - 26} 32.6H${BX + 24}`, WHITE, 0.7, op(0.12));
  // clear measuring cap
  s += path(`M${BX - 11} 26V22Q${BX - 11} 19 ${BX - 7} 19H${BX + 7}Q${BX + 11} 19 ${BX + 11} 22V26Z`, '#dcecf2', op(0.45) + stroke(0.8, '#8aa9b4'));
  s += ellipse(BX, 19.8, 9, 1.3, WHITE, op(0.45)) + line(`M${BX - 8.6} 22V25.2`, WHITE, 1, op(0.6));
  return s;
}

function badge(cx, cy, fill, inner) {
  return circle(cx, cy + 2, 13.5, '#000000', op(0.22)) + circle(cx, cy, 13.5, WHITE) + circle(cx, cy, 11, fill) + litCircle(cx, cy, 11, 'sph-soft') + inner;
}

// Whole seconds left on the display while blending (o.remaining, like the 3D model's countdown).
const secsLeft = (state, o) => (state === 'blending' ? Math.max(0, Math.min(59, Math.ceil(Number(o.remaining) || 0))) : 0);

export function blenderSVG(opts = {}, size = 150) {
  const o = opts || {};
  const state = ['empty', 'blending', 'ready', 'overflowing', 'ruined'].includes(o.state) ? o.state : 'empty';
  // progress is quantised so the cache stays small while the ring still moves smoothly
  const p = state === 'blending' ? Math.round(Math.max(0, Math.min(1, Number(o.progress) || 0)) * 48) / 48 : 0;
  const key = `x|${state}|${o.base}|${p}|${secsLeft(state, o)}|${o.portions}|${o.maxPortions}|${o.badge !== false}|${size}`;
  return memo(key, () => drawBlender(state, o, p, size));
}

function drawBlender(state, o, prog, size) {
  const p = pureeOf(ING[o.base]?.layer === 'base' ? o.base : 'acai');
  let s = softShadow(BX, 145, 38, 5.5);
  if (state === 'blending') s += line(`M${BX - 40} 52Q${BX - 46} 64 ${BX - 40} 76M${BX - 48} 58Q${BX - 52} 64 ${BX - 48} 70M${BX + 48} 104Q${BX + 54} 96 ${BX + 52} 86`, '#5b4b66', 2.2, op(0.5));
  s += motorBase(state, o);
  // clear handle (behind the jug's right wall)
  const handle = `M${f(jugR(42) - 2)} 41H${BX + 37}Q${BX + 42} 41 ${BX + 41.6} 46L${BX + 39.6} 70Q${BX + 39.2} 75 ${BX + 34} 75H${f(jugR(75) - 2)}`;
  s += path(handle, 'none', stroke(7.4, '#9fbac4') + op(0.55)) + path(handle, 'none', stroke(5.6, '#eef7fa') + op(0.7)) + path(handle, 'none', stroke(1.4, WHITE) + op(0.8));
  // jug: far wall tint, contents, blade, near wall with its flutes and scale
  s += path(JUG, paint('plastic-in', '#eaf6fa'));
  s += blenderContents(state, p, prog, o.portions, o.maxPortions);
  s += path(`M${BX - 11} ${JUG_BOT - 6}L${BX + 11} ${JUG_BOT - 9}M${BX - 11} ${JUG_BOT - 9}L${BX + 11} ${JUG_BOT - 6}`, 'none', stroke(2.2, '#aeb7c1'));
  s += circle(BX, JUG_BOT - 7.5, 2.2, '#7f8a95');
  s += path(JUG, paint('plastic', '#ffffff'));
  for (let i = 1; i < 8; i++) {
    const k = i / 8;
    const x0 = jugL(JUG_TOP + 3) + (jugR(JUG_TOP + 3) - jugL(JUG_TOP + 3)) * k;
    const x1 = jugL(JUG_BOT - 4) + (jugR(JUG_BOT - 4) - jugL(JUG_BOT - 4)) * k;
    s += line(`M${f(x0)} ${JUG_TOP + 3}L${f(x1)} ${JUG_BOT - 4}`, WHITE, 0.9, op(i % 2 ? 0.28 : 0.16)) + line(`M${f(x0 + 1.1)} ${JUG_TOP + 3}L${f(x1 + 0.8)} ${JUG_BOT - 4}`, '#5d7f8b', 0.5, op(0.12));
  }
  s += line(`M${f(jugL(40) + 3)} 40L${f(jugL(84) + 2.5)} 84`, WHITE, 2.6, op(0.5));
  s += line(`M${f(jugL(44) + 5)} 44V80`, WHITE, 0.8, op(0.75));
  for (const y of [46, 54, 62, 70, 78]) s += line(`M${f(jugL(y) + 5)} ${y}H${f(jugL(y) + (y % 16 === 14 ? 12 : 9))}`, WHITE, 1.1, op(0.75));
  // the spout: the rim reaches out on the left under the lid
  s += path(`M${f(jugL(JUG_TOP))} ${JUG_TOP}L${BX - 31} ${JUG_TOP - 1}Q${BX - 30} ${JUG_TOP + 3} ${f(jugL(JUG_TOP + 7))} ${JUG_TOP + 7}Z`, '#e3f1f5', op(0.6) + stroke(0.8, '#7f9faa'));
  s += path(JUG, 'none', stroke(1.1, '#6f909c') + op(0.7));
  s += collar();
  if (state === 'overflowing') {
    const foam = `M${BX - 38} 37C${BX - 48} 35 ${BX - 46} 19 ${BX - 32} 21C${BX - 30} 8 ${BX - 10} 6 ${BX - 4} 15C${BX + 4} 4 ${BX + 26} 6 ${BX + 28} 17C${BX + 42} 14 ${BX + 50} 27 ${BX + 40} 37Z`;
    s += path(foam, p.main, stroke(1.2, edge(p.main))) + lit(foam, 'sph-soft') + ellipse(BX - 22, 21, 8, 3, WHITE, op(0.45));
    for (const [x, y1, y2, w] of [[BX - 31, 34, 66, 5.6], [BX + 30, 34, 52, 4.6], [BX - 2, 37, 46, 4.2]]) {
      s += path(`M${x - w / 2} ${y1}V${y2 - w / 2}A${w / 2} ${w / 2} 0 0 0 ${x + w / 2} ${y2 - w / 2}V${y1}Z`, p.main, stroke(1, edge(p.main))) + line(`M${x - w * 0.15} ${y1 + 2}V${y2 - w}`, p.light, 1, op(0.7));
    }
    s += ellipse(BX - 36, 145.5, 10, 2.4, p.main, stroke(1, edge(p.main)));
    s += g(`translate(-14 -6) rotate(-20 ${BX} 30)`, lid());
  } else {
    s += lid();
  }
  if (state === 'ruined') {
    s += line(`M${BX - 18} 16Q${BX - 24} 10 ${BX - 18} 4Q${BX - 12} -2 ${BX - 18} -8M${BX + 22} 16Q${BX + 16} 10 ${BX + 22} 4Q${BX + 28} -2 ${BX + 22} -8M${BX + 2} 12Q${BX - 4} 6 ${BX + 2} 0`, '#8fa86a', 2.4, op(0.9));
    s += circle(BX - 46, 42, 2.2, '#1d1d22') + ellipse(BX - 47.8, 39.4, 2.4, 1.4, WHITE, op(0.85)) + ellipse(BX - 44, 39.4, 2.4, 1.4, WHITE, op(0.85));
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
// Matcha machine, the drawn version of the 3D model (js/kitchen3d.js) for browsers without WebGL,
// built from the model's own measures (MATCHA_GEO, projected with machinePoint), so its drip trays
// are where the glasses stand: olive shell, black front with the dark recesses, the smoked tanks
// with their collars and nozzles, the tea mill in its arched alcove, the lettering. viewBox = the
// machine's canvas (312 × 312), glasses drawn separately:
// MATCHA_SLOT_X[slotCount] → x fractions (of the machine box) of each glass centre;
// MATCHA_SLOT_Y → y fraction where the bottom edge of a glass element of
// size MATCHA_CUP_SIZE × machine size sits.
// ======================================================================
export const MATCHA_SLOT_X = [[0.356], [0.356], [0.212, 0.542]];
export const MATCHA_SLOT_Y = 0.874;
export const MATCHA_CUP_SIZE = 0.327;
// MATCHA_POUR_FROM: the y (of the glass's 100 viewBox) of the nozzle's tip over a glass on the drip
// tray – where the drawn machine's stream starts (matchaGlassSVG opts.from)
export const MATCHA_POUR_FROM = ((machinePoint([0, MATCHA_GEO.nozzle, GLASS_Z + 3.6])[1] / VIEWS.machine.h - MATCHA_SLOT_Y + MATCHA_CUP_SIZE) / MATCHA_CUP_SIZE) * 100;
// The status LED on the front left of a slot's collar, in px of the machine's canvas: the drawn
// machine's LED (the game lights it over the drawing while the slot brews or is ready)
export function matchaLedAt(slotCount, i) {
  const n = slotCount >= 2 ? 2 : 1;
  const G = MATCHA_GEO;
  const [rb] = G.models[n].tank;
  const x = MACHINE_SLOT_X[n][i] ?? MACHINE_SLOT_X[n][0];
  const [cx] = machinePoint([x, 0, 0]);
  const [, cy0] = machinePoint([x, G.collar[1], GLASS_Z + (rb + 0.9) * G.tankDepth]);
  const [, cy1] = machinePoint([x, G.collar[0], GLASS_Z + (rb + 0.9) * G.tankDepth]);
  return [cx - rb * 0.75 * VIEWS.machine.zoom, (cy0 + cy1) / 2 - 0.5];
}

const MT = { olive: '#7b7d52', oliveTop: '#a3a479', oliveDark: '#4c4e31', front: '#141518', recess: '#060607', tray: '#202125', smoke: '#463c33', powder: '#86a83f' };

// A face of the housing: the rounded rectangle through the projected corners (x0..x1, y0..y1 at depth z).
function face(x0, x1, y0, y1, z, r) {
  const [X0, Y0] = machinePoint([x0, y1, z]);
  const [X1, Y1] = machinePoint([x1, y0, z]);
  return rrect(X0, Y0, X1 - X0, Y1 - Y0, r);
}

export function matchaMachineSVG(slotCount = 1, size = 312) {
  const n = slotCount >= 2 ? 2 : 1;
  return memo(`m|${n}|${size}`, () => {
    const G = MATCHA_GEO;
    const M = G.models[n];
    const P = (x, y, z) => machinePoint([x, y, z]);
    const k = VIEWS.machine.zoom;
    const W = M.w / 2;
    const zA = GLASS_Z;
    let s = '';
    // contact shadow on the worktop
    const [, sy] = P(0, 0, (G.back + G.trayZ) / 2);
    s += softShadow(156, sy + 4, W * k + 10, 24);
    // olive shell: the top face, then the front (an olive frame around the black panel)
    const [tx0, ty0] = P(-W, G.h, G.back);
    const [tx1, ty1] = P(W, G.h, G.front);
    const top = rrect(tx0, ty0, tx1 - tx0, ty1 - ty0 + 8, 9);
    s += path(top, MT.oliveTop, stroke(1, MT.oliveDark)) + path(top, paint('down'), op(0.5));
    const shell = face(-W, W, 3, G.h, G.front, 11);
    s += path(shell, MT.olive, stroke(1.2, MT.oliveDark)) + path(shell, paint('cyl-soft'), op(0.8)) + path(shell, paint('down'), op(0.4));
    s += line(`M${f(tx0 + 12)} ${f(ty1 + 1.6)}H${f(tx1 - 12)}`, '#e6e6c4', 1.6, op(0.55));
    // the black front with a soft sheen from the top left
    const panel = face(-W + 6, W - 6, 7, G.h - 9, G.front + 1.5, 4);
    s += path(panel, MT.front, stroke(1, '#000000')) + path(panel, paint('black-v'), op(0.35));
    const [px0, py0] = P(-W + 6, G.h - 9, G.front + 1.5);
    s += path(`M${f(px0 + 6)} ${f(py0 + 4)}L${f(px0 + 60)} ${f(py0 + 4)}L${f(px0 + 6)} ${f(py0 + 90)}Z`, WHITE, op(0.04));
    // recesses behind the glasses, the mill's arched alcove
    const zP = G.front + 1.6;
    M.bays.forEach(([b0, b1]) => {
      const rec = face(b0 + 3, b1 - 3, 9, G.collar[0] - 1, zP, 6);
      s += path(rec, '#3a3e45', op(0.6)) + path(face(b0 + 3.4, b1 - 3.4, 9.4, G.collar[0] - 1.4, zP, 5.5), MT.recess) + path(rec, paint('up-dark'), op(0.5));
      const [, ry1] = P(0, 9, zP);
      const [rx0] = P(b0 + 5, 0, 0);
      const [rx1] = P(b1 - 5, 0, 0);
      s += rect(rx0, ry1 - 22, rx1 - rx0, 20, 4, '#4a515a', op(0.18));
    });
    const R = M.millR;
    const [ax0, ay0] = P(M.mill - R - 5, 9 + G.mill.cap - 3, zP);
    const [ax1, ay1] = P(M.mill + R + 5, 9, zP);
    const ar = (ax1 - ax0) / 2;
    const alcove = `M${f(ax0)} ${f(ay1)}V${f(ay0 + ar)}A${f(ar)} ${f(ar)} 0 0 1 ${f(ax1)} ${f(ay0 + ar)}V${f(ay1)}Z`;
    s += path(alcove, MT.recess, stroke(1.2, '#3a3e45')) + path(alcove, paint('up-dark'), op(0.5));
    // the drip tray along the bottom: its top in front of the panel, its front edge
    const [bx0, by0] = P(-W + 1, 8, G.front + 1.5);
    const [bx1, by1] = P(W - 1, 8, G.trayZ);
    const [, by2] = P(0, 0, G.trayZ);
    s += path(rrect(bx0, by0, bx1 - bx0, by1 - by0, 2), MT.tray) + path(rrect(bx0, by0, bx1 - bx0, by1 - by0, 2), paint('down'), op(0.25));
    s += path(rrect(bx0, by1 - 1, bx1 - bx0, by2 - by1 + 1, 3), '#111215', stroke(1, '#000000')) + line(`M${f(bx0 + 4)} ${f(by1)}H${f(bx1 - 4)}`, '#7d838c', 1.2, op(0.7));
    // per slot: the grate on the tray, the nozzle, the collar, the smoked tank with its lid
    M.bays.forEach(([b0, b1], i) => {
      const x = MACHINE_SLOT_X[n][i];
      const [gx0, gy0] = P(b0 + 6, 8, zA - 16);
      const [gx1, gy1] = P(b1 - 6, 8, zA + 16);
      s += path(rrect(gx0, gy0, gx1 - gx0, gy1 - gy0, 1.5), '#9aa2a9', stroke(0.8, '#3f454c'));
      let slots = '';
      for (let gx = gx0 + 4; gx < gx1 - 3; gx += 5.2) slots += `M${f(gx)} ${f(gy0 + 1.6)}V${f(gy1 - 1.6)}`;
      s += line(slots, '#202328', 2.4);
      const [cx] = P(x, 0, 0);
      const [rb, rt] = M.tank;
      // nozzle head and its chrome tip
      const [, hy0] = P(x, G.collar[0], zA + G.headR);
      const [, hy1] = P(x, G.nozzle + 3.6, zA + G.headR);
      const head = rrect(cx - G.headR * k, hy0, G.headR * 2 * k, hy1 - hy0 + 3, 4);
      s += path(head, '#1a1b1f', stroke(1, '#000000')) + path(head, paint('cyl'), op(0.6));
      const [, ty] = P(x, G.nozzle, zA + 3.6);
      s += path(rrect(cx - 3.6 * k, hy1, 7.2 * k, ty - hy1 + 2, 2), paint('steel', '#cfd6dc'), stroke(0.8, '#5f6a75'));
      // the tank: tapered smoked shell, the water in it, the grip, highlights, the lid on top
      const tTop = G.h - 3;
      const [, yb] = P(x, G.collar[1], zA + rb * G.tankDepth);
      const [, yt] = P(x, tTop, zA + rt * G.tankDepth);
      const tank = `M${f(cx - rt * k)} ${f(yt)}L${f(cx - rb * k)} ${f(yb - 3)}Q${f(cx - rb * k)} ${f(yb)} ${f(cx - rb * k + 4)} ${f(yb)}H${f(cx + rb * k - 4)}Q${f(cx + rb * k)} ${f(yb)} ${f(cx + rb * k)} ${f(yb - 3)}L${f(cx + rt * k)} ${f(yt)}Z`;
      s += path(tank, MT.smoke, stroke(1, '#1f1a16'));
      const waterY = yt + (yb - yt) * 0.3;
      const wl = (y) => cx - (rt + ((rb - rt) * (y - yt)) / (yb - yt)) * k + 3;
      const wr = (y) => 2 * cx - wl(y);
      s += path(`M${f(wl(waterY))} ${f(waterY)}L${f(wl(yb - 3))} ${f(yb - 3)}H${f(wr(yb - 3))}L${f(wr(waterY))} ${f(waterY)}Z`, '#6d6a62', op(0.55));
      s += line(`M${f(wl(waterY) + 1)} ${f(waterY)}H${f(wr(waterY) - 1)}`, '#b9b4a8', 1, op(0.6));
      s += path(tank, paint('cyl'), op(0.55));
      s += path(rrect(cx - rt * k * 0.62, yt + 8, rt * k * 0.3, (yb - yt) * 0.62, 4), '#a59886', op(0.45));
      s += line(`M${f(cx - rt * k + 5)} ${f(yt + 6)}L${f(cx - rb * k + 4)} ${f(yb - 8)}`, WHITE, 2.2, op(0.35));
      s += line(`M${f(cx + rt * k - 5)} ${f(yt + 6)}L${f(cx + rb * k - 4)} ${f(yb - 8)}`, WHITE, 1.2, op(0.25));
      const [, lidY] = P(x, tTop + 2, zA);
      const lid = rrect(cx - (rt + 1.4) * k, lidY - 5, (rt + 1.4) * 2 * k, 10, 5);
      s += path(lid, '#2a2725', stroke(1, '#0d0c0b')) + path(lid, paint('down'), op(0.5)) + ellipse(cx + rt * 0.35 * k, lidY - 1.5, 4, 1.4, '#0d0c0b');
      // the olive collar with its darker band, the chrome knob and the status LED
      const [, cy0] = P(x, G.collar[1], zA + (rb + 0.9) * G.tankDepth);
      const [, cy1] = P(x, G.collar[0], zA + (rb + 0.9) * G.tankDepth);
      const collar = rrect(cx - (rb + 0.9) * k, cy0 - 2, (rb + 0.9) * 2 * k, cy1 - cy0 + 4, 4);
      s += path(collar, MT.olive, stroke(1, MT.oliveDark)) + path(collar, paint('cyl'), op(0.7));
      s += rect(cx - (rb + 1) * k, cy1 - 7, (rb + 1) * 2 * k, 2.6, 1, MT.oliveDark, op(0.8));
      s += circle(cx + rb * 0.8 * k, (cy0 + cy1) / 2, 3.2, paint('steel', '#cfd6dc'), stroke(0.8, '#5f6a75'));
      const [ledX, ledY] = matchaLedAt(n, i);
      s += circle(ledX, ledY, 3, '#3a3d44', stroke(0.6, '#000000'));
    });
    // the tea mill: dark base, glass with the green powder and the cream burr, olive rings, dark cap
    const mx = P(M.mill, 0, 0)[0];
    const mr = R * k;
    const yAt = (y) => P(M.mill, y, zA + R)[1];
    const yTop = (y) => P(M.mill, y, zA)[1];
    const ry = R * k * Math.sin(ELEV);
    const cyl = (y0, y1, fill, a = '') => path(`M${f(mx - mr)} ${f(yTop(y1))}V${f(yAt(y0) - ry)}A${f(mr)} ${f(ry)} 0 0 0 ${f(mx + mr)} ${f(yAt(y0) - ry)}V${f(yTop(y1))}Z`, fill, a);
    s += cyl(8, G.mill.base, '#3a342e', stroke(1, '#15120f')) + cyl(8, G.mill.base, paint('cyl'), op(0.7));
    s += cyl(G.mill.base, G.mill.glass, '#e3eef0', op(0.25));
    const pw = (R - 2.6) * k;
    const level = G.mill.base + 20; // a full mill
    s += path(`M${f(mx - pw)} ${f(yTop(level))}V${f(yAt(G.mill.base) - ry + 1)}H${f(mx + pw)}V${f(yTop(level))}Z`, MT.powder) + ellipse(mx, yTop(level), pw, ry * 0.9, '#a3c25a');
    s += path(`M${f(mx - pw)} ${f(yTop(level))}V${f(yAt(G.mill.base) - ry + 1)}H${f(mx + pw)}V${f(yTop(level))}Z`, paint('cyl'), op(0.5));
    const rng = rngFor('mill-powder');
    let dots = '';
    for (let i = 0; i < 30; i++) dots += circle(mx + (rng.next() - 0.5) * 2 * pw * 0.9, yTop(level) + 2 + rng.next() * (yAt(G.mill.base) - yTop(level) - 6), 0.7, '#55701f', op(0.6));
    s += dots + line(`M${f(mx)} ${f(yTop(level))}V${f(yTop(G.mill.glass - 6))}`, '#c9ced3', 2.4);
    const burr = rrect(mx - (R - 4.2) * k, yTop(G.mill.glass - 6), (R - 4.2) * 2 * k, 7, 2.5);
    s += path(burr, '#ebe5d4', stroke(0.8, '#9d9682'));
    for (let i = -3; i <= 3; i++) s += line(`M${f(mx + i * 3.4)} ${f(yTop(G.mill.glass - 6) + 1)}V${f(yTop(G.mill.glass - 6) + 6)}`, '#9d9682', 0.8);
    s += cyl(G.mill.base, G.mill.glass, paint('glass'), op(0.6)) + cyl(G.mill.base, G.mill.glass, 'none', stroke(1, '#9ab9c5') + op(0.7));
    for (const y of [G.mill.glass - 5, G.mill.glass - 2.2]) s += rect(mx - mr, yAt(y) - ry - 1.4, mr * 2, 2.4, 1, MT.olive);
    s += cyl(G.mill.glass, G.mill.cap, '#3a342e', stroke(1, '#15120f')) + cyl(G.mill.glass, G.mill.cap, paint('cyl'), op(0.7));
    s += ellipse(mx, yTop(G.mill.cap), mr - 1, ry, '#4a433c', stroke(0.8, '#15120f')) + ellipse(mx - 3, yTop(G.mill.cap) - 0.6, mr * 0.5, ry * 0.4, WHITE, op(0.18));
    // lettering (and the temperature display of the two-slot model)
    const ly = n === 2 ? 142 : 138;
    const [, wy] = P(M.mill, ly, zP);
    s += `<text x="${f(mx)}" y="${f(wy + 4.5)}" text-anchor="middle" font-family="Nunito, 'Trebuchet MS', Arial, sans-serif" font-weight="900" font-size="${n === 2 ? 11.5 : 12.5}" letter-spacing="1.6" fill="#e8e2c2">MATCHA</text>`;
    s += `<text x="${f(mx)}" y="${f(wy + 16.5)}" text-anchor="middle" font-family="Nunito, 'Trebuchet MS', Arial, sans-serif" font-weight="900" font-size="5.2" letter-spacing="1" fill="#b9b48a">AÇAÍ FEVER</text>`;
    if (n === 2) {
      const [, dy] = P(M.mill, ly + 13, zP);
      s += rect(mx - 15, dy - 6, 30, 12, 2, '#050607', stroke(0.8, '#2a2d33'));
      s += `<text x="${f(mx)}" y="${f(dy + 4)}" text-anchor="middle" font-family="'Trebuchet MS', Arial, sans-serif" font-weight="700" font-size="10" fill="#a6ff6a">80°C</text>`;
    }
    return svgWrap(size, size, 312, 312, s);
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
// Café back wall (1280×330 stage px). Deliberately calm – mid-light, slightly muted colours, soft
// contrasts – so the guests and their bubbles stay in front: the bubbles cover y≈68–190 and the heads
// sit at y≈193–257 (seat x ± 27, ears ± 33), so nothing busy or saturated lies there. Depth from light: the
// room is lit from the top left like the counter, the window glows, the lamps throw warm halos, things on
// the wall cast soft shadows to the lower right and the corners fall off into a vignette.
// ======================================================================
// The window: one wide pane, its jambs only where no head stands with 2, 3 or 4 seats (seat x in js/game-view.js
// SEAT_X; each frame line keeps ≥ 30 px from a head, so no line grazes a face): the left jambs between the
// first heads of 3 and 2 seats (x 297 … 393), the right ones between the middle heads of 3 and 4 seats (667 … 760).
// No mullion: the pane's middle (x 540) is only 20 px from the second head with 4 seats.
const WIN = { x0: 351, x1: 729, y0: 78, y1: 232 }; // the opening in the wall
const WIN_IN = { x0: 363, x1: 717, y0: 89, y1: 232 }; // the frame, set back in the reveal
const WIN_CX = (WIN.x0 + WIN.x1) / 2; // 540
const RAIL_Y = 226; // top of the wainscot's rail
// x, cord length: a pair hung evenly about the window's middle, only in the HUD's gap (the hearts end by
// x≈457 even in endless mode, the money pill starts at x 678), so no shade hides behind a pill and no light
// seems to come out of one
const LAMPS = [[WIN_CX - 50, 30], [WIN_CX + 50, 30]];

// A soft shadow cast on the wall by a thing hanging or standing in front of it (offset to the lower right).
const wallShadow = (d, dx = 5, dy = 7) => g(`translate(${dx} ${dy})`, path(d, '#4a3018', op(0.08)) + g('translate(2 2)', path(d, '#4a3018', op(0.06))));

function pendant(x, len, ids) {
  const y = len;
  let s = path(`M${x - 20} ${y + 24}L${x - 96} 236H${x + 96}L${x + 20} ${y + 24}Z`, `url(#${ids.cone})`); // light falling on the wall
  s += ellipse(x, y + 26, 84, 62, `url(#${ids.glow})`);
  s += line(`M${x} 0V${y}`, '#2c2622', 1.4) + rect(x - 3, y - 3, 6, 5, 1.5, '#3c352f');
  const shade = `M${x - 23} ${y + 24}C${x - 22} ${y + 8} ${x - 12} ${y + 1} ${x} ${y + 1}C${x + 12} ${y + 1} ${x + 22} ${y + 8} ${x + 23} ${y + 24}Z`;
  s += path(shade, '#35302b', stroke(0.8, '#14110f')) + path(shade, paint('sph-soft'));
  s += line(`M${x - 15} ${y + 9}Q${x - 8} ${y + 3.6} ${x + 2} ${y + 3.4}`, WHITE, 1.3, op(0.3));
  s += ellipse(x, y + 24, 23, 3.6, '#1c1814') + ellipse(x, y + 24.6, 19, 2.6, '#ffe2a6') + ellipse(x, y + 25.4, 8, 2.6, '#fff8e4');
  return s;
}

function plantPot(x, y, k = 1) {
  const rng = rngFor(`plant-${x}`);
  const leafCol = ['#5f8a5e', '#6d9a68', '#557d55'];
  let leaves = '';
  let stems = '';
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.34 + (rng.next() - 0.5) * 0.2;
    const len = (30 + rng.next() * 18) * k;
    const ex = x + Math.cos(a) * len;
    const ey = y + Math.sin(a) * len;
    stems += `M${x} ${y}Q${f(x + Math.cos(a) * len * 0.4)} ${f(y + Math.sin(a) * len * 0.6)} ${f(ex)} ${f(ey)}`;
    const L = 18 * k;
    const W = 9 * k;
    const deg = (a * 180) / Math.PI;
    leaves += g(`translate(${f(ex)} ${f(ey)}) rotate(${f(deg)})`, path(`M0 0C${f(L * 0.3)} ${f(-W)} ${f(L * 0.8)} ${f(-W * 0.6)} ${f(L)} 0C${f(L * 0.8)} ${f(W * 0.6)} ${f(L * 0.3)} ${f(W)} 0 0Z`, leafCol[i % 3], stroke(0.8, '#3b5a3a')) + line(`M2 0H${f(L * 0.85)}`, '#a9c9a0', 0.8, op(0.6)));
  }
  const pot = `M${x - 18 * k} ${y}H${x + 18 * k}L${x + 14 * k} ${y + 30 * k}H${x - 14 * k}Z`;
  let s = g(`translate(${f(6 * k)} ${f(6 * k)})`, path(pot, '#4a3018', op(0.1)) + line(stems, '#4a3018', 1.6 * k, op(0.06)));
  s += softShadow(x + 2, y + 30 * k, 24 * k, 4 * k, 0.8);
  s += line(stems, '#46694a', 1.6 * k) + leaves;
  s += path(pot, '#e6dfd3', stroke(1, '#b0a592')) + path(pot, paint('cyl-soft')) + rect(x - 19 * k, y - 3 * k, 38 * k, 6 * k, 2 * k, '#f0ebe2', stroke(1, '#b0a592'));
  return s;
}

function jar(x, y, w, h, fill, dots) {
  let s = path(rrect(x + 5, y + 4, w, h, 6), '#4a3018', op(0.1)); // its shadow on the wall
  s += softShadow(x + w / 2 + 1, y + h, w * 0.6, 3);
  s += path(rrect(x, y, w, h, 6), '#e9f0ee', stroke(1, '#a7b6b6'));
  s += path(rrect(x + 3, y + h * 0.3, w - 6, h * 0.7 - 3, 4), fill);
  const rng = rngFor(`jar-${x}`);
  let grain = '';
  for (let i = 0; i < 10; i++) {
    const r = 1.8 + rng.next() * 1.2;
    grain += `M${f(x + 5 + rng.next() * (w - 10) - r)} ${f(y + h * 0.35 + rng.next() * (h * 0.6 - 6))}a${f(r)} ${f(r)} 0 1 0 ${f(r * 2)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-r * 2)} 0`;
  }
  s += path(grain, dots);
  s += path(rrect(x, y, w, h, 6), paint('glass'));
  s += line(`M${x + 6} ${y + 6}V${y + h - 8}`, WHITE, 2.4, op(0.55));
  s += path(rrect(x - 2, y - 6, w + 4, 8, 3), '#b99168', stroke(1, '#86603a')) + path(rrect(x - 2, y - 6, w + 4, 8, 3), paint('cyl-soft'));
  return s;
}

// A cup drawn in chalk on the menu board: a tapered cup, its purée heaped over the rim.
function chalkCup(x, y, col) {
  const cup = `M${x - 5} ${y - 3}L${x - 3.6} ${y + 6.4}H${x + 3.6}L${x + 5} ${y - 3}`;
  return path(`M${x - 5} ${y - 3}Q${x - 4.6} ${y - 7.6} ${x} ${y - 7.6}Q${x + 4.6} ${y - 7.6} ${x + 5} ${y - 3}Z`, col, op(0.75)) +
    path(`${cup}Z`, col, op(0.32)) + line(cup, '#f1eee6', 1.1, op(0.8)) + line(`M${x - 6} ${y - 3}H${x + 6}`, '#f1eee6', 1.1, op(0.8));
}

// The menu board hangs at the far left, so its title stays clear of the first bubble with 2 or 3 seats (it
// is decoration: with 4 seats the bubble covers most of it); its nail sits below the HUD.
function chalkBoard() {
  const [x, y, w, h] = [24, 76, 128, 112];
  const frame = rrect(x, y, w, h, 5);
  let s = line(`M${x + 22} ${y + 1}L${x + w / 2} 64L${x + w - 22} ${y + 1}`, '#3a322b', 1.1) + circle(x + w / 2, 64, 1.8, '#6b5a4a');
  s += wallShadow(frame, 6, 8);
  s += path(frame, '#a07a55', stroke(1, '#6b4c30')) + path(frame, paint('down'));
  const slate = rrect(x + 7, y + 7, w - 14, h - 14, 2);
  s += path(slate, '#3e4541') + path(slate, paint('sph-soft'));
  // chalk dust: wiped-out traces
  const rng = rngFor('chalk-dust');
  let dust = '';
  for (let i = 0; i < 10; i++) dust += ellipse(x + 16 + rng.next() * (w - 32), y + 20 + rng.next() * (h - 40), 8 + rng.next() * 16, 3 + rng.next() * 5, '#e8e6df', op((0.035 + rng.next() * 0.04).toFixed(3)) + tf(`rotate(${f(rng.next() * 30 - 15)} ${f(x + w / 2)} ${f(y + h / 2)})`));
  s += dust;
  s += `<text x="${x + w / 2}" y="${y + 33}" text-anchor="middle" font-family="${FONT}" font-size="21" fill="#f1eee6" opacity="0.85" letter-spacing="2">${esc(t('art.menu'))}</text>`;
  s += line(`M${x + 24} ${y + 41}Q${x + w / 2} ${y + 43.5} ${x + w - 24} ${y + 40.6}`, '#f1eee6', 1.1, op(0.5));
  // tiny cups of the three bases with their prices (no words: the same board in both languages)
  [['#a58fc8', '5'], ['#e59ab9', '7'], ['#8fc4d8', '9']].forEach(([col, price], i) => {
    const ry = y + 59 + i * 18;
    s += chalkCup(x + 24, ry + 1, col);
    s += line(`M${x + 38} ${ry + 3}H${x + w - 50}`, '#f1eee6', 1, op(0.35) + ' stroke-dasharray="1.5 4"');
    s += circle(x + w - 38, ry, 5.2, '#e9c46a', op(0.7)) + circle(x + w - 38, ry, 5.2, 'none', stroke(0.9, '#f1eee6') + op(0.55));
    s += `<text x="${x + w - 28}" y="${ry + 5.6}" font-family="${FONT}" font-size="15" fill="#f1eee6" opacity="0.85">${price}</text>`;
  });
  s += line(`M${x + 8} ${y + 7.6}H${x + w - 8}`, WHITE, 1, op(0.12));
  return s;
}

function windowView(clipId, ids) {
  const { x0, x1, y0, y1 } = WIN_IN;
  const w = x1 - x0;
  const X = (k) => f(x0 + w * k); // a point across the pane (0 = left frame, 1 = right frame)
  // a bright day outside: hazy, pale and low in contrast, like a view against the light
  let v = rect(x0, y0, w, y1 - y0, 0, `url(#${ids.sky})`);
  v += circle(X(0.8), 120, 46, '#fffbea', op(0.5)) + circle(X(0.8), 120, 20, '#fffdf4');
  for (const [k, cy, q] of [[0.2, 116, 1], [0.54, 106, 0.8]]) {
    const cx = x0 + w * k;
    v += ellipse(cx, cy, 28 * q, 7 * q, WHITE, op(0.7)) + ellipse(cx + 12 * q, cy - 5 * q, 16 * q, 7 * q, WHITE, op(0.7)) + ellipse(cx - 12 * q, cy - 3 * q, 12 * q, 5 * q, WHITE, op(0.65));
  }
  v += rect(x0, 172, w, y1 - 172, 0, `url(#${ids.sea})`) + rect(x0, 172, w, 2, 0, '#7fb2ba', op(0.5));
  v += line([[0.06, 190], [0.34, 200], [0.63, 186], [0.76, 206], [0.18, 210]].map(([k, y]) => `M${X(k)} ${y}q10 -3 20 0`).join(''), WHITE, 1.4, op(0.5));
  v += path(`M${x0} 214Q${X(0.25)} 202 ${X(0.5)} 210T${x1} 206V232H${x0}Z`, '#e8dbbf');
  // palm, soft against the light
  const px = x0 + w * 0.88;
  v += line(`M${f(px - 6)} 232Q${f(px - 12)} 192 ${f(px)} 150`, '#9a8a74', 5);
  for (const deg of [-160, -120, -70, -30, 10]) {
    const a = (deg * Math.PI) / 180;
    v += path(`M${f(px)} 150Q${f(px + Math.cos(a) * 30)} ${f(150 + Math.sin(a) * 30 - 10)} ${f(px + Math.cos(a) * 54)} ${f(150 + Math.sin(a) * 54 + 6)}Q${f(px + Math.cos(a) * 28)} ${f(150 + Math.sin(a) * 28 + 2)} ${f(px)} 150Z`, '#7f9a80', op(0.9));
  }
  v += rect(x0, y0, w, y1 - y0, 0, '#ffffff', op(0.16)); // haze
  v += line(`M${X(0.12)} 94L${X(0.25)} 228M${X(0.34)} 94L${X(0.41)} 160M${X(0.69)} 94L${X(0.81)} 228`, WHITE, 9, op(0.12)); // reflections on the glass
  return `<g clip-path="url(#${clipId})">${v}</g>`;
}

function cafeWindow(clipId, ids) {
  const { x0, x1, y0, y1 } = WIN;
  const I = WIN_IN;
  let s = ellipse(WIN_CX, 160, 300, 130, `url(#${ids.bloom})`); // daylight spilling around the opening
  // the reveal: its top in shadow, the left jamb turned away from the light, the right one lit
  s += path(`M${x0} ${y0}H${x1}L${I.x1} ${I.y0}H${I.x0}Z`, '#c4b39c');
  s += path(`M${x0} ${y0}L${I.x0} ${I.y0}V${I.y1}H${x0}Z`, '#d0c0a9');
  s += path(`M${x1} ${y0}L${I.x1} ${I.y0}V${I.y1}H${x1}Z`, '#f0e7da');
  s += path(`M${x0} ${y0}L${I.x0} ${I.y0}V${I.y1}H${x0}Z`, `url(#${ids.jamb})`) + path(`M${x1} ${y0}L${I.x1} ${I.y0}V${I.y1}H${x1}Z`, `url(#${ids.jamb})`);
  s += windowView(clipId, ids);
  // slim frame
  s += path(`${rrect(I.x0, I.y0, I.x1 - I.x0, I.y1 - I.y0, 2)}${rrect(I.x0 + 5, I.y0 + 5, I.x1 - I.x0 - 10, I.y1 - I.y0 - 10, 1)}`, '#544c45', ' fill-rule="evenodd"');
  s += line(`M${I.x0 + 5} ${I.y0 + 5.6}H${I.x1 - 5}`, '#2e2925', 1, op(0.5));
  s += line(`M${I.x1 - 1} ${I.y0 + 2}V${I.y1}`, '#8a8076', 1, op(0.7));
  s += path(`M${x0} ${y0}H${x1}V${y1}H${x0}Z`, 'none', stroke(1, '#b3a088') + op(0.8));
  return s;
}

// The window's sill: a light stone board lying on the wainscot's rail, its shadow on the reeds.
function windowSill() {
  const y = WIN.y1;
  const [a, b] = [WIN.x0 - 12, WIN.x1 + 12];
  return rect(a - 2, y + 5, b - a + 4, 7, 0, '#4a3018', op(0.14)) +
    path(rrect(a, y - 6, b - a, 11, 2.5), '#ece4d6', stroke(0.8, '#b3a691')) + rect(a + 0.5, y + 0.4, b - a - 1, 4, 0, '#d6cab6') + line(`M${a + 3} ${y - 5.2}H${b - 3}`, WHITE, 1, op(0.8));
}

function wainscot(W, H, ids) {
  // fluted oak: each reed lit on its left, shaded on its right; dimmer at the bottom near the pass
  let s = rect(0, RAIL_Y + 10, W, H - RAIL_Y - 10, 0, '#c4a27b');
  let hi = '';
  let lo = '';
  for (let x = 0; x < W; x += 12) {
    hi += `M${x + 3} ${RAIL_Y + 10}V${H}`;
    lo += `M${x + 10.5} ${RAIL_Y + 10}V${H}`;
  }
  s += line(hi, '#dcc29d', 2.6, op(0.55)) + line(lo, '#987650', 1.6, op(0.45));
  s += rect(0, RAIL_Y + 10, W, H - RAIL_Y - 10, 0, `url(#${ids.panel})`);
  // the rail, and the soft shadow it casts on the reeds
  s += rect(0, RAIL_Y, W, 10, 0, '#8d6a4b') + rect(0, RAIL_Y, W, 2.4, 0, '#c29a72') + rect(0, RAIL_Y + 7.6, W, 2.4, 0, '#5e4330');
  return s;
}

function shelf(ids) {
  // one floating oak shelf with a few jars, a plant and a stack of cups (low-key: the bubbles of the
  // right seats lie over it); everything throws a soft shadow down to the right
  const [x, y, w] = [950, 150, 276];
  let s = rect(x + 6, y + 9, w, 9, 0, `url(#${ids.under})`);
  for (const bx of [x + 26, x + w - 26]) s += path(`M${bx - 3} ${y + 8}H${bx + 3}L${bx + 1} ${y + 22}H${bx - 1}Z`, '#5a4636') + rect(bx + 3, y + 12, 3, 12, 1, '#4a3018', op(0.08));
  s += jar(966, 110, 32, 40, '#bf9258', '#8c6538') + jar(1006, 114, 28, 36, '#6b4c74', '#8a6a92');
  s += plantPot(1080, 122, 0.82);
  // the cup stack (its foot on the board, y 150), its shadow on the wall and on the board
  s += path('M1126.4 100.4H1156.4V115.7L1151.6 150H1131.2L1126.4 115.7Z', '#4a3018', op(0.1) + tf('translate(5 4)')) + softShadow(1142.4, 150, 18, 3);
  s += g('translate(1121 86.8) scale(0.34)', cupStackShape());
  s += jar(1170, 114, 30, 36, '#eee4cf', '#d2c19f');
  s += path(rrect(x, y, w, 9, 2), '#b58c63', stroke(1, '#7a5636')) + rect(x + 1, y + 0.6, w - 2, 1.6, 0, '#dcbb92', op(0.8)) + rect(x, y + 6, w, 3, 2, '#7a5636', op(0.5));
  return s;
}

export function shopSceneSVG(width = 1280, height = 330) {
  const W = 1280;
  const H = 330;
  // ids local to this picture (one wall per screen); all named af-wall-… / af-glow-… / af-sky-… / af-sea-… / af-win-…
  const ids = { wall: uid('wall'), shaft: uid('wall'), vig: uid('wall'), panel: uid('wall'), under: uid('wall'), jamb: uid('wall'), cone: uid('glow'), glow: uid('glow'), bloom: uid('glow'), sky: uid('sky'), sea: uid('sea') };
  const winClip = uid('win');
  const st = (list) => list.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}"${a < 1 ? ` stop-opacity="${a}"` : ''}/>`).join('');
  let s = '<defs>' +
    `<linearGradient id="${ids.wall}" x1="0" y1="0" x2="0" y2="1">${st([[0, '#ddd0be'], [0.3, '#e6dac9'], [1, '#dccbb5']])}</linearGradient>` +
    `<radialGradient id="${ids.shaft}" cx="0.5" cy="0.5" r="0.5">${st([[0, '#fff6e2', 0.55], [0.55, '#fff3dc', 0.2], [1, '#fff3dc', 0]])}</radialGradient>` +
    `<radialGradient id="${ids.vig}" cx="0.5" cy="0.42" r="0.72">${st([[0, '#5a4430', 0], [0.62, '#5a4430', 0], [1, '#4a3420', 0.3]])}</radialGradient>` +
    `<linearGradient id="${ids.panel}" x1="0" y1="0" x2="0" y2="1">${st([[0, '#3a2414', 0.32], [0.12, '#3a2414', 0.06], [0.55, '#3a2414', 0], [1, '#3a2414', 0.3]])}</linearGradient>` +
    `<linearGradient id="${ids.under}" x1="0" y1="0" x2="0" y2="1">${st([[0, '#4a3018', 0.2], [1, '#4a3018', 0]])}</linearGradient>` +
    `<linearGradient id="${ids.jamb}" x1="0" y1="0" x2="0" y2="1">${st([[0, '#4a3018', 0.12], [0.5, '#ffffff', 0], [1, '#ffffff', 0.12]])}</linearGradient>` +
    `<linearGradient id="${ids.cone}" x1="0" y1="0" x2="0" y2="1">${st([[0, '#ffe7b8', 0.3], [0.6, '#ffe7b8', 0.08], [1, '#ffe7b8', 0]])}</linearGradient>` +
    `<radialGradient id="${ids.glow}" cx="0.5" cy="0.35" r="0.6">${st([[0, '#ffdca0', 0.55], [0.5, '#ffd58c', 0.16], [1, '#ffd58c', 0]])}</radialGradient>` +
    `<radialGradient id="${ids.bloom}" cx="0.5" cy="0.5" r="0.5">${st([[0, '#fffaf0', 0.65], [0.6, '#fff8ec', 0.22], [1, '#fff8ec', 0]])}</radialGradient>` +
    `<linearGradient id="${ids.sky}" x1="0" y1="0" x2="0" y2="1">${st([[0, '#b9dcea'], [1, '#e6f2f1']])}</linearGradient>` +
    `<linearGradient id="${ids.sea}" x1="0" y1="0" x2="0" y2="1">${st([[0, '#7fbcc4'], [1, '#a9d4d1']])}</linearGradient>` +
    `<clipPath id="${winClip}"><rect x="${WIN_IN.x0}" y="${WIN_IN.y0}" width="${WIN_IN.x1 - WIN_IN.x0}" height="${WIN_IN.y1 - WIN_IN.y0}"/></clipPath></defs>`;
  // plaster: warm greige, soft trowel marks and fine grain, a slanted patch of light from the top left
  s += rect(0, 0, W, H, 0, `url(#${ids.wall})`);
  const rng = rngFor('wall-texture');
  let marks = '';
  for (let i = 0; i < 46; i++) marks += ellipse(rng.next() * W, 20 + rng.next() * 206, 24 + rng.next() * 54, 6 + rng.next() * 12, rng.next() < 0.6 ? '#ffffff' : '#b49c80', op(0.07) + tf(`rotate(${f(rng.next() * 16 - 8)})`));
  s += marks;
  let grain = '';
  for (let i = 0; i < 260; i++) {
    const r = 0.5 + rng.next() * 0.7;
    grain += `M${f(rng.next() * W)} ${f(16 + rng.next() * 210)}a${f(r)} ${f(r)} 0 1 0 ${f(r * 2)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-r * 2)} 0`;
  }
  s += path(grain, '#9e8668', op(0.16));
  s += ellipse(300, 110, 430, 120, `url(#${ids.shaft})`, tf('rotate(24 300 110)'));
  s += cafeWindow(winClip, ids);
  s += chalkBoard();
  s += shelf(ids);
  s += wainscot(W, H, ids) + windowSill();
  // ceiling: a dark oak cornice, its shadow on the wall
  s += rect(0, 12, W, 18, 0, `url(#${ids.under})`) + rect(0, 0, W, 12, 0, '#5a4232') + rect(0, 10, W, 2, 0, '#7d604a');
  for (const [x, len] of LAMPS) s += pendant(x, len, ids);
  s += rect(0, 0, W, H, 0, `url(#${ids.vig})`);
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
// Decor (viewBox 120×120): bought in the shop, stands in the café in front of the back wall – in its
// light (top left) and its muted colours. In the café (wall: true) each piece casts a soft shadow on the
// wall to the lower right; on the shop's cards only its contact shadow on the floor shows.
// ======================================================================
const decorShadow = (d, dx = 7, dy = 5) => g(`translate(${dx} ${dy})`, path(d, '#3a2414', op(0.1)) + g('translate(3 2)', path(d, '#3a2414', op(0.06))));
// heart-shaped monstera leaf along +x
const monsteraPath = (L, W = L * 0.82) => `M0 0C${f(L * 0.05)} ${f(-W * 0.55)} ${f(L * 0.55)} ${f(-W * 0.62)} ${f(L)} ${f(-W * 0.05)}C${f(L * 0.6)} ${f(W * 0.6)} ${f(L * 0.08)} ${f(W * 0.58)} 0 0Z`;
const PLANT_LEAVES = [[38, 58, 34, -150, '#43784e'], [86, 56, 32, -30, '#4c8858'], [62, 40, 36, -92, '#52905d'], [30, 80, 24, 172, '#3d6d47']];
function monsteraLeaf(x, y, len, deg, col) {
  const L = len;
  const W = len * 0.82;
  // heart-shaped leaf with the typical slits
  const d = monsteraPath(L, W);
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
  plants(wall) {
    const pot = 'M38 86H82L78 113Q77.5 116 74 116H46Q42.5 116 42 113Z';
    const stems = 'M60 86Q52 70 38 58M60 86Q60 62 62 38M60 86Q70 70 86 56M60 86Q50 82 30 80';
    let s = '';
    // the leaves, stems and pot cast their own shapes on the wall (one group, so overlaps do not darken)
    if (wall) s += g('translate(7 5)', PLANT_LEAVES.map(([x, y, len, deg]) => g(`translate(${x} ${y}) rotate(${deg})`, path(monsteraPath(len), '#3a2414'))).join('') + line(stems, '#3a2414', 2.2) + path(pot, '#3a2414'), op(0.12));
    s += softShadow(60, 116, 30, 4);
    s += line(stems, '#3d6a44', 2.2);
    s += PLANT_LEAVES.map(([x, y, len, deg, col]) => monsteraLeaf(x, y, len, deg, col)).join('');
    // ceramic pot
    s += path(pot, '#efe9e0', stroke(1, '#a99f92')) + path(pot, paint('cyl'));
    s += path('M43 100H77', 'none', stroke(3, '#c97d43') + op(0.85));
    s += path(rrect(35, 81, 50, 7, 3), '#f7f3ec', stroke(1, '#a99f92')) + path(rrect(35, 81, 50, 7, 3), paint('cyl-soft'));
    return s;
  },

  jukebox(wall) {
    const body = 'M24 112V56A36 36 0 0 1 96 56V112Z';
    let s = (wall ? decorShadow(body) : '') + softShadow(60, 116, 42, 4);
    s += path(body, '#6e3a28', stroke(1, '#3d1a0f')) + path(body, paint('cyl'));
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

  seating(wall) {
    // velvet armchair in a dusty rose
    const back = 'M10 102C6 70 14 50 40 48C64 46 74 60 72 100Z';
    const seat = 'M6 96Q6 86 18 86H64Q76 86 76 96V104Q76 110 68 110H14Q6 110 6 104Z';
    // on the wall: the chair's back, the side table's round top, its leg and foot
    let s = wall ? decorShadow(back) + decorShadow('M80 94a16 4.6 0 1 0 32 0a16 4.6 0 1 0 -32 0ZM94.7 97h2.6v18h-2.6ZM88 114.7h16v2.6h-16Z') : '';
    s += softShadow(56, 114, 54, 5);
    s += path(back, '#c0607f', stroke(1, '#6a2440')) + path(back, paint('sph'));
    s += line('M28 54V96M44 51V96M58 54V96', '#93405e', 1.4, op(0.6));
    s += path(seat, '#cc6c8c', stroke(1, '#6a2440')) + path(seat, paint('down'));
    s += line('M14 116L16 110M68 116L66 110', '#6b4a33', 3);
    // side table with an iced matcha
    s += line('M96 96V116M88 116H104', '#1d1d22', 2.6);
    s += ellipse(96, 94, 16, 4.6, '#f4f1ec', stroke(1, '#a99f92')) + ellipse(96, 93.4, 16, 4, paint('sph-soft'));
    // the glass: mango purée, milk and matcha in layers, a paper straw
    s += line('M98.5 74L104 56', '#7a8f3c', 2.6) + line('M98.5 74L104 56', '#f6f1e4', 1.8);
    s += path('M89.6 86H102.4L101.6 91.6H90.4Z', '#ffa623') + path('M89.2 80H102.8L102.4 86H89.6Z', '#f4efe3') + path('M88.6 71.5H103.4L102.8 80H89.2Z', '#7f9f37');
    s += ellipse(96, 71.5, 7.4, 1.4, '#e3ebc0');
    const glass = 'M88 69H104L101.6 92H90.4Z';
    s += path(glass, paint('plastic', '#ffffff'), stroke(0.9, '#8fb0bd'));
    return s;
  },

  neon(wall) {
    const word = esc(t('art.neon'));
    const txt = (a) => `<text x="60" y="72" text-anchor="middle" font-family="${FONT}" font-size="34" textLength="76" lengthAdjust="spacingAndGlyphs"${a}>${word}</text>`;
    let s = line('M24 32L60 10L96 32', '#3b2a33', 1.2) + circle(60, 10, 2.4, paint('steel', '#cfd6dc'), stroke(0.8, '#5f6a75'));
    if (wall) s += decorShadow(rrect(8, 30, 104, 62, 10), 5, 4);
    // a smoky dark acrylic backing; the tubes in a soft rose and a muted teal with a faint halo – lit, but calm
    // next to the guests
    s += path(rrect(8, 30, 104, 62, 10), '#32283a', stroke(1, '#1a141f'));
    s += path(rrect(8, 30, 104, 62, 10), paint('glass'));
    for (const [x, y] of [[16, 38], [104, 38], [16, 84], [104, 84]]) s += circle(x, y, 2.2, paint('steel', '#cfd6dc'), stroke(0.6, '#5f6a75'));
    s += txt(` fill="none" stroke="#e8689c" stroke-width="9" stroke-linejoin="round" opacity="0.16"`);
    s += txt(` fill="none" stroke="#ef86b2" stroke-width="3.6" stroke-linejoin="round"`);
    s += txt(` fill="none" stroke="#fde6f0" stroke-width="1.2" stroke-linejoin="round"`);
    s += line('M28 82Q60 90 92 80', '#4fb4b8', 6, op(0.16)) + line('M28 82Q60 90 92 80', '#7fcfd2', 2.4) + line('M28 82Q60 90 92 80', '#e6fbfb', 0.8);
    return s;
  },
};

// wall: false for a piece shown on its own (shop card, gallery) – no shadow on a wall that is not there
export function decorSVG(id, size = 120, { wall = true } = {}) {
  const draw = DECOR[id];
  return svgWrap(size, size, 120, 120, draw ? draw(wall) : '');
}
