import { describe, expect, it } from 'vitest';
import { dropWeight, nextWorkingSet, planDrop, prefillFromLastSession, prefillFromRoutine } from './prefill';
import { s } from './testUtils';

const rs = (kind: 'warmup' | 'working', weight: number | 'last', repsMin?: number, repsMax?: number, order = 0) => ({
  id: `${kind}${order}${Math.random()}`,
  order,
  kind,
  weight,
  repsMin,
  repsMax,
});

describe('prefillFromRoutine', () => {
  const last = [s('warmup', 95, 10), s('working', 185, 8), s('working', 185, 7), s('working', 185, 6)];

  it("resolves 'last' from the same set position last time; fixed weights stay", () => {
    const drafts = prefillFromRoutine(
      [rs('warmup', 95, 10, 10, 0), rs('working', 'last', 6, 8, 1), rs('working', 'last', 6, 8, 2), rs('working', 'last', 6, 8, 3), rs('working', 'last', undefined, undefined, 4)],
      last,
    );
    expect(drafts.map((d) => d.weight)).toEqual([95, 185, 185, 185, undefined]);
    expect(drafts.map((d) => d.reps)).toEqual([10, 8, 7, 6, undefined]);
    expect(drafts[1]).toMatchObject({ repsMin: 6, repsMax: 8 });
  });

  it('leaves weight and reps empty with no history (rep range stays as the placeholder)', () => {
    const drafts = prefillFromRoutine([rs('working', 'last', 12, 15)], undefined);
    expect(drafts[0]).toEqual({ kind: 'working', weight: undefined, reps: undefined, repsMin: 12, repsMax: 15 });
  });

  it('copies the effort target as a target only, never as a logged rating', () => {
    const drafts = prefillFromRoutine([{ ...rs('warmup', 95, 10, 10, 0), rpeTarget: 6 }, { ...rs('working', 'last', 6, 8, 1), rpeTarget: 8.5 }], [s('working', 185, 8, { rpe: 9 })]);
    expect(drafts[0].rpeTarget).toBeUndefined();
    expect(drafts[1].rpeTarget).toBe(8.5);
    expect(drafts[1]).not.toHaveProperty('rpe');
  });
});

describe('prefillFromLastSession', () => {
  it('copies last time without drops', () => {
    const d = prefillFromLastSession([s('working', 100, 5), s('drop', 75, 8, { parentSetId: 'x' }), s('working', 100, 5)]);
    expect(d).toHaveLength(2);
  });
  it('defaults to three empty working sets', () => {
    expect(prefillFromLastSession(undefined)).toHaveLength(3);
  });
});

describe('nextWorkingSet', () => {
  it('takes the next position from last time', () => {
    const cur = [s('working', 185, 8), s('working', 185, 7)];
    const last = [s('working', 180, 8), s('working', 180, 8), s('working', 175, 9)];
    expect(nextWorkingSet(cur, last)).toMatchObject({ weight: 175, reps: 9 });
  });
  it('carries the weight from the last set when last time had fewer sets', () => {
    const cur = [s('working', 185, 8, { repsMin: 6, repsMax: 8 } as never)];
    expect(nextWorkingSet(cur, undefined)).toMatchObject({ weight: 185, reps: undefined });
  });
});

describe('drops', () => {
  it('prefills weight × (1 − dropPercent), rounded to the weight step', () => {
    expect(dropWeight(185, 'weight', 25, 5)).toBe(140);
    expect(dropWeight(135, 'weight', 25, 5)).toBe(100);
    expect(dropWeight(10, 'weight', 25, 5)).toBe(5);
  });
  it('drops added weight to no lower than bodyweight', () => {
    expect(dropWeight(25, 'bodyweight_plus', 25, 5)).toBe(20);
    expect(dropWeight(0, 'bodyweight_plus', 25, 5)).toBe(0);
  });
  it('adds assistance for assisted lifts', () => {
    expect(dropWeight(-40, 'assisted', 25, 5)).toBe(-50);
  });

  it('goes under the last completed set and chains after existing drops', () => {
    const a = s('working', 185, 8, { id: 'a', order: 1 });
    const b = s('working', 185, 6, { id: 'b', order: 2 });
    const c = s('working', 185, undefined, { id: 'c', order: 3, completed: false });
    let plan = planDrop([a, b, c], undefined, 'weight', 25, 5)!;
    expect(plan).toMatchObject({ parentSetId: 'b', afterSetId: 'b', weight: 140 });

    const d1 = s('drop', 140, 9, { id: 'd1', order: 2.5, parentSetId: 'b' });
    plan = planDrop([a, b, d1, c], undefined, 'weight', 25, 5)!;
    expect(plan).toMatchObject({ parentSetId: 'b', afterSetId: 'd1', weight: 105 });
  });

  it("prefills reps from the drop that followed the same set last time", () => {
    const a = s('working', 185, 8, { id: 'a', order: 1 });
    const lastA = s('working', 185, 6, { id: 'la', order: 1 });
    const lastD = s('drop', 135, 9, { id: 'ld', order: 2, parentSetId: 'la' });
    expect(planDrop([a], [lastA, lastD], 'weight', 25, 5)).toMatchObject({ reps: 9 });
  });
});
