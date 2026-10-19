// The 'journey' promo film (tools/promo, ?version=journey): one ride up the game's level map. The pin
// drops onto level 1 on the beach and hops from level to level – each one turns gold and gets its
// stars – through every region of the map (their names slam in as the pin arrives), up to the last
// level, where fireworks go off: "60 levels · 6 worlds". Built from the map's own art (js/art-map.js),
// so it follows the map: the number of levels and regions comes from MAP_REGIONS. 124 BPM, a new
// section of the music for every region.

import { logoSVG, bowlSVG, starSVG, mapRegionSVG, mapLevelPos, mapRoadData, MAP_H, MAP_BLEED, MAP_REGIONS } from '../../js/art.js';
import { createRng } from '../../js/rng.js';
import { clamp, lerp, prog, ease, spring, jiggle, decay } from './motion.js';
import { Sprite, Title, Burst, Ring, div } from './kit.js';

const COPY = {
  de: {
    intro: 'WIE WEIT\nKOMMST DU?',
    go: ['Level 1 – los geht\'s 🚀'],
    regions: { beach: 'AM STRAND', town: 'STADTPROMENADE', forest: 'REGENWALD', tea: 'TEEPLANTAGE', harbor: 'HAFEN', night: 'NACHTMARKT' },
    range: (a, z) => `Level ${a}–${z}`,
    level: 'LEVEL',
    levels: (n) => `${n} LEVEL`,
    worlds: (n) => `${n} WELTEN`,
    dare: ['schaffst du alle? 👀'],
    play: 'JETZT SPIELEN',
    free: ['kostenlos im Browser · Link in Bio'],
    url: 'leesyashin.github.io/Acai',
  },
  en: {
    intro: 'HOW FAR\nCAN YOU GO?',
    go: ['level 1 – let\'s go 🚀'],
    regions: { beach: 'ON THE BEACH', town: 'TOWN PROMENADE', forest: 'RAINFOREST', tea: 'TEA PLANTATION', harbor: 'HARBOUR', night: 'NIGHT MARKET' },
    range: (a, z) => `Levels ${a}–${z}`,
    level: 'LEVEL',
    levels: (n) => `${n} LEVELS`,
    worlds: (n) => `${n} WORLDS`,
    dare: ['can you beat them all? 👀'],
    play: 'PLAY NOW',
    free: ['free in your browser · link in bio'],
    url: 'leesyashin.github.io/Acai',
  },
};
const FILL = { beach: 'mango', town: 'pink', forest: 'leaf', tea: 'white', harbor: 'lagoon', night: 'red' };

// the timing (beats): the intro, one section per region, the fireworks and the end card
const REGIONS = MAP_REGIONS;
const LEVELS = REGIONS[REGIONS.length - 1].last;
const INTRO = 8;
const PER = REGIONS.length <= 3 ? 8 : 4;
const FINALE = 8;
const END = 8;

function music() {
  const bars = [{ style: 'intro', g: 12, lead: false }, { style: 'tension', chords: ['Am', 'E7'], mel: null }];
  let g = 0;
  REGIONS.forEach((_, k) => {
    for (let j = 0; j < PER / 4; j++) {
      bars.push({ style: j === 0 ? 'drop' : 'groove', g: g % 12, harmony: k >= 2, fill: k === REGIONS.length - 1 && j === PER / 4 - 1 });
      g++;
    }
  });
  bars.push({ style: 'drop', g: 12, harmony: true }, { style: 'groove', g: 13, harmony: true, fill: true });
  bars.push({ style: 'groove', chords: ['Dm7', 'G7'], mel: 15, harmony: true, fill: true }, { style: 'end' });
  return bars;
}

export const CUTS = {
  journey: {
    theme: 'map',
    energy: 0.9,
    scenes: [['jrRide', INTRO + REGIONS.length * PER + FINALE + END, { enter: null }]],
    music: music(),
  },
};

const ZOOM = 1.45; // map px → frame px on the ride
const PIN_Y = 1180; // where the pin sits in the frame
const FULL_W = 1280 + 2 * MAP_BLEED;

