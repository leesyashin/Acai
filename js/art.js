// Art for Açaí Fever – every export returns an inline <svg> string. Pure module (no DOM access):
// the same input always draws the same picture (pseudo-randomness is derived from a hash of the
// input). This module draws the people, the HUD icons, decor, logo and map in the cartoon style
// and re-exports the realistic food and kitchen art (js/art-food.js, js/art-kitchen.js), so the
// screens import every picture from here. Shared gradients: artDefsSVG() (js/svg.js).

import { createRng } from './rng.js';
import { registerStrings, t } from './i18n.js';
import { cupArt } from './art-food.js';
import {
  INK, WHITE, PINK, LAGOON, MANGO, LEAF, CREAM, WOOD, WOOD_D,
  DANGER, SHADE_DIR, FONT, f, uid, hashStr, rngFor, mix, lighten,
  darken, esc, ow, svgWrap, stroke, op, circle, ellipse,
  path, rect, g, line, tube, shape, gloss, rrect, crescent,
  ball, leaf, bigLeaf, polyPath, starPoints, sparkle, puffs, frond, withInk, litCircle, paint,
} from './svg.js';

export {
  ingredientIcon, packIcon, bowlSVG, cupSVG, binSVG, scoopSVG, cupStackSVG, cupSpotSVG,
} from './art-food.js';
export {
  blenderSVG, smoothieMachineSVG, SMOOTHIE_SLOT_X, SMOOTHIE_SLOT_Y, SMOOTHIE_CUP_SIZE, trashSVG, shopSceneSVG, decorSVG,
} from './art-kitchen.js';
export { artDefsSVG, ART_DEFS_ID } from './svg.js';

registerStrings({
  de: { 'art.menu': 'Menü', 'art.neon': 'Açaí', 'art.logoTop': 'Açaí', 'art.logoBottom': 'Fever' },
  en: { 'art.menu': 'Menu', 'art.neon': 'Açaí', 'art.logoTop': 'Açaí', 'art.logoBottom': 'Fever' },
});


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
  let s = shape(d, L.shirt, sw, pat + path('M146 162C146 126 124 108 96 108C120 118 130 138 128 162Z', darken(L.shirt, 0.2), op(0.8)) + path(d, paint('sph-soft')) + line('M30 138C34 125 44 117 58 113', WHITE, 4, op(0.3)));
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

// Guests fit the café's realistic look: a thin warm outline instead of the thick ink line,
// soft light on face and clothes.
const GUEST_LINE = '#4a2f3e';

export function customerSVG(look, mood = 'neutral', size = 160) {
  return withInk(GUEST_LINE, () => drawCustomer(look, mood, size));
}

function drawCustomer(look, mood, size) {
  const L = normLook(look);
  const sw = ow(160, size, 1.5, 3.6) * 0.62;
  const angry = mood === 'angry';
  const skinFace = angry ? mix(L.skin, '#ff5a5a', 0.35) : L.skin;
  const skinNeck = darken(L.skin, 0.12);
  let s = hairBack(L, sw);
  s += rect(69, 86, 22, 28, 8, skinNeck, stroke(sw));
  s += torso(L, sw, skinNeck);
  s += hairSide(L, sw);
  for (const x of [46, 114]) s += circle(x, 71, 7.5, skinFace, stroke(sw)) + circle(x + (x < 80 ? 1 : -1), 72, 3.4, darken(skinFace, 0.15));
  s += circle(HX, HY, HR, skinFace) + crescent(HX, HY, HR, 0.35, 7, darken(skinFace, 0.1)) + litCircle(HX, HY, HR, 'sph-soft') + circle(HX, HY, HR, 'none', stroke(sw));
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
