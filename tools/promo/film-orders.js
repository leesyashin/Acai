// The 'orders' promo film (tools/promo, ?version=orders): a POV story told on a phone's lock screen.
// The café opens at 8:00 and the orders come in as notifications – slowly, then faster and faster,
// the guests get impatient, the phone rattles on the table. Drop: "no problem" – the game on a tablet,
// the notifications turn green one by one (paid, tips, five stars). In the evening one last
// notification – "your café is waiting" – is tapped and opens into the end card. 124 BPM, a snare-roll
// build into the game's groove.

import { logoSVG, bowlSVG, ingredientIcon, customerSVG, lookFromSeed, coinSVG, matchaGlassSVG, appIconSVG } from '../../js/art.js';
import { createRng } from '../../js/rng.js';
import { clamp, lerp, prog, ease, spring, decay, wob } from './motion.js';
import { Sprite, Title, Ring, touchMarkup, setTouch } from './kit.js';

const COPY = {
  de: {
    date: 'Montag, 19. Oktober',
    pov: ['POV: dein Açaí-Café öffnet ☕'],
    now: 'jetzt',
    newOrder: (n) => `Neue Bestellung · ${n}`,
    count: (n) => `${n} neue Bestellungen`,
    angry: ['Wo bleibt meine Bowl?? 😤', 'Ich warte schon 10 Minuten!!', 'Hallo??? 😡', 'Bin gleich weg …', '1 ⭐ – viel zu langsam', 'Ich hab Hunger 😭'],
    help: ['wie soll ich das', 'schaffen?? 😭'],
    calm: 'KEIN\nPROBLEM.',
    trained: ['ich spiel seit Wochen Açaí Fever 😎'],
    chips: ['1 Mixen', '2 Belegen', '3 Servieren'],
    paid: (n) => `${n} hat bezahlt ✓`,
    tip: (c, t) => `+${c} Münzen · +${t} Trinkgeld`,
    review: (n) => `⭐⭐⭐⭐⭐ von ${n}`,
    quotes: ['„Beste Bowl der Stadt!“', '„So schnell!! 😍“', '„Komme morgen wieder!“'],
    evening: ['Feierabend. 💜'],
    lastTitle: 'Dein Café wartet auf dich!',
    lastText: 'Jetzt kostenlos spielen · tippen',
    play: 'JETZT SPIELEN',
    free: 'Kostenlos im Browser · Link in Bio',
    url: 'leesyashin.github.io/Acai',
    names: ['Lena', 'Tim', 'Mia', 'Jonas', 'Emma', 'Paul', 'Sofia', 'Ben', 'Lea', 'Finn', 'Hannah', 'Noah', 'Clara', 'Luis', 'Ida', 'Max'],
  },
  en: {
    date: 'Monday, 19 October',
    pov: ['POV: your açaí café opens ☕'],
    now: 'now',
    newOrder: (n) => `New order · ${n}`,
    count: (n) => `${n} new orders`,
    angry: ['Where is my bowl?? 😤', 'Been waiting 10 minutes!!', 'Hellooo??? 😡', 'I\'m leaving …', '1 ⭐ – way too slow', 'I\'m sooo hungry 😭'],
    help: ['how am I supposed', 'to do this?? 😭'],
    calm: 'NO\nPROBLEM.',
    trained: ['been playing Açaí Fever for weeks 😎'],
    chips: ['1 Blend', '2 Top', '3 Serve'],
    paid: (n) => `${n} paid ✓`,
    tip: (c, t) => `+${c} coins · +${t} tip`,
    review: (n) => `⭐⭐⭐⭐⭐ from ${n}`,
    quotes: ['"Best bowl in town!"', '"So fast!! 😍"', '"Coming back tomorrow!"'],
    evening: ['closing time. 💜'],
    lastTitle: 'Your café is waiting for you!',
    lastText: 'Play now for free · tap',
    play: 'PLAY NOW',
    free: 'Free in your browser · link in bio',
    url: 'leesyashin.github.io/Acai',
    names: ['Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Lucas', 'Mia', 'Leo', 'Ella', 'Finn', 'Grace', 'Jack', 'Chloe', 'Max', 'Ruby', 'Sam'],
  },
};

