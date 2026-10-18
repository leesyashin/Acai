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

// ------------------------------------------------------------------ shared paint servers
import * as art from '../js/art.js';
import { INGREDIENTS } from '../js/data.js';

const ALL_IDS = INGREDIENTS.map((i) => i.id);
const refs = (svg) => [...svg.matchAll(/url\(#(af-[\w-]+)\)/g)].map((m) => m[1]);

test('every shared gradient or clip path a picture uses is defined in artDefsSVG()', () => {
  const defs = art.artDefsSVG();
  const defined = new Set([...defs.matchAll(/id="(af-[\w-]+)"/g)].map((m) => m[1]));
  const pictures = [
    ...ALL_IDS.map((id) => art.ingredientIcon(id, 64)),
    ...ALL_IDS.filter((id) => INGREDIENTS.find((i) => i.id === id).layer !== 'base').map((id) => art.binSVG(id, 84)),
    ...['acai', 'pitaya', 'spirulina'].map((id) => art.packIcon(id, 72)),
    art.bowlSVG(null, 140), art.bowlSVG({ base: 'acai', mid: ['banana', 'granola', 'kiwi'], top: ['honey', 'chia', 'mint'] }, 140),
    art.cupStackSVG(84), art.cupSpotSVG(140), art.cupSVG('mango', 'ready', 70), art.cupSVG('kiwi', 'mixing', 70),
    ...['empty', 'blending', 'ready', 'overflowing', 'ruined'].map((state) => art.blenderSVG({ state, base: 'pitaya', portions: 1, maxPortions: 2 }, 140)),
    art.smoothieMachineSVG(2, 312), art.trashSVG(96), art.shopSceneSVG(1280, 330), art.customerSVG(7, 'happy', 160),
    art.counterSVG(1280, 462), art.freezerSVG('well', 284, 186), art.freezerSVG('rim', 284, 186), art.riserSVG(400, 62),
    ...ALL_IDS.filter((id) => INGREDIENTS.find((i) => i.id === id).layer !== 'base').map((id) => art.scoopSVG(id, 84)),
    ...['plants', 'jukebox', 'seating', 'neon'].map((id) => art.decorSVG(id, 118)),
  ];
  const used = new Set(pictures.flatMap(refs));
  assert.ok(used.size > 10, 'the art uses the shared paints');
  // ids made per picture (uid) live in the picture's own <defs>
  const local = (id) => /^af-(wall|glow|sky|sea|win|torso|logoA|logoB|ctr)-/.test(id);
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
