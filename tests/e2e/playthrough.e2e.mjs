// End-to-end playthrough of the real game (index.html) with real pointer drags.
// Run: node tests/e2e/playthrough.e2e.mjs   (serves the repo with tools/serve.mjs on :8090)
//
//   1. Mouse 1280×800, fresh profile: title → map → pre-level 1 → full tutorial + rest of level 1
//      (a small bot reads window.__acaiGame and serves every customer) → results ≥ 1★ → map →
//      shop: buy strawberry → level 2 shows the NEW badge on strawberry → quit via the pause menu.
//   2. Touch 1024×768 (CDP touch events), fresh profile: at least 3 customers served in level 1.
//   3. Injected save (stars 1–10, 5000 coins): endless starts, is played, and ends on the results.
//   4. Language EN: title, map, shop and the game HUD show English text.
// Every scenario asserts zero console errors and page errors.
// Env: E2E_PORT (default 8090), E2E_FONTS=real|stub (default stub), E2E_OUT_DIR for failure shots.

import path from 'node:path';
import {
  startServer, launchBrowser, collectConsoleErrors, assertNoConsoleErrors, dragBetween, e2eOutDir,
} from './helpers.mjs';

const PORT = Number(process.env.E2E_PORT) || 8090;
const FONTS = process.env.E2E_FONTS === 'real' ? 'real' : 'stub';
const SAVE_KEY = 'acaiFever.save.v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function check(name, fn, page) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ok    ${name}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  } catch (err) {
    results.push({ name, ok: false, err });
    console.log(`  FAIL  ${name}\n        ${String(err.stack || err.message).split('\n').slice(0, 6).join('\n        ')}`);
    if (page) {
      const file = path.join(e2eOutDir('playthrough'), `fail-${results.length}.png`);
      await page.screenshot({ path: file }).catch(() => {});
      console.log(`        screenshot: ${file}`);
    }
  }
}

// ------------------------------------------------------------------ page helpers
const screenIs = (page, name, timeout = 8000) => page.waitForFunction(
  (n) => document.querySelector('#stage > [data-screen]')?.dataset.screen === n, name, { timeout, polling: 50 },
);

async function press(page, selector, touch) {
  const loc = page.locator(selector).first();
  await loc.waitFor({ state: 'visible', timeout: 8000 });
  // force: the title Play button pulses forever, so Playwright would wait for it to settle.
  if (touch) await loc.tap({ force: true });
  else await loc.click({ force: true });
}

const tr = (page, key, params) => page.evaluate(async ([k, p]) => (await import('/js/i18n.js')).t(k, p), [key, params]);
const stageText = (page) => page.evaluate(() => document.getElementById('stage').innerText);

async function startLevel(page, id, touch) {
  await screenIs(page, 'map');
  await press(page, `.map-level[data-level="${id}"]`, touch);
  await page.waitForSelector('[data-prelevel]', { timeout: 5000 });
  await press(page, '[data-prelevel] [data-action="start"]', touch);
  await screenIs(page, 'game');
  await page.waitForFunction(() => !!window.__acaiGame, null, { timeout: 5000 });
}

async function quitViaPause(page, touch, to = 'map') {
  await press(page, '[data-pause]', touch);
  await page.waitForSelector('[data-pause-overlay]:not([hidden])', { timeout: 3000 });
  assert(await page.evaluate(() => window.__acaiGame.status === 'paused'), 'pause menu open but game not paused');
  await press(page, '[data-pause-overlay] [data-action="quit"]', touch);
  await screenIs(page, to);
}

// ------------------------------------------------------------------ the bot
const snap = (page) => page.evaluate(() => {
  const g = window.__acaiGame;
  if (!g) return null;
  const tut = document.querySelector('[data-tutorial-step]')?.dataset.tutorialStep || null;
  return {
    status: g.status, mode: g.mode, money: g.money, served: g.served, lost: g.lost, hearts: g.hearts,
    time: g.time, closing: g.closing, tutorialHold: g.tutorialHold, tut,
    seats: g.seats.map((c) => c && {
      id: c.id, state: c.state, patience: c.patience, order: c.order, delivered: { ...c.delivered },
    }),
    bowls: g.bowls.map((b) => ({ base: b.base, mid: [...b.mid], top: [...b.top], uid: b.uid })),
    blenders: g.blenders.map((b) => ({ state: b.state, base: b.base, portions: b.portions, maxPortions: b.maxPortions })),
    slots: g.smoothie ? g.smoothie.slots.map((s) => ({ state: s.state, fruit: s.fruit })) : [],
  };
});

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
const matches = (b, o) => !!b.base && b.base === o.base && sameSet(b.mid, o.mid) && sameSet(b.top, o.top);
function onTrack(b, o) {
  if (!b.base || b.base !== o.base) return false;
  if (!b.mid.every((x) => o.mid.includes(x)) || !b.top.every((x) => o.top.includes(x))) return false;
  return b.top.length === 0 || o.mid.every((x) => b.mid.includes(x));
}
const nextMissing = (b, o) => o.mid.find((x) => !b.mid.includes(x)) || o.top.find((x) => !b.top.includes(x)) || null;
const POURABLE = ['ready', 'overflowing'];

