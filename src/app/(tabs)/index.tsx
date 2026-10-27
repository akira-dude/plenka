import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, SectionList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { monthTitle } from '@/domain/dates';
import { useDbQuery } from '@/hooks/useDbQuery';
import { listFeed, type IndexedPost } from '@/storage/posts';
import { mediaUri } from '@/storage/paths';
import { useSyncState } from '@/sync/engine';
import { PostCard } from '@/ui/PostCard';
import { space, type Palette } from '@/ui/theme';
import { useStyles, useTheme } from '@/ui/ThemeProvider';

const GRID_GAP = 2;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function Feed() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { data } = useDbQuery(listFeed, []);
  const [grid, setGrid] = useState(false);
  const [month, setMonth] = useState<string | null>(null);
  const sync = useSyncState();
  const cardWidth = width - space.gutter * 2;
  const cell = (cardWidth - GRID_GAP * 2) / 3;

  const allSections = useMemo(() => {
    const byMonth = new Map<string, IndexedPost[]>();
    for (const item of data) {
      const key = item.post.createdAt.slice(0, 7);
      byMonth.set(key, [...(byMonth.get(key) ?? []), item]);
    }
    return [...byMonth].map(([key, items]) => ({ key, data: items }));
  }, [data]);

  const activeMonth = month && allSections.some((s) => s.key === month) ? month : null;
  const sections = activeMonth ? allSections.filter((s) => s.key === activeMonth) : allSections;
  const visible = useMemo(() => sections.flatMap((s) => s.data), [sections]);

  const renderCard = useCallback(
    ({ item }: { item: IndexedPost }) => <PostCard item={item} width={cardWidth} />,
    [cardWidth],
  );

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
      {allSections.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.months}
          contentContainerStyle={styles.monthsContent}
        >
          {[{ key: null as string | null, label: 'Все', count: data.length }, ...allSections.map((s) => ({
            key: s.key as string | null,
            label: capitalize(monthTitle(s.key)),
            count: s.data.length,
          }))].map((chip) => {
            const on = chip.key === activeMonth;
            return (
              <Pressable key={chip.key ?? 'all'} style={[styles.chip, on && styles.chipOn]} onPress={() => setMonth(chip.key)}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>
                  {chip.label} · {chip.count}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {data.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Пока пусто</Text>
          <Text style={styles.emptyText}>Нажми на камеру внизу, чтобы сделать первую запись. Всё хранится на телефоне.</Text>
        </View>
      ) : grid ? (
        <FlatList
          key="grid"
          data={visible}
          numColumns={3}
          keyExtractor={(item) => item.post.id}
          contentContainerStyle={styles.list}
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
          stickySectionHeadersEnabled
          renderSectionHeader={({ section }) => <Text style={styles.month}>{capitalize(monthTitle(section.key))}</Text>}
          renderItem={renderCard}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
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
    month: { fontSize: 18, fontWeight: '800', color: c.ink, paddingTop: 14, paddingBottom: 10, backgroundColor: c.bg },
    months: { flexGrow: 0, marginTop: 8 },
    monthsContent: { paddingHorizontal: space.gutter, gap: 6 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, borderWidth: 1, borderColor: c.line, backgroundColor: c.card },
    chipOn: { backgroundColor: c.ink, borderColor: c.ink },
    chipText: { fontSize: 13, fontWeight: '600', color: c.muted },
    chipTextOn: { color: c.bg },
    fill: { width: '100%', height: '100%' },
    textTile: { backgroundColor: c.card, padding: 8 },
    textTileText: { fontSize: 11, color: c.ink },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 8 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: c.ink },
    emptyText: { fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 20 },
  });
