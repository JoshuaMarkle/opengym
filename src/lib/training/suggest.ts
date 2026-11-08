// One exercise's suggestion for today, from its last session (training-logic §7, §10, §20).
// Wraps decide() with what the workout screen needs: exercise types, missing rep ranges,
// more or fewer sets than last time, the training phase, and a one-line reason.

import type { ExerciseType } from '../../db/types';
import { decide, type Decision, type Move, type RepRange, type Target, type TSet } from './decide';
import { median, round2 } from './math';

export type PhaseKind = 'build' | 'maintain' | 'return';

/** How a suggestion was made: the fit zone, simple steps (BW + added, assisted), rep hints only. */
export type SuggestMode = 'fit' | 'steps' | 'reps';

export interface Suggestion {
  mode: SuggestMode;
  /** Next weight per today's working set (lb). undefined = no weight suggestion (bodyweight, rep hints). */
  weights: (number | undefined)[];
  /** Last time's set at the same position. */
  last: (TSet | undefined)[];
  moves: Move[];
  /** Expected reps at a new weight, or a +1 rep hint where the weight stays. */
  aims: (number | null)[];
  ranges: (RepRange | undefined)[];
  /** Any weight changes → the bar shows. */
  changed: boolean;
  /** Set 1's move: the bar is green for up / keep and orange for down. */
  lead: Move;
  reason: string;
  /** The fit-zone decision behind it (Why sheet). */
  decision?: Decision;
  bigStep: boolean;
}

export interface SuggestInput {
  type: ExerciseType;
  /** Last session's completed working sets, in order. */
  last: TSet[];
  /** Today's working sets: their rep range (from the routine, or last time's), in order. */
  ranges: (RepRange | undefined)[];
  /** A range inferred from history when the routine has none (§10). */
  inferred?: RepRange;
  step: number;
  target: Target;
  lastSetOnly: boolean;
  phase?: PhaseKind;
}

/** §10: no rep range → median set-1 reps of the last 5 sessions ± 1, once there are 3. */
export function inferRange(set1Reps: number[]): RepRange | undefined {
  const xs = set1Reps.slice(0, 5);
  if (xs.length < 3) return undefined;
  const m = Math.round(median(xs));
  return { min: Math.max(1, m - 1), max: m + 1 };
}

