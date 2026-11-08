import { describe, expect, it } from 'vitest';
import { SEED_EXERCISES, seedExerciseId } from '../db/seedExercises';
import { generateSampleData, parsePlanSets, strengthAt } from './sampleData';

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
    for (const s of recent) expect(s.weight).toBeGreaterThanOrEqual(150);
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
