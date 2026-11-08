import { describe, expect, it } from 'vitest';
import { MI_M } from './cardio';
import { availableCardioRanges, distanceRecords, machineTotals, summarizeRange, weeklyBins, type CardioSession } from './cardioStats';
import { addDays, startOfWeek } from './dates';

const NOW = new Date(2026, 10, 5, 18).getTime(); // Thu Nov 5 2026
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 18).getTime();
const s = (date: number, exerciseId: string, sets: CardioSession['sets'], workoutId = `w${date}`): CardioSession => ({ workoutId, exerciseId, date, sets });

describe('weeklyBins', () => {
  it('bins minutes, distance and sessions per week up to this week', () => {
    const from = addDays(startOfWeek(NOW, 0), -7);
    const bins = weeklyBins([s(day(2026, 10, 27), 'tm', [{ durationSec: 1200, distance: 2000 }]), s(NOW, 'tm', [{ durationSec: 600 }])], from, 0, NOW);
    expect(bins).toHaveLength(2);
    expect(bins[0]).toMatchObject({ minutes: 20, distance: 2000, sessions: 1 });
    expect(bins[1]).toMatchObject({ minutes: 10, sessions: 1 });
  });
});

describe('availableCardioRanges', () => {
  it('hides ranges there is no history for', () => {
    expect(availableCardioRanges(undefined, 0, NOW)).toEqual(['4W', 'All']);
    expect(availableCardioRanges(day(2026, 10, 20), 0, NOW)).toEqual(['4W', 'All']);
    expect(availableCardioRanges(day(2026, 9, 1), 0, NOW)).toEqual(['4W', '3M', 'All']);
    expect(availableCardioRanges(day(2025, 1, 1), 0, NOW)).toEqual(['4W', '3M', '6M', '1Y', 'All']);
  });
});

describe('summarizeRange', () => {
  it('averages finished weeks and compares with the stretch before', () => {
    const sessions: CardioSession[] = [];
    // 8 weeks back: 30 min a week; last 4 weeks: 60 min a week.
    for (let w = 1; w <= 8; w++) sessions.push(s(addDays(startOfWeek(NOW, 0), -7 * w + 2), 'tm', [{ durationSec: (w <= 3 ? 60 : 30) * 60 }]));
    const r = summarizeRange(sessions, '4W', 'minutes', 'lb', 0, NOW);
    expect(r.values).toHaveLength(4);
    expect(r.avg).toBeCloseTo(60);
    expect(r.prevAvg).toBeCloseTo(30);
    expect(r.change).toBeCloseTo(30);
  });

  it('no line vs before when nothing came before', () => {
    const r = summarizeRange([s(NOW, 'tm', [{ durationSec: 600 }])], '4W', 'minutes', 'lb', 0, NOW);
    expect(r.change).toBeUndefined();
  });
});

describe('machineTotals', () => {
  it('totals per machine, most time first', () => {
    const t = machineTotals(
      [s(day(2026, 11, 1), 'bike', [{ durationSec: 600, distance: 4000 }]), s(day(2026, 11, 2), 'tm', [{ durationSec: 1200 }]), s(day(2026, 11, 3), 'bike', [{ durationSec: 900 }])],
      undefined,
    );
    expect(t.map((x) => x.exerciseId)).toEqual(['bike', 'tm']);
    expect(t[0]).toMatchObject({ sessions: 2, durationSec: 1500, distance: 4000 });
    expect(t[1].distance).toBeUndefined();
  });
});

describe('distanceRecords', () => {
  it('scales one segment to each distance it covered and keeps the fastest', () => {
    const { records, longest } = distanceRecords([
      s(day(2026, 9, 28), 'run', [{ durationSec: 1550, distance: 5100 }]),
      s(day(2026, 10, 12), 'run', [{ durationSec: 462, distance: MI_M }]),
    ]);
    const by = Object.fromEntries(records.map((r) => [r.id, r.best]));
    expect(by.mile!.timeSec).toBeCloseTo(462);
    expect(by['5k']!.timeSec).toBeCloseTo((1550 * 5000) / 5100);
    expect(by['10k']).toBeUndefined();
    expect(longest!.meters).toBe(5100);
  });

  it('ignores segments without time or distance', () => {
    expect(distanceRecords([s(NOW, 'run', [{ distance: 6000 }, { durationSec: 600 }])]).records.every((r) => !r.best)).toBe(true);
  });
});
