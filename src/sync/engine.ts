import { useSyncExternalStore } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';
import NetInfo from '@react-native-community/netinfo';
import { toLocalIso } from '@/domain/dates';
import { parsePost, type Post } from '@/domain/post';
import { deleteIfExists, writeJsonAtomic } from '@/storage/files';
import { dirOf, fileOf } from '@/storage/paths';
import { countPosts, getStored, rebuildIndex } from '@/storage/posts';
import { getLastSyncAt, getWifiOnly, setLastSyncAt } from '@/storage/settings';
import { currentAccount, type Account } from './auth';
import { DriveStore } from './driveStore';
import { parentOf, type CloudStore } from './store';

export type SyncState = {
  account: Account | null;
  running: boolean;
  queued: number;
  done: number;
  total: number;
  lastSyncAt: string | null;
  waitingForWifi: boolean;
  error: string | null;
};

let state: SyncState = {
  account: null,
  running: false,
  queued: 0,
  done: 0,
  total: 0,
  lastSyncAt: null,
  waitingForWifi: false,
  error: null,
};
const listeners = new Set<() => void>();

function update(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}

async function countQueued(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM outbox');
  return row?.n ?? 0;
}

export async function refreshSyncState(db: SQLiteDatabase, account?: Account | null): Promise<void> {
  update({
    account: account === undefined ? await currentAccount().catch(() => null) : account,
    queued: await countQueued(db),
    lastSyncAt: await getLastSyncAt(db),
  });
}

export async function openStore(db: SQLiteDatabase): Promise<CloudStore | null> {
  const account = state.account ?? (await currentAccount().catch(() => null));
  return account ? new DriveStore(db) : null;
}

async function pushPost(db: SQLiteDatabase, store: CloudStore, postId: string): Promise<void> {
  const stored = await getStored(db, postId);
  if (!stored) return;
  const { post, dir } = stored;
  const previous = await db.getFirstAsync<{ dir: string }>('SELECT dir FROM synced_posts WHERE post_id = ?', postId);

  if (post.deleted) {
    for (const d of new Set([dir, previous?.dir].filter((x): x is string => Boolean(x)))) await store.removeTree(d);
    await db.runAsync('DELETE FROM synced_posts WHERE post_id = ?', postId);
    return;
  }

  if (previous && previous.dir !== dir) await store.removeTree(previous.dir);

  const keep = new Set<string>();
  for (const m of post.media) {
    const media = `${dir}/${m.file}`;
    const thumb = `${dir}/${m.thumb}`;
    keep.add(media);
    keep.add(thumb);
    await store.putFile(media, m.sha256);
    await store.putFile(thumb, null);
  }
  await store.pruneMedia(dir, keep);
  await store.putText(`${dir}/post.json`, await fileOf(dir, 'post.json').text());
  await markSynced(db, store, post, dir);
}

async function markSynced(db: SQLiteDatabase, store: CloudStore, post: Post, dir: string): Promise<void> {
  for (const m of post.media) await store.markStored(`${dir}/${m.file}`, m.sha256);
  await db.runAsync('INSERT OR REPLACE INTO synced_posts (post_id, dir, rev) VALUES (?, ?, ?)', post.id, dir, post.rev);
  await db.runAsync('DELETE FROM outbox WHERE post_id = ? AND rev <= ?', post.id, post.rev);
}

async function resetRemote(db: SQLiteDatabase, store: CloudStore): Promise<void> {
  const now = toLocalIso(new Date());
  await store.reset();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM synced_posts');
    await db.runAsync('INSERT OR IGNORE INTO outbox (post_id, rev, queued_at) SELECT id, rev, ? FROM posts', now);
  });
}

export async function syncNow(db: SQLiteDatabase, options: { ignoreWifi?: boolean } = {}): Promise<void> {
  if (state.running) return;
  const account = state.account ?? (await currentAccount().catch(() => null));
  if (!account) {
    await refreshSyncState(db, null);
    return;
  }
  const net = await NetInfo.fetch();
  if (!net.isConnected) return;
  if (!options.ignoreWifi && net.type !== 'wifi' && (await getWifiOnly(db))) {
    update({ waitingForWifi: true, queued: await countQueued(db) });
    return;
  }

  const queue = await db.getAllAsync<{ post_id: string; rev: number }>(
    'SELECT post_id, rev FROM outbox ORDER BY queued_at',
  );
  update({ account, running: true, waitingForWifi: false, error: null, done: 0, total: queue.length });

  const store: CloudStore = new DriveStore(db);
  try {
    await store.ensureRoot();
    for (const item of queue) {
      try {
        await pushPost(db, store, item.post_id);
      } catch (e) {
        if (store.isRootGone(e)) {
          await resetRemote(db, store);
          throw new Error(
            `Папка «Плёнка» в ${store.label} изменилась снаружи. Всё будет отправлено заново при следующей синхронизации.`,
          );
        }
        throw e;
      }
      await db.runAsync('DELETE FROM outbox WHERE post_id = ? AND rev = ?', item.post_id, item.rev);
      update({ done: state.done + 1, queued: Math.max(0, state.queued - 1) });
    }
    await setLastSyncAt(db, toLocalIso(new Date()));
  } catch (e) {
    update({ error: store.describe(e) });
  } finally {
    update({ running: false });
    await refreshSyncState(db, account);
  }
}

