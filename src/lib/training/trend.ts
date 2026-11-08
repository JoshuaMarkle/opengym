// Trend status and per-lift pace (training-logic §14, §15).

import {
  CLIMB_MIN_PCT,
  DAY,
  MIN_SESSIONS,
  MIN_SPAN_DAYS,
  MONTH_DAYS,
  PRIOR_WEIGHT_SESSIONS,
  PROJ_WINDOW_DAYS,
  SLIP_MIN_PCT,
  SLIP_NOISE_MULT,
  SLOW_LIFT_PCT_MO,
  WINDOW_DAYS,
} from './constants';
import { mad, median, theilSen } from './math';
import type { StrengthPoint } from './strength';
import type { PhaseKind } from './suggest';

export type Status = 'climbing' | 'holding' | 'steady' | 'slipping' | 'maintained' | 'notSure';
export type Experience = 'new' | 'some' | 'lots';
export type LiftCategory = 'barbellCompound' | 'compound' | 'isolation' | 'bodyweight';

export const STATUS_LABEL: Record<Status, string> = {
  climbing: 'Climbing',
  holding: 'Holding',
  steady: 'Steady',
  slipping: 'Slipping',
  maintained: 'Maintained',
  notSure: 'Not sure yet',
};

export interface TrendResult {
  status: Status;
  /** Sessions in the window. */
  n: number;
  /** Sessions still needed for a status (Not sure yet). */
  needs?: number;
  /** % change over the window, from the Theil–Sen slope. */
  change?: number;
  /** Robust day-to-day noise, %. */
  wobble?: number;
  /** Of the last 5 sessions, how many sat below the window median. */
  below?: number;
  /** Fitted value per day. */
  slope?: number;
  median?: number;
  /** Window points used (comebacks removed). */
  points: StrengthPoint[];
}

/** Points in the last `days` before the newest point, comeback sessions removed. */
export function inWindow(points: StrengthPoint[], days: number): StrengthPoint[] {
  const pts = points.filter((p) => !p.comeback);
  if (!pts.length) return [];
  const end = pts[pts.length - 1].date;
  return pts.filter((p) => p.date >= end - days * DAY);
}

const dayOf = (t: number) => t / DAY;

/** §15: one status per lift from the last 8 weeks, compared with its own noise and pace. */
export function trendStatus(points: StrengthPoint[], pacePctMo: number, phase: PhaseKind = 'build'): TrendResult {
  const pts = inWindow(points, WINDOW_DAYS);
  const n = pts.length;
  const span = n ? dayOf(pts[n - 1].date - pts[0].date) : 0;
  if (n < MIN_SESSIONS || span < MIN_SPAN_DAYS) return { status: 'notSure', n, needs: Math.max(1, MIN_SESSIONS - n), points: pts };
  const xs = pts.map((p) => dayOf(p.date));
  const ys = pts.map((p) => p.value);
  const { slope, intercept } = theilSen(xs, ys);
  const med = median(ys);
  const scale = Math.abs(med) || 1;
  const wobble = (mad(xs.map((x, i) => ys[i] - (slope * x + intercept))) / scale) * 100;
  // Divided by |median| so assisted (negative) weights read "up" when the assist shrinks.
  const change = ((slope * WINDOW_DAYS) / scale) * 100;
  const below = ys.slice(-5).filter((y) => y < med).length;
  const climbT = Math.max(CLIMB_MIN_PCT, wobble);
  const slipT = Math.max(SLIP_MIN_PCT, SLIP_NOISE_MULT * wobble) * (phase === 'maintain' ? 5 / 3 : 1);
  let status: Status;
  if (change >= climbT) status = 'climbing';
  else if (change <= -slipT && below >= 3) status = 'slipping';
  else if (pacePctMo < SLOW_LIFT_PCT_MO) status = 'steady';
  else status = 'holding';
  if (phase === 'maintain' && (status === 'holding' || status === 'steady')) status = 'maintained';
  return { status, n, change, wobble, below, slope, median: med, points: pts };
}

