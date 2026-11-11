/**
 * `npm run foods`: builds the built-in food database (nutrition-plan §3.8, SPEC §14) from USDA
 * FoodData Central, which is public domain.
 *
 *   npm run foods                downloads the CSVs into .cache/usda/ (not committed) if
 *                                they aren't there, then writes public/foods/usda-<release>.json
 *   npm run foods -- <folder>    reads the unzipped CSV folders from <folder> instead
 *
 * Short names for common foods come from scripts/food-names.json ({ "USDA description": "Short
 * name" }); the USDA description becomes the detail line. A new release: bump RELEASE and the
 * file names below, run this, and update USDA_RELEASE in src/data/foodDb.ts.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildFoods, table, toFile, type Dataset } from './usda.ts';

const root = new URL('..', import.meta.url).pathname;
export const RELEASE = '2025-12';

const SOURCES = {
  sr: 'FoodData_Central_sr_legacy_food_csv_2018-04',
  fndds: 'FoodData_Central_survey_food_csv_2024-10-31',
  foundation: 'FoodData_Central_foundation_food_csv_2025-12-18',
} as const;

const folder = process.argv[2] ?? join(root, '.cache/usda');

/** The folder that holds food.csv for a dataset (the zips nest one level). */
function csvDir(name: string): string {
  const base = join(folder, name);
  const find = (dir: string): string | undefined => {
    if (existsSync(join(dir, 'food.csv'))) return dir;
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) {
        const hit = find(p);
        if (hit) return hit;
      }
    }
    return undefined;
  };
  if (!existsSync(base)) download(name);
  const dir = find(base);
  if (!dir) throw new Error(`No food.csv under ${base}`);
  return dir;
}

function download(name: string) {
  mkdirSync(folder, { recursive: true });
  const zip = join(folder, `${name}.zip`);
  console.log(`Downloading ${name}…`);
  execFileSync('curl', ['-sSfL', '-o', zip, `https://fdc.nal.usda.gov/fdc-datasets/${name}.zip`], { stdio: 'inherit' });
  mkdirSync(join(folder, name), { recursive: true });
  execFileSync('unzip', ['-qo', zip, '-d', join(folder, name)], { stdio: 'inherit' });
  rmSync(zip);
}

function load(name: string, ndbFile?: string): Dataset {
  const dir = csvDir(name);
  const read = (f: string) => (existsSync(join(dir, f)) ? table(readFileSync(join(dir, f), 'utf8')) : []);
  return {
    food: read('food.csv'),
    nutrient: read('nutrient.csv'),
    food_nutrient: read('food_nutrient.csv'),
    food_portion: read('food_portion.csv'),
    measure_unit: read('measure_unit.csv'),
    ...(ndbFile ? { ndb: read(ndbFile) } : {}),
  };
}

const names = JSON.parse(readFileSync(join(root, 'scripts/food-names.json'), 'utf8')) as Record<string, string>;
const sr = load(SOURCES.sr, 'sr_legacy_food.csv');
const fndds = load(SOURCES.fndds);
const foundation = load(SOURCES.foundation, 'foundation_food.csv');
const foods = buildFoods({ sr, fndds, foundation }, names);

const used = new Set(foods.map((f) => f.detail ?? f.name));
const unused = Object.keys(names).filter((d) => !used.has(d));
if (unused.length) console.warn(`food-names.json: ${unused.length} descriptions not found, e.g. ${unused.slice(0, 3).join(' | ')}`);

const outDir = join(root, 'public/foods');
mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(outDir)) if (/^usda-.*\.json$/.test(f)) rmSync(join(outDir, f));
const out = join(outDir, `usda-${RELEASE}.json`);
writeFileSync(out, JSON.stringify(toFile(RELEASE, foods)));
const kb = Math.round(statSync(out).size / 1024);
const gz = Math.round(execFileSync('gzip', ['-c', out]).length / 1024);
console.log(`Wrote ${foods.length} foods (${Object.keys(names).length - unused.length} with short names) to public/foods/usda-${RELEASE}.json: ${kb} KB, ${gz} KB gzipped.`);
