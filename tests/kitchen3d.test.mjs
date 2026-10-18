// 3D appliance models (js/kitchen3d.js): every state of every model builds, the upgrade levels
// look different, the jug level shows the portions, the smoothie machine's taps line up with
// the cups the game puts on its drip trays and the chest freezer fills the counter's freezer opening.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ELEV, FREEZER_ELEV, VIEWS, fitFrame, blenderScene, machineScene, trashScene, freezerScene, blenderLook, blenderJug,
  blenderBadgeAt, blenderBox, jugLevel, isAnimated, slushPhase, pourFill, MACHINE_SLOT_X, CUP_Z, TRAY_Y, BLENDER_MODELS, SCENES,
} from '../js/kitchen3d.js';
import { screenOf, viewProjection, transformPoint } from '../js/geo3d.js';
import { SMOOTHIE_SLOT_X, SMOOTHIE_SLOT_Y, SMOOTHIE_CUP_SIZE } from '../js/art.js';
import { getKitchenStats, UPG } from '../js/data.js';

const PASSES = new Set(['shadow', 'opaque', 'decal', 'glass', 'glow']);

function assertScene(scene, name, { elev = ELEV, min = 6 } = {}) {
  assert.ok(scene.items.length >= min, `${name}: has parts`);
  assert.equal(scene.elev, elev);
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
    const ph = f.pic ? f.pic.h : f.h;
    assert.ok(Math.abs(sq.zoom / (f.zoom || 1) - 100 / Math.max(f.w, ph)) < 1e-9, `${kind} zoom`);
    if (f.pic) assert.ok(f.pic.y >= 0 && f.pic.y + f.pic.h <= f.h, `${kind}: the picture rows lie in the canvas`);
  }
  assert.deepEqual(Object.keys(SCENES).sort(), Object.keys(VIEWS).sort());
});

