// Gameplay screen (docs/DESIGN.md §4.6 / §4.7). Builds the level DOM once, then one
// requestAnimationFrame loop ticks the engine and patches only what changed.
// Every player action is a drag & drop through js/drag.js.

import { INGREDIENTS, LEVELS, SMOOTHIE_LEVEL, getLevel, ingName } from './data.js';
import { registerStrings, t, onLangChange, getLang, formatNumber } from './i18n.js';
import {
  createGame, tick, drainEvents, setPaused, releaseTutorialHold, endRun, bowlMatchesOrder,
  loadBlender, pourBlender, addIngredient, trashBowl, cleanBlender, placeCup,
  loadSmoothie, trashSmoothie, serveBowl, serveSmoothie,
  loadBlenderError, pourError, addIngredientError, loadSmoothieError, serveBowlError, serveSmoothieError, placeCupError,
} from './engine.js';
import {
  ingredientIcon, packIcon, bowlSVG, cupSVG, binSVG, scoopSVG, cupStackSVG, cupSpotSVG, customerSVG, lookFromSeed, blenderSVG,
  smoothieMachineSVG, SMOOTHIE_SLOT_X, SMOOTHIE_SLOT_Y, SMOOTHIE_CUP_SIZE,
  trashSVG, coinSVG, heartSVG, starSVG, clockSVG, lockSVG, decorSVG, shopSceneSVG,
} from './art.js';
import { createDragManager } from './drag.js';
import defaultAudio from './audio.js';
import {
  getSave, kitchenStats, recordLevelResult, recordEndless, markIntroSeen, setSetting,
} from './save.js';

// ------------------------------------------------------------------ strings
registerStrings({
  de: {
    'game.level': 'Level {n}',
    'game.endless': 'Endlos',
    'game.stage': 'Stufe {n}',
    'game.best': 'Rekord: {n}',
    'game.noBest': 'Erster Versuch',
    'game.newBest': 'Neuer Rekord!',
    'game.closed': 'Ladenschluss',
    'game.closingBanner': 'Ladenschluss!',
    'game.closingText': 'Keine neuen Gäste mehr – bediene die letzten!',
    'game.goal': 'Verdiene {n} Münzen!',
    'game.pause': 'Pause',
    'game.resume': 'Weiter',
    'game.restart': 'Neu starten',
    'game.quitMap': 'Zur Karte',
    'game.quitTitle': 'Zum Titel',
    'game.endShift': 'Schicht beenden',
    'game.quitLoses': 'Neu starten oder verlassen: Die Münzen dieser Runde gehen verloren.',
    'game.music': 'Musik',
    'game.sfx': 'Sounds',
    'game.on': 'An',
    'game.off': 'Aus',
    'game.stamp.won': 'Geschafft!',
    'game.stamp.lost': 'Nicht geschafft',
    'game.stamp.endless': 'Schicht vorbei!',
    'game.reason.hearts': 'Zu viele Gäste sind gegangen.',
    'game.reason.goal': 'Das Münz-Ziel wurde nicht erreicht.',
    'game.endlessScore': '{n} Münzen verdient',
    'game.new': 'NEU',
    'game.plus': '+{n}',
    'game.tip': '+{n} Trinkgeld',
    'game.served': 'Bedient',
    'game.order': 'Bestellung',
    'game.trash': 'Mülleimer',
    'game.stack': 'Stapel mit leeren Bowls',
    'game.stackName': 'Bowls',
    'game.freezer': 'Basis',
    'game.lockedSmoothie': 'Smoothies ab Level {n}',
    'game.banner.overflow': 'Achtung: Ein fertiger Mixer läuft über, wenn er zu lange steht! Verdorbene Mixer ziehst du in den Müll.',
    'game.banner.moreSeats': 'Jetzt gibt es 3 Plätze – mehr Gäste gleichzeitig!',
    'game.banner.smoothie': 'Neu: die Smoothie-Maschine! Zieh eine Frucht hinein und den fertigen Becher zum Gast.',
    'game.banner.fourSeats': '4 Plätze – jetzt wird es richtig voll!',
    'game.banner.endless': 'Der Endlos-Modus ist freigeschaltet – probier ihn nach diesem Level aus!',
    'game.banner.endlessMode': 'Jede halbe Minute wird es schneller. Wie lange hältst du durch?',
    'game.banner.stageUp': 'Stufe {n}!',
    'game.banner.stageUpText': 'Mehr Gäste, weniger Geduld!',
    'game.hint.pack': 'Zieh die Packung in den Mixer!',
    'game.hint.bin': 'Zieh die Zutat auf eine Bowl!',
    'game.hint.bowl': 'Zieh die Bowl zu einem Gast!',
    'game.hint.bowlEmpty': 'Zieh einen fertigen Mixer auf die Bowl!',
    'game.hint.noCup': 'Zieh eine leere Bowl vom Stapel hierher!',
    'game.hint.stack': 'Zieh eine leere Bowl auf einen freien Platz!',
    'game.hint.blender': 'Zieh den Mixer auf eine leere Bowl!',
    'game.hint.blenderEmpty': 'Zieh eine Basis-Packung in den Mixer!',
    'game.hint.blenderRuined': 'Verdorben! Zieh den Mixer in den Müll.',
    'game.hint.cup': 'Zieh den Smoothie zu einem Gast!',
    'game.hint.slotEmpty': 'Zieh eine Frucht in die Maschine!',
    'game.hint.trash': 'Zieh Falsches hierher, um es wegzuwerfen.',
    'game.tut.title': 'So geht’s',
    'game.tut.welcome': 'Willkommen in deinem Açaí-Laden! Gleich kommt dein erster Gast.',
    'game.tut.pack': 'Zieh die {base}-Packung in den Mixer!',
    'game.tut.wait': 'Der Mixer mixt … einen Moment!',
    'game.tut.waitWrong': 'Das ist die falsche Basis. Warte, bis der Mixer fertig ist.',
    'game.tut.cup': 'Stell eine leere Bowl hin: Zieh sie vom Stapel auf den freien Platz!',
    'game.tut.cupWait': 'Der Mixer mixt noch – stell schon mal eine leere Bowl hin!',
    'game.tut.pour': 'Fertig! Zieh den Mixer auf die leere Bowl.',
    'game.tut.add': 'Zieh jetzt {ing} auf die Bowl – schau in die Sprechblase!',
    'game.tut.addTop': 'Toppings kommen zum Schluss: Zieh {ing} auf die Bowl!',
    'game.tut.trash': 'Ups, das passt nicht zur Bestellung. Wirf die Bowl in den Müll.',
    'game.tut.clean': 'Diese Basis brauchst du nicht. Zieh den Mixer in den Müll.',
    'game.tut.serve': 'Perfekt! Gib die Bowl deinem Gast.',
    'game.tut.done': 'Super gemacht! Behalte den Geduldsbalken deiner Gäste im Blick – wer zu lange wartet, geht.',
    'game.tut.go': 'Los geht’s!',
    'game.aria.pause': 'Spiel pausieren',
    'game.aria.hearts': '{n} von {max} Herzen',
    'game.aria.money': '{n} Münzen',
    'game.aria.time': 'Zeit',
    'reason.needBase': 'Erst die Basis aus dem Mixer!',
    'reason.noCup': 'Stell erst eine leere Bowl hin – vom Stapel!',
    'reason.cupThere': 'Hier steht schon eine Bowl!',
    'reason.toppingsOnTop': 'Erst Früchte & Crunch, dann Toppings & Soßen!',
    'reason.alreadyAdded': 'Ist schon drin!',
    'reason.bowlFull': 'Die Bowl ist voll!',
    'reason.blenderBusy': 'Der Mixer ist noch belegt!',
    'reason.blenderNotReady': 'Der Mixer ist noch nicht fertig!',
    'reason.blenderRuined': 'Verdorben! Ab in den Müll damit.',
    'reason.bowlHasBase': 'Die Bowl hat schon eine Basis!',
    'reason.notOwned': 'Diese Zutat hast du noch nicht.',
    'reason.wrongLayer': 'Nur Basis-Packungen kommen in den Mixer!',
    'reason.packToBlender': 'Die Packung kommt zuerst in den Mixer!',
    'reason.wrongOrder': 'Das hat der Gast nicht bestellt!',
    'reason.bowlIncomplete': 'Da fehlt noch etwas – schau in die Sprechblase!',
    'reason.noSmoothieWanted': 'Dieser Gast möchte keinen Smoothie.',
    'reason.noBowlWanted': 'Dieser Gast möchte keine Bowl.',
    'reason.alreadyDelivered': 'Das hat der Gast schon bekommen!',
    'reason.slotBusy': 'Hier steht schon ein Smoothie!',
    'reason.notReady': 'Der Smoothie ist noch nicht fertig!',
    'reason.notSmoothieFruit': 'Daraus wird kein Smoothie!',
    'reason.emptyBowl': 'Die Bowl ist noch leer!',
    'reason.noCustomer': 'Dieser Gast ist schon weg.',
    'reason.notPlaying': 'Gerade nicht möglich.',
    'reason.invalid': 'Das passt hier nicht.',
  },
  en: {
    'game.level': 'Level {n}',
    'game.endless': 'Endless',
    'game.stage': 'Stage {n}',
    'game.best': 'Best: {n}',
    'game.noBest': 'First try',
    'game.newBest': 'New best!',
    'game.closed': 'Closed',
    'game.closingBanner': 'Closing time!',
    'game.closingText': 'No new customers – serve the last ones!',
    'game.goal': 'Earn {n} coins!',
    'game.pause': 'Paused',
    'game.resume': 'Continue',
    'game.restart': 'Restart',
    'game.quitMap': 'Quit to map',
    'game.quitTitle': 'Quit to title',
    'game.endShift': 'End shift',
    'game.quitLoses': 'Restart or quit and the coins from this round are lost.',
    'game.music': 'Music',
    'game.sfx': 'Sounds',
    'game.on': 'On',
    'game.off': 'Off',
    'game.stamp.won': 'Level complete!',
    'game.stamp.lost': 'Level failed',
    'game.stamp.endless': 'Shift over!',
    'game.reason.hearts': 'Too many customers left.',
    'game.reason.goal': 'The coin goal was not reached.',
    'game.endlessScore': '{n} coins earned',
    'game.new': 'NEW',
    'game.plus': '+{n}',
    'game.tip': '+{n} tip',
    'game.served': 'Served',
    'game.order': 'Order',
    'game.trash': 'Trash can',
    'game.stack': 'Stack of empty bowls',
    'game.stackName': 'Bowls',
    'game.freezer': 'Base',
    'game.lockedSmoothie': 'Smoothies from level {n}',
    'game.banner.overflow': 'Careful: a ready blender overflows if it waits too long! Drag spoiled blenders to the trash.',
    'game.banner.moreSeats': 'Now there are 3 seats – more customers at once!',
    'game.banner.smoothie': 'New: the smoothie machine! Drag a fruit into it, then the finished cup to the customer.',
    'game.banner.fourSeats': '4 seats – now it gets really busy!',
    'game.banner.endless': 'Endless mode is unlocked – try it after this level!',
    'game.banner.endlessMode': 'Every half minute it gets faster. How long can you last?',
    'game.banner.stageUp': 'Stage {n}!',
    'game.banner.stageUpText': 'More customers, less patience!',
    'game.hint.pack': 'Drag the pack into the blender!',
    'game.hint.bin': 'Drag the ingredient onto a bowl!',
    'game.hint.bowl': 'Drag the bowl to a customer!',
    'game.hint.bowlEmpty': 'Drag a ready blender onto the bowl!',
    'game.hint.noCup': 'Drag an empty bowl from the stack here!',
    'game.hint.stack': 'Drag an empty bowl to a free spot!',
    'game.hint.blender': 'Drag the blender onto an empty bowl!',
    'game.hint.blenderEmpty': 'Drag a base pack into the blender!',
    'game.hint.blenderRuined': 'Spoiled! Drag the blender to the trash.',
    'game.hint.cup': 'Drag the smoothie to a customer!',
    'game.hint.slotEmpty': 'Drag a fruit into the machine!',
    'game.hint.trash': 'Drag mistakes here to throw them away.',
    'game.tut.title': 'How to play',
    'game.tut.welcome': 'Welcome to your açaí shop! Your first customer is on the way.',
    'game.tut.pack': 'Drag the {base} pack into the blender!',
    'game.tut.wait': 'The blender is mixing … one moment!',
    'game.tut.waitWrong': 'That’s the wrong base. Wait until the blender is done.',
    'game.tut.cup': 'Put an empty bowl down: drag it from the stack to the free spot!',
    'game.tut.cupWait': 'The blender is still mixing – put an empty bowl down meanwhile!',
    'game.tut.pour': 'Done! Drag the blender onto the empty bowl.',
    'game.tut.add': 'Now drag the {ing} onto the bowl – check the speech bubble!',
    'game.tut.addTop': 'Toppings go on last: drag the {ing} onto the bowl!',
    'game.tut.trash': 'Oops, that doesn’t match the order. Drop the bowl in the trash.',
    'game.tut.clean': 'You don’t need this base. Drag the blender to the trash.',
    'game.tut.serve': 'Perfect! Hand the bowl to your customer.',
    'game.tut.done': 'Well done! Keep an eye on the patience bar – customers who wait too long will leave.',
    'game.tut.go': 'Let’s go!',
    'game.aria.pause': 'Pause game',
    'game.aria.hearts': '{n} of {max} hearts',
    'game.aria.money': '{n} coins',
    'game.aria.time': 'Time',
    'reason.needBase': 'Base from the blender first!',
    'reason.noCup': 'Put an empty bowl down first – from the stack!',
    'reason.cupThere': 'There’s already a bowl here!',
    'reason.toppingsOnTop': 'First Fruits & Crunch, then Toppings & Sauces!',
    'reason.alreadyAdded': 'Already in there!',
    'reason.bowlFull': 'The bowl is full!',
    'reason.blenderBusy': 'The blender is still busy!',
    'reason.blenderNotReady': 'The blender isn’t ready yet!',
    'reason.blenderRuined': 'Spoiled! Into the trash with it.',
    'reason.bowlHasBase': 'This bowl already has a base!',
    'reason.notOwned': 'You don’t own this ingredient yet.',
    'reason.wrongLayer': 'Only base packs go into the blender!',
    'reason.packToBlender': 'The pack goes into the blender first!',
    'reason.wrongOrder': 'That’s not what they ordered!',
    'reason.bowlIncomplete': 'Something’s still missing – check the bubble!',
    'reason.noSmoothieWanted': 'This customer doesn’t want a smoothie.',
    'reason.noBowlWanted': 'This customer doesn’t want a bowl.',
    'reason.alreadyDelivered': 'They already have that!',
    'reason.slotBusy': 'There’s already a smoothie here!',
    'reason.notReady': 'The smoothie isn’t ready yet!',
    'reason.notSmoothieFruit': 'That doesn’t make a smoothie!',
    'reason.emptyBowl': 'The bowl is still empty!',
    'reason.noCustomer': 'This customer has already left.',
    'reason.notPlaying': 'Not possible right now.',
    'reason.invalid': 'That doesn’t go here.',
  },
});

