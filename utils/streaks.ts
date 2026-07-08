import { Habit } from '../types/habit';
import { addDays, getWeekdayIndex, parseDateStr, startOfWeek, todayStr } from './dates';

/** Whether a habit is scheduled to be done on a given date (only meaningful for daily/weekdays types). */
export function isDueOnDate(habit: Habit, dateStr: string): boolean {
  if (habit.frequency.type === 'daily') return true;
  if (habit.frequency.type === 'weekdays') {
    return habit.frequency.days.includes(getWeekdayIndex(dateStr));
  }
  // timesPerWeek habits aren't tied to a specific day
  return true;
}

function dailyStreak(habit: Habit, completedSet: Set<string>): { current: number; longest: number } {
  const today = todayStr();
  const createdAt = habit.createdAt;

  // Current streak: walk backwards from today (or yesterday if today isn't done yet,
  // since an unfinished "today" shouldn't break an ongoing streak).
  let current = 0;
  let cursor = completedSet.has(today) ? today : addDays(today, -1);
  while (parseDateStr(cursor) >= parseDateStr(createdAt)) {
    if (!isDueOnDate(habit, cursor)) {
      cursor = addDays(cursor, -1);
      continue;
    }
    if (completedSet.has(cursor)) {
      current++;
      cursor = addDays(cursor, -1);
    } else {
      break;
    }
  }

  // Longest streak: walk forward from creation date through today.
  let longest = 0;
  let running = 0;
  let day = createdAt;
  while (parseDateStr(day) <= parseDateStr(today)) {
    if (isDueOnDate(habit, day)) {
      if (completedSet.has(day)) {
        running++;
        longest = Math.max(longest, running);
      } else {
        running = 0;
      }
    }
    day = addDays(day, 1);
  }

  return { current, longest: Math.max(longest, current) };
}

function timesPerWeekStreak(habit: Habit, completedSet: Set<string>): { current: number; longest: number } {
  if (habit.frequency.type !== 'timesPerWeek') return { current: 0, longest: 0 };
  const target = habit.frequency.count;
  const today = todayStr();
  const createdWeekStart = startOfWeek(habit.createdAt);
  const currentWeekStart = startOfWeek(today);

  const countInWeek = (weekStart: string) => {
    let count = 0;
    for (let i = 0; i < 7; i++) {
      if (completedSet.has(addDays(weekStart, i))) count++;
    }
    return count;
  };

  // Build list of week-start dates from creation through current week.
  const weeks: string[] = [];
  let w = createdWeekStart;
  while (parseDateStr(w) <= parseDateStr(currentWeekStart)) {
    weeks.push(w);
    w = addDays(w, 7);
  }

  let longest = 0;
  let running = 0;
  for (const weekStart of weeks) {
    const isCurrentWeek = weekStart === currentWeekStart;
    const met = countInWeek(weekStart) >= target;
    if (met) {
      running++;
      longest = Math.max(longest, running);
    } else if (!isCurrentWeek) {
      running = 0;
    }
    // If it's the current (in-progress) week and not yet met, don't break the streak yet.
  }

  return { current: running, longest: Math.max(longest, running) };
}

export function getStreaks(habit: Habit, completedDates: string[]): { current: number; longest: number } {
  const completedSet = new Set(completedDates);
  if (habit.frequency.type === 'timesPerWeek') {
    return timesPerWeekStreak(habit, completedSet);
  }
  return dailyStreak(habit, completedSet);
}

/** Completion percentage over the last `windowDays` days (or since creation if shorter). */
export function getCompletionRate(habit: Habit, completedDates: string[], windowDays = 30): number {
  const completedSet = new Set(completedDates);
  const today = todayStr();
  const windowStart = addDays(today, -(windowDays - 1));
  const rangeStart = parseDateStr(habit.createdAt) > parseDateStr(windowStart) ? habit.createdAt : windowStart;

  let due = 0;
  let done = 0;
  let day = rangeStart;
  while (parseDateStr(day) <= parseDateStr(today)) {
    if (isDueOnDate(habit, day)) {
      due++;
      if (completedSet.has(day)) done++;
    }
    day = addDays(day, 1);
  }
  if (habit.frequency.type === 'timesPerWeek') {
    // Recalculate using weekly targets instead of per-day due count.
    return getWeeklyCompletionRate(habit, completedDates, windowDays);
  }
  return due === 0 ? 0 : Math.round((done / due) * 100);
}

function getWeeklyCompletionRate(habit: Habit, completedDates: string[], windowDays: number): number {
  if (habit.frequency.type !== 'timesPerWeek') return 0;
  const completedSet = new Set(completedDates);
  const target = habit.frequency.count;
  const today = todayStr();
  const windowStart = addDays(today, -(windowDays - 1));
  const rangeStart = parseDateStr(habit.createdAt) > parseDateStr(windowStart) ? habit.createdAt : windowStart;

  let totalDone = 0;
  let totalTarget = 0;
  let weekStart = startOfWeek(rangeStart);
  const currentWeekStart = startOfWeek(today);
  while (parseDateStr(weekStart) <= parseDateStr(currentWeekStart)) {
    let count = 0;
    for (let i = 0; i < 7; i++) {
      if (completedSet.has(addDays(weekStart, i))) count++;
    }
    totalDone += Math.min(count, target);
    totalTarget += target;
    weekStart = addDays(weekStart, 7);
  }
  return totalTarget === 0 ? 0 : Math.round((totalDone / totalTarget) * 100);
}
