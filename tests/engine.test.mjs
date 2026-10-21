import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  createGame, tick, drainEvents, loadBlender, toggleBlender, toggleBlenderError, pourBlender, addIngredient, trashBowl, cleanBlender,
  loadMatcha, trashMatcha, serveBowl, serveMatcha, setPaused, releaseTutorialHold, endRun, placeCup,
  loadBlenderError, pourError, addIngredientError, loadMatchaError, serveBowlError, serveMatchaError, placeCupError,
  addMatchaExtra, addMatchaExtraError, matchaMatchesOrder,
  bowlMatchesOrder, moodFor, starsFor, MAX_DT, ARRIVE_TIME, LEAVE_TIME, SEAT_REUSE_DELAY, EARLY_SPAWN_GAP, SPAWN_JITTER,
} from '../js/engine.js';
import {
  INGREDIENTS, LEVELS, START_OWNED, KITCHEN_BASE, ENDLESS_STAGE_SECONDS, PATIENCE_PER_WORK, MAX_MATCHA_EXTRAS,
  TIP_RATE, MAX_BOWL_ITEMS, getKitchenStats, endlessConfig, ingredientValue, matchaValue, orderWork, ownedAt, unlockedIn,
} from '../js/data.js';

const ALL = INGREDIENTS.map((i) => i.id);

function testLevel(over = {}) {
  return {
    id: 99, duration: 60, seats: 2, pace: 1, patience: 20, mid: [1, 1], top: [0, 0],
    matchaChance: 0, drinkOnly: 0, mExtras: [0, 0], goals: [10, 20, 30], overflow: true, hearts: 3, intro: null, ...over,
  };
}

function newGame(opts = {}) {
  const { level, ...rest } = opts;
  return createGame({ mode: 'campaign', level: testLevel(level), owned: ALL, seed: 7, ...rest });
}

// Advance in small steps (tick clamps dt anyway).
function run(game, seconds, step = 0.05) {
  for (let t = 0; t < seconds - 1e-9; t += step) tick(game, Math.min(step, seconds - t));
}

function runUntil(game, pred, limit = 120) {
  for (let t = 0; t < limit; t += 0.05) {
    if (pred()) return true;
    tick(game, 0.05);
  }
  return pred();
}

const customers = (game) => game.seats.filter(Boolean);

function waitForCustomer(game) {
  assert.ok(runUntil(game, () => customers(game).length > 0), 'a customer should arrive');
  return customers(game)[0];
}

const drink = (fruit, extras = []) => ({ fruit, extras });

function setOrder(c, bowl, matcha = null) {
  c.order = { bowl: bowl && { mid: [], top: [], ...bowl }, qty: bowl ? 1 : 0, matcha };
}

// A pack in, the blender switched on.
function startBlender(game, idx = 0, base = 'acai') {
  assert.equal(loadBlender(game, idx, base).ok, true);
  assert.equal(toggleBlender(game, idx).ok, true);
}

function readyBlender(game, idx = 0, base = 'acai') {
  startBlender(game, idx, base);
  run(game, game.kitchen.blendTime + 0.05);
  assert.equal(game.blenders[idx].state, 'ready');
}

// Put cups down in these slots (a slot that already has one is skipped).
function cups(game, ...idxs) {
  for (const i of idxs) if (!game.bowls[i].cup) assert.equal(placeCup(game, i).ok, true);
}

function buildBowl(game, bowlIdx, { base = 'acai', mid = [], top = [] }) {
  if (game.blenders[0].state !== 'ready' && game.blenders[0].state !== 'overflowing') readyBlender(game, 0, base);
  cups(game, bowlIdx);
  assert.equal(pourBlender(game, 0, bowlIdx).ok, true);
  for (const id of [...mid, ...top]) assert.equal(addIngredient(game, bowlIdx, id).ok, true);
}

const types = (events) => events.map((e) => e.type);

// ------------------------------------------------------------------ creation

describe('createGame', () => {
  test('campaign game uses the level as config and sizes everything from the kitchen', () => {
    const kitchen = getKitchenStats({ bowlSlots: 2, blender2: 1, matchaSlots: 1 });
    const g = createGame({ mode: 'campaign', level: LEVELS[39], owned: START_OWNED, kitchen, matcha: true, seed: 3 });
    assert.equal(g.config, LEVELS[39]);
    assert.equal(g.status, 'playing');
    assert.equal(g.time, 0);
    assert.equal(g.duration, LEVELS[39].duration);
    assert.equal(g.closing, false);
    assert.equal(g.seats.length, LEVELS[39].seats);
    assert.ok(g.seats.every((s) => s === null));
    assert.equal(g.bowls.length, 4);
    assert.equal(new Set(g.bowls.map((b) => b.uid)).size, 4);
    for (const b of g.bowls) assert.deepEqual({ ...b, uid: 0 }, { cup: false, base: null, mid: [], top: [], uid: 0 });
    assert.equal(g.blenders.length, 2);
    assert.equal(g.blenders[0].state, 'empty');
    assert.equal(g.blenders[0].maxPortions, kitchen.portions);
    assert.equal(g.matcha.slots.length, 2);
    assert.equal(g.matcha.slots[0].state, 'empty');
    assert.deepEqual(g.matcha.slots[0].extras, []);
    assert.deepEqual(g.lifts, [null, null, null, null], 'no cup lift bought');
    assert.deepEqual(g.blenders.map((b) => b.frozen), [false, false], 'no freeze bought');
    assert.equal(LEVELS[39].seats, 4);
    assert.equal(LEVELS[39].hearts, 4, '4-seat levels give an extra heart');
    assert.equal(g.hearts, LEVELS[39].hearts);
    assert.equal(g.maxHearts, LEVELS[39].hearts);
    assert.equal(g.money, 0);
    assert.deepEqual(g.events, []);
  });

  test('defaults: start ingredients, base kitchen, no matcha machine', () => {
    const g = createGame({ level: LEVELS[0] });
    assert.equal(g.mode, 'campaign');
    assert.deepEqual(g.owned, START_OWNED);
    assert.equal(g.bowls.length, KITCHEN_BASE.bowlSlots);
    assert.equal(g.blenders.length, KITCHEN_BASE.blenders);
    assert.equal(g.matcha, null);
    assert.deepEqual(g.featured, []);
    assert.equal(g.tutorialHold, false);
  });

  test('endless game starts at stage 0 without a time limit', () => {
    const g = createGame({ mode: 'endless', owned: START_OWNED, matcha: true, seed: 1 });
    assert.equal(g.level, null);
    assert.equal(g.duration, null);
    assert.equal(g.stage, 0);
    assert.deepEqual(g.config, endlessConfig(0));
    assert.equal(g.seats.length, endlessConfig(0).seats);
  });

  test('a level id is resolved to the level, which brings its ingredients', () => {
    const g = createGame({ mode: 'campaign', level: 7, seed: 1 });
    assert.equal(g.config, LEVELS[6]);
    assert.deepEqual(g.owned, ownedAt(7));
    assert.ok(g.owned.includes(unlockedIn(7)[0]));
  });

  test('featured and tutorial options are stored', () => {
    const g = newGame({ featured: ['kiwi'], tutorial: true });
    assert.deepEqual(g.featured, ['kiwi']);
    assert.equal(g.tutorialHold, true);
  });
});

// ------------------------------------------------------------------ tick

describe('tick', () => {
  test('clamps dt to MAX_DT and ignores invalid dt', () => {
    const g = newGame();
    tick(g, 5);
    assert.ok(Math.abs(g.time - MAX_DT) < 1e-9);
    tick(g, -1);
    tick(g, NaN);
    assert.ok(Math.abs(g.time - MAX_DT) < 1e-9);
  });

  test('does nothing unless playing', () => {
    const g = newGame();
    setPaused(g, true);
    tick(g, 0.1);
    assert.equal(g.time, 0);
    g.status = 'won';
    tick(g, 0.1);
    assert.equal(g.time, 0);
  });
});

// ------------------------------------------------------------------ blender

