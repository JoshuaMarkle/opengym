import type { CardioColumn, DistanceUnit, Units } from '../db/types';
import { formatNumber } from './units';

/**
 * Cardio (SPEC §10, C1–C6). A cardio exercise logs "segments": TIME plus up to two
 * columns. Values are stored in SI (seconds, meters, km/h) and converted at display,
 * the same way weights are stored in lb. Split /500m, pace and average speed are
 * worked out from time and distance, never typed.
 */

export const MI_M = 1609.344;
export const KM_M = 1000;

/** A typed (or stored) cardio value. */
export type CardioField = 'time' | 'distance' | 'speed' | 'incline' | 'level' | 'calories' | 'steps';

export interface CardioValues {
  durationSec?: number;
  distance?: number;
  speed?: number;
  incline?: number;
  level?: number;
  calories?: number;
  /** stair climber steps */
  steps?: number;
}

/** What a cardio exercise needs to know about itself. Exercise satisfies it. */
export interface CardioSpec {
  cardioColumns?: readonly CardioColumn[];
  distanceUnit?: DistanceUnit;
}

/** Every stored cardio value on a set, in row order. */
export const CARDIO_VALUE_KEYS = ['durationSec', 'distance', 'speed', 'incline', 'level', 'calories', 'steps'] as const;

export type DistanceDisplay = 'mi' | 'km' | 'm';

export const MAX_CARDIO_COLUMNS = 2;
export const COMPUTED_COLUMNS: CardioColumn[] = ['split500', 'pace', 'avgSpeed'];
export const isComputed = (c: CardioColumn) => COMPUTED_COLUMNS.includes(c);

/** The setup list (C5), in order. */
export const CARDIO_COLUMN_INFO: { id: CardioColumn; label: string }[] = [
  { id: 'distance', label: 'Distance' },
  { id: 'speed', label: 'Speed' },
  { id: 'incline', label: 'Incline' },
  { id: 'level', label: 'Level' },
  { id: 'calories', label: 'Calories' },
  { id: 'steps', label: 'Steps' },
  { id: 'split500', label: 'Split /500m' },
  { id: 'pace', label: 'Pace' },
  { id: 'avgSpeed', label: 'Avg speed' },
];

const FIELD_OF: Record<CardioColumn, CardioField | undefined> = {
  distance: 'distance',
  speed: 'speed',
  incline: 'incline',
  level: 'level',
  calories: 'calories',
  steps: 'steps',
  split500: undefined,
  pace: undefined,
  avgSpeed: undefined,
};

/**
 * The exercise's columns after TIME: known ids only, no repeats, at most two,
 * and a worked-out column only alongside distance.
 */
export function cardioColumns(ex: CardioSpec): CardioColumn[] {
  const out: CardioColumn[] = [];
  for (const c of ex.cardioColumns ?? []) {
    if (!(c in FIELD_OF) || out.includes(c)) continue;
    out.push(c);
    if (out.length === MAX_CARDIO_COLUMNS) break;
  }
  if (!out.includes('distance')) return out.filter((c) => !isComputed(c));
  return out;
}

/** The boxes you type into, in row order: time first. */
export function cardioFields(ex: CardioSpec): CardioField[] {
  return ['time', ...cardioColumns(ex).map((c) => FIELD_OF[c]).filter((f): f is CardioField => !!f)];
}

export function distanceDisplay(ex: CardioSpec, units: Units): DistanceDisplay {
  if (ex.distanceUnit === 'm') return 'm';
  return units === 'kg' ? 'km' : 'mi';
}

/** "mi", "km", "m": the unit word after a distance. */
export const distanceWord = (d: DistanceDisplay) => d;
export const speedWord = (units: Units) => (units === 'kg' ? 'km/h' : 'mph');

