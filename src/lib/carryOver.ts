import { orderSets, type LoggedSet } from './sets';

export interface CarryValues {
  weight?: number;
  reps?: number;
}

/**
 * Grey placeholders for empty cells: an empty weight or reps borrows the value
 * from the nearest set above it of the same kind (warm-up from warm-up, working
 * from working). Drops keep their own prefill and are skipped. Only fields that
 * are actually empty get a value, so typed numbers always win.
 *
 * Example: Hammer Curl with no history, three empty working sets. Type 25 × 10
 * into set 1 and sets 2 and 3 show 25 and 10 in grey; ticking them logs that.
 */
export function carryOver<T extends LoggedSet>(sets: T[]): Map<string, CarryValues> {
  const out = new Map<string, CarryValues>();
  const last: Record<'warmup' | 'working', CarryValues> = { warmup: {}, working: {} };
  for (const s of orderSets(sets)) {
    if (s.kind === 'drop') continue;
    const prev = last[s.kind];
    const carry: CarryValues = {};
    if (s.weight == null && prev.weight != null) carry.weight = prev.weight;
    if (s.reps == null && prev.reps != null) carry.reps = prev.reps;
    if (carry.weight != null || carry.reps != null) out.set(s.id, carry);
    last[s.kind] = { weight: s.weight ?? prev.weight, reps: s.reps ?? prev.reps };
  }
  return out;
}
