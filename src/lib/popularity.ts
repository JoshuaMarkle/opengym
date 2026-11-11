/**
 * Exercise popularity (design/proposals/exercise-popularity.html): how lists
 * are ranked, what's hidden until searched, which variations get a chip, and
 * how popularity nudges automatic focus lifts. The score itself is never shown.
 */

export interface Rankable {
  id: string;
  name: string;
  /** 0–10 on built-ins; unset on custom exercises. */
  popularity?: number;
}

/** Popularity ≤ 3 (specialist and rare) is hidden until searched (§E). */
export const HIDE_AT_OR_BELOW = 3;
/** Custom exercises have no score; they count as an ordinary lift. */
export const CUSTOM_POPULARITY = 6;
/** "You do": your most-logged exercises at the top of the Library and picker (A1). */
export const YOU_DO_MAX = 4;
/** Variation chips before "All N" (B1, B3). */
export const CHIPS_MAX = 4;

export const popularityOf = (e: Rankable): number => e.popularity ?? CUSTOM_POPULARITY;
export const isRare = (e: Rankable): boolean => popularityOf(e) <= HIDE_AT_OR_BELOW;

/** Most popular first, ties A–Z. */
export const byPopularity = (a: Rankable, b: Rankable): number => popularityOf(b) - popularityOf(a) || a.name.localeCompare(b.name);

export interface RankOptions {
  /** Sessions logged per exercise. */
  sessions: (id: string) => number;
  /** Always shown even when rare, e.g. it's in a routine. */
  keep?: (id: string) => boolean;
  /** A search is typed: the list is already filtered and ordered by name match. */
  searching: boolean;
  /** Library "Show hidden": rare ones listed under Rarely used. */
  showHidden?: boolean;
  youDoMax?: number;
}

export interface Ranked<T> {
  /** Not searching: your most-logged (up to 4). Searching: every match you've logged. Most sessions first. */
  youDo: T[];
  /** Everything else that's visible, most popular first. */
  popular: T[];
  /** Rare ones, dimmed under "Rarely used": search matches, or all of them with Show hidden. */
  rare: T[];
  /** Rare ones left out (not searching, Show hidden off). */
  hiddenCount: number;
}

/** Shown by default: not rare, or you've logged it, or it's in a routine. */
export function isShown(e: Rankable, sessions: (id: string) => number, keep?: (id: string) => boolean): boolean {
  return !isRare(e) || sessions(e.id) > 0 || !!keep?.(e.id);
}

/**
 * The Popular sort (A1, A2). `list` is already filtered by muscle and search;
 * while searching its order (best name match first) breaks popularity ties.
 */
export function rankPopular<T extends Rankable>(list: T[], opts: RankOptions): Ranked<T> {
  const { sessions, keep, searching } = opts;
  const pos = new Map(list.map((e, i) => [e.id, i]));
  const tie = (a: T, b: T) => (searching ? pos.get(a.id)! - pos.get(b.id)! : a.name.localeCompare(b.name));
  const mostLogged = (a: T, b: T) => sessions(b.id) - sessions(a.id) || byPopularity(a, b);
  const logged = list.filter((e) => sessions(e.id) > 0).sort(mostLogged);
  const youDo = searching ? logged : logged.slice(0, opts.youDoMax ?? YOU_DO_MAX);
  const top = new Set(youDo.map((e) => e.id));
  const rest = list.filter((e) => !top.has(e.id));
  const popular = rest.filter((e) => isShown(e, sessions, keep)).sort((a, b) => popularityOf(b) - popularityOf(a) || tie(a, b));
  const hidden = rest.filter((e) => !isShown(e, sessions, keep)).sort((a, b) => popularityOf(b) - popularityOf(a) || tie(a, b));
  const showRare = searching || !!opts.showHidden;
  return { youDo, popular, rare: showRare ? hidden : [], hiddenCount: showRare ? 0 : hidden.length };
}

/** The A–Z sort: the same hiding rule, alphabetical. */
export function visibleAZ<T extends Rankable>(list: T[], opts: Pick<RankOptions, 'sessions' | 'keep' | 'showHidden'>): { items: T[]; hiddenCount: number } {
  const items = list.filter((e) => opts.showHidden || isShown(e, opts.sessions, opts.keep)).sort((a, b) => a.name.localeCompare(b.name));
  return { items, hiddenCount: list.length - items.length };
}

/**
 * Variation chips (4.1, 8.2): logged variations first, then popular ones up
 * to `max`. Selection never reorders those chips. An otherwise hidden current
 * variation is appended so picking from All keeps the existing buttons in place.
 */
export function variationChips<T extends Rankable>(current: T, members: T[], sessions: (id: string) => number, max = CHIPS_MAX): { chips: T[]; more: number } {
  const logged = members.filter((m) => sessions(m.id) > 0).sort((a, b) => sessions(b.id) - sessions(a.id) || byPopularity(a, b));
  const fill = members.filter((m) => sessions(m.id) === 0 && !isRare(m)).sort(byPopularity);
  const chips = [...logged];
  for (const m of fill) {
    if (chips.length >= max) break;
    chips.push(m);
  }
  if (!chips.some((m) => m.id === current.id)) chips.push(current);
  const all = members.some((m) => m.id === current.id) ? members.length : members.length + 1;
  return { chips, more: all - chips.length };
}

/** The "All N" list (B2, B4): most popular first; rare ones you haven't logged under Rarely used. */
export function variationList<T extends Rankable>(members: T[], sessions: (id: string) => number): { main: T[]; rare: T[] } {
  const sorted = [...members].sort(byPopularity);
  return { main: sorted.filter((m) => isShown(m, sessions)), rare: sorted.filter((m) => !isShown(m, sessions)) };
}

// ───────────────────────────── focus lifts (§C)

/** Popularity multiplier for automatic focus lifts: 0.60 at 0, 1.00 at 10. */
export const focusWeight = (popularity: number): number => 0.6 + 0.04 * popularity;

export interface FocusCandidate {
  id: string;
  /** Sessions that produce a trend number. */
  sessions: number;
  /** Latest of those sessions (ms). */
  last: number;
  popularity: number;
  group?: string;
}

/**
 * Automatic focus lifts: rank by sessions × focusWeight(popularity), latest
 * first on a tie, at most one per variation group. `taken` holds groups
 * already used (e.g. by compounds when topping up with isolation lifts).
 */
export function pickFocus(candidates: FocusCandidate[], n: number, taken: Set<string> = new Set()): string[] {
  const score = (c: FocusCandidate) => c.sessions * focusWeight(c.popularity);
  const out: string[] = [];
  const groups = new Set(taken);
  for (const c of [...candidates].sort((a, b) => score(b) - score(a) || b.last - a.last)) {
    if (out.length >= n) break;
    if (c.group && groups.has(c.group)) continue;
    if (c.group) groups.add(c.group);
    out.push(c.id);
  }
  return out;
}
