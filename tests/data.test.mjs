// Structural checks for the content tables in js/data.js.
// Balance numbers (prices, goals, timings) are tuned elsewhere – only invariants are asserted here.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  LAYERS, MATCHA_LAYERS, INGREDIENTS, START_OWNED, QUALITY_MULT, MATCHA_LEVEL, ENDLESS_UNLOCK_LEVEL, MAX_BOWL_ITEMS,
  MAX_MATCHA_EXTRAS, MATCHA_PRICE, ING, ingredientsByLayer, isMatchaFruit, isMatchaExtra, ingredientValue, matchaValue,
  qualityUpgradeCost, ownedAt, unlockedIn, artOf, orderWork, regionOf, REGIONS, REGION_SIZE,
  LEVELS, getLevel, endlessConfig, KITCHEN_BASE, UPGRADES, UPG, getKitchenStats, nextUpgradeCost, upgradeNeeds,
} from '../js/data.js';
import { hasString, LANGS } from '../js/i18n.js';

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const isMatchaFruitIng = (i) => i.layer === 'mfruit';
const isRange = (r) => Array.isArray(r) && r.length === 2 && r.every(Number.isFinite) && r[0] <= r[1];

describe('ingredients', () => {
  test('23 ingredients with unique ids', () => {
    assert.equal(INGREDIENTS.length, 23);
    const ids = INGREDIENTS.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length, 'duplicate ingredient id');
    for (const id of ids) assert.equal(ING[id].id, id);
  });

  test('bowl: 3 base / 6 mid / 7 top; matcha bar: 4 fruits / 3 extras', () => {
    assert.deepEqual(LAYERS, ['base', 'mid', 'top']);
    assert.deepEqual(MATCHA_LAYERS, ['mfruit', 'mextra']);
    assert.equal(ingredientsByLayer('base').length, 3);
    assert.equal(ingredientsByLayer('mid').length, 6);
    assert.equal(ingredientsByLayer('top').length, 7);
    assert.equal(ingredientsByLayer('mfruit').length, 4);
    assert.equal(ingredientsByLayer('mextra').length, 3);
    for (const ing of INGREDIENTS) assert.ok([...LAYERS, ...MATCHA_LAYERS].includes(ing.layer), `${ing.id}: unknown layer ${ing.layer}`);
  });

  test('level 1 brings exactly the 4 start ingredients, one of each bowl layer', () => {
    assert.equal(START_OWNED.length, 4);
    assert.deepEqual([...START_OWNED].sort(), ['acai', 'banana', 'granola', 'honey']);
    assert.deepEqual(ownedAt(1), START_OWNED);
    assert.deepEqual(unlockedIn(1).sort(), [...START_OWNED].sort());
    for (const layer of LAYERS) {
      assert.ok(START_OWNED.some((id) => ING[id].layer === layer), `no start ingredient in layer ${layer}`);
    }
  });

  test('every ingredient arrives with a campaign level, at most one per level after the first', () => {
    for (const ing of INGREDIENTS) {
      assert.ok(Number.isInteger(ing.unlock) && ing.unlock >= 1 && ing.unlock <= LEVELS.length, `${ing.id}: unlock`);
      assert.equal('cost' in ing, false, `${ing.id}: ingredients are not bought any more`);
    }
    for (const l of LEVELS.slice(1)) assert.ok(unlockedIn(l.id).length <= 2, `level ${l.id} brings too much at once`);
    for (let id = 2; id <= LEVELS.length; id++) {
      assert.ok(ownedAt(id).length >= ownedAt(id - 1).length);
      for (const ing of unlockedIn(id)) assert.ok(!ownedAt(id - 1).includes(ing) && ownedAt(id).includes(ing));
    }
    assert.equal(ownedAt(LEVELS.length).length, INGREDIENTS.length, 'everything has arrived by the last level');
  });

  test('the matcha bar opens with the machine and has a fruit from the start', () => {
    for (const ing of INGREDIENTS.filter((i) => MATCHA_LAYERS.includes(i.layer))) {
      assert.ok(ing.unlock >= MATCHA_LEVEL, `${ing.id} before the machine`);
    }
    assert.ok(unlockedIn(MATCHA_LEVEL).some(isMatchaFruit));
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

  test('matcha fruits are their own ingredients, drawn as a bowl fruit', () => {
    const fruits = INGREDIENTS.filter(isMatchaFruitIng).map((i) => i.id).sort();
    assert.deepEqual(fruits, ['mBanana', 'mBlueberry', 'mMango', 'mStrawberry']);
    for (const id of fruits) assert.equal(ING[artOf(id)].layer, 'mid', `${id} borrows a bowl fruit's art`);
    assert.equal(artOf('banana'), 'banana');
    assert.equal(isMatchaFruit('mBanana'), true);
    assert.equal(isMatchaFruit('banana'), false, 'bowl fruit stays on the bowl side');
    assert.equal(isMatchaFruit('ice'), false);
    assert.equal(isMatchaExtra('ice'), true);
    assert.equal(isMatchaExtra('nope'), false);
  });

  test('quality multipliers start at 1 and increase', () => {
    assert.equal(QUALITY_MULT[0], 1);
    for (let i = 1; i < QUALITY_MULT.length; i++) assert.ok(QUALITY_MULT[i] > QUALITY_MULT[i - 1]);
  });

  test('ingredientValue / matchaValue apply quality and round up to 0.5', () => {
    for (const ing of INGREDIENTS) {
      const values = QUALITY_MULT.map((_, lv) => ingredientValue(ing.id, { [ing.id]: lv }));
      assert.equal(values[0], Math.round(ing.price * 2) / 2);
      for (const v of values) assert.equal(v * 2, Math.round(v * 2), `${ing.id}: ${v} not a multiple of 0.5`);
      // every paid quality star must add coins (honey used to stay at 1.5 for 140 coins)
      for (let i = 1; i < values.length; i++) assert.ok(values[i] > values[i - 1], `${ing.id}: quality ${i} adds nothing`);
      values.forEach((v, lv) => {
        const exact = ing.price * QUALITY_MULT[lv];
        assert.ok(v >= exact - 1e-9 && v < exact + 0.5, `${ing.id} q${lv}: ${v} is not ${exact} rounded up`);
      });
      assert.equal(ingredientValue(ing.id, { [ing.id]: 99 }), values.at(-1), 'quality level is clamped');
    }
    assert.equal(ingredientValue('nope'), 0);
    assert.deepEqual(QUALITY_MULT.map((_, lv) => ingredientValue('honey', { honey: lv })), [1, 1.5, 2]);
    assert.equal(ingredientValue('acai', { acai: 1 }), 6.5, 'exact products are not rounded up by float noise');
    const drink = { fruit: 'mBanana', extras: ['ice'] };
    const sv = QUALITY_MULT.map((_, lv) => matchaValue(drink, { mBanana: lv }));
    assert.equal(sv[0], MATCHA_PRICE + ingredientValue('mBanana') + ingredientValue('ice'));
    for (let i = 1; i < sv.length; i++) assert.ok(sv[i] > sv[i - 1], `matcha quality ${i} adds nothing`);
    for (const v of sv) assert.equal(v * 2, Math.round(v * 2));
    assert.ok(matchaValue({ fruit: 'mBanana', extras: ['ice', 'foam'] }) > matchaValue(drink), 'every extra pays');
    assert.equal(matchaValue(null), 0);
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
  test('60 levels with ids 1..60 in six regions of ten', () => {
    assert.equal(LEVELS.length, 60);
    LEVELS.forEach((l, i) => assert.equal(l.id, i + 1));
    assert.equal(getLevel(1), LEVELS[0]);
    assert.equal(getLevel(60), LEVELS[59]);
    assert.equal(getLevel(61), null);
    assert.equal(REGIONS.length * REGION_SIZE, LEVELS.length);
    assert.equal(regionOf(1), 'beach');
    assert.equal(regionOf(10), 'beach');
    assert.equal(regionOf(11), 'town');
    assert.equal(regionOf(60), 'night');
  });

  test('small steps: every level is at most a little harder than the one before', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      const [a, b] = [LEVELS[i - 1], LEVELS[i]];
      const at = `level ${b.id}`;
      assert.ok(b.pace <= a.pace + 0.2 && b.pace >= a.pace - 0.2, `${at}: pace jumps`);
      assert.ok(b.patience >= a.patience - 1, `${at}: patience drops too fast`);
      assert.ok(b.mid[1] - a.mid[1] <= 1 && b.top[1] - a.top[1] <= 1, `${at}: orders grow too fast`);
      assert.ok(b.matchaChance - a.matchaChance <= 0.36, `${at}: matcha chance jumps`);
      assert.ok(b.seats - a.seats <= 1, `${at}: seats`);
    }
  });

  test('three goals per level, strictly increasing', () => {
    for (const l of LEVELS) {
      assert.equal(l.goals.length, 3, `level ${l.id}`);
      assert.ok(l.goals[0] > 0, `level ${l.id}: first goal > 0`);
      assert.ok(l.goals[0] < l.goals[1] && l.goals[1] < l.goals[2], `level ${l.id}: goals ${l.goals}`);
    }
  });

  test('goals rise from level to level', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      for (let g = 0; g < 3; g++) assert.ok(LEVELS[i].goals[g] > LEVELS[i - 1].goals[g], `level ${i + 1} goal ${g + 1}`);
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

  test('matcha only from MATCHA_LEVEL on', () => {
    assert.equal(MATCHA_LEVEL, 11);
    for (const l of LEVELS) {
      if (l.id < MATCHA_LEVEL) assert.equal(l.matchaChance, 0, `level ${l.id}`);
      else assert.ok(l.matchaChance > 0 && l.matchaChance <= 1, `level ${l.id}`);
    }
  });

  test('timings, ranges and flags are sane', () => {
    for (const l of LEVELS) {
      const at = `level ${l.id}`;
      assert.ok(l.duration > 0 && l.patience > 0, at);
      assert.ok(l.pace > 0, `${at}: pace`);
      assert.ok(l.drinkOnly >= 0 && l.drinkOnly < 1, `${at}: drinkOnly`);
      assert.ok(isRange(l.mExtras) && l.mExtras[0] >= 0 && l.mExtras[1] <= MAX_MATCHA_EXTRAS, `${at}: mExtras`);
      assert.ok(l.mExtras[1] <= ownedAt(l.id).filter(isMatchaExtra).length, `${at}: more extras than have arrived`);
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
      assert.ok(c.pace > 0, `${at}: pace`);
      assert.ok(isRange(c.mExtras) && c.mExtras[1] <= MAX_MATCHA_EXTRAS, `${at}: mExtras`);
      assert.ok(c.patience > 0, `${at}: patience`);
      assert.ok(isRange(c.mid) && c.mid[0] >= 1 && c.mid[1] <= ingredientsByLayer('mid').length, `${at}: mid`);
      assert.ok(isRange(c.top) && c.top[0] >= 0 && c.top[1] <= ingredientsByLayer('top').length, `${at}: top`);
      assert.ok(c.mid[1] + c.top[1] <= MAX_BOWL_ITEMS, `${at}: order larger than a bowl`);
      assert.ok(c.matchaChance >= 0 && c.matchaChance <= 1, `${at}: matchaChance`);
      assert.ok(c.hearts >= 1, `${at}: hearts`);
    }
  });

  test('difficulty never decreases from stage to stage', () => {
    for (let s = 1; s < stages.length; s++) {
      const [a, b] = [stages[s - 1], stages[s]];
      const at = `stage ${s - 1} → ${s}`;
      assert.ok(b.seats >= a.seats, `${at}: seats`);
      assert.ok(b.pace <= a.pace, `${at}: pace`);
      assert.ok(b.mExtras[0] >= a.mExtras[0] && b.mExtras[1] >= a.mExtras[1], `${at}: mExtras`);
      assert.ok(b.patience <= a.patience, `${at}: patience`);
      assert.ok(b.patiencePerWork <= a.patiencePerWork, `${at}: patience per work`);
      assert.ok(b.mid[0] >= a.mid[0] && b.mid[1] >= a.mid[1], `${at}: mid`);
      assert.ok(b.top[0] >= a.top[0] && b.top[1] >= a.top[1], `${at}: top`);
      assert.ok(b.matchaChance >= a.matchaChance, `${at}: matchaChance`);
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

describe('orderWork', () => {
  test('counts the drags of a bowl and a drink', () => {
    const bowl = { base: 'acai', mid: ['banana', 'granola'], top: ['honey'] };
    assert.equal(orderWork({ bowl, matcha: null }), 4 + 3);
    assert.equal(orderWork({ bowl: null, matcha: { fruit: 'mBanana', extras: ['ice'] } }), 3);
    assert.equal(orderWork({ bowl, matcha: { fruit: 'mBanana', extras: [] } }), 4 + 3 + 2);
    assert.equal(orderWork({ bowl, qty: 2, matcha: null }), 2 * (4 + 3), 'every one of the bowls');
  });
});

describe('upgrades & kitchen stats', () => {
  test('upgrade table is well formed', () => {
    const ids = UPGRADES.map((u) => u.id);
    assert.equal(new Set(ids).size, ids.length, 'duplicate upgrade id');
    for (const id of ['blenderSpeed', 'jug', 'blender2', 'bowlSlots', 'cupLift', 'freeze', 'matchaSlots', 'plants', 'jukebox', 'seating', 'neon']) {
      assert.ok(UPG[id], `missing upgrade ${id}`);
    }
    for (const u of UPGRADES) {
      assert.ok(['kitchen', 'decor'].includes(u.cat), `${u.id}: cat`);
      assert.ok(u.levels.length >= 1, `${u.id}: levels`);
      for (const lv of u.levels) {
        assert.ok(Number.isFinite(lv.cost) && lv.cost > 0, `${u.id}: cost`);
        for (const key of Object.keys(lv)) {
          if (key === 'cost') continue;
          if (key === 'needs') {
            for (const [id, n] of Object.entries(lv.needs)) assert.ok(UPG[id] && n >= 1 && n <= UPG[id].levels.length, `${u.id}: needs ${id}`);
            continue;
          }
          assert.ok(key === 'patience' || key in KITCHEN_BASE, `${u.id}: unknown stat ${key}`);
        }
      }
      if (u.cat === 'decor') assert.ok(u.levels.every((lv) => lv.patience > 0), `${u.id}: decor adds patience`);
    }
    assert.equal(UPG.matchaSlots.requiresLevel, MATCHA_LEVEL);
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
    assert.equal(getKitchenStats({ jug: 1 }).readyHold, 13.5, 'the big jug stays fresh longer');
    assert.ok(getKitchenStats({ jug: 1 }).readyHold > KITCHEN_BASE.readyHold);
    assert.equal(getKitchenStats({ blender2: 1 }).blenders, 2);
    assert.equal(getKitchenStats({ matchaSlots: 1 }).matchaSlots, 2);
    assert.equal(KITCHEN_BASE.cupLift, 0, 'no lift: cups by hand');
    UPG.cupLift.levels.forEach((lv, i) => assert.equal(getKitchenStats({ cupLift: i + 1 }).cupLift, i + 1, 'one spot per level'));
    assert.equal(UPG.cupLift.levels.length, getKitchenStats({ bowlSlots: 9 }).bowlSlots, 'a lift for every spot');
    assert.equal(KITCHEN_BASE.freeze, 0);
    assert.equal(getKitchenStats({ freeze: 2 }).freeze, 2);
    assert.equal(UPG.freeze.levels.length, getKitchenStats({ blender2: 1 }).blenders, 'freeze for every blender');
    assert.ok(getKitchenStats({ jug: 1 }).meltTime > KITCHEN_BASE.meltTime);
    assert.deepEqual(getKitchenStats({ unknownThing: 3 }), KITCHEN_BASE);
  });

  test('a lift for a spot or freeze for a blender that is not there yet waits for it', () => {
    assert.equal(upgradeNeeds('cupLift', {}), null);
    assert.equal(upgradeNeeds('cupLift', { cupLift: 1 }), null);
    assert.deepEqual(upgradeNeeds('cupLift', { cupLift: 2 }), { id: 'bowlSlots', lvl: 1 });
    assert.equal(upgradeNeeds('cupLift', { cupLift: 2, bowlSlots: 1 }), null);
    assert.deepEqual(upgradeNeeds('cupLift', { cupLift: 3, bowlSlots: 1 }), { id: 'bowlSlots', lvl: 2 });
    assert.equal(upgradeNeeds('cupLift', { cupLift: 4 }), null, 'maxed');
    assert.deepEqual(upgradeNeeds('freeze', { freeze: 1 }), { id: 'blender2', lvl: 1 });
    assert.equal(upgradeNeeds('freeze', { freeze: 1, blender2: 1 }), null);
    assert.equal(upgradeNeeds('jug', {}), null);
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
    ...MATCHA_LAYERS.map((l) => `layer.${l}`),
    ...INGREDIENTS.filter(isMatchaFruitIng).map((i) => `matcha.${i.id}`),
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
