import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Palette } from './theme';
import { useStyles } from './ThemeProvider';

export function openTagSearch(tag: string) {
  router.navigate({ pathname: '/search', params: { tag, at: String(Date.now()) } });
}

export function TagLinks({ tags, size = 14 }: { tags: string[]; size?: number }) {
  const styles = useStyles(makeStyles);
  if (tags.length === 0) return null;
  return (
    <View style={styles.row}>
      {tags.map((tag) => (
        <Pressable
          key={tag}
          style={styles.chip}
          hitSlop={4}
          accessibilityLabel={`Искать по тегу ${tag}`}
          onPress={() => openTagSearch(tag)}
        >
          <Text style={[styles.text, { fontSize: size }]}>#{tag}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 99, backgroundColor: c.accentSoft },
    text: { color: c.accent, fontWeight: '600' },
  });
