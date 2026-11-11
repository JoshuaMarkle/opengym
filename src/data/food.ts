// Reads and writes for the Food tab (SPEC §14): your food library, logged entries, saved meals
// and target versions. Every write saves immediately, so nothing is lost on Cancel.

import { db } from '../db/db';
import type { AmountUnit, Food, FoodEntry, FoodSettings, FoodTarget, MealId, SavedMeal, SavedMealItem } from '../db/types';
import { uuid } from '../lib/id';
import { closestFoods, fillMissing, foodDayKey, indexWords, leadWord, logCounts, rankFoods, totalsFor, words, type Nutrients } from '../lib/nutrition';
import { getSettings, updateSettings } from './settings';

export const DEFAULT_FOOD_SETTINGS: FoodSettings = { online: true, setUp: false };

export function foodSettingsOf(s: { food?: FoodSettings }): FoodSettings {
  return { ...DEFAULT_FOOD_SETTINGS, ...(s.food ?? {}) };
}

export async function updateFoodSettings(patch: Partial<FoodSettings>): Promise<void> {
  const s = await getSettings();
  await updateSettings({ food: { ...foodSettingsOf(s), ...patch } });
}

// ───────────────────────────── library

/** Keep the prefix index in step with a food's name, brand and detail. */
export async function writeWords(food: Pick<Food, 'id' | 'name' | 'brand' | 'detail' | 'deletedAt'>): Promise<void> {
  await db.foodWords.where('foodId').equals(food.id).delete();
  if (food.deletedAt) return;
  await db.foodWords.bulkPut(indexWords(food).map((word) => ({ word, foodId: food.id })));
}

export type NewFood = Omit<Food, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

/** Create or replace a food in your library. */
export async function saveFood(f: NewFood): Promise<string> {
  const t = Date.now();
  const id = f.id ?? uuid();
  const prev = f.id ? await db.foods.get(f.id) : undefined;
  const food: Food = { ...f, id, createdAt: prev?.createdAt ?? t, updatedAt: t } as Food;
  await db.transaction('rw', db.foods, db.foodWords, async () => {
    await db.foods.put(food);
    await writeWords(food);
  });
  return id;
}

export async function setFavorite(id: string, favorite: boolean): Promise<void> {
  await db.foods.update(id, { favorite, ...(favorite ? { mine: true } : {}), updatedAt: Date.now() });
}

/**
 * Remove from my foods: your own foods are soft-deleted; USDA and Open Food Facts foods just
 * leave the library. Logged days never change.
 */
export async function removeFromLibrary(id: string): Promise<void> {
  const f = await db.foods.get(id);
  if (!f) return;
  if (f.source === 'custom') {
    await db.transaction('rw', db.foods, db.foodWords, async () => {
      await db.foods.update(id, { deletedAt: Date.now(), updatedAt: Date.now() });
      await db.foodWords.where('foodId').equals(id).delete();
    });
  } else {
    await db.foods.update(id, { mine: false, favorite: false, updatedAt: Date.now() });
  }
}

/** "Make a copy to edit": a custom food with the same numbers. USDA and Open Food Facts foods stay read-only. */
export async function copyFood(id: string): Promise<string | undefined> {
  const f = await db.foods.get(id);
  if (!f) return undefined;
  const { id: _id, createdAt: _c, updatedAt: _u, fdcId: _fdc, offCode: _off, ...rest } = f;
  return saveFood({ ...rest, source: 'custom', mine: true, favorite: false, copiedFrom: id, last: undefined, barcode: f.barcode });
}

/** Borrow the missing micronutrients from a USDA food; marked estimated. Your copy keeps them. */
export async function fillFood(id: string, fromId: string): Promise<number> {
  const [f, from] = await Promise.all([db.foods.get(id), db.foods.get(fromId)]);
  if (!f || !from) return 0;
  const r = fillMissing(f, from);
  await db.foods.update(id, { per100: r.per100, estimated: r.estimated, filledFrom: fromId, mine: true, updatedAt: Date.now() });
  return r.filled.length;
}

