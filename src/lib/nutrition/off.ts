// Open Food Facts product → a Food (nutrition-plan §3.8, Phase 8). Pure mapping; the network
// part lives in src/data/openFoodFacts.ts.

import type { FoodServing } from '../../db/types';
import { NUTRIENTS, type Nutrients } from './nutrients';
import { sig3 } from './label';

export interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  serving_quantity_unit?: string;
  quantity?: string;
  nutriments?: Record<string, number | string | undefined>;
}

/** Grams per unit of each nutrient's own unit, for converting OFF's per-100 g base values. */
const PER_G: Record<string, number> = { g: 1, mg: 1000, µg: 1_000_000 };

/** Every catalog nutrient the product has, per 100 g (or ml). Missing stays missing. */
export function offNutrients(nutriments: OffProduct['nutriments'] = {}): Nutrients {
  const out: Nutrients = {};
  const num = (k: string) => {
    const v = nutriments[k];
    const n = typeof v === 'string' ? Number(v) : v;
    return n != null && Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  for (const def of NUTRIENTS) {
    if (!def.off) continue;
    if (def.id === 'kcal') {
      const kcal = num('energy-kcal_100g') ?? (num('energy_100g') != null ? num('energy_100g')! / 4.184 : undefined);
      if (kcal != null) out.kcal = sig3(kcal);
      continue;
    }
    const v = num(`${def.off}_100g`);
    if (v == null) continue;
    out[def.id] = sig3(def.unit === 'kcal' ? v : v * PER_G[def.unit]);
  }
  // Labels print salt more often than sodium: sodium = salt / 2.5.
  if (out.sodium == null) {
    const salt = num('salt_100g');
    if (salt != null) out.sodium = sig3((salt / 2.5) * 1000);
  }
  return out;
}

/** "1 bar (58 g)" / "30g" / "250 ml" → a serving, when the grams can be read. */
export function offServing(p: Pick<OffProduct, 'serving_size' | 'serving_quantity' | 'serving_quantity_unit'>): FoodServing | undefined {
  const size = p.serving_size?.trim();
  const qty = typeof p.serving_quantity === 'string' ? Number(p.serving_quantity) : p.serving_quantity;
  let grams = qty && Number.isFinite(qty) && qty > 0 ? qty : undefined;
  if (!grams && size) {
    const m = /(\d+(?:[.,]\d+)?)\s*(g|ml)\b/i.exec(size);
    if (m) grams = Number(m[1].replace(',', '.'));
  }
  if (!grams) return undefined;
  let label = size ?? `${grams} g`;
  // "1 bar (58 g)" → "1 bar"; a bare "30 g" becomes "1 serving".
  const paren = /^(.*?)\s*\(.*\)\s*$/.exec(label);
  if (paren && paren[1]) label = paren[1];
  if (/^\d+(?:[.,]\d+)?\s*(g|ml)$/i.test(label)) label = '1 serving';
  if (!/^\d/.test(label)) label = `1 ${label}`;
  return { label, grams: Math.round(grams * 10) / 10 };
}

/** Liquids are measured per 100 ml. */
export function offBasis(p: Pick<OffProduct, 'serving_quantity_unit' | 'serving_size' | 'quantity'>): 'g' | 'ml' {
  if (p.serving_quantity_unit?.toLowerCase() === 'ml') return 'ml';
  const s = `${p.serving_size ?? ''} ${p.quantity ?? ''}`.toLowerCase();
  return /\d\s*(ml|cl|l)\b/.test(s) && !/\d\s*g\b/.test(s) ? 'ml' : 'g';
}

export function offName(p: OffProduct): string | undefined {
  const n = (p.product_name || p.product_name_en || p.generic_name || '').trim();
  return n || undefined;
}

export function offBrand(p: OffProduct): string | undefined {
  const b = p.brands?.split(',')[0]?.trim();
  return b || undefined;
}

/** A usable product has a name and calories. */
export function offUsable(p: OffProduct): boolean {
  return !!offName(p) && offNutrients(p.nutriments).kcal != null;
}

/** EAN-13, EAN-8, UPC-A (12) and UPC-E (8) with a valid check digit. */
export function validBarcode(code: string): boolean {
  if (!/^\d{8}$|^\d{12,13}$/.test(code)) return false;
  // UPC-E's check digit comes from its expanded UPC-A form; decoders verify it already.
  if (code.length === 8 && /^[01]/.test(code)) return true;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}
