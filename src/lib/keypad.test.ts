import { describe, expect, it } from 'vitest';
import { applyKey, parseWeightText, type KeypadOptions } from './keypad';

const W: KeypadOptions = { mode: 'weight', step: 5, allowNegative: true };
const R: KeypadOptions = { mode: 'reps', step: 1, allowRange: true };

const type = (start: string, keys: Parameters<typeof applyKey>[2][], o = W) => {
  let t = start;
  let fresh = true;
  for (const k of keys) {
    t = applyKey(t, fresh, k, o);
    fresh = false;
  }
  return t;
};
const d = (x: string) => ({ type: 'digit' as const, d: x });

describe('keypad', () => {
  it('replaces the value on the first digit, then appends', () => {
    expect(type('185', [d('1'), d('9'), d('0')])).toBe('190');
  });
  it('steps weight by the weight step', () => {
    expect(type('185', [{ type: 'inc' }])).toBe('190');
    expect(type('185', [{ type: 'dec' }, { type: 'dec' }])).toBe('175');
    expect(type('2.5', [{ type: 'inc' }], { ...W, step: 2.5 })).toBe('5');
  });
  it('steps reps by one and never below zero', () => {
    expect(type('8', [{ type: 'inc' }], R)).toBe('9');
    expect(type('1', [{ type: 'dec' }], R)).toBe('');
  });
  it('types a rep range with the dash', () => {
    expect(type('', [d('6'), { type: 'dash' }, d('8')], R)).toBe('6–8');
  });
  it('ignores the decimal in reps mode', () => {
    expect(type('', [d('8'), { type: 'dot' }], R)).toBe('8');
  });
  it('handles decimals and negatives for weight', () => {
    expect(type('', [d('2'), d('7'), { type: 'dot' }, d('5')])).toBe('27.5');
    expect(type('', [{ type: 'minus' }, d('4'), d('0')])).toBe('-40');
    expect(parseWeightText('-40')).toBe(-40);
    expect(parseWeightText('-')).toBeUndefined();
  });
  it('clears on the first backspace, then deletes', () => {
    expect(type('185', [{ type: 'backspace' }])).toBe('');
    expect(type('185', [d('1'), d('2'), { type: 'backspace' }])).toBe('1');
  });
  it('snaps ± to the step grid when the number is off it', () => {
    const K: KeypadOptions = { mode: 'weight', step: 2.5 };
    expect(applyKey('122.4', false, { type: 'inc' }, K)).toBe('122.5');
    expect(applyKey('122.4', false, { type: 'dec' }, K)).toBe('120');
    expect(applyKey('122.5', false, { type: 'inc' }, K)).toBe('125');
  });
});
