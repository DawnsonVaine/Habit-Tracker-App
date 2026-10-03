export type Frequency =
  | { type: 'daily' }
  | { type: 'weekdays'; days: number[] } // 0 = Sunday ... 6 = Saturday
  | { type: 'timesPerWeek'; count: number };

/**
 * How a habit's daily goal is measured.
 * - binary: done or not done (target is always 1)
 * - count: accumulate toward a target in `unit` (e.g. 8 glasses)
 * - duration: accumulate toward a target in minutes (e.g. 30 min)
 */
export type GoalType = 'binary' | 'count' | 'duration';

/** A user-made grouping, shown as a section on the Today screen. */
export interface Category {
  id: string;
  name: string;
  emoji: string;
}

/** How habits are ordered within each section on Today. */
export type SortMode = 'custom' | 'name' | 'streak' | 'todo';

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  color: string;
  /** null, or an id that no longer exists, files the habit under "Other". */
  categoryId: string | null;
  frequency: Frequency;
  goalType: GoalType;
  target: number; // 1 for binary, units for count, minutes for duration
  unit: string | null; // label for count habits ("glasses"); unused otherwise
  step: number; // how much one tap adds toward the target
  reminderTime: string | null; // "HH:mm" 24hr, or null for no reminder
  notificationId: string | null; // scheduled expo-notifications id
  createdAt: string; // ISO date string (yyyy-mm-dd)
  archived: boolean;
}

export type NewHabitInput = Omit<Habit, 'id' | 'createdAt' | 'notificationId' | 'archived'>;

// Map of date ("yyyy-mm-dd") -> logged value. Binary habits store 1 when done.
export type HabitProgress = Record<string, number>;

// Map of habitId -> that habit's logged values by date.
export type CompletionsMap = Record<string, HabitProgress>;

// Map of habitId -> dates ("yyyy-mm-dd") deliberately skipped as rest days.
export type SkipsMap = Record<string, string[]>;

/**
 * A commitment to complete every scheduled day of a habit for a fixed run.
 * Only the commitment is stored; whether it is active, completed or failed is
 * worked out from the habit's history.
 */
export interface Challenge {
  id: string;
  habitId: string;
  startDate: string; // yyyy-mm-dd, the first day of the run
  lengthDays: number;
  /** The user gave up on it. */
  abandoned: boolean;
  /** The completion celebration has been shown, so it isn't shown twice. */
  celebrated: boolean;
}
