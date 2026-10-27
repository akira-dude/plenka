import { useSyncExternalStore } from 'react';
import { Directory, File } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';
import NetInfo from '@react-native-community/netinfo';
import { toLocalIso } from '@/domain/dates';
import { fileOf, rootDir } from '@/storage/paths';
import { getStored, listFeed, rebuildIndex } from '@/storage/posts';
import { getLastSyncAt, getWifiOnly, setLastSyncAt } from '@/storage/settings';
import { accessToken, currentAccount, dropToken, type Account } from './auth';
import { DriveError, FOLDER_MIME, createDrive, type Drive } from './drive';

const ROOT_FOLDER = 'Плёнка';

const MIME: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
};

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

function makeDrive(): Drive {
  return createDrive({
    get: async () => {
      const token = await accessToken();
      if (!token) throw new Error('Google Drive не подключён.');
      return token;
    },
    drop: dropToken,
  });
}

const mimeOf = (path: string) => MIME[path.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
const parentOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
const nameOf = (path: string) => path.slice(path.lastIndexOf('/') + 1);

type Mapping = { drive_id: string; sha256: string | null };

class Remote {
  constructor(
    private db: SQLiteDatabase,
    readonly drive: Drive,
  ) {}

  mapping(path: string): Promise<Mapping | null> {
    return this.db.getFirstAsync<Mapping>('SELECT drive_id, sha256 FROM drive_files WHERE path = ?', path);
  }

  async remember(path: string, driveId: string, sha256: string | null = null): Promise<void> {
    await this.db.runAsync(
      'INSERT OR REPLACE INTO drive_files (path, drive_id, sha256) VALUES (?, ?, ?)',
      path,
      driveId,
      sha256,
    );
  }

  async forgetTree(path: string): Promise<void> {
    await this.db.runAsync(
      'DELETE FROM drive_files WHERE path = ? OR substr(path, 1, ?) = ?',
      path,
      path.length + 1,
      `${path}/`,
    );
  }

  async rootId(create: boolean): Promise<string | null> {
    const known = await this.mapping('');
    if (known) return known.drive_id;
    const found = await this.drive.findChild('root', ROOT_FOLDER, true);
    const id = found?.id ?? (create ? await this.drive.createFolder('root', ROOT_FOLDER) : null);
    if (id) await this.remember('', id);
    return id;
  }

  async folderId(path: string): Promise<string> {
    if (path === '') return (await this.rootId(true))!;
    const known = await this.mapping(path);
    if (known) return known.drive_id;
    const parentId = await this.folderId(parentOf(path));
    const found = await this.drive.findChild(parentId, nameOf(path), true);
    const id = found?.id ?? (await this.drive.createFolder(parentId, nameOf(path)));
    await this.remember(path, id);
    return id;
  }

  private async existingId(path: string, parentId: string, known: Mapping | null): Promise<string | undefined> {
    if (known) return known.drive_id;
    return (await this.drive.findChild(parentId, nameOf(path), false))?.id;
  }

  async putFile(path: string, sha256: string | null): Promise<void> {
    const known = await this.mapping(path);
    if (known && (sha256 === null || known.sha256 === sha256)) return;
    const parentId = await this.folderId(parentOf(path));
    const id = await this.drive.uploadFile(
      new File(rootDir(), path),
      nameOf(path),
      parentId,
      mimeOf(path),
      await this.existingId(path, parentId, known),
    );
    await this.remember(path, id, sha256);
  }

  async putText(path: string, text: string): Promise<void> {
    const known = await this.mapping(path);
    const parentId = await this.folderId(parentOf(path));
    const id = await this.drive.uploadText(text, nameOf(path), parentId, await this.existingId(path, parentId, known));
    await this.remember(path, id);
  }

  async trashTree(path: string): Promise<void> {
    const known = await this.mapping(path);
    if (known) await this.drive.trash(known.drive_id);
    await this.forgetTree(path);
  }

  async trashStale(dir: string, keep: Set<string>): Promise<void> {
    const rows = await this.db.getAllAsync<{ path: string; drive_id: string }>(
      'SELECT path, drive_id FROM drive_files WHERE substr(path, 1, ?) IN (?, ?)',
      dir.length + 7,
      `${dir}/media/`,
      `${dir}/thumbs`,
    );
    for (const row of rows) {
      if (row.path.endsWith('/thumbs') || keep.has(row.path)) continue;
      await this.drive.trash(row.drive_id);
      await this.db.runAsync('DELETE FROM drive_files WHERE path = ?', row.path);
    }
  }
}

async function pushPost(db: SQLiteDatabase, remote: Remote, postId: string): Promise<void> {
  const stored = await getStored(db, postId);
  if (!stored) return;
  const { post, dir } = stored;
  const previous = await db.getFirstAsync<{ dir: string }>('SELECT dir FROM synced_posts WHERE post_id = ?', postId);

  if (post.deleted) {
    for (const d of new Set([dir, previous?.dir].filter((x): x is string => Boolean(x)))) await remote.trashTree(d);
    await db.runAsync('DELETE FROM synced_posts WHERE post_id = ?', postId);
    return;
  }

  if (previous && previous.dir !== dir) await remote.trashTree(previous.dir);

  const keep = new Set<string>();
  for (const m of post.media) {
    const media = `${dir}/${m.file}`;
    const thumb = `${dir}/${m.thumb}`;
    keep.add(media);
    keep.add(thumb);
    await remote.putFile(media, m.sha256);
    await remote.putFile(thumb, null);
  }
  await remote.trashStale(dir, keep);
  await remote.putText(`${dir}/post.json`, await fileOf(dir, 'post.json').text());
  await db.runAsync(
    'INSERT OR REPLACE INTO synced_posts (post_id, dir, rev) VALUES (?, ?, ?)',
    postId,
    dir,
    post.rev,
  );
}

async function resetRemote(db: SQLiteDatabase): Promise<void> {
  const now = toLocalIso(new Date());
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM drive_files');
    await db.runAsync('DELETE FROM synced_posts');
    await db.runAsync('INSERT OR IGNORE INTO outbox (post_id, rev, queued_at) SELECT id, rev, ? FROM posts', now);
  });
}

