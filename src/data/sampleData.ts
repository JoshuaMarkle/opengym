import { db } from '../db/db';
import { uuid } from '../lib/id';
import { generateSampleData } from '../lib/sampleData';

/** Testing mode only: fill the empty test database with sample history. */
export async function seedSampleDataIfEmpty(): Promise<void> {
  if ((await db.workouts.count()) > 0) return;
  await writeSampleData();
}

/** Testing mode only: wipe workouts and routines, then write fresh sample history. */
export async function resetSampleData(): Promise<void> {
  const tables = [db.folders, db.routines, db.routineExercises, db.routineSets, db.workouts, db.workoutExercises, db.workoutSets, db.goals];
  await db.transaction('rw', tables, async () => {
    await Promise.all(tables.map((t) => t.clear()));
  });
  await writeSampleData();
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
