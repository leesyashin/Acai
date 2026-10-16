// Persistent player progress. localStorage when available, in-memory otherwise.
// All shop / progress mutations go through the helpers below.

import {
  START_OWNED, ING, UPG, LEVELS, ENDLESS_UNLOCK_LEVEL, SMOOTHIE_LEVEL,
  getKitchenStats, qualityUpgradeCost, nextUpgradeCost,
} from './data.js';
import { detectLang, LANGS } from './i18n.js';

const KEY = 'acaiFever.save.v1';
const listeners = new Set();
let data = null;

export function defaultSave() {
  return {
    version: 1,
    coins: 0,
    owned: START_OWNED.slice(),
    ingLevels: {},
    upgrades: {},
    stars: {},
    endlessBest: 0,
    newIngredients: [],
    seenIntros: {},
    settings: { lang: detectLang(), music: true, sfx: true },
    stats: { served: 0, earned: 0, played: 0 },
  };
}

function merge(raw) {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const out = { ...d, ...raw };
  out.settings = { ...d.settings, ...(raw.settings || {}) };
  out.stats = { ...d.stats, ...(raw.stats || {}) };
  out.owned = Array.isArray(raw.owned) ? raw.owned.filter((id) => ING[id]) : d.owned;
  for (const id of START_OWNED) if (!out.owned.includes(id)) out.owned.push(id);
  out.ingLevels = { ...(raw.ingLevels || {}) };
  out.upgrades = { ...(raw.upgrades || {}) };
  out.stars = { ...(raw.stars || {}) };
  out.newIngredients = Array.isArray(raw.newIngredients) ? raw.newIngredients : [];
  out.seenIntros = { ...(raw.seenIntros || {}) };
  out.coins = Number.isFinite(raw.coins) ? Math.max(0, raw.coins) : 0;
  out.owned = [...new Set(out.owned)];
  if (!LANGS.includes(out.settings.lang)) out.settings.lang = d.settings.lang;
  out.endlessBest = Number.isFinite(raw.endlessBest) ? Math.max(0, raw.endlessBest) : 0;
  return out;
}

// initial = optional snapshot (e.g. from the artifact hot-reload hook) used when storage is empty.
export function loadSave(initial) {
  let raw = null;
  try {
    const s = localStorage.getItem(KEY);
    if (s) raw = JSON.parse(s);
  } catch {
    raw = null;
  }
  data = merge(raw || initial);
  return data;
}

export function getSave() {
  if (!data) loadSave();
  return data;
}

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage blocked – keep in memory */
  }
  for (const fn of listeners) fn(data);
}

export function updateSave(fn) {
  fn(getSave());
  persist();
  return data;
}

export function onSaveChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetSave() {
  const lang = getSave().settings.lang;
  data = defaultSave();
  data.settings.lang = lang;
  persist();
  return data;
}

// ---------------------------------------------------------------- queries
export const isOwned = (id) => getSave().owned.includes(id);
export const kitchenStats = () => getKitchenStats(getSave().upgrades);
export const levelStars = (id) => getSave().stars[id] || 0;
export const isLevelUnlocked = (id) => id === 1 || levelStars(id - 1) > 0;
export const isEndlessUnlocked = () => levelStars(ENDLESS_UNLOCK_LEVEL) > 0;
export const totalStars = () => Object.values(getSave().stars).reduce((a, b) => a + b, 0);
export function maxUnlockedLevel() {
  let max = 1;
  for (const l of LEVELS) if (isLevelUnlocked(l.id)) max = l.id;
  return max;
}
export const hasSmoothieMachine = () => maxUnlockedLevel() >= SMOOTHIE_LEVEL;
export const upgradeLevel = (id) => getSave().upgrades[id] || 0;
export const ingLevel = (id) => getSave().ingLevels[id] || 0;

// ---------------------------------------------------------------- actions
export function addCoins(n) {
  updateSave((d) => {
    d.coins = Math.max(0, Math.round((d.coins + n) * 10) / 10);
  });
}

export function buyIngredient(id) {
  const ing = ING[id];
  if (!ing) return { ok: false, reason: 'unknown' };
  if (isOwned(id)) return { ok: false, reason: 'owned' };
  if (getSave().coins < ing.cost) return { ok: false, reason: 'noMoney' };
  updateSave((d) => {
    d.coins -= ing.cost;
    d.owned.push(id);
    if (!d.newIngredients.includes(id)) d.newIngredients.push(id);
  });
  return { ok: true };
}

export function upgradeIngredient(id) {
  if (!isOwned(id)) return { ok: false, reason: 'notOwned' };
  const cost = qualityUpgradeCost(id, ingLevel(id));
  if (cost === null) return { ok: false, reason: 'maxed' };
  if (getSave().coins < cost) return { ok: false, reason: 'noMoney' };
  updateSave((d) => {
    d.coins -= cost;
    d.ingLevels[id] = (d.ingLevels[id] || 0) + 1;
  });
  return { ok: true };
}

export function upgradeLocked(upgradeId) {
  const u = UPG[upgradeId];
  return !!(u && u.requiresLevel && maxUnlockedLevel() < u.requiresLevel);
}

export function buyUpgrade(upgradeId) {
  const u = UPG[upgradeId];
  if (!u) return { ok: false, reason: 'unknown' };
  if (upgradeLocked(upgradeId)) return { ok: false, reason: 'locked' };
  const cost = nextUpgradeCost(upgradeId, getSave().upgrades);
  if (cost === null) return { ok: false, reason: 'maxed' };
  if (getSave().coins < cost) return { ok: false, reason: 'noMoney' };
  updateSave((d) => {
    d.coins -= cost;
    d.upgrades[upgradeId] = (d.upgrades[upgradeId] || 0) + 1;
  });
  return { ok: true };
}

// Called once per finished campaign level. Coins are always banked.
export function recordLevelResult(levelId, { won, stars, money, served }) {
  const wasEndlessUnlocked = isEndlessUnlocked();
  const wasUnlocked = isLevelUnlocked(levelId + 1);
  let newBest = false;
  updateSave((d) => {
    d.coins = Math.round((d.coins + money) * 10) / 10;
    d.stats.earned += money;
    d.stats.served += served;
    d.stats.played += 1;
    d.newIngredients = [];
    if (won && stars > (d.stars[levelId] || 0)) {
      newBest = true;
      d.stars[levelId] = stars;
    }
  });
  return {
    newBest,
    coinsTotal: getSave().coins,
    unlockedLevel: !wasUnlocked && isLevelUnlocked(levelId + 1) && levelId < LEVELS.length ? levelId + 1 : null,
    unlockedEndless: !wasEndlessUnlocked && isEndlessUnlocked(),
  };
}

export function recordEndless({ money, served }) {
  let newBest = false;
  updateSave((d) => {
    d.coins = Math.round((d.coins + money) * 10) / 10;
    d.stats.earned += money;
    d.stats.served += served;
    d.stats.played += 1;
    d.newIngredients = [];
    if (money > d.endlessBest) {
      d.endlessBest = money;
      newBest = true;
    }
  });
  return { newBest, coinsTotal: getSave().coins, best: getSave().endlessBest };
}

export function markIntroSeen(key) {
  updateSave((d) => {
    d.seenIntros[key] = true;
  });
}

export function setSetting(key, value) {
  updateSave((d) => {
    d.settings[key] = value;
  });
}
