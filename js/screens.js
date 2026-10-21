// Menu screens: title, level map (+ pre-level modal), shop, settings and results.
// Each screen: render(container, params, ctx) → cleanup(). ctx = { go, audio, rerender? }.
// All markup is built from strings; user-visible text goes through t().

import { registerStrings, t, getLang, setLang, formatNumber } from './i18n.js';
import {
  LAYERS, MATCHA_LAYERS, LEVELS, UPGRADES, UPG, ENDLESS_UNLOCK_LEVEL, MATCHA_LEVEL, ING,
  getLevel, ingName, ingredientValue, ingredientsByLayer, qualityUpgradeCost, nextUpgradeCost, upgradeNeeds, getKitchenStats, unlockedIn,
} from './data.js';
import {
  getSave, onSaveChange, isOwned, levelStars, isLevelUnlocked, isEndlessUnlocked, totalStars,
  upgradeLevel, ingLevel, upgradeLocked, upgradeIngredient, buyUpgrade, setSetting, resetSave,
} from './save.js';
import {
  logoSVG, bowlSVG, ingredientIcon, packIcon, matchaGlassSVG, customerSVG, lookFromSeed, blenderSVG, matchaMachineSVG,
  cupSpotSVG,
  decorSVG, coinSVG, starSVG, heartSVG, clockSVG, lockSVG, titleCounterSVG,
  mapRegionSVG, mapLevelPos, mapRoadData, MAP_H, MAP_BLEED, MAP_REGIONS,
  MATCHA_SLOT_X, MATCHA_SLOT_Y, MATCHA_CUP_SIZE,
} from './art.js';
import { pictureMarkup } from './art3d.js';
import { ICON, INK } from './icons.js';
import { hasHaptics, buzz, HAPTIC } from './haptics.js';
import { blenderLook, BLENDER_MODELS } from './kitchen3d.js';

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
    'map.matcha': 'Matcha',
    'map.time': 'Zeit',
    'map.start': 'Los geht’s!',
    'map.shopHint': 'Du hast {n} Münzen – im Shop wartet etwas Neues!',
    'map.toShop': 'Zum Shop',
    'map.region.beach': 'Am Strand',
    'map.region.town': 'Stadtpromenade',
    'map.region.forest': 'Regenwald',
    'map.region.tea': 'Teeplantage',
    'map.region.harbor': 'Hafen',
    'map.region.night': 'Nachtmarkt',
    'map.regionLevels': 'Level {a}–{b}',
    'map.regionFrom': 'ab Level {n}',
    'map.new': 'Neu',
    'intro.basics.title': 'So geht’s',
    'intro.basics.text': 'Zieh die Açaí-Packung in den Mixer und schalte ihn mit dem Knopf ein. Stell eine leere Bowl vom Stapel hin. Ist die Basis fertig, zieh den Mixkrug auf die Bowl, leg die bestellten Zutaten darauf und bring die Bowl zum Gast.',
    'intro.overflow.title': 'Achtung, Mixer!',
    'intro.overflow.text': 'Ab jetzt wartet ein fertiger Mixer nicht ewig: Lässt du ihn laufen, läuft er über und die Basis verdirbt. Schalte ihn aus, sobald er fertig ist – dann kann er nicht überlaufen, aber die Basis schmilzt nach einer Weile (außer mit dem Freeze-Upgrade). Verdorbenes kommt in den Müll.',
    'intro.crowd.title': 'Großer Andrang',
    'intro.crowd.text': 'Ab jetzt warten immer zwei Gäste gleichzeitig – und manche bestellen dieselbe Bowl zwei- oder dreimal (2× in der Sprechblase). Große Bestellungen haben dafür mehr Geduld.',
    'intro.moreSeats.title': 'Mehr Gäste',
    'intro.moreSeats.text': 'Dein Laden hat jetzt 3 Plätze. Behalte die Geduld aller Gäste im Blick!',
    'intro.matcha.title': 'Matcha!',
    'intro.matcha.text': 'Neu: die Matcha-Maschine mit eigener Matcha-Bar! Zieh eine Frucht aus der Matcha-Bar auf ein Glas: Die Maschine püriert sie und gießt den Matcha darauf. Dann gib ihn dem Gast.',
    'intro.extras.title': 'Matcha-Extras',
    'intro.extras.text': 'Manche Gäste wollen Extras auf ihren Matcha, zum Beispiel Eiswürfel. Extras kommen aufs Glas, sobald die Frucht drin ist – auch während die Maschine noch arbeitet.',
    'map.newIngredients': 'Neue Zutat',
    'intro.endless.title': 'Endlos-Modus',
    'intro.endless.text': 'Alle 30 Sekunden wird es schwerer. Spiel, bis alle Herzen weg sind, und knack deinen Rekord!',
    'intro.fourSeats.title': 'Volles Haus',
    'intro.fourSeats.text': 'Jetzt gibt es 4 Plätze – und dafür 4 Herzen. Mehr Bowl-Plätze und ein zweiter Mixer aus dem Shop helfen dir!',
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
    'shop.boughtUpg': '{name} gekauft!',
    'shop.upgraded': 'Bessere Qualität: {name}!',
    'shop.maxed': 'Schon voll ausgebaut.',
    'shop.locked': 'Ab Level {n}',
    'shop.lockedToast': 'Wird ab Level {n} freigeschaltet.',
    'shop.needs': 'Erst: {name}',
    'shop.needsToast': 'Kauf zuerst „{name}“.',
    'shop.tipTitle': 'Tipp',
    'shop.tipText': 'Neue Zutaten kommen mit den Leveln. Hier machst du sie besser – jede ist sofort in den Bestellungen.',
    'shop.tipQuality': 'Qualität ★: +30 % und +60 % Münzen pro Portion.',
    'shop.notYet': 'Kommt mit Level {n}',
    'shop.stat.cupLift': 'Plätze mit Lift',
    'shop.stat.freeze': 'Mixer mit Freeze',
    'shop.levelOf': 'Stufe {a} von {b}',
    'shop.stat.blendTime': 'Mixzeit',
    'shop.stat.portions': 'Bowls pro Mix',
    'shop.stat.blenders': 'Mixer',
    'shop.stat.bowlSlots': 'Bowl-Plätze',
    'shop.stat.matchaSlots': 'Matcha-Plätze',
    'shop.stat.patience': 'Geduld der Gäste',
    'shop.seconds': '{n} s',
    'shop.percent': '+{n} %',
    'shop.kitchenNow': 'Deine Küche',
    'shop.nextModel': 'Neues Modell: {name}',
    'shop.yourModel': 'Dein Modell: {name}',
    'shop.decorNow': 'Deko macht Gäste geduldiger',
    'settings.title': 'Einstellungen',
    'settings.language': 'Sprache',
    'settings.music': 'Musik',
    'settings.sfx': 'Sounds',
    'settings.haptics': 'Vibration',
    'settings.on': 'An',
    'settings.off': 'Aus',
    'settings.stats': 'Statistik',
    'settings.statPlayed': 'Gespielte Runden',
    'settings.statServed': 'Bediente Gäste',
    'settings.statEarned': 'Verdiente Münzen',
    'settings.statStars': 'Sterne',
    'settings.statBest': 'Endlos-Rekord',
    'settings.campaign': 'Kampagne',
    'settings.levelsWon': '{n} von {max} Level',
    'settings.reset': 'Neues Spiel',
    'settings.resetConfirm': 'Von vorne anfangen? Münzen, Sterne und Einkäufe werden gelöscht.',
    'settings.resetYes': 'Neu starten',
    'settings.resetNo': 'Abbrechen',
    'settings.resetDone': 'Neues Spiel gestartet!',
    'settings.about': 'Über das Spiel',
    'settings.aboutText': 'Açaí Fever ist ein Zeitmanagement-Spiel rund um Açaí-Bowls. Alle Bilder und Klänge entstehen direkt im Browser.',
    'results.won': 'Level {n} geschafft!',
    'results.lost': 'Level {n} verloren',
    'results.endless': 'Spiel vorbei!',
    'results.reasonHearts': 'Keine Herzen mehr – zu viele Gäste sind gegangen.',
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
    'results.allDone': 'Alle {n} Level geschafft!',
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
    'map.matcha': 'Matcha',
    'map.time': 'Time',
    'map.start': 'Let’s go!',
    'map.shopHint': 'You have {n} coins – something new is waiting in the shop!',
    'map.toShop': 'To the shop',
    'map.region.beach': 'On the beach',
    'map.region.town': 'Town promenade',
    'map.region.forest': 'Rainforest',
    'map.region.tea': 'Tea plantation',
    'map.region.harbor': 'Harbour',
    'map.region.night': 'Night market',
    'map.regionLevels': 'Levels {a}–{b}',
    'map.regionFrom': 'from level {n}',
    'map.new': 'New',
    'intro.basics.title': 'How to play',
    'intro.basics.text': 'Drag the açaí pack into the blender and switch it on with its button. Put an empty bowl down from the stack. When the base is ready, drag the blender jug onto the bowl, add the ordered ingredients and hand the bowl to the customer.',
    'intro.overflow.title': 'Watch the blender!',
    'intro.overflow.text': 'From now on a ready blender won’t wait forever: leave it running and it overflows and the base spoils. Switch it off once it’s done – then it can’t overflow, but the base melts after a while (unless you have the freeze upgrade). Spoiled stuff goes in the trash.',
    'intro.crowd.title': 'Rush hour',
    'intro.crowd.text': 'From now on two customers always wait at once – and some order the same bowl two or three times (2× in the speech bubble). Big orders come with more patience.',
    'intro.moreSeats.title': 'More customers',
    'intro.moreSeats.text': 'Your shop now has 3 seats. Keep an eye on everyone’s patience!',
    'intro.matcha.title': 'Matcha!',
    'intro.matcha.text': 'New: the matcha machine with its own matcha bar! Drag a fruit from the matcha bar onto a glass: the machine purées it and pours the matcha on top. Then hand it to the customer.',
    'intro.extras.title': 'Matcha extras',
    'intro.extras.text': 'Some customers want extras on their matcha, like ice cubes. Extras go on the glass once its fruit is in – even while the machine is still working.',
    'map.newIngredients': 'New ingredient',
    'intro.endless.title': 'Endless mode',
    'intro.endless.text': 'It gets harder every 30 seconds. Play until your hearts run out and beat your best score!',
    'intro.fourSeats.title': 'Full house',
    'intro.fourSeats.text': 'Now there are 4 seats – and 4 hearts. More bowl spots and a second blender from the shop will help!',
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
    'shop.boughtUpg': '{name} bought!',
    'shop.upgraded': 'Better quality: {name}!',
    'shop.maxed': 'Already fully upgraded.',
    'shop.locked': 'From level {n}',
    'shop.lockedToast': 'Unlocks at level {n}.',
    'shop.needs': 'First: {name}',
    'shop.needsToast': 'Buy “{name}” first.',
    'shop.tipTitle': 'Tip',
    'shop.tipText': 'New ingredients arrive with the levels. Here you make them better – each shows up in orders right away.',
    'shop.tipQuality': 'Quality ★: +30% and +60% coins per serving.',
    'shop.notYet': 'Arrives with level {n}',
    'shop.stat.cupLift': 'Spots with a lift',
    'shop.stat.freeze': 'Blenders with freeze',
    'shop.levelOf': 'Level {a} of {b}',
    'shop.stat.blendTime': 'Blend time',
    'shop.stat.portions': 'Bowls per batch',
    'shop.stat.blenders': 'Blenders',
    'shop.stat.bowlSlots': 'Bowl spots',
    'shop.stat.matchaSlots': 'Matcha spots',
    'shop.stat.patience': 'Customer patience',
    'shop.seconds': '{n} s',
    'shop.percent': '+{n}%',
    'shop.kitchenNow': 'Your kitchen',
    'shop.nextModel': 'New model: {name}',
    'shop.yourModel': 'Your model: {name}',
    'shop.decorNow': 'Decor makes customers more patient',
    'settings.title': 'Settings',
    'settings.language': 'Language',
    'settings.music': 'Music',
    'settings.sfx': 'Sounds',
    'settings.haptics': 'Vibration',
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
    'settings.reset': 'New game',
    'settings.resetConfirm': 'Start over? Coins, stars and purchases will be deleted.',
    'settings.resetYes': 'Start over',
    'settings.resetNo': 'Cancel',
    'settings.resetDone': 'New game started!',
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
    'results.allDone': 'All {n} levels complete!',
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

