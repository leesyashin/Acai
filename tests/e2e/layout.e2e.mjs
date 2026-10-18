// E2E check of the gameplay screen layout (docs/DESIGN.md §4.7) through tools/game-harness.html:
// every station the player drags from or onto lies fully on the 1280×800 stage, below the pass (never
// over the guests), is at least 64 × 64 stage px and does not overlap another station – in the fullest
// kitchen (4 seats, 2 blenders, 4 cups, all 16 ingredients, 2 machine slots) as well as in small ones,
// with and without WebGL. The layer names on the freezer and the risers and the ingredients' name tags stay
// uncovered (a tall container of the front row reaches up in front of the riser behind it, its names are drawn
// over it), a "NEU" badge sticking up from a container is drawn over the riser behind it but leaves the layer
// name there readable, and no badge hides an ingredient's quality stars or layer badge.
// Run: node tests/e2e/layout.e2e.mjs   (serves the repo on :8090, exits non-zero on failure)

import path from 'node:path';
import { startServer, launchBrowser, collectConsoleErrors, assertNoConsoleErrors, e2eOutDir, STAGE_W, STAGE_H } from './helpers.mjs';

const PORT = Number(process.env.E2E_PORT) || 8090;
const OUT = e2eOutDir('layout');
const MIN = 64; // stage px (DESIGN §4.7: tablet fingers)
const PASS_TOP = 294; // stage y of the pass: the guests and their bubbles are above it
const STATIONS = '[data-blender], [data-pack], [data-cup-stack], [data-bowl], [data-bin], [data-smoothie-slot], [data-trash]';
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

async function serve() {
  try {
    const srv = await startServer({ port: PORT });
    return { url: srv.url.replace(/\/$/, ''), close: () => srv.close() };
  } catch (err) {
    if (err.code !== 'EADDRINUSE') throw err;
    return { url: `http://127.0.0.1:${PORT}`, close: async () => {} };
  }
}

// The hit boxes (getBoundingClientRect, as drag.js measures them) of every station in stage px, plus
// whether each layer label and name tag is the topmost element at its centre (the container pictures
// count: they let the pointer through, so they are hit-tested for a moment like the labels).
const measure = (page, sel) => page.evaluate((stations) => {
  const st = document.getElementById('stage').getBoundingClientRect();
  const k = 1280 / st.width;
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { x1: (r.left - st.left) * k, y1: (r.top - st.top) * k, x2: (r.right - st.left) * k, y2: (r.bottom - st.top) * k };
  };
  // an ingredient's hit area reaches above its box (css/game.css .g-bin::before)
  const hit = (el) => {
    const b = box(el);
    const reach = el.matches('[data-bin]') ? -parseFloat(getComputedStyle(el, '::before').top) || 0 : 0;
    return { ...b, y1: b.y1 - reach };
  };
  const name = (el) => ['blender', 'pack', 'cupStack', 'bowl', 'bin', 'smoothieSlot', 'trash']
    .filter((a) => a in el.dataset).map((a) => `${a}${el.dataset[a] ? `=${el.dataset[a]}` : ''}`)[0];
  // labels and pictures let the pointer through: hit-test them for a moment to see what is drawn on top
  const arts = [...document.querySelectorAll('.g-bin .g-art')];
  for (const a of arts) a.style.pointerEvents = 'auto';
  const labels = [...document.querySelectorAll('.g-shelf-label, .g-freezer-label, .g-bin .g-name')].map((el) => {
    const r = el.getBoundingClientRect();
    el.style.pointerEvents = 'auto';
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    el.style.pointerEvents = '';
    return { text: el.textContent, ...box(el), clear: !!top && (top === el || el.contains(top)) };
  });
  for (const a of arts) a.style.pointerEvents = '';
  return { stations: [...document.querySelectorAll(stations)].map((el) => ({ name: name(el), ...hit(el) })), labels };
}, sel);

async function open(srv, query, { viewport, noWebgl = false } = {}) {
  const b = await launchBrowser({ fonts: 'stub', viewport });
  const errors = collectConsoleErrors(b.page);
  if (noWebgl) {
    await b.page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function getContext(type, ...rest) {
        return /webgl/i.test(type) ? null : orig.call(this, type, ...rest);
      };
    });
  }
  await b.page.goto(`${srv.url}/tools/game-harness.html?mute=1&log=0&tutorial=0&${query}`);
  await b.page.waitForFunction(() => !!window.__acaiGame && !!document.querySelector('.screen-game'));
  await sleep(250);
  return { ...b, errors };
}

const fmt = (s) => `${s.name} [${[s.x1, s.y1, s.x2, s.y2].map((v) => v.toFixed(1)).join(', ')}]`;

// The badges that are not the topmost element where they are drawn: a "NEU" badge near its top edge or at its
// centre (something of the row behind it, e.g. its layer label, is drawn over it), a quality star or a bin's layer
// badge at its centre (a "NEU" badge is drawn over it). Labels and badges let the pointer through: hit-test them for
// a moment too.
const hiddenBadges = (page) => page.evaluate(() => {
  const through = [...document.querySelectorAll('.g-shelf-label, .g-freezer-label, .g-new, .g-quality, .g-bin > .g-lnum')];
  for (const l of through) l.style.pointerEvents = 'auto';
  const owner = (el) => el.closest('[data-bin]')?.dataset.bin || el.closest('[data-pack]')?.dataset.pack;
  const covered = (el, pts) => pts.some(([x, y]) => {
    const top = document.elementFromPoint(x, y);
    return !top || !(top === el || el.contains(top));
  });
  const mid = (el) => {
    const r = el.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  };
  const hidden = [];
  for (const el of document.querySelectorAll('.g-new')) {
    const [x, y] = mid(el);
    if (covered(el, [[x, el.getBoundingClientRect().top + 4], [x, y]])) hidden.push(`"NEU" of ${owner(el)}`);
  }
  for (const el of document.querySelectorAll('.g-quality')) {
    if (covered(el, [...el.children].map(mid))) hidden.push(`stars of ${owner(el)}`);
  }
  for (const el of document.querySelectorAll('.g-bin > .g-lnum')) {
    if (covered(el, [mid(el)])) hidden.push(`layer badge of ${owner(el)}`);
  }
  for (const l of through) l.style.pointerEvents = '';
  return hidden;
});

