// Simulated player for balance tests. Plays only through the public engine API.
// Every drag costs `actionTime` seconds (perception + drag), between actions the
// engine is ticked in small steps. Strategy: most impatient customer first, one
// reserved bowl per customer, blenders kept busy with the bases that are needed.

import {
  createGame, tick, drainEvents, loadBlender, pourBlender, addIngredient, trashBowl,
  cleanBlender, loadSmoothie, trashSmoothie, serveBowl, serveSmoothie, bowlMatchesOrder,
} from '../../js/engine.js';
import {
  getKitchenStats, getLevel, SMOOTHIE_LEVEL, START_OWNED, ING, UPG, LEVELS, INGREDIENTS, UPGRADES,
} from '../../js/data.js';

const STEP = 0.05;
const POURABLE = new Set(['ready', 'overflowing']);

function wait(game, seconds) {
  for (let left = seconds; left > 1e-9 && game.status === 'playing'; left -= STEP) {
    tick(game, Math.min(STEP, left));
  }
}

const isActive = (c) => c && (c.state === 'arriving' || c.state === 'waiting');

function activeCustomers(game) {
  return game.seats.filter(isActive).sort((a, b) => a.patience - b.patience);
}

const needsBowl = (c) => !c.delivered.bowl;
const needsSmoothie = (c) => !!c.order.smoothie && !c.delivered.smoothie;

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

// Keeps customer → bowl reservations stable between decisions.
function assignBowls(game, mem, customers) {
  const wanted = new Map(customers.filter(needsBowl).map((c) => [c.id, c]));
  for (const [cid, idx] of mem.bowlOf) {
    const c = wanted.get(cid);
    if (!c || !bowlCompatible(game.bowls[idx], c.order.bowl)) mem.bowlOf.delete(cid);
  }
  const taken = () => new Set(mem.bowlOf.values());
  for (const c of wanted.values()) {
    if (mem.bowlOf.has(c.id)) continue;
    const used = taken();
    let best = -1;
    game.bowls.forEach((b, i) => {
      if (used.has(i) || !bowlCompatible(b, c.order.bowl)) return;
      if (best < 0 || bowlProgress(b) > bowlProgress(game.bowls[best])) best = i;
    });
    if (best >= 0) mem.bowlOf.set(c.id, best);
  }
}

function freeBowls(game, mem) {
  const used = new Set(mem.bowlOf.values());
  return game.bowls.map((b, i) => i).filter((i) => !used.has(i));
}

// Base portions still to come from blenders, per base.
function baseSupply(game) {
  const supply = {};
  for (const b of game.blenders) {
    if (b.state === 'blending') supply[b.base] = (supply[b.base] || 0) + b.maxPortions;
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
    const idx = mem.bowlOf.get(c.id);
    // Only bowls that are already reserved can take a portion soon.
    if (idx === undefined || game.bowls[idx].base) continue;
    const base = c.order.bowl.base;
    if (supply[base] > 0) supply[base]--;
    else missing.push(base);
  }
  return missing;
}

function act(fn) {
  return { run: fn };
}

function serveAction(game, mem, customers) {
  for (const c of customers) {
    const idx = mem.bowlOf.get(c.id);
    if (needsBowl(c) && idx !== undefined && bowlMatchesOrder(game.bowls[idx], c.order.bowl)) {
      return act(() => serveBowl(game, idx, c.id));
    }
    if (needsSmoothie(c) && game.smoothie) {
      const slot = game.smoothie.slots.findIndex((s) => s.state === 'ready' && s.fruit === c.order.smoothie);
      if (slot >= 0) return act(() => serveSmoothie(game, slot, c.id));
    }
  }
  return null;
}

