import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { Challenge, Habit } from '../types/habit';
import {
  CHALLENGE_LENGTHS,
  ChallengeProgress,
  challengeLengthLabel,
  countSessions,
} from '../utils/challenges';
import { MONTH_LABELS, parseDateStr, todayStr } from '../utils/dates';
import { withAlpha } from '../utils/goals';

export interface ChallengeView {
  challenge: Challenge;
  result: ChallengeProgress;
}

interface Props {
  habit: Habit;
  /** The challenge currently running, if any. */
  active: ChallengeView | null;
  /** The most recent finished one, shown as a footnote when nothing is running. */
  last: ChallengeView | null;
  onStart: (lengthDays: number) => void;
  onAbandon: (challengeId: string) => void;
}

export function formatShortDate(dateStr: string): string {
  const d = parseDateStr(dateStr);
  return `${MONTH_LABELS[d.getMonth()]} ${d.getDate()}`;
}

function lastResultText({ challenge, result }: ChallengeView): string {
  const length = challengeLengthLabel(challenge.lengthDays);
  if (result.status === 'completed') return `🏆 Last challenge: ${length}, completed`;
  if (result.status === 'abandoned') return `Last challenge: ${length}, given up`;
  return `Last challenge: ${length}, ended ${formatShortDate(result.failedOn ?? result.endDate)}`;
}

function ProgressBar({ ratio, color, trackColor }: { ratio: number; color: string; trackColor: string }) {
  const fill = useSharedValue(0);
  // Measured, not a percentage: a percentage width on an absolutely positioned
  // child resolves against the parent's content box, not its visible width.
  const trackWidth = useSharedValue(0);

  useEffect(() => {
    fill.value = withTiming(ratio, { duration: 620, easing: Easing.out(Easing.cubic) });
  }, [fill, ratio]);

  const fillStyle = useAnimatedStyle(() => ({ width: trackWidth.value * fill.value }));

  return (
    <View
      style={[styles.track, { backgroundColor: trackColor }]}
      onLayout={(e) => {
        trackWidth.value = e.nativeEvent.layout.width;
      }}
    >
      <Animated.View style={[styles.trackFill, { backgroundColor: color }, fillStyle]} />
    </View>
  );
}

export function ChallengeCard({ habit, active, last, onStart, onAbandon }: Props) {
  const { colors } = useTheme();
  const cardStyle = [styles.card, { backgroundColor: colors.card, borderColor: colors.border }];

  if (active) {
    const { challenge, result } = active;
    const kept = result.sessionsDone + result.sessionsRested;
    const ratio = result.sessionsTotal === 0 ? 0 : kept / result.sessionsTotal;

    return (
      <View style={cardStyle}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.text }]}>
            🏆 {challengeLengthLabel(challenge.lengthDays)} challenge
          </Text>
          <Text style={[styles.meta, { color: colors.subtext }]}>
            Day {result.dayNumber} of {challenge.lengthDays}
          </Text>
        </View>

        <ProgressBar ratio={ratio} color={habit.color} trackColor={colors.border} />

        <Text style={[styles.body, { color: colors.text }]}>
          {kept} of {result.sessionsTotal} sessions kept
          {result.sessionsRested > 0 ? ` · ${result.sessionsRested} rested` : ''}
        </Text>
        {result.todayOpen && (
          <Text style={[styles.nudge, { color: habit.color }]}>Today's session is still open.</Text>
        )}

        <View style={styles.footerRow}>
          <Text style={[styles.meta, { color: colors.subtext }]}>
            Ends {formatShortDate(result.endDate)} · +{result.bonusXp} XP if you finish
          </Text>
          <Pressable onPress={() => onAbandon(challenge.id)} hitSlop={8}>
            <Text style={[styles.giveUp, { color: colors.subtext }]}>Give up</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const today = todayStr();

  return (
    <View style={cardStyle}>
      <Text style={[styles.title, { color: colors.text }]}>🏆 Take on a challenge</Text>
      <Text style={[styles.description, { color: colors.subtext }]}>
        Complete every scheduled session for a set run. Miss one and it's over — but rest days still
        count.
      </Text>

      <View style={styles.chips}>
        {CHALLENGE_LENGTHS.map((length) => {
          const sessions = countSessions(habit, today, length);
          return (
            <Pressable
              key={length}
              onPress={() => onStart(length)}
              style={[styles.chip, { borderColor: habit.color, backgroundColor: withAlpha(habit.color, 0.08) }]}
            >
              <Text style={[styles.chipLabel, { color: habit.color }]}>{challengeLengthLabel(length)}</Text>
              <Text style={[styles.chipSub, { color: colors.subtext }]}>{sessions} sessions</Text>
            </Pressable>
          );
        })}
      </View>

      {last && <Text style={[styles.meta, styles.lastResult, { color: colors.subtext }]}>{lastResultText(last)}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  title: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12 },
  body: { fontSize: 14, fontWeight: '600', marginTop: 10 },
  nudge: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  description: { fontSize: 13, lineHeight: 18, marginTop: 6 },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  giveUp: { fontSize: 13, fontWeight: '600' },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  trackFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  chip: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 72,
    alignItems: 'center',
  },
  chipLabel: { fontSize: 14, fontWeight: '700' },
  chipSub: { fontSize: 11, marginTop: 2 },
  lastResult: { marginTop: 12 },
});
