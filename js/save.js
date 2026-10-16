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
// The stored JSON this tab last read or wrote successfully. Storage holding anything else means
// another tab of the game saved in the meantime (see sync() and the 'storage' listener below).
let lastRaw = null;

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

// Whole number in 0..max. Strings, NaN, negatives and fractions from a damaged save are clamped.
const int = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v)) || 0));
// A finite amount ≥ 0 (coins, best score, stats), otherwise 0.
const amount = (v) => (Number.isFinite(v) ? Math.max(0, v) : 0);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

// Stored data → a valid save. Every field is checked, because a save that was edited by hand,
// written by an older version or damaged must never break the shop, the map or a level.
function merge(raw) {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const out = { ...d, ...raw };
  out.settings = { ...d.settings, ...obj(raw.settings) };
  if (!LANGS.includes(out.settings.lang)) out.settings.lang = d.settings.lang;
  out.settings.music = out.settings.music !== false; // only an explicit false mutes
  out.settings.sfx = out.settings.sfx !== false;
  const stats = obj(raw.stats);
  out.stats = {};
  for (const k of Object.keys(d.stats)) out.stats[k] = amount(stats[k]);

  out.owned = Array.isArray(raw.owned) ? raw.owned.filter((id) => ING[id]) : d.owned;
  for (const id of START_OWNED) if (!out.owned.includes(id)) out.owned.push(id);
  out.owned = [...new Set(out.owned)];
  out.newIngredients = Array.isArray(raw.newIngredients)
    ? [...new Set(raw.newIngredients.filter((id) => ING[id] && out.owned.includes(id)))]
    : [];

  // Only values > 0 are kept, so an untouched save keeps its empty objects.
  const stars = obj(raw.stars);
  out.stars = {};
  for (const l of LEVELS) {
    const n = int(stars[l.id], 3);
    if (n) out.stars[l.id] = n;
  }
  const ingLevels = obj(raw.ingLevels);
  out.ingLevels = {};
  for (const id of Object.keys(ING)) {
    const n = int(ingLevels[id], ING[id].upgradeCosts.length);
    if (n) out.ingLevels[id] = n;
  }
  const upgrades = obj(raw.upgrades);
  out.upgrades = {};
  for (const id of Object.keys(UPG)) {
    const n = int(upgrades[id], UPG[id].levels.length);
    if (n) out.upgrades[id] = n;
  }
  out.seenIntros = { ...obj(raw.seenIntros) };
  out.coins = amount(raw.coins);
  out.endlessBest = amount(raw.endlessBest);
  return out;
}

// initial = optional snapshot (e.g. from the artifact hot-reload hook) used when storage is empty.
export function loadSave(initial) {
  let raw = null;
  lastRaw = null;
  try {
    const s = localStorage.getItem(KEY);
    lastRaw = s;
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
    const s = JSON.stringify(data);
    localStorage.setItem(KEY, s);
    lastRaw = s;
  } catch {
    /* storage blocked – keep in memory */
  }
  for (const fn of listeners) fn(data);
}

// Two tabs of the game share one save. Before every change, adopt what another tab stored since
// this tab last read or wrote, so a stale tab never overwrites newer progress with its old copy.
// Memory wins when storage is unreadable, holds no save, or still holds the value this tab read
// before its own writes started failing (quota): that progress exists only in memory.
function sync() {
  if (!data) return;
  try {
    const s = localStorage.getItem(KEY);
    if (!s || s === lastRaw) return;
    const raw = JSON.parse(s);
    if (!raw || typeof raw !== 'object') return;
    data = merge(raw);
    lastRaw = s;
  } catch {
    /* blocked or corrupt – keep memory */
  }
}

export function updateSave(fn) {
  sync();
  fn(getSave());
  persist();
  return data;
}

export function onSaveChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Another tab saved: take its state over right away, so open menus (coins pill, shop) show it.
// Settings changed there (language, audio) are kept in the save but not applied to this tab.
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue || e.newValue === lastRaw || !data) return;
    try {
      const raw = JSON.parse(e.newValue);
      if (!raw || typeof raw !== 'object') return;
      data = merge(raw);
      lastRaw = e.newValue;
    } catch {
      return;
    }
    for (const fn of listeners) fn(data);
  });
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
// A non-finite amount must never reach the wallet: JSON stores NaN as null, which loads as 0 coins.
const finite = (n) => (Number.isFinite(n) ? n : 0);
const addTo = (coins, n) => Math.max(0, Math.round((coins + n) * 10) / 10);

// Actions that check something first (owned, coins, unlocked) call sync() before the check, so it
// sees what another tab may have saved in the meantime; updateSave() syncs for all the others.
export function addCoins(n) {
  const m = finite(n);
  updateSave((d) => {
    d.coins = addTo(d.coins, m);
  });
}

export function buyIngredient(id) {
  sync();
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
  sync();
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
  sync();
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
  sync();
  const m = finite(money);
  const n = int(stars, 3);
  const wasEndlessUnlocked = isEndlessUnlocked();
  const wasUnlocked = isLevelUnlocked(levelId + 1);
  let newBest = false;
  updateSave((d) => {
    d.coins = addTo(d.coins, m);
    d.stats.earned += m;
    d.stats.served += finite(served);
    d.stats.played += 1;
    d.newIngredients = [];
    if (won && n > (d.stars[levelId] || 0)) {
      newBest = true;
      d.stars[levelId] = n;
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
  const m = finite(money);
  let newBest = false;
  updateSave((d) => {
    d.coins = addTo(d.coins, m);
    d.stats.earned += m;
    d.stats.served += finite(served);
    d.stats.played += 1;
    d.newIngredients = [];
    if (m > d.endlessBest) {
      d.endlessBest = m;
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
