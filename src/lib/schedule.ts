// Plan schedules (SPEC §11): which routine is planned on which day, and how
// each day went. Pure logic: no React, no Dexie. Days are local day keys
// ("2026-11-05"), which sort as strings.

import type { DayOverride, MissPolicy, PlanSchedule, ScheduleKind, ScheduleSlot, ScheduleVersion } from '../db/types';
import { addDays, dayKey, daysBetween } from './dates';

export type DayState =
  /** No schedule in force that day. */
  | 'off'
  | 'rest'
  /** Trained on a rest day (or on a day with no plan). */
  | 'extra'
  /** The planned workout was moved to another day by hand or carried to a rest day. */
  | 'moved'
  | 'done'
  | 'missed'
  /** Cycles with "Wait for me": not trained, so the cycle waited. */
  | 'paused'
  | 'today'
  | 'upcoming';

export interface PlanDay {
  key: string;
  ts: number;
  /** Routine id, null = rest, undefined = no schedule that day. */
  planned?: ScheduleSlot;
  state: DayState;
  /** Changed from the schedule for this day only (one-off change or a carried workout). */
  changed: boolean;
  /** For moved-out days: where the workout went. */
  movedTo?: string;
  /** For days that received a workout from another day. */
  movedFrom?: string;
  /** Cycles: 0-based position in the cycle. */
  cycleDay?: number;
  /** Routine ids of the workouts finished that day ('' = blank workout). */
  doneIds: string[];
}

export interface PlanInput {
  schedule: PlanSchedule;
  /** Day key → routine ids ('' for blank workouts) of finished workouts that day. */
  trained: Map<string, string[]>;
  today: string;
  from: string;
  to: string;
  weekStart: 0 | 1;
  /** False for deleted routines; their days count as rest. */
  exists?: (routineId: string) => boolean;
}

export function parseDayKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

export const addDayKey = (key: string, n: number) => dayKey(addDays(parseDayKey(key), n));

const mod = (a: number, n: number) => ((a % n) + n) % n;

const byFrom = (a: ScheduleVersion, b: ScheduleVersion) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0);

/** Where a cycle stands on the version's first day. */
function startIndex(v: ScheduleVersion): number {
  if (v.kind !== 'cycle' || !v.days.length) return 0;
  return mod(daysBetween(parseDayKey(v.anchor ?? v.from), parseDayKey(v.from)), v.days.length);
}

/** The version in force on a day (the latest that started on or before it). */
export function versionOn(schedule: PlanSchedule | undefined, key: string): ScheduleVersion | undefined {
  let found: ScheduleVersion | undefined;
  for (const v of [...(schedule?.versions ?? [])].sort(byFrom)) if (v.from <= key) found = v;
  return found;
}

/** The schedule as it stands now (or from its first day, if that's still ahead). */
export function currentVersion(schedule: PlanSchedule | undefined, today: string): ScheduleVersion | undefined {
  const sorted = [...(schedule?.versions ?? [])].sort(byFrom);
  return versionOn(schedule, today) ?? sorted[0];
}

/** A folder is a plan when its current schedule is a cycle or weekly split. */
export function hasSchedule(schedule: PlanSchedule | undefined, today: string): boolean {
  const v = currentVersion(schedule, today);
  return !!v && v.kind !== 'none' && v.days.length > 0;
}

/** First day of the current run of scheduled versions ("active plan · since Sep 1"). */
export function planSince(schedule: PlanSchedule | undefined, today: string): string | undefined {
  const sorted = [...(schedule?.versions ?? [])].sort(byFrom).filter((v) => v.from <= today);
  let since: string | undefined;
  for (let i = sorted.length - 1; i >= 0 && sorted[i].kind !== 'none'; i--) since = sorted[i].from;
  return since;
}

/**
 * Work out every day from `from` to `to`: what's planned (after one-off
 * changes and carried workouts) and how it went. Any finished workout on a
 * planned day counts as doing that day. Days before today without a workout
 * are missed, except in "Wait for me" cycles where the cycle simply waits.
 * Today and later assume you'll train as planned.
 */
