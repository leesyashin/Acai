// Art for Açaí Fever – every export returns an inline <svg> string. Pure module (no DOM access):
// the same input always draws the same picture (pseudo-randomness is derived from a hash of the
// input). This module draws the HUD icons, logo and title counter in the cartoon style and re-exports the
// level map (js/art-map.js) and the realistic food, kitchen and guest art (js/art-food.js, js/art-kitchen.js,
// js/art-guests.js), so
// the screens import every picture from here. Shared gradients: artDefsSVG() (js/svg.js).

import { registerStrings, t } from './i18n.js';
import { cupArt } from './art-food.js';
import {
  INK, WHITE, PINK, MANGO, CREAM, SHADE_DIR, FONT, f, uid, rngFor, esc, ow, svgWrap, stroke, op, circle, path, rect, g, line,
  tube, shape, gloss, rrect, crescent, bigLeaf, polyPath, starPoints, sparkle,
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
export {
  mapRegionSVG, mapBackgroundSVG, mapLevelPos, mapRoadData, MAP_W, MAP_H, MAP_BLEED, MAP_REGIONS,
} from './art-map.js';

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
// App icon (viewBox 512×512, a full square – the system rounds it): the logo's cup with its leaves on the açaí
// sunburst. maskable: the cup stays inside the central 80 % circle that every mask keeps.
// ======================================================================
export function appIconSVG(size = 512, { maskable = false } = {}) {
  const bg = uid('icon');
  const k = maskable ? 1.5 : 1.85;
  let s = `<defs><radialGradient id="${bg}" cx="0.5" cy="0.42" r="0.75"><stop offset="0" stop-color="#b56ae0"/><stop offset="0.45" stop-color="#6c2a8f"/><stop offset="1" stop-color="#3b1556"/></radialGradient></defs>`;
  s += rect(0, 0, 512, 512, 0, `url(#${bg})`);
  let rays = '';
  for (let i = 0; i < 24; i++) {
    const a0 = (i / 24) * Math.PI * 2;
    const a1 = a0 + Math.PI / 24;
    rays += `M256 215L${f(256 + Math.cos(a0) * 520)} ${f(215 + Math.sin(a0) * 520)}L${f(256 + Math.cos(a1) * 520)} ${f(215 + Math.sin(a1) * 520)}Z`;
  }
  s += path(rays, WHITE, op(0.08));
  const sw = 3.2;
  const cx = 256;
  const cy = maskable ? 262 : 282;
  s += g(`translate(${cx} ${cy}) scale(${k})`,
    bigLeaf(18, -70, 82, 46, -62, '#2fbf71', sw) + bigLeaf(26, -64, 66, 38, -14, '#23a35e', sw) + bigLeaf(10, -64, 72, 38, -120, '#36cf7c', sw) +
    g('translate(-104 -112) rotate(6 100 100)', cupArt({ base: 'acai', mid: ['banana', 'strawberry', 'blueberry'], top: ['coconut', 'honey', 'mint'] })));
  s += sparkle(maskable ? 128 : 92, maskable ? 150 : 110, maskable ? 16 : 22, WHITE, stroke(2.4)) + sparkle(maskable ? 390 : 420, maskable ? 372 : 400, maskable ? 12 : 16, WHITE, stroke(2.4));
  return svgWrap(size, size, 512, 512, s);
}

// ======================================================================
// Title screen counter (1280×116 on the stage): a marble top with a rounded front edge over a fluted açaí-purple
// front and a brass foot rail – the café's counter the title guest leans on. bleed / below: drawn that much
// further to either side and down (seen in full bleed on wider or taller screens); the picture is
// (1280 + 2·bleed) × (116 + below) px with the stage's x 0 at `bleed`.
// ======================================================================
export function titleCounterSVG(bleed = 0, below = 0) {
  const X0 = -bleed;
  const X1 = 1280 + bleed;
  const H = 116 + below;
  const sw = 3;
  const top = uid('ctop');
  const rail = uid('crail');
  let s = `<defs><linearGradient id="${top}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffaf2"/><stop offset="1" stop-color="#f2e2cc"/></linearGradient>` +
    `<linearGradient id="${rail}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset="0.45" stop-color="#ffc93c"/><stop offset="1" stop-color="#b9780f"/></linearGradient></defs>`;
  // fluted front: rounded açaí-purple staves, lit from the left
  s += rect(X0, 30, X1 - X0, H - 30, 0, '#4a1a66');
  for (let x = -Math.ceil(bleed / 32) * 32; x < X1; x += 32) {
    s += rect(x + 2, 34, 28, H - 34, 12, '#6c2a8f') + rect(x + 5, 38, 8, H - 42, 4, '#9b4fc4', op(0.75)) + rect(x + 22, 38, 6, H - 42, 3, '#3b1556', op(0.45));
  }
  // brass foot rail on its brackets
  for (let x = 96 - Math.ceil(bleed / 216) * 216; x < X1; x += 216) s += shape(rrect(x - 7, 90, 14, 22, 3), '#c98a1c', sw * 0.8);
  s += shape(rrect(X0 - 10, 84, X1 - X0 + 20, 14, 7), `url(#${rail})`, sw, line(`M${X0} 88H${X1}`, WHITE, 2.4, op(0.7)));
  // the slab's shadow on the front, then the marble top with a rounded edge
  s += rect(X0, 30, X1 - X0, 12, 0, '#14061e', op(0.35));
  s += rect(X0 - 4, 0, X1 - X0 + 8, 32, 0, `url(#${top})`);
  const rng = rngFor('title-marble');
  let veins = '';
  let veins2 = '';
  for (let i = 0; i < 9 + Math.round(bleed / 90); i++) {
    const x = X0 + rng.next() * (X1 - X0);
    const y = 4 + rng.next() * 16;
    const d = `M${f(x)} ${f(y)}c${f(30 + rng.next() * 30)} ${f(-6 + rng.next() * 12)} ${f(50 + rng.next() * 40)} ${f(-4 + rng.next() * 10)} ${f(90 + rng.next() * 60)} ${f(-3 + rng.next() * 8)}`;
    if (i % 3) veins += d;
    else veins2 += d;
  }
  s += line(veins, '#e9b9d0', 1.6, op(0.55)) + line(veins2, '#c9b0e6', 1.3, op(0.55));
  s += rect(X0 - 4, 22, X1 - X0 + 8, 10, 0, '#e3cdb2', op(0.75)) + line(`M${X0} 23H${X1}`, WHITE, 2, op(0.8));
  s += line(`M${X0} 1.5H${X1}`, INK, sw) + line(`M${X0} 31H${X1}`, INK, sw * 0.8);
  s += line(`M${X0} 6H${X1}`, WHITE, 3, op(0.9));
  return svgWrap(X1 - X0, H, X1 - X0, H, g(`translate(${bleed} 0)`, s));
}
