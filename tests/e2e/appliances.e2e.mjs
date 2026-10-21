// E2E checks of the 3D kitchen appliances (js/art3d.js + js/kitchen3d.js through js/game-view.js
// and js/screens.js): WebGL canvases at every station, one model per upgrade level, animations that
// follow the game (blending, bin lid, cold air from the freezer, the matcha machine's nozzle), the ingredient containers' still
// pictures drawn again for a new pixel ratio, and the drawn SVG art when the browser has no WebGL.
// Run: node tests/e2e/appliances.e2e.mjs   (serves the repo on :8090, exits non-zero on failure)

import path from 'node:path';
import {
  startServer, reuseServer, launchBrowser, collectConsoleErrors, assertNoConsoleErrors, dragBetween, e2eOutDir,
} from './helpers.mjs';

const PORT = Number(process.env.E2E_PORT) || 8090;
const OUT = e2eOutDir('appliances');
const SAVE_KEY = 'acaiFever.save.v1';
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
    return { url: await reuseServer(PORT), close: async () => {} };
  }
}

// noWebgl: the page cannot create a WebGL context (old browser, blocked GPU)
async function open(url, { noWebgl = false, upgrades = null } = {}) {
  const b = await launchBrowser({ fonts: 'stub' });
  const errors = collectConsoleErrors(b.page);
  if (noWebgl) {
    await b.page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function getContext(type, ...rest) {
        return /webgl/i.test(type) ? null : orig.call(this, type, ...rest);
      };
    });
  }
  if (upgrades) {
    await b.page.addInitScript(([key, ups]) => {
      try {
        const save = JSON.parse(localStorage.getItem(key) || 'null') || { version: 1 };
        save.upgrades = ups;
        localStorage.setItem(key, JSON.stringify(save));
      } catch { /* the harness repairs the save */ }
    }, [SAVE_KEY, upgrades]);
  }
  await b.page.goto(url);
  return { ...b, errors };
}

const openGame = async (srv, query, opts) => {
  const b = await open(`${srv.url}/tools/game-harness.html?mute=1&log=0&tutorial=0&${query}`, opts);
  await b.page.waitForFunction(() => !!window.__acaiGame && !!document.querySelector('.screen-game'));
  await sleep(300);
  return b;
};

// FNV hash of a canvas' pixels (a picture changed or not) and how much of it is drawn.
const canvasInfo = (page, sel) => page.evaluate((s) => {
  const c = document.querySelector(s);
  if (!c || !c.width) return null;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let h = 2166136261;
  let drawn = 0;
  for (let i = 0; i < d.length; i += 4) {
    h = Math.imul(h ^ (d[i] + d[i + 1] * 3 + d[i + 2] * 7 + d[i + 3] * 11), 16777619) >>> 0;
    if (d[i + 3] > 200) drawn++;
  }
  return { hash: h, drawn: drawn / (d.length / 4), w: c.width, h: c.height };
}, sel);

const engine = (page, fn, arg) => page.evaluate(async ([src, a]) => {
  const e = await import('/js/engine.js');
  // eslint-disable-next-line no-new-func
  return new Function('e', 'g', 'a', src)(e, window.__acaiGame, a);
}, [fn, arg]);

async function fastUntil(page, fn, arg, speed = 6, timeout = 20000) {
  await page.evaluate((s) => { window.__acaiSpeed = s; }, speed);
  try {
    await page.waitForFunction(fn, arg, { timeout, polling: 50 });
  } finally {
    await page.evaluate(() => { window.__acaiSpeed = 1; });
  }
}

