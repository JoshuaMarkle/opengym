/**
 * The pure part of `npm run foods` (scripts/foods.ts): USDA FoodData Central CSV tables in,
 * compact food records out. Kept apart from the file and network code so it can be tested
 * with small fixture tables (scripts/usda.test.ts).
 *
 * Sources (nutrition-plan §3.8):
 *   SR Legacy  basic foods with complete vitamin and mineral data
 *   FNDDS      foods "as eaten" (dishes, sandwiches, cereal with milk)
 *   Foundation newer lab values that replace their SR Legacy twin (matched by NDB number);
 *              anything Foundation lacks keeps the SR Legacy value
 */
import { parseCsv } from '../src/lib/csv.ts';
import { NUTRIENTS, USDA_SUMS, type NutrientId } from '../src/lib/nutrition/nutrients.ts';

export type Table = Record<string, string>[];

/** Parse a CSV file's text into rows keyed by the header. */
export function table(text: string): Table {
  const rows = parseCsv(text, ',');
  const head = rows[0] ?? [];
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

export interface Dataset {
  food: Table;
  nutrient: Table;
  food_nutrient: Table;
  food_portion: Table;
  measure_unit?: Table;
  /** SR Legacy / Foundation: fdc_id → NDB_number. */
  ndb?: Table;
}

export interface UsdaFood {
  fdcId: number;
  name: string;
  detail?: string;
  values: Partial<Record<NutrientId, number>>;
  servings: [string, number][];
}

/** Round to 3 significant figures (the database file stays small; labels aren't more precise). */
export function sig3(v: number): number {
  if (v === 0) return 0;
  const d = Math.max(0, 2 - Math.floor(Math.log10(Math.abs(v))));
  return Number(v.toFixed(Math.min(d, 4)));
}

/** nutrient_id → nutrient_nbr. FNDDS food_nutrient rows already hold the number. */
function nbrById(nutrient: Table): Map<string, number> {
  return new Map(nutrient.map((n) => [n.id, Number(n.nutrient_nbr)]));
}

/** Catalog nutrients for one food from its { nutrient_nbr → amount } map. */
export function catalogValues(byNbr: Map<number, number>): Partial<Record<NutrientId, number>> {
  const out: Partial<Record<NutrientId, number>> = {};
  for (const def of NUTRIENTS) {
    const sum = USDA_SUMS[def.id];
    if (sum) {
      let total = 0;
      let any = false;
      for (const alts of sum) {
        const hit = alts.map((n) => byNbr.get(n)).find((v) => v != null);
        if (hit != null) {
          total += hit;
          any = true;
        }
      }
      if (any) out[def.id] = sig3(total);
      continue;
    }
    const v = def.usda.map((n) => byNbr.get(n)).find((x) => x != null);
    if (v != null) out[def.id] = sig3(v);
  }
  return out;
}

/** fdc_id → { nutrient_nbr → amount } for one dataset. */
function amounts(ds: Dataset, numbersAreNbr: boolean): Map<string, Map<number, number>> {
  const map = nbrById(ds.nutrient);
  const out = new Map<string, Map<number, number>>();
  for (const r of ds.food_nutrient) {
    const nbr = numbersAreNbr ? Number(r.nutrient_id) : map.get(r.nutrient_id);
    if (nbr == null || !Number.isFinite(nbr) || r.amount === '') continue;
    const v = Number(r.amount);
    if (!Number.isFinite(v)) continue;
    let m = out.get(r.fdc_id);
    if (!m) out.set(r.fdc_id, (m = new Map()));
    m.set(nbr, v);
  }
  return out;
}

/** Household portions as servings: "1 cup, chopped" = 160 g. At most 6, no zero weights. */
function portions(ds: Dataset): Map<string, [string, number][]> {
  const units = new Map((ds.measure_unit ?? []).map((u) => [u.id, u.name]));
  const out = new Map<string, [string, number][]>();
  const rows = [...ds.food_portion].sort((a, b) => Number(a.seq_num || 0) - Number(b.seq_num || 0));
  for (const p of rows) {
    const g = Number(p.gram_weight);
    if (!(g > 0)) continue;
    let label = p.portion_description?.trim();
    if (!label) {
      const amount = p.amount ? String(Number(p.amount)) : '1';
      const unit = units.get(p.measure_unit_id);
      const mod = p.modifier?.trim();
      label = unit && unit !== 'undetermined' ? `${amount} ${unit}${mod && !/^\d+$/.test(mod) ? `, ${mod}` : ''}` : `${amount} ${mod ?? ''}`.trim();
    }
    if (!label || /quantity not specified|^guideline amount/i.test(label)) continue;
    const list = out.get(p.fdc_id) ?? [];
    if (list.length < 6 && !list.some(([l]) => l === label)) list.push([label, Math.round(g * 10) / 10]);
    out.set(p.fdc_id, list);
  }
  return out;
}

/**
 * Build the database. `names` maps a USDA description to a short hand-written name ("Chicken
 * breast, roasted"); the description then becomes the detail line.
 */
export function buildFoods(sets: { sr?: Dataset; fndds?: Dataset; foundation?: Dataset }, names: Record<string, string> = {}): UsdaFood[] {
  const out: UsdaFood[] = [];
  const add = (fdcId: string, description: string, values: Partial<Record<NutrientId, number>>, servings: [string, number][]) => {
    if (values.kcal == null) return;
    const short = names[description];
    out.push({ fdcId: Number(fdcId), name: short ?? description, ...(short && short !== description ? { detail: description } : {}), values, servings });
  };

  // Foundation values by NDB number, to lay over SR Legacy.
  const foundationByNdb = new Map<string, { values: Partial<Record<NutrientId, number>>; servings: [string, number][] }>();
  if (sets.foundation) {
    const ff = sets.foundation;
    const vals = amounts(ff, false);
    const port = portions(ff);
    const isFoundation = new Set(ff.food.filter((f) => f.data_type === 'foundation_food').map((f) => f.fdc_id));
    for (const n of ff.ndb ?? []) {
      if (!isFoundation.has(n.fdc_id) || !n.NDB_number) continue;
      foundationByNdb.set(n.NDB_number, { values: catalogValues(vals.get(n.fdc_id) ?? new Map()), servings: port.get(n.fdc_id) ?? [] });
    }
  }

  if (sets.sr) {
    const sr = sets.sr;
    const vals = amounts(sr, false);
    const port = portions(sr);
    const ndb = new Map((sr.ndb ?? []).map((n) => [n.fdc_id, n.NDB_number]));
    for (const f of sr.food) {
      let values = catalogValues(vals.get(f.fdc_id) ?? new Map());
      let servings = port.get(f.fdc_id) ?? [];
      const ff = foundationByNdb.get(ndb.get(f.fdc_id) ?? '');
      if (ff) {
        // Foundation's newer lab values win, except a 0 (often "below detection") over a real SR value.
        const over = Object.fromEntries(Object.entries(ff.values).filter(([id, v]) => v !== 0 || !values[id as NutrientId]));
        values = { ...values, ...over };
        if (!servings.length) servings = ff.servings;
      }
      add(f.fdc_id, f.description, values, servings);
    }
  }

  if (sets.fndds) {
    const fn = sets.fndds;
    const vals = amounts(fn, true);
    const port = portions(fn);
    for (const f of fn.food) add(f.fdc_id, f.description, catalogValues(vals.get(f.fdc_id) ?? new Map()), port.get(f.fdc_id) ?? []);
  }
  return out;
}

/** The file format: nutrient ids once, then each food as [fdcId, name, detail, values, servings]. */
export interface UsdaFile {
  release: string;
  nutrients: NutrientId[];
  foods: [number, string, string | null, (number | null)[], [string, number][]][];
}

export function toFile(release: string, foods: UsdaFood[]): UsdaFile {
  const ids = NUTRIENTS.map((n) => n.id);
  return {
    release,
    nutrients: ids,
    foods: foods.map((f) => [f.fdcId, f.name, f.detail ?? null, ids.map((id) => f.values[id] ?? null), f.servings]),
  };
}
