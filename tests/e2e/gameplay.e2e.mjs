// E2E playthrough of the gameplay screen (js/game-view.js) through tools/game-harness.html.
// Plays with real pointer drags: mouse at 1280×800 and touch at 1024×768.
// Run: node tests/e2e/gameplay.e2e.mjs   (serves the repo on :8091, exits non-zero on failure)
// Screenshots go to $E2E_OUT_DIR/gameplay (default: the OS temp dir), never into the repo.

import path from 'node:path';
import {
  startServer, launchBrowser, collectConsoleErrors, assertNoConsoleErrors, dragBetween, e2eOutDir,
} from './helpers.mjs';
import { createGame, tick } from '../../js/engine.js';
import { getKitchenStats, INGREDIENTS } from '../../js/data.js';

const PORT = Number(process.env.E2E_PORT) || 8090;
const OUT = e2eOutDir('gameplay');
const ALL = INGREDIENTS.map((i) => i.id);
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ok    ${name}`);
  } catch (err) {
    results.push({ name, ok: false, err });
    console.log(`  FAIL  ${name}\n        ${String(err.message).split('\n').join('\n        ')}`);
  }
}

// ------------------------------------------------------------------ server
async function serve() {
  try {
    const srv = await startServer({ port: PORT });
    return { url: srv.url.replace(/\/$/, ''), close: () => srv.close() };
  } catch (err) {
    if (err.code !== 'EADDRINUSE') throw err;
    const url = `http://127.0.0.1:${PORT}`;
    const res = await fetch(`${url}/tools/game-harness.html`).catch(() => null);
    if (!res?.ok) throw err;
    console.log(`(reusing the server already listening on :${PORT})`);
    return { url, close: async () => {} };
  }
}

// First order of a level for a seed (the first customer's order only depends on the seed).
function firstOrder(seed, levelId, owned) {
  const g = createGame({
    mode: 'campaign', level: levelId, owned, ingLevels: {}, kitchen: getKitchenStats({}),
    smoothies: levelId >= 7, seed, tutorial: levelId === 1,
  });
  for (let i = 0; i < 400 && !g.seats.some(Boolean); i++) tick(g, 0.1);
  return g.seats.find(Boolean)?.order || null;
}

function findSeed(levelId, owned, want) {
  for (let s = 1; s < 500; s++) {
    const o = firstOrder(s, levelId, owned);
    if (o && want(o)) return s;
  }
  throw new Error(`no seed found for level ${levelId}`);
}

// ------------------------------------------------------------------ page helpers
async function open(srv, query, opts = {}) {
  const b = await launchBrowser({ fonts: 'stub', ...opts });
  const errors = collectConsoleErrors(b.page);
  await b.page.goto(`${srv.url}/tools/game-harness.html?mute=1&log=0&${query}`);
  await b.page.waitForFunction(() => !!window.__acaiGame && !!document.querySelector('.screen-game'));
  return { ...b, errors };
}

const snap = (page) => page.evaluate(() => {
  const g = window.__acaiGame;
  return {
    status: g.status, money: g.money, served: g.served, lost: g.lost, hearts: g.hearts, time: g.time,
    tutorialHold: g.tutorialHold, closing: g.closing,
    seats: g.seats.map((c) => c && { id: c.id, state: c.state, order: c.order, delivered: { ...c.delivered } }),
    bowls: g.bowls.map((b) => ({ base: b.base, mid: [...b.mid], top: [...b.top], uid: b.uid })),
    blenders: g.blenders.map((b) => ({ state: b.state, base: b.base, portions: b.portions })),
    slots: g.smoothie ? g.smoothie.slots.map((s) => ({ state: s.state, fruit: s.fruit })) : null,
  };
});

const until = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout, polling: 50 });

// Fast-forward the simulation while waiting for something slow (blending, mixing, overflow).
async function fastUntil(page, fn, arg, speed = 5, timeout = 20000) {
  await page.evaluate((s) => { window.__acaiSpeed = s; }, speed);
  try {
    await until(page, fn, arg, timeout);
  } finally {
    await page.evaluate(() => { window.__acaiSpeed = 1; });
  }
}

async function drag(page, from, to, touch) {
  await dragBetween(page, from, to, { touch, steps: 10, stepDelay: 10, holdMs: 40 });
  await sleep(90);
}

const toastText = (page) => page.evaluate(() => document.querySelector('.g-fx .g-toast')?.textContent || '');
const tr = (page, key) => page.evaluate(async (k) => (await import('/js/i18n.js')).t(k), key);

