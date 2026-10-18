// Guests of the café (viewBox 160×160): head, neck, shoulders and upper torso of a person in the
// realistic look of the café art – skin with soft volume and light from the top left, hair with a
// gradient, strands and a shine band, clothes with collars, seams, buttons and folds. In the game the
// pass hides everything below y≈131; the menus show the whole bust, small pictures crop to head and
// shoulders. Pure module: a picture depends only on (look, mood, size), uses only the shared defs
// (js/svg.js) and is memoised.

import { createRng } from './rng.js';
import {
  WHITE, INK, PINK, MANGO, LEAF, f, hashStr, memoTable, rgb, mix, lighten, darken, ow, svgWrap, stroke, op,
  circle, ellipse, path, rect, g, line, gloss, puffs, paint, withInk, registerDefs,
} from './svg.js';

// ======================================================================
// Looks
// ======================================================================
const SKINS = ['#ffe3cc', '#f8cfa8', '#eab38a', '#d39668', '#b27449', '#8d5634', '#64391f', '#f2c2a0'];
const HAIR_NATURAL = ['#2b1a12', '#4a2b18', '#6e4123', '#a8652f', '#d9a24a', '#f0cf7a', '#b5432f', '#d8d3cd', '#1c1418'];
const HAIR_FUN = ['#8a4fd6', '#ff5fa2', '#2a9fd8', '#2fbf71'];
const HAIR_STYLES = ['short', 'spiky', 'curly', 'afro', 'long', 'bob', 'bun', 'ponytail', 'braids', 'bald'];
const SHIRTS = ['#ff3d8b', '#18c2c9', '#ffb627', '#2fbf71', '#7b3a96', '#ff7a59', '#4656c9', '#fff4df', '#f7e14f', '#ff9ec7', '#3fb6ff'];
const PATTERNS = ['plain', 'plain', 'stripes', 'dots', 'hawaii', 'collar'];
const ACCESSORIES = ['none', 'none', 'glasses', 'sunglasses', 'cap', 'earrings', 'headband', 'beard'];
const ACCENTS = ['#ff3d8b', '#18c2c9', '#ffb627', '#2fbf71', '#7b3a96', '#ff4d4d', '#ffffff', '#4656c9'];
// garment: t-shirt, button-up shirt, polo, hoodie, open cardigan over a tee (in shirt2)
const TOPS = ['tee', 'tee', 'shirt', 'polo', 'hoodie', 'cardigan'];
const IRISES = ['#5b3a21', '#3b2414', '#7a5530', '#3f6f9e', '#4e7d52', '#6d6a5e', '#2b1c13'];
const MOODS = ['happy', 'neutral', 'impatient', 'angry'];

export const LOOK_OPTIONS = { skins: SKINS, hairStyles: HAIR_STYLES, accessories: ACCESSORIES, patterns: PATTERNS, tops: [...new Set(TOPS)] };

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
  const skin = pick(SKINS);
  const pattern = pick(PATTERNS);
  // picked last, so every seeded guest keeps the skin, hair and colours it had before these existed
  const top = pick(TOPS);
  const iris = pick(IRISES);
  return { skin, hair, hairStyle, shirt, shirt2, pattern, accessory, accent, top, iris };
}

export function lookFromSeed(seed) {
  const n = typeof seed === 'number' ? seed : hashStr(String(seed));
  return randomLook(createRng((n >>> 0) * 2654435761 + 7));
}

const isHex = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

// Any look object (also one saved before a field existed) → a complete look; missing or unknown
// values come from a look derived from the object itself.
function normLook(look) {
  if (look === null || look === undefined || typeof look !== 'object') return lookFromSeed(look ?? 1);
  const d = lookFromSeed(hashStr(JSON.stringify(look)));
  const L = { ...d, ...look };
  if (!TOPS.includes(L.top)) L.top = d.top;
  if (!HAIR_STYLES.includes(L.hairStyle)) L.hairStyle = d.hairStyle;
  for (const k of ['skin', 'hair', 'shirt', 'shirt2', 'accent', 'iris']) if (!isHex(L[k])) L[k] = d[k];
  return L;
}

// ======================================================================
// Body geometry (viewBox 160×160). The head is drawn 46 wide (x 57–103, crown y 36, chin y 93) and
// scaled by HEAD_K about the chin, so it ends up ≈51 wide with the crown at y≈30: the shoulders are
// about 2.2 heads wide. The pass covers y > 131 in the game.
// ======================================================================
const HEAD_K = 1.1;
const headGroup = (body) => (body ? g(`translate(80 93) scale(${HEAD_K}) translate(-80 -93)`, body) : '');
const HEAD = 'M80 36C94.6 36 103 46.6 103 60C103 69.5 101.7 77.3 98 83C94 89.3 87.4 93 80 93C72.6 93 66 89.3 62 83C58.3 77.3 57 69.5 57 60C57 46.6 65.4 36 80 36Z';
const TORSO = 'M70 95C64 97.6 54 100.4 44 103C35 105.4 27 110 23.6 118.4C21.6 123.4 20.6 128 20 133L18 160H142L140 133C139.4 128 138.4 123.4 136.4 118.4C133 110 125 105.4 116 103C106 100.4 96 97.6 90 95Z';
// the upper arms (outside the creases) turn away from the light
const ARM_L = 'M20 133C20.6 128 21.6 123.4 23.6 118.4C27 110 35 105.4 41 104C42.6 110 42.6 117 41.4 123C38.6 134 37.4 147 37 160H18Z';
const ARM_R = 'M140 133C139.4 128 138.4 123.4 136.4 118.4C133 110 125 105.4 119 104C117.4 110 117.4 117 118.6 123C121.4 134 122.6 147 123 160H142Z';
const CREASES = 'M41.4 123C38.6 134 37.4 147 37 160M118.6 123C121.4 134 122.6 147 123 160';
const FOLDS = 'M43 128C48 133 54 135 60 135M117 128C112 133 106 135 100 135M47 113C52 118 56 121 60 122M113 113C108 118 104 121 100 122';
const NECK_TOP = 78;
const EARS_HIDDEN = ['long', 'bob', 'afro']; // these hair styles cover the ears
const EYE = { l: 70.4, r: 89.6, y: 66.2 };
// small pictures (menu chips, pre-level seats): head and shoulders only, so the face stays readable
const CROP = [30, 12, 100, 100];

function eyePath(cx, side) {
  const y = EYE.y;
  const o = cx + side * 5.9; // outer corner
  const i = cx - side * 5.4; // inner corner, a little lower
  return `M${f(o)} ${f(y + 0.3)}C${f(cx + side * 4)} ${f(y - 3.9)} ${f(cx - side * 3.1)} ${f(y - 4.1)} ${f(i)} ${f(y + 0.5)}C${f(cx - side * 3.3)} ${f(y + 3.1)} ${f(cx + side * 3.5)} ${f(y + 3.3)} ${f(o)} ${f(y + 0.3)}Z`;
}

const MOUTH_OPEN = 'M71.4 82.2C75.8 83.8 84.2 83.8 88.6 82.2C87.8 87.8 84.6 90.8 80 90.8C75.4 90.8 72.2 87.8 71.4 82.2Z';
const MOUTH_GRIT = 'M71.8 82.8C75.6 81.6 84.4 81.6 88.2 82.8C89 84.8 88.8 87.2 87.8 88.8C83.6 87.8 76.4 87.8 72.2 88.8C71.2 87.2 71 84.8 71.8 82.8Z';

// The afro's opening for the face: down the cheeks to the chin, up under a scalloped hairline.
let AFRO_LINE = '';
for (let i = 0; i <= 14; i++) {
  const a = Math.PI * (0.03 + (0.94 * i) / 14);
  AFRO_LINE += `${i ? 'A2.6 2.6 0 0 1 ' : 'M'}${f(80 + Math.cos(a) * 23.4)} ${f(63 - Math.sin(a) * 15.6)}`;
}
const AFRO_OPEN = `M56.4 64.2C57 73 58.4 79 62 83C66 89.3 72.6 93 80 93C87.4 93 94 89.3 98 83C101.6 79 103 73 103.6 64.2${AFRO_LINE.replace('M', 'L')}Z`;

// Fixed geometry, so one clip path in the page serves every guest (user space = the guest's viewBox).
registerDefs(`<clipPath id="af-clip-guest-head"><path d="${HEAD}"/></clipPath>` +
  `<clipPath id="af-clip-guest-torso"><path d="${TORSO}"/></clipPath>` +
  `<clipPath id="af-clip-guest-eyes"><path d="${eyePath(EYE.l, -1)}${eyePath(EYE.r, 1)}"/></clipPath>` +
  `<clipPath id="af-clip-guest-smile"><path d="${MOUTH_OPEN}"/></clipPath>` +
  `<clipPath id="af-clip-guest-grit"><path d="${MOUTH_GRIT}"/></clipPath>` +
  `<clipPath id="af-clip-guest-noface"><path clip-rule="evenodd" d="M0 0H160V160H0Z${AFRO_OPEN}"/></clipPath>`);
const clip = (id, body) => `<g clip-path="url(#af-clip-guest-${id})">${body}</g>`;

const DEEP = '#1b0d16';
const lineOf = (c, k = 0.48) => mix(c, DEEP, k);

