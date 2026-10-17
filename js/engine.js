// Pure game simulation (no DOM). The view reads `game` and calls the actions;
// every action returns { ok, reason? } and queues events (see docs/DESIGN.md §4.2).

import {
  ING, LEVELS, START_OWNED, MAX_BOWL_ITEMS, TIP_RATE, PARTIAL_DELIVERY_BONUS,
  SMOOTHIE_PATIENCE_BONUS, ENDLESS_STAGE_SECONDS, isSmoothieFruit, endlessConfig, getKitchenStats, getLevel,
} from './data.js';
import { createRng } from './rng.js';
import { generateOrder, orderValue } from './orders.js';
import { registerStrings } from './i18n.js';

// Fallback texts for the reason codes only the engine produces (the game view
// owns the other `reason.*` strings and may override these).
registerStrings({
  de: {
    'reason.noCustomer': 'Dieser Gast ist schon weg.',
    'reason.notPlaying': 'Gerade nicht möglich.',
    'reason.invalid': 'Das passt hier nicht.',
  },
  en: {
    'reason.noCustomer': 'This customer has already left.',
    'reason.notPlaying': 'Not possible right now.',
    'reason.invalid': 'That doesn’t go here.',
  },
});

export const MAX_DT = 0.1;
export const FIRST_SPAWN = 1.0;
export const ARRIVE_TIME = 0.6;
export const LEAVE_TIME = 0.9;
export const SEAT_REUSE_DELAY = 0.8;
export const TUTORIAL_RELEASE_DELAY = 2;

const ACTIVE = new Set(['arriving', 'waiting']);

// ------------------------------------------------------------------ creation

// A bowl slot starts without a cup: the player puts one down from the cup stack first.
function emptyBowl(uid) {
  return { cup: false, base: null, mid: [], top: [], uid };
}

function emptyBlender(maxPortions) {
  return { state: 'empty', base: null, t: 0, duration: 0, progress: 0, portions: 0, maxPortions };
}

function emptySlot() {
  return { state: 'empty', fruit: null, t: 0, duration: 0, progress: 0 };
}

export function createGame(opts = {}) {
  const mode = opts.mode === 'endless' ? 'endless' : 'campaign';
  const level = mode === 'campaign' ? resolveLevel(opts.level) : null;
  const config = mode === 'campaign' ? level : endlessConfig(0);
  const kitchen = opts.kitchen || getKitchenStats({});
  const seed = Number.isFinite(opts.seed) ? opts.seed : 1;
  const hearts = config.hearts ?? 3;
  const game = {
    mode, level, config,
    status: 'playing',
    time: 0,
    duration: mode === 'campaign' ? level.duration : null,
    closing: false,
    money: 0,
    hearts,
    maxHearts: hearts,
    served: 0,
    lost: 0,
    stage: 0,
    tutorialHold: !!opts.tutorial,
    seats: Array(config.seats).fill(null),
    blenders: Array.from({ length: kitchen.blenders }, () => emptyBlender(kitchen.portions)),
    bowls: [],
    smoothie: opts.smoothies ? { slots: Array.from({ length: kitchen.smoothieSlots }, emptySlot) } : null,
    owned: (opts.owned || START_OWNED).slice(),
    ingLevels: { ...(opts.ingLevels || {}) },
    kitchen,
    featured: (opts.featured || []).slice(),
    result: null,
    stars: 0,
    endReason: null,
    events: [],
    _sim: {
      rng: createRng(seed),
      nextSpawn: FIRST_SPAWN,
      seatFreeAt: Array(config.seats).fill(-Infinity),
      nextCustomerId: 1,
      nextUid: 1,
      spawned: 0,
    },
  };
  game.bowls = Array.from({ length: kitchen.bowlSlots }, () => emptyBowl(nextUid(game)));
  return game;
}

function resolveLevel(level) {
  if (typeof level === 'number') return getLevel(level) || LEVELS[0];
  return level || LEVELS[0];
}

function nextUid(game) {
  return game._sim.nextUid++;
}

function emit(game, type, data = {}) {
  game.events.push({ type, ...data });
}

export function drainEvents(game) {
  return game.events.splice(0);
}

const fail = (reason) => ({ ok: false, reason });
const success = () => ({ ok: true });

// ------------------------------------------------------------------ tick

