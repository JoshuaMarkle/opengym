import { addDays, DAY_MS, monthsSpanned, startOfWeek } from './dates';

/**
 * Streaks count weeks in a row with at least STREAK_MIN workouts.
 * One workout keeps the streak alive (SPEC §4 History). Forgiving by design.
 */
export const STREAK_MIN = 1;

function weekCounts(dates: number[], weekStart: 0 | 1): Map<number, number> {
  const m = new Map<number, number>();
  for (const d of dates) {
    const w = startOfWeek(d, weekStart);
    m.set(w, (m.get(w) ?? 0) + 1);
  }
  return m;
}

/** Weeks in a row, ending this week. An empty current week doesn't break it (it isn't over yet). */
export function currentStreak(dates: number[], weekStart: 0 | 1, now = Date.now()): number {
  if (!dates.length) return 0;
  const counts = weekCounts(dates, weekStart);
  let w = startOfWeek(now, weekStart);
  if ((counts.get(w) ?? 0) < STREAK_MIN) w = addDays(w, -7);
  let n = 0;
  while ((counts.get(w) ?? 0) >= STREAK_MIN) {
    n++;
    w = addDays(w, -7);
  }
  return n;
}

export function longestStreak(dates: number[], weekStart: 0 | 1): number {
  if (!dates.length) return 0;
  const counts = weekCounts(dates, weekStart);
  const weeks = [...counts.keys()].filter((w) => (counts.get(w) ?? 0) >= STREAK_MIN).sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev: number | undefined;
  for (const w of weeks) {
    run = prev !== undefined && addDays(prev, 7) === w ? run + 1 : 1;
    best = Math.max(best, run);
    prev = w;
  }
  return best;
}

/** Average workouts per week over [from, to]. Never divides by less than one week. */
export function perWeek(count: number, from: number, to: number): number {
  const weeks = Math.max(1, (to - from) / (7 * DAY_MS));
  return count / weeks;
}

/** Complete weeks inside [from, to] with no workouts, ignoring weeks before the first workout. */
export function missedWeeks(dates: number[], from: number, to: number, weekStart: 0 | 1, firstWorkout?: number): number {
  if (!dates.length) return 0;
  const counts = weekCounts(dates, weekStart);
  let w = startOfWeek(Math.max(from, firstWorkout ?? from), weekStart);
  if (w < from) w = addDays(w, 7);
  let n = 0;
  while (addDays(w, 7) <= to) {
    if ((counts.get(w) ?? 0) === 0) n++;
    w = addDays(w, 7);
  }
  return n;
}

export type HistoryRange = 'month' | '6m' | 'year' | 'all';

/** Month is always shown; 6M after 6 months of history; Year and All once it spans more than a year. */
export function availableRanges(firstWorkout: number | undefined, now = Date.now()): HistoryRange[] {
  const out: HistoryRange[] = ['month'];
  if (firstWorkout === undefined) return out;
  const span = monthsSpanned(firstWorkout, now);
  if (span >= 6) out.push('6m');
  if (span > 12) out.push('year', 'all');
  return out;
}

/** Workouts per calendar month, keyed "YYYY-M" (month 0-based). */
export function monthCounts(dates: number[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of dates) {
    const d = new Date(t);
    const k = `${d.getFullYear()}-${d.getMonth()}`;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}
