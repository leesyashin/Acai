// 3D models of the kitchen appliances: the blender (4 motor bases × 2 jugs, one per upgrade
// level), the matcha machine (1 or 2 slots), the pedal bin and the chest freezer; the
// ingredient containers on the risers come from js/pantry3d.js (the view 'pantry').
// Pure module: every *Scene() returns { frame, elev, time, items } for js/gl3d.js – nothing here
// touches the DOM. Geometry is in stage pixels, the floor is y = 0 and +z points at the player.
// Animations are functions of the state and the time t (seconds), so a scene can be drawn at
// any moment (a paused game simply stops passing new times).

import {
  MODE, material, lathe, flute, sectionArc, roundedBox, tube, sphere, cylinder, plane, polarSurface, updateSurface, merge, section,
  spline, compose, translation, scaling, rotationX, rotationY, rotationZ, rotationAbout, identity, screenOf, transformPoint,
} from './geo3d.js';
import { ING } from './data.js';
import { mix, rngFor } from './svg.js';
import { pureeOf, MATCHA_COLORS, MATCHA_MILK } from './art-food.js';
import { pantryScene, PANTRY_VIEW } from './pantry3d.js';

// The camera looks down at the worktop by 17° – the angle the cup rims are drawn with.
export const ELEV = (17 * Math.PI) / 180;

// Canvas of each view in CSS px (stage px) and where the world origin (floor centre under the
// appliance) sits in it. The game places the canvases with the same numbers (css/game.css).
// The appliances are about twice as tall as a cup on the counter (cups are 120 px boxes).
// pic (optional): the rows of the canvas a menu picture shows (fitFrame).
export const VIEWS = {
  // no zoom of its own: each model gets the one that makes it as tall as the others (blenderZoom);
  // headroom above the jug for the lid an overflowing blender lifts and its foam, room on the left
  // for the tilted lid and on the right for the handle; the menu pictures leave most of the
  // headroom out, so their blender stays as big as the square allows
  blender: { w: 164, h: 292, ax: 72, ay: 260, pic: { y: 26, h: 266 } },
  machine: { w: 312, h: 312, ax: 156, ay: 268, zoom: 312 / 236 },
  trash: { w: 153, h: 209, ax: 76.5, ay: 191, zoom: 1.35 },
  // the freezer's origin is the floor of its well (FREEZER_ELEV, a gentle perspective)
  // (the canvas ends at the worktop's front edge, the frame's front face reaches past it)
  freezer: { w: 284, h: 194, ax: 142, ay: 142, zoom: 0.99 },
  // an ingredient container on its riser (js/pantry3d.js): a static picture, drawn once
  pantry: PANTRY_VIEW,
};

// The frame of a view (its pic rows) scaled to fit a size×size square (shop and menu pictures).
export function fitFrame(frame, size) {
  const h = frame.pic ? frame.pic.h : frame.h;
  const ay = frame.pic ? frame.ay - frame.pic.y : frame.ay;
  const k = size / Math.max(frame.w, h);
  return {
    w: size,
    h: size,
    ax: frame.ax * k + (size - frame.w * k) / 2,
    ay: ay * k + (size - h * k) / 2,
    zoom: (frame.zoom || 1) * k,
  };
}

const I = identity();
const cache = new Map();
function once(key, build) {
  let v = cache.get(key);
  if (v === undefined) {
    v = build();
    cache.set(key, v);
  }
  return v;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const item = (mesh, mat, m = I, pass = 'opaque', order = 0) => ({ mesh, mat, m, pass, order });
const at = translation;

// ------------------------------------------------------------------ materials
const MAT = {
  steelV: material({ color: '#c3c9cf', metal: 1, rough: 0.3, mode: MODE.BRUSHED, p: [0.8, 1, 0, 0] }),
  chrome: material({ color: '#eef1f4', metal: 1, rough: 0.08 }),
  blackGloss: material({ color: '#17181c', rough: 0.2, coat: 0.8 }),
  blackSatin: material({ color: '#1e1f24', rough: 0.42, coat: 0.25 }),
  blackKnurl: material({ color: '#202126', rough: 0.45, coat: 0.3, mode: MODE.KNURL, p: [36, 0, 0, 0] }),
  rubber: material({ color: '#1b1c20', rough: 0.88 }),
  white: material({ color: '#f3f0ea', rough: 0.3, coat: 0.55 }),
  gray: material({ color: '#8f969d', rough: 0.36, coat: 0.3 }),
  purple: material({ color: '#4b1f72', metal: 0.5, rough: 0.3, coat: 1 }),
  graphite: material({ color: '#2d3036', metal: 0.35, rough: 0.36, coat: 0.55 }),
  panelGlass: material({ color: '#0b0d10', rough: 0.12, coat: 1 }),
  ledOff: material({ color: '#3a3d44', rough: 0.25, coat: 0.6 }),
  bladeSteel: material({ color: '#d6dce1', metal: 1, rough: 0.18 }),
  wing: material({ color: '#e8f4ff', alpha: 0.22, rough: 0.1, glass: true, double: true }),
  clearHandle: material({ color: '#dcedf3', alpha: 0.13, rough: 0.05, glass: true, double: true }),
  lid: material({ color: '#0f1013', rough: 0.82, coat: 0 }),
  capGlass: material({ color: '#e6f2f6', alpha: 0.12, rough: 0.08, glass: true, double: true, mode: MODE.FROST, p: [0.16, 0.35, 0, 0] }),
};

const LED = {
  green: material({ color: '#1fd65a', emit: '#2bff62', glow: 2.2, rough: 0.2, coat: 1 }),
  red: material({ color: '#ff3b3b', emit: '#ff4a4a', glow: 2.4, rough: 0.2, coat: 1 }),
  amber: material({ color: '#ffb000', emit: '#ffbe3b', glow: 2.2, rough: 0.2, coat: 1 }),
  cyan: material({ color: '#27d9ff', emit: '#5ae9ff', glow: 2.4, rough: 0.2, coat: 1 }),
  white: material({ color: '#ffffff', emit: '#f4f8ff', glow: 2.4, rough: 0.2, coat: 1 }),
};
const glowMat = (hex, a = 0.8, k = 2.2) => once(`glow|${hex}|${a}|${k}`, () => material({ mode: MODE.GLOW, emit: hex, glow: k, alpha: a }));

function shadow(hw, hd, r, blur, alpha = 0.55, m = I) {
  const mesh = once(`shadow-plane|${hw}|${hd}|${blur}`, () => plane((hw + blur) * 2.2, (hd + blur) * 2.2, { up: true }));
  const mat = once(`shadow|${hw}|${hd}|${r}|${blur}|${alpha}`, () => material({ mode: MODE.SHADOW, alpha, p: [hw, hd, r, blur] }));
  return item(mesh, mat, compose(m, at(0, 0.05, 0)), 'shadow');
}

// Small round glow sprite facing the camera (LED halos) or lying on the floor; sy squashes it into a
// flat oval (a light line's halo).
function glow(hex, x, y, z, r, a = 0.8, { floor = false, k = 2.2, sy = 1 } = {}) {
  const mesh = once(`glow-plane|${floor}`, () => plane(2, 2, { up: floor }));
  return item(mesh, glowMat(hex, a, k), compose(at(x, y, z), floor ? I : rotationX(-ELEV), scaling(r, r * sy, r)), 'glow');
}

// ------------------------------------------------------------------ textures (drawn on a 2D canvas by gl3d.js)
// Seven-segment display. Unlit segments stay faintly visible like on a real display.
const SEG = {
  0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
  '-': 'g', C: 'adef', E: 'adefg', F: 'aefg', P: 'abefg', r: 'eg', o: 'cdeg', ' ': '',
};

function drawSegments(ctx, ch, x, y, w, h, th, color, dim) {
  const bar = (x1, y1, x2, y2) => {
    const horiz = Math.abs(y2 - y1) < 1e-6;
    const t = th / 2;
    ctx.beginPath();
    if (horiz) {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + t, y1 - t);
      ctx.lineTo(x2 - t, y1 - t);
      ctx.lineTo(x2, y1);
      ctx.lineTo(x2 - t, y1 + t);
      ctx.lineTo(x1 + t, y1 + t);
    } else {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + t, y1 + t);
      ctx.lineTo(x1 + t, y2 - t);
      ctx.lineTo(x1, y2);
      ctx.lineTo(x1 - t, y2 - t);
      ctx.lineTo(x1 - t, y1 + t);
    }
    ctx.closePath();
    ctx.fill();
  };
  const g = th * 0.35;
  const m = y + h / 2;
  const segs = {
    a: () => bar(x + g, y, x + w - g, y),
    b: () => bar(x + w, y + g, x + w, m - g),
    c: () => bar(x + w, m + g, x + w, y + h - g),
    d: () => bar(x + g, y + h, x + w - g, y + h),
    e: () => bar(x, m + g, x, y + h - g),
    f: () => bar(x, y + g, x, m - g),
    g: () => bar(x + g, m, x + w - g, m),
  };
  ctx.fillStyle = dim;
  for (const s of 'abcdefg') segs[s]();
  ctx.fillStyle = color;
  for (const s of SEG[ch] ?? '') segs[s]();
}

