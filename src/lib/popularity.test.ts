import { describe, expect, it } from 'vitest';
import { SEED_EXERCISES, seedExerciseId } from '../db/seedExercises';
import { focusWeight, isRare, pickFocus, popularityOf, rankPopular, variationChips, variationList, visibleAZ, type Rankable } from './popularity';

const seed: Rankable[] = SEED_EXERCISES.map((e) => ({ id: seedExerciseId(e.name), name: e.name, popularity: e.popularity }));
const ex = (name: string) => seed.find((e) => e.name === name)!;
const counts = (m: Record<string, number>) => (id: string) => m[seed.find((e) => e.id === id)?.name ?? id] ?? 0;
const names = (l: Rankable[]) => l.map((e) => e.name);

describe('seed', () => {
  it('scores every built-in 0–10 and hides the proposal’s 60 (Farmer’s Carry not built yet)', () => {
    expect(SEED_EXERCISES.every((e) => Number.isInteger(e.popularity) && e.popularity >= 0 && e.popularity <= 10)).toBe(true);
    expect(SEED_EXERCISES.length).toBe(209);
    expect(seed.filter(isRare).length).toBe(61);
    expect(new Set(SEED_EXERCISES.map((e) => e.name)).size).toBe(SEED_EXERCISES.length);
  });
  it('custom exercises count as 6', () => {
    expect(popularityOf({ id: 'x', name: 'Mine' })).toBe(6);
    expect(isRare({ id: 'x', name: 'Mine' })).toBe(false);
  });
});

describe('rankPopular', () => {
  const rows = seed.filter((e) => /row/i.test(e.name)).sort((a, b) => a.name.localeCompare(b.name));
  it('A1: your 4 most-logged first, then the most popular; rare ones hidden', () => {
    const r = rankPopular(seed, { sessions: counts({ 'Bench Press': 51, 'Lat Pulldown': 44, 'Barbell Row': 42, Squat: 38, 'Leg Curl': 2 }), searching: false });
    expect(names(r.youDo)).toEqual(['Bench Press', 'Lat Pulldown', 'Barbell Row', 'Squat']);
    expect(names(r.popular.slice(0, 5))).toEqual(['DB Curl', 'Deadlift', 'Lateral Raise', 'Leg Press', 'Treadmill']);
    expect(r.rare).toEqual([]);
    expect(r.hiddenCount).toBe(61);
  });
  it('anything logged or in a routine always shows', () => {
    const r = rankPopular(seed, { sessions: counts({ 'Yates Row': 1 }), keep: (id) => id === ex('Snatch').id, searching: false, youDoMax: 0 });
    expect(names(r.popular)).toContain('Yates Row');
    expect(names(r.popular)).toContain('Snatch');
    expect(r.hiddenCount).toBe(59);
  });
  it('A2: searching puts logged matches first, then by score, rare ones last', () => {
    const r = rankPopular(rows, { sessions: counts({ 'Barbell Row': 42, 'Seated Cable Row': 30, 'DB Row': 12, 'Underhand Barbell Row': 3 }), searching: true });
    expect(names(r.youDo)).toEqual(['Barbell Row', 'Seated Cable Row', 'DB Row', 'Underhand Barbell Row']);
    expect(names(r.popular.slice(0, 2))).toEqual(['Machine Row', 'T-Bar Row']);
    expect(names(r.rare)).toContain('Helms Row');
    expect(names(r.rare).indexOf('Seal Row')).toBeLessThan(names(r.rare).indexOf('Helms Row'));
    expect(r.hiddenCount).toBe(0);
  });
  it('Show hidden lists rare ones under Rarely used', () => {
    const r = rankPopular(seed, { sessions: () => 0, searching: false, showHidden: true });
    expect(r.rare.length).toBe(61);
    expect(r.rare[r.rare.length - 1].name).toBe('Radial Deviation');
  });
  it('A–Z keeps the same hiding rule', () => {
    const r = visibleAZ(seed, { sessions: () => 0 });
    expect(r.hiddenCount).toBe(61);
    expect(r.items[0].name).toBe('Ab Wheel Rollout');
  });
});

