import { Directory, File } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';
import { dayKey, toLocalIso } from '@/domain/dates';
import { POST_FORMAT, parsePost, type MediaItem, type Place, type Post } from '@/domain/post';
import { ulid } from '@/domain/ulid';
import { migrate } from './db';
import { deleteIfExists, moveTree, readJson, writeJsonAtomic } from './files';
import { dirOf, postDirName, postsDir, rootDir } from './paths';
import { nextMediaNumber, storePhoto, type PickedPhoto } from './photos';
import type { PhotoQuality } from './settings';

export type IndexedPost = { post: Post; dir: string; frame: number };

export type Draft = {
  createdAt: Date;
  text: string;
  tags: string[];
  place: Place | null;
  keep: MediaItem[];
  add: PickedPhoto[];
};

type Row = { json: string; dir: string; frame: number };

const toIndexed = (row: Row): IndexedPost => ({ post: JSON.parse(row.json) as Post, dir: row.dir, frame: row.frame });

const NUMBERED = `(
  SELECT json, dir, day, created_at, id, search,
    ROW_NUMBER() OVER (ORDER BY created_at, id) AS frame
  FROM posts WHERE deleted = 0
)`;

export async function initStorage(db: SQLiteDatabase): Promise<void> {
  await migrate(db);
  const root = rootDir();
  root.create({ intermediates: true, idempotent: true });
  const manifest = new File(root, 'manifest.json');
  if (!manifest.exists) {
    await writeJsonAtomic(root, 'manifest.json', { format: POST_FORMAT, app: 'plenka', createdAt: toLocalIso(new Date()) });
  }
  const count = await db.getFirstAsync<{ n: number; stale: number }>(
    "SELECT COUNT(*) AS n, SUM(search = '' AND deleted = 0) AS stale FROM posts",
  );
  if (!count?.n || count.stale) await rebuildIndex(db);
}

export async function listFeed(db: SQLiteDatabase): Promise<IndexedPost[]> {
  const rows = await db.getAllAsync<Row>(`SELECT json, dir, frame FROM ${NUMBERED} ORDER BY created_at DESC, id DESC`);
  return rows.map(toIndexed);
}

export async function listDays(db: SQLiteDatabase, from: string, to: string): Promise<IndexedPost[]> {
  const rows = await db.getAllAsync<Row>(
    `SELECT json, dir, frame FROM ${NUMBERED} WHERE day BETWEEN ? AND ? ORDER BY created_at, id`,
    from,
    to,
  );
  return rows.map(toIndexed);
}

export async function getPost(db: SQLiteDatabase, id: string): Promise<IndexedPost | null> {
  const row = await db.getFirstAsync<Row>(`SELECT json, dir, frame FROM ${NUMBERED} WHERE id = ?`, id);
  return row ? toIndexed(row) : null;
}

async function getStored(db: SQLiteDatabase, id: string): Promise<{ post: Post; dir: string } | null> {
  const row = await db.getFirstAsync<{ json: string; dir: string }>('SELECT json, dir FROM posts WHERE id = ?', id);
  return row ? { post: JSON.parse(row.json) as Post, dir: row.dir } : null;
}