function assertLayout({ stations, labels }, want) {
  const count = (n) => stations.filter((s) => s.name.startsWith(n)).length;
  for (const [n, c] of Object.entries(want)) assert(count(n) === c, `${c} × ${n} expected, found ${count(n)}`);
  const bad = [];
  for (const s of stations) {
    const w = s.x2 - s.x1;
    const h = s.y2 - s.y1;
    if (s.x1 < -0.5 || s.y1 < -0.5 || s.x2 > STAGE_W + 0.5 || s.y2 > STAGE_H + 0.5) bad.push(`${fmt(s)} leaves the stage`);
    if (s.y1 < PASS_TOP) bad.push(`${fmt(s)} reaches over the pass into the guests`);
    if (w < MIN - 0.5 || h < MIN - 0.5) bad.push(`${fmt(s)} is smaller than ${MIN}×${MIN} (${w.toFixed(1)}×${h.toFixed(1)})`);
  }
  for (let i = 0; i < stations.length; i++) {
    for (let j = i + 1; j < stations.length; j++) {
      const a = stations[i];
      const b = stations[j];
      const ox = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
      const oy = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
      if (ox > 0.5 && oy > 0.5) bad.push(`${fmt(a)} overlaps ${fmt(b)} by ${ox.toFixed(1)}×${oy.toFixed(1)}`);
    }
  }
  for (const l of labels) {
    if (l.x1 < 0 || l.y1 < 0 || l.x2 > STAGE_W || l.y2 > STAGE_H) bad.push(`label "${l.text}" leaves the stage`);
    if (!l.clear) bad.push(`label "${l.text}" is covered`);
  }
  assert(bad.length === 0, bad.join('\n'));
}

const ALL = { blender: 2, pack: 3, cupStack: 1, bowl: 4, bin: 13, smoothieSlot: 2, trash: 1 };
const CASES = [
  { name: 'fullest kitchen (level 14, everything owned and upgraded)', query: 'level=14&owned=all&upgrades=max&seed=4', want: ALL, shot: 'fullest' },
  { name: 'fullest kitchen at 1024×768', query: 'level=14&owned=all&upgrades=max&seed=4', want: ALL, viewport: { width: 1024, height: 768 } },
  { name: 'fullest kitchen without WebGL', query: 'level=14&owned=all&upgrades=max&seed=4', want: ALL, noWebgl: true, shot: 'fullest-svg' },
  { name: 'level 1 (1 blender, 2 cups, 4 ingredients)', query: 'level=1&fresh=1&seed=3', want: { blender: 1, pack: 1, cupStack: 1, bowl: 2, bin: 3, smoothieSlot: 0, trash: 1 }, shot: 'level1' },
  { name: 'level 5 (3 seats, locked machine)', query: 'level=5&fresh=1&seed=11', want: { blender: 1, bowl: 2, smoothieSlot: 0, trash: 1 }, shot: 'level5' },
  { name: 'endless with the one-tank machine', query: 'mode=endless&fresh=1&seed=9', want: { smoothieSlot: 1, trash: 1 } },
];
// new toppings in the front row's middle, right under the fruits' layer label, the jars with their lid beside them and
// the granola jar; every ingredient with two quality stars, or none (the sticker takes the stars' place)
const NEW_BADGES = 'level=14&owned=all&upgrades=max&seed=4&new=coconut,chia,peanut,chocolate,banana,honey,granola';

async function main() {
  const srv = await serve();
  console.log(`layout on ${srv.url}`);
  try {
    for (const c of CASES) {
      const { page, errors, close } = await open(srv, c.query, c);
      try {
        await check(`${c.name}: stations on the stage, ≥ ${MIN} px, no overlaps, labels uncovered`, async () => {
          if (c.shot) await page.screenshot({ path: path.join(OUT, `${c.shot}.png`) });
          assertLayout(await measure(page, STATIONS), c.want);
        });
        await check(`${c.name}: no console errors`, async () => assertNoConsoleErrors(errors, c.name));
      } finally {
        await close();
      }
    }
    for (const quality of [2, 0]) {
      const { page, errors, close } = await open(srv, `${NEW_BADGES}&quality=${quality}`);
      try {
        await check(`"NEU" badges of new toppings (${quality} stars) leave the layer label behind them readable, quality stars and layer badges stay visible`, async () => {
          const count = await page.locator('.g-new').count();
          assert(count === 7, `7 "NEU" badges expected, found ${count}`);
          assert(await page.locator('.g-bin .g-quality').count() === (quality ? 13 : 0), `quality stars on ${quality ? 'every' : 'no'} ingredient`);
          const hidden = await hiddenBadges(page);
          assert(hidden.length === 0, `covered: ${hidden.join(', ')}`);
          const covered = (await measure(page, STATIONS)).labels.filter((l) => !l.clear).map((l) => `"${l.text}"`);
          assert(covered.length === 0, `covered labels: ${covered.join(', ')}`);
        });
        await check(`"NEU" badges (${quality} stars): no console errors`, async () => assertNoConsoleErrors(errors, 'new badges'));
      } finally {
        await close();
      }
    }
  } finally {
    await srv.close();
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed · screenshots: ${OUT}`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
