import { describe, expect, it } from 'vitest';
import { SEED_EXERCISES, seedExerciseId } from '../db/seedExercises';
import { comebackAt, generateSampleData, parsePlanSets, sampleRir, strengthAt } from './sampleData';

const NOW = new Date(2026, 10, 6, 12).getTime();
const data = generateSampleData({ now: NOW });
const at = (y: number, m: number, d = 1) => new Date(y, m - 1, d).getTime();

describe('parsePlanSets', () => {
  it('reads warm-ups, working sets and chained drops', () => {
    expect(parsePlanSets('w75x12 155x6.5 42x6d35x4d27.5x3')).toEqual([
      { kind: 'warmup', weight: 75, reps: 12, drops: [] },
      { kind: 'working', weight: 155, reps: 7, drops: [] },
      { kind: 'working', weight: 42, reps: 6, drops: [{ weight: 35, reps: 4 }, { weight: 27.5, reps: 3 }] },
    ]);
  });
});

describe('generateSampleData', () => {
  it('is deterministic', () => {
    const again = generateSampleData({ now: NOW });
    expect(again.workoutSets.length).toBe(data.workoutSets.length);
    expect(again.workoutSets[500]).toEqual(data.workoutSets[500]);
  });

  it('runs from July 2024 to before today', () => {
    const starts = data.workouts.map((w) => w.startedAt).sort((a, b) => a - b);
    expect(new Date(starts[0]).getFullYear()).toBe(2024);
    expect(new Date(starts[0]).getMonth()).toBe(6);
    expect(starts[starts.length - 1]).toBeLessThan(at(2026, 11, 6));
    expect(data.workouts.length).toBeGreaterThan(250);
  });

  it('only uses exercises that exist', () => {
    const ids = new Set([...SEED_EXERCISES.map((e) => seedExerciseId(e.name)), ...data.exercises.map((e) => e.id)]);
    for (const we of data.workoutExercises) expect(ids, we.exerciseId).toContain(we.exerciseId);
    for (const re of data.routineExercises) expect(ids, re.exerciseId).toContain(re.exerciseId);
  });

  it('links every set and drop to a real parent', () => {
    const wes = new Set(data.workoutExercises.map((w) => w.id));
    const sets = new Set(data.workoutSets.map((s) => s.id));
    for (const s of data.workoutSets) {
      expect(wes.has(s.workoutExerciseId)).toBe(true);
      if (s.kind === 'drop') expect(sets.has(s.parentSetId!)).toBe(true);
    }
  });

  it('follows the trend: peak autumn 2024, low July 2026, back up now', () => {
    expect(strengthAt(at(2024, 10, 31))).toBeGreaterThan(strengthAt(at(2024, 7, 1)));
    expect(strengthAt(at(2026, 7, 1))).toBeLessThan(strengthAt(at(2025, 12, 1)));
    expect(strengthAt(NOW)).toBeCloseTo(1, 2);
    // Bench top set lands on the current plan (155) in the last month.
    const bench = new Set(data.workoutExercises.filter((w) => w.exerciseId === 'ex-bench-press').map((w) => w.id));
    const byId = new Map(data.workouts.map((w) => [w.id, w]));
    const weOf = new Map(data.workoutExercises.map((w) => [w.id, w]));
    const recent = data.workoutSets.filter((s) => bench.has(s.workoutExerciseId) && s.kind === 'working' && byId.get(weOf.get(s.workoutExerciseId)!.workoutId)!.startedAt > at(2026, 10, 15));
    expect(recent.length).toBeGreaterThan(0);
    const avg = recent.reduce((a, s) => a + s.weight!, 0) / recent.length;
    expect(avg).toBeGreaterThan(150);
    expect(avg).toBeLessThan(160);
  });
});

