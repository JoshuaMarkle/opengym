import { describe, expect, it } from 'vitest';
import { markSeen, pickLately, type LatelyCandidate } from './lately';
import { DAY, WEEK } from './constants';
import { goalForMilestone, goalState, likelyWeight, meetsGoal, milestoneList, milestoneRows } from './goals';
import { monthReview } from './month';
import { canProject, currentRate, etaWeeks, goalTarget, project, rateLabel, verdict } from './project';
import { comeback, defaultStep, learnedStep } from './steps';
import { sessionStrength, workingSets, type StrengthPoint } from './strength';
import { inferRange, reasonLine, suggest } from './suggest';
import { tipFor } from './tips';
import { pace, priorPace, shownStatus, trendStatus, whatChanged } from './trend';
import { s } from '../testUtils';

const R = (min: number, max: number) => ({ min, max });

describe('comeback (§11 table)', () => {
  it('ramps back from 90% / 80%', () => {
    expect(comeback(285, 12, 5)).toBeNull();
    expect(comeback(285, 23, 5)).toEqual([255, 265, 275, 285]);
    expect(comeback(285, 50, 5)).toEqual([225, 245, 265, 285]);
    expect(comeback(40, 30, 5)).toEqual([35, 35, 40, 40]);
    expect(comeback(135, 90, 5)).toEqual([105, 115, 125, 135]);
  });
});

describe('steps (§5)', () => {
  it('learns the most common jump once it repeats', () => {
    expect(learnedStep([90, 100, 100, 110])).toBe(10);
    expect(learnedStep([25, 30, 35, 35])).toBe(5);
    expect(learnedStep([90, 100, 110])).toBeUndefined();
    expect(learnedStep([90, 95, 105, 105])).toBeUndefined();
  });
  it('defaults by equipment', () => {
    expect(defaultStep('barbell', 'weight', 5, 'lb')).toBe(5);
    expect(defaultStep('dumbbell', 'weight', 5, 'lb')).toBe(5);
    expect(defaultStep('machine', 'weight', 5, 'lb')).toBe(10);
    expect(defaultStep('bodyweight', 'assisted', 5, 'lb')).toBe(10);
    expect(defaultStep('dumbbell', 'weight', 2.5, 'kg')).toBeCloseTo(4.41, 2);
  });
});

