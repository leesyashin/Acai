// Gameplay screen (docs/DESIGN.md §4.6 / §4.7). Builds the level DOM once, then one
// requestAnimationFrame loop ticks the engine and patches only what changed.
// Every player action is a drag & drop through js/drag.js.

import { INGREDIENTS, LEVELS, MATCHA_LEVEL, getLevel, ingName } from './data.js';
import { registerStrings, t, onLangChange, getLang, formatNumber } from './i18n.js';
import {
  createGame, tick, drainEvents, setPaused, releaseTutorialHold, endRun, bowlMatchesOrder,
  loadBlender, pourBlender, addIngredient, trashBowl, cleanBlender, placeCup,
  loadMatcha, trashMatcha, serveBowl, serveMatcha,
  loadBlenderError, pourError, addIngredientError, loadMatchaError, serveBowlError, serveMatchaError, placeCupError,
} from './engine.js';
import {
  ingredientIcon, packIcon, bowlSVG, matchaGlassSVG, binSVG, binFillSVG, scoopSVG, cupStackSVG, cupSpotSVG, customerSVG, lookFromSeed, blenderSVG,
  blenderBadgeSVG, matchaMachineSVG, matchaLedAt, MATCHA_SLOT_X, MATCHA_SLOT_Y, MATCHA_CUP_SIZE, MATCHA_POUR_FROM,
  trashSVG, coinSVG, heartSVG, starSVG, clockSVG, lockSVG, decorSVG, shopSceneSVG, counterSVG, freezerSVG, riserSVG,
} from './art.js';
import { has3D, createView, snapshot, still, pixelRatio } from './art3d.js';
import { blenderLook, blenderBadgeAt, blenderBox, pourFill, brewPhase } from './kitchen3d.js';
import { PANTRY_VIEW, pantryKind, pantryHasFront, pantryTop, pantryBadges } from './pantry3d.js';
import { createDragManager } from './drag.js';
import defaultAudio from './audio.js';
import { ICON } from './icons.js';
import { isBleed } from './stage.js';
import { buzz, HAPTIC } from './haptics.js';
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
    'game.praise.perfect': 'Perfekt!',
    'game.praise.great': 'Super!',
    'game.combo': 'Combo ×{n}!',
    'game.served': 'Bedient',
    'game.order': 'Bestellung',
    'game.trash': 'Mülleimer',
    'game.stack': 'Stapel mit leeren Bowls',
    'game.stackName': 'Bowls',
    'game.freezer': 'Basis',
    'game.lockedMatcha': 'Matcha ab Level {n}',
    'game.banner.overflow': 'Achtung: Ein fertiger Mixer läuft über, wenn er zu lange steht! Verdorbene Mixer ziehst du in den Müll.',
    'game.banner.moreSeats': 'Jetzt gibt es 3 Plätze – mehr Gäste gleichzeitig!',
    'game.banner.matcha': 'Neu: die Matcha-Maschine!', // short: the card before the level explains it
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
    'game.hint.glass': 'Zieh den Matcha zu einem Gast!',
    'game.hint.slotEmpty': 'Zieh eine Frucht auf das Glas!',
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
    'reason.noMatchaWanted': 'Dieser Gast möchte keinen Matcha.',
    'reason.noBowlWanted': 'Dieser Gast möchte keine Bowl.',
    'reason.alreadyDelivered': 'Das hat der Gast schon bekommen!',
    'reason.slotBusy': 'Hier steht schon ein Matcha!',
    'reason.notReady': 'Der Matcha ist noch nicht fertig!',
    'reason.notMatchaFruit': 'Daraus wird kein Matcha!',
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
    'game.praise.perfect': 'Perfect!',
    'game.praise.great': 'Great!',
    'game.combo': 'Combo ×{n}!',
    'game.served': 'Served',
    'game.order': 'Order',
    'game.trash': 'Trash can',
    'game.stack': 'Stack of empty bowls',
    'game.stackName': 'Bowls',
    'game.freezer': 'Base',
    'game.lockedMatcha': 'Matcha from level {n}',
    'game.banner.overflow': 'Careful: a ready blender overflows if it waits too long! Drag spoiled blenders to the trash.',
    'game.banner.moreSeats': 'Now there are 3 seats – more customers at once!',
    'game.banner.matcha': 'New: the matcha machine!', // short: the card before the level explains it
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
    'game.hint.glass': 'Drag the matcha to a customer!',
    'game.hint.slotEmpty': 'Drag a fruit onto the glass!',
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
    'reason.noMatchaWanted': 'This customer doesn’t want a matcha.',
    'reason.noBowlWanted': 'This customer doesn’t want a bowl.',
    'reason.alreadyDelivered': 'They already have that!',
    'reason.slotBusy': 'There’s already a matcha here!',
    'reason.notReady': 'The matcha isn’t ready yet!',
    'reason.notMatchaFruit': 'That doesn’t make a matcha!',
    'reason.emptyBowl': 'The bowl is still empty!',
    'reason.noCustomer': 'This customer has already left.',
    'reason.notPlaying': 'Not possible right now.',
    'reason.invalid': 'That doesn’t go here.',
  },
});

