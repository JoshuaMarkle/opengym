// Training, wired to the log (design/training-logic.html). The rules are pure functions in
// src/lib/training; this file feeds them history, settings and today's sets. Nothing here is
// stored: statuses, projections and suggestions are worked out on the fly (§10 "nothing is cached").

import type { Exercise, Settings, WorkoutExercise, WorkoutSet } from '../db/types';
import { COMPOUND_IDS } from '../db/seedExercises';
import { DAY_MS } from '../lib/dates';
import {
  BREAK_DAYS,
  canProject,
  comeback,
  comebackPct,
  currentRate,
  inferRange,
  pace,
  priorPace,
  RAMP_SESSIONS,
  sessionStrength,
  shownStatus,
  stepFor,
  suggest,
  TAU_WEEKS,
  tipFor,
  workingSets,
  type Experience,
  type LiftCategory,
  type PhaseKind,
  type ProjectionFit,
  type RepRange,
  type StrengthPoint,
  type Suggestion,
  type TipId,
  type TipSession,
  type TrendNow,
  type TrendResult,
  type TSet,
} from '../lib/training';
import type { HistoryIndex, HistorySession } from './history';
import { stepLb } from './settings';

// ───────────────────────────── settings

/** The phase in force now: Building unless a phase is set and hasn't ended (§20). */
export function currentPhase(settings: Settings, now = Date.now()): PhaseKind {
  const p = settings.phase;
  if (!p || (p.until != null && p.until < now)) return 'build';
  return p.kind;
}

/** §14: the setup answer, else the span of the log (an import counts fully), else "some". */
export function experienceOf(settings: Settings, history: HistoryIndex): Experience {
  if (settings.experience) return settings.experience;
  const first = history.firstDate;
  const years = first ? (Date.now() - first) / (365 * DAY_MS) : 0;
  return years >= 3 ? 'lots' : 'some';
}

export function liftCategory(ex: Exercise): LiftCategory {
  if (ex.type === 'bodyweight') return 'bodyweight';
  if (ex.isCustom) return 'compound';
  if (!COMPOUND_IDS.has(ex.id)) return 'isolation';
  return ex.equipment === 'barbell' ? 'barbellCompound' : 'compound';
}

/** Lifts that can be trained: anything but cardio. */
export const isLift = (ex: Exercise | undefined): ex is Exercise => !!ex && ex.type !== 'cardio';

// ───────────────────────────── one lift over time

/** Sessions oldest first, before `before` when given. */
function sessionsOf(history: HistoryIndex, exerciseId: string, before?: number): HistorySession[] {
  const list = history.sessionsByExercise.get(exerciseId) ?? [];
  return [...(before === undefined ? list : list.filter((s) => s.date < before))].reverse();
}

/**
 * The strength series (§13): set 1's effort-adjusted est. 1RM per session. A session
 * answered "I took a break" and the ramp after it are marked as comebacks (§11).
 */
export function liftSeries(history: HistoryIndex, ex: Exercise, before?: number): StrengthPoint[] {
  const out: StrengthPoint[] = [];
  let rampLeft = 0;
  for (const s of sessionsOf(history, ex.id, before)) {
    if (s.gapAnswer === 'break') rampLeft = RAMP_SESSIONS;
    const v = sessionStrength(workingSets(s.sets), ex.type);
    const comebackSession = rampLeft > 0;
    if (rampLeft > 0) rampLeft--;
    if (v === undefined) continue;
    out.push({ date: s.date, value: v, ...(comebackSession ? { comeback: true } : {}) });
  }
  return out;
}

export interface LiftTraining {
  exercise: Exercise;
  points: StrengthPoint[];
  /** %/month, blended with the prior (§14). */
  pace: number;
  prior: number;
  trend: TrendResult;
  fit: ProjectionFit;
  /** For projections: current value, rate per week, τ. */
  now: TrendNow;
  lastDate?: number;
  sessions: number;
}