describe('suggest', () => {
  const base = { step: 5, target: [0, 2] as [number, number], lastSetOnly: false };
  it('wraps the fit-zone decision and lines up extra sets', () => {
    const sg = suggest({ ...base, type: 'weight', last: [{ weight: 200, reps: 13, rir: 0 }, { weight: 200, reps: 10, rir: 0 }, { weight: 200, reps: 7, rir: 0 }], ranges: [R(8, 12), R(8, 12), R(8, 12), R(8, 12)] })!;
    expect(sg.weights).toEqual([205, 205, 180, 180]);
    expect(sg.changed).toBe(true);
    expect(sg.lead).toBe('up');
    expect(sg.reason).toBe('set 1 past 12, set 3 under 8');
  });
  it('ignores sets beyond today', () => {
    const sg = suggest({ ...base, type: 'weight', last: [{ weight: 185, reps: 8, rir: 1 }, { weight: 185, reps: 7, rir: 0 }, { weight: 185, reps: 6, rir: 0 }], ranges: [R(6, 8)] })!;
    expect(sg.weights).toEqual([190]);
  });
  it('gives rep hints only without a range', () => {
    const sg = suggest({ ...base, type: 'weight', last: [{ weight: 100, reps: 8, rir: 2 }, { weight: 100, reps: 7, rir: 0 }], ranges: [undefined, undefined] })!;
    expect(sg.mode).toBe('reps');
    expect(sg.changed).toBe(false);
    expect(sg.aims).toEqual([9, null]);
  });
  it('uses an inferred range when there is one', () => {
    expect(inferRange([8, 9, 8, 7, 8])).toEqual(R(7, 9));
    expect(inferRange([8, 9])).toBeUndefined();
    const sg = suggest({ ...base, type: 'weight', last: [{ weight: 100, reps: 10, rir: 0 }], ranges: [undefined], inferred: R(7, 9) })!;
    expect(sg.mode).toBe('fit');
    expect(sg.weights[0]).toBeGreaterThan(100);
  });
  it('never suggests weight on bodyweight lifts', () => {
    const sg = suggest({ ...base, type: 'bodyweight', last: [{ weight: 0, reps: 12, rir: 2 }, { weight: 0, reps: 10, rir: 0 }], ranges: [R(8, 12), R(8, 12)] })!;
    expect(sg.weights).toEqual([undefined, undefined]);
    expect(sg.aims).toEqual([13, null]);
  });
  it('moves assisted weights by a step: less assist is up', () => {
    const sg = suggest({ ...base, step: 10, type: 'assisted', last: [{ weight: -40, reps: 12, rir: 0 }, { weight: -40, reps: 10, rir: 0 }], ranges: [R(8, 12), R(8, 12)] })!;
    expect(sg.weights).toEqual([-30, -40]);
    expect(sg.lead).toBe('up');
  });
  it('BW + added: 0 is a valid weight and the first up is +5', () => {
    const sg = suggest({ ...base, type: 'bodyweight_plus', last: [{ weight: 0, reps: 12, rir: 0 }], ranges: [R(8, 12)] })!;
    expect(sg.weights).toEqual([5]);
  });
  it('maintaining keeps topped-out sets at their weight', () => {
    const sg = suggest({ ...base, phase: 'maintain', type: 'weight', last: [{ weight: 185, reps: 8, rir: 1 }, { weight: 185, reps: 4, rir: 0 }], ranges: [R(6, 8), R(6, 8)] })!;
    expect(sg.weights[0]).toBe(185);
    expect(sg.weights[1]).toBeLessThan(185);
    expect(sg.lead).toBe('keep');
  });
  it('writes short reasons', () => {
    const t: [number, number] = [0, 2];
    expect(reasonLine([{ weight: 1, reps: 8 }, { weight: 1, reps: 8 }], [R(6, 8), R(6, 8)], t)).toBe('all 2 sets at the top of 6–8');
    expect(reasonLine([{ weight: 1, reps: 9, rir: 4 }], [R(6, 8)], t)).toBe('set 1 past 8');
  });
});

describe('strength (§13)', () => {
  it('uses set 1 with reps in reserve', () => {
    const sets = workingSets([s('warmup', 95, 10), s('working', 185, 8, { rpe: 9 }), s('working', 185, 6)]);
    expect(sets).toEqual([{ weight: 185, reps: 8, rir: 1 }, { weight: 185, reps: 6, rir: undefined }]);
    expect(sessionStrength(sets, 'weight')).toBeCloseTo(185 * (1 + 9 / 30), 5);
  });
  it('skips sets past 15 reps + RIR', () => {
    expect(sessionStrength([{ weight: 50, reps: 20 }, { weight: 60, reps: 10, rir: 1 }], 'weight')).toBeCloseTo(60 * (1 + 11 / 30), 5);
  });
  it('charts reps for bodyweight and the weight for assisted', () => {
    expect(sessionStrength([{ weight: 0, reps: 12 }], 'bodyweight')).toBe(12);
    expect(sessionStrength([{ weight: -40, reps: 8 }], 'assisted')).toBe(-40);
  });
});

// A series: 2 sessions a week for 8 weeks, value(t) with optional noise.
function series(f: (week: number, i: number) => number, sessions = 16, everyDays = 3.5): StrengthPoint[] {
  const t0 = Date.UTC(2026, 8, 1);
  return Array.from({ length: sessions }, (_, i) => ({ date: t0 + i * everyDays * DAY, value: f((i * everyDays) / 7, i) }));
}
const wiggle = (i: number) => [0.6, -0.4, 0.2, -0.7, 0.5, -0.2, 0.1, -0.5][i % 8];

