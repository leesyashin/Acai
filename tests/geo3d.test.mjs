// 3D math and mesh builders (js/geo3d.js): matrices, camera mapping, closed meshes whose
// triangles wind counter-clockwise around outward normals (back-face culling depends on it).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  identity, multiply, compose, translation, scaling, rotationX, rotationY, rotationZ, rotationAbout, normalMatrix,
  transformPoint, viewProjection, screenOf, lathe, roundedBox, tube, sphere, cylinder, plane, polarSurface,
  updateSurface, merge, bounds, section, sectionArc, flute, spline, material, linear, MODE,
} from '../js/geo3d.js';

const close = (a, b, eps = 1e-4) => Math.abs(a - b) <= eps;

// Every non-degenerate triangle's face normal agrees with its vertex normals.
function assertWinding(mesh, name) {
  const p = mesh.pos;
  const n = mesh.nor;
  let checked = 0;
  for (let i = 0; i < mesh.idx.length; i += 3) {
    const [a, b, c] = [mesh.idx[i] * 3, mesh.idx[i + 1] * 3, mesh.idx[i + 2] * 3];
    const u = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]];
    const v = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
    const f = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const len = Math.hypot(...f);
    if (len < 1e-6) continue;
    const avg = [n[a] + n[b] + n[c], n[a + 1] + n[b + 1] + n[c + 1], n[a + 2] + n[b + 2] + n[c + 2]];
    assert.ok(f[0] * avg[0] + f[1] * avg[1] + f[2] * avg[2] > 0, `${name}: triangle ${i / 3} winds against its normals`);
    checked++;
  }
  assert.ok(checked > 0, `${name}: no triangles`);
}

function assertUnitNormals(mesh, name) {
  for (let i = 0; i < mesh.nor.length; i += 3) {
    const l = Math.hypot(mesh.nor[i], mesh.nor[i + 1], mesh.nor[i + 2]);
    assert.ok(close(l, 1, 1e-3), `${name}: normal ${i / 3} has length ${l}`);
  }
}

test('matrices: identity, product order, rotations', () => {
  const t = translation(5, -2, 3);
  assert.deepEqual([...multiply(identity(), t)], [...t]);
  // compose(A, B) applies B first: rotate the point, then move it
  const m = compose(translation(10, 0, 0), rotationZ(Math.PI / 2));
  const p = transformPoint(m, [1, 0, 0]);
  assert.ok(close(p[0], 10) && close(p[1], 1) && close(p[2], 0), `got ${p}`);
  // right-handed rotations
  const y = transformPoint(rotationX(Math.PI / 2), [0, 1, 0]);
  assert.ok(close(y[2], 1), 'rotationX turns +y toward +z');
  const x = transformPoint(rotationY(Math.PI / 2), [1, 0, 0]);
  assert.ok(close(x[2], -1), 'rotationY turns +x toward −z');
  const hinge = transformPoint(rotationAbout([0, 10, 0], 'z', Math.PI / 2), [5, 10, 0]);
  assert.ok(close(hinge[0], 0) && close(hinge[1], 15), `rotation about a point: ${hinge}`);
});

test('normal matrix: rotations keep normals, scaling bends them the right way', () => {
  const r = normalMatrix(rotationY(0.7));
  const m = rotationY(0.7);
  for (const [i, j] of [[0, 0], [1, 1], [2, 2], [0, 2], [2, 0]]) assert.ok(close(r[j * 3 + i], m[j * 4 + i]), 'rotation part');
  // a surface tilted 45° in a box squashed to half height becomes steeper → its normal flatter
  const n = normalMatrix(scaling(1, 0.5, 1));
  const v = [n[0] * 1 + n[3] * 1, n[1] * 1 + n[4] * 1, 0];
  assert.ok(v[1] > v[0], `normal ${v}`);
});

