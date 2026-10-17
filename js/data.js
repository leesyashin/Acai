// Canonical game content: ingredients, levels, upgrades and derived stats.
// Pure module (no DOM) – imported by the engine tests in Node.

import { registerStrings, t, hasString } from './i18n.js';

export const LAYERS = ['base', 'mid', 'top'];

// price = coins per use (before quality); cost = shop unlock price (0 = owned at start)
// upgradeCosts = quality level 1 and 2 (value ×1.3 / ×1.6)
// style tells art.js how the ingredient sits on a bowl.
export const INGREDIENTS = [
  // Base – comes out of the blender
  { id: 'acai',       layer: 'base', price: 5, cost: 0,   upgradeCosts: [100, 260],  color: '#4a1a5e', color2: '#7b3a96', style: 'base' },
  { id: 'pitaya',     layer: 'base', price: 7, cost: 180, upgradeCosts: [140, 330],  color: '#ff3d8b', color2: '#ff86b8', style: 'base' },
  { id: 'spirulina',  layer: 'base', price: 9, cost: 320, upgradeCosts: [180, 400],  color: '#2a9fd8', color2: '#7fd3f5', style: 'base' },
  // Fruits & crunch
  { id: 'banana',     layer: 'mid', price: 2, cost: 0,   upgradeCosts: [60, 170],   color: '#ffe066', color2: '#f2c230', style: 'slices', smoothie: true },
  { id: 'granola',    layer: 'mid', price: 2, cost: 0,   upgradeCosts: [60, 170],   color: '#d9973f', color2: '#a8692a', style: 'pile' },
  { id: 'strawberry', layer: 'mid', price: 3, cost: 70,  upgradeCosts: [80, 220],   color: '#ff3b47', color2: '#3fae4a', style: 'halves', smoothie: true },
  { id: 'blueberry',  layer: 'mid', price: 3, cost: 100, upgradeCosts: [100, 250],  color: '#4656c9', color2: '#2c3687', style: 'berries', smoothie: true },
  { id: 'mango',      layer: 'mid', price: 4, cost: 130, upgradeCosts: [110, 280],  color: '#ffad1f', color2: '#ff8a00', style: 'cubes', smoothie: true },
  { id: 'kiwi',       layer: 'mid', price: 5, cost: 200, upgradeCosts: [140, 320],  color: '#8cc63f', color2: '#5a3d1c', style: 'slices', smoothie: true },
  // Toppings & sauces
  { id: 'honey',      layer: 'top', price: 1, cost: 0,   upgradeCosts: [50, 140],   color: '#ffb81c', color2: '#e08a00', style: 'drizzle' },
  { id: 'coconut',    layer: 'top', price: 2, cost: 50,  upgradeCosts: [55, 150],   color: '#fffaf0', color2: '#e8dcc4', style: 'flakes' },
  { id: 'chia',       layer: 'top', price: 2, cost: 90,  upgradeCosts: [75, 200],   color: '#3a3a3a', color2: '#8a8a8a', style: 'seeds' },
  { id: 'peanut',     layer: 'top', price: 3, cost: 150, upgradeCosts: [100, 250],  color: '#c47a35', color2: '#8e5220', style: 'drizzle' },
  { id: 'chocolate',  layer: 'top', price: 3, cost: 200, upgradeCosts: [120, 290],  color: '#5a2e17', color2: '#3a1c0c', style: 'drizzle' },
  { id: 'mint',       layer: 'top', price: 3, cost: 240, upgradeCosts: [140, 320],  color: '#2fbf5a', color2: '#1d8a3e', style: 'leaves' },
  { id: 'cacao',      layer: 'top', price: 4, cost: 280, upgradeCosts: [150, 350],  color: '#6b3a22', color2: '#3f2012', style: 'chunks' },
];

