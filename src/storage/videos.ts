import { Directory, File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { createVideoPlayer } from 'expo-video';
import type { MediaItem } from '@/domain/post';
import { THUMB_QUALITY, THUMB_SIDE, type PickedMedia } from './photos';

const EXTENSIONS: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/3gpp': '3gp',
  'video/webm': 'webm',
  'video/x-matroska': 'mkv',
};

function videoExtension(video: PickedMedia): string {
  if (video.mimeType && EXTENSIONS[video.mimeType]) return EXTENSIONS[video.mimeType];
  const ext = video.uri.split('?')[0].split('.').pop()?.toLowerCase();
  return ext && ext.length <= 4 ? ext : 'mp4';
}

async function writeFrame(uri: string, seconds: number, target: File): Promise<{ width: number; height: number }> {
  const player = createVideoPlayer(uri);
  try {
    const at = Math.min(1, seconds / 3);
    const [frame] = await player.generateThumbnailsAsync(at, { maxWidth: THUMB_SIDE, maxHeight: THUMB_SIDE });
    const image = await ImageManipulator.manipulate(frame).renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.WEBP, compress: THUMB_QUALITY });
    const size = { width: image.width, height: image.height };
    image.release();
    await new File(saved.uri).move(target, { overwrite: true });
    return size;
  } finally {
    player.release();
  }
}

export async function storeVideo(video: PickedMedia, postDir: Directory, number: number): Promise<MediaItem> {
  const base = String(number).padStart(2, '0');
  const mediaDir = new Directory(postDir, 'media');
  const thumbsDir = new Directory(postDir, 'thumbs');
  mediaDir.create({ intermediates: true, idempotent: true });
  thumbsDir.create({ intermediates: true, idempotent: true });

  const target = new File(mediaDir, `${base}.${videoExtension(video)}`);
  await new File(video.uri).copy(target, { overwrite: true });

  const duration = Math.round((video.duration ?? 0) * 10) / 10;
  const thumb = new File(thumbsDir, `${base}.webp`);
  const frame = await writeFrame(target.uri, duration, thumb);

  const long = Math.max(video.width, video.height, frame.width, frame.height);
  const short = Math.min(video.width, video.height) || Math.min(frame.width, frame.height);
  const portrait = frame.height > frame.width;

  return {
    file: `media/${target.name}`,
    thumb: `thumbs/${thumb.name}`,
    type: 'video',
    w: portrait ? short : long,
    h: portrait ? long : short,
    bytes: target.size,
    sha256: await target.digest('SHA-256'),
    duration,
  };
}
