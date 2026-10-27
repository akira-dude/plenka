const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
export const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export const WEEKDAYS_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

const pad = (n: number) => String(n).padStart(2, '0');

export function toLocalIso(d: Date): string {
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

export const dayKey = (iso: string) => iso.slice(0, 10);
export const timeOf = (iso: string) => iso.slice(11, 16);
export const dayKeyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function parseExifDate(exif: Record<string, unknown> | null | undefined): Date | null {
  const raw = exif?.DateTimeOriginal ?? exif?.DateTime;
  if (typeof raw !== 'string') return null;
  const m = raw.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number);
  const date = new Date(y, mo - 1, d, h, mi, s);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseExifGps(exif: Record<string, unknown> | null | undefined): { lat: number; lon: number } | null {
  const lat = Number(exif?.GPSLatitude);
  const lon = Number(exif?.GPSLongitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) return null;
  return {
    lat: exif?.GPSLatitudeRef === 'S' ? -Math.abs(lat) : lat,
    lon: exif?.GPSLongitudeRef === 'W' ? -Math.abs(lon) : lon,
  };
}

export function formatDayTitle(key: string, now: Date = new Date()): string {
  const d = parseDayKey(key);
  const label = `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
  const today = dayKeyOf(now);
  const yesterday = dayKeyOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  if (key === today) return `Сегодня · ${label}`;
  if (key === yesterday) return `Вчера · ${label}`;
  return d.getFullYear() === now.getFullYear() ? label : `${label} ${d.getFullYear()}`;
}

export function formatDayLong(key: string): string {
  const d = parseDayKey(key);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} · ${WEEKDAYS[d.getDay()]}`;
}

export function formatDayShort(key: string): string {
  const d = parseDayKey(key);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}

export function formatDateTime(d: Date): string {
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatStamp(iso: string): string {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)} · ${timeOf(iso)}`;
}

export function monthTitle(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function monthCells(ym: string): (string | null)[] {
  const [y, m] = ym.split('-').map(Number);
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const days = new Date(y, m, 0).getDate();
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push(`${ym}-${pad(d)}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function yearsAgo(years: number): string {
  const tail = years % 100;
  const last = years % 10;
  const word = tail >= 11 && tail <= 14 ? 'лет' : last === 1 ? 'год' : last >= 2 && last <= 4 ? 'года' : 'лет';
  return `${years} ${word} назад`;
}
