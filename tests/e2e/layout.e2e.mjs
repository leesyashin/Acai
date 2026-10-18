// E2E check of the gameplay screen layout (docs/DESIGN.md §4.7) through tools/game-harness.html:
// every station the player drags from or onto lies fully on the 1280×800 stage, below the pass (never
// over the guests), is at least 64 × 64 stage px and does not overlap another station – in the fullest
// kitchen (4 seats, 2 blenders, 4 cups, all 16 ingredients, 2 machine slots) as well as in small ones,
// with and without WebGL. The layer names on the freezer and the risers and the ingredients' name tags stay
// uncovered (a tall container of the front row reaches up in front of the riser behind it, its names are drawn
// over it), a "NEU" badge sticking up from a container is drawn over the riser behind it but leaves the layer
// name there readable, and no badge hides an ingredient's quality stars or layer badge. A press on a cup's content chips
// lifts that cup. Guests with the longest orders get order bubbles that stay on the stage below the HUD, apart from
// each other and above the guests' faces, clear of the bought neon sign (which hangs on the wall, not in the window);
// a bowl or a glass dropped on any part of a bubble (its base cup, its drink) is served to that guest and flies into
// the guest, a pack let go there gets the guest's hint.
// Run: node tests/e2e/layout.e2e.mjs   (serves the repo on :8090, exits non-zero on failure)

import path from 'node:path';
import { startServer, launchBrowser, collectConsoleErrors, assertNoConsoleErrors, dragBetween, e2eOutDir, STAGE_W, STAGE_H } from './helpers.mjs';

const PORT = Number(process.env.E2E_PORT) || 8090;
const OUT = e2eOutDir('layout');
const MIN = 64; // stage px (DESIGN §4.7: tablet fingers)
const PASS_TOP = 294; // stage y of the pass: the guests and their bubbles are above it
const STATIONS = '[data-blender], [data-pack], [data-cup-stack], [data-bowl], [data-bin], [data-matcha-slot], [data-trash]';
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
  const name = (el) => ['blender', 'pack', 'cupStack', 'bowl', 'bin', 'matchaSlot', 'trash']
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

const ALL = { blender: 2, pack: 3, cupStack: 1, bowl: 4, bin: 13, matchaSlot: 2, trash: 1 };
const CASES = [
  { name: 'fullest kitchen (level 14, everything owned and upgraded)', query: 'level=14&owned=all&upgrades=max&seed=4', want: ALL, shot: 'fullest' },
  { name: 'fullest kitchen at 1024×768', query: 'level=14&owned=all&upgrades=max&seed=4', want: ALL, viewport: { width: 1024, height: 768 } },
  { name: 'fullest kitchen without WebGL', query: 'level=14&owned=all&upgrades=max&seed=4', want: ALL, noWebgl: true, shot: 'fullest-svg' },
  { name: 'level 1 (1 blender, 2 cups, 4 ingredients)', query: 'level=1&fresh=1&seed=3', want: { blender: 1, pack: 1, cupStack: 1, bowl: 2, bin: 3, matchaSlot: 0, trash: 1 }, shot: 'level1' },
  { name: 'level 5 (3 seats, locked machine)', query: 'level=5&fresh=1&seed=11', want: { blender: 1, bowl: 2, matchaSlot: 0, trash: 1 }, shot: 'level5' },
  { name: 'endless with the one-slot machine', query: 'mode=endless&fresh=1&seed=9', want: { matchaSlot: 1, trash: 1 } },
];
// Order bubbles (DESIGN §4.7): guests with the longest orders (3 fruits/crunch, 3 toppings and a matcha), one of them
// with the bowl already handed over. The bubbles stay on the stage (x 6–1274) below the HUD (its bottom at y 66), keep ≥ 8 px between each other, end above the guests' hair (only the tail reaches down to the
// crown, the faces stay clear) and point their tail at their guest's head; with 4 seats they are spread evenly over the
// stage (the same gap between each two), with 3 they are centred on their guests. Their icons are ≥ 38 px, a delivered
// part shows its big tick. The neon sign (bought) hangs clear of every bubble and guest, on the wall (not in the
// window: glass).
const BUBBLE_EDGE = 6;
const BUBBLE_GAP = 8;
const HUD_H = 66; // the HUD's bottom: the bubbles start under it
const BUBBLE_BOTTOM = 180; // the tallest hair (a bun, an afro, an angry guest's steam) begins at y≈175–178, the faces at y≈205
const ICON_MIN = 38;
const LONGEST = [
  { base: 'acai', mid: ['banana', 'strawberry', 'granola'], top: ['honey', 'coconut', 'chia'], matcha: 'kiwi' },
  { base: 'pitaya', mid: ['blueberry', 'mango', 'kiwi'], top: ['peanut', 'chocolate', 'mint'], matcha: 'strawberry' },
  { base: 'spirulina', mid: ['granola', 'kiwi', 'banana'], top: ['cacao', 'honey', 'coconut'], matcha: 'blueberry' },
  { base: 'acai', mid: ['mango', 'strawberry', 'blueberry'], top: ['chocolate', 'chia', 'mint'], matcha: 'mango' },
];
const BUBBLE_CASES = [
  { name: '4 seats', query: 'level=14&owned=all&upgrades=max&seed=4', seats: 4, even: true, drops: true },
  { name: '4 seats at 1024×768', query: 'level=14&owned=all&upgrades=max&seed=4', seats: 4, even: true, viewport: { width: 1024, height: 768 } },
  { name: '3 seats', query: 'level=10&owned=all&upgrades=max&seed=4', seats: 3, centred: true },
  { name: '2 seats', query: 'level=4&owned=all&upgrades=max&seed=4', seats: 2, centred: true },
];
// the neon sign's board in its picture (js/art-kitchen.js DECOR.neon: viewBox 120, the board at 8, 30, 104 × 62)
const NEON_BOARD = { x1: 8 / 120, y1: 30 / 120, x2: 112 / 120, y2: 92 / 120 };
// the window's opening in the back wall (js/art-kitchen.js WIN): glass, no place to hang the sign
const WINDOW = { x1: 351, y1: 78, x2: 729, y2: 232 };

