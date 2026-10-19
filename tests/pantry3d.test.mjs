// Ingredient containers (js/pantry3d.js): every ingredient on the risers has its 3D container, every
// container builds and stays in its art box, the drawn contents land on the 3D container's top, and
// the containers keep believable size relations.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PANTRY_ELEV, PANTRY_VIEW, PANTRY_IDS, PANTRY_GEO, PANTRY_PICTURES, pantryScene, pantryPoint, pantryTop, pantryKind, pantryHasFront, pantryHead,
  pantryBadges,
} from '../js/pantry3d.js';
import { VIEWS, SCENES, isAnimated } from '../js/kitchen3d.js';
import { viewProjection, transformPoint } from '../js/geo3d.js';
import { INGREDIENTS } from '../js/data.js';
import { binSVG, binFillSVG } from '../js/art.js';

const PASSES = new Set(['shadow', 'opaque', 'decal', 'glass', 'glow']);

function assertScene(scene, name, min) {
  assert.ok(scene.items.length >= min, `${name}: ${scene.items.length} parts`);
  assert.equal(scene.elev, PANTRY_ELEV, `${name}: the front rows' camera`);
  assert.ok(scene.ao > 0 && scene.ao < 16, `${name}: a shallow contact darkening for small containers`);
  for (const it of scene.items) {
    assert.ok(PASSES.has(it.pass), `${name}: pass ${it.pass}`);
    assert.ok(it.mesh && it.mesh.pos.length > 0 && it.mesh.idx.length % 3 === 0, `${name}: mesh`);
    assert.ok(it.m.every(Number.isFinite), `${name}: finite matrix`);
    assert.ok(it.mat && it.mat.color.every(Number.isFinite) && it.mat.p.every(Number.isFinite), `${name}: material`);
    for (let i = 0; i < it.mesh.pos.length; i++) assert.ok(Number.isFinite(it.mesh.pos[i]), `${name}: vertex`);
  }
}

// Box (CSS px of the art box) a scene item covers.
function canvasBox(scene, it) {
  const vp = viewProjection(scene.frame, scene.elev);
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i < it.mesh.pos.length; i += 3) {
    const p = transformPoint(it.m, [it.mesh.pos[i], it.mesh.pos[i + 1], it.mesh.pos[i + 2]]);
    const x = (((vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12]) / vp[15] + 1) / 2) * scene.frame.w;
    const y = ((1 - (vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13]) / vp[15]) / 2) * scene.frame.h;
    box[0] = Math.min(box[0], x);
    box[1] = Math.min(box[1], y);
    box[2] = Math.max(box[2], x);
    box[3] = Math.max(box[3], y);
  }
  return box;
}
const extent = (scene) => scene.items.filter((it) => it.pass !== 'shadow').map((it) => canvasBox(scene, it))
  .reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);

// the bowl side's risers (the matcha bar's fruit uses the trays of the bowl fruit, its extras are drawn)
const ON_RISERS = INGREDIENTS.filter((i) => i.layer === 'mid' || i.layer === 'top').map((i) => i.id);
const FRONT_ROW = INGREDIENTS.filter((i) => i.layer === 'top').map((i) => i.id);
// in the game's order (js/game-view.js): the fruit pans first, then the granola jar
const BACK_ROW = INGREDIENTS.filter((i) => i.layer === 'mid').map((i) => i.id).sort((a, b) => (pantryKind(a) !== 'tray') - (pantryKind(b) !== 'tray'));

test('every ingredient on the risers has a container, registered as the 3D view "pantry"', () => {
  assert.deepEqual([...PANTRY_IDS].sort(), [...ON_RISERS].sort());
  assert.equal(VIEWS.pantry, PANTRY_VIEW);
  assert.equal(SCENES.pantry, pantryScene);
  assert.ok(!isAnimated('pantry', { id: 'banana' }), 'a still picture');
  for (const id of ['banana', 'strawberry', 'blueberry', 'mango', 'kiwi']) assert.equal(pantryKind(id), 'tray', `${id} lies on a stainless tray`);
  assert.equal(pantryKind('acai'), null, 'the bases come as frozen packs');
});

