// The promo films of Açaí Fever (tools/promo): 9:16 TikTok ads that introduce the game in 18–39
// seconds. They run at 124 BPM like the game's own music (a cut may set its own bpm) and every cut sits
// on the beat. CUTS holds the versions: 'hype' (fast motion design), 'mix' (calmer, the steps shown in
// real gameplay), 'gameplay' (mostly real gameplay with a follow camera) and 'combo' (hype, then real
// gameplay); the films in EXTRA add their own cuts and scenes ('satisfying', 'orders', 'journey', 'glowup').
//
//   const film = buildFilm(frameEl, { lang, shot, version, footage });   // builds every scene once
//   await film.seek(t)            // puts the whole frame at time t (seconds)
//   film.duration, film.cues (sound cues for score.js), film.loops, film.music (bar by bar)
//
// Scenes register their sounds as cues while they are built, so picture and sound stay in sync
// when a timing changes. footage = { clip, base } is the real gameplay recorded by capture.mjs.

import {
  logoSVG, bowlSVG, ingredientIcon, packIcon, customerSVG, lookFromSeed, coinSVG, heartSVG, starSVG,
  clockSVG, matchaGlassSVG, scoopSVG, blenderBadgeSVG, MATCHA_SLOT_Y, MATCHA_CUP_SIZE,
} from '../../js/art.js';
import { INGREDIENTS } from '../../js/data.js';
import { VIEWS, MACHINE_SLOT_X, pourFill, fitFrame } from '../../js/kitchen3d.js';
import { createRng } from '../../js/rng.js';
import { clamp, lerp, prog, ease, spring, jiggle, decay, bump, wob, arc } from './motion.js';
import { Sprite, Title, Burst, Ring, View3D, div, touchMarkup, setTouch, progressRingMarkup, setProgressRing } from './kit.js';
import { FootageView, followPath, camOn, fitCam, placeSounds } from './footage.js';
import * as satisfying from './film-satisfying.js';
import * as orders from './film-orders.js';
import * as journey from './film-journey.js';
import * as glowup from './film-glowup.js';

export const BPM = 124;
// the beat of the cut being built (cut.bpm, else BPM)
let BEAT = 60 / BPM;
const b = (n) => n * BEAT;

// films in their own modules: each exports CUTS and scenes(ctx) (scene builders like SCENES below)
const EXTRA = [satisfying, orders, journey, glowup];

const COPY = {
  de: {
    hook: ['4 GÄSTE', '1 MIXER', 'KEINE ZEIT!', 'SCHAFFST\nDU DAS?'],
    tagline: 'Das Açaí-Bowl-Spiel',
    tagSub: 'Mixen · Belegen · Servieren',
    mix: 'MIXEN',
    mixSub: 'Packung in den Mixer ziehen',
    top: 'BELEGEN',
    topSub: 'Früchte, Crunch & Toppings drauf',
    layerMid: '2 · Früchte & Crunch',
    layerTop: '3 · Toppings & Soßen',
    perfect: 'PERFEKT!',
    serve: 'SERVIEREN',
    serveSub: 'Bowl zum Gast ziehen – kassieren!',
    tip: '+ Trinkgeld',
    rush: 'BEVOR DIE\nGEDULD AUSGEHT!',
    ingredients: 'ZUTATEN',
    ingSub: 'Neue Zutaten im Shop freischalten',
    upgrades: 'UPGRADES',
    upgSub: 'Jedes Upgrade – ein neues 3D-Gerät',
    matcha: 'FRUCHT-MATCHA',
    matchaSub: 'Matcha-Maschine ab Level 7',
    levels: '20 LEVEL',
    endless: '+ ENDLOS-MODUS',
    cafe: 'DEIN CAFÉ\nWARTET!',
    dragDrop: 'Alles per Drag & Drop',
    play: 'JETZT SPIELEN',
    free: 'Kostenlos im Browser',
    devices: 'Tablet · Handy · PC · Mac',
    url: 'leesyashin.github.io/Acai',
    bio: 'Link in Bio',
    openA: 'DEIN EIGENES\nAÇAÍ-CAFÉ',
    openB: 'SCHAFFST DU\nDEN ANSTURM?',
    pov: 'POV: Dein eigenes\nAçaí-Café',
    capMix: 'Basis mixen',
    capCup: 'Becher hinstellen',
    capTop: 'Belegen',
    capServe: 'Servieren & kassieren',
    capMatcha: 'Matcha ab Level 7',
    capRush: 'Schnell sein – sie warten!',
    rushSub: 'Gäste werden ungeduldig',
    chipLevels: '20 Level',
    chipIngredients: '16 Zutaten',
    chipUpgrades: '3D-Upgrades',
    chipEndless: 'Endlos-Modus',
    realPlay: 'ECHTES GAMEPLAY',
  },
  en: {
    hook: ['4 GUESTS', '1 BLENDER', 'NO TIME!', 'CAN YOU\nHANDLE IT?'],
    tagline: 'The açaí bowl game',
    tagSub: 'Blend · Top · Serve',
    mix: 'BLEND',
    mixSub: 'Drag a pack into the blender',
    top: 'TOP IT',
    topSub: 'Fruits, crunch & toppings',
    layerMid: '2 · Fruits & Crunch',
    layerTop: '3 · Toppings & Sauces',
    perfect: 'PERFECT!',
    serve: 'SERVE',
    serveSub: 'Drag the bowl to the guest – get paid!',
    tip: '+ Tip',
    rush: 'BEFORE THEIR\nPATIENCE RUNS OUT!',
    ingredients: 'INGREDIENTS',
    ingSub: 'Unlock new ones in the shop',
    upgrades: 'UPGRADES',
    upgSub: 'Every upgrade – a new 3D machine',
    matcha: 'FRUIT MATCHA',
    matchaSub: 'Matcha machine from level 7',
    levels: '20 LEVELS',
    endless: '+ ENDLESS MODE',
    cafe: 'YOUR CAFÉ\nIS WAITING!',
    dragDrop: 'Everything by drag & drop',
    play: 'PLAY NOW',
    free: 'Free in your browser',
    devices: 'Tablet · Phone · PC · Mac',
    url: 'leesyashin.github.io/Acai',
    bio: 'Link in bio',
    openA: 'YOUR OWN\nAÇAÍ CAFÉ',
    openB: 'CAN YOU HANDLE\nTHE RUSH?',
    pov: 'POV: You run\nan açaí café',
    capMix: 'Blend the base',
    capCup: 'Put a cup down',
    capTop: 'Add the toppings',
    capServe: 'Serve & get paid',
    capMatcha: 'Matcha from level 7',
    capRush: 'Be quick – they are waiting!',
    rushSub: 'Guests get impatient',
    chipLevels: '20 levels',
    chipIngredients: '16 ingredients',
    chipUpgrades: '3D upgrades',
    chipEndless: 'Endless mode',
    realPlay: 'REAL GAMEPLAY',
  },
};

// ------------------------------------------------------------------ the cuts
// Where in the recorded gameplay (tools/promo/footage/main, seconds) the calm cuts look: picked
// from the moves capture.mjs logged (level 10, seed 4). Captions: [beat, until, text, number, colour].
const SEG = {
  // mix: the café at work · the açaí pack into the blender · pour and four toppings · serve twice · the rush
  open: 37.0,
  mix: 2.15,
  top: 16.0,
  serve: 20.1,
  rush: 24.0,
  // gameplay: the opening (pack into the blender) · 15 s straight from the pour on · the wide shot
  pov: 2.35,
  play: 6.9,
  playCaptions: [
    [0.5, 2.6, 'capMix', '1', 'pink'],
    [2.6, 4.6, 'capMatcha', '', 'leaf'],
    [4.6, 7.8, 'capTop', '2', 'lagoon'],
    [7.8, 10, 'capServe', '3', 'mango'],
    [10, 12.6, 'capMix', '1', 'pink'],
    [13.2, 17.4, 'capRush', '', ''],
    [19.4, 27.2, 'capTop', '2', 'lagoon'],
    [27.6, 31.6, 'capServe', '3', 'mango'],
  ],
  // the follow camera close up; while the blender works, a look at the waiting guests
  playKeys: [[0, 2.4, null, 400], [12.6, 2.4, null, 400], [14.2, 1.0, 640, 400], [17.2, 1.0, 640, 400], [18.8, 2.4, null, 400]],
  // the combo cut starts on the whole café (title), then moves in close like the gameplay cut
  comboKeys: [[0, 0.84, 640, 400], [1.4, 0.84, 640, 400], [2.8, 2.4, null, 400], [12.6, 2.4, null, 400], [14.2, 1.0, 640, 400],
    [17.2, 1.0, 640, 400], [18.8, 2.4, null, 400]],
  wide: 36.4,
};

