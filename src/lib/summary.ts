import type { ExerciseType, OneRmFormula, Units } from '../db/types';
import { bestSet, setScore } from './oneRm';
import { formatSet, type LoggedSet } from './sets';
import { formatNumber, toDisplay, unitLabel } from './units';

export interface Comparison {
  direction: 'up' | 'down' | 'same' | 'new';
  /** "185 × 8 vs 180 × 8" */
  detail: string;
  /** "+5 lb", "+1 rep", "same", "new" */
  label: string;
}

/** Summary (5.3): this workout's best set vs the best set last time. */
export function compareBest(
  current: LoggedSet[],
  previous: LoggedSet[] | undefined,
  type: ExerciseType,
  units: Units,
  formula: OneRmFormula = 'epley',
): Comparison | null {
  const cur = bestSet(current, type, formula);
  if (!cur) return null;
  const prev = previous ? bestSet(previous, type, formula) : null;
  if (!prev) return { direction: 'new', detail: formatSet(cur, type, units), label: 'new' };
  const detail = `${formatSet(cur, type, units)} vs ${formatSet(prev, type, units)}`;
  const a = setScore(cur, type, formula);
  const b = setScore(prev, type, formula);
  const eps = 1e-6;
  const direction = a > b + eps ? 'up' : a < b - eps ? 'down' : 'same';

  const dw = toDisplay((cur.weight ?? 0) - (prev.weight ?? 0), units);
  const dr = (cur.reps ?? 0) - (prev.reps ?? 0);
  // One short pill: the change that explains the direction. Weight first; reps
  // when the weight moved the other way (fewer lb but more reps can still be "up").
  const weightChanged = type !== 'bodyweight' && Math.abs(dw) >= 0.01;
  const wText = `${dw > 0 ? '+' : '−'}${formatNumber(Math.abs(dw), 2)} ${unitLabel(units)}`;
  const rText = `${dr > 0 ? '+' : '−'}${Math.abs(dr)} ${Math.abs(dr) === 1 ? 'rep' : 'reps'}`;
  const sign = direction === 'up' ? 1 : direction === 'down' ? -1 : 0;
  let label = 'same';
  if (weightChanged && (sign === 0 || Math.sign(dw) === sign || dr === 0)) label = wText;
  else if (dr !== 0) label = rText;
  else if (weightChanged) label = wText;
  return { direction: label === 'same' ? 'same' : direction, detail, label };
}
