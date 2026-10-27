import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { fonts, type Palette } from './theme';
import { useStyles, useTheme } from './ThemeProvider';

const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function AppUpdates() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { currentlyRunning, isUpdatePending, isChecking, isDownloading, checkError, downloadError } = Updates.useUpdates();
  const [result, setResult] = useState<string | null>(null);

  const busy = isChecking || isDownloading;
  const running = currentlyRunning.isEmbeddedLaunch
    ? 'встроенная в APK'
    : currentlyRunning.createdAt
      ? `обновление от ${stamp(currentlyRunning.createdAt)}`
      : 'обновление';
  const error = checkError ?? downloadError;

  const check = async () => {
    setResult(null);
    try {
      const update = await Updates.checkForUpdateAsync();
      if (!update.isAvailable) {
        setResult('Установлена последняя версия.');
        return;
      }
      await Updates.fetchUpdateAsync();
    } catch (e) {
      setResult(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.line}>версия {Constants.expoConfig?.version ?? '—'}</Text>
      <Text style={styles.line}>код: {running}</Text>
      {!Updates.isEnabled ? (
        <Text style={styles.note}>Обновления работают только в собранном APK.</Text>
      ) : isUpdatePending ? (
        <Pressable style={styles.primary} onPress={() => void Updates.reloadAsync()}>
          <Text style={styles.primaryText}>Перезапустить и обновить</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.button} onPress={check} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.buttonText}>Проверить обновления</Text>}
        </Pressable>
      )}
      {result && <Text style={styles.note}>{result}</Text>}
      {error && !result && <Text style={styles.error}>Не удалось проверить обновления: {error.message}</Text>}
      <Text style={styles.note}>
        Обновления приходят сами при запуске и применяются при следующем открытии приложения.
      </Text>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: { backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.line, padding: 12, gap: 8 },
    line: { fontFamily: fonts.mono, fontSize: 13, color: c.ink },
    note: { fontSize: 13, color: c.muted, lineHeight: 19 },
    error: { fontSize: 13, color: c.danger, lineHeight: 19 },
    primary: { backgroundColor: c.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
    primaryText: { color: c.onAccent, fontSize: 15, fontWeight: '700' },
    button: {
      paddingVertical: 13,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.line,
      backgroundColor: c.bg,
      alignItems: 'center',
    },
    buttonText: { fontSize: 15, fontWeight: '600', color: c.ink },
  });
