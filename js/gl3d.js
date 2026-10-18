// WebGL renderer for the 3D kitchen appliances (scenes come from js/kitchen3d.js).
// One shared offscreen WebGL context draws every view; the result is copied into the view's
// own 2D canvas, so any number of stations, drag ghosts and shop pictures share one context.
// No DOM access at import time (Node tests import the scene modules next to it).
//
// Shading: metal/roughness model with GGX highlights from three studio lights, reflections of a
// procedural photo studio (soft boxes over a warm café room), clear plastic with Fresnel
// reflections, procedural surface patterns (see MODE in geo3d.js), ACES tone mapping.

import { MODE, normalize, normalMatrix, viewProjection, viewDir, transformPoint, dot } from './geo3d.js';

const KEY = normalize([-0.5, 0.78, 0.55]);
const FILL = normalize([0.78, 0.28, 0.58]);
const RIM = normalize([0.32, 0.55, -0.78]);
const KEY_BOX = normalize([-0.62, 0.36, 0.7]);
const STRIP_BOX = normalize([0.82, 0.14, 0.56]);
const TOP_BOX = normalize([0.05, 0.93, 0.36]);
const BACK_BOX = normalize([0.12, 0.5, -0.86]);
const v3 = (v) => `vec3(${v.map((x) => x.toFixed(4)).join(', ')})`;
// A soft box seen from the reflection vector: centre c, horizontal axis t, vertical axis b.
function box(c, half, color) {
  const t = normalize([c[2], 0, -c[0]]);
  const b = [c[1] * t[2] - c[2] * t[1], c[2] * t[0] - c[0] * t[2], c[0] * t[1] - c[1] * t[0]];
  return `softbox(r, ${v3(c)}, ${v3(t)}, ${v3(b)}, vec2(${half[0]}, ${half[1]}), bl) * ${color}`;
}

const VERT = `
attribute vec3 aPos;
attribute vec3 aNor;
attribute vec2 aUv;
uniform mat4 uModel;
uniform mat4 uViewProj;
uniform mat3 uNorMat;
varying vec3 vPos;
varying vec3 vNor;
varying vec3 vObj;
varying vec2 vUv;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vPos = w.xyz;
  vNor = uNorMat * aNor;
  vObj = aPos;
  vUv = aUv;
  gl_Position = uViewProj * w;
}`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec3 vPos;
varying vec3 vNor;
varying vec3 vObj;
varying vec2 vUv;
uniform vec3 uView;
uniform vec3 uColor;
uniform vec3 uColor2;
uniform vec3 uEmit;
uniform vec4 uMat;
uniform vec4 uP;
uniform float uMode;
uniform float uTime;
uniform float uGlass;
uniform float uAo;
uniform sampler2D uTex;

