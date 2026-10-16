// Structural checks for the content tables in js/data.js.
// Balance numbers (prices, goals, timings) are tuned elsewhere – only invariants are asserted here.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  LAYERS, INGREDIENTS, START_OWNED, QUALITY_MULT, SMOOTHIE_LEVEL, ENDLESS_UNLOCK_LEVEL, MAX_BOWL_ITEMS,
  ING, ingredientsByLayer, isSmoothieFruit, ingredientValue, smoothieValue, qualityUpgradeCost,
  LEVELS, getLevel, endlessConfig, KITCHEN_BASE, UPGRADES, UPG, getKitchenStats, nextUpgradeCost,
} from '../js/data.js';
import { hasString, LANGS } from '../js/i18n.js';

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const isRange = (r) => Array.isArray(r) && r.length === 2 && r.every(Number.isFinite) && r[0] <= r[1];

describe('ingredients', () => {
  test('16 ingredients with unique ids', () => {
    assert.equal(INGREDIENTS.length, 16);
    const ids = INGREDIENTS.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length, 'duplicate ingredient id');
    for (const id of ids) assert.equal(ING[id].id, id);
  });

  test('3 base / 6 mid / 7 top', () => {
    assert.deepEqual(LAYERS, ['base', 'mid', 'top']);
    assert.equal(ingredientsByLayer('base').length, 3);
    assert.equal(ingredientsByLayer('mid').length, 6);
    assert.equal(ingredientsByLayer('top').length, 7);
    for (const ing of INGREDIENTS) assert.ok(LAYERS.includes(ing.layer), `${ing.id}: unknown layer ${ing.layer}`);
  });

  test('exactly the 4 start ingredients are free, one of each layer present', () => {
    assert.equal(START_OWNED.length, 4);
    assert.deepEqual([...START_OWNED].sort(), ['acai', 'banana', 'granola', 'honey']);
    const free = INGREDIENTS.filter((i) => i.cost === 0).map((i) => i.id).sort();
    assert.deepEqual(free, [...START_OWNED].sort());
    for (const layer of LAYERS) {
      assert.ok(START_OWNED.some((id) => ING[id].layer === layer), `no start ingredient in layer ${layer}`);
    }
  });

  test('every non-start ingredient costs coins', () => {
    for (const ing of INGREDIENTS) {
      if (START_OWNED.includes(ing.id)) continue;
      assert.ok(Number.isFinite(ing.cost) && ing.cost > 0, `${ing.id}: cost must be > 0`);
    }
  });

  test('prices, quality upgrade costs and colours are valid', () => {
    for (const ing of INGREDIENTS) {
      assert.ok(Number.isFinite(ing.price) && ing.price > 0, `${ing.id}: price`);
      assert.equal(ing.upgradeCosts.length, QUALITY_MULT.length - 1, `${ing.id}: upgradeCosts length`);
      assert.ok(ing.upgradeCosts.every((c) => Number.isFinite(c) && c > 0), `${ing.id}: upgrade costs > 0`);
      assert.ok(ing.upgradeCosts[0] < ing.upgradeCosts[1], `${ing.id}: upgrade costs increase`);
      assert.match(ing.color, HEX, `${ing.id}: color`);
      assert.match(ing.color2, HEX, `${ing.id}: color2`);
      assert.equal(typeof ing.style, 'string');
    }
  });

  test('smoothie fruits are the mid-layer fruits from the design', () => {
    const fruits = INGREDIENTS.filter((i) => i.smoothie).map((i) => i.id).sort();
    assert.deepEqual(fruits, ['banana', 'blueberry', 'kiwi', 'mango', 'strawberry']);
    for (const id of fruits) assert.equal(ING[id].layer, 'mid');
    assert.equal(isSmoothieFruit('banana'), true);
    assert.equal(isSmoothieFruit('granola'), false);
    assert.equal(isSmoothieFruit('nope'), false);
  });

  test('quality multipliers start at 1 and increase', () => {
    assert.equal(QUALITY_MULT[0], 1);
    for (let i = 1; i < QUALITY_MULT.length; i++) assert.ok(QUALITY_MULT[i] > QUALITY_MULT[i - 1]);
  });

  test('ingredientValue / smoothieValue apply quality and round to 0.5', () => {
    for (const ing of INGREDIENTS) {
      const values = QUALITY_MULT.map((_, lv) => ingredientValue(ing.id, { [ing.id]: lv }));
      assert.equal(values[0], Math.round(ing.price * 2) / 2);
      for (const v of values) assert.equal(v * 2, Math.round(v * 2), `${ing.id}: ${v} not a multiple of 0.5`);
      for (let i = 1; i < values.length; i++) assert.ok(values[i] >= values[i - 1], `${ing.id}: value drops`);
      assert.equal(ingredientValue(ing.id, { [ing.id]: 99 }), values.at(-1), 'quality level is clamped');
    }
    assert.equal(ingredientValue('nope'), 0);
    const s0 = smoothieValue('banana');
    const s2 = smoothieValue('banana', { banana: 2 });
    assert.ok(s0 > 0 && s2 > s0);
    assert.equal(s2 * 2, Math.round(s2 * 2));
  });

  test('qualityUpgradeCost walks the upgrade list and ends with null', () => {
    for (const ing of INGREDIENTS) {
      ing.upgradeCosts.forEach((c, lv) => assert.equal(qualityUpgradeCost(ing.id, lv), c));
      assert.equal(qualityUpgradeCost(ing.id, ing.upgradeCosts.length), null);
    }
    assert.equal(qualityUpgradeCost('nope', 0), null);
  });
});