// One decision per call, like a player: serve > smoothies > build bowls > pour > blend.
function plan(s) {
  const waiting = s.seats.filter((c) => c && c.state === 'waiting').sort((a, b) => a.patience - b.patience);

  // smoothies
  const usedSlots = new Set();
  for (const c of waiting) {
    const fruit = c.order.smoothie;
    if (!fruit || c.delivered.smoothie) continue;
    const ready = s.slots.findIndex((x, i) => !usedSlots.has(i) && x.state === 'ready' && x.fruit === fruit);
    if (ready >= 0) return { kind: 'serveCup', slot: ready, cust: c.id };
    const mixing = s.slots.findIndex((x, i) => !usedSlots.has(i) && x.state === 'mixing' && x.fruit === fruit);
    if (mixing >= 0) {
      usedSlots.add(mixing);
      continue;
    }
    const empty = s.slots.findIndex((x) => x.state === 'empty');
    if (empty >= 0) return { kind: 'loadCup', slot: empty, fruit };
    const unwanted = s.slots.findIndex((x) => x.state === 'ready' && !waiting.some((w) => w.order.smoothie === x.fruit && !w.delivered.smoothie));
    if (unwanted >= 0) return { kind: 'trashCup', slot: unwanted };
  }

  // bowls: serve a finished one, otherwise assign on-track bowls to customers
  for (const c of waiting) {
    if (c.delivered.bowl) continue;
    const bi = s.bowls.findIndex((b) => matches(b, c.order.bowl));
    if (bi >= 0) return { kind: 'serveBowl', bowl: bi, cust: c.id };
  }
  const assigned = new Map();
  const needBowl = [];
  for (const c of waiting) {
    if (c.delivered.bowl) continue;
    const bi = s.bowls.findIndex((b, i) => !assigned.has(i) && onTrack(b, c.order.bowl));
    if (bi >= 0) assigned.set(bi, c);
    else needBowl.push(c);
  }
  for (const [bi, c] of assigned) {
    const ing = nextMissing(s.bowls[bi], c.order.bowl);
    if (ing) return { kind: 'add', bowl: bi, ing };
  }
  for (const c of needBowl) {
    const empty = s.bowls.findIndex((b) => !b.base);
    const bl = s.blenders.findIndex((b) => POURABLE.includes(b.state) && b.base === c.order.bowl.base);
    if (empty >= 0 && bl >= 0) return { kind: 'pour', blender: bl, bowl: empty };
    if (empty < 0) {
      const junk = s.bowls.findIndex((b, i) => !assigned.has(i) && b.base);
      if (junk >= 0) return { kind: 'trashBowl', bowl: junk };
    }
  }

  // blenders
  const ruined = s.blenders.findIndex((b) => b.state === 'ruined');
  if (ruined >= 0) return { kind: 'cleanBlender', blender: ruined };
  const demand = {};
  for (const c of needBowl) demand[c.order.bowl.base] = (demand[c.order.bowl.base] || 0) + 1;
  for (const [base, n] of Object.entries(demand)) {
    const supply = s.blenders
      .filter((b) => b.base === base && (b.state === 'blending' || POURABLE.includes(b.state)))
      .reduce((sum, b) => sum + (b.state === 'blending' ? b.maxPortions : b.portions), 0);
    if (supply >= n) continue;
    const free = s.blenders.findIndex((b) => b.state === 'empty');
    if (free >= 0) return { kind: 'loadBlender', blender: free, base };
    const wrong = s.blenders.findIndex((b) => POURABLE.includes(b.state) && !demand[b.base]);
    if (wrong >= 0) return { kind: 'cleanBlender', blender: wrong };
  }
  return null;
}