test('every container builds, the same every time, its front rim on its own layer', () => {
  for (const id of PANTRY_IDS) {
    const back = pantryScene({ id, layer: 'back' });
    assertScene(back, id, 2);
    assert.ok(back.items.some((it) => it.pass === 'shadow'), `${id}: a contact shadow on the riser`);
    const sig = (s) => s.items.map((it) => `${it.mesh.id}:${[...it.m].join()}`).join('|');
    assert.equal(sig(pantryScene({ id, layer: 'back' })), sig(back), `${id}: meshes come from the cache`);
    if (pantryHasFront(id)) {
      const front = pantryScene({ id, layer: 'front' });
      assertScene(front, `${id} front`, 1);
      assert.ok(front.items.every((it) => it.pass !== 'shadow'), `${id}: the front layer is the rim only`);
      const [, fy0] = extent(front);
      const [, by0, , by1] = extent(back);
      assert.ok(fy0 > by0 + 8 && fy0 < by1, `${id}: the front rim (from y ${fy0.toFixed(1)}) is the near part of the container`);
    }
  }
  // the pictures drawn ahead are all the game needs: one per kind and layer (the trays share theirs)
  const need = new Set(PANTRY_IDS.flatMap((id) => (pantryHasFront(id) ? ['back', 'front'] : ['back']).map((layer) => `${pantryKind(id)}|${layer}`)));
  assert.deepEqual(new Set(PANTRY_PICTURES.map((o) => `${o.kind}|${o.layer}`)), need);
  assert.ok(PANTRY_PICTURES.length < PANTRY_IDS.length, 'shared tray pictures');
  for (const id of PANTRY_IDS) {
    const sig = (s) => s.items.map((it) => it.mesh.id).join();
    assert.equal(sig(pantryScene({ kind: pantryKind(id) })), sig(pantryScene({ id })), `${id}: drawn by its kind`);
  }
  // an unknown id draws a tray rather than nothing
  assert.equal(sig2(pantryScene({ id: 'nope' })), sig2(pantryScene({ id: 'banana' })));
  function sig2(s) {
    return s.items.map((it) => it.mesh.id).join();
  }
});

test('containers stay in their art box and stand on the front line; tall ones leave the row behind readable', () => {
  const { w, h, ax, ay } = PANTRY_VIEW;
  const tops = {};
  for (const id of PANTRY_IDS) {
    const scene = pantryScene({ id, layer: 'back' });
    const [x0, y0, x1, y1] = extent(scene);
    assert.ok(x0 >= 0 && x1 <= w && y0 >= 0 && y1 <= h, `${id}: ${[x0, y0, x1, y1].map((v) => v.toFixed(1))} outside ${w}×${h}`);
    assert.ok(Math.abs(y1 - ay) < 6, `${id}: its foot (y ${y1.toFixed(1)}) on the front line ${ay}`);
    assert.ok(Math.abs((x0 + x1) / 2 - ax) < 14, `${id}: centred in its box`);
    tops[id] = y0;
  }
  // the art box starts 28 px above a bin's hit box. A container of the front row reaches up over the
  // back riser's front edge (art-box y 12–28) but below the back row's name tags (they end at y 10),
  // except the squeeze bottle: its nozzle stands behind them (the tags are drawn over it, like the
  // layer labels). The granola jar of the back row reaches up to the top of the box (its lid under the
  // content chips of the cup behind it, which are drawn over it)
  const tagsEnd = h - 84 - 18;
  for (const id of FRONT_ROW) {
    if (id !== 'chocolate') assert.ok(tops[id] > tagsEnd + 2, `${id} reaches up to ${tops[id].toFixed(1)}`);
  }
  assert.ok(tops.chocolate < tagsEnd, `the bottle reaches up to ${tops.chocolate.toFixed(1)}`);
  assert.ok(tops.granola < 4, `granola reaches up to ${tops.granola.toFixed(1)}`);
  // believable sizes next to a cup (≈97 px): the granola's 1 l jar with its lid and the squeeze bottle
  // about as tall as a cup, the tallest of their rows; the trays are the flattest, the other jars in between
  const height = (id) => ay - tops[id];
  assert.ok(BACK_ROW.every((id) => height('granola') >= height(id)), 'the granola jar stands tallest in the back row');
  assert.ok(FRONT_ROW.every((id) => height('chocolate') >= height(id)), 'the squeeze bottle stands tallest in the front row');
  for (const id of ['granola', 'honey', 'peanut', 'chia']) assert.ok(height(id) > height('banana'), `${id} stands taller than a tray`);
  assert.ok(height('granola') >= 90 && height('chocolate') >= 89 && height('banana') >= 40,
    `granola jar ${height('granola').toFixed(1)} px, bottle ${height('chocolate').toFixed(1)} px, tray ${height('banana').toFixed(1)} px`);
  // the half coconut is clearly wider than the cacao bowl
  const width = (id) => {
    const [x0, , x1] = extent(pantryScene({ id }));
    return x1 - x0;
  };
  assert.ok(width('coconut') >= 84 && width('coconut') > width('cacao') + 4, `coconut ${width('coconut').toFixed(1)} px, bowl ${width('cacao').toFixed(1)} px`);
  // the granola's 1 l jar is clearly the biggest jar, its open lid swung back behind the mouth (tipped
  // a little below level, so it shows as a lid) instead of standing up over the jar
  const body = (id) => ay - pantryHead(id);
  for (const id of ['honey', 'peanut', 'chia']) assert.ok(body('granola') > body(id) + 12, `granola jar ${body('granola').toFixed(1)} px, ${id} ${body(id).toFixed(1)} px`);
  assert.ok(body('granola') >= 78 && PANTRY_GEO.clipJar.r * 2 >= 50, `granola jar ${body('granola').toFixed(1)} px tall, ${PANTRY_GEO.clipJar.r * 2} px wide`);
  const lift = pantryHead('granola') - tops.granola;
  assert.ok(lift > 8 && lift < 18, `the lid adds ${lift.toFixed(1)} px above the jar`);
  assert.ok(PANTRY_GEO.clipJar.lidOpen > Math.PI && PANTRY_GEO.clipJar.lidOpen < Math.PI * 1.25, 'the lid tipped a little below level behind the mouth');
});