test('camera: the world origin lands on the anchor, height and depth move it as seen from above', () => {
  const frame = { w: 140, h: 172, ax: 70, ay: 153, zoom: 1.1 };
  const elev = (17 * Math.PI) / 180;
  const vp = viewProjection(frame, elev);
  const toCanvas = (p) => {
    const q = [vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12], vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13]];
    return [((q[0] + 1) / 2) * frame.w, ((1 - q[1]) / 2) * frame.h];
  };
  const o = toCanvas([0, 0, 0]);
  assert.ok(close(o[0], 70, 1e-3) && close(o[1], 153, 1e-3), `origin at ${o}`);
  for (const p of [[10, 20, 0], [-5, 3, 30], [0, 100, -20]]) {
    const c = toCanvas(p);
    const s = screenOf(p, elev, frame.zoom);
    assert.ok(close(c[0], 70 + s[0], 1e-3) && close(c[1], 153 - s[1], 1e-3), `screenOf agrees for ${p}`);
  }
  assert.ok(toCanvas([0, 0, 30])[1] > o[1], 'nearer points sit lower on the screen');
  assert.ok(toCanvas([0, 50, 0])[1] < o[1], 'higher points sit higher on the screen');
});

test('camera with perspective: the aimed point keeps its place, nearer things grow, farther ones shrink', () => {
  const frame = { w: 284, h: 194, ax: 142, ay: 142, zoom: 1 };
  const elev = (60 * Math.PI) / 180;
  const at = [0, 96, 0];
  const persp = viewProjection(frame, elev, { d: 1100, at });
  const flat = viewProjection(frame, elev);
  const toCanvas = (vp, p) => {
    const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
    const x = (vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12]) / w;
    const y = (vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13]) / w;
    return [((x + 1) / 2) * frame.w, ((1 - y) / 2) * frame.h];
  };
  const a = toCanvas(persp, at);
  const b = toCanvas(flat, at);
  assert.ok(close(a[0], b[0], 1e-3) && close(a[1], b[1], 1e-3), `aimed point at ${a}, not ${b}`);
  const width = (vp, y, z) => toCanvas(vp, [60, y, z])[0] - toCanvas(vp, [-60, y, z])[0];
  assert.ok(width(persp, 96, 90) > width(flat, 96, 90) + 1, 'the front edge grows');
  assert.ok(width(persp, 96, -90) < width(flat, 96, -90) - 1, 'the back edge shrinks');
  assert.ok(width(persp, 0, 0) < width(persp, 96, 0), 'the floor of a well is smaller than its rim');
  assert.equal(flat.length, 16);
});

test('lathe: closed, outward normals, creases, rounded-square sections', () => {
  const cyl = lathe([[0, 0], [10, 0, 1], [10, 20, 1], [0, 20]], { segs: 24 });
  assertWinding(cyl, 'cylinder');
  assertUnitNormals(cyl, 'cylinder');
  // side vertices point away from the axis, cap vertices up/down
  for (let i = 0; i < cyl.pos.length; i += 3) {
    const [x, y, z] = [cyl.pos[i], cyl.pos[i + 1], cyl.pos[i + 2]];
    const [nx, ny, nz] = [cyl.nor[i], cyl.nor[i + 1], cyl.nor[i + 2]];
    if (Math.abs(ny) > 0.99) assert.ok((y > 10) === ny > 0, 'cap normal');
    else assert.ok(nx * x + nz * z > 0, 'side normal points out');
  }
  const box = lathe([[0, 0], [10, 0, 1], [10, 20, 1], [0, 20]], { segs: 48, sq: 0.9, depth: 0.6 });
  assertWinding(box, 'rounded-square lathe');
  const b = bounds(box);
  assert.ok(close(b.max[0], 10, 0.01) && close(b.max[2], 6, 0.01), `section scaled in depth: ${b.max}`);
  const inner = lathe([[10, 0], [10, 20]], { segs: 16, inside: true });
  assertWinding(inner, 'inside lathe');
  for (let i = 0; i < inner.pos.length; i += 3) assert.ok(inner.nor[i] * inner.pos[i] + inner.nor[i + 2] * inner.pos[i + 2] < 0, 'inside normals point in');
  const [sx, sz] = section(Math.PI / 4, 1);
  assert.ok(sx > Math.SQRT1_2 && sz > Math.SQRT1_2, 'a rounded square bulges into the corners');
});