describe('blender', () => {
  test('lifecycle: loaded → switched on: blending → ready → overflowing → ruined with events and timings', () => {
    const g = newGame();
    const k = g.kitchen;
    assert.deepEqual(loadBlender(g, 0, 'acai'), { ok: true });
    const b = g.blenders[0];
    assert.equal(b.state, 'loaded');
    assert.equal(b.on, false);
    assert.deepEqual(types(drainEvents(g)), ['blenderLoaded']);
    run(g, 30);
    assert.equal(b.state, 'loaded', 'nothing happens until it is switched on');
    assert.equal(b.progress, 0);
    drainEvents(g);
    assert.deepEqual(toggleBlender(g, 0), { ok: true });
    assert.equal(b.state, 'blending');
    assert.equal(b.on, true);
    assert.equal(b.base, 'acai');
    assert.equal(b.duration, k.blendTime);
    assert.deepEqual(types(drainEvents(g)), ['blenderStart']);

    run(g, k.blendTime / 2);
    assert.ok(Math.abs(b.progress - 0.5) < 0.02, `progress ${b.progress}`);
    assert.ok(Math.abs(b.t - k.blendTime / 2) < 0.02);
    run(g, k.blendTime / 2 - 0.1);
    assert.equal(b.state, 'blending');
    run(g, 0.15);
    assert.equal(b.state, 'ready');
    assert.equal(b.portions, k.portions);
    assert.equal(b.duration, k.readyHold);
    assert.deepEqual(drainEvents(g).filter((e) => e.type.startsWith('blender')), [{ type: 'blenderReady', idx: 0 }]);

    run(g, k.readyHold - 0.1);
    assert.equal(b.state, 'ready');
    run(g, 0.15);
    assert.equal(b.state, 'overflowing');
    assert.equal(b.duration, k.overflowTime);
    assert.ok(drainEvents(g).some((e) => e.type === 'blenderOverflow' && e.idx === 0));

    run(g, k.overflowTime - 0.1);
    assert.equal(b.state, 'overflowing');
    run(g, 0.15);
    assert.equal(b.state, 'ruined');
    assert.equal(b.on, false);
    assert.ok(drainEvents(g).some((e) => e.type === 'blenderRuined' && e.idx === 0 && !e.melted));
    run(g, 30);
    assert.equal(b.state, 'ruined');
  });

  test('switched off while blending it pauses, switched on again it goes on where it stopped', () => {
    const g = newGame();
    const k = g.kitchen;
    startBlender(g);
    const b = g.blenders[0];
    run(g, k.blendTime / 2);
    drainEvents(g);
    assert.deepEqual(toggleBlender(g, 0), { ok: true });
    assert.equal(b.state, 'loaded');
    assert.ok(Math.abs(b.progress - 0.5) < 0.02);
    assert.deepEqual(drainEvents(g), [{ type: 'blenderStop', idx: 0 }]);
    run(g, 20);
    assert.ok(Math.abs(b.progress - 0.5) < 0.02, 'paused');
    toggleBlender(g, 0);
    assert.equal(b.state, 'blending');
    run(g, k.blendTime / 2 + 0.1);
    assert.equal(b.state, 'ready');
  });

  test('switched off when ready it cannot overflow, but the base melts after meltTime', () => {
    const g = newGame();
    const k = g.kitchen;
    readyBlender(g);
    const b = g.blenders[0];
    run(g, k.readyHold - 1);
    drainEvents(g);
    assert.deepEqual(toggleBlender(g, 0), { ok: true });
    assert.equal(b.state, 'ready');
    assert.equal(b.on, false);
    assert.equal(b.duration, k.meltTime);
    assert.deepEqual(drainEvents(g), [{ type: 'blenderStop', idx: 0, done: true }]);
    assert.deepEqual(toggleBlender(g, 0), { ok: false, reason: 'blenderDone' }, 'nothing left to blend');
    run(g, k.meltTime - 0.1);
    assert.equal(b.state, 'ready');
    assert.ok(!drainEvents(g).some((e) => e.type === 'blenderOverflow'));
    run(g, 0.2);
    assert.equal(b.state, 'ruined');
    assert.ok(drainEvents(g).some((e) => e.type === 'blenderRuined' && e.melted));
  });

  test('an overflowing blender switched off stops overflowing and still pours', () => {
    const g = newGame();
    const k = g.kitchen;
    readyBlender(g);
    run(g, k.readyHold + 0.2);
    assert.equal(g.blenders[0].state, 'overflowing');
    toggleBlender(g, 0);
    assert.equal(g.blenders[0].state, 'ready');
    run(g, k.overflowTime + 1);
    assert.equal(g.blenders[0].state, 'ready');
    cups(g, 0);
    assert.equal(pourBlender(g, 0, 0).ok, true);
  });

  test('freeze: a frozen blender switched off keeps its base for good; only the first freeze blenders', () => {
    const g = newGame({ kitchen: getKitchenStats({ blender2: 1, freeze: 1 }) });
    assert.deepEqual(g.blenders.map((b) => b.frozen), [true, false]);
    readyBlender(g, 0);
    readyBlender(g, 1);
    toggleBlender(g, 0);
    toggleBlender(g, 1);
    run(g, g.kitchen.meltTime + 5);
    assert.equal(g.blenders[0].state, 'ready');
    assert.equal(g.blenders[0].duration, 0);
    assert.equal(g.blenders[1].state, 'ruined');
    assert.deepEqual(createGame({ level: LEVELS[0], kitchen: getKitchenStats({ blender2: 1, freeze: 2 }) }).blenders.map((b) => b.frozen), [true, true]);
  });

  test('a frozen blender left on still overflows', () => {
    const g = newGame({ kitchen: getKitchenStats({ freeze: 1 }) });
    readyBlender(g);
    run(g, g.kitchen.readyHold + g.kitchen.overflowTime + 0.3);
    assert.equal(g.blenders[0].state, 'ruined');
  });

  test('the switch: nothing to switch on an empty or spoiled blender; the last portion switches it off', () => {
    const g = newGame();
    assert.deepEqual(toggleBlender(g, 0), { ok: false, reason: 'blenderEmpty' });
    assert.deepEqual(toggleBlender(g, 3), { ok: false, reason: 'invalid' });
    readyBlender(g);
    cups(g, 0, 1);
    pourBlender(g, 0, 0);
    pourBlender(g, 0, 1);
    assert.equal(g.blenders[0].state, 'empty');
    assert.equal(g.blenders[0].on, false);
    readyBlender(g);
    run(g, g.kitchen.readyHold + g.kitchen.overflowTime + 0.3);
    assert.deepEqual(toggleBlender(g, 0), { ok: false, reason: 'blenderRuined' });
    for (const idx of [0, 3]) assert.equal(toggleBlenderError(g, idx), toggleBlender(g, idx).reason);
  });

  test('with overflow: false a ready blender stays ready forever, on or off', () => {
    const g = newGame({ level: { overflow: false, duration: 999 } });
    readyBlender(g);
    run(g, 60);
    assert.equal(g.blenders[0].state, 'ready');
    toggleBlender(g, 0);
    run(g, 60);
    assert.equal(g.blenders[0].state, 'ready');
    assert.ok(!drainEvents(g).some((e) => e.type === 'blenderOverflow'));
  });

  test('loadBlender rejects busy blenders, non-bases and unowned bases', () => {
    const g = newGame({ owned: START_OWNED });
    assert.deepEqual(loadBlender(g, 0, 'banana'), { ok: false, reason: 'wrongLayer' });
    assert.deepEqual(loadBlender(g, 0, 'pitaya'), { ok: false, reason: 'notOwned' });
    assert.deepEqual(loadBlender(g, 0, 'nope'), { ok: false, reason: 'wrongLayer' });
    assert.equal(loadBlender(g, 0, 'acai').ok, true);
    assert.deepEqual(loadBlender(g, 0, 'acai'), { ok: false, reason: 'blenderBusy' });
    run(g, g.kitchen.blendTime + 0.1);
    assert.deepEqual(loadBlender(g, 0, 'acai'), { ok: false, reason: 'blenderBusy' });
    assert.equal(loadBlender(g, 5, 'acai').ok, false);
  });

  test('loadBlender on a ruined blender says "spoiled" (not "busy") until it is trashed', () => {
    const g = newGame({ owned: START_OWNED });
    const k = g.kitchen;
    startBlender(g);
    run(g, k.blendTime + k.readyHold + k.overflowTime + 0.3);
    assert.equal(g.blenders[0].state, 'ruined');
    drainEvents(g);
    assert.deepEqual(loadBlender(g, 0, 'acai'), { ok: false, reason: 'blenderRuined' });
    assert.deepEqual(loadBlender(g, 0, 'banana'), { ok: false, reason: 'wrongLayer' });
    assert.deepEqual(loadBlender(g, 0, 'pitaya'), { ok: false, reason: 'notOwned' });
    assert.equal(g.blenders[0].state, 'ruined');
    assert.deepEqual(drainEvents(g), []);
    assert.equal(cleanBlender(g, 0).ok, true);
    assert.equal(loadBlender(g, 0, 'acai').ok, true);
  });

  test('pour uses portions and empties the blender after the last one', () => {
    const g = newGame({ kitchen: getKitchenStats({ bowlSlots: 1, jug: 1 }) });
    readyBlender(g);
    cups(g, 0, 1, 2);
    drainEvents(g);
    assert.equal(g.blenders[0].portions, 3);
    assert.deepEqual(pourBlender(g, 0, 0), { ok: true });
    assert.equal(g.bowls[0].base, 'acai');
    assert.equal(g.blenders[0].portions, 2);
    assert.deepEqual(drainEvents(g), [{ type: 'basePoured', bowlIdx: 0, blenderIdx: 0 }]);
    assert.deepEqual(pourBlender(g, 0, 0), { ok: false, reason: 'bowlHasBase' });
    assert.equal(pourBlender(g, 0, 1).ok, true);
    assert.equal(pourBlender(g, 0, 2).ok, true);
    const b = g.blenders[0];
    assert.equal(b.state, 'empty');
    assert.equal(b.base, null);
    assert.equal(b.portions, 0);
    assert.deepEqual(types(drainEvents(g)), ['basePoured', 'basePoured', 'blenderEmpty']);
  });

  test('pour rejects blenders that are empty, blending or ruined; overflowing still pours', () => {
    const g = newGame();
    cups(g, 0, 1);
    assert.deepEqual(pourBlender(g, 0, 0), { ok: false, reason: 'blenderNotReady' });
    loadBlender(g, 0, 'acai');
    assert.deepEqual(pourBlender(g, 0, 0), { ok: false, reason: 'blenderNotReady' });
    toggleBlender(g, 0);
    assert.deepEqual(pourBlender(g, 0, 0), { ok: false, reason: 'blenderNotReady' });
    run(g, g.kitchen.blendTime + g.kitchen.readyHold + 0.2);
    assert.equal(g.blenders[0].state, 'overflowing');
    assert.equal(pourBlender(g, 0, 0).ok, true);
    run(g, g.kitchen.overflowTime + 0.1);
    assert.equal(g.blenders[0].state, 'ruined');
    assert.deepEqual(pourBlender(g, 0, 1), { ok: false, reason: 'blenderRuined' });
  });

  test('cleanBlender empties loaded, ruined, ready and overflowing blenders, not a running blend', () => {
    const g = newGame();
    assert.deepEqual(cleanBlender(g, 0), { ok: false, reason: 'blenderNotReady' });
    loadBlender(g, 0, 'acai');
    assert.equal(cleanBlender(g, 0).ok, true, 'a wrong pack comes out again');
    drainEvents(g);
    startBlender(g);
    assert.deepEqual(cleanBlender(g, 0), { ok: false, reason: 'blenderBusy' });
    run(g, g.kitchen.blendTime + 0.1);
    drainEvents(g);
    assert.deepEqual(cleanBlender(g, 0), { ok: true });
    assert.equal(g.blenders[0].state, 'empty');
    assert.deepEqual(drainEvents(g), [{ type: 'blenderEmpty', idx: 0 }, { type: 'trash', what: 'blender', idx: 0 }]);
    readyBlender(g);
    run(g, g.kitchen.readyHold + g.kitchen.overflowTime + 0.2);
    assert.equal(g.blenders[0].state, 'ruined');
    assert.equal(cleanBlender(g, 0).ok, true);
    assert.equal(g.blenders[0].state, 'empty');
    assert.equal(loadBlender(g, 0, 'acai').ok, true);
  });
});

