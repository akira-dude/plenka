import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { MONTHS_SHORT } from '@/domain/dates';
import { fonts, type Palette } from './theme';
import { useStyles, useTheme } from './ThemeProvider';

type Props = {
  visible: boolean;
  value: string | null;
  counts: Map<string, number>;
  onSelect: (month: string | null) => void;
  onClose: () => void;
  max?: string;
  allowEmpty?: boolean;
  showAll?: boolean;
};

const YEARS_BACK = 20;

const pad = (n: number) => String(n).padStart(2, '0');

function initialYear(value: string | null, counts: Map<string, number>): number {
  if (value) return Number(value.slice(0, 4));
  const latest = [...counts.keys()].sort().pop();
  return latest ? Number(latest.slice(0, 4)) : new Date().getFullYear();
}

export function MonthPicker({ visible, ...props }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={props.onClose} statusBarTranslucent>
      {visible && <Sheet {...props} />}
    </Modal>
  );
}

function Sheet({ value, counts, onSelect, onClose, max, allowEmpty = false, showAll = true }: Omit<Props, 'visible'>) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const [year, setYear] = useState(() => initialYear(value, counts));
  const years = [...counts.keys()].map((k) => Number(k.slice(0, 4)));
  const maxYear = max ? Number(max.slice(0, 4)) : Math.max(year, ...years);
  const minYear = allowEmpty ? Math.min(year, ...years, maxYear - YEARS_BACK) : Math.min(year, ...years);

  const choose = (month: string | null) => {
    onSelect(month);
    onClose();
  };

  return (
    <Pressable style={styles.backdrop} onPress={onClose}>
      <Pressable style={styles.card} onPress={() => undefined}>
        <Text style={styles.caption}>Выбор месяца</Text>
        <View style={styles.yearRow}>
          <Pressable style={styles.arrow} hitSlop={8} disabled={year <= minYear} onPress={() => setYear(year - 1)}>
            <Feather name="chevron-left" size={22} color={year <= minYear ? colors.faint : colors.ink} />
          </Pressable>
          <Text style={styles.year}>{year}</Text>
          <Pressable style={styles.arrow} hitSlop={8} disabled={year >= maxYear} onPress={() => setYear(year + 1)}>
            <Feather name="chevron-right" size={22} color={year >= maxYear ? colors.faint : colors.ink} />
          </Pressable>
        </View>

        <View style={styles.grid}>
          {MONTHS_SHORT.map((label, i) => {
            const key = `${year}-${pad(i + 1)}`;
            const count = counts.get(key) ?? 0;
            const on = key === value;
            const disabled = (max !== undefined && key > max) || (!allowEmpty && count === 0);
            return (
              <Pressable
                key={key}
                style={[styles.month, on && styles.monthOn]}
                disabled={disabled}
                onPress={() => choose(key)}
              >
                <Text
                  style={[
                    styles.monthText,
                    !disabled && styles.monthTextFree,
                    count > 0 && styles.monthTextHas,
                    on && styles.monthTextOn,
                  ]}
                >
                  {label}
                </Text>
                <Text style={[styles.count, on && styles.monthTextOn]}>{count > 0 ? count : ' '}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.actions}>
          {showAll && (
            <Pressable style={styles.action} onPress={() => choose(null)}>
              <Text style={styles.actionText}>Все месяцы</Text>
            </Pressable>
          )}
          <Pressable style={styles.action} onPress={onClose}>
            <Text style={styles.actionText}>Отмена</Text>
          </Pressable>
        </View>
      </Pressable>
    </Pressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: c.overlay, alignItems: 'center', justifyContent: 'center', padding: 24 },
    card: { width: '100%', maxWidth: 360, backgroundColor: c.card, borderRadius: 24, padding: 20, gap: 12 },
    caption: { fontSize: 13, fontWeight: '600', color: c.muted },
    yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    arrow: { padding: 6 },
    year: { fontSize: 24, fontWeight: '800', color: c.ink },
    grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 },
    month: { width: '33.33%', alignItems: 'center', paddingVertical: 10, borderRadius: 99 },
    monthOn: { backgroundColor: c.accent },
    monthText: { fontSize: 16, color: c.faint },
    monthTextFree: { color: c.ink },
    monthTextHas: { color: c.ink, fontWeight: '700' },
    monthTextOn: { color: c.onAccent },
    count: { fontFamily: fonts.mono, fontSize: 11, color: c.muted },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
    action: { paddingVertical: 10, paddingHorizontal: 12 },
    actionText: { fontSize: 15, fontWeight: '700', color: c.accent },
  });
