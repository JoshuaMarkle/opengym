import { describe, expect, it } from 'vitest';
import { foodDayKey, shiftDay, sumEntries, OVER_GRACE } from './nutrition';
import { generateSampleFood } from './sampleFood';

describe('sample food (testing mode)', () => {
  const now = new Date(2026, 10, 5, 17, 30).getTime();
  const d = generateSampleFood({ now });
  const today = foodDayKey(now);
  const day = (k: string) => sumEntries(d.entries.filter((e) => e.day === k));

  it('logs today like the board: breakfast, lunch and snacks, no dinner yet', () => {
    const meals = new Set(d.entries.filter((e) => e.day === today).map((e) => e.meal));
    expect([...meals].sort()).toEqual(['breakfast', 'lunch', 'snacks']);
  });

  it('has an over-target yesterday, an empty day and a day logged ahead', () => {
    expect(day(shiftDay(today, -1)).totals.kcal!).toBeGreaterThan(2700 * (1 + OVER_GRACE));
    expect(day(shiftDay(today, -5)).count).toBe(0);
    expect(day(shiftDay(today, 1)).count).toBeGreaterThan(0);
  });

  it('only remembers amounts logged up to now', () => {
    const whey = d.foods.find((f) => f.id === 'sample-whey')!;
    expect(whey.last).toBeDefined();
    expect(d.foods.find((f) => f.id === 'sample-bar')!.per100.vitC).toBeUndefined();
  });

  it('every saved meal points at a sample food', () => {
    const ids = new Set(d.foods.map((f) => f.id));
    for (const m of d.savedMeals) for (const it of m.items) expect(ids.has(it.foodId)).toBe(true);
  });
});
