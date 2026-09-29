import { CompletionsMap, Habit, HabitProgress } from '../types/habit';
import { addDays, parseDateStr, startOfWeek, todayStr } from './dates';
import { dayCredit } from './goals';
import { isDueOnDate } from './streaks';

/** XP a fully completed day is worth before the completion bonus. */
const DAILY_XP = 10;
/** Extra XP for actually reaching the target, so finishing always beats coasting. */
const COMPLETION_BONUS = 5;
/** XP lost for a day the habit was due and nothing at all was logged. */
const MISSED_PENALTY = 5;
/** XP needed to leave level 1. */
const BASE_LEVEL_XP = 60;
/** How much more each subsequent level costs than the one before it. */
const LEVEL_XP_GROWTH = 30;

/** Levels within each tier, e.g. Iron 1 through Iron 5. */
export const LEVELS_PER_TIER = 5;

export interface Tier {
  name: string;
  emoji: string;
}

const TIERS: Tier[] = [
  { name: 'Leafling', emoji: '🌱' },
  { name: 'Iron', emoji: '🛡️' },
  { name: 'Bronze', emoji: '🥉' },
  { name: 'Silver', emoji: '🥈' },
  { name: 'Gold', emoji: '🥇' },
];

/** Adding tiers here raises the ceiling; nothing else needs to change. */
export const MAX_LEVEL = TIERS.length * LEVELS_PER_TIER;

export interface Rank {
  tier: Tier;
  /** Position within the tier, 1..LEVELS_PER_TIER. */
  step: number;
  /** Display name, e.g. "Iron 3". */
  label: string;
}

export function rankForLevel(level: number): Rank {
  const clamped = Math.min(Math.max(1, Math.floor(level)), MAX_LEVEL);
  const tier = TIERS[Math.floor((clamped - 1) / LEVELS_PER_TIER)];
  const step = ((clamped - 1) % LEVELS_PER_TIER) + 1;
  return { tier, step, label: `${tier.name} ${step}` };
}

/** The tier above the one this level sits in, or null at the top. */
export function nextTier(level: number): Tier | null {
  const index = Math.floor((Math.min(Math.max(1, level), MAX_LEVEL) - 1) / LEVELS_PER_TIER);
  return TIERS[index + 1] ?? null;
}

/** The first level of a tier, for showing what a promotion costs. */
export function firstLevelOfTier(tier: Tier): number {
  return TIERS.indexOf(tier) * LEVELS_PER_TIER + 1;
}

/**
 * XP for a single habit-day. Partial progress earns proportional XP so effort
 * counts, but only hitting the target earns the bonus on top.
 */
export function xpForDay(habit: Habit, value: number | undefined): number {
  const credit = dayCredit(habit, value);
  if (credit <= 0) return 0;
  const earned = Math.round(DAILY_XP * credit);
  return credit >= 1 ? earned + COMPLETION_BONUS : earned;
}

/**
 * Occurrences missed in weeks that have fully elapsed. A 3x/week habit isn't
 * due on any particular day, so it can only be judged a week at a time.
 */
function weeklyShortfall(habit: Habit, progress: HabitProgress): number {
  if (habit.frequency.type !== 'timesPerWeek') return 0;
  const target = habit.frequency.count;
  const currentWeekStart = startOfWeek(todayStr());
  let shortfall = 0;
  let weekStart = startOfWeek(habit.createdAt);

  // The current week is still in progress, so it is never counted as missed.
  while (parseDateStr(weekStart) < parseDateStr(currentWeekStart)) {
    let done = 0;
    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      if (parseDateStr(day) < parseDateStr(habit.createdAt)) continue;
      if (dayCredit(habit, progress[day]) >= 1) done++;
    }
    shortfall += Math.max(0, target - done);
    weekStart = addDays(weekStart, 7);
  }
  return shortfall;
}

/**
 * XP lost to days the habit was due and completely untouched. Partial progress
 * is never penalised — some effort always beats none. Today is excluded since
 * it is still in play.
 */
export function missedPenalty(habit: Habit, progress: HabitProgress): number {
  // Archived habits are retired: they keep what they earned but stop accruing
  // penalties, so shelving something you've stopped doing isn't punished forever.
  if (habit.archived) return 0;

  const yesterday = addDays(todayStr(), -1);
  if (parseDateStr(yesterday) < parseDateStr(habit.createdAt)) return 0;

  if (habit.frequency.type === 'timesPerWeek') {
    return weeklyShortfall(habit, progress) * MISSED_PENALTY;
  }

  let missed = 0;
  let day = habit.createdAt;
  while (parseDateStr(day) <= parseDateStr(yesterday)) {
    if (isDueOnDate(habit, day) && dayCredit(habit, progress[day]) === 0) missed++;
    day = addDays(day, 1);
  }
  return missed * MISSED_PENALTY;
}

/** Net XP for one habit: everything earned, less what consistency cost. */
export function xpForHabit(habit: Habit, progress: HabitProgress): number {
  let earned = 0;
  for (const value of Object.values(progress)) {
    earned += xpForDay(habit, value);
  }
  return earned - missedPenalty(habit, progress);
}

/**
 * Lifetime XP across every habit. Archived habits keep the XP they earned —
 * the work was done — but no longer lose any.
 */
export function getTotalXp(habits: Habit[], completions: CompletionsMap): number {
  let total = 0;
  for (const habit of habits) {
    total += xpForHabit(habit, completions[habit.id] ?? {});
  }
  return Math.max(0, total);
}

/** XP required to advance from the given level to the next one. */
export function xpToAdvance(level: number): number {
  return BASE_LEVEL_XP + (level - 1) * LEVEL_XP_GROWTH;
}

export interface Progression {
  level: number;
  rank: Rank;
  nextTier: Tier | null;
  /** Level at which the next tier begins, or null at the top. */
  nextTierLevel: number | null;
  xpTotal: number;
  /** XP earned since reaching the current level. */
  xpIntoLevel: number;
  /** XP the current level needs in total to advance. */
  xpForLevel: number;
  /** Progress through the current level, 0..1. */
  ratio: number;
  isMaxLevel: boolean;
}

export function getProgression(xpTotal: number): Progression {
  let level = 1;
  let remaining = Math.max(0, xpTotal);
  while (level < MAX_LEVEL && remaining >= xpToAdvance(level)) {
    remaining -= xpToAdvance(level);
    level++;
  }

  const isMaxLevel = level >= MAX_LEVEL;
  const xpForLevel = isMaxLevel ? 0 : xpToAdvance(level);
  const upcoming = nextTier(level);

  return {
    level,
    rank: rankForLevel(level),
    nextTier: upcoming,
    nextTierLevel: upcoming ? firstLevelOfTier(upcoming) : null,
    xpTotal,
    xpIntoLevel: isMaxLevel ? 0 : remaining,
    xpForLevel,
    ratio: isMaxLevel ? 1 : remaining / xpForLevel,
    isMaxLevel,
  };
}