export const CUTS = {
  orders: {
    theme: 'phone',
    energy: 0.8,
    scenes: [['phFlood', 20, { enter: null }], ['phCalm', 16], ['phEnd', 8]],
    music: [
      { style: 'intro', g: 0, lead: false },
      { style: 'build', chords: ['Am', 'F'], roll: 1 }, { style: 'build', chords: ['C', 'G'], roll: 1 }, { style: 'build', chords: ['Am', 'E7'], roll: 2 },
      { style: 'tension', chords: ['Am', 'E7'], mel: null },
      { style: 'drop', g: 0 }, { style: 'groove', g: 1 }, { style: 'groove', g: 2 }, { style: 'groove', g: 3, fill: true },
      { style: 'groove', chords: ['Dm7', 'G7'], mel: 15, harmony: true, fill: true }, { style: 'end' },
    ],
  },
};

const APP = 'AÇAÍ FEVER';
const NOTE_STEP = 214; // a notification's height plus the gap to the next
const LIST_Y = 820; // the newest notification's centre

// TikTok's text sticker (one rounded box per line)
const sticker = (root, lines, cls = '') => new Sprite(root, `<div class="tk ${cls}">${lines.map((l) => `<span>${l}</span>`).join('<br>')}</div>`);

const ICON = appIconSVG(104);
const BADGE = appIconSVG(50);

// One notification: a guest's face with the app's icon on it, the app, the guest and the order or message.
function noteMarkup({ seed = null, mood = 'happy', title, text, cls = '', time }) {
  const pic = seed === null
    ? `<div class="ph-icon">${ICON}</div>`
    : `<div class="ph-avatar"><div class="ph-face">${customerSVG(lookFromSeed(seed), mood, 96)}</div><div class="ph-badge">${BADGE}</div></div>`;
  return `<div class="ph-note ${cls}">${pic}<div class="ph-body"><div class="ph-top"><span>${APP}</span><span>${time}</span></div>` +
    `<div class="ph-title">${title}</div><div class="ph-text">${text}</div></div></div>`;
}

