// Goal tracking (training-logic §18 "On track or behind") and milestones (§19).

import type { Equipment, ExerciseType, Units } from '../../db/types';
import { LB_PER_KG } from '../units';
import { WEEK } from './constants';
import { e1, wAt } from './math';
import { etaWeeks, goalTarget, project, verdict, type Verdict } from './project';

export interface GoalLike {
  weight: number;
  reps: number;
  /** Deadline (epoch ms); unset = no date, an estimate is shown instead. */
  by?: number;
  startE1rm: number;
  startedAt: number;
  /** The rate (per week) and τ the expected curve used when the goal was set. */
  startRate: number;
  startTau: number;
  doneAt?: number;
  /** Target in the lift's strength unit when it isn't est. 1RM (bodyweight goals count reps). */
  targetValue?: number;
}

export interface TrendNow {
  E0: number;
  r0: number;
  tau: number;
  /** Projection is trustworthy (§17); otherwise verdicts and estimates are withheld. */
  canProject: boolean;
}

export interface GoalState {
  target: number;
  done: boolean;
  /** Verdict for the deadline (or READY). */
  verdict?: Verdict;
  /** No-date estimate in weeks from now; null = not moving toward it yet. */
  eta: number | null;
  /** "Should be here" today on the curve stored when the goal was set. */
  tick: number;
  ahead: boolean;
  behind: boolean;
  /** Weeks left until the deadline. */
  weeksLeft?: number;
  /** 0–1 from the start value to the target. */
  progress: number;
  tickProgress: number;
}

/**
 * Where a goal stands today. `before` is the same trend two weeks ago: a goal is
 * behind only after 2 weeks below the tick while the deadline isn't Likely.
 */
export function goalState(goal: GoalLike, now: number, t: TrendNow, before?: TrendNow): GoalState {
  const target = goal.targetValue ?? goalTarget(goal.weight, goal.reps);
  const tickAt = (at: number) => project(goal.startE1rm, goal.startRate, goal.startTau, (at - goal.startedAt) / WEEK);
  const tick = tickAt(now);
  const weeksLeft = goal.by != null ? Math.max(0, (goal.by - now) / WEEK) : undefined;
  const v = goal.by != null && t.canProject ? verdict(t.E0, t.r0, t.tau, target, weeksLeft!) : t.E0 >= target ? 'ready' : undefined;
  const eta = t.canProject ? etaWeeks(t.E0, t.r0, t.tau, target) : null;
  const ahead = t.E0 >= tick;
  const wasBelow = before ? before.E0 < tickAt(now - 2 * WEEK) : false;
  const behind = !goal.doneAt && !ahead && wasBelow && v !== 'likely' && v !== 'ready';
  const span = target - goal.startE1rm || 1;
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  return {
    target,
    done: !!goal.doneAt,
    verdict: v,
    eta,
    tick,
    ahead,
    behind,
    weeksLeft,
    progress: clamp((t.E0 - goal.startE1rm) / span),
    tickProgress: clamp((tick - goal.startE1rm) / span),
  };
}

/** C5 "Lower to …": the heaviest weight for the same reps the curve expects by the deadline, rounded down. */
export function likelyWeight(t: TrendNow, reps: number, weeks: number, step: number): number {
  const exp = project(t.E0, t.r0, t.tau, weeks);
  return Math.floor(wAt(exp, reps, 0) / step + 1e-9) * step;
}

/** Done = any logged set with weight ≥ the goal weight and reps ≥ the goal reps. */
export function meetsGoal(set: { weight?: number; reps?: number }, goal: { weight: number; reps: number }): boolean {
  return (set.weight ?? 0) >= goal.weight - 1e-9 && (set.reps ?? 0) >= goal.reps;
}

// ───────────────────────────── milestones (§19)

export interface Milestone {
  /** lb; undefined for bodyweight (reps only). */
  weight?: number;
  reps: number;
  /** Target est. 1RM (RIR 0); reps for bodyweight. */
  target: number;
}

