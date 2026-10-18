// Building blocks of the promo film (tools/promo): sprites placed by their centre, kinetic titles,
// particle bursts and live 3D views of the game's appliances. Each one is built once and then set
// to a moment in time; nothing animates on its own.

import { getRenderer } from '../../js/gl3d.js';
import { SCENES, VIEWS, fitFrame } from '../../js/kitchen3d.js';
import { compose, rotationY } from '../../js/geo3d.js';
import { createRng } from '../../js/rng.js';
import { clamp, ease, lerp, spring } from './motion.js';

export function div(parent, cls = '', html = '') {
  const d = document.createElement('div');
  if (cls) d.className = cls;
  if (html) d.innerHTML = html;
  if (parent) parent.append(d);
  return d;
}

const n2 = (v) => (Math.round(v * 100) / 100).toString();

// Something centred on (x, y): s scale, sx/sy squash and stretch, r degrees, o opacity, blur px.
export class Sprite {
  constructor(parent, html = '', cls = '') {
    this.el = div(parent, `sp${cls ? ` ${cls}` : ''}`);
    this.in = div(this.el, 'sp-in');
    this.content = null;
    this.html(html);
    this.shown = true;
    this.tf = this.op = this.fl = '';
  }

  html(h) {
    if (h !== this.content) {
      this.content = h;
      this.in.innerHTML = h;
    }
    return this;
  }

  set({ x = 0, y = 0, s = 1, sx = 1, sy = 1, r = 0, o = 1, blur = 0, bright = 1 } = {}) {
    const show = o > 0.003 && Math.abs(s * sx * sy) > 0.0005;
    if (show !== this.shown) {
      this.el.style.display = show ? '' : 'none';
      this.shown = show;
    }
    if (!show) return this;
    const tf = `translate(${n2(x)}px,${n2(y)}px) rotate(${n2(r)}deg) scale(${(s * sx).toFixed(4)},${(s * sy).toFixed(4)})`;
    if (tf !== this.tf) this.el.style.transform = this.tf = tf;
    const op = o >= 0.999 ? '' : o.toFixed(3);
    if (op !== this.op) this.el.style.opacity = this.op = op;
    let fl = blur > 0.05 ? `blur(${blur.toFixed(1)}px)` : '';
    if (Math.abs(bright - 1) > 0.01) fl += ` brightness(${bright.toFixed(2)})`;
    if (fl !== this.fl) this.el.style.filter = this.fl = fl;
    return this;
  }

  hide() {
    return this.set({ o: 0 });
  }
}

// ------------------------------------------------------------------ kinetic type
// Glossy fills like the logo of the game (light from the top).
export const FILLS = {
  white: 'linear-gradient(#ffffff, #ffffff 58%, #ffe3f1)',
  mango: 'linear-gradient(#fff6b8, #ffd23f 55%, #ff9f1c)',
  pink: 'linear-gradient(#ffc2de, #ff5fa2 55%, #e81f76)',
  lagoon: 'linear-gradient(#d4feff, #3fdce2 55%, #0e9aa1)',
  leaf: 'linear-gradient(#d9ffd0, #4fdc86 55%, #1f9a55)',
  red: 'linear-gradient(#ffe0e0, #ff5a5a 55%, #d61f3a)',
};

// A title whose letters move on their own: each letter is an outline layer (ink, with a hard
// drop shadow) under a glossy fill layer. '\n' breaks lines.
export class Title {
  constructor(parent, text, { size = 140, fill = 'white', stroke = 0.14, depth = 0.07, cls = '' } = {}) {
    this.sprite = new Sprite(parent, '', `tt${cls ? ` ${cls}` : ''}`);
    const box = this.sprite.in;
    box.style.fontSize = `${size}px`;
    box.style.setProperty('--fill', FILLS[fill] || fill);
    box.style.setProperty('--sw', `${(size * stroke).toFixed(1)}px`);
    box.style.setProperty('--sd', `${(size * depth).toFixed(1)}px`);
    this.chars = [];
    const rng = createRng(text.length * 7919 + size);
    for (const lineText of text.split('\n')) {
      const ln = div(box, 'tt-line');
      lineText.split(' ').forEach((word, wi) => {
        if (wi) ln.append(document.createTextNode(' '));
        const w = div(ln, 'tt-word');
        for (const c of word) {
          const ch = div(w, 'ch');
          div(ch, 'ch-s').textContent = c;
          div(ch, 'ch-f').textContent = c;
          this.chars.push({ el: ch, r: rng.range(-28, 28), dx: rng.range(-1, 1), tf: '', op: '' });
        }
      });
    }
  }

