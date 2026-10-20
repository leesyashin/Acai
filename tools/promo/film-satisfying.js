// The 'satisfying' promo film (tools/promo, ?version=satisfying): an "oddly satisfying" TikTok cut fast –
// a bowl built in jump cuts on a warm pastel set: the finished bowl slams in as the hook, the açaí is
// blended and poured, six toppings land on the half beats (each a punch, a new framing, its name as a
// caption and a rising note), "perfect!", a matcha from the matcha bar fills with ice and cold foam, a
// parade of bowls in flashing colours, the end card. The game's menu bossa as a 124 BPM house groove.

import { logoSVG, bowlSVG, ingredientIcon, packIcon, matchaGlassSVG, blenderBadgeSVG } from '../../js/art.js';
import * as ART from '../../js/art.js';
import * as DATA from '../../js/data.js';
import { createRng } from '../../js/rng.js';
import { clamp, lerp, prog, ease, spring, jiggle, decay, wob } from './motion.js';
import { Sprite, View3D, Burst, div } from './kit.js';
import { capWords, emojiBurst, sticker } from './tiktok.js';

const COPY = {
  de: {
    hook: ['DAS', 'BEFRIEDIGENDSTE', 'SPIEL', 'EVER'],
    blend: 'MIXEN',
    pour: 'EINGIESSEN',
    perfect: 'PERFEKT!',
    matcha: 'MATCHA',
    ice: 'EIS',
    foam: 'COLD FOAM',
    parade: ['23', 'ZUTATEN', '1000+', 'KOMBIS'],
    play: 'JETZT SPIELEN',
    free: ['kostenlos im Browser · Link in Bio'],
    url: 'leesyashin.github.io/Acai',
  },
  en: {
    hook: ['THE', 'MOST SATISFYING', 'GAME', 'EVER'],
    blend: 'BLEND',
    pour: 'POUR',
    perfect: 'PERFECT!',
    matcha: 'MATCHA',
    ice: 'ICE',
    foam: 'COLD FOAM',
    parade: ['23', 'INGREDIENTS', '1000+', 'COMBOS'],
    play: 'PLAY NOW',
    free: ['free in your browser · link in bio'],
    url: 'leesyashin.github.io/Acai',
  },
};

// The menu track's chords (Fmaj7 · Gm7 · Am7 · Gm7 · C7) under the game's groove, into the final Fmaj7.
export const CUTS = {
  satisfying: {
    track: 'menu',
    theme: 'cream',
    energy: 1,
    bounce: [0, 18],
    bounceAmp: 0.022,
    scenes: [['sfHook', 2, { enter: null }], ['sfBlend', 2], ['sfPour', 2], ['sfTop', 4], ['sfMatcha', 4], ['sfParade', 4], ['sfEnd', 6]],
    music: [
      { style: 'drop', g: 0 }, { style: 'groove', g: 2 }, { style: 'drop', g: 4, harmony: true }, { style: 'groove', g: 12, harmony: true, fill: true },
      { style: 'groove', g: 13, harmony: true, fill: true }, { style: 'end', chord: 'Fmaj7' },
    ],
  },
};

// the bowl of the film and the order its toppings land in
const BOWL = { base: 'acai', mid: ['banana', 'strawberry', 'blueberry'], top: ['honey', 'coconut', 'mint'] };
const STEPS = [...BOWL.mid.map((id) => ['mid', id]), ...BOWL.top.map((id) => ['top', id])];
const CUP = { x: 540, y: 1180, size: 820 };
const RIM_Y = CUP.y - CUP.size * 0.25; // the cup's rim (bowlSVG: viewBox 200, rim at 50)
const SPARK = '<svg width="70" height="70" viewBox="0 0 100 100"><path d="M50 4C54 36 64 46 96 50C64 54 54 64 50 96C46 64 36 54 4 50C36 46 46 36 50 4Z" fill="#fff"/></svg>';

