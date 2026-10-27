import { File, UploadType } from 'expo-file-system';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const BOUNDARY = 'plenka-boundary';
export const FOLDER_MIME = 'application/vnd.google-apps.folder';

export type DriveFile = { id: string; name: string; mimeType: string };

export class DriveError extends Error {
  constructor(
    readonly status: number,
    body: string,
  ) {
    super(`Google Drive ответил ${status}: ${body.slice(0, 300)}`);
  }
}

type TokenSource = { get: () => Promise<string>; drop: (token: string) => Promise<void> };

const quote = (value: string) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

export function createDrive(tokens: TokenSource) {
  async function request(url: string, init: RequestInit = {}, retry = true): Promise<Response> {
    const token = await tokens.get();
    const res = await fetch(url, {
      ...init,
      headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` },
    });
    if (res.status === 401 && retry) {
      await tokens.drop(token);
      return request(url, init, false);
    }
    if (!res.ok) throw new DriveError(res.status, await res.text());
    return res;
  }

  async function list(query: string): Promise<DriveFile[]> {
    const files: DriveFile[] = [];
    let pageToken = '';
    do {
      const params = new URLSearchParams({
        q: query,
        fields: 'nextPageToken,files(id,name,mimeType)',
        pageSize: '1000',
        spaces: 'drive',
      });
      if (pageToken) params.set('pageToken', pageToken);
      const page = (await (await request(`${API}/files?${params}`)).json()) as {
        files: DriveFile[];
        nextPageToken?: string;
      };
      files.push(...page.files);
      pageToken = page.nextPageToken ?? '';
    } while (pageToken);
    return files;
  }

  async function findChild(parentId: string, name: string, folder: boolean): Promise<DriveFile | null> {
    const type = folder ? `mimeType = ${quote(FOLDER_MIME)}` : `mimeType != ${quote(FOLDER_MIME)}`;
    const found = await list(`name = ${quote(name)} and ${quote(parentId)} in parents and ${type} and trashed = false`);
    return found[0] ?? null;
  }

  async function children(parentId: string): Promise<DriveFile[]> {
    return list(`${quote(parentId)} in parents and trashed = false`);
  }

  async function createFolder(parentId: string, name: string): Promise<string> {
    const res = await request(`${API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
    });
    return ((await res.json()) as { id: string }).id;
  }

  async function uploadFile(local: File, name: string, parentId: string, mime: string, existingId?: string): Promise<string> {
    const url = existingId
      ? `${UPLOAD}/files/${existingId}?uploadType=resumable&fields=id`
      : `${UPLOAD}/files?uploadType=resumable&fields=id`;
    const session = await request(url, {
      method: existingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': mime },
      body: JSON.stringify(existingId ? {} : { name, parents: [parentId] }),
    });
    const location = session.headers.get('location');
    if (!location) throw new DriveError(session.status, 'нет адреса сессии загрузки');
    const result = await local.upload(location, {
      httpMethod: 'PUT',
      uploadType: UploadType.BINARY_CONTENT,
      headers: { 'Content-Type': mime },
    });
    if (result.status >= 400) throw new DriveError(result.status, result.body);
    return (JSON.parse(result.body) as { id: string }).id;
  }

  async function uploadText(text: string, name: string, parentId: string, existingId?: string): Promise<string> {
    if (existingId) {
      await request(`${UPLOAD}/files/${existingId}?uploadType=media`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: text,
      });
      return existingId;
    }
    const body =
      `--${BOUNDARY}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify({ name, parents: [parentId], mimeType: 'application/json' })}\r\n` +
      `--${BOUNDARY}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${text}\r\n--${BOUNDARY}--`;
    const res = await request(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${BOUNDARY}` },
      body,
    });
    return ((await res.json()) as { id: string }).id;
  }

  async function trash(id: string): Promise<void> {
    try {
      await request(`${API}/files/${id}?fields=id`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ trashed: true }),
      });
    } catch (e) {
      if (!(e instanceof DriveError && e.status === 404)) throw e;
    }
  }

  async function download(id: string, destination: File): Promise<void> {
    const token = await tokens.get();
    await File.downloadFileAsync(`${API}/files/${id}?alt=media`, destination, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  return { list, findChild, children, createFolder, uploadFile, uploadText, trash, download };
}

export type Drive = ReturnType<typeof createDrive>;
