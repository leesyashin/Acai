# Açaí Fever

Ein Zeitmanagement-Spiel im Stil von *Cooking Fever* für den Browser: Du arbeitest in einem modernen
Açaí-Café. Deine Gäste bestellen Bowls – serviert in durchsichtigen Plastikbechern, in denen man die
Schichten sieht – und später Frucht-Matcha; du stellst sie per **Drag & Drop** unter Zeitdruck zusammen. Gebaut für **Tablets im Querformat**, spielbar auch mit
Maus am PC, auf dem **MacBook im Browser** (Maus oder Trackpad) und auf dem **Handy im Querformat** – und lässt sich dort **wie eine App
installieren** (Vollbild, eigenes Icon, offline spielbar). Deutsch und Englisch, Soundeffekte und Musik
werden synthetisch erzeugt – es gibt keine Audiodateien, und die einzigen Bilddateien sind die App-Icons, die aus dem Code gezeichnet werden. Die Küchengeräte (Mixer, Matcha-Maschine,
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
   Gefriertruhe in einen leeren Mixer und **schalte ihn ein**: Tipp auf den runden Knopf auf dem Drehregler (er
   leuchtet grün, solange der Motor läuft). Nach ein paar Sekunden ist die Basis fertig. Ausgeschaltet bleibt der
   Mixer stehen – auch mitten im Mixen, er macht beim nächsten Einschalten dort weiter.
2. **Bowl hinstellen:** Zieh eine leere Bowl (einen durchsichtigen Becher) aus dem Becherspender auf einen
   freien Platz – die Becher stecken kopfüber in der Theke. Ohne Becher geht nichts hinein – am besten
   stellst du ihn hin, während der Mixer noch läuft. Mit dem **Auto-Cup-Refill** aus dem Shop passiert das von
   selbst: Unter dem Platz sitzt ein Lift, der einen leeren Becher aus einer Stahlklappe in der Arbeitsplatte nach
   oben schiebt, sobald der Platz leer ist – nach gut einer Sekunde, nicht sofort. Den Lift kaufst du für jeden
   Bowl-Platz einzeln; alle Lifte arbeiten gleichzeitig.
3. **Bowl füllen:** Zieh den Mixkrug vom fertigen Mixer auf die leere Bowl – der Sockel bleibt stehen, der Krug kehrt nach dem
   Ausgießen auf ihn zurück. Eine Mischung reicht für zwei Bowls
   (mit dem großen Mixkrug für drei).
4. **Belegen:** Zieh Früchte & Crunch und danach Toppings & Soßen aus ihren Behältern auf der Arbeitsplatte auf die Bowl.
5. **Servieren:** Zieh die fertige Bowl auf den Gast. Stimmt sie genau mit der Bestellung überein,
   wird bezahlt – plus Trinkgeld, je geduldiger der Gast noch war. Der Platz ist danach frei für den
   nächsten Becher.

**Die Schichten-Regel:** Eine Bowl wird immer in derselben Reihenfolge gebaut:
**Basis → Früchte & Crunch → Toppings & Soßen**. Innerhalb einer Schicht ist die Reihenfolge egal.
Eine Frucht auf einem Topping, ein Topping vor der ersten Frucht, eine Zutat ohne Basis, doppelte Zutaten oder mehr als sechs Zutaten
werden abgelehnt.

**Mixer läuft über:** Ab Level 6 wartet ein fertiger Mixer nicht ewig. Läuft sein Motor weiter, fängt er bald an
überzulaufen (rot, wackelt) – dann schnell ausgießen oder ausschalten! **Ausgeschaltet kann er nicht überlaufen**, dafür
schmilzt die Basis nach einer Weile (der Balken unter dem Mixer läuft eisblau ab). Mit dem Upgrade **Freeze-Mixer**
(für jeden Mixer einzeln, erkennbar an der Schneeflocke) bleibt die Basis im ausgeschalteten Mixer frisch, so lange du
willst. Verdorbenes muss in den **Mülleimer** gezogen werden. Falsche Bowls (samt Becher), eine Packung im falschen
Mixer und Matcha kommen ebenfalls in den Müll.

**Frucht-Matcha:** Ab Level 11 bestellen manche Gäste zusätzlich – oder nur – einen Eis-Matcha-Latte auf Fruchtpüree.
Der Matcha hat seine eigenen Zutaten in der **Matcha-Bar** unter der Maschine: hinten die Früchte (geschnittene
Banane und Erdbeeren, später Mango und Blaubeeren), davor die Extras (**Eiswürfel** ab Level 14, **Vanillesirup**
ab Level 20, **Cold Foam** ab Level 30). Zieh die bestellte Frucht auf das leere Glas in der Maschine: Die Stücke
liegen im Glas, die Maschine püriert sie, während die Teemühle mahlt, dann gießt die Düse Milch und Matcha darüber.
Extras kommen aufs Glas, sobald die Frucht drin ist – auch während die Maschine noch arbeitet. Ist der Matcha fertig
und hat er alle bestellten Extras, zieh das Glas auf den Gast.

**Bestellblase:** Über jedem Gast steht, was er möchte. Links die Bowl: der Becher mit der Basis (1), daneben die
Reihe Früchte & Crunch (2) und darunter Toppings & Soßen (3) – große Symbole auf Kreisen in der Farbe ihrer Schicht, wie
die Zahlen an den Behältern. Rechts, hinter einem Trennstrich, der Matcha mit seiner Frucht und darunter seine
Extras. Unten zeigt ein dicker
Balken die Geduld (grün → gelb → orange → rot). Was du schon übergeben hast, wird grün hinterlegt und groß abgehakt. Die
Chips unter jedem Becher zeigen in derselben Sprache, was schon drin ist.

**Herzen:** Jeder Gast hat eine Geduldsanzeige. Läuft sie ab, geht er ohne zu bezahlen und du verlierst
ein **Herz**. Bei 0 Herzen ist das Level verloren. Ab Level 40 (vier Plätze) hast du vier statt drei Herzen.

**Gäste und große Bestellungen:** Je mehr Handgriffe eine Bestellung braucht, desto länger lässt sich der
nächste Gast Zeit und desto geduldiger ist der Gast selbst. **Ab Level 10 warten immer zwei Gäste gleichzeitig:**
Sobald weniger warten, kommt nach ein paar Sekunden der nächste – schnelle Spieler bedienen also mehr Gäste. Ab Level 10
bestellen manche Gäste dieselbe Bowl zwei-, ab Level 30 auch dreimal (ein orangefarbenes „2×“ am Becher in der
Sprechblase zählt herunter, während du sie bringst); jede Bowl bringt Geduld zurück, bezahlt wird, wenn alles da ist.

**Sterne:** Jedes der 60 Kampagnen-Level hat ein Zeitlimit und drei Geldziele. Erreichst du das erste Ziel,
ist das Level geschafft (1 Stern), für 2 und 3 Sterne brauchst du mehr. Bei Ladenschluss kommen keine
neuen Gäste mehr – wer schon wartet, wird noch bedient. Verdiente Münzen behältst du auch bei einer Niederlage.

**Neue Zutaten kommen mit den Leveln:** Am Anfang gibt es Açaí, Banane, Granola und Honig; die anderen
Zutaten – insgesamt 16 für die Bowls und 7 für die Matcha-Bar – kommen nach und nach dazu, höchstens eine pro
Level. Die Level-Karte zeigt vor dem Start, was neu ist, und im Level trägt die neue Zutat ein „NEU“-Schild und wird
öfter bestellt.

**Laden:** Mit deinen Münzen kaufst du im Shop bessere Qualität (mehr Münzen pro Zutat, für jede Zutat, die schon da
ist), Küchen-Upgrades (schnellerer Mixer, großer Mixkrug, zweiter Mixer, mehr Bowl-Plätze, Auto-Cup-Refill pro
Platz, Freeze-Mixer pro Mixer, Doppel-Matcha) und Deko, die Gäste geduldiger macht. Den Lift für den dritten und
vierten Platz gibt es erst, wenn du den Platz hast, Freeze für den zweiten Mixer erst mit dem zweiten Mixer. Wer
schon mit einer älteren Version gespielt und Zutaten oder den früheren Greifarm gekauft hat, bekommt die Münzen dafür
zurück.

**Küchengeräte in 3D:** Mixer und Matcha-Maschine stehen hinten auf der Arbeitsplatte vor der Theke und sind etwa
doppelt so hoch wie ein Becher. Der Mixer ist einem echten Standmixer nachempfunden: gerippter Glaskrug mit Skala, klarem
Griff rechts und Ausgießer links, schwarzer Deckel mit Messbecher, darunter ein hoher Motorsockel mit schwarzem Glasband,
das vorn in ein V mit Display ausläuft, und großem Start/Stopp-Drehknopf. Jede Stufe des Turbo-Mixers ist ein neues Modell
in dieser Form – vom weißen *Classic* mit einfachem Drehknopf und Lämpchen über den *Turbo* aus gebürstetem Edelstahl mit
Countdown-Display und Chromring und den açaí-lila *Pro* mit LED-Ring bis zum graphitschwarzen *Pro Max* mit großem Display,
Chromzierleiste und Lichtleiste. Der große Mixkrug ist sichtbar höher und breiter. Die Matcha-Maschine ist einer echten
Tee-Latte-Maschine nachempfunden: olivgrünes Gehäuse mit schwarzer Front, links ein rauchglasfarbener Wassertank über einem
olivgrünen Ring mit Knopf und der Düse, unten die Abtropfschale mit Gitter, rechts in einer Nische die gläserne Teemühle
mit grünem Matchapulver; mit dem Upgrade „Doppel-Matcha“ wird sie zur breiteren Zwei-Platz-Maschine mit Temperaturanzeige.
Beim Mixen dreht sich ein Strudel im Krug und gefrorene Stücke zerfallen, beim Überlaufen quillt Schaum unter dem Deckel
hervor; in der Matcha-Maschine dreht sich das Mahlwerk und wirbelt grünen Staub auf, im Tank steigen Bläschen und Dampf,
dann gießt die Düse Milch und Matcha ins Glas. Der Mülleimer öffnet den Deckel, wenn du etwas Wegwerfbares darüber hältst, und aus der
Gefriertruhe in der Arbeitsplatte (Glasschiebedeckel, Vorratspackungen auf der Stufe hinten) quillt Kaltluft, wenn du eine Packung
herausnimmst. Ohne WebGL zeigt das Spiel die gezeichneten Geräte.

**Zutaten in echten Behältern:** Die Zutaten stehen auf Eichen-Podesten in ihren eigenen Behältern: Obst in gebürsteten
Edelstahl-Schalen (ordentlich in Reihen), Granola im großen Bügelglas mit zurückgeklapptem Deckel, Honig mit Honiglöffel
(der Deckel liegt daneben), Chia im Weckglas mit Messlöffel, Erdnussbutter mit Löffel und rotem Deckel daneben,
Schokosoße in der Quetschflasche, Kokosraspeln in der halben Kokosnuss, Kakao-Nibs in einer Nussholz-Schale und
frische Minze auf einem Brettchen – in glaubwürdigen Größen neben den Bechern. Behälter, Glas, Stahl und Holz sind
3D-Bilder, die nur einmal gezeichnet werden; was obenauf liegt (Obst, Granola, Raspeln, Nibs, Minze), ist SVG. Ohne
WebGL sind auch die Behälter gezeichnet. Gezogen wird, was du in der Hand hättest: eine Handvoll Obst, der Honiglöffel,
der Messlöffel Chia – und die Schokosoße als ganze Flasche.

**Gäste und Café:** Die Gäste haben natürliche Proportionen – über der Theke sieht man Kopf, Hals, breite Schultern und
Oberarme. Die Haut hat weiches Licht von links oben, die Haare Strähnen und Glanz, die Kleidung Kragen, Nähte, Knöpfe und
Falten (T-Shirt, Hemd, Polo, Hoodie mit Kordeln, offene Strickjacke über einem Shirt). Die Laune erkennt man auf einen
Blick: fröhlich (lachende Augen, breites Lächeln, rote Wangen), entspannt, ungeduldig (schwere Lider, Blick zur Seite,
gerunzelte Stirn, Schweißtropfen) und wütend (rotes Gesicht, V-Brauen, Zähne, Dampfwolken). Die Rückwand des Cafés hat mehr Tiefe – ein
Fenster mit tiefer Laibung und hellem Tageslicht, eine Kreidetafel, ein Wandregal, Pendelleuchten mit warmem Schein,
weiche Schatten – und bleibt bewusst ruhig, damit Gäste und Bestellblasen davor gut lesbar sind. Bei 4 Gästen fehlen
Tafel und Regal, die die äußeren Bestellblasen sonst bis auf schmale Streifen verdecken würden.

**Level-Karte:** Die Karte ist eine lange Strecke zum Hochscrollen (Finger, Mausrad/Trackpad oder mit der Maus ziehen) durch sechs
Gegenden mit je 10 Leveln: **Am Strand** (Level 1–10, mit Meer, Steg, Strandbar, Rettungsturm und Palmen), die **Stadtpromenade**
(Level 11–20, bunte Häuser mit Markisen, Brunnen, Eiswagen, Café-Tische), den **Regenwald** (Level 21–30, Açaí-Palmen, Fluss mit
Wasserfall, Tukan), die **Teeplantage** (Level 31–40, Teeterrassen, Teehaus mit Matcha-Schild, Koi-Teich, rote Brücke, Kirschbäume),
den **Hafen** (Level 41–50, Kai mit Booten, Kran, Leuchtturm, Fischstand) und den **Nachtmarkt** (Level 51–60, Marktstände unter
Lampions, Riesenrad, Feuerwerk über dem Finale und der Açaí-Stand ganz oben). Gegenden, die du noch nicht erreicht
hast, liegen im Dunst; ein Schild am Anfang jeder Gegend sagt, ab welchem Level sie aufgeht. Eine Spielfigur (eine Stecknadel mit
Açaí-Becher) schwebt über dem Level, das als Nächstes dran ist, und die Karte öffnet sich genau dort.

**Spielgefühl:** Wer schnell bedient, bekommt Lob über dem Gast („Perfekt!“, „Super!“) und Glitzer; wer mehrere Gäste hintereinander
zufriedenstellt, sieht eine **Combo** („Combo ×3!“) über der Theke – sie ist nur zur Freude da und bringt keine Extramünzen. Geht ein
Gast wütend, wackelt das Café und die Ränder blitzen rot. Gäste blinzeln ab und zu. Ab Level 4 verschwinden die Namensschilder unter den
Behältern und die Regal-Beschriftungen (dann kennst du die Zutaten); mit der Maus über einem Behälter oder beim Herausnehmen zeigt er
seinen Namen, neue Zutaten („NEU“) behalten ihn. Auf Android-Handys vibriert das Spiel kurz dazu (abschaltbar unter Einstellungen →
Vibration). Beim Start zeigt ein Ladebildschirm Logo und Ladebalken; zwischen den Menüs blendet das Spiel über, vor und nach einem Level
schließt sich kurz ein Açaí-Vorhang. Die Knöpfe sind glänzend wie in einem Handyspiel, und das HUD im Spiel hat denselben kräftigen Look
wie die Menüs.

**Endlos-Modus:** Nach Level 15 wird der Endlos-Modus freigeschaltet: kein Zeitlimit, alle 30 Sekunden
wird es schwerer (mehr Plätze, mehr Gäste, größere Bestellungen). Gespielt wird, bis alle Herzen weg sind
oder du im Pausenmenü die Schicht beendest – deine Münzen und dein Highscore werden gespeichert.

Fortschritt, Sprache und Ton-Einstellungen werden im Browser gespeichert (`localStorage`). Von vorne anfangen:
**Einstellungen** (Zahnrad oben rechts im Titelbild) → **Neues Spiel** – Münzen, Sterne und Einkäufe werden gelöscht,
Sprache und Ton bleiben.

## Auf dem MacBook spielen

Einfach <https://leesyashin.github.io/Acai/> in Safari, Chrome, Firefox oder Edge öffnen – keine App, nichts zu
installieren (Safari ab Version 14.1). Das Spiel passt sich jeder Fenstergröße an und ist auf Retina-Displays scharf.

- **Ziehen mit dem Trackpad:** Trackpad herunterdrücken, gedrückt halten und dabei ziehen – oder mit drei Fingern
  ziehen, wenn das in den Systemeinstellungen (Bedienungshilfen → Zeigersteuerung) eingeschaltet ist. Eine Maus geht auch.
- **Größer spielen:** Vollbild mit **⌃⌘F** (oder dem grünen Knopf oben links im Fenster) – die Bühne wächst mit.
- **Kein versehentliches Zoomen oder Zurückblättern:** Pinch-Zoom, ⌘/Ctrl + Scrollen und das Wischen mit zwei Fingern
  sind im Spiel abgeschaltet, damit ein laufendes Level nicht aus Versehen verloren geht.
- Musik und Sounds starten nach dem ersten Klick (das verlangt der Browser).

## Als App auf Handy oder Tablet

Im Browser <https://leesyashin.github.io/Acai/> öffnen und das Spiel zum Home-Bildschirm hinzufügen – auf dem **iPhone/iPad** in Safari
über *Teilen → Zum Home-Bildschirm*, auf **Android** in Chrome über das Menü *App installieren* (oder *Zum Startbildschirm hinzufügen*).
Dann startet es mit eigenem Icon im Vollbild ohne Browserleisten, im Querformat, und läuft nach dem ersten Spielen auch **offline**.

Auf Handys und Tablets (und in der installierten App) füllt das Spiel den ganzen Bildschirm: Die Bühne bleibt gleich groß, aber Café-Wand,
Arbeitsplatte, Karte und Menü-Hintergründe laufen bis an die Ränder weiter, und die Anzeigen (Münzen, Herzen, Zeit, Zurück-Knopf) sitzen
an den Bildschirmkanten – nicht hinter der Notch. Am Desktop-Browser bleibt das gerahmte Bild mit lila Rand.

Auf dem **Handy** (quer gehalten) ist alles etwa halb so groß wie auf dem Tablet. Deshalb sind dort Namensschilder,
Schicht-Beschriftungen, Hinweise, Level-Banner und Tutorial größer gesetzt, und die Ablageflächen fangen ein Teil auch dann,
wenn du etwas neben ihnen loslässt. Hochkant bittet das Spiel, das Handy zu drehen („Trotzdem spielen“ geht auch).
Unten ist nur Arbeitsplatte – keine Regale mehr –, damit möglichst viel Platz für die Stationen bleibt.

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
| `npm test` | Unit-Tests mit `node --test` (Engine, Bestellungen, Daten, Speicherstand, Übersetzungen, Audio, Grafik, 3D-Geometrie, -Modelle und Zutaten-Behälter, Balancing); `node --test tests/` geht auch |
| `node tools/icons.mjs` | Zeichnet die App-Icons (`icons/*.png`, `icons/icon.svg`) neu aus `appIconSVG` in `js/art.js` – nur nötig, wenn sich das Icon ändert |
| `npm run build` | Bündelt alles mit esbuild zu `dist/acai-fever.html` (eigenständig, läuft per `file://`) und `dist/artifact.html` (gleicher Inhalt ohne `<html>/<head>/<body>`-Hülle, zum Veröffentlichen als Claude-Artifact). `dist/` liegt im Repository – nach jeder Änderung am Spiel neu bauen, GitHub Pages kopiert es ohne Build |
| `npm run e2e` | Führt alle Playwright-Skripte `tests/e2e/*.e2e.mjs` nacheinander aus (Chromium, headless, Server auf Port 8090 bzw. `E2E_PORT`; ist der Port belegt, nutzen sie den Server dort nur, wenn er diesen Stand ausliefert). Filter: `npm run e2e -- playthrough` |

`tools/build.mjs` versteht außerdem `--entry <datei>`, `--outdir <ordner>` und `--root <ordner>`.
E2E-Skripte legen Screenshots in `$E2E_OUT_DIR` ab (Standard: Temp-Ordner), nie im Repository.
`playthrough.e2e.mjs` spielt Level 1 komplett mit echten Maus-Drags durch (inkl. Tutorial, Qualitätsstern im Shop, Level 2 und Level 3 mit seiner neuen Zutat),
dann mit Touch auf 1024×768, testet den Endlos-Modus und die englische Oberfläche, prüft, dass ein
Zwei-Finger-Pinch im Rand um die Bühne die Seite nicht zoomt, spielt in einem MacBook-Fenster (1470×832, Retina) mit
der Maus und prüft dort, dass Trackpad-Pinch, ⌘/Ctrl + Scrollen und Zwei-Finger-Wischen weder zoomen noch zurückblättern,
und dass zwei offene Tabs sich den Spielstand
nicht gegenseitig überschreiben. `appliances.e2e.mjs` prüft die 3D-Geräte (Modelle je Upgrade, Animationen, Deckel,
Kaltluft der Truhe, Teemühle und Düse der Matcha-Maschine, Shop-Bilder), dass das Spiel flüssig bleibt, wenn beide Mixer
und beide Matcha-Gläser zugleich animiert sind (auch mit Software-WebGL), dass die Bilder der Zutaten-Behälter bei einer
neuen Pixeldichte wieder scharf gezeichnet werden, und die gezeichneten Geräte ohne WebGL. `layout.e2e.mjs` prüft das
Spielfeld: Jede Station liegt ganz auf der Bühne, ist mindestens 64 px groß und überdeckt keine andere, kein Behälter
verdeckt einen Namen oder ein Namensschild, kein *NEU*-Schild verdeckt Qualitätssterne oder Ebenen-Nummer – auch in
der vollsten Küche mit 4 Gästen, 2 Mixern, 4 Bechern, allen 23 Zutaten (16 für die Bowls, 7 in der Matcha-Bar) und 2 Matcha-Plätzen (mit und ohne WebGL, bei
1280×800 und 1024×768) und in kleinen Küchen; ein Druck auf die Chips eines Bechers hebt genau diesen Becher (auch bei
einem falsch belegten Becher mit 6 Zutaten bleiben sie in höchstens zwei Reihen unter ihm). Außerdem setzt es 4, 3 und 2
Gäste mit den längsten Bestellungen (3 + 3 + Matcha): Ihre Blasen bleiben unter dem HUD auf der Bühne, halten Abstand,
enden über den Haaren, zeigen auf ihren Gast, haben Symbole ≥ 38 px und lassen das Neon-Schild frei; eine Bowl oder ein
Glas auf einer Blase wird diesem Gast serviert. `build.e2e.mjs` baut das
Spiel und startet es per `file://`. Alle 3D-Geräte in allen Zuständen zeigt `tools/appliances-3d.html`
(`npm start`, dann `http://localhost:8080/tools/appliances-3d.html?anim=1`), dort auch alle Zutaten-Behälter. Für eine Sichtprüfung erzeugt `node tools/shots.mjs <ordner>` Screenshots
aller Bildschirme in mehreren Größen.

## Werbevideo für TikTok

`tools/promo/` enthält kurze Werbefilme (12–39 s, Hochformat 1080×1920), die das Spiel vorstellen – in acht Fassungen
(`--version`):

- **`hype`** (Standard): schneller Motion-Design-Film – Hook („4 Gäste · 1 Mixer · keine Zeit“), Logo, die drei Schritte
  *Mixen → Belegen → Servieren* animiert, Zeitdruck, 16 Zutaten, 3D-Mixer-Upgrades, Frucht-Matcha, Level, Endkarte.
- **`mix`**: ruhiger geschnitten (ein Schnitt alle zwei Takte, weiche Übergänge, kaum Wackler) – die drei Schritte und der
  Ansturm in **echtem Gameplay** im Bildschirm-Fenster, dazu Logo, Zutaten, Upgrades und Endkarte.
- **`gameplay`**: fast nur **echtes Gameplay**, bildschirmfüllend, die Kamera folgt dem Finger, kurze Untertitel
  („Basis mixen“, „Belegen“, „Servieren & kassieren“ …), ein Logo-Moment, eine Totale mit den Features und die Endkarte.
- **`combo`**: erst der komplette `hype`-Film, dann ca. 15 s **echtes Gameplay** wie in `gameplay` („Echtes Gameplay“) und
  zum Schluss die Endkarte (ca. 39 s).

Dazu vier schnell geschnittene Motion-Design-Filme im TikTok-Stil (je ca. 12 s, 24 Beats): Schnitte auf jedem
(halben) Beat, Untertitel Wort für Wort wie aus CapCut, Zoom-Punches, Glitches, Impact-Frames, Emoji-Explosionen und ein
Boom auf jedem großen Moment (`tools/promo/tiktok.js`). Jeder hat seinen eigenen Look und seine eigene Idee und braucht
keine Gameplay-Aufnahme:

- **`satisfying`**: „Das befriedigendste Spiel ever“ in Pastell – die fertige Bowl als Hook, dann Jump-Cuts: Açaí in den
  3D-Mixer (der Strudel wird immer schneller), eingießen, sechs Toppings auf den halben Beats (jedes mit neuer Einstellung,
  seinem Namen und einem steigenden Ton), „Perfekt!“, ein Erdbeer-Matcha mit Eis und Cold Foam, eine Bowl-Parade in
  wechselnden Farben, die Endkarte. Die Menü-Bossa des Spiels als House-Groove.
- **`orders`**: POV auf einem Handy-Sperrbildschirm – vom ersten Bild an fluten die Bestellungen als Benachrichtigungen
  herein, immer schneller, „HILFE!!“; Drop: „Kein Problem.“, das Spiel auf dem Tablet, *Mixen · Belegen · Servieren*, die
  Benachrichtigungen werden grün und die Münzen zählen hoch; abends öffnet eine angetippte Benachrichtigung die Endkarte.
- **`journey`**: „60 Level in 6 Sekunden“ – ein Speedrun die Level-Karte hinauf, jedes Level wird golden, jede Gegend knallt
  mit Glitch ins Bild, oben Feuerwerk: „60 Level · 6 Welten“. Gebaut aus der Karte des Spiels (`js/art-map.js`): Level- und
  Gegenden-Zahl kommen aus `MAP_REGIONS`, der Film passt sich also an, wenn die Karte wächst.
- **`glowup`**: das Meme „Tag 1 vs. Tag 100“ – Tag 1 grau mit Grillen, Fliege und dem einzigen Gast, der geht;
  Plattenkratzer, „100 Tage später …“, dann knallt das Café auf den halben Beats ins Bild (Pro-Max-Mixer, Matcha-Maschine,
  Gäste, alle Zutaten, Deko, Münzexplosion), beide Tage im Vergleich mit den Zahlen und die Endkarte.

Alles ist aus den Grafiken, 3D-Geräten, Sounds und der Musik des Spiels gebaut (124 BPM, jeder Schnitt sitzt auf dem
Beat) – es gibt keine Video- oder Audiodateien im Repository. Das echte Gameplay nimmt `tools/promo/capture.mjs`
auf: Ein kleiner Bot spielt Level 10 mit echten Maus-Drags, Bild für Bild unter einer kontrollierten Uhr (auch die
CSS-Animationen), und merkt sich Fingerposition, Spielzüge und die Sound-Aufrufe des Spiels – die Filme legen die
Original-Sounds dann synchron unter das Bild. Die Aufnahme landet in `tools/promo/footage/` (nicht im Git).

```bash
npm install                                         # Playwright + Chromium, ffmpeg muss installiert sein
node tools/promo/render.mjs acai-fever-tiktok.mp4   # MP4 mit Musik, Ton auf -14 LUFS (TikTok)
node tools/promo/render.mjs out.mp4 --sfx-only      # zusätzlich out-sfx.mp4 nur mit Effekten (für einen TikTok-Sound)
node tools/promo/render.mjs out.mp4 --version mix   # ruhigere Fassung mit echtem Gameplay (nimmt es vorher auf)
node tools/promo/render.mjs out.mp4 --version gameplay   # fast nur echtes Gameplay
node tools/promo/render.mjs out.mp4 --version orders     # satisfying | orders | journey | glowup (ohne Aufnahme)
node tools/promo/capture.mjs --seconds 48           # Gameplay neu aufnehmen (sonst: render.mjs --recapture)
node tools/promo/render.mjs out.mp4 --lang en       # englische Fassung
node tools/promo/render.mjs out.mp4 --stills 1,6.5  # nur Einzelbilder zum Prüfen
```

Weitere Optionen: `--fps 30` (Bilder pro Sekunde), `--blur 3` (Teilbilder pro Bild für Bewegungsunschärfe,
`1` = aus, schneller), `--workers 3` (parallele Browser-Seiten), `--from`/`--to` (nur ein Ausschnitt).
Das Skript macht zuerst einen Screenshot vom echten Spiel (das erste Level mit vier Plätzen und Matcha; klappt das nicht, zeigen die Filme das laufende Spiel),
nimmt für `mix`/`gameplay`/`combo` bei Bedarf das Gameplay auf (ca. 15 Minuten), rendert dann jedes Bild einzeln im Browser und setzt Bild und Ton mit ffmpeg zusammen. Vorschau mit
Ton und Zeitleiste: `npm start`, dann <http://localhost:8080/tools/promo/promo.html?version=mix> (Leertaste = Play/Pause,
Pfeiltasten = ein Bild, `&lang=en`).

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
js/art-food.js        Becher mit Schichten, Zutaten, Inhalt der Zutaten-Behälter (und die Behälter ohne WebGL), Packungen, Matcha-Gläser
js/art-kitchen.js     Theke und Arbeitsplatte in Perspektive, Regal, Gefriertruhe, Podeste, Café-Rückwand, Deko;
                      Mixer, Matcha-Maschine, Mülleimer als Ersatz ohne WebGL
