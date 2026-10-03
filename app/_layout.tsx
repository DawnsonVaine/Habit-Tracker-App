import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { CelebrationOverlay } from '../components/CelebrationOverlay';
import { useTheme } from '../hooks/useTheme';
import { useHabitStore } from '../store/habitStore';
import { challengeLengthLabel, getChallengeProgress } from '../utils/challenges';
import { syncReminders } from '../utils/notifications';
import { getProgression, getTotalXp, rankForLevel } from '../utils/progression';

export default function RootLayout() {
  const { isDark, colors } = useTheme();
  const hasHydrated = useHabitStore((s) => s.hasHydrated);
  const setNotificationId = useHabitStore((s) => s.setNotificationId);
  const habits = useHabitStore((s) => s.habits);
  const completions = useHabitStore((s) => s.completions);
  const skips = useHabitStore((s) => s.skips);
  const challenges = useHabitStore((s) => s.challenges);
  const lastSeenLevel = useHabitStore((s) => s.lastSeenLevel);
  const acknowledgeLevel = useHabitStore((s) => s.acknowledgeLevel);
  const markChallengeCelebrated = useHabitStore((s) => s.markChallengeCelebrated);
  const syncedRef = useRef(false);

  const level = useMemo(
    () => getProgression(getTotalXp(habits, completions, skips, challenges)).level,
    [habits, completions, skips, challenges]
  );

  // Adopt the level silently the first time, and whenever it drops (deleting a
  // habit removes its XP). Only an increase is worth celebrating.
  useEffect(() => {
    if (!hasHydrated) return;
    if (lastSeenLevel === null || level < lastSeenLevel) acknowledgeLevel(level);
  }, [acknowledgeLevel, hasHydrated, lastSeenLevel, level]);

  // A finished challenge that hasn't had its moment yet.
  const challengeWin = useMemo(() => {
    for (const challenge of challenges) {
      if (challenge.celebrated || challenge.abandoned) continue;
      const habit = habits.find((h) => h.id === challenge.habitId);
      if (!habit) continue;
      const result = getChallengeProgress(
        challenge,
        habit,
        completions[habit.id] ?? {},
        new Set(skips[habit.id] ?? [])
      );
      if (result.status === 'completed') return { challenge, habit, result };
    }
    return null;
  }, [challenges, completions, habits, skips]);

  const levelledUp = hasHydrated && lastSeenLevel !== null && level > lastSeenLevel;

  // One overlay at a time. A challenge's bonus usually tips a level-up too, so
  // the challenge goes first and the level-up follows once it's dismissed.
  let celebration: {
    key: string;
    emoji: string;
    heading: string;
    headline: string;
    subtitle: string;
    onDismiss: () => void;
  } | null = null;

  if (hasHydrated && challengeWin) {
    const { challenge, habit, result } = challengeWin;
    celebration = {
      key: `challenge-${challenge.id}`,
      emoji: '🏆',
      heading: 'Challenge complete!',
      headline: challengeLengthLabel(challenge.lengthDays),
      subtitle: `${habit.emoji} ${habit.name}: all ${result.sessionsTotal} sessions kept. +${result.bonusXp} XP`,
      onDismiss: () => markChallengeCelebrated(challenge.id),
    };
  } else if (levelledUp && lastSeenLevel !== null) {
    const rank = rankForLevel(level);
    const isNewTier = rank.tier.name !== rankForLevel(lastSeenLevel).tier.name;
    celebration = {
      key: `level-${level}`,
      emoji: rank.tier.emoji,
      heading: isNewTier ? 'New tier!' : 'Level up!',
      headline: rank.label,
      subtitle: isNewTier
        ? `You've broken into ${rank.tier.name}. Keep it going.`
        : `Level ${level} · keep the streak alive.`,
      onDismiss: () => acknowledgeLevel(level),
    };
  }

  // Once per launch, reconcile what iOS actually has scheduled against what the
  // habits want. Catches reminders orphaned by a crash, a restore, or any path
  // that lost track of a notification id.
  useEffect(() => {
    if (!hasHydrated || syncedRef.current) return;
    syncedRef.current = true;
    syncReminders(useHabitStore.getState().habits)
      .then((updates) => {
        updates.forEach((notificationId, habitId) => setNotificationId(habitId, notificationId));
      })
      .catch(() => {});
  }, [hasHydrated, setNotificationId]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="habit/[id]" options={{ title: 'Habit Details' }} />
        <Stack.Screen
          name="habit/new"
          options={{ title: 'New Habit', presentation: 'modal' }}
        />
        <Stack.Screen name="archive" options={{ title: 'Archived Habits' }} />
        <Stack.Screen name="reorder" options={{ title: 'Reorder Habits' }} />
        <Stack.Screen name="categories" options={{ title: 'Categories' }} />
        <Stack.Screen name="category-edit" options={{ title: 'Category', presentation: 'modal' }} />
      </Stack>

      {/* Lives at the root so it appears wherever the completion happened. Keyed
          so a follow-on celebration replays its entrance rather than swapping text. */}
      {celebration && (
        <CelebrationOverlay
          key={celebration.key}
          visible
          emoji={celebration.emoji}
          heading={celebration.heading}
          headline={celebration.headline}
          subtitle={celebration.subtitle}
          accentColor={colors.accent}
          onDismiss={celebration.onDismiss}
        />
      )}
    </GestureHandlerRootView>
  );
}
