// Shared Playwright helpers for the e2e scripts in tests/e2e/*.e2e.mjs.
//
//   const srv = await startServer({ port: 0 });          // { url, port, close() } – url ends with '/'
//   const { browser, page, close } = await launchBrowser({ touch: true });
//   const errors = collectConsoleErrors(page);
//   await page.goto(srv.url);
//   await dragBetween(page, '[data-bin="banana"]', '[data-bowl="0"]', { touch: true });
//   const scale = await pinch(page, { x: 580, y: 20 }, { x: 600, y: 20 });   // isMobile + touch
//   const zoom = await trackpadPinch(page, { x: 700, y: 400 });              // desktop (MacBook trackpad)
//   assertNoConsoleErrors(errors);
//   await close(); await srv.close();

import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

export { startServer } from '../../tools/serve.mjs';

export const STAGE_W = 1280;
export const STAGE_H = 800;
export const TABLET_VIEWPORT = { width: 1280, height: 800 };

// Console noise that is not a bug in the game (e.g. Google Fonts unreachable offline).
export const DEFAULT_IGNORE = [/fonts\.(googleapis|gstatic)\.com/i];

// Proxy settings for external requests (Google Fonts) when the environment uses an HTTPS proxy.
function proxyFromEnv() {
  const server = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!server) return undefined;
  // '<-loopback>' is required: without it Chromium sends 127.0.0.1 through the proxy too.
  return { server, bypass: '<-loopback>,localhost,127.0.0.1,::1' };
}

/**
 * Launches headless Chromium with one context and page.
 * touch: emulate a touch tablet (hasTouch) – required for touch drags.
 * viewport: CSS pixel size, default 1280×800 (tablet landscape).
 * fonts: 'real' loads Google Fonts (through HTTPS_PROXY if set), 'stub' answers them with empty CSS
 *        (faster, deterministic, no network).
 * locale: navigator.language – 'de-DE' starts the game in German, 'en-US' in English.
 * Returns { browser, context, page, close() }.
 */
export async function launchBrowser({
  touch = false,
  viewport = TABLET_VIEWPORT,
  deviceScaleFactor = 1,
  isMobile = false,
  headless = true,
  fonts = 'real',
  locale = 'de-DE',
} = {}) {
  const browser = await chromium.launch({ headless, proxy: fonts === 'real' ? proxyFromEnv() : undefined });
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor,
    hasTouch: touch,
    isMobile,
    locale,
    ignoreHTTPSErrors: true,
  });
  if (fonts === 'stub') {
    await context.route(/fonts\.googleapis\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await context.route(/fonts\.gstatic\.com/, (route) => route.abort());
  }
  const page = await context.newPage();
  return { browser, context, page, close: () => browser.close() };
}

/**
 * Collects console errors and uncaught page errors into the returned (live) array.
 * Each entry is a string; ignore = list of RegExps matched against "text url".
 */
export function collectConsoleErrors(page, { ignore = DEFAULT_IGNORE, warnings = false } = {}) {
  const errors = [];
  const keep = (text) => !ignore.some((re) => re.test(text));
  page.on('console', (msg) => {
    const type = msg.type();
    if (type !== 'error' && !(warnings && type === 'warning')) return;
    const where = msg.location()?.url || '';
    const text = `${type}: ${msg.text()}${where ? ` (${where})` : ''}`;
    if (keep(text)) errors.push(text);
  });
  page.on('pageerror', (err) => {
    const text = `pageerror: ${err.stack || err.message}`;
    if (keep(text)) errors.push(text);
  });
  return errors;
}

export function assertNoConsoleErrors(errors, label = 'page') {
  if (errors.length) throw new Error(`${label}: ${errors.length} console error(s):\n  ${errors.join('\n  ')}`);
}

// Converts stage coordinates (1280×800 logical px) into viewport coordinates.
export async function stageToClient(page, x, y) {
  return page.evaluate(([sx, sy, w]) => {
    const r = document.getElementById('stage').getBoundingClientRect();
    const s = r.width / w;
    return { x: r.left + sx * s, y: r.top + sy * s };
  }, [x, y, STAGE_W]);
}

