import { ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

export interface HeatmapDay {
  date: string;
  ratio: number | null; // null = no habits due that day
}

interface Props {
  weeks: HeatmapDay[][]; // each inner array is 7 days (Sun..Sat), oldest week first
  accentColor: string;
}

function levelColor(ratio: number | null, accent: string, borderColor: string): string {
  if (ratio === null) return 'transparent';
  if (ratio === 0) return borderColor;
  if (ratio < 0.34) return `${accent}40`;
  if (ratio < 0.67) return `${accent}80`;
  if (ratio < 1) return `${accent}C0`;
  return accent;
}

export function Heatmap({ weeks, accentColor }: Props) {
  const { colors } = useTheme();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.grid}>
        {weeks.map((week, wIdx) => (
          <View key={wIdx} style={styles.column}>
            {week.map((day, dIdx) => (
              <View
                key={dIdx}
                style={[
                  styles.cell,
                  {
                    backgroundColor: levelColor(day.ratio, accentColor, colors.border),
                    borderColor: colors.border,
                    borderWidth: day.ratio === null ? 1 : 0,
                  },
                ]}
              />
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: 4 },
  column: { gap: 4 },
  cell: { width: 14, height: 14, borderRadius: 3 },
});
