import { useMemo } from 'react';
import { cx } from '../../components/ui';
import { GROUP_LABELS } from '../../db/seedExercises';
import type { Exercise } from '../../db/types';
import { variationChips } from '../../lib/popularity';

/** "Rows (free weight) · 14" for built-in groups, else "14 exercises" (B2). */
export function groupTitle(e: Exercise, n: number): string {
  const label = e.variationGroupId ? GROUP_LABELS[e.variationGroupId] : undefined;
  return label ? `${label} · ${n}` : `${n} exercises`;
}

/**
 * Variation chips (B1 on the exercise screen, B3 while logging): this one,
 * then the ones you've logged (blue outline), then the most popular, up to 4.
 * The rest sit behind "All N" (B1) or a "+N" pinned at the end of the row (B3).
 * Labels come from the whole group, so a chip's name never changes when the
 * set of chips does.
 */
export function VariationChipRow({
  current,
  members,
  labels,
  sessions,
  wrap = false,
  onPick,
  onAll,
}: {
  current: Exercise;
  members: Exercise[];
  labels: Map<string, string>;
  sessions: (id: string) => number;
  /** Exercise screen: chips wrap, "All N ›". Logging: one line that scrolls, "+N" pinned at the end. */
  wrap?: boolean;
  onPick: (id: string) => void;
  onAll: () => void;
}) {
  const { chips, more } = useMemo(() => variationChips(current, members, sessions), [current, members, sessions]);
  const chip = 'h-8 flex-none rounded-[8px] border px-3 text-[13px] font-semibold whitespace-nowrap transition-colors';
  const list = chips.map((v) => {
    const on = v.id === current.id;
    const yours = !on && sessions(v.id) > 0;
    return (
      <button
        key={v.id}
        type="button"
        role="radio"
        aria-checked={on}
        onClick={() => onPick(v.id)}
        className={cx(chip, on ? 'border-accent bg-done text-fg' : yours ? 'border-accent text-fg' : 'border-line-strong text-fg2')}
      >
        {labels.get(v.id) ?? v.name}
        {on && wrap && <span className="ml-1 font-normal text-fg2">· this</span>}
      </button>
    );
  });
  const all = more > 0 && (
    <button type="button" onClick={onAll} aria-label={`All ${members.length} variations`} className={cx(chip, 'border-line-strong text-accent')}>
      {wrap ? `All ${members.length} ›` : `+${more}`}
    </button>
  );
  if (wrap)
    return (
      <div className="mt-2.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Variation">
        {list}
        {all}
      </div>
    );
  return (
    <div className="-mx-4 mt-2.5 flex items-center gap-1.5 pr-4">
      <div className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto pl-4" role="radiogroup" aria-label="Variation">
        {list}
      </div>
      {all}
    </div>
  );
}
