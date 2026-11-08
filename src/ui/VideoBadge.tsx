import { StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { formatDuration } from '@/domain/post';
import { fonts, type Palette } from './theme';
import { useStyles, useTheme } from './ThemeProvider';

type Props = { duration?: number; size?: 'small' | 'large' };

export function VideoBadge({ duration, size = 'large' }: Props) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const small = size === 'small';
  return (
    <View style={[styles.badge, small ? styles.small : styles.large]} pointerEvents="none">
      <Feather name="play" size={small ? 10 : 14} color={colors.onAccent} />
      {duration ? <Text style={[styles.text, small && styles.textSmall]}>{formatDuration(duration)}</Text> : null}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    badge: {
      position: 'absolute',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: 99,
      backgroundColor: c.overlay,
    },
    small: { left: 4, bottom: 4, paddingHorizontal: 5, paddingVertical: 2 },
    large: { left: 10, bottom: 10, paddingHorizontal: 9, paddingVertical: 4 },
    text: { fontFamily: fonts.mono, fontSize: 12, color: c.onAccent },
    textSmall: { fontSize: 10 },
  });
