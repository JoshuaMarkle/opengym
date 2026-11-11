import { describe, expect, it } from 'vitest';
import { buildFoods, catalogValues, sig3, table, toFile, type Dataset } from './usda.ts';

const nutrient = table(`id,name,unit_name,nutrient_nbr
1008,Energy,KCAL,208
1003,Protein,G,203
1004,Total lipid (fat),G,204
1005,Carbohydrate,G,205
1089,"Iron, Fe",MG,303
1270,"PUFA 18:3 n-3",G,851
1278,"PUFA 20:5 n-3 (EPA)",G,629`);

const sr: Dataset = {
  food: table(`fdc_id,data_type,description
1,sr_legacy_food,"Bananas, raw"
2,sr_legacy_food,"Chicken, broilers or fryers, breast, meat only, cooked, roasted"
3,sr_legacy_food,"Salt, table"`),
  nutrient,
  food_nutrient: table(`id,fdc_id,nutrient_id,amount
1,1,1008,89
2,1,1003,1.09
3,1,1005,22.84
4,1,1004,0.33
5,1,1089,0.26
6,2,1008,165
7,2,1003,31.02
8,2,1004,3.57
9,2,1270,0.02
10,2,1278,0.01`),
  food_portion: table(`id,fdc_id,seq_num,amount,measure_unit_id,portion_description,modifier,gram_weight
1,1,2,1,9999,,"medium (7"" to 7-7/8"" long)",118
2,1,1,1,1000,,sliced,150
3,2,1,1,9999,,"cup, chopped or diced",140
4,2,2,1,9999,,Quantity not specified,0`),
  measure_unit: table(`id,name
1000,cup
9999,undetermined`),
  ndb: table(`fdc_id,NDB_number
1,9040
2,5064`),
};

const foundation: Dataset = {
  food: table(`fdc_id,data_type,description
10,foundation_food,"Bananas, overripe, raw"
11,sub_sample_food,"Bananas sample"`),
  nutrient,
  food_nutrient: table(`id,fdc_id,nutrient_id,amount
1,10,1008,98
2,10,1003,0.74
3,10,1089,0`),
  food_portion: table(`id,fdc_id,seq_num,amount,measure_unit_id,portion_description,modifier,gram_weight`),
  ndb: table(`fdc_id,NDB_number
10,9040
11,9040`),
};

const fndds: Dataset = {
  food: table(`fdc_id,data_type,description
20,survey_fndds_food,"Pizza, cheese, from restaurant or fast food, medium crust"`),
  nutrient,
  // FNDDS rows hold the nutrient number, not the id.
  food_nutrient: table(`id,fdc_id,nutrient_id,amount
1,20,208,266
2,20,203,11.4`),
  food_portion: table(`id,fdc_id,seq_num,amount,measure_unit_id,portion_description,modifier,gram_weight
1,20,1,,9999,"1 slice, medium",,107`),
};

describe('usda', () => {
  it('rounds to three significant figures', () => {
    expect(sig3(22.84)).toBe(22.8);
    expect(sig3(0.0123456)).toBe(0.0123);
    expect(sig3(1234.5)).toBe(1235);
    expect(sig3(0)).toBe(0);
  });

  it('sums omega-3 from its parts', () => {
    const v = catalogValues(new Map([[208, 100], [851, 0.02], [629, 0.01]]));
    expect(v.kcal).toBe(100);
    expect(v.omega3).toBeCloseTo(0.03);
    expect(v.omega6).toBeUndefined();
  });

  it('builds foods with short names, servings and Foundation values', () => {
    const foods = buildFoods({ sr, foundation, fndds }, { 'Bananas, raw': 'Banana' });
    expect(foods.map((f) => f.fdcId)).toEqual([1, 2, 20]); // salt has no calories row
    const banana = foods[0];
    expect(banana.name).toBe('Banana');
    expect(banana.detail).toBe('Bananas, raw');
    // Foundation's newer kcal and protein win; its 0 iron doesn't erase the SR value.
    expect(banana.values).toMatchObject({ kcal: 98, p: 0.74, c: 22.8, f: 0.33, iron: 0.26 });
    expect(banana.servings).toEqual([
      ['1 cup, sliced', 150],
      ['1 medium (7" to 7-7/8" long)', 118],
    ]);
    const chicken = foods[1];
    expect(chicken.detail).toBeUndefined();
    expect(chicken.servings).toEqual([['1 cup, chopped or diced', 140]]);
    expect(foods[2].servings).toEqual([['1 slice, medium', 107]]);
  });

  it('writes the compact file', () => {
    const file = toFile('2025-12', buildFoods({ sr }, { 'Bananas, raw': 'Banana' }));
    const [id, name, detail, values] = file.foods[0];
    expect([id, name, detail]).toEqual([1, 'Banana', 'Bananas, raw']);
    expect(values[file.nutrients.indexOf('kcal')]).toBe(89);
    expect(values[file.nutrients.indexOf('vitC')]).toBeNull();
  });
});