describe('trend status (§15)', () => {
  it('climbing', () => {
    const pts = series((w, i) => 236.7 + w * 1.55 + wiggle(i));
    expect(trendStatus(pts, 1.2).status).toBe('climbing');
  });
  it('ignores one bad day', () => {
    const pts = series((w, i) => (i === 8 ? 220 : 236.7 + w * 1.55 + wiggle(i)));
    expect(trendStatus(pts, 1.2).status).toBe('climbing');
  });
  it('holding when flat on a lift that usually moves, steady on a slow lift', () => {
    const pts = series((_w, i) => 139 + wiggle(i));
    expect(trendStatus(pts, 0.7).status).toBe('holding');
    expect(trendStatus(pts, 0.2).status).toBe('steady');
  });
  it('slipping needs a real drop, maintained when that is the plan', () => {
    const pts = series((w, i) => 313 - w * 2.6 + wiggle(i), 12, 4.7);
    expect(trendStatus(pts, 1).status).toBe('slipping');
    const mild = series((w, i) => 304 - w * 1.6 + wiggle(i), 14, 4);
    expect(trendStatus(mild, 1, 'maintain').status).toBe('maintained');
  });
  it('not sure with too few sessions', () => {
    const r = trendStatus(series((w) => 350 + w, 4, 14), 2);
    expect(r.status).toBe('notSure');
    expect(r.needs).toBe(2);
  });
  it('leaves comeback sessions out', () => {
    const pts = series((w, i) => 236.7 + w * 1.55 + wiggle(i)).map((p, i) => ({ ...p, comeback: i < 4 }));
    expect(trendStatus(pts, 1.2).n).toBe(12);
  });
  it('needs two evaluations in a row before a new status shows', () => {
    // Flat, then a steady climb: find the first session that reads Climbing on its own.
    const pts = series((_w, i) => (i < 12 ? 139 + wiggle(i) : 139 + (i - 11) * 2.5), 24);
    let k = 7;
    while (k < pts.length && trendStatus(pts.slice(0, k), 0.7).status !== 'climbing') k++;
    expect(trendStatus(pts.slice(0, k - 1), 0.7).status).toBe('holding');
    expect(shownStatus(pts.slice(0, k), 0.7).status).toBe('holding');
    expect(shownStatus(pts.slice(0, k + 1), 0.7).status).toBe('climbing');
  });
});

describe('pace (§14)', () => {
  it('blends the prior with the lift’s own rate', () => {
    expect(priorPace('barbellCompound', 'some')).toBe(1.5);
    const flat = series((_w, i) => 100 + wiggle(i) * 0.1);
    const p = pace(flat, 1.5);
    expect(p).toBeLessThan(1.5);
    expect(p).toBeGreaterThan(0);
  });
});

describe('projection (§18)', () => {
  it('matches the verdict table (now 245, +1.2 lb/wk, τ 78)', () => {
    const target = goalTarget(225, 5);
    expect(target).toBe(262.5);
    expect(project(245, 1.2, 78, 7.5)).toBeCloseTo(253.6, 1);
    expect(verdict(245, 1.2, 78, target, 7.5)).toBe('unlikely');
    expect(verdict(245, 1.2, 78, target, 12)).toBe('stretch');
    expect(verdict(245, 1.2, 78, target, 16)).toBe('stretch');
    expect(verdict(245, 1.2, 78, target, 21)).toBe('likely');
    expect(verdict(245, 1.2, 78, target, 29.5)).toBe('likely');
    expect(verdict(265, 1.2, 78, target, 1)).toBe('ready');
  });
  it('matches the no-date table', () => {
    expect(etaWeeks(245, 1.2, 78, 262.5)).toBeCloseTo(16, 0);
    expect(etaWeeks(185, 4, 39, 275)).toBeCloseTo(34, 0);
    expect(etaWeeks(140, 0.15, 78, 155)).toBeNull();
    expect(etaWeeks(140, 0, 78, 155)).toBeNull();
    expect(etaWeeks(296, -1, 78, 315)).toBeNull();
    expect(etaWeeks(315, 0.3, 156, 405)).toBeNull();
  });
  it('only projects a clear trend', () => {
    const clean = series((w, i) => 236.7 + w * 1.55 + wiggle(i));
    const fit = canProject(clean);
    expect(fit.ok).toBe(true);
    expect(fit.fitRate).toBeCloseTo(1.55, 0);
    expect(currentRate(fit, 1.2)).toBeGreaterThan(0);
    const messy = series((_w, i) => 300 + [12, -15, 9, -18, 20, -10, 14, -16][i % 8], 8, 10);
    expect(canProject(messy).ok).toBe(false);
    expect(canProject(series((w) => 300 + w, 4, 7)).ok).toBe(false);
  });
  it('labels a chosen rate against the lift’s pace', () => {
    expect(rateLabel(0.3, 1)).toBe('slow');
    expect(rateLabel(1, 1)).toBe('typical');
    expect(rateLabel(2, 1)).toBe('focused');
    expect(rateLabel(4, 1)).toBe('rare');
  });
});

