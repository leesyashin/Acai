// js/save.js against a fake localStorage (installed before the module is imported).

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const KEY = 'acaiFever.save.v1';

function createStorage() {
  const map = new Map();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
}

function installStorage(value) {
  Object.defineProperty(globalThis, 'localStorage', { value, configurable: true, writable: true });
}

let storage = createStorage();
installStorage(storage);

const save = await import('../js/save.js');
const data = await import('../js/data.js');
const { detectLang, LANGS } = await import('../js/i18n.js');
const { INGREDIENTS, START_OWNED, UPGRADES, UPG, LEVELS, SMOOTHIE_LEVEL, ENDLESS_UNLOCK_LEVEL } = data;

const stored = () => JSON.parse(storage.getItem(KEY));
const buyable = INGREDIENTS.find((i) => i.cost > 0);

// Fresh storage + reloaded state; raw = what is in localStorage before loading.
function fresh(raw) {
  storage = createStorage();
  installStorage(storage);
  if (raw !== undefined) storage.setItem(KEY, typeof raw === 'string' ? raw : JSON.stringify(raw));
  return save.loadSave();
}

function setCoins(n) {
  save.updateSave((d) => {
    d.coins = n;
  });
}

function winLevels(upTo, stars = 1) {
  save.updateSave((d) => {
    for (let id = 1; id <= upTo; id++) d.stars[id] = stars;
  });
}

describe('defaults & loading', () => {
  test('empty storage gives the default save', () => {
    const d = fresh();
    assert.equal(d.version, 1);
    assert.equal(d.coins, 0);
    assert.deepEqual(d.owned, START_OWNED);
    assert.deepEqual(d.ingLevels, {});
    assert.deepEqual(d.upgrades, {});
    assert.deepEqual(d.stars, {});
    assert.equal(d.endlessBest, 0);
    assert.deepEqual(d.newIngredients, []);
    assert.deepEqual(d.seenIntros, {});
    assert.deepEqual(d.settings, { lang: detectLang(), music: true, sfx: true });
    assert.ok(LANGS.includes(d.settings.lang));
    assert.deepEqual(d.stats, { served: 0, earned: 0, played: 0 });
    assert.equal(save.getSave(), d);
  });

  test('defaultSave returns independent objects', () => {
    const a = save.defaultSave();
    a.owned.push('kiwi');
    a.settings.music = false;
    const b = save.defaultSave();
    assert.deepEqual(b.owned, START_OWNED);
    assert.equal(b.settings.music, true);
    assert.deepEqual(START_OWNED, ['acai', 'banana', 'granola', 'honey']);
  });

  test('initial snapshot is used only when storage is empty', () => {
    fresh();
    assert.equal(save.loadSave({ coins: 77 }).coins, 77);
    fresh({ coins: 5 });
    assert.equal(save.loadSave({ coins: 77 }).coins, 5);
  });

  test('partial save is merged with defaults', () => {
    const d = fresh({ coins: 50, owned: ['pitaya'], settings: { lang: 'en' }, stars: { 1: 2 }, stats: { served: 4 } });
    assert.equal(d.coins, 50);
    for (const id of [...START_OWNED, 'pitaya']) assert.ok(d.owned.includes(id), id);
    assert.deepEqual(d.settings, { lang: 'en', music: true, sfx: true });
    assert.deepEqual(d.stats, { served: 4, earned: 0, played: 0 });
    assert.deepEqual(d.stars, { 1: 2 });
    assert.equal(d.endlessBest, 0);
    assert.deepEqual(d.upgrades, {});
  });

  for (const [label, raw] of [
    ['invalid JSON', '{"coins": 12,'],
    ['null', 'null'],
    ['a number', '42'],
    ['a string', '"hello"'],
  ]) {
    test(`corrupt storage (${label}) falls back to defaults`, () => {
      const d = fresh(raw);
      assert.equal(d.coins, 0);
      assert.deepEqual(d.owned, START_OWNED);
      assert.equal(d.settings.music, true);
    });
  }

  test('bad field values are repaired', () => {
    const d = fresh({ coins: -20, owned: ['acai', 'pizza', 'kiwi'], newIngredients: 'kiwi', settings: null, stats: null });
    assert.equal(d.coins, 0);
    assert.ok(!d.owned.includes('pizza'));
    assert.ok(d.owned.includes('kiwi'));
    for (const id of START_OWNED) assert.ok(d.owned.includes(id));
    assert.deepEqual(d.newIngredients, []);
    assert.equal(d.settings.sfx, true);
    assert.equal(d.stats.played, 0);
    assert.equal(fresh({ coins: 'lots' }).coins, 0);
    assert.equal(fresh({ coins: null }).coins, 0);
    assert.deepEqual(fresh({ owned: 'acai' }).owned, START_OWNED);
  });
});

