import { Link } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { Habit } from '../types/habit';
import { dayCredit, formatProgress, withAlpha } from '../utils/goals';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Quick and slightly springy, so taps feel responsive rather than bouncy. */
const PRESS_SPRING = { damping: 14, stiffness: 340, mass: 0.5 };
const FILL_TIMING = { duration: 260, easing: Easing.out(Easing.cubic) };

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
  /** Today was deliberately rested, so the streak is protected. */
  skipped: boolean;
  /** Long-pressing the completion control opens rest-day and reset options. */
  onOptions: () => void;
  /** Short tag shown beside the name, e.g. a running challenge's day count. */
  badge?: string;
  /** Long-pressing the habit's name area starts a drag-to-reorder gesture. */
  onLongPress?: () => void;
}

/** Shared squash-on-press feel for every control on the card. */
function usePressScale() {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return {
    style,
    onPressIn: () => {
      scale.value = withSpring(0.88, PRESS_SPRING);
    },
    onPressOut: () => {
      scale.value = withSpring(1, PRESS_SPRING);
    },
  };
}

function CheckButton({
  color,
  completed,
  skipped,
  onPress,
  onLongPress,
}: {
  color: string;
  completed: boolean;
  skipped: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const press = usePressScale();
  const fill = useSharedValue(completed ? 1 : 0);

  useEffect(() => {
    fill.value = withTiming(completed ? 1 : 0, FILL_TIMING);
  }, [completed, fill]);

  // The fill grows out from the middle as it fades in, so completing reads as a
  // small burst rather than an instant colour swap.
  const fillStyle = useAnimatedStyle(() => ({
    opacity: fill.value,
    transform: [{ scale: 0.5 + fill.value * 0.5 }],
  }));
  const tickStyle = useAnimatedStyle(() => ({
    opacity: fill.value,
    transform: [{ scale: fill.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[
        styles.checkbox,
        // A rest day fades the ring so it reads as paused rather than missed.
        { borderColor: skipped && !completed ? withAlpha(color, 0.35) : color },
        press.style,
      ]}
    >
      <Animated.View style={[styles.checkboxFill, { backgroundColor: color }, fillStyle]} />
      {skipped && !completed ? (
        <Text style={[styles.restMark, { color }]}>–</Text>
      ) : (
        <Animated.Text style={[styles.check, tickStyle]}>✓</Animated.Text>
      )}
    </AnimatedPressable>
  );
}

function StepButton({
  habit,
  value,
  completed,
  onAddStep,
  onReset,
  onOptions,
}: {
  habit: Habit;
  value: number;
  completed: boolean;
  onAddStep: () => void;
  onReset: () => void;
  onOptions: () => void;
}) {
  const press = usePressScale();
  const credit = dayCredit(habit, value);
  const fill = useSharedValue(credit);
  // Measured rather than a percentage: a percentage width on an absolutely
  // positioned child resolves against the parent's content box, which the
  // pill's padding and border shrink well below its visible width.
  const trackWidth = useSharedValue(0);

  useEffect(() => {
    fill.value = withTiming(credit, FILL_TIMING);
  }, [credit, fill]);

  // The fill sweeps across the pill as progress builds, so the button itself
  // doubles as a progress bar.
  const fillStyle = useAnimatedStyle(() => ({ width: trackWidth.value * fill.value }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(fill.value, [0, 0.7, 1], [habit.color, habit.color, '#ffffff']),
  }));

  return (
    <AnimatedPressable
      onPress={completed ? onReset : onAddStep}
      onLongPress={onOptions}
      delayLongPress={400}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      onLayout={(e) => {
        trackWidth.value = e.nativeEvent.layout.width;
      }}
      hitSlop={4}
      style={[styles.stepper, { borderColor: habit.color }, press.style]}
    >
      <Animated.View style={[styles.stepperFill, { backgroundColor: habit.color }, fillStyle]} />
      <Animated.Text style={[styles.stepperText, labelStyle]}>{completed ? '✓' : '+'}</Animated.Text>
    </AnimatedPressable>
  );
}

function MinusButton({ color, onPress }: { color: string; onPress: () => void }) {
  const press = usePressScale();

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      hitSlop={4}
      style={[styles.stepButton, { borderColor: color }, press.style]}
    >
      <Text style={[styles.stepperText, { color }]}>−</Text>
    </AnimatedPressable>
  );
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
  skipped,
  onOptions,
  badge,
  onLongPress,
}: Props) {
  const { colors } = useTheme();
  const isBinary = habit.goalType === 'binary';
  const resting = skipped && !completed;
  const streakText = streak > 0 ? `🔥 ${streak}` : '';

  let subtitle: string;
  if (resting) {
    subtitle = streak > 0 ? `Rest day · 🔥 ${streak} protected` : 'Rest day';
  } else if (isBinary) {
    subtitle = streak > 0 ? `🔥 ${streak} day streak` : 'No streak yet';
  } else {
    subtitle = `${formatProgress(habit, value)}${streakText ? `  ·  ${streakText}` : ''}`;
  }

  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Link href={{ pathname: '/habit/[id]', params: { id: habit.id } }} asChild>
        <Pressable style={styles.info} onLongPress={onLongPress} delayLongPress={220}>
          <Text style={[styles.emoji, resting && styles.restingEmoji]}>{habit.emoji}</Text>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={[styles.name, styles.nameText, { color: colors.text }]} numberOfLines={1}>
                {habit.name}
              </Text>
              {badge && (
                <View style={[styles.badge, { backgroundColor: withAlpha(habit.color, 0.14) }]}>
                  <Text style={[styles.badgeText, { color: habit.color }]} numberOfLines={1}>
                    {badge}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.streak, { color: colors.subtext }]} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
        </Pressable>
      </Link>

      {/* Long-pressing either control opens day options: rest days, and reset
          for count habits. The card body's long press is drag-to-reorder. */}
      {isBinary ? (
        <CheckButton
          color={habit.color}
          completed={completed}
          skipped={skipped}
          onPress={onToggle}
          onLongPress={onOptions}
        />
      ) : (
        <View style={styles.stepperGroup}>
          {/* Nothing to take away at zero, so the minus only appears once there is. */}
          {value > 0 && <MinusButton color={habit.color} onPress={onSubtractStep} />}
          <StepButton
            habit={habit}
            value={value}
            completed={completed}
            onAddStep={onAddStep}
            onReset={onReset}
            onOptions={onOptions}
          />
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
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // Lets a long name truncate instead of pushing the badge off the card.
  nameText: { flexShrink: 1 },
  badge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700' },
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
    overflow: 'hidden',
  },
  checkboxFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 16,
  },
  check: {
    color: '#fff',
    fontWeight: '700',
  },
  restMark: {
    fontSize: 18,
    fontWeight: '700',
    opacity: 0.6,
  },
  restingEmoji: {
    opacity: 0.45,
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
    overflow: 'hidden',
  },
  stepperFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  stepperText: {
    fontSize: 17,
    fontWeight: '700',
  },
});
