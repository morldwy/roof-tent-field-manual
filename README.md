# Scandinavian Field Manual · Wild Spots

Eine mobile Karte für ruhige Naturorte rund um Tröndel – mit Landschaftsfiltern,
Pkw-Zufahrt, Navigation und bewusst strenger rechtlicher Ampel. Jeder Spot hat
eine Detailansicht, eine persönliche 5-Sterne-Bewertung sowie Kommentare mit
Zeitstempel und Foto-Uploads.

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