test('smoothie machine: taps above the cups the game puts on the drip trays', () => {
  const f = VIEWS.machine;
  const size = 312; // MACHINE_SIZE in js/game-view.js: the machine element is the canvas
  assert.equal(f.w, size);
  assert.equal(f.h, size, 'a square box like the drawn machine');
  const cup = size * SMOOTHIE_CUP_SIZE;
  for (const n of [1, 2]) {
    MACHINE_SLOT_X[n].forEach((x, i) => {
      assert.ok(Math.abs((f.ax + x * f.zoom) / size - SMOOTHIE_SLOT_X[n][i]) < 0.002, `slot ${i} of ${n}: x`);
      // the cup art's bottom (y = 95 of 100) stands on the tray
      const [, up] = screenOf([x, TRAY_Y, CUP_Z], ELEV, f.zoom);
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

test('bin: the lid moves its parts', () => {
  const lidY = (lid) => trashScene({ lid }, 0).items.map((it) => it.m[13]).reduce((a, b) => a + b, 0);
  assertScene(trashScene({ lid: 0 }), 'bin closed');
  assertScene(trashScene({ lid: 1 }), 'bin open');
  assert.notEqual(lidY(0), lidY(1));
});

// Canvas box (CSS px) of a scene item: every vertex through the scene's camera.
function canvasBox(scene, it) {
  const vp = viewProjection(scene.frame, scene.elev, scene.persp);
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i < it.mesh.pos.length; i += 3) {
    const p = transformPoint(it.m, [it.mesh.pos[i], it.mesh.pos[i + 1], it.mesh.pos[i + 2]]);
    const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
    const x = (((vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12]) / w + 1) / 2) * scene.frame.w;
    const y = ((1 - (vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13]) / w) / 2) * scene.frame.h;
    box[0] = Math.min(box[0], x);
    box[1] = Math.min(box[1], y);
    box[2] = Math.max(box[2], x);
    box[3] = Math.max(box[3], y);
  }
  return box;
}

test('blender: every model in every state fits its canvas and its drag-ghost box, the badge sits on it', () => {
  const { w, h } = VIEWS.blender;
  for (let tier = 0; tier < 4; tier++) {
    for (const big of [false, true]) {
      for (const state of BLENDER_STATES) {
        const ghost = blenderBox(tier, big, state);
        assert.ok(ghost[0] >= 0 && ghost[1] >= 0 && ghost[2] <= w && ghost[3] <= h && ghost[2] - ghost[0] > 100 && ghost[3] - ghost[1] > 180, `ghost box ${ghost}`);
        // the lid an overflowing blender lifts, its foam and drips, the flies of a spoiled one
        for (let t = 0; t < 3; t += 0.1) {
          const scene = blenderScene({ tier, big, state, base: 'acai', progress: 0.5, remaining: 3, portions: 1, maxPortions: big ? 3 : 2 }, t);
          for (const it of scene.items) {
            const [x0, y0, x1, y1] = canvasBox(scene, it);
            const at = `model ${tier}/${big}/${state} at ${t.toFixed(1)}: ${[x0, y0, x1, y1].map((v) => v.toFixed(1))}`;
            // the drag ghost copies all of it that is on the canvas, the soft shadow too
            assert.ok(Math.max(x0, 0) >= ghost[0] && Math.max(y0, 0) >= ghost[1] && Math.min(x1, w) <= ghost[2] && Math.min(y1, h) <= ghost[3], `${at} outside the ghost box ${ghost}`);
            if (it.pass === 'shadow') continue; // a soft blob on a bigger plane
            assert.ok(x0 >= 0 && y0 >= 0 && x1 <= w && y1 <= h, `${at} outside ${w}×${h}`);
          }
        }
      }
      const b = blenderBadgeAt(tier, big);
      assert.ok(b.x > w / 2 && b.x < w && b.y > 0 && b.y < h / 2, `badge of ${tier}/${big} at ${b.x},${b.y}`);
    }
  }
});

test('blender: every model stands equally tall, the big jug taller', () => {
  // top of the lid above the floor centre, in CSS px of the game's canvas
  const top = (tier, big) => {
    const scene = blenderScene({ tier, big, state: 'empty' }, 0);
    return VIEWS.blender.ay - Math.min(...scene.items.filter((it) => it.pass !== 'shadow').map((it) => canvasBox(scene, it)[1]));
  };
  for (const big of [false, true]) {
    const tops = [0, 1, 2, 3].map((tier) => top(tier, big));
    for (const v of tops) assert.ok(Math.abs(v - tops[0]) < 0.5, `${big ? 'big' : 'small'} jugs: lids at ${tops.map((x) => x.toFixed(1))}`);
  }
  // a cup is a 120 px box: about 2× (small) and 2.25× (big) as tall as one, the big jug clearly bigger
  const [small, big] = [top(0, false), top(0, true)];
  assert.ok(small >= 180 && small <= 196 && big >= small + 14 && big <= 216, `lids ${small.toFixed(1)} / ${big.toFixed(1)} px above the floor`);
});

test('chest freezer: seen from above, its frame fills the freezer opening of the counter', () => {
  const back = freezerScene({ layer: 'back' });
  assertScene(back, 'freezer well', { elev: FREEZER_ELEV });
  assert.ok(back.persp && back.persp.d > 0, 'a gentle perspective like the worktop');
  const front = freezerScene({ layer: 'front', door: 0 });
  assertScene(front, 'freezer front edge', { elev: FREEZER_ELEV, min: 1 });
  const mist = (d) => freezerScene({ layer: 'front', door: d }, 0.5).items.length;
  assert.ok(mist(1) > mist(0), 'cold air spills out while a pack is taken');
  assert.equal(mist(0.02), mist(0), 'no cold air at rest');
  // the frame: the full width of the freezer (284 px), from just below the canvas top (8 px above
  // the freezer box) past the canvas bottom, which is the worktop's front edge
  const [x0, y0, x1, y1] = back.items.map((it) => canvasBox(back, it)).reduce((a, b) => ((b[2] - b[0]) > (a[2] - a[0]) ? b : a));
  const { w, h } = VIEWS.freezer;
  assert.ok(Math.abs(x0) < 3 && Math.abs(x1 - w) < 3, `frame spans x ${x0.toFixed(1)}…${x1.toFixed(1)} of ${w}`);
  assert.ok(y0 > 6 && y0 < 14, `frame's back edge at ${y0.toFixed(1)}`);
  assert.ok(y1 >= h, `frame ends at ${y1.toFixed(1)}, above the worktop edge ${h}`);
  // the front layer is the front edge only: it starts below the packs' heads (box y 92 + 8)
  const [, fy0] = canvasBox(front, front.items[0]);
  assert.ok(fy0 > 100, `front edge reaches up to ${fy0.toFixed(1)}`);
});

test('animated states and determinism', () => {
  assert.ok(isAnimated('blender', { state: 'blending' }));
  assert.ok(isAnimated('blender', { state: 'overflowing' }));
  assert.ok(!isAnimated('blender', { state: 'ready' }));
  assert.ok(isAnimated('machine', { slots: [{ state: 'empty' }, { state: 'mixing' }] }));
  assert.ok(!isAnimated('machine', { slots: [{ state: 'ready' }] }));
  assert.ok(!isAnimated('freezer', { layer: 'back' }));
  assert.ok(isAnimated('freezer', { layer: 'front', door: 0.5 }));
  assert.ok(!isAnimated('freezer', { layer: 'front', door: 0 }));
  // a scene is a pure function of state and time
  const o = { tier: 2, big: true, state: 'blending', base: 'pitaya', progress: 0.3 };
  const m = (t) => blenderScene(o, t).items.map((it) => [...it.m].join()).join('|');
  assert.equal(m(0.5), m(0.5));
  assert.notEqual(m(0.5), m(0.6), 'the blend moves');
});
