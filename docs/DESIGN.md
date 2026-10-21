# Açaí Fever – Game Design & Architecture

A Cooking-Fever-style time-management game in the browser: you run an açaí bowl
shop, customers order bowls (and later a fruit matcha), and you assemble them by
drag & drop under time pressure. Plain HTML/CSS/JS (ES modules), no framework.

This document is the single source of truth. Every module must follow the
contracts below. When in doubt, prefer the simpler behaviour that matches the
player decisions listed in §1.

---

## 1. Player decisions (from the brief – do not change)

| # | Topic | Decision |
|---|---|---|
| 1 | Device | **Tablet, landscape** first (touch). Must still work with mouse on PC, on a **MacBook in the browser** (Safari, Chrome, Firefox, Edge; mouse or trackpad – no app, no install) and (scaled) on phones. |
| 2 | Style | **Realistic, glossy Cooking Fever look in a modern café**: the player stands at the counter, seen in perspective like in Cooking Fever (a slim marble pass in front of the guests, the worktop with its rounded front edge and a strip of open shelves with stock below; the tall appliances stand at the back of the worktop in front of the pass); believable size relations (blender and machine about twice as tall as a cup); clear plastic cups that show their layers, every ingredient in its own realistic container (fruit in brushed stainless pans, granola, honey, chia and peanut butter in glass jars, chocolate sauce in a squeeze bottle, coconut in its shell, cacao nibs in a wooden bowl, mint on a board), 3D appliances (blender, matcha machine, freezer), a little cleaner and more modern than Cooking Fever. Menus keep their chunky cartoon UI. |
| 3 | Controls | **Drag & drop** (touch + mouse) for every action. No tap-to-place. |
| 4 | Order rule | **Fixed layers**: Base (from blender) → Fruits & Crunch → Toppings & Sauces. A drop into the wrong layer is **rejected** (bounce back + hint). Order *within* a layer is free. |
| 5 | Stations | **Blender** with wait time for the base; it **overflows / spoils** if left too long. A **cup dispenser** built into the counter (cups upside down; a shop upgrade, the **cup arm**, puts cups down by itself). Later a **matcha machine** with its own **matcha bar** (fruit, then extras). |
| 6 | Customers | Seats grow **2 → 3 → 4** with level progress. |
| 7 | Patience | When patience runs out the customer **leaves, pays nothing**, player loses a **heart**. 0 hearts = level lost. |
| 8 | Levels | **Campaign** (60 levels in six map regions of ten, time limit + money goal, 1–3 stars, every level a small step on) **plus Endless mode** (unlocked later). Few guests with big orders: the bigger an order, the longer until the next guest and the more patient this one. |
| 9 | Unlocks | New ingredients **arrive with the levels** (at most one per level after the first; the level card and a NEU badge show it). Coins buy quality, kitchen upgrades and decor. |
| 10 | Upgrades | **Faster blender**, **more slots** (bowl slots, 2nd blender, bigger jug, matcha slots), **cup arm**, **decor → more patience**, **better ingredient quality → more coins**. |
| 11 | Ingredient count | **16** total, **4 at start**. |
| 12 | Drinks | **Fruit matcha** from campaign level 11 on: an iced matcha latte on the purée of one fruit of the **matcha bar** (banana, strawberry, mango, blueberry – its own ingredients, not the bowl's), with **extras** on top (ice cubes, vanilla syrup, cold foam). Fruit onto a glass in the machine → it purées it and pours the matcha → extras → serve. Some guests order only a drink. |
| 13 | Language | **German / English**, switchable in menu, remembered. |
| 14 | Sound | **SFX + music**, each mutable, remembered. |
| 15 | Name | **Açaí Fever** |
| 16 | Cups | A bowl is a **clear plastic cup**. An empty cup is **put down from the stack** on a free spot before anything goes into it; serving or trashing takes it off the counter. |
| 17 | Appliances | The kitchen machines are **3D** (real-time WebGL) and **animated** (blending vortex, grinding tea mill, steaming tank, pouring nozzle, lids and doors), modelled on **real household appliances** (the blender on a stand blender: fluted glass jug with a clear handle, spout and measuring cap, tall tapered motor base with a black glass V display band and a big start/stop dial), with **a new model per upgrade level** (blender: Classic → Turbo → Pro → Pro Max, all of that shape, normal or big jug; matcha machine after a household tea-latte machine – olive shell, black front, smoked water tank over an olive collar and the nozzle, a glass tea mill in an alcove –: one slot → two slots). The ingredient containers are 3D pictures too (drawn once, what lies in them is SVG). Without WebGL the drawn SVG art is used. |

---

## 2. Core loop

1. A customer walks to a free seat at the counter and shows an **order bubble**:
   one bowl (base + 1–3 fruits/crunch + 0–3 toppings) and, from level 11, sometimes a fruit matcha (with 0–3 extras),
   or only a matcha.
   The bubble reads at one glance: left the bowl – a cup of its base (layer badge 1), then a row of its fruits & crunch
   (2) and one of its toppings & sauces (3, left out when there are none), each item a big icon on a circle in its
   layer's tint –, right behind a divider the matcha glass with its fruit beside it and its extras under it; a thick patience bar in the
   guest's mood colour runs along the bottom. A delivered part (bowl or matcha, each on its own) turns into a green
   field with a big tick, its contents faded but still recognisable.
2. Player drags a **frozen base pack** (Açaí / Pitaya / Spirulina) into an **empty blender**.
   The blender blends for `blendTime` seconds, then is **ready** with `portions` portions.
3. Player drags an **empty cup from the dispenser** onto a **free bowl spot** (`placeCup`; a spot that already
   has a cup → `cupThere`). Pouring or adding anything on a spot without a cup → rejected (`noCup`).
   Natural moment: while the blender mixes. With the **cup arm** (`kitchen.cupArm` seconds a cup) the engine puts a
   cup on the leftmost empty spot itself (`game.arm`: events `armStart`, `cupPlaced` with `auto`); a cup put down by
   hand on its target meanwhile makes it turn to the next spot (`armCancel`).
4. Player drags the **ready blender** onto an **empty cup** → the cup gets the base (1 portion used).
5. Player drags **fruit/crunch** bins onto the bowl (layer 2), then **toppings/sauces** (layer 3).
   - Adding anything before the base → rejected (`needBase`).
   - Adding a fruit after a topping is on, or a topping before any fruit/crunch → rejected (`toppingsOnTop`) –
     every order has at least one fruit/crunch.
   - Same ingredient twice → rejected (`alreadyAdded`).
   - More than 6 items on top of the base → rejected (`bowlFull`).
6. Player drags the **finished bowl** onto the **customer**. If it matches the order
   exactly (same base, same set of layer‑2 items, same set of layer‑3 items) it is accepted
   (the cup leaves the counter, the spot is free again), otherwise rejected (`wrongOrder`) and the bowl flies back.
7. Matcha: drag a fruit of the **matcha bar** (`mfruit`: banana, strawberry, mango, blueberry) **onto the empty glass of
   a matcha-machine slot** → the cut fruit is in the glass, the machine works for `matchaTime` seconds (first it purées
   the fruit while the mill grinds and the tank steams, then the nozzle pours milk and matcha) → a **ready glass**.
   Extras (`mextra`: ice, vanilla syrup, cold foam) go onto a glass that has its fruit – while it mixes or when ready
   (`addMatchaExtra`; on an empty glass → `fruitFirst`, twice → `alreadyAdded`). Drag the ready glass onto the
   customer: fruit and extras must match the order (one extra missing → `drinkIncomplete`, else `wrongOrder`).
   (The machine brings its own glasses – only bowls need a cup from the dispenser.)
8. When all parts of a customer's order are delivered they **pay** (order value + tip based
   on remaining patience) and leave happily. Coins fly to the HUD.
9. Wrong/unneeded bowls or glasses of matcha can be dragged into the **trash** (a bowl goes in with its cup). A **spoiled blender** must be
   dragged to the trash to empty it (also allowed for a ready blender to discard it).

### Blender lifecycle
`empty → blending (blendTime) → ready (readyHold) → overflowing (overflowTime) → ruined`
- `ready` and `overflowing` can both be poured into bowls. `overflowing` shakes red and warns.
- `ruined` cannot be used; drag it to the trash → `empty`. When a blender spoils, the view shows a short hint at it
  ("Spoiled! Drag the blender to the trash.") and wiggles the trash can.
- If a level has `overflow: false` (levels 1–2) the blender stays `ready` forever.
- Pouring the last portion → `empty`.

### Patience
- Each customer has `maxPatience = (level.patience + PATIENCE_PER_WORK × orderWork(order)) × kitchen.patienceMult`;
  `orderWork` counts the drags an order takes (a bowl: cup, half a blender load, pour, its items, serve; a drink: its
  fruit, its extras, serve).

### Pacing
- After a guest arrives the next one comes `level.pace × orderWork(order)` seconds later (±15 %): a big order buys
  time. Once nobody is waiting, the next guest comes `EARLY_SPAWN_GAP` (2.5 s) after the last one at the latest, so a
  quick player never idles and serves more guests. A full counter still holds the next guest back.
- Drains 1/s while waiting. Each partial delivery (bowl or matcha of a 2‑part order) refills **+15 %** of max.
- Mood from ratio: `>0.6 happy`, `>0.3 neutral`, `>0.12 impatient`, else `angry`.
- At 0 → leaves angry, `hearts -= 1`, `lost += 1`.

### Payment
- Bowl value = Σ `ingredientValue(id)` of base + all items.
- Matcha value = `MATCHA_PRICE` (4) + `ingredientValue` of its fruit and of each extra.
- Order value = bowl value + matcha value. **Tip** = `round(value × 0.3 × patienceRatio)` at completion.
- Coins of a level are added to the wallet at the end **even if the level is lost**.

### Level end
- **Campaign:** when `time ≥ duration` the shop **closes** (banner "Ladenschluss!/Closing time!"): no new
  customers. The level ends when all seats are empty. Result: `won` if `money ≥ goals[0]` and `hearts > 0`,
  else `lost`. Stars = number of `goals` reached (only when won).
- Each campaign level starts with `level.hearts` hearts (3; 4 on the 4-seat levels 40–60).
- **Hearts 0** at any time → immediate `lost`.
- **Endless:** no time limit; every 30 s the stage increases (`endlessConfig(stage)` – more seats, faster
  spawns, less patience, bigger orders). Ends when hearts hit 0, or when the player ends the shift from the
  pause menu ("Schicht beenden/End shift" or "Neu starten/Restart" once anything was earned – the run then
  ends like a lost one, so coins and the best score are banked). Score = coins earned; best score is saved.
  Endless is unlocked after winning campaign level 15; it plays with every ingredient the player has reached.

