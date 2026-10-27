export const POST_FORMAT = 'plenka/1';

export type PhotoQuality = 'original' | 'visual' | 'compact';

export const QUALITY_ORDER: PhotoQuality[] = ['original', 'visual', 'compact'];
export const COMPACT_SIDE = 1600;

export type MediaItem = {
  file: string;
  thumb: string;
  type: 'image';
  w: number;
  h: number;
  bytes: number;
  sha256: string;
  quality?: PhotoQuality;
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

export function bestQuality(media: MediaItem[]): PhotoQuality | null {
  const ranks = media.map((m) => QUALITY_ORDER.indexOf(mediaQuality(m)));
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

export function parseTags(input: string): string[] {
  const tags = input
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#+/, '').trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(tags)];
}
