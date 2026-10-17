# Açaí Fever – Game Design & Architecture

A Cooking-Fever-style time-management game in the browser: you run an açaí bowl
shop, customers order bowls (and later smoothies), and you assemble them by
drag & drop under time pressure. Plain HTML/CSS/JS (ES modules), no framework.

This document is the single source of truth. Every module must follow the
contracts below. When in doubt, prefer the simpler behaviour that matches the
player decisions listed in §1.

---

## 1. Player decisions (from the brief – do not change)

| # | Topic | Decision |
|---|---|---|
| 1 | Device | **Tablet, landscape** first (touch). Must still work with mouse on PC and (scaled) on phones. |
| 2 | Style | **Realistic, glossy Cooking Fever look in a modern café**: the player stands at the counter, seen in perspective like in Cooking Fever (worktop, rounded front edge, open shelves with stock below); clear plastic cups that show their layers, ingredients heaped in stoneware bowls, 3D appliances (blender, smoothie machine, freezer), a little cleaner and more modern than Cooking Fever. Menus keep their chunky cartoon UI. |
| 3 | Controls | **Drag & drop** (touch + mouse) for every action. No tap-to-place. |
| 4 | Order rule | **Fixed layers**: Base (from blender) → Fruits & Crunch → Toppings & Sauces. A drop into the wrong layer is **rejected** (bounce back + hint). Order *within* a layer is free. |
| 5 | Stations | **Blender** with wait time for the base; it **overflows / spoils** if left too long. Later a **smoothie machine**. |
| 6 | Customers | Seats grow **2 → 3 → 4** with level progress. |
| 7 | Patience | When patience runs out the customer **leaves, pays nothing**, player loses a **heart**. 0 hearts = level lost. |
| 8 | Levels | **Campaign** (20 levels, time limit + money goal, 1–3 stars) **plus Endless mode** (unlocked later). |
| 9 | Unlocks | New ingredients are **bought with earned coins** in the shop (no level gate on ingredients). |
| 10 | Upgrades | **Faster blender**, **more slots** (bowl slots, 2nd blender, bigger jug, smoothie slots), **decor → more patience**, **better ingredient quality → more coins**. |
| 11 | Ingredient count | **16** total, **4 at start**. |
| 12 | Drinks | **Smoothies** from campaign level 7 on. |
| 13 | Language | **German / English**, switchable in menu, remembered. |
| 14 | Sound | **SFX + music**, each mutable, remembered. |
| 15 | Name | **Açaí Fever** |
| 16 | Cups | A bowl is a **clear plastic cup**. An empty cup is **put down from the stack** on a free spot before anything goes into it; serving or trashing takes it off the counter. |

---

## 2. Core loop

1. A customer walks to a free seat at the counter and shows an **order bubble**:
   one bowl (base + 1–3 fruits/crunch + 0–3 toppings) and, from level 7, sometimes a smoothie.
2. Player drags a **frozen base pack** (Açaí / Pitaya / Spirulina) into an **empty blender**.
   The blender blends for `blendTime` seconds, then is **ready** with `portions` portions.
3. Player drags an **empty cup from the stack** onto a **free bowl spot** (`placeCup`; a spot that already
   has a cup → `cupThere`). Pouring or adding anything on a spot without a cup → rejected (`noCup`).
   Natural moment: while the blender mixes.
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
7. Smoothies: drag a smoothie-capable **fruit bin onto an empty smoothie-machine slot** →
   it mixes for `smoothieTime` seconds → a **ready cup** → drag cup onto the customer.
   (The machine brings its own cups – only bowls need a cup from the stack.)
8. When all parts of a customer's order are delivered they **pay** (order value + tip based
   on remaining patience) and leave happily. Coins fly to the HUD.
9. Wrong/unneeded bowls or cups can be dragged into the **trash** (a bowl goes in with its cup). A **spoiled blender** must be
   dragged to the trash to empty it (also allowed for a ready blender to discard it).

