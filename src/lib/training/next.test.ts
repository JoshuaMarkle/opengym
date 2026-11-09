import { describe, expect, it } from 'vitest';
import { nextSet } from './next';
import type { Suggestion } from './suggest';

const sg = (p: Partial<Suggestion>): Suggestion => ({
  mode: 'fit',
  weights: [],
  last: [],
  moves: [],
  aims: [],
  ranges: [],
  changed: true,
  lead: 'up',
  reason: '',
  bigStep: false,
  ...p,
});

describe('nextSet', () => {
  it('a new weight with its aim', () => {
    const s = sg({ weights: [160], last: [{ weight: 155, reps: 12 }], moves: ['up'], aims: [10] });
    expect(nextSet(s, 0)).toEqual({ weight: 160, reps: 10, move: 'up' });
  });

  it('a kept weight with one more rep', () => {
    const s = sg({ weights: [155], last: [{ weight: 155, reps: 8 }], moves: ['keep'], aims: [9] });
    expect(nextSet(s, 0)).toEqual({ weight: 155, reps: 9, move: 'keep' });
  });

  it('kept with no aim repeats last time', () => {
    const s = sg({ weights: [undefined], last: [{ weight: 155, reps: 8 }], moves: ['keep'], aims: [null] });
    expect(nextSet(s, 0)).toEqual({ weight: 155, reps: 8, move: 'keep' });
  });

  it('a ramp weight has no reps yet', () => {
    const s = sg({ weights: [135], last: [{ weight: 185, reps: 5 }], moves: ['down'], aims: [null] });
    expect(nextSet(s, 0)).toEqual({ weight: 135, reps: undefined, move: 'down' });
  });

  it('nothing past last time sets', () => {
    expect(nextSet(sg({}), 2)).toBeUndefined();
  });
});
