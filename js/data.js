// Canonical game content: ingredients, levels, upgrades and derived stats.
// Pure module (no DOM) – imported by the engine tests in Node.

import { registerStrings, t, hasString } from './i18n.js';

export const LAYERS = ['base', 'mid', 'top'];
// The matcha bar: a fruit goes into the glass first (the machine purées it and pours the matcha on
// top), extras go on the finished drink.
export const MATCHA_LAYERS = ['mfruit', 'mextra'];

// price = coins per use (before quality); unlock = the campaign level it arrives with (the player
// never buys ingredients: every level plays with exactly the ingredients of its place in the campaign)
// upgradeCosts = quality level 1 and 2 (value ×1.3 / ×1.6)
// style tells art.js how the ingredient sits on a bowl; art = the bowl fruit a matcha fruit is drawn as.
export const INGREDIENTS = [
  // Base – comes out of the blender
  { id: 'acai',       layer: 'base', price: 5, unlock: 1,  upgradeCosts: [100, 260],  color: '#4a1a5e', color2: '#7b3a96', style: 'base' },
  { id: 'pitaya',     layer: 'base', price: 7, unlock: 13, upgradeCosts: [140, 330],  color: '#ff3d8b', color2: '#ff86b8', style: 'base' },
  { id: 'spirulina',  layer: 'base', price: 9, unlock: 33, upgradeCosts: [180, 400],  color: '#2a9fd8', color2: '#7fd3f5', style: 'base' },
  // Fruits & crunch
  { id: 'banana',     layer: 'mid', price: 2, unlock: 1,  upgradeCosts: [60, 170],   color: '#ffe066', color2: '#f2c230', style: 'slices' },
  { id: 'granola',    layer: 'mid', price: 2, unlock: 1,  upgradeCosts: [60, 170],   color: '#d9973f', color2: '#a8692a', style: 'pile' },
  { id: 'strawberry', layer: 'mid', price: 3, unlock: 3,  upgradeCosts: [80, 220],   color: '#ff3b47', color2: '#3fae4a', style: 'halves' },
  { id: 'blueberry',  layer: 'mid', price: 3, unlock: 7,  upgradeCosts: [100, 250],  color: '#4656c9', color2: '#2c3687', style: 'berries' },
  { id: 'mango',      layer: 'mid', price: 4, unlock: 16, upgradeCosts: [110, 280],  color: '#ffad1f', color2: '#ff8a00', style: 'cubes' },
  { id: 'kiwi',       layer: 'mid', price: 5, unlock: 22, upgradeCosts: [140, 320],  color: '#8cc63f', color2: '#5a3d1c', style: 'slices' },
  // Toppings & sauces
  { id: 'honey',      layer: 'top', price: 1, unlock: 1,  upgradeCosts: [50, 140],   color: '#ffb81c', color2: '#e08a00', style: 'drizzle' },
  { id: 'coconut',    layer: 'top', price: 2, unlock: 5,  upgradeCosts: [55, 150],   color: '#fffaf0', color2: '#e8dcc4', style: 'flakes' },
  { id: 'chia',       layer: 'top', price: 2, unlock: 9,  upgradeCosts: [75, 200],   color: '#3a3a3a', color2: '#8a8a8a', style: 'seeds' },
  { id: 'peanut',     layer: 'top', price: 3, unlock: 19, upgradeCosts: [100, 250],  color: '#c47a35', color2: '#8e5220', style: 'drizzle' },
  { id: 'chocolate',  layer: 'top', price: 3, unlock: 25, upgradeCosts: [120, 290],  color: '#5a2e17', color2: '#3a1c0c', style: 'drizzle' },
  { id: 'mint',       layer: 'top', price: 3, unlock: 28, upgradeCosts: [140, 320],  color: '#2fbf5a', color2: '#1d8a3e', style: 'leaves' },
  { id: 'cacao',      layer: 'top', price: 4, unlock: 37, upgradeCosts: [150, 350],  color: '#6b3a22', color2: '#3f2012', style: 'chunks' },
  // Matcha bar: fruit for the purée at the bottom of the glass
  { id: 'mStrawberry', layer: 'mfruit', price: 3, unlock: 11, upgradeCosts: [90, 230],  color: '#e5384f', color2: '#ff7d88', style: 'puree', art: 'strawberry' },
  { id: 'mBanana',     layer: 'mfruit', price: 2, unlock: 11, upgradeCosts: [70, 190],  color: '#f3d35c', color2: '#fff2b0', style: 'puree', art: 'banana' },
  { id: 'mMango',      layer: 'mfruit', price: 3, unlock: 17, upgradeCosts: [110, 270], color: '#ffa623', color2: '#ffd27a', style: 'puree', art: 'mango' },
  { id: 'mBlueberry',  layer: 'mfruit', price: 4, unlock: 24, upgradeCosts: [130, 300], color: '#5d3f9e', color2: '#9a86d6', style: 'puree', art: 'blueberry' },
  // Matcha bar: extras on the drink
  { id: 'ice',         layer: 'mextra', price: 1, unlock: 14, upgradeCosts: [60, 160],  color: '#d7f0fb', color2: '#9fd2ea', style: 'ice' },
  { id: 'vanilla',     layer: 'mextra', price: 2, unlock: 20, upgradeCosts: [90, 220],  color: '#e9b45a', color2: '#b97a22', style: 'syrup' },
  { id: 'foam',        layer: 'mextra', price: 3, unlock: 30, upgradeCosts: [120, 290], color: '#fbf7ee', color2: '#e6dcc7', style: 'foam' },
];

