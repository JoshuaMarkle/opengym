import { describe, expect, it } from 'vitest';
import { ageBand, ageFrom, driTargets } from './dri';

describe('DRI targets (nutrition-plan §3.14)', () => {
  it('picks the band by age', () => {
    expect([15, 19, 30, 31, 50, 51, 70, 71].map(ageBand)).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
  });

  it('uses sex and age', () => {
    const m = driTargets({ sex: 'm', age: 29 }, 2700);
    const f = driTargets({ sex: 'f', age: 29 }, 2000);
    expect(m.iron?.amount).toBe(8);
    expect(f.iron?.amount).toBe(18);
    expect(driTargets({ sex: 'f', age: 55 }, 2000).iron?.amount).toBe(8);
    expect(m.vitD?.amount).toBe(15);
    expect(driTargets({ sex: 'm', age: 75 }, 2000).vitD?.amount).toBe(20);
    expect(m.magnesium?.amount).toBe(400);
  });

  it('takes the larger value without a sex', () => {
    expect(driTargets({}, undefined).iron?.amount).toBe(18);
  });

  it('follows calories for fiber and the percentage limits', () => {
    const t = driTargets({ sex: 'm', age: 29 }, 2700);
    expect(t.fiber).toEqual({ amount: 38, kind: 'floor' });
    expect(t.sat).toEqual({ amount: 30, kind: 'limit' });
    expect(t.addedSugars).toEqual({ amount: 68, kind: 'limit' });
    expect(t.sodium).toEqual({ amount: 2300, kind: 'limit' });
    expect(driTargets({}, undefined).fiber?.amount).toBe(28);
  });

  it('only sets upper limits that cover every source', () => {
    const t = driTargets({ sex: 'm', age: 29 }, 2700);
    expect(t.vitD?.ul).toBe(100);
    expect(t.iron?.ul).toBe(45);
    expect(t.vitA?.ul).toBeUndefined();
    expect(t.folate?.ul).toBeUndefined();
    expect(t.magnesium?.ul).toBeUndefined();
  });

  it('applies overrides', () => {
    const t = driTargets({ sex: 'm', age: 29 }, 2700, { sodium: 1500, vitC: 200 });
    expect(t.sodium).toEqual({ amount: 1500, kind: 'limit' });
    expect(t.vitC?.amount).toBe(200);
    expect(t.vitC?.ul).toBe(2000);
  });

  it('works out age from a birth year', () => {
    expect(ageFrom(1997, '2026-11-10')).toBe(29);
    expect(ageFrom(1997, '2027-03-01')).toBe(29);
    expect(ageFrom(1997, '2027-07-01')).toBe(30);
    expect(ageFrom(undefined, '2026-11-10')).toBeUndefined();
  });
});