describe('goals and milestones', () => {
  const now = Date.UTC(2026, 10, 8);
  const goal = { weight: 225, reps: 5, by: now + 21 * WEEK, startE1rm: 245, startedAt: now - 2 * WEEK, startRate: 1.2, startTau: 78 };
  it('is on track at or above the tick, behind after two weeks below it', () => {
    const t = { E0: 249, r0: 1.2, tau: 78, canProject: true };
    const st = goalState(goal, now, t, { ...t, E0: 246 });
    expect(st.ahead).toBe(true);
    expect(st.behind).toBe(false);
    expect(st.verdict).toBe('likely');
    const low = { E0: 245, r0: 0.3, tau: 78, canProject: true };
    expect(goalState(goal, now, low, { ...low, E0: 244 }).behind).toBe(true);
  });
  it('counts a set as done only at the goal weight and reps', () => {
    expect(meetsGoal({ weight: 225, reps: 5 }, goal)).toBe(true);
    expect(meetsGoal({ weight: 225, reps: 4 }, goal)).toBe(false);
    expect(meetsGoal({ weight: 230, reps: 6 }, goal)).toBe(true);
  });
  it('lowers to what the curve expects', () => {
    expect(likelyWeight({ E0: 245, r0: 1.2, tau: 78, canProject: true }, 5, 7.5, 5)).toBe(215);
  });
  it('lists plate milestones and their states', () => {
    const list = milestoneList('weight', 'barbell', 'lb');
    expect(list[0]).toMatchObject({ weight: 135, reps: 1 });
    const rows = milestoneRows(list, [{ weight: 185, reps: 8, date: 1 }, { weight: 135, reps: 10, date: 0 }], { E0: 245, r0: 1.2, tau: 78, canProject: true });
    expect(rows.filter((r) => r.state === 'done').length).toBe(2);
    expect(rows.find((r) => r.weight === 225 && r.reps === 1)?.state).toBe('ready');
    expect(rows.length).toBe(5);
    // Several ready at once: only the highest stays.
    const ready = milestoneRows(list, [{ weight: 135, reps: 10, date: 0 }], { E0: 245, r0: 1.2, tau: 78, canProject: true }).filter((r) => r.state === 'ready');
    expect(ready.map((r) => `${r.weight}x${r.reps}`)).toEqual(['225x1']);
    expect(milestoneList('bodyweight', 'bodyweight', 'lb')[0]).toEqual({ reps: 5, target: 5 });
    expect(milestoneList('assisted', 'machine', 'lb', -40).map((m) => m.weight)).toEqual([-20, 0]);
  });
  it('finds the goal a milestone already is', () => {
    const goals = [
      { id: 'old', weight: 225, reps: 1, doneAt: 5 },
      { id: 'open', weight: 225.0006, reps: 1 },
      { id: 'gone', weight: 315, reps: 1, deletedAt: 9 },
      { id: 'bw', weight: 0, reps: 15 },
    ];
    expect(goalForMilestone({ weight: 225, reps: 1 }, goals)?.id).toBe('open');
    expect(goalForMilestone({ weight: 225, reps: 1 }, goals.slice(0, 1))?.id).toBe('old');
    expect(goalForMilestone({ weight: 225, reps: 5 }, goals)).toBeUndefined();
    expect(goalForMilestone({ weight: 315, reps: 1 }, goals)).toBeUndefined();
    expect(goalForMilestone({ reps: 15 }, goals)?.id).toBe('bw');
  });
});

