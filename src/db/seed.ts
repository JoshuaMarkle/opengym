import { db } from './db';
import { LIBRARY_SEED_VERSION, REGROUPED, SEED_EXERCISES, seedExerciseId } from './seedExercises';
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
    popularity: e.popularity,
    ...(e.area ? { area: e.area } : {}),
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
 * A built-in whose name a custom exercise already uses is left out, so an
 * update never makes a second "Seal Row".
 */
export async function ensureSeeded(): Promise<void> {
  await db.transaction('rw', db.settings, db.exercises, async () => {
    let settings = await db.settings.get('settings');
    if (!settings) {
      // A fresh library already has every group: nothing to regroup.
      settings = { ...defaultSettings(), librarySeed: LIBRARY_SEED_VERSION };
      await db.settings.put(settings);
    }
    const seeds = seedExerciseRecords();
    const rows = await db.exercises.bulkGet(seeds.map((e) => e.id));
    const byId = new Map(rows.filter((e): e is Exercise => !!e).map((e) => [e.id, e]));
    const taken = new Set((await db.exercises.toArray()).filter((e) => !e.deletedAt && !byId.has(e.id)).map((e) => e.name.trim().toLowerCase()));
    const missing = seeds.filter((e) => !byId.has(e.id) && !taken.has(e.name.toLowerCase()));
    if (missing.length) await db.exercises.bulkAdd(missing);
    // Popularity and area follow the seed (users can't edit them), so a re-seed updates scores.
    for (const seed of seeds) {
      const ex = byId.get(seed.id);
      if (!ex || ex.isCustom || (ex.popularity === seed.popularity && ex.area === seed.area)) continue;
      await db.exercises.update(seed.id, { popularity: seed.popularity, area: seed.area });
    }
    // Built-ins that joined a group in an update, once, and only if the user hasn't linked them elsewhere.
    const applied = settings.librarySeed ?? 0;
    if (applied < LIBRARY_SEED_VERSION) {
      for (const step of REGROUPED.filter((r) => r.version > applied)) {
        for (const id of step.ids) {
          const ex = byId.get(id);
          const group = seeds.find((s) => s.id === id)?.variationGroupId;
          if (!ex || ex.isCustom || ex.deletedAt || ex.variationGroupId || !group) continue;
          await db.exercises.update(id, { variationGroupId: group, updatedAt: Date.now() });
        }
      }
      await db.settings.update('settings', { librarySeed: LIBRARY_SEED_VERSION });
    }
    // Preset columns that changed: only rows still holding the old default move.
    for (const [id, olds] of Object.entries(RETIRED_PRESET_COLUMNS)) {
      const ex = await db.exercises.get(id);
      const to = seeds.find((s) => s.id === id)?.cardioColumns;
      const have = (ex?.cardioColumns ?? []).join();
      if (!ex || ex.isCustom || !to || !olds.some((from) => from.join() === have)) continue;
      await db.exercises.update(id, { cardioColumns: to, updatedAt: Date.now() });
    }
  });
}

/** Built-in cardio presets whose default columns changed, with every default they used to have. */
const RETIRED_PRESET_COLUMNS: Record<string, CardioColumn[][]> = {
  'ex-treadmill': [
    ['distance', 'speed'],
    ['distance', 'avgSpeed'],
  ],
  'ex-stair-climber': [
    ['level', 'calories'],
    ['speed', 'level'],
  ],
  'ex-jump-rope': [['calories']],
};