export const START_OWNED = ['acai', 'banana', 'granola', 'honey'];
export const QUALITY_MULT = [1, 1.3, 1.6];
export const SMOOTHIE_PRICE = 6;
export const SMOOTHIE_LEVEL = 7;          // smoothie machine appears from this campaign level on
export const ENDLESS_UNLOCK_LEVEL = 10;   // win this level to unlock endless mode
export const ENDLESS_STAGE_SECONDS = 30;
export const MAX_BOWL_ITEMS = 6;          // items on top of the base
export const TIP_RATE = 0.3;
export const PARTIAL_DELIVERY_BONUS = 0.15;
export const SMOOTHIE_PATIENCE_BONUS = 8;

export const ING = Object.fromEntries(INGREDIENTS.map((i) => [i.id, i]));
export const ingredientsByLayer = (layer) => INGREDIENTS.filter((i) => i.layer === layer);
export const isSmoothieFruit = (id) => !!ING[id]?.smoothie;

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

export function smoothieValue(fruitId, ingLevels = {}) {
  return toHalfUp(SMOOTHIE_PRICE * qualityMult(fruitId, ingLevels));
}

// Cost of the next quality upgrade, or null when maxed.
export function qualityUpgradeCost(id, currentLevel = 0) {
  const ing = ING[id];
  if (!ing || currentLevel >= ing.upgradeCosts.length) return null;
  return ing.upgradeCosts[currentLevel];
}

