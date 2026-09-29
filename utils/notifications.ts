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

/**
 * Finds every notification we scheduled for a habit by its tag, rather than
 * trusting a stored id. A stored id that goes missing used to strand the
 * notification with no way to ever cancel it.
 */
async function findScheduledFor(habitId: string): Promise<string[]> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled
    .filter((request) => request.content?.data?.habitId === habitId)
    .map((request) => request.identifier);
}

/** Cancels an existing reminder (if any) and schedules a new daily reminder at HH:mm. */
export async function scheduleHabitReminder(habit: Pick<Habit, 'id' | 'name' | 'emoji'>, time: string, existingNotificationId: string | null): Promise<string | null> {
  // Clear by tag as well as by id, so a repeat schedule can never leave a
  // duplicate firing alongside the new one.
  await cancelHabitReminder(existingNotificationId, habit.id);

  const granted = await ensureNotificationPermission();
  if (!granted) return null;

  return scheduleTagged(habit, time);
}

/** Schedules without touching permissions, for callers that already checked. */
async function scheduleTagged(
  habit: Pick<Habit, 'id' | 'name' | 'emoji'>,
  time: string
): Promise<string | null> {
  const [hour, minute] = time.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Habit Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title: `${habit.emoji} ${habit.name}`,
      body: "Time to check off today's habit!",
      // The tag is what makes a reminder findable later.
      data: { habitId: habit.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

/**
 * Cancels a habit's reminder. Pass the habit id wherever possible: cancelling
 * by tag also catches reminders whose stored id was lost or never recorded.
 */
export async function cancelHabitReminder(
  notificationId: string | null,
  habitId?: string
): Promise<void> {
  if (notificationId) {
    await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});
  }
  if (!habitId) return;
  for (const id of await findScheduledFor(habitId)) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }
}

/** Drops every scheduled reminder, used when all data is wiped. */
export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}

/**
 * Reconciles what iOS has scheduled against what the habits actually want:
 * cancels reminders for habits that are gone, archived or no longer remind,
 * removes duplicates, and schedules any that are missing. Returns the habits
 * whose notification id changed so the caller can store them.
 *
 * Only touches notifications carrying our tag, since Expo Go is shared with
 * any other project the user runs.
 */
export async function syncReminders(habits: Habit[]): Promise<Map<string, string | null>> {
  const updates = new Map<string, string | null>();
  if (!(await getNotificationPermissionStatus())) return updates;

  const wanted = new Map(
    habits.filter((h) => !h.archived && h.reminderTime).map((h) => [h.id, h])
  );
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const keptFor = new Map<string, string>();

  for (const request of scheduled) {
    const habitId = request.content?.data?.habitId;
    if (typeof habitId !== 'string') continue; // not ours to touch
    // Cancel if the habit no longer wants a reminder, or if we already kept one.
    if (!wanted.has(habitId) || keptFor.has(habitId)) {
      await Notifications.cancelScheduledNotificationAsync(request.identifier).catch(() => {});
      if (!wanted.has(habitId)) updates.set(habitId, null);
      continue;
    }
    keptFor.set(habitId, request.identifier);
  }

  for (const [habitId, habit] of wanted) {
    const existing = keptFor.get(habitId);
    if (existing) {
      if (habit.notificationId !== existing) updates.set(habitId, existing);
      continue;
    }
    // Wanted but nothing scheduled — e.g. after restoring a backup.
    const id = await scheduleTagged(habit, habit.reminderTime!);
    updates.set(habitId, id);
  }

  return updates;
}

/**
 * Nuclear option for reminders that have gone astray: clears everything iOS has
 * scheduled, tagged or not, then rebuilds from the current habits. This is the
 * only way to clear reminders scheduled before tagging existed.
 */
export async function resetAllReminders(habits: Habit[]): Promise<Map<string, string | null>> {
  const updates = new Map<string, string | null>();
  await cancelAllReminders();

  const granted = await ensureNotificationPermission();
  for (const habit of habits) {
    if (habit.archived || !habit.reminderTime) {
      if (habit.notificationId) updates.set(habit.id, null);
      continue;
    }
    updates.set(habit.id, granted ? await scheduleTagged(habit, habit.reminderTime) : null);
  }

  return updates;
}
