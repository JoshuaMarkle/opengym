// Effort per set: RPE / RIR (SPEC §12, proposal A1–A6).
// Stored once as WorkoutSet.rpe (half steps); RIR is only a way of showing it
// (RIR = 10 − RPE, "5+" for RPE ≤ 5), so switching modes never loses data.

import type { KeypadKey } from './keypad';
import type { LoggedSet } from './sets';

export type EffortMode = 'off' | 'rpe' | 'rir';
/** When Next on reps goes on to the effort pad: every working set, the last one only, or never (tap the badge). */
export type EffortAsk = 'every' | 'last' | 'tap';

export const EFFORT_LABEL: Record<EffortMode, string> = { off: 'Off', rpe: 'RPE', rir: 'RIR' };

/** One key of the effort pad: its whole value in the current mode and the word under it. */
export interface PadKey {
  value: number;
  label: string;
  word: string;
}

/**
 * The six keys, in reading order (two rows of three; ½ and Clear sit on the right).
 * RPE ≤5 stores 5; RIR 5+ stores RPE 5.
 */
export const PAD_KEYS: Record<'rpe' | 'rir', PadKey[]> = {
  rpe: [
    { value: 5, label: '≤5', word: 'Easy' },
    { value: 6, label: '6', word: 'Moderate' },
    { value: 7, label: '7', word: 'Challenging' },
    { value: 8, label: '8', word: 'Hard' },
    { value: 9, label: '9', word: 'Very hard' },
    { value: 10, label: '10', word: 'Max' },
  ],
  rir: [
    { value: 0, label: '0', word: 'Failure' },
    { value: 1, label: '1', word: 'Very hard' },
    { value: 2, label: '2', word: 'Hard' },
    { value: 3, label: '3', word: 'Challenging' },
    { value: 4, label: '4', word: 'Moderate' },
    { value: 5, label: '5+', word: 'Easy' },
  ],
};

/**
 * The effort pad is laid out like the number keypad (same keys, same height), so a
 * quick thumb lands in the same place. Each digit is its own key: RIR 0–5 (5 is "5+"),
 * RPE 5–9 with 0 standing for 10 and 5 for "≤5". The rest are off: no RIR of 6 or more.
 */
export function padDigit(d: number, mode: 'rpe' | 'rir'): PadKey | undefined {
  if (mode === 'rir') return d <= 5 ? PAD_KEYS.rir.find((k) => k.value === d) : undefined;
  const v = d === 0 ? 10 : d;
  return v >= 5 ? PAD_KEYS.rpe.find((k) => k.value === v) : undefined;
}

/**
 * A key on the effort pad (or a hardware key) applied to the stored RPE, with ½ taken
 * from the value itself. The pad keeps its own sticky ½ (pressEffortPad).
 */
export function applyEffortKey(rpe: number | undefined, k: KeypadKey, mode: 'rpe' | 'rir'): number | undefined {
  return pressEffortPad({ rpe, half: padFromRpe(rpe, mode).half }, k, mode).rpe;
}

/** The effort pad's state: the stored RPE and its ½ toggle, which stays on between picks. */
export interface EffortPadState {
  rpe?: number;
  half: boolean;
}

/** The pad's whole-step range in its own units: RIR 0 (failure) to 5+, RPE ≤5 to 10. */
const STEP_RANGE = { rir: [0, 5], rpe: [5, 10] } as const;

/** The key + / − step from. Empty RIR starts at 0; empty RPE has nothing to step. */
function stepBase(rpe: number | undefined, mode: 'rpe' | 'rir'): number | undefined {
  if (rpe == null) return mode === 'rir' ? 0 : undefined;
  return padFromRpe(rpe, mode).base;
}

/** Can + / − move? Not past the ends: no + on RIR 5+ (RPE 10), no − on RIR 0 (RPE ≤5). */
export function canStep(rpe: number | undefined, dir: 'inc' | 'dec', mode: 'rpe' | 'rir'): boolean {
  const base = stepBase(rpe, mode);
  if (base == null) return false;
  const [lo, hi] = STEP_RANGE[mode];
  return dir === 'inc' ? base < hi : base > lo;
}

/**
 * A key on the effort pad. A digit picks its value (plus ½ when the toggle is on), "."
 * flips the ½ toggle (always, even on the top key, where it waits for the next pick),
 * + / − move one whole key in the pad's own units (keeping ½), backspace clears both.
 * Empty RIR takes "." as RIR ½ (a second press makes it 0, like any ½ toggle); empty RPE
 * just turns the toggle on for the next pick. Keys the pad doesn't take change nothing.
 */