export function tick(game, dt) {
  if (game.status !== 'playing') return;
  const step = Math.min(Math.max(Number(dt) || 0, 0), MAX_DT);
  if (step <= 0) return;
  // During the tutorial hold the level clock waits once the first guest is there.
  const clockRuns = !(game.tutorialHold && game._sim.spawned > 0);
  if (clockRuns) game.time += step;

  updateBlenders(game, step);
  updateSmoothies(game, step);
  updateCustomers(game, step);
  if (game.status !== 'playing') return;
  if (game.mode === 'endless') updateStage(game);
  updateClosing(game);
  updateSpawning(game);
  checkCampaignEnd(game);
}

function setTimer(obj, state, duration) {
  obj.state = state;
  obj.t = 0;
  obj.duration = duration;
  obj.progress = 0;
}

function updateProgress(obj) {
  obj.progress = obj.duration > 0 ? Math.min(1, obj.t / obj.duration) : 0;
}

function updateBlenders(game, dt) {
  const k = game.kitchen;
  game.blenders.forEach((b, idx) => {
    if (b.state === 'empty' || b.state === 'ruined') return;
    b.t += dt;
    // Loop so a big step can cross more than one boundary.
    while (b.duration > 0 && b.t >= b.duration) {
      const over = b.t - b.duration;
      if (b.state === 'blending') {
        setTimer(b, 'ready', game.config.overflow === false ? 0 : k.readyHold);
        b.portions = b.maxPortions;
        emit(game, 'blenderReady', { idx });
      } else if (b.state === 'ready') {
        setTimer(b, 'overflowing', k.overflowTime);
        emit(game, 'blenderOverflow', { idx });
      } else if (b.state === 'overflowing') {
        setTimer(b, 'ruined', 0);
        emit(game, 'blenderRuined', { idx });
      }
      b.t = b.duration > 0 ? over : 0;
    }
    updateProgress(b);
  });
}

function updateSmoothies(game, dt) {
  if (!game.smoothie) return;
  game.smoothie.slots.forEach((s, idx) => {
    if (s.state !== 'mixing') return;
    s.t += dt;
    if (s.t >= s.duration) {
      setTimer(s, 'ready', 0);
      emit(game, 'smoothieReady', { idx });
    }
    updateProgress(s);
  });
}

export function moodFor(ratio) {
  if (ratio > 0.6) return 'happy';
  if (ratio > 0.3) return 'neutral';
  if (ratio > 0.12) return 'impatient';
  return 'angry';
}

function updateCustomers(game, dt) {
  game.seats.forEach((c, seat) => {
    if (!c) return;
    c.t += dt;
    if (c.state === 'arriving') {
      if (c.t >= ARRIVE_TIME) {
        c.state = 'waiting';
        c.t = 0;
      }
    } else if (c.state === 'waiting') {
      if (!game.tutorialHold) c.patience = Math.max(0, c.patience - dt);
      c.mood = moodFor(c.patience / c.maxPatience);
      if (c.patience <= 0) loseCustomer(game, c);
    } else if (c.t >= LEAVE_TIME) {
      game.seats[seat] = null;
      game._sim.seatFreeAt[seat] = game.time;
    }
  });
  if (game.hearts <= 0) finish(game, 'lost', 'hearts');
}

function loseCustomer(game, c) {
  c.state = 'leavingAngry';
  c.t = 0;
  c.mood = 'angry';
  game.hearts = Math.max(0, game.hearts - 1);
  game.lost++;
  emit(game, 'customerLost', { customerId: c.id, seat: c.seat });
}

function updateStage(game) {
  const stage = Math.floor(game.time / ENDLESS_STAGE_SECONDS);
  if (stage <= game.stage) return;
  game.stage = stage;
  game.config = endlessConfig(stage);
  while (game.seats.length < game.config.seats) {
    game.seats.push(null);
    game._sim.seatFreeAt.push(-Infinity);
  }
  emit(game, 'stageUp', { stage });
}

function updateClosing(game) {
  if (game.mode !== 'campaign' || game.closing || game.time < game.duration) return;
  game.closing = true;
  emit(game, 'closingTime');
}

function updateSpawning(game) {
  const sim = game._sim;
  if (game.closing) return;
  if (game.tutorialHold && sim.spawned > 0) return;
  if (game.time < sim.nextSpawn) return;
  const free = [];
  game.seats.forEach((c, i) => {
    if (!c && game.time - sim.seatFreeAt[i] >= SEAT_REUSE_DELAY) free.push(i);
  });
  if (!free.length) return; // spawns as soon as a seat frees up
  spawnCustomer(game, sim.rng.pick(free));
  const [lo, hi] = game.config.spawnGap;
  sim.nextSpawn = game.time + sim.rng.range(lo, hi);
}

