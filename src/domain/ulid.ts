import { getRandomBytes } from 'expo-crypto';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function ulid(now: number = Date.now()): string {
  let time = '';
  let t = now;
  for (let i = 0; i < 10; i++) {
    time = ALPHABET[t % 32] + time;
    t = Math.floor(t / 32);
  }
  const bytes = getRandomBytes(16);
  let random = '';
  for (let i = 0; i < 16; i++) random += ALPHABET[bytes[i] % 32];
  return time + random;
}
