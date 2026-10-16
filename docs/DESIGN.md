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
| 2 | Style | **Bright cartoon**, round shapes, strong colours (Cooking Fever feel). |
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

---

## 2. Core loop

1. A customer walks to a free seat at the counter and shows an **order bubble**:
   one bowl (base + 1–3 fruits/crunch + 0–3 toppings) and, from level 7, sometimes a smoothie.
2. Player drags a **frozen base pack** (Açaí / Pitaya / Spirulina) into an **empty blender**.
   The blender blends for `blendTime` seconds, then is **ready** with `portions` portions.
3. Player drags the **ready blender** onto an **empty bowl** → bowl gets the base (1 portion used).
4. Player drags **fruit/crunch** bins onto the bowl (layer 2), then **toppings/sauces** (layer 3).
   - Adding anything before the base → rejected (`needBase`).
   - Adding a fruit after a topping is on → rejected (`toppingsOnTop`).
   - Same ingredient twice → rejected (`alreadyAdded`).
   - More than 6 items on top of the base → rejected (`bowlFull`).
5. Player drags the **finished bowl** onto the **customer**. If it matches the order
   exactly (same base, same set of layer‑2 items, same set of layer‑3 items) it is accepted,
   otherwise rejected (`wrongOrder`) and the bowl flies back.
6. Smoothies: drag a smoothie-capable **fruit bin onto an empty smoothie-machine slot** →
   it mixes for `smoothieTime` seconds → a **ready cup** → drag cup onto the customer.
7. When all parts of a customer's order are delivered they **pay** (order value + tip based
   on remaining patience) and leave happily. Coins fly to the HUD.
8. Wrong/unneeded bowls or cups can be dragged into the **trash**. A **spoiled blender** must be
   dragged to the trash to empty it (also allowed for a ready blender to discard it).

### Blender lifecycle
`empty → blending (blendTime) → ready (readyHold) → overflowing (overflowTime) → ruined`
- `ready` and `overflowing` can both be poured into bowls. `overflowing` shakes red and warns.
- `ruined` cannot be used; drag it to the trash → `empty`.
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
- **Hearts 0** at any time → immediate `lost`.
- **Endless:** no time limit; every 30 s the stage increases (`endlessConfig(stage)` – more seats, faster
  spawns, less patience, bigger orders). Ends when hearts hit 0. Score = coins earned; best score is saved.
  Endless is unlocked after winning campaign level 10.

### Tutorial & intros
- Level 1 (`intro: 'basics'`) runs a step-by-step tutorial with an arrow + speech text. While the tutorial
  runs, `game.tutorialHold = true`: the first customer's patience does not drain and no further customers
  spawn. Steps: (1) drag açaí pack into blender, (2) wait while it blends, (3) drag blender onto a bowl,
  (4) drag the ordered ingredient(s) onto the bowl, (5) drag the bowl to the customer, (6) "Great! Watch the
  patience of your customers" → hold released.
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

