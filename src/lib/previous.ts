import { orderSets, positionKeys, type LoggedSet } from './sets';

export interface PreviousMatch<P extends LoggedSet = LoggedSet> {
  /** The set in the same position last time, if any. */
  prev?: P;
  /** Last time you did a drop after that set → show the D badge. */
  prevHadDrop: boolean;
}

/**
 * Index a past session's sets by position key (see positionKeys), plus which
 * non-drop positions were followed by a drop.
 */
export function indexSession<P extends LoggedSet>(sets: P[]): { byKey: Map<string, P>; dropAfter: Set<string> } {
  const ordered = orderSets(sets);
  const keys = positionKeys(ordered);
  const byKey = new Map<string, P>();
  const dropAfter = new Set<string>();
  for (const s of ordered) {
    const k = keys.get(s.id)!;
    byKey.set(k, s);
    if (s.kind === 'drop') dropAfter.add(k.split('d')[0]);
  }
  return { byKey, dropAfter };
}

/**
 * Previous column (SPEC §4): match by set position within the exercise —
 * working sets to working sets, warm-ups to warm-ups, drops to the drop that
 * followed the same parent last time.
 */
export function matchPrevious<C extends LoggedSet, P extends LoggedSet>(
  current: C[],
  previous: P[] | undefined,
): Map<string, PreviousMatch<P>> {
  const result = new Map<string, PreviousMatch<P>>();
  const ordered = orderSets(current);
  const keys = positionKeys(ordered);
  const idx = previous && previous.length ? indexSession(previous) : undefined;
  for (const s of ordered) {
    const k = keys.get(s.id)!;
    result.set(s.id, {
      prev: idx?.byKey.get(k),
      prevHadDrop: s.kind !== 'drop' && !!idx?.dropAfter.has(k),
    });
  }
  return result;
}