describe('tips (§23)', () => {
  const o = { effortOn: true, target: [0, 2] as [number, number], dismissed: [] as string[], now: Date.UTC(2026, 10, 8) };
  it('asks for effort when most sets are unrated', () => {
    const sets = [{ weight: 100, reps: 8 }, { weight: 100, reps: 8 }, { weight: 100, reps: 8 }, { weight: 100, reps: 7, rir: 1 }];
    expect(tipFor([{ date: o.now - DAY, sets }], o)).toBe('logEffort');
    expect(tipFor([{ date: o.now - DAY, sets }], { ...o, dismissed: ['logEffort'] })).toBeNull();
  });
  it('set 1 first when set 1 keeps reading weaker than set 2', () => {
    const weak = { date: o.now, sets: [{ weight: 100, reps: 5, rir: 0 }, { weight: 100, reps: 7, rir: 0 }] };
    expect(tipFor([weak, weak, weak], o)).toBe('set1');
  });
});

describe('month in review', () => {
  it('counts records and compares each lift with the month before', () => {
    const d = (m: number, day: number) => Date.UTC(2026, m, day);
    const r = monthReview(
      [d(8, 3), d(9, 2), d(9, 9)],
      [
        {
          exerciseId: 'dl',
          sessions: [
            { date: d(8, 3), sets: [{ weight: 345, reps: 5, rir: 0 }] },
            { date: d(9, 9), sets: [{ weight: 365, reps: 5, rir: 0 }] },
          ],
        },
      ],
      d(8, 1),
      d(9, 1),
      d(10, 1),
    );
    expect(r.workouts).toBe(2);
    expect(r.records).toBe(1);
    expect(r.liftsUp).toBe(1);
    expect(r.best).toMatchObject({ weight: 365, reps: 5, firstTime: true });
  });
});

describe('whatChanged (D3)', () => {
  it('compares the two 4-week halves and finds the longest gap', () => {
    const now = Date.UTC(2026, 10, 1);
    const at = (daysAgo: number, sets: number) => ({ date: now - daysAgo * DAY, sets });
    // Twice a week with 4 sets, then once a week with 3 and a 12-day hole.
    const sessions = [at(55, 4), at(52, 4), at(48, 4), at(45, 4), at(41, 4), at(38, 4), at(34, 4), at(31, 4), at(26, 3), at(14, 3), at(7, 3), at(0, 3)];
    const w = whatChanged(sessions, now);
    expect(w.perWeek).toEqual([2, 1]);
    expect(w.setsPer).toEqual([4, 3]);
    expect(w.longestGap?.days).toBe(12);
  });
});

describe('Home Lately (D6)', () => {
  const c = (key: string, kind: LatelyCandidate['kind'], weight = 0): LatelyCandidate => ({ key, kind, weight });
  it('keeps one goal line and one trend line, by priority', () => {
    const lines = pickLately([c('s1', 'status', 2), c('s2', 'status', 5), c('gb', 'goalBehind'), c('gd', 'goalDone')], [], '2026-11-08');
    expect(lines.map((l) => l.key)).toEqual(['gd', 's2']);
  });
  it('shows a line on the day it first appeared, then never again', () => {
    const seen = markSeen([], [c('s1', 'status')], '2026-11-08');
    expect(pickLately([c('s1', 'status')], seen, '2026-11-08')).toHaveLength(1);
    expect(pickLately([c('s1', 'status')], seen, '2026-11-09')).toHaveLength(0);
    expect(markSeen(seen, [c('s1', 'status')], '2026-11-09')).toBe(seen);
  });
  it('is empty when nothing changed', () => {
    expect(pickLately([], [], '2026-11-08')).toEqual([]);
  });
});
