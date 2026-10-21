// E2E check of the game on a phone held sideways (docs/DESIGN.md §4.1, §4.3, §4.7): at 844×390 and 932×430 (touch,
// mobile) html.is-phone is set, the page neither scrolls nor zooms, the work area is arranged across the window and
// scaled up (js/kitchen-layout.js: .screen-game.is-phone-layout, every station on screen, none over another, a first
// level's containers ≥ 60 css px and cups ≥ 75, the fullest kitchen's ≥ 40 / ≥ 55) and the small print (name tags,
// layer labels) is drawn ≥ 8 css px tall. The shop scene is scaled up about the pass and the HUD stands beside it in
// the window's bands, under the bubbles and clear of the guests and the pass, the pause button ≥ 30 css px. Filling a cup by touch lifts only the blender's jug: the base stays in full
// view (without its jug) while the jug is carried, the cup gets the purée and the jug stands on its base again. A
// tablet (1280×800, mouse) is no phone.
// Run: node tests/e2e/mobile.e2e.mjs   (serves the repo on a free port, exits non-zero on failure)

import path from 'node:path';
import {
  startServer, launchBrowser, collectConsoleErrors, assertNoConsoleErrors, dragBetween, pinch, e2eOutDir,
} from './helpers.mjs';

const OUT = e2eOutDir('mobile');
const PHONES = [{ width: 844, height: 390 }, { width: 932, height: 430 }];
const STATIONS = '[data-blender], [data-pack], [data-cup-stack], [data-bowl], [data-bin], [data-matcha-slot], [data-trash]';
const MIN_CSS = 30; // css px: a 64 stage px station at the phone's scale (≈ 0.49)
const MIN_TEXT = 8; // css px of a letter's em box
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

async function open(srv, query, { viewport, touch = true }) {
  const b = await launchBrowser({ fonts: 'stub', viewport, touch, isMobile: touch });
  const errors = collectConsoleErrors(b.page);
  await b.page.goto(`${srv.url}tools/game-harness.html?mute=1&log=0&tutorial=0&${query}`);
  await b.page.waitForFunction(() => !!window.__acaiGame && !!document.querySelector('.screen-game'));
  await sleep(300);
  return { ...b, errors };
}

// one finger: down on `from`, moved onto `to`, then `during` runs while the finger still holds the jug
async function touchHold(page, from, to, during) {
  const box = async (s) => page.locator(s).first().boundingBox();
  const a = await box(from);
  const b = await box(to);
  const p0 = { x: a.x + a.width / 2, y: a.y + a.height / 3 };
  const p1 = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  const cdp = await page.context().newCDPSession(page);
  const pt = (p) => [{ x: p.x, y: p.y, id: 1, radiusX: 8, radiusY: 8, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(p0) });
  for (let i = 1; i <= 10; i++) {
    await sleep(16);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt({ x: p0.x + ((p1.x - p0.x) * i) / 10, y: p0.y + ((p1.y - p0.y) * i) / 10 }) });
  }
  await sleep(200);
  const seen = await during();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  return seen;
}

