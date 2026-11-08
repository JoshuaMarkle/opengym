import type { ExerciseType, OneRmFormula } from '../db/types';
import { effortReps } from './effort';
import type { LoggedSet } from './sets';

/** Sets above this rep count don't feed the 1RM estimate or the rep records. */
export const MAX_REPS_FOR_1RM = 12;

/**
 * Estimated one-rep max. Epley: w × (1 + reps/30). Brzycki: w × 36 / (37 − reps).
 * A single is its own 1RM.
 */
export function estimate1RM(weight: number, reps: number, formula: OneRmFormula = 'epley'): number {
  if (!(weight > 0) || !(reps > 0)) return 0;
  if (reps === 1) return weight;
  if (formula === 'brzycki') return reps >= 37 ? weight * 36 : (weight * 36) / (37 - reps);
  return weight * (1 + reps / 30);
}

export interface SessionPoint {
  /** The number charted for this session (lb for weight metrics, reps for bodyweight). */
  value: number;
  weight?: number;
  reps: number;
}

const completedWorking = (sets: LoggedSet[]) =>
  sets.filter((s) => s.kind === 'working' && s.completed !== false && (s.reps ?? 0) > 0);

/**
 * The progress metric for one session (SPEC §4):
 * - weight: est. 1RM of the best working set (no warm-ups, no drops, ≤ 12 reps).
 *   With `effort`, rated sets count their reps in reserve (SPEC §12): 185 × 8 @8 → 10 reps.
 * - bodyweight: most reps in a working set
 * - bodyweight + added: the heaviest added weight
 * - assisted: the least assistance (weights are negative, so the max)
 */
export function sessionMetric(sets: LoggedSet[], type: ExerciseType, formula: OneRmFormula = 'epley', effort = false): SessionPoint | null {
  const work = completedWorking(sets);
  if (!work.length) return null;
  if (type === 'bodyweight') {
    const best = work.reduce((a, b) => ((b.reps ?? 0) > (a.reps ?? 0) ? b : a));
    return { value: best.reps ?? 0, weight: best.weight, reps: best.reps ?? 0 };
  }
  if (type === 'bodyweight_plus' || type === 'assisted') {
    const best = work.reduce((a, b) => {
      const wa = a.weight ?? 0;
      const wb = b.weight ?? 0;
      return wb > wa || (wb === wa && (b.reps ?? 0) > (a.reps ?? 0)) ? b : a;
    });
    return { value: best.weight ?? 0, weight: best.weight ?? 0, reps: best.reps ?? 0 };
  }
  let best: SessionPoint | null = null;
  for (const s of work) {
    if ((s.reps ?? 0) > MAX_REPS_FOR_1RM || !((s.weight ?? 0) > 0)) continue;
    const v = estimate1RM(s.weight!, effort ? effortReps(s.reps!, s.rpe) : s.reps!, formula);
    if (!best || v > best.value || (v === best.value && s.weight! > (best.weight ?? 0))) {
      best = { value: v, weight: s.weight, reps: s.reps! };
    }
  }
  return best;
}

/** The heaviest working set of a session (ties → more reps). For bodyweight, the most reps. */
export function topSet(sets: LoggedSet[], type: ExerciseType): { weight?: number; reps: number } | null {
  const work = completedWorking(sets);
  if (!work.length) return null;
  if (type === 'bodyweight') {
    const best = work.reduce((a, b) => ((b.reps ?? 0) > (a.reps ?? 0) ? b : a));
    return { weight: best.weight, reps: best.reps ?? 0 };
  }
  const best = work.reduce((a, b) => {
    const wa = a.weight ?? 0;
    const wb = b.weight ?? 0;
    return wb > wa || (wb === wa && (b.reps ?? 0) > (a.reps ?? 0)) ? b : a;
  });
  return { weight: best.weight, reps: best.reps ?? 0 };
}

/**
 * Score used to compare two sets of the same exercise ("did I get stronger?").
 * Weight: est. 1RM (any rep count). Bodyweight: reps. BW+/assisted: weight, then reps.
 */
export function setScore(s: { weight?: number; reps?: number }, type: ExerciseType, formula: OneRmFormula = 'epley'): number {
  const w = s.weight ?? 0;
  const r = s.reps ?? 0;
  if (type === 'bodyweight') return r;
  if (type === 'weight') return w > 0 ? estimate1RM(w, r, formula) : r / 1000;
  return w * 1000 + r;
}

/** The best working set of a session by setScore. */
export function bestSet<T extends LoggedSet>(sets: T[], type: ExerciseType, formula: OneRmFormula = 'epley'): T | null {
  const work = sets.filter((s) => s.kind === 'working' && s.completed !== false && (s.reps ?? 0) > 0) as T[];
  if (!work.length) return null;
  return work.reduce((a, b) => (setScore(b, type, formula) > setScore(a, type, formula) ? b : a));
}
