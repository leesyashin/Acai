// The 'orders' promo film (tools/promo, ?version=orders): a POV story on a phone's lock screen, cut fast.
// From the first frame the orders pour in as notifications – faster and faster, the guests get angry,
// the phone rattles, "HELP!!" – then the drop: "NO PROBLEM." slams in, the game on a tablet, three
// words for the three steps, and the notifications turn green one per half beat (paid, tips, five
// stars) while the coins count up. In the evening one last notification is tapped and blows up into
// the end card. 124 BPM: a snare-roll build into the game's groove.

import { logoSVG, bowlSVG, ingredientIcon, customerSVG, lookFromSeed, coinSVG, matchaGlassSVG, appIconSVG } from '../../js/art.js';
import { createRng } from '../../js/rng.js';
import { clamp, lerp, prog, ease, spring, decay, wob } from './motion.js';
import { Sprite, Title, Ring, touchMarkup, setTouch } from './kit.js';
import { capWords, emojiBurst, sticker } from './tiktok.js';

const COPY = {
  de: {
    date: 'Montag, 19. Oktober',
    pov: ['POV:', 'DEIN CAFÉ', 'ÖFFNET', 'UM 8'],
    now: 'jetzt',
    newOrder: (n) => `Neue Bestellung · ${n}`,
    count: (n) => `${n} neue Bestellungen`,
    angry: ['Wo bleibt meine Bowl?? 😤', 'Ich warte schon 10 Minuten!!', 'Hallo??? 😡', 'Bin gleich weg …', '1 ⭐ – viel zu langsam', 'Ich hab Hunger 😭'],
    help: 'HILFE!!',
    calm: 'KEIN\nPROBLEM.',
    trained: ['ich spiel Açaí Fever 😎'],
    steps: ['MIXEN', 'BELEGEN', 'SERVIEREN'],
    paid: (n) => `${n} hat bezahlt ✓`,
    tip: (c, t) => `+${c} Münzen · +${t} Trinkgeld`,
    review: (n) => `⭐⭐⭐⭐⭐ von ${n}`,
    quotes: ['„Beste Bowl der Stadt!“', '„So schnell!! 😍“', '„Komme morgen wieder!“'],
    lastTitle: 'Dein Café wartet auf dich!',
    lastText: 'Jetzt kostenlos spielen · tippen',
    play: 'JETZT SPIELEN',
    free: ['kostenlos im Browser · Link in Bio'],
    url: 'leesyashin.github.io/Acai',
    names: ['Lena', 'Tim', 'Mia', 'Jonas', 'Emma', 'Paul', 'Sofia', 'Ben', 'Lea', 'Finn', 'Hannah', 'Noah', 'Clara', 'Luis', 'Ida', 'Max'],
  },
  en: {
    date: 'Monday, 19 October',
    pov: ['POV:', 'YOUR CAFÉ', 'OPENS', 'AT 8'],
    now: 'now',
    newOrder: (n) => `New order · ${n}`,
    count: (n) => `${n} new orders`,
    angry: ['Where is my bowl?? 😤', 'Been waiting 10 minutes!!', 'Hellooo??? 😡', 'I\'m leaving …', '1 ⭐ – way too slow', 'I\'m sooo hungry 😭'],
    help: 'HELP!!',
    calm: 'NO\nPROBLEM.',
    trained: ['I play Açaí Fever 😎'],
    steps: ['BLEND', 'TOP', 'SERVE'],
    paid: (n) => `${n} paid ✓`,
    tip: (c, t) => `+${c} coins · +${t} tip`,
    review: (n) => `⭐⭐⭐⭐⭐ from ${n}`,
    quotes: ['"Best bowl in town!"', '"So fast!! 😍"', '"Coming back tomorrow!"'],
    lastTitle: 'Your café is waiting for you!',
    lastText: 'Play now for free · tap',
    play: 'PLAY NOW',
    free: ['free in your browser · link in bio'],
    url: 'leesyashin.github.io/Acai',
    names: ['Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Lucas', 'Mia', 'Leo', 'Ella', 'Finn', 'Grace', 'Jack', 'Chloe', 'Max', 'Ruby', 'Sam'],
  },
};

