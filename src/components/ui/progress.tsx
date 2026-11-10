import type { ReactNode } from 'react';
import { CheckGlyph, TrendDown, TrendUp } from '../icons';
import { cx } from './layout';

// design §8 Bars & rings. Two bar thicknesses (8 for a main bar, 4 under a label) and three
// ring sizes. A bar always has its number next to it in text.

const pct = (f: number) => `${Math.max(0, Math.min(1, f)) * 100}%`;

/** design §8 Target bar: h8, the one main number on a screen against its target. Track surface-2. */
export function TargetBar({ frac, tone = 'fg', className = '' }: { frac: number; tone?: 'fg' | 'tip' | 'warn' | 'accent'; className?: string }) {
  return (
    <div className={cx('relative h-2 overflow-hidden rounded-full bg-surface-2', className)}>
      <i className={cx('absolute inset-y-0 left-0 rounded-full', tone === 'tip' ? 'bg-tip' : tone === 'warn' ? 'bg-warn' : tone === 'accent' ? 'bg-accent' : 'bg-fg')} style={{ width: pct(frac) }} />
    </div>
  );
}

/** design §8 Labeled bar: h4 under a Caps label, in the series color. Up to 3 side by side, gap 12. */
export function LabeledBar({ frac, color = 'bg-accent', className = '' }: { frac: number; color?: string; className?: string }) {
  return (
    <div className={cx('relative mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2', className)}>
      <i className={cx('absolute inset-y-0 left-0 rounded-full', color)} style={{ width: pct(frac) }} />
    </div>
  );
}

/** design §8 Goal bar: h8, green ahead / orange behind, with a white 3 × 16 marker where steady gains would put you today. */
export function GoalBar({ frac, marker, behind, markerLabel, className = '' }: { frac: number; marker?: number; behind?: boolean; markerLabel?: string; className?: string }) {
  return (
    <div className={cx('relative h-2 rounded-full bg-surface-2', className)}>
      <div className={cx('absolute inset-y-0 left-0 rounded-full', behind ? 'bg-warn' : 'bg-tip')} style={{ width: pct(frac) }} />
      {marker != null && <div className="absolute -top-1 h-4 w-0.75 -translate-x-1/2 rounded-full bg-fg" style={{ left: pct(marker) }} aria-label={markerLabel} />}
    </div>
  );
}

export type Step = 'done' | 'current' | 'todo';

/** design §8 Segmented bar: h4, one segment per step, gap 4. Done blue, current white, to do surface-2. */
export function SegmentBar({ steps, className = '' }: { steps: Step[]; className?: string }) {
  return (
    <div className={cx('flex gap-1', className)} aria-hidden>
      {steps.map((s, i) => (
        <i key={i} className={cx('h-1 flex-1 rounded-full', s === 'done' ? 'bg-accent' : s === 'current' ? 'bg-fg' : 'bg-surface-2')} />
      ))}
    </div>
  );
}

export type RingSize = 's' | 'row' | 'm' | 'l';
const RING: Record<RingSize, { px: number; stroke: number }> = { s: { px: 36, stroke: 3 }, row: { px: 28, stroke: 3 }, m: { px: 104, stroke: 8 }, l: { px: 144, stroke: 10 } };

/**
 * design §8 Ring: S 36/3 (28/3 in rows), M 104/8, L 144/10. `progress` (0–1, blue from 12
 * o'clock) or `segments` (fractions in series order, round caps, a 3 px gap). Track surface-2.
 */
export function Ring({ size = 's', progress, segments, color = 'var(--og-accent)', children, className = '' }: { size?: RingSize; progress?: number; segments?: { frac: number; color: string }[]; color?: string; children?: ReactNode; className?: string }) {
  const { px, stroke } = RING[size];
  const r = px / 2 - stroke / 2;
  const c = 2 * Math.PI * r;
  const gap = segments && segments.filter((s) => s.frac > 0).length > 1 ? 3 + stroke : 0;
  let at = 0;
  return (
    <span className={cx('relative flex flex-none items-center justify-center', className)} style={{ width: px, height: px }}>
      <svg width={px} height={px} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={px / 2} cy={px / 2} r={r} fill="none" stroke="var(--og-surface-2)" strokeWidth={stroke} />
        {progress != null && progress > 0 && <circle cx={px / 2} cy={px / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={`${c * Math.min(1, progress)} ${c}`} strokeLinecap="round" />}
        {segments?.map((s, i) => {
          if (s.frac <= 0) return null;
          const len = Math.max(0, c * s.frac - gap);
          const el = <circle key={i} cx={px / 2} cy={px / 2} r={r} fill="none" stroke={s.color} strokeWidth={stroke} strokeDasharray={`${len} ${c}`} strokeDashoffset={-at} strokeLinecap="round" />;
          at += c * s.frac;
          return el;
        })}
      </svg>
      {children !== undefined && <span className="relative flex flex-col items-center justify-center text-center">{children}</span>}
    </span>
  );
}

/** A Ring S in a row (4.12): "2/4" while going, a full ring with a check once every set is done. */
export function CountRing({ done, total }: { done: number; total: number }) {
  const complete = total > 0 && done >= total;
  return (
    <Ring size="row" progress={total ? done / total : 0}>
      {complete ? <CheckGlyph size={12} className="text-accent" /> : <span className={cx('text-micro', done > 0 ? 'text-fg' : 'text-fg2')}>{`${done}/${total}`}</span>}
    </Ring>
  );
}

/** A trend number or word with TrendUp / TrendDown 9 in front (design §3: never a typed ▲ ▼). No `dir`: the text alone. */
export function TrendText({ dir, children, className = '' }: { dir?: 'up' | 'down'; children: ReactNode; className?: string }) {
  if (!dir) return <span className={className}>{children}</span>;
  return (
    <span className={cx('inline-flex items-center gap-1', className)}>
      {dir === 'up' ? <TrendUp size={9} className="flex-none" /> : <TrendDown size={9} className="flex-none" />}
      <span>{children}</span>
    </span>
  );
}
