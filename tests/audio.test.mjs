// js/audio.js must import and no-op safely without a browser (no WebAudio in Node).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audio, SFX_NAMES, MUSIC_TRACKS, trackInfo } from '../js/audio.js';

test('audio: the 23 SFX names from DESIGN §4.5', () => {
  const want = ['click', 'pickup', 'drop', 'reject', 'blenderStart', 'blenderReady', 'overflow', 'ruined', 'smoothieReady',
    'pour', 'plop', 'coin', 'bell', 'angry', 'happy', 'trash', 'purchase', 'star', 'win', 'lose', 'closing', 'heart', 'tick'];
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
