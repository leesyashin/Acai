// Açaí Fever – every sound is synthesized with WebAudio (no audio files).
// Contract: docs/DESIGN.md §4.5.
//
//   audio.unlock()            call from user gestures (idempotent, iOS-safe)
//   audio.sfx(name)           one-shot effect (see SFX_NAMES)
//   audio.music(track)        'menu' | 'game' | null – crossfades, remembers the request
//   audio.loop(id, on)        continuous sounds: 'blender'
//   audio.setSfx(bool) / audio.setMusic(bool) / audio.sfxOn() / audio.musicOn()
//   audio.suspend() / audio.resume()   pause menu: music fades, the context freezes after
//                                      SUSPEND_DELAY_MS (tab hiding is handled here too, at once)
//
// Importing this module never touches WebAudio; the AudioContext is created
// lazily inside unlock(). Every call is a safe no-op while locked, unsupported or muted.

import { createRng } from './rng.js';

export const SFX_NAMES = [
  'click', 'pickup', 'drop', 'reject', 'blenderStart', 'blenderReady', 'overflow', 'ruined',
  'smoothieReady', 'pour', 'plop', 'coin', 'bell', 'angry', 'happy', 'trash', 'purchase',
  'star', 'win', 'lose', 'closing', 'heart', 'tick',
];
export const MUSIC_TRACKS = ['menu', 'game'];
export const LOOP_IDS = ['blender'];

const MUSIC_LEVEL = 0.16;
const SFX_LEVEL = 0.5;
const MASTER_LEVEL = 0.9;
const LOOKAHEAD = 0.12;       // seconds of music scheduled ahead
const PUMP_MS = 25;           // scheduler interval
const START_DELAY = 0.05;     // a new track's first step, counted from the first scheduler tick
const LATE_OK = 0.02;         // a step this late still plays; later ones are skipped (main thread stalled)
// Pause menu: fade the music bus, then freeze the context once in-flight sounds are over –
// the tap's own click (~90 ms) and the blender loop's stop tail (0.35 s) – instead of cutting them.
const PAUSE_FADE = 0.08;
const UNPAUSE_FADE = 0.25;
const SUSPEND_DELAY_MS = 400;
const FADE_IN = 0.6;
const CROSSFADE = 1.0;
const FADE_OUT = 0.8;
const THROTTLE_MS = 40;
const STAR_WINDOW_MS = 1500;
const STAR_STEPS = [0, 2, 4, 7, 9, 12, 14];

const hasWindow = typeof window !== 'undefined';
const AC = hasWindow ? window.AudioContext || window.webkitAudioContext || null : null;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ------------------------------------------------------------------ synthesis helpers
// A "voice target" v = { ctx, out, t } – everything below schedules at v.t (+ at).

const noiseCache = new WeakMap();
function noiseBuffer(c) {
  let buf = noiseCache.get(c);
  if (!buf) {
    const rng = createRng(0xaca1);
    buf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = rng.next() * 2 - 1;
    noiseCache.set(c, buf);
  }
  return buf;
}

// Attack → hold → exponential-ish decay. Returns the gain node and the stop time.
function envelope(c, t, o) {
  const g = c.createGain();
  const a = o.a ?? 0.004;
  const peak = o.peak ?? 0.5;
  const hold = o.hold ?? 0;
  const decay = Math.max(0.005, o.decay ?? 0.2);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  if (hold > 0) g.gain.setValueAtTime(peak, t + a + hold);
  g.gain.setTargetAtTime(0, t + a + hold, decay / 5);
  return { g, end: t + a + hold + decay + 0.03 };
}

function sweep(param, f, f2, t, slide) {
  param.setValueAtTime(f, t);
  if (f2) param.exponentialRampToValueAtTime(f2, t + (slide || 0.1));
}

function filterNode(c, src, fo, t) {
  const bq = c.createBiquadFilter();
  bq.type = fo.type || 'lowpass';
  sweep(bq.frequency, fo.f, fo.f2, t, fo.slide);
  bq.Q.setValueAtTime(fo.q ?? 1, t);
  src.connect(bq);
  return bq;
}

function lfo(c, rate, depth, target, t, end) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.frequency.setValueAtTime(rate, t);
  g.gain.setValueAtTime(depth, t);
  o.connect(g);
  g.connect(target);
  o.start(t);
  o.stop(end);
}

// Route env gain → (optional tremolo) → out.
function finish(c, g, out, o, t, end) {
  if (!o.am) {
    g.connect(out);
    return;
  }
  const am = c.createGain();
  am.gain.setValueAtTime(1 - o.am.depth, t);
  lfo(c, o.am.rate, o.am.depth, am.gain, t, end);
  g.connect(am);
  am.connect(out);
}

// Oscillator voice. Options: type, f, f2/slide (pitch sweep), detune, a/peak/hold/decay,
// filter {type,f,f2,slide,q}, vib {rate,depth Hz}, am {rate,depth}, fm {ratio,index,decay,sustain}.
function tone(v, o) {
  const c = v.ctx;
  if (o.f >= c.sampleRate / 2) return;
  const t = v.t + (o.at || 0);
  const osc = c.createOscillator();
  osc.type = o.type || 'sine';
  sweep(osc.frequency, o.f, o.f2, t, o.slide);
  if (o.detune) osc.detune.setValueAtTime(o.detune, t);
  const { g, end } = envelope(c, t, o);
  const src = o.filter ? filterNode(c, osc, o.filter, t) : osc;
  src.connect(g);
  finish(c, g, o.out || v.out, o, t, end);
  if (o.vib) lfo(c, o.vib.rate, o.vib.depth, osc.frequency, t, end);
  if (o.fm) {
    const mod = c.createOscillator();
    const mg = c.createGain();
    mod.frequency.setValueAtTime(o.f * o.fm.ratio, t);
    mg.gain.setValueAtTime(o.f * o.fm.index, t);
    mg.gain.setTargetAtTime(o.f * o.fm.index * (o.fm.sustain || 0), t, o.fm.decay / 4);
    mod.connect(mg);
    mg.connect(osc.frequency);
    mod.start(t);
    mod.stop(end);
  }
  osc.start(t);
  osc.stop(end);
}

