// 3D math and mesh builders for the kitchen appliances (js/kitchen3d.js models them, js/gl3d.js
// draws them). Pure module: numbers and typed arrays only – no DOM, no WebGL.
//
// Conventions: right-handed, y up, +z toward the viewer, lengths in stage pixels at zoom 1.
// Matrices are column-major Float32Array(16) like WebGL expects. A mesh is
//   { pos: Float32Array, nor: Float32Array, uv: Float32Array, idx: Uint16Array|Uint32Array, version }
// and its triangles wind counter-clockwise seen from the side their normals point to.

const TAU = Math.PI * 2;

// ------------------------------------------------------------------ vectors
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export function normalize(a) {
  const l = Math.hypot(a[0], a[1], a[2]);
  return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0];
}

// ------------------------------------------------------------------ 4×4 matrices
export function identity() {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

// a·b (b is applied first)
export function multiply(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return o;
}

// compose(A, B, C) = A·B·C: C acts first, like nested transforms written outside-in
export function compose(...mats) {
  let m = identity();
  for (const x of mats) if (x) m = multiply(m, x);
  return m;
}

export function translation(x, y, z) {
  const m = identity();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
}

export function scaling(x, y = x, z = x) {
  const m = identity();
  m[0] = x;
  m[5] = y;
  m[10] = z;
  return m;
}

export function rotationX(a) {
  const m = identity();
  const c = Math.cos(a);
  const s = Math.sin(a);
  m[5] = c;
  m[6] = s;
  m[9] = -s;
  m[10] = c;
  return m;
}

export function rotationY(a) {
  const m = identity();
  const c = Math.cos(a);
  const s = Math.sin(a);
  m[0] = c;
  m[2] = -s;
  m[8] = s;
  m[10] = c;
  return m;
}

export function rotationZ(a) {
  const m = identity();
  const c = Math.cos(a);
  const s = Math.sin(a);
  m[0] = c;
  m[1] = s;
  m[4] = -s;
  m[5] = c;
  return m;
}

// Rotation by angle a about the axis through point p along direction d (hinged lids, doors).
export function rotationAbout(p, axis, a) {
  const rot = axis === 'x' ? rotationX(a) : axis === 'y' ? rotationY(a) : rotationZ(a);
  return compose(translation(p[0], p[1], p[2]), rot, translation(-p[0], -p[1], -p[2]));
}

export function ortho(l, r, b, t, n, f) {
  const m = new Float32Array(16);
  const lr = 1 / (l - r);
  const bt = 1 / (b - t);
  const nf = 1 / (n - f);
  m[0] = -2 * lr;
  m[5] = -2 * bt;
  m[10] = 2 * nf;
  m[12] = (l + r) * lr;
  m[13] = (t + b) * bt;
  m[14] = (f + n) * nf;
  m[15] = 1;
  return m;
}

// Inverse transpose of the upper 3×3 (column-major Float32Array(9)): turns normals.
export function normalMatrix(m) {
  const a00 = m[0], a10 = m[1], a20 = m[2];
  const a01 = m[4], a11 = m[5], a21 = m[6];
  const a02 = m[8], a12 = m[9], a22 = m[10];
  const c00 = a11 * a22 - a12 * a21;
  const c01 = -(a10 * a22 - a12 * a20);
  const c02 = a10 * a21 - a11 * a20;
  const c10 = -(a01 * a22 - a02 * a21);
  const c11 = a00 * a22 - a02 * a20;
  const c12 = -(a00 * a21 - a01 * a20);
  const c20 = a01 * a12 - a02 * a11;
  const c21 = -(a00 * a12 - a02 * a10);
  const c22 = a00 * a11 - a01 * a10;
  const det = a00 * c00 + a01 * c01 + a02 * c02;
  const k = Math.abs(det) > 1e-12 ? 1 / det : 1;
  const o = new Float32Array(9);
  o[0] = c00 * k; o[1] = c10 * k; o[2] = c20 * k;
  o[3] = c01 * k; o[4] = c11 * k; o[5] = c21 * k;
  o[6] = c02 * k; o[7] = c12 * k; o[8] = c22 * k;
  return o;
}

export function transformPoint(m, p) {
  const [x, y, z] = p;
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

// ------------------------------------------------------------------ camera
// The appliances are drawn with one fixed orthographic camera that looks down at the worktop
// by `elev` radians (the same angle the cup rims are drawn with). In camera space x is right,
// y is up on the screen and the camera looks along −z.
export const viewMatrix = (elev) => rotationX(elev);

// Screen offset (stage px, y up) of a world point relative to the world origin.
export function screenOf(p, elev, zoom = 1) {
  return [p[0] * zoom, (p[1] * Math.cos(elev) - p[2] * Math.sin(elev)) * zoom];
}

// Frame of a view: a w×h canvas (CSS px) with the world origin at (ax, ay) from its top left.
// persp = { d, at } adds a gentle perspective (the freezer built into the counter): a camera d
// stage px from the world point `at`, which keeps its place and size; nearer points grow, farther
// ones shrink toward it. Without persp the projection is orthographic.
export function viewProjection(frame, elev, persp = null) {
  const { w, h, ax, ay, zoom = 1 } = frame;
  const proj = ortho(-ax / zoom, (w - ax) / zoom, -(h - ay) / zoom, ay / zoom, -2000, 2000);
  const vp = multiply(proj, viewMatrix(elev));
  if (!persp) return vp;
  // clip w = 1 + k·(z − zr): the orthographic clip depth z is −view depth / 2000
  const [xp, yp, zr] = transformPoint(vp, persp.at || [0, 0, 0]);
  const k = 2000 / persp.d;
  const K = new Float32Array(16);
  K[0] = 1;
  K[5] = 1;
  K[10] = 1;
  K[8] = xp * k;
  K[9] = yp * k;
  K[11] = k;
  K[12] = -xp * k * zr;
  K[13] = -yp * k * zr;
  K[15] = 1 - k * zr;
  return multiply(K, vp);
}

// Unit vector from a surface toward the camera.
export const viewDir = (elev) => [0, Math.sin(elev), Math.cos(elev)];

// ------------------------------------------------------------------ meshes
let meshSeq = 0;

export function makeMesh(pos, nor, uv, idx) {
  const n = pos.length / 3;
  return {
    id: ++meshSeq,
    pos: pos instanceof Float32Array ? pos : new Float32Array(pos),
    nor: nor instanceof Float32Array ? nor : new Float32Array(nor),
    uv: uv instanceof Float32Array ? uv : new Float32Array(uv && uv.length ? uv : n * 2),
    idx: n > 65535 ? new Uint32Array(idx) : new Uint16Array(idx),
    version: 0,
  };
}

// Area-weighted vertex normals from the triangles (dynamic surfaces).
export function computeNormals(pos, idx, out = new Float32Array(pos.length)) {
  out.fill(0);
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3;
    const b = idx[i + 1] * 3;
    const c = idx[i + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) {
      out[k] += nx;
      out[k + 1] += ny;
      out[k + 2] += nz;
    }
  }
  for (let i = 0; i < out.length; i += 3) {
    const l = Math.hypot(out[i], out[i + 1], out[i + 2]) || 1;
    out[i] /= l;
    out[i + 1] /= l;
    out[i + 2] /= l;
  }
  return out;
}

// Cross-section of lathe shapes: superellipse from a circle (sq 0) to a rounded square (sq 1).
export function section(a, sq = 0, depth = 1) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  if (sq <= 0) return [c, s * depth];
  const e = 2 / (2 + 8 * sq);
  return [Math.sign(c) * Math.abs(c) ** e, Math.sign(s) * Math.abs(s) ** e * depth];
}

