import { describe, expect, it } from 'vitest';
import type { PlanSchedule, ScheduleSlot, ScheduleVersion } from '../db/types';
import {
  addDayKey,
  delayCyclePatch,
  skipDayPatch,
  applyOverrides,
  currentVersion,
  describeSchedule,
  describeWhen,
  doItTodayPatch,
  hasSchedule,
  missedYesterday,
  moveDayPatch,
  onPlan,
  planDays,
  planSince,
  resetDayPatch,
  restTarget,
  routineCodes,
  suggestDays,
  swapDaysPatch,
  swapTarget,
  weekCounts,
  withScheduleFrom,
  type PlanDay,
} from './schedule';

// The storyboard's plan: PPL on a weekly split. Thu Nov 5, 2026 is "today".
const TODAY = '2026-11-05';
const PPL_WEEK: ScheduleSlot[] = [null, 'pullA', 'legs', null, 'pushA', 'pushB', null]; // Sun … Sat

const weekly = (onMiss: 'skip' | 'rest' = 'skip', from = '2026-09-01'): ScheduleVersion => ({ from, kind: 'weekly', days: PPL_WEEK, onMiss });
const cycle = (onMiss: 'wait' | 'stick', from = '2026-11-01', anchor = from): ScheduleVersion => ({
  from,
  kind: 'cycle',
  days: ['pushA', 'pullA', 'legs', null],
  anchor,
  onMiss,
});
const sched = (v: ScheduleVersion | ScheduleVersion[], overrides: PlanSchedule['overrides'] = {}, skipped?: string[]): PlanSchedule => ({
  versions: Array.isArray(v) ? v : [v],
  overrides,
  skipped,
});
const trained = (entries: [string, string][]) => {
  const m = new Map<string, string[]>();
  for (const [k, r] of entries) m.set(k, [...(m.get(k) ?? []), r]);
  return m;
};
const run = (schedule: PlanSchedule, t: Map<string, string[]>, from = '2026-11-01', to = '2026-11-14', today = TODAY) =>
  planDays({ schedule, trained: t, today, from, to, weekStart: 0 });
const at = (days: PlanDay[], key: string) => days.find((d) => d.key === key)!;
const brief = (days: PlanDay[]) => days.map((d) => `${d.key.slice(8)}:${d.planned ?? '-'}:${d.state}`);