// Filtered noise burst. Options: ft (filter type), f, f2/slide, q, offset + envelope options.
function noise(v, o) {
  const c = v.ctx;
  const t = v.t + (o.at || 0);
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  src.loop = true;
  const { g, end } = envelope(c, t, o);
  const f = filterNode(c, src, { type: o.ft || 'bandpass', f: o.f || 1000, f2: o.f2, slide: o.slide, q: o.q }, t);
  f.connect(g);
  finish(c, g, o.out || v.out, o, t, end);
  src.start(t, o.offset || 0);
  src.stop(end);
}

const BELL_PARTIALS = [[1, 1, 1], [2, 0.32, 0.55], [2.76, 0.22, 0.4], [5.4, 0.08, 0.2]];
const DOOR_PARTIALS = [[1, 1, 1], [2.4, 0.45, 0.5], [3.9, 0.2, 0.3], [6.2, 0.08, 0.15]];

// Struck bell / chime from sine partials [ratio, gain, decay scale].
function chime(v, { at = 0, f, peak = 0.3, decay = 0.8, partials = BELL_PARTIALS }) {
  for (const [r, gs, ds] of partials) {
    if (f * r < 16000) tone(v, { at, f: f * r, a: 0.002, peak: peak * gs, decay: decay * ds });
  }
}

// Two detuned saws through an opening low-pass: cartoon brass.
function brass(v, { at = 0, m, len, peak, wah = false, vib }) {
  const f = mtof(m);
  const filter = wah
    ? { type: 'lowpass', f: f * 1.3, f2: f * 6, slide: len * 0.8, q: 7 }
    : { type: 'lowpass', f: f * 2, f2: f * 7, slide: 0.07, q: 2 };
  for (const detune of [-7, 7]) {
    tone(v, { at, type: 'sawtooth', f, detune, a: 0.03, hold: len, peak: peak / 2, decay: 0.14, filter, vib });
  }
}

const later = (v, dt) => ({ ctx: v.ctx, out: v.out, t: v.t + dt });

// ------------------------------------------------------------------ instruments (music + sfx)
const INST = {
  marimba(v, m, vel) {
    const f = mtof(m);
    const decay = clamp(1.1 - (m - 48) * 0.022, 0.3, 1.0);
    tone(v, { f, a: 0.003, peak: vel, decay, fm: { ratio: 1, index: 0.8, decay: 0.06 } });
    tone(v, { f: f * 3.93, a: 0.001, peak: vel * 0.16, decay: 0.05 });
  },
  steel(v, m, vel) {
    const f = mtof(m);
    tone(v, { f, a: 0.004, peak: vel, decay: 0.85, fm: { ratio: 2, index: 1.1, decay: 0.12, sustain: 0.08 } });
    tone(v, { f: f * 2, detune: 7, a: 0.004, peak: vel * 0.26, decay: 0.32 });
    tone(v, { f: f * 3, detune: -5, a: 0.003, peak: vel * 0.1, decay: 0.16 });
  },
  vibes(v, m, vel, dur) {
    const f = mtof(m);
    tone(v, { f, a: 0.004, peak: vel, hold: Math.min(dur, 0.8) * 0.3, decay: 1.3, am: { rate: 5.2, depth: 0.3 } });
    tone(v, { f: f * 4, a: 0.002, peak: vel * 0.1, decay: 0.12 });
  },
  keys(v, m, vel, dur) {
    const f = mtof(m);
    tone(v, { f, a: 0.006, peak: vel, hold: dur * 0.3, decay: 0.55, fm: { ratio: 1, index: 0.45, decay: 0.25, sustain: 0.08 } });
  },
  bass(v, m, vel, dur) {
    const f = mtof(m);
    const hold = dur * 0.55;
    tone(v, { type: 'triangle', f, a: 0.008, hold, peak: vel, decay: 0.2, filter: { type: 'lowpass', f: 900, q: 0.5 } });
    tone(v, { f, a: 0.008, hold, peak: vel * 0.6, decay: 0.18 });
  },
  kick(v, vel) {
    tone(v, { f: 150, f2: 48, slide: 0.11, a: 0.002, peak: vel, decay: 0.3 });
    tone(v, { type: 'triangle', f: 900, f2: 300, slide: 0.02, a: 0.001, peak: vel * 0.12, decay: 0.02 });
  },
  clap(v, vel) {
    for (const dt of [0, 0.011, 0.022]) noise(v, { at: dt, ft: 'bandpass', f: 1500, q: 0.9, a: 0.001, peak: vel * 0.7, decay: 0.012 });
    noise(v, { at: 0.03, ft: 'bandpass', f: 1300, q: 0.8, a: 0.002, peak: vel * 0.6, decay: 0.13 });
  },
  shaker(v, vel, offset = 0) {
    noise(v, { ft: 'highpass', f: 6000, q: 0.5, a: 0.007, peak: vel, decay: 0.05, offset });
  },
  rim(v, vel) {
    tone(v, { type: 'triangle', f: 1750, a: 0.001, peak: vel, decay: 0.03 });
    noise(v, { ft: 'bandpass', f: 3200, q: 3, a: 0.001, peak: vel * 0.6, decay: 0.02 });
  },
  conga(v, m, vel) {
    const f = mtof(m);
    tone(v, { f: f * 1.18, f2: f, slide: 0.03, a: 0.002, peak: vel, decay: 0.22 });
    noise(v, { ft: 'bandpass', f: 2200, q: 1.5, a: 0.001, peak: vel * 0.25, decay: 0.015 });
  },
};