// Every seated guest has its bubble, popped in (and slid into place, js/game-view.js bubbleShift): no animation of
// theirs runs any more.
const bubblesSettled = (page) => page.waitForFunction(() => window.__acaiGame.seats.every((c) => !c || document.querySelector(`[data-customer-id="${c.id}"] .g-bubble`))
  && [...document.querySelectorAll('.g-bubble')].every((b) => b.getAnimations({ subtree: true }).every((a) => a.playState === 'finished')));

// Seats every guest anew with one of the longest orders (new ids: the view builds new bubbles), patient enough to
// stay happy (an angry bubble wobbles); the second one has its bowl already.
const seatLongestOrders = (page) => page.evaluate((orders) => {
  const g = window.__acaiGame;
  g.seats.forEach((c, i) => {
    const o = orders[i % orders.length];
    g.seats[i] = {
      id: 9000 + i, seat: i, look: { seed: 31 + i * 17 },
      order: { bowl: { base: o.base, mid: o.mid.slice(), top: o.top.slice() }, matcha: o.matcha },
      delivered: { bowl: i === 1, matcha: false },
      patience: 999, maxPatience: 999, state: 'waiting', t: 1, mood: 'happy', paid: 0,
    };
  });
}, LONGEST);

// Each bubble's box (without its tail), where its tail points and its guest's head is, its icons' sizes and its
// delivered parts' ticks, in stage px.
const measureBubbles = (page) => page.evaluate(() => {
  const st = document.getElementById('stage').getBoundingClientRect();
  const k = 1280 / st.width;
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { x1: (r.left - st.left) * k, y1: (r.top - st.top) * k, x2: (r.right - st.left) * k, y2: (r.bottom - st.top) * k };
  };
  const size = (el) => {
    const b = box(el);
    return Math.min(b.x2 - b.x1, b.y2 - b.y1);
  };
  const neon = document.querySelector('.g-decor-neon svg');
  return {
    hud: box(document.querySelector('.g-hud')),
    neon: neon && box(neon),
    figures: [...document.querySelectorAll('[data-customer-id] .g-figure')].map(box),
    bubbles: [...document.querySelectorAll('[data-customer-id]')].map((cust) => {
      const b = cust.querySelector('.g-bubble');
      const r = b.getBoundingClientRect();
      const fig = box(cust.querySelector('.g-figure'));
      return {
        id: cust.dataset.customerId,
        ...box(b),
        // the tail's centre: its CSS left (stage px, like the border) from the bubble's padding box
        tail: (r.left - st.left) * k + b.clientLeft + parseFloat(getComputedStyle(b, '::after').left),
        head: (fig.x1 + fig.x2) / 2,
        icons: [...b.querySelectorAll('.g-ico svg, .g-order-base > svg, .g-drink-wrap > svg')].map(size),
        ticks: [...b.querySelectorAll('.is-done > .g-check svg')].map(size),
      };
    }),
  };
});

