// E2E test for the app shell (js/main.js) and the menu screens (js/screens.js).
// Run: node tests/e2e/screens.e2e.mjs
//   Serves the repo on :8092 (reuses a server already listening there), drives index.html
//   title → map → pre-level → shop purchases → settings (language, audio, reset) → results,
//   then a touch tablet pass (rotate hint in portrait, double tap in the shop, pause on rotate),
//   then the results variants through tools/screens-harness.html. Exits non-zero on failure.
//   If js/game-view.js does not exist yet, its URL is answered with a stub module so the shell
//   can still be tested through index.html.
// Env: E2E_FONTS=real|stub (default: real when HTTPS_PROXY is set), E2E_STUB_GAME=1 (always stub
//      the game view), SCREENS_E2E_PORT or E2E_PORT (default 8090), E2E_OUT_DIR for failure screenshots.

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer, collectConsoleErrors, e2eOutDir, STAGE_W } from './helpers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = Number(process.env.SCREENS_E2E_PORT || process.env.E2E_PORT) || 8090;
const FONTS = process.env.E2E_FONTS || (process.env.HTTPS_PROXY ? 'real' : 'stub');
const HAS_GAME_VIEW = existsSync(path.join(ROOT, 'js/game-view.js')) && process.env.E2E_STUB_GAME !== '1';
const STUB_GAME_VIEW = `export const gameScreen = {
  render(container, params) {
    container.innerHTML = '<div data-stub-game>' + JSON.stringify(params) + '</div>';
    return () => {};
  },
};`;

const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Mirrors BUY_COOLDOWN_MS in js/screens.js: a shop card ignores clicks this long after a purchase.
const BUY_COOLDOWN_MS = 500;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function eq(actual, expected, what) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

let shotPage = null;
// cleanup runs after a failed check so one failure does not cascade into the next one.
async function check(name, fn, cleanup) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ok    ${name}`);
  } catch (err) {
    results.push({ name, ok: false, err });
    console.log(`  FAIL  ${name}\n        ${err.message.split('\n').join('\n        ')}`);
    if (shotPage) {
      const file = path.join(e2eOutDir('screens'), `${name.replace(/[^a-z0-9]+/gi, '_')}.png`);
      await shotPage.screenshot({ path: file }).catch(() => {});
      console.log(`        screenshot: ${file}`);
    }
    try {
      await cleanup?.();
    } catch {
      /* best effort */
    }
  }
}

// Waits until finite CSS animations (pop-ins, count-ups) are done so measurements are stable.
async function settle(page) {
  await page.evaluate(() => Promise.all(document.getAnimations()
    .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
    .map((a) => a.finished.catch(() => {}))));
}

// ------------------------------------------------------------------ server + browser
async function serve() {
  try {
    return await startServer({ port: PORT });
  } catch (err) {
    if (err.code !== 'EADDRINUSE') throw err;
    const url = `http://127.0.0.1:${PORT}/`;
    const res = await fetch(`${url}index.html`).catch(() => null);
    if (!res?.ok) throw err;
    console.log(`(reusing server already listening on :${PORT})`);
    return { url, close: async () => {} };
  }
}

async function launch() {
  const server = process.env.HTTPS_PROXY || process.env.https_proxy;
  // '<-loopback>' is needed: Chromium otherwise sends 127.0.0.1 through the proxy as well.
  const proxy = FONTS === 'real' && server ? { server, bypass: '<-loopback>,localhost,127.0.0.1,::1' } : undefined;
  return chromium.launch({ proxy });
}

async function newPage(browser, { viewport = { width: 1280, height: 800 }, locale = 'de-DE', touch = false } = {}) {
  const context = await browser.newContext({ viewport, locale, hasTouch: touch, ignoreHTTPSErrors: true });
  if (FONTS === 'stub') {
    await context.route(/fonts\.googleapis\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await context.route(/fonts\.gstatic\.com/, (r) => r.abort());
  }
  if (!HAS_GAME_VIEW) {
    await context.route(/\/js\/game-view\.js(\?.*)?$/, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: STUB_GAME_VIEW }));
  }
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const errors = collectConsoleErrors(page);
  return { context, page, errors };
}

// ------------------------------------------------------------------ page helpers
const screenName = (page) => page.evaluate(() => document.querySelector('#stage > .screen')?.dataset.screen ?? null);

