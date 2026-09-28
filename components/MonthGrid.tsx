import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { WEEKDAY_LABELS, getMonthMatrix, parseDateStr, todayStr } from '../utils/dates';
import { withAlpha } from '../utils/goals';

interface Props {
  year: number;
  month: number; // 0-indexed
  /** How far a given day got toward its target, 0..1. 1 means complete. */
  dayCredit: (dateStr: string) => number;
  color: string;
  createdAt: string;
  onToggleDay: (dateStr: string) => void;
}

export function MonthGrid({ year, month, dayCredit, color, createdAt, onToggleDay }: Props) {
  const { colors } = useTheme();
  const matrix = getMonthMatrix(year, month);
  const today = todayStr();

  return (
    <View>
      <View style={styles.weekdayHeader}>
        {WEEKDAY_LABELS.map((label, idx) => (
          <Text key={idx} style={[styles.weekdayLabel, { color: colors.subtext }]}>
            {label}
          </Text>
        ))}
      </View>
      {matrix.map((week, wIdx) => (
        <View key={wIdx} style={styles.week}>
          {week.map((dateStr, dIdx) => {
            if (!dateStr) return <View key={dIdx} style={styles.dayCell} />;

            const isFuture = parseDateStr(dateStr) > parseDateStr(today);
            const isBeforeCreation = parseDateStr(dateStr) < parseDateStr(createdAt);
            const isDisabled = isFuture || isBeforeCreation;
            const credit = dayCredit(dateStr);
            const isToday = dateStr === today;
            const dayNum = parseDateStr(dateStr).getDate();
            // Partly-filled days get a translucent wash; only a dark enough
            // fill flips the number to white so it stays readable.
            const fill = credit === 0 ? 'transparent' : withAlpha(color, 0.25 + credit * 0.75);

            return (
              <Pressable
                key={dIdx}
                disabled={isDisabled}
                onPress={() => onToggleDay(dateStr)}
                style={[
                  styles.dayCell,
                  styles.dayCellButton,
                  {
                    backgroundColor: fill,
                    borderColor: isToday ? color : colors.border,
                    opacity: isDisabled ? 0.3 : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    color: credit >= 0.6 ? '#fff' : colors.text,
                    fontSize: 13,
                    fontWeight: isToday ? '700' : '400',
                  }}
                >
                  {dayNum}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  weekdayHeader: { flexDirection: 'row', marginBottom: 6 },
  weekdayLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  week: { flexDirection: 'row', marginBottom: 6 },
  dayCell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayCellButton: {
    borderRadius: 10,
    borderWidth: 1,
    marginHorizontal: 2,
  },
});
