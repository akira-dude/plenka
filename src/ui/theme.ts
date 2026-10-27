import { Platform } from 'react-native';

export type Palette = {
  bg: string;
  card: string;
  ink: string;
  muted: string;
  faint: string;
  line: string;
  accent: string;
  accentSoft: string;
  amber: string;
  amberSoft: string;
  danger: string;
  photoBg: string;
  onAccent: string;
  overlay: string;
};

export type Scheme = 'light' | 'dark';
export type ThemeMode = 'system' | Scheme;

export const palettes: Record<Scheme, Palette> = {
  light: {
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
  },
  dark: {
    bg: '#0F1115',
    card: '#181B21',
    ink: '#E8EAEE',
    muted: '#9AA1AE',
    faint: '#545B68',
    line: '#2A2F38',
    accent: '#5D76F5',
    accentSoft: '#1D2440',
    amber: '#E9B44C',
    amberSoft: '#2E2512',
    danger: '#FF6B5B',
    photoBg: '#22262E',
    onAccent: '#FFFFFF',
    overlay: 'rgba(0,0,0,0.55)',
  },
};

export const fonts = {
  mono: Platform.select({ android: 'monospace', default: 'Courier' }),
};

export const space = { gutter: 16 };