async function waitScreen(page, name) {
  await page.waitForSelector(`#stage > .screen-${name}`, { timeout: 5000 });
}

async function saveState(page) {
  return page.evaluate(async () => {
    const m = await import('/js/save.js');
    return JSON.parse(JSON.stringify(m.getSave()));
  });
}

async function setCoins(page, coins) {
  await page.evaluate(async (n) => {
    const m = await import('/js/save.js');
    m.updateSave((d) => { d.coins = n; });
  }, coins);
}

// Locked / unaffordable controls carry aria-disabled but stay clickable (they explain themselves).
const clickDisabled = (page, selector) => page.click(selector, { force: true });

async function text(page, selector) {
  return (await page.locator(selector).first().innerText()).replace(/\s+/g, ' ').trim();
}

async function toastText(page) {
  await page.waitForSelector('.sc-toast', { timeout: 2000 });
  return text(page, '.sc-toast');
}

// Every visible button inside the stage must be at least 64×64 stage px.
async function assertTouchTargets(page, label) {
  await settle(page);
  const small = await page.evaluate((W) => {
    const stage = document.getElementById('stage');
    const s = stage.getBoundingClientRect().width / W;
    const out = [];
    for (const el of stage.querySelectorAll('button, [role="button"], [role="tab"], [role="switch"]')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
      const w = r.width / s;
      const h = r.height / s;
      if (w < 63.5 || h < 63.5) out.push(`${el.dataset.action || el.dataset.level || el.dataset.tab || el.className}: ${w.toFixed(0)}×${h.toFixed(0)}`);
    }
    return out;
  }, STAGE_W);
  assert(!small.length, `${label}: touch targets below 64 stage px:\n${small.join('\n')}`);
}

// No text may be clipped / overflow its box (strict only when the real fonts are loaded).
async function assertNoOverflow(page, label) {
  await settle(page);
  const { over, fontsReal } = await page.evaluate(async () => {
    await document.fonts.ready;
    const fontsReal = document.fonts.check('40px "Lilita One"') && [...document.fonts].some((f) => f.family.includes('Lilita') && f.status === 'loaded');
    const over = [];
    // Counter badges deliberately stick out of their button – hide them while measuring.
    const badges = [...document.querySelectorAll('#stage .sc-badge')];
    badges.forEach((b) => { b.style.display = 'none'; });
    const sel = 'button, h1, h2, h3, h4, p, .sc-chip, .card-value, .shop-row-name, .upg-stat-value, dt, dd, small, .sc-toast';
    for (const el of document.querySelectorAll(`#stage :is(${sel})`)) {
      if (el.closest('.map-level')) continue; // badges deliberately stick out of the node
      if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 4) {
        over.push(`"${el.textContent.trim().slice(0, 40)}" ${el.scrollWidth}×${el.scrollHeight} > ${el.clientWidth}×${el.clientHeight}`);
      }
    }
    badges.forEach((b) => { b.style.display = ''; });
    return { over, fontsReal };
  });
  if (over.length && !fontsReal) {
    console.log(`        (info, fallback fonts) ${label}: ${over.length} overflow(s) ignored`);
    return;
  }
  assert(!over.length, `${label}: text overflow:\n${over.join('\n')}`);
}

async function assertFocusVisible(page) {
  const outline = await page.evaluate(() => {
    const el = document.activeElement;
    const target = el.classList.contains('map-level') ? el.querySelector('.map-disc') : el;
    const cs = getComputedStyle(target);
    return { tag: el.tagName, style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) };
  });
  assert(outline.tag === 'BUTTON', `focused element is ${outline.tag}, expected a button`);
  assert(outline.style !== 'none' && outline.width >= 3, `focused button has no visible focus ring (${outline.style} ${outline.width}px)`);
}

