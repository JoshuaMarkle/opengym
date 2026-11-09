import { db } from '../db/db';
import type { ExerciseType, RoutineExercise, RoutineSet, Workout, WorkoutExercise, WorkoutSet, WorkoutSuggestion } from '../db/types';
import { meetsGoal } from '../lib/training/goals';
import { uuid } from '../lib/id';
import { indexSession } from '../lib/previous';
import {
  nextWorkingSet,
  planDrop,
  prefillFromLastSession,
  prefillFromRoutine,
  type SetDraft,
} from '../lib/prefill';
import { diffRoutine, type RoutineChange, type StructureItem } from '../lib/routineDiff';
import { isEmptySet, orderSets, positionKeys } from '../lib/sets';
import { linkSuperset, moveBlock, normalizeSupersets, unlinkSuperset } from '../lib/supersets';
import type { CardioValues } from '../lib/cardio';
import { getSettings, stepLb } from './settings';

const stamp = () => {
  const t = Date.now();
  return { id: uuid(), createdAt: t, updatedAt: t };
};

export class ActiveWorkoutExistsError extends Error {
  constructor(public workout: Workout) {
    super('A workout is already in progress');
  }
}

export async function getActiveWorkout(): Promise<Workout | undefined> {
  return db.workouts.where('status').equals('active').first();
}

/** Sets from the most recent finished workout that included this exercise. */
export async function lastSessionSets(exerciseId: string, excludeWorkoutId?: string): Promise<WorkoutSet[] | undefined> {
  const wes = await db.workoutExercises.where('exerciseId').equals(exerciseId).toArray();
  if (!wes.length) return undefined;
  const workouts = (await db.workouts.bulkGet([...new Set(wes.map((w) => w.workoutId))])).filter(
    (w): w is Workout => !!w && w.status === 'done' && w.id !== excludeWorkoutId,
  );
  if (!workouts.length) return undefined;
  const latest = workouts.reduce((a, b) => (b.startedAt > a.startedAt ? b : a));
  const ids = wes.filter((w) => w.workoutId === latest.id).map((w) => w.id);
  const sets = await db.workoutSets.where('workoutExerciseId').anyOf(ids).toArray();
  return sets.filter((s) => s.completed);
}

export function blankWorkoutName(ts = Date.now()): string {
  const h = new Date(ts).getHours();
  return h < 5 ? 'Night Workout' : h < 12 ? 'Morning Workout' : h < 17 ? 'Afternoon Workout' : 'Evening Workout';
}

interface NewExercise {
  exerciseId: string;
  sets: SetDraft[];
  supersetGroup?: string;
}

/** A cardio exercise starts with last session's number of segments (or one); values show as grey placeholders. */
async function isCardioExercise(exerciseId: string): Promise<boolean> {
  return (await db.exercises.get(exerciseId))?.type === 'cardio';
}

function setRecords(weId: string, drafts: SetDraft[]): WorkoutSet[] {
  return drafts.map((d, i) => ({
    ...stamp(),
    workoutExerciseId: weId,
    order: i,
    kind: d.kind,
    weight: d.weight,
    reps: d.reps,
    repsMin: d.repsMin,
    repsMax: d.repsMax,
    ...(d.rpeTarget != null ? { rpeTarget: d.rpeTarget } : {}),
    completed: false,
  }));
}

async function createWorkout(name: string, exercises: NewExercise[], routineId?: string, loggedFor?: string): Promise<string> {
  return db.transaction('rw', db.workouts, db.workoutExercises, db.workoutSets, async () => {
    const active = await getActiveWorkout();
    if (active) throw new ActiveWorkoutExistsError(active);
    const workout: Workout = { ...stamp(), name, routineId, loggedFor, startedAt: Date.now(), status: 'active' };
    const grouped = normalizeSupersets(exercises.map((e, i) => ({ key: String(i), supersetGroup: e.supersetGroup })));
    const wes: WorkoutExercise[] = exercises.map((e, i) => ({
      ...stamp(),
      workoutId: workout.id,
      exerciseId: e.exerciseId,
      order: i,
      ...(grouped[i].supersetGroup ? { supersetGroup: grouped[i].supersetGroup } : {}),
    }));
    workout.currentExerciseId = wes[0]?.id;
    await db.workouts.add(workout);
    await db.workoutExercises.bulkAdd(wes);
    await db.workoutSets.bulkAdd(wes.flatMap((we, i) => setRecords(we.id, exercises[i].sets)));
    return workout.id;
  });
}

