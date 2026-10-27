import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import Feather from '@expo/vector-icons/Feather';
import {
  WEEKDAYS_SHORT,
  dayKey,
  dayKeyOf,
  formatDayLong,
  formatDayShort,
  monthCells,
  monthTitle,
  shiftMonth,
  timeOf,
} from '@/domain/dates';
import { useDbQuery } from '@/hooks/useDbQuery';
import { listDays, type IndexedPost } from '@/storage/posts';
import { mediaUri } from '@/storage/paths';
import { colors, fonts, space } from '@/ui/theme';

const CELL_GAP = 4;

export default function Archive() {
  const { width } = useWindowDimensions();
  const today = dayKeyOf(new Date());
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);

  const query = useCallback((db: SQLiteDatabase) => listDays(db, `${month}-01`, `${month}-31`), [month]);
  const { data } = useDbQuery(query, []);

  const byDay = useMemo(() => {
    const map = new Map<string, IndexedPost[]>();
    for (const item of data) {
      const key = dayKey(item.post.createdAt);
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return map;
  }, [data]);

  const cells = useMemo(() => monthCells(month), [month]);
  const cell = (width - space.gutter * 2 - CELL_GAP * 6) / 7;
  const dayPosts = byDay.get(selected) ?? [];

  const goMonth = (delta: number) => {
    const next = shiftMonth(month, delta);
    setMonth(next);
    setSelected(next === today.slice(0, 7) ? today : `${next}-01`);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Архив</Text>
          <View style={styles.monthNav}>
            <Pressable hitSlop={10} onPress={() => goMonth(-1)}>
              <Feather name="chevron-left" size={20} color={colors.ink} />
            </Pressable>
            <Text style={styles.month}>{monthTitle(month)}</Text>
            <Pressable hitSlop={10} onPress={() => goMonth(1)}>
              <Feather name="chevron-right" size={20} color={colors.ink} />
            </Pressable>
          </View>
        </View>

        <View style={styles.grid}>
          {WEEKDAYS_SHORT.map((w) => (
            <Text key={w} style={[styles.weekday, { width: cell }]}>
              {w}
            </Text>
          ))}
          {cells.map((key, i) => {
            if (!key) return <View key={`e${i}`} style={{ width: cell, height: cell }} />;
            const posts = byDay.get(key);
            const cover = posts?.find((p) => p.post.media.length)?.post.media[0];
            const coverDir = posts?.find((p) => p.post.media.length)?.dir;
            return (
              <Pressable
                key={key}
                onPress={() => setSelected(key)}
                style={[
                  styles.cell,
                  { width: cell, height: cell },
                  key === today && styles.today,
                  key === selected && styles.selected,
                ]}
              >
                <Text style={[styles.num, posts && styles.numOn]}>{Number(key.slice(8))}</Text>
                {cover && coverDir ? (
                  <Image source={{ uri: mediaUri(coverDir, cover.thumb) }} style={styles.mini} contentFit="cover" />
                ) : posts ? (
                  <View style={styles.dot} />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.dayTitle}>{formatDayLong(selected)}</Text>
        {dayPosts.length === 0 && <Text style={styles.none}>В этот день записей нет.</Text>}
        {dayPosts.map(({ post, dir }) => (
          <Pressable key={post.id} style={styles.row} onPress={() => router.push(`/post/${post.id}`)}>
            {post.media[0] ? (
              <Image source={{ uri: mediaUri(dir, post.media[0].thumb) }} style={styles.rowThumb} contentFit="cover" />
            ) : (
              <View style={[styles.rowThumb, styles.rowThumbEmpty]} />
            )}
            <View style={styles.rowBody}>
              <Text style={styles.rowMeta}>
                № {post.frame} · {timeOf(post.createdAt)}
                {post.media.length > 1 ? ` · ${post.media.length} фото` : ''}
              </Text>
              <Text style={styles.rowText} numberOfLines={2}>
                {post.text || 'Без текста'}
              </Text>
            </View>
          </Pressable>
        ))}

        <Pressable
          style={styles.add}
          onPress={() => router.push({ pathname: '/compose', params: { date: selected } })}
        >
          <Feather name="plus" size={16} color={colors.ink} />
          <Text style={styles.addText}>Запись на {formatDayShort(selected)}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.gutter, paddingBottom: 32, gap: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  month: { fontFamily: fonts.mono, fontSize: 13, color: colors.ink, minWidth: 116, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: CELL_GAP },
  weekday: { textAlign: 'center', fontSize: 11, fontWeight: '600', color: colors.muted, paddingBottom: 2 },
  cell: { borderRadius: 8, alignItems: 'center', paddingTop: 4, gap: 3 },
  today: { borderWidth: 1, borderColor: colors.faint },
  selected: { backgroundColor: colors.accentSoft, borderWidth: 1.5, borderColor: colors.accent },
  num: { fontFamily: fonts.mono, fontSize: 12, color: colors.faint },
  numOn: { color: colors.ink, fontWeight: '700' },
  mini: { width: '62%', flex: 1, maxHeight: 22, borderRadius: 4 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.ink },
  dayTitle: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  none: { fontSize: 14, color: colors.muted },
  row: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 12, overflow: 'hidden' },
  rowThumb: { width: 72, height: 72 },
  rowThumbEmpty: { backgroundColor: colors.photoBg },
  rowBody: { flex: 1, padding: 10, gap: 4 },
  rowMeta: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted },
  rowText: { fontSize: 14, color: colors.ink },
  add: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.faint,
    backgroundColor: colors.card,
  },
  addText: { fontSize: 15, fontWeight: '600', color: colors.ink },
});
