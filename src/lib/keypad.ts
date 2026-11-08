import { formatNumber } from './units';

export type KeypadKey =
  | { type: 'digit'; d: string }
  | { type: 'dot' }
  | { type: 'minus' }
  | { type: 'dash' }
  | { type: 'colon' }
  | { type: 'backspace' }
  | { type: 'inc' }
  | { type: 'dec' };

/**
 * weight: decimals, optional sign · reps: whole numbers, optional "–" range ·
 * time: m:ss with ":" and ± a minute (cardio) · decimal / int: other cardio boxes.
 */
export type KeypadMode = 'weight' | 'reps' | 'time' | 'decimal' | 'int';

export interface KeypadOptions {
  mode: KeypadMode;
  allowRange?: boolean;
  allowNegative?: boolean;
  /** ± step in the display unit (weight, decimal, int); reps step by 1, time by `step` seconds (default 60). */
  step: number;
}

const MAX_LEN = 7;

/**
 * Apply one key to the text being edited. `fresh` means the cell was just
 * focused, so the first digit replaces what's there (like a selected field).
 */
export function applyKey(text: string, fresh: boolean, key: KeypadKey, o: KeypadOptions): string {
  if (o.mode === 'time') return applyTimeKey(text, fresh, key, o.step || 60);
  if (o.mode === 'int' && key.type === 'dot') return text;
  if (o.mode === 'decimal' || o.mode === 'int') {
    if (key.type === 'minus' || key.type === 'dash' || key.type === 'colon') return text;
    return applyKey(text, fresh, key, { mode: 'weight', step: o.step, allowNegative: false });
  }
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
    case 'colon':
      return text;
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

/** Format seconds the way the time box shows them while typing: "5:00", "1:05:00". */
function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  const p = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

function timeSeconds(text: string): number {
  if (!text) return 0;
  const parts = text.split(':').map((x) => (x === '' ? 0 : Number(x)));
  if (parts.length === 1) return parts[0] * 60;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

/** Time boxes: digits and ":" (at most h:mm:ss, two digits after a colon); ± steps a minute. */
function applyTimeKey(text: string, fresh: boolean, key: KeypadKey, step: number): string {
  switch (key.type) {
    case 'digit': {
      if (fresh) return key.d;
      if (text.replace(/:/g, '').length >= 6) return text;
      if (/:\d{2}$/.test(text)) return text;
      if (text === '0') return key.d;
      return text + key.d;
    }
    case 'colon': {
      if (fresh || text === '') return '0:';
      if (text.endsWith(':') || (text.match(/:/g) ?? []).length >= 2) return text;
      return `${text}:`;
    }
    case 'backspace':
      return fresh ? '' : text.slice(0, -1);
    case 'inc':
    case 'dec': {
      const cur = timeSeconds(text);
      const next = key.type === 'inc' ? (Math.floor(cur / step) + 1) * step : cur % step ? Math.floor(cur / step) * step : cur - step;
      return next > 0 ? fmtTime(next) : '';
    }
    default:
      return text;
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
