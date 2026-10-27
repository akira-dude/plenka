import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { formatStamp } from '@/domain/dates';
import { highlight, snippet } from '@/domain/search';
import type { IndexedPost } from '@/storage/posts';
import { mediaUri } from '@/storage/paths';
import { fonts, type Palette } from './theme';
import { useStyles } from './ThemeProvider';

type Props = { item: IndexedPost; words: string[]; tag: string | null };

export function SearchResult({ item, words, tag }: Props) {
  const styles = useStyles(makeStyles);
  const { post, dir, frame } = item;
  const cover = post.media[0];
  const textWords = tag ? [] : words;
  const place = post.place?.name ?? '';
  const placeHit = !tag && words.some((w) => place.toLowerCase().includes(w));

  const marked = (text: string, hits: string[]) =>
    highlight(text, hits).map((seg, i) => (
      <Text key={i} style={seg.hit ? styles.hit : undefined}>
        {seg.text}
      </Text>
    ));

  return (
    <Pressable style={styles.row} onPress={() => router.push(`/post/${post.id}`)}>
      {cover ? (
        <Image source={{ uri: mediaUri(dir, cover.thumb) }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty]} />
      )}
      <View style={styles.body}>
        <Text style={styles.meta}>
          № {frame} · {formatStamp(post.createdAt)}
        </Text>
        {post.text ? (
          <Text style={styles.text} numberOfLines={3}>
            {marked(snippet(post.text, textWords), textWords)}
          </Text>
        ) : null}
        {post.tags.length > 0 && (
          <Text style={styles.tags}>
            {post.tags.map((t, i) => {
              const hit = tag ? t === tag : words.some((w) => t.includes(w));
              return (
                <Text key={t} style={hit ? styles.tagHit : undefined}>
                  {i > 0 ? ' ' : ''}#{t}
                </Text>
              );
            })}
          </Text>
        )}
        {placeHit && <Text style={styles.place}>{marked(place, words)}</Text>}
      </View>
    </Pressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', backgroundColor: c.card, borderRadius: 12, overflow: 'hidden' },
    thumb: { width: 76, alignSelf: 'stretch', minHeight: 76 },
    thumbEmpty: { backgroundColor: c.photoBg },
    body: { flex: 1, padding: 10, gap: 4 },
    meta: { fontFamily: fonts.mono, fontSize: 11, color: c.muted },
    text: { fontSize: 14, lineHeight: 20, color: c.ink },
    hit: { backgroundColor: c.amberSoft, color: c.amber, fontWeight: '700' },
    tags: { fontSize: 13, color: c.accent },
    tagHit: { fontWeight: '800', backgroundColor: c.accentSoft },
    place: { fontSize: 13, color: c.muted },
  });