export function suggest(input: SuggestInput): Suggestion | null {
  const { type, last, step, target, lastSetOnly, phase = 'build' } = input;
  const n = input.ranges.length;
  if (!last.length || !n) return null;
  // Line today's sets up with last time's: extra sets copy the last set, fewer ignore the rest.
  const lastFor = (i: number) => last[Math.min(i, last.length - 1)];
  const ranges = input.ranges.map((r) => r ?? input.inferred);
  const known = Math.min(n, last.length);

  let weights: (number | undefined)[];
  let aims: (number | null)[];
  let mode: SuggestMode;
  let decision: Decision | undefined;
  let bigStep = false;

  const allRanged = ranges.slice(0, known).every(Boolean);
  if (type === 'bodyweight' || !allRanged) {
    // Rep hints only: last + 1 on sets with reps in reserve, or on every set when all were at the top.
    mode = 'reps';
    const sets = Array.from({ length: n }, (_, i) => lastFor(i));
    const allTop = sets.every((s, i) => ranges[i] && s.reps >= ranges[i]!.max);
    weights = sets.map(() => undefined);
    aims = sets.map((s, i) => {
      const r = ranges[i];
      if (allTop || (s.rir != null && s.rir >= 1)) return r && type !== 'bodyweight' ? Math.min(r.max, s.reps + 1) : s.reps + 1;
      if (r && s.reps < r.min) return Math.min(r.min, s.reps + 1);
      return null;
    });
  } else if (type === 'weight') {
    mode = 'fit';
    const sets = last.slice(0, known);
    decision = decide(sets, ranges.slice(0, known) as RepRange[], step, target, lastSetOnly);
    bigStep = decision.fits.some((f, i) => f.flag === 'big step' && decision!.out[i].move === 'up');
    weights = Array.from({ length: n }, (_, i) => decision!.out[Math.min(i, known - 1)].weight);
    aims = Array.from({ length: n }, (_, i) => decision!.out[Math.min(i, known - 1)].aim);
  } else {
    // BW + added and assisted: one step at a time on the added (or negative assist) weight.
    mode = 'steps';
    const [tl, th] = target;
    weights = [];
    aims = [];
    for (let i = 0; i < n; i++) {
      const s = lastFor(i);
      const r = ranges[i]!;
      const rir = s.rir ?? 0;
      let w = s.weight;
      let aim: number | null = null;
      if (s.reps >= r.max && rir <= th) w = s.weight + step;
      else if (s.reps < r.min && rir <= th) w = s.weight - step;
      else if (s.reps < r.max && (s.rir == null || rir > tl)) aim = Math.min(r.max, s.reps + 1);
      if (type === 'bodyweight_plus') w = Math.max(0, w);
      if (type === 'assisted') w = Math.min(0, w);
      if (i > 0) w = Math.min(w, weights[i - 1]!);
      w = round2(w);
      if (w !== s.weight) aim = null;
      weights.push(w);
      aims.push(aim);
    }
  }

  // Maintaining (§20): topped-out sets keep their weight instead of going up.
  if (phase === 'maintain' && mode !== 'reps') {
    weights = weights.map((w, i) => {
      const prev = lastFor(i).weight;
      if (w != null && w > prev) {
        aims[i] = null;
        return prev;
      }
      return w;
    });
  }

  const moves: Move[] = weights.map((w, i) => {
    const prev = lastFor(i).weight;
    if (w == null) return 'keep';
    return w > prev + 1e-9 ? 'up' : w < prev - 1e-9 ? 'down' : 'keep';
  });
  const changed = moves.some((m) => m !== 'keep');
  return {
    mode,
    weights,
    last: Array.from({ length: n }, (_, i) => last[i] ?? lastFor(i)),
    moves,
    aims,
    ranges,
    changed,
    lead: moves[0],
    reason: reasonLine(Array.from({ length: n }, (_, i) => lastFor(i)), ranges, target),
    decision,
    bigStep,
  };
}

const rangeText = (r: RepRange) => (r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`);

/**
 * The one line under the bar: what last time's sets did against the range
 * ("set 1 past 12, set 3 under 8", "all 3 sets at the top of 6–8").
 */
export function reasonLine(sets: TSet[], ranges: (RepRange | undefined)[], target: Target): string {
  const labels = sets.map((s, i) => {
    const r = ranges[i];
    if (!r) return null;
    if (s.reps > r.max) return { k: 'past', text: `past ${r.max}` };
    if (s.reps < r.min) return { k: 'under', text: `under ${r.min}` };
    if (s.rir != null && s.rir > target[1]) return { k: 'easy', text: `${s.rir >= 5 ? '5+' : round2(s.rir)} reps left` };
    if (s.reps === r.max) return { k: 'top', text: `at ${r.max}` };
    return { k: 'in', text: 'in range' };
  });
  if (labels.every((l) => !l)) return 'beat last time by a rep';
  const n = sets.length;
  const first = labels[0];
  if (n > 1 && first && labels.every((l) => l?.k === first.k)) {
    const r = ranges[0]!;
    if (first.k === 'top') return `all ${n} sets at the top of ${rangeText(r)}`;
    if (first.k === 'in') return `all ${n} sets in ${rangeText(r)}`;
    if (first.k === 'easy') return `all ${n} sets with reps left`;
    return `all ${n} sets ${first.text}`;
  }
  const parts: string[] = [];
  labels.forEach((l, i) => {
    if (!l) return;
    if (l.k === 'in') return;
    parts.push(`set ${i + 1} ${l.text}`);
  });
  if (!parts.length) return `every set in ${ranges[0] ? rangeText(ranges[0]) : 'range'}`;
  return parts.slice(0, 2).join(', ');
}
