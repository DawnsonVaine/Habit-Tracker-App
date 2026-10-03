import { Pressable, StyleSheet, Text, View } from 'react-native';
import { font, radius, space, useTheme } from '../hooks/useTheme';
import { Habit } from '../types/habit';
import { withAlpha } from '../utils/goals';
import { describeNextDue, nextDueDate, scheduleLabel } from '../utils/schedule';

interface Props {
  habits: Habit[];
  today: string;
  expanded: boolean;
  /** Omitted when the section can't be collapsed (nothing else is on screen). */
  onToggle?: () => void;
  onOpen: (habit: Habit) => void;
  onEdit: (habit: Habit) => void;
}

/**
 * Habits that aren't scheduled today, so they can still be reached and
 * edited. Read-only here: they're completed on the days they're due.
 */
export function NotDueSection({ habits, today, expanded, onToggle, onOpen, onEdit }: Props) {
  const { colors, card } = useTheme();

  return (
    <View style={styles.section}>
      <Pressable
        onPress={onToggle}
        disabled={!onToggle}
        hitSlop={6}
        style={styles.header}
        accessibilityRole={onToggle ? 'button' : undefined}
        accessibilityState={onToggle ? { expanded } : undefined}
      >
        <Text style={[styles.title, { color: colors.subtext }]}>
          Not due today
          <Text style={{ color: colors.muted }}>{`  ·  ${habits.length}`}</Text>
        </Text>
        {onToggle && (
          <Text
            style={[
              styles.chevron,
              { color: colors.muted, transform: [{ rotate: expanded ? '90deg' : '0deg' }] },
            ]}
          >
            ›
          </Text>
        )}
      </Pressable>

      {expanded &&
        habits.map((habit) => {
          const next = nextDueDate(habit, today);
          return (
            <Pressable
              key={habit.id}
              onPress={() => onOpen(habit)}
              style={({ pressed }) => [styles.row, card, pressed && styles.pressed]}
            >
              <View style={[styles.tile, { backgroundColor: withAlpha(habit.color, 0.1) }]}>
                <Text style={styles.emoji}>{habit.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {habit.name}
                </Text>
                <Text style={[styles.meta, { color: colors.subtext }]} numberOfLines={1}>
                  {scheduleLabel(habit)}
                  {next ? `  ·  next ${describeNextDue(next, today)}` : ''}
                </Text>
              </View>
              <Pressable
                onPress={() => onEdit(habit)}
                hitSlop={8}
                style={[styles.edit, { backgroundColor: colors.accentSoft }]}
              >
                <Text style={[styles.editText, { color: colors.accent }]}>Edit</Text>
              </Pressable>
            </Pressable>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm + 2,
    marginLeft: space.xs,
  },
  title: { ...font.label },
  chevron: { fontSize: 20, marginRight: space.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.lg,
    paddingVertical: space.md - 2,
    paddingHorizontal: space.md + 2,
    marginBottom: space.sm,
  },
  pressed: { opacity: 0.7 },
  // Slightly smaller and fainter than Today's cards: these aren't actionable today.
  tile: {
    width: 38,
    height: 38,
    borderRadius: radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.7,
  },
  emoji: { fontSize: 20 },
  name: { ...font.body, fontWeight: '600' },
  meta: { ...font.caption, marginTop: 1 },
  edit: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 6 },
  editText: { ...font.label },
});