/** Column header in the set table: TIME · MI · MPH · /500M. */
export function columnHeader(col: CardioColumn | 'time', ex: CardioSpec, units: Units): string {
  switch (col) {
    case 'time':
      return 'TIME';
    case 'distance': {
      const d = distanceDisplay(ex, units);
      return d === 'm' ? 'METERS' : d.toUpperCase();
    }
    case 'speed':
      return speedWord(units).toUpperCase();
    case 'incline':
      return 'INCL %';
    case 'level':
      return 'LEVEL';
    case 'calories':
      return 'CAL';
    case 'steps':
      return 'STEPS';
    case 'split500':
      return '/500M';
    case 'pace':
      return `/${distanceDisplay(ex, units) === 'km' ? 'KM' : 'MI'}`;
    case 'avgSpeed':
      return speedWord(units).toUpperCase();
  }
}

/** Keypad field tab label: time · mi · mph · level. */
export function fieldTab(field: CardioField, ex: CardioSpec, units: Units): string {
  switch (field) {
    case 'time':
      return 'time';
    case 'distance': {
      const d = distanceDisplay(ex, units);
      return d === 'm' ? 'meters' : d;
    }
    case 'speed':
      return speedWord(units);
    case 'incline':
      return 'incline';
    case 'level':
      return 'level';
    case 'calories':
      return 'cal';
    case 'steps':
      return 'steps';
  }
}

export const FIELD_NAME: Record<CardioField, string> = {
  time: 'Time',
  distance: 'Distance',
  speed: 'Speed',
  incline: 'Incline',
  level: 'Level',
  calories: 'Calories',
  steps: 'Steps',
};

/** Unit hint next to a column in the setup list (C5). */
export function columnUnitHint(col: CardioColumn, ex: CardioSpec, units: Units): string {
  switch (col) {
    case 'distance':
      return distanceDisplay(ex, units);
    case 'speed':
      return speedWord(units);
    case 'incline':
      return '%';
    case 'split500':
    case 'pace':
    case 'avgSpeed':
      return 'auto';
    default:
      return '';
  }
}

// ───────────────────────────── time

/** 1500 → "25:00", 3900 → "1:05:00". */
export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

/** Totals in prose: "5 h 10 m", "45 m", "40 s". */
export function formatHours(sec: number): string {
  const m = Math.round(sec / 60);
  if (m < 1) return sec > 0 ? `${Math.round(sec)} s` : '0 m';
  const h = Math.floor(m / 60);
  return h ? `${h} h ${m % 60} m` : `${m} m`;
}

/**
 * Typed time → seconds. Up to three digits is minutes (what a treadmill shows:
 * "25"); four or more read like a clock with the colons left out ("2158" =
 * 21:58, "10500" = 1:05:00). "5:30" is m:ss, "1:05:00" is h:mm:ss. Empty → undefined.
 */
export function parseDurationText(text: string): number | undefined {
  const t = text.trim();
  if (!t) return undefined;
  if (!/^[\d:]+$/.test(t)) return undefined;
  if (!t.includes(':') && t.length >= 4) {
    const d = t.slice(-6).padStart(6, '0');
    const sec = Number(d.slice(0, 2)) * 3600 + Number(d.slice(2, 4)) * 60 + Number(d.slice(4));
    return sec > 0 ? sec : undefined;
  }
  const parts = t.split(':');
  if (parts.length > 3) return undefined;
  const nums = parts.map((p) => (p === '' ? 0 : Number(p)));
  if (nums.some((n) => !Number.isFinite(n))) return undefined;
  let sec: number;
  if (nums.length === 1) sec = nums[0] * 60;
  else if (nums.length === 2) sec = nums[0] * 60 + nums[1];
  else sec = nums[0] * 3600 + nums[1] * 60 + nums[2];
  return sec > 0 ? sec : undefined;
}

// ───────────────────────────── values

export function fieldValue(v: CardioValues, field: CardioField): number | undefined {
  return field === 'time' ? v.durationSec : v[field];
}

export function fieldPatch(field: CardioField, value: number | undefined): CardioValues {
  return field === 'time' ? { durationSec: value } : { [field]: value };
}

