import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import Feather from '@expo/vector-icons/Feather';
import { searchPosts, type IndexedPost } from '@/storage/posts';
import { PostRow } from '@/ui/PostRow';
import { space, type Palette } from '@/ui/theme';
import { useStyles, useTheme } from '@/ui/ThemeProvider';

const DEBOUNCE_MS = 200;

export default function Search() {
  const db = useSQLiteContext();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<IndexedPost[]>([]);

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
        </View>
      </View>
      <FlatList
        data={results}
        keyExtractor={(item) => item.post.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => <PostRow item={item} showDate />}
        ListEmptyComponent={
          query.trim() ? <Text style={styles.none}>Ничего не нашлось.</Text> : undefined
        }
      />
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
    list: { padding: space.gutter, paddingBottom: 32 },
    none: { fontSize: 14, color: c.muted },
  });
