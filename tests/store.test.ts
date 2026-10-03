import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ago, freezeTime } from './helpers';

/**
 * Stands in for the phone's AsyncStorage. Every write is recorded so tests
 * can check what the store saved, and when.
 */
const disk = vi.hoisted(() => ({ data: new Map<string, string>(), writes: [] as string[] }));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => disk.data.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      disk.writes.push(value);
      disk.data.set(key, value);
    },
    removeItem: async (key: string) => {
      disk.data.delete(key);
    },
  },
}));

const STORAGE_KEY = 'habit-tracker-storage';

function seed(state: object, version: number) {
  disk.data.set(STORAGE_KEY, JSON.stringify({ state, version }));
}

/** Loads a fresh copy of the store, as an app launch does, and waits for it to read storage. */
async function launch() {
  vi.resetModules();
  const { useHabitStore } = await import('../store/habitStore');
  if (!useHabitStore.persist.hasHydrated()) {
    await new Promise<void>((resolve) => {
      const unsub = useHabitStore.persist.onFinishHydration(() => {
        unsub();
        resolve();
      });
    });
  }
  return useHabitStore;
}

/** Lets pending async storage writes land. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  freezeTime();
  disk.data.clear();
  disk.writes.length = 0;
});

// Exactly the shape the previous release saved: no categories, but rest
// days, challenges and a last-seen level.
const savedByV1 = {
  habits: [
    {
      id: 'h1', name: 'Gym', emoji: '💪', color: '#4F46E5',
      frequency: { type: 'weekdays', days: [1, 3, 5] },
      goalType: 'binary', target: 1, unit: null, step: 1,
      reminderTime: '07:00', notificationId: 'n1', createdAt: '2026-08-01', archived: false,
    },
    {
      id: 'h2', name: 'Water', emoji: '💧', color: '#0EA5E9',
      frequency: { type: 'daily' },
      goalType: 'count', target: 8, unit: 'glasses', step: 1,
      reminderTime: null, notificationId: null, createdAt: '2026-08-01', archived: true,
    },
  ],
  completions: { h1: { '2026-09-01': 1 }, h2: { '2026-09-01': 5 } },
  skips: { h1: ['2026-09-03'] },
  challenges: [
    { id: 'c1', habitId: 'h1', startDate: '2026-09-01', lengthDays: 14, abandoned: false, celebrated: true },
  ],
  lastSeenLevel: 4,
};

describe('launching', () => {
  it('never writes empty state over saved data while it is still loading', async () => {
    // Regression: startup used to call setState before hydration, and persist
    // writes on every setState, so it saved the empty initial state over the
    // user's habits. It only survived because iOS reads before it writes.
    seed(savedByV1, 1);
    await launch();
    await settle();
    const habitCounts = disk.writes.map((w) => JSON.parse(w).state.habits.length);
    expect(habitCounts).not.toContain(0);
  });
});

describe('upgrading saved data from v1 (before categories)', () => {
  it('keeps every habit and gives each one no category', async () => {
    seed(savedByV1, 1);
    const store = await launch();
    const { habits } = store.getState();
    expect(habits).toHaveLength(2);
    expect(habits.map((h) => h.categoryId)).toEqual([null, null]);
  });

  it('leaves existing habit fields untouched', async () => {
    seed(savedByV1, 1);
    const [gym, water] = (await launch()).getState().habits;
    expect([gym.name, gym.reminderTime]).toEqual(['Gym', '07:00']);
    expect(gym.frequency).toEqual({ type: 'weekdays', days: [1, 3, 5] });
    expect([water.goalType, water.target, water.unit, water.archived]).toEqual(['count', 8, 'glasses', true]);
  });

  it('carries completions, rest days, challenges and level across', async () => {
    seed(savedByV1, 1);
    const state = (await launch()).getState();
    expect(state.completions).toEqual(savedByV1.completions);
    expect(state.skips).toEqual(savedByV1.skips);
    expect(state.challenges.map((c) => c.id)).toEqual(['c1']);
    expect(state.lastSeenLevel).toBe(4);
  });

  it('starts with no categories and custom sort', async () => {
    seed(savedByV1, 1);
    const state = (await launch()).getState();
    expect(state.categories).toEqual([]);
    expect(state.sortMode).toBe('custom');
  });

  it('saves the upgraded data back as version 2', async () => {
    seed(savedByV1, 1);
    const store = await launch();
    store.getState().addCategory('Fitness', '💪');
    await settle();
    const saved = JSON.parse(disk.data.get(STORAGE_KEY)!);
    expect(saved.version).toBe(2);
    expect(saved.state.categories.map((c: { name: string }) => c.name)).toEqual(['Fitness']);
  });
});

describe('upgrading saved data from v0 (before goal types)', () => {
  const savedByV0 = {
    habits: [
      {
        id: 'h1', name: 'Read', emoji: '📖', color: '#4F46E5', frequency: { type: 'daily' },
        reminderTime: null, notificationId: null, createdAt: '2026-01-01', archived: false,
      },
    ],
    completions: { h1: ['2026-01-01', '2026-01-02', '2026-01-03'] },
  };

  it('turns each habit into a binary one with no category', async () => {
    seed(savedByV0, 0);
    const [read] = (await launch()).getState().habits;
    expect([read.goalType, read.target, read.step, read.unit, read.categoryId]).toEqual(['binary', 1, 1, null, null]);
  });

  it('turns completed dates into values that still count as done', async () => {
    seed(savedByV0, 0);
    const { completions } = (await launch()).getState();
    expect(completions.h1).toEqual({ '2026-01-01': 1, '2026-01-02': 1, '2026-01-03': 1 });
  });
});

describe('categories', () => {
  it('trims names, and reordering sets section order', async () => {
    const store = await launch();
    const fitness = store.getState().addCategory('Fitness', '💪');
    const mind = store.getState().addCategory('  Mind  ', '🧠');
    expect(mind.name).toBe('Mind');
    store.getState().reorderCategories([mind.id, fitness.id]);
    expect(store.getState().categories.map((c) => c.name)).toEqual(['Mind', 'Fitness']);
  });

  it('moves habits to Other when their category is deleted, never deleting them', async () => {
    seed(savedByV1, 1);
    const store = await launch();
    const fitness = store.getState().addCategory('Fitness', '💪');
    store.setState({
      habits: store.getState().habits.map((h) => (h.id === 'h1' ? { ...h, categoryId: fitness.id } : h)),
    });
    store.getState().deleteCategory(fitness.id);
    expect(store.getState().habits).toHaveLength(2);
    expect(store.getState().habits.find((h) => h.id === 'h1')?.categoryId).toBeNull();
    expect(store.getState().categories).toEqual([]);
  });
});

describe('rules the store enforces', () => {
  async function storeWithDailyHabit() {
    const store = await launch();
    const habit = store.getState().addHabit({
      name: 'Gym', emoji: '💪', color: '#4F46E5', categoryId: null,
      frequency: { type: 'daily' }, goalType: 'binary', target: 1, unit: null, step: 1, reminderTime: null,
    });
    return { store, habit };
  }

  it('refuses a second rest day in the same week', async () => {
    const { store, habit } = await storeWithDailyHabit();
    // The frozen today is a Saturday, so yesterday is in the same week.
    expect(store.getState().setSkipped(habit.id, ago(1), true)).toBe(true);
    expect(store.getState().setSkipped(habit.id, ago(2), true)).toBe(false);
  });

  it('cancels a rest day when progress is logged on it', async () => {
    const { store, habit } = await storeWithDailyHabit();
    store.getState().setSkipped(habit.id, ago(1), true);
    store.getState().toggleCompletion(habit.id, ago(1));
    expect(store.getState().skips[habit.id]).not.toContain(ago(1));
  });

  it('allows only one running challenge per habit', async () => {
    const { store, habit } = await storeWithDailyHabit();
    expect(store.getState().startChallenge(habit.id, 14)).not.toBeNull();
    expect(store.getState().startChallenge(habit.id, 28)).toBeNull();
  });
});