describe('levels', () => {
  test('20 levels with ids 1..20', () => {
    assert.equal(LEVELS.length, 20);
    LEVELS.forEach((l, i) => assert.equal(l.id, i + 1));
    assert.equal(getLevel(1), LEVELS[0]);
    assert.equal(getLevel(20), LEVELS[19]);
    assert.equal(getLevel(21), null);
  });

  test('three goals per level, strictly increasing', () => {
    for (const l of LEVELS) {
      assert.equal(l.goals.length, 3, `level ${l.id}`);
      assert.ok(l.goals[0] > 0, `level ${l.id}: first goal > 0`);
      assert.ok(l.goals[0] < l.goals[1] && l.goals[1] < l.goals[2], `level ${l.id}: goals ${l.goals}`);
    }
  });

  test('seats grow 2 → 4 and never shrink', () => {
    assert.equal(LEVELS[0].seats, 2);
    assert.equal(LEVELS.at(-1).seats, 4);
    for (let i = 0; i < LEVELS.length; i++) {
      assert.ok([2, 3, 4].includes(LEVELS[i].seats), `level ${i + 1}: seats`);
      if (i > 0) assert.ok(LEVELS[i].seats >= LEVELS[i - 1].seats, `level ${i + 1}: seats decrease`);
    }
    assert.ok(LEVELS.some((l) => l.seats === 3), 'some level has 3 seats');
  });

  test('smoothies only from SMOOTHIE_LEVEL on', () => {
    assert.equal(SMOOTHIE_LEVEL, 7);
    for (const l of LEVELS) {
      if (l.id < SMOOTHIE_LEVEL) assert.equal(l.smoothieChance, 0, `level ${l.id}`);
      else assert.ok(l.smoothieChance > 0 && l.smoothieChance <= 1, `level ${l.id}`);
    }
  });

  test('timings, ranges and flags are sane', () => {
    for (const l of LEVELS) {
      const at = `level ${l.id}`;
      assert.ok(l.duration > 0 && l.patience > 0, at);
      assert.ok(isRange(l.spawnGap) && l.spawnGap[0] > 0, `${at}: spawnGap`);
      assert.ok(isRange(l.mid) && l.mid[0] >= 1, `${at}: mid`);
      assert.ok(isRange(l.top) && l.top[0] >= 0, `${at}: top`);
      assert.ok(l.mid[1] <= ingredientsByLayer('mid').length && l.top[1] <= ingredientsByLayer('top').length, at);
      assert.ok(l.mid[1] + l.top[1] <= MAX_BOWL_ITEMS, `${at}: order larger than a bowl`);
      assert.ok(Number.isInteger(l.hearts) && l.hearts >= 1, `${at}: hearts`);
      assert.equal(typeof l.overflow, 'boolean', `${at}: overflow`);
    }
    assert.equal(LEVELS[0].intro, 'basics');
    assert.equal(LEVELS[0].overflow, false);
    assert.ok(ENDLESS_UNLOCK_LEVEL >= 1 && ENDLESS_UNLOCK_LEVEL <= LEVELS.length);
  });
});