const lum = (c) => {
  const n = parseInt(c.slice(1), 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
};

// A hair colour with its shades: the strands, the outline and the shine. Light hair (blonde, grey) gets a deeper
// outline of its own hue, so it still stands off the light plaster behind it.
const LIGHT_HAIR = ['#f0cf7a', '#d9a24a', '#d8d3cd'];
const hairTones = (c) => ({
  hair: c,
  hairDark: mix(c, '#160a06', 0.32),
  hairLine: LIGHT_HAIR.includes(c) ? shadeOf(c, 0.62) : mix(c, '#160a06', 0.55),
  hairHi: lighten(c, 0.42),
});

// The same colour in shadow: its HSL lightness lowered by k, its hue (and nearly its saturation) kept, so golden
// or grey hair stays golden or grey in the shade instead of turning olive the way a mix with dark brown does.
function shadeOf(c, k) {
  const [r, g, b] = rgb(c).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const sat = d ? (d / (1 - Math.abs(2 * l - 1))) * 0.92 : 0;
  const L2 = l * (1 - k);
  const C = (1 - Math.abs(2 * L2 - 1)) * sat;
  const X = C * (1 - Math.abs((h % 2) - 1));
  const m = L2 - C / 2;
  const [r1, g1, b1] = [[C, X, 0], [X, C, 0], [0, C, X], [0, X, C], [X, 0, C], [C, 0, X]][Math.floor(h) % 6];
  return `#${[r1, g1, b1].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('')}`;
}

function palette(L, mood) {
  const angry = mood === 'angry';
  const skin = angry ? mix(L.skin, '#e2483c', 0.24) : L.skin;
  const fun = HAIR_FUN.includes(L.hair);
  const light = LIGHT_HAIR.includes(L.hair);
  // dyed hair keeps natural brows, fair hair gets brows a little darker than the hair; on dark skin they darken
  // further so they still read
  let brow = fun ? '#4a3020' : mix(L.hair, '#160a06', light ? 0.45 : 0.3);
  if (lum(brow) > lum(L.skin) * 0.62) brow = mix(brow, '#140a06', 0.62);
  return {
    skin,
    skinLine: mix(L.skin, '#3a140a', 0.5),
    skinShade: mix(skin, '#6e2a18', 0.24),
    neck: mix(L.skin, '#7a3220', angry ? 0.16 : 0.1),
    lip: mix(L.skin, '#b8394c', 0.42),
    lipDark: mix(L.skin, '#5a1220', 0.62),
    ...hairTones(L.hair),
    // beard and stubble stay natural under dyed hair (like the brows)
    facial: fun ? hairTones('#4a2b18') : hairTones(L.hair),
    brow,
    lid: mix(L.skin, '#2a0e08', 0.72),
    cloth: L.shirt,
    clothLine: lineOf(L.shirt),
    clothShade: mix(L.shirt, DEEP, 0.2),
  };
}

// ======================================================================
// Hair (back: behind head and shoulders; front: over the head; side: in front of the shoulders)
// ======================================================================
// Hairline height in the middle of the forehead (for the soft shadow the hair casts on it).
const HAIRLINE = { short: 49, spiky: 50, curly: 51, afro: 50, long: 46.5, bob: 55, bun: 48.5, ponytail: 48.5, braids: 48 };

// Curly hair as lumps [x, y, r] of different sizes: in front a mass over the crown and the temples with
// small, uneven curls along the hairline; behind the head a darker mass down to the jaw.
const CURLY_FRONT = [
  [80, 41, 14], [67, 43, 10.4], [93, 42.4, 11], [74, 33.6, 8], [87, 33, 8.6], [80, 30.6, 6], [60.4, 48.6, 7.4], [100.2, 48.2, 7.8],
  [57.4, 56.6, 5.4], [102.8, 56.4, 5.8], [58.2, 61.8, 4.2], [102.2, 62.2, 4.4],
  [64, 50, 4.4], [70.2, 48.6, 4.8], [76.6, 49.8, 4.2], [82.8, 48.4, 4.8], [89, 49.8, 4.4], [94.8, 48.8, 4.6], [98.8, 52.8, 3.6], [60.8, 54.4, 3.4],
];
const CURLY_BACK = [
  [80, 44, 19], [63, 46, 13.4], [97.6, 45.6, 13], [56.4, 58.6, 10.6], [104, 59, 10], [57.6, 71.6, 8.6], [102.6, 72.4, 9],
  [60.6, 80.4, 6], [99.8, 81, 6.4], [70, 36.6, 11], [90.6, 37, 10.4],
];

function hairShape(d, P, sw, inner = '') {
  return path(d, P.hair) + inner + path(d, paint('sph-soft')) + path(d, 'none', stroke(sw, P.hairLine));
}

// Strand lines: darker ones in the flow, a few light ones on the lit side.
const strands = (dark, light, P) => line(dark, P.hairDark, 0.9, op(0.75)) + (light ? line(light, P.hairHi, 0.8, op(0.55)) : '');
// The shine band across the lit top of the head, broken like real highlights.
const shine = (d, P, w = 2.6) => line(d, P.hairHi, w, op(0.55) + ' stroke-dasharray="7 2.5 3 3"');

const discs = (list) => list.map(([x, y, r]) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(r * 2)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-r * 2)} 0`).join('');

// Curly hair: one bumpy mass (overlapping lumps of different sizes) in the light from the top left, the
// curls drawn on it as open C and S strokes – dark ones all over, a few light ones on the lit side.
function curlMass(list, P, sw, key, n, hiK = 1) {
  const mass = discs(list);
  let s = withInk(P.hairLine, () => puffs(list, P.hair, sw * 0.9)) + path(mass, paint('sph-soft'));
  const rng = createRng(hashStr(key));
  const total = list.reduce((a, [, , r]) => a + r * r, 0);
  let dark = '';
  let light = '';
  for (let i = 0; i < n; i++) {
    // a spot in a lump (bigger lumps get more), a curl of its own size and turn
    let pick = rng.next() * total;
    const [cx, cy, cr] = list.find(([, , r]) => (pick -= r * r) <= 0) || list[0];
    const a = rng.next() * Math.PI * 2;
    const d = Math.sqrt(rng.next()) * cr * 0.8;
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    const r = 1.1 + rng.next() * 1.4;
    const t = rng.next() * Math.PI * 2;
    const at = (k) => `${f(x + Math.cos(t + k) * r)} ${f(y + Math.sin(t + k) * r)}`;
    const c = rng.next() < 0.6
      ? `M${at(0)}A${f(r)} ${f(r)} 0 1 1 ${at(3.7)}` // C: most of a turn, open
      : `M${at(Math.PI)}A${f(r * 0.5)} ${f(r * 0.5)} 0 0 1 ${f(x)} ${f(y)}A${f(r * 0.5)} ${f(r * 0.5)} 0 0 0 ${at(0)}`; // S
    if (x - 80 + (y - 50) * 1.4 < -6 && rng.next() < 0.7) light += c;
    else dark += c;
  }
  return s + line(dark, P.hairLine, 0.75, op(0.5)) + line(light, P.hairHi, 0.7, op(0.32 * hiK));
}

function hairBack(L, P, sw) {
  switch (L.hairStyle) {
    case 'long':
      return path('M57.5 50C52 74 54 104 46 134C58 142 102 142 114 134C106 104 108 74 102.5 50Z', P.hairDark, stroke(sw, P.hairLine)) +
        line('M60 70C59 94 57 116 52 132M100 70C101 94 103 116 108 132', P.hairLine, 0.8, op(0.5));
    case 'bob':
      return path('M55.6 54C51.6 72 53 88 57.6 97.6C66 101.6 94 101.6 102.4 97.6C107 88 108.4 72 104.4 54Z', P.hairDark, stroke(sw, P.hairLine));
    case 'ponytail': {
      const d = 'M99 42C112 43 119.6 57 117.6 77C116.2 92 113 104 106.4 113.4C107.6 99 108.4 85 107.4 73C106.6 63 104 55 98.6 50.6Z';
      return hairShape(d, P, sw, line('M104 47C111 54 114 66 113 80C112.4 92 110 102 107.6 109M101.6 49C107 56 110 66 110 78', P.hairDark, 0.9, op(0.7)) +
        line('M106 48C112 55 115 66 115 76', P.hairHi, 1.4, op(0.5))) +
        path('M97.4 41.6C99.6 39.8 103.6 40.6 104.6 43.4C105.2 45.6 103.4 47.8 100.8 47.6C98 47.4 96.2 43.4 97.4 41.6Z', L.accent === INK ? PINK : L.accent, stroke(sw * 0.8, lineOf(L.accent === INK ? PINK : L.accent)));
    }
    case 'bun': {
      let s = circle(80, 30.5, 10.6, P.hair, stroke(sw, P.hairLine));
      s += line('M72 27C76 23 84 22.6 88.4 26.6M71.4 32C76 28 84.6 28.4 89 32.6M74 37C77 34 84 34 87 37', P.hairDark, 0.9, op(0.75));
      s += circle(80, 30.5, 10.6, paint('sph'));
      return s;
    }
    case 'bald': {
      // the horseshoe fringe round the back of the head, from temple to temple: it shows past the head's outline
      // above and behind the ears (the head and the neck hide the rest); short hair, in the head's shadow
      const T = P.facial;
      const d = 'M58.6 46.2C55 51 53.4 58 53.6 66C53.8 74 55.6 81 60.4 86.6H99.6C104.4 81 106.2 74 106.4 66C106.6 58 105 51 101.4 46.2C96 51.4 64 51.4 58.6 46.2Z';
      let tex = '';
      for (const side of [-1, 1]) {
        for (let y = 49; y < 85; y += 2.6) {
          const x = 80 + side * (26.2 - Math.abs(y - 66) * 0.07 - ((y - 66) / 18) ** 2 * 2.6);
          tex += `M${f(x)} ${f(y)}l${f(-side * 1.6)} 2.2`;
        }
      }
      return path(d, shadeOf(T.hair, 0.12), stroke(sw, T.hairLine)) + path(d, paint('sph-soft')) + line(tex, T.hairLine, 0.6, op(0.55));
    }
    case 'curly':
      // the curls behind the head, down to the jaw: the same hair in shadow (one darker shade of its hue), the
      // same outline as the front
      return curlMass(CURLY_BACK, { ...P, hair: shadeOf(L.hair, 0.24) }, sw, `curly-back${L.hair}`, 36, 0.5);
    default:
      return '';
  }
}

// A plait: strands crossing over from left and right, each a slanted lobe with its own light.
function braid(x0, y0, x1, y1, P, accent, sw) {
  const tie = accent === INK ? PINK : accent;
  const n = 13;
  let s = '';
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const x = x0 + (x1 - x0) * k;
    const y = y0 + (y1 - y0) * k;
    const w = 5.4 - k * 1.5;
    const side = i % 2 ? 1 : -1;
    const lobe = `M${f(x - side * w)} ${f(y - 2.6)}C${f(x - side * w * 0.2)} ${f(y - 3.4)} ${f(x + side * w * 1.1)} ${f(y + 0.6)} ${f(x + side * w * 0.5)} ${f(y + 3.6)}C${f(x)} ${f(y + 3.4)} ${f(x - side * w * 1.1)} ${f(y + 0.4)} ${f(x - side * w)} ${f(y - 2.6)}Z`;
    s += path(lobe, side > 0 ? P.hairDark : P.hair, stroke(sw * 0.75, P.hairLine));
    s += line(`M${f(x - side * w * 0.5)} ${f(y - 1.6)}Q${f(x + side * w * 0.2)} ${f(y - 1)} ${f(x + side * w * 0.5)} ${f(y + 1.2)}`, P.hairHi, 0.7, op(side > 0 ? 0.3 : 0.55));
  }
  s += rect(x1 - 3, y1 + 2.6, 6, 3.2, 1.4, tie, stroke(sw * 0.7, lineOf(tie)));
  s += path(`M${f(x1 - 2.8)} ${f(y1 + 5.6)}C${f(x1 - 3.6)} ${f(y1 + 10)} ${f(x1 - 1)} ${f(y1 + 13)} ${f(x1)} ${f(y1 + 14)}C${f(x1 + 1)} ${f(y1 + 13)} ${f(x1 + 3.6)} ${f(y1 + 10)} ${f(x1 + 2.8)} ${f(y1 + 5.6)}Z`, P.hair, stroke(sw * 0.7, P.hairLine)) +
    line(`M${f(x1 - 1)} ${f(y1 + 7)}L${f(x1 - 0.4)} ${f(y1 + 12)}M${f(x1 + 1.2)} ${f(y1 + 7)}L${f(x1 + 0.6)} ${f(y1 + 11.6)}`, P.hairDark, 0.6, op(0.7));
  return s;
}

// Hair that falls in front of the shoulders, from behind the face (braids).
function hairSide(L, P, sw) {
  if (L.hairStyle === 'braids') return braid(59, 74, 54.5, 126, P, L.accent, sw) + braid(101, 74, 105.5, 126, P, L.accent, sw);
  return '';
}

function hairFront(L, P, sw) {
  switch (L.hairStyle) {
    case 'short':
      return hairShape('M56.2 66C54.4 47 62 31.5 80 31.5C98 31.5 105.6 47 103.8 66L101.6 66C101 60 100 55.5 97.6 52.4C92 49 85 50.6 78.5 48.6C74 47.2 70.6 47.4 68 49.8C64 49.2 60.8 53 59.6 58L58.4 66Z', P, sw,
        path('M103.8 66C105.6 47 98 31.5 84 31.8C96 36 101 46 101 56C101.4 59 101.6 62 101.6 66Z', P.hairDark, op(0.6)) +
        strands('M69 34C78 36 90 40 97.6 50.6M70.4 37.6C80 40.4 88 44.6 93.4 50.6M68.4 41C74.4 43.4 80 46.4 85.6 49M67 34.6C62 38 59 45 58.2 53', 'M71 35C79 36.4 86 38.4 92 42', P) +
        line('M69 33C68.4 38 68.2 43 68 48.6', P.hairLine, 1.1, op(0.8)) + shine('M59.6 47C63 39.4 70.6 35 79.6 34.4', P));
    case 'spiky':
      return hairShape('M56.2 66C55 52 56.6 43 60 37.5L58.6 29L65.6 33L67.6 24.6L74.4 30.6L79.6 22.6L84.6 30L90.6 24L93.4 31.6L100.6 28L100 36.6C104.4 43 105.6 53 103.8 66L101.6 66C101 60 100 55.5 97.6 52.4C92 50.4 86 51.4 80 50C74 48.8 68 49.6 63.6 51.6C60.8 54 59.6 58 58.4 66Z', P, sw,
        path('M103.8 66C105.6 53 104.4 43 100 36.6L100.6 28L93.4 31.6C99 38 101.4 47 101.4 56C101.6 60 101.6 63 101.6 66Z', P.hairDark, op(0.6)) +
        strands('M64 46L60 32M70 44L68 27M77 43L79.6 25M84 44L90 27M90 46L99 31M60 50L58 42', 'M66 44L63.6 33M73 42L73.4 30', P) + shine('M60.4 47.4C63.6 41 70 37.4 78 36.6', P, 2.2));
    case 'curly':
      return curlMass(CURLY_FRONT, P, sw, `curly${L.hair}`, 60);
    case 'afro': {
      // one round, soft mass around the head, the face left open under a scalloped hairline (shared
      // clip); tight coils as fine arcs, the light on its top left
      const list = [[80, 55, 30]];
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        list.push([80 + Math.cos(a) * 33.5, 55 + Math.sin(a) * 25.5, 7.6]);
      }
      let s = withInk(P.hairLine, () => puffs(list, P.hair, sw)) + ellipse(80, 55, 34, 26, paint('sph-soft'));
      const rng = createRng(hashStr(`afro${L.hair}`));
      let dark = '';
      let light = '';
      for (let i = 0; i < 80; i++) {
        const a = rng.next() * Math.PI * 2;
        const r = Math.sqrt(rng.next()) * 0.95;
        const x = 80 + Math.cos(a) * 38 * r;
        const y = 55 + Math.sin(a) * 30 * r;
        const arc = `M${f(x)} ${f(y)}a2 2 0 0 1 ${f(2.6 + rng.next() * 1.4)} ${f(rng.next() * 1.4 - 0.7)}`;
        if (x + y < 120 && rng.next() < 0.65) light += arc;
        else dark += arc;
      }
      s += line(dark, P.hairLine, 0.8, op(0.45)) + line(light, P.hairHi, 0.8, op(0.45));
      return clip('noface', s) + line(AFRO_LINE, P.hairLine, 0.8, op(0.75));
    }
    case 'long': {
      // centre parting; the curtains frame the face, cover the ears and fall in front of the shoulders
      const d = 'M80 33.5C64 33.5 54.6 44 54.6 62C54.6 80 53.6 104 48.5 128C53 131.5 59.5 132 63.5 128.5C62 108 61.5 86 62 72C62.4 60 66 51 72 47.6C75 46.2 78 46 80 46C82 46 85 46.2 88 47.6C94 51 97.6 60 98 72C98.5 86 98 108 96.5 128.5C100.5 132 107 131.5 111.5 128C106.4 104 105.4 80 105.4 62C105.4 44 96 33.5 80 33.5Z';
      return hairShape(d, P, sw,
        path('M98 72C98.5 86 98 108 96.5 128.5C100.5 132 107 131.5 111.5 128C106.4 104 105.4 80 105.4 62C105.4 50 100 40 92 36C99 46 97.6 60 98 72Z', P.hairDark, op(0.55)) +
        strands('M78 36C68 39 61 48 59 62C58.2 86 57.6 108 53 126M79 46.6C70 48 64.6 56 64.2 70M82 36C92 39 99 48 101 62C101.8 86 102.4 108 107 126M81 46.6C90 48 95.4 56 95.8 70', 'M72 36.6C63 41 58 50 57.4 64C57 84 56.4 102 52 122', P) +
        shine('M59.6 52C62.6 42 69.6 37 77.6 35.6M83.6 35.8C91.6 37.4 96.6 41.4 99.4 47.4', P)) +
        line('M80 34V46', P.hairLine, 1, op(0.8));
    }
    case 'bob':
      return hairShape('M80 32C63 32 54 43 54.4 60C54.8 76 55 88 59.2 96.8C62.6 99 66.4 98.4 68 95.6C64 90 62 80 61.6 70C61.4 62 61.6 57.6 62.4 54.2C70 55.6 90 55.6 97.6 54.2C98.4 57.6 98.6 62 98.4 70C98 80 96 90 92 95.6C93.6 98.4 97.4 99 100.8 96.8C105 88 105.2 76 105.6 60C106 43 97 32 80 32Z', P, sw,
        path('M98.4 70C98 80 96 90 92 95.6C93.6 98.4 97.4 99 100.8 96.8C105 88 105.2 76 105.6 60C106 46 100 37 91 33.6C99 41 99 52 97.6 54.2C98.4 57.6 98.6 62 98.4 70Z', P.hairDark, op(0.55)) +
        strands('M66 54.6L67 44M72 55.2L73 42M78 55.4L78.6 40M84 55.4L84 41M90 55.2L89 43M95.6 54.8L94 45M58 62C57.6 76 58.6 88 62 96M102 62C102.4 76 101.4 88 98 96', 'M60 58C59.6 72 60 84 63 93', P) +
        shine('M59 49C63 40.4 70 36 79 35', P));
    case 'bun':
    case 'ponytail':
      return hairShape('M56.6 64C55 47 63 34.5 80 34.5C97 34.5 105 47 103.4 64L101.4 64C100.6 57 98.6 52.6 95 50.4C90 48.6 85 49.6 80 48C75 49.6 70 48.6 65 50.4C61.4 52.6 59.4 57 58.6 64Z', P, sw,
        path('M103.4 64C105 47 97 34.5 84 34.8C95 38.6 99.6 46 100 53C100.8 56.6 101.2 60 101.4 64Z', P.hairDark, op(0.55)) +
        strands('M64 50C66 43 72 38 80 36M72 48.6C74 43 77 39 80 36.4M88 48.6C86 43 83 39 80 36.4M96 50C94 43 88 38 80 36', 'M60 56C61 47 66 41 73 38', P) +
        shine('M59.6 49C62.6 42 68.6 37.6 76 36.4', P, 2.2)) +
        (L.hairStyle === 'bun' ? ellipse(80, 35.6, 7, 1.9, L.accent === INK ? PINK : L.accent, stroke(sw * 0.7, lineOf(L.accent === INK ? PINK : L.accent))) : '');
    case 'braids':
      return hairShape('M56.6 66C55 47 63 33.5 80 33.5C97 33.5 105 47 103.4 66L101.4 66C100.6 58 98.4 52.4 93 50C88.4 48.6 84 48.4 80 47.4C76 48.4 71.6 48.6 67 50C61.6 52.4 59.4 58 58.6 66Z', P, sw,
        path('M103.4 66C105 47 97 33.5 84 33.8C95 38 100 47 100.6 55C101 59 101.2 62 101.4 66Z', P.hairDark, op(0.55)) +
        strands('M79 36C72 37 64 42 61 52M77 41C71 43 65.6 47 63 54M81 36C88 37 96 42 99 52M83 41C89 43 94.4 47 97 54', 'M75 37C68 39.6 63 44 60.6 50', P) +
        line('M80 34V47', lighten(P.hair, 0.15), 1, op(0.6)) + line('M80.6 34.4V47.2', P.hairLine, 0.7, op(0.6)) +
        shine('M59.6 50C62.6 42 68 37.6 75 36.4', P, 2.2));
    case 'bald': {
      // the fringe's front ends: short hair over the temples, combed back, ending at the top of the ears (it runs on
      // round the back of the head in hairBack); the dome bare and shiny
      const T = { ...P, ...P.facial };
      let s = '';
      for (const side of [-1, 1]) {
        const X = (x) => f(80 + side * (80 - x)); // mirrored for the right side
        const edge = `M${X(61.2)} 47.8C${X(59.4)} 48.6 ${X(57)} 51 ${X(55.8)} 54.4C${X(55)} 56.6 ${X(55)} 58.8 ${X(56)} 61`; // on the head's outline
        const d = `${edge}C${X(57)} 60.2 ${X(58)} 59.6 ${X(59.2)} 59.6C${X(59.8)} 57.6 ${X(60.8)} 55.8 ${X(62)} 54.4C${X(62.6)} 52 ${X(62.4)} 49.6 ${X(61.2)} 47.8Z`;
        const tex = `M${X(61.2)} 49.4L${X(57.4)} 54.2M${X(61.6)} 52L${X(57)} 58M${X(61.4)} 54.8L${X(58.2)} 59.2M${X(59.6)} 49.4L${X(56.4)} 54.8`;
        s += path(d, T.hair) + path(d, paint('sph-soft'));
        if (side > 0) s += path(d, T.hairDark, op(0.4)); // the side away from the light
        // short hair fades into the skin on the inside: strands, no outline there
        s += line(tex, T.hairDark, 0.6, op(0.8)) + line(`M${X(60.4)} 48.8L${X(57.6)} 52.4`, T.hairHi, 0.6, op(0.5));
        s += line(edge, T.hairLine, sw * 0.8);
      }
      return s + gloss(68.6, 45, 9.4, 4.2, -28, 0.42) + gloss(66, 43.6, 3.6, 1.6, -28, 0.6);
    }
    default:
      return '';
  }
}

// ======================================================================
// Clothes
// ======================================================================
function pattern(L) {
  const c = L.shirt2;
  let s = '';
  if (L.pattern === 'stripes') {
    if (L.top === 'shirt') {
      for (let x = 21; x < 142; x += 7) s += `M${x} 92V160`;
      return line(s, c, 1.6, op(0.85));
    }
    for (let y = 103; y < 162; y += 10) s += `M14 ${y}Q80 ${y + 5} 146 ${y}`;
    return line(s, c, 4.2, op(0.9));
  }
  if (L.pattern === 'dots') {
    for (let y = 104, r = 0; y < 162; y += 10, r++) for (let x = 16 + (r % 2) * 6; x < 146; x += 12) s += `M${x - 2.1} ${y}a2.1 2.1 0 1 0 4.2 0a2.1 2.1 0 1 0 -4.2 0`;
    return path(s, c);
  }
  if (L.pattern === 'hawaii') {
    // hibiscus flowers with a pair of leaves each (one path per colour keeps the picture light)
    let leafA = '';
    let leafB = '';
    let petals = '';
    let hearts = '';
    for (const [x, y, k] of [[32, 122, 1], [52, 108, 0.9], [108, 109, 0.9], [128, 124, 1], [80, 140, 1.1], [44, 148, 1], [116, 150, 1], [64, 128, 0.8], [97, 130, 0.8]]) {
      const p = (dx, dy) => `${f(x + dx * k)} ${f(y + dy * k)}`;
      leafA += `M${p(0, 0)}C${p(6, -6)} ${p(13, -4)} ${p(15, 1)}C${p(10, 0)} ${p(5, 1)} ${p(0, 0)}Z`;
      leafB += `M${p(0, 0)}C${p(-5, 5)} ${p(-12, 5)} ${p(-14, 1)}C${p(-9, 1.6)} ${p(-4, 1)} ${p(0, 0)}Z`;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const r = 2.8 * k;
        petals += `M${f(x + Math.cos(a) * 3.2 * k - r)} ${f(y + Math.sin(a) * 3.2 * k)}a${f(r)} ${f(r)} 0 1 0 ${f(r * 2)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-r * 2)} 0`;
      }
      hearts += `M${f(x - 1.6 * k)} ${f(y)}a${f(1.6 * k)} ${f(1.6 * k)} 0 1 0 ${f(3.2 * k)} 0a${f(1.6 * k)} ${f(1.6 * k)} 0 1 0 ${f(-3.2 * k)} 0`;
    }
    s += path(leafA, LEAF, op(0.95)) + path(leafB, darken(LEAF, 0.15), op(0.95)) + path(petals, c) + path(hearts, MANGO);
  }
  return s;
}

// Skin shown at the neckline: the neck, plus a V on open collars.
function neckPath(top) {
  if (top === 'shirt') return `M69.6 ${NECK_TOP}V96C72.4 102 76.8 108.6 80 113.4C83.2 108.6 87.6 102 90.4 96V${NECK_TOP}Z`;
  if (top === 'polo') return `M69.6 ${NECK_TOP}V97C72.4 100.6 76.8 104 80 106C83.2 104 87.6 100.6 90.4 97V${NECK_TOP}Z`;
  return `M69.6 ${NECK_TOP}V97.5C73.4 102.4 86.6 102.4 90.4 97.5V${NECK_TOP}Z`;
}

function neck(L, P, sw) {
  const d = neckPath(L.top);
  let s = path(d, P.neck);
  s += path(`M85.2 ${NECK_TOP}V99.8C87.2 99 89.2 97.8 90.4 96V${NECK_TOP}Z`, P.skinShade, op(0.55)); // the side away from the light
  s += ellipse(80, 88.6, 16, 7.4, paint('shadow')); // the jaw's shadow (the head covers its top half)
  s += line(`M69.6 ${NECK_TOP}V96M90.4 ${NECK_TOP}V96`, P.skinLine, sw * 0.9);
  if (L.top === 'shirt') s += line('M76 100.4C78 101.6 82 101.6 84 100.4', P.skinShade, 0.8, op(0.5)); // collarbones
  return s;
}

const button = (x, y, c, sw) => circle(x, y, 1.35, lighten(c, 0.55), stroke(sw * 0.6, lineOf(c, 0.4))) + circle(x - 0.4, y - 0.4, 0.45, WHITE, op(0.8));

// The white shirt collar of the 'collar' pattern peeking out of a crew neck.
function peekCollar(sw) {
  const c = '#f8f6f2';
  return path('M71.2 97.4L66.4 104.6L76.4 103.2Z', c, stroke(sw * 0.8, '#8f8a93')) + path('M88.8 97.4L93.6 104.6L83.6 103.2Z', c, stroke(sw * 0.8, '#8f8a93'));
}

function garmentBack(L, P, sw) {
  const C = L.shirt;
  if (L.top === 'hoodie') {
    // the hood lies in a thick roll around the back of the neck, its lining shows inside
    return path('M56.4 104C56.4 94 61.6 86.6 70 84.6H90C98.4 86.6 103.6 94 103.6 104C96 101 90 100.6 80 100.6C70 100.6 64 101 56.4 104Z', C, stroke(sw, P.clothLine)) +
      path('M56.4 104C56.4 94 61.6 86.6 70 84.6H90C98.4 86.6 103.6 94 103.6 104Z', paint('sph-soft')) +
      path('M63.6 100.6C63.6 94.4 66.6 90 71.6 88.6H88.4C93.4 90 96.4 94.4 96.4 100.6Z', mix(C, DEEP, 0.38), stroke(sw * 0.7, P.clothLine));
  }
  if (L.top === 'shirt' || L.top === 'polo') {
    const c = L.pattern === 'collar' ? '#f8f6f2' : C;
    return path('M66 99C66.6 92.6 69.4 88.4 72 86.6H88C90.6 88.4 93.4 92.6 94 99Z', mix(c, DEEP, 0.22), stroke(sw * 0.8, lineOf(c)));
  }
  return '';
}

function garmentFront(L, P, sw) {
  const C = L.shirt;
  const ln = P.clothLine;
  const top = L.top;
  let s = '';
  if (top === 'tee' || top === 'cardigan') {
    const T = top === 'cardigan' ? L.shirt2 : C;
    s += line('M68.6 96.6C72 103.8 88 103.8 91.4 96.6', mix(T, DEEP, 0.1), 2.8) +
      line('M69.6 97.2C73 102.6 87 102.6 90.4 97.2', lighten(T, 0.25), 0.6, op(0.7)) + line('M67.4 96.4C71 105.4 89 105.4 92.6 96.4', lineOf(T), sw * 0.7);
    if (L.pattern === 'collar') s += peekCollar(sw);
  }
  if (top === 'tee') {
    s += line('M43 103.6C40.4 110 39.6 117 41 124M117 103.6C119.6 110 120.4 117 119 124', P.clothShade, 0.9, op(0.8)); // sleeve seams
    s += line('M19.6 148C25 150.6 32 151 37.4 149M140.4 148C135 150.6 128 151 122.6 149', P.clothShade, 1.2, op(0.8)); // sleeve hems
    const detail = hashStr(`${L.shirt}${L.shirt2}${L.hairStyle}`) % 3;
    if (detail === 1) {
      // small round print on the chest
      const c = L.shirt2 === C ? WHITE : L.shirt2;
      s += circle(96, 117, 4.6, c, stroke(sw * 0.6, lineOf(c))) + path('M93.4 118.4C95 115 97.6 114 99.2 114.6C98.6 117.4 96.4 119 93.4 118.4Z', C, op(0.85)) + circle(96, 117, 4.6, paint('sph-soft'));
    } else if (detail === 2) {
      s += path('M89.6 114.6H102.4V126.6Q102.4 128.4 100.6 128.4H91.4Q89.6 128.4 89.6 126.6Z', 'none', stroke(0.8, P.clothShade)) + line('M89.6 117H102.4', P.clothShade, 0.7, op(0.8));
    }
  }
  if (top === 'cardigan') {
    // the open fronts with their button bands; the tee shows between them
    const band = mix(C, WHITE, 0.12);
    s += line('M70 97C72.4 112 74 135 74.6 160', band, 3.2) + line('M90 97C87.6 112 86 135 85.4 160', band, 3.2);
    s += line('M71.8 97.4C74.2 112 75.8 135 76.4 160M88.2 97.4C85.8 112 84.2 135 83.6 160', ln, sw * 0.7) + line('M68.2 96.6C70.6 112 72.2 135 72.8 160M91.8 96.6C89.4 112 87.8 135 87.2 160', ln, sw * 0.6, op(0.6));
    for (const y of [116, 130, 144]) s += button(73.4 + (y - 116) * 0.035, y, C, sw);
    s += line('M45 104C42.6 110 41.8 117 42.4 123M115 104C117.4 110 118.2 117 117.6 123', P.clothShade, 0.9, op(0.7));
  }
  if (top === 'shirt' || top === 'polo') {
    const white = L.pattern === 'collar';
    const c = white ? '#f8f6f2' : C;
    const cl = lineOf(c, 0.45);
    if (top === 'shirt') {
      s += line('M80 113.4V160', mix(C, DEEP, 0.16), 4.6, op(0.35)) + line('M77.6 115V160M82.4 115V160', P.clothShade, 0.7, op(0.8));
      for (const y of [120, 132, 144, 156]) s += button(80, y, white ? '#e8e2ea' : C, sw);
      s += path('M89.8 116.6H102V127.6Q102 129.4 100.2 129.4H91.6Q89.8 129.4 89.8 127.6Z', 'none', stroke(0.8, P.clothShade)) + line('M89.8 119H102', P.clothShade, 0.7, op(0.8));
      // pointed collar leaves lying on the shoulders, a soft shadow under each point
      s += ellipse(66, 112, 7, 2.6, paint('shadow')) + ellipse(94, 112, 7, 2.6, paint('shadow'));
      s += path('M70.6 91.4C67.6 97 63.6 103 60.4 108.8C65.4 110.2 70.6 110 75 108.8L79.8 113.6C76.6 107.6 73.4 100.6 71.6 94.6Z', c, stroke(sw * 0.8, cl));
      s += path('M89.4 91.4C92.4 97 96.4 103 99.6 108.8C94.6 110.2 89.4 110 85 108.8L80.2 113.6C83.4 107.6 86.6 100.6 88.4 94.6Z', c, stroke(sw * 0.8, cl)) +
        path('M89.4 91.4C92.4 97 96.4 103 99.6 108.8C94.6 110.2 89.4 110 85 108.8Z', DEEP, op(0.12));
      s += line('M43 104.6C40.6 111 40 118 41.2 124M117 104.6C119.4 111 120 118 118.8 124', P.clothShade, 0.9, op(0.7));
    } else {
      s += path('M77.2 101.6H82.8V117.4Q80 118.6 77.2 117.4Z', mix(C, WHITE, 0.08), stroke(0.7, P.clothShade));
      s += button(80, 108.4, white ? '#e8e2ea' : C, sw) + button(80, 114.2, white ? '#e8e2ea' : C, sw);
      s += ellipse(67, 106.6, 6.4, 2.2, paint('shadow')) + ellipse(93, 106.6, 6.4, 2.2, paint('shadow'));
      // soft knit collar with rounded tips
      s += path('M70.8 91.8C68.6 96 65.6 100 62.6 103.4C64.6 106.2 70 106.6 73.6 105.4C75.6 104.6 77.4 103.4 79.6 101.8C76.4 99 73.6 96 71.8 93.4Z', c, stroke(sw * 0.8, cl));
      s += path('M89.2 91.8C91.4 96 94.4 100 97.4 103.4C95.4 106.2 90 106.6 86.4 105.4C84.4 104.6 82.6 103.4 80.4 101.8C83.6 99 86.4 96 88.2 93.4Z', c, stroke(sw * 0.8, cl)) +
        path('M89.2 91.8C91.4 96 94.4 100 97.4 103.4C95.4 106.2 90 106.6 86.4 105.4C84.4 104.6 82.6 103.4 80.4 101.8Z', DEEP, op(0.12));
      s += line('M64.4 102.4C67.6 104.4 71.6 104.4 74 103.4M95.6 102.4C92.4 104.4 88.4 104.4 86 103.4', lighten(c, 0.3), 0.6, op(0.7));
      s += line('M19.6 148C25 150.6 32 151 37.4 149M140.4 148C135 150.6 128 151 122.6 149', P.clothShade, 1.6, op(0.7)); // rib cuffs
    }
  }
  if (top === 'hoodie') {
    // the hood's front edges cross at the neckline, drawstrings with metal tips
    s += path('M60.6 101.6C66 100.6 70.6 99.4 72.4 98.6C74.4 103 77 106.4 80.4 109.4C75.4 109 66 106 60.6 101.6Z', C, stroke(sw * 0.8, ln)) + path('M60.6 101.6C66 100.6 70.6 99.4 72.4 98.6C74.4 103 77 106.4 80.4 109.4C75.4 109 66 106 60.6 101.6Z', paint('down'));
    s += path('M99.4 101.6C94 100.6 89.4 99.4 87.6 98.6C85.6 103 83 106.4 79.6 109.4C84.6 109 94 106 99.4 101.6Z', C, stroke(sw * 0.8, ln)) + path('M99.4 101.6C94 100.6 89.4 99.4 87.6 98.6C85.6 103 83 106.4 79.6 109.4Z', DEEP, op(0.12));
    const cord = L.shirt2 === C ? WHITE : L.shirt2;
    s += line('M75.6 104.6C75 112 74 120 74.6 129M84.4 104.6C85.4 112 86 118 85.6 125', lineOf(cord), 2) + line('M75.6 104.6C75 112 74 120 74.6 129M84.4 104.6C85.4 112 86 118 85.6 125', cord, 1.2);
    s += rect(73.6, 128, 2, 4, 0.8, paint('steel-v', '#cfd6dc'), stroke(0.5, '#5f6a75')) + rect(84.6, 124.2, 2, 4, 0.8, paint('steel-v', '#cfd6dc'), stroke(0.5, '#5f6a75'));
    s += circle(75.6, 104.8, 1.1, mix(C, DEEP, 0.45)) + circle(84.4, 104.8, 1.1, mix(C, DEEP, 0.45));
    s += line('M64 101C57 107 49 114 43.6 124M96 101C103 107 111 114 116.4 124', P.clothShade, 0.9, op(0.7)); // raglan seams
    if (L.pattern === 'collar') s += peekCollar(sw);
  }
  return s;
}

function torso(L, P, sw) {
  let s = path(TORSO, L.shirt);
  const pat = pattern(L);
  if (pat) s += clip('torso', pat);
  if (L.top === 'cardigan') {
    const tee = 'M70 97C72.4 112 74 135 74.6 160H85.4C86 135 87.6 112 90 97C86 99 74 99 70 97Z';
    s += path(tee, L.shirt2) + path(tee, paint('cyl-soft'));
  }
  s += path(ARM_L, '#000000', op(0.05)) + path(ARM_R, '#000000', op(0.15));
  s += line(CREASES, P.clothShade, 1, op(0.7)) + line(FOLDS, P.clothShade, 0.9, op(0.45));
  s += line('M30 120C34 112 40 107.6 48 104.6', WHITE, 2.4, op(0.22)); // light on the left shoulder
  s += path(TORSO, paint('cyl-soft')) + path(TORSO, paint('down-dark'), op(0.45));
  s += ellipse(84, 101, 17, 6, paint('shadow'), op(0.8)); // the head and neck shade the chest
  s += path(TORSO, 'none', stroke(sw, P.clothLine));
  return s;
}

// ======================================================================
// Face
// ======================================================================
function ears(L, P, sw) {
  let s = '';
  for (const side of [-1, 1]) {
    const x = 80 + side * 22.6;
    const d = `M${f(x)} 58.6C${f(x + side * 5.4)} 56 ${f(x + side * 7.8)} 60.4 ${f(x + side * 7.2)} 66.4C${f(x + side * 6.6)} 72 ${f(x + side * 3.8)} 76.8 ${f(x)} 75.4Z`;
    s += path(d, P.skin);
    s += path(`M${f(x + side * 1)} 61C${f(x + side * 4.6)} 60 ${f(x + side * 5.4)} 63.6 ${f(x + side * 4.6)} 67.4C${f(x + side * 4)} 70 ${f(x + side * 2.6)} 71.4 ${f(x + side * 1)} 71Z`, P.skinShade, op(0.75));
    s += line(`M${f(x + side * 2.4)} 58.6C${f(x + side * 6)} 59 ${f(x + side * 6.8)} 63 ${f(x + side * 6.2)} 67`, lighten(P.skin, 0.25), 0.8, op(0.6));
    if (side > 0) s += path(d, '#3d1206', op(0.12));
    s += path(d, 'none', stroke(sw, P.skinLine));
  }
  return s;
}

function irisAt(cx, dx, L, small = false) {
  const x = cx + dx;
  const y = EYE.y - 0.3;
  return circle(x, y, 3.05, L.iris) + circle(x, y, 3.05, paint('sph-soft')) + circle(x, y, 3.05, 'none', stroke(0.55, mix(L.iris, '#120808', 0.55))) +
    circle(x, y, small ? 0.95 : 1.25, '#120a08') + circle(x - 1, y - 1.2, 0.85, WHITE) + circle(x + 1, y + 0.8, 0.35, WHITE, op(0.7));
}

function eyes(L, P, mood, k) {
  const lid = (cx, side) => {
    const o = cx + side * 5.9;
    const i = cx - side * 5.4;
    return `M${f(o)} ${f(EYE.y + 0.3)}C${f(cx + side * 4)} ${f(EYE.y - 3.9)} ${f(cx - side * 3.1)} ${f(EYE.y - 4.1)} ${f(i)} ${f(EYE.y + 0.5)}`;
  };
  const lash = (cx, side) => `M${f(cx + side * 5.7)} ${f(EYE.y)}L${f(cx + side * 7.3)} ${f(EYE.y - 1.7)}`;
  const crease = (cx, side) => `M${f(cx + side * 5)} ${f(EYE.y - 2.6)}C${f(cx + side * 2.6)} ${f(EYE.y - 5)} ${f(cx - side * 2.8)} ${f(EYE.y - 5)} ${f(cx - side * 4.6)} ${f(EYE.y - 2.2)}`;
  if (mood === 'happy') {
    // laughing: closed, upward-arched lids, the cheeks pushed up under them
    let s = '';
    for (const [cx, side] of [[EYE.l, -1], [EYE.r, 1]]) {
      s += line(`M${f(cx - 5.4)} ${f(EYE.y + 0.9)}Q${f(cx)} ${f(EYE.y - 4.6)} ${f(cx + 5.4)} ${f(EYE.y + 0.9)}`, P.lid, 1.55 * k);
      s += line(`M${f(cx + side * 5.2)} ${f(EYE.y + 0.4)}L${f(cx + side * 6.8)} ${f(EYE.y - 0.6)}`, P.lid, 1 * k);
      s += line(`M${f(cx - 4)} ${f(EYE.y + 3.4)}Q${f(cx)} ${f(EYE.y + 5)} ${f(cx + 4)} ${f(EYE.y + 3.4)}`, P.skinShade, 0.8 * k, op(0.7));
    }
    return s;
  }
  let s = path(eyePath(EYE.l, -1) + eyePath(EYE.r, 1), '#fbf8f4');
  const dx = mood === 'impatient' ? 1.9 : 0;
  let inner = irisAt(EYE.l, dx, L, mood === 'angry') + irisAt(EYE.r, dx, L, mood === 'angry');
  inner += path(`M${f(EYE.l - 7)} ${f(EYE.y - 5)}H${f(EYE.r + 7)}V${f(EYE.y - 1.6)}H${f(EYE.l - 7)}Z`, '#5a2a20', op(0.14)); // the upper lid's shadow
  if (mood === 'impatient') {
    // heavy lids, half closed, a look to the side
    inner += rect(EYE.l - 7, EYE.y - 5, EYE.r - EYE.l + 14, 4.7, 0, P.skinShade);
  } else if (mood === 'angry') {
    inner += path(`M${f(EYE.l - 7)} ${f(EYE.y - 5)}H${f(EYE.l + 7)}V${f(EYE.y + 0.4)}L${f(EYE.l - 7)} ${f(EYE.y - 2.6)}Z`, P.skinShade);
    inner += path(`M${f(EYE.r - 7)} ${f(EYE.y - 5)}H${f(EYE.r + 7)}V${f(EYE.y - 2.6)}L${f(EYE.r - 7)} ${f(EYE.y + 0.4)}Z`, P.skinShade);
  }
  s += clip('eyes', inner);
  if (mood === 'impatient') {
    s += line(`M${f(EYE.l - 5.8)} ${f(EYE.y - 0.1)}Q${f(EYE.l)} ${f(EYE.y - 0.9)} ${f(EYE.l + 5.4)} ${f(EYE.y)}M${f(EYE.r - 5.4)} ${f(EYE.y)}Q${f(EYE.r)} ${f(EYE.y - 0.9)} ${f(EYE.r + 5.8)} ${f(EYE.y - 0.1)}`, P.lid, 1.5 * k);
  } else if (mood === 'angry') {
    s += line(`M${f(EYE.l - 5.8)} ${f(EYE.y - 2.4)}L${f(EYE.l + 5.6)} ${f(EYE.y + 0.6)}M${f(EYE.r - 5.6)} ${f(EYE.y + 0.6)}L${f(EYE.r + 5.8)} ${f(EYE.y - 2.4)}`, P.lid, 1.6 * k);
  } else {
    s += line(lid(EYE.l, -1) + lid(EYE.r, 1), P.lid, 1.35 * k) + line(lash(EYE.l, -1) + lash(EYE.r, 1), P.lid, 0.9 * k);
    s += line(crease(EYE.l, -1) + crease(EYE.r, 1), P.skinShade, 0.8, op(0.7));
  }
  s += line(`M${f(EYE.l - 4.4)} ${f(EYE.y + 2)}C${f(EYE.l - 1.6)} ${f(EYE.y + 3.2)} ${f(EYE.l + 2)} ${f(EYE.y + 3.2)} ${f(EYE.l + 4.4)} ${f(EYE.y + 2)}M${f(EYE.r - 4.4)} ${f(EYE.y + 2)}C${f(EYE.r - 2)} ${f(EYE.y + 3.2)} ${f(EYE.r + 1.6)} ${f(EYE.y + 3.2)} ${f(EYE.r + 4.4)} ${f(EYE.y + 2)}`, P.skinShade, 0.6, op(0.45));
  return s;
}

// A brow as a tapered stroke: thick at the inner end (x0,y0), over the arch to the thin outer end.
function brow(x0, y0, xm, ym, x1, y1, t, col) {
  return path(`M${f(x0)} ${f(y0 - t * 0.5)}Q${f(xm)} ${f(ym - t * 0.55)} ${f(x1)} ${f(y1)}Q${f(xm)} ${f(ym + t * 0.4)} ${f(x0)} ${f(y0 + t * 0.5)}Z`, col, stroke(0.4, col));
}

function brows(mood, P, k) {
  const t = 2.1 * Math.min(1.4, k);
  const c = P.brow;
  switch (mood) {
    case 'happy':
      return brow(75.6, 57.6, 69, 55, 64, 57.6, t, c) + brow(84.4, 57.6, 91, 55, 96, 57.6, t, c);
    case 'impatient':
      // a frown (a milder angry: the inner ends drawn down, two creases between them), the right brow still
      // raised at its arch: "how much longer?"
      return brow(75.8, 61.2, 70, 59.2, 64.2, 58.8, t, c) + brow(84.2, 60.6, 90.4, 56, 96, 57.4, t, c) +
        line('M78.6 57.8Q78.1 59.2 78.5 60.8M81.4 57.8Q81.9 59.2 81.5 60.8', P.skinShade, 0.8 * Math.min(k, 1.4), op(0.8));
    case 'angry':
      return brow(76.4, 62, 70, 58.6, 63.6, 56.4, t * 1.2, c) + brow(83.6, 62, 90, 58.6, 96.4, 56.4, t * 1.2, c);
    default:
      return brow(75.6, 59.4, 69.4, 57.4, 64.2, 59, t, c) + brow(84.4, 59.4, 90.6, 57.4, 95.8, 59, t, c);
  }
}

function nose(P) {
  return line('M82.6 66.4C83.4 69.6 84.2 72.4 84.8 75', P.skinShade, 1.8, op(0.4)) +
    path('M75.4 76.4C76.4 78.8 78.4 79.4 80 78.8C81.6 79.4 83.6 78.8 84.6 76.4C83.4 77.4 81.8 77.6 80 77.2C78.2 77.6 76.6 77.4 75.4 76.4Z', P.skinShade, op(0.8)) +
    ellipse(77.4, 77.3, 1.15, 0.6, P.lipDark, op(0.65)) + ellipse(82.6, 77.3, 1.15, 0.6, P.lipDark, op(0.65)) +
    ellipse(79, 74.4, 1.7, 1.1, WHITE, op(0.32)) + line('M78.2 66C78 69 77.6 71.4 77.4 73', WHITE, 1, op(0.18));
}

function mouth(mood, P, sw, k) {
  const teeth = '#fbf6ee';
  switch (mood) {
    case 'happy':
      return path(MOUTH_OPEN, '#5e1420') +
        clip('smile', rect(70, 81, 20, 3.6, 0, teeth) + line('M70 84.6H90', '#d9cfc4', 0.5) + ellipse(80, 90.2, 6, 3, '#e05a6c')) +
        path(MOUTH_OPEN, 'none', stroke(0.9 * k, P.lipDark)) +
        line('M73.4 90.2C76 92.4 84 92.4 86.6 90.2', P.lip, 1.2, op(0.7)) +
        line('M69.4 79.6C68.6 81.4 69 83 70.2 84.2M90.6 79.6C91.4 81.4 91 83 89.8 84.2', P.skinShade, 0.9 * k, op(0.8));
    case 'impatient':
      // lips pressed together, pulled up to one side, a dimple at that corner
      return path('M74.2 85.8C77 84.6 80 84 82.6 83.6C84.6 83.3 86.2 82.6 87.4 81.4C86.8 84 85 85.8 82.4 86.4C79.6 87 76.8 87 74.2 85.8Z', P.lip) +
        line('M74 85.8C77.4 85 80.6 84.3 83 83.9C84.8 83.6 86.2 82.9 87.6 81.2', P.lipDark, 1.2 * k) + line('M87.8 80.6Q89.2 81.8 88.8 83.6', P.skinShade, 0.8 * k, op(0.75)) +
        line('M78 87.6Q81 88.2 84 87', WHITE, 0.6, op(0.3));
    case 'angry':
      return path(MOUTH_GRIT, '#4a0f16') +
        clip('grit', rect(70, 81, 20, 8.4, 0, teeth) + line('M70 85.4H90', '#a89c94', 0.9) + line('M75.6 81V89M80 81V89M84.4 81V89', '#b8aca4', 0.6)) +
        path(MOUTH_GRIT, 'none', stroke(1 * k, P.lipDark)) + line('M72 89.4C76 91 84 91 88 89.4', P.lip, 1.2, op(0.75));
    default:
      // calm, the corners turned up a little
      return path('M73.6 83.6C76 82.6 78.6 82.4 80 83C81.4 82.4 84 82.6 86.4 83.6C84 84.4 76 84.4 73.6 83.6Z', P.lip) +
        path('M74.2 83.9C77 87.6 83 87.6 85.8 83.9C83 84.8 77 84.8 74.2 83.9Z', mix(P.lip, '#ffffff', 0.1)) +
        line('M73.4 83.2C76.4 84.6 83.6 84.6 86.6 83.2', P.lipDark, 1.05 * k) + ellipse(80, 85.6, 2.4, 0.7, WHITE, op(0.35));
  }
}

function face(L, P, mood, sw, k) {
  let s = path(HEAD, P.skin);
  let shade = path('M103 50C103.6 66 101 82 92 90.6C98 92 108 80 108 62Z', P.skinShade, op(0.55)); // the side away from the light
  shade += ellipse(62.6, 82, 4, 7.4, P.skinShade, op(0.25)); // under the left cheekbone
  if (L.hairStyle !== 'bald') shade += ellipse(80, (HAIRLINE[L.hairStyle] ?? 50) + 2.4, 24, 4.4, paint('shadow'), op(0.55)); // the hair's shadow
  s += clip('head', shade);
  s += path(HEAD, paint('skin'));
  const blush = { happy: 0.95, neutral: 0.5, impatient: 0.25, angry: 0 }[mood] ?? 0.4;
  if (blush) s += ellipse(66, 77.4, 6.6, 4, paint('blush'), op(blush)) + ellipse(94, 77.4, 6.6, 4, paint('blush'), op(blush));
  if (mood === 'angry') s += ellipse(80, 52, 18, 8, paint('flush')) + ellipse(65, 76, 8, 6, paint('flush')) + ellipse(95, 76, 8, 6, paint('flush'));
  // dark skin shows its sheen more: brighter highlights on the forehead, the cheekbone and the nose
  const sheen = lum(L.skin) < 120 ? 0.29 : 0.16;
  s += gloss(69.4, 46.6, 7, 2.6, -18, sheen) + gloss(80, 90.2, 3, 1, 0, sheen);
  if (sheen > 0.2) s += gloss(65.4, 72.4, 3.6, 1.6, -25, 0.18) + gloss(78.6, 70, 0.9, 2.6, 0, 0.18);
  s += nose(P);
  s += eyes(L, P, mood, k);
  s += brows(mood, P, k);
  s += path(HEAD, 'none', stroke(sw, P.skinLine));
  return s;
}

function beard(L, P0, sw) {
  const P = { ...P0, ...P0.facial };
  const d ='M57.6 64C57 78 62 92 80 96.6C98 92 103 78 102.4 64L100.6 64C100 72 97 79 91.6 83C88 86 84 87.6 80 87.6C76 87.6 72 86 68.4 83C63 79 60 72 59.4 64Z';
  const rng = createRng(hashStr(`beard${L.hair}`));
  let tex = '';
  for (let i = 0; i < 44; i++) {
    const a = Math.PI * (0.04 + rng.next() * 0.92);
    const r = 0.15 + rng.next() * 0.7;
    const x = 80 - Math.cos(a) * (21.2 + r * 1.2);
    const y = 66 + Math.sin(a) * (21.8 + r * 8.6);
    tex += `M${f(x)} ${f(y)}l${f((80 - x) * 0.05)} 2`;
  }
  return hairShape(d, P, sw, path('M102.4 64C103 78 98 92 80 96.6C93 90 99 80 100.6 64Z', P.hairDark, op(0.6)) + line(tex, P.hairDark, 0.8, op(0.7))) +
    hairShape('M71.4 82C74.8 79.4 78.4 79.6 80 80.8C81.6 79.6 85.2 79.4 88.6 82C85.8 83.4 82.6 83.2 80 82.4C77.4 83.2 74.2 83.4 71.4 82Z', P, sw * 0.8);
}

// ======================================================================
// Accessories and mood extras
// ======================================================================
function accessory(L, P, sw, k) {
  const a = L.accent === INK ? PINK : L.accent;
  switch (L.accessory) {
    case 'glasses': {
      const fr = L.accent === WHITE ? '#2b2b30' : L.accent === INK ? '#3a2a24' : mix(L.accent, DEEP, 0.15);
      const lens = (x) => `M${f(x - 7)} 62.4Q${f(x - 7)} 61 ${f(x - 5.6)} 61H${f(x + 5.6)}Q${f(x + 7)} 61 ${f(x + 7)} 62.4V68.6Q${f(x + 7)} 71.6 ${f(x + 4)} 71.6H${f(x - 4)}Q${f(x - 7)} 71.6 ${f(x - 7)} 68.6Z`;
      const both = lens(EYE.l) + lens(EYE.r);
      return path(both, WHITE, op(0.16)) + line(`M${f(EYE.l - 4)} 69.6L${f(EYE.l + 2)} 62.6M${f(EYE.r - 4)} 69.6L${f(EYE.r + 2)} 62.6`, WHITE, 1.2, op(0.4)) +
        line('M77.4 64.4Q80 62.8 82.6 64.4M63.4 63L57.6 62.2M96.6 63L102.4 62.2', fr, 1.5) +
        path(both, 'none', stroke(1.9 * Math.min(k, 1.3), lineOf(fr, 0.4))) + path(both, 'none', stroke(1.3 * Math.min(k, 1.3), fr)) +
        line(`M${f(EYE.l - 6)} 62.2H${f(EYE.l + 3)}M${f(EYE.r - 6)} 62.2H${f(EYE.r + 3)}`, lighten(fr, 0.5), 0.6, op(0.6));
    }
    case 'sunglasses': {
      const lens = (x) => `M${f(x - 7.6)} 62Q${f(x - 7.6)} 60.4 ${f(x - 6)} 60.4H${f(x + 6)}Q${f(x + 7.6)} 60.4 ${f(x + 7.6)} 62V67Q${f(x + 7.6)} 72.4 ${f(x + 2.4)} 72.4H${f(x - 2.4)}Q${f(x - 7.6)} 72.4 ${f(x - 7.6)} 67Z`;
      const both = lens(EYE.l) + lens(EYE.r);
      return line('M77.6 63.4Q80 62 82.4 63.4M62.6 62.4L57.6 61.8M97.4 62.4L102.4 61.8', '#1d1b22', 1.6) +
        path(both, paint('black-v', '#2a2a31'), stroke(1, '#0d0c10')) +
        line(`M${f(EYE.l - 4.6)} 70L${f(EYE.l + 1.6)} 61.6M${f(EYE.r - 4.6)} 70L${f(EYE.r + 1.6)} 61.6`, WHITE, 1.6, op(0.4)) +
        line(`M${f(EYE.l - 6.6)} 61.2H${f(EYE.l + 6.6)}M${f(EYE.r - 6.6)} 61.2H${f(EYE.r + 6.6)}`, a, 1.2, op(0.85));
    }
    case 'cap': {
      // a baseball cap seen from the front: a low crown (only its centre seam, a small badge, the button on
      // top), the sides tucked in above the ears; the curved bill sticks out towards the viewer, deepest in the
      // middle, with its darker underside along the front edge and its shadow over the forehead and brows
      const cl = lineOf(a);
      const crown = 'M57.4 56.8C55.2 41.6 65.4 31.2 80 31.2C94.6 31.2 104.8 41.6 102.6 56.8C96 54 64 54 57.4 56.8Z';
      let s = clip('head', ellipse(80, 60.2, 21, 3.4, paint('shadow')) + path('M58 56H102V58.6C96 60.8 64 60.8 58 58.6Z', DEEP, op(0.16)));
      s += path(crown, a, stroke(sw, cl));
      s += path('M102.6 56.8C104.8 41.6 94.6 31.2 84 31.4C95.4 36.4 99.8 46 100.2 55.2Z', DEEP, op(0.16));
      s += line('M80 31.6V52.6', cl, 0.8, op(0.6)) + line('M78.7 32.6V52.2M81.3 32.6V52.2', lighten(a, 0.35), 0.4, op(0.6) + ' stroke-dasharray="1 1"');
      s += path(crown, paint('sph-soft'));
      const badge = lum(a) > 150 ? mix(a, DEEP, 0.55) : lighten(a, 0.75);
      s += circle(79.2, 44.4, 2.6, badge, op(0.9)) + path('M80 42.2C80.8 39.8 83.6 39 85.4 39.8C84.6 42 82.2 43 80 42.2Z', badge, op(0.9)); // embroidered berry
      s += ellipse(80, 31.4, 2.1, 1.2, mix(a, DEEP, 0.18), stroke(sw * 0.6, cl));
      s += line('M57.8 55.6C59 54.8 60.4 54.2 62 53.8M102.2 55.6C101 54.8 99.6 54.2 98 53.8', mix(a, DEEP, 0.35), 1.6); // the band above the ears
      // the bill: its top in the light, the front edge curving down to the middle, the dark underside below it
      const bill = 'M59.4 54.4C66 51.6 94 51.6 100.6 54.4C100.8 57 92.8 60.4 80 60.4C67.2 60.4 59.2 57 59.4 54.4Z';
      s += path(bill, mix(a, DEEP, 0.04), stroke(sw, cl));
      s += path(bill, paint('down'), op(0.5));
      s += path('M60.2 56.2C64 58.2 72 59 80 59C88 59 96 58.2 99.8 56.2C98.6 58.6 91.4 60.4 80 60.4C68.6 60.4 61.4 58.6 60.2 56.2Z', mix(a, DEEP, 0.5));
      s += line('M62 54.2C68 52.8 78 52.6 86 52.9', lighten(a, 0.45), 0.9, op(0.7));
      return s;
    }
    case 'earrings':
      // gold hoops on the earlobes (with the ears under the hair, earDrops peek out instead)
      if (EARS_HIDDEN.includes(L.hairStyle)) return '';
      return circle(54.6, 79, 2.5, 'none', stroke(1.6 * Math.min(k, 1.3), '#a8750c')) + circle(54.6, 79, 2.5, 'none', stroke(0.9 * Math.min(k, 1.3), '#ffd75a')) +
        circle(105.4, 79, 2.5, 'none', stroke(1.6 * Math.min(k, 1.3), '#a8750c')) + circle(105.4, 79, 2.5, 'none', stroke(0.9 * Math.min(k, 1.3), '#ffd75a'));
    case 'headband': {
      const petals = [];
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2 - Math.PI / 2;
        petals.push([95 + Math.cos(ang) * 3.6, 42 + Math.sin(ang) * 3.6, 3]);
      }
      return line('M56.2 56C57.6 37 102.4 37 103.8 56', lineOf(a), 5.4) + line('M56.2 56C57.6 37 102.4 37 103.8 56', a, 4) +
        line('M58.6 49C62 40.6 72 38 80 38', lighten(a, 0.45), 1, op(0.6)) +
        puffs(petals, a === WHITE ? PINK : WHITE, sw * 0.6) + circle(95, 42, 2, MANGO, stroke(sw * 0.5));
    }
    default:
      return '';
  }
}

// Earrings of a guest whose hair covers the ears: small gold drops. Long hair and an afro stand off the jaw, so
// there the drops hang on a short chain behind the face and peek out between the jaw and the hair's lower inner
// edge. A bob lies close over the ears: a stud on the earlobe (at the ear's height, beside the jaw) holds a short
// drop over the hair, with its little shadow on the hair.
// [x from the middle, y of the drop's top, chain length]
const DROP_AT = { long: [16.8, 84.4, 6], afro: [16.8, 84.4, 6], bob: [23.4, 78.4, 2] };
const DROPS_OVER_HAIR = ['bob'];
function earDrops(style, k) {
  const [dx, y, chain] = DROP_AT[style];
  const over = DROPS_OVER_HAIR.includes(style);
  const w = Math.min(k, 1.3);
  let s = '';
  for (const side of [-1, 1]) {
    const x = 80 + side * dx;
    const drop = `M${f(x)} ${f(y)}C${f(x + 1.7)} ${f(y + 1.6)} ${f(x + 1.9)} ${f(y + 3.2)} ${f(x + 1.9)} ${f(y + 4)}A1.9 1.9 0 0 1 ${f(x - 1.9)} ${f(y + 4)}C${f(x - 1.9)} ${f(y + 3.2)} ${f(x - 1.7)} ${f(y + 1.6)} ${f(x)} ${f(y)}Z`;
    if (over) s += g('translate(0.9 1.1)', path(drop, DEEP, op(0.3)));
    s += line(`M${f(x)} ${f(y - chain)}V${f(y + 0.6)}`, '#a8750c', 0.8 * w);
    if (over) s += circle(x, y - chain, 1.15, '#ffd75a', stroke(0.5 * w, '#a8750c'));
    s += path(drop, '#ffd75a', stroke(0.6 * w, '#a8750c'));
    s += circle(x - 0.6, y + 3.4, 0.55, WHITE, op(0.85));
  }
  return s;
}

function moodExtras(mood, sw, k) {
  if (mood === 'impatient') {
    // the sweat drop, a little away from the head, with a light rim so it reads on dark or curly hair too
    const s = Math.min(1.6, 1.3 * k);
    const drop = 'M0 -7C3 -2 5 1 5 3.8A5 5 0 0 1 -5 3.8C-5 1 -3 -2 0 -7Z';
    return g(`translate(111.4 54.6) scale(${f(s)})`, path(drop, 'none', stroke(2.4, WHITE) + op(0.7)) + path(drop, '#8fd8f6', stroke(sw / s, '#3a8cb8')) + gloss(-1.8, 3, 1.3, 2.2, 15, 0.85));
  }
  if (mood === 'angry') {
    const steam = (x, y, q) => puffs([[x, y, 5 * q], [x - 5 * q, y + 3.6 * q, 3.6 * q], [x + 5 * q, y + 3 * q, 4 * q], [x + 1.4 * q, y - 5 * q, 3.6 * q]], '#f5f1f7', sw * 0.9);
    const vein = 'M-5 -1.4Q-1.4 -1.4 -1.4 -5M1.4 -5Q1.4 -1.4 5 -1.4M5 1.4Q1.4 1.4 1.4 5M-1.4 5Q-1.4 1.4 -5 1.4';
    const q = Math.min(1.3, k);
    return steam(49, 37, q) + steam(112, 33, q * 1.1) + g(`translate(101.6 44.6) scale(${f(q)})`, line(vein, WHITE, 3.6) + line(vein, '#e8322e', 1.9));
  }
  return '';
}

// ======================================================================
// customerSVG
// ======================================================================
// Thin warm line for the few parts drawn with the shared helpers (steam, flower).
const GUEST_LINE = '#4a2f3e';
// 12–24 KB a picture: enough for the guests of a level (4 seats × their moods) and the menus' guests
const memoGuest = memoTable(64);

export function customerSVG(look, mood = 'neutral', size = 160) {
  const L = normLook(look);
  const m = MOODS.includes(mood) ? mood : 'neutral';
  return memoGuest(`guest|${JSON.stringify(L)}|${m}|${size}`, () => withInk(GUEST_LINE, () => drawGuest(L, m, size)));
}

function drawGuest(L, mood, size) {
  const [x0, y0, vw, vh] = size < 100 ? CROP : [0, 0, 160, 160];
  const sw = ow(vw, size, 0.9, 4) * 0.38;
  const k = Math.max(1, Math.min(2, (vw / Math.max(1, size)) * 0.9)); // features a little bolder in small pictures
  const P = palette(L, mood);
  const hw = sw / HEAD_K; // the same line width on the scaled head
  let s = headGroup(hairBack(L, P, hw));
  s += torso(L, P, sw);
  s += garmentBack(L, P, sw);
  s += neck(L, P, sw);
  s += garmentFront(L, P, sw);
  const drops = L.accessory === 'earrings' && EARS_HIDDEN.includes(L.hairStyle);
  const dropsOver = drops && DROPS_OVER_HAIR.includes(L.hairStyle);
  let h = hairSide(L, P, hw);
  if (!EARS_HIDDEN.includes(L.hairStyle)) h += ears(L, P, hw);
  else if (drops && !dropsOver) h += earDrops(L.hairStyle, k);
  h += face(L, P, mood, hw, k);
  if (L.accessory === 'beard') h += beard(L, P, hw);
  h += mouth(mood, P, hw, k);
  h += hairFront(L, P, hw);
  if (dropsOver) h += earDrops(L.hairStyle, k);
  h += accessory(L, P, hw, k);
  h += moodExtras(mood, hw, k);
  s += headGroup(h);
  return svgWrap(size, size, vw, vh, x0 || y0 ? g(`translate(${-x0} ${-y0})`, s) : s);
}