describe('variation chips', () => {
  const group = seed.filter((e) => SEED_EXERCISES.find((s) => s.name === e.name)?.group === 'vg-row');
  const sessions = counts({ 'Barbell Row': 42, 'DB Row': 12, 'Underhand Barbell Row': 3 });
  it('logged, then the most popular, up to 4', () => {
    const { chips, more } = variationChips(ex('Barbell Row'), group, sessions);
    expect(group.length).toBe(14);
    expect(names(chips)).toEqual(['Barbell Row', 'DB Row', 'Underhand Barbell Row', 'T-Bar Row']);
    expect(more).toBe(10);
  });
  it('a logged variation always gets a chip, even past 4; rare ones never fill', () => {
    const { chips } = variationChips(ex('Barbell Row'), group, counts({ 'DB Row': 5, 'Kroc Row': 4, 'Yates Row': 3, 'Helms Row': 2, 'Seal Row': 1 }));
    expect(names(chips)).toEqual(['DB Row', 'Kroc Row', 'Yates Row', 'Helms Row', 'Seal Row', 'Barbell Row']);
    const { chips: fresh } = variationChips(ex('Seal Row'), group, () => 0);
    expect(names(fresh)).toEqual(['Barbell Row', 'DB Row', 'T-Bar Row', 'Chest-Supported Row', 'Seal Row']);
  });
  it('keeps every visible chip in place when switching variations', () => {
    for (const history of [sessions, () => 0]) {
      const initial = variationChips(ex('Barbell Row'), group, history);
      for (const current of initial.chips) {
        expect(variationChips(current, group, history)).toEqual(initial);
      }
      const hidden = variationChips(ex('Seal Row'), group, history);
      expect(hidden.chips.slice(0, initial.chips.length)).toEqual(initial.chips);
      expect(hidden.chips.at(-1)?.name).toBe('Seal Row');
      expect(hidden.more).toBe(initial.more - 1);
    }
  });
  it('B2: All list by score, rare ones you have not logged under Rarely used', () => {
    const { main, rare } = variationList(group, sessions);
    expect(names(main)).toEqual(['Barbell Row', 'DB Row', 'T-Bar Row', 'Chest-Supported Row', 'Chest-Supported T-Bar Row', 'Underhand Barbell Row', 'Pendlay Row']);
    expect(names(rare)).toEqual(['Seal Row', 'Smith Machine Row', 'Wide-Grip Barbell Row', 'Kroc Row', 'Meadows Row', 'Yates Row', 'Helms Row']);
  });
});

describe('pickFocus (§C)', () => {
  it('weights run 0.60–1.00', () => {
    expect(focusWeight(0)).toBeCloseTo(0.6);
    expect(focusWeight(10)).toBeCloseTo(1);
  });
  it('C1: popularity breaks close calls, one per variation group', () => {
    const c = (name: string, sessions: number, group?: string) => ({ id: name, sessions, last: 0, popularity: ex(name).popularity!, group });
    const picked = pickFocus(
      [
        c('Lat Pulldown', 12, 'vg-pulldown'),
        c('Bench Press', 11, 'vg-bench'),
        c('Smith Machine Incline Press', 13, 'vg-incline'),
        c('Close-Grip Lat Pulldown', 12, 'vg-pulldown'),
        c('Leg Press', 11, 'vg-leg-press'),
        c('Single-Arm Cable Row', 13, 'vg-cable-row'),
        c('Incline DB Press', 11, 'vg-incline'),
        c('Hack Squat', 10, 'vg-machine-squat'),
        c('Squat', 9, 'vg-squat'),
      ],
      4,
    );
    expect(picked).toEqual(['Lat Pulldown', 'Bench Press', 'Smith Machine Incline Press', 'Leg Press']);
  });
  it('a tie falls to the latest; taken groups are skipped', () => {
    const a = { id: 'a', sessions: 5, last: 1, popularity: 6 };
    const b = { id: 'b', sessions: 5, last: 2, popularity: 6, group: 'g' };
    expect(pickFocus([a, b], 2)).toEqual(['b', 'a']);
    expect(pickFocus([a, b], 2, new Set(['g']))).toEqual(['a']);
  });
});