// a layer seen through a camera: scale s around the frame point (x, y), turned by r degrees
function camLayer(root) {
  const el = div(root, 'layer');
  el.style.transformOrigin = '0 0';
  let last = '';
  return (s, x, y, r = 0) => {
    const tf = `translate(540px,960px) rotate(${r.toFixed(2)}deg) translate(${(-x * s).toFixed(2)}px,${(-y * s).toFixed(2)}px) scale(${s.toFixed(4)})`;
    if (tf !== last) el.style.transform = last = tf;
    return el;
  };
}

// soft light specks drifting up through the set
function dust(root, seed, n = 14) {
  const rng = createRng(seed);
  const ps = [...Array(n)].map(() => ({
    sp: new Sprite(root, '<div class="dust"></div>'),
    x: rng.range(40, 1040), y: rng.range(200, 2000), v: rng.range(30, 80), s: rng.range(0.9, 2.6), ph: rng.range(0, 6),
  }));
  return (lt) => ps.forEach((p) => p.sp.set({ x: p.x + Math.sin(lt * 1.4 + p.ph) * 26, y: p.y - p.v * lt, s: p.s, o: 0.3 + 0.3 * Math.sin(lt * 2.6 + p.ph) }));
}

// a slam: from big to its size in 0.1 s, then a springy settle (k: time since it landed)
const slam = (k, from = 2.2) => (k < 0 ? 0 : k < 0.1 ? lerp(from, 0.92, ease.inQuad(k / 0.1)) : 0.92 + 0.08 * spring(k - 0.1, 3, 8));