// bg null: only the digits (a decal on black glass), no screen and no glass reflection of its own.
function segmentTexture(text, color = '#5ff2ff', { w = 160, h = 64, bg = '#05080b' } = {}) {
  return {
    key: `seg|${text}|${color}|${w}|${h}|${bg}`,
    w,
    h,
    draw(ctx) {
      if (bg) {
        const grd = ctx.createLinearGradient(0, 0, 0, h);
        grd.addColorStop(0, bg);
        grd.addColorStop(1, '#000000');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);
      } else {
        ctx.clearRect(0, 0, w, h);
      }
      const cells = [...text];
      const cw = Math.min((30 * h) / 64, (w - 16) / Math.max(1, cells.filter((c) => c !== ':' && c !== '.').length + 0.3));
      const dh = h * 0.62;
      const th = Math.max(3, cw * 0.2);
      let x = (w - cells.reduce((s, c) => s + (c === ':' || c === '.' ? cw * 0.45 : c === '°' ? cw * 0.6 : cw * 1.25), 0)) / 2 + cw * 0.12;
      const y = (h - dh) / 2;
      ctx.save();
      ctx.transform(1, 0, -0.1, 1, h * 0.05, 0);
      ctx.shadowColor = color;
      ctx.shadowBlur = h * 0.12;
      const dim = 'rgba(120, 150, 160, 0.05)';
      for (const ch of cells) {
        if (ch === ':' || ch === '.') {
          ctx.fillStyle = color;
          const r = th * 0.55;
          if (ch === ':') {
            ctx.beginPath();
            ctx.arc(x + cw * 0.15, y + dh * 0.3, r, 0, Math.PI * 2);
            ctx.arc(x + cw * 0.15, y + dh * 0.72, r, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.arc(x + cw * 0.15, y + dh, r, 0, Math.PI * 2);
            ctx.fill();
          }
          x += cw * 0.45;
        } else if (ch === '°') {
          ctx.strokeStyle = color;
          ctx.lineWidth = th * 0.7;
          ctx.strokeRect(x, y, cw * 0.32, cw * 0.32);
          x += cw * 0.6;
        } else if (ch === '✓') {
          ctx.strokeStyle = color;
          ctx.lineWidth = th * 1.1;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(x + cw * 0.05, y + dh * 0.55);
          ctx.lineTo(x + cw * 0.4, y + dh * 0.9);
          ctx.lineTo(x + cw * 1.05, y + dh * 0.1);
          ctx.stroke();
          x += cw * 1.25;
        } else if (ch === '!') {
          ctx.fillStyle = color;
          ctx.fillRect(x + cw * 0.38, y, th, dh * 0.68);
          ctx.fillRect(x + cw * 0.38, y + dh * 0.84, th, th);
          x += cw * 1.25;
        } else {
          drawSegments(ctx, ch, x, y, cw, dh, th, color, dim);
          x += cw * 1.25;
        }
      }
      ctx.restore();
      if (!bg) return;
      // glass reflection
      const gl = ctx.createLinearGradient(0, 0, w, h);
      gl.addColorStop(0, 'rgba(255,255,255,0.10)');
      gl.addColorStop(0.45, 'rgba(255,255,255,0.03)');
      gl.addColorStop(0.46, 'rgba(255,255,255,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(0, 0, w, h);
    },
  };
}

// Printed model name (white or dark lettering on a transparent background).
function labelTexture(text, color = '#f4f6f8', { w = 256, h = 64, weight = 900, spacing = 0.12 } = {}) {
  return {
    key: `label|${text}|${color}|${w}|${h}|${weight}|${spacing}`,
    w,
    h,
    draw(ctx) {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let fs = h * 0.72;
      ctx.font = `${weight} ${fs}px Nunito, "Trebuchet MS", Arial, sans-serif`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${fs * spacing}px`;
      while (ctx.measureText(text).width > w * 0.94 && fs > 8) {
        fs -= 2;
        ctx.font = `${weight} ${fs}px Nunito, "Trebuchet MS", Arial, sans-serif`;
        if ('letterSpacing' in ctx) ctx.letterSpacing = `${fs * spacing}px`;
      }
      ctx.fillText(text, w / 2, h / 2 + fs * 0.04);
    },
  };
}

const texMat = (tex, glowK = 0, extra = {}) => material({ mode: MODE.TEX, tex, p: [glowK, 0, 0, 0], rough: 0.25, coat: 0.6, ...extra });
// printed lettering: only the letters are drawn (decal pass, alpha from the texture); callers keep
// the material with once()
const labelMat = (text, color, opts) => material({ mode: MODE.TEX, tex: labelTexture(text, color, opts), p: [0, 1, 0, 0], rough: 0.35, coat: 0.3 });

// ==================================================================
// Blender
// ==================================================================
// Modelled on a household stand blender (the reference photo of the overhaul): a fluted glass jug –
// rounded-square plan widening upward, printed scale, a clear handle on the right, the pouring spout
// on the left, a black lid with a clear measuring cap, a black collar and a 4-wing blade – on a tall,
// tapered motor base: a black plinth, a black glass band around its top that dips into a V on the
// front (display, programme icons, the portion LEDs), the big start/stop dial in the middle of the
// front and the brand line under it. One motor base per Turbo-Mixer level, all of this shape:
// 0 Classic (white plastic, a plain knob and LEDs), 1 Turbo (brushed stainless like the photo: a
// countdown display, a chrome dial with ticks), 2 Pro (açaí-purple metallic, an LED ring around the
// dial that fills while blending), 3 Pro Max (graphite with chrome trim, a bigger display and a light
// bar). The big jug upgrade swaps the 2-bowl jug for a taller, wider one (3 bowls).
export const BLENDER_MODELS = ['Classic', 'Turbo', 'Pro', 'Pro Max'];
// The motor base: half widths at the foot (r0) and the top (r1), its height, the plinth, the lower
// edge of the black band (band) and the centre of the dial (dial).
const BASE = { r0: 31, r1: 27, h: 60, sq: 0.8, depth: 0.9, plinth: 3.4, band: 49, dial: 23.5 };
// v: the V of the band on the front (half width, depth below the band's edge); disp: the display
// (size, centre height, colour of the digits); print: the ticks and icons around the dial.
const TIERS = [
  { body: MAT.white, print: '#43474e', brand: '#3d4148', v: { w: 19, d: 8 } },
  { body: MAT.steelV, print: '#101115', brand: '#1f2126', v: { w: 19, d: 8 }, chrome: true, ticks: true, disp: { w: 20, h: 6.6, y: 51.2, color: '#eef5ff' } },
  { body: MAT.purple, print: '#efe4f8', brand: '#f3ecf9', v: { w: 19, d: 8 }, chrome: true, ring: true, disp: { w: 20, h: 6.6, y: 51.2, color: '#5ff2ff' } },
  { body: MAT.graphite, print: '#c9cfd6', brand: '#dde2e8', v: { w: 21, d: 10 }, chrome: true, ticks: true, trim: true, bar: true, disp: { w: 27, h: 8.6, y: 50.6, color: '#5ff2ff' } },
];
const BLENDER_STATES = ['empty', 'blending', 'ready', 'overflowing', 'ruined'];
// The dial turns to the top of its speed ramp while blending and back to 0 when done.
const DIAL_BLEND = 2.09;
// height of the Pro Max's light line (just over the plinth)
const BAR_Y = 5.4;
// the brand line's lettering (texture size, letter spacing)
const BRAND = { w: 512, h: 64, spacing: 0.2 };

export function blenderLook(upgrades = {}) {
  return { tier: clamp(Math.floor(Number(upgrades.blenderSpeed) || 0), 0, 3), big: (Number(upgrades.jug) || 0) > 0 };
}

// Jug geometry of a model (exported for the tests). Every motor base takes the same jugs.
export function blenderJug(tier, big) {
  return jugOf(big);
}

function jugOf(big) {
  const y0 = BASE.h + 2.6;
  const h = big ? 84 : 72;
  return { y0, h, top: y0 + h, rb: big ? 21.5 : 19.5, rt: big ? 31 : 28.5, sq: 0.5, depth: 0.92, floor: y0 + 10 };
}
const jugR = (J, y) => J.rb + (J.rt - J.rb) * Math.pow(clamp((y - J.y0) / J.h, 0, 1), 0.85);
// the jug's 20 fluted panels (and the purée inside, which follows them: the same columns around)
const FLUTES = { flutes: 20, flute: 0.045 };
const JUG_SEGS = Math.round(64 / FLUTES.flutes) * FLUTES.flutes;
// the pouring spout on the left (a = π): the rim reaches out over the jug's top 13 px (k: how far);
// the lid follows it only a little, so the glass lip sticks out past it
const SPOUT = { k: 0.22, w: 0.3, lid: 0.06 };
const spout = (J, k = SPOUT.k) => (a, y) => 1 + k * Math.exp(-(((a - Math.PI) / SPOUT.w) ** 2)) * smooth(J.top - 13, J.top, y) ** 1.4;
// Rim of a liquid surface: r × the section. With flutes its points go evenly along the outline like
// the columns of a fluted lathe (a = 2π × the share of the way round), so it meets the body's top ring.
const outline = (sq, depth, r, n = 0, fd = 0) => (a) => {
  if (!n) {
    const [x, z] = section(a, sq, depth);
    return [x * r, z * r];
  }
  const u = a / (2 * Math.PI);
  const [x, z] = section(sectionArc(sq, depth).toA(u), sq, depth);
  const k = r * flute(u * n, fd);
  return [x * k, z * k];
};

// Level of the purée in a ready jug: full with every portion left, a clear layer for the last one.
export function jugLevel(J, portions, maxPortions) {
  const n = Math.max(1, maxPortions || 1);
  const k = clamp(portions ?? n, 1, n);
  const full = J.top - 13;
  return J.floor + (full - J.floor) * (0.24 + (0.76 * k) / n);
}

// Every blender stands equally tall whatever its motor base: the lid of a 2-bowl jug ends
// BLENDER_TOP[0] px above the floor in the game, the bigger 3-bowl jug's BLENDER_TOP[1] (about 2× and
// 2.25× a cup; the small lids end clearly below the pass, the big ones clearly over its oak front).
const BLENDER_TOP = [188, 208];

// The zoom of a model (times the frame's), measured once from its jug, lid and measuring cap (the
// same for every motor base).
export function blenderZoom(tier = 0, big = false) {
  return once(`bl-zoom|${!!big}`, () => {
    const P = jugMeshes(!!big);
    let top = 0;
    for (const mesh of [P.glass, P.handle, P.lid, P.cap]) {
      for (let i = 0; i < mesh.pos.length; i += 3) top = Math.max(top, screenOf([mesh.pos[i], mesh.pos[i + 1], mesh.pos[i + 2]], ELEV)[1]);
    }
    return BLENDER_TOP[big ? 1 : 0] / top;
  });
}

// Where the game pins a blender's status badge: just above the right end of the lid, in CSS px
// from the top left of the VIEWS.blender canvas.
export function blenderBadgeAt(tier = 0, big = false) {
  const J = jugOf(!!big);
  const { ax, ay } = VIEWS.blender;
  const [x, y] = screenOf([J.rt + 8, J.top + 12, 0], ELEV, blenderZoom(tier, big));
  return { x: ax + x, y: ay - y };
}

// The part of the VIEWS.blender canvas a model in a state covers at any time of its animation, its
// contact shadow included: [x0, y0, x1, y1] in CSS px. Drag ghosts copy just this part of the
// canvas (the canvas itself is never read back). Measured once per model and state from the
// corners of each part's bounding box, a few px generous.
// part 'jug': the jug alone (lifted off its base, see blenderScene).
export function blenderBox(tier = 0, big = false, state = 'empty', part = null) {
  const tr = clamp(Math.floor(Number(tier) || 0), 0, 3);
  const s = BLENDER_STATES.includes(state) ? state : 'empty';
  const pt = part === 'jug' ? 'jug' : null;
  return once(`bl-box|${tr}|${!!big}|${s}|${pt}`, () => {
    const { w, h, ax, ay } = VIEWS.blender;
    const zoom = blenderZoom(tr, big);
    let [x0, y0, x1, y1] = [w, h, 0, 0];
    const o = { tier: tr, big, state: s, base: 'acai', progress: 0.5, remaining: 3, portions: 1, maxPortions: big ? 3 : 2, part: pt };
    for (let t = 0; t < 3; t += isAnimated('blender', o) ? 0.25 : 3) {
      for (const it of blenderScene(o, t).items) {
        for (const c of corners(it.mesh)) {
          const [x, y] = screenOf(transformPoint(it.m, c), ELEV, zoom);
          x0 = Math.min(x0, ax + x);
          x1 = Math.max(x1, ax + x);
          y0 = Math.min(y0, ay - y);
          y1 = Math.max(y1, ay - y);
        }
      }
    }
    // a little margin for the frames between the samples
    return [Math.max(0, Math.floor(x0 - 2)), Math.max(0, Math.floor(y0 - 2)), Math.min(w, Math.ceil(x1 + 2)), Math.min(h, Math.ceil(y1 + 2))];
  });
}

// The 8 corners of a mesh's bounding box (cached until the mesh changes).
const bounds = new WeakMap();
function corners(mesh) {
  let b = bounds.get(mesh);
  if (!b || b.version !== mesh.version) {
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    const p = mesh.pos;
    for (let i = 0; i < p.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k], p[i + k]);
        hi[k] = Math.max(hi[k], p[i + k]);
      }
    }
    const pts = [];
    for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) pts.push([x, y, z]);
    b = { version: mesh.version, pts };
    bounds.set(mesh, b);
  }
  return b.pts;
}

// The body tapers from r0 at the foot to r1 under the shoulder (y between BODY_Y).
const BODY_Y = [4.6, BASE.h - 3];
const bodyR = (y) => BASE.r0 + (BASE.r1 - BASE.r0) * clamp((y - BODY_Y[0]) / (BODY_Y[1] - BODY_Y[0]), 0, 1);

// The front of the band's V (a flat decal on the front, over the band, up to the shoulder) and how
// far in front of the body it lies (over the band's lip).
const PANEL_TOP = BODY_Y[1] - 0.2;
const PANEL_DZ = 0.7;

// The front of the base at height y: z of the face and how much it leans back.
function baseFront(y) {
  return { z: bodyR(y) * BASE.depth, lean: Math.atan2((BASE.r0 - BASE.r1) * BASE.depth, BODY_Y[1] - BODY_Y[0]) };
}

// The motor base's meshes (the same for every model): plinth, body, the black glass band (around the
// top, over the shoulder and the top face, with a lip at its lower edge) and a thin trim line under it.
function baseMeshes() {
  return once('bl-base', () => {
    const { r0, r1, h, sq, depth, plinth: p, band } = BASE;
    const opt = { segs: 64, sq, depth };
    const o = 0.45;
    const rb = bodyR(band);
    return {
      foot: lathe([[0, 0], [r0 - 3.2, 0], [r0 - 1.9, 0.5], [r0 - 1.3, 1.6], [r0 - 1.2, p + 0.3], [0, p + 0.3]], opt),
      body: lathe([[0, p], [r0 - 1.4, p], [r0 - 0.3, p + 0.4], [r0, BODY_Y[0]], [r1, BODY_Y[1]], [r1 - 1.2, h - 0.8], [r1 - 3.4, h], [0, h]], opt),
      band: lathe([[rb - 0.3, band], [rb + o + 0.2, band, 1], [bodyR(band + 0.5) + o, band + 0.5], [r1 + o, BODY_Y[1]], [r1 - 1 + o * 0.6, h - 0.6 + o * 0.6], [r1 - 3.4, h + o], [0, h + o]], opt),
      trim: lathe([[bodyR(band - 1.1) + 0.2, band - 1.1], [bodyR(band - 0.5) + 0.62, band - 0.5], [rb + 0.62, band]], opt),
    };
  });
}

function jugMeshes(big) {
  return once(`bl-jug|${big}`, () => {
    const J = jugOf(big);
    const prof = [];
    for (let i = 0; i <= 8; i++) {
      const y = J.y0 + 5 + ((J.h - 7) * i) / 8;
      prof.push([jugR(J, y) + 0.4, y]);
    }
    prof.push([J.rt + 1.2, J.top - 1], [J.rt + 1.6, J.top]);
    const opt = { segs: JUG_SEGS, sq: J.sq, depth: J.depth };
    const glass = lathe(prof, { ...opt, ...FLUTES, warp: spout(J) });
    const collar = lathe([[0, J.y0 - 0.5], [J.rb + 2.4, J.y0 - 0.5, 1], [J.rb + 2.5, J.y0 + 7.6], [J.rb + 1.3, J.y0 + 9.6], [0, J.y0 + 9.6]], opt);
    const coupling = cylinder(J.rb + 1.2, J.y0 - 3.6, J.y0 - 0.4, { segs: 40, sq: J.sq, depth: J.depth, bevel: 0.8 });
    // black lid: over the rim (the glass spout reaches out from under it), a tab over the handle, the
    // ring the measuring cap sits in
    const rim = J.top;
    const lidWarp = (a) => spout(J, SPOUT.lid)(a, rim);
    const capR = J.rt * 0.48;
    const lid = merge([
      { mesh: lathe([[J.rt + 0.4, rim - 2.6], [J.rt + 2.2, rim - 2.1], [J.rt + 2.5, rim + 0.9], [J.rt + 1.6, rim + 2.5], [J.rt * 0.6, rim + 3.0], [0, rim + 3.0]], { ...opt, warp: lidWarp }) },
      { mesh: roundedBox(8, 2.2, 12, 1, 3), m: at(J.rt + 4.2, rim + 1.1, 0) },
      { mesh: cylinder(capR + 1.9, rim + 2.4, rim + 4.0, { segs: 40, bevel: 0.6 }) },
    ]);
    // the spout's lip: a clear bead along the rim where it reaches out past the lid (its ends under the lid)
    const lipR = (a) => (J.rt + 1.6) * spout(J)(a, rim);
    const lip = tube(Array.from({ length: 17 }, (_, i) => {
      const a = Math.PI + (i / 16 - 0.5) * 1.5;
      const [x, z] = section(a, J.sq, J.depth);
      return [x * lipR(a), rim - 0.3, z * lipR(a)];
    }), 0.8, { segs: 10 });
    // the clear measuring cap
    const cap = lathe([[0, rim + 3.6], [capR, rim + 3.6, 1], [capR, rim + 7.6], [capR - 1.2, rim + 8.6], [0, rim + 8.8]], { segs: 48 });
    // clear D-shaped handle on the right (+x), attached under the rim and low on the jug
    const ya = J.top - 10;
    const yb = J.y0 + 24;
    const xa = jugR(J, ya);
    const xb = jugR(J, yb);
    const handle = tube(spline([
      [xa - 2, ya + 1.5, 0], [xa + 5, ya + 2.4, 0], [xa + 12, ya + 0.6, 0], [xa + 14.5, ya - 5, 0],
      [xb + 14.5, yb + 5, 0], [xb + 12, yb - 0.6, 0], [xb + 5, yb - 1.6, 0], [xb - 2, yb - 1, 0],
    ], 6), 3.6, { segs: 16, squash: 0.74, up: [0, 0, 1] });
    // blade assembly: hub + two pairs of bent blades
    const bladeParts = [];
    const by = J.y0 + 13;
    const bl = J.rb * 0.78;
    for (const [rot, tilt, len] of [[0.35, 0.28, bl], [0.35 + Math.PI, 0.28, bl], [0.35 + Math.PI / 2, -0.3, bl * 0.82], [0.35 + Math.PI * 1.5, -0.3, bl * 0.82]]) {
      bladeParts.push({ mesh: roundedBox(len, 1.1, 4.4, 0.45, 2), m: compose(at(0, by, 0), rotationY(rot), at(len / 2, 0, 0), rotationZ(tilt), rotationX(0.35)) });
    }
    bladeParts.push({ mesh: cylinder(3.6, J.y0 + 8, by + 1, { segs: 20 }), m: I });
    bladeParts.push({ mesh: cylinder(2.2, by, by + 2.4, { segs: 6 }), m: I });
    return { J, glass, lip, collar, coupling, lid, cap, handle, blades: merge(bladeParts) };
  });
}

// Purée inside the jug from the floor up to y: body plus a surface that animates; both follow the
// jug's fluted panels.
function liquidMeshes(J, y) {
  const L = Math.round(y * 2) / 2;
  return once(`bl-liquid|${J.y0}|${J.h}|${L}`, () => {
    const prof = [[0, J.floor]];
    for (let i = 0; i <= 5; i++) {
      const yy = J.floor + ((L - J.floor) * i) / 5;
      prof.push([jugR(J, yy) - 1.4, yy]);
    }
    return {
      body: lathe(prof, { segs: JUG_SEGS, sq: J.sq, depth: J.depth, ...FLUTES }),
      surface: polarSurface(outline(J.sq, J.depth, jugR(J, L) - 1.4, FLUTES.flutes, FLUTES.flute), 8, JUG_SEGS),
      level: L,
    };
  });
}

function pureeMat(base, kind) {
  return once(`puree|${base}|${kind}`, () => {
    const p = pureeOf(ING[base]?.layer === 'base' ? base : 'acai');
    if (kind === 'ruined') return material({ color: mix(p.main, '#6b604c', 0.72), color2: '#8ca055', rough: 0.62, mode: MODE.MOLD, p: [0.32, 0.95, 0, 0] });
    const main = mix(p.main, p.dark, 0.18);
    if (kind === 'blending') return material({ color: main, color2: p.light, rough: 0.3, coat: 0.12, mode: MODE.PUREE, p: [3, 0.16, 7.5, 0.85] });
    if (kind === 'foam') return material({ color: mix(p.main, p.light, 0.55), color2: mix(p.light, '#ffffff', 0.5), rough: 0.4, mode: MODE.FOAM, p: [0.9, 1.6, 0, 0] });
    if (kind === 'chunk') return material({ color: mix(p.main, '#ffffff', 0.32), rough: 0.55, mode: MODE.FROST, p: [0.4, 0, 0, 0] });
    return material({ color: main, color2: p.light, rough: 0.24, coat: 0.15, mode: MODE.PUREE, p: [2, 0.05, 0, 0.3] });
  });
}

// ---- printed and lit parts of the base (2D canvas textures; world units × px per unit)
const ICON_INK = 'rgba(226, 233, 241, 0.92)';

// Small line icons of the programmes (ice crush, drink glass, bowl, pulse) at x, y, size s px
// (lw: the line width as a share of s).
function drawIcon(ctx, kind, x, y, s, lw = 0.11) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = s * lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (kind === 'ice') {
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      const [c, d] = [Math.cos(a) * s * 0.46, Math.sin(a) * s * 0.46];
      ctx.moveTo(-c, -d);
      ctx.lineTo(c, d);
    }
    ctx.stroke();
  } else if (kind === 'glass') {
    ctx.moveTo(-s * 0.3, -s * 0.34);
    ctx.lineTo(-s * 0.2, s * 0.44);
    ctx.lineTo(s * 0.2, s * 0.44);
    ctx.lineTo(s * 0.3, -s * 0.34);
    ctx.moveTo(s * 0.04, -s * 0.12);
    ctx.lineTo(s * 0.22, -s * 0.52);
    ctx.stroke();
  } else if (kind === 'bowl') {
    ctx.moveTo(-s * 0.46, -s * 0.06);
    ctx.lineTo(s * 0.46, -s * 0.06);
    ctx.arc(0, -s * 0.06, s * 0.46, 0, Math.PI);
    ctx.moveTo(-s * 0.16, -s * 0.24);
    ctx.quadraticCurveTo(-s * 0.06, -s * 0.38, -s * 0.12, -s * 0.5);
    ctx.moveTo(s * 0.12, -s * 0.24);
    ctx.quadraticCurveTo(s * 0.22, -s * 0.38, s * 0.16, -s * 0.5);
    ctx.stroke();
  } else if (kind === 'fruit') {
    ctx.arc(0, s * 0.08, s * 0.36, 0, Math.PI * 2);
    ctx.moveTo(0, -s * 0.28);
    ctx.quadraticCurveTo(s * 0.12, -s * 0.52, s * 0.36, -s * 0.5);
    ctx.stroke();
  } else {
    ctx.font = `900 ${s * 0.95}px Nunito, "Trebuchet MS", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(kind, 0, s * 0.04);
  }
  ctx.restore();
}

// The V of a base's black band (decal over the body and the band's front): black glass like the band,
// a bevelled lower edge that catches the light (a bright trim on the Pro Max), a soft shadow under it
// and the printed programme icons left and right of the display.
function panelTexture(tier) {
  const T = TIERS[tier];
  const { w: vw, d: vd } = T.v;
  const S = 14;
  const W = 2 * vw + 2;
  const top = PANEL_TOP;
  const bot = BASE.band - vd - 0.8;
  const w = Math.round(W * S);
  const h = Math.round((top - bot) * S);
  return {
    key: `bl-panel|${tier}`,
    w,
    h,
    draw(ctx) {
      const X = (x) => (x + W / 2) * S;
      const Y = (y) => (top - y) * S;
      const k = 2.4 / vw; // the share of each edge rounded off at the tip
      const edge = (dy) => {
        ctx.moveTo(X(-W / 2), Y(BASE.band + dy));
        ctx.lineTo(X(-vw), Y(BASE.band + dy));
        ctx.lineTo(X(-vw * k), Y(BASE.band - vd * (1 - k) + dy));
        ctx.quadraticCurveTo(X(0), Y(BASE.band - vd + dy), X(vw * k), Y(BASE.band - vd * (1 - k) + dy));
        ctx.lineTo(X(vw), Y(BASE.band + dy));
        ctx.lineTo(X(W / 2), Y(BASE.band + dy));
      };
      ctx.clearRect(0, 0, w, h);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      // soft shadow on the body under the edge
      for (const [dy, lw, a] of [[-0.45, 1.1, 0.12], [-0.25, 0.55, 0.2]]) {
        ctx.beginPath();
        edge(dy);
        ctx.strokeStyle = `rgba(0, 0, 0, ${a})`;
        ctx.lineWidth = lw * S;
        ctx.stroke();
      }
      ctx.beginPath();
      edge(0);
      ctx.lineTo(X(W / 2), 0);
      ctx.lineTo(X(-W / 2), 0);
      ctx.closePath();
      ctx.fillStyle = '#0b0d10';
      ctx.fill();
      // the bevel (Pro Max: a chrome trim)
      ctx.beginPath();
      edge(T.trim ? 0.22 : 0.16);
      ctx.strokeStyle = T.trim ? 'rgba(236, 241, 246, 0.95)' : 'rgba(196, 208, 220, 0.5)';
      ctx.lineWidth = (T.trim ? 0.42 : 0.24) * S;
      ctx.stroke();
      if (!T.disp) return;
      // programme icons beside the display
      ctx.strokeStyle = ICON_INK;
      ctx.fillStyle = ICON_INK;
      const ix = (T.disp.w / 2 + vw) / 2;
      const s = 2.5 * S;
      drawIcon(ctx, 'ice', X(-ix), Y(T.disp.y + 1.5), s);
      drawIcon(ctx, 'glass', X(-ix), Y(T.disp.y - 2.2), s);
      drawIcon(ctx, 'bowl', X(ix), Y(T.disp.y + 1.5), s);
      drawIcon(ctx, 'P', X(ix), Y(T.disp.y - 2.2), s);
    },
  };
}

// Print around the dial: a ramp of ticks from 0 (top) clockwise to full speed, the programme icons
// on the left (the Classic: 0 / 1 / 2 and P; the Pro's LED ring takes the place of the ticks).
// Everything stays inside the DIAL × DIAL plane (radius + half the icon ≤ DIAL / 2).
const DIAL = 34;
function dialTexture(tier) {
  const T = TIERS[tier];
  const w = 512;
  const S = w / DIAL;
  return {
    key: `bl-dial|${tier}`,
    w,
    h: w,
    draw(ctx) {
      ctx.clearRect(0, 0, w, w);
      const c = w / 2;
      const pt = (deg, r) => [c + Math.cos((deg * Math.PI) / 180) * r * S, c + Math.sin((deg * Math.PI) / 180) * r * S];
      ctx.strokeStyle = T.print;
      ctx.fillStyle = T.print;
      ctx.lineCap = 'round';
      if (!T.chrome) {
        ctx.font = `900 ${2.6 * S}px Nunito, "Trebuchet MS", Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const [deg, txt] of [[-90, '0'], [-30, '1'], [30, '2'], [210, 'P']]) {
          const [x0, y0] = pt(deg, 11.1);
          const [x1, y1] = pt(deg, 12.1);
          ctx.lineWidth = 0.45 * S;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
          const [tx, ty] = pt(deg, 13.7);
          ctx.fillText(txt, tx, ty);
        }
        return;
      }
      if (T.ticks) {
        for (let i = 0; i <= 13; i++) {
          const deg = -90 + (i * 130) / 13;
          const [x0, y0] = pt(deg, 11.4);
          const [x1, y1] = pt(deg, 12.4 + (1.5 * i) / 13);
          ctx.lineWidth = (0.26 + (0.2 * i) / 13) * S;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        }
      }
      for (const [deg, kind] of [[148, 'P'], [182, 'glass'], [216, 'fruit']]) {
        const [x, y] = pt(deg, T.ring ? 15.4 : 13.9);
        drawIcon(ctx, kind, x, y, 2.5 * S, 0.17);
      }
    },
  };
}

// "Start / Stop" printed on the black cap of the chrome dial.
function knobFaceTexture() {
  return {
    key: 'bl-knob-face',
    w: 160,
    h: 160,
    draw(ctx) {
      ctx.clearRect(0, 0, 160, 160);
      ctx.fillStyle = '#eef1f4';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 25px Nunito, "Trebuchet MS", Arial, sans-serif';
      ctx.fillText('Start', 80, 63);
      ctx.fillText('Stop', 80, 99);
      ctx.fillRect(54, 80, 52, 2.4);
    },
  };
}

// What the display shows: the seconds left while blending, ✓ when ready, a blinking ! when it
// overflows, Err when spoiled, 00:00 when idle.
function blenderDisplay(s, o, blink, color) {
  const secs = clamp(Math.ceil(Number(o.remaining) || 0), 0, 59);
  if (s === 'blending') return [`00:${secs < 10 ? '0' : ''}${secs}`, color];
  if (s === 'ready') return ['✓', '#58ff9c'];
  if (s === 'overflowing') return [blink ? '!' : ' ', '#ff5a5a'];
  if (s === 'ruined') return ['Err', '#ff5a5a'];
  return ['00:00', color];
}

// A texture spec drawn on the nearest power-of-two canvas (stretched to it; the plane maps it back),
// so the renderer gives it mipmaps and the print stays smooth at the game's size.
const pow2 = (n) => 2 ** Math.round(Math.log2(n));
function pow2Texture(spec) {
  const w = pow2(spec.w);
  const h = pow2(spec.h);
  if (w === spec.w && h === spec.h) return spec;
  return {
    key: `${spec.key}|${w}x${h}`,
    w,
    h,
    draw(ctx) {
      ctx.scale(w / spec.w, h / spec.h);
      spec.draw(ctx, spec.w, spec.h);
    },
  };
}

// a decal (texture made by tex() the first time) whose print glows (glowK) or not; the panel's black
// matches the band (MAT.panelGlass)
const decalMat = (key, tex, glowK = 0, extra = {}) => once(key, () => material({ mode: MODE.TEX, tex: pow2Texture(tex()), p: [glowK, 1, 0, 0], rough: 0.35, coat: 0.3, ...extra }));

// Controls on the front of the base; returns items. o = blender options, t = time.
function blenderControls(tier, T, s, o, t) {
  const items = [];
  const n = clamp(o.maxPortions || 2, 1, 4);
  const left = s === 'ready' || s === 'overflowing' ? clamp(o.portions ?? n, 0, n) : 0;
  const blink = Math.sin(t * 9) > 0;
  const front = (y, dz = 0) => {
    const f = baseFront(y);
    return compose(at(0, y, f.z + dz), rotationX(-f.lean));
  };
  const led = (x, y, mat, r = 1.3) => {
    items.push(item(once('led-dome', () => sphere(1, 12, 8)), mat, compose(front(y, PANEL_DZ), at(x, 0, 0), scaling(r, r, r * 0.7))));
    if (mat !== MAT.ledOff) {
      const hex = mat === LED.red ? '#ff5a5a' : '#3dff70';
      items.push(glow(hex, x, y, baseFront(y).z + PANEL_DZ + 2, r * 3.4, 0.55));
    }
  };

  // the V of the black band, the display in it and the portion LEDs at its tip
  const V = T.v;
  const vTop = PANEL_TOP;
  const vBot = BASE.band - V.d - 0.8;
  items.push(item(once(`bl-v-plane|${V.w}|${V.d}`, () => plane(2 * V.w + 2, vTop - vBot)), decalMat(`bl-v-mat|${tier}`, () => panelTexture(tier), 0.35, { color: '#0b0d10', rough: 0.12, coat: 1 }),
    front((vTop + vBot) / 2, PANEL_DZ), 'decal'));
  if (T.disp) {
    const D = T.disp;
    const [text, col] = blenderDisplay(s, o, blink, D.color);
    const tex = () => segmentTexture(text, col, { w: 320, h: Math.round((320 * D.h) / D.w), bg: null });
    items.push(item(once(`bl-disp-plane|${D.w}|${D.h}`, () => plane(D.w, D.h)), decalMat(`bl-disp-mat|${text}|${col}|${D.w}`, tex, 1.6, { color: '#000000', rough: 0.12, coat: 1 }), front(D.y, PANEL_DZ + 0.1), 'decal'));
  } else {
    // Classic: a red lamp that is on while blending (blinks when it overflows)
    led(0, BASE.band + 2.6, s === 'blending' || (s === 'overflowing' && blink) ? LED.red : MAT.ledOff, 1.2);
  }
  const ly = BASE.band - V.d * 0.5;
  for (let i = 0; i < n; i++) led((i - (n - 1) / 2) * 4.6, ly, i < left ? LED.green : MAT.ledOff, 1.5);

  // the big dial: print around it, the knob (chrome ring and black cap, or the Classic's plain
  // knob), turned to full speed while blending
  const yc = BASE.dial;
  const ang = s === 'blending' ? DIAL_BLEND : 0;
  items.push(item(once('bl-dial-plane', () => plane(DIAL, DIAL)), decalMat(`bl-dial-mat|${tier}`, () => dialTexture(tier)), front(yc, 0.12), 'decal'));
  const turn = compose(front(yc, -0.2), rotationZ(-ang), rotationX(Math.PI / 2));
  if (T.chrome) {
    items.push(item(once('bl-knob-ring', () => lathe([[7.4, 0.2], [10.4, 0.2, 1], [10.5, 1.6], [10.1, 3.3], [9.2, 4.3], [8.1, 4.4], [7.5, 3.9]], { segs: 48 })), MAT.chrome, turn));
    items.push(item(once('bl-knob-cap', () => lathe([[0, 0.2], [7.7, 0.2, 1], [7.7, 3.2], [7.3, 3.7], [0, 3.95]], { segs: 40 })), MAT.blackGloss, turn));
    items.push(item(once('bl-knob-mark', () => roundedBox(1.2, 2.4, 0.8, 0.4, 2)), MAT.white, compose(front(yc, 4.1), rotationZ(-ang), at(0, 9.1, 0))));
    items.push(item(once('bl-knob-face-plane', () => plane(13, 13)), decalMat('bl-knob-face-mat', knobFaceTexture, 0.2), front(yc, 4.0), 'decal'));
  } else {
    items.push(item(once('bl-knob-base', () => lathe([[8.8, 0], [10.6, 0, 1], [10.6, 0.9], [9.6, 1.5], [8.8, 1.5]], { segs: 48 })), MAT.gray, compose(front(yc, -0.2), rotationX(Math.PI / 2))));
    items.push(item(once('bl-knob-plain', () => lathe([[0, 0], [9.2, 0, 1], [9.2, 4.6], [8.2, 5.6], [0, 5.8]], { segs: 48 })), MAT.blackKnurl, turn));
    items.push(item(once('bl-knob-line', () => roundedBox(1.3, 5.4, 0.7, 0.4, 2)), MAT.white, compose(front(yc, 5.5), rotationZ(-ang), at(0, 4.6, 0))));
  }
  if (T.ring) {
    // Pro: LED ring around the dial, lit clockwise from the top as the blend goes on
    const ring = once('ledring', () => lathe([[11.1, 0], [13.1, 0, 1], [13.1, 0.7, 1], [11.1, 0.7]], { segs: 72 }));
    const share = s === 'blending' ? clamp(o.progress || 0, 0, 1) : s === 'ready' ? 1 : s === 'overflowing' ? (blink ? 1 : 0) : 0;
    const ringMat = once(`ledring|${s === 'overflowing' ? 'r' : 'c'}|${Math.round(share * 24)}`, () => material({
      color: '#202228', rough: 0.3, coat: 0.6, emit: s === 'overflowing' ? '#ff5050' : '#4fe8ff', glow: 2.6, mode: MODE.LEDRING, p: [24, Math.round(share * 24) / 24, 0.12, 0],
    }));
    items.push(item(ring, ringMat, compose(front(yc, 0.15), rotationZ(-Math.PI / 2), rotationX(Math.PI / 2))));
    if (share > 0) items.push(glow(s === 'overflowing' ? '#ff6060' : '#6ff0ff', 0, yc, baseFront(yc).z + 3, 17, 0.35));
  }
  if (T.bar) {
    // Pro Max: a thin light line over the plinth with a soft halo on the body, not on the floor (the
    // game's timer bar runs under the feet): white idle, cyan blending, green ready, red blink overflowing
    const barCol = s === 'overflowing' ? (blink ? LED.red : MAT.ledOff) : s === 'ruined' ? MAT.ledOff : s === 'ready' ? LED.green : s === 'blending' ? LED.cyan : LED.white;
    const fb = baseFront(BAR_Y);
    items.push(item(once('max-bar', () => roundedBox(30, 0.75, 0.8, 0.37, 2)), barCol, compose(at(0, BAR_Y, fb.z + 0.15), rotationX(-fb.lean))));
    if (barCol !== MAT.ledOff) {
      const hex = barCol === LED.red ? '#ff5050' : barCol === LED.green ? '#55ff99' : barCol === LED.cyan ? '#55e8ff' : '#ffffff';
      items.push(glow(hex, 0, BAR_Y, fb.z + 1.5, 19, barCol === LED.white ? 0.18 : 0.32, { sy: 0.16 }));
    }
  }
  // the brand line under the dial
  items.push(item(once('bl-brand-plane', () => plane(25, 3.1)), once(`bl-brand-mat|${T.brand}`, () => labelMat('AÇAÍ FEVER', T.brand, BRAND)), front(8.6, 0.12), 'decal'));
  return items;
}

// Blender scene. o = { tier 0–3, big, state, base, progress, portions, maxPortions, remaining }.
// o.part: 'base' draws the motor base alone (its jug is carried to a cup), 'jug' the jug alone (the drag
// ghost: no base, no shadow); anything else the whole blender.
export function blenderScene(o = {}, t = 0, frame = VIEWS.blender) {
  const tier = clamp(Math.floor(Number(o.tier) || 0), 0, 3);
  const big = !!o.big;
  const s = BLENDER_STATES.includes(o.state) ? o.state : 'empty';
  const T = TIERS[tier];
  const parts = jugMeshes(big);
  const J = parts.J;
  const B = baseMeshes();
  const items = [];
  const out = { frame: { ...frame, zoom: (frame.zoom || 1) * blenderZoom(tier, big) }, elev: ELEV, time: t, items };
  if (o.part !== 'jug') {
    items.push(shadow(BASE.r0 - 1, BASE.r0 * BASE.depth - 1, 12, 10, 0.62));

    // motor base: plinth, body, the black glass band (a chrome line under it on the Pro Max), controls
    items.push(item(B.foot, MAT.blackSatin));
    items.push(item(B.body, T.body));
    items.push(item(B.band, MAT.panelGlass));
    if (T.trim) items.push(item(B.trim, MAT.chrome));
    items.push(...blenderControls(tier, T, s, o, t));
    items.push(item(parts.coupling, MAT.rubber));
  }
  if (o.part === 'base') return out;

  // jug, contents and lid move together (vibration while blending)
  let shake = I;
  if (s === 'blending') shake = at(Math.sin(t * 71) * 0.45, Math.abs(Math.sin(t * 53)) * 0.35, Math.sin(t * 61) * 0.3);
  else if (s === 'overflowing') shake = compose(at(0, 0, 0), rotationAbout([0, J.y0, 0], 'z', Math.sin(t * 13) * 0.02));
  items.push(item(parts.collar, MAT.lid, shake));
  items.push(item(parts.blades, MAT.bladeSteel, s === 'blending' ? compose(shake, rotationY(t * 31)) : shake));

  const base = o.base;
  let level = null;
  if (s === 'blending') level = J.top - 14;
  else if (s === 'ready') level = jugLevel(J, o.portions, o.maxPortions);
  else if (s === 'overflowing') level = J.top - 3;
  else if (s === 'ruined') level = J.top - 20;
  if (level !== null) {
    const liq = liquidMeshes(J, level);
    const kind = s === 'ruined' ? 'ruined' : s === 'blending' ? 'blending' : 'still';
    const mat = pureeMat(base, kind);
    items.push(item(liq.body, mat, shake));
    const L = liq.level;
    const p = clamp(o.progress || 0, 0, 1);
    let fn;
    if (s === 'blending') {
      const dip = 8 + 5 * (1 - p);
      fn = (x, z, k, a) => L + dip * (k * k - 0.5) + 1.3 * Math.sin(3 * a - t * 9 + k * 4) * k + 0.6 * Math.sin(5 * a + t * 6) * k * k;
    } else if (s === 'overflowing') {
      fn = (x, z, k, a) => L + 1.2 * Math.sin(5 * a + t * 7) * k + 0.8 * Math.sin(3 * a - t * 5) * k;
    } else if (s === 'ruined') {
      fn = (x, z, k, a) => L + 1.4 * Math.sin(4 * a + 1.3) * k * (1 - k) * 3 + 0.8 * Math.sin(7 * a) * k;
    } else {
      fn = (x, z, k, a) => L + 0.5 * Math.sin(2 * a + 1.3) * k * k - 0.6 * (1 - k * k);
    }
    updateSurface(liq.surface, fn);
    items.push(item(liq.surface, mat, shake));
    if (s === 'blending') {
      // frozen chunks thrown around by the vortex – they get smaller as the blend goes on
      const size = 6.5 * (1 - smooth(0.05, 0.8, p));
      if (size > 0.6) {
        const rng = rngFor('chunks');
        const R0 = jugR(J, L) - 6;
        for (let i = 0; i < 7; i++) {
          const ph = rng.next() * Math.PI * 2;
          const rr = R0 * (0.35 + rng.next() * 0.55);
          const sp = 4.5 + rng.next() * 3;
          const a = ph + t * sp;
          const k = rr / (R0 + 6);
          const y = L + (8 + 5 * (1 - p)) * (k * k - 0.5) + 0.8 + Math.sin(t * 7 + i) * 1.4;
          const sz = size * (0.7 + rng.next() * 0.5);
          const [cx, cz] = section(a, J.sq, J.depth);
          items.push(item(once('chunk', () => roundedBox(1, 1, 1, 0.3, 2)), pureeMat(base, 'chunk'),
            compose(shake, at(cx * rr, y, cz * rr), rotationY(a * 1.7 + i), rotationX(t * 3 + i), scaling(sz, sz * 0.85, sz))));
        }
      }
    }
  }

  // glass jug (drawn after its contents) with a printed scale on the front left, its clear handle
  const marks = big ? 6 : 5;
  const jugMat = once(`jugmat|${big}`, () => material({
    color: '#d7eef6', alpha: 0.07, rough: 0.05, glass: true, double: true, mode: MODE.GLASS,
    p: [marks, J.y0 + 16, (J.h - 26) / (marks - 1), 2.15],
  }));
  items.push(item(parts.glass, jugMat, shake, 'glass'));
  items.push(item(parts.lip, MAT.clearHandle, shake, 'glass'));
  items.push(item(parts.handle, MAT.clearHandle, shake, 'glass'));

  // lid: lifted by the foam when overflowing, crooked on a spoiled jug
  let lidM = shake;
  if (s === 'overflowing') lidM = compose(shake, rotationAbout([-J.rt - 2, J.top + 2, 0], 'z', 0.32 + Math.sin(t * 6) * 0.05), at(0, 7, 0));
  else if (s === 'ruined') lidM = compose(rotationAbout([J.rt, J.top, 0], 'z', -0.06), at(0, 1.2, 0));
  items.push(item(parts.lid, MAT.lid, lidM));
  items.push(item(parts.cap, MAT.capGlass, lidM, 'glass'));

  if (s === 'overflowing') items.push(...overflowFoam(J, base, t, o.part !== 'jug'));
  if (s === 'ruined') items.push(...flies(J, t));
  return out;
}

function overflowFoam(J, base, t, puddle = true) {
  const items = [];
  const foam = pureeMat(base, 'foam');
  const ball = once('foam-ball', () => sphere(1, 18, 12));
  const rng = rngFor('foam');
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 * 3 + rng.next() * 0.6;
    const rr = J.rt * (0.15 + rng.next() * 0.85);
    const [cx, cz] = section(a, J.sq, J.depth);
    const s = (3.2 + rng.next() * 3.4) * (1 + 0.16 * Math.sin(t * 5.5 + i * 1.7));
    const y = J.top - 1 + (1 - rr / J.rt) * 7 + rng.next() * 4 + Math.sin(t * 4 + i) * 1.1;
    items.push(item(ball, foam, compose(at(cx * rr, y, cz * rr), scaling(s, s * 0.78, s))));
  }
  // drips running down the outside of the jug (over the spout side) into a puddle by the base
  const drip = pureeMat(base, 'still');
  for (let i = 0; i < 3; i++) {
    const a = 1.75 + i * 0.42;
    const fall = (t * 9 + i * 13) % 34;
    const y = J.top - 2 - fall;
    const r = jugR(J, y) + 1.8;
    const [cx, cz] = section(a, J.sq, J.depth);
    const len = 3.5 + fall * 0.12;
    items.push(item(ball, drip, compose(at(cx * r, y, cz * r), scaling(2.1, len, 2.1))));
    items.push(item(once('drip-trail', () => cylinder(1, -1, 0, { segs: 12 })), drip, compose(at(cx * r, J.top - 1, cz * r), scaling(1.3, fall + 1, 1.3))));
  }
  if (puddle) items.push(item(once('puddle', () => sphere(1, 24, 8)), drip, compose(at(-24, 0.2, BASE.r0 * BASE.depth + 4), scaling(10.5, 0.9, 5.5))));
  return items;
}

function flies(J, t) {
  const items = [];
  for (let i = 0; i < 2; i++) {
    const a = t * (2.1 + i * 0.7) + i * Math.PI;
    const x = Math.cos(a) * (14 + i * 5);
    const z = Math.sin(a) * 10;
    const y = J.top + 16 + i * 6 + Math.sin(t * 5 + i) * 3;
    const body = compose(at(x, y, z), rotationY(-a + Math.PI / 2));
    items.push(item(once('fly', () => sphere(1, 12, 8)), MAT.blackGloss, compose(body, scaling(2.1, 1.5, 1.5))));
    const flap = Math.sin(t * 70) * 0.6;
    for (const side of [-1, 1]) {
      items.push(item(once('wing', () => sphere(1, 10, 6)), MAT.wing, compose(body, at(0, 1.2, side * 0.8), rotationX(side * (0.5 + flap)), at(0, 0, side * 1.8), scaling(1.6, 0.25, 2)), 'glass', 1));
    }
  }
  return items;
}

// ==================================================================
// Matcha machine
// ==================================================================
// Modelled on a household tea-latte machine (the overhaul's second reference photo): an upright
// rounded housing with an olive matcha-green shell around a glossy black front. Per slot a bay: the
// smoked water tank at the top (a grip recess on its front), under it an olive collar with a small
// knob and the status LED, the nozzle, and a dark recess down to the drip tray with its grate, where
// the glass stands (the glass itself is the DOM art). On the right, in an arched alcove, the tea
// mill: a glass cylinder with green matcha powder and the burr between a dark cap and a dark base;
// the lettering above it. 1 slot: close to the photo; 2 slots (upgrade "Doppel-Matcha"): a wider
// machine with two bays side by side and a small temperature display.
// A fruit dropped on a glass is its purée (the glass art); the mill grinds and the tank heats
// (bubbles, steam), then the nozzle pours milk and matcha and the glass fills (pourFill).
// Glasses stand at x = MACHINE_SLOT_X, y = TRAY_Y, z = GLASS_Z – the game's slots line up with them.
export const MACHINE_SLOT_X = { 1: [-34], 2: [-68, 10] };
export const GLASS_Z = 25;
export const TRAY_Y = 8;
// w: the housing's width, bays: [x0, x1] of each bay, mill: the mill's axis, tank: its half widths
// at the bottom and the top
const MATCHA = {
  1: { w: 174, bays: [[-78, 10]], mill: 47, millR: 16.5, tank: [21, 32] },
  2: { w: 228, bays: [[-105, -31], [-27, 47]], mill: 78, millR: 15.5, tank: [20, 29.5] },
};
// heights: the housing, the collar under a tank, the nozzle's tip; the nozzle head's radius; z: the
// housing's back and front
const MH = 170;
const COLLAR = [87, 99];
const NOZZLE_Y = 77;
const HEAD_R = 8.6;
const ZB = -40;
const ZF = 6;
const TRAY_Z = 44;
const TANK_DEPTH = 0.6;
// the mill (heights of its parts on the base)
const MILL = { base: 44, glass: 84, cap: 96 };
// the brew: grinding and heating first, then the nozzle pours from POUR_AT on
const POUR_AT = 0.55;
const steps8 = (v) => Math.round(clamp(v, 0, 1) * 8) / 8;
// the machine's measures, for its drawn version without WebGL (js/art-kitchen.js)
export const MATCHA_GEO = { models: MATCHA, h: MH, collar: COLLAR, nozzle: NOZZLE_Y, headR: HEAD_R, back: ZB, front: ZF, trayZ: TRAY_Z, mill: MILL, tankDepth: TANK_DEPTH };

// A world point of the machine → canvas px of its view (VIEWS.machine).
export function machinePoint(p, frame = VIEWS.machine) {
  const [x, y] = screenOf(p, ELEV, frame.zoom || 1);
  return [frame.ax + x, frame.ay - y];
}

const MATCHA_MAT = {
  olive: material({ color: '#53563a', metal: 0.1, rough: 0.5, coat: 0.14 }),
  oliveDark: material({ color: '#373924', metal: 0.1, rough: 0.5, coat: 0.1 }),
  front: material({ color: '#0b0c0e', rough: 0.3, coat: 0.3 }),
  tray: material({ color: '#131417', rough: 0.75, coat: 0 }),
  smoke: material({ color: '#4c443b', alpha: 0.68, rough: 0.06, glass: true, double: true }),
  lid: material({ color: '#1f1d1b', rough: 0.45, coat: 0.25 }),
  water: material({ color: '#5a564e', rough: 0.1, coat: 0.7 }),
  bubble: material({ color: '#ffffff', emit: '#c9dde3', glow: 0.5, rough: 0.1, coat: 0.6 }),
  millBase: material({ color: '#36312b', rough: 0.34, coat: 0.55 }),
  millGlass: material({ color: '#e3eef0', alpha: 0.07, rough: 0.04, glass: true, double: true }),
  powder: material({ color: '#7a9c33', color2: '#4c6a1c', rough: 0.92, mode: MODE.GRAIN, p: [1.6, 0, 0.45, 0] }),
  burr: material({ color: '#ebe5d4', rough: 0.4, coat: 0.3, mode: MODE.KNURL, p: [30, 0, 0, 0] }),
  grate: material({ color: '#8e969d', metal: 1, rough: 0.3, mode: MODE.GRILLE, p: [16, 1, 0.34, 0] }),
};

// Share of the brew done at a point of the mixing progress p: the mill grinds (powder sinks a bit)
// and the water heats, then the nozzle pours.
export function brewPhase(state, p = 0) {
  if (state === 'mixing') {
    const q = clamp(p, 0, 1);
    const heat = smooth(0, 0.25, q);
    if (q < POUR_AT) return { grind: 1, heat, pour: 0, powder: 1 - 0.3 * smooth(0, POUR_AT, q), dust: smooth(0.05, 0.2, q) * (1 - smooth(0.42, POUR_AT, q)) };
    return { grind: 0, heat: 1, pour: 1, powder: 0.7, dust: 0 };
  }
  if (state === 'ready') return { grind: 0, heat: 0, pour: 0, powder: 0.7, dust: 0 };
  return { grind: 0, heat: 0, pour: 0, powder: 1, dust: 0 };
}

// How much of the milk and matcha is in the glass on the drip tray (the game draws the glass with
// this level while it brews).
export function pourFill(p = 0) {
  return smooth(POUR_AT, 1, clamp(p, 0, 1));
}

// How far the fruit dropped into the glass is puréed while the mill grinds (pieces 0 … smooth 1).
export function pureeFill(p = 0) {
  return smooth(0.04, POUR_AT - 0.04, clamp(p, 0, 1));
}

// A dark recess in the black front (behind a glass, the mill's alcove): matte black with its upper
// edge in shadow and its lower lip catching the light; arch: the top is a half round.
function recessTexture(w, h, arch) {
  const S = 8;
  const W = Math.round(w * S);
  const H = Math.round(h * S);
  return {
    key: `mt-recess|${w}|${h}|${arch}`,
    w: W,
    h: H,
    draw(ctx) {
      ctx.clearRect(0, 0, W, H);
      const m = 0.6 * S;
      const r = arch ? (W - 2 * m) / 2 : 5 * S;
      const shape = (k) => {
        const x0 = m + k;
        const x1 = W - m - k;
        const y0 = m + k;
        const y1 = H - m - k;
        const rr = Math.max(1, r - k);
        ctx.beginPath();
        ctx.moveTo(x0, y1);
        ctx.lineTo(x0, y0 + rr);
        ctx.arcTo(x0, y0, x0 + rr, y0, rr);
        ctx.lineTo(x1 - rr, y0);
        ctx.arcTo(x1, y0, x1, y0 + rr, rr);
        ctx.lineTo(x1, y1);
        ctx.closePath();
      };
      // the panel's lip around the opening catches a little light
      shape(-0.5 * S);
      ctx.fillStyle = 'rgba(150, 156, 166, 0.35)';
      ctx.fill();
      shape(0);
      const grd = ctx.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, '#000000');
      grd.addColorStop(0.35, '#050506');
      grd.addColorStop(1, '#101114');
      ctx.fillStyle = grd;
      ctx.fill();
      // a soft inner shadow along the edge (strokes growing fainter inward), light on the lower back
      ctx.save();
      shape(0);
      ctx.clip();
      for (let i = 0; i < 6; i++) {
        shape(i * 0.45 * S);
        ctx.lineWidth = 0.6 * S;
        ctx.strokeStyle = `rgba(0, 0, 0, ${0.5 - i * 0.08})`;
        ctx.stroke();
      }
      const low = ctx.createLinearGradient(0, H * 0.55, 0, H);
      low.addColorStop(0, 'rgba(70, 76, 84, 0)');
      low.addColorStop(1, 'rgba(70, 76, 84, 0.35)');
      ctx.fillStyle = low;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    },
  };
}

// A soft reflection on the glossy black front: a broad glow from the top left fading out, two faint streaks.
function sheenTexture() {
  return {
    key: 'mt-sheen',
    w: 256,
    h: 256,
    draw(ctx) {
      ctx.clearRect(0, 0, 256, 256);
      const grd = ctx.createLinearGradient(0, 0, 200, 230);
      grd.addColorStop(0, 'rgba(255, 255, 255, 0.13)');
      grd.addColorStop(0.35, 'rgba(255, 255, 255, 0.04)');
      grd.addColorStop(0.6, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.moveTo(40, 0);
      ctx.lineTo(78, 0);
      ctx.lineTo(0, 120);
      ctx.lineTo(0, 62);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.beginPath();
      ctx.moveTo(96, 0);
      ctx.lineTo(108, 0);
      ctx.lineTo(0, 166);
      ctx.lineTo(0, 148);
      ctx.closePath();
      ctx.fill();
    },
  };
}

// The tank's grip: a recessed strip down its front left – its left wall in shadow, its right wall
// catching the light, a bright lip along the left edge – bold enough to read at the game's 1× scale.
function gripTexture() {
  return {
    key: 'mt-grip',
    w: 64,
    h: 256,
    draw(ctx) {
      ctx.clearRect(0, 0, 64, 256);
      const grd = ctx.createLinearGradient(6, 0, 58, 0);
      grd.addColorStop(0, 'rgba(10, 8, 6, 0.85)');
      grd.addColorStop(0.55, 'rgba(28, 22, 17, 0.6)');
      grd.addColorStop(1, 'rgba(64, 54, 44, 0.4)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(6, 6, 52, 244, 22);
      else ctx.rect(6, 6, 52, 244);
      ctx.fill();
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(186, 174, 156, 0.5)';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(47, 34);
      ctx.lineTo(47, 226);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 246, 232, 0.4)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(8, 236);
      ctx.lineTo(8, 26);
      ctx.quadraticCurveTo(8, 8, 28, 8);
      ctx.stroke();
    },
  };
}

// A puff of steam: light in the middle with a soft grey edge, so it shows over the black front as
// well as over the white marble of the pass behind the machine (drawn blended, not as a glow).
function steamTexture() {
  return {
    key: 'mt-steam',
    w: 64,
    h: 64,
    draw(ctx) {
      ctx.clearRect(0, 0, 64, 64);
      const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, 'rgba(250, 251, 252, 0.9)');
      grd.addColorStop(0.42, 'rgba(206, 213, 219, 0.78)');
      grd.addColorStop(0.74, 'rgba(126, 137, 146, 0.5)');
      grd.addColorStop(1, 'rgba(126, 137, 146, 0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, 64, 64);
    },
  };
}

function matchaParts(n) {
  return once(`mt|${n}`, () => {
    const M = MATCHA[n];
    const [rb, rt] = M.tank;
    const tankTop = MH - 3;
    const opt = { segs: 48, sq: 0.7, depth: TANK_DEPTH };
    const tankR = (y) => rb + (rt - rb) * clamp((y - COLLAR[1]) / (tankTop - COLLAR[1]), 0, 1) ** 0.9;
    const prof = [];
    for (let i = 0; i <= 6; i++) {
      const y = COLLAR[1] + ((tankTop - COLLAR[1]) * i) / 6;
      prof.push([tankR(y), y]);
    }
    const R = M.millR;
    return {
      shell: roundedBox(M.w, MH - 3, ZF - ZB, 9, 4),
      panel: roundedBox(M.w - 12, MH - 16, 3, 2.6, 3),
      base: roundedBox(M.w - 2, TRAY_Y, TRAY_Z - ZB, 3, 3),
      lip: roundedBox(M.w - 6, 1.6, 1.6, 0.7, 2),
      tank: lathe([[rb - 4, COLLAR[1]], [rb - 0.6, COLLAR[1] + 0.3], ...prof.slice(1)], opt),
      lid: lathe([[0, tankTop - 1.2], [rt + 1.2, tankTop - 1.2, 1], [rt + 1.4, tankTop + 2.4], [rt + 0.4, tankTop + 3.6], [rt * 0.4, tankTop + 4], [0, tankTop + 4]], opt),
      vent: cylinder(rt * 0.22, tankTop + 3.6, tankTop + 4.4, { segs: 24, bevel: 0.4 }),
      collar: lathe([[0, COLLAR[0]], [rb - 2, COLLAR[0], 1], [rb, COLLAR[0] + 0.8], [rb + 0.9, COLLAR[0] + 3], [rb + 0.9, COLLAR[1] - 1], [rb + 0.3, COLLAR[1]], [0, COLLAR[1]]], { ...opt, segs: 40, sq: 0.35 }),
      band: lathe([[rb + 0.95, COLLAR[0] + 1.6], [rb + 1.1, COLLAR[0] + 2.2, 1], [rb + 1.1, COLLAR[0] + 3.4, 1], [rb + 0.95, COLLAR[0] + 4]], { ...opt, segs: 40, sq: 0.35 }),
      knob: lathe([[0, 0], [2.6, 0, 1], [2.8, 2], [2.4, 3.2], [0, 3.4]], { segs: 20 }),
      head: lathe([[0, NOZZLE_Y + 3.6], [HEAD_R - 0.4, NOZZLE_Y + 3.6, 1], [HEAD_R, NOZZLE_Y + 5], [HEAD_R, COLLAR[0] + 0.5], [0, COLLAR[0] + 0.5]], { segs: 32 }),
      tip: lathe([[0, NOZZLE_Y], [2.2, NOZZLE_Y, 1], [3.2, NOZZLE_Y + 1.2], [3.6, NOZZLE_Y + 4], [0, NOZZLE_Y + 4]], { segs: 24 }),
      stream: lathe([[0, 0], [1.6, 0, 1], [1.6, 1, 1], [2, 1, 1], [0, 1]], { segs: 18 }),
      waterBody: (level) => lathe([[0, COLLAR[1] + 1], [rb - 2, COLLAR[1] + 1], [tankR(level) - 1.8, level], [0, level]], opt),
      tankR,
      // the mill: dark base, clear glass with the powder and the burr, olive rings, dark cap
      millBase: lathe([[0, TRAY_Y], [R - 1.4, TRAY_Y, 1], [R, TRAY_Y + 1.4], [R + 0.4, MILL.base - 2], [R - 0.2, MILL.base], [0, MILL.base]], { segs: 40 }),
      millGlass: lathe([[R - 2.2, MILL.base], [R - 1.2, MILL.base + 0.6], [R - 1.2, MILL.glass - 0.6], [R - 2.2, MILL.glass]], { segs: 48 }),
      ring: lathe([[R - 1.1, 0], [R - 0.4, 0, 1], [R - 0.4, 1.8, 1], [R - 1.1, 1.8]], { segs: 40 }),
      burr: cylinder(R - 4.2, 0, 5, { segs: 36, bevel: 0.8 }),
      shaft: cylinder(1.6, MILL.base, MILL.glass, { segs: 12 }),
      millCap: lathe([[0, MILL.glass], [R - 0.4, MILL.glass, 1], [R + 0.2, MILL.glass + 1.2], [R + 0.2, MILL.cap - 3], [R - 1.6, MILL.cap - 0.4], [R * 0.5, MILL.cap], [0, MILL.cap]], { segs: 40 }),
      powder: (level) => cylinder(R - 2.6, MILL.base + 0.5, level, { segs: 36 }),
      dust: sphere(1, 8, 6),
    };
  });
}

const streamMat = (kind) => once(`mt-stream|${kind}`, () => material({ color: MATCHA_COLORS[kind], rough: 0.2, coat: 0.3, mode: MODE.STREAM, p: [-2.4, 0, 0, 0] }));

// o = { slots: [{ state, fruit, progress }] } (1 or 2 slots)
export function matchaScene(o = {}, t = 0, frame = VIEWS.machine) {
  const slots = (o.slots && o.slots.length ? o.slots : [{ state: 'empty' }]).slice(0, 2);
  const n = slots.length >= 2 ? 2 : 1;
  const M = MATCHA[n];
  const P = matchaParts(n);
  const items = [];
  const zc = (ZB + TRAY_Z) / 2;
  items.push(shadow(M.w / 2 - 3, (TRAY_Z - ZB) / 2 - 2, 10, 11, 0.6, at(0, 0, zc)));
  // housing: olive shell, the black front (an olive frame around it), the drip tray along the bottom
  items.push(item(P.shell, MATCHA_MAT.olive, at(0, (MH - 3) / 2 + 3, (ZB + ZF) / 2)));
  items.push(item(P.panel, MATCHA_MAT.front, at(0, 7 + (MH - 16) / 2, ZF)));
  items.push(item(P.base, MATCHA_MAT.tray, at(0, TRAY_Y / 2, (ZB + TRAY_Z) / 2)));
  items.push(item(P.lip, MATCHA_MAT.front, at(0, TRAY_Y - 0.6, TRAY_Z - 0.4)));
  items.push(item(once(`mt-sheen-plane|${n}`, () => plane(M.w - 12, MH - 16)), decalMat('mt-sheen-mat', sheenTexture, 0, { rough: 0.2, coat: 0.6 }),
    at(0, 7 + (MH - 16) / 2, ZF + 1.6), 'decal'));
  const phases = slots.map((s) => brewPhase(s?.state === 'mixing' || s?.state === 'ready' ? s.state : 'empty', s?.progress));
  const ZA = GLASS_Z;
  const zPanel = ZF + 1.55;

  slots.forEach((slot, i) => {
    const [b0, b1] = M.bays[i];
    const [rb, rt] = M.tank;
    const x = MACHINE_SLOT_X[n][i];
    const st = slot?.state === 'mixing' || slot?.state === 'ready' ? slot.state : 'empty';
    const ph = phases[i];
    // the recess behind the glass and the grate it stands on
    const rw = b1 - b0 - 6;
    const rh = COLLAR[0] - 10;
    items.push(item(once(`mt-recess-plane|${rw}|${rh}`, () => plane(rw, rh)), decalMat(`mt-recess-mat|${rw}|${rh}`, () => recessTexture(rw, rh, false), 0, { rough: 0.6, coat: 0.2 }),
      at(x, 9 + rh / 2, zPanel), 'decal'));
    items.push(item(once(`mt-grate|${rw}`, () => plane(rw - 6, 32, { up: true })), MATCHA_MAT.grate, at(x, TRAY_Y + 0.06, ZA)));
    // nozzle head and tip under the collar
    items.push(item(P.head, MATCHA_MAT.front, at(x, 0, ZA)));
    items.push(item(P.tip, MAT.chrome, at(x, 0, ZA)));
    // the collar with its band, the small knob on its front right and the status LED on its front left
    const col = at(x, 0, ZA);
    items.push(item(P.collar, MATCHA_MAT.olive, col));
    items.push(item(P.band, MATCHA_MAT.oliveDark, col));
    const ka = Math.PI * 0.32;
    const [kx, kz] = section(ka, 0.35, TANK_DEPTH);
    items.push(item(P.knob, MAT.chrome, compose(at(x + kx * (rb + 0.9), (COLLAR[0] + COLLAR[1]) / 2 + 0.6, ZA + kz * (rb + 0.9)), rotationY(Math.PI / 2 - ka), rotationX(Math.PI / 2))));
    const blink = Math.sin(t * 8) > -0.2;
    const ledMat = st === 'ready' ? LED.green : st === 'mixing' && blink ? LED.amber : MAT.ledOff;
    const [lx, lz] = section(Math.PI * 0.64, 0.35, TANK_DEPTH);
    const lp = [x + lx * (rb + 1.1), (COLLAR[0] + COLLAR[1]) / 2 + 1, ZA + lz * (rb + 1.1)];
    items.push(item(once('led-dome', () => sphere(1, 12, 8)), ledMat, compose(at(...lp), scaling(2.4, 2.4, 1.4))));
    if (ledMat !== MAT.ledOff) items.push(glow(st === 'ready' ? '#3dff70' : '#ffc04a', lp[0], lp[1], lp[2] + 2.5, 8, 0.8));
    // the stream from the nozzle: milk first, then the matcha settles on it
    if (ph.pour > 0) {
      const kind = pourFill(slot.progress) < MATCHA_MILK ? 'milk' : 'light';
      const y0 = TRAY_Y + 6;
      items.push(item(P.stream, streamMat(kind), compose(at(x, y0, ZA), scaling(1, NOZZLE_Y - y0, 1))));
    }
    // the water tank: water (bubbles rising while it heats), the smoked shell, its grip, the lid
    const used = st === 'ready' ? 1 : st === 'mixing' ? pourFill(slot.progress) : 0;
    const level = Math.round((COLLAR[1] + (MH - 3 - COLLAR[1]) * (0.72 - 0.12 * used)) * 2) / 2;
    const water = once(`mt-water|${n}|${level}`, () => P.waterBody(level));
    items.push(item(water, MATCHA_MAT.water, at(x, 0, ZA)));
    if (ph.heat > 0) {
      // (on the front of the water, where they show through the smoked shell; the water is opaque)
      const rng = rngFor(`mt-bubbles|${i}`);
      const r0 = rb - 2;
      const r1 = P.tankR(level) - 1.8;
      for (let k = 0; k < 7; k++) {
        const sp = 9 + rng.next() * 7;
        const span = level - COLLAR[1] - 4;
        const y = COLLAR[1] + 2 + ((t * sp + rng.next() * span) % span);
        // evenly across the front (section's x is cos(a) ** e with e = 2 / (2 + 8 · 0.7))
        const u = (rng.next() * 2 - 1) * 0.8;
        const a = Math.acos(Math.sign(u) * Math.abs(u) ** 3.8);
        const rr = r0 + ((r1 - r0) * (y - COLLAR[1] - 1)) / (level - COLLAR[1] - 1);
        const [bx, bz] = section(a, 0.7, TANK_DEPTH);
        const sz = (1.3 + rng.next() * 1.4) * ph.heat;
        items.push(item(P.dust, MATCHA_MAT.bubble, compose(at(x + bx * rr + Math.sin(t * 5 + k) * 0.6, y, ZA + bz * rr), scaling(sz))));
      }
    }
    items.push(item(P.tank, MATCHA_MAT.smoke, at(x, 0, ZA), 'glass'));
    // (the grip lies on the shell, drawn after it: under the smoke it would not read at 1×)
    const gy = (COLLAR[1] + MH) / 2 + 3;
    const gz = ZA + P.tankR(gy) * TANK_DEPTH + 0.6;
    const lean = Math.atan2((rt - rb) * TANK_DEPTH, MH - 3 - COLLAR[1]);
    items.push(item(once(`mt-grip-plane|${n}`, () => plane(rt * 0.36, (MH - COLLAR[1]) * 0.66)), decalMat('mt-grip-mat', gripTexture, 0, { rough: 0.2, coat: 0.6 }),
      compose(at(x - P.tankR(gy) * 0.52, gy, gz), rotationX(-lean), rotationY(-0.2)), 'glass', 1));
    items.push(item(P.lid, MATCHA_MAT.lid, at(x, 0, ZA)));
    items.push(item(P.vent, MAT.blackSatin, at(x + rt * 0.35, 0, ZA - rt * TANK_DEPTH * 0.3)));
    // steam from the lid's vent while it heats: puffs rising, growing and fading (in 8 steps of
    // strength, so the materials stay a handful), blended with a grey edge so they show over white
    if (ph.heat > 0.05) {
      for (let k = 0; k < 5; k++) {
        const life = (t * 0.55 + k / 5) % 1;
        const a = steps8(ph.heat * Math.sin(Math.PI * life) ** 1.5);
        if (!a) continue;
        const y = MH + 3 + life * 32;
        const sx = x + rt * 0.35 + Math.sin(t * 1.7 + k * 2.1 + life * 4) * (2 + life * 7);
        const r = 4 + life * 9;
        const mat = decalMat(`mt-steam-mat|${a}`, steamTexture, 0.3, { alpha: a, rough: 0.9, coat: 0 });
        items.push(item(once('mt-steam-plane', () => plane(2, 2)), mat, compose(at(sx, y, ZA - rt * TANK_DEPTH * 0.3), rotationX(-ELEV), scaling(r)), 'glass'));
      }
    }
  });

  // the tea mill in its arched alcove (one for the whole machine; it grinds while any slot does)
  const grind = Math.max(...phases.map((p) => p.grind));
  const dust = Math.max(...phases.map((p) => p.dust));
  const powder = Math.min(...phases.map((p) => p.powder));
  const mx = M.mill;
  const R = M.millR;
  const aw = Math.round(R * 2 + 10);
  const ah = MILL.cap + 6 - 9;
  items.push(item(once(`mt-alcove-plane|${aw}|${ah}`, () => plane(aw, ah)), decalMat(`mt-alcove-mat|${aw}|${ah}`, () => recessTexture(aw, ah, true), 0, { rough: 0.6, coat: 0.2 }),
    at(mx, 9 + ah / 2, zPanel), 'decal'));
  const mill = at(mx, 0, ZA);
  items.push(item(P.millBase, MATCHA_MAT.millBase, mill));
  const level = Math.round((MILL.base + 3 + 17 * powder) * 2) / 2;
  items.push(item(once(`mt-powder|${n}|${level}`, () => P.powder(level)), MATCHA_MAT.powder, mill));
  const spin = grind > 0 ? t * 9 : 0;
  items.push(item(P.shaft, MAT.chrome, mill));
  items.push(item(P.burr, MATCHA_MAT.burr, compose(mill, at(0, MILL.glass - 11, 0), rotationY(spin))));
  if (dust > 0) {
    // green dust whirled up by the burr
    const rng = rngFor('mt-dust');
    for (let k = 0; k < 9; k++) {
      const a = rng.next() * Math.PI * 2 + t * (4 + rng.next() * 3);
      const rr = (R - 4) * (0.35 + rng.next() * 0.6);
      const y = level + 2 + rng.next() * (MILL.glass - 14 - level) + Math.sin(t * 6 + k) * 1.5;
      items.push(item(P.dust, MATCHA_MAT.powder, compose(mill, at(Math.cos(a) * rr, y, Math.sin(a) * rr), scaling(0.7 + rng.next() * 0.6))));
    }
    if (steps8(dust)) items.push(glow('#b8d873', mx, (level + MILL.glass - 10) / 2, ZA + R, R * 0.95, 0.5 * steps8(dust), { k: 1.1 }));
  }
  items.push(item(P.millGlass, MATCHA_MAT.millGlass, mill, 'glass'));
  for (const y of [MILL.glass - 5, MILL.glass - 2.2]) items.push(item(P.ring, MATCHA_MAT.olive, compose(mill, at(0, y, 0))));
  items.push(item(P.millCap, MATCHA_MAT.millBase, mill));

  // lettering over the mill; the two-slot model has a temperature display above it
  const ly = n === 2 ? 142 : 138;
  const lw = n === 2 ? 50 : 56;
  items.push(item(once(`mt-word-plane|${lw}`, () => plane(lw, lw / 4)), decalMat('mt-word-mat', () => labelTexture('MATCHA', '#e8e2c2', { w: 512, h: 128, spacing: 0.14 })), at(mx, ly, zPanel), 'decal'));
  items.push(item(once('mt-brand-plane', () => plane(36, 4.5)), once('mt-brand-mat', () => labelMat('AÇAÍ FEVER', '#b9b48a', BRAND)), at(mx, ly - 10, zPanel), 'decal'));
  if (n === 2) {
    const disp = once('mt-disp', () => texMat(segmentTexture('80°C', '#a6ff6a'), 1.3, { color: '#000000' }));
    items.push(item(once('mt-disp-plane', () => plane(22, 8.4)), disp, at(mx, ly + 13, zPanel)));
  }
  return { frame, elev: ELEV, time: t, items };
}

// ==================================================================
// Pedal bin
// ==================================================================
// A slim stainless step bin like the ones in café kitchens: a rounded-rectangular body (wider
// than deep, so it sits in the corner of the worktop), a black plastic plinth with a rubber
// bumper, a black lid frame with the white liner's edge folded over it, a flat brushed lid with a
// dark rim that swings up at the back on its hinge, the lifting rod from the pedal up the back, the
// wide pedal in front with its steel tread, and the brand badge on the front. Measures in stage px.
const BIN = { r: 33, h: 86, depth: 0.74, sq: 0.45 };

function binParts() {
  return once('bin', () => {
    const { r, h, depth, sq } = BIN;
    const o = { segs: 72, sq, depth };
    const R = r + 2.4; // the lid and the lid frame reach out over the body
    return {
      // black plinth with the rubber bumper around its foot
      plinth: lathe([[0, 0], [r - 1.2, 0, 1], [r + 0.9, 1.1], [r + 1.4, 3.2], [r + 0.9, 5.6], [r - 0.3, 7.2], [r - 1.6, 8]], o),
      bumper: lathe([[r + 1.0, 0.5], [r + 1.6, 1.3], [r + 1.7, 2.6], [r + 1.2, 3.4]], o),
      // brushed body, a hair wider toward the top like a drawn steel can
      body: lathe([[r - 1.6, 8], [r - 0.3, 9], [r, 12], [r + 0.3, h - 8], [r + 0.2, h - 4.5]], o),
      // black lid frame: out over the body's rim and back in to the opening
      frame: lathe([[r - 0.4, h - 5.5], [R - 0.3, h - 4.2], [R, h - 1.8], [R - 0.2, h], [R - 1.2, h + 1.2], [r - 2.2, h + 1.5], [r - 3, h + 0.6]], o),
      // the inner bucket: its floor, then up the wall to the opening
      inner: lathe([[0, h - 18], [r - 4.4, h - 18, 1], [r - 3.6, h - 4], [r - 3, h + 0.6]], { ...o, inside: true }),
      // the white liner's edge folded over the frame
      liner: lathe([[r - 3.4, h + 0.4], [r - 2.2, h + 1.9], [r - 0.2, h + 2.2], [R - 1.6, h + 1.6], [R - 1.2, h + 0.4]], { ...o, segs: 64 }),
      // the lid: a soft dome with a flat top, its dark rim strip and the black underside
      lid: lathe([[R - 0.6, 0], [R, 1.2], [R - 0.2, 3.2], [R - 1.6, 4.6], [r * 0.72, 6.3], [r * 0.3, 7.2], [0, 7.4]], o),
      lidRim: lathe([[R - 0.6, -0.4], [R + 0.3, 0.4], [R + 0.35, 1.6], [R - 0.1, 2.4]], o),
      lidInside: lathe([[R - 0.6, 0.05], [r - 1, 1.1], [r * 0.7, 3.6], [0, 4.2]], { ...o, inside: true }),
      // hinge at the back: the block on the frame and the knuckle on the lid
      hingeBlock: roundedBox(20, 5, 7, 1.8, 2),
      knuckle: roundedBox(14, 4.2, 4.2, 2, 3),
      // the lifting rod up the back and the arm that lifts the lid
      rod: cylinder(1.3, 5, h - 2, { segs: 12 }),
      arm: roundedBox(3, 2.2, 8, 1, 2),
      // the pedal in front: its black lever on two short arms, the steel tread on it
      pedalArm: roundedBox(4, 3.6, 14, 1.2, 2),
      pedal: roundedBox(r * 1.25, 3.4, 13, 1.6, 2),
      tread: roundedBox(r * 1.25 - 5, 1.1, 8.5, 0.5, 2),
      treadRibs: roundedBox(r * 1.25 - 9, 0.5, 5.5, 0.25, 1),
      // the brand badge on the front
      badge: plane(28, 7),
    };
  });
}

const BIN_MAT = {
  steel: material({ color: '#cdd3d8', metal: 1, rough: 0.26, mode: MODE.BRUSHED, p: [0.55, 1, 0.1, 0] }),
  lid: material({ color: '#d4d9de', metal: 1, rough: 0.2, mode: MODE.BRUSHED, p: [0.6, 0, 0, 0] }),
  bucket: material({ color: '#131316', rough: 0.4, coat: 0.5 }),
  liner: material({ color: '#f1f0ec', rough: 0.55, coat: 0.15 }),
  tread: material({ color: '#c3c9ce', metal: 1, rough: 0.34, mode: MODE.BRUSHED, p: [0.5, 2, 0.1, 0] }),
};

// o = { lid: 0 closed … 1 wide open }
export function trashScene(o = {}, t = 0, frame = VIEWS.trash) {
  const P = binParts();
  const { r, h, depth } = BIN;
  const d = r * depth; // half depth
  const R = r + 2.4;
  const open = clamp(Number(o.lid) || 0, 0, 1.15);
  const items = [];
  // a soft pool of shade under and around it, and the dark contact line right under the plinth
  items.push(shadow(r + 3, d + 3, r * 0.75, 14, 0.42));
  items.push(shadow(r - 0.5, d - 0.5, r * 0.6, 3, 0.7));
  items.push(item(P.plinth, MAT.blackSatin));
  items.push(item(P.bumper, MAT.rubber));
  items.push(item(P.body, BIN_MAT.steel));
  items.push(item(P.inner, BIN_MAT.bucket));
  items.push(item(P.frame, MAT.blackSatin));
  items.push(item(P.liner, BIN_MAT.liner));
  items.push(item(P.badge, once('bin-badge', () => labelMat('AÇAÍ FEVER', '#3a3f46', BRAND)), at(0, h - 14, d + 0.5), 'decal'));
  // the pedal goes down while the lid is up; it hinges at the foot of the plinth
  const press = clamp(open, 0, 1) * 0.3;
  const pedal = compose(at(0, 2.6, d - 3), rotationX(press));
  for (const x of [-9, 9]) items.push(item(P.pedalArm, MAT.blackSatin, compose(pedal, at(x, 0, 6))));
  const lever = compose(pedal, at(0, 0.2, 12));
  items.push(item(P.pedal, MAT.blackSatin, lever));
  items.push(item(P.tread, BIN_MAT.tread, compose(lever, at(0, 2.1, 0.4))));
  items.push(item(P.treadRibs, MAT.chrome, compose(lever, at(0, 2.7, 0.4))));
  // the rod up the back lifts the lid's arm; the hinge sits on the frame
  const zb = -d - 1.9;
  items.push(item(P.rod, MAT.chrome, at(0, 0, zb - 1.2)));
  items.push(item(P.hingeBlock, MAT.blackSatin, at(0, h - 0.8, zb + 0.6)));
  const pivot = [0, h + 2.2, zb - 0.4];
  const lid = compose(rotationAbout(pivot, 'x', -open * 1.22), at(0, h + 2.2, 0));
  items.push(item(P.lid, BIN_MAT.lid, lid));
  items.push(item(P.lidRim, MAT.blackGloss, lid));
  items.push(item(P.lidInside, MAT.blackSatin, lid));
  items.push(item(P.knuckle, MAT.blackSatin, compose(lid, at(0, 1.2, zb + 0.6))));
  items.push(item(P.arm, MAT.chrome, compose(lid, at(0, -0.4, zb - 1.6))));
  return { frame, elev: ELEV, time: t, items };
}

// ==================================================================
// Chest freezer built into the left end of the counter (the base packs are the DOM art)
// ==================================================================
// Seen from above like the worktop around it: a steeper camera with a gentle perspective. A steel
// frame flush with the worktop, the frosty well with a step at the back where spare packs lean
// on the wall, and the two sliding glass lids pushed back over them. Two layers around the packs:
// 'back' = all of it, 'front' = the front of the frame (it hides the feet of the packs) and the
// cold mist that spills over it while a pack is taken out (o.door 0 … 1).
export const FREEZER_ELEV = (60 * Math.PI) / 180;
// opening w × d, well depth h, frame width, step at the back
const FZ = { w: 254, d: 190, h: 96, rim: 14, sq: 0.9, step: [38, 34] };
const FZ_PERSP = { d: 1100, at: [0, FZ.h, 0] };
const SPARE = ['acai', 'pitaya', 'acai', 'spirulina', 'pitaya', 'acai'];
const PACK_COL = { acai: '#5a1f73', pitaya: '#e0266f', spirulina: '#1f86c6' };

function freezerParts() {
  return once('chest', () => {
    const r = FZ.w / 2;
    const R = r + FZ.rim;
    const H = FZ.h;
    const opt = { segs: 160, sq: FZ.sq, depth: FZ.d / FZ.w };
    // outside → over the frame → down the inner wall: the normals face up and into the well
    const frame = [[R, H - 14], [R, H - 2.2], [R - 0.7, H - 0.5], [R - 2.2, H], [r + 2, H], [r + 0.6, H - 0.6], [r, H - 2.4]];
    return {
      frame: lathe(frame, opt),
      // the part in front of the packs: the front edge and the front corners
      frameFront: lathe(frame, { ...opt, segs: 140, a0: Math.PI * 0.06, a1: Math.PI * 0.94 }),
      walls: lathe([[r, H - 2.4], [r, 9], [r - 1.6, 2.6], [r - 6, 0]], opt),
      floor: lathe([[r - 6, 0], [0, 0]], opt),
      rime: lathe([[r - 0.25, H - 2.6], [r - 0.45, H - 10]], opt),
      step: roundedBox(FZ.w - 4, FZ.step[0], FZ.step[1], 4, 3),
      pouch: roundedBox(36, 48, 8, 3.6, 3),
      seal: roundedBox(37, 6, 3, 1.2, 2),
      label: plane(22, 20),
      pane: plane(FZ.w + 12, 76, { up: true }),
      paneEdge: roundedBox(5, 2.6, 76, 1.1, 2),
      handle: roundedBox(226, 6, 9, 3, 3),
      mist: plane(2, 2),
      r,
    };
  });
}

// Label on a spare pack: the fruit on a white patch (the packs in front are the drawn art).
function packLabelTexture(id) {
  return {
    key: `fz-label|${id}`,
    w: 64,
    h: 64,
    draw(ctx) {
      ctx.clearRect(0, 0, 64, 64);
      ctx.fillStyle = '#fbf7f2';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(3, 3, 58, 58, 14) : ctx.rect(3, 3, 58, 58);
      ctx.fill();
      const dot = (x, y, rr, c) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(x, y, rr, 0, Math.PI * 2);
        ctx.fill();
      };
      if (id === 'pitaya') {
        ctx.fillStyle = '#3fa34d';
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(32 + Math.cos(a) * 12, 34 + Math.sin(a) * 12);
          ctx.lineTo(32 + Math.cos(a + 0.35) * 22, 34 + Math.sin(a + 0.35) * 22);
          ctx.lineTo(32 + Math.cos(a + 0.7) * 12, 34 + Math.sin(a + 0.7) * 12);
          ctx.fill();
        }
        dot(32, 34, 15, '#e2266f');
        dot(28, 29, 4, '#ff8ab8');
      } else if (id === 'spirulina') {
        dot(32, 36, 16, '#1f86c6');
        dot(27, 31, 5, '#8fd6f7');
        ctx.fillStyle = '#c99a5a';
        ctx.fillRect(40, 14, 14, 5);
      } else {
        for (const [x, y] of [[24, 30], [36, 28], [30, 40], [42, 39], [20, 42], [33, 51]]) dot(x, y, 7.5, '#3a0f4a');
        for (const [x, y] of [[22, 28], [34, 26], [28, 38], [40, 37]]) dot(x, y, 2.4, '#a06ab8');
        ctx.fillStyle = '#3fa34d';
        ctx.beginPath();
        ctx.ellipse(44, 18, 9, 4, -0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  };
}

// o = { layer: 'back' | 'front', door: 0 … 1 (a pack is being taken out) }
export function freezerScene(o = {}, t = 0, frame = VIEWS.freezer) {
  const P = freezerParts();
  const H = FZ.h;
  const items = [];
  const steel = once('fz-steel', () => material({ color: '#d4dae0', metal: 1, rough: 0.3, mode: MODE.BRUSHED, p: [0.7, 0, 0, 0] }));
  const scene = { frame, elev: FREEZER_ELEV, persp: FZ_PERSP, time: t, items };
  if (o.layer === 'front') {
    items.push(item(P.frameFront, steel));
    const door = clamp(Number(o.door) || 0, 0, 1);
    if (door > 0.04) {
      // cold air spilling out of the well and over the front edge
      const q = Math.max(1, Math.round(door * 8)) / 8;
      const mist = once(`fz-mist|${q}`, () => material({ mode: MODE.GLOW, emit: '#f4fbff', glow: 1.2, alpha: 0.7 * q }));
      for (let i = 0; i < 9; i++) {
        const k = (t * 0.42 + i / 9) % 1;
        const x = -110 + i * 27.5 + Math.sin(t * 0.8 + i * 1.7) * 8;
        const y = H - 14 + k * 26;
        const z = 30 + (i % 3) * 22 + k * 34;
        const s = (16 + k * 26) * (0.35 + 0.65 * Math.sin(k * Math.PI));
        items.push(item(P.mist, mist, compose(at(x, y, z), rotationX(-FREEZER_ELEV), scaling(s)), 'glow'));
      }
    }
    return scene;
  }
  items.push(item(P.frame, steel));
  // the cold well: frosty walls and floor in their own cool light, rime along the top
  const wall = once('fz-wall', () => material({ color: '#7ea7bd', rough: 0.55, mode: MODE.FROST, p: [0.12, 0, 0, 0] }));
  const floor = once('fz-floor', () => material({ color: '#7fa5ba', rough: 0.6, mode: MODE.FROST, p: [0.16, 0, 0, 0] }));
  items.push(item(P.walls, wall));
  items.push(item(P.floor, floor));
  items.push(item(P.rime, once('fz-rime', () => material({ color: '#d9edf6', rough: 0.8, mode: MODE.FROST, p: [0.8, 0, 0, 0] }))));
  items.push(item(P.step, wall, at(0, FZ.step[0] / 2, -FZ.d / 2 + FZ.step[1] / 2)));
  items.push(glow('#dff4ff', 0, 0.5, 30, 110, 0.16, { floor: true }));
  // spare packs leaning on the back wall
  const rng = rngFor('fz-spare');
  SPARE.forEach((id, i) => {
    const lean = 0.34 + rng.next() * 0.14;
    const m = compose(at(-105 + i * 42, FZ.step[0], -FZ.d / 2 + 4.4 + 48 * Math.sin(lean) + 1), rotationY((rng.next() - 0.5) * 0.24), rotationX(-lean));
    const col = PACK_COL[id];
    items.push(item(P.pouch, once(`fz-pouch|${id}`, () => material({ color: col, rough: 0.42, coat: 0.5, mode: MODE.FROST, p: [0.08, 0, 0, 0] })), compose(m, at(0, 24, 0))));
    items.push(item(P.seal, once(`fz-seal|${id}`, () => material({ color: mix(col, '#ffffff', 0.25), rough: 0.35, coat: 0.5 })), compose(m, at(0, 47, 0))));
    items.push(item(P.label, once(`fz-label|${id}`, () => material({ mode: MODE.TEX, tex: packLabelTexture(id), p: [0, 1, 0, 0], rough: 0.4, coat: 0.3 })), compose(m, at(0, 23, 4.1)), 'decal'));
  });
  // the sliding glass lids pushed to the back, the upper one with its handle bar
  const glass = once('fz-glass', () => material({ color: '#dff1f7', alpha: 0.03, rough: 0.05, glass: true, double: true, mode: MODE.FROST, p: [0.01, 0.5, 1, 0] }));
  const lids = [[H + 1.6, -FZ.d / 2 + 30], [H + 4.6, -FZ.d / 2 + 35]];
  lids.forEach(([y, z], i) => {
    items.push(item(P.pane, glass, at(0, y, z), 'glass', i));
    for (const sx of [-1, 1]) items.push(item(P.paneEdge, MAT.gray, at(sx * (P.r + 3.5), y, z)));
  });
  items.push(item(P.handle, steel, at(0, H + 7, lids[1][1] + 36)));
  return scene;
}

export function isAnimated(kind, o = {}) {
  if (kind === 'blender') return o.state === 'blending' || o.state === 'overflowing' || o.state === 'ruined';
  if (kind === 'machine') return (o.slots || []).some((s) => s && s.state === 'mixing');
  if (kind === 'freezer') return o.layer === 'front' && (Number(o.door) || 0) > 0.04;
  return false;
}

export const SCENES = { blender: blenderScene, machine: matchaScene, trash: trashScene, freezer: freezerScene, pantry: pantryScene };
