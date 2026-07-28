# Current State

Stand: 28. Juli 2026  
Repository: `morldwy/roof-tent-field-manual`  
Produktname in der Oberfläche: **Roof Tent Manual**  
Produktive URL: `https://morldwy.github.io/roof-tent-field-manual/`

## Technische Basis

- Statische Multi-Page-Anwendung aus HTML, CSS und JavaScript.
- Kein Framework, kein Bundler und aktuell kein `package.json`.
- GitHub Pages veröffentlicht direkt aus `main` und dem Repository-Root.
- GitHub nutzt den automatisch erzeugten Workflow **pages build and deployment**; ein eigener Workflow ist nicht vorhanden.
- Leaflet 1.9.4 wird per CDN geladen.
- Supabase JS v2 wird per CDN geladen.
- OpenStreetMap liefert die Kartenkacheln; importierte Scout-Orte stammen aus Overpass/OpenStreetMap.
- Es gibt keine Environment-Datei. `supabase-config.js` enthält ausschließlich Projekt-URL und browsergeeigneten Publishable Key.
- Es gibt derzeit keine PWA-Dateien, keinen Service Worker und kein Web-App-Manifest.

## Seiten und Routing

### `index.html`

- Hero „Wild Spots“
- Topnavigation zur Standortsuche und zum Dachzelt-Guide
- Kartenansicht mit Leaflet
- Standortbestimmung über Browser-Geolocation
- Mindestumkreis 5/15/30/50 km
- kombinierbare Filter nach Landschaftstyp und Erlaubnisstatus
- dynamische Abfrage des sichtbaren Kartenausschnitts
- Kartenmarker mit Rating, Details, Kommentarsprung und Google-Maps-Navigation
- Spot-Karten und Detaildialog
- Ratings, Kommentare und Foto-Uploads
- Hash-Deep-Link `#spot/<id>` für kuratierte, bereits geladene Spots

### `guide.html`

- Dachzelt-Guide für Autohome Columbus Variant
- Schnellstart, Kapitel, rechtliche Ampel und Sicherheitsinformationen
- lokal gespeicherte Checklisten
- moderierte Community-Tipps über Supabase

Die Navigation verwendet normale relative Links. Es gibt keinen Client-Router.

## Design und Assets

- Skandinavisch-minimalistische Farbwelt in Grün, Creme und gedeckten Akzentfarben.
- Responsive Layouts, große Touch-Ziele, Karten-Popups und mobile Filterumbrüche.
- Der Hero kombiniert einen dunklen responsiven Verlauf mit dem vom Nutzer bereitgestellten Foto `assets/hero-w211-columbus.jpg`.
- Das Foto zeigt den Mercedes W211 mit Autohome Columbus Variant; GPS- und EXIF-Metadaten wurden vor der Aufnahme ins Repository entfernt.
- Es existiert eine Topnavigation, aber keine Bottom Navigation.

## Supabase

Projekt-ID: `cpnxysplsqolgvurezpe`  
Region: EU Central / Frankfurt  
Der sichtbare Supabase-Projektname lautet `roof-tent-field-manual`.

### Client und Authentifizierung

- Browser-Client aus `@supabase/supabase-js@2`.
- Anonyme Anmeldung wird automatisch verwendet.
- Kein Service-Role-Key im Frontend.
- Ratings, Kommentare, Fotos und Guide-Tipps sind nutzerbezogen.

### Tabellen

| Tabelle | Zweck | Wichtige Felder | Öffentliche Operationen |
| --- | --- | --- | --- |
| `spots` | zentrale Scout-Orte | `id`, `name`, `type`, `icon`, `lat`, `lng`, `access`, `status`, `label`, `note`, `source`, `source_url`, `discovered`, `updated_at` | Lesen |
| `ratings` | persönliche 1–5-Sterne-Wertungen | `spot_id`, `user_id`, `value`, Zeitstempel | Lesen; eigenes Insert/Update |
| `comments` | Spot-Kommentare | `spot_id`, `user_id`, `body`, `created_at` | Lesen; eigenes Insert |
| `comment_photos` | Zuordnung von Fotos zu Kommentaren | `comment_id`, `user_id`, `storage_path`, `created_at` | Lesen; eigenes Insert |
| `guide_tips` | moderierte UGC-Tipps | `user_id`, `section`, `body`, `status`, `created_at`, `reviewed_at` | nur freigegebene lesen; eigene Pending-Einträge anlegen |