/** Stored (SI) → the number shown in the box. */
export function toDisplayValue(field: CardioField, stored: number, ex: CardioSpec, units: Units): number {
  switch (field) {
    case 'distance': {
      const d = distanceDisplay(ex, units);
      return d === 'm' ? stored : stored / (d === 'km' ? KM_M : MI_M);
    }
    case 'speed':
      return units === 'kg' ? stored : stored / (MI_M / 1000);
    default:
      return stored;
  }
}

/** Number typed in the box → stored (SI). */
export function fromDisplayValue(field: CardioField, value: number, ex: CardioSpec, units: Units): number {
  switch (field) {
    case 'distance': {
      const d = distanceDisplay(ex, units);
      return d === 'm' ? value : value * (d === 'km' ? KM_M : MI_M);
    }
    case 'speed':
      return units === 'kg' ? value : value * (MI_M / 1000);
    default:
      return value;
  }
}

const withCommas = (n: number) => Math.round(n).toLocaleString('en-US');

/** A box's text: "25:00", "1.7", "1,495", "5.6", "8". */
export function formatField(field: CardioField, stored: number | undefined, ex: CardioSpec, units: Units): string {
  if (stored == null) return '';
  if (field === 'time') return formatDuration(stored);
  const v = toDisplayValue(field, stored, ex, units);
  switch (field) {
    case 'distance':
      return distanceDisplay(ex, units) === 'm' ? withCommas(v) : formatNumber(v, 2);
    case 'speed':
    case 'incline':
      return formatNumber(v, 1);
    case 'level':
      return formatNumber(v, 1);
    case 'calories':
    case 'steps':
      return withCommas(v);
  }
}

/** Text put in the keypad when a box is opened (no thousands commas). */
export function editTextOf(field: CardioField, stored: number | undefined, ex: CardioSpec, units: Units): string {
  return formatField(field, stored, ex, units).replace(/,/g, '');
}

/** Keypad text → stored value. */
export function parseFieldText(field: CardioField, text: string, ex: CardioSpec, units: Units): number | undefined {
  if (field === 'time') return parseDurationText(text);
  if (!text || text === '.') return undefined;
  const n = Number(text);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return fromDisplayValue(field, n, ex, units);
}

export type CardioKeypadMode = 'time' | 'decimal' | 'int';

/** How the keypad behaves for a box: which keys, and what ± steps by (display units). */
export function keypadFor(field: CardioField, ex: CardioSpec, units: Units): { mode: CardioKeypadMode; step: number; stepLabel: string } {
  switch (field) {
    case 'time':
      return { mode: 'time', step: 60, stepLabel: '1 min' };
    case 'distance':
      return distanceDisplay(ex, units) === 'm' ? { mode: 'int', step: 50, stepLabel: '50 m' } : { mode: 'decimal', step: 0.1, stepLabel: `0.1 ${distanceDisplay(ex, units)}` };
    case 'speed':
      return { mode: 'decimal', step: 0.1, stepLabel: '0.1' };
    case 'incline':
      return { mode: 'decimal', step: 0.5, stepLabel: '0.5 %' };
    case 'level':
      return { mode: 'int', step: 1, stepLabel: '1' };
    case 'calories':
      return { mode: 'int', step: 10, stepLabel: '10 cal' };
    case 'steps':
      return { mode: 'int', step: 10, stepLabel: '10' };
  }
}

// ───────────────────────────── worked-out columns

/** Seconds per 500 m (rowers). */
export function split500(durationSec?: number, meters?: number): number | undefined {
  if (!durationSec || !meters || meters <= 0) return undefined;
  return (durationSec * 500) / meters;
}

/** Seconds per mile or km. */
export function pace(durationSec: number | undefined, meters: number | undefined, d: DistanceDisplay): number | undefined {
  if (!durationSec || !meters || meters <= 0) return undefined;
  return (durationSec * (d === 'km' || d === 'm' ? KM_M : MI_M)) / meters;
}

/** km/h from time and distance (treadmills). */
export function avgSpeed(durationSec?: number, meters?: number): number | undefined {
  if (!durationSec || !meters || meters <= 0) return undefined;
  return meters / 1000 / (durationSec / 3600);
}