// ------------------------------------------------------------------ main flow (index.html)
async function mainFlow(browser, base) {
  const { context, page, errors } = await newPage(browser);
  shotPage = page;
  console.log(`index.html (game view: ${HAS_GAME_VIEW ? 'real' : 'stub'}, fonts: ${FONTS})`);
  await page.goto(`${base}index.html`);

  await check('boot: title screen in German with menu music requested', async () => {
    await waitScreen(page, 'title');
    eq(await text(page, '[data-action="play"]'), 'Spielen', 'play button');
    eq(await page.evaluate(() => document.documentElement.lang), 'de', 'html lang');
    eq(await page.evaluate(() => window.__acaiAudio?.state?.().requestedTrack ?? 'menu'), 'menu', 'requested music');
    assert(await page.locator('[data-action="endless"][aria-disabled="true"]').count() === 1, 'endless should be locked');
    eq(await text(page, '.title-endless small'), 'Gewinne Level 10', 'endless lock note');
    await assertTouchTargets(page, 'title');
    await assertNoOverflow(page, 'title');
  });

  await check('title: first gesture unlocks audio', async () => {
    await page.mouse.click(5, 5);
    const st = await page.evaluate(() => window.__acaiAudio?.state?.() ?? null);
    if (st) assert(st.unlocked, 'audio not unlocked after pointerdown');
  });

  await check('title: locked endless shakes and explains', async () => {
    await clickDisabled(page, '[data-action="endless"]');
    assert((await toastText(page)).includes('Level 10'), 'toast should mention level 10');
    eq(await screenName(page), 'title', 'screen');
  });

  await check('title: keyboard Tab shows a focus ring, Enter on Play opens the map', async () => {
    await page.keyboard.press('Tab');
    await assertFocusVisible(page);
    await page.focus('[data-action="play"]');
    await page.keyboard.press('Enter');
    await waitScreen(page, 'map');
  });

  await check('map: 20 nodes, level 1 current, level 2 locked', async () => {
    eq(await page.locator('[data-level]').count(), 20, 'node count');
    eq(await page.getAttribute('.map-level[data-level="1"]', 'data-state'), 'current', 'level 1 state');
    eq(await page.getAttribute('.map-level[data-level="2"]', 'data-state'), 'locked', 'level 2 state');
    await assertTouchTargets(page, 'map');
    await assertNoOverflow(page, 'map');
  });

  await check('map: locked node rejects with a hint', async () => {
    await clickDisabled(page, '.map-level[data-level="2"]');
    assert((await toastText(page)).includes('Level 1'), 'toast should name level 1');
    eq(await page.locator('.prelevel').count(), 0, 'no modal for locked level');
  });

  await check('pre-level: goals, facts and tutorial intro; Escape and × close it', async () => {
    await page.click('.map-level[data-level="1"]');
    await page.waitForSelector('.prelevel');
    eq(await text(page, '#prelevel-title'), 'Level 1', 'title');
    const goals = await page.locator('.prelevel-goal-amount').allInnerTexts();
    eq(goals.map((g) => g.trim()), ['45', '65', '85'], 'goal amounts');
    assert((await text(page, '.prelevel-facts')).includes('1:30'), 'duration shown');
    assert((await text(page, '.prelevel-facts')).includes('2 Plätze'), 'seats shown');
    assert((await text(page, '.prelevel-intro h4')).includes('So geht’s'), 'basics intro shown');
    eq(await page.locator('.prelevel-hint').count(), 0, 'no shop hint without coins');
    await assertTouchTargets(page, 'pre-level');
    await assertNoOverflow(page, 'pre-level');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    assert(await page.evaluate(() => !!document.activeElement.closest('.prelevel')), 'Tab keeps focus inside the dialog');
    await page.keyboard.press('Escape');
    eq(await page.locator('.prelevel').count(), 0, 'closed by Escape');
    eq(await screenName(page), 'map', 'Escape on the dialog does not leave the map');
    await page.click('.map-level[data-level="1"]');
    await page.click('.prelevel [data-action="close"]');
    eq(await page.locator('.prelevel').count(), 0, 'closed by ×');
  }, () => page.keyboard.press('Escape'));

  await check('pre-level: "Los geht’s!" starts the game with campaign params', async () => {
    await page.click('.map-level[data-level="1"]');
    await page.click('[data-action="start"]');
    await waitScreen(page, 'game');
    if (!HAS_GAME_VIEW) eq(JSON.parse(await text(page, '[data-stub-game]')), { mode: 'campaign', levelId: 1 }, 'game params');
    await page.evaluate(() => window.__acaiGo('map'));
    await waitScreen(page, 'map');
  }, () => page.evaluate(() => window.__acaiGo('map')));

  await check('pre-level: shop hint appears when something is affordable', async () => {
    await setCoins(page, 1000);
    await page.click('.map-level[data-level="1"]');
    await page.waitForSelector('.prelevel-hint');
    assert((await text(page, '.prelevel-hint')).includes('1.000'), 'hint shows the coins');
    await page.click('.prelevel-hint [data-action="shop"]');
    await waitScreen(page, 'shop');
  }, () => page.evaluate(() => window.__acaiGo('shop', { back: 'map' })));

  await check('shop: buy a new ingredient (coins, state, toast)', async () => {
    eq(await page.getAttribute('.sc-coins', 'data-coins'), '1000', 'pill before');
    await page.click('[data-shop-item="strawberry"] [data-buy]');
    eq(await page.getAttribute('[data-shop-item="strawberry"]', 'data-state'), 'upgrade', 'strawberry state');
    eq(await page.getAttribute('.sc-coins', 'data-coins'), '930', 'pill after');
    assert((await toastText(page)).includes('Erdbeere'), 'toast names strawberry');
    const s = await saveState(page);
    assert(s.owned.includes('strawberry') && s.coins === 930, 'save updated');
    await sleep(700);
    eq(await text(page, '.sc-coins-value'), '930', 'pill count-up finished');
  });

  await check('shop: quality upgrade (keyboard keeps focus on the card) and max state', async () => {
    await page.focus('[data-shop-item="honey"] [data-buy]');
    await page.keyboard.press('Enter');
    eq(await page.getAttribute('[data-shop-item="honey"] .card-quality', 'aria-label'), 'Qualität 1 von 2', 'quality 1');
    eq(await page.evaluate(() => document.activeElement.closest('[data-card]')?.dataset.card), 'honey', 'focus kept');
    await sleep(BUY_COOLDOWN_MS + 100); // the card ignores clicks right after a purchase
    await page.click('[data-shop-item="honey"] [data-buy]');
    eq(await page.getAttribute('[data-shop-item="honey"]', 'data-state'), 'max', 'honey maxed');
    eq((await saveState(page)).ingLevels.honey, 2, 'saved quality');
  });

  await check('shop: not enough coins → red price, shake, toast, nothing bought', async () => {
    await setCoins(page, 10);
    await sleep(50);
    eq(await page.getAttribute('[data-shop-item="spirulina"] [data-buy]', 'aria-disabled'), 'true', 'disabled look');
    await clickDisabled(page, '[data-shop-item="spirulina"] [data-buy]');
    assert(await page.locator('[data-shop-item="spirulina"].sc-shake').count() === 1, 'card shakes');
    eq(await toastText(page), 'Nicht genug Münzen!', 'toast');
    const s = await saveState(page);
    assert(!s.owned.includes('spirulina') && s.coins === 10, 'nothing bought');
    await assertTouchTargets(page, 'shop ingredients');
    await assertNoOverflow(page, 'shop ingredients');
  });

  await check('shop: kitchen tab – upgrade levels, locked smoothie slots', async () => {
    await setCoins(page, 1000);
    await page.click('[data-tab="kitchen"]');
    eq(await page.getAttribute('[data-tab="kitchen"]', 'aria-selected'), 'true', 'tab selected');
    eq(await page.getAttribute('[data-upgrade="smoothieSlots"]', 'data-state'), 'locked', 'smoothie slots locked');
    await clickDisabled(page, '[data-upgrade="smoothieSlots"] [data-buy]');
    assert((await toastText(page)).includes('Level 7'), 'locked toast');
    await page.click('[data-upgrade="bowlSlots"] [data-buy]');
    eq(await page.locator('[data-upgrade="bowlSlots"] .upg-pips i.on').count(), 1, 'one pip');
    eq((await saveState(page)).upgrades.bowlSlots, 1, 'saved upgrade');
    await assertTouchTargets(page, 'shop kitchen');
    await assertNoOverflow(page, 'shop kitchen');
  });

  await check('shop: a double click buys once, a held Enter key too; later clicks buy again', async () => {
    await setCoins(page, 2000);
    const btn = '[data-upgrade="blenderSpeed"] [data-buy]';
    const level = async () => (await saveState(page)).upgrades.blenderSpeed ?? 0;
    const price = Number((await text(page, btn)).replace(/\D/g, ''));
    await page.dblclick(btn);
    eq(await level(), 1, 'one level after a double click');
    eq((await saveState(page)).coins, 2000 - price, 'paid exactly the first level');
    eq(await page.locator('[data-upgrade="blenderSpeed"] .upg-pips i.on').count(), 1, 'one pip');
    // Holding Enter longer than the cooldown: Playwright marks the repeated keyboard.down as a repeat.
    await sleep(BUY_COOLDOWN_MS + 100);
    await page.focus(btn);
    await page.keyboard.down('Enter');
    for (let i = 0; i < 3; i++) {
      await sleep(BUY_COOLDOWN_MS / 2 + 50);
      await page.keyboard.down('Enter');
    }
    await page.keyboard.up('Enter');
    eq(await level(), 2, 'one level while Enter is held');
    eq(await page.evaluate(() => document.activeElement.closest('[data-card]')?.dataset.card), 'blenderSpeed', 'focus kept');
    await sleep(BUY_COOLDOWN_MS + 100);
    await page.click(btn);
    eq(await level(), 3, 'a later click buys the next level');
    await setCoins(page, 1000);
  });

  await check('shop: decor tab – buy plants', async () => {
    await page.click('[data-tab="decor"]');
    await page.click('[data-upgrade="plants"] [data-buy]');
    eq(await page.getAttribute('[data-upgrade="plants"]', 'data-state'), 'max', 'plants bought');
    assert((await text(page, '.shop-summary')).includes('+8'), 'patience summary');
    await assertNoOverflow(page, 'shop decor');
  });

  await check('shop: back (Escape) returns to the map, map back to the title', async () => {
    await page.keyboard.press('Escape');
    await waitScreen(page, 'map');
    await page.click('[data-action="back"]');
    await waitScreen(page, 'title');
  }, () => page.evaluate(() => window.__acaiGo('title')));

  await check('settings: switching to English re-renders the texts', async () => {
    await page.click('[data-action="settings"]');
    await waitScreen(page, 'settings');
    eq(await text(page, '.sc-title'), 'Einstellungen', 'German title');
    await page.click('[data-setting-lang="en"]');
    await page.waitForFunction(() => document.querySelector('.sc-title')?.textContent === 'Settings');
    eq(await page.evaluate(() => document.documentElement.lang), 'en', 'html lang');
    eq((await saveState(page)).settings.lang, 'en', 'saved language');
    eq(await page.getAttribute('[data-setting-lang="en"]', 'aria-checked'), 'true', 'radio state');
    await assertTouchTargets(page, 'settings');
    await assertNoOverflow(page, 'settings');
  }, () => page.evaluate(() => window.__acaiGo('settings')));

  await check('settings: music and sfx switches persist and apply', async () => {
    await page.click('[data-setting="music"]');
    eq(await page.getAttribute('[data-setting="music"]', 'aria-checked'), 'false', 'music switch');
    eq((await saveState(page)).settings.music, false, 'saved music');
    const musicOn = await page.evaluate(() => window.__acaiAudio?.musicOn?.());
    if (musicOn !== undefined) eq(musicOn, false, 'audio.musicOn()');
    await page.click('[data-setting="sfx"]');
    await page.click('[data-setting="sfx"]');
    eq((await saveState(page)).settings.sfx, true, 'sfx back on');
  });

  await check('settings: reset needs two steps and keeps language + audio settings', async () => {
    await page.click('[data-action="reset"]');
    assert((await text(page, '.settings-reset p')).startsWith('Really delete'), 'confirm text');
    await page.click('[data-action="reset-cancel"]');
    eq((await saveState(page)).coins > 0, true, 'cancel keeps progress');
    await page.click('[data-action="reset"]');
    await page.click('[data-action="reset-confirm"]');
    await waitScreen(page, 'settings');
    eq(await toastText(page), 'Progress deleted.', 'toast');
    const s = await saveState(page);
    eq([s.coins, s.owned.length, s.upgrades, s.settings.lang, s.settings.music], [0, 4, {}, 'en', false], 'save after reset');
  });

  await check('title: English texts, quick language toggle back to German', async () => {
    await page.click('[data-action="back"]');
    await waitScreen(page, 'title');
    eq(await text(page, '[data-action="play"]'), 'Play', 'English play');
    await assertNoOverflow(page, 'title en');
    await page.click('[data-lang="de"]');
    await page.waitForFunction(() => document.querySelector('[data-action="play"]')?.textContent.trim() === 'Spielen');
    eq((await saveState(page)).settings.lang, 'de', 'saved language');
  });

  await check('title: sound toggle switches music and sfx together', async () => {
    const before = (await saveState(page)).settings;
    const wasOn = before.music || before.sfx;
    await page.click('[data-action="sound"]');
    const after = (await saveState(page)).settings;
    eq([after.music, after.sfx], [!wasOn, !wasOn], 'settings after toggle');
    eq(await page.getAttribute('[data-action="sound"]', 'aria-pressed'), String(!wasOn), 'aria-pressed');
    await page.click('[data-action="sound"]');
  });

  await check('results via router: "Weiter" opens the next level on the map', async () => {
    // Same order as the game view: record the result through save.js, then show it.
    await page.evaluate(async () => {
      const m = await import('/js/save.js');
      const rec = m.recordLevelResult(1, { won: true, stars: 2, money: 70, served: 6 });
      window.__acaiGo('results', { mode: 'campaign', levelId: 1, result: 'won', reason: null, stars: 2, money: 70, served: 6, lost: 0, ...rec });
    });
    await waitScreen(page, 'results');
    eq(await text(page, '#results-title'), 'Level 1 geschafft!', 'headline');
    assert((await text(page, '.results-notes')).includes('Level 2 freigeschaltet!'), 'unlock note');
    await page.click('[data-action="next"]');
    await waitScreen(page, 'map');
    await page.waitForSelector('.prelevel[data-prelevel="2"]');
    await page.keyboard.press('Escape');
  }, () => page.evaluate(() => window.__acaiGo('title')));

  await check('rotate hint: not for a tall desktop window; portrait phone shows it, "Trotzdem spielen" dismisses it', async () => {
    await page.setViewportSize({ width: 1000, height: 1100 });
    await page.waitForFunction(() => window.innerWidth === 1000);
    await page.evaluate(() => new Promise(requestAnimationFrame));
    assert(await page.evaluate(() => document.getElementById('rotate-hint').hidden), 'no hint for a mouse window 1000×1100');
    await page.setViewportSize({ width: 600, height: 900 });
    await page.waitForFunction(() => !document.getElementById('rotate-hint').hidden);
    eq(await text(page, '#rotate-hint h2'), 'Bitte dreh dein Gerät', 'hint text');
    await page.click('[data-action="dismiss-rotate"]');
    assert(await page.evaluate(() => document.getElementById('rotate-hint').hidden), 'hidden after dismiss');
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  await check('router: a screen that throws falls back to the title', async () => {
    const before = errors.length;
    await page.evaluate(() => window.__acaiGo('results', { get mode() { throw new Error('boom (expected by test)'); } }));
    await waitScreen(page, 'title');
    await page.evaluate(() => window.__acaiGo('no-such-screen'));
    await waitScreen(page, 'title');
    const logged = errors.splice(before);
    assert(logged.length >= 2 && logged.some((e) => e.includes('failed to render')) && logged.some((e) => e.includes('unknown screen')), `expected 2 router errors, got:\n${logged.join('\n')}`);
  });

  await check('index.html: no console errors', async () => {
    assert(!errors.length, errors.join('\n'));
  });
  await context.close();
}

// ------------------------------------------------------------------ touch tablet (index.html)
async function cdpTap(page, selector) {
  const b = await page.locator(selector).boundingBox();
  if (!b) throw new Error(`no box for ${selector}`);
  const cdp = await page.context().newCDPSession(page);
  const p = { x: b.x + b.width / 2, y: b.y + b.height / 2, radiusX: 4, radiusY: 4, force: 1, id: 1 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

const hintShown = (page) => page.evaluate(() => !document.getElementById('rotate-hint').hidden);

async function touchFlow(browser, base) {
  // An iPad Air held upright: 820×1180 is wider than a phone but the stage would shrink to ~60 %.
  const { context, page, errors } = await newPage(browser, { viewport: { width: 820, height: 1180 }, touch: true });
  shotPage = page;
  console.log('index.html on a touch tablet');
  await page.goto(`${base}index.html`);

  await check('rotate hint: portrait touch tablet (820×1180) shows it, landscape hides it', async () => {
    await waitScreen(page, 'title');
    assert(await hintShown(page), 'hint on a portrait iPad Air');
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.waitForFunction(() => document.getElementById('rotate-hint').hidden);
  });

  await check('shop (touch): a double tap buys a new ingredient once, not its quality upgrade too', async () => {
    await setCoins(page, 400);
    await page.evaluate(() => window.__acaiGo('shop', { back: 'map' }));
    await waitScreen(page, 'shop');
    const btn = '[data-shop-item="strawberry"] [data-buy]';
    const price = Number((await text(page, btn)).replace(/\D/g, ''));
    await cdpTap(page, btn);
    await sleep(150);
    await cdpTap(page, btn);
    await sleep(100);
    const s = await saveState(page);
    assert(s.owned.includes('strawberry'), 'strawberry bought');
    eq(s.ingLevels.strawberry ?? 0, 0, 'no quality level bought by the second tap');
    eq(s.coins, 400 - price, 'coins');
  });

  if (HAS_GAME_VIEW) {
    await check('rotate hint: turning the tablet upright mid-level pauses the game', async () => {
      await page.evaluate(() => window.__acaiGo('game', { mode: 'campaign', levelId: 5 }));
      await waitScreen(page, 'game');
      await page.waitForFunction(() => window.__acaiGame?.status === 'playing' && window.__acaiGame.time > 0.3);
      await page.setViewportSize({ width: 820, height: 1180 });
      await page.waitForFunction(() => !document.getElementById('rotate-hint').hidden);
      eq(await page.evaluate(() => window.__acaiGame.status), 'paused', 'game status');
      assert(await page.isVisible('[data-pause-overlay]'), 'pause overlay behind the hint');
      const t0 = await page.evaluate(() => window.__acaiGame.time);
      await sleep(400);
      eq(await page.evaluate(() => window.__acaiGame.time), t0, 'level clock stopped');
      await page.click('[data-action="dismiss-rotate"]');
      assert(!(await hintShown(page)), 'hint dismissed');
      assert(await page.isVisible('[data-pause-overlay]'), 'still paused after "Trotzdem spielen"');
      await page.setViewportSize({ width: 1180, height: 820 });
      await page.evaluate(() => window.__acaiGo('title'));
    }, () => page.evaluate(() => window.__acaiGo('title')));
  }

  await check('touch tablet: no console errors', async () => {
    assert(!errors.length, errors.join('\n'));
  });
  await context.close();
}

// ------------------------------------------------------------------ results variants (harness)
async function harnessFlow(browser, base) {
  const { context, page, errors } = await newPage(browser);
  shotPage = page;
  const open = async (qs) => {
    await page.goto(`${base}tools/screens-harness.html?${qs}`);
    await waitScreen(page, qs.match(/screen=(\w+)/)?.[1] === 'prelevel' ? 'map' : qs.match(/screen=(\w+)/)?.[1] ?? 'title');
  };
  const log = () => page.evaluate(() => window.__harness.log.filter((e) => e.type === 'go').map((e) => [e.name, e.params]));
  const sfxLog = () => page.evaluate(() => window.__harness.log.filter((e) => e.type === 'audio' && e.fn === 'sfx').map((e) => e.args[0]));
  console.log('tools/screens-harness.html');

  await check('results win3: stars animate in with a star sound each, money counts up', async () => {
    await open('screen=results&variant=win3&coins=400');
    eq(await page.locator('.results-star.is-waiting').count(), 3, 'stars waiting at first');
    await sleep(2300);
    eq(await page.locator('.results-star.is-in').count(), 3, 'three stars in');
    eq((await sfxLog()).filter((n) => n === 'star').length, 3, 'star sounds');
    eq(await text(page, '[data-money]'), '172', 'money');
    assert((await text(page, '.results-notes')).includes('Level 5 freigeschaltet!'), 'unlock note');
    eq(await page.locator('[data-action="next"]').count(), 1, 'next button');
    await assertTouchTargets(page, 'results win');
    await assertNoOverflow(page, 'results win');
  });

  await check('results win3: Nochmal / Karte / Shop navigate with the right params', async () => {
    await page.click('[data-action="retry"]');
    await page.goto(`${base}tools/screens-harness.html?screen=results&variant=win3`);
    await waitScreen(page, 'results');
    await page.click('[data-action="shop"]');
    const goes = await log();
    eq(goes.at(-1), ['shop', { back: 'map' }], 'shop params');
    await page.goto(`${base}tools/screens-harness.html?screen=results&variant=win3`);
    await waitScreen(page, 'results');
    await page.click('[data-action="map"]');
    eq((await log()).at(-1), ['map', {}], 'map params');
  });

  await check('results retry params (campaign)', async () => {
    await open('screen=results&variant=win1');
    await page.click('[data-action="retry"]');
    eq((await log()).at(-1), ['game', { mode: 'campaign', levelId: 6 }], 'retry params');
  });

  await check('results lostGoal: reason with goal, keep-coins note, no "Weiter"', async () => {
    await open('screen=results&variant=lostGoal');
    eq(await text(page, '#results-title'), 'Level 9 verloren', 'headline');
    assert((await text(page, '.results-sub')).includes('160'), 'goal amount in reason');
    assert((await text(page, '.results-notes')).includes('Münzen behältst du'), 'keep coins note');
    eq(await page.locator('[data-action="next"]').count(), 0, 'no next button');
    eq(await page.locator('.results-star.is-filled').count(), 0, 'no stars');
  });

  await check('results lostHearts (English)', async () => {
    await open('screen=results&variant=lostHearts&lang=en');
    eq(await text(page, '#results-title'), 'Level 13 failed', 'headline');
    assert((await text(page, '.results-sub')).startsWith('Out of hearts'), 'reason');
    await assertNoOverflow(page, 'results lost en');
  });

  await check('results endless best: new record, Menu button, retry endless', async () => {
    await open('screen=results&variant=endlessBest&best=612');
    eq(await text(page, '#results-title'), 'Spiel vorbei!', 'headline');
    assert((await text(page, '.results-notes')).includes('Neuer Rekord!'), 'new best note');
    assert((await text(page, '.results-stats')).includes('612'), 'best shown');
    eq(await page.locator('.results-stars').count(), 0, 'no stars in endless');
    eq(await page.locator('[data-action="title"]').count(), 1, 'menu button');
    await page.click('[data-action="retry"]');
    eq((await log()).at(-1), ['game', { mode: 'endless' }], 'retry endless');
  });

  await check('results win20: no next level, all-done note', async () => {
    await open('screen=results&variant=win20&lang=en');
    eq(await page.locator('[data-action="next"]').count(), 0, 'no next');
    assert((await text(page, '.results-notes')).includes('All 20 levels complete!'), 'all done');
  });

  await check('harness map with progress: done/current/locked states, endless unlocked', async () => {
    await open('screen=map&stars=1-10&coins=50');
    eq(await page.getAttribute('[data-level="10"]', 'data-state'), 'done', 'level 10 done');
    eq(await page.getAttribute('[data-level="11"]', 'data-state'), 'current', 'level 11 current');
    eq(await page.getAttribute('[data-level="12"]', 'data-state'), 'locked', 'level 12 locked');
    eq(await page.getAttribute('.sc-header [data-action="endless"]', 'aria-disabled'), 'false', 'endless open');
    await page.click('.sc-header [data-action="endless"]');
    eq((await log()).at(-1), ['game', { mode: 'endless' }], 'endless params');
  });

  await check('harness pre-level 12 (English): four seats intro', async () => {
    await open('screen=prelevel&level=12&stars=1-11&lang=en');
    assert((await text(page, '.prelevel-intro h4')).includes('Full house'), 'intro title');
    eq(await page.locator('.prelevel-seats svg').count(), 4, 'four seat icons');
    await assertNoOverflow(page, 'pre-level 12 en');
  });

  await check('harness shop (English, all owned + maxed) has no overflow', async () => {
    await open('screen=shop&owned=all&quality=max&upgrades=max&coins=99999&stars=1-20:3&lang=en');
    eq(await page.locator('[data-shop-item][data-state="max"]').count(), 16, 'all maxed');
    await assertNoOverflow(page, 'shop maxed en');
    await page.click('[data-tab="kitchen"]');
    eq(await page.locator('[data-upgrade][data-state="max"]').count(), 5, 'kitchen maxed');
    await assertNoOverflow(page, 'kitchen maxed en');
  });

  await check('harness: no console errors', async () => {
    assert(!errors.length, errors.join('\n'));
  });
  await context.close();
}

// ------------------------------------------------------------------ run
const srv = await serve();
const browser = await launch();
try {
  await mainFlow(browser, srv.url);
  await touchFlow(browser, srv.url);
  await harnessFlow(browser, srv.url);
} finally {
  await browser.close();
  await srv.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
