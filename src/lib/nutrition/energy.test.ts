import { describe, expect, it } from 'vitest';
import { bmr, dailyTarget, goalDate, maintenance, paceAllowed, paceOptions, round50, safetyFloor } from './energy';

const body = { sex: 'm' as const, age: 29, heightIn: 71, weightLb: 190 };

describe('energy (nutrition-plan §3.4)', () => {
  it('uses Mifflin–St Jeor', () => {
    // 10·86.18 + 6.25·180.34 − 5·29 + 5
    expect(bmr(body)).toBeCloseTo(1848.9, 0);
    expect(bmr({ ...body, sex: 'f' })).toBeCloseTo(1848.9 - 166, 0);
  });

  it('multiplies by the activity factor, to the nearest 10', () => {
    expect(maintenance(body, 3)).toBe(2870);
    expect(maintenance(body, 1)).toBe(2220);
  });

  it('offers paces per goal, 1 lb = 500 kcal a day', () => {
    expect(paceOptions('lose').map((p) => p.kcal)).toEqual([-125, -250, -500, -750]);
    expect(paceOptions('lose').find((p) => p.suggested)?.lb).toBe(0.5);
    expect(paceOptions('lose').find((p) => p.warn)?.lb).toBe(1.5);
    expect(paceOptions('gain').map((p) => p.kcal)).toEqual([125, 250, 500]);
    expect(paceOptions('gain').find((p) => p.suggested)?.lb).toBe(0.25);
    expect(paceOptions('maintain')).toEqual([]);
  });

  it('rounds the target to 50', () => {
    expect(round50(2624)).toBe(2600);
    expect(round50(2625)).toBe(2650);
    expect(dailyTarget(2870, -250)).toBe(2600);
  });

  it('keeps targets above the safety floor', () => {
    expect(safetyFloor({ sex: 'f', age: 40, heightIn: 60, weightLb: 110 })).toBe(1200);
    expect(safetyFloor(body)).toBeCloseTo(bmr(body));
    const small = { sex: 'f' as const, age: 50, heightIn: 60, weightLb: 115 };
    const m = maintenance(small, 2);
    expect(paceAllowed(small, maintenance(small, 1), -125)).toBe(false);
    expect(paceAllowed(small, m, -125)).toBe(true);
    expect(paceAllowed(small, m, -750)).toBe(false);
  });

  it('estimates a goal date in a straight line', () => {
    const now = new Date(2026, 10, 10).getTime();
    const d = goalDate(now, 190, 180, 0.5, 'lose')!;
    expect(Math.round((d - now) / 86_400_000)).toBe(140);
    expect(goalDate(now, 190, 200, 0.5, 'lose')).toBeUndefined();
    expect(goalDate(now, 190, undefined, 0.5, 'lose')).toBeUndefined();
  });
});
