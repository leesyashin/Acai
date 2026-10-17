// 3D models of the kitchen appliances: the blender (4 motor bases × 2 jugs, one per upgrade
// level), the frozen-drink machine (1 or 2 tanks), the pedal bin and the chest freezer.
// Pure module: every *Scene() returns { frame, elev, time, items } for js/gl3d.js – nothing here
// touches the DOM. Geometry is in stage pixels, the floor is y = 0 and +z points at the player.
// Animations are functions of the state and the time t (seconds), so a scene can be drawn at
// any moment (a paused game simply stops passing new times).

import {
  MODE, material, lathe, roundedBox, tube, sphere, cylinder, plane, polarSurface, updateSurface, merge, section,
  spline, compose, translation, scaling, rotationX, rotationY, rotationZ, rotationAbout, identity,
} from './geo3d.js';
import { ING } from './data.js';
import { mix, rngFor } from './svg.js';
import { pureeOf, smoothieColorOf } from './art-food.js';

// The camera looks down at the worktop by 17° – the angle the cup rims are drawn with.
export const ELEV = (17 * Math.PI) / 180;

// Canvas of each view in CSS px (stage px) and where the world origin (floor centre under the
// appliance) sits in it. The game places the canvases with the same numbers (css/game.css).
export const VIEWS = {
  blender: { w: 126, h: 134, ax: 63, ay: 124, zoom: 0.9 },
  machine: { w: 236, h: 236, ax: 118, ay: 202.7 },
  trash: { w: 136, h: 186, ax: 68, ay: 170, zoom: 1.2 },
  // the freezer's origin is the floor of its well (FREEZER_ELEV, a gentle perspective)
  // (the canvas ends at the worktop's front edge, the frame's front face reaches past it)
  freezer: { w: 284, h: 194, ax: 142, ay: 142, zoom: 0.99 },
};

