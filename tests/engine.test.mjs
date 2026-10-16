import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  createGame, tick, drainEvents, loadBlender, pourBlender, addIngredient, trashBowl, cleanBlender,
  loadSmoothie, trashSmoothie, serveBowl, serveSmoothie, setPaused, releaseTutorialHold,
  bowlMatchesOrder, moodFor, starsFor, MAX_DT, ARRIVE_TIME, LEAVE_TIME, SEAT_REUSE_DELAY,
} from '../js/engine.js';
import {
  INGREDIENTS, LEVELS, START_OWNED, KITCHEN_BASE, ENDLESS_STAGE_SECONDS, SMOOTHIE_PATIENCE_BONUS,
  TIP_RATE, MAX_BOWL_ITEMS, getKitchenStats, endlessConfig, ingredientValue, smoothieValue,
} from '../js/data.js';

const ALL = INGREDIENTS.map((i) => i.id);

function testLevel(over = {}) {
  return {
    id: 99, duration: 60, seats: 2, spawnGap: [5, 5], patience: 20, mid: [1, 1], top: [0, 0],
    smoothieChance: 0, goals: [10, 20, 30], overflow: true, hearts: 3, intro: null, ...over,
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

function setOrder(c, bowl, smoothie = null) {
  c.order = { bowl: { mid: [], top: [], ...bowl }, smoothie };
}

function readyBlender(game, idx = 0, base = 'acai') {
  assert.equal(loadBlender(game, idx, base).ok, true);
  run(game, game.kitchen.blendTime + 0.05);
  assert.equal(game.blenders[idx].state, 'ready');
}

function buildBowl(game, bowlIdx, { base = 'acai', mid = [], top = [] }) {
  if (game.blenders[0].state !== 'ready' && game.blenders[0].state !== 'overflowing') readyBlender(game, 0, base);
  assert.equal(pourBlender(game, 0, bowlIdx).ok, true);
  for (const id of [...mid, ...top]) assert.equal(addIngredient(game, bowlIdx, id).ok, true);
}

const types = (events) => events.map((e) => e.type);

// ------------------------------------------------------------------ creation

describe('createGame', () => {
  test('campaign game uses the level as config and sizes everything from the kitchen', () => {
    const kitchen = getKitchenStats({ bowlSlots: 2, blender2: 1, smoothieSlots: 1 });
    const g = createGame({ mode: 'campaign', level: LEVELS[11], owned: START_OWNED, kitchen, smoothies: true, seed: 3 });
    assert.equal(g.config, LEVELS[11]);
    assert.equal(g.status, 'playing');
    assert.equal(g.time, 0);
    assert.equal(g.duration, LEVELS[11].duration);
    assert.equal(g.closing, false);
    assert.equal(g.seats.length, LEVELS[11].seats);
    assert.ok(g.seats.every((s) => s === null));
    assert.equal(g.bowls.length, 4);
    assert.equal(new Set(g.bowls.map((b) => b.uid)).size, 4);
    for (const b of g.bowls) assert.deepEqual({ ...b, uid: 0 }, { base: null, mid: [], top: [], uid: 0 });
    assert.equal(g.blenders.length, 2);
    assert.equal(g.blenders[0].state, 'empty');
    assert.equal(g.blenders[0].maxPortions, kitchen.portions);
    assert.equal(g.smoothie.slots.length, 2);
    assert.equal(g.smoothie.slots[0].state, 'empty');
    assert.equal(g.hearts, 3);
    assert.equal(g.maxHearts, 3);
    assert.equal(g.money, 0);
    assert.deepEqual(g.events, []);
  });

  test('defaults: start ingredients, base kitchen, no smoothie machine', () => {
    const g = createGame({ level: LEVELS[0] });
    assert.equal(g.mode, 'campaign');
    assert.deepEqual(g.owned, START_OWNED);
    assert.equal(g.bowls.length, KITCHEN_BASE.bowlSlots);
    assert.equal(g.blenders.length, KITCHEN_BASE.blenders);
    assert.equal(g.smoothie, null);
    assert.deepEqual(g.featured, []);
    assert.equal(g.tutorialHold, false);
  });

  test('endless game starts at stage 0 without a time limit', () => {
    const g = createGame({ mode: 'endless', owned: START_OWNED, smoothies: true, seed: 1 });
    assert.equal(g.level, null);
    assert.equal(g.duration, null);
    assert.equal(g.stage, 0);
    assert.deepEqual(g.config, endlessConfig(0));
    assert.equal(g.seats.length, endlessConfig(0).seats);
  });

  test('a level id is resolved to the level', () => {
    const g = createGame({ mode: 'campaign', level: 7, seed: 1 });
    assert.equal(g.config, LEVELS[6]);
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
  test('lifecycle: blending → ready → overflowing → ruined with events and timings', () => {
    const g = newGame();
    const k = g.kitchen;
    assert.deepEqual(loadBlender(g, 0, 'acai'), { ok: true });
    const b = g.blenders[0];
    assert.equal(b.state, 'blending');
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
    assert.ok(drainEvents(g).some((e) => e.type === 'blenderRuined' && e.idx === 0));
    run(g, 30);
    assert.equal(b.state, 'ruined');
  });

  test('with overflow: false a ready blender stays ready forever', () => {
    const g = newGame({ level: { overflow: false, duration: 999 } });
    readyBlender(g);
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

  test('pour uses portions and empties the blender after the last one', () => {
    const g = newGame({ kitchen: getKitchenStats({ bowlSlots: 1, jug: 1 }) });
    readyBlender(g);
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
    assert.deepEqual(pourBlender(g, 0, 0), { ok: false, reason: 'blenderNotReady' });
    loadBlender(g, 0, 'acai');
    assert.deepEqual(pourBlender(g, 0, 0), { ok: false, reason: 'blenderNotReady' });
    run(g, g.kitchen.blendTime + g.kitchen.readyHold + 0.2);
    assert.equal(g.blenders[0].state, 'overflowing');
    assert.equal(pourBlender(g, 0, 0).ok, true);
    run(g, g.kitchen.overflowTime + 0.1);
    assert.equal(g.blenders[0].state, 'ruined');
    assert.deepEqual(pourBlender(g, 0, 1), { ok: false, reason: 'blenderRuined' });
  });

  test('cleanBlender empties ruined, ready and overflowing blenders only', () => {
    const g = newGame();
    assert.deepEqual(cleanBlender(g, 0), { ok: false, reason: 'blenderNotReady' });
    loadBlender(g, 0, 'acai');
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
  test('layer rules: owned, wrong layer, base first, no duplicates', () => {
    const g = newGame({ owned: START_OWNED });
    assert.deepEqual(addIngredient(g, 0, 'kiwi'), { ok: false, reason: 'notOwned' });
    assert.deepEqual(addIngredient(g, 0, 'acai'), { ok: false, reason: 'wrongLayer' });
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

  test('fruits cannot go on top of toppings, but toppings can follow toppings', () => {
    const g = newGame();
    buildBowl(g, 0, { mid: ['banana'], top: ['honey'] });
    assert.deepEqual(addIngredient(g, 0, 'granola'), { ok: false, reason: 'toppingsOnTop' });
    assert.deepEqual(addIngredient(g, 0, 'coconut'), { ok: true });
    assert.deepEqual(addIngredient(g, 0, 'honey'), { ok: false, reason: 'alreadyAdded' });
    assert.deepEqual(g.bowls[0], { base: 'acai', mid: ['banana'], top: ['honey', 'coconut'], uid: g.bowls[0].uid });
  });

  test('at most MAX_BOWL_ITEMS items on top of the base', () => {
    const g = newGame();
    const mids = ['banana', 'granola', 'strawberry', 'blueberry', 'mango', 'kiwi'];
    buildBowl(g, 0, { mid: mids.slice(0, MAX_BOWL_ITEMS) });
    assert.deepEqual(addIngredient(g, 0, 'honey'), { ok: false, reason: 'bowlFull' });
    assert.equal(g.bowls[0].mid.length + g.bowls[0].top.length, MAX_BOWL_ITEMS);
  });

  test('trashBowl resets the bowl with a new uid', () => {
    const g = newGame();
    buildBowl(g, 0, { mid: ['banana'] });
    const uid = g.bowls[0].uid;
    drainEvents(g);
    assert.deepEqual(trashBowl(g, 0), { ok: true });
    assert.deepEqual(g.bowls[0].base, null);
    assert.deepEqual(g.bowls[0].mid, []);
    assert.notEqual(g.bowls[0].uid, uid);
    assert.ok(!g.bowls.some((b, i) => i !== 0 && b.uid === g.bowls[0].uid));
    assert.deepEqual(drainEvents(g), [{ type: 'trash', what: 'bowl', idx: 0 }]);
    // trashing an empty bowl is harmless
    const uid2 = g.bowls[0].uid;
    assert.deepEqual(trashBowl(g, 0), { ok: true });
    assert.equal(g.bowls[0].uid, uid2);
    assert.deepEqual(drainEvents(g), []);
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
  test('first customer arrives at ~1 s, then after spawnGap; arriving → waiting', () => {
    const g = newGame({ level: { spawnGap: [5, 5] } });
    run(g, 0.9);
    assert.equal(customers(g).length, 0);
    run(g, 0.2);
    const c = customers(g)[0];
    assert.ok(c, 'customer at 1 s');
    assert.equal(c.state, 'arriving');
    assert.equal(c.mood, 'happy');
    assert.deepEqual(c.delivered, { bowl: false, smoothie: false });
    assert.equal(typeof c.look.seed, 'number');
    assert.equal(c.paid, 0);
    const ev = drainEvents(g).find((e) => e.type === 'customerArrive');
    assert.deepEqual(ev, { type: 'customerArrive', customerId: c.id, seat: c.seat });
    run(g, ARRIVE_TIME - 0.15);
    assert.equal(c.state, 'arriving');
    assert.equal(c.patience, c.maxPatience);
    run(g, 0.2);
    assert.equal(c.state, 'waiting');
    run(g, 5 - ARRIVE_TIME - 0.2);
    assert.equal(customers(g).length, 1);
    run(g, 0.3);
    assert.equal(customers(g).length, 2);
    assert.notEqual(customers(g)[0].seat, customers(g)[1].seat);
  });

  test('customers take a random free seat', () => {
    const seats = new Set();
    for (let seed = 1; seed <= 20; seed++) {
      const g = newGame({ seed, level: { seats: 4 } });
      seats.add(waitForCustomer(g).seat);
    }
    assert.ok(seats.size >= 3, `seats used: ${[...seats]}`);
  });

  test('maxPatience = patience × patienceMult (+ bonus with smoothie)', () => {
    const kitchen = getKitchenStats({ plants: 1, jukebox: 1 });
    const g = newGame({ kitchen, level: { patience: 40 } });
    const c = waitForCustomer(g);
    assert.ok(Math.abs(c.maxPatience - 40 * kitchen.patienceMult) < 1e-9);

    const g2 = newGame({ kitchen, smoothies: true, level: { patience: 40, smoothieChance: 1 } });
    const c2 = waitForCustomer(g2);
    assert.ok(c2.order.smoothie);
    assert.ok(Math.abs(c2.maxPatience - (40 * kitchen.patienceMult + SMOOTHIE_PATIENCE_BONUS)) < 1e-9);
  });

  test('patience drains 1/s while waiting and mood follows the ratio', () => {
    const g = newGame({ level: { patience: 20, spawnGap: [99, 99] } });
    const c = waitForCustomer(g);
    run(g, ARRIVE_TIME + 0.05);
    const p0 = c.patience;
    run(g, 2);
    assert.ok(Math.abs(p0 - c.patience - 2) < 0.06);
    run(g, 20 * 0.5 - 2 - 0.05);
    assert.equal(c.mood, 'neutral');
    assert.equal(moodFor(0.61), 'happy');
    assert.equal(moodFor(0.6), 'neutral');
    assert.equal(moodFor(0.31), 'neutral');
    assert.equal(moodFor(0.3), 'impatient');
    assert.equal(moodFor(0.13), 'impatient');
    assert.equal(moodFor(0.12), 'angry');
  });

  test('patience 0 → leaves angry, heart lost, seat frees after the leave animation', () => {
    const g = newGame({ level: { patience: 5, spawnGap: [99, 99] } });
    const c = waitForCustomer(g);
    drainEvents(g);
    run(g, ARRIVE_TIME + 5 + 0.1);
    assert.equal(c.state, 'leavingAngry');
    assert.equal(c.mood, 'angry');
    assert.equal(g.hearts, 2);
    assert.equal(g.lost, 1);
    assert.deepEqual(drainEvents(g), [{ type: 'customerLost', customerId: c.id, seat: c.seat }]);
    assert.equal(g.seats[c.seat], c);
    run(g, LEAVE_TIME);
    assert.equal(g.seats[c.seat], null);
    assert.equal(g.status, 'playing');
  });

  test('a full counter delays the next spawn until a seat has been free for a moment', () => {
    const g = newGame({ level: { seats: 1, spawnGap: [1, 1], patience: 99 } });
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
    const g = newGame({ level: { spawnGap: [99, 99], patience: 30 }, ingLevels: { acai: 1 } });
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
    assert.deepEqual(drainEvents(g), [{ type: 'customerPaid', customerId: c.id, seat: c.seat, amount, tip }]);
  });

  test('wrong bowl is rejected and stays; empty bowl and missing customer are rejected', () => {
    const g = newGame({ level: { spawnGap: [99, 99] } });
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
    const g = newGame({ level: { spawnGap: [99, 99] }, kitchen: { ...getKitchenStats({}), blendTime: 0.2 } });
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
    const g = newGame({ smoothies: true, level: { spawnGap: [99, 99], patience: 40 } });
    const c = waitForCustomer(g);
    setOrder(c, { base: 'acai', mid: ['banana'] }, 'banana');
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

    assert.equal(loadSmoothie(g, 0, 'banana').ok, true);
    run(g, g.kitchen.smoothieTime + 0.1);
    const ratio = c.patience / c.maxPatience;
    assert.deepEqual(serveSmoothie(g, 0, c.id), { ok: true });
    const value = ingredientValue('acai') + ingredientValue('banana') + smoothieValue('banana');
    assert.equal(g.money, Math.round(value) + Math.round(value * TIP_RATE * ratio));
    assert.equal(c.state, 'leavingHappy');
    assert.equal(g.smoothie.slots[0].state, 'empty');
  });

  test('partial delivery bonus never exceeds max patience', () => {
    const g = newGame({ smoothies: true, level: { spawnGap: [99, 99], patience: 40 } });
    const c = waitForCustomer(g);
    setOrder(c, { base: 'acai', mid: ['banana'] }, 'banana');
    buildBowl(g, 0, { mid: ['banana'] });
    assert.equal(serveBowl(g, 0, c.id).ok, true);
    assert.equal(c.patience, c.maxPatience);
  });
});

// ------------------------------------------------------------------ smoothies

describe('smoothies', () => {
  test('load → mixing → ready with events; rejects', () => {
    const g = newGame({ smoothies: true, owned: [...START_OWNED, 'strawberry'] });
    assert.deepEqual(loadSmoothie(g, 0, 'granola'), { ok: false, reason: 'notSmoothieFruit' });
    assert.deepEqual(loadSmoothie(g, 0, 'kiwi'), { ok: false, reason: 'notOwned' });
    assert.deepEqual(loadSmoothie(g, 0, 'strawberry'), { ok: true });
    const s = g.smoothie.slots[0];
    assert.equal(s.state, 'mixing');
    assert.equal(s.fruit, 'strawberry');
    assert.equal(s.duration, g.kitchen.smoothieTime);
    assert.deepEqual(loadSmoothie(g, 0, 'banana'), { ok: false, reason: 'slotBusy' });
    assert.deepEqual(drainEvents(g), [{ type: 'smoothieStart', idx: 0 }]);
    run(g, g.kitchen.smoothieTime - 0.1);
    assert.equal(g.smoothie.slots[0].state, 'mixing');
    run(g, 0.15);
    assert.equal(g.smoothie.slots[0].state, 'ready');
    assert.ok(drainEvents(g).some((e) => e.type === 'smoothieReady' && e.idx === 0));
    assert.deepEqual(loadSmoothie(g, 0, 'banana'), { ok: false, reason: 'slotBusy' });
  });

  test('no machine → loadSmoothie fails', () => {
    const g = newGame({ smoothies: false });
    assert.equal(g.smoothie, null);
    assert.equal(loadSmoothie(g, 0, 'banana').ok, false);
  });

  test('serveSmoothie checks readiness, wish and flavour', () => {
    const g = newGame({ smoothies: true, level: { seats: 2, spawnGap: [1.5, 1.5] } });
    assert.ok(runUntil(g, () => customers(g).length === 2));
    const [a, b] = customers(g);
    setOrder(a, { base: 'acai', mid: ['banana'] }, 'banana');
    setOrder(b, { base: 'acai', mid: ['banana'] }, null);
    loadSmoothie(g, 0, 'banana');
    assert.deepEqual(serveSmoothie(g, 0, a.id), { ok: false, reason: 'notReady' });
    run(g, g.kitchen.smoothieTime + 0.1);
    assert.deepEqual(serveSmoothie(g, 0, b.id), { ok: false, reason: 'noSmoothieWanted' });
    a.order.smoothie = 'strawberry';
    assert.deepEqual(serveSmoothie(g, 0, a.id), { ok: false, reason: 'wrongOrder' });
    a.order.smoothie = 'banana';
    assert.deepEqual(serveSmoothie(g, 0, a.id), { ok: true });
    assert.equal(a.delivered.smoothie, true);
    loadSmoothie(g, 0, 'banana');
    run(g, g.kitchen.smoothieTime + 0.1);
    assert.deepEqual(serveSmoothie(g, 0, a.id), { ok: false, reason: 'alreadyDelivered' });
  });

  test('trashSmoothie empties a slot', () => {
    const g = newGame({ smoothies: true });
    loadSmoothie(g, 0, 'banana');
    drainEvents(g);
    assert.deepEqual(trashSmoothie(g, 0), { ok: true });
    assert.equal(g.smoothie.slots[0].state, 'empty');
    assert.equal(g.smoothie.slots[0].fruit, null);
    assert.deepEqual(drainEvents(g), [{ type: 'trash', what: 'smoothie', idx: 0 }]);
    assert.deepEqual(trashSmoothie(g, 0), { ok: true });
    assert.deepEqual(drainEvents(g), []);
  });
});

// ------------------------------------------------------------------ level end

describe('level end', () => {
  test('hearts 0 ends the game immediately as lost, gameOver fires once', () => {
    const g = newGame({ level: { patience: 3, seats: 2, spawnGap: [0.5, 0.5], hearts: 3 } });
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
    const g = newGame({ level: { duration: 10, spawnGap: [99, 99], patience: 60, goals: [5, 10, 15] } });
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
    const g = newGame({ level: { duration: 3, spawnGap: [99, 99], patience: 2, goals: [50, 60, 70] } });
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
    const g = newGame({ level: { duration: 4, spawnGap: [99, 99], patience: 60, goals: [1, 2, 3] } });
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
    const g = createGame({ mode: 'endless', owned: ALL, smoothies: true, seed: 5 });
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
    const g = newGame({ tutorial: true, level: { spawnGap: [3, 3], patience: 10 } });
    const c = waitForCustomer(g);
    const t0 = g.time;
    run(g, 30);
    assert.equal(customers(g).length, 1);
    assert.equal(c.patience, c.maxPatience);
    assert.equal(c.state, 'waiting');
    assert.equal(g.time, t0, 'level clock paused during the tutorial');
    // stations keep working during the tutorial
    assert.equal(loadBlender(g, 0, 'acai').ok, true);
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
    assert.deepEqual(evs, [{ type: 'blenderStart', idx: 0 }]);
    assert.deepEqual(drainEvents(g), []);
    assert.equal(g.events.length, 0);
  });
});

describe('determinism', () => {
  function script(seed) {
    const g = createGame({ mode: 'campaign', level: LEVELS[9], owned: ALL, smoothies: true, seed });
    const log = [];
    for (let i = 0; i < 1200; i++) {
      tick(g, 0.05);
      if (i % 40 === 0) loadBlender(g, 0, 'acai');
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
