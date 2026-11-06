import { describe, expect, it } from 'vitest';
import { formatNumber, formatWeight, fromDisplay, roundToStep, toDisplay, displayWeight } from './units';

describe('unit conversion', () => {
  it('leaves lb untouched', () => {
    expect(toDisplay(185, 'lb')).toBe(185);
    expect(fromDisplay(185, 'lb')).toBe(185);
  });

  it('converts lb ↔ kg', () => {
    expect(toDisplay(220.46226218, 'kg')).toBeCloseTo(100, 6);
    expect(fromDisplay(100, 'kg')).toBeCloseTo(220.4622622, 6);
  });

  it('round-trips a typed kg value exactly for display', () => {
    for (const kg of [20, 22.5, 61.25, 100, 142.5, 0.5]) {
      expect(formatWeight(fromDisplay(kg, 'kg'), 'kg')).toBe(String(kg));
    }
  });

  it('formats lb weights without float noise', () => {
    expect(formatWeight(185, 'lb')).toBe('185');
    expect(formatWeight(27.5, 'lb')).toBe('27.5');
    expect(formatWeight(137.50000001, 'lb')).toBe('137.5');
    expect(formatWeight(-40, 'lb')).toBe('-40');
  });

  it('shows converted lb weights as readable kg', () => {
    expect(formatWeight(185, 'kg')).toBe('83.9');
    expect(displayWeight(45, 'kg')).toBe(20.4);
  });

  it('rounds to a step', () => {
    expect(roundToStep(138.75, 5)).toBe(140);
    expect(roundToStep(101.25, 5)).toBe(100);
    expect(roundToStep(21.3, 2.5)).toBe(22.5);
    expect(roundToStep(0.1 + 0.2, 0.1)).toBe(0.3);
  });

  it('formats plain numbers', () => {
    expect(formatNumber(3.2)).toBe('3.2');
    expect(formatNumber(4)).toBe('4');
    expect(formatNumber(-0.0001)).toBe('0');
    expect(formatNumber(2.345, 1)).toBe('2.3');
  });
  it('shows converted weights with one decimal, typed plate weights exactly', () => {
    expect(formatWeight(270, 'kg')).toBe('122.5');
    expect(formatWeight(120, 'kg')).toBe('54.4');
    expect(formatWeight(fromDisplay(61.25, 'kg'), 'kg')).toBe('61.25');
    expect(formatWeight(fromDisplay(100, 'kg'), 'lb')).toBe('220.5');
  });
});