describe('persistence', () => {
  beforeEach(() => fresh());

  test('updateSave writes JSON under the versioned key and notifies listeners', () => {
    const seen = [];
    const off = save.onSaveChange((d) => seen.push(d.coins));
    save.updateSave((d) => {
      d.coins = 9;
    });
    assert.equal(stored().coins, 9);
    assert.deepEqual(seen, [9]);
    off();
    save.addCoins(1);
    assert.deepEqual(seen, [9]);
    assert.equal(stored().coins, 10);
  });

  test('a saved game survives a reload', () => {
    save.addCoins(33);
    save.setSetting('music', false);
    save.markIntroSeen('overflow');
    const d = save.loadSave();
    assert.equal(d.coins, 33);
    assert.equal(d.settings.music, false);
    assert.equal(d.seenIntros.overflow, true);
  });

  test('addCoins rounds to 0.1 and never goes below 0', () => {
    save.addCoins(0.1);
    save.addCoins(0.2);
    assert.equal(save.getSave().coins, 0.3);
    save.addCoins(-100);
    assert.equal(save.getSave().coins, 0);
  });
});

describe('shop actions', () => {
  beforeEach(() => fresh());

  test('buyIngredient: unknown, owned, noMoney, success', () => {
    assert.deepEqual(save.buyIngredient('pizza'), { ok: false, reason: 'unknown' });
    assert.deepEqual(save.buyIngredient(START_OWNED[0]), { ok: false, reason: 'owned' });
    setCoins(buyable.cost - 1);
    assert.deepEqual(save.buyIngredient(buyable.id), { ok: false, reason: 'noMoney' });
    assert.equal(save.isOwned(buyable.id), false);

    setCoins(buyable.cost + 5);
    assert.deepEqual(save.buyIngredient(buyable.id), { ok: true });
    assert.equal(save.getSave().coins, 5);
    assert.equal(save.isOwned(buyable.id), true);
    assert.deepEqual(save.getSave().newIngredients, [buyable.id]);
    assert.ok(stored().owned.includes(buyable.id));
    assert.deepEqual(save.buyIngredient(buyable.id), { ok: false, reason: 'owned' });
  });

  test('upgradeIngredient: notOwned, noMoney, success until maxed', () => {
    assert.deepEqual(save.upgradeIngredient(buyable.id), { ok: false, reason: 'notOwned' });
    const id = START_OWNED[0];
    const costs = data.ING[id].upgradeCosts;
    setCoins(costs[0] - 1);
    assert.deepEqual(save.upgradeIngredient(id), { ok: false, reason: 'noMoney' });

    const total = costs.reduce((a, b) => a + b, 0);
    setCoins(total);
    for (let lv = 1; lv <= costs.length; lv++) {
      assert.deepEqual(save.upgradeIngredient(id), { ok: true });
      assert.equal(save.ingLevel(id), lv);
    }
    assert.equal(save.getSave().coins, 0);
    assert.deepEqual(save.upgradeIngredient(id), { ok: false, reason: 'maxed' });
    assert.equal(stored().ingLevels[id], costs.length);
  });

  test('buyUpgrade: unknown, noMoney, success until maxed, kitchen stats follow', () => {
    assert.deepEqual(save.buyUpgrade('rocket'), { ok: false, reason: 'unknown' });
    const u = UPGRADES.find((x) => !x.requiresLevel && x.levels.length >= 2);
    setCoins(u.levels[0].cost - 1);
    assert.deepEqual(save.buyUpgrade(u.id), { ok: false, reason: 'noMoney' });

    setCoins(u.levels.reduce((s, lv) => s + lv.cost, 0));
    for (let n = 1; n <= u.levels.length; n++) {
      assert.deepEqual(save.buyUpgrade(u.id), { ok: true });
      assert.equal(save.upgradeLevel(u.id), n);
    }
    assert.equal(save.getSave().coins, 0);
    assert.deepEqual(save.buyUpgrade(u.id), { ok: false, reason: 'maxed' });
    assert.deepEqual(save.kitchenStats(), data.getKitchenStats({ [u.id]: u.levels.length }));
  });

  test('buyUpgrade: locked until the required level is reached', () => {
    const u = UPG.smoothieSlots;
    assert.equal(u.requiresLevel, SMOOTHIE_LEVEL);
    setCoins(10000);
    assert.equal(save.upgradeLocked(u.id), true);
    assert.deepEqual(save.buyUpgrade(u.id), { ok: false, reason: 'locked' });
    assert.equal(save.getSave().coins, 10000);

    winLevels(SMOOTHIE_LEVEL - 2);
    assert.equal(save.upgradeLocked(u.id), true, 'level before smoothie level is not enough');
    winLevels(SMOOTHIE_LEVEL - 1);
    assert.equal(save.maxUnlockedLevel(), SMOOTHIE_LEVEL);
    assert.equal(save.upgradeLocked(u.id), false);
    assert.deepEqual(save.buyUpgrade(u.id), { ok: true });
  });
});