async function expectReject(page, from, to, reason, touch = false) {
  const before = JSON.stringify(await snap(page).then((s) => [s.bowls, s.blenders, s.slots]));
  await page.evaluate(() => document.querySelector('.g-fx .g-toast')?.remove());
  await drag(page, from, to, touch);
  const want = await tr(page, `reason.${reason}`);
  await until(page, (w) => document.querySelector('.g-fx .g-toast')?.textContent === w, want, 3000)
    .catch(async () => { throw new Error(`expected toast "${want}", got "${await toastText(page)}"`); });
  const after = JSON.stringify(await snap(page).then((s) => [s.bowls, s.blenders, s.slots]));
  assert(before === after, `state changed on a rejected drop (${reason})`);
  const shaking = await page.evaluate(() => !!document.querySelector('.is-reject'));
  assert(shaking, 'rejected target does not shake');
}

const custSel = (id) => `[data-customer-id="${id}"]`;

async function waitCustomer(page, pred = 'true', timeout = 20000) {
  const handle = await until(page, (p) => {
    const g = window.__acaiGame;
    const ok = new Function('c', `return ${p};`);
    const c = g.seats.find((x) => x && x.state === 'waiting' && !x.delivered.bowl && ok(x));
    return c ? c.id : false;
  }, pred, timeout);
  return handle.jsonValue();
}

// Gets a ready blender with `base`, loading / cleaning blenders as needed. Returns its index.
async function readyBlender(page, base, touch) {
  for (let round = 0; round < 3; round++) {
    const s = await snap(page);
    const ready = s.blenders.findIndex((b) => (b.state === 'ready' || b.state === 'overflowing') && b.base === base);
    if (ready >= 0) return ready;
    const mixing = s.blenders.findIndex((b) => b.state === 'blending' && b.base === base);
    if (mixing >= 0) {
      await fastUntil(page, (i) => ['ready', 'overflowing'].includes(window.__acaiGame.blenders[i].state), mixing);
      continue;
    }
    let free = s.blenders.findIndex((b) => b.state === 'empty');
    if (free < 0) {
      free = s.blenders.findIndex((b) => b.state !== 'blending');
      await drag(page, `[data-blender="${free}"]`, '[data-trash]', touch);
      await until(page, (i) => window.__acaiGame.blenders[i].state === 'empty', free, 3000);
    }
    await drag(page, `[data-pack="${base}"]`, `[data-blender="${free}"]`, touch);
    await until(page, (i) => window.__acaiGame.blenders[i].state === 'blending', free, 3000);
  }
  throw new Error(`could not get a ready ${base} blender`);
}

// Builds the ordered bowl in an empty slot and drags it to the customer.
async function serveCustomer(page, id, { touch = false } = {}) {
  let s = await snap(page);
  const c = s.seats.find((x) => x && x.id === id);
  assert(c, `customer ${id} is gone`);
  const order = c.order;
  if (order.smoothie && !c.delivered.smoothie) await serveSmoothie(page, id, order.smoothie, touch);
  const bi = await readyBlender(page, order.bowl.base, touch);
  s = await snap(page);
  const bowl = s.bowls.findIndex((b) => !b.base);
  assert(bowl >= 0, 'no empty bowl slot');
  await drag(page, `[data-blender="${bi}"]`, `[data-bowl="${bowl}"]`, touch);
  await until(page, ([i, base]) => window.__acaiGame.bowls[i].base === base, [bowl, order.bowl.base], 3000);
  for (const ing of [...order.bowl.mid, ...order.bowl.top]) {
    await drag(page, `[data-bin="${ing}"]`, `[data-bowl="${bowl}"]`, touch);
    await until(page, ([i, x]) => {
      const b = window.__acaiGame.bowls[i];
      return b.mid.includes(x) || b.top.includes(x);
    }, [bowl, ing], 3000);
  }
  const served = s.served;
  await drag(page, `[data-bowl="${bowl}"]`, custSel(id), touch);
  await until(page, (n) => window.__acaiGame.served > n, served, 4000);
}

async function serveSmoothie(page, id, fruit, touch) {
  await drag(page, `[data-bin="${fruit}"]`, '[data-smoothie-slot="0"]', touch);
  await until(page, () => window.__acaiGame.smoothie.slots[0].state === 'mixing', null, 3000);
  await fastUntil(page, () => window.__acaiGame.smoothie.slots[0].state === 'ready', null, 4);
  await drag(page, '[data-smoothie-slot="0"]', custSel(id), touch);
  await until(page, (cid) => {
    const c = window.__acaiGame.seats.find((x) => x && x.id === cid);
    return !c || c.delivered.smoothie;
  }, id, 3000);
}

