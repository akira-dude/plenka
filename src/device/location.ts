import * as Location from 'expo-location';

export type Coords = { lat: number; lon: number };

const FIX_TIMEOUT_MS = 20_000;
const GEOCODE_TIMEOUT_MS = 8_000;

const round = (n: number) => Math.round(n * 1e5) / 1e5;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

export async function currentCoords(): Promise<Coords | null> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return null;
  const recent = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60_000, requiredAccuracy: 200 });
  const position =
    recent ??
    (await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), FIX_TIMEOUT_MS)) ??
    (await Location.getLastKnownPositionAsync());
  if (!position) return null;
  return { lat: round(position.coords.latitude), lon: round(position.coords.longitude) };
}

export async function placeName({ lat, lon }: Coords): Promise<string> {
  try {
    const found = await withTimeout(Location.reverseGeocodeAsync({ latitude: lat, longitude: lon }), GEOCODE_TIMEOUT_MS);
    const address = found?.[0];
    if (!address) return '';
    const street = [address.street, address.streetNumber].filter(Boolean).join(' ');
    return [street, address.city ?? address.district].filter(Boolean).join(', ');
  } catch {
    return '';
  }
}

export const formatCoords = ({ lat, lon }: Coords) => `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