/** Start a workout from a routine with every set prefilled (SPEC §4 Prefill). */
export async function startFromRoutine(routineId: string, loggedFor?: string): Promise<string> {
  const routine = await db.routines.get(routineId);
  if (!routine) throw new Error('Routine not found');
  const res = (await db.routineExercises.where('routineId').equals(routineId).toArray()).sort((a, b) => a.order - b.order);
  const exercises: NewExercise[] = [];
  for (const re of res) {
    const rsets = (await db.routineSets.where('routineExerciseId').equals(re.id).toArray()).sort((a, b) => a.order - b.order);
    const last = await lastSessionSets(re.exerciseId);
    // Cardio segments start empty: last time's numbers show in grey and ✓ accepts them.
    const sets = (await isCardioExercise(re.exerciseId))
      ? Array.from({ length: Math.max(1, rsets.length) }, () => ({ kind: 'working' as const }))
      : prefillFromRoutine(rsets, last);
    exercises.push({ exerciseId: re.exerciseId, sets, supersetGroup: re.supersetGroup });
  }
  return createWorkout(routine.name, exercises, routine.id, loggedFor);
}

export async function startBlankWorkout(): Promise<string> {
  return createWorkout(blankWorkoutName(), []);
}

/** "Repeat this workout" (6.6): same exercises and set layout, numbers from the latest session. */
export async function repeatWorkout(workoutId: string): Promise<string> {
  const w = await db.workouts.get(workoutId);
  if (!w) throw new Error('Workout not found');
  const wes = (await db.workoutExercises.where('workoutId').equals(workoutId).toArray()).sort((a, b) => a.order - b.order);
  const exercises: NewExercise[] = [];
  for (const we of wes) {
    const sets = orderSets((await db.workoutSets.where('workoutExerciseId').equals(we.id).toArray()).filter((s) => s.kind !== 'drop'));
    const last = await lastSessionSets(we.exerciseId);
    const prev = last ? indexSession(last).byKey : undefined;
    const keys = positionKeys(sets);
    const cardio = await isCardioExercise(we.exerciseId);
    exercises.push({
      exerciseId: we.exerciseId,
      supersetGroup: we.supersetGroup,
      // Cardio boxes start empty: last time's numbers show in grey and ✓ accepts them.
      sets: sets.map((s) => {
        if (cardio) return { kind: 'working' as const };
        const p = prev?.get(keys.get(s.id)!);
        return { kind: s.kind, weight: p?.weight ?? s.weight, reps: p?.reps ?? s.reps, repsMin: s.repsMin, repsMax: s.repsMax, rpeTarget: s.rpeTarget };
      }),
    });
  }
  const routine = w.routineId ? await db.routines.get(w.routineId) : undefined;
  return createWorkout(w.name, exercises, routine && !routine.deletedAt ? routine.id : undefined);
}

// ───────────────────────────── exercises within the active workout

async function workoutExercises(workoutId: string) {
  return (await db.workoutExercises.where('workoutId').equals(workoutId).toArray()).sort((a, b) => a.order - b.order);
}

/** Add exercises to the end, each prefilled from its last session. Returns the new workout-exercise ids. */
export async function addExercisesToWorkout(workoutId: string, exerciseIds: string[]): Promise<string[]> {
  const drafts: NewExercise[] = [];
  for (const id of exerciseIds) {
    const last = await lastSessionSets(id, workoutId);
    const cardio = await isCardioExercise(id);
    drafts.push({ exerciseId: id, sets: cardio ? Array.from({ length: last?.length || 1 }, () => ({ kind: 'working' as const })) : prefillFromLastSession(last) });
  }
  return db.transaction('rw', db.workoutExercises, db.workoutSets, async () => {
    const existing = await workoutExercises(workoutId);
    const start = existing.length ? existing[existing.length - 1].order + 1 : 0;
    const wes = drafts.map((d, i) => ({ ...stamp(), workoutId, exerciseId: d.exerciseId, order: start + i }));
    await db.workoutExercises.bulkAdd(wes);
    await db.workoutSets.bulkAdd(wes.flatMap((we, i) => setRecords(we.id, drafts[i].sets)));
    return wes.map((w) => w.id);
  });
}

/** What removing an exercise took away: enough to put it back exactly (order, superset letters, sets). */
export interface RemovedWorkoutExercise {
  workoutId: string;
  removedId: string;
  /** Every exercise in the workout as it was, the removed one included. */
  before: WorkoutExercise[];
  sets: WorkoutSet[];
  currentExerciseId?: string;
}

