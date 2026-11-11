// Food search (nutrition-plan §3.5, §3.8): name words for the prefix index, local ranking,
// "Usually at <meal>", recents, and merging Open Food Facts results without duplicates.

import type { MealId } from '../../db/types';

export interface SearchFood {
  id: string;
  name: string;
  brand?: string;
  detail?: string;
  source: 'usda' | 'off' | 'custom';
  favorite?: boolean;
  mine?: boolean;
  barcode?: string;
  offCode?: string;
  deletedAt?: number;
}

/** Lowercase words without accents or punctuation: "Crème fraîche, 30%" → crème→creme, fraiche, 30. */
export function words(s: string | undefined): string[] {
  if (!s) return [];
  const out = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return [...new Set(out)];
}

/** Words that go into the prefix index for a food: its name, brand and detail line. */
export function indexWords(f: Pick<SearchFood, 'name' | 'brand' | 'detail'>): string[] {
  return [...new Set([...words(f.name), ...words(f.brand), ...words(f.detail)])];
}

/** Every query word must start some word of the food. */
export function matches(query: string[], f: Pick<SearchFood, 'name' | 'brand' | 'detail'>): boolean {
  if (!query.length) return false;
  const have = indexWords(f);
  return query.every((q) => have.some((w) => w.startsWith(q)));
}

/** The query word to look up in the index: the longest one narrows the most. */
export function leadWord(query: string[]): string | undefined {
  return [...query].sort((a, b) => b.length - a.length)[0];
}

/**
 * How well a name answers a query, higher first: the name starts with the query, every word
 * is in the name (not just the detail line), whole-word hits, and short names before long ones.
 */
export function matchQuality(query: string[], f: Pick<SearchFood, 'name' | 'brand' | 'detail'>): number {
  const name = words(f.name);
  const joined = f.name.toLowerCase();
  let q = 0;
  if (joined.startsWith(query.join(' '))) q += 40;
  else if (name[0]?.startsWith(query[0])) q += 25;
  const inName = query.filter((w) => name.some((n) => n.startsWith(w))).length;
  q += (inName / query.length) * 30;
  q += query.filter((w) => name.includes(w)).length * 4;
  q -= Math.min(name.length, 15) * 1.5;
  return q;
}

/**
 * Local results in order (§3.5): your own foods and foods you've logged first, by how often you
 * log them; then the built-in USDA foods, short names first.
 */
export function rankFoods<T extends SearchFood>(query: string, foods: T[], logCounts: Map<string, number>, limit = 60): T[] {
  const q = words(query);
  if (!q.length) return [];
  const scored = foods
    .filter((f) => !f.deletedAt && matches(q, f))
    .map((f) => {
      const count = logCounts.get(f.id) ?? 0;
      const yours = f.mine || f.source !== 'usda' || count > 0 || f.favorite;
      // A hand-written short name ("Chicken breast, roasted") marks a common food: ahead of the long tail.
      const named = f.source === 'usda' && !!f.detail ? 12 : 0;
      return { f, yours, count, quality: matchQuality(q, f) + named };
    });
  scored.sort((a, b) => Number(b.yours) - Number(a.yours) || b.count - a.count || Number(!!b.f.favorite) - Number(!!a.f.favorite) || b.quality - a.quality || a.f.name.localeCompare(b.f.name));
  return scored.slice(0, limit).map((s) => s.f);
}

export interface LoggedRef {
  foodId?: string;
  meal: MealId;
  loggedAt: number;
}

/** How many times each food has been logged. */
export function logCounts(entries: LoggedRef[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of entries) if (e.foodId) m.set(e.foodId, (m.get(e.foodId) ?? 0) + 1);
  return m;
}

/** "Usually at <meal>": up to 3 foods logged at that meal at least 3 times in the last 30 days. */
export function usuallyAt(entries: LoggedRef[], meal: MealId, now: number, min = 3, max = 3): string[] {
  const since = now - 30 * 86_400_000;
  const m = new Map<string, number>();
  for (const e of entries) if (e.foodId && e.meal === meal && e.loggedAt >= since) m.set(e.foodId, (m.get(e.foodId) ?? 0) + 1);
  return [...m]
    .filter(([, n]) => n >= min)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([id]) => id);
}

/** Recent: the last `n` distinct foods logged, newest first. */
export function recentFoods(entries: LoggedRef[], n = 20): string[] {
  const out: string[] = [];
  for (const e of [...entries].sort((a, b) => b.loggedAt - a.loggedAt)) {
    if (!e.foodId || out.includes(e.foodId)) continue;
    out.push(e.foodId);
    if (out.length >= n) break;
  }
  return out;
}

/** Online results minus the ones already in the local list (same barcode or Open Food Facts code). */
export function mergeOnline<T extends Pick<SearchFood, 'barcode' | 'offCode'>>(local: Pick<SearchFood, 'barcode' | 'offCode'>[], online: T[]): T[] {
  const seen = new Set(local.flatMap((f) => [f.barcode, f.offCode].filter((x): x is string => !!x)));
  const out: T[] = [];
  for (const f of online) {
    const keys = [f.barcode, f.offCode].filter((x): x is string => !!x);
    if (keys.some((k) => seen.has(k))) continue;
    keys.forEach((k) => seen.add(k));
    out.push(f);
  }
  return out;
}

/** Online search only runs at 2+ characters and when local results are fewer than 8. */
export function wantsOnline(query: string, localCount: number): boolean {
  return query.trim().length >= 2 && localCount < 8;
}
