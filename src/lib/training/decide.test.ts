import { describe, expect, it } from 'vitest';
import { decide, fitSet, targetsFor, type Target, type TSet } from './decide';

// training-logic.html §8: every example row. [range, step, target, lastSetOnly, sets, next, aim, note]
type Row = [string, [number, number], number, Target, boolean, [number, number, number | null][], number[], (number | null)[]];
const ROWS: Row[] = [
  ['#1 every set topped out', [6, 8], 5, [0, 2], false, [[185, 8, 1], [185, 8, 1], [185, 8, 2]], [190, 190, 190], [7, 7, 8]],
  ['#2 set 1 leads', [6, 8], 5, [0, 2], false, [[185, 8, 1], [185, 7, 0], [185, 6, 0]], [190, 185, 185], [7, null, null]],
  ['#3 big step on dumbbells', [8, 10], 5, [0, 2], false, [[20, 10, 0], [20, 10, 0], [20, 10, 0]], [25, 25, 25], [8, 8, 8]],
  ['#4 too easy jumps', [6, 8], 5, [0, 2], false, [[185, 9, 4], [185, 8, 3], [185, 8, 3]], [210, 200, 200], [7, 7, 7]],
  ['#5 one working set', [3, 5], 5, [0, 2], false, [[225, 5, 1]], [230], [4]],
  ['#6 machine 10 lb step', [8, 12], 10, [0, 2], false, [[100, 12, 1], [100, 11, 0], [100, 9, 0]], [110, 100, 100], [8, null, null]],
  ['#7 all in range at failure', [6, 8], 5, [0, 2], false, [[185, 7, 0], [185, 6, 0], [185, 6, 0]], [185, 185, 185], [null, null, null]],
  ['#8 in range with reps left', [6, 8], 5, [0, 2], false, [[185, 7, 2], [185, 7, 1], [185, 6, 1]], [185, 185, 185], [8, 8, 7]],
  ['#9 short with lots left', [8, 12], 5, [0, 2], false, [[200, 7, 4], [200, 7, 3], [200, 6, 3]], [200, 200, 200], [10, 9, 8]],
  ['#10 past / in / short', [8, 12], 5, [0, 2], false, [[200, 13, 0], [200, 10, 0], [200, 7, 0]], [205, 205, 180], [11, 8, 10]],
  ['#11 set 1 well past, then drop-off', [6, 8], 5, [0, 2], false, [[190, 10, 0], [190, 6, 0], [190, 5, 0]], [195, 180, 180], [8, 7, 6]],
  ['#12 big drop-off', [8, 12], 5, [0, 2], false, [[225, 11, 0], [225, 7, 0], [225, 5, 0]], [225, 200, 200], [null, 11, 8]],
  ['#13 dumbbells, same pattern', [8, 10], 5, [0, 2], false, [[60, 12, 1], [60, 6, 0], [60, 5, 0]], [65, 55, 55], [9, 8, 8]],
  ['#14 zone between steps', [10, 12], 5, [0, 2], false, [[20, 8, 0], [20, 7, 0], [20, 6, 0]], [20, 20, 15], [10, 10, 12]],
  ['#15 way too heavy', [6, 8], 5, [0, 2], false, [[225, 3, 0], [225, 2, 0], [225, 2, 0]], [195, 195, 195], [7, 6, 6]],
  ['#16 one short set 1 drags all', [6, 8], 5, [0, 2], false, [[185, 5, 0], [185, 6, 0], [185, 6, 0]], [170, 170, 170], [7, 8, 8]],
  ['#17 target to failure', [8, 12], 5, [0, 1], false, [[200, 10, 2], [200, 9, 2], [200, 8, 1]], [205, 205, 205], [10, 9, 8]],
  ['#18 target R2–4', [8, 12], 5, [2, 4], false, [[200, 10, 0], [200, 9, 0], [200, 8, 0]], [185, 185, 185], [10, 9, 8]],
  ['#19 last set only', [8, 12], 5, [0, 2], true, [[200, 10, 2], [200, 10, 1], [200, 9, 0]], [200, 200, 200], [11, null, null]],
  ['#20 no effort, all at the top', [6, 8], 5, [0, 2], false, [[185, 8, null], [185, 8, null], [185, 8, null]], [190, 190, 190], [6, 6, 6]],
  ['#21 no effort, in range', [6, 8], 5, [0, 2], false, [[185, 7, null], [185, 6, null], [185, 6, null]], [185, 185, 185], [8, 7, 7]],
  ['#22 no effort, under range', [10, 12], 5, [0, 2], false, [[20, 7, null], [20, 6, null], [20, 5, null]], [20, 15, 15], [10, 12, 12]],
  ['#23 four sets', [8, 10], 5, [0, 2], false, [[135, 10, 1], [135, 10, 1], [135, 9, 0], [135, 8, 0]], [140, 140, 135, 135], [9, 9, null, null]],
  ['#24 four sets, last fades', [8, 10], 5, [0, 2], false, [[135, 10, 1], [135, 9, 0], [135, 8, 0], [135, 6, 0]], [140, 135, 135, 120], [9, null, null, 10]],
];

const toSets = (xs: [number, number, number | null][]): TSet[] => xs.map(([weight, reps, rir]) => ({ weight, reps, rir: rir ?? undefined }));

describe('decide (§8 example sessions)', () => {
  for (const [name, [lo, hi], step, target, last, sets, next, aim] of ROWS) {
    it(name, () => {
      const d = decide(toSets(sets), sets.map(() => ({ min: lo, max: hi })), step, target, last);
      expect(d.out.map((o) => o.weight)).toEqual(next);
      expect(d.out.map((o) => o.aim)).toEqual(aim);
    });
  }

  it('flags the big step and the zone between steps', () => {
    expect(fitSet({ weight: 20, reps: 10, rir: 0 }, { min: 8, max: 10 }, 5, [0, 2]).flag).toBe('big step');
    expect(fitSet({ weight: 20, reps: 8, rir: 0 }, { min: 10, max: 12 }, 5, [0, 2]).flag).toBe('between steps');
  });

  it('gives each set its fit zone in lb', () => {
    const f = fitSet({ weight: 200, reps: 13, rir: 0 }, { min: 8, max: 12 }, 5, [0, 2]);
    expect(f.E).toBeCloseTo(286.67, 1);
    expect(Math.round(f.zone[0])).toBe(195);
    expect(Math.round(f.zone[1])).toBe(226);
  });

  it('marks moves up, down and keep', () => {
    const d = decide(toSets([[200, 13, 0], [200, 10, 0], [200, 7, 0]]), [0, 1, 2].map(() => ({ min: 8, max: 12 })), 5);
    expect(d.out.map((o) => o.move)).toEqual(['up', 'up', 'down']);
  });
});

describe('targetsFor', () => {
  it('shifts every set but the last with "last set only"', () => {
    expect(targetsFor(3, [0, 2], true)).toEqual([[1, 3], [1, 3], [0, 2]]);
    expect(targetsFor(2, [0, 2], false)).toEqual([[0, 2], [0, 2]]);
  });
});
