// Personal nutrient targets (nutrition-plan §3.14, SPEC §14): the US Dietary Reference Intakes
// by sex and age, the RDA where one exists, else the Adequate Intake. Pregnancy and lactation
// values are not offered. Calories and macros come from the Food target, not from here.

import type { NutrientId } from './nutrients';

export type Sex = 'm' | 'f';

/**
 * How a nutrient is judged against its number:
 * - `floor`: reaching it is good (a check), going past it is fine. Orange only past `ul`.
 * - `limit`: the number is a ceiling (sodium, saturated fat). Orange past it, with the word "over".
 */
export type TargetKind = 'floor' | 'limit';

export interface NutrientTarget {
  amount: number;
  kind: TargetKind;
  /** Tolerable upper intake from all sources, where the DRIs set one. */
  ul?: number;
}

/** Age bands of the DRI tables. Under 14 uses 14–18. */
type Band = 0 | 1 | 2 | 3 | 4; // 14–18, 19–30, 31–50, 51–70, 71+

export function ageBand(age: number): Band {
  if (age < 19) return 0;
  if (age < 31) return 1;
  if (age < 51) return 2;
  if (age < 71) return 3;
  return 4;
}

/** [band 14–18, 19–30, 31–50, 51–70, 71+] for men, then women. */
type Row = { m: [number, number, number, number, number]; f: [number, number, number, number, number] };
const all = (v: number): Row => ({ m: [v, v, v, v, v], f: [v, v, v, v, v] });

/** RDA or AI (Food and Nutrition Board, National Academies; potassium and sodium from the 2019 update). */
const RDA: Partial<Record<NutrientId, Row>> = {
  vitA: { m: [900, 900, 900, 900, 900], f: [700, 700, 700, 700, 700] },
  b1: { m: [1.2, 1.2, 1.2, 1.2, 1.2], f: [1.0, 1.1, 1.1, 1.1, 1.1] },
  b2: { m: [1.3, 1.3, 1.3, 1.3, 1.3], f: [1.0, 1.1, 1.1, 1.1, 1.1] },
  b3: { m: [16, 16, 16, 16, 16], f: [14, 14, 14, 14, 14] },
  b5: all(5),
  b6: { m: [1.3, 1.3, 1.3, 1.7, 1.7], f: [1.2, 1.3, 1.3, 1.5, 1.5] },
  b12: all(2.4),
  folate: all(400),
  vitC: { m: [75, 90, 90, 90, 90], f: [65, 75, 75, 75, 75] },
  vitD: { m: [15, 15, 15, 15, 20], f: [15, 15, 15, 15, 20] },
  vitE: all(15),
  vitK: { m: [75, 120, 120, 120, 120], f: [75, 90, 90, 90, 90] },
  choline: { m: [550, 550, 550, 550, 550], f: [400, 425, 425, 425, 425] },
  calcium: { m: [1300, 1000, 1000, 1000, 1200], f: [1300, 1000, 1000, 1200, 1200] },
  copper: { m: [0.89, 0.9, 0.9, 0.9, 0.9], f: [0.89, 0.9, 0.9, 0.9, 0.9] },
  iron: { m: [11, 8, 8, 8, 8], f: [15, 18, 18, 8, 8] },
  magnesium: { m: [410, 400, 420, 420, 420], f: [360, 310, 320, 320, 320] },
  manganese: { m: [2.2, 2.3, 2.3, 2.3, 2.3], f: [1.6, 1.8, 1.8, 1.8, 1.8] },
  phosphorus: { m: [1250, 700, 700, 700, 700], f: [1250, 700, 700, 700, 700] },
  potassium: { m: [3000, 3400, 3400, 3400, 3400], f: [2300, 2600, 2600, 2600, 2600] },
  selenium: all(55),
  zinc: { m: [11, 11, 11, 11, 11], f: [9, 8, 8, 8, 8] },
  omega3: { m: [1.6, 1.6, 1.6, 1.6, 1.6], f: [1.1, 1.1, 1.1, 1.1, 1.1] },
  omega6: { m: [16, 17, 17, 14, 14], f: [11, 12, 12, 11, 11] },
};

