import { beforeEach, describe, expect, it } from 'vitest';
import { todayStr } from '../utils/dates';
import {
  getProgression,
  getTotalXp,
  MAX_LEVEL,
  missedPenalty,
  nextTier,
  rankForLevel,
  xpForDay,
  xpForHabit,
  xpToAdvance,
} from '../utils/progression';
import { ago, freezeTime, logged, makeHabit, range } from './helpers';

beforeEach(() => freezeTime());

describe('tiers and ranks', () => {
  it('runs five tiers of five, Leafling to Gold', () => {
    expect(MAX_LEVEL).toBe(25);
    expect(rankForLevel(1).label).toBe('Leafling 1');
    expect(rankForLevel(5).label).toBe('Leafling 5');
    expect(rankForLevel(6).label).toBe('Iron 1');
    expect(rankForLevel(10).label).toBe('Iron 5');
    expect(rankForLevel(11).label).toBe('Bronze 1');
    expect(rankForLevel(16).label).toBe('Silver 1');
    expect(rankForLevel(21).label).toBe('Gold 1');
    expect(rankForLevel(25).label).toBe('Gold 5');
    expect(rankForLevel(13).step).toBe(3);
  });

  it('clamps out-of-range levels', () => {
    expect(rankForLevel(999).label).toBe('Gold 5');
    expect(rankForLevel(0).label).toBe('Leafling 1');
    expect(rankForLevel(-50).label).toBe('Leafling 1');
  });

  it('knows the next tier, and that Gold is the top', () => {
    expect(nextTier(1)?.name).toBe('Iron');
    expect(nextTier(21)).toBeNull();
  });
});

describe('XP per day', () => {
  const count = makeHabit({ goalType: 'count', target: 8, unit: 'glasses' });

  it('pays 15 for a completed day', () => {
    expect(xpForDay(makeHabit(), 1)).toBe(15);
    expect(xpForDay(count, 8)).toBe(15);
  });

  it('pays partial progress proportionally, without the bonus', () => {
    expect(xpForDay(count, 4)).toBe(5);
    expect(xpForDay(count, 1)).toBe(1);
  });

  it('pays nothing for an untouched day and caps overshoot', () => {
    expect(xpForDay(makeHabit(), 0)).toBe(0);
    expect(xpForDay(makeHabit(), undefined)).toBe(0);
    expect(xpForDay(count, 12)).toBe(15);
  });

  it('always makes finishing worth more than stopping one short', () => {
    expect(xpForDay(count, 8)).toBeGreaterThan(xpForDay(count, 7));
  });
});

describe('missed-day penalties', () => {
  it('charges 5 XP for each untouched due day', () => {
    // Created 10 days ago; 5 of those 10 completed.
    const progress = logged(range(5, 1));
    expect(missedPenalty(makeHabit(), progress)).toBe(25);
    expect(xpForHabit(makeHabit(), progress)).toBe(50);
  });

  it('charges nothing for a perfect record', () => {
    const progress = logged(range(10, 1));
    expect(missedPenalty(makeHabit(), progress)).toBe(0);
    expect(xpForHabit(makeHabit(), progress)).toBe(150);
  });

  it('penalises every due day when nothing was logged', () => {
    expect(missedPenalty(makeHabit(), {})).toBe(50);
  });

  it('never counts today as missed', () => {
    expect(missedPenalty(makeHabit({ createdAt: todayStr() }), {})).toBe(0);
  });

  it('stops penalising archived habits but keeps what they earned', () => {
    expect(missedPenalty(makeHabit({ archived: true }), {})).toBe(0);
    expect(xpForHabit(makeHabit({ archived: true }), { [ago(1)]: 1 })).toBe(15);
  });

  it('never punishes partial progress', () => {
    const count = makeHabit({ goalType: 'count', target: 8 });
    const progress = logged(range(10, 1), 4);
    expect(missedPenalty(count, progress)).toBe(0);
    expect(xpForHabit(count, progress)).toBe(50);
  });

  it('only counts a specific-days habit on its own days', () => {
    const mondays = makeHabit({ frequency: { type: 'weekdays', days: [1] } });
    const penalty = missedPenalty(mondays, {});
    expect(penalty).toBeLessThan(50);
    expect(penalty % 5).toBe(0);
  });

  it('judges times-per-week habits a week at a time', () => {
    const thrice = makeHabit({ frequency: { type: 'timesPerWeek', count: 3 }, createdAt: ago(21) });
    expect(missedPenalty(thrice, {})).toBeLessThan(21 * 5);
    const fresh = makeHabit({ frequency: { type: 'timesPerWeek', count: 3 }, createdAt: todayStr() });
    expect(missedPenalty(fresh, {})).toBe(0);
  });
});

describe('levels', () => {
  it('makes each level cost more than the last', () => {
    expect(xpToAdvance(1)).toBe(60);
    expect(xpToAdvance(2)).toBe(90);
  });

  it('turns XP into a level at the right thresholds', () => {
    expect(getProgression(0).level).toBe(1);
    expect(getProgression(59).level).toBe(1);
    expect(getProgression(60).level).toBe(2);
    expect(getProgression(150).level).toBe(3);
  });

  it('reports progress through the current level', () => {
    expect(getProgression(60 + 45).ratio).toBe(0.5);
  });

  it('caps at the top rank', () => {
    const maxed = getProgression(999_999);
    expect(maxed.level).toBe(25);
    expect(maxed.isMaxLevel).toBe(true);
    expect(maxed.ratio).toBe(1);
    expect(maxed.nextTier).toBeNull();
  });

  it('is paced in weeks for the first tier, not months', () => {
    let xp = 0;
    let days = 0;
    while (getProgression(xp).level < 6 && days < 2000) {
      xp += 15;
      days++;
    }
    expect(days).toBeGreaterThan(10);
    expect(days).toBeLessThan(60);
  });

  it('makes the top rank a long haul but reachable', () => {
    let xp = 0;
    let days = 0;
    while (getProgression(xp).level < MAX_LEVEL && days < 20_000) {
      xp += 15 * 3; // three perfect daily habits
      days++;
    }
    expect(days).toBeGreaterThan(120);
    expect(days).toBeLessThan(800);
  });
});

describe('the Leafling 1 floor', () => {
  it('can never go below level 1', () => {
    const floored = getProgression(-9999);
    expect(floored.level).toBe(1);
    expect(floored.rank.label).toBe('Leafling 1');
    expect(floored.ratio).toBeGreaterThanOrEqual(0);
    expect(floored.xpIntoLevel).toBeGreaterThanOrEqual(0);
  });

  it('floors an account abandoned for over a year', () => {
    const abandoned = makeHabit({ createdAt: ago(400) });
    // The habit itself goes deeply negative, so it can offset other habits...
    expect(xpForHabit(abandoned, {})).toBeLessThan(0);
    // ...but the total never does.
    expect(getTotalXp([abandoned], { h: {} })).toBe(0);
    expect(getProgression(getTotalXp([abandoned], { h: {} })).rank.label).toBe('Leafling 1');
  });

  it('floors earning well and then abandoning', () => {
    const total = getTotalXp([makeHabit({ createdAt: ago(400) })], { h: logged(range(400, 380)) });
    expect(total).toBe(0);
  });

  it('does not let several abandoned habits compound past the floor', () => {
    const many = [makeHabit({ id: 'a', createdAt: ago(400) }), makeHabit({ id: 'b', createdAt: ago(400) })];
    expect(getTotalXp(many, {})).toBe(0);
  });

  it('starts empty data at zero', () => {
    expect(getTotalXp([], {})).toBe(0);
  });
});