const kg = (n: number) => n * LB_PER_KG;
const range = (from: number, to: number, step: number) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

/** The round numbers lifters count in, by equipment (§19). `current` is the latest weight (assisted). */
export function milestoneList(type: ExerciseType, equipment: Equipment, units: Units, current?: number): Milestone[] {
  const metric = units === 'kg';
  const make = (weights: number[], reps: number[]) => weights.flatMap((w) => reps.map((r) => ({ weight: w, reps: r, target: e1(w, r, 0) })));
  let list: Milestone[];
  if (type === 'bodyweight') return [5, 10, 15, 20, 25, 30].map((r) => ({ reps: r, target: r }));
  if (type === 'assisted') {
    const now = Math.min(0, current ?? 0);
    const half = Math.round(now / 2 / 5) * 5;
    return [...new Set([half, 0])].filter((w) => w > now).map((w) => ({ weight: w, reps: 5, target: w }));
  }
  if (type === 'bodyweight_plus') list = make(metric ? range(10, 60, 10).map(kg) : range(25, 125, 20), [5]);
  else if (equipment === 'barbell') list = make(metric ? range(60, 200, 20).map(kg) : [135, 185, 225, 275, 315, 365, 405, 455, 495], [1, 5, 10]);
  else if (equipment === 'dumbbell') list = make(metric ? range(15, 70, 5).map(kg) : range(30, 150, 10), [5, 10]);
  else list = make(metric ? range(25, 300, 25).map(kg) : range(50, 600, 50), [10]);
  return list.sort((a, b) => a.target - b.target);
}

export type MilestoneState = 'done' | 'ready' | 'eta' | 'none';
export interface MilestoneRow extends Milestone {
  state: MilestoneState;
  /** Done: when. */
  date?: number;
  /** ~eta in weeks (state 'eta'). */
  weeks?: number;
}

/**
 * The last 2 achieved and the next 3 (§19). done = a logged set met it; ready = the
 * trend is 2% past its est. 1RM; otherwise a no-date estimate, or none.
 */
export function milestoneRows(
  list: Milestone[],
  sets: { weight?: number; reps: number; date: number }[],
  t: TrendNow | undefined,
): MilestoneRow[] {
  const rows: MilestoneRow[] = list.map((m) => {
    const hit = sets.filter((s) => (m.weight == null ? s.reps >= m.reps : meetsGoal(s, { weight: m.weight, reps: m.reps }))).sort((a, b) => a.date - b.date)[0];
    if (hit) return { ...m, state: 'done', date: hit.date };
    if (t && t.E0 >= 1.02 * m.target) return { ...m, state: 'ready' };
    const w = t && t.canProject ? etaWeeks(t.E0, t.r0, t.tau, m.target) : null;
    return w != null ? { ...m, state: 'eta', weeks: w } : { ...m, state: 'none' };
  });
  const done = rows.filter((r) => r.state === 'done');
  // Several "ready" at once: the lower ones are already behind you, so only the highest stays.
  const lastReady = rows.map((r) => r.state).lastIndexOf('ready');
  const open = rows.filter((r, i) => r.state !== 'done' && (r.state !== 'ready' || i === lastReady));
  return [...done.slice(-2), ...open.slice(0, 3)];
}

/**
 * The goal that is this milestone (same weight × reps; reps only for bodyweight), so the
 * milestone row links to it instead of offering a duplicate. Open goals win over done ones.
 * Weights compare within 0.5 lb: a kg goal goes through a unit conversion.
 */
export function goalForMilestone<G extends { weight: number; reps: number; doneAt?: number; deletedAt?: number }>(
  m: Pick<Milestone, 'weight' | 'reps'>,
  goals: G[],
): G | undefined {
  const same = goals.filter((g) => !g.deletedAt && g.reps === m.reps && (m.weight == null || Math.abs(g.weight - m.weight) < 0.5));
  return same.find((g) => !g.doneAt) ?? same[0];
}