const numFmt = (n, maxFrac = 1) => formatNumber(n, maxFrac);
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
// the guest at the counter: a warm mango top that stands out against the purple sunburst
const TITLE_GUEST = { ...lookFromSeed(23), shirt: '#ffb627' };

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
        <div class="title-guest-body">${customerSVG(TITLE_GUEST, 'neutral', 250)}<span class="title-face is-blink">${customerSVG(TITLE_GUEST, 'neutral', 250, true)}</span><span class="title-face is-laugh">${customerSVG(TITLE_GUEST, 'happy', 250)}</span></div>
      </div>
      <div class="title-counter" aria-hidden="true">${titleCounterSVG(360, 200)}</div>
      <div class="title-bowl" aria-hidden="true"><div class="title-bowl-inner">${bowlSVG({ base: 'acai', mid: ['banana', 'strawberry', 'blueberry'], top: ['coconut', 'honey'] }, 240)}</div></div>
      <div class="title-drink" aria-hidden="true">${matchaGlassSVG('mango', 'ready', 120)}</div>
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
        <button class="btn pink title-play btn-shine" type="button" data-action="play">${ICON.play(46)}<span>${esc(t('screen.play'))}</span></button>
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
const MAP_BADGES = { 7: 'matcha', 10: 'endless' };

