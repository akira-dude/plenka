import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import Feather from '@expo/vector-icons/Feather';
import { useDbQuery } from '@/hooks/useDbQuery';
import { rootDir } from '@/storage/paths';
import { countPosts, rebuildIndex } from '@/storage/posts';
import { getPhotoQuality, getWifiOnly, setPhotoQuality, setWifiOnly, type PhotoQuality } from '@/storage/settings';
import { connect, describeAuthError, disconnect } from '@/sync/auth';
import { refreshSyncState, resendAll, restoreFromDrive, syncNow, useSyncState } from '@/sync/engine';
import { AppUpdates } from '@/ui/AppUpdates';
import { fonts, space, type Palette, type ThemeMode } from '@/ui/theme';
import { useStyles, useTheme } from '@/ui/ThemeProvider';

const QUALITY_OPTIONS: { value: PhotoQuality; title: string; hint: string }[] = [
  { value: 'original', title: 'Оригинал', hint: 'Файл сохраняется как снят, байт в байт. Примерно 3–6 МБ на фото.' },
  { value: 'visual', title: 'Без видимых потерь', hint: 'WebP 90, полное разрешение, пропорции как у снимка. Примерно 1,5–3 МБ на фото.' },
  {
    value: 'compact',
    title: 'Экономия места',
    hint: 'WebP 85, длинная сторона до 1600 px, пропорции сохраняются. Примерно 0,3–0,5 МБ на фото: для экрана телефона и компьютера хватает, для печати и сильного зума нет.',
  },
];

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Системная' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
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
  const styles = useStyles(makeStyles);
  const { colors, mode, setMode } = useTheme();
  const { data, reload } = useDbQuery<Overview | null>(loadOverview, null);
  const [busy, setBusy] = useState(false);
  const sync = useSyncState();

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
      Alert.alert('Список пересобран', `Найдено записей: ${n}.`);
      reload();
    } catch (e) {
      Alert.alert('Не удалось пересобрать список', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Настройки</Text>

        <Text style={styles.section}>Google Drive</Text>
        <DriveSection onChanged={reload} />

        <Text style={styles.section}>Тема</Text>
        <View style={styles.segment}>
          {THEME_OPTIONS.map((o) => {
            const on = mode === o.value;
            return (
              <Pressable key={o.value} style={[styles.segItem, on && styles.segOn]} onPress={() => setMode(o.value)}>
                <Text style={[styles.segText, on && styles.segTextOn]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>Качество хранения фото</Text>
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
        {!sync.account && (
          <View style={styles.warn}>
            <Text style={styles.warnText}>
              Пока Google Drive не подключён, записи хранятся только на телефоне. При удалении приложения Android
              спросит, сохранить ли данные: отвечай «Да».
            </Text>
          </View>
        )}

        <Text style={styles.section}>Приложение</Text>
        <AppUpdates />

        <Text style={styles.section}>Обслуживание</Text>
        <Text style={styles.note}>
          Лента, календарь и поиск берут записи из быстрого списка, а сами записи лежат в папках с фото. Если запись
          есть в папке, но пропала из ленты, или номера и поиск ведут себя странно, пересобери список. Он заново
          прочитает все папки. Фото и тексты при этом не меняются и никуда не отправляются.
        </Text>
        <Pressable style={styles.button} onPress={rebuild} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.buttonText}>Пересобрать список записей</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatSyncTime(iso: string | null): string {
  if (!iso) return 'ещё не было';
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)} в ${iso.slice(11, 16)}`;
}

function DriveSection({ onChanged }: { onChanged: () => void }) {
  const db = useSQLiteContext();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const sync = useSyncState();
  const wifi = useDbQuery(getWifiOnly, false);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (label: string, task: () => Promise<void>) => {
    setBusy(label);
    try {
      await task();
    } catch (e) {
      Alert.alert('Google Drive', describeAuthError(e));
    } finally {
      setBusy(null);
      onChanged();
    }
  };

  const onConnect = () =>
    run('connect', async () => {
      const account = await connect();
      if (!account) return;
      await refreshSyncState(db, account);
      void syncNow(db, { ignoreWifi: true });
    });

  const onRestore = () =>
    run('restore', async () => {
      const n = await restoreFromDrive(db, (done, total) => setBusy(`restore:${done} из ${total}`));
      Alert.alert('Восстановление', n ? `Записей в дневнике: ${n}.` : 'В Drive не нашлось папки «Плёнка».');
    });

  const onDisconnect = () =>
    Alert.alert('Отключить Google Drive?', 'Записи на телефоне и копии в Drive останутся. Новые записи перестанут отправляться.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Отключить',
        style: 'destructive',
        onPress: () =>
          run('disconnect', async () => {
            await disconnect();
            await refreshSyncState(db, null);
          }),
      },
    ]);

  const onResend = () =>
    Alert.alert('Отправить всё заново?', 'Все записи будут заново сверены с Drive и дозагружены. Это может занять время и трафик.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Отправить', onPress: () => run('resend', () => resendAll(db)) },
    ]);

  if (!sync.account) {
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <Feather name="cloud-off" size={18} color={colors.muted} />
          <Text style={styles.cardTitle}>Не подключён</Text>
        </View>
        <Text style={styles.note}>
          Копии записей будут уходить в папку «Плёнка» на твоём Drive. Приложение видит только эту папку. Ждут отправки:{' '}
          {sync.queued}.
        </Text>
        <Pressable style={styles.primary} onPress={onConnect} disabled={busy !== null}>
          {busy === 'connect' ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={styles.primaryText}>Подключить Google Drive</Text>
          )}
        </Pressable>
      </View>
    );
  }

  const status = sync.running
    ? `Отправляю: ${sync.done} из ${sync.total}`
    : sync.waitingForWifi
      ? `Ждут Wi-Fi: ${sync.queued}`
      : sync.queued > 0
        ? `Ждут отправки: ${sync.queued}`
        : 'Всё отправлено';
  const locked = busy !== null || sync.running;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Feather name="cloud" size={18} color={colors.accent} />
        <Text style={[styles.cardTitle, styles.flex]} numberOfLines={1}>
          {sync.account.email}
        </Text>
      </View>
      <Text style={styles.stat}>{status}</Text>
      <Text style={styles.note}>Последняя синхронизация: {formatSyncTime(sync.lastSyncAt)}</Text>
      {sync.error && <Text style={styles.error}>{sync.error}</Text>}
      {busy?.startsWith('restore') && <Text style={styles.note}>Скачиваю из Drive: {busy.split(':')[1] ?? '…'}</Text>}

      <View style={[styles.row, styles.between]}>
        <Text style={styles.optionTitle}>Только по Wi-Fi</Text>
        <Switch
          value={wifi.data}
          onValueChange={async (value) => {
            await setWifiOnly(db, value);
            wifi.reload();
            if (!value) void syncNow(db);
          }}
          trackColor={{ true: colors.accent, false: colors.line }}
          thumbColor={colors.card}
        />
      </View>

      <Pressable style={styles.primary} onPress={() => run('sync', () => syncNow(db, { ignoreWifi: true }))} disabled={locked}>
        {sync.running || busy === 'sync' ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <Text style={styles.primaryText}>Синхронизировать сейчас</Text>
        )}
      </Pressable>
      <View style={styles.row}>
        <Pressable style={[styles.button, styles.flex]} onPress={onRestore} disabled={locked}>
          <Text style={styles.buttonText}>Восстановить</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.flex]} onPress={onResend} disabled={locked}>
          <Text style={styles.buttonText}>Отправить всё</Text>
        </Pressable>
      </View>
      <Pressable style={styles.textButton} onPress={onDisconnect} disabled={busy !== null}>
        <Text style={styles.danger}>Отключить Drive</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    content: { paddingHorizontal: space.gutter, paddingBottom: 32, gap: 10 },
    title: { fontSize: 24, fontWeight: '800', color: c.ink, paddingTop: 8 },
    section: {
      marginTop: 12,
      fontSize: 12,
      fontWeight: '700',
      color: c.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    card: { backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.line, padding: 12, gap: 6 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    between: { justifyContent: 'space-between' },
    flex: { flex: 1 },
    primary: { backgroundColor: c.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
    primaryText: { color: c.onAccent, fontSize: 15, fontWeight: '700' },
    error: { fontSize: 13, color: c.danger, lineHeight: 19 },
    textButton: { alignSelf: 'center', padding: 8 },
    danger: { fontSize: 14, fontWeight: '600', color: c.danger },
    cardTitle: { fontSize: 15, fontWeight: '600', color: c.ink },
    segment: { flexDirection: 'row', padding: 2, borderRadius: 10, backgroundColor: c.photoBg },
    segItem: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
    segOn: { backgroundColor: c.card },
    segText: { fontSize: 13, fontWeight: '600', color: c.muted },
    segTextOn: { color: c.ink },
    option: {
      flexDirection: 'row',
      gap: 10,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.line,
      backgroundColor: c.card,
    },
    optionOn: { borderColor: c.accent },
    radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: c.faint, marginTop: 1 },
    radioOn: { borderWidth: 6, borderColor: c.accent },
    optionBody: { flex: 1, gap: 2 },
    optionTitle: { fontSize: 15, fontWeight: '600', color: c.ink },
    optionHint: { fontSize: 13, color: c.muted, lineHeight: 18 },
    note: { fontSize: 13, color: c.muted, lineHeight: 19 },
    stats: { gap: 4 },
    stat: { fontFamily: fonts.mono, fontSize: 13, color: c.ink },
    warn: { backgroundColor: c.amberSoft, borderRadius: 12, padding: 12 },
    warnText: { fontSize: 13, color: c.amber, lineHeight: 19 },
    button: {
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.line,
      backgroundColor: c.card,
      alignItems: 'center',
    },
    buttonText: { fontSize: 15, fontWeight: '600', color: c.ink },
  });
