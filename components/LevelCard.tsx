import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { Progression } from '../utils/progression';

interface Props {
  progression: Progression;
  accentColor: string;
}

export function LevelCard({ progression, accentColor }: Props) {
  const { colors } = useTheme();
  const { level, rank, nextRank, xpTotal, xpIntoLevel, xpForLevel, ratio } = progression;

  const fill = useSharedValue(0);
  // Measured, not a percentage: a percentage width on an absolutely positioned
  // child resolves against the parent's content box, not its visible width.
  const trackWidth = useSharedValue(0);

  useEffect(() => {
    fill.value = withTiming(ratio, { duration: 620, easing: Easing.out(Easing.cubic) });
  }, [fill, ratio]);

  const fillStyle = useAnimatedStyle(() => ({ width: trackWidth.value * fill.value }));

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={styles.rankEmoji}>{rank.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.level, { color: colors.text }]}>Level {level}</Text>
          <Text style={[styles.rankName, { color: colors.subtext }]}>{rank.name}</Text>
        </View>
        <Text style={[styles.totalXp, { color: accentColor }]}>{xpTotal.toLocaleString()} XP</Text>
      </View>

      <View
        style={[styles.track, { backgroundColor: colors.border }]}
        onLayout={(e) => {
          trackWidth.value = e.nativeEvent.layout.width;
        }}
      >
        <Animated.View style={[styles.trackFill, { backgroundColor: accentColor }, fillStyle]} />
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.subtext }]}>
          {xpIntoLevel} / {xpForLevel} XP to level {level + 1}
        </Text>
        {nextRank && (
          <Text style={[styles.footerText, { color: colors.subtext }]}>
            {nextRank.emoji} {nextRank.name} at {nextRank.minLevel}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  rankEmoji: { fontSize: 32 },
  level: { fontSize: 20, fontWeight: '800' },
  rankName: { fontSize: 13, marginTop: 1 },
  totalXp: { fontSize: 15, fontWeight: '700' },
  track: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 5,
  },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  footerText: { fontSize: 11 },
});
