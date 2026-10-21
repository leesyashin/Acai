// The phone arrangement of the work area (js/kitchen-layout.js): every station inside the window, none over another,
// the whole thing scaled up as far as the window allows – by half with the first levels' few stations, still a
// little with the fullest kitchen – and never smaller than the desktop's arrangement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  phoneLayout, cupsWidth, riserWidth, rowWidth, BLENDER_W, BLENDER_H, BLENDER_REACH, FREEZER_W, FREEZER_H, STACK_W, BOWL_SLOT_W,
  SHELF_H, BIN_H, MACHINE_SIZE, MACHINE_TOP, MACHINE_REACH, TRASH_W, TRASH_H, TRASH_SINK, PHONE_K_MAX, PHONE_EDGE, PHONE_BOTTOM, PHONE_BOX_TOP,
  PHONE_REACH_TOP, CUPS_H, BOWL_TOP, STACK_TOP,
} from '../js/kitchen-layout.js';

const WORK_Y = 338;
const PHONE_844 = 1731; // 844 × 390: the stage at 0.4875, 225 px of band on either side
const PHONE_932 = 2004; // 932 × 372 (Safari's toolbar showing): 362 px on either side
const LEVEL_1 = { blenders: 1, bowls: 2, mid: 2, top: 1, matcha: null };
const LEVEL_12 = { blenders: 1, bowls: 3, mid: 4, top: 3, matcha: { mfruit: 2, mextra: 1 } };
const FULLEST = { blenders: 2, bowls: 4, mid: 6, top: 7, matcha: { mfruit: 4, mextra: 3 } };

// every station's box in stage px, as the view would draw it
function boxes(lay, spec) {
  const at = (p, w, h) => ({ x1: lay.tx + lay.k * p.x, y1: WORK_Y + lay.ty + lay.k * p.y, x2: lay.tx + lay.k * (p.x + w), y2: WORK_Y + lay.ty + lay.k * (p.y + h) });
  const out = [];
  lay.blenders.forEach((p, i) => out.push({ id: `blender${i}`, ...at(p, BLENDER_W, BLENDER_H), reach: lay.k * BLENDER_REACH }));
  out.push({ id: 'freezer', ...at(lay.freezer, FREEZER_W, FREEZER_H) });
  out.push({ id: 'stack', ...at(lay.stack, STACK_W, 138) });
  lay.bowls.forEach((p, i) => out.push({ id: `bowl${i}`, ...at(p, BOWL_SLOT_W, CUPS_H - BOWL_TOP) }));
  for (const [layer, sh] of Object.entries(lay.shelves)) {
    const n = layer === 'mid' ? spec.mid : layer === 'top' ? spec.top : spec.matcha[layer];
    out.push({ id: `shelf-${layer}`, ...at({ x: sh.x, y: sh.top }, rowWidth(n), BIN_H) }); // the bins' boxes (the riser's front edge below is no target)
  }
  // the machine: its glasses' slots from the work area's top down to its drip tray's front (y 210); the drawn machine
  // reaches MACHINE_REACH above that, over the pass like a jug
  if (lay.machine) out.push({ id: 'machine', ...at({ x: lay.machine.x, y: lay.machine.y - MACHINE_TOP }, MACHINE_SIZE, 210), reach: lay.k * MACHINE_REACH });
  out.push({ id: 'trash', ...at(lay.trash, TRASH_W, TRASH_H) });
  return out;
}

function checkFits(lay, spec, availW, { safeL = 0, safeR = 0 } = {}) {
  const left = -(availW - 1280) / 2 + safeL + PHONE_EDGE - 0.5;
  const right = 1280 + (availW - 1280) / 2 - safeR - PHONE_EDGE + 0.5;
  const bs = boxes(lay, spec);
  for (const b of bs) {
    assert.ok(b.x1 >= left && b.x2 <= right, `${b.id} [${b.x1.toFixed(0)}–${b.x2.toFixed(0)}] outside ${left.toFixed(0)}–${right.toFixed(0)}`);
    assert.ok(b.y1 >= PHONE_BOX_TOP - 0.5, `${b.id} top ${b.y1.toFixed(0)} above the pass's bottom edge`);
    assert.ok(b.y2 <= PHONE_BOTTOM + lay.k * TRASH_SINK + 0.5, `${b.id} bottom ${b.y2.toFixed(0)} below the stage`);
    if (b.reach) assert.ok(b.y1 - b.reach >= PHONE_REACH_TOP - 0.5, `${b.id}'s jug reaches ${(b.y1 - b.reach).toFixed(0)}`);
  }
  for (let i = 0; i < bs.length; i++) {
    for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i];
      const b = bs[j];
      const overlap = a.x1 < b.x2 - 0.5 && b.x1 < a.x2 - 0.5 && a.y1 < b.y2 - 0.5 && b.y1 < a.y2 - 0.5;
      assert.ok(!overlap, `${a.id} and ${b.id} overlap`);
    }
  }
  return bs;
}