export async function removeWorkoutExercise(weId: string): Promise<RemovedWorkoutExercise | null> {
  return db.transaction('rw', db.workouts, db.workoutExercises, db.workoutSets, async () => {
    const we = await db.workoutExercises.get(weId);
    if (!we) return null;
    const before = await workoutExercises(we.workoutId);
    const sets = await db.workoutSets.where('workoutExerciseId').equals(weId).toArray();
    await db.workoutSets.bulkDelete(sets.map((x) => x.id));
    await db.workoutExercises.delete(weId);
    const rest = await writeGrouping(await workoutExercises(we.workoutId));
    const w = await db.workouts.get(we.workoutId);
    if (w?.currentExerciseId === weId) {
      const idx = Math.min(we.order, rest.length - 1);
      await db.workouts.update(w.id, { currentExerciseId: rest[idx]?.id, updatedAt: Date.now() });
    }
    return { workoutId: we.workoutId, removedId: weId, before, sets, currentExerciseId: w?.currentExerciseId };
  });
}

/** Undo for removeWorkoutExercise: the exercise, its sets, and everyone's order and superset letter. */
export async function restoreWorkoutExercise(r: RemovedWorkoutExercise): Promise<void> {
  await db.transaction('rw', db.workouts, db.workoutExercises, db.workoutSets, async () => {
    const w = await db.workouts.get(r.workoutId);
    if (!w || w.status !== 'active') return;
    const now = await workoutExercises(r.workoutId);
    const nowIds = new Set(now.map((x) => x.id));
    const back = r.before.find((x) => x.id === r.removedId);
    if (!back || nowIds.has(back.id)) return;
    const wasIds = new Set(r.before.map((x) => x.id));
    const t = Date.now();
    await db.workoutExercises.put({ ...back, updatedAt: t });
    await db.workoutSets.bulkPut(r.sets);
    // The old order and letters for what's still here; anything added since goes after.
    const order = [...r.before.filter((x) => x.id === back.id || nowIds.has(x.id)), ...now.filter((x) => !wasIds.has(x.id))];
    await Promise.all(order.map((x, i) => db.workoutExercises.update(x.id, { order: i, supersetGroup: x.supersetGroup, updatedAt: t })));
    if (r.currentExerciseId) await db.workouts.update(w.id, { currentExerciseId: r.currentExerciseId, updatedAt: t });
  });
}

/**
 * Write list order and superset letters (normalized) for rows that changed.
 * "Changed" is judged against what's stored, not the list passed in: callers
 * hand over rows whose groups were already edited (link / unlink), and a partner
 * that was already next to the anchor keeps its order but still needs its letter.
 */
async function writeGrouping(list: WorkoutExercise[]): Promise<WorkoutExercise[]> {
  const keyed = normalizeSupersets(list.map((we) => ({ ...we, key: we.id })));
  const stored = new Map((await db.workoutExercises.bulkGet(list.map((we) => we.id))).filter((x): x is WorkoutExercise => !!x).map((x) => [x.id, x]));
  const t = Date.now();
  await Promise.all(
    keyed.map((we, i) => {
      const old = stored.get(we.id);
      if (!old) return undefined;
      if (old.order === i && (old.supersetGroup ?? undefined) === (we.supersetGroup ?? undefined)) return undefined;
      return db.workoutExercises.update(we.id, { order: i, supersetGroup: we.supersetGroup, updatedAt: t });
    }),
  );
  return keyed.map(({ key: _key, ...we }, i) => ({ ...we, order: i }));
}

/** Move an exercise up or down. A superset moves as one block (4.12). */
export async function moveWorkoutExercise(weId: string, delta: -1 | 1): Promise<void> {
  await db.transaction('rw', db.workoutExercises, async () => {
    const we = await db.workoutExercises.get(weId);
    if (!we) return;
    const list = await workoutExercises(we.workoutId);
    const moved = moveBlock(list.map((x) => ({ ...x, key: x.id })), weId, delta);
    await writeGrouping(moved.map((x) => list.find((y) => y.id === x.key)!));
  });
}

/** 2.13 "Superset with…" mid-workout: partners line up after this exercise and share its group. */
export async function linkWorkoutSuperset(weId: string, partnerIds: string[]): Promise<void> {
  await db.transaction('rw', db.workoutExercises, async () => {
    const we = await db.workoutExercises.get(weId);
    if (!we) return;
    const list = await workoutExercises(we.workoutId);
    const linked = linkSuperset(list.map((x) => ({ ...x, key: x.id })), weId, partnerIds);
    await writeGrouping(linked.map(({ key: _key, ...x }) => x));
  });
}

