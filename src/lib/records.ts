import type { ExerciseType, OneRmFormula } from '../db/types';
import { DAY_MS } from './dates';
import { effortReps } from './effort';
import { estimate1RM, MAX_REPS_FOR_1RM } from './oneRm';
import type { LoggedSet } from './sets';

export interface SessionInput<S extends LoggedSet = LoggedSet> {
  workoutId: string;
  date: number;
  sets: S[];
}

export interface RecordEntry {
  weight: number;
  reps: number;
  date: number;
  workoutId: string;
  setId: string;
}

export interface ExerciseRecords {
  /** Best weight for each rep count 1…12 (working sets only). */
  byReps: Map<number, RecordEntry>;
  bestE1rm?: RecordEntry & { value: number };
  heaviest?: RecordEntry;
  mostReps?: RecordEntry;
}

export const RECORD_NEW_DAYS = 30;

/** "New" means set in the last 30 days. */
export function isRecent(date: number, now = Date.now()): boolean {
  return now - date <= RECORD_NEW_DAYS * DAY_MS;
}

const workingSets = (sets: LoggedSet[]) =>
  sets.filter((s) => s.kind === 'working' && s.completed !== false && (s.reps ?? 0) > 0);

/**
 * Records (SPEC §4): best weight for each rep count from 1 to 12 (working sets
 * only), the best est. 1RM, and the heaviest single set. An equal lift later
 * doesn't replace the first time it was done.
 */
export function computeRecords(sessions: SessionInput[], type: ExerciseType, formula: OneRmFormula = 'epley', effort = false): ExerciseRecords {
  const rec: ExerciseRecords = { byReps: new Map() };
  const chronological = [...sessions].sort((a, b) => a.date - b.date);
  for (const session of chronological) {
    for (const s of workingSets(session.sets)) {
      const weight = s.weight ?? 0;
      const reps = s.reps!;
      const entry: RecordEntry = { weight, reps, date: session.date, workoutId: session.workoutId, setId: s.id };
      if (!rec.mostReps || reps > rec.mostReps.reps) rec.mostReps = entry;
      if (type === 'bodyweight') continue;
      if (reps <= MAX_REPS_FOR_1RM) {
        const cur = rec.byReps.get(reps);
        if (!cur || weight > cur.weight) rec.byReps.set(reps, entry);
      }
      if (!rec.heaviest || weight > rec.heaviest.weight || (weight === rec.heaviest.weight && reps > rec.heaviest.reps)) {
        rec.heaviest = entry;
      }
      if (type === 'weight' && weight > 0 && reps <= MAX_REPS_FOR_1RM) {
        const value = estimate1RM(weight, effort ? effortReps(reps, s.rpe) : reps, formula);
        if (!rec.bestE1rm || value > rec.bestE1rm.value) rec.bestE1rm = { ...entry, value };
      }
    }
  }
  return rec;
}

/**
 * Which sets were records when they were lifted: they beat the best weight
 * for their rep count, the best est. 1RM, or (bodyweight) the most reps.
 * The very first session of an exercise sets a baseline and earns none.
 * Only the best qualifying set per rep count per session is flagged.
 */
export function recordSetIds(sessions: SessionInput[], type: ExerciseType, formula: OneRmFormula = 'epley', effort = false): Set<string> {
  const flagged = new Set<string>();
  const chronological = [...sessions].sort((a, b) => a.date - b.date);
  const bestByReps = new Map<number, number>();
  let bestE1 = 0;
  let mostReps = 0;
  let seen = false;
  for (const session of chronological) {
    const sets = workingSets(session.sets);
    if (!sets.length) continue;
    // Candidates within this session, compared against history before it.
    const sessionBestByReps = new Map<number, { w: number; id: string }>();
    let sessionE1: { v: number; id: string } | undefined;
    let sessionReps: { r: number; id: string } | undefined;
    for (const s of sets) {
      const w = s.weight ?? 0;
      const r = s.reps!;
      if (!sessionReps || r > sessionReps.r) sessionReps = { r, id: s.id };
      if (type === 'bodyweight') continue;
      if (r <= MAX_REPS_FOR_1RM) {
        const c = sessionBestByReps.get(r);
        if (!c || w > c.w) sessionBestByReps.set(r, { w, id: s.id });
        if (type === 'weight' && w > 0) {
          const v = estimate1RM(w, effort ? effortReps(r, s.rpe) : r, formula);
          if (!sessionE1 || v > sessionE1.v) sessionE1 = { v, id: s.id };
        }
      }
    }
    if (seen) {
      if (type === 'bodyweight') {
        if (sessionReps && sessionReps.r > mostReps) flagged.add(sessionReps.id);
      } else {
        for (const [r, c] of sessionBestByReps) {
          const prior = bestByReps.get(r);
          if (prior === undefined || c.w > prior) flagged.add(c.id);
        }
        if (sessionE1 && sessionE1.v > bestE1) flagged.add(sessionE1.id);
      }
    }
    for (const [r, c] of sessionBestByReps) bestByReps.set(r, Math.max(bestByReps.get(r) ?? -Infinity, c.w));
    if (sessionE1) bestE1 = Math.max(bestE1, sessionE1.v);
    if (sessionReps) mostReps = Math.max(mostReps, sessionReps.r);
    seen = true;
  }
  return flagged;
}