const cust = (id) => `[data-customer-id="${id}"] .g-figure`;

// Drag for an action + a page-side predicate that confirms the engine accepted it.
function dragFor(a, s) {
  switch (a.kind) {
    case 'serveBowl':
      return { from: `[data-bowl="${a.bowl}"]`, to: cust(a.cust), ok: [(x) => window.__acaiGame.bowls[x.i].uid !== x.uid, { i: a.bowl, uid: s.bowls[a.bowl].uid }] };
    case 'trashBowl':
      return { from: `[data-bowl="${a.bowl}"]`, to: '[data-trash]', ok: [(x) => window.__acaiGame.bowls[x.i].uid !== x.uid, { i: a.bowl, uid: s.bowls[a.bowl].uid }] };
    case 'add':
      return { from: `[data-bin="${a.ing}"]`, to: `[data-bowl="${a.bowl}"]`, ok: [(x) => { const b = window.__acaiGame.bowls[x.i]; return b.mid.includes(x.id) || b.top.includes(x.id); }, { i: a.bowl, id: a.ing }] };
    case 'pour':
      return { from: `[data-blender="${a.blender}"]`, to: `[data-bowl="${a.bowl}"]`, ok: [(x) => !!window.__acaiGame.bowls[x.i].base, { i: a.bowl }] };
    case 'loadBlender':
      return { from: `[data-pack="${a.base}"]`, to: `[data-blender="${a.blender}"]`, ok: [(x) => window.__acaiGame.blenders[x.i].state !== 'empty', { i: a.blender }] };
    case 'cleanBlender':
      return { from: `[data-blender="${a.blender}"]`, to: '[data-trash]', ok: [(x) => window.__acaiGame.blenders[x.i].state === 'empty', { i: a.blender }] };
    case 'loadCup':
      return { from: `[data-bin="${a.fruit}"]`, to: `[data-smoothie-slot="${a.slot}"]`, ok: [(x) => window.__acaiGame.smoothie.slots[x.i].state !== 'empty', { i: a.slot }] };
    case 'serveCup':
    case 'trashCup':
      return {
        from: `[data-smoothie-slot="${a.slot}"]`,
        to: a.kind === 'serveCup' ? cust(a.cust) : '[data-trash]',
        ok: [(x) => window.__acaiGame.smoothie.slots[x.i].state === 'empty', { i: a.slot }],
      };
    default:
      throw new Error(`unknown action ${a.kind}`);
  }
}

/**
 * Plays the running game with real drags until `done(snapshot)` is true or the game is over.
 * Returns { actions, rejects, tutSteps }.
 */
async function playBot(page, { touch = false, done = () => false, timeout = 240000 } = {}) {
  const t0 = Date.now();
  const stats = { actions: 0, rejects: [], tutSteps: [] };
  while (Date.now() - t0 < timeout) {
    const s = await snap(page);
    if (!s || s.status === 'won' || s.status === 'lost') return stats;
    if (s.tut && stats.tutSteps[stats.tutSteps.length - 1] !== s.tut) stats.tutSteps.push(s.tut);
    if (done(s)) return stats;
    if (s.tut === 'done') {
      await press(page, '[data-tut-go]', touch);
      await sleep(150);
      continue;
    }
    const a = plan(s);
    if (!a) {
      await sleep(120);
      continue;
    }
    const d = dragFor(a, s);
    const exists = await page.evaluate(([f, t]) => !!document.querySelector(f) && !!document.querySelector(t), [d.from, d.to]);
    if (!exists) {
      await sleep(80);
      continue;
    }
    await page.evaluate(() => document.querySelector('.g-fx .g-toast')?.remove());
    await dragBetween(page, d.from, d.to, { touch, steps: 10, stepDelay: 12, holdMs: 40, timeout: 3000 });
    stats.actions++;
    const ok = await page.waitForFunction(d.ok[0], d.ok[1], { timeout: 1500, polling: 40 }).then(() => true, () => false);
    if (!ok) {
      const toast = await page.evaluate(() => document.querySelector('.g-fx .g-toast')?.textContent || '');
      const over = await page.evaluate(() => window.__acaiGame?.status !== 'playing');
      if (!over) stats.rejects.push(`${a.kind}${toast ? `: ${toast}` : ''}`);
    }
  }
  throw new Error(`bot timed out after ${timeout} ms`);
}

