// Macro splits (nutrition-plan §3.4, SPEC §14). Calories are the source of truth; grams come
// from the split and round to the nearest 5 g.

import type { DietId, Triple } from '../../db/types';

export interface Diet {
  id: DietId;
  name: string;
  note: string;
  /** Fixed percentages; Lifter and Custom work theirs out. */
  pct?: Triple;
}

export const DIETS: Diet[] = [
  { id: 'lifter', name: 'Lifter', note: 'Protein 1 g per lb, rest carbs' },
  { id: 'balanced', name: 'Balanced', note: 'Even split, easy to follow', pct: [30, 40, 30] },
  { id: 'highProtein', name: 'High protein', note: 'For cutting, keeps you full', pct: [40, 35, 25] },
  { id: 'lowCarb', name: 'Low carb', note: 'Fewer carbs, more fat', pct: [35, 25, 40] },
  { id: 'keto', name: 'Keto', note: 'Under ~35 g carbs a day', pct: [25, 5, 70] },
  { id: 'endurance', name: 'Endurance', note: 'For lots of cardio', pct: [20, 55, 25] },
  { id: 'custom', name: 'Custom', note: 'Your own split' },
];

export const DIET: Record<DietId, Diet> = Object.fromEntries(DIETS.map((d) => [d.id, d])) as Record<DietId, Diet>;

/** Lifter: fat is 27% of calories. */
export const LIFTER_FAT_PCT = 27;
/** Lifter: protein is capped at 40% of calories (a small calorie target). */
export const LIFTER_PROTEIN_CAP = 40;
/** No macro goes under 5% in Custom. */
export const MIN_PCT = 5;

export const round5 = (g: number) => Math.round(g / 5) * 5;

/** Grams from calories and a split: protein and carbs 4 kcal/g, fat 9. */
export function gramsFromPct(kcal: number, pct: Triple): Triple {
  return [round5((kcal * pct[0]) / 100 / 4), round5((kcal * pct[1]) / 100 / 4), round5((kcal * pct[2]) / 100 / 9)];
}

/**
 * Lifter: protein 1 g per lb of bodyweight (capped at 40% of calories), fat 27%, carbs the rest.
 * Percentages are shown as computed: 190 lb at 2,700 kcal is 28 / 45 / 27.
 */
export function lifterSplit(kcal: number, weightLb: number): { pct: Triple; grams: Triple } {
  const proteinKcal = Math.min(weightLb * 4, (kcal * LIFTER_PROTEIN_CAP) / 100);
  const p = Math.round((proteinKcal / kcal) * 100);
  const f = LIFTER_FAT_PCT;
  const c = 100 - p - f;
  const fatG = round5((kcal * f) / 100 / 9);
  const proteinG = round5(proteinKcal / 4);
  const carbG = round5((kcal - proteinG * 4 - fatG * 9) / 4);
  return { pct: [p, c, f], grams: [proteinG, Math.max(0, carbG), fatG] };
}

/** A diet's split for a calorie target. Custom uses `custom`. */
export function splitFor(diet: DietId, kcal: number, weightLb: number | undefined, custom?: Triple): { pct: Triple; grams: Triple } {
  if (diet === 'lifter') return lifterSplit(kcal, weightLb ?? kcal / 14);
  const pct = diet === 'custom' ? (custom ?? [30, 40, 30]) : DIET[diet].pct!;
  return { pct, grams: gramsFromPct(kcal, pct) };
}

/** Custom stepper: + adds 2% to a macro and takes 1% from each of the others; − does the opposite. */
export function stepPct(pct: Triple, i: 0 | 1 | 2, dir: 1 | -1): Triple {
  const out = [...pct] as Triple;
  out[i] += 2 * dir;
  for (const j of [0, 1, 2] as const) if (j !== i) out[j] -= dir;
  return out;
}

/** A stepper is disabled when it would push any macro under 5%. */
export function canStep(pct: Triple, i: 0 | 1 | 2, dir: 1 | -1): boolean {
  return stepPct(pct, i, dir).every((v) => v >= MIN_PCT);
}

/** Share of calories from each macro, in whole percent (for the ring card). */
export function kcalShare(p: number, c: number, f: number): Triple {
  const parts = [p * 4, c * 4, f * 9];
  const total = parts[0] + parts[1] + parts[2];
  if (!total) return [0, 0, 0];
  return parts.map((x) => Math.round((x / total) * 100)) as Triple;
}
