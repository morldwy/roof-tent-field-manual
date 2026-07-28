# Architecture

## Überblick

```text
GitHub Pages
├── index.html ── app.js ──────── Leaflet / OpenStreetMap
│                 │
│                 └────────────── Supabase
├── guide.html ── guide.js ────── Supabase
├── backend.js ────────────────── zentraler Client + anonyme Session
├── styles.css
└── assets/

Supabase
├── Postgres + RLS
├── Auth (anonymous)
├── Storage (spot-photos)
└── Edge Function (discover-spots)
```

## Laufzeit

- Beide Seiten sind klassische HTML-Dokumente.
- Skripte werden ohne Modul-Bundler geladen.
- `supabase-config.js` stellt nur öffentliche Browserkonfiguration bereit.
- `backend.js` erzeugt genau einen Supabase-Client pro Seite und teilt eine deduplizierte Session-Initialisierung.
- `app.js` verwaltet Karte, sichtbare Spots, Filter, Suche und Community-Daten.
- `guide.js` verwaltet lokale Checklisten und moderierte Guide-Tipps.

## Routing

- `/` beziehungsweise `/index.html`: Standortsuche
- `/guide.html`: Guide
- `#spot/<id>`: Detailzustand innerhalb der Standortsuche

Es gibt keinen SPA-Router. Das ist für GitHub Pages robust und erlaubt direkte Seitenaufrufe.

## Build

`scripts/build.mjs` kopiert die produktiven statischen Dateien nach `dist/` und prüft die Produktidentität. GitHub Pages veröffentlicht weiterhin direkt aus dem Root von `main`; der Build dient in v0.1 als reproduzierbare Releaseprüfung und verändert den funktionierenden Deploymentprozess nicht.

`pnpm run verify` prüft zusätzlich JavaScript-Syntax, die Datenbanktypen mit
TypeScript sowie strukturelle Smoke-, Sicherheits- und Asset-Regeln. Die
Prüfung wird lokal und vor jedem Release ausgeführt. Eine zusätzliche
GitHub-Actions-Qualitätsprüfung bleibt für einen späteren Stand mit passend
eingeschränkter Workflow-Berechtigung vorgesehen.

## Bewusste Grenzen

- Kein Framework und keine Komponentenlaufzeit.
- Gemeinsame UI bleibt CSS-basiert.
- TypeScript-Typen dokumentieren das Datenmodell, ohne das Browser-Runtime-Modell zu ändern.
- Eine Frameworkmigration erfordert zuerst umfassendere End-to-End-Tests.
