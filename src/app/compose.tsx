import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import Feather from '@expo/vector-icons/Feather';
import { currentCoords, formatCoords, placeName, type Coords } from '@/device/location';
import { formatDateTime, parseDayKey, parseExifDate, parseExifGps } from '@/domain/dates';
import { parseTags, type MediaItem } from '@/domain/post';
import { mediaUri } from '@/storage/paths';
import type { PickedPhoto } from '@/storage/photos';
import { getPost, savePost } from '@/storage/posts';
import { getPhotoQuality } from '@/storage/settings';
import { syncNow } from '@/sync/engine';
import { space, type Palette } from '@/ui/theme';
import { useStyles, useTheme } from '@/ui/ThemeProvider';

type Params = { id?: string; date?: string; source?: 'camera' | 'library' };
type CoordsSource = 'post' | 'photo' | 'device';

const THUMB = 76;

function initialDate(day?: string): Date {
  const now = new Date();
  if (!day) return now;
  const d = parseDayKey(day);
  d.setHours(now.getHours(), now.getMinutes(), 0, 0);
  return d;
}

export default function Compose() {
  const db = useSQLiteContext();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const params = useLocalSearchParams<Params>();
  const editing = Boolean(params.id);

  const [loaded, setLoaded] = useState(!editing);
  const [dir, setDir] = useState<string | null>(null);
  const [keep, setKeep] = useState<MediaItem[]>([]);
  const [added, setAdded] = useState<PickedPhoto[]>([]);
  const [text, setText] = useState('');
  const [tags, setTags] = useState('');
  const [place, setPlace] = useState('');
  const [coords, setCoords] = useState<Coords | null>(null);
  const autoLocate = !editing && !params.date;
  const [locating, setLocating] = useState(autoLocate);
  const [date, setDate] = useState(() => initialDate(params.date));
  const [saving, setSaving] = useState(false);
  const dateFixed = useRef(Boolean(params.date) || editing);
  const coordsSource = useRef<CoordsSource | null>(null);
  const launched = useRef(false);

  const applyCoords = useCallback(async (next: Coords, source: CoordsSource) => {
    coordsSource.current = source;
    setCoords(next);
    const name = await placeName(next);
    if (name) setPlace((prev) => (prev.trim() ? prev : name));
  }, []);

  const locate = useCallback(
    (force: boolean) =>
      currentCoords()
        .catch(() => null)
        .then(async (found) => {
          if (found && (force || coordsSource.current !== 'photo')) await applyCoords(found, 'device');
          setLocating(false);
        }),
    [applyCoords],
  );

  useEffect(() => {
    if (!params.id) return;
    getPost(db, params.id).then((found) => {
      if (found) {
        const { post } = found;
        setDir(found.dir);
        setKeep(post.media);
        setText(post.text);
        setTags(post.tags.join(' '));
        setPlace(post.place?.name ?? '');
        if (post.place?.lat != null && post.place.lon != null) {
          coordsSource.current = 'post';
          setCoords({ lat: post.place.lat, lon: post.place.lon });
        }
        setDate(new Date(post.createdAt));
      }
      setLoaded(true);
    });
  }, [db, params.id]);

  useEffect(() => {
    if (autoLocate) void locate(false);
  }, [autoLocate, locate]);

  const pick = useCallback(
    async (source: 'camera' | 'library') => {
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: true };
      let result: ImagePicker.ImagePickerResult;
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Нет доступа к камере', 'Разреши Плёнке доступ к камере в настройках Android.');
          return;
        }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync({ ...options, allowsMultipleSelection: true, orderedSelection: true });
      }
      if (result.canceled) return;

      const photos: PickedPhoto[] = result.assets.map((a) => ({
        uri: a.uri,
        width: a.width,
        height: a.height,
        mimeType: a.mimeType,
        exif: a.exif,
      }));
      setAdded((prev) => [...prev, ...photos]);

      if (!dateFixed.current) {
        const shot = photos.map((p) => parseExifDate(p.exif)).find((d): d is Date => d !== null);
        if (shot) {
          setDate(shot);
          dateFixed.current = true;
        }
      }
      const gps = photos.map((p) => parseExifGps(p.exif)).find((g) => g !== null);
      if (gps && coordsSource.current !== 'post' && coordsSource.current !== 'photo') await applyCoords(gps, 'photo');
    },
    [applyCoords],
  );

  useEffect(() => {
    if (launched.current || !params.source) return;
    launched.current = true;
    void pick(params.source);
  }, [params.source, pick]);

  const editDate = () => {
    DateTimePickerAndroid.open({
      value: date,
      mode: 'date',
      onChange: (event, picked) => {
        if (event.type !== 'set' || !picked) return;
        const day = new Date(date);
        day.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
        DateTimePickerAndroid.open({
          value: day,
          mode: 'time',
          is24Hour: true,
          onChange: (timeEvent, time) => {
            const next = new Date(day);
            if (timeEvent.type === 'set' && time) next.setHours(time.getHours(), time.getMinutes(), 0, 0);
            setDate(next);
            dateFixed.current = true;
          },
        });
      },
    });
  };

  const empty = keep.length === 0 && added.length === 0 && !text.trim();

  const save = async () => {
    if (empty || saving) return;
    setSaving(true);
    try {
      const quality = await getPhotoQuality(db);
      const name = place.trim();
      const post = await savePost(
        db,
        {
          createdAt: date,
          text,
          tags: parseTags(tags),
          place: name || coords ? { name, ...(coords ?? {}) } : null,
          keep,
          add: added,
        },
        quality,
        params.id,
      );
      void syncNow(db);
      if (editing) router.back();
      else router.replace(`/post/${post.id}`);
    } catch (e) {
      setSaving(false);
      Alert.alert('Не удалось сохранить', e instanceof Error ? e.message : String(e));
    }
  };

  if (!loaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.muted} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: editing ? 'Правка записи' : 'Новая запись' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {keep.map((m) => (
            <Thumb
              key={m.file}
              uri={dir ? mediaUri(dir, m.thumb) : ''}
              onRemove={() => setKeep((prev) => prev.filter((k) => k.file !== m.file))}
            />
          ))}
          {added.map((p) => (
            <Thumb key={p.uri} uri={p.uri} onRemove={() => setAdded((prev) => prev.filter((a) => a.uri !== p.uri))} />
          ))}
          <Pressable style={styles.addTile} onPress={() => pick('camera')}>
            <Feather name="camera" size={20} color={colors.muted} />
            <Text style={styles.addTileText}>Камера</Text>
          </Pressable>
          <Pressable style={styles.addTile} onPress={() => pick('library')}>
            <Feather name="image" size={20} color={colors.muted} />
            <Text style={styles.addTileText}>Галерея</Text>
          </Pressable>
        </ScrollView>

        <Pressable style={[styles.field, styles.row]} onPress={editDate}>
          <Feather name="calendar" size={16} color={colors.ink} />
          <Text style={styles.fieldText}>{formatDateTime(date)}</Text>
          <Text style={styles.link}>изменить</Text>
        </Pressable>

        <TextInput
          style={[styles.field, styles.textArea]}
          value={text}
          onChangeText={setText}
          placeholder="Что произошло?"
          placeholderTextColor={colors.faint}
          multiline
          textAlignVertical="top"
        />

        <View style={styles.field}>
          <View style={styles.row}>
            <Feather name="map-pin" size={16} color={colors.ink} />
            <TextInput
              style={styles.inlineInput}
              value={place}
              onChangeText={setPlace}
              placeholder="Название места"
              placeholderTextColor={colors.faint}
            />
          </View>
          <View style={[styles.row, styles.coordsRow]}>
            <Text style={styles.coords}>
              {locating ? 'Определяю координаты…' : coords ? formatCoords(coords) : 'Координаты не заданы'}
            </Text>
            <Pressable style={styles.smallButton} hitSlop={6} onPress={() => {
                setLocating(true);
                void locate(true);
              }}
              disabled={locating}>
              <Feather name="crosshair" size={15} color={colors.accent} />
            </Pressable>
            {coords && (
              <Pressable
                style={styles.smallButton}
                hitSlop={6}
                onPress={() => {
                  coordsSource.current = null;
                  setCoords(null);
                }}
              >
                <Feather name="x" size={15} color={colors.muted} />
              </Pressable>
            )}
          </View>
        </View>

        <View style={[styles.field, styles.row]}>
          <Feather name="hash" size={16} color={colors.ink} />
          <TextInput
            style={styles.inlineInput}
            value={tags}
            onChangeText={setTags}
            placeholder="теги через пробел"
            placeholderTextColor={colors.faint}
            autoCapitalize="none"
          />
        </View>

        <Text style={styles.note}>Запись сохраняется на телефон сразу, интернет не нужен.</Text>

        <Pressable style={[styles.save, (empty || saving) && styles.saveOff]} onPress={save} disabled={empty || saving}>
          {saving ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.saveText}>Сохранить</Text>}
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Thumb({ uri, onRemove }: { uri: string; onRemove: () => void }) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.thumb}>
      <Image source={{ uri }} style={styles.thumbImage} contentFit="cover" />
      <Pressable style={styles.remove} onPress={onRemove} hitSlop={8}>
        <Feather name="x" size={12} color={colors.onAccent} />
      </Pressable>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg },
    content: { padding: space.gutter, gap: 10 },
    strip: { gap: 8, paddingBottom: 4 },
    thumb: { width: THUMB, height: THUMB, borderRadius: 10, overflow: 'hidden', backgroundColor: c.photoBg },
    thumbImage: { width: '100%', height: '100%' },
    remove: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: c.overlay,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addTile: {
      width: THUMB,
      height: THUMB,
      borderRadius: 10,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: c.faint,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    addTileText: { fontSize: 11, color: c.muted },
    field: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    coordsRow: { marginTop: 6, paddingLeft: 26 },
    coords: { flex: 1, fontSize: 12, color: c.muted },
    smallButton: { padding: 4 },
    fieldText: { flex: 1, fontSize: 15, color: c.ink },
    link: { fontSize: 13, fontWeight: '600', color: c.accent },
    textArea: { minHeight: 120, fontSize: 15, color: c.ink, lineHeight: 21 },
    inlineInput: { flex: 1, fontSize: 15, color: c.ink, padding: 0 },
    note: { fontSize: 13, color: c.muted },
    save: { marginTop: 6, backgroundColor: c.accent, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
    saveOff: { opacity: 0.5 },
    saveText: { color: c.onAccent, fontSize: 16, fontWeight: '700' },
  });