export function scenes({ lang, b, cue, loops, fx, popIn, confettiBurst, PLAY_ICON }) {
  const C = COPY[lang] || COPY.de;
  const S = {};
  const name = (id) => DATA.ingName(id).toUpperCase();
  const hit = (t, { punch = 0.04, flash = 0.25, shake = 0, impact = false, glitch = false } = {}) => {
    fx.punch(t, punch, 9);
    if (flash) fx.flash(t, flash, 12);
    if (shake) fx.shake(t, shake, 8);
    if (impact) fx.impact(t);
    if (glitch) fx.glitch(t);
  };

  // ================================================================ hook: the finished bowl slams in
  S.sfHook = (root, from, to) => {
    const air = dust(root, 3);
    const floor = new Sprite(root, '<div class="sf-floor"></div>');
    const bowl = new Sprite(root, bowlSVG(BOWL, 900));
    const sparks = [[180, 520], [900, 600], [220, 1180], [880, 1240], [540, 300]].map(([x, y]) => ({ sp: new Sprite(root, SPARK), x, y }));
    const caps = capWords(root, C.hook.map((w, i) => [b(i * 0.5), b(i * 0.5 + 0.5), w, ['', 'y', '', 'p'][i]]), { y: 1560, size: C.hook[1].length > 12 ? 92 : 108 });
    const emo = emojiBurst(root, { emojis: ['🤤', '✨', '💜', '😍'], x: 540, y: 900, t0: b(1.5), n: 12, seed: 4 });
    const L = 0.1;
    cue(from + L, 'boom', { gain: 0.9 });
    cue(from + L, 'plop', { kind: 'sfx', gain: 0.7 });
    C.hook.forEach((_, i) => { if (i) cue(from + b(i * 0.5), 'pop', { gain: 0.35, pitch: i * 2 }); });
    cue(from + b(1.5), 'bling', { gain: 0.6 });
    hit(from + L, { punch: 0.06, flash: 0.5, shake: 26, impact: true });
    hit(from + b(1.5), { punch: 0.03, flash: 0 });
    cue(from + b(1.85), 'whoosh', { gain: 0.5 });
    return {
      from, to, leave: ['zoomBlurOut', 0.12],
      update(lt) {
        air(lt);
        floor.set({ x: 540, y: 1300 });
        const k = lt - L;
        bowl.set({ x: 540, y: 880 + Math.sin(lt * 5) * 8, s: lt < L ? lerp(1.6, 1, lt / L) : slam(k, 1) * (1 + lt * 0.05), r: Math.sin(lt * 4) * 3 });
        sparks.forEach((p, i) => {
          const q = popIn(lt - L - i * 0.05, { f: 3, d: 8 });
          p.sp.set({ x: p.x, y: p.y, s: q.s * (0.7 + 0.3 * Math.sin(lt * 9 + i)), r: lt * 120, o: q.o });
        });
        caps(lt);
        emo.update(lt);
      },
    };
  };

  // ================================================================ blend: the pack slams into the jug, the vortex ramps up
  S.sfBlend = (root, from, to) => {
    const cam = camLayer(root);
    const set = cam(1, 540, 960);
    const floor = new Sprite(set, '<div class="sf-floor"></div>');
    const blender = new View3D(set, 'blender', 1100);
    const pack = new Sprite(set, packIcon('acai', 300));
    const badge = new Sprite(set, blenderBadgeSVG('ready', 170));
    const caps = capWords(root, [[0, b(2), C.blend, 'c']], { y: 330 });
    const BY = 1230;
    const MOUTH = [560, BY - 470];
    const Td = b(0.35);
    const Tr = b(1.55);
    cue(from + Td, 'plop', { kind: 'sfx', gain: 0.8 });
    cue(from + Td, 'thud', { gain: 0.6 });
    cue(from + Td + 0.03, 'blenderStart', { kind: 'sfx', gain: 0.6 });
    loops.push({ id: 'blender', from: from + Td + 0.05, to: from + Tr, gain: 0.9 });
    cue(from + Tr - b(0.6), 'riser', { len: b(0.6), gain: 0.5 });
    cue(from + Tr, 'blenderReady', { kind: 'sfx', gain: 0.8 });
    cue(from + Tr + 0.02, 'bling', { gain: 0.5 });
    hit(from + Td, { punch: 0.05, flash: 0.25, shake: 18 });
    hit(from + Tr, { punch: 0.05, flash: 0.35, impact: true });
    return {
      from, to, enter: null, leave: null,
      update(lt) {
        // push in on the jug while it spins faster and faster
        const z = ease.inCubic(prog(lt, Td, Tr));
        cam(lerp(1, 1.45, z), 540, lerp(1000, 820, z), lerp(0, 5, z));
        floor.set({ x: 540, y: BY + 470 });
        const p = ease.inQuad(prog(lt, Td, Tr));
        const state = lt < Td ? { state: 'empty' } : lt < Tr ? { state: 'blending', base: 'acai', progress: p, remaining: 2 } : { state: 'ready', base: 'acai', portions: 2, maxPortions: 2 };
        blender.draw({ tier: 2, ...state }, lt * (1 + 3 * p));
        const hop = jiggle(lt - Td, 4, 8) * 0.05 + jiggle(lt - Tr, 3, 7) * 0.05;
        const hum = lt > Td && lt < Tr ? wob(lt * 3, 4) * (2 + 8 * p) : 0;
        blender.sprite.set({ x: 540 + hum, y: BY - hop * 300, sx: 1 + hop, sy: 1 - hop });
        const k = ease.inQuad(prog(lt, 0, Td));
        if (lt < Td) pack.set({ x: lerp(620, MOUTH[0], k), y: lerp(-300, MOUTH[1], k), s: lerp(1, 0.65, k), r: lerp(20, -10, k) });
        else pack.set({ x: MOUTH[0], y: MOUTH[1] + 60, s: 0.65 * (1 - prog(lt, Td, Td + 0.08)), r: -10, o: 1 - prog(lt, Td, Td + 0.08) });
        const bp = popIn(lt - Tr, { f: 3, d: 8 });
        badge.set({ x: 830, y: BY - 420 + bp.dy, s: bp.s, o: bp.o });
        caps(lt);
      },
    };
  };

  // ================================================================ pour: the jug tips in, the cup fills in one beat
  S.sfPour = (root, from, to) => {
    const cam = camLayer(root);
    const set = cam(1, 540, 960);
    const floor = new Sprite(set, '<div class="sf-floor"></div>');
    const cupEmpty = new Sprite(set, bowlSVG({}, CUP.size));
    const cupFull = new Sprite(set, bowlSVG({ base: 'acai' }, CUP.size));
    const blender = new View3D(set, 'blender', 560);
    const stream = new Sprite(set, '<div style="width:56px;height:400px;border-radius:28px;background:linear-gradient(90deg,#4a1a5e,#7b3a96 45%,#5a1f73)"></div>');
    stream.el.style.transformOrigin = '0 -200px';
    const caps = capWords(root, [[0, b(2), C.pour, 'p']], { y: 330 });
    const P0 = b(0.4);
    const P1 = b(1.4);
    cue(from + 0.02, 'swish', { gain: 0.5 });
    cue(from + P0, 'pour', { kind: 'sfx', gain: 0.7 });
    cue(from + P0 + 0.05, 'glug', { gain: 0.9, len: P1 - P0 });
    cue(from + P1, 'plop', { kind: 'sfx', gain: 0.7 });
    hit(from, { punch: 0.03, flash: 0.2, glitch: true });
    hit(from + P1, { punch: 0.05, flash: 0.2 });
    cue(from + b(1.85), 'whoosh', { gain: 0.45 });
    return {
      from, to, enter: ['slamIn', 0.12], leave: null,
      update(lt) {
        const z = ease.inOutCubic(prog(lt, P1, b(2)));
        cam(lerp(1.05, 1.25, z), 540, lerp(1040, 1080, z));
        floor.set({ x: 540, y: CUP.y + 330 });
        const fill = ease.inOutQuad(prog(lt, P0 + 0.05, P1));
        const sq = jiggle(lt - P1, 3, 7) * 0.04;
        const cupT = { x: CUP.x, y: CUP.y + sq * 100, sx: 1 + sq, sy: 1 - sq };
        cupEmpty.set(cupT);
        if (fill > 0) {
          cupFull.set(cupT);
          cupFull.in.style.clipPath = `inset(${((1 - fill * 0.78) * 100).toFixed(2)}% -50% -50% -50%)`;
        } else cupFull.hide();
        const bin = ease.outCubic(prog(lt, 0, P0));
        const bout = ease.inCubic(prog(lt, P1, P1 + b(0.5)));
        if (bout >= 1) blender.sprite.hide();
        else {
          blender.draw({ tier: 2, state: 'ready', base: 'acai', portions: 2 - Math.round(fill), maxPortions: 2 }, lt);
          blender.sprite.set({ x: lerp(-200, 400, bin) - bout * 700, y: lerp(300, 690, bin) - bout * 420, r: lerp(20, 100, bin) - bout * 30 });
        }
        const sk = prog(lt, P0, P0 + 0.1) * (1 - prog(lt, P1 - 0.1, P1));
        if (sk > 0) stream.set({ x: 520 + Math.sin(lt * 30) * 3, y: 820, sy: sk });
        else stream.hide();
        caps(lt);
      },
    };
  };

  // ================================================================ six toppings on the half beats, each a new framing
  S.sfTop = (root, from, to) => {
    const cam = camLayer(root);
    const set = cam(1, 540, 960);
    const floor = new Sprite(set, '<div class="sf-floor"></div>');
    const cup = new Sprite(set, '');
    const bowls = [];
    let acc = { base: 'acai', mid: [], top: [] };
    bowls.push(bowlSVG(acc, CUP.size));
    for (const [layer, id] of STEPS) {
      acc = { ...acc, [layer]: [...acc[layer], id] };
      bowls.push(bowlSVG(acc, CUP.size));
    }
    const drops = STEPS.map((_, i) => b(0.25 + i * 0.5));
    const icons = STEPS.map(([, id]) => new Sprite(set, ingredientIcon(id, 240)));
    const crumbs = STEPS.map(([, id], i) => new Burst(set, {
      n: 9, seed: 70 + i, x: CUP.x, y: RIM_Y + 20, t0: drops[i], speed: [300, 700], angle: [-165, -15], gravity: 1800, drag: 1.6, life: [0.35, 0.6], scale: [0.25, 0.45],
      html: () => ingredientIcon(id, 90),
    }));
    const caps = capWords(root, STEPS.map(([, id], i) => [drops[i], i < 5 ? drops[i + 1] : b(3.1), name(id), i % 2 ? '' : 'y']), { y: 360, size: 104 });
    const stamp = new Sprite(root, `<div class="stamp">${C.perfect}</div>`);
    const TP = b(3.1);
    const emo = emojiBurst(root, { emojis: ['😍', '✨', '🤤', '💯'], x: 540, y: 1000, t0: TP, n: 14, seed: 9 });
    const shine = new Burst(set, {
      n: 14, seed: 9, x: CUP.x, y: CUP.y - 120, t0: TP, speed: [600, 1200], gravity: 300, drag: 2.4, life: [0.6, 1], scale: [0.4, 0.9], spin: [-200, 200], html: () => SPARK,
    });
    // the camera framing of each landing: [scale, x, y, turn]
    const shots = [[1.25, 540, 1080, 0], [1.5, 470, 990, -4], [1.35, 620, 1030, 3], [1.6, 540, 960, 0], [1.4, 450, 1010, -3], [1.55, 630, 980, 4]];
    drops.forEach((d, i) => {
      cue(from + d - 0.12, 'swish', { gain: 0.2 });
      cue(from + d, 'plop', { kind: 'sfx', gain: 0.9 });
      cue(from + d + 0.01, 'pop', { gain: 0.45, pitch: i + 2 });
      hit(from + d, { punch: 0.045, flash: 0.12 });
    });
    cue(from + TP, 'stamp', { gain: 0.8 });
    cue(from + TP + 0.02, 'bling', { gain: 0.7 });
    hit(from + TP, { punch: 0.06, flash: 0.5, shake: 24, impact: true });
    cue(from + b(3.85), 'whoosh', { gain: 0.5 });
    return {
      from, to, enter: null, leave: ['zoomBlurOut', 0.12],
      update(lt) {
        let n = 0;
        drops.forEach((d) => { if (lt >= d) n++; });
        // a hard cut to the next framing at each landing, drifting in between; back out for the stamp
        const sh = shots[Math.max(0, n - 1)];
        const drift = n ? (lt - drops[n - 1]) * 0.06 : 0;
        const out = ease.outCubic(prog(lt, TP - 0.05, TP + 0.15));
        cam(lerp(sh[0] + drift, 1.02, out), lerp(sh[1], 540, out), lerp(sh[2], 1080, out), lerp(sh[3], 0, out));
        floor.set({ x: 540, y: CUP.y + 330 });
        const last = n ? drops[n - 1] : -9;
        const sq = jiggle(lt - last, 4, 8) * 0.05 + jiggle(lt - TP, 3, 6) * 0.06;
        cup.html(bowls[n]).set({ x: CUP.x, y: CUP.y + sq * 120, sx: 1 + sq, sy: 1 - sq });
        icons.forEach((ic, i) => {
          const d = drops[i];
          const k = (lt - (d - 0.16)) / 0.16;
          if (k < 0 || lt > d + 0.04) return ic.hide();
          const fall = ease.inQuad(clamp(k));
          return ic.set({ x: CUP.x + (i % 2 ? 40 : -40) * (1 - fall), y: lerp(RIM_Y - 520, RIM_Y + 10, fall), s: 0.65, r: (1 - fall) * (i % 2 ? 60 : -60) });
        });
        crumbs.forEach((c) => c.update(lt));
        shine.update(lt);
        caps(lt);
        const q = lt - TP;
        stamp.set({ x: 540, y: 380, s: q < 0 ? 0 : slam(q, 3), r: -8, o: q < 0 ? 0 : 1 });
        emo.update(lt);
      },
    };
  };

  // ================================================================ a matcha from the matcha bar: fill, ice, cold foam
  S.sfMatcha = (root, from, to) => {
    const SIZE = 820;
    const GX = 540;
    const GY = 1180;
    const RIM = GY - SIZE / 2 + SIZE * 0.21; // the glass's rim (matchaGlassSVG: viewBox 100, rim at 21)
    const air = dust(root, 11);
    const floor = new Sprite(root, '<div class="sf-floor"></div>');
    const glassA = new Sprite(root, '');
    const glassB = new Sprite(root, '');
    const fruit = new Sprite(root, ingredientIcon('strawberry', 240));
    const ice = new Sprite(root, ingredientIcon('ice', 220));
    const jet = new Sprite(root, `<div style="width:${Math.round(SIZE * 0.048)}px;height:${Math.round(RIM)}px;border-radius:0 0 12px 12px"></div>`);
    jet.el.style.transformOrigin = '0 0';
    const jetEl = jet.in.firstChild;
    const side = [['mMango', ['ice'], 165, 1060, -8], ['mBlueberry', ['foam'], 915, 1060, 8], ['mBanana', ['vanilla'], 165, 1420, -5], ['mStrawberry', ['ice', 'vanilla'], 915, 1420, 5]]
      .map(([id, extras, x, y, r]) => ({ sp: new Sprite(root, matchaGlassSVG(id, 'ready', 300, { extras })), x, y, r }));
    const Tf = b(0.25);
    const F0 = b(0.5);
    const F1 = b(1.9);
    const Ti = b(2.25);
    const Tc = b(2.75);
    const Ts = b(3.25);
    const caps = capWords(root, [[0, Ti, C.matcha, 'g'], [Ti, Tc, C.ice, 'c'], [Tc, b(4), C.foam, '']], { y: 330 });
    const emo = emojiBurst(root, { emojis: ['🍵', '💚', '🧊', '✨'], x: 540, y: 900, t0: Ts, n: 12, seed: 12 });
    cue(from + 0.02, 'swish', { gain: 0.5 });
    cue(from + Tf, 'plop', { kind: 'sfx', gain: 0.8 });
    cue(from + F0, 'pour', { kind: 'sfx', gain: 0.6 });
    cue(from + F0 + 0.05, 'glug', { gain: 0.8, len: F1 - F0 });
    cue(from + F1, 'matchaReady', { kind: 'sfx', gain: 0.7 });
    cue(from + Ti, 'plop', { kind: 'sfx', gain: 0.8 });
    cue(from + Ti + 0.01, 'pop', { gain: 0.4, pitch: 5 });
    cue(from + Tc, 'bling', { gain: 0.6 });
    side.forEach((_, i) => cue(from + Ts + i * 0.05, 'pop', { gain: 0.3, pitch: 4 + i }));
    hit(from, { punch: 0.03, flash: 0.3, glitch: true });
    hit(from + Tf, { punch: 0.04, flash: 0 });
    hit(from + Ti, { punch: 0.05, flash: 0.2, shake: 14 });
    hit(from + Tc, { punch: 0.05, flash: 0.3 });
    hit(from + Ts, { punch: 0.04, flash: 0.2 });
    cue(from + b(3.85), 'whoosh', { gain: 0.5 });
    // two neighbouring fill steps of the glass (it draws twelve) cross-faded into a smooth rise
    const glassAt = (k) => {
      const q = clamp(k) * 12;
      const lo = Math.floor(q);
      const a = matchaGlassSVG('mStrawberry', 'mixing', SIZE, { fill: lo / 12, from: 99 });
      const bb = matchaGlassSVG('mStrawberry', 'mixing', SIZE, { fill: Math.min(12, lo + 1) / 12, from: 99 });
      return [a, bb, q - lo];
    };
    return {
      from, to, enter: ['zoomBlurIn', 0.14], leave: ['whipOut', 0.1],
      update(lt) {
        air(lt);
        floor.set({ x: GX, y: GY + 330 });
        const sq = jiggle(lt - Tf, 4, 8) * 0.04 + jiggle(lt - Ti, 4, 8) * 0.05 + jiggle(lt - Tc, 3, 7) * 0.04;
        const zoom = 1 + 0.08 * ease.outCubic(prog(lt, F0, F1));
        const g = { x: GX, y: GY + sq * 100, sx: 1 + sq, sy: 1 - sq, s: zoom };
        if (lt < Tf) {
          glassA.html(matchaGlassSVG(null, 'empty', SIZE)).set(g);
          glassB.hide();
        } else if (lt < F1) {
          const [a, bb, mix] = glassAt(prog(lt, F0, F1));
          glassA.html(a).set(g);
          glassB.html(bb).set({ ...g, o: mix });
        } else {
          const extras = lt < Ti ? [] : lt < Tc ? ['ice'] : ['ice', 'foam'];
          glassA.html(matchaGlassSVG('mStrawberry', 'ready', SIZE, { extras })).set(g);
          glassB.hide();
        }
        const kf = ease.inQuad(prog(lt, 0, Tf));
        if (lt < Tf + 0.04) fruit.set({ x: GX + 20, y: lerp(-200, GY + 120, kf), r: kf * 120, s: 0.8, o: lt > Tf ? 1 - (lt - Tf) / 0.04 : 1 });
        else fruit.hide();
        const ki = ease.inQuad(prog(lt, Ti - 0.18, Ti));
        if (lt > Ti - 0.18 && lt < Ti + 0.04) ice.set({ x: GX - 30, y: lerp(-180, GY - 60, ki), r: ki * -90, s: 0.9 });
        else ice.hide();
        const on = prog(lt, F0 - 0.08, F0) * (1 - prog(lt, F1 - 0.15, F1 - 0.03));
        if (on > 0) {
          // the same colours as the stream the glass draws inside: milk first, then matcha
          const col = ART.MATCHA_COLORS || { milk: '#f4efe3', light: '#a9c45a' };
          jetEl.style.background = prog(lt, F0, F1) < (ART.MATCHA_MILK ?? 0.42) ? col.milk : col.light;
          jet.set({ x: GX - SIZE * 0.002, y: RIM / 2, sy: on });
        } else jet.hide();
        side.forEach((c, i) => {
          const q = lt - Ts - i * 0.05;
          c.sp.set({ x: c.x, y: c.y, s: q < 0 ? 0 : slam(q, 2), r: c.r, o: q < 0 ? 0 : 1 });
        });
        caps(lt);
        emo.update(lt);
      },
    };
  };

  // ================================================================ a parade of bowls and drinks, a cut on every half beat
  S.sfParade = (root, from, to) => {
    const items = [
      bowlSVG({ base: 'pitaya', mid: ['mango', 'kiwi'], top: ['coconut', 'mint'] }, 760),
      matchaGlassSVG('mMango', 'ready', 760, { extras: ['ice'] }),
      bowlSVG({ base: 'spirulina', mid: ['blueberry', 'banana', 'strawberry'], top: ['chia'] }, 760),
      bowlSVG({ base: 'acai', mid: ['strawberry', 'blueberry', 'granola'], top: ['chocolate', 'mint'] }, 760),
      matchaGlassSVG('mBlueberry', 'ready', 760, { extras: ['foam', 'vanilla'] }),
      bowlSVG({ base: 'pitaya', mid: ['banana', 'kiwi', 'blueberry'], top: ['peanut', 'honey'] }, 760),
      bowlSVG({ base: 'spirulina', mid: ['mango', 'strawberry'], top: ['cacao', 'coconut'] }, 760),
      bowlSVG({ base: 'acai', mid: ['banana', 'kiwi', 'mango'], top: ['honey', 'coconut', 'mint'] }, 760),
    ];
    const COLS = ['#ff8cc0', '#ffd36b', '#7ff0f3', '#c9a6ff', '#a6f5c0', '#ffb08a', '#8fd0ff', '#ff9fd6'];
    const bgs = COLS.map((c) => new Sprite(root, `<div style="width:1200px;height:2100px;background:radial-gradient(circle at 50% 46%,#fff 0,${c} 55%)"></div>`));
    const sps = items.map((html) => new Sprite(root, html));
    const caps = capWords(root, C.parade.map((w, i) => [b(i), b(i + 1), w, ['y', '', 'p', ''][i]]), { y: 1560 });
    items.forEach((_, i) => {
      cue(from + b(i * 0.5), i % 2 ? 'swish' : 'whoosh', { gain: 0.35 });
      cue(from + b(i * 0.5) + 0.02, 'pop', { gain: 0.35, pitch: (i * 3) % 9 });
      hit(from + b(i * 0.5), { punch: 0.04, flash: 0.18 });
    });
    fx.glitch(from + b(2));
    return {
      from, to, enter: null, leave: ['zoomBlurOut', 0.12],
      update(lt) {
        const i = Math.min(items.length - 1, Math.floor(lt / b(0.5)));
        const k = lt - b(i * 0.5);
        bgs.forEach((bg, j) => (j === i ? bg.set({ x: 540, y: 960 }) : bg.hide()));
        sps.forEach((sp, j) => {
          if (j !== i) return sp.hide();
          return sp.set({ x: 540, y: 900, s: slam(k, 1.5) * (1 + k * 0.1), r: (j % 2 ? 6 : -6) * (1 - Math.min(1, k * 3)) + Math.sin(lt * 6) * 2 });
        });
        caps(lt);
      },
    };
  };

  // ================================================================ the end card
  S.sfEnd = (root, from, to) => {
    const row = [
      { base: 'pitaya', mid: ['mango', 'kiwi'], top: ['coconut', 'mint'] },
      { base: 'acai', mid: ['banana', 'strawberry', 'granola'], top: ['honey'] },
      { base: 'spirulina', mid: ['blueberry', 'banana'], top: ['coconut', 'chia'] },
    ].map((bw) => new Sprite(root, bowlSVG(bw, 330)));
    const logo = new Sprite(root, logoSVG(900));
    const btn = new Sprite(root, `<div class="play-btn">${PLAY_ICON}<span>${C.play}</span></div>`);
    const free = sticker(root, C.free, 'dark');
    const url = new Sprite(root, `<div class="url">${C.url}</div>`);
    const confetti = confettiBurst(root, { n: 60, seed: 31, x: 540, y: 560, t0: 0.02 });
    cue(from, 'boom', { gain: 1 });
    cue(from + 0.02, 'confetti', { gain: 0.7 });
    cue(from + b(1), 'pop', { gain: 0.5, pitch: 4 });
    cue(from + b(2), 'click', { kind: 'sfx' });
    cue(from + b(2) + 0.02, 'win', { kind: 'sfx', gain: 0.8 });
    hit(from, { punch: 0.07, flash: 0.8, shake: 34, impact: true });
    hit(from + b(2), { punch: 0.04, flash: 0.3 });
    fx.speed(from, 1, 2.6);
    return {
      from, to, enter: ['slamIn', 0.12],
      update(lt) {
        confetti.update(lt);
        logo.set({ x: 540, y: 520 + Math.sin(lt * 2.6) * 8, s: slam(lt, 3) + 0.02 * decay(lt % b(1), 9), r: -8 + Math.sin(lt * 2) * 1.2 });
        const bp = popIn(lt - b(1), { f: 2.4, d: 7 });
        const tap = Math.max(0, 1 - Math.abs(lt - b(2)) / 0.12);
        btn.set({ x: 540, y: 960 + bp.dy + tap * 10, s: bp.s * (1 - tap * 0.05) * (1 + 0.03 * decay(lt % b(1), 8)), o: bp.o });
        const fp = popIn(lt - b(1.5));
        free.set({ x: 540, y: 1160 + fp.dy, s: fp.s, o: fp.o });
        const up = popIn(lt - b(2), { f: 2.4, d: 7 });
        url.set({ x: 540, y: 1290 + up.dy, s: up.s, r: -2, o: up.o });
        row.forEach((sp, i) => {
          const p = popIn(lt - b(0.5) - i * 0.06, { rise: 300, f: 2.2, d: 7 });
          sp.set({ x: 230 + i * 310, y: 1540 + p.dy + Math.sin(lt * 4 + i) * 8, s: p.s * (i === 1 ? 1.08 : 0.95), r: (i - 1) * 8, o: p.o });
        });
      },
    };
  };

  return S;
}