### Blender lifecycle
`empty → blending (blendTime) → ready (readyHold) → overflowing (overflowTime) → ruined`
- `ready` and `overflowing` can both be poured into bowls. `overflowing` shakes red and warns.
- `ruined` cannot be used; drag it to the trash → `empty`. When a blender spoils, the view shows a short hint at it
  ("Spoiled! Drag the blender to the trash.") and wiggles the trash can.
- If a level has `overflow: false` (levels 1–2) the blender stays `ready` forever.
- Pouring the last portion → `empty`.

### Patience
- Each customer has `maxPatience = level.patience × kitchen.patienceMult` (+8 s if the order has a smoothie).
- Drains 1/s while waiting. Each partial delivery (bowl or smoothie of a 2‑part order) refills **+15 %** of max.
- Mood from ratio: `>0.6 happy`, `>0.3 neutral`, `>0.12 impatient`, else `angry`.
- At 0 → leaves angry, `hearts -= 1`, `lost += 1`.

### Payment
- Bowl value = Σ `ingredientValue(id)` of base + all items.
- Smoothie value = `SMOOTHIE_PRICE × qualityMultiplier(fruit)`.
- Order value = bowl value + smoothie value. **Tip** = `round(value × 0.3 × patienceRatio)` at completion.
- Coins of a level are added to the wallet at the end **even if the level is lost**.

### Level end
- **Campaign:** when `time ≥ duration` the shop **closes** (banner "Ladenschluss!/Closing time!"): no new
  customers. The level ends when all seats are empty. Result: `won` if `money ≥ goals[0]` and `hearts > 0`,
  else `lost`. Stars = number of `goals` reached (only when won).
- Each campaign level starts with `level.hearts` hearts (3; 4 on the 4-seat levels 12–20).
- **Hearts 0** at any time → immediate `lost`.
- **Endless:** no time limit; every 30 s the stage increases (`endlessConfig(stage)` – more seats, faster
  spawns, less patience, bigger orders). Ends when hearts hit 0, or when the player ends the shift from the
  pause menu ("Schicht beenden/End shift" or "Neu starten/Restart" once anything was earned – the run then
  ends like a lost one, so coins and the best score are banked). Score = coins earned; best score is saved.
  Endless is unlocked after winning campaign level 10.

### Tutorial & intros
- Level 1 (`intro: 'basics'`) runs a step-by-step tutorial with an arrow + speech text. While the tutorial
  runs, `game.tutorialHold = true`: the first customer's patience does not drain and no further customers
  spawn. Steps: (1) drag açaí pack into blender, (2) put an empty cup from the stack on a free spot (shown while
  the blender mixes, or once it is ready, whenever no cup is down), (3) wait while it blends, (4) drag blender onto
  the cup, (5) drag the ordered ingredient(s) onto the bowl, (6) drag the bowl to the customer, (7) "Great! Watch
  the patience of your customers" → hold released. The step is derived from the game state every frame (a trashed
  bowl leads back to the cup step).
- Other intros (`overflow`, `moreSeats`, `smoothie`, `fourSeats`, `endless`) are explained in the pre-level
  card and with a short non-blocking banner at level start.
- A freshly bought ingredient shows a "NEU/NEW" badge on its bin for the next level.

---

## 3. Content (see `js/data.js` – the canonical tables)

16 ingredients in three layers:

| Layer | Ingredients (start ones in **bold**) |
|---|---|
| `base` (blender) | **Açaí**, Pitaya, Blue Spirulina |
| `mid` (Fruits & Crunch) | **Banana**, **Granola**, Strawberry, Blueberries, Mango, Kiwi |
| `top` (Toppings & Sauces) | **Honey**, Coconut flakes, Chia seeds, Peanut butter, Chocolate sauce, Mint, Cacao nibs |

Smoothie flavours = smoothie-capable `mid` fruits the player owns (banana, strawberry, blueberry, mango, kiwi).