// Every ingredient that has arrived by a campaign level (in catalog order) and the ones new in it.
export const ownedAt = (levelId) => INGREDIENTS.filter((i) => i.unlock <= levelId).map((i) => i.id);
export const unlockedIn = (levelId) => INGREDIENTS.filter((i) => i.unlock === levelId).map((i) => i.id);

export const START_OWNED = ownedAt(1);
export const QUALITY_MULT = [1, 1.3, 1.6];
export const MATCHA_PRICE = 4;            // the matcha itself; its fruit and extras are paid on top
export const MATCHA_LEVEL = 11;           // matcha machine and bar appear from this campaign level on
export const ENDLESS_UNLOCK_LEVEL = 15;   // win this level to unlock endless mode
export const ENDLESS_STAGE_SECONDS = 30;
export const MAX_BOWL_ITEMS = 6;          // items on top of the base
export const MAX_MATCHA_EXTRAS = 3;
export const TIP_RATE = 0.3;
export const PARTIAL_DELIVERY_BONUS = 0.15;

export const ING = Object.fromEntries(INGREDIENTS.map((i) => [i.id, i]));
export const ingredientsByLayer = (layer) => INGREDIENTS.filter((i) => i.layer === layer);
export const isMatchaFruit = (id) => ING[id]?.layer === 'mfruit';
export const isMatchaExtra = (id) => ING[id]?.layer === 'mextra';
export const isMatchaItem = (id) => MATCHA_LAYERS.includes(ING[id]?.layer);
// The bowl fruit whose art a matcha fruit borrows (its pieces, colour); any other id is its own art.
export const artOf = (id) => ING[id]?.art || id;

// Display name of an ingredient in the current language (short = for small bin labels).
export function ingName(id, short = false) {
  if (short && hasString(`ingshort.${id}`)) return t(`ingshort.${id}`);
  return t(`ing.${id}`);
}

export function qualityMult(id, ingLevels = {}) {
  return QUALITY_MULT[Math.min(ingLevels[id] || 0, QUALITY_MULT.length - 1)];
}

// Rounded UP to 0.5 (friendly numbers): rounding to nearest made some quality stars worth
// nothing (honey 1 → 1.5 → 1.5). The epsilon keeps float noise (5 × 1.3 × 2) from rounding up.
const toHalfUp = (v) => Math.ceil(v * 2 - 1e-9) / 2;

// Coins one use of an ingredient is worth; every quality star adds coins.
export function ingredientValue(id, ingLevels = {}) {
  const ing = ING[id];
  if (!ing) return 0;
  return toHalfUp(ing.price * qualityMult(id, ingLevels));
}

// A drink { fruit, extras }: the matcha, its fruit and every extra.
export function matchaValue(drink, ingLevels = {}) {
  if (!drink || !drink.fruit) return 0;
  return MATCHA_PRICE + ingredientValue(drink.fruit, ingLevels)
    + (drink.extras || []).reduce((sum, id) => sum + ingredientValue(id, ingLevels), 0);
}

// Cost of the next quality upgrade, or null when maxed.
export function qualityUpgradeCost(id, currentLevel = 0) {
  const ing = ING[id];
  if (!ing || currentLevel >= ing.upgradeCosts.length) return null;
  return ing.upgradeCosts[currentLevel];
}