test('a container\'s top and the badges beside it; the lids lie flat beside their jars', () => {
  for (const id of PANTRY_IDS) {
    const [, y0, , y1] = extent(pantryScene({ id, layer: 'back' }));
    const head = pantryHead(id);
    assert.ok(head >= y0 - 1.5 && head < y1 - 10, `${id}: head ${head.toFixed(1)} on the container (${y0.toFixed(1)}–${y1.toFixed(1)})`);
  }
  assert.ok(pantryHead('mint') > pantryHead('banana') + 10 && pantryHead('banana') > pantryHead('chocolate') + 20, 'the board is flatter than a pan, a pan than the bottle');
  // the badges' boxes (art-box px): layer badge 20 × 20, two stars 30 × 15, the widest sticker ("NEW") 54 × 23,
  // for every quality (0–2 stars) and with the sticker down beside the container (low: it would cover the
  // layer label on the riser behind)
  const { w, h } = PANTRY_VIEW;
  const variants = [0, 1, 2].flatMap((q) => [{ q }, { q, low: true }]);
  const boxes = (id, o) => {
    const { lnum, stars, fresh } = pantryBadges(id, o);
    const x = 'left' in fresh ? fresh.left : w - fresh.right - 54;
    return { lnum: [lnum[0], lnum[1], lnum[0] + 20, lnum[1] + 20], stars: [stars[0], stars[1], stars[0] + 15 * Math.max(1, o.q), stars[1] + 15], fresh: [x, fresh.top, x + 54, fresh.top + 23] };
  };
  const overlap = (a, b, dx = 0) => Math.min(a[2], b[2] + dx) - Math.max(a[0], b[0] + dx) > 0.5 && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 0.5;
  const tagsEnd = h - 84 - 18; // art-box y where the name tags of the row behind end
  const binTop = h - 84; // art-box y of the bin's box: the back riser's front edge (and its layer label) ends there
  for (const row of [BACK_ROW, FRONT_ROW]) {
    for (const o of variants) {
      assert.equal(new Set(row.map((id) => pantryBadges(id, o).lnum[1])).size, 1, 'the layer badges of a row line up');
      for (const id of row) {
        const b = boxes(id, o);
        const name = `${id} (${JSON.stringify(o)})`;
        assert.ok(!overlap(b.fresh, b.lnum) && (!o.q || (!overlap(b.lnum, b.stars) && !overlap(b.fresh, b.stars))), `${name}: its badges do not cover each other`);
        assert.ok(b.fresh[1] > tagsEnd, `${name}: the sticker stays below the names of the row behind`);
        if (o.low) assert.ok(b.fresh[1] >= binTop, `${name}: a low sticker stays clear of the riser's front edge behind`);
        if (id !== 'granola') assert.ok(Object.values(b).every((r) => r[0] >= -6 && r[2] <= w + 6), `${name}: its badges stay within its box and the gaps beside it`);
      }
      // any two of a row may stand side by side (102 px apart): a badge never reaches over the next bin's
      row.forEach((a, i) => row.slice(i + 1).forEach((c) => {
        for (const p of Object.values(boxes(a, o))) {
          for (const q of Object.values(boxes(c, o))) assert.ok(!overlap(p, q, w + 6), `${a} and ${c}: badges side by side`);
        }
      }));
    }
  }
  // without stars the sticker sits on the badges' line, stuck to the container instead of in the air above it
  for (const id of [...BACK_ROW, ...FRONT_ROW].filter((i) => !['honey', 'peanut'].includes(i))) {
    const { lnum, fresh } = pantryBadges(id, { q: 0 });
    assert.ok(Math.abs(fresh.top - lnum[1]) <= 4, `${id}: the sticker (y ${fresh.top}) beside the badge (y ${lnum[1]})`);
  }
  // beside the container, not on its mouth, dipper, spoon or nozzle: the jars with a lid beside them keep
  // badge and stars left of the jar, the bottle's sticker stays right of its nozzle
  for (const id of ['honey', 'peanut']) {
    const jarLeft = PANTRY_VIEW.ax + PANTRY_GEO[id].x - PANTRY_GEO[id].r;
    const b = boxes(id, { q: 2 });
    assert.ok(b.lnum[2] <= jarLeft + 1 && b.stars[2] <= jarLeft + 1, `${id}: badge and stars beside the jar`);
  }
  assert.ok(boxes('chocolate', { q: 2 }).fresh[0] >= PANTRY_VIEW.ax - 6, 'the sticker beside the nozzle');
  // the honey's and the peanut butter's lid lie on the riser, no taller than their skirt (a lid, not a ball)
  for (const id of ['honey', 'peanut']) {
    const { lid } = PANTRY_GEO[id];
    const parts = pantryScene({ id }).items.filter((it) => it.pass !== 'shadow' && it.m[12] === lid.x && it.m[14] === lid.z);
    assert.ok(parts.length >= 2, `${id}: the lid's parts stand at PANTRY_GEO.${id}.lid`);
    for (const it of parts) {
      for (let i = 0; i < it.mesh.pos.length; i += 3) {
        const y = transformPoint(it.m, [it.mesh.pos[i], it.mesh.pos[i + 1], it.mesh.pos[i + 2]])[1];
        assert.ok(y >= -0.1 && y <= 7.2, `${id}: lid part at height ${y.toFixed(2)}`);
      }
    }
  }
});