describe('endlessConfig', () => {
  const stages = Array.from({ length: 61 }, (_, s) => endlessConfig(s));

  test('every stage is a valid config', () => {
    for (const [s, c] of stages.entries()) {
      const at = `stage ${s}`;
      assert.ok(c.seats >= 2 && c.seats <= 4, `${at}: seats`);
      assert.ok(isRange(c.spawnGap) && c.spawnGap[0] > 0, `${at}: spawnGap`);
      assert.ok(c.patience > 0, `${at}: patience`);
      assert.ok(isRange(c.mid) && c.mid[0] >= 1 && c.mid[1] <= ingredientsByLayer('mid').length, `${at}: mid`);
      assert.ok(isRange(c.top) && c.top[0] >= 0 && c.top[1] <= ingredientsByLayer('top').length, `${at}: top`);
      assert.ok(c.mid[1] + c.top[1] <= MAX_BOWL_ITEMS, `${at}: order larger than a bowl`);
      assert.ok(c.smoothieChance >= 0 && c.smoothieChance <= 1, `${at}: smoothieChance`);
      assert.ok(c.hearts >= 1, `${at}: hearts`);
    }
  });

  test('difficulty never decreases from stage to stage', () => {
    for (let s = 1; s < stages.length; s++) {
      const [a, b] = [stages[s - 1], stages[s]];
      const at = `stage ${s - 1} → ${s}`;
      assert.ok(b.seats >= a.seats, `${at}: seats`);
      assert.ok(b.spawnGap[0] <= a.spawnGap[0] && b.spawnGap[1] <= a.spawnGap[1], `${at}: spawnGap`);
      assert.ok(b.patience <= a.patience, `${at}: patience`);
      assert.ok(b.mid[0] >= a.mid[0] && b.mid[1] >= a.mid[1], `${at}: mid`);
      assert.ok(b.top[0] >= a.top[0] && b.top[1] >= a.top[1], `${at}: top`);
      assert.ok(b.smoothieChance >= a.smoothieChance, `${at}: smoothieChance`);
    }
    const first = stages[0];
    const last = stages.at(-1);
    assert.ok(last.seats > first.seats || last.patience < first.patience, 'endless gets harder at all');
    assert.equal(last.seats, 4);
  });

  test('negative or fractional stages behave like the floor stage', () => {
    assert.deepEqual(endlessConfig(-3), endlessConfig(0));
    assert.deepEqual(endlessConfig(2.7), endlessConfig(2));
  });
});