// Surface of revolution. profile: [[r, y], …] from bottom to top (r ≥ 0, r = 0 closes the shape);
// a third entry 1 marks a sharp crease at that point. Options: segs around, sq/depth for the
// cross-section (see section()), a0/a1 for a partial turn, inside: normals point inwards.
export function lathe(profile, { segs = 40, sq = 0, depth = 1, a0 = 0, a1 = TAU, inside = false } = {}) {
  const segDir = (i) => {
    const [r0, y0] = profile[i];
    const [r1, y1] = profile[i + 1];
    const l = Math.hypot(r1 - r0, y1 - y0) || 1;
    return [(r1 - r0) / l, (y1 - y0) / l];
  };
  const rings = [];
  let len = 0;
  for (let i = 0; i < profile.length; i++) {
    const [r, y, crease] = profile[i];
    if (i > 0) len += Math.hypot(r - profile[i - 1][0], y - profile[i - 1][1]);
    const before = i > 0 ? segDir(i - 1) : null;
    const after = i < profile.length - 1 ? segDir(i) : null;
    if (crease && before && after) {
      rings.push({ r, y, t: before, v: len, dup: false });
      rings.push({ r, y, t: after, v: len, dup: true });
    } else {
      let t = before && after ? [before[0] + after[0], before[1] + after[1]] : before || after;
      const l = Math.hypot(t[0], t[1]) || 1;
      t = [t[0] / l, t[1] / l];
      rings.push({ r, y, t, v: len, dup: false });
    }
  }
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  const h = 1e-3;
  const cols = segs + 1;
  for (const ring of rings) {
    const [tr, ty] = ring.t;
    for (let j = 0; j <= segs; j++) {
      const a = a0 + ((a1 - a0) * j) / segs;
      const [X, Z] = section(a, sq, depth);
      const p1 = section(a + h, sq, depth);
      const p0 = section(a - h, sq, depth);
      const dX = p1[0] - p0[0];
      const dZ = p1[1] - p0[1];
      let n = normalize([ty * dZ, tr * (Z * dX - X * dZ), -ty * dX]);
      if (inside) n = [-n[0], -n[1], -n[2]];
      pos.push(ring.r * X, ring.y, ring.r * Z);
      nor.push(n[0], n[1], n[2]);
      uv.push(j / segs, len > 0 ? ring.v / len : 0);
    }
  }
  for (let i = 0; i < rings.length - 1; i++) {
    if (rings[i + 1].dup) continue; // the zero-height strip of a crease
    for (let j = 0; j < segs; j++) {
      const A = i * cols + j;
      const B = A + 1;
      const D = A + cols;
      const C = D + 1;
      if (inside) idx.push(A, B, D, B, C, D);
      else idx.push(A, D, B, B, D, C);
    }
  }
  return makeMesh(pos, nor, uv, idx);
}

