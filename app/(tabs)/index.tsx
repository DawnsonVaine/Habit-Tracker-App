import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { Alert, AlertButton, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  NestedReorderableList,
  ReorderableListReorderEvent,
  reorderItems,
  ScrollViewContainer,
  useReorderableDrag,
} from 'react-native-reorderable-list';
import { HabitCard } from '../../components/HabitCard';
import { LevelStrip } from '../../components/LevelStrip';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, radius, space, useTheme } from '../../hooks/useTheme';
import { useHabitStore } from '../../store/habitStore';
import { Habit, SortMode } from '../../types/habit';
import { todayStr } from '../../utils/dates';
import { groupByCategory, SORT_MODE_LABELS, sortHabits } from '../../utils/categories';
import { getChallengeProgress } from '../../utils/challenges';
import { EMPTY_PROGRESS, isDayComplete } from '../../utils/goals';
import { getProgression, getTotalXp } from '../../utils/progression';
import {
  canSkipDay,
  canSkipHabit,
  EMPTY_SKIPS,
  skipsLeftInWeek,
  SKIPS_PER_WEEK,
} from '../../utils/skips';
import { getStreaks, isDueOnDate } from '../../utils/streaks';

interface DraggableHabitCardProps {
  habit: Habit;
  completed: boolean;
  streak: number;
  value: number;
  skipped: boolean;
  badge?: string;
  /** False while a computed sort is active, since dragging would fight it. */
  draggable: boolean;
  onToggle: () => void;
  onAddStep: () => void;
  onSubtractStep: () => void;
  onReset: () => void;
  onOptions: () => void;
}

/**
 * Wraps HabitCard so a long press starts the reorder drag. The hook that
 * provides `drag` only works inside an item rendered by ReorderableList.
 */
function DraggableHabitCard({ habit, draggable, ...cardProps }: DraggableHabitCardProps) {
  const drag = useReorderableDrag();

  function handleLongPress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    drag();
  }

  return (
    <HabitCard habit={habit} {...cardProps} onLongPress={draggable ? handleLongPress : undefined} />
  );
}

