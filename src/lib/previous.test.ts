import { describe, expect, it } from 'vitest';
import { fitPrevNext, matchPrevious } from './previous';
import { orderSets, setLabels } from './sets';
import { s } from './testUtils';

describe('matchPrevious', () => {
  const lw = s('warmup', 95, 10, { id: 'lw', order: 1 });
  const l1 = s('working', 185, 8, { id: 'l1', order: 2 });
  const l2 = s('working', 185, 7, { id: 'l2', order: 3 });
  const l3 = s('working', 185, 6, { id: 'l3', order: 4 });
  const ld = s('drop', 135, 9, { id: 'ld', order: 5, parentSetId: 'l3' });
  const last = [lw, l1, l2, l3, ld];

  it('matches working to working and warm-up to warm-up by position', () => {
    const cw = s('warmup', 95, undefined, { id: 'cw', order: 1 });
    const c1 = s('working', 185, undefined, { id: 'c1', order: 2 });
    const c3 = s('working', 185, undefined, { id: 'c3', order: 4 });
    const c2 = s('working', 185, undefined, { id: 'c2', order: 3 });
    const m = matchPrevious([c1, cw, c3, c2], last);
    expect(m.get('cw')!.prev?.id).toBe('lw');
    expect(m.get('c1')!.prev?.id).toBe('l1');
    expect(m.get('c2')!.prev?.id).toBe('l2');
    expect(m.get('c3')!.prev?.id).toBe('l3');
  });

  it('shows the D badge on the set you dropped after last time', () => {
    const c = [1, 2, 3].map((i) => s('working', 185, undefined, { id: `c${i}`, order: i }));
    const m = matchPrevious(c, last);
    expect(m.get('c3')!.prevHadDrop).toBe(true);
    expect(m.get('c2')!.prevHadDrop).toBe(false);
  });

  it('matches a drop to the drop that followed the same parent', () => {
    const c = [1, 2, 3].map((i) => s('working', 185, undefined, { id: `c${i}`, order: i }));
    const d = s('drop', 140, undefined, { id: 'cd', order: 3.5, parentSetId: 'c3' });
    const d2 = s('drop', 100, undefined, { id: 'cd2', order: 3.6, parentSetId: 'c3' });
    const m = matchPrevious([...c, d, d2], last);
    expect(m.get('cd')!.prev?.id).toBe('ld');
    expect(m.get('cd2')!.prev).toBeUndefined();
  });

  it('returns empty matches without history', () => {
    const m = matchPrevious([s('working', 1, 1, { id: 'x' })], undefined);
    expect(m.get('x')).toEqual({ prev: undefined, prevHadDrop: false });
  });
});

describe('orderSets / setLabels', () => {
  it('puts warm-ups first and drops right after their parent', () => {
    const a = s('working', 1, 1, { id: 'a', order: 1 });
    const b = s('working', 1, 1, { id: 'b', order: 2 });
    const d = s('drop', 1, 1, { id: 'd', order: 9, parentSetId: 'a' });
    const w = s('warmup', 1, 1, { id: 'w', order: 5 });
    const ordered = orderSets([a, b, d, w]);
    expect(ordered.map((x) => x.id)).toEqual(['w', 'a', 'd', 'b']);
    expect([...setLabels(ordered).values()]).toEqual(['W', '1', 'D', '2']);
  });
});

describe('fitPrevNext', () => {
  const rows = [
    { prev: 50, next: 50, drop: false },
    { prev: 56, next: 48, drop: true },
  ];

  it('keeps the D badge in the width', () => {
    expect(fitPrevNext(rows, 200, 22, 18)).toEqual({ prevW: 78, headerAligned: false });
  });

  it('keeps the D badge even when the column is tight', () => {
    expect(fitPrevNext(rows, 140, 22, 18)).toEqual({ prevW: 78, headerAligned: false });
  });

  it('widens to the header only when that still fits', () => {
    expect(fitPrevNext(rows, 200, 22, 18, { prev: 90, next: 30 })).toEqual({ prevW: 90, headerAligned: true });
    expect(fitPrevNext(rows, 150, 22, 18, { prev: 90, next: 30 })).toEqual({ prevW: 78, headerAligned: false });
  });
});
