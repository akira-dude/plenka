import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import { useSQLiteContext } from 'expo-sqlite';
import { getThemeMode, setThemeMode } from '@/storage/settings';
import { palettes, type Palette, type Scheme, type ThemeMode } from './theme';

type ThemeValue = {
  mode: ThemeMode;
  scheme: Scheme;
  colors: Palette;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    getThemeMode(db).then(setModeState);
  }, [db]);

  useEffect(() => {
    Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
  }, [mode]);

  const scheme: Scheme = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
  const colors = palettes[scheme];

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.bg);
  }, [colors.bg]);

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      void setThemeMode(db, next);
    },
    [db],
  );

  const value = useMemo(() => ({ mode, scheme, colors, setMode }), [mode, scheme, colors, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}

export function useStyles<T>(factory: (c: Palette) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}