test('the first level: everything half as big again, side by side across the phone', () => {
  for (const availW of [PHONE_844, PHONE_932]) {
    const lay = phoneLayout({ ...LEVEL_1, availW });
    assert.ok(lay, 'no arrangement');
    assert.ok(lay.k >= 1.45 && lay.k <= PHONE_K_MAX, `k ${lay.k}`);
    assert.equal(lay.variant, 'A+B+C2+E'); // blenders, freezer, cups over both risers side by side, trash can
    checkFits(lay, LEVEL_1, availW);
    // the stations' bottom edge on the stage's, the arrangement centred
    assert.equal(WORK_Y + lay.ty + Math.round(lay.k * lay.h), PHONE_BOTTOM);
    assert.ok(Math.abs(lay.tx + (lay.k * lay.w) / 2 - 640) <= 1, `centre ${lay.tx + (lay.k * lay.w) / 2}`);
    // the cups stand above the risers, the dispenser left of the spots
    assert.ok(lay.stack.y + STACK_TOP < lay.shelves.mid.top && lay.stack.x < lay.bowls[0].x);
  }
});

test('with the matcha bar the risers stand behind each other and the trash can beside the extras', () => {
  const lay = phoneLayout({ ...LEVEL_12, availW: PHONE_844 });
  assert.ok(lay);
  assert.ok(lay.k > 1.08, `k ${lay.k}`);
  assert.ok(lay.shelves.mid.stacked && lay.shelves.top.top > lay.shelves.mid.top);
  assert.ok(lay.shelves.mextra.top > lay.shelves.mfruit.top);
  assert.ok(lay.trash.x >= lay.shelves.mfruit.x + rowWidth(2), 'the trash can stands clear of the fruit row');
  checkFits(lay, LEVEL_12, PHONE_844);
});

test('the fullest kitchen still fits every phone, a little bigger than on the desktop', () => {
  for (const availW of [PHONE_844, PHONE_932]) {
    const lay = phoneLayout({ ...FULLEST, availW });
    assert.ok(lay, 'no arrangement');
    assert.ok(lay.k >= 1.03 && lay.k < 1.2, `k ${lay.k}`);
    checkFits(lay, FULLEST, availW);
  }
});

test('a notch on one side: the arrangement keeps out of it and centres in what is left', () => {
  const lay = phoneLayout({ ...LEVEL_12, availW: PHONE_932, safeL: 127 });
  assert.ok(lay);
  checkFits(lay, LEVEL_12, PHONE_932, { safeL: 127 });
  assert.ok(Math.abs(lay.tx + (lay.k * lay.w) / 2 - (640 + 127 / 2)) <= 1);
});

test('no arrangement smaller than the desktop (a phone held upright), unless asked for', () => {
  assert.equal(phoneLayout({ ...FULLEST, availW: 1280 }), null);
  const lay = phoneLayout({ ...FULLEST, availW: 1280, kMin: 0.5 });
  assert.ok(lay && lay.k < 1 && lay.k > 0.7, `k ${lay?.k}`);
  checkFits(lay, FULLEST, 1280);
});

test('a kitchen without toppings or with one riser only still lays out', () => {
  for (const spec of [{ blenders: 1, bowls: 2, mid: 1, top: 0, matcha: null }, { blenders: 2, bowls: 3, mid: 0, top: 2, matcha: { mfruit: 1, mextra: 0 } }]) {
    const lay = phoneLayout({ ...spec, availW: PHONE_844 });
    assert.ok(lay, 'no arrangement');
    assert.equal(Object.keys(lay.shelves).length, (spec.mid ? 1 : 0) + (spec.top ? 1 : 0) + (spec.matcha ? (spec.matcha.mfruit ? 1 : 0) + (spec.matcha.mextra ? 1 : 0) : 0));
    checkFits(lay, spec, PHONE_844);
  }
});

test('the widths the view builds with', () => {
  assert.equal(cupsWidth(2), 120 + 6 + 240);
  assert.equal(riserWidth(1), 260); // a riser is never narrower than its label
  assert.equal(riserWidth(7), 7 * 96 + 6 * 6 + 28);
});
