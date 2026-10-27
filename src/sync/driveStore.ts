import { Directory, File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';
import { rootDir } from '@/storage/paths';
import { accessToken, dropToken } from './auth';
import { DriveError, FOLDER_MIME, createDrive, type Drive } from './drive';
import { nameOf, parentOf, type CloudStore } from './store';

const ROOT_FOLDER = 'Плёнка';

const MIME: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
};

const mimeOf = (path: string) => MIME[path.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';

type Mapping = { drive_id: string; sha256: string | null };

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

export class DriveStore implements CloudStore {
  readonly label = 'Google Drive';
  private drive = makeDrive();

  constructor(private db: SQLiteDatabase) {}

  private mapping(path: string): Promise<Mapping | null> {
    return this.db.getFirstAsync<Mapping>('SELECT drive_id, sha256 FROM drive_files WHERE path = ?', path);
  }

  private async remember(path: string, driveId: string, sha256: string | null = null): Promise<void> {
    await this.db.runAsync(
      'INSERT OR REPLACE INTO drive_files (path, drive_id, sha256) VALUES (?, ?, ?)',
      path,
      driveId,
      sha256,
    );
  }

  private async rememberListed(path: string, driveId: string): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO drive_files (path, drive_id, sha256) VALUES (?, ?, NULL)
       ON CONFLICT (path) DO UPDATE SET drive_id = excluded.drive_id,
         sha256 = CASE WHEN drive_files.drive_id = excluded.drive_id THEN drive_files.sha256 ELSE NULL END`,
      path,
      driveId,
    );
  }

  private async forgetTree(path: string): Promise<void> {
    await this.db.runAsync(
      'DELETE FROM drive_files WHERE path = ? OR substr(path, 1, ?) = ?',
      path,
      path.length + 1,
      `${path}/`,
    );
  }

  private async rootId(create: boolean): Promise<string | null> {
    const known = await this.mapping('');
    if (known) return known.drive_id;
    const found = await this.drive.findChild('root', ROOT_FOLDER, true);
    const id = found?.id ?? (create ? await this.drive.createFolder('root', ROOT_FOLDER) : null);
    if (id) await this.remember('', id);
    return id;
  }

  private async folderId(path: string): Promise<string> {
    if (path === '') return (await this.rootId(true))!;
    const known = await this.mapping(path);
    if (known) return known.drive_id;
    const parentId = await this.folderId(parentOf(path));
    const found = await this.drive.findChild(parentId, nameOf(path), true);
    const id = found?.id ?? (await this.drive.createFolder(parentId, nameOf(path)));
    await this.remember(path, id);
    return id;
  }

  private async lookupFolder(path: string): Promise<string | null> {
    if (path === '') return this.rootId(false);
    const known = await this.mapping(path);
    if (known) return known.drive_id;
    const parentId = await this.lookupFolder(parentOf(path));
    if (!parentId) return null;
    return (await this.drive.findChild(parentId, nameOf(path), true))?.id ?? null;
  }

  private async lookupFile(path: string): Promise<string | null> {
    const known = await this.mapping(path);
    if (known) return known.drive_id;
    const parentId = await this.lookupFolder(parentOf(path));
    if (!parentId) return null;
    return (await this.drive.findChild(parentId, nameOf(path), false))?.id ?? null;
  }

  async hasRoot(): Promise<boolean> {
    return (await this.rootId(false)) !== null;
  }

  async ensureRoot(): Promise<void> {
    await this.rootId(true);
    if (!(await this.mapping('manifest.json'))) await this.putFile('manifest.json', null);
  }

  async putFile(path: string, sha256: string | null): Promise<void> {
    const known = await this.mapping(path);
    if (known && (sha256 === null || known.sha256 === sha256)) return;
    const local = new File(rootDir(), path);
    if (!local.exists) {
      const id = await this.lookupFile(path);
      if (!id) throw new Error(`Файла ${path} нет ни на телефоне, ни в Google Drive.`);
      await this.remember(path, id, sha256);
      return;
    }
    const parentId = await this.folderId(parentOf(path));
    const existing = known?.drive_id ?? (await this.drive.findChild(parentId, nameOf(path), false))?.id;
    const id = await this.drive.uploadFile(local, nameOf(path), parentId, mimeOf(path), existing);
    await this.remember(path, id, sha256);
  }

  async putText(path: string, text: string): Promise<void> {
    const known = await this.mapping(path);
    const parentId = await this.folderId(parentOf(path));
    const existing = known?.drive_id ?? (await this.drive.findChild(parentId, nameOf(path), false))?.id;
    await this.remember(path, await this.drive.uploadText(text, nameOf(path), parentId, existing));
  }

  async removeTree(path: string): Promise<void> {
    const id = await this.lookupFolder(path);
    if (id) await this.drive.remove(id);
    await this.forgetTree(path);
  }

  async pruneMedia(dir: string, keep: Set<string>): Promise<void> {
    const rows = await this.db.getAllAsync<{ path: string; drive_id: string }>(
      'SELECT path, drive_id FROM drive_files WHERE substr(path, 1, ?) IN (?, ?)',
      dir.length + 7,
      `${dir}/media/`,
      `${dir}/thumbs`,
    );
    for (const row of rows) {
      if (row.path.endsWith('/thumbs') || keep.has(row.path)) continue;
      await this.drive.remove(row.drive_id);
      await this.db.runAsync('DELETE FROM drive_files WHERE path = ?', row.path);
    }
  }

  async listFiles(): Promise<string[]> {
    const rootId = await this.rootId(false);
    if (!rootId) return [];
    const seen = new Set<string>(['']);
    const files: string[] = [];
    const walk = async (folderId: string, path: string) => {
      for (const child of await this.drive.children(folderId)) {
        const childPath = path ? `${path}/${child.name}` : child.name;
        seen.add(childPath);
        await this.rememberListed(childPath, child.id);
        if (child.mimeType === FOLDER_MIME) await walk(child.id, childPath);
        else files.push(childPath);
      }
    };
    await walk(rootId, '');
    const known = await this.db.getAllAsync<{ path: string }>('SELECT path FROM drive_files');
    for (const { path } of known) {
      if (!seen.has(path)) await this.db.runAsync('DELETE FROM drive_files WHERE path = ?', path);
    }
    return files;
  }

  async readText(path: string): Promise<string> {
    const id = await this.lookupFile(path);
    if (!id) throw new Error(`В Google Drive нет файла ${path}.`);
    return this.drive.downloadText(id);
  }

  async download(path: string, target: File): Promise<boolean> {
    const id = await this.lookupFile(path);
    if (!id) return false;
    const temp = new File(Paths.cache, `download-${Date.now()}-${nameOf(path)}`);
    await this.drive.download(id, temp);
    new Directory(rootDir(), parentOf(path)).create({ intermediates: true, idempotent: true });
    await temp.move(target, { overwrite: true });
    return true;
  }

  async markStored(path: string, sha256: string): Promise<void> {
    await this.db.runAsync('UPDATE drive_files SET sha256 = ? WHERE path = ?', sha256, path);
  }

  async hasCopy(path: string, sha256: string): Promise<boolean> {
    return (await this.mapping(path))?.sha256 === sha256;
  }

  async reset(): Promise<void> {
    await this.db.runAsync('DELETE FROM drive_files');
  }

  isRootGone(error: unknown): boolean {
    return error instanceof DriveError && error.status === 404;
  }

  describe(error: unknown): string {
    if (error instanceof DriveError && error.status === 403) {
      return 'Google Drive отказал в доступе. Отключи и подключи Drive заново и разреши доступ к файлам приложения.';
    }
    return error instanceof Error ? error.message : String(error);
  }
}
