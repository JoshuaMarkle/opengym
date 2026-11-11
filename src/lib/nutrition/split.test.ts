import { describe, expect, it } from 'vitest';
import { canStep, gramsFromPct, kcalShare, lifterSplit, splitFor, stepPct } from './split';

describe('macro splits (nutrition-plan §3.4)', () => {
  it('Lifter: 1 g protein per lb, fat 27%, carbs the rest', () => {
    const s = lifterSplit(2700, 190);
    expect(s.pct).toEqual([28, 45, 27]);
    expect(s.grams[0]).toBe(190);
    expect(s.grams[2]).toBe(80);
    expect(s.grams[1]).toBe(305);
  });

  it('Lifter caps protein at 40% of calories', () => {
    const s = lifterSplit(1500, 220);
    expect(s.pct[0]).toBe(40);
    expect(s.grams[0]).toBe(150);
  });

  it('fixed presets turn percentages into grams rounded to 5', () => {
    expect(gramsFromPct(2700, [30, 40, 30])).toEqual([205, 270, 90]);
    expect(splitFor('keto', 2000, 180).pct).toEqual([25, 5, 70]);
    expect(splitFor('custom', 2000, 180, [32, 40, 28]).pct).toEqual([32, 40, 28]);
  });

  it('Custom steppers move 2% / 1% / 1% and keep every macro at 5% or more', () => {
    expect(stepPct([30, 42, 28], 0, 1)).toEqual([32, 41, 27]);
    expect(stepPct([30, 42, 28], 2, -1)).toEqual([31, 43, 26]);
    expect(canStep([30, 5, 65], 0, 1)).toBe(false);
    expect(canStep([6, 47, 47], 0, -1)).toBe(false);
    expect(canStep([7, 46, 47], 0, -1)).toBe(true);
  });

  it('shares calories by macro', () => {
    expect(kcalShare(62, 0, 7)).toEqual([80, 0, 20]);
    expect(kcalShare(0, 0, 0)).toEqual([0, 0, 0]);
  });
});