Upgrades (`UPGRADES` in data.js): `blenderSpeed` (3 levels), `jug` (portions 2→3, readyHold 9→13.5 s so the bigger batch does not spoil), `blender2` (2nd blender),
`bowlSlots` (2→3→4), `smoothieSlots` (1→2, needs level 7 reached), decor: `plants`, `jukebox`, `seating`,
`neon` (each adds patience %, and appears visibly in the shop scene). Ingredient quality: each owned
ingredient has 2 quality upgrades (value ×1.3, ×1.6, rounded up to 0.5 so every star adds coins).

---

## 4. Architecture

```
index.html            full HTML page; loads css/*.css + js/main.js (type=module)
css/base.css          tokens, fonts, buttons, panels, shared animations, #app/#stage scaling shell
css/screens.css       title, map, shop, settings, pre-level modal, results
css/game.css          gameplay screen (HUD, scene, customers, stations, bins, bowls, drag ghost, tutorial)
js/main.js            boot: load save, set language, init stage + audio, screen router, hot-reload hook
js/stage.js           fixed 1280×800 logical stage scaled to fit; client→stage coordinate mapping
js/i18n.js            t(key, params), registerStrings({de,en}), setLang/getLang/onLangChange
js/data.js            INGREDIENTS, LEVELS, UPGRADES, constants, getKitchenStats(), endlessConfig(), price helpers
js/save.js            persistent progress (localStorage with in-memory fallback) + shop/progress actions
js/rng.js             seeded RNG (mulberry32) + helpers
js/orders.js          order generation + pricing (pure)
js/engine.js          pure game simulation (no DOM): createGame, tick, actions, events
js/drag.js            generic pointer-based drag & drop manager (touch + mouse), stage-scale aware
js/svg.js             shared SVG helpers + the shared gradients/clip paths (artDefsSVG, one hidden <svg> per page)
js/art-food.js        realistic food art: clear cup (bowl), ingredient icons, ingredient bowls, packs, smoothie cups
js/art-kitchen.js     realistic kitchen art: work counter, freezer, trays, blender, smoothie machine, trash, café back wall, decor
js/art.js             people, HUD icons, logo, map; re-exports the food + kitchen art (screens import from here)
js/audio.js           WebAudio synthesized SFX + music loops (no audio files)
js/game-view.js       gameplay screen: DOM from engine state, drag wiring, HUD, pause, tutorial, FX
js/screens.js         menu screens: title, map, shop, settings, pre-level modal, results
tools/build.mjs       esbuild bundle → dist/acai-fever.html (standalone) + dist/artifact.html
tests/*.test.mjs      node --test unit tests (engine, orders, data, save, i18n, audio, art, balance simulation)
tests/e2e/*.e2e.mjs   Playwright scripts (drag, gameplay, screens, playthrough, build) – `npm run e2e`
```

Rules:
- **engine.js / orders.js / rng.js / data.js are pure** (no `document`, no `window`) so `node --test` can import them.
  `data.js` may call `registerStrings` (pure).
- Only `save.js` touches `localStorage` (always inside try/catch).
- Only `audio.js` touches WebAudio.
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
as well as on `#stage`, plus a cancelled `gesturestart` for iOS Safari (`initStage`). A scrollable list
added later needs its own `touch-action: pan-y`.

### 4.2 Engine (`js/engine.js`) – contract

