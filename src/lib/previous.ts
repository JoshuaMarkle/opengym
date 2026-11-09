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

export interface PrevNextRow {
  /** Natural width of last time's set (px). */
  prev: number;
  /** Natural width of today's target, 0 when the row has none. */
  next: number;
  /** The row carries a D badge after last time's set. */
  drop: boolean;
}

export interface PrevNextFit {
  /** Width every row's "previous" gets (with its D badge), so the arrows and the targets line up. */
  prevW: number;
  /** The header's PREVIOUS fits the same width (its → lines up with the rows'). */
  headerAligned: boolean;
}

/**
 * Previous → Next in one column (4.27): line the arrows up across rows. The D badge
 * always stays after last time's set; when the column is tight the target truncates.
 */
export function fitPrevNext(rows: PrevNextRow[], avail: number, dropW: number, arrowW: number, header?: { prev: number; next: number }): PrevNextFit {
  const max = (xs: number[]) => xs.reduce((a, b) => Math.max(a, b), 0);
  const nextW = max(rows.map((r) => r.next));
  const prevW = max(rows.map((r) => r.prev + (r.drop ? dropW : 0)));
  if (!header) return { prevW, headerAligned: false };
  const hw = Math.max(prevW, header.prev);
  const headerAligned = hw + arrowW + Math.max(nextW, header.next) <= avail;
  return { prevW: headerAligned ? hw : prevW, headerAligned };
}
