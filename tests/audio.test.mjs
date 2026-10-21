// js/audio.js must import and no-op safely without a browser (no WebAudio in Node).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { audio, SFX_NAMES, MUSIC_TRACKS, trackInfo } from '../js/audio.js';

test('audio: the 24 SFX names from DESIGN §4.5 and the cup lift', () => {
  const want = ['click', 'pickup', 'drop', 'reject', 'blenderStart', 'blenderReady', 'overflow', 'ruined', 'matchaReady',
    'pour', 'plop', 'coin', 'bell', 'angry', 'happy', 'trash', 'purchase', 'star', 'win', 'lose', 'closing', 'heart', 'tick', 'cup', 'lift'];
  assert.deepEqual([...SFX_NAMES].sort(), want.sort());
});

test('audio: every music bar has 16 steps', () => {
  assert.deepEqual([...MUSIC_TRACKS].sort(), ['game', 'menu']);
  for (const name of MUSIC_TRACKS) {
    const info = trackInfo(name);
    assert.ok(info.bpm > 0, `${name} bpm`);
    assert.equal(info.melodyBars, info.bars, `${name} melody covers every bar`);
    assert.ok(info.barSteps.every((n) => n === 16), `${name}: ${info.barSteps}`);
  }
  assert.equal(trackInfo('nope'), null);
});

test('audio: calls are safe no-ops without WebAudio', () => {
  assert.equal(audio.unlock(), false);
  assert.equal(audio.sfx('click'), false);
  assert.doesNotThrow(() => {
    audio.music('menu');
    audio.loop('blender', true);
    audio.loop('blender', false);
    audio.setSfx(false);
    audio.setMusic(false);
    audio.suspend();
    audio.resume();
    audio.music(null);
  });
  assert.equal(audio.sfxOn(), false);
  assert.equal(audio.musicOn(), false);
});

// ------------------------------------------------------------------ fake WebAudio
// A virtual clock drives the timers, performance.now() and the context's currentTime (which, like
// a real AudioContext, advances only while 'running'). clock.stall(ms) is a long main-thread task:
// time passes but no timer fires. Every started source is recorded with its start/stop time.