js/art-guests.js      die Gäste: Aussehen und Büsten in vier Launen
js/art.js             HUD-Symbole, Logo, Karte; reicht alle Grafiken weiter
js/geo3d.js           3D-Mathematik, Geometrie (Drehkörper, abgerundete Boxen, Rohre, Flüssigkeitsoberflächen), Materialien
js/kitchen3d.js       3D-Modelle der Küchengeräte mit allen Ausbaustufen und Animationen
js/pantry3d.js        3D-Modelle der Zutaten-Behälter (Edelstahl-Schalen, Gläser, Quetschflasche, Kokosnuss, Holz)
js/gl3d.js            WebGL-Renderer (Studiolicht, Edelstahl, Glas, Muster) – ohne Bibliothek
js/art3d.js           3D-Ansichten der Stationen im Spiel, einmal gezeichnete Bilder der Zutaten-Behälter und 3D-Bilder für Shop und Menüs
js/audio.js           Soundeffekte und Musik (WebAudio)
js/game-view.js       Spielbildschirm
js/screens.js         Menüs: Titel, Karte, Shop, Einstellungen, Ergebnis
tools/serve.mjs       Entwicklungsserver (ohne Abhängigkeiten)
tools/build.mjs       esbuild-Build → dist/
tools/run-e2e.mjs     startet die E2E-Skripte nacheinander
tools/shots.mjs       Screenshots aller Bildschirme zur Sichtprüfung
tools/*.html          Vorschauseiten für Grafiken, 3D-Geräte (appliances-3d.html), Sound und Drag & Drop
tools/promo/          TikTok-Werbefilme: film.js (Szenen + Schnittfassungen), film-*.js (die Motion-Filme satisfying,
                      orders, journey, glowup), tiktok.js (CapCut-Untertitel, Emoji-Explosionen), kit.js/motion.js
                      (Bausteine, Easing), footage.js (echtes Gameplay mit Kamera), capture.mjs (nimmt es auf), score.js
                      (Soundtrack), promo.html (Vorschau), render.mjs (rendert das MP4 mit Playwright + ffmpeg)
tests/*.test.mjs      Unit-Tests (node --test)
tests/e2e/            Playwright-Skripte + gemeinsame Helfer (helpers.mjs)
docs/DESIGN.md        Spieldesign, Regeln, Modul-Verträge, Layout
```

---

## English

**Açaí Fever** is a Cooking-Fever-style time-management game for the browser. You run an açaí bar:
customers order bowls (and a fruit matcha from level 7), and you build them by **drag & drop** before their
patience runs out. Made for landscape tablets, also playable with a mouse, on a MacBook in the browser (Safari, Chrome, Firefox, Edge – mouse or
trackpad, nothing to install; trackpad pinches and two-finger swipes never zoom or navigate away) and on phones. German and English UI; sound
effects and music are synthesized – there are no image or audio files. Play online:
<https://leesyashin.github.io/Acai/> (every push to `main` deploys there).
The kitchen appliances are real-time 3D models (WebGL, no library) with animations – a vortex in the blender jug,
a grinding tea mill, a steaming tank and a pouring nozzle in the matcha machine, a pedal bin lid and cold air from the chest
freezer – and every kitchen upgrade brings a new model (blender: Classic → Turbo → Pro → Pro Max, big jug; one-slot →
two-slot matcha machine). Without WebGL the game shows the drawn (SVG) appliances. The blender
is modelled on a real stand blender: a fluted glass jug with a scale, a clear handle and a pouring spout, a black lid with a
measuring cap, and a tall motor base with a black glass band that dips into a V display and a big start/stop dial – white
with a plain knob (Classic), brushed stainless with a countdown display (Turbo), açaí purple with an LED ring (Pro) or
graphite with a big display, chrome trim and a light bar (Pro Max). The matcha machine follows a household tea-latte
machine: an olive shell with a black front, a smoked water tank over an olive collar and the nozzle, a drip tray with a
grate and a glass tea mill with green matcha powder in an alcove. Blenders and
machine stand at the back of the worktop in front of the pass, about twice as tall as a cup. The ingredients stand in real
containers on oak risers: fruit in brushed stainless pans, granola in a clip-top jar, honey with its dipper, chia in a
Weck glass with a measuring spoon, peanut butter with a spoon, chocolate sauce in a squeeze bottle, shredded coconut in
its shell, cacao nibs in a walnut bowl and mint on a board (3D pictures drawn once; drawn in SVG without WebGL).
A drag carries what you would hold: a handful of fruit, the honey dipper, the chia measuring spoon – and the chocolate
sauce as its whole squeeze bottle.
The guests have natural proportions (head, neck, broad shoulders and upper arms above the pass; soft light on the skin, hair
with strands and shine, clothes with collars, seams, buttons and folds) and show their mood at a glance – happy, relaxed,
impatient (heavy lids, a sideways look, a frown, a sweat drop) or angry (red face, gritted teeth, steam). The café's back wall has
depth (a window with a deep reveal and bright daylight, a chalkboard, a shelf, pendant lamps with warm halos, soft
shadows) and stays calm, so the guests and their order bubbles stand out. With 4 guests it leaves out the chalkboard and
the shelf, which the outer order bubbles would hide all but for thin slivers.

**How to play:** drag a frozen pack into the blender and switch it on with the button on its dial, put an empty
bowl (a clear cup) from the stack on a free spot, drag the ready blender onto it, add *Fruits & Crunch*, then
*Toppings & Sauces* (fixed layer order – wrong drops bounce back), and drag the finished bowl onto the customer. From
level 6 a ready blender left running **overflows** and has to go into the trash; switched off it cannot overflow, but
its base melts after a while unless the blender has the **freeze** upgrade. The **auto cup refill** (bought per bowl
spot) pushes a fresh cup up out of the counter whenever its spot is empty. From level 10 two customers always wait at
once, and some order the same bowl two or three times. Fruit matcha (an iced matcha latte on banana, strawberry, blueberry, mango or kiwi purée): drag the
fruit onto the glass in the matcha machine, wait until it is brewed, then drag the glass onto the customer.
The order bubble over each guest shows the bowl on the left – the cup with its base (1), then a row of fruits & crunch
(2) and one of toppings & sauces (3), big icons on circles in their layer's colour – and, behind a divider, the matcha with
its fruit; a thick bar along the bottom shows the guest's patience (green → yellow → orange → red), and whatever you have
handed over turns green with a big tick. The chips under each cup show what is in it in the same way.
A customer who runs out of patience leaves and costs you a **heart** – 0 hearts loses the level.
20 campaign levels with 1–3 **stars** (money goals); coins are kept even when you lose and buy new ingredients
(4 at start, 16 total), quality, kitchen upgrades and decor in the **shop**. **Endless mode** unlocks after
level 10 and gets harder every 30 seconds; end the shift from the pause menu at any time – coins and your best
score are saved. To start over: **Settings** (gear on the title screen) → **New game**.

**Run locally** (Node.js 22+):

```bash
npm install        # dev tools only (esbuild, Playwright)
npm start          # http://localhost:8080 (no-cache static server)
npm test           # unit tests (node --test)
npm run build      # dist/acai-fever.html (single file, works via file://) + dist/artifact.html
npm run e2e        # Playwright scripts in tests/e2e/*.e2e.mjs, one after another (server on :8090 or E2E_PORT;
                   # a server already on that port is reused only when it serves this tree)
node tools/shots.mjs <dir>   # review screenshots of every screen
node tools/promo/render.mjs promo.mp4 --lang en   # the 25 s TikTok promo video (1080×1920, needs ffmpeg)
node tools/promo/render.mjs promo.mp4 --version gameplay   # calmer cuts with real recorded gameplay: mix | gameplay
node tools/promo/render.mjs promo.mp4 --version journey    # motion films: satisfying (pastel ASMR bowl build, lo-fi),
                   # orders (POV: order notifications flood a phone's lock screen), journey (a speedrun up the level
                   # map) and glowup (the "day 1 vs. day 100" meme) – about 12 s each, cut fast in the TikTok style
```

Unit tests cover the engine, orders, data, save, i18n, audio, art, the 3D geometry, appliance models and ingredient
containers, and a balance simulation; the e2e scripts cover drag & drop, gameplay, the screens, a full playthrough, the
3D appliances (the game keeps its frame rate with both blenders and both matcha glasses animating, also with software
WebGL) and the ingredient containers' pictures (redrawn sharp at a new pixel ratio; with the SVG fallback), the gameplay
layout (`layout.e2e.mjs`: every station on the stage, ≥ 64 px, no overlaps, labels uncovered, a press on a cup's chips
lifts that cup, the order bubbles of 2–4 guests with the longest orders) and the single-file build. `dist/` is
committed: rebuild it after every change to the game (GitHub Pages copies it without building).

Or build once and open `dist/acai-fever.html` directly. The full spec lives in [`docs/DESIGN.md`](docs/DESIGN.md).
