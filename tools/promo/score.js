// Soundtrack of the promo film (tools/promo): the game's own music (124 BPM, its chords, melody
// and instruments from js/audio.js) arranged as a punchy ad cut, plus the game's sound effects and
// a few promo effects (whooshes, risers, impacts) at the cue times the film registered.
//   const buffer = await renderScore(film)    // stereo AudioBuffer, 48 kHz
//   const wav = wavBytes(buffer)              // 16-bit PCM WAV as Uint8Array

import { synthKit } from '../../js/audio.js';

const { tone, noise, chime, brass, mtof, INST, SFX, LOOPS, TRACKS, harmonyBelow } = synthKit;

const GAME = TRACKS.game;
const SCALE = GAME.scale;
const TAIL = 1.2;

// chord in the same voicing as the game's tracks: bass in E2–D#3, close voicings from G3 / C4
function chord(pc, ints) {
  const voice = (low) => ints.map((i) => low + ((((pc + i - low) % 12) + 12) % 12)).sort((a, b) => a - b);
  return { pcs: ints.map((i) => (pc + i) % 12), bass: 40 + ((pc - 4 + 12) % 12), lo: voice(55), hi: voice(60) };
}
const CH = {
  C: chord(0, [0, 4, 7]),
  G: chord(7, [0, 4, 7]),
  Am: chord(9, [0, 3, 7]),
  F: chord(5, [0, 4, 7]),
  E7: chord(4, [0, 4, 7, 10]),
  Dm7: chord(2, [0, 3, 7, 10]),
  G7: chord(7, [0, 4, 7, 10]),
  Cmaj: chord(0, [0, 4, 7, 11]),
};

// ------------------------------------------------------------------ extra instruments
const X = {
  sub(v, m, len, vel = 0.5) {
    tone(v, { f: mtof(m), a: 0.006, hold: len, peak: vel, decay: 0.12 });
  },
  hat(v, vel, open = false) {
    noise(v, { ft: 'highpass', f: 7500, q: 0.7, a: 0.001, peak: vel, decay: open ? 0.16 : 0.035 });
  },
  snare(v, vel) {
    noise(v, { ft: 'bandpass', f: 1900, q: 0.7, a: 0.001, peak: vel, decay: 0.14 });
    tone(v, { type: 'triangle', f: 230, f2: 170, slide: 0.05, a: 0.001, peak: vel * 0.6, decay: 0.08 });
  },
  crash(v, vel = 0.4, len = 1.6) {
    noise(v, { ft: 'highpass', f: 5200, q: 0.4, a: 0.002, peak: vel, decay: len });
    noise(v, { ft: 'bandpass', f: 3200, q: 0.6, a: 0.002, peak: vel * 0.4, decay: len * 0.5 });
  },
  // warm saw pad under the groove (ducked by the kick through the pump bus)
  pad(v, ch, len, vel = 0.02) {
    for (const m of ch.lo) {
      for (const detune of [-9, 9]) {
        tone(v, { type: 'sawtooth', f: mtof(m), detune, a: 0.06, hold: len, peak: vel, decay: 0.25, filter: { type: 'lowpass', f: 1500, q: 0.6 } });
      }
    }
  },
  stab(v, ch, len = 0.16, vel = 0.22) {
    for (const m of ch.hi) brass(v, { m, len, peak: vel });
    for (const m of ch.hi) INST.marimba(v, m + 12, vel * 0.5);
  },
  // the big hit of a new section
  impact(v, g = 1) {
    INST.kick(v, 0.9 * g);
    tone(v, { f: 92, f2: 31, slide: 0.9, a: 0.003, peak: 0.8 * g, decay: 1.3 });
    noise(v, { ft: 'lowpass', f: 900, f2: 120, slide: 0.5, a: 0.002, peak: 0.45 * g, decay: 0.6 });
    X.crash(v, 0.32 * g, 1.8);
  },
  thud(v, g = 1) {
    tone(v, { f: 140, f2: 46, slide: 0.16, a: 0.002, peak: 0.85 * g, decay: 0.3 });
    noise(v, { ft: 'lowpass', f: 700, a: 0.002, peak: 0.4 * g, decay: 0.12 });
    noise(v, { ft: 'bandpass', f: 2600, q: 1.2, a: 0.001, peak: 0.18 * g, decay: 0.03 });
  },
  whoosh(v, g = 1) {
    noise(v, { ft: 'bandpass', f: 350, f2: 3600, slide: 0.22, q: 1.4, a: 0.12, peak: 0.55 * g, decay: 0.12 });
    noise(v, { ft: 'highpass', f: 2500, f2: 7000, slide: 0.22, a: 0.14, peak: 0.12 * g, decay: 0.1 });
  },
  swish(v, g = 1) {
    noise(v, { ft: 'bandpass', f: 1800, f2: 6000, slide: 0.1, q: 2, a: 0.05, peak: 0.45 * g, decay: 0.07 });
  },
  pop(v, pitch = 0, g = 1) {
    const f = 520 * Math.pow(2, (SCALE[pitch % 7] + 12 * Math.floor(pitch / 7)) / 12);
    tone(v, { f, f2: f * 2.2, slide: 0.05, a: 0.002, peak: 0.6 * g, decay: 0.07 });
    tone(v, { type: 'triangle', f: f * 2, a: 0.001, peak: 0.12 * g, decay: 0.04 });
  },
  // a riser of `len` seconds that peaks on the next downbeat
  riser(v, len, g = 1) {
    noise(v, { ft: 'highpass', f: 400, f2: 9000, slide: len, q: 0.8, a: len, peak: 0.32 * g, decay: 0.05 });
    tone(v, { type: 'sawtooth', f: 110, f2: 880, slide: len, a: len, peak: 0.12 * g, decay: 0.05, filter: { type: 'lowpass', f: 600, f2: 6000, slide: len, q: 3 } });
    noise(v, { ft: 'bandpass', f: 600, f2: 4000, slide: len, q: 4, a: len * 0.9, peak: 0.15 * g, decay: 0.05 });
  },
  stamp(v, g = 1) {
    X.thud(v, g);
    INST.clap(v, 0.5 * g);
    X.crash(v, 0.18 * g, 0.7);
  },
  upgrade(v, pitch = 0, g = 1) {
    const base = 72 + [0, 2, 4, 7][pitch % 4];
    [0, 4, 7, 12].forEach((iv, i) => tone(v, { at: i * 0.035, type: 'square', f: mtof(base + iv), a: 0.002, hold: 0.03, peak: 0.12 * g, decay: 0.12, filter: { type: 'lowpass', f: 5000 } }));
    chime(v, { at: 0.14, f: mtof(base + 24), peak: 0.22 * g, decay: 0.9 });
    INST.kick(v, 0.7 * g);
    X.crash(v, 0.14 * g, 0.8);
  },
  confetti(v, g = 1) {
    noise(v, { ft: 'bandpass', f: 1600, q: 0.8, a: 0.001, peak: 0.6 * g, decay: 0.05 });
    tone(v, { f: 420, f2: 90, slide: 0.08, a: 0.001, peak: 0.4 * g, decay: 0.1 });
    [96, 100, 103, 108, 103, 100].forEach((m, i) => chime(v, { at: 0.06 + i * 0.045, f: mtof(m), peak: 0.07 * g, decay: 0.4 }));
    noise(v, { at: 0.05, ft: 'highpass', f: 8000, a: 0.05, peak: 0.12 * g, decay: 0.8 });
  },
};