Am 28. Juli 2026 waren öffentlich lesbar:

- 10.995 Spots
- 1 Rating
- 2 Kommentare
- 3 Kommentar-Fotos
- 0 freigegebene Guide-Tipps

### Row Level Security

- RLS ist auf allen Tabellen aktiviert.
- `spots` ist öffentlich lesbar; Browserrollen dürfen nicht schreiben.
- Ratings dürfen nur unter der eigenen `auth.uid()` angelegt oder aktualisiert werden.
- Kommentare und Foto-Metadaten dürfen nur unter der eigenen `auth.uid()` angelegt werden.
- Guide-Tipps sind öffentlich nur mit Status `approved` sichtbar; Einreichungen starten als `pending`.
- Browserrollen dürfen Guide-Tipps nicht aktualisieren oder löschen.

### Storage

- Öffentlicher Bucket `spot-photos`.
- Maximale Dateigröße: 5 MB.
- Zulässige Typen: JPEG, PNG, WebP, HEIC und HEIF.
- Upload nur in einen Ordner, dessen erster Pfadbestandteil der eigenen `auth.uid()` entspricht.
- Fotos werden im Browser vor dem Upload auf maximal 1600 Pixel und JPEG komprimiert.

### Edge Function und Import

- `discover-spots` kann Overpass-Anbieter abfragen und Spots per Admin-Client speichern.
- Ein geschützter Batch-Import akzeptiert Daten nur mit serverseitigem `SPOT_IMPORT_KEY`.
- Das Python-Skript `scripts/seed-germany.py` importiert Rasterfelder seriell.
- Automatisch gefundene Orte werden immer als `amber` und „Ungeprüfter Scout-Ort“ gespeichert.

## Nicht vorhandene Funktionen

- keine Favoriten
- keine Benutzerprofile
- keine Bottom Navigation
- keine PWA-/Offline-Funktion
- keine Marker-Cluster
- keine TypeScript-Browseranwendung; die Laufzeit bleibt bewusst JavaScript
- kein vollständiges End-to-End-Browsertestpaket und kein allgemeiner Linter
- kein Dark Mode

## Aktuelle Risiken

1. Bis zu 1.000 Marker und Karten werden gleichzeitig gerendert; auf Mobilgeräten kann das teuer werden.
2. Ratings und Kommentare werden global geladen statt auf sichtbare Spots begrenzt.
3. Externe CDN-Abhängigkeiten sind für den App-Start erforderlich.
4. Es gibt keine automatische Moderation für hochgeladene Fotos.
5. `user_id` ist über öffentliche Rating-Datensätze sichtbar, obwohl die IDs anonym sind.
6. Hash-Deep-Links funktionieren nur, wenn der Zielspot im aktuell geladenen Datensatz liegt.
7. Das dreistufige Spot-Schema unterstützt Orange und Grau aus dem zukünftigen Rechtsmodell noch nicht.
8. Die automatisierten Smoke-Tests prüfen Struktur und Kernpfade, ersetzen aber noch keine vollständigen Browser-End-to-End-Tests.

## Verifizierter Deployment-Stand

- Lokaler Branch: `main`
- Bei der Bestandsaufnahme geprüfter Ausgangs-Commit: `7077c51`
- GitHub-Pages-Deployment: erfolgreich
- Live-Startseite: HTTP 200
- Live-Seite enthält aktuellen Produkttitel, Guide-Link und aktuelle Asset-Version.

## Ergänzungen im Release-Kandidaten

- Suche nach Spot-Namen, Beschreibung und Umgebung
- zentrale Supabase-Client- und Session-Schicht
- dokumentierte Datenbanktypen mit TypeScript-Prüfung
- reproduzierbarer statischer Build
- automatisierte Syntax-, Typ-, Smoke-, Sicherheits- und Asset-Prüfungen
- CI-Qualitätsprüfung bei Änderungen an `main` und in Pull Requests