```js
createGame({
  mode: 'campaign' | 'endless',
  level,            // LEVELS[i] (campaign) – ignored for endless
  owned,            // string[] owned ingredient ids
  ingLevels,        // { [id]: 0|1|2 } quality levels
  kitchen,          // getKitchenStats(save.upgrades)
  smoothies,        // boolean – smoothie machine present
  seed,             // number
  tutorial,         // boolean – level-1 tutorial hold active at start
}) → game

tick(game, dt)                                // advance simulation (dt seconds, clamp ≤ 0.1 inside)
loadBlender(game, blenderIdx, baseId)         → { ok, reason? }
placeCup(game, bowlIdx)                       → { ok, reason? }   // empty cup from the stack → free spot
pourBlender(game, blenderIdx, bowlIdx)        → { ok, reason? }
addIngredient(game, bowlIdx, ingId)           → { ok, reason? }
trashBowl(game, bowlIdx)                      → { ok }            // the cup goes too: the spot is free
cleanBlender(game, blenderIdx)                → { ok, reason? }   // ruined/ready/overflowing → empty
loadSmoothie(game, slotIdx, fruitId)          → { ok, reason? }
trashSmoothie(game, slotIdx)                  → { ok }
serveBowl(game, bowlIdx, customerId)          → { ok, reason? }
serveSmoothie(game, slotIdx, customerId)      → { ok, reason? }
setPaused(game, bool)
releaseTutorialHold(game)
endRun(game) → boolean                        // endless only: ends the run (gameOver, reason 'quit')
// Pure checks (no state change) – the reason the matching action would reject with right now, or null:
loadBlenderError(game, blenderIdx, baseId), placeCupError(game, bowlIdx), pourError(game, blenderIdx, bowlIdx),
addIngredientError(game, bowlIdx, ingId), loadSmoothieError(game, slotIdx, fruitId),
serveBowlError(game, bowlIdx, customerId), serveSmoothieError(game, slotIdx, customerId)
drainEvents(game) → Event[]                   // returns and clears queued events
bowlMatchesOrder(bowl, orderBowl) → boolean
```

Reasons (i18n key `reason.<code>` in game-view): `noCup`, `cupThere`, `needBase`, `toppingsOnTop`, `alreadyAdded`, `bowlFull`,
`blenderBusy`, `blenderNotReady`, `blenderRuined`, `bowlHasBase`, `notOwned`, `wrongLayer`, `wrongOrder`,
`noSmoothieWanted`, `noBowlWanted`, `alreadyDelivered`, `slotBusy`, `notReady`, `notSmoothieFruit`, `emptyBowl`,
plus `noCustomer` (customer gone or leaving), `notPlaying` (paused / game over) and `invalid` (bad index,
no smoothie machine). `loadBlender` checks `wrongLayer` → `notOwned` → `blenderRuined` (spoiled blender) → `blenderBusy`; `cleanBlender` returns
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
  smoothie: null | { slots: [ { state: 'empty'|'mixing'|'ready', fruit, t, duration } ] },
  owned, ingLevels, kitchen, events: [],
  result: null|'won'|'lost', stars, endReason: null|'goal'|'hearts'|'quit', featured   // set at game over
}
// blenders and smoothie slots also carry progress (0–1 within the current state; for a ready
// blender it counts toward overflow). bowl.uid changes whenever a bowl is reset.
// Internal state lives in game._sim – never read or write it from the view.
customer = { id, seat, look, order: { bowl: {base, mid[], top[]}, smoothie: fruitId|null },
             delivered: { bowl: bool, smoothie: bool }, patience, maxPatience,
             state: 'arriving'|'waiting'|'leavingHappy'|'leavingAngry', t, mood, paid }
```
Events (`{type, …}`): `customerArrive{customerId, seat}`, `customerPaid{customerId, seat, amount, tip}`,
`customerLost{customerId, seat}`, `partialDelivery{customerId}`, `blenderStart{idx}`, `blenderReady{idx}`,
`blenderOverflow{idx}`, `blenderRuined{idx}`, `blenderEmpty{idx}`, `cupPlaced{bowlIdx}`, `basePoured{bowlIdx, blenderIdx}`,
`ingredientAdded{bowlIdx, id}`, `smoothieStart{idx}`, `smoothieReady{idx}`, `trash{what}`,
`closingTime`, `stageUp{stage}` (endless), `gameOver{result: 'won'|'lost', stars, reason: 'hearts'|'goal'|'quit'|null}`.
`trash` events always carry `idx` (`trash{what:'bowl'|'blender'|'smoothie', idx}`); `cleanBlender` emits
`blenderEmpty` then `trash`. `gameOver.reason` is `null` when won, `'goal'` when lost on goal 1, `'hearts'` when
hearts ran out (endless always ends `lost`, with `'hearts'` or – after `endRun` – `'quit'`). Once the first customer has arrived, `game.time` stops
while `tutorialHold` is on, so the tutorial does not eat level time (blenders keep running).
`customer.look` is `{seed}` – the view builds the look with `lookFromSeed(seed)` from art.js.

### 4.3 Drag & drop (`js/drag.js`) – contract
```js
const dnd = createDragManager({ root /* #stage element */, toStage, ghostLayer /* element inside stage */,
                                 onPickup?(payload), onDrop?(result), onCancel?(result) })
