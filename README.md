# Açaí Fever

Ein Zeitmanagement-Spiel im Stil von *Cooking Fever* für den Browser: Du arbeitest in einem modernen
Açaí-Café. Deine Gäste bestellen Bowls – serviert in durchsichtigen Plastikbechern, in denen man die
Schichten sieht – und später Smoothies; du stellst sie per **Drag & Drop** unter Zeitdruck zusammen. Gebaut für **Tablets im Querformat**, spielbar auch mit
Maus am PC, auf dem **MacBook im Browser** (Maus oder Trackpad) und (verkleinert) auf dem Handy. Deutsch und Englisch, Soundeffekte und Musik
werden synthetisch erzeugt – es gibt keine Bild- oder Audiodateien. Die Küchengeräte (Mixer, Smoothie-Maschine,
Mülleimer, Gefriertruhe) sind echte 3D-Modelle, die per WebGL im Browser gerendert und animiert werden; jedes
Upgrade bringt ein neues Modell.

Reines HTML/CSS/JavaScript (ES-Module), kein Framework, keine Laufzeit-Abhängigkeiten.
Die verbindliche Spezifikation steht in [`docs/DESIGN.md`](docs/DESIGN.md).

**Online spielen:** <https://leesyashin.github.io/Acai/> – jeder Push auf `main` veröffentlicht das Spiel dort
automatisch über GitHub Pages (`.github/workflows/pages.yml`, vorher laufen die Unit-Tests). Dort liegen auch die
Einzeldatei-Version (`acai-fever.html`) und die Vorschau aller 3D-Geräte (`tools/appliances-3d.html?anim=1`).

## So wird gespielt

**Steuerung:** Alles läuft über Ziehen und Loslassen – mit dem Finger oder der Maus. Gültige Ziele
leuchten auf, während du etwas ziehst. Lässt du an einer falschen Stelle los, fliegt das Teil zurück
und ein kurzer Hinweis erklärt, warum.

1. **Basis mixen:** Zieh eine gefrorene Packung (Açaí, später Pitaya oder Blaue Spirulina) aus der
   Gefriertruhe in einen leeren Mixer. Nach ein paar Sekunden ist die Basis fertig.
2. **Bowl hinstellen:** Zieh eine leere Bowl (einen durchsichtigen Becher) vom Stapel auf einen freien
   Platz. Ohne Becher geht nichts hinein – am besten stellst du ihn hin, während der Mixer noch läuft.
3. **Bowl füllen:** Zieh den fertigen Mixer auf die leere Bowl. Eine Mischung reicht für zwei Bowls
   (mit dem großen Mixkrug für drei).
4. **Belegen:** Zieh Früchte & Crunch und danach Toppings & Soßen aus den Schalen auf der Theke auf die Bowl.
5. **Servieren:** Zieh die fertige Bowl auf den Gast. Stimmt sie genau mit der Bestellung überein,
   wird bezahlt – plus Trinkgeld, je geduldiger der Gast noch war. Der Platz ist danach frei für den
   nächsten Becher.

**Die Schichten-Regel:** Eine Bowl wird immer in derselben Reihenfolge gebaut:
**Basis → Früchte & Crunch → Toppings & Soßen**. Innerhalb einer Schicht ist die Reihenfolge egal.
Eine Frucht auf einem Topping, ein Topping vor der ersten Frucht, eine Zutat ohne Basis, doppelte Zutaten oder mehr als sechs Zutaten
werden abgelehnt.

**Mixer läuft über:** Ab Level 3 wartet ein fertiger Mixer nicht ewig. Lässt du ihn zu lange stehen,
fängt er an überzulaufen (rot, wackelt) – dann schnell ausgießen! Danach ist die Basis verdorben und
der Mixer muss in den **Mülleimer** gezogen werden. Falsche Bowls (samt Becher) und Smoothies kommen ebenfalls in den Müll.

**Smoothies:** Ab Level 7 bestellen manche Gäste zusätzlich einen Smoothie. Zieh eine passende Frucht
(Banane, Erdbeere, Blaubeere, Mango, Kiwi) in die Smoothie-Maschine, warte kurz und zieh den fertigen
Becher auf den Gast.

