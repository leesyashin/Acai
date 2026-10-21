// Pure game simulation (no DOM). The view reads `game` and calls the actions;
// every action returns { ok, reason? } and queues events (see docs/DESIGN.md §4.2).

import {
  ING, LEVELS, START_OWNED, MAX_BOWL_ITEMS, MAX_MATCHA_EXTRAS, TIP_RATE, PARTIAL_DELIVERY_BONUS, PATIENCE_PER_WORK,
  ENDLESS_STAGE_SECONDS, isMatchaFruit, isMatchaExtra, endlessConfig, getKitchenStats, getLevel, orderWork, ownedAt,
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
// Once nobody is waiting, the next guest comes this long after the last one at the latest.
export const EARLY_SPAWN_GAP = 2.5;
export const SPAWN_JITTER = 0.15;

const ACTIVE = new Set(['arriving', 'waiting']);

// ------------------------------------------------------------------ creation

// A bowl slot starts without a cup: the player puts one down from the cup stack first.
function emptyBowl(uid) {
  return { cup: false, base: null, mid: [], top: [], uid };
}

// A blender: 'empty' → a pack goes in: 'loaded' (switched off) → switched on: 'blending' → 'ready'.
// Left on, a ready blender overflows and spoils ('overflowing' → 'ruined'); switched off it cannot
// overflow, but its base melts and spoils after meltTime – unless the blender has the freeze upgrade.
// Switched off while blending it waits as 'loaded' and goes on from there. on: the motor runs.
function emptyBlender(maxPortions, frozen = false) {
  return { state: 'empty', base: null, t: 0, duration: 0, progress: 0, portions: 0, maxPortions, on: false, frozen, blendT: 0 };
}

// A matcha slot: the glass on the machine's drip tray. 'mixing': the fruit is in, the machine purées
// it and pours the matcha on top; extras can go in from then on.
function emptySlot() {
  return { state: 'empty', fruit: null, extras: [], t: 0, duration: 0, progress: 0 };
}

// The cup lift under a bowl spot (upgrade, spot by spot): 'idle' or 'rising' with a fresh cup.
function idleLift() {
  return { state: 'idle', t: 0, duration: 0, progress: 0 };
}

export function createGame(opts = {}) {
  const mode = opts.mode === 'endless' ? 'endless' : 'campaign';
  const level = mode === 'campaign' ? resolveLevel(opts.level) : null;
  const config = mode === 'campaign' ? level : endlessConfig(0);
  const kitchen = opts.kitchen || getKitchenStats({});
  const owned = opts.owned || (mode === 'campaign' ? ownedAt(level.id) : START_OWNED);
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
    blenders: Array.from({ length: kitchen.blenders }, (_, i) => emptyBlender(kitchen.portions, i < (kitchen.freeze || 0))),
    bowls: [],
    matcha: opts.matcha ? { slots: Array.from({ length: kitchen.matchaSlots }, emptySlot) } : null,
    lifts: [],
    owned: owned.slice(),
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
      lastSpawn: FIRST_SPAWN - EARLY_SPAWN_GAP,
      seatFreeAt: Array(config.seats).fill(-Infinity),
      nextCustomerId: 1,
      nextUid: 1,
      spawned: 0,
    },
  };
  game.bowls = Array.from({ length: kitchen.bowlSlots }, () => emptyBowl(nextUid(game)));
  game.lifts = game.bowls.map((b, i) => (i < (kitchen.cupLift || 0) ? idleLift() : null));
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
  updateMatcha(game, step);
  updateLifts(game, step);
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

// How long a ready blender keeps: on, until it overflows; off, until its base melts (never when
// frozen). Levels without overflow (the first ones) never spoil a ready blender.
function readyTime(game, b) {
  if (game.config.overflow === false) return 0;
  if (b.on) return game.kitchen.readyHold;
  return b.frozen ? 0 : game.kitchen.meltTime;
}

function updateBlenders(game, dt) {
  const k = game.kitchen;
  game.blenders.forEach((b, idx) => {
    if (b.state === 'empty' || b.state === 'ruined' || b.state === 'loaded') return;
    b.t += dt;
    // Loop so a big step can cross more than one boundary.
    while (b.duration > 0 && b.t >= b.duration) {
      const over = b.t - b.duration;
      if (b.state === 'blending') {
        b.portions = b.maxPortions;
        b.blendT = 0;
        setTimer(b, 'ready', readyTime(game, b));
        emit(game, 'blenderReady', { idx });
      } else if (b.state === 'ready' && b.on) {
        setTimer(b, 'overflowing', k.overflowTime);
        emit(game, 'blenderOverflow', { idx });
      } else {
        // overflowed, or melted while switched off
        const melted = !b.on;
        setTimer(b, 'ruined', 0);
        b.on = false;
        emit(game, 'blenderRuined', { idx, melted });
      }
      b.t = b.duration > 0 ? over : 0;
    }
    updateProgress(b);
  });
}