const float PI = 3.14159265;
const vec3 KEY = ${v3(KEY)};
const vec3 FILL = ${v3(FILL)};
const vec3 RIM = ${v3(RIM)};
const vec3 KEYCOL = vec3(2.35, 2.2, 2.0);
const vec3 FILLCOL = vec3(0.62, 0.68, 0.78);
const vec3 RIMCOL = vec3(1.1, 1.02, 0.92);

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
vec3 hash3(vec3 p) {
  p = fract(p * vec3(0.1031, 0.103, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
// Packed pieces (seeds, clusters): the distance to the nearest (x) and second nearest (y) of random
// points around p, each point's piece reaching by stretch longer along an axis of its own, and the
// nearest piece's random value (z). In 3D, so no side of a curved surface shows them stretched; only
// the 2 × 2 × 2 cells nearest to p are searched (the points keep to the middle of their cells).
vec3 cells(vec3 p, float stretch) {
  vec3 i = floor(p - 0.5);
  vec3 f = p - i;
  vec3 d = vec3(8.0, 8.0, 0.0);
  for (int x = 0; x <= 1; x++) {
    for (int y = 0; y <= 1; y++) {
      for (int z = 0; z <= 1; z++) {
        vec3 g = vec3(float(x), float(y), float(z));
        vec3 h = hash3(i + g);
        vec3 r = g + 0.15 + h * 0.7 - f;
        vec3 a = normalize(h.yzx - 0.5 + 0.001);
        float q = dot(r, r) - stretch * dot(r, a) * dot(r, a);
        if (q < d.x) {
          d.y = d.x;
          d.x = q;
          d.z = h.z;
        } else if (q < d.y) {
          d.y = q;
        }
      }
    }
  }
  return vec3(sqrt(max(d.xy, 0.0)), d.z);
}
bool isMode(float m) { return abs(uMode - m) < 0.5; }

// ---- photo studio: room gradient plus four soft boxes
float softbox(vec3 r, vec3 c, vec3 t, vec3 b, vec2 hs, float blur) {
  float d = dot(r, c);
  if (d <= 0.05) return 0.0;
  vec2 q = abs(vec2(dot(r, t), dot(r, b)) / d) - hs;
  return (1.0 - smoothstep(-blur, blur, q.x)) * (1.0 - smoothstep(-blur, blur, q.y));
}
vec3 env(vec3 r, float rough) {
  vec3 wall = vec3(0.62, 0.57, 0.52);
  vec3 c = r.y > 0.0
    ? mix(wall, vec3(0.92, 0.91, 0.90), smoothstep(0.0, 0.85, r.y))
    : mix(wall, vec3(0.30, 0.26, 0.23), smoothstep(0.0, -0.5, r.y));
  float bl = 0.025 + rough * 0.75;
  float k = 1.0 / (1.0 + rough * 7.0);
  c += k * (${box(KEY_BOX, [0.3, 0.58], 'vec3(5.2, 4.99, 4.68)')}
    + ${box(STRIP_BOX, [0.06, 0.8], 'vec3(2.92, 3.13, 3.4)')}
    + ${box(TOP_BOX, [0.5, 0.3], 'vec3(2.2, 2.16, 2.09)')}
    + ${box(BACK_BOX, [0.8, 0.35], 'vec3(1.6, 1.52, 1.38)')});
  return c;
}
vec3 hemi(vec3 n) {
  return mix(vec3(0.30, 0.26, 0.23), vec3(0.50, 0.50, 0.52), n.y * 0.5 + 0.5);
}
vec3 ggx(vec3 n, vec3 v, vec3 l, vec3 F0, float a) {
  vec3 h = normalize(l + v);
  float nl = max(dot(n, l), 0.0);
  float nh = max(dot(n, h), 0.0);
  float nv = max(dot(n, v), 0.001);
  float vh = max(dot(v, h), 0.0);
  float a2 = a * a;
  float d = nh * nh * (a2 - 1.0) + 1.0;
  float D = a2 / (PI * d * d);
  float k = a * 0.5;
  float G = 1.0 / ((nl * (1.0 - k) + k) * (nv * (1.0 - k) + k));
  vec3 F = F0 + (1.0 - F0) * pow(1.0 - vh, 5.0);
  return min(D * G * 0.25, 60.0) * F * nl;
}
vec3 lights(vec3 n, vec3 v, vec3 F0, float a) {
  return ggx(n, v, KEY, F0, a) * KEYCOL + ggx(n, v, FILL, F0, a) * FILLCOL + ggx(n, v, RIM, F0, a) * RIMCOL;
}
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
vec3 display(vec3 c) {
  return pow(aces(c * 0.86), vec3(1.0 / 2.2));
}
float maxc(vec3 c) { return max(c.r, max(c.g, c.b)); }

void main() {
  vec3 n = normalize(vNor);
  if (!gl_FrontFacing) n = -n;
  vec3 v = uView;
  vec3 base = uColor;
  vec3 emit = uEmit;
  float metal = uMat.x;
  float rough = uMat.y;
  float alpha = uMat.z;
  float coat = uMat.w;
  float ang = atan(vObj.z, vObj.x);
  float rad = length(vObj.xz);
  float print = 0.0;
  float frost = 0.0;

  if (isMode(${MODE.SHADOW}.0)) {
    vec2 q = abs(vObj.xz) - uP.xy + uP.z;
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uP.z;
    float s = 1.0 - smoothstep(-uP.w * 0.35, uP.w, d);
    float a = s * s * alpha;
    gl_FragColor = vec4(vec3(0.05, 0.035, 0.03) * a, a);
    return;
  }
  if (isMode(${MODE.GLOW}.0)) {
    float d = length(vUv - 0.5) * 2.0;
    float a = pow(max(0.0, 1.0 - d), 2.2) * alpha;
    vec3 c = display(emit);
    gl_FragColor = vec4(c * a, a * maxc(c));
    return;
  }
  if (isMode(${MODE.BRUSHED}.0)) {
    float u = uP.y > 1.5 ? vObj.z : uP.y > 0.5 ? (vObj.x + vObj.z) : vObj.y;
    float w = uP.y > 1.5 ? vObj.x : uP.y > 0.5 ? vObj.y : ang * 6.0;
    float l = noise(vec2(u * uP.x, w * 0.05)) * 0.6 + noise(vec2(u * uP.x * 3.7, w * 0.11)) * 0.4;
    base *= 0.9 + 0.16 * l + (l - 0.5) * uP.z * 2.0;
    rough = clamp(rough + (l - 0.5) * (0.12 + uP.z), 0.05, 1.0);
  } else if (isMode(${MODE.PUREE}.0) || isMode(${MODE.SLUSH}.0)) {
    float t = uTime * uP.z;
    float s = sin(ang * uP.x + (vObj.y + rad) * uP.y - t + 1.7 * sin(ang * 2.0 + vObj.y * 0.12 - t * 0.5));
    float g = noise(vec2(ang * 5.0 - t * 0.8, vObj.y * 0.3 + rad * 0.2));
    base = mix(base, uColor2, smoothstep(0.3, 1.1, s * 0.55 + g * 0.65) * uP.w);
    base *= 0.94 + 0.12 * noise(vec2(ang * 22.0 - t, vObj.y * 1.4 + rad));
    if (isMode(${MODE.SLUSH}.0)) {
      float c = noise(vec2(ang * 40.0 - t * 1.3, vObj.y * 2.6 + rad * 1.3));
      base = mix(base, vec3(1.0), smoothstep(0.78, 0.95, c) * 0.55);
      rough = 0.42 - 0.25 * smoothstep(0.8, 0.95, c);
    }
  } else if (isMode(${MODE.GLASS}.0)) {
    if (uP.x > 0.5) {
      float side = abs(ang - uP.w);
      float k = (vObj.y - uP.y) / uP.z;
      float i = floor(k + 0.5);
      float lineY = abs(k - i) * uP.z;
      float markLen = mod(i, 2.0) < 0.5 ? 0.26 : 0.15;
      if (i >= 0.0 && i < uP.x && side < markLen) print = 1.0 - smoothstep(0.35, 0.75, lineY);
      float sideBar = abs(side - 0.02);
      if (vObj.y > uP.y - 1.0 && vObj.y < uP.y + uP.z * (uP.x - 1.0) + 1.0 && sideBar < 0.012) print = max(print, 0.9);
    }
  } else if (isMode(${MODE.FROST}.0)) {
    float f = noise(vObj.xy * 0.45 + vObj.z * 0.2) * 0.6 + noise(vObj.xy * 1.9) * 0.4;
    vec2 e = min(vUv, 1.0 - vUv);
    float edge = 1.0 - smoothstep(0.0, 0.14, min(e.x * 1.4, e.y * 1.8) + f * 0.06);
    frost = clamp(uP.x * (0.45 + 0.55 * f) + uP.y * edge * (0.55 + 0.45 * f), 0.0, 1.0);
    // light streaks across a flat pane (p.z): what makes a glass door read as glass
    float sw = vUv.x + vUv.y * 0.55;
    print = uP.z * ((smoothstep(0.28, 0.31, sw) - smoothstep(0.39, 0.45, sw)) * 0.5 + (smoothstep(0.5, 0.515, sw) - smoothstep(0.545, 0.57, sw)) * 0.35);
    base = mix(base, vec3(0.93, 0.97, 1.0), frost);
    base += vec3(0.6) * step(0.93, noise(vObj.xy * 3.1 + vObj.z)) * frost;
    rough = mix(rough, 0.75, frost);
  } else if (isMode(${MODE.TEX}.0)) {
    vec4 tx = texture2D(uTex, vUv);
    vec3 tc = pow(tx.rgb, vec3(2.2));
    base = mix(base, tc, tx.a);
    emit += tc * tx.a * uP.x;
    if (uP.y > 0.5) alpha *= tx.a;
  } else if (isMode(${MODE.STREAM}.0)) {
    float s = noise(vec2(ang * 1.5, vObj.y * 0.22 + uTime * uP.x));
    base *= 0.85 + 0.35 * s;
    rough = 0.18;
  } else if (isMode(${MODE.KNURL}.0)) {
    float s = step(0.0, sin(ang * uP.x));
    base *= 0.7 + 0.3 * s;
    rough = mix(rough, rough + 0.2, s);
  } else if (isMode(${MODE.GRILLE}.0)) {
    vec2 g = fract(vUv * uP.xy);
    float hole = step(g.x, uP.z) * step(0.12, g.y) * step(g.y, 0.88);
    base = mix(base, vec3(0.012, 0.012, 0.014), hole);
    metal *= 1.0 - hole;
    rough = mix(rough, 0.9, hole);
  } else if (isMode(${MODE.FOAM}.0)) {
    float f = noise(vObj.xy * uP.x + vec2(0.0, uTime * uP.y)) * 0.55 + noise(vObj.zy * uP.x * 1.9 - vec2(uTime * uP.y, 0.0)) * 0.45;
    base = mix(base, uColor2, smoothstep(0.5, 0.62, f) - smoothstep(0.66, 0.78, f));
    rough = 0.35;
  } else if (isMode(${MODE.MOLD}.0)) {
    float m = noise(vObj.xz * uP.x + vObj.y * 0.1) * 0.7 + noise(vObj.xz * uP.x * 3.0) * 0.3;
    base = mix(base, uColor2, smoothstep(0.6, 0.68, m) * uP.y);
    rough = 0.6;
  } else if (isMode(${MODE.WOOD}.0)) {
    // growth rings around the object's x axis, bent by noise, plus fine fibres along x
    float rr = length(vObj.yz) * uP.x + noise(vObj.xz * vec2(0.05, 0.2) + vObj.y * 0.1) * uP.y;
    float ring = abs(fract(rr) - 0.5) * 2.0;
    float fib = noise(vec2(vObj.x * 0.12, (vObj.y + vObj.z) * 2.3)) * 0.6 + noise(vec2(vObj.x * 0.4, (vObj.z - vObj.y) * 5.0)) * 0.4;
    base = mix(base, uColor2, clamp(smoothstep(0.55, 1.0, ring) * 0.75 + (fib - 0.45) * uP.z, 0.0, 1.0));
    rough = clamp(rough + (fib - 0.5) * 0.2, 0.05, 1.0);
  } else if (isMode(${MODE.GRAIN}.0) && uP.w > 0.5) {
    // packed clusters (p.w 1) or long seeds (2): a piece is dark (colour2, share p.z), light (share p.y)
    // or a shade of colour, rounded off toward its edge, with dark gaps between the pieces
    vec3 c = cells(vObj * uP.x, uP.w > 1.5 ? 0.7 : 0.0);
    float k = fract(c.z * 7.13);
    vec3 tone = c.z < uP.z ? mix(uColor2, uColor, k * 0.4) : uColor * (0.82 + 0.3 * k);
    if (c.z > 1.0 - uP.y && c.x < 0.5) tone = mix(uColor, vec3(0.86, 0.78, 0.6), 0.7);
    float gap = 1.0 - smoothstep(0.02, 0.32, c.y - c.x);
    base = mix(tone * (0.5 + 0.5 * clamp(1.0 - c.x * 1.1, 0.0, 1.0)), uColor2 * 0.5, gap * 0.85);
    rough = mix(rough, 1.0, gap);
  } else if (isMode(${MODE.GRAIN}.0)) {
    // fibres (a coconut's shell): two octaves of noise pick the dark bits (colour2) and the light ones
    vec2 q = vec2(vObj.x + vObj.z * 0.71, vObj.y - vObj.z * 0.53) * uP.x;
    float n = noise(q) * 0.65 + noise(q * 2.7 + 7.1) * 0.35;
    float m = noise(q * 1.9 + 3.3);
    base = mix(base, uColor2, smoothstep(0.5 - uP.z * 0.25, 0.62, n) * uP.z);
    base = mix(base, vec3(0.92, 0.86, 0.72), smoothstep(0.78 - uP.y * 0.2, 0.86, m) * uP.y);
    rough = clamp(rough + (n - 0.5) * 0.3, 0.05, 1.0);
  } else if (isMode(${MODE.LEDRING}.0)) {
    float k = (ang + PI) / (2.0 * PI) * uP.x;
    float i = floor(k);
    float gap = fract(k);
    float on = step(i + 0.5, uP.y * uP.x) * step(uP.z, gap) * step(gap, 1.0 - uP.z);
    emit *= on;
    base = mix(base, base * 0.4, on);
  }

  float nv = max(dot(n, v), 0.001);
  vec3 r = reflect(-v, n);
  float a = max(rough * rough, 0.003);
  vec3 diffLight = hemi(n) + max(dot(n, KEY), 0.0) * KEYCOL + max(dot(n, FILL), 0.0) * FILLCOL + max(dot(n, RIM), 0.0) * RIMCOL * 0.35;

  if (uGlass > 0.5) {
    // clear plastic / glass, premultiplied: the reflection covers the background as much as it
    // is bright (faint reflections must not turn into a milky veil after the gamma curve), the
    // material itself tints a little, more at grazing angles where the wall is seen edge-on
    float Fg = 0.04 + 0.96 * pow(1.0 - nv, 5.0);
    vec3 refl = env(r, rough) * Fg + lights(n, v, vec3(0.04), a);
    float aR = clamp(dot(refl, vec3(0.3, 0.55, 0.15)) * 1.7, 0.0, 1.0);
    float absorb = clamp(alpha * (1.0 + 2.6 * pow(1.0 - nv, 2.0)), 0.0, 0.85);
    vec3 c = display(refl) * aR + (1.0 - aR) * absorb * display(base * diffLight * 0.42);
    float al = aR + (1.0 - aR) * absorb;
    // thin clear glass over bright contents (jars): p.w of the reflection adds light instead of covering
    if (isMode(${MODE.PLAIN}.0)) al = mix(al, (1.0 - aR) * absorb, uP.w);
    if (isMode(${MODE.GLASS}.0) && uP.x > 0.5) {
      c = mix(c, display(vec3(0.82, 0.86, 0.9) * diffLight * 0.55) * 0.88, print);
      al = mix(al, 0.88, print);
    } else if (isMode(${MODE.FROST}.0)) {
      c = mix(c, display(vec3(0.86, 0.92, 0.98) * diffLight * 0.62) * 0.82, frost * 0.85);
      al = mix(al, 0.82, frost * 0.85);
      c += vec3(print) * (1.0 - al);
      al += print * (1.0 - al);
    }
    gl_FragColor = vec4(c, al);
    return;
  }

  vec3 F0 = mix(vec3(0.04), base, metal);
  vec3 Fr = F0 + (max(vec3(1.0 - rough), F0) - F0) * pow(1.0 - nv, 5.0);
  float ao = mix(0.68, 1.0, smoothstep(0.0, uAo, vPos.y));
  vec3 spec = env(r, rough) * Fr * (1.0 - 0.4 * rough) + lights(n, v, F0, a);
  vec3 diff = base * (1.0 - metal) * diffLight * (1.0 - 0.6 * maxc(Fr));
  vec3 col = (diff + spec) * ao;
  if (coat > 0.0) {
    float Fc = 0.04 + 0.96 * pow(1.0 - nv, 5.0);
    col = col * (1.0 - coat * Fc) + coat * (env(r, 0.04) * Fc + lights(n, v, vec3(0.04), 0.01));
  }
  col += emit;
  gl_FragColor = vec4(display(col) * alpha, alpha);
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`shader: ${log}`);
  }
  return sh;
}

const PASSES = ['shadow', 'opaque', 'decal', 'glass', 'glow'];

class Renderer {
  constructor(canvas, gl) {
    this.canvas = canvas;
    this.gl = gl;
    this.lost = false;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
    });
    canvas.addEventListener('webglcontextrestored', () => {
      try {
        this.init();
        this.lost = false;
      } catch {
        this.lost = true;
      }
    });
    this.init();
  }

  init() {
    const gl = this.gl;
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.bindAttribLocation(prog, 0, 'aPos');
    gl.bindAttribLocation(prog, 1, 'aNor');
    gl.bindAttribLocation(prog, 2, 'aUv');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(`program: ${gl.getProgramInfoLog(prog)}`);
    this.prog = prog;
    this.u = {};
    for (const name of ['uModel', 'uViewProj', 'uNorMat', 'uView', 'uColor', 'uColor2', 'uEmit', 'uMat', 'uP', 'uMode', 'uTime', 'uGlass', 'uAo', 'uTex']) {
      this.u[name] = gl.getUniformLocation(prog, name);
    }
    this.uint = !!gl.getExtension('OES_element_index_uint');
    this.meshes = new Map();
    this.textures = new Map();
    this.white = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.white);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 0]));
  }

  ensureSize(w, h) {
    const c = this.canvas;
    if (c.width < w || c.height < h) {
      c.width = Math.max(c.width, Math.ceil(w / 64) * 64);
      c.height = Math.max(c.height, Math.ceil(h / 64) * 64);
    }
  }

  buffers(mesh) {
    const gl = this.gl;
    let b = this.meshes.get(mesh.id);
    if (!b) {
      b = { pos: gl.createBuffer(), nor: gl.createBuffer(), uv: gl.createBuffer(), idx: gl.createBuffer(), version: -1 };
      this.meshes.set(mesh.id, b);
    }
    if (b.version !== mesh.version) {
      const usage = mesh.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW;
      gl.bindBuffer(gl.ARRAY_BUFFER, b.pos);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.pos, usage);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.nor);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.nor, usage);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.uv);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.uv, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.idx);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.idx, gl.STATIC_DRAW);
      b.count = mesh.idx.length;
      b.type = mesh.idx instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
      b.version = mesh.version;
    }
    return b;
  }

  // Texture from a spec { key, w, h, draw(ctx, w, h) } drawn on a 2D canvas once per key.
  texture(spec) {
    const gl = this.gl;
    let t = this.textures.get(spec.key);
    if (!t) {
      const c = document.createElement('canvas');
      c.width = spec.w;
      c.height = spec.h;
      spec.draw(c.getContext('2d'), spec.w, spec.h);
      t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (this.textures.size > 160) {
        const [oldKey, old] = this.textures.entries().next().value;
        gl.deleteTexture(old);
        this.textures.delete(oldKey);
      }
      this.textures.set(spec.key, t);
    }
    return t;
  }

  // Draws a scene { frame, elev, persp?, time, ao?, items } into the bottom-left w×h pixels of the canvas.
  render(scene, w, h) {
    if (this.lost) return false;
    const gl = this.gl;
    this.ensureSize(w, h);
    gl.viewport(0, 0, w, h);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.prog);
    const u = this.u;
    gl.uniformMatrix4fv(u.uViewProj, false, viewProjection(scene.frame, scene.elev, scene.persp));
    const view = viewDir(scene.elev);
    gl.uniform3fv(u.uView, view);
    gl.uniform1f(u.uTime, scene.time || 0);
    gl.uniform1f(u.uAo, scene.ao || 16);
    gl.uniform1i(u.uTex, 0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    gl.enableVertexAttribArray(2);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const lists = { shadow: [], opaque: [], decal: [], glass: [], glow: [] };
    for (const it of scene.items) (lists[it.pass] || lists.opaque).push(it);
    // clear things far to near; `order` nudges items that must draw before or after others
    const depthOf = (it) => {
      const c = it.mesh.center || (it.mesh.center = centerOf(it.mesh));
      return dot(transformPoint(it.m, c), view) + (it.order || 0) * 1000;
    };
    lists.glass.sort((a, b) => depthOf(a) - depthOf(b));
    lists.glow.sort((a, b) => depthOf(a) - depthOf(b));
    this.lastMat = null;
    for (const pass of PASSES) {
      const list = lists[pass];
      if (!list.length) continue;
      const blend = pass !== 'opaque';
      if (blend) gl.enable(gl.BLEND);
      else gl.disable(gl.BLEND);
      gl.depthMask(pass === 'opaque');
      for (const it of list) {
        if (pass === 'glass' && it.mat.double) {
          gl.enable(gl.CULL_FACE);
          gl.cullFace(gl.FRONT);
          this.draw(it);
          gl.cullFace(gl.BACK);
          this.draw(it);
        } else if ((pass === 'opaque' || pass === 'decal' || it.mat.front) && !it.mat.double) {
          gl.enable(gl.CULL_FACE);
          gl.cullFace(gl.BACK);
          this.draw(it);
        } else {
          gl.disable(gl.CULL_FACE);
          this.draw(it);
        }
      }
    }
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    gl.depthMask(true);
    return true;
  }

  draw(it) {
    const gl = this.gl;
    const u = this.u;
    const b = this.buffers(it.mesh);
    if (b.type === gl.UNSIGNED_INT && !this.uint) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, b.pos);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.nor);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.uv);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.idx);
    gl.uniformMatrix4fv(u.uModel, false, it.m);
    gl.uniformMatrix3fv(u.uNorMat, false, normalMatrix(it.m));
    const m = it.mat;
    if (m !== this.lastMat) {
      this.lastMat = m;
      gl.uniform3fv(u.uColor, m.color);
      gl.uniform3fv(u.uColor2, m.color2);
      gl.uniform3fv(u.uEmit, m.emit);
      gl.uniform4f(u.uMat, m.metal, m.rough, m.alpha, m.coat);
      gl.uniform4fv(u.uP, m.p);
      gl.uniform1f(u.uMode, m.mode);
      gl.uniform1f(u.uGlass, m.glass ? 1 : 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, m.tex ? this.texture(m.tex) : this.white);
    }
    gl.drawElements(gl.TRIANGLES, b.count, b.type, 0);
  }

  // Renders the scene and copies it into a 2D canvas of w×h device pixels.
  drawTo(target, scene, w, h) {
    if (!this.render(scene, w, h)) return false;
    if (target.width !== w) target.width = w;
    if (target.height !== h) target.height = h;
    const ctx = target.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this.canvas, 0, this.canvas.height - h, w, h, 0, 0, w, h);
    return true;
  }
}

function centerOf(mesh) {
  const p = mesh.pos;
  let x = 0;
  let y = 0;
  let z = 0;
  const n = p.length / 3 || 1;
  for (let i = 0; i < p.length; i += 3) {
    x += p[i];
    y += p[i + 1];
    z += p[i + 2];
  }
  return [x / n, y / n, z / n];
}

// The shared renderer, or null when WebGL is not available (the SVG art is used then).
let shared;
export function getRenderer() {
  if (shared !== undefined) return shared;
  shared = null;
  if (typeof document === 'undefined') return shared;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const attrs = { alpha: true, antialias: true, depth: true, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' };
    const gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs);
    if (gl) shared = new Renderer(canvas, gl);
  } catch (err) {
    console.warn('[gl3d] WebGL unavailable, using the drawn art', err);
    shared = null;
  }
  return shared;
}
