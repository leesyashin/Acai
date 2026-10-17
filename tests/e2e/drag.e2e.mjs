// E2E test for js/drag.js, driven through tools/drag-demo.html with Playwright (Chromium).
// Run: node tests/e2e/drag.e2e.mjs   (starts http-server on :8090 (E2E_PORT) itself, exits non-zero on failure)

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = Number(process.env.E2E_PORT) || 8090;
const BASE = `http://127.0.0.1:${PORT}`;
const DEMO = `${BASE}/tools/drag-demo.html`;
const VIEWPORTS = [
  { width: 1024, height: 768, label: '1024×768' },
  { width: 1600, height: 1000, label: '1600×1000' },
];
// Touch lift (DESIGN §4.3): the ghost centre floats 48 css px above the finger, clamped to 40–80 stage px.
const LIFT_CSS = 48;
const LIFT_MIN = 40;
const LIFT_MAX = 80;
const expectedLift = (scale) => Math.min(LIFT_MAX, Math.max(LIFT_MIN, LIFT_CSS / scale));

const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function near(a, b, tol, what) {
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  assert(d <= tol, `${what}: off by ${d.toFixed(2)} stage px (got ${fmt(a)}, want ${fmt(b)})`);
}

const fmt = (p) => `(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`;

// cleanup runs after a failed check so one failure does not cascade into the next one.
async function checkWith(name, fn, cleanup) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ok    ${name}`);
  } catch (err) {
    results.push({ name, ok: false, err });
    console.log(`  FAIL  ${name}\n        ${err.message}`);
    try {
      await cleanup?.();
    } catch {
      /* best effort */
    }
  }
}

async function resetDrag(page) {
  await page.evaluate(() => window.__dragDemo.dnd.isDragging() && window.__dragDemo.dnd.cancel());
  await sleep(320);
}

// ------------------------------------------------------------------ server
async function reachable() {
  try {
    const res = await fetch(DEMO);
    return res.ok;
  } catch {
    return false;
  }
}

async function startServer() {
  if (await reachable()) {
    console.log(`(reusing server already listening on :${PORT})`);
    return null;
  }
  const proc = spawn('http-server', [ROOT, '-p', String(PORT), '-c-1', '--silent'], { stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    if (await reachable()) return proc;
    await sleep(100);
  }
  proc.kill();
  throw new Error(`http-server did not come up on :${PORT}`);
}

// ------------------------------------------------------------------ page helpers
async function openDemo(browser, viewport, { touch = false, query = '' } = {}) {
  const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: false, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  await page.goto(`${DEMO}${query}`);
  await page.waitForFunction(() => window.__dragDemo?.ready);
  await page.evaluate(() => document.fonts?.ready);
  const cdp = touch ? await context.newCDPSession(page) : null;
  return { context, page, cdp, errors };
}

const frame = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));

const stageScale = (page) => page.evaluate(() => document.getElementById('stage').getBoundingClientRect().width / 1280);

// Client-space centre of an element.
const centre = (page, sel) => page.evaluate((s) => {
  const r = document.querySelector(s).getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}, sel);

// Stage point → client point.
const client = (page, sx, sy) => page.evaluate(([x, y]) => {
  const r = document.getElementById('stage').getBoundingClientRect();
  const s = r.width / 1280;
  return { x: r.left + x * s, y: r.top + y * s };
}, [sx, sy]);

const toStagePt = (page, p) => page.evaluate(([x, y]) => window.__dragDemo.toStage(x, y), [p.x, p.y]);

const mark = (page) => page.evaluate(() => window.__dragDemo.events.length);
const eventsSince = (page, n) => page.evaluate((i) => window.__dragDemo.events.slice(i), n);
const byType = (evs, type) => evs.filter((e) => e.type === type);

const snapshot = (page) => page.evaluate(() => {
  const ghosts = [...document.querySelectorAll('.drag-ghost')];
  const body = ghosts[0]?.querySelector('.drag-ghost-body');
  let ghost = null;
  if (body) {
    const r = body.getBoundingClientRect();
    ghost = window.__dragDemo.toStage(r.left + r.width / 2, r.top + r.height / 2);
  }
  const ids = (sel) => [...document.querySelectorAll(sel)].map((el) => el.id);
  return {
    dragging: window.__dragDemo.dnd.isDragging(),
    rootDragging: document.getElementById('stage').classList.contains('is-dragging'),
    ghosts: ghosts.length,
    ghostClass: ghosts[0]?.className ?? null,
    ghost,
    dropOk: ids('.drop-ok'),
    dropHover: ids('.drop-hover'),
    dragSource: ids('.drag-source'),
    scrollY: window.scrollY,
  };
});

async function settled(page, what = 'after drag') {
  await sleep(320);
  const s = await snapshot(page);
  assert(!s.dragging && !s.rootDragging, `${what}: still dragging`);
  assert(s.ghosts === 0, `${what}: ${s.ghosts} ghost(s) left`);
  assert(!s.dropOk.length && !s.dropHover.length, `${what}: target classes left ${s.dropOk} ${s.dropHover}`);
  assert(!s.dragSource.length, `${what}: drag-source left on ${s.dragSource}`);
}

function lastEnd(evs) {
  const ends = byType(evs, 'end');
  assert(ends.length === 1, `expected exactly one source onEnd, got ${ends.length}`);
  const drops = byType(evs, 'drop');
  const cancels = byType(evs, 'cancel');
  assert(drops.length + cancels.length === 1, `expected one onDrop/onCancel, got ${drops.length}/${cancels.length}`);
  return ends[0];
}

// A release that must count as "drop on nothing": no target drop(), a plain ok:false result.
function assertSilentReturn(evs, what) {
  const end = lastEnd(evs);
  assert(byType(evs, 'targetDrop').length === 0, `${what}: a target drop() was called`);
  assert(byType(evs, 'tap').length === 0, `${what}: onTap was called`);
  assert(end.ok === false && end.target === null && end.reason === null && !end.tap && !end.cancelled,
    `${what}: onEnd ${JSON.stringify(end)}`);
}

// The game's counter: a bowl sits 2 px above the fruit bins, closer than touch lift + hit pad, so the
// lifted ghost of a finger resting on a bin is over the bowl. This puts a strawberry bin (game height,
// 84 stage px) 2 px under the demo bowl and returns its client centre and top; removeBinUnderBowl()
// takes it away.
async function binUnderBowl(page) {
  return page.evaluate(() => {
    const bowl = document.getElementById('tgt-bowl');
    const el = window.__dragDemo.rebuildSource('strawberry');
    Object.assign(el.style, {
      left: `${bowl.offsetLeft + (bowl.offsetWidth - el.offsetWidth) / 2}px`,
      top: `${bowl.offsetTop + bowl.offsetHeight + 2}px`,
      height: '84px',
      overflow: 'hidden',
    });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top };
  });
}

const removeBinUnderBowl = (page) => page.evaluate(() => window.__dragDemo.rebuildSource('strawberry', false));
const bowlHas = (page, id) => page.evaluate((i) => window.__dragDemo.state.bowl.includes(i), id);

async function mouseDrag(page, from, to, steps = 10) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
}

// ------------------------------------------------------------------ touch (CDP)
const touch = (cdp, type, points) => cdp.send('Input.dispatchTouchEvent', {
  type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: p.id ?? i, radiusX: 4, radiusY: 4, force: 1 })),
});

async function touchDrag(page, cdp, from, to, { steps = 12, onMove, end = 'touchEnd' } = {}) {
  await touch(cdp, 'touchStart', [from]);
  for (let i = 1; i <= steps; i++) {
    const p = { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps };
    await touch(cdp, 'touchMove', [p]);
    if (onMove) await onMove(i, p);
  }
  await touch(cdp, end, []);
}

// ------------------------------------------------------------------ mouse suite
async function mouseSuite(browser, vp) {
  const { context, page, errors } = await openDemo(browser, vp);
  const tag = `[${vp.label} mouse]`;
  const scale = await stageScale(page);
  console.log(`${tag} stage scale ${scale.toFixed(3)}`);
  const banana = await centre(page, '#src-banana');
  const honey = await centre(page, '#src-honey');
  const bowl = await centre(page, '#tgt-bowl');
  const customer = await centre(page, '#tgt-customer');
  const nowhere = await client(page, 720, 160);
  const check = (name, fn) => checkWith(name, fn, async () => {
    await page.mouse.up();
    await resetDrag(page);
  });

  await check(`${tag} (1) drag accepted: banana → bowl`, async () => {
    const m = await mark(page);
    await page.mouse.move(banana.x, banana.y);
    await page.mouse.down();
    let s = await snapshot(page);
    assert(s.dragging && s.rootDragging, 'drag did not start on pointerdown');
    assert(s.ghosts === 1, `expected 1 ghost, got ${s.ghosts}`);
    assert(s.dragSource.join() === 'src-banana', `drag-source on ${s.dragSource}`);
    assert(['tgt-customer', 'tgt-bowl', 'tgt-trash'].every((id) => s.dropOk.includes(id)), `drop-ok: ${s.dropOk}`);
    await page.mouse.move(bowl.x, bowl.y, { steps: 10 });
    s = await snapshot(page);
    assert(s.dropHover.join() === 'tgt-bowl', `drop-hover: ${s.dropHover}`);
    await page.mouse.up();
    s = await snapshot(page);
    assert(s.ghosts === 0 || s.ghostClass.includes('is-dropping'), `ghost after accept: ${s.ghostClass}`);
    const evs = await eventsSince(page, m);
    const end = lastEnd(evs);
    assert(end.ok === true && end.target === 'tgt-bowl' && end.id === 'banana', `onEnd ${JSON.stringify(end)}`);
    assert(byType(evs, 'drop')[0].ok === true, 'manager onDrop not ok');
    assert(byType(evs, 'pickup').length === 1 && byType(evs, 'start').length === 1, 'onPickup/onStart missing');
    assert(byType(evs, 'targetDrop').length === 1, 'target drop() not called exactly once');
    assert(await page.evaluate(() => window.__dragDemo.state.bowl.includes('banana')), 'bowl state not updated');
    await settled(page);
  });

  await check(`${tag} (2) drag rejected: banana → customer flies back with reason`, async () => {
    const m = await mark(page);
    await mouseDrag(page, banana, customer);
    const s = await snapshot(page);
    assert(s.ghosts === 1 && s.ghostClass.includes('is-returning'), `ghost should be returning, got ${s.ghostClass}`);
    assert(!s.dragging && !s.rootDragging, 'still dragging after release');
    assert(s.dragSource.join() === 'src-banana', 'source should stay marked until the ghost is home');
    await sleep(130);
    const mid = await snapshot(page);
    if (mid.ghost) {
      const home = await toStagePt(page, banana);
      const cust = await toStagePt(page, customer);
      const dHome = Math.hypot(mid.ghost.x - home.x, mid.ghost.y - home.y);
      const dCust = Math.hypot(mid.ghost.x - cust.x, mid.ghost.y - cust.y);
      assert(dHome < dCust, `ghost is not flying home (home ${dHome.toFixed(0)} vs customer ${dCust.toFixed(0)})`);
    }
    const end = lastEnd(await eventsSince(page, m));
    assert(end.ok === false && end.reason === 'wrongOrder' && end.target === 'tgt-customer', `onEnd ${JSON.stringify(end)}`);
    await settled(page);
  });

  await check(`${tag} (3) drop on nothing / on a non-accepting target`, async () => {
    let m = await mark(page);
    await mouseDrag(page, banana, nowhere);
    let evs = await eventsSince(page, m);
    let end = lastEnd(evs);
    assert(end.ok === false && end.reason === null && end.target === null && !end.tap, `onEnd ${JSON.stringify(end)}`);
    assert(byType(evs, 'targetDrop').length === 0, 'a target drop() was called');
    await settled(page);
    // honey is not accepted by the bowl: no glow, and releasing over it is a drop on nothing
    m = await mark(page);
    await page.mouse.move(honey.x, honey.y);
    await page.mouse.down();
    await page.mouse.move(bowl.x, bowl.y, { steps: 8 });
    const s = await snapshot(page);
    assert(!s.dropOk.includes('tgt-bowl') && !s.dropHover.length, `bowl must not glow for honey: ${s.dropOk}`);
    assert(s.dropOk.includes('tgt-trash'), 'trash should accept honey');
    await page.mouse.up();
    evs = await eventsSince(page, m);
    end = lastEnd(evs);
    assert(end.target === null && end.ok === false && byType(evs, 'targetDrop').length === 0, `onEnd ${JSON.stringify(end)}`);
    await settled(page);
  });

  await check(`${tag} (5) tap detection`, async () => {
    let m = await mark(page);
    await page.mouse.click(banana.x, banana.y);
    let s = await snapshot(page);
    assert(s.ghosts === 0 && !s.dragging, 'tap must remove the ghost at once');
    let evs = await eventsSince(page, m);
    assert(byType(evs, 'tap').length === 1 && byType(evs, 'tap')[0].id === 'banana', 'onTap not called');
    let end = lastEnd(evs);
    assert(end.tap === true && end.ok === false, `onEnd ${JSON.stringify(end)}`);
    assert(byType(evs, 'targetDrop').length === 0, 'tap must not drop');
    // small jitter is still a tap
    m = await mark(page);
    await page.mouse.move(banana.x, banana.y);
    await page.mouse.down();
    await page.mouse.move(banana.x + 3, banana.y + 2);
    await page.mouse.up();
    evs = await eventsSince(page, m);
    assert(byType(evs, 'tap').length === 1, 'jittery tap not detected');
    // slow press is not a tap
    m = await mark(page);
    await page.mouse.move(banana.x, banana.y);
    await page.mouse.down();
    await sleep(380);
    await page.mouse.up();
    evs = await eventsSince(page, m);
    assert(byType(evs, 'tap').length === 0 && lastEnd(evs).tap === false, 'long press counted as tap');
    // moving more than 6 px is not a tap
    m = await mark(page);
    await page.mouse.move(banana.x, banana.y);
    await page.mouse.down();
    await page.mouse.move(banana.x + 12, banana.y, { steps: 2 });
    await page.mouse.up();
    evs = await eventsSince(page, m);
    assert(byType(evs, 'tap').length === 0, 'a 12 px move counted as tap');
    await settled(page);
  });

  await check(`${tag} (6) cancel: blur, visibilitychange, lost capture, dnd.cancel()`, async () => {
    const cancelWith = async (label, trigger) => {
      const m = await mark(page);
      await page.mouse.move(banana.x, banana.y);
      await page.mouse.down();
      await page.mouse.move(customer.x, customer.y, { steps: 6 });
      await trigger();
      const s = await snapshot(page);
      assert(!s.dragging && !s.rootDragging, `${label}: still dragging`);
      await page.mouse.move(bowl.x, bowl.y, { steps: 3 });
      await page.mouse.up();
      const evs = await eventsSince(page, m);
      const end = lastEnd(evs);
      assert(byType(evs, 'cancel').length === 1, `${label}: onCancel not called`);
      assert(end.cancelled === true && end.ok === false, `${label}: onEnd ${JSON.stringify(end)}`);
      assert(byType(evs, 'targetDrop').length === 0, `${label}: dropped after cancel`);
      await settled(page, label);
    };
    await cancelWith('blur', () => page.evaluate(() => window.dispatchEvent(new Event('blur'))));
    await cancelWith('visibilitychange', () => page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.visibilityState;
    }));
    await cancelWith('dnd.cancel()', () => page.evaluate(() => window.__dragDemo.dnd.cancel()));
    // Capture lost once (source) → the drag moves its capture to the root and keeps going;
    // lost again (root) → cancel.
    const release = (sel) => page.evaluate((q) => {
      const el = document.querySelector(q);
      for (const id of [1, 2, 3]) if (el.hasPointerCapture(id)) el.releasePointerCapture(id);
    }, sel);
    await cancelWith('lostpointercapture', async () => {
      await release('#src-banana');
      await page.mouse.move(customer.x + 5, customer.y + 5);
      await page.mouse.move(customer.x + 8, customer.y + 8);
      const s = await snapshot(page);
      assert(s.dragging && s.ghosts === 1, 'first capture loss must not end the drag');
      await release('#stage');
      await page.mouse.move(customer.x + 10, customer.y + 10);
      await page.mouse.move(customer.x + 12, customer.y + 12);
    });
  });

  await check(`${tag} (7) source re-rendered / removed mid-drag`, async () => {
    const granola = await centre(page, '#src-granola');
    let m = await mark(page);
    await page.mouse.move(granola.x, granola.y);
    await page.mouse.down();
    await page.mouse.move((granola.x + bowl.x) / 2, (granola.y + bowl.y) / 2, { steps: 5 });
    await page.evaluate(() => window.__dragDemo.rebuildSource('granola'));
    await page.mouse.move(bowl.x, bowl.y, { steps: 6 });
    let s = await snapshot(page);
    assert(s.dragging && s.dropHover.join() === 'tgt-bowl', 'drag did not survive the re-render');
    await page.mouse.up();
    let end = lastEnd(await eventsSince(page, m));
    assert(end.ok === true && end.id === 'granola' && end.target === 'tgt-bowl', `onEnd ${JSON.stringify(end)}`);
    await settled(page, 're-render');
    // removed for good, released on nothing: flies to the old place and cleans up
    m = await mark(page);
    await page.mouse.move(granola.x, granola.y);
    await page.mouse.down();
    await page.mouse.move(granola.x + 40, granola.y - 60, { steps: 4 });
    await page.evaluate(() => window.__dragDemo.rebuildSource('granola', false));
    await page.mouse.move(nowhere.x, nowhere.y, { steps: 5 });
    await page.mouse.up();
    end = lastEnd(await eventsSince(page, m));
    assert(end.ok === false && end.target === null && end.id === 'granola', `onEnd ${JSON.stringify(end)}`);
    await settled(page, 'removed');
    await page.evaluate(() => window.__dragDemo.rebuildSource('granola'));
    // the fresh element works
    m = await mark(page);
    await mouseDrag(page, await centre(page, '#src-granola'), customer);
    end = lastEnd(await eventsSince(page, m));
    assert(end.ok === true && end.target === 'tgt-customer', `fresh source: ${JSON.stringify(end)}`);
    await settled(page);
  });

  await check(`${tag} (8) ghost stays within 3 stage px of the mouse`, async () => {
    await page.mouse.move(banana.x, banana.y);
    await page.mouse.down();
    for (const [sx, sy] of [[200, 150], [640, 420], [1000, 700], [60, 770], [1260, 90], [430, 600]]) {
      const p = await client(page, sx, sy);
      await page.mouse.move(p.x, p.y, { steps: 3 });
      await frame(page);
      const s = await snapshot(page);
      near(s.ghost, await toStagePt(page, p), 3, `ghost at stage (${sx}, ${sy})`);
    }
    await page.mouse.move(nowhere.x, nowhere.y);
    await page.mouse.up();
    await settled(page);
  });

  await check(`${tag} (9) targets registered / unregistered mid-drag`, async () => {
    await page.evaluate(() => {
      const el = document.createElement('div');
      el.id = 'tgt-extra';
      Object.assign(el.style, { position: 'absolute', left: '700px', top: '110px', width: '140px', height: '120px' });
      document.getElementById('stage').appendChild(el);
    });
    const extra = await centre(page, '#tgt-extra');
    const m = await mark(page);
    await page.mouse.move(banana.x, banana.y);
    await page.mouse.down();
    await page.mouse.move(banana.x + 30, banana.y - 30, { steps: 2 });
    await page.evaluate(() => {
      window.__extraOff = window.__dragDemo.dnd.target(document.getElementById('tgt-extra'), {
        accepts: () => true,
        drop: () => ({ ok: false, reason: 'extra' }),
      });
    });
    let s = await snapshot(page);
    assert(s.dropOk.includes('tgt-extra'), 'target registered mid-drag did not get drop-ok');
    await page.mouse.move(extra.x, extra.y, { steps: 6 });
    await sleep(120); // let the throttled rect refresh pick it up
    await page.mouse.move(extra.x + 2, extra.y + 2);
    s = await snapshot(page);
    assert(s.dropHover.join() === 'tgt-extra', `hover on new target: ${s.dropHover}`);
    await page.evaluate(() => window.__extraOff());
    s = await snapshot(page);
    assert(!s.dropOk.includes('tgt-extra') && !s.dropHover.length, 'unregistered target kept classes');
    await page.mouse.up();
    const end = lastEnd(await eventsSince(page, m));
    assert(end.target === null && end.ok === false, `dropped on unregistered target: ${JSON.stringify(end)}`);
    await page.evaluate(() => document.getElementById('tgt-extra').remove());
    await settled(page);
  });

  await check(`${tag} (10) right button and non-draggable source are ignored`, async () => {
    const m = await mark(page);
    await page.mouse.move(banana.x, banana.y);
    await page.mouse.down({ button: 'right' });
    let s = await snapshot(page);
    assert(!s.dragging && s.ghosts === 0, 'right button started a drag');
    await page.mouse.up({ button: 'right' });
    const kiwi = await centre(page, '#src-kiwi');
    await page.mouse.move(kiwi.x, kiwi.y);
    await page.mouse.down();
    await page.mouse.move(bowl.x, bowl.y, { steps: 4 });
    s = await snapshot(page);
    assert(!s.dragging && s.ghosts === 0, 'payload() === null still dragged');
    await page.mouse.up();
    assert((await eventsSince(page, m)).length === 0, 'events fired for ignored pointers');
  });

  await check(`${tag} (11) prefers-reduced-motion skips the fly-back`, async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mouseDrag(page, banana, customer);
    const s = await snapshot(page);
    assert(s.ghosts === 0 && s.dragSource.length === 0, 'ghost/source class should be gone immediately');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  });

  await check(`${tag} (13) a press resting on a bin right under the bowl never drops into it`, async () => {
    const bin = await binUnderBowl(page);
    try {
      // slow press on the bin's top edge (inside the bowl's padded rect), wiggle along the bin, release
      let m = await mark(page);
      const edge = { x: bin.x, y: bin.top + 3 };
      await page.mouse.move(edge.x, edge.y);
      await page.mouse.down();
      await page.mouse.move(edge.x + 14, edge.y + 2, { steps: 3 });
      await sleep(350);
      let s = await snapshot(page);
      assert(s.dragging && s.dropOk.includes('tgt-bowl'), 'drag not active or bowl not accepting');
      assert(!s.dropHover.length, `drop-hover while the pointer rests on its source: ${s.dropHover}`);
      await page.mouse.up();
      assertSilentReturn(await eventsSince(page, m), 'edge press');
      await settled(page, 'edge press');
      // up into the bowl (hover), back onto the bin (no hover), release there: put back
      m = await mark(page);
      await page.mouse.move(bin.x, bin.y);
      await page.mouse.down();
      await page.mouse.move(bin.x, bin.top - 40 * scale, { steps: 5 });
      s = await snapshot(page);
      assert(s.dropHover.join() === 'tgt-bowl', `over the bowl: drop-hover ${s.dropHover}`);
      await page.mouse.move(bin.x, bin.y, { steps: 5 });
      s = await snapshot(page);
      assert(!s.dropHover.length, `back on the bin: drop-hover ${s.dropHover}`);
      await page.mouse.up();
      assertSilentReturn(await eventsSince(page, m), 'put back');
      await settled(page, 'put back');
      assert(!(await bowlHas(page, 'strawberry')), 'strawberry ended up in the bowl');
      // the bowl stays easy to reach: a short drag just past the bin's edge drops
      m = await mark(page);
      await mouseDrag(page, bin, { x: bin.x, y: bin.top - 10 * scale }, 5);
      const end = lastEnd(await eventsSince(page, m));
      assert(end.ok === true && end.target === 'tgt-bowl' && end.id === 'strawberry', `short drag up: ${JSON.stringify(end)}`);
      assert(await bowlHas(page, 'strawberry'), 'bowl state not updated');
      await settled(page);
    } finally {
      await removeBinUnderBowl(page);
    }
  });

  await check(`${tag} (12) destroy() removes listeners, ghosts and markers`, async () => {
    await page.mouse.move(banana.x, banana.y);
    await page.mouse.down();
    await page.mouse.move(bowl.x, bowl.y, { steps: 4 });
    const m = await mark(page);
    await page.evaluate(() => window.__dragDemo.dnd.destroy());
    let s = await snapshot(page);
    assert(!s.dragging && !s.rootDragging && s.ghosts === 0 && !s.dropOk.length && !s.dragSource.length, 'destroy left drag state');
    await page.mouse.up();
    await mouseDrag(page, banana, bowl);
    s = await snapshot(page);
    assert(s.ghosts === 0 && !s.dragging, 'drag possible after destroy');
    const left = await page.evaluate(() => ({
      attrs: document.querySelectorAll('[data-dnd-source],[data-dnd-target]').length,
      touchAction: document.getElementById('src-banana').style.touchAction,
    }));
    assert(left.attrs === 0 && left.touchAction === '', `markers left: ${JSON.stringify(left)}`);
    assert((await eventsSince(page, m)).length === 0, 'callbacks fired by/after destroy');
  });

  await check(`${tag} no page errors`, async () => {
    assert(errors.length === 0, errors.join('\n'));
  });
  await context.close();
}

// ------------------------------------------------------------------ touch suite
async function touchSuite(browser, vp) {
  const { context, page, cdp, errors } = await openDemo(browser, vp, { touch: true, query: '?scroll=1' });
  const tag = `[${vp.label} touch]`;
  const scale = await stageScale(page);
  const lift = expectedLift(scale);
  console.log(`${tag} stage scale ${scale.toFixed(3)}, touch lift ${lift.toFixed(1)} stage px = ${(lift * scale).toFixed(1)} css px`);
  const banana = await centre(page, '#src-banana');
  const bowl = await centre(page, '#tgt-bowl');
  const scrollY = () => page.evaluate(() => window.scrollY);

  const check = (name, fn) => checkWith(name, fn, async () => {
    await touch(cdp, 'touchCancel', []);
    await resetDrag(page);
  });
  assert(await scrollY() === 0, 'page starts scrolled');

  await check(`${tag} (4) touch drag granola → bowl, ghost lifted, no scroll`, async () => {
    const granola = await centre(page, '#src-granola');
    const m = await mark(page);
    let maxScroll = 0;
    await touchDrag(page, cdp, granola, bowl, {
      steps: 14,
      onMove: async (i, p) => {
        maxScroll = Math.max(maxScroll, await scrollY());
        if (i === 7 || i === 14) {
          await frame(page);
          const s = await snapshot(page);
          assert(s.dragging && s.rootDragging, 'touch drag not active');
          const f = await toStagePt(page, p);
          near(s.ghost, { x: f.x, y: f.y - lift }, 3, `touch ghost at step ${i}`);
        }
      },
    });
    const evs = await eventsSince(page, m);
    const end = lastEnd(evs);
    assert(end.ok === true && end.target === 'tgt-bowl' && end.id === 'granola', `onEnd ${JSON.stringify(end)}`);
    assert(end.pointerType === 'touch', `pointerType ${end.pointerType}`);
    await sleep(200);
    maxScroll = Math.max(maxScroll, await scrollY());
    assert(maxScroll === 0, `page scrolled by ${maxScroll}px during a touch drag`);
    await settled(page);
  });

  await check(`${tag} (4b) vertical touch drag on a source never scrolls`, async () => {
    const m = await mark(page);
    const honey = await centre(page, '#src-honey'); // straight above honey is empty wall
    const top = await client(page, 0, 150);
    await touchDrag(page, cdp, honey, { x: honey.x, y: top.y }, { steps: 10 });
    await touchDrag(page, cdp, honey, { x: honey.x, y: vp.height - 2 }, { steps: 6 });
    await sleep(200);
    const y = await scrollY();
    assert(y === 0, `page scrolled by ${y}px`);
    const ends = byType(await eventsSince(page, m), 'end');
    assert(ends.length === 2 && ends.every((e) => !e.ok && !e.target), `ends ${JSON.stringify(ends)}`);
    await settled(page);
  });

  await check(`${tag} (5) touch tap`, async () => {
    const m = await mark(page);
    await touch(cdp, 'touchStart', [banana]);
    await touch(cdp, 'touchEnd', []);
    const evs = await eventsSince(page, m);
    assert(byType(evs, 'tap').length === 1, 'onTap not called for a touch tap');
    const end = lastEnd(evs);
    assert(end.tap && end.pointerType === 'touch', `onEnd ${JSON.stringify(end)}`);
    const s = await snapshot(page);
    assert(s.ghosts === 0, 'ghost left after tap');
  });

  await check(`${tag} (6) pointercancel mid-drag (touchCancel)`, async () => {
    const m = await mark(page);
    let mid = null;
    await touchDrag(page, cdp, banana, bowl, {
      steps: 6,
      end: 'touchCancel',
      onMove: async (i) => {
        if (i === 6) mid = await snapshot(page);
      },
    });
    assert(mid?.dragging && mid.dropHover.join() === 'tgt-bowl', 'drag was not active over the bowl');
    const s = await snapshot(page);
    assert(!s.dragging && (s.ghosts === 0 || s.ghostClass.includes('is-returning')), `after cancel ${JSON.stringify(s)}`);
    const evs = await eventsSince(page, m);
    const end = lastEnd(evs);
    assert(byType(evs, 'cancel').length === 1 && end.cancelled === true, `onEnd ${JSON.stringify(end)}`);
    assert(byType(evs, 'targetDrop').length === 0, 'dropped despite pointercancel');
    await settled(page);
  });

  await check(`${tag} (7) source re-rendered mid touch-drag`, async () => {
    const granola = await centre(page, '#src-granola');
    const m = await mark(page);
    await touchDrag(page, cdp, granola, bowl, {
      steps: 12,
      onMove: async (i) => {
        if (i === 4) await page.evaluate(() => window.__dragDemo.rebuildSource('granola'));
      },
    });
    const end = lastEnd(await eventsSince(page, m));
    assert(end.ok === true && end.target === 'tgt-bowl', `onEnd ${JSON.stringify(end)}`);
    await settled(page);
  });

  await check(`${tag} (9) a second finger is ignored while dragging`, async () => {
    const granola = await centre(page, '#src-granola');
    const m = await mark(page);
    const f1 = { ...banana, id: 1 };
    const f2 = { ...granola, id: 2 };
    await touch(cdp, 'touchStart', [f1]);
    await touch(cdp, 'touchStart', [f1, f2]);
    for (let i = 1; i <= 8; i++) {
      const p = { x: banana.x + ((bowl.x - banana.x) * i) / 8, y: banana.y + ((bowl.y - banana.y) * i) / 8, id: 1 };
      await touch(cdp, 'touchMove', [p, { x: granola.x + i * 4, y: granola.y - i * 6, id: 2 }]);
    }
    let s = await snapshot(page);
    assert(s.ghosts === 1 && s.dragSource.join() === 'src-banana', `second finger started a drag: ${s.dragSource}`);
    await touch(cdp, 'touchMove', [{ x: granola.x + 40, y: granola.y - 50, id: 2 }]); // finger 1 lifts
    await touch(cdp, 'touchEnd', []);
    const evs = await eventsSince(page, m);
    assert(byType(evs, 'pickup').length === 1, `${byType(evs, 'pickup').length} pickups`);
    const end = lastEnd(evs);
    assert(end.id === 'banana' && end.ok && end.target === 'tgt-bowl', `onEnd ${JSON.stringify(end)}`);
    s = await snapshot(page);
    assert(s.scrollY === 0, 'page scrolled');
    await settled(page);
  });

  await check(`${tag} (10) hold, sloppy press or put back on a bin right under the bowl never drops into it`, async () => {
    const bin = await binUnderBowl(page);
    try {
      // the fixture must set the trap: a finger resting on the bin has its lifted ghost over the bowl
      const trap = await page.evaluate(([x, y, l]) => {
        const r = document.getElementById('tgt-bowl').getBoundingClientRect();
        const p = window.__dragDemo.toStage(x, y);
        return p.y - l <= window.__dragDemo.toStage(r.left, r.bottom).y + 18;
      }, [bin.x, bin.y, lift]);
      assert(trap, 'fixture: the lifted ghost of a finger on the bin centre is not over the bowl');
      // (a) stationary long press
      let m = await mark(page);
      await touch(cdp, 'touchStart', [bin]);
      await sleep(450);
      let s = await snapshot(page);
      assert(s.dragging && s.ghosts === 1 && s.dropOk.includes('tgt-bowl'), 'long press did not pick up the strawberry');
      assert(!s.dropHover.length, `drop-hover while the finger rests on the bin: ${s.dropHover}`);
      await touch(cdp, 'touchEnd', []);
      assertSilentReturn(await eventsSince(page, m), 'long press');
      await settled(page, 'long press');
      // (b) sloppy, slow press: 10 css px of wobble over 400 ms
      m = await mark(page);
      await touch(cdp, 'touchStart', [bin]);
      await sleep(150);
      await touch(cdp, 'touchMove', [{ x: bin.x + 6, y: bin.y - 8 }]);
      await sleep(250);
      await touch(cdp, 'touchEnd', []);
      assertSilentReturn(await eventsSince(page, m), 'sloppy press');
      await settled(page, 'sloppy press');
      // (c) pick up, off the bin sideways (the ghost now hovers the bowl), back onto the bin, release
      m = await mark(page);
      const away = { x: bin.x + 120 * scale, y: bin.y };
      await touch(cdp, 'touchStart', [bin]);
      for (let i = 1; i <= 6; i++) await touch(cdp, 'touchMove', [{ x: bin.x + ((away.x - bin.x) * i) / 6, y: bin.y }]);
      s = await snapshot(page);
      assert(s.dropHover.join() === 'tgt-bowl', `off the bin: drop-hover ${s.dropHover}`);
      for (let i = 5; i >= 0; i--) await touch(cdp, 'touchMove', [{ x: bin.x + ((away.x - bin.x) * i) / 6, y: bin.y }]);
      s = await snapshot(page);
      assert(!s.dropHover.length, `back on the bin: drop-hover ${s.dropHover}`);
      await touch(cdp, 'touchEnd', []);
      assertSilentReturn(await eventsSince(page, m), 'put back');
      await settled(page, 'put back');
      assert(!(await bowlHas(page, 'strawberry')), 'strawberry ended up in the bowl');
      // (d) the bowl stays easy to reach: a short drag just past the bin's top edge drops
      m = await mark(page);
      await touchDrag(page, cdp, bin, { x: bin.x, y: bin.top - 10 * scale }, { steps: 6 });
      const end = lastEnd(await eventsSince(page, m));
      assert(end.ok === true && end.target === 'tgt-bowl' && end.id === 'strawberry', `short drag up: ${JSON.stringify(end)}`);
      assert(await bowlHas(page, 'strawberry'), 'bowl state not updated');
      await settled(page);
    } finally {
      await removeBinUnderBowl(page);
    }
  });

  // Proves the no-scroll checks above are meaningful: the same gesture outside the stage scrolls.
  await check(`${tag} control: a touch pan outside the stage does scroll this page`, async () => {
    await touchDrag(page, cdp, { x: 8, y: vp.height - 60 }, { x: 8, y: 120 }, { steps: 10 });
    await sleep(250);
    const y = await scrollY();
    assert(y > 20, `page did not scroll (scrollY ${y}) – the no-scroll checks would be meaningless`);
  });

  await check(`${tag} no page errors`, async () => {
    assert(errors.length === 0, errors.join('\n'));
  });
  await context.close();
}

// ------------------------------------------------------------------ phone
// On a phone-sized stage 48 css px would be > 100 stage px; the lift is capped so the trash at the
// stage's bottom edge stays reachable.
async function phoneLiftSuite(browser) {
  const vp = { width: 844, height: 390, label: '844×390' };
  const { context, page, cdp, errors } = await openDemo(browser, vp, { touch: true });
  const tag = `[${vp.label} touch]`;
  await checkWith(`${tag} touch lift is capped at ${LIFT_MAX} stage px`, async () => {
    const scale = await stageScale(page);
    assert(LIFT_CSS / scale > LIFT_MAX, `stage scale ${scale.toFixed(3)} does not reach the cap`);
    const banana = await centre(page, '#src-banana');
    const p = { x: banana.x + 30, y: banana.y - 40 };
    await touch(cdp, 'touchStart', [banana]);
    for (let i = 1; i <= 4; i++) await touch(cdp, 'touchMove', [{ x: banana.x + (30 * i) / 4, y: banana.y - (40 * i) / 4 }]);
    await frame(page);
    const s = await snapshot(page);
    const f = await toStagePt(page, p);
    near(s.ghost, { x: f.x, y: f.y - LIFT_MAX }, 3, 'phone touch ghost');
    await touch(cdp, 'touchEnd', []);
    await settled(page);
  }, async () => {
    await touch(cdp, 'touchCancel', []);
    await resetDrag(page);
  });
  await checkWith(`${tag} no page errors`, async () => {
    assert(errors.length === 0, errors.join('\n'));
  });
  await context.close();
}

// ------------------------------------------------------------------ main
let server = null;
let browser = null;
try {
  server = await startServer();
  browser = await chromium.launch();
  for (const vp of VIEWPORTS) {
    await mouseSuite(browser, vp);
    await touchSuite(browser, vp);
  }
  await phoneLiftSuite(browser);
} catch (err) {
  results.push({ name: 'harness', ok: false, err });
  console.error(err);
} finally {
  await browser?.close();
  server?.kill();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