// ------------------------------------------------------------------ layout (stage px)
const STAGE_W = 1280;
const WORK_Y = 338; // work area top (the pass ends here); station coordinates below are relative to it
const WORK_H = 462;
// full bleed (js/stage.js): the wall, the pass and the worktop are drawn this much wider on either side and taller
// (above the wall, below the cabinet), to run on into the bands round the stage (css/game.css .is-wide-art)
const BLEED_X = 360;
const BLEED_Y = 200;
const SEAT_X = [null, [640], [420, 860], [270, 640, 1010], [200, 493, 787, 1080]];
// Blenders stand at the back of the left column, about twice as tall as a cup: a 150 × 210 hit box
// (css/game.css) with the front of the motor base on its bottom edge (stage y 548); two of them
// keep a gap, so two big jugs do not touch.
const BLENDER_X = [null, [89], [10, 170]];
const BLENDER_ART = 245; // the drawn blender without WebGL (wider than the box, transparent; as tall as the 3D 2-bowl jug)
const BLENDER_BADGE = 36;
// The cup stack stands at the left end of the cup row; stack + spots are centred in the middle column.
const MID_X0 = 330;
const MID_W = 610;
const BOWL_SLOT_W = 120;
const BOWL_SIZE = 120;
const GHOST_BOWL = Math.round(BOWL_SIZE * 1.05); // a carried cup is a little bigger (drag.js adds 1.12)
const STACK_W = 105; // its cups are the cups of bowlSVG(BOWL_SIZE) (see cupStackSVG)
const STACK_GAP = 6;
// Ingredient rows on slim oak risers, centred under the cups while they fit into the middle column,
// else from its left edge on to the right (7 toppings reach in front of the machine). Each ingredient
// stands in its own container (js/pantry3d.js): the fruit trays first, then the jar of granola.
const BIN_W = PANTRY_VIEW.w; // a bin is as wide as its container's art box
const BIN_H = 84; // css/game.css .g-bin; the art box reaches PANTRY_VIEW.h - BIN_H above it
const BIN_GAP = 6;
const RISER_PAD = 14;
const RISER_MIN = 260;
const RISER_H = 70;
// A "NEU" sticker of the front row sticks up over the back riser's front edge: where that would cover
// the layer label there (centred on the riser, "2 · Früchte & Crunch" ≈130 px wide), it goes down
// beside its container instead (pantryBadges low).
const STICKER_W = 54; // css/game.css .g-new, the widest ("NEW")
const SHELF_LABEL_HALF = 72;
const FREEZER_W = 284;
const FREEZER_H = 186;
const PACK_ART = 84;
const MACHINE_SIZE = 312; // the machine box is its square canvas (VIEWS.machine) or drawn art
const SLOT_W = 96; // a slot: the glass on a drip tray (two of them keep a gap)
const DECOR_IDS = ['plants', 'jukebox', 'seating', 'neon'];
// the neon is small: its sign fits on the wainscot under the rail, between two guests' shoulders
const DECOR_SIZE = { plants: 118, jukebox: 118, seating: 124, neon: 90 };
const JUKEBOX_X = 1222;
const FIG_CHIN_Y = 98; // just under a guest's chin, in its figure's box (customerSVG, 160 px: the chin at y≈93)
// Order bubbles (css/game.css .g-bubble): the base cup, the items of rows 2 and 3 (each on a tinted circle), the
// matcha glass and its fruit badge. A bubble's width follows from its order (bubbleWidth, no layout read): its frame
// (border 2 + padding 6 a side), the bowl part (padding 3 a side, the cup, a 4 px gap, then its longer row: the 18 px
// layer badge + 1, then a 2 px gap and an icon per item), the drink part (13 px for the divider, padding 3 a side, the
// glass with its transparent sides tucked in by 12 px on the left and its fruit badge reaching 14 px past it).
// BUBBLE_W is the widest one (3 + 3 items and a matcha, 306 px): each seat owns a slot that wide, BUBBLE_EDGE inside
// the stage and at least BUBBLE_GAP from its neighbour's, and a bubble stays in its slot (bubbleShift).
const BUBBLE_CUP = 50;
const BUBBLE_ICON = 40;
const BUBBLE_GLASS = 64;
const BUBBLE_FRUIT = 22;
const BUBBLE_FRAME = 2 * (2 + 6);
const BUBBLE_BOWL = 2 * 3 + BUBBLE_CUP + 4;
const BUBBLE_DRINK = 13 + 2 * 3 + BUBBLE_GLASS - 12 + 14;
const bubbleRow = (n) => (n > 0 ? 18 + 1 + n * (2 + BUBBLE_ICON) : 0);
const bubbleWidth = (o) => BUBBLE_FRAME + BUBBLE_BOWL + Math.max(bubbleRow(o.bowl.mid.length), bubbleRow(o.bowl.top.length))
  + (o.matcha ? BUBBLE_DRINK : 0);
const BUBBLE_W = BUBBLE_FRAME + BUBBLE_BOWL + bubbleRow(3) + BUBBLE_DRINK;
const BUBBLE_EDGE = 6;
const BUBBLE_GAP = 8;
const CHIP_ICON = 22; // an item's icon in its chip under a cup (css/game.css .g-chip)
const BIN_REACH = 12; // stage px an ingredient's hit area reaches above its box (css/game.css .g-bin::before)
const CHIP_ROW = 3; // chips side by side under a cup: two rows of 3 hold MAX_BOWL_ITEMS (js/data.js)
const LAYER_NUM = { base: 1, mid: 2, top: 3 };
const MOODS = ['happy', 'neutral', 'impatient', 'angry'];
const STAMP_MS = 1700;
const PRAISE_PERFECT = 0.75; // patience left when served: "Perfekt!" from here, "Super!" from PRAISE_GREAT
const PRAISE_GREAT = 0.45;
const SPARKLES = 10;
const LABEL_LEVELS = 3; // name tags and layer labels stay on in the first levels; later they show on hover or while held
const MAX_FRAME_DT = 0.25;
const STILL_SETTLE_MS = 200; // a new pixel ratio draws the containers again once it has held this long
// Progress bars (patience, blender/matcha timers, blender ring) write on one shared cadence:
// in Chromium every frame with such a write re-layerizes the whole stage.
const BAR_TICK = 0.1; // s
const BAR_STEPS = 100;
const BAR_JUMP = 0.05; // bigger changes (a refill, a new blend) are written at once
const HIT_PAD = 18; // stage px around a station, as in drag.js

const ACTIVE = new Set(['arriving', 'waiting']);
const POURABLE = new Set(['ready', 'overflowing', 'ruined']);
// whole seconds a blender has left to blend (its display counts them down)
const secsLeft = (b) => (b.state === 'blending' ? Math.ceil((1 - b.progress) * (b.duration || 0)) : 0);
// a matcha slot's brew progress in the 3D machine's steps (it redraws 60 times per brew)
const brewStep = (s) => (s.state === 'mixing' ? Math.round(s.progress * 60) / 60 : 0);
const TUT_DOTS = ['pack', 'cup', 'wait', 'pour', 'add', 'serve', 'done'];
const TUT_DOT_OF = { welcome: -1, pack: 0, clean: 0, cup: 1, cupWait: 1, wait: 2, waitWrong: 2, pour: 3, add: 4, trash: 4, serve: 5, done: 6 };

const CHECK_SVG = '<svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="#2fbf71" stroke="#2a1236" stroke-width="3"/><path d="M11.5 20.5l6 6 11-12" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// the big tick over a delivered part of an order bubble: a glossy green disc in a white ring
const DONE_SVG = '<svg viewBox="0 0 40 40" width="38" height="38" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="#2fbf71" stroke="#fff" stroke-width="2.5"/><path d="M4.5 22a15.5 15.5 0 0 0 31 0Z" fill="#127a44" opacity="0.22"/><ellipse cx="17" cy="11" rx="9" ry="4.5" fill="#fff" opacity="0.28"/><path d="M11.5 20.5l6 6 11-12" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
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
const ANIM_MS = { 'is-quake': 450, 'is-reject': 450, 'is-squash': 350, 'is-pop': 450, 'is-wobble': 500, 'is-hop': 500, 'is-bump': 300, 'is-breaking': 650 };

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

