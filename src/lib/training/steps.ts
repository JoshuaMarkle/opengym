// How big is one move? (training-logic §5). The step comes from the equipment, then is learned from the log.

import type { Equipment, ExerciseType, Units } from '../../db/types';
import { LB_PER_KG } from '../units';
import { BREAK_DAYS, COMEBACK_PCT, LONG_BREAK_DAYS, LONG_COMEBACK_PCT, RAMP_SESSIONS } from './constants';
import { round2, roundTo } from './math';

const kg = (n: number) => n * LB_PER_KG;

/**
 * Default step in lb. Barbell: the weight step setting. Dumbbells: the next pair (5 lb / 2 kg).
 * Machines and cables: 10 lb / 5 kg until learned. BW + added: 5 lb / 2.5 kg. Assisted: 10 lb / 5 kg.
 */
export function defaultStep(equipment: Equipment, type: ExerciseType, settingsStepLb: number, units: Units): number {
  const metric = units === 'kg';
  if (type === 'bodyweight_plus') return metric ? kg(2.5) : 5;
  if (type === 'assisted') return metric ? kg(5) : 10;
  if (equipment === 'barbell') return settingsStepLb;
  if (equipment === 'dumbbell') return metric ? kg(2) : 5;
  return metric ? kg(5) : 10;
}

/**
 * After 4+ sessions, the most common positive difference between consecutive working
 * weights, if it appears at least twice (90, 100, 100, 110 → 10).
 */
export function learnedStep(weights: number[]): number | undefined {
  if (weights.length < 4) return undefined;
  const counts = new Map<number, number>();
  for (let i = 1; i < weights.length; i++) {
    const d = round2(weights[i] - weights[i - 1]);
    if (d > 0.01) counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  let best: number | undefined;
  let n = 1;
  for (const [d, c] of counts) if (c > n || (c === n && best !== undefined && d < best)) [best, n] = [d, c];
  return n >= 2 ? best : undefined;
}

export function stepFor(equipment: Equipment, type: ExerciseType, settingsStepLb: number, units: Units, history: number[] = []): number {
  return learnedStep(history) ?? defaultStep(equipment, type, settingsStepLb, units);
}

/**
 * Coming back after a break (§11): 90% of the last working weight (80% after 42+ days),
 * rounded down to the step, then a linear ramp back over 3 sessions. Under 21 days: null.
 * Returns the weights for session 1 → 4.
 */
export function comeback(lastWeight: number, days: number, step: number): number[] | null {
  let p: number;
  if (days >= LONG_BREAK_DAYS) p = LONG_COMEBACK_PCT;
  else if (days >= BREAK_DAYS) p = COMEBACK_PCT;
  else return null;
  const start = roundTo(lastWeight * p, step, 'down');
  return Array.from({ length: RAMP_SESSIONS + 1 }, (_, i) => roundTo(start + (lastWeight - start) * (i / RAMP_SESSIONS), step));
}

export const comebackPct = (days: number) => (days >= LONG_BREAK_DAYS ? LONG_COMEBACK_PCT : COMEBACK_PCT);
