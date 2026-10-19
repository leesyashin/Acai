// The 'glowup' promo film (tools/promo, ?version=glowup): the TikTok meme "day 1 vs. day 100".
// Day 1 is grey and quiet: one classic blender, one empty cup, four ingredients, no coins, crickets,
// a fly and the only guest walking out. A record scratch, a "100 days later" card, and the drop: day 100
// fills the screen beat by beat – Pro Max blenders, the matcha machine, a full house of happy guests,
// all ingredients, decor, coins pouring in. Then both days side by side with the numbers, and the end
// card. 124 BPM: a lonely, out-of-tune piano, silence, then the game's groove.

import {
  logoSVG, bowlSVG, ingredientIcon, coinSVG, heartSVG, starSVG, clockSVG, matchaGlassSVG, decorSVG, MATCHA_SLOT_Y, MATCHA_CUP_SIZE,
} from '../../js/art.js';
import * as DATA from '../../js/data.js';
import { VIEWS, MACHINE_SLOT_X, BLENDER_MODELS, fitFrame } from '../../js/kitchen3d.js';
import { clamp, lerp, prog, ease, spring, jiggle, decay, wob, bump } from './motion.js';
import { Sprite, Title, Burst, Ring, View3D, div } from './kit.js';

const COPY = {
  de: {
    day1: ['Tag 1 in meinem Açaí-Café:'],
    later: '100 TAGE\nSPÄTER …',
    day100: ['Tag 100:'],
    tag1: 'TAG 1',
    tag100: 'TAG 100',
    stats: ['Mixer', 'Zutaten', 'Gäste', 'Münzen'],
    endTitle: 'DEIN TAG 1\nSTARTET JETZT',
    play: 'JETZT SPIELEN',
    free: ['kostenlos im Browser · Link in Bio'],
    url: 'leesyashin.github.io/Acai',
    num: (n) => n.toLocaleString('de-DE'),
  },
  en: {
    day1: ['day 1 of running my açaí café:'],
    later: '100 DAYS\nLATER …',
    day100: ['day 100:'],
    tag1: 'DAY 1',
    tag100: 'DAY 100',
    stats: ['Blender', 'Ingredients', 'Guests', 'Coins'],
    endTitle: 'YOUR DAY 1\nSTARTS NOW',
    play: 'PLAY NOW',
    free: ['free in your browser · link in bio'],
    url: 'leesyashin.github.io/Acai',
    num: (n) => n.toLocaleString('en-US'),
  },
};

export const CUTS = {
  glowup: {
    theme: 'glow',
    energy: 1,
    bounce: [12, 36],
    scenes: [['guDay1', 8, { enter: null }], ['guLater', 4], ['guDay100', 16], ['guVs', 8], ['guEnd', 8]],
    music: [
      { style: 'sad', chords: ['Am', 'F'], mel: null }, { style: 'sad', chords: ['Dm', 'E'], mel: null },
      { style: 'rest' },
      { style: 'drop', g: 0 }, { style: 'groove', g: 1 }, { style: 'groove', g: 2 }, { style: 'groove', g: 3, fill: true },
      { style: 'drop', g: 12, harmony: true }, { style: 'groove', g: 13, harmony: true, fill: true },
      { style: 'groove', chords: ['Dm7', 'G7'], mel: 15, harmony: true, fill: true }, { style: 'end' },
    ],
  },
};

const START = DATA.START_OWNED || ['acai', 'banana', 'granola', 'honey'];
const ALL = DATA.INGREDIENTS.map((i) => i.id);
const COINS = 12480;

// TikTok's text sticker (one rounded box per line)
const sticker = (root, lines, cls = '') => new Sprite(root, `<div class="tk ${cls}">${lines.map((l) => `<span>${l}</span>`).join('<br>')}</div>`);

const FLY = '<svg width="54" height="40" viewBox="0 0 54 40"><ellipse cx="18" cy="12" rx="13" ry="9" fill="#dff3ff" opacity=".8" stroke="#2a1236" stroke-width="2.5"/>' +
  '<ellipse cx="34" cy="10" rx="12" ry="8" fill="#dff3ff" opacity=".8" stroke="#2a1236" stroke-width="2.5"/><ellipse cx="27" cy="26" rx="13" ry="10" fill="#2a1236"/>' +
  '<circle cx="37" cy="24" r="4" fill="#c0392b"/></svg>';