Upgrades (`UPGRADES` in data.js): `blenderSpeed` (3 levels), `jug` (portions 2→3), `blender2` (2nd blender),
`bowlSlots` (2→3→4), `smoothieSlots` (1→2, needs level 7 reached), decor: `plants`, `jukebox`, `seating`,
`neon` (each adds patience %, and appears visibly in the shop scene). Ingredient quality: each owned
ingredient has 2 quality upgrades (value ×1.3, ×1.6).

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
js/art.js             all cartoon SVG art as strings (ingredients, packs, bowls, customers, blender, …)
js/audio.js           WebAudio synthesized SFX + music loops (no audio files)
js/game-view.js       gameplay screen: DOM from engine state, drag wiring, HUD, pause, tutorial, FX
js/screens.js         menu screens: title, map, shop, settings, pre-level modal, results
tools/build.mjs       esbuild bundle → dist/acai-fever.html (standalone) + dist/artifact.html
tests/*.test.mjs      node --test unit tests (engine, orders, save helpers, balance simulation)
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
`toStage(clientX, clientY)` converts pointer coordinates. In portrait on narrow screens `#rotate-hint`
shows "Please rotate your device" with a "Play anyway" button.

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
pourBlender(game, blenderIdx, bowlIdx)        → { ok, reason? }
addIngredient(game, bowlIdx, ingId)           → { ok, reason? }
trashBowl(game, bowlIdx)                      → { ok }
cleanBlender(game, blenderIdx)                → { ok, reason? }   // ruined/ready/overflowing → empty
loadSmoothie(game, slotIdx, fruitId)          → { ok, reason? }
trashSmoothie(game, slotIdx)                  → { ok }
serveBowl(game, bowlIdx, customerId)          → { ok, reason? }
serveSmoothie(game, slotIdx, customerId)      → { ok, reason? }
setPaused(game, bool)
releaseTutorialHold(game)
drainEvents(game) → Event[]                   // returns and clears queued events
bowlMatchesOrder(bowl, orderBowl) → boolean
```

Reasons (i18n key `reason.<code>` in game-view): `needBase`, `toppingsOnTop`, `alreadyAdded`, `bowlFull`,
`blenderBusy`, `blenderNotReady`, `blenderRuined`, `bowlHasBase`, `notOwned`, `wrongLayer`, `wrongOrder`,
`noSmoothieWanted`, `noBowlWanted`, `alreadyDelivered`, `slotBusy`, `notReady`, `notSmoothieFruit`, `emptyBowl`,
plus `noCustomer` (customer gone or leaving), `notPlaying` (paused / game over) and `invalid` (bad index,
no smoothie machine). `loadBlender` checks `wrongLayer` → `notOwned` → `blenderBusy`; `cleanBlender` returns
`blenderBusy` while blending and `blenderNotReady` when empty (a blending blender cannot be thrown away).

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
  bowls:    [ { base: id|null, mid: id[], top: id[], uid } ],     // length = kitchen.bowlSlots
  smoothie: null | { slots: [ { state: 'empty'|'mixing'|'ready', fruit, t, duration } ] },
  owned, ingLevels, kitchen, events: [],
  result: null|'won'|'lost', stars, endReason: null|'goal'|'hearts', featured   // set at game over
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
`blenderOverflow{idx}`, `blenderRuined{idx}`, `blenderEmpty{idx}`, `basePoured{bowlIdx, blenderIdx}`,
`ingredientAdded{bowlIdx, id}`, `smoothieStart{idx}`, `smoothieReady{idx}`, `trash{what}`,
`closingTime`, `stageUp{stage}` (endless), `gameOver{result: 'won'|'lost', stars, reason: 'hearts'|'goal'|null}`.
`trash` events always carry `idx` (`trash{what:'bowl'|'blender'|'smoothie', idx}`); `cleanBlender` emits
`blenderEmpty` then `trash`. `gameOver.reason` is `null` when won, `'goal'` when lost on goal 1, `'hearts'` when
hearts ran out (endless always ends `lost`/`'hearts'`). Once the first customer has arrived, `game.time` stops
while `tutorialHold` is on, so the tutorial does not eat level time (blenders keep running).
`customer.look` is `{seed}` – the view builds the look with `lookFromSeed(seed)` from art.js.

### 4.3 Drag & drop (`js/drag.js`) – contract
```js
const dnd = createDragManager({ root /* #stage element */, toStage, ghostLayer /* element inside stage */,
                                 onPickup?(payload), onDrop?(result), onCancel?(result) })