// ---------------------------------------------------------------------------
// Campaign levels. goals = coins for ★ / ★★ / ★★★ (tuned by tests/balance.test.mjs).
// spawnGap = seconds between customers [min,max]; patience = seconds (before decor bonus)
// mid / top = how many layer-2 / layer-3 items an order has [min,max] (capped by owned items)
// overflow = blender can spoil; intro = mechanic explained before the level.
// hearts = customers you may lose (default 3). With 4 seats the counter is full most of the time
// and a customer waits about 4 orders long (3 before): those levels get 4 hearts and more patience
// (61 s falling to 53 s) so a casual 2 s-per-drag player can still finish the campaign
// (see tests/balance.test.mjs). Every bowl needs a cup put down first – one drag more than a bowl
// used to take, which the patience, spawn gaps and goals make up for.
export const LEVELS = [
  { id: 1,  duration: 90,  seats: 2, spawnGap: [7.4, 10.5], patience: 63, mid: [1, 1], top: [0, 1], smoothieChance: 0,    goals: [45, 65, 85],    overflow: false, intro: 'basics' },
  { id: 2,  duration: 90,  seats: 2, spawnGap: [6.8, 10],   patience: 59, mid: [1, 2], top: [0, 1], smoothieChance: 0,    goals: [55, 80, 100],   overflow: false, intro: null },
  { id: 3,  duration: 100, seats: 2, spawnGap: [6.3, 9.5],  patience: 57, mid: [1, 2], top: [0, 1], smoothieChance: 0,    goals: [85, 115, 130],  overflow: true,  intro: 'overflow' },
  { id: 4,  duration: 100, seats: 2, spawnGap: [6.3, 8.9],  patience: 55, mid: [1, 2], top: [1, 1], smoothieChance: 0,    goals: [95, 125, 150],  overflow: true,  intro: null },
  { id: 5,  duration: 110, seats: 3, spawnGap: [5.8, 8.9],  patience: 55, mid: [1, 2], top: [0, 2], smoothieChance: 0,    goals: [115, 155, 175], overflow: true,  intro: 'moreSeats' },
  { id: 6,  duration: 110, seats: 3, spawnGap: [5.8, 8.4],  patience: 53, mid: [1, 2], top: [1, 2], smoothieChance: 0,    goals: [120, 170, 205], overflow: true,  intro: null },
  { id: 7,  duration: 120, seats: 3, spawnGap: [5.8, 8.4],  patience: 55, mid: [1, 2], top: [0, 2], smoothieChance: 0.35, goals: [150, 210, 255], overflow: true,  intro: 'smoothie' },
  { id: 8,  duration: 120, seats: 3, spawnGap: [5.3, 7.9],  patience: 53, mid: [1, 2], top: [1, 2], smoothieChance: 0.35, goals: [155, 220, 280], overflow: true,  intro: null },
  { id: 9,  duration: 120, seats: 3, spawnGap: [5.3, 7.9],  patience: 51, mid: [2, 2], top: [1, 2], smoothieChance: 0.4,  goals: [160, 230, 295], overflow: true,  intro: null },
  { id: 10, duration: 130, seats: 3, spawnGap: [5, 7.4],    patience: 51, mid: [1, 3], top: [1, 2], smoothieChance: 0.4,  goals: [175, 245, 325], overflow: true,  intro: null },
  { id: 11, duration: 130, seats: 3, spawnGap: [4.8, 7.4],  patience: 49, mid: [2, 3], top: [1, 2], smoothieChance: 0.4,  goals: [185, 250, 340], overflow: true,  intro: 'endless' },
  { id: 12, duration: 130, seats: 4, spawnGap: [4.8, 7.4],  patience: 61, mid: [1, 3], top: [1, 2], smoothieChance: 0.4,  goals: [195, 255, 350], hearts: 4, overflow: true,  intro: 'fourSeats' },
  { id: 13, duration: 140, seats: 4, spawnGap: [4.6, 6.9],  patience: 60, mid: [2, 3], top: [1, 3], smoothieChance: 0.45, goals: [200, 295, 405], hearts: 4, overflow: true,  intro: null },
  { id: 14, duration: 140, seats: 4, spawnGap: [4.4, 6.7],  patience: 59, mid: [2, 3], top: [1, 3], smoothieChance: 0.45, goals: [205, 300, 415], hearts: 4, overflow: true,  intro: null },
  { id: 15, duration: 140, seats: 4, spawnGap: [4.2, 6.5],  patience: 58, mid: [2, 3], top: [1, 3], smoothieChance: 0.45, goals: [210, 305, 425], hearts: 4, overflow: true,  intro: null },
  { id: 16, duration: 150, seats: 4, spawnGap: [4.2, 6.3],  patience: 57, mid: [2, 3], top: [2, 3], smoothieChance: 0.5,  goals: [215, 340, 470], hearts: 4, overflow: true,  intro: null },
  { id: 17, duration: 150, seats: 4, spawnGap: [4, 6.1],    patience: 56, mid: [2, 3], top: [2, 3], smoothieChance: 0.5,  goals: [220, 345, 475], hearts: 4, overflow: true,  intro: null },
  { id: 18, duration: 150, seats: 4, spawnGap: [3.9, 5.9],  patience: 55, mid: [2, 3], top: [2, 3], smoothieChance: 0.5,  goals: [225, 350, 485], hearts: 4, overflow: true,  intro: null },
  { id: 19, duration: 160, seats: 4, spawnGap: [3.8, 5.7],  patience: 54, mid: [2, 3], top: [2, 3], smoothieChance: 0.5,  goals: [230, 360, 500], hearts: 4, overflow: true,  intro: null },
  { id: 20, duration: 160, seats: 4, spawnGap: [3.7, 5.5],  patience: 53, mid: [2, 3], top: [2, 3], smoothieChance: 0.55, goals: [235, 370, 515], hearts: 4, overflow: true,  intro: null },
];
for (const l of LEVELS) if (l.hearts === undefined) l.hearts = 3;

export const getLevel = (id) => LEVELS.find((l) => l.id === id) || null;