async function main() {
  const srv = await serve();
  console.log(`appliances on ${srv.url}`);
  try {
    // ---------------------------------------------------------------- 3D in the game
    {
      const { page, errors, close } = await openGame(srv, 'level=45&owned=all&upgrades=max&seed=4');

      await check('every station is a drawn 3D canvas', async () => {
        assert(await page.locator('.screen-game.is-3d').count() === 1, 'game root has no is-3d');
        const sels = ['[data-blender="0"] canvas.g-3d', '[data-blender="1"] canvas.g-3d', '.g-machine canvas.g-3d', '.g-trash canvas.g-3d',
          '.g-freezer canvas.g-3d-back', '.g-freezer canvas.g-3d-front'];
        for (const sel of sels) {
          const info = await canvasInfo(page, sel);
          assert(info, `${sel} missing`);
          assert(info.w > 50 && info.h > 50, `${sel} has no size`);
          assert(info.drawn > (sel.includes('front') ? 0.02 : 0.08), `${sel} is (almost) empty: ${info.drawn}`);
        }
        assert(await page.locator('[data-blender] .g-art svg').count() === 0, 'no drawn blender in 3D mode');
      });

      await check('the bought upgrades pick the top blender model and the two-tank machine', async () => {
        assert(await page.locator('[data-blender="0"]').getAttribute('data-model') === '3', 'blender model is not Pro Max');
        assert(await page.locator('.g-machine').getAttribute('data-model') === '2', 'machine is not the two-tank model');
      });

      await check('blending animates the jug, a ready jug left on hums, switched off it stands still', async () => {
        await engine(page, 'return e.loadBlender(g, 0, "acai").ok && e.toggleBlender(g, 0).ok;');
        await sleep(250);
        const a = await canvasInfo(page, '[data-blender="0"] canvas');
        await sleep(450);
        const b = await canvasInfo(page, '[data-blender="0"] canvas');
        assert(a.hash !== b.hash, 'the blending jug did not move');
        await fastUntil(page, () => window.__acaiGame.blenders[0].state === 'ready');
        await page.evaluate(() => { window.__acaiSpeed = 0.05; }); // it must not overflow meanwhile
        await sleep(250);
        const on0 = await canvasInfo(page, '[data-blender="0"] canvas');
        await sleep(450);
        const on1 = await canvasInfo(page, '[data-blender="0"] canvas');
        await page.evaluate(() => { window.__acaiSpeed = 1; });
        assert(on0.hash !== on1.hash, 'a ready blender left on stands still');
        await engine(page, 'return e.toggleBlender(g, 0).ok;');
        await sleep(400);
        const c = await canvasInfo(page, '[data-blender="0"] canvas');
        await sleep(400);
        const d = await canvasInfo(page, '[data-blender="0"] canvas');
        assert(c.hash === d.hash, 'a ready blender switched off keeps redrawing');
        assert(await page.locator('[data-blender="0"] .g-badge svg').count() === 1, 'no ✓ badge on the ready blender');
        await page.screenshot({ path: path.join(OUT, 'ready.png') });
      });

      await check('dragging the blender carries a 3D snapshot of its jug, copied without reading the canvas back', async () => {
        // a pixel readback of the live canvas would stall the GPU on every pickup
        await page.evaluate(() => {
          const read = CanvasRenderingContext2D.prototype.getImageData;
          window.__readbacks = 0;
          CanvasRenderingContext2D.prototype.getImageData = function getImageData(...args) {
            window.__readbacks++;
            return read.apply(this, args);
          };
          window.__restoreReadbacks = () => { CanvasRenderingContext2D.prototype.getImageData = read; };
        });
        const box = await page.locator('[data-blender="0"]').boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 - 30, { steps: 5 });
        await sleep(150);
        const ghost = await page.locator('.drag-ghost canvas').evaluate((c) => ({ w: c.getBoundingClientRect().width, h: c.getBoundingClientRect().height })).catch(() => null);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
        await page.mouse.up();
        await sleep(400);
        const readbacks = await page.evaluate(() => { window.__restoreReadbacks(); return window.__readbacks; });
        assert(ghost, 'the drag ghost is not the 3D picture');
        // only the jug, lifted off its base: cropped to it (the canvas is 164 × 292 with headroom), carried at about
        // its size – about as wide as the blender, far less tall
        assert(ghost.w > 90 && ghost.w < 200 && ghost.h > 100 && ghost.h < 170, `ghost ${ghost.w}×${ghost.h}`);
        assert(readbacks === 0, `${readbacks} getImageData call(s) while picking up the blender`);
      });

      await check('the bin opens while a bowl is carried over it and falls shut after the drop', async () => {
        await engine(page, 'e.placeCup(g, 0); return e.pourBlender(g, 0, 0).ok;');
        await sleep(400);
        const closed = await canvasInfo(page, '.g-trash canvas');
        const bowl = await page.locator('[data-bowl="0"]').boundingBox();
        const bin = await page.locator('[data-trash]').boundingBox();
        await page.mouse.move(bowl.x + bowl.width / 2, bowl.y + bowl.height / 2);
        await page.mouse.down();
        for (let i = 1; i <= 10; i++) {
          await page.mouse.move(bowl.x + bowl.width / 2 + ((bin.x + bin.width / 2 - bowl.x - bowl.width / 2) * i) / 10,
            bowl.y + bowl.height / 2 + ((bin.y + bin.height / 2 - 40 - bowl.y - bowl.height / 2) * i) / 10);
          await sleep(16);
        }
        await sleep(700);
        const open = await canvasInfo(page, '.g-trash canvas');
        await page.screenshot({ path: path.join(OUT, 'bin-open.png') });
        await page.mouse.up();
        await page.waitForFunction(() => !window.__acaiGame.bowls[0].cup, null, { timeout: 3000 });
        await sleep(1500);
        const after = await canvasInfo(page, '.g-trash canvas');
        assert(open.hash !== closed.hash, 'the lid did not open');
        assert(after.hash === closed.hash, 'the lid did not close again');
      });

      await check('cold air spills out of the freezer while a pack is carried', async () => {
        const closed = await canvasInfo(page, '.g-freezer canvas.g-3d-front');
        const pack = await page.locator('[data-pack="pitaya"]').boundingBox();
        await page.mouse.move(pack.x + pack.width / 2, pack.y + pack.height / 2);
        await page.mouse.down();
        await page.mouse.move(pack.x + pack.width / 2 + 40, pack.y - 120, { steps: 8 });
        await sleep(700);
        const open = await canvasInfo(page, '.g-freezer canvas.g-3d-front');
        await page.screenshot({ path: path.join(OUT, 'freezer-open.png') });
        // put back where it was taken (let go up there, it would land in the empty second blender, whose
        // animation would then share the drawing budget with the machine in the next check)
        await page.mouse.move(pack.x + pack.width / 2, pack.y + pack.height / 2, { steps: 8 });
        await page.mouse.up();
        assert(await page.evaluate(() => window.__acaiGame.blenders.every((b) => b.state !== 'blending')), 'the pack went into a blender');
        await sleep(1600);
        const after = await canvasInfo(page, '.g-freezer canvas.g-3d-front');
        assert(open.hash !== closed.hash, 'no cold air while the pack is taken');
        assert(after.hash === closed.hash, 'the cold air does not settle again');
      });

      await check('matcha machine: the cut fruit is puréed while the mill grinds, then the nozzle fills the glass', async () => {
        await engine(page, 'return e.loadMatcha(g, 0, "mMango").ok;');
        // the glass's layers (js/art-food.js): mango cubes, puréed, then the matcha over the milk
        const glassHas = (col) => page.evaluate((c) => !!document.querySelector('[data-matcha-slot="0"] .g-art svg')?.innerHTML.includes(c), col);
        const machine = () => canvasInfo(page, '.g-machine canvas.g-3d');
        await sleep(200);
        assert(await glassHas('#ffb21e'), 'no mango pieces in the glass at the start');
        assert(!(await glassHas('#7f9f37')), 'the glass fills before the nozzle pours');
        const a = await machine();
        await sleep(400);
        assert((await machine()).hash !== a.hash, 'the machine stands still while it brews');
        await fastUntil(page, () => window.__acaiGame.matcha.slots[0].progress > 0.45, null, 2);
        await sleep(200);
        assert(await glassHas('#ffa623'), 'the fruit is not puréed while the mill grinds');
        assert(!(await glassHas('#7f9f37')), 'no matcha before the pour');
        await fastUntil(page, () => window.__acaiGame.matcha.slots[0].progress > 0.8, null, 2);
        await sleep(200);
        assert(await glassHas('#7f9f37'), 'the glass does not fill while the nozzle pours');
        await page.screenshot({ path: path.join(OUT, 'pour.png') });
      });

      await check('with both blenders and both glasses animating the game keeps its frame rate, every appliance moves', async () => {
        // headless Chromium draws WebGL in software, slowly (100–200 ms a picture): the animation frames
        // of all views share one budget (js/art3d.js), otherwise the three would draw back to back and
        // leave the game a few frames a second
        const fps = (ms) => page.evaluate((span) => new Promise((res) => {
          let n = 0;
          const t0 = performance.now();
          const f = (ts) => {
            n++;
            if (ts - t0 < span) requestAnimationFrame(f);
            else res(n / ((ts - t0) / 1000));
          };
          requestAnimationFrame(f);
        }), ms);
        await fastUntil(page, () => window.__acaiGame.matcha.slots[0].state === 'ready');
        await engine(page, 'e.trashMatcha(g, 0); e.trashMatcha(g, 1); e.cleanBlender(g, 0); e.cleanBlender(g, 1);');
        await sleep(600);
        const idle = await fps(2000);
        await page.evaluate(() => { window.__acaiSpeed = 0.05; }); // the states hold while the frames are counted
        try {
          const loaded = await engine(page, `return [e.loadBlender(g, 0, 'acai'), e.toggleBlender(g, 0), e.loadBlender(g, 1, 'pitaya'),
            e.toggleBlender(g, 1), e.loadMatcha(g, 0, 'mMango'), e.loadMatcha(g, 1, 'mStrawberry')].every((r) => r.ok);`);
          assert(loaded, 'could not start both blenders and both glasses');
          await sleep(800);
          const sels = ['[data-blender="0"] canvas', '[data-blender="1"] canvas', '.g-machine canvas.g-3d'];
          const before = await Promise.all(sels.map((s) => canvasInfo(page, s)));
          const busy = await fps(3000);
          const after = await Promise.all(sels.map((s) => canvasInfo(page, s)));
          const still = sels.filter((s, i) => before[i].hash === after[i].hash);
          await page.screenshot({ path: path.join(OUT, 'all-busy.png') });
          assert(busy >= Math.max(12, idle * 0.4), `${busy.toFixed(1)} fps with everything animating (idle ${idle.toFixed(1)} fps)`);
          assert(!still.length, `not redrawn in 3 s: ${still.join(', ')}`);
        } finally {
          await page.evaluate(() => { window.__acaiSpeed = 1; });
        }
        await fastUntil(page, () => window.__acaiGame.blenders.every((b) => b.state !== 'blending')
          && window.__acaiGame.matcha.slots.every((s) => s.state !== 'mixing'));
        await engine(page, 'e.trashMatcha(g, 0); e.trashMatcha(g, 1); e.cleanBlender(g, 0); e.cleanBlender(g, 1);');
      });

      await check('a bigger window (a new pixel ratio) draws the ingredient containers again, sharp', async () => {
        // every container picture is 96 css px × the pixel ratio (device px per stage px) wide
        const sharp = () => {
          const k = Math.max(1, Math.min(3, window.devicePixelRatio * (document.getElementById('stage').getBoundingClientRect().width / 1280)));
          const cs = [...document.querySelectorAll('.g-bin .g-art canvas')];
          return cs.length >= 13 && cs.every((c) => c.width === Math.round(96 * k));
        };
        const widths = () => page.evaluate(() => [...document.querySelectorAll('.g-bin .g-art canvas')].map((c) => c.width).join());
        assert(await page.evaluate(sharp), `container pictures at pixel ratio 1: ${await widths()}`);
        for (const viewport of [{ width: 1600, height: 1000 }, { width: 1280, height: 800 }]) {
          await page.setViewportSize(viewport);
          await page.waitForFunction(sharp, null, { timeout: 5000 })
            .catch(async () => { throw new Error(`not redrawn at ${viewport.width}×${viewport.height}: ${await widths()}`); });
        }
      });

      await check('no console errors in the 3D game', async () => assertNoConsoleErrors(errors));
      await close();
    }

    {
      const { page, errors, close } = await openGame(srv, 'level=3&fresh=1&seed=2');
      await check('a new player has the Classic blender', async () => {
        assert(await page.locator('[data-blender="0"]').getAttribute('data-model') === '0', 'not the Classic');
        assert(await page.locator('.g-machine.is-locked canvas').count() === 1, 'locked machine teaser is not 3D');
      });
      await check('no console errors (Classic)', async () => assertNoConsoleErrors(errors));
      await close();
    }

    {
      const { page, errors, close } = await openGame(srv, 'level=8', { upgrades: { blenderSpeed: 2 } });
      await check('Turbo-Mixer level 2 is the Pro model', async () => {
        assert(await page.locator('[data-blender="0"]').getAttribute('data-model') === '2', 'not the Pro');
      });
      await check('no console errors (Pro)', async () => assertNoConsoleErrors(errors));
      await close();
    }

    // ---------------------------------------------------------------- shop pictures
    {
      const { page, errors, close } = await open(`${srv.url}/tools/screens-harness.html?screen=shop&tab=kitchen&lang=de&coins=500`);
      await page.waitForSelector('.upg-card');
      await check('shop: the kitchen cards show 3D pictures and the next blender model', async () => {
        const imgs = await page.locator('.upg-art img.art3d').count();
        assert(imgs >= 5, `only ${imgs} 3D pictures on the kitchen cards`);
        const label = await page.locator('[data-upgrade="blenderSpeed"] .upg-model').textContent();
        assert(label.includes('Turbo'), `next model label: ${label}`);
        // the tab appears at once, its pictures are drawn one at a time after it (js/art3d.js pictureMarkup)
        await page.waitForFunction(() => !document.querySelector('img.art3d.is-pending'), null, { timeout: 15000 });
        const loaded = await page.evaluate(() => [...document.querySelectorAll('img.art3d')].every((i) => i.complete && i.naturalWidth > 1));
        assert(loaded, 'a 3D picture did not load');
        await page.screenshot({ path: path.join(OUT, 'shop.png') });
      });
      await check('shop: buying the Turbo-Mixer shows the following model', async () => {
        await page.locator('[data-upgrade="blenderSpeed"] [data-buy]').click();
        await page.waitForFunction(() => document.querySelector('[data-upgrade="blenderSpeed"] .upg-model')?.textContent.includes('Pro'));
        await page.waitForFunction(() => !document.querySelector('img.art3d.is-pending'), null, { timeout: 15000 });
        const loaded = await page.evaluate(() => [...document.querySelectorAll('img.art3d')].every((i) => i.complete && i.naturalWidth > 1));
        assert(loaded, 'a picture of the new model did not load');
      });
      await check('no console errors in the shop', async () => assertNoConsoleErrors(errors));
      await close();
    }

    // ---------------------------------------------------------------- without WebGL
    {
      const { page, errors, close } = await openGame(srv, 'level=45&owned=all&upgrades=max&seed=4', { noWebgl: true });
      await check('without WebGL the game draws the SVG appliances', async () => {
        assert(await page.locator('.screen-game.is-3d').count() === 0, 'is-3d without WebGL');
        assert(await page.locator('[data-blender="0"] .g-art svg [data-fill], [data-blender="0"] .g-art svg').count() >= 1, 'no SVG blender');
        assert(await page.locator('.g-machine > svg').count() === 1, 'no SVG matcha machine');
        assert(await page.locator('.g-trash .g-art svg').count() === 1, 'no SVG trash can');
        assert(await page.locator('canvas.g-3d').count() === 0, '3D canvases without WebGL');
        await engine(page, 'return e.loadBlender(g, 0, "acai").ok && e.toggleBlender(g, 0).ok;');
        await fastUntil(page, () => window.__acaiGame.blenders[0].state === 'ready');
        await sleep(200);
        assert(await page.locator('[data-blender="0"] .g-art svg [data-fill]').count() === 1, 'SVG jug is not filled');
      });
      await check('no console errors without WebGL', async () => assertNoConsoleErrors(errors));
      await close();
    }
    {
      const { page, errors, close } = await open(`${srv.url}/tools/screens-harness.html?screen=shop&tab=kitchen&lang=de`, { noWebgl: true });
      await page.waitForSelector('.upg-card');
      await check('without WebGL the shop shows the drawn pictures', async () => {
        assert(await page.locator('img.art3d').count() === 0, '3D pictures without WebGL');
        assert(await page.locator('.upg-art svg').count() >= 5, 'no drawn pictures');
      });
      await check('no console errors in the shop without WebGL', async () => assertNoConsoleErrors(errors));
      await close();
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
