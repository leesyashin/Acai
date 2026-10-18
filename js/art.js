// Art for Açaí Fever – every export returns an inline <svg> string. Pure module (no DOM access):
// the same input always draws the same picture (pseudo-randomness is derived from a hash of the
// input). This module draws the HUD icons, logo and map in the cartoon style and re-exports the
// realistic food, kitchen and guest art (js/art-food.js, js/art-kitchen.js, js/art-guests.js), so
// the screens import every picture from here. Shared gradients: artDefsSVG() (js/svg.js).

import { registerStrings, t } from './i18n.js';
import { cupArt } from './art-food.js';
import {
  INK, WHITE, PINK, LAGOON, MANGO, CREAM, WOOD, WOOD_D, SHADE_DIR, FONT, f, uid, rngFor, lighten,
  darken, esc, ow, svgWrap, stroke, op, circle, ellipse, path, rect, g, line, tube, shape, gloss,
  rrect, crescent, ball, bigLeaf, polyPath, starPoints, sparkle, puffs, frond,
} from './svg.js';

export {
  ingredientIcon, packIcon, bowlSVG, matchaGlassSVG, matchaFruitColorOf, MATCHA_COLORS, MATCHA_MILK, MATCHA_STRAW, binSVG, binFillSVG,
  scoopSVG, cupStackSVG, cupSpotSVG,
} from './art-food.js';
export {
  blenderSVG, blenderBadgeSVG, matchaMachineSVG, matchaLedAt, MATCHA_SLOT_X, MATCHA_SLOT_Y, MATCHA_CUP_SIZE, MATCHA_POUR_FROM, trashSVG,
  shopSceneSVG, decorSVG, counterSVG, freezerSVG, riserSVG,
} from './art-kitchen.js';
export { customerSVG, randomLook, lookFromSeed, LOOK_OPTIONS } from './art-guests.js';
export { artDefsSVG, ART_DEFS_ID } from './svg.js';

registerStrings({
  de: { 'art.menu': 'Menü', 'art.neon': 'Açaí', 'art.logoTop': 'Açaí', 'art.logoBottom': 'Fever' },
  en: { 'art.menu': 'Menu', 'art.neon': 'Açaí', 'art.logoTop': 'Açaí', 'art.logoBottom': 'Fever' },
});


// ======================================================================
// Small UI icons (viewBox 100×100)
// ======================================================================
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
// Palm tree (level map)
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
  s += g('translate(366 50) scale(0.92) rotate(6 100 100)', cupArt({ base: 'acai', mid: ['banana', 'strawberry', 'blueberry'], top: ['coconut', 'honey', 'mint'] }));
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
