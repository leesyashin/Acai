// Real gameplay in the promo films (tools/promo): frames recorded by capture.mjs, shown through a
// camera that crops and scales the 1280×800 game, with the finger of the player drawn on top and the
// game's own sounds placed on the film's timeline.
//
//   const view = new FootageView(root, footage, { w: 1000, h: 1000, round: 46 });
//   await view.show(ft, { cx, cy, s })      // footage time ft (s), camera centre in game px, scale
//   const path = followPath(footage.clip)   // a smooth camera path that follows the player's finger
//   placeSounds(footage.clip, ft0, ft1, t0, cue, loops)

import { Sprite, div, touchMarkup, setTouch } from './kit.js';
import { clamp } from './motion.js';

const GAME_W = 1280;
const GAME_H = 800;

export class FootageView {
  // round: corner radius; blurBg: a blurred copy of the frame fills what the game does not cover;
  // window: ink frame and shadow like a screen
  constructor(parent, footage, { w = 1080, h = 1920, round = 0, blurBg = false, window = false, finger = true } = {}) {
    this.footage = footage;
    this.clip = footage.clip;
    this.w = w;
    this.h = h;
    this.sprite = new Sprite(parent, '', 'footage');
    this.box = div(this.sprite.in, `fg-box${window ? ' window' : ''}`);
    this.box.style.width = `${w}px`;
    this.box.style.height = `${h}px`;
    this.box.style.borderRadius = `${round}px`;
    if (blurBg) {
      // a tiny copy scaled up is a cheap blur
      this.bg = document.createElement('canvas');
      this.bg.width = 54;
      this.bg.height = Math.round((54 * h) / w);
      this.bg.className = 'fg-bg';
      this.box.append(this.bg);
      div(this.box, 'fg-bg-tint');
    }
    this.img = document.createElement('img');
    this.img.className = 'fg-img';
    this.img.width = GAME_W;
    this.img.height = GAME_H;
    this.img.alt = '';
    this.box.append(this.img);
    this.finger = finger ? new Sprite(this.box, touchMarkup()) : null;
    this.f = 0;
  }

  frameAt(ft) {
    return clamp(Math.round(ft * this.clip.fps), 1, this.clip.frames);
  }

  // How hard the finger presses around frame f (0…1, eased over a few frames).
  pressAt(f) {
    let sum = 0;
    let n = 0;
    for (let i = f - 3; i <= f + 1; i++) {
      const p = this.clip.pointer[clamp(i, 1, this.clip.frames) - 1];
      sum += p[2];
      n++;
    }
    return sum / n;
  }

  async show(ft, cam) {
    const f = this.frameAt(ft);
    const { cx, cy, s } = cam;
    this.img.style.transform = `translate(${(this.w / 2 - cx * s).toFixed(2)}px,${(this.h / 2 - cy * s).toFixed(2)}px) scale(${s.toFixed(4)})`;
    if (this.finger) {
      const [px, py] = this.clip.pointer[f - 1];
      const press = this.pressAt(f);
      // the finger rests a little below the dragged item, like a fingertip holding it
      setTouch(this.finger, {
        x: this.w / 2 + (px - cx + 16) * s, y: this.h / 2 + (py - cy + 26) * s, o: press, press: press * 0.6, size: clamp(0.35 * s, 0.32, 0.8),
      });
    }
    if (f === this.f) return;
    this.f = f;
    this.img.src = `${this.footage.base}/${String(f).padStart(5, '0')}.jpg`;
    try {
      await this.img.decode();
    } catch {
      return;
    }
    if (this.bg) {
      const c = this.bg.getContext('2d');
      const k = Math.max(this.bg.width / GAME_W, this.bg.height / GAME_H);
      c.drawImage(this.img, (this.bg.width - GAME_W * k) / 2, (this.bg.height - GAME_H * k) / 2, GAME_W * k, GAME_H * k);
    }
  }
}

// A smooth path (game px per frame) that follows the player's finger. Smoothed forwards and backwards,
// so the camera starts to move a moment before the finger does – like an operator who knows the game.
export function followPath(clip, { k = 0.06 } = {}) {
  const n = clip.frames;
  const smooth = (v) => {
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < n; i++) v[i] = v[i - 1] + (v[i] - v[i - 1]) * k;
      for (let i = n - 2; i >= 0; i--) v[i] = v[i + 1] + (v[i] - v[i + 1]) * k;
    }
    return v;
  };
  return {
    x: smooth(Float64Array.from(clip.pointer, (p) => p[0])),
    y: smooth(Float64Array.from(clip.pointer, (p) => p[1])),
  };
}

// Keeps a camera (centre cx/cy in game px, scale s) inside the game frame for a w×h view; centred
// on an axis where the view is wider or taller than the game at that scale.
export function fitCam(cx, cy, s, w, h) {
  const fit = (v, size, view) => {
    const half = view / s / 2;
    return half >= size / 2 ? size / 2 : clamp(v, half, size - half);
  };
  return { cx: fit(cx, GAME_W, w), cy: fit(cy, GAME_H, h), s };
}

// The camera on a path at footage time ft (see followPath), fitted to the view.
export function camOn(path, clip, ft, s, w, h) {
  const f = clamp(Math.round(ft * clip.fps), 1, clip.frames) - 1;
  return fitCam(path.x[f], path.y[f], s, w, h);
}

// Puts the game's own sounds of footage [ft0, ft1) at film time t0: effects as cues, the blender's
// hum as loops (rate > 1 when the footage plays faster).
export function placeSounds(clip, ft0, ft1, t0, cue, loops, { gain = 1, rate = 1 } = {}) {
  const at = (ft) => t0 + (ft - ft0) / rate;
  let on = false;
  let start = null; // null while the hum started before the segment
  for (const e of clip.sounds) {
    if (e.t >= ft1) break;
    if (e.loop) {
      if (e.t < ft0) on = e.on;
      else if (e.on && !on) {
        on = true;
        start = e.t;
      } else if (!e.on && on) {
        loops.push({ id: e.loop, from: at(start ?? ft0), to: at(e.t), gain: gain * 0.9 });
        on = false;
        start = null;
      }
      continue;
    }
    if (e.t >= ft0) cue(at(e.t), e.name, { kind: 'sfx', gain, step: e.step, alt: e.alt });
  }
  if (on) loops.push({ id: 'blender', from: at(start ?? ft0), to: at(ft1), gain: gain * 0.9 });
}
