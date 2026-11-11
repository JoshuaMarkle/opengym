import { describe, expect, it } from 'vitest';
import { ceilingStatus, floorStatus, leftOver, microStatus, onTarget, pctOfTarget, sumEntries, topContributors, weekStats } from './totals';
import { dayTargets } from './targets';

const e = (id: string, totals: Record<string, number>, estimated?: string[]) => ({ id, name: id, totals, estimated }) as Parameters<typeof sumEntries>[0][number];

describe('totals (nutrition-plan §3.3, §3.14)', () => {
  it('adds known values and lists foods missing each nutrient', () => {
    const s = sumEntries([e('chicken', { kcal: 330, p: 62, sodium: 148 }), e('bar', { kcal: 210, p: 20 }), e('quick', { kcal: 300 })]);
    expect(s.totals.kcal).toBe(840);
    expect(s.totals.p).toBe(82);
    expect(s.missing.p?.map((x) => x.id)).toEqual(['quick']);
    expect(s.missing.sodium?.map((x) => x.id)).toEqual(['bar', 'quick']);
    expect(s.totals.vitC).toBeUndefined();
    expect(s.missing.vitC).toBeUndefined();
  });

  it('collects estimated nutrients', () => {
    expect([...sumEntries([e('a', { kcal: 1, vitC: 2 }, ['vitC'])]).estimated]).toEqual(['vitC']);
  });

  it('turns calories orange only past 3% over', () => {
    expect(ceilingStatus(2720, 2700).over).toBe(false);
    expect(ceilingStatus(2790, 2700).over).toBe(true);
    expect(leftOver(1344, 2700)).toEqual({ n: 1356, word: 'left' });
    expect(leftOver(2740, 2700)).toEqual({ n: 40, word: 'over' });
  });

  it('treats protein as a floor', () => {
    expect(floorStatus(201, 190)).toMatchObject({ over: false, met: true });
    expect(floorStatus(150, 190).met).toBe(false);
  });

  it('judges micronutrients by floor and upper limit, or as a limit', () => {
    expect(microStatus(30, { amount: 15, kind: 'floor', ul: 100 })).toMatchObject({ met: true, over: false });
    expect(microStatus(120, { amount: 15, kind: 'floor', ul: 100 }).over).toBe(true);
    expect(microStatus(2400, { amount: 2300, kind: 'limit' }).over).toBe(true);
    expect(microStatus(2200, { amount: 2300, kind: 'limit' })).toMatchObject({ over: false, met: false });
  });

  it('works out % of your own target', () => {
    const t = dayTargets({ id: 't', createdAt: 0, updatedAt: 0, from: '2026-11-01', mode: 'target', kcal: 2700, diet: 'lifter', pct: [28, 45, 27], grams: [190, 300, 80], sex: 'm', birthYear: 1997 }, '2026-11-10');
    expect(pctOfTarget('p', 62, t)).toBe(33);
    expect(pctOfTarget('sugars', 10, t)).toBeUndefined();
    expect(pctOfTarget('p', undefined, t)).toBeUndefined();
  });

  it('counts on target as 90–103% of calories', () => {
    expect(onTarget(2430, 2700)).toBe(true);
    expect(onTarget(2420, 2700)).toBe(false);
    expect(onTarget(2781, 2700)).toBe(true);
    expect(onTarget(2782, 2700)).toBe(false);
  });

  it('leaves empty and future days out of week stats', () => {
    const targets = { kcal: 2700, p: 190, c: 300, f: 80, micro: {} };
    const days = [
      { day: '2026-11-08', totals: { kcal: 2600, p: 195, c: 300, f: 80 }, count: 6, targets },
      { day: '2026-11-09', totals: { kcal: 2900, p: 150, c: 300, f: 100 }, count: 8, targets },
      { day: '2026-11-10', totals: {}, count: 0, targets },
      { day: '2026-11-11', totals: { kcal: 2000, p: 200 }, count: 2, targets },
    ];
    const w = weekStats(days, '2026-11-10');
    expect(w.days).toBe(2);
    expect(w.avg.kcal).toBe(2750);
    expect(w.onTarget).toEqual({ n: 1, of: 2 });
    expect(w.proteinHit).toEqual({ n: 1, of: 2 });
  });

  it('lists top contributors', () => {
    const top = topContributors([e('a', { sodium: 100 }), e('b', { sodium: 300 }), e('c', {})], 'sodium');
    expect(top.map((t) => t.entry.id)).toEqual(['b', 'a']);
    expect(top[0].share).toBe(0.75);
  });
});
