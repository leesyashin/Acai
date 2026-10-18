#!/usr/bin/env node
// Records real gameplay for the promo films (tools/promo): the real game in headless Chromium,
// played with real mouse drags by a small bot, frame by frame under a fake clock, so every frame
// is sharp and on time however slow the machine is. CSS and Web Animations are paused and stepped
// with the fake clock too. Writes JPEG frames and clip.json (pointer per frame, the bot's actions
// and the game's own sound calls with their times) into the output folder.
//
//   node tools/promo/capture.mjs [--out tools/promo/footage/main] [--level 10] [--seed 4]
//                                [--seconds 45] [--fps 30] [--dsf 2] [--lang de]
//
// tools/promo/render.mjs calls captureGameplay() itself when a film needs footage that is missing.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../serve.mjs';
import { launchBrowser } from '../../tests/e2e/helpers.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FOOTAGE_DIR = path.join(HERE, 'footage');

const SAVE_KEY = 'acaiFever.save.v1';
const ALL_ING = ['acai', 'pitaya', 'spirulina', 'banana', 'granola', 'strawberry', 'blueberry', 'mango', 'kiwi',
  'honey', 'coconut', 'chia', 'peanut', 'chocolate', 'mint', 'cacao'];
// the stage fills the viewport exactly (#app pads it by 16 / 8 px)
const PAD_X = 16;
const PAD_Y = 8;
const VIEW = { width: 1280 + 2 * PAD_X, height: 800 + 2 * PAD_Y };

function saveFor(lang, level) {
  const stars = {};
  for (let i = 1; i < level; i++) stars[i] = 3;
  return {
    version: 1, coins: 1800, owned: ALL_ING.slice(), ingLevels: { acai: 1, banana: 1, strawberry: 1 },
    upgrades: { blenderSpeed: 2, blender2: 1, bowlSlots: 1, smoothieSlots: 1, plants: 1, jukebox: 1, seating: 1, neon: 1 },
    stars, endlessBest: 0, newIngredients: [], seenIntros: { basics: true }, settings: { lang, music: false, sfx: false },
    stats: { served: 300, earned: 3000, played: level },
  };
}

// ------------------------------------------------------------------ the bot
// One decision per call, like a player: serve > smoothies > build bowls > pour > blend > put cups
// down (the same priorities as the playthrough e2e test).
const POURABLE = ['ready', 'overflowing'];
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
const matches = (b, o) => !!b.base && b.base === o.base && sameSet(b.mid, o.mid) && sameSet(b.top, o.top);
function onTrack(b, o) {
  if (!b.base || b.base !== o.base) return false;
  if (!b.mid.every((x) => o.mid.includes(x)) || !b.top.every((x) => o.top.includes(x))) return false;
  return b.top.length === 0 || o.mid.every((x) => b.mid.includes(x));
}
const nextMissing = (b, o) => o.mid.find((x) => !b.mid.includes(x)) || o.top.find((x) => !b.top.includes(x)) || null;

function plan(s) {
  const waiting = s.seats.filter((c) => c && c.state === 'waiting').sort((a, b) => a.patience - b.patience);
  const usedSlots = new Set();
  for (const c of waiting) {
    const fruit = c.order.smoothie;
    if (!fruit || c.delivered.smoothie) continue;
    const ready = s.slots.findIndex((x, i) => !usedSlots.has(i) && x.state === 'ready' && x.fruit === fruit);
    if (ready >= 0) return { kind: 'serveCup', slot: ready, cust: c.id };
    const mixing = s.slots.findIndex((x, i) => !usedSlots.has(i) && x.state === 'mixing' && x.fruit === fruit);
    if (mixing >= 0) {
      usedSlots.add(mixing);
      continue;
    }
    const empty = s.slots.findIndex((x) => x.state === 'empty');
    if (empty >= 0) return { kind: 'loadCup', slot: empty, fruit };
  }
  for (const c of waiting) {
    if (c.delivered.bowl) continue;
    const bi = s.bowls.findIndex((b) => matches(b, c.order.bowl));
    if (bi >= 0) return { kind: 'serveBowl', bowl: bi, cust: c.id };
  }
  const assigned = new Map();
  const needBowl = [];
  for (const c of waiting) {
    if (c.delivered.bowl) continue;
    const bi = s.bowls.findIndex((b, i) => !assigned.has(i) && onTrack(b, c.order.bowl));
    if (bi >= 0) assigned.set(bi, c);
    else needBowl.push(c);
  }
  for (const [bi, c] of assigned) {
    const ing = nextMissing(s.bowls[bi], c.order.bowl);
    if (ing) return { kind: 'add', bowl: bi, ing };
  }
  for (const c of needBowl) {
    const empty = s.bowls.findIndex((b) => !b.base);
    const bl = s.blenders.findIndex((b) => POURABLE.includes(b.state) && b.base === c.order.bowl.base);
    if (empty >= 0 && bl >= 0) return s.bowls[empty].cup ? { kind: 'pour', blender: bl, bowl: empty } : { kind: 'placeCup', bowl: empty };
  }
  const ruined = s.blenders.findIndex((b) => b.state === 'ruined');
  if (ruined >= 0) return { kind: 'cleanBlender', blender: ruined };
  const demand = {};
  for (const c of needBowl) demand[c.order.bowl.base] = (demand[c.order.bowl.base] || 0) + 1;
  for (const [base, n] of Object.entries(demand)) {
    const supply = s.blenders
      .filter((b) => b.base === base && (b.state === 'blending' || POURABLE.includes(b.state)))
      .reduce((sum, b) => sum + (b.state === 'blending' ? b.maxPortions : b.portions), 0);
    if (supply >= n) continue;
    const free = s.blenders.findIndex((b) => b.state === 'empty');
    if (free >= 0) return { kind: 'loadBlender', blender: free, base };
  }
  const noCup = s.bowls.findIndex((b) => !b.cup);
  if (noCup >= 0) return { kind: 'placeCup', bowl: noCup };
  return null;
}