// target = CSS selector, Playwright Locator or { x, y } viewport point → centre point.
async function pointOf(page, target, timeout) {
  if (target && typeof target.x === 'number' && typeof target.y === 'number') return target;
  const loc = typeof target === 'string' ? page.locator(target).first() : target;
  await loc.waitFor({ state: 'visible', timeout });
  const box = await loc.boundingBox();
  if (!box) throw new Error(`dragBetween: ${target} has no bounding box`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

const cdpSessions = new WeakMap();
async function cdpFor(page) {
  if (!cdpSessions.has(page)) cdpSessions.set(page, await page.context().newCDPSession(page));
  return cdpSessions.get(page);
}

function touchPoint(p) {
  return { x: p.x, y: p.y, id: 1, radiusX: 8, radiusY: 8, force: 1 };
}

const pause = (ms) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

/**
 * Real pointer drag from the centre of `from` to the centre of `to` with intermediate moves.
 * touch: true → touch events via CDP (context must be launched with touch: true), else mouse.
 * steps: number of intermediate moves; stepDelay: ms between moves; holdMs: pause before release.
 * Returns { from, to } viewport points.
 */
export async function dragBetween(page, from, to, {
  touch = false, steps = 14, stepDelay = 12, holdMs = 60, timeout = 5000,
} = {}) {
  const a = await pointOf(page, from, timeout);
  const b = await pointOf(page, to, timeout);
  const at = (i) => ({ x: a.x + ((b.x - a.x) * i) / steps, y: a.y + ((b.y - a.y) * i) / steps });

  if (touch) {
    const cdp = await cdpFor(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchPoint(a)] });
    await pause(stepDelay);
    for (let i = 1; i <= steps; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [touchPoint(at(i))] });
      await pause(stepDelay);
    }
    await pause(holdMs);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await pause(stepDelay);
    for (let i = 1; i <= steps; i++) {
      const p = at(i);
      await page.mouse.move(p.x, p.y);
      await pause(stepDelay);
    }
    await pause(holdMs);
    await page.mouse.up();
  }
  await pause(stepDelay);
  return { from: a, to: b };
}

/**
 * Two-finger pinch-out via CDP touch events, starting at viewport points a and b. Each finger moves
 * `spread` px away from the other (along the a→b line, horizontal when a = b) in `steps` moves.
 * Launch with { touch: true, isMobile: true }: only a mobile context lets Chromium zoom the page
 * the way a phone or tablet browser does (Input.synthesizePinchGesture does nothing in headless).
 * Returns visualViewport.scale after the gesture (1 = the page did not zoom).
 */
export async function pinch(page, a, b, { spread = 160, steps = 20, stepDelay = 16, settleMs = 300 } = {}) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const u = len ? { x: (b.x - a.x) / len, y: (b.y - a.y) / len } : { x: 1, y: 0 };
  const fingers = (i) => {
    const d = (spread * i) / steps;
    return [
      { ...touchPoint({ x: a.x - u.x * d, y: a.y - u.y * d }), id: 1 },
      { ...touchPoint({ x: b.x + u.x * d, y: b.y + u.y * d }), id: 2 },
    ];
  };
  const cdp = await cdpFor(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: fingers(0) });
  for (let i = 1; i <= steps; i++) {
    await pause(stepDelay);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: fingers(i) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await pause(settleMs);
  return page.evaluate(() => window.visualViewport?.scale ?? 1);
}

/**
 * Trackpad pinch-out (MacBook) at viewport point p. Launch a desktop context (no isMobile): Chromium
 * delivers the gesture as ctrl+wheel events and zooms the page by scaleFactor unless they are cancelled.
 * Returns visualViewport.scale after the gesture (1 = the page did not zoom).
 */
export async function trackpadPinch(page, p, { scaleFactor = 2, settleMs = 300 } = {}) {
  const cdp = await cdpFor(page);
  await cdp.send('Input.synthesizePinchGesture', { x: p.x, y: p.y, scaleFactor, gestureSourceType: 'mouse' });
  await pause(settleMs);
  return page.evaluate(() => window.visualViewport?.scale ?? 1);
}

// Directory for screenshots / traces – outside the repo unless E2E_OUT_DIR says otherwise.
export function e2eOutDir(sub = '') {
  const dir = path.join(process.env.E2E_OUT_DIR || path.join(os.tmpdir(), 'acai-fever-e2e'), sub);
  mkdirSync(dir, { recursive: true });
  return dir;
}