// a coin pill whose number is set each frame
function coinPill(root, size = 84) {
  const sp = new Sprite(root, `<div class="pill" style="font-size:${size}px">${coinSVG(Math.round(size * 1.15))}<span class="cn">0</span></div>`);
  const el = sp.in.querySelector('.cn');
  return { sp, set: (text) => { if (el.textContent !== text) el.textContent = text; } };
}

export function scenes({ lang, b, cue, loops, fx, popIn, guest, patienceBar, counterBandSVG, confettiBurst, PLAY_ICON }) {
  const C = COPY[lang] || COPY.de;
  const S = {};

  // ================================================================ day 1: grey, empty, quiet
  S.guDay1 = (root, from, to) => {
    root.style.filter = 'saturate(0.35) brightness(0.92)';
    const cap = sticker(root, C.day1);
    const coins = coinPill(root, 70);
    const counter = new Sprite(root, counterBandSVG());
    const blender = new View3D(root, 'blender', 560);
    const cup = new Sprite(root, bowlSVG({}, 300));
    const gst = guest(root, 27, 420);
    const bar = patienceBar(root, 260);
    const cards = START.map((id) => new Sprite(root, `<div class="card" style="transform:scale(.7)">${ingredientIcon(id, 150)}</div>`));
    const fly = new Sprite(root, FLY);
    const Tl = b(5.5); // the guest gives up and leaves
    [1.5, 3.5, 6.5].forEach((bt) => cue(from + b(bt), 'cricket', { gain: 0.8 }));
    cue(from + Tl, 'angry', { kind: 'sfx', gain: 0.6 });
    cue(from + Tl + 0.3, 'heart', { kind: 'sfx', gain: 0.5 });
    return {
      from, to, tint: 'grey',
      update(lt) {
        const cp = popIn(lt, { f: 2, d: 9 });
        cap.set({ x: 540, y: 300, s: lerp(0.9, 1, Math.min(1, cp.s)), o: cp.o });
        coins.set('0');
        coins.sp.set({ x: 540, y: 470 });
        // the guest waits, gets cross and walks out
        const k = 1 - prog(lt, 0, Tl) * 0.97;
        const leave = ease.inBack(prog(lt, Tl, Tl + 0.5));
        gst.mood(k > 0.6 ? 'neutral' : k > 0.3 ? 'impatient' : 'angry').sp.set({ x: 720 + leave * 600, y: 860 + Math.sin(lt * 3) * 3, r: leave * 20, o: 1 - leave });
        bar.value(k);
        bar.sp.set({ x: 720 + leave * 600, y: 1090, o: 1 - leave });
        counter.set({ x: 540, y: 1330 });
        blender.draw({ tier: 0, state: 'empty' }, lt);
        blender.sprite.set({ x: 290, y: 1110 });
        cup.set({ x: 760, y: 1230 });
        cards.forEach((c, i) => c.set({ x: 540 + (i - 1.5) * 170, y: 1530 }));
        // a fly circles over the empty cup
        fly.set({ x: 640 + Math.sin(lt * 3.1) * 220 + wob(lt * 0.6, 1) * 40, y: 1020 + Math.sin(lt * 4.3) * 90 + wob(lt * 0.5, 2) * 30, r: Math.sin(lt * 6) * 25, s: 1.2 });
      },
    };
  };

  // ================================================================ 100 days later (the card from the cartoon meme)
  S.guLater = (root, from, to) => {
    const card = new Sprite(root, `<div class="gu-card">${C.later.replace('\n', '<br>')}</div>`);
    const clock = new Sprite(root, clockSVG(260));
    cue(from, 'scratch', { gain: 1 });
    for (let i = 1; i < 4; i++) cue(from + b(i), 'tick', { kind: 'sfx', alt: i % 2 === 1 });
    cue(from + b(2), 'riser', { len: b(2), gain: 0.9 });
    fx.flash(from, 0.5, 9);
    fx.shake(from, 20, 7);
    return {
      from, to, enter: ['spinIn', 0.16], leave: ['zoomOut', 0.12], tint: 'mango',
      update(lt) {
        const p = popIn(lt - 0.05, { f: 2.2, d: 6, rise: 80 });
        card.set({ x: 540, y: 820 + p.dy, s: p.s * (1 + 0.03 * Math.sin(lt * 9)), r: -4 + Math.sin(lt * 5) * 2 });
        // the clock races through the hundred days
        clock.set({ x: 540, y: 1300, r: lt * 1440, s: 1 + 0.08 * decay(lt % b(1), 8) });
      },
    };
  };

  // ================================================================ day 100: the café fills up beat by beat
  S.guDay100 = (root, from, to) => {
    const cap = sticker(root, C.day100);
    const coins = coinPill(root, 84);
    const neon = new Sprite(root, decorSVG('neon', 230, { wall: false }));
    const plants = new Sprite(root, decorSVG('plants', 230, { wall: false }));
    const seeds = [5, 12, 3, 31];
    const gx = [150, 400, 680, 930];
    const guests = seeds.map((s) => guest(root, s, 250));
    const hearts = gx.map((x, i) => new Burst(root, {
      n: 5, seed: 90 + i, x, y: 690, t0: b(4.5 + i * 0.25), speed: [300, 600], angle: [-150, -30], gravity: -250, drag: 2, life: [0.9, 1.3], scale: [0.5, 0.8],
      html: () => heartSVG(true, 70),
    }));
    const counter = new Sprite(root, counterBandSVG());
    const pro = new View3D(root, 'blender', 470);
    const pro2 = new View3D(root, 'blender', 400);
    const MS = 470;
    const machine = new View3D(root, 'machine', MS);
    const mf = fitFrame(VIEWS.machine, MS);
    const cupPx = Math.round(MS * MATCHA_CUP_SIZE);
    const glasses = [['mStrawberry', ['ice', 'foam']], ['mMango', ['vanilla']]].map(([f, extras]) => new Sprite(root, matchaGlassSVG(f, 'ready', cupPx, { extras })));
    const bowls = [{ base: 'pitaya', mid: ['mango', 'kiwi'], top: ['coconut', 'mint'] }, { base: 'acai', mid: ['banana', 'strawberry', 'blueberry'], top: ['honey'] }]
      .map((bw) => new Sprite(root, bowlSVG(bw, 200)));
    const icons = ALL.map((id) => new Sprite(root, ingredientIcon(id, 104)));
    const rings = [0, 1, 2, 3].map((i) => new Ring(root, { x: [270, 470, 840, 540][i], y: [1140, 1160, 1150, 760][i], t0: b(i), size: 700, color: '#ffffff', width: 18, dur: 0.45 }));
    const rain = new Burst(root, {
      n: 26, seed: 7, x: 540, y: 300, t0: b(8), speed: [500, 1200], angle: [-170, -10], gravity: 2200, drag: 1.2, life: [1, 1.5], scale: [0.6, 1], spin: [-400, 400],
      html: () => coinSVG(80),
    });
    const stars = [0, 1, 2, 3, 4].map(() => new Sprite(root, starSVG(true, 96)));
    const confetti = confettiBurst(root, { n: 50, seed: 77, x: 540, y: 700, t0: b(12) });
    // impacts: the café builds itself on the beat
    fx.flash(from, 1, 7);
    fx.shake(from, 40, 5);
    fx.speed(from, 1, 2.6);
    fx.spin(from, 160, 2);
    cue(from, 'impact', { gain: 1 });
    [1, 2, 3].forEach((i) => {
      cue(from + b(i), 'upgrade', { gain: 0.8, pitch: i });
      fx.flash(from + b(i), 0.4, 11);
      fx.punch(from + b(i), 0.04, 9);
    });
    cue(from + b(1) + 0.05, 'blenderStart', { kind: 'sfx', gain: 0.5 });
    loops.push({ id: 'blender', from: from + b(0.1), to: from + b(16), gain: 0.45 });
    cue(from + b(2) + 0.05, 'matchaReady', { kind: 'sfx', gain: 0.6 });
    cue(from + b(3), 'bell', { kind: 'sfx', gain: 0.7 });
    gx.forEach((_, i) => cue(from + b(3 + i * 0.25), 'happy', { kind: 'sfx', gain: 0.35 }));
    ALL.forEach((_, i) => { if (i % 2 === 0) cue(from + b(5) + i * 0.04, 'pop', { gain: 0.3, pitch: (i / 2) % 7 }); });
    cue(from + b(7), 'pop', { gain: 0.5, pitch: 4 });
    cue(from + b(8), 'purchase', { kind: 'sfx', gain: 0.9 });
    for (let i = 0; i < 10; i++) cue(from + b(8) + 0.25 + i * 0.07, 'coin', { kind: 'sfx', gain: 0.45 });
    [0, 0.5, 1, 1.5, 2].forEach((d, i) => cue(from + b(10 + d), 'star', { kind: 'sfx', step: i, gain: 0.7 }));
    cue(from + b(12), 'confetti', { gain: 0.8 });
    cue(from + b(15.6), 'whoosh', { gain: 0.7 });
    return {
      from, to, enter: ['zoomIn', 0.14], leave: ['whipOut', 0.12], tint: 'gold',
      update(lt) {
        const cp = popIn(lt, { f: 2.6, d: 9 });
        cap.set({ x: 540, y: 270, s: cp.s, o: cp.o });
        // coins: count up from the start, explode on beat 8
        const n = Math.round(COINS * (0.15 * ease.outCubic(prog(lt, 0, b(8))) + 0.85 * ease.outExpo(prog(lt, b(8), b(10)))));
        coins.set(C.num(n));
        const kp = popIn(lt - 0.1, { f: 2.4, d: 8 });
        coins.sp.set({ x: 540, y: 410 + kp.dy, s: kp.s * (1 + 0.12 * decay(lt - b(8), 7)), o: kp.o });
        rain.update(lt);
        // decor on the wall
        const dp = popIn(lt - b(7), { f: 2.4, d: 7 });
        neon.set({ x: 900, y: 560 + dp.dy, s: dp.s, r: 4, o: dp.o });
        plants.set({ x: 180, y: 560 + dp.dy, s: dp.s, r: -4, o: dp.o });
        // four happy guests
        guests.forEach((g, i) => {
          const p = popIn(lt - b(3) - i * 0.08, { rise: 160, f: 2.4, d: 7 });
          const hop = bump(lt % b(1), 0, 0.2) * (lt > b(12) ? 18 : 0);
          g.mood('happy').sp.set({ x: gx[i], y: 820 + p.dy - hop + Math.sin(lt * 4 + i) * 4, s: p.s, o: p.o });
        });
        hearts.forEach((h) => h.update(lt));
        // the counter and the machines on it
        counter.set({ x: 540, y: 1360 });
        const land = (t0, y) => {
          const q = lt - t0;
          if (q < 0) return null;
          const yy = q < 0.12 ? lerp(-500, y, ease.inQuad(q / 0.12)) : y;
          const sq = jiggle(q - 0.12, 4, 8) * 0.14;
          return { y: yy + sq * 80, sx: 1 + sq, sy: 1 - sq };
        };
        const a = land(0, 1140);
        if (a) {
          pro.draw({ tier: 3, big: true, state: 'blending', base: 'acai', progress: 0.5, remaining: 3 }, lt);
          pro.sprite.set({ x: 230, ...a });
        } else pro.sprite.hide();
        const c2 = land(b(1), 1160);
        if (c2) {
          pro2.draw({ tier: 3, state: 'blending', base: 'pitaya', progress: 0.3, remaining: 2 }, lt + 0.4);
          pro2.sprite.set({ x: 470, ...c2 });
        } else pro2.sprite.hide();
        const m = land(b(2), 1150);
        if (m) {
          machine.draw({ slots: [{ state: 'ready', fruit: 'mStrawberry', progress: 1 }, { state: 'ready', fruit: 'mMango', progress: 1 }] }, lt);
          machine.sprite.set({ x: 840, ...m });
          glasses.forEach((gl, i) => {
            const cx = mf.ax + MACHINE_SLOT_X[2][i] * mf.zoom - MS / 2;
            const cy = MATCHA_SLOT_Y * MS - cupPx / 2 - MS / 2;
            gl.set({ x: 840 + cx * m.sx, y: m.y + cy * m.sy, sx: m.sx, sy: m.sy });
          });
        } else {
          machine.sprite.hide();
          glasses.forEach((gl) => gl.hide());
        }
        bowls.forEach((bw, i) => {
          const p = popIn(lt - b(7) - i * 0.1, { rise: 100, f: 2.6, d: 8 });
          bw.set({ x: [600, 975][i], y: 1320 + p.dy, s: p.s, r: i ? 6 : -6, o: p.o });
        });
        // every ingredient in two rows (narrower the more there are), in a wave
        const per = Math.ceil(icons.length / 2);
        const gap = Math.min(124, 1040 / per);
        icons.forEach((ic, i) => {
          const r = Math.floor(i / per);
          const c = i % per;
          const p = popIn(lt - b(5) - i * 0.035, { rise: 80, f: 2.6, d: 8 });
          const hop = lt > b(12) ? bump(lt, b(12) + c * 0.04, b(12) + c * 0.04 + 0.3) * 30 : 0;
          ic.set({ x: 540 + (c - (per - 1) / 2) * gap, y: 1500 + r * (gap * 0.94) + p.dy - hop, s: p.s * (gap / 124), o: p.o });
        });
        rings.forEach((rg) => rg.update(lt));
        stars.forEach((st, i) => {
          const q = lt - b(10 + i * 0.5);
          const s = q < 0 ? 0 : q < 0.08 ? lerp(2.4, 0.9, ease.inQuad(q / 0.08)) : 0.9 + 0.1 * spring(q - 0.08, 2.5, 6);
          st.set({ x: 540 + (i - 2) * 120, y: 560 + Math.abs(i - 2) * 14, s, r: (i - 2) * 8, o: q < 0 ? 0 : 1 });
        });
        confetti.update(lt);
      },
    };
  };

  // ================================================================ both days side by side, then the numbers
  S.guVs = (root, from, to) => {
    const top = div(root, 'layer');
    const bottom = div(root, 'layer');
    top.innerHTML = '<div style="position:absolute;left:0;top:0;width:1080px;height:960px;background:radial-gradient(circle at 50% 55%,#9a98a6,#5d5a68 60%,#3a3844)"></div>';
    bottom.innerHTML = '<div style="position:absolute;left:0;top:960px;width:1080px;height:960px;background:radial-gradient(circle at 50% 45%,#fff1a8,#ffc23d 45%,#e07a10)"></div>';
    top.style.filter = 'saturate(0.4)';
    const bl1 = new View3D(top, 'blender', 460);
    const g1 = guest(top, 27, 300);
    const t1 = new Sprite(top, `<div class="gu-tag grey">${C.tag1}</div>`);
    const bl2 = new View3D(bottom, 'blender', 460);
    const g2 = [5, 12, 3].map((s) => guest(bottom, s, 250));
    const t2 = new Sprite(bottom, `<div class="gu-tag gold">${C.tag100}</div>`);
    const vs = new Sprite(root, '<div class="gu-vs">VS</div>');
    const ring = new Ring(root, { x: 540, y: 960, t0: b(1), size: 900, color: '#ffffff', width: 22 });
    const dim = new Sprite(root, '<div style="width:1080px;height:1920px;background:rgba(26,6,38,.72)"></div>');
    const rows = [
      [C.stats[0], BLENDER_MODELS[0], BLENDER_MODELS[BLENDER_MODELS.length - 1]],
      [C.stats[1], String(START.length), String(ALL.length)],
      [C.stats[2], '1', '4'],
      [C.stats[3], '0', C.num(COINS)],
    ].map(([k, a, z]) => new Sprite(root, `<div class="gu-stat"><span class="k">${k}</span><span class="a">${a}</span><span class="arrow">➜</span><span class="b">${z}</span></div>`));
    cue(from, 'swish', { gain: 0.5 });
    cue(from + b(1), 'impact', { gain: 0.9 });
    fx.flash(from + b(1), 0.6, 9);
    fx.shake(from + b(1), 30, 6);
    rows.forEach((_, i) => {
      cue(from + b(4 + i * 0.75), 'stamp', { gain: 0.5 });
      fx.punch(from + b(4 + i * 0.75), 0.03, 10);
    });
    cue(from + b(7.6), 'whoosh', { gain: 0.6 });
    return {
      from, to, enter: ['whipIn', 0.14], leave: ['zoomOut', 0.12],
      update(lt) {
        // the halves slide in from the sides, then the VS lands between them
        const k = ease.outCubic(prog(lt, 0, b(0.8)));
        top.style.transform = `translateX(${(-1080 * (1 - k)).toFixed(1)}px)`;
        bottom.style.transform = `translateX(${(1080 * (1 - k)).toFixed(1)}px)`;
        bl1.draw({ tier: 0, state: 'empty' }, lt);
        bl1.sprite.set({ x: 300, y: 620 });
        g1.mood('angry').sp.set({ x: 760, y: 640 + wob(lt * 2, 3) * 4 });
        t1.set({ x: 540, y: 300, r: -3 });
        bl2.draw({ tier: 3, big: true, state: 'blending', base: 'acai', progress: 0.6, remaining: 3 }, lt);
        bl2.sprite.set({ x: 280, y: 1500 });
        g2.forEach((g, i) => g.mood('happy').sp.set({ x: 560 + i * 170, y: 1520 + Math.sin(lt * 5 + i) * 6 - (i === 1 ? 40 : 0) }));
        t2.set({ x: 540, y: 1180, r: 3 });
        const q = lt - b(1);
        const s = q < 0 ? 0 : q < 0.1 ? lerp(2.8, 0.9, ease.inQuad(q / 0.1)) : 0.9 + 0.1 * spring(q - 0.1, 2.5, 6);
        vs.set({ x: 540, y: 960, s: s * (1 + 0.05 * decay(lt % b(1), 9)), r: -8, o: q > 0 ? 1 : 0 });
        ring.update(lt);
        // the numbers, one row per beat and a half
        dim.set({ x: 540, y: 960, o: 0.9 * ease.inOutQuad(prog(lt, b(3.6), b(4))) });
        rows.forEach((row, i) => {
          const p = popIn(lt - b(4 + i * 0.75), { rise: 60, f: 2.6, d: 8 });
          row.set({ x: 540, y: 620 + i * 190 + p.dy, s: p.s, r: i % 2 ? 1 : -1, o: p.o });
        });
      },
    };
  };

  // ================================================================ end card
  S.guEnd = (root, from, to) => {
    const title = new Title(root, C.endTitle, { size: 120, fill: 'mango' });
    const logo = new Sprite(root, logoSVG(760));
    const btn = new Sprite(root, `<div class="play-btn">${PLAY_ICON}<span>${C.play}</span></div>`);
    const free = sticker(root, C.free, 'dark');
    const url = new Sprite(root, `<div class="url">${C.url}</div>`);
    const confetti = confettiBurst(root, { n: 50, seed: 88, x: 540, y: 640, t0: b(1) });
    fx.flash(from, 0.8, 8);
    fx.shake(from, 30, 6);
    cue(from, 'impact', { gain: 1 });
    cue(from + b(1), 'confetti', { gain: 0.7 });
    cue(from + b(3), 'click', { kind: 'sfx' });
    cue(from + b(4), 'win', { kind: 'sfx', gain: 0.8 });
    return {
      from, to, enter: ['zoomIn', 0.16], tint: 'pink',
      update(lt) {
        title.sprite.set({ x: 540, y: 330 });
        title.pop(lt, { stagger: 0.025 });
        confetti.update(lt);
        const land = 0.11;
        const q = lt - b(1);
        const sl = q < land ? lerp(2.8, 0.92, ease.inQuad(clamp(q / land))) : 0.92 + 0.08 * spring(q - land, 2.2, 5.5);
        logo.set({ x: 540, y: 700 + Math.sin(lt * 2.6) * 8, s: sl, r: -8 + Math.sin(lt * 2) * 1.2, o: q > 0 ? 1 : 0 });
        const bp = popIn(lt - b(2), { f: 2.2, d: 6 });
        const tap = Math.max(0, 1 - Math.abs(lt - b(3)) / 0.12);
        btn.set({ x: 540, y: 1080 + bp.dy + tap * 10, s: bp.s * (1 - tap * 0.05) * (1 + 0.03 * decay(lt % b(1), 8)), o: bp.o });
        const fp = popIn(lt - b(2.5));
        free.set({ x: 540, y: 1270 + fp.dy, s: fp.s, o: fp.o });
        const up = popIn(lt - b(3), { f: 2.4, d: 7 });
        url.set({ x: 540, y: 1400 + up.dy, s: up.s, r: -2, o: up.o });
      },
    };
  };

  return S;
}
