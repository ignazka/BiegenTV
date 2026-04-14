# CLAUDE.md

## Stack

- **Framework:** Next.js 15 (App Router), React, TypeScript
- **DB:** PostgreSQL via Prisma ORM
- **Paketmanager:** pnpm
- **Transcoding:** FFmpeg (CLI, via `child_process`)
- **Streaming:** HLS – `.m3u8` Manifeste + `.ts` Segmente, Player via HLS.js
- **Metadaten:** TMDB API
- **Auth:** NextAuth.js (noch nicht implementiert)

## Projektstruktur

```
app/
  api/
    videos/route.ts       # CRUD + TMDB-Enrichment
    stream/[id]/route.ts  # HLS-Manifest triggern + redirecten
    progress/route.ts     # Watch-Position upsert
  browse/page.tsx
  watch/[id]/page.tsx
lib/
  ffmpeg.ts               # transcodeToHLS() – on-demand, idempotent
  tmdb.ts                 # fetchMovieMetadata()
  db.ts                   # Prisma singleton
prisma/schema.prisma
public/hls/               # generierte Chunks – gitignored
webos-app/                # Phase 2: LG webOS Thin Client
```

## Datenbank-Schema (Prisma)

```prisma
model Video {
  id        String   @id @default(uuid())
  filePath  String   @unique
  title     String
  tmdbId    Int?
  poster    String?
  overview  String?
  hlsReady  Boolean  @default(false)
  createdAt DateTime @default(now())
  progress  WatchProgress[]
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  progress  WatchProgress[]
}

model WatchProgress {
  id        String   @id @default(uuid())
  userId    String
  videoId   String
  positionS Int
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id])
  video     Video    @relation(fields: [videoId], references: [id])
  @@unique([userId, videoId])
}
```

## Konventionen

- pnpm überall – kein npm oder yarn
- Prisma Client als Singleton in `lib/db.ts`
- API Routes geben `Response.json()` zurück (nicht `NextResponse`)
- HLS-Chunks liegen unter `public/hls/{videoId}/index.m3u8`
- Transcoding ist idempotent: `transcodeToHLS()` prüft ob Manifest existiert, bevor FFmpeg startet
- `positionS` als `Int` (Sekunden) – Float-Präzision unnötig für Seeking-UX
- Umgebungsvariablen: `DATABASE_URL`, `TMDB_API_KEY`, `NAS_MOUNT_PATH`

## Wichtige Entscheidungen

- **On-demand Transcoding** statt Pre-transcoding: Wartezeit beim ersten Abruf wird akzeptiert, dafür kein Speicher-Overhead. `hlsReady`-Flag trackt den Status.
- **HLS statt Raw-MP4**: Browserkompatibilität bei gemischten Formaten (mkv, avi), effizientes Seeking via Chunks.
- **webOS-App ist Thin Client**: Ruft nur die Next.js API auf, kein eigenes Backend.

## Lern-Workflow

Dieses Projekt wird als Lernprojekt schrittweise aufgebaut:
1. Claude erklärt den nächsten Schritt + Hintergrund
2. User implementiert selbst
3. Claude reviewed und gibt Feedback
4. Learnings werden in `LEARNINGS.md` festgehalten

### Format für LEARNINGS.md
- Ein Abschnitt pro Schritt: `## Schritt N – Titel (Dateiname)`
- Erst nach Abschluss des Schritts schreiben, nicht vorher
- Inhalt: was gelernt wurde + warum, nicht nur was gemacht wurde
- Code-Beispiele für nicht-offensichtliche Patterns
- Stolperstellen und Korrekturen festhalten (z.B. falsche Annahmen, Tippfehler mit Konsequenzen)
- Kein Fließtext-Essay – kurze, scanbare Abschnitte mit Überschriften

## Aktueller Stand & nächste Schritte

### Fertig
- [x] Next.js Projekt-Setup
- [x] `prisma/schema.prisma` – Models: Video, User, WatchProgress
- [x] DB-Migration + Prisma Client generiert
- [x] `lib/db.ts` – Prisma Singleton mit `@prisma/adapter-pg`
- [x] `lib/tmdb.ts` – `searchMovies()` + `generateFullPosterPath()`
- [x] `lib/ffmpeg.ts` – `transcodeToHLS()` via `spawn`
- [x] `app/api/videos/route.ts` – GET (list) + POST (NAS scan + TMDB enrichment)
- [x] `app/api/stream/[id]/route.ts` – on-demand transcoding + redirect zu .m3u8

### Offen (Phase 1)
- [ ] **Schritt 7:** `app/api/progress/route.ts` – GET + POST Watch-Position
- [ ] **Schritt 8:** `app/browse/page.tsx` – Poster-Grid (Server Component)
- [ ] **Schritt 9:** `app/watch/[id]/page.tsx` + `VideoPlayer.tsx` – HLS.js Player (Client Component)

### Offen (Phase 2+)
- [ ] LG webOS TV-Client (`webos-app/`)
- [ ] NextAuth.js Multi-User
- [ ] Pre-transcoding Background Worker (BullMQ)
- [ ] Suchfunktion, Watchlist, File-Watcher
