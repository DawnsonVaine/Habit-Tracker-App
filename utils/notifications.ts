import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Habit } from '../types/habit';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/** Checks current permission status without prompting the user. */
export async function getNotificationPermissionStatus(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

/** Cancels an existing reminder (if any) and schedules a new daily reminder at HH:mm. */
export async function scheduleHabitReminder(habit: Pick<Habit, 'id' | 'name' | 'emoji'>, time: string, existingNotificationId: string | null): Promise<string | null> {
  if (existingNotificationId) {
    await Notifications.cancelScheduledNotificationAsync(existingNotificationId).catch(() => {});
  }

  const granted = await ensureNotificationPermission();
  if (!granted) return null;

  const [hour, minute] = time.split(':').map(Number);

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Habit Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: `${habit.emoji} ${habit.name}`,
      body: "Time to check off today's habit!",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });

  return id;
}

export async function cancelHabitReminder(notificationId: string | null): Promise<void> {
  if (!notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});
}