// Difficulty for endless mode; stage = floor(elapsed / ENDLESS_STAGE_SECONDS).
export function endlessConfig(stage) {
  const s = Math.max(0, stage | 0);
  return {
    id: 'endless',
    seats: Math.min(4, 2 + Math.floor((s + 1) / 2)),
    spawnGap: [Math.max(2.5, 6.8 - 0.35 * s), Math.max(3.8, 9.5 - 0.45 * s)],
    patience: Math.max(20, 57 - 2 * s),
    mid: [Math.min(2, 1 + Math.floor(s / 3)), Math.min(3, 1 + Math.ceil(s / 2))],
    top: [Math.min(2, Math.floor(s / 2)), Math.min(3, 1 + Math.floor(s / 2))],
    smoothieChance: Math.min(0.5, 0.3 + 0.03 * s),
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
  smoothieSlots: 1,
  smoothieTime: 5,
  patienceMult: 1,
};

export const UPGRADES = [
  { id: 'blenderSpeed',  cat: 'kitchen', levels: [{ cost: 120, blendTime: 4.8 }, { cost: 250, blendTime: 3.8 }, { cost: 450, blendTime: 3.0 }] },
  // A bigger batch needs longer to be used up, so it also stays fresh longer (otherwise the
  // third portion mostly spoils and the upgrade costs coins instead of earning them).
  { id: 'jug',           cat: 'kitchen', levels: [{ cost: 220, portions: 3, readyHold: 13.5 }] },
  { id: 'blender2',      cat: 'kitchen', levels: [{ cost: 400, blenders: 2 }] },
  { id: 'bowlSlots',     cat: 'kitchen', levels: [{ cost: 150, bowlSlots: 3 }, { cost: 300, bowlSlots: 4 }] },
  { id: 'smoothieSlots', cat: 'kitchen', requiresLevel: SMOOTHIE_LEVEL, levels: [{ cost: 230, smoothieSlots: 2 }] },
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
        if (key === 'cost') continue;
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
    'smoothie.banana': 'Bananen-Smoothie', 'smoothie.strawberry': 'Erdbeer-Smoothie',
    'smoothie.blueberry': 'Blaubeer-Smoothie', 'smoothie.mango': 'Mango-Smoothie', 'smoothie.kiwi': 'Kiwi-Smoothie',
    'layer.base': 'Basis', 'layer.mid': 'Früchte & Crunch', 'layer.top': 'Toppings & Soßen',
    'upg.blenderSpeed': 'Turbo-Mixer', 'upgdesc.blenderSpeed': 'Der Mixer ist schneller fertig.',
    'upg.jug': 'Großer Mixkrug', 'upgdesc.jug': '3 Bowls pro Mischung – und bleibt länger frisch.',
    'upg.blender2': 'Zweiter Mixer', 'upgdesc.blender2': 'Zwei Basen gleichzeitig mixen.',
    'upg.bowlSlots': 'Mehr Bowl-Plätze', 'upgdesc.bowlSlots': 'Mehr Bowls gleichzeitig vorbereiten.',
    'upg.smoothieSlots': 'Doppel-Smoothie', 'upgdesc.smoothieSlots': 'Zwei Smoothies gleichzeitig mixen.',
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
    'smoothie.banana': 'Banana smoothie', 'smoothie.strawberry': 'Strawberry smoothie',
    'smoothie.blueberry': 'Blueberry smoothie', 'smoothie.mango': 'Mango smoothie', 'smoothie.kiwi': 'Kiwi smoothie',
    'layer.base': 'Base', 'layer.mid': 'Fruits & Crunch', 'layer.top': 'Toppings & Sauces',
    'upg.blenderSpeed': 'Turbo blender', 'upgdesc.blenderSpeed': 'The blender finishes faster.',
    'upg.jug': 'Big blender jug', 'upgdesc.jug': '3 bowls per batch – and stays fresh longer.',
    'upg.blender2': 'Second blender', 'upgdesc.blender2': 'Blend two bases at the same time.',
    'upg.bowlSlots': 'More bowl spots', 'upgdesc.bowlSlots': 'Prepare more bowls at once.',
    'upg.smoothieSlots': 'Double smoothie', 'upgdesc.smoothieSlots': 'Mix two smoothies at the same time.',
    'upg.plants': 'Tropical plants', 'upgdesc.plants': 'Customers wait 8% longer.',
    'upg.jukebox': 'Jukebox', 'upgdesc.jukebox': 'Good music: customers wait 10% longer.',
    'upg.seating': 'Cozy seating', 'upgdesc.seating': 'Customers wait 12% longer.',
    'upg.neon': 'Neon sign', 'upgdesc.neon': 'Glows nicely: customers wait 10% longer.',
  },
});