// ------------------------------------------------------------------ sound effects
// Each receives v = {ctx, out, t} and options {step, alt}.
const SFX = {
  click(v) {
    tone(v, { type: 'triangle', f: 1500, f2: 950, slide: 0.03, a: 0.001, peak: 0.42, decay: 0.06 });
    tone(v, { f: 750, f2: 520, slide: 0.03, a: 0.001, peak: 0.16, decay: 0.05 });
    noise(v, { ft: 'highpass', f: 4000, a: 0.001, peak: 0.15, decay: 0.015 });
  },
  pickup(v) {
    tone(v, { f: 360, f2: 820, slide: 0.07, a: 0.004, peak: 0.5, decay: 0.12 });
    tone(v, { type: 'triangle', f: 720, f2: 1640, slide: 0.07, a: 0.004, peak: 0.2, decay: 0.08 });
    noise(v, { ft: 'bandpass', f: 900, f2: 3200, slide: 0.08, q: 1.5, a: 0.02, peak: 0.15, decay: 0.06 });
  },
  drop(v) {
    tone(v, { f: 640, f2: 170, slide: 0.12, a: 0.003, peak: 0.55, decay: 0.16 });
    tone(v, { type: 'triangle', f: 1280, f2: 340, slide: 0.1, a: 0.003, peak: 0.12, decay: 0.08 });
    noise(v, { ft: 'lowpass', f: 900, a: 0.002, peak: 0.35, decay: 0.06 });
  },
  reject(v) {
    for (const [dt, f, len] of [[0, 311, 0.1], [0.14, 208, 0.18]]) {
      const filter = { type: 'lowpass', f: 1700, q: 1 };
      tone(v, { at: dt, type: 'square', f, a: 0.006, hold: len, peak: 0.2, decay: 0.06, filter, vib: { rate: 30, depth: f * 0.02 } });
      tone(v, { at: dt, type: 'sawtooth', f: f * 1.01, a: 0.006, hold: len, peak: 0.12, decay: 0.06, filter });
    }
  },
  blenderStart(v) {
    tone(v, { type: 'square', f: 1900, a: 0.001, peak: 0.16, decay: 0.025, filter: { type: 'lowpass', f: 4000 } });
    tone(v, {
      at: 0.03, type: 'sawtooth', f: 55, f2: 165, slide: 0.45, a: 0.06, hold: 0.25, peak: 0.45, decay: 0.2,
      filter: { type: 'lowpass', f: 300, f2: 1800, slide: 0.45, q: 4 }, vib: { rate: 13, depth: 6 },
    });
    noise(v, { at: 0.03, ft: 'bandpass', f: 500, f2: 2200, slide: 0.45, q: 0.9, a: 0.15, hold: 0.15, peak: 0.3, decay: 0.18 });
  },
  blenderReady(v) {
    chime(v, { f: 1319, peak: 0.4, decay: 0.7 });
    chime(v, { at: 0.17, f: 1760, peak: 0.42, decay: 0.9 });
  },
  overflow(v) {
    [0, 0.11, 0.22, 0.33].forEach((dt, i) => tone(v, {
      at: dt, type: 'square', f: i % 2 ? 740 : 988, a: 0.003, hold: 0.045, peak: 0.38, decay: 0.04,
      filter: { type: 'lowpass', f: 2600 },
    }));
  },
  ruined(v) {
    tone(v, {
      type: 'sawtooth', f: 340, f2: 70, slide: 0.55, a: 0.01, hold: 0.25, peak: 0.45, decay: 0.3,
      filter: { type: 'lowpass', f: 2600, f2: 220, slide: 0.55, q: 10 }, vib: { rate: 9, depth: 22 },
    });
    noise(v, { ft: 'lowpass', f: 1400, f2: 250, slide: 0.2, a: 0.004, peak: 0.3, decay: 0.2 });
  },
  smoothieReady(v) {
    [[0, 420], [0.055, 560], [0.1, 480], [0.15, 680], [0.2, 820]].forEach(([dt, f]) =>
      tone(v, { at: dt, f, f2: f * 2.1, slide: 0.045, a: 0.004, peak: 0.32, decay: 0.06 }));
    chime(v, { at: 0.28, f: 1568, peak: 0.42, decay: 0.9 });
  },
  pour(v) {
    tone(v, {
      type: 'triangle', f: 540, f2: 180, slide: 0.38, a: 0.02, hold: 0.2, peak: 0.5, decay: 0.2,
      filter: { type: 'lowpass', f: 1500 }, vib: { rate: 15, depth: 50 },
    });
    noise(v, { ft: 'bandpass', f: 900, f2: 300, slide: 0.38, q: 2.5, a: 0.04, hold: 0.18, peak: 0.25, decay: 0.15 });
    tone(v, { at: 0.38, f: 240, f2: 520, slide: 0.05, a: 0.004, peak: 0.35, decay: 0.09 });
  },
  plop(v) {
    noise(v, { ft: 'bandpass', f: 1800, q: 1.2, a: 0.001, peak: 0.25, decay: 0.03 });
    tone(v, { f: 460, f2: 250, slide: 0.06, a: 0.003, peak: 0.5, decay: 0.08 });
    tone(v, { at: 0.07, f: 560, f2: 330, slide: 0.05, a: 0.003, peak: 0.36, decay: 0.06 });
  },
  coin(v) {
    noise(v, { ft: 'highpass', f: 5000, a: 0.002, peak: 0.2, decay: 0.06 });
    const filter = { type: 'lowpass', f: 5000 };
    tone(v, { at: 0.02, type: 'square', f: 988, a: 0.002, hold: 0.05, peak: 0.16, decay: 0.03, filter });
    tone(v, { at: 0.08, type: 'square', f: 1319, a: 0.002, hold: 0.04, peak: 0.16, decay: 0.4, filter });
    chime(v, { at: 0.08, f: 2637, peak: 0.14, decay: 0.5 });
  },
  bell(v) {
    [[0, 1661, 0.38], [0.1, 2093, 0.3], [0.21, 1661, 0.24], [0.33, 2093, 0.16]].forEach(([dt, f, peak]) =>
      chime(v, { at: dt, f, peak, decay: 0.8, partials: DOOR_PARTIALS }));
  },
  angry(v) {
    const syllable = (dt, f, f2, len, peak) => tone(v, {
      at: dt, type: 'sawtooth', f, f2, slide: len, a: 0.02, hold: len * 0.6, peak, decay: len * 0.5,
      filter: { type: 'bandpass', f: 650, q: 2.2 }, am: { rate: 26, depth: 0.55 },
    });
    syllable(0, 230, 175, 0.18, 0.9);
    syllable(0.24, 190, 105, 0.42, 1.0);
  },
  happy(v) {
    tone(v, { type: 'triangle', f: 620, f2: 940, slide: 0.07, a: 0.008, peak: 0.42, decay: 0.08 });
    tone(v, { at: 0.09, type: 'triangle', f: 880, f2: 1400, slide: 0.12, a: 0.008, hold: 0.06, peak: 0.45, decay: 0.16, vib: { rate: 13, depth: 25 } });
    tone(v, { at: 0.09, f: 1760, f2: 2800, slide: 0.12, a: 0.008, hold: 0.04, peak: 0.08, decay: 0.12 });
  },
  trash(v) {
    noise(v, { ft: 'bandpass', f: 2600, f2: 500, slide: 0.18, q: 1.4, a: 0.03, peak: 0.35, decay: 0.15 });
    noise(v, { at: 0.17, ft: 'lowpass', f: 500, a: 0.002, peak: 0.4, decay: 0.09 });
    [[1, 0.2, 0.25], [2.71, 0.12, 0.16], [4.13, 0.07, 0.1]].forEach(([r, peak, decay]) =>
      tone(v, { at: 0.17, type: 'triangle', f: 310 * r, a: 0.001, peak, decay }));
  },
  purchase(v) {
    [72, 76, 79, 84, 88, 91].forEach((m, i) => chime(v, { at: i * 0.055, f: mtof(m), peak: 0.22, decay: 0.45 }));
    noise(v, { at: 0.22, ft: 'highpass', f: 7000, a: 0.05, peak: 0.08, decay: 0.35 });
    chime(v, { at: 0.36, f: mtof(96), peak: 0.16, decay: 0.8 });
  },
  star(v, o) {
    const f = 1047 * Math.pow(2, STAR_STEPS[Math.min(o.step || 0, STAR_STEPS.length - 1)] / 12);
    chime(v, { f, peak: 0.45, decay: 1.0 });
    chime(v, { at: 0.03, f: f * 2, peak: 0.12, decay: 0.5 });
    noise(v, { ft: 'highpass', f: 8000, a: 0.01, peak: 0.07, decay: 0.3 });
  },
  win(v) {
    const notes = [[0, 67, 0.11], [0.12, 72, 0.11], [0.24, 76, 0.11], [0.36, 79, 0.24], [0.64, 76, 0.1], [0.76, 79, 0.9]];
    for (const [dt, m, len] of notes) brass(v, { at: dt, m, len, peak: 0.2, vib: len > 0.5 ? { rate: 5.5, depth: 4 } : null });
    for (const m of [60, 64, 67]) brass(v, { at: 0.76, m, len: 0.9, peak: 0.09 });
    INST.kick(later(v, 0.76), 0.6);
    noise(v, { at: 0.76, ft: 'highpass', f: 6000, a: 0.02, hold: 0.15, peak: 0.1, decay: 0.9 });
    [84, 88, 91, 96].forEach((m, i) => chime(v, { at: 1.0 + i * 0.07, f: mtof(m), peak: 0.1, decay: 0.5 }));
  },
  lose(v) {
    const notes = [[0, 58, 0.3], [0.4, 57, 0.3], [0.8, 56, 0.3], [1.2, 55, 1.0]];
    notes.forEach(([dt, m, len], i) => brass(v, {
      at: dt, m, len, peak: 0.3, wah: true, vib: i === 3 ? { rate: 5.5, depth: 5 } : null,
    }));
  },
  closing(v) {
    SFX.bell(v);
    const jingle = [[0.42, 84, 0.3], [0.54, 79, 0.28], [0.66, 76, 0.28], [0.78, 79, 0.3], [0.96, 84, 0.36]];
    for (const [dt, m, vel] of jingle) {
      INST.steel(later(v, dt), m, vel);
      INST.marimba(later(v, dt), m - 12, vel * 0.5);
    }
  },
  heart(v) {
    tone(v, { f: 150, f2: 45, slide: 0.2, a: 0.002, peak: 0.9, decay: 0.3 });
    noise(v, { ft: 'lowpass', f: 380, a: 0.002, peak: 0.45, decay: 0.1 });
    tone(v, { at: 0.07, type: 'triangle', f: 523, f2: 349, slide: 0.25, a: 0.01, hold: 0.08, peak: 0.28, decay: 0.2 });
  },
  tick(v, o) {
    const f = o.alt ? 1400 : 1900;
    tone(v, { f, a: 0.001, peak: 0.42, decay: 0.05 });
    tone(v, { type: 'triangle', f: f / 2, a: 0.001, peak: 0.25, decay: 0.04 });
    noise(v, { ft: 'bandpass', f: f * 1.6, q: 4, a: 0.001, peak: 0.4, decay: 0.02 });
  },
};

