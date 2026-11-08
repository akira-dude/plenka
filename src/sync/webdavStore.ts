import { Directory, File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';
import { rootDir } from '@/storage/paths';
import type { ServerConfig } from '@/storage/settings';
import { mimeOf, nameOf, parentOf, type CloudStore } from './store';
import { WebDavError, createWebDav, type WebDav } from './webdav';

export class WebDavStore implements CloudStore {
  readonly label = 'сервер';
  private dav: WebDav;
  private dirs = new Set<string>(['']);

  constructor(
    private db: SQLiteDatabase,
    config: ServerConfig,
  ) {
    this.dav = createWebDav(config);
  }

  private async known(path: string): Promise<{ sha256: string | null } | null> {
    return this.db.getFirstAsync<{ sha256: string | null }>('SELECT sha256 FROM webdav_files WHERE path = ?', path);
  }

  private async remember(path: string, sha256: string | null): Promise<void> {
    await this.db.runAsync('INSERT OR REPLACE INTO webdav_files (path, sha256) VALUES (?, ?)', path, sha256);
  }

  private async forgetTree(path: string): Promise<void> {
    await this.db.runAsync(
      'DELETE FROM webdav_files WHERE path = ? OR substr(path, 1, ?) = ?',
      path,
      path.length + 1,
      `${path}/`,
    );
    for (const dir of this.dirs) if (dir === path || dir.startsWith(`${path}/`)) this.dirs.delete(dir);
  }

  private async ensureDir(path: string): Promise<void> {
    if (this.dirs.has(path)) return;
    await this.ensureDir(parentOf(path));
    await this.dav.mkcol(path);
    this.dirs.add(path);
  }

  async hasRoot(): Promise<boolean> {
    await this.dav.ping();
    return true;
  }

  async ensureRoot(): Promise<void> {
    await this.dav.ping();
    if (!(await this.known('manifest.json'))) await this.putFile('manifest.json', null);
  }

  async putFile(path: string, sha256: string | null): Promise<void> {
    const known = await this.known(path);
    if (known && (sha256 === null || known.sha256 === sha256)) return;
    const local = new File(rootDir(), path);
    if (!local.exists) {
      if (!(await this.dav.exists(path))) throw new Error(`Файла ${path} нет ни на телефоне, ни на сервере.`);
      await this.remember(path, sha256);
      return;
    }
    await this.ensureDir(parentOf(path));
    await this.dav.upload(local, path, mimeOf(path));
    await this.remember(path, sha256);
  }

  async putText(path: string, text: string): Promise<void> {
    await this.ensureDir(parentOf(path));
    await this.dav.putText(path, text);
    await this.remember(path, null);
  }

  async removeTree(path: string): Promise<void> {
    await this.dav.remove(path, true);
    await this.forgetTree(path);
  }

  async pruneMedia(dir: string, keep: Set<string>): Promise<void> {
    for (const sub of ['media', 'thumbs']) {
      for (const entry of await this.dav.list(`${dir}/${sub}`)) {
        if (entry.dir || keep.has(entry.path)) continue;
        await this.dav.remove(entry.path, false);
        await this.db.runAsync('DELETE FROM webdav_files WHERE path = ?', entry.path);
      }
    }
  }

  async listFiles(): Promise<string[]> {
    const entries = await this.dav.walk('');
    const files = entries.filter((e) => !e.dir).map((e) => e.path);
    for (const e of entries) if (e.dir) this.dirs.add(e.path);
    const present = new Set(files);
    const known = await this.db.getAllAsync<{ path: string }>('SELECT path FROM webdav_files');
    await this.db.withTransactionAsync(async () => {
      for (const { path } of known) {
        if (!present.has(path)) await this.db.runAsync('DELETE FROM webdav_files WHERE path = ?', path);
      }
      for (const path of files) {
        await this.db.runAsync('INSERT OR IGNORE INTO webdav_files (path, sha256) VALUES (?, NULL)', path);
      }
    });
    return files;
  }

  async readText(path: string): Promise<string> {
    return this.dav.getText(path);
  }

  async download(path: string, target: File): Promise<boolean> {
    if (!(await this.dav.exists(path))) return false;
    const temp = new File(Paths.cache, `download-${Date.now()}-${nameOf(path)}`);
    await this.dav.download(path, temp);
    new Directory(rootDir(), parentOf(path)).create({ intermediates: true, idempotent: true });
    await temp.move(target, { overwrite: true });
    return true;
  }

  async markStored(path: string, sha256: string): Promise<void> {
    await this.remember(path, sha256);
  }

  async hasCopy(path: string, sha256: string): Promise<boolean> {
    return (await this.known(path))?.sha256 === sha256;
  }

  async reset(): Promise<void> {
    await this.db.runAsync('DELETE FROM webdav_files');
  }

  isRootGone(): boolean {
    return false;
  }

  describe(error: unknown): string {
    if (error instanceof WebDavError && (error.status === 401 || error.status === 403)) {
      return 'Сервер не принял логин или пароль. Проверь их в настройках.';
    }
    if (error instanceof TypeError) return 'Сервер недоступен. Проверь интернет и что сервер включён и разблокирован.';
    return error instanceof Error ? error.message : String(error);
  }
}
