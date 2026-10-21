// The work area on a phone (js/stage.js isPhone): the stage is only about half as big there, and its window is far
// wider than the 1280 × 800 stage (2:1 to 2.5:1), so the desktop arrangement (docs/DESIGN.md §4.7) leaves wide empty
// bands on either side and small stations. Here the stations are arranged in columns across the whole window –
// blenders, freezer, cups over the ingredient risers, the matcha machine over its bar, the trash can – and the whole
// work area is scaled up by k (css transform on .g-work, js/game-view.js), as far as the window's width and the room
// under the pass allow. Every arrangement that fits is tried (freezer under or beside the blenders, the two risers
// behind each other or side by side, the matcha bar's rows likewise, the trash can on its own or beside the extras)
// and the one with the biggest k wins; with few ingredients (the first levels) everything grows by half, with the
// fullest kitchen it still grows a little. All numbers are stage px of the unscaled work area; positions are the
// stations' box origins, as js/game-view.js sets them (left/top of the elements in css/game.css).
//
// Pure: no DOM, so it is unit-tested (tests/kitchen-layout.test.mjs).

import { PANTRY_VIEW } from './pantry3d.js';

// Station sizes shared with js/game-view.js (its CSS boxes in css/game.css).
export const BLENDER_W = 150; // a blender's hit box; a second one stands BLENDER_STEP further right
export const BLENDER_H = 210;
export const BLENDER_STEP = 160;
export const BLENDER_TIMER_H = 13; // the progress bar under its feet (.g-timer top 213 + 10 px, within the box's bottom edge)
export const BLENDER_REACH = 62; // the 3D jug's lid reaches this far above the box (.is-3d .g-blender .g-art top)
export const FREEZER_W = 284;
export const FREEZER_H = 186;
export const FREEZER_GAP = 8; // under the blenders: the freezer's top at BLENDER_H + 8 (css/game.css .g-freezer top 218)
export const STACK_W = 120;
export const STACK_GAP = 6;
export const BOWL_SLOT_W = 120;
export const STACK_TOP = 47; // CUP_FOOT_Y - DISP_COLLAR in js/game-view.js
export const BOWL_TOP = 42; // css/game.css .g-bowl top
export const CUPS_H = 190; // the cups' boxes end here (chips under the cups), the back riser begins at SHELF_MID_TOP
export const SHELF_MID_TOP = 204;
export const SHELF_TOP_TOP = 304;
export const SHELF_H = 100;
export const BIN_H = 84; // a bin's box on its riser (css/game.css .g-bin)
export const BIN_W = PANTRY_VIEW.w; // 96
export const BIN_GAP = 6;
export const RISER_PAD = 14;
export const RISER_MIN = 260;
export const MACHINE_SIZE = 312; // the matcha machine's square box
export const MACHINE_TOP = -73; // its box top above the work area's top (its drip tray's front at y 210)
export const MACHINE_REACH = 32; // the drawn machine's top above the work area
export const MBAR_TOP = { mfruit: 212, mextra: 304 }; // the bar's rows under the machine (js/game-view.js)
export const MBAR_X = 14; // the bar's rows start this far into the machine's column (its riser at the column's left edge)
export const TRASH_W = 104;
export const TRASH_H = 132;
export const TRASH_SINK = 8; // the trash can stands on the floor: its box ends this far below the other stations

export const PHONE_K_MAX = 1.5; // the work area never grows beyond this (the stations would dwarf the guests)
export const PHONE_EDGE = 16; // stage px kept free at the window's (safe area's) edges
export const PHONE_GAP = 20; // between two columns, at least
export const PHONE_GAP_MAX = 56; // a wide window spreads the columns a little, not across the whole counter
export const PHONE_BOTTOM = 792; // stage y of the stations' bottom edge (the trash can's TRASH_SINK lower)
export const PHONE_BOX_TOP = 338; // no station's box reaches above the pass's bottom edge (WORK_Y)…
export const PHONE_REACH_TOP = 276; // …and nothing drawn above a box (a jug's lid) above this: 18 px over the pass's top,
// as the big 3D jug stands on the desktop
const WORK_Y = 338;
const STAGE_W = 1280;

export const rowWidth = (n, w = BIN_W, gap = BIN_GAP) => (n > 0 ? n * w + (n - 1) * gap : 0);
export const riserWidth = (n, min = RISER_MIN) => (n > 0 ? Math.max(min, rowWidth(n) + 2 * RISER_PAD) : 0);
export const cupsWidth = (bowls) => STACK_W + STACK_GAP + bowls * BOWL_SLOT_W;

// A column: its box (w × h, bottom-aligned with the others), what is drawn above it (reach) and a placer that
// returns the stations' positions for the column standing at (x, y).
function blendersCol(n) {
  const w = BLENDER_W + (n - 1) * BLENDER_STEP;
  return {
    id: 'A', w, h: BLENDER_H + BLENDER_TIMER_H, reach: BLENDER_REACH,
    place: (x, y) => ({ blenders: Array.from({ length: n }, (_, i) => ({ x: x + i * BLENDER_STEP, y })) }),
  };
}