// Box centred on the origin with all edges rounded by r (n steps per quarter round).
export function roundedBox(w, h, d, r = 0, n = 4) {
  const H = [w / 2, h / 2, d / 2];
  const rr = Math.max(0, Math.min(r, H[0], H[1], H[2]));
  const coords = (a) => {
    if (rr <= 0) return [-a, a];
    const inner = a - rr;
    const list = [];
    for (let k = 0; k <= n; k++) list.push(-inner - rr * Math.tan((Math.PI / 4) * ((n - k) / n)));
    for (let k = 0; k <= n; k++) {
      const c = inner + rr * Math.tan((Math.PI / 4) * (k / n));
      if (Math.abs(c - list[list.length - 1]) > 1e-6) list.push(c);
    }
    return list;
  };
  const C = [coords(H[0]), coords(H[1]), coords(H[2])];
  const inner = [H[0] - rr, H[1] - rr, H[2] - rr];
  // face: fixed axis + sign, u axis (+sign) and v axis (+sign) so that u × v = face normal
  const faces = [
    { ax: 0, s: 1, u: [2, -1], v: [1, 1] },
    { ax: 0, s: -1, u: [2, 1], v: [1, 1] },
    { ax: 1, s: 1, u: [0, 1], v: [2, -1] },
    { ax: 1, s: -1, u: [0, 1], v: [2, 1] },
    { ax: 2, s: 1, u: [0, 1], v: [1, 1] },
    { ax: 2, s: -1, u: [0, -1], v: [1, 1] },
  ];
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  for (const fc of faces) {
    const us = C[fc.u[0]];
    const vs = C[fc.v[0]];
    const base = pos.length / 3;
    for (let j = 0; j < vs.length; j++) {
      for (let i = 0; i < us.length; i++) {
        const p = [0, 0, 0];
        p[fc.ax] = fc.s * H[fc.ax];
        p[fc.u[0]] = fc.u[1] * us[i];
        p[fc.v[0]] = fc.v[1] * vs[j];
        let q = p;
        let nn = [0, 0, 0];
        nn[fc.ax] = fc.s;
        if (rr > 0) {
          const c = [0, 1, 2].map((k) => Math.max(-inner[k], Math.min(inner[k], p[k])));
          const dlt = sub(p, c);
          if (Math.hypot(dlt[0], dlt[1], dlt[2]) > 1e-9) nn = normalize(dlt);
          q = add(c, scale3(nn, rr));
        }
        pos.push(q[0], q[1], q[2]);
        nor.push(nn[0], nn[1], nn[2]);
        uv.push(i / (us.length - 1), j / (vs.length - 1));
      }
    }
    const cols = us.length;
    for (let j = 0; j < vs.length - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const A = base + j * cols + i;
        const B = A + 1;
        const D = A + cols;
        const Cc = D + 1;
        idx.push(A, B, Cc, A, Cc, D);
      }
    }
  }
  return makeMesh(pos, nor, uv, idx);
}

