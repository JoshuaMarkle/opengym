import { describe, expect, it } from 'vitest';
import {
  asksEffort,
  canHalf,
  effortBadge,
  effortReps,
  effortText,
  padFromRpe,
  padKeyLabel,
  PAD_KEYS,
  parseRpe,
  rpeFromPad,
  sameWeightEasier,
} from './effort';
import type { LoggedSet } from './sets';

const set = (id: string, kind: LoggedSet['kind'], extra: Partial<LoggedSet> = {}): LoggedSet => ({ id, order: 0, kind, completed: true, ...extra });

describe('effort pad', () => {
  it('RPE: a key plus ½ is the half above', () => {
    expect(rpeFromPad({ base: 8, half: false }, 'rpe')).toBe(8);
    expect(rpeFromPad({ base: 8, half: true }, 'rpe')).toBe(8.5);
    expect(rpeFromPad({ base: 5, half: false }, 'rpe')).toBe(5);
    expect(rpeFromPad({ half: true }, 'rpe')).toBeUndefined();
  });

  it('RIR: stores 10 − RIR, so 1.5 RIR is RPE 8.5', () => {
    expect(rpeFromPad({ base: 2, half: false }, 'rir')).toBe(8);
    expect(rpeFromPad({ base: 1, half: true }, 'rir')).toBe(8.5);
    expect(rpeFromPad({ base: 0, half: true }, 'rir')).toBe(9.5);
    expect(rpeFromPad({ base: 5, half: false }, 'rir')).toBe(5);
  });

  it('no ½ on the top key', () => {
    expect(canHalf(10, 'rpe')).toBe(false);
    expect(canHalf(5, 'rir')).toBe(false);
    expect(canHalf(5, 'rpe')).toBe(true);
    expect(rpeFromPad({ base: 10, half: true }, 'rpe')).toBe(10);
  });

  it('round-trips stored values in both modes', () => {
    for (const rpe of [5, 5.5, 6, 7.5, 8, 8.5, 9, 9.5, 10]) {
      expect(rpeFromPad(padFromRpe(rpe, 'rpe'), 'rpe')).toBe(rpe);
    }
    for (const rpe of [6, 7, 7.5, 8, 8.5, 9, 9.5, 10]) {
      expect(rpeFromPad(padFromRpe(rpe, 'rir'), 'rir')).toBe(rpe);
    }
    // RPE ≤ 5 is "5+" RIR.
    expect(padFromRpe(4, 'rir')).toEqual({ base: 5, half: false });
    expect(padFromRpe(3, 'rpe')).toEqual({ base: 5, half: false });
  });

  it('shows the half on the picked key', () => {
    const k8 = PAD_KEYS.rpe.find((k) => k.value === 8)!;
    expect(padKeyLabel(k8, { base: 8, half: true }, 'rpe')).toBe('8.5');
    expect(padKeyLabel(k8, { base: 7, half: true }, 'rpe')).toBe('8');
    const k1 = PAD_KEYS.rir.find((k) => k.value === 1)!;
    expect(padKeyLabel(k1, { base: 1, half: true }, 'rir')).toBe('1.5');
  });
});

describe('effort text', () => {
  it('badges: RPE plain, RIR with R, halves drop the R when narrow', () => {
    expect(effortBadge(8, 'rpe')).toBe('8');
    expect(effortBadge(8.5, 'rpe')).toBe('8.5');
    expect(effortBadge(5, 'rpe')).toBe('≤5');
    expect(effortBadge(8, 'rir')).toBe('2R');
    expect(effortBadge(8.5, 'rir')).toBe('1.5R');
    expect(effortBadge(8.5, 'rir', true)).toBe('1.5');
    expect(effortBadge(8, 'rir', true)).toBe('2R');
    expect(effortBadge(4, 'rir')).toBe('5+R');
  });

  it('lines: @8 or 2 RIR', () => {
    expect(effortText(8, 'rpe')).toBe('@8');
    expect(effortText(9.5, 'rpe')).toBe('@9.5');
    expect(effortText(8, 'rir')).toBe('2 RIR');
    expect(effortText(5, 'rir')).toBe('5+ RIR');
  });
});

describe('asksEffort', () => {
  const sets = [set('w', 'warmup'), set('a', 'working'), set('d', 'drop'), set('b', 'working')];
  it('every working set, never warm-ups or drops', () => {
    expect(asksEffort('every', sets[1], sets)).toBe(true);
    expect(asksEffort('every', sets[0], sets)).toBe(false);
    expect(asksEffort('every', sets[2], sets)).toBe(false);
  });
  it('last: only the last working set', () => {
    expect(asksEffort('last', sets[1], sets)).toBe(false);
    expect(asksEffort('last', sets[3], sets)).toBe(true);
  });
  it('tap: never', () => {
    expect(asksEffort('tap', sets[3], sets)).toBe(false);
  });
});

describe('effortReps', () => {
  it('adds reps in reserve', () => {
    expect(effortReps(8, 8)).toBe(10);
    expect(effortReps(5, 10)).toBe(5);
    expect(effortReps(6, undefined)).toBe(6);
  });
});

describe('parseRpe', () => {
  it('reads 1–10 in half steps', () => {
    expect(parseRpe('8')).toBe(8);
    expect(parseRpe('8,5')).toBe(8.5);
    expect(parseRpe('8.3')).toBe(8.5);
    expect(parseRpe('')).toBeUndefined();
    expect(parseRpe('0')).toBeUndefined();
    expect(parseRpe('11')).toBeUndefined();
    expect(parseRpe(undefined)).toBeUndefined();
  });
});

describe('sameWeightEasier', () => {
  const day = (d: number) => new Date(2026, 9, d).getTime();
  it('finds the same weight × reps at a lower RPE', () => {
    const r = sameWeightEasier([
      { date: day(12), sets: [set('1', 'working', { weight: 185, reps: 8, rpe: 9 })] },
      { date: day(25), sets: [set('2', 'working', { weight: 185, reps: 8, rpe: 8.5 })] },
      { date: day(31), sets: [set('3', 'working', { weight: 185, reps: 8, rpe: 8 })] },
    ]);
    expect(r).toEqual({ weight: 185, reps: 8, fromRpe: 9, toRpe: 8, since: day(12) });
  });

  it('needs at least as many reps, and ignores warm-ups and unrated sets', () => {
    expect(
      sameWeightEasier([
        { date: day(1), sets: [set('1', 'working', { weight: 185, reps: 10, rpe: 9 }), set('w', 'warmup', { weight: 185, reps: 8, rpe: 9 })] },
        { date: day(8), sets: [set('2', 'working', { weight: 185, reps: 8, rpe: 8 }), set('3', 'working', { weight: 185, reps: 8 })] },
      ]),
    ).toBeNull();
  });

  it('only looks back within the window', () => {
    expect(
      sameWeightEasier(
        [
          { date: day(1), sets: [set('1', 'working', { weight: 185, reps: 8, rpe: 9 })] },
          { date: day(1) + 70 * 86_400_000, sets: [set('2', 'working', { weight: 185, reps: 8, rpe: 8 })] },
        ],
        56,
      ),
    ).toBeNull();
  });
});
