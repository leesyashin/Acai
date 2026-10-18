#!/usr/bin/env node
// Renders the promo film (tools/promo/promo.html) to a TikTok-ready MP4: 1080×1920, H.264 + AAC.
//
//   node tools/promo/render.mjs [out.mp4] [options]
//     --lang de|en      language of the texts (default de)
//     --fps 30          frames per second of the video (default 30)
//     --blur 3          sub-frames blended into each frame = motion blur (1 = off, default 3)
//     --workers 3       browser pages rendering in parallel (default 3)
//     --from 0 --to 25  render only a part (seconds)
//     --stills 1,2.5    only save PNG stills at these times (next to out, or in --out-dir)
//     --sfx-only        also write <out>-sfx.mp4: only the effects, no music (for a TikTok sound on top)
//     --shot file.png   use this game screenshot instead of taking one
//     --keep            keep the temporary files
//
// Needs ffmpeg on the PATH and the dev dependencies (npm install). Uses tools/serve.mjs for the
// pages and the real Google Fonts (through HTTPS_PROXY when set).

import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../serve.mjs';
import { launchBrowser, collectConsoleErrors } from '../../tests/e2e/helpers.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const flag = (name) => args.includes(`--${name}`);
const OUT = path.resolve(args[0] && !args[0].startsWith('--') ? args[0] : 'acai-fever-promo.mp4');
const LANG = opt('lang', 'de');
const FPS = Number(opt('fps', 30));
const BLUR = Math.max(1, Math.round(Number(opt('blur', 3))));
const SHUTTER = 0.5; // the sub-frames cover half the frame interval (a 180° shutter)
const WORKERS = Math.max(1, Number(opt('workers', 3)));
const STILLS = opt('stills', '') ? opt('stills', '').split(',').map(Number) : null;
const KEEP = flag('keep');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function run(cmd, argv, { input = null, quiet = true } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, argv, { stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => {
      err += d;
      if (!quiet) process.stderr.write(d);
    });
    p.stdout.on('data', () => {});
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(err) : reject(new Error(`${cmd} exited ${code}\n${err.slice(-3000)}`))));
    if (input) input(p.stdin);
  });
}

// ------------------------------------------------------------------ the game screenshot
const SAVE_KEY = 'acaiFever.save.v1';
const ALL_ING = ['acai', 'pitaya', 'spirulina', 'banana', 'granola', 'strawberry', 'blueberry', 'mango', 'kiwi',
  'honey', 'coconut', 'chia', 'peanut', 'chocolate', 'mint', 'cacao'];

// A busy moment of level 14 (four guests, two blenders, filled bowls, smoothies), at 2× pixels.
async function gameShot(url, lang) {
  const b = await launchBrowser({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, fonts: 'real', locale: lang === 'en' ? 'en-US' : 'de-DE' });
  try {
    const { page } = b;
    const stars = {};
    for (let i = 1; i <= 14; i++) stars[i] = 3;
    const save = {
      version: 1, coins: 2380, owned: ALL_ING.slice(), ingLevels: { acai: 2, pitaya: 1, banana: 1, strawberry: 2, mango: 1 },
      upgrades: { blenderSpeed: 2, jug: 1, blender2: 1, bowlSlots: 2, smoothieSlots: 1, plants: 1, jukebox: 1, seating: 1, neon: 1 },
      stars, endlessBest: 512, newIngredients: [], seenIntros: { basics: true }, settings: { lang, music: false, sfx: false },
      stats: { served: 640, earned: 6400, played: 20 },
    };
    await page.goto(`${url}index.html`);
    await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [SAVE_KEY, save]);
    await page.reload();
    await page.waitForFunction(() => window.__acaiScreen?.() === 'title');
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => window.__acaiGo('game', { mode: 'campaign', levelId: 14, seed: 5 }));
    await sleep(700);
    await page.evaluate(() => { window.__acaiSpeed = 6; });
    await page.waitForFunction(() => window.__acaiGame.seats.filter((c) => c && c.state === 'waiting').length >= 4, null, { timeout: 30000 });
    await page.evaluate(async () => {
      window.__acaiSpeed = 1;
      const e = await import('/js/engine.js');
      const g = window.__acaiGame;
      e.loadBlender(g, 0, 'acai');
      e.loadBlender(g, 1, 'pitaya');
      const c = g.seats.filter(Boolean);
      c[1].patience = c[1].maxPatience * 0.5;
      c[2].patience = c[2].maxPatience * 0.28;
      c[3].patience = c[3].maxPatience * 0.1;
    });
    await page.evaluate(() => { window.__acaiSpeed = 3; });
    await page.waitForFunction(() => window.__acaiGame.blenders.every((x) => x.state === 'ready'), null, { timeout: 15000 });
    await page.evaluate(async () => {
      window.__acaiSpeed = 1;
      const e = await import('/js/engine.js');
      const g = window.__acaiGame;
      for (let i = 0; i < g.bowls.length; i++) e.placeCup(g, i);
      e.pourBlender(g, 0, 0);
      for (const id of ['banana', 'strawberry', 'honey']) e.addIngredient(g, 0, id);
      e.pourBlender(g, 1, 1);
      for (const id of ['mango', 'kiwi', 'coconut', 'chia']) e.addIngredient(g, 1, id);
      e.pourBlender(g, 0, 2);
      e.addIngredient(g, 2, 'blueberry');
      if (g.smoothie) {
        e.loadSmoothie(g, 0, 'strawberry');
        e.loadSmoothie(g, 1, 'mango');
      }
    });
    await sleep(1400);
    const png = await page.screenshot({ type: 'png' });
    return `data:image/png;base64,${png.toString('base64')}`;
  } finally {
    await b.close();
  }
}

