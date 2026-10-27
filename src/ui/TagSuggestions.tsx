import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { Palette } from './theme';
import { useStyles } from './ThemeProvider';

type Props = { tags: string[]; onPick: (tag: string) => void };

export function TagSuggestions({ tags, onPick }: Props) {
  const styles = useStyles(makeStyles);
  if (tags.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={styles.strip}
      contentContainerStyle={styles.content}
    >
      {tags.map((tag) => (
        <Pressable key={tag} style={styles.chip} onPress={() => onPick(tag)}>
          <Text style={styles.text}>#{tag}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    strip: { flexGrow: 0 },
    content: { gap: 6, paddingVertical: 2 },
    chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, backgroundColor: c.accentSoft },
    text: { fontSize: 14, lineHeight: 18, fontWeight: '600', color: c.accent },
  });
