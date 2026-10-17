// 3D appliance models (js/kitchen3d.js): every state of every model builds, the upgrade levels
// look different, the jug level shows the portions, and the smoothie machine's taps line up with
// the cups the game puts on its drip trays.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ELEV, VIEWS, fitFrame, blenderScene, machineScene, trashScene, freezerScene, blenderLook, blenderJug, jugLevel,
  isAnimated, slushPhase, pourFill, MACHINE_SLOT_X, CUP_Z, TRAY_Y, BLENDER_MODELS, SCENES,
} from '../js/kitchen3d.js';
import { screenOf } from '../js/geo3d.js';
import { SMOOTHIE_SLOT_X, SMOOTHIE_SLOT_Y, SMOOTHIE_CUP_SIZE } from '../js/art.js';
import { getKitchenStats, UPG } from '../js/data.js';

const PASSES = new Set(['shadow', 'opaque', 'decal', 'glass', 'glow']);

function assertScene(scene, name) {
  assert.ok(scene.items.length > 5, `${name}: has parts`);
  assert.equal(scene.elev, ELEV);
  for (const it of scene.items) {
    assert.ok(PASSES.has(it.pass), `${name}: pass ${it.pass}`);
    assert.ok(it.mesh && it.mesh.pos.length > 0 && it.mesh.idx.length % 3 === 0, `${name}: mesh`);
    assert.ok(it.m.every(Number.isFinite), `${name}: finite matrix`);
    assert.ok(it.mat && it.mat.color.every(Number.isFinite) && it.mat.p.every(Number.isFinite), `${name}: material`);
    for (let i = 0; i < it.mesh.pos.length; i++) assert.ok(Number.isFinite(it.mesh.pos[i]), `${name}: vertex`);
  }
}

const BLENDER_STATES = ['empty', 'blending', 'ready', 'overflowing', 'ruined'];

test('every blender model builds in every state', () => {
  for (let tier = 0; tier < 4; tier++) {
    for (const big of [false, true]) {
      for (const state of BLENDER_STATES) {
        for (const base of ['acai', 'pitaya', 'spirulina']) {
          const o = { tier, big, state, base, progress: 0.4, remaining: 3, portions: 1, maxPortions: big ? 3 : 2 };
          assertScene(blenderScene(o, 1.3), `blender ${tier}/${big}/${state}/${base}`);
        }
      }
    }
  }
  // nonsense input still draws an empty Classic
  assertScene(blenderScene({ tier: 99, state: 'boom', base: 'kiwi' }, NaN), 'blender fallback');
});

test('each Turbo-Mixer level is a different model, the big jug is bigger', () => {
  const sig = (o) => blenderScene({ state: 'empty', base: 'acai', ...o }, 0).items.map((it) => `${it.mesh.id}:${it.mat.color.join()}`).join('|');
  const looks = new Set([0, 1, 2, 3].map((tier) => sig({ tier })));
  assert.equal(looks.size, 4, 'four distinct blenders');
  assert.equal(BLENDER_MODELS.length, UPG.blenderSpeed.levels.length + 1, 'a model name per level');
  for (let tier = 0; tier < 4; tier++) {
    const a = blenderJug(tier, false);
    const b = blenderJug(tier, true);
    assert.ok(b.h > a.h && b.rt > a.rt, `big jug of model ${tier} is taller and wider`);
  }
  assert.deepEqual(blenderLook({}), { tier: 0, big: false });
  assert.deepEqual(blenderLook({ blenderSpeed: 2, jug: 1 }), { tier: 2, big: true });
  assert.deepEqual(blenderLook({ blenderSpeed: 7 }), { tier: 3, big: false });
});

test('ready jug: the purée level drops with every pour and never runs dry', () => {
  for (const big of [false, true]) {
    const J = blenderJug(1, big);
    const max = getKitchenStats(big ? { jug: 1 } : {}).portions;
    const levels = [];
    for (let k = max; k >= 1; k--) levels.push(jugLevel(J, k, max));
    for (let i = 1; i < levels.length; i++) assert.ok(levels[i - 1] - levels[i] >= 8, `${big}: ${levels.join(' → ')}`);
    assert.ok(levels.at(-1) > J.floor + 8, 'the last portion is still a clear layer');
    assert.ok(levels[0] < J.top - 6, 'a full jug stays under the lid');
  }
});