// ------------------------------------------------------------------ the film pages
async function openFilm(url, shot) {
  const b = await launchBrowser({ viewport: { width: 1080, height: 1920 }, fonts: 'real', locale: LANG === 'en' ? 'en-US' : 'de-DE' });
  const errors = collectConsoleErrors(b.page);
  if (shot) await b.context.addInitScript((s) => { window.__promoShot = s; }, shot);
  await b.page.goto(`${url}tools/promo/promo.html?render&lang=${LANG}`);
  await b.page.waitForFunction(() => window.__promoReady || window.__promoError, null, { timeout: 60000 });
  const bootErr = await b.page.evaluate(() => window.__promoError || null);
  if (bootErr) throw new Error(`promo page: ${bootErr}`);
  const cdp = await b.context.newCDPSession(b.page);
  return { ...b, errors, cdp };
}

async function frameAt(f, t) {
  await f.page.evaluate((x) => window.promo.seek(x), t);
  const { data } = await f.cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, optimizeForSpeed: true });
  return Buffer.from(data, 'base64');
}

// Renders output frames [i0, i1) into one video segment (sub-frames blended by ffmpeg's tmix).
async function renderSegment(f, i0, i1, file, from, onFrame) {
  const vf = BLUR > 1
    ? `tmix=frames=${BLUR},select='eq(mod(n\\,${BLUR})\\,${BLUR - 1})',setpts=N/(${FPS}*TB)`
    : 'null';
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS * BLUR), '-c:v', 'png', '-i', 'pipe:0',
    '-vf', `${vf},format=yuv420p`, '-r', String(FPS), '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-profile:v', 'high', '-pix_fmt', 'yuv420p', file],
  { stdio: ['pipe', 'ignore', 'pipe'] });
  let err = '';
  ff.stderr.on('data', (d) => { err += d; });
  const done = new Promise((resolve, reject) => ff.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg segment: ${err}`)))));
  for (let i = i0; i < i1; i++) {
    for (let k = 0; k < BLUR; k++) {
      const t = from + (i + (BLUR > 1 ? (k / (BLUR - 1) - 1) * SHUTTER : 0)) / FPS;
      const png = await frameAt(f, Math.max(0, t));
      if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
    }
    onFrame();
  }
  ff.stdin.end();
  await done;
}

// Brings the sound to the loudness TikTok plays at (-14 LUFS, two-pass loudnorm) and muxes it.
// The sound is cut or padded to exactly the video's length (-shortest would drop the last frames).
async function mux(video, wav, out, from, to, lufs = -14) {
  const length = (Math.round((to - from) * FPS) / FPS).toFixed(4);
  const audioArgs = ['-ss', String(from), '-t', String(to - from)];
  const target = `I=${lufs}:TP=-1.0:LRA=11`;
  const measured = await run('ffmpeg', ['-y', ...audioArgs, '-i', wav, '-af', `loudnorm=${target}:print_format=json`, '-f', 'null', '-']);
  const m = JSON.parse(measured.slice(measured.lastIndexOf('{'), measured.lastIndexOf('}') + 1));
  const norm = `loudnorm=${target}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000,apad`;
  await run('ffmpeg', ['-y', '-i', video, ...audioArgs, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', norm,
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', length, '-movflags', '+faststart', out]);
  console.log(`wrote ${out}`);
}

async function main() {
  const srv = await startServer({ port: Number(opt('port', 8091)) });
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'acai-promo-'));
  const started = Date.now();
  const pages = [];
  try {
    const shot = opt('shot', '') ? `data:image/png;base64,${readFileSync(opt('shot')).toString('base64')}` : await gameShot(srv.url, LANG);
    console.log(`game screenshot ready (${Math.round(shot.length / 1024)} KB)`);

    if (STILLS) {
      const f = await openFilm(srv.url, shot);
      pages.push(f);
      const dir = opt('out-dir', path.dirname(OUT));
      mkdirSync(dir, { recursive: true });
      for (const t of STILLS) {
        const file = path.join(dir, `still-${LANG}-${t.toFixed(2).padStart(6, '0')}.png`);
        writeFileSync(file, await frameAt(f, t));
        console.log(file);
      }
      if (f.errors.length) console.warn(`console errors:\n  ${f.errors.join('\n  ')}`);
      return;
    }

    // the film's length and its soundtrack
    const first = await openFilm(srv.url, shot);
    pages.push(first);
    const duration = await first.page.evaluate(() => window.promo.duration);
    const from = Number(opt('from', 0));
    const to = Math.min(duration, Number(opt('to', duration)));
    const frames = Math.round((to - from) * FPS);
    console.log(`rendering ${frames} frames (${(to - from).toFixed(2)} s at ${FPS} fps, ${BLUR} sub-frames) with ${WORKERS} pages`);
    const wav = path.join(tmp, 'score.wav');
    writeFileSync(wav, Buffer.from(await first.page.evaluate(() => window.promo.wavBase64()), 'base64'));
    const wavSfx = path.join(tmp, 'sfx.wav');
    if (flag('sfx-only')) writeFileSync(wavSfx, Buffer.from(await first.page.evaluate(() => window.promo.wavBase64({ music: false })), 'base64'));
    for (let w = 1; w < WORKERS; w++) pages.push(await openFilm(srv.url, shot));

    // split the frames into one segment per page
    const per = Math.ceil(frames / WORKERS);
    let doneFrames = 0;
    let lastLog = 0;
    const tick = () => {
      doneFrames++;
      if (Date.now() - lastLog > 5000 || doneFrames === frames) {
        lastLog = Date.now();
        const el = (Date.now() - started) / 1000;
        console.log(`  ${doneFrames}/${frames} frames, ${el.toFixed(0)} s`);
      }
    };
    const segs = [];
    await Promise.all(pages.map((f, w) => {
      const i0 = w * per;
      const i1 = Math.min(frames, i0 + per);
      if (i1 <= i0) return null;
      const file = path.join(tmp, `seg-${w}.mp4`);
      segs[w] = file;
      return renderSegment(f, i0, i1, file, from, tick);
    }));
    for (const f of pages) if (f.errors.length) console.warn(`console errors:\n  ${f.errors.join('\n  ')}`);

    // join the segments, bring the sound to -14 LUFS (TikTok) and mux
    const list = path.join(tmp, 'list.txt');
    writeFileSync(list, segs.filter(Boolean).map((s) => `file '${s}'`).join('\n'));
    const video = path.join(tmp, 'video.mp4');
    await run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', video]);
    await mux(video, wav, OUT, from, to);
    if (flag('sfx-only')) await mux(video, wavSfx, OUT.replace(/\.mp4$/, '-sfx.mp4'), from, to, -16);
    console.log(`done in ${((Date.now() - started) / 1000).toFixed(0)} s`);
  } finally {
    for (const f of pages) await f.close().catch(() => {});
    await srv.close();
    if (!KEEP) rmSync(tmp, { recursive: true, force: true });
    else console.log(`temporary files: ${tmp}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