function spawnCustomer(game, seat) {
  const sim = game._sim;
  const order = generateOrder(sim.rng, {
    owned: game.owned,
    config: game.config,
    smoothies: !!game.smoothie,
    featured: game.featured,
  });
  const maxPatience = game.config.patience * game.kitchen.patienceMult
    + (order.smoothie ? SMOOTHIE_PATIENCE_BONUS : 0);
  const customer = {
    id: sim.nextCustomerId++,
    seat,
    look: { seed: sim.rng.int(1, 1e9) },
    order,
    delivered: { bowl: false, smoothie: false },
    patience: maxPatience,
    maxPatience,
    state: 'arriving',
    t: 0,
    mood: 'happy',
    paid: 0,
  };
  game.seats[seat] = customer;
  sim.spawned++;
  emit(game, 'customerArrive', { customerId: customer.id, seat });
  return customer;
}

function checkCampaignEnd(game) {
  if (game.mode !== 'campaign' || !game.closing) return;
  if (game.seats.some(Boolean)) return;
  const goals = game.config.goals;
  const won = game.money >= goals[0] && game.hearts > 0;
  finish(game, won ? 'won' : 'lost', won ? null : 'goal');
}

export function starsFor(money, goals) {
  return goals.filter((g) => money >= g).length;
}

function finish(game, result, reason) {
  if (game.result) return;
  game.status = result;
  game.result = result;
  game.endReason = reason;
  game.stars = result === 'won' ? starsFor(game.money, game.config.goals) : 0;
  emit(game, 'gameOver', { result, stars: game.stars, reason });
}

// ------------------------------------------------------------------ helpers

export function bowlMatchesOrder(bowl, orderBowl) {
  if (!bowl || !orderBowl || !bowl.base || bowl.base !== orderBowl.base) return false;
  return sameSet(bowl.mid, orderBowl.mid) && sameSet(bowl.top, orderBowl.top);
}

function sameSet(a, b) {
  return a.length === b.length && a.every((id) => b.includes(id));
}

export function findCustomer(game, customerId) {
  return game.seats.find((c) => c && c.id === customerId) || null;
}

export function isOrderComplete(c) {
  return c.delivered.bowl && (!c.order.smoothie || c.delivered.smoothie);
}

function canAct(game) {
  return game.status === 'playing';
}

function resetBowl(game, bowlIdx) {
  game.bowls[bowlIdx] = emptyBowl(nextUid(game));
}

// ------------------------------------------------------------------ blender actions

// The *Error(…) checks are pure: they return the reason the matching action would reject with
// right now, or null. Every action runs its check first; the view uses them to decide which drop
// targets glow (docs/DESIGN.md §4.3 valid()).
export function loadBlenderError(game, blenderIdx, baseId) {
  if (!canAct(game)) return 'notPlaying';
  const b = game.blenders[blenderIdx];
  if (!b) return 'invalid';
  if (ING[baseId]?.layer !== 'base') return 'wrongLayer';
  if (!game.owned.includes(baseId)) return 'notOwned';
  // A spoiled blender never frees itself – point to the trash instead of "busy, wait".
  if (b.state === 'ruined') return 'blenderRuined';
  if (b.state !== 'empty') return 'blenderBusy';
  return null;
}

export function loadBlender(game, blenderIdx, baseId) {
  const err = loadBlenderError(game, blenderIdx, baseId);
  if (err) return fail(err);
  const b = game.blenders[blenderIdx];
  setTimer(b, 'blending', game.kitchen.blendTime);
  b.base = baseId;
  b.portions = 0;
  b.maxPortions = game.kitchen.portions;
  emit(game, 'blenderStart', { idx: blenderIdx });
  return success();
}

export function pourError(game, blenderIdx, bowlIdx) {
  if (!canAct(game)) return 'notPlaying';
  const b = game.blenders[blenderIdx];
  const bowl = game.bowls[bowlIdx];
  if (!b || !bowl) return 'invalid';
  if (b.state === 'ruined') return 'blenderRuined';
  if (b.state !== 'ready' && b.state !== 'overflowing') return 'blenderNotReady';
  if (!bowl.cup) return 'noCup';
  if (bowl.base) return 'bowlHasBase';
  return null;
}

