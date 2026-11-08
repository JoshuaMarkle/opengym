import { describe, expect, it } from 'vitest';
import { barIdFor, barLabel, hasPlatePad, loadPlates, PLATES, plateCounts, plateTotal, removeAt } from './plates';

describe('plate pad', () => {
  it('total = bar + 2 × one side', () => {
    expect(plateTotal(45, [45, 25])).toBe(185);
    expect(plateTotal(45, [45, 45, 45, 45, 25, 10, 5, 2.5])).toBe(490);
    expect(plateTotal(0, [45])).toBe(90);
  });

  it('loads a weight heaviest-first per side', () => {
    expect(loadPlates(185, 45, PLATES.lb)).toEqual({ stack: [45, 25], rest: 0 });
    expect(loadPlates(490, 45, PLATES.lb).stack).toEqual([45, 45, 45, 45, 35, 5, 2.5]);
    expect(loadPlates(45, 45, PLATES.lb).stack).toEqual([]);
    expect(loadPlates(undefined, 45, PLATES.lb).stack).toEqual([]);
    expect(loadPlates(100, 20, PLATES.kg)).toEqual({ stack: [25, 15], rest: 0 });
  });

  it('reports what plates cannot make', () => {
    expect(loadPlates(186, 45, PLATES.lb).rest).toBeCloseTo(0.5);
  });

  it('counts and removes plates', () => {
    expect([...plateCounts([45, 45, 25])]).toEqual([
      [45, 2],
      [25, 1],
    ]);
    expect(removeAt([45, 35, 25], 1)).toEqual([45, 25]);
  });

  it('bar presets and labels', () => {
    expect(barIdFor(45, 'lb')).toBe('barbell');
    expect(barIdFor(60, 'lb')).toBe('trap');
    expect(barIdFor(0, 'lb')).toBe('none');
    expect(barIdFor(40, 'lb')).toBe('custom');
    expect(barLabel(45, 'lb')).toBe('Bar 45 lb');
    expect(barLabel(0, 'kg')).toBe('No bar');
  });

  it('is offered for barbell and machine lifts only', () => {
    expect(hasPlatePad('weight', 'barbell')).toBe(true);
    expect(hasPlatePad('weight', 'machine')).toBe(true);
    expect(hasPlatePad('weight', 'dumbbell')).toBe(false);
    expect(hasPlatePad('bodyweight_plus', 'barbell')).toBe(false);
  });
});
