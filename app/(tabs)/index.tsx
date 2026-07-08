import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { HabitCard } from '../../components/HabitCard';
import { useTheme } from '../../hooks/useTheme';
import { useHabitStore } from '../../store/habitStore';
import { todayStr } from '../../utils/dates';
import { getStreaks, isDueOnDate } from '../../utils/streaks';

export default function TodayScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const habits = useHabitStore((s) => s.habits);
  const completions = useHabitStore((s) => s.completions);
  const toggleCompletion = useHabitStore((s) => s.toggleCompletion);
  const reorderHabits = useHabitStore((s) => s.reorderHabits);
  const hasHydrated = useHabitStore((s) => s.hasHydrated);
  const [reordering, setReordering] = useState(false);

  const today = todayStr();
  const todayLabel = useMemo(
    () => new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
    []
  );

  const activeHabits = useMemo(() => habits.filter((h) => !h.archived), [habits]);
  const dueHabits = activeHabits.filter((h) => isDueOnDate(h, today));

  function moveHabit(index: number, direction: -1 | 1) {
    const swapWith = index + direction;
    if (swapWith < 0 || swapWith >= activeHabits.length) return;
    const newOrder = activeHabits.map((h) => h.id);
    [newOrder[index], newOrder[swapWith]] = [newOrder[swapWith], newOrder[index]];
    reorderHabits(newOrder);
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
          {activeHabits.length > 1 && (
            <Pressable style={styles.reorderButton} onPress={() => setReordering((r) => !r)}>
              <Text style={[styles.reorderButtonText, { color: colors.accent }]}>
                {reordering ? 'Done' : 'Reorder'}
              </Text>
            </Pressable>
          )}
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
      ) : reordering ? (
        <FlatList
          data={activeHabits}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <View style={[styles.reorderRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={styles.reorderEmoji}>{item.emoji}</Text>
              <Text style={[styles.reorderName, { color: colors.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.reorderArrows}>
                <Pressable
                  onPress={() => moveHabit(index, -1)}
                  disabled={index === 0}
                  hitSlop={6}
                  style={styles.arrowButton}
                >
                  <Text style={[styles.arrowText, { color: index === 0 ? colors.border : colors.accent }]}>▲</Text>
                </Pressable>
                <Pressable
                  onPress={() => moveHabit(index, 1)}
                  disabled={index === activeHabits.length - 1}
                  hitSlop={6}
                  style={styles.arrowButton}
                >
                  <Text
                    style={[
                      styles.arrowText,
                      { color: index === activeHabits.length - 1 ? colors.border : colors.accent },
                    ]}
                  >
                    ▼
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      ) : dueHabits.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🌱</Text>
          <Text style={[styles.emptyText, { color: colors.subtext }]}>Nothing due today. Enjoy the break!</Text>
        </View>
      ) : (
        <FlatList
          data={dueHabits}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const habitCompletions = completions[item.id] ?? [];
            const { current } = getStreaks(item, habitCompletions);
            return (
              <HabitCard
                habit={item}
                completed={habitCompletions.includes(today)}
                streak={current}
                onToggle={() => toggleCompletion(item.id, today)}
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
  reorderButton: { paddingVertical: 8, paddingHorizontal: 4 },
  reorderButtonText: { fontSize: 15, fontWeight: '600' },
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
  reorderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
    gap: 12,
  },
  reorderEmoji: { fontSize: 24 },
  reorderName: { flex: 1, fontSize: 16, fontWeight: '600' },
  reorderArrows: { flexDirection: 'row', gap: 4 },
  arrowButton: { padding: 8 },
  arrowText: { fontSize: 16 },
});
