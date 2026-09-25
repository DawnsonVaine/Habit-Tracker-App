import { Habit, HabitProgress } from '../types/habit';

/** Stable empty reference so selectors don't return a new object every render. */
export const EMPTY_PROGRESS: HabitProgress = {};

/** A day counts as done once the logged value reaches the habit's target. */
export function isDayComplete(habit: Habit, value: number | undefined): boolean {
  return (value ?? 0) >= habit.target;
}

/** The dates a habit was completed on, which is what streak maths works from. */
export function completedDates(habit: Habit, progress: HabitProgress): string[] {
  return Object.keys(progress).filter((dateStr) => isDayComplete(habit, progress[dateStr]));
}

export function completedDateSet(habit: Habit, progress: HabitProgress): Set<string> {
  return new Set(completedDates(habit, progress));
}

/** "1h 30m" / "45m" for duration habits. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** The target on its own, e.g. "8 glasses" or "30m". */
export function formatTarget(habit: Habit): string {
  if (habit.goalType === 'duration') return formatDuration(habit.target);
  if (habit.goalType === 'count') return habit.unit ? `${habit.target} ${habit.unit}` : `${habit.target}`;
  return '';
}

/** Progress against the target, e.g. "3/8 glasses" or "20m / 30m". */
export function formatProgress(habit: Habit, value: number): string {
  if (habit.goalType === 'duration') {
    return `${formatDuration(value)} / ${formatDuration(habit.target)}`;
  }
  const base = `${value}/${habit.target}`;
  return habit.unit ? `${base} ${habit.unit}` : base;
}
