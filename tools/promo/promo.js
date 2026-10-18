// Page script of the promo film (tools/promo/promo.html): builds the film once the fonts are in,
// then either previews it with sound (scrubber, space = play/pause) or waits for tools/promo/render.mjs,
// which seeks it frame by frame through window.promo.

import { artDefsSVG } from '../../js/art.js';
import { setLang } from '../../js/i18n.js';
import { buildFilm } from './film.js';
import { renderScore, wavBytes } from './score.js';

const q = new URLSearchParams(location.search);
const lang = q.get('lang') === 'en' ? 'en' : 'de';
const rendering = q.has('render');
document.body.classList.toggle('render', rendering);
setLang(lang);
document.body.insertAdjacentHTML('afterbegin', artDefsSVG());

async function boot() {
  await Promise.all([
    document.fonts.load('100px "Lilita One"'),
    document.fonts.load('900 40px Nunito'),
    document.fonts.load('800 40px Nunito'),
  ]).catch(() => {});
  await document.fonts.ready;
  // render.mjs hands over a screenshot of the real game (data URL) before the page loads
  const shot = window.__promoShot || null;
  const frame = document.getElementById('frame');
  const film = buildFilm(frame, { lang, shot });
  await Promise.all([...frame.querySelectorAll('img')].map((img) => img.decode().catch(() => {})));
  let score = null;
  window.promo = {
    duration: film.duration,
    bpm: film.bpm,
    cues: film.cues,
    seek(t) {
      film.seek(t);
    },
    // the soundtrack as a base64 WAV (render.mjs muxes it into the video); { music: false } = effects only
    async wavBase64(opts = {}) {
      const buf = opts.music === false ? await renderScore(film, opts) : (score = score || (await renderScore(film)));
      const bytes = wavBytes(buf);
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(s);
    },
  };
  film.seek(Number(q.get('t')) || 0);
  if (!rendering) preview(film);
  window.__promoReady = true;
}

// ------------------------------------------------------------------ preview
function preview(film) {
  const frame = document.getElementById('frame');
  const play = document.getElementById('play');
  const scrub = document.getElementById('scrub');
  const time = document.getElementById('time');
  const langLink = document.getElementById('lang');
  langLink.textContent = lang === 'de' ? 'English' : 'Deutsch';
  langLink.href = `?lang=${lang === 'de' ? 'en' : 'de'}`;
  const fit = () => {
    const s = Math.min(innerWidth / 1080, (innerHeight - 52) / 1920);
    frame.style.transform = `translate(${((innerWidth - 1080 * s) / 2).toFixed(1)}px, 0) scale(${s.toFixed(4)})`;
  };
  addEventListener('resize', fit);
  fit();

  let t = Number(q.get('t')) || 0;
  let playing = false;
  let ctx = null;
  let buffer = null;
  let src = null;
  let startedAt = 0;
  let startT = 0;
  const show = () => {
    film.seek(t);
    scrub.value = String(t / film.duration);
    time.textContent = `${t.toFixed(2)} s`;
  };
  const stop = () => {
    playing = false;
    play.textContent = 'Play';
    if (src) src.stop();
    src = null;
  };
  const start = async () => {
    playing = true;
    play.textContent = 'Pause';
    if (t >= film.duration - 0.05) t = 0;
    try {
      ctx = ctx || new AudioContext();
      if (!buffer) {
        time.textContent = 'Ton wird berechnet …';
        buffer = await renderScore(film, { sampleRate: ctx.sampleRate });
      }
      await ctx.resume();
      src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start(0, t);
    } catch (err) {
      console.warn('[promo] no sound', err);
    }
    startedAt = ctx ? ctx.currentTime : performance.now() / 1000;
    startT = t;
    const tick = () => {
      if (!playing) return;
      const now = ctx ? ctx.currentTime : performance.now() / 1000;
      t = startT + (now - startedAt);
      if (t >= film.duration) {
        t = film.duration;
        show();
        stop();
        return;
      }
      show();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  play.addEventListener('click', () => (playing ? stop() : start()));
  scrub.addEventListener('input', () => {
    stop();
    t = Number(scrub.value) * film.duration;
    show();
  });
  addEventListener('keydown', (e) => {
    if (e.key === ' ') {
      e.preventDefault();
      if (playing) stop();
      else start();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      stop();
      t = Math.max(0, Math.min(film.duration, t + (e.key === 'ArrowRight' ? 1 : -1) / 30));
      show();
    }
  });
  show();
}

boot().catch((err) => {
  console.error('[promo] boot failed', err);
  window.__promoError = String(err && err.stack ? err.stack : err);
});
