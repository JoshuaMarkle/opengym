import { describe, expect, it } from 'vitest';
import { offBasis, offNutrients, offServing, offUsable, validBarcode } from './off';

describe('Open Food Facts mapping (nutrition-plan §3.8)', () => {
  it('maps per-100 g nutriments into catalog units', () => {
    const n = offNutrients({ 'energy-kcal_100g': 379, proteins_100g: 34.5, fat_100g: 13.8, sodium_100g: 0.31, 'vitamin-c_100g': 0.012, 'vitamin-d_100g': 0.0000025 });
    expect(n).toMatchObject({ kcal: 379, p: 34.5, f: 13.8, sodium: 310, vitC: 12, vitD: 2.5 });
    expect(n.c).toBeUndefined();
  });

  it('falls back to kJ and to salt', () => {
    expect(offNutrients({ energy_100g: 1000, salt_100g: 1 })).toMatchObject({ kcal: 239, sodium: 400 });
  });

  it('reads servings', () => {
    expect(offServing({ serving_size: '1 bar (58 g)', serving_quantity: 58 })).toEqual({ label: '1 bar', grams: 58 });
    expect(offServing({ serving_size: '30g' })).toEqual({ label: '1 serving', grams: 30 });
    expect(offServing({ serving_size: 'scoop' })).toBeUndefined();
    expect(offBasis({ serving_size: '250 ml' })).toBe('ml');
    expect(offBasis({ serving_size: '30 g' })).toBe('g');
  });

  it('needs a name and calories', () => {
    expect(offUsable({ product_name: 'Bar', nutriments: { 'energy-kcal_100g': 300 } })).toBe(true);
    expect(offUsable({ product_name: 'Bar', nutriments: {} })).toBe(false);
  });

  it('checks barcode check digits', () => {
    expect(validBarcode('3017624010701')).toBe(true);
    expect(validBarcode('3017624010702')).toBe(false);
    expect(validBarcode('036000291452')).toBe(true);
    expect(validBarcode('12345')).toBe(false);
  });
});
