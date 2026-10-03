import { Category, Habit, SortMode } from '../types/habit';

export interface HabitSection {
  key: string;
  /** null when no categories exist, so the list renders without any headers. */
  title: string | null;
  emoji: string | null;
  habits: Habit[];
}

/** Section key for habits with no category, or one that has since been deleted. */
export const OTHER_SECTION_KEY = '__other__';

/**
 * Splits habits into sections in the user's category order, with "Other"
 * last. Empty sections are dropped. With no categories at all there is one
 * untitled section, so the screen looks exactly as it did before categories.
 */
export function groupByCategory(habits: Habit[], categories: Category[]): HabitSection[] {
  if (categories.length === 0) {
    return habits.length === 0 ? [] : [{ key: OTHER_SECTION_KEY, title: null, emoji: null, habits }];
  }

  const known = new Set(categories.map((c) => c.id));
  const sections: HabitSection[] = categories.map((c) => ({
    key: c.id,
    title: c.name,
    emoji: c.emoji,
    habits: habits.filter((h) => h.categoryId === c.id),
  }));
  sections.push({
    key: OTHER_SECTION_KEY,
    title: 'Other',
    emoji: null,
    habits: habits.filter((h) => !h.categoryId || !known.has(h.categoryId)),
  });
  return sections.filter((s) => s.habits.length > 0);
}

export const SORT_MODE_LABELS: Record<SortMode, string> = {
  custom: 'Custom',
  name: 'Name',
  streak: 'Streak',
  todo: 'To-do first',
};

interface SortContext {
  streakOf: (habit: Habit) => number;
  isDoneToday: (habit: Habit) => boolean;
}

/**
 * Orders habits within a section. Ties always fall back to the user's custom
 * order, so the result is stable and never shuffles between renders.
 */
export function sortHabits(habits: Habit[], mode: SortMode, context: SortContext): Habit[] {
  if (mode === 'custom') return habits;
  const position = new Map(habits.map((h, i) => [h.id, i]));
  const byCustomOrder = (a: Habit, b: Habit) => position.get(a.id)! - position.get(b.id)!;

  const compare: Record<Exclude<SortMode, 'custom'>, (a: Habit, b: Habit) => number> = {
    name: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    streak: (a, b) => context.streakOf(b) - context.streakOf(a),
    todo: (a, b) => Number(context.isDoneToday(a)) - Number(context.isDoneToday(b)),
  };

  return [...habits].sort((a, b) => compare[mode](a, b) || byCustomOrder(a, b));
}

/** Rejects blank names and case-insensitive duplicates. Returns an error message or null. */
export function validateCategoryName(
  name: string,
  categories: Category[],
  editingId?: string
): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Please give the category a name.';
  const clash = categories.find(
    (c) => c.id !== editingId && c.name.trim().toLowerCase() === trimmed.toLowerCase()
  );
  return clash ? `You already have a category called "${clash.name}".` : null;
}