export async function unlinkWorkoutSuperset(weId: string): Promise<void> {
  await db.transaction('rw', db.workoutExercises, async () => {
    const we = await db.workoutExercises.get(weId);
    if (!we) return;
    const list = await workoutExercises(we.workoutId);
    const out = unlinkSuperset(list.map((x) => ({ ...x, key: x.id })), weId);
    await writeGrouping(out.map(({ key: _key, ...x }) => x));
  });
}

/**
 * Swap the exercise (replace / switch variation). If nothing is ticked yet the
 * numbers re-prefill from the new exercise's last session; logged sets stay.
 */
export async function replaceWorkoutExercise(weId: string, exerciseId: string): Promise<void> {
  const we = await db.workoutExercises.get(weId);
  if (!we || we.exerciseId === exerciseId) return;
  const sets = orderSets(await db.workoutSets.where('workoutExerciseId').equals(weId).toArray());
  const anyDone = sets.some((s) => s.completed);
  const last = anyDone ? undefined : await lastSessionSets(exerciseId, we.workoutId);
  await db.transaction('rw', db.workoutExercises, db.workoutSets, async () => {
    const t = Date.now();
    // A different lift: its own suggestion and gap question (training-logic §10, variations).
    await db.workoutExercises.update(weId, { exerciseId, suggestion: undefined, gapAnswer: undefined, updatedAt: t });
    if (anyDone) return;
    const prev = last ? indexSession(last).byKey : undefined;
    const keys = positionKeys(sets);
    for (const s of sets) {
      const p = prev?.get(keys.get(s.id)!);
      await db.workoutSets.update(s.id, { weight: p?.weight, reps: p?.reps, updatedAt: t });
    }
  });
}

export async function setCurrentExercise(workoutId: string, weId: string): Promise<void> {
  await db.workouts.update(workoutId, { currentExerciseId: weId, updatedAt: Date.now() });
}

export async function renameWorkout(workoutId: string, name: string): Promise<void> {
  const n = name.trim();
  if (n) await db.workouts.update(workoutId, { name: n, updatedAt: Date.now() });
}

export async function setWorkoutStart(workoutId: string, startedAt: number): Promise<void> {
  await db.workouts.update(workoutId, { startedAt, updatedAt: Date.now() });
}

export async function discardWorkout(workoutId: string): Promise<void> {
  await deleteWorkout(workoutId);
}

export async function deleteWorkout(workoutId: string): Promise<void> {
  await db.transaction('rw', db.workouts, db.workoutExercises, db.workoutSets, async () => {
    const wes = await db.workoutExercises.where('workoutId').equals(workoutId).toArray();
    await db.workoutSets.where('workoutExerciseId').anyOf(wes.map((w) => w.id)).delete();
    await db.workoutExercises.where('workoutId').equals(workoutId).delete();
    await db.workouts.delete(workoutId);
  });
}

// ───────────────────────────── sets

async function setsOf(weId: string) {
  return orderSets(await db.workoutSets.where('workoutExerciseId').equals(weId).toArray());
}

async function writeOrder(ordered: WorkoutSet[]) {
  const t = Date.now();
  await Promise.all(ordered.map((s, i) => (s.order === i ? undefined : db.workoutSets.update(s.id, { order: i, updatedAt: t }))));
}

export async function updateSet(setId: string, patch: Partial<Pick<WorkoutSet, 'weight' | 'reps' | 'completed' | 'rpe'>> & CardioValues): Promise<void> {
  await db.workoutSets.update(setId, { ...patch, updatedAt: Date.now() });
}

/** "+ Set": append a working set prefilled from last time / the last set. */
export async function addWorkingSet(weId: string): Promise<string> {
  const we = await db.workoutExercises.get(weId);
  if (!we) throw new Error('Exercise not found');
  const last = await lastSessionSets(we.exerciseId, we.workoutId);
  return db.transaction('rw', db.workoutSets, async () => {
    const sets = await setsOf(weId);
    const draft = nextWorkingSet(sets, last);
    const rec: WorkoutSet = { ...stamp(), workoutExerciseId: weId, order: sets.length, ...draft, completed: false };
    await db.workoutSets.add(rec);
    return rec.id;
  });
}

