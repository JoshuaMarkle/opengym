import { describe, expect, it } from 'vitest';
import { closestFoods, fillMissing, needsFill, similarity } from './fill';

describe('fill in missing nutrients (nutrition-plan §3.14)', () => {
  it('finds similar USDA names', () => {
    expect(similarity('Greek yogurt', 'Yogurt, Greek, plain, lowfat')).toBeGreaterThan(0.8);
    expect(similarity('Greek yogurt', 'Bread, white')).toBe(0);
    const c = closestFoods('Greek yogurt, 2%', [{ name: 'Bread, white' }, { name: 'Yogurt, Greek, plain, lowfat' }, { name: 'Yogurt, plain, whole milk' }]);
    expect(c[0].name).toBe('Yogurt, Greek, plain, lowfat');
  });

  it('copies only the micronutrients the food lacks, marked estimated', () => {
    const r = fillMissing({ per100: { kcal: 73, p: 10, calcium: 110 } }, { per100: { kcal: 59, p: 10.2, calcium: 100, vitB12: 1 } as never });
    expect(r.per100.calcium).toBe(110);
    expect(r.per100.kcal).toBe(73);
    expect(r.filled).toEqual([]);
    const r2 = fillMissing({ per100: { kcal: 73 } }, { per100: { kcal: 59, b12: 0.75, potassium: 141 } });
    expect(r2.filled.sort()).toEqual(['b12', 'potassium']);
    expect(r2.estimated.sort()).toEqual(['b12', 'potassium']);
  });

  it('offers filling for packaged and custom foods missing most micronutrients', () => {
    expect(needsFill({ source: 'off', per100: { kcal: 1 } })).toBe(true);
    expect(needsFill({ source: 'usda', per100: { kcal: 1 } })).toBe(false);
  });

  it('weighs rare words over common ones, and full matches over partial ones', () => {
    const choc = ['Candies, milk chocolate', 'Cookie, bar, with chocolate', 'Ice cream bar, chocolate', 'Chocolate syrup', 'Cocoa, chocolate drink'].map((name) => ({ name }));
    const c = closestFoods('Protein bar, chocolate', [...choc, { name: 'Formulated bar, protein, peanut' }]);
    expect(c[0].name).toBe('Formulated bar, protein, peanut');
    const b = closestFoods('Chicken burrito bowl', [{ name: 'Burrito bowl, NFS' }, { name: 'Burrito bowl, chicken' }, { name: 'Chicken, roasted' }]);
    expect(b[0].name).toBe('Burrito bowl, chicken');
  });
});