export function pressEffortPad(st: EffortPadState, k: KeypadKey, mode: 'rpe' | 'rir'): EffortPadState {
  if (k.type === 'backspace') return { rpe: undefined, half: false };
  if (k.type === 'digit') {
    const key = padDigit(Number(k.d), mode);
    return key ? { ...st, rpe: rpeFromPad({ base: key.value, half: st.half }, mode) } : st;
  }
  if (k.type === 'dot') {
    if (st.rpe == null && mode === 'rir') return { half: true, rpe: rpeFromPad({ base: 0, half: true }, mode) };
    const half = !st.half;
    const base = padFromRpe(st.rpe, mode).base;
    return { half, rpe: base != null && canHalf(base, mode) ? rpeFromPad({ base, half }, mode) : st.rpe };
  }
  if (k.type === 'inc' || k.type === 'dec') {
    if (!canStep(st.rpe, k.type, mode)) return st;
    const base = stepBase(st.rpe, mode)! + (k.type === 'inc' ? 1 : -1);
    return { ...st, rpe: rpeFromPad({ base, half: st.half }, mode) };
  }
  return st;
}

/** What the pad shows as picked: a key's whole value and whether ½ is on. */
export interface PadState {
  base?: number;
  half: boolean;
}

/** ½ adds half a step in the pad's own units: RPE 8 → 8.5, RIR 1 → 1.5. Not on the top key (RPE 10, RIR 5+). */
export function canHalf(base: number | undefined, mode: 'rpe' | 'rir'): boolean {
  if (base == null) return false;
  return mode === 'rpe' ? base < 10 : base < 5;
}

export function padFromRpe(rpe: number | undefined, mode: 'rpe' | 'rir'): PadState {
  if (rpe == null) return { half: false };
  if (mode === 'rpe') {
    if (rpe <= 5) return { base: 5, half: rpe > 5 };
    return { base: Math.floor(rpe), half: rpe % 1 !== 0 };
  }
  const rir = 10 - rpe;
  if (rir >= 5) return { base: 5, half: false };
  return { base: Math.floor(rir), half: rir % 1 !== 0 };
}

export function rpeFromPad(state: PadState, mode: 'rpe' | 'rir'): number | undefined {
  if (state.base == null) return undefined;
  const v = state.base + (state.half && canHalf(state.base, mode) ? 0.5 : 0);
  return clampRpe(mode === 'rpe' ? v : 10 - v);
}

/** Whole and half steps from 1 to 10. */
export function clampRpe(v: number): number {
  return Math.min(10, Math.max(1, Math.round(v * 2) / 2));
}

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Reps left in the tank for a stored RPE (never below 0). */
export const rirOf = (rpe: number) => Math.max(0, 10 - rpe);

/** A pad key's label with ½ applied: "8.5", "1.5", or the plain label. */
export function padKeyLabel(k: PadKey, state: PadState, mode: 'rpe' | 'rir'): string {
  if (state.base === k.value && state.half && canHalf(k.value, mode)) return num(k.value + 0.5);
  return k.label;
}

/**
 * Badge on the reps box: RPE is just the number ("8", "8.5"); RIR adds R ("2R",
 * "1.5R"). `narrow` (superset rows) drops the R from halves only ("1.5").
 */
export function effortBadge(rpe: number, mode: 'rpe' | 'rir', narrow = false): string {
  if (mode === 'rpe') return rpe <= 5 ? '≤5' : num(rpe);
  const rir = rirOf(rpe);
  if (rir >= 5) return narrow ? '5+' : '5+R';
  if (narrow && rir % 1 !== 0) return num(rir);
  return `${num(rir)}R`;
}

/** In lines of sets (history, previous): "@8", "@8.5"; RIR "2 RIR", "5+ RIR". */
export function effortText(rpe: number, mode: 'rpe' | 'rir'): string {
  if (mode === 'rpe') return `@${num(rpe)}`;
  const rir = rirOf(rpe);
  return rir >= 5 ? '5+ RIR' : `${num(rir)} RIR`;
}