// The first unlocked level without stars – the one that pulses on the map.
function nextPlayableLevel() {
  const lvl = LEVELS.find((l) => isLevelUnlocked(l.id) && levelStars(l.id) === 0);
  return lvl ? lvl.id : null;
}

function mapBadge(levelId) {
  const kind = MAP_BADGES[levelId];
  if (kind === 'matcha') return `<span class="map-badge">${matchaGlassSVG('strawberry', 'ready', 40)}</span>`;
  if (kind === 'endless') return `<span class="map-badge is-endless">${ICON.endless(34)}</span>`;
  return '';
}

function levelNode(level, index, currentId) {
  const { x, y } = mapLevelPos(index);
  const unlocked = isLevelUnlocked(level.id);
  const stars = levelStars(level.id);
  const state = !unlocked ? 'locked' : level.id === currentId ? 'current' : stars > 0 ? 'done' : 'open';
  const label = unlocked ? t('map.levelAria', { n: level.id, stars }) : t('map.levelLockedAria', { n: level.id });
  return `<button class="map-level is-${state}" type="button" style="left:${x - 55 + MAP_BLEED}px;top:${y - 50}px" data-level="${level.id}" data-state="${state}" aria-label="${esc(label)}"${unlocked ? '' : ' aria-disabled="true"'}>
    <span class="map-disc"><span class="map-num">${level.id}</span>${unlocked ? '' : `<span class="map-lock">${lockSVG(34)}</span>`}</span>
    ${unlocked ? `<span class="map-stars">${repeat(3, (k) => starSVG(k < stars, 26))}</span>` : ''}
    ${mapBadge(level.id)}
  </button>`;
}

function endlessButton(cls = '') {
  const open = isEndlessUnlocked();
  return `<button class="btn small purple ${cls} ${open ? '' : 'is-locked'}" type="button" data-action="endless" aria-disabled="${!open}">${open ? ICON.endless(34) : lockSVG(30)}<span>${esc(t('screen.endless'))}</span></button>`;
}

// A sign at the start of each region (beside its first level): its name and levels, or from which level it opens.
function regionSign(r) {
  const p = mapLevelPos(r.first - 1);
  const open = isLevelUnlocked(r.first);
  const x = (p.x < 640 ? p.x + 250 : p.x - 250) + MAP_BLEED;
  return `<div class="map-sign map-sign-${r.id} ${open ? '' : 'is-locked'}" style="left:${x}px;top:${p.y + 34}px">
    <b>${esc(t(`map.region.${r.id}`))}</b><small>${open ? esc(t('map.regionLevels', { a: r.first, b: r.last })) : `${lockSVG(20)}${esc(t('map.regionFrom', { n: r.first }))}`}</small>
  </div>`;
}

