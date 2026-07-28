# Supabase

## Konfiguration

`supabase-config.js` enthält:

- Projekt-URL
- Publishable Key

Beides ist für Browseranwendungen vorgesehen. Service-Role-Keys, Import-Secret und private Schlüssel dürfen dort nie stehen.

## Client

`backend.js` stellt bereit:

- `ROOF_TENT_BACKEND.client`
- `ROOF_TENT_BACKEND.ensureAnonymousSession()`

Die Sessioninitialisierung wird dedupliziert und bei Fehlern für einen späteren Versuch freigegeben.

## CRUD

| Bereich | Lesen | Erstellen | Aktualisieren | Löschen |
| --- | --- | --- | --- | --- |
| Spots | öffentlich | nur Server/Import | nur Server/Import | nur Server |
| Ratings | öffentlich | eigener Nutzer | eigener Nutzer | nicht im Client |
| Kommentare | öffentlich | eigener Nutzer | nein | nein |
| Foto-Metadaten | öffentlich | eigener Nutzer | nein | nein |
| Guide-Tipps | nur `approved` | eigener Nutzer als `pending` | nur Moderation | nur Moderation |

## Storage

Bucket: `spot-photos`  
Public URLs sind bewusst öffentlich. Uploads werden über Nutzerordner eingeschränkt. Eine Inhaltsmoderation existiert noch nicht.

## Fehler und Fallback

- Spotabfragen fallen auf kuratierte Orte zurück.
- Community-Fehler werden als Hinweis dargestellt.
- Guide-UGC wird bei Backendfehlern ausgeblendet.
- SessionStorage cached Kartenausschnitte innerhalb einer Browsersitzung.
- Es gibt noch keinen vollständigen Offlinebetrieb.

## Migrationen

Die vorhandenen `supabase-*-setup.sql`-Dateien dokumentieren den produktiven Aufbau, sind aber noch keine versionierten Supabase-CLI-Migrationen. Neue Schemaänderungen müssen künftig unter `supabase/migrations/` als additive Migrationen angelegt, lokal geprüft und erst dann auf Produktion angewandt werden.