export default function TodayScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const habits = useHabitStore((s) => s.habits);
  const completions = useHabitStore((s) => s.completions);
  const toggleCompletion = useHabitStore((s) => s.toggleCompletion);
  const addProgress = useHabitStore((s) => s.addProgress);
  const resetProgress = useHabitStore((s) => s.resetProgress);
  const skips = useHabitStore((s) => s.skips);
  const setSkipped = useHabitStore((s) => s.setSkipped);
  const challenges = useHabitStore((s) => s.challenges);
  const categories = useHabitStore((s) => s.categories);
  const sortMode = useHabitStore((s) => s.sortMode);
  const setSortMode = useHabitStore((s) => s.setSortMode);
  const reorderHabits = useHabitStore((s) => s.reorderHabits);
  const hasHydrated = useHabitStore((s) => s.hasHydrated);

  const today = todayStr();
  const todayLabel = useMemo(
    () => new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
    []
  );

  // Archived habits count toward XP too, matching Stats and the level-up check.
  const progression = useMemo(
    () => getProgression(getTotalXp(habits, completions, skips, challenges)),
    [challenges, completions, habits, skips]
  );

  const activeHabits = useMemo(() => habits.filter((h) => !h.archived), [habits]);
  const dueHabits = useMemo(
    () => activeHabits.filter((h) => isDueOnDate(h, today)),
    [activeHabits, today]
  );

  // Everything a card shows, worked out once per habit. Sorting by streak
  // reads it too, so streaks aren't recomputed on every comparison.
  const cardData = useMemo(() => {
    const data = new Map<
      string,
      { skipDates: readonly string[]; streak: number; value: number; done: boolean }
    >();
    for (const habit of dueHabits) {
      const progress = completions[habit.id] ?? EMPTY_PROGRESS;
      const skipDates = skips[habit.id] ?? EMPTY_SKIPS;
      const value = progress[today] ?? 0;
      data.set(habit.id, {
        skipDates,
        streak: getStreaks(habit, progress, new Set(skipDates)).current,
        value,
        done: isDayComplete(habit, value),
      });
    }
    return data;
  }, [completions, dueHabits, skips, today]);

  const sections = useMemo(
    () =>
      groupByCategory(dueHabits, categories).map((section) => ({
        ...section,
        habits: sortHabits(section.habits, sortMode, {
          streakOf: (h) => cardData.get(h.id)?.streak ?? 0,
          isDoneToday: (h) => cardData.get(h.id)?.done ?? false,
        }),
      })),
    [cardData, categories, dueHabits, sortMode]
  );
  const canDrag = sortMode === 'custom';

  // "🏆 Day 12/56" for each habit with a challenge running.
  const challengeBadges = useMemo(() => {
    const badges = new Map<string, string>();
    for (const challenge of challenges) {
      const habit = habits.find((h) => h.id === challenge.habitId);
      if (!habit) continue;
      const result = getChallengeProgress(
        challenge,
        habit,
        completions[habit.id] ?? EMPTY_PROGRESS,
        new Set(skips[habit.id] ?? EMPTY_SKIPS)
      );
      if (result.status === 'active') {
        badges.set(habit.id, `🏆 Day ${result.dayNumber}/${challenge.lengthDays}`);
      }
    }
    return badges;
  }, [challenges, completions, habits, skips]);

  function handleToggle(habitId: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleCompletion(habitId, today);
  }

  function handleStep(habit: Habit, direction: 1 | -1) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addProgress(habit.id, habit.step * direction, today);
  }

  function handleReset(habitId: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    resetProgress(habitId, today);
  }

  function setRest(habitId: string, rest: boolean) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSkipped(habitId, today, rest);
  }

  /** Day options for a habit: take or undo a rest day, and reset count habits. */
  function handleOptions(habit: Habit, value: number, skipDates: readonly string[]) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const restingToday = skipDates.includes(today);
    const buttons: AlertButton[] = [];

    if (restingToday) {
      buttons.push({ text: 'Undo rest day', onPress: () => setRest(habit.id, false) });
    } else if (canSkipDay(habit, skipDates, today, value)) {
      buttons.push({ text: 'Take a rest day', onPress: () => setRest(habit.id, true) });
    }
    if (habit.goalType !== 'binary' && value > 0) {
      buttons.push({ text: 'Reset today', style: 'destructive', onPress: () => handleReset(habit.id) });
    }

    // Nothing to offer: say why, rather than opening an empty menu.
    if (buttons.length === 0) {
      let reason: string;
      if (!canSkipHabit(habit)) {
        reason = "Times-per-week habits can't take rest days — they're already flexible about which days you do them.";
      } else if (value > 0) {
        reason = "You've already logged this today, so there's nothing to rest. Undo it first if you'd like a rest day.";
      } else {
        reason = `You've used this week's rest day for ${habit.name}. It resets on Sunday.`;
      }
      Alert.alert('No rest day available', reason);
      return;
    }

    const left = skipsLeftInWeek(skipDates, today);
    const message = restingToday
      ? 'Today is a rest day. Your streak is protected.'
      : canSkipHabit(habit)
        ? `${left} of ${SKIPS_PER_WEEK} rest ${SKIPS_PER_WEEK === 1 ? 'day' : 'days'} left this week. A rest day protects your streak and costs no XP.`
        : undefined;

    Alert.alert(habit.name, message, [...buttons, { text: 'Cancel', style: 'cancel' }]);
  }

  // Only today's due habits are on screen, so we hand the store just those ids.
  // reorderHabits permutes the slots they occupy and leaves every other habit put.
  // Each section reorders on its own. Only that section's ids reach the store,
  // and reorderHabits permutes just the slots they occupy, so other sections
  // and habits not due today stay exactly where they were.
  function handleReorder(sectionHabits: Habit[], { from, to }: ReorderableListReorderEvent) {
    reorderHabits(reorderItems(sectionHabits, from, to).map((h) => h.id));
  }

  function handleSortPress() {
    const modes: SortMode[] = ['custom', 'name', 'streak', 'todo'];
    Alert.alert(
      'Sort habits',
      'Applies within each section. Dragging to reorder only works in Custom.',
      [
        ...modes.map((mode) => ({
          text: `${SORT_MODE_LABELS[mode]}${mode === sortMode ? '  ✓' : ''}`,
          onPress: () => setSortMode(mode),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  }

  if (!hasHydrated) {
    return <View style={[styles.container, { backgroundColor: colors.background }]} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Today</Text>
            <Text style={[styles.subtitle, { color: colors.subtext }]}>{todayLabel}</Text>
          </View>
          <View style={styles.headerActions}>
            {dueHabits.length > 1 && (
              <Pressable
                onPress={handleSortPress}
                hitSlop={6}
                style={[styles.pill, { backgroundColor: colors.fill }]}
              >
                <Text style={[styles.pillText, { color: colors.text }]}>⇅ {SORT_MODE_LABELS[sortMode]}</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.pill, { backgroundColor: colors.accent }]}
              onPress={() => router.push('/habit/new')}
            >
              <Text style={[styles.pillText, { color: '#fff' }]}>+ Habit</Text>
            </Pressable>
          </View>
        </View>
        {habits.length > 0 && (
          <LevelStrip progression={progression} onPress={() => router.push('/stats')} />
        )}
      </View>

      {activeHabits.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyBadge, { backgroundColor: colors.accentSoft }]}>
            <Text style={styles.emptyEmoji}>🌱</Text>
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Start your first habit</Text>
          <Text style={[styles.emptyText, { color: colors.subtext }]}>
            Tap + Habit to add something you'd like to do every day.
          </Text>
        </View>
      ) : dueHabits.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyBadge, { backgroundColor: colors.accentSoft }]}>
            <Text style={styles.emptyEmoji}>☀️</Text>
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Nothing due today</Text>
          <Text style={[styles.emptyText, { color: colors.subtext }]}>Enjoy the break.</Text>
        </View>
      ) : (
        <ScrollViewContainer contentContainerStyle={styles.list}>
          {!canDrag && (
            <Text style={[styles.sortHint, { color: colors.subtext }]}>
              Sorted by {SORT_MODE_LABELS[sortMode].toLowerCase()} — switch to Custom to drag.
            </Text>
          )}
          {sections.map((section) => {
            const doneCount = section.habits.filter((h) => cardData.get(h.id)?.done).length;
            return (
              <View key={section.key}>
                {section.title && (
                  <Text style={[styles.sectionTitle, { color: colors.subtext }]}>
                    {section.emoji ? `${section.emoji}  ` : ''}
                    {section.title}
                    <Text style={{ color: colors.muted }}>
                      {'  ·  '}
                      {doneCount}/{section.habits.length}
                    </Text>
                  </Text>
                )}
                <NestedReorderableList
                  data={section.habits}
                  keyExtractor={(item) => item.id}
                  // The page scrolls, not each section; this also tells React
                  // Native the nested list isn't competing with it for scroll.
                  scrollEnabled={false}
                  dragEnabled={canDrag}
                  onReorder={(event) => handleReorder(section.habits, event)}
                  renderItem={({ item }) => {
                    const data = cardData.get(item.id);
                    const skipDates = data?.skipDates ?? EMPTY_SKIPS;
                    const value = data?.value ?? 0;
                    return (
                      <DraggableHabitCard
                        habit={item}
                        completed={data?.done ?? false}
                        streak={data?.streak ?? 0}
                        value={value}
                        skipped={skipDates.includes(today)}
                        badge={challengeBadges.get(item.id)}
                        draggable={canDrag}
                        onToggle={() => handleToggle(item.id)}
                        onAddStep={() => handleStep(item, 1)}
                        onSubtractStep={() => handleStep(item, -1)}
                        onReset={() => handleReset(item.id)}
                        onOptions={() => handleOptions(item, value, skipDates)}
                      />
                    );
                  }}
                />
              </View>
            );
          })}
        </ScrollViewContainer>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.md,
    gap: space.lg,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: { ...font.largeTitle },
  subtitle: { ...font.caption, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  pill: {
    paddingHorizontal: space.md + 2,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
  pillText: { ...font.label },
  sortHint: { ...font.caption, marginBottom: space.md },
  list: { paddingHorizontal: space.xl, paddingTop: space.xs, paddingBottom: space.xxl },
  sectionTitle: { ...font.label, marginTop: space.md, marginBottom: space.sm + 2, marginLeft: space.xs },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: space.sm,
  },
  emptyBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  emptyTitle: { ...font.headline },
  emptyEmoji: { fontSize: 38 },
  emptyText: { ...font.body, textAlign: 'center', lineHeight: 21 },
});
