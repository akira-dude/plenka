import type { File } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { MediaItem, Post } from '@/domain/post';
import { deleteIfExists } from '@/storage/files';
import { fileOf, mediaUri } from '@/storage/paths';
import { openStore } from './engine';

let version = 0;
const listeners = new Set<() => void>();
const pending = new Map<string, Promise<boolean>>();

function changed() {
  version++;
  listeners.forEach((l) => l());
}

export const mediaVersion = () => version;

export function subscribeMedia(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const hasOriginal = (dir: string, m: MediaItem) => fileOf(dir, m.file).exists;

export function fetchOriginal(db: SQLiteDatabase, dir: string, m: MediaItem): Promise<boolean> {
  if (hasOriginal(dir, m)) return Promise.resolve(true);
  const path = `${dir}/${m.file}`;
  const running = pending.get(path);
  if (running) return running;
  const task = openStore(db)
    .then((store) => (store ? store.download(path, fileOf(dir, m.file)) : false))
    .catch(() => false)
    .finally(() => {
      pending.delete(path);
      changed();
    });
  pending.set(path, task);
  return task;
}

export async function originalUri(db: SQLiteDatabase, dir: string, m: MediaItem): Promise<string> {
  if (await fetchOriginal(db, dir, m)) return mediaUri(dir, m.file);
  throw new Error('Полное фото хранится только в облаке, а скачать его сейчас не получилось. Проверь интернет.');
}

export type Freeable = { files: File[]; bytes: number };

export async function findFreeable(db: SQLiteDatabase, before: string | null): Promise<Freeable> {
  const store = await openStore(db);
  const result: Freeable = { files: [], bytes: 0 };
  if (!store) return result;
  const rows = await db.getAllAsync<{ json: string; dir: string }>(
    `SELECT p.json, p.dir FROM posts p
     JOIN synced_posts s ON s.post_id = p.id AND s.rev = p.rev
     WHERE p.deleted = 0 AND p.id NOT IN (SELECT post_id FROM outbox) AND (? IS NULL OR p.created_at < ?)`,
    before,
    before,
  );
  for (const row of rows) {
    const post = JSON.parse(row.json) as Post;
    for (const m of post.media) {
      const file = fileOf(row.dir, m.file);
      if (!file.exists || !(await store.hasCopy(`${row.dir}/${m.file}`, m.sha256))) continue;
      result.files.push(file);
      result.bytes += file.size;
    }
  }
  return result;
}

export function freeOriginals(files: File[]): void {
  files.forEach(deleteIfExists);
  changed();
}
