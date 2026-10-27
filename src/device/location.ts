import * as Location from 'expo-location';

export type Coords = { lat: number; lon: number };

const round = (n: number) => Math.round(n * 1e5) / 1e5;

export async function currentCoords(): Promise<Coords | null> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return null;
  const recent = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60_000, requiredAccuracy: 200 });
  const position = recent ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  return { lat: round(position.coords.latitude), lon: round(position.coords.longitude) };
}

export async function placeName({ lat, lon }: Coords): Promise<string> {
  try {
    const [address] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
    if (!address) return '';
    const street = [address.street, address.streetNumber].filter(Boolean).join(' ');
    return [street, address.city ?? address.district].filter(Boolean).join(', ');
  } catch {
    return '';
  }
}

export const formatCoords = ({ lat, lon }: Coords) => `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
