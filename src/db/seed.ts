import { db } from './db';
import { SEED_EXERCISES, seedExerciseId } from './seedExercises';
import { DEFAULT_SETTINGS, type CardioColumn, type Exercise, type Settings } from './types';

/** Built-in exercises as records (stable ids, stable timestamps). */
export function seedExerciseRecords(now = Date.now()): Exercise[] {
  return SEED_EXERCISES.map((e) => ({
    id: seedExerciseId(e.name),
    name: e.name,
    type: e.type ?? 'weight',
    muscle: e.muscle,
    equipment: e.equipment,
    variationGroupId: e.group,
    ...(e.type === 'cardio' ? { cardioColumns: e.cardio ?? [], distanceUnit: e.distanceUnit ?? 'auto', isRun: e.isRun || undefined } : {}),
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
 * every launch: it only adds built-ins that are missing by id (new ones in an
 * update, like the cardio presets) and never touches user edits or deletions.
 */
export async function ensureSeeded(): Promise<void> {
  await db.transaction('rw', db.settings, db.exercises, async () => {
    const settings = await db.settings.get('settings');
    if (!settings) await db.settings.put(defaultSettings());
    const seeds = seedExerciseRecords();
    const have = new Set((await db.exercises.bulkGet(seeds.map((e) => e.id))).filter(Boolean).map((e) => e!.id));
    const missing = seeds.filter((e) => !have.has(e.id));
    if (missing.length) await db.exercises.bulkAdd(missing);
    // Preset columns that changed: only rows still holding the old default move.
    for (const [id, from] of Object.entries(RETIRED_PRESET_COLUMNS)) {
      const ex = await db.exercises.get(id);
      const to = seeds.find((s) => s.id === id)?.cardioColumns;
      if (!ex || ex.isCustom || !to || (ex.cardioColumns ?? []).join() !== from.join()) continue;
      await db.exercises.update(id, { cardioColumns: to, updatedAt: Date.now() });
    }
  });
}

/** Built-in cardio presets whose default columns changed, with what they used to be. */
const RETIRED_PRESET_COLUMNS: Record<string, CardioColumn[]> = {
  'ex-treadmill': ['distance', 'speed'],
  'ex-stair-climber': ['level', 'calories'],
  'ex-jump-rope': ['calories'],
};
