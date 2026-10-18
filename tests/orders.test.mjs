import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { generateOrder, bowlValue, orderValue } from '../js/orders.js';
import { createRng } from '../js/rng.js';
import {
  INGREDIENTS, ING, LEVELS, START_OWNED, endlessConfig, isMatchaFruit, ingredientValue, matchaValue,
} from '../js/data.js';

const ALL = INGREDIENTS.map((i) => i.id);
const cfg = (over = {}) => ({ mid: [1, 3], top: [0, 3], matchaChance: 0, ...over });

function sample(n, opts, seed = 1) {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => generateOrder(rng, opts));
}

describe('generateOrder', () => {
  test('uses only owned ingredients in the right layers, without duplicates', () => {
    const owned = [...START_OWNED, 'strawberry', 'coconut', 'pitaya'];
    for (const o of sample(500, { owned, config: cfg() })) {
      assert.ok(owned.includes(o.bowl.base));
      assert.equal(ING[o.bowl.base].layer, 'base');
      for (const id of o.bowl.mid) {
        assert.ok(owned.includes(id));
        assert.equal(ING[id].layer, 'mid');
      }
      for (const id of o.bowl.top) {
        assert.ok(owned.includes(id));
        assert.equal(ING[id].layer, 'top');
      }
      assert.equal(new Set(o.bowl.mid).size, o.bowl.mid.length);
      assert.equal(new Set(o.bowl.top).size, o.bowl.top.length);
      assert.equal(o.matcha, null);
    }
  });

  test('item counts stay inside the configured ranges', () => {
    const counts = { mid: new Set(), top: new Set() };
    for (const o of sample(400, { owned: ALL, config: cfg({ mid: [2, 3], top: [1, 2] }) })) {
      assert.ok(o.bowl.mid.length >= 2 && o.bowl.mid.length <= 3, `mid ${o.bowl.mid.length}`);
      assert.ok(o.bowl.top.length >= 1 && o.bowl.top.length <= 2, `top ${o.bowl.top.length}`);
      counts.mid.add(o.bowl.mid.length);
      counts.top.add(o.bowl.top.length);
    }
    assert.deepEqual([...counts.mid].sort(), [2, 3]);
    assert.deepEqual([...counts.top].sort(), [1, 2]);
  });

  test('counts are capped by what the player owns; at least one fruit', () => {
    for (const o of sample(200, { owned: START_OWNED, config: cfg({ mid: [3, 3], top: [3, 3] }) })) {
      assert.equal(o.bowl.base, 'acai');
      assert.equal(o.bowl.mid.length, 2);
      assert.deepEqual(o.bowl.top, ['honey']);
    }
    for (const o of sample(200, { owned: START_OWNED, config: cfg({ mid: [0, 0], top: [0, 0] }) })) {
      assert.equal(o.bowl.mid.length, 1);
      assert.equal(o.bowl.top.length, 0);
    }
  });

  test('works with every level and endless config', () => {
    const configs = [...LEVELS, endlessConfig(0), endlessConfig(5), endlessConfig(40)];
    for (const config of configs) {
      for (const o of sample(30, { owned: ALL, config, matcha: true })) {
        assert.ok(o.bowl.mid.length >= Math.max(1, config.mid[0]) && o.bowl.mid.length <= config.mid[1]);
        assert.ok(o.bowl.top.length >= config.top[0] && o.bowl.top.length <= config.top[1]);
        assert.ok(o.bowl.mid.length + o.bowl.top.length <= 6);
      }
    }
  });

  test('a matcha only when the machine exists, the dice say so and a fruit is owned', () => {
    const owned = [...START_OWNED, 'strawberry'];
    assert.ok(sample(100, { owned, config: cfg({ matchaChance: 1 }) }).every((o) => o.matcha === null));
    assert.ok(sample(100, { owned, config: cfg({ matchaChance: 0 }), matcha: true }).every((o) => o.matcha === null));
    const withDrinks = sample(300, { owned, config: cfg({ matchaChance: 1 }), matcha: true });
    assert.ok(withDrinks.every((o) => ['banana', 'strawberry'].includes(o.matcha)));
    assert.ok(withDrinks.some((o) => o.matcha === 'strawberry') && withDrinks.some((o) => o.matcha === 'banana'));
    const noFruit = sample(100, { owned: ['acai', 'granola', 'honey'], config: cfg({ matchaChance: 1 }), matcha: true });
    assert.ok(noFruit.every((o) => o.matcha === null));
    const half = sample(2000, { owned, config: cfg({ matchaChance: 0.4 }), matcha: true });
    const share = half.filter((o) => o.matcha).length / half.length;
    assert.ok(share > 0.35 && share < 0.45, `matcha share ${share}`);
    for (const o of half) if (o.matcha) assert.ok(isMatchaFruit(o.matcha));
  });

  test('featured (newly bought) ingredients appear about twice as often', () => {
    const owned = ['acai', 'pitaya', 'banana', 'granola', 'strawberry', 'blueberry', 'honey', 'coconut', 'chia'];
    const config = cfg({ mid: [1, 1], top: [1, 1] });
    const n = 6000;
    const plain = sample(n, { owned, config });
    const boosted = sample(n, { owned, config, featured: ['pitaya', 'strawberry', 'chia'] });
    const share = (orders, pred) => orders.filter(pred).length / orders.length;
    // pitaya: 1/2 → 2/3; strawberry: 1/4 → 2/5; chia: 1/3 → 1/2
    assert.ok(Math.abs(share(plain, (o) => o.bowl.base === 'pitaya') - 0.5) < 0.03);
    assert.ok(Math.abs(share(boosted, (o) => o.bowl.base === 'pitaya') - 2 / 3) < 0.03);
    assert.ok(Math.abs(share(plain, (o) => o.bowl.mid.includes('strawberry')) - 0.25) < 0.03);
    assert.ok(Math.abs(share(boosted, (o) => o.bowl.mid.includes('strawberry')) - 0.4) < 0.03);
    assert.ok(Math.abs(share(boosted, (o) => o.bowl.top.includes('chia')) - 0.5) < 0.03);
  });

  test('deterministic for the same seed', () => {
    const opts = { owned: ALL, config: cfg({ matchaChance: 0.5 }), matcha: true };
    assert.deepEqual(sample(50, opts, 99), sample(50, opts, 99));
    assert.notDeepEqual(sample(50, opts, 99), sample(50, opts, 100));
  });
});

describe('pricing', () => {
  test('bowlValue sums base and items with quality levels', () => {
    const bowl = { base: 'acai', mid: ['banana', 'strawberry'], top: ['honey'] };
    const plain = ING.acai.price + ING.banana.price + ING.strawberry.price + ING.honey.price;
    assert.equal(bowlValue(bowl), plain);
    const lv = { acai: 1, banana: 2 };
    const expect = ingredientValue('acai', lv) + ingredientValue('banana', lv)
      + ingredientValue('strawberry', lv) + ingredientValue('honey', lv);
    assert.equal(bowlValue(bowl, lv), expect);
    assert.ok(bowlValue(bowl, lv) > plain);
    assert.equal(bowlValue({ base: null, mid: [], top: [] }), 0);
  });

  test('orderValue adds the matcha', () => {
    const order = { bowl: { base: 'acai', mid: ['banana'], top: [] }, matcha: 'mango' };
    assert.equal(orderValue(order), ING.acai.price + ING.banana.price + matchaValue('mango'));
    assert.equal(orderValue({ ...order, matcha: null }), ING.acai.price + ING.banana.price);
    assert.equal(orderValue(order, { mango: 1 }), ING.acai.price + ING.banana.price + matchaValue('mango', { mango: 1 }));
  });
});
