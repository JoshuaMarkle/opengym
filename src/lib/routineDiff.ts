/**
 * Finishing step 2 (SPEC §4): did the workout differ from its routine in
 * exercises, their order or the set counts? Weight and rep values never count.
 */
export interface StructureItem {
  exerciseId: string;
  warmups: number;
  working: number;
}

export type RoutineChange =
  | { type: 'added'; exerciseId: string; sets: number }
  | { type: 'removed'; exerciseId: string }
  | { type: 'replaced'; fromId: string; toId: string }
  | { type: 'sets'; exerciseId: string; from: number; to: number }
  | { type: 'warmups'; exerciseId: string; from: number; to: number }
  | { type: 'moved'; exerciseId: string; beforeId?: string };

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
    case 'moved':
      return {
        sign: '↻',
        text: c.beforeId ? `${name(c.exerciseId)} moved before ${name(c.beforeId)}` : `${name(c.exerciseId)} moved to the end`,
      };
  }
}
