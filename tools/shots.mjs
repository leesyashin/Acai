#!/usr/bin/env node
// Visual review helper: screenshots of every screen and key game moments at several sizes.
//   node tools/shots.mjs <outDir> [--port 8090] [--only name,name] [--sizes 1280x800,1024x768]
// Serves the repo itself (tools/serve.mjs). Uses the real Google Fonts through HTTPS_PROXY when set.
// Not part of the test suite – the PNGs are for humans to look at.

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { startServer } from './serve.mjs';
import { launchBrowser, collectConsoleErrors } from '../tests/e2e/helpers.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const OUT = path.resolve(args[0] && !args[0].startsWith('--') ? args[0] : 'screenshots');
const PORT = Number(opt('port', 8090));
const ONLY = opt('only', '') ? opt('only', '').split(',') : null;
const SIZES = opt('sizes', '1280x800,1024x768,1366x1024').split(',').map((s) => {
  const [width, height] = s.split('x').map(Number);
  return { width, height, tag: s };
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

const KEY = 'acaiFever.save.v1';
const ALL_ING = ['acai', 'pitaya', 'spirulina', 'banana', 'granola', 'strawberry', 'blueberry', 'mango', 'kiwi',
  'honey', 'coconut', 'chia', 'peanut', 'chocolate', 'mint', 'cacao'];

function save(kind, lang) {
  const base = {
    version: 1, coins: 0, owned: ['acai', 'banana', 'granola', 'honey'], ingLevels: {}, upgrades: {}, stars: {},
    endlessBest: 0, newIngredients: [], seenIntros: {}, settings: { lang, music: false, sfx: false },
    stats: { served: 0, earned: 0, played: 0 },
  };
  if (kind === 'fresh') return base;
  if (kind === 'mid') {
    const stars = { 1: 3, 2: 3, 3: 2, 4: 3, 5: 1, 6: 2 };
    return {
      ...base, coins: 412, owned: [...base.owned, 'strawberry', 'blueberry', 'pitaya', 'coconut', 'mango'],
      ingLevels: { acai: 1, banana: 2 }, upgrades: { blenderSpeed: 1, bowlSlots: 1, plants: 1 }, stars,
      seenIntros: { basics: true }, stats: { served: 140, earned: 1650, played: 9 },
    };
  }
  // late game: everything owned, many upgrades
  const stars = {};
  for (let i = 1; i <= 14; i++) stars[i] = (i % 4) ? 3 : 2;
  return {
    ...base, coins: 2380, owned: ALL_ING.slice(), ingLevels: { acai: 2, pitaya: 1, banana: 1, strawberry: 2, mango: 1 },
    upgrades: { blenderSpeed: 2, jug: 1, blender2: 1, bowlSlots: 2, smoothieSlots: 1, plants: 1, jukebox: 1, seating: 1, neon: 1 },
    stars, endlessBest: 512, newIngredients: ['cacao'], seenIntros: { basics: true }, stats: { served: 640, earned: 6400, played: 20 },
  };
}

async function main() {
  const srv = await startServer({ port: PORT });
  const url = srv.url.replace(/\/$/, '');
  const shots = [];
  const allErrors = [];
  try {
    for (const size of SIZES) {
      for (const lang of ['de', 'en']) {
        if (lang === 'en' && size.tag !== '1280x800') continue; // English once, at the main size
        const b = await launchBrowser({ viewport: { width: size.width, height: size.height }, fonts: 'real', locale: lang === 'de' ? 'de-DE' : 'en-US' });
        const { page } = b;
        const errors = collectConsoleErrors(page);
        const shot = async (name) => {
          if (ONLY && !ONLY.some((o) => name.includes(o))) return;
          await sleep(60);
          const file = path.join(OUT, `${size.tag}-${lang}-${name}.png`);
          await page.screenshot({ path: file });
          shots.push(file);
        };
        const want = (name) => !ONLY || ONLY.some((o) => name.includes(o));
        const load = async (kind) => {
          await page.goto(`${url}/index.html`);
          await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [KEY, save(kind, lang)]);
          await page.reload();
          await page.waitForFunction(() => window.__acaiScreen?.() === 'title');
          await page.evaluate(() => document.fonts.ready);
        };
        const go = async (name, params) => {
          await page.evaluate(([n, p]) => window.__acaiGo(n, p), [name, params]);
          await sleep(700);
        };

        await load('fresh');
        await sleep(900);
        await shot('01-title-fresh');
        await go('map', {});
        await shot('02-map-fresh');
        if (want('03-prelevel-1')) {
          await page.locator('.map-level[data-level="1"]').click();
          await sleep(600);
          await shot('03-prelevel-1');
        }

        // tutorial
        if (want('10-game-tutorial')) {
          await go('game', { mode: 'campaign', levelId: 1, seed: 3 });
          await page.evaluate(() => { window.__acaiSpeed = 4; });
          await page.waitForFunction(() => window.__acaiGame.seats.some((c) => c && c.state === 'waiting'), null, { timeout: 15000 });
          await page.evaluate(() => { window.__acaiSpeed = 1; });
          await sleep(500);
          await shot('10-game-tutorial');
          await page.evaluate(async () => {
            const e = await import('/js/engine.js');
            e.loadBlender(window.__acaiGame, 0, 'acai');
            window.__acaiSpeed = 4;
          });
          await page.waitForFunction(() => window.__acaiGame.blenders[0].state === 'ready', null, { timeout: 15000 });
          await page.evaluate(async () => {
            window.__acaiSpeed = 1;
            const e = await import('/js/engine.js');
            e.placeCup(window.__acaiGame, 1);
            e.pourBlender(window.__acaiGame, 0, 1);
          });
          await sleep(500);
          await shot('10-game-tutorial-add');
          await page.evaluate(async () => {
            const e = await import('/js/engine.js');
            const g = window.__acaiGame;
            const c = g.seats.find(Boolean);
            for (const id of [...c.order.bowl.mid, ...c.order.bowl.top]) e.addIngredient(g, 1, id);
          });
          await sleep(500);
          await shot('10-game-tutorial-serve');
          await page.evaluate(async () => {
            const e = await import('/js/engine.js');
            const g = window.__acaiGame;
            e.serveBowl(g, 1, g.seats.find(Boolean).id);
          });
          await sleep(450);
          await shot('10-game-tutorial-paid');
        }

        await load('mid');
        await sleep(600);
        await shot('04-title-mid');
        await go('map', {});
        await shot('05-map-mid');
        if (want('06-prelevel-7')) {
          await go('map', { openLevel: 7 });
          await shot('06-prelevel-7');
        }
        await go('shop', { back: 'map' });
        await shot('07-shop-ingredients');
        await go('shop', { back: 'map', tab: 'kitchen' });
        await shot('07-shop-kitchen');
        await go('shop', { back: 'map', tab: 'decor' });
        await shot('07-shop-decor');
        await go('settings', { back: 'map' });
        await shot('08-settings');

        // level 5 mid game (3 seats)
        if (want('11-game-l5')) {
          await go('game', { mode: 'campaign', levelId: 5, seed: 11 });
          await page.evaluate(() => { window.__acaiSpeed = 6; });
          await page.waitForFunction(() => window.__acaiGame.seats.filter(Boolean).length >= 3, null, { timeout: 20000 });
          await page.evaluate(() => { window.__acaiSpeed = 1; });
          await sleep(400);
          await shot('11-game-l5');
        }

        // late game busy scene
        await load('late');
        await shot('09-title-late');
        await go('map', {});
        await shot('09-map-late');
        if (want('12-game-busy') || want('13-game-drag') || want('14-pause') || want('15-stamp')) {
          await go('game', { mode: 'campaign', levelId: 14, seed: 5 });
          await page.evaluate(() => { window.__acaiSpeed = 6; });
          await page.waitForFunction(() => window.__acaiGame.seats.filter((c) => c && c.state === 'waiting').length >= 4, null, { timeout: 30000 });
          await page.evaluate(async () => {
            window.__acaiSpeed = 1;
            const e = await import('/js/engine.js');
            const g = window.__acaiGame;
            e.loadBlender(g, 0, 'acai');
            e.loadBlender(g, 1, 'pitaya');
            const c = g.seats.filter(Boolean);
            c[1].patience = c[1].maxPatience * 0.45;
            c[2].patience = c[2].maxPatience * 0.22;
            c[3].patience = c[3].maxPatience * 0.08;
          });
          await page.evaluate(() => { window.__acaiSpeed = 3; });
          await page.waitForFunction(() => window.__acaiGame.blenders.every((b) => b.state === 'ready'), null, { timeout: 15000 });
          await page.evaluate(async () => {
            window.__acaiSpeed = 1;
            const e = await import('/js/engine.js');
            const g = window.__acaiGame;
            for (let i = 0; i < g.bowls.length; i++) e.placeCup(g, i);
            e.pourBlender(g, 0, 0);
            e.addIngredient(g, 0, 'banana');
            e.addIngredient(g, 0, 'strawberry');
            e.addIngredient(g, 0, 'honey');
            e.pourBlender(g, 1, 1);
            e.addIngredient(g, 1, 'mango');
            e.addIngredient(g, 1, 'kiwi');
            e.addIngredient(g, 1, 'coconut');
            e.addIngredient(g, 1, 'chia');
            e.pourBlender(g, 0, 2);
            e.addIngredient(g, 2, 'blueberry');
            if (g.smoothie) {
              e.loadSmoothie(g, 0, 'strawberry');
              e.loadSmoothie(g, 1, 'mango');
            }
          });
          await sleep(1200);
          await shot('12-game-busy');
          // drag in progress: banana bin → bowl 3
          if (want('13-game-drag')) {
            const from = await page.locator('[data-bin="banana"]').boundingBox();
            const to = await page.locator('[data-bowl="2"]').boundingBox();
            await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
            await page.mouse.down();
            for (let i = 1; i <= 8; i++) {
              await page.mouse.move(from.x + from.width / 2 + ((to.x + to.width / 2 - from.x - from.width / 2) * i) / 8,
                from.y + from.height / 2 + ((to.y + to.height / 2 - from.y - from.height / 2) * i) / 8);
              await sleep(16);
            }
            await sleep(200);
            await shot('13-game-drag');
            await page.mouse.up();
            await sleep(400);
          }
          // overflowing + ruined blender, reject toast
          await page.evaluate(async () => {
            const e = await import('/js/engine.js');
            const g = window.__acaiGame;
            for (let i = 0; i < 2; i++) {
              if (g.blenders[i].state !== 'empty') e.cleanBlender(g, i);
            }
            e.loadBlender(g, 0, 'spirulina');
            e.loadBlender(g, 1, 'acai');
            window.__acaiSpeed = 8;
          });
          await page.waitForFunction(() => window.__acaiGame.blenders[1].state === 'overflowing', null, { timeout: 30000 });
          await page.evaluate(() => { window.__acaiSpeed = 1; });
          await page.locator('[data-bin="mint"]').hover();
          await page.mouse.down();
          await page.mouse.move(640, 300, { steps: 6 });
          const cust = await page.locator('[data-customer-id] .g-figure').first().boundingBox();
          await page.mouse.move(cust.x + cust.width / 2, cust.y + cust.height / 2, { steps: 6 });
          await page.mouse.up();
          await sleep(250);
          await shot('14-game-overflow-reject');
          if (want('14-pause')) {
            await page.locator('[data-pause]').click();
            await sleep(400);
            await shot('14-pause');
            await page.locator('[data-action="resume"]').click();
          }
          if (want('15-stamp')) {
            await page.evaluate(() => {
              const g = window.__acaiGame;
              g.money = Math.max(g.money, g.config.goals[1] + 3);
              g.time = g.duration - 0.2;
              for (const c of g.seats) {
                if (!c || c.state !== 'waiting') continue;
                c.state = 'leavingHappy';
                c.t = 0;
                c.mood = 'happy';
              }
              window.__acaiSpeed = 1;
            });
            await page.waitForSelector('[data-stamp]:not([hidden])', { timeout: 20000 });
            await sleep(900);
            await shot('15-stamp');
            await page.waitForFunction(() => window.__acaiScreen() === 'results', null, { timeout: 10000 });
          }
        }

        if (want('20-results')) {
          const r = { mode: 'campaign', levelId: 6, result: 'won', reason: null, stars: 3, money: 241, served: 14, lost: 0, newBest: true, unlockedEndless: false, unlockedLevel: 7, coinsTotal: 1653 };
          await go('results', r);
          await sleep(2600);
          await shot('20-results-won3');
          await go('results', { ...r, stars: 1, money: 150, newBest: false, unlockedLevel: null });
          await sleep(2200);
          await shot('20-results-won1');
          await go('results', { ...r, result: 'lost', reason: 'hearts', stars: 0, money: 88, lost: 3, newBest: false, unlockedLevel: null });
          await sleep(1800);
          await shot('20-results-lost');
          await go('results', { mode: 'endless', levelId: null, result: 'lost', reason: 'hearts', stars: 0, money: 512, served: 31, lost: 3, newBest: true, unlockedEndless: false, unlockedLevel: null, coinsTotal: 2900, best: 512, stage: 4 });
          await sleep(2200);
          await shot('20-results-endless');
        }
        if (want('16-endless')) {
          await go('game', { mode: 'endless', seed: 9 });
          await page.evaluate(() => { window.__acaiSpeed = 6; });
          await page.waitForFunction(() => window.__acaiGame.seats.filter(Boolean).length >= 2, null, { timeout: 20000 });
          await page.evaluate(() => { window.__acaiSpeed = 1; });
          await sleep(600);
          await shot('16-endless');
          await go('title', {});
        }
        if (errors.length) allErrors.push(`${size.tag}-${lang}: ${errors.join('\n')}`);
        await b.close();
      }
    }

    // phone portrait: rotate hint
    {
      const b = await launchBrowser({ viewport: { width: 390, height: 844 }, fonts: 'real', isMobile: true, touch: true, deviceScaleFactor: 2 });
      const errors = collectConsoleErrors(b.page);
      await b.page.goto(`${url}/index.html`);
      await b.page.evaluate(() => document.fonts.ready);
      await sleep(500);
      let file = path.join(OUT, '390x844-de-30-rotate-hint.png');
      await b.page.screenshot({ path: file });
      shots.push(file);
      await b.page.locator('[data-action="dismiss-rotate"]').tap();
      await sleep(500);
      file = path.join(OUT, '390x844-de-31-after-dismiss.png');
      await b.page.screenshot({ path: file });
      shots.push(file);
      // phone landscape
      await b.page.setViewportSize({ width: 844, height: 390 });
      await sleep(500);
      file = path.join(OUT, '844x390-de-32-phone-landscape.png');
      await b.page.screenshot({ path: file });
      shots.push(file);
      if (errors.length) allErrors.push(`phone: ${errors.join('\n')}`);
      await b.close();
    }
  } finally {
    await srv.close();
  }
  console.log(`${shots.length} screenshots in ${OUT}`);
  if (allErrors.length) {
    console.log(`console errors:\n${allErrors.join('\n')}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