// ------------------------------------------------------------------ continuous loops
// start(c, out, t) → { stop(t) }. Levels ramp smoothly in and out.
const LOOPS = {
  blender(c, out, t) {
    const level = 0.24;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + 0.2);
    g.connect(out);
    const trem = c.createGain();
    trem.gain.setValueAtTime(0.82, t);
    trem.connect(g);

    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c);
    src.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1400, t);
    bp.Q.setValueAtTime(1.3, t);
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.55, t);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(trem);

    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(560, t);
    lp.Q.setValueAtTime(3, t);
    const sg = c.createGain();
    sg.gain.setValueAtTime(0.34, t);
    lp.connect(sg);
    sg.connect(trem);
    const motors = [92, 138.5].map((f, i) => {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t);
      const og = c.createGain();
      og.gain.setValueAtTime(i ? 0.4 : 1, t);
      o.connect(og);
      og.connect(lp);
      return o;
    });

    const wobble = [[6.5, 7, motors[0].frequency], [6.5, 10, motors[1].frequency], [3.1, 450, bp.frequency], [11, 0.18, trem.gain]];
    const lfos = wobble.map(([rate, depth, target]) => {
      const o = c.createOscillator();
      const og = c.createGain();
      o.frequency.setValueAtTime(rate, t);
      og.gain.setValueAtTime(depth, t);
      o.connect(og);
      og.connect(target);
      return o;
    });

    const sources = [src, ...motors, ...lfos];
    for (const s of sources) s.start(t);
    return {
      stop(t2) {
        g.gain.cancelScheduledValues(t2);
        g.gain.setValueAtTime(g.gain.value, t2);
        g.gain.linearRampToValueAtTime(0, t2 + 0.3);
        for (const s of sources) s.stop(t2 + 0.35);
      },
    };
  },
};

