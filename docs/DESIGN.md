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
| 2 | Style | **Realistic, glossy Cooking Fever look in a modern café**: the player stands at the counter, seen in perspective like in Cooking Fever (a slim marble pass in front of the guests, the worktop with its rounded front edge and a strip of open shelves with stock below; the tall appliances stand at the back of the worktop in front of the pass); believable size relations (blender and machine about twice as tall as a cup); clear plastic cups that show their layers, every ingredient in its own realistic container (fruit in brushed stainless pans, granola, honey, chia and peanut butter in glass jars, chocolate sauce in a squeeze bottle, coconut in its shell, cacao nibs in a wooden bowl, mint on a board), 3D appliances (blender, smoothie machine, freezer), a little cleaner and more modern than Cooking Fever. Menus keep their chunky cartoon UI. |
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
| 17 | Appliances | The kitchen machines are **3D** (real-time WebGL) and **animated** (blending vortex, churning slush, pouring tap, lids and doors), modelled on **real household appliances** (the blender on a stand blender: fluted glass jug with a clear handle, spout and measuring cap, tall tapered motor base with a black glass V display band and a big start/stop dial), with **a new model per upgrade level** (blender: Classic → Turbo → Pro → Pro Max, all of that shape, normal or big jug; smoothie machine: one tank → two tanks). The ingredient containers are 3D pictures too (drawn once, what lies in them is SVG). Without WebGL the drawn SVG art is used. |

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
js/art-food.js        realistic food art: clear cup (bowl), ingredient icons, what lies in the ingredient containers (and the
                      containers drawn, without WebGL), packs, smoothie cups
js/art-kitchen.js     realistic kitchen art: work counter, freezer, risers, café back wall, decor; blender, smoothie machine,
                      trash and freezer as the SVG fallback of the 3D models
js/art.js             people, HUD icons, logo, map; re-exports the food + kitchen art (screens import from here)
js/geo3d.js           3D math, mesh builders (lathe – also fluted or warped –, rounded box, tube, liquid surface) and materials – pure
js/kitchen3d.js       3D models of the appliances as scene descriptions (blender tiers, smoothie machine, bin, freezer) – pure
js/pantry3d.js        3D models of the ingredient containers (stainless pans, jars, squeeze bottle, coconut, wood) – pure
js/gl3d.js            WebGL renderer: one shared offscreen context, studio lighting, glass, patterns
js/art3d.js           live 3D station views (canvas), still pictures drawn once (containers), cached 3D pictures for menus
js/audio.js           WebAudio synthesized SFX + music loops (no audio files)
js/game-view.js       gameplay screen: DOM from engine state, drag wiring, HUD, pause, tutorial, FX
js/screens.js         menu screens: title, map, shop, settings, pre-level modal, results
tools/build.mjs       esbuild bundle → dist/acai-fever.html (standalone) + dist/artifact.html
tests/*.test.mjs      node --test unit tests (engine, orders, data, save, i18n, audio, art, 3D geometry + models + containers, balance simulation)
tests/e2e/*.e2e.mjs   Playwright scripts (drag, gameplay, screens, playthrough, appliances, layout, build) – `npm run e2e`
```

Rules:
- **engine.js / orders.js / rng.js / data.js are pure** (no `document`, no `window`) so `node --test` can import them.
  `data.js` may call `registerStrings` (pure). So are **geo3d.js / kitchen3d.js / pantry3d.js** (scene descriptions only);
  `gl3d.js` and `art3d.js` touch the DOM only when called, never at import time.
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
cupSVG(fruitId|null, state, size=70) // smoothie cup: state 'empty'|'mixing'|'ready'
customerSVG(look, mood, size = 160)  // mood: 'happy'|'neutral'|'impatient'|'angry'
randomLook(rng)                       // → look object (skin, hair colour/style, shirt, accessory) – diverse
blenderSVG({state, base, progress, remaining?, portions, maxPortions, badge?}, size = 150)  // badge:false hides the status badge;
                                      // remaining: whole seconds the display counts down while blending
smoothieMachineSVG(slotCount, size)   // machine body without cups (cups drawn separately)
trashSVG(size), coinSVG(size), heartSVG(filled, size), starSVG(filled, size)
decorSVG(id, size)                    // 'plants' | 'jukebox' | 'seating' | 'neon'
shopSceneSVG(width, height)           // back wall / window / sign for the gameplay scene
counterSVG(width, height)             // the work counter under the pass (1280×462): terrazzo worktop in perspective, rounded
                                      // front edge (COUNTER_EDGE_Y), a strip of open oak shelves with stock, the freezer's
                                      // front panel, a fruit basket and a jar of straws in front of the machine
freezerSVG('well'|'rim', w, h)        // chest freezer in the counter (284×186): frosty well with a glass lid slid back /
                                      // the frame's front edge drawn over the packs
riserSVG(w, h)                        // oak riser an ingredient row stands on (drawn 1:1; its 16 px front edge, ending
                                      // 3 px above the bottom, carries the layer label)
logoSVG(width)                        // "Açaí Fever" logo with bowl
```
Look: shapes are filled with their colour and shaded with the shared overlay gradients (`url(#af-sph)`,
`af-cyl`, `af-plastic`, `af-steel` …, light from the top left), thin outlines in a darker shade of the fill.
Everything on the counter is seen from the player's side, from above at an angle (Cooking Fever's view): round
things are ellipses, boxes show their top face and the side that faces the middle of the screen (smoothie machine:
left side; the blender is drawn from the front like its 3D model), and every object casts a soft shadow on the
worktop. The ingredient containers in the two front rows are seen more steeply (`PANTRY_ELEV` 38°, the tilt the fruit pieces are drawn with): the
rows are nearer to the player and lower than the appliances, and the pans' tops and the jars' mouths must read.
The fruit lies in neat staggered rows like a deli counter, each piece with a little contact shadow away from the
light.
Memoised pictures never contain their own ids (they reference the shared defs); a picture that needs a local
gradient (café wall, work counter, logo, map) builds unique ids with `uid()`. Paint references name a fallback colour
(`url(#af-steel) #cfd6dc`), so a page without the defs still shows plain fills. Guests are drawn with a thin warm
outline (`withInk`), the HUD icons, logo and map keep the cartoon ink line of the menus.

### 4.4.1 3D appliances (`js/geo3d.js`, `js/kitchen3d.js`, `js/gl3d.js`, `js/art3d.js`)
The blender, smoothie machine, pedal bin and chest freezer are real 3D models rendered with WebGL (no library), and so are
the ingredient containers (js/pantry3d.js, drawn once as still pictures). Everything else (guests, food, cups, HUD) stays SVG.
```js
// kitchen3d.js (pure): scene = { frame, elev, persp?, time, items: [{ mesh, mat, m, pass }] }
blenderScene({ tier 0–3, big, state, base, progress, remaining, portions, maxPortions }, t, frame?)
machineScene({ slots: [{ state: 'empty'|'mixing'|'ready', fruit, progress }] }, t, frame?)   // 1 or 2 slots
trashScene({ lid: 0 closed … 1 open }, t, frame?)
freezerScene({ layer: 'back'|'front', door: 0 … 1 /* a pack is being taken */ }, t, frame?)
VIEWS[kind] = { w, h, ax, ay, zoom?, pic? } // canvas size (stage px), where the world origin sits in it, its zoom
                                            // (the blender's is per model), pic = { y, h }: the rows a menu picture shows