function assertBubbles({ hud, neon, figures, bubbles }, { seats, centred, even }) {
  assert(bubbles.length === seats, `${seats} bubbles expected, found ${bubbles.length}`);
  const bad = [];
  const at = (b) => `bubble of guest ${b.id} [${[b.x1, b.y1, b.x2, b.y2].map((v) => v.toFixed(1)).join(', ')}]`;
  const meets = (a, b) => Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1) > 0.5 && Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1) > 0.5;
  if (hud.y2 > HUD_H + 0.5) bad.push(`the HUD reaches down to y ${hud.y2.toFixed(1)}, the bubbles start at y ${HUD_H}`);
  bubbles.sort((a, b) => a.x1 - b.x1);
  const gaps = bubbles.slice(1).map((b, i) => b.x1 - bubbles[i].x2);
  if (even && Math.max(...gaps) - Math.min(...gaps) > 1.5) bad.push(`bubbles not spread evenly: gaps ${gaps.map((g) => g.toFixed(1)).join(', ')} px`);
  bubbles.forEach((b, i) => {
    if (b.x1 < BUBBLE_EDGE - 0.5 || b.x2 > STAGE_W - BUBBLE_EDGE + 0.5) bad.push(`${at(b)} leaves the stage`);
    if (b.y1 < HUD_H - 0.5) bad.push(`${at(b)} reaches up into the HUD (y < ${HUD_H})`);
    if (b.y2 > BUBBLE_BOTTOM + 0.5) bad.push(`${at(b)} reaches down over the guests' hair (y > ${BUBBLE_BOTTOM})`);
    if (Math.abs(b.tail - b.head) > 1.5) bad.push(`${at(b)}: its tail (x ${b.tail.toFixed(1)}) misses the head (x ${b.head.toFixed(1)})`);
    if (centred && Math.abs((b.x1 + b.x2) / 2 - b.head) > 1.5) bad.push(`${at(b)} is not centred on its guest (x ${b.head.toFixed(1)})`);
    const next = bubbles[i + 1];
    if (next && next.x1 - b.x2 < BUBBLE_GAP - 0.5) bad.push(`${at(b)} and ${at(next)} are ${(next.x1 - b.x2).toFixed(1)} px apart`);
    const small = b.icons.filter((s) => s < ICON_MIN - 0.5);
    if (b.icons.length < 8 || small.length) bad.push(`${at(b)}: 8 icons ≥ ${ICON_MIN} px expected, got ${b.icons.map((s) => s.toFixed(1)).join(', ')}`);
  });
  const ticks = bubbles.flatMap((b) => b.ticks);
  if (ticks.length !== 1 || ticks[0] < 36 - 0.5) bad.push(`one tick ≥ 36 px on the delivered bowl expected, got ${ticks.map((s) => s.toFixed(1)).join(', ') || 'none'}`);
  if (!neon) bad.push('no neon sign (bought with upgrades=max)');
  else {
    const w = neon.x2 - neon.x1;
    const h = neon.y2 - neon.y1;
    const board = { x1: neon.x1 + w * NEON_BOARD.x1, y1: neon.y1 + h * NEON_BOARD.y1, x2: neon.x1 + w * NEON_BOARD.x2, y2: neon.y1 + h * NEON_BOARD.y2 };
    const at3 = `the neon sign [${[board.x1, board.y1, board.x2, board.y2].map((v) => v.toFixed(1)).join(', ')}]`;
    for (const b of bubbles) if (meets(board, b)) bad.push(`${at(b)} covers ${at3}`);
    if (figures.some((f) => meets(board, f))) bad.push(`${at3} hangs behind a guest`);
    if (meets(board, WINDOW)) bad.push(`${at3} hangs in the window, on the glass`);
  }
  assert(bad.length === 0, bad.join('\n'));
}

