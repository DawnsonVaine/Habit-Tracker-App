import { beforeEach, describe, expect, it } from 'vitest';
import { canChallengeHabit, countSessions, getChallengeProgress } from '../utils/challenges';
import { getWeekdayIndex, todayStr } from '../utils/dates';
import { getTotalXp } from '../utils/progression';
import { ago, freezeTime, logged, makeChallenge, makeHabit, range } from './helpers';

beforeEach(() => freezeTime());

const NONE = new Set<string>();

describe('an active run', () => {
  // Started 9 days ago, every day since done; today still open.
  const progress = () => getChallengeProgress(makeChallenge(), makeHabit(), logged(range(9, 1)), NONE);

  it('is active on day 10 of 14', () => {
    expect(progress().status).toBe('active');
    expect(progress().dayNumber).toBe(10);
  });

  it('counts sessions and kept sessions', () => {
    expect(progress().sessionsTotal).toBe(14);
    expect(progress().sessionsDone).toBe(9);
  });

  it('leaves today open rather than failing it', () => {
    expect(progress().todayOpen).toBe(true);
  });

  it('offers 10 XP per session', () => {
    expect(progress().bonusXp).toBe(140);
  });
});

describe('failing', () => {
  it('ends on the first missed past session, and records it', () => {
    const result = getChallengeProgress(makeChallenge(), makeHabit(), logged([9, 8, 7, 5, 4, 3, 2, 1]), NONE);
    expect(result.status).toBe('failed');
    expect(result.failedOn).toBe(ago(6));
  });

  it('does not accept partial progress as a kept session', () => {
    const count = makeHabit({ goalType: 'count', target: 8 });
    const progress = { ...logged(range(9, 1), 8), [ago(4)]: 5 };
    expect(getChallengeProgress(makeChallenge(), count, progress, NONE).status).toBe('failed');
  });
});

describe('rest days', () => {
  it('keep a run alive and are counted separately', () => {
    const result = getChallengeProgress(
      makeChallenge(),
      makeHabit(),
      logged([9, 8, 7, 5, 4, 3, 2, 1]),
      new Set([ago(6)])
    );
    expect(result.status).toBe('active');
    expect(result.sessionsRested).toBe(1);
  });
});

describe('completing', () => {
  it('completes once every session is kept', () => {
    const result = getChallengeProgress(makeChallenge({ startDate: ago(13) }), makeHabit(), logged(range(13, 0)), NONE);
    expect(result.status).toBe('completed');
  });

  it('still completes with a rested session', () => {
    const result = getChallengeProgress(
      makeChallenge({ startDate: ago(13) }),
      makeHabit(),
      logged(range(13, 0).filter((n) => n !== 5)),
      new Set([ago(5)])
    );
    expect(result.status).toBe('completed');
  });

  it('reports abandoned over everything else', () => {
    const result = getChallengeProgress(
      makeChallenge({ startDate: ago(13), abandoned: true }),
      makeHabit(),
      logged(range(13, 0)),
      NONE
    );
    expect(result.status).toBe('abandoned');
  });
});

describe('specific-day habits', () => {
  const mwf = makeHabit({ frequency: { type: 'weekdays', days: [1, 3, 5] } });

  it('only count their scheduled days as sessions', () => {
    expect(countSessions(mwf, todayStr(), 56)).toBe(24);
    expect(countSessions(mwf, todayStr(), 14)).toBe(6);
  });

  it('never fail on an off day', () => {
    const scheduled = range(13, 1).filter((n) => [1, 3, 5].includes(getWeekdayIndex(ago(n))));
    const result = getChallengeProgress(makeChallenge({ startDate: ago(13) }), mwf, logged(scheduled), NONE);
    expect(result.status).not.toBe('failed');
  });
});

describe('eligibility', () => {
  it('excludes times-per-week habits', () => {
    expect(canChallengeHabit(makeHabit({ frequency: { type: 'timesPerWeek', count: 3 } }))).toBe(false);
    expect(canChallengeHabit(makeHabit())).toBe(true);
  });
});

describe('the bonus', () => {
  // Created when the challenge began, so its base XP is positive and the
  // Leafling 1 floor (total clamped at zero) can't mask the bonus.
  const habit = () => makeHabit({ createdAt: ago(13) });
  const full = () => ({ h: logged(range(13, 0)) });
  const base = () => getTotalXp([habit()], full(), {});

  it('is added only once a challenge is completed', () => {
    expect(getTotalXp([habit()], full(), {}, [makeChallenge({ startDate: ago(13) })]) - base()).toBe(140);
  });

  it('is not added for abandoned, active or orphaned challenges', () => {
    const abandoned = makeChallenge({ startDate: ago(13), abandoned: true });
    const active = makeChallenge({ startDate: ago(5) });
    const orphaned = makeChallenge({ habitId: 'gone', startDate: ago(13) });
    expect(getTotalXp([habit()], full(), {}, [abandoned]) - base()).toBe(0);
    expect(getTotalXp([habit()], full(), {}, [active]) - base()).toBe(0);
    expect(getTotalXp([habit()], full(), {}, [orphaned]) - base()).toBe(0);
  });
});

describe('daylight saving', () => {
  it('runs in a timezone that actually changes its clocks', () => {
    // New Zealand: +13 in summer (January), +12 in winter (July).
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(-780);
    expect(new Date(2026, 6, 15).getTimezoneOffset()).toBe(-720);
  });

  it('never drifts the day number across a changeover', () => {
    // 400 start dates span both changeovers, where a day is 23 or 25 hours.
    const drift: string[] = [];
    for (let back = 0; back < 400; back++) {
      for (const lengthDays of [14, 75]) {
        const result = getChallengeProgress(
          makeChallenge({ startDate: ago(back), lengthDays }),
          makeHabit(),
          {},
          NONE
        );
        const expected = Math.min(back + 1, lengthDays);
        if (result.dayNumber !== expected) drift.push(`${ago(back)} len ${lengthDays}: ${result.dayNumber}`);
      }
    }
    expect(drift).toEqual([]);
  });
});
