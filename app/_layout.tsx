import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTheme } from '../hooks/useTheme';
import { useHabitStore } from '../store/habitStore';
import { syncReminders } from '../utils/notifications';

export default function RootLayout() {
  const { isDark, colors } = useTheme();
  const hasHydrated = useHabitStore((s) => s.hasHydrated);
  const setNotificationId = useHabitStore((s) => s.setNotificationId);
  const syncedRef = useRef(false);

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
    </GestureHandlerRootView>
  );
}
