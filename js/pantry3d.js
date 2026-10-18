// 3D models of the ingredient containers on the counter's oak risers: brushed stainless trays for the
// fruit, a clip-top jar of granola, honey, chia and peanut butter in glass, a squeeze bottle of
// chocolate sauce, half a coconut, a wooden bowl of cacao nibs and a board with mint.
// Pure module like js/kitchen3d.js (which lists it as the view 'pantry'): pantryScene() returns
// { frame, elev, time, ao, items } for js/gl3d.js. The containers never move, so the game draws each
// one once and keeps the picture (js/art3d.js still()). What lies on top of a container – the fruit
// on a tray, the granola heaped in the jar's mouth, flakes, nibs, mint sprigs – is SVG drawn over it
// (js/art-food.js) at pantryPoint() of the same world points; a tray, the coconut and the bowl also
// have a 'front' layer (their front rim) that is drawn over the pieces, so the pieces lie inside.
// Geometry is in stage px at the game's size, the riser's top is y = 0, +z points at the player and
// every container stands with the front of its foot on the line z = 0.

import {
  MODE, material, lathe, roundedBox, tube, sphere, cylinder, plane, polarSurface, updateSurface, merge,
  compose, translation, scaling, rotationX, rotationY, rotationZ, rotationAbout, identity,
} from './geo3d.js';

// The front rows are closer to the player and lower than the appliances: the camera looks down at
// them more steeply (the tilt the SVG fruit pieces are drawn with), so tray tops and jar mouths read.
export const PANTRY_ELEV = (38 * Math.PI) / 180;
const COS = Math.cos(PANTRY_ELEV);
const SIN = Math.sin(PANTRY_ELEV);

// The art box of an ingredient (CSS px; js/game-view.js BIN_W, css/game.css .g-bin .g-art, pinned by
// tests/pantry3d.test.mjs): the world origin – the middle of the front line every container stands
// on – sits at (ax, ay), just above the name tag. The box reaches 28 px above the bin's 84 px hit box
// for the tall bottle and jars.
export const PANTRY_VIEW = { w: 96, h: 112, ax: 48, ay: 96 };