/** Undo for fillFood: put back the numbers the food had before. */
export async function unfillFood(id: string, before: Pick<Food, 'per100' | 'estimated' | 'filledFrom'>): Promise<void> {
  await db.foods.update(id, { per100: before.per100, estimated: before.estimated, filledFrom: before.filledFrom, updatedAt: Date.now() });
}

/** Built-in foods closest by name to `food`, to borrow its missing nutrients from (§3.14). */
export async function fillCandidates(food: Pick<Food, 'name' | 'id'>, n = 6): Promise<Food[]> {
  const ws = [...new Set(words(food.name).filter((w) => w.length > 2))].slice(0, 5);
  const ids = new Set<string>();
  for (const w of ws) for (const k of await db.foodWords.where('word').equals(w).limit(3000).primaryKeys()) ids.add((k as [string, string])[1]);
  const foods = (await db.foods.bulkGet([...ids])).filter((f): f is Food => !!f && f.source === 'usda' && f.id !== food.id);
  return closestFoods(food.name, foods, n);
}

/** Your own copy wins over Open Food Facts for a barcode. */
export async function foodByBarcode(code: string): Promise<Food | undefined> {
  const all = (await db.foods.where('barcode').equals(code).toArray()).filter((f) => !f.deletedAt);
  return all.find((f) => f.source === 'custom') ?? all[0];
}

// ───────────────────────────── entries

async function nextOrder(day: string, meal: MealId): Promise<number> {
  const rows = await db.foodEntries.where('[day+meal]').equals([day, meal]).toArray();
  return rows.length ? Math.max(...rows.map((r) => r.order)) + 1 : 0;
}

export interface LogAmount {
  grams: number;
  unit: AmountUnit;
  serving?: number;
}

function entryFrom(food: Food, day: string, meal: MealId, a: LogAmount, order: number, extra: Partial<FoodEntry> = {}): FoodEntry {
  const t = Date.now();
  return {
    id: uuid(),
    createdAt: t,
    updatedAt: t,
    day,
    meal,
    order,
    loggedAt: t,
    foodId: food.id,
    name: food.name,
    brand: food.brand,
    grams: a.grams,
    basis: food.basis,
    unit: a.unit,
    serving: a.serving,
    servings: food.servings,
    totals: totalsFor(food.per100, a.grams),
    ...(food.estimated?.length ? { estimated: food.estimated } : {}),
    ...extra,
  };
}

/** The amount the + disc logs: your last amount for the food, else its default serving, else 100 g. */
export function quickAmount(food: Food): LogAmount {
  if (food.last) return food.last;
  if (food.servings.length) {
    const i = food.defaultServing ?? 0;
    return { grams: food.servings[i]?.grams ?? food.servings[0].grams, unit: 'serv', serving: i };
  }
  return { grams: 100, unit: 'g' };
}

/** Log a food. It joins your library and remembers this amount for next time. */
export async function logFood(food: Food, day: string, meal: MealId, amount: LogAmount): Promise<FoodEntry> {
  return db.transaction('rw', db.foods, db.foodEntries, db.foodWords, async () => {
    if (!(await db.foods.get(food.id))) {
      await db.foods.put(food);
      await writeWords(food);
    }
    const e = entryFrom(food, day, meal, amount, await nextOrder(day, meal));
    await db.foodEntries.add(e);
    await db.foods.update(food.id, { mine: true, last: amount, updatedAt: Date.now() });
    return e;
  });
}

/** Quick add: calories plus optional macros and a name. Never enters the library. */
export async function quickAdd(day: string, meal: MealId, values: Nutrients, name?: string): Promise<FoodEntry> {
  const t = Date.now();
  const e: FoodEntry = { id: uuid(), createdAt: t, updatedAt: t, day, meal, order: await nextOrder(day, meal), loggedAt: t, name: name?.trim() || 'Quick add', totals: values, quick: true };
  await db.foodEntries.add(e);
  return e;
}

