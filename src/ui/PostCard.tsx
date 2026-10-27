import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { dayKey, formatDayShort, timeOf } from '@/domain/dates';
import type { IndexedPost } from '@/storage/posts';
import { mediaUri } from '@/storage/paths';
import { PhotoFrame } from './PhotoFrame';
import { fonts, type Palette } from './theme';
import { useStyles } from './ThemeProvider';

export function PostCard({ item, width }: { item: IndexedPost; width: number }) {
  const styles = useStyles(makeStyles);
  const { post, dir, frame } = item;
  const cover = post.media[0];
  const meta = [`${formatDayShort(dayKey(post.createdAt))}, ${timeOf(post.createdAt)}`, post.place?.name]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable style={styles.card} onPress={() => router.push(`/post/${post.id}`)}>
      {cover && (
        <PhotoFrame uri={mediaUri(dir, cover.file)} w={cover.w} h={cover.h} width={width}>
          {post.media.length > 1 && <Text style={styles.count}>1 / {post.media.length}</Text>}
        </PhotoFrame>
      )}
      <View style={styles.body}>
        <Text style={styles.frame}>№ {frame}</Text>
        {post.text ? (
          <Text style={styles.text} numberOfLines={5}>
            {post.text}
          </Text>
        ) : null}
        {post.tags.length > 0 && <Text style={styles.tags}>{post.tags.map((t) => `#${t}`).join(' ')}</Text>}
        <Text style={styles.meta}>{meta}</Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: { backgroundColor: c.card, borderRadius: 14, overflow: 'hidden' },
    body: { padding: 12, gap: 6 },
    frame: { fontFamily: fonts.mono, fontSize: 11, color: c.muted },
    text: { fontSize: 15, lineHeight: 21, color: c.ink },
    tags: { fontSize: 13, color: c.accent, fontWeight: '500' },
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