async function tutorialStep(page, key, timeout = 10000) {
  await until(page, (k) => document.querySelector('[data-tutorial-step]')?.dataset.tutorialStep === k, key, timeout)
    .catch(async () => {
      const now = await page.evaluate(() => document.querySelector('[data-tutorial-step]')?.dataset.tutorialStep);
      throw new Error(`tutorial step "${key}" expected, is "${now}"`);
    });
}

// ------------------------------------------------------------------ scenarios
async function tutorialAndServing(srv) {
  const tag = '[mouse 1280×800]';
  const L1 = findSeed(1, ['acai', 'banana', 'granola', 'honey'], (o) => o.bowl.top.length > 0);
  const { page, errors, close } = await open(srv, `level=1&fresh=1&seed=${L1}`);
  let order;
  try {
    await check(`${tag} tutorial starts and points at the pack`, async () => {
      await tutorialStep(page, 'pack');
      const s = await snap(page);
      assert(s.tutorialHold, 'tutorial hold is off');
      order = s.seats.find(Boolean).order;
      assert(await page.locator('.g-tut-arrow').count() === 1, 'no tutorial arrow');
      await page.screenshot({ path: path.join(OUT, 'tutorial-pack.png') });
    });

    await check(`${tag} reject: ingredient on an empty bowl (needBase)`, async () => {
      await expectReject(page, '[data-bin="banana"]', '[data-bowl="1"]', 'needBase');
    });

    await check(`${tag} tutorial: pack → blender → wait → pour`, async () => {
      await drag(page, '[data-pack="acai"]', '[data-blender="0"]');
      await until(page, () => window.__acaiGame.blenders[0].state === 'blending', null, 3000);
      await tutorialStep(page, 'wait');
      await fastUntil(page, () => window.__acaiGame.blenders[0].state === 'ready');
      await tutorialStep(page, 'pour');
      await drag(page, '[data-blender="0"]', '[data-bowl="0"]');
      await until(page, () => window.__acaiGame.bowls[0].base === 'acai', null, 3000);
      await tutorialStep(page, 'add');
      await page.screenshot({ path: path.join(OUT, 'tutorial-add.png') });
    });

    await check(`${tag} tutorial recovers from a wrong ingredient (trash → pour again)`, async () => {
      const wrong = ['banana', 'granola'].find((id) => !order.bowl.mid.includes(id));
      await drag(page, `[data-bin="${wrong}"]`, '[data-bowl="0"]');
      await tutorialStep(page, 'trash');
      await drag(page, '[data-bowl="0"]', '[data-trash]');
      await until(page, () => !window.__acaiGame.bowls[0].base, null, 3000);
      await tutorialStep(page, 'pour');
      await drag(page, '[data-blender="0"]', '[data-bowl="0"]');
      await tutorialStep(page, 'add');
    });

    await check(`${tag} tutorial: ingredients in layer order, serve, finish`, async () => {
      for (const ing of [...order.bowl.mid, ...order.bowl.top]) {
        await drag(page, `[data-bin="${ing}"]`, '[data-bowl="0"]');
        await until(page, (x) => {
          const b = window.__acaiGame.bowls[0];
          return b.mid.includes(x) || b.top.includes(x);
        }, ing, 3000);
      }
      await tutorialStep(page, 'serve');
      const id = (await snap(page)).seats.find(Boolean).id;
      await drag(page, '[data-bowl="0"]', custSel(id));
      await until(page, () => window.__acaiGame.served === 1, null, 3000);
      await tutorialStep(page, 'done');
      await page.screenshot({ path: path.join(OUT, 'tutorial-done.png') });
      await page.click('[data-tut-go]');
      await until(page, () => !window.__acaiGame.tutorialHold && !document.querySelector('[data-tutorial-step]'), null, 3000);
      const seen = await page.evaluate(() => window.__harness.getSave().seenIntros.basics === true);
      assert(seen, 'tutorial not marked as seen');
    });

    await check(`${tag} serves three more customers by reading their orders`, async () => {
      for (let i = 0; i < 3; i++) {
        const id = await waitCustomer(page);
        await serveCustomer(page, id);
      }
      const s = await snap(page);
      assert(s.served >= 4, `served ${s.served}`);
      assert(s.money > 0, 'no money earned');
      await until(page, () => {
        const m = document.querySelector('[data-hud-money]');
        return Number(m.dataset.value) === window.__acaiGame.money
          && m.querySelector('.g-money-num').textContent === String(window.__acaiGame.money);
      }, null, 4000);
      const goals = await page.evaluate(() => window.__acaiGame.config.goals.filter((g) => window.__acaiGame.money >= g).length);
      assert(await page.locator('.g-goalmark.is-lit').count() === goals, 'goal stars do not match the money');
    });

    await check(`${tag} pause overlay: button, toggles, Escape`, async () => {
      await page.click('[data-pause]');
      await until(page, () => window.__acaiGame.status === 'paused' && !document.querySelector('[data-pause-overlay]').hidden, null, 2000);
      const t0 = (await snap(page)).time;
      await page.click('[data-toggle="music"]');
      assert(await page.evaluate(() => window.__harness.getSave().settings.music === false), 'music toggle not saved');
      await page.screenshot({ path: path.join(OUT, 'pause.png') });
      await page.click('[data-toggle="music"]');
      await sleep(300);
      assert((await snap(page)).time === t0, 'time runs while paused');
      await page.keyboard.press('Escape');
      await until(page, () => window.__acaiGame.status === 'playing' && document.querySelector('[data-pause-overlay]').hidden, null, 2000);
    });

    await check(`${tag} level end: stamp, then results via ctx.go`, async () => {
      await page.evaluate(() => { window.__acaiSpeed = 40; });
      await until(page, () => !document.querySelector('[data-stamp]').hidden, null, 20000);
      await sleep(650);
      await page.screenshot({ path: path.join(OUT, 'stamp.png') });
      await until(page, () => window.__harness.calls.some((c) => c.name === 'results'), null, 5000);
      const res = await page.evaluate(() => window.__harness.calls.find((c) => c.name === 'results').params);
      for (const k of ['mode', 'levelId', 'result', 'reason', 'stars', 'money', 'served', 'lost', 'newBest', 'unlockedEndless', 'unlockedLevel', 'coinsTotal']) {
        assert(k in res, `result object lacks ${k}`);
      }
      assert(res.mode === 'campaign' && res.levelId === 1 && res.served >= 4, `bad result ${JSON.stringify(res)}`);
      const coins = await page.evaluate(() => window.__harness.getSave().coins);
      assert(coins === res.coinsTotal && coins >= res.money, 'coins not banked');
    });

    await check(`${tag} no console errors`, async () => assertNoConsoleErrors(errors, 'level 1'));
  } finally {
    await close();
  }
}