/**
 * Change a logged amount or meal. The snapshot scales with the amount (it never re-reads the
 * food, so editing the food later can't rewrite a logged day). Changing the meal moves it.
 */
export async function updateEntry(id: string, patch: { amount?: LogAmount; meal?: MealId }): Promise<void> {
  await db.transaction('rw', db.foodEntries, db.foods, async () => {
    const e = await db.foodEntries.get(id);
    if (!e) return;
    const next: Partial<FoodEntry> = { updatedAt: Date.now() };
    if (patch.amount && e.grams) {
      const k = patch.amount.grams / e.grams;
      const totals: Nutrients = {};
      for (const [nid, v] of Object.entries(e.totals)) if (v != null) totals[nid as keyof Nutrients] = v * k;
      Object.assign(next, { grams: patch.amount.grams, unit: patch.amount.unit, serving: patch.amount.serving, totals });
      if (e.foodId) await db.foods.update(e.foodId, { last: patch.amount });
    }
    if (patch.meal && patch.meal !== e.meal) Object.assign(next, { meal: patch.meal, order: await nextOrder(e.day, patch.meal) });
    await db.foodEntries.update(id, next);
  });
}

export async function deleteEntries(ids: string[]): Promise<FoodEntry[]> {
  const rows = (await db.foodEntries.bulkGet(ids)).filter((e): e is FoodEntry => !!e);
  await db.foodEntries.bulkDelete(ids);
  return rows;
}

/** Undo: put entries back exactly as they were. */
export async function restoreEntries(rows: FoodEntry[]): Promise<void> {
  await db.foodEntries.bulkPut(rows);
}

export async function removeBatch(batchId: string): Promise<FoodEntry[]> {
  const rows = await db.foodEntries.where('batchId').equals(batchId).toArray();
  await db.foodEntries.bulkDelete(rows.map((r) => r.id));
  return rows;
}

/** Log every food of a saved meal as its own entry, tagged so ✓ can take the group back off. */
export async function logSavedMeal(saved: SavedMeal, day: string, meal: MealId): Promise<{ batchId: string; kcal: number }> {
  const batchId = uuid();
  let kcal = 0;
  await db.transaction('rw', db.foods, db.foodEntries, async () => {
    let order = await nextOrder(day, meal);
    const foods = await db.foods.bulkGet(saved.items.map((i) => i.foodId));
    const rows: FoodEntry[] = [];
    saved.items.forEach((it, i) => {
      const f = foods[i];
      if (!f) return;
      const e = entryFrom(f, day, meal, it, order++, { savedMealId: saved.id, batchId });
      kcal += e.totals.kcal ?? 0;
      rows.push(e);
    });
    await db.foodEntries.bulkAdd(rows);
  });
  return { batchId, kcal };
}

/** Copy entries into another day (and meal, or each into its own meal), as one batch for Undo. */
export async function copyEntries(rows: FoodEntry[], day: string, meal?: MealId): Promise<{ batchId: string; kcal: number; count: number }> {
  const batchId = uuid();
  const t = Date.now();
  let kcal = 0;
  await db.transaction('rw', db.foodEntries, async () => {
    const orders = new Map<MealId, number>();
    const out: FoodEntry[] = [];
    for (const r of [...rows].sort((a, b) => a.order - b.order)) {
      const m = meal ?? r.meal;
      if (!orders.has(m)) orders.set(m, await nextOrder(day, m));
      const order = orders.get(m)!;
      orders.set(m, order + 1);
      kcal += r.totals.kcal ?? 0;
      out.push({ ...r, id: uuid(), createdAt: t, updatedAt: t, loggedAt: t, day, meal: m, order, batchId, savedMealId: undefined });
    }
    await db.foodEntries.bulkAdd(out);
  });
  return { batchId, kcal, count: rows.length };
}

