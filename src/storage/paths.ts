import { Directory, File, Paths } from 'expo-file-system';

export const rootDir = () => new Directory(Paths.document, 'plenka');
export const postsDir = () => new Directory(rootDir(), 'posts');
export const dirOf = (rel: string) => new Directory(rootDir(), rel);
export const fileOf = (dirRel: string, rel: string) => new File(rootDir(), dirRel, rel);
export const mediaUri = (dirRel: string, rel: string) => fileOf(dirRel, rel).uri;

export function postDirName(id: string, createdAt: string): string {
  const [y, m, d] = [createdAt.slice(0, 4), createdAt.slice(5, 7), createdAt.slice(8, 10)];
  const hhmm = createdAt.slice(11, 13) + createdAt.slice(14, 16);
  return `posts/${y}/${m}/${d}-${hhmm}_${id.slice(-8)}`;
}
