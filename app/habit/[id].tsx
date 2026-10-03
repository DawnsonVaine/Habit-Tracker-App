import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Alert, AlertButton, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChallengeCard, ChallengeView, formatShortDate } from '../../components/ChallengeCard';
import { MonthGrid } from '../../components/MonthGrid';
import { ChartDay, ValueChart } from '../../components/ValueChart';
import { useTheme } from '../../hooks/useTheme';
import { useHabitStore } from '../../store/habitStore';
import { addDays, MONTH_LABELS, parseDateStr, todayStr } from '../../utils/dates';
import {
  dayCredit,
  EMPTY_PROGRESS,
  formatDuration,
  formatTarget,
} from '../../utils/goals';
import {
  canChallengeHabit,
  CHALLENGE_BONUS_PER_SESSION,
  challengeEndDate,
  challengeLengthLabel,
  countSessions,
  getChallengeProgress,
} from '../../utils/challenges';
import { canSkipDay, EMPTY_SKIPS } from '../../utils/skips';
import { getCompletionRate, getStreaks, isDueOnDate, isScheduled } from '../../utils/streaks';

const CHART_DAYS = 30;

export default function HabitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();

  const habit = useHabitStore((s) => s.habits.find((h) => h.id === id));
  const progress = useHabitStore((s) => s.completions[id ?? ''] ?? EMPTY_PROGRESS);
  const skipDates = useHabitStore((s) => s.skips[id ?? ''] ?? EMPTY_SKIPS);
  const toggleCompletion = useHabitStore((s) => s.toggleCompletion);
  const setSkipped = useHabitStore((s) => s.setSkipped);
  const allChallenges = useHabitStore((s) => s.challenges);
  const startChallenge = useHabitStore((s) => s.startChallenge);
  const abandonChallenge = useHabitStore((s) => s.abandonChallenge);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const skipped = useMemo(() => new Set(skipDates), [skipDates]);

  // The running challenge, plus the most recent finished one for a footnote.
  const challengeViews = useMemo(() => {
    if (!habit) return { active: null, last: null };
    let active: ChallengeView | null = null;
    let last: ChallengeView | null = null;
    for (const challenge of allChallenges) {
      if (challenge.habitId !== habit.id) continue;
      const view = { challenge, result: getChallengeProgress(challenge, habit, progress, skipped) };
      if (view.result.status === 'active') active = view;
      else if (!last || challenge.startDate >= last.challenge.startDate) last = view;
    }
    return { active, last };
  }, [allChallenges, habit, progress, skipped]);

  const chart = useMemo(() => {
    if (!habit || habit.goalType === 'binary') return null;
    const today = todayStr();
    const days: ChartDay[] = [];
    let loggedTotal = 0;
    let dueDays = 0;
    for (let i = CHART_DAYS - 1; i >= 0; i--) {
      const dateStr = addDays(today, -i);
      if (parseDateStr(dateStr) < parseDateStr(habit.createdAt)) continue;
      const value = progress[dateStr] ?? 0;
      // Rest days render muted and stay out of the average, like unscheduled days.
      const due = isScheduled(habit, dateStr, skipped);
      days.push({ date: dateStr, value, due });
      if (due) {
        dueDays++;
        loggedTotal += value;
      }
    }
    return { days, average: dueDays === 0 ? 0 : loggedTotal / dueDays };
  }, [habit, progress, skipped]);

  if (!habit) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.text }}>Habit not found.</Text>
      </View>
    );
  }

  const { current, longest } = getStreaks(habit, progress, skipped);
  const completionRate = getCompletionRate(habit, progress, 30, skipped);
  const goalLabel = formatTarget(habit);
  const activeHabit = habit;

  function formatChartValue(value: number): string {
    if (activeHabit.goalType === 'duration') return formatDuration(Math.round(value));
    const rounded = Math.round(value * 10) / 10;
    return activeHabit.unit ? `${rounded} ${activeHabit.unit}` : `${rounded}`;
  }

  function handleToggleDay(dateStr: string) {
    if (!habit) return;
    const habitId = habit.id;
    const isCompleted = dayCredit(habit, progress[dateStr]) >= 1;
    const isRested = skipped.has(dateStr);
    const d = parseDateStr(dateStr);
    const label = `${MONTH_LABELS[d.getMonth()]} ${d.getDate()}`;
    // Marking a count or duration day from the calendar fills it to the target,
    // so say so rather than implying a simple tick.
    const markMessage =
      habit.goalType === 'binary'
        ? `Mark ${label} as completed?`
        : `Log the full ${formatTarget(habit)} for ${label}?`;

    const buttons: AlertButton[] = [{ text: 'Cancel', style: 'cancel' }];
    buttons.push({
      text: isCompleted ? 'Unmark' : 'Mark',
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        toggleCompletion(habitId, dateStr);
      },
    });

    // Rest days only apply to days the habit was actually due.
    if (isRested) {
      buttons.push({
        text: 'Undo rest day',
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setSkipped(habitId, dateStr, false);
        },
      });
    } else if (
      isDueOnDate(habit, dateStr) &&
      canSkipDay(habit, skipDates, dateStr, progress[dateStr] ?? 0)
    ) {
      buttons.push({
        text: 'Mark as rest day',
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setSkipped(habitId, dateStr, true);
        },
      });
    }

    let title = isCompleted ? 'Unmark day' : 'Mark day complete';
    let message = isCompleted ? `Remove completion for ${label}?` : markMessage;
    if (isRested) {
      title = `${label} · rest day`;
      message = 'This day was rested, so it protects your streak and costs no XP.';
    }

    Alert.alert(title, message, buttons);
  }

  function handleStartChallenge(lengthDays: number) {
    if (!habit) return;
    const habitId = habit.id;
    const start = todayStr();
    const sessions = countSessions(habit, start, lengthDays);
    const end = challengeEndDate({ startDate: start, lengthDays });

    Alert.alert(
      `Start a ${challengeLengthLabel(lengthDays)} challenge?`,
      `${habit.name} is scheduled ${sessions} times between today and ${formatShortDate(end)}. ` +
        `Complete every one to earn +${sessions * CHALLENGE_BONUS_PER_SESSION} XP. ` +
        `Miss one and the challenge ends — rest days still count.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            startChallenge(habitId, lengthDays);
          },
        },
      ]
    );
  }

  function handleAbandonChallenge(challengeId: string) {
    Alert.alert(
      'Give up this challenge?',
      "You'll keep all the XP you've earned from completing the habit, but not the challenge bonus.",
      [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Give up', style: 'destructive', onPress: () => abandonChallenge(challengeId) },
      ]
    );
  }

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
          <View style={{ flexShrink: 1 }}>
            <Text style={[styles.name, { color: colors.text }]}>{habit.name}</Text>
            {goalLabel !== '' && (
              <Text style={[styles.goal, { color: colors.subtext }]}>{goalLabel} a day</Text>
            )}
          </View>
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

        {canChallengeHabit(habit) && (
          <ChallengeCard
            habit={habit}
            active={challengeViews.active}
            last={challengeViews.last}
            onStart={handleStartChallenge}
            onAbandon={handleAbandonChallenge}
          />
        )}

        {chart && chart.days.length > 0 && (
          <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.chartHeader}>
              <Text style={[styles.chartTitle, { color: colors.text }]}>Last {chart.days.length} days</Text>
              <Text style={[styles.chartAverage, { color: colors.subtext }]}>
                avg {formatChartValue(chart.average)}/day
              </Text>
            </View>
            <ValueChart
              days={chart.days}
              target={habit.target}
              color={habit.color}
              formatValue={formatChartValue}
            />
          </View>
        )}

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
          dayCredit={(dateStr) => dayCredit(activeHabit, progress[dateStr])}
          isRested={(dateStr) => skipped.has(dateStr)}
          color={habit.color}
          createdAt={habit.createdAt}
          onToggleDay={handleToggleDay}
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
  goal: { fontSize: 13, marginTop: 2 },
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
  chartCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 14,
  },
  chartTitle: { fontSize: 14, fontWeight: '700' },
  chartAverage: { fontSize: 12 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 14 },
  navButton: { padding: 8 },
  navArrow: { fontSize: 24, fontWeight: '600' },
  monthLabel: { fontSize: 16, fontWeight: '600', minWidth: 140, textAlign: 'center' },
});
