import type { SQLiteDatabase } from 'expo-sqlite';

const MIGRATIONS = [
  `
  CREATE TABLE posts (
    id TEXT PRIMARY KEY NOT NULL,
    frame INTEGER NOT NULL,
    dir TEXT NOT NULL,
    created_at TEXT NOT NULL,
    day TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    rev INTEGER NOT NULL,
    text TEXT NOT NULL,
    tags TEXT NOT NULL,
    deleted INTEGER NOT NULL,
    json TEXT NOT NULL
  );
  CREATE INDEX posts_day ON posts (day);
  CREATE TABLE outbox (
    post_id TEXT PRIMARY KEY NOT NULL,
    rev INTEGER NOT NULL,
    queued_at TEXT NOT NULL
  );
  CREATE TABLE settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];

export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let v = current; v < MIGRATIONS.length; v++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[v]);
      await db.execAsync(`PRAGMA user_version = ${v + 1}`);
    });
  }
}