// ------------------------------------------------------------------ music
// The film gives its music bar by bar (film.music): { style, g, chords, mel, harmony, fill, lead }.
// g: i takes chords and melody of bar i of the game's track; chords: ['Am', 'E7'] (one per half bar)
// and mel: i name them instead; lead: false leaves the melody out. Styles: hook (stabs on the beats),
// intro (half-time, soft), groove, drop (groove + brass hit), tension, end (the final chord).
function resolveBar(m) {
  let chords = null;
  if (m.chords) chords = m.chords.map((n) => CH[n]);
  else if (m.g !== undefined) chords = [GAME.chords[m.g], GAME.chords[m.g]];
  if (chords && chords.length === 1) chords = [chords[0], chords[0]];
  const mel = m.lead === false ? undefined : m.mel !== undefined ? m.mel : m.g;
  return { ...m, chords, mel: mel === undefined || mel === null ? null : GAME.melody[mel] };
}

function arrangeMusic(c, bus, beat, music) {
  const sd = beat / 4;
  const swing = 0.1;
  const bars = music.map(resolveBar);
  const { drums, bass, keys, lead, pump } = bus;
  const at = (out, t) => ({ ctx: c, out, t });
  bars.forEach((bar, bi) => {
    const t0 = bi * 4 * beat;
    for (let s = 0; s < 16; s++) {
      const t = t0 + s * sd + (s % 2 ? swing * sd : 0);
      const ch = bar.chords ? bar.chords[s < 8 ? 0 : 1] : null;
      if (bar.style === 'hook') {
        const hk = [CH.C, CH.G, CH.Am, CH.F][s >> 2];
        if (s % 4 === 0) {
          INST.kick(at(drums, t), 0.75);
          X.sub(at(bass, t), hk.bass, beat * 0.55, 0.5);
          INST.bass(at(bass, t), hk.bass + 12, 0.5, sd * 3);
          X.stab(at(keys, t), hk, 0.15, 0.2);
          INST.steel(at(lead, t), [79, 83, 81, 77][s >> 2], 0.38);
          pumpAt(pump, t, beat);
        }
        X.hat(at(drums, t), s % 2 ? 0.05 : 0.09);
        if (s >= 12) INST.clap(at(drums, t), 0.1 + (s - 12) * 0.06);
        continue;
      }
      if (bar.style === 'end') {
        if (s === 0) {
          X.impact(at(drums, t), 0.9);
          for (const m of CH.Cmaj.hi) INST.vibes(at(keys, t), m, 0.16, beat * 3);
          for (const m of CH.C.lo) INST.keys(at(keys, t), m, 0.1, beat * 3);
          X.sub(at(bass, t), 36, beat * 2.5, 0.55);
          INST.bass(at(bass, t), 48, 0.5, beat * 2);
        }
        if (s === 2 || s === 3 || s === 6) INST.conga(at(drums, t), s === 6 ? 62 : 57, 0.18);
        if (s < 8) INST.shaker(at(drums, t), s % 2 ? 0.05 : 0.09, (s * 0.13) % 0.8);
        continue;
      }
      const tension = bar.style === 'tension';
      const soft = bar.style === 'intro';
      // drums
      if (s % 4 === 0 && (!soft || s % 8 === 0)) {
        INST.kick(at(drums, t), bar.style === 'drop' && s === 0 ? 0.85 : 0.7);
        pumpAt(pump, t, beat);
      }
      if (!tension && !soft && (s === 4 || s === 12)) {
        INST.clap(at(drums, t), 0.36);
        X.snare(at(drums, t), 0.12);
      }
      INST.shaker(at(drums, t), s % 4 === 2 ? 0.2 : s % 2 ? 0.07 : 0.12, (s * 0.37) % 0.8);
      if (s % 4 === 2) X.hat(at(drums, t), tension ? 0.1 : 0.13, !tension);
      if (tension) X.hat(at(drums, t), s % 2 ? 0.06 : 0.1);
      const conga = { 3: 57, 7: 62, 10: 62, 11: 57, 14: 62 }[s];
      if (conga && !tension) INST.conga(at(drums, t), conga, 0.22);
      if (bar.fill && s >= 12) {
        INST.clap(at(drums, t), 0.1 + (s - 12) * 0.07);
        X.snare(at(drums, t), 0.06 + (s - 12) * 0.04);
      }
      if (tension && s >= 8) X.snare(at(drums, t), 0.05 + (s - 8) * 0.025);
      // bass
      if (tension) {
        if (s % 2 === 0) INST.bass(at(bass, t), ch.bass, 0.5, sd * 1.4);
        if (s % 4 === 0) X.sub(at(bass, t), ch.bass - 12, beat * 0.4, 0.4);
      } else {
        const bb = { 0: 0, 3: 0, 6: 12, 8: 0, 11: 12, 14: 7 }[s];
        if (bb !== undefined) INST.bass(at(bass, t), ch.bass + bb, s % 8 === 0 ? 0.6 : 0.45, 1.6 * sd);
        if (s % 8 === 0) X.sub(at(bass, t), ch.bass - 12 + (ch.bass < 45 ? 12 : 0), beat * 1.85, 0.3);
      }
      if (s === 0 || s === 8) X.pad(at(keys, t), ch, beat * 2 - 0.08, tension ? 0.07 : 0.06);
      // keys: offbeat marimba stabs, brass hits on the drop
      if (s % 4 === 2) for (const m of ch.hi) INST.marimba(at(keys, t), m, tension ? 0.1 : 0.09);
      if (bar.style === 'drop' && s === 0) X.stab(at(keys, t), ch, 0.3, 0.2);
      if (tension && s % 4 === 3) for (const m of ch.hi) INST.steel(at(keys, t), m + 12, 0.07);
      // lead: the game's melody on steel drum, thirds below in the second half
      const n = bar.mel && bar.mel.at[s];
      if (n) {
        INST.steel(at(lead, t), n.m, soft ? 0.34 : 0.44);
        if (bar.harmony) INST.marimba(at(lead, t), harmonyBelow(n.m, SCALE, ch), 0.22);
        INST.marimba(at(lead, t), n.m - 12, 0.14);
      }
    }
  });
}

