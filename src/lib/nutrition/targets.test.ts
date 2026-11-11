import { describe, expect, it } from 'vitest';
import { dayTargets, targetFor } from './targets';

const v = (from: string, createdAt: number, kcal: number) => ({ id: from + createdAt, from, createdAt, updatedAt: createdAt, mode: 'target' as const, kcal, diet: 'lifter' as const, pct: [28, 45, 27] as [number, number, number], grams: [190, 300, 80] as [number, number, number] });

describe('target versions (nutrition-plan §3.4)', () => {
  it('picks the latest version on or before a day', () => {
    const vs = [v('2026-11-01', 1, 2700), v('2026-11-08', 2, 2500), v('2026-11-08', 3, 2400)];
    expect(targetFor(vs, '2026-10-31')).toBeUndefined();
    expect(targetFor(vs, '2026-11-05')?.kcal).toBe(2700);
    expect(targetFor(vs, '2026-11-08')?.kcal).toBe(2400);
  });

  it('has no calorie or macro targets in Just log mode, but keeps micronutrients', () => {
    const t = dayTargets({ ...v('2026-11-01', 1, 2700), mode: 'log' }, '2026-11-02');
    expect(t.kcal).toBeUndefined();
    expect(t.micro.vitC).toBeDefined();
  });
});