/** "+ Drop": a drop under the last completed set, prefilled lighter (SPEC §4). */
export async function addDropSet(weId: string, type: ExerciseType): Promise<string | undefined> {
  const we = await db.workoutExercises.get(weId);
  if (!we) return undefined;
  const settings = await getSettings();
  const last = await lastSessionSets(we.exerciseId, we.workoutId);
  return db.transaction('rw', db.workoutSets, async () => {
    const sets = await setsOf(weId);
    const plan = planDrop(sets, last, type, settings.dropPercent, stepLb(settings));
    if (!plan) return undefined;
    const rec: WorkoutSet = {
      ...stamp(),
      workoutExerciseId: weId,
      order: 0,
      kind: 'drop',
      parentSetId: plan.parentSetId,
      weight: plan.weight,
      reps: plan.reps,
      completed: false,
    };
    const idx = sets.findIndex((s) => s.id === plan.afterSetId);
    const ordered = [...sets.slice(0, idx + 1), rec, ...sets.slice(idx + 1)];
    rec.order = idx + 1;
    await db.workoutSets.add(rec);
    await writeOrder(ordered);
    return rec.id;
  });
}

/** Swipe right / hold menu: warm-up ↔ working. A new warm-up moves to the top. */
export async function toggleWarmup(setId: string): Promise<void> {
  await db.transaction('rw', db.workoutSets, async () => {
    const s = await db.workoutSets.get(setId);
    if (!s || s.kind === 'drop') return;
    const sets = await setsOf(s.workoutExerciseId);
    const warm = sets.filter((x) => x.kind === 'warmup' && x.id !== setId);
    const rest = sets.filter((x) => x.kind !== 'warmup' && x.id !== setId && !(x.kind === 'drop' && x.parentSetId === setId));
    const drops = sets.filter((x) => x.kind === 'drop' && x.parentSetId === setId);
    const t = Date.now();
    const next: WorkoutSet = { ...s, kind: s.kind === 'warmup' ? 'working' : 'warmup', updatedAt: t };
    await db.workoutSets.put(next);
    // New warm-up: bottom of the warm-ups. Back to working: first working set.
    await writeOrder([...warm, next, ...drops, ...rest]);
  });
}

export async function moveSetToTop(setId: string): Promise<void> {
  await db.transaction('rw', db.workoutSets, async () => {
    const s = await db.workoutSets.get(setId);
    if (!s || s.kind === 'drop') return;
    const sets = await setsOf(s.workoutExerciseId);
    const mine = sets.filter((x) => x.id === setId || (x.kind === 'drop' && x.parentSetId === setId));
    const others = sets.filter((x) => !mine.includes(x));
    const warm = others.filter((x) => x.kind === 'warmup');
    const rest = others.filter((x) => x.kind !== 'warmup');
    await writeOrder(s.kind === 'warmup' ? [...mine, ...warm, ...rest] : [...warm, ...mine, ...rest]);
  });
}

export async function duplicateSet(setId: string): Promise<string | undefined> {
  return db.transaction('rw', db.workoutSets, async () => {
    const s = await db.workoutSets.get(setId);
    if (!s) return undefined;
    const sets = await setsOf(s.workoutExerciseId);
    // A copy is a new set: it keeps the target but not the logged effort.
    const copy: WorkoutSet = { ...s, ...stamp(), completed: false, rpe: undefined };
    // Insert after the set (and after its drops, for a parent set).
    let idx = sets.findIndex((x) => x.id === setId);
    if (s.kind !== 'drop') while (sets[idx + 1]?.kind === 'drop' && sets[idx + 1].parentSetId === setId) idx++;
    const ordered = [...sets.slice(0, idx + 1), copy, ...sets.slice(idx + 1)];
    await db.workoutSets.add({ ...copy, order: idx + 1 });
    await writeOrder(ordered);
    return copy.id;
  });
}

/** Delete a set (and the drops under it). Returns what was removed, for Undo. */
export async function deleteSet(setId: string): Promise<WorkoutSet[]> {
  return db.transaction('rw', db.workoutSets, async () => {
    const s = await db.workoutSets.get(setId);
    if (!s) return [];
    const sets = await setsOf(s.workoutExerciseId);
    const removed = sets.filter((x) => x.id === setId || (x.kind === 'drop' && x.parentSetId === setId));
    await db.workoutSets.bulkDelete(removed.map((x) => x.id));
    return removed;
  });
}

export async function restoreSets(sets: WorkoutSet[]): Promise<void> {
  if (!sets.length) return;
  await db.workoutSets.bulkPut(sets);
}

// ───────────────────────────── finishing

export interface FinishCheck {
  /** Non-empty sets that weren't ticked, as "Cable Fly set 3". */
  unticked: { setId: string; label: string }[];
}