// sidechain feel: the pads and lead duck on every kick
function pumpAt(gain, t, beat) {
  gain.gain.setValueAtTime(0.55, t);
  gain.gain.linearRampToValueAtTime(1, t + beat * 0.45);
}

// ------------------------------------------------------------------ mixer
function impulse(c, seconds = 1.8, decayK = 3.2) {
  const n = Math.round(c.sampleRate * seconds);
  const buf = c.createBuffer(2, n, c.sampleRate);
  let seed = 9871;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / n, decayK) * (i < 80 ? i / 80 : 1);
  }
  return buf;
}

function buildMix(c) {
  const master = c.createGain();
  master.gain.value = 0.85;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 8;
  comp.ratio.value = 6;
  comp.attack.value = 0.004;
  comp.release.value = 0.18;
  const limiter = c.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.08;
  master.connect(comp);
  comp.connect(limiter);
  limiter.connect(c.destination);

  const verb = c.createConvolver();
  verb.buffer = impulse(c);
  const verbOut = c.createGain();
  verbOut.gain.value = 0.22;
  verb.connect(verbOut);
  verbOut.connect(master);

  const bus = (gain, pan = 0, send = 0, dest = master) => {
    const g = c.createGain();
    g.gain.value = gain;
    const p = c.createStereoPanner();
    p.pan.value = pan;
    g.connect(p);
    p.connect(dest);
    if (send) {
      const s = c.createGain();
      s.gain.value = send;
      g.connect(s);
      s.connect(verb);
    }
    return g;
  };
  const pump = c.createGain();
  pump.connect(master);
  return {
    drums: bus(0.62, 0, 0.05),
    bass: bus(0.6, 0, 0),
    keys: bus(0.55, -0.22, 0.3, pump),
    lead: bus(0.5, 0.16, 0.35, pump),
    pump,
    sfx: bus(0.62, 0, 0.12),
    fx: bus(0.55, 0, 0.18),
    loop: bus(0.3, 0.1, 0.05),
  };
}