test('section outline: share of the way round, both ways', () => {
  const circle = sectionArc(0, 1);
  for (const a of [0, 0.7, 2, 4.4]) assert.ok(close(circle.toU(a), a / (Math.PI * 2), 1e-3), `a circle is even: ${a}`);
  const sq = sectionArc(0.8, 0.9);
  assert.equal(sq.toU(0), 0);
  assert.ok(close(sq.toU(Math.PI * 2), 1, 1e-9) && close(sq.toU(Math.PI * 2 + 1), 1 + sq.toU(1), 1e-9), 'whole turns count on');
  let last = -1;
  for (let a = 0; a <= Math.PI * 2; a += 0.05) {
    const u = sq.toU(a);
    assert.ok(u > last, 'grows with the angle');
    last = u;
    assert.ok(close(sq.toA(u), a, 2e-3), `toA undoes toU at ${a}`);
  }
  // a rounded square's flat side takes a bigger share of the way round than of the angle
  assert.ok(sq.toU(Math.PI / 2 + 0.1) - sq.toU(Math.PI / 2 - 0.1) > 0.2 / (Math.PI * 2) * 2, 'flat sides are long');
});

test('fluted lathe: even panels round a rounded square, sharp edges, inside the outline; warp', () => {
  assert.ok(close(flute(0, 0.1), 0.9) && close(flute(0.5, 0.1), 1) && close(flute(3, 0.1), 0.9), 'bulging panels, grooves between');
  assert.ok(close(flute(0, -0.1), 1) && close(flute(0.5, -0.1), 0.9), 'hollow panels, ridges between');
  assert.equal(flute(0.3, 0), 1);
  const opt = { segs: 48, sq: 0.8, depth: 0.9, flutes: 12, flute: 0.05 };
  const jar = lathe([[0, 0], [10, 0, 1], [12, 20, 1], [0, 20]], opt);
  assertWinding(jar, 'fluted lathe');
  assertUnitNormals(jar, 'fluted lathe');
  const plain = lathe([[0, 0], [10, 0, 1], [12, 20, 1], [0, 20]], { segs: 48, sq: 0.8, depth: 0.9 });
  const pb = bounds(plain);
  const fb = bounds(jar);
  for (let k = 0; k < 3; k++) assert.ok(fb.max[k] <= pb.max[k] + 1e-6 && fb.min[k] >= pb.min[k] - 1e-6, 'the panels stay inside the plain outline');
  // the bottom edge (a crease: two rings of the same points, the first one taken): points spaced
  // evenly along the outline, not crowded into the corners
  const edgeRings = [];
  for (let i = 0; i < jar.pos.length; i += 3) if (close(jar.pos[i + 1], 0) && Math.hypot(jar.pos[i], jar.pos[i + 2]) > 1) edgeRings.push([jar.pos[i], jar.pos[i + 2], [jar.nor[i], jar.nor[i + 1], jar.nor[i + 2]]]);
  const ring = edgeRings.slice(0, edgeRings.length / 2);
  const steps = [];
  let sharp = 0;
  for (let i = 1; i < ring.length; i++) {
    const d = Math.hypot(ring[i][0] - ring[i - 1][0], ring[i][1] - ring[i - 1][1]);
    if (d > 1e-6) steps.push(d);
    else if (ring[i][2][0] * ring[i - 1][2][0] + ring[i][2][2] * ring[i - 1][2][2] < 0.999) sharp++;
  }
  assert.ok(Math.max(...steps) / Math.min(...steps) < 1.6, `even columns: ${Math.min(...steps).toFixed(2)}…${Math.max(...steps).toFixed(2)}`);
  assert.ok(sharp >= 11, `a sharp edge between the panels (${sharp})`);
  // warp: a spout on the left reaches out near the top only
  const spout = lathe([[0, 0], [10, 0, 1], [10, 20, 1], [0, 20]], { segs: 40, warp: (a, y) => 1 + 0.3 * Math.exp(-(((a - Math.PI) / 0.4) ** 2)) * (y / 20) });
  assertWinding(spout, 'warped lathe');
  assertUnitNormals(spout, 'warped lathe');
  const sb = bounds(spout);
  assert.ok(close(sb.min[0], -13, 0.01) && close(sb.max[0], 10, 0.01), `spout on the left: ${sb.min[0]}`);
});

