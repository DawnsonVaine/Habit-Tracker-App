import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { CompletionsMap, Habit, NewHabitInput } from '../types/habit';
import { todayStr } from '../utils/dates';

interface HabitState {
  habits: Habit[];
  completions: CompletionsMap;
  hasHydrated: boolean;
  addHabit: (input: NewHabitInput) => Habit;
  updateHabit: (id: string, input: NewHabitInput) => void;
  deleteHabit: (id: string) => void;
  toggleCompletion: (habitId: string, dateStr?: string) => void;
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
          const existing = state.completions[habitId] ?? [];
          const isDone = existing.includes(dateStr);
          const updated = isDone
            ? existing.filter((d) => d !== dateStr)
            : [...existing, dateStr];
          return {
            completions: { ...state.completions, [habitId]: updated },
          };
        });
      },

      isCompletedOn: (habitId, dateStr) => {
        return (get().completions[habitId] ?? []).includes(dateStr);
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