// ───────────────────────────── saved meals (D4, D5)

export async function saveSavedMeal(m: { id?: string; name: string; items: SavedMealItem[] }): Promise<string> {
  const t = Date.now();
  if (m.id) {
    await db.savedMeals.update(m.id, { name: m.name, items: m.items, updatedAt: t });
    return m.id;
  }
  const all = await db.savedMeals.toArray();
  const id = uuid();
  await db.savedMeals.add({ id, createdAt: t, updatedAt: t, name: m.name, items: m.items, order: all.length ? Math.max(...all.map((x) => x.order)) + 1 : 0 });
  return id;
}

export async function deleteSavedMeal(id: string): Promise<void> {
  await db.savedMeals.update(id, { deletedAt: Date.now(), updatedAt: Date.now() });
}

/** "Save as meal" from a folder: its foods (quick adds can't be saved). */
export function itemsFromEntries(rows: FoodEntry[]): SavedMealItem[] {
  return rows
    .filter((r) => r.foodId && r.grams)
    .sort((a, b) => a.order - b.order)
    .map((r) => ({ foodId: r.foodId!, grams: r.grams!, unit: r.unit ?? 'g', serving: r.serving }));
}

// ───────────────────────────── targets

/**
 * Save a target version from today. Changes apply from today; past days keep theirs. A second
 * change on the same day replaces that day's version.
 */
export async function saveTarget(v: Omit<FoodTarget, 'id' | 'createdAt' | 'updatedAt' | 'from'>, from = foodDayKey(Date.now())): Promise<void> {
  const t = Date.now();
  const same = await db.foodTargets.where('from').equals(from).toArray();
  await db.transaction('rw', db.foodTargets, async () => {
    if (same.length) await db.foodTargets.bulkDelete(same.map((s) => s.id));
    await db.foodTargets.add({ ...v, id: uuid(), from, createdAt: t, updatedAt: t });
  });
}

/** The newest version (what Targets edits). */
export async function latestTarget(): Promise<FoodTarget | undefined> {
  const all = await db.foodTargets.toArray();
  return all.sort((a, b) => b.from.localeCompare(a.from) || b.createdAt - a.createdAt)[0];
}

/** Change the current target from today (Targets, 10.10–10.13): the newest version with `patch` applied. */
export async function updateTarget(patch: Partial<Omit<FoodTarget, 'id' | 'createdAt' | 'updatedAt' | 'from'>>): Promise<void> {
  const cur = await latestTarget();
  const base = cur ? (({ id: _i, createdAt: _c, updatedAt: _u, from: _f, ...rest }) => rest)(cur) : { mode: 'log' as const, diet: 'lifter' as const, pct: [30, 40, 30] as FoodTarget['pct'], grams: [0, 0, 0] as FoodTarget['grams'] };
  await saveTarget({ ...base, ...patch });
}

// ───────────────────────────── search (C1)

/** Local search over your foods and the built-in database, through the word index (§3.5). */
export async function searchLocal(query: string, limit = 60): Promise<Food[]> {
  const q = words(query);
  const lead = leadWord(q);
  if (!lead) return [];
  const keys = await db.foodWords.where('word').startsWith(lead).limit(4000).primaryKeys();
  const ids = [...new Set(keys.map((k) => (k as [string, string])[1]))];
  const foods = (await db.foods.bulkGet(ids)).filter((f): f is Food => !!f && !f.deletedAt);
  const counts = logCounts(await db.foodEntries.toArray());
  return rankFoods(query, foods, counts, limit);
}

/** Star or unstar a food; starring puts it in your library (an online result is saved then). */
export async function starFood(food: Food, favorite: boolean): Promise<void> {
  if (!(await db.foods.get(food.id))) await saveFood({ ...food, favorite, mine: true });
  else await setFavorite(food.id, favorite);
}