**Herzen:** Jeder Gast hat eine Geduldsanzeige. Läuft sie ab, geht er ohne zu bezahlen und du verlierst
ein **Herz**. Bei 0 Herzen ist das Level verloren. Ab Level 12 (vier Plätze) hast du vier statt drei Herzen.

**Sterne:** Jedes der 20 Kampagnen-Level hat ein Zeitlimit und drei Geldziele. Erreichst du das erste Ziel,
ist das Level geschafft (1 Stern), für 2 und 3 Sterne brauchst du mehr. Bei Ladenschluss kommen keine
neuen Gäste mehr – wer schon wartet, wird noch bedient. Verdiente Münzen behältst du auch bei einer Niederlage.

**Laden:** Mit deinen Münzen kaufst du im Shop neue Zutaten (am Anfang hast du nur Açaí, Banane, Granola
und Honig – insgesamt gibt es 16), bessere Qualität (mehr Münzen pro Zutat), Küchen-Upgrades
(schnellerer Mixer, großer Mixkrug, zweiter Mixer, mehr Bowl-Plätze, Doppel-Smoothie) und Deko,
die Gäste geduldiger macht.

**Küchengeräte in 3D:** Jede Stufe des Turbo-Mixers ist ein neues Modell – vom weißen *Classic* mit Drehknopf über den
*Turbo* aus gebürstetem Edelstahl und den açaí-lila *Pro* mit LED-Ring bis zum schwarzen *Pro Max* mit Countdown-Display
und Lichtleiste. Der große Mixkrug ist sichtbar höher und breiter, die Smoothie-Maschine wächst vom kompakten Ein-Tank-
zum Edelstahl-Zwei-Tank-Gerät. Beim Mixen dreht sich ein Strudel im Krug und gefrorene Stücke zerfallen, beim Überlaufen
quillt Schaum unter dem Deckel hervor, in der Smoothie-Maschine wirbelt die Förderschnecke das Slush, dann öffnet der
Zapfhahn und der Becher füllt sich. Der Mülleimer öffnet den Deckel, wenn du etwas Wegwerfbares darüber hältst, und aus der
Gefriertruhe in der Theke (Glasschiebedeckel, Vorratspackungen auf der Stufe hinten) quillt Kaltluft, wenn du eine Packung
herausnimmst. Ohne WebGL zeigt das Spiel die gezeichneten Geräte.

**Endlos-Modus:** Nach Level 10 wird der Endlos-Modus freigeschaltet: kein Zeitlimit, alle 30 Sekunden
wird es schwerer (mehr Plätze, mehr Gäste, größere Bestellungen). Gespielt wird, bis alle Herzen weg sind
oder du im Pausenmenü die Schicht beendest – deine Münzen und dein Highscore werden gespeichert.

Fortschritt, Sprache und Ton-Einstellungen werden im Browser gespeichert (`localStorage`).

## Auf dem MacBook spielen

Einfach <https://leesyashin.github.io/Acai/> in Safari, Chrome, Firefox oder Edge öffnen – keine App, nichts zu
installieren (Safari ab Version 14.1). Das Spiel passt sich jeder Fenstergröße an und ist auf Retina-Displays scharf.

- **Ziehen mit dem Trackpad:** Trackpad herunterdrücken, gedrückt halten und dabei ziehen – oder mit drei Fingern
  ziehen, wenn das in den Systemeinstellungen (Bedienungshilfen → Zeigersteuerung) eingeschaltet ist. Eine Maus geht auch.
- **Größer spielen:** Vollbild mit **⌃⌘F** (oder dem grünen Knopf oben links im Fenster) – die Bühne wächst mit.
- **Kein versehentliches Zoomen oder Zurückblättern:** Pinch-Zoom, ⌘/Ctrl + Scrollen und das Wischen mit zwei Fingern
  sind im Spiel abgeschaltet, damit ein laufendes Level nicht aus Versehen verloren geht.
- Musik und Sounds starten nach dem ersten Klick (das verlangt der Browser).

## Lokal starten

