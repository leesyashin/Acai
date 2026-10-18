// Art module: pure SVG strings – checks the parts the game relies on to communicate state.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blenderSVG } from '../js/art.js';

// y of the top edge of the jug contents (the fill path carries it as data-fill)
function fillTop(svg) {
  const m = svg.match(/data-fill="([\d.]+)"/);
  assert.ok(m, 'no jug fill in blender svg');
  return Number(m[1]);
}

test('ready blender: the fill level drops with every pour and never empties', () => {
  for (const max of [2, 3]) {
    const tops = [];
    for (let k = max; k >= 1; k--) tops.push(fillTop(blenderSVG({ state: 'ready', base: 'acai', portions: k, maxPortions: max }, 140)));
    for (let i = 1; i < tops.length; i++) assert.ok(tops[i] - tops[i - 1] >= 5, `${max} portions: levels ${tops.join(' → ')} are not clearly lower after each pour`);
    assert.equal(tops[0], 50, 'a full jug keeps the full fill level');
    assert.ok(tops.at(-1) <= 80, `the last portion must still show a clear layer (top ${tops.at(-1)})`);
  }
});

test('ready blender without portions (shop/intro art) draws a full jug', () => {
  assert.equal(fillTop(blenderSVG({ state: 'ready', base: 'pitaya' }, 140)), 50);
  assert.equal(fillTop(blenderSVG({ state: 'ready', base: 'acai', portions: 3, maxPortions: 3 }, 140)), 50);
});

test('drawn blender (no WebGL): every model has its own base colour, the same shape; Turbo without a tier', () => {
  const o = { state: 'ready', base: 'acai', portions: 2, maxPortions: 2 };
  const tiers = [0, 1, 2, 3].map((tier) => blenderSVG({ ...o, tier }, 140));
  assert.equal(new Set(tiers).size, 4, 'two models are drawn alike');
  assert.equal(blenderSVG(o, 140), tiers[1], 'without a tier the stainless Turbo is drawn');
  assert.equal(blenderSVG({ ...o, tier: 9 }, 140), tiers[1], 'an unknown tier falls back to the Turbo');
  for (const svg of tiers) assert.equal(fillTop(svg), 50, 'every model holds the same jug');
});

// ------------------------------------------------------------------ shared paint servers
import * as art from '../js/art.js';
import { memoTable } from '../js/svg.js';
import { INGREDIENTS } from '../js/data.js';