test('rounded box, tube, sphere, cylinder and plane are well formed', () => {
  const box = roundedBox(40, 20, 30, 5, 4);
  assertWinding(box, 'roundedBox');
  assertUnitNormals(box, 'roundedBox');
  const bb = bounds(box);
  assert.deepEqual(bb.min.map((v) => Math.round(v * 1000) / 1000), [-20, -10, -15]);
  assert.deepEqual(bb.max.map((v) => Math.round(v * 1000) / 1000), [20, 10, 15]);
  const sharp = roundedBox(4, 4, 4, 0);
  assert.equal(sharp.pos.length / 3, 24, 'a sharp box is 6 quads');
  const t = tube(spline([[0, 0, 0], [10, 5, 0], [20, 0, 5]], 5), 2, { segs: 10 });
  assertWinding(t, 'tube');
  assertWinding(tube([[0, 0, 0], [0, 10, 0]], [1, 3], { squash: 0.5 }), 'tapered flat tube');
  assertWinding(sphere(5), 'sphere');
  assertWinding(cylinder(4, 0, 6, { bevel: 1 }), 'bevelled cylinder');
  assertWinding(plane(10, 4), 'plane');
  assertWinding(plane(10, 4, { up: true }), 'floor plane');
});

test('polar surface: heights follow the function, normals follow the slope, version bumps', () => {
  const s = polarSurface((a) => [Math.cos(a) * 10, Math.sin(a) * 10], 6, 24);
  const v0 = s.version;
  updateSurface(s, (x) => x * 0.5); // rises toward +x
  assert.ok(s.version > v0);
  for (let i = 0; i < s.pos.length; i += 3) assert.ok(close(s.pos[i + 1], s.pos[i] * 0.5, 1e-5));
  // normal of y = x/2 leans toward −x
  assert.ok(s.nor[0] < -0.3 && s.nor[1] > 0.8, `centre normal ${s.nor[0]},${s.nor[1]}`);
  updateSurface(s, () => 3);
  assertWinding(s, 'flat liquid surface');
});

test('merge keeps every vertex and applies the matrices', () => {
  const a = plane(2, 2);
  const m = merge([{ mesh: a, m: translation(10, 0, 0) }, { mesh: a, m: rotationY(Math.PI) }]);
  assert.equal(m.pos.length, a.pos.length * 2);
  assert.equal(m.idx.length, a.idx.length * 2);
  assert.ok(close(bounds(m).max[0], 11));
  assertWinding(m, 'merged planes');
});

test('materials: colours are linear, defaults are opaque plain dielectrics', () => {
  assert.deepEqual(linear('#ffffff'), [1, 1, 1]);
  assert.ok(close(linear('#808080')[0], 0.22, 0.005), 'sRGB mid grey is about 0.22 linear (gamma 2.2)');
  const m = material({ color: '#ff0000', emit: '#00ff00', glow: 2 });
  assert.deepEqual(m.color, [1, 0, 0]);
  assert.deepEqual(m.emit, [0, 2, 0]);
  assert.equal(m.alpha, 1);
  assert.equal(m.mode, MODE.PLAIN);
  assert.equal(new Set(Object.values(MODE)).size, Object.keys(MODE).length, 'pattern ids are unique');
});