export async function resendAll(db: SQLiteDatabase): Promise<void> {
  const store = await openStore(db);
  if (!store) return;
  await resetRemote(db, store);
  await syncNow(db, { ignoreWifi: true });
}

export async function syncedRev(db: SQLiteDatabase, postId: string): Promise<number | null> {
  const row = await db.getFirstAsync<{ rev: number }>('SELECT rev FROM synced_posts WHERE post_id = ?', postId);
  return row?.rev ?? null;
}

export type MergeResult = { pulled: number; queued: number; total: number };

type Local = { post: Post; dir: string };

async function pullPost(store: CloudStore, remote: Post, dir: string, local: Local | null): Promise<void> {
  if (local && local.dir !== dir && dirOf(local.dir).exists) dirOf(local.dir).delete();
  const target = dirOf(dir);
  target.create({ intermediates: true, idempotent: true });
  const here = local && local.dir === dir ? local.post.media : [];
  const sameSha = new Map(here.map((m) => [m.file, m.sha256]));
  const wanted = new Set(remote.media.flatMap((m) => [m.file, m.thumb]));
  for (const m of here) {
    if (!wanted.has(m.file)) deleteIfExists(fileOf(dir, m.file));
    if (!wanted.has(m.thumb)) deleteIfExists(fileOf(dir, m.thumb));
  }
  for (const m of remote.media) {
    const changed = sameSha.get(m.file) !== m.sha256;
    if (changed) deleteIfExists(fileOf(dir, m.file));
    const thumb = fileOf(dir, m.thumb);
    if (changed || !thumb.exists) await store.download(`${dir}/${m.thumb}`, thumb);
  }
  await writeJsonAtomic(target, 'post.json', remote);
}

async function readRemotePost(store: CloudStore, path: string): Promise<Post | null> {
  try {
    return parsePost(JSON.parse(await store.readText(path)));
  } catch {
    return null;
  }
}

export async function mergeFromCloud(
  db: SQLiteDatabase,
  onProgress: (done: number, total: number) => void,
): Promise<MergeResult | null> {
  const store = await openStore(db);
  if (!store) throw new Error('Облако не подключено.');
  if (!(await store.hasRoot())) return null;

  const files = await store.listFiles();
  const postFiles = files.filter((p) => p.startsWith('posts/') && p.endsWith('/post.json'));
  const remoteRevs = new Map<string, number>();
  let pulled = 0;
  let done = 0;
  onProgress(done, postFiles.length);

  for (const path of postFiles) {
    const dir = parentOf(path);
    const remote = await readRemotePost(store, path);
    if (remote && !remote.deleted) {
      remoteRevs.set(remote.id, Math.max(remote.rev, remoteRevs.get(remote.id) ?? 0));
      const local = await getStored(db, remote.id);
      if (!local || local.post.rev < remote.rev || (local.post.rev === remote.rev && local.dir !== dir)) {
        await pullPost(store, remote, dir, local);
        pulled++;
      }
      if (!local || local.post.rev <= remote.rev) await markSynced(db, store, remote, dir);
    }
    onProgress(++done, postFiles.length);
  }

  await rebuildIndex(db);

  const now = toLocalIso(new Date());
  const locals = await db.getAllAsync<{ id: string; rev: number; deleted: number }>('SELECT id, rev, deleted FROM posts');
  let queued = 0;
  for (const p of locals) {
    const remoteRev = remoteRevs.get(p.id);
    const needsPush = remoteRev === undefined ? !p.deleted : p.rev > remoteRev;
    if (!needsPush) continue;
    await db.runAsync('DELETE FROM synced_posts WHERE post_id = ? AND rev < ?', p.id, p.rev);
    await db.runAsync('INSERT OR IGNORE INTO outbox (post_id, rev, queued_at) VALUES (?, ?, ?)', p.id, p.rev, now);
    queued++;
  }

  await refreshSyncState(db);
  if (queued > 0) void syncNow(db);
  return { pulled, queued, total: await countPosts(db) };
}

export function mergeSummary(result: MergeResult | null): string {
  if (!result) return 'В облаке не нашлось папки «Плёнка».';
  return [
    `Скачано из облака: ${result.pulled}.`,
    result.queued > 0 ? `Отправится в облако: ${result.queued}.` : '',
    `Всего записей: ${result.total}.`,
  ]
    .filter(Boolean)
    .join(' ');
}
