import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
} from '@/domain/dates';
import { useDbQuery } from '@/hooks/useDbQuery';
import { listDays, monthCounts, type IndexedPost } from '@/storage/posts';
import { mediaUri } from '@/storage/paths';
import { MonthPicker } from '@/ui/MonthPicker';
import { PostRow } from '@/ui/PostRow';
import { fonts, space, type Palette } from '@/ui/theme';
import { useStyles, useTheme } from '@/ui/ThemeProvider';

const CELL_GAP = 4;

function weeks(cells: (string | null)[]): (string | null)[][] {
  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

export default function Archive() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const today = dayKeyOf(new Date());
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);

  const [picking, setPicking] = useState(false);
  const current = today.slice(0, 7);
  const atLatest = month >= current;

  const query = useCallback((db: SQLiteDatabase) => listDays(db, `${month}-01`, `${month}-31`), [month]);
  const { data } = useDbQuery(query, []);
  const { data: counts } = useDbQuery(monthCounts, new Map<string, number>());

  const byDay = useMemo(() => {
    const map = new Map<string, IndexedPost[]>();
    for (const item of data) {
      const key = dayKey(item.post.createdAt);
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return map;
  }, [data]);

  const rows = useMemo(() => weeks(monthCells(month)), [month]);
  const dayPosts = byDay.get(selected) ?? [];

  const openMonth = (next: string) => {
    const clamped = next > current ? current : next;
    setMonth(clamped);
    setSelected(clamped === current ? today : `${clamped}-01`);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Архив</Text>
          <View style={styles.monthNav}>
            <Pressable style={styles.navButton} hitSlop={8} onPress={() => openMonth(shiftMonth(month, -1))}>
              <Feather name="chevron-left" size={20} color={colors.ink} />
            </Pressable>
            <Pressable style={styles.monthButton} onPress={() => setPicking(true)} accessibilityLabel="Выбрать месяц">
              <Text style={styles.month}>{monthTitle(month)}</Text>
            </Pressable>
            <Pressable
              style={styles.navButton}
              hitSlop={8}
              disabled={atLatest}
              onPress={() => openMonth(shiftMonth(month, 1))}
            >
              <Feather name="chevron-right" size={20} color={atLatest ? colors.faint : colors.ink} />
            </Pressable>
          </View>
        </View>
        <MonthPicker
          visible={picking}
          value={month}
          counts={counts}
          max={current}
          allowEmpty
          showAll={false}
          onSelect={(m) => m && openMonth(m)}
          onClose={() => setPicking(false)}
        />

        <View style={styles.calendar}>
          <View style={styles.week}>
            {WEEKDAYS_SHORT.map((w) => (
              <Text key={w} style={[styles.cellBox, styles.weekday]}>
                {w}
              </Text>
            ))}
          </View>
          {rows.map((row, r) => (
            <View key={r} style={styles.week}>
              {row.map((key, i) => {
                if (!key) return <View key={`e${i}`} style={[styles.cellBox, styles.square]} />;
                const posts = byDay.get(key);
                const withPhoto = posts?.find((p) => p.post.media.length > 0);
                return (
                  <Pressable
                    key={key}
                    onPress={() => setSelected(key)}
                    style={[
                      styles.cellBox,
                      styles.square,
                      styles.cell,
                      key === today && styles.today,
                      key === selected && styles.selected,
                    ]}
                  >
                    <Text style={[styles.num, posts && styles.numOn]}>{Number(key.slice(8))}</Text>
                    {withPhoto ? (
                      <Image
                        source={{ uri: mediaUri(withPhoto.dir, withPhoto.post.media[0].thumb) }}
                        style={styles.mini}
                        contentFit="cover"
                      />
                    ) : posts ? (
                      <View style={styles.dot} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        <Text style={styles.dayTitle}>{formatDayLong(selected)}</Text>
        {dayPosts.length === 0 && <Text style={styles.none}>В этот день записей нет.</Text>}
        {dayPosts.map((item) => (
          <PostRow key={item.post.id} item={item} />
        ))}

        <Pressable style={styles.add} onPress={() => router.push({ pathname: '/compose', params: { date: selected } })}>
          <Feather name="plus" size={16} color={colors.ink} />
          <Text style={styles.addText}>Запись на {formatDayShort(selected)}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    content: { paddingHorizontal: space.gutter, paddingBottom: 32, gap: 10 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 },
    title: { fontSize: 24, fontWeight: '800', color: c.ink },
    monthNav: { flexDirection: 'row', alignItems: 'center' },
    navButton: { padding: 8 },
    monthButton: { paddingVertical: 6, paddingHorizontal: 4, borderRadius: 8, backgroundColor: c.photoBg },
    month: { fontFamily: fonts.mono, fontSize: 13, color: c.ink, minWidth: 110, textAlign: 'center' },
    calendar: { gap: CELL_GAP },
    week: { flexDirection: 'row', gap: CELL_GAP },
    cellBox: { flex: 1 },
    square: { aspectRatio: 1 },
    weekday: { textAlign: 'center', fontSize: 11, fontWeight: '600', color: c.muted },
    cell: { borderRadius: 8, alignItems: 'center', paddingTop: 4, gap: 3 },
    today: { borderWidth: 1, borderColor: c.faint },
    selected: { backgroundColor: c.accentSoft, borderWidth: 1.5, borderColor: c.accent },
    num: { fontFamily: fonts.mono, fontSize: 12, color: c.faint },
    numOn: { color: c.ink, fontWeight: '700' },
    mini: { width: '62%', flex: 1, maxHeight: 22, borderRadius: 4 },
    dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: c.ink },
    dayTitle: {
      marginTop: 10,
      fontSize: 12,
      fontWeight: '700',
      color: c.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    none: { fontSize: 14, color: c.muted },
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
      borderColor: c.faint,
      backgroundColor: c.card,
    },
    addText: { fontSize: 15, fontWeight: '600', color: c.ink },
  });
