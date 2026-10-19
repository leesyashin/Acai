// The 'satisfying' promo film (tools/promo, ?version=satisfying): a calm TikTok in the "oddly
// satisfying" style – one bowl built up close on a warm pastel set, in one continuous shot: the açaí
// blended, poured, six toppings landing one per beat (each with a soft rising note), then a fruit
// matcha from the matcha bar filling layer by layer, ice and cold foam on top, and a row of finished bowls. The game's menu bossa as lo-fi (96 BPM);
// no shakes or flashes, TikTok's own text stickers instead of big titles.

import { logoSVG, bowlSVG, ingredientIcon, packIcon, matchaGlassSVG, blenderBadgeSVG } from '../../js/art.js';
import * as ART from '../../js/art.js';
import * as DATA from '../../js/data.js';
import { createRng } from '../../js/rng.js';
import { clamp, lerp, prog, ease, jiggle, wob } from './motion.js';
import { Sprite, View3D, Burst, div } from './kit.js';

const COPY = {
  de: {
    hook: ['die perfekte Açaí-Bowl', 'bauen 🤤'],
    sound: '🔊 Ton an',
    base: ['erst die Basis …'],
    toppings: ['… dann die Toppings'],
    perfect: ['perfekt. ✨'],
    matcha: ['dazu ein Erdbeer-Matcha', 'mit Eis & Cold Foam 🧊'],
    end: ['bau deine eigene Bowl'],
    free: ['kostenlos im Browser · Link in Bio'],
    url: 'leesyashin.github.io/Acai',
  },
  en: {
    hook: ['building the perfect', 'açaí bowl 🤤'],
    sound: '🔊 sound on',
    base: ['the base first …'],
    toppings: ['… then the toppings'],
    perfect: ['perfect. ✨'],
    matcha: ['plus a strawberry matcha', 'with ice & cold foam 🧊'],
    end: ['build your own bowl'],
    free: ['free in your browser · link in bio'],
    url: 'leesyashin.github.io/Acai',
  },
};

// The menu track's bars: 0–7 (two quiet ones first), then Gm7 – C7 into the final Fmaj7.
export const CUTS = {
  satisfying: {
    bpm: 96,
    track: 'menu',
    theme: 'cream',
    energy: 0.15,
    scenes: [['sfBlend', 8, { enter: null }], ['sfPour', 8], ['sfLayers', 12], ['sfMatcha', 8], ['sfEnd', 8]],
    music: [
      { style: 'lofi', g: 0, lead: false }, { style: 'lofi', g: 1, lead: false }, { style: 'lofi', g: 2 }, { style: 'lofi', g: 3 },
      { style: 'lofi', g: 4 }, { style: 'lofi', g: 5 }, { style: 'lofi', g: 6 }, { style: 'lofi', g: 7 }, { style: 'lofi', g: 12 },
      { style: 'lofi', g: 13 }, { style: 'end', chord: 'Fmaj7', soft: true },
    ],
  },
};

// the bowl of the film and the order its toppings land in
const BOWL = { base: 'acai', mid: ['banana', 'strawberry', 'blueberry'], top: ['honey', 'coconut', 'mint'] };
const STEPS = [...BOWL.mid.map((id) => ['mid', id]), ...BOWL.top.map((id) => ['top', id])];
const CUP = { x: 540, y: 1230, size: 820 };
const RIM_Y = CUP.y - CUP.size * 0.25; // the cup's rim (bowlSVG: viewBox 200, rim at 50)
// the camera close on the rim (end of the pour, start of the toppings)
const CLOSE = { s: 1.22, x: 540, y: 1080 };

// TikTok's text sticker: one rounded box per line
const sticker = (root, lines, cls = '') => new Sprite(root, `<div class="tk ${cls}">${lines.map((l) => `<span>${l}</span>`).join('<br>')}</div>`);
// a sticker shown from t0 to t1 (scene time): cuts in with a quick pop, fades out
function stick(sp, lt, t0, t1, x, y, r = 0) {
  if (lt < t0 || lt >= t1) return sp.hide();
  const k = clamp((lt - t0) / 0.16);
  return sp.set({ x, y, r, s: lerp(0.88, 1, ease.outBack(k)), o: clamp((lt - t0) / 0.06) * (1 - prog(lt, t1 - 0.15, t1)) });
}