/** Text for any column of a segment (computed ones included). */
export function columnText(col: CardioColumn | 'time', v: CardioValues, ex: CardioSpec, units: Units): string {
  if (col === 'time') return formatField('time', v.durationSec, ex, units);
  if (col === 'split500') {
    const s = split500(v.durationSec, v.distance);
    return s === undefined ? '' : formatDuration(s);
  }
  if (col === 'pace') {
    const p = pace(v.durationSec, v.distance, distanceDisplay(ex, units));
    return p === undefined ? '' : formatDuration(p);
  }
  if (col === 'avgSpeed') return formatField('speed', avgSpeed(v.durationSec, v.distance), ex, units);
  const f = FIELD_OF[col]!;
  return formatField(f, fieldValue(v, f), ex, units);
}

// ───────────────────────────── totals (Σ)

export interface CardioTotals {
  segments: number;
  durationSec: number;
  /** meters, when any segment has a distance */
  distance?: number;
  calories?: number;
  steps?: number;
  /** km/h: distance ÷ time when both exist, else the time-weighted average */
  speed?: number;
  incline?: number;
  level?: number;
}

function timeWeighted(sets: CardioValues[], key: 'speed' | 'incline' | 'level'): number | undefined {
  const withV = sets.filter((s) => s[key] != null);
  if (!withV.length) return undefined;
  const weight = withV.reduce((n, s) => n + (s.durationSec ?? 0), 0);
  if (weight > 0) return withV.reduce((n, s) => n + s[key]! * (s.durationSec ?? 0), 0) / weight;
  return withV.reduce((n, s) => n + s[key]!, 0) / withV.length;
}

export function cardioTotals(sets: CardioValues[]): CardioTotals {
  const durationSec = sets.reduce((n, s) => n + (s.durationSec ?? 0), 0);
  const withDist = sets.filter((s) => s.distance != null);
  const distance = withDist.length ? withDist.reduce((n, s) => n + s.distance!, 0) : undefined;
  const withCal = sets.filter((s) => s.calories != null);
  const calories = withCal.length ? withCal.reduce((n, s) => n + s.calories!, 0) : undefined;
  const withSteps = sets.filter((s) => s.steps != null);
  const steps = withSteps.length ? withSteps.reduce((n, s) => n + s.steps!, 0) : undefined;
  const distTime = withDist.reduce((n, s) => n + (s.durationSec ?? 0), 0);
  const speed = distance && distTime > 0 && withDist.every((s) => s.durationSec) ? distance / 1000 / (distTime / 3600) : timeWeighted(sets, 'speed');
  return {
    segments: sets.length,
    durationSec,
    distance,
    calories,
    steps,
    speed,
    incline: timeWeighted(sets, 'incline'),
    level: timeWeighted(sets, 'level'),
  };
}

/** Σ row cell for a column: totals for time / distance / calories, averages for the rest. */
export function totalText(col: CardioColumn | 'time', t: CardioTotals, ex: CardioSpec, units: Units, avgWord = true): string {
  const avg = (s: string) => (s && avgWord ? `avg ${s}` : s);
  switch (col) {
    case 'time':
      return t.durationSec ? formatDuration(t.durationSec) : '—';
    case 'distance':
      return t.distance != null ? formatField('distance', t.distance, ex, units) : '—';
    case 'calories':
      return t.calories != null ? formatField('calories', t.calories, ex, units) : '—';
    case 'steps':
      return t.steps != null ? formatField('steps', t.steps, ex, units) : '—';
    case 'speed':
      return t.speed != null ? avg(formatField('speed', t.speed, ex, units)) : '—';
    case 'incline':
      return t.incline != null ? avg(formatField('incline', t.incline, ex, units)) : '—';
    case 'level':
      return t.level != null ? avg(formatNumber(Math.round(t.level * 10) / 10, 1)) : '—';
    case 'avgSpeed':
      // Distance ÷ the time of the segments that have a distance.
      return t.distance != null && t.speed != null ? avg(formatField('speed', t.speed, ex, units)) : '—';
    case 'split500':
    case 'pace':
      return columnText(col, { durationSec: t.durationSec, distance: t.distance }, ex, units) || '—';
  }
}

