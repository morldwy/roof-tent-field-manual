# Release Plan

## Vorgesehene Version

**v0.1.0 – First Stable Baseline**

Es existieren noch keine Git-Tags oder formalen Releases. `v0.1.0` dokumentiert deshalb erstmals einen reproduzierbar geprüften Produktstand, ohne eine künstliche frühere Versionshistorie zu erfinden.

## Architekturentscheidung

Für diesen Release erfolgt **keine React-, Next.js- oder Vite-Migration**.

Begründung:

- Die produktive Anwendung ist klein, statisch und funktioniert über GitHub Pages.
- Eine Frameworkmigration würde HTML, Routing, Leaflet, Supabase, Dialoge und Deployment gleichzeitig verändern.
- Der Stabilitätsgewinn wäre für diesen Release geringer als das Regressionsrisiko.
- Die aktuelle URL-Struktur (`/` und `/guide.html`) bleibt damit vollständig kompatibel.

Die Modernisierung erfolgt evolutionär. Eine spätere komponentenbasierte Migration wird erst empfohlen, wenn Testabdeckung, Datenzugriffsschicht und Releaseprozess belastbar sind.

## Release-Umfang

### 1. Reproduzierbare Qualität

- minimale projektlokale Release-Skripte ohne Produktionsabhängigkeit
- JavaScript-Syntaxprüfung
- statischer Produktions-Build in `dist/`
- automatisierte Smoke-Tests für Seiten, Assets, Navigation und Sicherheitsregeln
- Secret-Scan für typische Zugangsdaten

### 2. Supabase und Typen

- vorhandene Browserkonfiguration beibehalten
- zentrale, wiederverwendbare Supabase-Initialisierung
- anonyme Session zentral verwalten
- tatsächliches Datenmodell als TypeScript-Typdefinition dokumentieren
- keine produktive Schemaänderung in diesem Release
- bestehende Tabellen, Policies, Daten und Storage unverändert erhalten

### 3. Kernprodukt

- echte Spot-Suche nach Name, Zugang und Beschreibung
- bestehende Landschafts- und Erlaubnisfilter unverändert kombinierbar halten
- klare Lade-, Leer- und Fehlerzustände
- Karten-Popup, Spot-Karten und Detaildialog konsistent halten
- mobile Bedienung und Accessibility nachschärfen

### 4. Performance und Stabilität

- Datenabfragen und Rendering nachvollziehbar begrenzen
- Karten-/Listenstatus bei großen Ausschnitten eindeutig kommunizieren
- externe Fehler dürfen bestehende kuratierte Orte nicht entfernen
- keine neue CDN- oder Frameworkabhängigkeit

### 5. Dokumentation

- Istzustand, Architektur, Designsystem und Datenmodell
- Supabase/RLS/Storage
- rechtlicher Ansatz
- Produktvision und Roadmap
- Changelog und Releaseprüfung

## Bewusst nicht enthalten

- keine neue Datenbankmigration
- keine Favoriten-Neuentwicklung
- kein Austausch der Kartenbibliothek
- kein vollständiger Dark Mode
- keine Offline-Karten
- keine automatische Foto-Moderation
- keine Tourenplanung, GPX-, Wetter- oder Fahrzeugprofile
- kein Austausch oder künstlich generierter Ersatz des bereitgestellten Hero-Fotos

Diese Punkte bleiben Roadmap-Themen. Fehlende Bestandsfunktionen werden transparent dokumentiert und nicht als defekt dargestellt.

## Migrationsschritte

1. Bestandsdokumentation committen.
2. Releaseplan committen.
3. Qualitäts- und Build-Skripte ergänzen.
4. Supabase-Client zentralisieren und bestehende Seiten dagegen testen.
5. Suche sowie Status- und Fehlerzustände verbessern.
6. Accessibility und Responsive-Verhalten prüfen.
7. vollständige Dokumentation und Changelog erstellen.
8. Build und Smoke-Tests lokal ausführen.
9. auf `main` pushen und GitHub Pages beobachten.
10. Live-Routen, Supabase und Browserkonsole prüfen.
11. `v0.1.0` taggen und GitHub Release veröffentlichen.

## Rollback

- Keine Schemaänderung bedeutet kein Datenbank-Rollback.
- Jeder Implementierungsschritt wird separat committet.
- Bei einer Frontendregression kann GitHub Pages auf den letzten funktionierenden Commit zurückgesetzt werden, ohne Supabase-Daten anzufassen.

## Abnahme

- Startseite und Guide laden direkt und nach Refresh.
- Karte, Marker, Filter, Suche und Standortbestimmung bleiben bedienbar.
- Ratings, Kommentare, Fotos und Guide-Tipps nutzen weiterhin Supabase.
- Keine Secrets oder Service-Role-Keys sind im Repository.
- Build- und Smoke-Tests sind grün.
- GitHub Pages deployt erfolgreich.
- Release-Tag und Release Notes sind veröffentlicht.
