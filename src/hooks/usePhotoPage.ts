import { useSyncExternalStore } from 'react';

const pages = new Map<string, number>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setPhotoPage(postId: string, index: number): void {
  if ((pages.get(postId) ?? 0) === index) return;
  pages.set(postId, index);
  listeners.forEach((l) => l());
}

export function usePhotoPage(postId: string): number {
  return useSyncExternalStore(subscribe, () => pages.get(postId) ?? 0);
}
