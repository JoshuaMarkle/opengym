import { describe, expect, it } from 'vitest';
import { fmtMonthDay } from './dates';

describe('fmtMonthDay', () => {
  const now = new Date(2026, 10, 9).getTime();
  it('drops the year in the current year', () => {
    expect(fmtMonthDay(new Date(2026, 9, 29).getTime(), now)).toBe('Oct 29');
    expect(fmtMonthDay(new Date(2026, 9, 29).getTime(), now, true)).toBe('Oct 29');
  });
  it('adds the full or two-digit year otherwise', () => {
    expect(fmtMonthDay(new Date(2025, 9, 29).getTime(), now)).toBe('Oct 29, 2025');
    expect(fmtMonthDay(new Date(2025, 9, 29).getTime(), now, true)).toBe("Oct 29 '25");
    expect(fmtMonthDay(new Date(2009, 0, 3).getTime(), now, true)).toBe("Jan 3 '09");
  });
});