/** Everything Progress shows for one lift, as of `at` (default now). */
export function liftTraining(history: HistoryIndex, ex: Exercise, settings: Settings, at?: number): LiftTraining {
  const points = liftSeries(history, ex, at);
  const exp = experienceOf(settings, history);
  const cat = liftCategory(ex);
  let prior = priorPace(cat, exp);
  if (cat === 'bodyweight') {
    // Reps per month → % of the lift's typical reps.
    const typical = points.length ? points[points.length - 1].value : 10;
    prior = (prior / Math.max(1, typical)) * 100;
  }
  const p = pace(points, prior);
  const trend = shownStatus(points, p, currentPhase(settings, at));
  const fit = canProject(points);
  const tau = TAU_WEEKS[exp];
  const E0 = fit.n ? fit.E0 : (points[points.length - 1]?.value ?? 0);
  return {
    exercise: ex,
    points,
    pace: p,
    prior,
    trend,
    fit,
    now: { E0, r0: fit.n ? currentRate(fit, p) : 0, tau, canProject: fit.ok },
    lastDate: points[points.length - 1]?.date,
    sessions: points.length,
  };
}

// ───────────────────────────── in the workout (§7–§11)

export type WorkoutTraining =
  | { kind: 'none' }
  /** 21+ days since this lift: break or missed logs? (§11) */
  | { kind: 'gap'; days: number; lastDate: number; lastWeight?: number; start?: number; pct: number }
  | {
      kind: 'ready';
      sg: Suggestion;
      /** Today's working set ids, in order (perSet lines up with these). */
      setIds: string[];
      step: number;
      /** Comeback ramp in force: session 1–4 of it. */
      comeback?: { days: number; pct: number; ramp: number[]; index: number };
      /** Dismissed twice in a row with the same weights: hints only (§9). */
      hideBar: boolean;
      /** Auto changed 2+ boxes in each of the last 3 sessions (§9). */
      autoMisses: boolean;
      last: HistorySession;
    };

const rangeOf = (s: { repsMin?: number; repsMax?: number } | undefined): RepRange | undefined => {
  if (!s) return undefined;
  const min = s.repsMin ?? s.repsMax;
  const max = s.repsMax ?? s.repsMin;
  return min != null && max != null ? { min, max } : undefined;
};

const sameWeights = (a: number[] | undefined, b: (number | undefined)[]) => !!a && a.length === b.length && a.every((w, i) => Math.abs(w - (b[i] ?? NaN)) < 0.01);

export interface TodayExercise {
  we: WorkoutExercise;
  exercise: Exercise;
  sets: WorkoutSet[];
}

/** Last session's ranges per working position, for sessions logged with a routine. */
function lastRanges(sets: WorkoutSet[]): (RepRange | undefined)[] {
  return sets.filter((s) => s.kind === 'working').map(rangeOf);
}

/** What the workout screen shows for one exercise today (§9–§11). */
export function workoutTraining(m: TodayExercise, history: HistoryIndex, settings: Settings, at: number): WorkoutTraining {
  const ex = m.exercise;
  if (ex.type === 'cardio' || settings.suggestMode === 'off') return { kind: 'none' };
  const past = (history.sessionsByExercise.get(ex.id) ?? []).filter((s) => s.date < at); // newest first
  const last = past[0];
  if (!last) return { kind: 'none' };
  const lastSets = workingSets(last.sets);
  const today = m.sets.filter((s) => s.kind === 'working');
  if (!lastSets.length || !today.length) return { kind: 'none' };

  const step = stepFor(
    ex.equipment,
    ex.type,
    stepLb(settings),
    settings.units,
    past
      .slice(0, 12)
      .map((s) => workingSets(s.sets)[0]?.weight)
      .filter((w): w is number => w != null)
      .reverse(),
  );
  const days = (at - last.date) / DAY_MS;
  const phase = currentPhase(settings, at);
  const weighted = ex.type !== 'bodyweight';

  // §11: a gap is always a question, unless you said you're coming back.
  const breakNow = m.we.gapAnswer === 'break' || (phase === 'return' && days >= BREAK_DAYS && m.we.gapAnswer !== 'notLogged');
  if (days >= BREAK_DAYS && !m.we.gapAnswer && phase !== 'return') {
    const ramp = weighted ? comeback(lastSets[0].weight, days, step) : null;
    return { kind: 'gap', days: Math.round(days), lastDate: last.date, lastWeight: weighted ? lastSets[0].weight : undefined, start: ramp?.[0], pct: comebackPct(days) };
  }

  const prevRanges = lastRanges(last.sets);
  const sg = suggest({
    type: ex.type,
    last: lastSets,
    ranges: today.map((s, i) => rangeOf(s) ?? prevRanges[i]),
    inferred: inferRange(past.slice(0, 5).map((s) => workingSets(s.sets)[0]?.reps).filter((r): r is number => r != null)),
    step,
    target: settings.effortTarget,
    lastSetOnly: settings.failureLastSetOnly,
    phase,
  });
  if (!sg) return { kind: 'none' };

  // The comeback ramp (§11): session 1 is the one after the break, then 3 more back to the old weight.
  let cb: { days: number; pct: number; ramp: number[]; index: number } | undefined;
  if (weighted && breakNow) {
    const ramp = comeback(lastSets[0].weight, days, step);
    if (ramp) cb = { days: Math.round(days), pct: comebackPct(days), ramp, index: 0 };
  } else if (weighted) {
    const k = past.slice(0, RAMP_SESSIONS).findIndex((s) => s.gapAnswer === 'break');
    const before = k >= 0 ? past[k + 1] : undefined;
    const base = before ? workingSets(before.sets)[0] : undefined;
    if (k >= 0 && base) {
      const gap = (past[k].date - before!.date) / DAY_MS;
      const ramp = comeback(base.weight, gap, step);
      if (ramp && k + 1 < ramp.length) cb = { days: Math.round(gap), pct: comebackPct(gap), ramp, index: k + 1 };
    }
  }
  if (cb) applyRamp(sg, cb.ramp[cb.index]);

  const dismissed = past.slice(0, 2);
  const hideBar = dismissed.length === 2 && dismissed.every((s) => s.suggestion?.outcome === 'dismissed') && sameWeights(dismissed[0].suggestion?.weights, sg.weights);
  const autoMisses = past.length >= 3 && past.slice(0, 3).every((s) => s.suggestion?.auto && s.suggestion.outcome === 'edited');
  return { kind: 'ready', sg, setIds: today.map((s) => s.id), step, comeback: cb, hideBar, autoMisses, last };
}