export function planDays(input: PlanInput): PlanDay[] {
  const { schedule, trained, today, weekStart } = input;
  const exists = input.exists ?? (() => true);
  const versions = [...schedule.versions].sort(byFrom);
  const skipped = new Set(schedule.skipped ?? []);
  const fromTs = parseDayKey(input.from);
  const toTs = parseDayKey(input.to);
  const todayTs = parseDayKey(today);
  // Cycles that wait and carried workouts depend on earlier days, so walk from the first version.
  const startTs = versions.length ? Math.min(fromTs, parseDayKey(versions[0].from)) : fromTs;
  const slot = (s: ScheduleSlot | undefined): ScheduleSlot => (s && exists(s) ? s : null);

  const out: PlanDay[] = [];
  let vi = -1;
  let v: ScheduleVersion | undefined;
  let p = 0;
  let cycleDelay = 0;
  let carry: { routineId: string; origin: PlanDay }[] = [];

  for (let ts = startTs; ts <= toTs; ts = addDays(ts, 1)) {
    const key = dayKey(ts);
    while (vi + 1 < versions.length && versions[vi + 1].from <= key) {
      v = versions[++vi];
      p = startIndex(v);
      cycleDelay = 0;
      carry = [];
    }
    const doneIds = trained.get(key) ?? [];
    const day: PlanDay = { key, ts, state: doneIds.length ? 'extra' : 'off', changed: false, doneIds };
    if (ts >= fromTs) out.push(day);
    if (!v || v.kind === 'none' || !v.days.length) continue;

    const n = v.days.length;
    const weekday = new Date(ts).getDay();
    const isPast = ts < todayTs;
    const isToday = ts === todayTs;
    const didTrain = doneIds.length > 0;
    const waits = v.kind === 'cycle' && v.onMiss === 'wait';
    if (weekday === weekStart) carry = []; // carried workouts stay within their week

    let base: ScheduleSlot;
    if (v.kind === 'weekly') base = slot(v.days[weekday]);
    else if (waits) {
      day.cycleDay = p % n;
      base = slot(v.days[p % n]);
    } else {
      day.cycleDay = mod(daysBetween(parseDayKey(v.anchor ?? v.from), ts) - cycleDelay, n);
      base = slot(v.days[day.cycleDay]);
    }

    // PH3.14: a delay changes later cycle dates too, even without individual overrides.
    // Keep this derived from the schedule so live views and reloaded views agree.
    if (v.kind === 'cycle' && mod(cycleDelay, n) !== 0) day.changed = true;
    const ov = schedule.overrides[key];
    let planned = base;
    let movedOut = false;
    if (ov) {
      planned = slot(ov.routineId);
      day.changed = true;
      movedOut = ov.routineId === null && !!ov.moved;
      if (ov.moved && ov.pair) {
        if (movedOut) day.movedTo = ov.pair;
        else day.movedFrom = ov.pair;
      }
    } else if (planned === null && carry.length) {
      const c = carry.shift()!;
      planned = c.routineId;
      day.changed = true;
      day.movedFrom = c.origin.key;
      c.origin.state = 'moved';
      c.origin.movedTo = key;
    }
    day.planned = planned;

    if (planned === null) day.state = didTrain ? 'extra' : movedOut ? 'moved' : 'rest';
    else if (didTrain) day.state = 'done';
    else if (isToday) day.state = 'today';
    else if (!isPast) day.state = 'upcoming';
    else if (waits) day.state = 'paused';
    else {
      day.state = 'missed';
      if (v.kind === 'weekly' && v.onMiss === 'rest' && !skipped.has(key)) carry.push({ routineId: planned, origin: day });
    }

    if (v.kind === 'cycle' && ov?.cycleAction === 'delay') cycleDelay++;
    if (waits) {
      const cur = slot(v.days[p % n]);
      const did = isPast ? didTrain : true; // today and later: assume you train as planned
      if (ov?.cycleAction === 'skip') p++;
      else if (ov) {
        // A one-off change only moves the cycle on if it was the cycle's own workout.
        if (ov.routineId !== null && ov.routineId === cur && did) p++;
      } else if (cur === null) {
        p++;
        // Trained early on a rest day: that workout is done too.
        const next = slot(v.days[p % n]);
        if (ts <= todayTs && next !== null && doneIds.includes(next)) p++;
      } else if (did) p++;
    }
  }
  return out;
}