// soft light specks drifting up through the set
function dust(root, seed, n = 16) {
  const rng = createRng(seed);
  const ps = [...Array(n)].map(() => ({
    sp: new Sprite(root, '<div class="dust"></div>'),
    x: rng.range(40, 1040), y: rng.range(200, 2000), v: rng.range(14, 42), s: rng.range(0.9, 2.6), ph: rng.range(0, 6),
  }));
  return (lt) => ps.forEach((p) => p.sp.set({ x: p.x + Math.sin(lt * 0.7 + p.ph) * 26, y: p.y - p.v * lt, s: p.s, o: 0.3 + 0.3 * Math.sin(lt * 1.3 + p.ph) }));
}

// a layer whose content is seen through a camera: scale s around the frame point (x, y) moved to the centre
function camLayer(root) {
  const el = div(root, 'layer');
  el.style.transformOrigin = '0 0';
  let last = '';
  return (s, x, y) => {
    const tf = `translate(${(540 - x * s).toFixed(2)}px,${(960 - y * s).toFixed(2)}px) scale(${s.toFixed(4)})`;
    if (tf !== last) el.style.transform = last = tf;
    return el;
  };
}

export function scenes({ lang, b, cue, loops, popIn }) {
  const C = COPY[lang] || COPY.de;
  const S = {};
  const name = (id) => DATA.ingName(id).toLowerCase();

  // ================================================================ the açaí blended (close on the 3D blender)
  S.sfBlend = (root, from, to) => {
    const cam = camLayer(root);
    const set = cam(1, 540, 960);
    const floor = new Sprite(set, '<div class="sf-floor"></div>');
    const blender = new View3D(set, 'blender', 1100);
    const pack = new Sprite(set, packIcon('acai', 300));
    const badge = new Sprite(set, blenderBadgeSVG('ready', 150));
    const air = dust(root, 3);
    const hook = sticker(root, C.hook);
    const sound = sticker(root, [C.sound], 'dark');
    const BY = 1230;
    const MOUTH = [560, BY - 470];
    const Td = b(2.25);
    const Tr = b(6.5);
    cue(from + b(1), 'swish', { gain: 0.12 });
    cue(from + Td, 'drop', { kind: 'sfx', gain: 0.55 });
    cue(from + Td, 'ting', { pitch: 0, gain: 0.55 });
    cue(from + Td + 0.06, 'blenderStart', { kind: 'sfx', gain: 0.45 });
    loops.push({ id: 'blender', from: from + Td + 0.12, to: from + Tr, gain: 0.5 });
    cue(from + Tr, 'blenderReady', { kind: 'sfx', gain: 0.6 });
    cue(from + Tr + 0.02, 'ting', { pitch: 4, gain: 0.5 });
    return {
      from, to, leave: ['softOut', 0.3],
      update(lt) {
        air(lt);
        // a slow push in on the jug
        cam(lerp(0.94, 1.1, ease.inOutQuad(prog(lt, 0, to - from))), 540, lerp(1000, 940, prog(lt, 0, to - from)));
        floor.set({ x: 540, y: BY + 470 });
        const state = lt < Td ? { state: 'empty' } : lt < Tr ? { state: 'blending', base: 'acai', progress: prog(lt, Td, Tr), remaining: 2 } : { state: 'ready', base: 'acai', portions: 2, maxPortions: 2 };
        blender.draw({ tier: 2, ...state }, lt);
        const hop = jiggle(lt - Td, 3, 6) * 0.025 + jiggle(lt - Tr, 2.5, 5) * 0.03;
        const hum = lt > Td && lt < Tr ? wob(lt * 1.5, 4) * 2 : 0;
        blender.sprite.set({ x: 540 + hum, y: BY - hop * 300, sx: 1 + hop, sy: 1 - hop });
        // the pack sinks into the jug in slow motion
        const k = ease.inOutCubic(prog(lt, b(0.5), Td));
        if (lt < Td) pack.set({ x: lerp(600, MOUTH[0], k), y: lerp(-260, MOUTH[1], k), s: lerp(1, 0.62, ease.inQuad(k)), r: lerp(14, -18, k) });
        else {
          const q = prog(lt, Td, Td + 0.18);
          pack.set({ x: MOUTH[0], y: MOUTH[1] + q * 90, s: 0.62 * (1 - q), r: -18, o: 1 - q });
        }
        const bp = popIn(lt - Tr, { f: 1.8, d: 6 });
        badge.set({ x: 830, y: BY - 420 + bp.dy, s: bp.s, o: bp.o });
        stick(hook, lt, 0.05, b(6.6), 540, 330);
        stick(sound, lt, b(0.75), b(3.5), 540, 1540);
      },
    };
  };

  // ================================================================ the base poured into the cup (one shot with the toppings)
  S.sfPour = (root, from, to) => {
    const cam = camLayer(root);
    const set = cam(1, 540, 960);
    const floor = new Sprite(set, '<div class="sf-floor"></div>');
    const cupEmpty = new Sprite(set, bowlSVG({}, CUP.size));
    const cupFull = new Sprite(set, bowlSVG({ base: 'acai' }, CUP.size));
    const blender = new View3D(set, 'blender', 560);
    const stream = new Sprite(set, '<div style="width:52px;height:400px;border-radius:26px;background:linear-gradient(90deg,#4a1a5e,#7b3a96 45%,#5a1f73)"></div>');
    stream.el.style.transformOrigin = '0 -200px';
    const air = dust(root, 5);
    const cap = sticker(root, C.base);
    const P0 = b(1.5);
    const P1 = b(5.5);
    cue(from + b(0.6), 'swish', { gain: 0.12 });
    cue(from + P0, 'pour', { kind: 'sfx', gain: 0.6 });
    cue(from + P0 + 0.1, 'glug', { gain: 0.8, len: P1 - P0 - 0.2 });
    cue(from + P1 + 0.1, 'ting', { pitch: 2, gain: 0.4 });
    return {
      from, to, enter: ['softIn', 0.3], leave: null,
      update(lt) {
        air(lt);
        // still, then into the close-up the toppings start from
        const z = ease.inOutCubic(prog(lt, b(5.8), b(8)));
        cam(lerp(1, CLOSE.s, z), lerp(540, CLOSE.x, z), lerp(1060, CLOSE.y, z));
        floor.set({ x: 540, y: CUP.y + 330 });
        const fill = ease.inOutQuad(prog(lt, P0 + 0.15, P1));
        const sq = jiggle(lt - P1, 2.4, 5) * 0.02;
        const cupT = { x: CUP.x, y: CUP.y + sq * 100, sx: 1 + sq, sy: 1 - sq };
        cupEmpty.set(cupT);
        if (fill > 0) {
          cupFull.set(cupT);
          cupFull.in.style.clipPath = `inset(${((1 - fill * 0.78) * 100).toFixed(2)}% -50% -50% -50%)`;
        } else cupFull.hide();
        // the jug glides in from the top left, tips and pours
        const bin = ease.outCubic(prog(lt, b(0.4), P0));
        const bout = ease.inCubic(prog(lt, P1, P1 + b(1)));
        if (lt < b(0.4) || bout >= 1) blender.sprite.hide();
        else {
          blender.draw({ tier: 2, state: 'ready', base: 'acai', portions: 2 - Math.round(fill), maxPortions: 2 }, lt);
          blender.sprite.set({ x: lerp(-260, 400, bin) - bout * 700, y: lerp(300, 690, bin) - bout * 420, r: lerp(-10, 100, ease.inOutCubic(prog(lt, P0 - b(0.8), P0 + 0.1))) - bout * 30 });
        }
        const sk = prog(lt, P0, P0 + 0.25) * (1 - prog(lt, P1 - 0.2, P1));
        if (sk > 0) stream.set({ x: 520 + Math.sin(lt * 18) * 2, y: 820, sy: sk });
        else stream.hide();
        stick(cap, lt, b(0.3), b(5.6), 540, 330);
      },
    };
  };

  // ================================================================ six toppings, one per beat
  S.sfLayers = (root, from, to) => {
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
    const drops = STEPS.map((_, i) => b(1 + i));
    const icons = STEPS.map(([, id]) => new Sprite(set, ingredientIcon(id, 230)));
    const crumbs = STEPS.map(([, id], i) => new Burst(set, {
      n: 7, seed: 70 + i, x: CUP.x, y: RIM_Y + 20, t0: drops[i], speed: [180, 420], angle: [-160, -20], gravity: 1500, drag: 1.6, life: [0.45, 0.7], scale: [0.25, 0.42],
      html: () => ingredientIcon(STEPS[i][1], 90),
    }));
    const names = STEPS.map(([, id]) => new Sprite(root, `<div class="sf-name">${name(id)}</div>`));
    const shine = new Burst(set, {
      n: 14, seed: 9, x: CUP.x, y: CUP.y - 120, t0: b(7.5), speed: [300, 700], gravity: -60, drag: 2.2, life: [1.2, 1.8], scale: [0.4, 0.9], spin: [-90, 90],
      html: () => '<svg width="70" height="70" viewBox="0 0 100 100"><path d="M50 4C54 36 64 46 96 50C64 54 54 64 50 96C46 64 36 54 4 50C36 46 46 36 50 4Z" fill="#fff"/></svg>',
    });
    const air = dust(root, 8);
    const cap = sticker(root, C.toppings);
    const done = sticker(root, C.perfect);
    drops.forEach((d, i) => {
      cue(from + d - 0.3, 'swish', { gain: 0.08 });
      cue(from + d, 'plop', { kind: 'sfx', gain: 0.75 });
      cue(from + d + 0.01, 'ting', { pitch: i, gain: 0.55 });
    });
    cue(from + b(7.5), 'star', { kind: 'sfx', step: 2, gain: 0.35 });
    return {
      from, to, enter: null, leave: ['softOut', 0.35],
      update(lt) {
        air(lt);
        // from the close-up a little closer, then back to see the whole bowl
        const zin = ease.inOutQuad(prog(lt, 0, b(7)));
        const zout = ease.inOutCubic(prog(lt, b(7.6), b(10.5)));
        const s = lerp(lerp(CLOSE.s, 1.32, zin), 0.98, zout);
        cam(s, 540, lerp(lerp(CLOSE.y, 1040, zin), 1110, zout));
        floor.set({ x: 540, y: CUP.y + 330 });
        let n = 0;
        drops.forEach((d) => { if (lt >= d) n++; });
        const last = n ? drops[n - 1] : -9;
        const sq = jiggle(lt - last, 3, 7) * 0.035;
        cup.html(bowls[n]).set({ x: CUP.x, y: CUP.y + sq * 120, sx: 1 + sq, sy: 1 - sq });
        // each one falls in slow motion and settles on the bowl
        icons.forEach((ic, i) => {
          const d = drops[i];
          const k = (lt - (d - b(0.85))) / b(0.85);
          if (k < 0 || lt > d + 0.06) return ic.hide();
          const fall = ease.inQuad(clamp(k));
          return ic.set({ x: CUP.x + (i % 2 ? 50 : -50) * (1 - fall), y: lerp(RIM_Y - 760, RIM_Y + 10, fall), s: lt > d ? 0.62 : lerp(0.9, 0.62, fall), r: (1 - fall) * (i % 2 ? 50 : -50), o: lt > d ? 1 - (lt - d) / 0.06 : 1 });
        });
        crumbs.forEach((c) => c.update(lt));
        names.forEach((nm, i) => {
          const d = drops[i];
          if (lt < d || lt > d + b(1.6)) return nm.hide();
          const p = popIn(lt - d, { rise: 20, f: 2.2, d: 9 });
          return nm.set({ x: i % 2 ? 800 : 280, y: 560 + p.dy, s: p.s, r: i % 2 ? 3 : -3, o: 1 - prog(lt, d + b(1.3), d + b(1.6)) });
        });
        shine.update(lt);
        stick(cap, lt, b(0.2), b(6.8), 540, 330);
        stick(done, lt, b(7.5), b(11.6), 540, 330);
      },
    };
  };

  // ================================================================ a fruit matcha, layer by layer
  S.sfMatcha = (root, from, to) => {
    const SIZE = 820;
    const GX = 540;
    const GY = 1180;
    const top = GY - SIZE / 2;
    const RIM = top + SIZE * 0.21; // the glass's rim (matchaGlassSVG: viewBox 100, rim at 21)
    const air = dust(root, 11);
    const floor = new Sprite(root, '<div class="sf-floor"></div>');
    const glassA = new Sprite(root, '');
    const glassB = new Sprite(root, '');
    const fruit = new Sprite(root, ingredientIcon('strawberry', 240));
    const jet = new Sprite(root, `<div style="width:${Math.round(SIZE * 0.048)}px;height:${Math.round(RIM)}px;border-radius:0 0 12px 12px"></div>`);
    jet.el.style.transformOrigin = '0 0';
    const jetEl = jet.in.firstChild;
    const ice = new Sprite(root, ingredientIcon('ice', 200));
    // the other fruits of the matcha bar, each with its extras
    const side = [['mMango', ['ice'], 165, 1100, -6], ['mBlueberry', ['foam'], 915, 1100, 6], ['mBanana', ['vanilla'], 165, 1440, -4], ['mStrawberry', ['ice', 'vanilla'], 915, 1440, 4]]
      .map(([id, extras, x, y, r]) => ({ sp: new Sprite(root, matchaGlassSVG(id, 'ready', 300, { extras })), x, y, r }));
    const cap = sticker(root, C.matcha);
    const Tf = b(1.2);
    const F0 = b(2);
    const F1 = b(5);
    const Ti = b(5.6); // ice in
    const Tc = b(6.2); // cold foam on top
    cue(from + Tf, 'plop', { kind: 'sfx', gain: 0.7 });
    cue(from + Tf, 'ting', { pitch: 1, gain: 0.45 });
    cue(from + F0, 'pour', { kind: 'sfx', gain: 0.45 });
    cue(from + F0 + 0.1, 'glug', { gain: 0.6, len: F1 - F0 - 0.2 });
    cue(from + F1, 'matchaReady', { kind: 'sfx', gain: 0.55 });
    cue(from + Ti, 'plop', { kind: 'sfx', gain: 0.6 });
    cue(from + Ti + 0.01, 'ting', { pitch: 3, gain: 0.45 });
    cue(from + Tc - 0.15, 'swish', { gain: 0.15 });
    cue(from + Tc, 'ting', { pitch: 4, gain: 0.45 });
    side.forEach((_, i) => cue(from + b(6.6 + i * 0.2), 'ting', { pitch: 2 + i, gain: 0.3 }));
    // two neighbouring fill steps of the glass (it draws twelve) cross-faded into a smooth rise
    const glassAt = (k) => {
      const q = clamp(k) * 12;
      const lo = Math.floor(q);
      const a = matchaGlassSVG('mStrawberry', 'mixing', SIZE, { fill: lo / 12, from: 99 });
      const bb = matchaGlassSVG('mStrawberry', 'mixing', SIZE, { fill: Math.min(12, lo + 1) / 12, from: 99 });
      return [a, bb, q - lo];
    };
    return {
      from, to, enter: ['softIn', 0.35], leave: ['softOut', 0.35],
      update(lt) {
        air(lt);
        floor.set({ x: GX, y: GY + 330 });
        const gp = popIn(lt, { rise: 30, f: 1.6, d: 6 });
        const sq = jiggle(lt - Tf, 3, 7) * 0.03;
        const g = { x: GX, y: GY + gp.dy + sq * 100, sx: 1 + sq, sy: 1 - sq, s: gp.s };
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
        const ki = ease.inQuad(prog(lt, Ti - b(0.8), Ti));
        if (lt > Ti - b(0.8) && lt < Ti + 0.05) ice.set({ x: GX - 30, y: lerp(-180, GY - 60, ki), r: ki * -70, s: 0.9, o: lt > Ti ? 1 - (lt - Ti) / 0.05 : 1 });
        else ice.hide();
        // the strawberry drops in, then milk and matcha run in from above
        const k = ease.inQuad(prog(lt, Tf - b(0.9), Tf));
        if (lt > Tf - b(0.9) && lt < Tf + 0.05) fruit.set({ x: GX + 20, y: lerp(-200, GY + 120, k), r: k * 90, s: 0.8, o: lt > Tf ? 1 - (lt - Tf) / 0.05 : 1 });
        else fruit.hide();
        const on = prog(lt, F0 - 0.15, F0) * (1 - prog(lt, F1 - 0.25, F1 - 0.05));
        if (on > 0) {
          // the same colours as the stream the glass draws inside: milk first, then matcha
          const col = ART.MATCHA_COLORS || { milk: '#f4efe3', light: '#a9c45a' };
          jetEl.style.background = prog(lt, F0, F1) < (ART.MATCHA_MILK ?? 0.42) ? col.milk : col.light;
          jet.set({ x: GX - SIZE * 0.002, y: RIM / 2, sy: on });
        } else jet.hide();
        side.forEach((c, i) => {
          const p = popIn(lt - b(6.6 + i * 0.2), { rise: 120, f: 1.8, d: 6 });
          c.sp.set({ x: c.x, y: c.y + p.dy, s: p.s, r: c.r, o: p.o });
        });
        stick(cap, lt, b(0.3), b(7.7), 540, 330);
      },
    };
  };

  // ================================================================ a row of finished bowls, the logo, where to play
  S.sfEnd = (root, from, to) => {
    const air = dust(root, 13);
    const row = [
      { base: 'pitaya', mid: ['mango', 'kiwi'], top: ['coconut', 'mint'] },
      { base: 'acai', mid: ['banana', 'strawberry', 'granola'], top: ['honey'] },
      { base: 'spirulina', mid: ['blueberry', 'banana'], top: ['coconut', 'chia'] },
      { base: 'acai', mid: ['strawberry', 'blueberry'], top: ['chocolate', 'mint'] },
      { base: 'pitaya', mid: ['banana', 'kiwi', 'blueberry'], top: ['peanut'] },
      { base: 'spirulina', mid: ['mango', 'strawberry'], top: ['honey', 'cacao'] },
    ].map((bw) => new Sprite(root, bowlSVG(bw, 400)));
    const logo = new Sprite(root, logoSVG(880));
    const end = sticker(root, C.end);
    const free = sticker(root, C.free, 'dark');
    const url = new Sprite(root, `<div class="sf-url">${C.url}</div>`);
    row.forEach((_, i) => cue(from + b(0.3 + i * 0.35), 'ting', { pitch: i % 6, gain: 0.3 }));
    return {
      from, to, enter: ['softIn', 0.35],
      update(lt) {
        air(lt);
        // the bowls glide in one after another and drift slowly to the left
        row.forEach((sp, i) => {
          const t0 = b(0.3 + i * 0.35);
          const k = ease.outCubic(prog(lt, t0, t0 + b(1.2)));
          const x = 230 + i * 320 - lt * 60 + (1 - k) * 700;
          sp.set({ x, y: 1430 + Math.sin(lt * 2 + i) * 6, s: 0.92 + (i % 2) * 0.06, o: k > 0 ? clamp(k * 3) : 0 });
        });
        const lp = popIn(lt - b(1), { rise: 50, f: 1.4, d: 5 });
        logo.set({ x: 540, y: 560 + lp.dy + Math.sin(lt * 1.6) * 6, s: lp.s, r: -4 + Math.sin(lt * 1.2) * 1, o: lp.o });
        stick(end, lt, b(2), 99, 540, 900);
        stick(free, lt, b(3), 99, 540, 1010);
        const up = popIn(lt - b(4), { f: 1.8, d: 7 });
        url.set({ x: 540, y: 1135 + up.dy, s: up.s, o: up.o });
      },
    };
  };

  return S;
}
