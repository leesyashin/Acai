// TikTok-style pieces for the fast motion films (tools/promo/film-*.js): captions that pop in word by
// word like CapCut's, emoji explosions and the sticker in TikTok's own text style. Like kit.js, each is
// built once and then set to a moment in time.

import { createRng } from '../../js/rng.js';
import { lerp, spring } from './motion.js';
import { Sprite, Burst } from './kit.js';

// Words shown one after another in the middle of the frame: [[t0, t1, text, colour], …] in scene time,
// colour '' (white), 'y' (yellow), 'g' (green), 'p' (pink) or 'c' (cyan). Each word slams in from big
// and is cut, not faded, when the next one comes.
export function capWords(root, words, { y = 1250, size = 108 } = {}) {
  const rng = createRng(words.length * 31 + size);
  const ws = words.map(([t0, t1, text, col = '']) => ({
    t0, t1, r: rng.range(-4, 4), sp: new Sprite(root, `<div class="capw ${col}" style="font-size:${size}px">${text}</div>`),
  }));
  return (lt, dy = 0) => ws.forEach((w) => {
    if (lt < w.t0 || lt >= w.t1) return w.sp.hide();
    const k = lt - w.t0;
    const s = k < 0.06 ? lerp(1.5, 0.94, k / 0.06) : 0.94 + 0.06 * spring(k - 0.06, 4, 12);
    return w.sp.set({ x: 540, y: y + dy, s, r: w.r });
  });
}

// A burst of emojis thrown from (x, y) at t0 (scene time).
export function emojiBurst(root, { emojis = ['🔥'], x = 540, y = 960, t0 = 0, n = 10, seed = 1, size = 96, speed = [700, 1500], gravity = 1400 } = {}) {
  return new Burst(root, {
    n, seed, x, y, t0, speed, gravity, drag: 2, life: [0.8, 1.3], scale: [0.7, 1.25], spin: [-200, 200], angle: [-170, -10],
    html: (i) => `<span class="emo" style="font-size:${size}px">${emojis[i % emojis.length]}</span>`,
  });
}

// TikTok's text sticker (one rounded box per line); cls 'dark' for white on black.
export const sticker = (root, lines, cls = '') => new Sprite(root, `<div class="tk ${cls}">${lines.map((l) => `<span>${l}</span>`).join('<br>')}</div>`);