function blenderAction(game, mem, customers) {
  const missing = unmetBases(game, mem, customers);
  const ruined = game.blenders.findIndex((b) => b.state === 'ruined');
  if (ruined >= 0) return act(() => cleanBlender(game, ruined));
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

function smoothieAction(game, customers) {
  if (!game.smoothie) return null;
  const slots = game.smoothie.slots;
  const pending = slots.filter((s) => s.state !== 'empty').map((s) => s.fruit);
  for (const c of customers) {
    if (!needsSmoothie(c)) continue;
    const covered = pending.indexOf(c.order.smoothie);
    if (covered >= 0) {
      pending.splice(covered, 1);
      continue;
    }
    const empty = slots.findIndex((s) => s.state === 'empty');
    if (empty >= 0) return act(() => loadSmoothie(game, empty, c.order.smoothie));
    const unwanted = slots.findIndex((s) => s.state === 'ready'
      && !customers.some((o) => needsSmoothie(o) && o.order.smoothie === s.fruit));
    if (unwanted >= 0) return act(() => trashSmoothie(game, unwanted));
  }
  return null;
}

// Next build step for the most urgent customer that can make progress.
function pourAction(game, mem, customers) {
  for (const c of customers) {
    const idx = mem.bowlOf.get(c.id);
    if (!needsBowl(c) || idx === undefined || game.bowls[idx].base) continue;
    const bl = game.blenders.findIndex((b) => POURABLE.has(b.state) && b.base === c.order.bowl.base);
    if (bl >= 0) return act(() => pourBlender(game, bl, idx));
  }
  return null;
}

function bowlWorkAction(game, mem, customers) {
  for (const c of customers) {
    if (!needsBowl(c)) continue;
    const idx = mem.bowlOf.get(c.id);
    if (idx === undefined) {
      const junk = freeBowls(game, mem)
        .filter((i) => !customers.some((o) => needsBowl(o) && bowlCompatible(game.bowls[i], o.order.bowl)))
        .sort((a, b) => bowlProgress(game.bowls[a]) - bowlProgress(game.bowls[b]))[0];
      if (junk !== undefined) return act(() => trashBowl(game, junk));
      continue;
    }
    const bowl = game.bowls[idx];
    const order = c.order.bowl;
    if (!bowl.base) {
      const bl = game.blenders.findIndex((b) => POURABLE.has(b.state) && b.base === order.base);
      if (bl >= 0) return act(() => pourBlender(game, bl, idx));
      continue;
    }
    const next = order.mid.find((id) => !bowl.mid.includes(id))
      || order.top.find((id) => !bowl.top.includes(id));
    if (next) return act(() => addIngredient(game, idx, next));
  }
  return null;
}

// Keep blenders from spoiling: pour leftovers into spare bowls.
function rescueAction(game, mem, onlyUrgent) {
  const spare = freeBowls(game, mem).find((i) => bowlIsEmpty(game.bowls[i]));
  if (spare === undefined) return null;
  const bl = game.blenders.findIndex((b) => (onlyUrgent ? b.state === 'overflowing' : POURABLE.has(b.state)));
  return bl >= 0 ? act(() => pourBlender(game, bl, spare)) : null;
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
  for (const c of customers) mem.lastBase = c.order.bowl.base;
  assignBowls(game, mem, customers);
  return serveAction(game, mem, customers)
    || rescueAction(game, mem, true)
    || blenderAction(game, mem, customers)
    || smoothieAction(game, customers)
    || pourAction(game, mem, customers)
    || bowlWorkAction(game, mem, customers)
    || rescueAction(game, mem, false)
    || preloadAction(game, mem);
}

export function playLevel({
  level, endless = false, owned = START_OWNED, ingLevels = {}, upgrades = {},
  seed = 1, actionTime = 1.3, maxTime = 900, smoothies, featured = [],
} = {}) {
  const lvl = typeof level === 'number' ? getLevel(level) : level;
  const game = createGame({
    mode: endless ? 'endless' : 'campaign',
    level: lvl,
    owned,
    ingLevels,
    kitchen: getKitchenStats(upgrades),
    smoothies: smoothies ?? (endless || (lvl && lvl.id >= SMOOTHIE_LEVEL)),
    seed,
    featured,
  });
  const mem = { bowlOf: new Map(), lastBase: null };
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
// What a typical player owns when starting a level (used by the balance test).
export const SCHEDULE = [
  { from: 1, ingredients: [], upgrades: {}, quality: [] },
  { from: 3, ingredients: ['strawberry', 'coconut'], upgrades: { blenderSpeed: 1 }, quality: [] },
  { from: 5, ingredients: ['chia', 'blueberry'], upgrades: { bowlSlots: 1 }, quality: [] },
  { from: 7, ingredients: ['pitaya', 'mango'], upgrades: { plants: 1 }, quality: [] },
  { from: 10, ingredients: ['peanut'], upgrades: { blenderSpeed: 2, jug: 1, smoothieSlots: 1 }, quality: [] },
  { from: 13, ingredients: ['kiwi', 'chocolate'], upgrades: { blender2: 1, bowlSlots: 2, jukebox: 1 }, quality: [] },
  {
    from: 16, ingredients: ['spirulina', 'mint', 'cacao'], upgrades: { blenderSpeed: 3, seating: 1 },
    quality: ['acai', 'banana', 'granola', 'strawberry'],
  },
];

// Inventory for a level: { owned, upgrades, ingLevels, featured (bought right before it) }.
export function inventoryForLevel(levelId) {
  const owned = START_OWNED.slice();
  const upgrades = {};
  const ingLevels = {};
  let featured = [];
  for (const tier of SCHEDULE) {
    if (tier.from > levelId) break;
    owned.push(...tier.ingredients);
    Object.assign(upgrades, tier.upgrades);
    for (const id of tier.quality) ingLevels[id] = 1;
    featured = tier.from === levelId ? tier.ingredients.slice() : [];
  }
  return { owned, upgrades, ingLevels, featured };
}

// Shop price of one schedule tier (ingredients + upgrade levels + quality level 1).
export function tierCost(tier) {
  let sum = 0;
  for (const id of tier.ingredients) sum += ING[id].cost;
  for (const [id, lvl] of Object.entries(tier.upgrades)) {
    const prev = SCHEDULE.filter((t) => t.from < tier.from).reduce((m, t) => Math.max(m, t.upgrades[id] || 0), 0);
    for (let i = prev; i < lvl; i++) sum += UPG[id].levels[i].cost;
  }
  for (const id of tier.quality) sum += ING[id].upgradeCosts[0];
  return sum;
}

// ------------------------------------------------------------------ meta progression
// Shopping order: the SCHEDULE tiers first, then every remaining upgrade level and quality star
// by price. Items are { kind: 'ing'|'upg'|'q', id, lvl } (lvl = level to reach).
function shoppingList() {
  const list = [];
  for (const tier of SCHEDULE) {
    for (const id of tier.ingredients) list.push({ kind: 'ing', id });
    for (const [id, lvl] of Object.entries(tier.upgrades)) list.push({ kind: 'upg', id, lvl });
    for (const id of tier.quality) list.push({ kind: 'q', id, lvl: 1 });
  }
  const rest = [];
  for (const ing of INGREDIENTS) {
    if (ing.cost) rest.push({ kind: 'ing', id: ing.id, cost: ing.cost });
    ing.upgradeCosts.forEach((cost, i) => rest.push({ kind: 'q', id: ing.id, lvl: i + 1, cost }));
  }
  for (const u of UPGRADES) u.levels.forEach((l, i) => rest.push({ kind: 'upg', id: u.id, lvl: i + 1, cost: l.cost }));
  rest.sort((a, b) => a.cost - b.cost);
  return [...list, ...rest];
}

// Buys down the list until the next item is too expensive (the player saves up for it).
// Mutates inv; returns the ingredients bought (they are "new" in the next level).
function shop(inv, list, levelId) {
  const bought = [];
  for (const item of list) {
    if (item.kind === 'ing') {
      if (inv.owned.includes(item.id)) continue;
      if (inv.coins < ING[item.id].cost) break;
      inv.coins -= ING[item.id].cost;
      inv.owned.push(item.id);
      bought.push(item.id);
      continue;
    }
    if (item.kind === 'upg' && (UPG[item.id].requiresLevel || 0) > levelId) continue;
    if (item.kind === 'q' && !inv.owned.includes(item.id)) continue;
    const levels = item.kind === 'upg' ? inv.upgrades : inv.ingLevels;
    const costs = item.kind === 'upg' ? UPG[item.id].levels.map((l) => l.cost) : ING[item.id].upgradeCosts;
    let short = false;
    while ((levels[item.id] || 0) < Math.min(item.lvl, costs.length)) {
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
  return bought;
}

// A player who plays the campaign in order, banks the coins of every attempt (won or lost, like
// save.recordLevelResult), shops before each attempt and replays a level until it is won.
export function playCampaign({ actionTime = 1.3, seed = 1000, maxAttempts = 40 } = {}) {
  const inv = { coins: 0, owned: START_OWNED.slice(), upgrades: {}, ingLevels: {} };
  const list = shoppingList();
  const attempts = {};
  let plays = 0;
  let nextSeed = seed;
  for (const lvl of LEVELS) {
    attempts[lvl.id] = 0;
    let won = false;
    while (!won && attempts[lvl.id] < maxAttempts) {
      const featured = shop(inv, list, lvl.id);
      const r = playLevel({
        level: lvl, owned: inv.owned, upgrades: inv.upgrades, ingLevels: inv.ingLevels,
        featured, seed: nextSeed++, actionTime,
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