export const CUTS = {
  orders: {
    theme: 'phone',
    energy: 1,
    bounce: [8, 18],
    bounceAmp: 0.025,
    scenes: [['phFlood', 8, { enter: null }], ['phCalm', 10], ['phEnd', 6]],
    music: [
      { style: 'build', chords: ['Am', 'F'], roll: 1 }, { style: 'build', chords: ['Am', 'E7'], roll: 2 },
      { style: 'drop', g: 0 }, { style: 'groove', g: 1 }, { style: 'groove', g: 3, fill: true }, { style: 'end' },
    ],
  },
};

const APP = 'AÇAÍ FEVER';
const NOTE_STEP = 214; // a notification's height plus the gap to the next
const LIST_Y = 820; // the newest notification's centre
const ICON = appIconSVG(104);
const BADGE = appIconSVG(50);

// One notification: a guest's face with the app's icon on it (or the app's icon), the app, title and text.
function noteMarkup({ seed = null, mood = 'happy', title, text, cls = '', time }) {
  const pic = seed === null
    ? `<div class="ph-icon">${ICON}</div>`
    : `<div class="ph-avatar"><div class="ph-face">${customerSVG(lookFromSeed(seed), mood, 96)}</div><div class="ph-badge">${BADGE}</div></div>`;
  return `<div class="ph-note ${cls}">${pic}<div class="ph-body"><div class="ph-top"><span>${APP}</span><span>${time}</span></div>` +
    `<div class="ph-title">${title}</div><div class="ph-text">${text}</div></div></div>`;
}

// the icons of an order: the cup with its base, the fruits and toppings, sometimes a matcha with an extra
function orderIcons(rng) {
  const pick = (arr) => arr[Math.floor(rng.next() * arr.length)];
  let s = bowlSVG({ base: pick(['acai', 'pitaya', 'spirulina']) }, 62);
  const used = new Set();
  const n = 2 + Math.floor(rng.next() * 3);
  for (let i = 0; i < n; i++) {
    const from = i < 2 ? ['banana', 'strawberry', 'blueberry', 'mango', 'kiwi', 'granola'] : ['honey', 'coconut', 'chia', 'peanut', 'chocolate', 'mint', 'cacao'];
    let id = pick(from);
    while (used.has(id)) id = pick(from);
    used.add(id);
    s += ingredientIcon(id, 54);
  }
  if (rng.next() < 0.35) {
    const extras = rng.next() < 0.5 ? [pick(['ice', 'vanilla', 'foam'])] : [];
    s += `<span style="width:14px"></span>${matchaGlassSVG(pick(['mStrawberry', 'mMango', 'mBanana', 'mBlueberry']), 'ready', 58, { extras })}`;
  }
  return s;
}

// soft out-of-focus lights of the wallpaper, drifting on the film's clock (continuous across cuts)
function bokeh(root, seed) {
  const rng = createRng(seed);
  const cols = ['#ffd1e8', '#ffb4a2', '#d8a8ff', '#ffe6a8', '#a8f0ff'];
  const ps = [...Array(9)].map((_, i) => {
    const size = Math.round(rng.range(120, 300));
    return {
      sp: new Sprite(root, `<div class="ph-bokeh" style="width:${size}px;height:${size}px;background:${cols[i % cols.length]}"></div>`),
      x: rng.range(0, 1080), y: rng.range(0, 1920), vx: rng.range(-14, 14), vy: rng.range(-20, -6), ph: rng.range(0, 6),
    };
  });
  return (t) => ps.forEach((p) => p.sp.set({ x: p.x + p.vx * t + Math.sin(t * 0.5 + p.ph) * 40, y: p.y + p.vy * t, o: 0.22 + 0.1 * Math.sin(t * 0.8 + p.ph) }));
}

