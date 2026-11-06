import { describe, expect, it } from 'vitest';
import type { Equipment } from '../db/types';
import { guessExerciseMeta, matchExerciseName, normalizeName } from './match';

const lib = (
  [
    ['Bench Press', 'barbell'],
    ['DB Bench Press', 'dumbbell'],
    ['Squat', 'barbell'],
    ['Cable Fly', 'cable'],
    ['Dips', 'bodyweight'],
    ['Pull-up', 'bodyweight'],
    ['Lat Pulldown', 'cable'],
    ['Lateral Raise', 'dumbbell'],
    ['DB Curl', 'dumbbell'],
    ['Triceps Pushdown', 'cable'],
    ['Romanian Deadlift', 'barbell'],
    ['Overhead Press', 'barbell'],
  ] as [string, Equipment][]
).map(([name, equipment]) => ({ id: name, name, equipment }));

const m = (name: string) => matchExerciseName(name, lib);

describe('normalizeName', () => {
  it('unifies spelling', () => {
    expect(normalizeName('Pull Up')).toBe(normalizeName('Pull-up'));
    expect(normalizeName('Pullups')).toBe(normalizeName('pull-up'));
    expect(normalizeName('Tricep Pushdown')).toBe(normalizeName('Triceps Pushdown'));
  });
});

describe('matchExerciseName', () => {
  it('matches exact names and equipment suffixes surely', () => {
    expect(m('Bench Press (Barbell)')).toEqual({ exerciseId: 'Bench Press', confidence: 'sure' });
    expect(m('Squat (Barbell)')).toEqual({ exerciseId: 'Squat', confidence: 'sure' });
    expect(m('Bench Press (Dumbbell)')).toEqual({ exerciseId: 'DB Bench Press', confidence: 'sure' });
    expect(m('Lateral Raise (Dumbbell)')).toEqual({ exerciseId: 'Lateral Raise', confidence: 'sure' });
    expect(m('Pull Up')).toEqual({ exerciseId: 'Pull-up', confidence: 'sure' });
    expect(m('Bicep Curl (Dumbbell)')).toEqual({ exerciseId: 'DB Curl', confidence: 'sure' });
    expect(m('Romanian Deadlift (Barbell)').exerciseId).toBe('Romanian Deadlift');
    expect(m('Dip')).toEqual({ exerciseId: 'Dips', confidence: 'sure' });
  });
  it('flags close-but-unsure matches', () => {
    expect(m('Lat Pulldown (Machine)')).toEqual({ exerciseId: 'Lat Pulldown', confidence: 'unsure' });
    expect(m('Cable Crossover Fly')).toEqual({ exerciseId: 'Cable Fly', confidence: 'unsure' });
  });
  it('returns new for unknown exercises', () => {
    expect(m('Zercher Carry')).toEqual({ confidence: 'new' });
  });
});

it('guesses muscle and equipment for new exercises', () => {
  expect(guessExerciseMeta('Hack Squat (Machine)')).toEqual({ muscle: 'legs', equipment: 'machine' });
  expect(guessExerciseMeta('Preacher Curl (Dumbbell)')).toEqual({ muscle: 'arms', equipment: 'dumbbell' });
});