describe('weekly split', () => {
  it('plans each weekday and marks done, missed, today and upcoming', () => {
    const days = run(sched(weekly()), trained([['2026-11-02', 'pullA'], ['2026-11-03', 'legs']]));
    expect(brief(days.slice(0, 7))).toEqual([
      '01:-:rest',
      '02:pullA:done',
      '03:legs:done',
      '04:-:rest',
      '05:pushA:today',
      '06:pushB:upcoming',
      '07:-:rest',
    ]);
    expect(weekCounts(days.slice(0, 7))).toEqual({ done: 2, total: 4 });
  });

  it('a missed workout is missed with "Skip it"', () => {
    const days = run(sched(weekly()), trained([['2026-11-02', 'pullA']]));
    expect(at(days, '2026-11-03').state).toBe('missed');
    expect(onPlan(days)).toEqual({ done: 1, due: 2, missed: 1 });
  });

  it('any workout on a planned day counts as doing it', () => {
    const days = run(sched(weekly()), trained([['2026-11-02', 'legs']]));
    expect(at(days, '2026-11-02').state).toBe('done');
  });

  it('training on a rest day is an extra, not a miss', () => {
    const days = run(sched(weekly()), trained([['2026-11-04', '']]));
    expect(at(days, '2026-11-04').state).toBe('extra');
  });

  it('"Move to rest day" slots a missed workout into the next rest day that week', () => {
    // Fri Nov 6 Push B missed; today is Sat Nov 7, a rest day.
    const days = run(sched(weekly('rest')), trained([['2026-11-02', 'pullA'], ['2026-11-03', 'legs'], ['2026-11-05', 'pushA']]), '2026-11-01', '2026-11-14', '2026-11-07');
    expect(at(days, '2026-11-06')).toMatchObject({ state: 'moved', movedTo: '2026-11-07' });
    expect(at(days, '2026-11-07')).toMatchObject({ planned: 'pushB', state: 'today', changed: true, movedFrom: '2026-11-06' });
  });

  it('missing several days carries each to the following rest days', () => {
    const days = run(sched(weekly('rest')), trained([]), '2026-11-01', '2026-11-07', '2026-11-04');
    expect(at(days, '2026-11-02')).toMatchObject({ state: 'moved', movedTo: '2026-11-04' });
    expect(at(days, '2026-11-04')).toMatchObject({ planned: 'pullA', state: 'today' });
    expect(at(days, '2026-11-03')).toMatchObject({ state: 'moved', movedTo: '2026-11-07' });
  });

  it('carried workouts never cross into the next week', () => {
    // Fri Nov 6 missed, Sat Nov 7 (rest) not trained either: the carry fails on Sat and stops there.
    const days = run(sched(weekly('rest')), trained([['2026-11-02', 'pullA'], ['2026-11-03', 'legs'], ['2026-11-05', 'pushA']]), '2026-11-01', '2026-11-14', '2026-11-09');
    expect(at(days, '2026-11-07')).toMatchObject({ planned: 'pushB', state: 'missed' });
    expect(at(days, '2026-11-08')).toMatchObject({ planned: null, state: 'rest' });
  });

  it('deleted routines count as rest', () => {
    const days = planDays({ schedule: sched(weekly()), trained: new Map(), today: TODAY, from: '2026-11-02', to: '2026-11-02', weekStart: 0, exists: (id) => id !== 'pullA' });
    expect(days[0]).toMatchObject({ planned: null, state: 'rest' });
  });

  it('days before the plan started have no plan', () => {
    const days = run(sched(weekly('skip', '2026-11-04')), trained([['2026-11-02', 'pullA']]));
    expect(at(days, '2026-11-02').state).toBe('extra');
    expect(at(days, '2026-11-03').state).toBe('off');
    expect(at(days, '2026-11-03').planned).toBeUndefined();
  });
});

describe('repeating cycle', () => {
  it('"Stick to dates" follows the calendar from day 1', () => {
    const days = run(sched(cycle('stick')), trained([['2026-11-01', 'pushA']]), '2026-11-01', '2026-11-09');
    expect(brief(days)).toEqual([
      '01:pushA:done',
      '02:pullA:missed',
      '03:legs:missed',
      '04:-:rest',
      '05:pushA:today',
      '06:pullA:upcoming',
      '07:legs:upcoming',
      '08:-:rest',
      '09:pushA:upcoming',
    ]);
    expect(days.map((d) => d.cycleDay)).toEqual([0, 1, 2, 3, 0, 1, 2, 3, 0]);
  });

  it('"Wait for me" pauses on missed days', () => {
    const days = run(sched(cycle('wait')), trained([['2026-11-01', 'pushA'], ['2026-11-04', 'pullA']]), '2026-11-01', '2026-11-08');
    expect(brief(days)).toEqual([
      '01:pushA:done',
      '02:pullA:paused',
      '03:pullA:paused',
      '04:pullA:done',
      '05:legs:today',
      '06:-:rest',
      '07:pushA:upcoming',
      '08:pullA:upcoming',
    ]);
    expect(onPlan(days).missed).toBe(0);
  });

  it('rest days pass even when waiting', () => {
    const days = run(sched(cycle('wait', '2026-11-01', '2026-10-29')), trained([]), '2026-11-01', '2026-11-03', '2026-11-03');
    // Anchor Oct 29 → Nov 1 is day 4 (rest), then Push A waits.
    expect(brief(days)).toEqual(['01:-:rest', '02:pushA:paused', '03:pushA:today']);
  });

  it('training early on a rest day counts for the next workout', () => {
    const days = run(sched(cycle('wait', '2026-11-01', '2026-10-29')), trained([['2026-11-01', 'pushA']]), '2026-11-01', '2026-11-03', '2026-11-03');
    expect(brief(days)).toEqual(['01:-:extra', '02:pullA:paused', '03:pullA:today']);
  });

  it('a different routine just for today leaves the cycle waiting', () => {
    const s = sched(cycle('wait'), { '2026-11-01': { routineId: 'legs' } });
    const days = run(s, trained([['2026-11-01', 'legs']]), '2026-11-01', '2026-11-02', '2026-11-02');
    expect(brief(days)).toEqual(['01:legs:done', '02:pushA:today']);
  });

  it('resting today with "Wait for me" pushes the cycle back a day', () => {
    const s = sched(cycle('wait'), { [TODAY]: { routineId: null } });
    const days = run(s, trained([['2026-11-01', 'pushA'], ['2026-11-02', 'pullA'], ['2026-11-03', 'legs']]), TODAY, '2026-11-07');
    // Nov 4 is the cycle's rest, today rested by hand, so Push A waits until Fri.
    expect(brief(days)).toEqual(['05:-:rest', '06:pushA:upcoming', '07:pullA:upcoming']);
  });
});

