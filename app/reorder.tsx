import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  NestedReorderableList,
  ReorderableListReorderEvent,
  reorderItems,
  ScrollViewContainer,
  useReorderableDrag,
} from 'react-native-reorderable-list';
import { WEEKDAY_SHORT } from '../constants/habitOptions';
import { radius, useTheme } from '../hooks/useTheme';
import { useHabitStore } from '../store/habitStore';
import { Habit } from '../types/habit';
import { groupByCategory } from '../utils/categories';

/** "Daily", "Mon, Wed, Fri" or "3× a week" — explains why a habit may be missing from Today. */
function scheduleLabel(habit: Habit): string {
  const { frequency } = habit;
  if (frequency.type === 'daily') return 'Daily';
  if (frequency.type === 'timesPerWeek') return `${frequency.count}× a week`;
  return frequency.days.map((d) => WEEKDAY_SHORT[d]).join(', ');
}

function ReorderRow({ habit }: { habit: Habit }) {
  const { colors, card } = useTheme();
  const drag = useReorderableDrag();

  return (
    <Pressable
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        drag();
      }}
      delayLongPress={180}
      style={[styles.row, card]}
    >
      <Text style={styles.emoji}>{habit.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {habit.name}
        </Text>
        <Text style={[styles.schedule, { color: colors.subtext }]} numberOfLines={1}>
          {scheduleLabel(habit)}
        </Text>
      </View>
      <Text style={[styles.handle, { color: colors.subtext }]}>≡</Text>
    </Pressable>
  );
}

/**
 * Every active habit in one list, for reordering habits that aren't due today
 * and so never appear on the Today screen to be dragged there.
 */
export default function ReorderScreen() {
  const { colors } = useTheme();
  const habits = useHabitStore((s) => s.habits);
  const categories = useHabitStore((s) => s.categories);
  const reorderHabits = useHabitStore((s) => s.reorderHabits);

  const activeHabits = useMemo(() => habits.filter((h) => !h.archived), [habits]);
  const sections = useMemo(() => groupByCategory(activeHabits, categories), [activeHabits, categories]);

  // Grouped the same way as Today, so a drag here means the same thing there.
  // Archived habits and other sections keep their slots untouched.
  function handleReorder(sectionHabits: Habit[], { from, to }: ReorderableListReorderEvent) {
    reorderHabits(reorderItems(sectionHabits, from, to).map((h) => h.id));
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {activeHabits.length < 2 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>↕️</Text>
          <Text style={[styles.emptyText, { color: colors.subtext }]}>
            Add a couple of habits and you can reorder them here.
          </Text>
        </View>
      ) : (
        <ScrollViewContainer contentContainerStyle={styles.list}>
          <Text style={[styles.hint, { color: colors.subtext }]}>
            Press and hold a habit, then drag it into place.
            {categories.length > 0 ? ' Habits move within their category.' : ''}
          </Text>
          {sections.map((section) => (
            <View key={section.key}>
              {section.title && (
                <Text style={[styles.sectionTitle, { color: colors.subtext }]}>
                  {section.emoji ? `${section.emoji} ` : ''}
                  {section.title}
                </Text>
              )}
              <NestedReorderableList
                data={section.habits}
                keyExtractor={(item) => item.id}
                // The page scrolls, not each section; this also tells React
                // Native the nested list isn't competing with it for scroll.
                scrollEnabled={false}
                onReorder={(event) => handleReorder(section.habits, event)}
                renderItem={({ item }) => <ReorderRow habit={item} />}
              />
            </View>
          ))}
        </ScrollViewContainer>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 20 },
  hint: { fontSize: 13, marginBottom: 14, lineHeight: 18 },
  sectionTitle: { fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 10, marginLeft: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    gap: 12,
  },
  emoji: { fontSize: 24 },
  name: { fontSize: 16, fontWeight: '600' },
  schedule: { fontSize: 12, marginTop: 2 },
  handle: { fontSize: 22, fontWeight: '600' },
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