async function main() {
  const srv = await startServer({ port: 0 });
  try {
    for (const viewport of PHONES) {
      const tag = `${viewport.width}×${viewport.height}`;
      const b = await open(srv, 'level=45&owned=all&upgrades=max', { viewport });
      const { page } = b;
      try {
        await check(`${tag}: a phone – no scrolling, the stage and every station on screen and big enough`, async () => {
          const m = await page.evaluate((sel) => {
            const se = document.scrollingElement;
            const st = document.getElementById('stage').getBoundingClientRect();
            return {
              phone: document.documentElement.classList.contains('is-phone'),
              scroll: [se.scrollWidth, se.scrollHeight, innerWidth, innerHeight],
              stage: [st.left, st.top, st.right, st.bottom],
              stations: [...document.querySelectorAll(sel)].map((el) => {
                const r = el.getBoundingClientRect();
                return { name: el.outerHTML.slice(0, 60), x1: r.left, y1: r.top, x2: r.right, y2: r.bottom };
              }),
            };
          }, STATIONS);
          assert(m.phone, 'html.is-phone is not set');
          const [sw, sh, w, h] = m.scroll;
          assert(sw <= w && sh <= h, `page scrolls: ${sw}×${sh} in ${w}×${h}`);
          const [l, t, r, bt] = m.stage;
          assert(l >= -0.5 && t >= -0.5 && r <= w + 0.5 && bt <= h + 0.5, `stage [${m.stage.map(Math.round)}] off the ${w}×${h} window`);
          assert(m.stations.length > 30, `only ${m.stations.length} stations`);
          for (const s of m.stations) {
            assert(s.x1 >= -0.5 && s.y1 >= -0.5 && s.x2 <= w + 0.5 && s.y2 <= h + 0.5, `${s.name} off screen`);
            assert(s.x2 - s.x1 >= MIN_CSS && s.y2 - s.y1 >= MIN_CSS, `${s.name} only ${(s.x2 - s.x1).toFixed(1)}×${(s.y2 - s.y1).toFixed(1)} css px`);
          }
        });

        await check(`${tag}: the work area across the window, scaled up, no station over another`, async () => {
          const m = await page.evaluate((sel) => {
            const screen = document.querySelector('.screen-game');
            const work = screen.querySelector('.g-work');
            const k = document.getElementById('stage').getBoundingClientRect().width / 1280;
            const boxes = [...document.querySelectorAll(sel)].map((el) => {
              const r = el.getBoundingClientRect();
              return { name: el.outerHTML.slice(0, 40), x1: r.left, y1: r.top, x2: r.right, y2: r.bottom };
            });
            const wt = work.querySelector('.g-worktop svg').getBoundingClientRect();
            const pass = screen.querySelector('.g-counter').getBoundingClientRect();
            return { phone: screen.classList.contains('is-phone-layout'), transform: work.style.transform, k, boxes, worktop: [wt.left, wt.top, wt.right, wt.bottom], pass: [pass.left, pass.top, pass.right, pass.bottom], teaser: !!screen.querySelector('.g-machine.is-locked') };
          }, STATIONS);
          assert(m.phone, '.screen-game.is-phone-layout is not set');
          const scale = Number(m.transform.match(/scale\(([\d.]+)\)/)?.[1]);
          assert(scale > 1.03, `the work area is scaled by ${scale} (${m.transform})`);
          assert(!m.teaser, 'the locked matcha teaser takes room on the phone');
          for (let i = 0; i < m.boxes.length; i++) {
            for (let j = i + 1; j < m.boxes.length; j++) {
              const a = m.boxes[i];
              const b = m.boxes[j];
              const over = a.x1 < b.x2 - 0.5 && b.x1 < a.x2 - 0.5 && a.y1 < b.y2 - 0.5 && b.y1 < a.y2 - 0.5;
              assert(!over, `${a.name} and ${b.name} overlap`);
            }
          }
          // the worktop runs from the pass's bottom edge across the whole window and down past it
          const [wl, wt, wr, wb] = m.worktop;
          assert(wt <= m.pass[3] + 1 && wl <= 0.5 && wr >= viewport.width - 0.5 && wb >= viewport.height - 0.5, `worktop [${m.worktop.map(Math.round)}] leaves the window bare (pass to ${m.pass[3].toFixed(0)})`);
          const sizes = await page.evaluate(() => {
            const w = (sel) => Math.min(...[...document.querySelectorAll(sel)].map((el) => el.getBoundingClientRect().width));
            return { bin: w('[data-bin]'), bowl: w('[data-bowl]') };
          });
          assert(sizes.bin >= 40 && sizes.bowl >= 55, `fullest kitchen: containers ${sizes.bin.toFixed(1)} css px, cups ${sizes.bowl.toFixed(1)}`);
        });

        await check(`${tag}: the scene scaled up, the HUD beside it under the bubbles, clear of guests and pass`, async () => {
          const m = await page.evaluate(() => {
            const screen = document.querySelector('.screen-game');
            const box = (el) => { const r = el.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; };
            const scale = Number(screen.querySelector('.g-scene').style.transform.match(/scale\(([\d.]+)\)/)?.[1]);
            return {
              zoom: screen.classList.contains('is-scene-zoom'), side: screen.classList.contains('is-side-hud'), scale,
              hud: [...screen.querySelectorAll('.g-pause-btn, .g-hearts, .g-clock, .g-money, .g-goalbar')].map((el) => ({ name: el.className, box: box(el) })),
              level: getComputedStyle(screen.querySelector('.g-level')).display,
              bubbles: [...screen.querySelectorAll('.g-bubble')].map(box),
              figures: [...screen.querySelectorAll('.g-figure')].map(box),
              pass: box(screen.querySelector('.g-counter')),
            };
          });
          assert(m.zoom && m.side, `scene zoom ${m.zoom}, side HUD ${m.side}`);
          assert(m.scale >= 1.15, `the scene is scaled by ${m.scale}`);
          assert(m.level === 'none', 'the level pill stays in the side HUD');
          const over = (a, b) => a[0] < b[2] - 0.5 && b[0] < a[2] - 0.5 && a[1] < b[3] - 0.5 && b[1] < a[3] - 0.5;
          for (const h of m.hud) {
            const [l, t, r, bt] = h.box;
            assert(l >= -0.5 && t >= -0.5 && r <= viewport.width + 0.5 && bt <= viewport.height + 0.5, `${h.name} [${h.box.map(Math.round)}] off the window`);
            assert(bt <= m.pass[1] + 0.5, `${h.name} reaches down onto the pass`);
            for (const f of m.figures) assert(!over(h.box, f), `${h.name} over a guest`);
            for (const bb of m.bubbles) assert(!over(h.box, bb), `${h.name} over a bubble`);
          }
          const pause = m.hud.find((h) => /g-pause-btn/.test(h.name)).box;
          assert(pause[2] - pause[0] >= 30, `pause button ${(pause[2] - pause[0]).toFixed(1)} css px`);
          for (const bb of m.bubbles) assert(bb[1] >= -0.5 && bb[0] >= -0.5 && bb[2] <= viewport.width + 0.5, `bubble [${bb.map(Math.round)}] off the window`);
        });

        await check(`${tag}: name tags and layer labels are drawn ≥ ${MIN_TEXT} css px`, async () => {
          // the tags show in the first levels and while an ingredient is held: show them all for the measure
          const sizes = await page.evaluate(() => {
            const k = document.getElementById('stage').getBoundingClientRect().width / 1280;
            return [...document.querySelectorAll('.g-bin .g-name, .g-pack .g-name, .g-shelf-label, .g-freezer-label')].map((el) => {
              const cs = getComputedStyle(el);
              const scale = cs.scale === 'none' ? 1 : parseFloat(cs.scale);
              return { text: el.textContent, px: parseFloat(cs.fontSize) * scale * k };
            });
          });
          assert(sizes.length > 10, `only ${sizes.length} labels`);
          for (const s of sizes) assert(s.px >= MIN_TEXT, `"${s.text}" drawn ${s.px.toFixed(1)} css px`);
        });

        await check(`${tag}: a pinch does not zoom the page`, async () => {
          const scale = await pinch(page, { x: viewport.width / 2 - 20, y: 60 }, { x: viewport.width / 2 + 20, y: 60 });
          assert(scale === 1, `page zoomed to ${scale}×`);
        });

        await check(`${tag}: filling a cup by touch carries only the jug – the base stays, the jug comes back`, async () => {
          await page.evaluate(() => {
            const g = window.__acaiGame;
            Object.assign(g.blenders[0], { state: 'ready', base: 'acai', portions: 2, maxPortions: 2, progress: 0, duration: 0 });
            g.bowls[1].cup = true;
          });
          await sleep(300);
          const seen = await touchHold(page, '[data-blender="0"]', '[data-bowl="1"]', () => page.evaluate(() => {
            const bl = document.querySelector('[data-blender="0"]');
            const ghost = document.querySelector('.drag-ghost .drag-ghost-body');
            const art = bl.querySelector('.g-art').getBoundingClientRect();
            const gr = ghost?.getBoundingClientRect();
            return {
              carried: bl.classList.contains('drag-source'),
              opacity: Number(getComputedStyle(bl).opacity),
              badge: getComputedStyle(bl.querySelector('.g-badge')).visibility,
              ghostH: gr ? gr.height : 0,
              artH: art.height,
            };
          }));
          await page.screenshot({ path: path.join(OUT, `jug-${viewport.width}.png`) });
          assert(seen.carried, 'the blender is not being carried');
          assert(seen.opacity === 1, `the base fades to ${seen.opacity} while its jug is carried`);
          assert(seen.badge === 'hidden', 'the badge stays on the base');
          // the jug alone: well under the height of the whole blender's picture (the ghost is shown 0.9 × 1.12)
          assert(seen.ghostH > 0 && seen.ghostH < seen.artH * 0.75, `ghost ${seen.ghostH.toFixed(1)} px for a ${seen.artH.toFixed(1)} px blender`);
          await sleep(700);
          const after = await page.evaluate(() => ({
            base: window.__acaiGame.bowls[1].base,
            portions: window.__acaiGame.blenders[0].portions,
            carried: document.querySelector('[data-blender="0"]').classList.contains('drag-source'),
            ghosts: document.querySelectorAll('.drag-ghost').length,
          }));
          assert(after.base === 'acai', `the cup holds ${after.base}`);
          assert(after.portions === 1, `${after.portions} portions left`);
          assert(!after.carried && after.ghosts === 0, 'the jug did not come back onto its base');
        });

        await check(`${tag}: a cup is filled by an ordinary touch drag of the blender`, async () => {
          await page.evaluate(() => {
            window.__acaiGame.bowls[2].cup = true;
          });
          await sleep(200);
          await dragBetween(page, '[data-blender="0"]', '[data-bowl="2"]', { touch: true });
          await sleep(500);
          const base = await page.evaluate(() => window.__acaiGame.bowls[2].base);
          assert(base === 'acai', `the cup holds ${base}`);
        });
        await check(`${tag}: no console errors`, async () => assertNoConsoleErrors(b.errors, tag));
      } finally {
        await b.close();
      }
    }

    for (const viewport of PHONES) {
      const tag = `${viewport.width}×${viewport.height}`;
      const b = await open(srv, 'level=1&tutorial=0', { viewport });
      try {
        await check(`${tag}: the first level's few stations are half as big again`, async () => {
          const m = await b.page.evaluate(() => {
            const w = (sel) => Math.min(...[...document.querySelectorAll(sel)].map((el) => el.getBoundingClientRect().width));
            const k = document.getElementById('stage').getBoundingClientRect().width / 1280;
            const scale = Number(document.querySelector('.g-work').style.transform.match(/scale\(([\d.]+)\)/)?.[1]);
            return { bin: w('[data-bin]'), bowl: w('[data-bowl]'), pack: w('[data-pack]'), scale, plain: { bin: 96 * k, bowl: 120 * k } };
          });
          assert(m.scale >= 1.4, `scaled by ${m.scale}`);
          assert(m.bin >= 60 && m.bowl >= 75 && m.pack >= 55, `containers ${m.bin.toFixed(1)} css px, cups ${m.bowl.toFixed(1)}, packs ${m.pack.toFixed(1)} (unscaled: ${m.plain.bin.toFixed(1)} / ${m.plain.bowl.toFixed(1)})`);
          await b.page.screenshot({ path: path.join(OUT, `level1-${viewport.width}.png`) });
        });
        await check(`${tag}: no console errors in level 1`, async () => assertNoConsoleErrors(b.errors, tag));
      } finally {
        await b.close();
      }
    }

    const t = await open(srv, 'level=5', { viewport: { width: 1280, height: 800 }, touch: false });
    try {
      await check('1280×800 with a mouse: no phone', async () => {
        const phone = await t.page.evaluate(() => document.documentElement.classList.contains('is-phone'));
        assert(!phone, 'html.is-phone is set');
      });
    } finally {
      await t.close();
    }
  } finally {
    await srv.close();
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} mobile checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
