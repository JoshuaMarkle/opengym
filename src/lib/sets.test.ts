import { describe, expect, it } from 'vitest';
import { dropChains, orderSets } from './sets';
import { s } from './testUtils';

const show = (chains: ReturnType<typeof dropChains>) => chains.map((c) => [c.set, ...c.drops].map((x) => `${x.weight}x${x.reps}`).join('d')).join(', ');

describe('dropChains', () => {
  it('keeps each drop right after the set it followed', () => {
    const a = s('working', 10, 12);
    const b = s('working', 10, 10);
    const b1 = s('drop', 5, 12, { parentSetId: b.id });
    const c = s('working', 10, 8);
    const c1 = s('drop', 5, 10, { parentSetId: c.id });
    expect(show(dropChains(orderSets([a, b, b1, c, c1])))).toBe('10x12, 10x10d5x12, 10x8d5x10');
  });

  it('keeps a chain of drops in order', () => {
    const a = s('working', 185, 6);
    const d1 = s('drop', 135, 9, { parentSetId: a.id });
    const d2 = s('drop', 95, 8, { parentSetId: a.id });
    const b = s('working', 185, 6);
    expect(show(dropChains(orderSets([a, d1, d2, b])))).toBe('185x6d135x9d95x8, 185x6');
  });

  it('places a drop added later under its own set, not at the end', () => {
    const a = s('working', 100, 10, { order: 1 });
    const b = s('working', 100, 9, { order: 2 });
    const a1 = s('drop', 75, 8, { order: 3, parentSetId: a.id });
    expect(show(dropChains(orderSets([a, b, a1])))).toBe('100x10d75x8, 100x9');
  });

  it('leaves out warm-ups and their drops', () => {
    const w = s('warmup', 95, 10);
    const w1 = s('drop', 45, 10, { parentSetId: w.id });
    const a = s('working', 185, 8);
    expect(show(dropChains(orderSets([w, w1, a])))).toBe('185x8');
  });

  it('keeps an orphan drop as its own group', () => {
    const d = s('drop', 50, 10, { parentSetId: 'gone' });
    const a = s('working', 100, 8);
    const chains = dropChains(orderSets([d, a]));
    expect(chains.map((c) => c.set.kind)).toEqual(['drop', 'working']);
  });

  it('is empty for warm-ups only', () => {
    expect(dropChains([s('warmup', 45, 10)])).toEqual([]);
  });
});