const cust = (id) => `[data-customer-id="${id}"] .g-figure`;
function dragFor(a) {
  switch (a.kind) {
    case 'serveBowl': return { from: `[data-bowl="${a.bowl}"]`, to: cust(a.cust) };
    case 'add': return { from: `[data-bin="${a.ing}"]`, to: `[data-bowl="${a.bowl}"]` };
    case 'pour': return { from: `[data-blender="${a.blender}"]`, to: `[data-bowl="${a.bowl}"]` };
    case 'placeCup': return { from: '[data-cup-stack]', to: `[data-bowl="${a.bowl}"]` };
    case 'loadBlender': return { from: `[data-pack="${a.base}"]`, to: `[data-blender="${a.blender}"]` };
    case 'cleanBlender': return { from: `[data-blender="${a.blender}"]`, to: '[data-trash]' };
    case 'loadCup': return { from: `[data-bin="${a.fruit}"]`, to: `[data-smoothie-slot="${a.slot}"]` };
    case 'serveCup': return { from: `[data-smoothie-slot="${a.slot}"]`, to: cust(a.cust) };
    default: throw new Error(`unknown action ${a.kind}`);
  }
}

const snapshot = () => {
  const g = window.__acaiGame;
  if (!g) return null;
  return {
    status: g.status, money: g.money,
    seats: g.seats.map((c) => c && { id: c.id, state: c.state, patience: c.patience, order: c.order, delivered: { ...c.delivered } }),
    bowls: g.bowls.map((b) => ({ cup: b.cup, base: b.base, mid: [...b.mid], top: [...b.top] })),
    blenders: g.blenders.map((b) => ({ state: b.state, base: b.base, portions: b.portions, maxPortions: b.maxPortions })),
    slots: g.smoothie ? g.smoothie.slots.map((x) => ({ state: x.state, fruit: x.fruit })) : [],
  };
};

// ------------------------------------------------------------------ in the page
// Steps every CSS / Web Animation with the fake clock: paused when first seen, then set to the
// fake time since; finished ones are finished so their events and cleanups run.
const syncAnimations = () => {
  const now = performance.now();
  for (const a of document.getAnimations()) {
    if (a.__v === undefined) {
      a.__v = now - 8;
      a.pause();
    }
    const t = now - a.__v;
    const end = a.effect ? a.effect.getComputedTiming().endTime : Infinity;
    if (Number.isFinite(end) && t >= end) {
      try {
        a.finish();
      } catch {
        a.currentTime = end;
      }
    } else a.currentTime = t;
  }
};

// Logs the game's sound calls (the film plays them back in sync); the context stays locked.
const hookAudio = () => {
  const a = window.__acaiAudio;
  const log = (window.__soundLog = []);
  const star = { last: -1e9, step: 0 };
  let tick = false;
  a.sfx = (name) => {
    const t = performance.now() / 1000;
    const e = { t, name };
    if (name === 'star') {
      star.step = t - star.last < 1.5 ? star.step + 1 : 0;
      star.last = t;
      e.step = star.step;
    }
    if (name === 'tick') {
      e.alt = tick;
      tick = !tick;
    }
    log.push(e);
    return true;
  };
  const loops = {};
  a.loop = (id, on) => {
    if (loops[id] === !!on) return;
    loops[id] = !!on;
    log.push({ t: performance.now() / 1000, loop: id, on: !!on });
  };
  a.music = () => {};
};