// ------------------------------------------------------------------ bowls

describe('bowl building', () => {
  test('a cup goes down first: slots start empty, a second cup is rejected', () => {
    const g = newGame();
    assert.ok(g.bowls.every((b) => b.cup === false));
    readyBlender(g);
    drainEvents(g);
    assert.deepEqual(pourBlender(g, 0, 0), { ok: false, reason: 'noCup' });
    assert.deepEqual(addIngredient(g, 0, 'banana'), { ok: false, reason: 'noCup' });
    assert.equal(g.blenders[0].portions, g.blenders[0].maxPortions, 'nothing was poured onto the counter');
    assert.deepEqual(placeCup(g, 0), { ok: true });
    assert.equal(g.bowls[0].cup, true);
    assert.equal(g.bowls[1].cup, false);
    assert.deepEqual(drainEvents(g), [{ type: 'cupPlaced', bowlIdx: 0 }]);
    assert.deepEqual(placeCup(g, 0), { ok: false, reason: 'cupThere' });
    assert.deepEqual(placeCup(g, 7), { ok: false, reason: 'invalid' });
    assert.deepEqual(drainEvents(g), []);
    assert.deepEqual(pourBlender(g, 0, 0), { ok: true });
    assert.deepEqual(placeCup(g, 0), { ok: false, reason: 'cupThere' });
  });

  test('layer rules: owned, wrong layer, base first, no duplicates', () => {
    const g = newGame({ owned: START_OWNED });
    assert.deepEqual(addIngredient(g, 0, 'kiwi'), { ok: false, reason: 'notOwned' });
    assert.deepEqual(addIngredient(g, 0, 'acai'), { ok: false, reason: 'wrongLayer' });
    assert.deepEqual(addIngredient(g, 0, 'banana'), { ok: false, reason: 'noCup' });
    cups(g, 0);
    assert.deepEqual(addIngredient(g, 0, 'banana'), { ok: false, reason: 'needBase' });
    assert.deepEqual(addIngredient(g, 0, 'honey'), { ok: false, reason: 'needBase' });
    readyBlender(g);
    pourBlender(g, 0, 0);
    drainEvents(g);
    assert.deepEqual(addIngredient(g, 0, 'banana'), { ok: true });
    assert.deepEqual(drainEvents(g), [{ type: 'ingredientAdded', bowlIdx: 0, id: 'banana' }]);
    assert.deepEqual(addIngredient(g, 0, 'banana'), { ok: false, reason: 'alreadyAdded' });
    assert.deepEqual(g.bowls[0].mid, ['banana']);
  });

  test('toppings need at least one fruit/crunch first (every order has one)', () => {
    const g = newGame({ owned: START_OWNED });
    readyBlender(g);
    cups(g, 0);
    pourBlender(g, 0, 0);
    drainEvents(g);
    assert.deepEqual(addIngredient(g, 0, 'honey'), { ok: false, reason: 'toppingsOnTop' });
    assert.deepEqual(drainEvents(g), []);
    assert.deepEqual(g.bowls[0].top, []);
    assert.deepEqual(addIngredient(g, 0, 'granola'), { ok: true });
    assert.deepEqual(addIngredient(g, 0, 'honey'), { ok: true });
    assert.deepEqual(g.bowls[0], { cup: true, base: 'acai', mid: ['granola'], top: ['honey'], uid: g.bowls[0].uid });
  });

  test('fruits cannot go on top of toppings, but toppings can follow toppings', () => {
    const g = newGame();
    buildBowl(g, 0, { mid: ['banana'], top: ['honey'] });
    assert.deepEqual(addIngredient(g, 0, 'granola'), { ok: false, reason: 'toppingsOnTop' });
    assert.deepEqual(addIngredient(g, 0, 'coconut'), { ok: true });
    assert.deepEqual(addIngredient(g, 0, 'honey'), { ok: false, reason: 'alreadyAdded' });
    assert.deepEqual(g.bowls[0], { cup: true, base: 'acai', mid: ['banana'], top: ['honey', 'coconut'], uid: g.bowls[0].uid });
  });

  test('at most MAX_BOWL_ITEMS items on top of the base', () => {
    const g = newGame();
    const mids = ['banana', 'granola', 'strawberry', 'blueberry', 'mango', 'kiwi'];
    buildBowl(g, 0, { mid: mids.slice(0, MAX_BOWL_ITEMS) });
    assert.deepEqual(addIngredient(g, 0, 'honey'), { ok: false, reason: 'bowlFull' });
    assert.equal(g.bowls[0].mid.length + g.bowls[0].top.length, MAX_BOWL_ITEMS);
  });

  test('trashBowl throws the cup away with its contents and resets the slot with a new uid', () => {
    const g = newGame();
    buildBowl(g, 0, { mid: ['banana'] });
    const uid = g.bowls[0].uid;
    drainEvents(g);
    assert.deepEqual(trashBowl(g, 0), { ok: true });
    assert.equal(g.bowls[0].cup, false);
    assert.deepEqual(g.bowls[0].base, null);
    assert.deepEqual(g.bowls[0].mid, []);
    assert.notEqual(g.bowls[0].uid, uid);
    assert.ok(!g.bowls.some((b, i) => i !== 0 && b.uid === g.bowls[0].uid));
    assert.deepEqual(drainEvents(g), [{ type: 'trash', what: 'bowl', idx: 0 }]);
    // trashing an empty slot is harmless
    const uid2 = g.bowls[0].uid;
    assert.deepEqual(trashBowl(g, 0), { ok: true });
    assert.equal(g.bowls[0].uid, uid2);
    assert.deepEqual(drainEvents(g), []);
    // an empty cup goes into the trash too
    cups(g, 0);
    drainEvents(g);
    assert.deepEqual(trashBowl(g, 0), { ok: true });
    assert.equal(g.bowls[0].cup, false);
    assert.deepEqual(drainEvents(g), [{ type: 'trash', what: 'bowl', idx: 0 }]);
  });

  test('bowlMatchesOrder ignores order within a layer but not the layer', () => {
    const order = { base: 'acai', mid: ['banana', 'granola'], top: ['honey'] };
    assert.equal(bowlMatchesOrder({ base: 'acai', mid: ['granola', 'banana'], top: ['honey'] }, order), true);
    assert.equal(bowlMatchesOrder({ base: 'pitaya', mid: ['granola', 'banana'], top: ['honey'] }, order), false);
    assert.equal(bowlMatchesOrder({ base: 'acai', mid: ['banana'], top: ['honey'] }, order), false);
    assert.equal(bowlMatchesOrder({ base: 'acai', mid: ['banana', 'granola'], top: [] }, order), false);
    assert.equal(bowlMatchesOrder({ base: 'acai', mid: ['banana', 'granola'], top: ['honey', 'chia'] }, order), false);
    assert.equal(bowlMatchesOrder({ base: null, mid: [], top: [] }, { base: null, mid: [], top: [] }), false);
  });
});

