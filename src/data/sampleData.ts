import { db } from '../db/db';
import { uuid } from '../lib/id';
import { indexWords } from '../lib/nutrition';
import { generateSampleData } from '../lib/sampleData';
import { generateSampleFood } from '../lib/sampleFood';
import { foodSettingsOf } from './food';
import { getSettings, updateSettings } from './settings';

/** Testing mode only: fill the empty test database with sample history. */
export async function seedSampleDataIfEmpty(): Promise<void> {
  if ((await db.workouts.count()) === 0) await writeSampleData();
  // Test databases made before the Food tab get its sample logs too.
  if (!foodSettingsOf(await getSettings()).setUp && (await db.foodEntries.count()) === 0) await writeSampleFood();
}

/** Testing mode only: wipe workouts and routines, then write fresh sample history. */
export async function resetSampleData(): Promise<void> {
  const tables = [db.folders, db.routines, db.routineExercises, db.routineSets, db.workouts, db.workoutExercises, db.workoutSets, db.goals];
  await db.transaction('rw', tables, async () => {
    await Promise.all(tables.map((t) => t.clear()));
  });
  await writeSampleData();
  await db.transaction('rw', [db.foodEntries, db.savedMeals, db.foodTargets], async () => {
    await Promise.all([db.foodEntries.clear(), db.savedMeals.clear(), db.foodTargets.clear()]);
  });
  await writeSampleFood();
}

/** Four weeks of food logs, saved meals and a 2,700 kcal target (src/lib/sampleFood.ts). */
async function writeSampleFood(): Promise<void> {
  const d = generateSampleFood({ newId: uuid });
  await db.transaction('rw', [db.foods, db.foodWords, db.foodEntries, db.savedMeals, db.foodTargets], async () => {
    // Keep fields the USDA loader may already have written; ours are the same numbers.
    await db.foods.bulkPut(d.foods);
    await db.foodWords.bulkPut(d.foods.flatMap((f) => indexWords(f).map((word) => ({ word, foodId: f.id }))));
    await db.foodEntries.bulkAdd(d.entries);
    await db.savedMeals.bulkAdd(d.savedMeals);
    await db.foodTargets.bulkAdd(d.targets);
  });
  const s = await getSettings();
  await updateSettings({ food: { ...foodSettingsOf(s), ...d.settings, usdaRelease: foodSettingsOf(s).usdaRelease } });
}

async function writeSampleData(): Promise<void> {
  const d = generateSampleData({ newId: uuid });
  await db.transaction('rw', [db.exercises, db.folders, db.routines, db.routineExercises, db.routineSets, db.workouts, db.workoutExercises, db.workoutSets, db.settings], async () => {
    await db.exercises.bulkPut(d.exercises);
    await db.folders.bulkAdd(d.folders);
    await db.routines.bulkAdd(d.routines);
    await db.routineExercises.bulkAdd(d.routineExercises);
    await db.routineSets.bulkAdd(d.routineSets);
    await db.workouts.bulkAdd(d.workouts);
    await db.workoutExercises.bulkAdd(d.workoutExercises);
    await db.workoutSets.bulkAdd(d.workoutSets);
    // The sample history logs effort as RIR (SPEC §12), so show it that way.
    await db.settings.update('settings', { onboarded: true, effort: 'rir', effortExplained: true, updatedAt: Date.now() });
  });
}