export interface PlanCounts {
  /** Planned workouts done / done + missed, up to today. */
  done: number;
  due: number;
  missed: number;
}

/** "On plan 5 of 6": planned workouts you did, out of those that were due. Today counts once done. */
export function onPlan(days: PlanDay[]): PlanCounts {
  let done = 0;
  let missed = 0;
  for (const d of days) {
    if (d.state === 'done') done++;
    else if (d.state === 'missed') missed++;
  }
  return { done, due: done + missed, missed };
}

/** "This week 2 of 4": workouts planned for the days given, and how many are done. */
export function weekCounts(days: PlanDay[]): { done: number; total: number } {
  const workouts = days.filter((d) => d.planned);
  return { done: workouts.filter((d) => d.state === 'done').length, total: workouts.length };
}

// ───────────────────────────── one-off changes (2.21, 3.5)

export type OverridePatch = Record<string, DayOverride | undefined>;

export function applyOverrides(schedule: PlanSchedule, patch: OverridePatch): PlanSchedule {
  const overrides = { ...schedule.overrides };
  for (const [k, ov] of Object.entries(patch)) {
    if (ov) overrides[k] = ov;
    else delete overrides[k];
  }
  return { ...schedule, overrides };
}

/** Undo a one-off change, and the other half of a move or swap. */
export function resetDayPatch(schedule: PlanSchedule, key: string): OverridePatch {
  const ov = schedule.overrides[key];
  const patch: OverridePatch = { [key]: undefined };
  if (ov?.pair && schedule.overrides[ov.pair]?.pair === key) patch[ov.pair] = undefined;
  const delayFrom = ov?.delayFrom;
  if (delayFrom) for (const [k, other] of Object.entries(schedule.overrides)) {
    if (other.delayFrom === delayFrom) patch[k] = undefined;
  }
  return patch;
}

/** Replace a day's workout with another routine (or rest), just for that day. */
export function setDayPatch(key: string, routineId: ScheduleSlot): OverridePatch {
  return { [key]: { routineId } };
}

/** PH3.12: skip a cycle slot without holding it, including Wait for me cycles. */
export function skipDayPatch(key: string): OverridePatch {
  return { [key]: { routineId: null, cycleAction: 'skip' } };
}

/** PH3.12: insert rest days before a cycle workout, shifting the whole remaining cycle. */
export function delayCyclePatch(from: string, to: string): OverridePatch {
  const patch: OverridePatch = {};
  for (let key = from; key < to; key = addDayKey(key, 1)) {
    patch[key] = { routineId: null, cycleAction: 'delay', delayFrom: from };
  }
  return patch;
}

/** Move a day's workout to another day. The target's own workout, if any, is replaced. */
export function moveDayPatch(from: string, routineId: string, to: string): OverridePatch {
  return {
    [from]: { routineId: null, moved: true, pair: to },
    [to]: { routineId, moved: true, pair: from },
  };
}

export function swapDaysPatch(a: string, aRoutine: ScheduleSlot, b: string, bRoutine: ScheduleSlot): OverridePatch {
  return {
    [a]: { routineId: bRoutine, moved: true, pair: b },
    [b]: { routineId: aRoutine, moved: true, pair: a },
  };
}

/** Next plain rest day within a week after `key` (where "Rest today" sends the workout). */
export function restTarget(days: PlanDay[], key: string): PlanDay | undefined {
  const limit = addDayKey(key, 7);
  return days.find((d) => d.key > key && d.key < limit && d.planned === null && !d.changed && d.state === 'rest');
}