export async function searchPosts(db: SQLiteDatabase, query: string): Promise<IndexedPost[]> {
  const words = query.toLowerCase().split(/\s+/).map((w) => w.replace(/^#/, '')).filter(Boolean);
  if (words.length === 0) return [];
  const clause = words.map(() => 'search LIKE ?').join(' AND ');
  const params = words.map((w) => `%${w}%`);
  const rows = await db.getAllAsync<Row>(
    `SELECT json, dir, frame FROM ${NUMBERED} WHERE ${clause} ORDER BY created_at DESC LIMIT 200`,
    params,
  );
  return rows.map(toIndexed);
}

export async function listWithCoords(db: SQLiteDatabase): Promise<IndexedPost[]> {
  const rows = await db.getAllAsync<Row>(
    `SELECT json, dir, frame FROM ${NUMBERED} WHERE json_extract(json, '$.place.lat') IS NOT NULL ORDER BY created_at`,
  );
  return rows.map(toIndexed);
}

export async function countPosts(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM posts WHERE deleted = 0');
  return row?.n ?? 0;
}

async function indexPost(db: SQLiteDatabase, post: Post, dir: string): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO posts (id, dir, created_at, day, updated_at, rev, text, tags, search, deleted, json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    post.id,
    dir,
    post.createdAt,
    dayKey(post.createdAt),
    post.updatedAt,
    post.rev,
    post.text,
    post.tags.join(' '),
    [post.text, post.tags.join(' '), post.place?.name ?? ''].join(' ').toLowerCase(),
    post.deleted ? 1 : 0,
    JSON.stringify(post),
  );
}

async function commit(db: SQLiteDatabase, post: Post, dir: string): Promise<void> {
  await writeJsonAtomic(dirOf(dir), 'post.json', post);
  await db.withTransactionAsync(async () => {
    await indexPost(db, post, dir);
    await db.runAsync(
      'INSERT OR REPLACE INTO outbox (post_id, rev, queued_at) VALUES (?, ?, ?)',
      post.id,
      post.rev,
      toLocalIso(new Date()),
    );
  });
}

function removeMedia(dir: Directory, media: MediaItem[]): void {
  for (const m of media) {
    deleteIfExists(new File(dir, m.file));
    deleteIfExists(new File(dir, m.thumb));
  }
}

export async function savePost(
  db: SQLiteDatabase,
  draft: Draft,
  quality: PhotoQuality,
  id?: string,
): Promise<Post> {
  const existing = id ? await getStored(db, id) : null;
  const postId = existing?.post.id ?? ulid();
  const createdAt = toLocalIso(draft.createdAt);
  const dirRel = postDirName(postId, createdAt);
  const dir = dirOf(dirRel);

  if (existing && existing.dir !== dirRel) await moveTree(dirOf(existing.dir), dir);
  else dir.create({ intermediates: true, idempotent: true });

  if (existing) {
    const kept = new Set(draft.keep.map((m) => m.file));
    removeMedia(dir, existing.post.media.filter((m) => !kept.has(m.file)));
  }

  let number = nextMediaNumber(draft.keep);
  const added: MediaItem[] = [];
  for (const photo of draft.add) added.push(await storePhoto(photo, dir, number++, quality));

  const post: Post = {
    format: POST_FORMAT,
    id: postId,
    createdAt,
    updatedAt: toLocalIso(new Date()),
    rev: (existing?.post.rev ?? 0) + 1,
    text: draft.text.trim(),
    tags: draft.tags,
    place: draft.place,
    media: [...draft.keep, ...added],
    deleted: false,
  };
  await commit(db, post, dirRel);
  return post;
}

export async function deletePost(db: SQLiteDatabase, id: string): Promise<void> {
  const existing = await getStored(db, id);
  if (!existing) return;
  removeMedia(dirOf(existing.dir), existing.post.media);
  const post: Post = {
    ...existing.post,
    media: [],
    deleted: true,
    rev: existing.post.rev + 1,
    updatedAt: toLocalIso(new Date()),
  };
  await commit(db, post, existing.dir);
}

type Found = { post: Post; dir: string };

async function collect(dir: Directory, rel: string, out: Found[]): Promise<void> {
  for (const entry of dir.list()) {
    if (entry instanceof Directory) {
      if (entry.name !== 'media' && entry.name !== 'thumbs') await collect(entry, `${rel}/${entry.name}`, out);
    } else if (entry.name === 'post.json') {
      const post = parsePost(await readJson(entry));
      if (post) out.push({ post, dir: rel });
    }
  }
}

export async function rebuildIndex(db: SQLiteDatabase): Promise<number> {
  const found: Found[] = [];
  const posts = postsDir();
  if (posts.exists) await collect(posts, 'posts', found);
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM posts');
    for (const { post, dir } of found) await indexPost(db, post, dir);
  });
  return found.filter((f) => !f.post.deleted).length;
}