### Tutorial & intros
- Level 1 (`intro: 'basics'`) runs a step-by-step tutorial with an arrow + speech text. While the tutorial
  runs, `game.tutorialHold = true`: the first customer's patience does not drain and no further customers
  spawn. Steps: (1) drag açaí pack into blender, (2) put an empty cup from the dispenser on a free spot (shown while
  the blender mixes, or once it is ready, whenever no cup is down), (3) wait while it blends, (4) drag blender (its
  jug) onto the cup, (5) drag the ordered ingredient(s) onto the bowl, (6) drag the bowl to the customer, (7) "Great! Watch
  the patience of your customers" → hold released. The step is derived from the game state every frame (a trashed
  bowl leads back to the cup step).
- Other intros (`overflow`, `moreSeats`, `matcha`, `extras`, `endless`, `fourSeats`) are explained in the pre-level
  card and with a short non-blocking banner at level start.
- The ingredients a level brings (`unlockedIn(level)`) are listed on its pre-level card and show a "NEU/NEW" badge on
  their bins in that level, where orders pick them twice as often.

---

## 3. Content (see `js/data.js` – the canonical tables)

16 bowl ingredients in three layers and 7 for the matcha bar; each arrives with a campaign level (`unlock`, level in
brackets; `ownedAt(level)` is what a level plays with):

| Layer | Ingredients (start ones in **bold**) |
|---|---|
| `base` (blender) | **Açaí**, Pitaya (13), Blue Spirulina (33) |
| `mid` (Fruits & Crunch) | **Banana**, **Granola**, Strawberry (3), Blueberries (7), Mango (16), Kiwi (22) |
| `top` (Toppings & Sauces) | **Honey**, Coconut flakes (5), Chia seeds (9), Peanut butter (19), Chocolate sauce (25), Mint (28), Cacao nibs (37) |
| `mfruit` (matcha bar, into the glass) | Strawberries (11), Banana (11), Mango (17), Blueberries (24) – drawn as the bowl fruit (`art`) |
| `mextra` (matcha bar, on the drink) | Ice cubes (14), Vanilla syrup (20), Cold foam (30) |

Matcha flavours = the matcha bar's fruit ("Erdbeer-Matcha / Strawberry matcha" …).

Upgrades (`UPGRADES` in data.js): `blenderSpeed` (3 levels), `jug` (portions 2→3, readyHold 9→13.5 s so the bigger batch does not spoil), `blender2` (2nd blender),
`bowlSlots` (2→3→4), `cupArm` ("Greifarm / Gripper arm" 2.6 s a cup, "Turbo" 1.5 s), `matchaSlots` ("Doppel-Matcha / Double
matcha", 1→2, needs level 11 reached), decor: `plants`, `jukebox`, `seating`, `neon` (each adds patience %, and appears
visibly in the shop scene). Ingredient quality: each ingredient that has arrived has 2 quality upgrades (value ×1.3,
×1.6, rounded up to 0.5 so every star adds coins). A save from before (version 1, ingredients bought) gets their price
back once.

---

## 4. Architecture

```
index.html            full HTML page; loads css/*.css + js/main.js (type=module); links the web app manifest and icons
manifest.webmanifest  installable web app: name, landscape, fullscreen, icons (§4.10)
sw.js                 service worker of the installed app: offline play (§4.10)
icons/                app icons as PNG + SVG, drawn by tools/icons.mjs from appIconSVG (the game's only image files)
css/base.css          tokens, fonts, buttons, panels, shared animations, #app/#stage scaling shell
css/screens.css       title, map, shop, settings, pre-level modal, results
css/game.css          gameplay screen (HUD, scene, customers, stations, bins, bowls, drag ghost, tutorial)
js/main.js            boot: load save, set language, init stage + audio, screen router, hot-reload hook, loading screen,
                      service worker registration
js/stage.js           fixed 1280×800 logical stage scaled to fit (framed, or full bleed on touch devices); client→stage mapping
js/curtain.js         screen transitions (açaí curtain to/from the game, fade between menus) and the loading screen
js/icons.js           outlined UI icons for buttons (menus and the pause menu)
js/haptics.js         short vibrations on touch devices that have the Vibration API (setting "Vibration")
js/i18n.js            t(key, params), registerStrings({de,en}), setLang/getLang/onLangChange
js/data.js            INGREDIENTS, LEVELS, UPGRADES, constants, getKitchenStats(), endlessConfig(), price helpers
js/save.js            persistent progress (localStorage with in-memory fallback) + shop/progress actions
js/rng.js             seeded RNG (mulberry32) + helpers
js/orders.js          order generation + pricing (pure)
js/engine.js          pure game simulation (no DOM): createGame, tick, actions, events
js/drag.js            generic pointer-based drag & drop manager (touch + mouse), stage-scale aware
js/svg.js             shared SVG helpers + the shared gradients/clip paths (artDefsSVG, one hidden <svg> per page)
js/art-food.js        realistic food art: clear cup (bowl), ingredient icons, what lies in the ingredient containers (and the
                      containers drawn, without WebGL), packs, the glasses of fruit matcha
js/art-kitchen.js     realistic kitchen art: work counter, freezer, risers, café back wall, decor; blender, matcha machine,
                      trash and freezer as the SVG fallback of the 3D models
js/art-guests.js      the guests: looks (randomLook, lookFromSeed) and realistic busts in four moods (customerSVG)
js/art-map.js         the level map: six regions of ten levels (beach, town promenade, rainforest, tea plantation, harbour,
                      night market), node positions, the road
js/art.js             HUD icons, logo, title counter, app icon; re-exports the map, food, kitchen + guest art (screens import from here)
js/geo3d.js           3D math, mesh builders (lathe – also fluted or warped –, rounded box, tube, liquid surface) and materials – pure
js/kitchen3d.js       3D models of the appliances as scene descriptions (blender tiers, matcha machine, bin, freezer) – pure
js/pantry3d.js        3D models of the ingredient containers (stainless pans, jars, squeeze bottle, coconut, wood) – pure
js/gl3d.js            WebGL renderer: one shared offscreen context, studio lighting, glass, patterns
js/art3d.js           live 3D station views (canvas), still pictures drawn once (containers), cached 3D pictures for menus
js/audio.js           WebAudio synthesized SFX + music loops (no audio files)
js/game-view.js       gameplay screen: DOM from engine state, drag wiring, HUD, pause, tutorial, FX
js/screens.js         menu screens: title, map, shop, settings, pre-level modal, results
tools/build.mjs       esbuild bundle → dist/acai-fever.html (standalone) + dist/artifact.html
tools/icons.mjs       draws icons/*.png + icons/icon.svg from appIconSVG (run again after changing the icon)
tests/*.test.mjs      node --test unit tests (engine, orders, data, save, i18n, audio, art, 3D geometry + models + containers, balance simulation)
tests/e2e/*.e2e.mjs   Playwright scripts (drag, gameplay, screens, playthrough, appliances, layout, build) – `npm run e2e`
```

Rules:
- **engine.js / orders.js / rng.js / data.js are pure** (no `document`, no `window`) so `node --test` can import them.
  `data.js` may call `registerStrings` (pure). So are **geo3d.js / kitchen3d.js / pantry3d.js** (scene descriptions only);
  `gl3d.js` and `art3d.js` touch the DOM only when called, never at import time.
- Only `save.js` touches `localStorage` (always inside try/catch).
- Only `audio.js` touches WebAudio (in the game; the promo video tool `tools/promo/score.js` renders its soundtrack
  offline from `audio.js`'s `synthKit` export).
- Every module that shows text registers its own strings via `registerStrings({de:{…}, en:{…}})` with a
  module prefix (`game.*`, `screen.*`, `shop.*`, …). Ingredient/upgrade names live in data.js (`ing.<id>`,
  `upg.<id>`, `upgdesc.<id>`, `layer.<layer>`). Language switches must update visible text
  (re-render the current screen on `onLangChange`).
- No emoji as UI icons – use the SVG art (coins, hearts, stars, ingredients).

### 4.1 Stage (`js/stage.js`)
Logical size **1280 × 800** (16:10 tablet landscape). `#stage` is scaled with `transform: scale(s)` to fit
`#app` (letterboxed, centered). All screens render inside `#stage` and use stage pixels.
`toStage(clientX, clientY)` converts pointer coordinates. In portrait on phones and touch tablets (< 820 px wide,
or < 1100 px on a coarse pointer) `#rotate-hint` shows "Please rotate your device" with a "Play anyway" button.
When the hint appears, `main.js` dispatches `acai:rotate-hint` on `window`; a running level pauses (the game view
listens), so nothing runs on behind the hint.
The page never pinch-zooms or pans: `touch-action: none` on `html, body` (letterbox bands, rotate hint)
as well as on `#stage`, plus cancelled `gesturestart`/`gesturechange`/`gestureend` for Safari (iOS touch, Mac
trackpad) (`initStage`). On a MacBook, touch-action does not reach the trackpad: Chrome, Edge and Firefox deliver a
pinch as ctrl+wheel events and a two-finger swipe sideways navigates back, so `initStage` cancels every `wheel`
event (non-passive listener on `window`) and `html, body` carry `overscroll-behavior: none`; a Force Touch press
(`webkitmouseforcewillbegin`) is cancelled too, so it never opens Look Up mid-drag. A scroller (the level map) carries
`data-scroll` and `touch-action: pan-y`; the wheel listener lets a plain vertical wheel over it through (no ctrl/⌘).

**Phone.** On a phone held sideways (full bleed and the window's short side ≤ 500 css px, `isPhone()`) `html.is-phone`
is set. The stage is the same 1280×800 – shown at about half its size (0.49 at 844×390, 0.54 at 932×430) – so the game
view widens every target's hit area (`hitPad` 30 instead of 18 stage px) and the CSS sets the small print bigger: name
tags and layer labels ×1.4 (a tag grows up over its container, a label down over the riser), the freezer label ×1.3,
toasts 30 px, the level banner 24 px, the tutorial 26–28 px in a wider panel, the money bar's goal marks 17 px – all ≥ 8
css px on screen. Upright, the rotate hint above asks to turn the phone (the game is built for landscape; "Play anyway"
shows it letterboxed). `tests/e2e/mobile.e2e.mjs` checks 844×390 and 932×430: no scrolling or zoom, the stage and every
station on screen and ≥ 30 css px, the small print ≥ 8 css px, and the jug carried by touch.

**Framed or full bleed.** On a fine pointer (desktop, MacBook) the stage is framed: rounded corners and a shadow on the
açaí-purple page, 8/16 px of padding. On touch devices (`(pointer: coarse)`) and in the installed app
(`display-mode: standalone | fullscreen`) `html.is-bleed` is set: no padding, no frame, and the screens' art runs on
into the bands round the stage up to the window's edges, like a native game – the stage itself (its scale, its 1280×800
box, `toStage`) is the same in both. `fit()` sets `--bx` / `--by` on `#stage`: the stage px the window reaches beyond
the stage on either side (0 when framed); `--safe-l/-r/-t` are the safe-area insets in stage px. With them a screen's
background (`--screen-bg`) moves to a backdrop as big as the window, overlays cover the window, the bars (title top bar,
headers, the game HUD) sit at the window's edges, and art drawn wider – the café wall and worktop (`BLEED_X` 360 / `BLEED_Y`
200), the title counter, the shop awning, the map – shows in the bands. The #stage-wrap rect stays the stage's box, so the
bands remain touch areas without zoom.

