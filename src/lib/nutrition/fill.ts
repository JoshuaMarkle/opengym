// "Fill in missing nutrients" (nutrition-plan §3.14): borrow the nutrients a packaged or custom
// food lacks from a similar built-in USDA food. Label values always win; borrowed values are
// marked estimated and shown with "~".

import { words } from './foodSearch';
import { MICROS, type NutrientId, type Nutrients } from './nutrients';

/** Micronutrients a food has no value for. */
export function missingMicros(per100: Nutrients): NutrientId[] {
  return MICROS.filter((id) => per100[id] == null);
}

/** Offer "Fill in missing nutrients" when a non-USDA food lacks most micronutrients. */
export function needsFill(food: { source: string; per100: Nutrients }): boolean {
  return food.source !== 'usda' && missingMicros(food.per100).length > MICROS.length / 2;
}

/** Words that say little about what a food is. */
const STOP = new Set(['and', 'or', 'with', 'without', 'in', 'of', 'the', 'a', 'raw', 'nfs', 'ns', 'as', 'to', 'from', 'made', 'type', 'style', 'brand', 'plain', 'regular', 'prepared', 'commercial', 'g', 'oz']);

const keyWords = (s: string) => words(s).filter((w) => !STOP.has(w) && !/^\d+$/.test(w));

/** Light singular: "oats" → "oat", "berries" → "berry". */
function stem(w: string): string {
  if (w.endsWith('ies') && w.length > 4) return `${w.slice(0, -3)}y`;
  if (w.endsWith('es') && /(ch|sh|ss|x|o)es$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
  return w;
}

/**
 * How alike two food names are, about 0–1: shared key words (stemmed) over the query's, with a bonus
 * when the USDA name leads with one of them ("Greek yogurt" → "Yogurt, Greek, plain…"). `weight`
 * can make rare words count more than common ones ("protein" over "chocolate").
 */
export function similarity(query: string, candidate: string, weight: (w: string) => number = () => 1): number {
  const q = [...new Set(keyWords(query).map(stem))];
  const c = keyWords(candidate).map(stem);
  if (!q.length || !c.length) return 0;
  const cs = new Set(c);
  const total = q.reduce((t, w) => t + weight(w), 0);
  const shared = q.filter((w) => cs.has(w)).reduce((t, w) => t + weight(w), 0);
  if (!shared) return 0;
  // Covering every word of the name counts most; leading with one of them and a shorter, more
  // generic USDA name break ties.
  const lead = q.includes(c[0]) ? 0.1 : 0;
  return Math.max(0, shared / total + lead - Math.min(c.length, 12) * 0.01);
}

/**
 * The closest candidates by name, best first. Words that appear in fewer candidates weigh more
 * (inverse document frequency over the candidates), so the telling word of a name wins.
 */
export function closestFoods<T extends { name: string; detail?: string }>(name: string, candidates: T[], n = 5): T[] {
  const df = new Map<string, number>();
  for (const f of candidates) for (const w of new Set(keyWords(`${f.name} ${f.detail ?? ''}`).map(stem))) df.set(w, (df.get(w) ?? 0) + 1);
  const N = Math.max(candidates.length, 1);
  const weight = (w: string) => 1 + 0.4 * Math.log((N + 1) / ((df.get(w) ?? 0) + 1));
  return candidates
    .map((f) => ({ f, s: Math.max(similarity(name, f.name, weight), similarity(name, f.detail ?? '', weight) - 0.05) }))
    .filter((x) => x.s > 0.3)
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.f);
}

/** Copy only the micronutrients the food lacks, per 100 g, and mark them estimated. Calories and macros are never borrowed. */
export function fillMissing(food: { per100: Nutrients; estimated?: NutrientId[] }, from: { per100: Nutrients }): { per100: Nutrients; estimated: NutrientId[]; filled: NutrientId[] } {
  const per100 = { ...food.per100 };
  const filled: NutrientId[] = [];
  for (const id of MICROS) {
    if (per100[id] != null) continue;
    const v = from.per100[id];
    if (v == null) continue;
    per100[id] = v;
    filled.push(id);
  }
  return { per100, estimated: [...new Set([...(food.estimated ?? []), ...filled])], filled };
}
