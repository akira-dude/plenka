import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { yearsAgo } from '@/domain/dates';
import { mediaUri } from '@/storage/paths';
import type { IndexedPost } from '@/storage/posts';
import { space, type Palette } from './theme';
import { useStyles } from './ThemeProvider';

const TILE = 104;

export function OnThisDay({ items, year }: { items: IndexedPost[]; year: number }) {
  const styles = useStyles(makeStyles);
  if (items.length === 0) return null;
  return (
    <View style={styles.block}>
      <Text style={styles.title}>В этот день</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map(({ post, dir }) => {
          const cover = post.media[0];
          return (
            <Pressable key={post.id} style={styles.tile} onPress={() => router.push(`/post/${post.id}`)}>
              {cover ? (
                <Image source={{ uri: mediaUri(dir, cover.thumb) }} style={styles.image} contentFit="cover" />
              ) : (
                <View style={[styles.image, styles.textTile]}>
                  <Text style={styles.text} numberOfLines={4}>
                    {post.text}
                  </Text>
                </View>
              )}
              <Text style={styles.label}>{yearsAgo(year - Number(post.createdAt.slice(0, 4)))}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    block: { gap: 8, paddingBottom: 6, marginHorizontal: -space.gutter },
    title: { fontSize: 18, fontWeight: '800', color: c.ink, paddingHorizontal: space.gutter, paddingTop: 6 },
    row: { gap: 8, paddingHorizontal: space.gutter },
    tile: { width: TILE, gap: 4 },
    image: { width: TILE, height: TILE, borderRadius: 10, backgroundColor: c.photoBg },
    textTile: { backgroundColor: c.card, padding: 8 },
    text: { fontSize: 11, color: c.ink },
    label: { fontSize: 12, fontWeight: '600', color: c.muted },
  });