### 4.2 Engine (`js/engine.js`) – contract

```js
createGame({
  mode: 'campaign' | 'endless',
  level,            // LEVELS[i] (campaign) – ignored for endless
  owned,            // string[] ingredient ids (default: ownedAt(level) / the start ones in endless)
  ingLevels,        // { [id]: 0|1|2 } quality levels
  kitchen,          // getKitchenStats(save.upgrades)
  matcha,           // boolean – matcha machine present
  seed,             // number
  tutorial,         // boolean – level-1 tutorial hold active at start
}) → game

tick(game, dt)                                // advance simulation (dt seconds, clamp ≤ 0.1 inside)
loadBlender(game, blenderIdx, baseId)         → { ok, reason? }
placeCup(game, bowlIdx)                       → { ok, reason? }   // empty cup from the dispenser → free spot
pourBlender(game, blenderIdx, bowlIdx)        → { ok, reason? }
addIngredient(game, bowlIdx, ingId)           → { ok, reason? }
trashBowl(game, bowlIdx)                      → { ok }            // the cup goes too: the spot is free
cleanBlender(game, blenderIdx)                → { ok, reason? }   // ruined/ready/overflowing → empty
loadMatcha(game, slotIdx, id)                 → { ok, reason? }   // a matcha fruit onto the empty glass (an extra: addMatchaExtra)
addMatchaExtra(game, slotIdx, extraId)        → { ok, reason? }   // an extra onto a glass with its fruit
trashMatcha(game, slotIdx)                    → { ok }
serveBowl(game, bowlIdx, customerId)          → { ok, reason? }
serveMatcha(game, slotIdx, customerId)        → { ok, reason? }
setPaused(game, bool)
releaseTutorialHold(game)
endRun(game) → boolean                        // endless only: ends the run (gameOver, reason 'quit')
// Pure checks (no state change) – the reason the matching action would reject with right now, or null:
loadBlenderError(game, blenderIdx, baseId), placeCupError(game, bowlIdx), pourError(game, blenderIdx, bowlIdx),
addIngredientError(game, bowlIdx, ingId), loadMatchaError(game, slotIdx, id), addMatchaExtraError(game, slotIdx, extraId),
serveBowlError(game, bowlIdx, customerId), serveMatchaError(game, slotIdx, customerId)
drainEvents(game) → Event[]                   // returns and clears queued events
bowlMatchesOrder(bowl, orderBowl) → boolean
matchaMatchesOrder(slot, drink) → boolean       // drink = { fruit, extras }
```

