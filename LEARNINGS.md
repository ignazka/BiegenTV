# Learnings

## Projektübersicht – Phase 1 Schritte

| Schritt | Datei | Was |
|---|---|---|
| 1 | `prisma/schema.prisma` | Datenbank-Models definieren |
| 2 | `lib/db.ts` | Prisma Singleton |
| 3 | `lib/tmdb.ts` | TMDB API – Filmmetadaten abrufen |
| 4 | `lib/ffmpeg.ts` | FFmpeg – Video zu HLS transkodieren |
| 5 | `app/api/videos/route.ts` | Videos listen + NAS scannen |
| 6 | `app/api/stream/[id]/route.ts` | HLS-Stream triggern + weiterleiten |
| 7 | `app/api/progress/route.ts` | Watch-Position speichern + lesen |
| 8 | `app/browse/page.tsx` | Poster-Grid |
| 9 | `app/watch/[id]/page.tsx` + `VideoPlayer.tsx` | HLS.js Player |

---

## Schritt 0 – Next.js Projekt-Setup

### `--no-src-dir`
Next.js bietet optional einen `src/`-Ordner zur Trennung von App-Code und Konfigurationsdateien. Mit `--no-src-dir` liegt alles direkt im Root (`app/`, `lib/`, etc.). Bei kleinen Projekten ist `src/` eher Overhead.

### `--import-alias "@/*"`
Konfiguriert einen Pfad-Alias damit statt langer relativer Imports:
```ts
import { db } from "../../../lib/db"
```
kürzere absolute Imports möglich sind:
```ts
import { db } from "@/lib/db"
```
`@` ist ein Alias für das Projekt-Root. Der Alias wird in `tsconfig.json` unter `compilerOptions.paths` konfiguriert und von TypeScript und Next.js gemeinsam aufgelöst.

---

## Schritt 1 – Prisma Schema (`prisma/schema.prisma`)

In Prisma 7 ist die Konfiguration aufgeteilt:
- `prisma/schema.prisma` – Models und Generator
- `prisma.config.ts` – Datenbankverbindung via `defineConfig`, DATABASE_URL kommt aus `.env` via `dotenv`

### Generator
```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}
```
`output` definiert wo der TypeScript-Client generiert wird.

### Zwei getrennte Befehle
- `pnpm prisma migrate dev --name init` – erstellt die SQL-Migrationsdatei und führt sie gegen die DB aus
- `pnpm prisma generate` – generiert den TypeScript-Client unter `generated/prisma/`

### Schema erweitern
Neues Feld zum Schema hinzufügen → neue Migration:
```bash
pnpm prisma migrate dev --name add-release-date
pnpm prisma generate
```
Prisma geht immer vorwärts – kein Rollback, stattdessen neue Migration die den Zustand korrigiert.

### `@@unique` vs. `@id`
`@@unique([userId, videoId])` auf `WatchProgress` stellt sicher dass ein User pro Video nur einen Eintrag haben kann. `@id` bleibt trotzdem da, weil APIs und Joins eine einzelne eindeutige ID pro Zeile erwarten.

---

## Schritt 2 – Prisma Singleton (`lib/db.ts`)

Next.js führt in Development bei jedem Hot-Reload Modulcode neu aus. Ohne Singleton würde jedes Mal eine neue DB-Verbindung geöffnet. Lösung: Client auf `globalThis` speichern – der wird beim Hot-Reload nicht zurückgesetzt.

```ts
const globalForPrisma = globalThis as { prisma: PrismaClient | undefined };
export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

In Production kein `globalThis`-Trick nötig – dort gibt es kein Hot-Reload.

### Prisma Adapter (v7)
Prisma 7 verwendet explizite Datenbank-Adapter statt eingebauter Treiber:
```bash
pnpm add @prisma/adapter-pg
```
```ts
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
new PrismaClient({ adapter });
```

---

## Schritt 3 – TMDB API (`lib/tmdb.ts`)

`fetch` ist in Next.js/Node.js eingebaut – kein axios oder anderes Package nötig.

```ts
const res = await fetch(url);
const data = await res.json();
```

TMDB gibt `{ results: Movie[] }` zurück – erstes Ergebnis mit `data.results?.[0] ?? null` holen.

`encodeURIComponent(title)` ist wichtig damit Leerzeichen und Sonderzeichen in Filmtiteln korrekt in der URL kodiert werden.

Early Return wenn API Key fehlt – besser als einen 401 von der API zu debuggen:
```ts
if (!process.env.TMDB_API_KEY) return null;
```

`path.join` nicht für URLs verwenden – auf Windows entstehen Backslashes. Stattdessen String-Konkatenation:
```ts
return `https://image.tmdb.org/t/p/w500${poster_path}`;
```

---

## Schritt 4 – FFmpeg (`lib/ffmpeg.ts`)

FFmpeg wird nicht als npm-Paket importiert sondern als externer CLI-Prozess gestartet. Dafür gibt es `spawn` aus dem eingebauten `child_process`-Modul.

Jedes FFmpeg-Argument muss ein eigener String im Array sein:
```ts
spawn("ffmpeg", ["-i", filePath, "-c:v", "libx264", ...])
```

`spawn` gibt kein Promise zurück – man muss selbst eines bauen und auf den `close`-Event warten:
```ts
await new Promise<void>((resolve, reject) => {
  const proc = spawn("ffmpeg", [...args]);
  proc.on("close", (code) => code === 0 ? resolve() : reject(...));
  proc.on("error", reject); // falls der Prozess gar nicht startet
});
```

`process.cwd()` gibt das Root-Verzeichnis des laufenden Node-Prozesses zurück – damit baut man den Output-Pfad unabhängig vom Arbeitsverzeichnis.

`fs.mkdirSync(dir, { recursive: true })` erstellt alle Zwischenverzeichnisse automatisch.

---

## Schritt 5 – Videos API (`app/api/videos/route.ts`)

### API Routes im App Router
Eine API Route ist eine `route.ts`-Datei mit exportierten Funktionen benannt nach HTTP-Methoden:
```ts
export async function GET() { ... }
export async function POST(request: Request) { ... }
```

`Response.json()` statt `NextResponse.json()` – `NextResponse` nur wenn Cookies oder Headers manipuliert werden müssen.

### upsert
Kombiniert insert und update – legt an falls nicht vorhanden, updatet falls vorhanden:
```ts
db.video.upsert({
  where: { filePath },
  create: { filePath, title, ... },
  update: { title, ... },
})
```

### Promise.allSettled
Führt mehrere async-Operationen parallel aus und wartet auf alle – auch wenn einzelne fehlschlagen:
```ts
const results = await Promise.allSettled(files.map(async (file) => { ... }));
const succeeded = results.filter((r) => r.status === "fulfilled").length;
```

---

## Schritt 6 – Stream API (`app/api/stream/[id]/route.ts`)

Dynamische Segmente in Route-Parametern. In Next.js 15 ist `params` ein Promise:
```ts
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
}
```

Redirect zu einer statischen Datei – `request.url` als Basis nötig:
```ts
return Response.redirect(new URL(`/hls/${id}/index.m3u8`, request.url));
```

DB-Felder müssen in der DB aktualisiert werden, nicht nur im lokalen Objekt:
```ts
// falsch – ändert nur den lokalen JS-Wert
videoMeta.hlsReady = true;

// richtig
await db.video.update({ where: { id }, data: { hlsReady: true } });
```
