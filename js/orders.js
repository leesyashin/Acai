// Order generation and pricing. Pure module (no DOM) – used by the engine and tests.

import { INGREDIENTS, ING, isMatchaFruit, ingredientValue, matchaValue } from './data.js';

const FEATURED_WEIGHT = 2;
const CATALOG_INDEX = Object.fromEntries(INGREDIENTS.map((ing, i) => [ing.id, i]));

const byCatalog = (a, b) => CATALOG_INDEX[a] - CATALOG_INDEX[b];

function ownedOfLayer(owned, layer) {
  return owned.filter((id) => ING[id]?.layer === layer).sort(byCatalog);
}

function weightedPick(rng, items, weightOf) {
  const total = items.reduce((sum, id) => sum + weightOf(id), 0);
  let roll = rng.next() * total;
  for (const id of items) {
    roll -= weightOf(id);
    if (roll < 0) return id;
  }
  return items[items.length - 1];
}

// n distinct items, weighted, without replacement; returned in catalog order.
function weightedSample(rng, items, n, weightOf) {
  const pool = items.slice();
  const out = [];
  while (out.length < n && pool.length) {
    const id = weightedPick(rng, pool, weightOf);
    pool.splice(pool.indexOf(id), 1);
    out.push(id);
  }
  return out.sort(byCatalog);
}

function countInRange(rng, range, available, min = 0) {
  const [lo, hi] = Array.isArray(range) ? range : [range, range];
  return Math.min(Math.max(min, rng.int(lo, hi)), available);
}

// owned: ingredient ids; config: level or endlessConfig(stage);
// matcha: the matcha machine is there (a fruit matcha may join the bowl);
// featured: freshly bought ingredients – twice as likely so the player gets to use them.
export function generateOrder(rng, { owned, config, matcha = false, featured = [] }) {
  const weightOf = (id) => (featured.includes(id) ? FEATURED_WEIGHT : 1);
  const bases = ownedOfLayer(owned, 'base');
  const mids = ownedOfLayer(owned, 'mid');
  const tops = ownedOfLayer(owned, 'top');

  const base = bases.length ? weightedPick(rng, bases, weightOf) : null;
  // At least one fruit/crunch: the engine rejects toppings on a bowl without one.
  const mid = weightedSample(rng, mids, countInRange(rng, config.mid, mids.length, 1), weightOf);
  const top = weightedSample(rng, tops, countInRange(rng, config.top, tops.length), weightOf);

  // the drink: a fruit matcha (iced matcha latte on a purée of one owned fruit)
  let drink = null;
  if (matcha && config.matchaChance > 0 && rng.chance(config.matchaChance)) {
    const fruits = owned.filter(isMatchaFruit).sort(byCatalog);
    if (fruits.length) drink = weightedPick(rng, fruits, weightOf);
  }
  return { bowl: { base, mid, top }, matcha: drink };
}

export function bowlValue(bowl, ingLevels = {}) {
  if (!bowl || !bowl.base) return 0;
  const items = [bowl.base, ...(bowl.mid || []), ...(bowl.top || [])];
  return items.reduce((sum, id) => sum + ingredientValue(id, ingLevels), 0);
}

export function orderValue(order, ingLevels = {}) {
  const drink = order.matcha ? matchaValue(order.matcha, ingLevels) : 0;
  return bowlValue(order.bowl, ingLevels) + drink;
}
