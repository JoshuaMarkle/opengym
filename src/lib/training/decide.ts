// The fit zone and the set-by-set decision (training-logic §6–§8).
// Mirrors decide_fit() in design/training-logic-reference.py; §8's 24 example rows are the tests.

import { LAST_SET_ONLY_SHIFT, MATCH_PENALTY, TARGET_RIR, UNKNOWN_RIR } from './constants';
import { e1, repsAt, round2, roundHalfEven, roundTo, wAt } from './math';

/** One working set from last time. `rir` undefined = effort not logged. */
export interface TSet {
  weight: number;
  reps: number;
  rir?: number;
}

export interface RepRange {
  min: number;
  max: number;
}

export type Target = [number, number];
export type Move = 'up' | 'keep' | 'down';
export type FitKind = 'top' | 'keep' | 'move';

export interface Fit {
  /** Strength estimate of the set (Epley with RIR). */
  E: number;
  /** Lightest and heaviest weight that land in the range at the target effort. */
  zone: [number, number];
  /** This set's own next weight (rules 1–3). */
  ideal: number;
  kind: FitKind;
  /** Predicted reps at `ideal`. */
  pred: number;
  /** Step-aligned weights this set can share with others. */
  allowed: [number, number];
  flag: '' | 'big step' | 'between steps';
  known: boolean;
}

export interface SetCall {
  weight: number;
  move: Move;
  /** Expected reps at the new weight, or a +1 rep hint when the weight stays. */
  aim: number | null;
  pred: number;
}

export interface Decision {
  fits: Fit[];
  /** Each set's own weight before matching. */
  indep: number[];
  /** After matching (rule 4). */
  matched: number[];
  out: SetCall[];
  targets: Target[];
}

/** Per-set effort targets: with "last set only", earlier sets aim one rep further from failure (§4). */
export function targetsFor(n: number, target: Target = TARGET_RIR, lastSetOnly = false): Target[] {
  const [lo, hi] = target;
  const s = LAST_SET_ONLY_SHIFT;
  return Array.from({ length: n }, (_, j) => (lastSetOnly && j < n - 1 ? [lo + s, hi + s] : [lo, hi]));
}

/** One set on its own: strength, fit zone in lb, ideal next weight (§6, §7 rules 1–3). */
export function fitSet(set: TSet, range: RepRange, step: number, t: Target): Fit {
  const { weight: w, reps: r } = set;
  const { min: lo, max: hi } = range;
  const [tl, th] = t;
  const known = set.rir != null;
  const i = known ? set.rir! : UNKNOWN_RIR;
  const E = e1(w, r, i);
  const zone: [number, number] = [wAt(E, hi, th), wAt(E, lo, tl)];
  const midR = (lo + hi) / 2;
  const midI = (tl + th) / 2;
  const inZone = lo <= r && r <= hi && (!known || (tl <= i && i <= th));
  const topOut = r >= hi && (!known || i <= th);
  let nw: number;
  let kind: FitKind;
  if (topOut) {
    nw = w + step;
    while (nw < zone[0] - 1e-9) nw += step;
    kind = 'top';
  } else if (inZone) {
    nw = w;
    kind = 'keep';
  } else {
    nw = roundTo(wAt(E, midR, midI), step);
    const a = Math.ceil(zone[0] / step - 1e-9) * step;
    const b = Math.floor(zone[1] / step + 1e-9) * step;
    if (a <= b) nw = Math.min(Math.max(nw, a), b);
    kind = 'move';
  }
  nw = round2(nw);
  const pred = nw === w ? r : repsAt(E, nw, midI);
  const loOk = Math.ceil(zone[0] / step - 1e-9) * step;
  let allowed: [number, number] = [Math.min(nw, loOk), Math.max(nw, Math.floor(zone[1] / step + 1e-9) * step)];
  if (kind === 'top') allowed = [nw, Math.max(nw, allowed[1])];
  const flag = nw !== w && pred < lo - 0.5 ? 'big step' : loOk > zone[1] + 1e-9 ? 'between steps' : '';
  return { E, zone, ideal: nw, kind, pred, allowed, flag, known };
}

function groupWeight(members: number[], fits: Fit[], step: number): number | null {
  const a = Math.max(...members.map((j) => fits[j].allowed[0]));
  const b = Math.min(...members.map((j) => fits[j].allowed[1]));
  if (a > b + 1e-9) return null;
  const m = members.reduce((s, j) => s + fits[j].ideal, 0) / members.length;
  return round2(Math.min(Math.max(roundTo(m, step), a), b));
}

/** Set 1 leads: it keeps its own weight. Patterns in order of preference (§7 rule 4). */
function patterns(n: number): number[][][] {
  if (n === 1) return [[[0]]];
  const all = Array.from({ length: n }, (_, j) => j);
  const ps: number[][][] = [[all], [[0], all.slice(1)]];
  if (n > 2) ps.push([all.slice(0, n - 1), [n - 1]]);
  ps.push(all.map((j) => [j]));
  return ps;
}

/**
 * Decide next weights set by set (§7). `ranges` is per set (pyramids use their own range).
 * Later sets are never heavier than earlier ones; a shared weight must suit every member.
 */
export function decide(sets: TSet[], ranges: RepRange[], step: number, target: Target = TARGET_RIR, lastSetOnly = false, match = true): Decision {
  const n = sets.length;
  const ts = targetsFor(n, target, lastSetOnly);
  const fits = sets.map((s, j) => fitSet(s, ranges[j], step, ts[j]));
  const indep = fits.map((f) => f.ideal);
  let best = indep;
  let bestCost: number | null = null;
  if (match) {
    for (const p of patterns(n)) {
      const ws: number[] = new Array(n);
      let ok = true;
      for (const g of p) {
        let gw: number | null;
        if (g.includes(0)) {
          gw = indep[0];
          if (g.some((j) => !(fits[j].allowed[0] - 1e-9 <= gw! && gw! <= fits[j].allowed[1] + 1e-9))) gw = null;
        } else gw = groupWeight(g, fits, step);
        if (gw == null) {
          ok = false;
          break;
        }
        for (const j of g) ws[j] = gw;
      }
      if (!ok) continue;
      if (ws.some((w, j) => j > 0 && w > ws[j - 1] + 1e-9)) continue;
      const cost = ws.reduce((c, w, j) => c + Math.abs(w - indep[j]) / step, 0) + MATCH_PENALTY * (p.length - 1);
      if (bestCost == null || cost < bestCost - 1e-9) {
        best = ws;
        bestCost = cost;
      }
    }
  }
  const out = sets.map((s, j): SetCall => {
    const f = fits[j];
    const { min: lo, max: hi } = ranges[j];
    const nw = best[j];
    const midI = (ts[j][0] + ts[j][1]) / 2;
    let pred = repsAt(f.E, nw, midI);
    let aim: number | null;
    if (nw !== s.weight || f.kind !== 'keep') aim = Math.max(lo, Math.min(hi, roundHalfEven(pred)));
    else {
      pred = s.reps;
      aim = s.reps < hi && (s.rir == null || s.rir > ts[j][0]) ? Math.min(hi, s.reps + 1) : null;
    }
    const move: Move = nw > s.weight + 1e-9 ? 'up' : nw < s.weight - 1e-9 ? 'down' : 'keep';
    return { weight: nw, move, aim, pred };
  });
  return { fits, indep, matched: best, out, targets: ts };
}
