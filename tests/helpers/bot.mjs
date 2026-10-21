// Simulated player for balance tests. Plays only through the public engine API.
// Every drag or tap costs `actionTime` seconds (perception + drag), between actions the
// engine is ticked in small steps. Strategy: most impatient customer first, one reserved
// bowl per ordered bowl and one reserved glass per customer, blenders kept busy with the bases
// that are needed (a pack in, then switched on), a ready blender switched off before it would
// overflow, empty spots get a cup from the stack whenever there is nothing more urgent to do
// (unless a cup lift does that).

import {
  createGame, tick, drainEvents, loadBlender, toggleBlender, pourBlender, addIngredient, trashBowl, matchaMatchesOrder,
  cleanBlender, loadMatcha, trashMatcha, serveBowl, serveMatcha, bowlMatchesOrder, placeCup,
} from '../../js/engine.js';
import {
  getKitchenStats, getLevel, MATCHA_LEVEL, ING, UPG, LEVELS, INGREDIENTS, UPGRADES, ownedAt, unlockedIn, upgradeNeeds,
} from '../../js/data.js';

const STEP = 0.05;
const POURABLE = new Set(['ready', 'overflowing']);
// seconds before it would overflow that the bot switches a ready blender off
const OFF_MARGIN = 2.5;

function wait(game, seconds) {
  for (let left = seconds; left > 1e-9 && game.status === 'playing'; left -= STEP) {
    tick(game, Math.min(STEP, left));
  }
}

const isActive = (c) => c && (c.state === 'arriving' || c.state === 'waiting');

function activeCustomers(game) {
  return game.seats.filter(isActive).sort((a, b) => a.patience - b.patience);
}

// bowls a customer still waits for
const bowlsLeft = (c) => (c.order.bowl ? (c.order.qty || 1) - c.delivered.bowls : 0);
const needsBowl = (c) => bowlsLeft(c) > 0;
const needsMatcha = (c) => !!c.order.matcha && !c.delivered.matcha;

// Can the drink in this slot still become the ordered one (same fruit, no extra it should not have)?
function drinkCompatible(slot, drink) {
  return slot.state !== 'empty' && slot.fruit === drink.fruit && slot.extras.every((id) => drink.extras.includes(id));
}

// Can this (partial) bowl still become the ordered bowl?
export function bowlCompatible(bowl, order) {
  if (bowl.base && bowl.base !== order.base) return false;
  if (!bowl.mid.every((id) => order.mid.includes(id))) return false;
  if (!bowl.top.every((id) => order.top.includes(id))) return false;
  if (bowl.top.length && !order.mid.every((id) => bowl.mid.includes(id))) return false;
  return true;
}

const bowlProgress = (b) => (b.base ? 1 : 0) + b.mid.length + b.top.length;
const bowlIsEmpty = (b) => !b.base && !b.mid.length && !b.top.length;

// Reservations: mem.bowlOf maps a key to { cid, idx } – one per bowl a customer still waits for.
function reserved(mem, cid) {
  return [...mem.bowlOf.entries()].filter(([, r]) => r.cid === cid);
}

// Keeps bowl reservations stable between decisions.
function assignBowls(game, mem, customers) {
  const wanted = new Map(customers.filter(needsBowl).map((c) => [c.id, c]));
  for (const [key, r] of mem.bowlOf) {
    const c = wanted.get(r.cid);
    if (!c || !bowlCompatible(game.bowls[r.idx], c.order.bowl)) mem.bowlOf.delete(key);
  }
  for (const c of wanted.values()) {
    const mine = reserved(mem, c.id).sort((a, b) => bowlProgress(game.bowls[b[1].idx]) - bowlProgress(game.bowls[a[1].idx]));
    // a bowl was served: drop the least built reservations beyond what is still wanted
    for (const [key] of mine.slice(bowlsLeft(c))) mem.bowlOf.delete(key);
    for (let n = mine.length; n < bowlsLeft(c); n++) {
      const used = new Set([...mem.bowlOf.values()].map((r) => r.idx));
      let best = -1;
      game.bowls.forEach((b, i) => {
        if (used.has(i) || !bowlCompatible(b, c.order.bowl)) return;
        if (best < 0 || bowlProgress(b) > bowlProgress(game.bowls[best])) best = i;
      });
      if (best < 0) break;
      mem.bowlOf.set(mem.serial++, { cid: c.id, idx: best });
    }
  }
}