// ---------------------------------------------------------------------------
// Campaign levels: 60 in six regions of ten (js/art-map.js MAP_REGIONS), every level one small step
// on from the one before. goals = coins for ★ / ★★ / ★★★ (tuned by tests/balance.test.mjs).
// After a guest arrives, the next one comes pace × the work of the order (orderWork: the drags it
// takes) seconds later – or sooner, once fewer than `crowd` guests are waiting (js/engine.js): from
// level 10 on two guests always wait at the same time. A guest waits patience + PATIENCE_PER_WORK ×
// that work seconds (before decor), so a big order buys time.
// mid / top = how many layer-2 / layer-3 items a bowl has [min,max] (capped by what has arrived);
// crowd = guests that wait at once at least; multi = the chance that a guest wants more than one of
// the bowl (2 … maxQty of it);
// matchaChance = a drink with the order, drinkOnly = of those, the share without a bowl;
// mExtras = extras on the drink [min,max]; overflow = blender can spoil; intro = mechanic explained
// before the level; hearts = customers you may lose.
export const PATIENCE_PER_WORK = 3.5;
export const BOWL_WORK = 4;
export const LEVELS = [
  { id: 1,  duration: 90, seats: 2, pace: 2.36, patience: 26, mid: [1, 1], top: [0, 1], matchaChance: 0,    drinkOnly: 0,    mExtras: [0, 0], crowd: 1, multi: 0,    maxQty: 2, goals: [57, 84, 110], hearts: 3, overflow: false, intro: 'basics' },
  { id: 2,  duration: 90, seats: 2, pace: 2.23, patience: 26, mid: [1, 1], top: [1, 1], matchaChance: 0,    drinkOnly: 0,    mExtras: [0, 0], crowd: 1, multi: 0,    maxQty: 2, goals: [59, 86, 117], hearts: 3, overflow: false, intro: null },
  { id: 3,  duration: 95, seats: 2, pace: 2.33, patience: 25, mid: [1, 2], top: [0, 1], matchaChance: 0,    drinkOnly: 0,    mExtras: [0, 0], crowd: 1, multi: 0,    maxQty: 2, goals: [61, 99, 136], hearts: 3, overflow: false, intro: null },
  { id: 4,  duration: 95, seats: 2, pace: 2.21, patience: 25, mid: [1, 2], top: [1, 1], matchaChance: 0,    drinkOnly: 0,    mExtras: [0, 0], crowd: 1, multi: 0,    maxQty: 2, goals: [63, 108, 145], hearts: 3, overflow: false, intro: null },
  { id: 5,  duration: 95, seats: 2, pace: 2.29, patience: 25, mid: [1, 2], top: [1, 1], matchaChance: 0,    drinkOnly: 0,    mExtras: [0, 0], crowd: 1, multi: 0,    maxQty: 2, goals: [65, 111, 151], hearts: 3, overflow: false, intro: null },
  { id: 6,  duration: 95, seats: 2, pace: 2.29, patience: 25, mid: [1, 2], top: [1, 1], matchaChance: 0,    drinkOnly: 0,    mExtras: [0, 0], crowd: 1, multi: 0,    maxQty: 2, goals: [67, 113, 153], hearts: 3, overflow: true, intro: 'overflow' },
  { id: 7,  duration: 100, seats: 2, pace: 2.27, patience: 24, mid: [1, 2], top: [1, 2], matchaChance: 0,    drinkOnly: 0,    mExtras: [0, 0], crowd: 1, multi: 0,    maxQty: 2, goals: [69, 116, 169], hearts: 3, overflow: true, intro: null },
  { id: 8,  duration: 100, seats: 3, pace: 2.25, patience: 24, mid: [1, 2], top: [1, 2], matchaChance: 0,    drinkOnly: 0,    mExtras: [0, 0], crowd: 1, multi: 0,    maxQty: 2, goals: [71, 118, 171], hearts: 3, overflow: true, intro: 'moreSeats' },
  { id: 9,  duration: 100, seats: 3, pace: 2.23, patience: 24, mid: [2, 2], top: [1, 2], matchaChance: 0,    drinkOnly: 0,    mExtras: [0, 0], crowd: 1, multi: 0,    maxQty: 2, goals: [83, 126, 182], hearts: 3, overflow: true, intro: null },
  { id: 10, duration: 100, seats: 3, pace: 2.12, patience: 24, mid: [2, 2], top: [1, 2], matchaChance: 0,    drinkOnly: 0,    mExtras: [0, 0], crowd: 2, multi: 0.2,  maxQty: 2, goals: [85, 128, 184], hearts: 3, overflow: true, intro: 'crowd' },
  { id: 11, duration: 105, seats: 3, pace: 2.21, patience: 23, mid: [1, 2], top: [1, 1], matchaChance: 0.35, drinkOnly: 0,    mExtras: [0, 0], crowd: 2, multi: 0.21, maxQty: 2, goals: [93, 141, 206], hearts: 3, overflow: true, intro: 'matcha' },
  { id: 12, duration: 105, seats: 3, pace: 2.08, patience: 23, mid: [1, 2], top: [1, 2], matchaChance: 0.4,  drinkOnly: 0.15, mExtras: [0, 0], crowd: 2, multi: 0.21, maxQty: 2, goals: [99, 155, 223], hearts: 3, overflow: true, intro: null },
  { id: 13, duration: 105, seats: 3, pace: 2.18, patience: 23, mid: [1, 2], top: [1, 2], matchaChance: 0.4,  drinkOnly: 0.15, mExtras: [0, 0], crowd: 2, multi: 0.22, maxQty: 2, goals: [101, 157, 235], hearts: 3, overflow: true, intro: null },
  { id: 14, duration: 105, seats: 3, pace: 2.16, patience: 22, mid: [1, 2], top: [1, 2], matchaChance: 0.45, drinkOnly: 0.15, mExtras: [0, 1], crowd: 2, multi: 0.22, maxQty: 2, goals: [103, 169, 238], hearts: 3, overflow: true, intro: 'extras' },
  { id: 15, duration: 110, seats: 3, pace: 2.03, patience: 22, mid: [2, 2], top: [1, 2], matchaChance: 0.45, drinkOnly: 0.15, mExtras: [0, 1], crowd: 2, multi: 0.23, maxQty: 2, goals: [115, 176, 271], hearts: 3, overflow: true, intro: null },
  { id: 16, duration: 110, seats: 3, pace: 2.13, patience: 22, mid: [2, 2], top: [1, 2], matchaChance: 0.5,  drinkOnly: 0.15, mExtras: [0, 1], crowd: 2, multi: 0.24, maxQty: 2, goals: [117, 178, 273], hearts: 3, overflow: true, intro: 'endless' },
  { id: 17, duration: 110, seats: 3, pace: 2.12, patience: 22, mid: [2, 2], top: [1, 2], matchaChance: 0.5,  drinkOnly: 0.15, mExtras: [0, 1], crowd: 2, multi: 0.24, maxQty: 2, goals: [119, 180, 275], hearts: 3, overflow: true, intro: null },
  { id: 18, duration: 110, seats: 3, pace: 1.99, patience: 21, mid: [2, 3], top: [1, 2], matchaChance: 0.5,  drinkOnly: 0.15, mExtras: [0, 1], crowd: 2, multi: 0.25, maxQty: 2, goals: [121, 185, 301], hearts: 3, overflow: true, intro: null },
  { id: 19, duration: 115, seats: 3, pace: 2.08, patience: 21, mid: [2, 3], top: [1, 2], matchaChance: 0.55, drinkOnly: 0.15, mExtras: [0, 1], crowd: 2, multi: 0.25, maxQty: 2, goals: [131, 202, 323], hearts: 3, overflow: true, intro: null },
  { id: 20, duration: 115, seats: 3, pace: 2.07, patience: 21, mid: [2, 3], top: [1, 2], matchaChance: 0.55, drinkOnly: 0.15, mExtras: [0, 1], crowd: 2, multi: 0.26, maxQty: 2, goals: [133, 204, 333], hearts: 3, overflow: true, intro: null },
  { id: 21, duration: 115, seats: 3, pace: 1.94, patience: 21, mid: [2, 3], top: [1, 2], matchaChance: 0.56, drinkOnly: 0.15, mExtras: [0, 2], crowd: 2, multi: 0.27, maxQty: 2, goals: [135, 221, 336], hearts: 3, overflow: true, intro: null },
  { id: 22, duration: 115, seats: 3, pace: 2.03, patience: 20, mid: [2, 3], top: [1, 2], matchaChance: 0.57, drinkOnly: 0.15, mExtras: [0, 2], crowd: 2, multi: 0.27, maxQty: 2, goals: [138, 231, 352], hearts: 3, overflow: true, intro: null },
  { id: 23, duration: 120, seats: 3, pace: 1.92, patience: 20, mid: [2, 3], top: [1, 3], matchaChance: 0.58, drinkOnly: 0.15, mExtras: [0, 2], crowd: 2, multi: 0.28, maxQty: 2, goals: [140, 233, 360], hearts: 3, overflow: true, intro: null },
  { id: 24, duration: 120, seats: 3, pace: 2.01, patience: 20, mid: [2, 3], top: [1, 3], matchaChance: 0.59, drinkOnly: 0.15, mExtras: [0, 2], crowd: 2, multi: 0.28, maxQty: 2, goals: [142, 235, 362], hearts: 3, overflow: true, intro: null },
  { id: 25, duration: 120, seats: 3, pace: 1.99, patience: 20, mid: [2, 3], top: [1, 3], matchaChance: 0.6,  drinkOnly: 0.15, mExtras: [1, 2], crowd: 2, multi: 0.29, maxQty: 2, goals: [144, 237, 364], hearts: 3, overflow: true, intro: null },
  { id: 26, duration: 120, seats: 3, pace: 1.87, patience: 20, mid: [2, 3], top: [2, 3], matchaChance: 0.61, drinkOnly: 0.15, mExtras: [1, 2], crowd: 2, multi: 0.3,  maxQty: 2, goals: [146, 239, 366], hearts: 3, overflow: true, intro: null },
  { id: 27, duration: 125, seats: 3, pace: 1.85, patience: 20, mid: [2, 3], top: [2, 3], matchaChance: 0.62, drinkOnly: 0.15, mExtras: [1, 2], crowd: 2, multi: 0.3,  maxQty: 2, goals: [154, 260, 384], hearts: 3, overflow: true, intro: null },
  { id: 28, duration: 125, seats: 3, pace: 1.94, patience: 20, mid: [2, 3], top: [2, 3], matchaChance: 0.63, drinkOnly: 0.15, mExtras: [1, 2], crowd: 2, multi: 0.31, maxQty: 2, goals: [159, 268, 393], hearts: 3, overflow: true, intro: null },
  { id: 29, duration: 125, seats: 3, pace: 1.83, patience: 19, mid: [2, 3], top: [2, 3], matchaChance: 0.64, drinkOnly: 0.15, mExtras: [1, 2], crowd: 2, multi: 0.31, maxQty: 2, goals: [165, 270, 395], hearts: 3, overflow: true, intro: null },
  { id: 30, duration: 125, seats: 3, pace: 1.92, patience: 19, mid: [2, 3], top: [2, 3], matchaChance: 0.65, drinkOnly: 0.15, mExtras: [1, 2], crowd: 2, multi: 0.32, maxQty: 3, goals: [168, 273, 397], hearts: 3, overflow: true, intro: null },
  { id: 31, duration: 130, seats: 3, pace: 1.79, patience: 19, mid: [2, 3], top: [2, 3], matchaChance: 0.66, drinkOnly: 0.15, mExtras: [1, 2], crowd: 2, multi: 0.33, maxQty: 3, goals: [170, 285, 399], hearts: 3, overflow: true, intro: null },
  { id: 32, duration: 130, seats: 3, pace: 1.77, patience: 19, mid: [2, 3], top: [2, 3], matchaChance: 0.67, drinkOnly: 0.15, mExtras: [1, 2], crowd: 2, multi: 0.33, maxQty: 3, goals: [172, 287, 401], hearts: 3, overflow: true, intro: null },
  { id: 33, duration: 130, seats: 3, pace: 1.87, patience: 18, mid: [2, 3], top: [2, 3], matchaChance: 0.68, drinkOnly: 0.15, mExtras: [1, 2], crowd: 2, multi: 0.34, maxQty: 3, goals: [174, 293, 403], hearts: 3, overflow: true, intro: null },
  { id: 34, duration: 130, seats: 3, pace: 1.75, patience: 18, mid: [2, 3], top: [2, 3], matchaChance: 0.69, drinkOnly: 0.15, mExtras: [1, 2], crowd: 2, multi: 0.34, maxQty: 3, goals: [185, 303, 449], hearts: 3, overflow: true, intro: null },
  { id: 35, duration: 135, seats: 3, pace: 1.73, patience: 18, mid: [2, 3], top: [2, 3], matchaChance: 0.7,  drinkOnly: 0.15, mExtras: [1, 2], crowd: 2, multi: 0.35, maxQty: 3, goals: [187, 305, 470], hearts: 3, overflow: true, intro: null },
  { id: 36, duration: 135, seats: 3, pace: 1.72, patience: 18, mid: [2, 3], top: [2, 3], matchaChance: 0.71, drinkOnly: 0.15, mExtras: [1, 2], crowd: 2, multi: 0.36, maxQty: 3, goals: [189, 307, 472], hearts: 3, overflow: true, intro: null },
  { id: 37, duration: 135, seats: 3, pace: 1.81, patience: 17, mid: [2, 3], top: [2, 3], matchaChance: 0.72, drinkOnly: 0.15, mExtras: [1, 2], crowd: 2, multi: 0.36, maxQty: 3, goals: [191, 309, 475], hearts: 3, overflow: true, intro: null },
  { id: 38, duration: 135, seats: 3, pace: 1.68, patience: 17, mid: [2, 3], top: [2, 3], matchaChance: 0.73, drinkOnly: 0.15, mExtras: [1, 2], crowd: 2, multi: 0.37, maxQty: 3, goals: [193, 311, 477], hearts: 3, overflow: true, intro: null },
  { id: 39, duration: 140, seats: 3, pace: 1.67, patience: 17, mid: [2, 3], top: [2, 3], matchaChance: 0.74, drinkOnly: 0.15, mExtras: [1, 2], crowd: 2, multi: 0.37, maxQty: 3, goals: [195, 334, 479], hearts: 3, overflow: true, intro: null },
  { id: 40, duration: 140, seats: 4, pace: 1.76, patience: 16, mid: [2, 3], top: [2, 3], matchaChance: 0.75, drinkOnly: 0.15, mExtras: [1, 2], crowd: 2, multi: 0.38, maxQty: 3, goals: [197, 336, 481], hearts: 4, overflow: true, intro: 'fourSeats' },
  { id: 41, duration: 140, seats: 4, pace: 1.64, patience: 16, mid: [2, 3], top: [2, 3], matchaChance: 0.76, drinkOnly: 0.15, mExtras: [1, 2], crowd: 2, multi: 0.39, maxQty: 3, goals: [199, 338, 483], hearts: 4, overflow: true, intro: null },
  { id: 42, duration: 140, seats: 4, pace: 1.63, patience: 16, mid: [2, 3], top: [2, 3], matchaChance: 0.77, drinkOnly: 0.15, mExtras: [1, 2], crowd: 2, multi: 0.39, maxQty: 3, goals: [215, 348, 503], hearts: 4, overflow: true, intro: null },
  { id: 43, duration: 145, seats: 4, pace: 1.61, patience: 16, mid: [2, 3], top: [2, 3], matchaChance: 0.78, drinkOnly: 0.15, mExtras: [1, 2], crowd: 2, multi: 0.4,  maxQty: 3, goals: [217, 351, 530], hearts: 4, overflow: true, intro: null },
  { id: 44, duration: 145, seats: 4, pace: 1.59, patience: 15, mid: [3, 3], top: [2, 3], matchaChance: 0.79, drinkOnly: 0.1,  mExtras: [1, 2], crowd: 2, multi: 0.4,  maxQty: 3, goals: [219, 353, 532], hearts: 4, overflow: true, intro: null },
  { id: 45, duration: 145, seats: 4, pace: 1.57, patience: 15, mid: [3, 3], top: [2, 3], matchaChance: 0.8,  drinkOnly: 0.1,  mExtras: [1, 2], crowd: 2, multi: 0.41, maxQty: 3, goals: [221, 355, 534], hearts: 4, overflow: true, intro: null },
  { id: 46, duration: 145, seats: 4, pace: 1.57, patience: 15, mid: [3, 3], top: [2, 3], matchaChance: 0.81, drinkOnly: 0.1,  mExtras: [1, 2], crowd: 2, multi: 0.42, maxQty: 3, goals: [223, 357, 536], hearts: 4, overflow: true, intro: null },
  { id: 47, duration: 150, seats: 4, pace: 1.55, patience: 15, mid: [3, 3], top: [2, 3], matchaChance: 0.82, drinkOnly: 0.1,  mExtras: [1, 2], crowd: 2, multi: 0.42, maxQty: 3, goals: [225, 372, 571], hearts: 4, overflow: true, intro: null },
  { id: 48, duration: 150, seats: 4, pace: 1.53, patience: 14, mid: [3, 3], top: [2, 3], matchaChance: 0.83, drinkOnly: 0.1,  mExtras: [1, 3], crowd: 2, multi: 0.43, maxQty: 3, goals: [227, 374, 591], hearts: 4, overflow: true, intro: null },
  { id: 49, duration: 150, seats: 4, pace: 1.52, patience: 14, mid: [3, 3], top: [2, 3], matchaChance: 0.84, drinkOnly: 0.1,  mExtras: [1, 3], crowd: 2, multi: 0.43, maxQty: 3, goals: [229, 376, 602], hearts: 4, overflow: true, intro: null },
  { id: 50, duration: 150, seats: 4, pace: 1.50, patience: 14, mid: [3, 3], top: [2, 3], matchaChance: 0.85, drinkOnly: 0.1,  mExtras: [1, 3], crowd: 2, multi: 0.44, maxQty: 3, goals: [231, 397, 623], hearts: 4, overflow: true, intro: null },
  { id: 51, duration: 155, seats: 4, pace: 1.48, patience: 14, mid: [3, 3], top: [2, 3], matchaChance: 0.86, drinkOnly: 0.1,  mExtras: [1, 3], crowd: 2, multi: 0.45, maxQty: 3, goals: [233, 399, 625], hearts: 4, overflow: true, intro: null },
  { id: 52, duration: 155, seats: 4, pace: 1.48, patience: 14, mid: [3, 3], top: [2, 3], matchaChance: 0.87, drinkOnly: 0.1,  mExtras: [1, 3], crowd: 2, multi: 0.45, maxQty: 3, goals: [235, 401, 627], hearts: 4, overflow: true, intro: null },
  { id: 53, duration: 155, seats: 4, pace: 1.46, patience: 14, mid: [3, 3], top: [2, 3], matchaChance: 0.88, drinkOnly: 0.1,  mExtras: [1, 3], crowd: 2, multi: 0.45, maxQty: 3, goals: [237, 403, 629], hearts: 4, overflow: true, intro: null },
  { id: 54, duration: 155, seats: 4, pace: 1.44, patience: 14, mid: [3, 3], top: [3, 3], matchaChance: 0.89, drinkOnly: 0.1,  mExtras: [1, 3], crowd: 2, multi: 0.45, maxQty: 3, goals: [239, 405, 631], hearts: 4, overflow: true, intro: null },
  { id: 55, duration: 160, seats: 4, pace: 1.42, patience: 13, mid: [3, 3], top: [3, 3], matchaChance: 0.9,  drinkOnly: 0.1,  mExtras: [1, 3], crowd: 2, multi: 0.45, maxQty: 3, goals: [241, 411, 654], hearts: 4, overflow: true, intro: null },
  { id: 56, duration: 160, seats: 4, pace: 1.41, patience: 13, mid: [3, 3], top: [3, 3], matchaChance: 0.91, drinkOnly: 0.1,  mExtras: [2, 3], crowd: 2, multi: 0.45, maxQty: 3, goals: [243, 413, 656], hearts: 4, overflow: true, intro: null },
  { id: 57, duration: 160, seats: 4, pace: 1.40, patience: 13, mid: [3, 3], top: [3, 3], matchaChance: 0.92, drinkOnly: 0.1,  mExtras: [2, 3], crowd: 2, multi: 0.45, maxQty: 3, goals: [245, 415, 658], hearts: 4, overflow: true, intro: null },
  { id: 58, duration: 160, seats: 4, pace: 1.38, patience: 13, mid: [3, 3], top: [3, 3], matchaChance: 0.93, drinkOnly: 0.1,  mExtras: [2, 3], crowd: 2, multi: 0.45, maxQty: 3, goals: [247, 417, 668], hearts: 4, overflow: true, intro: null },
  { id: 59, duration: 165, seats: 4, pace: 1.37, patience: 12, mid: [3, 3], top: [3, 3], matchaChance: 0.94, drinkOnly: 0.1,  mExtras: [2, 3], crowd: 2, multi: 0.45, maxQty: 3, goals: [249, 441, 670], hearts: 4, overflow: true, intro: null },
  { id: 60, duration: 165, seats: 4, pace: 1.35, patience: 12, mid: [3, 3], top: [3, 3], matchaChance: 0.95, drinkOnly: 0.1,  mExtras: [2, 3], crowd: 2, multi: 0.45, maxQty: 3, goals: [253, 443, 672], hearts: 4, overflow: true, intro: null },
];
for (const l of LEVELS) if (l.hearts === undefined) l.hearts = 3;

