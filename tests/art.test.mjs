// Art module: pure SVG strings – checks the parts the game relies on to communicate state.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blenderSVG } from '../js/art.js';

// y of the top edge of the jug fill (jugFill path: "M<x> <y>H<x>L<x> 102H<x>Z")
function fillTop(svg) {
  const m = svg.match(/d="M[\d.]+ ([\d.]+)H[\d.]+L[\d.]+ 102H[\d.]+Z"/);
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
