// 3D models of the kitchen appliances: the blender (4 motor bases × 2 jugs, one per upgrade
// level), the frozen-drink machine (1 or 2 tanks), the pedal bin and the chest freezer; the
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
import { pureeOf, smoothieColorOf } from './art-food.js';
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
  glassTank: material({ color: '#e1f2f7', alpha: 0.06, rough: 0.04, glass: true, double: true }),
  steel: material({ color: '#c3c9cf', metal: 1, rough: 0.32, mode: MODE.BRUSHED, p: [0.9, 0, 0, 0] }),
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
  bayBlack: material({ color: '#1a1b20', rough: 0.3, coat: 0.5 }),
  baySteel: material({ color: '#7d858d', metal: 1, rough: 0.36, mode: MODE.BRUSHED, p: [2.6, 1, 0, 0] }),
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
export function blenderBox(tier = 0, big = false, state = 'empty') {
  const tr = clamp(Math.floor(Number(tier) || 0), 0, 3);
  const s = BLENDER_STATES.includes(state) ? state : 'empty';
  return once(`bl-box|${tr}|${!!big}|${s}`, () => {
    const { w, h, ax, ay } = VIEWS.blender;
    const zoom = blenderZoom(tr, big);
    let [x0, y0, x1, y1] = [w, h, 0, 0];
    const o = { tier: tr, big, state: s, base: 'acai', progress: 0.5, remaining: 3, portions: 1, maxPortions: big ? 3 : 2 };
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

// Small line icons of the programmes (ice crush, smoothie glass, bowl, pulse) at x, y, size s px
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
export function blenderScene(o = {}, t = 0, frame = VIEWS.blender) {
  const tier = clamp(Math.floor(Number(o.tier) || 0), 0, 3);
  const big = !!o.big;
  const s = BLENDER_STATES.includes(o.state) ? o.state : 'empty';
  const T = TIERS[tier];
  const parts = jugMeshes(big);
  const J = parts.J;
  const B = baseMeshes();
  const items = [];
  items.push(shadow(BASE.r0 - 1, BASE.r0 * BASE.depth - 1, 12, 10, 0.62));

  // motor base: plinth, body, the black glass band (a chrome line under it on the Pro Max), controls
  items.push(item(B.foot, MAT.blackSatin));
  items.push(item(B.body, T.body));
  items.push(item(B.band, MAT.panelGlass));
  if (T.trim) items.push(item(B.trim, MAT.chrome));
  items.push(...blenderControls(tier, T, s, o, t));

  // jug, contents and lid move together (vibration while blending)
  let shake = I;
  if (s === 'blending') shake = at(Math.sin(t * 71) * 0.45, Math.abs(Math.sin(t * 53)) * 0.35, Math.sin(t * 61) * 0.3);
  else if (s === 'overflowing') shake = compose(at(0, 0, 0), rotationAbout([0, J.y0, 0], 'z', Math.sin(t * 13) * 0.02));
  items.push(item(parts.coupling, MAT.rubber));
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

  if (s === 'overflowing') items.push(...overflowFoam(J, base, t));
  if (s === 'ruined') items.push(...flies(J, t));
  return { frame: { ...frame, zoom: (frame.zoom || 1) * blenderZoom(tier, big) }, elev: ELEV, time: t, items };
}

function overflowFoam(J, base, t) {
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
  items.push(item(once('puddle', () => sphere(1, 24, 8)), drip, compose(at(-24, 0.2, BASE.r0 * BASE.depth + 4), scaling(10.5, 0.9, 5.5))));
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
// Frozen-drink machine (smoothies)
// ==================================================================
// A fruit dropped into a slot fills that tank, the auger churns it into slush, then the tap
// opens and pours it into the cup standing on the drip tray (the cup itself is the DOM art).
// 1 slot: compact white household machine; 2 slots (upgrade): stainless double-tank machine. Both
// wear the café's açaí purple on the head with the taps.
// Cups stand at x = SLOT_X, y = 7, z = 30 – the game's smoothie slots line up with them.
export const MACHINE_SLOT_X = { 1: [0], 2: [-47.2, 47.2] };
const MACHINE = {
  1: { w: 132, tankW: 100, tankD: 74, tankH: 64, cheek: MAT.white, head: MAT.purple, back: MAT.bayBlack, lid: MAT.white, lever: MAT.blackGloss, tray: MAT.chrome },
  2: { w: 216, tankW: 86, tankD: 72, tankH: 64, cheek: MAT.steel, head: MAT.purple, back: MAT.baySteel, lid: MAT.white, lever: MAT.blackGloss, tray: MAT.steel },
};
export const CUP_Z = 30;
export const TRAY_Y = 7.5;
const HEAD_Y = [94, 106];

// Share of the tank filled and the pour state at a point of the mixing progress p.
export function slushPhase(state, p = 0) {
  if (state === 'mixing') {
    const q = clamp(p, 0, 1);
    if (q < 0.12) return { fill: 0.1 + 0.9 * smooth(0, 0.12, q), churn: 1, pour: 0, filling: true };
    if (q < 0.55) return { fill: 1, churn: 1, pour: 0 };
    return { fill: 1 - 0.72 * smooth(0.55, 1, q), churn: 0.6, pour: 1 };
  }
  if (state === 'ready') return { fill: 0.28, churn: 0, pour: 0 };
  return { fill: 0, churn: 0, pour: 0 };
}

// How full the cup under the tap is (the game draws the cup with this level while mixing).
export function pourFill(p = 0) {
  return smooth(0.55, 1, clamp(p, 0, 1));
}

function machineParts(n) {
  return once(`mach|${n}`, () => {
    const M = MACHINE[n];
    const w = M.w;
    const parts = {
      body: roundedBox(w - 4, HEAD_Y[1], 50, 6, 3),
      head: roundedBox(w, HEAD_Y[1] - HEAD_Y[0], 48, 4, 3),
      plinth: roundedBox(w, 5, 52, 2.4, 3),
      cheek: roundedBox(9, HEAD_Y[1], 88, 3.5, 3),
      tray: roundedBox(62, 3, 42, 1.4, 2),
      divider: roundedBox(5, HEAD_Y[0] - 8, 34, 2, 2),
      nozzle: lathe([[0, 0], [2.4, 0, 1], [3.2, 1.6], [3.6, 5], [4.4, 6.5, 1], [0, 6.5]], { segs: 24 }),
      valve: roundedBox(22, 12, 10, 3, 3),
      lever: tube(spline([[0, 0, 0], [0, 6, 2.5], [0, 13, 5.5], [0, 18, 7]], 4), 2.3, { segs: 12, up: [1, 0, 0] }),
      knob: sphere(4.6, 18, 12),
      stream: lathe([[0, 0], [1.9, 0, 1], [1.9, 1, 1], [2.3, 1, 1], [0, 1]], { segs: 18 }),
    };
    // tank (open top), lid, evaporator column and auger
    const r = M.tankW / 2;
    const depth = M.tankD / M.tankW;
    const h = M.tankH;
    const opt = { segs: 56, sq: 0.68, depth };
    parts.tank = lathe([[r - 7, 0], [r - 2.5, 0.4], [r - 0.4, 2.6], [r, 6], [r * 1.02, h - 4], [r * 1.045, h]], opt);
    parts.tankFoot = lathe([[0, -1.5], [r + 1.5, -1.5, 1], [r + 1.5, 1.2], [r - 3, 1.6], [0, 1.6]], opt);
    parts.lid = lathe([[r * 1.06, h - 2], [r * 1.08, h + 2.5], [r * 1.02, h + 6], [r * 0.62, h + 9.5], [0, h + 10]], opt);
    parts.lidCap = cylinder(7, h + 9, h + 13, { segs: 24, bevel: 1 });
    parts.column = cylinder(8.5, 0, h - 9, { segs: 28, bevel: 2 });
    const helix = [];
    const R = Math.min(r * 0.62, 22);
    for (let i = 0; i <= 72; i++) {
      const k = i / 72;
      const a = k * Math.PI * 2 * 2.6;
      helix.push([Math.cos(a) * R, 4 + k * (h - 16), Math.sin(a) * R * depth]);
    }
    parts.auger = tube(helix, 2.1, { segs: 10, squash: 0.55, up: [0, 1, 0] });
    parts.r = r;
    parts.depth = depth;
    return parts;
  });
}

function slushMeshes(n, level) {
  const L = Math.round(level * 2) / 2;
  return once(`slush|${n}|${L}`, () => {
    const M = MACHINE[n];
    const r = M.tankW / 2 - 1.6;
    const depth = M.tankD / M.tankW;
    const rAt = (y) => r * (1 + 0.045 * clamp((y - 6) / (M.tankH - 10), 0, 1)) - (y < 6 ? (6 - y) * 0.6 : 0);
    const prof = [[0, 0.8]];
    for (let i = 0; i <= 5; i++) {
      const y = 0.8 + ((L - 0.8) * i) / 5;
      prof.push([rAt(y), y]);
    }
    return {
      body: lathe(prof, { segs: 48, sq: 0.68, depth }),
      surface: polarSurface(outline(0.68, depth, rAt(L)), 7, 48),
      level: L,
    };
  });
}

const slushMat = (fruit, churning) => once(`slush|${fruit}|${churning}`, () => {
  const c = smoothieColorOf(fruit);
  return material({ color: mix(c, '#3a1a2a', 0.08), color2: mix(c, '#ffffff', 0.45), rough: 0.4, coat: 0.1, mode: MODE.SLUSH, p: [3, 0.12, churning ? 5 : 0, 0.75] });
});
const streamMat = (fruit) => once(`stream|${fruit}`, () => material({ color: smoothieColorOf(fruit), rough: 0.2, coat: 0.3, mode: MODE.STREAM, p: [-2.4, 0, 0, 0] }));

// o = { slots: [{ state, fruit, progress }] } (1 or 2 slots)
export function machineScene(o = {}, t = 0, frame = VIEWS.machine) {
  const slots = (o.slots && o.slots.length ? o.slots : [{ state: 'empty' }]).slice(0, 2);
  const n = slots.length >= 2 ? 2 : 1;
  const M = MACHINE[n];
  const P = machineParts(n);
  const xs = MACHINE_SLOT_X[n];
  const items = [];
  const zc = -3; // centre of the body front to back
  items.push(shadow(M.w / 2 - 2, 44, 10, 11, 0.6, at(0, 0, zc)));
  // body (back wall of the cup bays), head with the taps, plinth, side cheeks
  items.push(item(P.body, M.back, at(0, HEAD_Y[1] / 2, -21)));
  items.push(item(P.head, M.head, at(0, (HEAD_Y[0] + HEAD_Y[1]) / 2, 16)));
  items.push(item(P.plinth, MAT.blackSatin, at(0, 2.5, 14)));
  for (const sx of [-1, 1]) items.push(item(P.cheek, M.cheek, at(sx * (M.w / 2 - 4.5), HEAD_Y[1] / 2, -2)));
  if (n === 2) items.push(item(P.divider, M.cheek, at(0, 8 + (HEAD_Y[0] - 8) / 2, 20)));
  // trim line under the head and the model plate
  items.push(item(once(`mach-trim|${n}`, () => roundedBox(M.w - 6, 1.6, 1.2, 0.6, 2)), MAT.chrome, at(0, HEAD_Y[0] + 1.2, 40.4)));

  slots.forEach((slot, i) => {
    const x = xs[i];
    const st = slot?.state === 'mixing' || slot?.state === 'ready' ? slot.state : 'empty';
    const fruit = slot?.fruit || 'strawberry';
    const ph = slushPhase(st, slot?.progress);
    // drip tray with a grate
    items.push(item(P.tray, M.tray, at(x, TRAY_Y - 1.5, 22)));
    items.push(item(once('mach-grate', () => plane(58, 38, { up: true })), once('grate-mat', () => material({ color: '#c3cad0', metal: 1, rough: 0.26, mode: MODE.GRILLE, p: [20, 1, 0.3, 0] })), at(x, TRAY_Y + 0.06, 22)));
    // tap: valve under the head, nozzle above the cup, lever in front
    items.push(item(P.valve, MAT.white, at(x, HEAD_Y[0] + 3, 38)));
    items.push(item(P.nozzle, MAT.chrome, compose(at(x, HEAD_Y[0] - 0.5, CUP_Z), rotationX(Math.PI))));
    const open = ph.pour > 0 ? 0.75 : 0;
    const lever = compose(at(x, HEAD_Y[0] + 6, 43), rotationX(open));
    items.push(item(P.lever, M.lever, lever));
    items.push(item(P.knob, n === 2 ? once(`knob|${fruit}`, () => material({ color: smoothieColorOf(fruit), rough: 0.25, coat: 0.8 })) : once('knob-red', () => material({ color: '#e8344a', rough: 0.25, coat: 0.9 })), compose(lever, at(0, 18, 7))));
    // status LED on the head
    const ledMat = st === 'ready' ? LED.green : st === 'mixing' ? (Math.sin(t * 8) > -0.2 ? LED.amber : MAT.ledOff) : MAT.ledOff;
    const lx = x + (n === 2 ? -17 : -19);
    items.push(item(once('led-dome', () => sphere(1, 12, 8)), ledMat, compose(at(lx, HEAD_Y[0] + 6, 40.3), scaling(1.5, 1.5, 1))));
    if (ledMat !== MAT.ledOff) items.push(glow(st === 'ready' ? '#3dff70' : '#ffc04a', lx, HEAD_Y[0] + 6, 42, 5, 0.6));
    // stream into the cup
    if (ph.pour > 0) {
      const len = HEAD_Y[0] - 7 - (TRAY_Y + 4);
      items.push(item(P.stream, streamMat(fruit), compose(at(x, TRAY_Y + 4, CUP_Z), scaling(1, len, 1))));
    }
    // tank on top: slush, auger, column, clear bowl, lid
    const tz = zc;
    const tankM = at(x, HEAD_Y[1], tz);
    items.push(item(P.tankFoot, MAT.blackSatin, tankM));
    const spin = ph.churn > 0 ? t * (3.2 * ph.churn + 1) : t * 0.35 * (st === 'ready' ? 1 : 0);
    items.push(item(P.column, MAT.steel, tankM));
    items.push(item(P.auger, MAT.white, compose(tankM, rotationY(spin))));
    if (ph.fill > 0.02) {
      const level = 1 + (M.tankH - 14) * ph.fill;
      const sl = slushMeshes(n, level);
      const mat = slushMat(fruit, ph.churn > 0);
      const L = sl.level;
      const amp = ph.churn > 0 ? 1.6 : 0.4;
      updateSurface(sl.surface, (xx, zz, k, a) => L + amp * Math.sin(2 * a - t * 5 + k * 3) * k + amp * 0.6 * Math.sin(5 * a + t * 3.4) * k * k + (ph.churn ? -2.2 * (1 - k * k) : -0.5 * (1 - k * k)));
      items.push(item(sl.body, mat, tankM));
      items.push(item(sl.surface, mat, tankM));
      if (ph.filling) {
        // fruit pieces tumbling in
        const fm = once(`fruitbit|${fruit}`, () => material({ color: mix(smoothieColorOf(fruit), '#ffffff', 0.1), rough: 0.35, coat: 0.4 }));
        for (let k = 0; k < 4; k++) {
          const ky = L + 30 - ((t * 60 + k * 9) % 34);
          items.push(item(once('chunk', () => roundedBox(1, 1, 1, 0.3, 2)), fm, compose(tankM, at(-12 + k * 8, ky, 4 - k * 3), rotationX(t * 4 + k), rotationY(k), scaling(5.5))));
        }
      }
    }
    items.push(item(P.tank, MAT.glassTank, tankM, 'glass'));
    items.push(item(P.lid, M.lid, tankM));
    items.push(item(P.lidCap, n === 2 ? MAT.blackGloss : MAT.steel, tankM));
  });
  if (n === 2) {
    const disp = once('mach-disp', () => texMat(segmentTexture('-4°C', '#7fd8ff'), 1.3, { color: '#000000' }));
    items.push(item(once('mach-disp-plane', () => plane(22, 8)), disp, at(0, (HEAD_Y[0] + HEAD_Y[1]) / 2, 40.35)));
  } else {
    items.push(item(once('mach-plate', () => plane(26, 4.6)), once('mach-plate-mat', () => labelMat('SLUSH', '#f3eefa')), at(26, (HEAD_Y[0] + HEAD_Y[1]) / 2, 40.3), 'decal'));
  }
  return { frame, elev: ELEV, time: t, items };
}

// ==================================================================
// Pedal bin
// ==================================================================
const BIN = { r: 26, h: 70 };

function binParts() {
  return once('bin', () => {
    const { r, h } = BIN;
    return {
      body: lathe([[r - 1.5, 5.5], [r, 7.5], [r + 1.1, h - 3], [r + 1.4, h - 0.5], [r + 0.4, h]], { segs: 56 }),
      inner: lathe([[0, h - 7], [r - 0.6, h - 7, 1], [r + 0.4, h - 0.4]], { segs: 48 }),
      foot: lathe([[0, 0], [r + 0.6, 0, 1], [r + 1.5, 2.5], [r + 1.4, 7], [r - 1, 8.2], [0, 8.2]], { segs: 56 }),
      lid: lathe([[r + 1.9, 0], [r + 2.1, 1.8], [r + 1.4, 4.4], [r * 0.82, 8.6], [r * 0.4, 10.6], [0, 11]], { segs: 56 }),
      lidInside: lathe([[r + 1.9, 0.05], [r + 0.6, 1.2], [r * 0.8, 6.4], [r * 0.4, 8.6], [0, 9]], { segs: 48, inside: true }),
      rim: lathe([[r + 1.95, -0.3], [r + 2.3, 0.6], [r + 2.3, 2.2], [r + 1.9, 2.6]], { segs: 56 }),
      bag: lathe([[r + 0.2, h - 1.8], [r + 1.6, h - 0.6], [r + 1.3, h + 0.6], [r - 0.5, h + 0.2]], { segs: 48 }),
      pedal: roundedBox(26, 3.6, 15, 1.5, 2),
      plate: roundedBox(22, 1, 10, 0.5, 2),
      hinge: roundedBox(14, 4, 5, 1.6, 2),
    };
  });
}

// o = { lid: 0 closed … 1 wide open }
export function trashScene(o = {}, t = 0, frame = VIEWS.trash) {
  const P = binParts();
  const { r, h } = BIN;
  const open = clamp(Number(o.lid) || 0, 0, 1.15);
  const items = [];
  items.push(shadow(r - 2, r - 3, r - 3, 9, 0.6));
  items.push(item(P.foot, MAT.blackSatin));
  items.push(item(P.body, once('bin-steel', () => material({ color: '#c8ced3', metal: 1, rough: 0.28, mode: MODE.BRUSHED, p: [0.6, 1, 0, 0] }))));
  items.push(item(P.inner, once('bin-in', () => material({ color: '#111114', rough: 0.35, coat: 0.6 }))));
  items.push(item(P.bag, MAT.blackGloss));
  // pedal goes down while the lid is up
  const press = clamp(open, 0, 1) * 0.28;
  const pedal = compose(at(0, 3.2, r - 2), rotationX(press), at(0, 0, 8));
  items.push(item(P.pedal, MAT.blackSatin, pedal));
  items.push(item(P.plate, MAT.chrome, compose(pedal, at(0, 2.2, 0.6))));
  items.push(item(P.hinge, MAT.blackSatin, at(0, h - 1, -r - 1.6)));
  const lid = compose(rotationAbout([0, h + 0.4, -r - 1.8], 'x', -open * 1.2), at(0, h + 0.4, 0));
  items.push(item(P.lid, once('bin-lid', () => material({ color: '#cfd5da', metal: 1, rough: 0.22, mode: MODE.BRUSHED, p: [0.7, 0, 0, 0] })), lid));
  items.push(item(P.rim, MAT.blackGloss, lid));
  items.push(item(P.lidInside, MAT.blackSatin, lid));
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

export const SCENES = { blender: blenderScene, machine: machineScene, trash: trashScene, freezer: freezerScene, pantry: pantryScene };
