import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import Feather from '@expo/vector-icons/Feather';
import { sharePhoto } from '@/device/share';
import { formatStamp } from '@/domain/dates';
import { useDbQuery } from '@/hooks/useDbQuery';
import { mediaUri } from '@/storage/paths';
import { deletePost, getPost } from '@/storage/posts';
import { syncNow, syncedRev, useSyncState } from '@/sync/engine';
import { PhotoFrame, clampRatio } from '@/ui/PhotoFrame';
import { TagLinks } from '@/ui/TagLinks';
import { fonts, space, type Palette } from '@/ui/theme';
import { useStyles, useTheme } from '@/ui/ThemeProvider';

const MAX_PHOTO_SHARE = 0.72;
const PANORAMA_RATIO = 3;

export default function PostScreen() {
  const db = useSQLiteContext();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width, height } = useWindowDimensions();
  const [page, setPage] = useState(0);

  const sync = useSyncState();
  const query = useCallback(
    async (database: SQLiteDatabase) => {
      const found = await getPost(database, id);
      return found ? { ...found, synced: await syncedRev(database, id) } : null;
    },
    [id],
  );
  const { data } = useDbQuery(query, null);

  const confirmDelete = () =>
    Alert.alert('Удалить запись?', 'Фото этой записи удалятся с телефона.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          await deletePost(db, id);
          void syncNow(db);
          router.back();
        },
      },
    ]);

  const share = (uri: string) =>
    sharePhoto(uri).catch((e: unknown) => Alert.alert('Не удалось поделиться', e instanceof Error ? e.message : String(e)));

  if (!data || data.post.deleted) {
    return <Stack.Screen options={{ title: '' }} />;
  }

  const { post, dir, frame } = data;
  const first = post.media[0];
  const frameRatio = first ? clampRatio(first.w / first.h, width / (height * MAX_PHOTO_SHARE), PANORAMA_RATIO) : 1;
  const hasCoords = post.place?.lat != null && post.place.lon != null;
  const status = !sync.account
    ? 'только на телефоне'
    : data.synced !== null && data.synced >= post.rev
      ? 'в Google Drive'
      : 'ждёт отправки в Drive';

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: `№ ${frame}`,
          headerRight: () => (
            <View style={styles.actions}>
              {post.media.length > 0 && (
                <Pressable
                  style={styles.action}
                  hitSlop={6}
                  accessibilityLabel="Поделиться фото"
                  onPress={() => share(mediaUri(dir, post.media[Math.min(page, post.media.length - 1)].file))}
                >
                  <Feather name="share-2" size={18} color={colors.ink} />
                </Pressable>
              )}
              <Pressable
                style={styles.action}
                hitSlop={6}
                accessibilityLabel="Править запись"
                onPress={() => router.push({ pathname: '/compose', params: { id: post.id } })}
              >
                <Feather name="edit-2" size={18} color={colors.ink} />
              </Pressable>
              <Pressable style={styles.action} hitSlop={6} accessibilityLabel="Удалить запись" onPress={confirmDelete}>
                <Feather name="trash-2" size={18} color={colors.danger} />
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]}>
        {first && (
          <>
            <FlatList
              data={post.media}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(m) => m.file}
              onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
              renderItem={({ item, index }) => (
                <Pressable onPress={() => router.push({ pathname: '/viewer/[id]', params: { id: post.id, index } })}>
                  <PhotoFrame
                    uri={mediaUri(dir, item.file)}
                    blurUri={mediaUri(dir, item.thumb)}
                    w={item.w}
                    h={item.h}
                    width={width}
                    frameRatio={frameRatio}
                    fit="whole"
                  />
                </Pressable>
              )}
            />
            {post.media.length > 1 && (
              <View style={styles.dots}>
                {post.media.map((m, i) => (
                  <View key={m.file} style={[styles.dot, i === page && styles.dotOn]} />
                ))}
              </View>
            )}
          </>
        )}

        <View style={styles.body}>
          <Text style={styles.stamp}>{formatStamp(post.createdAt)}</Text>
          {post.place && (
            <Pressable
              style={styles.place}
              disabled={!hasCoords}
              onPress={() => router.push({ pathname: '/map', params: { focus: post.id } })}
            >
              <Feather name="map-pin" size={14} color={hasCoords ? colors.accent : colors.muted} />
              <Text style={[styles.placeText, hasCoords && styles.placeLink]}>
                {post.place.name || 'Место на карте'}
              </Text>
            </Pressable>
          )}
          {post.text ? <Text style={styles.text}>{post.text}</Text> : null}
          <TagLinks tags={post.tags} />
          <Text style={[styles.stamp, styles.footer]}>
            {status} · правка {post.rev}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    content: { paddingBottom: 32 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: -8 },
    action: { padding: 10 },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingTop: 10 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.faint },
    dotOn: { width: 18, backgroundColor: c.ink },
    body: { paddingHorizontal: space.gutter, paddingTop: 12, gap: 10 },
    stamp: { fontFamily: fonts.mono, fontSize: 12, color: c.muted },
    place: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
    placeText: { fontSize: 14, color: c.muted },
    placeLink: { color: c.accent, fontWeight: '500' },
    text: { fontSize: 16, lineHeight: 24, color: c.ink },
    footer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.line },
  });
