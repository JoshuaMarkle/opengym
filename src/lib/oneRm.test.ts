import { describe, expect, it } from 'vitest';
import { bestSet, estimate1RM, sessionMetric, topSet } from './oneRm';
import { s } from './testUtils';

describe('estimate1RM', () => {
  it('uses Epley: w × (1 + reps/30)', () => {
    expect(estimate1RM(185, 8)).toBeCloseTo(234.33, 2);
    expect(estimate1RM(100, 10)).toBeCloseTo(133.33, 2);
  });
  it('treats a single as its own max', () => {
    expect(estimate1RM(235, 1)).toBe(235);
  });
  it('supports Brzycki', () => {
    expect(estimate1RM(100, 10, 'brzycki')).toBeCloseTo(133.33, 1);
    expect(estimate1RM(200, 5, 'brzycki')).toBeCloseTo(225, 5);
  });
  it('is 0 for missing weight or reps', () => {
    expect(estimate1RM(0, 5)).toBe(0);
    expect(estimate1RM(100, 0)).toBe(0);
  });
});

describe('sessionMetric', () => {
  it('uses the best working set only: no warm-ups, drops or sets over 12 reps', () => {
    const sets = [s('warmup', 300, 10), s('working', 185, 8), s('working', 185, 6), s('drop', 250, 12), s('working', 150, 20)];
    const m = sessionMetric(sets, 'weight')!;
    expect(m.weight).toBe(185);
    expect(m.reps).toBe(8);
    expect(m.value).toBeCloseTo(234.33, 2);
  });
  it('ignores unticked sets', () => {
    const sets = [s('working', 185, 8), s('working', 205, 8, { completed: false })];
    expect(sessionMetric(sets, 'weight')!.weight).toBe(185);
  });
  it('returns null when nothing qualifies', () => {
    expect(sessionMetric([s('warmup', 95, 10)], 'weight')).toBeNull();
    expect(sessionMetric([s('working', 50, 15)], 'weight')).toBeNull();
  });
  it('charts reps for bodyweight', () => {
    expect(sessionMetric([s('working', undefined, 8), s('working', undefined, 11)], 'bodyweight')!.value).toBe(11);
  });
  it('charts added weight for BW + added', () => {
    expect(sessionMetric([s('working', 0, 12), s('working', 25, 8)], 'bodyweight_plus')!.value).toBe(25);
  });
  it('charts the negative weight for assisted (less assist = higher)', () => {
    expect(sessionMetric([s('working', -40, 10), s('working', -30, 8)], 'assisted')!.value).toBe(-30);
  });
});

describe('topSet / bestSet', () => {
  it('finds the heaviest set, ties to more reps', () => {
    expect(topSet([s('working', 185, 6), s('working', 185, 8), s('working', 180, 10)], 'weight')).toEqual({ weight: 185, reps: 8 });
  });
  it('finds the best set by est. 1RM', () => {
    const best = bestSet([s('working', 185, 8), s('working', 200, 3)], 'weight')!;
    expect(best.weight).toBe(185);
  });
});
