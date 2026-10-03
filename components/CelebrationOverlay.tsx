import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';

/**
 * The one celebratory moment in the app, shared by level-ups and completed
 * challenges: a badge springs in over expanding rings, then the text settles.
 */
interface Props {
  visible: boolean;
  /** The badge, e.g. a tier emblem or a trophy. */
  emoji: string;
  /** Small line above the headline, e.g. "Level up!". */
  heading: string;
  /** The big line, e.g. "Iron 3". */
  headline: string;
  subtitle: string;
  accentColor: string;
  onDismiss: () => void;
}

const BADGE_SPRING = { damping: 11, stiffness: 180, mass: 0.7 };

/** Expanding rings behind the badge, standing in for a burst without a particle library. */
function Ring({ color, delay, size }: { color: string; delay: number; size: number }) {
  const spread = useSharedValue(0);

  useEffect(() => {
    spread.value = withDelay(delay, withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }));
  }, [delay, spread]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - spread.value),
    transform: [{ scale: 0.5 + spread.value * 1.3 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: size / 2, borderColor: color },
        style,
      ]}
    />
  );
}

export function CelebrationOverlay({
  visible,
  emoji,
  heading,
  headline,
  subtitle,
  accentColor,
  onDismiss,
}: Props) {
  const { colors } = useTheme();

  const badge = useSharedValue(0);
  const content = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      badge.value = 0;
      content.value = 0;
      return;
    }
    // Badge lands first with an overshoot, then the text settles in under it.
    badge.value = withSequence(
      withTiming(0, { duration: 60 }),
      withSpring(1, BADGE_SPRING)
    );
    content.value = withDelay(220, withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }));
  }, [badge, content, visible]);

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: badge.value,
    transform: [{ scale: badge.value }, { rotate: `${(1 - badge.value) * -25}deg` }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: content.value,
    transform: [{ translateY: (1 - content.value) * 14 }],
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.badgeArea}>
            <Ring color={accentColor} delay={140} size={120} />
            <Ring color={accentColor} delay={300} size={120} />
            <Animated.Text style={[styles.badge, badgeStyle]}>{emoji}</Animated.Text>
          </View>

          <Animated.View style={contentStyle}>
            <Text style={[styles.heading, { color: colors.text }]}>{heading}</Text>
            <Text style={[styles.level, { color: accentColor }]}>{headline}</Text>
            <Text style={[styles.sub, { color: colors.subtext }]}>{subtitle}</Text>
          </Animated.View>

          <Pressable onPress={onDismiss} style={[styles.button, { backgroundColor: accentColor }]}>
            <Text style={styles.buttonText}>Nice</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  badgeArea: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  ring: { position: 'absolute', borderWidth: 2 },
  badge: { fontSize: 64 },
  heading: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  level: { fontSize: 34, fontWeight: '800', textAlign: 'center', marginTop: 2 },
  sub: { fontSize: 13, textAlign: 'center', marginTop: 6 },
  button: {
    marginTop: 22,
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 14,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
