import { describe, expect, it } from 'vitest';
import { keepInBackup, loggedDays } from './backup';

describe('food rows in a backup', () => {
  it('keeps your foods and only the built-in ones you made yours', () => {
    expect(keepInBackup({ source: 'custom' })).toBe(true);
    expect(keepInBackup({ source: 'off' })).toBe(true);
    expect(keepInBackup({ source: 'usda' })).toBe(false);
    expect(keepInBackup({ source: 'usda', mine: true })).toBe(true);
    expect(keepInBackup({ source: 'usda', favorite: true })).toBe(true);
    expect(keepInBackup({ source: 'usda', last: { grams: 100, unit: 'g' } })).toBe(true);
  });
  it('counts distinct logged days', () => {
    expect(loggedDays([{ day: '2026-11-01' }, { day: '2026-11-01' }, { day: '2026-11-02' }])).toBe(2);
    expect(loggedDays([])).toBe(0);
  });
});
