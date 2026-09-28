import { StyleSheet, Text, View } from 'react-native';
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
          {days.map((day) => {
            const ratio = peak === 0 ? 0 : day.value / peak;
            const met = day.value >= target && target > 0;
            return (
              <View key={day.date} style={styles.barSlot}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(ratio * CHART_HEIGHT, day.value > 0 ? 2 : 0),
                      backgroundColor: met ? color : withAlpha(color, day.due ? 0.45 : 0.25),
                    },
                  ]}
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
