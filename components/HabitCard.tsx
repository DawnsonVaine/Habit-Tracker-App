import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { Habit } from '../types/habit';
import { formatProgress } from '../utils/goals';

interface Props {
  habit: Habit;
  completed: boolean;
  streak: number;
  /** Value logged for today; only meaningful for count/duration habits. */
  value: number;
  onToggle: () => void;
  /** Adds one step toward a count/duration target. */
  onAddStep: () => void;
  /** Takes one step back off a count/duration total. */
  onSubtractStep: () => void;
  /** Clears the day's logged value on a count/duration habit. */
  onReset: () => void;
  /** Long-pressing the habit's name area starts a drag-to-reorder gesture. */
  onLongPress?: () => void;
}

export function HabitCard({
  habit,
  completed,
  streak,
  value,
  onToggle,
  onAddStep,
  onSubtractStep,
  onReset,
  onLongPress,
}: Props) {
  const { colors } = useTheme();
  const isBinary = habit.goalType === 'binary';

  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Link href={{ pathname: '/habit/[id]', params: { id: habit.id } }} asChild>
        <Pressable style={styles.info} onLongPress={onLongPress} delayLongPress={220}>
          <Text style={styles.emoji}>{habit.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {habit.name}
            </Text>
            <Text style={[styles.streak, { color: colors.subtext }]} numberOfLines={1}>
              {isBinary
                ? streak > 0
                  ? `🔥 ${streak} day streak`
                  : 'No streak yet'
                : `${formatProgress(habit, value)}${streak > 0 ? `  ·  🔥 ${streak}` : ''}`}
            </Text>
          </View>
        </Pressable>
      </Link>

      {isBinary ? (
        <Pressable
          onPress={onToggle}
          style={[
            styles.checkbox,
            {
              backgroundColor: completed ? habit.color : 'transparent',
              borderColor: habit.color,
            },
          ]}
        >
          {completed && <Text style={styles.check}>✓</Text>}
        </Pressable>
      ) : (
        <View style={styles.stepperGroup}>
          {/* Nothing to take away at zero, so the minus only appears once there is. */}
          {value > 0 && (
            <Pressable
              onPress={onSubtractStep}
              hitSlop={4}
              style={[styles.stepButton, { borderColor: habit.color }]}
            >
              <Text style={[styles.stepperText, { color: habit.color }]}>−</Text>
            </Pressable>
          )}
          {/* Long press clears the day. Reset lives here rather than on the card
              body, which is already taken by drag-to-reorder. */}
          <Pressable
            onPress={completed ? onReset : onAddStep}
            onLongPress={onReset}
            delayLongPress={400}
            hitSlop={4}
            style={[
              styles.stepper,
              {
                backgroundColor: completed ? habit.color : 'transparent',
                borderColor: habit.color,
              },
            ]}
          >
            <Text style={[styles.stepperText, { color: completed ? '#fff' : habit.color }]}>
              {completed ? '✓' : '+'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  info: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emoji: {
    fontSize: 28,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  streak: {
    fontSize: 13,
    marginTop: 2,
  },
  checkbox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  check: {
    color: '#fff',
    fontWeight: '700',
  },
  stepperGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 10,
  },
  stepButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepper: {
    minWidth: 44,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: {
    fontSize: 17,
    fontWeight: '700',
  },
});
