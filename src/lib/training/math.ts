// Small numeric helpers shared by the training rules.

import { EPLEY } from './constants';

/** Python-style round half to even, so the rules match training-logic-reference.py exactly. */
export function roundHalfEven(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  if (d === 0.5) return f % 2 === 0 ? f : f + 1;
  return Math.round(x);
}

export const round2 = (x: number) => Math.round(x * 100) / 100;

/** Round to a multiple of `step`: nearest (half to even), down or up. */
export function roundTo(x: number, step: number, mode: 'nearest' | 'down' | 'up' = 'nearest'): number {
  if (!(step > 0)) return x;
  const q = x / step;
  const n = mode === 'down' ? Math.floor(q + 1e-9) : mode === 'up' ? Math.ceil(q - 1e-9) : roundHalfEven(q);
  return round2(n * step);
}

export function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Epley with reps in reserve added to the reps: the strength behind one set. */
export const e1 = (w: number, reps: number, rir: number) => w * (1 + (reps + rir) / EPLEY);
/** The weight for a given reps and RIR at strength E. */
export const wAt = (E: number, reps: number, rir: number) => E / (1 + (reps + rir) / EPLEY);
/** Predicted reps at weight W, leaving `rir` in reserve. */
export const repsAt = (E: number, w: number, rir: number) => EPLEY * (E / w - 1) - rir;

/** Theil–Sen line: the median of pairwise slopes, so one great or awful day barely moves it. */
export function theilSen(xs: number[], ys: number[]): { slope: number; intercept: number } {
  const sl: number[] = [];
  for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) if (xs[j] !== xs[i]) sl.push((ys[j] - ys[i]) / (xs[j] - xs[i]));
  const slope = sl.length ? median(sl) : 0;
  const intercept = median(xs.map((x, i) => ys[i] - slope * x));
  return { slope, intercept };
}

/** Squared correlation (ordinary R²) of the points. */
export function r2(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i] - mx) ** 2;
    sxy += (xs[i] - mx) * (ys[i] - my);
    syy += (ys[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return 0;
  return (sxy * sxy) / (sxx * syy);
}

/** Robust noise of a fit: 1.4826 × median |residual|. */
export function mad(residuals: number[]): number {
  return 1.4826 * median(residuals.map(Math.abs));
}