// The reserved spots of a customer, most built first.
function spotsOf(game, mem, c) {
  return reserved(mem, c.id).map(([, r]) => r.idx).sort((a, b) => bowlProgress(game.bowls[b]) - bowlProgress(game.bowls[a]));
}

function freeBowls(game, mem) {
  const used = new Set([...mem.bowlOf.values()].map((r) => r.idx));
  return game.bowls.map((b, i) => i).filter((i) => !used.has(i));
}

// Base portions still to come from blenders, per base.
function baseSupply(game) {
  const supply = {};
  for (const b of game.blenders) {
    if (b.state === 'blending' || b.state === 'loaded') supply[b.base] = (supply[b.base] || 0) + b.maxPortions;
    else if (POURABLE.has(b.state)) supply[b.base] = (supply[b.base] || 0) + b.portions;
  }
  return supply;
}

// Bases needed by customers (most urgent first) that no blender covers yet.
function unmetBases(game, mem, customers) {
  const supply = baseSupply(game);
  const missing = [];
  for (const c of customers) {
    if (!needsBowl(c)) continue;
    // Only bowls that are already reserved can take a portion soon.
    for (const idx of spotsOf(game, mem, c)) {
      if (game.bowls[idx].base) continue;
      const base = c.order.bowl.base;
      if (supply[base] > 0) supply[base]--;
      else missing.push(base);
    }
  }
  return missing;
}

function act(fn) {
  return { run: fn };
}

// Pour a base into bowl idx – or put the cup down first when the spot is still empty (a spot with a
// cup lift gets its cup by itself: wait for it).
function pourOrCup(game, bl, idx) {
  if (game.bowls[idx].cup) return act(() => pourBlender(game, bl, idx));
  return game.lifts[idx] ? null : act(() => placeCup(game, idx));
}

function serveAction(game, mem, customers) {
  for (const c of customers) {
    if (needsBowl(c)) {
      const idx = spotsOf(game, mem, c).find((i) => bowlMatchesOrder(game.bowls[i], c.order.bowl));
      if (idx !== undefined) return act(() => serveBowl(game, idx, c.id));
    }
    const slot = mem.slotOf.get(c.id);
    if (needsMatcha(c) && slot !== undefined) {
      const s = game.matcha.slots[slot];
      if (s.state === 'ready' && matchaMatchesOrder(s, c.order.matcha)) return act(() => serveMatcha(game, slot, c.id));
    }
  }
  return null;
}

function blenderAction(game, mem, customers) {
  const ruined = game.blenders.findIndex((b) => b.state === 'ruined');
  if (ruined >= 0) return act(() => cleanBlender(game, ruined));
  // a pack is in: switch it on
  const loaded = game.blenders.findIndex((b) => b.state === 'loaded');
  if (loaded >= 0) return act(() => toggleBlender(game, loaded));
  const missing = unmetBases(game, mem, customers);
  if (!missing.length) return null;
  const empty = game.blenders.findIndex((b) => b.state === 'empty');
  if (empty >= 0) return act(() => loadBlender(game, empty, missing[0]));
  // Everything is busy with a base nobody needs → dump it if no spare bowl can take it.
  const needed = new Set(customers.filter(needsBowl).map((c) => c.order.bowl.base));
  const useless = game.blenders.findIndex((b) => POURABLE.has(b.state) && !needed.has(b.base));
  const spare = freeBowls(game, mem).some((i) => bowlIsEmpty(game.bowls[i]));
  if (useless >= 0 && !spare) return act(() => cleanBlender(game, useless));
  return null;
}

// Keeps customer → glass reservations stable between decisions.
function assignSlots(game, mem, customers) {
  if (!game.matcha) return;
  const slots = game.matcha.slots;
  const wanted = new Map(customers.filter(needsMatcha).map((c) => [c.id, c]));
  for (const [cid, idx] of mem.slotOf) {
    const c = wanted.get(cid);
    if (!c || (slots[idx].state !== 'empty' && !drinkCompatible(slots[idx], c.order.matcha))) mem.slotOf.delete(cid);
  }
  for (const c of wanted.values()) {
    if (mem.slotOf.has(c.id)) continue;
    const used = new Set(mem.slotOf.values());
    const own = slots.findIndex((s, i) => !used.has(i) && drinkCompatible(s, c.order.matcha));
    const free = slots.findIndex((s, i) => !used.has(i) && s.state === 'empty');
    const idx = own >= 0 ? own : free;
    if (idx >= 0) mem.slotOf.set(c.id, idx);
  }
}