dnd.source(el, { payload: () => obj|null, ghost: (payload) => HTMLElement|markup, onStart?, onEnd?, onTap? }) → unregister
dnd.target(el, { accepts: (payload) => boolean, drop: (payload) => {ok, reason?} }) → unregister
dnd.cancel(); dnd.destroy(); dnd.isDragging()
// result = { ok, reason, payload, targetEl, tap, cancelled, pointerType }
```
- A release that moved ≤ 6 CSS px within 300 ms is a **tap** (`onTap`, then `onEnd`/`onDrop` with `tap: true`).
  Order on release: source `onEnd(result)` → manager `onDrop(result)`; on cancel `onEnd({cancelled})` → `onCancel`.
- The hit-test point is the **ghost centre** (40 stage px above the finger for touch), not the pointer.
- Classes: root `is-dragging`, source `drag-source`, targets `drop-ok` / `drop-hover`, ghost `.drag-ghost` >
  `.drag-ghost-body`; registered elements get `data-dnd-source` / `data-dnd-target`.
- Pointer Events + `setPointerCapture`; works for touch, pen, mouse. One active drag at a time (ignore other pointers).
- Ghost follows the pointer in stage coordinates (centered under finger, slightly above on touch so it is visible).
- While dragging, every registered target whose `accepts(payload)` is true gets class `drop-ok`; the target under the
  pointer gets `drop-hover`. Hit test: target rect expanded by 18 stage px; nearest center wins when overlapping.
- Drop on a target → `drop(payload)`. If `{ok:false}` or no target: ghost animates back to its source and
  `onEnd({ok:false, reason})` fires; the view shows the reason. Drop on nothing = silent return.
- Must prevent page scroll/zoom/text selection/long-press callout during drags (`touch-action:none`,
  `user-select:none`, `-webkit-touch-callout:none`, `preventDefault` on pointerdown for sources).
- `pointercancel`, window `blur` and `visibilitychange` cancel the drag cleanly.

### 4.4 Art (`js/art.js`) – contract (all return SVG markup strings)
```js
ingredientIcon(id, size = 64)        // bin / order / shop icon for any of the 16 ingredients
packIcon(baseId, size = 72)          // frozen pack for base bins (açaí / pitaya / spirulina)
bowlSVG(bowl, size = 150)            // bowl {base, mid[], top[]}; empty bowl when base null; deterministic layout
cupSVG(fruitId|null, state, size=70) // smoothie cup: state 'empty'|'mixing'|'ready'
customerSVG(look, mood, size = 160)  // mood: 'happy'|'neutral'|'impatient'|'angry'
randomLook(rng)                       // → look object (skin, hair colour/style, shirt, accessory) – diverse
blenderSVG({state, base, progress, portions, maxPortions, badge?}, size = 150)  // badge:false hides the status badge
smoothieMachineSVG(slotCount, size)   // machine body without cups (cups drawn separately)
trashSVG(size), coinSVG(size), heartSVG(filled, size), starSVG(filled, size)
decorSVG(id, size)                    // 'plants' | 'jukebox' | 'seating' | 'neon'
shopSceneSVG(width, height)           // back wall / window / sign for the gameplay scene
logoSVG(width)                        // "Açaí Fever" logo with bowl
```
Colours of ingredients come from `INGREDIENTS[i].color` so icons, bowls and UI stay consistent.

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
plop, coin, bell, angry, happy, trash, purchase, star, win, lose, closing, heart, tick`.

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
y  64–330  shop scene: back wall, window, sign, decor; customers stand behind the counter at seat centers
           seat x-centers: 2 → [420, 860]; 3 → [270, 640, 1010]; 4 → [200, 493, 787, 1080]
           order bubble above/next to each customer; patience ring/bar on the bubble
y 300–350  counter top (front edge overlaps customers' bodies)
y 350–800  work area
  x  16–300  blenders (1–2) + base pack bins (owned bases only)
  x 316–964  bowl slots (2–4) y≈370–550 with small content chips under each bowl;
             ingredient shelf: row "Fruits & Crunch" y≈565–675, row "Toppings & Sauces" y≈685–790
             (owned ingredients only, 84–88 px bins with icon + short name)
  x 980–1264 smoothie machine (when present, slots = kitchen.smoothieSlots) + trash can bottom-right
```
Interaction targets must be ≥ 64 stage px (tablet fingers). Valid drop targets glow while dragging.

### 4.8 Visual language
- Fonts: **Lilita One** (display: logo, headings, numbers) + **Nunito** 600/800/900 (UI text), fallbacks
  `"Trebuchet MS", system-ui, sans-serif`. Loaded from Google Fonts.
- Single deliberate cartoon look (no dark-mode variant), but every colour is a CSS token on `:root`
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

### 4.10 Build & hosting
- Dev: `npm start` (static server on :8080) – ES modules need http(s), not `file://`.
- `npm run build` → `dist/acai-fever.html` (single self-contained file, works from `file://`) and
  `dist/artifact.html` (same content without doctype/html/head/body wrapper, for publishing as a Claude artifact).
- `npm test` → `node --test "tests/**/*.test.mjs"` (`node --test tests/` also works through `tests/index.js`;
  Node 22 treats a bare directory argument as a module).
- `npm run e2e` → every `tests/e2e/*.e2e.mjs` in sequence (Playwright, static server on :8090 by default,
  `E2E_PORT` overrides). `node tools/shots.mjs <dir>` writes review screenshots of every screen.
