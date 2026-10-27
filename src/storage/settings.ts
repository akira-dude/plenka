import type { SQLiteDatabase } from 'expo-sqlite';
import type { ThemeMode } from '@/ui/theme';

export type PhotoQuality = 'visual' | 'original';

async function get(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

async function set(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, value);
}

export async function getPhotoQuality(db: SQLiteDatabase): Promise<PhotoQuality> {
  return (await get(db, 'photoQuality')) === 'original' ? 'original' : 'visual';
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