// The player on the map: a pin with a bowl, bobbing over the level that is up next.
function mapAvatar(levelId) {
  const { x, y } = mapLevelPos(levelId - 1);
  return `<div class="map-avatar" style="left:${x + MAP_BLEED}px;top:${y - 64}px" aria-hidden="true"><span class="map-avatar-pin">${bowlSVG({ base: 'acai', mid: ['banana', 'strawberry'], top: ['honey'] }, 58)}</span></div>`;
}

// Drag-to-scroll for a mouse (touch pans natively, a wheel or trackpad scrolls): a press that moves more than a
// few px scrolls the map and swallows the click that follows.
function dragScroll(el, scope) {
  let drag = null;
  scope.listen(el, 'pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag = { y: e.clientY, top: el.scrollTop, moved: false, k: el.getBoundingClientRect().height / el.clientHeight || 1 };
  });
  scope.listen(window, 'pointermove', (e) => {
    if (!drag) return;
    const dy = (e.clientY - drag.y) / drag.k;
    if (!drag.moved && Math.abs(dy) < 6) return;
    drag.moved = true;
    el.scrollTop = drag.top - dy;
  });
  scope.listen(window, 'pointerup', () => {
    if (drag?.moved) {
      const swallow = (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      el.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => el.removeEventListener('click', swallow, { capture: true }), 0);
    }
    drag = null;
  });
}

