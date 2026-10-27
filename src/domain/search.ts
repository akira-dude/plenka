export type TagCount = { tag: string; count: number };
export type Segment = { text: string; hit: boolean };

const SNIPPET_RADIUS = 40;
const SUGGESTION_LIMIT = 8;

export function searchWords(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/^#+/, ''))
    .filter(Boolean);
}

export function tagQuery(query: string): string | null {
  const m = query.trim().toLowerCase().match(/^#([^\s#]+)$/);
  return m ? m[1] : null;
}

export function countTags(tagLists: string[][]): TagCount[] {
  const counts = new Map<string, number>();
  for (const tags of tagLists) for (const t of tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'ru'));
}

export function currentFragment(input: string): string {
  const m = input.match(/[^\s,]*$/);
  return (m?.[0] ?? '').replace(/^#+/, '').toLowerCase();
}

export function suggestTags(all: TagCount[], input: string, exclude: string[] = []): string[] {
  const fragment = currentFragment(input);
  const skip = new Set(exclude);
  const free = all.filter((t) => !skip.has(t.tag));
  if (!fragment) return free.slice(0, SUGGESTION_LIMIT).map((t) => t.tag);
  const starts = free.filter((t) => t.tag.startsWith(fragment) && t.tag !== fragment);
  const contains = free.filter((t) => !t.tag.startsWith(fragment) && t.tag.includes(fragment));
  return [...starts, ...contains].slice(0, SUGGESTION_LIMIT).map((t) => t.tag);
}

export function replaceFragment(input: string, tag: string): string {
  return `${input.replace(/[^\s,]*$/, '')}${tag} `;
}

export function highlight(text: string, words: string[]): Segment[] {
  if (!text || words.length === 0) return [{ text, hit: false }];
  const lower = text.toLowerCase();
  const ranges: [number, number][] = [];
  for (const w of words) {
    let from = lower.indexOf(w);
    while (from !== -1) {
      ranges.push([from, from + w.length]);
      from = lower.indexOf(w, from + w.length);
    }
  }
  if (ranges.length === 0) return [{ text, hit: false }];
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  const segments: Segment[] = [];
  let pos = 0;
  for (const [start, end] of merged) {
    if (start > pos) segments.push({ text: text.slice(pos, start), hit: false });
    segments.push({ text: text.slice(start, end), hit: true });
    pos = end;
  }
  if (pos < text.length) segments.push({ text: text.slice(pos), hit: false });
  return segments;
}

export function snippet(text: string, words: string[]): string {
  const lower = text.toLowerCase();
  const first = Math.min(...words.map((w) => lower.indexOf(w)).filter((i) => i >= 0));
  if (!Number.isFinite(first) || first <= SNIPPET_RADIUS) return text;
  const start = text.lastIndexOf(' ', first - SNIPPET_RADIUS / 2);
  return `…${text.slice(start > 0 ? start + 1 : first - SNIPPET_RADIUS / 2)}`;
}
