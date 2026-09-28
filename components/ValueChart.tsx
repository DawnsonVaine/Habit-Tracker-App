import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { withAlpha } from '../utils/goals';

export interface ChartDay {
  date: string;
  value: number;
  /** False for days the habit wasn't scheduled, which render muted. */
  due: boolean;
}

interface Props {
  days: ChartDay[]; // oldest first
  target: number;
  color: string;
  /** Formats the axis labels, e.g. minutes as "30m". */
  formatValue: (value: number) => string;
}

const CHART_HEIGHT = 96;
/** Each bar starts slightly after the one to its left, giving a left-to-right sweep. */
const BAR_STAGGER_MS = 14;

function Bar({ height, color, index }: { height: number; color: string; index: number }) {
  const grown = useSharedValue(0);

  useEffect(() => {
    grown.value = withDelay(
      index * BAR_STAGGER_MS,
      withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) })
    );
  }, [grown, index]);

  // Re-target the height without replaying the sweep when a value changes.
  const style = useAnimatedStyle(() => ({
    height: height * grown.value,
    backgroundColor: color,
  }));

  return <Animated.View style={[styles.bar, style]} />;
}

export function ValueChart({ days, target, color, formatValue }: Props) {
  const { colors } = useTheme();

  // Scale to whatever is taller, the target or the best day, so overshooting
  // days stay on the chart instead of clipping at the target line.
  const peak = Math.max(target, ...days.map((d) => d.value));
  const targetRatio = peak === 0 ? 0 : target / peak;

  return (
    <View>
      <View style={[styles.plot, { height: CHART_HEIGHT }]}>
        {/* Target line sits behind the bars as a reference. */}
        <View
          style={[
            styles.targetLine,
            { bottom: targetRatio * CHART_HEIGHT, borderColor: withAlpha(color, 0.5) },
          ]}
        />
        <View style={styles.bars}>
          {days.map((day, index) => {
            const ratio = peak === 0 ? 0 : day.value / peak;
            const met = day.value >= target && target > 0;
            return (
              <View key={day.date} style={styles.barSlot}>
                <Bar
                  index={index}
                  height={Math.max(ratio * CHART_HEIGHT, day.value > 0 ? 2 : 0)}
                  color={met ? color : withAlpha(color, day.due ? 0.45 : 0.25)}
                />
              </View>
            );
          })}
        </View>
      </View>
      <View style={styles.axis}>
        <Text style={[styles.axisLabel, { color: colors.subtext }]}>
          {days.length > 0 ? `${days.length} days ago` : ''}
        </Text>
        <Text style={[styles.axisLabel, { color: colors.subtext }]}>
          target {formatValue(target)}
        </Text>
        <Text style={[styles.axisLabel, { color: colors.subtext }]}>today</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plot: { justifyContent: 'flex-end' },
  targetLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: '100%' },
  barSlot: { flex: 1, justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 2, minHeight: 0 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisLabel: { fontSize: 11 },
});