// The frame of a view scaled to fit a size×size square (shop and menu pictures).
export function fitFrame(frame, size) {
  const k = size / Math.max(frame.w, frame.h);
  return {
    w: size,
    h: size,
    ax: frame.ax * k + (size - frame.w * k) / 2,
    ay: frame.ay * k + (size - frame.h * k) / 2,
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
  chromeKnurl: material({ color: '#e6eaee', metal: 1, rough: 0.16, mode: MODE.KNURL, p: [44, 0, 0, 0] }),
  blackGloss: material({ color: '#17181c', rough: 0.2, coat: 0.8 }),
  blackSatin: material({ color: '#1e1f24', rough: 0.42, coat: 0.25 }),
  blackKnurl: material({ color: '#202126', rough: 0.45, coat: 0.3, mode: MODE.KNURL, p: [36, 0, 0, 0] }),
  rubber: material({ color: '#1b1c20', rough: 0.88 }),
  white: material({ color: '#f3f0ea', rough: 0.3, coat: 0.55 }),
  cream: material({ color: '#e9e4da', rough: 0.36, coat: 0.4 }),
  gray: material({ color: '#8f969d', rough: 0.36, coat: 0.3 }),
  purple: material({ color: '#4b1f72', metal: 0.5, rough: 0.3, coat: 1 }),
  bayBlack: material({ color: '#1a1b20', rough: 0.3, coat: 0.5 }),
  baySteel: material({ color: '#7d858d', metal: 1, rough: 0.36, mode: MODE.BRUSHED, p: [2.6, 1, 0, 0] }),
  panelGlass: material({ color: '#0b0d10', rough: 0.12, coat: 1 }),
  ledOff: material({ color: '#3a3d44', rough: 0.25, coat: 0.6 }),
  bladeSteel: material({ color: '#d6dce1', metal: 1, rough: 0.18 }),
  wing: material({ color: '#e8f4ff', alpha: 0.22, rough: 0.1, glass: true, double: true }),
};

const LED = {
  green: material({ color: '#1fd65a', emit: '#2bff62', glow: 2.2, rough: 0.2, coat: 1 }),
  red: material({ color: '#ff3b3b', emit: '#ff4a4a', glow: 2.4, rough: 0.2, coat: 1 }),
  amber: material({ color: '#ffb000', emit: '#ffbe3b', glow: 2.2, rough: 0.2, coat: 1 }),
  cyan: material({ color: '#27d9ff', emit: '#5ae9ff', glow: 2.4, rough: 0.2, coat: 1 }),
  blue: material({ color: '#3a7bff', emit: '#5b95ff', glow: 2.2, rough: 0.2, coat: 1 }),
  white: material({ color: '#ffffff', emit: '#f4f8ff', glow: 2.4, rough: 0.2, coat: 1 }),
};
const glowMat = (hex, a = 0.8, k = 2.2) => once(`glow|${hex}|${a}|${k}`, () => material({ mode: MODE.GLOW, emit: hex, glow: k, alpha: a }));

function shadow(hw, hd, r, blur, alpha = 0.55, m = I) {
  const mesh = once(`shadow-plane|${hw}|${hd}|${blur}`, () => plane((hw + blur) * 2.2, (hd + blur) * 2.2, { up: true }));
  const mat = once(`shadow|${hw}|${hd}|${r}|${blur}|${alpha}`, () => material({ mode: MODE.SHADOW, alpha, p: [hw, hd, r, blur] }));
  return item(mesh, mat, compose(m, at(0, 0.05, 0)), 'shadow');
}

// Small round glow sprite facing the camera (LED halos) or lying on the floor.
function glow(hex, x, y, z, r, a = 0.8, { floor = false, k = 2.2 } = {}) {
  const mesh = once(`glow-plane|${floor}`, () => plane(2, 2, { up: floor }));
  return item(mesh, glowMat(hex, a, k), compose(at(x, y, z), floor ? I : rotationX(-ELEV), scaling(r, r, r)), 'glow');
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

function segmentTexture(text, color = '#5ff2ff', { w = 160, h = 64, bg = '#05080b' } = {}) {
  return {
    key: `seg|${text}|${color}|${w}|${h}|${bg}`,
    w,
    h,
    draw(ctx) {
      const grd = ctx.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, bg);
      grd.addColorStop(1, '#000000');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
      const cells = [...text];
      const cw = Math.min(30, (w - 16) / Math.max(1, cells.filter((c) => c !== ':' && c !== '.').length + 0.3));
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
    key: `label|${text}|${color}|${w}|${h}`,
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
// printed lettering: only the letters are drawn (decal pass, alpha from the texture)
const labelMat = (text, color) => once(`labelmat|${text}|${color}`, () => material({ mode: MODE.TEX, tex: labelTexture(text, color), p: [0, 1, 0, 0], rough: 0.35, coat: 0.3 }));

// ==================================================================
// Blender
// ==================================================================
// One motor base per Turbo-Mixer level: 0 Classic (white household), 1 Turbo (brushed steel),
// 2 Pro (açaí-purple die-cast with LED ring), 3 Pro Max (black, touch display, light bar).
// The big jug upgrade swaps the 2-bowl jug for a taller, wider one (3 bowls).
export const BLENDER_MODELS = ['Classic', 'Turbo', 'Pro', 'Pro Max'];
const TIERS = [
  { w: 62, d: 52, h: 29, sq: 0.55, taper: 0.08, jugSq: 0.16, body: MAT.white, lid: MAT.gray, handle: MAT.gray },
  { w: 66, d: 54, h: 31, sq: 0.72, taper: 0.05, jugSq: 0.45, body: MAT.steel, lid: MAT.blackSatin, handle: MAT.blackSatin, label: 'TURBO' },
  { w: 70, d: 56, h: 34, sq: 0.6, taper: 0.12, jugSq: 0.62, body: MAT.purple, lid: MAT.blackGloss, handle: MAT.blackGloss, label: 'PRO' },
  { w: 72, d: 58, h: 37, sq: 0.88, taper: 0.03, jugSq: 0.86, body: MAT.blackSatin, lid: MAT.blackGloss, handle: MAT.blackGloss, label: 'PRO MAX' },
];
const BLENDER_STATES = ['empty', 'blending', 'ready', 'overflowing', 'ruined'];

export function blenderLook(upgrades = {}) {
  return { tier: clamp(Math.floor(Number(upgrades.blenderSpeed) || 0), 0, 3), big: (Number(upgrades.jug) || 0) > 0 };
}

// Jug geometry of a model (exported for the tests).
export function blenderJug(tier, big) {
  return jugOf(tier, big);
}

function jugOf(tier, big) {
  const T = TIERS[tier];
  const y0 = T.h + 3;
  const h = big ? 80 : 67;
  return { y0, h, top: y0 + h, rb: big ? 23.5 : 21, rt: big ? 33.5 : 30, sq: T.jugSq, depth: 0.9, floor: y0 + 10 };
}
const jugR = (J, y) => J.rb + (J.rt - J.rb) * Math.pow(clamp((y - J.y0) / J.h, 0, 1), 0.85);
const outline = (sq, depth, r) => (a) => {
  const [x, z] = section(a, sq, depth);
  return [x * r, z * r];
};

// Level of the purée in a ready jug: full with every portion left, a clear layer for the last one.
export function jugLevel(J, portions, maxPortions) {
  const n = Math.max(1, maxPortions || 1);
  const k = clamp(portions ?? n, 1, n);
  const full = J.top - 13;
  return J.floor + (full - J.floor) * (0.24 + (0.76 * k) / n);
}

function baseMesh(T) {
  const R = T.w / 2;
  const top = R * (1 - T.taper);
  return once(`bl-base|${T.w}|${T.h}|${T.taper}|${T.sq}`, () => lathe([
    [0, 0], [R - 2.4, 0], [R - 0.6, 0.7], [R, 2.6], [top + (R - top) * 0.15, T.h - 6], [top, T.h - 4], [top - 1.4, T.h - 1.1], [top - 4.2, T.h], [0, T.h],
  ], { segs: 48, sq: T.sq, depth: T.d / T.w }));
}

// The front of the base at height y: z of the face and how much it leans back.
function baseFront(T, y) {
  const R = T.w / 2;
  const top = R * (1 - T.taper);
  const k = clamp((y - 2.6) / (T.h - 6 - 2.6), 0, 1);
  const r = R + (top + (R - top) * 0.15 - R) * k;
  const lean = Math.atan2((R - (top + (R - top) * 0.15)) * (T.d / T.w), T.h - 8.6);
  return { z: r * (T.d / T.w), lean };
}

function jugMeshes(tier, big) {
  return once(`bl-jug|${tier}|${big}`, () => {
    const J = jugOf(tier, big);
    const prof = [];
    for (let i = 0; i <= 8; i++) {
      const y = J.y0 + 5 + ((J.h - 7) * i) / 8;
      prof.push([jugR(J, y) + 0.4, y]);
    }
    prof.push([J.rt + 1.2, J.top - 1], [J.rt + 1.6, J.top]);
    const opt = { segs: 56, sq: J.sq, depth: J.depth };
    const glass = lathe(prof, opt);
    const collar = lathe([[0, J.y0 - 0.5], [J.rb + 2.8, J.y0 - 0.5, 1], [J.rb + 2.9, J.y0 + 8.5], [J.rb + 1.5, J.y0 + 10.6], [0, J.y0 + 10.6]], opt);
    const coupling = cylinder(J.rb + 1.2, J.y0 - 3.6, J.y0 - 0.4, { segs: 40, sq: J.sq, depth: J.depth, bevel: 0.8 });
    const lid = lathe([[J.rt + 0.4, J.top - 3.4], [J.rt + 2.3, J.top - 2.8], [J.rt + 2.6, J.top + 1.4], [J.rt + 1.6, J.top + 3.2], [J.rt * 0.55, J.top + 3.9], [0, J.top + 3.9]], opt);
    const cap = cylinder(8.5, J.top + 3.2, J.top + 9.2, { segs: 32, bevel: 1.2 });
    // handle on the right (+x) side, flattened like a moulded grip
    const ya = J.top - 9;
    const yb = J.y0 + 17;
    const xa = jugR(J, ya);
    const xb = jugR(J, yb);
    const handle = tube(spline([
      [xa - 2, ya + 1, 0], [xa + 6, ya + 2.5, 0], [xa + 13, ya - 2, 0], [xa + 15, ya - 12, 0],
      [xb + 14, yb + 10, 0], [xb + 10, yb + 1.5, 0], [xb + 2, yb - 0.5, 0], [xb - 2, yb, 0],
    ], 6), 4.3, { segs: 14, squash: 0.62, up: [0, 0, 1] });
    // blade assembly: hub + two pairs of bent blades
    const bladeParts = [];
    const by = J.y0 + 13;
    const bl = J.rb * 0.78;
    for (const [rot, tilt, len] of [[0.35, 0.28, bl], [0.35 + Math.PI, 0.28, bl], [0.35 + Math.PI / 2, -0.3, bl * 0.82], [0.35 + Math.PI * 1.5, -0.3, bl * 0.82]]) {
      bladeParts.push({ mesh: roundedBox(len, 1.1, 4.4, 0.45, 2), m: compose(at(0, by, 0), rotationY(rot), at(len / 2, 0, 0), rotationZ(tilt), rotationX(0.35)) });
    }
    bladeParts.push({ mesh: cylinder(3.6, J.y0 + 8, by + 1, { segs: 20 }), m: I });
    bladeParts.push({ mesh: cylinder(2.2, by, by + 2.4, { segs: 6 }), m: I });
    return { J, glass, collar, coupling, lid, cap, handle, blades: merge(bladeParts) };
  });
}

// Purée inside the jug from the floor up to y: body plus a surface that animates.
function liquidMeshes(J, y) {
  const L = Math.round(y * 2) / 2;
  return once(`bl-liquid|${J.y0}|${J.h}|${J.sq}|${L}`, () => {
    const prof = [[0, J.floor]];
    for (let i = 0; i <= 5; i++) {
      const yy = J.floor + ((L - J.floor) * i) / 5;
      prof.push([jugR(J, yy) - 1.4, yy]);
    }
    return {
      body: lathe(prof, { segs: 48, sq: J.sq, depth: J.depth }),
      surface: polarSurface(outline(J.sq, J.depth, jugR(J, L) - 1.4), 8, 48),
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

// Controls on the front of each base; returns items. o = blender options, t = time.
function blenderControls(tier, T, s, o, t) {
  const items = [];
  const n = clamp(o.maxPortions || 2, 1, 4);
  const left = s === 'ready' || s === 'overflowing' ? clamp(o.portions ?? n, 0, n) : 0;
  const blink = Math.sin(t * 9) > 0;
  const front = (y, dz = 0) => {
    const f = baseFront(T, y);
    return compose(at(0, y, f.z + dz), rotationX(-f.lean));
  };
  const led = (x, y, mat, r = 1.35) => {
    items.push(item(once('led-dome', () => sphere(1, 12, 8)), mat, compose(front(y, 0.2), at(x, 0, 0), scaling(r, r, r * 0.7))));
    if (mat !== MAT.ledOff) {
      const hex = mat === LED.green ? '#3dff70' : mat === LED.red ? '#ff5a5a' : mat === LED.amber ? '#ffc04a' : mat === LED.blue ? '#6aa0ff' : '#6ef0ff';
      const fz = baseFront(T, y).z;
      items.push(glow(hex, x, y, fz + 2, r * 3.4, 0.55));
    }
  };
  const portionLeds = (x0, y, gap) => {
    for (let i = 0; i < n; i++) led(x0 + i * gap, y, i < left ? LED.green : MAT.ledOff, 1.25);
  };
  const knobAngle = { empty: -2.3, blending: 1.15, ready: 0, overflowing: 0.6, ruined: -2.3 }[s];
  const knob = (y, r, mat, depth = 5) => {
    const mesh = once(`knob|${r}|${depth}`, () => lathe([[0, 0], [r, 0, 1], [r, depth - 1.2], [r - 1.2, depth], [0, depth]], { segs: 40 }));
    const m = compose(front(y, -0.5), rotationZ(-knobAngle), rotationX(Math.PI / 2));
    items.push(item(mesh, mat, m));
    items.push(item(once(`knob-mark|${r}`, () => roundedBox(1.5, r * 0.62, 1, 0.5, 2)), MAT.white, compose(front(y, depth - 0.2), rotationZ(-knobAngle), at(0, r * 0.45, 0))));
  };
  const yc = T.h * 0.47;
  if (tier === 0) {
    knob(yc, 7.5, MAT.blackKnurl);
    led(-17, yc + 1, s === 'blending' || s === 'overflowing' ? (s === 'overflowing' && blink ? MAT.ledOff : LED.red) : MAT.ledOff, 1.2);
    portionLeds(15, yc, 5.5);
  } else if (tier === 1) {
    // chrome knob, speed LEDs that chase while blending
    knob(yc - 1, 8, MAT.chromeKnurl, 5.5);
    for (let i = 0; i < 3; i++) {
      const on = s === 'blending' ? Math.floor(t * 8) % 3 === i : false;
      led(-21 + i * 4.6, yc + 6, on ? LED.blue : MAT.ledOff, 1.05);
    }
    portionLeds(15, yc - 1, 5.6);
  } else if (tier === 2) {
    const ring = once('ledring', () => lathe([[8.4, 0], [12.6, 0, 1], [12.6, 0.8, 1], [8.4, 0.8]], { segs: 64 }));
    const share = s === 'blending' ? clamp(o.progress || 0, 0, 1) : s === 'ready' ? 1 : s === 'overflowing' ? (blink ? 1 : 0) : 0;
    const ringMat = once(`ledring|${s === 'overflowing' ? 'r' : 'c'}|${Math.round(share * 24)}`, () => material({
      color: '#202228', rough: 0.3, coat: 0.6, emit: s === 'overflowing' ? '#ff5050' : '#4fe8ff', glow: 2.6, mode: MODE.LEDRING, p: [24, Math.round(share * 24) / 24, 0.12, 0],
    }));
    items.push(item(ring, ringMat, compose(front(yc, 0.1), rotationZ(Math.PI / 2), rotationX(Math.PI / 2))));
    knob(yc, 7.6, MAT.chromeKnurl, 6);
    portionLeds(-25, yc - 1, 5.2);
    if (share > 0) items.push(glow(s === 'overflowing' ? '#ff6060' : '#6ff0ff', 0, yc, baseFront(T, yc).z + 3, 15, 0.35));
  } else {
    // steel front panel with a touch display
    const f = front(yc + 1, 0.15);
    items.push(item(once('max-panel', () => roundedBox(52, 22, 1.2, 3, 3)), MAT.steelV, f));
    items.push(item(once('max-bezel', () => roundedBox(31, 13, 1, 2.2, 3)), MAT.panelGlass, compose(f, at(-5, 0, 0.8))));
    const secs = Math.max(0, Math.ceil(o.remaining ?? 0));
    const text = s === 'blending' ? `0:0${Math.min(9, secs)}` : s === 'ready' ? '✓' : s === 'overflowing' ? (blink ? '!' : ' ') : s === 'ruined' ? 'Err' : '- -';
    const col = s === 'overflowing' ? '#ff5a5a' : s === 'ready' ? '#58ff9c' : s === 'ruined' ? '#ff5a5a' : '#5ff2ff';
    const disp = once(`maxdisp|${text}|${col}`, () => texMat(segmentTexture(text, col), 1.6, { color: '#000000' }));
    items.push(item(once('max-disp', () => plane(27, 10.5)), disp, compose(f, at(-5, 0, 1.35))));
    // touch buttons: start / pulse
    for (const [i, x] of [[0, 15], [1, 21.5]]) {
      const on = (s === 'blending' && i === 0) || (s === 'ready' && i === 1);
      items.push(item(once('touch-ring', () => lathe([[1.6, 0], [2.3, 0, 1], [2.3, 0.3, 1], [1.6, 0.3]], { segs: 24 })), on ? LED.cyan : MAT.ledOff, compose(f, at(x, 2.5, 0.7), rotationX(Math.PI / 2))));
    }
    portionLeds(15.5, yc - 6.2, 4.4);
    // light bar under the base
    const barCol = s === 'overflowing' ? (blink ? LED.red : MAT.ledOff) : s === 'ruined' ? MAT.ledOff : s === 'ready' ? LED.green : s === 'blending' ? LED.cyan : LED.white;
    const fb = baseFront(T, 3);
    items.push(item(once('max-bar', () => roundedBox(48, 1.6, 1.2, 0.6, 2)), barCol, at(0, 3.2, fb.z + 0.2)));
    if (barCol !== MAT.ledOff) {
      const hex = barCol === LED.red ? '#ff5050' : barCol === LED.green ? '#55ff99' : barCol === LED.cyan ? '#55e8ff' : '#ffffff';
      items.push(glow(hex, 0, 0.4, fb.z + 8, 26, barCol === LED.white ? 0.25 : 0.55, { floor: true }));
    }
  }
  if (T.label) {
    // model name: on the black band (Turbo), right of the dial (Pro), above the display (Pro Max)
    const spot = [null, [0, T.h - 4.6, 0.75, 22, 4.6], [21, yc + 0.5, 0.25, 14, 4.4], [-5, yc + 9.2, 1.0, 22, 3.6]][tier];
    const [x, y, dz, w, h] = spot;
    items.push(item(once(`label-plane|${w}|${h}`, () => plane(w, h)), labelMat(T.label, tier === 3 ? '#26292e' : '#eef1f4'), compose(front(y, dz), at(x, 0, 0)), 'decal'));
  }
  return items;
}

// Blender scene. o = { tier 0–3, big, state, base, progress, portions, maxPortions, remaining }.
export function blenderScene(o = {}, t = 0, frame = VIEWS.blender) {
  const tier = clamp(Math.floor(Number(o.tier) || 0), 0, 3);
  const big = !!o.big;
  const s = BLENDER_STATES.includes(o.state) ? o.state : 'empty';
  const T = TIERS[tier];
  const parts = jugMeshes(tier, big);
  const J = parts.J;
  const items = [];
  items.push(shadow(T.w / 2 - 1, T.d / 2 - 1, 12, 10, 0.62));

  // motor base (+ trim per model)
  items.push(item(baseMesh(T), T.body));
  const R = T.w / 2;
  items.push(item(once(`bl-foot|${tier}`, () => lathe([[R - 2.6, 0.02], [R - 0.4, 0.75], [R + 0.25, 2.7], [R + 0.05, 3.1]], { segs: 48, sq: T.sq, depth: T.d / T.w })), MAT.rubber));
  if (tier === 1) {
    const top = R * (1 - T.taper);
    items.push(item(once('bl-band1', () => lathe([[top + (R - top) * 0.2 + 0.35, T.h - 9], [top + 0.3, T.h - 4], [top - 1.1, T.h - 1.1], [top - 4.2, T.h + 0.05], [0, T.h + 0.05]], { segs: 48, sq: T.sq, depth: T.d / T.w })), MAT.blackGloss));
  } else if (tier === 2) {
    items.push(item(once('bl-band2', () => lathe([[R + 0.3, 3.2], [R + 0.25, 5.4]], { segs: 48, sq: T.sq, depth: T.d / T.w })), MAT.chrome));
  }
  items.push(...blenderControls(tier, T, s, o, t));

  // jug, contents and lid move together (vibration while blending)
  let shake = I;
  if (s === 'blending') shake = at(Math.sin(t * 71) * 0.45, Math.abs(Math.sin(t * 53)) * 0.35, Math.sin(t * 61) * 0.3);
  else if (s === 'overflowing') shake = compose(at(0, 0, 0), rotationAbout([0, J.y0, 0], 'z', Math.sin(t * 13) * 0.02));
  items.push(item(parts.coupling, MAT.rubber));
  items.push(item(parts.collar, MAT.blackGloss, shake));
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

  // glass jug (drawn after its contents) with a printed scale on the front left
  const marks = big ? 6 : 5;
  const jugMat = once(`jugmat|${tier}|${big}`, () => material({
    color: '#d7eef6', alpha: tier === 0 ? 0.09 : 0.065, rough: 0.05, glass: true, double: true, mode: MODE.GLASS,
    p: [marks, J.y0 + 16, (J.h - 26) / (marks - 1), 2.05],
  }));
  items.push(item(parts.glass, jugMat, shake, 'glass'));
  items.push(item(parts.handle, T.handle, shake));

  // lid: lifted by the foam when overflowing, crooked on a spoiled jug
  let lidM = shake;
  if (s === 'overflowing') lidM = compose(shake, rotationAbout([-J.rt - 2, J.top + 2, 0], 'z', 0.32 + Math.sin(t * 6) * 0.05), at(0, 7, 0));
  else if (s === 'ruined') lidM = compose(rotationAbout([J.rt, J.top, 0], 'z', -0.06), at(0, 1.2, 0));
  items.push(item(parts.lid, T.lid, lidM));
  items.push(item(parts.cap, tier === 0 ? MAT.cream : tier === 2 ? MAT.chrome : MAT.blackSatin, lidM));

  if (s === 'overflowing') items.push(...overflowFoam(J, base, t));
  if (s === 'ruined') items.push(...flies(J, t));
  return { frame, elev: ELEV, time: t, items };
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
  // drips running down the outside of the jug
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
  items.push(item(once('puddle', () => sphere(1, 24, 8)), drip, compose(at(-22, 0.2, 26), scaling(11, 0.9, 6))));
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
    items.push(item(once('mach-plate', () => plane(26, 4.6)), labelMat('SLUSH', '#f3eefa'), at(26, (HEAD_Y[0] + HEAD_Y[1]) / 2, 40.3), 'decal'));
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

export const SCENES = { blender: blenderScene, machine: machineScene, trash: trashScene, freezer: freezerScene };
