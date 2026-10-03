import { beforeEach, describe, expect, it } from 'vitest';
import { addDays, startOfWeek } from '../utils/dates';
import { getProgression, getTotalXp, missedPenalty, xpForHabit } from '../utils/progression';
import {
  canSkipDay,
  canSkipHabit,
  skipsLeftInWeek,
  SKIPS_PER_WEEK,
  skipsUsedInWeek,
} from '../utils/skips';
import { getCompletionRate, getStreaks } from '../utils/streaks';
import { ago, freezeTime, logged, makeHabit } from './helpers';

beforeEach(() => freezeTime());

// Done 1, 2, 4 and 5 days ago; day 3 was not done.
const withGap = () => logged([1, 2, 4, 5]);
const gapHabit = () => makeHabit({ createdAt: ago(5) });

describe('a rest day protects the streak', () => {
  it('breaks the streak without a rest day', () => {
    expect(getStreaks(gapHabit(), withGap()).current).toBe(2);
  });

  it('bridges the gap with one', () => {
    const rested = new Set([ago(3)]);
    expect(getStreaks(gapHabit(), withGap(), rested).current).toBe(4);
    expect(getStreaks(gapHabit(), withGap(), rested).longest).toBe(4);
  });

  it('adds nothing to the streak itself', () => {
    expect(getStreaks(gapHabit(), withGap(), new Set([ago(3)])).current).toBeLessThan(5);
  });
});

describe('a rest day costs no XP', () => {
  it('removes the missed-day penalty', () => {
    expect(missedPenalty(gapHabit(), withGap())).toBe(5);
    expect(missedPenalty(gapHabit(), withGap(), new Set([ago(3)]))).toBe(0);
  });

  it('gives back exactly the penalty and earns nothing extra', () => {
    const rested = xpForHabit(gapHabit(), withGap(), new Set([ago(3)]));
    expect(rested - xpForHabit(gapHabit(), withGap())).toBe(5);
    expect(rested).toBe(60);
  });

  it('is read from the skips map by getTotalXp', () => {
    expect(getTotalXp([gapHabit()], { h: withGap() }, { h: [ago(3)] })).toBe(60);
  });
});

describe('completion rate', () => {
  it('leaves rest days out of the denominator', () => {
    const without = getCompletionRate(gapHabit(), withGap(), 30);
    const withRest = getCompletionRate(gapHabit(), withGap(), 30, new Set([ago(3)]));
    expect(withRest).toBeGreaterThan(without);
  });
});

describe('the weekly allowance', () => {
  const week = () => startOfWeek(ago(14)); // a fully elapsed week

  it('allows one rest day per habit per week', () => {
    expect(SKIPS_PER_WEEK).toBe(1);
    expect(canSkipDay(makeHabit(), [], week(), 0)).toBe(true);
    expect(canSkipDay(makeHabit(), [week()], addDays(week(), 2), 0)).toBe(false);
  });

  it('resets on Sunday', () => {
    expect(canSkipDay(makeHabit(), [week()], addDays(week(), 7), 0)).toBe(true);
    expect(skipsUsedInWeek([week()], addDays(week(), 6))).toBe(1);
    expect(skipsUsedInWeek([week()], addDays(week(), 7))).toBe(0);
    expect(skipsLeftInWeek([week()], addDays(week(), 3))).toBe(0);
  });
});

describe('what can never be rested', () => {
  it('excludes times-per-week habits', () => {
    expect(canSkipHabit(makeHabit({ frequency: { type: 'timesPerWeek', count: 3 } }))).toBe(false);
  });

  it('excludes days that already have progress', () => {
    expect(canSkipDay(makeHabit(), [], ago(1), 1)).toBe(false);
    expect(canSkipDay(makeHabit({ goalType: 'count', target: 8 }), [], ago(1), 3)).toBe(false);
  });

  it('excludes a day already rested', () => {
    expect(canSkipDay(makeHabit(), [ago(1)], ago(1), 0)).toBe(false);
  });
});

describe('no change for anyone who never rests', () => {
  it('treats a missing skip set as empty', () => {
    expect(getStreaks(gapHabit(), withGap()).current).toBe(
      getStreaks(gapHabit(), withGap(), new Set()).current
    );
    expect(getTotalXp([gapHabit()], { h: withGap() })).toBe(getTotalXp([gapHabit()], { h: withGap() }, {}));
  });

  it('keeps the Leafling 1 floor', () => {
    const total = getTotalXp([makeHabit({ createdAt: ago(400) })], {}, {});
    expect(getProgression(total).rank.label).toBe('Leafling 1');
  });
});
