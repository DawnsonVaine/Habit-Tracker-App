import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ReorderableList, {
  ReorderableListReorderEvent,
  reorderItems,
  useReorderableDrag,
} from 'react-native-reorderable-list';
import { HabitCard } from '../../components/HabitCard';
import { useTheme } from '../../hooks/useTheme';
import { useHabitStore } from '../../store/habitStore';
import { Habit } from '../../types/habit';
import { todayStr } from '../../utils/dates';
import { EMPTY_PROGRESS, isDayComplete } from '../../utils/goals';
import { getStreaks, isDueOnDate } from '../../utils/streaks';

interface DraggableHabitCardProps {
  habit: Habit;
  completed: boolean;
  streak: number;
  value: number;
  onToggle: () => void;
  onAddStep: () => void;
  onReset: () => void;
}

/**
 * Wraps HabitCard so a long press starts the reorder drag. The hook that
 * provides `drag` only works inside an item rendered by ReorderableList.
 */
function DraggableHabitCard({ habit, ...cardProps }: DraggableHabitCardProps) {
  const drag = useReorderableDrag();

  function handleLongPress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    drag();
  }

  return <HabitCard habit={habit} {...cardProps} onLongPress={handleLongPress} />;
}

export default function TodayScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const habits = useHabitStore((s) => s.habits);
  const completions = useHabitStore((s) => s.completions);
  const toggleCompletion = useHabitStore((s) => s.toggleCompletion);
  const addProgress = useHabitStore((s) => s.addProgress);
  const resetProgress = useHabitStore((s) => s.resetProgress);
  const reorderHabits = useHabitStore((s) => s.reorderHabits);
  const hasHydrated = useHabitStore((s) => s.hasHydrated);

  const today = todayStr();
  const todayLabel = useMemo(
    () => new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
    []
  );

  const activeHabits = useMemo(() => habits.filter((h) => !h.archived), [habits]);
  const dueHabits = activeHabits.filter((h) => isDueOnDate(h, today));

  function handleToggle(habitId: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleCompletion(habitId, today);
  }

  function handleAddStep(habit: Habit) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addProgress(habit.id, habit.step, today);
  }

  function handleReset(habitId: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    resetProgress(habitId, today);
  }

  // Only today's due habits are on screen, so we hand the store just those ids.
  // reorderHabits permutes the slots they occupy and leaves every other habit put.
  function handleReorder({ from, to }: ReorderableListReorderEvent) {
    reorderHabits(reorderItems(dueHabits, from, to).map((h) => h.id));
  }

  if (!hasHydrated) {
    return <View style={[styles.container, { backgroundColor: colors.background }]} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Today</Text>
          <Text style={[styles.subtitle, { color: colors.subtext }]}>{todayLabel}</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={[styles.addButton, { backgroundColor: colors.accent }]}
            onPress={() => router.push('/habit/new')}
          >
            <Text style={styles.addButtonText}>+ Habit</Text>
          </Pressable>
        </View>
      </View>

      {activeHabits.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🌱</Text>
          <Text style={[styles.emptyText, { color: colors.subtext }]}>
            No habits yet. Tap '+ Habit' to create your first one.
          </Text>
        </View>
      ) : dueHabits.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🌱</Text>
          <Text style={[styles.emptyText, { color: colors.subtext }]}>Nothing due today. Enjoy the break!</Text>
        </View>
      ) : (
        <ReorderableList
          data={dueHabits}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onReorder={handleReorder}
          renderItem={({ item }) => {
            const progress = completions[item.id] ?? EMPTY_PROGRESS;
            const { current } = getStreaks(item, progress);
            const value = progress[today] ?? 0;
            return (
              <DraggableHabitCard
                habit={item}
                completed={isDayComplete(item, value)}
                streak={current}
                value={value}
                onToggle={() => handleToggle(item.id)}
                onAddStep={() => handleAddStep(item)}
                onReset={() => handleReset(item.id)}
              />
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  addButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: { color: '#fff', fontWeight: '600' },
  list: { paddingHorizontal: 20, paddingBottom: 24 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 15, textAlign: 'center' },
});