export function pourBlender(game, blenderIdx, bowlIdx) {
  const err = pourError(game, blenderIdx, bowlIdx);
  if (err) return fail(err);
  const b = game.blenders[blenderIdx];
  const bowl = game.bowls[bowlIdx];
  bowl.base = b.base;
  b.portions--;
  emit(game, 'basePoured', { bowlIdx, blenderIdx });
  if (b.portions <= 0) emptyTheBlender(game, blenderIdx);
  return success();
}

function emptyTheBlender(game, idx) {
  const b = game.blenders[idx];
  setTimer(b, 'empty', 0);
  b.base = null;
  b.portions = 0;
  emit(game, 'blenderEmpty', { idx });
}

// ruined / ready / overflowing → empty (drag to the trash)
export function cleanBlender(game, blenderIdx) {
  if (!canAct(game)) return fail('notPlaying');
  const b = game.blenders[blenderIdx];
  if (!b) return fail('invalid');
  if (b.state === 'blending') return fail('blenderBusy');
  if (b.state === 'empty') return fail('blenderNotReady');
  emptyTheBlender(game, blenderIdx);
  emit(game, 'trash', { what: 'blender', idx: blenderIdx });
  return success();
}

// ------------------------------------------------------------------ bowl actions

export function placeCupError(game, bowlIdx) {
  if (!canAct(game)) return 'notPlaying';
  const bowl = game.bowls[bowlIdx];
  if (!bowl) return 'invalid';
  if (bowl.cup) return 'cupThere';
  return null;
}

// Empty cup from the stack → an empty bowl slot.
export function placeCup(game, bowlIdx) {
  const err = placeCupError(game, bowlIdx);
  if (err) return fail(err);
  game.bowls[bowlIdx].cup = true;
  emit(game, 'cupPlaced', { bowlIdx });
  return success();
}

export function addIngredientError(game, bowlIdx, ingId) {
  if (!canAct(game)) return 'notPlaying';
  const bowl = game.bowls[bowlIdx];
  if (!bowl) return 'invalid';
  const ing = ING[ingId];
  if (!ing || !game.owned.includes(ingId)) return 'notOwned';
  if (ing.layer === 'base') return 'wrongLayer';
  if (!bowl.cup) return 'noCup';
  if (!bowl.base) return 'needBase';
  if (bowl.mid.includes(ingId) || bowl.top.includes(ingId)) return 'alreadyAdded';
  if (ing.layer === 'mid' && bowl.top.length) return 'toppingsOnTop';
  // Every order has at least one fruit/crunch, so a topping on a bare base could never be served.
  if (ing.layer === 'top' && !bowl.mid.length) return 'toppingsOnTop';
  if (bowl.mid.length + bowl.top.length >= MAX_BOWL_ITEMS) return 'bowlFull';
  return null;
}

export function addIngredient(game, bowlIdx, ingId) {
  const err = addIngredientError(game, bowlIdx, ingId);
  if (err) return fail(err);
  const bowl = game.bowls[bowlIdx];
  const ing = ING[ingId];
  bowl[ing.layer].push(ingId);
  emit(game, 'ingredientAdded', { bowlIdx, id: ingId });
  return success();
}

// The cup goes into the trash with whatever is in it; the slot is free for a new cup.
export function trashBowl(game, bowlIdx) {
  if (!canAct(game)) return fail('notPlaying');
  const bowl = game.bowls[bowlIdx];
  if (!bowl) return fail('invalid');
  if (bowl.cup || bowl.base || bowl.mid.length || bowl.top.length) {
    resetBowl(game, bowlIdx);
    emit(game, 'trash', { what: 'bowl', idx: bowlIdx });
  }
  return success();
}

// ------------------------------------------------------------------ smoothie actions

export function loadSmoothieError(game, slotIdx, fruitId) {
  if (!canAct(game)) return 'notPlaying';
  const slot = game.smoothie?.slots[slotIdx];
  if (!slot) return 'invalid';
  if (!isSmoothieFruit(fruitId)) return 'notSmoothieFruit';
  if (!game.owned.includes(fruitId)) return 'notOwned';
  if (slot.state !== 'empty') return 'slotBusy';
  return null;
}

