import { describe, expect, it } from 'vitest';
import { pickNextUp } from './nextUp';

const routines = [
  { id: 'pushA', order: 0 },
  { id: 'pullA', order: 1 },
  { id: 'legs', order: 2 },
  { id: 'pushB', order: 3 },
];

describe('pickNextUp', () => {
  it('picks the routine done longest ago', () => {
    const last = new Map([
      ['pushA', 29],
      ['pullA', 33],
      ['legs', 34],
      ['pushB', 30],
    ]);
    expect(pickNextUp(routines, last)).toBe('pushA');
  });
  it('treats never-done as oldest, ties by folder order', () => {
    const last = new Map([['pushA', 10]]);
    expect(pickNextUp(routines, last)).toBe('pullA');
  });
  it('skips the routine that is running', () => {
    const last = new Map([
      ['pushA', 29],
      ['pullA', 33],
      ['legs', 34],
      ['pushB', 30],
    ]);
    expect(pickNextUp(routines, last, 'pushA')).toBe('pushB');
  });
  it('returns undefined for an empty folder', () => {
    expect(pickNextUp([], new Map())).toBeUndefined();
  });
});
