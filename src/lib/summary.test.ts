import { describe, expect, it } from 'vitest';
import { compareBest } from './summary';
import { s } from './testUtils';

describe('compareBest', () => {
  it('reports a heavier best set', () => {
    const c = compareBest([s('working', 185, 8), s('working', 185, 7)], [s('working', 180, 8)], 'weight', 'lb')!;
    expect(c).toEqual({ direction: 'up', detail: '185 × 8 vs 180 × 8', label: '+5 lb' });
  });
  it('reports more reps at the same weight', () => {
    expect(compareBest([s('working', 65, 11)], [s('working', 65, 10)], 'weight', 'lb')!.label).toBe('+1 rep');
  });
  it('handles bodyweight', () => {
    const c = compareBest([s('working', undefined, 14)], [s('working', undefined, 12)], 'bodyweight', 'lb')!;
    expect(c).toMatchObject({ direction: 'up', detail: 'BW × 14 vs BW × 12', label: '+2 reps' });
  });
  it('reports a lighter best set as down', () => {
    expect(compareBest([s('working', 27.5, 12)], [s('working', 30, 12)], 'weight', 'lb')).toMatchObject({ direction: 'down', label: '−2.5 lb' });
  });
  it('reports same', () => {
    expect(compareBest([s('working', 20, 15)], [s('working', 20, 15)], 'weight', 'lb')).toMatchObject({ direction: 'same', label: 'same' });
  });
  it('marks first-time exercises as new and ignores warm-ups', () => {
    expect(compareBest([s('working', 20, 15)], undefined, 'weight', 'lb')!.direction).toBe('new');
    expect(compareBest([s('warmup', 20, 15)], undefined, 'weight', 'lb')).toBeNull();
  });
  it('shows one change: weight when it moved the same way, reps otherwise', () => {
    expect(compareBest([s('working', 280, 10)], [s('working', 275, 5)], 'weight', 'lb')!.label).toBe('+5 lb');
    expect(compareBest([s('working', 185, 10)], [s('working', 195, 6)], 'weight', 'lb')).toMatchObject({ direction: 'up', label: '+4 reps' });
  });
});
