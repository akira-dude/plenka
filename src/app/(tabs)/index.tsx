import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, SectionList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { dayKey, formatDayTitle } from '@/domain/dates';
import { useDbQuery } from '@/hooks/useDbQuery';
import { listFeed, type IndexedPost } from '@/storage/posts';
import { mediaUri } from '@/storage/paths';
import { PostCard } from '@/ui/PostCard';
import { colors, space } from '@/ui/theme';

const GRID_GAP = 2;

export default function Feed() {
  const { width } = useWindowDimensions();
  const { data } = useDbQuery(listFeed, []);
  const [grid, setGrid] = useState(false);
  const cardWidth = width - space.gutter * 2;
  const cell = (cardWidth - GRID_GAP * 2) / 3;

  const sections = useMemo(() => {
    const byDay = new Map<string, IndexedPost[]>();
    for (const item of data) {
      const key = dayKey(item.post.createdAt);
      byDay.set(key, [...(byDay.get(key) ?? []), item]);
    }
    return [...byDay].map(([key, items]) => ({ key, data: items }));
  }, [data]);

  const renderCard = useCallback(
    ({ item }: { item: IndexedPost }) => <PostCard item={item} width={cardWidth} />,
    [cardWidth],
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.logo}>Плёнка</Text>
      </View>
      <View style={styles.segment}>
        {(['Лента', 'Сетка'] as const).map((label, i) => {
          const on = grid === (i === 1);
          return (
            <Pressable key={label} style={[styles.segItem, on && styles.segOn]} onPress={() => setGrid(i === 1)}>
              <Text style={[styles.segText, on && styles.segTextOn]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {data.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Пока пусто</Text>
          <Text style={styles.emptyText}>Нажми на камеру внизу, чтобы сделать первую запись. Всё хранится на телефоне.</Text>
        </View>
      ) : grid ? (
        <FlatList
          key="grid"
          data={data}
          numColumns={3}
          keyExtractor={(item) => item.post.id}
          contentContainerStyle={styles.gridList}
          columnWrapperStyle={{ gap: GRID_GAP }}
          ItemSeparatorComponent={() => <View style={{ height: GRID_GAP }} />}
          renderItem={({ item }) => {
            const cover = item.post.media[0];
            return (
              <Pressable onPress={() => router.push(`/post/${item.post.id}`)} style={{ width: cell, height: cell }}>
                {cover ? (
                  <Image source={{ uri: mediaUri(item.dir, cover.thumb) }} style={styles.fill} contentFit="cover" />
                ) : (
                  <View style={[styles.fill, styles.textTile]}>
                    <Text style={styles.textTileText} numberOfLines={5}>
                      {item.post.text}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      ) : (
        <SectionList
          key="list"
          sections={sections}
          keyExtractor={(item) => item.post.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => <Text style={styles.day}>{formatDayTitle(section.key)}</Text>}
          renderItem={renderCard}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: space.gutter, paddingTop: 8, paddingBottom: 10 },
  logo: { fontSize: 24, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  segment: {
    flexDirection: 'row',
    marginHorizontal: space.gutter,
    marginBottom: 8,
    padding: 2,
    borderRadius: 10,
    backgroundColor: colors.photoBg,
  },
  segItem: { flex: 1, paddingVertical: 6, borderRadius: 8, alignItems: 'center' },
  segOn: { backgroundColor: colors.card },
  segText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  segTextOn: { color: colors.ink },
  list: { paddingHorizontal: space.gutter, paddingBottom: 24 },
  gridList: { paddingHorizontal: space.gutter, paddingBottom: 24 },
  day: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingTop: 14,
    paddingBottom: 8,
  },
  fill: { width: '100%', height: '100%' },
  textTile: { backgroundColor: colors.card, padding: 8 },
  textTileText: { fontSize: 11, color: colors.ink },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 },
});