describe('versions', () => {
  it('a new version changes the plan from its day on; earlier days keep the old plan', () => {
    const s = sched([weekly('skip', '2026-09-01'), { from: '2026-11-04', kind: 'weekly', days: [null, null, null, 'legs', 'legs', 'legs', null], onMiss: 'skip' }]);
    const days = run(s, trained([]), '2026-11-02', '2026-11-05');
    expect(brief(days)).toEqual(['02:pullA:missed', '03:legs:missed', '04:legs:missed', '05:legs:today']);
  });

  it('"No schedule" versions turn the plan off', () => {
    const s = sched([weekly('skip', '2026-09-01'), { from: '2026-11-04', kind: 'none', days: [], onMiss: 'skip' }]);
    expect(hasSchedule(s, '2026-11-03')).toBe(true);
    expect(hasSchedule(s, TODAY)).toBe(false);
    expect(at(run(s, trained([])), TODAY).state).toBe('off');
  });

  it('since: the start of the current run of scheduled versions', () => {
    const s = sched([weekly('skip', '2026-03-01'), { from: '2026-06-01', kind: 'none', days: [], onMiss: 'skip' }, weekly('skip', '2026-09-01'), cycle('wait', '2026-10-01')]);
    expect(planSince(s, TODAY)).toBe('2026-09-01');
    expect(currentVersion(s, TODAY)?.kind).toBe('cycle');
  });

  it('saving from today keeps earlier versions and drops changes from today on', () => {
    const s = sched(weekly('skip', '2026-09-01'), { '2026-11-02': { routineId: null }, '2026-11-06': { routineId: 'legs' } }, ['2026-11-03']);
    const next = withScheduleFrom(s, { kind: 'cycle', days: ['pushA', null], todayIndex: 1, onMiss: 'wait' }, TODAY)!;
    expect(next.versions).toHaveLength(2);
    expect(next.versions[1]).toMatchObject({ from: TODAY, kind: 'cycle', anchor: '2026-11-04' });
    expect(Object.keys(next.overrides)).toEqual(['2026-11-02']);
    expect(next.skipped).toEqual(['2026-11-03']);
    // Today is day 2 (rest), so tomorrow is day 1.
    const days = run(next, trained([]), TODAY, '2026-11-06');
    expect(brief(days)).toEqual(['05:-:rest', '06:pushA:upcoming']);
  });

  it('saving twice on one day replaces that day\'s version', () => {
    const a = withScheduleFrom(undefined, { kind: 'weekly', days: PPL_WEEK, todayIndex: 0, onMiss: 'skip' }, TODAY)!;
    const b = withScheduleFrom(a, { kind: 'cycle', days: ['pushA'], todayIndex: 0, onMiss: 'wait' }, TODAY)!;
    expect(b.versions).toHaveLength(1);
    expect(withScheduleFrom(b, { kind: 'none', days: [], todayIndex: 0, onMiss: 'skip' }, TODAY)).toBeUndefined();
  });
});

