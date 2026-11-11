import { describe, expect, it } from 'vitest';
import { amountLabel, fromGrams, pickServing, servingText, toGrams, totalsFor, unitLabel } from './amounts';

describe('amounts (nutrition-plan §3.5)', () => {
  it('converts units to grams and back', () => {
    expect(toGrams(200, 'g', 'g')).toBe(200);
    expect(toGrams(2, 'oz', 'g')).toBeCloseTo(56.7, 1);
    expect(toGrams(8, 'oz', 'ml')).toBeCloseTo(236.6, 1);
    expect(toGrams(1.5, 'serv', 'g', 186)).toBe(279);
    expect(fromGrams(279, 'serv', 'g', 186)).toBe(1.5);
  });

  it('labels liquid units', () => {
    expect(unitLabel('g', 'ml')).toBe('ml');
    expect(unitLabel('oz', 'ml')).toBe('fl oz');
    expect(unitLabel('serv', 'g')).toBe('serv');
  });

  it('scales per-100 values and keeps missing values missing', () => {
    expect(totalsFor({ kcal: 165, p: 31, f: 3.6 }, 200)).toEqual({ kcal: 330, p: 62, f: 7.2 });
  });

  it('writes amounts the way the day page shows them', () => {
    expect(amountLabel(200, 'g', 'g', [])).toBe('200 g');
    expect(amountLabel(280, 'serv', 'g', [{ label: '1 cup', grams: 186.7 }])).toBe('1.5 cup · 280 g');
    expect(amountLabel(32, 'serv', 'g', [{ label: '2 tbsp', grams: 32 }])).toBe('2 tbsp · 32 g');
    expect(servingText(2, '2 tbsp')).toBe('2 × 2 tbsp');
  });
});

describe('pickServing', () => {
  it('prefers a whole medium item over cups', () => {
    const s = [{ label: '1 cup, mashed', grams: 225 }, { label: '1 small', grams: 101 }, { label: '1 medium (7" long)', grams: 118 }];
    expect(pickServing(s)).toBe(2);
  });
  it('falls back to a slice, a spoon, a cup, then the first', () => {
    expect(pickServing([{ label: '1 oz', grams: 28 }, { label: '1 slice', grams: 32 }])).toBe(1);
    expect(pickServing([{ label: '1 cup', grams: 216 }, { label: '1 tablespoon', grams: 13.5 }], 884)).toBe(1);
    expect(pickServing([{ label: '1 tbsp', grams: 15 }, { label: '1 cup', grams: 244 }], 60)).toBe(1);
    expect(pickServing([{ label: '3 oz', grams: 85 }, { label: '1 cup', grams: 140 }])).toBe(1);
    expect(pickServing([{ label: '3 oz', grams: 85 }])).toBe(0);
  });
});
