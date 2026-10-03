import { beforeEach, describe, expect, it } from 'vitest';
import { todayStr } from '../utils/dates';
import { describeNextDue, nextDueDate, scheduleLabel } from '../utils/schedule';
import { freezeTime, makeHabit } from './helpers';

// The frozen today is Saturday 3 October 2026.
beforeEach(() => freezeTime());

const mwf = makeHabit({ frequency: { type: 'weekdays', days: [1, 3, 5] } });

describe('schedule labels', () => {
  it('describes each kind of schedule', () => {
    expect(scheduleLabel(makeHabit())).toBe('Daily');
    expect(scheduleLabel(mwf)).toBe('Mon, Wed, Fri');
    expect(scheduleLabel(makeHabit({ frequency: { type: 'timesPerWeek', count: 3 } }))).toBe('3× a week');
  });
});

describe('next due date', () => {
  it('finds the next scheduled day after today', () => {
    expect(nextDueDate(mwf, todayStr())).toBe('2026-10-05');
    expect(describeNextDue('2026-10-05', todayStr())).toBe('Mon');
  });

  it('calls the day after today "Tomorrow"', () => {
    const sundays = makeHabit({ frequency: { type: 'weekdays', days: [0] } });
    const next = nextDueDate(sundays, todayStr());
    expect(next).toBe('2026-10-04');
    expect(describeNextDue(next!, todayStr())).toBe('Tomorrow');
  });

  it('never returns today, even for a habit due today', () => {
    const saturdays = makeHabit({ frequency: { type: 'weekdays', days: [6] } });
    expect(nextDueDate(saturdays, todayStr())).toBe('2026-10-10');
  });

  it('returns null for a habit with no days selected', () => {
    expect(nextDueDate(makeHabit({ frequency: { type: 'weekdays', days: [] } }), todayStr())).toBeNull();
  });
});
