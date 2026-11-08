import type { LoggedSet } from './sets';

/**
 * Supersets (SPEC §10, B1–B6). Exercises sharing a `supersetGroup` letter form a
 * superset. Members always sit next to each other, 2–3 of them; letters are
 * reassigned A, B, C… in list order whenever the list changes.
 */

export const MAX_SUPERSET = 3;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export interface GroupItem {
  key: string;
  supersetGroup?: string;
}

export interface Block<T> {
  /** The group letter, when this block is a superset. */
  letter?: string;
  items: T[];
}

/** Contiguous runs of one group become a block; everything else is a block of one. */
export function supersetBlocks<T extends GroupItem>(items: T[]): Block<T>[] {
  const out: Block<T>[] = [];
  for (const it of items) {
    const last = out[out.length - 1];
    if (it.supersetGroup && last?.letter && last.letter === it.supersetGroup) last.items.push(it);
    else out.push({ letter: it.supersetGroup || undefined, items: [it] });
  }
  return out.map((b) => (b.items.length > 1 ? b : { items: b.items }));
}

function withGroup<T extends GroupItem>(it: T, g: string | undefined): T {
  return it.supersetGroup === g ? it : { ...it, supersetGroup: g };
}

/**
 * Keep the rules: each group is one contiguous run of 2–3 (a group split apart
 * keeps its first run; extra members beyond 3 and groups of one are unlinked),
 * lettered A, B, C… in order.
 */
export function normalizeSupersets<T extends GroupItem>(items: T[]): T[] {
  const seen = new Set<string>();
  const runs: { group?: string; items: T[] }[] = [];
  for (const it of items) {
    const g = it.supersetGroup || undefined;
    const last = runs[runs.length - 1];
    if (g && last && last.group === g) last.items.push(it);
    else runs.push({ group: g, items: [it] });
  }
  let n = 0;
  const out: T[] = [];
  for (const r of runs) {
    const valid = r.group && !seen.has(r.group) && r.items.length >= 2;
    if (r.group) seen.add(r.group);
    if (!valid) {
      for (const it of r.items) out.push(withGroup(it, undefined));
      continue;
    }
    const letter = LETTERS[n++ % LETTERS.length];
    r.items.forEach((it, i) => out.push(withGroup(it, i < MAX_SUPERSET ? letter : undefined)));
  }
  return out;
}

/** "A1", "A2", "B1"… for every superset member. */
export function supersetTags<T extends GroupItem>(items: T[]): Map<string, string> {
  const tags = new Map<string, string>();
  for (const b of supersetBlocks(items)) {
    if (!b.letter) continue;
    b.items.forEach((it, i) => tags.set(it.key, `${b.letter}${i + 1}`));
  }
  return tags;
}

/** The superset an item belongs to (its block), or undefined. */
export function groupOf<T extends GroupItem>(items: T[], key: string): Block<T> | undefined {
  return supersetBlocks(items).find((b) => b.letter && b.items.some((x) => x.key === key));
}

/**
 * B2 "Superset with…": partners leave wherever they were and line up right after
 * the anchor's block, all sharing one group. Capped at three members.
 */
export function linkSuperset<T extends GroupItem>(items: T[], anchorKey: string, partnerKeys: string[]): T[] {
  const anchor = items.find((x) => x.key === anchorKey);
  if (!anchor) return items;
  const block = groupOf(items, anchorKey);
  const members = block ? block.items.map((x) => x.key) : [anchorKey];
  const partners = partnerKeys.filter((k) => k !== anchorKey && !members.includes(k)).slice(0, Math.max(0, MAX_SUPERSET - members.length));
  if (!partners.length) return items;
  const used = new Set(items.map((x) => x.supersetGroup).filter(Boolean));
  const letter = block?.letter ?? [...LETTERS].find((l) => !used.has(l)) ?? '#';
  const moving = partners.map((k) => items.find((x) => x.key === k)!).filter(Boolean);
  const rest = items.filter((x) => !partners.includes(x.key));
  const lastMember = members[members.length - 1];
  const at = rest.findIndex((x) => x.key === lastMember);
  const out = [...rest.slice(0, at + 1), ...moving, ...rest.slice(at + 1)].map((x) =>
    members.includes(x.key) || partners.includes(x.key) ? withGroup(x, letter) : x,
  );
  return normalizeSupersets(out);
}

/** "Unlink superset": the item leaves its group and sits just after it. A group left with one dissolves. */
export function unlinkSuperset<T extends GroupItem>(items: T[], key: string): T[] {
  const block = groupOf(items, key);
  if (!block) return items;
  const me = items.find((x) => x.key === key)!;
  const rest = items.filter((x) => x.key !== key);
  const others = block.items.filter((x) => x.key !== key);
  const lastOther = others[others.length - 1];
  const at = rest.findIndex((x) => x.key === lastOther.key);
  return normalizeSupersets([...rest.slice(0, at + 1), withGroup(me, undefined), ...rest.slice(at + 1)]);
}

