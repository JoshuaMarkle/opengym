import type { ExerciseType, RoutineSetKind } from '../db/types';
import { indexSession } from './previous';
import { orderSets, positionKeys, type LoggedSet } from './sets';
import { roundToStep } from './units';

export interface RoutineSetLike {
  id: string;
  order: number;
  kind: RoutineSetKind;
  weight: number | 'last';
  repsMin?: number;
  repsMax?: number;
  rpeTarget?: number;
}

export interface SetDraft {
  kind: 'warmup' | 'working' | 'drop';
  weight?: number;
  reps?: number;
  repsMin?: number;
  repsMax?: number;
  /** Effort target from the routine: an outlined badge, never a logged value (A4). */
  rpeTarget?: number;
}

/**
 * Prefill (SPEC §4): each set's weight comes from the routine ('last' = the same
 * set position from the most recent workout with that exercise; empty if none).
 * Reps fill in from last time; the rep range is kept as the grey placeholder.
 */
export function prefillFromRoutine(routineSets: RoutineSetLike[], lastSession: LoggedSet[] | undefined): SetDraft[] {
  const ordered = [...routineSets].sort((a, b) => (a.kind === b.kind ? a.order - b.order : a.kind === 'warmup' ? -1 : 1));
  const prev = lastSession?.length ? indexSession(lastSession).byKey : undefined;
  let w = 0;
  let s = 0;
  return ordered.map((rs) => {
    const key = rs.kind === 'warmup' ? `w${w++}` : `s${s++}`;
    const p = prev?.get(key);
    return {
      kind: rs.kind,
      weight: typeof rs.weight === 'number' ? rs.weight : p?.weight,
      reps: p?.reps,
      repsMin: rs.repsMin,
      repsMax: rs.repsMax,
      ...(rs.kind === 'working' && rs.rpeTarget != null ? { rpeTarget: rs.rpeTarget } : {}),
    };
  });
}

/** Prefill for a workout started without a routine: repeat last session's warm-ups and working sets. */
export function prefillFromLastSession(lastSession: LoggedSet[] | undefined, fallbackCount = 3): SetDraft[] {
  const sets = lastSession?.length ? orderSets(lastSession).filter((s) => s.kind !== 'drop') : [];
  if (!sets.length) return Array.from({ length: fallbackCount }, () => ({ kind: 'working' as const }));
  return sets.map((s) => ({ kind: s.kind as 'warmup' | 'working', weight: s.weight, reps: s.reps }));
}

/**
 * "+ Set" appends a working set. Weight/reps come from the same position last
 * time; otherwise the weight carries over from the last working set today.
 */
export function nextWorkingSet(
  current: (LoggedSet & { repsMin?: number; repsMax?: number; rpeTarget?: number })[],
  lastSession: LoggedSet[] | undefined,
): SetDraft {
  const ordered = orderSets(current);
  const working = ordered.filter((s) => s.kind === 'working');
  const prev = lastSession?.length ? indexSession(lastSession).byKey.get(`s${working.length}`) : undefined;
  const lastWorking = working[working.length - 1];
  return {
    kind: 'working',
    weight: prev?.weight ?? lastWorking?.weight,
    reps: prev?.reps,
    repsMin: lastWorking?.repsMin,
    repsMax: lastWorking?.repsMax,
    ...(lastWorking?.rpeTarget != null ? { rpeTarget: lastWorking.rpeTarget } : {}),
  };
}

/** Weight for a drop: `weight × (1 − dropPercent)`, rounded to the weight step. */
export function dropWeight(base: number | undefined, type: ExerciseType, dropPercent: number, stepLb: number): number | undefined {
  if (type === 'bodyweight') return undefined;
  const p = Math.min(Math.max(dropPercent, 0), 95) / 100;
  if (base == null) return undefined;
  if (type === 'assisted') {
    // Easier = more assistance = more negative.
    if (base >= 0) return -stepLb;
    return roundToStep(base * (1 + p), stepLb);
  }
  const w = roundToStep(base * (1 - p), stepLb);
  if (type === 'bodyweight_plus') return Math.max(0, w);
  return w === base && base > 0 ? Math.max(0, base - stepLb) : Math.max(0, w);
}

export interface DropPlan {
  parentSetId: string;
  /** Insert after this set (the parent or its last existing drop). */
  afterSetId: string;
  weight?: number;
  reps?: number;
}

/**
 * "+ Drop" adds a drop under the last completed set (chaining after any drops
 * already there), prefilled lighter. Falls back to the last working set when
 * nothing is completed yet.
 */
export function planDrop(
  current: LoggedSet[],
  lastSession: LoggedSet[] | undefined,
  type: ExerciseType,
  dropPercent: number,
  stepLb: number,
): DropPlan | null {
  const ordered = orderSets(current);
  if (!ordered.length) return null;
  let anchor = [...ordered].reverse().find((s) => s.completed);
  if (!anchor) anchor = [...ordered].reverse().find((s) => s.kind === 'working') ?? [...ordered].reverse().find((s) => s.kind !== 'drop');
  if (!anchor) return null;
  const parentId = anchor.kind === 'drop' && anchor.parentSetId ? anchor.parentSetId : anchor.id;
  const parent = ordered.find((s) => s.id === parentId);
  if (!parent) return null;
  const chain = ordered.filter((s) => s.kind === 'drop' && s.parentSetId === parentId);
  const last = chain[chain.length - 1] ?? parent;

  const keys = positionKeys(ordered);
  const parentKey = keys.get(parentId)!;
  const prevDrop = lastSession?.length ? indexSession(lastSession).byKey.get(`${parentKey}d${chain.length}`) : undefined;

  return {
    parentSetId: parentId,
    afterSetId: last.id,
    weight: dropWeight(last.weight, type, dropPercent, stepLb),
    reps: prevDrop?.reps,
  };
}
