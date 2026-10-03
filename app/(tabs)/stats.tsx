import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Heatmap, HeatmapDay } from '../../components/Heatmap';
import { LevelCard } from '../../components/LevelCard';
import { useTheme } from '../../hooks/useTheme';
import { useHabitStore } from '../../store/habitStore';
import { addDays, parseDateStr, startOfWeek, todayStr } from '../../utils/dates';
import { dayCredit, EMPTY_PROGRESS } from '../../utils/goals';
import { getProgression, getTotalXp } from '../../utils/progression';
import { EMPTY_SKIP_SET } from '../../utils/skips';
import { getCompletionRate, getStreaks, isScheduled } from '../../utils/streaks';

const HEATMAP_WEEKS = 12;

export default function StatsScreen() {
  const { colors } = useTheme();
  const allHabits = useHabitStore((s) => s.habits);
  const completions = useHabitStore((s) => s.completions);
  const skips = useHabitStore((s) => s.skips);
  const hasHydrated = useHabitStore((s) => s.hasHydrated);

  const habits = useMemo(() => allHabits.filter((h) => !h.archived), [allHabits]);

  // Built once per change rather than per lookup, since the heatmap checks
  // every habit on every day it draws.
  const skipSets = useMemo(() => {
    const sets = new Map<string, ReadonlySet<string>>();
    for (const [habitId, dates] of Object.entries(skips)) sets.set(habitId, new Set(dates));
    return sets;
  }, [skips]);

  // Every habit counts toward XP, archived included — the work was still done.
  const progression = useMemo(
    () => getProgression(getTotalXp(allHabits, completions, skips)),
    [allHabits, completions, skips]
  );

  const overallRate = useMemo(() => {
    if (habits.length === 0) return 0;
    const total = habits.reduce(
      (sum, h) =>
        sum + getCompletionRate(h, completions[h.id] ?? EMPTY_PROGRESS, 30, skipSets.get(h.id) ?? EMPTY_SKIP_SET),
      0
    );
    return Math.round(total / habits.length);
  }, [habits, completions, skipSets]);

  const leaderboard = useMemo(() => {
    return habits
      .map((h) => ({
        habit: h,
        ...getStreaks(h, completions[h.id] ?? EMPTY_PROGRESS, skipSets.get(h.id) ?? EMPTY_SKIP_SET),
      }))
      .sort((a, b) => b.current - a.current);
  }, [habits, completions, skipSets]);

  const heatmapWeeks = useMemo(() => {
    const today = todayStr();
    const totalDays = HEATMAP_WEEKS * 7;
    const start = startOfWeek(addDays(today, -(totalDays - 1)));

    const days: HeatmapDay[] = [];
    let cursor = start;
    while (parseDateStr(cursor) <= parseDateStr(today)) {
      const activeHabits = habits.filter((h) => parseDateStr(h.createdAt) <= parseDateStr(cursor));
      // A rested habit drops out of the day entirely, the same as one not scheduled.
      const due = activeHabits.filter((h) => isScheduled(h, cursor, skipSets.get(h.id) ?? EMPTY_SKIP_SET));
      // Partial credit, so a half-finished count habit shades the day rather
      // than counting for nothing.
      const credit = due.reduce((sum, h) => sum + dayCredit(h, completions[h.id]?.[cursor]), 0);
      days.push({ date: cursor, ratio: due.length === 0 ? null : credit / due.length });
      cursor = addDays(cursor, 1);
    }

    const weeks: HeatmapDay[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    return weeks;
  }, [habits, completions, skipSets]);

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
          <LevelCard progression={progression} accentColor={colors.accent} />

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
