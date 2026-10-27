import { memo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { dayKey, formatDayShort, timeOf } from '@/domain/dates';
import type { IndexedPost } from '@/storage/posts';
import { mediaUri } from '@/storage/paths';
import { FEED_MAX_RATIO, FEED_MIN_RATIO, PhotoFrame, clampRatio } from './PhotoFrame';
import { TagLinks } from './TagLinks';
import { fonts, type Palette } from './theme';
import { useStyles } from './ThemeProvider';

export const PostCard = memo(function PostCard({ item, width }: { item: IndexedPost; width: number }) {
  const styles = useStyles(makeStyles);
  const { post, dir, frame } = item;
  const [page, setPage] = useState(0);
  const cover = post.media[0];
  const open = () => router.push(`/post/${post.id}`);
  const meta = [`${formatDayShort(dayKey(post.createdAt))}, ${timeOf(post.createdAt)}`, post.place?.name]
    .filter(Boolean)
    .join(' · ');
  const frameRatio = cover ? clampRatio(cover.w / cover.h, FEED_MIN_RATIO, FEED_MAX_RATIO) : 1;

  return (
    <View style={styles.card}>
      {cover && post.media.length === 1 && (
        <Pressable onPress={open}>
          <PhotoFrame
            uri={mediaUri(dir, cover.file)}
            blurUri={mediaUri(dir, cover.thumb)}
            w={cover.w}
            h={cover.h}
            width={width}
          />
        </Pressable>
      )}
      {post.media.length > 1 && (
        <View>
          <FlatList
            data={post.media}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(m) => m.file}
            initialNumToRender={1}
            maxToRenderPerBatch={1}
            windowSize={3}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item: m }) => (
              <Pressable onPress={open}>
                <PhotoFrame
                  uri={mediaUri(dir, m.file)}
                  blurUri={mediaUri(dir, m.thumb)}
                  w={m.w}
                  h={m.h}
                  width={width}
                  frameRatio={frameRatio}
                />
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
