import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import Feather from '@expo/vector-icons/Feather';
import { connect, describeAuthError } from '@/sync/auth';
import { mergeFromCloud, mergeSummary, refreshSyncState, useSyncState } from '@/sync/engine';
import type { Palette } from './theme';
import { useStyles, useTheme } from './ThemeProvider';

export function RestoreOffer({ onDone }: { onDone: () => void }) {
  const db = useSQLiteContext();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const sync = useSyncState();
  const [progress, setProgress] = useState<string | null>(null);

  const restore = async () => {
    setProgress('…');
    try {
      if (!sync.account) {
        const account = await connect();
        if (!account) return;
        await refreshSyncState(db, account);
      }
      const result = await mergeFromCloud(db, (done, total) => setProgress(`${done} из ${total}`));
      Alert.alert('Google Drive', mergeSummary(result));
      onDone();
    } catch (e) {
      Alert.alert('Google Drive', describeAuthError(e));
    } finally {
      setProgress(null);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.text}>Дневник уже вёлся раньше? Записи можно вернуть из папки «Плёнка» на Google Drive.</Text>
      <Pressable style={styles.button} onPress={restore} disabled={progress !== null}>
        {progress !== null ? (
          <>
            <ActivityIndicator color={colors.onAccent} />
            <Text style={styles.buttonText}>{progress}</Text>
          </>
        ) : (
          <>
            <Feather name="download-cloud" size={16} color={colors.onAccent} />
            <Text style={styles.buttonText}>Восстановить из Google Drive</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: { alignSelf: 'stretch', marginTop: 16, gap: 10 },
    text: { fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 20 },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.accent,
      borderRadius: 12,
      paddingVertical: 13,
    },
    buttonText: { color: c.onAccent, fontSize: 15, fontWeight: '700' },
  });
