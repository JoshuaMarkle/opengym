import 'fake-indexeddb/auto';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/db';
import { dayKey } from '../lib/dates';
import { ActiveWorkoutExistsError, finishWorkout, startFromRoutine } from './workouts';

const started = new Date(2026, 10, 9, 18, 30).getTime();

beforeEach(async () => {
  await Promise.all(db.allTables.map((table) => table.clear()));
  vi.spyOn(Date, 'now').mockReturnValue(started);
  const stamp = { createdAt: started, updatedAt: started };
  await db.routines.add({ ...stamp, id: 'routine', name: 'Push', order: 0 });
  await db.routineExercises.add({ ...stamp, id: 're', routineId: 'routine', exerciseId: 'bench', order: 0 });
  await db.routineSets.add({ ...stamp, id: 'rs', routineExerciseId: 're', order: 0, kind: 'working', weight: 135, repsMin: 8, repsMax: 10 });
});
afterEach(() => vi.restoreAllMocks());
afterAll(() => db.delete());

describe('PH3.7 logging a missed workout late', () => {
  it('persists the chosen date, keeps the active clock current, and preserves duration when finished', async () => {
    const id = await startFromRoutine('routine', '2026-11-01');
    expect(await db.workouts.get(id)).toMatchObject({ status: 'active', startedAt: started, loggedFor: '2026-11-01' });
    await db.close();
    await db.open(); // The date must survive a reload as well as navigation.
    const set = (await db.workoutSets.toArray())[0];
    await db.workoutSets.update(set.id, { reps: 8, completed: true });
    vi.mocked(Date.now).mockReturnValue(started + 45 * 60_000);
    await finishWorkout(id, { countUnticked: false, updateRoutine: false });
    const workout = (await db.workouts.get(id))!;
    expect(dayKey(workout.startedAt)).toBe('2026-11-01');
    expect(workout.endedAt! - workout.startedAt).toBe(45 * 60_000);
    expect(workout.loggedFor).toBeUndefined();
    expect((await db.workoutSets.get(set.id))?.completed).toBe(true);
  });

  it('keeps an existing active workout and its date when another late start is attempted', async () => {
    const id = await startFromRoutine('routine', '2026-11-02');
    await expect(startFromRoutine('routine', '2026-11-03')).rejects.toBeInstanceOf(ActiveWorkoutExistsError);
    expect(await db.workouts.count()).toBe(1);
    expect((await db.workouts.get(id))?.loggedFor).toBe('2026-11-02');
  });

  it('preserves ordinary workout dates and duration', async () => {
    const id = await startFromRoutine('routine');
    vi.mocked(Date.now).mockReturnValue(started + 20 * 60_000);
    await finishWorkout(id, { countUnticked: false, updateRoutine: false });
    expect(await db.workouts.get(id)).toMatchObject({ startedAt: started, endedAt: started + 20 * 60_000 });
  });
});