async function layerRejects(srv) {
  const tag = '[mouse 1280×800]';
  const { page, errors, close } = await open(srv, 'level=2&fresh=1&tutorial=0&seed=4');
  try {
    await check(`${tag} layer rejects: bowlHasBase, toppingsOnTop, alreadyAdded, wrongOrder, needBase`, async () => {
      const bi = await readyBlender(page, 'acai', false);
      await drag(page, `[data-blender="${bi}"]`, '[data-bowl="0"]');
      await until(page, () => window.__acaiGame.bowls[0].base === 'acai', null, 3000);
      await expectReject(page, `[data-blender="${bi}"]`, '[data-bowl="0"]', 'bowlHasBase');
      await drag(page, '[data-bin="honey"]', '[data-bowl="0"]');
      await until(page, () => window.__acaiGame.bowls[0].top.includes('honey'), null, 3000);
      await expectReject(page, '[data-bin="banana"]', '[data-bowl="0"]', 'toppingsOnTop');
      await expectReject(page, '[data-bin="honey"]', '[data-bowl="0"]', 'alreadyAdded');
      await page.screenshot({ path: path.join(OUT, 'reject-toast.png') });
      const id = await waitCustomer(page);
      await expectReject(page, '[data-bowl="0"]', custSel(id), 'wrongOrder');
      await drag(page, '[data-bowl="0"]', '[data-trash]');
      await until(page, () => !window.__acaiGame.bowls[0].base, null, 3000);
      await expectReject(page, '[data-bin="granola"]', '[data-bowl="0"]', 'needBase');
    });
    await check(`${tag} drop on nothing returns silently`, async () => {
      const before = JSON.stringify((await snap(page)).bowls);
      await drag(page, '[data-bin="banana"]', { x: 640, y: 250 });
      assert(JSON.stringify((await snap(page)).bowls) === before, 'drop on nothing changed the bowls');
    });
    await check(`${tag} no console errors`, async () => assertNoConsoleErrors(errors, 'level 2'));
  } finally {
    await close();
  }
}

