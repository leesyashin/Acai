// End-to-end playthrough of the real game (index.html) with real pointer drags.
// Run: node tests/e2e/playthrough.e2e.mjs   (serves the repo with tools/serve.mjs on :8090)
//
//   1. Mouse 1280×800, fresh profile: title → map → pre-level 1 → full tutorial + rest of level 1
//      (a small bot reads window.__acaiGame and serves every customer) → results ≥ 1★ → map →
//      shop: buy strawberry → level 2 shows the NEW badge on strawberry → quit via the pause menu.
//   2. Touch 1024×768 (CDP touch events), fresh profile: at least 3 customers served in level 1.
//   3. Injected save (stars 1–10, 5000 coins): endless starts, is played, and ends on the results.
//   4. Language EN: title, map, shop and the game HUD show English text.
//   5. Touch tablet/phone (mobile viewport): a two-finger pinch in the letterbox bands or on the
//      rotate hint does not zoom the page; touch taps and the rotate hint's dismiss button still work.
//   6. MacBook 1470×832 @2x (mouse + trackpad): trackpad pinches, ⌘/Ctrl + scroll and two-finger
//      swipes neither zoom nor navigate, the 3D blender is drawn at Retina resolution, and the
//      tutorial + 3 customers are played with mouse drags.
//   7. Two tabs on one profile: tab B's open shop shows the coins tab A banks, and a purchase in B
//      keeps A's win instead of overwriting it with B's stale copy of the save.
// Every scenario asserts zero console errors and page errors.
// Env: E2E_PORT (default 8090), E2E_FONTS=real|stub (default stub), E2E_OUT_DIR for failure shots.

import path from 'node:path';
import {
  startServer, launchBrowser, collectConsoleErrors, assertNoConsoleErrors, dragBetween, pinch, trackpadPinch, e2eOutDir,
} from './helpers.mjs';
import { ENDLESS_UNLOCK_LEVEL } from '../../js/data.js';

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
    bowls: g.bowls.map((b) => ({ cup: b.cup, base: b.base, mid: [...b.mid], top: [...b.top], uid: b.uid })),
    blenders: g.blenders.map((b) => ({ state: b.state, base: b.base, portions: b.portions, maxPortions: b.maxPortions })),
    slots: g.matcha ? g.matcha.slots.map((s) => ({ state: s.state, fruit: s.fruit, extras: [...s.extras] })) : [],
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

