import { vi } from 'vitest';
import { Challenge, Habit } from '../types/habit';
import { addDays, todayStr } from '../utils/dates';

/** Saturday 3 October 2026, midday local time. */
export const FIXED_NOW = new Date(2026, 9, 3, 12, 0, 0);

/**
 * Freezes "now" so results don't depend on the day the tests run. Only Date is
 * faked, so promises and timers used by the store still behave normally.
 */
export function freezeTime(date: Date = FIXED_NOW): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(date);
}

/** A date string `n` days before the frozen today. */
export function ago(n: number): string {
  return addDays(todayStr(), -n);
}

/** Inclusive run of day offsets, e.g. range(3, 1) -> [3, 2, 1]. */
export function range(from: number, to: number): number[] {
  return Array.from({ length: from - to + 1 }, (_, i) => from - i);
}

/** A progress map with the given day offsets each logged as `value`. */
export function logged(offsets: number[], value = 1): Record<string, number> {
  return Object.fromEntries(offsets.map((n) => [ago(n), value]));
}

export function makeHabit(over: Partial<Habit> = {}): Habit {
  return {
    id: 'h',
    name: 'Gym',
    emoji: '💪',
    color: '#4F46E5',
    categoryId: null,
    frequency: { type: 'daily' },
    goalType: 'binary',
    target: 1,
    unit: null,
    step: 1,
    reminderTime: null,
    notificationId: null,
    createdAt: ago(10),
    archived: false,
    ...over,
  };
}

export function makeChallenge(over: Partial<Challenge> = {}): Challenge {
  return {
    id: 'c',
    habitId: 'h',
    startDate: ago(9),
    lengthDays: 14,
    abandoned: false,
    celebrated: false,
    ...over,
  };
}
