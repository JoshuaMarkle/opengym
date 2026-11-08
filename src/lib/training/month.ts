// Month in review (proposal B3): counts, one best moment, every lift against last month.

import type { TSet } from './decide';
import { e1 } from './math';
import { MAX_EFFORT_REPS } from './constants';

export interface MonthLiftInput {
  exerciseId: string;
  /** Oldest first. Weight × reps lifts only. */
  sessions: { date: number; sets: TSet[]; strength?: number }[];
}

export interface MonthLift {
  exerciseId: string;
  now: number;
  before?: number;
  delta?: number;
}

export interface MonthReview {
  workouts: number;
  /** Sessions that set a new best est. 1RM for their lift. */
  records: number;
  liftsUp: number;
  liftsCompared: number;
  best?: { exerciseId: string; weight: number; reps: number; date: number; firstTime: boolean };
  lifts: MonthLift[];
}

const bestE1 = (sets: TSet[]) => Math.max(0, ...sets.filter((s) => s.reps + (s.rir ?? 0) <= MAX_EFFORT_REPS).map((s) => e1(s.weight, s.reps, s.rir ?? 0)));

/** [from, to) is the month; [prevFrom, from) the month before. */
export function monthReview(workoutDates: number[], lifts: MonthLiftInput[], prevFrom: number, from: number, to: number): MonthReview {
  const inMonth = (d: number) => d >= from && d < to;
  let records = 0;
  let best: MonthReview['best'];
  let bestScore = -Infinity;
  const rows: MonthLift[] = [];
  for (const lift of lifts) {
    let prior = 0;
    const earlier: TSet[] = [];
    let now: number | undefined;
    let before: number | undefined;
    for (const s of lift.sessions) {
      if (s.date >= to) break;
      const e = bestE1(s.sets);
      const str = s.strength ?? e;
      if (inMonth(s.date)) {
        now = Math.max(now ?? -Infinity, str);
        if (e > prior && prior > 0) {
          records++;
          const top = s.sets.reduce((a, b) => (e1(b.weight, b.reps, b.rir ?? 0) > e1(a.weight, a.reps, a.rir ?? 0) ? b : a));
          const firstTime = !earlier.some((x) => x.weight >= top.weight && x.reps >= top.reps);
          const score = (e - prior) / prior + (firstTime ? 1 : 0) + top.weight / 1e4;
          if (score > bestScore) {
            bestScore = score;
            best = { exerciseId: lift.exerciseId, weight: top.weight, reps: top.reps, date: s.date, firstTime };
          }
        }
      } else if (s.date >= prevFrom && s.date < from) before = Math.max(before ?? -Infinity, str);
      prior = Math.max(prior, e);
      earlier.push(...s.sets);
    }
    if (now !== undefined) rows.push({ exerciseId: lift.exerciseId, now, before, delta: before !== undefined ? now - before : undefined });
  }
  const compared = rows.filter((r) => r.delta !== undefined);
  return {
    workouts: workoutDates.filter(inMonth).length,
    records,
    liftsUp: compared.filter((r) => r.delta! >= 1).length,
    liftsCompared: compared.length,
    best,
    lifts: rows.sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0)),
  };
}