// ------------------------------------------------------------------ customers

describe('customers', () => {
  test('first customer arrives at ~1 s, the next pace × the order\'s work later; arriving → waiting', () => {
    const g = newGame({ level: { pace: 1.5, seats: 3 } });
    run(g, 0.9);
    assert.equal(customers(g).length, 0);
    run(g, 0.2);
    const c = customers(g)[0];
    assert.ok(c, 'customer at 1 s');
    assert.equal(c.state, 'arriving');
    assert.equal(c.mood, 'happy');
    assert.deepEqual(c.delivered, { bowl: false, bowls: 0, matcha: false });
    assert.equal(typeof c.look.seed, 'number');
    assert.equal(c.paid, 0);
    const ev = drainEvents(g).find((e) => e.type === 'customerArrive');
    assert.deepEqual(ev, { type: 'customerArrive', customerId: c.id, seat: c.seat });
    run(g, ARRIVE_TIME - 0.15);
    assert.equal(c.state, 'arriving');
    assert.equal(c.patience, c.maxPatience);
    run(g, 0.2);
    assert.equal(c.state, 'waiting');
    const gap = g._sim.nextSpawn - g._sim.lastSpawn;
    const work = orderWork(c.order);
    assert.ok(gap >= 1.5 * work * (1 - SPAWN_JITTER) - 1e-9 && gap <= 1.5 * work * (1 + SPAWN_JITTER) + 1e-9, `gap ${gap}`);
    run(g, g._sim.nextSpawn - g.time - 0.1);
    assert.equal(customers(g).length, 1);
    run(g, 0.2);
    assert.equal(customers(g).length, 2);
    assert.notEqual(customers(g)[0].seat, customers(g)[1].seat);
  });

  test('a bigger order buys more time until the next guest', () => {
    const gaps = (mid, top) => {
      const g = newGame({ level: { mid, top, pace: 2 } });
      waitForCustomer(g);
      return g._sim.nextSpawn - g._sim.lastSpawn;
    };
    assert.ok(gaps([3, 3], [3, 3]) > gaps([1, 1], [0, 0]) * 1.3);
  });

  test('nobody waiting → the next guest comes early (EARLY_SPAWN_GAP after the last)', () => {
    const g = newGame({ level: { pace: 99, patience: 60 } });
    const c = waitForCustomer(g);
    setOrder(c, { base: 'acai', mid: ['banana'] });
    buildBowl(g, 0, { mid: ['banana'] });
    assert.equal(serveBowl(g, 0, c.id).ok, true);
    const t0 = g._sim.lastSpawn;
    assert.ok(runUntil(g, () => customers(g).some((o) => o.id !== c.id), 30));
    assert.ok(g._sim.lastSpawn >= t0 + EARLY_SPAWN_GAP - 1e-9);
    assert.ok(g._sim.lastSpawn < 20, 'long before pace × work');
  });

  test('crowd 2: the next guest comes early as soon as fewer than two are waiting', () => {
    const g = newGame({ level: { pace: 99, patience: 99, seats: 3, crowd: 2 } });
    const c = waitForCustomer(g);
    assert.ok(runUntil(g, () => customers(g).length === 2, 10), 'a second guest comes soon');
    const t2 = g.time;
    run(g, 20);
    assert.equal(customers(g).length, 2, 'two are waiting: no third one before pace × work');
    assert.ok(g.time - t2 >= 20 - 1e-9);
    const one = newGame({ level: { pace: 99, patience: 99, seats: 3 } });
    waitForCustomer(one);
    run(one, 20);
    assert.equal(customers(one).length, 1, 'crowd 1 (the default): one guest at a time');
  });

  test('from level 10 on two guests wait at the same time', () => {
    for (const l of LEVELS) assert.equal(l.crowd, l.id >= 10 ? 2 : 1, `level ${l.id}`);
  });

    test('customers take a random free seat', () => {
    const seats = new Set();
    for (let seed = 1; seed <= 20; seed++) {
      const g = newGame({ seed, level: { seats: 4 } });
      seats.add(waitForCustomer(g).seat);
    }
    assert.ok(seats.size >= 3, `seats used: ${[...seats]}`);
  });

  test('maxPatience = (patience + PATIENCE_PER_WORK × work) × patienceMult', () => {
    const kitchen = getKitchenStats({ plants: 1, jukebox: 1 });
    const g = newGame({ kitchen, level: { patience: 40 } });
    const c = waitForCustomer(g);
    assert.ok(Math.abs(c.maxPatience - (40 + PATIENCE_PER_WORK * orderWork(c.order)) * kitchen.patienceMult) < 1e-9);

    const g2 = newGame({ kitchen, matcha: true, level: { patience: 40, matchaChance: 1 } });
    const c2 = waitForCustomer(g2);
    assert.ok(c2.order.matcha);
    assert.ok(c2.maxPatience > c.maxPatience, 'a drink on top buys patience');
    assert.ok(Math.abs(c2.maxPatience - (40 + PATIENCE_PER_WORK * orderWork(c2.order)) * kitchen.patienceMult) < 1e-9);
  });

  test('patience drains 1/s while waiting and mood follows the ratio', () => {
    const g = newGame({ level: { patience: 20, pace: 99 } });
    const c = waitForCustomer(g);
    run(g, ARRIVE_TIME + 0.05);
    const p0 = c.patience;
    run(g, 2);
    assert.ok(Math.abs(p0 - c.patience - 2) < 0.06);
    run(g, c.maxPatience * 0.5 - 2 - 0.05);
    assert.equal(c.mood, 'neutral');
    assert.equal(moodFor(0.61), 'happy');
    assert.equal(moodFor(0.6), 'neutral');
    assert.equal(moodFor(0.31), 'neutral');
    assert.equal(moodFor(0.3), 'impatient');
    assert.equal(moodFor(0.13), 'impatient');
    assert.equal(moodFor(0.12), 'angry');
  });

  test('patience 0 → leaves angry, heart lost, seat frees after the leave animation', () => {
    const g = newGame({ level: { patience: 5, pace: 99 } });
    const c = waitForCustomer(g);
    drainEvents(g);
    run(g, ARRIVE_TIME + c.maxPatience + 0.1);
    assert.equal(c.state, 'leavingAngry');
    assert.equal(c.mood, 'angry');
    assert.equal(g.hearts, 2);
    assert.equal(g.lost, 1);
    // (nobody is waiting any more, so the next guest is on the way already)
    assert.deepEqual(drainEvents(g).filter((e) => e.type !== 'customerArrive'), [{ type: 'customerLost', customerId: c.id, seat: c.seat }]);
    assert.equal(g.seats[c.seat], c);
    run(g, LEAVE_TIME);
    assert.equal(g.seats[c.seat], null);
    assert.equal(g.status, 'playing');
  });

  test('a full counter delays the next spawn until a seat has been free for a moment', () => {
    const g = newGame({ level: { seats: 1, pace: 0.1, patience: 99 } });
    const c = waitForCustomer(g);
    run(g, 5);
    assert.equal(customers(g).length, 1);
    setOrder(c, { base: 'acai', mid: ['banana'] });
    buildBowl(g, 0, { mid: ['banana'] });
    assert.equal(serveBowl(g, 0, c.id).ok, true);
    run(g, LEAVE_TIME + 0.05);
    assert.equal(g.seats[0], null);
    run(g, SEAT_REUSE_DELAY - 0.15);
    assert.equal(g.seats[0], null);
    run(g, 0.2);
    assert.ok(g.seats[0] && g.seats[0].id !== c.id);
  });
});

