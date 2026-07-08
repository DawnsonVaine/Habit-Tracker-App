import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Heatmap, HeatmapDay } from '../../components/Heatmap';
import { useTheme } from '../../hooks/useTheme';
import { useHabitStore } from '../../store/habitStore';
import { addDays, parseDateStr, startOfWeek, todayStr } from '../../utils/dates';
import { getCompletionRate, getStreaks, isDueOnDate } from '../../utils/streaks';

const HEATMAP_WEEKS = 12;

export default function StatsScreen() {
  const { colors } = useTheme();
  const allHabits = useHabitStore((s) => s.habits);
  const completions = useHabitStore((s) => s.completions);
  const hasHydrated = useHabitStore((s) => s.hasHydrated);

  const habits = useMemo(() => allHabits.filter((h) => !h.archived), [allHabits]);

  const overallRate = useMemo(() => {
    if (habits.length === 0) return 0;
    const total = habits.reduce((sum, h) => sum + getCompletionRate(h, completions[h.id] ?? [], 30), 0);
    return Math.round(total / habits.length);
  }, [habits, completions]);

  const leaderboard = useMemo(() => {
    return habits
      .map((h) => ({ habit: h, ...getStreaks(h, completions[h.id] ?? []) }))
      .sort((a, b) => b.current - a.current);
  }, [habits, completions]);

  const heatmapWeeks = useMemo(() => {
    const today = todayStr();
    const totalDays = HEATMAP_WEEKS * 7;
    const start = startOfWeek(addDays(today, -(totalDays - 1)));

    const days: HeatmapDay[] = [];
    let cursor = start;
    while (parseDateStr(cursor) <= parseDateStr(today)) {
      const activeHabits = habits.filter((h) => parseDateStr(h.createdAt) <= parseDateStr(cursor));
      const due = activeHabits.filter((h) => isDueOnDate(h, cursor));
      const completed = due.filter((h) => (completions[h.id] ?? []).includes(cursor));
      days.push({ date: cursor, ratio: due.length === 0 ? null : completed.length / due.length });
      cursor = addDays(cursor, 1);
    }

    const weeks: HeatmapDay[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    return weeks;
  }, [habits, completions]);

  if (!hasHydrated) {
    return <View style={[styles.container, { backgroundColor: colors.background }]} />;
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>Stats</Text>

      {habits.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.subtext }]}>
          Add some habits to see your stats here.
        </Text>
      ) : (
        <>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.bigNumber, { color: colors.accent }]}>{overallRate}%</Text>
            <Text style={[styles.cardLabel, { color: colors.subtext }]}>Overall completion (last 30 days)</Text>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Activity</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Heatmap weeks={heatmapWeeks} accentColor={colors.accent} />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Streaks</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {leaderboard.map(({ habit, current, longest }, idx) => (
              <View
                key={habit.id}
                style={[
                  styles.leaderRow,
                  idx < leaderboard.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                ]}
              >
                <Text style={styles.leaderEmoji}>{habit.emoji}</Text>
                <Text style={[styles.leaderName, { color: colors.text }]} numberOfLines={1}>
                  {habit.name}
                </Text>
                <Text style={[styles.leaderStreak, { color: habit.color }]}>🔥 {current}</Text>
                <Text style={[styles.leaderLongest, { color: colors.subtext }]}>best {longest}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 16 },
  emptyText: { fontSize: 15, marginTop: 20 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  bigNumber: { fontSize: 36, fontWeight: '800', textAlign: 'center' },
  cardLabel: { fontSize: 13, textAlign: 'center', marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  leaderEmoji: { fontSize: 20 },
  leaderName: { flex: 1, fontSize: 15, fontWeight: '600' },
  leaderStreak: { fontSize: 14, fontWeight: '700' },
  leaderLongest: { fontSize: 12, minWidth: 56, textAlign: 'right' },
});
