import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { ensureSeeded, seedExerciseRecords } from './seed';
import { LIBRARY_SEED_VERSION, SEED_EXERCISES } from './seedExercises';

/** A library as it stood before popularity: no scores, the five regrouped built-ins ungrouped, Seal Row not there yet. */
async function oldLibrary() {
  const OLD = new Set(['ex-meadows-row', 'ex-back-extension', 'ex-good-morning', 'ex-reverse-curl', 'ex-wrist-curl']);
  const rows = seedExerciseRecords(0)
    .filter((e) => e.id !== 'ex-seal-row')
    .map(({ popularity: _p, area: _a, ...e }) => (OLD.has(e.id) ? { ...e, variationGroupId: undefined } : e));
  await db.exercises.bulkPut(rows);
  await db.settings.put({ id: 'settings' } as never);
}

beforeEach(async () => {
  await Promise.all(db.allTables.map((t) => t.clear()));
});

describe('ensureSeeded', () => {
  it('a fresh install has every built-in with its score and nothing left to regroup', async () => {
    await ensureSeeded();
    expect(await db.exercises.count()).toBe(SEED_EXERCISES.length);
    expect((await db.exercises.get('ex-bench-press'))?.popularity).toBe(10);
    expect((await db.exercises.get('ex-wrist-curl'))?.area).toBe('forearms');
    expect((await db.settings.get('settings'))?.librarySeed).toBe(LIBRARY_SEED_VERSION);
  });

  it('an update scores old rows, adds the new ones and regroups once', async () => {
    await oldLibrary();
    await ensureSeeded();
    expect((await db.exercises.get('ex-squat'))?.popularity).toBe(9);
    expect((await db.exercises.get('ex-seal-row'))?.variationGroupId).toBe('vg-row');
    expect((await db.exercises.get('ex-meadows-row'))?.variationGroupId).toBe('vg-row');
    expect((await db.exercises.get('ex-back-extension'))?.variationGroupId).toBe('vg-back-ext');
    // The user unlinks it afterwards: a later launch leaves it alone.
    await db.exercises.update('ex-meadows-row', { variationGroupId: undefined });
    await ensureSeeded();
    expect((await db.exercises.get('ex-meadows-row'))?.variationGroupId).toBeUndefined();
  });

  it('never regroups a built-in the user linked elsewhere', async () => {
    await oldLibrary();
    await db.exercises.update('ex-reverse-curl', { variationGroupId: 'vg-hammer' });
    await ensureSeeded();
    expect((await db.exercises.get('ex-reverse-curl'))?.variationGroupId).toBe('vg-hammer');
  });

  it('skips a new built-in whose name a custom exercise already has', async () => {
    await oldLibrary();
    await db.exercises.add({ id: 'mine', name: 'Seal Row', type: 'weight', muscle: 'back', equipment: 'barbell', isCustom: true, archived: false, createdAt: 0, updatedAt: 0 });
    await ensureSeeded();
    expect(await db.exercises.get('ex-seal-row')).toBeUndefined();
    expect((await db.exercises.toArray()).filter((e) => e.name === 'Seal Row')).toHaveLength(1);
  });
});
