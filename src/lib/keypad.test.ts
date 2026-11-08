import { describe, expect, it } from 'vitest';
import { applyKey, parseWeightText, type KeypadKey, type KeypadOptions } from './keypad';

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

describe('cardio modes', () => {
  const time = { mode: 'time' as const, step: 60 };
  const run = (keys: KeypadKey[], o: Parameters<typeof applyKey>[3], start = '', fresh = true) => {
    let t = start;
    let f = fresh;
    for (const k of keys) {
      t = applyKey(t, f, k, o);
      f = false;
    }
    return t;
  };
  const d = (x: string): KeypadKey => ({ type: 'digit', d: x });

  it('time: digits and one colon, two digits after it', () => {
    expect(run([d('5'), { type: 'colon' }, d('3'), d('0'), d('9')], time)).toBe('5:30');
    expect(run([{ type: 'colon' }, d('4'), d('5')], time)).toBe('0:45');
    expect(run([d('2'), d('5')], time)).toBe('25');
  });

  it('time: ± a minute, snapping to whole minutes', () => {
    expect(applyKey('5:00', false, { type: 'inc' }, time)).toBe('6:00');
    expect(applyKey('5:30', false, { type: 'inc' }, time)).toBe('6:00');
    expect(applyKey('5:30', false, { type: 'dec' }, time)).toBe('5:00');
    expect(applyKey('20', false, { type: 'inc' }, time)).toBe('21:00');
    expect(applyKey('1:00', false, { type: 'dec' }, time)).toBe('');
  });

  it('decimal: no minus, ± by its step', () => {
    const o = { mode: 'decimal' as const, step: 0.1 };
    expect(applyKey('3.5', false, { type: 'inc' }, o)).toBe('3.6');
    expect(applyKey('3.5', false, { type: 'minus' }, o)).toBe('3.5');
    expect(run([d('1'), { type: 'dot' }, d('7')], o)).toBe('1.7');
  });

  it('int: no decimal point', () => {
    const o = { mode: 'int' as const, step: 50 };
    expect(run([d('5'), { type: 'dot' }, d('0'), d('0')], o)).toBe('500');
    expect(applyKey('500', false, { type: 'inc' }, o)).toBe('550');
  });
});
