#!/usr/bin/env node
// Draws the app icons (js/art.js appIconSVG) into icons/ as PNG – for the web app manifest, the iOS home
// screen (apple-touch-icon) and the browser tab. The only image files of the game; run again after changing
// the icon:  node tools/icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { appIconSVG, artDefsSVG } from '../js/art.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'icons');
const ICONS = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, false],
  ['favicon-32.png', 32, false],
];

mkdirSync(OUT, { recursive: true });
// the SVG favicon carries the shared gradients (js/svg.js) inside, so it draws on its own
const defs = artDefsSVG().replace(/^<svg[^>]*>|<\/svg>$/g, '');
writeFileSync(path.join(OUT, 'icon.svg'), appIconSVG(512).replace(/^(<svg[^>]*>)/, `$1${defs}`));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const [file, size, maskable] of ICONS) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<!doctype html><html><body style="margin:0">${artDefsSVG()}${appIconSVG(size, { maskable })}</body></html>`);
    await page.locator('body > svg:last-child').screenshot({ path: path.join(OUT, file), omitBackground: false });
    console.log(`icons/${file}`);
  }
} finally {
  await browser.close();
}