  get width() {
    return this.sprite.in.offsetWidth;
  }

  // Letter i at its own transform { x, y, s, r, o } (relative to its place in the line).
  letters(fn) {
    const n = this.chars.length;
    this.chars.forEach((c, i) => {
      const { x = 0, y = 0, s = 1, r = 0, o = 1 } = fn(i, n, c) || {};
      const tf = `translate(${n2(x)}px,${n2(y)}px) rotate(${n2(r)}deg) scale(${Math.max(0, s).toFixed(4)})`;
      if (tf !== c.tf) c.el.style.transform = c.tf = tf;
      const op = o >= 0.999 ? '' : Math.max(0, o).toFixed(3);
      if (op !== c.op) c.el.style.opacity = c.op = op;
    });
    return this;
  }

  // Letters pop in one after the other from lt = 0 (springy, from below, tilted), and leave
  // upwards from lt = out (if given).
  pop(lt, { stagger = 0.025, rise = 90, out = null, outStagger = 0.018, outDur = 0.22, freq = 3, damp = 10 } = {}) {
    return this.letters((i, n, c) => {
      const k = lt - i * stagger;
      if (k <= 0) return { o: 0 };
      const sp = spring(k, freq, damp);
      let y = (1 - sp) * rise;
      let s = sp;
      let r = c.r * (1 - sp);
      let o = 1;
      if (out !== null) {
        const q = clamp((lt - out - i * outStagger) / outDur);
        const e = ease.inBack(q);
        y -= e * 220;
        s *= 1 + e * 0.4;
        r += c.r * 0.6 * e;
        o = 1 - ease.inQuad(q);
      }
      return { y, s, r, o };
    });
  }

  // Letters bounce on the beat: wave from left to right starting at lt = 0.
  wave(lt, { amp = 26, stagger = 0.03, dur = 0.32 } = {}) {
    return this.letters((i) => {
      const k = clamp((lt - i * stagger) / dur);
      const b = Math.sin(Math.PI * k);
      return { y: -amp * b, s: 1 + 0.12 * b };
    });
  }

  rest() {
    return this.letters(() => ({}));
  }
}

// ------------------------------------------------------------------ particles
// A burst of things thrown from (x, y) at t0: each flies with drag and gravity, spins, pops in
// and fades out. html(i, rng) gives each particle's markup. flip: paper confetti (turns over).
export class Burst {
  constructor(parent, o) {
    const {
      n = 12, seed = 1, html, x = 540, y = 960, t0 = 0, speed = [600, 1400], angle = [0, 360],
      gravity = 1600, drag = 2.2, life = [0.7, 1.2], spin = [-540, 540], scale = [0.7, 1.2],
      spread = 0, flip = false, z = '',
    } = o;
    const rng = createRng(seed);
    this.t0 = t0;
    this.gravity = gravity;
    this.drag = drag;
    this.flip = flip;
    this.parts = [];
    for (let i = 0; i < n; i++) {
      const a = (rng.range(angle[0], angle[1]) * Math.PI) / 180;
      const v = rng.range(speed[0], speed[1]);
      const sp = new Sprite(parent, html(i, rng), `pt${z ? ` ${z}` : ''}`);
      sp.hide();
      this.parts.push({
        sp,
        x: x + rng.range(-spread, spread),
        y: y + rng.range(-spread, spread),
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: rng.range(life[0], life[1]),
        r0: rng.range(0, 360),
        vr: rng.range(spin[0], spin[1]),
        s: rng.range(scale[0], scale[1]),
        delay: rng.range(0, 0.04),
        fl: rng.range(5, 11),
      });
    }
  }

