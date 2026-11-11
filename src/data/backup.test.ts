import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { ensureSeeded } from '../db/seed';
import type { Exercise, Food, FoodEntry, FoodTarget, SavedMeal } from '../db/types';
import { indexWords } from '../lib/nutrition';
import { buildBackup, exportFoodCsv, importRoutinesFromBackup, readBackup, restoreBackup, SCHEMA_VERSION } from './backup';
import { updateFoodSettings } from './food';
import { getSettings } from './settings';

const t = 1_700_000_000_000;
const stamp = { createdAt: t, updatedAt: t };
const food = (id: string, source: Food['source'], extra: Partial<Food> = {}): Food => ({ ...stamp, id, name: id, source, basis: 'g', per100: { kcal: 100, p: 10 }, servings: [], ...extra });
const words = (f: Food) => indexWords(f).map((word) => ({ word, foodId: f.id }));

const plainUsda = food('usda-1', 'usda', { name: 'Apple' });
const myUsda = food('usda-2', 'usda', { name: 'Banana', mine: true, last: { grams: 118, unit: 'g' } });
const custom = food('custom-1', 'custom', { name: 'Whey shake', mine: true, favorite: true });
const entry: FoodEntry = { ...stamp, id: 'e1', day: '2026-11-05', meal: 'lunch', order: 0, loggedAt: t, foodId: 'custom-1', name: 'Whey shake', grams: 30, basis: 'g', unit: 'g', totals: { kcal: 120, p: 24 } };
const quick: FoodEntry = { ...stamp, id: 'e2', day: '2026-11-04', meal: 'snacks', order: 0, loggedAt: t, name: 'Quick add', totals: { kcal: 300 }, quick: true };
const meal: SavedMeal = { ...stamp, id: 'm1', name: 'Shake', order: 0, items: [{ foodId: 'custom-1', grams: 30, unit: 'g' }] };
const target: FoodTarget = { ...stamp, id: 't1', from: '2026-10-01', mode: 'target', kcal: 2700, grams: [190, 305, 80], diet: 'lifter' } as FoodTarget;

beforeEach(async () => {
  await Promise.all(db.allTables.map((table) => table.clear()));
  await getSettings();
  await updateFoodSettings({ setUp: true, usdaRelease: '2025-12' });
  await db.foods.bulkPut([plainUsda, myUsda, custom]);
  await db.foodWords.bulkPut([plainUsda, myUsda, custom].flatMap(words));
  await db.foodEntries.bulkPut([entry, quick]);
  await db.savedMeals.put(meal);
  await db.foodTargets.put(target);
});
afterAll(() => db.delete());