Reasons (i18n key `reason.<code>` in game-view): `noCup`, `cupThere`, `needBase`, `toppingsOnTop`, `alreadyAdded`, `bowlFull`,
`blenderBusy`, `blenderNotReady`, `blenderRuined`, `bowlHasBase`, `notOwned`, `wrongLayer`, `wrongOrder`,
`noMatchaWanted`, `noBowlWanted`, `alreadyDelivered`, `slotBusy`, `notReady`, `notMatchaFruit`, `emptyBowl`,
`matchaItem` (the matcha bar's fruit or an extra on a bowl), `fruitFirst`, `glassFull`, `drinkIncomplete`,
plus `noCustomer` (customer gone or leaving), `notPlaying` (paused / game over) and `invalid` (bad index,
no matcha machine). `loadBlender` checks `wrongLayer` → `notOwned` → `blenderRuined` (spoiled blender) → `blenderBusy`; `cleanBlender` returns
`blenderBusy` while blending and `blenderNotReady` when empty (a blending blender cannot be thrown away).
`pourError` checks the blender (`blenderRuined`, `blenderNotReady`) before the spot (`noCup`, `bowlHasBase`);
`addIngredientError` checks `notOwned` → `wrongLayer` → `noCup` → `needBase` → ….

State (read-only for the view):
```js
game = {
  mode, level, config,          // config = resolved difficulty (level or endlessConfig(stage))
  status: 'playing'|'paused'|'won'|'lost',
  time, duration|null, closing: bool,
  money, hearts, maxHearts, served, lost, stage (endless),
  tutorialHold: bool,
  seats: [ customer|null ],     // length = current seat count (max 4)
  blenders: [ { state, base, t, duration, portions, maxPortions } ],
  bowls:    [ { cup: bool, base: id|null, mid: id[], top: id[], uid } ],  // length = kitchen.bowlSlots; cup false = free spot
  matcha:   null | { slots: [ { state: 'empty'|'mixing'|'ready', fruit, t, duration } ] },  // mixing = brewing
  owned, ingLevels, kitchen, events: [],
  result: null|'won'|'lost', stars, endReason: null|'goal'|'hearts'|'quit', featured   // set at game over
}
// blenders and matcha slots also carry progress (0–1 within the current state; for a ready
// blender it counts toward overflow). bowl.uid changes whenever a bowl is reset.
// Internal state lives in game._sim – never read or write it from the view.
customer = { id, seat, look, order: { bowl: {base, mid[], top[]}, matcha: fruitId|null },
             delivered: { bowl: bool, matcha: bool }, patience, maxPatience,
             state: 'arriving'|'waiting'|'leavingHappy'|'leavingAngry', t, mood, paid }
```
Events (`{type, …}`): `customerArrive{customerId, seat}`, `customerPaid{customerId, seat, amount, tip}`,
`customerLost{customerId, seat}`, `partialDelivery{customerId}`, `blenderStart{idx}`, `blenderReady{idx}`,
`blenderOverflow{idx}`, `blenderRuined{idx}`, `blenderEmpty{idx}`, `cupPlaced{bowlIdx}`, `basePoured{bowlIdx, blenderIdx}`,
`ingredientAdded{bowlIdx, id}`, `matchaStart{idx}`, `matchaReady{idx}`, `trash{what}`,
`closingTime`, `stageUp{stage}` (endless), `gameOver{result: 'won'|'lost', stars, reason: 'hearts'|'goal'|'quit'|null}`.
`trash` events always carry `idx` (`trash{what:'bowl'|'blender'|'matcha', idx}`); `cleanBlender` emits
`blenderEmpty` then `trash`. `gameOver.reason` is `null` when won, `'goal'` when lost on goal 1, `'hearts'` when
hearts ran out (endless always ends `lost`, with `'hearts'` or – after `endRun` – `'quit'`). Once the first customer has arrived, `game.time` stops
while `tutorialHold` is on, so the tutorial does not eat level time (blenders keep running).
`customer.look` is `{seed}` – the view builds the look with `lookFromSeed(seed)` from art.js.

### 4.3 Drag & drop (`js/drag.js`) – contract
```js
const dnd = createDragManager({ root /* #stage element */, toStage, ghostLayer /* element inside stage */,
                                 hitPad? /* stage px round a target, default 18; the game passes 30 on a phone */,
                                 onPickup?(payload), onDrop?(result), onCancel?(result) })
dnd.source(el, { payload: () => obj|null, ghost: (payload) => HTMLElement|markup, onStart?, onEnd?, onTap?,
                 home?: () => Element /* where a returning ghost flies to (default: el), e.g. the jug's place on its base */,
                 back?: boolean /* the ghost flies home after an accepted drop too (a jug poured into a cup) */,
                 reach?: number /* stage px its hit area reaches above its box, e.g. by a ::before */ }) → unregister
dnd.target(el, { accepts: (payload) => boolean, valid?: (payload) => boolean, drop: (payload) => {ok, reason?},
                 hitEls?: [Element] /* more boxes that count as the target, e.g. a guest's order bubble */,
                 land?: Element /* where an accepted ghost shrinks into, e.g. the guest itself */ }) → unregister
dnd.cancel(); dnd.destroy(); dnd.isDragging(); dnd.refresh()
// result = { ok, reason, payload, targetEl, tap, cancelled, pointerType, pos }   // pos = ghost centre (stage px) at release
```
- A release that moved ≤ 6 CSS px within 300 ms is a **tap** (`onTap`, then `onEnd`/`onDrop` with `tap: true`).
  Order on release: source `onEnd(result)` → manager `onDrop(result)`; on cancel `onEnd({cancelled})` → `onCancel`.
- The hit-test point is the **ghost centre**, not the pointer. For touch the ghost centre floats 48 CSS px above the
  finger (~9 mm on a tablet), clamped to 40–80 stage px: never less than on a big screen, never so much that the
  trash at the stage's bottom edge gets out of reach on a phone.
- Classes: root `is-dragging`, source `drag-source`, targets `drop-ok` / `drop-hover` / `drop-bad`, ghost `.drag-ghost` >
  `.drag-ghost-body`; registered elements get `data-dnd-source` / `data-dnd-target`.
- Pointer Events + `setPointerCapture`; works for touch, pen, mouse. One active drag at a time (ignore other pointers).
- Ghost follows the pointer in stage coordinates (centered under finger, slightly above on touch so it is visible).
- While dragging, every registered target whose `accepts(payload)` is true can be hit (its `drop()` runs, so a
  rejection shows its reason); it gets class `drop-ok` only when `valid(payload)` (optional, default true) also
  holds. The target under the pointer gets `drop-hover`, plus `drop-bad` when it is not valid. `refresh()`
  re-evaluates `valid()` mid-drag (game-view calls it every frame). Hit test: target rect (the element's box joined
  with its `hitEls`' boxes) expanded by 18 stage px; nearest center wins when overlapping. The classes stay on `el`.
- **Blender: only the jug is carried.** The blender is the source, but its ghost is the jug alone (`blenderBox(…, 'jug')`
  of a jug-only picture, or the drawn jug cut out of `blenderSVG({ part: 'jug' })`); while it is carried the base stays
  in full view (no `drag-source` fading) without its jug and badge, and after the drop – poured or not – the jug flies
  back onto its base (`back`, `home` = `.g-jug`, the jug's box in the blender's art).
- Drop on a target → `drop(payload)`. Accepted: the ghost shrinks into the centre of the target's `land` element
  (when given and drawn), else of its hit rect – a guest's hit rect spans its order bubble, pushed aside with 4 seats,
  so the guest lands it on its figure. If `{ok:false}` or no target: ghost animates back to its source and
  `onEnd({ok:false, reason})` fires; the view shows the reason. Drop on nothing = silent return. A release over a
  station that does not accept the payload is a drop on nothing for the manager; the game view uses `pos` to
  explain it (e.g. pack on a bowl → "The pack goes into the blender first!"), hit-testing each station the way the
  manager would (a guest with its order bubble).
- While the pointer itself (not the ghost) still rests on its source – it has not moved more than the 6 CSS px tap
  slop, or it is over the source rect (its box, reaching `reach` stage px higher) expanded by 6 stage px – nothing is
  hit: no `drop-hover`, and a release there is a silent return (`ok:false`, `targetEl:null`, `pos:null`, not a tap).
  Holding a bin, a slow sloppy press (also on its raised hit area: the bins pass `reach: 12`), or picking an item up
  and putting it back never drops it into the target next to it (a cup's box ends 2 px above the fruit bins' raised
  hit area).
- Must prevent page scroll/zoom/text selection/long-press callout during drags (`touch-action:none`,
  `user-select:none`, `-webkit-touch-callout:none`, `preventDefault` on pointerdown for sources).
- `pointercancel`, window `blur` and `visibilitychange` cancel the drag cleanly.

### 4.4 Art (`js/art.js`) – contract (all return SVG markup strings)
```js
ingredientIcon(id, size = 64)        // order / chip / shop icon for any of the 16 ingredients (realistic)
binSVG(id, width = 84)               // the ingredient's container with what is in it, drawn (96×112 = PANTRY_VIEW, seen from
                                     // above at PANTRY_ELEV like the 3D containers; used without WebGL)
binFillSVG(id, width = 84)           // only what lies in/on the container (fruit in rows on the pan, granola heaped in the jar's
                                     // mouth, shredded coconut, nibs, mint sprigs), drawn over its 3D picture; '' when all of
                                     // it is 3D (honey, chia, peanut butter, chocolate)
scoopSVG(id, size = 84)              // what a drag from a container carries: a handful (fruit, granola, coconut chips), a
                                     // spoonful (nibs, peanut butter), the measuring spoon of chia, a sprig, the honey dipper,
                                     // the chocolate's whole squeeze bottle tipped to pour
packIcon(baseId, size = 72)          // frosty frozen pack for base bins (açaí / pitaya / spirulina)
bowlSVG(bowl, size = 150)            // clear cup {base, mid[], top[]}: purée, a band per fruit/crunch seen through the
                                     // side, sauce runs on the inner wall, heaped toppings; empty cup when base null
cupStackSVG(width = 90)              // stack of empty cups (120×185) – the drag source for a new cup; its cups are the
                                     // cups of bowlSVG(1.146 × width), so the stack and a placed cup match
cupSpotSVG(size = 150)               // free spot: white coaster with a dashed cup outline (same box as bowlSVG)
artDefsSVG() / ART_DEFS_ID           // the hidden <svg> with the shared gradients + clip paths (initStage inserts it)
matchaGlassSVG(fruitId|null, state, size = 70, { fill, stream, from }?)  // glass of fruit matcha (bottom at y 95 of 100):
                                      // 'empty' | 'mixing' (fill 0–1: the purée from the start, then milk, then matcha; its own
                                      // stream from y `from` (default 0) while it runs in, unless stream: false) | 'ready'
                                      // (purée, milk, matcha with foam, ice, a paper straw, the fruit on the rim)
matchaFruitColorOf(id), MATCHA_COLORS, MATCHA_MILK // the purée's colour, milk / matcha / foam, the share of the pour that
                                      // is milk (derived from the glass's layer heights; the 3D nozzle's stream takes the same colours);
                                      // every purée stays clearly apart from the olive matcha at the order bubble's 64 px (kiwi: vivid green, big black seeds)
MATCHA_STRAW = { x0, y0, x1, y1, w }  // the ready glass's straw (viewBox), short enough to clear the machine's collar and nozzle
customerSVG(look, mood, size = 160)  // mood: 'happy'|'neutral'|'impatient'|'angry'. A bust (viewBox 160): the head (drawn 46
                                      // wide and scaled 1.1 about the chin: ≈51 wide, crown y≈30, chin y 93), neck, shoulders
                                      // ≈2.2 heads wide and the upper arms, the torso down to the box's bottom (the game's pass
                                      // covers y > 131). Under 100 px it crops to head and shoulders (x 30–130, y 12–112;
                                      // viewBox 0 0 100 100). Memoised in a cache of its own (64 pictures, least recently
                                      // used out first, so guests never push the small icons out of svg.js memo()) and
                                      // free of ids: only shared paints and the af-clip-guest-* clip paths
randomLook(rng)                       // → look {skin, hair, hairStyle, shirt, shirt2, pattern, accessory, accent, top, iris} –
                                      // diverse; top ('tee'|'shirt'|'polo'|'hoodie'|'cardigan') and the eye colour are picked
                                      // last, so a seeded guest keeps the colours it had before; a look object missing them
                                      // (or with unknown values) gets them derived from the object itself
lookFromSeed(seed), LOOK_OPTIONS      // the look of a seeded guest (engine customer.look.seed); the lists of styles
blenderSVG({state, base, progress, remaining?, portions, maxPortions, badge?, tier?}, size = 150)  // badge:false hides the status
                                      // badge; remaining: whole seconds the display counts down while blending; tier (blenderLook,
                                      // default 1): one shape, the base in the model's colour – white Classic, stainless Turbo,
                                      // açaí-purple Pro, graphite Pro Max (the game, menus and shop pass the player's model)
matchaMachineSVG(slotCount, size)     // the machine without glasses (drawn separately at MATCHA_SLOT_X/Y, MATCHA_CUP_SIZE),
                                      // built from the 3D model's measures (MATCHA_GEO, machinePoint); MATCHA_POUR_FROM: the
                                      // glass's y at the nozzle tip (its stream's start); matchaLedAt(slotCount, i): a slot's
                                      // status LED in the 312 px canvas (the game lights it over the drawing)
trashSVG(size), coinSVG(size), heartSVG(filled, size), starSVG(filled, size)
decorSVG(id, size, {wall = true})     // 'plants' | 'jukebox' | 'seating' | 'neon' – in the wall's light; wall: its own shape as
                                      // a soft shadow on the wall (the café), wall: false only the contact shadow (shop cards)
shopSceneSVG(width, height, {seats = 3}) // the café's back wall (1280×330): plaster, one wide window pane (x 351–729, no mullion)
                                      // with a deep reveal and hazy daylight – its frame lines keep ≥ 30 px from every head
                                      // with 2, 3 and 4 seats, so none grazes a face –, chalkboard menu at the far left
                                      // (x 24–152, on a nail below the HUD; t('art.menu'), so it is redrawn on a language
                                      // switch), one oak shelf, a pair of pendant lamps with warm halos (x 490 / 590, evenly
                                      // about the window's middle, at one height, only in the HUD's gap between the hearts and
                                      // the money pill), fluted oak wainscot, soft shadows, a vignette; seats: 4 leaves out the
                                      // chalkboard and the shelf (the outer bubbles, x 6–312 and 968–1274, would hide them all
                                      // but for slivers)
counterSVG(width, height)             // the work counter under the pass (1280×462): terrazzo worktop in perspective down to
                                      // the bottom of the screen – no front edge, no cabinet: nothing but the work surface
freezerSVG('well'|'rim', w, h)        // chest freezer in the counter (284×186): frosty well with a glass lid slid back /
                                      // the frame's front edge drawn over the packs
riserSVG(w, h)                        // oak riser an ingredient row stands on (drawn 1:1; its 16 px front edge, ending
                                      // 3 px above the bottom, carries the layer label)
logoSVG(width)                        // "Açaí Fever" logo with bowl
titleCounterSVG(bleed = 0, below = 0) // the title screen's counter (1280×116): marble top, fluted açaí-purple front, brass
                                      // foot rail; bleed / below draw it wider and deeper (full bleed)
appIconSVG(size, {maskable})          // the app icon (512 square): the logo's cup on the açaí sunburst; maskable keeps it in
                                      // the central 80 % (tools/icons.mjs draws icons/ from it)
mapRegionSVG(id), MAP_REGIONS         // the level map (js/art-map.js), ten levels per region: 'beach' (levels 1–10: sea, jetty,
                                      // volleyball net, beach bar, boardwalk, lifeguard tower, palms), 'town' (11–20: houses with
                                      // awnings, lamps, a fountain, an ice-cream cart, café tables), 'forest' (21–30: açaí palms,
                                      // a river from a waterfall, a toucan, a basket of berries), 'tea' (31–40: terraced tea rows,
                                      // a bamboo fence, the "Matcha" tea house, stone lanterns, cherry trees, a koi pond whose
                                      // stream feeds the waterfall, a red bridge), 'harbor' (41–50: a quay between two basins,
                                      // boats, a crane, a lighthouse, a fish stall, containers, lantern strings), 'night' (51–60:
                                      // market stalls under lanterns, a ferris wheel, fireworks and the açaí bar at the
                                      // finale, a brick wall along its bottom); each MAP_W + 2·MAP_BLEED
                                      // wide, MAP_REGIONS gives their tops/bottoms in map px (MAP_H in all)
mapLevelPos(i), mapRoadData(count)    // centre of level node i (stage x, map y); the road from below the map through the
                                      // first `count` nodes (a smooth curve)
```
The café wall and the work counter take `{ bleed, above }` / `{ bleed, below }` too: the plain wall (plaster, wainscot,
cornice, lamp cords) and the worktop run on that far (the picture is then drawn 1:1,
the stage's origin at `(bleed, above)`); without them they are the 1280-wide pictures they always were.
`customerSVG(look, mood, size, blink)`: blink draws neutral and impatient eyes shut (the game and the title lay it over
the open-eyed picture for a blink now and then).
Look: shapes are filled with their colour and shaded with the shared overlay gradients (`url(#af-sph)`,
`af-cyl`, `af-plastic`, `af-steel` …, light from the top left), thin outlines in a darker shade of the fill.
Everything on the counter is seen from the player's side, from above at an angle (Cooking Fever's view): round
things are ellipses, boxes show their top face and the side that faces the middle of the screen (the blender and the
matcha machine are drawn from the front like their 3D models), and every object casts a soft shadow on the
worktop. The ingredient containers in the two front rows are seen more steeply (`PANTRY_ELEV` 38°, the tilt the fruit pieces are drawn with): the
rows are nearer to the player and lower than the appliances, and the pans' tops and the jars' mouths must read.
The fruit lies in neat staggered rows like a deli counter, each piece with a little contact shadow away from the
light.
Memoised pictures never contain their own ids (they reference the shared defs); a picture that needs a local
gradient (café wall, work counter, logo, map) builds unique ids with `uid()`. Paint references name a fallback colour
(`url(#af-steel) #cfd6dc`), so a page without the defs still shows plain fills. Guests have thin outlines in a darker
shade of each part (skin, hair, cloth) and soft volume from the shared paints (`af-skin`: light top left, warm
reddish-brown edges on any skin tone; `af-blush`, `af-flush`): a shadow under the jaw on the neck, nose and ear
shading, hair with strands and a broken shine band, clothes with collars, seams, buttons, a hood with drawstrings,
folds and creases at the arms. Curly hair is one bumpy mass with open curl strokes (like the afro, no rings), the curls
behind the head in one darker shade of the same hue (golden hair stays golden in the shade); curls and afro are outlined
in the hair's own line colour like every hair style, and light hair (blonde, grey) gets a deeper outline of its hue so it
stands off the light plaster. Bald guests keep a short horseshoe fringe: hair over the temples down to the ears that
runs on round the back of the head (it shows past the outline above and behind the ears). A cap is
a baseball cap seen from the front (low crown, curved bill with its dark underside and its shadow on the brows); beards
stay natural brown under dyed hair; earrings under long hair and afros peek out as small drops between the jaw and the
hair, under a bob (which lies close over the ears) a stud on the earlobe holds a short drop over the hair.
The four moods read at a glance – also at 1024×768 and in the 40 px menu chips:
*happy* (closed laughing eyes, open smile with teeth, strong blush), *neutral* (open eyes with iris and catchlight, a
calm slight smile), *impatient* (heavy lids, a look to the side, a frown with two creases, lips pressed and pulled to
one side, a big blue sweat drop with a light rim that reads on dark hair too),
*angry* (red face, V brows, narrowed eyes, gritted teeth, steam puffs and a vein mark). The HUD icons, logo and map
keep the cartoon ink line of the menus.

### 4.4.1 3D appliances (`js/geo3d.js`, `js/kitchen3d.js`, `js/gl3d.js`, `js/art3d.js`)
The blender, matcha machine, pedal bin (a slim rounded-rectangular stainless step bin with a black lid frame, the lifting rod up its back and the brand badge on the front) and chest freezer are real 3D models rendered with WebGL (no library), and so are
the ingredient containers (js/pantry3d.js, drawn once as still pictures). Everything else (guests, food, cups, HUD) stays SVG.
```js
// kitchen3d.js (pure): scene = { frame, elev, persp?, time, items: [{ mesh, mat, m, pass }] }
blenderScene({ tier 0–3, big, state, base, progress, remaining, portions, maxPortions }, t, frame?)
matchaScene({ slots: [{ state: 'empty'|'mixing'|'ready', fruit, progress }] }, t, frame?)    // 1 or 2 slots (view 'machine')
trashScene({ lid: 0 closed … 1 open }, t, frame?)
freezerScene({ layer: 'back'|'front', door: 0 … 1 /* a pack is being taken */ }, t, frame?)
VIEWS[kind] = { w, h, ax, ay, zoom?, pic? } // canvas size (stage px), where the world origin sits in it, its zoom
                                            // (the blender's is per model), pic = { y, h }: the rows a menu picture shows
blenderLook(save.upgrades) → { tier, big }  // tier = Turbo-Mixer level, big = big jug bought
BLENDER_MODELS = ['Classic', 'Turbo', 'Pro', 'Pro Max'];  isAnimated(kind, o)
MACHINE_SLOT_X, TRAY_Y, GLASS_Z             // where the glasses stand on the matcha machine's drip trays (world)
brewPhase(state, progress) → { grind, heat, pour, powder, dust }   // what the matcha machine does at a point of the brew
pourFill(progress)                          // how full the glass under the nozzle is (0 until the pour starts at 0.55)
MATCHA_GEO; machinePoint([x, y, z]) → [x, y] // the machine's measures and a world point in its canvas (the drawn version)
blenderZoom(tier, big)                      // a model's zoom: every model equally tall (measured once from its jug, lid and cap)
blenderBadgeAt(tier, big) → { x, y }        // canvas point above the right end of the model's lid (status badge)
blenderBox(tier, big, state, part?) → [x0, y0, x1, y1]  // the canvas part a model in a state covers, measured once;
                                            // part 'jug': the jug alone (the drag ghost)
blenderScene(o, t) with o.part              // 'base': the motor base without its jug (while the jug is carried),
                                            // 'jug': the jug alone, no base and no shadow (the drag ghost); blenderSVG too
fitFrame(frame, size)                       // a view (its pic rows, if set) fitted into a size×size menu picture
// pantry3d.js (pure), the view 'pantry' of VIEWS / SCENES
pantryScene({ kind | id, layer: 'back'|'front' }, t, frame?)  // an ingredient's container; 'front' = its front rim only
PANTRY_VIEW = { w: 96, h: 112, ax: 48, ay: 96 }  // the art box of a container: 28 px above a bin's hit box down to its
                                            // bottom; the world origin (the line the containers' feet stand on) at ay
PANTRY_ELEV (38°); pantryPoint([x, y, z]) → [x, y] in the art box; pantryKind(id); pantryHasFront(id)
pantryTop(id)                               // where the SVG of what lies in/on it goes (pan inside, jar mouth, bowl, board)
pantryHead(id)                              // art-box y of the back of its top (flange, rim, board edge): how tall it stands
pantryBadges(id, { q, low }) → { lnum, stars, fresh }  // where the bin's layer badge, quality stars (q of them) and "NEU"
                                            // sticker go (art-box px); low: the sticker down beside the container
PANTRY_GEO; PANTRY_IDS; PANTRY_PICTURES     // the containers' measures (drawn art); every picture the game needs
// art3d.js
has3D() → bool                               // false without WebGL → callers keep the SVG art
createView(kind, className?) → { el /* <canvas> */, draw(o, t), invalidate() }
snapshot(view, scale = 1, box?) → <canvas>   // drag ghost of a station: box of its canvas, copied with drawImage only
pictureMarkup(kind, o, size, fallback, t?)   // <img> (cached data URL) or fallback() markup for menus; a picture not
                                             // drawn yet is an empty <img class="art3d is-pending">, filled one per frame after the paint
still(kind, o, target?) → <canvas> | null    // a picture that never changes, drawn once per state into a cache of the
                                             // current pixel ratio; every call gets a copy (drawImage only) – the
                                             // ingredient containers
prepareStills(kind, states)                  // draws them into the cache ahead, one per idle moment (main.js: while the
                                             // title shows)
pixelRatio()                                 // device px per stage px, 1–3
```
- **World:** y up, +z toward the player, units = stage px. One fixed orthographic camera looks down by 17° (the angle the
  cup rims are drawn with), so every appliance shares one perspective and its canvas lines up with the DOM hit areas. The
  chest freezer built into the worktop is seen from above like the worktop itself: `FREEZER_ELEV` 60° and a gentle
  perspective (`scene.persp`, a camera 1100 px from the middle of its opening), so its frame tapers toward the back like
  the worktop and the inner side walls show. The ingredient containers: `PANTRY_ELEV` 38°, orthographic.
- **Sizes (`VIEWS`, CSS px):** blender 164 × 292 (no zoom of its own: `blenderZoom` scales each model so the lid (its
  measuring cap) of a 2-bowl jug ends 188 px above the floor, the 3-bowl jug's 208 px – ≈200 / ≈220 px tall in all,
  about 2× / 2.25× a cup, whatever the motor base; the canvas keeps headroom for the lid an overflowing blender lifts, menu pictures crop most of
  it with `pic`), matcha machine 312 × 312 (zoom 312/236, the machine box of the game; the glasses' slots line up with
  its nozzles and drip trays; the machine ≈230 px wide with one slot, ≈300 with two, ≈240 px tall, room above it for the
  steam – every part of every state stays inside the canvas), pedal bin 153 × 209 (zoom 1.35), chest freezer 284 × 194, ingredient container 96 × 112
  (`PANTRY_VIEW`, origin at ax 48 / ay 96). Every part of every blender state stays inside its canvas and its `blenderBox`
  (tests/kitchen3d.test.mjs), every container inside its art box (tests/pantry3d.test.mjs).
- **Look:** metal/roughness shading with GGX highlights from three studio lights, reflections of a procedural photo studio
  (soft boxes over a warm room), clear plastic with Fresnel reflections, procedural surface patterns (brushed steel, swirling
  purée, frost, printed scales, seven-segment displays, LED rings, wood grain, coconut fibres, and packed
  granola clusters or chia seeds as 3D cells – round or long pieces in shades of their own with dark gaps, so no side of a
  jar shows them stretched), ACES tone
  mapping. Colours are sRGB in the models and linear in the shader. Objects darken toward the floor they stand on (a band of
  `scene.ao` px, 16 for the appliances, 3.5 for the small containers); the clear jars' reflections add light over their
  bright contents (glass `p.w`) instead of veiling them.
- **Ingredient containers (`pantry3d.js`):** one per ingredient on the risers, believable next to a cup (≈97 px tall):
  banana, strawberry, blueberry, mango and kiwi in a deep brushed-stainless gastronorm pan (91 px wide, rolled flange that
  catches the key light, ≈54 px tall), granola in a 1 l clip-top jar (the tallest of the back row, 52 px wide, its glass
  ≈81 px tall, ≈95 px with the lid: ≈1 × a cup) with a thick, darker wire bail and its glass lid with the orange seal
  swung right back and tipped 22° below level behind the mouth, so its glass and seal face the camera and read as a lid
  instead of standing up over the jar (it reaches up to the top of the art box, under the content chips of the cup behind
  it, which are drawn over it), honey in a labelled jar (honeycomb label, deep amber like its icon) with a wooden dipper
  whose grooved, honey-soaked head stands out of the honey, the gold lid lying beside it, chia in a Weck glass with a deep
  round steel measuring spoon tipped toward the player on the seeds (darker inside, a few seeds in it), its flat handle
  over the rim toward the front right, peanut butter in a labelled jar with a spoon in it and the red screw lid lying top
  up beside it (knurled skirt, glossy top: a lid, not a ball or a dish), chocolate sauce in a brown squeeze bottle with a
  nozzle cap and label (the tallest of the front row, ≈91 px: ≈0.95 × a cup; its nozzle stands behind the back row's name
  tags, which are drawn over it like the layer labels), shredded coconut in half a coconut shell (86 px wide, clearly
  wider than the bowl), cacao nibs in a turned walnut bowl (≈80 px), mint on an oak board. Every container stands
  with the front of its foot on one line (`PANTRY_VIEW.ay`, just above the name tag) and casts a soft contact shadow on the
  riser. What lies in/on it is SVG (`binFillSVG`): the 3D picture, the SVG, and for the pans, the coconut and the bowl the
  front rim ('front' layer) over it again, so the pieces lie inside. The five pans share one picture.
- **Cost of the containers:** the 12 pictures (20 canvases in the fullest kitchen) are drawn once per pixel ratio. With
  software WebGL on the 4-core dev container all of them take ≈170–210 ms at pixel ratio 1 and ≈300–330 ms at 2, mostly
  rasterising the jars (a hardware GPU is many times faster), so main.js draws them ahead while the title shows; a level
  started before that (the test harness, a deep link) draws the missing ones once while it is built. After a pixel-ratio
  change the game draws them again one picture per frame, the old pictures (scaled by the browser) staying until then.
  Drawing them into one atlas would save the per-picture readback only by growing the one shared WebGL canvas, which makes
  every later frame of the appliances slower (its whole buffer is resolved on each copy), so they are drawn one by one.
- **Blender:** a stylised stand blender after a household model (the overhaul's reference photo; the brand line reads
  "AÇAÍ FEVER"). Jug: glass with 20 fluted panels (`lathe` `flutes`, spaced evenly along its rounded-square outline, so
  the flat sides show them; the purée inside follows them and stays inside the glass – tests/kitchen3d.test.mjs),
  widening toward the top, a printed scale on the front left (fine ticks right of a thin spine, half see-through so the
  purée shows through), a clear D-shaped handle on the right, the pouring spout on the left (`lathe` `warp`; the glass lip
  with a clear bead along it reaches out past the lid, which follows the spout only a little), a black lid over the rim
  with a tab over the handle and a clear measuring cap, a black collar, a 4-wing blade. Motor base (≈40 % of the
  height): tapered rounded square on a black plinth, a black glass band around its top, over the shoulder and the top
  face, which dips into a V on the front (a decal with a bevelled edge and programme icons; the display and the portion
  LEDs in it), the big dial in the middle of the front with ticks and
  programme icons printed around it (all inside the dial's decal), "AÇAÍ FEVER" under it. Textures are drawn at ≈10–20 px
  per world unit on power-of-two canvases (stretched to fit), which the renderer gives mipmaps (stored premultiplied, so
  shrunk prints keep their colour; a decal's colour is its print's), sharp in the shop and smooth instead of broken up at
  the game's size. The display shows `00:00` when idle, the seconds left while blending (e.g. `00:05` … `00:01`; the drawn
  blender without WebGL too, drawn again once a second), a green ✓ when ready, a blinking red `!` when overflowing, a red
  `Err` when spoiled.
- **Models per upgrade:** Turbo-Mixer level 0–3 picks the motor base, all of the shape above: white Classic (a plain
  black knob on a grey ring with 0 / 1 / 2 / P, a red lamp that is on while blending, no display), brushed-stainless
  Turbo like the photo (white countdown digits, a chrome dial ring with a black Start/Stop cap and a ramp of ticks),
  açaí-purple Pro (cyan digits, an LED ring around the dial that fills clockwise while blending), graphite Pro Max with a
  chrome trim along the band and its V, a bigger display and a thin light line just over the plinth with a soft halo on
  the body, not on the floor where the game's timer bar runs (white idle, cyan blending, green ready, red blinking when it
  overflows). The dial turns to the top of its ramp while blending. The big jug is
  taller and wider. Green LEDs at the tip of every base's V show the portions left.
  The shop's Turbo-Mixer card shows the next model ("New model: Pro").
- **Matcha machine:** a stylised household tea-latte machine (the overhaul's second reference photo; the lettering reads
  "MATCHA" / "AÇAÍ FEVER"): an upright rounded housing with a muted olive matcha-green shell around a glossy black front
  (a soft sheen from the top left). Per slot a bay: the water tank at the top in a dark, fairly opaque smoked brown-grey
  (its water level and the bubbles still show through; tapering downward, a grip recess down its front left – a shadowed
  wall and a lit edge, drawn over the smoke so it reads at 1× –, a dark lid with a steam vent), an olive collar under it
  with a chrome knob on its front right and the status LED on its front left, the black nozzle head with a chrome tip, a
  dark recess behind the glass and the drip tray with a grate along the bottom. On the right, in an arched alcove, the
  tea mill: a dark base, a glass cylinder with green matcha powder and a cream burr on a shaft, two olive rings, a dark
  cap; the lettering above it. One slot (≈230 px wide, close to the photo; also the locked teaser) or, with
  "Doppel-Matcha", a wider machine with two bays side by side and a small "80°C" display. The glass on each drip tray is
  DOM art (`matchaGlassSVG`, a tall clear tumbler ≈0.8 × a cup's height; the bay leaves room under the nozzle for its
  straw and garnish: a ready glass's straw ends ≥ 3 px under the collar, beside the nozzle head; a glass that gets ready
  flashes its glow and pops only a little – 1.06 × 1.03 – so the straw stays clear of the collar). Without WebGL the
  drawn machine stands still; the game lights a slot's LED over the drawing (amber blinking while it brews, green when
  ready), the glass stands still too and its own stream starts at the drawn nozzle's tip.
