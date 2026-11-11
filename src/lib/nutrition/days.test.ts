import { describe, expect, it } from 'vitest';
import { foodDayKey, initialFold, mealForTime, shiftDay, syncFold, toggleFold, weekDays } from './days';

const at = (h: number, m = 0, d = 10) => new Date(2026, 10, d, h, m).getTime();

describe('food days (nutrition-plan §3.1–3.2)', () => {
  it('runs 3:00 am to 2:59 am', () => {
    expect(foodDayKey(at(1, 30))).toBe('2026-11-09');
    expect(foodDayKey(at(2, 59))).toBe('2026-11-09');
    expect(foodDayKey(at(3, 0))).toBe('2026-11-10');
    expect(foodDayKey(at(23, 59))).toBe('2026-11-10');
  });

  it('picks the meal for the time of day; snacks never on its own', () => {
    expect(mealForTime(at(3))).toBe('breakfast');
    expect(mealForTime(at(10, 59))).toBe('breakfast');
    expect(mealForTime(at(11))).toBe('lunch');
    expect(mealForTime(at(15, 59))).toBe('lunch');
    expect(mealForTime(at(16))).toBe('dinner');
    expect(mealForTime(at(1, 30))).toBe('dinner');
  });

  it('opens the meal of the moment today, and nothing on other days', () => {
    expect(initialFold(true, 'lunch').open).toEqual(['lunch']);
    expect(initialFold(false, 'lunch').open).toEqual([]);
  });

  it('keeps choices by hand until the window changes, then opens the new meal', () => {
    let s = initialFold(true, 'dinner');
    s = toggleFold(s, 'breakfast');
    s = toggleFold(s, 'dinner');
    expect(syncFold(s, true, 'dinner').open).toEqual(['breakfast']);
    s = syncFold({ ...s, window: 'lunch' }, true, 'dinner');
    expect(s.open.sort()).toEqual(['breakfast', 'dinner']);
  });

  it('shifts days and builds weeks across DST', () => {
    expect(shiftDay('2026-11-01', 1)).toBe('2026-11-02');
    expect(shiftDay('2026-03-08', -1)).toBe('2026-03-07');
    expect(weekDays('2026-11-10', 0)).toEqual(['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14']);
    expect(weekDays('2026-11-08', 1)[0]).toBe('2026-11-02');
  });
});
