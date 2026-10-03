import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { font, radius, space, useTheme } from '../hooks/useTheme';
import { Progression } from '../utils/progression';

interface Props {
  progression: Progression;
  onPress: () => void;
}

/** A one-line glance at rank and progress for the top of Today. */
export function LevelStrip({ progression, onPress }: Props) {
  const { colors, card } = useTheme();
  const { rank, ratio, isMaxLevel } = progression;

  const fill = useSharedValue(0);
  // Measured, not a percentage: a percentage width on an absolutely positioned
  // child resolves against the parent's content box, not its visible width.
  const trackWidth = useSharedValue(0);

  useEffect(() => {
    fill.value = withTiming(ratio, { duration: 620, easing: Easing.out(Easing.cubic) });
  }, [fill, ratio]);

  const fillStyle = useAnimatedStyle(() => ({ width: trackWidth.value * fill.value }));

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.strip, card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${rank.label}, ${Math.round(ratio * 100)} percent to the next level. Opens stats.`}
    >
      <Text style={styles.emoji}>{rank.tier.emoji}</Text>
      <Text style={[styles.label, { color: colors.accent }]}>{rank.label}</Text>
      <View
        style={[styles.track, { backgroundColor: colors.fill }]}
        onLayout={(e) => {
          trackWidth.value = e.nativeEvent.layout.width;
        }}
      >
        <Animated.View style={[styles.trackFill, { backgroundColor: colors.accent }, fillStyle]} />
      </View>
      <Text style={[styles.percent, { color: colors.subtext }]}>
        {isMaxLevel ? 'Max' : `${Math.round(ratio * 100)}%`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.md,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.md,
  },
  pressed: { opacity: 0.7 },
  emoji: { fontSize: 16 },
  label: { ...font.label },
  track: { flex: 1, height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  trackFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: radius.pill },
  percent: { ...font.caption, minWidth: 34, textAlign: 'right' },
});
