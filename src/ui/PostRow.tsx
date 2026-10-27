import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { formatStamp } from '@/domain/dates';
import type { IndexedPost } from '@/storage/posts';
import { mediaUri } from '@/storage/paths';
import { fonts, type Palette } from './theme';
import { useStyles } from './ThemeProvider';

export function PostRow({ item, showDate = false }: { item: IndexedPost; showDate?: boolean }) {
  const styles = useStyles(makeStyles);
  const { post, dir, frame } = item;
  const cover = post.media[0];
  const when = showDate ? formatStamp(post.createdAt) : post.createdAt.slice(11, 16);
  return (
    <Pressable style={styles.row} onPress={() => router.push(`/post/${post.id}`)}>
      {cover ? (
        <Image source={{ uri: mediaUri(dir, cover.thumb) }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty]} />
      )}
      <View style={styles.body}>
        <Text style={styles.meta}>
          № {frame} · {when}
          {post.media.length > 1 ? ` · ${post.media.length} фото` : ''}
        </Text>
        <Text style={styles.text} numberOfLines={2}>
          {post.text || 'Без текста'}
        </Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', backgroundColor: c.card, borderRadius: 12, overflow: 'hidden' },
    thumb: { width: 72, height: 72 },
    thumbEmpty: { backgroundColor: c.photoBg },
    body: { flex: 1, padding: 10, gap: 4 },
    meta: { fontFamily: fonts.mono, fontSize: 11, color: c.muted },
    text: { fontSize: 14, color: c.ink },
  });