dnd.source(el, { payload: () => obj|null, ghost: (payload) => HTMLElement|markup, onStart?, onEnd?, onTap? }) → unregister
dnd.target(el, { accepts: (payload) => boolean, valid?: (payload) => boolean, drop: (payload) => {ok, reason?} }) → unregister
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
  re-evaluates `valid()` mid-drag (game-view calls it every frame). Hit test: target rect expanded by 18 stage px;
  nearest center wins when overlapping.
- Drop on a target → `drop(payload)`. If `{ok:false}` or no target: ghost animates back to its source and
  `onEnd({ok:false, reason})` fires; the view shows the reason. Drop on nothing = silent return. A release over a
  station that does not accept the payload is a drop on nothing for the manager; the game view uses `pos` to
  explain it (e.g. pack on a bowl → "The pack goes into the blender first!").
- While the pointer itself (not the ghost) still rests on its source – it has not moved more than the 6 CSS px tap
  slop, or it is over the source rect expanded by 6 stage px – nothing is hit: no `drop-hover`, and a release there
  is a silent return (`ok:false`, `targetEl:null`, `pos:null`, not a tap). Holding a bin, a slow sloppy press, or
  picking an item up and putting it back never drops it into the target next to it (bowls sit 2 px above the fruit
  bins).
- Must prevent page scroll/zoom/text selection/long-press callout during drags (`touch-action:none`,
  `user-select:none`, `-webkit-touch-callout:none`, `preventDefault` on pointerdown for sources).
- `pointercancel`, window `blur` and `visibilitychange` cancel the drag cleanly.

### 4.4 Art (`js/art.js`) – contract (all return SVG markup strings)
```js
ingredientIcon(id, size = 64)        // order / chip / shop icon for any of the 16 ingredients (realistic)
binSVG(id, width = 84)               // ingredient bowl (100×72): white stoneware bowl seen from above at an angle, heaped with
                                     // the ingredient; sauces fill the bowl and keep a dipper (honey) or a spoon in it
scoopSVG(id, size = 84)              // what a drag from a bowl carries: a handful, a spoonful (seeds, nibs, sauce), a sprig,
                                     // the honey dipper
packIcon(baseId, size = 72)          // frosty frozen pack for base bins (açaí / pitaya / spirulina)
bowlSVG(bowl, size = 150)            // clear cup {base, mid[], top[]}: purée, a band per fruit/crunch seen through the
                                     // side, sauce runs on the inner wall, heaped toppings; empty cup when base null
cupStackSVG(width = 90)              // stack of empty cups (120×200) – the drag source for a new cup
cupSpotSVG(size = 150)               // free spot: white coaster with a dashed cup outline (same box as bowlSVG)
artDefsSVG() / ART_DEFS_ID           // the hidden <svg> with the shared gradients + clip paths (initStage inserts it)
cupSVG(fruitId|null, state, size=70) // smoothie cup: state 'empty'|'mixing'|'ready'
customerSVG(look, mood, size = 160)  // mood: 'happy'|'neutral'|'impatient'|'angry'
randomLook(rng)                       // → look object (skin, hair colour/style, shirt, accessory) – diverse
blenderSVG({state, base, progress, portions, maxPortions, badge?}, size = 150)  // badge:false hides the status badge
smoothieMachineSVG(slotCount, size)   // machine body without cups (cups drawn separately)
trashSVG(size), coinSVG(size), heartSVG(filled, size), starSVG(filled, size)
decorSVG(id, size)                    // 'plants' | 'jukebox' | 'seating' | 'neon'
shopSceneSVG(width, height)           // back wall / window / sign for the gameplay scene
counterSVG(width, height)             // the work counter under the pass (1280×450): terrazzo worktop in perspective, rounded
                                      // front edge (COUNTER_EDGE_Y), open oak shelves with stock, the freezer's front panel
freezerSVG('well'|'rim', w, h)        // chest freezer in the counter (284×186): frosty well with a glass lid slid back /
                                      // the frame's front edge drawn over the packs
traySVG(w, h)                         // oak tray an ingredient row stands on (drawn 1:1, front edge for the layer label)
logoSVG(width)                        // "Açaí Fever" logo with bowl
```
Look: shapes are filled with their colour and shaded with the shared overlay gradients (`url(#af-sph)`,
`af-cyl`, `af-plastic`, `af-steel` …, light from the top left), thin outlines in a darker shade of the fill.
Everything on the counter is seen from the player's side, from above at an angle (Cooking Fever's view): round
things are ellipses, boxes show their top face and the side that faces the middle of the screen (blender: right
side, smoothie machine: left side), and every object casts a soft shadow on the worktop.
Memoised pictures never contain their own ids (they reference the shared defs); a picture that needs a local
gradient (café wall, work counter, logo, map) builds unique ids with `uid()`. Paint references name a fallback colour
(`url(#af-steel) #cfd6dc`), so a page without the defs still shows plain fills. Guests are drawn with a thin warm
outline (`withInk`), the HUD icons, logo and map keep the cartoon ink line of the menus.

