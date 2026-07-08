/** Formats a Date as a local "yyyy-mm-dd" string (no timezone conversion). */
export function toDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayStr(): string {
  return toDateStr(new Date());
}

/** Parses a "yyyy-mm-dd" string into a local Date at midnight. */
export function parseDateStr(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(dateStr: string, amount: number): string {
  const date = parseDateStr(dateStr);
  date.setDate(date.getDate() + amount);
  return toDateStr(date);
}

export function getWeekdayIndex(dateStr: string): number {
  return parseDateStr(dateStr).getDay();
}

/** Returns start-of-week (Sunday) date string for a given date string. */
export function startOfWeek(dateStr: string): string {
  const weekday = getWeekdayIndex(dateStr);
  return addDays(dateStr, -weekday);
}

export const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Builds a 6x7 calendar matrix for the given year/month.
 * Cells outside the month are `null`.
 */
export function getMonthMatrix(year: number, month: number): (string | null)[][] {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = firstDay.getDay();

  const cells: (string | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(toDateStr(new Date(year, month, day)));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const matrix: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    matrix.push(cells.slice(i, i + 7));
  }
  return matrix;
}