export const REGION_SIZE = 10;
export const REGIONS = ['beach', 'town', 'forest', 'tea', 'harbor', 'night'];
export const regionOf = (levelId) => REGIONS[Math.min(REGIONS.length - 1, Math.floor((levelId - 1) / REGION_SIZE))];

export const getLevel = (id) => LEVELS.find((l) => l.id === id) || null;

// The drags an order takes: a bowl needs a cup, half a blender load and switching it on, the pour,
// each item and the serve – every one of the `qty` bowls; a drink its fruit, each extra and the
// serve. Paces the guests and sets their patience.
export function orderWork(order) {
  let w = 0;
  const b = order?.bowl;
  if (b) w += (BOWL_WORK + (b.mid?.length || 0) + (b.top?.length || 0)) * (order.qty || 1);
  const d = order?.matcha;
  if (d) w += 2 + (d.extras?.length || 0);
  return w;
}

// Difficulty for endless mode; stage = floor(elapsed / ENDLESS_STAGE_SECONDS).
export function endlessConfig(stage) {
  const s = Math.max(0, stage | 0);
  return {
    id: 'endless',
    seats: Math.min(4, 2 + Math.floor((s + 1) / 2)),
    pace: Math.max(0.55, 2.2 - 0.16 * s),
    patience: Math.max(4, 28 - 2.5 * s),
    patiencePerWork: Math.max(2, PATIENCE_PER_WORK - 0.1 * s),
    mid: [Math.min(2, 1 + Math.floor(s / 3)), Math.min(3, 1 + Math.ceil(s / 2))],
    top: [Math.min(2, Math.floor(s / 2)), Math.min(3, 1 + Math.floor(s / 2))],
    matchaChance: Math.min(0.75, 0.35 + 0.05 * s),
    crowd: s >= 1 ? 2 : 1,
    multi: Math.min(0.4, 0.1 * s),
    maxQty: s >= 4 ? 3 : 2,
    drinkOnly: 0.15,
    mExtras: [Math.min(1, Math.floor(s / 4)), Math.min(2, Math.floor((s + 1) / 2))],
    overflow: true,
    hearts: 3,
  };
}

