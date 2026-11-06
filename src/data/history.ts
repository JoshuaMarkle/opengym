import { db } from '../db/db';
import type { Workout, WorkoutExercise, WorkoutSet } from '../db/types';
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
