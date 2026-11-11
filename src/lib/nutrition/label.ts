// Nutrition labels (nutrition-plan §3.7): values are typed per serving, as labels print them,
// and stored per 100 g.

import { NUTRIENT_IDS, type Nutrients } from './nutrients';

/** Per-serving values → per 100 g (or ml). */
export function perServingTo100(perServing: Nutrients, servingGrams: number): Nutrients {
  const out: Nutrients = {};
  if (!(servingGrams > 0)) return out;
  for (const id of NUTRIENT_IDS) {
    const v = perServing[id];
    if (v != null && Number.isFinite(v)) out[id] = (v * 100) / servingGrams;
  }
  return out;
}

/** Per 100 g → per serving (for editing a food). */
export function per100ToServing(per100: Nutrients, servingGrams: number): Nutrients {
  const out: Nutrients = {};
  for (const id of NUTRIENT_IDS) {
    const v = per100[id];
    if (v != null) out[id] = (v * servingGrams) / 100;
  }
  return out;
}

/** Calories from macros: 4·P + 4·C + 9·F. */
export function macroKcal(n: Nutrients): number {
  return 4 * (n.p ?? 0) + 4 * (n.c ?? 0) + 9 * (n.f ?? 0);
}

/**
 * The quiet note on New food (D3): calories more than 15% off 4·P + 4·C + 9·F. Never blocks
 * saving (fiber, alcohol and rounding on labels all move it). Needs calories and all three macros.
 */
export function kcalMismatch(n: Nutrients): { fromMacros: number } | undefined {
  if (n.kcal == null || n.p == null || n.c == null || n.f == null) return undefined;
  const fromMacros = macroKcal(n);
  const base = Math.max(n.kcal, fromMacros);
  if (base < 20) return undefined;
  return Math.abs(n.kcal - fromMacros) > base * 0.15 ? { fromMacros: Math.round(fromMacros) } : undefined;
}

/** Parse a typed label value: "", "—" or junk is unknown. */
export function parseAmount(s: string): number | undefined {
  const t = s.trim().replace(',', '.');
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Round a stored per-100 value to 3 significant figures (database size, honest precision). */
export function sig3(v: number): number {
  if (v === 0) return 0;
  const d = Math.max(0, 2 - Math.floor(Math.log10(Math.abs(v))));
  return Number(v.toFixed(Math.min(d, 4)));
}