// ---------------------------------------------------------------------------
// Kitchen & shop upgrades. Each entry has levels; buying level n applies its fields.
export const KITCHEN_BASE = {
  blendTime: 6,       // seconds the blender needs
  readyHold: 9,       // seconds a ready blender waits before it starts to overflow
  overflowTime: 5,    // seconds of overflowing before it is ruined
  portions: 2,        // bowls per blender batch
  blenders: 1,
  bowlSlots: 2,
  matchaSlots: 1,
  meltTime: 20,       // seconds a ready blender that was switched off keeps its base fresh (unless frozen)
  freeze: 0,          // blenders (the first ones) with the freeze upgrade: switched off, their base never spoils
  matchaTime: 5,      // purée (MATCHA_BLEND of it), then the matcha poured on top
  cupLift: 0,         // bowl spots (from the left) with a cup lift: an empty cup rises out of the counter
  cupLiftTime: 1.2,   // seconds a lift takes to push a cup up (every spot on its own)
  patienceMult: 1,
};
export const MATCHA_BLEND = 0.45;

export const UPGRADES = [
  { id: 'blenderSpeed',  cat: 'kitchen', levels: [{ cost: 120, blendTime: 4.8 }, { cost: 250, blendTime: 3.8 }, { cost: 450, blendTime: 3.0 }] },
  // A bigger batch needs longer to be used up, so it also stays fresh longer (otherwise the
  // third portion mostly spoils and the upgrade costs coins instead of earning them).
  { id: 'jug',           cat: 'kitchen', levels: [{ cost: 220, portions: 3, readyHold: 13.5, meltTime: 27 }] },
  { id: 'blender2',      cat: 'kitchen', levels: [{ cost: 400, blenders: 2 }] },
  { id: 'bowlSlots',     cat: 'kitchen', levels: [{ cost: 150, bowlSlots: 3 }, { cost: 300, bowlSlots: 4 }] },
  // a cup lift under a bowl spot pushes a fresh cup up out of the counter whenever the spot is empty;
  // bought spot by spot (needs = upgrades that must be there first: the spot itself)
  { id: 'cupLift',       cat: 'kitchen', levels: [{ cost: 110, cupLift: 1 }, { cost: 150, cupLift: 2 }, { cost: 200, cupLift: 3, needs: { bowlSlots: 1 } }, { cost: 260, cupLift: 4, needs: { bowlSlots: 2 } }] },
  // a cooling ring in the blender's base: switched off, its base stays frozen and never spoils
  { id: 'freeze',        cat: 'kitchen', levels: [{ cost: 170, freeze: 1 }, { cost: 230, freeze: 2, needs: { blender2: 1 } }] },
  { id: 'matchaSlots',   cat: 'kitchen', requiresLevel: MATCHA_LEVEL, levels: [{ cost: 230, matchaSlots: 2 }] },
  { id: 'plants',        cat: 'decor',   levels: [{ cost: 120, patience: 0.08 }] },
  { id: 'jukebox',       cat: 'decor',   levels: [{ cost: 250, patience: 0.10 }] },
  { id: 'seating',       cat: 'decor',   levels: [{ cost: 350, patience: 0.12 }] },
  { id: 'neon',          cat: 'decor',   levels: [{ cost: 550, patience: 0.10 }] },
];
export const UPG = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