describe('backup schemaVersion 4: food', () => {
  it('carries your foods, entries, saved meals and targets, but not the plain USDA rows', async () => {
    const b = await buildBackup();
    expect(b.schemaVersion).toBe(SCHEMA_VERSION);
    expect((b.tables.foods as Food[]).map((f) => f.id).sort()).toEqual(['custom-1', 'usda-2']);
    expect(b.tables.foodEntries).toHaveLength(2);
    expect(b.tables.savedMeals).toHaveLength(1);
    expect(b.tables.foodTargets).toHaveLength(1);
    expect(b.counts.foodDays).toBe(2);
  });

  it('round-trips through a file and restore, keeping the built-in database and rebuilding the index', async () => {
    const b = await buildBackup();
    const file = new File([JSON.stringify(b)], 'b.json');

    // Things change after the backup: a new food of yours, a mark on a USDA food, a new entry.
    const later = food('custom-2', 'custom', { name: 'Granola' });
    await db.foods.put(later);
    await db.foodWords.bulkPut(words(later));
    await db.foods.update('usda-1', { favorite: true });
    await db.foodEntries.put({ ...entry, id: 'e3', day: '2026-11-06' });

    const read = await readBackup(file);
    expect(read.counts.foodDays).toBe(2);
    await restoreBackup(read);

    const ids = (await db.foods.toArray()).map((f) => f.id).sort();
    expect(ids).toEqual(['custom-1', 'usda-1', 'usda-2']);
    expect((await db.foods.get('usda-1'))?.favorite).toBeUndefined();
    expect((await db.foods.get('usda-2'))?.last).toEqual({ grams: 118, unit: 'g' });
    expect((await db.foods.get('custom-1'))?.favorite).toBe(true);
    expect((await db.foodEntries.toArray()).map((e) => e.id).sort()).toEqual(['e1', 'e2']);
    expect(await db.savedMeals.count()).toBe(1);
    expect((await db.foodTargets.get('t1'))?.kcal).toBe(2700);
    // Search index: your foods are findable again, the dropped one is gone, the USDA words stay.
    expect(await db.foodWords.where('foodId').equals('custom-1').count()).toBeGreaterThan(0);
    expect(await db.foodWords.where('foodId').equals('custom-2').count()).toBe(0);
    expect(await db.foodWords.where('foodId').equals('usda-1').count()).toBeGreaterThan(0);
    // The built-in database is still loaded on this phone.
    expect((await getSettings()).food?.usdaRelease).toBe('2025-12');
  });

  it('restores an older backup with empty food tables', async () => {
    const b = await buildBackup();
    const old = { ...b, schemaVersion: 3, tables: { ...b.tables } } as Record<string, unknown> & typeof b;
    for (const k of ['foods', 'foodEntries', 'savedMeals', 'foodTargets'] as const) delete (old.tables as Record<string, unknown>)[k];
    const read = await readBackup(new File([JSON.stringify(old)], 'old.json'));
    expect(read.tables.foodEntries).toEqual([]);
    expect(read.counts.foodDays).toBe(0);
    await restoreBackup(read);
    expect(await db.foodEntries.count()).toBe(0);
    expect(await db.foods.get('usda-1')).toBeDefined();
  });

  it('exports the food log as CSV: one row per food, a column per nutrient, blanks for unknown', async () => {
    const file = (await exportFoodCsv())!;
    const lines = (await file.text()).trim().split(/\r?\n/);
    expect(lines[0].startsWith('Date,Meal,Food,Brand,Amount,Grams,Calories (kcal),')).toBe(true);
    expect(lines).toHaveLength(3);
    expect(lines[1].startsWith('2026-11-04,Snacks,Quick add,,Quick add,,300,')).toBe(true);
    expect(lines[2].startsWith('2026-11-05,Lunch,Whey shake,,30 g,30,120,')).toBe(true);
  });
});

describe('backup: built-in exercises', () => {
  it('leaves out built-ins you never changed and restores them from the library', async () => {
    await ensureSeeded();
    const library = await db.exercises.count();
    const mine: Exercise = { ...stamp, id: 'my-ex', name: 'Forearm Pushdown', type: 'weight', muscle: 'arms', equipment: 'cable', isCustom: true, archived: false };
    await db.exercises.put(mine);
    await db.exercises.update('ex-bench-press', { barLb: 35 });
    await db.exercises.update('ex-leg-press', { archived: true });
    await db.exercises.update('ex-hip-thrust', { deletedAt: t });
    // Timestamps and seed-managed fields alone don't count as a change.
    await db.exercises.update('ex-leg-curl', { updatedAt: t + 1, popularity: 1 });

    const b = await buildBackup();
    const ids = (b.tables.exercises as Exercise[]).map((e) => e.id).sort();
    expect(ids).toEqual(['ex-bench-press', 'ex-hip-thrust', 'ex-leg-press', 'my-ex']);

    await restoreBackup(await readBackup(new File([JSON.stringify(b)], 'b.json')));
    expect(await db.exercises.count()).toBe(library + 1);
    expect((await db.exercises.get('ex-bench-press'))?.barLb).toBe(35);
    expect((await db.exercises.get('ex-leg-press'))?.archived).toBe(true);
    expect((await db.exercises.get('ex-hip-thrust'))?.deletedAt).toBe(t);
    expect((await db.exercises.get('ex-leg-curl'))?.name).toBe('Leg Curl');
    expect(await db.exercises.get('my-ex')).toMatchObject({ name: 'Forearm Pushdown' });
  });

  it('a routine using an unchanged built-in still imports from a trimmed backup', async () => {
    await ensureSeeded();
    await db.routines.put({ ...stamp, id: 'r1', name: 'Pull', order: 0 });
    await db.routineExercises.put({ ...stamp, id: 're1', routineId: 'r1', exerciseId: 'ex-lat-pulldown', order: 0 });
    const b = await buildBackup();
    expect((b.tables.exercises as Exercise[]).some((e) => e.id === 'ex-lat-pulldown')).toBe(false);
    await db.exercises.delete('ex-lat-pulldown');
    expect(await importRoutinesFromBackup(b)).toBe(1);
    expect(await db.routineExercises.where('exerciseId').equals('ex-lat-pulldown').count()).toBe(2);
  });
});
