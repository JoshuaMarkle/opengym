// One strength number per session (training-logic §13): the effort-adjusted est. 1RM of set 1.

import type { ExerciseType } from '../../db/types';
import { rirOf } from '../effort';
import { orderSets, type LoggedSet } from '../sets';
import { MAX_EFFORT_REPS, UNKNOWN_RIR } from './constants';
import type { TSet } from './decide';
import { e1 } from './math';

/** A session's completed working sets, in order, as training sets. Bodyweight weight = 0. */
export function workingSets(sets: LoggedSet[]): TSet[] {
  return orderSets(sets)
    .filter((s) => s.kind === 'working' && s.completed !== false && (s.reps ?? 0) > 0)
    .map((s) => ({ weight: s.weight ?? 0, reps: s.reps!, rir: s.rpe != null ? rirOf(s.rpe) : undefined }));
}

/**
 * Set 1's strength: weight × (1 + (reps + RIR)/30). Sets with reps + RIR over 15 are skipped
 * for the next working set that qualifies. Bodyweight: set 1 reps. Assisted: the (negative) weight.
 * BW + added: the added weight's e1RM.
 */
export function sessionStrength(sets: TSet[], type: ExerciseType): number | undefined {
  if (!sets.length) return undefined;
  if (type === 'bodyweight') return sets[0].reps;
  if (type === 'assisted') return sets[0].weight;
  for (const s of sets) {
    const rir = s.rir ?? UNKNOWN_RIR;
    if (s.reps + rir > MAX_EFFORT_REPS) continue;
    return e1(s.weight, s.reps, rir);
  }
  return undefined;
}

/** One point of a lift's strength series. `comeback` sessions are left out of trends (§11). */
export interface StrengthPoint {
  date: number;
  value: number;
  comeback?: boolean;
}