/** Spoken form for screen readers: "RPE 8.5", "1.5 reps in reserve". */
export function effortSpoken(rpe: number, mode: 'rpe' | 'rir'): string {
  if (mode === 'rpe') return `RPE ${num(rpe)}`;
  const rir = rirOf(rpe);
  return rir >= 5 ? '5 or more reps in reserve' : `${num(rir)} ${rir === 1 ? 'rep' : 'reps'} in reserve`;
}

/** Can this set carry an effort rating? Warm-ups, drops and cardio never do. */
export const takesEffort = (s: { kind: string }) => s.kind === 'working';

/**
 * Does Next on reps go on to the effort pad for this set? `every`: any working set;
 * `last`: only the last working set of the exercise; `tap`: never (Done on reps finishes).
 */
export function asksEffort(ask: EffortAsk, set: LoggedSet, ordered: LoggedSet[]): boolean {
  if (!takesEffort(set) || ask === 'tap') return false;
  if (ask === 'every') return true;
  const working = ordered.filter((s) => s.kind === 'working');
  return working[working.length - 1]?.id === set.id;
}

/**
 * Reps for the effort-adjusted est. 1RM: the reps done plus the reps left
 * (185 × 8 @8 counts as 10 reps to failure). Without a rating, just the reps.
 */
export function effortReps(reps: number, rpe: number | undefined): number {
  if (rpe == null) return reps;
  return reps + rirOf(rpe);
}

/** Read an RPE from an import column ("8", "8.5", "8,5"). Out of 1–10 → undefined. */
export function parseRpe(text: string | undefined): number | undefined {
  if (text == null) return undefined;
  const t = text.trim().replace(',', '.');
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 1 || n > 10) return undefined;
  return clampRpe(n);
}

export interface EasierInsight {
  weight: number;
  reps: number;
  /** The harder, older rating and the newest one. */
  fromRpe: number;
  toRpe: number;
  /** When it was the harder rating. */
  since: number;
}

/**
 * "Same weight, easier" (A6): the newest session's rated working sets, matched to an
 * older session (within `windowDays`) with the same weight and at least as many reps
 * but a higher RPE. Picks the biggest drop in effort, then the heaviest weight.
 */
export function sameWeightEasier(
  sessions: { date: number; sets: LoggedSet[] }[],
  windowDays = 56,
): EasierInsight | null {
  const sorted = [...sessions].sort((a, b) => b.date - a.date);
  const latest = sorted[0];
  if (!latest) return null;
  const rated = (sets: LoggedSet[]) => sets.filter((s) => s.kind === 'working' && s.completed !== false && s.rpe != null && (s.reps ?? 0) > 0 && s.weight != null);
  const now = rated(latest.sets);
  if (!now.length) return null;
  const from = latest.date - windowDays * 86_400_000;
  let best: EasierInsight | null = null;
  for (const old of sorted.slice(1)) {
    if (old.date < from) break;
    for (const o of rated(old.sets)) {
      for (const n of now) {
        if (n.weight !== o.weight || n.reps! < o.reps! || n.rpe! >= o.rpe!) continue;
        const drop = o.rpe! - n.rpe!;
        const cur = best ? best.fromRpe - best.toRpe : 0;
        // Bigger drop wins; on a tie, the heavier weight, then the older (longer trend) session.
        if (!best || drop > cur || (drop === cur && (n.weight! > best.weight || (n.weight === best.weight && old.date < best.since)))) {
          best = { weight: n.weight!, reps: n.reps!, fromRpe: o.rpe!, toRpe: n.rpe!, since: old.date };
        }
      }
    }
  }
  return best;
}

/** The feels-like table (A5): RPE, RIR and how it feels. */
export const EFFORT_SCALE: { rpe: string; rir: string; feels: string }[] = [
  { rpe: '10', rir: '0', feels: 'Max · 0 more' },
  { rpe: '9.5', rir: '0–1', feels: 'Very hard · maybe 1' },
  { rpe: '9', rir: '1', feels: 'Very hard · 1 more' },
  { rpe: '8', rir: '2', feels: 'Hard · 2 more' },
  { rpe: '7', rir: '3', feels: 'Challenging · 3 more' },
  { rpe: '6', rir: '4+', feels: 'Moderate · 4+ more' },
];

/** Does est. 1RM count reps in reserve? Only while effort is on and the setting is. */
export const effortIn1rm = (s: { effort: EffortMode; effortIn1rm: boolean }) => s.effort !== 'off' && s.effortIn1rm;