// ------------------------------------------------------------------ music data
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const QUALITY = {
  '': [0, 4, 7], m: [0, 3, 7], m7: [0, 3, 7, 10], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11],
  m6: [0, 3, 7, 9], 6: [0, 4, 7, 9], add9: [0, 4, 7, 14], '7sus': [0, 5, 7, 10],
};

function noteToMidi(name) {
  const m = /^([A-G])([#b]?)(\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  return 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

// Close voicing of all chord tones inside [low, low + 12).
function voice(pc, ints, low) {
  return ints.map((i) => low + ((((pc + i - low) % 12) + 12) % 12)).sort((a, b) => a - b);
}

function parseChord(sym) {
  const m = /^([A-G])([#b]?)(.*)$/.exec(sym);
  const pc = (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  const ints = QUALITY[m[3]];
  if (!ints) throw new Error(`bad chord ${sym}`);
  const pcs = ints.map((i) => (pc + i) % 12);
  return { sym, pcs, bass: 40 + ((pc - 4 + 12) % 12), lo: voice(pc, ints, 55), hi: voice(pc, ints, 60) };
}

// "A4/3 C5/3 r/2 …" – note/duration in 16th steps; r = rest.
function parseBar(str) {
  const at = new Array(16).fill(null);
  let s = 0;
  for (const tok of str.trim().split(/\s+/)) {
    const [n, d] = tok.split('/');
    const dur = Number(d);
    if (n !== 'r' && s < 16) at[s] = { m: noteToMidi(n), d: dur };
    s += dur;
  }
  return { at, steps: s };
}

// Harmony voice: a diatonic third below; for notes outside the key the nearest chord tone below.
function harmonyBelow(m, scale, chord) {
  const pcOf = (n) => ((n % 12) + 12) % 12;
  const idx = scale.indexOf(pcOf(m));
  if (idx < 0) {
    for (let n = m - 3; n > m - 10; n--) if (chord.pcs.includes(pcOf(n))) return n;
    return m - 4;
  }
  const target = scale[(idx + 5) % 7];
  let n = m - 1;
  while (pcOf(n) !== target) n--;
  return n;
}

const ARP = [0, 1, 2, 3, 2, 1, 0, 2];
const humanize = (rng) => rng.range(0.88, 1.06);

// Relaxed bossa: surdo-ish kick, rim clave, keys comping, marimba / vibes melody.
// Variation per pass of the 16-bar form: 0 marimba melody, 1 vibes + call-and-response,
// 2 arpeggio breakdown in A, melody in thirds in B.
function arrangeMenu(p) {
  const { v, s, bar, pass, sd, chord, mel, tr, rng } = p;
  const h = () => humanize(rng);
  const variant = pass % 3;
  INST.shaker(v, (s % 4 === 2 ? 0.15 : s % 2 ? 0.05 : 0.1) * h(), rng.next() * 0.8);
  if (s === 0 || s === 8) INST.kick(v, 0.42);
  if (s === 6 || s === 14) INST.kick(v, 0.15);
  if ((bar % 2 ? [4, 10] : [0, 6, 12]).includes(s)) INST.rim(v, 0.2 * h());
  const b = { 0: [0, 0.5, 5], 6: [7, 0.36, 2], 8: [7, 0.46, 5], 14: [0, 0.3, 2] }[s];
  if (b) INST.bass(v, chord.bass + b[0], b[1] * h(), b[2] * sd);
  if ((bar % 2 ? [2, 5, 8, 12] : [0, 3, 6, 10, 13]).includes(s)) {
    for (const m of chord.lo) INST.keys(v, m, 0.07 * h(), 2 * sd);
  }
  if (variant === 2 && bar < 8) {
    if (s % 2 === 0) INST.marimba(v, chord.lo[ARP[s / 2] % chord.lo.length] + 12, 0.24 * h());
    return;
  }
  const n = mel.at[s];
  if (!n) return;
  if (variant === 1) {
    INST.vibes(v, n.m, 0.34 * h(), n.d * sd);
    if (n.d >= 6) {
      INST.marimba(later(v, 3 * sd), chord.lo[1] + 12, 0.15);
      INST.marimba(later(v, 4 * sd), chord.lo[2] + 12, 0.15);
    }
  } else {
    INST.marimba(v, n.m, 0.42 * h());
    if (variant === 2) INST.marimba(v, harmonyBelow(n.m, tr.scale, chord), 0.22 * h());
  }
}

// Upbeat tropical: four-on-the-floor, claps, congas, tresillo bass, offbeat marimba
// stabs, steel-drum melody. Variation: 0 plain, 1 harmony in thirds, 2 breakdown + octave doubling.
function arrangeGame(p) {
  const { v, s, bar, pass, sd, chord, mel, tr, rng } = p;
  const h = () => humanize(rng);
  const variant = pass % 3;
  const drop = variant === 2 && bar < 2;
  if (!drop && s % 4 === 0) INST.kick(v, 0.55);
  if (s === 4 || s === 12) INST.clap(v, (drop ? 0.18 : 0.32) * h());
  INST.shaker(v, (s % 4 === 2 ? 0.2 : s % 2 ? 0.07 : 0.12) * h(), rng.next() * 0.8);
  const conga = { 3: 57, 7: 62, 10: 62, 11: 57, 14: 62 }[s];
  if (conga) INST.conga(v, conga, 0.2 * h());
  const b = { 0: 0, 3: 0, 6: 12, 8: 0, 11: 12, 14: 7 }[s];
  if (b !== undefined && !(drop && bar === 0)) INST.bass(v, chord.bass + b, (s % 8 === 0 ? 0.55 : 0.4) * h(), 1.6 * sd);
  if (s % 4 === 2) for (const m of chord.hi) INST.marimba(v, m, 0.075 * h());
  if ((bar === 7 || bar === 15) && s >= 12) INST.clap(v, 0.1 + (s - 12) * 0.05);
  if (variant === 2 && bar < 4) {
    if (s % 2 === 0) INST.steel(v, chord.hi[ARP[s / 2] % chord.hi.length] + 12, 0.2 * h());
    return;
  }
  const n = mel.at[s];
  if (!n) return;
  INST.steel(v, n.m, 0.42 * h());
  if (variant === 1) INST.marimba(v, harmonyBelow(n.m, tr.scale, chord), 0.2 * h());
  if (variant === 2) INST.marimba(v, n.m - 12, 0.24 * h());
}

const TRACK_DEFS = {
  menu: {
    bpm: 96, swing: 0, level: 0.62, scale: [5, 7, 9, 10, 0, 2, 4], arrange: arrangeMenu,
    chords: 'Fmaj7 Fmaj7 Gm7 C7 Am7 D7 Gm7 C7 Bbmaj7 Bbm6 Am7 D7 Gm7 C7 Fmaj7 C7',
    melody: [
      'A4/3 C5/3 E5/6 D5/2 C5/2', 'A4/8 r/2 G4/2 A4/4', 'Bb4/3 D5/3 F5/6 E5/2 D5/2', 'C5/8 r/2 Bb4/2 G4/4',
      'C5/3 E5/3 G5/6 E5/2 D5/2', 'F#5/6 E5/2 D5/4 C5/4', 'Bb4/4 D5/2 C5/2 Bb4/4 A4/2 G4/2', 'G4/8 r/4 A4/2 Bb4/2',
      'D5/3 F5/3 A5/8 G5/2', 'F5/6 Db5/2 Bb4/6 C5/2', 'E5/3 C5/3 A4/6 G4/2 A4/2', 'C5/3 D5/3 F#5/4 E5/2 D5/4',
      'D5/6 Bb4/2 F5/6 E5/2', 'E5/4 D5/2 C5/2 Bb4/4 G4/4', 'A4/10 r/2 C5/4', 'G4/6 r/2 E4/2 F4/2 G4/4',
    ],
  },
  game: {
    bpm: 124, swing: 0.12, level: 0.55, scale: [0, 2, 4, 5, 7, 9, 11], arrange: arrangeGame,
    chords: 'C G Am7 F C G F G Am7 F C G Am7 F Dm7 G7',
    melody: [
      'G5/3 E5/3 C5/2 D5/2 E5/4 r/2', 'D5/3 B4/3 G4/2 A4/2 B4/2 D5/4', 'C5/3 E5/3 A5/4 G5/2 E5/4', 'F5/3 E5/3 C5/2 A4/6 r/2',
      'G5/3 E5/3 C5/2 D5/2 E5/2 G5/2 A5/2', 'B5/4 G5/2 D5/2 G5/2 F5/2 D5/4', 'A5/3 F5/3 C5/2 F5/2 E5/2 D5/4', 'D5/2 B4/2 D5/2 G5/6 r/4',
      'E5/6 C5/2 A4/4 C5/2 E5/2', 'F5/6 E5/2 C5/4 A4/4', 'G5/6 E5/2 C5/2 D5/2 E5/4', 'D5/8 B4/2 D5/2 G5/4',
      'A5/3 G5/3 E5/2 C5/2 E5/2 A5/4', 'C6/3 A5/3 F5/2 A5/6 G5/2', 'F5/3 D5/3 C5/2 A4/2 C5/2 D5/4', 'B4/2 D5/2 F5/2 G5/2 B5/4 r/4',
    ],
  },
};

const TRACKS = {};
for (const [name, def] of Object.entries(TRACK_DEFS)) {
  TRACKS[name] = {
    name, bpm: def.bpm, swing: def.swing, level: def.level, scale: def.scale, arrange: def.arrange,
    chords: def.chords.split(/\s+/).map(parseChord),
    melody: def.melody.map(parseBar),
  };
  TRACKS[name].bars = TRACKS[name].chords.length;
}

// Test/debug helper: shape of a track (all bars must be 16 steps long).
export function trackInfo(name) {
  const tr = TRACKS[name];
  if (!tr) return null;
  return { bpm: tr.bpm, bars: tr.bars, melodyBars: tr.melody.length, barSteps: tr.melody.map((b) => b.steps) };
}

function playStep(inst, step, time) {
  const tr = inst.track;
  const s = step % 16;
  const barNo = Math.floor(step / 16);
  const bar = barNo % tr.bars;
  const sd = 60 / tr.bpm / 4;
  const t = time + (s % 2 ? tr.swing * sd : 0);
  tr.arrange({
    v: { ctx: inst.ctx, out: inst.out, t }, s, bar, pass: Math.floor(barNo / tr.bars), sd,
    chord: tr.chords[bar], mel: tr.melody[bar], tr, rng: inst.rng,
  });
}

// ------------------------------------------------------------------ mixer
// buses → master → compressor → soft clip (output can never exceed ~0.9) → destination
function softClipCurve() {
  const n = 2048;
  const curve = new Float32Array(n);
  const knee = 0.6;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const ax = Math.abs(x);
    const y = ax < knee ? ax : knee + 0.38 * Math.tanh((ax - knee) / 0.38);
    curve[i] = Math.sign(x) * y;
  }
  return curve;
}

function buildMixer(c, { clip = true } = {}) {
  const master = c.createGain();
  master.gain.value = MASTER_LEVEL;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 10;
  comp.ratio.value = 8;
  comp.attack.value = 0.003;
  comp.release.value = 0.25;
  const music = c.createGain();
  music.gain.value = MUSIC_LEVEL;
  const sfx = c.createGain();
  sfx.gain.value = SFX_LEVEL;
  music.connect(master);
  sfx.connect(master);
  master.connect(comp);
  let last = comp;
  if (clip) {
    const shaper = c.createWaveShaper();
    shaper.curve = softClipCurve();
    comp.connect(shaper);
    last = shaper;
  }
  last.connect(c.destination);
  return { master, comp, music, sfx, out: last };
}

// ------------------------------------------------------------------ runtime state
let ctx = null;
let mix = null;
let disposed = false;
let sfxEnabled = true;
let musicEnabled = true;
let userSuspended = false;
let hidden = false;
let requested = null;          // requested music track (kept while muted / locked)
let current = null;            // playing (non-fading) music instance
const instances = [];          // all music instances incl. fading ones
let pumpTimer = null;
let suspendTimer = null;       // pending freeze after a pause-menu suspend()
const loopWanted = new Set();
const loopsRunning = new Map();
const lastPlayed = new Map();
const starState = { last: -Infinity, step: 0 };
let tickAlt = false;
let analyser = null;
let sampleBuf = null;

function quiet() {
  return userSuspended || hidden;
}

function applySuspendState() {
  if (!ctx || ctx.state === 'closed') return;
  if (quiet()) {
    if (ctx.state === 'running') ctx.suspend().catch(() => {});
  } else if (ctx.state !== 'running') {
    ctx.resume().catch(() => {});
  }
}

function clearSuspendTimer() {
  if (suspendTimer !== null) clearTimeout(suspendTimer);
  suspendTimer = null;
}

// Player pause: suspending right away would freeze the tap's click before it is heard (it then
// plays stacked onto the next click) and cut music and loop tails mid-waveform. So fade the music,
// let the context run out what is already playing, then freeze. New sfx are blocked by quiet() meanwhile.
function softSuspend() {
  clearSuspendTimer();
  if (!ctx || ctx.state === 'closed') return;
  setBus(mix.music, 0, PAUSE_FADE);
  if (hidden || ctx.state !== 'running') {
    applySuspendState();
    return;
  }
  suspendTimer = setTimeout(() => {
    suspendTimer = null;
    applySuspendState(); // re-checks quiet(): a resume within the window keeps the context running
  }, SUSPEND_DELAY_MS);
}

function softResume() {
  clearSuspendTimer();
  if (!ctx || ctx.state === 'closed') return;
  applySuspendState();
  setBus(mix.music, MUSIC_LEVEL, UNPAUSE_FADE);
}

function playSilence() {
  try {
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    /* ignore – best effort for iOS */
  }
}

function createContext() {
  try {
    ctx = new AC({ latencyHint: 'interactive' });
  } catch {
    try {
      ctx = new AC();
    } catch {
      ctx = null;
      return false;
    }
  }
  mix = buildMixer(ctx);
  mix.sfx.gain.value = sfxEnabled ? SFX_LEVEL : 0;
  return true;
}

function setBus(bus, value, dur = 0.08) {
  if (!ctx) return;
  const t = ctx.currentTime;
  bus.gain.cancelScheduledValues(t);
  bus.gain.setValueAtTime(bus.gain.value, t);
  bus.gain.linearRampToValueAtTime(value, t + dur);
}

// ---- music scheduling
// music() usually runs right before a heavy synchronous screen render, so a first step fixed at
// call time would already be in the past when the scheduler next runs and play late and bunched.
// next = -1 anchors the first step to the first scheduler tick instead (the fade-in hides the delay).
function startInstance(name, fade) {
  const t = ctx.currentTime;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(TRACKS[name].level, t + fade);
  gain.connect(mix.music);
  const inst = {
    name, track: TRACKS[name], ctx, out: gain, gain, step: 0, next: -1, stopAt: null,
    rng: createRng(name === 'menu' ? 96 : 124),
  };
  instances.push(inst);
  ensurePump();
  return inst;
}

function fadeOutInstance(inst, fade) {
  const t = ctx.currentTime;
  inst.stopAt = t + fade;
  inst.gain.gain.cancelScheduledValues(t);
  inst.gain.gain.setValueAtTime(inst.gain.gain.value, t);
  inst.gain.gain.linearRampToValueAtTime(0, t + fade);
}

function ensurePump() {
  if (pumpTimer === null) pumpTimer = setInterval(pump, PUMP_MS);
}

function pump() {
  if (!ctx || ctx.state !== 'running') {
    if (!instances.length) stopPump();
    return;
  }
  const t = ctx.currentTime;
  for (let i = instances.length - 1; i >= 0; i--) {
    const inst = instances[i];
    const sd = 60 / inst.track.bpm / 4;
    if (inst.next < 0) inst.next = t + START_DELAY; // new track: first tick after the screen render
    // Main thread stalled: skip the steps already past instead of playing them late and bunched.
    // Advancing step keeps bar and arrangement on the grid.
    while (inst.next < t - LATE_OK) {
      inst.next += sd;
      inst.step++;
    }
    while (inst.next < t + LOOKAHEAD && (inst.stopAt === null || inst.next < inst.stopAt)) {
      playStep(inst, inst.step, inst.next);
      inst.next += sd;
      inst.step++;
    }
    if (inst.stopAt !== null && t > inst.stopAt + 0.1) {
      inst.gain.disconnect();
      instances.splice(i, 1);
    }
  }
  if (!instances.length) stopPump();
}

function stopPump() {
  if (pumpTimer !== null) clearInterval(pumpTimer);
  pumpTimer = null;
}

function syncMusic() {
  if (!ctx) return;
  const want = musicEnabled ? requested : null;
  if (current && current.name === want) return;
  if (current) fadeOutInstance(current, want ? CROSSFADE : FADE_OUT);
  current = want ? startInstance(want, current ? CROSSFADE : FADE_IN) : null;
}

// ---- loops
function syncLoops() {
  for (const id of LOOP_IDS) {
    const run = !!ctx && sfxEnabled && loopWanted.has(id);
    const handle = loopsRunning.get(id);
    if (run && !handle) loopsRunning.set(id, LOOPS[id](ctx, mix.sfx, ctx.currentTime + 0.01));
    if (!run && handle) {
      handle.stop(ctx ? ctx.currentTime : 0);
      loopsRunning.delete(id);
    }
  }
}

function onVisibility() {
  hidden = document.visibilityState === 'hidden';
  applySuspendState();
}

// ------------------------------------------------------------------ public API
export const audio = {
  unlock() {
    if (!AC || disposed) return false;
    if (!ctx) {
      if (!createContext()) return false;
      playSilence();
      syncMusic();
      syncLoops();
    }
    if (quiet()) {
      applySuspendState();
    } else if (ctx.state !== 'running') {
      playSilence();
      ctx.resume().catch(() => {});
    }
    return true;
  },

  sfx(name, opts) {
    if (!ctx || !sfxEnabled || quiet() || !SFX[name]) return false;
    const ms = now();
    if (ms - (lastPlayed.get(name) ?? -Infinity) < THROTTLE_MS) return false;
    lastPlayed.set(name, ms);
    const o = { ...opts };
    if (name === 'star') {
      starState.step = ms - starState.last < STAR_WINDOW_MS ? starState.step + 1 : 0;
      starState.last = ms;
      o.step = starState.step;
    }
    if (name === 'tick') {
      o.alt = tickAlt;
      tickAlt = !tickAlt;
    }
    try {
      SFX[name]({ ctx, out: mix.sfx, t: ctx.currentTime + 0.005 }, o);
    } catch {
      return false;
    }
    return true;
  },

  music(track) {
    if (track !== null && track !== undefined && !TRACKS[track]) return;
    const next = track || null;
    if (next === requested) return;
    requested = next;
    // A track change means the screen changed – a forgotten pause must not keep us silent.
    if (userSuspended) {
      userSuspended = false;
      softResume();
    }
    syncMusic();
  },

  loop(id, on) {
    if (!LOOPS[id]) return;
    if (on) loopWanted.add(id);
    else loopWanted.delete(id);
    syncLoops();
  },

  setSfx(on) {
    sfxEnabled = !!on;
    if (mix) setBus(mix.sfx, sfxEnabled ? SFX_LEVEL : 0);
    syncLoops();
  },

  setMusic(on) {
    musicEnabled = !!on;
    syncMusic();
  },

  sfxOn() {
    return sfxEnabled;
  },

  musicOn() {
    return musicEnabled;
  },

  // No early returns: leave() and destroy() call resume() unconditionally to get a running context.
  suspend() {
    userSuspended = true;
    softSuspend();
  },

  resume() {
    userSuspended = false;
    softResume();
  },

  // Debug / test helpers (not part of the gameplay contract).
  state() {
    return {
      supported: !!AC,
      unlocked: !!ctx,
      ctxState: ctx ? ctx.state : 'none',
      sfx: sfxEnabled,
      music: musicEnabled,
      requestedTrack: requested,
      track: current ? current.name : null,
      musicInstances: instances.length,
      loops: [...loopsRunning.keys()],
      suspended: userSuspended,
      hidden,
    };
  },

  // Current output level { rms, peak } (0 when locked).
  level() {
    if (!ctx) return { rms: 0, peak: 0 };
    if (!analyser) {
      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      sampleBuf = new Float32Array(analyser.fftSize);
      mix.out.connect(analyser);
    }
    analyser.getFloatTimeDomainData(sampleBuf);
    let peak = 0;
    let sum = 0;
    for (const x of sampleBuf) {
      peak = Math.max(peak, Math.abs(x));
      sum += x * x;
    }
    return { rms: Math.sqrt(sum / sampleBuf.length), peak };
  },

  // Stops everything and releases the AudioContext (used when a new copy of the module takes over).
  dispose() {
    disposed = true;
    clearSuspendTimer();
    stopPump();
    instances.length = 0;
    current = null;
    loopsRunning.clear();
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
    if (ctx && ctx.state !== 'closed') ctx.close().catch(() => {});
    ctx = null;
    mix = null;
  },
};

export default audio;

if (typeof document !== 'undefined') {
  hidden = document.visibilityState === 'hidden';
  document.addEventListener('visibilitychange', onVisibility);
}
if (hasWindow) {
  // A hot-reloaded copy of this module must not leave the old one playing.
  try {
    if (window.__acaiAudio && window.__acaiAudio !== audio) window.__acaiAudio.dispose();
  } catch {
    /* ignore */
  }
  window.__acaiAudio = audio;
}

// ------------------------------------------------------------------ offline rendering (tests)
// The compressor needs ~30 ms to settle after a context starts, so offline renders start later.
const WARMUP = 0.12;

function offlineCtx(seconds) {
  const OAC = typeof globalThis !== 'undefined' ? globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext : null;
  if (!OAC) return null;
  const sr = 44100;
  return new OAC(1, Math.ceil(sr * seconds), sr);
}

function bufferStats(buf) {
  let peak = 0;
  let sum = 0;
  let n = 0;
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) {
      const x = d[i];
      if (Math.abs(x) > peak) peak = Math.abs(x);
      sum += x * x;
    }
    n += d.length;
  }
  return { peak, rms: Math.sqrt(sum / Math.max(1, n)), clipped: peak >= 1 };
}

// Renders one sfx through the real mixer chain → { name, peak, rms, clipped }.
// opts: { step, alt, clip = true } (clip:false bypasses the safety soft clipper).
export async function renderSfxOffline(name, seconds = 2, opts = {}) {
  const c = offlineCtx(seconds);
  if (!c || !SFX[name]) return null;
  const m = buildMixer(c, { clip: opts.clip !== false });
  SFX[name]({ ctx: c, out: m.sfx, t: WARMUP }, { step: opts.step || 0, alt: !!opts.alt });
  return { name, ...bufferStats(await c.startRendering()) };
}

// Renders a music track (from bar `fromBar`) through the mixer chain.
export async function renderMusicOffline(track, seconds = 10, opts = {}) {
  const c = offlineCtx(seconds);
  const tr = TRACKS[track];
  if (!c || !tr) return null;
  const m = buildMixer(c, { clip: opts.clip !== false });
  const trim = c.createGain();
  trim.gain.value = tr.level;
  trim.connect(m.music);
  const inst = { ctx: c, out: trim, track: tr, rng: createRng(7) };
  const sd = 60 / tr.bpm / 4;
  let step = (opts.fromBar || 0) * 16;
  for (let t = WARMUP; t < seconds; t += sd) playStep(inst, step++, t);
  return { track, ...bufferStats(await c.startRendering()) };
}

// Renders a continuous loop for `seconds` (stopped 0.4 s before the end).
export async function renderLoopOffline(id, seconds = 2, opts = {}) {
  const c = offlineCtx(seconds);
  if (!c || !LOOPS[id]) return null;
  const m = buildMixer(c, { clip: opts.clip !== false });
  LOOPS[id](c, m.sfx, WARMUP).stop(Math.max(WARMUP + 0.05, seconds - 0.4));
  return { id, ...bufferStats(await c.startRendering()) };
}
