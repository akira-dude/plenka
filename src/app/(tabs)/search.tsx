import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
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

export default function Search() {
  const db = useSQLiteContext();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const params = useLocalSearchParams<{ tag?: string; at?: string }>();
  const request = params.tag ? `${params.tag}:${params.at ?? ''}` : null;
  const [handled, setHandled] = useState<string | null>(null);
  if (request && request !== handled) {
    setHandled(request);
    setQuery(`#${params.tag}`);
  }
  const [results, setResults] = useState<IndexedPost[]>([]);
  const { data: tags } = useDbQuery(listTags, []);

  const tag = tagQuery(query);
  const words = useMemo(() => searchWords(query), [query]);
  const suggestions = query.trim() && !tag ? suggestTags(tags, query) : [];

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
              {tags.map(({ tag: t, count }) => (
                <Pressable key={t} style={styles.cloudTag} onPress={() => pickTag(t)}>
                  <Text style={styles.cloudText}>#{t}</Text>
                  <Text style={styles.cloudCount}>{count}</Text>
                </Pressable>
              ))}
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
    cloud: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    cloudTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 99,
      backgroundColor: c.accentSoft,
    },
    cloudText: { fontSize: 14, lineHeight: 18, fontWeight: '600', color: c.accent },
    cloudCount: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: c.accent, opacity: 0.6 },
  });
