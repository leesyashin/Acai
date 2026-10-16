// Menu screens: title, level map (+ pre-level modal), shop, settings and results.
// Each screen: render(container, params, ctx) → cleanup(). ctx = { go, audio, rerender? }.
// All markup is built from strings; user-visible text goes through t().

import { registerStrings, t, getLang, setLang } from './i18n.js';
import {
  LAYERS, LEVELS, UPGRADES, UPG, ENDLESS_UNLOCK_LEVEL, SMOOTHIE_LEVEL,
  getLevel, ingName, ingredientValue, ingredientsByLayer, qualityUpgradeCost, nextUpgradeCost, getKitchenStats,
} from './data.js';
import {
  getSave, onSaveChange, isOwned, levelStars, isLevelUnlocked, isEndlessUnlocked, totalStars,
  upgradeLevel, ingLevel, upgradeLocked, buyIngredient, upgradeIngredient, buyUpgrade, setSetting, resetSave,
} from './save.js';
import {
  logoSVG, bowlSVG, ingredientIcon, packIcon, cupSVG, customerSVG, blenderSVG, smoothieMachineSVG, decorSVG,
  coinSVG, starSVG, heartSVG, clockSVG, lockSVG, mapBackgroundSVG,
  SMOOTHIE_SLOT_X, SMOOTHIE_SLOT_Y, SMOOTHIE_CUP_SIZE,
} from './art.js';

registerStrings({
  de: {
    'screen.play': 'Spielen',
    'screen.endless': 'Endlos',
    'screen.endlessLocked': 'Gewinne Level {n}',
    'screen.endlessLockedToast': 'Gewinne Level {n}, um den Endlos-Modus freizuschalten.',
    'screen.endlessBest': 'Rekord: {n}',
    'screen.shop': 'Shop',
    'screen.settings': 'Einstellungen',
    'screen.back': 'Zurück',
    'screen.close': 'Schließen',
    'screen.coinsAria': '{n} Münzen',
    'screen.starsAria': '{n} von {max} Sternen',
    'screen.soundOn': 'Ton ist an – ausschalten',
    'screen.soundOff': 'Ton ist aus – einschalten',
    'screen.language': 'Sprache',
    'screen.order': 'Eine Açaí-Bowl, bitte!',
    'screen.tagline': 'Mixen, belegen, servieren – bevor die Geduld ausgeht!',
    'map.title': 'Level-Karte',
    'map.level': 'Level {n}',
    'map.levelAria': 'Level {n}, {stars} von 3 Sternen',
    'map.levelLockedAria': 'Level {n}, gesperrt',
    'map.locked': 'Schaff erst Level {n}!',
    'map.goals': 'Ziele',
    'map.goalReached': 'Erreicht',
    'map.seats': '{n} Plätze',
    'map.hearts': '{n} Herzen',
    'map.smoothies': 'Smoothies',
    'map.time': 'Zeit',
    'map.start': 'Los geht’s!',
    'map.shopHint': 'Du hast {n} Münzen – im Shop wartet etwas Neues!',
    'map.toShop': 'Zum Shop',
    'map.new': 'Neu',
    'intro.basics.title': 'So geht’s',
    'intro.basics.text': 'Zieh die Açaí-Packung in den Mixer. Ist die Basis fertig, zieh den Mixer auf eine Bowl, leg die bestellten Zutaten darauf und bring die Bowl zum Kunden.',
    'intro.overflow.title': 'Achtung, Mixer!',
    'intro.overflow.text': 'Ab jetzt wartet ein fertiger Mixer nicht ewig: Bleibt er zu lange stehen, läuft er über und die Basis verdirbt. Verdorbenes kommt in den Müll.',
    'intro.moreSeats.title': 'Mehr Gäste',
    'intro.moreSeats.text': 'Dein Laden hat jetzt 3 Plätze. Behalte die Geduld aller Kunden im Blick!',
    'intro.smoothie.title': 'Smoothies!',
    'intro.smoothie.text': 'Neu: die Smoothie-Maschine! Zieh eine Frucht hinein, warte kurz und gib den fertigen Becher dem Kunden.',
    'intro.endless.title': 'Endlos-Modus',
    'intro.endless.text': 'Alle 30 Sekunden wird es schwerer. Spiel, bis alle Herzen weg sind, und knack deinen Rekord!',
    'intro.fourSeats.title': 'Volles Haus',
    'intro.fourSeats.text': 'Jetzt gibt es 4 Plätze. Mehr Bowl-Plätze und ein zweiter Mixer aus dem Shop helfen dir!',
    'shop.title': 'Shop',
    'shop.tab.ingredients': 'Zutaten',
    'shop.tab.kitchen': 'Küche',
    'shop.tab.decor': 'Deko',
    'shop.perUse': 'pro Portion',
    'shop.owned': 'Gekauft',
    'shop.max': 'Max',
    'shop.qualityAria': 'Qualität {n} von 2',
    'shop.buyAria': '{name} kaufen für {n} Münzen',
    'shop.upgradeAria': 'Qualität von {name} verbessern für {n} Münzen',
    'shop.noMoney': 'Nicht genug Münzen!',
    'shop.boughtIng': 'Neu im Laden: {name}!',
    'shop.boughtUpg': '{name} gekauft!',
    'shop.upgraded': 'Bessere Qualität: {name}!',
    'shop.maxed': 'Schon voll ausgebaut.',
    'shop.locked': 'Ab Level {n}',
    'shop.lockedToast': 'Wird ab Level {n} freigeschaltet.',
    'shop.tipTitle': 'Tipp',
    'shop.tipText': 'Neue Zutaten tauchen sofort in Bestellungen auf und bringen mehr Münzen.',
    'shop.tipQuality': 'Qualität ★: +30 % und +60 % Münzen pro Portion.',
    'shop.smoothie': 'Auch als Smoothie',
    'shop.levelOf': 'Stufe {a} von {b}',
    'shop.stat.blendTime': 'Mixzeit',
    'shop.stat.portions': 'Bowls pro Mix',
    'shop.stat.blenders': 'Mixer',
    'shop.stat.bowlSlots': 'Bowl-Plätze',
    'shop.stat.smoothieSlots': 'Smoothie-Plätze',
    'shop.stat.patience': 'Kundengeduld',
    'shop.seconds': '{n} s',
    'shop.percent': '+{n} %',
    'shop.kitchenNow': 'Deine Küche',
    'shop.decorNow': 'Deko macht Kunden geduldiger',
    'settings.title': 'Einstellungen',
    'settings.language': 'Sprache',
    'settings.music': 'Musik',
    'settings.sfx': 'Soundeffekte',
    'settings.on': 'An',
    'settings.off': 'Aus',
    'settings.stats': 'Statistik',
    'settings.statPlayed': 'Gespielte Runden',
    'settings.statServed': 'Bediente Kunden',
    'settings.statEarned': 'Verdiente Münzen',
    'settings.statStars': 'Sterne',
    'settings.statBest': 'Endlos-Rekord',
    'settings.campaign': 'Kampagne',
    'settings.levelsWon': '{n} von {max} Level',
    'settings.reset': 'Fortschritt löschen',
    'settings.resetConfirm': 'Wirklich alles löschen? Münzen, Sterne und Einkäufe gehen verloren.',
    'settings.resetYes': 'Ja, löschen',
    'settings.resetNo': 'Abbrechen',
    'settings.resetDone': 'Fortschritt gelöscht.',
    'settings.about': 'Über das Spiel',
    'settings.aboutText': 'Açaí Fever ist ein Zeitmanagement-Spiel rund um Açaí-Bowls. Alle Bilder und Klänge entstehen direkt im Browser.',
    'results.won': 'Level {n} geschafft!',
    'results.lost': 'Level {n} verloren',
    'results.endless': 'Spiel vorbei!',
    'results.reasonHearts': 'Keine Herzen mehr – zu viele Kunden sind gegangen.',
    'results.reasonGoal': 'Ziel verfehlt: Du brauchst mindestens {n} Münzen.',
    'results.nextStar': 'Nächster Stern ab {n} Münzen.',
    'results.perfect': 'Perfekt – alle drei Sterne!',
    'results.stage': 'Stufe {n} erreicht',
    'results.earned': 'Verdient',
    'results.served': 'Bedient',
    'results.walkedOut': 'Gegangen',
    'results.best': 'Rekord',
    'results.newBest': 'Neuer Rekord!',
    'results.newStars': 'Neue Bestleistung!',
    'results.unlockedLevel': 'Level {n} freigeschaltet!',
    'results.unlockedEndless': 'Endlos-Modus freigeschaltet!',
    'results.allDone': 'Alle 20 Level geschafft!',
    'results.keepCoins': 'Deine Münzen behältst du trotzdem.',
    'results.total': 'Kontostand',
    'results.next': 'Weiter',
    'results.retry': 'Nochmal',
    'results.map': 'Karte',
    'results.title': 'Menü',
    'results.shop': 'Shop',
    'results.starsAria': '{n} von 3 Sternen',
    'results.meterAria': '{n} Münzen verdient, Ziel {goal}',
  },
  en: {
    'screen.play': 'Play',
    'screen.endless': 'Endless',
    'screen.endlessLocked': 'Win level {n}',
    'screen.endlessLockedToast': 'Win level {n} to unlock endless mode.',
    'screen.endlessBest': 'Best: {n}',
    'screen.shop': 'Shop',
    'screen.settings': 'Settings',
    'screen.back': 'Back',
    'screen.close': 'Close',
    'screen.coinsAria': '{n} coins',
    'screen.starsAria': '{n} of {max} stars',
    'screen.soundOn': 'Sound is on – turn off',
    'screen.soundOff': 'Sound is off – turn on',
    'screen.language': 'Language',
    'screen.order': 'One açaí bowl, please!',
    'screen.tagline': 'Blend, top, serve – before patience runs out!',
    'map.title': 'Level map',
    'map.level': 'Level {n}',
    'map.levelAria': 'Level {n}, {stars} of 3 stars',
    'map.levelLockedAria': 'Level {n}, locked',
    'map.locked': 'Win level {n} first!',
    'map.goals': 'Goals',
    'map.goalReached': 'Reached',
    'map.seats': '{n} seats',
    'map.hearts': '{n} hearts',
    'map.smoothies': 'Smoothies',
    'map.time': 'Time',
    'map.start': 'Let’s go!',
    'map.shopHint': 'You have {n} coins – something new is waiting in the shop!',
    'map.toShop': 'To the shop',
    'map.new': 'New',
    'intro.basics.title': 'How to play',
    'intro.basics.text': 'Drag the açaí pack into the blender. When the base is ready, drag the blender onto a bowl, add the ordered ingredients and hand the bowl to the customer.',
    'intro.overflow.title': 'Watch the blender!',
    'intro.overflow.text': 'From now on a ready blender won’t wait forever: leave it too long and it overflows and the base spoils. Spoiled stuff goes in the trash.',
    'intro.moreSeats.title': 'More guests',
    'intro.moreSeats.text': 'Your shop now has 3 seats. Keep an eye on everyone’s patience!',
    'intro.smoothie.title': 'Smoothies!',
    'intro.smoothie.text': 'New: the smoothie machine! Drag a fruit into it, wait a moment and hand the cup to the customer.',
    'intro.endless.title': 'Endless mode',
    'intro.endless.text': 'It gets harder every 30 seconds. Play until your hearts run out and beat your best score!',
    'intro.fourSeats.title': 'Full house',
    'intro.fourSeats.text': 'Now there are 4 seats. More bowl spots and a second blender from the shop will help!',
    'shop.title': 'Shop',
    'shop.tab.ingredients': 'Ingredients',
    'shop.tab.kitchen': 'Kitchen',
    'shop.tab.decor': 'Decor',
    'shop.perUse': 'per serving',
    'shop.owned': 'Owned',
    'shop.max': 'Max',
    'shop.qualityAria': 'Quality {n} of 2',
    'shop.buyAria': 'Buy {name} for {n} coins',
    'shop.upgradeAria': 'Improve the quality of {name} for {n} coins',
    'shop.noMoney': 'Not enough coins!',
    'shop.boughtIng': 'New in your shop: {name}!',
    'shop.boughtUpg': '{name} bought!',
    'shop.upgraded': 'Better quality: {name}!',
    'shop.maxed': 'Already fully upgraded.',
    'shop.locked': 'From level {n}',
    'shop.lockedToast': 'Unlocks at level {n}.',
    'shop.tipTitle': 'Tip',
    'shop.tipText': 'New ingredients show up in orders right away and earn more coins.',
    'shop.tipQuality': 'Quality ★: +30% and +60% coins per serving.',
    'shop.smoothie': 'Also as a smoothie',
    'shop.levelOf': 'Level {a} of {b}',
    'shop.stat.blendTime': 'Blend time',
    'shop.stat.portions': 'Bowls per batch',
    'shop.stat.blenders': 'Blenders',
    'shop.stat.bowlSlots': 'Bowl spots',
    'shop.stat.smoothieSlots': 'Smoothie spots',
    'shop.stat.patience': 'Customer patience',
    'shop.seconds': '{n} s',
    'shop.percent': '+{n}%',
    'shop.kitchenNow': 'Your kitchen',
    'shop.decorNow': 'Decor makes customers more patient',
    'settings.title': 'Settings',
    'settings.language': 'Language',
    'settings.music': 'Music',
    'settings.sfx': 'Sound effects',
    'settings.on': 'On',
    'settings.off': 'Off',
    'settings.stats': 'Statistics',
    'settings.statPlayed': 'Rounds played',
    'settings.statServed': 'Customers served',
    'settings.statEarned': 'Coins earned',
    'settings.statStars': 'Stars',
    'settings.statBest': 'Endless best',
    'settings.campaign': 'Campaign',
    'settings.levelsWon': '{n} of {max} levels',
    'settings.reset': 'Delete progress',
    'settings.resetConfirm': 'Really delete everything? Coins, stars and purchases will be lost.',
    'settings.resetYes': 'Yes, delete',
    'settings.resetNo': 'Cancel',
    'settings.resetDone': 'Progress deleted.',
    'settings.about': 'About',
    'settings.aboutText': 'Açaí Fever is a time-management game all about açaí bowls. Every picture and sound is created right in your browser.',
    'results.won': 'Level {n} complete!',
    'results.lost': 'Level {n} failed',
    'results.endless': 'Game over!',
    'results.reasonHearts': 'Out of hearts – too many customers walked out.',
    'results.reasonGoal': 'Goal missed: you need at least {n} coins.',
    'results.nextStar': 'Next star at {n} coins.',
    'results.perfect': 'Perfect – all three stars!',
    'results.stage': 'Reached stage {n}',
    'results.earned': 'Earned',
    'results.served': 'Served',
    'results.walkedOut': 'Walked out',
    'results.best': 'Best',
    'results.newBest': 'New best!',
    'results.newStars': 'New personal best!',
    'results.unlockedLevel': 'Level {n} unlocked!',
    'results.unlockedEndless': 'Endless mode unlocked!',
    'results.allDone': 'All 20 levels complete!',
    'results.keepCoins': 'You keep your coins anyway.',
    'results.total': 'Balance',
    'results.next': 'Next',
    'results.retry': 'Retry',
    'results.map': 'Map',
    'results.title': 'Menu',
    'results.shop': 'Shop',
    'results.starsAria': '{n} of 3 stars',
    'results.meterAria': '{n} coins earned, goal {goal}',
  },
});

