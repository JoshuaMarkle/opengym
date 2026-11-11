// Food days and meals (nutrition-plan §3.1–3.2, SPEC §14). A food day runs 3:00 am to 2:59 am,
// so a late snack lands on the night you ate it. The rest of the app keeps midnight.

import type { MealId } from '../../db/types';
import { dayKey } from '../dates';

export const MEALS: { id: MealId; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snacks', label: 'Snacks' },
];

export const MEAL_LABEL: Record<MealId, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snacks: 'Snacks' };

export const DAY_CUTOFF_HOUR = 3;

/** The food day a moment belongs to: dayKey(ts − 3 h), using the local clock. */
export function foodDayKey(ts: number): string {
  const d = new Date(ts);
  if (d.getHours() < DAY_CUTOFF_HOUR) d.setDate(d.getDate() - 1);
  return dayKey(d.getTime());
}

/**
 * The meal for a time of day: Breakfast 3:00–10:59, Lunch 11:00–15:59, Dinner 16:00 to the
 * 3:00 am cut-off. Snacks is never picked on its own.
 */
export function mealForTime(ts: number): MealId {
  const h = new Date(ts).getHours();
  if (h >= DAY_CUTOFF_HOUR && h < 11) return 'breakfast';
  if (h >= 11 && h < 16) return 'lunch';
  return 'dinner';
}

/** Noon on a day key, for date math that must not trip over DST. */
export function dayNoon(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getTime();
}

export function shiftDay(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n, 12).getTime());
}

/**
 * Which meal folders are open on a day page (§3.2). Today: the meal for the current window
 * opens on its own; a folder opened or closed by hand stays that way until the window changes,
 * then the new window's meal opens and the other choices are kept. Past and future days start
 * with every folder closed. Lives in memory only, so a relaunch starts fresh.
 */
export interface FoldState {
  window: MealId | null;
  open: MealId[];
}

export function initialFold(isToday: boolean, window: MealId): FoldState {
  return isToday ? { window, open: [window] } : { window: null, open: [] };
}

/** Apply the current window: when it moved on, open the new window's meal and keep the rest. */
export function syncFold(state: FoldState, isToday: boolean, window: MealId): FoldState {
  if (!isToday || state.window === window) return state;
  return { window, open: state.open.includes(window) ? state.open : [...state.open, window] };
}

export function toggleFold(state: FoldState, meal: MealId): FoldState {
  return { ...state, open: state.open.includes(meal) ? state.open.filter((m) => m !== meal) : [...state.open, meal] };
}

/** The 7 day keys of the week containing `key`, starting on `weekStart` (0 Sunday, 1 Monday). */
export function weekDays(key: string, weekStart: 0 | 1): string[] {
  const noon = new Date(dayNoon(key));
  const back = (noon.getDay() - weekStart + 7) % 7;
  const first = shiftDay(key, -back);
  return Array.from({ length: 7 }, (_, i) => shiftDay(first, i));
}