// scenes: [name, beats, options] in order; music: one entry per bar (see score.js); energy scales
// shakes, flashes and punches (speed lines only at 1); bounce: beats in which the camera bounces.
export const CUTS = {
  hype: {
    energy: 1,
    bounce: [4, 44],
    scenes: [['hook', 4], ['logo', 4], ['mix', 4], ['top', 6], ['serve', 6], ['rush', 4], ['ingredients', 4], ['upgrades', 4],
      ['matcha', 4], ['game', 4], ['end', 8]],
    music: [
      { style: 'hook' }, { style: 'drop', g: 0 }, { style: 'groove', g: 1 }, { style: 'groove', g: 2 }, { style: 'groove', g: 3 },
      { style: 'groove', g: 4, fill: true }, { style: 'tension', chords: ['Am', 'E7'], mel: null }, { style: 'drop', g: 12, harmony: true },
      { style: 'groove', g: 13, harmony: true }, { style: 'groove', g: 10, harmony: true }, { style: 'groove', g: 11, harmony: true, fill: true },
      { style: 'groove', chords: ['Dm7', 'G7'], mel: 15, harmony: true, fill: true }, { style: 'end' },
    ],
  },
  // calmer: a cut every two bars, soft transitions, and the three steps in real gameplay
  mix: {
    energy: 0.35,
    footage: true,
    scenes: [
      ['cafeGame', 8, { seg: [SEG.open], titles: [[0, 'openA', 'white', 128, 4], [4, 'openB', 'mango', 128]], keys: [[0, 0.78125, 640, 400], [8, 0.95, 640, 430]], enter: null }],
      ['logo', 4, { enter: ['softIn', 0.3], leave: ['softOut', 0.25] }],
      ['stepGame', 8, { num: '1', word: 'mix', sub: 'mixSub', color: 'pink', seg: [SEG.mix], rate: 1.25, keys: [[0, 1.45, 300, 450]] }],
      ['stepGame', 8, { num: '2', word: 'top', sub: 'topSub', color: 'lagoon', seg: [SEG.top], rate: 1.08, zoom: 1.45 }],
      ['stepGame', 8, { num: '3', word: 'serve', sub: 'serveSub', color: 'mango', size: 140, seg: [SEG.serve], zoom: 1.3 }],
      ['cafeGame', 8, { seg: [SEG.rush], titles: [[0, 'rush', 'white', 112]], sub: 'rushSub', subAt: 1, h: 760, keys: [[0, 0.78125, 640, 400], [3.5, 0.78125, 640, 400], [5.5, 1.15, 640, 270]] }],
      ['ingredients', 4, { enter: ['softIn', 0.3], leave: ['softOut', 0.25] }],
      ['upgrades', 4, { enter: ['softIn', 0.3], leave: ['softOut', 0.25] }],
      ['end', 8, { enter: ['softIn', 0.35] }],
    ],
    music: [
      { style: 'intro', g: 12 }, { style: 'intro', g: 13 }, { style: 'drop', g: 0 }, { style: 'groove', g: 1 }, { style: 'groove', g: 2 },
      { style: 'groove', g: 3 }, { style: 'groove', g: 4 }, { style: 'groove', g: 5 }, { style: 'groove', g: 6, fill: true },
      { style: 'groove', g: 8, harmony: true }, { style: 'groove', g: 9, harmony: true }, { style: 'groove', g: 10, harmony: true },
      { style: 'groove', g: 11, harmony: true, fill: true }, { style: 'groove', chords: ['Dm7', 'G7'], mel: 15, harmony: true, fill: true },
      { style: 'end' },
    ],
  },
  // mostly real gameplay: full screen, the camera follows the finger, short captions
  gameplay: {
    energy: 0.35,
    footage: true,
    scenes: [
      ['follow', 8, { seg: [SEG.pov], title: [0, 'pov', 100, 3.6], logo: [4, 8], keys: [[0, 2.4, null, 400], [3.3, 2.4, null, 400], [4.6, 0.84, 640, 400], [8, 0.84, 640, 400]], enter: null }],
      ['follow', 32, { seg: [SEG.play], captions: SEG.playCaptions, keys: SEG.playKeys }],
      ['follow', 8, { seg: [SEG.wide], keys: [[0, 1.6, null, 400], [1.5, 0.84, 640, 400]], chips: [[1, 'chipLevels', 'mango', 320, 400, -4], [1.5, 'chipIngredients', 'pink', 750, 530, 4], [2, 'chipUpgrades', 'lagoon', 330, 1395, 3], [2.5, 'chipEndless', 'leaf', 750, 1525, -3]] }],
      ['end', 8, { enter: ['softIn', 0.35] }],
    ],
    music: [
      { style: 'intro', g: 15 }, { style: 'drop', g: 0 }, { style: 'groove', g: 1 }, { style: 'groove', g: 2 }, { style: 'groove', g: 3 },
      { style: 'groove', g: 4 }, { style: 'groove', g: 5 }, { style: 'groove', g: 6 }, { style: 'groove', g: 7, fill: true },
      { style: 'groove', g: 8, harmony: true }, { style: 'groove', g: 10, harmony: true }, { style: 'groove', g: 11, harmony: true, fill: true },
      { style: 'groove', chords: ['Dm7', 'G7'], mel: 15, harmony: true, fill: true }, { style: 'end' },
    ],
  },
  // hype first, then 15 s of real gameplay (instead of the tablet screenshot), then the end card
  combo: {
    energy: 1,
    bounce: [4, 40],
    footage: true,
    scenes: [['hook', 4], ['logo', 4], ['mix', 4], ['top', 6], ['serve', 6], ['rush', 4], ['ingredients', 4], ['upgrades', 4],
      ['matcha', 4],
      ['follow', 32, { seg: [SEG.play], title: [0, 'realPlay', 104, 2.6], captions: SEG.playCaptions.slice(1), keys: SEG.comboKeys, enter: ['whipIn', 0.14], leave: ['zoomOut', 0.12] }],
      ['end', 8]],
    music: [
      { style: 'hook' }, { style: 'drop', g: 0 }, { style: 'groove', g: 1 }, { style: 'groove', g: 2 }, { style: 'groove', g: 3 },
      { style: 'groove', g: 4, fill: true }, { style: 'tension', chords: ['Am', 'E7'], mel: null }, { style: 'drop', g: 12, harmony: true },
      { style: 'groove', g: 13, harmony: true }, { style: 'groove', g: 10, harmony: true, fill: true },
      { style: 'drop', g: 0 }, { style: 'groove', g: 1 }, { style: 'groove', g: 2 }, { style: 'groove', g: 3 }, { style: 'groove', g: 4 },
      { style: 'groove', g: 5 }, { style: 'groove', g: 6 }, { style: 'groove', g: 7, fill: true },
      { style: 'groove', chords: ['Dm7', 'G7'], mel: 15, harmony: true, fill: true }, { style: 'end' },
    ],
  },
};
for (const m of EXTRA) Object.assign(CUTS, m.CUTS);

const ALL_IDS = INGREDIENTS.map((i) => i.id);
const PLAY_ICON = '<svg width="78" height="84" viewBox="0 0 78 84"><path d="M10 8L70 42L10 76Z" fill="#fff" stroke="#2a1236" stroke-width="8" stroke-linejoin="round"/></svg>';

// ------------------------------------------------------------------ frame-wide effects
// Camera shake, zoom punches, white flashes and speed lines, registered by the scenes.
// energy < 1 (the calm cuts) tones every hit down and leaves out the speed lines.
class Fx {
  constructor(energy = 1) {
    this.energy = energy;
    this.shakes = [];
    this.punches = [];
    this.flashes = [];
    this.lines = [];
    this.spins = [];
  }

  shake(t, amp, k = 7) {
    this.shakes.push({ t, amp: amp * this.energy ** 2, k });
  }

  punch(t, a, k = 9) {
    this.punches.push({ t, a: a * this.energy, k });
  }

  flash(t, s = 0.8, k = 11) {
    this.flashes.push({ t, s: s * this.energy, k });
  }

  speed(t, s = 1, k = 3.2) {
    if (this.energy >= 1) this.lines.push({ t, s, k });
  }

  // extra turn of the background rays: amp degrees, spent with rate k
  spin(t, amp, k = 2.5) {
    this.spins.push({ t, amp: amp * this.energy, k });
  }

  cam(t) {
    let amp = 0;
    for (const s of this.shakes) amp += s.amp * decay(t - s.t, s.k);
    let z = 0;
    for (const p of this.punches) z += p.a * decay(t - p.t, p.k);
    return { x: wob(t * 1.3, 1) * amp, y: wob(t * 1.3, 7) * amp, r: wob(t * 0.9, 3) * amp * 0.03, s: 1 + z };
  }

  flashAt(t) {
    let o = 0;
    for (const f of this.flashes) o += f.s * decay(t - f.t, f.k);
    return clamp(o);
  }

  linesAt(t) {
    let o = 0;
    for (const l of this.lines) o += l.s * decay(t - l.t, l.k);
    return clamp(o);
  }

  raysAt(t) {
    let a = t * 7;
    for (const s of this.spins) if (t > s.t) a += s.amp * (1 - Math.exp(-s.k * (t - s.t)));
    return a;
  }
}

// Scene transitions: k runs 0 → 1 over the transition; the scene root gets { x, y, s, r, o }.
const TRANS = {
  whipIn: (k) => ({ x: 1500 * (1 - ease.outQuart(k)) }),
  whipOut: (k) => ({ x: -1500 * ease.inQuart(k) }),
  zoomIn: (k) => ({ s: lerp(0.45, 1, ease.outBack(k)), o: clamp(k * 3) }),
  zoomOut: (k) => ({ s: lerp(1, 3.4, ease.inQuart(k)), o: 1 - ease.inQuad(k) }),
  upIn: (k) => ({ y: 1950 * (1 - ease.outQuart(k)) }),
  upOut: (k) => ({ y: -1950 * ease.inQuart(k) }),
  spinIn: (k) => ({ s: lerp(0.2, 1, ease.outBack(k)), r: lerp(-30, 0, ease.outCubic(k)), o: clamp(k * 4) }),
  spinOut: (k) => ({ s: lerp(1, 0.2, ease.inBack(k)), r: lerp(0, 30, ease.inCubic(k)), o: 1 - ease.inQuad(k) }),
  // the calm cuts: a short dip through the background
  softIn: (k) => ({ s: lerp(0.94, 1, ease.outCubic(k)), y: lerp(50, 0, ease.outCubic(k)), o: ease.outQuad(k) }),
  softOut: (k) => ({ s: lerp(1, 1.04, ease.inCubic(k)), y: lerp(0, -40, ease.inCubic(k)), o: 1 - ease.inQuad(k) }),
  slideIn: (k) => ({ x: lerp(420, 0, ease.outCubic(k)), o: ease.outQuad(k) }),
  slideOut: (k) => ({ x: lerp(0, -420, ease.inCubic(k)), o: 1 - ease.inQuad(k) }),
};

// ------------------------------------------------------------------ helpers
const subPill = (root, text) => new Sprite(root, `<div class="sub">${text}</div>`);
const chip = (root, text, color) => new Sprite(root, `<div class="chip ${color}">${text}</div>`);

// popping in at lt = 0 (scale spring, a little rise)
const popIn = (lt, { rise = 40, f = 2.6, d = 8 } = {}) => {
  const s = spring(lt, f, d);
  return { s, dy: (1 - Math.min(1, s)) * rise, o: lt > 0 ? 1 : 0 };
};

// the patience bar of a guest (k 0…1) with the game's colours
function patienceBar(root, w) {
  const sp = new Sprite(root, `<div class="pbar" style="width:${w}px"><div class="pbar-fill"></div></div>`);
  const fill = sp.in.querySelector('.pbar-fill');
  let last = '';
  return {
    sp,
    value(k) {
      const c = k > 0.6 ? '#2fbf71' : k > 0.3 ? '#ffb627' : '#ff4d4d';
      const key = `${Math.round(k * 400)}|${c}`;
      if (key !== last) {
        last = key;
        fill.style.width = `${(clamp(k) * 100).toFixed(2)}%`;
        fill.style.background = c;
      }
    },
  };
}

const moodOf = (k) => (k > 0.6 ? 'happy' : k > 0.3 ? 'neutral' : k > 0.12 ? 'impatient' : 'angry');

// a guest whose picture follows the mood (cached per mood)
function guest(root, seed, size) {
  const look = lookFromSeed(seed);
  const cache = new Map();
  const sp = new Sprite(root);
  return {
    sp,
    mood(m) {
      if (!cache.has(m)) cache.set(m, customerSVG(look, m, size));
      sp.html(cache.get(m));
      return this;
    },
  };
}

// Header of a tutorial step: number badge + word, centred on y.
function stepHeader(root, num, word, { color = 'pink', fill = 'white', size = 150, y = 300 } = {}) {
  const badge = new Sprite(root, `<div class="badge ${color}">${num}</div>`);
  const title = new Title(root, word, { size, fill });
  const gap = 30;
  const total = 150 + gap + title.width;
  const bx = 540 - total / 2 + 75;
  const tx = 540 - total / 2 + 150 + gap + title.width / 2;
  // fade 0…1: leaves upwards (the serve scene puts the coin counter in its place)
  return (lt, fade = 0) => {
    const p = popIn(lt, { f: 2.2, d: 6.5 });
    badge.set({ x: bx, y: y + p.dy - fade * 80, s: p.s * (1 - fade), r: -220 * (1 - ease.outCubic(clamp(lt / 0.4))), o: p.o * (1 - fade) });
    title.sprite.set({ x: tx, y: y + 8 - fade * 80, s: 1 - fade, o: 1 - fade });
    title.pop(lt - 0.06, { stagger: 0.025, freq: 3, damp: 10 });
  };
}