test('views: the world origin is inside each canvas, pictures keep their proportions', () => {
  for (const [kind, f] of Object.entries(VIEWS)) {
    assert.ok(f.ax > 0 && f.ax < f.w && f.ay > 0 && f.ay < f.h, `${kind} anchor`);
    const sq = fitFrame(f, 100);
    assert.equal(sq.w, 100);
    assert.ok(Math.abs(sq.zoom / (f.zoom || 1) - 100 / Math.max(f.w, f.h)) < 1e-9, `${kind} zoom`);
  }
  assert.deepEqual(Object.keys(SCENES).sort(), Object.keys(VIEWS).sort());
});

test('smoothie machine: taps above the cups the game puts on the drip trays', () => {
  const f = VIEWS.machine;
  const size = 236; // MACHINE_SIZE in js/game-view.js: the machine element is the canvas
  assert.equal(f.w, size);
  const cup = size * SMOOTHIE_CUP_SIZE;
  for (const n of [1, 2]) {
    MACHINE_SLOT_X[n].forEach((x, i) => {
      assert.ok(Math.abs((f.ax + x) / size - SMOOTHIE_SLOT_X[n][i]) < 0.002, `slot ${i} of ${n}: x`);
      // the cup art's bottom (y = 95 of 100) stands on the tray
      const [, up] = screenOf([x, TRAY_Y, CUP_Z], ELEV);
      const cupBottom = SMOOTHIE_SLOT_Y * size - cup * 0.05;
      assert.ok(Math.abs(f.ay - up - cupBottom) < 1.5, `slot ${i} of ${n}: tray at ${f.ay - up}, cup bottom ${cupBottom}`);
    });
  }
});

test('smoothie machine: fill, churn, then pour – and the cup fills only while pouring', () => {
  assert.equal(slushPhase('empty').fill, 0);
  const start = slushPhase('mixing', 0.02);
  const churn = slushPhase('mixing', 0.3);
  const pour = slushPhase('mixing', 0.8);
  assert.ok(start.fill > 0 && start.pour === 0);
  assert.ok(churn.fill === 1 && churn.churn > 0 && churn.pour === 0);
  assert.ok(pour.pour > 0 && pour.fill < 1);
  assert.ok(slushPhase('ready').fill > 0, 'a little slush stays in the tank');
  assert.equal(pourFill(0.3), 0);
  assert.ok(pourFill(0.7) > 0 && pourFill(0.7) < pourFill(0.9));
  assert.equal(pourFill(1), 1);
  for (const slots of [[{ state: 'empty' }], [{ state: 'mixing', fruit: 'kiwi', progress: 0.8 }, { state: 'ready', fruit: 'mango' }]]) {
    for (const t of [0, 0.7]) assertScene(machineScene({ slots }, t), `machine ${slots.length}`);
  }
  const streams = (p) => machineScene({ slots: [{ state: 'mixing', fruit: 'mango', progress: p }] }, 0).items.filter((it) => it.mat.mode === 8).length;
  assert.equal(streams(0.3), 0, 'no stream while churning');
  assert.equal(streams(0.8), 1, 'a stream while pouring');
});

test('bin and freezer: lid and door move their parts', () => {
  const lidY = (lid) => trashScene({ lid }, 0).items.map((it) => it.m[13]).reduce((a, b) => a + b, 0);
  assertScene(trashScene({ lid: 0 }), 'bin closed');
  assertScene(trashScene({ lid: 1 }), 'bin open');
  assert.notEqual(lidY(0), lidY(1));
  assertScene(freezerScene({ layer: 'back' }), 'freezer cabinet');
  assertScene(freezerScene({ layer: 'front', door: 0 }), 'freezer door');
  const door = (d) => freezerScene({ layer: 'front', door: d }, 0.5).items;
  assert.ok(door(1).length > door(0).length, 'cold air rolls out of an open door');
});

test('animated states and determinism', () => {
  assert.ok(isAnimated('blender', { state: 'blending' }));
  assert.ok(isAnimated('blender', { state: 'overflowing' }));
  assert.ok(!isAnimated('blender', { state: 'ready' }));
  assert.ok(isAnimated('machine', { slots: [{ state: 'empty' }, { state: 'mixing' }] }));
  assert.ok(!isAnimated('machine', { slots: [{ state: 'ready' }] }));
  assert.ok(!isAnimated('freezer', { layer: 'back' }));
  // a scene is a pure function of state and time
  const o = { tier: 2, big: true, state: 'blending', base: 'pitaya', progress: 0.3 };
  const m = (t) => blenderScene(o, t).items.map((it) => [...it.m].join()).join('|');
  assert.equal(m(0.5), m(0.5));
  assert.notEqual(m(0.5), m(0.6), 'the blend moves');
});