// Where a world point appears in the art box (CSS px of a 96 px wide bin, also the SVG's viewBox).
export function pantryPoint(p, frame = PANTRY_VIEW) {
  const k = frame.zoom || 1;
  return [frame.ax + p[0] * k, frame.ay - (p[1] * COS - p[2] * SIN) * k];
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
const item = (mesh, mat, m = I, pass = 'opaque', order = 0) => ({ mesh, mat, m, pass, order });
const at = translation;
const TAU = Math.PI * 2;

function shadow(hw, hd, r, blur, alpha = 0.5, m = I) {
  const mesh = once(`shadow-plane|${hw}|${hd}|${blur}`, () => plane((hw + blur) * 2.2, (hd + blur) * 2.2, { up: true }));
  const mat = once(`shadow|${hw}|${hd}|${r}|${blur}|${alpha}`, () => material({ mode: MODE.SHADOW, alpha, p: [hw, hd, r, blur] }));
  return item(mesh, mat, compose(m, at(0, 0.05, 0)), 'shadow');
}

// ------------------------------------------------------------------ materials
const MAT = {
  // brushed stainless: fine lines along the tray, glossy enough that the studio's soft boxes put a
  // bright streak on the walls above a darker band
  tray: material({ color: '#cdd4db', metal: 1, rough: 0.14, mode: MODE.BRUSHED, p: [0.75, 2, 0.18, 0] }),
  steel: material({ color: '#dde2e6', metal: 1, rough: 0.16 }),
  // the chia's measuring spoon: satin steel that catches the key light over the dark seeds, its bowl
  // darker inside (it faces away from the studio's soft boxes)
  scoop: material({ color: '#f3f6f8', metal: 1, rough: 0.3 }),
  scoopIn: material({ color: '#7d8790', metal: 1, rough: 0.42 }),
  // the clip-top jar's bail: a darker, satin wire, so it reads against the bright glass
  wire: material({ color: '#aab3bb', metal: 1, rough: 0.34 }),
  // a filled jar's glass: its far side is hidden behind what is in it, so only the near side is drawn (half the work)
  jarGlass: material({ color: '#e4f3f6', alpha: 0.07, rough: 0.04, glass: true, front: true, p: [0, 0, 0, 0.8] }),
  glassLid: material({ color: '#d8edf2', alpha: 0.3, rough: 0.04, glass: true, double: true, p: [0, 0, 0, 0.5] }),
  seal: material({ color: '#e9652b', rough: 0.55, coat: 0.15 }),
  // granola packed behind the glass: toasted clusters, a few darker ones and oat flakes
  granola: material({ color: '#a9692b', color2: '#4a280d', rough: 0.75, mode: MODE.GRAIN, p: [0.3, 0.1, 0.22, 1] }),
  // runny honey: deep amber (the colour of its icon) with lighter swirls and a faint warm glow, glossy
  honey: material({ color: '#a44f02', color2: '#d27f10', emit: '#4a1800', glow: 0.25, rough: 0.06, coat: 1, mode: MODE.PUREE, p: [2, 0.25, 0, 0.6] }),
  // the dipper's grooved head: wood soaked in honey, darker than the honey around it
  honeyCoat: material({ color: '#8a4508', emit: '#3a1400', glow: 0.2, rough: 0.1, coat: 1 }),
  gold: material({ color: '#d8ae4e', metal: 1, rough: 0.24 }),
  goldKnurl: material({ color: '#d2a647', metal: 1, rough: 0.3, mode: MODE.KNURL, p: [110, 0, 0, 0] }),
  // the dipper's handle: warm oiled beech, darker than the honey so it reads against the jar's glints
  dipper: material({ color: '#8a4f20', rough: 0.55, coat: 0.05 }),
  peanut: material({ color: '#93561f', rough: 0.48, coat: 0.2 }),
  peanutTop: material({ color: '#9c5c24', color2: '#bf8446', rough: 0.4, coat: 0.3, mode: MODE.PUREE, p: [2, 0.4, 0, 0.5] }),
  // the peanut butter's lid: a deep red top (a little satin, so the soft boxes do not wash it out) over
  // a knurled skirt
  red: material({ color: '#a8241c', rough: 0.36, coat: 0.3 }),
  redKnurl: material({ color: '#b8352c', rough: 0.32, coat: 0.5, mode: MODE.KNURL, p: [70, 0, 0, 0] }),
  // chia: small long seeds, most of them near black, some grey, a few light
  chia: material({ color: '#6a645a', color2: '#141210', rough: 0.55, mode: MODE.GRAIN, p: [0.8, 0.07, 0.7, 2] }),
  bottle: material({ color: '#3d1e10', rough: 0.24, coat: 0.75 }),
  cap: material({ color: '#2a130a', rough: 0.3, coat: 0.6 }),
  coconut: material({ color: '#6a4126', color2: '#2e1a0e', rough: 0.9, mode: MODE.GRAIN, p: [0.42, 0.45, 0.9, 0] }),
  flesh: material({ color: '#f8f3e8', rough: 0.55, coat: 0.1 }),
  walnut: material({ color: '#7a4a2a', color2: '#3e2210', rough: 0.42, coat: 0.35, mode: MODE.WOOD, p: [0.3, 1.4, 0.55, 0] }),
  board: material({ color: '#93602f', color2: '#5e3a1a', rough: 0.5, coat: 0.15, mode: MODE.WOOD, p: [0.6, 2.2, 0.5, 0] }),
};

// ------------------------------------------------------------------ stainless trays (fruit)
// A small gastronorm pan: rounded-rect plan, walls flaring to a rolled flange that catches the key light.
const TRAY = { hx: 43, hz: 32, h: 19, taper: 4.4, lip: 2.4, sq: 0.86 };
const TD = TRAY.hz / TRAY.hx; // depth of the plan per width
const TRB = TRAY.hx - TRAY.taper; // half width at the bottom
const TRAY_Z = -TRB * TD; // centre of the tray: the front of its bottom on z = 0
const trayOuter = () => {
  const { hx: rt, h, lip } = TRAY;
  return [[TRB, 2], [rt, h, 1], [rt + lip - 0.6, h + 0.25], [rt + lip + 0.3, h + 0.95], [rt + lip - 0.3, h + 1.7], [rt + 0.2, h + 1.45], [rt - 0.9, h + 0.9, 1]];
};
function trayMesh(front) {
  return once(`tray|${front}`, () => {
    const rim = trayOuter();
    if (front) return lathe(rim, { segs: 24, sq: TRAY.sq, depth: TD, a0: 0, a1: Math.PI });
    const profile = [[0, 0], [TRB - 2.4, 0], [TRB - 0.6, 0.5], ...rim, [TRB - 0.4, 2.2], [TRB - 2.4, 1.1], [0, 1.1]];
    return lathe(profile, { segs: 48, sq: TRAY.sq, depth: TD });
  });
}

function trayScene(front) {
  const m = at(0, 0, TRAY_Z);
  if (front) return [item(trayMesh(true), MAT.tray, m)];
  return [shadow(TRB + 2, (TRB + 2) * TD, 9, 5, 0.55, m), item(trayMesh(false), MAT.tray, m)];
}

// ------------------------------------------------------------------ glass jars
// Outer and inner surface of a jar: straight wall, a shoulder up to the neck, a rounded lip.
function jarProfile({ r, h, mouth, neck, t = 1.5 }) {
  const n = mouth + t; // outer radius of the neck
  return [
    [0, 0], [r - 3, 0], [r - 0.7, 0.7], [r, 3],
    [r, h - 6], [r - (r - n) * 0.35, h - 2.2], [n + (r - n) * 0.25, h - 0.4], [n, h + 0.3],
    [n, h + neck - 0.6], [n + 0.4, h + neck], [n - 0.2, h + neck + 0.9], [mouth + 0.3, h + neck + 0.8], [mouth, h + neck - 0.3],
    [mouth, h + 0.6], [mouth + (r - n) * 0.25, h - 1.2], [r - t - (r - n) * 0.3, h - 3], [r - t, h - 6.2],
    [r - t, 3.2], [r - t - 2, t + 0.3], [0, t + 0.3],
  ];
}
// What fills a jar up to y = level (with a little dome on top), just inside its glass.
function fillProfile({ r, h, mouth, t = 1.5 }, level, dome = 0.6) {
  const inner = (y) => (y <= h - 6 ? r - t - 0.25 : y >= h ? mouth - 0.3 : r - t - 0.25 - ((y - (h - 6)) / 6) * (r - t - mouth));
  const p = [[0, t + 0.4], [r - t - 2.2, t + 0.45], [r - t - 0.25, 3.3]];
  for (const y of [h - 6, h - 3, h]) if (y < level) p.push([inner(y), y]);
  p.push([inner(level), level], [inner(level) * 0.55, level + dome * 0.8], [0, level + dome]);
  return p;
}

// The jars (radius r, body h, inner radius of the mouth, neck), centred x along the front line. The
// granola's 1 l clip-top jar is the biggest (its glass ≈0.85 × a cup, ≈1 × with the lid swung back up
// to the top of its art box, under the content chips of the cup behind it), the honey and peanut
// butter jars are 0.5 kg jars.
const GJ = { r: 26, h: 61, mouth: 19.5, neck: 3.5, x: 0 };
const GJ_Z = -GJ.r;
const HJ = { r: 22, h: 46, mouth: 17, neck: 3, x: 15 };
const HJ_Z = -HJ.r;
const PJ = { r: 22, h: 47, mouth: 17.5, neck: 3, x: 14 };
const PJ_Z = -PJ.r;

// Granola: a clip-top storage jar, its glass lid with the orange seal swung right back on the wire
// bail, tipped down a little behind the mouth (22° below level: its glass and seal face the camera
// and read as a lid, yet it stays in the art box) instead of standing up over the jar; the granola
// shows through the glass and is heaped up in the mouth (SVG on top).
const GJ_LID_OPEN = (202 * Math.PI) / 180;
const GJ_LID = { r: GJ.mouth + 2.4, hinge: [0, GJ.h + GJ.neck + 1.2, -(GJ.mouth + 2.6)] };
function clipJarScene() {
  const { r, h, mouth, neck } = GJ;
  const m = at(GJ.x, 0, GJ_Z);
  const top = h + neck;
  const { r: lidR, hinge } = GJ_LID;
  const lidM = compose(m, rotationAbout(hinge, 'x', -GJ_LID_OPEN), at(0, top + 1.2, 0));
  const items = [
    shadow(r - 1, r - 1, r - 1, 4, 0.5, m),
    item(once('gj-fill', () => lathe(fillProfile(GJ, top - 0.8, 0.5), { segs: 24 })), MAT.granola, m),
    item(once('gj-glass', () => lathe(jarProfile(GJ), { segs: 28 })), MAT.jarGlass, m, 'glass'),
    // the bail: a ring around the neck and the lever lying back to the hinge, thick enough to read
    item(once('gj-wire', () => {
      const yN = top - 1.6;
      const rn = mouth + 2.2;
      const ring = [];
      for (let i = 0; i <= 32; i++) {
        const a = (i / 32) * TAU;
        ring.push([Math.cos(a) * rn, yN, Math.sin(a) * rn]);
      }
      const lever = [[-rn, yN, 0], [-rn - 0.5, yN + 2.4, -mouth * 0.72], [-7, hinge[1] + 1.2, hinge[2] - 0.6], [7, hinge[1] + 1.2, hinge[2] - 0.6], [rn + 0.5, yN + 2.4, -mouth * 0.72], [rn, yN, 0]];
      return merge([{ mesh: tube(ring, 1.1, { segs: 6, caps: false }) }, { mesh: tube(lever, 1.2, { segs: 6 }) }]);
    }), MAT.wire, m),
    // the lid's own wire loop around the hinge
    item(once('gj-hinge', () => tube([[-5, -0.2, -lidR + 2], [-5, 1.6, -lidR - 1.6], [5, 1.6, -lidR - 1.6], [5, -0.2, -lidR + 2]], 1, { segs: 6 })), MAT.wire, lidM),
    item(once('gj-lid', () => lathe([[0, -0.2], [lidR - 0.4, -0.2], [lidR + 0.2, 0.9], [lidR - 0.8, 2.4], [lidR * 0.55, 3.9], [0, 4.3]], { segs: 36 })), MAT.glassLid, lidM, 'glass'),
    item(once('gj-seal', () => {
      const ring = [];
      for (let i = 0; i <= 36; i++) {
        const a = (i / 36) * TAU;
        ring.push([Math.cos(a) * (mouth + 1.2), -0.7, Math.sin(a) * (mouth + 1.2)]);
      }
      return tube(ring, 1.15, { segs: 8, caps: false, squash: 0.7, up: [0, 1, 0] });
    }), MAT.seal, lidM),
  ];
  return items;
}

// Honey: a glass jar of runny honey with a wooden dipper in it, the gold twist-off lid set aside.
const HONEY_LEVEL = HJ.h - 4.5;
const HONEY_LID = { x: -28.5, z: -18, r: 16.5 }; // lying top up beside the jar
function honeyScene() {
  const { r } = HJ;
  const m = at(HJ.x, 0, HJ_Z);
  // the head's upper grooves stand out of the honey
  const dip = compose(m, at(2.5, HONEY_LEVEL + 0.5, -3), rotationX(-0.25), rotationZ(-0.55), scaling(1.08));
  const label = once('honey-label', () => material({ color: '#f6ead0', rough: 0.45, coat: 0.3, mode: MODE.TEX, tex: jarLabel('honey') }));
  const lid = at(HONEY_LID.x, 0, HONEY_LID.z);
  return [
    shadow(r - 1, r - 1, r - 1, 4, 0.5, m),
    shadow(16, 16, 16, 3.5, 0.45, lid),
    item(once('hj-fill', () => lathe(fillProfile(HJ, HONEY_LEVEL, 0.4), { segs: 24 })), MAT.honey, m),
    item(once('hj-glass', () => lathe(jarProfile(HJ), { segs: 28 })), MAT.jarGlass, m, 'glass'),
    item(labelBand('honey', HJ.r + 0.2, 12, 32, 1.05), label, m),
    // the dipper's grooved head, coated in honey, and its handle
    item(once('dipper-head', () => lathe([[0, 0], [2.4, 0.15], [3.3, 1], [2.8, 1.9], [3.5, 2.8], [2.8, 3.7], [3.5, 4.6], [2.8, 5.5], [3.5, 6.4], [2.9, 7.4], [1.7, 8.4], [1.35, 9.4], [0, 9.5]], { segs: 24 })), MAT.honeyCoat, dip),
    item(once('dipper-handle', () => merge([{ mesh: cylinder(1.7, 9, 37, { segs: 16 }) }, { mesh: sphere(2.3, 14, 8), m: at(0, 37.5, 0) }])), MAT.dipper, dip),
    item(once('lid-top', () => lathe([[16.4, 4.4], [16.2, 5.2], [14.8, 5.8], [0, 6.1]], { segs: 36 })), MAT.gold, lid),
    item(once('lid-skirt', () => lathe([[16, 0], [16.5, 0.4], [16.5, 4.5]], { segs: 36 })), MAT.goldKnurl, lid),
  ];
}

// Peanut butter: an open jar with a swirled top and a spoon in it, the red screw lid lying beside it
// (its knurled skirt and glossy top: a lid, not a ball or a dish).
const PB_LEVEL = PJ.h - 5;
const PB_LID = { x: -27.5, z: -17, r: PJ.mouth + 1, h: 6.4 };
function peanutScene() {
  const { r } = PJ;
  const m = at(PJ.x, 0, PJ_Z);
  const lid = at(PB_LID.x, 0, PB_LID.z);
  const spoon = compose(m, at(1.5, PB_LEVEL + 0.6, 0.5), rotationY(-0.75), rotationX(-0.12), scaling(1.35));
  const label = once('peanut-label', () => material({ color: '#c8322b', rough: 0.4, coat: 0.4, mode: MODE.TEX, tex: jarLabel('peanut') }));
  const { r: lr, h: lh } = PB_LID;
  return [
    shadow(r - 1, r - 1, r - 1, 4, 0.5, m),
    shadow(lr - 1, lr - 1, lr - 1, 3.5, 0.45, lid),
    item(once('pj-fill', () => lathe(fillProfile(PJ, PB_LEVEL - 0.6, 0), { segs: 24 })), MAT.peanut, m),
    // the swirl the spoon left on top
    item(once('pj-top', () => {
      const s = polarSurface((a) => [Math.cos(a) * (PJ.mouth + 1.6), Math.sin(a) * (PJ.mouth + 1.6)], 8, 36);
      return updateSurface(s, (x, z, k, a) => PB_LEVEL - 0.7 + (1 - k * k) * 1.6 + Math.sin(a * 2 + k * 7) * 0.55 * k);
    }), MAT.peanutTop, m),
    item(once('pj-glass', () => lathe(jarProfile(PJ), { segs: 28 })), MAT.jarGlass, m, 'glass'),
    item(labelBand('peanut', PJ.r + 0.2, 13, 33, 1.05), label, m),
    item(once('spoon', () => merge([
      { mesh: sphere(1, 16, 8), m: compose(at(0, 0, 0), scaling(4.2, 1.3, 6)) },
      { mesh: tube([[0, 0.6, -5.2], [0, 2.2, -10], [0, 6.5, -16], [0, 11, -22]], [1.1, 0.95, 1.05, 1.2], { segs: 8, squash: 0.45, up: [0, 1, 0] }) },
    ])), MAT.steel, spoon),
    // the lid top up: knurled skirt and a glossy top that catches the key light
    item(once('red-skirt', () => lathe([[lr - 0.9, 0], [lr, 0.8], [lr, lh - 1.2]], { segs: 36 })), MAT.redKnurl, lid),
    item(once('red-top', () => lathe([[lr, lh - 1.2], [lr - 0.3, lh - 0.3], [lr - 1.6, lh + 0.1], [lr * 0.5, lh + 0.4], [0, lh + 0.45]], { segs: 36 })), MAT.red, lid),
  ];
}

// Chia: a small open Weck glass of seeds with a round steel measuring spoon on top, its handle over
// the rim toward the front right; the spoon is tipped toward the player (tilt), so its deep bowl with
// a few seeds in it shows.
const CJ = { rb: 17.5, rt: 21, h: 40, x: -5 };
const CJ_Z = -CJ.rb;
const CHIA_LEVEL = 31;
const CHIA_SPOON = { x: -2, z: -4, turn: -0.8, tilt: 0.2, k: 1.7 };
function chiaScene() {
  const { rb, rt, h } = CJ;
  const m = at(CJ.x, 0, CJ_Z);
  const spoon = compose(m, at(CHIA_SPOON.x, CHIA_LEVEL + 0.8, CHIA_SPOON.z), rotationX(CHIA_SPOON.tilt), rotationY(CHIA_SPOON.turn), rotationZ(0.04), scaling(CHIA_SPOON.k));
  const wall = (y) => rb - 1.4 + ((y - 3) / (h - 4)) * (rt - rb);
  return [
    shadow(rb, rb, rb, 4, 0.5, m),
    item(once('cj-fill', () => lathe([[0, 1.7], [rb - 2.6, 1.9], [wall(3) - 0.2, 3.2], [wall(CHIA_LEVEL) - 0.2, CHIA_LEVEL], [wall(CHIA_LEVEL) * 0.6, CHIA_LEVEL + 0.5], [0, CHIA_LEVEL + 0.7]], { segs: 24 })), MAT.chia, m),
    item(once('cj-glass', () => lathe([
      [0, 0], [rb - 2.2, 0], [rb - 0.4, 0.8], [rb, 2.5], [rt - 0.2, h - 1.6], [rt + 0.25, h - 0.5], [rt, h + 0.35], [rt - 1.3, h + 0.2],
      [rt - 1.5, h - 1], [wall(3), 3], [rb - 2.6, 1.5], [0, 1.5],
    ], { segs: 28 })), MAT.jarGlass, m, 'glass'),
    // the spoon: a deep round bowl with a rolled rim and a flat handle; its inside, and the seeds lying
    // low in it
    item(once('scoop', () => merge([
      { mesh: lathe([[0, -0.7], [2.8, -0.45], [4.3, 0.6], [5, 2], [5.15, 3.1], [4.9, 3.45], [4.55, 3.2]], { segs: 24 }) },
      { mesh: tube([[4.6, 3, 0], [9, 5.2, 0], [14.5, 7.4, 0], [21.5, 8.4, 0]], [1.1, 1, 1, 1.35], { segs: 8, squash: 0.3, up: [0, 1, 0] }) },
    ])), MAT.scoop, spoon),
    item(once('scoop-in', () => lathe([[4.55, 3.2], [4.3, 2.1], [3.3, 0.9], [0, 0.45]], { segs: 24 })), MAT.scoopIn, spoon),
    item(once('scoop-seeds', () => lathe([[0, 1.1], [3.75, 1.45], [2.4, 2], [0, 2.25]], { segs: 20 })), MAT.chia, spoon),
  ];
}

// Paper labels on the front of a jar (TEX, u across the label from its left end).
function jarLabel(kind) {
  return {
    key: `pantry-label-${kind}`,
    w: 128,
    h: 64,
    draw(ctx, w, h) {
      if (kind === 'honey') {
        // cream paper with golden honeycomb cells
        ctx.fillStyle = '#f3e3bf';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#c47d0e';
        ctx.lineWidth = 3;
        const r = 11;
        for (let row = -1; row < 5; row++) {
          for (let col = -1; col < 8; col++) {
            const cx = col * r * 1.75 + (row % 2 ? r * 0.87 : 0);
            const cy = row * r * 1.5 + 6;
            ctx.beginPath();
            for (let k = 0; k < 6; k++) {
              const a = (k / 6) * TAU + Math.PI / 6;
              ctx[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
            }
            ctx.closePath();
            ctx.stroke();
          }
        }
        ctx.fillStyle = '#e7a521';
        ctx.globalAlpha = 0.22;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      } else {
        // red label with a peanut in a cream oval
        ctx.fillStyle = '#c8322b';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#f4e6cc';
        ctx.beginPath();
        ctx.ellipse(w / 2, h / 2, 34, 22, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#c99358';
        ctx.strokeStyle = '#8a5a2b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(w / 2 - 9, h / 2, 12, 9, 0, 0, TAU);
        ctx.ellipse(w / 2 + 9, h / 2, 12, 9, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(0, h - 4, w, 4);
    },
  };
}
// The label as a band over the front of a jar: radius r, from y0 to y1, ±half (radians) around the front.
function labelBand(key, r, y0, y1, half) {
  return once(`label-band|${key}|${r}|${y0}|${y1}|${half}`, () => lathe([[r, y0], [r, y1]], { segs: 24, a0: Math.PI / 2 - half, a1: Math.PI / 2 + half }));
}

// Chocolate sauce: a brown squeeze bottle with a nozzle cap and a label (from y0 to y1), about as tall
// as a cup.
const BOTTLE = { r: 15, h: 85, label: [18, 58] };
function labelTexture() {
  return {
    key: 'pantry-choco-label',
    w: 256,
    h: 96,
    draw(ctx, w, hh) {
      ctx.fillStyle = '#f3e7d3';
      ctx.fillRect(0, 0, w, hh);
      // chocolate running down from the top edge all around
      ctx.fillStyle = '#4a2312';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let x = 0; x <= w; x += 16) {
        const d = 14 + ((x * 7) % 23);
        ctx.lineTo(x, 10);
        ctx.quadraticCurveTo(x + 4, d, x + 8, d);
        ctx.quadraticCurveTo(x + 12, d, x + 12, 10);
      }
      ctx.lineTo(w, 0);
      ctx.fill();
      // a cacao bean on the front (u = 0.25 faces the player)
      const cx = w * 0.25;
      const cy = hh * 0.6;
      ctx.fillStyle = '#7a3f1d';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 20, 13, -0.35, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#f3e7d3';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 15, cy + 6);
      ctx.quadraticCurveTo(cx, cy - 2, cx + 15, cy - 6);
      ctx.stroke();
      ctx.fillStyle = '#4a2312';
      ctx.fillRect(0, hh - 9, w, 4);
    },
  };
}
function bottleScene() {
  const { r, h } = BOTTLE;
  const m = at(0, 0, -r);
  const label = once('bottle-label-mat', () => material({ color: '#f3e7d3', rough: 0.4, coat: 0.5, mode: MODE.TEX, tex: labelTexture() }));
  return [
    shadow(r - 1, r - 1, r - 1, 4, 0.5, m),
    item(once('bottle', () => lathe([[0, 0], [r - 2, 0], [r - 0.3, 0.8], [r, 3], [r, h - 6], [r - 1.6, h - 1.6], [r - 4.5, h + 0.6], [8.4, h + 1]], { segs: 36 })), MAT.bottle, m),
    item(once('bottle-label', () => lathe([[r + 0.12, BOTTLE.label[0]], [r + 0.12, BOTTLE.label[1]]], { segs: 36 })), label, m),
    item(once('bottle-cap', () => lathe([[8.4, h + 0.4], [8.9, h + 1.2], [8.9, h + 6.6], [7.6, h + 7.6], [5.6, h + 8], [2.4, h + 16.5], [1.5, h + 18.2], [0, h + 18.6]], { segs: 32 })), MAT.cap, m),
  ];
}

// Half a coconut: fibrous brown outside, a white rim of flesh, filled with flakes (SVG on top); wider
// than the cacao bowl (86 px).
const COCONUT = { r: 43, flesh: 38.5, h: 30, sink: 2, z: -28 };
function coconutParts() {
  const { r, flesh, h, sink } = COCONUT;
  const top = h - sink;
  const outer = [];
  const inner = [];
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * (Math.PI / 2); // 0 at the bottom pole … π/2 at the rim
    outer.push([Math.sin(a) * r, top - Math.cos(a) * h]);
    inner.unshift([Math.sin(a) * flesh, top - Math.cos(a) * (h - 4)]);
  }
  return { outer, inner, top };
}
function coconutScene(front) {
  const { r, flesh, z } = COCONUT;
  const { outer, inner, top } = coconutParts();
  const m = at(0, 0, z);
  const rim = once(`coco-rim|${front}`, () => lathe([[r, top], [flesh, top]], front ? { segs: 20, a0: 0, a1: Math.PI } : { segs: 40 }));
  if (front) {
    return [
      item(once('coco-outer-front', () => lathe(outer.slice(6), { segs: 20, a0: 0, a1: Math.PI })), MAT.coconut, m),
      item(rim, MAT.flesh, m),
    ];
  }
  return [
    shadow(r * 0.62, r * 0.62, r * 0.62, 8, 0.55, m),
    item(once('coco-outer', () => lathe(outer, { segs: 40 })), MAT.coconut, m),
    item(rim, MAT.flesh, m),
    item(once('coco-flesh', () => lathe(inner, { segs: 40 })), MAT.flesh, m),
  ];
}

// Cacao nibs: a small turned walnut bowl (the nibs are SVG on top).
const NIB_BOWL = { r: 40, h: 21, z: -19 };
function bowlParts() {
  const { r, h } = NIB_BOWL;
  return {
    outer: [[0, 0], [r * 0.4, 0], [r * 0.42, 1.1], [r * 0.4, 2.3], [r * 0.58, h * 0.23], [r * 0.78, h * 0.48], [r - 1.6, h - 4.6], [r - 0.3, h - 1]],
    rim: [[r - 0.3, h - 1], [r - 0.6, h + 0.2], [r - 2.2, h + 0.4]],
    inner: [[r - 3.2, h - 0.6], [r - 6.6, h - 5.6], [r * 0.64, h * 0.42], [r * 0.44, 5.6], [0, 4.6]],
  };
}
function bowlScene(front) {
  const { r, z } = NIB_BOWL;
  const p = bowlParts();
  const m = at(0, 0, z);
  if (front) {
    return [item(once('nib-front', () => lathe([...p.outer.slice(5), ...p.rim.slice(1)], { segs: 20, a0: 0, a1: Math.PI })), MAT.walnut, m)];
  }
  return [
    shadow(r * 0.7, r * 0.7, r * 0.7, 7, 0.55, m),
    item(once('nib-bowl', () => lathe([...p.outer, ...p.rim.slice(1), ...p.inner], { segs: 40 })), MAT.walnut, m),
  ];
}

// Mint: a small oak board, the sprigs lie on it (SVG).
const BOARD = { hx: 44, hz: 29, h: 6 };
function boardScene() {
  const { hx, hz, h } = BOARD;
  const m = at(0, h / 2, -hz);
  return [
    shadow(hx - 1, hz - 1, 3, 4, 0.5, at(0, 0, -hz)),
    item(once('board', () => roundedBox(hx * 2, h, hz * 2, 2.2, 3)), MAT.board, m),
  ];
}

// ------------------------------------------------------------------ the containers
// kind of container per ingredient; the base ingredients come as frozen packs (js/art-food.js packIcon).
const KIND = {
  banana: 'tray', strawberry: 'tray', blueberry: 'tray', mango: 'tray', kiwi: 'tray',
  granola: 'clipJar', honey: 'honey', coconut: 'coconut', chia: 'chia', peanut: 'peanut', chocolate: 'bottle', mint: 'board', cacao: 'bowl',
};
const SCENES = {
  tray: trayScene, clipJar: () => clipJarScene(), honey: () => honeyScene(), coconut: coconutScene, chia: () => chiaScene(),
  peanut: () => peanutScene(), bottle: () => bottleScene(), board: () => boardScene(), bowl: bowlScene,
};
const WITH_FRONT = new Set(['tray', 'coconut', 'bowl']);

export const PANTRY_IDS = Object.keys(KIND);
// Every picture the game needs ({ kind, layer }): drawn ahead in idle time (js/main.js).
export const PANTRY_PICTURES = [...new Set(Object.values(KIND))].flatMap((kind) => (WITH_FRONT.has(kind) ? ['back', 'front'] : ['back']).map((layer) => ({ kind, layer })));
export const pantryKind = (id) => KIND[id] || null;
// Whether a container has a front layer (its front rim, drawn over what lies in it).
export const pantryHasFront = (id) => WITH_FRONT.has(KIND[id]);

// The containers' measures for the drawn art (js/art-food.js), per kind (world units, see pantryPoint).
export const PANTRY_GEO = {
  tray: { ...TRAY, cz: TRAY_Z, depth: TD, bottom: TRB },
  clipJar: { ...GJ, z: GJ_Z, lidOpen: GJ_LID_OPEN, lid: GJ_LID },
  honey: { ...HJ, z: HJ_Z, level: HONEY_LEVEL, lid: HONEY_LID },
  peanut: { ...PJ, z: PJ_Z, level: PB_LEVEL, lid: PB_LID },
  chia: { ...CJ, z: CJ_Z, level: CHIA_LEVEL, spoon: CHIA_SPOON },
  bottle: { ...BOTTLE, x: 0, z: -BOTTLE.r },
  coconut: COCONUT,
  bowl: NIB_BOWL,
  board: BOARD,
};

// Art-box y (CSS px) of the back of a container's top (the tray's flange, a jar's or bowl's rim, the
// board's back edge; lids, the dipper, spoons and the nozzle not counted): how tall it stands.
export function pantryHead(id) {
  const y = (x, h, z) => pantryPoint([x, h, z])[1];
  const jar = (J) => y(J.x, J.h + J.neck + 0.9, -J.r - J.mouth - 1.9);
  switch (KIND[id] || 'tray') {
    case 'tray': return y(0, TRAY.h + 1.7, TRAY_Z - (TRAY.hx + TRAY.lip) * TD);
    case 'clipJar': return jar(GJ);
    case 'honey': return jar(HJ);
    case 'peanut': return jar(PJ);
    case 'chia': return y(CJ.x, CJ.h + 0.35, CJ_Z - CJ.rt);
    case 'bottle': return y(0, BOTTLE.h + 18.6, -BOTTLE.r);
    case 'coconut': return y(0, COCONUT.h - COCONUT.sink, COCONUT.z - COCONUT.r);
    case 'bowl': return y(0, NIB_BOWL.h + 0.4, NIB_BOWL.z - NIB_BOWL.r);
    default: return y(0, BOARD.h, -2 * BOARD.hz);
  }
}

// Where the badges of an ingredient's bin go (art-box px, see pantryPoint): the layer badge (20 px)
// and the quality stars (15 px each) on one line for every container, so the badges of a row line up
// just above the pans' flanges – the badge beside the left end of the container's body (on the back
// corner of a wide pan, bowl or board), the stars beside its right end (on the corner of a wide one) –
// and the "NEU" sticker right above the stars, reaching to the gap before the next bin (beside the tall
// granola jar: under its stars). Without stars (q = 0) the sticker takes their place, stuck to the
// container instead of in the air above it; `low` (a sticker of the front row that would cover the
// layer label on the riser behind, js/game-view.js) puts it there too and the stars right under it.
// Honey and peanut butter keep them on the side of the lid lying beside the jar, clear of the dipper or
// spoon leaning out to the right: sticker, badge and stars stacked (a low sticker under the stars). A
// sticker of the front row stays below the back row's name tags (art-box y > 10).
//   { lnum: [left, top], stars: [left, top], fresh: { left | right, top } }  (right: from the box's right edge)
const BADGE_Y = 34;
const STICKER_H = 23; // css/game.css .g-new
export function pantryBadges(id, { q = 0, low = false } = {}) {
  const kind = KIND[id] || 'tray';
  const [x, half] = {
    tray: [0, TRAY.hx + TRAY.lip], clipJar: [GJ.x, GJ.r], honey: [HJ.x, HJ.r], peanut: [PJ.x, PJ.r], chia: [CJ.x, CJ.rt],
    bottle: [0, BOTTLE.r], coconut: [0, COCONUT.r], bowl: [0, NIB_BOWL.r], board: [0, BOARD.hx],
  }[kind];
  const { w, ax } = PANTRY_VIEW;
  const left = Math.round(ax + x - half);
  const right = Math.round(ax + x + half);
  const lnum = [Math.max(0, left - 20), BADGE_Y];
  const starsY = BADGE_Y + 3; // level with the badge, a little gap under the sticker (it wiggles)
  if (kind === 'honey' || kind === 'peanut') {
    const stars = [left - 30, BADGE_Y + 21];
    if (!low) return { lnum, stars, fresh: { left: 0, top: BADGE_Y - STICKER_H } };
    return { lnum, stars, fresh: { left: 0, top: q ? stars[1] + 16 : stars[1] } };
  }
  // the granola jar stands last in its row (after the pans): its stars and sticker may reach past its box
  if (kind === 'clipJar') return { lnum, stars: [right + 1, starsY], fresh: { left: right + 1, top: q ? starsY + 17 : starsY - 2 } };
  const sx = Math.min(right + 1, w - 28);
  if (!q || low) return { lnum, stars: [sx, starsY + STICKER_H + 2], fresh: { right: -6, top: starsY - 2 } };
  return { lnum, stars: [sx, starsY], fresh: { right: -6, top: starsY - STICKER_H - 1 } };
}

// Where the SVG of what lies on/in a container goes (world units, see pantryPoint):
//   tray     { cz, floor, rim, hx, hz (inside the rim), fx, fz (the floor), sq, depth }
//   jar      { x, z, y (top of the neck), r (inner radius of the mouth) }
//   bowl     { x, z, y (rim), r (inner radius at the rim), deep (how far the inside goes down) }
//   board    { x, z, y (top face), hx, hz }
// null for the containers that are 3D through and through (honey, chia, peanut butter, the bottle).
export function pantryTop(id) {
  switch (KIND[id]) {
    case 'tray': return {
      kind: 'tray', cz: TRAY_Z, floor: 1.1, rim: TRAY.h + 0.9, hx: TRAY.hx - 0.9, hz: (TRAY.hx - 0.9) * TD,
      fx: TRB - 2.4, fz: (TRB - 2.4) * TD, sq: TRAY.sq, depth: TD,
    };
    case 'clipJar': return { kind: 'jar', x: GJ.x, z: GJ_Z, y: GJ.h + GJ.neck, r: GJ.mouth };
    case 'coconut': return { kind: 'bowl', x: 0, z: COCONUT.z, y: COCONUT.h - COCONUT.sink, r: COCONUT.flesh, deep: COCONUT.h - 4 };
    case 'bowl': return { kind: 'bowl', x: 0, z: NIB_BOWL.z, y: NIB_BOWL.h - 0.6, r: NIB_BOWL.r - 3.2, deep: NIB_BOWL.h - 5 };
    case 'board': return { kind: 'board', x: 0, z: -BOARD.hz, y: BOARD.h, hx: BOARD.hx, hz: BOARD.hz };
    default: return null;
  }
}

// o = { kind (pantryKind) or id, layer: 'back' | 'front' } → scene; anything unknown draws a fruit tray.
// The five fruit share one tray: the game keys its pictures by kind, so a tray is drawn once.
export function pantryScene(o = {}, t = 0, frame = PANTRY_VIEW) {
  const kind = SCENES[o.kind] ? o.kind : KIND[o.id] || 'tray';
  const front = o.layer === 'front' && WITH_FRONT.has(kind);
  return { frame, elev: PANTRY_ELEV, time: 0, ao: 3.5, items: SCENES[kind](front) };
}