// Tube swept along a path of [x, y, z] points. r: radius or one radius per point.
// squash flattens the cross-section (binormal side), up hints the first frame's normal.
export function tube(path, r, { segs = 12, caps = true, squash = 1, up = [0, 0, 1] } = {}) {
  const n = path.length;
  const rad = (i) => (Array.isArray(r) ? r[i] : r);
  const T = path.map((p, i) => normalize(sub(path[Math.min(i + 1, n - 1)], path[Math.max(i - 1, 0)])));
  let N = sub(up, scale3(T[0], dot(up, T[0])));
  if (Math.hypot(N[0], N[1], N[2]) < 1e-6) N = Math.abs(T[0][1]) < 0.9 ? cross(T[0], [0, 1, 0]) : cross(T[0], [1, 0, 0]);
  N = normalize(N);
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  const cols = segs + 1;
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      N = normalize(sub(N, scale3(T[i], dot(N, T[i]))));
    }
    const B = cross(T[i], N);
    for (let k = 0; k <= segs; k++) {
      const f = (TAU * k) / segs;
      const c = Math.cos(f);
      const s = Math.sin(f);
      const off = add(scale3(N, c * rad(i)), scale3(B, s * rad(i) * squash));
      const nn = normalize(add(scale3(N, c * squash), scale3(B, s)));
      pos.push(path[i][0] + off[0], path[i][1] + off[1], path[i][2] + off[2]);
      nor.push(nn[0], nn[1], nn[2]);
      uv.push(k / segs, i / Math.max(1, n - 1));
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < segs; k++) {
      const A = i * cols + k;
      const B = A + 1;
      const D = A + cols;
      const C = D + 1;
      idx.push(A, B, D, B, C, D);
    }
  }
  if (caps) {
    for (const [ring, sgn] of [[0, -1], [n - 1, 1]]) {
      const t = scale3(T[ring], sgn);
      const center = pos.length / 3;
      pos.push(path[ring][0], path[ring][1], path[ring][2]);
      nor.push(t[0], t[1], t[2]);
      uv.push(0.5, 0.5);
      const first = pos.length / 3;
      for (let k = 0; k <= segs; k++) {
        const v = (ring * cols + k) * 3;
        pos.push(pos[v], pos[v + 1], pos[v + 2]);
        nor.push(t[0], t[1], t[2]);
        uv.push(0.5, 0.5);
      }
      for (let k = 0; k < segs; k++) {
        if (sgn < 0) idx.push(center, first + k + 1, first + k);
        else idx.push(center, first + k, first + k + 1);
      }
    }
  }
  return makeMesh(pos, nor, uv, idx);
}

