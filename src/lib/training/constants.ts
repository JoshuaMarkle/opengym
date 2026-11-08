// Training tuning knobs (design/training-logic.html §24). Every rule in src/lib/training reads from here.

export const EPLEY = 30;
/** Default effort target, RIR min–max (asked at setup, §4). */
export const TARGET_RIR: [number, number] = [0, 2];
/** "Only the last set to failure": earlier sets aim this much further from failure. */
export const LAST_SET_ONLY_SHIFT = 1;
/** Effort not logged: assume a hard set. */
export const UNKNOWN_RIR = 0;
/** Cost, in steps, of one extra distinct weight when matching sets (§7 rule 4). */
export const MATCH_PENALTY = 3;

export const BREAK_DAYS = 21;
export const LONG_BREAK_DAYS = 42;
export const COMEBACK_PCT = 0.9;
export const LONG_COMEBACK_PCT = 0.8;
export const RAMP_SESSIONS = 3;
export const DISMISS_LIMIT = 2;

// Trends (§15)
export const WINDOW_DAYS = 56;
export const MIN_SESSIONS = 6;
export const MIN_SPAN_DAYS = 28;
export const CLIMB_MIN_PCT = 1.5;
export const SLIP_MIN_PCT = 3.0;
export const SLIP_NOISE_MULT = 1.5;
export const SLOW_LIFT_PCT_MO = 0.5;
/** Sets with reps + RIR above this are skipped for the session's strength number (§13). */
export const MAX_EFFORT_REPS = 15;

// Projection (§17, §18)
export const PROJ_WINDOW_DAYS = 84;
export const MIN_R2 = 0.3;
export const MAX_NOISE_PCT = 6.0;
export const FLAT_NOISE_PCT = 2.0;
export const PRIOR_WEIGHT_SESSIONS = 8;
/** No-date estimates further out than this are "not moving toward it yet". */
export const MAX_ETA_WEEKS = 104;

export const DAY = 86_400_000;
export const WEEK = 7 * DAY;
/** Average month, for %/month rates. */
export const MONTH_DAYS = 30.44;
