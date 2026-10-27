import type { File } from 'expo-file-system';

export const parentOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
export const nameOf = (path: string) => path.slice(path.lastIndexOf('/') + 1);

export interface CloudStore {
  readonly label: string;
  hasRoot(): Promise<boolean>;
  ensureRoot(): Promise<void>;
  putFile(path: string, sha256: string | null): Promise<void>;
  putText(path: string, text: string): Promise<void>;
  removeTree(path: string): Promise<void>;
  pruneMedia(dir: string, keep: Set<string>): Promise<void>;
  listFiles(): Promise<string[]>;
  readText(path: string): Promise<string>;
  download(path: string, target: File): Promise<boolean>;
  markStored(path: string, sha256: string): Promise<void>;
  hasCopy(path: string, sha256: string): Promise<boolean>;
  reset(): Promise<void>;
  isRootGone(error: unknown): boolean;
  describe(error: unknown): string;
}
