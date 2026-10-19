// Screen transitions and the loading screen – purely visual, the router (js/main.js) switches screens at once.
//   initCurtain(wrap)            once at boot; adds the leaving layer (a scaled copy of #stage's box) and #curtain
//   transition(oldEl, from, to)  plays the change from screen `from` (its old element) to `to`:
//                                 to or from the game: the açaí curtain closes over the old screen like an iris,
//                                 holds a beat with a bouncing bowl, then fades open on the new one;
//                                 between menus: the old screen fades out over the new one.
//   splash(steps)                boot: logo + loading bar over the first screen until every step (a promise) settled
//                                 (and at least SPLASH_MIN_MS passed), then the curtain opens. A tap, a key or a
//                                 change of screen opens it at once (the game never waits on it). Returns a promise.
// With reduced motion nothing animates: the old screen goes at once and the splash only waits for the steps.
// The curtain and the leaving layer never take the pointer (pointer-events: none) and are outside #stage, so
// everything that looks for the current screen (#stage > [data-screen]) sees only the new one.

import { registerStrings, t } from './i18n.js';
import { logoSVG, bowlSVG } from './art.js';
import { addStageLayer } from './stage.js';

registerStrings({
  de: { 'curtain.loading': 'Die Açaí wird gemixt …' },
  en: { 'curtain.loading': 'Blending the açaí …' },
});

const CLOSE_MS = 280;
const HOLD_MS = 120;
const OPEN_MS = 340;
const FADE_MS = 220;
const SPLASH_MIN_MS = 900;
const SPLASH_MAX_MS = 4000; // a font or a step that never settles must not keep the game hidden

let leavingLayer = null;
let curtain = null;
let timers = [];
let booting = false;
let skipSplash = null; // opens the loading screen at once (set while it shows)

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function later(fn, ms) {
  const id = setTimeout(() => {
    timers = timers.filter((x) => x !== id);
    fn();
  }, ms);
  timers.push(id);
}

export function initCurtain(wrap) {
  leavingLayer = document.createElement('div');
  leavingLayer.id = 'stage-leaving';
  leavingLayer.setAttribute('aria-hidden', 'true');
  leavingLayer.inert = true;
  wrap.append(leavingLayer);
  addStageLayer(leavingLayer);
  curtain = document.createElement('div');
  curtain.id = 'curtain';
  curtain.hidden = true;
  curtain.setAttribute('aria-hidden', 'true');
  document.body.append(curtain);
}

// Ends a running transition at once (a new navigation came in).
function finish() {
  for (const id of timers) clearTimeout(id);
  timers = [];
  leavingLayer?.replaceChildren();
  if (curtain && !booting) {
    curtain.hidden = true;
    curtain.className = '';
  }
}

export function transition(oldEl, from, to) {
  if (!leavingLayer || booting) {
    skipSplash?.(); // a screen opened under the loading screen: show it
    oldEl?.remove();
    return;
  }
  finish();
  if (!oldEl || reducedMotion()) {
    oldEl?.remove();
    return;
  }
  oldEl.removeAttribute('data-screen');
  leavingLayer.replaceChildren(oldEl);
  if (from === 'game' || to === 'game') {
    curtain.innerHTML = `<div class="curtain-sun"></div><div class="curtain-bowl">${bowlSVG({ base: 'acai', mid: ['banana', 'strawberry', 'blueberry'], top: ['coconut', 'honey'] }, 170)}</div>`;
    curtain.className = 'is-closing';
    curtain.hidden = false;
    later(() => {
      leavingLayer.replaceChildren();
      later(() => {
        curtain.className = 'is-opening';
        later(() => {
          curtain.hidden = true;
          curtain.className = '';
        }, OPEN_MS);
      }, HOLD_MS);
    }, CLOSE_MS);
  } else {
    oldEl.classList.add('is-leaving');
    later(() => leavingLayer.replaceChildren(), FADE_MS);
  }
}

const settle = (p) => Promise.resolve(p).then(() => undefined, () => undefined);

export function splash(steps = []) {
  if (!curtain) return Promise.resolve();
  booting = true;
  document.documentElement.classList.add('is-booting');
  curtain.innerHTML = `<div class="curtain-sun"></div><div class="splash">
      <div class="splash-logo">${logoSVG(560)}</div>
      <div class="splash-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>
      <p class="splash-text">${t('curtain.loading')}</p>
    </div>`;
  curtain.className = 'is-splash';
  curtain.hidden = false;
  curtain.removeAttribute('aria-hidden');
  const bar = curtain.querySelector('.splash-bar');
  const fill = bar.querySelector('i');
  const total = steps.length + 1; // + the minimum time
  let done = 0;
  const step = () => {
    done += 1;
    const pct = Math.round((done / total) * 100);
    fill.style.transform = `scaleX(${pct / 100})`;
    bar.setAttribute('aria-valuenow', String(pct));
  };
  const min = reducedMotion() ? 0 : SPLASH_MIN_MS;
  const all = Promise.all([...steps.map((s) => settle(s).then(step)), new Promise((r) => setTimeout(r, min)).then(step)]);
  const cap = new Promise((r) => setTimeout(r, SPLASH_MAX_MS));
  let skipped = false;
  const skip = new Promise((r) => {
    skipSplash = () => {
      skipped = true;
      r();
    };
  });
  const onInput = () => skipSplash?.();
  window.addEventListener('pointerdown', onInput, { capture: true });
  window.addEventListener('keydown', onInput, { capture: true });
  return Promise.race([all, cap, skip]).then(() => new Promise((resolve) => {
    skipSplash = null;
    window.removeEventListener('pointerdown', onInput, { capture: true });
    window.removeEventListener('keydown', onInput, { capture: true });
    const open = () => {
      booting = false;
      document.documentElement.classList.remove('is-booting');
      curtain.setAttribute('aria-hidden', 'true');
      if (reducedMotion()) {
        curtain.hidden = true;
        curtain.className = '';
        resolve();
        return;
      }
      curtain.className = 'is-splash is-opening';
      setTimeout(() => { // not later(): a navigation meanwhile must not cancel the resolve
        if (curtain.classList.contains('is-splash')) {
          curtain.hidden = true;
          curtain.className = '';
        }
        resolve();
      }, OPEN_MS);
    };
    // let the full bar show for a moment (not when the player is already on the move)
    if (reducedMotion() || skipped) open();
    else setTimeout(open, 180);
  }));
}