describe('upgrades & kitchen stats', () => {
  test('upgrade table is well formed', () => {
    const ids = UPGRADES.map((u) => u.id);
    assert.equal(new Set(ids).size, ids.length, 'duplicate upgrade id');
    for (const id of ['blenderSpeed', 'jug', 'blender2', 'bowlSlots', 'smoothieSlots', 'plants', 'jukebox', 'seating', 'neon']) {
      assert.ok(UPG[id], `missing upgrade ${id}`);
    }
    for (const u of UPGRADES) {
      assert.ok(['kitchen', 'decor'].includes(u.cat), `${u.id}: cat`);
      assert.ok(u.levels.length >= 1, `${u.id}: levels`);
      for (const lv of u.levels) {
        assert.ok(Number.isFinite(lv.cost) && lv.cost > 0, `${u.id}: cost`);
        for (const key of Object.keys(lv)) {
          if (key === 'cost') continue;
          assert.ok(key === 'patience' || key in KITCHEN_BASE, `${u.id}: unknown stat ${key}`);
        }
      }
      if (u.cat === 'decor') assert.ok(u.levels.every((lv) => lv.patience > 0), `${u.id}: decor adds patience`);
    }
    assert.equal(UPG.smoothieSlots.requiresLevel, SMOOTHIE_LEVEL);
  });

  test('no upgrades → base stats (and a fresh copy)', () => {
    const k = getKitchenStats();
    assert.deepEqual(k, KITCHEN_BASE);
    assert.notEqual(k, KITCHEN_BASE);
    k.blenders = 99;
    assert.notEqual(KITCHEN_BASE.blenders, 99);
    assert.deepEqual(getKitchenStats({}), KITCHEN_BASE);
  });

  test('purchased levels apply in order, extra levels are clamped', () => {
    const speeds = UPG.blenderSpeed.levels.map((lv) => lv.blendTime);
    speeds.forEach((bt, i) => assert.equal(getKitchenStats({ blenderSpeed: i + 1 }).blendTime, bt));
    for (let i = 0; i < speeds.length; i++) {
      assert.ok(speeds[i] < (i ? speeds[i - 1] : KITCHEN_BASE.blendTime), 'blender gets faster');
    }
    assert.equal(getKitchenStats({ blenderSpeed: 99 }).blendTime, speeds.at(-1));
    assert.equal(getKitchenStats({ bowlSlots: 1 }).bowlSlots, 3);
    assert.equal(getKitchenStats({ bowlSlots: 2 }).bowlSlots, 4);
    assert.equal(getKitchenStats({ jug: 1 }).portions, 3);
    assert.equal(getKitchenStats({ blender2: 1 }).blenders, 2);
    assert.equal(getKitchenStats({ smoothieSlots: 1 }).smoothieSlots, 2);
    assert.deepEqual(getKitchenStats({ unknownThing: 3 }), KITCHEN_BASE);
  });

  test('decor patience bonuses add up', () => {
    const decor = UPGRADES.filter((u) => u.cat === 'decor');
    const all = Object.fromEntries(decor.map((u) => [u.id, u.levels.length]));
    const expected = decor.reduce((sum, u) => sum + u.levels.reduce((s, lv) => s + lv.patience, 0), KITCHEN_BASE.patienceMult);
    assert.equal(getKitchenStats(all).patienceMult, Math.round(expected * 100) / 100);
    const one = decor[0];
    assert.equal(getKitchenStats({ [one.id]: 1 }).patienceMult, Math.round((1 + one.levels[0].patience) * 100) / 100);
  });

  test('nextUpgradeCost follows the level list', () => {
    for (const u of UPGRADES) {
      u.levels.forEach((lv, n) => assert.equal(nextUpgradeCost(u.id, { [u.id]: n }), lv.cost));
      assert.equal(nextUpgradeCost(u.id, { [u.id]: u.levels.length }), null);
    }
    assert.equal(nextUpgradeCost('nope', {}), null);
  });
});

describe('strings', () => {
  const keys = [
    ...INGREDIENTS.map((i) => `ing.${i.id}`),
    ...UPGRADES.flatMap((u) => [`upg.${u.id}`, `upgdesc.${u.id}`]),
    ...LAYERS.map((l) => `layer.${l}`),
    'smoothie.name',
  ];

  test('every ingredient, upgrade and layer has German and English text', () => {
    const missing = [];
    for (const key of keys) for (const lang of LANGS) if (!hasString(key, lang)) missing.push(`${lang}:${key}`);
    assert.deepEqual(missing, []);
  });

  test('short names exist in both languages or in neither', () => {
    for (const ing of INGREDIENTS) {
      const key = `ingshort.${ing.id}`;
      assert.equal(hasString(key, 'de'), hasString(key, 'en'), key);
    }
  });
});
