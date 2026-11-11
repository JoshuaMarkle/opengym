// Target versions (nutrition-plan §3.4): changes apply from today, past days keep theirs.

import type { FoodTarget } from '../../db/types';
import { ageFrom, driTargets, type NutrientTarget } from './dri';
import type { NutrientId } from './nutrients';

/** The version in force on a day: the latest with `from` ≤ day. None before the first one. */
export function targetFor<T extends Pick<FoodTarget, 'from' | 'createdAt'>>(versions: T[], day: string): T | undefined {
  let best: T | undefined;
  for (const v of versions) {
    if (v.from > day) continue;
    if (!best || v.from > best.from || (v.from === best.from && v.createdAt > best.createdAt)) best = v;
  }
  return best;
}

/** Calories and macro grams on a day, or none in Just log mode (or before setup). */
export interface DayTargets {
  kcal?: number;
  p?: number;
  c?: number;
  f?: number;
  /** Every micronutrient target. */
  micro: Partial<Record<NutrientId, NutrientTarget>>;
}

export function dayTargets(version: FoodTarget | undefined, day: string, fallback: { sex?: 'm' | 'f'; birthYear?: number } = {}): DayTargets {
  const sex = version?.sex ?? fallback.sex;
  const age = ageFrom(version?.birthYear ?? fallback.birthYear, day);
  const on = version?.mode === 'target' && version.kcal != null;
  const micro = driTargets({ sex, age }, on ? version!.kcal : undefined, version?.overrides);
  if (!on) return { micro };
  return { kcal: version!.kcal, p: version!.grams[0], c: version!.grams[1], f: version!.grams[2], micro };
}
