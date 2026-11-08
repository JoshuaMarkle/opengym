import type { ExerciseType, SetKind, Units } from '../db/types';
import { isEmptySegment, type CardioValues } from './cardio';
import { formatWeight } from './units';

/** The minimal shape the set helpers need. WorkoutSet satisfies it. */
export interface LoggedSet {
  id: string;
  order: number;
  kind: SetKind;
  parentSetId?: string;
  weight?: number;
  reps?: number;
  completed?: boolean;
}

/**
 * Canonical display order: warm-ups first, then working sets, each followed
 * immediately by its drops. Orphan drops (parent gone) trail their nearest
 * preceding set by `order`.
 */
export function orderSets<T extends LoggedSet>(sets: T[]): T[] {
  const byOrder = [...sets].sort((a, b) => a.order - b.order);
  const ids = new Set(byOrder.map((s) => s.id));
  const drops = new Map<string, T[]>();
  const tops: T[] = [];
  for (const s of byOrder) {
    if (s.kind === 'drop' && s.parentSetId && ids.has(s.parentSetId)) {
      const list = drops.get(s.parentSetId) ?? [];
      list.push(s);
      drops.set(s.parentSetId, list);
    } else {
      tops.push(s);
    }
  }
  const warm = tops.filter((s) => s.kind === 'warmup');
  const rest = tops.filter((s) => s.kind !== 'warmup');
  const out: T[] = [];
  const pushWithDrops = (s: T) => {
    out.push(s);
    for (const d of drops.get(s.id) ?? []) pushWithDrops(d);
  };
  for (const s of [...warm, ...rest]) pushWithDrops(s);
  return out;
}

/**
 * Position key used to line sets up across sessions: warm-ups `w0`, `w1`…,
 * working sets `s0`, `s1`…, drops `s1d0`, `s1d1`… (the nth drop after a set).
 */
export function positionKeys<T extends LoggedSet>(ordered: T[]): Map<string, string> {
  const keys = new Map<string, string>();
  let w = 0;
  let s = 0;
  const dropCount = new Map<string, number>();
  for (const set of ordered) {
    if (set.kind === 'drop') {
      const parentKey = (set.parentSetId && keys.get(set.parentSetId)) || `s${Math.max(0, s - 1)}`;
      const root = parentKey.split('d')[0];
      const n = dropCount.get(root) ?? 0;
      dropCount.set(root, n + 1);
      keys.set(set.id, `${root}d${n}`);
    } else if (set.kind === 'warmup') {
      keys.set(set.id, `w${w++}`);
    } else {
      keys.set(set.id, `s${s++}`);
    }
  }
  return keys;
}

/** Row labels: W for warm-ups, 1…n for working sets, D for drops. */
export function setLabels<T extends LoggedSet>(ordered: T[]): Map<string, string> {
  const labels = new Map<string, string>();
  let n = 0;
  for (const s of ordered) {
    if (s.kind === 'warmup') labels.set(s.id, 'W');
    else if (s.kind === 'drop') labels.set(s.id, 'D');
    else labels.set(s.id, String(++n));
  }
  return labels;
}

/**
 * Groups ordered sets for one-line summaries: each working set followed by the
 * drops done after it, in the order they happened ("185 × 8 · 185 × 6 D 135 × 9").
 * Warm-ups and their drops are left out. A drop with nothing before it starts its own group.
 */
export function dropChains<T extends LoggedSet>(ordered: T[]): { set: T; drops: T[] }[] {
  const out: { set: T; drops: T[] }[] = [];
  let afterWarmup = false;
  for (const s of ordered) {
    if (s.kind === 'warmup') {
      afterWarmup = true;
    } else if (s.kind === 'drop') {
      if (afterWarmup) continue;
      const last = out[out.length - 1];
      if (last) last.drops.push(s);
      else out.push({ set: s, drops: [] });
    } else {
      afterWarmup = false;
      out.push({ set: s, drops: [] });
    }
  }
  return out;
}

/** Working-set number (1-based) for a set, or undefined for warm-ups/drops. */
export function workingIndex<T extends LoggedSet>(ordered: T[], id: string): number | undefined {
  let n = 0;
  for (const s of ordered) {
    if (s.kind === 'working') {
      n++;
      if (s.id === id) return n;
    }
  }
  return undefined;
}

/** The weight part of a set in the design's notation: "185", "BW", "+25", "−40". */
export function formatSetWeight(weight: number | undefined, type: ExerciseType, units: Units): string {
  if (type === 'bodyweight') return 'BW';
  const w = weight ?? 0;
  if (type === 'bodyweight_plus') return w > 0 ? `+${formatWeight(w, units)}` : 'BW';
  if (type === 'assisted') return w < 0 ? `−${formatWeight(-w, units)}` : w > 0 ? `+${formatWeight(w, units)}` : 'BW';
  if (weight === undefined) return '—';
  return formatWeight(w, units).replace('-', '−');
}

/** "185 × 8", "BW × 12", "+25 × 8", "−40 × 10" */
export function formatSet(set: { weight?: number; reps?: number }, type: ExerciseType, units: Units): string {
  const reps = set.reps ?? 0;
  return `${formatSetWeight(set.weight, type, units)} × ${reps}`;
}

/** Rep target as shown in a cell: "6–8", "10", or "" when there's no target. */
export function formatRepRange(min?: number, max?: number): string {
  if (min == null && max == null) return '';
  if (min != null && max != null && min !== max) return `${min}–${max}`;
  return String(min ?? max);
}

export function parseRepRange(text: string): { repsMin?: number; repsMax?: number } {
  const t = text.trim();
  if (!t) return {};
  const m = /^(\d+)\s*[–-]\s*(\d*)$/.exec(t);
  if (m) {
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    return { repsMin: Math.min(a, b), repsMax: Math.max(a, b) };
  }
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? { repsMin: n, repsMax: n } : {};
}

/** A set with nothing in it worth keeping: no reps (lifts) and no time, distance or calories (cardio). */
export function isEmptySet(s: { reps?: number } & CardioValues): boolean {
  return (s.reps == null || s.reps <= 0) && isEmptySegment(s);
}

/** Does this exercise type need a weight to log a set? */
export const needsWeight = (type: ExerciseType) => type === 'weight';
/** Does the table show a weight column for this type? */
export const hasWeightColumn = (type: ExerciseType) => type !== 'bodyweight' && type !== 'cardio';
export const isCardio = (type: ExerciseType) => type === 'cardio';

export function weightColumnLabel(type: ExerciseType, unitCol: string): string {
  if (type === 'bodyweight_plus') return `+${unitCol}`;
  if (type === 'assisted') return `−${unitCol}`;
  return unitCol;
}

export const TYPE_TAG: Partial<Record<ExerciseType, string>> = {
  bodyweight: 'BW',
  bodyweight_plus: 'BW +',
  assisted: 'ASSIST',
};

export const TYPE_LABEL: Record<ExerciseType, string> = {
  weight: 'Weight × reps',
  bodyweight: 'Bodyweight',
  bodyweight_plus: 'Bodyweight + added',
  assisted: 'Assisted',
  cardio: 'Cardio',
};
