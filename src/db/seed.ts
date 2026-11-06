import { db } from './db';
import { SEED_EXERCISES, seedExerciseId } from './seedExercises';
import { DEFAULT_SETTINGS, type Exercise, type Settings } from './types';

/** Built-in exercises as records (stable ids, stable timestamps). */
export function seedExerciseRecords(now = Date.now()): Exercise[] {
  return SEED_EXERCISES.map((e) => ({
    id: seedExerciseId(e.name),
    name: e.name,
    type: e.type ?? 'weight',
    muscle: e.muscle,
    equipment: e.equipment,
    variationGroupId: e.group,
    isCustom: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
  }));
}

export function defaultSettings(now = Date.now()): Settings {
  return { ...DEFAULT_SETTINGS, pinnedExerciseIds: [], createdAt: now, updatedAt: now };
}

/**
 * Make sure the settings row and the built-in library exist. Safe to run on
 * every launch: it only adds what's missing and never touches user edits.
 */
export async function ensureSeeded(): Promise<void> {
  await db.transaction('rw', db.settings, db.exercises, async () => {
    const settings = await db.settings.get('settings');
    if (!settings) await db.settings.put(defaultSettings());
    const count = await db.exercises.count();
    if (count === 0) {
      await db.exercises.bulkPut(seedExerciseRecords());
    }
  });
}