// ------------------------------------------------------------------ the film
export function buildFilm(frame, { lang = 'de', shot = null, version = 'hype', footage = null } = {}) {
  const C = COPY[lang] || COPY.de;
  const cut = CUTS[version] || CUTS.hype;
  if (cut.footage && !footage) throw new Error(`the '${version}' cut needs gameplay footage (tools/promo/capture.mjs)`);
  BEAT = 60 / (cut.bpm || BPM);
  const fx = new Fx(cut.energy ?? 1);
  const path = footage ? followPath(footage.clip) : null;
  const cues = [];
  const loops = [];
  // sound cue: kind 'sfx' (the game's effects) or 'fx' (promo effects in score.js)
  const cue = (t, name, o = {}) => cues.push({ t, name, ...o });

  // ---------------------------------------------------------------- layers
  frame.innerHTML = '';
  // a theme restyles the background (promo.css: .theme-cream, .theme-phone …)
  frame.className = cut.theme ? `theme-${cut.theme}` : '';
  const bg = div(frame, 'layer bg-base');
  const rays = div(bg, 'bg-rays');
  const tints = {};
  for (const name of ['red', 'night', 'pink', 'lagoon', 'mango', 'gold', 'grey']) tints[name] = div(bg, `layer bg-tint ${name}`);
  const floatLayer = div(bg, 'layer floaters');
  const cam = div(frame, 'layer');
  cam.id = 'cam';
  const vignette = div(frame, 'layer fx-vignette');
  const alarm = div(frame, 'layer fx-alarm');
  const linesEl = div(frame, 'layer fx-lines', speedLinesSVG());
  const flashEl = div(frame, 'layer fx-flash');

  // floating ingredients behind everything
  const floaters = [];
  {
    const rng = createRng(77);
    const ids = ['strawberry', 'banana', 'blueberry', 'kiwi', 'mango', 'coconut', 'mint', 'granola', 'strawberry', 'blueberry', 'banana', 'kiwi'];
    ids.forEach((id, i) => {
      const size = Math.round(rng.range(90, 150));
      floaters.push({
        sp: new Sprite(floatLayer, ingredientIcon(id, size), 'floater'),
        x: 60 + ((i * 397) % 960),
        y0: rng.range(0, 2200),
        v: rng.range(40, 90),
        r0: rng.range(0, 360),
        vr: rng.range(-30, 30),
        ph: rng.range(0, 6),
      });
    });
  }

  const scenes = [];
  const scene = (def) => {
    // built visible, so titles can measure themselves; hidden until seek() shows them
    const root = div(cam, 'scene');
    const s = { root, enter: null, leave: null, tint: null, ...def(root) };
    root.style.display = 'none';
    scenes.push(s);
    return s;
  };
  const SCENES = {};

  // ================================================================ hook – 4 guests, 1 blender, no time (hype cut, at the very start)
  SCENES.hook = (root, from, to, o = {}) => {
    const fill = ['white', 'mango', 'red', 'pink'];
    const titles = C.hook.map((txt, i) => new Title(root, txt, { size: i === 3 ? 150 : 172, fill: fill[i] }));
    const seeds = [5, 12, 3, 27];
    const xs = [190, 423, 657, 890];
    const guests = seeds.map((s) => guest(root, s, 250));
    const bars = xs.map(() => patienceBar(root, 170));
    const blender = new View3D(root, 'blender', 600);
    const badge = new Sprite(root, blenderBadgeSVG('overflowing', 120));
    const clock = new Sprite(root, clockSVG(210));
    // big ingredients whipping past behind the words, one per beat
    const flyIds = ['strawberry', 'banana', 'kiwi', 'blueberry'];
    const flyers = flyIds.map((id) => new Sprite(root, ingredientIcon(id, 330)));
    const flyPath = [[[-250, 1500], [1330, 250]], [[1330, 1600], [-250, 300]], [[-250, 400], [1330, 1500]], [[1330, 500], [-250, 1650]]];

    for (let i = 0; i < 4; i++) {
      fx.punch(b(i), 0.05, 10);
      if (i) fx.flash(b(i), 0.22, 16);
      cue(b(i) - 0.02, 'whoosh', { gain: 0.5 });
    }
    cue(0, 'bell', { kind: 'sfx' });
    seeds.forEach((_, i) => cue(i * 0.04, 'pop', { gain: 0.45, pitch: i }));
    cue(b(1) + 0.14, 'thud');
    cue(b(1) + 0.16, 'blenderStart', { kind: 'sfx' });
    loops.push({ id: 'blender', from: b(1) + 0.2, to: b(4) - 0.05, gain: 0.9 });
    cue(b(2), 'tick', { kind: 'sfx' });
    cue(b(2.5), 'tick', { kind: 'sfx', alt: true });
    cue(b(3), 'overflow', { kind: 'sfx' });
    cue(b(3) + 0.05, 'angry', { kind: 'sfx' });
    cue(b(3.5), 'tick', { kind: 'sfx', alt: true });
    cue(b(3.75), 'tick', { kind: 'sfx' });
    fx.shake(b(3), 26, 3);
    fx.shake(b(1) + 0.14, 30, 9);
    cue(b(2), 'riser', { len: b(2), gain: 0.55 });

    return {
      from, to, leave: ['zoomOut', 0.13],
      update(lt) {
        // words, one per beat
        titles.forEach((tt, i) => {
          const t0 = b(i) - 0.1;
          const t1 = i < 3 ? b(i + 1) - 0.12 : 99;
          if (lt < t0 || lt > t1 + 0.2) return tt.sprite.hide();
          const k = lt - t0;
          const slam = k < 0.1 ? lerp(2.2, 0.94, ease.inQuad(k / 0.1)) : 0.94 + 0.06 * spring(k - 0.1, 3.5, 9);
          tt.sprite.set({ x: 540, y: i === 3 ? 330 : 340, s: slam, r: i % 2 ? 3 : -3, o: clamp(k / 0.04) });
          tt.pop(k + 0.2, { stagger: 0.012, out: i < 3 ? t1 - t0 + 0.2 : null, outDur: 0.12, outStagger: 0.008, freq: 3.5, damp: 12 });
        });
        // guests pop in, get impatient at beat 2, angry at beat 3
        guests.forEach((gst, i) => {
          const p = popIn(lt + 0.12 - i * 0.05, { rise: 120, f: 2.4, d: 7 });
          const k = 1 - prog(lt, b(2) + i * 0.05, b(3.2) + i * 0.04) * (0.92 - i * 0.05);
          const angry = lt > b(3);
          const sh = angry ? wob(lt * 3, i) * 9 : 0;
          gst.mood(lt < b(2) ? 'happy' : moodOf(k)).sp.set({ x: xs[i] + sh, y: 720 + p.dy + Math.sin(lt * 7 + i) * 5, s: p.s, o: p.o });
          bars[i].value(k);
          bars[i].sp.set({ x: xs[i], y: 885 + p.dy, s: p.s, o: p.o });
        });
        // the blender falls in on beat 1 and starts blending; overflows on beat 3
        const land = b(1) + 0.14;
        if (lt < b(1) - 0.02) blender.sprite.hide();
        else {
          const fall = prog(lt, b(1) - 0.02, land);
          const y = lt < land ? lerp(-420, 1270, ease.inQuad(fall)) : 1270;
          const sq = jiggle(lt - land, 4.5, 8) * 0.18;
          const vib = lt > land ? wob(lt * 2.4, 2) * 4 : 0;
          blender.sprite.set({ x: 540 + vib, y: y + sq * 120, sx: 1 + sq, sy: 1 - sq });
          const over = lt > b(3);
          blender.draw(over
            ? { tier: 2, state: 'overflowing', base: 'acai', portions: 2, maxPortions: 2 }
            : lt > land ? { tier: 2, state: 'blending', base: 'acai', progress: prog(lt, land, b(3)), remaining: 3 } : { tier: 2, state: 'empty' }, lt);
        }
        const bp = popIn(lt - b(3), { f: 3, d: 8 });
        badge.set({ x: 780, y: 1050 + bp.dy, s: bp.s * (1 + 0.12 * Math.max(0, Math.sin(lt * 26))), o: bp.o });
        // the clock slams in on beat 2 and rattles
        const cp = lt - b(2);
        clock.set({ x: 860, y: 1180, s: cp < 0 ? 0 : lerp(2.6, 1, ease.outBack(clamp(cp / 0.16))), r: cp > 0 ? Math.sin(lt * 40) * 10 * (0.4 + decay(cp, 3)) : 0, o: cp > 0 ? 1 : 0 });
        // ingredients whipping past
        flyers.forEach((sp, i) => {
          const k = (lt - b(i) + 0.05) / 0.42;
          if (k < 0 || k > 1) return sp.hide();
          const [[x0, y0], [x1, y1]] = flyPath[i];
          return sp.set({ x: lerp(x0, x1, k), y: lerp(y0, y1, k), r: k * 360 * (i % 2 ? -1 : 1), s: 1.2, o: 0.95 });
        });
      },
      alarm: (lt) => (lt > b(3) ? 0.55 + 0.25 * Math.sin(lt * 18) : 0),
    };
  };

  // ================================================================ logo
  SCENES.logo = (root, from, to, o = {}) => {
    const rings = [new Ring(root, { x: 540, y: 720, t0: 0, size: 1500, color: '#ffffff', width: 30 }), new Ring(root, { x: 540, y: 720, t0: 0.07, size: 1100, color: '#ffd23f', width: 22, dur: 0.5 })];
    const sparkles = [];
    const burst = new Burst(root, {
      n: 18, seed: 4, x: 540, y: 720, t0: 0, speed: [1300, 2600], gravity: 1500, drag: 1.9, life: [1.3, 2.0], scale: [0.7, 1.15], spin: [-400, 400],
      html: (i) => ingredientIcon(ALL_IDS[i % ALL_IDS.length], 170),
    });
    const confetti = confettiBurst(root, { n: 46, seed: 9, x: 540, y: 700, t0: 0.02 });
    const cupL = new Sprite(root, bowlSVG({ base: 'pitaya', mid: ['mango', 'kiwi', 'banana'], top: ['coconut', 'chia'] }, 400));
    const cupR = new Sprite(root, bowlSVG({ base: 'spirulina', mid: ['blueberry', 'banana', 'strawberry'], top: ['honey', 'mint'] }, 400));
    const logo = new Sprite(root, logoSVG(1000));
    const tag = new Title(root, C.tagline, { size: 96, fill: 'mango' });
    const tagSub = subPill(root, C.tagSub);
    for (const [x, y, s] of [[150, 380, 1], [940, 330, 0.8], [960, 980, 1.1], [120, 960, 0.7], [520, 250, 0.6]]) {
      sparkles.push({ sp: new Sprite(root, sparkleSVG(90)), x, y, s, ph: x * 0.01 });
    }
    fx.flash(from, 1, 7);
    fx.shake(from, 42, 5);
    fx.punch(from, 0.08, 6);
    fx.speed(from, 1, 2.6);
    fx.spin(from, 140, 2.2);
    cue(from, 'impact', { gain: 1 });
    cue(from + b(1.5), 'swish', { gain: 0.4 });
    cue(from + b(1.5) + 0.05, 'pop', { gain: 0.35, pitch: 2 });
    cue(from + b(2.5), 'pop', { gain: 0.35, pitch: 4 });
    cue(from + b(3.6), 'whoosh', { gain: 0.7 });

    return {
      from, to, enter: ['zoomIn', 0.16], leave: ['whipOut', 0.12],
      update(lt) {
        rings.forEach((r) => r.update(lt));
        burst.update(lt);
        confetti.update(lt);
        // logo: slams from huge, then floats on the beat
        const land = 0.11;
        const s = lt < land ? lerp(3.2, 0.92, ease.inQuad(lt / land)) : 0.92 + 0.08 * spring(lt - land, 2.2, 5.5);
        const pulse = 0.025 * decay(lt % BEAT, 9);
        logo.set({ x: 540, y: 700 + Math.sin(lt * 3) * 9, s: s + pulse, r: lt < land ? -14 : -14 * (1 - spring(lt - land, 1.6, 4)) + Math.sin(lt * 2.2) * 1.4 });
        tag.sprite.set({ x: 540, y: 1075 });
        tag.pop(lt - b(1.5), { stagger: 0.025 });
        const sp = popIn(lt - b(2.5));
        tagSub.set({ x: 540, y: 1215 + sp.dy, s: sp.s, o: sp.o });
        for (const [cupSp, x, r, d] of [[cupL, 190, -12, 1.5], [cupR, 890, 12, 1.62]]) {
          const p = popIn(lt - b(d), { rise: 400, f: 2, d: 6 });
          cupSp.set({ x, y: 1530 + p.dy + Math.sin(lt * 2.4 + x) * 10, s: p.s, r: r + Math.sin(lt * 2 + x) * 3, o: p.o });
        }
        sparkles.forEach((k, i) => {
          const tw = 0.6 + 0.4 * Math.sin(lt * 7 + k.ph * 3);
          const p = popIn(lt - 0.15 - i * 0.07);
          k.sp.set({ x: k.x, y: k.y, s: k.s * p.s * tw, r: lt * 90, o: p.o });
        });
      },
    };
  };

  // ================================================================ mix – step 1, blending (animated)
  SCENES.mix = (root, from, to, o = {}) => {
    const head = stepHeader(root, '1', C.mix, { color: 'pink' });
    const sub = subPill(root, C.mixSub);
    const blender = new View3D(root, 'blender', 760);
    const pack = new Sprite(root, packIcon('acai', 380));
    const touch = new Sprite(root, touchMarkup());
    const ring = new Sprite(root, progressRingMarkup(200, '#18c2c9'));
    const check = new Sprite(root, blenderBadgeSVG('ready', 170));
    const splash = new Burst(root, {
      n: 14, seed: 21, x: 540, y: 820, t0: b(1.5), speed: [500, 1000], angle: [-160, -20], gravity: 2600, drag: 1.5, life: [0.4, 0.7], scale: [0.6, 1.2],
      html: () => '<svg width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" fill="#6a2386" stroke="#2a1236" stroke-width="4"/><circle cx="16" cy="15" r="5" fill="#fff" opacity=".5"/></svg>',
    });
    const stars = new Burst(root, {
      n: 12, seed: 5, x: 540, y: 900, t0: b(3), speed: [700, 1200], gravity: 600, drag: 3, life: [0.6, 0.9], scale: [0.5, 1], spin: [-200, 200],
      html: () => sparkleSVG(80),
    });
    const Td = b(1.5);
    const Tr = b(3);
    const start = [250, 1420];
    const end = [540, 760];
    const ctrl = [180, 640];
    cue(from + b(0.25), 'pop', { gain: 0.4, pitch: 1 });
    cue(from + b(0.75), 'pickup', { kind: 'sfx' });
    cue(from + Td, 'drop', { kind: 'sfx' });
    cue(from + Td + 0.03, 'blenderStart', { kind: 'sfx' });
    loops.push({ id: 'blender', from: from + Td + 0.1, to: from + Tr, gain: 1 });
    cue(from + Tr, 'blenderReady', { kind: 'sfx' });
    fx.flash(from + Td, 0.3, 14);
    fx.punch(from + Td, 0.04, 10);
    fx.flash(from + Tr, 0.35, 12);
    fx.punch(from + Tr, 0.05, 9);
    cue(from + b(3.75), 'whoosh', { gain: 0.6 });

    return {
      from, to, enter: ['whipIn', 0.14], leave: ['whipOut', 0.12], tint: null,
      update(lt) {
        head(lt);
        const sp = popIn(lt - 0.22);
        sub.set({ x: 540, y: 440 + sp.dy, s: sp.s, o: sp.o });
        // pack: pops in, gets picked up, dragged on an arc and dropped into the jug
        const pp = popIn(lt - b(0.25), { rise: 80 });
        const k = ease.inOutCubic(prog(lt, b(0.75), Td));
        const [px, py] = arc(k, start, ctrl, end);
        if (lt < Td) {
          pack.set({ x: px, y: py + pp.dy, s: pp.s * lerp(1, 0.55, k), r: lerp(-8, 25, k) + Math.sin(lt * 9) * 4 * k, o: pp.o });
        } else {
          const q = prog(lt, Td, Td + 0.1);
          pack.set({ x: end[0], y: end[1] + q * 80, s: 0.55 * (1 - q), r: 25, o: 1 - q });
        }
        const tIn = b(0.6);
        const press = clamp((lt - b(0.75)) / 0.08) * (1 - clamp((lt - Td) / 0.08));
        setTouch(touch, {
          x: (lt < Td ? px : end[0]) + 40, y: (lt < Td ? py : end[1]) + 70, o: lt < tIn ? 0 : lt < Td + 0.25 ? 1 : 1 - prog(lt, Td + 0.25, Td + 0.4),
          press, ripple: (lt - Td) / 0.35,
        });
        splash.update(lt);
        // blender: empty → blending → ready
        const bl = lt < Td ? { state: 'empty' } : lt < Tr ? { state: 'blending', base: 'acai', progress: prog(lt, Td, Tr), remaining: 2 } : { state: 'ready', base: 'acai', portions: 2, maxPortions: 2 };
        blender.draw({ tier: 0, ...bl }, lt);
        const hop = jiggle(lt - Td, 5, 8) * 0.07 + jiggle(lt - Tr, 4, 7) * 0.06;
        const vib = lt > Td && lt < Tr ? wob(lt * 3, 4) * 5 : 0;
        blender.sprite.set({ x: 540 + vib, y: 1090 - hop * 200, sx: 1 + hop, sy: 1 - hop });
        // progress ring while it blends, then the green check
        const rp = popIn(lt - Td, { f: 3, d: 9 });
        if (lt < Tr) {
          setProgressRing(ring, prog(lt, Td, Tr));
          ring.set({ x: 845, y: 760 + rp.dy, s: rp.s, o: rp.o, r: 0 });
          check.hide();
        } else {
          ring.hide();
          const cp = popIn(lt - Tr, { f: 2.6, d: 7 });
          check.set({ x: 845, y: 760, s: cp.s, r: (1 - Math.min(1, cp.s)) * -90 });
        }
        stars.update(lt);
      },
    };
  };

  // ================================================================ top – step 2, toppings (animated)
  SCENES.top = (root, from, to, o = {}) => {
    const head = stepHeader(root, '2', C.top, { color: 'lagoon' });
    const sub = subPill(root, C.topSub);
    const SIZE = 640;
    const CX = 540;
    const CY = 1120;
    const RIM_Y = CY - SIZE * 0.25;
    const order = { base: 'acai', mid: ['strawberry', 'banana', 'blueberry'], top: ['honey', 'coconut', 'mint'] };
    const steps = [...order.mid.map((id) => ['mid', id]), ...order.top.map((id) => ['top', id])];
    const drops = steps.map((_, i) => b(2 + i * 0.5));
    const cupEmpty = new Sprite(root, bowlSVG({}, SIZE));
    const cupFull = new Sprite(root, bowlSVG({ base: 'acai' }, SIZE));
    const cupNow = new Sprite(root, '');
    const blender = new View3D(root, 'blender', 420);
    const stream = new Sprite(root, '<div style="width:46px;height:280px;border-radius:23px;background:linear-gradient(90deg,#4a1a5e,#7b3a96 45%,#5a1f73);border:5px solid #2a1236"></div>');
    const icons = steps.map(([, id]) => new Sprite(root, ingredientIcon(id, 230)));
    const bursts = steps.map(([, id], i) => new Burst(root, {
      n: 9, seed: 40 + i, x: CX, y: RIM_Y, t0: drops[i], speed: [400, 900], angle: [-165, -15], gravity: 2400, drag: 1.2, life: [0.35, 0.6], scale: [0.35, 0.6],
      html: () => ingredientIcon(id, 90),
    }));
    const chipMid = chip(root, C.layerMid, 'leaf');
    const chipTop = chip(root, C.layerTop, 'pink');
    const stamp = new Sprite(root, `<div class="stamp">${C.perfect}</div>`);
    const stars = new Burst(root, {
      n: 16, seed: 8, x: CX, y: CY - 120, t0: b(5), speed: [900, 1700], gravity: 900, drag: 2.6, life: [0.7, 1.0], scale: [0.5, 1.1], spin: [-300, 300],
      html: (i) => (i % 3 ? sparkleSVG(80) : starSVG(true, 70)),
    });
    const bowls = [];
    let acc = { base: 'acai', mid: [], top: [] };
    for (const [layer, id] of steps) {
      acc = { ...acc, [layer]: [...acc[layer], id] };
      bowls.push(bowlSVG(acc, SIZE));
    }
    const P0 = b(0.5);
    const P1 = b(1.6);
    cue(from + b(0.4), 'pour', { kind: 'sfx' });
    cue(from + b(0.9), 'pour', { kind: 'sfx', gain: 0.7 });
    drops.forEach((d, i) => {
      cue(from + d - 0.2, 'swish', { gain: 0.25 });
      cue(from + d, 'plop', { kind: 'sfx' });
      fx.punch(from + d, 0.025, 12);
    });
    cue(from + b(5), 'stamp');
    cue(from + b(5) + 0.05, 'star', { kind: 'sfx', step: 4 });
    fx.flash(from + b(5), 0.4, 10);
    fx.shake(from + b(5), 20, 8);
    cue(from + b(5.75), 'whoosh', { gain: 0.6 });

    return {
      from, to, enter: ['whipIn', 0.14], leave: ['whipOut', 0.12],
      update(lt) {
        head(lt);
        const sp = popIn(lt - 0.22);
        sub.set({ x: 540, y: 440 + sp.dy, s: sp.s, o: sp.o });
        // which bowl: empty → base poured (revealed from the bottom) → toppings one by one
        let n = -1;
        drops.forEach((d, i) => { if (lt >= d) n = i; });
        const lastDrop = n >= 0 ? drops[n] : P1;
        const sq = jiggle(lt - lastDrop, 5, 9) * 0.07 + jiggle(lt - b(5), 3.5, 6) * 0.08;
        const cupT = { x: CX, y: CY + sq * 120, sx: 1 + sq, sy: 1 - sq };
        if (n < 0) {
          cupEmpty.set(cupT);
          const fill = ease.inOutQuad(prog(lt, P0 + 0.1, P1));
          if (fill > 0) {
            cupFull.set(cupT);
            cupFull.in.style.clipPath = `inset(${((1 - fill * 0.78) * 100).toFixed(2)}% -50% -50% -50%)`;
          } else cupFull.hide();
          cupNow.hide();
        } else {
          cupEmpty.hide();
          cupFull.hide();
          cupNow.html(bowls[n]).set({ ...cupT, r: lt > b(5) ? jiggle(lt - b(5), 2.5, 4) * 6 : 0 });
        }
        // the blender tips in from the top left and pours
        const bin = ease.outBack(prog(lt, b(0.15), P0));
        const bout = ease.inBack(prog(lt, P1, P1 + 0.22));
        if (lt < b(0.15) || bout >= 1) blender.sprite.hide();
        else {
          blender.draw({ tier: 0, state: 'ready', base: 'acai', portions: 1, maxPortions: 2 }, lt);
          blender.sprite.set({ x: lerp(-200, 350, bin) - bout * 550, y: lerp(400, 700, bin) - bout * 300, r: lerp(-20, 100, ease.outCubic(prog(lt, P0 - 0.1, P0 + 0.12))) });
        }
        const sk = prog(lt, P0, P0 + 0.12) * (1 - prog(lt, P1 - 0.08, P1 + 0.02));
        if (sk > 0) {
          // a stream from the jug's rim (720) into the cup, growing downwards
          stream.set({ x: 510 + Math.sin(lt * 30) * 3, y: 860, sy: sk, o: 1 });
          stream.el.style.transformOrigin = '0 -140px';
        } else stream.hide();
        // ingredients fall in on the eighths
        icons.forEach((ic, i) => {
          const d = drops[i];
          const k = (lt - (d - 0.24)) / 0.24;
          if (k < 0 || lt > d + 0.05) return ic.hide();
          const fall = ease.inQuad(clamp(k));
          return ic.set({ x: CX + (i % 2 ? 40 : -40) * (1 - fall), y: lerp(560, RIM_Y - 10, fall), s: lt > d ? 0.7 : lerp(0.6, 1, ease.outBack(clamp(k * 2))), r: (1 - fall) * (i % 2 ? 40 : -40), o: lt > d ? 1 - (lt - d) / 0.05 : 1 });
        });
        bursts.forEach((bu) => bu.update(lt));
        // layer chips: fruits & crunch, then toppings & sauces
        const cm = popIn(lt - (drops[0] - 0.25));
        const swap = drops[3] - 0.25;
        chipMid.set({ x: 540, y: 1520 + cm.dy - (lt > swap ? ease.inBack(prog(lt, swap, swap + 0.15)) * -200 : 0), s: cm.s, o: lt > swap + 0.15 ? 0 : cm.o });
        const ct = popIn(lt - (swap + 0.1));
        chipTop.set({ x: 540, y: 1520 + ct.dy, s: ct.s, o: ct.o });
        // perfect!
        const st = lt - b(5);
        stamp.set({ x: 540, y: 600, s: st < 0 ? 0 : st < 0.09 ? lerp(3, 0.9, ease.inQuad(st / 0.09)) : 0.9 + 0.1 * spring(st - 0.09, 2.4, 6), r: -10, o: st < 0 ? 0 : 1 });
        stars.update(lt);
      },
    };
  };

  // ================================================================ serve – step 3, serving (animated)
  SCENES.serve = (root, from, to, o = {}) => {
    const head = stepHeader(root, '3', C.serve, { color: 'mango', size: 140 });
    const sub = subPill(root, C.serveSub);
    const gst = guest(root, 31, 560);
    const counter = new Sprite(root, counterBandSVG());
    const bubble = new Sprite(root, orderBubble({ base: 'acai', mid: ['strawberry', 'banana', 'blueberry'], top: ['honey', 'coconut', 'mint'] }));
    const bar = bubble.in.querySelector('.pbar-fill');
    const bowl = new Sprite(root, bowlSVG({ base: 'acai', mid: ['strawberry', 'banana', 'blueberry'], top: ['honey', 'coconut', 'mint'] }, 400));
    const touch = new Sprite(root, touchMarkup());
    const pill = new Sprite(root, `<div class="pill" style="font-size:96px">${coinSVG(110)}<span class="coins">+0</span></div>`);
    const coinsText = pill.in.querySelector('.coins');
    const tip = chip(root, C.tip, 'leaf');
    const hearts = new Burst(root, {
      n: 7, seed: 12, x: 540, y: 820, t0: b(2), speed: [500, 900], angle: [-150, -30], gravity: -300, drag: 2, life: [0.9, 1.3], scale: [0.6, 1],
      html: () => heartSVG(true, 80),
    });
    const sparks = new Burst(root, {
      n: 12, seed: 13, x: 540, y: 900, t0: b(2), speed: [900, 1500], gravity: 500, drag: 3, life: [0.5, 0.8], scale: [0.5, 1], html: () => sparkleSVG(80),
    });
    const Ts = b(2);
    const coins = [];
    const rng = createRng(99);
    for (let i = 0; i < 12; i++) {
      const a = rng.range(-170, -10) * (Math.PI / 180);
      const v = rng.range(500, 950);
      coins.push({ sp: new Sprite(root, coinSVG(90)), vx: Math.cos(a) * v, vy: Math.sin(a) * v, t0: Ts + 0.03 + i * 0.025, fly: 0.3 + rng.range(0, 0.12), back: 0.32 });
    }
    const PILL = [540, 300];
    const total = 42;
    cue(from + 0.1, 'bell', { kind: 'sfx', gain: 0.6 });
    cue(from + b(1), 'pickup', { kind: 'sfx' });
    cue(from + Ts, 'drop', { kind: 'sfx' });
    cue(from + Ts + 0.02, 'happy', { kind: 'sfx' });
    coins.forEach((c, i) => { if (i % 2 === 0) cue(from + c.t0 + c.fly + c.back, 'coin', { kind: 'sfx', gain: 0.7 }); });
    cue(from + b(4), 'purchase', { kind: 'sfx', gain: 0.8 });
    fx.flash(from + Ts, 0.35, 12);
    fx.punch(from + Ts, 0.05, 9);
    fx.shake(from + Ts, 14, 9);
    cue(from + b(5.75), 'whoosh', { gain: 0.7 });

    return {
      from, to, enter: ['whipIn', 0.14], leave: ['zoomOut', 0.12],
      update(lt) {
        // header and subtitle leave when the coins arrive
        const hOut = ease.inBack(prog(lt, Ts + 0.05, Ts + 0.25));
        head(lt, hOut);
        const sp = popIn(lt - 0.22);
        sub.set({ x: 540, y: 440 + sp.dy - hOut * 60, s: sp.s * (1 - hOut), o: sp.o * (1 - hOut) });
        // the guest with the order bubble
        const gp = popIn(lt - 0.05, { rise: 300, f: 2, d: 6.5 });
        const happy = lt > Ts;
        const jump = happy ? Math.abs(jiggle(lt - Ts, 2.6, 4)) * -60 : 0;
        gst.mood(happy ? 'happy' : 'neutral').sp.set({ x: 540, y: 1010 + gp.dy + jump + Math.sin(lt * 5) * 4, s: gp.s * (1 + (happy ? jiggle(lt - Ts, 3, 6) * 0.06 : 0)), o: gp.o });
        counter.set({ x: 540, y: 1340 });
        const bp = popIn(lt - b(0.5), { f: 2.6, d: 8 });
        const bOut = ease.inBack(prog(lt, Ts, Ts + 0.16));
        bubble.set({ x: 540, y: 640 + bp.dy, s: bp.s * (1 - bOut), o: bp.o * (1 - bOut) });
        const pat = 1 - prog(lt, b(0.5), Ts) * 0.45;
        bar.style.width = `${(pat * 100).toFixed(1)}%`;
        bar.style.background = pat > 0.6 ? '#2fbf71' : '#ffb627';
        // the bowl is dragged up to the guest
        const k = ease.inOutCubic(prog(lt, b(1), Ts));
        const [x, y] = arc(k, [540, 1490], [860, 1200], [540, 1030]);
        const drop = prog(lt, Ts, Ts + 0.12);
        bowl.set({ x, y, s: lerp(1, 0.6, k) * (1 - drop), r: Math.sin(k * Math.PI) * 14, o: 1 - drop });
        setTouch(touch, {
          x: x + 50, y: y + 90, o: lt < b(0.75) ? 0 : lt < Ts + 0.2 ? 1 : 1 - prog(lt, Ts + 0.2, Ts + 0.35),
          press: clamp((lt - b(1)) / 0.08) * (1 - clamp((lt - Ts) / 0.08)), ripple: (lt - Ts) / 0.35,
        });
        hearts.update(lt);
        sparks.update(lt);
        // coins burst from the guest and fly into the counter
        let got = 0;
        for (const c of coins) {
          const dt = lt - c.t0;
          if (dt < 0) { c.sp.hide(); continue; }
          if (dt < c.fly) {
            const d = (1 - Math.exp(-3 * dt)) / 3;
            c.sp.set({ x: 540 + c.vx * d, y: 900 + c.vy * d + 900 * dt * dt, s: ease.outBack(clamp(dt / 0.1)), r: dt * 200 });
            continue;
          }
          const q = (dt - c.fly) / c.back;
          if (q >= 1) { got++; c.sp.hide(); continue; }
          const dd = (1 - Math.exp(-3 * c.fly)) / 3;
          const sx = 540 + c.vx * dd;
          const sy = 900 + c.vy * dd + 900 * c.fly * c.fly;
          const e = ease.inCubic(q);
          c.sp.set({ x: lerp(sx, PILL[0] - 110, e), y: lerp(sy, PILL[1], e), s: lerp(1, 0.6, e), r: 0 });
        }
        const pp = popIn(lt - Ts - 0.12, { f: 2.6, d: 7 });
        const hit = coins.reduce((m, c) => Math.max(m, decay(lt - (c.t0 + c.fly + c.back), 14) * (lt > c.t0 + c.fly + c.back ? 1 : 0)), 0);
        pill.set({ x: PILL[0], y: PILL[1] + pp.dy, s: pp.s * (1 + hit * 0.08 + 0.05 * decay(lt - b(4), 8)), o: pp.o });
        const value = Math.round((got / coins.length) * 30 + (lt > b(4) ? Math.min(12, (lt - b(4)) * 60) : 0));
        coinsText.textContent = `+${Math.min(total, value)}`;
        const tp = popIn(lt - b(4), { f: 2.6, d: 7 });
        tip.set({ x: 540, y: 440 + tp.dy, s: tp.s, r: -4, o: tp.o });
      },
    };
  };

  // ================================================================ rush – patience runs out
  SCENES.rush = (root, from, to, o = {}) => {
    const title = new Title(root, C.rush, { size: 118, fill: 'white' });
    const heartXs = [380, 540, 700];
    const heartSp = heartXs.map(() => new Sprite(root, heartSVG(true, 130)));
    const heartGone = new Sprite(root, heartSVG(false, 130));
    const shards = new Burst(root, {
      n: 10, seed: 17, x: 700, y: 600, t0: b(2.5), speed: [400, 900], angle: [-170, -10], gravity: 2600, drag: 1, life: [0.6, 0.9], scale: [0.4, 0.8],
      html: () => '<svg width="40" height="40" viewBox="0 0 40 40"><path d="M6 4L34 14L14 36Z" fill="#ff4d6d" stroke="#2a1236" stroke-width="3" stroke-linejoin="round"/></svg>',
    });
    const xs = [220, 540, 860];
    const seeds = [44, 8, 19];
    const start = [0.95, 0.62, 0.36];
    const endK = [0.62, 0.22, 0];
    const guests = seeds.map((s) => guest(root, s, 330));
    const bars = xs.map(() => patienceBar(root, 230));
    const blender = new View3D(root, 'blender', 480);
    const warn = new Sprite(root, blenderBadgeSVG('overflowing', 130));
    const timer = new Sprite(root, `<div class="pill" style="font-size:88px">${clockSVG(96)}<span class="tm">0:05</span></div>`);
    const tm = timer.in.querySelector('.tm');
    const Tg = b(2.5);
    for (let i = 0; i < 4; i++) {
      cue(from + b(i), 'tick', { kind: 'sfx', alt: i % 2 === 1 });
      cue(from + b(i + 0.5), 'tick', { kind: 'sfx', alt: i % 2 === 0, gain: 0.6 });
      fx.punch(from + b(i), 0.03, 10);
    }
    cue(from + b(1), 'overflow', { kind: 'sfx' });
    cue(from + Tg, 'angry', { kind: 'sfx' });
    cue(from + Tg + 0.05, 'heart', { kind: 'sfx' });
    fx.shake(from, 10, 1.2);
    fx.shake(from + Tg, 34, 6);
    fx.flash(from + Tg, 0.25, 12);
    fx.spin(from, 120, 1.2);
    cue(from + b(2), 'riser', { len: b(2), gain: 0.8 });

    return {
      from, to, enter: ['zoomIn', 0.15], leave: ['zoomOut', 0.1], tint: 'red',
      update(lt) {
        title.sprite.set({ x: 540, y: 300 + Math.sin(lt * 30) * 2 });
        title.pop(lt, { stagger: 0.02, freq: 2.8, damp: 8 });
        // hearts – the last one breaks when the third guest walks out
        heartXs.forEach((x, i) => {
          const p = popIn(lt - 0.15 - i * 0.06);
          const beat = 1 + 0.12 * decay(lt % BEAT, 8);
          if (i === 2 && lt > Tg) {
            heartSp[i].hide();
            const q = popIn(lt - Tg, { f: 3, d: 8 });
            heartGone.set({ x, y: 580, s: q.s, r: jiggle(lt - Tg, 6, 6) * 25 });
            return;
          }
          heartGone.hide();
          const sh = i === 2 && lt > Tg - 0.4 ? wob(lt * 5, 2) * 10 : 0;
          heartSp[i].set({ x: x + sh, y: 580 + p.dy, s: p.s * beat, o: p.o });
        });
        shards.update(lt);
        // three guests running out of patience
        guests.forEach((gst, i) => {
          const p = popIn(lt - 0.08 - i * 0.07, { rise: 200, f: 2.4, d: 7 });
          const k = lerp(start[i], endK[i], prog(lt, 0.1, Tg));
          const leave = i === 2 ? ease.inBack(prog(lt, Tg, Tg + 0.35)) : 0;
          const angry = k < 0.12;
          const sh = angry ? wob(lt * 4, i) * 12 : 0;
          gst.mood(moodOf(k)).sp.set({ x: xs[i] + sh, y: 880 + p.dy + leave * 900, s: p.s, r: leave * 30, o: p.o * (1 - leave) });
          bars[i].value(k);
          bars[i].sp.set({ x: xs[i], y: 1085 + p.dy + leave * 900, s: p.s, o: p.o * (1 - leave) });
        });
        // the forgotten blender overflows
        const bp = popIn(lt - 0.2, { rise: 200 });
        blender.draw({ tier: 1, state: 'overflowing', base: 'pitaya', portions: 2, maxPortions: 2 }, lt);
        blender.sprite.set({ x: 290 + wob(lt * 2, 9) * 6, y: 1400 + bp.dy, s: bp.s, o: bp.o });
        const wp = popIn(lt - b(1));
        warn.set({ x: 430, y: 1210, s: wp.s * (1 + 0.15 * Math.max(0, Math.sin(lt * 24))), o: wp.o });
        // the shift clock counts down
        const tp = popIn(lt - 0.3);
        const secs = Math.max(1, 5 - Math.floor(lt / BEAT));
        tm.textContent = `0:0${secs}`;
        tm.style.color = secs <= 2 ? '#e0203f' : '#2a1236';
        timer.set({ x: 790, y: 1400 + tp.dy, s: tp.s * (1 + 0.08 * decay(lt % BEAT, 10)), o: tp.o });
      },
      alarm: (lt) => 0.35 + 0.35 * decay(lt % BEAT, 6),
    };
  };

  // ================================================================ ingredients – 16 of them
  SCENES.ingredients = (root, from, to, o = {}) => {
    const num = new Sprite(root, '<div class="big-num" style="font-size:300px">16</div>');
    const numEl = num.in.firstChild;
    const word = new Title(root, C.ingredients, { size: 128, fill: 'mango' });
    const sub = subPill(root, C.ingSub);
    const order = ['acai', 'pitaya', 'spirulina', 'banana', 'strawberry', 'blueberry', 'mango', 'kiwi', 'granola', 'honey', 'coconut', 'chia', 'peanut', 'chocolate', 'mint', 'cacao'];
    const cards = order.map((id) => new Sprite(root, `<div class="card">${ingredientIcon(id, 170)}</div>`));
    fx.flash(from, 0.9, 8);
    fx.shake(from, 30, 6);
    fx.speed(from, 0.8, 3);
    cue(from, 'impact', { gain: 0.8 });
    order.forEach((_, i) => {
      const r = Math.floor(i / 4);
      const c = i % 4;
      if (i % 2 === 0) cue(from + b(0.5) + (r + c) * 0.045, 'pop', { gain: 0.3, pitch: (r + c) % 6 });
    });
    cue(from + b(3.6), 'whoosh', { gain: 0.6 });

    return {
      from, to, enter: ['zoomIn', 0.14], leave: ['spinOut', 0.13], tint: 'pink',
      update(lt) {
        const np = popIn(lt, { f: 2.4, d: 7 });
        numEl.textContent = String(Math.max(1, Math.min(16, Math.round(1 + 15 * ease.outCubic(prog(lt, 0, b(1.4)))))));
        num.set({ x: 540, y: 300 + np.dy, s: np.s * (1 + 0.06 * decay(lt % BEAT, 9)), r: -4 });
        word.sprite.set({ x: 540, y: 500 });
        word.pop(lt - 0.12, { stagger: 0.025 });
        const sp = popIn(lt - b(1));
        sub.set({ x: 540, y: 630 + sp.dy, s: sp.s, o: sp.o });
        cards.forEach((cd, i) => {
          const r = Math.floor(i / 4);
          const c = i % 4;
          const d = b(0.5) + (r + c) * 0.045;
          const p = popIn(lt - d, { rise: 120, f: 2.3, d: 7 });
          // hop on beats 2 and 3, as a wave across the grid
          const hop = bump(lt, b(2) + (r + c) * 0.03, b(2) + (r + c) * 0.03 + 0.28) + bump(lt, b(3) + (r + c) * 0.03, b(3) + (r + c) * 0.03 + 0.28);
          cd.set({ x: 540 + (c - 1.5) * 228, y: 830 + r * 228 + p.dy - hop * 40, s: p.s * (1 + hop * 0.1), r: (1 - Math.min(1, p.s)) * (c % 2 ? 20 : -20) + Math.sin(lt * 3 + i) * 2, o: p.o });
        });
      },
    };
  };

  // ================================================================ upgrades – the four blender models
  SCENES.upgrades = (root, from, to, o = {}) => {
    const title = new Title(root, C.upgrades, { size: 140, fill: 'lagoon' });
    const sub = subPill(root, C.upgSub);
    const spot = new Sprite(root, '<div style="width:1000px;height:1300px;background:radial-gradient(ellipse 50% 50% at 50% 55%,rgba(255,255,255,.33),rgba(255,255,255,0) 70%)"></div>');
    const blender = new View3D(root, 'blender', 860);
    const names = ['CLASSIC', 'TURBO', 'PRO', 'PRO MAX'];
    const labels = names.map((nm) => chip(root, nm, 'ink'));
    const rings = names.map((_, i) => new Ring(root, { x: 540, y: 1060, t0: b(i), size: 1000, color: '#18c2c9', width: 18, dur: 0.45 }));
    const bases = ['acai', 'pitaya', 'spirulina', 'acai'];
    for (let i = 0; i < 4; i++) {
      fx.flash(from + b(i), i ? 0.45 : 0.8, 11);
      fx.punch(from + b(i), 0.05, 9);
      cue(from + b(i), i ? 'upgrade' : 'impact', { gain: i ? 0.8 : 0.8, pitch: i });
    }
    cue(from + b(3.6), 'whoosh', { gain: 0.6 });

    return {
      from, to, enter: ['spinIn', 0.16], leave: ['upOut', 0.13], tint: 'night',
      update(lt) {
        title.sprite.set({ x: 540, y: 290 });
        title.pop(lt, { stagger: 0.03 });
        const sp = popIn(lt - 0.2);
        sub.set({ x: 540, y: 420 + sp.dy, s: sp.s, o: sp.o });
        spot.set({ x: 540, y: 1000, o: 0.9 });
        const tier = Math.max(0, Math.min(3, Math.floor(lt / BEAT)));
        const since = lt - b(tier);
        const pop = 0.82 + 0.18 * spring(since, 2.4, 6);
        blender.draw({ tier, big: tier === 3, state: 'blending', base: bases[tier], progress: 0.55, remaining: 2 }, lt, -0.5 + lt * 0.9);
        blender.sprite.set({ x: 540, y: 1060, s: pop });
        rings.forEach((r) => r.update(lt));
        labels.forEach((lb, i) => {
          if (i !== tier) return lb.hide();
          const p = popIn(since, { f: 3, d: 9 });
          return lb.set({ x: 540, y: 1520 + p.dy, s: p.s * 1.2, o: p.o });
        });
      },
    };
  };

  // ================================================================ matcha + levels
  SCENES.matcha = (root, from, to, o = {}) => {
    const A = div(root, 'layer');
    const B = div(root, 'layer');
    const title = new Title(A, C.matcha, { size: 118, fill: 'leaf' });
    const sub = subPill(A, C.matchaSub);
    const SIZE = 780;
    const machine = new View3D(A, 'machine', SIZE);
    const mf = fitFrame(VIEWS.machine, SIZE);
    const cupPx = Math.round(SIZE * MATCHA_CUP_SIZE);
    const fruits = ['strawberry', 'mango'];
    const slotCups = fruits.map(() => new Sprite(A, ''));
    const side = [['kiwi', 170, 1520, -10], ['blueberry', 910, 1540, 10]].map(([id, x, y, r]) => ({ sp: new Sprite(A, matchaGlassSVG(id, 'ready', 260)), x, y, r }));
    const levels = new Title(B, C.levels, { size: 170, fill: 'mango' });
    const endless = new Title(B, C.endless, { size: 96, fill: 'lagoon' });
    const stars = [[300, 880, 220, -12], [540, 800, 290, 0], [780, 880, 220, 12]].map(([x, y, s, r]) => ({ sp: new Sprite(B, starSVG(true, s)), x, y, r }));
    const confetti = confettiBurst(B, { n: 40, seed: 3, x: 540, y: 820, t0: b(3) });
    cue(from, 'impact', { gain: 0.7 });
    fx.flash(from, 0.7, 9);
    cue(from + b(0.4), 'matchaReady', { kind: 'sfx', gain: 0.8 });
    cue(from + b(1.6), 'whoosh', { gain: 0.6 });
    [0, 0.5, 1].forEach((d, i) => {
      cue(from + b(2 + d), 'star', { kind: 'sfx', step: i * 2 });
      fx.punch(from + b(2 + d), 0.05, 10);
      fx.flash(from + b(2 + d), 0.3, 14);
    });
    cue(from + b(3), 'confetti', { gain: 0.6 });
    cue(from + b(3.6), 'whoosh', { gain: 0.6 });

    return {
      from, to, enter: ['upIn', 0.15], leave: ['whipOut', 0.12], tint: 'lagoon',
      update(lt) {
        // part A – the matcha machine at work
        const swap = b(2);
        const aOut = ease.inQuart(prog(lt, swap - 0.12, swap));
        const bIn = 1 - ease.outQuart(prog(lt, swap, swap + 0.15));
        A.style.transform = `translateY(${(-1950 * aOut).toFixed(1)}px)`;
        A.style.display = lt < swap ? '' : 'none';
        B.style.transform = `translateY(${(1950 * bIn).toFixed(1)}px)`;
        B.style.display = lt >= swap ? '' : 'none';
        if (lt < swap) {
          title.sprite.set({ x: 540, y: 290 });
          title.pop(lt, { stagger: 0.03 });
          const sp = popIn(lt - 0.2);
          sub.set({ x: 540, y: 420 + sp.dy, s: sp.s, o: sp.o });
          const slots = fruits.map((fruit, i) => {
            const p = clamp(lt / b(1.6) + i * 0.25);
            return p < 1 ? { state: 'mixing', fruit, progress: p } : { state: 'ready', fruit, progress: 1 };
          });
          machine.draw({ slots }, lt);
          const mp = popIn(lt, { rise: 200, f: 2.2, d: 7 });
          machine.sprite.set({ x: 540, y: 1000 + mp.dy, s: mp.s });
          slots.forEach((s, i) => {
            const fill = s.state === 'mixing' ? Math.round(pourFill(s.progress) * 12) / 12 : null;
            slotCups[i].html(matchaGlassSVG(s.fruit, s.state, cupPx, { fill, stream: false }));
            const cx = mf.ax + MACHINE_SLOT_X[2][i] * mf.zoom - SIZE / 2;
            const cy = MATCHA_SLOT_Y * SIZE - cupPx / 2 - SIZE / 2;
            slotCups[i].set({ x: 540 + cx * mp.s, y: 1000 + mp.dy + cy * mp.s, s: mp.s });
          });
          side.forEach((c, i) => {
            const p = popIn(lt - b(0.5) - i * 0.08, { rise: 300, f: 2.2, d: 7 });
            c.sp.set({ x: c.x, y: c.y + p.dy + Math.sin(lt * 3 + i) * 8, s: p.s, r: c.r, o: p.o });
          });
        } else {
          const l = lt - swap;
          levels.sprite.set({ x: 540, y: 520 });
          levels.pop(l, { stagger: 0.03 });
          stars.forEach((st, i) => {
            const d = b(i * 0.5);
            const q = l - d;
            st.sp.set({ x: st.x, y: st.y, s: q < 0 ? 0 : q < 0.08 ? lerp(2.6, 0.9, ease.inQuad(q / 0.08)) : 0.9 + 0.1 * spring(q - 0.08, 2.5, 6), r: st.r + (q > 0 ? Math.sin(l * 4 + i) * 3 : 0), o: q < 0 ? 0 : 1 });
          });
          endless.sprite.set({ x: 540, y: 1130 });
          endless.pop(l - b(1), { stagger: 0.025 });
          confetti.update(lt);
        }
      },
    };
  };

  // ================================================================ game – a screenshot of the real game in a tablet
  SCENES.game = (root, from, to, o = {}) => {
    const title = new Title(root, C.cafe, { size: 130, fill: 'white' });
    const W = 980;
    const H = Math.round((W * 800) / 1280);
    const k0 = W / 1280; // game px → screen px
    const screen = shot ? `<img src="${shot}" width="${W}" height="${H}" alt="">` : `<iframe src="../../index.html" width="1280" height="800" style="border:0;transform:scale(${k0});transform-origin:0 0"></iframe>`;
    const tablet = new Sprite(root, `<div class="tablet"><div class="tablet-screen" style="width:${W}px;height:${H}px">${screen}<div class="tablet-fx"></div><div class="tablet-glare"></div></div></div>`);
    const glare = tablet.in.querySelector('.tablet-glare');
    const persp = tablet.in.firstChild;
    const layer = tablet.in.querySelector('.tablet-fx');
    // a finger drags banana from its bowl onto the third cup of the screenshot (game coordinates)
    const ghost = new Sprite(layer, scoopSVG('banana', 110));
    const finger = new Sprite(layer, touchMarkup());
    const BIN = [415, 545];
    const CUP = [741, 425];
    const plus = new Burst(layer, {
      n: 8, seed: 61, x: CUP[0] * k0, y: CUP[1] * k0, t0: b(3.1), speed: [250, 450], gravity: 300, drag: 3, life: [0.4, 0.6], scale: [0.25, 0.4], html: () => sparkleSVG(80),
    });
    const dd = chip(root, C.dragDrop, 'mango');
    fx.flash(from, 0.6, 9);
    cue(from, 'impact', { gain: 0.6 });
    cue(from + b(2), 'swish', { gain: 0.5 });
    cue(from + b(2.3), 'pickup', { kind: 'sfx', gain: 0.8 });
    cue(from + b(3.1), 'plop', { kind: 'sfx' });
    cue(from + b(3.6), 'whoosh', { gain: 0.7 });

    return {
      from, to, enter: ['whipIn', 0.14], leave: ['zoomOut', 0.12],
      update(lt) {
        title.sprite.set({ x: 540, y: 330 });
        title.pop(lt - 0.05, { stagger: 0.025, out: b(2) });
        // the tablet swings in, then the camera pushes into the counter
        const k = ease.outCubic(prog(lt, 0, b(1.3)));
        persp.style.transform = `perspective(1800px) rotateX(${lerp(18, 0, k).toFixed(2)}deg) rotateY(${lerp(-38, 0, k).toFixed(2)}deg)`;
        const push = ease.inOutCubic(prog(lt, b(1.9), b(2.6)));
        const S = lerp(0.85, 1, k) * lerp(1, 1.8, push);
        // centre the drag (around game point 580, 480) when pushed in
        tablet.set({ x: 540 + push * 60 * k0 * 1.8, y: lerp(1500, 1040, ease.outBack(prog(lt, 0, b(1)))) - push * 80 * k0 * 1.8 - push * 60, s: S, r: lerp(-6, 0, k) });
        glare.style.transform = `translateX(${lerp(-110, 110, prog(lt, b(1), b(2.2))).toFixed(1)}%)`;
        const dp = popIn(lt - b(1.2));
        dd.set({ x: 540, y: 1540 + dp.dy, s: dp.s * (1 - push), r: -3, o: dp.o * (1 - push) });
        // the drag
        const d0 = b(2.3);
        const d1 = b(3.1);
        const q = ease.inOutCubic(prog(lt, d0, d1));
        const [gx, gy] = arc(q, BIN, [520, 360], CUP);
        const drop = prog(lt, d1, d1 + 0.1);
        ghost.set({ x: gx * k0, y: gy * k0 - 20, s: lt < d0 ? 0 : (1 - drop) * (0.8 + 0.2 * ease.outBack(prog(lt, d0, d0 + 0.1))), o: lt < d0 || drop >= 1 ? 0 : 1 });
        setTouch(finger, {
          x: gx * k0 + 22, y: gy * k0 + 34, o: lt < b(2.1) ? 0 : lt < d1 + 0.25 ? 1 : 1 - prog(lt, d1 + 0.25, d1 + 0.4),
          press: clamp((lt - d0) / 0.08) * (1 - clamp((lt - d1) / 0.08)), ripple: (lt - d1) / 0.35, size: 0.55,
        });
        plus.update(lt);
      },
    };
  };

  // ================================================================ end card
  SCENES.end = (root, from, to, o = {}) => {
    const logo = new Sprite(root, logoSVG(900));
    const ring = new Ring(root, { x: 540, y: 560, t0: 0, size: 1400, color: '#ffffff', width: 26 });
    const confetti = confettiBurst(root, { n: 50, seed: 31, x: 540, y: 560, t0: 0.02 });
    const finale = confettiBurst(root, { n: 60, seed: 32, x: 540, y: 1010, t0: b(4) });
    const btn = new Sprite(root, `<div class="play-btn">${PLAY_ICON}<span>${C.play}</span></div>`);
    const touch = new Sprite(root, touchMarkup());
    const free = new Title(root, C.free, { size: 76, fill: 'mango' });
    const devices = new Sprite(root, `<div class="label">${C.devices}</div>`);
    const url = new Sprite(root, `<div class="url">${C.url}</div>`);
    const bio = new Sprite(root, `<div class="label" style="font-size:40px;opacity:.9">${C.bio} ↓</div>`);
    const cupL = new Sprite(root, bowlSVG({ base: 'acai', mid: ['banana', 'strawberry', 'granola'], top: ['honey', 'coconut'] }, 360));
    const cupR = new Sprite(root, bowlSVG({ base: 'pitaya', mid: ['mango', 'kiwi', 'blueberry'], top: ['coconut', 'mint'] }, 360));
    fx.flash(from, 1, 7);
    fx.shake(from, 36, 5);
    fx.speed(from, 0.9, 2.6);
    fx.spin(from, 120, 2);
    cue(from, 'impact', { gain: 1 });
    cue(from + b(1), 'pop', { gain: 0.5, pitch: 3 });
    cue(from + b(2), 'click', { kind: 'sfx' });
    cue(from + b(4), 'click', { kind: 'sfx' });
    cue(from + b(4) + 0.02, 'win', { kind: 'sfx', gain: 0.9 });
    cue(from + b(4) + 0.02, 'confetti', { gain: 0.8 });
    fx.flash(from + b(4), 0.5, 9);
    fx.punch(from + b(4), 0.05, 8);

    return {
      from, to, enter: ['zoomIn', 0.16],
      update(lt) {
        ring.update(lt);
        confetti.update(lt);
        finale.update(lt);
        const land = 0.11;
        const s = lt < land ? lerp(3, 0.92, ease.inQuad(lt / land)) : 0.92 + 0.08 * spring(lt - land, 2.2, 5.5);
        logo.set({ x: 540, y: 560 + Math.sin(lt * 2.6) * 8, s: s + 0.02 * decay(lt % BEAT, 9), r: lt < land ? -12 : -12 * (1 - spring(lt - land, 1.6, 4)) + Math.sin(lt * 2) * 1.2 });
        // the play button, tapped on beats 2 and 4
        const bp = popIn(lt - b(1), { f: 2.2, d: 6 });
        const tap = (t0) => bump(lt, t0 - 0.02, t0 + 0.14);
        const press = Math.max(tap(b(2)), tap(b(4)));
        const beat = lt > b(1) ? 0.035 * decay(lt % BEAT, 8) : 0;
        btn.set({ x: 540, y: 1010 + bp.dy + press * 12, s: bp.s * (1 + beat) * (1 - press * 0.05), o: bp.o });
        const tIn = b(1.6);
        const tx = 740 + (lt < b(2) ? lerp(160, 0, ease.outCubic(prog(lt, tIn, b(2) - 0.05))) : 0);
        const ty = 1080 + (lt < b(2) ? lerp(300, 0, ease.outCubic(prog(lt, tIn, b(2) - 0.05))) : 0);
        setTouch(touch, {
          x: tx, y: ty, o: lt < tIn ? 0 : lt < b(5) ? 1 : 1 - prog(lt, b(5), b(5.3)),
          press, ripple: lt < b(4) ? (lt - b(2)) / 0.4 : (lt - b(4)) / 0.4,
        });
        free.sprite.set({ x: 540, y: 1215 });
        free.pop(lt - b(1.5), { stagger: 0.02 });
        const dp = popIn(lt - b(1.75));
        devices.set({ x: 540, y: 1310 + dp.dy, s: dp.s, o: dp.o });
        const up = popIn(lt - b(2.5), { f: 2.4, d: 7 });
        url.set({ x: 540, y: 1430 + up.dy, s: up.s * (1 + 0.03 * decay((lt - b(4)) % (2 * BEAT), 6) * (lt > b(4) ? 1 : 0)), r: -2, o: up.o });
        const bi = popIn(lt - b(3));
        bio.set({ x: 540, y: 1530 + bi.dy + Math.abs(Math.sin(lt * 5)) * -8, s: bi.s, o: bi.o });
        for (const [cupSp, x, r, d] of [[cupL, 140, -14, 2.5], [cupR, 940, 14, 2.62]]) {
          const p = popIn(lt - b(d), { rise: 400, f: 2, d: 6 });
          cupSp.set({ x, y: 1700 + p.dy + Math.sin(lt * 2.4 + x) * 12, s: p.s * 0.9, r: r + Math.sin(lt * 2 + x) * 3, o: p.o });
        }
      },
    };
  };

  // ================================================================ real gameplay (the calm cuts)
  // A camera on the footage: keys [[beat, scale, cx, cy], …] eased one into the next; cx/cy null
  // follows the player's finger. Returns the camera at scene time lt and footage time ft.
  const keyedCam = (keys, lt, ft, w, h) => {
    let i = 0;
    while (i < keys.length - 1 && lt >= b(keys[i + 1][0])) i++;
    const k0 = keys[i];
    const k1 = keys[Math.min(i + 1, keys.length - 1)];
    const k = k1 === k0 ? 0 : ease.inOutCubic(prog(lt, b(k0[0]), b(k1[0])));
    const sc = lerp(k0[1], k1[1], k);
    const follow = camOn(path, footage.clip, ft, sc, w, h);
    const pick = (v, axis) => (v === null || v === undefined ? follow[axis] : v);
    return fitCam(lerp(pick(k0[2], 'cx'), pick(k1[2], 'cx'), k), lerp(pick(k0[3], 'cy'), pick(k1[3], 'cy'), k), sc, w, h);
  };
  // footage segment o.seg = [ft0] played from the scene's start at o.rate, with the game's sounds
  const footageOf = (from, to, o, gain = 0.85) => {
    const rate = o.rate || 1;
    const ft0 = o.seg[0];
    placeSounds(footage.clip, ft0, ft0 + (to - from) * rate, from, cue, loops, { gain, rate });
    return (lt) => ft0 + lt * rate;
  };

  // a step of the game (badge + word, a line of help) shown in real gameplay in a window
  SCENES.stepGame = (root, from, to, o) => {
    const head = stepHeader(root, o.num, C[o.word], { color: o.color, size: o.size || 150 });
    const sub = subPill(root, C[o.sub]);
    const W = 1000;
    const H = 1040;
    const view = new FootageView(root, footage, { w: W, h: H, round: 52, window: true });
    const ftAt = footageOf(from, to, o);
    const keys = o.keys || [[0, o.zoom || 1.5, null, null]];
    return {
      from, to, enter: ['softIn', 0.3], leave: ['softOut', 0.25],
      update(lt) {
        head(lt);
        const sp = popIn(lt - 0.25, { f: 2, d: 8 });
        sub.set({ x: 540, y: 440 + sp.dy, s: sp.s, o: sp.o });
        const k = ease.outCubic(prog(lt, 0, 0.45));
        view.sprite.set({ x: 540, y: lerp(1160, 1100, k), s: lerp(0.96, 1, k) });
        const ft = ftAt(lt);
        return view.show(ft, keyedCam(keys, lt, ft, W, H));
      },
    };
  };

  // titles over the whole café (opening and the rush)
  SCENES.cafeGame = (root, from, to, o) => {
    const titles = o.titles.map(([, key, fill, size]) => new Title(root, C[key], { size: size || 128, fill }));
    const W = 1000;
    const H = o.h || 720;
    const view = new FootageView(root, footage, { w: W, h: H, round: 44, window: true });
    const ftAt = footageOf(from, to, o);
    const keys = o.keys || [[0, W / 1280, 640, 400]];
    const sub = o.sub ? subPill(root, C[o.sub]) : null;
    return {
      from, to, enter: o.enter === undefined ? ['softIn', 0.3] : o.enter, leave: ['softOut', 0.25],
      update(lt) {
        o.titles.forEach(([at, , , , until], i) => {
          const tt = titles[i];
          const t0 = b(at);
          const out = until === undefined ? null : b(until) - t0 - 0.2;
          if (lt < t0 || (out !== null && lt > b(until))) return tt.sprite.hide();
          tt.sprite.set({ x: 540, y: o.titleY || 330 });
          tt.pop(lt - t0, { stagger: 0.03, freq: 2.4, damp: 9, out, outDur: 0.2 });
          return null;
        });
        if (sub) {
          const sp = popIn(lt - b(o.subAt || 1), { f: 2, d: 8 });
          sub.set({ x: 540, y: 1545 + sp.dy, s: sp.s, o: sp.o });
        }
        const k = ease.outCubic(prog(lt, 0, 0.5));
        view.sprite.set({ x: 540, y: lerp(1080, 1040, k) + (o.viewDy || 0), s: lerp(0.96, 1, k) });
        const ft = ftAt(lt);
        return view.show(ft, keyedCam(keys, lt, ft, W, H));
      },
    };
  };

  // the gameplay cut: full-screen footage with a follow camera, captions and a few overlays
  SCENES.follow = (root, from, to, o) => {
    const W = 1080;
    const H = 1920;
    const view = new FootageView(root, footage, { w: W, h: H, blurBg: true });
    const ftAt = footageOf(from, to, o, 1);
    const keys = o.keys || [[0, 2.4, null, 400]];
    const band = o.title ? new Sprite(root, '<div class="top-band"></div>') : null;
    const title = o.title ? new Title(root, C[o.title[1]], { size: o.title[2] || 104, fill: 'white' }) : null;
    const caps = (o.captions || []).map(([at, until, key, num, color]) => ({
      at, until, sp: new Sprite(root, `<div class="cap">${num ? `<span class="cap-num ${color || ''}">${num}</span>` : ''}${C[key]}</div>`),
    }));
    const logo = o.logo ? new Sprite(root, logoSVG(760)) : null;
    const tag = o.logo ? new Title(root, C.tagline, { size: 84, fill: 'mango' }) : null;
    const chips = (o.chips || []).map(([at, key, color, x, y, r]) => ({ at, x, y, r: r || 0, sp: chip(root, C[key], color) }));
    if (o.logo) {
      fx.flash(from + b(o.logo[0]), 0.6, 9);
      cue(from + b(o.logo[0]), 'impact', { gain: 0.55 });
    }
    chips.forEach((c, i) => cue(from + b(c.at), 'pop', { gain: 0.35, pitch: 2 + i }));
    return {
      from, to, enter: o.enter === undefined ? ['softIn', 0.3] : o.enter, leave: o.leave === undefined ? ['softOut', 0.25] : o.leave,
      update(lt) {
        const ft = ftAt(lt);
        const wait = view.show(ft, keyedCam(keys, lt, ft, W, H));
        view.sprite.set({ x: 540, y: 960 });
        if (title) {
          const [at, , , until] = o.title;
          const on = prog(lt, b(at), b(at) + 0.3) * (1 - prog(lt, b(until) - 0.3, b(until)));
          band.set({ x: 540, y: 280, o: on });
          title.sprite.set({ x: 540, y: 270, o: on > 0 ? 1 : 0 });
          title.pop(lt - b(at), { stagger: 0.03, freq: 2.4, damp: 9, out: b(until) - b(at) - 0.25, outDur: 0.2 });
        }
        caps.forEach((c) => {
          const p = popIn(lt - b(c.at), { f: 2.2, d: 8 });
          const out = ease.inBack(prog(lt, b(c.until) - 0.22, b(c.until)));
          c.sp.set({ x: 540, y: 1470 + p.dy + out * 60, s: p.s * (1 - out * 0.3), o: p.o * (1 - out) });
        });
        if (logo) {
          const [at, until] = o.logo;
          const q = lt - b(at);
          const land = 0.12;
          const sl = q < land ? lerp(2.2, 0.93, ease.inQuad(clamp(q / land))) : 0.93 + 0.07 * spring(q - land, 2, 6);
          const out = ease.inBack(prog(lt, b(until) - 0.25, b(until)));
          logo.set({ x: 540, y: 380 - out * 500, s: sl, r: -4 + Math.sin(lt * 2) * 1, o: q > 0 ? 1 : 0 });
          tag.sprite.set({ x: 540, y: 1420 + out * 500, o: q > 0 ? 1 : 0 });
          tag.pop(q - b(1), { stagger: 0.025 });
        }
        chips.forEach((c) => {
          const p = popIn(lt - b(c.at), { f: 2.4, d: 8 });
          c.sp.set({ x: c.x, y: c.y + p.dy, s: p.s * 1.3, r: c.r, o: p.o });
        });
        return wait;
      },
    };
  };

  // ================================================================ the films in their own modules
  const ctx = {
    lang, C, fx, cue, loops, b, beat: BEAT, shot, frame, TRANS, SCENES,
    popIn, subPill, chip, guest, patienceBar, moodOf, stepHeader, confettiBurst, sparkleSVG, counterBandSVG, orderBubble, PLAY_ICON,
  };
  for (const m of EXTRA) Object.assign(SCENES, m.scenes(ctx));

  // ================================================================ assemble the cut
  let at = 0;
  for (const [name, beats, opts = {}] of cut.scenes) {
    const from = b(at);
    const to = b(at + beats);
    scene((root) => {
      const sc = SCENES[name](root, from, to, opts);
      if (opts.enter !== undefined) sc.enter = opts.enter;
      if (opts.leave !== undefined) sc.leave = opts.leave;
      return sc;
    });
    at += beats;
  }
  const duration = b(at);

  // ---------------------------------------------------------------- seek
  // resolves once every picture of the frame is decoded
  async function seek(t) {
    const c = fx.cam(t);
    const waits = [];
    // the camera bounces on every beat while the music grooves (the hype cut)
    const beatPunch = cut.bounce && t > b(cut.bounce[0]) && t < b(cut.bounce[1]) ? 0.012 * decay(t % BEAT, 10) : 0;
    cam.style.transform = `translate(${c.x.toFixed(2)}px,${c.y.toFixed(2)}px) rotate(${c.r.toFixed(3)}deg) scale(${(c.s + beatPunch).toFixed(4)})`;
    rays.style.transform = `rotate(${fx.raysAt(t).toFixed(2)}deg) scale(${(1 + 0.03 * decay(t % BEAT, 7)).toFixed(4)})`;
    floaters.forEach((f, i) => {
      const y = ((((f.y0 - f.v * t) % 2300) + 2300) % 2300) - 160;
      f.sp.set({ x: f.x + Math.sin(t * 0.8 + f.ph) * 30 + c.x * 0.3, y: y + c.y * 0.3, r: f.r0 + f.vr * t, o: 0.42 });
      return i;
    });
    const tintOn = {};
    let alarmO = 0;
    for (const s of scenes) {
      const on = t >= s.from && t < s.to;
      if (s.tint) tintOn[s.tint] = Math.max(tintOn[s.tint] || 0, prog(t, s.from - 0.04, s.from + 0.06) * (1 - prog(t, s.to - 0.06, s.to + 0.04)));
      if (!on) {
        if (s.root.style.display !== 'none') s.root.style.display = 'none';
        continue;
      }
      s.root.style.display = '';
      const lt = t - s.from;
      let tr = {};
      if (s.enter && lt < s.enter[1]) tr = TRANS[s.enter[0]](lt / s.enter[1]);
      const left = s.to - t;
      if (s.leave && left < s.leave[1]) tr = TRANS[s.leave[0]](1 - left / s.leave[1]);
      const { x = 0, y = 0, s: sc = 1, r = 0, o = 1 } = tr;
      s.root.style.transform = x || y || sc !== 1 || r ? `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${r.toFixed(2)}deg) scale(${sc.toFixed(4)})` : '';
      s.root.style.opacity = o < 1 ? o.toFixed(3) : '';
      const wait = s.update(lt, t);
      if (wait) waits.push(wait);
      if (s.alarm) alarmO = s.alarm(lt);
    }
    for (const [name, el] of Object.entries(tints)) el.style.opacity = (tintOn[name] || 0).toFixed(3);
    alarm.style.opacity = alarmO.toFixed(3);
    flashEl.style.opacity = fx.flashAt(t).toFixed(3);
    const lo = fx.linesAt(t);
    linesEl.style.opacity = lo.toFixed(3);
    if (lo > 0.01) linesEl.firstChild.style.transform = `rotate(${((Math.floor(t * 24) * 37) % 360)}deg)`;
    await Promise.all(waits);
  }

  cues.sort((p, q) => p.t - q.t);
  return { duration, seek, cues, loops, beat: BEAT, bpm: 60 / BEAT, music: cut.music, track: cut.track || 'game', version };
}