function fakeEnv() {
  const clock = { now: 0, seq: 0, timers: new Map() };
  const add = (fn, ms, every) => {
    const id = ++clock.seq;
    clock.timers.set(id, { fn, at: clock.now + Math.max(0, ms || 0), every });
    return id;
  };
  clock.api = {
    setTimeout: (fn, ms) => add(fn, ms, 0),
    setInterval: (fn, ms) => add(fn, ms, Math.max(1, ms || 0)),
    clearTimeout: (id) => clock.timers.delete(id),
    clearInterval: (id) => clock.timers.delete(id),
  };
  clock.tick = (ms) => {
    const end = clock.now + ms;
    for (;;) {
      let next = null;
      for (const [id, tm] of clock.timers) if (tm.at <= end && (!next || tm.at < next[1].at)) next = [id, tm];
      if (!next) break;
      const [id, tm] = next;
      clock.now = Math.max(clock.now, tm.at);
      if (tm.every) tm.at = clock.now + tm.every;
      else clock.timers.delete(id);
      tm.fn();
    }
    clock.now = end;
  };
  clock.stall = (ms) => {
    clock.now += ms;
  };

  const contexts = [];
  const sources = [];
  class Param {
    constructor(v) {
      this.value = v;
      this.events = [];
    }
    setValueAtTime(v, t) { this.events.push({ type: 'set', v, t }); return this; }
    linearRampToValueAtTime(v, t) { this.events.push({ type: 'ramp', v, t }); return this; }
    exponentialRampToValueAtTime(v, t) { this.events.push({ type: 'exp', v, t }); return this; }
    setTargetAtTime(v, t) { this.events.push({ type: 'target', v, t }); return this; }
    cancelScheduledValues(t) { this.events.push({ type: 'cancel', t }); return this; }
    lastRamp() { return this.events.filter((e) => e.type === 'ramp').at(-1) || null; }
  }
  class Node {
    constructor() {
      this.outs = [];
    }
    connect(n) {
      this.outs.push(n);
      return n;
    }
    disconnect() {}
  }
  const params = (n, names) => {
    for (const k of names) n[k] = new Param(1);
    return n;
  };
  class FakeAudioContext {
    constructor() {
      this.state = 'running';
      this.sampleRate = 44100;
      this.destination = new Node();
      this.base = 0;
      this.since = clock.now;
      this.gains = [];
      contexts.push(this);
    }
    get currentTime() {
      return this.state === 'running' ? this.base + (clock.now - this.since) / 1000 : this.base;
    }
    suspend() {
      if (this.state === 'running') {
        this.base = this.currentTime;
        this.state = 'suspended';
      }
      return Promise.resolve();
    }
    resume() {
      if (this.state === 'suspended') {
        this.since = clock.now;
        this.state = 'running';
      }
      return Promise.resolve();
    }
    close() {
      this.base = this.currentTime;
      this.state = 'closed';
      return Promise.resolve();
    }
    source(n) {
      const rec = { node: n, when: 0, stop: Infinity, calledAt: 0 };
      n.start = (when = 0) => {
        Object.assign(rec, { when, calledAt: this.currentTime });
        if (n.buffer && !n.loop) rec.stop = Math.max(when, rec.calledAt) + n.buffer.length / this.sampleRate;
        sources.push(rec);
      };
      n.stop = (t = 0) => {
        rec.stop = t;
      };
      return n;
    }
    createGain() {
      const g = params(new Node(), ['gain']);
      this.gains.push(g);
      return g;
    }
    createOscillator() { return this.source(params(new Node(), ['frequency', 'detune'])); }
    createBufferSource() { return this.source(new Node()); }
    createBiquadFilter() { return params(new Node(), ['frequency', 'Q']); }
    createDynamicsCompressor() { return params(new Node(), ['threshold', 'knee', 'ratio', 'attack', 'release']); }
    createWaveShaper() { return new Node(); }
    createBuffer(ch, len) {
      const d = new Float32Array(len);
      return { numberOfChannels: ch, length: len, getChannelData: () => d };
    }
  }

  const listeners = new Set();
  const document = {
    visibilityState: 'visible',
    addEventListener: (type, fn) => type === 'visibilitychange' && listeners.add(fn),
    removeEventListener: (type, fn) => listeners.delete(fn),
  };
  const setVisibility = (state) => {
    document.visibilityState = state;
    for (const fn of [...listeners]) fn();
  };
  // The node a source's signal reaches `bus` through (a music instance's gain), or null.
  const inputOf = (rec, bus) => {
    const seen = new Set();
    const walk = (n) => {
      if (!n?.outs || seen.has(n)) return null;
      seen.add(n);
      if (n.outs.includes(bus)) return n;
      for (const o of n.outs) {
        const hit = walk(o);
        if (hit) return hit;
      }
      return null;
    };
    return walk(rec.node);
  };
  return { clock, contexts, sources, FakeAudioContext, document, setVisibility, inputOf };
}

