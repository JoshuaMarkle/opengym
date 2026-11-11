// Live reads for the Food tab (SPEC §14). Pure math lives in src/lib/nutrition; these hooks only
// fetch rows and pair each day with the target version in force on it.

import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '../db/db';
import type { Food, FoodEntry, FoodSettings, FoodTarget, SavedMeal } from '../db/types';
import { dayTargets, targetFor, type DayTargets } from '../lib/nutrition';
import { useSettings } from './DataProvider';
import { foodSettingsOf } from './food';

export function useFoodSettings(): FoodSettings {
  const settings = useSettings();
  return useMemo(() => foodSettingsOf(settings), [settings]);
}

/** Every target version, oldest first. Undefined while loading. */
export function useTargetVersions(): FoodTarget[] | undefined {
  return useLiveQuery(() => db.foodTargets.orderBy('from').toArray(), []);
}

/** The targets for a day from the version in force on it (none in Just log mode). */
export function targetsOn(versions: FoodTarget[] | undefined, day: string, fs: FoodSettings): DayTargets {
  return dayTargets(targetFor(versions ?? [], day), day, { sex: fs.sex, birthYear: fs.birthYear });
}

export function useDayTargets(day: string): DayTargets | undefined {
  const versions = useTargetVersions();
  const fs = useFoodSettings();
  return useMemo(() => (versions ? targetsOn(versions, day, fs) : undefined), [versions, day, fs]);
}

/** A day's entries in meal order. Undefined while loading. */
export function useDayEntries(day: string): FoodEntry[] | undefined {
  return useLiveQuery(() => db.foodEntries.where('day').equals(day).sortBy('order'), [day]);
}

/** Entries from `from` to `to` (inclusive day keys). */
export function useRangeEntries(from: string, to: string): FoodEntry[] | undefined {
  return useLiveQuery(() => db.foodEntries.where('day').between(from, to, true, true).toArray(), [from, to]);
}

export function useFood(id: string | undefined): Food | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.foods.get(id)) ?? null) : null), [id]);
}

export function useEntry(id: string | undefined): FoodEntry | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.foodEntries.get(id)) ?? null) : null), [id]);
}

export function useSavedMeals(): SavedMeal[] | undefined {
  return useLiveQuery(async () => (await db.savedMeals.orderBy('order').toArray()).filter((m) => !m.deletedAt), []);
}