// a stack of notifications, the newest on top: each new one pushes the others down
function stack(notes, lt, top, x = 500) {
  notes.forEach((n, i) => {
    const k = lt - n.t;
    if (k < 0) return n.sp.hide();
    let slot = 0;
    for (let j = i + 1; j < notes.length; j++) slot += ease.outCubic(clamp((lt - notes[j].t) / 0.12));
    const y = top + slot * NOTE_STEP;
    if (y > 2120) return n.sp.hide();
    const e = ease.outBack(clamp(k / 0.16));
    return n.sp.set({ x: x + (n.angry ? wob(lt * 3, i) * 5 : 0), y: y - (1 - e) * 140, s: 0.94 + 0.06 * e, o: clamp(k / 0.06) });
  });
}

const slam = (k, from = 2.2) => (k < 0 ? 0 : k < 0.1 ? lerp(from, 0.92, ease.inQuad(k / 0.1)) : 0.92 + 0.08 * spring(k - 0.1, 3, 8));

export function scenes({ lang, b, cue, fx, shot, popIn, confettiBurst, PLAY_ICON }) {
  const C = COPY[lang] || COPY.de;
  const S = {};

  // the lock screen's clock and date
  function lockClock(root) {
    const date = new Sprite(root, `<div class="ph-date">${C.date}</div>`);
    const clock = new Sprite(root, '<div class="ph-clock"></div>');
    const el = clock.in.firstChild;
    return (text, { o = 1, red = 0, s = 1 } = {}) => {
      if (el.textContent !== text) el.textContent = text;
      el.style.color = red > 0.01 ? `rgb(255,${Math.round(255 - red * 170)},${Math.round(255 - red * 160)})` : '';
      date.set({ x: 540, y: 250, o });
      clock.set({ x: 540, y: 420, o, s });
    };
  }

  // ================================================================ the orders flood in from the first frame
  S.phFlood = (root, from, to) => {
    const wall = bokeh(root, 4);
    const clock = lockClock(root);
    // when each one comes in (beats): every half beat, then quarters, then sixteenths
    const times = [0.25, 0.75, 1.25, 1.75, 2.25, 2.75, 3, 3.25, 3.5, 3.75, 4];
    for (let bt = 4.25; bt < 7.9; bt += 0.125) times.push(bt);
    const rng = createRng(11);
    const notes = times.map((bt, i) => {
      const seed = 3 + ((i * 7) % 29);
      const nm = C.names[i % C.names.length];
      const angry = bt >= 2.5 && i % 3 !== 0;
      const html = angry
        ? noteMarkup({ seed, mood: i % 2 ? 'angry' : 'impatient', title: nm, text: C.angry[i % C.angry.length], cls: 'red', time: C.now })
        : noteMarkup({ seed, mood: 'happy', title: C.newOrder(nm), text: orderIcons(rng), time: C.now });
      return { t: b(bt), sp: new Sprite(root, html), angry };
    });
    const count = new Sprite(root, '<div class="ph-count"></div>');
    const countEl = count.in.firstChild;
    const pov = capWords(root, C.pov.map((w, i) => [b(i * 0.5), b(i * 0.5 + 0.5), w, i ? '' : 'y']), { y: 650, size: 96 });
    const emo = emojiBurst(root, { emojis: ['😭', '😡', '🔥', '⏰'], x: 540, y: 1400, t0: b(6), n: 14, seed: 6 });
    const help = capWords(root, [[b(6), b(8), C.help, 'p']], { y: 1180, size: 170 });
    notes.forEach((n, i) => {
      if (i < 12 || i % 2 === 0) cue(from + n.t, 'ping', { gain: i < 8 ? 0.55 : 0.32 });
      if (i < 6 || i % 3 === 0) cue(from + n.t + 0.02, 'buzz', { gain: 0.4, len: i < 6 ? 0.25 : 0.15 });
      if (n.angry && i % 4 === 1) cue(from + n.t + 0.05, 'angry', { kind: 'sfx', gain: 0.35 });
      if (i >= 8) fx.shake(from + n.t, 6 + i * 0.6, 9);
    });
    cue(from + b(0.5), 'click', { kind: 'sfx', gain: 0.6 });
    cue(from + b(6), 'boom', { gain: 0.7 });
    cue(from + b(6), 'heart', { kind: 'sfx', gain: 0.6 });
    cue(from + b(6), 'riser', { len: b(2), gain: 0.9 });
    fx.flash(from + b(6), 0.3, 10);
    fx.glitch(from + b(7));
    fx.glitch(from + b(7.5));
    fx.glitch(from + b(7.75), 0.2, 20);
    return {
      from, to, leave: ['zoomBlurOut', 0.1],
      alarm: (lt) => (lt > b(5.5) ? 0.35 + 0.35 * Math.max(0, Math.sin(lt * 16)) : 0),
      update(lt, t) {
        wall(t);
        clock(lt < b(0.5) ? '7:59' : lt < b(4) ? '8:00' : lt < b(6) ? '8:01' : '8:02', { red: prog(lt, b(5), b(6)), s: 1 + 0.06 * decay(lt - b(0.5), 8) });
        stack(notes, lt, LIST_Y);
        const seen = notes.filter((n) => lt >= n.t).length;
        if (lt < b(2)) count.hide();
        else {
          const label = seen >= 40 ? C.count('99+') : C.count(seen);
          if (countEl.textContent !== label) countEl.textContent = label;
          const last = notes[seen - 1].t;
          count.set({ x: 540, y: 645, s: 0.66 * (1 + 0.14 * decay(lt - last, 10)) * (lt < b(2.15) ? slam(lt - b(2), 1.6) : 1), r: -2 });
        }
        pov(lt);
        help(lt, wob(lt * 3, 5) * 8);
        emo.update(lt);
      },
    };
  };

  // ================================================================ no problem: the game, then everything turns green
  S.phCalm = (root, from, to) => {
    const wall = bokeh(root, 4);
    const title = new Title(root, C.calm, { size: 160, fill: 'white' });
    const W = 900;
    const H = Math.round((W * 800) / 1280);
    // the screenshot of the real game render.mjs hands over, else the live game
    const screen = shot ? `<img src="${shot}" width="${W}" height="${H}" alt="">`
      : `<iframe src="../../index.html" width="1280" height="800" style="border:0;transform:scale(${(W / 1280).toFixed(4)});transform-origin:0 0"></iframe>`;
    const tablet = new Sprite(root, `<div class="tablet"><div class="tablet-screen" style="width:${W}px;height:${H}px">${screen}<div class="tablet-glare"></div></div></div>`);
    const glare = tablet.in.querySelector('.tablet-glare');
    const trained = sticker(root, C.trained);
    const steps = capWords(root, C.steps.map((w, i) => [b(2 + i * 0.5), b(2.5 + i * 0.5), w, ['p', 'c', 'y'][i]]), { y: 1400, size: 130 });
    const coins = new Sprite(root, `<div class="pill" style="font-size:96px">${coinSVG(112)}<span class="cn">0</span></div>`);
    const coinEl = coins.in.querySelector('.cn');
    const ring = new Ring(root, { x: 540, y: 330, t0: 0, size: 1300, color: '#ffffff', width: 26 });
    const confetti = confettiBurst(root, { n: 50, seed: 21, x: 540, y: 330, t0: 0.02 });
    const rng = createRng(5);
    const greens = [4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5].map((bt, i) => {
      const nm = C.names[(i * 3) % C.names.length];
      const c = 9 + Math.floor(rng.next() * 9);
      const tp = 2 + Math.floor(rng.next() * 6);
      const review = i % 3 === 2;
      const html = noteMarkup({ seed: 3 + ((i * 5) % 29), mood: 'happy', title: review ? C.review(nm) : C.paid(nm), text: review ? C.quotes[(i / 3) | 0] : `${coinSVG(46)} ${C.tip(c, tp)}`, cls: 'green', time: C.now });
      return { t: b(bt), sp: new Sprite(root, html), value: review ? 0 : c + tp };
    });
    const money = emojiBurst(root, { emojis: ['💰', '🤑', '⭐', '💜'], x: 540, y: 330, t0: b(8.75), n: 14, seed: 14 });
    cue(from, 'boom', { gain: 1 });
    cue(from, 'impact', { gain: 0.6 });
    fx.impact(from + 0.03);
    fx.flash(from, 0.9, 7);
    fx.shake(from, 36, 6);
    fx.punch(from, 0.07, 7);
    fx.speed(from, 1, 2.6);
    cue(from + b(0.5), 'whoosh', { gain: 0.6 });
    fx.glitch(from + b(0.6));
    C.steps.forEach((_, i) => {
      cue(from + b(2 + i * 0.5), 'pop', { gain: 0.5, pitch: 2 + i * 2 });
      fx.punch(from + b(2 + i * 0.5), 0.04, 10);
    });
    greens.forEach((g, i) => {
      cue(from + g.t, g.value ? 'coin' : 'star', { kind: 'sfx', gain: 0.75, step: 2 });
      if (i % 2 === 0) cue(from + g.t + 0.03, 'ping', { gain: 0.25 });
      fx.punch(from + g.t, 0.025, 10);
    });
    cue(from + b(8.75), 'purchase', { kind: 'sfx', gain: 0.9 });
    cue(from + b(8.75), 'bling', { gain: 0.6 });
    fx.flash(from + b(8.75), 0.4, 10);
    cue(from + b(9.7), 'whoosh', { gain: 0.6 });
    return {
      from, to, enter: null, leave: ['whipOut', 0.1], tint: 'pink',
      update(lt, t) {
        wall(t);
        ring.update(lt);
        confetti.update(lt);
        // the title slams in, then makes room for the coin counter
        const out = ease.inBack(prog(lt, b(3.5), b(3.85)));
        title.sprite.set({ x: 540, y: 330 - out * 400, s: slam(lt, 2.6), r: -3, o: 1 - out });
        title.rest();
        const tp = popIn(lt - b(0.5), { f: 2.6, d: 9 });
        trained.set({ x: 540, y: 590 - out * 500, s: tp.s, r: 2, o: tp.o * (1 - out) });
        // the tablet slams in, then rises as the notifications fill in under it
        const k = lt - b(0.6);
        const up = ease.inOutCubic(prog(lt, b(3.5), b(4.2)));
        tablet.set({ x: 540, y: lerp(1000, 720, up), s: (k < 0 ? 0 : slam(k, 1.8)) * lerp(1, 0.86, up), r: k < 0.1 ? -6 * (1 - k / 0.1) : 0, o: k < 0 ? 0 : 1 });
        glare.style.transform = `translateX(${lerp(-110, 110, prog(lt, b(0.8), b(2))).toFixed(1)}%)`;
        steps(lt);
        let total = 0;
        greens.forEach((g) => { if (lt > g.t) total += g.value; });
        const cp = popIn(lt - b(3.85), { f: 2.6, d: 8 });
        const last = greens.filter((g) => lt > g.t).pop();
        coinEl.textContent = String(total * 12 + (lt > b(8.75) ? Math.round(Math.min(1, (lt - b(8.75)) / b(0.75)) * 480) : 0));
        coins.set({ x: 540, y: 300 + cp.dy, s: cp.s * (1 + (last ? 0.1 * decay(lt - last.t, 10) : 0) + 0.15 * decay(lt - b(8.75), 8)), o: cp.o });
        stack(greens, lt, 1230);
        money.update(lt);
      },
    };
  };

  // ================================================================ evening: one last notification blows up into the end card
  S.phEnd = (root, from, to) => {
    const wall = bokeh(root, 4);
    const clock = lockClock(root);
    const note = new Sprite(root, noteMarkup({ title: C.lastTitle, text: C.lastText, time: C.now }));
    const touch = new Sprite(root, touchMarkup());
    const logo = new Sprite(root, logoSVG(880));
    const btn = new Sprite(root, `<div class="play-btn">${PLAY_ICON}<span>${C.play}</span></div>`);
    const free = sticker(root, C.free, 'dark');
    const url = new Sprite(root, `<div class="url">${C.url}</div>`);
    const confetti = confettiBurst(root, { n: 60, seed: 41, x: 540, y: 560, t0: b(1.25) + 0.02 });
    const Tn = b(0.2);
    const Tt = b(1);
    const To = b(1.25);
    cue(from + Tn, 'ping', { gain: 0.7 });
    cue(from + Tn + 0.02, 'buzz', { gain: 0.4 });
    cue(from + Tt, 'click', { kind: 'sfx' });
    cue(from + To, 'boom', { gain: 1 });
    cue(from + To + 0.02, 'confetti', { gain: 0.7 });
    cue(from + b(2), 'click', { kind: 'sfx', gain: 0.8 });
    cue(from + b(2) + 0.02, 'win', { kind: 'sfx', gain: 0.8 });
    fx.impact(from + To + 0.03);
    fx.flash(from + To, 0.8, 8);
    fx.punch(from + To, 0.07, 8);
    fx.shake(from + To, 30, 6);
    return {
      from, to, enter: ['whipIn', 0.12],
      update(lt, t) {
        wall(t);
        const open = ease.inCubic(prog(lt, Tt + 0.03, To));
        clock('20:00', { o: 1 - open });
        const e = ease.outBack(clamp((lt - Tn) / 0.2));
        const press = Math.max(0, 1 - Math.abs(lt - Tt) / 0.1);
        if (lt < Tn || open >= 1) note.hide();
        else note.set({ x: 500, y: 960 - (1 - e) * 160 + press * 6, s: (1.08 - press * 0.04) * (1 + open * 2.6), o: clamp((lt - Tn) / 0.06) * (1 - open) });
        setTouch(touch, {
          x: lerp(900, 640, ease.outCubic(prog(lt, Tt - b(0.6), Tt - 0.04))), y: lerp(1500, 1010, ease.outCubic(prog(lt, Tt - b(0.6), Tt - 0.04))),
          o: lt < Tt - b(0.6) ? 0 : 1 - prog(lt, Tt + 0.1, Tt + 0.22), press, ripple: (lt - Tt) / 0.3,
        });
        confetti.update(lt);
        const q = lt - To;
        logo.set({ x: 540, y: 520 + Math.sin(lt * 2.6) * 8, s: slam(q, 2.8) + 0.02 * decay(lt % b(1), 9), r: -8 + Math.sin(lt * 2) * 1.2, o: q > 0 ? 1 : 0 });
        const bp = popIn(lt - b(1.6), { f: 2.4, d: 7 });
        const tap = Math.max(0, 1 - Math.abs(lt - b(2)) / 0.12);
        btn.set({ x: 540, y: 960 + bp.dy + tap * 10, s: bp.s * (1 - tap * 0.05) * (1 + 0.03 * decay(lt % b(1), 8)), o: bp.o });
        const fp = popIn(lt - b(2.25));
        free.set({ x: 540, y: 1160 + fp.dy, s: fp.s, o: fp.o });
        const up = popIn(lt - b(2.5), { f: 2.4, d: 7 });
        url.set({ x: 540, y: 1290 + up.dy, s: up.s, r: -2, o: up.o });
      },
    };
  };

  return S;
}
