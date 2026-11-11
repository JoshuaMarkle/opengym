import { describe, expect, it } from 'vitest';
import { kcalMismatch, parseAmount, per100ToServing, perServingTo100, sig3 } from './label';

describe('labels (nutrition-plan §3.7)', () => {
  it('stores per 100 g from per-serving values', () => {
    expect(perServingTo100({ kcal: 220, p: 20 }, 58)).toEqual({ kcal: (220 * 100) / 58, p: (20 * 100) / 58 });
    expect(per100ToServing({ kcal: 100 }, 30)).toEqual({ kcal: 30 });
    expect(perServingTo100({ kcal: 1 }, 0)).toEqual({});
  });

  it('notes calories more than 15% off the macros', () => {
    expect(kcalMismatch({ kcal: 220, p: 20, c: 21, f: 8 })).toBeUndefined();
    expect(kcalMismatch({ kcal: 100, p: 20, c: 21, f: 8 })).toEqual({ fromMacros: 236 });
    expect(kcalMismatch({ kcal: 100 })).toBeUndefined();
  });

  it('parses typed values', () => {
    expect(parseAmount('12,5')).toBe(12.5);
    expect(parseAmount('')).toBeUndefined();
    expect(parseAmount('x')).toBeUndefined();
  });

  it('keeps three significant figures', () => {
    expect(sig3(123.456)).toBe(123);
    expect(sig3(0.012345)).toBe(0.0123);
    expect(sig3(1.2345)).toBe(1.23);
  });
});
