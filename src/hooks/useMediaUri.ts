import { useEffect, useSyncExternalStore } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import type { MediaItem } from '@/domain/post';
import { mediaUri } from '@/storage/paths';
import { fetchOriginal, hasOriginal, mediaVersion, subscribeMedia } from '@/sync/media';

export function useMediaUri(dir: string, item: MediaItem, fetch: boolean): string {
  const db = useSQLiteContext();
  useSyncExternalStore(subscribeMedia, mediaVersion);
  const local = hasOriginal(dir, item);
  useEffect(() => {
    if (!local && fetch) void fetchOriginal(db, dir, item);
  }, [db, dir, item, local, fetch]);
  return mediaUri(dir, local ? item.file : item.thumb);
}
