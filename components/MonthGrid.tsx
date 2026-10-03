import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { WEEKDAY_LABELS, getMonthMatrix, parseDateStr, todayStr } from '../utils/dates';
import { withAlpha } from '../utils/goals';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface DayCellProps {
  dayNum: number;
  credit: number;
  color: string;
  textColor: string;
  borderColor: string;
  isToday: boolean;
  isDisabled: boolean;
  /** A deliberate rest day, drawn with a dashed outline. */
  isRested: boolean;
  onPress: () => void;
}

function DayCell({
  dayNum,
  credit,
  color,
  textColor,
  borderColor,
  isToday,
  isDisabled,
  isRested,
  onPress,
}: DayCellProps) {
  const fill = useSharedValue(credit);
  const press = useSharedValue(1);

  useEffect(() => {
    fill.value = withTiming(credit, { duration: 240, easing: Easing.out(Easing.cubic) });
  }, [credit, fill]);

  const containerStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  // A partly-done day gets a translucent wash that deepens as it fills.
  const fillStyle = useAnimatedStyle(() => ({
    opacity: fill.value === 0 ? 0 : 0.25 + fill.value * 0.75,
  }));

  return (
    <AnimatedPressable
      disabled={isDisabled}
      onPress={onPress}
      onPressIn={() => {
        press.value = withSpring(0.9, { damping: 14, stiffness: 340, mass: 0.5 });
      }}
      onPressOut={() => {
        press.value = withSpring(1, { damping: 14, stiffness: 340, mass: 0.5 });
      }}
      style={[
        styles.dayCell,
        styles.dayCellButton,
        isRested
          ? { borderColor: color, borderStyle: 'dashed', borderWidth: 1.5 }
          : { borderColor },
        { opacity: isDisabled ? 0.3 : 1 },
        containerStyle,
      ]}
    >
      <Animated.View style={[styles.dayFill, { backgroundColor: color }, fillStyle]} />
      <Text style={{ color: textColor, fontSize: 13, fontWeight: isToday ? '700' : '400' }}>
        {dayNum}
      </Text>
    </AnimatedPressable>
  );
}

interface Props {
  year: number;
  month: number; // 0-indexed
  /** How far a given day got toward its target, 0..1. 1 means complete. */
  dayCredit: (dateStr: string) => number;
  /** Whether a day was deliberately rested. */
  isRested: (dateStr: string) => boolean;
  color: string;
  createdAt: string;
  onToggleDay: (dateStr: string) => void;
}

export function MonthGrid({ year, month, dayCredit, isRested, color, createdAt, onToggleDay }: Props) {
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

            return (
              <DayCell
                key={dIdx}
                dayNum={parseDateStr(dateStr).getDate()}
                credit={credit}
                color={color}
                // Only a dark enough fill flips the number to white.
                textColor={credit >= 0.6 ? '#fff' : colors.text}
                borderColor={isToday ? color : colors.border}
                isToday={isToday}
                isDisabled={isDisabled}
                isRested={isRested(dateStr)}
                onPress={() => onToggleDay(dateStr)}
              />
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
    overflow: 'hidden',
  },
  dayFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 10,
  },
});