export function sphere(r, segs = 20, rings = 12) {
  const profile = [];
  for (let i = 0; i <= rings; i++) {
    const a = (Math.PI * i) / rings;
    profile.push([Math.max(0, r * Math.sin(a)), -r * Math.cos(a)]);
  }
  profile[0][0] = 0;
  profile[rings][0] = 0;
  return lathe(profile, { segs });
}

// Closed cylinder from y0 to y1 (flat caps with sharp edges).
export function cylinder(r, y0, y1, { segs = 32, sq = 0, depth = 1, bevel = 0 } = {}) {
  const b = Math.min(bevel, r * 0.5, (y1 - y0) * 0.5);
  const profile = b > 0
    ? [[0, y0], [r - b, y0], [r, y0 + b], [r, y1 - b], [r - b, y1], [0, y1]]
    : [[0, y0], [r, y0, 1], [r, y1, 1], [0, y1]];
  return lathe(profile, { segs, sq, depth });
}

// Flat rectangle facing +z (w × h, centred) or facing +y with { up: true }; uv (0,0) bottom left.
export function plane(w, h, { up = false } = {}) {
  const x = w / 2;
  const y = h / 2;
  if (up) {
    return makeMesh([-x, 0, y, x, 0, y, x, 0, -y, -x, 0, -y], [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], [0, 0, 1, 0, 1, 1, 0, 1], [0, 1, 2, 0, 2, 3]);
  }
  return makeMesh([-x, -y, 0, x, -y, 0, x, y, 0, -x, y, 0], [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], [0, 0, 1, 0, 1, 1, 0, 1], [0, 1, 2, 0, 2, 3]);
}

// Polar grid for liquid surfaces (no seam: the vertices wrap around). outline(a) gives the
// rim point [x, z] at angle a; the y values are set by updateSurface().
export function polarSurface(outline, rings = 7, segs = 36) {
  const pos = [0, 0, 0];
  const uv = [0.5, 0.5];
  for (let i = 1; i <= rings; i++) {
    const k = i / rings;
    for (let j = 0; j < segs; j++) {
      const a = (TAU * j) / segs;
      const [x, z] = outline(a);
      pos.push(x * k, 0, z * k);
      uv.push(k, j / segs);
    }
  }
  const idx = [];
  const at = (i, j) => (i === 0 ? 0 : 1 + (i - 1) * segs + (((j % segs) + segs) % segs));
  for (let j = 0; j < segs; j++) idx.push(0, at(1, j + 1), at(1, j));
  for (let i = 1; i < rings; i++) {
    for (let j = 0; j < segs; j++) {
      const A = at(i, j);
      const B = at(i, j + 1);
      const C = at(i + 1, j + 1);
      const D = at(i + 1, j);
      idx.push(A, B, D, B, C, D);
    }
  }
  const mesh = makeMesh(pos, new Float32Array(pos.length), uv, idx);
  mesh.dynamic = true;
  updateSurface(mesh, () => 0);
  return mesh;
}

// Sets every vertex's height to fn(x, z, k, a) (k: 0 centre … 1 rim, a: angle) and refreshes
// the normals; the renderer re-uploads the mesh when its version changes.
export function updateSurface(mesh, fn) {
  const p = mesh.pos;
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i];
    const z = p[i + 2];
    const v = i / 3;
    const k = mesh.uv[v * 2];
    p[i + 1] = fn(x, z, v === 0 ? 0 : k, Math.atan2(z, x));
  }
  computeNormals(p, mesh.idx, mesh.nor);
  mesh.version++;
  return mesh;
}