function freezerCol() {
  return { id: 'B', w: FREEZER_W, h: FREEZER_H, reach: 0, place: (x, y) => ({ freezer: { x, y } }) };
}

// blenders over the freezer, as on the desktop (the blenders centred over it)
function blendersFreezerCol(n) {
  const bw = BLENDER_W + (n - 1) * BLENDER_STEP;
  const w = Math.max(bw, FREEZER_W);
  return {
    id: 'AB', w, h: BLENDER_H + FREEZER_GAP + FREEZER_H, reach: BLENDER_REACH,
    place: (x, y) => ({
      blenders: Array.from({ length: n }, (_, i) => ({ x: x + Math.round((w - bw) / 2) + i * BLENDER_STEP, y })),
      freezer: { x: x + Math.round((w - FREEZER_W) / 2), y: y + BLENDER_H + FREEZER_GAP },
    }),
  };
}

// the cup dispenser and the bowl spots over the two risers: behind each other (the desktop's way) or side by side
function cupsCol(bowls, mid, top, sideBySide) {
  const cw = cupsWidth(bowls);
  const rm = riserWidth(mid);
  const rt = riserWidth(top);
  const both = mid > 0 && top > 0;
  const w = sideBySide ? Math.max(cw, rm + (both ? PHONE_GAP : 0) + rt) : Math.max(cw, rm, rt);
  const h = both && !sideBySide ? SHELF_TOP_TOP + SHELF_H : mid || top ? SHELF_MID_TOP + SHELF_H : CUPS_H;
  return {
    id: sideBySide ? 'C2' : 'C1', w, h, reach: 0,
    place: (x, y) => {
      const cx = x + Math.round((w - cw) / 2);
      const out = {
        stack: { x: cx, y: y + STACK_TOP },
        bowls: Array.from({ length: bowls }, (_, i) => ({ x: cx + STACK_W + STACK_GAP + i * BOWL_SLOT_W, y: y + BOWL_TOP })),
        cups: { x, y, w }, // the cups' column
        shelves: {},
      };
      // a row's x is its first bin's left edge; js/game-view.js buildShelf centres the riser on the row
      const row = (n, riserLeft) => Math.round(riserLeft + (riserWidth(n) - rowWidth(n)) / 2);
      if (sideBySide) {
        const left = x + Math.round((w - (rm + (both ? PHONE_GAP : 0) + rt)) / 2);
        if (mid) out.shelves.mid = { x: row(mid, left), top: y + SHELF_MID_TOP, stacked: false };
        if (top) out.shelves.top = { x: row(top, left + rm + (both ? PHONE_GAP : 0)), top: y + SHELF_MID_TOP, stacked: false };
      } else {
        if (mid) out.shelves.mid = { x: row(mid, x + (w - rm) / 2), top: y + SHELF_MID_TOP, stacked: true };
        if (top) out.shelves.top = { x: row(top, x + (w - rt) / 2), top: y + (mid ? SHELF_TOP_TOP : SHELF_MID_TOP), stacked: true };
      }
      return out;
    },
  };
}

// the matcha machine over its bar: the fruit row and the extras row behind each other or side by side, the trash
// can beside the extras when there is room for it there (withTrash)
function matchaCol(mfruit, mextra, sideBySide, withTrash) {
  const rf = mfruit ? rowWidth(mfruit) + 2 * RISER_PAD : 0;
  const re = mextra ? rowWidth(mextra) + 2 * RISER_PAD : 0;
  let w = MACHINE_SIZE;
  let h;
  if (sideBySide) {
    w = Math.max(w, rf + (rf && re ? PHONE_GAP : 0) + re);
    h = MBAR_TOP.mfruit + SHELF_H;
  } else {
    // the trash can beside both rows' risers (its box reaches up beside the fruit row's front edge)
    w = Math.max(w, rf, re, withTrash ? Math.max(rf, re) + 4 + TRASH_W : 0);
    h = mextra ? MBAR_TOP.mextra + SHELF_H : MBAR_TOP.mfruit + SHELF_H;
    if (withTrash) h = Math.max(h, MBAR_TOP.mfruit + TRASH_H - TRASH_SINK); // the can's box under the machine's tray
  }
  return {
    id: `D${sideBySide ? 2 : 1}${withTrash ? 't' : ''}`, w, h, reach: MACHINE_REACH,
    place: (x, y) => {
      const out = { machine: { x, y: y + MACHINE_TOP }, shelves: {} };
      if (mfruit) out.shelves.mfruit = { x: x + MBAR_X, top: y + MBAR_TOP.mfruit, stacked: !sideBySide };
      if (mextra) {
        out.shelves.mextra = sideBySide
          ? { x: x + MBAR_X + rf + (rf ? PHONE_GAP : 0), top: y + MBAR_TOP.mfruit, stacked: false }
          : { x: x + MBAR_X, top: y + MBAR_TOP.mextra, stacked: true };
      }
      if (withTrash) out.trash = { x: x + Math.max(rf, re) + 4, y: y + h - TRASH_H + TRASH_SINK };
      return out;
    },
  };
}

