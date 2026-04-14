import { db } from '@/lib/db';
import { transcodeToHLS } from '@/lib/ffmpeg';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const videoMeta = await db.video.findUnique({ where: { id } });

  if (!videoMeta) {
    return Response.json({ message: 'No video found' }, { status: 404 });
  }

  if (!videoMeta.hlsReady) {
    await transcodeToHLS(videoMeta.id, videoMeta.filePath);
    await db.video.update({ where: { id }, data: { hlsReady: true } });
  }

  return Response.redirect(new URL(`/hls/${id}/index.m3u8`, request.url));
}
