export type Frequency =
  | { type: 'daily' }
  | { type: 'weekdays'; days: number[] } // 0 = Sunday ... 6 = Saturday
  | { type: 'timesPerWeek'; count: number };

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  color: string;
  frequency: Frequency;
  reminderTime: string | null; // "HH:mm" 24hr, or null for no reminder
  notificationId: string | null; // scheduled expo-notifications id
  createdAt: string; // ISO date string (yyyy-mm-dd)
  archived: boolean;
}

export type NewHabitInput = Omit<Habit, 'id' | 'createdAt' | 'notificationId' | 'archived'>;

// Map of habitId -> list of completed dates ("yyyy-mm-dd")
export type CompletionsMap = Record<string, string[]>;
