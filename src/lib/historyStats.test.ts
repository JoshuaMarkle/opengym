import { describe, expect, it } from 'vitest';
import { availableRanges, currentStreak, longestStreak, missedWeeks, monthCounts, perWeek } from './historyStats';

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day, 18).getTime();

describe('streaks (weeks in a row with a workout)', () => {
  const now = d(2026, 11, 5); // Thursday
  it('counts back from this week', () => {
    expect(currentStreak([d(2026, 11, 2), d(2026, 10, 27), d(2026, 10, 20), d(2026, 10, 6)], 0, now)).toBe(3);
  });
  it("doesn't break on an empty current week", () => {
    expect(currentStreak([d(2026, 10, 27), d(2026, 10, 20)], 0, now)).toBe(2);
  });
  it('is 0 after a missed week', () => {
    expect(currentStreak([d(2026, 10, 20)], 0, now)).toBe(0);
  });
  it('respects the week start', () => {
    // Sun Nov 1 belongs to the Nov 1 week (Sunday start) but to the Oct 26 week (Monday start).
    expect(currentStreak([d(2026, 11, 1)], 0, now)).toBe(1);
    expect(currentStreak([d(2026, 11, 1)], 1, now)).toBe(1);
    expect(currentStreak([d(2026, 11, 1), d(2026, 10, 26)], 1, now)).toBe(1);
  });
  it('finds the longest streak', () => {
    expect(longestStreak([d(2026, 1, 5), d(2026, 1, 12), d(2026, 1, 19), d(2026, 3, 2), d(2026, 3, 9)], 0)).toBe(3);
  });
});

describe('perWeek / missedWeeks', () => {
  it('averages per week', () => {
    expect(perWeek(16, d(2026, 10, 1), d(2026, 10, 29))).toBeCloseTo(4, 5);
    expect(perWeek(1, d(2026, 10, 1), d(2026, 10, 2))).toBe(1);
  });
  it('counts complete empty weeks after the first workout', () => {
    const dates = [d(2026, 10, 5), d(2026, 10, 19)];
    expect(missedWeeks(dates, d(2026, 10, 1), d(2026, 11, 1), 0, dates[0])).toBe(2);
  });
});

describe('availableRanges', () => {
  const now = d(2026, 11, 5);
  it('shows only Month at first', () => {
    expect(availableRanges(undefined, now)).toEqual(['month']);
    expect(availableRanges(d(2026, 9, 1), now)).toEqual(['month']);
  });
  it('adds 6M after six months and Year/All after a year', () => {
    expect(availableRanges(d(2026, 6, 1), now)).toEqual(['month', '6m']);
    expect(availableRanges(d(2025, 1, 10), now)).toEqual(['month', '6m', 'year', 'all']);
  });
});

it('counts workouts per month', () => {
  expect(monthCounts([d(2026, 10, 1), d(2026, 10, 9), d(2026, 11, 2)]).get('2026-9')).toBe(2);
});