### 4.5 Audio (`js/audio.js`) – contract
```js
audio.unlock()                // call from first user gesture; creates/resumes AudioContext
audio.sfx(name)               // names below; no-op if muted or locked
audio.music(track)            // 'menu' | 'game' | null (stop); crossfade
audio.loop(id, on)            // continuous sounds: 'blender' (only while ≥1 blender is blending)
audio.setSfx(bool); audio.setMusic(bool); audio.sfxOn(); audio.musicOn()
audio.suspend(); audio.resume()  // for pause / tab hidden
```
SFX names: `click, pickup, drop, reject, blenderStart, blenderReady, overflow, ruined, smoothieReady, pour,
plop, coin, bell, angry, happy, trash, purchase, star, win, lose, closing, heart, tick, cup` (`cup`: a cup set down).

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

### 4.7 Gameplay screen layout (stage px, 1280 × 800)
```
y   0– 64  HUD: [pause] [Level n / Endless stage] [hearts]   [money bar with ★ marks]   [clock]
y  64–330  shop scene: back wall, window, sign, decor; customers stand behind the pass at seat centers
           seat x-centers: 2 → [420, 860]; 3 → [270, 640, 1010]; 4 → [200, 493, 787, 1080]
           order bubble above/next to each customer; patience ring/bar on the bubble
y 295–358  the pass: white marble top (y 295–334, overlaps customers' bodies) with a fluted oak front facing the
           player; level/closing/stage banners (non-blocking) sit on it (y≈291–356) so faces and bubbles stay visible
y 350–704  worktop in perspective (counterSVG): terrazzo, chips shrinking toward the back, the pass's shadow on the
           far edge; everything on it is seen from above at an angle and casts a soft shadow
  x  16–300  blenders (1–2, 126 px) at the back; in front of them the chest freezer built into the counter (opening
             y≈518–704): the base packs (owned bases only) stand in the frosty well, a glass lid slid back over spare
             packs, the frame's front edge covers their feet; its front panel below the edge says "1 · Base"
  x 316–964  cup stack (76 px, "Bowls") + bowl spots (2–4, 126 px each), centred together, y≈354–515, with small
             content chips under each cup; a spot without a cup shows a white coaster with a dashed cup outline.
             Ingredient bowls (owned ingredients only, 86 px: bowl + short name label) on two oak trays:
             "Fruits & Crunch" y≈516–608 behind "Toppings & Sauces" y≈610–702; each tray carries its layer name on
             its front edge ("2 · Fruits & Crunch", "3 · Toppings & Sauces") like the freezer's "1 · Base"
  x 980–1264 smoothie machine at the back (when present, slots = kitchen.smoothieSlots; a locked teaser before
             level 7); a fruit basket and a jar of straws (decor) in front of it
y 704–722  rounded front edge of the worktop
y 722–800  cabinet: open oak shelves with the café's stock (cups, bowls, fruit crates, granola, jars, coconuts)
           under an LED strip; the trash can stands on the floor in front of it, bottom right
```
Interaction targets must be ≥ 64 stage px (tablet fingers). Valid drop targets glow while dragging.

