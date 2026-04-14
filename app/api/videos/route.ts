import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'node:path';
import { generateFullPosterPath, searchMovies } from '@/lib/tmdb';

const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov'];

function cleanFilename(filename: string): string {
  return path
    .basename(filename, path.extname(filename))
    .replace(/[\._]/g, ' ') // Punkte und Underscores → Leerzeichen
    .replace(/\(?\d{4}\)?/, '') // Jahreszahl entfernen
    .replace(/\s+/g, ' ')
    .trim();
}

export async function GET() {
  const videos = await db.video.findMany();
  return Response.json(videos);
}

export async function POST(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const action = searchParams.get('action');

  if (action !== 'scan') {
    return Response.json({ error: 'Unknown action' }, { status: 400 });
  }

  const nasPath = process.env.NAS_MOUNT_PATH;
  if (!nasPath) {
    return Response.json({ error: 'NAS_MOUNT_PATH not set' }, { status: 500 });
  }

  const files = fs
    .readdirSync(nasPath)
    .filter((f) => VIDEO_EXTENSIONS.includes(path.extname(f).toLowerCase()));

  if (files.length === 0) {
    return Response.json(
      { message: 'No video files found', scanned: 0 },
      { status: 200 },
    );
  }

  const results = await Promise.allSettled(
    files.map(async (file) => {
      const filePath = path.join(nasPath, file);
      const query = cleanFilename(file);
      const tmdb = await searchMovies(query);

      return db.video.upsert({
        where: { filePath },
        update: {
          title: tmdb?.title ?? query,
          tmdbId: tmdb?.id ?? null,
          poster: tmdb?.poster_path
            ? generateFullPosterPath(tmdb.poster_path)
            : null,
          overview: tmdb?.overview ?? null,
          release_date: tmdb?.release_date?.slice(0, 4) ?? null,
        },
        create: {
          filePath,
          title: tmdb?.title ?? query,
          tmdbId: tmdb?.id ?? null,
          poster: tmdb?.poster_path
            ? generateFullPosterPath(tmdb.poster_path)
            : null,
          overview: tmdb?.overview ?? null,
          release_date: tmdb?.release_date?.slice(0, 4) ?? null,
        },
      });
    }),
  );

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  return Response.json({ scanned: files.length, succeeded, failed });
}
