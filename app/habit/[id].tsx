import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MonthGrid } from '../../components/MonthGrid';
import { useTheme } from '../../hooks/useTheme';
import { useHabitStore } from '../../store/habitStore';
import { MONTH_LABELS } from '../../utils/dates';
import { getCompletionRate, getStreaks } from '../../utils/streaks';

const EMPTY_COMPLETIONS: string[] = [];

export default function HabitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();

  const habit = useHabitStore((s) => s.habits.find((h) => h.id === id));
  const completions = useHabitStore((s) => s.completions[id ?? ''] ?? EMPTY_COMPLETIONS);
  const toggleCompletion = useHabitStore((s) => s.toggleCompletion);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const completedSet = useMemo(() => new Set(completions), [completions]);

  if (!habit) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.text }}>Habit not found.</Text>
      </View>
    );
  }

  const { current, longest } = getStreaks(habit, completions);
  const completionRate = getCompletionRate(habit, completions, 30);

  function changeMonth(delta: number) {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }
    setMonth(newMonth);
    setYear(newYear);
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: habit.name,
          headerRight: () => (
            <Pressable
              onPress={() => router.push({ pathname: '/habit/new', params: { id: habit.id } })}
              hitSlop={8}
              style={styles.editButton}
            >
              <Text style={[styles.editButtonText, { color: colors.accent }]}>Edit</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.emoji}>{habit.emoji}</Text>
          <Text style={[styles.name, { color: colors.text }]}>{habit.name}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: habit.color }]}>🔥 {current}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>Current streak</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: habit.color }]}>🏆 {longest}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>Longest streak</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: habit.color }]}>{completionRate}%</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>Last 30 days</Text>
          </View>
        </View>

        <View style={styles.monthNav}>
          <Pressable onPress={() => changeMonth(-1)} style={styles.navButton}>
            <Text style={[styles.navArrow, { color: colors.text }]}>‹</Text>
          </Pressable>
          <Text style={[styles.monthLabel, { color: colors.text }]}>
            {MONTH_LABELS[month]} {year}
          </Text>
          <Pressable onPress={() => changeMonth(1)} style={styles.navButton}>
            <Text style={[styles.navArrow, { color: colors.text }]}>›</Text>
          </Pressable>
        </View>

        <MonthGrid
          year={year}
          month={month}
          completedDates={completedSet}
          color={habit.color}
          createdAt={habit.createdAt}
          onToggleDay={(dateStr) => toggleCompletion(habit.id, dateStr)}
        />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  editButton: { paddingVertical: 6, paddingHorizontal: 4 },
  editButtonText: { fontSize: 17, fontWeight: '600' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  emoji: { fontSize: 40 },
  name: { fontSize: 24, fontWeight: '700', flexShrink: 1 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 18, fontWeight: '700' },
  statLabel: { fontSize: 11, textAlign: 'center' },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 14 },
  navButton: { padding: 8 },
  navArrow: { fontSize: 24, fontWeight: '600' },
  monthLabel: { fontSize: 16, fontWeight: '600', minWidth: 140, textAlign: 'center' },
});
