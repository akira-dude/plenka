import type { SQLiteDatabase } from 'expo-sqlite';
import type { PhotoQuality } from '@/domain/post';
import type { ThemeMode } from '@/ui/theme';

export type { PhotoQuality };

async function get(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

async function set(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, value);
}

export async function getPhotoQuality(db: SQLiteDatabase): Promise<PhotoQuality> {
  const value = await get(db, 'photoQuality');
  return value === 'original' || value === 'compact' ? value : 'visual';
}

export async function setPhotoQuality(db: SQLiteDatabase, quality: PhotoQuality): Promise<void> {
  await set(db, 'photoQuality', quality);
}

export async function getThemeMode(db: SQLiteDatabase): Promise<ThemeMode> {
  const value = await get(db, 'themeMode');
  return value === 'light' || value === 'dark' ? value : 'system';
}

export async function setThemeMode(db: SQLiteDatabase, mode: ThemeMode): Promise<void> {
  await set(db, 'themeMode', mode);
}

export async function getWifiOnly(db: SQLiteDatabase): Promise<boolean> {
  return (await get(db, 'wifiOnly')) === '1';
}

export async function setWifiOnly(db: SQLiteDatabase, value: boolean): Promise<void> {
  await set(db, 'wifiOnly', value ? '1' : '0');
}

export async function getLastSyncAt(db: SQLiteDatabase): Promise<string | null> {
  return get(db, 'lastSyncAt');
}

export async function setLastSyncAt(db: SQLiteDatabase, iso: string): Promise<void> {
  await set(db, 'lastSyncAt', iso);
}

export type CloudProvider = 'drive' | 'server';

export type ServerConfig = { url: string; user: string; password: string };

export async function getCloudProvider(db: SQLiteDatabase): Promise<CloudProvider> {
  return (await get(db, 'cloudProvider')) === 'server' ? 'server' : 'drive';
}

export async function setCloudProvider(db: SQLiteDatabase, provider: CloudProvider): Promise<void> {
  await set(db, 'cloudProvider', provider);
}

export async function getServerConfig(db: SQLiteDatabase): Promise<ServerConfig | null> {
  const [url, user, password] = await Promise.all([get(db, 'serverUrl'), get(db, 'serverUser'), get(db, 'serverPassword')]);
  return url && user && password ? { url, user, password } : null;
}

export async function setServerConfig(db: SQLiteDatabase, config: ServerConfig): Promise<void> {
  await set(db, 'serverUrl', config.url);
  await set(db, 'serverUser', config.user);
  await set(db, 'serverPassword', config.password);
}