// TikTok's text sticker (one rounded box per line)
const sticker = (root, lines, cls = '') => new Sprite(root, `<div class="tk ${cls}">${lines.map((l) => `<span>${l}</span>`).join('<br>')}</div>`);

// the pin's place for a level position p (0 = level 1; between two levels on the road's sine)
const posAt = (p) => ({ x: 640 + 280 * Math.sin(0.9 * p - 0.3), y: mapLevelPos(0).y - p * (mapLevelPos(0).y - mapLevelPos(1).y) });

export function scenes({ lang, b, cue, fx, popIn, confettiBurst, PLAY_ICON }) {
  const C = COPY[lang] || COPY.de;
  const S = {};

  S.jrRide = (root, from, to) => {
    const T0 = b(INTRO);
    const regionAt = (k) => T0 + b(k * PER);
    const TF = regionAt(REGIONS.length); // the last level is reached: fireworks
    const TE = TF + b(FINALE); // the end card

    // ---- the map: regions, the road, the level nodes and the pin, in map px under one transform
    const map = div(root, 'jr-map');
    map.style.width = `${FULL_W}px`;
    map.style.height = `${MAP_H}px`;
    const regionEls = REGIONS.map((r) => {
      const el = div(map, 'jr-region', mapRegionSVG(r.id));
      el.style.top = `${r.top}px`;
      el.style.height = `${r.bottom - r.top}px`;
      return { el, r, shown: true };
    });
    const road = mapRoadData(LEVELS);
    map.insertAdjacentHTML('beforeend', `<svg class="jr-road" width="${FULL_W}" height="${MAP_H}" viewBox="${-MAP_BLEED} 0 ${FULL_W} ${MAP_H}">` +
      `<path class="shadow" d="${road}"/><path class="edge" d="${road}"/><path class="road" d="${road}"/><path class="done" d="${road}"/><path class="dots" d="${road}"/></svg>`);
    const donePath = map.querySelector('.jr-road .done');
    // the road's length up to each level (the done stretch grows with the pin)
    const total = donePath.getTotalLength();
    const upTo = [];
    {
      const probe = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      map.querySelector('.jr-road').append(probe);
      for (let i = 1; i <= LEVELS; i++) {
        probe.setAttribute('d', mapRoadData(i));
        upTo.push(probe.getTotalLength());
      }
      probe.remove();
    }
    donePath.style.strokeDasharray = `${total} ${total}`;
    const stars3 = starSVG(true, 30).repeat(3);
    const nodes = [];
    for (let i = 0; i < LEVELS; i++) {
      const { x, y } = mapLevelPos(i);
      const el = div(map, 'jr-node', `<div class="jr-disc"><span class="jr-num">${i + 1}</span></div><div class="jr-stars">${stars3}</div>`);
      el.style.left = `${x + MAP_BLEED}px`;
      el.style.top = `${y}px`;
      nodes.push({ el, stars: el.querySelector('.jr-stars'), disc: el.querySelector('.jr-disc'), state: '', y });
    }
    const pin = new Sprite(map, `<div class="jr-pin">${bowlSVG({ base: 'acai', mid: ['banana', 'strawberry'], top: ['honey'] }, 66)}</div>`);
    const dark = new Sprite(root, '<div class="jr-dark"></div>');

    // ---- the pin's level position over time: drops onto level 1, then through each region
    const TD = b(2); // the pin lands
    const pAt = (lt) => {
      if (lt < T0) return 0;
      if (lt >= TF) return LEVELS - 1;
      const k = Math.min(REGIONS.length - 1, Math.floor((lt - T0) / b(PER)));
      const r = REGIONS[k];
      const hops = k === REGIONS.length - 1 ? r.last - r.first : r.last - r.first + 1;
      const start = regionAt(k) + b(0.35); // a beat's rest for the region's name to land
      return r.first - 1 + hops * clamp((lt - start) / (regionAt(k + 1) - start - b(0.1)));
    };
    // when the pin lands on each level
    const landing = [];
    for (let i = 1; i < LEVELS; i++) {
      let lo = T0;
      let hi = TF;
      for (let n = 0; n < 40; n++) {
        const mid = (lo + hi) / 2;
        if (pAt(mid) >= i) hi = mid;
        else lo = mid;
      }
      landing[i] = hi;
    }
    landing[0] = TD;

    // ---- overlays: titles, the level counter, fireworks, the end card
    const intro = new Title(root, C.intro, { size: 150, fill: 'white' });
    const go = sticker(root, C.go);
    const banners = REGIONS.map((r) => ({
      title: new Title(root, C.regions[r.id] || r.id.toUpperCase(), { size: 124, fill: FILL[r.id] || 'white' }),
      range: new Sprite(root, `<div class="jr-banner">${C.range(r.first, r.last)}</div>`),
    }));
    const hud = new Sprite(root, `<div class="jr-hud">${starSVG(true, 64)}<small>${C.level}</small><span class="n">1</span></div>`);
    const hudN = hud.in.querySelector('.n');
    const levelsT = new Title(root, C.levels(LEVELS), { size: 190, fill: 'mango' });
    const worldsT = new Title(root, C.worlds(REGIONS.length), { size: 124, fill: 'lagoon' });
    const dare = sticker(root, C.dare);
    const rng = createRng(17);
    const COLS = ['#ff3d8b', '#ffd23f', '#18c2c9', '#2fbf71', '#ffffff', '#c38bff'];
    const fireworks = [0, 1, 2, 2.5, 3, 4, 4.5, 5.5, 6.5, 7].map((bt, i) => {
      const x = rng.range(180, 900);
      const y = rng.range(260, 900);
      const col = COLS[i % COLS.length];
      const t0 = TF + b(bt);
      cue(from + t0 - 0.4, 'firework', { gain: 0.55 });
      return {
        burst: new Burst(root, {
          n: 22, seed: 300 + i, x, y, t0, speed: [500, 900], gravity: 260, drag: 1.6, life: [0.9, 1.4], scale: [0.6, 1.1], spin: [0, 0],
          html: () => `<div class="spark" style="background:${col};box-shadow:0 0 18px 6px ${col}"></div>`,
        }),
        ring: new Ring(root, { x, y, t0, size: 520, dur: 0.5, color: col, width: 12 }),
      };
    });
    const confetti = confettiBurst(root, { n: 60, seed: 61, x: 540, y: 700, t0: TF + 0.02 });
    const logo = new Sprite(root, logoSVG(860));
    const btn = new Sprite(root, `<div class="play-btn">${PLAY_ICON}<span>${C.play}</span></div>`);
    const free = sticker(root, C.free, 'dark');
    const url = new Sprite(root, `<div class="url">${C.url}</div>`);

    // ---- sounds and hits
    cue(from + 0.05, 'whoosh', { gain: 0.5 });
    cue(from + TD - 0.25, 'swish', { gain: 0.4 });
    cue(from + TD, 'thud', { gain: 0.8 });
    cue(from + TD + 0.02, 'drop', { kind: 'sfx' });
    fx.shake(from + TD, 18, 8);
    cue(from + b(INTRO - 4), 'riser', { len: b(4), gain: 0.7 });
    for (let i = 1; i < LEVELS; i++) {
      const r = REGIONS.findIndex((x) => i + 1 >= x.first && i + 1 <= x.last);
      const first = REGIONS[r].first - 1 === i;
      if (!first) cue(from + landing[i], 'pop', { gain: 0.22, pitch: (i - REGIONS[r].first + 1) % 10 });
    }
    REGIONS.forEach((_, k) => {
      const t = from + regionAt(k);
      cue(t, k ? 'impact' : 'stamp', { gain: 0.75 });
      cue(t + b(PER) - 0.22, 'whoosh', { gain: 0.35 });
      fx.flash(t, 0.35, 10);
      fx.punch(t, 0.04, 9);
    });
    cue(from + TF, 'win', { kind: 'sfx', gain: 0.8 });
    cue(from + TF + 0.02, 'confetti', { gain: 0.8 });
    fx.flash(from + TF, 0.7, 8);
    fx.shake(from + TF, 26, 6);
    cue(from + TE, 'impact', { gain: 0.9 });
    cue(from + TE + b(2), 'click', { kind: 'sfx' });
    fx.flash(from + TE, 0.6, 9);

    let lastTf = '';
    return {
      from, to,
      update(lt) {
        const p = pAt(lt);
        const pos = posAt(p);
        // the camera: on the beach for the intro, then with the pin; wide over the finale
        const wide = ease.inOutCubic(prog(lt, TF - b(1), TF + b(2)));
        const Z = lerp(lerp(1.3, ZOOM, ease.inOutCubic(prog(lt, b(3), T0))), 0.9, wide);
        const camY = pos.y - (PIN_Y - 960) / Z;
        const cy = clamp(camY, 960 / Z, MAP_H - 960 / Z);
        const cx = 640 + MAP_BLEED;
        const tf = `translate(${(540 - cx * Z).toFixed(1)}px,${(960 - cy * Z).toFixed(1)}px) scale(${Z.toFixed(4)})`;
        if (tf !== lastTf) map.style.transform = lastTf = tf;
        // only the regions in view are drawn
        const top = cy - 1000 / Z;
        const bottom = cy + 1000 / Z;
        regionEls.forEach((rg) => {
          const show = rg.r.bottom > top && rg.r.top < bottom;
          if (show !== rg.shown) {
            rg.el.style.display = show ? '' : 'none';
            rg.shown = show;
          }
        });
        // levels the pin has reached turn gold and get their stars
        nodes.forEach((nd, i) => {
          const visible = nd.y > top - 200 && nd.y < bottom + 200;
          if (!visible) {
            if (nd.state !== 'hidden') nd.el.style.display = 'none';
            nd.state = 'hidden';
            return;
          }
          const reached = lt >= landing[i];
          const k = reached ? lt - landing[i] : -1;
          const state = reached ? (k < 0.5 ? `pop${Math.round(k * 60)}` : 'done') : 'open';
          if (state === nd.state) return;
          if (nd.state === 'hidden') nd.el.style.display = '';
          nd.state = state;
          nd.el.classList.toggle('done', reached);
          const sp = reached ? spring(k, 3, 8) : 0;
          nd.stars.style.opacity = reached ? '1' : '0';
          nd.stars.style.transform = `translateX(-50%) scale(${(0.3 + 0.7 * Math.min(1.2, sp)).toFixed(3)})`;
          nd.disc.style.transform = reached ? `scale(${(1 + 0.25 * jiggle(k, 3, 7)).toFixed(3)})` : '';
        });
        const idx = Math.floor(p);
        const frac = p - idx;
        const len = lt < TD ? 0 : lerp(upTo[idx], upTo[Math.min(LEVELS - 1, idx + 1)], frac);
        donePath.style.strokeDashoffset = (total - len).toFixed(1);
        // the pin: falls onto level 1, then hops along the road
        const hop = Math.sin(Math.PI * frac) * 60;
        const fall = lt < TD ? ease.inQuad(prog(lt, b(0.6), TD)) : 1;
        const sq = jiggle(lt - (landing[Math.round(p)] || 0), 4, 9) * 0.12;
        pin.set({ x: pos.x + MAP_BLEED, y: pos.y - 70 - hop - (1 - fall) * 1100, s: 1.35, sx: 1 + sq, sy: 1 - sq, o: lt > b(0.6) ? 1 : 0 });

        // the intro title, then each region's name as the pin arrives
        intro.sprite.set({ x: 540, y: 470 });
        intro.pop(lt - 0.1, { stagger: 0.03, out: T0 - b(1) - 0.1, outDur: 0.2 });
        const gp = popIn(lt - TD - 0.1, { f: 2.4, d: 8 });
        go.set({ x: 540, y: 690 + gp.dy, s: gp.s, r: -2, o: gp.o * (1 - prog(lt, T0 - b(0.5), T0)) });
        banners.forEach((bn, k) => {
          const t0 = regionAt(k);
          const until = (k === REGIONS.length - 1 ? TF : regionAt(k + 1)) - 0.05;
          if (lt < t0 - 0.05 || lt > until) {
            bn.title.sprite.hide();
            bn.range.hide();
            return;
          }
          const q = lt - t0;
          const sl = q < 0.09 ? lerp(2.2, 0.94, ease.inQuad(clamp(q / 0.09))) : 0.94 + 0.06 * spring(q - 0.09, 3, 8);
          const out = ease.inBack(prog(lt, until - 0.2, until));
          bn.title.sprite.set({ x: 540, y: 420 - out * 300, s: sl * (1 - out * 0.3), r: k % 2 ? 2 : -2, o: clamp(q / 0.04) * (1 - out) });
          bn.title.rest();
          const rp = popIn(q - 0.12, { f: 2.6, d: 8 });
          bn.range.set({ x: 540, y: 560 + rp.dy - out * 300, s: rp.s * 1.2, o: rp.o * (1 - out) });
        });
        // the level counter
        const lv = Math.min(LEVELS, 1 + Math.floor(p + 1e-6));
        if (hudN.textContent !== String(lv)) hudN.textContent = String(lv);
        const hp = popIn(lt - TD - 0.2, { f: 2.4, d: 8 });
        const hOut = ease.inBack(prog(lt, TF, TF + 0.25));
        const lastLand = landing[Math.min(LEVELS - 1, Math.floor(p + 1e-6))] || 0;
        hud.set({ x: 540, y: 245 + hp.dy - hOut * 300, s: hp.s * (1 + 0.08 * decay(lt - lastLand, 12)), o: hp.o * (1 - hOut) });

        // the finale: fireworks, the numbers, then the end card over the darkened map
        fireworks.forEach((fw) => {
          fw.burst.update(lt);
          fw.ring.update(lt);
        });
        confetti.update(lt);
        const fo = ease.inBack(prog(lt, TE - 0.25, TE));
        const q1 = lt - TF;
        const sl1 = q1 < 0.1 ? lerp(2.6, 0.94, ease.inQuad(clamp(q1 / 0.1))) : 0.94 + 0.06 * spring(q1 - 0.1, 2.6, 7);
        levelsT.sprite.set({ x: 540, y: 420 - fo * 400, s: sl1, r: -3, o: (q1 > 0 ? 1 : 0) * (1 - fo) });
        levelsT.rest();
        worldsT.sprite.set({ x: 540, y: 610 - fo * 400, o: 1 - fo });
        worldsT.pop(lt - TF - b(1), { stagger: 0.03 });
        const dp = popIn(lt - TF - b(2), { f: 2.4, d: 8 });
        dare.set({ x: 540, y: 790 + dp.dy - fo * 400, s: dp.s, r: 2, o: dp.o * (1 - fo) });
        dark.set({ x: 540, y: 960, o: ease.inOutQuad(prog(lt, TE - b(0.5), TE + b(0.5))) });
        const q2 = lt - TE;
        const sl2 = q2 < 0.11 ? lerp(3, 0.92, ease.inQuad(clamp(q2 / 0.11))) : 0.92 + 0.08 * spring(q2 - 0.11, 2.2, 5.5);
        logo.set({ x: 540, y: 520 + Math.sin(lt * 2.6) * 8, s: sl2, r: -8 + Math.sin(lt * 2) * 1.2, o: q2 > 0 ? 1 : 0 });
        const bp = popIn(lt - TE - b(1), { f: 2.2, d: 6 });
        const tap = Math.max(0, 1 - Math.abs(lt - TE - b(2)) / 0.12);
        btn.set({ x: 540, y: 960 + bp.dy + tap * 10, s: bp.s * (1 - tap * 0.05), o: bp.o });
        const fp = popIn(lt - TE - b(1.75));
        free.set({ x: 540, y: 1160 + fp.dy, s: fp.s, o: fp.o });
        const up = popIn(lt - TE - b(2.5), { f: 2.4, d: 7 });
        url.set({ x: 540, y: 1300 + up.dy, s: up.s, r: -2, o: up.o });
      },
    };
  };

  return S;
}