- **Animations** are functions of state and time: vortex, swirl and frozen chunks that melt away while blending, jug
  vibration, the countdown and the filling LED ring, foam, drips, a puddle and the lifted lid (with its cap) when
  overflowing, mould and flies when spoiled; the matcha machine: a fruit dropped on a glass is its purée at the bottom,
  the mill's burr turns and green dust whirls while the powder sinks a little, bubbles rise on the front of the tank's
  water and steam puffs from its vent (blended, light with a grey edge, so they show softly over the white pass at 1×),
  then the nozzle pours (milk first, then the matcha) and the glass fills (`pourFill`; a pour sound as the stream
  appears) while the tank's water sinks; the LED blinks amber while it brews and is green when the glass is ready; the
  bin lid opens while something trashable is carried (wide over the bin) and falls shut with a bounce; cold air spills
  out of the chest freezer while a pack is taken.
- **Rendering:** one shared offscreen WebGL context draws each view into the view's own 2D canvas (passes: contact shadow,
  opaque, decals, glass back-to-front – both sides of clear plastic, only the near side of a filled jar's glass –, glows).
  A view only redraws when its state changed or while it animates. If drawing is
  slow (software WebGL), animation frames and progress updates are spaced out (state changes never): all views share
  one budget – after any draw no animation frame for 5 × the average frame time (at most 250 ms, or one frame time when
  a frame takes longer), the view drawn longest ago goes next –, so at least half of the main thread stays free however
  many appliances animate (two blenders and the two-slot machine at once kept the game at 2–9 fps with a gap per view);
  a lost context keeps the last pictures until it is restored.
