import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import Feather from '@expo/vector-icons/Feather';
import { searchWords, suggestTags, tagQuery } from '@/domain/search';
import { useDbQuery } from '@/hooks/useDbQuery';
import { listTags, searchPosts, type IndexedPost } from '@/storage/posts';
import { SearchResult } from '@/ui/SearchResult';
import { TagSuggestions } from '@/ui/TagSuggestions';
import { space, type Palette } from '@/ui/theme';
import { useStyles, useTheme } from '@/ui/ThemeProvider';

const DEBOUNCE_MS = 200;
const CLOUD_MIN = 14;
const CLOUD_MAX = 24;

export default function Search() {
  const db = useSQLiteContext();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<IndexedPost[]>([]);
  const { data: tags } = useDbQuery(listTags, []);

  const tag = tagQuery(query);
  const words = useMemo(() => searchWords(query), [query]);
  const suggestions = query.trim() && !tag ? suggestTags(tags, query) : [];
  const maxCount = tags[0]?.count ?? 1;

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      searchPosts(db, query).then((r) => alive && setResults(r));
    }, DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [db, query]);

  const pickTag = useCallback((t: string) => setQuery(`#${t}`), []);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.title}>Поиск</Text>
        <View style={styles.field}>
          <Feather name="search" size={16} color={colors.muted} />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Текст, #тег или место"
            placeholderTextColor={colors.faint}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable hitSlop={10} accessibilityLabel="Очистить поиск" onPress={() => setQuery('')}>
              <Feather name="x" size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>
        <TagSuggestions tags={suggestions} onPick={pickTag} />
        {tag && <Text style={styles.mode}>Записи с тегом #{tag}</Text>}
      </View>

      {query.trim() ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.post.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => <SearchResult item={item} words={words} tag={tag} />}
          ListEmptyComponent={<Text style={styles.none}>Ничего не нашлось.</Text>}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {tags.length === 0 ? (
            <Text style={styles.none}>Тегов пока нет. Добавь их к записям, и здесь появится облако тегов.</Text>
          ) : (
            <View style={styles.cloud}>
              {tags.map(({ tag: t, count }) => {
                const size = CLOUD_MIN + ((CLOUD_MAX - CLOUD_MIN) * (count - 1)) / Math.max(1, maxCount - 1);
                return (
                  <Pressable key={t} style={styles.cloudTag} onPress={() => pickTag(t)}>
                    <Text style={[styles.cloudText, { fontSize: size, lineHeight: size * 1.3 }]}>#{t}</Text>
                    <Text style={styles.cloudCount}>{count}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    content: { paddingHorizontal: space.gutter, paddingTop: 8, gap: 10 },
    title: { fontSize: 24, fontWeight: '800', color: c.ink },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    input: { flex: 1, fontSize: 15, color: c.ink, padding: 0 },
    mode: { fontSize: 13, color: c.muted },
    list: { padding: space.gutter, paddingBottom: 32 },
    none: { fontSize: 14, color: c.muted, lineHeight: 20 },
    cloud: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 10 },
    cloudTag: { flexDirection: 'row', alignItems: 'baseline', gap: 3, paddingVertical: 4 },
    cloudText: { color: c.accent, fontWeight: '700' },
    cloudCount: { fontSize: 11, color: c.muted },
  });
