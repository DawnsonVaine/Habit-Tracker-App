import { WEEKDAY_SHORT } from '../constants/habitOptions';
import { Habit } from '../types/habit';
import { addDays, getWeekdayIndex } from './dates';
import { isDueOnDate } from './streaks';

/** "Daily", "Mon, Wed, Fri" or "3× a week". */
export function scheduleLabel(habit: Habit): string {
  const { frequency } = habit;
  if (frequency.type === 'daily') return 'Daily';
  if (frequency.type === 'timesPerWeek') return `${frequency.count}× a week`;
  return frequency.days.map((d) => WEEKDAY_SHORT[d]).join(', ');
}

/**
 * The first day after `from` the habit is due, looking a week ahead. Null
 * only if it's never due, which the habit form prevents by requiring a day.
 */
export function nextDueDate(habit: Habit, from: string): string | null {
  for (let i = 1; i <= 7; i++) {
    const day = addDays(from, i);
    if (isDueOnDate(habit, day)) return day;
  }
  return null;
}

/** "Tomorrow" or a short weekday such as "Mon". */
export function describeNextDue(next: string, from: string): string {
  return next === addDays(from, 1) ? 'Tomorrow' : WEEKDAY_SHORT[getWeekdayIndex(next)];
}