// ------------------------------------------------------------------ capture
export async function captureGameplay({
  url, out, level = 10, seed = 4, seconds = 45, fps = 30, dsf = 2, lang = 'de', quality = 88, log = console.log,
}) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const b = await launchBrowser({ viewport: VIEW, deviceScaleFactor: dsf, fonts: 'real', locale: lang === 'en' ? 'en-US' : 'de-DE' });
  const { page } = b;
  const T0 = Date.parse('2026-05-01T10:00:00Z');
  try {
    await page.clock.install({ time: T0 });
    await page.goto(`${url}index.html`);
    await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [SAVE_KEY, saveFor(lang, level)]);
    await page.reload();
    await page.waitForFunction(() => window.__acaiScreen?.() === 'title');
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: '#stage-wrap{border-radius:0!important;box-shadow:none!important}' });
    await page.evaluate(hookAudio);
    await page.evaluate(([lv, sd]) => window.__acaiGo('game', { mode: 'campaign', levelId: lv, seed: sd }), [level, seed]);
    await page.clock.runFor(300);
    await page.clock.pauseAt(T0 + 120000);
    // the footage's time 0: sound times are counted from here
    const start = await page.evaluate(() => performance.now() / 1000);

    const clip = { fps, dsf, width: 1280, height: 800, level, seed, lang, frames: 0, pointer: [], actions: [], sounds: [] };
    let pointer = { x: 640, y: 560, down: 0 };
    const total = Math.round(seconds * fps);
    const frame = async () => {
      await page.clock.runFor(1000 / fps);
      await page.evaluate(syncAnimations);
      const jpg = await page.screenshot({ type: 'jpeg', quality, clip: { x: PAD_X, y: PAD_Y, width: 1280, height: 800 } });
      clip.frames++;
      writeFileSync(path.join(out, `${String(clip.frames).padStart(5, '0')}.jpg`), jpg);
      clip.pointer.push([Math.round(pointer.x), Math.round(pointer.y), pointer.down]);
      if (clip.frames % 150 === 0) log(`  gameplay ${clip.frames}/${total} frames`);
    };
    const move = async (x, y, down = pointer.down) => {
      pointer = { x, y, down };
      await page.mouse.move(x + PAD_X, y + PAD_Y);
    };
    const centre = (sel) => page.evaluate(([s, px, py]) => {
      const el = document.querySelector(s);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2 - px, y: r.y + r.height / 2 - py };
    }, [sel, PAD_X, PAD_Y]);
    const ease = (k) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);

    // A drag like a person makes it: the finger travels to the source, presses, carries the item on
    // a slight arc, rests over the target and lets go.
    async function drag(a) {
      const d = dragFor(a);
      const p0 = await centre(d.from);
      const p1 = await centre(d.to);
      if (!p0 || !p1) return false;
      const from = { ...pointer };
      const travel = Math.max(5, Math.min(10, Math.round(Math.hypot(p0.x - from.x, p0.y - from.y) / 70)));
      for (let i = 1; i <= travel; i++) {
        const k = ease(i / travel);
        await move(from.x + (p0.x - from.x) * k, from.y + (p0.y - from.y) * k, 0);
        await frame();
      }
      const f0 = clip.frames;
      await page.mouse.down();
      pointer.down = 1;
      await frame();
      await frame();
      await frame();
      const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const n = Math.max(11, Math.min(20, Math.round(dist / 38)));
      const lift = Math.min(80, dist * 0.18);
      for (let i = 1; i <= n; i++) {
        const k = ease(i / n);
        await move(p0.x + (p1.x - p0.x) * k, p0.y + (p1.y - p0.y) * k - Math.sin(Math.PI * (i / n)) * lift, 1);
        await frame();
      }
      await frame();
      await page.mouse.up();
      pointer.down = 0;
      clip.actions.push({ ...a, from: d.from, to: d.to, start: f0, drop: clip.frames, p0, p1 });
      await frame();
      return true;
    }

    while (clip.frames < total) {
      const s = await page.evaluate(snapshot);
      if (!s || s.status !== 'playing') {
        await frame();
        continue;
      }
      const a = plan(s);
      if (!a || !(await drag(a))) {
        await frame();
        continue;
      }
      // a short breath between moves
      for (let i = 0; i < 3; i++) await frame();
    }
    const sounds = await page.evaluate(() => window.__soundLog);
    clip.sounds = sounds.map((e) => ({ ...e, t: Math.round((e.t - start) * 1000) / 1000 })).filter((e) => e.t >= 0 && e.t <= clip.frames / fps);
    clip.money = await page.evaluate(() => window.__acaiGame?.money ?? 0);
    writeFileSync(path.join(out, 'clip.json'), JSON.stringify(clip));
    return clip;
  } finally {
    await b.close();
  }
}

// ------------------------------------------------------------------ CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (name, def) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : def;
  };
  const srv = await startServer({ port: Number(opt('port', 8092)) });
  try {
    const out = path.resolve(opt('out', path.join(FOOTAGE_DIR, 'main')));
    const t = Date.now();
    const clip = await captureGameplay({
      url: srv.url, out, level: Number(opt('level', 10)), seed: Number(opt('seed', 4)), seconds: Number(opt('seconds', 45)),
      fps: Number(opt('fps', 30)), dsf: Number(opt('dsf', 2)), lang: opt('lang', 'de'),
    });
    console.log(`${clip.frames} frames, ${clip.actions.length} moves, ${clip.sounds.length} sounds, ${clip.money} coins → ${out} (${((Date.now() - t) / 1000).toFixed(0)} s)`);
  } finally {
    await srv.close();
  }
}
