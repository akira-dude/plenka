import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import Feather from '@expo/vector-icons/Feather';
import { formatStamp } from '@/domain/dates';
import { useDbQuery } from '@/hooks/useDbQuery';
import { mediaUri } from '@/storage/paths';
import { deletePost, getPost } from '@/storage/posts';
import { PhotoFrame, clampRatio } from '@/ui/PhotoFrame';
import { colors, fonts, space } from '@/ui/theme';

const MAX_PHOTO_SHARE = 0.72;
const PANORAMA_RATIO = 3;

export default function PostScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width, height } = useWindowDimensions();
  const [page, setPage] = useState(0);

  const query = useCallback((database: SQLiteDatabase) => getPost(database, id), [id]);
  const { data } = useDbQuery(query, null);

  const confirmDelete = () =>
    Alert.alert('Удалить запись?', 'Фото этой записи удалятся с телефона.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          await deletePost(db, id);
          router.back();
        },
      },
    ]);

  if (!data || data.post.deleted) {
    return <Stack.Screen options={{ title: '' }} />;
  }

  const { post, dir } = data;
  const first = post.media[0];
  const frameRatio = first ? clampRatio(first.w / first.h, width / (height * MAX_PHOTO_SHARE), PANORAMA_RATIO) : 1;

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: `№ ${post.frame}`,
          headerRight: () => (
            <Pressable hitSlop={10} onPress={() => router.push({ pathname: '/compose', params: { id: post.id } })}>
              <Feather name="edit-2" size={18} color={colors.ink} />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {first && (
          <>
            <FlatList
              data={post.media}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(m) => m.file}
              onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
              renderItem={({ item }) => (
                <PhotoFrame
                  uri={mediaUri(dir, item.file)}
                  blurUri={mediaUri(dir, item.thumb)}
                  w={item.w}
                  h={item.h}
                  width={width}
                  frameRatio={frameRatio}
                />
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
          <Text style={styles.stamp}>
            {formatStamp(post.createdAt)}
            {post.place ? ` · ${post.place.name}` : ''}
          </Text>
          {post.text ? <Text style={styles.text}>{post.text}</Text> : null}
          {post.tags.length > 0 && <Text style={styles.tags}>{post.tags.map((t) => `#${t}`).join(' ')}</Text>}
          <View style={styles.footer}>
            <Text style={styles.stamp}>на телефоне · правка {post.rev}</Text>
            <Pressable hitSlop={10} onPress={confirmDelete}>
              <Text style={styles.delete}>Удалить</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 32 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.faint },
  dotOn: { width: 18, backgroundColor: colors.ink },
  body: { paddingHorizontal: space.gutter, paddingTop: 12, gap: 10 },
  stamp: { fontFamily: fonts.mono, fontSize: 12, color: colors.muted },
  text: { fontSize: 16, lineHeight: 24, color: colors.ink },
  tags: { fontSize: 14, fontWeight: '500', color: colors.accent },
  footer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  delete: { fontSize: 14, fontWeight: '600', color: colors.danger },
});