function updateMatcha(game, dt) {
  if (!game.matcha) return;
  game.matcha.slots.forEach((s, idx) => {
    if (s.state !== 'mixing') return;
    s.t += dt;
    if (s.t >= s.duration) {
      setTimer(s, 'ready', 0);
      emit(game, 'matchaReady', { idx });
    }
    updateProgress(s);
  });
}

// Every spot with a lift pushes a cup up as soon as it is empty (cupLiftTime: quick, not instant); a
// cup put down by hand meanwhile stops it.
function updateLifts(game, dt) {
  game.lifts.forEach((lift, bowlIdx) => {
    if (!lift) return;
    const bowl = game.bowls[bowlIdx];
    if (bowl.cup) {
      if (lift.state === 'rising') {
        Object.assign(lift, idleLift());
        emit(game, 'liftCancel', { bowlIdx });
      }
      return;
    }
    if (lift.state === 'idle') {
      setTimer(lift, 'rising', game.kitchen.cupLiftTime);
      emit(game, 'liftStart', { bowlIdx });
    }
    lift.t += dt;
    updateProgress(lift);
    if (lift.t < lift.duration) return;
    Object.assign(lift, idleLift());
    bowl.cup = true;
    emit(game, 'cupPlaced', { bowlIdx, auto: true });
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

// The next guest comes pace × the work of the last order later – a big order buys time – or as soon
// as fewer than `crowd` guests are waiting (EARLY_SPAWN_GAP after the last guest): a quick player
// never idles, and from level 10 on two guests always wait at once.
function updateSpawning(game) {
  const sim = game._sim;
  if (game.closing) return;
  if (game.tutorialHold && sim.spawned > 0) return;
  const waiting = game.seats.filter((c) => c && ACTIVE.has(c.state)).length;
  const short = waiting < (game.config.crowd || 1);
  if (game.time < sim.nextSpawn && !(short && game.time - sim.lastSpawn >= EARLY_SPAWN_GAP)) return;
  const free = [];
  game.seats.forEach((c, i) => {
    if (!c && game.time - sim.seatFreeAt[i] >= SEAT_REUSE_DELAY) free.push(i);
  });
  if (!free.length) return; // spawns as soon as a seat frees up
  const c = spawnCustomer(game, sim.rng.pick(free));
  sim.lastSpawn = game.time;
  const jitter = sim.rng.range(1 - SPAWN_JITTER, 1 + SPAWN_JITTER);
  sim.nextSpawn = game.time + game.config.pace * orderWork(c.order) * jitter;
}

function spawnCustomer(game, seat) {
  const sim = game._sim;
  const order = generateOrder(sim.rng, {
    owned: game.owned,
    config: game.config,
    matcha: !!game.matcha,
    featured: game.featured,
  });
  const perWork = game.config.patiencePerWork ?? PATIENCE_PER_WORK;
  const maxPatience = (game.config.patience + perWork * orderWork(order)) * game.kitchen.patienceMult;
  const customer = {
    id: sim.nextCustomerId++,
    seat,
    look: { seed: sim.rng.int(1, 1e9) },
    order,
    delivered: { bowl: false, bowls: 0, matcha: false },
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
  return (!c.order.bowl || c.delivered.bowl) && (!c.order.matcha || c.delivered.matcha);
}

// Does the drink in a slot (fruit + extras) match an ordered drink { fruit, extras }?
export function matchaMatchesOrder(slot, drink) {
  return !!slot && !!drink && slot.fruit === drink.fruit && sameSet(slot.extras, drink.extras);
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

// The pack goes in; the blender waits, switched off, until the player switches it on.
export function loadBlender(game, blenderIdx, baseId) {
  const err = loadBlenderError(game, blenderIdx, baseId);
  if (err) return fail(err);
  const b = game.blenders[blenderIdx];
  setTimer(b, 'loaded', game.kitchen.blendTime);
  b.base = baseId;
  b.portions = 0;
  b.maxPortions = game.kitchen.portions;
  b.on = false;
  b.blendT = 0;
  emit(game, 'blenderLoaded', { idx: blenderIdx });
  return success();
}

export function toggleBlenderError(game, blenderIdx) {
  if (!canAct(game)) return 'notPlaying';
  const b = game.blenders[blenderIdx];
  if (!b) return 'invalid';
  if (b.state === 'empty') return 'blenderEmpty';
  if (b.state === 'ruined') return 'blenderRuined';
  // done and switched off: there is nothing left to blend
  if (b.state === 'ready' && !b.on) return 'blenderDone';
  return null;
}

// The switch: on starts (or goes on with) the blend; off pauses a blend, or stops a ready or
// overflowing blender – it cannot overflow any more, but its base starts to melt (unless frozen).
export function toggleBlender(game, blenderIdx) {
  const err = toggleBlenderError(game, blenderIdx);
  if (err) return fail(err);
  const b = game.blenders[blenderIdx];
  if (b.state === 'loaded') {
    b.on = true;
    setTimer(b, 'blending', game.kitchen.blendTime);
    b.t = b.blendT;
    updateProgress(b);
    emit(game, 'blenderStart', { idx: blenderIdx });
  } else if (b.state === 'blending') {
    b.on = false;
    b.blendT = b.t;
    setTimer(b, 'loaded', game.kitchen.blendTime);
    b.t = b.blendT;
    updateProgress(b);
    emit(game, 'blenderStop', { idx: blenderIdx });
  } else {
    b.on = false;
    setTimer(b, 'ready', readyTime(game, b));
    emit(game, 'blenderStop', { idx: blenderIdx, done: true });
  }
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
  b.on = false;
  b.blendT = 0;
  emit(game, 'blenderEmpty', { idx });
}

// loaded / ruined / ready / overflowing → empty (drag to the trash)
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
  if (ing.layer !== 'mid' && ing.layer !== 'top') return 'matchaItem'; // the matcha bar's fruit and extras
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

// ------------------------------------------------------------------ matcha actions

export function loadMatchaError(game, slotIdx, fruitId) {
  if (!canAct(game)) return 'notPlaying';
  const slot = game.matcha?.slots[slotIdx];
  if (!slot) return 'invalid';
  if (isMatchaExtra(fruitId)) return addMatchaExtraError(game, slotIdx, fruitId);
  if (!isMatchaFruit(fruitId)) return 'notMatchaFruit';
  if (!game.owned.includes(fruitId)) return 'notOwned';
  if (slot.state !== 'empty') return 'slotBusy';
  return null;
}

// A matcha fruit on an empty glass starts the machine; an extra goes on a glass that has its fruit.
export function loadMatcha(game, slotIdx, id) {
  if (isMatchaExtra(id)) return addMatchaExtra(game, slotIdx, id);
  const err = loadMatchaError(game, slotIdx, id);
  if (err) return fail(err);
  const slot = game.matcha.slots[slotIdx];
  setTimer(slot, 'mixing', game.kitchen.matchaTime);
  slot.fruit = id;
  slot.extras = [];
  emit(game, 'matchaStart', { idx: slotIdx });
  return success();
}

export function addMatchaExtraError(game, slotIdx, extraId) {
  if (!canAct(game)) return 'notPlaying';
  const slot = game.matcha?.slots[slotIdx];
  if (!slot) return 'invalid';
  if (!isMatchaExtra(extraId)) return 'notMatchaFruit';
  if (!game.owned.includes(extraId)) return 'notOwned';
  if (slot.state === 'empty') return 'fruitFirst';
  if (slot.extras.includes(extraId)) return 'alreadyAdded';
  if (slot.extras.length >= MAX_MATCHA_EXTRAS) return 'glassFull';
  return null;
}

export function addMatchaExtra(game, slotIdx, extraId) {
  const err = addMatchaExtraError(game, slotIdx, extraId);
  if (err) return fail(err);
  game.matcha.slots[slotIdx].extras.push(extraId);
  emit(game, 'extraAdded', { idx: slotIdx, id: extraId });
  return success();
}

export function trashMatcha(game, slotIdx) {
  if (!canAct(game)) return fail('notPlaying');
  const slot = game.matcha?.slots[slotIdx];
  if (!slot) return fail('invalid');
  if (slot.state !== 'empty') {
    game.matcha.slots[slotIdx] = emptySlot();
    emit(game, 'trash', { what: 'matcha', idx: slotIdx });
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
  c.delivered.bowls = (c.delivered.bowls || 0) + 1;
  c.delivered.bowl = c.delivered.bowls >= (c.order.qty || 1);
  resetBowl(game, bowlIdx);
  delivered(game, c);
  return success();
}

export function serveMatchaError(game, slotIdx, customerId) {
  if (!canAct(game)) return 'notPlaying';
  const slot = game.matcha?.slots[slotIdx];
  if (!slot) return 'invalid';
  const c = servableCustomer(game, customerId);
  if (!c) return 'noCustomer';
  if (slot.state !== 'ready') return 'notReady';
  if (!c.order.matcha) return 'noMatchaWanted';
  if (c.delivered.matcha) return 'alreadyDelivered';
  if (!matchaMatchesOrder(slot, c.order.matcha)) {
    // the right fruit with an extra still missing: say so instead of "not ordered"
    const d = c.order.matcha;
    const short = slot.fruit === d.fruit && slot.extras.every((id) => d.extras.includes(id));
    return short ? 'drinkIncomplete' : 'wrongOrder';
  }
  return null;
}

export function serveMatcha(game, slotIdx, customerId) {
  const err = serveMatchaError(game, slotIdx, customerId);
  if (err) return fail(err);
  const c = findCustomer(game, customerId);
  c.delivered.matcha = true;
  game.matcha.slots[slotIdx] = emptySlot();
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