// ------------------------------------------------------------------ serving

describe('serving bowls', () => {
  test('correct bowl pays value + tip and resets the bowl', () => {
    const g = newGame({ level: { pace: 99, patience: 30 }, ingLevels: { acai: 1 } });
    const c = waitForCustomer(g);
    setOrder(c, { base: 'acai', mid: ['banana', 'granola'], top: ['honey'] });
    buildBowl(g, 1, { mid: ['granola', 'banana'], top: ['honey'] });
    const uid = g.bowls[1].uid;
    drainEvents(g);
    const ratio = c.patience / c.maxPatience;
    const value = ingredientValue('acai', { acai: 1 }) + 2 + 2 + 1;
    assert.deepEqual(serveBowl(g, 1, c.id), { ok: true });
    const amount = Math.round(value);
    const tip = Math.round(value * TIP_RATE * ratio);
    assert.equal(g.money, amount + tip);
    assert.equal(c.paid, amount + tip);
    assert.equal(c.state, 'leavingHappy');
    assert.equal(c.delivered.bowl, true);
    assert.equal(g.served, 1);
    assert.notEqual(g.bowls[1].uid, uid);
    assert.equal(g.bowls[1].base, null);
    assert.equal(g.bowls[1].cup, false, 'the served cup leaves the counter; the slot needs a new one');
    assert.deepEqual(drainEvents(g), [{ type: 'customerPaid', customerId: c.id, seat: c.seat, amount, tip }]);
  });

  test('an order for the same bowl twice: each bowl counts, the second one pays for both', () => {
    const g = newGame({ level: { pace: 99, patience: 60 } });
    const c = waitForCustomer(g);
    setOrder(c, { base: 'acai', mid: ['banana'] });
    c.order.qty = 2;
    buildBowl(g, 0, { mid: ['banana'] });
    buildBowl(g, 1, { mid: ['banana'] });
    drainEvents(g);
    assert.deepEqual(serveBowl(g, 0, c.id), { ok: true });
    assert.deepEqual(c.delivered, { bowl: false, bowls: 1, matcha: false });
    assert.deepEqual(drainEvents(g), [{ type: 'partialDelivery', customerId: c.id }]);
    assert.equal(g.money, 0);
    const ratio = c.patience / c.maxPatience;
    assert.deepEqual(serveBowl(g, 1, c.id), { ok: true });
    assert.equal(c.delivered.bowl, true);
    const value = 2 * (ingredientValue('acai') + ingredientValue('banana'));
    assert.equal(g.money, Math.round(value) + Math.round(value * TIP_RATE * ratio));
    assert.equal(c.state, 'leavingHappy');
  });

    test('wrong bowl is rejected and stays; empty bowl and missing customer are rejected', () => {
    const g = newGame({ level: { pace: 99 } });
    const c = waitForCustomer(g);
    setOrder(c, { base: 'acai', mid: ['banana'] });
    assert.deepEqual(serveBowl(g, 0, c.id), { ok: false, reason: 'emptyBowl' });
    buildBowl(g, 0, { mid: ['granola'] });
    const before = structuredClone(g.bowls[0]);
    assert.deepEqual(serveBowl(g, 0, c.id), { ok: false, reason: 'wrongOrder' });
    assert.deepEqual(g.bowls[0], before);
    assert.equal(g.money, 0);
    assert.deepEqual(serveBowl(g, 0, 12345), { ok: false, reason: 'noCustomer' });
  });

  test('customers can be served while still arriving, not while leaving', () => {
    const g = newGame({ level: { pace: 99 }, kitchen: { ...getKitchenStats({}), blendTime: 0.2 } });
    readyBlender(g);
    const c = waitForCustomer(g);
    assert.equal(c.state, 'arriving');
    setOrder(c, { base: 'acai', mid: ['banana'] });
    buildBowl(g, 0, { mid: ['banana'] });
    assert.equal(serveBowl(g, 0, c.id).ok, true);
    buildBowl(g, 1, { mid: ['banana'] });
    assert.deepEqual(serveBowl(g, 1, c.id), { ok: false, reason: 'noCustomer' });
  });

  test('partial delivery adds 15% patience (capped) and the second part completes the order', () => {
    const g = newGame({ matcha: true, level: { pace: 99, patience: 40 } });
    const c = waitForCustomer(g);
    setOrder(c, { base: 'acai', mid: ['banana'] }, drink('mBanana'));
    run(g, 12);
    buildBowl(g, 0, { mid: ['banana'] });
    const before = c.patience;
    drainEvents(g);
    assert.equal(serveBowl(g, 0, c.id).ok, true);
    assert.ok(Math.abs(c.patience - Math.min(c.maxPatience, before + 0.15 * c.maxPatience)) < 1e-9);
    assert.deepEqual(drainEvents(g), [{ type: 'partialDelivery', customerId: c.id }]);
    assert.equal(c.state, 'waiting');
    assert.equal(g.money, 0);
    buildBowl(g, 1, { mid: ['banana'] });
    assert.deepEqual(serveBowl(g, 1, c.id), { ok: false, reason: 'alreadyDelivered' });

    assert.equal(loadMatcha(g, 0, 'mBanana').ok, true);
    run(g, g.kitchen.matchaTime + 0.1);
    const ratio = c.patience / c.maxPatience;
    assert.deepEqual(serveMatcha(g, 0, c.id), { ok: true });
    const value = ingredientValue('acai') + ingredientValue('banana') + matchaValue(drink('mBanana'));
    assert.equal(g.money, Math.round(value) + Math.round(value * TIP_RATE * ratio));
    assert.equal(c.state, 'leavingHappy');
    assert.equal(g.matcha.slots[0].state, 'empty');
  });

  test('partial delivery bonus never exceeds max patience', () => {
    const g = newGame({ matcha: true, level: { pace: 99, patience: 40 } });
    const c = waitForCustomer(g);
    setOrder(c, { base: 'acai', mid: ['banana'] }, drink('mBanana'));
    buildBowl(g, 0, { mid: ['banana'] });
    assert.equal(serveBowl(g, 0, c.id).ok, true);
    assert.equal(c.patience, c.maxPatience);
  });
});

// ------------------------------------------------------------------ matcha

