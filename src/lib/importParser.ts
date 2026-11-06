import type { SetKind, Units } from '../db/types';
import { parseCsvObjects } from './csv';

/**
 * Import from Strong / Hevy (SPEC §4, 9.5). Parses their CSV exports into
 * plain workouts. Weights stay in the file's unit; the caller converts.
 * Cardio / timed rows (no reps) are skipped: they're out of scope for v1.
 */
export type ImportSource = 'strong' | 'hevy' | 'opengym';

export interface ImportedSet {
  kind: SetKind;
  weight?: number;
  reps: number;
}

export interface ImportedExercise {
  name: string;
  sets: ImportedSet[];
}

export interface ImportedWorkout {
  name: string;
  startedAt: number;
  endedAt?: number;
  exercises: ImportedExercise[];
}

export interface ParsedImport {
  source: ImportSource;
  /** Unit found in the file header, if it says. */
  units?: Units;
  workouts: ImportedWorkout[];
  /** Distinct exercise names in first-seen order. */
  exerciseNames: string[];
  skippedRows: number;
}

export class ImportError extends Error {}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

/** Dates as they appear in Strong / Hevy exports, read as local time. */
export function parseImportDate(raw: string): number | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
  if (m && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)).getTime();
  }
  const ampm = (h: number, ap?: string) => {
    if (!ap) return h;
    const p = ap.toLowerCase();
    if (p === 'pm' && h < 12) return h + 12;
    if (p === 'am' && h === 12) return 0;
    return h;
  };
  // "5 Nov 2026, 18:10" / "5 Nov 2026 6:10 PM"
  m = /^(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?/.exec(s);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()] !== undefined) {
    return new Date(+m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1], ampm(+m[4], m[6]), +m[5]).getTime();
  }
  // "Nov 5, 2026, 6:10 PM"
  m = /^([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?/.exec(s);
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()] !== undefined) {
    return new Date(+m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2], ampm(+m[4], m[6]), +m[5]).getTime();
  }
  // "05/11/2026 18:10" is ambiguous (US vs EU); assume day-first only when it must be.
  m = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?)?/.exec(s);
  if (m) {
    let mo = +m[1];
    let d = +m[2];
    if (mo > 12) [mo, d] = [d, mo];
    return new Date(+m[3], mo - 1, d, ampm(+(m[4] ?? 0), m[6]), +(m[5] ?? 0)).getTime();
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? undefined : t;
}

/** Strong's duration column: "1h 2m", "45m", "50s", or plain seconds. */
export function parseDuration(raw: string): number | undefined {
  const s = raw.trim().toLowerCase();
  if (!s) return undefined;
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s) * 1000;
  let ms = 0;
  let matched = false;
  for (const [, n, u] of s.matchAll(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minutes?|s|sec|secs|seconds?)\b/g)) {
    matched = true;
    const v = Number(n);
    if (u.startsWith('h')) ms += v * 3_600_000;
    else if (u.startsWith('m')) ms += v * 60_000;
    else ms += v * 1000;
  }
  return matched ? ms : undefined;
}

const num = (v: string | undefined): number | undefined => {
  if (v == null) return undefined;
  const t = v.trim().replace(',', '.');
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
};

function unitsFromHeader(headers: string[]): Units | undefined {
  const h = headers.join(' ').toLowerCase();
  if (/\bkgs?\b|_kg\b|\(kg\)/.test(h)) return 'kg';
  if (/\blbs?\b|_lbs?\b|\(lbs?\)/.test(h)) return 'lb';
  return undefined;
}

function pushSet(ex: ImportedExercise, kind: SetKind, weight: number | undefined, reps: number) {
  ex.sets.push({ kind, weight, reps });
}

function finalize(map: Map<string, ImportedWorkout>, source: ImportSource, units: Units | undefined, skipped: number): ParsedImport {
  const workouts = [...map.values()]
    .map((w) => ({ ...w, exercises: w.exercises.filter((e) => e.sets.length) }))
    .filter((w) => w.exercises.length)
    .sort((a, b) => a.startedAt - b.startedAt);
  const names: string[] = [];
  const seen = new Set<string>();
  for (const w of workouts)
    for (const e of w.exercises)
      if (!seen.has(e.name)) {
        seen.add(e.name);
        names.push(e.name);
      }
  return { source, units, workouts, exerciseNames: names, skippedRows: skipped };
}

function getExercise(w: ImportedWorkout, name: string): ImportedExercise {
  const last = w.exercises[w.exercises.length - 1];
  if (last && last.name === name) return last;
  // Strong lists each exercise once; Hevy can split supersets. Reuse a match.
  const found = w.exercises.find((e) => e.name === name);
  if (found) return found;
  const ex = { name, sets: [] };
  w.exercises.push(ex);
  return ex;
}

