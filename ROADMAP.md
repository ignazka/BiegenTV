# Roadmap

## Phase 1 – Core MVP

- [ ] PostgreSQL Schema + Prisma Setup
- [ ] File Scanner: NAS-Verzeichnis einlesen, Videos in DB speichern
- [ ] TMDB Metadaten-Enrichment (Poster, Beschreibung)
- [ ] FFmpeg On-demand Transcoding (`transcodeToHLS()`)
- [ ] HLS Stream Route (`/api/stream/[id]`)
- [ ] Browse-Seite (Poster-Grid)
- [ ] Watch-Seite (HLS.js Player)
- [ ] Watch-Progress speichern + beim Start wiederherstellen

## Phase 2 – TV Client

- [ ] LG webOS Developer Mode einrichten
- [ ] Enact.js Projekt-Setup
- [ ] Browse-View mit Spotlight D-Pad Navigation
- [ ] Player-View mit Fernbedienungs-Controls
- [ ] `.ipk` Build + Deploy auf TV/Beamer

## Phase 3 – Nice to have

- [ ] NextAuth.js (Multi-User Support)
- [ ] Pre-transcoding Background Worker (BullMQ)
- [ ] Watchlist
- [ ] Suchfunktion
- [ ] Automatischer File-Watcher (neue Dateien auf NAS erkennen)