describe('matcha', () => {
  test('a matcha fruit on an empty glass: mixing (purée, then the matcha) → ready; rejects', () => {
    const g = newGame({ matcha: true, owned: [...START_OWNED, 'mStrawberry', 'ice'] });
    assert.deepEqual(loadMatcha(g, 0, 'granola'), { ok: false, reason: 'notMatchaFruit' });
    assert.deepEqual(loadMatcha(g, 0, 'banana'), { ok: false, reason: 'notMatchaFruit' }, 'bowl fruit stays on the bowl side');
    assert.deepEqual(loadMatcha(g, 0, 'mBanana'), { ok: false, reason: 'notOwned' });
    assert.deepEqual(loadMatcha(g, 0, 'ice'), { ok: false, reason: 'fruitFirst' });
    assert.deepEqual(loadMatcha(g, 0, 'mStrawberry'), { ok: true });
    const s = g.matcha.slots[0];
    assert.equal(s.state, 'mixing');
    assert.equal(s.fruit, 'mStrawberry');
    assert.deepEqual(s.extras, []);
    assert.equal(s.duration, g.kitchen.matchaTime);
    assert.deepEqual(loadMatcha(g, 0, 'mStrawberry'), { ok: false, reason: 'slotBusy' });
    assert.deepEqual(drainEvents(g), [{ type: 'matchaStart', idx: 0 }]);
    run(g, g.kitchen.matchaTime - 0.1);
    assert.equal(g.matcha.slots[0].state, 'mixing');
    run(g, 0.15);
    assert.equal(g.matcha.slots[0].state, 'ready');
    assert.ok(drainEvents(g).some((e) => e.type === 'matchaReady' && e.idx === 0));
    assert.deepEqual(loadMatcha(g, 0, 'mStrawberry'), { ok: false, reason: 'slotBusy' });
  });

  test('extras go on a glass with its fruit – while it mixes or when ready – once each', () => {
    const g = newGame({ matcha: true, owned: ALL });
    assert.deepEqual(addMatchaExtra(g, 0, 'ice'), { ok: false, reason: 'fruitFirst' });
    loadMatcha(g, 0, 'mMango');
    drainEvents(g);
    assert.deepEqual(addMatchaExtra(g, 0, 'ice'), { ok: true });
    assert.deepEqual(drainEvents(g), [{ type: 'extraAdded', idx: 0, id: 'ice' }]);
    assert.deepEqual(addMatchaExtra(g, 0, 'ice'), { ok: false, reason: 'alreadyAdded' });
    assert.deepEqual(addMatchaExtra(g, 0, 'mBanana'), { ok: false, reason: 'notMatchaFruit' });
    run(g, g.kitchen.matchaTime + 0.1);
    assert.deepEqual(loadMatcha(g, 0, 'foam'), { ok: true }, 'loadMatcha passes an extra on');
    assert.deepEqual(g.matcha.slots[0].extras, ['ice', 'foam']);
    assert.deepEqual(addMatchaExtra(g, 0, 'vanilla'), { ok: true });
    assert.equal(g.matcha.slots[0].extras.length, MAX_MATCHA_EXTRAS);
    const g2 = newGame({ matcha: true, owned: [...START_OWNED, 'mMango'] });
    loadMatcha(g2, 0, 'mMango');
    assert.deepEqual(addMatchaExtra(g2, 0, 'ice'), { ok: false, reason: 'notOwned' });
  });

  test('no machine → loadMatcha fails', () => {
    const g = newGame({ matcha: false });
    assert.equal(g.matcha, null);
    assert.equal(loadMatcha(g, 0, 'mBanana').ok, false);
  });

  test('serveMatcha checks readiness, wish, fruit and extras', () => {
    const g = newGame({ matcha: true, level: { seats: 2, pace: 0.2 } });
    assert.ok(runUntil(g, () => customers(g).length === 2));
    const [a, b] = customers(g);
    setOrder(a, { base: 'acai', mid: ['banana'] }, drink('mBanana', ['ice']));
    setOrder(b, { base: 'acai', mid: ['banana'] }, null);
    loadMatcha(g, 0, 'mBanana');
    assert.deepEqual(serveMatcha(g, 0, a.id), { ok: false, reason: 'notReady' });
    run(g, g.kitchen.matchaTime + 0.1);
    assert.deepEqual(serveMatcha(g, 0, b.id), { ok: false, reason: 'noMatchaWanted' });
    assert.deepEqual(serveMatcha(g, 0, a.id), { ok: false, reason: 'drinkIncomplete' });
    a.order.matcha = drink('mStrawberry', ['ice']);
    assert.deepEqual(serveMatcha(g, 0, a.id), { ok: false, reason: 'wrongOrder' });
    a.order.matcha = drink('mBanana', []);
    addMatchaExtra(g, 0, 'ice');
    assert.deepEqual(serveMatcha(g, 0, a.id), { ok: false, reason: 'wrongOrder' }, 'an extra too many');
    a.order.matcha = drink('mBanana', ['ice']);
    assert.equal(matchaMatchesOrder(g.matcha.slots[0], a.order.matcha), true);
    assert.deepEqual(serveMatcha(g, 0, a.id), { ok: true });
    assert.equal(a.delivered.matcha, true);
    assert.deepEqual(g.matcha.slots[0].extras, [], 'the slot is empty again');
    loadMatcha(g, 0, 'mBanana');
    run(g, g.kitchen.matchaTime + 0.1);
    assert.deepEqual(serveMatcha(g, 0, a.id), { ok: false, reason: 'alreadyDelivered' });
  });

  test('a drink-only order is complete with the drink', () => {
    const g = newGame({ matcha: true, level: { pace: 99, patience: 40 } });
    const c = waitForCustomer(g);
    setOrder(c, null, drink('mBanana'));
    assert.deepEqual(serveBowl(g, 0, c.id), { ok: false, reason: 'noBowlWanted' });
    loadMatcha(g, 0, 'mBanana');
    run(g, g.kitchen.matchaTime + 0.1);
    assert.deepEqual(serveMatcha(g, 0, c.id), { ok: true });
    assert.equal(c.state, 'leavingHappy');
    assert.ok(g.money >= matchaValue(drink('mBanana')));
  });

  test('trashMatcha empties a slot', () => {
    const g = newGame({ matcha: true });
    loadMatcha(g, 0, 'mBanana');
    addMatchaExtra(g, 0, 'ice');
    drainEvents(g);
    assert.deepEqual(trashMatcha(g, 0), { ok: true });
    assert.equal(g.matcha.slots[0].state, 'empty');
    assert.equal(g.matcha.slots[0].fruit, null);
    assert.deepEqual(g.matcha.slots[0].extras, []);
    assert.deepEqual(drainEvents(g), [{ type: 'trash', what: 'matcha', idx: 0 }]);
    assert.deepEqual(trashMatcha(g, 0), { ok: true });
    assert.deepEqual(drainEvents(g), []);
  });
});

// ------------------------------------------------------------------ cup lift

describe('cup lift', () => {
  test('every spot with a lift gets a cup cupLiftTime after it is empty, all at once; spots without wait', () => {
    const k = getKitchenStats({ bowlSlots: 1, cupLift: 2 });
    const g = newGame({ kitchen: k, level: { pace: 99 } });
    assert.equal(g.lifts.length, 3);
    assert.equal(g.lifts[2], null);
    tick(g, 0.05);
    assert.deepEqual(g.lifts.slice(0, 2).map((l) => l.state), ['rising', 'rising']);
    assert.deepEqual(drainEvents(g).filter((e) => e.type === 'liftStart').map((e) => e.bowlIdx), [0, 1]);
    run(g, k.cupLiftTime - 0.2);
    assert.deepEqual(g.bowls.map((b) => b.cup), [false, false, false], 'not instant');
    assert.ok(g.lifts[0].progress > 0.8 && g.lifts[0].progress < 1);
    run(g, 0.25);
    assert.deepEqual(g.bowls.map((b) => b.cup), [true, true, false]);
    assert.ok(drainEvents(g).some((e) => e.type === 'cupPlaced' && e.bowlIdx === 1 && e.auto));
    assert.ok(k.cupLiftTime > 0.5 && k.cupLiftTime < 1.5, 'quick, but not instant');
  });

  test('a cup put down by hand meanwhile stops the lift', () => {
    const g = newGame({ kitchen: getKitchenStats({ cupLift: 1 }), level: { pace: 99 } });
    tick(g, 0.05);
    assert.equal(placeCup(g, 0).ok, true);
    drainEvents(g);
    tick(g, 0.05);
    assert.equal(g.lifts[0].state, 'idle');
    assert.deepEqual(drainEvents(g).map((e) => e.type), ['liftCancel']);
  });

  test('a served or trashed bowl leaves its spot empty: the lift refills it', () => {
    const g = newGame({ kitchen: getKitchenStats({ cupLift: 2 }), level: { pace: 99 } });
    run(g, g.kitchen.cupLiftTime + 0.2);
    assert.deepEqual(g.bowls.map((b) => b.cup), [true, true]);
    trashBowl(g, 1);
    assert.equal(g.bowls[1].cup, false);
    run(g, g.kitchen.cupLiftTime + 0.2);
    assert.equal(g.bowls[1].cup, true);
  });
});

