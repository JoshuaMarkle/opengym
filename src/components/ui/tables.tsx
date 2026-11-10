import type { ReactNode } from 'react';
import { cx } from './layout';

// design §7 Tables: rows on a CSS grid, fixed px columns for numbers and one flexible column.
// No vertical rules, zebra stripes or boxes. (The set table itself is screens/workout/SetTable.)

/** The set table's columns minus the tick: 34 · flex · 74 · 58 (design §7). */
export function planColumns(showPrev: boolean, showWeight: boolean): string {
  if (showPrev) return showWeight ? 'grid-cols-[34px_minmax(0,1fr)_74px_58px]' : 'grid-cols-[34px_minmax(0,1fr)_58px]';
  return showWeight ? 'grid-cols-[34px_minmax(0,1fr)_58px]' : 'grid-cols-[34px_minmax(0,1fr)]';
}

export type PlanRow = { id: string; label: ReactNode; prev?: ReactNode; weight?: ReactNode; reps: ReactNode };

/**
 * design §7 Plan table (2.11): a read-only copy of the set table, so nothing moves when the
 * workout begins. Header Caps h24, rows h28 (not tappable): set 13/700 fg2, previous Callout fg2,
 * values Callout 14/600, empty "—" fg3.
 */
export function PlanTable({ rows, showPrev, weightLabel, className = '' }: { rows: PlanRow[]; showPrev: boolean; weightLabel?: string; className?: string }) {
  const cols = cx('grid items-center gap-1.5 text-center', planColumns(showPrev, weightLabel !== undefined));
  return (
    <div className={cx('mt-1.5', className)}>
      <div className={cx(cols, 'h-6 text-caps text-fg2')}>
        <span>Set</span>
        {showPrev && <span>Previous</span>}
        {weightLabel !== undefined && <span>{weightLabel}</span>}
        <span>Reps</span>
      </div>
      {rows.map((r) => (
        <div key={r.id} className={cx(cols, 'h-7 text-callout')}>
          <span className="text-footnote font-bold text-fg2">{r.label}</span>
          {showPrev && <span className="flex min-w-0 items-center justify-center gap-1 truncate text-fg2">{r.prev}</span>}
          {weightLabel !== undefined && <span className="font-semibold">{r.weight}</span>}
          <span className="font-semibold">{r.reps}</span>
        </div>
      ))}
    </div>
  );
}

/** An empty plan / data cell: "—" in fg3. */
export function Dash() {
  return <span className="text-fg3">—</span>;
}

/**
 * design §7 Info table: many facts about one thing. Header h24 with a Caps title and an optional
 * Caption note on the right; rows h32 Callout. A new group is a new InfoTable (mt 20).
 */
export function InfoTable({ title, note, children, className = '' }: { title: ReactNode; note?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx('mt-5', className)} role="table">
      <div className="flex h-6 items-end justify-between border-b border-line pb-1">
        <span className="text-caps text-fg2">{title}</span>
        {note && <span className="text-caption text-fg2">{note}</span>}
      </div>
      {children}
    </div>
  );
}

/** design §7 Info row: h32, hairline, Callout 14. Name left, value right (fg2 unless `strong`). `sub` indents 16 with the label in fg2. */
export function InfoRow({ label, value, sub, strong, tone, className = '' }: { label: ReactNode; value?: ReactNode; sub?: boolean; strong?: boolean; tone?: 'warn' | 'tip' | 'danger'; className?: string }) {
  return (
    <div role="row" className={cx('flex min-h-8 items-center justify-between gap-3 border-b border-line text-callout', sub && 'pl-4', className)}>
      <span role="cell" className={cx('min-w-0 truncate', sub && 'text-fg2')}>
        {label}
      </span>
      {value !== undefined && (
        <span role="cell" className={cx('flex-none text-right', tone === 'warn' ? 'font-bold text-warn' : tone === 'tip' ? 'font-bold text-tip' : tone === 'danger' ? 'font-bold text-danger' : strong ? 'font-bold' : 'text-fg2')}>
          {value}
        </span>
      )}
    </div>
  );
}

/** design §7 Info sub-row: indented 16, label fg2. */
export function InfoSubRow(props: Omit<Parameters<typeof InfoRow>[0], 'sub'>) {
  return <InfoRow {...props} sub />;
}

/** design §7 Data table header: h24, Caps 11 fg2, column gap 10. `cols` is the grid template class. */
export function DataHeader({ cols, children, className = '' }: { cols: string; children: ReactNode; className?: string }) {
  return <div className={cx('grid h-6 items-center gap-2.5 text-caps text-fg2', cols, className)}>{children}</div>;
}

/** design §7 Data row: h32, hairline, Callout 14, gap 10. `highlight`: accent-soft, r8, 6 px outset, no hairline. */
export function DataRow({ cols, highlight, children, className = '' }: { cols: string; highlight?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={cx('grid h-8 items-center gap-2.5 border-b border-line text-callout whitespace-nowrap', cols, highlight && '-mx-1.5 rounded-sm border-transparent bg-accent-soft px-1.5', className)}>
      {children}
    </div>
  );
}

/** design §7 Inline bar: h8 in a data table. Grey fill, blue when recent. */
export function InlineBar({ frac, recent }: { frac: number; recent?: boolean }) {
  return (
    <span className="relative h-2 rounded-full bg-surface-2">
      <i className={cx('absolute inset-y-0 left-0 rounded-full', recent ? 'bg-accent' : 'bg-bar')} style={{ width: `${Math.max(0, Math.min(100, frac * 100))}%` }} />
    </span>
  );
}

/**
 * design §7 Stat row: equal cells, py 10, pl 12, hairlines top, bottom and between. Label Caps 11
 * fg2, value Headline 17, optional detail Caption 12 fg2.
 */
export function StatRow({ items, className = '' }: { items: { label: string; value: ReactNode; detail?: ReactNode }[]; className?: string }) {
  return (
    <div className={cx('grid border-y border-line', className)} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))` }}>
      {items.map((it, i) => (
        <div key={it.label} className={cx('min-w-0 py-2.5', i > 0 && 'border-l border-line pl-3')}>
          <div className="truncate text-caps text-fg2">{it.label}</div>
          <div className="truncate text-headline">{it.value}</div>
          {it.detail && <div className="truncate text-caption text-fg2">{it.detail}</div>}
        </div>
      ))}
    </div>
  );
}