describe('one-off changes', () => {
  const base = sched(weekly());
  const t = trained([['2026-11-02', 'pullA'], ['2026-11-03', 'legs']]);

  it('moving a workout leaves an arrow behind and lands grey-outlined', () => {
    const s = applyOverrides(base, moveDayPatch('2026-11-13', 'pushB', '2026-11-14'));
    const days = run(s, t, '2026-11-08', '2026-11-14');
    expect(at(days, '2026-11-13')).toMatchObject({ planned: null, state: 'moved', movedTo: '2026-11-14' });
    expect(at(days, '2026-11-14')).toMatchObject({ planned: 'pushB', changed: true, movedFrom: '2026-11-13' });
  });

  it('swapping trades two days; resetting one undoes both', () => {
    const s = applyOverrides(base, swapDaysPatch(TODAY, 'pushA', '2026-11-06', 'pushB'));
    const days = run(s, t);
    expect(at(days, TODAY).planned).toBe('pushB');
    expect(at(days, '2026-11-06').planned).toBe('pushA');
    const back = applyOverrides(s, resetDayPatch(s, '2026-11-06'));
    expect(back.overrides).toEqual({});
  });

  it('finds where "Rest today" and "Swap" go', () => {
    const days = run(base, t);
    expect(restTarget(days, TODAY)?.key).toBe('2026-11-07');
    expect(swapTarget(days, TODAY)).toMatchObject({ key: '2026-11-06', planned: 'pushB' });
  });

  it('C3: missed yesterday, then "Do it today" or "Skip it"', () => {
    const today = '2026-11-07';
    const days = run(base, t, '2026-11-01', '2026-11-14', today);
    const missed = missedYesterday(days, today, base)!;
    expect(missed).toMatchObject({ key: '2026-11-06', planned: 'pushB' });

    const moved = applyOverrides(base, doItTodayPatch(missed, today));
    const after = run(moved, t, '2026-11-01', '2026-11-14', today);
    expect(at(after, '2026-11-06').state).toBe('moved');
    expect(at(after, today)).toMatchObject({ planned: 'pushB', state: 'today' });
    expect(missedYesterday(after, today, moved)).toBeUndefined();

    const skipped = { ...base, skipped: ['2026-11-06'] };
    expect(missedYesterday(run(skipped, t, '2026-11-01', '2026-11-14', today), today, skipped)).toBeUndefined();
  });

  it('no note about a schedule replaced today', () => {
    const s = sched([weekly('skip'), cycle('stick', '2026-11-07')]);
    const days = run(s, t, '2026-11-01', '2026-11-14', '2026-11-07');
    expect(at(days, '2026-11-06').state).toBe('missed');
    expect(missedYesterday(days, '2026-11-07', s)).toBeUndefined();
  });

  it('"Wait for me" cycles never show the missed note', () => {
    const s = sched(cycle('wait'));
    expect(missedYesterday(run(s, trained([])), TODAY, s)).toBeUndefined();
  });
});