- **In the game** (`game-view.js`): every ingredient's `.g-art` holds its container's still picture(s) and `binFillSVG`
  (drawn again only when a new pixel ratio has held for 200 ms, not for every step of a window being resized); the root gets `is-3d`; blender `.g-art` holds the canvas plus the DOM status badge
  (`blenderBadgeSVG` at `blenderBadgeAt` of the model, the blending ring keeps `data-ring`; the drawn blender without
  WebGL gets the same DOM badge); a dragged blender carries `snapshot()` of its canvas, cropped to `blenderBox` of its
  model and state (measured when the blenders are built; a live canvas is never read back – that would stall the GPU); the
  freezer gets two canvases around the DOM packs (frame, frosty well with spare packs on a step at the back and the
  sliding glass lids behind them; the frame's front edge and the cold air in front of them; the canvases end at the
  worktop's front edge); the machine canvas sits under the DOM glasses (slots; drawn with `{fill, stream: false}`, the nozzle pours); the blender and bin canvases reach above
  their hit areas (an overflowing lid, the bin lid). The animation clock `animT` only runs while the game runs (pause,
  game over and `prefers-reduced-motion` freeze it).
- Preview of every model and state, and of every ingredient container: `tools/appliances-3d.html` (`?z=2` zoom, `?only=`
  filter, `?t=` time).

### 4.5 Audio (`js/audio.js`) – contract
```js
audio.unlock()                // call from first user gesture; creates/resumes AudioContext
audio.sfx(name)               // names below; no-op if muted or locked
audio.music(track)            // 'menu' | 'game' | null (stop); crossfade
audio.loop(id, on)            // continuous sounds: 'blender' (only while ≥1 blender is blending)
audio.setSfx(bool); audio.setMusic(bool); audio.sfxOn(); audio.musicOn()
audio.suspend(); audio.resume()  // for pause / tab hidden
```
SFX names: `click, pickup, drop, reject, blenderStart, blenderReady, overflow, ruined, matchaReady, pour,
plop, coin, bell, angry, happy, trash, purchase, star, win, lose, closing, heart, tick, cup` (`cup`: a cup set down).
`synthKit` (instruments, effects, tracks) is exported for `tools/promo` only; the game does not use it.

### 4.6 Screens & router (`js/main.js`, `js/screens.js`, `js/game-view.js`)
```js
// main.js
go(name, params)  // 'title' | 'map' | 'shop' | 'settings' | 'game' | 'results'
// every screen module exports: render(container, params, ctx) → cleanup()
ctx = { go, audio, t, screen /* current name */, rerender /* true on a language re-render */ }
// game-view creates its own drag manager; save helpers are imported from save.js
```
- `screens.js` exports `screens = { title, map, shop, settings, results }` (each `{render}`) and
  `openPreLevel(container, levelId, ctx, { animate, onClose }?)` (modal on the map). `game-view.js` exports
  `gameScreen = {render}`.
- Params: map `{ openLevel? }`, shop `{ back: 'map'|'title', tab? }`, settings `{ back }`, results = resultObject.
- Game params: `{ mode: 'campaign', levelId, seed? }` or `{ mode: 'endless', seed? }` (`seed` only for tests).
  On game over the game view shows a short "Geschafft!/Level complete!" stamp, then calls
  `ctx.go('results', resultObject)` (tapping the stamp skips the wait).
- `resultObject = { mode, levelId, result:'won'|'lost', reason, stars, money, served, lost, newBest,
  unlockedEndless, unlockedLevel, coinsTotal }` (game-view records the result through `save.js` first);
  endless adds `best` and `stage` (0-based engine stage; the results screen shows `stage + 1`).
- Test hooks: `window.__acaiGo(name, params)`, `window.__acaiScreen()`, `window.__acaiGame` (live game),
  `window.__acaiSpeed` (simulation speed multiplier, tests only).
- **Transitions** (`js/curtain.js`, purely visual): the router switches screens at once – `#stage > [data-screen]` is
  always the new one –, the old screen moves to `#stage-leaving` (a box scaled like `#stage`, on top, no pointer
  events, `inert`). Between menus it fades out over the new one (0.22 s); to and from the game the açaí curtain (fixed,
  the whole window) closes over it like an iris (0.28 s), holds a bouncing bowl for a beat and fades open (0.34 s). A
  language re-render has no transition; with reduced motion the old screen goes at once.
- **Loading screen**: at boot the curtain shows the logo and a loading bar over the title until the fonts are in and the
  3D renderer is compiled (at least 0.9 s, at most 4 s), then fades open; `html.is-booting` pauses the title's entrance
  animations under it. It never takes the pointer: a tap, a key or a change of screen opens it at once.
- **Level map**: a scroller (`.map-scroll`, `data-scroll`, as wide as the map art and reaching into the bands) over the
  six regions; it opens with the level that is up next (or `openLevel`) in the middle. A region not reached yet lies
  in a light haze; a sign beside its first level names it ("Am Strand – Level 1–10", "Stadtpromenade – ab Level 11"). The
  player is a pin with a bowl, bobbing over the next level. A mouse drags the map (a drag swallows the click after it).

### 4.7 Gameplay screen layout (stage px, 1280 × 800)
```
y   0– 64  HUD: [pause] [Level n / Endless stage] [hearts]   [money bar with ★ marks]   [clock]
y  64–330  shop scene: back wall (window, chalkboard and shelf with 2–3 seats, pendant lamps), decor; customers
           stand behind the pass at seat centers
           seat x-centers: 2 → [420, 860]; 3 → [270, 640, 1010]; 4 → [200, 493, 787, 1080]
           a guest is a 160 px bust (y 163–323, the pass hides it from y 294): head, neck, shoulders (≈113 wide,
           ≈2.2 heads) and upper arms show, the crown at y≈193, the face y≈205–257; a soft shadow on the wall behind,
           to the lower right, and a faint darker rim right round the head (fair skin and light hair stand off the
           plaster)
           order bubble over each guest's head (y 67–179, ≤ 306 × 112 px: border and padding 8 + bowl part (cup 50,
           rows 2 and 3 of up to 3 icons of 40 px, each row 40 high with its 18 px layer badge in front) + 13 divider +
           drink part (glass 64, fruit badge 26 beside it) + 8; patience bar 12 high across the bottom; without
           toppings one row: 82 high, 96 with a matcha). Its bottom (y 179) meets the top of the tallest hair (the tip
           of a bun or an afro and an angry guest's steam, y≈175–178, tuck a few px under it); only the tail (≈12 px)
           reaches down to the crown, the faces stay clear. Each seat owns a slot as wide as the widest bubble (306 px,
           x 6–1274): centred on its guest while the widest bubbles of all seats fit side by side 8 px apart (2 and 3
           seats), else spread evenly over the stage (4 seats: ≈15 px apart, the outer slots pushed out 41 px, the
           middle ones 13 px). A bubble is centred on its guest while it fits into its slot, else pushed into it; its
           tail stays on the guest's head. The view computes a bubble's width from its order (the sizes above), so
           placing it reads no layout. Bubbles move with their guest when walking in or out or changing seats.
           The bubble belongs to the guest's drop target (§4.3 `hitEls`): a bowl or a glass dropped on any part of it
           is served to that guest, flying into the guest (`land`), and a wrong item let go over it gets the guest's
           hint.
           A toast about a guest hangs from just under the chin (top y≈261) and grows down over the collar and the pass
           (up to 560 px wide, so every reason fits on one line), so it never covers the face
           decor (bought): plants (centre x 58) and jukebox (x 1222) at the edges, the chair between seats 1 and 2, the
           neon (90 px) always in full view on a wall: the bubbles of long orders fill the wall above the heads and the
           window is glass, so it hangs from the wainscot's rail (hook y≈222) with its sign on the oak reeds under the
           faces (y≈237–283), between the two right guests' shoulders with 3 and 4 seats (x 825, 934: right of the
           window, clear of the level banner), beside the jukebox with 1 and 2 seats (x 931, 1041; the chair stands
           between their guests). A toast may hang over it for a moment. A soft, low glow, so it reads as lit without
           pulling the eye from the guests
y 294–338  the pass: white marble top (y 294–318, overlaps customers' bodies) with a fluted oak front facing the
           player; level/closing/stage banners (non-blocking) sit on it (y≈290–345, a long level intro wraps to
           y≈375) so faces and bubbles stay visible, in the middle column (≤ 620 wide, x 330–950) so the blenders' lids
           and badges and the matcha machine stay visible too.
           The work area is drawn over it: tall appliances at the back of the worktop stand in front of the pass and
           may cover its oak front and the lower marble edge (never the guests' faces or bubbles)
y 338–800  worktop in perspective (counterSVG), down to the bottom of the screen: terrazzo, chips shrinking toward the back, the pass's shadow on the
           far edge; everything on it is seen from above at an angle and casts a soft shadow. Back row: the front feet
           of the blenders and the machine end on one line at y≈548.
  x  10–320  blenders at the back (hit box 150 × 210, y 338–548; 1 → x 89, 2 → x 10 and 170, so two big jugs keep a
             gap), every model equally tall: a 2-bowl jug ≈200 px (about twice a cup; its lid at y≈348, clearly below
             the pass), the 3-bowl jug ≈220 px (its lid at y≈328, over the pass's oak front) – 3D canvas 164 × 292
             reaching up over the pass, drawn art 245 px (without WebGL; as tall as the 2-bowl 3D jug, its lid at
             y≈350); status badge over the right end of the lid, timer bar on the worktop under the feet (y 551–561,
             over the freezer's back rim); in front of them the chest freezer built into the counter (x 16–300,
             opening y 556–742): the base packs (owned bases only, 84 px) stand in the frosty well, a glass lid slid
             back over spare packs, the frame's front edge covers their feet; the label "1 · Base" lies on the worktop
             under it
  x 330–940  cup stack (105 px, "Bowls", y≈340–522; its cups are the size of a placed cup) + cup spots (2–4, 120 px
             boxes, y 380–528), centred together, with content chips under each cup in the bubbles' language and
             layout: the base chip, beside it a row of the fruits & crunch and under that one of the toppings &
             sauces, each item a whole 22 px icon on a 25 px circle in its layer's tint, in a white ring; a wrong cup
             with more than 3 of one layer (up to 6 items) fills rows of 3, the fruits & crunch first, so there are
             never more than two rows (≤ 107 × 50 px, centred under the cup within its width, standing on its box's
             bottom edge: one row under the cup's foot, y 503–528, with two rows the first in front of the foot,
             y 478–503 – inside the box, so the drop glow and the tutorial's ring hold them; a press on a chip lifts
             its cup); a spot without a cup shows a white coaster with a dashed cup outline.
             Ingredients (owned only, 96 × 84 px boxes, pitch 102, the hit area reaching 12 px higher: up to the
             cups' boxes, over the back riser's front edge) in their containers (js/pantry3d.js) in two
             rows on oak risers: "Fruits & Crunch" y 542–642 (the fruit pans first, then the granola jar) behind
             "Toppings & Sauces" y 642–742; a row is centred under the cups while it fits into x 330–940, a longer
             one starts at x 330 and reaches right in front of the machine (7 toppings: x 330–1038). A riser's top
             face (y +34–84) holds the containers, their feet on one line (y +68) with the name tag standing in
             front of them (y +67–82, clear of the layer label below). The badges sit beside the containers
             (pantryBadges), never in the air above a flat one or on a dipper, spoon or nozzle: a row's layer badges
             and quality stars on one line (y +6), the badge left of the container's body (on the back corner of a
             wide pan, bowl or board), the stars right of it, a "NEU" sticker right above the stars (beside the
             granola jar under them; honey and peanut butter stack sticker, badge and stars on their lid's side); an
             ingredient without stars has its sticker in their place, stuck to the container. A container's art
             box (96 × 112) starts 28 px above its box, so a tall one of the front row (the honey dipper) reaches up
             in front of the riser behind it, the squeeze bottle's nozzle up behind that row's name tags (drawn over
             it), and the granola jar's lid, swung back behind its mouth, reaches up under the content chips of the
             cup behind it (y ≥ 515; the chips are drawn over it, and a press on its top 13 px – or on a chip – takes
             that cup). Each
             riser carries its layer name on its front edge ("2 · Fruits & Crunch", "3 · Toppings & Sauces") like the
             freezer's "1 · Base", drawn over a tall container of the row in front; a "NEU" sticker of that row
             sticks up over the riser's front edge, except where it would cover the layer name (within ≈72 px of
             its middle): then it sits on the badges' line beside its container, the stars under it (honey and
             peanut butter: under their stars)
  x 952–1264 matcha machine at the back (when present, slots = kitchen.matchaSlots; a locked teaser before
             level 7: the one-slot machine greyed (opaque), a lock on its black front between the tank and the mill, "Matcha ab
             Level 7" under it): a 312 px box
             (y 265–577), the machine ≈243 px tall (its top at y≈306, clear of the pass's top line, its drip tray's
             front on the back-row line), ≈230 px wide with one slot (x 993–1223), ≈300 with two (x 957–1259); the
             tea mill stands at its right. The glasses (102 px boxes, a glass ≈75 px tall: ≈0.8 × a cup's height; the bay under each nozzle
             leaves room for its straw and garnish) stand on its drip trays; a slot (the glass's hit area) is
             96 × 136 px, two of them keep a gap; a slot's timer bar lies on the worktop just under the drip tray's
             front (y≈551–561), like the blenders' bars; a fruit basket and a jar of straws (decor, part of
             counterSVG) on the worktop in front of the machine
y 742–800  more worktop: no cabinet, no shelves, no crates – nothing but the work surface; the trash can (136 px
           box, x 1136–1272, y 664–800, its lid reaching higher) stands on it, bottom right
```
Interaction targets must be ≥ 64 stage px (tablet fingers). Valid drop targets glow while dragging.
`tests/e2e/layout.e2e.mjs` checks that every station (blenders, packs, cup stack, cup spots, ingredients,
machine slots, trash) lies fully on the stage below the pass, is ≥ 64 × 64 and overlaps no other station, and that
the layer names and the ingredients' name tags stay uncovered (and "NEU" badges are drawn on top, over the riser behind them
or beside their container, hiding no quality stars or layer badge) – in the fullest kitchen (4 seats, 2 blenders, 4 cups, 16 ingredients, 2 machine
slots, with and without WebGL, at 1280×800 and 1024×768) and in small ones (level 1, level 5, endless), and that a press
on any of a cup's content chips (seven of them: 3 + 3 items, 6 fruits & crunch, 4 + 2 and 1 + 5) lifts that cup (the
chips stay within the cup's width in at most two rows, so they never take a press from the neighbour). It also seats
4, 3 and 2 guests with the longest orders (3 + 3 + a matcha): their bubbles stay on the stage below the HUD (from
y 66), keep ≥ 8 px between each other (with 4 seats the same gap between each two), end above the hair (y ≤ 180),
point their tail at their guest's head (with 2 and 3 seats: centred on it), show icons ≥ 38 px and a big tick on a
delivered part, and leave the neon sign clear (it hangs clear of the guests and the window
too); a pack let go on the outer bubble's drink part gets that guest's hint, and a glass dropped with the mouse there and
a bowl on the other outer bubble's base cup – both beside their guest – are served and fly into their guest.

