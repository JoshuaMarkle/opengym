import type { Equipment, ExerciseType, Units } from '../db/types';
import { formatNumber } from './units';

/**
 * Plate pad (SPEC §10, 4.16–4.18). Everything here is in the display unit (lb or kg).
 * A "stack" is one side of the bar, inner plate first, in the order loaded.
 * Total = bar + 2 × the stack.
 */

/** The six plate buttons, heaviest first (2 × 3 grid). */
export const PLATES: Record<Units, number[]> = {
  lb: [45, 35, 25, 10, 5, 2.5],
  kg: [25, 20, 15, 10, 5, 2.5],
};

export type BarId = 'barbell' | 'light' | 'ez' | 'trap' | 'custom' | 'none';

/** 4.18: the bar picker. "No bar" makes the pad work for plate-loaded machines. */
export const BAR_OPTIONS: Record<Units, { id: Exclude<BarId, 'custom'>; label: string; weight: number }[]> = {
  lb: [
    { id: 'barbell', label: 'Barbell', weight: 45 },
    { id: 'light', label: 'Women’s / light bar', weight: 35 },
    { id: 'ez', label: 'EZ curl bar', weight: 25 },
    { id: 'trap', label: 'Trap / hex bar', weight: 60 },
    { id: 'none', label: 'No bar (machine)', weight: 0 },
  ],
  kg: [
    { id: 'barbell', label: 'Barbell', weight: 20 },
    { id: 'light', label: 'Women’s / light bar', weight: 15 },
    { id: 'ez', label: 'EZ curl bar', weight: 10 },
    { id: 'trap', label: 'Trap / hex bar', weight: 25 },
    { id: 'none', label: 'No bar (machine)', weight: 0 },
  ],
};

/** Which bar option a weight matches, else custom. */
export function barIdFor(weight: number, units: Units): BarId {
  return BAR_OPTIONS[units].find((b) => Math.abs(b.weight - weight) < 0.01)?.id ?? 'custom';
}

/** "Bar 45 lb", "No bar", "Bar 20 kg". */
export function barLabel(weight: number, units: Units): string {
  return weight > 0 ? `Bar ${formatNumber(weight, 2)} ${units}` : 'No bar';
}

/** The plate pad is offered for weight × reps lifts on a barbell or a plate-loaded machine. */
export function hasPlatePad(type: ExerciseType, equipment: Equipment): boolean {
  return type === 'weight' && (equipment === 'barbell' || equipment === 'machine');
}

/** Most plates the pad loads on one side. Past this the plate buttons turn off. */
export const MAX_PLATES_PER_SIDE = 10;

/** Room for one more plate on each side? */
export const canAddPlate = (stack: number[]) => stack.length < MAX_PLATES_PER_SIDE;

/** Short bar label for the keypad header: "Bar 45", "No bar". The unit is on the lbs / kg tab beside it. */
export function barShortLabel(weight: number): string {
  return weight > 0 ? `Bar ${formatNumber(weight, 2)}` : 'No bar';
}

export const sum = (stack: number[]) => stack.reduce((a, b) => a + b, 0);

export function plateTotal(bar: number, stack: number[]): number {
  return round2(bar + 2 * sum(stack));
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Load a weight onto the bar: heaviest plates first, per side. Whatever can't be
 * made with the available plates is returned as `rest` (per side).
 */
export function loadPlates(total: number | undefined, bar: number, plates: number[]): { stack: number[]; rest: number } {
  let side = total == null ? 0 : round2((total - bar) / 2);
  if (!(side > 0)) return { stack: [], rest: 0 };
  const stack: number[] = [];
  for (const p of [...plates].sort((a, b) => b - a)) {
    while (side + 1e-9 >= p) {
      stack.push(p);
      side = round2(side - p);
    }
  }
  return { stack, rest: side };
}

/** How many of each plate are on one side. */
export function plateCounts(stack: number[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const p of stack) m.set(p, (m.get(p) ?? 0) + 1);
  return m;
}

/** Tap a plate on the drawing: take that one off (each side). */
export function removeAt(stack: number[], index: number): number[] {
  return stack.filter((_, i) => i !== index);
}

/**
 * Plate sizes for the drawing, as a fraction of the tallest. Bigger plates are
 * taller and thicker, like real bumper / iron plates.
 */
export function plateShape(p: number, units: Units): { h: number; w: number } {
  const max = PLATES[units][0];
  const r = Math.min(1, p / max);
  return { h: 0.36 + 0.64 * Math.sqrt(r), w: r >= 0.5 ? 1 : r >= 0.2 ? 0.75 : 0.55 };
}
