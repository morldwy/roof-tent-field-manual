# Design System

## Charakter

Skandinavisch, ruhig, hochwertig und naturverbunden. Die Oberfläche nutzt große Bildflächen, zurückhaltende Karten, klare Statusfarben und wenige dekorative Elemente.

## Farben

| Token | Wert | Verwendung |
| --- | --- | --- |
| `--ink` | `#17372f` | Primärtext, Footer |
| `--forest` | `#1f5547` | Aktionen, aktive Zustände |
| `--moss` | `#6f8c61` | Sekundärtext, Akzente |
| `--paper` | `#f4f0e5` | Seitenhintergrund |
| `--card` | `#fffdf7` | Karten und Eingaben |
| `--line` | `#d8d1c0` | Grenzen |
| `--green` | `#2e7d55` | dokumentierte Erlaubnis |
| `--amber` | `#d58a21` | vorherige Klärung erforderlich |
| `--red` | `#b64b3b` | keine geplante Übernachtung |

## Typografie

- System-Sans für Navigation, Eingaben und Fließtext
- Source Serif 4 Display für emotionale Überschriften und Kartentitel; lokal
  eingebunden unter der SIL Open Font License 1.1
- Eyebrows in Versalien mit deutlicher Laufweite

## Interaktion

- Touch-Ziele mobil mindestens etwa 44 Pixel hoch
- Pill-Buttons für Filter und kompakte Aktionen
- Fokuszustände dürfen nicht entfernt werden
- Status darf nie ausschließlich über Farbe kommuniziert werden
- Dialoge besitzen eine sichtbare Schließen-Aktion

## Hero

- Originalfoto `assets/hero-w211-columbus.jpg`
- `object-fit: cover` mit responsiver Fokusposition
- dunkler Verlauf für weiße Typografie
- semantischer Alternativtext
- Metadaten vor Veröffentlichung entfernt

## Responsive Verhalten

- Breakpoint bei 760 Pixeln
- Filter umbrechen statt horizontal abgeschnitten zu werden
- Schnellstartkarten im Guide sind mobil horizontal wischbar
- Kapitelindex wird zu einer wischbaren Pill-Navigation
- Karten und Dialoge nutzen die verfügbare Höhe
