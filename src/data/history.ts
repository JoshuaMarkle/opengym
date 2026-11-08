import { db } from '../db/db';
import type { ExerciseType, Workout, WorkoutExercise, WorkoutSet } from '../db/types';
import { cardioTotals } from '../lib/cardio';
import type { CardioSession } from '../lib/cardioStats';
import { orderSets } from '../lib/sets';

export interface HistoryExercise {
  we: WorkoutExercise;
  sets: WorkoutSet[]; // display order
}

export interface HistoryWorkout {
  workout: Workout;
  exercises: HistoryExercise[]; // workout order
  setCount: number; // logged sets incl. warm-ups and drops
}

/** One exercise in one finished workout. */
export interface HistorySession {
  workoutId: string;
  workoutName: string;
  routineId?: string;
  date: number;
  exerciseId: string;
  sets: WorkoutSet[];
}

export interface HistoryIndex {
  /** Finished workouts, newest first. */
  workouts: HistoryWorkout[];
  byId: Map<string, HistoryWorkout>;
  /** Per exercise, newest first. Two entries of one exercise in a workout are merged. */
  sessionsByExercise: Map<string, HistorySession[]>;
  lastDoneByRoutine: Map<string, number>;
  firstDate?: number;
}

/** Load every finished workout into an in-memory index for History, Progress and look-backs. */
export async function buildHistory(): Promise<HistoryIndex> {
  const workouts = await db.workouts.where('status').equals('done').toArray();
  workouts.sort((a, b) => b.startedAt - a.startedAt);
  const ids = workouts.map((w) => w.id);
  const wes = ids.length ? await db.workoutExercises.where('workoutId').anyOf(ids).toArray() : [];
  const weIds = wes.map((w) => w.id);
  const sets = weIds.length ? await db.workoutSets.where('workoutExerciseId').anyOf(weIds).toArray() : [];
  return indexHistory(workouts, wes, sets);
}

export function indexHistory(workouts: Workout[], wes: WorkoutExercise[], sets: WorkoutSet[]): HistoryIndex {
  const setsByWe = new Map<string, WorkoutSet[]>();
  for (const s of sets) {
    if (!s.completed) continue;
    const list = setsByWe.get(s.workoutExerciseId) ?? [];
    list.push(s);
    setsByWe.set(s.workoutExerciseId, list);
  }
  const wesByWorkout = new Map<string, WorkoutExercise[]>();
  for (const we of wes) {
    const list = wesByWorkout.get(we.workoutId) ?? [];
    list.push(we);
    wesByWorkout.set(we.workoutId, list);
  }

  const sorted = [...workouts].sort((a, b) => b.startedAt - a.startedAt);
  const out: HistoryWorkout[] = [];
  const byId = new Map<string, HistoryWorkout>();
  const sessionsByExercise = new Map<string, HistorySession[]>();
  const lastDoneByRoutine = new Map<string, number>();

  for (const workout of sorted) {
    const exercises = (wesByWorkout.get(workout.id) ?? [])
      .sort((a, b) => a.order - b.order)
      .map((we) => ({ we, sets: orderSets(setsByWe.get(we.id) ?? []) }))
      .filter((e) => e.sets.length);
    const hw: HistoryWorkout = { workout, exercises, setCount: exercises.reduce((n, e) => n + e.sets.length, 0) };
    out.push(hw);
    byId.set(workout.id, hw);
    if (workout.routineId && !lastDoneByRoutine.has(workout.routineId)) lastDoneByRoutine.set(workout.routineId, workout.startedAt);

    const merged = new Map<string, WorkoutSet[]>();
    for (const e of exercises) merged.set(e.we.exerciseId, [...(merged.get(e.we.exerciseId) ?? []), ...e.sets]);
    for (const [exerciseId, s] of merged) {
      const list = sessionsByExercise.get(exerciseId) ?? [];
      list.push({ workoutId: workout.id, workoutName: workout.name, routineId: workout.routineId, date: workout.startedAt, exerciseId, sets: s });
      sessionsByExercise.set(exerciseId, list);
    }
  }
  return {
    workouts: out,
    byId,
    sessionsByExercise,
    lastDoneByRoutine,
    firstDate: sorted.length ? sorted[sorted.length - 1].startedAt : undefined,
  };
}

/** The most recent finished session of an exercise before `before` (default: any). */
export function lastSession(history: HistoryIndex, exerciseId: string, before?: number): HistorySession | undefined {
  const list = history.sessionsByExercise.get(exerciseId);
  if (!list) return undefined;
  return before === undefined ? list[0] : list.find((s) => s.date < before);
}

/** Lift sets and cardio totals of one workout (Summary, Workout detail, History rows). */
export function workoutTotals(hw: HistoryWorkout, typeOf: (exerciseId: string) => ExerciseType | undefined) {
  let liftSets = 0;
  let cardioSec = 0;
  let cardioMeters: number | undefined;
  let cardioCount = 0;
  for (const e of hw.exercises) {
    if (typeOf(e.we.exerciseId) === 'cardio') {
      const t = cardioTotals(e.sets);
      cardioSec += t.durationSec;
      if (t.distance != null) cardioMeters = (cardioMeters ?? 0) + t.distance;
      cardioCount++;
    } else liftSets += e.sets.length;
  }
  return { liftSets, cardioSec, cardioMeters, cardioCount, liftCount: hw.exercises.length - cardioCount };
}

/** "4 exercises · 14 sets · 20 min cardio" for list rows. */
export function workoutLine(hw: HistoryWorkout, typeOf: (exerciseId: string) => ExerciseType | undefined, withExercises = true): string {
  const t = workoutTotals(hw, typeOf);
  const parts: string[] = [];
  if (withExercises) parts.push(`${hw.exercises.length} ${hw.exercises.length === 1 ? 'exercise' : 'exercises'}`);
  if (t.liftCount || !t.cardioCount) parts.push(`${t.liftSets} ${t.liftSets === 1 ? 'set' : 'sets'}`);
  if (t.cardioCount) parts.push(`${Math.round(t.cardioSec / 60)} min cardio`);
  return parts.join(' · ');
}

/** Every finished cardio session, newest first (Progress → Cardio). */
export function cardioSessions(history: HistoryIndex, isCardio: (exerciseId: string) => boolean, only?: (exerciseId: string) => boolean): CardioSession[] {
  const out: CardioSession[] = [];
  for (const [exerciseId, list] of history.sessionsByExercise) {
    if (!isCardio(exerciseId) || (only && !only(exerciseId))) continue;
    for (const s of list) out.push({ workoutId: s.workoutId, exerciseId, date: s.date, sets: s.sets });
  }
  return out.sort((a, b) => b.date - a.date);
}