// =====================================================================
// Small helpers
// =====================================================================
const STAGE_W = 1280;
const STAGE_H = 800;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const formatters = new Map();
function numFmt(n, maxFrac = 1) {
  const key = `${getLang()}|${maxFrac}`;
  if (!formatters.has(key)) {
    formatters.set(key, new Intl.NumberFormat(getLang() === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: maxFrac }));
  }
  return formatters.get(key).format(n);
}
// Wallet amounts are shown floored so "can I afford it?" always matches the number on screen.
const coinsText = (n) => numFmt(Math.floor((Number(n) || 0) + 1e-6), 0);
const timeText = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
const repeat = (n, fn) => Array.from({ length: Math.max(0, n) }, (_, i) => fn(i)).join('');

function sfx(ctx, name) {
  try {
    ctx?.audio?.sfx?.(name);
  } catch {
    /* audio is optional */
  }
}

// Collects timers, frames and listeners of one screen so cleanup is a single call.
function createScope() {
  const timers = new Set();
  const frames = new Set();
  const offs = [];
  return {
    timeout(fn, ms) {
      const id = setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
      return id;
    },
    frame(fn) {
      const id = requestAnimationFrame((now) => {
        frames.delete(id);
        fn(now);
      });
      frames.add(id);
      return id;
    },
    listen(target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      offs.push(() => target.removeEventListener(type, fn, opts));
    },
    add(off) {
      offs.push(off);
    },
    dispose() {
      timers.forEach(clearTimeout);
      frames.forEach(cancelAnimationFrame);
      timers.clear();
      frames.clear();
      offs.splice(0).forEach((off) => off());
    },
  };
}

// Position of an element's top centre relative to the screen container, in stage px.
function anchorPoint(container, el) {
  const cr = container.getBoundingClientRect();
  const s = cr.width / (container.offsetWidth || STAGE_W) || 1;
  const r = el.getBoundingClientRect();
  return { x: (r.left + r.width / 2 - cr.left) / s, y: (r.top - cr.top) / s, bottom: (r.bottom - cr.top) / s };
}

function showToast(container, scope, text, { kind = 'bad', anchor = null } = {}) {
  container.querySelectorAll('.sc-toast').forEach((n) => n.remove());
  const el = document.createElement('div');
  el.className = `toast sc-toast ${kind}`;
  el.setAttribute('role', 'status');
  el.textContent = text;
  container.append(el);
  let x = STAGE_W / 2;
  let y = 120;
  if (anchor) {
    const p = anchorPoint(container, anchor);
    x = p.x;
    y = p.y - 14;
    if (y < 70) y = p.bottom + 70;
  }
  const half = el.offsetWidth / 2;
  el.style.left = `${Math.round(Math.min(STAGE_W - 12 - half, Math.max(12 + half, x)))}px`;
  el.style.top = `${Math.round(Math.max(60, Math.min(STAGE_H - 20, y)))}px`;
  scope.timeout(() => el.remove(), 1900);
}

