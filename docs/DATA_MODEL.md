# Data Model

Die kanonischen Runtime-Typen sind in `types/database.types.ts` dokumentiert. Die Typen spiegeln das vorhandene Schema; sie führen keine Migration aus.

## Beziehungen

```text
auth.users
├── ratings.user_id
├── comments.user_id
├── comment_photos.user_id
└── guide_tips.user_id

comments.id ──< comment_photos.comment_id

spots.id <── ratings.spot_id
spots.id <── comments.spot_id
```

Zwischen `spots` und Ratings/Kommentaren bestehen aktuell textuelle IDs, aber keine Foreign Keys. Dadurch bleiben auch kuratierte, nur im Frontend definierte Spots kompatibel.

## Spot

Das produktive Schema ist bewusst kompakter als das langfristige Wunschmodell:

- `type` bildet Landschaft ab
- `access` bildet Zufahrtshinweise ab
- `status`, `label` und `note` bilden die rechtliche Orientierung ab
- `source_url` verweist bei importierten Kandidaten auf OpenStreetMap

Nicht vorhanden sind `slug`, Bildrelationen, Tags, separate Kurzbeschreibung, Dachzelteignung und `created_at`. Diese Felder werden nicht parallel im Frontend erfunden.

## Status

Aktuell zulässig:

- `green`
- `amber`
- `red`

Orange und Grau benötigen eine additive Datenbankmigration und eine rückwärtskompatible UI-Erweiterung.

## Community

- Ein Nutzer kann pro Spot genau ein Rating besitzen.
- Kommentare sind unveränderliche Einträge.
- Fotos werden getrennt gespeichert und über `storage_path` aufgelöst.
- Guide-Tipps beginnen als `pending`.

