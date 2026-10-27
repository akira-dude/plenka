import type { SQLiteDatabase } from 'expo-sqlite';

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