/** 5.1: which sets have numbers but weren't ticked. Empty sets are dropped silently later. */
export async function checkUnticked(workoutId: string, nameOf: (exerciseId: string) => string, isCardio: (exerciseId: string) => boolean = () => false): Promise<FinishCheck> {
  const wes = await workoutExercises(workoutId);
  const unticked: FinishCheck['unticked'] = [];
  for (const we of wes) {
    const sets = await setsOf(we.id);
    let n = 0;
    for (const s of sets) {
      if (s.kind === 'working') n++;
      if (!s.completed && !isEmptySet(s)) {
        const label = s.kind === 'warmup' ? 'warm-up' : s.kind === 'drop' ? 'drop set' : `${isCardio(we.exerciseId) ? 'segment' : 'set'} ${n}`;
        unticked.push({ setId: s.id, label: `${nameOf(we.exerciseId)} ${label}` });
      }
    }
  }
  return { unticked };
}

/** The sets that will be saved: ticked ones, plus unticked non-empty ones when counting them. */
function keptSets(sets: WorkoutSet[], countUnticked: boolean): WorkoutSet[] {
  return sets.filter((s) => s.completed || (countUnticked && !isEmptySet(s)));
}

async function finalStructure(workoutId: string, countUnticked: boolean): Promise<StructureItem[]> {
  const out: (StructureItem & { key: string })[] = [];
  for (const we of await workoutExercises(workoutId)) {
    const kept = keptSets(await setsOf(we.id), countUnticked);
    if (!kept.length) continue;
    out.push({
      key: we.id,
      exerciseId: we.exerciseId,
      warmups: kept.filter((s) => s.kind === 'warmup').length,
      working: kept.filter((s) => s.kind === 'working').length,
      supersetGroup: we.supersetGroup,
    });
  }
  return normalizeSupersets(out);
}

async function routineStructure(routineId: string): Promise<StructureItem[]> {
  const res = (await db.routineExercises.where('routineId').equals(routineId).toArray()).sort((a, b) => a.order - b.order);
  const out: (StructureItem & { key: string })[] = [];
  for (const re of res) {
    const sets = await db.routineSets.where('routineExerciseId').equals(re.id).toArray();
    out.push({
      key: re.id,
      exerciseId: re.exerciseId,
      warmups: sets.filter((s) => s.kind === 'warmup').length,
      working: sets.filter((s) => s.kind === 'working').length,
      supersetGroup: re.supersetGroup,
    });
  }
  return normalizeSupersets(out);
}

/** 5.2: how the finished workout would differ from its routine (exercises, order, set counts). */
export async function routineChanges(workoutId: string, countUnticked: boolean): Promise<RoutineChange[]> {
  const w = await db.workouts.get(workoutId);
  if (!w?.routineId) return [];
  const routine = await db.routines.get(w.routineId);
  if (!routine || routine.deletedAt) return [];
  const exercises = await db.exercises.toArray();
  const group = new Map(exercises.map((e) => [e.id, e.variationGroupId]));
  return diffRoutine(await routineStructure(w.routineId), await finalStructure(workoutId, countUnticked), (id) => group.get(id));
}

/**
 * Save the workout: drop empty sets (and unticked ones unless counting them),
 * remove exercises left with nothing, mark it done. Optionally rewrite the
 * routine's structure from what was actually done.
 */
export async function finishWorkout(workoutId: string, opts: { countUnticked: boolean; updateRoutine: boolean }): Promise<void> {
  await db.transaction('rw', [db.workouts, db.workoutExercises, db.workoutSets, db.routines, db.routineExercises, db.routineSets, db.exercises, db.goals], async () => {
    const w = await db.workouts.get(workoutId);
    if (!w) return;
    const t = Date.now();
    for (const we of await workoutExercises(workoutId)) {
      const sets = await setsOf(we.id);
      const kept = keptSets(sets, opts.countUnticked);
      const keptIds = new Set(kept.map((s) => s.id));
      await db.workoutSets.bulkDelete(sets.filter((s) => !keptIds.has(s.id)).map((s) => s.id));
      for (const s of kept) if (!s.completed) await db.workoutSets.update(s.id, { completed: true, updatedAt: t });
      if (!kept.length) await db.workoutExercises.delete(we.id);
      else await writeOrder(orderSets(kept));
    }
    await writeGrouping(await workoutExercises(workoutId));
    const datedStart = w.loggedFor ? new Date(`${w.loggedFor}T${new Date(w.startedAt).toTimeString().slice(0, 8)}`).getTime() : w.startedAt;
    await db.workouts.update(workoutId, { status: 'done', startedAt: datedStart, endedAt: datedStart + Math.max(0, t - w.startedAt), loggedFor: undefined, currentExerciseId: undefined, updatedAt: t });
    if (opts.updateRoutine && w.routineId) await applyWorkoutToRoutine(workoutId, w.routineId);
    await markGoalsDone(workoutId, t);
  });
}

