// Smoke test of the production build: bundles the current sources (tools/build.mjs) into a temp
// folder, opens acai-fever.html via file:// and checks it boots, starts level 1 and accepts a drag.
// Run: node tests/e2e/build.e2e.mjs   (E2E_DIST=dist checks the committed dist/ instead)
// Only Google Fonts network failures are ignored (the page may be opened offline).

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildGame } from '../../tools/build.mjs';
import { launchBrowser, collectConsoleErrors, assertNoConsoleErrors, dragBetween, e2eOutDir } from './helpers.mjs';

const results = [];
async function check(name, fn, page) {
  try {
    await fn();
    results.push({ ok: true });
    console.log(`  ok    ${name}`);
  } catch (err) {
    results.push({ ok: false });
    console.log(`  FAIL  ${name}\n        ${String(err.message).split('\n').join('\n        ')}`);
    if (page) await page.screenshot({ path: path.join(e2eOutDir('build'), `fail-${results.length}.png`) }).catch(() => {});
  }
}
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const screenIs = (page, name) => page.waitForFunction(
  (n) => document.querySelector('#stage > [data-screen]')?.dataset.screen === n, name, { timeout: 8000 },
);

async function main() {
  let file;
  if (process.env.E2E_DIST) {
    file = path.resolve(process.env.E2E_DIST, 'acai-fever.html');
  } else {
    const outDir = e2eOutDir('build/dist');
    const res = await buildGame({ outDir });
    file = res.files.find((f) => f.file.endsWith('acai-fever.html')).file;
  }
  console.log(`build smoke test: ${file}`);
  const b = await launchBrowser({ fonts: process.env.E2E_FONTS === 'stub' ? 'stub' : 'real' });
  const { page } = b;
  const errors = collectConsoleErrors(page);
  try {
    await page.goto(pathToFileURL(file).href);

    await check('file:// boots to the title screen', async () => {
      await screenIs(page, 'title');
      const title = await page.title();
      assert(title.includes('Açaí Fever'), `document title "${title}"`);
      const modules = await page.$$eval('script[type="module"], link[rel="stylesheet"]:not([href*="fonts.googleapis"])', (els) => els.length);
      assert(modules === 0, 'standalone page still references module scripts or local stylesheets');
    }, page);

    await check('title → map → level 1 starts, a drag works', async () => {
      await page.locator('[data-action="play"]').click({ force: true });
      await screenIs(page, 'map');
      await page.locator('.map-level[data-level="1"]').click();
      await page.locator('[data-prelevel] [data-action="start"]').click();
      await screenIs(page, 'game');
      await page.waitForFunction(() => !!window.__acaiGame && document.querySelector('[data-tutorial-step]'), null, { timeout: 5000 });
      await dragBetween(page, '[data-pack="acai"]', '[data-blender="0"]');
      await page.waitForFunction(() => window.__acaiGame.blenders[0].state === 'blending', null, { timeout: 3000 });
    }, page);

    await check('save survives a reload from file://', async () => {
      await page.locator('[data-pause]').click();
      await page.locator('[data-pause-overlay] [data-toggle="music"]').click();
      await page.locator('[data-pause-overlay] [data-action="quit"]').click();
      await screenIs(page, 'map');
      await page.reload();
      await screenIs(page, 'title');
      const seen = await page.evaluate(() => {
        try {
          return JSON.parse(localStorage.getItem('acaiFever.save.v1'))?.settings.music === false;
        } catch {
          return false;
        }
      });
      assert(seen, 'music setting not persisted under file://');
    }, page);

    await check('no console errors (font network errors ignored)', async () => assertNoConsoleErrors(errors, 'dist'));
  } finally {
    await b.close();
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
