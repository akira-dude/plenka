import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Sharing from 'expo-sharing';

const SHARE_QUALITY = 0.92;

let lastShared: File | null = null;

export async function sharePhoto(uri: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('На этом телефоне недоступно меню «Поделиться».');
  if (lastShared?.exists) lastShared.delete();
  const image = await ImageManipulator.manipulate(uri).renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: SHARE_QUALITY });
  image.release();
  lastShared = new File(saved.uri);
  await Sharing.shareAsync(saved.uri, { mimeType: 'image/jpeg', dialogTitle: 'Поделиться фото' });
}