// One decision per call, like a player: serve > matcha > build bowls > pour > blend > put cups down.
function plan(s) {
  const waiting = s.seats.filter((c) => c && c.state === 'waiting').sort((a, b) => a.patience - b.patience);

  // matcha: the fruit from the matcha bar into an empty glass, its extras on it, the finished glass to the guest
  const usedSlots = new Set();
  const fits = (x, d) => x.state !== 'empty' && x.fruit === d.fruit && x.extras.every((e) => d.extras.includes(e));
  for (const c of waiting) {
    const d = c.order.matcha;
    if (!d || c.delivered.matcha) continue;
    const own = s.slots.findIndex((x, i) => !usedSlots.has(i) && fits(x, d));
    if (own >= 0) {
      usedSlots.add(own);
      const x = s.slots[own];
      const extra = d.extras.find((e) => !x.extras.includes(e));
      if (extra) return { kind: 'addExtra', slot: own, extra };
      if (x.state === 'ready') return { kind: 'serveGlass', slot: own, cust: c.id };
      continue;
    }
    const empty = s.slots.findIndex((x) => x.state === 'empty');
    if (empty >= 0) return { kind: 'loadGlass', slot: empty, fruit: d.fruit };
    const unwanted = s.slots.findIndex((x) => x.state === 'ready' && !waiting.some((w) => w.order.matcha && !w.delivered.matcha && fits(x, w.order.matcha)));
    if (unwanted >= 0) return { kind: 'trashGlass', slot: unwanted };
  }

  // bowls: serve a finished one, otherwise assign on-track bowls to customers
  const bowlWaiting = waiting.filter((c) => c.order.bowl && !c.delivered.bowl);
  for (const c of bowlWaiting) {
    const bi = s.bowls.findIndex((b) => matches(b, c.order.bowl));
    if (bi >= 0) return { kind: 'serveBowl', bowl: bi, cust: c.id };
  }
  const assigned = new Map();
  const needBowl = [];
  for (const c of bowlWaiting) {
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
    if (empty >= 0 && bl >= 0) return s.bowls[empty].cup ? { kind: 'pour', blender: bl, bowl: empty } : { kind: 'placeCup', bowl: empty };
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

  // a spare moment: an empty cup on a free spot
  const noCup = s.bowls.findIndex((b) => !b.cup);
  if (noCup >= 0) return { kind: 'placeCup', bowl: noCup };
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
    case 'placeCup':
      return { from: '[data-cup-stack]', to: `[data-bowl="${a.bowl}"]`, ok: [(x) => window.__acaiGame.bowls[x.i].cup, { i: a.bowl }] };
    case 'loadBlender':
      return { from: `[data-pack="${a.base}"]`, to: `[data-blender="${a.blender}"]`, ok: [(x) => window.__acaiGame.blenders[x.i].state !== 'empty', { i: a.blender }] };
    case 'cleanBlender':
      return { from: `[data-blender="${a.blender}"]`, to: '[data-trash]', ok: [(x) => window.__acaiGame.blenders[x.i].state === 'empty', { i: a.blender }] };
    case 'loadGlass':
      return { from: `[data-bin="${a.fruit}"]`, to: `[data-matcha-slot="${a.slot}"]`, ok: [(x) => window.__acaiGame.matcha.slots[x.i].state !== 'empty', { i: a.slot }] };
    case 'addExtra':
      return { from: `[data-bin="${a.extra}"]`, to: `[data-matcha-slot="${a.slot}"]`, ok: [(x) => window.__acaiGame.matcha.slots[x.i].extras.includes(x.id), { i: a.slot, id: a.extra }] };
    case 'serveGlass':
    case 'trashGlass':
      return {
        from: `[data-matcha-slot="${a.slot}"]`,
        to: a.kind === 'serveGlass' ? cust(a.cust) : '[data-trash]',
        ok: [(x) => window.__acaiGame.matcha.slots[x.i].state === 'empty', { i: a.slot }],
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
      // The bot puts its cups down while the first guest walks in, so the tutorial's cup steps
      // ("cupWait"/"cup", see gameplay.e2e.mjs) may be skipped; when shown they come before the pour.
      const order = ['pack', 'pour', 'add', 'serve', 'done'];
      let at = -1;
      for (const k of order) {
        const i = bot.tutSteps.indexOf(k, at + 1);
        assert(i > at, `tutorial step "${k}" not seen in order (seen: ${bot.tutSteps.join(' → ')})`);
        at = i;
      }
      const cupStep = bot.tutSteps.findIndex((k) => k === 'cup' || k === 'cupWait');
      assert(cupStep < 0 || cupStep < bot.tutSteps.indexOf('pour'), `cup step after the pour (${bot.tutSteps.join(' → ')})`);
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

    await check('results → map → shop: a quality star for the banana; the strawberry is still to come', async () => {
      await press(page, '.results-actions [data-action="map"]');
      await screenIs(page, 'map');
      const lvl2 = await page.getAttribute('.map-level[data-level="2"]', 'data-state');
      assert(lvl2 === 'current', `level 2 node state is "${lvl2}"`);
      await press(page, '.screen-map [data-action="shop"]');
      await screenIs(page, 'shop');
      const straw = await page.getAttribute('[data-shop-item="strawberry"]', 'data-state');
      assert(straw === 'locked', `strawberry card state "${straw}" before its level`);
      const before = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).coins, SAVE_KEY);
      await press(page, '[data-buy="ing"][data-id="banana"]');
      await page.waitForFunction(() => document.querySelector('[data-shop-item="banana"] .card-quality')?.getAttribute('aria-label')?.includes('1'), null, { timeout: 3000 });
      const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE_KEY);
      assert(saved.ingLevels.banana === 1, 'banana has no quality star after the purchase');
      assert(saved.coins === before - 60, `coins ${before} → ${saved.coins}, expected −60`);
      const pill = await page.getAttribute('.sc-coins', 'data-coins');
      assert(pill === String(Math.floor(saved.coins)), `coin pill data-coins="${pill}", wallet ${saved.coins}`);
    }, page);

    await check('level 2 brings nothing new (no NEU badge), quit via pause menu', async () => {
      await press(page, '[data-action="back"]');
      await startLevel(page, 2);
      const badges = await page.$$eval('.g-new', (els) => els.length);
      assert(badges === 0, `${badges} NEW badges in level 2, which brings no ingredient`);
      assert(!(await page.$('[data-bin="strawberry"]')), 'strawberry on the shelf before its level');
      assert(!(await page.$('[data-tutorial-step]')), 'tutorial shown again in level 2');
      await sleep(1500);
      await quitViaPause(page, false, 'map');
      const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE_KEY);
      assert(!saved.stars['2'], 'aborted level 2 recorded stars');
    }, page);

    await check('level 3 brings the strawberry: its card says so, it stands on the shelf with a NEU badge', async () => {
      await page.evaluate((k) => {
        const d = JSON.parse(localStorage.getItem(k));
        d.stars['2'] = 1;
        localStorage.setItem(k, JSON.stringify(d));
      }, SAVE_KEY);
      await page.reload();
      await screenIs(page, 'title');
      await press(page, '[data-action="play"]');
      await screenIs(page, 'map');
      await press(page, '.map-level[data-level="3"]');
      await page.waitForSelector('[data-prelevel] .prelevel-new', { timeout: 5000 });
      const fresh = await page.getAttribute('.prelevel-new', 'data-new-ingredients');
      assert(fresh === 'strawberry', `level 3 card lists "${fresh}" as new`);
      await press(page, '[data-prelevel] [data-action="start"]');
      await screenIs(page, 'game');
      await page.waitForFunction(() => !!window.__acaiGame, null, { timeout: 5000 });
      const badge = await page.textContent('[data-bin="strawberry"] .g-new');
      assert(badge === 'NEU', `strawberry badge text "${badge}"`);
      const others = await page.$$eval('.g-new', (els) => els.length);
      assert(others === 1, `${others} NEW badges, expected 1`);
      await quitViaPause(page, false, 'map');
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
  for (let i = 1; i <= ENDLESS_UNLOCK_LEVEL; i++) stars[i] = i % 3 === 0 ? 2 : 3;
  return {
    version: 2, coins: 5000, ingLevels: {}, upgrades: {},
    stars, endlessBest: 0, seenIntros: { basics: true }, settings: { lang: 'de', music: true, sfx: true },
    stats: { served: 0, earned: 0, played: ENDLESS_UNLOCK_LEVEL },
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
      assert(locked === 'false', `endless still locked with stars 1–${ENDLESS_UNLOCK_LEVEL}`);
      const coins = await page.getAttribute('.sc-coins', 'data-coins');
      assert(coins === '5000', `coin pill data-coins="${coins}"`);
      await press(page, '.screen-title [data-action="endless"]');
      await screenIs(page, 'game');
      await page.waitForFunction(() => window.__acaiGame?.mode === 'endless', null, { timeout: 5000 });
      const label = await page.textContent('.g-level');
      assert(label.includes(await tr(page, 'game.endless')), `HUD label "${label}"`);
      assert(await page.$('[data-matcha-slot="0"]'), 'endless has no matcha machine');
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

const viewportScale = (page) => page.evaluate(() => window.visualViewport?.scale ?? 1);
const wrapRect = (page) => page.evaluate(() => {
  const r = document.getElementById('stage-wrap').getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
});

async function noPageZoom(srv) {
  console.log('[touch, mobile viewports: the page never zooms]');
  for (const viewport of [{ width: 1180, height: 820 }, { width: 844, height: 390 }]) {
    const { width: w, height: h } = viewport;
    const label = `${w}×${h}`;
    const b = await launchBrowser({ fonts: FONTS, touch: true, isMobile: true, viewport });
    const { page } = b;
    const errors = collectConsoleErrors(page);
    page.setDefaultTimeout(8000);
    try {
      await page.goto(`${srv.url}/index.html`);
      await screenIs(page, 'title');
      await check(`${label}: pinches starting in the letterbox bands do not zoom the page`, async () => {
        const r = await wrapRect(page);
        const cases = [];
        if (r.top >= 30) {
          cases.push(['two fingers in the top band', { x: w / 2 - 10, y: r.top / 2 }, { x: w / 2 + 10, y: r.top / 2 }, 160]);
          cases.push(['one finger in the band, one on the stage', { x: w / 2, y: r.top / 2 }, { x: w / 2, y: r.top + 200 }, 60]);
        }
        if (r.left >= 30) {
          cases.push(['two fingers in the left band', { x: r.left / 2, y: h / 2 - 10 }, { x: r.left / 2, y: h / 2 + 10 }, 120]);
          cases.push(['a thumb in each side band', { x: r.left / 2, y: h / 2 }, { x: (r.right + w) / 2, y: h / 2 }, 40]);
          cases.push(['one finger in the band, one on the stage', { x: r.left / 2, y: h / 2 }, { x: r.left + 200, y: h / 2 }, 60]);
        }
        assert(cases.length >= 2, `no letterbox band at ${label} (stage-wrap ${JSON.stringify(r)})`);
        for (const [what, p1, p2, spread] of cases) {
          const scale = await pinch(page, p1, p2, { spread });
          assert(scale === 1, `${what}: page zoomed to ${scale}×`);
        }
        // touch-action does not inherit, but a gesture only gets what every ancestor allows.
        const css = await page.evaluate(() => [document.documentElement, document.body, document.getElementById('stage')]
          .map((el) => `${el.id || el.localName}:${getComputedStyle(el).touchAction}`));
        assert(css.every((x) => x.endsWith(':none')), `touch-action: ${css.join(', ')}`);
        const prevented = await page.evaluate(() => {
          const e = new Event('gesturestart', { bubbles: true, cancelable: true });
          document.body.dispatchEvent(e);
          return e.defaultPrevented;
        });
        assert(prevented, 'iOS gesturestart is not cancelled');
      }, page);

      await check(`${label}: full bleed – the art fills the bands, the top bar sits at the window's edges`, async () => {
        const r = await page.evaluate(() => {
          const wrap = document.getElementById('stage-wrap').getBoundingClientRect();
          const bar = document.querySelector('.sc-topbar').getBoundingClientRect();
          const counter = document.querySelector('.title-counter').getBoundingClientRect();
          return {
            bleed: document.documentElement.classList.contains('is-bleed'),
            page: [document.documentElement.scrollWidth, document.documentElement.scrollHeight, innerWidth, innerHeight],
            wrap: { left: wrap.left, top: wrap.top },
            bar: { left: bar.left, top: bar.top },
            counter: { left: counter.left, right: counter.right, bottom: counter.bottom },
          };
        });
        assert(r.bleed, 'no full bleed on a touch device');
        assert(r.page[0] <= r.page[2] && r.page[1] <= r.page[3], `the wide art widens the page (${r.page.join(' / ')})`);
        if (r.wrap.left >= 30) {
          assert(r.counter.left <= 0 && r.counter.right >= w, `the title counter does not run into the side bands (${JSON.stringify(r.counter)})`);
          assert(r.bar.left < r.wrap.left, `top bar not at the window's left edge (${r.bar.left} vs stage ${r.wrap.left})`);
        }
        if (r.wrap.top >= 30) {
          assert(r.counter.bottom >= h, `the title counter does not run into the bottom band (${JSON.stringify(r.counter)})`);
          assert(r.bar.top < r.wrap.top, `top bar not at the window's top edge (${r.bar.top} vs stage ${r.wrap.top})`);
        }
      }, page);

      await check(`${label}: touch taps still work`, async () => {
        await press(page, '[data-action="play"]', true);
        await screenIs(page, 'map');
      }, page);
      await check(`${label}: no console errors`, async () => assertNoConsoleErrors(errors, label));
    } finally {
      await b.close();
    }
  }

  const b = await launchBrowser({ fonts: FONTS, touch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  const { page } = b;
  const errors = collectConsoleErrors(page);
  try {
    await page.goto(`${srv.url}/index.html`);
    await screenIs(page, 'title');
    await check('390×844 portrait: a pinch on the rotate hint does not zoom, its button still dismisses it', async () => {
      await page.waitForSelector('#rotate-hint:not([hidden])', { timeout: 3000 });
      const scale = await pinch(page, { x: 180, y: 300 }, { x: 210, y: 300 }, { spread: 120 });
      assert(scale === 1, `page zoomed to ${scale}×`);
      await press(page, '[data-action="dismiss-rotate"]', true);
      await page.waitForSelector('#rotate-hint[hidden]', { state: 'attached', timeout: 3000 });
      assert(await viewportScale(page) === 1, 'page zoomed by the tap');
    }, page);
    await check('portrait: no console errors', async () => assertNoConsoleErrors(errors, 'portrait'));
  } finally {
    await b.close();
  }
}

// MacBook Air 13″ (1470×956) with a maximised browser window, Retina, mouse/trackpad.
async function macBook(srv) {
  const viewport = { width: 1470, height: 832 };
  const b = await launchBrowser({ fonts: FONTS, viewport, deviceScaleFactor: 2 });
  const { page } = b;
  const errors = collectConsoleErrors(page);
  page.setDefaultTimeout(8000);
  console.log('[MacBook 1470×832 @2x: mouse + trackpad, fresh profile]');
  try {
    await page.goto(`${srv.url}/index.html`);

    await check('MacBook: trackpad pinches, ⌘/Ctrl + scroll and two-finger swipes neither zoom nor navigate', async () => {
      await screenIs(page, 'title');
      const r = await wrapRect(page);
      assert(r.left >= 30, `no side band at 1470×832 (stage-wrap ${JSON.stringify(r)})`);
      assert(!(await page.evaluate(() => document.documentElement.classList.contains('is-bleed'))), 'a mouse window must stay framed, not full bleed');
      for (const [what, p] of [['on the stage', { x: viewport.width / 2, y: 400 }], ['in the side band', { x: r.left / 2, y: 400 }]]) {
        const scale = await trackpadPinch(page, p);
        assert(scale === 1, `pinch ${what}: page zoomed to ${scale}×`);
      }
      // A two-finger swipe sideways is a horizontal wheel; zooming with a modifier is a wheel too.
      await page.evaluate(() => {
        window.__wheels = [];
        window.addEventListener('wheel', (e) => window.__wheels.push(e.defaultPrevented));
      });
      await page.mouse.move(viewport.width / 2, 400);
      await page.mouse.wheel(-400, 0);
      await page.mouse.wheel(400, 0);
      for (const key of ['Meta', 'Control']) {
        await page.keyboard.down(key);
        await page.mouse.wheel(0, -300);
        await page.keyboard.up(key);
      }
      const wheels = await page.waitForFunction(() => window.__wheels.length >= 4 && window.__wheels, null, { timeout: 3000 })
        .then((h) => h.jsonValue(), () => page.evaluate(() => window.__wheels));
      assert(wheels.length >= 4 && wheels.every(Boolean), `wheel events not cancelled: ${JSON.stringify(wheels)}`);
      assert(await viewportScale(page) === 1, 'page zoomed by ⌘/Ctrl + scroll');
      const css = await page.evaluate(() => [document.documentElement, document.body]
        .map((el) => `${el.localName}:${getComputedStyle(el).overscrollBehaviorX}`));
      assert(css.every((x) => x.endsWith(':none')), `overscroll-behavior-x: ${css.join(', ')}`);
      // Safari's own trackpad pinch events and the Force Touch press (Look Up)
      const open = await page.evaluate(() => ['gesturestart', 'gesturechange', 'gestureend', 'webkitmouseforcewillbegin'].filter((type) => {
        const e = new Event(type, { bubbles: true, cancelable: true });
        document.getElementById('stage').dispatchEvent(e);
        return !e.defaultPrevented;
      }));
      assert(!open.length, `Safari events not cancelled: ${open.join(', ')}`);
    }, page);

    await check('MacBook: the stage fills the window height and the 3D blender is drawn at Retina resolution', async () => {
      await press(page, '[data-action="play"]');
      await startLevel(page, 1);
      const h = await page.evaluate(() => document.getElementById('stage').getBoundingClientRect().height);
      assert(Math.abs(h - (viewport.height - 16)) < 2, `stage ${h} px high in an ${viewport.height} px window`);
      const px = await page.waitForFunction(() => {
        const c = document.querySelector('canvas.g-3d-blender');
        const css = c?.getBoundingClientRect().width;
        return c && (c.width !== 300 || c.height !== 150) && { device: c.width, css }; // drawn (not the default size)
      }, null, { timeout: 5000 }).then((x) => x.jsonValue());
      assert(px.device >= px.css * 2 * 0.98, `blender canvas: ${px.device} device px for ${px.css.toFixed(1)} css px at 2×`);
    }, page);

    await check('MacBook: tutorial + at least 3 customers served with mouse drags', async () => {
      const bot = await playBot(page, { done: (s) => s.served >= 3, timeout: 150000 });
      const s = await snap(page);
      console.log(`        MacBook: served ${s.served}, lost ${s.lost}, ${bot.actions} drags, ${bot.rejects.length} rejected`
        + `${bot.rejects.length ? ` (${bot.rejects.join('; ')})` : ''}`);
      assert(s.served >= 3, `only ${s.served} served`);
      assert(bot.tutSteps.includes('done'), 'tutorial did not finish');
      assert(bot.rejects.length <= 2, `too many rejected drops: ${bot.rejects.join('; ')}`);
      assert(await viewportScale(page) === 1, 'page zoomed during play');
      await quitViaPause(page, false, 'map');
    }, page);

    await check('MacBook run: no console errors', async () => assertNoConsoleErrors(errors, 'MacBook run'));
  } finally {
    await b.close();
  }
}

async function twoTabs(srv) {
  const b = await launchBrowser({ fonts: FONTS, viewport: { width: 1280, height: 800 } });
  const tabA = b.page;
  const errorsA = collectConsoleErrors(tabA);
  tabA.setDefaultTimeout(8000);
  console.log('[two tabs, one profile]');
  try {
    await tabA.goto(`${srv.url}/index.html`);
    await screenIs(tabA, 'title');
    const start = { version: 1, coins: 200, stars: { 1: 1 }, seenIntros: { basics: true } };
    await tabA.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [SAVE_KEY, start]);
    await tabA.reload();
    await screenIs(tabA, 'title');

    const tabB = await b.context.newPage();
    const errorsB = collectConsoleErrors(tabB);
    tabB.setDefaultTimeout(8000);
    await tabB.goto(`${srv.url}/index.html`);

    await check('two tabs: B\'s open shop shows the coins A banks', async () => {
      await screenIs(tabB, 'title');
      await press(tabB, '[data-action="play"]');
      await screenIs(tabB, 'map');
      await press(tabB, '.screen-map [data-action="shop"]');
      await screenIs(tabB, 'shop');
      assert(await tabB.getAttribute('.sc-coins', 'data-coins') === '200', 'B does not start with 200 coins');
      // Tab A wins level 2 with 3 stars (the call the results flow makes).
      await tabA.evaluate(async () => (await import('/js/save.js')).recordLevelResult(2, { won: true, stars: 3, money: 150, served: 6 }));
      await tabB.waitForFunction(() => document.querySelector('.sc-coins')?.dataset.coins === '350', null, { timeout: 3000 });
    }, tabB);

    await check('two tabs: a purchase in B keeps A\'s win, and A shows both after a reload', async () => {
      await press(tabB, '[data-buy="ing"][data-id="honey"]');
      await tabB.waitForFunction(() => JSON.parse(localStorage.getItem('acaiFever.save.v1')).ingLevels?.honey === 1, null, { timeout: 3000 });
      const saved = await tabB.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE_KEY);
      assert(saved.stars['2'] === 3, `A's 3-star win was overwritten (stars ${JSON.stringify(saved.stars)})`);
      assert(saved.coins === 300, `coins ${saved.coins}, expected 200 + 150 − 50`);
      assert(saved.ingLevels.honey === 1, 'honey has no quality star');
      assert(saved.stats.played === 1, `stats.played ${saved.stats.played}`);

      await tabA.reload();
      await screenIs(tabA, 'title');
      await press(tabA, '[data-action="play"]');
      await screenIs(tabA, 'map');
      const lvl3 = await tabA.getAttribute('.map-level[data-level="3"]', 'data-state');
      assert(lvl3 === 'current', `level 3 node state is "${lvl3}" after A's level 2 win`);
      const coins = await tabA.getAttribute('.sc-coins', 'data-coins');
      assert(coins === '300', `A's coin pill data-coins="${coins}"`);
    }, tabA);

    await check('two tabs: no console errors', async () => {
      assertNoConsoleErrors(errorsA, 'tab A');
      assertNoConsoleErrors(errorsB, 'tab B');
    });
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
    await noPageZoom(srv);
    await macBook(srv);
    await twoTabs(srv);
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