function describe(e: unknown): string {
  if (e instanceof DriveError && e.status === 403) {
    return 'Google Drive отказал в доступе. Отключи и подключи Drive заново и разреши доступ к файлам приложения.';
  }
  return e instanceof Error ? e.message : String(e);
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

  const remote = new Remote(db, makeDrive());
  try {
    await remote.rootId(true);
    if (!(await remote.mapping('manifest.json'))) await remote.putFile('manifest.json', null);
    for (const item of queue) {
      try {
        await pushPost(db, remote, item.post_id);
      } catch (e) {
        if (e instanceof DriveError && e.status === 404) {
          await resetRemote(db);
          throw new Error('Папка «Плёнка» в Drive изменилась снаружи. Всё будет отправлено заново при следующей синхронизации.');
        }
        throw e;
      }
      await db.runAsync('DELETE FROM outbox WHERE post_id = ? AND rev = ?', item.post_id, item.rev);
      update({ done: state.done + 1, queued: Math.max(0, state.queued - 1) });
    }
    await setLastSyncAt(db, toLocalIso(new Date()));
  } catch (e) {
    update({ error: describe(e) });
  } finally {
    update({ running: false });
    await refreshSyncState(db, account);
  }
}

export async function resendAll(db: SQLiteDatabase): Promise<void> {
  await resetRemote(db);
  await syncNow(db, { ignoreWifi: true });
}

export async function syncedRev(db: SQLiteDatabase, postId: string): Promise<number | null> {
  const row = await db.getFirstAsync<{ rev: number }>('SELECT rev FROM synced_posts WHERE post_id = ?', postId);
  return row?.rev ?? null;
}

type RemoteEntry = { path: string; id: string };

async function walk(drive: Drive, folderId: string, path: string, files: RemoteEntry[], folders: RemoteEntry[]) {
  for (const child of await drive.children(folderId)) {
    const childPath = path ? `${path}/${child.name}` : child.name;
    if (child.mimeType === FOLDER_MIME) {
      folders.push({ path: childPath, id: child.id });
      await walk(drive, child.id, childPath, files, folders);
    } else {
      files.push({ path: childPath, id: child.id });
    }
  }
}

export async function restoreFromDrive(
  db: SQLiteDatabase,
  onProgress: (done: number, total: number) => void,
): Promise<number> {
  const remote = new Remote(db, makeDrive());
  const rootId = await remote.rootId(false);
  if (!rootId) return 0;

  const files: RemoteEntry[] = [];
  const folders: RemoteEntry[] = [];
  await walk(remote.drive, rootId, '', files, folders);
  for (const f of folders) await remote.remember(f.path, f.id);

  let done = 0;
  onProgress(done, files.length);
  for (const f of files) {
    const local = new File(rootDir(), f.path);
    if (!local.exists) {
      new Directory(rootDir(), parentOf(f.path)).create({ intermediates: true, idempotent: true });
      await remote.drive.download(f.id, local);
    }
    await remote.remember(f.path, f.id);
    onProgress(++done, files.length);
  }

  await rebuildIndex(db);
  const posts = await listFeed(db);
  await db.withTransactionAsync(async () => {
    for (const { post, dir } of posts) {
      for (const m of post.media) {
        await db.runAsync('UPDATE drive_files SET sha256 = ? WHERE path = ?', m.sha256, `${dir}/${m.file}`);
      }
      await db.runAsync(
        'INSERT OR REPLACE INTO synced_posts (post_id, dir, rev) VALUES (?, ?, ?)',
        post.id,
        dir,
        post.rev,
      );
      await db.runAsync('DELETE FROM outbox WHERE post_id = ? AND rev <= ?', post.id, post.rev);
    }
  });
  await refreshSyncState(db);
  return posts.length;
}
