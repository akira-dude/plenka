export const POST_FORMAT = 'plenka/1';

export type PhotoQuality = 'original' | 'visual' | 'compact';

export const QUALITY_ORDER: PhotoQuality[] = ['original', 'visual', 'compact'];
export const COMPACT_SIDE = 1600;

export type MediaType = 'image' | 'video';

export type MediaItem = {
  file: string;
  thumb: string;
  type: MediaType;
  w: number;
  h: number;
  bytes: number;
  sha256: string;
  quality?: PhotoQuality;
  duration?: number;
};

export type Place = {
  name: string;
  lat?: number;
  lon?: number;
};

export type Post = {
  format: typeof POST_FORMAT;
  id: string;
  createdAt: string;
  updatedAt: string;
  rev: number;
  text: string;
  tags: string[];
  place: Place | null;
  media: MediaItem[];
  deleted: boolean;
};

export function mediaQuality(m: MediaItem): PhotoQuality {
  if (m.quality && QUALITY_ORDER.includes(m.quality)) return m.quality;
  if (!m.file.endsWith('.webp')) return 'original';
  return Math.max(m.w, m.h) <= COMPACT_SIDE ? 'compact' : 'visual';
}

export const isLowerQuality = (a: PhotoQuality, b: PhotoQuality) => QUALITY_ORDER.indexOf(a) > QUALITY_ORDER.indexOf(b);

export const isVideo = (m: { type?: string }) => m.type === 'video';

export const needsRecompress = (m: MediaItem, target: PhotoQuality) =>
  !isVideo(m) && isLowerQuality(target, mediaQuality(m));

export function bestQuality(media: MediaItem[]): PhotoQuality | null {
  const ranks = media.filter((m) => !isVideo(m)).map((m) => QUALITY_ORDER.indexOf(mediaQuality(m)));
  return ranks.length ? QUALITY_ORDER[Math.min(...ranks)] : null;
}

export function parsePost(raw: unknown): Post | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Partial<Post>;
  if (p.format !== POST_FORMAT || typeof p.id !== 'string' || typeof p.createdAt !== 'string') return null;
  return {
    format: POST_FORMAT,
    id: p.id,
    createdAt: p.createdAt,
    updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : p.createdAt,
    rev: Number(p.rev) || 1,
    text: typeof p.text === 'string' ? p.text : '',
    tags: Array.isArray(p.tags) ? p.tags.filter((t): t is string => typeof t === 'string') : [],
    place: p.place && typeof p.place.name === 'string' ? p.place : null,
    media: Array.isArray(p.media) ? p.media : [],
    deleted: p.deleted === true,
  };
}

export function mediaSummary(media: { type?: string }[]): string {
  const videos = media.filter(isVideo).length;
  const photos = media.length - videos;
  return [photos ? `${photos} фото` : '', videos ? `${videos} видео` : ''].filter(Boolean).join(', ');
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

const MIME: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  '3gp': 'video/3gpp',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  json: 'application/json',
};

export const mimeOf = (path: string) => MIME[path.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';

export function parseTags(input: string): string[] {
  const tags = input
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#+/, '').trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(tags)];
}
