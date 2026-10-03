import { Habit } from '../types/habit';
import { addDays, startOfWeek } from './dates';

/** Rest days allowed per habit per week. */
export const SKIPS_PER_WEEK = 1;

/** Stable empty reference so selectors don't return a new array every render. */
export const EMPTY_SKIPS: string[] = [];
export const EMPTY_SKIP_SET: ReadonlySet<string> = new Set<string>();

/**
 * Times-per-week habits can't be skipped: they aren't due on any particular
 * day, so they already have the flexibility a skip would give.
 */
export function canSkipHabit(habit: Habit): boolean {
  return habit.frequency.type !== 'timesPerWeek';
}

/** Skips already used in the week (Sunday to Saturday) containing the date. */
export function skipsUsedInWeek(skipDates: readonly string[], dateStr: string): number {
  const weekStart = startOfWeek(dateStr);
  const weekEnd = addDays(weekStart, 6);
  return skipDates.filter((d) => d >= weekStart && d <= weekEnd).length;
}

/** Skips still available in the week containing the date. */
export function skipsLeftInWeek(skipDates: readonly string[], dateStr: string): number {
  return Math.max(0, SKIPS_PER_WEEK - skipsUsedInWeek(skipDates, dateStr));
}

/**
 * Whether a day can be newly skipped. A day with any progress logged can't be:
 * partial effort is never penalised, so there is nothing to protect.
 */
export function canSkipDay(
  habit: Habit,
  skipDates: readonly string[],
  dateStr: string,
  loggedValue: number
): boolean {
  if (!canSkipHabit(habit)) return false;
  if (loggedValue > 0) return false;
  if (skipDates.includes(dateStr)) return false;
  return skipsLeftInWeek(skipDates, dateStr) > 0;
}