// Several meshes (each with a matrix) as one mesh – fewer draw calls for static parts.
export function merge(parts) {
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  for (const { mesh, m } of parts) {
    const base = pos.length / 3;
    const nm = m ? normalMatrix(m) : null;
    for (let i = 0; i < mesh.pos.length; i += 3) {
      const p = m ? transformPoint(m, [mesh.pos[i], mesh.pos[i + 1], mesh.pos[i + 2]]) : [mesh.pos[i], mesh.pos[i + 1], mesh.pos[i + 2]];
      let n = [mesh.nor[i], mesh.nor[i + 1], mesh.nor[i + 2]];
      if (nm) n = normalize([nm[0] * n[0] + nm[3] * n[1] + nm[6] * n[2], nm[1] * n[0] + nm[4] * n[1] + nm[7] * n[2], nm[2] * n[0] + nm[5] * n[1] + nm[8] * n[2]]);
      pos.push(p[0], p[1], p[2]);
      nor.push(n[0], n[1], n[2]);
    }
    for (let i = 0; i < mesh.uv.length; i++) uv.push(mesh.uv[i]);
    for (let i = 0; i < mesh.idx.length; i++) idx.push(mesh.idx[i] + base);
  }
  return makeMesh(pos, nor, uv, idx);
}

// Axis-aligned bounds of a mesh after the matrix m: { min: [x,y,z], max: [x,y,z] }.
export function bounds(mesh, m = null) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < mesh.pos.length; i += 3) {
    const p = m ? transformPoint(m, [mesh.pos[i], mesh.pos[i + 1], mesh.pos[i + 2]]) : [mesh.pos[i], mesh.pos[i + 1], mesh.pos[i + 2]];
    for (let k = 0; k < 3; k++) {
      if (p[k] < min[k]) min[k] = p[k];
      if (p[k] > max[k]) max[k] = p[k];
    }
  }
  return { min, max };
}

// ------------------------------------------------------------------ materials
// Surface patterns of the shader (js/gl3d.js). p = the pattern's 4 parameters.
export const MODE = {
  PLAIN: 0,
  BRUSHED: 1, // brushed metal; p.x line density, p.y 1 = vertical lines
  PUREE: 2, // blended fruit; colour2 streaks, p.x arms, p.y twist, p.z speed (rad/s), p.w amount
  GLASS: 3, // printed scale on clear plastic; p.x marks, p.y first mark (object y), p.z spacing, p.w side (angle)
  FROST: 4, // frosted surface; p.x amount, p.y frost along the uv edges, p.z light streaks (glass panes)
  SHADOW: 5, // soft contact shadow of a rounded rect: p.x half width, p.y half depth, p.z radius, p.w blur
  TEX: 6, // texture (labels, displays); p.x glow of the texture
  SLUSH: 7, // churning ice slush; like PUREE plus crystals
  STREAM: 8, // poured liquid; p.x flow speed
  KNURL: 9, // grip ridges around the object's y axis; p.x ridges
  GRILLE: 10, // slots / holes over the uv square; p.x columns, p.y rows, p.z hole width
  FOAM: 11, // bubbly foam; p.x bubble scale, p.y speed
  MOLD: 12, // spoiled: spots of colour2; p.x scale, p.y amount
  GLOW: 13, // round glow sprite (uv), emitted colour only
  LEDRING: 14, // ring of LED segments around the object's y axis; p.x segments, p.y lit share, p.z gap
};

// sRGB hex → linear rgb
export function linear(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255) ** 2.2);
}

// Material in the shader's terms. Colours are sRGB hex; emit is scaled by glow.
export function material(o = {}) {
  return {
    color: linear(o.color || '#ffffff'),
    color2: linear(o.color2 || o.color || '#ffffff'),
    emit: o.emit ? linear(o.emit).map((v) => v * (o.glow ?? 1)) : [0, 0, 0],
    metal: o.metal ?? 0,
    rough: o.rough ?? 0.5,
    alpha: o.alpha ?? 1,
    coat: o.coat ?? 0,
    mode: o.mode ?? MODE.PLAIN,
    p: o.p || [0, 0, 0, 0],
    glass: !!o.glass,
    tex: o.tex || null,
    double: !!o.double,
  };
}

// Smooth curve through the points (Catmull-Rom), n samples per segment – handles, wires.
export function spline(pts, n = 6) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([0, 1, 2].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}