// the icons of an order: the cup with its base, the fruits and toppings, maybe a matcha
function orderIcons(rng) {
  const bases = ['acai', 'pitaya', 'spirulina'];
  const mids = ['banana', 'strawberry', 'blueberry', 'mango', 'kiwi', 'granola'];
  const tops = ['honey', 'coconut', 'chia', 'peanut', 'chocolate', 'mint', 'cacao'];
  const pick = (arr) => arr[Math.floor(rng.next() * arr.length)];
  let s = bowlSVG({ base: pick(bases) }, 62);
  const n = 2 + Math.floor(rng.next() * 3);
  const used = new Set();
  for (let i = 0; i < n; i++) {
    let id = pick(i < 2 ? mids : tops);
    while (used.has(id)) id = pick(i < 2 ? mids : tops);
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

export function scenes({ lang, b, cue, fx, shot, popIn, confettiBurst, PLAY_ICON }) {
  const C = COPY[lang] || COPY.de;
  const S = {};

  // the lock screen's clock and date
  function lockClock(root) {
    const date = new Sprite(root, `<div class="ph-date">${C.date}</div>`);
    const clock = new Sprite(root, '<div class="ph-clock"></div>');
    const el = clock.in.firstChild;
    return (text, { y = 0, o = 1, red = 0, s = 1 } = {}) => {
      if (el.textContent !== text) el.textContent = text;
      el.style.color = red > 0.01 ? `rgb(255,${Math.round(255 - red * 170)},${Math.round(255 - red * 160)})` : '';
      date.set({ x: 540, y: 250 + y, o });
      clock.set({ x: 540, y: 420 + y, o, s });
    };
  }

  // ================================================================ the orders flood in
  S.phFlood = (root, from, to) => {
    const wall = bokeh(root, 4);
    const clock = lockClock(root);
    const pov = sticker(root, C.pov);
    // when each notification comes in (beats): one, a pause, then ever faster
    const times = [3, 5, 6.5, 8, 9, 10, 10.5, 11, 11.5, 12, 12.5, 12.75, 13, 13.25, 13.5, 13.75, 14, 14.25, 14.5, 14.625, 14.75, 14.875, 15,
      15.125, 15.25, 15.375, 15.5, 15.625, 15.75, 15.875, 16, 16.25, 16.5, 16.75, 17, 17.25, 17.5, 17.75, 18, 18.25, 18.5];
    const rng = createRng(11);
    const notes = times.map((bt, i) => {
      const seed = 3 + ((i * 7) % 29);
      const nm = C.names[i % C.names.length];
      const late = bt >= 11;
      const angry = late && i % 3 !== 0;
      const html = angry
        ? noteMarkup({ seed, mood: i % 2 ? 'angry' : 'impatient', title: nm, text: C.angry[i % C.angry.length], cls: 'red', time: C.now })
        : noteMarkup({ seed, mood: 'happy', title: C.newOrder(nm), text: orderIcons(rng), time: C.now });
      return { t: b(bt), sp: new Sprite(root, html), angry };
    });
    const count = new Sprite(root, '<div class="ph-count"></div>');
    const countEl = count.in.firstChild;
    const help = sticker(root, C.help, 'dark');
    notes.forEach((n, i) => {
      if (i < 10 || i % 2 === 0) cue(from + n.t, 'ping', { gain: i < 6 ? 0.55 : 0.35 });
      if (i < 4 || i % 3 === 0) cue(from + n.t + 0.02, 'buzz', { gain: i < 4 ? 0.5 : 0.35, len: i < 4 ? 0.32 : 0.18 });
      if (n.angry && i % 4 === 1) cue(from + n.t + 0.05, 'angry', { kind: 'sfx', gain: 0.35 });
      // the first orders stay readable; the phone only rattles once the rush is on
      if (i >= 9) fx.shake(from + n.t, 6 + i * 0.5, 9);
    });
    cue(from + b(2), 'click', { kind: 'sfx', gain: 0.6 });
    cue(from + b(16), 'heart', { kind: 'sfx', gain: 0.6 });
    cue(from + b(18), 'riser', { len: b(2), gain: 0.8 });
    fx.shake(from + b(16), 30, 2);
    fx.flash(from + b(16), 0.18, 10);
    return {
      from, to, leave: ['zoomOut', 0.12],
      alarm: (lt) => (lt > b(16) ? 0.35 + 0.3 * Math.max(0, Math.sin(lt * 14)) : 0),
      update(lt, t) {
        wall(t);
        clock(lt < b(2) ? '7:59' : lt < b(14) ? '8:00' : lt < b(17) ? '8:01' : '8:02', { red: prog(lt, b(15), b(16)), s: 1 + 0.04 * decay(lt - b(2), 8) });
        // the newest on top; each new one pushes the others down
        notes.forEach((n, i) => {
          const k = lt - n.t;
          if (k < 0) return n.sp.hide();
          let slot = 0;
          for (let j = i + 1; j < notes.length; j++) slot += ease.outCubic(clamp((lt - notes[j].t) / 0.16));
          const y = LIST_Y + slot * NOTE_STEP;
          if (y > 2120) return n.sp.hide();
          const e = ease.outBack(clamp(k / 0.2));
          return n.sp.set({ x: 500 + (n.angry ? wob(lt * 3, i) * 4 : 0), y: y - (1 - e) * 140, s: 0.94 + 0.06 * e, o: clamp(k / 0.08) });
        });
        const seen = notes.filter((n) => lt >= n.t).length;
        if (seen < 4) count.hide();
        else {
          const label = seen >= 40 ? C.count('99+') : C.count(seen);
          if (countEl.textContent !== label) countEl.textContent = label;
          const last = notes[seen - 1].t;
          count.set({ x: 540, y: 640, s: 0.62 * (1 + 0.12 * decay(lt - last, 10)), r: -2 });
        }
        // the hook stays until the counter takes its place
        if (lt < b(7.6)) pov.set({ x: 540, y: 640, s: lerp(0.9, 1, ease.outBack(clamp(lt / 0.2))), o: clamp(lt / 0.06) * (1 - prog(lt, b(7.4), b(7.6))) });
        else pov.hide();
        const hp = popIn(lt - b(16), { f: 3, d: 9 });
        help.set({ x: 540, y: 1180 + hp.dy + wob(lt * 3, 5) * 6, s: hp.s, r: -3, o: hp.o });
      },
    };
  };

  // ================================================================ no problem: the game, everything paid
  S.phCalm = (root, from, to) => {
    const wall = bokeh(root, 4);
    const title = new Title(root, C.calm, { size: 150, fill: 'white' });
    const coins = new Sprite(root, `<div class="pill" style="font-size:84px">${coinSVG(100)}<span class="cn">0</span></div>`);
    const coinEl = coins.in.querySelector('.cn');
    const W = 900;
    const H = Math.round((W * 800) / 1280);
    // the screenshot of the real game render.mjs hands over, else the live game
    const screen = shot ? `<img src="${shot}" width="${W}" height="${H}" alt="">`
      : `<iframe src="../../index.html" width="1280" height="800" style="border:0;transform:scale(${(W / 1280).toFixed(4)});transform-origin:0 0"></iframe>`;
    const tablet = new Sprite(root, `<div class="tablet"><div class="tablet-screen" style="width:${W}px;height:${H}px">${screen}<div class="tablet-glare"></div></div></div>`);
    const persp = tablet.in.firstChild;
    const glare = tablet.in.querySelector('.tablet-glare');
    const trained = sticker(root, C.trained);
    const chips = C.chips.map((txt, i) => new Sprite(root, `<div class="chip ${['pink', 'lagoon', 'mango'][i]}">${txt}</div>`));
    const chipAt = [[260, 1400, -5], [800, 1420, 4], [540, 1520, -2]];
    const ring = new Ring(root, { x: 540, y: 330, t0: 0, size: 1300, color: '#ffffff', width: 26 });
    const confetti = confettiBurst(root, { n: 40, seed: 21, x: 540, y: 330, t0: 0.02 });
    // the green notifications: paid, tips and reviews
    const rng = createRng(5);
    const greens = [4, 5, 6, 7, 8, 9, 10, 11].map((bt, i) => {
      const nm = C.names[(i * 3) % C.names.length];
      const c = 9 + Math.floor(rng.next() * 9);
      const tp = 2 + Math.floor(rng.next() * 6);
      const review = i % 3 === 2;
      const html = noteMarkup({ seed: 3 + ((i * 5) % 29), mood: 'happy', title: review ? C.review(nm) : C.paid(nm), text: review ? C.quotes[(i / 3) | 0] : `${coinSVG(46)} ${C.tip(c, tp)}`, cls: 'green', time: C.now });
      return { t: b(bt), sp: new Sprite(root, html), value: review ? 0 : c + tp };
    });
    fx.flash(from, 0.9, 7);
    fx.shake(from, 34, 6);
    fx.punch(from, 0.06, 7);
    cue(from, 'impact', { gain: 1 });
    cue(from + b(0.6), 'whoosh', { gain: 0.5 });
    C.chips.forEach((_, i) => cue(from + b(2 + i * 0.5), 'pop', { gain: 0.45, pitch: 2 + i * 2 }));
    greens.forEach((g, i) => {
      cue(from + g.t, g.value ? 'coin' : 'star', { kind: 'sfx', gain: 0.7, step: 2 });
      if (i % 2 === 0) cue(from + g.t + 0.03, 'ping', { gain: 0.25 });
      fx.punch(from + g.t, 0.015, 10);
    });
    cue(from + b(12), 'purchase', { kind: 'sfx', gain: 0.8 });
    cue(from + b(15.6), 'whoosh', { gain: 0.6 });
    return {
      from, to, enter: null, leave: ['whipOut', 0.12], tint: 'pink',
      update(lt, t) {
        wall(t);
        ring.update(lt);
        confetti.update(lt);
        // the title slams in, then makes room for the coin counter
        const land = 0.1;
        const out = ease.inBack(prog(lt, b(3.6), b(4)));
        const sl = lt < land ? lerp(2.4, 0.94, ease.inQuad(lt / land)) : 0.94 + 0.06 * spring(lt - land, 2.6, 7);
        title.sprite.set({ x: 540, y: 330 - out * 400, s: sl, r: -3, o: 1 - out });
        title.rest();
        const tp = popIn(lt - b(0.75), { f: 2.6, d: 9 });
        trained.set({ x: 540, y: 590 - out * 500, s: tp.s, r: 2, o: tp.o * (1 - out) });
        let total = 0;
        greens.forEach((g) => { if (lt > g.t) total += g.value; });
        const cp = popIn(lt - b(4), { f: 2.4, d: 7 });
        const last = greens.filter((g) => lt > g.t).pop();
        coinEl.textContent = String(total * 12 + (lt > b(12) ? Math.round(Math.min(1, (lt - b(12)) / b(1)) * 480) : 0));
        coins.set({ x: 540, y: 300 + cp.dy, s: cp.s * (1 + (last ? 0.08 * decay(lt - last.t, 10) : 0) + 0.06 * decay(lt - b(12), 8)), o: cp.o });
        // the tablet swings in and rises as the notifications fill in under it
        const k = ease.outCubic(prog(lt, b(0.4), b(1.6)));
        const up = ease.inOutCubic(prog(lt, b(3.5), b(4.5)));
        persp.style.transform = `perspective(1800px) rotateX(${lerp(20, 0, k).toFixed(2)}deg) rotateY(${lerp(32, 0, k).toFixed(2)}deg)`;
        tablet.set({ x: 540, y: lerp(lerp(1600, 1010, ease.outBack(prog(lt, b(0.4), b(1.4)))), 720, up), s: lerp(0.8, lerp(1, 0.86, up), k), r: lerp(6, 0, k), o: lt > b(0.4) ? 1 : 0 });
        glare.style.transform = `translateX(${lerp(-110, 110, prog(lt, b(1), b(2.4))).toFixed(1)}%)`;
        chips.forEach((c, i) => {
          const p = popIn(lt - b(2 + i * 0.5), { f: 2.6, d: 8 });
          const o2 = 1 - prog(lt, b(3.4), b(3.8));
          const [x, y, r] = chipAt[i];
          c.set({ x, y: y + p.dy, s: p.s * 1.25, r, o: p.o * o2 });
        });
        greens.forEach((g, i) => {
          const kk = lt - g.t;
          if (kk < 0) return g.sp.hide();
          let slot = 0;
          for (let j = i + 1; j < greens.length; j++) slot += ease.outCubic(clamp((lt - greens[j].t) / 0.16));
          const y = 1230 + slot * NOTE_STEP;
          if (y > 2120) return g.sp.hide();
          const e = ease.outBack(clamp(kk / 0.22));
          return g.sp.set({ x: 500, y: y - (1 - e) * 120, s: 0.94 + 0.06 * e, o: clamp(kk / 0.08) });
        });
      },
    };
  };

  // ================================================================ evening: one last notification opens the game
  S.phEnd = (root, from, to) => {
    const wall = bokeh(root, 4);
    const clock = lockClock(root);
    const eve = sticker(root, C.evening);
    const note = new Sprite(root, noteMarkup({ title: C.lastTitle, text: C.lastText, time: C.now }));
    const touch = new Sprite(root, touchMarkup());
    const logo = new Sprite(root, logoSVG(880));
    const btn = new Sprite(root, `<div class="play-btn">${PLAY_ICON}<span>${C.play}</span></div>`);
    const free = sticker(root, [C.free], 'dark');
    const url = new Sprite(root, `<div class="url">${C.url}</div>`);
    const confetti = confettiBurst(root, { n: 50, seed: 41, x: 540, y: 560, t0: b(3) + 0.02 });
    const Tn = b(1);
    const Tt = b(2.5);
    const To = b(3);
    cue(from + Tn, 'ping', { gain: 0.7 });
    cue(from + Tn + 0.02, 'buzz', { gain: 0.4 });
    cue(from + Tt, 'click', { kind: 'sfx' });
    cue(from + To, 'impact', { gain: 0.9 });
    cue(from + To + 0.02, 'confetti', { gain: 0.7 });
    cue(from + b(5), 'click', { kind: 'sfx', gain: 0.8 });
    cue(from + b(5) + 0.02, 'win', { kind: 'sfx', gain: 0.8 });
    fx.flash(from + To, 0.8, 8);
    fx.punch(from + To, 0.06, 8);
    return {
      from, to, enter: ['whipIn', 0.14],
      update(lt, t) {
        wall(t);
        const open = ease.inCubic(prog(lt, Tt + 0.05, To));
        clock('20:00', { o: 1 - open });
        const ep = popIn(lt - 0.1, { f: 2.4, d: 9 });
        eve.set({ x: 540, y: 640, s: ep.s, r: -2, o: ep.o * (1 - open) });
        // the notification slides in, is tapped and blows up into the end card
        const e = ease.outBack(clamp((lt - Tn) / 0.25));
        const press = Math.max(0, 1 - Math.abs(lt - Tt) / 0.12);
        if (lt < Tn || open >= 1) note.hide();
        else note.set({ x: 500, y: 960 - (1 - e) * 160 + press * 6, s: (1.08 - press * 0.04) * (1 + open * 2.6), o: clamp((lt - Tn) / 0.08) * (1 - open) });
        setTouch(touch, {
          x: lerp(900, 640, ease.outCubic(prog(lt, Tt - b(0.8), Tt - 0.05))), y: lerp(1500, 1010, ease.outCubic(prog(lt, Tt - b(0.8), Tt - 0.05))),
          o: lt < Tt - b(0.8) ? 0 : 1 - prog(lt, Tt + 0.15, Tt + 0.3), press, ripple: (lt - Tt) / 0.35,
        });
        confetti.update(lt);
        const land = 0.11;
        const q = lt - To;
        const sl = q < land ? lerp(2.8, 0.92, ease.inQuad(clamp(q / land))) : 0.92 + 0.08 * spring(q - land, 2.2, 5.5);
        logo.set({ x: 540, y: 520 + Math.sin(lt * 2.6) * 8, s: sl, r: -8 + Math.sin(lt * 2) * 1.2, o: q > 0 ? 1 : 0 });
        const bp = popIn(lt - b(3.75), { f: 2.2, d: 6 });
        const tap = Math.max(0, 1 - Math.abs(lt - b(5)) / 0.12);
        btn.set({ x: 540, y: 960 + bp.dy + tap * 10, s: bp.s * (1 - tap * 0.05), o: bp.o });
        const fp = popIn(lt - b(4.5));
        free.set({ x: 540, y: 1160 + fp.dy, s: fp.s, o: fp.o });
        const up = popIn(lt - b(5), { f: 2.4, d: 7 });
        url.set({ x: 540, y: 1300 + up.dy, s: up.s, r: -2, o: up.o });
      },
    };
  };

  return S;
}