test('the art box of a container matches the bins in css/game.css', () => {
  // a bin is 96 × 84 (BIN_W in js/game-view.js is PANTRY_VIEW.w), its art box PANTRY_VIEW, reaching up above it
  const css = readFileSync(new URL('../css/game.css', import.meta.url), 'utf8');
  const rule = (sel) => {
    const m = css.match(new RegExp(`${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`));
    assert.ok(m, `${sel} in css/game.css`);
    return Object.fromEntries(m[1].split(';').map((d) => d.split(':').map((v) => v.trim())).filter((d) => d.length === 2));
  };
  const bin = rule('.screen-game .g-bin');
  const art = rule('.screen-game .g-bin .g-art');
  assert.equal(bin.width, `${PANTRY_VIEW.w}px`);
  assert.equal(art.width, `${PANTRY_VIEW.w}px`);
  assert.equal(art.height, `${PANTRY_VIEW.h}px`);
  assert.equal(art.top, `-${PANTRY_VIEW.h - parseFloat(bin.height)}px`);
  assert.equal(parseFloat(bin.height), 84, 'the hit box under the art box');
});

test('the drawn contents lie on the 3D containers', () => {
  for (const id of PANTRY_IDS) {
    const top = pantryTop(id);
    const fill = binFillSVG(id, PANTRY_VIEW.w);
    if (!top) {
      assert.equal(fill, '', `${id}: all of it is 3D`);
      continue;
    }
    assert.ok(fill.length > 1000, `${id}: something lies in it`);
    const [cx, cy] = pantryPoint([top.x || 0, top.y ?? top.rim, top.z ?? top.cz]);
    const [x0, y0, x1, y1] = extent(pantryScene({ id, layer: 'back' }));
    assert.ok(cx > x0 && cx < x1 && cy > y0 && cy < y1, `${id}: the contents' centre ${cx.toFixed(1)},${cy.toFixed(1)} on the container`);
  }
  assert.ok(PANTRY_GEO.tray.h > 10, 'deep gastronorm pans');
});

test('the drawn containers (no WebGL) and the contents are memoised, sized like the art box', () => {
  for (const id of PANTRY_IDS) {
    const svg = binSVG(id, 96);
    assert.match(svg, /viewBox="0 0 96 112"/, `${id}: the art box`);
    assert.match(svg, /width="96" height="112"/);
    assert.equal(binSVG(id, 96), svg);
    assert.ok(svg.length > binFillSVG(id, 96).length, `${id}: the container is drawn too`);
  }
  assert.notEqual(binSVG('banana', 96), binSVG('kiwi', 96));
});