describe('audio with a fake AudioContext', () => {
  const saved = {};
  const globalsToSwap = ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'];
  before(() => {
    for (const k of ['window', 'document', 'performance', ...globalsToSwap]) {
      saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
    }
  });
  after(() => {
    for (const [k, d] of Object.entries(saved)) {
      if (d) Object.defineProperty(globalThis, k, d);
      else delete globalThis[k];
    }
  });

  // Loads a fresh copy of js/audio.js bound to a new fake environment, then runs `body`
  // synchronously with the virtual timers installed (nothing async can interleave).
  async function withFakeAudio(tag, body) {
    const env = fakeEnv();
    const define = (k, value) => Object.defineProperty(globalThis, k, { value, configurable: true, writable: true });
    define('window', { AudioContext: env.FakeAudioContext });
    define('document', env.document);
    const mod = await import(new URL(`../js/audio.js?fake=${tag}`, import.meta.url));
    const a = mod.audio;
    for (const k of globalsToSwap) define(k, env.clock.api[k]);
    define('performance', { now: () => env.clock.now });
    try {
      assert.equal(a.unlock(), true);
      env.clock.tick(200);
      env.ctx = env.contexts[0];
      env.musicBus = env.ctx.gains[1];
      assert.equal(env.musicBus.gain.value, 0.16, 'gains[1] is the music bus (buildMixer order)');
      body(a, env);
    } finally {
      a.dispose();
      for (const k of [...globalsToSwap, 'performance']) Object.defineProperty(globalThis, k, saved[k]);
    }
  }

  const sourcesSince = (env, n) => env.sources.slice(n);

  test('audio: the pause tap\'s click and the blender tail finish before the context freezes', () =>
    withFakeAudio('pause-click', (a, env) => {
      const { ctx, clock } = env;
      a.loop('blender', true);
      clock.tick(1000);
      const before = env.sources.length;
      // game-view: pause button → sfx('click'), then pause() → loop off, suspend()
      assert.equal(a.sfx('click'), true);
      a.loop('blender', false);
      a.suspend();
      assert.equal(ctx.state, 'running', 'no hard cut on the pause tap');
      assert.equal(a.sfx('coin'), false, 'new effects are blocked while pausing');
      clock.tick(360);
      assert.equal(ctx.state, 'running', 'still running while the click and the loop tail play');
      clock.tick(640);
      assert.equal(ctx.state, 'suspended', 'frozen once they are over');
      const frozenAt = ctx.currentTime;
      const pending = env.sources.filter((s) => s.stop > frozenAt);
      assert.deepEqual(pending, [], 'nothing stays queued across the freeze');
      assert.ok(sourcesSince(env, before).length > 0, 'the click was scheduled');

      clock.tick(5000); // paused – the audio clock stands still
      assert.equal(ctx.currentTime, frozenAt);
      a.resume();
      assert.equal(ctx.state, 'running');
      const resumeFrom = env.sources.length;
      assert.equal(a.sfx('click'), true, 'the resume click plays');
      const click = sourcesSince(env, resumeFrom);
      assert.ok(click.length > 0 && click.every((s) => s.when >= frozenAt), 'resume click starts after the freeze');
    }));

  test('audio: pausing fades the music out and resuming fades it back in', () =>
    withFakeAudio('pause-music', (a, env) => {
      const { ctx, clock, musicBus } = env;
      a.music('game');
      clock.tick(2000);
      a.suspend();
      const out = musicBus.gain.lastRamp();
      assert.equal(out.v, 0, 'music bus fades to silence');
      assert.ok(out.t - ctx.currentTime > 0.03 && out.t - ctx.currentTime <= 0.2, `short fade, not a cut (${out.t - ctx.currentTime})`);
      clock.tick(1000);
      assert.equal(ctx.state, 'suspended');
      musicBus.gain.value = 0; // what the real param reads after the fade
      a.resume();
      assert.equal(ctx.state, 'running');
      const back = musicBus.gain.lastRamp();
      assert.equal(back.v, 0.16, 'music bus back to its level');
      assert.ok(back.t > ctx.currentTime, 'faded in, not switched on');
      const sfxBus = ctx.gains[2];
      assert.equal(sfxBus.gain.lastRamp(), null, 'the sfx bus is never ramped by pause/resume');
    }));

  test('audio: a resume within the pause window never freezes the context', () =>
    withFakeAudio('quick-resume', (a, env) => {
      const { ctx, clock, musicBus } = env;
      a.music('menu');
      clock.tick(1000);
      a.suspend();
      clock.tick(150);
      a.resume();
      clock.tick(3000);
      assert.equal(ctx.state, 'running');
      assert.equal(musicBus.gain.lastRamp().v, 0.16);
      // and again, ending suspended: the newest suspend() owns the timer
      a.suspend();
      clock.tick(100);
      a.resume();
      a.suspend();
      clock.tick(350);
      assert.equal(ctx.state, 'running', 'the second suspend() restarted the delay');
      clock.tick(100);
      assert.equal(ctx.state, 'suspended');
    }));

  test('audio: a hidden tab still suspends at once; showing it keeps a pause suspended', () =>
    withFakeAudio('hidden', (a, env) => {
      const { ctx, clock } = env;
      a.music('menu');
      clock.tick(500);
      env.setVisibility('hidden');
      assert.equal(ctx.state, 'suspended', 'hidden → immediate');
      a.suspend(); // game-view pauses on the same event
      assert.equal(ctx.state, 'suspended');
      env.setVisibility('visible');
      clock.tick(1000);
      assert.equal(ctx.state, 'suspended', 'still paused after the tab is back');
      a.resume();
      assert.equal(ctx.state, 'running');
      // pause first, hide inside the window: freeze at once, the late timer is harmless
      a.suspend();
      env.setVisibility('hidden');
      assert.equal(ctx.state, 'suspended');
      env.setVisibility('visible');
      clock.tick(1000);
      assert.equal(ctx.state, 'suspended');
      a.resume();
      assert.equal(ctx.state, 'running');
    }));

  test('audio: a new track after a forgotten pause un-pauses (and cancels the pending freeze)', () =>
    withFakeAudio('forgotten', (a, env) => {
      const { ctx, clock, musicBus } = env;
      a.music('game');
      clock.tick(500);
      a.suspend();
      clock.tick(100);
      a.music('menu'); // e.g. navigate() from a paused game
      clock.tick(2000);
      assert.equal(ctx.state, 'running');
      assert.equal(a.state().suspended, false);
      assert.equal(musicBus.gain.lastRamp().v, 0.16);
    }));

  test('audio: a new track starts after the screen render, not in the past', () =>
    withFakeAudio('late-start', (a, env) => {
      const { ctx, clock, musicBus } = env;
      // title → map → game → results: every change crossfades while the next screen renders
      for (const [track, stallMs] of [['menu', 170], ['game', 160], ['menu', 300]]) {
        const from = env.sources.length;
        const calledAt = ctx.currentTime;
        a.music(track);
        const inst = ctx.gains.at(-1); // startInstance() creates the track's gain last
        assert.ok(inst.outs.includes(musicBus));
        clock.stall(stallMs); // navigate(): music() and then the synchronous render
        clock.tick(1500);
        const notes = sourcesSince(env, from);
        const fresh = notes.filter((s) => env.inputOf(s, musicBus) === inst);
        assert.ok(fresh.length > 0, `${track} plays`);
        const late = fresh.filter((s) => s.when < s.calledAt - 1e-9);
        assert.deepEqual(late.map((s) => +(s.calledAt - s.when).toFixed(3)), [], `${track}: no new-track note in the past`);
        const first = Math.min(...fresh.map((s) => s.when));
        assert.ok(first >= calledAt + stallMs / 1000, `${track}: first step after the render (${first - calledAt})`);
        const lateOld = notes.filter((s) => s.when < s.calledAt - 0.02 - 1e-9);
        assert.deepEqual(lateOld.map((s) => +(s.calledAt - s.when).toFixed(3)), [], 'the fading track plays nothing bunched');
      }
    }));

  test('audio: a main-thread stall skips the missed steps and stays on the beat grid', () =>
    withFakeAudio('stall', (a, env) => {
      const { ctx, clock } = env;
      const first = env.sources.length;
      a.music('menu'); // 96 bpm, no swing: every note starts exactly on a 16th step
      clock.tick(2000);
      const sd = 60 / 96 / 4;
      const t0 = Math.min(...sourcesSince(env, first).map((s) => s.when));
      for (const stallMs of [90, 400, 2500]) {
        const from = env.sources.length;
        clock.stall(stallMs);
        clock.tick(1000);
        const notes = sourcesSince(env, from);
        assert.ok(notes.length > 0);
        const late = notes.filter((s) => s.when < s.calledAt - 0.02 - 1e-9);
        assert.deepEqual(late.map((s) => +(s.calledAt - s.when).toFixed(3)), [], `${stallMs} ms stall: nothing played bunched`);
      }
      const offGrid = sourcesSince(env, first).filter((s) => {
        const k = (s.when - t0) / sd;
        return Math.abs(k - Math.round(k)) > 1e-6;
      });
      assert.equal(offGrid.length, 0, 'every step stays on the original grid');
      assert.equal(ctx.state, 'running');
    }));
});
