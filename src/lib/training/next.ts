// The NEXT half of the Previous column (4.27): what each working set should hit today.

import type { Move } from './decide';
import type { Suggestion } from './suggest';

export interface NextSet {
  /** lb; undefined where only reps move (bodyweight). */
  weight?: number;
  /** The aim at that weight; undefined when the weight is new and there's no aim yet (comeback ramp). */
  reps?: number;
  move: Move;
}

/**
 * Set i's target: the suggested weight (else last time's) × the aim (else last time's
 * reps where nothing moves). Undefined when there's nothing to show.
 */
export function nextSet(sg: Suggestion, i: number): NextSet | undefined {
  const last = sg.last[i];
  const move = sg.moves[i] ?? 'keep';
  const weight = sg.weights[i] ?? last?.weight;
  const reps = sg.aims[i] ?? (move === 'keep' ? last?.reps : undefined);
  if (weight == null && reps == null) return undefined;
  return { weight, reps, move };
}