// ------------------------------------------------------------------ level end

describe('level end', () => {
  test('hearts 0 ends the game immediately as lost, gameOver fires once', () => {
    const g = newGame({ level: { patience: -15, seats: 2, pace: 0.1, hearts: 3 } });
    assert.ok(runUntil(g, () => g.status !== 'playing', 60));
    assert.equal(g.status, 'lost');
    assert.equal(g.hearts, 0);
    assert.equal(g.lost, 3);
    assert.equal(g.result, 'lost');
    assert.equal(g.endReason, 'hearts');
    const overs = drainEvents(g).filter((e) => e.type === 'gameOver');
    assert.deepEqual(overs, [{ type: 'gameOver', result: 'lost', stars: 0, reason: 'hearts' }]);
    run(g, 5);
    assert.deepEqual(drainEvents(g), []);
    assert.equal(loadBlender(g, 0, 'acai').ok, false);
  });

  test('closing time stops spawns; level ends when the last customer has left', () => {
    const g = newGame({ level: { duration: 10, pace: 99, patience: 60, goals: [5, 10, 15] } });
    const c = waitForCustomer(g);
    setOrder(c, { base: 'acai', mid: ['banana'] });
    run(g, 10);
    assert.equal(g.closing, true);
    assert.equal(g.status, 'playing');
    const evs = drainEvents(g);
    assert.equal(evs.filter((e) => e.type === 'closingTime').length, 1);
    run(g, 10);
    assert.equal(customers(g).length, 1, 'no new customers after closing');
    assert.equal(g.status, 'playing');
    buildBowl(g, 0, { mid: ['banana'] });
    serveBowl(g, 0, c.id);
    const money = g.money;
    run(g, LEAVE_TIME + 0.1);
    assert.equal(g.status, 'won');
    assert.equal(g.stars, starsFor(money, [5, 10, 15]));
    const over = drainEvents(g).filter((e) => e.type === 'gameOver');
    assert.deepEqual(over, [{ type: 'gameOver', result: 'won', stars: g.stars, reason: null }]);
    assert.equal(drainEvents(g).length, 0);
  });

  test('missing the first goal loses the level with reason "goal"', () => {
    const g = newGame({ level: { duration: 3, pace: 99, patience: 2, goals: [50, 60, 70] } });
    assert.ok(runUntil(g, () => g.status !== 'playing', 30));
    assert.equal(g.status, 'lost');
    assert.equal(g.stars, 0);
    assert.equal(g.endReason, 'goal');
    assert.deepEqual(drainEvents(g).filter((e) => e.type === 'gameOver'), [
      { type: 'gameOver', result: 'lost', stars: 0, reason: 'goal' },
    ]);
  });

  test('stars count reached goals', () => {
    assert.equal(starsFor(0, [10, 20, 30]), 0);
    assert.equal(starsFor(10, [10, 20, 30]), 1);
    assert.equal(starsFor(29, [10, 20, 30]), 2);
    assert.equal(starsFor(31, [10, 20, 30]), 3);
  });

  test('won level with all three goals gets 3 stars', () => {
    const g = newGame({ level: { duration: 4, pace: 99, patience: 60, goals: [1, 2, 3] } });
    const c = waitForCustomer(g);
    setOrder(c, { base: 'acai', mid: ['banana'] });
    buildBowl(g, 0, { mid: ['banana'] });
    serveBowl(g, 0, c.id);
    assert.ok(runUntil(g, () => g.status !== 'playing', 30));
    assert.equal(g.status, 'won');
    assert.equal(g.stars, 3);
  });
});

// ------------------------------------------------------------------ endless

describe('endless', () => {
  test('stage rises every ENDLESS_STAGE_SECONDS, config updates and seats grow', () => {
    const g = createGame({ mode: 'endless', owned: ALL, matcha: true, seed: 5 });
    g.config = { ...g.config, patience: 1e6 };
    // keep customers from leaving: huge patience for the first stage
    run(g, ENDLESS_STAGE_SECONDS - 0.2);
    assert.equal(g.stage, 0);
    drainEvents(g);
    run(g, 0.3);
    assert.equal(g.stage, 1);
    assert.deepEqual(g.config, endlessConfig(1));
    assert.equal(g.seats.length, endlessConfig(1).seats);
    assert.deepEqual(drainEvents(g).filter((e) => e.type === 'stageUp'), [{ type: 'stageUp', stage: 1 }]);
    assert.equal(g.duration, null);
    assert.equal(g.closing, false);
  });

  test('seats never shrink and only hearts end the run', () => {
    const g = createGame({ mode: 'endless', owned: START_OWNED, seed: 9 });
    g.seats.push(null, null);
    g._sim.seatFreeAt.push(-Infinity, -Infinity);
    g.time = ENDLESS_STAGE_SECONDS * 2 - 0.01;
    tick(g, 0.05);
    assert.equal(g.stage, 2);
    assert.equal(g.seats.length, 4);
    assert.ok(runUntil(g, () => g.status !== 'playing', 600));
    assert.equal(g.status, 'lost');
    assert.equal(g.endReason, 'hearts');
    assert.equal(g.hearts, 0);
  });
});

// ------------------------------------------------------------------ tutorial, pause, events

describe('tutorial hold', () => {
  test('first customer comes, nobody else, no drain, clock waits; release → next in 2 s', () => {
    const g = newGame({ tutorial: true, level: { pace: 0.5, patience: 10 } });
    const c = waitForCustomer(g);
    const t0 = g.time;
    run(g, 30);
    assert.equal(customers(g).length, 1);
    assert.equal(c.patience, c.maxPatience);
    assert.equal(c.state, 'waiting');
    assert.equal(g.time, t0, 'level clock paused during the tutorial');
    // stations keep working during the tutorial
    startBlender(g);
    run(g, g.kitchen.blendTime + 0.1);
    assert.equal(g.blenders[0].state, 'ready');

    releaseTutorialHold(g);
    assert.equal(g.tutorialHold, false);
    run(g, 1.9);
    assert.equal(customers(g).length, 1);
    assert.ok(c.patience < c.maxPatience);
    run(g, 0.2);
    assert.equal(customers(g).length, 2);
  });
});

describe('pause and events', () => {
  test('setPaused toggles playing/paused and blocks actions', () => {
    const g = newGame();
    setPaused(g, true);
    assert.equal(g.status, 'paused');
    assert.deepEqual(loadBlender(g, 0, 'acai'), { ok: false, reason: 'notPlaying' });
    run(g, 5);
    assert.equal(g.time, 0);
    setPaused(g, false);
    assert.equal(g.status, 'playing');
    tick(g, 0.05);
    assert.ok(g.time > 0);
    setPaused(g);
    assert.equal(g.status, 'paused');
    setPaused(g);
    assert.equal(g.status, 'playing');
    g.status = 'won';
    setPaused(g, false);
    assert.equal(g.status, 'won');
  });

  test('drainEvents returns queued events and clears the queue', () => {
    const g = newGame();
    loadBlender(g, 0, 'acai');
    const evs = drainEvents(g);
    assert.deepEqual(evs, [{ type: 'blenderLoaded', idx: 0 }]);
    assert.deepEqual(drainEvents(g), []);
    assert.equal(g.events.length, 0);
  });
});

describe('endRun (endless quit)', () => {
  test('a paused endless run ends lost/quit with one gameOver event', () => {
    const g = createGame({ mode: 'endless', owned: START_OWNED, seed: 3 });
    run(g, 2);
    g.money = 420;
    setPaused(g, true);
    drainEvents(g);
    assert.equal(endRun(g), true);
    assert.equal(g.status, 'lost');
    assert.equal(g.result, 'lost');
    assert.equal(g.endReason, 'quit');
    assert.equal(g.stars, 0);
    assert.equal(g.money, 420);
    assert.deepEqual(drainEvents(g), [{ type: 'gameOver', result: 'lost', stars: 0, reason: 'quit' }]);
    const t0 = g.time;
    run(g, 5);
    assert.equal(g.time, t0, 'the finished run stays frozen');
    setPaused(g, false);
    assert.equal(g.status, 'lost');
  });

  test('no-op for campaign games and runs that already ended', () => {
    const c = newGame();
    assert.equal(endRun(c), false);
    assert.equal(c.status, 'playing');
    assert.equal(c.result, null);
    const e = createGame({ mode: 'endless', owned: START_OWNED, seed: 3 });
    assert.equal(endRun(e), true);
    drainEvents(e);
    assert.equal(endRun(e), false);
    assert.deepEqual(drainEvents(e), []);
  });
});

