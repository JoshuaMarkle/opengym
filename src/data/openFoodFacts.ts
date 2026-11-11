// Open Food Facts (nutrition-plan §3.8, Phase 8): text search and barcode lookup for packaged
// foods. Open data, no key. Requests carry the app's name and nothing about you. Results you only
// look at are not stored; a food joins your library when you log, star or scan it.
//
// Their search is rate-limited (about 10 a minute), so the add screen only searches after
// typing pauses, at 2+ characters, and when local results are fewer than 8 (wantsOnline).

import type { Food } from '../db/types';
import { offBasis, offBrand, offName, offNutrients, offServing, offUsable, type OffProduct } from '../lib/nutrition';

const BASE = 'https://world.openfoodfacts.org';
const FIELDS = 'code,product_name,product_name_en,generic_name,brands,serving_size,serving_quantity,serving_quantity_unit,quantity,nutriments';
const TIMEOUT_MS = 8000;

/**
 * Dev only: canned responses so the screenshot script (scripts/screens.ts) never hits the
 * network. `window.__og.off = { search: OffProduct[], products: { [code]: OffProduct } }`.
 */
function mock(): { search?: OffProduct[]; products?: Record<string, OffProduct> } | undefined {
  if (!import.meta.env.DEV) return undefined;
  return (window as unknown as { __og?: { off?: { search?: OffProduct[]; products?: Record<string, OffProduct> } } }).__og?.off;
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

/** An Open Food Facts product as a food (not saved). Undefined when it has no name or calories. */
export function foodFromOff(p: OffProduct): Food | undefined {
  if (!p.code || !offUsable(p)) return undefined;
  const serving = offServing(p);
  const t = Date.now();
  return {
    id: `off-${p.code}`,
    createdAt: t,
    updatedAt: t,
    name: offName(p)!,
    ...(offBrand(p) ? { brand: offBrand(p) } : {}),
    barcode: p.code,
    offCode: p.code,
    source: 'off',
    basis: offBasis(p),
    per100: offNutrients(p.nutriments),
    servings: serving ? [serving] : [],
    ...(serving ? { defaultServing: 0 } : {}),
  };
}

async function get(url: string, signal?: AbortSignal): Promise<unknown> {
  const ctl = new AbortController();
  const timer = window.setTimeout(() => ctl.abort(), TIMEOUT_MS);
  signal?.addEventListener('abort', () => ctl.abort());
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    window.clearTimeout(timer);
  }
}

/** Text search. Throws when offline or on a network error; the caller shows the offline line. */
export async function searchOff(query: string, signal?: AbortSignal): Promise<Food[]> {
  const m = mock();
  if (m) return (m.search ?? []).map(foodFromOff).filter((f): f is Food => !!f);
  const url = `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=24&fields=${FIELDS}&app_name=OpenGym`;
  const data = (await get(url, signal)) as { products?: OffProduct[] };
  return (data.products ?? []).map(foodFromOff).filter((f): f is Food => !!f);
}

/** One product by barcode: the food, `null` when Open Food Facts doesn't know it. Throws offline. */
export async function lookupBarcode(code: string): Promise<Food | null> {
  const m = mock();
  if (m) {
    const p = m.products?.[code];
    return p ? (foodFromOff({ ...p, code }) ?? null) : null;
  }
  const data = (await get(`${BASE}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}&app_name=OpenGym`)) as { status?: number; product?: OffProduct };
  if (data.status !== 1 || !data.product) return null;
  return foodFromOff({ ...data.product, code }) ?? null;
}
