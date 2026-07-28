# Changelog

Alle wichtigen Änderungen dieses Projekts werden hier dokumentiert.

## [Unreleased]

### Fixed

- OpenStreetMap-Strände werden nur noch bei Nähe zu einer tatsächlichen
  Küstenlinie als Meer eingeordnet; Binnenstrände erscheinen als See.
- Hero-Subline nennt das Übernachten im Dachzelt ausdrücklich.

## [0.1.0] - 2026-07-28

### Added

- vollständige Architektur-, Produkt-, Design-, Daten- und Supabase-Dokumentation
- responsives Nutzerfoto mit Mercedes W211 und Autohome Columbus Variant im Hero
- echte Textsuche über sichtbare Spots
- zentrale Supabase-Client- und Session-Schicht
- TypeScript-Typen des tatsächlichen Datenbankschemas
- reproduzierbarer statischer Build
- automatisierte Syntax-, Navigations-, Asset-, Sicherheits- und Smoke-Tests
- reproduzierbare TypeScript-Prüfung der Datenbanktypen

### Changed

- Hero-Bild erhält intelligenten mobilen und Desktop-Zuschnitt
- leere Suchergebnisse erhalten einen klaren Zustand
- Topnavigation, Statusmeldungen und Suchzustände sind auf schmalen Bildschirmen und für assistive Technik robuster

### Security

- EXIF- und GPS-Metadaten aus dem bereitgestellten Hero-Foto entfernt
- automatisierter Scan auf typische Frontend-Secrets ergänzt