describe('sample gaps, variety and effort', () => {
  const byId = new Map(data.workouts.map((w) => [w.id, w]));
  const weOf = new Map(data.workoutExercises.map((w) => [w.id, w]));
  const dayOf = (setId: string) => byId.get(weOf.get(data.workoutSets.find((s) => s.id === setId)!.workoutExerciseId)!.workoutId)!.startedAt;

  it('has seven weeks with nothing logged in Feb–Mar 2026', () => {
    const inGap = data.workouts.filter((w) => w.startedAt >= at(2026, 2, 9) && w.startedAt < at(2026, 3, 30));
    expect(inGap).toEqual([]);
    expect(data.workouts.some((w) => w.startedAt >= at(2026, 1, 26) && w.startedAt < at(2026, 2, 9))).toBe(true);
    expect(data.workouts.some((w) => w.startedAt >= at(2026, 3, 30) && w.startedAt < at(2026, 4, 13))).toBe(true);
  });

  it('comes back lighter after a long break, fading over four weeks', () => {
    expect(comebackAt(at(2026, 3, 31))).toBeGreaterThan(0.05);
    expect(comebackAt(at(2026, 4, 14))).toBeLessThan(comebackAt(at(2026, 3, 31)));
    expect(comebackAt(at(2026, 5, 1))).toBe(0);
    expect(comebackAt(at(2025, 9, 1))).toBe(0);
  });

  it('varies isolation lifts more than bench, without silly reps', () => {
    const reps = (id: string) => {
      const wes = new Set(data.workoutExercises.filter((w) => w.exerciseId === id).map((w) => w.id));
      return data.workoutSets.filter((s) => wes.has(s.workoutExerciseId) && s.kind === 'working' && s.order <= 1).map((s) => s.reps!);
    };
    const spread = (xs: number[]) => {
      const m = xs.reduce((a, b) => a + b, 0) / xs.length;
      return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
    };
    expect(spread(reps('ex-lateral-raise'))).toBeGreaterThan(spread(reps('ex-bench-press')));
    for (const r of [...reps('ex-lateral-raise'), ...reps('ex-bench-press')]) {
      expect(r).toBeGreaterThanOrEqual(2);
      expect(r).toBeLessThanOrEqual(16);
    }
  });

  it('rates working sets as RIR for the last ~5 months only, mostly whole numbers', () => {
    const rated = data.workoutSets.filter((s) => s.rpe != null);
    expect(rated.length).toBeGreaterThan(500);
    for (const s of rated) expect(s.kind).toBe('working');
    const first = Math.min(...rated.map((s) => dayOf(s.id)));
    expect(first).toBeGreaterThan(at(2026, 5, 15));
    expect(first).toBeLessThan(at(2026, 6, 30));
    const whole = rated.filter((s) => Number.isInteger(s.rpe)).length;
    expect(whole / rated.length).toBeGreaterThan(0.7);
    const rir = rated.map((s) => 10 - s.rpe!);
    expect(Math.min(...rir)).toBe(0);
    expect(Math.max(...rir)).toBe(5);
  });

  it('writes down RIR close to the truth near failure and low far from it', () => {
    let n = 0;
    const rand = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
    const avg = (t: number) => Array.from({ length: 400 }, () => 10 - sampleRir(t, rand)).reduce((a, b) => a + b, 0) / 400;
    expect(avg(1)).toBeCloseTo(1, 0);
    expect(avg(8)).toBeLessThanOrEqual(5);
    expect(avg(8)).toBeGreaterThan(4);
  });
});

describe('sample cardio and supersets', () => {
  it('has cardio sessions with time, and Sunday runs outside', () => {
    const cardioIds = new Set(['ex-treadmill', 'ex-bike', 'ex-rower', 'ex-run-walk-outside']);
    const wes = data.workoutExercises.filter((w) => cardioIds.has(w.exerciseId));
    expect(wes.length).toBeGreaterThan(50);
    const ids = new Set(wes.map((w) => w.id));
    for (const s of data.workoutSets.filter((x) => ids.has(x.workoutExerciseId))) expect(s.durationSec).toBeGreaterThan(0);
    const runs = data.workouts.filter((w) => w.name === 'Run');
    expect(runs.length).toBeGreaterThan(10);
    for (const r of runs) expect(new Date(r.startedAt).getDay()).toBe(0);
  });

  it('keeps superset partners next to each other', () => {
    const grouped = data.workoutExercises.filter((w) => w.supersetGroup);
    expect(grouped.length).toBeGreaterThan(0);
    const byWorkout = new Map<string, typeof grouped>();
    for (const w of grouped) byWorkout.set(w.workoutId, [...(byWorkout.get(w.workoutId) ?? []), w]);
    for (const list of byWorkout.values()) {
      expect(list.length).toBe(2);
      expect(Math.abs(list[0].order - list[1].order)).toBe(1);
    }
    expect(data.routineExercises.filter((r) => r.supersetGroup).length).toBe(4);
  });
});