  update(t) {
    for (const p of this.parts) {
      const dt = t - this.t0 - p.delay;
      if (dt < 0 || dt > p.life) {
        p.sp.hide();
        continue;
      }
      const k = this.drag;
      const d = k > 0 ? (1 - Math.exp(-k * dt)) / k : dt;
      const x = p.x + p.vx * d;
      const y = p.y + p.vy * d + 0.5 * this.gravity * dt * dt;
      const pop = ease.outBack(clamp(dt / 0.12));
      const fade = 1 - ease.inQuad(clamp((dt - p.life * 0.65) / (p.life * 0.35)));
      const sy = this.flip ? Math.cos(dt * p.fl) : 1;
      p.sp.set({ x, y, s: p.s * pop, sy, r: p.r0 + p.vr * dt, o: fade });
    }
  }
}

// An expanding ring (shockwave) at t0.
export class Ring {
  constructor(parent, { x = 540, y = 960, t0 = 0, size = 900, dur = 0.55, color = '#ffffff', width = 26 }) {
    this.sp = new Sprite(parent, `<div class="ring" style="width:${size}px;height:${size}px;border-width:${width}px;border-color:${color}"></div>`, 'pt');
    Object.assign(this, { x, y, t0, dur });
  }

  update(t) {
    const k = (t - this.t0) / this.dur;
    if (k < 0 || k > 1) return this.sp.hide();
    return this.sp.set({ x: this.x, y: this.y, s: lerp(0.1, 1, ease.outCubic(k)), o: 1 - ease.inQuad(k) });
  }
}

// ------------------------------------------------------------------ 3D appliances
// A live picture of one of the game's 3D appliances (js/kitchen3d.js), size×size CSS px.
// draw(o, t, spin) renders the appliance in state o at time t, turned by spin radians.
export class View3D {
  constructor(parent, kind, size, { pr = 1, cls = '' } = {}) {
    this.sprite = new Sprite(parent, '', `v3d${cls ? ` ${cls}` : ''}`);
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = this.canvas.style.height = `${size}px`;
    this.sprite.in.append(this.canvas);
    this.kind = kind;
    this.size = size;
    this.px = Math.round(size * pr);
    this.frame = fitFrame(VIEWS[kind], size);
    this.key = '';
  }

  draw(o, t = 0, spin = 0) {
    const key = JSON.stringify([o, t, spin]);
    if (key === this.key) return true;
    const r = getRenderer();
    if (!r) return false;
    const scene = SCENES[this.kind](o, t, this.frame);
    if (spin) scene.items = scene.items.map((it) => ({ ...it, m: compose(rotationY(spin), it.m) }));
    const ok = r.drawTo(this.canvas, scene, this.px, this.px);
    this.key = ok ? key : '';
    return ok;
  }
}

// ------------------------------------------------------------------ small pieces
// A finger on the screen: white dot with a ring; press 0…1 squeezes it and sends out a ripple.
export function touchMarkup() {
  return '<div class="touch"><div class="touch-ripple"></div><div class="touch-dot"></div></div>';
}

export function setTouch(sp, { x, y, o = 1, press = 0, ripple = -1, size = 1 }) {
  sp.set({ x, y, o, s: size * (1 - press * 0.18) });
  const r = sp.in.querySelector('.touch-ripple');
  const k = clamp(ripple);
  r.style.transform = `scale(${(0.6 + k * 1.6).toFixed(3)})`;
  r.style.opacity = ripple < 0 || ripple > 1 ? '0' : (1 - k).toFixed(3);
}

// A round progress ring (0…1) with the value in the middle.
export function progressRingMarkup(size = 180, color = '#2fbf71') {
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  return `<svg class="pring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<circle cx="${size / 2}" cy="${size / 2}" r="${r + 9}" fill="#fffaf0" stroke="#2a1236" stroke-width="6"/>` +
    `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#eadff0" stroke-width="16"/>` +
    `<circle class="pring-bar" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="16" stroke-linecap="round"` +
    ` stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
}

export function setProgressRing(sp, k) {
  const bar = sp.in.querySelector('.pring-bar');
  const c = Number(bar.getAttribute('stroke-dasharray'));
  bar.setAttribute('stroke-dashoffset', (c * (1 - clamp(k))).toFixed(1));
}
