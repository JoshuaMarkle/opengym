// Home "Lately" (training-logic §21, proposal D6): at most 2 quiet lines, one goal and
// one trend, and only when something changed. Priority: goal done > goal behind >
// status change to Climbing or Slipping > milestone ready. Each line shows on the day
// it first appears, then moves to Progress.

export type LatelyKind = 'goalDone' | 'goalBehind' | 'status' | 'milestone';
const RANK: Record<LatelyKind, number> = { goalDone: 0, goalBehind: 1, status: 2, milestone: 3 };
const GROUP: Record<LatelyKind, 'goal' | 'trend'> = { goalDone: 'goal', goalBehind: 'goal', status: 'trend', milestone: 'trend' };

export interface LatelyCandidate {
  /** Stable id: the same news never shows on two days. */
  key: string;
  kind: LatelyKind;
  /** Bigger first within a kind (e.g. size of the change). */
  weight?: number;
}

/** `seen` entries are "key|day" from earlier displays; `today` is a day key. */
export function pickLately<T extends LatelyCandidate>(cands: T[], seen: string[], today: string): T[] {
  const firstSeen = new Map<string, string>();
  for (const s of seen) {
    const i = s.lastIndexOf('|');
    if (i > 0 && !firstSeen.has(s.slice(0, i))) firstSeen.set(s.slice(0, i), s.slice(i + 1));
  }
  const fresh = cands.filter((c) => (firstSeen.get(c.key) ?? today) === today);
  fresh.sort((a, b) => RANK[a.kind] - RANK[b.kind] || (b.weight ?? 0) - (a.weight ?? 0));
  const out: T[] = [];
  for (const g of ['goal', 'trend'] as const) {
    const c = fresh.find((x) => GROUP[x.kind] === g);
    if (c) out.push(c);
  }
  return out.sort((a, b) => RANK[a.kind] - RANK[b.kind]);
}

/** New "key|day" entries to remember after showing `lines`, newest kept, capped. */
export function markSeen(seen: string[], lines: LatelyCandidate[], today: string, cap = 120): string[] {
  const known = new Set(seen.map((s) => s.slice(0, s.lastIndexOf('|'))));
  const add = lines.filter((l) => !known.has(l.key)).map((l) => `${l.key}|${today}`);
  return add.length ? [...seen, ...add].slice(-cap) : seen;
}
