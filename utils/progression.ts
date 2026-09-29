import { CompletionsMap, Habit } from '../types/habit';
import { dayCredit } from './goals';

/** XP a fully completed day is worth before the completion bonus. */
const DAILY_XP = 10;
/** Extra XP for actually reaching the target, so finishing always beats coasting. */
const COMPLETION_BONUS = 5;
/** XP needed to leave level 1. */
const BASE_LEVEL_XP = 100;
/** How much more each subsequent level costs than the one before it. */
const LEVEL_XP_GROWTH = 50;

export interface Rank {
  name: string;
  emoji: string;
  minLevel: number;
}

const RANKS: Rank[] = [
  { name: 'Bronze', emoji: '🥉', minLevel: 1 },
  { name: 'Silver', emoji: '🥈', minLevel: 5 },
  { name: 'Gold', emoji: '🥇', minLevel: 10 },
  { name: 'Platinum', emoji: '🛡️', minLevel: 20 },
  { name: 'Diamond', emoji: '💎', minLevel: 35 },
  { name: 'Master', emoji: '👑', minLevel: 50 },
];

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
 * Lifetime XP across every habit and every logged day. Archived habits still
 * count — the work was done.
 */
export function getTotalXp(habits: Habit[], completions: CompletionsMap): number {
  let total = 0;
  for (const habit of habits) {
    const progress = completions[habit.id];
    if (!progress) continue;
    for (const value of Object.values(progress)) {
      total += xpForDay(habit, value);
    }
  }
  return total;
}

/** XP required to advance from the given level to the next one. */
export function xpToAdvance(level: number): number {
  return BASE_LEVEL_XP + (level - 1) * LEVEL_XP_GROWTH;
}

export function rankForLevel(level: number): Rank {
  let current = RANKS[0];
  for (const rank of RANKS) {
    if (level >= rank.minLevel) current = rank;
  }
  return current;
}

/** The next rank up, or null once the top rank is reached. */
export function nextRank(level: number): Rank | null {
  return RANKS.find((rank) => rank.minLevel > level) ?? null;
}

export interface Progression {
  level: number;
  rank: Rank;
  nextRank: Rank | null;
  xpTotal: number;
  /** XP earned since reaching the current level. */
  xpIntoLevel: number;
  /** XP the current level needs in total to advance. */
  xpForLevel: number;
  /** Progress through the current level, 0..1. */
  ratio: number;
}

export function getProgression(xpTotal: number): Progression {
  let level = 1;
  let remaining = Math.max(0, xpTotal);
  // Each level costs more than the last, so walk up spending XP as we go.
  while (remaining >= xpToAdvance(level)) {
    remaining -= xpToAdvance(level);
    level++;
  }
  const xpForLevel = xpToAdvance(level);
  return {
    level,
    rank: rankForLevel(level),
    nextRank: nextRank(level),
    xpTotal,
    xpIntoLevel: remaining,
    xpForLevel,
    ratio: xpForLevel === 0 ? 0 : remaining / xpForLevel,
  };
}
