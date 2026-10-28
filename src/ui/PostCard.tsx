import { memo, useEffect, useRef } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { MediaItem } from '@/domain/post';
import { setPhotoPage, usePhotoPage } from '@/hooks/usePhotoPage';
import { dayKey, formatDayShort, timeOf } from '@/domain/dates';
import type { IndexedPost } from '@/storage/posts';
import { MediaFrame } from './MediaFrame';
import { FEED_MAX_RATIO, FEED_MIN_RATIO, clampRatio } from './PhotoFrame';
import { TagLinks } from './TagLinks';
import { fonts, type Palette } from './theme';
import { useStyles } from './ThemeProvider';

export const PostCard = memo(function PostCard({ item, width }: { item: IndexedPost; width: number }) {
  const styles = useStyles(makeStyles);
  const { post, dir, frame } = item;
  const count = post.media.length;
  const page = Math.min(usePhotoPage(post.id), Math.max(0, count - 1));
  const pager = useRef<FlatList<MediaItem>>(null);
  const cover = post.media[0];

  useEffect(() => {
    if (count > 1) pager.current?.scrollToIndex({ index: page, animated: false });
  }, [page, count]);

  const open = () => router.push(`/post/${post.id}`);
  const openPhoto = (index: number) => {
    setPhotoPage(post.id, index);
    router.push({ pathname: '/post/[id]', params: { id: post.id, photo: String(index) } });
    router.push({ pathname: '/viewer/[id]', params: { id: post.id, index: String(index) } });
  };
  const meta = [`${formatDayShort(dayKey(post.createdAt))}, ${timeOf(post.createdAt)}`, post.place?.name]
    .filter(Boolean)
    .join(' · ');
  const frameRatio = cover ? clampRatio(cover.w / cover.h, FEED_MIN_RATIO, FEED_MAX_RATIO) : 1;

  return (
    <View style={styles.card}>
      {cover && post.media.length === 1 && (
        <Pressable onPress={() => openPhoto(0)}>
          <MediaFrame dir={dir} item={cover} fetch={false} width={width} />
        </Pressable>
      )}
      {post.media.length > 1 && (
        <View>
          <FlatList
            ref={pager}
            data={post.media}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(m) => m.file}
            initialNumToRender={1}
            maxToRenderPerBatch={1}
            windowSize={3}
            initialScrollIndex={page}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            onMomentumScrollEnd={(e) => setPhotoPage(post.id, Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item: m, index }) => (
              <Pressable onPress={() => openPhoto(index)}>
                <MediaFrame dir={dir} item={m} fetch={false} width={width} frameRatio={frameRatio} />
              </Pressable>
            )}
          />
          <Text style={styles.count}>
            {page + 1} / {post.media.length}
          </Text>
        </View>
      )}
      <Pressable style={styles.body} onPress={open}>
        <Text style={styles.frame}>№ {frame}</Text>
        {post.text ? (
          <Text style={styles.text} numberOfLines={5}>
            {post.text}
          </Text>
        ) : null}
        <TagLinks tags={post.tags} size={13} />
        <Text style={styles.meta}>{meta}</Text>
      </Pressable>
    </View>
  );
});

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: { backgroundColor: c.card, borderRadius: 14, overflow: 'hidden' },
    body: { padding: 12, gap: 6 },
    frame: { fontFamily: fonts.mono, fontSize: 11, color: c.muted },
    text: { fontSize: 15, lineHeight: 21, color: c.ink },
    meta: { fontSize: 12, color: c.muted },
    count: {
      position: 'absolute',
      top: 10,
      right: 10,
      fontFamily: fonts.mono,
      fontSize: 11,
      color: c.onAccent,
      backgroundColor: c.overlay,
      borderRadius: 99,
      paddingHorizontal: 8,
      paddingVertical: 2,
      overflow: 'hidden',
    },
  });
