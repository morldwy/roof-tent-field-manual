# Roof Tent Manual

Eine mobile Karte für ruhige Naturorte rund um den gewählten Standort – mit Landschaftsfiltern,
Pkw-Zufahrt, Navigation und bewusst strenger rechtlicher Ampel. Jeder Spot hat
eine Detailansicht, eine persönliche 5-Sterne-Bewertung sowie Kommentare mit
Zeitstempel und Foto-Uploads.

Die Topnavigation verbindet die Standortsuche mit einem mobilen Dachzelt-Guide
für das Autohome Columbus Variant. Der Guide enthält Praxisabläufe, lokal
gespeicherte Checklisten und moderierte Community-Tipps. Neue UGC-Beiträge
landen zunächst mit Status `pending` in Supabase und werden erst nach
redaktioneller Freigabe öffentlich sichtbar.

Die angezeigten Orte folgen dynamisch dem sichtbaren Kartenausschnitt; beim
Herauszoomen werden entsprechend größere Regionen bis zur Länderübersicht geladen. Kuratierte
Orte werden mit passenden OpenStreetMap-Kandidaten ergänzt. Ein kontrollierter
Hintergrundimport recherchiert diese Kandidaten regionsweise und speichert sie
zentral in der Supabase-Tabelle `spots`. Die App fragt diese Daten anschließend
schnell anhand des gewählten Kartenmittelpunkts und Umkreises ab.
Automatisch gefundene Orte sind ausdrücklich als ungeprüfte Scout-Orte markiert;
sie stellen keine bestätigte Übernachtungserlaubnis dar. Ergebnisse werden pro
Browsersitzung gecacht und Anfragen nach Kartenbewegungen gebündelt.

Ortsart und Erlaubnisstatus lassen sich unabhängig voneinander kombinieren.
Der schonende Hintergrundimport wird kontinuierlich von Deutschland auf Europa
bis einschließlich Georgien erweitert.

Bewertungen, Kommentare und Fotos werden über Supabase geräteübergreifend
gespeichert. Die App nutzt anonyme Supabase-Sitzungen und Row Level Security,
damit jeder Besucher ohne Registrierung beitragen kann und dennoch nur unter
seiner eigenen Benutzerkennung schreibt.

Vor der ersten Nutzung muss `supabase-setup.sql` einmal vollständig im Supabase
SQL Editor ausgeführt und unter Authentication die anonyme Anmeldung aktiviert
werden.

## Rechtlicher Rahmen

Die eingetragenen Orte sind Scout-Regionen und Tagesziele, keine pauschal
freigegebenen Übernachtungsplätze. Eine geplante Übernachtung sollte nur dort
stattfinden, wo eine ausdrückliche Erlaubnis dokumentiert ist. Schutzgebiete,
Beschilderung, Wegerechte und lokale Regeln haben immer Vorrang.

## Veröffentlichung

Die Anwendung besteht aus statischem HTML, CSS und JavaScript und kann direkt
über GitHub Pages aus dem Hauptverzeichnis des `main`-Branches bereitgestellt
werden.

## Lokale Prüfung

Voraussetzung: Node.js 20 oder neuer.

```bash
pnpm install
pnpm run verify
```

`verify` prüft JavaScript-Syntax und Datenbanktypen, führt Smoke-, Sicherheits-
und Asset-Prüfungen aus und erzeugt anschließend einen statischen
Produktions-Build unter `dist/`.

Die technische Dokumentation liegt unter [`docs/`](docs/).