### 4.8 Visual language
- Fonts: **Lilita One** (display: logo, headings, numbers) + **Nunito** 600/800/900 (UI text), fallbacks
  `"Trebuchet MS", system-ui, sans-serif`. Loaded from Google Fonts.
- Gameplay: a modern café in a realistic, glossy illustration style seen like Cooking Fever from behind the counter.
  Its back wall is deliberately calm – mid-light, slightly muted, soft contrasts – so the guests and their bubbles stay
  in front: warm greige plaster with a soft texture and a slanted patch of light from the top left, a window with a deep
  reveal (its top in shadow, the right jamb lit) and a hazy, bright beach view – its frame lines never graze a guest's
  head –, a chalkboard menu and one oak shelf with jars, a plant and cups (with 2 and 3 seats; with 4 the outer bubbles
  would hide them all but for awkward slivers, so the wall leaves them out), a matched pair of pendant lamps over the
  window (clear of the HUD's pills) with warm halos and light falling on the wall, a fluted oak wainscot with the
  rail's shadow on it, soft shadows to the lower right and a vignette toward the corners; nothing busy or saturated
  behind the bubbles (y≈67–191 with their tails) or the faces. The guests are drawn with natural proportions (busts:
  head, neck, broad shoulders) in the same light, their clothes in clear colours that stand out against the wall. In
  front of them: a marble pass with an oak front, a warm cream terrazzo worktop in perspective (peach in the pass's
  shadow, cream and blush chips with a few in the café's colours – pitaya, açaí, mint, mango –, the pendant lamps' light
  pooling in its middle) with a rounded front edge and open shelves of stock below, the ingredients in real containers on oak risers (brushed stainless pans of fruit in neat rows, glass jars, a squeeze bottle, a coconut
  shell, a walnut bowl, a board – 3D, light from the top left like everything else), 3D appliances about twice as tall as a cup (a stand
  blender after a household model – fluted glass jug, tall stainless base with a black glass V display band and a big chrome dial –, a matcha
  machine after a household tea-latte machine – muted olive shell, black front, smoked water tank, a glass tea mill –,
  stainless freezer and pedal bin) – clean and modern rather than cluttered. A soft warm vignette (`.g-vignette`, over
  the work area and the guests, under the HUD) lets the corners fall off for depth.
  The HUD speaks the menus' language: cream pills with the 3px ink outline, a 4px ink lip and a soft drop shadow (the
  level pill and the pause button in glossy açaí purple with outlined white lettering), the money pill's coin sticking
  out over its left edge, the goal bar a dark track with an ink outline and a glossy mango fill. Toasts and cards in the
  café (tutorial, banners, pause) have a finer ink outline (2–2.5px) and lip; the order bubbles stay opaque white
  panels with a soft shadow (no outline). In the order bubbles every layer keeps its colour – badge 1 açaí purple, 2 leaf green,
  3 pitaya pink, like the badges on the freezer and the containers – and its items sit on circles in that colour's
  light tint (the chips under the cups the same); the patience
  bar runs leaf → mango → orange → red with the guest's mood (angry: a red border and a small shake from side to side –
  a tilt would lift a wide bubble's far corner into the HUD); a delivered part becomes a green field with a big glossy
  tick in a white ring on its lower right corner, down to the patience bar: the bowl's centred on the divider (without a
  matcha on the bubble's edge, overhanging it), where it hides only the corners of the last icons, the drink's tucked
  into the bubble beside the glass, under the fruit badge – the contents stay recognisable. The bubble itself is opaque
  white (nothing behind it shows through). With reduced motion it neither pops in nor shakes, and its tick appears
  without a pop. Menus keep
  the chunky cartoon UI (thick ink outline buttons and panels) around the same realistic food art.
