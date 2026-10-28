import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import Feather from '@expo/vector-icons/Feather';
import { sharePhoto } from '@/device/share';
import { useDbQuery } from '@/hooks/useDbQuery';
import type { MediaItem } from '@/domain/post';
import { useMediaUri } from '@/hooks/useMediaUri';
import { getPost } from '@/storage/posts';
import { originalUri } from '@/sync/media';
import { rememberViewerPage } from '@/ui/viewerPage';
import { ZoomableImage } from '@/ui/ZoomableImage';
import { fonts } from '@/ui/theme';

const VIEWER_BG = '#000000';
const VIEWER_FG = '#FFFFFF';
const BUTTON_BG = 'rgba(0,0,0,0.35)';

export default function Viewer() {
  const { id, index } = useLocalSearchParams<{ id: string; index?: string }>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const start = Number(index) || 0;
  const [page, setPage] = useState(start);
  const [zoomed, setZoomed] = useState(false);

  const query = useCallback((db: SQLiteDatabase) => getPost(db, id), [id]);
  const { data } = useDbQuery(query, null);
  const media = data?.post.media ?? [];

  const db = useSQLiteContext();
  const share = (dir: string, m: MediaItem) =>
    originalUri(db, dir, m)
      .then(sharePhoto)
      .catch((e: unknown) => Alert.alert('Не удалось поделиться', e instanceof Error ? e.message : String(e)));

  const current = data && media.length ? media[Math.min(page, media.length - 1)] : null;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <NavigationBar style="light" />
      {data && (
        <FlatList
          data={media}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          initialScrollIndex={Math.min(start, Math.max(0, media.length - 1))}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(m) => m.file}
          onMomentumScrollEnd={(e) => {
            const next = Math.round(e.nativeEvent.contentOffset.x / width);
            setPage(next);
            rememberViewerPage(id, next);
          }}
          renderItem={({ item }) => (
            <ViewerPage
              dir={data.dir}
              item={item}
              width={width}
              height={height}
              onZoomChange={setZoomed}
              onShare={() => share(data.dir, item)}
            />
          )}
        />
      )}
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.button} hitSlop={8} accessibilityLabel="Закрыть" onPress={() => router.back()}>
          <Feather name="x" size={24} color={VIEWER_FG} />
        </Pressable>
        {media.length > 1 && (
          <Text style={styles.counter}>
            {page + 1} / {media.length}
          </Text>
        )}
        <Pressable
          style={styles.button}
          hitSlop={8}
          accessibilityLabel="Поделиться фото"
          disabled={!current}
          onPress={() => data && current && share(data.dir, current)}
        >
          <Feather name="share-2" size={22} color={VIEWER_FG} />
        </Pressable>
      </View>
    </View>
  );
}

type PageProps = {
  dir: string;
  item: MediaItem;
  width: number;
  height: number;
  onZoomChange: (zoomed: boolean) => void;
  onShare: () => void;
};

function ViewerPage({ dir, item, width, height, onZoomChange, onShare }: PageProps) {
  const uri = useMediaUri(dir, item, true);
  return (
    <ZoomableImage
      uri={uri}
      width={width}
      height={height}
      onZoomChange={onZoomChange}
      onDismiss={() => router.back()}
      onShare={onShare}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: VIEWER_BG },
  top: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  button: { padding: 10, backgroundColor: BUTTON_BG, borderRadius: 24 },
  counter: { fontFamily: fonts.mono, color: VIEWER_FG, fontSize: 13, paddingHorizontal: 12 },
});
