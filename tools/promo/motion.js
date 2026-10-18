// Motion helpers for the promo video (tools/promo): easing curves, keyframes, springs and a
// deterministic wobble. Everything is a pure function of time, so any frame can be drawn on its
// own and in any order – the renderer seeks frame by frame.

export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, k) => a + (b - a) * k;
// 0 before t0, 1 after t1, linear in between
export const prog = (t, t0, t1) => clamp((t - t0) / (t1 - t0));

const C1 = 1.70158;
export const ease = {
  lin: (x) => x,
  inQuad: (x) => x * x,
  outQuad: (x) => 1 - (1 - x) * (1 - x),
  inOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2),
  inCubic: (x) => x ** 3,
  outCubic: (x) => 1 - (1 - x) ** 3,
  inOutCubic: (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2),
  inQuart: (x) => x ** 4,
  outQuart: (x) => 1 - (1 - x) ** 4,
  inExpo: (x) => (x <= 0 ? 0 : 2 ** (10 * x - 10)),
  outExpo: (x) => (x >= 1 ? 1 : 1 - 2 ** (-10 * x)),
  inOutExpo: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 2 ** (20 * x - 10) / 2 : (2 - 2 ** (-20 * x + 10)) / 2),
  outBack: (x) => 1 + (C1 + 1) * (x - 1) ** 3 + C1 * (x - 1) ** 2,
  outBackBig: (x) => 1 + 3.6 * (x - 1) ** 3 + 2.6 * (x - 1) ** 2,
  inBack: (x) => (C1 + 1) * x ** 3 - C1 * x ** 2,
  outElastic: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};

// a → b between t0 and t1
export const tween = (t, t0, t1, a, b, e = ease.outCubic) => lerp(a, b, e(prog(t, t0, t1)));

// Keyframes [[t, value], [t, value, ease], …]: the ease of a key shapes the segment ending at it.
export function kf(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, e = ease.outCubic] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      return lerp(v0, v1, e(prog(t, t0, t1)));
    }
  }
  return keys[keys.length - 1][1];
}

// Damped spring from 0 to 1 that starts at t = 0: overshoots and settles (pops, landings).
export function spring(t, freq = 2.6, damp = 7) {
  if (t <= 0) return 0;
  return 1 - Math.exp(-damp * t) * Math.cos(2 * Math.PI * freq * t);
}

// A decaying wiggle around 0 that starts at t = 0 (squash and stretch after an impact).
export function jiggle(t, freq = 5, damp = 9) {
  if (t <= 0) return 0;
  return Math.exp(-damp * t) * Math.sin(2 * Math.PI * freq * t);
}

// 1 at t = 0, fading to 0 (0 before t = 0)
export const decay = (t, k = 8) => (t < 0 ? 0 : Math.exp(-k * t));

// 0 → 1 → 0 bump between t0 and t1
export const bump = (t, t0, t1) => {
  const x = prog(t, t0, t1);
  return x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x);
};

// Smooth deterministic noise in about [-1, 1] (camera shake, floating): incommensurate sines.
export function wob(t, seed = 0) {
  return Math.sin(t * 37.1 + seed * 1.7) * 0.5 + Math.sin(t * 23.3 + seed * 4.1) * 0.3 + Math.sin(t * 61.7 + seed * 2.9) * 0.2;
}

// Quadratic Bézier point (arcs of things thrown or dragged)
export function arc(k, [x0, y0], [cx, cy], [x1, y1]) {
  const u = 1 - k;
  return [u * u * x0 + 2 * u * k * cx + k * k * x1, u * u * y0 + 2 * u * k * cy + k * k * y1];
}
