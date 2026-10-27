import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, SectionList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import Feather from '@expo/vector-icons/Feather';
import { dayKeyOf, monthTitle } from '@/domain/dates';
import { useDbQuery } from '@/hooks/useDbQuery';
import { listFeedPage, listOnThisDay, monthCounts, type FeedPage, type IndexedPost } from '@/storage/posts';
import { mediaUri } from '@/storage/paths';
import { useSyncState } from '@/sync/engine';
import { MonthPicker } from '@/ui/MonthPicker';
import { OnThisDay } from '@/ui/OnThisDay';
import { PostCard } from '@/ui/PostCard';
import { RestoreOffer } from '@/ui/RestoreOffer';
import { space, type Palette } from '@/ui/theme';
import { useStyles, useTheme } from '@/ui/ThemeProvider';

const GRID_GAP = 2;
const PAGE_SIZE = 30;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type FeedData = { page: FeedPage; counts: Map<string, number>; memories: IndexedPost[] };

export default function Feed() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [grid, setGrid] = useState(false);
  const [month, setMonth] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [picking, setPicking] = useState(false);
  const sync = useSyncState();
  const cardWidth = width - space.gutter * 2;
  const cell = (cardWidth - GRID_GAP * 2) / 3;

  const today = dayKeyOf(new Date());
  const query = useCallback(
    async (db: SQLiteDatabase): Promise<FeedData> => ({
      page: await listFeedPage(db, month, limit),
      counts: await monthCounts(db),
      memories: month ? [] : await listOnThisDay(db, today),
    }),
    [month, limit, today],
  );
  const { data, reload } = useDbQuery<FeedData | null>(query, null);
  const items = useMemo(() => data?.page.items ?? [], [data]);
  const counts = useMemo(() => data?.counts ?? new Map<string, number>(), [data]);
  const total = useMemo(() => [...counts.values()].reduce((a, b) => a + b, 0), [counts]);
  const hasMore = data?.page.hasMore ?? false;

  const sections = useMemo(() => {
    const byMonth = new Map<string, IndexedPost[]>();
    for (const item of items) {
      const key = item.post.createdAt.slice(0, 7);
      byMonth.set(key, [...(byMonth.get(key) ?? []), item]);
    }
    return [...byMonth].map(([key, list]) => ({ key, data: list }));
  }, [items]);

  const chooseMonth = (next: string | null) => {
    setMonth(next);
    setLimit(PAGE_SIZE);
  };

  const loadMore = () => {
    if (hasMore && items.length >= limit) setLimit((l) => l + PAGE_SIZE);
  };

  const renderCard = useCallback(
    ({ item }: { item: IndexedPost }) => <PostCard item={item} width={cardWidth} />,
    [cardWidth],
  );

  const header = data?.memories.length ? (
    <OnThisDay items={data.memories} year={Number(today.slice(0, 4))} />
  ) : undefined;
  const footer = hasMore ? <ActivityIndicator style={styles.more} color={colors.muted} /> : undefined;
  const listKey = `${grid ? 'grid' : 'list'}-${month ?? 'all'}`;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.logo}>Плёнка</Text>
        <View style={styles.headerRight}>
          {sync.account && (sync.running || sync.queued > 0) && (
            <Pressable style={styles.pill} onPress={() => router.push('/settings')}>
              <Feather name={sync.running ? 'refresh-cw' : 'upload-cloud'} size={12} color={colors.amber} />
              <Text style={styles.pillText}>{sync.running ? 'отправка' : `ждут: ${sync.queued}`}</Text>
            </Pressable>
          )}
          <Pressable style={styles.iconButton} hitSlop={8} onPress={() => router.push('/map')}>
            <Feather name="map" size={20} color={colors.ink} />
          </Pressable>
        </View>
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
      {total > 0 && (
        <View style={styles.filterRow}>
          <Pressable style={[styles.select, month && styles.selectOn]} onPress={() => setPicking(true)}>
            <Feather name="calendar" size={15} color={month ? colors.accent : colors.muted} />
            <Text style={[styles.selectText, month && styles.selectTextOn]} numberOfLines={1}>
              {month ? capitalize(monthTitle(month)) : 'Все месяцы'} · {month ? (counts.get(month) ?? 0) : total}
            </Text>
            <Feather name="chevron-down" size={16} color={month ? colors.accent : colors.muted} />
          </Pressable>
          {month && (
            <Pressable style={styles.clear} hitSlop={8} accessibilityLabel="Показать все месяцы" onPress={() => chooseMonth(null)}>
              <Feather name="x" size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>
      )}
      <MonthPicker
        visible={picking}
        value={month}
        counts={counts}
        onSelect={chooseMonth}
        onClose={() => setPicking(false)}
      />

      {!data ? (
        <ActivityIndicator style={styles.more} color={colors.muted} />
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{month ? 'В этом месяце записей нет' : 'Пока пусто'}</Text>
          {!month && (
            <Text style={styles.emptyText}>Нажми на камеру внизу, чтобы сделать первую запись. Всё хранится на телефоне.</Text>
          )}
          {!month && total === 0 && <RestoreOffer onDone={reload} />}
        </View>
      ) : grid ? (
        <FlatList
          key={listKey}
          data={items}
          numColumns={3}
          keyExtractor={(item) => item.post.id}
          contentContainerStyle={styles.list}
          columnWrapperStyle={{ gap: GRID_GAP }}
          ItemSeparatorComponent={() => <View style={{ height: GRID_GAP }} />}
          onEndReached={loadMore}
          onEndReachedThreshold={1.5}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          initialNumToRender={18}
          windowSize={9}
          removeClippedSubviews
          renderItem={({ item }) => {
            const cover = item.post.media[0];
            return (
              <Pressable onPress={() => router.push(`/post/${item.post.id}`)} style={{ width: cell, height: cell }}>
                {cover ? (
                  <Image
                    source={{ uri: mediaUri(item.dir, cover.thumb) }}
                    style={styles.fill}
                    contentFit="cover"
                    recyclingKey={item.post.id}
                  />
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
          key={listKey}
          sections={sections}
          keyExtractor={(item) => item.post.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled
          renderSectionHeader={({ section }) => <Text style={styles.month}>{capitalize(monthTitle(section.key))}</Text>}
          renderItem={renderCard}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          onEndReached={loadMore}
          onEndReachedThreshold={1.5}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={7}
          removeClippedSubviews
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: space.gutter,
      paddingTop: 8,
      paddingBottom: 10,
    },
    logo: { fontSize: 24, fontWeight: '800', color: c.ink, letterSpacing: -0.5 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: c.amberSoft,
      borderRadius: 99,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    pillText: { fontSize: 12, fontWeight: '600', color: c.amber },
    iconButton: { padding: 8 },
    segment: {
      flexDirection: 'row',
      marginHorizontal: space.gutter,
      marginBottom: 4,
      padding: 2,
      borderRadius: 10,
      backgroundColor: c.photoBg,
    },
    segItem: { flex: 1, paddingVertical: 6, borderRadius: 8, alignItems: 'center' },
    segOn: { backgroundColor: c.card },
    segText: { fontSize: 13, fontWeight: '600', color: c.muted },
    segTextOn: { color: c.ink },
    list: { paddingHorizontal: space.gutter, paddingTop: 8, paddingBottom: 24 },
    more: { marginVertical: 24 },
    month: { fontSize: 18, fontWeight: '800', color: c.ink, paddingTop: 14, paddingBottom: 10, backgroundColor: c.bg },
    filterRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.gutter, marginTop: 8 },
    select: {
      flexShrink: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.line,
      backgroundColor: c.card,
    },
    selectOn: { borderColor: c.accent, backgroundColor: c.accentSoft },
    selectText: { flexShrink: 1, fontSize: 14, fontWeight: '600', color: c.ink },
    selectTextOn: { color: c.accent },
    clear: { padding: 8 },
    fill: { width: '100%', height: '100%' },
    textTile: { backgroundColor: c.card, padding: 8 },
    textTileText: { fontSize: 11, color: c.ink },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 8 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: c.ink },
    emptyText: { fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 20 },
  });