/** Next workout day within a week after `key` (the "Swap with" option). */
export function swapTarget(days: PlanDay[], key: string): PlanDay | undefined {
  const limit = addDayKey(key, 7);
  return days.find((d) => d.key > key && d.key < limit && !!d.planned && d.state !== 'done');
}

/**
 * 3.5: the note on Home the day after a missed workout. Only for plans that
 * keep to the calendar; "Wait for me" cycles never miss.
 */
export function missedYesterday(days: PlanDay[], today: string, schedule: PlanSchedule): PlanDay | undefined {
  const y = days.find((d) => d.key === addDayKey(today, -1));
  if (!y || y.state !== 'missed' || !y.planned) return undefined;
  // Not about a schedule you've since replaced.
  const v = versionOn(schedule, today);
  if (!v || v !== versionOn(schedule, y.key) || v.onMiss === 'wait') return undefined;
  if ((schedule.skipped ?? []).includes(y.key)) return undefined;
  return y;
}

/** "Do it today": yesterday's workout moves into today. */
export function doItTodayPatch(missed: PlanDay, today: string): OverridePatch {
  return moveDayPatch(missed.key, missed.planned!, today);
}

// ───────────────────────────── editing the schedule (2.16–2.19)

export interface ScheduleDraft {
  kind: ScheduleKind;
  days: ScheduleSlot[];
  /** Cycle: which day (0-based) today is. */
  todayIndex: number;
  onMiss: MissPolicy;
}

export const DEFAULT_MISS: Record<'cycle' | 'weekly', MissPolicy> = { cycle: 'wait', weekly: 'skip' };

/**
 * Save a schedule from today on. Earlier versions stay so past days keep the
 * plan they had; one-off changes from today on are dropped because they were
 * made against the old schedule. Returns undefined when nothing is left.
 */
export function withScheduleFrom(schedule: PlanSchedule | undefined, draft: ScheduleDraft, today: string): PlanSchedule | undefined {
  const earlier = (schedule?.versions ?? []).filter((v) => v.from < today).sort(byFrom);
  const overrides = Object.fromEntries(Object.entries(schedule?.overrides ?? {}).filter(([k]) => k < today));
  const skipped = (schedule?.skipped ?? []).filter((k) => k < today);
  const next: ScheduleVersion = {
    from: today,
    kind: draft.days.length ? draft.kind : 'none',
    days: draft.kind === 'none' ? [] : draft.days,
    onMiss: draft.onMiss,
    ...(draft.kind === 'cycle' ? { anchor: addDayKey(today, -draft.todayIndex) } : {}),
  };
  const prev = earlier[earlier.length - 1];
  const versions = !prev && next.kind === 'none' ? [] : [...earlier, next];
  if (!versions.length) return undefined;
  return { versions, overrides, ...(skipped.length ? { skipped } : {}) };
}

/** A starting point when switching a plan to a cycle or weekly split. */
export function suggestDays(kind: 'cycle' | 'weekly', routineIds: string[]): ScheduleSlot[] {
  if (kind === 'cycle') return routineIds.length ? [...routineIds, null] : [null];
  // Spread the routines over the week, Monday first, resting between where there's room.
  const PATTERNS: Record<number, number[]> = {
    1: [1],
    2: [1, 4],
    3: [1, 3, 5],
    4: [1, 2, 4, 5],
    5: [1, 2, 3, 5, 6],
    6: [1, 2, 3, 4, 5, 6],
  };
  const ids = routineIds.slice(0, 7);
  const weekdays = PATTERNS[ids.length] ?? [0, 1, 2, 3, 4, 5, 6];
  const days: ScheduleSlot[] = Array(7).fill(null);
  weekdays.forEach((wd, i) => (days[wd] = ids[i] ?? null));
  return days;
}

