import { Challenge, Habit, HabitProgress } from '../types/habit';
import { addDays, parseDateStr, todayStr } from './dates';
import { dayCredit } from './goals';
import { isDueOnDate } from './streaks';

/** Run lengths on offer, in days. */
export const CHALLENGE_LENGTHS = [14, 28, 56, 75] as const;

/** Bonus XP per scheduled session, paid only when the whole challenge is completed. */
export const CHALLENGE_BONUS_PER_SESSION = 10;

export function challengeLengthLabel(lengthDays: number): string {
  return lengthDays % 7 === 0 ? `${lengthDays / 7} weeks` : `${lengthDays} days`;
}

/**
 * Times-per-week habits can't take on a challenge: they aren't due on any
 * particular day, so there is no single day to miss.
 */
export function canChallengeHabit(habit: Habit): boolean {
  return habit.frequency.type !== 'timesPerWeek';
}

export function challengeEndDate(challenge: Pick<Challenge, 'startDate' | 'lengthDays'>): string {
  return addDays(challenge.startDate, challenge.lengthDays - 1);
}

/** Scheduled sessions in a run, which also sets the size of the bonus. */
export function countSessions(habit: Habit, startDate: string, lengthDays: number): number {
  let count = 0;
  for (let i = 0; i < lengthDays; i++) {
    if (isDueOnDate(habit, addDays(startDate, i))) count++;
  }
  return count;
}

export type ChallengeStatus = 'active' | 'completed' | 'failed' | 'abandoned';

export interface ChallengeProgress {
  status: ChallengeStatus;
  endDate: string;
  /** Day of the run that today falls on, clamped to the run's length. */
  dayNumber: number;
  sessionsTotal: number;
  sessionsDone: number;
  /** Sessions excused by a rest day; they count as kept. */
  sessionsRested: number;
  /** The scheduled day that ended a failed challenge. */
  failedOn: string | null;
  /** Today is a scheduled day that hasn't been completed yet. */
  todayOpen: boolean;
  bonusXp: number;
}

/**
 * Works out where a challenge stands from the habit's history. A session is
 * kept by completing it in full or resting it; any past scheduled day that
 * was neither ends the challenge. Partial progress isn't enough, since the
 * challenge is about hitting the target every time. Today never fails it —
 * it's still in play.
 */
export function getChallengeProgress(
  challenge: Challenge,
  habit: Habit,
  progress: HabitProgress,
  skipped: ReadonlySet<string>,
  today: string = todayStr()
): ChallengeProgress {
  const endDate = challengeEndDate(challenge);
  const sessionsTotal = countSessions(habit, challenge.startDate, challenge.lengthDays);
  // Rounded, not floored: across a daylight-saving change a calendar day is 23
  // or 25 hours, which flooring would turn into an off-by-one.
  const elapsed = Math.round(
    (parseDateStr(today).getTime() - parseDateStr(challenge.startDate).getTime()) / 86_400_000
  );
  const dayNumber = Math.min(Math.max(elapsed + 1, 1), challenge.lengthDays);

  let sessionsDone = 0;
  let sessionsRested = 0;
  let failedOn: string | null = null;
  let todayOpen = false;

  for (let i = 0; i < challenge.lengthDays; i++) {
    const day = addDays(challenge.startDate, i);
    if (!isDueOnDate(habit, day)) continue;
    if (skipped.has(day)) {
      sessionsRested++;
    } else if (dayCredit(habit, progress[day]) >= 1) {
      sessionsDone++;
    } else if (day < today) {
      failedOn ??= day;
    } else if (day === today) {
      todayOpen = true;
    }
  }

  let status: ChallengeStatus;
  if (challenge.abandoned) status = 'abandoned';
  else if (failedOn) status = 'failed';
  else if (sessionsDone + sessionsRested >= sessionsTotal) status = 'completed';
  else status = 'active';

  return {
    status,
    endDate,
    dayNumber,
    sessionsTotal,
    sessionsDone,
    sessionsRested,
    failedOn,
    todayOpen,
    bonusXp: sessionsTotal * CHALLENGE_BONUS_PER_SESSION,
  };
}