describe('routineCodes', () => {
  it('matches the storyboard: PA / PL / L / PB', () => {
    const codes = routineCodes([
      { id: 'a', name: 'Push A' },
      { id: 'b', name: 'Pull A' },
      { id: 'c', name: 'Legs' },
      { id: 'd', name: 'Push B' },
    ]);
    expect([...codes.values()]).toEqual(['PA', 'PL', 'L', 'PB']);
  });

  it('own codes win and are never reused', () => {
    const codes = routineCodes([
      { id: 'a', name: 'Lower', code: 'lo' },
      { id: 'b', name: 'Legs' },
      { id: 'c', name: 'Lats' },
    ]);
    expect(codes.get('a')).toBe('LO');
    expect(codes.get('b')).toBe('L');
    expect(codes.get('c')).toBe('LT');
  });

  it('falls back to numbers', () => {
    const codes = routineCodes([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'A' },
    ]);
    expect(codes.get('a')).toBe('A');
    expect(codes.get('b')).toBe('A2');
  });
});

describe('suggestDays', () => {
  it('spreads routines over the week, Monday first', () => {
    expect(suggestDays('weekly', ['a', 'b', 'c', 'd'])).toEqual([null, 'a', 'b', null, 'c', 'd', null]);
    expect(suggestDays('cycle', ['a', 'b'])).toEqual(['a', 'b', null]);
  });
});

it('addDayKey crosses months', () => {
  expect(addDayKey('2026-10-31', 1)).toBe('2026-11-01');
});

describe('descriptions', () => {
  const v = weekly();
  it('describeWhen', () => {
    expect(describeWhen(v, 'pushA', 0)).toBe('Thursdays');
    expect(describeWhen({ ...v, days: ['a', 'a', null, null, 'a', null, null] }, 'a', 1)).toBe('Mon, Thu & Sun');
    expect(describeWhen(cycle('wait'), 'legs', 0)).toBe('Day 3');
    expect(describeWhen({ ...cycle('wait'), days: ['a', 'b', 'a'] }, 'a', 0)).toBe('Days 1 & 3');
    expect(describeWhen(v, 'arms', 0)).toBeUndefined();
  });
  it('describeSchedule', () => {
    expect(describeSchedule(v)).toEqual({ title: 'Weekly split', detail: '4 workouts · 3 rest days' });
    expect(describeSchedule(cycle('wait')).detail).toBe('4 days · 3 workouts · 1 rest day');
    expect(describeSchedule(undefined).title).toBe('No schedule');
  });
});


describe('explicit cycle skip and move (PH3.12)', () => {
  for (const policy of ['wait', 'stick'] as const) {
    it(`${policy}: skipping advances past the workout, delaying shifts the full cycle`, () => {
      const original = sched(cycle(policy, TODAY));
      const skipped = run(applyOverrides(original, skipDayPatch(TODAY)), new Map(), TODAY, '2026-11-12');
      expect(skipped.slice(0, 3).map(d => d.planned)).toEqual([null, 'pullA', 'legs']);
      const delayed = applyOverrides(original, delayCyclePatch(TODAY, '2026-11-07'));
      const days = run(delayed, new Map(), TODAY, '2026-11-12');
      expect(days.map(d => d.planned)).toEqual([null, null, 'pushA', 'pullA', 'legs', null, 'pushA', 'pullA']);
      expect(days.every(d => d.changed)).toBe(true);
      // Loading a later window must still account for the earlier delay.
      expect(run(delayed, new Map(), '2026-11-08', '2026-11-12').map(d => d.planned)).toEqual(days.slice(3).map(d => d.planned));
      expect(applyOverrides(delayed, resetDayPatch(delayed, '2026-11-06')).overrides).toEqual({});
    });
    it(`${policy}: a delay remains effective after the inserted rest days are in the past`, () => {
      const delayed = applyOverrides(sched(cycle(policy, TODAY)), delayCyclePatch(TODAY, '2026-11-07'));
      const days = run(delayed, new Map(), TODAY, '2026-11-09', '2026-11-07');
      expect(at(days, '2026-11-07').planned).toBe('pushA');
      expect(at(days, '2026-11-08').planned).toBe('pullA');
      expect(at(days, '2026-11-08').changed).toBe(true);
    });
  }
});