/** During the ramp the normal rules pause, except a set that would come down further keeps that (§11). */
function applyRamp(sg: Suggestion, w: number) {
  sg.weights = sg.weights.map((x, i) => (x != null && sg.moves[i] === 'down' && x < w ? x : w));
  sg.moves = sg.weights.map((x, i) => {
    const prev = sg.last[i]?.weight ?? 0;
    return x! > prev + 1e-9 ? 'up' : x! < prev - 1e-9 ? 'down' : 'keep';
  });
  sg.aims = sg.aims.map(() => null);
  sg.changed = sg.moves.some((m) => m !== 'keep');
  sg.lead = sg.moves[0];
}

/** Next weights to write into LBS: unticked working sets only, by set id (§9). */
export function weightsBySet(t: Extract<WorkoutTraining, { kind: 'ready' }>, sets: WorkoutSet[]): Record<string, number> {
  const out: Record<string, number> = {};
  t.setIds.forEach((id, i) => {
    const w = t.sg.weights[i];
    const s = sets.find((x) => x.id === id);
    if (w != null && s && !s.completed) out[id] = w;
  });
  return out;
}

// ───────────────────────────── tips (§23)

export function tipForExercise(history: HistoryIndex, ex: Exercise, settings: Settings, at: number): TipId | null {
  if (ex.type === 'cardio' || settings.suggestMode === 'off') return null;
  const past = (history.sessionsByExercise.get(ex.id) ?? []).filter((s) => s.date < at).slice(0, 5);
  const sessions: TipSession[] = past.map((s) => {
    const sets = workingSets(s.sets);
    const ranges = lastRanges(s.sets);
    const next = sets.length && ex.type === 'weight' ? suggest({ type: ex.type, last: sets, ranges, step: 5, target: settings.effortTarget, lastSetOnly: settings.failureLastSetOnly }) : null;
    return { date: s.date, sets, next: next && next.mode === 'fit' ? { weights: next.weights as number[], lead: next.lead } : undefined };
  });
  return tipFor(sessions, { effortOn: settings.effort !== 'off', target: settings.effortTarget, dismissed: settings.dismissedTips, now: at });
}

// ───────────────────────────── helpers for screens

/** Last time's working sets of an exercise, as training sets (Why sheet lines). */
export function sessionSets(s: HistorySession): TSet[] {
  return workingSets(s.sets);
}

/** Lifts with any session in the last `days` (trend lists hide lifts dropped from the routine, §16). */
export function recentLifts(history: HistoryIndex, exerciseMap: Map<string, Exercise>, days = 56, now = Date.now()): Exercise[] {
  const out: Exercise[] = [];
  for (const [id, list] of history.sessionsByExercise) {
    const ex = exerciseMap.get(id);
    if (!isLift(ex) || ex.deletedAt || !list.length) continue;
    if (list[0].date >= now - days * DAY_MS) out.push(ex);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