const ALL_IDS = INGREDIENTS.map((i) => i.id);
const refs = (svg) => [...svg.matchAll(/url\(#(af-[\w-]+)\)/g)].map((m) => m[1]);

test('every shared gradient or clip path a picture uses is defined in artDefsSVG()', () => {
  const defs = art.artDefsSVG();
  const defined = new Set([...defs.matchAll(/id="(af-[\w-]+)"/g)].map((m) => m[1]));
  const pictures = [
    ...ALL_IDS.map((id) => art.ingredientIcon(id, 64)),
    ...ALL_IDS.filter((id) => INGREDIENTS.find((i) => i.id === id).layer !== 'base').map((id) => art.binSVG(id, 84)),
    ...ALL_IDS.filter((id) => INGREDIENTS.find((i) => i.id === id).layer !== 'base').map((id) => art.binFillSVG(id, 96)),
    ...['acai', 'pitaya', 'spirulina'].map((id) => art.packIcon(id, 72)),
    art.bowlSVG(null, 140), art.bowlSVG({ base: 'acai', mid: ['banana', 'granola', 'kiwi'], top: ['honey', 'chia', 'mint'] }, 140),
    art.cupStackSVG(84), art.cupSpotSVG(140), art.matchaGlassSVG('mango', 'ready', 70), art.matchaGlassSVG('kiwi', 'mixing', 70),
    ...['empty', 'blending', 'ready', 'overflowing', 'ruined'].map((state) => art.blenderSVG({ state, base: 'pitaya', portions: 1, maxPortions: 2 }, 140)),
    art.matchaMachineSVG(2, 312), art.trashSVG(96), art.shopSceneSVG(1280, 330), art.customerSVG(7, 'happy', 160),
    ...['happy', 'neutral', 'impatient', 'angry'].map((mood) => art.customerSVG({ hairStyle: 'afro', top: 'hoodie', pattern: 'stripes', accessory: 'cap' }, mood, 160)),
    art.customerSVG({ hairStyle: 'braids', top: 'shirt', pattern: 'hawaii', accessory: 'beard' }, 'neutral', 40),
    art.counterSVG(1280, 462), art.freezerSVG('well', 284, 186), art.freezerSVG('rim', 284, 186), art.riserSVG(400, 62),
    ...ALL_IDS.filter((id) => INGREDIENTS.find((i) => i.id === id).layer !== 'base').map((id) => art.scoopSVG(id, 84)),
    ...['plants', 'jukebox', 'seating', 'neon'].map((id) => art.decorSVG(id, 118)),
  ];
  const used = new Set(pictures.flatMap(refs));
  assert.ok(used.size > 10, 'the art uses the shared paints');
  // ids made per picture (uid) live in the picture's own <defs>
  const local = (id) => /^af-(wall|glow|sky|sea|win|logoA|logoB|ctr)-/.test(id);
  for (const id of used) if (!local(id)) assert.ok(defined.has(id), `url(#${id}) is not in artDefsSVG()`);
  assert.equal(new Set([...defs.matchAll(/id="([^"]+)"/g)].map((m) => m[1])).size, [...defs.matchAll(/id="/g)].length, 'duplicate ids in the defs');
});

test('the cup shows what was put in: empty cup, purée, layers through the side, toppings', () => {
  const empty = art.bowlSVG({ base: null, mid: [], top: [] }, 140);
  const base = art.bowlSVG({ base: 'acai', mid: [], top: [] }, 140);
  const one = art.bowlSVG({ base: 'acai', mid: ['banana'], top: [] }, 140);
  const two = art.bowlSVG({ base: 'acai', mid: ['banana', 'kiwi'], top: ['honey'] }, 140);
  assert.ok(base.length > empty.length && one.length > base.length && two.length > one.length, 'every item adds to the picture');
  assert.notEqual(art.bowlSVG({ base: 'pitaya', mid: [], top: [] }, 140), base, 'the base colour shows');
  assert.notEqual(art.cupSpotSVG(140), empty, 'a free spot is not an empty cup');
});

test('the matcha glass: the purée first, then milk and matcha run in, a ready one has all three', () => {
  const { MATCHA_COLORS: C, matchaFruitColorOf, MATCHA_MILK } = art;
  const has = (svg, col) => svg.includes(col);
  const puree = matchaFruitColorOf('mango');
  const empty = art.matchaGlassSVG(null, 'empty', 100);
  assert.ok(!has(empty, puree) && !has(empty, C.milk) && !has(empty, C.matcha), 'an empty glass is empty');
  const start = art.matchaGlassSVG('mango', 'mixing', 100, { fill: 0 });
  assert.ok(has(start, puree) && !has(start, C.milk) && !has(start, C.matcha), 'the fruit is purée at the bottom at once');
  const milk = art.matchaGlassSVG('mango', 'mixing', 100, { fill: MATCHA_MILK * 0.6 });
  assert.ok(has(milk, C.milk) && !has(milk, C.matcha), 'the milk runs in first');
  const both = art.matchaGlassSVG('mango', 'mixing', 100, { fill: 0.8 });
  assert.ok(has(both, C.milk) && has(both, C.matcha), 'then the matcha settles on it');
  const ready = art.matchaGlassSVG('mango', 'ready', 100);
  assert.ok(has(ready, puree) && has(ready, C.milk) && has(ready, C.matcha), 'a ready glass shows its three layers');
  assert.notEqual(art.matchaGlassSVG('kiwi', 'ready', 100), ready, 'the fruit shows');
  // its own stream only while something runs in, and never when the 3D machine pours
  const streams = (svg) => (svg.match(/M47\.6 0H52\.4/g) || []).length;
  assert.equal(streams(start), 0, 'no stream before the pour');
  assert.ok(streams(both) > 0, 'the drawn machine pours into the glass');
  assert.equal(streams(art.matchaGlassSVG('mango', 'mixing', 100, { fill: 0.8, stream: false })), 0);
});

// ------------------------------------------------------------------ guests
const MOODS = ['happy', 'neutral', 'impatient', 'angry'];

test('seeded guests keep the skin, hair and colours they had before the garment and eye colour existed', () => {
  // values of lookFromSeed() before `top` and `iris` were added (they are picked last)
  const before = {
    1: { skin: '#8d5634', hair: '#d9a24a', hairStyle: 'spiky', shirt: '#f7e14f', shirt2: '#ff4d4d', pattern: 'stripes', accessory: 'glasses', accent: '#2a1236' },
    23: { skin: '#8d5634', hair: '#2fbf71', hairStyle: 'long', shirt: '#7b3a96', shirt2: '#ff3d8b', pattern: 'hawaii', accessory: 'none', accent: '#2fbf71' },
    31: { skin: '#ffe3cc', hair: '#2b1a12', hairStyle: 'braids', shirt: '#ff9ec7', shirt2: '#2fbf71', pattern: 'stripes', accessory: 'sunglasses', accent: '#4656c9' },
  };
  for (const [seed, look] of Object.entries(before)) {
    const now = art.lookFromSeed(Number(seed));
    for (const [k, v] of Object.entries(look)) assert.equal(now[k], v, `seed ${seed}: ${k}`);
    assert.ok(art.LOOK_OPTIONS.tops.includes(now.top), `seed ${seed}: a garment`);
    assert.match(now.iris, /^#[0-9a-f]{6}$/, `seed ${seed}: an eye colour`);
  }
});

test('the guests vary: every garment, hair style and accessory turns up among seeded looks', () => {
  const looks = Array.from({ length: 400 }, (_, i) => art.lookFromSeed(i + 1));
  for (const [key, list] of [['top', art.LOOK_OPTIONS.tops], ['hairStyle', art.LOOK_OPTIONS.hairStyles], ['accessory', art.LOOK_OPTIONS.accessories]]) {
    for (const v of list) assert.ok(looks.some((l) => l[key] === v), `no guest with ${key} ${v}`);
  }
});

test('a guest is drawn from any look: old look objects without a garment, every style, every mood', () => {
  const old = { skin: '#d39668', hair: '#a8652f', hairStyle: 'ponytail', shirt: '#ff3d8b', shirt2: '#ffffff', pattern: 'plain', accessory: 'glasses', accent: '#2fbf71' };
  assert.equal(art.customerSVG(old, 'happy', 160), art.customerSVG({ ...old }, 'happy', 160), 'the missing fields are derived from the look itself');
  for (const hairStyle of art.LOOK_OPTIONS.hairStyles) {
    for (const top of art.LOOK_OPTIONS.tops) {
      const svg = art.customerSVG({ ...old, hairStyle, top }, 'neutral', 160);
      assert.ok(!/NaN|undefined/.test(svg), `${hairStyle} / ${top}`);
    }
  }
  const moods = MOODS.map((m) => art.customerSVG(old, m, 160));
  assert.equal(new Set(moods).size, 4, 'every mood shows');
  assert.equal(art.customerSVG(old, 'bored', 160), moods[1], 'an unknown mood is neutral');
});

test('guest pictures are memoised and free of ids (the same picture can be in the page several times)', () => {
  for (const size of [160, 40]) {
    for (const mood of MOODS) {
      const svg = art.customerSVG(12345, mood, size);
      assert.ok(!/\sid="/.test(svg), 'no ids of its own');
      assert.equal(art.customerSVG(12345, mood, size), svg);
    }
  }
  // small pictures show head and shoulders only
  assert.match(art.customerSVG(5, 'happy', 40), /viewBox="0 0 100 100"/);
  assert.match(art.customerSVG(5, 'happy', 160), /viewBox="0 0 160 160"/);
});

test('guest pictures keep their numbers short (no float noise in the memoised strings)', () => {
  const looks = [1, 2, 3, 23, 42, { hairStyle: 'curly', accessory: 'glasses' }, { hairStyle: 'long', accessory: 'sunglasses' },
    { hairStyle: 'bob', accessory: 'earrings' }, { hairStyle: 'bald', accessory: 'cap', skin: '#64391f' }];
  for (const look of looks) {
    for (const mood of MOODS) {
      for (const size of [160, 40]) {
        const long = art.customerSVG(look, mood, size).match(/\d\.\d{4,}/);
        assert.equal(long, null, `${JSON.stringify(look)} ${mood} ${size}: ${long}`);
      }
    }
  }
});

test('a memo table drops the picture used longest ago, not the oldest one', () => {
  const memo = memoTable(2);
  let draws = 0;
  const draw = (v) => () => { draws++; return v; };
  memo('a', draw(1));
  memo('b', draw(2));
  assert.equal(memo('a', draw(1)), 1, 'a hit');
  memo('c', draw(3)); // full: b goes, a was used after it
  assert.equal(draws, 3);
  memo('a', draw(1));
  assert.equal(draws, 3, 'a is still cached');
  memo('b', draw(2));
  assert.equal(draws, 4, 'b was dropped');
});

test('the café wall leaves out the chalkboard and the shelf with 4 seats (the outer bubbles would hide them)', () => {
  const slate = '#3e4541'; // the chalkboard's slate
  const board = '#b58c63'; // the shelf's oak board
  for (const seats of [2, 3]) {
    const wall = art.shopSceneSVG(1280, 330, { seats });
    assert.ok(wall.includes(slate) && wall.includes(board), `${seats} seats: chalkboard and shelf on the wall`);
  }
  assert.ok(art.shopSceneSVG(1280, 330).includes(slate), 'the default wall has the chalkboard');
  const full = art.shopSceneSVG(1280, 330, { seats: 4 });
  assert.ok(!full.includes(slate) && !full.includes(board), '4 seats: no chalkboard, no shelf');
  assert.ok(full.includes('af-sky-'), '4 seats: the window stays');
});

test('decor casts its shadow on the café wall only, not on a shop card', () => {
  for (const id of ['plants', 'jukebox', 'seating', 'neon']) {
    const wall = art.decorSVG(id, 118);
    const card = art.decorSVG(id, 118, { wall: false });
    assert.ok(wall.includes('#3a2414'), `${id}: a shadow on the wall`);
    assert.ok(!card.includes('#3a2414') && card.length < wall.length, `${id}: no wall shadow on its own`);
  }
});
