import { describe, expect, it } from 'vitest';
import {
  cardioColumns,
  cardioFields,
  cardioSummary,
  cardioTotals,
  columnHeader,
  columnText,
  columnsLabel,
  formatDuration,
  formatField,
  formatHours,
  MI_M,
  parseDurationText,
  parseFieldText,
  avgSpeed,
  segmentPlaceholders,
  split500,
  totalText,
} from './cardio';
import { isEmptySet } from './sets';

const treadmill = { cardioColumns: ['distance', 'speed'] as const };
const rower = { cardioColumns: ['distance', 'split500'] as const, distanceUnit: 'm' as const };
const bike = { cardioColumns: ['distance', 'level'] as const };
const mph = (v: number) => (v * MI_M) / 1000;

describe('columns', () => {
  it('keeps at most two known columns, in order', () => {
    expect(cardioColumns({ cardioColumns: ['speed', 'distance', 'level'] })).toEqual(['speed', 'distance']);
    expect(cardioColumns({ cardioColumns: ['level', 'level'] })).toEqual(['level']);
    expect(cardioColumns({})).toEqual([]);
  });

  it('drops a worked-out column without distance', () => {
    expect(cardioColumns({ cardioColumns: ['split500', 'level'] })).toEqual(['level']);
    expect(cardioColumns({ cardioColumns: ['distance', 'split500'] })).toEqual(['distance', 'split500']);
  });

  it('types into time first, never into a worked-out column', () => {
    expect(cardioFields({ ...rower, cardioColumns: [...rower.cardioColumns] })).toEqual(['time', 'distance']);
    expect(cardioFields({ cardioColumns: [...treadmill.cardioColumns] })).toEqual(['time', 'distance', 'speed']);
  });

  it('labels follow the units setting, or meters', () => {
    expect(columnHeader('distance', {}, 'lb')).toBe('MI');
    expect(columnHeader('distance', {}, 'kg')).toBe('KM');
    expect(columnHeader('distance', { distanceUnit: 'm' }, 'lb')).toBe('METERS');
    expect(columnHeader('speed', {}, 'lb')).toBe('MPH');
    expect(columnsLabel({ cardioColumns: ['distance', 'speed'] }, 'lb')).toBe('time · mi · mph');
    expect(columnsLabel({ cardioColumns: ['distance', 'split500'], distanceUnit: 'm' }, 'lb')).toBe('time · meters · /500m');
  });
});

describe('time', () => {
  it('formats m:ss and h:mm:ss', () => {
    expect(formatDuration(300)).toBe('5:00');
    expect(formatDuration(1500)).toBe('25:00');
    expect(formatDuration(3900)).toBe('1:05:00');
    expect(formatHours(18600)).toBe('5 h 10 m');
    expect(formatHours(2700)).toBe('45 m');
  });

  it('reads plain numbers as minutes, m:ss and h:mm:ss', () => {
    expect(parseDurationText('25')).toBe(1500);
    expect(parseDurationText('120')).toBe(7200);
    expect(parseDurationText('2158')).toBe(21 * 60 + 58);
    expect(parseDurationText('10500')).toBe(3900);
    expect(parseDurationText('5:30')).toBe(330);
    expect(parseDurationText('5:3')).toBe(303);
    expect(parseDurationText('5:')).toBe(300);
    expect(parseDurationText('1:05:00')).toBe(3900);
    expect(parseDurationText('')).toBeUndefined();
    expect(parseDurationText('0')).toBeUndefined();
  });
});

describe('values', () => {
  it('stores meters and km/h, shows mi and mph', () => {
    const d = parseFieldText('distance', '1.7', treadmill, 'lb')!;
    expect(d).toBeCloseTo(1.7 * MI_M);
    expect(formatField('distance', d, treadmill, 'lb')).toBe('1.7');
    expect(formatField('distance', d, treadmill, 'kg')).toBe('2.74');
    const s = parseFieldText('speed', '3.5', treadmill, 'lb')!;
    expect(formatField('speed', s, treadmill, 'lb')).toBe('3.5');
    expect(formatField('distance', 1495, rower, 'lb')).toBe('1,495');
  });

  it('works out split per 500 m', () => {
    expect(split500(120, 520)).toBeCloseTo(115.38, 1);
    expect(columnText('split500', { durationSec: 120, distance: 520 }, rower, 'lb')).toBe('1:55');
    expect(columnText('split500', { durationSec: 120 }, rower, 'lb')).toBe('');
  });
});