/** Move the block holding `key` (a whole superset moves as one) one block up or down. */
export function moveBlock<T extends GroupItem>(items: T[], key: string, delta: -1 | 1): T[] {
  const blocks = supersetBlocks(items);
  const i = blocks.findIndex((b) => b.items.some((x) => x.key === key));
  const j = i + delta;
  if (i < 0 || j < 0 || j >= blocks.length) return items;
  [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
  return normalizeSupersets(blocks.flatMap((b) => b.items));
}

/**
 * After a drag (B1): dropped strictly inside a superset → joins it (if there's
 * room, otherwise the move is undone); a member dragged away from its partners
 * leaves the group.
 */
export function settleDrag<T extends GroupItem>(before: T[], after: T[], movedKey: string): T[] {
  const i = after.findIndex((x) => x.key === movedKey);
  if (i < 0) return after;
  const moved = after[i];
  const a = after[i - 1];
  const b = after[i + 1];
  const list = [...after];
  if (a?.supersetGroup && a.supersetGroup === b?.supersetGroup) {
    const g = a.supersetGroup;
    if (moved.supersetGroup !== g) {
      const size = after.filter((x) => x.supersetGroup === g && x.key !== movedKey).length;
      if (size >= MAX_SUPERSET) return before;
      list[i] = withGroup(moved, g);
    }
  } else if (moved.supersetGroup && a?.supersetGroup !== moved.supersetGroup && b?.supersetGroup !== moved.supersetGroup) {
    list[i] = withGroup(moved, undefined);
  }
  return normalizeSupersets(list);
}

// ───────────────────────────── logging (B3–B4)

export interface MemberSets<S extends LoggedSet = LoggedSet> {
  key: string;
  /** Display order. */
  sets: S[];
}

/**
 * Where ✓ takes you next. Warm-ups and drops still to do stay on the same
 * exercise; otherwise it moves on to the next member that has sets left
 * (wrapping round), so A1 set 2 → A2 set 2 → A1 set 3. When a partner runs out,
 * the rest continue on their own. null = the whole superset is done.
 */
export function nextTarget<S extends LoggedSet>(members: MemberSets<S>[], fromKey: string, tickedSetId: string): { key: string; setId: string } | null {
  const i = members.findIndex((m) => m.key === fromKey);
  if (i < 0) return null;
  const open = (m: MemberSets<S>) => m.sets.find((s) => !s.completed && s.id !== tickedSetId);
  const me = members[i];
  const at = me.sets.findIndex((s) => s.id === tickedSetId);
  const ticked = me.sets[at];
  if (ticked) {
    if (ticked.kind === 'warmup') {
      const own = open(me);
      if (own) return { key: me.key, setId: own.id };
    }
    const root = ticked.kind === 'drop' ? ticked.parentSetId : ticked.id;
    const after = me.sets[at + 1];
    if (after && after.kind === 'drop' && after.parentSetId === root && !after.completed) return { key: me.key, setId: after.id };
  }
  for (let k = 1; k <= members.length; k++) {
    const m = members[(i + k) % members.length];
    const s = open(m);
    if (s) return { key: m.key, setId: s.id };
  }
  return null;
}

/** "Round 2 of 3": the pass through the group you're on. */
export function supersetRound<S extends LoggedSet>(members: MemberSets<S>[], focusedKey: string): { round: number; rounds: number } {
  const working = (m: MemberSets<S>) => m.sets.filter((s) => s.kind === 'working');
  const rounds = Math.max(1, ...members.map((m) => working(m).length));
  const roundOf = (m: MemberSets<S>) => {
    const w = working(m);
    const i = w.findIndex((s) => !s.completed);
    return i < 0 ? undefined : i + 1;
  };
  const focused = members.find((m) => m.key === focusedKey);
  const r = (focused && roundOf(focused)) ?? Math.min(rounds, ...members.map((m) => roundOf(m) ?? rounds));
  return { round: Math.min(r, rounds), rounds };
}

/**
 * B4: a member folds into one line when you're not on it and it has done its
 * set for this round (or all of its sets), so the active table has room.
 */
export function isFolded<S extends LoggedSet>(member: MemberSets<S>, focusedKey: string, round: number): boolean {
  if (member.key === focusedKey) return false;
  if (!member.sets.length) return false;
  if (member.sets.every((s) => s.completed)) return true;
  const done = member.sets.filter((s) => s.kind === 'working' && s.completed).length;
  return done >= round;
}
