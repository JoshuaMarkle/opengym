import type { SetKind } from '../db/types';
import type { LoggedSet } from './sets';

let n = 0;
/** Compact set builder for tests: s('working', 185, 8). */
export function s(kind: SetKind, weight?: number, reps?: number, extra: Partial<LoggedSet> = {}): LoggedSet {
  n++;
  return { id: extra.id ?? `set${n}`, order: extra.order ?? n, kind, weight, reps, completed: true, ...extra };
}
