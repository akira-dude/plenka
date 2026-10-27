import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';

export function useDbQuery<T>(query: (db: SQLiteDatabase) => Promise<T>, initial: T) {
  const db = useSQLiteContext();
  const [data, setData] = useState<T>(initial);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(() => {
    let alive = true;
    query(db)
      .then((result) => {
        if (alive) {
          setData(result);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e : new Error(String(e)));
      });
    return () => {
      alive = false;
    };
  }, [db, query]);

  useFocusEffect(reload);
  return { data, error, reload };
}