/** Weekday indexes in display order (Sunday or Monday first). */
export const weekOrder = (weekStart: 0 | 1) => Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7);

// ───────────────────────────── strip labels

/**
 * Short labels for plan strips: Push A → PA, Legs → L. Clashes within the plan
 * fall back to more letters (Pull A → PL). A routine's own code wins.
 */
export function routineCodes(routines: { id: string; name: string; code?: string }[]): Map<string, string> {
  const out = new Map<string, string>();
  const taken = new Set<string>();
  for (const r of routines) {
    const c = r.code?.trim().toUpperCase();
    if (c) {
      out.set(r.id, c.slice(0, 3));
      taken.add(c.slice(0, 3));
    }
  }
  for (const r of routines) {
    if (out.has(r.id)) continue;
    const code = codeCandidates(r.name).find((c) => !taken.has(c)) ?? fallbackCode(r.name, taken);
    out.set(r.id, code);
    taken.add(code);
  }
  return out;
}

function codeCandidates(name: string): string[] {
  const words = name
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  if (!words.length) return [];
  const [first, ...rest] = words;
  const initials = words.map((w) => w[0]).join('');
  const tail = rest.map((w) => w[0]).join('');
  const out = [initials.slice(0, 3)];
  const letters = first.slice(1).split('');
  const consonants = letters.filter((c) => !'AEIOU'.includes(c));
  for (const c of [...consonants, ...letters]) {
    out.push(first[0] + c);
    if (tail) out.push((first[0] + c + tail).slice(0, 3));
  }
  return [...new Set(out.filter(Boolean))];
}

function fallbackCode(name: string, taken: Set<string>): string {
  const head = name.toUpperCase().replace(/[^A-Z0-9]/g, '')[0] ?? 'R';
  for (let i = 2; i < 100; i++) if (!taken.has(`${head}${i}`)) return `${head}${i}`;
  return head;
}

/** Turn a list of finished workouts into the `trained` map planDays needs. */
export function trainedByDay(workouts: { startedAt: number; routineId?: string }[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const w of workouts) {
    const k = dayKey(w.startedAt);
    m.set(k, [...(m.get(k) ?? []), w.routineId ?? '']);
  }
  return m;
}

// ───────────────────────────── descriptions

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_PLURALS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

const joinAnd = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} & ${xs[xs.length - 1]}`);

/** When a routine comes up: "Thursdays", "Mon & Thu", "Day 1", "Days 1 & 5". Undefined = not scheduled. */
export function describeWhen(v: ScheduleVersion | undefined, routineId: string, weekStart: 0 | 1): string | undefined {
  if (!v || v.kind === 'none') return undefined;
  if (v.kind === 'weekly') {
    const wds = weekOrder(weekStart).filter((wd) => v.days[wd] === routineId);
    if (!wds.length) return undefined;
    return wds.length === 1 ? DAY_PLURALS[wds[0]] : joinAnd(wds.map((wd) => DAY_NAMES[wd]));
  }
  const pos = v.days.flatMap((s, i) => (s === routineId ? [i + 1] : []));
  if (!pos.length) return undefined;
  return pos.length === 1 ? `Day ${pos[0]}` : `Days ${joinAnd(pos.map(String))}`;
}

/** "Weekly split" + "4 workouts · 3 rest days". */
export function describeSchedule(v: ScheduleVersion | undefined): { title: string; detail: string } {
  if (!v || v.kind === 'none' || !v.days.length) return { title: 'No schedule', detail: 'Whatever you did longest ago is next.' };
  const workouts = v.days.filter(Boolean).length;
  const rests = v.days.length - workouts;
  const w = `${workouts} ${workouts === 1 ? 'workout' : 'workouts'}`;
  const r = `${rests} rest ${rests === 1 ? 'day' : 'days'}`;
  if (v.kind === 'weekly') return { title: 'Weekly split', detail: `${w} · ${r}` };
  return { title: 'Repeating cycle', detail: `${v.days.length} days · ${w} · ${r}` };
}
