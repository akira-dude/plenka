import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import Feather from '@expo/vector-icons/Feather';
import { useDbQuery } from '@/hooks/useDbQuery';
import { mediaUri } from '@/storage/paths';
import { getPost } from '@/storage/posts';
import { ZoomableImage } from '@/ui/ZoomableImage';
import { fonts } from '@/ui/theme';

const VIEWER_BG = '#000000';
const VIEWER_FG = '#FFFFFF';

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

  return (
    <View style={styles.screen}>
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
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <ZoomableImage uri={mediaUri(data.dir, item.file)} width={width} height={height} onZoomChange={setZoomed} />
          )}
        />
      )}
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.close} hitSlop={8} accessibilityLabel="Закрыть" onPress={() => router.back()}>
          <Feather name="x" size={24} color={VIEWER_FG} />
        </Pressable>
        {media.length > 1 && (
          <Text style={styles.counter}>
            {page + 1} / {media.length}
          </Text>
        )}
      </View>
    </View>
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
  close: { padding: 10, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 24 },
  counter: { fontFamily: fonts.mono, color: VIEWER_FG, fontSize: 13, paddingHorizontal: 12 },
});
