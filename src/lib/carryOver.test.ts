import { describe, expect, it } from 'vitest';
import { carryOver } from './carryOver';
import { s } from './testUtils';

const open = { completed: false };

describe('carryOver', () => {
  it('fills empty sets below from the first typed set', () => {
    const a = s('working', 25, 10, { id: 'a', order: 0, ...open });
    const b = s('working', undefined, undefined, { id: 'b', order: 1, ...open });
    const c = s('working', undefined, undefined, { id: 'c', order: 2, ...open });
    const m = carryOver([a, b, c]);
    expect(m.get('a')).toBeUndefined();
    expect(m.get('b')).toEqual({ weight: 25, reps: 10 });
    expect(m.get('c')).toEqual({ weight: 25, reps: 10 });
  });

  it('only fills the empty field and follows the latest typed value', () => {
    const a = s('working', 25, 10, { id: 'a', order: 0 });
    const b = s('working', 30, undefined, { id: 'b', order: 1, ...open });
    const c = s('working', undefined, undefined, { id: 'c', order: 2, ...open });
    const m = carryOver([a, b, c]);
    expect(m.get('b')).toEqual({ reps: 10 });
    expect(m.get('c')).toEqual({ weight: 30, reps: 10 });
  });

  it('keeps warm-ups and working sets apart and skips drops', () => {
    const w = s('warmup', 45, 12, { id: 'w', order: 0 });
    const a = s('working', undefined, undefined, { id: 'a', order: 1, ...open });
    const b = s('working', 100, 8, { id: 'b', order: 2 });
    const d = s('drop', undefined, undefined, { id: 'd', order: 3, parentSetId: 'b', ...open });
    const c = s('working', undefined, undefined, { id: 'c', order: 4, ...open });
    const m = carryOver([w, a, b, d, c]);
    expect(m.get('a')).toBeUndefined();
    expect(m.get('d')).toBeUndefined();
    expect(m.get('c')).toEqual({ weight: 100, reps: 8 });
  });

  it('returns nothing when no set has numbers', () => {
    const m = carryOver([s('working', undefined, undefined, { id: 'a', order: 0 }), s('working', undefined, undefined, { id: 'b', order: 1 })]);
    expect(m.size).toBe(0);
  });
});
