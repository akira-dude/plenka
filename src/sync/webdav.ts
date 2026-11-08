import { File, UploadType } from 'expo-file-system';
import type { ServerConfig } from '@/storage/settings';

export class WebDavError extends Error {
  constructor(
    readonly status: number,
    what: string,
  ) {
    super(`Сервер ответил ${status} на ${what}`);
  }
}

export type DavEntry = { path: string; dir: boolean };

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += BASE64[(n >> 18) & 63] + BASE64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? BASE64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? BASE64[n & 63] : '=';
  }
  return out;
}

const PROPFIND_BODY =
  '<?xml version="1.0" encoding="utf-8"?><D:propfind xmlns:D="DAV:"><D:prop><D:resourcetype/></D:prop></D:propfind>';

export const normalizeServerUrl = (url: string) => url.trim().replace(/\/+$/, '');

export function createWebDav(config: ServerConfig) {
  const base = normalizeServerUrl(config.url);
  const basePath = decodeURIComponent(base.match(/^https?:\/\/[^/]+(\/.*)?$/i)?.[1] ?? '');
  const auth = `Basic ${base64(`${config.user}:${config.password}`)}`;

  const href = (path: string, dir = false) => {
    const encoded = path.split('/').filter(Boolean).map(encodeURIComponent).join('/');
    return `${base}/${encoded}${dir && encoded ? '/' : ''}`;
  };

  async function request(
    method: string,
    path: string,
    init: { dir?: boolean; headers?: Record<string, string>; body?: string; allow?: number[] } = {},
  ): Promise<Response> {
    const res = await fetch(href(path, init.dir), {
      method,
      headers: { Authorization: auth, ...init.headers },
      body: init.body,
    });
    if (!res.ok && !(init.allow ?? []).includes(res.status)) throw new WebDavError(res.status, `${method} /${path}`);
    return res;
  }

  function parse(xml: string): DavEntry[] {
    const entries: DavEntry[] = [];
    for (const block of xml.match(/<(?:\w+:)?response\b[\s\S]*?<\/(?:\w+:)?response>/gi) ?? []) {
      const raw = block.match(/<(?:\w+:)?href>([^<]*)<\/(?:\w+:)?href>/i)?.[1];
      if (raw === undefined) continue;
      let path = decodeURIComponent(raw.replace(/^https?:\/\/[^/]+/i, ''));
      if (basePath && path.startsWith(basePath)) path = path.slice(basePath.length);
      entries.push({ path: path.replace(/^\/+|\/+$/g, ''), dir: /<(?:\w+:)?collection\b/i.test(block) });
    }
    return entries;
  }

  async function propfind(path: string, depth: '0' | '1' | 'infinity', dir: boolean): Promise<DavEntry[] | null> {
    const res = await request('PROPFIND', path, {
      dir,
      headers: { Depth: depth, 'Content-Type': 'application/xml; charset=utf-8' },
      body: PROPFIND_BODY,
      allow: [404],
    });
    return res.status === 404 ? null : parse(await res.text());
  }

  async function list(path: string): Promise<DavEntry[]> {
    return ((await propfind(path, '1', true)) ?? []).filter((e) => e.path !== path);
  }

  async function walk(path: string): Promise<DavEntry[]> {
    try {
      return ((await propfind(path, 'infinity', true)) ?? []).filter((e) => e.path !== path);
    } catch (e) {
      if (!(e instanceof WebDavError) || ![400, 403, 501].includes(e.status)) throw e;
    }
    const out: DavEntry[] = [];
    for (const entry of await list(path)) {
      out.push(entry);
      if (entry.dir) out.push(...(await walk(entry.path)));
    }
    return out;
  }

  return {
    async ping(): Promise<void> {
      await propfind('', '0', true);
    },
    async exists(path: string): Promise<boolean> {
      return (await propfind(path, '0', false)) !== null;
    },
    list,
    walk,
    async mkcol(path: string): Promise<void> {
      await request('MKCOL', path, { dir: true, allow: [405] });
    },
    async putText(path: string, text: string): Promise<void> {
      await request('PUT', path, { headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: text });
    },
    async upload(local: File, path: string, mime: string): Promise<void> {
      const result = await local.upload(href(path), {
        httpMethod: 'PUT',
        uploadType: UploadType.BINARY_CONTENT,
        headers: { Authorization: auth, 'Content-Type': mime },
      });
      if (result.status >= 300) throw new WebDavError(result.status, `PUT /${path}`);
    },
    async getText(path: string): Promise<string> {
      return (await request('GET', path)).text();
    },
    async download(path: string, target: File): Promise<void> {
      await File.downloadFileAsync(href(path), target, { headers: { Authorization: auth } });
    },
    async remove(path: string, dir: boolean): Promise<void> {
      await request('DELETE', path, { dir, allow: [404] });
    },
  };
}

export type WebDav = ReturnType<typeof createWebDav>;