function parseStrong(headers: string[], rows: Record<string, string>[]): ParsedImport {
  const weightCol = headers.find((h) => /^weight/i.test(h)) ?? 'Weight';
  let units = unitsFromHeader([weightCol]);
  const unitCol = headers.find((h) => /weight unit/i.test(h));
  const map = new Map<string, ImportedWorkout>();
  let skipped = 0;
  for (const r of rows) {
    const date = parseImportDate(r['Date'] ?? '');
    const exName = r['Exercise Name'];
    const order = (r['Set Order'] ?? '').trim().toUpperCase();
    const reps = num(r['Reps']);
    if (!date || !exName || !reps || reps <= 0 || order === 'REST TIMER') {
      skipped++;
      continue;
    }
    if (unitCol && !units) units = /kg/i.test(r[unitCol]) ? 'kg' : /lb/i.test(r[unitCol]) ? 'lb' : undefined;
    const name = r['Workout Name'] || 'Workout';
    const key = `${date}|${name}`;
    let w = map.get(key);
    if (!w) {
      const dur = parseDuration(r['Duration'] ?? '');
      w = { name, startedAt: date, endedAt: dur ? date + dur : undefined, exercises: [] };
      map.set(key, w);
    }
    const kind: SetKind = order === 'W' ? 'warmup' : order === 'D' ? 'drop' : 'working';
    pushSet(getExercise(w, exName), kind, num(r[weightCol]), reps);
  }
  return finalize(map, 'strong', units, skipped);
}

function parseHevy(headers: string[], rows: Record<string, string>[]): ParsedImport {
  const kgCol = headers.find((h) => /^weight_kg$/i.test(h));
  const lbCol = headers.find((h) => /^weight_lbs?$/i.test(h));
  const weightCol = kgCol ?? lbCol ?? headers.find((h) => /^weight/i.test(h));
  const units: Units | undefined = kgCol ? 'kg' : lbCol ? 'lb' : undefined;
  const map = new Map<string, ImportedWorkout>();
  let skipped = 0;
  for (const r of rows) {
    const start = parseImportDate(r['start_time'] ?? '');
    const exName = r['exercise_title'];
    const reps = num(r['reps']);
    if (!start || !exName || !reps || reps <= 0) {
      skipped++;
      continue;
    }
    const name = r['title'] || 'Workout';
    const key = `${start}|${name}`;
    let w = map.get(key);
    if (!w) {
      w = { name, startedAt: start, endedAt: parseImportDate(r['end_time'] ?? ''), exercises: [] };
      map.set(key, w);
    }
    const t = (r['set_type'] ?? '').toLowerCase();
    const kind: SetKind = t === 'warmup' ? 'warmup' : t === 'dropset' ? 'drop' : 'working';
    pushSet(getExercise(w, exName), kind, weightCol ? num(r[weightCol]) : undefined, reps);
  }
  return finalize(map, 'hevy', units, skipped);
}

/** OpenGym's own "Export CSV", so an export can come back in. */
function parseOpenGym(headers: string[], rows: Record<string, string>[]): ParsedImport {
  const weightCol = headers.find((h) => /^weight/i.test(h)) ?? 'Weight';
  const units = unitsFromHeader([weightCol]);
  const map = new Map<string, ImportedWorkout>();
  let skipped = 0;
  for (const r of rows) {
    const start = parseImportDate(r['Start'] ?? r['Date'] ?? '');
    const reps = num(r['Reps']);
    if (!start || !r['Exercise'] || !reps) {
      skipped++;
      continue;
    }
    const name = r['Workout'] || 'Workout';
    const key = `${start}|${name}`;
    let w = map.get(key);
    if (!w) {
      w = { name, startedAt: start, endedAt: parseImportDate(r['End'] ?? ''), exercises: [] };
      map.set(key, w);
    }
    const t = (r['Set Type'] ?? '').toLowerCase();
    const kind: SetKind = t.startsWith('warm') ? 'warmup' : t.startsWith('drop') ? 'drop' : 'working';
    pushSet(getExercise(w, r['Exercise']), kind, num(r[weightCol]), reps);
  }
  return finalize(map, 'opengym', units, skipped);
}

export function parseImportCsv(text: string): ParsedImport {
  const { headers, rows } = parseCsvObjects(text);
  const has = (h: string) => headers.some((x) => x.toLowerCase() === h.toLowerCase());
  if (has('Exercise Name') && has('Set Order')) return parseStrong(headers, rows);
  if (has('exercise_title') && has('start_time')) return parseHevy(headers, rows);
  if (has('Exercise') && has('Set Type') && has('Reps')) return parseOpenGym(headers, rows);
  throw new ImportError("This doesn't look like a Strong or Hevy export. Export a CSV from the app's settings and try again.");
}
