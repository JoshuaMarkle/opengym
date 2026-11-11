// The nutrient catalog (nutrition-plan §3.14, SPEC §14). One list drives the food database
// build (USDA nutrient numbers), Open Food Facts mapping, totals, targets and every nutrient
// table. Amounts are in each nutrient's own unit.

export type NutrientGroup = 'general' | 'carbs' | 'lipids' | 'protein' | 'vitamins' | 'minerals';
export type NutrientUnit = 'kcal' | 'g' | 'mg' | 'µg';

export const NUTRIENT_IDS = [
  'kcal',
  'alcohol',
  'caffeine',
  'c',
  'fiber',
  'starch',
  'sugars',
  'addedSugars',
  'f',
  'sat',
  'mono',
  'poly',
  'trans',
  'omega3',
  'omega6',
  'cholesterol',
  'p',
  'vitA',
  'b1',
  'b2',
  'b3',
  'b5',
  'b6',
  'b12',
  'folate',
  'vitC',
  'vitD',
  'vitE',
  'vitK',
  'choline',
  'calcium',
  'copper',
  'iron',
  'magnesium',
  'manganese',
  'phosphorus',
  'potassium',
  'selenium',
  'sodium',
  'zinc',
] as const;

export type NutrientId = (typeof NUTRIENT_IDS)[number];

/** Amounts per nutrient. A missing key is unknown and shows "—", never 0. */
export type Nutrients = Partial<Record<NutrientId, number>>;

export interface NutrientDef {
  id: NutrientId;
  name: string;
  unit: NutrientUnit;
  group: NutrientGroup;
  /** Shown indented under the row before it (Saturated under Fat). */
  sub?: boolean;
  /**
   * USDA nutrient numbers (`nutrient_nbr`), first match wins. Omega-3 / omega-6 are sums
   * (see `USDA_SUMS`), so they list nothing here.
   */
  usda: number[];
  /** Open Food Facts `nutriments` key (values per 100 g, in grams except kcal). */
  off?: string;
}

const N = (id: NutrientId, name: string, unit: NutrientUnit, group: NutrientGroup, usda: number[], off?: string, sub?: boolean): NutrientDef => ({ id, name, unit, group, usda, off, sub });

export const NUTRIENTS: NutrientDef[] = [
  N('kcal', 'Energy', 'kcal', 'general', [208, 958, 957], 'energy-kcal'),
  N('alcohol', 'Alcohol', 'g', 'general', [221], 'alcohol'),
  N('caffeine', 'Caffeine', 'mg', 'general', [262], 'caffeine'),
  N('c', 'Carbs', 'g', 'carbs', [205], 'carbohydrates'),
  N('fiber', 'Fiber', 'g', 'carbs', [291], 'fiber', true),
  N('starch', 'Starch', 'g', 'carbs', [209], 'starch', true),
  N('sugars', 'Sugars', 'g', 'carbs', [269], 'sugars', true),
  N('addedSugars', 'Added sugars', 'g', 'carbs', [539], 'added-sugars', true),
  N('f', 'Fat', 'g', 'lipids', [204], 'fat'),
  N('sat', 'Saturated', 'g', 'lipids', [606], 'saturated-fat', true),
  N('mono', 'Monounsaturated', 'g', 'lipids', [645], 'monounsaturated-fat', true),
  N('poly', 'Polyunsaturated', 'g', 'lipids', [646], 'polyunsaturated-fat', true),
  N('trans', 'Trans', 'g', 'lipids', [605], 'trans-fat', true),
  N('omega3', 'Omega-3', 'g', 'lipids', [], 'omega-3-fat', true),
  N('omega6', 'Omega-6', 'g', 'lipids', [], 'omega-6-fat', true),
  N('cholesterol', 'Cholesterol', 'mg', 'lipids', [601], 'cholesterol'),
  N('p', 'Protein', 'g', 'protein', [203], 'proteins'),
  N('vitA', 'Vitamin A', 'µg', 'vitamins', [320], 'vitamin-a'),
  N('b1', 'B1 Thiamine', 'mg', 'vitamins', [404], 'vitamin-b1'),
  N('b2', 'B2 Riboflavin', 'mg', 'vitamins', [405], 'vitamin-b2'),
  N('b3', 'B3 Niacin', 'mg', 'vitamins', [406], 'vitamin-pp'),
  N('b5', 'B5 Pantothenic acid', 'mg', 'vitamins', [410], 'pantothenic-acid'),
  N('b6', 'B6', 'mg', 'vitamins', [415], 'vitamin-b6'),
  N('b12', 'B12', 'µg', 'vitamins', [418], 'vitamin-b12'),
  N('folate', 'Folate', 'µg', 'vitamins', [435], 'vitamin-b9'),
  N('vitC', 'Vitamin C', 'mg', 'vitamins', [401], 'vitamin-c'),
  N('vitD', 'Vitamin D', 'µg', 'vitamins', [328], 'vitamin-d'),
  N('vitE', 'Vitamin E', 'mg', 'vitamins', [323], 'vitamin-e'),
  N('vitK', 'Vitamin K', 'µg', 'vitamins', [430], 'vitamin-k'),
  N('choline', 'Choline', 'mg', 'vitamins', [421], 'choline'),
  N('calcium', 'Calcium', 'mg', 'minerals', [301], 'calcium'),
  N('copper', 'Copper', 'mg', 'minerals', [312], 'copper'),
  N('iron', 'Iron', 'mg', 'minerals', [303], 'iron'),
  N('magnesium', 'Magnesium', 'mg', 'minerals', [304], 'magnesium'),
  N('manganese', 'Manganese', 'mg', 'minerals', [315], 'manganese'),
  N('phosphorus', 'Phosphorus', 'mg', 'minerals', [305], 'phosphorus'),
  N('potassium', 'Potassium', 'mg', 'minerals', [306], 'potassium'),
  N('selenium', 'Selenium', 'µg', 'minerals', [317], 'selenium'),
  N('sodium', 'Sodium', 'mg', 'minerals', [307], 'sodium'),
  N('zinc', 'Zinc', 'mg', 'minerals', [309], 'zinc'),
];

