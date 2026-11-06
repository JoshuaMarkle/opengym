import { formatNumber } from './units';

export type KeypadKey =
  | { type: 'digit'; d: string }
  | { type: 'dot' }
  | { type: 'minus' }
  | { type: 'dash' }
  | { type: 'backspace' }
  | { type: 'inc' }
  | { type: 'dec' };

export interface KeypadOptions {
  mode: 'weight' | 'reps';
  allowRange?: boolean;
  allowNegative?: boolean;
  /** ± step in the display unit (weight) — reps always step by 1. */
  step: number;
}

const MAX_LEN = 7;

/**
 * Apply one key to the text being edited. `fresh` means the cell was just
 * focused, so the first digit replaces what's there (like a selected field).
 */
export function applyKey(text: string, fresh: boolean, key: KeypadKey, o: KeypadOptions): string {
  switch (key.type) {
    case 'digit': {
      if (fresh) return key.d;
      if (text.replace(/[^0-9]/g, '').length >= MAX_LEN) return text;
      if (text === '0') return key.d;
      if (text === '-0') return `-${key.d}`;
      // Keep decimals sane: at most two places.
      if (/\.\d{2}$/.test(text)) return text;
      return text + key.d;
    }
    case 'dot': {
      if (o.mode !== 'weight') return text;
      if (fresh) return '0.';
      if (text.includes('.')) return text;
      return (text === '' || text === '-' ? `${text}0` : text) + '.';
    }
    case 'minus': {
      if (o.mode !== 'weight' || !o.allowNegative) return text;
      if (text.startsWith('-')) return text.slice(1);
      return `-${text}`;
    }
    case 'dash': {
      if (o.mode !== 'reps' || !o.allowRange) return text;
      if (/^\d+$/.test(text)) return `${text}–`;
      return text;
    }
    case 'backspace':
      return fresh ? '' : text.slice(0, -1);
    case 'inc':
    case 'dec': {
      const sign = key.type === 'inc' ? 1 : -1;
      if (o.mode === 'reps') {
        const m = /^(\d+)–(\d*)$/.exec(text);
        if (m) {
          if (!m[2]) return text;
          const hi = Math.max(Number(m[1]), Number(m[2]) + sign);
          return `${m[1]}–${hi}`;
        }
        const n = Number(text) || 0;
        const next = Math.max(0, n + sign);
        return next === 0 ? '' : String(next);
      }
      const n = Number(text) || 0;
      // Off the step grid (e.g. 122.5 kg converted from lb, step 2.5)? Snap to the next
      // grid line in that direction first, so ± always lands on loadable numbers.
      const k = n / o.step;
      const onGrid = Math.abs(k - Math.round(k)) < 1e-6;
      let next = onGrid ? n + sign * o.step : (sign > 0 ? Math.ceil(k) : Math.floor(k)) * o.step;
      next = Math.round(next * 1000) / 1000;
      if (!o.allowNegative && next < 0) next = 0;
      return formatNumber(next, 3);
    }
  }
}

/** Parse the edited weight text; empty or "-" is undefined. */
export function parseWeightText(text: string): number | undefined {
  if (text === '' || text === '-' || text === '.' || text === '-.') return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}

export function parseRepsText(text: string): number | undefined {
  if (!text) return undefined;
  const n = parseInt(text, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