/** Goals met by a set in this workout are done (training-logic §18): C6 shows after the summary. */
async function markGoalsDone(workoutId: string, t: number): Promise<void> {
  const goals = (await db.goals.toArray()).filter((g) => !g.doneAt && !g.deletedAt);
  if (!goals.length) return;
  for (const we of await workoutExercises(workoutId)) {
    const sets = (await setsOf(we.id)).filter((s) => s.kind === 'working' && s.completed);
    for (const g of goals) {
      if (g.exerciseId !== we.exerciseId || !sets.some((s) => meetsGoal(s, g))) continue;
      await db.goals.update(g.id, { doneAt: t, doneWorkoutId: workoutId, updatedAt: t });
    }
  }
}

// ───────────────────────────── training suggestions (training-logic §9)

/**
 * Fill LBS on unticked working sets with the next weights (Suggest ✓, or Auto) and
 * remember what was there for Undo / Ignore. Reps are never touched.
 */
export async function applySuggestion(weId: string, weights: Record<string, number>, record: Omit<WorkoutSuggestion, 'prev'>): Promise<void> {
  await db.transaction('rw', db.workoutExercises, db.workoutSets, async () => {
    const t = Date.now();
    const prev: Record<string, number | null> = {};
    for (const [setId, w] of Object.entries(weights)) {
      const s = await db.workoutSets.get(setId);
      if (!s || s.completed) continue;
      prev[setId] = s.weight ?? null;
      await db.workoutSets.update(setId, { weight: w, updatedAt: t });
    }
    await db.workoutExercises.update(weId, { suggestion: { ...record, prev }, updatedAt: t });
  });
}

/** Undo after ✓ (or Ignore in Auto): put back the earlier LBS on sets still unticked. */
export async function revertSuggestion(weId: string, outcome?: WorkoutSuggestion['outcome']): Promise<void> {
  await db.transaction('rw', db.workoutExercises, db.workoutSets, async () => {
    const we = await db.workoutExercises.get(weId);
    const sg = we?.suggestion;
    if (!we || !sg) return;
    const t = Date.now();
    for (const [setId, w] of Object.entries(sg.prev ?? {})) {
      const s = await db.workoutSets.get(setId);
      if (s && !s.completed) await db.workoutSets.update(setId, { weight: w ?? undefined, updatedAt: t });
    }
    await db.workoutExercises.update(weId, { suggestion: { weights: sg.weights, auto: sg.auto, outcome }, updatedAt: t });
  });
}

export async function setSuggestion(weId: string, suggestion: WorkoutSuggestion | undefined): Promise<void> {
  await db.workoutExercises.update(weId, { suggestion, updatedAt: Date.now() });
}

export async function setGapAnswer(weId: string, gapAnswer: WorkoutExercise['gapAnswer']): Promise<void> {
  await db.workoutExercises.update(weId, { gapAnswer, updatedAt: Date.now() });
}

/**
 * "Update routine": the routine takes the workout's exercises, order and set
 * counts. Each set keeps the routine's own weight rule and rep target where
 * one existed at that position; new sets use 'last' and the last target.
 */