// ───────────────────────────── prose

/** "2.0 mi", "1,495 m", "9.4 km": distance with a fixed decimal, for summaries. */
export function distanceText(meters: number, d: DistanceDisplay): string {
  if (d === 'm') return `${withCommas(meters)} m`;
  return `${(meters / (d === 'km' ? KM_M : MI_M)).toFixed(1)} ${d}`;
}

/** Total distance across machines, in mi or km by the units setting. */
export function longDistance(meters: number, units: Units): number {
  return meters / (units === 'kg' ? KM_M : MI_M);
}
export const longDistanceWord = (units: Units) => (units === 'kg' ? 'km' : 'mi');

/**
 * One line for a cardio session (C1 "Last:", D1, D3): "25:00 · 2.0 mi",
 * "3 × 2:00 · 1,495 m", "32:00 · 8.8 mi · L7". Empty when nothing was logged.
 */
export function cardioSummary(sets: CardioValues[], ex: CardioSpec, units: Units): string {
  const logged = sets.filter((s) => s.durationSec || s.distance || s.calories || s.steps);
  if (!logged.length) return '';
  const t = cardioTotals(logged);
  const parts: string[] = [];
  const durs = logged.map((s) => s.durationSec ?? 0);
  if (logged.length > 1 && durs[0] > 0 && durs.every((d) => d === durs[0])) parts.push(`${logged.length} × ${formatDuration(durs[0])}`);
  else if (t.durationSec) parts.push(formatDuration(t.durationSec));
  if (t.distance != null) parts.push(distanceText(t.distance, distanceDisplay(ex, units)));
  const cols = cardioColumns(ex);
  if (cols.includes('level') && t.level != null) parts.push(`L${Math.round(t.level)}`);
  if (cols.includes('steps') && t.steps != null) parts.push(`${withCommas(t.steps)} steps`);
  if (cols.includes('calories') && t.calories != null && t.distance == null) parts.push(`${withCommas(t.calories)} cal`);
  return parts.join(' · ');
}

/** "time · mi · mph": the column list shown under a preset in the picker (C6). */
export function columnsLabel(ex: CardioSpec, units: Units): string {
  return ['time', ...cardioColumns(ex)]
    .map((c) => {
      if (c === 'time') return 'time';
      if (c === 'distance') return distanceDisplay(ex, units) === 'm' ? 'meters' : distanceDisplay(ex, units);
      if (c === 'speed') return speedWord(units);
      if (c === 'split500') return '/500m';
      if (c === 'pace') return 'pace';
      if (c === 'avgSpeed') return speedWord(units);
      if (c === 'calories') return 'cal';
      return c;
    })
    .join(' · ');
}

// ───────────────────────────── grey placeholders

/**
 * C1: empty boxes show last time's numbers in grey and ✓ accepts them. Segments
 * line up by position (segment 2 ↔ last session's segment 2). Only empty fields
 * get a value, so typed numbers always win.
 */
export function segmentPlaceholders<T extends CardioValues & { id: string }>(
  current: T[],
  previous: CardioValues[] | undefined,
): Map<string, CardioValues> {
  const out = new Map<string, CardioValues>();
  if (!previous?.length) return out;
  current.forEach((s, i) => {
    const p = previous[i];
    if (!p) return;
    const v: CardioValues = {};
    for (const k of CARDIO_VALUE_KEYS) {
      if (s[k] == null && p[k] != null) v[k] = p[k];
    }
    if (Object.keys(v).length) out.set(s.id, v);
  });
  return out;
}

/** A segment with nothing logged in it. */
export function isEmptySegment(v: CardioValues): boolean {
  return !v.durationSec && !v.distance && !v.calories && !v.steps && v.speed == null && v.level == null && v.incline == null;
}
