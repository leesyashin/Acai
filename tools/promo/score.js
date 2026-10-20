// Soundtrack of the promo film (tools/promo): the game's own music (its chords, melody and instruments
// from js/audio.js – the 124 BPM game track, or the 96 BPM menu bossa when the film says track: 'menu')
// arranged as a punchy ad cut, plus the game's sound effects and a few promo effects (whooshes, risers,
// impacts, notification pings, a record scratch …) at the cue times the film registered.
//   const buffer = await renderScore(film)    // stereo AudioBuffer, 48 kHz
//   const wav = wavBytes(buffer)              // 16-bit PCM WAV as Uint8Array

import { synthKit } from '../../js/audio.js';

const { tone, noise, chime, brass, mtof, INST, SFX, LOOPS, TRACKS, harmonyBelow } = synthKit;

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
  Em: chord(4, [0, 3, 7]),
  Dm: chord(2, [0, 3, 7]),
  E: chord(4, [0, 4, 7]),
  Am7: chord(9, [0, 3, 7, 10]),
  Fmaj7: chord(5, [0, 4, 7, 11]),
  Gm7: chord(7, [0, 3, 7, 10]),
  C7: chord(0, [0, 4, 7, 10]),
  Bbmaj7: chord(10, [0, 4, 7, 11]),
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
    const f = 520 * Math.pow(2, (TRACKS.game.scale[pitch % 7] + 12 * Math.floor(pitch / 7)) / 12);
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
  // a soft glass ting on step `pitch` of the scale (C major from C6), for things landing one by one
  ting(v, pitch = 0, g = 1) {
    const m = 84 + TRACKS.game.scale[pitch % 7] + 12 * Math.floor(pitch / 7);
    INST.vibes(v, m - 12, 0.32 * g, 0.4);
    chime(v, { f: mtof(m), peak: 0.1 * g, decay: 0.9, partials: [[1, 1, 1], [2, 0.18, 0.5]] });
  },
  // the phone's notification sound: two bright notes
  ping(v, g = 1) {
    chime(v, { f: mtof(88), peak: 0.2 * g, decay: 0.5, partials: [[1, 1, 1], [2, 0.2, 0.5], [3, 0.06, 0.3]] });
    chime(v, { at: 0.09, f: mtof(93), peak: 0.22 * g, decay: 0.7, partials: [[1, 1, 1], [2, 0.2, 0.5], [3, 0.06, 0.3]] });
  },
  // the phone vibrating on the table
  buzz(v, g = 1, len = 0.32) {
    tone(v, { type: 'sawtooth', f: 62, a: 0.01, hold: len, peak: 0.3 * g, decay: 0.05, filter: { type: 'lowpass', f: 320, q: 2 }, am: { rate: 34, depth: 0.7 } });
    noise(v, { ft: 'bandpass', f: 180, q: 2, a: 0.01, hold: len, peak: 0.25 * g, decay: 0.05 });
  },
  // a record scratch (the music stops)
  scratch(v, g = 1) {
    noise(v, { ft: 'bandpass', f: 600, f2: 3200, slide: 0.09, q: 3, a: 0.004, hold: 0.06, peak: 0.6 * g, decay: 0.03 });
    noise(v, { at: 0.1, ft: 'bandpass', f: 2800, f2: 400, slide: 0.16, q: 3, a: 0.004, hold: 0.12, peak: 0.55 * g, decay: 0.06 });
    tone(v, { type: 'sawtooth', f: 180, f2: 520, slide: 0.09, a: 0.003, hold: 0.06, peak: 0.12 * g, decay: 0.03, filter: { type: 'bandpass', f: 900, q: 1.5 } });
    tone(v, { at: 0.1, type: 'sawtooth', f: 480, f2: 90, slide: 0.16, a: 0.003, hold: 0.12, peak: 0.12 * g, decay: 0.08, filter: { type: 'bandpass', f: 700, q: 1.5 } });
  },
  // crickets in the empty café: a few short high chirps
  cricket(v, g = 1) {
    for (let i = 0; i < 3; i++) {
      tone(v, { at: i * 0.075, f: 4300, a: 0.004, hold: 0.035, peak: 0.07 * g, decay: 0.02, am: { rate: 90, depth: 0.9 } });
    }
  },
  // a firework: the launch whistle, the bang and its crackle
  firework(v, g = 1) {
    tone(v, { f: 900, f2: 2400, slide: 0.35, a: 0.05, hold: 0.25, peak: 0.05 * g, decay: 0.05 });
    tone(v, { at: 0.4, f: 120, f2: 40, slide: 0.3, a: 0.002, peak: 0.6 * g, decay: 0.5 });
    noise(v, { at: 0.4, ft: 'lowpass', f: 2400, f2: 300, slide: 0.4, a: 0.002, peak: 0.45 * g, decay: 0.5 });
    for (let i = 0; i < 9; i++) noise(v, { at: 0.55 + i * 0.07 + (i % 3) * 0.013, ft: 'highpass', f: 5000, a: 0.001, peak: 0.12 * g, decay: 0.02 });
  },
  // the deep 808 boom under a big title
  boom(v, g = 1) {
    tone(v, { f: 70, f2: 36, slide: 0.5, a: 0.003, hold: 0.12, peak: 0.95 * g, decay: 0.9 });
    tone(v, { type: 'triangle', f: 140, f2: 72, slide: 0.3, a: 0.002, peak: 0.25 * g, decay: 0.4, filter: { type: 'lowpass', f: 900 } });
    noise(v, { ft: 'lowpass', f: 1800, f2: 200, slide: 0.2, a: 0.001, peak: 0.35 * g, decay: 0.12 });
  },
  // a bright two-note sparkle (something shiny appears)
  bling(v, g = 1) {
    chime(v, { f: mtof(96), peak: 0.16 * g, decay: 0.5, partials: [[1, 1, 1], [2, 0.3, 0.5], [3, 0.1, 0.3]] });
    chime(v, { at: 0.07, f: mtof(103), peak: 0.18 * g, decay: 0.8, partials: [[1, 1, 1], [2, 0.3, 0.5], [3, 0.1, 0.3]] });
    noise(v, { at: 0.06, ft: 'highpass', f: 9000, a: 0.01, peak: 0.08 * g, decay: 0.35 });
  },
  // a soft liquid pour (the satisfying cut)
  glug(v, g = 1, len = 1) {
    noise(v, { ft: 'bandpass', f: 520, f2: 900, slide: len, q: 4, a: 0.1, hold: len, peak: 0.18 * g, decay: 0.2, am: { rate: 11, depth: 0.5 } });
    noise(v, { ft: 'lowpass', f: 400, a: 0.1, hold: len, peak: 0.12 * g, decay: 0.2 });
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
// g: i takes chords and melody of bar i of the film's track (film.track: 'game' or 'menu'); chords:
// ['Am', 'E7'] (one per half bar) and mel: i name them instead; lead: false leaves the melody out.
// Styles: hook (stabs on the beats), intro (half-time, soft), groove, drop (groove + brass hit),
// tension, build (four on the floor with a snare roll, roll: 1 eighths, 2 sixteenths), lofi (soft
// boom-bap, keys and vibes, vinyl crackle), sad (a lonely, slightly out-of-tune piano), rest (silence)
// and end (the final chord: chord names it, default Cmaj; soft leaves out the big hit). until: the
// sixteenth the bar stops at (a hard cut in the music).
function resolveBar(m, tr) {
  let chords = null;
  if (m.chords) chords = m.chords.map((n) => CH[n]);
  else if (m.g !== undefined) chords = [tr.chords[m.g], tr.chords[m.g]];
  if (chords && chords.length === 1) chords = [chords[0], chords[0]];
  const mel = m.lead === false ? undefined : m.mel !== undefined ? m.mel : m.g;
  return { ...m, chords, mel: mel === undefined || mel === null ? null : tr.melody[mel] };
}

// the hiss and the odd click of an old record over one bar
function vinyl(v, len, seed, g = 1) {
  noise(v, { ft: 'highpass', f: 5200, a: 0.02, hold: len, peak: 0.018 * g, decay: 0.05 });
  noise(v, { ft: 'bandpass', f: 1200, q: 0.6, a: 0.02, hold: len, peak: 0.01 * g, decay: 0.05 });
  for (let i = 0; i < 7; i++) {
    const at = ((seed * 7 + i * 13) % 29) / 29 * len;
    noise(v, { at, ft: 'highpass', f: 2500, a: 0.0005, peak: (0.05 + ((seed + i) % 3) * 0.03) * g, decay: 0.006 });
  }
}

function arrangeMusic(c, bus, beat, music, tr) {
  const sd = beat / 4;
  const swing = 0.1;
  const bars = music.map((m) => resolveBar(m, tr));
  const { drums, bass, keys, lead, pump } = bus;
  const at = (out, t) => ({ ctx: c, out, t });
  bars.forEach((bar, bi) => {
    const t0 = bi * 4 * beat;
    if (bar.style === 'lofi' || bar.style === 'sad') vinyl(at(drums, t0), beat * 4, bi + 3, bar.style === 'sad' ? 1.4 : 1);
    for (let s = 0; s < 16; s++) {
      const t = t0 + s * sd + (s % 2 ? swing * sd : 0);
      const ch = bar.chords ? bar.chords[s < 8 ? 0 : 1] : null;
      if (bar.style === 'rest' || (bar.until !== undefined && s >= bar.until)) continue;
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
        const fin = CH[bar.chord || 'Cmaj'];
        if (s === 0) {
          if (bar.soft) INST.kick(at(drums, t), 0.4);
          else X.impact(at(drums, t), 0.9);
          for (const m of fin.hi) INST.vibes(at(keys, t), m, 0.16, beat * 3);
          for (const m of fin.lo) INST.keys(at(keys, t), m, 0.1, beat * 3);
          X.sub(at(bass, t), fin.bass - 12 >= 33 ? fin.bass - 12 : fin.bass, beat * 2.5, bar.soft ? 0.35 : 0.55);
          INST.bass(at(bass, t), fin.bass, 0.5, beat * 2);
        }
        if (s === 2 || s === 3 || s === 6) INST.conga(at(drums, t), s === 6 ? 62 : 57, 0.18);
        if (s < 8) INST.shaker(at(drums, t), s % 2 ? 0.05 : 0.09, (s * 0.13) % 0.8);
        continue;
      }
      if (bar.style === 'lofi') {
        if (s === 0 || s === 10) INST.kick(at(drums, t), s ? 0.42 : 0.55);
        if (s === 7) INST.kick(at(drums, t), 0.22);
        if (s === 4 || s === 12) {
          INST.rim(at(drums, t), 0.16);
          X.snare(at(drums, t), 0.07);
          INST.clap(at(drums, t), 0.08);
        }
        if (s % 2 === 0) X.hat(at(drums, t), s % 4 ? 0.035 : 0.055);
        INST.shaker(at(drums, t), s % 4 === 2 ? 0.06 : 0.025, (s * 0.37) % 0.8);
        if (s === 0) INST.bass(at(bass, t), ch.bass, 0.42, sd * 6);
        if (s === 8) INST.bass(at(bass, t), ch.bass, 0.32, sd * 3);
        if (s === 11) INST.bass(at(bass, t), ch.bass + 7, 0.26, sd * 3);
        if (s === 0 || s === 8) X.sub(at(bass, t), ch.bass - 12 + (ch.bass < 45 ? 12 : 0), beat * 1.6, 0.18);
        if (s === 0 || s === 6 || s === 10) for (const m of ch.lo) INST.keys(at(keys, t), m, s ? 0.05 : 0.07, sd * 4);
        const n = bar.mel && bar.mel.at[s];
        if (n) {
          INST.vibes(at(lead, t), n.m, 0.3, n.d * sd);
          INST.marimba(at(lead, t), n.m - 12, 0.1);
        }
        continue;
      }
      if (bar.style === 'sad') {
        // an old upright, a little out of tune
        if (s === 0 || s === 8) {
          for (const m of ch.lo) {
            tone(at(keys, t), { type: 'triangle', f: mtof(m), a: 0.012, hold: beat * 1.2, peak: 0.07, decay: 0.9, vib: { rate: 0.7, depth: mtof(m) * 0.006 } });
          }
          INST.bass(at(bass, t), ch.bass, 0.3, beat * 1.6);
        }
        if (s === 0) INST.kick(at(drums, t), 0.22);
        if (s === 12) INST.rim(at(drums, t), 0.08);
        const n = bar.mel && bar.mel.at[s];
        if (n) tone(at(lead, t), { type: 'triangle', f: mtof(n.m - 12), a: 0.01, hold: n.d * sd * 0.5, peak: 0.16, decay: 0.7, vib: { rate: 0.9, depth: mtof(n.m - 12) * 0.009 } });
        continue;
      }
      if (bar.style === 'build') {
        if (s % 4 === 0) {
          INST.kick(at(drums, t), 0.72);
          pumpAt(pump, t, beat);
        }
        const roll = bar.roll || 1;
        if (roll >= 2 || s % 2 === 0) X.snare(at(drums, t), 0.05 + (s / 15) * (roll >= 2 ? 0.2 : 0.12));
        X.hat(at(drums, t), s % 2 ? 0.05 : 0.08);
        if (s % 2 === 0) INST.bass(at(bass, t), ch.bass + (s % 8 === 4 ? 12 : 0), 0.42, sd * 1.5);
        if (s === 0 || s === 8) X.pad(at(keys, t), ch, beat * 2 - 0.08, 0.07);
        if (s % 4 === 2) for (const m of ch.hi) INST.marimba(at(keys, t), m, 0.08);
        const n = bar.mel && bar.mel.at[s];
        if (n) INST.steel(at(lead, t), n.m, 0.38);
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
        if (bar.harmony) INST.marimba(at(lead, t), harmonyBelow(n.m, tr.scale, ch), 0.22);
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
  if (music) arrangeMusic(c, mix, film.beat, film.music, TRACKS[film.track] || TRACKS.game);
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
    else if (q.name === 'pop' || q.name === 'upgrade' || q.name === 'ting') X[q.name](v, q.pitch || 0, g);
    else if (q.name === 'buzz' || q.name === 'glug') X[q.name](v, g, q.len);
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
