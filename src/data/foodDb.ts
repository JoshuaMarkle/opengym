// The built-in food database (nutrition-plan §3.8, SPEC §14): USDA FoodData Central, shipped as
// public/foods/usda-<release>.json (built by `npm run foods`) and loaded into IndexedDB the first
// time the Food tab opens. Loading runs in batches and picks up where it stopped if the app is
// closed part-way. The service worker caches the file, so a reinstall after the first load is
// offline too.

import { useSyncExternalStore } from 'react';
import { db } from '../db/db';
import type { Food, FoodServing } from '../db/types';
import { indexWords, pickServing, type NutrientId, type Nutrients } from '../lib/nutrition';
import { foodSettingsOf, updateFoodSettings } from './food';
import { getSettings } from './settings';

/** Bump with RELEASE in scripts/foods.ts. */
export const USDA_RELEASE = '2025-12';
const URL_ = `${import.meta.env.BASE_URL}foods/usda-${USDA_RELEASE}.json`;
const BATCH = 500;
const RESUME_KEY = 'og.foodDb.batch';

interface UsdaFile {
  release: string;
  nutrients: NutrientId[];
  foods: [number, string, string | null, (number | null)[], [string, number][]][];
}

export type FoodDbState = { status: 'idle' } | { status: 'loading'; done: number; total: number } | { status: 'ready' } | { status: 'error'; message: string };

let state: FoodDbState = { status: 'idle' };
const listeners = new Set<() => void>();
function set(s: FoodDbState) {
  state = s;
  listeners.forEach((l) => l());
}

export function usdaFood(row: UsdaFile['foods'][number], ids: NutrientId[]): Food {
  const [fdcId, name, detail, values, servings] = row;
  const per100: Nutrients = {};
  ids.forEach((id, i) => {
    const v = values[i];
    if (v != null) per100[id] = v;
  });
  return {
    id: `usda-${fdcId}`,
    createdAt: 0,
    updatedAt: 0,
    name,
    ...(detail ? { detail } : {}),
    source: 'usda',
    fdcId,
    basis: 'g',
    per100,
    servings: servings.map(([label, grams]): FoodServing => ({ label, grams })),
    ...(servings.length ? { defaultServing: pickServing(servings.map(([label, grams]) => ({ label, grams })), per100.kcal) } : {}),
  };
}

/** Fields of yours that a reload of the database must keep. */
const KEEP = ['mine', 'favorite', 'last', 'createdAt', 'estimated', 'filledFrom'] as const;

let running: Promise<void> | undefined;

/** After Delete all data: forget a half-finished load so the next one starts from the top. */
export function resetFoodDb(): void {
  localStorage.removeItem(RESUME_KEY);
  set({ status: 'idle' });
}

/** Load the database if this release isn't in yet. Safe to call on every visit. */
export function ensureFoodDb(): Promise<void> {
  running ??= load().finally(() => {
    running = undefined;
  });
  return running;
}

async function load(): Promise<void> {
  const s = foodSettingsOf(await getSettings());
  if (s.usdaRelease === USDA_RELEASE) {
    set({ status: 'ready' });
    return;
  }
  try {
    set({ status: 'loading', done: 0, total: 0 });
    const res = await fetch(URL_);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const file = (await res.json()) as UsdaFile;
    const total = file.foods.length;
    let start = Number(localStorage.getItem(RESUME_KEY) ?? 0) || 0;
    if (start >= total) start = 0;
    for (let i = start; i < total; i += BATCH) {
      const foods = file.foods.slice(i, i + BATCH).map((r) => usdaFood(r, file.nutrients));
      await db.transaction('rw', db.foods, db.foodWords, async () => {
        const prev = await db.foods.bulkGet(foods.map((f) => f.id));
        foods.forEach((f, k) => {
          const p = prev[k];
          if (!p) return;
          for (const key of KEEP) if (p[key] != null) (f as unknown as Record<string, unknown>)[key] = p[key];
        });
        await db.foods.bulkPut(foods);
        await db.foodWords.bulkPut(foods.flatMap((f) => indexWords(f).map((word) => ({ word, foodId: f.id }))));
      });
      localStorage.setItem(RESUME_KEY, String(i + BATCH));
      set({ status: 'loading', done: Math.min(i + BATCH, total), total });
    }
    localStorage.removeItem(RESUME_KEY);
    await updateFoodSettings({ usdaRelease: USDA_RELEASE });
    set({ status: 'ready' });
  } catch (err) {
    set({ status: 'error', message: err instanceof Error ? err.message : String(err) });
  }
}

export function useFoodDb(): FoodDbState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