function trashCol() {
  return { id: 'E', w: TRASH_W, h: TRASH_H - TRASH_SINK, reach: 0, place: (x, y) => ({ trash: { x, y } }) };
}

/**
 * The phone arrangement of the work area, or null when none fits the window better than the desktop's.
 * @param {object} o
 * @param {number} o.blenders  1 or 2
 * @param {number} o.bowls     bowl spots
 * @param {number} o.mid       owned ingredients of layer 2 (fruits & crunch)
 * @param {number} o.top       owned ingredients of layer 3 (toppings & sauces)
 * @param {{ mfruit: number, mextra: number } | null} o.matcha  the matcha bar's owned ingredients, null without the machine
 * @param {number} o.availW    stage px of the window's width (1280 + 2 · bleed, js/stage.js)
 * @param {number} [o.safeL]   stage px the window's left edge is to be kept free (the notch, css --safe-l)
 * @param {number} [o.safeR]   … and its right edge
 * @param {number} [o.kMin]    the smallest scale worth it (1: smaller than the desktop's arrangement is no gain; a phone
 *                             turned upright keeps its arrangement at whatever fits, js/game-view.js placePhone)
 * @returns {null | { k: number, w: number, h: number, tx: number, ty: number, variant: string, blenders: {x,y}[], freezer: {x,y},
 *   stack: {x,y}, bowls: {x,y}[], cups: {x,y,w}, shelves: Object<string, {x,top,stacked}>, machine?: {x,y}, trash: {x,y} }}
 */
export function phoneLayout({ blenders, bowls, mid, top, matcha = null, availW, safeL = 0, safeR = 0, kMin = 1 }) {
  const roomW = availW - safeL - safeR - 2 * PHONE_EDGE;
  const roomH = PHONE_BOTTOM - PHONE_BOX_TOP;
  const roomR = PHONE_BOTTOM - PHONE_REACH_TOP;
  let best = null;
  const variants = [];
  for (const ab of [true, false]) {
    for (const cSide of [false, true]) {
      const dOpts = matcha ? [[false, false], [false, true], [true, false]] : [[null, false]];
      for (const [dSide, dTrash] of dOpts) {
        const cols = [];
        if (ab) cols.push(blendersFreezerCol(blenders));
        else cols.push(blendersCol(blenders), freezerCol());
        cols.push(cupsCol(bowls, mid, top, cSide));
        if (matcha) cols.push(matchaCol(matcha.mfruit, matcha.mextra, dSide, dTrash));
        if (!dTrash) cols.push(trashCol());
        variants.push(cols);
      }
    }
  }
  for (const cols of variants) {
    const w0 = cols.reduce((s, c) => s + c.w, 0) + (cols.length - 1) * PHONE_GAP;
    const h = Math.max(...cols.map((c) => c.h));
    const reach = Math.max(...cols.map((c) => c.h + c.reach));
    const k = Math.min(PHONE_K_MAX, roomW / w0, roomH / h, roomR / reach);
    // the biggest k wins; the same k: the narrower arrangement (the stations stay close together)
    if (best && (k < best.k - 1e-9 || (Math.abs(k - best.k) <= 1e-9 && w0 >= best.w0))) continue;
    best = { cols, k, h, w0 };
  }
  if (!best || best.k < kMin) return null;
  const { cols, k, h, w0 } = best;
  // a wide window: the columns step apart a little
  const gap = Math.min(PHONE_GAP_MAX, PHONE_GAP + Math.max(0, (roomW / k - w0) / Math.max(1, cols.length - 1)));
  const w = Math.round(w0 + (cols.length - 1) * (gap - PHONE_GAP));
  const out = { k, w, h, variant: cols.map((c) => c.id).join('+'), shelves: {} };
  let x = 0;
  for (const c of cols) {
    const placed = c.place(Math.round(x), h - c.h);
    for (const [key, v] of Object.entries(placed)) {
      if (key === 'shelves') Object.assign(out.shelves, v);
      else out[key] = v;
    }
    x += c.w + gap;
  }
  // the work area's css transform: translate(tx, ty) scale(k) from its top-left corner (stage 0, WORK_Y); the
  // arrangement centred in the safe part of the window, its bottom edge at PHONE_BOTTOM
  const centre = (STAGE_W + safeL - safeR) / 2;
  out.tx = Math.round(centre - (k * w) / 2);
  out.ty = Math.round(PHONE_BOTTOM - WORK_Y - k * h);
  return out;
}
