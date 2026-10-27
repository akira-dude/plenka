import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { useDbQuery } from '@/hooks/useDbQuery';
import { rootDir } from '@/storage/paths';
import { countPosts, rebuildIndex } from '@/storage/posts';
import { getPhotoQuality, setPhotoQuality, type PhotoQuality } from '@/storage/settings';
import { colors, fonts, space } from '@/ui/theme';

const QUALITY_OPTIONS: { value: PhotoQuality; title: string; hint: string }[] = [
  { value: 'visual', title: 'Без видимых потерь', hint: 'WebP 90, полное разрешение, пропорции как у снимка. Примерно 1–2 МБ на фото.' },
  { value: 'original', title: 'Оригинал', hint: 'Файл сохраняется как снят, байт в байт. Примерно 3–6 МБ на фото.' },
];

type Overview = { quality: PhotoQuality; posts: number; used: number; free: number };

async function loadOverview(db: SQLiteDatabase): Promise<Overview> {
  return {
    quality: await getPhotoQuality(db),
    posts: await countPosts(db),
    used: rootDir().size ?? 0,
    free: Paths.availableDiskSpace,
  };
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1).replace('.', ',')} ГБ`;
  return `${Math.round(bytes / 1024 ** 2)} МБ`;
}

export default function Settings() {
  const db = useSQLiteContext();
  const { data, reload } = useDbQuery<Overview | null>(loadOverview, null);
  const [busy, setBusy] = useState(false);

  const chooseQuality = useCallback(
    async (value: PhotoQuality) => {
      await setPhotoQuality(db, value);
      reload();
    },
    [db, reload],
  );

  const rebuild = async () => {
    setBusy(true);
    try {
      const n = await rebuildIndex(db);
      Alert.alert('Индекс пересобран', `Найдено записей: ${n}.`);
      reload();
    } catch (e) {
      Alert.alert('Не удалось пересобрать индекс', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Фото и память</Text>

        <Text style={styles.section}>Качество хранения</Text>
        {QUALITY_OPTIONS.map((o) => {
          const on = data?.quality === o.value;
          return (
            <Pressable key={o.value} style={[styles.option, on && styles.optionOn]} onPress={() => chooseQuality(o.value)}>
              <View style={[styles.radio, on && styles.radioOn]} />
              <View style={styles.optionBody}>
                <Text style={styles.optionTitle}>{o.title}</Text>
                <Text style={styles.optionHint}>{o.hint}</Text>
              </View>
            </Pressable>
          );
        })}
        <Text style={styles.note}>Режим применяется к новым фото. Уже сохранённые не пересжимаются.</Text>

        <Text style={styles.section}>Галерея телефона</Text>
        <Text style={styles.note}>
          Снимки с камеры есть только в Плёнке, галерея их не видит. Фото из галереи копируются сюда, поэтому удаление их
          из галереи дневник не трогает.
        </Text>

        <Text style={styles.section}>На телефоне</Text>
        {data ? (
          <View style={styles.stats}>
            <Text style={styles.stat}>записей: {data.posts}</Text>
            <Text style={styles.stat}>дневник занимает: {formatBytes(data.used)}</Text>
            <Text style={styles.stat}>свободно: {formatBytes(data.free)}</Text>
          </View>
        ) : (
          <ActivityIndicator color={colors.muted} />
        )}
        <View style={styles.warn}>
          <Text style={styles.warnText}>
            Пока нет синхронизации с Google Drive, записи хранятся только на телефоне. При удалении приложения Android
            спросит, сохранить ли данные: отвечай «Да».
          </Text>
        </View>

        <Text style={styles.section}>Обслуживание</Text>
        <Pressable style={styles.button} onPress={rebuild} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.buttonText}>Пересобрать индекс из файлов</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.gutter, paddingBottom: 32, gap: 10 },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink, paddingTop: 8 },
  section: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  option: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  optionOn: { borderColor: colors.accent },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.faint, marginTop: 1 },
  radioOn: { borderWidth: 6, borderColor: colors.accent },
  optionBody: { flex: 1, gap: 2 },
  optionTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  optionHint: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  note: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  stats: { gap: 4 },
  stat: { fontFamily: fonts.mono, fontSize: 13, color: colors.ink },
  warn: { backgroundColor: colors.amberSoft, borderRadius: 12, padding: 12 },
  warnText: { fontSize: 13, color: colors.amber, lineHeight: 19 },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  buttonText: { fontSize: 15, fontWeight: '600', color: colors.ink },
});
