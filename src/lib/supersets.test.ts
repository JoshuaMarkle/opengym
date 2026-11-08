import { describe, expect, it } from 'vitest';
import type { LoggedSet } from './sets';
import {
  isFolded,
  linkSuperset,
  moveBlock,
  nextTarget,
  normalizeSupersets,
  settleDrag,
  supersetBlocks,
  supersetRound,
  supersetTags,
  unlinkSuperset,
  type GroupItem,
  type MemberSets,
} from './supersets';

const items = (spec: string): GroupItem[] =>
  spec.split(' ').map((t) => {
    const [key, g] = t.split(':');
    return { key, supersetGroup: g || undefined };
  });
const show = (list: GroupItem[]) => list.map((x) => (x.supersetGroup ? `${x.key}:${x.supersetGroup}` : x.key)).join(' ');

describe('blocks and tags', () => {
  it('groups contiguous members and tags them A1, A2', () => {
    const list = items('lat bench:A row:A dips');
    expect(supersetBlocks(list).map((b) => b.items.length)).toEqual([1, 2, 1]);
    expect([...supersetTags(list)]).toEqual([
      ['bench', 'A1'],
      ['row', 'A2'],
    ]);
  });
});

describe('normalizeSupersets', () => {
  it('relabels in order, dissolves singles, caps at three, keeps the first run of a split group', () => {
    expect(show(normalizeSupersets(items('a:C b:C c d:Q')))).toBe('a:A b:A c d');
    expect(show(normalizeSupersets(items('a:A b:A c:A d:A')))).toBe('a:A b:A c:A d');
    expect(show(normalizeSupersets(items('a:A b:A c d:A e:A')))).toBe('a:A b:A c d e');
  });
});

describe('link / unlink', () => {
  it('moves the partner right after the anchor', () => {
    expect(show(linkSuperset(items('lat bench inc dips row'), 'bench', ['row']))).toBe('lat bench:A row:A inc dips');
  });
  it('adds a third member to an existing group, but not a fourth', () => {
    const three = linkSuperset(items('bench:A row:A dips fly'), 'row', ['fly']);
    expect(show(three)).toBe('bench:A row:A fly:A dips');
    expect(show(linkSuperset(three, 'bench', ['dips']))).toBe('bench:A row:A fly:A dips');
  });
  it('unlinking leaves the group and dissolves a pair', () => {
    expect(show(unlinkSuperset(items('bench:A row:A dips'), 'bench'))).toBe('row bench dips');
    expect(show(unlinkSuperset(items('bench:A row:A fly:A'), 'row'))).toBe('bench:A fly:A row');
  });
});

describe('moving', () => {
  it('a superset moves as one block', () => {
    expect(show(moveBlock(items('lat bench:A row:A dips'), 'row', 1))).toBe('lat dips bench:A row:A');
    expect(show(moveBlock(items('lat bench:A row:A dips'), 'lat', 1))).toBe('bench:A row:A lat dips');
  });
  it('drag into a bracket joins, drag out unlinks, a full bracket refuses', () => {
    const before = items('lat bench:A row:A dips');
    expect(show(settleDrag(before, items('bench:A lat row:A dips'), 'lat'))).toBe('bench:A lat:A row:A dips');
    expect(show(settleDrag(before, items('lat row:A dips bench:A'), 'bench'))).toBe('lat row dips bench');
    const full = items('a:A b:A c:A d');
    expect(settleDrag(full, items('a:A d b:A c:A'), 'd')).toBe(full);
  });
});

// ───────────────────────────── logging

const set = (id: string, kind: LoggedSet['kind'], completed = false, parentSetId?: string): LoggedSet => ({ id, order: 0, kind, completed, parentSetId });

describe('nextTarget', () => {
  const pair = (): MemberSets[] => [
    { key: 'A1', sets: [set('a1', 'working', true), set('a2', 'working'), set('a3', 'working')] },
    { key: 'A2', sets: [set('b1', 'working', true), set('b2', 'working'), set('b3', 'working')] },
  ];

  it('A1 set 2 → A2 set 2 → A1 set 3', () => {
    const m = pair();
    expect(nextTarget(m, 'A1', 'a2')).toEqual({ key: 'A2', setId: 'b2' });
    m[0].sets[1].completed = true;
    expect(nextTarget(m, 'A2', 'b2')).toEqual({ key: 'A1', setId: 'a3' });
  });

  it('uneven counts continue on their own', () => {
    const m: MemberSets[] = [
      { key: 'A1', sets: [set('a1', 'working', true), set('a2', 'working', true), set('a3', 'working')] },
      { key: 'A2', sets: [set('b1', 'working', true), set('b2', 'working')] },
    ];
    expect(nextTarget(m, 'A2', 'b2')).toEqual({ key: 'A1', setId: 'a3' });
    m[1].sets[1].completed = true;
    expect(nextTarget(m, 'A1', 'a3')).toBeNull();
  });

  it('warm-ups and drops stay on the same exercise', () => {
    const m: MemberSets[] = [
      { key: 'A1', sets: [set('w', 'warmup'), set('a1', 'working'), set('d1', 'drop', false, 'a1')] },
      { key: 'A2', sets: [set('b1', 'working')] },
    ];
    expect(nextTarget(m, 'A1', 'w')).toEqual({ key: 'A1', setId: 'a1' });
    expect(nextTarget(m, 'A1', 'a1')).toEqual({ key: 'A1', setId: 'd1' });
    expect(nextTarget(m, 'A1', 'd1')).toEqual({ key: 'A2', setId: 'b1' });
  });
});

describe('round and folding', () => {
  it('round = the pass you are on', () => {
    const m: MemberSets[] = [
      { key: 'A1', sets: [set('a1', 'working', true), set('a2', 'working', true), set('a3', 'working')] },
      { key: 'A2', sets: [set('b1', 'working', true), set('b2', 'working'), set('b3', 'working')] },
    ];
    expect(supersetRound(m, 'A2')).toEqual({ round: 2, rounds: 3 });
    expect(isFolded(m[0], 'A2', 2)).toBe(true);
    expect(isFolded(m[1], 'A1', 3)).toBe(false);
    expect(isFolded(m[1], 'A2', 2)).toBe(false);
  });
});