function matchaAction(game, mem, customers) {
  if (!game.matcha) return null;
  const slots = game.matcha.slots;
  for (const c of customers) {
    if (!needsMatcha(c)) continue;
    const idx = mem.slotOf.get(c.id);
    if (idx === undefined) continue;
    const s = slots[idx];
    const d = c.order.matcha;
    if (s.state === 'empty') return act(() => loadMatcha(game, idx, d.fruit));
    const extra = d.extras.find((id) => !s.extras.includes(id));
    if (extra) return act(() => loadMatcha(game, idx, extra));
  }
  // a glass nobody can use any more blocks its slot
  const used = new Set(mem.slotOf.values());
  const junk = slots.findIndex((s, i) => !used.has(i) && s.state !== 'empty'
    && !customers.some((o) => needsMatcha(o) && drinkCompatible(s, o.order.matcha)));
  if (junk >= 0 && customers.some((o) => needsMatcha(o) && !mem.slotOf.has(o.id))) return act(() => trashMatcha(game, junk));
  return null;
}

// Next pour for the most urgent customer that can make progress.
function pourAction(game, mem, customers) {
  for (const c of customers) {
    if (!needsBowl(c)) continue;
    const bl = game.blenders.findIndex((b) => POURABLE.has(b.state) && b.base === c.order.bowl.base);
    if (bl < 0) continue;
    for (const idx of spotsOf(game, mem, c)) {
      if (game.bowls[idx].base) continue;
      const a = pourOrCup(game, bl, idx);
      if (a) return a;
    }
  }
  return null;
}

function bowlWorkAction(game, mem, customers) {
  for (const c of customers) {
    if (!needsBowl(c)) continue;
    const spots = spotsOf(game, mem, c);
    for (const idx of spots) {
      const bowl = game.bowls[idx];
      const order = c.order.bowl;
      if (!bowl.base) {
        const bl = game.blenders.findIndex((b) => POURABLE.has(b.state) && b.base === order.base);
        const a = bl >= 0 ? pourOrCup(game, bl, idx) : null;
        if (a) return a;
        continue;
      }
      const next = order.mid.find((id) => !bowl.mid.includes(id))
        || order.top.find((id) => !bowl.top.includes(id));
      if (next) return act(() => addIngredient(game, idx, next));
    }
    if (spots.length < bowlsLeft(c)) {
      const junk = freeBowls(game, mem)
        .filter((i) => !customers.some((o) => needsBowl(o) && bowlCompatible(game.bowls[i], o.order.bowl)))
        .sort((a, b) => bowlProgress(game.bowls[a]) - bowlProgress(game.bowls[b]))[0];
      if (junk !== undefined && !bowlIsEmpty(game.bowls[junk])) return act(() => trashBowl(game, junk));
    }
  }
  return null;
}

// Keep blenders from spoiling: pour leftovers into spare bowls, or switch a ready blender off before
// it overflows (a frozen one keeps its base for good then).
function rescueAction(game, mem, onlyUrgent) {
  const spare = freeBowls(game, mem).find((i) => bowlIsEmpty(game.bowls[i]));
  if (onlyUrgent) {
    const hot = game.blenders.findIndex((b) => b.on && (b.state === 'overflowing'
      || (b.state === 'ready' && b.duration > 0 && b.duration - b.t < OFF_MARGIN)));
    if (hot < 0) return null;
    const a = spare !== undefined && game.blenders[hot].state === 'overflowing' ? pourOrCup(game, hot, spare) : null;
    return a || act(() => toggleBlender(game, hot));
  }
  if (spare === undefined) return null;
  const bl = game.blenders.findIndex((b) => POURABLE.has(b.state) && !b.frozen);
  return bl >= 0 ? pourOrCup(game, bl, spare) : null;
}

// Spare moment: a cup on every empty spot without a lift, the ones reserved for a customer first.
function cupAction(game, mem) {
  const order = [...[...mem.bowlOf.values()].map((r) => r.idx), ...game.bowls.map((b, i) => i)];
  const idx = order.find((i) => !game.bowls[i].cup && !game.lifts[i]);
  return idx === undefined ? null : act(() => placeCup(game, idx));
}