// Drops a ready glass of seat 3's matcha on the middle of its bubble's drink part and a bowl of seat 0's order on its
// bubble's base cup – both outside the guests' own boxes – with real mouse drags: both are served, and each ghost
// shrinks into its guest (drag.js land: the middle of the guest's figure, not of the rect around guest and bubble).
const LAND_TOL = 12; // stage px: the guest's idle bob and its grow while hovered
async function dropOnBubbles(page) {
  await page.evaluate((orders) => {
    const g = window.__acaiGame;
    const o = orders[0];
    Object.assign(g.bowls[0], { cup: true, base: o.base, mid: o.mid.slice(), top: o.top.slice() });
    g.matcha.slots[0] = { state: 'ready', fruit: orders[3].matcha, t: 0, duration: 1, progress: 1 };
  }, LONGEST);
  await page.waitForFunction(() => document.querySelector('[data-bowl="0"]').dataset.state !== 'nocup');
  await sleep(200);
  const outside = (sel, cust) => page.evaluate(([s, id]) => {
    const r = document.querySelector(`[data-customer-id="${id}"] ${s}`).getBoundingClientRect();
    const g = document.querySelector(`[data-customer-id="${id}"]`).getBoundingClientRect();
    const x = r.left + r.width / 2;
    return { x, y: r.top + r.height / 2, outside: x < g.left || x > g.right };
  }, [sel, cust]);
  const drink = await outside('[data-part="matcha"]', 9003);
  const base = await outside('.g-order-base', 9000);
  assert(drink.outside && base.outside, `the drink part of seat 3 and the base cup of seat 0 should lie outside their guests' boxes (${drink.outside}, ${base.outside})`);
  // where the accepted ghosts shrink into: drag.js moves a dropping ghost there at once (its transform, from the ghost
  // layer's origin)
  await page.evaluate(() => {
    window.__lands = [];
    new MutationObserver((ms) => {
      for (const { target: w } of ms) {
        if (!w.classList.contains('is-dropping') || w.landSeen) continue;
        w.landSeen = true;
        const [, x, y] = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(w.style.transform) || [];
        window.__lands.push({ x: Number(x), y: Number(y) });
      }
    }).observe(document.querySelector('.screen-game .ghost-layer'), { subtree: true, attributes: true, attributeFilter: ['class'] });
  });
  await dragBetween(page, '[data-matcha-slot="0"]', drink);
  await dragBetween(page, '[data-bowl="0"]', base);
  await sleep(200);
  const served = await page.evaluate(() => {
    const g = window.__acaiGame;
    return { matcha: g.seats[3].delivered.matcha, bowl: g.seats[0].delivered.bowl };
  });
  assert(served.matcha && served.bowl, `glass dropped on seat 3's drink part served: ${served.matcha}; bowl dropped on seat 0's base cup served: ${served.bowl}`);
  const { lands, figs } = await page.evaluate(() => {
    const st = document.getElementById('stage').getBoundingClientRect();
    const k = 1280 / st.width;
    const l = document.querySelector('.screen-game .ghost-layer').getBoundingClientRect();
    const mid = (el) => {
      const r = el.getBoundingClientRect();
      return { x: ((r.left + r.right) / 2 - st.left) * k, y: ((r.top + r.bottom) / 2 - st.top) * k };
    };
    return {
      lands: window.__lands.map((p) => ({ x: p.x + (l.left - st.left) * k, y: p.y + (l.top - st.top) * k })),
      figs: [9003, 9000].map((id) => mid(document.querySelector(`[data-customer-id="${id}"] .g-figure`))),
    };
  });
  const pt = (p) => `(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`;
  assert(lands.length === 2, `2 accepted ghosts expected, saw ${lands.length}`);
  lands.forEach((p, i) => assert(Math.hypot(p.x - figs[i].x, p.y - figs[i].y) <= LAND_TOL,
    `the ${['glass', 'bowl'][i]} shrinks into ${pt(p)}, not into its guest ${pt(figs[i])}`));
}

