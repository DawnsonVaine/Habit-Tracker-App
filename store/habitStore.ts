import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  Category,
  Challenge,
  CompletionsMap,
  Habit,
  HabitProgress,
  NewHabitInput,
  SkipsMap,
  SortMode,
} from '../types/habit';
import { canChallengeHabit, getChallengeProgress } from '../utils/challenges';
import { todayStr } from '../utils/dates';
import { canSkipDay } from '../utils/skips';

interface HabitState {
  habits: Habit[];
  completions: CompletionsMap;
  /** Days each habit was deliberately rested, which protect streaks and cost no XP. */
  skips: SkipsMap;
  /** Every challenge ever started, kept so finished ones still pay their bonus. */
  challenges: Challenge[];
  /** In the order their sections appear on Today. */
  categories: Category[];
  sortMode: SortMode;
  /**
   * The level the user has already been shown. null means we have not recorded
   * one yet, in which case the current level is adopted silently rather than
   * celebrating progress they earned before this existed.
   */
  lastSeenLevel: number | null;
  hasHydrated: boolean;
  acknowledgeLevel: (level: number) => void;
  addHabit: (input: NewHabitInput) => Habit;
  updateHabit: (id: string, input: NewHabitInput) => void;
  deleteHabit: (id: string) => void;
  toggleCompletion: (habitId: string, dateStr?: string) => void;
  /** Adds to a count/duration habit's logged value for a day, capped at its target. */
  addProgress: (habitId: string, amount: number, dateStr?: string) => void;
  /** Clears a day's logged value entirely. */
  resetProgress: (habitId: string, dateStr?: string) => void;
  isCompletedOn: (habitId: string, dateStr: string) => boolean;
  /**
   * Marks or unmarks a rest day. Returns false if a skip was refused — the
   * habit can't be skipped, the day already has progress, or the week's
   * allowance is used up.
   */
  setSkipped: (habitId: string, dateStr: string, skipped: boolean) => boolean;
  /** Starts a challenge from today. Returns null if one is already running for the habit. */
  startChallenge: (habitId: string, lengthDays: number) => Challenge | null;
  abandonChallenge: (challengeId: string) => void;
  markChallengeCelebrated: (challengeId: string) => void;
  setNotificationId: (habitId: string, notificationId: string | null) => void;
  setArchived: (id: string, archived: boolean) => void;
  reorderHabits: (orderedIds: string[]) => void;
  addCategory: (name: string, emoji: string) => Category;
  updateCategory: (id: string, name: string, emoji: string) => void;
  /** Removes a category; its habits move to "Other" rather than being deleted. */
  deleteCategory: (id: string) => void;
  reorderCategories: (orderedIds: string[]) => void;
  setSortMode: (mode: SortMode) => void;
  replaceAllData: (data: {
    habits: Habit[];
    completions: CompletionsMap;
    skips?: SkipsMap;
    challenges?: Challenge[];
    categories?: Category[];
  }) => void;
  clearAllData: () => void;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface PersistedState {
  habits: Habit[];
  completions: CompletionsMap;
  skips?: SkipsMap;
  challenges?: Challenge[];
  categories?: Category[];
  sortMode?: SortMode;
  lastSeenLevel?: number | null;
}

/** Drops one date from a habit's skips. Logging progress on a rest day cancels the rest. */
function clearSkip(skips: SkipsMap, habitId: string, dateStr: string): SkipsMap {
  const dates = skips[habitId];
  if (!dates || !dates.includes(dateStr)) return skips;
  return { ...skips, [habitId]: dates.filter((d) => d !== dateStr) };
}

/** Any earlier saved shape: v0 predates goal types, v1 predates categories. */
interface LegacyPersistedState extends Omit<Partial<PersistedState>, 'habits' | 'completions'> {
  habits?: (Partial<Habit> & { id: string })[];
  completions?: Record<string, string[] | HabitProgress>;
}

/**
 * Fills in fields a habit was saved without. Safe to apply to a habit of any
 * age, since the habit's own values always win over these defaults.
 */
function migrateHabit(habit: Partial<Habit> & { id: string }): Habit {
  return {
    goalType: 'binary',
    target: 1,
    unit: null,
    step: 1,
    categoryId: null,
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
      skips: {},
      challenges: [],
      categories: [],
      sortMode: 'custom',
      lastSeenLevel: null,
      hasHydrated: false,

      acknowledgeLevel: (level) => {
        set({ lastSeenLevel: level });
      },

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
          const { [id]: _removedSkips, ...restSkips } = state.skips;
          return {
            habits: state.habits.filter((h) => h.id !== id),
            completions: rest,
            skips: restSkips,
            challenges: state.challenges.filter((c) => c.habitId !== id),
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
            skips: wasComplete ? state.skips : clearSkip(state.skips, habitId, dateStr),
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
            skips: clearSkip(state.skips, habitId, dateStr),
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

      setSkipped: (habitId, dateStr, skipped) => {
        const state = get();
        if (!skipped) {
          set({ skips: clearSkip(state.skips, habitId, dateStr) });
          return true;
        }
        const habit = state.habits.find((h) => h.id === habitId);
        if (!habit) return false;
        const dates = state.skips[habitId] ?? [];
        const logged = state.completions[habitId]?.[dateStr] ?? 0;
        // Enforced here as well as in the UI, so the allowance can't be bypassed.
        if (!canSkipDay(habit, dates, dateStr, logged)) return false;
        set({ skips: { ...state.skips, [habitId]: [...dates, dateStr].sort() } });
        return true;
      },

      startChallenge: (habitId, lengthDays) => {
        const state = get();
        const habit = state.habits.find((h) => h.id === habitId);
        if (!habit || !canChallengeHabit(habit)) return null;

        // One running challenge per habit. Finished ones don't block a new start.
        const progress = state.completions[habitId] ?? {};
        const skipped = new Set(state.skips[habitId] ?? []);
        const running = state.challenges.some(
          (c) =>
            c.habitId === habitId &&
            getChallengeProgress(c, habit, progress, skipped).status === 'active'
        );
        if (running) return null;

        const challenge: Challenge = {
          id: generateId(),
          habitId,
          startDate: todayStr(),
          lengthDays,
          abandoned: false,
          celebrated: false,
        };
        set({ challenges: [...state.challenges, challenge] });
        return challenge;
      },

      abandonChallenge: (challengeId) => {
        set((state) => ({
          challenges: state.challenges.map((c) => (c.id === challengeId ? { ...c, abandoned: true } : c)),
        }));
      },

      markChallengeCelebrated: (challengeId) => {
        set((state) => ({
          challenges: state.challenges.map((c) => (c.id === challengeId ? { ...c, celebrated: true } : c)),
        }));
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

      addCategory: (name, emoji) => {
        const category: Category = { id: generateId(), name: name.trim(), emoji };
        set((state) => ({ categories: [...state.categories, category] }));
        return category;
      },

      updateCategory: (id, name, emoji) => {
        set((state) => ({
          categories: state.categories.map((c) => (c.id === id ? { ...c, name: name.trim(), emoji } : c)),
        }));
      },

      deleteCategory: (id) => {
        set((state) => ({
          categories: state.categories.filter((c) => c.id !== id),
          habits: state.habits.map((h) => (h.categoryId === id ? { ...h, categoryId: null } : h)),
        }));
      },

      reorderCategories: (orderedIds) => {
        set((state) => {
          const byId = new Map(state.categories.map((c) => [c.id, c]));
          const ordered = orderedIds.map((id) => byId.get(id)).filter((c): c is Category => !!c);
          // Anything not mentioned keeps its place at the end rather than vanishing.
          const rest = state.categories.filter((c) => !orderedIds.includes(c.id));
          return { categories: [...ordered, ...rest] };
        });
      },

      setSortMode: (mode) => {
        set({ sortMode: mode });
      },

      // Both of these change lifetime XP wholesale, so forget the last seen
      // level and adopt whatever the new data implies without celebrating it.
      replaceAllData: ({ habits, completions, skips = {}, challenges = [], categories = [] }) => {
        // Restored challenges were finished on another install; don't replay
        // celebrations for them here.
        const settled = challenges.map((c) => ({ ...c, celebrated: true }));
        set({ habits, completions, skips, challenges: settled, categories, lastSeenLevel: null });
      },

      clearAllData: () => {
        set({
          habits: [],
          completions: {},
          skips: {},
          challenges: [],
          categories: [],
          lastSeenLevel: null,
        });
      },
    }),
    {
      name: 'habit-tracker-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        habits: state.habits,
        completions: state.completions,
        skips: state.skips,
        challenges: state.challenges,
        categories: state.categories,
        sortMode: state.sortMode,
        lastSeenLevel: state.lastSeenLevel,
      }),
      version: 2,
      // v0 stored completions as habitId -> ["yyyy-mm-dd", ...] and had no goal
      // fields: every habit becomes binary, and each completed date becomes a
      // value of 1, which is its target. v1 had no categories: every habit goes
      // under "Other". Both steps are idempotent, so one pass covers any age,
      // and everything else saved (skips, challenges...) is carried across.
      migrate: (persisted, version) => {
        if (version >= 2) return persisted as PersistedState;
        const old = (persisted ?? {}) as LegacyPersistedState;
        return {
          ...old,
          habits: (old.habits ?? []).map(migrateHabit),
          completions: migrateCompletions(old.completions ?? {}),
        } as PersistedState;
      },
    }
  )
);

// Track hydration status separately so screens can wait for persisted data to load.
// hasHydrated already starts false, so nothing is set before loading finishes:
// persist writes the store to disk on every setState, and a write that early
// would save the empty initial state over the user's data.
const unsub = useHabitStore.persist.onFinishHydration(() => {
  useHabitStore.setState({ hasHydrated: true });
  unsub();
});
if (useHabitStore.persist.hasHydrated()) {
  useHabitStore.setState({ hasHydrated: true });
}