// Pre-blend when nothing is needed right now but spare bowls are waiting.
function preloadAction(game, mem) {
  const empty = game.blenders.findIndex((b) => b.state === 'empty');
  if (empty < 0) return null;
  const spare = freeBowls(game, mem).filter((i) => bowlIsEmpty(game.bowls[i])).length;
  const supply = Object.values(baseSupply(game)).reduce((a, b) => a + b, 0);
  if (supply >= spare) return null;
  const base = mem.lastBase || game.owned.find((id) => id === 'acai') || 'acai';
  return act(() => loadBlender(game, empty, base));
}

export function chooseAction(game, mem) {
  const customers = activeCustomers(game);
  for (const c of customers) if (c.order.bowl) mem.lastBase = c.order.bowl.base;
  assignBowls(game, mem, customers);
  assignSlots(game, mem, customers);
  return serveAction(game, mem, customers)
    || rescueAction(game, mem, true)
    || blenderAction(game, mem, customers)
    || matchaAction(game, mem, customers)
    || pourAction(game, mem, customers)
    || bowlWorkAction(game, mem, customers)
    || rescueAction(game, mem, false)
    || preloadAction(game, mem)
    || cupAction(game, mem);
}

// owned / featured default to what the level brings (endless: what has arrived by `reached`).
export function playLevel({
  level, endless = false, reached = 20, owned, ingLevels = {}, upgrades = {},
  seed = 1, actionTime = 1.3, maxTime = 900, matcha, featured,
} = {}) {
  const lvl = typeof level === 'number' ? getLevel(level) : level;
  const game = createGame({
    mode: endless ? 'endless' : 'campaign',
    level: lvl,
    owned: owned || ownedAt(endless ? reached : lvl.id),
    ingLevels,
    kitchen: getKitchenStats(upgrades),
    matcha: matcha ?? (endless || (lvl && lvl.id >= MATCHA_LEVEL)),
    seed,
    featured: featured || (endless ? [] : unlockedIn(lvl.id)),
  });
  const mem = { bowlOf: new Map(), slotOf: new Map(), lastBase: null, serial: 0 };
  let actions = 0;
  let ruined = 0;
  while (game.status === 'playing' && game.time < maxTime) {
    const action = chooseAction(game, mem);
    if (action) {
      wait(game, actionTime);
      if (game.status === 'playing') action.run();
      actions++;
    } else {
      wait(game, STEP);
    }
    for (const e of drainEvents(game)) if (e.type === 'blenderRuined') ruined++;
  }
  return {
    result: game.result || 'timeout',
    stars: game.stars,
    money: game.money,
    served: game.served,
    lost: game.lost,
    hearts: game.hearts,
    heartsLost: game.maxHearts - game.hearts,
    time: game.time,
    stage: game.stage,
    actions,
    ruined,     // blenders that spoiled
  };
}

// ------------------------------------------------------------------ expected progression
// What a typical player has bought in the shop when starting a level (used by the balance test).
// Ingredients are not bought: every level brings its own (js/data.js ownedAt).
export const SCHEDULE = [
  { from: 1, upgrades: {}, quality: [] },
  { from: 4, upgrades: { blenderSpeed: 1 }, quality: [] },
  { from: 7, upgrades: { cupLift: 1 }, quality: [] },
  { from: 10, upgrades: { bowlSlots: 1, plants: 1 }, quality: [] },
  { from: 14, upgrades: { matchaSlots: 1 }, quality: ['acai'] },
  { from: 18, upgrades: { jug: 1, blenderSpeed: 2 }, quality: ['banana'] },
  { from: 23, upgrades: { blender2: 1, bowlSlots: 2, jukebox: 1 }, quality: [] },
  { from: 28, upgrades: { cupLift: 3, freeze: 1 }, quality: ['granola', 'strawberry', 'mStrawberry'] },
  { from: 34, upgrades: { blenderSpeed: 3, seating: 1 }, quality: ['honey', 'mBanana', 'pitaya'] },
  { from: 42, upgrades: { neon: 1 }, quality: ['blueberry', 'coconut', 'ice', 'mMango'] },
  { from: 50, upgrades: {}, quality: ['chia', 'mango', 'vanilla', 'peanut', 'kiwi'] },
];

