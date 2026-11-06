import type { Units } from '../db/types';

/** Exact international definition: 1 lb = 0.45359237 kg. */
export const LB_PER_KG = 1 / 0.45359237;

/** lb (storage) → number in the display unit. */
export function toDisplay(lb: number, units: Units): number {
  return units === 'kg' ? lb / LB_PER_KG : lb;
}

/** Number typed in the display unit → lb (storage). */
export function fromDisplay(value: number, units: Units): number {
  return units === 'kg' ? value * LB_PER_KG : value;
}

/** Round to the nearest multiple of `step` (avoids float noise like 137.50000001). */
export function roundToStep(value: number, step: number): number {
  if (!(step > 0)) return value;
  const r = Math.round(value / step) * step;
  return Number(r.toFixed(4));
}

/** Format a plain number: at most `maxDecimals`, trailing zeros stripped, never "-0". */
export function formatNumber(n: number, maxDecimals = 2): string {
  if (!Number.isFinite(n)) return '';
  let s = n.toFixed(maxDecimals);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  if (s === '-0') s = '0';
  return s;
}

/**
 * A stored weight (lb) as a display string in the user's unit, e.g. "185", "27.5", "83.9".
 * Anything you could have typed with plates (a multiple of 0.25) shows exactly, so typed
 * values round-trip. Converted values (lb data shown in kg, or the reverse) get one decimal.
 */
export function formatWeight(lb: number, units: Units): string {
  const v = toDisplay(lb, units);
  const quarter = Math.round(v * 4) / 4;
  if (Math.abs(v - quarter) < 0.015) return formatNumber(quarter, 2);
  return formatNumber(Math.round(v * 10) / 10, 1);
}

/** Display number (not string) of a stored weight, rounded the same way as formatWeight. */
export function displayWeight(lb: number, units: Units): number {
  return Number(formatWeight(lb, units));
}

export const unitLabel = (units: Units) => (units === 'kg' ? 'kg' : 'lb');
export const unitColumn = (units: Units) => (units === 'kg' ? 'KG' : 'LBS');

/** Defaults that make sense per unit (used on first run and when switching units). */
export const UNIT_DEFAULTS: Record<Units, { weightStep: number; barWeight: number }> = {
  lb: { weightStep: 5, barWeight: 45 },
  kg: { weightStep: 2.5, barWeight: 20 },
};

export const WEIGHT_STEP_OPTIONS: Record<Units, number[]> = {
  lb: [1, 2.5, 5, 10],
  kg: [0.5, 1, 1.25, 2.5, 5],
};

export const BAR_WEIGHT_OPTIONS: Record<Units, number[]> = {
  lb: [15, 25, 35, 45, 55],
  kg: [7.5, 10, 15, 20, 25],
};