// upgrades = { [upgradeId]: purchasedLevelCount }
export function getKitchenStats(upgrades = {}) {
  const k = { ...KITCHEN_BASE };
  for (const u of UPGRADES) {
    const n = Math.min(upgrades[u.id] || 0, u.levels.length);
    for (let i = 0; i < n; i++) {
      const lv = u.levels[i];
      for (const [key, val] of Object.entries(lv)) {
        if (key === 'cost' || key === 'needs') continue;
        if (key === 'patience') k.patienceMult += val;
        else k[key] = val;
      }
    }
  }
  k.patienceMult = Math.round(k.patienceMult * 100) / 100;
  return k;
}

export function nextUpgradeCost(upgradeId, upgrades = {}) {
  const u = UPG[upgradeId];
  const n = upgrades[upgradeId] || 0;
  return u && n < u.levels.length ? u.levels[n].cost : null;
}

// The upgrade the next level of upgradeId waits for ({ id, lvl }: buy that first), or null.
export function upgradeNeeds(upgradeId, upgrades = {}) {
  const u = UPG[upgradeId];
  const lv = u?.levels[upgrades[upgradeId] || 0];
  for (const [id, lvl] of Object.entries(lv?.needs || {})) if ((upgrades[id] || 0) < lvl) return { id, lvl };
  return null;
}

