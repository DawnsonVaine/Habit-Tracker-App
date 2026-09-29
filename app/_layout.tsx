import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LevelUpOverlay } from '../components/LevelUpOverlay';
import { useTheme } from '../hooks/useTheme';
import { useHabitStore } from '../store/habitStore';
import { syncReminders } from '../utils/notifications';
import { getProgression, getTotalXp, rankForLevel } from '../utils/progression';

export default function RootLayout() {
  const { isDark, colors } = useTheme();
  const hasHydrated = useHabitStore((s) => s.hasHydrated);
  const setNotificationId = useHabitStore((s) => s.setNotificationId);
  const habits = useHabitStore((s) => s.habits);
  const completions = useHabitStore((s) => s.completions);
  const lastSeenLevel = useHabitStore((s) => s.lastSeenLevel);
  const acknowledgeLevel = useHabitStore((s) => s.acknowledgeLevel);
  const syncedRef = useRef(false);

  const level = useMemo(
    () => getProgression(getTotalXp(habits, completions)).level,
    [habits, completions]
  );

  // Adopt the level silently the first time, and whenever it drops (deleting a
  // habit removes its XP). Only an increase is worth celebrating.
  useEffect(() => {
    if (!hasHydrated) return;
    if (lastSeenLevel === null || level < lastSeenLevel) acknowledgeLevel(level);
  }, [acknowledgeLevel, hasHydrated, lastSeenLevel, level]);

  const celebrating = hasHydrated && lastSeenLevel !== null && level > lastSeenLevel;

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
      </Stack>

      {/* Lives at the root so it appears wherever the completion happened. */}
      <LevelUpOverlay
        visible={celebrating}
        level={level}
        rank={rankForLevel(level)}
        isNewTier={
          lastSeenLevel !== null &&
          rankForLevel(level).tier.name !== rankForLevel(lastSeenLevel).tier.name
        }
        accentColor={colors.accent}
        onDismiss={() => acknowledgeLevel(level)}
      />
    </GestureHandlerRootView>
  );
}
