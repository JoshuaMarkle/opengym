import type { Units } from '../db/types';
import { cardioTotals, longDistance, MI_M, type CardioValues } from './cardio';
import { addDays, DAY_MS, startOfWeek } from './dates';

/**
 * Cardio progress (SPEC §10, D2–D4) is about how much you do: minutes, distance
 * and sessions per week. The only "bests" are classic race distances.
 */

export interface CardioSession {
  workoutId: string;
  exerciseId: string;
  date: number;
  sets: CardioValues[];
}

export type CardioRange = '4W' | '3M' | '6M' | '1Y' | 'All';
export const CARDIO_RANGES: CardioRange[] = ['4W', '3M', '6M', '1Y', 'All'];
export type CardioMetric = 'minutes' | 'distance' | 'sessions';

export const RANGE_PHRASE: Record<CardioRange, string> = {
  '4W': 'last 4 weeks',
  '3M': 'last 3 months',
  '6M': 'last 6 months',
  '1Y': 'last year',
  All: 'all time',
};
export const RANGE_SHORT: Record<CardioRange, string> = { '4W': '4 weeks', '3M': '3 months', '6M': '6 months', '1Y': 'year', All: 'all time' };

/** First day (week start) of a range that ends this week; undefined = all time. */
export function cardioRangeStart(range: CardioRange, weekStart: 0 | 1, now = Date.now()): number | undefined {
  const thisWeek = startOfWeek(now, weekStart);
  if (range === 'All') return undefined;
  if (range === '4W') return addDays(thisWeek, -21);
  const months = range === '3M' ? 3 : range === '6M' ? 6 : 12;
  const d = new Date(now);
  d.setMonth(d.getMonth() - months);
  return startOfWeek(d.getTime(), weekStart);
}

/**
 * Ranges you have history for. 4W and All always show; a longer range shows
 * once your first session is older than the range before it (so 6M appears
 * after 3 months of cardio, and so on).
 */
export function availableCardioRanges(firstSession: number | undefined, weekStart: 0 | 1, now = Date.now()): CardioRange[] {
  if (firstSession === undefined) return ['4W', 'All'];
  const out: CardioRange[] = ['4W'];
  const prev: Record<string, CardioRange> = { '3M': '4W', '6M': '3M', '1Y': '6M' };
  for (const r of ['3M', '6M', '1Y'] as const) {
    if (firstSession < (cardioRangeStart(prev[r], weekStart, now) ?? 0)) out.push(r);
  }
  out.push('All');
  return out;
}

export interface WeekBin {
  start: number;
  minutes: number;
  /** meters */
  distance: number;
  sessions: number;
}

/** One bin per week from `from` to the current week (inclusive). */
export function weeklyBins(sessions: CardioSession[], from: number, weekStart: 0 | 1, now = Date.now()): WeekBin[] {
  const bins: WeekBin[] = [];
  const index = new Map<number, WeekBin>();
  for (let w = startOfWeek(from, weekStart); w <= now; w = addDays(w, 7)) {
    const b = { start: w, minutes: 0, distance: 0, sessions: 0 };
    bins.push(b);
    index.set(w, b);
  }
  for (const s of sessions) {
    const b = index.get(startOfWeek(s.date, weekStart));
    if (!b) continue;
    const t = cardioTotals(s.sets);
    b.minutes += t.durationSec / 60;
    b.distance += t.distance ?? 0;
    b.sessions += 1;
  }
  return bins;
}

export function binValue(b: WeekBin, metric: CardioMetric, units: Units): number {
  return metric === 'minutes' ? b.minutes : metric === 'distance' ? longDistance(b.distance, units) : b.sessions;
}

export interface CardioRangeSummary {
  bins: WeekBin[];
  values: number[];
  /** Per-week average over the range's finished weeks (this week counts only if it's the only one). */
  avg: number;
  /** Same average for the equally long stretch before the range, when you were logging cardio then. */
  prevAvg?: number;
  change?: number;
}

