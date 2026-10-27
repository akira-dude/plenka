import { Directory, File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { COMPACT_SIDE, type MediaItem, type PhotoQuality } from '@/domain/post';
import { deleteIfExists } from './files';

export type PickedPhoto = {
  uri: string;
  width: number;
  height: number;
  mimeType?: string;
  exif?: Record<string, unknown> | null;
};

const THUMB_SIDE = 640;
const VISUAL_QUALITY = 0.9;
const COMPACT_QUALITY = 0.85;
const THUMB_QUALITY = 0.8;

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

function originalExtension(photo: PickedPhoto): string {
  if (photo.mimeType && EXTENSIONS[photo.mimeType]) return EXTENSIONS[photo.mimeType];
  const ext = photo.uri.split('?')[0].split('.').pop()?.toLowerCase();
  return ext && ext.length <= 4 ? ext : 'jpg';
}

const mediaNumber = (file: string) => Number(file.match(/(\d+)\.\w+$/)?.[1] ?? 0);

export function nextMediaNumber(media: MediaItem[]): number {
  return Math.max(0, ...media.map((m) => mediaNumber(m.file))) + 1;
}

export async function storePhoto(
  photo: PickedPhoto,
  postDir: Directory,
  number: number,
  quality: PhotoQuality,
): Promise<MediaItem> {
  const base = String(number).padStart(2, '0');
  const mediaDir = new Directory(postDir, 'media');
  const thumbsDir = new Directory(postDir, 'thumbs');
  mediaDir.create({ intermediates: true, idempotent: true });
  thumbsDir.create({ intermediates: true, idempotent: true });

  let image = await ImageManipulator.manipulate(photo.uri).renderAsync();
  if (quality === 'compact' && Math.max(image.width, image.height) > COMPACT_SIDE) {
    const context = ImageManipulator.manipulate(image);
    context.resize(image.width >= image.height ? { width: COMPACT_SIDE } : { height: COMPACT_SIDE });
    const resized = await context.renderAsync();
    image.release();
    image = resized;
  }
  const { width, height } = image;

  let target: File;
  if (quality === 'original') {
    target = new File(mediaDir, `${base}.${originalExtension(photo)}`);
    await new File(photo.uri).copy(target, { overwrite: true });
  } else {
    const saved = await image.saveAsync({
      format: SaveFormat.WEBP,
      compress: quality === 'compact' ? COMPACT_QUALITY : VISUAL_QUALITY,
    });
    target = new File(mediaDir, `${base}.webp`);
    await new File(saved.uri).move(target, { overwrite: true });
  }

  const thumbContext = ImageManipulator.manipulate(image);
  if (Math.max(width, height) > THUMB_SIDE) {
    thumbContext.resize(width >= height ? { width: THUMB_SIDE } : { height: THUMB_SIDE });
  }
  const thumbImage = await thumbContext.renderAsync();
  const thumbSaved = await thumbImage.saveAsync({ format: SaveFormat.WEBP, compress: THUMB_QUALITY });
  const thumb = new File(thumbsDir, `${base}.webp`);
  await new File(thumbSaved.uri).move(thumb, { overwrite: true });

  image.release();
  thumbImage.release();

  return {
    file: `media/${target.name}`,
    thumb: `thumbs/${thumb.name}`,
    type: 'image',
    w: width,
    h: height,
    bytes: target.size,
    sha256: await target.digest('SHA-256'),
    quality,
  };
}

export async function recompressPhoto(postDir: Directory, item: MediaItem, quality: PhotoQuality): Promise<MediaItem> {
  const source = new File(postDir, item.file);
  const next = await storePhoto(
    { uri: source.uri, width: item.w, height: item.h },
    postDir,
    mediaNumber(item.file),
    quality,
  );
  if (next.file !== item.file) deleteIfExists(source);
  return next;
}