/**
 * Omega-3 and omega-6 in USDA data are sums of fatty acids. Each part is a list of
 * alternatives (first present wins): ALA as n-3 (851) or undifferentiated 18:3 (619), plus EPA,
 * DPA and DHA; linoleic as n-6 (675) or 18:2 (618), plus arachidonic acid (853 or 620).
 */
export const USDA_SUMS: Partial<Record<NutrientId, number[][]>> = {
  omega3: [[851, 619], [629], [631], [621]],
  omega6: [[675, 618], [853, 620]],
};

export const NUTRIENT: Record<NutrientId, NutrientDef> = Object.fromEntries(NUTRIENTS.map((n) => [n.id, n])) as Record<NutrientId, NutrientDef>;

export const GROUPS: { id: NutrientGroup; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'carbs', label: 'Carbohydrates' },
  { id: 'lipids', label: 'Lipids' },
  { id: 'protein', label: 'Protein' },
  { id: 'vitamins', label: 'Vitamins' },
  { id: 'minerals', label: 'Minerals' },
];

export const MACROS = ['p', 'c', 'f'] as const;
export type Macro = (typeof MACROS)[number];
export const MACRO_LABEL: Record<Macro, string> = { p: 'Protein', c: 'Carbs', f: 'Fat' };
/** Macro colors (design §1): protein blue, carbs cyan, fat gold. Never change with state. */
export const MACRO_COLOR: Record<Macro, string> = { p: 'var(--og-accent)', c: 'var(--og-cyan)', f: 'var(--og-gold)' };
export const MACRO_BG: Record<Macro, string> = { p: 'bg-accent', c: 'bg-cyan', f: 'bg-gold' };
export const MACRO_TEXT: Record<Macro, string> = { p: 'text-accent', c: 'text-cyan', f: 'text-gold' };
/** kcal per gram. Fat 9, protein and carbs 4. */
export const KCAL_PER_G: Record<Macro, number> = { p: 4, c: 4, f: 9 };

/** Micronutrients: everything that isn't energy or a macro. */
export const MICROS = NUTRIENTS.filter((n) => !['kcal', 'p', 'c', 'f'].includes(n.id)).map((n) => n.id);

export function isNutrientId(s: string): s is NutrientId {
  return (NUTRIENT_IDS as readonly string[]).includes(s);
}

/** Multiply every nutrient by `k` (amount scaling). Missing stays missing. */
export function scaleNutrients(n: Nutrients, k: number): Nutrients {
  const out: Nutrients = {};
  for (const id of NUTRIENT_IDS) {
    const v = n[id];
    if (v != null) out[id] = v * k;
  }
  return out;
}

/** How many decimals a nutrient amount shows with: whole numbers from 10 up, one decimal under 10, two under 0.1. */
export function fmtAmount(v: number): string {
  const a = Math.abs(v);
  const d = a >= 10 || a === 0 ? 0 : a >= 0.1 ? 1 : 2;
  const s = v.toFixed(d).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  return s === '-0' ? '0' : s;
}

/** "62 g", "148 mg", "330 kcal", or "—" when unknown. */
export function fmtNutrient(id: NutrientId, v: number | undefined): string {
  if (v == null) return '—';
  const unit = NUTRIENT[id].unit;
  if (id === 'kcal') return `${Math.round(v).toLocaleString('en-US')} kcal`;
  return `${fmtAmount(v)} ${unit}`;
}

/** Whole number with thousands commas: "2,700". */
export function fmtInt(v: number): string {
  return Math.round(v).toLocaleString('en-US');
}