### 4.8 Visual language
- Fonts: **Lilita One** (display: logo, headings, numbers) + **Nunito** 600/800/900 (UI text), fallbacks
  `"Trebuchet MS", system-ui, sans-serif`. Loaded from Google Fonts.
- Gameplay: a modern café in a realistic, glossy illustration style (warm plaster wall with fluted oak, pendant
  lamps, menu boards) seen like Cooking Fever from behind the counter: a marble pass with an oak front, a terrazzo
  worktop in perspective with a rounded front edge and open shelves of stock below, ingredients heaped in white
  stoneware bowls on oak trays, 3D appliances (black pro blender, white smoothie machine with an açaí-purple head,
  stainless freezer and pedal bin) – clean and modern rather than cluttered. Bubbles, HUD pills, toasts and
  cards in the café are light frosted panels with soft shadows. Menus keep the chunky cartoon UI (thick ink
  outline buttons and panels) around the same realistic food art.
- No dark-mode variant, but every colour is a CSS token on `:root` (game-only tokens on `.screen-game`)
  and `body` sets an explicit background.
- Tokens (base.css): `--acai #3b1556` (deep purple, letterbox/menus), `--acai-2 #6c2a8f`, `--pitaya #ff3d8b`,
  `--mango #ffb627`, `--leaf #2fbf71`, `--lagoon #18c2c9`, `--cream #fff4df`, `--ink #2a1236`,
  `--wood #c97d43`, `--wood-dark #8e4f22`, `--danger #ff4d4d`, `--ok #2fbf71`.
- Chunky buttons: rounded 18px, thick dark outline (3px `--ink`), bottom shadow 0 6px 0 that compresses on press.
- Feedback: pickup scale-up, drop squash, reject shake + red flash + reason toast, coin fly to HUD,
  "+12" floating numbers, blender shake while blending, overflow red pulse + drips, customer bob.
- Respect `prefers-reduced-motion` (reduce shakes/bobs, keep state changes).

### 4.9 Persistence (`js/save.js`)
Key `acaiFever.save.v1`. Shape:
```js
{ version: 1, coins, owned: ['acai','banana','granola','honey'], ingLevels: {}, upgrades: {},
  stars: { [levelId]: 0..3 }, endlessBest: 0, newIngredients: [], seenIntros: {},
  settings: { lang: 'de'|'en', music: true, sfx: true }, stats: { served, earned, played } }
```
- Loading repairs every field (unknown ids dropped, levels clamped to their range as whole numbers,
  amounts finite and ≥ 0, `newIngredients` ⊆ `owned`, only an explicit `false` mutes), so a damaged or
  hand-edited save can never break the map, the shop or a level. Non-finite amounts never reach the wallet.
- Several tabs share one save: before each change `save.js` adopts what another tab stored since this tab
  last read or wrote it, and a `storage` event updates open menus (`onSaveChange`) right away. While
  writes fail (quota, blocked storage) the in-memory state wins.

### 4.10 Build & hosting
- Dev: `npm start` (static server on :8080) – ES modules need http(s), not `file://`.
- `npm run build` → `dist/acai-fever.html` (single self-contained file, works from `file://`) and
  `dist/artifact.html` (same content without doctype/html/head/body wrapper, for publishing as a Claude artifact).
- `npm test` → `node --test "tests/**/*.test.mjs"` (`node --test tests/` also works through `tests/index.js`;
  Node 22 treats a bare directory argument as a module).
- `npm run e2e` → every `tests/e2e/*.e2e.mjs` in sequence (Playwright, static server on :8090 by default,
  `E2E_PORT` overrides). `node tools/shots.mjs <dir>` writes review screenshots of every screen.