describe('progress', () => {
  beforeEach(() => fresh());

  test('a lost level still banks the coins but gives no stars', () => {
    save.updateSave((d) => {
      d.newIngredients = ['kiwi'];
    });
    const r = save.recordLevelResult(1, { won: false, stars: 2, money: 37.5, served: 3 });
    assert.deepEqual(r, { newBest: false, coinsTotal: 37.5, unlockedLevel: null, unlockedEndless: false });
    const d = save.getSave();
    assert.equal(d.coins, 37.5);
    assert.equal(d.stars[1], undefined);
    assert.deepEqual(d.stats, { served: 3, earned: 37.5, played: 1 });
    assert.deepEqual(d.newIngredients, []);
    assert.equal(save.isLevelUnlocked(2), false);
  });

  test('stars only improve and the next level unlocks once', () => {
    let r = save.recordLevelResult(1, { won: true, stars: 2, money: 60, served: 5 });
    assert.equal(r.newBest, true);
    assert.equal(r.unlockedLevel, 2);
    assert.equal(save.levelStars(1), 2);
    assert.equal(save.isLevelUnlocked(2), true);

    r = save.recordLevelResult(1, { won: true, stars: 1, money: 40, served: 4 });
    assert.equal(r.newBest, false);
    assert.equal(r.unlockedLevel, null);
    assert.equal(save.levelStars(1), 2);

    r = save.recordLevelResult(1, { won: true, stars: 3, money: 80, served: 6 });
    assert.equal(r.newBest, true);
    assert.equal(save.levelStars(1), 3);
    assert.equal(r.coinsTotal, 180);
    assert.equal(save.totalStars(), 3);
    assert.equal(save.getSave().stats.played, 3);
  });

  test('winning the endless unlock level unlocks endless exactly once', () => {
    winLevels(ENDLESS_UNLOCK_LEVEL - 1);
    assert.equal(save.isEndlessUnlocked(), false);
    let r = save.recordLevelResult(ENDLESS_UNLOCK_LEVEL, { won: true, stars: 1, money: 10, served: 1 });
    assert.equal(r.unlockedEndless, true);
    assert.equal(r.unlockedLevel, ENDLESS_UNLOCK_LEVEL + 1);
    assert.equal(save.isEndlessUnlocked(), true);
    r = save.recordLevelResult(ENDLESS_UNLOCK_LEVEL, { won: true, stars: 2, money: 10, served: 1 });
    assert.equal(r.unlockedEndless, false);
  });

  test('the last level unlocks no further level', () => {
    winLevels(LEVELS.length - 1);
    const r = save.recordLevelResult(LEVELS.length, { won: true, stars: 1, money: 1, served: 1 });
    assert.equal(r.unlockedLevel, null);
    assert.equal(save.maxUnlockedLevel(), LEVELS.length);
  });

  test('smoothie machine appears once the smoothie level is unlocked', () => {
    assert.equal(save.hasSmoothieMachine(), false);
    winLevels(SMOOTHIE_LEVEL - 1);
    assert.equal(save.hasSmoothieMachine(), true);
  });

  test('recordEndless keeps the best score and banks coins', () => {
    let r = save.recordEndless({ money: 120, served: 10 });
    assert.deepEqual(r, { newBest: true, coinsTotal: 120, best: 120 });
    r = save.recordEndless({ money: 80, served: 6 });
    assert.deepEqual(r, { newBest: false, coinsTotal: 200, best: 120 });
    r = save.recordEndless({ money: 150.5, served: 12 });
    assert.equal(r.newBest, true);
    assert.equal(r.best, 150.5);
    assert.deepEqual(save.getSave().stats, { served: 28, earned: 350.5, played: 3 });
    assert.equal(stored().endlessBest, 150.5);
  });

  test('resetSave wipes progress but keeps the language', () => {
    save.setSetting('lang', 'en');
    save.setSetting('sfx', false);
    save.addCoins(500);
    winLevels(5, 3);
    const d = save.resetSave();
    assert.equal(d.coins, 0);
    assert.deepEqual(d.stars, {});
    assert.deepEqual(d.owned, START_OWNED);
    assert.equal(d.settings.lang, 'en');
    assert.equal(stored().settings.lang, 'en');
    assert.equal(stored().coins, 0);
  });
});

describe('storage failures', () => {
  test('throwing storage falls back to memory', () => {
    const boom = () => {
      throw new Error('SecurityError');
    };
    installStorage({ getItem: boom, setItem: boom, removeItem: boom, clear: boom, key: boom, length: 0 });
    const d = save.loadSave();
    assert.equal(d.coins, 0);
    save.addCoins(12);
    assert.deepEqual(save.buyIngredient('pizza'), { ok: false, reason: 'unknown' });
    assert.equal(save.getSave().coins, 12);
    const r = save.recordLevelResult(1, { won: true, stars: 1, money: 3, served: 1 });
    assert.equal(r.coinsTotal, 15);
  });

  test('quota errors on write keep the game running', () => {
    const s = createStorage();
    s.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    installStorage(s);
    save.loadSave();
    assert.doesNotThrow(() => save.addCoins(4));
    assert.equal(save.getSave().coins, 4);
  });

  test('localStorage getter that throws, or no localStorage at all', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      get() {
        throw new Error('access denied');
      },
      configurable: true,
    });
    assert.doesNotThrow(() => save.loadSave());
    assert.doesNotThrow(() => save.addCoins(1));
    delete globalThis.localStorage;
    assert.doesNotThrow(() => save.loadSave());
    assert.doesNotThrow(() => save.addCoins(1));
    assert.equal(save.getSave().coins, 1);
  });
});