// A pack let go on the drink part of seat 3's bubble (beside the guest) bounces back with the guest's hint: the view
// hit-tests the guest with its bubble, like the drop target.
async function hintOnBubble(page) {
  await page.evaluate(() => document.querySelector('.g-fx .g-toast')?.remove());
  const at = await page.evaluate(() => {
    const r = document.querySelector('[data-customer-id="9003"] [data-part="matcha"]').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await dragBetween(page, '[data-pack="acai"]', at);
  const want = await page.evaluate(async () => (await import('/js/i18n.js')).t('game.hint.pack'));
  await page.waitForFunction((w) => document.querySelector('.g-fx .g-toast.at-guest')?.textContent === w, want, { timeout: 3000 })
    .catch(async () => {
      const got = await page.evaluate(() => document.querySelector('.g-fx .g-toast')?.textContent || 'no toast');
      throw new Error(`a pack let go on a bubble: the guest's hint "${want}" expected, got "${got}"`);
    });
}

// A press on any of a cup's content chips (7 of them, the rows at their widest) – its middle and just inside its left,
// right and bottom edge – lifts that cup, also where the chips reach below its box (over the raised hit area of the
// row in front); the chips stay within the cup's width, so they never take a press from the neighbour.
const chipPresses = (page) => page.evaluate(() => {
  const g = window.__acaiGame;
  for (const bw of g.bowls) Object.assign(bw, { cup: true, base: 'acai', mid: ['banana', 'kiwi', 'granola'], top: ['honey', 'chia', 'mint'] });
  return new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const wrong = [];
    for (const cup of document.querySelectorAll('[data-bowl]')) {
      const r = cup.getBoundingClientRect();
      const chips = [...cup.querySelectorAll('.g-chip')];
      if (chips.length !== 7) wrong.push(`cup ${cup.dataset.bowl}: 7 chips expected`);
      chips.forEach((chip, i) => {
        const c = chip.getBoundingClientRect();
        const at = `cup ${cup.dataset.bowl}, chip ${i + 1}`;
        if (c.left < r.left - 0.5 || c.right > r.right + 0.5) wrong.push(`${at} reaches out of the cup's width`);
        const mx = c.left + c.width / 2;
        const my = c.top + c.height / 2;
        for (const [x, y, where] of [[mx, my, 'middle'], [c.left + 3, my, 'left edge'], [c.right - 3, my, 'right edge'], [mx, c.bottom - 3, 'bottom edge']]) {
          const hit = document.elementFromPoint(x, y)?.closest('[data-bowl]');
          if (hit !== cup) wrong.push(`${at}, its ${where} → ${hit ? `cup ${hit.dataset.bowl}` : 'no cup'}`);
        }
      });
    }
    done(wrong);
  })));
});

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
        if (c.want.bowl) {
          await check(`${c.name}: a press on a cup's content chips lifts that cup, not its neighbour`, async () => {
            const wrong = await chipPresses(page);
            assert(wrong.length === 0, wrong.join('\n'));
          });
        }
        await check(`${c.name}: no console errors`, async () => assertNoConsoleErrors(errors, c.name));
      } finally {
        await close();
      }
    }
    for (const c of BUBBLE_CASES) {
      const { page, errors, close } = await open(srv, c.query, c);
      try {
        await check(`order bubbles, ${c.name}, longest orders: on the stage below the HUD, apart, above the hair, tails on the heads, icons ≥ ${ICON_MIN} px`, async () => {
          await page.waitForFunction((n) => window.__acaiGame.seats.length === n, c.seats);
          await seatLongestOrders(page);
          await bubblesSettled(page);
          if (!c.viewport) await page.screenshot({ path: path.join(OUT, `bubbles-${c.seats}.png`) });
          assertBubbles(await measureBubbles(page), c);
        });
        if (c.drops) {
          await check(`order bubbles, ${c.name}: a pack let go on a bubble's drink part gets the guest's hint`, () => hintOnBubble(page));
          await check(`order bubbles, ${c.name}: a glass dropped on a bubble's drink part, a bowl on its base cup is served and flies into the guest`, () => dropOnBubbles(page));
        }
        await check(`order bubbles, ${c.name}: no console errors`, async () => assertNoConsoleErrors(errors, `bubbles ${c.name}`));
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