Voraussetzung: [Node.js](https://nodejs.org) 22 oder neuer.

```bash
npm install          # nur für Build und Tests nötig (esbuild, Playwright)
npm start            # Entwicklungsserver ohne Cache → http://localhost:8080
```

ES-Module funktionieren nicht über `file://` – zum Entwickeln also immer `npm start` verwenden.
Zum Testen auf einem Tablet im selben WLAN: `node tools/serve.mjs 8080 . --host 0.0.0.0` und auf dem Tablet
`http://<IP-des-Rechners>:8080` öffnen.

Ohne Server spielen: `npm run build` ausführen und danach **`dist/acai-fever.html`** direkt im Browser
öffnen (Doppelklick) – diese eine Datei enthält das komplette Spiel.

## Befehle

| Befehl | Was passiert |
|---|---|
| `npm start` | Statischer Server (`tools/serve.mjs`) auf Port 8080, ohne Caching. Anderer Port: `node tools/serve.mjs 3000` |
| `npm test` | Unit-Tests mit `node --test` (Engine, Bestellungen, Daten, Speicherstand, Übersetzungen, Audio, Grafik, 3D-Geometrie und -Modelle, Balancing); `node --test tests/` geht auch |
| `npm run build` | Bündelt alles mit esbuild zu `dist/acai-fever.html` (eigenständig, läuft per `file://`) und `dist/artifact.html` (gleicher Inhalt ohne `<html>/<head>/<body>`-Hülle, zum Veröffentlichen als Claude-Artifact) |
| `npm run e2e` | Führt alle Playwright-Skripte `tests/e2e/*.e2e.mjs` nacheinander aus (Chromium, headless, Server auf Port 8090 bzw. `E2E_PORT`). Filter: `npm run e2e -- playthrough` |

`tools/build.mjs` versteht außerdem `--entry <datei>`, `--outdir <ordner>` und `--root <ordner>`.
E2E-Skripte legen Screenshots in `$E2E_OUT_DIR` ab (Standard: Temp-Ordner), nie im Repository.
`playthrough.e2e.mjs` spielt Level 1 komplett mit echten Maus-Drags durch (inkl. Tutorial, Shop-Kauf, Level 2),
dann mit Touch auf 1024×768, testet den Endlos-Modus und die englische Oberfläche, prüft, dass ein
Zwei-Finger-Pinch im Rand um die Bühne die Seite nicht zoomt, spielt in einem MacBook-Fenster (1470×832, Retina) mit
der Maus und prüft dort, dass Trackpad-Pinch, ⌘/Ctrl + Scrollen und Zwei-Finger-Wischen weder zoomen noch zurückblättern,
und dass zwei offene Tabs sich den Spielstand
nicht gegenseitig überschreiben. `appliances.e2e.mjs` prüft die 3D-Geräte (Modelle je Upgrade, Animationen, Deckel,
Kaltluft der Truhe, Zapfhahn, Shop-Bilder) und die gezeichneten Geräte ohne WebGL. `build.e2e.mjs` baut das
Spiel und startet es per `file://`. Alle 3D-Geräte in allen Zuständen zeigt `tools/appliances-3d.html`
(`npm start`, dann `http://localhost:8080/tools/appliances-3d.html?anim=1`). Für eine Sichtprüfung erzeugt `node tools/shots.mjs <ordner>` Screenshots
aller Bildschirme in mehreren Größen.

## Projektstruktur

```
index.html            Seite: lädt css/*.css und js/main.js (type=module)
css/base.css          Farb-Tokens, Schriften, Buttons, Panels, Stage-Skalierung
css/screens.css       Titel, Karte, Shop, Einstellungen, Level-Start, Ergebnis
css/game.css          Spielbildschirm (HUD, Gäste, Stationen, Zutaten, Drag-Ghost, Tutorial)
js/main.js            Start, Speicherstand laden, Sprache, Bildschirm-Router
js/stage.js           feste 1280×800-Bühne, skaliert auf den Bildschirm
js/i18n.js            Übersetzungen (Deutsch/Englisch)
js/data.js            Zutaten, Level, Upgrades, Küchenwerte, Endlos-Schwierigkeit
js/save.js            Speicherstand + Shop-/Fortschritts-Aktionen
js/rng.js             Zufallszahlen mit Seed
js/orders.js          Bestellungen und Preise
js/engine.js          Spiel-Simulation ohne DOM
js/drag.js            Drag & Drop für Touch und Maus
js/svg.js             gemeinsame SVG-Helfer + Farbverläufe (eine versteckte <svg> pro Seite)
js/art-food.js        Becher mit Schichten, Zutaten, Zutaten-Schalen, Packungen, Smoothies
js/art-kitchen.js     Theke in Perspektive (Arbeitsplatte, Regal), Gefriertruhe, Tabletts, Café-Rückwand, Deko;
                      Mixer, Smoothie-Maschine, Mülleimer als Ersatz ohne WebGL
js/art.js             Gäste, HUD-Symbole, Logo, Karte; reicht alle Grafiken weiter
js/geo3d.js           3D-Mathematik, Geometrie (Drehkörper, abgerundete Boxen, Rohre, Flüssigkeitsoberflächen), Materialien
js/kitchen3d.js       3D-Modelle der Küchengeräte mit allen Ausbaustufen und Animationen
js/gl3d.js            WebGL-Renderer (Studiolicht, Edelstahl, Glas, Muster) – ohne Bibliothek
js/art3d.js           3D-Ansichten der Stationen im Spiel und 3D-Bilder für Shop und Menüs
js/audio.js           Soundeffekte und Musik (WebAudio)
js/game-view.js       Spielbildschirm
js/screens.js         Menüs: Titel, Karte, Shop, Einstellungen, Ergebnis
tools/serve.mjs       Entwicklungsserver (ohne Abhängigkeiten)
tools/build.mjs       esbuild-Build → dist/
tools/run-e2e.mjs     startet die E2E-Skripte nacheinander
tools/shots.mjs       Screenshots aller Bildschirme zur Sichtprüfung
tools/*.html          Vorschauseiten für Grafiken, 3D-Geräte (appliances-3d.html), Sound und Drag & Drop
tests/*.test.mjs      Unit-Tests (node --test)
tests/e2e/            Playwright-Skripte + gemeinsame Helfer (helpers.mjs)
docs/DESIGN.md        Spieldesign, Regeln, Modul-Verträge, Layout
```

---

## English

**Açaí Fever** is a Cooking-Fever-style time-management game for the browser. You run an açaí bar:
customers order bowls (and smoothies from level 7), and you build them by **drag & drop** before their
patience runs out. Made for landscape tablets, also playable with a mouse, on a MacBook in the browser (Safari, Chrome, Firefox, Edge – mouse or
trackpad, nothing to install; trackpad pinches and two-finger swipes never zoom or navigate away) and on phones. German and English UI. Play online:
<https://leesyashin.github.io/Acai/> (every push to `main` deploys there).
The kitchen appliances are real-time 3D models (WebGL, no library) with animations – a vortex in the blender jug,
churning slush and a pouring tap in the smoothie machine, a pedal bin lid and cold air from the chest freezer – and every kitchen upgrade
brings a new model (blender: Classic → Turbo → Pro → Pro Max, big jug; one-tank → two-tank smoothie machine).

**How to play:** drag a frozen pack into the blender, put an empty bowl (a clear cup) from the stack on a
free spot, drag the ready blender onto it, add *Fruits & Crunch*, then *Toppings & Sauces* (fixed layer order –
wrong drops bounce back), and drag the finished bowl onto the customer. From level 3 a ready blender **overflows** if you leave it too long and has to
go into the trash. Smoothies: drag a fruit into the smoothie machine, then the cup onto the customer.
A customer who runs out of patience leaves and costs you a **heart** – 0 hearts loses the level.
20 campaign levels with 1–3 **stars** (money goals); coins are kept even when you lose and buy new ingredients
(4 at start, 16 total), quality, kitchen upgrades and decor in the **shop**. **Endless mode** unlocks after
level 10 and gets harder every 30 seconds; end the shift from the pause menu at any time – coins and your best
score are saved.

**Run locally** (Node.js 22+):

```bash
npm install        # dev tools only (esbuild, Playwright)
npm start          # http://localhost:8080 (no-cache static server)
npm test           # unit tests (node --test)
npm run build      # dist/acai-fever.html (single file, works via file://) + dist/artifact.html
npm run e2e        # Playwright scripts in tests/e2e/*.e2e.mjs, one after another (server on :8090)
node tools/shots.mjs <dir>   # review screenshots of every screen
```

Or build once and open `dist/acai-fever.html` directly. The full spec lives in [`docs/DESIGN.md`](docs/DESIGN.md).