// Purchases for a level: { upgrades, ingLevels }.
export function inventoryForLevel(levelId) {
  const upgrades = {};
  const ingLevels = {};
  for (const tier of SCHEDULE) {
    if (tier.from > levelId) break;
    Object.assign(upgrades, tier.upgrades);
    for (const id of tier.quality) ingLevels[id] = 1;
  }
  return { upgrades, ingLevels };
}

// Shop price of one schedule tier (upgrade levels + quality level 1).
export function tierCost(tier) {
  let sum = 0;
  for (const [id, lvl] of Object.entries(tier.upgrades)) {
    const prev = SCHEDULE.filter((t) => t.from < tier.from).reduce((m, t) => Math.max(m, t.upgrades[id] || 0), 0);
    for (let i = prev; i < lvl; i++) sum += UPG[id].levels[i].cost;
  }
  for (const id of tier.quality) sum += ING[id].upgradeCosts[0];
  return sum;
}

// ------------------------------------------------------------------ meta progression
// Shopping order: the SCHEDULE tiers first, then every remaining upgrade level and quality star
// by price. Items are { kind: 'upg'|'q', id, lvl } (lvl = level to reach).
function shoppingList() {
  const list = [];
  for (const tier of SCHEDULE) {
    for (const [id, lvl] of Object.entries(tier.upgrades)) list.push({ kind: 'upg', id, lvl, from: tier.from });
    for (const id of tier.quality) list.push({ kind: 'q', id, lvl: 1, from: tier.from });
  }
  const rest = [];
  for (const ing of INGREDIENTS) ing.upgradeCosts.forEach((cost, i) => rest.push({ kind: 'q', id: ing.id, lvl: i + 1, cost }));
  for (const u of UPGRADES) u.levels.forEach((l, i) => rest.push({ kind: 'upg', id: u.id, lvl: i + 1, cost: l.cost }));
  rest.sort((a, b) => a.cost - b.cost);
  return [...list, ...rest];
}

// Buys down the list until the next item is too expensive (the player saves up for it). Items
// that are not there yet (an ingredient that arrives later, a locked upgrade) are skipped.
function shop(inv, list, levelId) {
  const owned = new Set(ownedAt(levelId));
  for (const item of list) {
    if (item.kind === 'upg' && (UPG[item.id].requiresLevel || 0) > levelId) continue;
    if (item.kind === 'q' && !owned.has(item.id)) continue;
    const levels = item.kind === 'upg' ? inv.upgrades : inv.ingLevels;
    const costs = item.kind === 'upg' ? UPG[item.id].levels.map((l) => l.cost) : ING[item.id].upgradeCosts;
    let short = false;
    while ((levels[item.id] || 0) < Math.min(item.lvl, costs.length)) {
      if (item.kind === 'upg' && upgradeNeeds(item.id, inv.upgrades)) break; // the spot or blender first
      const cost = costs[levels[item.id] || 0];
      if (inv.coins < cost) {
        short = true;
        break;
      }
      inv.coins -= cost;
      levels[item.id] = (levels[item.id] || 0) + 1;
    }
    if (short) break;
  }
}

// A player who plays the campaign in order, banks the coins of every attempt (won or lost, like
// save.recordLevelResult), shops before each attempt and replays a level until it is won.
export function playCampaign({ actionTime = 1.3, seed = 1000, maxAttempts = 40, levels = LEVELS } = {}) {
  const inv = { coins: 0, upgrades: {}, ingLevels: {} };
  const list = shoppingList();
  const attempts = {};
  let plays = 0;
  let nextSeed = seed;
  for (const lvl of levels) {
    attempts[lvl.id] = 0;
    let won = false;
    while (!won && attempts[lvl.id] < maxAttempts) {
      shop(inv, list, lvl.id);
      const r = playLevel({
        level: lvl, upgrades: inv.upgrades, ingLevels: inv.ingLevels, seed: nextSeed++, actionTime,
      });
      inv.coins += r.money;
      attempts[lvl.id]++;
      plays++;
      won = r.result === 'won';
    }
    if (!won) return { reachedEnd: false, stuckAt: lvl.id, plays, attempts, inventory: inv };
  }
  return { reachedEnd: true, stuckAt: null, plays, attempts, inventory: inv };
}