// ------------------------------------------------------------------ render
// music: false leaves the music out (only the effects – for a TikTok sound laid on top).
export async function renderScore(film, { sampleRate = 48000, music = true, effects = true } = {}) {
  const seconds = film.duration + TAIL;
  const c = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const mix = buildMix(c);
  if (music) arrangeMusic(c, mix, film.beat, film.music);
  for (const q of effects ? film.cues : []) {
    const t = Math.max(0, q.t);
    const g = q.gain ?? 1;
    if (q.kind === 'sfx') {
      const out = c.createGain();
      out.gain.value = g;
      out.connect(mix.sfx);
      if (SFX[q.name]) SFX[q.name]({ ctx: c, out, t }, { step: q.step || 0, alt: !!q.alt });
      continue;
    }
    const v = { ctx: c, out: mix.fx, t };
    if (q.name === 'riser') X.riser(v, q.len || 1, g);
    else if (q.name === 'pop' || q.name === 'upgrade') X[q.name](v, q.pitch || 0, g);
    else if (X[q.name]) X[q.name](v, g);
  }
  for (const l of effects ? film.loops : []) {
    const out = c.createGain();
    out.gain.value = l.gain ?? 1;
    out.connect(mix.loop);
    LOOPS[l.id](c, out, l.from).stop(Math.max(l.from + 0.05, l.to));
  }
  const buf = await c.startRendering();
  fadeOut(buf, 0.35);
  return buf;
}

function fadeOut(buf, seconds) {
  const n = Math.round(seconds * buf.sampleRate);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) d[d.length - 1 - i] *= i / n;
  }
}

// 16-bit PCM WAV of an AudioBuffer
export function wavBytes(buf) {
  const ch = buf.numberOfChannels;
  const n = buf.length;
  const bytes = new Uint8Array(44 + n * ch * 2);
  const dv = new DataView(bytes.buffer);
  const str = (o, s) => [...s].forEach((x, i) => dv.setUint8(o + i, x.charCodeAt(0)));
  str(0, 'RIFF');
  dv.setUint32(4, 36 + n * ch * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, ch, true);
  dv.setUint32(24, buf.sampleRate, true);
  dv.setUint32(28, buf.sampleRate * ch * 2, true);
  dv.setUint16(32, ch * 2, true);
  dv.setUint16(34, 16, true);
  str(36, 'data');
  dv.setUint32(40, n * ch * 2, true);
  const data = [...Array(ch)].map((_, i) => buf.getChannelData(i));
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < ch; k++) {
      const x = Math.max(-1, Math.min(1, data[k][i]));
      dv.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true);
      o += 2;
    }
  }
  return bytes;
}
