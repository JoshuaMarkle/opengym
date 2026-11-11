// Day and meal totals (nutrition-plan §3.3, §3.14, SPEC §14): sums over every nutrient with
// missing-data tracking, left / over, the 3% rule, floors and limits, and week stats.

import type { NutrientTarget } from './dri';
import { NUTRIENT_IDS, type NutrientId, type Nutrients } from './nutrients';
import type { DayTargets } from './targets';

export interface Summable {
  id: string;
  name: string;
  totals: Nutrients;
  estimated?: NutrientId[];
}

export interface Sum {
  /** Only nutrients at least one entry knows. */
  totals: Nutrients;
  /** Per nutrient, the entries that have no value for it (they add nothing). */
  missing: Partial<Record<NutrientId, Summable[]>>;
  /** Nutrients where at least one value was borrowed from a similar food. */
  estimated: Set<NutrientId>;
  count: number;
}

/** Add up entries. A missing value adds nothing and is listed, never guessed. */
export function sumEntries(entries: Summable[]): Sum {
  const totals: Nutrients = {};
  const missing: Partial<Record<NutrientId, Summable[]>> = {};
  const estimated = new Set<NutrientId>();
  for (const e of entries) {
    for (const id of NUTRIENT_IDS) {
      const v = e.totals[id];
      if (v == null) (missing[id] ??= []).push(e);
      else totals[id] = (totals[id] ?? 0) + v;
    }
    for (const id of e.estimated ?? []) estimated.add(id);
  }
  // A nutrient nobody knows isn't "missing from every food": it's simply unknown ("—").
  for (const id of NUTRIENT_IDS) if (totals[id] == null) delete missing[id];
  return { totals, missing, estimated, count: entries.length };
}

/** Orange only past 3% over, so a 2,720 day on 2,700 isn't a failure. */
export const OVER_GRACE = 0.03;

export type Tone = 'fg' | 'warn';

export interface Status {
  /** Bar fill 0–1 (past the target the bar is full). */
  frac: number;
  /** Orange: always shown with the word "over". */
  over: boolean;
  /** A floor reached: a check, never a color change. */
  met: boolean;
}

/** Calories, carbs and fat: a ceiling with the 3% grace. */
export function ceilingStatus(amount: number, target: number): Status {
  return { frac: target > 0 ? amount / target : 0, over: amount > target * (1 + OVER_GRACE), met: false };
}

/** Protein: a floor. At or over target gets a check; it never turns orange. */
export function floorStatus(amount: number, target: number): Status {
  return { frac: target > 0 ? amount / target : 0, over: false, met: amount >= target };
}

/** A micronutrient against its target: floors check at the target and go orange only past the upper limit; limits go orange past the limit. */
export function microStatus(amount: number, t: NutrientTarget): Status {
  if (t.kind === 'limit') return { frac: t.amount > 0 ? amount / t.amount : 0, over: amount > t.amount, met: false };
  return { frac: t.amount > 0 ? amount / t.amount : 0, over: t.ul != null && amount > t.ul, met: amount >= t.amount };
}

/** Status of any nutrient against a day's targets, or undefined when it has no target. */
export function nutrientStatus(id: NutrientId, amount: number, t: DayTargets): Status | undefined {
  if (id === 'kcal' || id === 'c' || id === 'f') {
    const target = t[id];
    return target ? ceilingStatus(amount, target) : undefined;
  }
  if (id === 'p') return t.p ? floorStatus(amount, t.p) : undefined;
  const m = t.micro[id];
  return m ? microStatus(amount, m) : undefined;
}

/** The target for a nutrient on a day (macros from the Food target, the rest from the DRIs). */
export function targetAmount(id: NutrientId, t: DayTargets): number | undefined {
  if (id === 'kcal' || id === 'p' || id === 'c' || id === 'f') return t[id];
  return t.micro[id]?.amount;
}

/** % of your own target, or undefined when the nutrient has no target. */
export function pctOfTarget(id: NutrientId, amount: number | undefined, t: DayTargets): number | undefined {
  const target = targetAmount(id, t);
  if (amount == null || !target) return undefined;
  return Math.round((amount / target) * 100);
}

/** "1,356 left" / "40 over": the plain difference, always. */
export function leftOver(amount: number, target: number): { n: number; word: 'left' | 'over' } {
  const d = Math.round(target - amount);
  return d >= 0 ? { n: d, word: 'left' } : { n: -d, word: 'over' };
}

/** On target (week stat): calories between 90% and 103% of target. */
export function onTarget(kcal: number, target: number): boolean {
  return kcal >= target * 0.9 && kcal <= target * (1 + OVER_GRACE);
}

export interface WeekDay {
  day: string;
  totals: Nutrients;
  count: number;
  targets: DayTargets;
}

export interface WeekStats {
  /** Days that count: on or before today, with anything logged. */
  days: number;
  avg: { kcal: number; p: number; c: number; f: number };
  /** Calories 90–103% of target, of the counted days that have a target. */
  onTarget: { n: number; of: number };
  /** Protein at or over target, of the counted days that have a target. */
  proteinHit: { n: number; of: number };
  /** Average targets over the counted days with one. */
  target?: { kcal: number; p: number; c: number; f: number };
}

/** Week stats. Empty days and future days are left out of averages and of "x of y". */
export function weekStats(days: WeekDay[], today: string): WeekStats {
  const counted = days.filter((d) => d.day <= today && d.count > 0);
  const n = counted.length;
  const avg = (k: 'kcal' | 'p' | 'c' | 'f') => (n ? counted.reduce((s, d) => s + (d.totals[k] ?? 0), 0) / n : 0);
  const withKcal = counted.filter((d) => d.targets.kcal);
  const withP = counted.filter((d) => d.targets.p);
  const tAvg = (k: 'kcal' | 'p' | 'c' | 'f') => withKcal.reduce((s, d) => s + (d.targets[k] ?? 0), 0) / withKcal.length;
  return {
    days: n,
    avg: { kcal: avg('kcal'), p: avg('p'), c: avg('c'), f: avg('f') },
    onTarget: { n: withKcal.filter((d) => onTarget(d.totals.kcal ?? 0, d.targets.kcal!)).length, of: withKcal.length },
    proteinHit: { n: withP.filter((d) => (d.totals.p ?? 0) >= d.targets.p!).length, of: withP.length },
    target: withKcal.length ? { kcal: tAvg('kcal'), p: tAvg('p'), c: tAvg('c'), f: tAvg('f') } : undefined,
  };
}

/** Entries that gave the most of a nutrient, largest first ("where did my sodium come from"). */
export function topContributors<T extends Summable>(entries: T[], id: NutrientId): { entry: T; amount: number; share: number }[] {
  const withV = entries.filter((e) => (e.totals[id] ?? 0) > 0);
  const total = withV.reduce((s, e) => s + (e.totals[id] ?? 0), 0);
  return withV
    .map((entry) => ({ entry, amount: entry.totals[id]!, share: total ? entry.totals[id]! / total : 0 }))
    .sort((a, b) => b.amount - a.amount);
}
