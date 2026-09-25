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

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  color: string;
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
