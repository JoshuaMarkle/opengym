import { db } from '../db/db';
import type { CardioColumn, DistanceUnit, Equipment, Exercise, ExerciseType, Muscle } from '../db/types';
import { uuid } from '../lib/id';
import { getSettings, updateSettings } from './settings';

export interface ExerciseInput {
  name: string;
  type: ExerciseType;
  muscle: Muscle;
  equipment: Equipment;
  cardioColumns?: CardioColumn[];
  distanceUnit?: DistanceUnit;
  isRun?: boolean;
}

/** Plate pad choices remembered per exercise (A5). Not an edit, so it doesn't need the form. */
export async function setExercisePrefs(id: string, prefs: Partial<Pick<Exercise, 'barLb' | 'platePad'>>): Promise<void> {
  await db.exercises.update(id, prefs);
}

export async function createExercise(input: ExerciseInput): Promise<string> {
  const t = Date.now();
  const e: Exercise = { id: uuid(), createdAt: t, updatedAt: t, ...input, name: input.name.trim(), isCustom: true, archived: false };
  await db.exercises.add(e);
  return e.id;
}

export async function updateExercise(id: string, patch: Partial<ExerciseInput>): Promise<void> {
  await db.exercises.update(id, { ...patch, ...(patch.name ? { name: patch.name.trim() } : {}), updatedAt: Date.now() });
}

/** Names already used by another live exercise (case-insensitive). */
export async function nameTaken(name: string, exceptId?: string): Promise<boolean> {
  const n = name.trim().toLowerCase();
  return (await db.exercises.toArray()).some((e) => !e.deletedAt && e.id !== exceptId && e.name.toLowerCase() === n);
}

async function unlink(id: string): Promise<void> {
  const e = await db.exercises.get(id);
  if (!e?.variationGroupId) return;
  const g = e.variationGroupId;
  await db.exercises.update(id, { variationGroupId: undefined, updatedAt: Date.now() });
  const rest = (await db.exercises.where('variationGroupId').equals(g).toArray()).filter((x) => !x.deletedAt);
  if (rest.length === 1) await db.exercises.update(rest[0].id, { variationGroupId: undefined, updatedAt: Date.now() });
}

/** Soft delete: hidden from the library and picker and taken out of routines; past workouts keep working. */
export async function deleteExercise(id: string): Promise<void> {
  await db.transaction('rw', [db.exercises, db.settings, db.routineExercises, db.routineSets], async () => {
    const slots = await db.routineExercises.where('exerciseId').equals(id).toArray();
    await db.routineSets.where('routineExerciseId').anyOf(slots.map((r) => r.id)).delete();
    await db.routineExercises.bulkDelete(slots.map((r) => r.id));
    await unlink(id);
    await db.exercises.update(id, { deletedAt: Date.now(), updatedAt: Date.now() });
    const s = await getSettings();
    if (s.pinnedExerciseIds.includes(id)) await updateSettings({ pinnedExerciseIds: s.pinnedExerciseIds.filter((x) => x !== id) });
  });
}

/**
 * 8.4: make `id` and `linkedIds` one variation group. Exercises dropped from
 * the list leave the group; a group of one dissolves.
 */
export async function setVariations(id: string, linkedIds: string[]): Promise<void> {
  await db.transaction('rw', db.exercises, async () => {
    const me = await db.exercises.get(id);
    if (!me) return;
    const t = Date.now();
    const oldGroup = me.variationGroupId;
    const members = new Set([id, ...linkedIds]);
    if (oldGroup) {
      const old = await db.exercises.where('variationGroupId').equals(oldGroup).toArray();
      for (const x of old) if (!members.has(x.id)) await db.exercises.update(x.id, { variationGroupId: undefined, updatedAt: t });
    }
    if (members.size < 2) {
      await db.exercises.update(id, { variationGroupId: undefined, updatedAt: t });
      return;
    }
    // Reuse a group one of the picks already belongs to, so linking into an existing family works.
    let group = oldGroup;
    if (!group) {
      for (const lid of linkedIds) {
        const g = (await db.exercises.get(lid))?.variationGroupId;
        if (g) {
          group = g;
          break;
        }
      }
    }
    group ??= `vg-${uuid()}`;
    for (const mid of members) {
      const x = await db.exercises.get(mid);
      if (x && x.variationGroupId !== group) {
        // Leaving another group: dissolve it if it would be left with one.
        if (x.variationGroupId) await unlink(mid);
        await db.exercises.update(mid, { variationGroupId: group, updatedAt: t });
      }
    }
  });
}

/** 8.2 Merge: move all history and routine slots from one exercise into another, then remove it. */
export async function mergeExercise(fromId: string, intoId: string): Promise<void> {
  if (fromId === intoId) return;
  await db.transaction('rw', [db.exercises, db.workoutExercises, db.routineExercises, db.settings], async () => {
    const t = Date.now();
    await db.workoutExercises.where('exerciseId').equals(fromId).modify({ exerciseId: intoId, updatedAt: t });
    await db.routineExercises.where('exerciseId').equals(fromId).modify({ exerciseId: intoId, updatedAt: t });
    await unlink(fromId);
    await db.exercises.update(fromId, { deletedAt: t, updatedAt: t });
    const s = await getSettings();
    if (s.pinnedExerciseIds.includes(fromId)) {
      const ids = s.pinnedExerciseIds.map((x) => (x === fromId ? intoId : x));
      await updateSettings({ pinnedExerciseIds: [...new Set(ids)] });
    }
  });
}

/** Routines (live) that use an exercise, for "Used in". */
export async function routinesUsing(exerciseId: string): Promise<{ id: string; name: string }[]> {
  const res = await db.routineExercises.where('exerciseId').equals(exerciseId).toArray();
  const routines = await db.routines.bulkGet([...new Set(res.map((r) => r.routineId))]);
  return routines.filter((r) => r && !r.deletedAt).map((r) => ({ id: r!.id, name: r!.name }));
}
