// Coaching tips (training-logic §23): one line under the exercise header, at most one
// per workout, dismissible for good.

import { DAY } from './constants';
import type { Move, Target, TSet } from './decide';
import { e1 } from './math';

export type TipId = 'logEffort' | 'restLonger' | 'pushHarder' | 'set1';

export const TIP_TEXT: Record<TipId, string> = {
  logEffort: "Log how many reps you had left. It's what makes the weights fit.",
  restLonger: 'Rest a bit longer between sets. Your later sets keep needing a lighter weight.',
  pushHarder: 'Push closer to failure. With reps left, the weight can’t tell it should go up.',
  set1: 'Give set 1 your best effort. It leads next time’s suggestion.',
};

export interface TipSession {
  date: number;
  sets: TSet[];
  /** The suggestion this session's sets would give: next weights and set 1's move. */
  next?: { weights: number[]; lead: Move };
}

/** Newest session first. Returns the first tip that applies and isn't dismissed. */
export function tipFor(sessions: TipSession[], o: { effortOn: boolean; target: Target; dismissed: string[]; now: number }): TipId | null {
  const ok = (id: TipId) => !o.dismissed.includes(id);
  if (!sessions.length) return null;

  if (ok('logEffort') && o.effortOn) {
    const recent = sessions.filter((s) => s.date >= o.now - 14 * DAY).flatMap((s) => s.sets);
    if (recent.length >= 4 && recent.filter((s) => s.rir == null).length / recent.length > 0.5) return 'logEffort';
  }
  if (ok('pushHarder') && sessions.length >= 3) {
    const easy = sessions.slice(0, 3).every((s) => {
      const rated = s.sets.filter((x) => x.rir != null);
      return rated.length > 0 && rated.filter((x) => x.rir! > o.target[1]).length > s.sets.length / 2;
    });
    if (easy) return 'pushHarder';
  }
  if (ok('restLonger') && sessions.length >= 2) {
    const fade = sessions.slice(0, 2).every((s) => s.next && s.next.weights.length > 1 && s.next.lead !== 'down' && s.next.weights.slice(1).some((w) => w < s.next!.weights[0]));
    if (fade) return 'restLonger';
  }
  if (ok('set1') && sessions.length >= 3) {
    const weak = sessions.slice(0, 5).filter((s) => s.sets.length > 1 && strength(s.sets[0]) < strength(s.sets[1])).length;
    if (weak >= 3) return 'set1';
  }
  return null;
}

const strength = (s: TSet) => e1(s.weight || 1, s.reps, s.rir ?? 0);
