import { spawn } from 'child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Transkodiert eine Videodatei zu HLS-Segmenten via FFmpeg.
 * Idempotent: wird übersprungen wenn das Manifest bereits existiert.
 *
 * @param videoId - UUID des Videos (wird als Ordnername unter public/hls/ verwendet)
 * @param filePath - Absoluter Pfad zur Quelldatei (z.B. /mnt/nas/film.mkv)
 */
export async function transcodeToHLS(videoId: string, filePath: string) {
  const outputDir = path.join(process.cwd(), 'public', 'hls', videoId);
  const manifestPath = path.join(outputDir, 'index.m3u8');

  // Bereits transkodiert – nichts zu tun
  if (fs.existsSync(manifestPath)) return;

  // Ausgabeverzeichnis anlegen (inkl. aller Zwischenverzeichnisse)
  fs.mkdirSync(outputDir, { recursive: true });

  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i',
      filePath, // Eingabedatei
      '-c:v',
      'libx264', // Video zu H.264 (browserkompatibel)
      '-c:a',
      'aac', // Audio zu AAC
      '-hls_time',
      '6', // Segmentlänge in Sekunden
      '-hls_playlist_type',
      'vod', // Statische Playlist (kein Live-Stream)
      '-hls_segment_filename',
      path.join(outputDir, 'segment%03d.ts'), // segment000.ts, segment001.ts, ...
      manifestPath, // Output: index.m3u8
    ]);

    // FFmpeg ist fertig – exit code 0 = Erfolg, alles andere = Fehler
    ffmpeg.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`FFmpeg failed: ${code}`)),
    );

    // Prozess konnte nicht gestartet werden (z.B. ffmpeg nicht installiert)
    ffmpeg.on('error', reject);
  });
}