describe('worked-out speed (treadmill)', () => {
  const tm = { cardioColumns: ['distance', 'avgSpeed'] as const };
  const cols = { cardioColumns: [...tm.cardioColumns] };

  it('types time and distance only; speed is distance over time', () => {
    expect(cardioFields(cols)).toEqual(['time', 'distance']);
    expect(cardioColumns({ cardioColumns: ['avgSpeed', 'level'] })).toEqual(['level']);
    expect(avgSpeed(1500, 2 * MI_M)).toBeCloseTo(mph(4.8));
    expect(avgSpeed(1500)).toBeUndefined();
    expect(columnText('avgSpeed', { durationSec: 1500, distance: 2 * MI_M }, cols, 'lb')).toBe('4.8');
    expect(columnText('avgSpeed', { durationSec: 1500 }, cols, 'lb')).toBe('');
  });

  it('labels as mph / km/h', () => {
    expect(columnHeader('avgSpeed', cols, 'lb')).toBe('MPH');
    expect(columnHeader('avgSpeed', cols, 'kg')).toBe('KM/H');
    expect(columnsLabel(cols, 'lb')).toBe('time · mi · mph');
  });

  it('Σ: total distance over the time that covered it', () => {
    const t = cardioTotals([
      { durationSec: 300, distance: 0.3 * MI_M },
      { durationSec: 900, distance: 1.4 * MI_M },
    ]);
    expect(totalText('avgSpeed', t, cols, 'lb')).toBe('avg 5.1');
    expect(totalText('avgSpeed', cardioTotals([{ durationSec: 300 }]), cols, 'lb')).toBe('—');
  });
});

describe('totals (Σ)', () => {
  const segs = [
    { durationSec: 300, distance: 0.3 * MI_M, speed: mph(3.5) },
    { durationSec: 900, distance: 1.4 * MI_M, speed: mph(5.6) },
  ];

  it('adds time and distance, averages speed as distance over time', () => {
    const t = cardioTotals(segs);
    expect(t.durationSec).toBe(1200);
    expect(totalText('time', t, treadmill, 'lb')).toBe('20:00');
    expect(totalText('distance', t, treadmill, 'lb')).toBe('1.7');
    expect(totalText('speed', t, treadmill, 'lb')).toBe('avg 5.1');
    expect(totalText('speed', t, treadmill, 'lb', false)).toBe('5.1');
  });

  it('rower Σ: split from the totals', () => {
    const t = cardioTotals([
      { durationSec: 120, distance: 520 },
      { durationSec: 120, distance: 510 },
      { durationSec: 120, distance: 500 },
    ]);
    expect(totalText('distance', t, rower, 'lb')).toBe('1,530');
    expect(totalText('split500', t, rower, 'lb')).toBe('1:58');
  });
});

describe('summary line', () => {
  it('total time and distance', () => {
    expect(cardioSummary([{ durationSec: 1500, distance: 2 * MI_M }], treadmill, 'lb')).toBe('25:00 · 2.0 mi');
  });
  it('equal pieces read as n × time', () => {
    expect(cardioSummary([{ durationSec: 120, distance: 500 }, { durationSec: 120, distance: 495 }, { durationSec: 120, distance: 500 }], rower, 'lb')).toBe(
      '3 × 2:00 · 1,495 m',
    );
  });
  it('bike adds the level', () => {
    expect(cardioSummary([{ durationSec: 1920, distance: 8.8 * MI_M, level: 7 }], bike, 'lb')).toBe('32:00 · 8.8 mi · L7');
  });
  it('nothing logged → empty', () => {
    expect(cardioSummary([{}], treadmill, 'lb')).toBe('');
  });
});

describe('grey placeholders', () => {
  it('line segments up by position and only fill empty fields', () => {
    const cur = [
      { id: 'a', durationSec: 360 },
      { id: 'b' },
      { id: 'c' },
    ];
    const prev = [{ durationSec: 300, distance: 500 }, { durationSec: 900, distance: 2000 }];
    const m = segmentPlaceholders(cur, prev);
    expect(m.get('a')).toEqual({ distance: 500 });
    expect(m.get('b')).toEqual({ durationSec: 900, distance: 2000 });
    expect(m.has('c')).toBe(false);
  });
});

describe('isEmptySet', () => {
  it('a segment with time is not empty; a lift needs reps', () => {
    expect(isEmptySet({ durationSec: 60 })).toBe(false);
    expect(isEmptySet({})).toBe(true);
    expect(isEmptySet({ reps: 8 })).toBe(false);
    expect(isEmptySet({ reps: 0 })).toBe(true);
  });
});

describe('stair climber steps', () => {
  const stairs = { cardioColumns: ['steps'] as const };
  it('is a typed box with a STEPS header', () => {
    expect(cardioFields(stairs)).toEqual(['time', 'steps']);
    expect(columnHeader('steps', stairs, 'lb')).toBe('STEPS');
    expect(columnsLabel(stairs, 'lb')).toBe('time · steps');
  });
  it('stores whole steps and shows thousands commas', () => {
    const v = parseFieldText('steps', '1450', stairs, 'kg')!;
    expect(v).toBe(1450);
    expect(formatField('steps', v, stairs, 'kg')).toBe('1,450');
  });
  it('adds up in Σ and the summary line', () => {
    const t = cardioTotals([
      { durationSec: 600, steps: 700 },
      { durationSec: 600, steps: 750 },
    ]);
    expect(totalText('steps', t, stairs, 'lb')).toBe('1,450');
    expect(cardioSummary([{ durationSec: 1200, steps: 1450 }], stairs, 'lb')).toBe('20:00 · 1,450 steps');
  });
  it('a segment with only steps is not empty', () => {
    expect(isEmptySet({ steps: 300 })).toBe(false);
  });
});
