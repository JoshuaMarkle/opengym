/**
 * Finishing step 2 (SPEC §4): did the workout differ from its routine in
 * exercises, their order or the set counts? Weight and rep values never count.
 */
export interface StructureItem {
  exerciseId: string;
  warmups: number;
  working: number;
  /** Superset letter (normalized), when part of one. */
  supersetGroup?: string;
}

export type RoutineChange =
  | { type: 'added'; exerciseId: string; sets: number }
  | { type: 'removed'; exerciseId: string }
  | { type: 'replaced'; fromId: string; toId: string }
  | { type: 'sets'; exerciseId: string; from: number; to: number }
  | { type: 'warmups'; exerciseId: string; from: number; to: number }
  | { type: 'moved'; exerciseId: string; beforeId?: string }
  | { type: 'superset'; exerciseIds: string[] }
  | { type: 'unlinked'; exerciseIds: string[] };

/** Longest increasing subsequence (returns the values kept). */
function lis(values: number[]): Set<number> {
  const n = values.length;
  const tails: number[] = [];
  const tailIdx: number[] = [];
  const prev: number[] = new Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tails[mid] < values[i]) lo = mid + 1;
      else hi = mid;
    }
    tails[lo] = values[i];
    tailIdx[lo] = i;
    prev[i] = lo > 0 ? tailIdx[lo - 1] : -1;
  }
  const keep = new Set<number>();
  let k = tailIdx[tails.length - 1];
  while (k !== undefined && k >= 0) {
    keep.add(values[k]);
    k = prev[k];
  }
  return keep;
}

export function diffRoutine(
  routine: StructureItem[],
  workout: StructureItem[],
  groupOf: (exerciseId: string) => string | undefined = () => undefined,
): RoutineChange[] {
  const changes: RoutineChange[] = [];
  const rIds = routine.map((r) => r.exerciseId);
  const wIds = workout.map((w) => w.exerciseId);
  const removed = routine.filter((r) => !wIds.includes(r.exerciseId));
  const added = workout.filter((w) => !rIds.includes(w.exerciseId));

  // A swap within a variation group reads as one "replaced" change.
  const pairs = new Map<string, string>(); // removedId -> addedId
  const usedAdded = new Set<string>();
  for (const r of removed) {
    const g = groupOf(r.exerciseId);
    if (!g) continue;
    const a = added.find((x) => !usedAdded.has(x.exerciseId) && groupOf(x.exerciseId) === g);
    if (a) {
      pairs.set(r.exerciseId, a.exerciseId);
      usedAdded.add(a.exerciseId);
    }
  }
  for (const a of added) {
    if (!usedAdded.has(a.exerciseId)) changes.push({ type: 'added', exerciseId: a.exerciseId, sets: a.warmups + a.working });
  }
  for (const r of removed) {
    const to = pairs.get(r.exerciseId);
    if (to) changes.push({ type: 'replaced', fromId: r.exerciseId, toId: to });
    else changes.push({ type: 'removed', exerciseId: r.exerciseId });
  }

  // Order: treat replaced pairs as the same slot, then find what moved.
  const slotOf = (id: string) => {
    const from = [...pairs.entries()].find(([, to]) => to === id)?.[0];
    return rIds.indexOf(from ?? id);
  };
  const common = workout.filter((w) => slotOf(w.exerciseId) >= 0);
  const seq = common.map((w) => slotOf(w.exerciseId));
  const keep = lis(seq);
  common.forEach((w, i) => {
    if (keep.has(seq[i])) return;
    const next = common.slice(i + 1).find((x) => keep.has(slotOf(x.exerciseId)));
    changes.push({ type: 'moved', exerciseId: w.exerciseId, beforeId: next?.exerciseId });
  });

  // Set counts for exercises in both (or swapped in place).
  for (const w of workout) {
    const slot = slotOf(w.exerciseId);
    if (slot < 0) continue;
    const r = routine[slot];
    if (r.working !== w.working) changes.push({ type: 'sets', exerciseId: w.exerciseId, from: r.working, to: w.working });
    if (r.warmups !== w.warmups) changes.push({ type: 'warmups', exerciseId: w.exerciseId, from: r.warmups, to: w.warmups });
  }

  // Supersets: a group made or broken up during the workout is a change (same slots, swaps included).
  const groups = (items: StructureItem[], map: (id: string) => string) => {
    const m = new Map<string, string[]>();
    for (const it of items) if (it.supersetGroup) m.set(it.supersetGroup, [...(m.get(it.supersetGroup) ?? []), map(it.exerciseId)]);
    return [...m.values()].filter((g) => g.length > 1);
  };
  const toRoutineId = (id: string) => [...pairs.entries()].find(([, to]) => to === id)?.[0] ?? id;
  const sig = (g: string[]) => [...g].sort().join('|');
  const rGroups = groups(routine, (id) => id);
  const wGroups = groups(workout, toRoutineId);
  const rSigs = new Set(rGroups.map(sig));
  const wSigs = new Set(wGroups.map(sig));
  const backToWorkout = (id: string) => pairs.get(id) ?? id;
  for (const g of wGroups) if (!rSigs.has(sig(g))) changes.push({ type: 'superset', exerciseIds: g.map(backToWorkout) });
  for (const g of rGroups) {
    const present = g.filter((id) => wIds.includes(backToWorkout(id)));
    if (!wSigs.has(sig(g)) && present.length > 1) changes.push({ type: 'unlinked', exerciseIds: present.map(backToWorkout) });
  }
  return changes;
}

export function describeChange(c: RoutineChange, name: (id: string) => string): { sign: '+' | '−' | '↻'; text: string } {
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  switch (c.type) {
    case 'added':
      return { sign: '+', text: `Added ${name(c.exerciseId)} (${plural(c.sets, 'set')})` };
    case 'removed':
      return { sign: '−', text: `Removed ${name(c.exerciseId)}` };
    case 'replaced':
      return { sign: '↻', text: `${name(c.fromId)} → ${name(c.toId)}` };
    case 'sets':
      return { sign: '↻', text: `${name(c.exerciseId)}: ${c.from} → ${plural(c.to, 'set')}` };
    case 'warmups':
      return { sign: '↻', text: `${name(c.exerciseId)}: ${c.from} → ${plural(c.to, 'warm-up')}` };
    case 'superset':
      return { sign: '+', text: `Superset: ${c.exerciseIds.map(name).join(' + ')}` };
    case 'unlinked':
      return { sign: '−', text: `No longer a superset: ${c.exerciseIds.map(name).join(' + ')}` };
    case 'moved':
      return {
        sign: '↻',
        text: c.beforeId ? `${name(c.exerciseId)} moved before ${name(c.beforeId)}` : `${name(c.exerciseId)} moved to the end`,
      };
  }
}