/**
 * Hysteresis (§15): a new status has to come out of two evaluations in a row
 * (with and without the newest session) before it's shown.
 */
export function shownStatus(points: StrengthPoint[], pacePctMo: number, phase: PhaseKind = 'build'): TrendResult {
  const now = trendStatus(points, pacePctMo, phase);
  if (points.length < 2 || now.status === 'notSure') return now;
  const before = trendStatus(points.slice(0, -1), pacePctMo, phase);
  if (before.status === 'notSure' || before.status === now.status) return now;
  // Keep showing the earlier reading as a whole, so the numbers match the label.
  return before;
}

// ───────────────────────────── pace (§14)

/** Prior gain, % of est. 1RM per month (bodyweight: reps per month). */
const PRIOR: Record<Experience, Record<LiftCategory, number>> = {
  new: { barbellCompound: 4.0, compound: 3.0, isolation: 2.0, bodyweight: 1.0 },
  some: { barbellCompound: 1.5, compound: 1.2, isolation: 0.7, bodyweight: 0.5 },
  lots: { barbellCompound: 0.6, compound: 0.5, isolation: 0.25, bodyweight: 0.2 },
};
export const TAU_WEEKS: Record<Experience, number> = { new: 39, some: 78, lots: 156 };

export function priorPace(category: LiftCategory, experience: Experience): number {
  return PRIOR[experience][category];
}

/** The lift's own rate (Theil–Sen over 12 weeks) as %/month, and the sessions behind it. */
export function ownPace(points: StrengthPoint[]): { pct: number; n: number } | undefined {
  const pts = inWindow(points, PROJ_WINDOW_DAYS);
  if (pts.length < 2) return undefined;
  const xs = pts.map((p) => dayOf(p.date));
  const ys = pts.map((p) => p.value);
  const { slope } = theilSen(xs, ys);
  const med = Math.abs(median(ys)) || 1;
  return { pct: ((slope * MONTH_DAYS) / med) * 100, n: pts.length };
}

/**
 * pace = (n · own + 8 · prior) / (n + 8). `priorPct` for bodyweight is converted from
 * reps/month by the caller. A lift under 0.5 %/month is a slow lift (Steady, not Holding).
 */
export function pace(points: StrengthPoint[], priorPct: number): number {
  const own = ownPace(points);
  if (!own) return priorPct;
  return (own.n * own.pct + PRIOR_WEIGHT_SESSIONS * priorPct) / (own.n + PRIOR_WEIGHT_SESSIONS);
}

export const isSlowLift = (pacePctMo: number) => pacePctMo < SLOW_LIFT_PCT_MO;

// ───────────────────────────── what changed (D3)

export interface WhatChanged {
  /** Sessions a week: the 4 weeks before vs the last 4. */
  perWeek: [number, number];
  /** Working sets per session, same halves. */
  setsPer: [number, number];
  /** Longest stretch without this lift in the 8 weeks, days. */
  longestGap?: { days: number; from: number; to: number };
}

/**
 * Facts from the log only (how often, how many sets, gaps), for a slipping lift.
 * Never guesses about sleep or diet. `sessions` oldest first.
 */
export function whatChanged(sessions: { date: number; sets: number }[], now: number): WhatChanged {
  const half = 28 * DAY;
  const a = sessions.filter((s) => s.date >= now - 2 * half && s.date < now - half);
  const b = sessions.filter((s) => s.date >= now - half && s.date <= now);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((x, y) => x + y, 0) / xs.length : 0);
  const r1 = (x: number) => Math.round(x * 10) / 10;
  let longestGap: WhatChanged['longestGap'];
  const win = [...a, ...b];
  for (let i = 1; i < win.length; i++) {
    const days = Math.round((win[i].date - win[i - 1].date) / DAY);
    if (!longestGap || days > longestGap.days) longestGap = { days, from: win[i - 1].date, to: win[i].date };
  }
  return {
    perWeek: [r1(a.length / 4), r1(b.length / 4)],
    setsPer: [r1(avg(a.map((s) => s.sets))), r1(avg(b.map((s) => s.sets)))],
    longestGap,
  };
}
