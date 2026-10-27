import { Directory, File } from 'expo-file-system';

export async function writeJsonAtomic(dir: Directory, name: string, data: unknown): Promise<void> {
  dir.create({ intermediates: true, idempotent: true });
  const tmp = new File(dir, `${name}.tmp`);
  tmp.create({ overwrite: true });
  await tmp.write(JSON.stringify(data, null, 2));
  await tmp.move(new File(dir, name), { overwrite: true });
}

export async function readJson(file: File): Promise<unknown> {
  return JSON.parse(await file.text());
}

export async function moveTree(from: Directory, to: Directory): Promise<void> {
  to.create({ intermediates: true, idempotent: true });
  for (const entry of from.list()) {
    if (entry instanceof Directory) await moveTree(entry, new Directory(to, entry.name));
    else await entry.move(new File(to, entry.name), { overwrite: true });
  }
  from.delete();
}

export function deleteIfExists(file: File): void {
  if (file.exists) file.delete();
}
