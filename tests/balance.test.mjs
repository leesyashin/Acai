// Balance simulation: simulated players of three speeds play every campaign level
// with the inventory a typical player owns at that point (see SCHEDULE in helpers/bot.mjs).
// Speeds are seconds per drag of a bot that never makes mistakes; 2.0–2.2 s is a casual pace.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import { playLevel, playCampaign, inventoryForLevel, SCHEDULE, tierCost } from './helpers/bot.mjs';
import { LEVELS, INGREDIENTS, UPGRADES, QUALITY_MULT } from '../js/data.js';

const SPEEDS = { fast: 0.85, average: 1.3, slow: 2.0 };
const SEEDS = [11, 22, 33, 44, 55];
const AFFORD_RANGE = [0.6, 1.4];
const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;

const median = (values) => {
  const s = values.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

function summarize(runs) {
  return {
    money: median(runs.map((r) => r.money)),
    stars: median(runs.map((r) => r.stars)),
    heartsLost: median(runs.map((r) => r.heartsLost)),
    served: median(runs.map((r) => r.served)),
    wins: runs.filter((r) => r.result === 'won').length,
  };
}

const results = new Map();

function economy() {
  const earnedBefore = {};
  let earned = 0;
  for (const lvl of LEVELS) {
    earnedBefore[lvl.id] = earned;
    earned += results.get(lvl.id).average.money;
  }
  let cost = 0;
  return SCHEDULE.filter((tier) => tier.from > 1).map((tier) => {
    cost += tierCost(tier);
    const got = earnedBefore[tier.from];
    return { from: tier.from, tierCost: tierCost(tier), cost, earned: got, ratio: got / cost };
  });
}

function printTable() {
  const pad = (v, n) => String(v).padStart(n);
  const lines = ['', 'lvl  goals            |  fast $  ★ | avg $  ★ ♥lost served | slow $  ★ ♥lost wins | Σavg $'];
  let cum = 0;
  for (const lvl of LEVELS) {
    const r = results.get(lvl.id);
    cum += r.average.money;
    lines.push(`${pad(lvl.id, 3)}  ${lvl.goals.join('/').padEnd(16)} | ${pad(r.fast.money, 7)} ${pad(r.fast.stars, 2)} | `
      + `${pad(r.average.money, 5)} ${pad(r.average.stars, 2)} ${pad(r.average.heartsLost, 5)} ${pad(r.average.served, 6)} | `
      + `${pad(r.slow.money, 6)} ${pad(r.slow.stars, 2)} ${pad(`${r.slow.heartsLost}/${lvl.hearts}`, 5)} `
      + `${pad(`${r.slow.wins}/5`, 4)} | ${pad(cum, 6)}`);
  }
  lines.push('', 'shop schedule: tier from level | tier cost | cumulative cost | avg coins earned before | ratio');
  for (const e of economy()) {
    lines.push(`  L${pad(e.from, 2)} | ${pad(e.tierCost, 5)} | ${pad(e.cost, 5)} | ${pad(e.earned, 5)} | ${e.ratio.toFixed(2)}`);
  }
  console.log(lines.join('\n'));
}

describe('campaign balance (simulated players)', () => {
  before(() => {
    for (const lvl of LEVELS) {
      const inv = inventoryForLevel(lvl.id);
      const row = {};
      for (const [name, actionTime] of Object.entries(SPEEDS)) {
        row[name] = summarize(SEEDS.map((seed) => playLevel({ level: lvl, ...inv, seed, actionTime })));
      }
      results.set(lvl.id, row);
    }
    printTable();
  });

  test('goals rise within each level and strictly from level to level', () => {
    LEVELS.forEach((lvl, i) => {
      assert.ok(lvl.goals[0] < lvl.goals[1] && lvl.goals[1] < lvl.goals[2], `level ${lvl.id} goals`);
      if (i === 0) return;
      for (let g = 0; g < 3; g++) {
        assert.ok(lvl.goals[g] > LEVELS[i - 1].goals[g], `level ${lvl.id} goal ${g + 1} must exceed level ${lvl.id - 1}`);
      }
    });
  });

  test('level 1 is easy: even the slow player wins', () => {
    const r = results.get(1);
    assert.ok(r.slow.stars >= 1, `slow stars ${r.slow.stars}`);
    assert.equal(r.slow.wins, SEEDS.length);
  });

  test('average player wins every level with at least 1 star and loses at most 1 heart', () => {
    for (const lvl of LEVELS) {
      const r = results.get(lvl.id).average;
      assert.ok(r.stars >= 1, `level ${lvl.id}: average median stars ${r.stars} (money ${r.money})`);
      assert.ok(r.heartsLost <= 1, `level ${lvl.id}: average median hearts lost ${r.heartsLost}`);
    }
  });

  test('fast player gets 3 stars everywhere', () => {
    for (const lvl of LEVELS) {
      const r = results.get(lvl.id).fast;
      assert.equal(r.stars, 3, `level ${lvl.id}: fast median stars ${r.stars} (money ${r.money}, goal ${lvl.goals[2]})`);
    }
  });

  test('3 stars take skill: the slow player does not get them from level 3 on', () => {
    for (const lvl of LEVELS.filter((l) => l.id >= 3)) {
      const r = results.get(lvl.id).slow;
      assert.ok(r.stars < 3, `level ${lvl.id}: slow median stars ${r.stars} (money ${r.money})`);
    }
  });

  test('coins from playing each level once roughly pay for the expected shop schedule', () => {
    for (const e of economy()) {
      assert.ok(e.ratio >= AFFORD_RANGE[0] && e.ratio <= AFFORD_RANGE[1],
        `before level ${e.from}: earned ${e.earned} vs cost ${e.cost} (ratio ${e.ratio.toFixed(2)})`);
    }
  });
});

describe('slower players and the shop', () => {
  test('a slow player (2.0 s) who bought the whole shop wins most runs of every 4-seat level', () => {
    const owned = INGREDIENTS.map((i) => i.id);
    const full = {
      owned,
      upgrades: Object.fromEntries(UPGRADES.map((u) => [u.id, u.levels.length])),
      ingLevels: Object.fromEntries(owned.map((id) => [id, QUALITY_MULT.length - 1])),
    };
    for (const lvl of LEVELS.filter((l) => l.seats === 4)) {
      const runs = SEEDS.map((seed) => playLevel({ level: lvl, ...full, seed, actionTime: SPEEDS.slow }));
      const wins = runs.filter((r) => r.result === 'won').length;
      assert.ok(wins >= 3, `level ${lvl.id}: full shop at ${SPEEDS.slow} s wins only ${wins}/${SEEDS.length}`);
    }
  });

  test('slow (2.0 s) and casual (2.2 s) players finish the campaign by replaying and shopping', () => {
    for (const [actionTime, maxPlays] of [[2.0, 70], [2.2, 100]]) {
      for (const seed of [1000, 5000]) {
        const r = playCampaign({ actionTime, seed });
        assert.ok(r.reachedEnd, `${actionTime} s (seed ${seed}): stuck at level ${r.stuckAt} after ${r.plays} plays`);
        assert.ok(r.plays <= maxPlays, `${actionTime} s (seed ${seed}): ${r.plays} plays for 20 levels`);
      }
    }
  });

  test('the big jug does not make blenders spoil more or cost coins', () => {
    const levelId = SCHEDULE.find((tier) => tier.upgrades.jug).from;
    const inv = inventoryForLevel(levelId);
    const without = { ...inv, upgrades: { ...inv.upgrades, jug: 0 } };
    const seeds = Array.from({ length: 12 }, (_, i) => 11 * (i + 1));
    for (const actionTime of [SPEEDS.average, SPEEDS.slow]) {
      const play = (stock) => seeds.map((seed) => playLevel({ level: levelId, ...stock, seed, actionTime }));
      const withJug = play(inv);
      const noJug = play(without);
      const ruined = [mean(withJug.map((r) => r.ruined)), mean(noJug.map((r) => r.ruined))];
      const money = [mean(withJug.map((r) => r.money)), mean(noJug.map((r) => r.money))];
      assert.ok(ruined[0] <= ruined[1] + 1.5,
        `level ${levelId} at ${actionTime} s: ${ruined[0].toFixed(2)} spoiled blenders with the jug vs ${ruined[1].toFixed(2)}`);
      assert.ok(money[0] >= 0.96 * money[1],
        `level ${levelId} at ${actionTime} s: ${money[0].toFixed(1)} coins with the jug vs ${money[1].toFixed(1)}`);
    }
  });
});

describe('endless balance', () => {
  test('endless gets harder until hearts run out; faster players last longer', () => {
    const inv = inventoryForLevel(12);
    const runs = Object.fromEntries(Object.entries(SPEEDS).map(([name, actionTime]) => [
      name, playLevel({ endless: true, ...inv, featured: [], seed: 5, actionTime, maxTime: 1500 }),
    ]));
    for (const r of Object.values(runs)) {
      assert.equal(r.result, 'lost');
      assert.equal(r.hearts, 0);
      assert.ok(r.stage >= 2, `stage ${r.stage}`);
    }
    assert.ok(runs.fast.time > runs.average.time && runs.average.time > runs.slow.time);
    assert.ok(runs.average.time > 120 && runs.average.time < 900, `average lasted ${runs.average.time}s`);
  });
});