/**
 * Tolerable upper intakes that apply to food and supplements together. Vitamin A (preformed
 * only), vitamin E, niacin, folate and magnesium have ULs that cover supplements or synthetic
 * forms only, so a day of vegetables could never honestly cross them; they get no UL here.
 */
const UL: Partial<Record<NutrientId, Row>> = {
  vitC: { m: [1800, 2000, 2000, 2000, 2000], f: [1800, 2000, 2000, 2000, 2000] },
  vitD: all(100),
  b6: { m: [80, 100, 100, 100, 100], f: [80, 100, 100, 100, 100] },
  choline: { m: [3000, 3500, 3500, 3500, 3500], f: [3000, 3500, 3500, 3500, 3500] },
  calcium: { m: [3000, 2500, 2500, 2000, 2000], f: [3000, 2500, 2500, 2000, 2000] },
  copper: { m: [8, 10, 10, 10, 10], f: [8, 10, 10, 10, 10] },
  iron: all(45),
  manganese: { m: [9, 11, 11, 11, 11], f: [9, 11, 11, 11, 11] },
  phosphorus: { m: [4000, 4000, 4000, 4000, 3000], f: [4000, 4000, 4000, 4000, 3000] },
  selenium: all(400),
  zinc: { m: [34, 40, 40, 40, 40], f: [34, 40, 40, 40, 40] },
};

/** Fiber follows calories: 14 g per 1,000 kcal (Dietary Guidelines). */
export const FIBER_PER_1000_KCAL = 14;

/** Calories used for calorie-based targets when there is no calorie target (Just log). */
export const DEFAULT_KCAL = 2000;

export interface Profile {
  /** Unknown: each number is the larger of the men's and women's values. */
  sex?: Sex;
  /** Unknown: 30. */
  age?: number;
}

/**
 * Every micronutrient target for a profile and a calorie target. Limits: sodium 2,300 mg,
 * saturated fat and added sugars 10% of calories, trans fat 1% of calories, cholesterol
 * 300 mg. Nutrients with no target (sugars, starch, mono- and polyunsaturated fat, alcohol,
 * caffeine) are absent.
 */
export function driTargets(profile: Profile, kcal: number | undefined, overrides: Partial<Record<NutrientId, number>> = {}): Partial<Record<NutrientId, NutrientTarget>> {
  const band = ageBand(profile.age ?? 30);
  const pick = (r: Row) => (profile.sex ? r[profile.sex][band] : Math.max(r.m[band], r.f[band]));
  const cal = kcal ?? DEFAULT_KCAL;
  const out: Partial<Record<NutrientId, NutrientTarget>> = {};
  for (const [id, row] of Object.entries(RDA) as [NutrientId, Row][]) {
    const ul = UL[id];
    out[id] = { amount: pick(row), kind: 'floor', ...(ul ? { ul: pick(ul) } : {}) };
  }
  out.fiber = { amount: Math.round((cal / 1000) * FIBER_PER_1000_KCAL), kind: 'floor' };
  out.sodium = { amount: 2300, kind: 'limit' };
  out.sat = { amount: Math.round((cal * 0.1) / 9), kind: 'limit' };
  out.addedSugars = { amount: Math.round((cal * 0.1) / 4), kind: 'limit' };
  out.trans = { amount: Math.round(((cal * 0.01) / 9) * 10) / 10, kind: 'limit' };
  out.cholesterol = { amount: 300, kind: 'limit' };
  for (const [id, v] of Object.entries(overrides) as [NutrientId, number][]) {
    if (v == null || !Number.isFinite(v)) continue;
    out[id] = { ...(out[id] ?? { kind: 'floor' }), amount: v };
  }
  return out;
}

/** Age on a day from a birth year (as of Jul 1, so it never jumps a year early). */
export function ageFrom(birthYear: number | undefined, dayKey: string): number | undefined {
  if (!birthYear) return undefined;
  const [y, m] = dayKey.split('-').map(Number);
  return y - birthYear - (m < 7 ? 1 : 0);
}