// ------------------------------------------------------------------ layout (stage px)
const STAGE_W = 1280;
const WORK_Y = 350; // work area top; station coordinates below are relative to it
const SEAT_X = [null, [640], [420, 860], [270, 640, 1010], [200, 493, 787, 1080]];
const BLENDER_X = [null, [88], [14, 154]];
const BLENDER_SIZE = 140;
// The cup stack stands at the left end of the bowl row; stack + spots are centred in the row.
const BOWL_SLOT_W = 138;
const BOWL_SIZE = 140;
const BOWLS_X0 = 316;
const BOWLS_W = 648;
const STACK_W = 84;
const STACK_GAP = 8;
const BIN_ART = 84;
const MACHINE_SIZE = 236;
const DECOR_IDS = ['plants', 'jukebox', 'seating', 'neon'];
const DECOR_SIZE = { plants: 118, jukebox: 118, seating: 124, neon: 104 };
const LAYER_NUM = { base: 1, mid: 2, top: 3 };
const MOODS = ['happy', 'neutral', 'impatient', 'angry'];
const STAMP_MS = 1700;
const MAX_FRAME_DT = 0.25;
// Progress bars (patience, blender/smoothie timers, blender ring) write on one shared cadence:
// in Chromium every frame with such a write re-layerizes the whole stage.
const BAR_TICK = 0.1; // s
const BAR_STEPS = 100;
const BAR_JUMP = 0.05; // bigger changes (a refill, a new blend) are written at once
const HIT_PAD = 18; // stage px around a station, as in drag.js

const ACTIVE = new Set(['arriving', 'waiting']);
const POURABLE = new Set(['ready', 'overflowing', 'ruined']);
const TUT_DOTS = ['pack', 'cup', 'wait', 'pour', 'add', 'serve', 'done'];
const TUT_DOT_OF = { welcome: -1, pack: 0, clean: 0, cup: 1, cupWait: 1, wait: 2, waitWrong: 2, pour: 3, add: 4, trash: 4, serve: 5, done: 6 };

const CHECK_SVG = '<svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="#2fbf71" stroke="#2a1236" stroke-width="3"/><path d="M11.5 20.5l6 6 11-12" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const POINT_SVG = '<svg viewBox="0 0 46 58" width="46" height="58" aria-hidden="true"><path d="M14 4H32V30H43L23 54L3 30H14Z" fill="#ffb627" stroke="#2a1236" stroke-width="4" stroke-linejoin="round"/><path d="M19 9V32" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.6"/></svg>';
const PAUSE_ICON = '<svg viewBox="0 0 40 40" width="30" height="30" aria-hidden="true"><rect x="9" y="7" width="8" height="26" rx="3" fill="#fff" stroke="#2a1236" stroke-width="3"/><rect x="23" y="7" width="8" height="26" rx="3" fill="#fff" stroke="#2a1236" stroke-width="3"/></svg>';

// ------------------------------------------------------------------ small helpers
function el(tag, className, attrs) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined && v !== false) e.setAttribute(k, v);
  }
  return e;
}

// Replace a node's markup only when its signature changed (the art strings are big).
function patch(node, sig, markup) {
  if (node._sig === sig) return false;
  node._sig = sig;
  node.innerHTML = typeof markup === 'function' ? markup() : markup;
  return true;
}

function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}

// Coin amounts in the locale format of the menus ("1.534" / "1,534"), floored like the wallet.
const coins = (n) => formatNumber(Math.floor((Number(n) || 0) + 1e-6), 0);

// The rotate hint (js/main.js) covers the whole stage while it is shown.
const rotateHintShown = () => document.getElementById('rotate-hint')?.hidden === false;