function restartClass(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

const shake = (el) => restartClass(el, 'sc-shake');

// =====================================================================
// Icons that art.js does not provide (same ink-outline cartoon style)
// =====================================================================
const INK = '#2a1236';
const svg48 = (body, size, cls = '') => `<svg class="sc-icon ${cls}" viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true" focusable="false" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;
// Outlined stroke: thick ink line with a coloured line on top.
const duo = (d, color = '#fff', w = 5) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 6}"/><path d="${d}" fill="none" stroke="${color}" stroke-width="${w}"/>`;

function gearPath() {
  const pts = [];
  const teeth = 8;
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i / (teeth * 2)) * Math.PI * 2;
    const a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2;
    const r = i % 2 ? 15.5 : 21;
    for (const a of [a0 + 0.06, a1 - 0.06]) pts.push(`${(24 + Math.cos(a) * r).toFixed(1)} ${(24 + Math.sin(a) * r).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
}
const GEAR = gearPath();

const ICON = {
  back: (s = 36) => svg48('<path d="M5 24L22 8V17H42V31H22V40Z" fill="#fff" stroke="#2a1236" stroke-width="3.5"/>', s),
  next: (s = 36) => svg48('<path d="M43 24L26 8V17H6V31H26V40Z" fill="#fff" stroke="#2a1236" stroke-width="3.5"/>', s),
  close: (s = 30) => svg48(duo('M13 13L35 35M35 13L13 35', '#fff', 6), s),
  play: (s = 40) => svg48('<path d="M14 7L41 24L14 41Z" fill="#fff" stroke="#2a1236" stroke-width="3.5"/>', s),
  check: (s = 26) => svg48(duo('M11 25L20 34L37 14', '#fff', 6), s),
  gear: (s = 40) => svg48(`<path d="${GEAR}" fill="#fff" stroke="#2a1236" stroke-width="3.2"/><circle cx="24" cy="24" r="7" fill="#18c2c9" stroke="#2a1236" stroke-width="3.2"/>`, s),
  soundOn: (s = 40) => svg48('<path d="M6 18H14L25 8V40L14 30H6Z" fill="#fff" stroke="#2a1236" stroke-width="3.2"/>' + duo('M31 17Q36 24 31 31', '#18c2c9', 4) + duo('M36 11Q45 24 36 37', '#18c2c9', 4), s),
  soundOff: (s = 40) => svg48('<path d="M6 18H14L25 8V40L14 30H6Z" fill="#ddd3e4" stroke="#2a1236" stroke-width="3.2"/>' + duo('M31 18L43 30M43 18L31 30', '#ff4d4d', 4), s),
  note: (s = 36) => svg48('<path d="M18 34V10L40 6V30" fill="none" stroke="#2a1236" stroke-width="4"/><ellipse cx="13" cy="35" rx="7" ry="5.5" fill="#ff3d8b" stroke="#2a1236" stroke-width="3"/><ellipse cx="35" cy="31" rx="7" ry="5.5" fill="#ff3d8b" stroke="#2a1236" stroke-width="3"/>', s),
  shop: (s = 40) => svg48('<path d="M9 22H39V41H9Z" fill="#fff4df" stroke="#2a1236" stroke-width="3.2"/><path d="M20 41V30H28V41" fill="#18c2c9" stroke="#2a1236" stroke-width="3"/>'
    + '<path d="M5 10H43L45 20Q41 26 37 20Q33 26 29 20Q25 26 21 20Q17 26 13 20Q9 26 3 20Z" fill="#ff3d8b" stroke="#2a1236" stroke-width="3.2"/><path d="M17 10L15.5 21M29 10L30.5 21" stroke="#fff" stroke-width="3"/>', s),
  endless: (s = 40) => svg48(duo('M24 24C19 15 8 15 8 24C8 33 19 33 24 24C29 15 40 15 40 24C40 33 29 33 24 24Z', '#ffd23f', 5), s),
  retry: (s = 36) => svg48(duo('M36 30A13 13 0 1 1 33 15', '#fff', 5) + '<path d="M27 6L39 12L30 21Z" fill="#fff" stroke="#2a1236" stroke-width="3"/>', s),
  map: (s = 36) => svg48('<path d="M5 11L17 7L31 12L43 8V37L31 41L17 36L5 40Z" fill="#fff4df" stroke="#2a1236" stroke-width="3.2"/><path d="M17 7V36M31 12V41" stroke="#2a1236" stroke-width="3"/><path d="M9 30Q16 20 24 26T39 17" fill="none" stroke="#ff3d8b" stroke-width="3" stroke-dasharray="1 5"/>', s),
  home: (s = 36) => svg48('<path d="M5 23L24 7L43 23H38V41H10V23Z" fill="#fff" stroke="#2a1236" stroke-width="3.2"/><path d="M20 41V29H28V41" fill="#ffb627" stroke="#2a1236" stroke-width="3"/>', s),
  trash: (s = 32) => svg48('<path d="M10 14H38L35 42H13Z" fill="#fff" stroke="#2a1236" stroke-width="3.2"/><path d="M7 12H41M19 12V7H29V12" fill="none" stroke="#2a1236" stroke-width="3.2"/>', s),
  bolt: (s = 40) => svg48('<path d="M28 3L9 27H22L18 45L39 19H26Z" fill="#ffd23f" stroke="#2a1236" stroke-width="3.2"/>', s),
  globe: (s = 34) => svg48('<circle cx="24" cy="24" r="18" fill="#18c2c9" stroke="#2a1236" stroke-width="3.2"/><path d="M6 24H42M24 6C14 16 14 32 24 42C34 32 34 16 24 6Z" fill="none" stroke="#2a1236" stroke-width="3"/>', s),
};

// =====================================================================
// Shared pieces
// =====================================================================
function coinsPill() {
  const c = getSave().coins;
  return `<div class="coins-pill sc-coins" data-coins="${Math.floor(c)}" role="img" aria-label="${esc(t('screen.coinsAria', { n: coinsText(c) }))}">${coinSVG(38)}<span class="sc-coins-value">${coinsText(c)}</span></div>`;
}

function starsPill() {
  const max = LEVELS.length * 3;
  const n = totalStars();
  return `<div class="coins-pill sc-stars" role="img" aria-label="${esc(t('screen.starsAria', { n, max }))}">${starSVG(true, 36)}<span>${n}<small>/${max}</small></span></div>`;
}

// Keeps every coins pill on the screen in sync with the save (animated count).
function bindCoins(container, scope) {
  scope.add(onSaveChange((d) => {
    container.querySelectorAll('[data-coins]').forEach((pill) => animateCoins(pill, d.coins, scope));
  }));
}

function animateCoins(pill, to, scope) {
  const from = Number(pill.dataset.coins) || 0;
  const target = Math.floor(to + 1e-6);
  if (from === target) return;
  pill.dataset.coins = String(target);
  pill.setAttribute('aria-label', t('screen.coinsAria', { n: coinsText(target) }));
  const valueEl = pill.querySelector('.sc-coins-value');
  const diff = target - from;
  const floater = document.createElement('span');
  floater.className = `sc-coins-delta ${diff < 0 ? 'neg' : 'pos'}`;
  floater.textContent = `${diff < 0 ? '−' : '+'}${coinsText(Math.abs(diff))}`;
  pill.append(floater);
  scope.timeout(() => floater.remove(), 1100);
  restartClass(pill, 'is-bump');
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / 600);
    const e = 1 - (1 - k) ** 3;
    valueEl.textContent = coinsText(from + diff * e);
    if (k < 1) scope.frame(step);
  };
  scope.frame(step);
}

function header({ title, right = '', backLabel = t('screen.back') }) {
  return `<header class="sc-header">
    <button class="btn icon cream sc-back" type="button" data-action="back" aria-label="${esc(backLabel)}">${ICON.back(38)}</button>
    <h1 class="sc-title title-text">${esc(title)}</h1>
    <div class="sc-header-right">${right}</div>
  </header>`;
}

function langSwitch(cls = '') {
  const lang = getLang();
  return `<div class="sc-seg ${cls}" role="group" aria-label="${esc(t('screen.language'))}">${['de', 'en'].map((l) =>
    `<button class="sc-seg-btn ${l === lang ? 'is-on' : ''}" type="button" data-lang="${l}" aria-pressed="${l === lang}" lang="${l}">${l.toUpperCase()}</button>`).join('')}</div>`;
}

function changeLang(lang) {
  if (lang === getLang()) return;
  setSetting('lang', lang);
  setLang(lang);
}

// One click handler per screen: dispatches on data-action / data-* of the clicked button.
function onAction(container, scope, ctx, handlers) {
  scope.listen(container, 'click', (e) => {
    const btn = e.target.closest('button, [data-action]');
    if (!btn || !container.contains(btn)) return;
    const action = btn.dataset.action || Object.keys(handlers).find((k) => k.startsWith('data-') && btn.hasAttribute(k));
    const fn = handlers[action];
    if (fn) fn(btn, e);
  });
}

// Escape works like the back button on menu screens (dialogs handle Escape themselves).
function escapeToBack(container, scope, isBlocked = () => false) {
  scope.listen(document, 'keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented || isBlocked() || !container.isConnected) return;
    if (container.querySelector('.overlay')) return;
    container.querySelector('[data-action="back"]')?.click();
  });
}

// Small star burst when something was bought.
function burst(container, scope, el) {
  const p = anchorPoint(container, el);
  const box = document.createElement('div');
  box.className = 'sc-burst';
  box.style.left = `${Math.round(p.x)}px`;
  box.style.top = `${Math.round((p.y + p.bottom) / 2)}px`;
  box.innerHTML = repeat(8, (i) => `<span style="--a:${i * 45 + 22}deg">${starSVG(true, 26)}</span>`);
  container.append(box);
  scope.timeout(() => box.remove(), 900);
}

// =====================================================================
// Title
// =====================================================================
const FLOATERS = [
  { id: 'strawberry', x: 64, y: 132, s: 76, r: -14 },
  { id: 'blueberry', x: 252, y: 236, s: 60, r: 10 },
  { id: 'kiwi', x: 70, y: 318, s: 70, r: 12 },
  { id: 'banana', x: 1110, y: 128, s: 84, r: 18 },
  { id: 'mango', x: 1010, y: 252, s: 64, r: -10 },
  { id: 'coconut', x: 1176, y: 300, s: 66, r: -6 },
  { id: 'mint', x: 300, y: 120, s: 50, r: 20 },
  { id: 'honey', x: 932, y: 132, s: 52, r: -14 },
];

function soundIsOn() {
  const s = getSave().settings;
  return !!(s.music || s.sfx);
}

const title = {
  render(container, params = {}, ctx = {}) {
    const scope = createScope();
    const endlessOpen = isEndlessUnlocked();
    const best = getSave().endlessBest || 0;
    const endlessSub = endlessOpen
      ? (best > 0 ? `<small>${esc(t('screen.endlessBest', { n: coinsText(best) }))}</small>` : '')
      : `<small>${esc(t('screen.endlessLocked', { n: ENDLESS_UNLOCK_LEVEL }))}</small>`;
    container.innerHTML = `
      <div class="sc-sunburst" aria-hidden="true"></div>
      <div class="title-floaters" aria-hidden="true">${FLOATERS.map((f, i) =>
        `<span class="title-floater" style="left:${f.x}px;top:${f.y}px;--r:${f.r}deg;--d:${(i * 0.37).toFixed(2)}s">${ingredientIcon(f.id, f.s)}</span>`).join('')}</div>
      <div class="title-guest" aria-hidden="true">
        <div class="title-bubble">${esc(t('screen.order'))}</div>
        <div class="title-guest-body">${customerSVG(23, 'happy', 250)}</div>
      </div>
      <div class="title-counter" aria-hidden="true"></div>
      <div class="title-bowl" aria-hidden="true"><div class="title-bowl-inner">${bowlSVG({ base: 'acai', mid: ['banana', 'strawberry', 'blueberry'], top: ['coconut', 'honey'] }, 240)}</div></div>
      <div class="title-cup" aria-hidden="true">${cupSVG('mango', 'ready', 120)}</div>
      <div class="sc-topbar">
        <div class="sc-topbar-group">${coinsPill()}${starsPill()}</div>
        <div class="sc-topbar-group">
          ${langSwitch('title-lang')}
          <button class="btn icon cream" type="button" data-action="sound" aria-pressed="${soundIsOn()}" aria-label="${esc(t(soundIsOn() ? 'screen.soundOn' : 'screen.soundOff'))}">${soundIsOn() ? ICON.soundOn() : ICON.soundOff()}</button>
          <button class="btn icon cream" type="button" data-action="settings" aria-label="${esc(t('screen.settings'))}">${ICON.gear()}</button>
        </div>
      </div>
      <h1 class="title-logo">${logoSVG(600)}<span class="sc-sr">Açaí Fever</span></h1>
      <p class="title-tagline">${esc(t('screen.tagline'))}</p>
      <nav class="title-menu">
        <button class="btn pink title-play" type="button" data-action="play">${ICON.play(46)}<span>${esc(t('screen.play'))}</span></button>
        <div class="title-row">
          <button class="btn purple title-endless ${endlessOpen ? '' : 'is-locked'}" type="button" data-action="endless" aria-disabled="${!endlessOpen}">
            ${endlessOpen ? ICON.endless(42) : lockSVG(38)}<span class="sc-btn-stack"><span>${esc(t('screen.endless'))}</span>${endlessSub}</span>
          </button>
          <button class="btn lagoon title-shop" type="button" data-action="shop">${ICON.shop(42)}<span>${esc(t('screen.shop'))}</span>${shopBadge()}</button>
        </div>
      </nav>`;
    bindCoins(container, scope);

    onAction(container, scope, ctx, {
      play: () => {
        sfx(ctx, 'click');
        ctx.go('map');
      },
      endless: (btn) => {
        if (!isEndlessUnlocked()) {
          sfx(ctx, 'reject');
          shake(btn);
          showToast(container, scope, t('screen.endlessLockedToast', { n: ENDLESS_UNLOCK_LEVEL }), { anchor: btn });
          return;
        }
        sfx(ctx, 'click');
        ctx.go('game', { mode: 'endless' });
      },
      shop: () => {
        sfx(ctx, 'click');
        ctx.go('shop', { back: 'title' });
      },
      settings: () => {
        sfx(ctx, 'click');
        ctx.go('settings', { back: 'title' });
      },
      sound: (btn) => {
        const on = !soundIsOn();
        setSetting('music', on);
        setSetting('sfx', on);
        ctx.audio?.setMusic?.(on);
        ctx.audio?.setSfx?.(on);
        btn.setAttribute('aria-pressed', String(on));
        btn.setAttribute('aria-label', t(on ? 'screen.soundOn' : 'screen.soundOff'));
        btn.innerHTML = on ? ICON.soundOn() : ICON.soundOff();
        if (on) sfx(ctx, 'click');
      },
      'data-lang': (btn) => {
        sfx(ctx, 'click');
        changeLang(btn.dataset.lang);
      },
    });
    return () => scope.dispose();
  },
};

// =====================================================================
// Level map
// =====================================================================
const MAP_ROWS = [668, 528, 388, 248];
const MAP_COLS = [250, 445, 640, 835, 1030];
const MAP_WAVE = 14;
const MAP_BADGES = { 7: 'smoothie', 10: 'endless' };

function levelPos(index) {
  const row = Math.floor(index / 5);
  const col = index % 5;
  return { x: MAP_COLS[row % 2 ? 4 - col : col], y: MAP_ROWS[row] + (col % 2 ? -MAP_WAVE : MAP_WAVE) };
}

function mapPathData(count) {
  let d = '';
  for (let i = 0; i < count; i++) {
    const b = levelPos(i);
    if (i === 0) {
      d += `M${b.x - 150} ${b.y + 20}C${b.x - 90} ${b.y + 20} ${b.x - 70} ${b.y} ${b.x} ${b.y}`;
      continue;
    }
    const a = levelPos(i - 1);
    if (Math.abs(a.y - b.y) > 60) {
      const bulge = a.x > STAGE_W / 2 ? 128 : -128;
      d += `C${a.x + bulge} ${a.y} ${b.x + bulge} ${b.y} ${b.x} ${b.y}`;
    } else {
      const mx = (a.x + b.x) / 2;
      d += `C${mx} ${a.y} ${mx} ${b.y} ${b.x} ${b.y}`;
    }
  }
  return d;
}

// The first unlocked level without stars – the one that pulses on the map.
function nextPlayableLevel() {
  const lvl = LEVELS.find((l) => isLevelUnlocked(l.id) && levelStars(l.id) === 0);
  return lvl ? lvl.id : null;
}

function mapBadge(levelId) {
  const kind = MAP_BADGES[levelId];
  if (kind === 'smoothie') return `<span class="map-badge">${cupSVG('strawberry', 'ready', 40)}</span>`;
  if (kind === 'endless') return `<span class="map-badge is-endless">${ICON.endless(34)}</span>`;
  return '';
}

function levelNode(level, index, currentId) {
  const { x, y } = levelPos(index);
  const unlocked = isLevelUnlocked(level.id);
  const stars = levelStars(level.id);
  const state = !unlocked ? 'locked' : level.id === currentId ? 'current' : stars > 0 ? 'done' : 'open';
  const label = unlocked ? t('map.levelAria', { n: level.id, stars }) : t('map.levelLockedAria', { n: level.id });
  return `<button class="map-level is-${state}" type="button" style="left:${x - 55}px;top:${y - 50}px" data-level="${level.id}" data-state="${state}" aria-label="${esc(label)}"${unlocked ? '' : ' aria-disabled="true"'}>
    <span class="map-disc"><span class="map-num">${level.id}</span>${unlocked ? '' : `<span class="map-lock">${lockSVG(34)}</span>`}</span>
    ${unlocked ? `<span class="map-stars">${repeat(3, (k) => starSVG(k < stars, 26))}</span>` : ''}
    ${mapBadge(level.id)}
  </button>`;
}

function endlessButton(cls = '') {
  const open = isEndlessUnlocked();
  return `<button class="btn small purple ${cls} ${open ? '' : 'is-locked'}" type="button" data-action="endless" aria-disabled="${!open}">${open ? ICON.endless(34) : lockSVG(30)}<span>${esc(t('screen.endless'))}</span></button>`;
}

const map = {
  render(container, params = {}, ctx = {}) {
    const scope = createScope();
    const currentId = nextPlayableLevel();
    const fullPath = mapPathData(LEVELS.length);
    const doneCount = currentId ? currentId : LEVELS.length;
    container.innerHTML = `
      <div class="map-bg" aria-hidden="true">${mapBackgroundSVG(STAGE_W, STAGE_H)}</div>
      <svg class="map-path" viewBox="0 0 ${STAGE_W} ${STAGE_H}" width="${STAGE_W}" height="${STAGE_H}" aria-hidden="true" focusable="false">
        <path d="${fullPath}" class="map-road-shadow"/>
        <path d="${fullPath}" class="map-road-edge"/>
        <path d="${fullPath}" class="map-road"/>
        <path d="${mapPathData(doneCount)}" class="map-road-done"/>
        <path d="${fullPath}" class="map-road-dots"/>
      </svg>
      <div class="map-nodes">${LEVELS.map((l, i) => levelNode(l, i, currentId)).join('')}</div>
      ${header({ title: t('map.title'), right: `${starsPill()}${coinsPill()}<button class="btn small lagoon" type="button" data-action="shop">${ICON.shop(34)}<span>${esc(t('screen.shop'))}</span>${shopBadge()}</button>${endlessButton()}` })}`;
    bindCoins(container, scope);

    let closeModal = null;
    const open = (id, opts) => {
      closeModal = openPreLevel(container, id, ctx, {
        ...opts,
        onClose: () => {
          closeModal = null;
          delete params.openLevel;
          container.querySelector(`[data-level="${id}"]`)?.focus({ preventScroll: true });
        },
      });
    };

    onAction(container, scope, ctx, {
      back: () => {
        sfx(ctx, 'click');
        ctx.go('title');
      },
      shop: () => {
        sfx(ctx, 'click');
        ctx.go('shop', { back: 'map' });
      },
      endless: (btn) => {
        if (!isEndlessUnlocked()) {
          sfx(ctx, 'reject');
          shake(btn);
          showToast(container, scope, t('screen.endlessLockedToast', { n: ENDLESS_UNLOCK_LEVEL }), { anchor: btn });
          return;
        }
        sfx(ctx, 'click');
        ctx.go('game', { mode: 'endless' });
      },
      'data-level': (btn) => {
        const id = Number(btn.dataset.level);
        if (!isLevelUnlocked(id)) {
          sfx(ctx, 'reject');
          shake(btn);
          showToast(container, scope, t('map.locked', { n: id - 1 }), { anchor: btn });
          return;
        }
        sfx(ctx, 'click');
        open(id);
      },
    });

    escapeToBack(container, scope, () => !!closeModal);
    if (params.openLevel && isLevelUnlocked(params.openLevel)) open(params.openLevel, { animate: !ctx.rerender });
    return () => {
      closeModal?.();
      scope.dispose();
    };
  },
};

// =====================================================================
// Pre-level modal
// =====================================================================
function introArt(key) {
  switch (key) {
    case 'basics':
      return `<div class="intro-art intro-art-steps">${packIcon('acai', 58)}<i></i>${blenderSVG({ state: 'ready', base: 'acai', portions: 2, maxPortions: 2 }, 70)}<i></i>${bowlSVG({ base: 'acai', mid: ['banana'], top: ['honey'] }, 76)}</div>`;
    case 'overflow':
      return `<div class="intro-art">${blenderSVG({ state: 'overflowing', base: 'acai', portions: 2, maxPortions: 2 }, 110)}</div>`;
    case 'smoothie':
      return `<div class="intro-art">${cupSVG('strawberry', 'ready', 92)}${cupSVG('mango', 'ready', 74)}</div>`;
    case 'endless':
      return `<div class="intro-art intro-art-endless">${ICON.endless(96)}</div>`;
    case 'moreSeats':
    case 'fourSeats': {
      const n = key === 'fourSeats' ? 4 : 3;
      return `<div class="intro-art intro-art-crowd">${repeat(n, (i) => customerSVG(31 + i * 7, 'happy', 62))}</div>`;
    }
    default:
      return '';
  }
}

// Something in the shop the player can afford right now?
function affordableCount() {
  const coins = getSave().coins;
  let n = 0;
  for (const layer of LAYERS) {
    for (const ing of ingredientsByLayer(layer)) {
      const cost = isOwned(ing.id) ? qualityUpgradeCost(ing.id, ingLevel(ing.id)) : ing.cost;
      if (cost !== null && cost <= coins) n++;
    }
  }
  for (const u of UPGRADES) {
    const cost = nextUpgradeCost(u.id, getSave().upgrades);
    if (!upgradeLocked(u.id) && cost !== null && cost <= coins) n++;
  }
  return n;
}

// "!" on shop buttons while the player can afford something there.
function shopBadge() {
  return affordableCount() > 0 ? '<span class="sc-badge" aria-hidden="true">!</span>' : '';
}

function seatsIcons(n, seed) {
  return `<span class="prelevel-seats">${repeat(n, (i) => customerSVG(seed + i * 5, 'happy', 40))}</span>`;
}

export function openPreLevel(container, levelId, ctx = {}, opts = {}) {
  const level = getLevel(Number(levelId));
  if (!level) return () => {};
  container.querySelector('.prelevel-overlay')?.__close?.();
  const scope = createScope();
  const best = levelStars(level.id);
  const showHint = affordableCount() > 0;
  const overlay = document.createElement('div');
  overlay.className = 'overlay prelevel-overlay';
  overlay.innerHTML = `
    <section class="panel prelevel ${opts.animate === false ? '' : 'anim-pop'}" role="dialog" aria-modal="true" aria-labelledby="prelevel-title" data-prelevel="${level.id}">
      <div class="sc-ribbon"><h2 id="prelevel-title">${esc(t('map.level', { n: level.id }))}</h2></div>
      <button class="btn icon cream sc-close" type="button" data-action="close" aria-label="${esc(t('screen.close'))}">${ICON.close()}</button>
      <h3 class="prelevel-label">${esc(t('map.goals'))}</h3>
      <div class="prelevel-goals">${level.goals.map((g, i) => `
        <div class="prelevel-goal ${best > i ? 'is-reached' : ''}" data-goal="${i + 1}">
          <span class="prelevel-goal-stars">${repeat(i + 1, () => starSVG(true, 34))}</span>
          <span class="prelevel-goal-amount">${coinSVG(32)}<b>${coinsText(g)}</b></span>
          ${best > i ? `<span class="prelevel-check" title="${esc(t('map.goalReached'))}">${ICON.check(24)}</span>` : ''}
        </div>`).join('')}
      </div>
      <div class="prelevel-facts">
        <span class="sc-chip" title="${esc(t('map.time'))}">${clockSVG(32)}<b>${timeText(level.duration)}</b></span>
        <span class="sc-chip">${seatsIcons(level.seats, level.id * 11)}<b>${esc(t('map.seats', { n: level.seats }))}</b></span>
        <span class="sc-chip">${heartSVG(true, 30)}<b>${esc(t('map.hearts', { n: level.hearts }))}</b></span>
        ${level.id >= SMOOTHIE_LEVEL ? `<span class="sc-chip">${cupSVG('kiwi', 'ready', 36)}<b>${esc(t('map.smoothies'))}</b></span>` : ''}
      </div>
      ${level.intro ? `<div class="prelevel-intro intro-${level.intro}">
        ${introArt(level.intro)}
        <div class="prelevel-intro-text"><h4><span class="sc-new">${esc(t('map.new'))}</span>${esc(t(`intro.${level.intro}.title`))}</h4><p>${esc(t(`intro.${level.intro}.text`))}</p></div>
      </div>` : ''}
      ${showHint ? `<div class="prelevel-hint">${coinSVG(40)}<p>${esc(t('map.shopHint', { n: coinsText(getSave().coins) }))}</p>
        <button class="btn small lagoon" type="button" data-action="shop">${ICON.shop(30)}<span>${esc(t('map.toShop'))}</span></button></div>` : ''}
      <div class="prelevel-actions">
        <button class="btn green prelevel-start" type="button" data-action="start">${ICON.play(40)}<span>${esc(t('map.start'))}</span></button>
      </div>
    </section>`;
  container.append(overlay);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    scope.dispose();
    overlay.remove();
    opts.onClose?.();
  };
  overlay.__close = close;

  scope.listen(overlay, 'click', (e) => {
    e.stopPropagation(); // the screen behind must not see clicks inside the modal
    if (e.target === overlay) {
      sfx(ctx, 'click');
      close();
      return;
    }
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    sfx(ctx, 'click');
    if (action === 'close') close();
    else if (action === 'start') {
      close();
      ctx.go?.('game', { mode: 'campaign', levelId: level.id });
    } else if (action === 'shop') {
      close();
      ctx.go?.('shop', { back: 'map' });
    }
  });
  scope.listen(document, 'keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      // keep keyboard focus inside the dialog
      const items = [...overlay.querySelectorAll('button')];
      const i = items.indexOf(document.activeElement);
      const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i === -1 || i === items.length - 1 ? 0 : i + 1);
      e.preventDefault();
      items[next]?.focus();
    }
  });
  overlay.querySelector('[data-action="start"]').focus({ preventScroll: true });
  return close;
}

// =====================================================================
// Shop
// =====================================================================
const SHOP_TABS = ['ingredients', 'kitchen', 'decor'];

// Striped shop awning with scalloped edge (same look as the gameplay scene).
function awningSVG(width = STAGE_W) {
  const w = 64;
  const h = 26;
  const drop = 15;
  let s = '';
  for (let x = 0, i = 0; x < width; x += w, i++) {
    s += `<path d="M${x} -4H${x + w}V${h}A${w / 2} ${drop} 0 0 1 ${x} ${h}Z" fill="${i % 2 ? '#fffaf0' : '#ff3d8b'}" stroke="${INK}" stroke-width="3"/>`;
  }
  const H = h + drop + 3;
  return `<svg viewBox="0 0 ${width} ${H}" width="${width}" height="${H}" aria-hidden="true" focusable="false" stroke-linejoin="round">${s}</svg>`;
}
const LAYER_NUM = { base: 1, mid: 2, top: 3 };

function tabIcon(tab) {
  if (tab === 'ingredients') return ingredientIcon('strawberry', 40);
  if (tab === 'kitchen') return blenderSVG({ badge: false, state: 'ready', base: 'acai', portions: 2, maxPortions: 2 }, 44);
  return decorSVG('plants', 44);
}

function priceButton({ kind, id, price, label, upgrade = false }) {
  const afford = getSave().coins >= price;
  return `<button class="btn small sc-price ${upgrade ? 'lagoon' : ''} ${afford ? '' : 'is-poor'}" type="button" data-buy="${kind}" data-id="${id}" aria-disabled="${!afford}" aria-label="${esc(label)}">`
    + `${upgrade ? `<span class="sc-price-up">${starSVG(true, 24)}</span>` : ''}${coinSVG(26)}<span>${coinsText(price)}</span></button>`;
}

function ingredientCard(ing) {
  const owned = isOwned(ing.id);
  const q = ingLevel(ing.id);
  const price = owned ? qualityUpgradeCost(ing.id, q) : ing.cost;
  const state = !owned ? 'buy' : price === null ? 'max' : 'upgrade';
  const name = ingName(ing.id);
  const value = ingredientValue(ing.id, getSave().ingLevels);
  let action;
  if (state === 'max') action = `<div class="sc-maxed">${starSVG(true, 22)}${starSVG(true, 22)}<span>${esc(t('shop.max'))}</span></div>`;
  else if (state === 'buy') action = priceButton({ kind: 'ing', id: ing.id, price, label: t('shop.buyAria', { name, n: price }) });
  else action = priceButton({ kind: 'ing', id: ing.id, price, upgrade: true, label: t('shop.upgradeAria', { name, n: price }) });
  return `<article class="shop-card ing-card is-${state}" data-card="${ing.id}" data-shop-item="${ing.id}" data-state="${state}">
    ${owned ? `<span class="card-owned" title="${esc(t('shop.owned'))}">${ICON.check(22)}<span class="sc-sr">${esc(t('shop.owned'))}</span></span>` : ''}
    ${owned ? `<span class="card-quality" role="img" aria-label="${esc(t('shop.qualityAria', { n: q }))}">${starSVG(q >= 1, 22)}${starSVG(q >= 2, 22)}</span>` : ''}
    <div class="card-icon">${ing.layer === 'base' ? packIcon(ing.id, 68) : ingredientIcon(ing.id, 64)}${ing.smoothie ? `<span class="card-smoothie" title="${esc(t('shop.smoothie'))}">${cupSVG(ing.id, 'ready', 30)}</span>` : ''}</div>
    <h3 class="card-name">${esc(name)}</h3>
    <p class="card-value">${coinSVG(20)}<b>${numFmt(value)}</b><span>${esc(t('shop.perUse'))}</span></p>
    ${action}
  </article>`;
}

function ingredientsTab() {
  return LAYERS.map((layer) => {
    const items = ingredientsByLayer(layer);
    const owned = items.filter((i) => isOwned(i.id)).length;
    const tip = layer === 'base' ? `<aside class="shop-tip">
        <div class="shop-tip-art">${bowlSVG({ base: 'pitaya', mid: ['mango', 'kiwi'], top: ['coconut', 'chia'] }, 112)}</div>
        <div><h3>${esc(t('shop.tipTitle'))}</h3><p>${esc(t('shop.tipText'))}</p><p>${esc(t('shop.tipQuality'))}</p></div>
      </aside>` : '';
    return `<section class="shop-row shop-row-${layer}" aria-label="${esc(t(`layer.${layer}`))}">
      <div class="shop-row-label"><span class="shop-row-num">${LAYER_NUM[layer]}</span><span class="shop-row-name">${esc(t(`layer.${layer}`))}</span><span class="shop-row-count">${owned}/${items.length}</span></div>
      <div class="shop-row-cards">${items.map(ingredientCard).join('')}${tip}</div>
    </section>`;
  }).join('');
}

const STAT_SPEC = {
  blenderSpeed: { key: 'blendTime', fmt: (v) => t('shop.seconds', { n: numFmt(v) }) },
  jug: { key: 'portions', fmt: (v) => numFmt(v) },
  blender2: { key: 'blenders', fmt: (v) => numFmt(v) },
  bowlSlots: { key: 'bowlSlots', fmt: (v) => numFmt(v) },
  smoothieSlots: { key: 'smoothieSlots', fmt: (v) => numFmt(v) },
};

function statLine(u) {
  if (u.cat === 'decor') {
    const pct = Math.round(u.levels[0].patience * 100);
    return `<span class="upg-stat-label">${esc(t('shop.stat.patience'))}</span><span class="upg-stat-value"><b>${esc(t('shop.percent', { n: pct }))}</b></span>`;
  }
  const spec = STAT_SPEC[u.id];
  if (!spec) return '';
  const ups = getSave().upgrades;
  const lvl = upgradeLevel(u.id);
  const now = getKitchenStats(ups)[spec.key];
  const next = lvl < u.levels.length ? getKitchenStats({ ...ups, [u.id]: lvl + 1 })[spec.key] : null;
  return `<span class="upg-stat-label">${esc(t(`shop.stat.${spec.key}`))}</span>`
    + `<span class="upg-stat-value">${esc(spec.fmt(now))}${next !== null ? ` <i>→</i> <b>${esc(spec.fmt(next))}</b>` : ''}</span>`;
}

function smoothieMachineArt(size) {
  const cup = Math.round(size * SMOOTHIE_CUP_SIZE);
  const xs = SMOOTHIE_SLOT_X[2];
  const fruits = ['strawberry', 'kiwi'];
  return `<div class="upg-machine" style="width:${size}px;height:${size}px">${smoothieMachineSVG(2, size)}${xs.map((fx, i) =>
    `<span style="left:${Math.round(fx * size - cup / 2)}px;top:${Math.round(SMOOTHIE_SLOT_Y * size - cup)}px">${cupSVG(fruits[i], 'ready', cup)}</span>`).join('')}</div>`;
}

function upgradeArt(id) {
  switch (id) {
    case 'blenderSpeed':
      return `<div class="upg-art-speed">${blenderSVG({ badge: false, state: 'blending', base: 'acai', progress: 0.7 }, 180)}<span class="upg-bolt">${ICON.bolt(46)}</span></div>`;
    case 'jug':
      return blenderSVG({ badge: false, state: 'ready', base: 'pitaya', portions: 3, maxPortions: 3 }, 180);
    case 'blender2':
      return `<div class="upg-art-pair">${blenderSVG({ badge: false, state: 'ready', base: 'acai', portions: 2, maxPortions: 2 }, 128)}${blenderSVG({ badge: false, state: 'blending', base: 'spirulina', progress: 0.45 }, 128)}</div>`;
    case 'bowlSlots':
      return `<div class="upg-art-bowls">${bowlSVG({ base: 'acai', mid: ['banana'], top: ['honey'] }, 104)}${bowlSVG(null, 104)}${bowlSVG({ base: 'pitaya', mid: ['strawberry'], top: [] }, 104)}</div>`;
    case 'smoothieSlots':
      return smoothieMachineArt(172);
    default:
      return decorSVG(id, 230);
  }
}

function upgradeCard(u) {
  const lvl = upgradeLevel(u.id);
  const max = u.levels.length;
  const locked = upgradeLocked(u.id);
  const cost = nextUpgradeCost(u.id, getSave().upgrades);
  const state = locked ? 'locked' : cost === null ? 'max' : 'buy';
  const name = t(`upg.${u.id}`);
  let action;
  if (state === 'locked') {
    action = `<button class="btn small cream sc-price is-locked" type="button" data-buy="upg" data-id="${u.id}" aria-disabled="true">${lockSVG(28)}<span>${esc(t('shop.locked', { n: u.requiresLevel }))}</span></button>`;
  } else if (state === 'max') {
    action = `<div class="sc-maxed">${ICON.check(26)}<span>${esc(t(max === 1 ? 'shop.owned' : 'shop.max'))}</span></div>`;
  } else {
    action = priceButton({ kind: 'upg', id: u.id, price: cost, label: t('shop.buyAria', { name, n: cost }) });
  }
  return `<article class="shop-card upg-card is-${state}" data-card="${u.id}" data-upgrade="${u.id}" data-state="${state}">
    <div class="upg-art">${upgradeArt(u.id)}${locked ? `<span class="upg-lock">${lockSVG(56)}</span>` : ''}</div>
    <h3 class="card-name">${esc(name)}</h3>
    <p class="upg-desc">${esc(t(`upgdesc.${u.id}`))}</p>
    ${u.cat === 'decor' ? '' : `<p class="upg-stat">${statLine(u)}</p>`}
    <div class="upg-pips" role="img" aria-label="${esc(t('shop.levelOf', { a: lvl, b: max }))}">${repeat(max, (i) => `<i class="${i < lvl ? 'on' : ''}"></i>`)}</div>
    ${action}
  </article>`;
}

function kitchenSummary() {
  const k = getKitchenStats(getSave().upgrades);
  const item = (art, label, value) => `<span class="shop-sum-item">${art}<span><small>${esc(label)}</small><b>${esc(value)}</b></span></span>`;
  return `<div class="shop-summary panel"><h3>${esc(t('shop.kitchenNow'))}</h3>
    ${item(blenderSVG({ badge: false, state: 'blending', base: 'acai', progress: 0.5 }, 50), t('shop.stat.blendTime'), t('shop.seconds', { n: numFmt(k.blendTime) }))}
    ${item(blenderSVG({ badge: false, state: 'ready', base: 'pitaya', portions: k.portions, maxPortions: k.portions }, 50), t('shop.stat.portions'), numFmt(k.portions))}
    ${item(blenderSVG({ badge: false, state: 'empty', base: 'acai' }, 50), t('shop.stat.blenders'), numFmt(k.blenders))}
    ${item(bowlSVG(null, 50), t('shop.stat.bowlSlots'), numFmt(k.bowlSlots))}
    ${item(cupSVG('mango', 'ready', 46), t('shop.stat.smoothieSlots'), numFmt(k.smoothieSlots))}
  </div>`;
}

function decorSummary() {
  const k = getKitchenStats(getSave().upgrades);
  const pct = Math.round((k.patienceMult - 1) * 100);
  return `<div class="shop-summary panel"><h3>${esc(t('shop.decorNow'))}</h3>
    <span class="shop-sum-item">${heartSVG(true, 46)}<span><small>${esc(t('shop.stat.patience'))}</small><b>${esc(t('shop.percent', { n: pct }))}</b></span></span>
  </div>`;
}

function upgradesTab(cat) {
  const list = UPGRADES.filter((u) => u.cat === cat);
  return `${cat === 'kitchen' ? kitchenSummary() : decorSummary()}
    <div class="upg-grid upg-grid-${cat}">${list.map(upgradeCard).join('')}</div>`;
}

const shop = {
  render(container, params = {}, ctx = {}) {
    const scope = createScope();
    let tab = SHOP_TABS.includes(params.tab) ? params.tab : 'ingredients';
    container.innerHTML = `
      <div class="shop-awning" aria-hidden="true">${awningSVG()}</div>
      ${header({ title: t('shop.title'), right: coinsPill() })}
      <div class="sc-tabs shop-tabs" role="tablist" aria-label="${esc(t('shop.title'))}">${SHOP_TABS.map((id) =>
        `<button class="sc-tab" type="button" role="tab" id="shop-tab-${id}" data-tab="${id}" aria-controls="shop-panel">${tabIcon(id)}<span>${esc(t(`shop.tab.${id}`))}</span></button>`).join('')}</div>
      <div class="shop-body" id="shop-panel" role="tabpanel"></div>`;
    const body = container.querySelector('.shop-body');
    bindCoins(container, scope);
    // Any save change (purchase, coins from elsewhere) refreshes prices and states.
    scope.add(onSaveChange(() => draw()));

    const draw = () => {
      // Redrawing replaces the cards – keep keyboard focus on the same card.
      const focusedCard = body.contains(document.activeElement) ? document.activeElement.closest('[data-card]')?.dataset.card : null;
      body.dataset.tab = tab;
      body.setAttribute('aria-labelledby', `shop-tab-${tab}`);
      body.innerHTML = tab === 'ingredients' ? ingredientsTab() : upgradesTab(tab === 'kitchen' ? 'kitchen' : 'decor');
      if (focusedCard) {
        const card = body.querySelector(`[data-card="${focusedCard}"]`);
        (card?.querySelector('button') || card)?.focus({ preventScroll: true });
      }
      container.querySelectorAll('[data-tab]').forEach((b) => {
        const on = b.dataset.tab === tab;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
      });
    };

    const purchase = (btn) => {
      const { buy: kind, id } = btn.dataset;
      const card = btn.closest('.shop-card');
      const wasOwned = kind === 'ing' && isOwned(id);
      const res = kind === 'ing' ? (wasOwned ? upgradeIngredient(id) : buyIngredient(id)) : buyUpgrade(id);
      if (!res.ok) {
        sfx(ctx, 'reject');
        shake(card);
        const msg = res.reason === 'noMoney' ? t('shop.noMoney')
          : res.reason === 'locked' ? t('shop.lockedToast', { n: UPG[id]?.requiresLevel ?? SMOOTHIE_LEVEL })
            : t('shop.maxed');
        showToast(container, scope, msg, { anchor: btn });
        return;
      }
      sfx(ctx, 'purchase'); // the save listener below has already redrawn the cards
      const fresh = body.querySelector(`[data-card="${id}"]`);
      if (fresh) {
        restartClass(fresh, 'is-bought');
        burst(container, scope, fresh);
      }
      const name = kind === 'ing' ? ingName(id) : t(`upg.${id}`);
      const msg = kind === 'upg' ? t('shop.boughtUpg', { name }) : wasOwned ? t('shop.upgraded', { name }) : t('shop.boughtIng', { name });
      showToast(container, scope, msg, { kind: 'good', anchor: fresh || null });
    };

    onAction(container, scope, ctx, {
      back: () => {
        sfx(ctx, 'click');
        ctx.go(params.back === 'title' ? 'title' : 'map');
      },
      'data-tab': (btn) => {
        if (btn.dataset.tab === tab) return;
        sfx(ctx, 'click');
        tab = btn.dataset.tab;
        params.tab = tab; // survives a language re-render
        draw();
      },
      'data-buy': purchase,
    });
    // Arrow keys move between tabs (WAI-ARIA tabs pattern).
    scope.listen(container.querySelector('.shop-tabs'), 'keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const i = SHOP_TABS.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : -1);
      tab = SHOP_TABS[(i + SHOP_TABS.length) % SHOP_TABS.length];
      params.tab = tab;
      draw();
      container.querySelector(`[data-tab="${tab}"]`).focus();
    });
    escapeToBack(container, scope);
    draw();
    return () => scope.dispose();
  },
};

// =====================================================================
// Settings
// =====================================================================
function switchButton(key, on, labelId) {
  return `<button class="sc-switch" type="button" role="switch" aria-checked="${on}" aria-labelledby="${labelId}" data-setting="${key}">
    <span class="sc-switch-text sc-switch-on">${esc(t('settings.on'))}</span><span class="sc-switch-text sc-switch-off">${esc(t('settings.off'))}</span><span class="sc-switch-knob"></span></button>`;
}

function progressBar() {
  const won = LEVELS.filter((l) => levelStars(l.id) > 0).length;
  const pct = Math.round((won / LEVELS.length) * 100);
  return `<div class="settings-progress">
    <div class="settings-progress-head"><span>${esc(t('settings.campaign'))}</span><b>${esc(t('settings.levelsWon', { n: won, max: LEVELS.length }))}</b></div>
    <div class="settings-progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${LEVELS.length}" aria-valuenow="${won}" aria-label="${esc(t('settings.campaign'))}"><i style="width:${pct}%"></i></div>
  </div>`;
}

function statsList() {
  const s = getSave();
  const row = (art, label, value) => `<div class="settings-stat">${art}<dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
  return `<dl class="settings-stats">
    ${row(ICON.play(30), t('settings.statPlayed'), numFmt(s.stats.played, 0))}
    ${row(customerSVG(5, 'happy', 34), t('settings.statServed'), numFmt(s.stats.served, 0))}
    ${row(coinSVG(30), t('settings.statEarned'), coinsText(s.stats.earned))}
    ${row(starSVG(true, 30), t('settings.statStars'), `${totalStars()} / ${LEVELS.length * 3}`)}
    ${row(ICON.endless(32), t('settings.statBest'), coinsText(s.endlessBest))}
  </dl>`;
}

const settings = {
  render(container, params = {}, ctx = {}) {
    const scope = createScope();
    const s = getSave().settings;
    const lang = getLang();
    container.innerHTML = `
      <div class="sc-sunburst is-calm" aria-hidden="true"></div>
      ${header({ title: t('settings.title') })}
      <div class="settings-grid">
        <section class="panel settings-main">
          <div class="settings-row">
            <span class="settings-label" id="settings-lang-label">${ICON.globe()}<span>${esc(t('settings.language'))}</span></span>
            <div class="sc-seg settings-lang" role="radiogroup" aria-labelledby="settings-lang-label">${[['de', 'Deutsch'], ['en', 'English']].map(([l, name]) =>
              `<button class="sc-seg-btn ${l === lang ? 'is-on' : ''}" type="button" role="radio" aria-checked="${l === lang}" data-setting-lang="${l}" lang="${l}">${name}</button>`).join('')}</div>
          </div>
          <div class="settings-row">
            <span class="settings-label" id="settings-music-label">${ICON.note()}<span>${esc(t('settings.music'))}</span></span>
            ${switchButton('music', !!s.music, 'settings-music-label')}
          </div>
          <div class="settings-row">
            <span class="settings-label" id="settings-sfx-label">${ICON.soundOn(36)}<span>${esc(t('settings.sfx'))}</span></span>
            ${switchButton('sfx', !!s.sfx, 'settings-sfx-label')}
          </div>
          <div class="settings-about">
            <div class="settings-about-art">${logoSVG(220)}</div>
            <div><h2>${esc(t('settings.about'))}</h2><p>${esc(t('settings.aboutText'))}</p></div>
          </div>
        </section>
        <section class="panel settings-side">
          <h2>${esc(t('settings.stats'))}</h2>
          ${progressBar()}
          ${statsList()}
          <div class="settings-reset" data-step="0"></div>
        </section>
      </div>`;
    const resetBox = container.querySelector('.settings-reset');
    const drawReset = (step) => {
      resetBox.dataset.step = String(step);
      resetBox.innerHTML = step === 0
        ? `<button class="btn small cream settings-reset-btn" type="button" data-action="reset">${ICON.trash()}<span>${esc(t('settings.reset'))}</span></button>`
        : `<p role="alert">${esc(t('settings.resetConfirm'))}</p><div class="settings-reset-actions">
            <button class="btn small cream" type="button" data-action="reset-cancel">${esc(t('settings.resetNo'))}</button>
            <button class="btn small settings-danger" type="button" data-action="reset-confirm">${ICON.trash()}<span>${esc(t('settings.resetYes'))}</span></button></div>`;
    };
    drawReset(0);
    if (params.resetDone) {
      delete params.resetDone;
      scope.timeout(() => showToast(container, scope, t('settings.resetDone'), { kind: 'good' }), 30);
    }

    onAction(container, scope, ctx, {
      back: () => {
        sfx(ctx, 'click');
        ctx.go(params.back === 'map' ? 'map' : 'title');
      },
      'data-setting-lang': (btn) => {
        sfx(ctx, 'click');
        changeLang(btn.dataset.settingLang);
      },
      'data-setting': (btn) => {
        const key = btn.dataset.setting;
        const on = btn.getAttribute('aria-checked') !== 'true';
        setSetting(key, on);
        if (key === 'music') ctx.audio?.setMusic?.(on);
        else ctx.audio?.setSfx?.(on);
        btn.setAttribute('aria-checked', String(on));
        sfx(ctx, 'click');
      },
      reset: () => {
        sfx(ctx, 'click');
        drawReset(1);
        resetBox.querySelector('[data-action="reset-cancel"]').focus({ preventScroll: true });
      },
      'reset-cancel': () => {
        sfx(ctx, 'click');
        drawReset(0);
      },
      'reset-confirm': () => {
        const keep = { ...getSave().settings };
        resetSave();
        setSetting('music', keep.music);
        setSetting('sfx', keep.sfx);
        sfx(ctx, 'trash');
        ctx.go('settings', { ...params, resetDone: true });
      },
    });
    escapeToBack(container, scope);
    return () => scope.dispose();
  },
};

// =====================================================================
// Results
// =====================================================================
function normalizeResult(p) {
  const r = p && typeof p === 'object' ? p : {};
  const mode = r.mode === 'endless' ? 'endless' : 'campaign';
  return {
    mode,
    levelId: Number(r.levelId) || 1,
    result: r.result === 'won' ? 'won' : 'lost',
    reason: r.reason ?? null,
    stars: Math.max(0, Math.min(3, Number(r.stars) || 0)),
    money: Math.max(0, Number(r.money) || 0),
    served: Math.max(0, Number(r.served) || 0),
    lost: Math.max(0, Number(r.lost) || 0),
    newBest: !!r.newBest,
    unlockedEndless: !!r.unlockedEndless,
    unlockedLevel: Number(r.unlockedLevel) || null,
    coinsTotal: Number.isFinite(r.coinsTotal) ? r.coinsTotal : getSave().coins,
    stage: Number.isFinite(r.stage) ? r.stage : null,
  };
}

function resultSubline(r) {
  const level = getLevel(r.levelId);
  if (r.mode === 'endless') return r.stage !== null ? t('results.stage', { n: r.stage + 1 }) : '';
  if (r.result === 'lost') {
    if (r.reason === 'hearts') return t('results.reasonHearts');
    if (r.reason === 'goal' && level) return t('results.reasonGoal', { n: coinsText(level.goals[0]) });
    return '';
  }
  if (r.stars >= 3) return t('results.perfect');
  return level ? t('results.nextStar', { n: coinsText(level.goals[r.stars] ?? level.goals[2]) }) : '';
}

// Coins earned against the three goals of the level (★ marks like the in-game money bar).
function goalMeter(r) {
  const level = getLevel(r.levelId);
  if (r.mode !== 'campaign' || !level) return '';
  const max = level.goals[2];
  const pct = (v) => Math.min(100, (v / max) * 100).toFixed(1);
  return `<div class="results-meter" role="img" aria-label="${esc(t('results.meterAria', { n: coinsText(r.money), goal: coinsText(level.goals[0]) }))}">
    <div class="results-meter-bar"><i style="--w:${pct(r.money)}%"></i></div>
    ${level.goals.map((g, i) => `<span class="results-meter-mark mark-${i + 1} ${r.money >= g ? 'is-hit' : ''}" style="left:${pct(g)}%">${starSVG(r.money >= g, 28)}<small>${coinsText(g)}</small></span>`).join('')}
  </div>`;
}

function resultNotes(r) {
  const notes = [];
  if (r.mode === 'endless' && r.newBest) notes.push(['best', ICON.endless(30), t('results.newBest')]);
  if (r.mode === 'campaign' && r.result === 'won' && r.newBest) notes.push(['stars', starSVG(true, 28), t('results.newStars')]);
  if (r.unlockedLevel) notes.push(['level', ICON.map(28), t('results.unlockedLevel', { n: r.unlockedLevel })]);
  if (r.unlockedEndless) notes.push(['endless', ICON.endless(30), t('results.unlockedEndless')]);
  if (r.mode === 'campaign' && r.result === 'won' && r.levelId >= LEVELS.length) notes.push(['all', starSVG(true, 28), t('results.allDone')]);
  if (r.mode === 'campaign' && r.result === 'lost' && r.money > 0) notes.push(['keep', coinSVG(28), t('results.keepCoins')]);
  return notes.map(([kind, icon, text]) => `<li class="results-note note-${kind}">${icon}<span>${esc(text)}</span></li>`).join('');
}

function resultButtons(r) {
  const btn = (action, cls, icon, label) => `<button class="btn ${cls}" type="button" data-action="${action}">${icon}<span>${esc(label)}</span></button>`;
  const hasNext = r.mode === 'campaign' && r.result === 'won' && r.levelId < LEVELS.length;
  const out = [
    r.mode === 'endless' ? btn('title', 'cream', ICON.home(34), t('results.title')) : btn('map', 'cream', ICON.map(34), t('results.map')),
    btn('shop', 'lagoon', ICON.shop(34), t('results.shop')),
    btn('retry', hasNext ? 'purple' : 'pink', ICON.retry(34), t('results.retry')),
  ];
  if (hasNext) out.push(btn('next', 'green results-next', ICON.next(34), t('results.next')));
  return out.join('');
}

const CONFETTI_COLORS = ['#ff3d8b', '#ffb627', '#2fbf71', '#18c2c9', '#9b4fc4', '#ffffff'];

function confetti() {
  return `<div class="results-confetti" aria-hidden="true">${repeat(42, (i) => {
    const x = (i * 97 + 31) % 1280;
    const delay = ((i * 37) % 23) / 10;
    const dur = 2.6 + ((i * 13) % 9) / 6;
    const rot = (i * 53) % 360;
    return `<i style="left:${x}px;--c:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]};--d:${delay}s;--t:${dur.toFixed(2)}s;--r:${rot}deg"></i>`;
  })}</div>`;
}

const results = {
  render(container, params = {}, ctx = {}) {
    const scope = createScope();
    const r = normalizeResult(params);
    const won = r.result === 'won';
    const endless = r.mode === 'endless';
    const animate = !ctx.rerender;
    const headline = endless ? t('results.endless') : t(won ? 'results.won' : 'results.lost', { n: r.levelId });
    const mood = endless ? (r.newBest ? 'happy' : 'neutral') : won ? 'happy' : 'angry';
    container.classList.add(won || (endless && r.newBest) ? 'is-won' : 'is-lost');
    container.innerHTML = `
      <div class="sc-sunburst ${won ? '' : 'is-calm'}" aria-hidden="true"></div>
      ${won ? confetti() : ''}
      <div class="results-guest" aria-hidden="true">${customerSVG(r.levelId * 3 + 2, mood, 230)}</div>
      <div class="results-bowl" aria-hidden="true">${won || endless ? bowlSVG({ base: 'acai', mid: ['banana', 'strawberry'], top: ['honey', 'coconut'] }, 210) : bowlSVG(null, 190)}</div>
      <div class="results-wrap"><section class="panel results-card" aria-labelledby="results-title">
        <div class="sc-ribbon ${won ? '' : 'is-sad'}"><h1 id="results-title">${esc(headline)}</h1></div>
        ${endless ? `<div class="results-hero ${r.newBest ? 'is-best' : ''}" aria-hidden="true">${ICON.endless(120)}</div>` : `<div class="results-stars" role="img" aria-label="${esc(t('results.starsAria', { n: won ? r.stars : 0 }))}">${repeat(3, (i) => {
          const filled = won && i < r.stars;
          return `<span class="results-star star-${i + 1} ${filled ? 'is-filled' : ''} ${filled && animate ? 'is-waiting' : ''}" data-filled="${filled}">${starSVG(false, 92)}${filled ? `<span class="results-star-fill">${starSVG(true, 92)}</span>` : ''}</span>`;
        })}</div>`}
        <p class="results-sub">${esc(resultSubline(r))}</p>
        ${goalMeter(r)}
        <div class="results-money"><span class="results-money-label">${esc(t('results.earned'))}</span>${coinSVG(54)}<b data-money="${r.money}">${animate ? '0' : coinsText(r.money)}</b></div>
        <div class="results-stats">
          <span class="sc-chip">${customerSVG(9, 'happy', 40)}<span class="sc-chip-text"><small>${esc(t('results.served'))}</small><b>${numFmt(r.served, 0)}</b></span></span>
          <span class="sc-chip">${customerSVG(9, 'angry', 40)}<span class="sc-chip-text"><small>${esc(t('results.walkedOut'))}</small><b>${numFmt(r.lost, 0)}</b></span></span>
          ${endless ? `<span class="sc-chip">${ICON.endless(36)}<span class="sc-chip-text"><small>${esc(t('results.best'))}</small><b>${coinsText(getSave().endlessBest)}</b></span></span>` : ''}
          <span class="sc-chip">${coinSVG(34)}<span class="sc-chip-text"><small>${esc(t('results.total'))}</small><b>${coinsText(r.coinsTotal)}</b></span></span>
        </div>
        <ul class="results-notes">${resultNotes(r)}</ul>
        <div class="results-actions">${resultButtons(r)}</div>
      </section></div>`;

    const meter = container.querySelector('.results-meter');
    if (meter && !animate) meter.classList.add('is-filled');
    else if (meter) scope.timeout(() => meter.classList.add('is-filled'), 250);
    if (animate) {
      container.querySelectorAll('.results-star.is-waiting').forEach((el, i) => {
        scope.timeout(() => {
          el.classList.remove('is-waiting');
          el.classList.add('is-in');
          sfx(ctx, 'star');
        }, 650 + i * 420);
      });
      const moneyEl = container.querySelector('[data-money]');
      const t0 = performance.now() + 250;
      const step = (now) => {
        const k = Math.max(0, Math.min(1, (now - t0) / 1000));
        moneyEl.textContent = coinsText(r.money * (1 - (1 - k) ** 2));
        if (k < 1) scope.frame(step);
        else if (r.money > 0) sfx(ctx, 'coin');
      };
      scope.frame(step);
    }

    onAction(container, scope, ctx, {
      next: () => {
        sfx(ctx, 'click');
        ctx.go('map', { openLevel: r.levelId + 1 });
      },
      retry: () => {
        sfx(ctx, 'click');
        ctx.go('game', endless ? { mode: 'endless' } : { mode: 'campaign', levelId: r.levelId });
      },
      map: () => {
        sfx(ctx, 'click');
        ctx.go('map');
      },
      title: () => {
        sfx(ctx, 'click');
        ctx.go('title');
      },
      shop: () => {
        sfx(ctx, 'click');
        ctx.go('shop', { back: endless ? 'title' : 'map' });
      },
    });
    container.querySelector('.results-actions .btn:last-child')?.focus({ preventScroll: true });
    return () => scope.dispose();
  },
};

export const screens = { title, map, shop, settings, results };