export async function applyWorkoutToRoutine(workoutId: string, routineId: string): Promise<void> {
  const exercises = await db.exercises.toArray();
  const group = new Map(exercises.map((e) => [e.id, e.variationGroupId]));
  const oldRes = (await db.routineExercises.where('routineId').equals(routineId).toArray()).sort((a, b) => a.order - b.order);
  const oldSets = new Map<string, RoutineSet[]>();
  for (const re of oldRes) oldSets.set(re.exerciseId, (await db.routineSets.where('routineExerciseId').equals(re.id).toArray()).sort((a, b) => a.order - b.order));

  const t = Date.now();
  const newRes: RoutineExercise[] = [];
  const newSets: RoutineSet[] = [];
  const wes = await workoutExercises(workoutId);
  let order = 0;
  for (const we of wes) {
    const done = (await setsOf(we.id)).filter((s) => s.kind !== 'drop');
    if (!done.length) continue;
    // Template: same exercise, else a removed variation it replaced.
    let template = oldSets.get(we.exerciseId);
    if (!template) {
      const g = group.get(we.exerciseId);
      const swapped = g ? oldRes.find((re) => group.get(re.exerciseId) === g && !wes.some((x) => x.exerciseId === re.exerciseId)) : undefined;
      template = swapped ? oldSets.get(swapped.exerciseId) : undefined;
    }
    const tWarm = (template ?? []).filter((s) => s.kind === 'warmup');
    const tWork = (template ?? []).filter((s) => s.kind === 'working');
    const re: RoutineExercise = { id: uuid(), createdAt: t, updatedAt: t, routineId, exerciseId: we.exerciseId, order: order++, supersetGroup: we.supersetGroup };
    newRes.push(re);
    let wi = 0;
    let ki = 0;
    done.forEach((s, i) => {
      const src = s.kind === 'warmup' ? (tWarm[wi++] ?? tWarm[tWarm.length - 1]) : (tWork[ki++] ?? tWork[tWork.length - 1]);
      newSets.push({
        id: uuid(),
        createdAt: t,
        updatedAt: t,
        routineExerciseId: re.id,
        order: i,
        kind: s.kind as 'warmup' | 'working',
        weight: src?.weight ?? ('last' as const),
        repsMin: src?.repsMin,
        repsMax: src?.repsMax,
        ...(s.kind === 'working' && src?.rpeTarget != null ? { rpeTarget: src.rpeTarget } : {}),
      });
    });
  }
  await db.routineSets.where('routineExerciseId').anyOf(oldRes.map((r) => r.id)).delete();
  await db.routineExercises.where('routineId').equals(routineId).delete();
  const grouped = normalizeSupersets(newRes.map((r) => ({ ...r, key: r.id })));
  await db.routineExercises.bulkAdd(grouped.map(({ key: _key, ...r }) => ({ ...r, supersetGroup: r.supersetGroup })));
  await db.routineSets.bulkAdd(newSets);
  await db.routines.update(routineId, { updatedAt: t });
}

// ───────────────────────────── editing a finished workout (6.7)

export interface EditedSet extends CardioValues {
  key: string;
  kind: 'warmup' | 'working' | 'drop';
  parentKey?: string;
  weight?: number;
  reps?: number;
  rpe?: number;
}

export interface EditedExercise {
  key: string;
  exerciseId: string;
  sets: EditedSet[];
  supersetGroup?: string;
}

export async function saveWorkoutEdits(
  workoutId: string,
  edit: { name: string; startedAt: number; endedAt?: number; exercises: EditedExercise[] },
): Promise<void> {
  await db.transaction('rw', db.workouts, db.workoutExercises, db.workoutSets, async () => {
    const t = Date.now();
    const old = await db.workoutExercises.where('workoutId').equals(workoutId).toArray();
    await db.workoutSets.where('workoutExerciseId').anyOf(old.map((w) => w.id)).delete();
    await db.workoutExercises.where('workoutId').equals(workoutId).delete();
    let order = 0;
    const kept = normalizeSupersets(edit.exercises.filter((ex) => ex.sets.some((s) => !isEmptySet(s))));
    for (const ex of kept) {
      const sets = ex.sets.filter((s) => !isEmptySet(s));
      const we: WorkoutExercise = { id: uuid(), createdAt: t, updatedAt: t, workoutId, exerciseId: ex.exerciseId, order: order++, supersetGroup: ex.supersetGroup };
      await db.workoutExercises.add(we);
      const idOf = new Map<string, string>();
      for (const s of sets) idOf.set(s.key, uuid());
      await db.workoutSets.bulkAdd(
        sets.map((s, i) => ({
          id: idOf.get(s.key)!,
          createdAt: t,
          updatedAt: t,
          workoutExerciseId: we.id,
          order: i,
          kind: s.kind,
          parentSetId: s.kind === 'drop' && s.parentKey ? idOf.get(s.parentKey) : undefined,
          weight: s.weight,
          reps: s.reps,
          ...(s.kind === 'working' && s.rpe != null ? { rpe: s.rpe } : {}),
          durationSec: s.durationSec,
          distance: s.distance,
          speed: s.speed,
          incline: s.incline,
          level: s.level,
          calories: s.calories,
          steps: s.steps,
          completed: true,
        })),
      );
    }
    await db.workouts.update(workoutId, {
      name: edit.name.trim() || 'Workout',
      startedAt: edit.startedAt,
      endedAt: edit.endedAt,
      updatedAt: t,
    });
  });
}