// ------------------------------------------------------------------ scenarios
async function mouseCampaign(srv) {
  const b = await launchBrowser({ fonts: FONTS, viewport: { width: 1280, height: 800 } });
  const { page } = b;
  const errors = collectConsoleErrors(page);
  page.setDefaultTimeout(8000);
  console.log('[mouse 1280×800, fresh profile]');
  try {
    await page.goto(`${srv.url}/index.html`);
    let bot = null;

    await check('title → map → pre-level 1 → game (tutorial running)', async () => {
      await screenIs(page, 'title');
      await press(page, '[data-action="play"]');
      await startLevel(page, 1);
      await page.waitForSelector('[data-tutorial-step]', { timeout: 5000 });
      const s = await snap(page);
      assert(s.tutorialHold, 'tutorial hold is not active in level 1 on a fresh profile');
      assert(s.blenders.length === 1 && s.bowls.length === 2, 'level 1 kitchen should have 1 blender and 2 bowls');
      const bins = await page.$$eval('[data-bin], [data-pack]', (els) => els.map((e) => e.dataset.bin || e.dataset.pack).sort());
      assert(JSON.stringify(bins) === JSON.stringify(['acai', 'banana', 'granola', 'honey']), `start ingredients: ${bins}`);
    }, page);

    await check('level 1: full tutorial + every customer served with real mouse drags → results ≥ 1★', async () => {
      bot = await playBot(page, { timeout: 260000 });
      const order = ['pack', 'wait', 'pour', 'add', 'serve', 'done'];
      let at = -1;
      for (const k of order) {
        const i = bot.tutSteps.indexOf(k, at + 1);
        assert(i > at, `tutorial step "${k}" not seen in order (seen: ${bot.tutSteps.join(' → ')})`);
        at = i;
      }
      const s = await page.evaluate(() => {
        const g = window.__acaiGame;
        return g ? { status: g.status, stars: g.stars, money: g.money, served: g.served, lost: g.lost } : null;
      });
      assert(s, 'game vanished before the result was read');
      console.log(`        level 1: ${s.status}, ${s.stars}★, ${s.money} coins, served ${s.served}, lost ${s.lost}, `
        + `${bot.actions} drags, ${bot.rejects.length} rejected${bot.rejects.length ? ` (${bot.rejects.join('; ')})` : ''}`);
      assert(s.status === 'won' && s.stars >= 1, `level 1 not won with ≥1 star (${s.status}, ${s.stars}★)`);
      assert(s.lost === 0, `${s.lost} customer(s) walked out`);
      assert(bot.rejects.length <= 2, `too many rejected drops: ${bot.rejects.join('; ')}`);
      await screenIs(page, 'results', 8000);
      const filled = await page.$$eval('.results-star[data-filled="true"]', (els) => els.length);
      assert(filled === s.stars && filled >= 1, `results shows ${filled} filled stars, game had ${s.stars}`);
      const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE_KEY);
      assert(saved.stars['1'] === s.stars, 'stars not saved');
      assert(saved.coins === s.money, `coins not banked (${saved.coins} vs ${s.money})`);
      assert(saved.seenIntros.basics === true, 'tutorial not marked as seen');
    }, page);

    await check('results → map → shop: buy strawberry', async () => {
      await press(page, '.results-actions [data-action="map"]');
      await screenIs(page, 'map');
      const lvl2 = await page.getAttribute('.map-level[data-level="2"]', 'data-state');
      assert(lvl2 === 'current', `level 2 node state is "${lvl2}"`);
      await press(page, '.screen-map [data-action="shop"]');
      await screenIs(page, 'shop');
      const before = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).coins, SAVE_KEY);
      await press(page, '[data-buy="ing"][data-id="strawberry"]');
      await page.waitForFunction(() => document.querySelector('[data-shop-item="strawberry"]')?.dataset.state === 'upgrade', null, { timeout: 3000 });
      const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE_KEY);
      assert(saved.owned.includes('strawberry'), 'strawberry not owned after purchase');
      assert(saved.newIngredients.includes('strawberry'), 'strawberry not flagged as new');
      assert(saved.coins === before - 70, `coins ${before} → ${saved.coins}, expected −70`);
      const pill = await page.getAttribute('.sc-coins', 'data-coins');
      assert(pill === String(Math.floor(saved.coins)), `coin pill data-coins="${pill}", wallet ${saved.coins}`);
    }, page);

    await check('level 2 starts with strawberry on the shelf and a NEU badge, quit via pause menu', async () => {
      await press(page, '[data-action="back"]');
      await startLevel(page, 2);
      const badge = await page.textContent('[data-bin="strawberry"] .g-new');
      assert(badge === 'NEU', `strawberry badge text "${badge}"`);
      const others = await page.$$eval('.g-new', (els) => els.length);
      assert(others === 1, `${others} NEW badges, expected 1`);
      assert(!(await page.$('[data-tutorial-step]')), 'tutorial shown again in level 2');
      await sleep(1500);
      await quitViaPause(page, false, 'map');
      const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE_KEY);
      assert(saved.newIngredients.includes('strawberry'), 'quitting a level must not consume the NEW flag');
      assert(!saved.stars['2'], 'aborted level 2 recorded stars');
    }, page);

    await check('mouse run: no console errors', async () => assertNoConsoleErrors(errors, 'mouse run'));
  } finally {
    await b.close();
  }
}

