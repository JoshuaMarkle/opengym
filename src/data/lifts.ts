import type { ExerciseType, OneRmFormula, WorkoutSet } from '../db/types';
import { rangeStart, type ChartRange } from '../lib/chart';
import { sessionMetric, topSet, type SessionPoint } from '../lib/oneRm';
import type { HistoryIndex } from './history';

export interface LiftPoint {
  date: number;
  workoutId: string;
  exerciseId: string;
  sets: WorkoutSet[];
  metric: SessionPoint | null;
  top: { weight?: number; reps: number } | null;
}

/** Sessions of one or more exercises (a variation group, combined), oldest first. */
export function liftPoints(history: HistoryIndex, exerciseIds: string[], type: ExerciseType, formula: OneRmFormula): LiftPoint[] {
  const byWorkout = new Map<string, LiftPoint>();
  for (const id of exerciseIds) {
    for (const s of history.sessionsByExercise.get(id) ?? []) {
      const p: LiftPoint = { date: s.date, workoutId: s.workoutId, exerciseId: id, sets: s.sets, metric: sessionMetric(s.sets, type, formula), top: topSet(s.sets, type) };
      const cur = byWorkout.get(s.workoutId);
      if (!cur || (p.metric?.value ?? -Infinity) > (cur.metric?.value ?? -Infinity)) byWorkout.set(s.workoutId, p);
    }
  }
  return [...byWorkout.values()].sort((a, b) => a.date - b.date);
}

export interface LiftTrend {
  /** Metric values in range (oldest first) for the sparkline. */
  values: number[];
  current?: number;
  baseline?: number;
  /** current − baseline, in the metric's unit (lb or reps). */
  change?: number;
  pct?: number;
}

/**
 * Change over a range: the latest session vs the last session before the
 * range started (or the first one inside it when there's nothing earlier).
 */
export function liftTrend(points: LiftPoint[], range: ChartRange, now = Date.now()): LiftTrend {
  const withMetric = points.filter((p) => p.metric);
  const start = rangeStart(range, now);
  const inRange = start === undefined ? withMetric : withMetric.filter((p) => p.date >= start);
  const before = start === undefined ? [] : withMetric.filter((p) => p.date < start);
  const values = inRange.map((p) => p.metric!.value);
  if (!inRange.length) return { values };
  const current = values[values.length - 1];
  const base = before.length ? before[before.length - 1].metric!.value : inRange.length > 1 ? values[0] : undefined;
  if (base === undefined) return { values, current };
  const change = current - base;
  const pct = base !== 0 ? (change / Math.abs(base)) * 100 : undefined;
  return { values, current, baseline: base, change, pct };
}

/**
 * Pinned lifts: your choice, or by default your 6 most frequent exercises.
 * Only sessions that produce a trend number count (a lateral raise done for 15s
 * has no est. 1RM), so the default list is lifts that can actually show progress.
 */
export function defaultPinned(
  history: HistoryIndex,
  isLive: (id: string) => boolean,
  typeOf: (id: string) => ExerciseType | undefined = () => 'weight',
  formula: OneRmFormula = 'epley',
  n = 6,
): string[] {
  return [...history.sessionsByExercise.entries()]
    .filter(([id]) => isLive(id))
    .map(([id, sessions]) => {
      const type = typeOf(id) ?? 'weight';
      const counted = sessions.filter((s) => sessionMetric(s.sets, type, formula));
      return { id, count: counted.length, last: Math.max(0, ...counted.map((s) => s.date)) };
    })
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count || b.last - a.last)
    .slice(0, n)
    .map((x) => x.id);
}

/** Progress shows data once any exercise has two sessions (7.6). */
export function hasEnoughForProgress(history: HistoryIndex): boolean {
  for (const s of history.sessionsByExercise.values()) if (s.length >= 2) return true;
  return false;
}
