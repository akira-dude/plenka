import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import Feather from '@expo/vector-icons/Feather';
import { getServerConfig, setServerConfig, type ServerConfig } from '@/storage/settings';
import { mergeFromCloud, mergeSummary, refreshSyncState, switchToServer, syncNow } from '@/sync/engine';
import { normalizeServerUrl } from '@/sync/webdav';
import { WebDavStore } from '@/sync/webdavStore';
import type { Palette } from './theme';
import { useStyles, useTheme } from './ThemeProvider';

const DEFAULT_URL = 'https://plenka.arsenbox.ru';
const DEFAULT_USER = 'plenka';

type Props = { mode: 'move' | 'edit'; onDone: () => void };

export function ServerSetup({ mode, onDone }: Props) {
  const db = useSQLiteContext();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const [url, setUrl] = useState(DEFAULT_URL);
  const [user, setUser] = useState(DEFAULT_USER);
  const [password, setPassword] = useState('');
  const [saved, setSaved] = useState<ServerConfig | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getServerConfig(db).then((config) => {
      if (!config) return;
      setSaved(config);
      setUrl(config.url);
      setUser(config.user);
    });
  }, [db]);

  const config = (): ServerConfig | null => {
    const value = { url: normalizeServerUrl(url), user: user.trim(), password: password || saved?.password || '' };
    if (!/^https:\/\/[^/]+/i.test(value.url)) {
      Alert.alert('Свой сервер', 'Адрес должен начинаться с https://');
      return null;
    }
    if (!value.user || !value.password) {
      Alert.alert('Свой сервер', 'Нужны логин и пароль.');
      return null;
    }
    return value;
  };

  const check = async (value: ServerConfig): Promise<boolean> => {
    const store = new WebDavStore(db, value);
    try {
      await store.hasRoot();
      return true;
    } catch (e) {
      Alert.alert('Сервер не отвечает как надо', store.describe(e));
      return false;
    }
  };

  const onCheck = async () => {
    const value = config();
    if (!value) return;
    setBusy('Проверяю…');
    if (await check(value)) Alert.alert('Свой сервер', 'Подключение работает.');
    setBusy(null);
  };

  const onSave = async () => {
    const value = config();
    if (!value) return;
    setBusy('Проверяю…');
    if (await check(value)) {
      await setServerConfig(db, value);
      setPassword('');
      await refreshSyncState(db);
      void syncNow(db, { ignoreWifi: true });
      onDone();
    }
    setBusy(null);
  };

  const move = async (value: ServerConfig) => {
    try {
      await setServerConfig(db, value);
      const posts = await switchToServer(db, setBusy);
      if (posts === 0) {
        const result = await mergeFromCloud(db, (done, total) => setBusy(`Сверяю с сервером: ${done} из ${total}`));
        Alert.alert('Свой сервер подключён', mergeSummary(result));
      } else {
        Alert.alert(
          'Переезд начался',
          `Записей: ${posts}. Они отправляются на сервер, ход видно выше. Копия в Google Drive остаётся как была.`,
        );
      }
      setPassword('');
      onDone();
    } catch (e) {
      Alert.alert('Переезд не удался', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onMove = async () => {
    const value = config();
    if (!value) return;
    setBusy('Проверяю…');
    const ok = await check(value);
    setBusy(null);
    if (!ok) return;
    Alert.alert(
      'Перенести дневник на свой сервер?',
      'Полные фото, которых нет на телефоне, сначала скачаются из Google Drive. Потом все записи уйдут на сервер, и дальше Плёнка будет синхронизироваться только с ним. Файлы в Google Drive останутся, их можно удалить вручную.',
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Перенести', onPress: () => void move(value) },
      ],
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Feather name="server" size={18} color={colors.accent} />
        <Text style={styles.title}>{mode === 'move' ? 'Свой сервер' : 'Подключение к серверу'}</Text>
      </View>
      {mode === 'move' && (
        <Text style={styles.note}>
          Дневник можно хранить на своём сервере вместо Google Drive. Адрес, логин и пароль — от WebDAV Плёнки.
        </Text>
      )}
      <TextInput
        style={styles.input}
        value={url}
        onChangeText={setUrl}
        placeholder="https://plenka.example.ru"
        placeholderTextColor={colors.faint}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      <TextInput
        style={styles.input}
        value={user}
        onChangeText={setUser}
        placeholder="логин"
        placeholderTextColor={colors.faint}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder={saved ? 'пароль (оставь пустым, чтобы не менять)' : 'пароль'}
        placeholderTextColor={colors.faint}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        textContentType="password"
      />
      <Text style={styles.note}>Пароль хранится только на этом телефоне, внутри приложения.</Text>
      {busy && <Text style={styles.note}>{busy}</Text>}
      <View style={styles.row}>
        <Pressable style={[styles.button, styles.flex]} onPress={onCheck} disabled={busy !== null}>
          <Text style={styles.buttonText}>Проверить</Text>
        </Pressable>
        <Pressable
          style={[styles.primary, styles.flex]}
          onPress={mode === 'move' ? onMove : onSave}
          disabled={busy !== null}
        >
          {busy ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={styles.primaryText}>{mode === 'move' ? 'Перенести на сервер' : 'Сохранить'}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: { backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.line, padding: 12, gap: 8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    flex: { flex: 1 },
    title: { fontSize: 15, fontWeight: '600', color: c.ink },
    note: { fontSize: 13, color: c.muted, lineHeight: 19 },
    input: {
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: c.ink,
    },
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
