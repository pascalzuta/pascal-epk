# Jedes Kind kann schlafen lernen – aber mit Liebe

Statische Verkaufsseite für das E-Book **„Jedes Kind kann schlafen lernen – aber mit Liebe"** von **Nico Zingelmann** – ein sanfter, bindungsorientierter Schlaf-Ratgeber für Eltern.

Die Seite ist reines HTML/CSS/JS ohne Build-Schritt. Der Kauf läuft über einen **Stripe Payment Link**; nach erfolgreichem Kauf landet die Kundschaft auf `success.html` mit den Download-Links. Als Alternative wird auf die Amazon-Ausgabe verlinkt.

Gestaltung: warm, ruhig – Salbei/Sand/Creme mit Mond-Motiv.
Farbwelt u. a.: Creme `#f4efe6`, Tinte `#211d18`, Salbei `#7c8a6f` / `#5f6d54`, Sand `#e6dcc8`.

---

## Dateistruktur

```
site/
├── index.html            # Verkaufsseite (Landing Page)
├── success.html          # Danke-/Download-Seite nach dem Kauf (nicht indexiert)
├── impressum.html        # Rechtstext: Impressum
├── datenschutz.html      # Rechtstext: Datenschutzerklärung
├── widerruf.html         # Rechtstext: Widerrufsbelehrung
├── robots.txt            # Crawling-Regeln + Verweis auf Sitemap
├── sitemap.xml           # Öffentliche URLs
├── assets/
│   ├── css/
│   │   └── style.css      # Zentrales Stylesheet
│   ├── js/
│   │   ├── config.js      # Konfiguration (Stripe-Link, Amazon-URL) – VOR LIVEGANG SETZEN
│   │   └── main.js        # Interaktion / Logik
│   └── img/
│       ├── favicon.svg    # Favicon (Mondsichel + Sterne)
│       ├── og-image.svg   # Social-Sharing-Bild (Quelle)
│       └── og-image.png   # Social-Sharing-Bild (1200×630, referenziert als og:image)
└── downloads/            # Auslieferbare Dateien (E-Book + Boni) – VOR LIVEGANG BEFÜLLEN
```

> **Hinweis:** Alle Pfade in der Seite sind **relativ** angelegt. Dadurch läuft die Seite
> problemlos in einem Unterpfad (Zieladresse: `https://zuta.co/nico/`).

---

## Lokale Vorschau

Im Ordner `site/` einen einfachen Webserver starten:

```bash
python3 -m http.server 8000
```

Dann im Browser öffnen: <http://localhost:8000/>

(Ein simples Öffnen der HTML-Dateien per `file://` funktioniert wegen relativer Pfade
und JS meist nicht sauber – daher den lokalen Server verwenden.)

---

## GO-LIVE Checkliste

- [ ] **(a) Konfiguration setzen** – In `assets/js/config.js` die Werte
  `STRIPE_PAYMENT_LINK` (dein Stripe Payment Link) und `AMAZON_URL`
  (Link zur Amazon-Ausgabe) mit den echten URLs füllen.

- [ ] **(b) Stripe Payment Link konfigurieren**
  - Success-URL auf
    `https://zuta.co/nico/success.html?session_id={CHECKOUT_SESSION_ID}` setzen.
  - Die **Widerrufs-Zustimmung für digitale Inhalte** als
    **Pflicht-Bestätigung** einholen (Kundschaft bestätigt beim Kauf ausdrücklich,
    dass mit der sofortigen Bereitstellung begonnen wird und das Widerrufsrecht
    damit erlischt).

- [ ] **(c) Download-Dateien einlegen** – Die echten E-Book- und Boni-Dateien in
  `downloads/` ablegen. **Gleiche Dateinamen** verwenden wie in `success.html`
  verlinkt (sonst brechen die Download-Links).

- [ ] **(d) Rechtstexte finalisieren** – `impressum.html`, `datenschutz.html` und
  `widerruf.html` mit den **echten Daten** füllen (Name, Anschrift, Kontakt,
  verarbeitete Daten, Dienstleister etc.) und **anwaltlich prüfen** lassen.

- [ ] **(e) OG-Bild prüfen/rendern** – `og-image.png` (1200×630) liegt bereits
  gerendert vor. Bei Änderungen am `og-image.svg` das PNG neu erzeugen
  (siehe unten).

- [ ] **(f) Deploy** – Den **Inhalt** dieses Ordners als Unterordner `nico/` in
  das GitHub-Pages-Repo von `zuta.co` (`pascalzuta.github.io`) legen. Danach ist
  die Seite unter **`https://zuta.co/nico/`** erreichbar.

---

## OG-Bild neu rendern (optional)

Das PNG wurde bereits aus dem SVG erzeugt. Falls das SVG geändert wird, das PNG
mit einem der folgenden Tools neu rendern (in dieser Reihenfolge probieren):

```bash
cd assets/img

# rsvg-convert (empfohlen, schärfste Schrift)
rsvg-convert -w 1200 -h 630 og-image.svg -o og-image.png

# oder cairosvg
cairosvg og-image.svg -W 1200 -H 630 -o og-image.png

# oder ImageMagick
magick -background none -density 144 og-image.svg -resize 1200x630 og-image.png

# oder macOS sips (Fallback; nutzt evtl. eine Fallback-Schrift)
sips -s format png og-image.svg --out og-image.png --resampleHeightWidth 630 1200
```

> Für ein pixelgenaues Ergebnis mit der **Fraunces**-Serifenschrift empfiehlt sich
> `rsvg-convert` oder `cairosvg` bei installierter Schrift; das SVG nutzt ansonsten
> eine System-Serifenschrift als Fallback.