async function touchCampaign(srv) {
  const b = await launchBrowser({ fonts: FONTS, touch: true, viewport: { width: 1024, height: 768 } });
  const { page } = b;
  const errors = collectConsoleErrors(page);
  page.setDefaultTimeout(8000);
  console.log('[touch 1024×768, fresh profile]');
  try {
    await page.goto(`${srv.url}/index.html`);
    await check('touch: title → map → level 1 via taps', async () => {
      await screenIs(page, 'title');
      await press(page, '[data-action="play"]', true);
      await startLevel(page, 1, true);
      const scale = await page.evaluate(() => document.getElementById('stage').getBoundingClientRect().width / 1280);
      assert(Math.abs(scale - 0.775) < 0.03, `stage scale ${scale}`);
    }, page);

    await check('touch: tutorial + at least 3 customers served with CDP touch drags', async () => {
      const bot = await playBot(page, { touch: true, done: (s) => s.served >= 3, timeout: 150000 });
      const s = await snap(page);
      console.log(`        touch: served ${s.served}, lost ${s.lost}, ${bot.actions} drags, ${bot.rejects.length} rejected`
        + `${bot.rejects.length ? ` (${bot.rejects.join('; ')})` : ''}`);
      assert(s.served >= 3, `only ${s.served} served`);
      assert(bot.tutSteps.includes('done'), 'tutorial did not finish');
      assert(bot.rejects.length <= 2, `too many rejected drops: ${bot.rejects.join('; ')}`);
      const scrolled = await page.evaluate(() => window.scrollY || document.scrollingElement.scrollTop);
      assert(scrolled === 0, `page scrolled by ${scrolled}px during touch play`);
      await quitViaPause(page, true, 'map');
    }, page);

    await check('touch run: no console errors', async () => assertNoConsoleErrors(errors, 'touch run'));
  } finally {
    await b.close();
  }
}

function injectedSave() {
  const stars = {};
  for (let i = 1; i <= 10; i++) stars[i] = i % 3 === 0 ? 2 : 3;
  return {
    version: 1, coins: 5000, owned: ['acai', 'banana', 'granola', 'honey'], ingLevels: {}, upgrades: {},
    stars, endlessBest: 0, newIngredients: [], seenIntros: { basics: true }, settings: { lang: 'de', music: true, sfx: true },
    stats: { served: 0, earned: 0, played: 10 },
  };
}