const average = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function summarizeRange(
  sessions: CardioSession[],
  range: CardioRange,
  metric: CardioMetric,
  units: Units,
  weekStart: 0 | 1,
  now = Date.now(),
): CardioRangeSummary {
  const first = sessions.length ? Math.min(...sessions.map((s) => s.date)) : now;
  const from = cardioRangeStart(range, weekStart, now) ?? first;
  const bins = weeklyBins(sessions, from, weekStart, now);
  const values = bins.map((b) => binValue(b, metric, units));
  // The current week isn't over: leave it out of the average unless it's all there is.
  const finished = values.length > 1 ? values.slice(0, -1) : values;
  const avg = average(finished);
  const rangeWeek = startOfWeek(from, weekStart);
  // Nothing logged before the range: no "vs before" line.
  if (range === 'All' || first >= rangeWeek) return { bins, values, avg };
  const prevFrom = addDays(rangeWeek, -7 * finished.length);
  const prevBins = weeklyBins(sessions, prevFrom, weekStart, rangeWeek - 1);
  // Only count weeks from your first cardio session on, so a new habit isn't compared with zeros.
  const counted = prevBins.filter((b) => addDays(b.start, 7) > first);
  if (!counted.length) return { bins, values, avg };
  const prevAvg = average(counted.map((b) => binValue(b, metric, units)));
  return { bins, values, avg, prevAvg, change: avg - prevAvg };
}

export interface MachineTotal {
  exerciseId: string;
  sessions: number;
  durationSec: number;
  /** meters, when any session logged distance */
  distance?: number;
  last: number;
}

/** D2 "By machine": totals per cardio exercise since `from`, most time first. */
export function machineTotals(sessions: CardioSession[], from: number | undefined): MachineTotal[] {
  const m = new Map<string, MachineTotal>();
  for (const s of sessions) {
    if (from !== undefined && s.date < from) continue;
    const t = cardioTotals(s.sets);
    const cur = m.get(s.exerciseId) ?? { exerciseId: s.exerciseId, sessions: 0, durationSec: 0, last: 0 };
    cur.sessions += 1;
    cur.durationSec += t.durationSec;
    if (t.distance != null) cur.distance = (cur.distance ?? 0) + t.distance;
    cur.last = Math.max(cur.last, s.date);
    m.set(s.exerciseId, cur);
  }
  return [...m.values()].sort((a, b) => b.durationSec - a.durationSec || b.last - a.last);
}

// ───────────────────────────── distance records (D4)

export const RACE_DISTANCES: { id: string; label: string; meters: number }[] = [
  { id: 'mile', label: '1 mile', meters: MI_M },
  { id: '5k', label: '5K', meters: 5000 },
  { id: '10k', label: '10K', meters: 10000 },
  { id: 'half', label: 'Half marathon', meters: 21097.5 },
  { id: 'marathon', label: 'Marathon', meters: 42195 },
];

export const DISTANCE_RECORD_NEW_DAYS = 60;

export interface DistanceRecord {
  id: string;
  label: string;
  meters: number;
  best?: { timeSec: number; date: number; workoutId: string; exerciseId: string };
}

/**
 * Fastest time for each race distance: any single segment that covered at least
 * that distance, with its time scaled to the exact distance. Ties keep the first.
 */
export function distanceRecords(runs: CardioSession[]): { records: DistanceRecord[]; longest?: { meters: number; date: number } } {
  const records: DistanceRecord[] = RACE_DISTANCES.map((r) => ({ ...r }));
  let longest: { meters: number; date: number } | undefined;
  for (const s of [...runs].sort((a, b) => a.date - b.date)) {
    for (const seg of s.sets) {
      if (!seg.distance || !seg.durationSec) continue;
      if (!longest || seg.distance > longest.meters) longest = { meters: seg.distance, date: s.date };
      for (const r of records) {
        if (seg.distance + 1e-6 < r.meters) continue;
        const timeSec = (seg.durationSec * r.meters) / seg.distance;
        if (!r.best || timeSec < r.best.timeSec - 1e-6) r.best = { timeSec, date: s.date, workoutId: s.workoutId, exerciseId: s.exerciseId };
      }
    }
  }
  return { records, longest };
}

export const isRecentDistanceRecord = (date: number, now = Date.now()) => now - date <= DISTANCE_RECORD_NEW_DAYS * DAY_MS;
