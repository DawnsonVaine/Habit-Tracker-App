import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { CompletionsMap, Habit, HabitProgress, NewHabitInput } from '../types/habit';
import { todayStr } from '../utils/dates';

interface HabitState {
  habits: Habit[];
  completions: CompletionsMap;
  hasHydrated: boolean;
  addHabit: (input: NewHabitInput) => Habit;
  updateHabit: (id: string, input: NewHabitInput) => void;
  deleteHabit: (id: string) => void;
  toggleCompletion: (habitId: string, dateStr?: string) => void;
  /** Adds to a count/duration habit's logged value for a day, capped at its target. */
  addProgress: (habitId: string, amount: number, dateStr?: string) => void;
  /** Clears a day's logged value entirely. */
  resetProgress: (habitId: string, dateStr?: string) => void;
  isCompletedOn: (habitId: string, dateStr: string) => boolean;
  setNotificationId: (habitId: string, notificationId: string | null) => void;
  setArchived: (id: string, archived: boolean) => void;
  reorderHabits: (orderedIds: string[]) => void;
  replaceAllData: (habits: Habit[], completions: CompletionsMap) => void;
  clearAllData: () => void;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface PersistedState {
  habits: Habit[];
  completions: CompletionsMap;
}

/** Shape written by app versions before goal types existed. */
interface LegacyPersistedState {
  habits?: (Partial<Habit> & { id: string })[];
  completions?: Record<string, string[] | HabitProgress>;
}

/** Fills in goal fields on a habit saved before they existed. */
function migrateHabit(habit: Partial<Habit> & { id: string }): Habit {
  return {
    goalType: 'binary',
    target: 1,
    unit: null,
    step: 1,
    ...habit,
  } as Habit;
}

/** Converts date arrays into date -> value maps, leaving already-migrated data alone. */
function migrateCompletions(completions: Record<string, string[] | HabitProgress>): CompletionsMap {
  const migrated: CompletionsMap = {};
  for (const [habitId, entry] of Object.entries(completions)) {
    migrated[habitId] = Array.isArray(entry)
      ? Object.fromEntries(entry.map((dateStr) => [dateStr, 1]))
      : entry;
  }
  return migrated;
}

export const useHabitStore = create<HabitState>()(
  persist(
    (set, get) => ({
      habits: [],
      completions: {},
      hasHydrated: false,

      addHabit: (input) => {
        const habit: Habit = {
          ...input,
          id: generateId(),
          createdAt: todayStr(),
          notificationId: null,
          archived: false,
        };
        set((state) => ({ habits: [...state.habits, habit] }));
        return habit;
      },

      updateHabit: (id, input) => {
        set((state) => ({
          habits: state.habits.map((h) => (h.id === id ? { ...h, ...input } : h)),
        }));
      },

      deleteHabit: (id) => {
        set((state) => {
          const { [id]: _removed, ...rest } = state.completions;
          return {
            habits: state.habits.filter((h) => h.id !== id),
            completions: rest,
          };
        });
      },

      toggleCompletion: (habitId, dateStr = todayStr()) => {
        set((state) => {
          const habit = state.habits.find((h) => h.id === habitId);
          if (!habit) return state;
          const progress = state.completions[habitId] ?? {};
          const wasComplete = (progress[dateStr] ?? 0) >= habit.target;
          const { [dateStr]: _cleared, ...withoutDay } = progress;
          return {
            completions: {
              ...state.completions,
              // Completing jumps straight to the target so one tap still finishes
              // a count habit from the calendar; clearing drops the day entirely.
              [habitId]: wasComplete ? withoutDay : { ...progress, [dateStr]: habit.target },
            },
          };
        });
      },

      addProgress: (habitId, amount, dateStr = todayStr()) => {
        set((state) => {
          const habit = state.habits.find((h) => h.id === habitId);
          if (!habit) return state;
          const progress = state.completions[habitId] ?? {};
          const next = Math.min(habit.target, Math.max(0, (progress[dateStr] ?? 0) + amount));
          if (next === 0) {
            const { [dateStr]: _cleared, ...withoutDay } = progress;
            return { completions: { ...state.completions, [habitId]: withoutDay } };
          }
          return {
            completions: { ...state.completions, [habitId]: { ...progress, [dateStr]: next } },
          };
        });
      },

      resetProgress: (habitId, dateStr = todayStr()) => {
        set((state) => {
          const progress = state.completions[habitId] ?? {};
          const { [dateStr]: _cleared, ...withoutDay } = progress;
          return { completions: { ...state.completions, [habitId]: withoutDay } };
        });
      },

      isCompletedOn: (habitId, dateStr) => {
        const state = get();
        const habit = state.habits.find((h) => h.id === habitId);
        if (!habit) return false;
        return (state.completions[habitId]?.[dateStr] ?? 0) >= habit.target;
      },

      setNotificationId: (habitId, notificationId) => {
        set((state) => ({
          habits: state.habits.map((h) => (h.id === habitId ? { ...h, notificationId } : h)),
        }));
      },

      setArchived: (id, archived) => {
        set((state) => ({
          habits: state.habits.map((h) => (h.id === id ? { ...h, archived } : h)),
        }));
      },

      reorderHabits: (orderedIds) => {
        set((state) => {
          // Only permute the slots occupied by the given subset of habits,
          // preserving the position of any habits not included in orderedIds.
          const idToHabit = new Map(state.habits.map((h) => [h.id, h]));
          const idSet = new Set(orderedIds);
          const slots: number[] = [];
          state.habits.forEach((h, i) => {
            if (idSet.has(h.id)) slots.push(i);
          });
          const newHabits = [...state.habits];
          slots.forEach((slotIndex, i) => {
            const habit = idToHabit.get(orderedIds[i]);
            if (habit) newHabits[slotIndex] = habit;
          });
          return { habits: newHabits };
        });
      },

      replaceAllData: (habits, completions) => {
        set({ habits, completions });
      },

      clearAllData: () => {
        set({ habits: [], completions: {} });
      },
    }),
    {
      name: 'habit-tracker-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ habits: state.habits, completions: state.completions }),
      version: 1,
      // v0 stored completions as habitId -> ["yyyy-mm-dd", ...] and had no goal
      // fields. Every existing habit becomes a binary one, and each completed
      // date becomes a logged value of 1, which is that habit's target.
      migrate: (persisted, version) => {
        if (version >= 1) return persisted as PersistedState;
        const old = (persisted ?? {}) as LegacyPersistedState;
        return {
          habits: (old.habits ?? []).map(migrateHabit),
          completions: migrateCompletions(old.completions ?? {}),
        };
      },
    }
  )
);

// Track hydration status separately so screens can wait for persisted data to load.
useHabitStore.setState({ hasHydrated: false });
const unsub = useHabitStore.persist.onFinishHydration(() => {
  useHabitStore.setState({ hasHydrated: true });
  unsub();
});
if (useHabitStore.persist.hasHydrated()) {
  useHabitStore.setState({ hasHydrated: true });
}