export function loadSmoothie(game, slotIdx, fruitId) {
  const err = loadSmoothieError(game, slotIdx, fruitId);
  if (err) return fail(err);
  const slot = game.smoothie.slots[slotIdx];
  setTimer(slot, 'mixing', game.kitchen.smoothieTime);
  slot.fruit = fruitId;
  emit(game, 'smoothieStart', { idx: slotIdx });
  return success();
}

export function trashSmoothie(game, slotIdx) {
  if (!canAct(game)) return fail('notPlaying');
  const slot = game.smoothie?.slots[slotIdx];
  if (!slot) return fail('invalid');
  if (slot.state !== 'empty') {
    game.smoothie.slots[slotIdx] = emptySlot();
    emit(game, 'trash', { what: 'smoothie', idx: slotIdx });
  }
  return success();
}

// ------------------------------------------------------------------ serving

function servableCustomer(game, customerId) {
  const c = findCustomer(game, customerId);
  return c && ACTIVE.has(c.state) ? c : null;
}

export function serveBowlError(game, bowlIdx, customerId) {
  if (!canAct(game)) return 'notPlaying';
  const bowl = game.bowls[bowlIdx];
  if (!bowl) return 'invalid';
  const c = servableCustomer(game, customerId);
  if (!c) return 'noCustomer';
  if (!c.order.bowl) return 'noBowlWanted';
  if (c.delivered.bowl) return 'alreadyDelivered';
  if (!bowl.base) return 'emptyBowl';
  if (!bowlMatchesOrder(bowl, c.order.bowl)) return 'wrongOrder';
  return null;
}

export function serveBowl(game, bowlIdx, customerId) {
  const err = serveBowlError(game, bowlIdx, customerId);
  if (err) return fail(err);
  const c = findCustomer(game, customerId);
  c.delivered.bowl = true;
  resetBowl(game, bowlIdx);
  delivered(game, c);
  return success();
}

export function serveSmoothieError(game, slotIdx, customerId) {
  if (!canAct(game)) return 'notPlaying';
  const slot = game.smoothie?.slots[slotIdx];
  if (!slot) return 'invalid';
  const c = servableCustomer(game, customerId);
  if (!c) return 'noCustomer';
  if (slot.state !== 'ready') return 'notReady';
  if (!c.order.smoothie) return 'noSmoothieWanted';
  if (c.delivered.smoothie) return 'alreadyDelivered';
  if (slot.fruit !== c.order.smoothie) return 'wrongOrder';
  return null;
}

export function serveSmoothie(game, slotIdx, customerId) {
  const err = serveSmoothieError(game, slotIdx, customerId);
  if (err) return fail(err);
  const c = findCustomer(game, customerId);
  c.delivered.smoothie = true;
  game.smoothie.slots[slotIdx] = emptySlot();
  delivered(game, c);
  return success();
}

// One part of the order arrived: refill patience, or pay when everything is there.
function delivered(game, c) {
  if (!isOrderComplete(c)) {
    c.patience = Math.min(c.maxPatience, c.patience + PARTIAL_DELIVERY_BONUS * c.maxPatience);
    c.mood = moodFor(c.patience / c.maxPatience);
    emit(game, 'partialDelivery', { customerId: c.id });
    return;
  }
  const value = orderValue(c.order, game.ingLevels);
  const amount = Math.round(value);
  const tip = Math.round(value * TIP_RATE * (c.patience / c.maxPatience));
  c.paid = amount + tip;
  c.state = 'leavingHappy';
  c.t = 0;
  c.mood = 'happy';
  game.money += c.paid;
  game.served++;
  emit(game, 'customerPaid', { customerId: c.id, seat: c.seat, amount, tip });
}

// ------------------------------------------------------------------ control

export function setPaused(game, paused) {
  const want = paused === undefined ? game.status === 'playing' : !!paused;
  if (want && game.status === 'playing') game.status = 'paused';
  else if (!want && game.status === 'paused') game.status = 'playing';
}

export function releaseTutorialHold(game) {
  if (!game.tutorialHold) return;
  game.tutorialHold = false;
  game._sim.nextSpawn = game.time + TUTORIAL_RELEASE_DELAY;
}

// Endless only: the player ends the shift from the pause menu. Same path as running out of
// hearts (gameOver → the view banks coins and the best score), with reason 'quit'.
export function endRun(game) {
  if (game.mode !== 'endless' || game.result) return false;
  finish(game, 'lost', 'quit');
  return true;
}
