# Açaí Fever

Ein Zeitmanagement-Spiel im Stil von *Cooking Fever* für den Browser: Du führst eine kleine
Açaí-Bar. Deine Gäste bestellen Bowls (und später Smoothies), du stellst sie per
**Drag & Drop** unter Zeitdruck zusammen. Gebaut für **Tablets im Querformat**, spielbar auch mit
Maus am PC und (verkleinert) auf dem Handy. Deutsch und Englisch, Soundeffekte und Musik
werden synthetisch erzeugt – es gibt keine Bild- oder Audiodateien.

Reines HTML/CSS/JavaScript (ES-Module), kein Framework, keine Laufzeit-Abhängigkeiten.
Die verbindliche Spezifikation steht in [`docs/DESIGN.md`](docs/DESIGN.md).

## So wird gespielt

**Steuerung:** Alles läuft über Ziehen und Loslassen – mit dem Finger oder der Maus. Gültige Ziele
leuchten auf, während du etwas ziehst. Lässt du an einer falschen Stelle los, fliegt das Teil zurück
und ein kurzer Hinweis erklärt, warum.

1. **Basis mixen:** Zieh eine gefrorene Packung (Açaí, später Pitaya oder Blaue Spirulina) in einen
   leeren Mixer. Nach ein paar Sekunden ist die Basis fertig.
2. **Bowl füllen:** Zieh den fertigen Mixer auf eine leere Bowl. Eine Mischung reicht für zwei Bowls
   (mit dem großen Mixkrug für drei).
3. **Belegen:** Zieh Früchte & Crunch und danach Toppings & Soßen auf die Bowl.
4. **Servieren:** Zieh die fertige Bowl auf den Gast. Stimmt sie genau mit der Bestellung überein,
   wird bezahlt – plus Trinkgeld, je geduldiger der Gast noch war.

**Die Schichten-Regel:** Eine Bowl wird immer in derselben Reihenfolge gebaut:
**Basis → Früchte & Crunch → Toppings & Soßen**. Innerhalb einer Schicht ist die Reihenfolge egal.
Eine Frucht auf einem Topping, ein Topping vor der ersten Frucht, eine Zutat ohne Basis, doppelte Zutaten oder mehr als sechs Zutaten
werden abgelehnt.

**Mixer läuft über:** Ab Level 3 wartet ein fertiger Mixer nicht ewig. Lässt du ihn zu lange stehen,
fängt er an überzulaufen (rot, wackelt) – dann schnell ausgießen! Danach ist die Basis verdorben und
der Mixer muss in den **Mülleimer** gezogen werden. Falsche Bowls und Becher kommen ebenfalls in den Müll.

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

**Endlos-Modus:** Nach Level 10 wird der Endlos-Modus freigeschaltet: kein Zeitlimit, alle 30 Sekunden
wird es schwerer (mehr Plätze, mehr Gäste, größere Bestellungen). Gespielt wird, bis alle Herzen weg sind
oder du im Pausenmenü die Schicht beendest – deine Münzen und dein Highscore werden gespeichert.

Fortschritt, Sprache und Ton-Einstellungen werden im Browser gespeichert (`localStorage`).

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
| `npm test` | Unit-Tests mit `node --test` (Engine, Bestellungen, Daten, Speicherstand, Übersetzungen, Audio, Grafik, Balancing); `node --test tests/` geht auch |
| `npm run build` | Bündelt alles mit esbuild zu `dist/acai-fever.html` (eigenständig, läuft per `file://`) und `dist/artifact.html` (gleicher Inhalt ohne `<html>/<head>/<body>`-Hülle, zum Veröffentlichen als Claude-Artifact) |
| `npm run e2e` | Führt alle Playwright-Skripte `tests/e2e/*.e2e.mjs` nacheinander aus (Chromium, headless, Server auf Port 8090 bzw. `E2E_PORT`). Filter: `npm run e2e -- playthrough` |

`tools/build.mjs` versteht außerdem `--entry <datei>`, `--outdir <ordner>` und `--root <ordner>`.
E2E-Skripte legen Screenshots in `$E2E_OUT_DIR` ab (Standard: Temp-Ordner), nie im Repository.
`playthrough.e2e.mjs` spielt Level 1 komplett mit echten Maus-Drags durch (inkl. Tutorial, Shop-Kauf, Level 2),
dann mit Touch auf 1024×768, testet den Endlos-Modus und die englische Oberfläche, prüft, dass ein
Zwei-Finger-Pinch im Rand um die Bühne die Seite nicht zoomt, und dass zwei offene Tabs sich den Spielstand
nicht gegenseitig überschreiben. `build.e2e.mjs` baut das
Spiel und startet es per `file://`. Für eine Sichtprüfung erzeugt `node tools/shots.mjs <ordner>` Screenshots
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
js/art.js             alle Cartoon-Grafiken als SVG
js/audio.js           Soundeffekte und Musik (WebAudio)
js/game-view.js       Spielbildschirm
js/screens.js         Menüs: Titel, Karte, Shop, Einstellungen, Ergebnis
tools/serve.mjs       Entwicklungsserver (ohne Abhängigkeiten)
tools/build.mjs       esbuild-Build → dist/
tools/run-e2e.mjs     startet die E2E-Skripte nacheinander
tools/shots.mjs       Screenshots aller Bildschirme zur Sichtprüfung
tools/*.html          Vorschauseiten für Grafiken, Sound und Drag & Drop
tests/*.test.mjs      Unit-Tests (node --test)
tests/e2e/            Playwright-Skripte + gemeinsame Helfer (helpers.mjs)
docs/DESIGN.md        Spieldesign, Regeln, Modul-Verträge, Layout
```

---

## English

**Açaí Fever** is a Cooking-Fever-style time-management game for the browser. You run an açaí bar:
customers order bowls (and smoothies from level 7), and you build them by **drag & drop** before their
patience runs out. Made for landscape tablets, also playable with a mouse and on phones. German and English UI.

**How to play:** drag a frozen pack into the blender, drag the ready blender onto a bowl, add
*Fruits & Crunch*, then *Toppings & Sauces* (fixed layer order – wrong drops bounce back), and drag the
finished bowl onto the customer. From level 3 a ready blender **overflows** if you leave it too long and has to
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