// ------------------------------------------------------------------ art made for the film
function sparkleSVG(size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100"><path d="M50 4C54 36 64 46 96 50C64 54 54 64 50 96C46 64 36 54 4 50C36 46 46 36 50 4Z" fill="#fff6b8" stroke="#2a1236" stroke-width="5" stroke-linejoin="round"/></svg>`;
}

// anime focus lines around the centre of the frame (shown on big hits)
function speedLinesSVG() {
  const rng = createRng(1234);
  let d = '';
  for (let i = 0; i < 90; i++) {
    const a = rng.range(0, Math.PI * 2);
    const w = rng.range(0.004, 0.014);
    const r0 = rng.range(430, 640);
    const r1 = 1800;
    const p = (r, aa) => `${(1100 + Math.cos(aa) * r).toFixed(1)} ${(1100 + Math.sin(aa) * r).toFixed(1)}`;
    d += `M${p(r0, a)}L${p(r1, a - w)}L${p(r1, a + w)}Z`;
  }
  return `<svg width="2200" height="2200" viewBox="0 0 2200 2200" style="left:-560px;top:-200px;transform-origin:1100px 1100px"><path d="${d}" fill="#ffffff"/></svg>`;
}

const CONFETTI = ['#ff3d8b', '#ffb627', '#18c2c9', '#2fbf71', '#ffffff', '#9b4fc4'];
function confettiBurst(root, { n, seed, x, y, t0 }) {
  return new Burst(root, {
    n, seed, x, y, t0, speed: [900, 2300], angle: [-175, -5], gravity: 1700, drag: 2.4, life: [1.4, 2.2], scale: [0.7, 1.3], spin: [-720, 720], flip: true,
    html: (i, rng) => `<div style="width:${Math.round(rng.range(18, 30))}px;height:${Math.round(rng.range(30, 46))}px;border-radius:5px;background:${CONFETTI[i % CONFETTI.length]};border:3px solid #2a1236"></div>`,
  });
}