// ---------------------------------------------------------------------------
registerStrings({
  de: {
    'ing.acai': 'Açaí', 'ing.pitaya': 'Pitaya', 'ing.spirulina': 'Blaue Spirulina',
    'ing.banana': 'Banane', 'ing.granola': 'Granola', 'ing.strawberry': 'Erdbeere',
    'ing.blueberry': 'Blaubeeren', 'ing.mango': 'Mango', 'ing.kiwi': 'Kiwi',
    'ing.honey': 'Honig', 'ing.coconut': 'Kokosraspeln', 'ing.chia': 'Chiasamen',
    'ing.peanut': 'Erdnussbutter', 'ing.chocolate': 'Schoko-Soße', 'ing.mint': 'Minze', 'ing.cacao': 'Kakao-Nibs',
    'ingshort.spirulina': 'Spirulina', 'ingshort.blueberry': 'Blaubeere', 'ingshort.coconut': 'Kokos',
    'ingshort.chia': 'Chia', 'ingshort.peanut': 'Erdnuss', 'ingshort.chocolate': 'Schoko', 'ingshort.cacao': 'Kakao',
    'ing.mStrawberry': 'Erdbeeren', 'ing.mBanana': 'Banane', 'ing.mMango': 'Mango', 'ing.mBlueberry': 'Blaubeeren',
    'ing.ice': 'Eiswürfel', 'ing.vanilla': 'Vanillesirup', 'ing.foam': 'Cold Foam',
    'ingshort.mStrawberry': 'Erdbeere', 'ingshort.mBlueberry': 'Blaubeere', 'ingshort.ice': 'Eis', 'ingshort.vanilla': 'Vanille',
    'matcha.mBanana': 'Bananen-Matcha', 'matcha.mStrawberry': 'Erdbeer-Matcha',
    'matcha.mBlueberry': 'Blaubeer-Matcha', 'matcha.mMango': 'Mango-Matcha',
    'layer.base': 'Basis', 'layer.mid': 'Früchte & Crunch', 'layer.top': 'Toppings & Soßen',
    'layer.mfruit': 'Matcha-Frucht', 'layer.mextra': 'Matcha-Extras',
    'upg.blenderSpeed': 'Turbo-Mixer', 'upgdesc.blenderSpeed': 'Ein stärkeres Modell: Der Mixer ist schneller fertig.',
    'upg.jug': 'Großer Mixkrug', 'upgdesc.jug': '3 Bowls pro Mischung – und bleibt länger frisch.',
    'upg.blender2': 'Zweiter Mixer', 'upgdesc.blender2': 'Zwei Basen gleichzeitig mixen.',
    'upg.bowlSlots': 'Mehr Bowl-Plätze', 'upgdesc.bowlSlots': 'Mehr Bowls gleichzeitig vorbereiten.',
    'upg.cupLift': 'Auto-Cup-Refill', 'upgdesc.cupLift': 'Ein Lift im Platz schiebt automatisch einen leeren Becher hoch – pro Bowl-Platz.',
    'upg.freeze': 'Freeze-Mixer', 'upgdesc.freeze': 'Kühlt den Mixer: ausgeschaltet bleibt die Basis frisch – pro Mixer.',
    'upg.matchaSlots': 'Doppel-Matcha', 'upgdesc.matchaSlots': 'Zwei Plätze: zwei Matcha gleichzeitig.',
    'upg.plants': 'Tropische Pflanzen', 'upgdesc.plants': 'Gäste warten 8 % länger.',
    'upg.jukebox': 'Jukebox', 'upgdesc.jukebox': 'Gute Musik: Gäste warten 10 % länger.',
    'upg.seating': 'Gemütliche Sitzecke', 'upgdesc.seating': 'Gäste warten 12 % länger.',
    'upg.neon': 'Neon-Schild', 'upgdesc.neon': 'Leuchtet schön: Gäste warten 10 % länger.',
  },
  en: {
    'ing.acai': 'Açaí', 'ing.pitaya': 'Pitaya', 'ing.spirulina': 'Blue Spirulina',
    'ing.banana': 'Banana', 'ing.granola': 'Granola', 'ing.strawberry': 'Strawberry',
    'ing.blueberry': 'Blueberries', 'ing.mango': 'Mango', 'ing.kiwi': 'Kiwi',
    'ing.honey': 'Honey', 'ing.coconut': 'Coconut flakes', 'ing.chia': 'Chia seeds',
    'ing.peanut': 'Peanut butter', 'ing.chocolate': 'Chocolate sauce', 'ing.mint': 'Mint', 'ing.cacao': 'Cacao nibs',
    'ingshort.spirulina': 'Spirulina', 'ingshort.blueberry': 'Blueberry', 'ingshort.coconut': 'Coconut',
    'ingshort.chia': 'Chia', 'ingshort.peanut': 'Peanut', 'ingshort.chocolate': 'Choco', 'ingshort.cacao': 'Cacao',
    'ing.mStrawberry': 'Strawberries', 'ing.mBanana': 'Banana', 'ing.mMango': 'Mango', 'ing.mBlueberry': 'Blueberries',
    'ing.ice': 'Ice cubes', 'ing.vanilla': 'Vanilla syrup', 'ing.foam': 'Cold foam',
    'ingshort.mStrawberry': 'Strawberry', 'ingshort.mBlueberry': 'Blueberry', 'ingshort.ice': 'Ice', 'ingshort.vanilla': 'Vanilla',
    'matcha.mBanana': 'Banana matcha', 'matcha.mStrawberry': 'Strawberry matcha',
    'matcha.mBlueberry': 'Blueberry matcha', 'matcha.mMango': 'Mango matcha',
    'layer.base': 'Base', 'layer.mid': 'Fruits & Crunch', 'layer.top': 'Toppings & Sauces',
    'layer.mfruit': 'Matcha fruit', 'layer.mextra': 'Matcha extras',
    'upg.blenderSpeed': 'Turbo blender', 'upgdesc.blenderSpeed': 'A stronger model: the blender finishes faster.',
    'upg.jug': 'Big blender jug', 'upgdesc.jug': '3 bowls per batch – and stays fresh longer.',
    'upg.blender2': 'Second blender', 'upgdesc.blender2': 'Blend two bases at the same time.',
    'upg.bowlSlots': 'More bowl spots', 'upgdesc.bowlSlots': 'Prepare more bowls at once.',
    'upg.cupLift': 'Auto cup refill', 'upgdesc.cupLift': 'A lift in the spot pushes up an empty cup by itself – per bowl spot.',
    'upg.freeze': 'Freeze blender', 'upgdesc.freeze': 'Cools the blender: switched off, its base stays fresh – per blender.',
    'upg.matchaSlots': 'Double matcha', 'upgdesc.matchaSlots': 'Two brewing spots: two matchas at once.',
    'upg.plants': 'Tropical plants', 'upgdesc.plants': 'Customers wait 8% longer.',
    'upg.jukebox': 'Jukebox', 'upgdesc.jukebox': 'Good music: customers wait 10% longer.',
    'upg.seating': 'Cozy seating', 'upgdesc.seating': 'Customers wait 12% longer.',
    'upg.neon': 'Neon sign', 'upgdesc.neon': 'Glows nicely: customers wait 10% longer.',
  },
});