// A guest's bust in its mood; with open eyes (neutral, impatient) a second picture with the eyes shut lies on top
// and shows for a blink now and then (css/game.css .g-blink), each guest on a beat of their own.
function figureMarkup(v, mood) {
  const pic = customerSVG(v.look, mood, 160);
  if (mood !== 'neutral' && mood !== 'impatient') return pic;
  const delay = ((v.id * 1.37) % 4).toFixed(2);
  return `${pic}<span class="g-blink" style="--blink-at:-${delay}s">${customerSVG(v.look, mood, 160, true)}</span>`;
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
    this.animT = 0; // clock of the 3D appliance animations (stops while paused)
    this.streak = 0; // guests served in a row without one leaving angry (the combo; feedback only, no coins)
    this.lid = { x: 0, v: 0 }; // trash lid and freezer cold-air springs (0 closed / still … 1 open / taking)
    this.door = { x: 0, v: 0 };

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
    const matcha = this.mode === 'endless' || this.levelId >= MATCHA_LEVEL;
    const tutorial = this.levelId === 1 && !save.seenIntros?.basics;
    const seed = Number.isFinite(p.seed) ? p.seed : ((Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0) || 1;
    this.featured = new Set(save.newIngredients || []);
    this.game = createGame({
      mode: this.mode,
      level: this.level,
      owned: save.owned.slice(),
      ingLevels: { ...save.ingLevels },
      kitchen: kitchenStats(),
      matcha,
      seed,
      tutorial,
      featured: [...this.featured],
    });
    this.best = save.endlessBest || 0;
    this.tut = tutorial ? { key: '', done: false, finished: false } : null;
    // the appliances are 3D (WebGL) with the upgraded models; without WebGL the drawn art stays
    this.k3d = has3D();
    this.wideArt = isBleed();
    this.look = blenderLook(save.upgrades);
    window.__acaiGame = this.game;
  }

  // ---------------------------------------------------------------- DOM build
  build() {
    const g = this.game;
    const root = el('div', 'screen screen-game', { 'data-mode': this.mode, 'data-level': this.levelId ?? 'endless' });
    this.root = root;
    if (this.k3d) root.classList.add('is-3d');
    if (g.matcha) root.classList.add('has-matcha');
    if (this.tut) root.classList.add('has-tutorial');
    if (this.wideArt) root.classList.add('is-wide-art');
    if (this.mode === 'endless' || this.levelId > LABEL_LEVELS) root.classList.add('is-quiet-labels');
    root.append(this.buildScene(), el('div', 'g-counter'), this.buildWork(), el('div', 'g-vignette'), this.buildHud());
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
    const top = el('div', 'g-worktop');
    top.innerHTML = counterSVG(STAGE_W, WORK_H, this.wideArt ? { bleed: BLEED_X, below: BLEED_Y } : undefined);
    work.append(top);

    // blenders; the status badge (ring while blending, ✓, !, spoiled) sits over the right end of the
    // lid: placed on the 3D model's lid, or where blenderSVG would draw it (127, 22 of 150), further
    // left (over the handle's top) so it stays inside the blender's box
    const bx = BLENDER_X[g.blenders.length] || BLENDER_X[2];
    const badgeAt = this.k3d ? blenderBadgeAt(this.look.tier, this.look.big) : { x: (119 * BLENDER_ART) / 150, y: (22 * BLENDER_ART) / 150 };
    this.blenderViews = g.blenders.map((b, i) => {
      const node = el('div', 'g-blender', { 'data-blender': i, 'data-state': b.state, 'data-model': this.look.tier });
      node.style.left = `${bx[i]}px`;
      const art = el('div', 'g-art');
      const badge = el('div', 'g-badge');
      badge.style.left = `${Math.round(badgeAt.x)}px`;
      badge.style.top = `${Math.round(badgeAt.y)}px`;
      const timer = el('div', 'g-timer');
      const fill = el('i');
      timer.append(fill);
      node.append(art, timer);
      work.append(node);
      const v = { el: node, art, badge, timer, fill, state: null, ring: null, ringP: -1 };
      if (this.k3d) {
        v.view = createView('blender');
        art.append(v.view.el);
      } else {
        v.pic = el('div', 'g-pic');
        art.append(v.pic);
      }
      art.append(badge);
      return v;
    });
    // the crop boxes of the drag ghosts: measured now rather than at the first pickup
    if (this.k3d) for (const s of POURABLE) blenderBox(this.look.tier, this.look.big, s);

    // chest freezer built into the counter, the base packs (owned bases only) standing in it: the
    // frame's front edge is drawn over the packs, their names over the frame
    const freezer = el('div', 'g-freezer');
    const packs = el('div', 'g-packs');
    this.freezerLabel = el('span', 'g-freezer-label');
    this.packEls = {};
    for (const ing of INGREDIENTS) {
      if (ing.layer !== 'base' || !g.owned.includes(ing.id)) continue;
      const node = el('div', 'g-pack', { 'data-pack': ing.id });
      node.innerHTML = `<div class="g-art">${packIcon(ing.id, PACK_ART)}</div><span class="g-name"></span>${this.qualityMarkup(ing.id)}${this.badgeMarkup(ing.id)}`;
      packs.append(node);
      this.packEls[ing.id] = node;
    }
    if (this.k3d) {
      // 3D: the frosty well behind the packs, the glass lid and the frame in front of them
      freezer.classList.add('is-3d');
      this.freezerBack = createView('freezer', 'g-3d-back');
      this.freezerFront = createView('freezer', 'g-3d-front');
      freezer.append(this.freezerBack.el, packs, this.freezerFront.el, this.freezerLabel);
    } else {
      const well = el('div', 'g-freezer-well');
      well.innerHTML = freezerSVG('well', FREEZER_W, FREEZER_H);
      const rim = el('div', 'g-freezer-rim');
      rim.innerHTML = freezerSVG('rim', FREEZER_W, FREEZER_H);
      freezer.append(well, packs, rim, this.freezerLabel);
    }
    work.append(freezer);

    // cup stack + bowl spots: a cup goes down from the stack before anything goes into it
    const n = g.bowls.length;
    const x0 = MID_X0 + (MID_W - (STACK_W + STACK_GAP + n * BOWL_SLOT_W)) / 2;
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

    // ingredient containers (owned only) in two rows on slim oak risers, fruits & crunch behind
    // toppings & sauces; each riser names its layer on its front edge ("2 · Früchte & Crunch") like the
    // freezer, so the layer-rule toasts point at visible words. With WebGL a container is a 3D picture
    // (drawn once, js/art3d.js still()) with what lies in it as SVG on top and, for the trays, the
    // coconut and the bowl, its front rim over that again.
    this.binEls = {};
    this.binStills = [];
    this.shelfLabels = {};
    let labelX = null; // the middle of the back riser's layer label (the riser is centred on its row)
    for (const layer of ['mid', 'top']) {
      const shelf = el('div', `g-shelf g-shelf-${layer}`, { 'data-layer': layer });
      const row = el('div', 'g-shelf-row');
      const list = INGREDIENTS.filter((ing) => ing.layer === layer && g.owned.includes(ing.id));
      list.sort((a, b) => (pantryKind(b.id) === 'tray') - (pantryKind(a.id) === 'tray'));
      const n = list.length;
      const rowW = n * BIN_W + Math.max(0, n - 1) * BIN_GAP;
      const x = rowW <= MID_W ? MID_X0 + (MID_W - rowW) / 2 : MID_X0;
      list.forEach((ing, i) => {
        // the chocolate is carried as its whole squeeze bottle
        const node = el('div', 'g-bin', { 'data-bin': ing.id, 'data-layer': layer, 'data-carry': pantryKind(ing.id) === 'bottle' ? 'whole' : null });
        const art = el('div', 'g-art');
        if (!this.k3d || !this.binArt3D(art, ing.id)) art.innerHTML = binSVG(ing.id, BIN_W);
        node.append(art);
        node.insertAdjacentHTML('beforeend', `<span class="g-name"></span><span class="g-lnum g-lnum-${layer}">${LAYER_NUM[layer]}</span>${this.qualityMarkup(ing.id)}${this.badgeMarkup(ing.id)}`);
        // the badges sit beside the container (not in the air above a flat one, nor on a dipper or nozzle)
        const q = this.quality(ing.id);
        let badges = pantryBadges(ing.id, { q });
        if (labelX !== null && this.featured.has(ing.id)) {
          const { fresh } = badges;
          const x0 = x + i * (BIN_W + BIN_GAP) + ('left' in fresh ? fresh.left : BIN_W + fresh.right - STICKER_W);
          if (x0 < labelX + SHELF_LABEL_HALF && x0 + STICKER_W > labelX - SHELF_LABEL_HALF) badges = pantryBadges(ing.id, { q, low: true });
        }
        const { lnum, stars, fresh } = badges;
        const up = PANTRY_VIEW.h - BIN_H; // the art box reaches this far above the bin
        const css = { 'lnum-x': lnum[0], 'lnum-y': lnum[1] - up, 'stars-x': stars[0], 'stars-y': stars[1] - up, 'new-y': fresh.top - up };
        if ('left' in fresh) css['new-l'] = fresh.left;
        else css['new-r'] = fresh.right;
        for (const [k, v] of Object.entries(css)) node.style.setProperty(`--${k}`, `${v}px`);
        row.append(node);
        this.binEls[ing.id] = node;
      });
      labelX = x + rowW / 2;
      const w = Math.max(RISER_MIN, rowW + RISER_PAD * 2);
      shelf.style.left = `${Math.round(x + rowW / 2 - w / 2)}px`;
      shelf.style.width = `${w}px`;
      const riser = el('div', 'g-riser');
      riser.innerHTML = riserSVG(w, RISER_H);
      const label = el('span', `g-shelf-label g-shelf-label-${layer}`);
      shelf.append(riser, row, label);
      this.shelfLabels[layer] = label;
      work.append(shelf);
    }

    // matcha machine with a glass on each drip tray (the slots)
    this.slotViews = [];
    if (g.matcha) {
      const count = g.matcha.slots.length;
      const machine = el('div', 'g-machine', { 'data-model': count });
      if (this.k3d) {
        this.machineView = createView('machine');
        machine.append(this.machineView.el);
      } else {
        machine.innerHTML = matchaMachineSVG(count, MACHINE_SIZE);
      }
      const glass = Math.round(MACHINE_SIZE * MATCHA_CUP_SIZE);
      const xs = MATCHA_SLOT_X[count] || MATCHA_SLOT_X[2];
      g.matcha.slots.forEach((s, i) => {
        const node = el('div', 'g-slot', { 'data-matcha-slot': i, 'data-state': s.state });
        const left = Math.round(xs[i] * MACHINE_SIZE - SLOT_W / 2);
        const top = Math.round(MATCHA_SLOT_Y * MACHINE_SIZE - glass - 16);
        node.style.left = `${left}px`;
        node.style.top = `${top}px`;
        node.style.setProperty('--glass', `${glass}px`);
        const art = el('div', 'g-art');
        const timer = el('div', 'g-timer');
        const fill = el('i');
        timer.append(fill);
        node.append(art, timer);
        if (!this.k3d) {
          // the drawn machine's status LED, lit over the drawing (amber while brewing, green when ready)
          const [lx, ly] = matchaLedAt(count, i);
          const led = el('i', 'g-led');
          led.style.left = `${Math.round(lx - left)}px`;
          led.style.top = `${Math.round(ly - top)}px`;
          node.append(led);
        }
        machine.append(node);
        this.slotViews.push({ el: node, art, timer, fill, glass, state: null, pouring: false });
      });
      work.append(machine);
    } else if (this.mode === 'campaign') {
      // teaser: the machine arrives in a later level
      const machine = el('div', 'g-machine is-locked', { 'aria-hidden': 'true' });
      this.lockLabel = el('span', 'g-lock-label');
      machine.innerHTML = `<div class="g-art">${this.k3d ? '' : matchaMachineSVG(1, MACHINE_SIZE)}</div><span class="g-lock">${lockSVG(54)}</span>`;
      if (this.k3d) {
        const teaser = createView('machine');
        machine.querySelector('.g-art').append(teaser.el);
        teaser.draw({ slots: [{ state: 'empty' }] }, 0);
      }
      machine.append(this.lockLabel);
      work.append(machine);
    }

    // trash can
    this.trashEl = el('div', 'g-trash', { 'data-trash': '', role: 'img' });
    if (this.k3d) {
      this.trashView = createView('trash');
      const art = el('div', 'g-art');
      art.append(this.trashView.el);
      this.trashEl.append(art);
    } else {
      this.trashEl.innerHTML = `<div class="g-art">${trashSVG(134)}</div>`;
    }
    work.append(this.trashEl);
    return work;
  }

  badgeMarkup(id) {
    return this.featured.has(id) ? '<span class="g-new"></span>' : '';
  }

  // The 3D container of an ingredient: its picture, what lies in it, its front rim. false when a
  // picture cannot be drawn (the caller keeps the drawn art).
  binArt3D(art, id) {
    const kind = pantryKind(id); // the fruit trays share one picture
    const layers = pantryHasFront(id) ? ['back', 'front'] : ['back'];
    const pics = layers.map((layer) => ({ key: `${kind}|${layer}`, o: { kind, layer }, c: still('pantry', { kind, layer }) }));
    if (pics.some((p) => !p.c)) return false;
    art.append(pics[0].c);
    if (pantryTop(id)) art.insertAdjacentHTML('beforeend', binFillSVG(id, BIN_W));
    if (pics[1]) art.append(pics[1].c);
    this.binStills.push(...pics);
    this.stillPr = pixelRatio();
    return true;
  }

  // Quality upgrades (0–2 stars) on packs and bins alike.
  quality(id) {
    return Math.max(0, Math.min(2, Math.floor(Number(this.game.ingLevels[id]) || 0)));
  }

  qualityMarkup(id) {
    const q = this.quality(id);
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
    // icon + label; the label is a span of its own so a language switch leaves the icon alone
    const pauseBtn = (cls, action, icon) => {
      const b = el('button', `btn ${cls}`, { type: 'button', 'data-action': action });
      b.innerHTML = `${icon}<span class="g-btn-label"></span>`;
      return b;
    };
    this.pauseButtons = {
      resume: pauseBtn('green', 'resume', ICON.play(34)),
      restart: pauseBtn('', 'restart', ICON.retry(34)),
      quit: pauseBtn('pink', 'quit', this.mode === 'endless' ? ICON.flag(34) : ICON.map(34)),
    };
    btns.append(this.pauseButtons.resume, this.pauseButtons.restart, this.pauseButtons.quit);
    // campaign: leaving forfeits the round (endless banks it instead, see exitRun)
    this.pauseNote = el('p', 'g-pause-note', { hidden: '' });
    const toggles = el('div', 'g-toggles');
    // icon switches: the icon shows the state (crossed out when off), the label names the channel
    const toggle = (key) => {
      const b = el('button', 'btn small cream g-toggle', { type: 'button', 'data-toggle': key });
      b.innerHTML = '<span class="g-toggle-ico"></span><span class="g-btn-label"></span><span class="g-toggle-led" aria-hidden="true"></span>';
      return b;
    };
    this.toggleBtns = { music: toggle('music'), sfx: toggle('sfx') };
    toggles.append(this.toggleBtns.music, this.toggleBtns.sfx);
    panel.append(this.pauseTitle, btns, this.pauseNote, toggles);
    ov.append(panel);
    this.pauseEl = ov;
    return ov;
  }

  // The café's back wall for `seats` guests (with 4 it leaves out the chalkboard and the shelf, which the
  // outer order bubbles would hide all but for slivers); drawn again on a language switch (the board's title).
  drawWall(seats) {
    this.wallSeats = seats;
    this.wallEl.innerHTML = shopSceneSVG(1280, 330, this.wideArt ? { seats, bleed: BLEED_X, above: BLEED_Y } : { seats });
  }

  // All language-dependent static text (also used on language change).
  applyTexts() {
    this.drawWall(this.game.seats.length);
    if (this.decorEls.neon) this.decorEls.neon.innerHTML = decorSVG('neon', DECOR_SIZE.neon);
    for (const [id, node] of Object.entries(this.packEls)) setText(node.querySelector('.g-name'), ingName(id, true));
    for (const [id, node] of Object.entries(this.binEls)) setText(node.querySelector('.g-name'), ingName(id, true));
    for (const node of this.root.querySelectorAll('.g-new')) setText(node, t('game.new'));
    setText(this.freezerLabel, `${LAYER_NUM.base} · ${t('game.freezer')}`);
    for (const [layer, node] of Object.entries(this.shelfLabels)) setText(node, `${LAYER_NUM[layer]} · ${t(`layer.${layer}`)}`);
    if (this.lockLabel) setText(this.lockLabel, t('game.lockedMatcha', { n: MATCHA_LEVEL }));
    this.trashEl.setAttribute('aria-label', t('game.trash'));
    this.stackEl.setAttribute('aria-label', t('game.stack'));
    setText(this.stackEl.querySelector('.g-name'), t('game.stackName'));
    this.pauseBtn.setAttribute('aria-label', t('game.aria.pause'));
    this.clockEl.setAttribute('aria-label', t('game.aria.time'));
    for (const v of this.custViews.values()) v.bubble.setAttribute('aria-label', this.bubbleLabel(v.c));
    setText(this.pauseTitle, t('game.pause'));
    setText(this.pauseButtons.resume.querySelector('.g-btn-label'), t('game.resume'));
    setText(this.pauseButtons.restart.querySelector('.g-btn-label'), t('game.restart'));
    setText(this.pauseButtons.quit.querySelector('.g-btn-label'), t(this.mode === 'endless' ? 'game.endShift' : 'game.quitMap'));
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
      btn.setAttribute('aria-label', `${t(`game.${key}`)}: ${t(on ? 'game.on' : 'game.off')}`);
      btn.classList.toggle('is-off', !on);
      const ico = btn.querySelector('.g-toggle-ico');
      const sig = `${key}:${on}`;
      if (ico._sig !== sig) {
        ico._sig = sig;
        ico.innerHTML = key === 'music' ? (on ? ICON.note(36) : ICON.noteOff(36)) : (on ? ICON.soundOn(38) : ICON.soundOff(38));
      }
      setText(btn.querySelector('.g-btn-label'), t(`game.${key}`));
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

  // Rect of an element as drawn (transforms included) in stage px – the way drag.js hit-tests it; with more elements
  // the rect around all of them (a target's element and its hitEls).
  stageRect(node, ...more) {
    const r = node.getBoundingClientRect();
    let [x1, y1, x2, y2] = [r.left, r.top, r.right, r.bottom];
    for (const m of more) {
      const q = m.getBoundingClientRect();
      if (!(q.width > 0 || q.height > 0)) continue;
      [x1, y1, x2, y2] = [Math.min(x1, q.left), Math.min(y1, q.top), Math.max(x2, q.right), Math.max(y2, q.bottom)];
    }
    const a = this.toStage(x1, y1);
    const b = this.toStage(x2, y2);
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
        // a handful or spoonful at 84 px; the chocolate's whole squeeze bottle (74 % of its picture) about as
        // long as it stands on the riser (drag.js enlarges ghosts by 1.12)
        ghost: () => scoopSVG(id, pantryKind(id) === 'bottle' ? 110 : 84),
        onTap: () => this.hint(node, 'game.hint.bin'),
        reach: BIN_REACH, // a press on the raised hit area that slides a little is still a hold, never a drop on the cup above
      });
    }

    this.blenderViews.forEach((v, i) => {
      dnd.source(v.el, {
        payload: () => {
          const b = g.blenders[i];
          return this.canAct() && POURABLE.has(b.state) ? { kind: 'blender', idx: i } : null;
        },
        // carried at about its size on the counter (drag.js enlarges ghosts by 1.12)
        ghost: () => {
          const b = g.blenders[i];
          if (v.view?.el.width) return snapshot(v.view, 0.9, blenderBox(this.look.tier, this.look.big, b.state));
          return blenderSVG({ tier: this.look.tier, state: b.state, base: b.base, progress: b.progress, remaining: secsLeft(b), portions: b.portions, maxPortions: b.maxPortions, badge: false }, Math.round(BLENDER_ART * 0.9));
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
      ghost: () => bowlSVG(null, GHOST_BOWL),
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
        ghost: () => bowlSVG(g.bowls[i], GHOST_BOWL),
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
        payload: () => (this.canAct() && g.matcha.slots[i].state !== 'empty' ? { kind: 'glass', idx: i } : null),
        ghost: () => {
          const s = g.matcha.slots[i];
          return matchaGlassSVG(s.fruit, s.state, v.glass, { fill: s.state === 'mixing' ? pourFill(s.progress) : null, stream: false });
        },
        onTap: () => this.hint(v.el, 'game.hint.glass'),
      });
      dnd.target(v.el, {
        accepts: (p) => p.kind === 'ing' && p.layer === 'mid',
        valid: (p) => !loadMatchaError(g, i, p.id),
        drop: (p) => act(() => loadMatcha(g, i, p.id)),
      });
      this.listen(v.el, 'pointerdown', () => {
        if (g.matcha.slots[i].state === 'empty') this.hint(v.el, 'game.hint.slotEmpty');
      });
    });

    dnd.target(this.trashEl, {
      accepts: (p) => p.kind === 'bowl' || p.kind === 'blender' || p.kind === 'glass',
      drop: (p) => act(() => {
        if (p.kind === 'bowl') return trashBowl(g, p.idx);
        if (p.kind === 'blender') return cleanBlender(g, p.idx);
        return trashMatcha(g, p.idx);
      }),
    });
    this.listen(this.trashEl, 'pointerdown', () => this.hint(this.trashEl, 'game.hint.trash'));
  }

  // Customer elements come and go – they register as drop targets while they exist: the guest and its order bubble
  // (wider than the guest, a drink is dropped on its icon); what they take shrinks into the guest, not into the middle
  // of guest and (pushed aside) bubble. A wrong order still glows: reading the order bubble is the player's job.
  wireCustomer(v) {
    const g = this.game;
    v.offTarget = this.dnd.target(v.el, {
      hitEls: [v.bubble],
      land: v.fig,
      accepts: (p) => (p.kind === 'bowl' || p.kind === 'glass') && ACTIVE.has(v.c.state),
      valid: (p) => {
        const r = p.kind === 'bowl' ? serveBowlError(g, p.idx, v.id) : serveMatchaError(g, p.idx, v.id);
        return !r || r === 'wrongOrder';
      },
      drop: (p) => {
        if (!this.canAct()) return { ok: false, reason: 'notPlaying' };
        if (p.kind !== 'bowl') return serveMatcha(g, p.idx, v.id);
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
      buzz(HAPTIC.reject);
      restartAnim(r.targetEl, 'is-reject');
      if (r.reason) this.toast(t(`reason.${r.reason}`), r.targetEl, 'bad');
      return;
    }
    const w = r.pos && this.canAct() ? this.wrongStation(r) : null;
    if (w) {
      this.audio.sfx('reject');
      buzz(HAPTIC.reject);
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
      pack: 'game.hint.pack', ing: 'game.hint.bin', bowl: 'game.hint.bowl', glass: 'game.hint.glass', newcup: 'game.hint.stack',
      blender: ruined ? 'game.hint.blenderRuined' : 'game.hint.blender',
    }[p.kind];
    // station type → hint, only for the stations that never take this kind of item
    const wrong = {
      pack: { bowl: 'reason.packToBlender', slot: hint, trash: hint, cust: hint },
      ing: { blender: 'reason.wrongLayer', slot: p.layer === 'mid' ? null : 'reason.notMatchaFruit', trash: hint, cust: hint },
      blender: { blender: hint, slot: hint, cust: hint },
      bowl: { blender: hint, bowl: hint, slot: hint },
      glass: { blender: hint, bowl: hint, slot: hint },
      newcup: { blender: hint, slot: hint, trash: hint, cust: hint },
    }[p.kind];
    if (!wrong) return null;
    const source = { blender: this.blenderViews, bowl: this.bowlViews, glass: this.slotViews }[p.kind]?.[p.idx]?.el;
    // each station's element with the elements its hit rect spans, as drag.js hit-tests it (a guest: its order bubble)
    const stations = {
      blender: this.blenderViews.map((v) => [v.el]),
      bowl: this.bowlViews.map((v) => [v.el]),
      slot: this.slotViews.map((v) => [v.el]),
      trash: [[this.trashEl]],
      cust: [...this.custViews.values()].filter((v) => ACTIVE.has(v.c.state)).map((v) => [v.el, v.bubble]),
    };
    const { x, y } = r.pos;
    let best = null;
    let bestDist = Infinity;
    for (const [type, key] of Object.entries(wrong)) {
      if (!key) continue;
      for (const nodes of stations[type]) {
        if (nodes[0] === source) continue;
        const b = this.stageRect(...nodes);
        if (x < b.x1 - HIT_PAD || x > b.x2 + HIT_PAD || y < b.y1 - HIT_PAD || y > b.y2 + HIT_PAD) continue;
        const dist = Math.hypot(x - b.cx, y - b.cy);
        if (dist < bestDist) {
          best = { el: nodes[0], key };
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
    // in the router's screen container (data-screen) the café stays as it is: the container leaves through the
    // transition (js/curtain.js) and goes with it; rendered straight into a page (the test harness), it goes now
    if (!this.container.dataset?.screen) this.root.remove();
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
    if (this.k3d) this.update3D(dt);
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
        this.streak += 1;
        buzz(this.streak >= 3 ? HAPTIC.combo : HAPTIC.pay);
        this.payFx(ev);
        if (this.tut && !this.tut.done) this.tut.done = true;
        break;
      case 'customerLost':
        a.sfx('angry');
        a.sfx('heart');
        this.streak = 0;
        buzz(HAPTIC.lost);
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
      case 'matchaStart':
        a.sfx('plop');
        break;
      case 'matchaReady':
        a.sfx('matchaReady');
        restartAnim(this.slotViews[ev.idx]?.art, 'is-pop');
        break;
      case 'trash':
        a.sfx('trash');
        restartAnim(this.trashEl.querySelector('.g-art'), 'is-wobble');
        this.lid.v = -9; // the lid falls shut with a bounce
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
      if (count !== this.wallSeats) this.drawWall(count);
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
      // x: -1 – the first update places the bubble on its seat (bubbleShift)
      state: '', x: -1, mood: '', delivered: '', fill: bubble.querySelector('.g-patience i'),
      ratio: -1, bw: bubbleWidth(c.order), dx: 0,
    };
    this.custViews.set(c.id, v);
    this.wireCustomer(v);
    return v;
  }

  // The order bubble, built once per guest (updateCustomer only ticks parts off and moves the patience bar).
  // Left the bowl: its base cup (layer badge 1), then a row of fruits & crunch (2) and one of toppings &
  // sauces (3, left out when there are none), each item on a circle in its layer's tint; right, behind a
  // divider, the matcha glass with its fruit beside it (the badge leaves the purée at the bottom visible).
  bubbleMarkup(c) {
    const o = c.order;
    const icons = (layer, ids) => ids.map((id) => `<span class="g-ico g-ico-${layer}">${ingredientIcon(id, BUBBLE_ICON)}</span>`).join('');
    const row = (layer, ids) => (ids.length ? `<div class="g-row g-row-${layer}"><span class="g-lnum g-lnum-${layer}">${LAYER_NUM[layer]}</span>${icons(layer, ids)}</div>` : '');
    const check = `<span class="g-check">${DONE_SVG}</span>`;
    const base = `<div class="g-order-base"><span class="g-lnum g-lnum-base">1</span>${bowlSVG({ base: o.bowl.base, mid: [], top: [] }, BUBBLE_CUP)}</div>`;
    const bowl = `<div class="g-order-part g-order-bowl" data-part="bowl">${base}<div class="g-rows">${row('mid', o.bowl.mid)}${row('top', o.bowl.top)}</div>${check}</div>`;
    // the fruit badge names the matcha like the bowl rows name their items (colour alone is too little)
    const drink = o.matcha
      ? `<div class="g-order-part g-order-drink" data-part="matcha"><span class="g-drink-wrap">${matchaGlassSVG(o.matcha, 'ready', BUBBLE_GLASS)}<span class="g-drink-fruit">${ingredientIcon(o.matcha, BUBBLE_FRUIT)}</span></span>${check}</div>`
      : '';
    return `<div class="g-order">${bowl}${drink}</div><div class="g-patience"><i></i></div>`;
  }

  // How far a bubble of width w moves off the centre of its seat to stay in the seat's slot; its tail stays on the
  // guest's head (css/game.css --dx). The slots are where the widest bubbles go: on their guests while all of them
  // fit side by side (2 and 3 seats), else spread evenly over the stage, the same gap between each two (4 seats:
  // the outer ones pushed out further than the middle ones). A narrower bubble is centred on its guest while that
  // keeps it in its slot.
  bubbleShift(seat, w) {
    const xs = SEAT_X[this.seatCount] || SEAT_X[4];
    const half = BUBBLE_W / 2;
    const fits = xs.every((sx, i) => sx - half >= BUBBLE_EDGE && sx + half <= STAGE_W - BUBBLE_EDGE
      && (i === 0 || sx - xs[i - 1] >= BUBBLE_W + BUBBLE_GAP));
    const gap = xs.length > 1 ? (STAGE_W - 2 * BUBBLE_EDGE - xs.length * BUBBLE_W) / (xs.length - 1) : 0;
    const x = this.seatX(seat);
    const mid = fits ? x : BUBBLE_EDGE + half + seat * (BUBBLE_W + gap);
    return Math.round(Math.min(mid + half - w / 2, Math.max(mid - half + w / 2, x)) - x);
  }

  // Accessible name of the order bubble (it is role="img"), with what was already handed over.
  bubbleLabel(c) {
    const o = c.order;
    const done = (yes) => (yes ? ` (${t('game.served')})` : '');
    const bowl = [o.bowl.base, ...o.bowl.mid, ...o.bowl.top].map((id) => ingName(id)).join(', ');
    const drink = o.matcha ? `; ${t(`matcha.${o.matcha}`)}${done(c.delivered.matcha)}` : '';
    return `${t('game.order')}: ${bowl}${done(c.delivered.bowl)}${drink}`;
  }

  updateCustomer(v, c, seat) {
    v.c = c;
    const x = this.seatX(seat);
    if (x !== v.x) {
      v.x = x;
      v.el.style.left = `${x}px`;
      const dx = this.bubbleShift(seat, v.bw);
      if (dx !== v.dx) {
        v.dx = dx;
        v.bubble.style.setProperty('--dx', `${dx}px`);
      }
    }
    if (c.state !== v.state) {
      if (v.state) v.el.classList.remove(`is-${v.state}`);
      v.state = c.state;
      v.el.dataset.state = c.state;
      v.el.classList.add(`is-${c.state}`);
    }
    const mood = MOODS.includes(c.mood) ? c.mood : 'neutral';
    if (patch(v.fig, `${mood}`, () => figureMarkup(v, mood)) || v.mood !== mood) {
      v.mood = mood;
      v.bubble.dataset.mood = mood;
    }
    const delivered = `${c.delivered.bowl ? 1 : 0}${c.delivered.matcha ? 1 : 0}`;
    if (delivered !== v.delivered) {
      v.delivered = delivered;
      v.bubble.querySelector('[data-part="bowl"]')?.classList.toggle('is-done', c.delivered.bowl);
      v.bubble.querySelector('[data-part="matcha"]')?.classList.toggle('is-done', c.delivered.matcha);
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
    place('jukebox', JUKEBOX_X);
    place('seating', xs.length > 1 ? gapMid(0) : 330);
    // the neon hangs from the wainscot's rail, under the faces (css/game.css): with 3 and 4 seats between the two
    // right guests' shoulders (x 825, 934; tools/art-preview.html places a copy there for its 4-seat scene), with 1
    // and 2 seats – the chair stands in their gap – between the last guest and the jukebox
    place('neon', xs.length > 2 ? gapMid(xs.length - 2) : (xs[xs.length - 1] + JUKEBOX_X) / 2);
    for (const v of this.custViews.values()) v.x = -1; // re-position on next update
  }

  // ---------------------------------------------------------------- stations
  updateBlenders() {
    this.game.blenders.forEach((b, i) => {
      const v = this.blenderViews[i];
      // the art is re-rendered only on state changes and once a second for the display's countdown
      // (3D: drawn in update3D); the badge ring follows the blend in place
      if (v.pic) {
        const secs = secsLeft(b);
        patch(v.pic, `${b.state}|${b.base}|${b.portions}|${b.maxPortions}|${secs}`, () => blenderSVG({
          tier: this.look.tier, state: b.state, base: b.base, progress: 0, remaining: secs, portions: b.portions, maxPortions: b.maxPortions, badge: false,
        }, BLENDER_ART));
      }
      if (patch(v.badge, b.state, () => blenderBadgeSVG(b.state, BLENDER_BADGE))) {
        v.ring = v.badge.querySelector('[data-ring]');
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

  // What is in a cup, laid out like its order bubble: the base chip, beside it a row of the fruits & crunch and under
  // that one of the toppings & sauces – every chip whole, at most CHIP_ROW side by side (css/game.css .g-chips). A
  // wrong cup with more of one layer than a row holds (up to MAX_BOWL_ITEMS of them) fills rows of CHIP_ROW, the
  // fruits & crunch first, then the toppings & sauces (their tints tell the layers apart): never more than two rows,
  // so the block always stays within the cup's width and never takes a press meant for the neighbour.
  chipsMarkup(b) {
    if (!b.base) return '';
    const chip = ([id, layer]) => `<span class="g-chip g-chip-${layer}">${ingredientIcon(id, CHIP_ICON)}</span>`;
    const items = (layer, ids) => ids.map((id) => [id, layer]);
    const mid = items('mid', b.mid);
    const top = items('top', b.top);
    const rows = mid.length <= CHIP_ROW && top.length <= CHIP_ROW ? [mid, top].filter((r) => r.length) : [];
    if (!rows.length) {
      const all = [...mid, ...top];
      for (let i = 0; i < all.length; i += CHIP_ROW) rows.push(all.slice(i, i + CHIP_ROW));
    }
    const markup = rows.map((r) => `<span class="g-chip-row">${r.map(chip).join('')}</span>`).join('');
    return chip([b.base, 'base']) + (rows.length ? `<span class="g-chip-rows">${markup}</span>` : '');
  }

  updateSlots() {
    const slots = this.game.matcha?.slots;
    if (!slots) return;
    slots.forEach((s, i) => {
      const v = this.slotViews[i];
      // the purée is in from the start, then milk and matcha run in; the 3D machine pours from its
      // nozzle, the drawn one gets the glass's own stream from the drawn nozzle's tip
      const fill = s.state === 'mixing' ? Math.round(pourFill(s.progress) * 12) / 12 : null;
      const stream = !this.k3d;
      patch(v.art, `${s.state}|${s.fruit}|${fill}`, () => matchaGlassSVG(s.fruit, s.state, v.glass, { fill, stream, from: MATCHA_POUR_FROM }));
      // the nozzle starts to pour: a sound once per brew (with the 3D machine's stream, the drawn one's with the glass's)
      const pouring = s.state === 'mixing' && (this.k3d ? brewPhase(s.state, brewStep(s)).pour > 0 : fill > 0);
      if (pouring && !v.pouring) this.audio.sfx('pour');
      v.pouring = pouring || s.state === 'ready';
      if (v.state !== s.state) {
        v.state = s.state;
        v.el.dataset.state = s.state;
      }
      this.setTimer(v, s.state === 'mixing' ? s.progress : -1);
    });
  }

  // 3D appliances: the animation clock runs while the game runs; each view redraws only when its
  // state changed or it animates (blending, mixing, overflowing, a moving lid or door).
  update3D(dt) {
    const g = this.game;
    const frozen = reducedMotion(); // not `still`: that draws the containers' pictures
    if (!this.paused && !this.over && !frozen) this.animT += dt;
    const t = Math.round(this.animT * 240) / 240;
    g.blenders.forEach((b, i) => {
      const v = this.blenderViews[i];
      const blending = b.state === 'blending';
      v.view?.draw({
        ...this.look, state: b.state, base: b.base,
        progress: blending ? Math.round(b.progress * 48) / 48 : 0,
        remaining: secsLeft(b),
        portions: b.portions, maxPortions: b.maxPortions,
      }, t);
    });
    if (this.machineView && g.matcha) {
      this.machineView.draw({ slots: g.matcha.slots.map((s) => ({ state: s.state, fruit: s.fruit, progress: brewStep(s) })) }, t);
    }
    // the bin opens a little while something that may go in is carried, wide over it
    const tr = this.trashEl.classList;
    this.spring(this.lid, tr.contains('drop-hover') ? 1 : tr.contains('drop-ok') ? 0.32 : 0, dt, frozen);
    this.trashView?.draw({ lid: Math.round(this.lid.x * 100) / 100 }, t);
    // cold air spills out of the freezer while a pack is taken out
    const taking = Object.values(this.packEls).some((n) => n.classList.contains('drag-source'));
    this.spring(this.door, taking ? 1 : 0, dt, frozen);
    this.freezerBack?.draw({ layer: 'back' }, 0);
    this.freezerFront?.draw({ layer: 'front', door: Math.round(this.door.x * 100) / 100 }, t);
    // the containers' pictures only change with the pixel ratio (a resized window): drawn again once
    // the new ratio has held for a moment, not for every step of a window edge being dragged, and one
    // picture a frame (copied into every bin that shows it; the old one, scaled by the browser, stays
    // until then)
    const pr = pixelRatio();
    if (!this.binStills.length || pr === this.stillPr) {
      this.prNext = 0;
    } else if (pr !== this.prNext) {
      this.prNext = pr;
      this.prSince = performance.now();
      this.stillQueue = null;
    } else if (performance.now() - this.prSince >= STILL_SETTLE_MS) {
      if (!this.stillQueue) {
        this.stillQueue = [...new Set(this.binStills.map((p) => p.key))];
        this.stillPr = 0; // some pictures at the old ratio, some at the new one, until the queue is done
      }
      // with the WebGL context lost no picture is drawn: the queue stops (nothing counts as done) and starts
      // again a moment later, until the context is back
      const key = this.stillQueue[0];
      if (!this.binStills.filter((p) => p.key === key).every((p) => still('pantry', p.o, p.c))) {
        this.stillQueue = null;
        this.prNext = 0;
      } else {
        this.stillQueue.shift();
        if (!this.stillQueue.length) {
          this.stillQueue = null;
          this.stillPr = pr;
        }
      }
    }
  }

  // Damped spring toward target (a little bounce when a lid falls shut).
  spring(s, target, dt, frozen) {
    if (frozen || dt <= 0) {
      if (frozen) Object.assign(s, { x: target, v: 0 });
      return;
    }
    for (let left = Math.min(dt, 0.1); left > 1e-4; left -= 1 / 120) {
      const h = Math.min(left, 1 / 120);
      s.v += (190 * (target - s.x) - 15 * s.v) * h;
      s.x += s.v * h;
    }
    s.x = Math.max(-0.08, Math.min(1.1, s.x));
    if (Math.abs(target - s.x) < 0.002 && Math.abs(s.v) < 0.01) Object.assign(s, { x: target, v: 0 });
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
    // customers: its top just under the chin, growing down over the collar and the pass (css/game.css
    // .g-toast.at-guest), so it never covers the face; stations: just above the element (the toast's bottom
    // edge sits at y)
    const fig = anchor.querySelector?.('.g-figure');
    const p = this.posOf(fig || anchor);
    const node = el('div', `toast g-toast ${kind === 'info' ? '' : kind}${fig ? ' at-guest' : ''}`, { role: 'status' });
    node.textContent = text;
    const y = fig ? p.y + FIG_CHIN_Y : Math.max(84, p.y + 6);
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
    // praise for a quick hand (patience left), a sparkle burst round the happy face, the combo of guests in a row
    const left = v?.c?.maxPatience ? v.c.patience / v.c.maxPatience : 0;
    const praise = left >= PRAISE_PERFECT ? 'perfect' : left >= PRAISE_GREAT ? 'great' : '';
    if (praise) this.later(() => this.float(t(`game.praise.${praise}`), face.cx, face.y - 4, `is-praise is-${praise}`), 240);
    this.sparkles(face.cx, face.y + 30);
    if (this.streak >= 2) this.combo(this.streak);
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

  sparkles(x, y) {
    if (reducedMotion()) return;
    const box = el('div', 'g-sparkles');
    box.style.left = `${Math.round(x)}px`;
    box.style.top = `${Math.round(y)}px`;
    let html = '';
    for (let i = 0; i < SPARKLES; i++) {
      const a = Math.round((360 / SPARKLES) * i + (i % 2 ? 12 : -6));
      const d = 64 + (i % 3) * 22;
      html += `<i class="c${i % 3}" style="--a:${a}deg;--d:${d}px;--s:${(0.7 + (i % 4) * 0.15).toFixed(2)};--w:${(i % 3) * 40}ms"></i>`;
    }
    box.innerHTML = html;
    this.fxEl.append(box);
    this.later(() => box.remove(), 900);
  }

  // "Combo ×3!" over the middle of the pass (under a banner that sits there); it grows with the streak
  combo(n) {
    this.comboEl?.remove();
    const node = el('div', `g-combo ${n >= 5 ? 'is-hot' : ''} ${this.bannerEl.childElementCount ? 'is-low' : ''}`);
    node.textContent = t('game.combo', { n });
    node.style.setProperty('--k', String(Math.min(1.35, 1 + (n - 2) * 0.07)));
    this.fxEl.append(node);
    this.comboEl = node;
    if (n >= 3) this.audio.sfx('star');
    this.later(() => node.remove(), 1500);
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
    // the whole café shakes and flashes red at the edges
    restartAnim(this.root, 'is-quake');
    const flash = el('div', 'g-hurt');
    this.fxEl.append(flash);
    this.later(() => flash.remove(), 700);
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
