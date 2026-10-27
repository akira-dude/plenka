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