blenderLook(save.upgrades) → { tier, big }  // tier = Turbo-Mixer level, big = big jug bought
BLENDER_MODELS = ['Classic', 'Turbo', 'Pro', 'Pro Max'];  MACHINE_SLOT_X; pourFill(progress); isAnimated(kind, o)
blenderZoom(tier, big)                      // a model's zoom: every model equally tall (measured once from its jug, lid and cap)
blenderBadgeAt(tier, big) → { x, y }        // canvas point above the right end of the model's lid (status badge)
blenderBox(tier, big, state) → [x0, y0, x1, y1]  // the canvas part a model in a state covers (drag ghost), measured once
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
pictureMarkup(kind, o, size, fallback, t?)   // <img> (cached data URL) or fallback() markup for menus
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
  it with `pic`), smoothie machine 312 × 312 (zoom 312/236, the machine box of the game; the cups' slots line up with its
  taps and drip trays), pedal bin 153 × 209 (zoom 1.35), chest freezer 284 × 194, ingredient container 96 × 112
  (`PANTRY_VIEW`, origin at ax 48 / ay 96). Every part of every blender state stays inside its canvas and its `blenderBox`
  (tests/kitchen3d.test.mjs), every container inside its art box (tests/pantry3d.test.mjs).
- **Look:** metal/roughness shading with GGX highlights from three studio lights, reflections of a procedural photo studio
  (soft boxes over a warm room), clear plastic with Fresnel reflections, procedural surface patterns (brushed steel, swirling
  purée, slush crystals, frost, printed scales, seven-segment displays, LED rings, wood grain, coconut fibres, and packed
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
  taller and wider. The smoothie machine is a compact white one-tank machine or the stainless two-tank machine, both
  with the café's açaí purple on the head with the taps. Green LEDs at the tip of every base's V show the portions left.
  The shop's Turbo-Mixer card shows the next model ("New model: Pro").
- **Animations** are functions of state and time: vortex, swirl and frozen chunks that melt away while blending, jug
  vibration, the countdown and the filling LED ring, foam, drips, a puddle and the lifted lid (with its cap) when
  overflowing, mould and flies when spoiled; fruit tumbling into the tank, auger and slush churning, then the lever opens and a stream fills the cup (the cup art fills with `pourFill`); the bin lid
  opens while something trashable is carried (wide over the bin) and falls shut with a bounce; cold air spills out of the
  chest freezer while a pack is taken.
- **Rendering:** one shared offscreen WebGL context draws each view into the view's own 2D canvas (passes: contact shadow,
  opaque, decals, glass back-to-front – both sides of clear plastic, only the near side of a filled jar's glass –, glows).
  A view only redraws when its state changed or while it animates. If drawing is
  slow (software WebGL), animation frames and progress updates are spaced out (state changes never); a lost context keeps
  the last pictures until it is restored.
- **In the game** (`game-view.js`): every ingredient's `.g-art` holds its container's still picture(s) and `binFillSVG`
  (drawn again only when a new pixel ratio has held for 200 ms, not for every step of a window being resized); the root gets `is-3d`; blender `.g-art` holds the canvas plus the DOM status badge
  (`blenderBadgeSVG` at `blenderBadgeAt` of the model, the blending ring keeps `data-ring`; the drawn blender without
  WebGL gets the same DOM badge); a dragged blender carries `snapshot()` of its canvas, cropped to `blenderBox` of its
  model and state (measured when the blenders are built; a live canvas is never read back – that would stall the GPU); the
  freezer gets two canvases around the DOM packs (frame, frosty well with spare packs on a step at the back and the
  sliding glass lids behind them; the frame's front edge and the cold air in front of them; the canvases end at the
  worktop's front edge); the machine canvas sits under the DOM cups (slots); the blender and bin canvases reach above
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
y 294–338  the pass: white marble top (y 294–318, overlaps customers' bodies) with a fluted oak front facing the
           player; level/closing/stage banners (non-blocking) sit on it (y≈290–345) so faces and bubbles stay visible.
           The work area is drawn over it: tall appliances at the back of the worktop stand in front of the pass and
           may cover its oak front and the lower marble edge (never the guests' faces or bubbles)
y 338–742  worktop in perspective (counterSVG): terrazzo, chips shrinking toward the back, the pass's shadow on the
           far edge; everything on it is seen from above at an angle and casts a soft shadow. Back row: the front feet
           of the blenders and the machine end on one line at y≈548.
  x  10–320  blenders at the back (hit box 150 × 210, y 338–548; 1 → x 89, 2 → x 10 and 170, so two big jugs keep a
             gap), every model equally tall: a 2-bowl jug ≈200 px (about twice a cup; its lid at y≈348, clearly below
             the pass), the 3-bowl jug ≈220 px (its lid at y≈328, over the pass's oak front) – 3D canvas 164 × 292
             reaching up over the pass, drawn art 220 px; status badge over the right end of the lid, timer bar on
             the worktop under the feet (y 551–561, over the freezer's back rim); in front of them the chest freezer
             built into the counter (x 16–300, opening y 556–742): the base packs (owned bases only, 84 px) stand in
             the frosty well, a glass lid slid back over spare packs, the frame's front edge covers their feet; its
             front panel on the cabinet strip says "1 · Base"
  x 330–940  cup stack (105 px, "Bowls", y≈340–522; its cups are the size of a placed cup) + cup spots (2–4, 120 px
             boxes, y 380–528), centred together, with small content chips under each cup (y≈502–527); a spot without
             a cup shows a white coaster with a dashed cup outline.
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
             cup behind it (y ≥ 515; the chips are drawn over it, and a press on its top 13 px takes that cup). Each
             riser carries its layer name on its front edge ("2 · Fruits & Crunch", "3 · Toppings & Sauces") like the
             freezer's "1 · Base", drawn over a tall container of the row in front; a "NEU" sticker of that row
             sticks up over the riser's front edge, except where it would cover the layer name (within ≈72 px of
             its middle): then it sits on the badges' line beside its container, the stars under it (honey and
             peanut butter: under their stars)
  x 952–1264 smoothie machine at the back (when present, slots = kitchen.smoothieSlots; a locked teaser before
             level 7): a 312 px box (y 265–577), the machine ≈285 px wide with two tanks (≈175 with one), its feet on
             the back-row line; the drink glasses (103 px boxes: an empty glass ≈0.65 × a cup's height, a ready one
             with its dome lid ≈0.8 ×; a bigger one would push its straw into the tap head) stand on its drip trays;
             a fruit basket and a jar of straws (decor, part of counterSVG) on the worktop in front of it
y 742–756  rounded front edge of the worktop
y 756–800  cabinet strip: the tops of open oak shelves with the café's stock (cups, bowls, fruit crates, granola,
           jars, coconuts) under an LED strip; the trash can (136 px box, x 1136–1272, y 664–800, its lid reaching
           higher) stands on the floor in front of it, bottom right
```
Interaction targets must be ≥ 64 stage px (tablet fingers). Valid drop targets glow while dragging.
`tests/e2e/layout.e2e.mjs` checks that every station (blenders, packs, cup stack, cup spots, ingredients,
machine slots, trash) lies fully on the stage below the pass, is ≥ 64 × 64 and overlaps no other station, and that
the layer names and the ingredients' name tags stay uncovered (and "NEU" badges are drawn on top, over the riser behind them
or beside their container, hiding no quality stars or layer badge) – in the fullest kitchen (4 seats, 2 blenders, 4 cups, 16 ingredients, 2 machine
slots, with and without WebGL, at 1280×800 and 1024×768) and in small ones (level 1, level 5, endless).

### 4.8 Visual language
- Fonts: **Lilita One** (display: logo, headings, numbers) + **Nunito** 600/800/900 (UI text), fallbacks
  `"Trebuchet MS", system-ui, sans-serif`. Loaded from Google Fonts.
- Gameplay: a modern café in a realistic, glossy illustration style (warm plaster wall with fluted oak, pendant
  lamps, menu boards) seen like Cooking Fever from behind the counter: a marble pass with an oak front, a terrazzo
  worktop in perspective with a rounded front edge and open shelves of stock below, the ingredients in real
  containers on oak risers (brushed stainless pans of fruit in neat rows, glass jars, a squeeze bottle, a coconut
  shell, a walnut bowl, a board – 3D, light from the top left like everything else), 3D appliances about twice as tall as a cup (a stand
  blender after a household model – fluted glass jug, tall stainless base with a black glass V display band and a big chrome dial –, white smoothie
  machine with an açaí-purple head, stainless freezer and pedal bin) – clean and modern rather than cluttered.
  Bubbles, HUD pills, toasts and cards in the café are light frosted panels with soft shadows. Menus keep the chunky
  cartoon UI (thick ink outline buttons and panels) around the same realistic food art.
- No dark-mode variant, but every colour is a CSS token on `:root` (game-only tokens on `.screen-game`)
  and `body` sets an explicit background.
- Tokens (base.css): `--acai #3b1556` (deep purple, letterbox/menus), `--acai-2 #6c2a8f`, `--pitaya #ff3d8b`,
  `--mango #ffb627`, `--leaf #2fbf71`, `--lagoon #18c2c9`, `--cream #fff4df`, `--ink #2a1236`,
  `--wood #c97d43`, `--wood-dark #8e4f22`, `--danger #ff4d4d`, `--ok #2fbf71`.
- Chunky buttons: rounded 18px, thick dark outline (3px `--ink`), bottom shadow 0 6px 0 that compresses on press.
- Feedback: pickup scale-up, drop squash, reject shake + red flash + reason toast, coin fly to HUD,
  "+12" floating numbers, blender vibration and vortex while blending (3D), overflow foam + drips + red glow, customer bob.
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
- GitHub Pages: every push to `main` runs `.github/workflows/pages.yml` (Pages source "GitHub Actions"): unit tests,
  then it publishes `index.html` + `css/` + `js/` (ES modules, no build step), `dist/acai-fever.html` and
  `tools/appliances-3d.html` at https://leesyashin.github.io/Acai/.
- `npm run build` → `dist/acai-fever.html` (single self-contained file, works from `file://`) and
  `dist/artifact.html` (same content without doctype/html/head/body wrapper, for publishing as a Claude artifact).
- `npm test` → `node --test "tests/**/*.test.mjs"` (`node --test tests/` also works through `tests/index.js`;
  Node 22 treats a bare directory argument as a module).
- `appliances.e2e.mjs` checks the 3D stations in a real browser (canvases drawn, model per upgrade, blending animates,
  bin lid and the freezer's cold air react to drags, the tap fills the cup, shop pictures, the ingredient containers'
  still pictures drawn again sharp for a new pixel ratio) and the SVG fallback without WebGL.
- `layout.e2e.mjs` checks the gameplay layout of §4.7 (stations on the stage, ≥ 64 px, no overlaps, layer names and name
  tags uncovered, badges visible).
- `npm run e2e` → every `tests/e2e/*.e2e.mjs` in sequence (Playwright, static server on :8090 by default,
  `E2E_PORT` overrides). `node tools/shots.mjs <dir>` writes review screenshots of every screen.