describe('action checks (*Error)', () => {
  // Every check must report exactly the reason its action rejects with (null when it succeeds).
  const same = (check, action) => {
    const reason = check();
    const r = action();
    assert.equal(reason, r.ok ? null : r.reason);
    return reason;
  };

  test('blender: loadBlenderError / pourError mirror loadBlender / pourBlender', () => {
    const g = newGame({ owned: ['acai', 'banana', 'honey'] });
    assert.equal(same(() => placeCupError(g, 5), () => placeCup(g, 5)), 'invalid');
    assert.equal(same(() => placeCupError(g, 0), () => placeCup(g, 0)), null);
    assert.equal(same(() => placeCupError(g, 0), () => placeCup(g, 0)), 'cupThere');
    assert.equal(same(() => loadBlenderError(g, 5, 'acai'), () => loadBlender(g, 5, 'acai')), 'invalid');
    assert.equal(same(() => loadBlenderError(g, 0, 'banana'), () => loadBlender(g, 0, 'banana')), 'wrongLayer');
    assert.equal(same(() => loadBlenderError(g, 0, 'pitaya'), () => loadBlender(g, 0, 'pitaya')), 'notOwned');
    assert.equal(same(() => pourError(g, 0, 0), () => pourBlender(g, 0, 0)), 'blenderNotReady');
    assert.equal(same(() => loadBlenderError(g, 0, 'acai'), () => loadBlender(g, 0, 'acai')), null);
    assert.equal(same(() => loadBlenderError(g, 0, 'acai'), () => loadBlender(g, 0, 'acai')), 'blenderBusy');
    assert.equal(same(() => toggleBlenderError(g, 0), () => toggleBlender(g, 0)), null);
    run(g, g.kitchen.blendTime + 0.05);
    assert.equal(same(() => pourError(g, 0, 0), () => pourBlender(g, 0, 0)), null);
    assert.equal(same(() => pourError(g, 0, 0), () => pourBlender(g, 0, 0)), 'bowlHasBase');
    g.blenders[0].state = 'ready';
    assert.equal(same(() => pourError(g, 0, 1), () => pourBlender(g, 0, 1)), 'noCup');
    g.blenders[0].state = 'ruined';
    assert.equal(same(() => pourError(g, 0, 1), () => pourBlender(g, 0, 1)), 'blenderRuined');
    setPaused(g, true);
    assert.equal(same(() => placeCupError(g, 1), () => placeCup(g, 1)), 'notPlaying');
    assert.equal(same(() => loadBlenderError(g, 0, 'acai'), () => loadBlender(g, 0, 'acai')), 'notPlaying');
    assert.equal(pourError(g, 0, 1), 'notPlaying');
  });

  test('bowl: addIngredientError mirrors addIngredient', () => {
    const g = newGame({ owned: ['acai', 'banana', 'granola', 'strawberry', 'blueberry', 'mango', 'kiwi', 'honey', 'coconut', 'mBanana', 'ice'] });
    const chk = (bowl, id) => same(() => addIngredientError(g, bowl, id), () => addIngredient(g, bowl, id));
    assert.equal(chk(9, 'banana'), 'invalid');
    assert.equal(chk(0, 'mint'), 'notOwned');
    assert.equal(chk(0, 'acai'), 'wrongLayer');
    assert.equal(chk(0, 'banana'), 'noCup');
    g.bowls[0].cup = true;
    assert.equal(chk(0, 'banana'), 'needBase');
    g.bowls[0].base = 'acai';
    assert.equal(chk(0, 'banana'), null);
    assert.equal(chk(0, 'banana'), 'alreadyAdded');
    assert.equal(chk(0, 'honey'), null);
    assert.equal(chk(0, 'granola'), 'toppingsOnTop');
    g.bowls[1].cup = true;
    g.bowls[1].base = 'acai';
    for (const id of ['banana', 'granola', 'strawberry', 'blueberry', 'mango', 'kiwi']) assert.equal(chk(1, id), null);
    assert.equal(chk(1, 'coconut'), 'bowlFull');
    assert.equal(chk(0, 'mBanana'), 'matchaItem', 'the matcha bar\'s fruit is not for bowls');
    assert.equal(chk(0, 'ice'), 'matchaItem');
  });

  test('matcha + serving: loadMatchaError / serveBowlError / serveMatchaError mirror their actions', () => {
    const g = newGame({ owned: ALL, matcha: true });
    assert.equal(same(() => loadMatchaError(g, 3, 'mBanana'), () => loadMatcha(g, 3, 'mBanana')), 'invalid');
    assert.equal(same(() => loadMatchaError(g, 0, 'granola'), () => loadMatcha(g, 0, 'granola')), 'notMatchaFruit');
    assert.equal(same(() => loadMatchaError(g, 0, 'ice'), () => loadMatcha(g, 0, 'ice')), 'fruitFirst');
    assert.equal(same(() => loadMatchaError(g, 0, 'mBanana'), () => loadMatcha(g, 0, 'mBanana')), null);
    assert.equal(same(() => loadMatchaError(g, 0, 'mMango'), () => loadMatcha(g, 0, 'mMango')), 'slotBusy');
    assert.equal(same(() => loadMatchaError(g, 0, 'ice'), () => loadMatcha(g, 0, 'ice')), null);
    assert.equal(same(() => addMatchaExtraError(g, 0, 'ice'), () => addMatchaExtra(g, 0, 'ice')), 'alreadyAdded');

    const c = waitForCustomer(g);
    setOrder(c, { base: 'acai', mid: ['banana'] }, drink('mBlueberry'));
    assert.equal(same(() => serveMatchaError(g, 0, c.id), () => serveMatcha(g, 0, c.id)), 'notReady');
    run(g, g.kitchen.matchaTime + 0.05);
    assert.equal(same(() => serveMatchaError(g, 0, c.id), () => serveMatcha(g, 0, c.id)), 'wrongOrder');
    assert.equal(same(() => serveBowlError(g, 0, c.id), () => serveBowl(g, 0, c.id)), 'emptyBowl');
    g.bowls[0].base = 'acai';
    assert.equal(same(() => serveBowlError(g, 0, c.id), () => serveBowl(g, 0, c.id)), 'wrongOrder');
    g.bowls[0].mid.push('banana');
    assert.equal(same(() => serveBowlError(g, 0, c.id), () => serveBowl(g, 0, c.id)), null);
    g.bowls[1].base = 'acai';
    g.bowls[1].mid.push('banana');
    assert.equal(same(() => serveBowlError(g, 1, c.id), () => serveBowl(g, 1, c.id)), 'alreadyDelivered');
    assert.equal(same(() => serveBowlError(g, 1, 999), () => serveBowl(g, 1, 999)), 'noCustomer');
    c.order.matcha = null;
    assert.equal(same(() => serveMatchaError(g, 0, c.id), () => serveMatcha(g, 0, c.id)), 'noMatchaWanted');
  });
});

describe('determinism', () => {
  function script(seed) {
    const g = createGame({ mode: 'campaign', level: LEVELS[9], owned: ALL, matcha: true, seed });
    const log = [];
    for (let i = 0; i < 1200; i++) {
      tick(g, 0.05);
      if (i % 40 === 0) loadBlender(g, 0, 'acai');
      if (i % 40 === 1) toggleBlender(g, 0);
      if (i % 50 === 0) placeCup(g, (i / 50) % 2);
      if (i % 50 === 0) pourBlender(g, 0, (i / 50) % 2);
      if (i % 120 === 0) trashBowl(g, 0);
      log.push(...drainEvents(g));
    }
    const { _sim, ...state } = g;
    return JSON.stringify({ state, log });
  }

  test('same seed → identical run, different seed → different customers', () => {
    assert.equal(script(42), script(42));
    assert.notEqual(script(42), script(43));
  });
});
