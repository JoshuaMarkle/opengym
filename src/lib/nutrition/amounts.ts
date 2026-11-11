// Amounts (nutrition-plan §3.5): g / oz / serving, per-100 values → totals, ± steps.

import type { AmountUnit, FoodServing } from '../../db/types';
import { scaleNutrients, type Nutrients } from './nutrients';

export const G_PER_OZ = 28.349523125;
export const ML_PER_FL_OZ = 29.5735295625;

/** The unit's label: g / serv / oz, or ml / serv / fl oz for liquids. */
export function unitLabel(unit: AmountUnit, basis: 'g' | 'ml'): string {
  if (unit === 'serv') return 'serv';
  if (unit === 'oz') return basis === 'ml' ? 'fl oz' : 'oz';
  return basis === 'ml' ? 'ml' : 'g';
}

/** ± step per unit: 10 g, ¼ serving, 0.5 oz. */
export const STEP: Record<AmountUnit, number> = { g: 10, serv: 0.25, oz: 0.5 };

/** Grams (or ml) for a typed amount. `serving` is the serving's weight. */
export function toGrams(value: number, unit: AmountUnit, basis: 'g' | 'ml', servingGrams?: number): number {
  if (unit === 'serv') return value * (servingGrams ?? 100);
  if (unit === 'oz') return value * (basis === 'ml' ? ML_PER_FL_OZ : G_PER_OZ);
  return value;
}

/** The typed amount for some grams, in a unit (inverse of toGrams). */
export function fromGrams(grams: number, unit: AmountUnit, basis: 'g' | 'ml', servingGrams?: number): number {
  if (unit === 'serv') return grams / (servingGrams || 100);
  if (unit === 'oz') return grams / (basis === 'ml' ? ML_PER_FL_OZ : G_PER_OZ);
  return grams;
}

/** Nutrients for an amount of a food (per-100 values × grams / 100). */
export function totalsFor(per100: Nutrients, grams: number): Nutrients {
  return scaleNutrients(per100, grams / 100);
}

/** A tidy display number for an amount: whole grams, quarters of a serving, tenths of an ounce. */
export function roundAmount(v: number, unit: AmountUnit): number {
  if (unit === 'g') return Math.round(v);
  if (unit === 'serv') return Math.round(v * 100) / 100;
  return Math.round(v * 10) / 10;
}

/** "200 g", "1.5 cup · 280 g", "1 bar · 60 g", "2 × 2 tbsp · 64 g", "8 fl oz". */
export function amountLabel(grams: number, unit: AmountUnit | undefined, basis: 'g' | 'ml', servings: FoodServing[] | undefined, serving?: number): string {
  const g = `${Math.round(grams)} ${basis === 'ml' ? 'ml' : 'g'}`;
  if (unit === 'serv' && servings?.length) {
    const s = servings[serving ?? 0] ?? servings[0];
    return `${servingText(grams / s.grams, s.label)} · ${g}`;
  }
  if (unit === 'oz') return `${roundAmount(fromGrams(grams, 'oz', basis), 'oz')} ${unitLabel('oz', basis)}`;
  return g;
}

/** A count of a serving: 1 × "1 cup" → "1 cup", 1.5 × "1 cup" → "1.5 cup", 2 × "2 tbsp" → "2 × 2 tbsp". */
export function servingText(n: number, label: string): string {
  const count = String(roundAmount(n, 'serv'));
  if (Math.abs(n - 1) < 0.005) return label;
  const one = /^1\s+(.*)$/.exec(label.trim());
  return one ? `${count} ${one[1]}` : `${count} × ${label}`;
}

/** The serving to use by default: the food's own, else none (grams). */
export function defaultUnit(servings: FoodServing[]): AmountUnit {
  return servings.length ? 'serv' : 'g';
}

/**
 * The serving a built-in food starts on: USDA lists portions in its own order ("1 cup, mashed"
 * before "1 medium" for a banana), so prefer a whole item, then a spoon for dense foods (oil,
 * peanut butter) or a cup for the rest (milk, rice), then the first.
 */
export function pickServing(servings: FoodServing[], kcalPer100?: number): number {
  const find = (re: RegExp) => servings.findIndex((s) => re.test(s.label));
  const spoon = /^(1|2) (tbsp|tablespoon)/i;
  const cup = /^1 cup\b/i;
  const dense = (kcalPer100 ?? 0) >= 250;
  for (const re of [/^1 medium\b/i, /^1 (large|slice|scoop|bar|egg|piece|fillet|breast|link|patty|tortilla|container|serving)\b/i, dense ? spoon : cup, dense ? cup : spoon]) {
    const i = find(re);
    if (i >= 0) return i;
  }
  return 0;
}