// the marble counter top the guest stands behind
function counterBandSVG() {
  return '<svg width="1180" height="190" viewBox="0 0 1180 190">' +
    '<defs><linearGradient id="pc-top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e9e4ee"/></linearGradient>' +
    '<linearGradient id="pc-front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9a26b"/><stop offset="1" stop-color="#a8682f"/></linearGradient></defs>' +
    '<rect x="0" y="40" width="1180" height="150" fill="url(#pc-front)" stroke="#2a1236" stroke-width="6"/>' +
    [...Array(12)].map((_, i) => `<rect x="${12 + i * 98}" y="40" width="10" height="150" fill="#8e4f22" opacity=".35"/>`).join('') +
    '<rect x="-10" y="0" width="1200" height="58" rx="22" fill="url(#pc-top)" stroke="#2a1236" stroke-width="6"/>' +
    '<path d="M40 20Q300 8 600 18T1140 14" stroke="#cfc6d8" stroke-width="3" fill="none" opacity=".7"/></svg>';
}

// the order bubble of a guest: base, fruits & crunch, toppings and the patience bar
function orderBubble(order) {
  const ic = (id) => ingredientIcon(id, 92);
  return `<div class="bubble"><div class="bubble-row">` +
    `<span class="bubble-num">1</span>${bowlSVG({ base: order.base }, 100)}` +
    `<span class="bubble-num leaf" style="margin-left:14px">2</span>${order.mid.map(ic).join('')}` +
    `</div><div class="bubble-row"><span class="bubble-num pink">3</span>${order.top.map(ic).join('')}` +
    `<div class="pbar" style="width:250px;margin-left:24px"><div class="pbar-fill" style="width:100%"></div></div></div></div>`;
}