const map = {
  render(container, params = {}, ctx = {}) {
    const scope = createScope();
    const currentId = nextPlayableLevel();
    const doneCount = currentId ? currentId : LEVELS.length;
    const avatarAt = currentId || LEVELS.filter((l) => isLevelUnlocked(l.id)).pop()?.id || 1;
    container.innerHTML = `
      <div class="map-scroll" data-scroll>
        <div class="map-canvas" style="height:${MAP_H}px">
          ${MAP_REGIONS.map((r) => `<div class="map-region map-region-${r.id} ${isLevelUnlocked(r.first) ? '' : 'is-locked'}" style="top:${r.top}px;height:${r.bottom - r.top}px" aria-hidden="true">${mapRegionSVG(r.id)}</div>`).join('')}
          <svg class="map-path" viewBox="${-MAP_BLEED} 0 ${STAGE_W + 2 * MAP_BLEED} ${MAP_H}" width="${STAGE_W + 2 * MAP_BLEED}" height="${MAP_H}" aria-hidden="true" focusable="false">
            <path d="${mapRoadData(LEVELS.length)}" class="map-road-shadow"/>
            <path d="${mapRoadData(LEVELS.length)}" class="map-road-edge"/>
            <path d="${mapRoadData(LEVELS.length)}" class="map-road"/>
            <path d="${mapRoadData(doneCount)}" class="map-road-done"/>
            <path d="${mapRoadData(LEVELS.length)}" class="map-road-dots"/>
          </svg>
          ${MAP_REGIONS.map(regionSign).join('')}
          <div class="map-nodes">${LEVELS.map((l, i) => levelNode(l, i, currentId)).join('')}</div>
          ${mapAvatar(avatarAt)}
        </div>
      </div>
      ${header({ title: t('map.title'), right: `${starsPill()}${coinsPill()}<button class="btn small lagoon" type="button" data-action="shop">${ICON.shop(34)}<span>${esc(t('screen.shop'))}</span>${shopBadge()}</button>${endlessButton()}` })}`;
    bindCoins(container, scope);

    // open on the level that is up next (or the one asked for), in the middle of the window
    const scroller = container.querySelector('.map-scroll');
    const focusId = params.openLevel || avatarAt;
    const target = mapLevelPos(focusId - 1).y - scroller.clientHeight / 2 + 30;
    scroller.scrollTop = Math.max(0, Math.min(MAP_H - scroller.clientHeight, target));
    dragScroll(scroller, scope);

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

// The blender in the player's model (blenderLook: Turbo-Mixer level and jug) as a 3D picture,
// or the drawn art without WebGL. look overrides the model (shop cards show the next one).
function blenderArt(o, size, look = null, svgOpts = { badge: false }) {
  const model = look || blenderLook(getSave().upgrades);
  return pictureMarkup('blender', { ...model, ...o }, size, () => blenderSVG({ ...svgOpts, ...o, tier: model.tier }, size), o.state === 'overflowing' ? 0.7 : 0.4);
}

// =====================================================================
// Pre-level modal
// =====================================================================
function introArt(key) {
  switch (key) {
    case 'basics':
      // the blender about 1.4 × the cup's height, as in the kitchen (its picture is a square, the tall blender fills
      // its height; css/screens.css .intro-blender trims the empty sides)
      return `<div class="intro-art intro-art-steps">${packIcon('acai', 54)}<i></i><span class="intro-blender">${blenderArt({ state: 'ready', base: 'acai', portions: 2, maxPortions: 2 }, 90, null, {})}</span><i></i>${bowlSVG(null, 60)}<i></i>${bowlSVG({ base: 'acai', mid: ['banana'], top: ['honey'] }, 70)}</div>`;
    case 'overflow':
      return `<div class="intro-art">${blenderArt({ state: 'overflowing', base: 'acai', portions: 2, maxPortions: 2 }, 136, null, {})}</div>`;
    case 'crowd':
      return `<div class="intro-art intro-art-crowd">${repeat(2, (i) => customerSVG(31 + i * 7, 'happy', 62))}<span class="intro-qty">${bowlSVG({ base: 'acai', mid: ['banana', 'strawberry'], top: ['honey'] }, 66)}<b>2×</b></span></div>`;
    case 'matcha':
      return `<div class="intro-art">${matchaMachineArt(140, ['mStrawberry'], true)}</div>`;
    case 'extras':
      return `<div class="intro-art intro-art-steps">${ingredientIcon('ice', 54)}<i></i>${matchaGlassSVG('mBanana', 'ready', 92, { extras: ['ice'] })}</div>`;
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

// The ingredients a level brings (none for the first: those are the start), with their icons and names.
function newIngredientsMarkup(levelId) {
  const ids = levelId > 1 ? unlockedIn(levelId) : [];
  if (!ids.length) return '';
  const items = ids.map((id) => `<span class="prelevel-new-item">${ING[id].layer === 'base' ? packIcon(id, 52) : ingredientIcon(id, 52)}<b>${esc(ingName(id))}</b></span>`).join('');
  return `<div class="prelevel-new" data-new-ingredients="${ids.join(' ')}"><span class="sc-new">${esc(t('map.new'))}</span><span class="prelevel-new-label">${esc(t('map.newIngredients'))}</span>${items}</div>`;
}

// Something in the shop the player can afford right now?
function affordableCount() {
  const coins = getSave().coins;
  let n = 0;
  for (const layer of [...LAYERS, ...MATCHA_LAYERS]) {
    for (const ing of ingredientsByLayer(layer)) {
      const cost = isOwned(ing.id) ? qualityUpgradeCost(ing.id, ingLevel(ing.id)) : null;
      if (cost !== null && cost <= coins) n++;
    }
  }
  for (const u of UPGRADES) {
    const cost = nextUpgradeCost(u.id, getSave().upgrades);
    if (!upgradeLocked(u.id) && cost !== null && cost <= coins && !upgradeNeeds(u.id, getSave().upgrades)) n++;
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
        ${level.id >= MATCHA_LEVEL ? `<span class="sc-chip">${matchaGlassSVG('mStrawberry', 'ready', 36)}<b>${esc(t('map.matcha'))}</b></span>` : ''}
      </div>
      ${newIngredientsMarkup(level.id)}
      ${level.intro ? `<div class="prelevel-intro intro-${level.intro}">
        ${introArt(level.intro)}
        <div class="prelevel-intro-text"><h4><span class="sc-new">${esc(t('map.new'))}</span>${esc(t(`intro.${level.intro}.title`))}</h4><p>${esc(t(`intro.${level.intro}.text`))}</p></div>
      </div>` : ''}
      ${showHint ? `<div class="prelevel-hint">${coinSVG(40)}<p>${esc(t('map.shopHint', { n: coinsText(getSave().coins) }))}</p>
        <button class="btn small lagoon" type="button" data-action="shop">${ICON.shop(30)}<span>${esc(t('map.toShop'))}</span></button></div>` : ''}
      <div class="prelevel-actions">
        <button class="btn green prelevel-start btn-shine" type="button" data-action="start">${ICON.play(40)}<span>${esc(t('map.start'))}</span></button>
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
  if (tab === 'kitchen') return blenderArt({ state: 'ready', base: 'acai', portions: 2, maxPortions: 2 }, 44);
  return decorSVG('plants', 44, { wall: false });
}

function priceButton({ kind, id, price, label, upgrade = false }) {
  const afford = getSave().coins >= price;
  return `<button class="btn small sc-price ${upgrade ? 'lagoon' : ''} ${afford ? '' : 'is-poor'}" type="button" data-buy="${kind}" data-id="${id}" aria-disabled="${!afford}" aria-label="${esc(label)}">`
    + `${upgrade ? `<span class="sc-price-up">${starSVG(true, 24)}</span>` : ''}${coinSVG(26)}<span>${coinsText(price)}</span></button>`;
}

// An ingredient: arrived ones can be made better (quality stars), the others say which level brings them.
function ingredientCard(ing) {
  const owned = isOwned(ing.id);
  const q = ingLevel(ing.id);
  const price = owned ? qualityUpgradeCost(ing.id, q) : null;
  const state = !owned ? 'locked' : price === null ? 'max' : 'upgrade';
  const name = ingName(ing.id);
  const value = ingredientValue(ing.id, getSave().ingLevels);
  let action;
  if (state === 'max') action = `<div class="sc-maxed">${starSVG(true, 22)}${starSVG(true, 22)}<span>${esc(t('shop.max'))}</span></div>`;
  else if (state === 'locked') action = `<div class="sc-price is-locked sc-not-yet">${lockSVG(24)}<span>${esc(t('shop.notYet', { n: ing.unlock }))}</span></div>`;
  else action = priceButton({ kind: 'ing', id: ing.id, price, upgrade: true, label: t('shop.upgradeAria', { name, n: price }) });
  return `<article class="shop-card ing-card is-${state}" data-card="${ing.id}" data-shop-item="${ing.id}" data-state="${state}">
    ${owned ? `<span class="card-quality" role="img" aria-label="${esc(t('shop.qualityAria', { n: q }))}">${starSVG(q >= 1, 22)}${starSVG(q >= 2, 22)}</span>` : ''}
    <div class="card-icon">${ing.layer === 'base' ? packIcon(ing.id, 68) : ingredientIcon(ing.id, 64)}${MATCHA_LAYERS.includes(ing.layer) ? `<span class="card-matcha" title="${esc(t('map.matcha'))}">${matchaGlassSVG(ing.layer === 'mfruit' ? ing.id : 'mStrawberry', 'ready', 30, { extras: ing.layer === 'mextra' ? [ing.id] : [] })}</span>` : ''}</div>
    <h3 class="card-name">${esc(name)}</h3>
    <p class="card-value">${coinSVG(20)}<b>${numFmt(value)}</b><span>${esc(t('shop.perUse'))}</span></p>
    ${action}
  </article>`;
}

// part(key, html) returns what stands in the tab's markup for a card or the summary (see tabParts).
function ingredientsTab(part = (key, html) => html) {
  return [...LAYERS, ...MATCHA_LAYERS].map((layer) => {
    const items = ingredientsByLayer(layer);
    const owned = items.filter((i) => isOwned(i.id)).length;
    const tip = layer === 'base' ? `<aside class="shop-tip">
        <div class="shop-tip-art">${bowlSVG({ base: 'pitaya', mid: ['mango', 'kiwi'], top: ['coconut', 'chia'] }, 112)}</div>
        <div><h3>${esc(t('shop.tipTitle'))}</h3><p>${esc(t('shop.tipText'))}</p><p>${esc(t('shop.tipQuality'))}</p></div>
      </aside>` : '';
    const num = LAYER_NUM[layer] ? `<span class="shop-row-num">${LAYER_NUM[layer]}</span>` : `<span class="shop-row-num is-matcha">${matchaGlassSVG('mStrawberry', 'ready', 26)}</span>`;
    return `<section class="shop-row shop-row-${layer}" aria-label="${esc(t(`layer.${layer}`))}">
      <div class="shop-row-label">${num}<span class="shop-row-name">${esc(t(`layer.${layer}`))}</span><span class="shop-row-count">${owned}/${items.length}</span></div>
      <div class="shop-row-cards">${items.map((ing) => part(ing.id, ingredientCard(ing))).join('')}${tip}</div>
    </section>`;
  }).join('');
}

const STAT_SPEC = {
  blenderSpeed: { key: 'blendTime', fmt: (v) => t('shop.seconds', { n: numFmt(v) }) },
  jug: { key: 'portions', fmt: (v) => numFmt(v) },
  blender2: { key: 'blenders', fmt: (v) => numFmt(v) },
  bowlSlots: { key: 'bowlSlots', fmt: (v) => numFmt(v) },
  matchaSlots: { key: 'matchaSlots', fmt: (v) => numFmt(v) },
  cupLift: { key: 'cupLift', fmt: (v) => numFmt(v) },
  freeze: { key: 'freeze', fmt: (v) => numFmt(v) },
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

// The matcha machine with a ready glass per fruit (one fruit: the one-slot machine of level 7).
// crop: the size×size square shows only the one-slot machine (MACHINE_CROP of its 312 px canvas: x, y,
// side), so it fills the picture instead of standing small in the canvas's empty sides.
const MACHINE_CROP = [29, 38, 254];
function matchaMachineArt(size, fruits = ['mStrawberry', 'mMango'], crop = false) {
  const full = crop ? Math.round((size * 312) / MACHINE_CROP[2]) : size;
  const glass = Math.round(full * MATCHA_CUP_SIZE);
  const xs = MATCHA_SLOT_X[fruits.length];
  const machine = pictureMarkup('machine', { slots: fruits.map((fruit) => ({ state: 'ready', fruit })) }, full, () => matchaMachineSVG(fruits.length, full));
  const art = `<div class="upg-machine" style="width:${full}px;height:${full}px">${machine}${xs.map((fx, i) =>
    `<span style="left:${Math.round(fx * full - glass / 2)}px;top:${Math.round(MATCHA_SLOT_Y * full - glass)}px">${matchaGlassSVG(fruits[i], 'ready', glass)}</span>`).join('')}</div>`;
  if (!crop) return art;
  const [x, y] = MACHINE_CROP.map((v) => Math.round((v * full) / 312));
  return `<div class="upg-machine-crop" style="width:${size}px;height:${size}px"><div style="left:${-x}px;top:${-y}px">${art}</div></div>`;
}

// The cup lift: a cup rising out of the steel hatch of a spot, an arrow showing it goes up.
function cupLiftArt() {
  return `<div class="upg-art-lift">
    <span class="upg-lift-spot">${cupSpotSVG(120)}</span>
    <span class="upg-lift-hatch"></span>
    <span class="upg-lift-cup">${bowlSVG(null, 120)}</span>
    <span class="upg-lift-arrow"><svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true"><path d="M20 5L35 21H26V35H14V21H5Z" fill="#ffb627" stroke="#2a1236" stroke-width="3" stroke-linejoin="round"/></svg></span>
  </div>`;
}

// The freeze blender: a ready jug, switched off, in a frosty glow with the snowflake.
function freezeArt() {
  return `<div class="upg-art-freeze">${blenderArt({ state: 'ready', base: 'acai', portions: 2, maxPortions: 2, on: false }, 170)}<span class="upg-snow"><svg viewBox="0 0 40 40" width="54" height="54" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="#e9f8ff" stroke="#2a1236" stroke-width="2.6"/><g stroke="#2f9fd8" stroke-width="3" stroke-linecap="round" fill="none"><path d="M20 8v24M9.6 14l20.8 12M9.6 26l20.8-12"/><path d="M16.5 10.5L20 13.5l3.5-3M16.5 29.5L20 26.5l3.5 3"/></g></svg></span></div>`;
}

function upgradeArt(id) {
  switch (id) {
    case 'blenderSpeed': {
      // every Turbo-Mixer level is a new blender model: the card shows the one you get next
      const lvl = upgradeLevel('blenderSpeed');
      const tier = Math.min(UPG.blenderSpeed.levels.length, lvl + 1);
      const look = { ...blenderLook(getSave().upgrades), tier };
      const label = t(lvl < UPG.blenderSpeed.levels.length ? 'shop.nextModel' : 'shop.yourModel', { name: BLENDER_MODELS[tier] });
      return `<div class="upg-art-speed">${blenderArt({ state: 'blending', base: 'acai', progress: 0.7, remaining: 2 }, 180, look)}<span class="upg-bolt">${ICON.bolt(46)}</span><span class="upg-model">${esc(label)}</span></div>`;
    }
    case 'jug':
      return blenderArt({ state: 'ready', base: 'pitaya', portions: 3, maxPortions: 3 }, 180, { ...blenderLook(getSave().upgrades), big: true });
    case 'blender2':
      return `<div class="upg-art-pair">${blenderArt({ state: 'ready', base: 'acai', portions: 2, maxPortions: 2 }, 128)}${blenderArt({ state: 'blending', base: 'spirulina', progress: 0.45, remaining: 3 }, 128)}</div>`;
    case 'bowlSlots':
      return `<div class="upg-art-bowls">${bowlSVG({ base: 'acai', mid: ['banana'], top: ['honey'] }, 104)}${bowlSVG(null, 104)}${bowlSVG({ base: 'pitaya', mid: ['strawberry'], top: [] }, 104)}</div>`;
    case 'matchaSlots':
      return matchaMachineArt(172);
    case 'cupLift':
      return cupLiftArt();
    case 'freeze':
      return freezeArt();
    default:
      return decorSVG(id, 230, { wall: false });
  }
}

function upgradeCard(u) {
  const lvl = upgradeLevel(u.id);
  const max = u.levels.length;
  const locked = upgradeLocked(u.id);
  const cost = nextUpgradeCost(u.id, getSave().upgrades);
  const needs = cost === null ? null : upgradeNeeds(u.id, getSave().upgrades);
  const state = locked ? 'locked' : cost === null ? 'max' : needs ? 'needs' : 'buy';
  const name = t(`upg.${u.id}`);
  let action;
  if (state === 'needs') {
    // the next spot's lift or the second blender's freeze: the spot or blender itself first
    action = `<button class="btn small cream sc-price is-locked sc-not-yet" type="button" data-buy="upg" data-id="${u.id}" aria-disabled="true">${lockSVG(24)}<span>${esc(t('shop.needs', { name: t(`upg.${needs.id}`) }))}</span></button>`;
  } else if (state === 'locked') {
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
    ${item(blenderArt({ state: 'blending', base: 'acai', progress: 0.5, remaining: 3 }, 50), t('shop.stat.blendTime'), t('shop.seconds', { n: numFmt(k.blendTime) }))}
    ${item(blenderArt({ state: 'ready', base: 'pitaya', portions: k.portions, maxPortions: k.portions }, 50), t('shop.stat.portions'), numFmt(k.portions))}
    ${item(blenderArt({ state: 'empty', base: 'acai' }, 50), t('shop.stat.blenders'), numFmt(k.blenders))}
    ${item(bowlSVG(null, 50), t('shop.stat.bowlSlots'), numFmt(k.bowlSlots))}
    ${item(matchaGlassSVG('mango', 'ready', 46), t('shop.stat.matchaSlots'), numFmt(k.matchaSlots))}
  </div>`;
}

function decorSummary() {
  const k = getKitchenStats(getSave().upgrades);
  const pct = Math.round((k.patienceMult - 1) * 100);
  return `<div class="shop-summary panel"><h3>${esc(t('shop.decorNow'))}</h3>
    <span class="shop-sum-item">${heartSVG(true, 46)}<span><small>${esc(t('shop.stat.patience'))}</small><b>${esc(t('shop.percent', { n: pct }))}</b></span></span>
  </div>`;
}

function upgradesTab(cat, part = (key, html) => html) {
  const list = UPGRADES.filter((u) => u.cat === cat);
  return `${part('summary', cat === 'kitchen' ? kitchenSummary() : decorSummary())}
    <div class="upg-grid upg-grid-${cat}">${list.map((u) => part(u.id, upgradeCard(u))).join('')}</div>`;
}

// A tab as its frame (rows, labels, grids) with a placeholder per card and summary, and their markup by key.
// A purchase changes a few cards only (the one bought, prices that became too dear): the shop replaces just
// those instead of the ~3000 nodes and ~140 pictures of a whole tab, which made every tap lag on phones.
function tabParts(tab) {
  const parts = new Map();
  const part = (key, html) => {
    parts.set(key, html);
    return `<!--part:${key}-->`;
  };
  const frame = tab === 'ingredients' ? ingredientsTab(part) : upgradesTab(tab, part);
  return { tab, frame, parts };
}
const partSelector = (key) => (key === 'summary' ? '.shop-summary' : `[data-card="${key}"]`);

// A purchase redraws its card in place, so the next price button of the same card (for a new
// ingredient: its quality upgrade) appears right under the finger. For this long after a
// purchase the card ignores further clicks; the button shows it (.is-bought .sc-price, 0.5 s).
const BUY_COOLDOWN_MS = 500;

const shop = {
  render(container, params = {}, ctx = {}) {
    const scope = createScope();
    let tab = SHOP_TABS.includes(params.tab) ? params.tab : 'ingredients';
    let lastBuy = { id: null, at: -Infinity };
    container.innerHTML = `
      <div class="shop-awning" aria-hidden="true">${awningSVG(STAGE_W + 2 * 384)}</div>
      ${header({ title: t('shop.title'), right: coinsPill() })}
      <div class="sc-tabs shop-tabs" role="tablist" aria-label="${esc(t('shop.title'))}">${SHOP_TABS.map((id) =>
        `<button class="sc-tab" type="button" role="tab" id="shop-tab-${id}" data-tab="${id}" aria-controls="shop-panel">${tabIcon(id)}<span>${esc(t(`shop.tab.${id}`))}</span></button>`).join('')}</div>
      <div class="shop-body" id="shop-panel" role="tabpanel" data-scroll></div>`;
    const body = container.querySelector('.shop-body');
    let shown = null; // tabParts() of what the body shows
    bindCoins(container, scope);
    dragScroll(body, scope);
    // Any save change (purchase, coins from elsewhere) refreshes prices and states.
    scope.add(onSaveChange(() => draw()));

    const draw = () => {
      // Redrawing replaces the cards – keep keyboard focus on the same card.
      const focusedCard = body.contains(document.activeElement) ? document.activeElement.closest('[data-card]')?.dataset.card : null;
      const next = tabParts(tab);
      if (shown && shown.tab === tab && shown.frame === next.frame) {
        for (const [key, html] of next.parts) {
          if (html === shown.parts.get(key)) continue;
          const old = body.querySelector(partSelector(key));
          const tpl = document.createElement('template');
          tpl.innerHTML = html;
          old?.replaceWith(tpl.content);
        }
      } else {
        if (shown?.tab !== tab) body.scrollTop = 0;
        body.dataset.tab = tab;
        body.setAttribute('aria-labelledby', `shop-tab-${tab}`);
        body.innerHTML = next.frame.replace(/<!--part:([\w-]+)-->/g, (m, key) => next.parts.get(key));
      }
      shown = next;
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

    const purchase = (btn, e) => {
      const { buy: kind, id } = btn.dataset;
      const now = performance.now();
      // The second click of a double tap / double click (detail ≥ 2) or a quick second tap lands
      // on the redrawn button of the card just bought: swallow it silently (no reject either).
      if (id === lastBuy.id && ((e?.detail ?? 0) > 1 || now - lastBuy.at < BUY_COOLDOWN_MS)) return;
      const card = btn.closest('.shop-card');
      const res = kind === 'ing' ? upgradeIngredient(id) : buyUpgrade(id);
      if (!res.ok) {
        sfx(ctx, 'reject');
        shake(card);
        const msg = res.reason === 'noMoney' ? t('shop.noMoney')
          : res.reason === 'locked' ? t('shop.lockedToast', { n: UPG[id]?.requiresLevel ?? MATCHA_LEVEL })
            : res.reason === 'needs' ? t('shop.needsToast', { name: t(`upg.${upgradeNeeds(id, getSave().upgrades)?.id}`) })
            : res.reason === 'notOwned' ? t('shop.notYet', { n: ING[id]?.unlock ?? 1 })
            : t('shop.maxed');
        showToast(container, scope, msg, { anchor: btn });
        return;
      }
      lastBuy = { id, at: now };
      sfx(ctx, 'purchase'); // the save listener below has already redrawn the cards
      const fresh = body.querySelector(`[data-card="${id}"]`);
      if (fresh) {
        restartClass(fresh, 'is-bought');
        burst(container, scope, fresh);
      }
      const name = kind === 'ing' ? ingName(id) : t(`upg.${id}`);
      const msg = kind === 'upg' ? t('shop.boughtUpg', { name }) : t('shop.upgraded', { name });
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
    // Holding Enter repeats the click on the focused price button (focus stays on the redrawn
    // card), which would buy level after level – only the first key press counts.
    scope.listen(body, 'keydown', (e) => {
      if (e.repeat && e.key === 'Enter' && e.target.closest?.('[data-buy]')) e.preventDefault();
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
          ${hasHaptics() ? `<div class="settings-row">
            <span class="settings-label" id="settings-haptics-label">${ICON.vibrate(36)}<span>${esc(t('settings.haptics'))}</span></span>
            ${switchButton('haptics', s.haptics !== false, 'settings-haptics-label')}
          </div>` : ''}
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
        ? `<button class="btn small cream settings-reset-btn" type="button" data-action="reset">${ICON.retry(32)}<span>${esc(t('settings.reset'))}</span></button>`
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
        else if (key === 'sfx') ctx.audio?.setSfx?.(on);
        else if (key === 'haptics' && on) buzz(HAPTIC.pay);
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
        setSetting('haptics', keep.haptics);
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
  if (r.mode === 'campaign' && r.result === 'won' && r.levelId >= LEVELS.length) notes.push(['all', starSVG(true, 28), t('results.allDone', { n: LEVELS.length })]);
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
  if (hasNext) out.push(btn('next', 'green results-next btn-shine', ICON.next(34), t('results.next')));
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