function fmtClock(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// One-shot feedback classes (shake, squash, pop …) are removed again after their animation.
const ANIM_MS = { 'is-reject': 450, 'is-squash': 350, 'is-pop': 450, 'is-wobble': 500, 'is-hop': 500, 'is-bump': 300, 'is-breaking': 650 };

function restartAnim(node, cls) {
  if (!node) return;
  node.classList.remove(cls);
  void node.offsetWidth; // reflow so the animation runs again
  node.classList.add(cls);
  const key = `_anim_${cls}`;
  clearTimeout(node[key]);
  node[key] = setTimeout(() => node.classList.remove(cls), ANIM_MS[cls] || 600);
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSubset = (a, b) => a.every((id) => b.includes(id));

// Can this bowl still become the ordered bowl by adding items?
function bowlOnTrack(bowl, order) {
  if (!bowl.base || bowl.base !== order.base) return false;
  if (!isSubset(bowl.mid, order.mid) || !isSubset(bowl.top, order.top)) return false;
  return bowl.top.length === 0 || isSubset(order.mid, bowl.mid);
}

function nextMissing(bowl, order) {
  return order.mid.find((id) => !bowl.mid.includes(id)) || order.top.find((id) => !bowl.top.includes(id)) || null;
}

// ------------------------------------------------------------------ the view
class GameView {
  constructor(container, params, ctx) {
    this.container = container;
    this.params = params || {};
    this.ctx = ctx || {};
    this.audio = this.ctx.audio || defaultAudio;
    this.timers = new Set();
    this.offs = [];
    this.custViews = new Map();
    this.destroyed = false;
    this.paused = false;
    this.over = false;
    this.raf = 0;
    this.last = 0;
    this.toastEl = null;
    this.moneyInFlight = 0;
    this.shownMoney = 0;
    this.shownHearts = -1;
    this.lastTick = null;
    this.seatCount = 0;
    this.hintAt = 0;
    this.bestBeaten = false;
    this.barAcc = BAR_TICK;
    this.barTick = true;
    this.frozenAnims = null;

    this.setupGame();
    this.build();
    this.wireDrag();
    this.wireInput();
    this.updateAll(0);
    this.startIntro();
    this.audio.music('game');
    this.last = performance.now();
    this.raf = requestAnimationFrame((ts) => this.frame(ts));
    if (rotateHintShown()) this.pause(); // started while the rotate hint covers the stage
  }

  // ---------------------------------------------------------------- setup
  setupGame() {
    const p = this.params;
    const save = getSave();
    this.save = save;
    this.mode = p.mode === 'endless' ? 'endless' : 'campaign';
    this.level = this.mode === 'campaign' ? getLevel(Number(p.levelId)) || LEVELS[0] : null;
    this.levelId = this.level ? this.level.id : null;
    const smoothies = this.mode === 'endless' || this.levelId >= SMOOTHIE_LEVEL;
    const tutorial = this.levelId === 1 && !save.seenIntros?.basics;
    const seed = Number.isFinite(p.seed) ? p.seed : ((Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0) || 1;
    this.featured = new Set(save.newIngredients || []);
    this.game = createGame({
      mode: this.mode,
      level: this.level,
      owned: save.owned.slice(),
      ingLevels: { ...save.ingLevels },
      kitchen: kitchenStats(),
      smoothies,
      seed,
      tutorial,
      featured: [...this.featured],
    });
    this.best = save.endlessBest || 0;
    this.tut = tutorial ? { key: '', done: false, finished: false } : null;
    window.__acaiGame = this.game;
  }

  // ---------------------------------------------------------------- DOM build
  build() {
    const g = this.game;
    const root = el('div', 'screen screen-game', { 'data-mode': this.mode, 'data-level': this.levelId ?? 'endless' });
    this.root = root;
    if (g.smoothie) root.classList.add('has-smoothie');
    if (this.tut) root.classList.add('has-tutorial');
    root.append(this.buildScene(), el('div', 'g-counter'), this.buildWork(), this.buildHud());
    this.fxEl = el('div', 'g-fx');
    this.tutEl = el('div', 'g-tut');
    this.bannerEl = el('div', 'g-banner', { 'aria-live': 'polite' });
    root.append(this.fxEl, this.tutEl, this.bannerEl, this.buildPause());
    this.stampEl = el('div', 'g-stamp', { hidden: '', 'data-stamp': '' });
    this.ghostLayer = el('div', 'ghost-layer');
    root.append(this.stampEl, this.ghostLayer); // ghost layer stays the last child
    this.container.append(root);
    this.applyTexts();
  }

  buildScene() {
    const scene = el('div', 'g-scene');
    this.wallEl = el('div', 'g-wall');
    this.decorEls = {};
    const decor = el('div', 'g-decor');
    for (const id of DECOR_IDS) {
      if (!(this.save.upgrades?.[id] > 0)) continue;
      const d = el('div', `g-decor-item g-decor-${id}`, { 'data-decor': id });
      d.innerHTML = decorSVG(id, DECOR_SIZE[id]);
      decor.append(d);
      this.decorEls[id] = d;
    }
    this.seatsEl = el('div', 'g-seats');
    scene.append(this.wallEl, decor, this.seatsEl);
    return scene;
  }

  buildWork() {
    const g = this.game;
    const work = el('div', 'g-work');
    work.append(el('div', 'g-backsplash'));

    // blenders
    const bx = BLENDER_X[g.blenders.length] || BLENDER_X[2];
    this.blenderViews = g.blenders.map((b, i) => {
      const node = el('div', 'g-blender', { 'data-blender': i, 'data-state': b.state });
      node.style.left = `${bx[i]}px`;
      const art = el('div', 'g-art');
      const timer = el('div', 'g-timer');
      const fill = el('i');
      timer.append(fill);
      node.append(art, timer);
      work.append(node);
      return { el: node, art, timer, fill, state: null, ring: null, ringP: -1 };
    });

    // freezer with base packs (owned bases only)
    const freezer = el('div', 'g-freezer');
    const lid = el('div', 'g-freezer-lid');
    const packs = el('div', 'g-packs');
    this.freezerLabel = el('span', 'g-freezer-label');
    this.packEls = {};
    for (const ing of INGREDIENTS) {
      if (ing.layer !== 'base' || !g.owned.includes(ing.id)) continue;
      const node = el('div', 'g-pack', { 'data-pack': ing.id });
      node.innerHTML = `<div class="g-art">${packIcon(ing.id, 74)}</div><span class="g-name"></span>${this.qualityMarkup(ing.id)}${this.badgeMarkup(ing.id)}`;
      packs.append(node);
      this.packEls[ing.id] = node;
    }
    freezer.append(lid, packs, el('div', 'g-freezer-front'), this.freezerLabel);
    work.append(freezer);

    // cup stack + bowl spots: a cup goes down from the stack before anything goes into it
    const n = g.bowls.length;
    const x0 = BOWLS_X0 + (BOWLS_W - (STACK_W + STACK_GAP + n * BOWL_SLOT_W)) / 2;
    this.stackEl = el('div', 'g-stack', { 'data-cup-stack': '', role: 'img' });
    this.stackEl.style.left = `${Math.round(x0)}px`;
    this.stackEl.innerHTML = `<div class="g-art">${cupStackSVG(STACK_W)}</div><span class="g-name"></span>`;
    work.append(this.stackEl);
    const sx0 = x0 + STACK_W + STACK_GAP;
    this.bowlViews = g.bowls.map((b, i) => {
      const node = el('div', 'g-bowl', { 'data-bowl': i, 'data-state': 'nocup' });
      node.style.left = `${Math.round(sx0 + i * BOWL_SLOT_W)}px`;
      const art = el('div', 'g-art');
      const chips = el('div', 'g-chips');
      const match = el('span', 'g-match');
      match.innerHTML = CHECK_SVG;
      node.append(art, match, chips);
      work.append(node);
      return { el: node, art, chips, match, isMatch: false };
    });

    // ingredient shelves (owned only), fruits & crunch then toppings & sauces; each board names its
    // layer ("2 · Früchte & Crunch") like the freezer, so the layer-rule toasts point at visible words
    this.binEls = {};
    this.shelfLabels = {};
    for (const layer of ['mid', 'top']) {
      const shelf = el('div', `g-shelf g-shelf-${layer}`, { 'data-layer': layer });
      const row = el('div', 'g-shelf-row');
      for (const ing of INGREDIENTS) {
        if (ing.layer !== layer || !g.owned.includes(ing.id)) continue;
        const node = el('div', 'g-bin', { 'data-bin': ing.id, 'data-layer': layer });
        node.innerHTML = `<span class="g-lnum g-lnum-${layer}">${LAYER_NUM[layer]}</span><div class="g-art">${binSVG(ing.id, BIN_ART)}</div><span class="g-name"></span>${this.qualityMarkup(ing.id)}${this.badgeMarkup(ing.id)}`;
        row.append(node);
        this.binEls[ing.id] = node;
      }
      const inner = el('div', 'g-shelf-in');
      const label = el('span', `g-shelf-label g-shelf-label-${layer}`);
      inner.append(row, el('div', 'g-board'), label);
      this.shelfLabels[layer] = label;
      shelf.append(inner);
      work.append(shelf);
    }

    // smoothie machine with cup slots
    this.slotViews = [];
    if (g.smoothie) {
      const count = g.smoothie.slots.length;
      const machine = el('div', 'g-machine');
      machine.innerHTML = smoothieMachineSVG(count, MACHINE_SIZE);
      const cup = Math.round(MACHINE_SIZE * SMOOTHIE_CUP_SIZE);
      const xs = SMOOTHIE_SLOT_X[count] || SMOOTHIE_SLOT_X[2];
      g.smoothie.slots.forEach((s, i) => {
        const node = el('div', 'g-slot', { 'data-smoothie-slot': i, 'data-state': s.state });
        const w = 92;
        node.style.left = `${Math.round(xs[i] * MACHINE_SIZE - w / 2)}px`;
        node.style.top = `${Math.round(SMOOTHIE_SLOT_Y * MACHINE_SIZE - cup - 14)}px`;
        node.style.setProperty('--cup', `${cup}px`);
        const art = el('div', 'g-art');
        const timer = el('div', 'g-timer');
        const fill = el('i');
        timer.append(fill);
        node.append(art, timer);
        machine.append(node);
        this.slotViews.push({ el: node, art, timer, fill, cup, state: null });
      });
      work.append(machine);
    } else if (this.mode === 'campaign') {
      // teaser: the machine arrives in a later level
      const machine = el('div', 'g-machine is-locked', { 'aria-hidden': 'true' });
      this.lockLabel = el('span', 'g-lock-label');
      machine.innerHTML = `<div class="g-art">${smoothieMachineSVG(1, MACHINE_SIZE)}</div><span class="g-lock">${lockSVG(54)}</span>`;
      machine.append(this.lockLabel);
      work.append(machine);
    }

    // trash can
    this.trashEl = el('div', 'g-trash', { 'data-trash': '', role: 'img' });
    this.trashEl.innerHTML = `<div class="g-art">${trashSVG(96)}</div>`;
    work.append(this.trashEl);
    return work;
  }

  badgeMarkup(id) {
    return this.featured.has(id) ? '<span class="g-new"></span>' : '';
  }

  // Quality upgrades (0–2 stars) on packs and bins alike.
  qualityMarkup(id) {
    const q = Math.max(0, Math.min(2, Math.floor(Number(this.game.ingLevels[id]) || 0)));
    return q ? `<span class="g-quality">${starSVG(true, 15).repeat(q)}</span>` : '';
  }

  buildHud() {
    const hud = el('div', 'g-hud');
    this.pauseBtn = el('button', 'g-pause-btn', { type: 'button', 'data-pause': '' });
    this.pauseBtn.innerHTML = PAUSE_ICON;
    this.levelEl = el('div', 'g-pill g-level');
    this.heartsEl = el('div', 'g-pill g-hearts', { 'data-hud-hearts': '', role: 'img' });
    this.heartEls = [];
    for (let i = 0; i < this.game.maxHearts; i++) {
      const h = el('span', 'g-heart');
      this.heartsEl.append(h);
      this.heartEls.push(h);
    }

    const money = el('div', 'g-pill g-money', { 'data-hud-money': '', 'data-value': '0' });
    this.moneyEl = money;
    this.moneyCoin = el('span', 'g-money-coin');
    this.moneyCoin.innerHTML = coinSVG(38);
    this.moneyNum = el('b', 'g-money-num');
    this.moneyNum.textContent = '0';
    const bar = el('div', 'g-goalbar');
    this.goalFill = el('i', 'g-goalfill');
    bar.append(this.goalFill);
    this.goalMarks = [];
    if (this.mode === 'campaign') {
      const goals = this.game.config.goals;
      const max = goals[goals.length - 1];
      goals.forEach((goal, i) => {
        const m = el('span', 'g-goalmark', { 'data-goal': goal });
        m.style.left = `${(goal / max) * 100}%`;
        m.innerHTML = `${starSVG(false, 26)}<small>${coins(goal)}</small>`;
        bar.append(m);
        this.goalMarks.push({ el: m, goal, lit: false, i });
      });
    } else {
      this.bestEl = el('span', 'g-best');
      bar.append(this.bestEl);
    }
    money.append(this.moneyCoin, this.moneyNum, bar);

    this.clockEl = el('div', 'g-pill g-clock', { 'data-hud-time': '' });
    this.clockEl.innerHTML = `<span class="g-clock-ico">${clockSVG(34)}</span>`;
    this.clockText = el('b', 'g-clock-text');
    this.clockEl.append(this.clockText);

    hud.append(this.pauseBtn, this.levelEl, this.heartsEl, money, this.clockEl);
    return hud;
  }

  buildPause() {
    const ov = el('div', 'overlay g-pause', { hidden: '', role: 'dialog', 'aria-modal': 'true', 'data-pause-overlay': '' });
    const panel = el('div', 'panel g-pause-panel');
    this.pauseTitle = el('h2', 'title-text g-pause-title');
    const btns = el('div', 'g-pause-btns');
    this.pauseButtons = {
      resume: el('button', 'btn green', { type: 'button', 'data-action': 'resume' }),
      restart: el('button', 'btn', { type: 'button', 'data-action': 'restart' }),
      quit: el('button', 'btn pink', { type: 'button', 'data-action': 'quit' }),
    };
    btns.append(this.pauseButtons.resume, this.pauseButtons.restart, this.pauseButtons.quit);
    // campaign: leaving forfeits the round (endless banks it instead, see exitRun)
    this.pauseNote = el('p', 'g-pause-note', { hidden: '' });
    const toggles = el('div', 'g-toggles');
    this.toggleBtns = {
      music: el('button', 'btn small cream g-toggle', { type: 'button', 'data-toggle': 'music' }),
      sfx: el('button', 'btn small cream g-toggle', { type: 'button', 'data-toggle': 'sfx' }),
    };
    toggles.append(this.toggleBtns.music, this.toggleBtns.sfx);
    panel.append(this.pauseTitle, btns, this.pauseNote, toggles);
    ov.append(panel);
    this.pauseEl = ov;
    return ov;
  }

  // All language-dependent static text (also used on language change).
  applyTexts() {
    this.wallEl.innerHTML = shopSceneSVG(1280, 330);
    if (this.decorEls.neon) this.decorEls.neon.innerHTML = decorSVG('neon', DECOR_SIZE.neon);
    for (const [id, node] of Object.entries(this.packEls)) setText(node.querySelector('.g-name'), ingName(id, true));
    for (const [id, node] of Object.entries(this.binEls)) setText(node.querySelector('.g-name'), ingName(id, true));
    for (const node of this.root.querySelectorAll('.g-new')) setText(node, t('game.new'));
    setText(this.freezerLabel, `${LAYER_NUM.base} · ${t('game.freezer')}`);
    for (const [layer, node] of Object.entries(this.shelfLabels)) setText(node, `${LAYER_NUM[layer]} · ${t(`layer.${layer}`)}`);
    if (this.lockLabel) setText(this.lockLabel, t('game.lockedSmoothie', { n: SMOOTHIE_LEVEL }));
    this.trashEl.setAttribute('aria-label', t('game.trash'));
    this.stackEl.setAttribute('aria-label', t('game.stack'));
    setText(this.stackEl.querySelector('.g-name'), t('game.stackName'));
    this.pauseBtn.setAttribute('aria-label', t('game.aria.pause'));
    this.clockEl.setAttribute('aria-label', t('game.aria.time'));
    for (const v of this.custViews.values()) v.bubble.setAttribute('aria-label', this.bubbleLabel(v.c));
    setText(this.pauseTitle, t('game.pause'));
    setText(this.pauseButtons.resume, t('game.resume'));
    setText(this.pauseButtons.restart, t('game.restart'));
    setText(this.pauseButtons.quit, t(this.mode === 'endless' ? 'game.endShift' : 'game.quitMap'));
    setText(this.pauseNote, t('game.quitLoses'));
    this.updateToggles();
    this.bannerEl?.replaceChildren(); // a banner in the old language just disappears
    this.levelSig = '';
    this.clockSig = '';
    this.shownHearts = -1;
    this.moneyShownInt = null; // number format + aria follow the language
    if (this.bestEl) this.bestSig = '';
    if (this.tut) this.tut.key = '';
  }

  updateToggles() {
    const s = getSave().settings;
    for (const [key, btn] of Object.entries(this.toggleBtns)) {
      const on = s[key] !== false;
      btn.setAttribute('aria-pressed', String(on));
      btn.classList.toggle('is-off', !on);
      setText(btn, `${t(`game.${key}`)}: ${t(on ? 'game.on' : 'game.off')}`);
    }
  }

  // ---------------------------------------------------------------- geometry
  // Untransformed position of an element in stage px (relative to the screen root).
  // Ignores CSS transforms, includes ancestor borders (offsetLeft starts inside the parent's border).
  posOf(node) {
    let x = 0;
    let y = 0;
    let n = node;
    while (n && n !== this.root) {
      x += n.offsetLeft;
      y += n.offsetTop;
      n = n.offsetParent;
      if (n && n !== this.root) {
        x += n.clientLeft;
        y += n.clientTop;
      }
    }
    return { x, y, w: node.offsetWidth, h: node.offsetHeight, cx: x + node.offsetWidth / 2, cy: y + node.offsetHeight / 2 };
  }

  // Rect of an element as drawn (transforms included) in stage px – the way drag.js hit-tests it.
  stageRect(node) {
    const r = node.getBoundingClientRect();
    const a = this.toStage(r.left, r.top);
    const b = this.toStage(r.right, r.bottom);
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  }

  toStage(clientX, clientY) {
    const r = this.stageEl.getBoundingClientRect();
    const s = r.width / STAGE_W || 1;
    return { x: (clientX - r.left) / s, y: (clientY - r.top) / s };
  }

  // ---------------------------------------------------------------- drag & drop wiring
  wireDrag() {
    const g = this.game;
    this.stageEl = this.container.closest('#stage') || this.root;
    const dnd = createDragManager({
      root: this.stageEl,
      toStage: (x, y) => this.toStage(x, y),
      ghostLayer: this.ghostLayer,
      onPickup: () => this.audio.sfx('pickup'),
      onDrop: (r) => this.onDropResult(r),
    });
    this.dnd = dnd;
    const act = (fn) => (this.canAct() ? fn() : { ok: false, reason: 'notPlaying' });

    for (const [id, node] of Object.entries(this.packEls)) {
      dnd.source(node, {
        payload: () => (this.canAct() ? { kind: 'pack', id } : null),
        ghost: () => packIcon(id, 84),
        onTap: () => this.hint(node, 'game.hint.pack'),
      });
    }
    for (const [id, node] of Object.entries(this.binEls)) {
      const layer = node.dataset.layer;
      dnd.source(node, {
        payload: () => (this.canAct() ? { kind: 'ing', id, layer } : null),
        ghost: () => scoopSVG(id, 84),
        onTap: () => this.hint(node, 'game.hint.bin'),
      });
    }

    this.blenderViews.forEach((v, i) => {
      dnd.source(v.el, {
        payload: () => {
          const b = g.blenders[i];
          return this.canAct() && POURABLE.has(b.state) ? { kind: 'blender', idx: i } : null;
        },
        ghost: () => {
          const b = g.blenders[i];
          return blenderSVG({ state: b.state, base: b.base, progress: b.progress, portions: b.portions, maxPortions: b.maxPortions }, 124);
        },
        onTap: () => this.hint(v.el, g.blenders[i].state === 'ruined' ? 'game.hint.blenderRuined' : 'game.hint.blender'),
      });
      dnd.target(v.el, {
        accepts: (p) => p.kind === 'pack',
        valid: (p) => !loadBlenderError(g, i, p.id),
        drop: (p) => act(() => loadBlender(g, i, p.id)),
      });
      this.listen(v.el, 'pointerdown', () => {
        const b = g.blenders[i];
        if (b.state === 'blending') this.hint(v.el, 'reason.blenderNotReady');
        else if (b.state === 'empty') this.hint(v.el, 'game.hint.blenderEmpty');
      });
    });

    dnd.source(this.stackEl, {
      payload: () => (this.canAct() ? { kind: 'newcup' } : null),
      ghost: () => bowlSVG(null, 132),
      onTap: () => this.hint(this.stackEl, 'game.hint.stack'),
    });

    const bowlCheck = (p, i) => {
      if (p.kind === 'newcup') return placeCupError(g, i);
      return p.kind === 'blender' ? pourError(g, p.idx, i) : addIngredientError(g, i, p.id);
    };
    const bowlDrop = (p, i) => {
      if (p.kind === 'newcup') return placeCup(g, i);
      return p.kind === 'blender' ? pourBlender(g, p.idx, i) : addIngredient(g, i, p.id);
    };
    this.bowlViews.forEach((v, i) => {
      dnd.source(v.el, {
        payload: () => (this.canAct() && g.bowls[i].base ? { kind: 'bowl', idx: i } : null),
        ghost: () => bowlSVG(g.bowls[i], 132),
        onTap: () => this.hint(v.el, 'game.hint.bowl'),
      });
      dnd.target(v.el, {
        accepts: (p) => p.kind === 'blender' || p.kind === 'ing' || p.kind === 'newcup',
        valid: (p) => !bowlCheck(p, i),
        drop: (p) => act(() => bowlDrop(p, i)),
      });
      this.listen(v.el, 'pointerdown', () => {
        if (!g.bowls[i].cup) this.hint(v.el, 'game.hint.noCup');
        else if (!g.bowls[i].base) this.hint(v.el, 'game.hint.bowlEmpty');
      });
    });

    this.slotViews.forEach((v, i) => {
      dnd.source(v.el, {
        payload: () => (this.canAct() && g.smoothie.slots[i].state !== 'empty' ? { kind: 'cup', idx: i } : null),
        ghost: () => {
          const s = g.smoothie.slots[i];
          return cupSVG(s.fruit, s.state, 84);
        },
        onTap: () => this.hint(v.el, 'game.hint.cup'),
      });
      dnd.target(v.el, {
        accepts: (p) => p.kind === 'ing' && p.layer === 'mid',
        valid: (p) => !loadSmoothieError(g, i, p.id),
        drop: (p) => act(() => loadSmoothie(g, i, p.id)),
      });
      this.listen(v.el, 'pointerdown', () => {
        if (g.smoothie.slots[i].state === 'empty') this.hint(v.el, 'game.hint.slotEmpty');
      });
    });

    dnd.target(this.trashEl, {
      accepts: (p) => p.kind === 'bowl' || p.kind === 'blender' || p.kind === 'cup',
      drop: (p) => act(() => {
        if (p.kind === 'bowl') return trashBowl(g, p.idx);
        if (p.kind === 'blender') return cleanBlender(g, p.idx);
        return trashSmoothie(g, p.idx);
      }),
    });
    this.listen(this.trashEl, 'pointerdown', () => this.hint(this.trashEl, 'game.hint.trash'));
  }

  // Customer elements come and go – they register as drop targets while they exist.
  // A wrong order still glows: reading the order bubble is the player's job.
  wireCustomer(v) {
    const g = this.game;
    v.offTarget = this.dnd.target(v.el, {
      accepts: (p) => (p.kind === 'bowl' || p.kind === 'cup') && ACTIVE.has(v.c.state),
      valid: (p) => {
        const r = p.kind === 'bowl' ? serveBowlError(g, p.idx, v.id) : serveSmoothieError(g, p.idx, v.id);
        return !r || r === 'wrongOrder';
      },
      drop: (p) => {
        if (!this.canAct()) return { ok: false, reason: 'notPlaying' };
        if (p.kind !== 'bowl') return serveSmoothie(g, p.idx, v.id);
        const r = serveBowl(g, p.idx, v.id);
        // right so far, just not finished: say so instead of "not what they ordered"
        if (!r.ok && r.reason === 'wrongOrder' && v.c.order.bowl && bowlOnTrack(g.bowls[p.idx], v.c.order.bowl)) {
          return { ok: false, reason: 'bowlIncomplete' };
        }
        return r;
      },
    });
  }

  onDropResult(r) {
    if (r.tap || r.cancelled) return;
    if (r.ok) {
      const art = r.targetEl?.querySelector('.g-art, .g-figure') || r.targetEl;
      restartAnim(art, 'is-squash');
      return;
    }
    if (r.targetEl) {
      this.audio.sfx('reject');
      restartAnim(r.targetEl, 'is-reject');
      if (r.reason) this.toast(t(`reason.${r.reason}`), r.targetEl, 'bad');
      return;
    }
    const w = r.pos && this.canAct() ? this.wrongStation(r) : null;
    if (w) {
      this.audio.sfx('reject');
      restartAnim(w.el, 'is-reject');
      this.toast(t(w.key), w.el, 'bad');
    } else {
      this.audio.sfx('drop'); // drop on empty floor: silent return (§4.3)
    }
  }

  // drag.js only hit-tests stations that accept the item, so a pack let go over a bowl is a "drop on
  // nothing" there. Find the station under the release point that does not take this kind of item
  // and the hint to show (§1 #4: bounce back + hint). Returns { el, key } or null for empty floor.
  wrongStation(r) {
    const g = this.game;
    const p = r.payload;
    if (!p) return null;
    const ruined = p.kind === 'blender' && g.blenders[p.idx]?.state === 'ruined';
    const hint = {
      pack: 'game.hint.pack', ing: 'game.hint.bin', bowl: 'game.hint.bowl', cup: 'game.hint.cup', newcup: 'game.hint.stack',
      blender: ruined ? 'game.hint.blenderRuined' : 'game.hint.blender',
    }[p.kind];
    // station type → hint, only for the stations that never take this kind of item
    const wrong = {
      pack: { bowl: 'reason.packToBlender', slot: hint, trash: hint, cust: hint },
      ing: { blender: 'reason.wrongLayer', slot: p.layer === 'mid' ? null : 'reason.notSmoothieFruit', trash: hint, cust: hint },
      blender: { blender: hint, slot: hint, cust: hint },
      bowl: { blender: hint, bowl: hint, slot: hint },
      cup: { blender: hint, bowl: hint, slot: hint },
      newcup: { blender: hint, slot: hint, trash: hint, cust: hint },
    }[p.kind];
    if (!wrong) return null;
    const source = { blender: this.blenderViews, bowl: this.bowlViews, cup: this.slotViews }[p.kind]?.[p.idx]?.el;
    const stations = {
      blender: this.blenderViews.map((v) => v.el),
      bowl: this.bowlViews.map((v) => v.el),
      slot: this.slotViews.map((v) => v.el),
      trash: [this.trashEl],
      cust: [...this.custViews.values()].filter((v) => ACTIVE.has(v.c.state)).map((v) => v.el),
    };
    const { x, y } = r.pos;
    let best = null;
    let bestDist = Infinity;
    for (const [type, key] of Object.entries(wrong)) {
      if (!key) continue;
      for (const node of stations[type]) {
        if (node === source) continue;
        const b = this.stageRect(node);
        if (x < b.x1 - HIT_PAD || x > b.x2 + HIT_PAD || y < b.y1 - HIT_PAD || y > b.y2 + HIT_PAD) continue;
        const dist = Math.hypot(x - b.cx, y - b.cy);
        if (dist < bestDist) {
          best = { el: node, key };
          bestDist = dist;
        }
      }
    }
    return best;
  }

  canAct() {
    return !this.over && !this.paused && this.game.status === 'playing';
  }

  hint(node, key) {
    const now = performance.now();
    if (!this.canAct() || this.dnd.isDragging() || now - this.hintAt < 700) return;
    this.hintAt = now;
    this.toast(t(key), node, 'info');
  }

  // ---------------------------------------------------------------- input / lifecycle
  listen(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    this.offs.push(() => target.removeEventListener(type, fn, opts));
  }

  later(fn, ms) {
    const id = setTimeout(() => {
      this.timers.delete(id);
      if (!this.destroyed) fn();
    }, ms);
    this.timers.add(id);
    return id;
  }

  wireInput() {
    this.listen(this.pauseBtn, 'click', () => {
      this.audio.sfx('click');
      this.pause();
    });
    this.listen(this.pauseButtons.resume, 'click', () => this.resume());
    this.listen(this.pauseButtons.restart, 'click', () => this.exitRun('game', { ...this.params, seed: undefined }));
    this.listen(this.pauseButtons.quit, 'click', () => this.exitRun(this.mode === 'endless' ? 'title' : 'map', {}));
    for (const [key, btn] of Object.entries(this.toggleBtns)) {
      this.listen(btn, 'click', () => {
        const on = getSave().settings[key] === false;
        setSetting(key, on);
        if (key === 'music') this.audio.setMusic(on);
        else this.audio.setSfx(on);
        this.updateToggles();
      });
    }
    this.listen(document, 'keydown', (e) => {
      if (e.key !== 'Escape' || this.over) return;
      e.preventDefault();
      if (this.paused && rotateHintShown()) return; // the hint covers the game: stay paused
      if (this.paused) this.resume();
      else this.pause();
    });
    this.listen(document, 'visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.pause();
    });
    // main.js fires this when the rotate hint appears over the stage: pause like on a hidden tab,
    // so the player resumes on purpose after rotating back
    this.listen(window, 'acai:rotate-hint', () => this.pause());
    this.listen(this.stampEl, 'pointerdown', () => this.goResults());
    this.offs.push(onLangChange(() => this.applyTexts()));
  }

  pause() {
    // game.result: the run already ended (gameOver is drained on the next frame)
    if (this.paused || this.over || this.destroyed || this.game.result) return;
    this.paused = true;
    setPaused(this.game, true);
    this.dnd.cancel();
    this.audio.loop('blender', false);
    this.audio.suspend();
    this.root.classList.add('is-paused');
    this.freezeAnims(true);
    this.updateToggles();
    this.pauseNote.hidden = !(this.mode === 'campaign' && this.game.money > 0);
    this.pauseEl.hidden = false;
    this.pauseButtons.resume.focus({ preventScroll: true });
  }

  resume() {
    if (!this.paused || this.destroyed) return;
    this.paused = false;
    setPaused(this.game, false);
    this.audio.resume();
    this.audio.sfx('click');
    this.freezeAnims(false);
    this.root.classList.remove('is-paused');
    this.pauseEl.hidden = true;
    this.last = performance.now();
  }

  // Freeze the scene's CSS animations while paused (the pause card keeps its own). A class with a
  // descendant * rule would restyle the whole screen; and only what was paused here plays again,
  // so finished pop-ins and walk-ins never replay.
  freezeAnims(on) {
    if (!on) {
      for (const a of this.frozenAnims || []) if (a.playState === 'paused') a.play();
      this.frozenAnims = null;
      return;
    }
    if (typeof this.root.getAnimations !== 'function' || typeof CSSAnimation !== 'function') return;
    this.frozenAnims = this.root.getAnimations({ subtree: true }).filter((a) => {
      const target = a.effect?.target;
      return a instanceof CSSAnimation && a.playState === 'running' && target && !this.pauseEl.contains(target);
    });
    for (const a of this.frozenAnims) a.pause();
  }

  // Pause menu "Neu starten" / "Zur Karte". Endless has no closing time, so leaving ends the shift:
  // coins and the record are banked through the normal gameOver → recordResult → results flow
  // (results offers Menu / Retry). A campaign round is forfeited (the pause card says so).
  exitRun(name, params) {
    const g = this.game;
    if (this.mode === 'endless' && !this.over && (g.money > 0 || g.served > 0)) {
      this.paused = false;
      this.pauseEl.hidden = true;
      this.freezeAnims(false);
      this.root.classList.remove('is-paused');
      this.audio.resume();
      this.audio.sfx('click');
      endRun(g); // sets the status itself; the next frame() drains gameOver → onGameOver()
      return;
    }
    this.leave(name, params);
  }

  leave(name, params) {
    this.audio.resume();
    this.audio.sfx('click');
    this.ctx.go?.(name, params);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    for (const id of this.timers) clearTimeout(id);
    this.timers.clear();
    for (const off of this.offs) off();
    this.offs = [];
    this.dnd?.destroy();
    this.frozenAnims = null;
    this.audio.loop('blender', false);
    this.audio.resume();
    if (window.__acaiGame === this.game) delete window.__acaiGame;
    this.root.remove();
  }

  // ---------------------------------------------------------------- main loop
  frame(ts) {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame((n) => this.frame(n));
    const dt = Math.min(MAX_FRAME_DT, Math.max(0, (ts - this.last) / 1000));
    this.last = ts;
    const speed = Number(window.__acaiSpeed) > 0 ? Number(window.__acaiSpeed) : 1; // test hook
    let left = Math.min(5, dt * speed);
    while (left > 1e-6 && this.game.status === 'playing') {
      const step = Math.min(0.1, left);
      tick(this.game, step);
      left -= step;
    }
    for (const ev of drainEvents(this.game)) this.onEvent(ev);
    this.updateAll(dt);
  }

  updateAll(dt) {
    this.barAcc += dt;
    this.barTick = this.barAcc >= BAR_TICK;
    if (this.barTick) this.barAcc = 0;
    this.updateCustomers();
    this.updateBlenders();
    this.updateBowls();
    this.updateSlots();
    // drop-target glow follows the state under a still finger (a cup finishes, a guest leaves)
    if (this.dnd.isDragging()) this.dnd.refresh();
    this.updateHud(dt);
    this.updateTutorial();
    if (!this.paused && !this.over) {
      this.audio.loop('blender', this.game.blenders.some((b) => b.state === 'blending'));
    }
  }

  // ---------------------------------------------------------------- engine events
  onEvent(ev) {
    const a = this.audio;
    switch (ev.type) {
      case 'customerArrive':
        a.sfx('bell');
        break;
      case 'customerPaid':
        a.sfx('coin');
        a.sfx('happy');
        this.payFx(ev);
        if (this.tut && !this.tut.done) this.tut.done = true;
        break;
      case 'customerLost':
        a.sfx('angry');
        a.sfx('heart');
        this.lostFx(ev);
        break;
      case 'partialDelivery':
        a.sfx('happy');
        break;
      case 'blenderStart':
        a.sfx('blenderStart');
        break;
      case 'blenderReady':
        a.sfx('blenderReady');
        restartAnim(this.blenderViews[ev.idx]?.art, 'is-pop');
        break;
      case 'blenderOverflow':
        a.sfx('overflow');
        break;
      case 'blenderRuined': {
        a.sfx('ruined');
        // point to the trash right away – a spoiled blender never frees itself
        const v = this.blenderViews[ev.idx];
        if (v && this.canAct()) this.toast(t('game.hint.blenderRuined'), v.el, 'info');
        restartAnim(this.trashEl.querySelector('.g-art'), 'is-wobble');
        break;
      }
      case 'cupPlaced':
        a.sfx('cup');
        break;
      case 'basePoured':
        a.sfx('pour');
        break;
      case 'ingredientAdded':
        a.sfx('plop');
        break;
      case 'smoothieStart':
        a.sfx('pour');
        break;
      case 'smoothieReady':
        a.sfx('smoothieReady');
        restartAnim(this.slotViews[ev.idx]?.art, 'is-pop');
        break;
      case 'trash':
        a.sfx('trash');
        restartAnim(this.trashEl.querySelector('.g-art'), 'is-wobble');
        break;
      case 'closingTime':
        a.sfx('closing');
        this.banner(t('game.closingBanner'), t('game.closingText'), 3000, 'is-closing');
        break;
      case 'stageUp':
        a.sfx('star');
        this.banner(t('game.banner.stageUp', { n: ev.stage + 1 }), t('game.banner.stageUpText'), 2600, 'is-stage');
        break;
      case 'gameOver':
        this.onGameOver(ev);
        break;
      default:
        break;
    }
  }

  // ---------------------------------------------------------------- customers
  updateCustomers() {
    const g = this.game;
    const count = g.seats.length;
    if (count !== this.seatCount) {
      this.seatCount = count;
      this.layoutDecor(count);
    }
    const alive = new Set();
    g.seats.forEach((c, seat) => {
      if (!c) return;
      alive.add(c.id);
      const v = this.custViews.get(c.id) || this.createCustomer(c);
      this.updateCustomer(v, c, seat);
    });
    for (const [id, v] of this.custViews) {
      if (!alive.has(id)) this.removeCustomer(v);
    }
  }

  seatX(seat) {
    const xs = SEAT_X[this.seatCount] || SEAT_X[4];
    return xs[seat] ?? 640;
  }

  createCustomer(c) {
    const x = this.seatX(c.seat);
    const node = el('div', `g-cust ${x < 640 ? 'from-left' : 'from-right'}`, {
      'data-seat': c.seat, 'data-customer-id': c.id, 'data-state': c.state,
    });
    node.style.left = `${x}px`;
    const bubble = el('div', 'g-bubble', { role: 'img', 'aria-label': this.bubbleLabel(c) });
    bubble.innerHTML = this.bubbleMarkup(c);
    const fig = el('div', 'g-figure');
    node.append(fig, bubble);
    this.seatsEl.append(node);
    const v = {
      id: c.id, c, el: node, bubble, fig, look: lookFromSeed(c.look?.seed ?? c.id),
      state: '', x, mood: '', delivered: '', fill: bubble.querySelector('.g-patience i'),
      ratio: -1,
    };
    this.custViews.set(c.id, v);
    this.wireCustomer(v);
    return v;
  }

  bubbleMarkup(c) {
    const o = c.order;
    const row = (layer, icons) => (icons ? `<div class="g-row g-row-${layer}"><span class="g-lnum g-lnum-${layer}">${LAYER_NUM[layer]}</span>${icons}</div>` : '');
    const mid = o.bowl.mid.map((id) => `<span class="g-ico">${ingredientIcon(id, 32)}</span>`).join('');
    const top = o.bowl.top.map((id) => `<span class="g-ico">${ingredientIcon(id, 32)}</span>`).join('');
    const base = `<div class="g-order-base"><span class="g-lnum g-lnum-base">1</span>${bowlSVG({ base: o.bowl.base, mid: [], top: [] }, 50)}</div>`;
    const bowl = `<div class="g-order-part g-order-bowl" data-part="bowl">${base}<div class="g-rows">${row('mid', mid)}${row('top', top)}</div><span class="g-check">${CHECK_SVG}</span></div>`;
    // the fruit badge names the smoothie like the bowl rows name their items (colour alone is too little)
    const cup = o.smoothie
      ? `<div class="g-order-part g-order-cup" data-part="smoothie"><span class="g-cup-wrap">${cupSVG(o.smoothie, 'ready', 50)}<span class="g-cup-fruit">${ingredientIcon(o.smoothie, 22)}</span></span><span class="g-check">${CHECK_SVG}</span></div>`
      : '';
    return `<div class="g-order">${bowl}${cup}</div><div class="g-patience"><i></i></div>`;
  }

  // Accessible name of the order bubble (it is role="img"), with what was already handed over.
  bubbleLabel(c) {
    const o = c.order;
    const done = (yes) => (yes ? ` (${t('game.served')})` : '');
    const bowl = [o.bowl.base, ...o.bowl.mid, ...o.bowl.top].map((id) => ingName(id)).join(', ');
    const cup = o.smoothie ? `; ${t(`smoothie.${o.smoothie}`)}${done(c.delivered.smoothie)}` : '';
    return `${t('game.order')}: ${bowl}${done(c.delivered.bowl)}${cup}`;
  }

  updateCustomer(v, c, seat) {
    v.c = c;
    const x = this.seatX(seat);
    if (x !== v.x) {
      v.x = x;
      v.el.style.left = `${x}px`;
    }
    if (c.state !== v.state) {
      if (v.state) v.el.classList.remove(`is-${v.state}`);
      v.state = c.state;
      v.el.dataset.state = c.state;
      v.el.classList.add(`is-${c.state}`);
    }
    const mood = MOODS.includes(c.mood) ? c.mood : 'neutral';
    if (patch(v.fig, `${mood}`, () => customerSVG(v.look, mood, 160)) || v.mood !== mood) {
      v.mood = mood;
      v.bubble.dataset.mood = mood;
    }
    const delivered = `${c.delivered.bowl ? 1 : 0}${c.delivered.smoothie ? 1 : 0}`;
    if (delivered !== v.delivered) {
      v.delivered = delivered;
      v.bubble.querySelector('[data-part="bowl"]')?.classList.toggle('is-done', c.delivered.bowl);
      v.bubble.querySelector('[data-part="smoothie"]')?.classList.toggle('is-done', c.delivered.smoothie);
      v.bubble.setAttribute('aria-label', this.bubbleLabel(c));
    }
    const q = Math.round(Math.max(0, Math.min(1, c.patience / c.maxPatience)) * BAR_STEPS) / BAR_STEPS;
    if (this.barDue(v.ratio, q)) {
      v.ratio = q;
      v.fill.style.transform = `scaleX(${q})`;
    }
  }

  removeCustomer(v) {
    v.offTarget?.();
    v.el.remove();
    this.custViews.delete(v.id);
  }

  // Decor sits in the gaps between the seats (they move when endless adds seats).
  layoutDecor(count) {
    const xs = SEAT_X[count] || SEAT_X[4];
    const gapMid = (i) => (xs[i] + xs[i + 1]) / 2;
    const place = (id, cx) => {
      const d = this.decorEls[id];
      if (d) d.style.left = `${Math.round(cx - DECOR_SIZE[id] / 2)}px`;
    };
    place('plants', 58);
    place('jukebox', 1222);
    place('seating', xs.length > 1 ? gapMid(0) : 330);
    place('neon', xs.length > 1 ? gapMid(xs.length - 2) : 950);
    for (const v of this.custViews.values()) v.x = -1; // re-position on next update
  }

  // ---------------------------------------------------------------- stations
  updateBlenders() {
    this.game.blenders.forEach((b, i) => {
      const v = this.blenderViews[i];
      // the art is re-rendered only on state changes; the badge ring follows the blend in place
      if (patch(v.art, `${b.state}|${b.base}|${b.portions}|${b.maxPortions}`,
        () => blenderSVG({ state: b.state, base: b.base, progress: 0, portions: b.portions, maxPortions: b.maxPortions }, BLENDER_SIZE))) {
        v.ring = v.art.querySelector('[data-ring]');
        v.ringP = -1;
      }
      const rp = b.state === 'blending' ? Math.round(b.progress * 48) / 48 : 0;
      if (v.ring && this.barDue(v.ringP, rp)) {
        v.ringP = rp;
        const len = Number(v.ring.dataset.ring);
        v.ring.setAttribute('stroke-dasharray', `${(len * rp).toFixed(1)} ${len}`);
        v.ring.setAttribute('opacity', rp > 0 ? '1' : '0');
      }
      if (v.state !== b.state) {
        v.state = b.state;
        v.el.dataset.state = b.state;
      }
      // timer bar: fills while blending, drains toward overflow / ruin
      let k = -1;
      if (b.state === 'blending') k = b.progress;
      else if ((b.state === 'ready' || b.state === 'overflowing') && b.duration > 0) k = 1 - b.progress;
      this.setTimer(v, k);
    });
  }

  setTimer(v, k) {
    const show = k >= 0;
    const fresh = v.timerShown !== show;
    if (fresh) {
      v.timerShown = show;
      v.timer.classList.toggle('is-on', show);
    }
    if (show) {
      const q = Math.round(k * BAR_STEPS) / BAR_STEPS;
      if (q !== v.timerK && (fresh || this.barDue(v.timerK, q))) {
        v.timerK = q;
        v.fill.style.transform = `scaleX(${q})`;
      }
    }
  }

  // Should a progress value move from prev to q in this frame? On the shared tick, on the first
  // write (prev unset / -1) and on jumps; small steps in between wait for the tick.
  barDue(prev, q) {
    return q !== prev && (this.barTick || !(prev >= 0) || Math.abs(q - prev) > BAR_JUMP);
  }

  updateBowls() {
    const g = this.game;
    const waiting = g.seats.filter((c) => c && ACTIVE.has(c.state) && !c.delivered.bowl);
    g.bowls.forEach((b, i) => {
      const v = this.bowlViews[i];
      const sig = `${b.uid}|${b.cup}|${b.base}|${b.mid.join()}|${b.top.join()}`;
      if (patch(v.art, sig, () => (b.cup ? bowlSVG(b, BOWL_SIZE) : cupSpotSVG(BOWL_SIZE)))) {
        v.chips.innerHTML = this.chipsMarkup(b);
        v.el.dataset.state = !b.cup ? 'nocup' : !b.base ? 'empty' : b.mid.length || b.top.length ? 'filled' : 'base';
      }
      const match = !!b.base && waiting.some((c) => bowlMatchesOrder(b, c.order.bowl));
      if (match !== v.isMatch) {
        v.isMatch = match;
        v.el.classList.toggle('is-match', match);
      }
    });
  }

  chipsMarkup(b) {
    if (!b.base) return '';
    const chip = (id, layer) => `<span class="g-chip g-chip-${layer}">${ingredientIcon(id, 24)}</span>`;
    return chip(b.base, 'base') + b.mid.map((id) => chip(id, 'mid')).join('') + b.top.map((id) => chip(id, 'top')).join('');
  }

  updateSlots() {
    const slots = this.game.smoothie?.slots;
    if (!slots) return;
    slots.forEach((s, i) => {
      const v = this.slotViews[i];
      patch(v.art, `${s.state}|${s.fruit}`, () => cupSVG(s.fruit, s.state, v.cup));
      if (v.state !== s.state) {
        v.state = s.state;
        v.el.dataset.state = s.state;
      }
      this.setTimer(v, s.state === 'mixing' ? s.progress : -1);
    });
  }

  // ---------------------------------------------------------------- HUD
  updateHud(dt) {
    const g = this.game;
    // level / stage label
    const label = this.mode === 'endless'
      ? `${t('game.endless')} · ${t('game.stage', { n: g.stage + 1 })}`
      : t('game.level', { n: this.levelId });
    if (label !== this.levelSig) {
      this.levelSig = label;
      setText(this.levelEl, label);
    }

    // hearts
    if (g.hearts !== this.shownHearts) {
      const prev = this.shownHearts;
      this.shownHearts = g.hearts;
      this.heartEls.forEach((h, i) => {
        const filled = i < g.hearts;
        patch(h, filled ? 'f' : 'e', () => heartSVG(filled, 30));
        if (prev > g.hearts && i >= g.hearts && i < prev) restartAnim(h, 'is-breaking');
      });
      this.heartsEl.setAttribute('aria-label', t('game.aria.hearts', { n: g.hearts, max: g.maxHearts }));
    }

    // money: the number counts up while the coins fly in
    const target = Math.max(0, g.money - this.moneyInFlight);
    const diff = target - this.shownMoney;
    if (Math.abs(diff) < 0.5 || dt === 0) this.shownMoney = target;
    else this.shownMoney += diff * Math.min(1, dt * 9);
    const shown = Math.round(this.shownMoney);
    if (shown !== this.moneyShownInt) {
      this.moneyShownInt = shown;
      setText(this.moneyNum, coins(shown));
      this.moneyEl.setAttribute('aria-label', t('game.aria.money', { n: coins(shown) }));
    }
    if (this.moneyEl.dataset.value !== String(g.money)) this.moneyEl.dataset.value = String(g.money);
    this.updateGoalBar();

    // clock
    let text;
    let urgent = false;
    if (this.mode === 'endless') {
      text = fmtClock(g.time);
    } else if (g.closing) {
      text = t('game.closed');
    } else {
      const remain = Math.max(0, g.duration - g.time);
      const secs = Math.ceil(remain);
      text = fmtClock(secs);
      urgent = secs <= 10;
      if (urgent && secs > 0 && this.lastTick !== secs && g.status === 'playing') {
        this.lastTick = secs;
        this.audio.sfx('tick');
      }
    }
    const sig = `${text}|${urgent}|${g.closing}`;
    if (sig !== this.clockSig) {
      this.clockSig = sig;
      setText(this.clockText, text);
      this.clockEl.classList.toggle('is-urgent', urgent);
      this.clockEl.classList.toggle('is-closed', g.closing);
    }
  }

  updateGoalBar() {
    const shown = this.shownMoney;
    if (this.mode === 'campaign') {
      const goals = this.game.config.goals;
      const max = goals[goals.length - 1];
      const k = Math.round(Math.min(1, shown / max) * 400) / 400;
      if (k !== this.goalK) {
        this.goalK = k;
        this.goalFill.style.transform = `scaleX(${k})`;
      }
      for (const m of this.goalMarks) {
        const lit = shown >= m.goal - 0.25;
        if (lit === m.lit) continue;
        m.lit = lit;
        m.el.classList.toggle('is-lit', lit);
        m.el.firstChild.outerHTML = starSVG(lit, 26);
        if (lit) {
          restartAnim(m.el, 'is-pop');
          this.audio.sfx('star');
        }
      }
      return;
    }
    const best = this.best;
    const max = Math.max(best, 1);
    const k = best > 0 ? Math.round(Math.min(1, shown / max) * 400) / 400 : 0;
    if (k !== this.goalK) {
      this.goalK = k;
      this.goalFill.style.transform = `scaleX(${k})`;
    }
    const beaten = best > 0 && shown > best;
    const sig = `${best}|${beaten}`;
    if (sig !== this.bestSig) {
      this.bestSig = sig;
      setText(this.bestEl, best > 0 ? (beaten ? t('game.newBest') : t('game.best', { n: coins(best) })) : t('game.noBest'));
      this.bestEl.classList.toggle('is-beaten', beaten);
      if (beaten && !this.bestBeaten) {
        this.bestBeaten = true;
        this.audio.sfx('star');
        restartAnim(this.moneyEl, 'is-bump');
      }
    }
  }

  // ---------------------------------------------------------------- effects
  toast(text, anchor, kind = 'bad') {
    this.toastEl?.remove();
    // customers: over the face (below the bubble); stations: just above the element
    const fig = anchor.querySelector?.('.g-figure');
    const p = this.posOf(fig || anchor);
    const node = el('div', `toast g-toast ${kind === 'info' ? '' : kind}`, { role: 'status' });
    node.textContent = text;
    const y = fig ? p.y + 70 : Math.max(84, p.y + 6);
    node.style.top = `${y}px`;
    this.fxEl.append(node);
    // centre on the anchor, clamped with the real width (it wraps by its own max-width, not by left)
    const half = node.offsetWidth / 2;
    node.style.left = `${Math.round(Math.min(STAGE_W - 12 - half, Math.max(12 + half, p.cx)))}px`;
    this.toastEl = node;
    this.later(() => node.remove(), 1700);
  }

  float(text, x, y, cls = '') {
    const node = el('div', `g-float ${cls}`);
    node.textContent = text;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    this.fxEl.append(node);
    this.later(() => node.remove(), 1400);
  }

  payFx(ev) {
    const v = this.custViews.get(ev.customerId);
    // posOf() ignores the bubble's CSS translate, so x comes from the figure
    const face = v ? this.posOf(v.fig) : { cx: this.seatX(ev.seat), y: 170 };
    const from = { cx: face.cx, cy: v ? this.posOf(v.bubble).cy : 140 };
    const total = ev.amount + ev.tip;
    this.float(t('game.plus', { n: coins(total) }), face.cx, face.y + 46, 'is-money');
    if (ev.tip > 0) this.later(() => this.float(t('game.tip', { n: coins(ev.tip) }), face.cx, face.y + 88, 'is-tip'), 160);
    restartAnim(v?.el.querySelector('.g-figure'), 'is-hop');
    if (reducedMotion() || typeof Element.prototype.animate !== 'function') {
      restartAnim(this.moneyEl, 'is-bump');
      return;
    }
    this.moneyInFlight += total;
    const to = this.posOf(this.moneyCoin);
    const n = Math.min(7, 3 + Math.floor(total / 10));
    let landed = 0;
    for (let i = 0; i < n; i++) {
      const coin = el('div', 'g-flycoin');
      coin.innerHTML = coinSVG(30);
      const sx = from.cx + (i - (n - 1) / 2) * 14;
      const sy = from.cy;
      coin.style.left = `${sx - 15}px`;
      coin.style.top = `${sy - 15}px`;
      this.fxEl.append(coin);
      const dx = to.cx - sx;
      const dy = to.cy - sy;
      const lift = 70 + (i % 3) * 18;
      const anim = coin.animate([
        { transform: 'translate(0, 0) scale(0.6)', opacity: 0 },
        { transform: `translate(${(i - n / 2) * 8}px, -30px) scale(1.1)`, opacity: 1, offset: 0.18 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - lift}px) scale(1)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.75)`, opacity: 1 },
      ], { duration: 700, delay: i * 70, easing: 'cubic-bezier(0.45, 0, 0.55, 1)', fill: 'both' });
      const done = () => {
        if (coin._done) return;
        coin._done = true;
        coin.remove();
        landed++;
        restartAnim(this.moneyEl, 'is-bump');
        if (landed === n) this.moneyInFlight = Math.max(0, this.moneyInFlight - total);
      };
      anim.onfinish = done;
      anim.oncancel = done;
      this.later(done, 700 + i * 70 + 300);
    }
  }

  lostFx(ev) {
    const v = this.custViews.get(ev.customerId);
    if (v) {
      const p = this.posOf(v.fig);
      const broken = el('div', 'g-float is-heart');
      broken.innerHTML = heartSVG(false, 44);
      broken.style.left = `${p.cx}px`;
      broken.style.top = `${p.y + 10}px`;
      this.fxEl.append(broken);
      this.later(() => broken.remove(), 1400);
    }
    restartAnim(this.heartsEl, 'is-reject');
  }

  banner(title, text, ms = 3600, cls = '') {
    const node = el('div', `g-banner-card panel ${cls}`);
    const h = el('div', 'g-banner-title');
    h.textContent = title;
    node.append(h);
    if (text) {
      const p = el('div', 'g-banner-text');
      p.textContent = text;
      node.append(p);
    }
    this.bannerEl.replaceChildren(node);
    this.later(() => node.classList.add('is-out'), ms);
    this.later(() => node.remove(), ms + 450);
  }

  startIntro() {
    if (this.tut) return; // the tutorial panel does the talking
    if (this.mode === 'endless') {
      this.later(() => this.banner(t('game.endless'), t('game.banner.endlessMode'), 3600, 'is-intro'), 350);
      return;
    }
    const goal = t('game.goal', { n: coins(this.game.config.goals[0]) });
    const intro = this.level.intro && this.level.intro !== 'basics' ? t(`game.banner.${this.level.intro}`) : '';
    const text = intro ? `${goal} ${intro}` : goal;
    this.later(() => this.banner(t('game.level', { n: this.levelId }), text, intro ? 4600 : 2600, 'is-intro'), 350);
  }

  // ---------------------------------------------------------------- tutorial (level 1)
  // The step is derived from the game state every frame, so it can never get stuck:
  // a trashed bowl or a wrong ingredient simply leads back to the matching step.
  tutorialStep() {
    const g = this.game;
    if (this.tut.done) return { key: 'done' };
    const c = g.seats.find(Boolean);
    if (!c || c.state !== 'waiting') return { key: 'welcome' };
    const v = this.custViews.get(c.id);
    const order = c.order.bowl;
    const bowls = g.bowls;
    const match = bowls.findIndex((b) => bowlMatchesOrder(b, order));
    if (match >= 0 && v) return { key: 'serve', from: this.bowlViews[match].el, to: v.fig, sub: match };
    const track = bowls.findIndex((b) => bowlOnTrack(b, order));
    if (track >= 0) {
      const ing = nextMissing(bowls[track], order);
      const bin = this.binEls[ing];
      if (bin) {
        const top = order.top.includes(ing) && order.mid.length > 0;
        return { key: 'add', ing, top, from: bin, to: this.bowlViews[track].el, sub: `${track}${ing}` };
      }
    }
    const bad = bowls.findIndex((b) => b.base || b.mid.length || b.top.length);
    if (bad >= 0) return { key: 'trash', from: this.bowlViews[bad].el, to: this.trashEl, sub: bad };
    const blenders = g.blenders;
    // an empty cup to pour into (put down while the blender still mixes)
    const cup = bowls.findIndex((b) => b.cup);
    const spot = Math.max(0, bowls.findIndex((b) => !b.cup));
    const ready = blenders.findIndex((b) => (b.state === 'ready' || b.state === 'overflowing') && b.base === order.base);
    const mixing = blenders.findIndex((b) => b.state === 'blending' && b.base === order.base);
    if (cup < 0 && (ready >= 0 || mixing >= 0)) {
      return { key: ready >= 0 ? 'cup' : 'cupWait', from: this.stackEl, to: this.bowlViews[spot].el, sub: spot };
    }
    if (ready >= 0) return { key: 'pour', from: this.blenderViews[ready].el, to: this.bowlViews[cup].el, sub: `${ready}${cup}` };
    if (mixing >= 0) return { key: 'wait', at: this.blenderViews[mixing].el, sub: mixing };
    const wrong = blenders.findIndex((b) => POURABLE.has(b.state));
    if (wrong >= 0) return { key: 'clean', from: this.blenderViews[wrong].el, to: this.trashEl, sub: wrong };
    const busy = blenders.findIndex((b) => b.state === 'blending');
    const free = blenders.findIndex((b) => b.state === 'empty');
    if (free < 0 && busy >= 0) return { key: 'waitWrong', at: this.blenderViews[busy].el, sub: busy };
    const pack = this.packEls[order.base];
    return { key: 'pack', base: order.base, from: pack, to: this.blenderViews[Math.max(0, free)].el, sub: free };
  }

  updateTutorial() {
    if (!this.tut || this.tut.finished) return;
    const step = this.tutorialStep();
    const key = `${step.key}|${step.sub ?? ''}`;
    if (key === this.tut.key) return;
    this.tut.key = key;
    this.renderTutorial(step);
    if (step.key === 'done' && !this.tut.doneTimer) {
      this.tut.doneTimer = this.later(() => this.finishTutorial(), 9000);
    }
  }

  renderTutorial(step) {
    // ingredient names are title-case labels; inside an English sentence they are common nouns
    const nm = (id) => (getLang() === 'en' ? ingName(id).toLowerCase() : ingName(id));
    const texts = {
      welcome: () => t('game.tut.welcome'),
      pack: () => t('game.tut.pack', { base: nm(step.base) }),
      wait: () => t('game.tut.wait'),
      waitWrong: () => t('game.tut.waitWrong'),
      cup: () => t('game.tut.cup'),
      cupWait: () => t('game.tut.cupWait'),
      pour: () => t('game.tut.pour'),
      add: () => t(step.top ? 'game.tut.addTop' : 'game.tut.add', { ing: nm(step.ing) }),
      trash: () => t('game.tut.trash'),
      clean: () => t('game.tut.clean'),
      serve: () => t('game.tut.serve'),
      done: () => t('game.tut.done'),
    };
    const dotAt = TUT_DOT_OF[step.key] ?? -1;
    const dots = TUT_DOTS.map((_, i) => `<i class="${i < dotAt ? 'is-past' : i === dotAt ? 'is-now' : ''}"></i>`).join('');
    let arrow = '';
    if (step.from && step.to) arrow = this.arrowMarkup(this.posOf(step.from), this.posOf(step.to));
    else if (step.at) {
      const p = this.posOf(step.at);
      arrow = `<div class="g-tut-point" style="left:${p.cx}px;top:${p.y + 4}px">${POINT_SVG}</div>`;
    }
    const ring = step.from ? (() => {
      const p = this.posOf(step.from);
      // 3 px outside the target on every side: shelf bins are only 6 px apart
      return `<div class="g-tut-ring" style="left:${p.cx}px;top:${p.cy}px;width:${p.w + 6}px;height:${p.h + 6}px"></div>`;
    })() : '';
    this.tutEl.innerHTML = `${ring}${arrow}<div class="panel g-tut-panel" data-tutorial-step="${step.key}">`
      + `<div class="g-tut-head"><span>${t('game.tut.title')}</span><span class="g-tut-dots">${dots}</span></div>`
      + `<p class="g-tut-text"></p>${step.key === 'done' ? `<button type="button" class="btn green small g-tut-go" data-tut-go>${t('game.tut.go')}</button>` : ''}</div>`;
    this.tutEl.querySelector('.g-tut-text').textContent = texts[step.key]();
    const go = this.tutEl.querySelector('[data-tut-go]');
    if (go) {
      go.addEventListener('click', () => {
        this.audio.sfx('click');
        this.finishTutorial();
      });
    }
  }

  // Curved chunky arrow from a to b (stage px), drawn as SVG over the whole screen.
  arrowMarkup(a, b) {
    const dx = b.cx - a.cx;
    const dy = b.cy - a.cy;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    if (ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    const bend = Math.min(140, len * 0.28);
    const c = { x: (a.cx + b.cx) / 2 + nx * bend, y: (a.cy + b.cy) / 2 + ny * bend };
    const at = (k) => ({
      x: (1 - k) ** 2 * a.cx + 2 * k * (1 - k) * c.x + k * k * b.cx,
      y: (1 - k) ** 2 * a.cy + 2 * k * (1 - k) * c.y + k * k * b.cy,
    });
    const k0 = Math.min(0.3, (Math.min(a.w, a.h) * 0.5 + 6) / len);
    const k1 = 1 - Math.min(0.3, (Math.min(b.w, b.h) * 0.3 + 8) / len);
    const pts = [];
    for (let i = 0; i <= 24; i++) pts.push(at(k0 + ((k1 - k0) * i) / 24));
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');
    const end = pts[pts.length - 1];
    const prev = pts[pts.length - 3];
    const ang = (Math.atan2(end.y - prev.y, end.x - prev.x) * 180) / Math.PI;
    const head = `<g transform="translate(${end.x.toFixed(1)} ${end.y.toFixed(1)}) rotate(${ang.toFixed(1)})"><path d="M10 0L-20 -21L-13 0L-20 21Z" class="g-arrow-head"/></g>`;
    return `<svg class="g-tut-arrow" viewBox="0 0 1280 800" width="1280" height="800" aria-hidden="true">`
      + `<path d="${d}" class="g-arrow-out"/><path d="${d}" class="g-arrow-in"/><path d="${d}" class="g-arrow-dash"/>${head}</svg>`;
  }

  finishTutorial() {
    if (!this.tut || this.tut.finished) return;
    this.tut.finished = true;
    releaseTutorialHold(this.game);
    markIntroSeen('basics');
    this.tutEl.replaceChildren();
    this.root.classList.remove('has-tutorial');
  }

  // ---------------------------------------------------------------- game over
  onGameOver(ev) {
    if (this.over) return;
    this.over = true;
    this.dnd.cancel();
    this.audio.loop('blender', false);
    this.audio.music(null); // fade the game track out so the jingle stands alone; results requests 'menu'
    this.toastEl?.remove();
    this.bannerEl.replaceChildren();
    this.tutEl.replaceChildren();
    const g = this.game;
    const won = ev.result === 'won';
    // an endless shift ended from the pause menu closes the shop instead of failing
    this.audio.sfx(won ? 'win' : ev.reason === 'quit' ? 'closing' : 'lose');
    this.result = this.recordResult();

    let title;
    let sub = '';
    if (this.mode === 'endless') {
      title = t('game.stamp.endless');
      sub = t('game.endlessScore', { n: coins(g.money) });
    } else {
      title = t(won ? 'game.stamp.won' : 'game.stamp.lost');
      if (!won && ev.reason) sub = t(`game.reason.${ev.reason}`);
    }
    const stars = this.mode === 'campaign' && won
      ? `<div class="g-stamp-stars">${[0, 1, 2].map((i) => `<span class="${i < g.stars ? 'is-lit' : ''}" style="animation-delay:${0.35 + i * 0.18}s">${starSVG(i < g.stars, 64)}</span>`).join('')}</div>`
      : '';
    this.stampEl.className = `g-stamp ${won ? 'is-won' : 'is-lost'}`;
    this.stampEl.innerHTML = `<div class="g-stamp-card"><div class="g-stamp-title"></div>${stars}<div class="g-stamp-sub"></div></div>`;
    this.stampEl.querySelector('.g-stamp-title').textContent = title;
    this.stampEl.querySelector('.g-stamp-sub').textContent = sub;
    this.stampEl.hidden = false;
    this.root.classList.add('is-over');
    this.later(() => this.goResults(), STAMP_MS);
  }

  // Coins are banked even when the level is lost (save.js does that).
  recordResult() {
    const g = this.game;
    const base = {
      mode: this.mode, levelId: this.levelId, result: g.result, reason: g.endReason,
      stars: g.stars, money: g.money, served: g.served, lost: g.lost,
    };
    if (this.mode === 'endless') {
      const rec = recordEndless({ money: g.money, served: g.served });
      return {
        ...base, newBest: rec.newBest, unlockedEndless: false, unlockedLevel: null,
        coinsTotal: rec.coinsTotal, best: rec.best, stage: g.stage,
      };
    }
    const rec = recordLevelResult(this.levelId, { won: g.result === 'won', stars: g.stars, money: g.money, served: g.served });
    return {
      ...base, newBest: rec.newBest, unlockedEndless: rec.unlockedEndless, unlockedLevel: rec.unlockedLevel,
      coinsTotal: rec.coinsTotal,
    };
  }

  goResults() {
    if (!this.over || this.wentToResults || this.destroyed) return;
    this.wentToResults = true;
    this.ctx.go?.('results', this.result);
  }
}

// ------------------------------------------------------------------ screen export
export const gameScreen = {
  render(container, params, ctx) {
    const view = new GameView(container, params, ctx);
    return () => view.destroy();
  },
};

export default gameScreen;
