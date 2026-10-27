import { Platform } from 'react-native';

export const colors = {
  bg: '#F6F7F9',
  card: '#FFFFFF',
  ink: '#121318',
  muted: '#6B7180',
  faint: '#B3B8C2',
  line: '#E3E6EB',
  accent: '#2B48D6',
  accentSoft: '#E2E7FB',
  amber: '#7A520A',
  amberSoft: '#FBF0DA',
  danger: '#C0392B',
  photoBg: '#E9EBEF',
  onAccent: '#FFFFFF',
  overlay: 'rgba(0,0,0,0.45)',
};

export const fonts = {
  mono: Platform.select({ android: 'monospace', default: 'Courier' }),
};

export const space = { gutter: 16 };
