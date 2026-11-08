// Goals and projection (training-logic §17, §18). Gains slow down, so projections follow
// expected(t) = E₀ + r₀·τ·(1 − e^(−t/τ)), never a straight line.

import { DAY, FLAT_NOISE_PCT, MAX_ETA_WEEKS, MAX_NOISE_PCT, MIN_R2, MIN_SESSIONS, MONTH_DAYS, PRIOR_WEIGHT_SESSIONS, PROJ_WINDOW_DAYS, WEEK } from './constants';
import { e1, mad, median, r2, theilSen } from './math';
import type { StrengthPoint } from './strength';
import { inWindow } from './trend';

export type Verdict = 'ready' | 'likely' | 'stretch' | 'unlikely';
export const VERDICT_LABEL: Record<Verdict, string> = { ready: 'Ready', likely: 'Likely', stretch: 'Stretch', unlikely: 'Unlikely' };

/** A goal's target est. 1RM, at RIR 0: 225 × 5 → 262.5. */
export const goalTarget = (weight: number, reps: number) => e1(weight, reps, 0);

export function project(E0: number, r0: number, tau: number, weeks: number): number {
  if (weeks <= 0) return E0;
  return E0 + r0 * tau * (1 - Math.exp(-weeks / tau));
}
export const projectFast = (E0: number, r0: number, tau: number, weeks: number) => project(E0, r0 * 1.5, tau * 1.3, weeks);
export const projectSlow = (E0: number, r0: number, tau: number, weeks: number) => project(E0, r0 * 0.5, tau * 0.7, weeks);

/** §18 verdict for a date `weeks` away. */
export function verdict(E0: number, r0: number, tau: number, goal: number, weeks: number): Verdict {
  if (goal <= E0) return 'ready';
  if (project(E0, r0, tau, weeks) >= goal) return 'likely';
  if (projectFast(E0, r0, tau, weeks) >= goal) return 'stretch';
  return 'unlikely';
}

/** No-date estimate in weeks. null = "not moving toward it yet" (flat, falling, past the ceiling, or 2+ years). */
export function etaWeeks(E0: number, r0: number, tau: number, goal: number): number | null {
  if (goal <= E0) return 0;
  if (r0 <= 0) return null;
  const cap = r0 * tau;
  if (goal - E0 >= cap) return null;
  const t = -tau * Math.log(1 - (goal - E0) / cap);
  return t <= MAX_ETA_WEEKS ? t : null;
}

/** Weekly rate needed to reach the goal by then, on a straight line (shown as "Needs 1.0 lb/wk"). */
export const neededPerWeek = (E0: number, goal: number, weeks: number) => (weeks > 0 ? (goal - E0) / weeks : Infinity);

export interface ProjectionFit {
  ok: boolean;
  /** Plain reason when there's no projection. */
  reason: string;
  n: number;
  r2: number;
  wobble: number;
  dropped: number;
  /** Current trend value (the fit at the newest session). */
  E0: number;
  /** Fitted rate, per week. */
  fitRate: number;
}

/**
 * §17: only project when the last 12 weeks look like a trend. Drops one-off outliers
 * (|residual| > 3 × wobble), then needs R² ≥ 0.3, or a clearly flat line (wobble ≤ 2%).
 */
export function canProject(points: StrengthPoint[]): ProjectionFit {
  const pts = inWindow(points, PROJ_WINDOW_DAYS);
  const last = pts[pts.length - 1]?.value ?? 0;
  const base = { n: pts.length, r2: 0, wobble: 0, dropped: 0, E0: last, fitRate: 0 };
  if (pts.length < MIN_SESSIONS) return { ...base, ok: false, reason: `${pts.length} ${pts.length === 1 ? 'session' : 'sessions'}, needs ${MIN_SESSIONS}` };
  const xs = pts.map((p) => p.date / DAY);
  const ys = pts.map((p) => p.value);
  const { slope, intercept } = theilSen(xs, ys);
  const med = Math.abs(median(ys)) || 1;
  const res = xs.map((x, i) => ys[i] - (slope * x + intercept));
  const m = mad(res);
  const keep = xs.map((_, i) => i).filter((i) => m === 0 || Math.abs(res[i]) <= 3 * m);
  const wobble = (m / med) * 100;
  const rr = r2(
    keep.map((i) => xs[i]),
    keep.map((i) => ys[i]),
  );
  const E0 = slope * xs[xs.length - 1] + intercept;
  const out = { ...base, r2: rr, wobble, dropped: pts.length - keep.length, E0, fitRate: slope * 7 };
  if (wobble > MAX_NOISE_PCT) return { ...out, ok: false, reason: `${pts.length} sessions, too scattered to draw a line through` };
  if (rr >= MIN_R2) return { ...out, ok: true, reason: '' };
  if (wobble <= FLAT_NOISE_PCT) return { ...out, ok: true, reason: '' };
  return { ...out, ok: false, reason: `${pts.length} sessions, scattered with no clear direction` };
}

/**
 * r₀ in lb (or reps) per week: the fitted rate blended with the lift's pace, so a few
 * sessions don't swing it. `pacePctMo` is the lift's pace (§14) and E0 the current value.
 */
export function currentRate(fit: ProjectionFit, pacePctMo: number): number {
  const paceRate = ((pacePctMo / 100) * Math.abs(fit.E0)) / (MONTH_DAYS / 7);
  return (fit.n * fit.fitRate + PRIOR_WEIGHT_SESSIONS * paceRate) / (fit.n + PRIOR_WEIGHT_SESSIONS);
}

/** Weeks from `now` until `date`. */
export const weeksUntil = (date: number, now: number) => (date - now) / WEEK;

export type RateLabel = 'slow' | 'typical' | 'focused' | 'rare';
/** C3: a chosen rate, read against the lift's own pace p: slow < 0.5p, typical to 1.5p, focused to 3p, rare beyond. */
export function rateLabel(rate: number, paceRate: number): RateLabel {
  const p = Math.max(1e-6, paceRate);
  const x = rate / p;
  return x < 0.5 ? 'slow' : x <= 1.5 ? 'typical' : x <= 3 ? 'focused' : 'rare';
}
