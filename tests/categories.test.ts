import { describe, expect, it } from 'vitest';
import { Category, Habit } from '../types/habit';
import { groupByCategory, sortHabits, validateCategoryName } from '../utils/categories';
import { makeHabit } from './helpers';

const fitness: Category = { id: 'fit', name: 'Fitness', emoji: '💪' };
const mind: Category = { id: 'mind', name: 'Mind', emoji: '🧠' };
const habit = (id: string, over: Partial<Habit> = {}) => makeHabit({ id, name: id, ...over });
const ids = (list: Habit[]) => list.map((h) => h.id);

describe('grouping', () => {
  it('shows one untitled section when there are no categories', () => {
    const sections = groupByCategory([habit('a'), habit('b')], []);
    expect(sections.map((s) => s.title)).toEqual([null]);
    expect(ids(sections[0].habits)).toEqual(['a', 'b']);
  });

  it('shows nothing when there are no habits', () => {
    expect(groupByCategory([], [])).toEqual([]);
  });

  describe('with categories', () => {
    const habits = [
      habit('run', { categoryId: 'fit' }),
      habit('read', { categoryId: 'mind' }),
      habit('vitamins'),
      habit('gym', { categoryId: 'fit' }),
      habit('orphan', { categoryId: 'deleted-category' }),
    ];
    const sections = groupByCategory(habits, [mind, fitness]);

    it('follows category order with Other last', () => {
      expect(sections.map((s) => s.title)).toEqual(['Mind', 'Fitness', 'Other']);
    });

    it('keeps habit order within a section', () => {
      expect(ids(sections[1].habits)).toEqual(['run', 'gym']);
    });

    it('files uncategorised and deleted-category habits under Other', () => {
      expect(ids(sections[2].habits)).toEqual(['vitamins', 'orphan']);
    });
  });

  it('drops empty sections, including Other', () => {
    const sections = groupByCategory([habit('x', { categoryId: 'fit' })], [mind, fitness]);
    expect(sections.map((s) => s.title)).toEqual(['Fitness']);
  });
});

describe('sorting', () => {
  const pool = [habit('banana'), habit('Apple'), habit('cherry'), habit('apricot')];
  const streaks: Record<string, number> = { banana: 3, Apple: 7, cherry: 3, apricot: 0 };
  const done: Record<string, boolean> = { banana: true, Apple: false, cherry: true, apricot: false };
  const context = { streakOf: (h: Habit) => streaks[h.id], isDoneToday: (h: Habit) => done[h.id] };

  it('keeps custom order as-is', () => {
    expect(ids(sortHabits(pool, 'custom', context))).toEqual(['banana', 'Apple', 'cherry', 'apricot']);
  });

  it('sorts names A-Z ignoring case', () => {
    expect(ids(sortHabits(pool, 'name', context))).toEqual(['Apple', 'apricot', 'banana', 'cherry']);
  });

  it('puts the longest streak first, breaking ties by custom order', () => {
    expect(ids(sortHabits(pool, 'streak', context))).toEqual(['Apple', 'banana', 'cherry', 'apricot']);
  });

  it('puts unfinished habits first, breaking ties by custom order', () => {
    expect(ids(sortHabits(pool, 'todo', context))).toEqual(['Apple', 'apricot', 'banana', 'cherry']);
  });

  it('never mutates the list it was given', () => {
    sortHabits(pool, 'name', context);
    expect(ids(pool)).toEqual(['banana', 'Apple', 'cherry', 'apricot']);
  });
});

describe('category names', () => {
  it('rejects blanks and case-insensitive duplicates', () => {
    expect(validateCategoryName('   ', [fitness])).not.toBeNull();
    expect(validateCategoryName('fitness', [fitness])).not.toBeNull();
  });

  it('accepts a unique name, or a category keeping its own', () => {
    expect(validateCategoryName('Work', [fitness, mind])).toBeNull();
    expect(validateCategoryName('Fitness', [fitness], 'fit')).toBeNull();
  });
});