async function endlessAndLanguage(srv) {
  const b = await launchBrowser({ fonts: FONTS, viewport: { width: 1280, height: 800 } });
  const { page } = b;
  const errors = collectConsoleErrors(page);
  page.setDefaultTimeout(8000);
  console.log('[injected save: endless + English]');
  try {
    await page.goto(`${srv.url}/index.html`);
    await screenIs(page, 'title');
    await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [SAVE_KEY, injectedSave()]);
    await page.reload();

    await check('endless: unlocked on the title, starts and is played (≥ 2 customers)', async () => {
      await screenIs(page, 'title');
      const locked = await page.getAttribute('.screen-title [data-action="endless"]', 'aria-disabled');
      assert(locked === 'false', 'endless still locked with stars 1–10');
      const coins = await page.getAttribute('.sc-coins', 'data-coins');
      assert(coins === '5000', `coin pill data-coins="${coins}"`);
      await press(page, '.screen-title [data-action="endless"]');
      await screenIs(page, 'game');
      await page.waitForFunction(() => window.__acaiGame?.mode === 'endless', null, { timeout: 5000 });
      const label = await page.textContent('.g-level');
      assert(label.includes(await tr(page, 'game.endless')), `HUD label "${label}"`);
      assert(await page.$('[data-smoothie-slot="0"]'), 'endless has no smoothie machine');
      const bot = await playBot(page, { done: (s) => s.served >= 2, timeout: 90000 });
      const s = await snap(page);
      console.log(`        endless: served ${s.served}, money ${s.money}, ${bot.actions} drags, ${bot.rejects.length} rejected`);
      assert(s.served >= 2 && s.status === 'playing', `endless: served ${s.served}, status ${s.status}`);
    }, page);

    await check('endless: run ends when hearts are gone → results with best score', async () => {
      const money = await page.evaluate(() => window.__acaiGame.money);
      await page.evaluate(() => { window.__acaiSpeed = 12; });
      await screenIs(page, 'results', 90000);
      await page.evaluate(() => { window.__acaiSpeed = 1; });
      const headline = await page.textContent('#results-title');
      assert(headline === await tr(page, 'results.endless'), `results headline "${headline}"`);
      const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE_KEY);
      assert(saved.endlessBest === money, `endless best ${saved.endlessBest}, expected ${money}`);
      await press(page, '.results-actions [data-action="title"]');
      await screenIs(page, 'title');
    }, page);

    const GERMAN = /[äöüßÄÖÜ]|\b(Spielen|Zutaten|Küche|Banane|Honig|Einstellungen|Münzen|Weiter|Zurück|Sterne|Endlos|Basis)\b/;
    const assertEnglish = async (label, keys) => {
      const text = await stageText(page);
      const german = text.match(GERMAN);
      assert(!german, `${label}: German text "${german?.[0]}" visible in English mode`);
      for (const [k, p] of keys) {
        const want = await tr(page, k, p);
        assert(text.includes(want), `${label}: "${want}" (${k}) not visible`);
      }
    };

    await check('language EN: title, map, shop and game HUD are English', async () => {
      await press(page, '.screen-title [data-lang="en"]');
      await page.waitForFunction(() => document.documentElement.lang === 'en', null, { timeout: 3000 });
      await screenIs(page, 'title');
      assert(await tr(page, 'screen.play') === 'Play', 'i18n did not switch to English');
      await assertEnglish('title', [['screen.play'], ['screen.endless'], ['screen.tagline']]);
      const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE_KEY);
      assert(saved.settings.lang === 'en', 'language not saved');

      await press(page, '[data-action="play"]');
      await screenIs(page, 'map');
      await assertEnglish('map', [['map.title']]);

      await press(page, '.screen-map [data-action="shop"]');
      await screenIs(page, 'shop');
      await assertEnglish('shop', [['shop.tab.ingredients'], ['shop.tab.kitchen'], ['shop.tab.decor'], ['ing.banana'], ['layer.mid']]);
      await press(page, '[data-action="back"]');

      await startLevel(page, 2);
      await page.waitForSelector('.g-banner-card', { timeout: 3000 });
      await assertEnglish('game', [['ing.banana'], ['ing.honey'], ['game.level', { n: 2 }]]);
      const banner = await page.textContent('.g-banner-card');
      const goal = await page.evaluate(() => window.__acaiGame.config.goals[0]);
      assert(banner.includes(await tr(page, 'game.goal', { n: goal })), `banner "${banner}"`);
      const aria = await page.getAttribute('[data-pause]', 'aria-label');
      assert(aria === 'Pause game', `pause aria-label "${aria}"`);
      await press(page, '[data-pause]');
      await page.waitForSelector('[data-pause-overlay]:not([hidden])');
      await assertEnglish('pause menu', [['game.pause'], ['game.resume'], ['game.quitMap']]);
      await press(page, '[data-pause-overlay] [data-action="quit"]');
      await screenIs(page, 'map');
    }, page);

    await check('injected-save run: no console errors', async () => assertNoConsoleErrors(errors, 'endless/EN run'));
  } finally {
    await b.close();
  }
}

// ------------------------------------------------------------------ main
async function main() {
  const srv = await startServer({ port: PORT });
  srv.url = srv.url.replace(/\/$/, '');
  console.log(`playthrough on ${srv.url} (fonts: ${FONTS})`);
  try {
    await mouseCampaign(srv);
    await touchCampaign(srv);
    await endlessAndLanguage(srv);
  } finally {
    await srv.close();
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
