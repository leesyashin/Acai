// App shell: boots save, language, stage and audio, then routes between screens.
//   go(name, params) → 'title' | 'map' | 'shop' | 'settings' | 'game' | 'results'
// Every screen module exports render(container, params, ctx) → cleanup().

import { initStage } from './stage.js';
import { registerStrings, setLang, t, onLangChange } from './i18n.js';
import { loadSave, getSave } from './save.js';
import { audio } from './audio.js';
import { screens } from './screens.js';
import { gameScreen } from './game-view.js';

registerStrings({
  de: {
    'screen.rotateTitle': 'Bitte dreh dein Gerät',
    'screen.rotateText': 'Açaí Fever spielt sich am besten im Querformat.',
    'screen.rotatePlay': 'Trotzdem spielen',
    'screen.errorTitle': 'Ups, da ist etwas schiefgelaufen.',
    'screen.reload': 'Neu laden',
  },
  en: {
    'screen.rotateTitle': 'Please rotate your device',
    'screen.rotateText': 'Açaí Fever plays best in landscape.',
    'screen.rotatePlay': 'Play anyway',
    'screen.errorTitle': 'Oops, something went wrong.',
    'screen.reload': 'Reload',
  },
});

const SCREENS = { ...screens, game: gameScreen };
const MENU_SCREENS = new Set(['title', 'map', 'shop', 'settings', 'results']);
const ROTATE_KEY = 'acaiFever.rotateDismissed';

let stageEl = null;
let current = null; // { name, params, cleanup }
let started = false;

const musicFor = (name) => (MENU_SCREENS.has(name) ? 'menu' : null);

// ------------------------------------------------------------------ router
export function go(name, params = {}) {
  navigate(name, params ?? {}, false);
}

function navigate(name, params, rerender) {
  teardown();
  if (!SCREENS[name]) {
    console.error(`[router] unknown screen "${name}"`);
    if (name !== 'title') navigate('title', {}, false);
    return;
  }
  const container = document.createElement('div');
  container.className = `screen screen-${name}`;
  container.dataset.screen = name;
  stageEl.replaceChildren(container);
  current = { name, params, cleanup: null };
  const track = musicFor(name);
  if (track) audio.music(track);
  try {
    const cleanup = SCREENS[name].render(container, params, makeCtx(name, rerender));
    current.cleanup = typeof cleanup === 'function' ? cleanup : null;
  } catch (err) {
    console.error(`[router] screen "${name}" failed to render`, err);
    if (name !== 'title') navigate('title', {}, false);
    else showFatal();
  }
}

function makeCtx(name, rerender) {
  return { go, audio, t, screen: name, rerender };
}

function teardown() {
  const prev = current;
  current = null;
  if (!prev?.cleanup) return;
  try {
    prev.cleanup();
  } catch (err) {
    console.error(`[router] cleanup of "${prev.name}" failed`, err);
  }
}

function rerenderCurrent() {
  if (!current || current.name === 'game') return;
  navigate(current.name, current.params, true);
}

// Last resort when even the title screen cannot render.
function showFatal() {
  const box = document.createElement('div');
  box.className = 'screen screen-fatal';
  box.innerHTML = `<div class="fatal-card panel"><p></p><button class="btn pink" type="button"></button></div>`;
  box.querySelector('p').textContent = t('screen.errorTitle');
  const btn = box.querySelector('button');
  btn.textContent = t('screen.reload');
  btn.addEventListener('click', () => location.reload());
  stageEl.replaceChildren(box);
}

// ------------------------------------------------------------------ audio unlock
// Browsers only allow audio after a user gesture. unlock() is idempotent, so the
// listeners stay for the whole session (iOS may suspend the context again).
function onGesture() {
  audio.unlock();
  const track = musicFor(current?.name);
  if (track) audio.music(track);
}

// ------------------------------------------------------------------ rotate hint
function readDismissed() {
  try {
    return sessionStorage.getItem(ROTATE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    sessionStorage.setItem(ROTATE_KEY, '1');
  } catch {
    /* storage blocked – the flag lives in memory only */
  }
}

const PHONE_ICON = `<svg class="rotate-phone" viewBox="0 0 120 120" width="120" height="120" aria-hidden="true" focusable="false" stroke-linejoin="round" stroke-linecap="round">
  <path d="M22 58A40 40 0 0 1 58 20" fill="none" stroke="#ffb627" stroke-width="7"/>
  <path d="M50 10L62 20L50 30" fill="none" stroke="#ffb627" stroke-width="7"/>
  <g class="rotate-phone-body"><rect x="38" y="34" width="44" height="74" rx="10" fill="#fffaf0" stroke="#2a1236" stroke-width="5"/>
  <rect x="45" y="44" width="30" height="50" rx="4" fill="#18c2c9"/><circle cx="60" cy="101" r="3" fill="#2a1236"/></g>
</svg>`;

function initRotateHint() {
  const el = document.getElementById('rotate-hint');
  if (!el) return;
  let dismissed = readDismissed();
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'rotate-title');
  const draw = () => {
    el.innerHTML = `<div class="rotate-card">${PHONE_ICON}<h2 id="rotate-title" class="title-text"></h2><p></p>`
      + '<button class="btn pink" type="button" data-action="dismiss-rotate"></button></div>';
    el.querySelector('h2').textContent = t('screen.rotateTitle');
    el.querySelector('p').textContent = t('screen.rotateText');
    el.querySelector('button').textContent = t('screen.rotatePlay');
  };
  const update = () => {
    const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 820;
    el.hidden = dismissed || !portrait;
  };
  el.addEventListener('click', (e) => {
    if (!e.target.closest('[data-action="dismiss-rotate"]')) return;
    dismissed = true;
    writeDismissed();
    audio.sfx('click');
    update();
  });
  draw();
  update();
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', () => setTimeout(update, 120));
  onLangChange(draw);
}

// ------------------------------------------------------------------ boot
function start(data) {
  if (started) return;
  started = true;
  const save = loadSave(data?.save ?? window.claude?.hot?.data?.save);
  setLang(save.settings.lang);
  audio.setSfx(save.settings.sfx);
  audio.setMusic(save.settings.music);
  stageEl = initStage(document.getElementById('app'), document.getElementById('stage-wrap'), document.getElementById('stage'));
  document.addEventListener('pointerdown', onGesture, { capture: true });
  document.addEventListener('keydown', onGesture, { capture: true });
  onLangChange(rerenderCurrent);
  initRotateHint();
  window.__acaiGo = go;
  window.__acaiScreen = () => current?.name ?? null;
  go('title');
}

const hot = window.claude?.hot;
hot?.snapshot?.(() => ({ save: getSave() }));
if (hot?.ready) hot.ready(start);
else start(hot?.data ?? {});