- No dark-mode variant, but every colour is a CSS token on `:root` (game-only tokens on `.screen-game`)
  and `body` sets an explicit background.
- Tokens (base.css): `--acai #3b1556` (deep purple, letterbox/menus), `--acai-2 #6c2a8f`, `--pitaya #ff3d8b`,
  `--mango #ffb627`, `--leaf #2fbf71`, `--lagoon #18c2c9`, `--cream #fff4df`, `--ink #2a1236`,
  `--wood #c97d43`, `--wood-dark #8e4f22`, `--danger #ff4d4d`, `--ok #2fbf71`.
- Chunky candy buttons: rounded 18px, thick dark outline (3px `--ink`), bottom lip 0 6px 0 that compresses on press
  (the button also squeezes to 97 %), glossy: a light top and a darker bottom in the colour (`--btn-gloss`), a soft
  highlight band across the upper third (`::after`, under the label), a bevel inside the outline (`--btn-bevel`) and a
  drop shadow (`--btn-drop`). Coloured buttons carry white lettering with an ink outline. Override a button's colour
  with `background-color` (the gloss is its `background-image`). The main call to action (title "Spielen", "Los
  geht's!", "Weiter") gets `.btn-shine`: a light streak sweeping across it every few seconds. The pause menu's buttons
  carry icons (play, retry, map / flag); music and sounds are icon switches with a little lamp.
- Labels in the café: in levels 1–3 every container shows its name tag and the shelves their layer labels; from level 4
  (and in endless) they step back (`.is-quiet-labels`: opacity only, the layout stays): a name shows while the pointer
  rests on a container (mouse) or while something is taken from it, and a new ingredient (its "NEU" sticker) keeps its
  name. The layer numbers on the containers stay.
- Feedback: pickup scale-up, drop squash, reject shake + red flash + reason toast, coin fly to HUD,
  "+12" floating numbers, blender vibration and vortex while blending (3D), overflow foam + drips + red glow, customer bob.
  Serving: praise over the happy guest for a quick hand ("Perfekt!" with ≥ 75 % patience left, "Super!" with ≥ 45 %),
  a burst of sparkles round the face, and from the second guest in a row a "Combo ×n!" pill over the pass (it grows a
  little with the streak, turns pink from 5, a star sound from 3; under a banner when one is up). The combo is feedback
  only – it pays nothing extra, so the balance stays as tested. A guest walking out shakes the café (wall, pass, HUD –
  not the worktop, where something may be in the hand) and flashes the edges red. Guests with open eyes blink now and
  then; the title guest blinks and laughs every few seconds.
- Vibration (touch devices with the Vibration API, i.e. Android; setting "Vibration"): a tap when a guest pays, a
  double tap for a combo from 3, a buzz on a wrong drop, a double knock when a guest walks out (`js/haptics.js`).
- Respect `prefers-reduced-motion` (reduce shakes/bobs, keep state changes): no transitions, no shake, no red flash, no
  sparkles; praise and combo stand still.

### 4.9 Persistence (`js/save.js`)
Key `acaiFever.save.v1`. Shape:
```js
{ version: 1, coins, owned: ['acai','banana','granola','honey'], ingLevels: {}, upgrades: {},
  stars: { [levelId]: 0..3 }, endlessBest: 0, newIngredients: [], seenIntros: {},
  settings: { lang: 'de'|'en', music: true, sfx: true, haptics: true }, stats: { served, earned, played } }
```
- Loading repairs every field (unknown ids dropped, levels clamped to their range as whole numbers,
  amounts finite and ≥ 0, `newIngredients` ⊆ `owned`, only an explicit `false` mutes), so a damaged or
  hand-edited save can never break the map, the shop or a level. Non-finite amounts never reach the wallet.
- Several tabs share one save: before each change `save.js` adopts what another tab stored since this tab
  last read or wrote it, and a `storage` event updates open menus (`onSaveChange`) right away. While
  writes fail (quota, blocked storage) the in-memory state wins.
- Renamed upgrade ids carry over (`LEGACY_UPGRADES`): the smoothie machine became the matcha machine, so an old save's
  `upgrades.smoothieSlots` is taken over as `matchaSlots` (unless that is set) and the old id is not kept. The key and
  `version: 1` stay; `seenIntros` only ever stores `basics`, so the renamed level-7 intro needs nothing.

### 4.10 Build & hosting
- Dev: `npm start` (static server on :8080) – ES modules need http(s), not `file://`.
- GitHub Pages: every push to `main` runs `.github/workflows/pages.yml` (Pages source "GitHub Actions"): unit tests,
  then it publishes `index.html` + `css/` + `js/` (ES modules, no build step) with `manifest.webmanifest`, `sw.js` and
  `icons/`, `dist/acai-fever.html` and `tools/appliances-3d.html` at https://leesyashin.github.io/Acai/.
- Installable web app: `index.html` links `manifest.webmanifest` (name, `display: fullscreen`, landscape, açaí purple,
  icons incl. a maskable one) and the apple-touch-icon, so "Add to Home Screen" gives a real app icon and a window
  without browser bars (then the screens run full bleed, §4.1). `js/main.js` registers `sw.js` – only on https and only
  when the page has its manifest (never the single-file builds or a dev server): every file the game loads (same origin
  and Google Fonts) is cached on the way and answered from the cache next time while a fresh copy is fetched
  (stale-while-revalidate), so the game runs offline once played; a new `CACHE` name drops the old cache. The icons are
  drawn from `appIconSVG` by `node tools/icons.mjs` (the game's only image files).
- `npm run build` → `dist/acai-fever.html` (single self-contained file, works from `file://`) and
  `dist/artifact.html` (same content without doctype/html/head/body wrapper, for publishing as a Claude artifact).
  The manifest and icon links are left out of both (the standalone page gets the 32 px favicon as a data: URL).
  `dist/` is committed – rebuild it with every change to the game (Pages copies it without building).
- `npm test` → `node --test "tests/**/*.test.mjs"` (`node --test tests/` also works through `tests/index.js`;
  Node 22 treats a bare directory argument as a module).
- `appliances.e2e.mjs` checks the 3D stations in a real browser (canvases drawn, model per upgrade, blending animates,
  bin lid and the freezer's cold air react to drags, the matcha machine brews – the purée first, then the nozzle fills
  the glass –, shop pictures, the ingredient containers' still pictures drawn again sharp for a new pixel ratio) and the
  SVG fallback without WebGL.
- `layout.e2e.mjs` checks the gameplay layout of §4.7 (stations on the stage, ≥ 64 px, no overlaps, layer names and name
  tags uncovered, badges visible, a press on a cup's chips lifts that cup), the order bubbles of 4, 3 and 2 guests with
  the longest orders (on the stage below the HUD, apart – evenly with 4 seats –, above the hair, tails on the heads,
  icons ≥ 38 px, the neon sign clear of them and of the window) and drops on a bubble's parts (served, flying into the
  guest; a wrong item gets the guest's hint).
- `npm run e2e` → every `tests/e2e/*.e2e.mjs` in sequence (Playwright, static server on :8090 by default,
  `E2E_PORT` overrides). `node tools/shots.mjs <dir>` writes review screenshots of every screen.
