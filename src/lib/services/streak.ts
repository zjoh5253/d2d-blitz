import { startOfDay } from "date-fns";

interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  lastSaleDate: string | null;
  multiplier: number;
  description: string;
  nextMilestone: { days: number; multiplier: number } | null;
}

const TIERS = [
  { days: 14, multiplier: 1.2 },
  { days: 7, multiplier: 1.15 },
  { days: 5, multiplier: 1.1 },
  { days: 3, multiplier: 1.05 },
  { days: 0, multiplier: 1.0 },
];

const MILESTONES = [
  { days: 3, multiplier: 1.05 },
  { days: 5, multiplier: 1.1 },
  { days: 7, multiplier: 1.15 },
  { days: 14, multiplier: 1.2 },
];

function getMultiplier(streak: number): number {
  for (const tier of TIERS) {
    if (streak >= tier.days) return tier.multiplier;
  }
  return 1.0;
}

function getNextMilestone(streak: number): { days: number; multiplier: number } | null {
  for (const milestone of MILESTONES) {
    if (streak < milestone.days) return milestone;
  }
  return null;
}

export function calculateStreak(saleDates: Date[]): StreakResult {
  if (saleDates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastSaleDate: null,
      multiplier: 1.0,
      description: "1.0x (no streak)",
      nextMilestone: { days: 3, multiplier: 1.05 },
    };
  }

  // Normalize dates to start of day and deduplicate
  const uniqueDays = Array.from(
    new Set(saleDates.map((d) => startOfDay(d).getTime()))
  )
    .sort((a, b) => b - a)
    .map((t) => new Date(t));

  const lastSaleDate = uniqueDays[0].toISOString();

  const today = startOfDay(new Date()).getTime();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  // Calculate current streak going backwards from today
  let currentStreak = 0;
  let expectedDay = today;

  // Allow streak to include today or yesterday (in case no sale yet today)
  const mostRecentDayMs = uniqueDays[0].getTime();
  if (mostRecentDayMs === today || mostRecentDayMs === today - ONE_DAY_MS) {
    expectedDay = mostRecentDayMs;
    for (const day of uniqueDays) {
      if (day.getTime() === expectedDay) {
        currentStreak++;
        expectedDay -= ONE_DAY_MS;
      } else {
        break;
      }
    }
  }

  // Calculate longest streak across all gaps
  let longestStreak = currentStreak;
  let runStreak = 1;

  for (let i = 1; i < uniqueDays.length; i++) {
    const diff = uniqueDays[i - 1].getTime() - uniqueDays[i].getTime();
    if (diff === ONE_DAY_MS) {
      runStreak++;
      if (runStreak > longestStreak) longestStreak = runStreak;
    } else {
      runStreak = 1;
    }
  }

  const multiplier = getMultiplier(currentStreak);
  const nextMilestone = getNextMilestone(currentStreak);

  const description =
    currentStreak > 0
      ? `${multiplier.toFixed(2)}x (${currentStreak}-day streak)`
      : `${multiplier.toFixed(2)}x (no streak)`;

  return {
    currentStreak,
    longestStreak,
    lastSaleDate,
    multiplier,
    description,
    nextMilestone,
  };
}
