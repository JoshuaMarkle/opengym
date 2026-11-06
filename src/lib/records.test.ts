import { describe, expect, it } from 'vitest';
import { DAY_MS } from './dates';
import { computeRecords, isRecent, recordSetIds } from './records';
import { s } from './testUtils';

const day = (n: number) => Date.UTC(2026, 9, n);

describe('computeRecords', () => {
  const sessions = [
    { workoutId: 'a', date: day(1), sets: [s('warmup', 300, 1), s('working', 225, 2), s('working', 185, 8)] },
    { workoutId: 'b', date: day(10), sets: [s('working', 235, 1), s('working', 190, 8), s('drop', 250, 3)] },
    { workoutId: 'c', date: day(20), sets: [s('working', 190, 8), s('working', 150, 15)] },
  ];
  const rec = computeRecords(sessions, 'weight');

  it('keeps the best weight for each rep count 1–12 from working sets', () => {
    expect(rec.byReps.get(1)?.weight).toBe(235);
    expect(rec.byReps.get(2)?.weight).toBe(225);
    expect(rec.byReps.get(8)?.weight).toBe(190);
    expect(rec.byReps.has(3)).toBe(false); // the 250 × 3 was a drop
    expect(rec.byReps.has(15)).toBe(false); // over 12 reps
  });
  it('credits the first time an equal record was set', () => {
    expect(rec.byReps.get(8)?.workoutId).toBe('b');
  });
  it('tracks the best est. 1RM and heaviest set', () => {
    expect(rec.heaviest).toMatchObject({ weight: 235, reps: 1 });
    expect(rec.bestE1rm?.value).toBeCloseTo(240.67, 2); // 190 × 8
    expect(rec.bestE1rm?.workoutId).toBe('b');
  });
  it('tracks most reps for bodyweight', () => {
    const bw = computeRecords([{ workoutId: 'x', date: day(1), sets: [s('working', undefined, 12), s('working', undefined, 9)] }], 'bodyweight');
    expect(bw.mostReps?.reps).toBe(12);
    expect(bw.byReps.size).toBe(0);
  });
  it('treats less assistance as the record for assisted lifts', () => {
    const a = computeRecords(
      [
        { workoutId: 'x', date: day(1), sets: [s('working', -50, 8)] },
        { workoutId: 'y', date: day(2), sets: [s('working', -40, 8)] },
      ],
      'assisted',
    );
    expect(a.byReps.get(8)?.weight).toBe(-40);
  });
});

describe('isRecent', () => {
  it('is true within 30 days', () => {
    const now = Date.UTC(2026, 10, 5);
    expect(isRecent(now - 29 * DAY_MS, now)).toBe(true);
    expect(isRecent(now - 31 * DAY_MS, now)).toBe(false);
  });
});

describe('recordSetIds', () => {
  it('flags sets that beat earlier bests, never the first session', () => {
    const first = s('working', 180, 8);
    const better = s('working', 185, 8);
    const same = s('working', 185, 8);
    const newRepCount = s('working', 205, 5);
    const ids = recordSetIds(
      [
        { workoutId: 'a', date: day(1), sets: [first] },
        { workoutId: 'b', date: day(2), sets: [better] },
        { workoutId: 'c', date: day(3), sets: [same, newRepCount] },
      ],
      'weight',
    );
    expect(ids.has(first.id)).toBe(false);
    expect(ids.has(better.id)).toBe(true);
    expect(ids.has(same.id)).toBe(false);
    expect(ids.has(newRepCount.id)).toBe(true);
  });
});