async function overflowAndClean(srv) {
  const tag = '[mouse 1280×800]';
  const { page, errors, close } = await open(srv, 'level=3&fresh=1&tutorial=0&seed=3');
  try {
    await check(`${tag} level 3: blender overflows, spoils, is rejected and cleaned`, async () => {
      await drag(page, '[data-pack="acai"]', '[data-blender="0"]');
      await until(page, () => window.__acaiGame.blenders[0].state === 'blending', null, 3000);
      await fastUntil(page, () => document.querySelector('[data-blender="0"]').dataset.state === 'overflowing', null, 6);
      await page.screenshot({ path: path.join(OUT, 'overflowing.png') });
      await fastUntil(page, () => document.querySelector('[data-blender="0"]').dataset.state === 'ruined', null, 6);
      await expectReject(page, '[data-blender="0"]', '[data-bowl="0"]', 'blenderRuined');
      await drag(page, '[data-blender="0"]', '[data-trash]');
      await until(page, () => window.__acaiGame.blenders[0].state === 'empty', null, 3000);
    });
    await check(`${tag} no console errors`, async () => assertNoConsoleErrors(errors, 'level 3'));
  } finally {
    await close();
  }
}

async function smoothieTouch(srv) {
  const tag = '[touch 1024×768]';
  const seed = findSeed(7, ALL, (o) => !!o.smoothie);
  const { page, errors, close } = await open(srv, `level=7&fresh=1&owned=all&tutorial=0&seed=${seed}`, {
    touch: true, viewport: { width: 1024, height: 768 },
  });
  try {
    await check(`${tag} level 7: smoothie made and served, then the bowl → customer pays`, async () => {
      const id = await waitCustomer(page, 'c.order.smoothie !== null');
      const before = await snap(page);
      const fruit = before.seats.find((c) => c && c.id === id).order.smoothie;
      await serveSmoothie(page, id, fruit, true);
      const cupDone = await page.evaluate((cid) => !!document.querySelector(`[data-customer-id="${cid}"] [data-part="smoothie"].is-done`), id);
      assert(cupDone, 'smoothie part not ticked in the bubble');
      await serveCustomer(page, id, { touch: true });
      const s = await snap(page);
      assert(s.served === before.served + 1 && s.money > before.money, 'customer did not pay');
    });
    await check(`${tag} bowlFull reject with all ingredients owned`, async () => {
      const bi = await readyBlender(page, 'acai', true);
      const s = await snap(page);
      const bowl = s.bowls.findIndex((b) => !b.base);
      await drag(page, `[data-blender="${bi}"]`, `[data-bowl="${bowl}"]`, true);
      await until(page, (i) => !!window.__acaiGame.bowls[i].base, bowl, 3000);
      for (const id of ['banana', 'granola', 'strawberry', 'blueberry', 'mango', 'kiwi']) {
        await drag(page, `[data-bin="${id}"]`, `[data-bowl="${bowl}"]`, true);
      }
      await until(page, (i) => window.__acaiGame.bowls[i].mid.length === 6, bowl, 3000);
      await page.screenshot({ path: path.join(OUT, 'touch-full-bowl.png') });
      await expectReject(page, '[data-bin="honey"]', `[data-bowl="${bowl}"]`, 'bowlFull', true);
      await drag(page, `[data-bowl="${bowl}"]`, '[data-trash]', true);
      await until(page, (i) => !window.__acaiGame.bowls[i].base, bowl, 3000);
    });
    await check(`${tag} no console errors`, async () => assertNoConsoleErrors(errors, 'level 7'));
  } finally {
    await close();
  }
}

async function endlessSmoke(srv) {
  const tag = '[mouse 1280×800]';
  const { page, errors, close } = await open(srv, 'mode=endless&fresh=1&best=120&seed=9');
  try {
    await check(`${tag} endless: stage label, game over → results with best`, async () => {
      const label = await page.textContent('.g-level');
      assert(/Endlos|Endless/.test(label), `level label "${label}"`);
      await page.evaluate(() => { window.__acaiSpeed = 60; });
      await until(page, () => window.__harness.calls.some((c) => c.name === 'results'), null, 30000);
      const res = await page.evaluate(() => window.__harness.calls.find((c) => c.name === 'results').params);
      assert(res.mode === 'endless' && res.result === 'lost' && res.reason === 'hearts', JSON.stringify(res));
      assert(typeof res.best === 'number', 'endless result lacks best');
    });
    await check(`${tag} no console errors`, async () => assertNoConsoleErrors(errors, 'endless'));
  } finally {
    await close();
  }
}

// ------------------------------------------------------------------ main
const srv = await serve();
const t0 = Date.now();
try {
  await tutorialAndServing(srv);
  await layerRejects(srv);
  await overflowAndClean(srv);
  await smoothieTouch(srv);
  await endlessSmoke(srv);
} finally {
  await srv.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed in ${((Date.now() - t0) / 1000).toFixed(1)} s · screenshots: ${OUT}`);
process.exit(failed.length ? 1 : 0);
