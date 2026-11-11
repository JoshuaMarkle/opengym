import type { ReactNode } from 'react';
import { cx } from './layout';
import { Ring } from './progress';

// design §12 Calendars. Week strips and month grids share one set of day marks, so a day means
// the same thing everywhere. Blue means done or selected, nothing else. Today is a white ring
// (green while a workout is live). Fills and rings never change a day's size.

export type DayState = 'done' | 'past' | 'planned' | 'rest' | 'missed' | 'moved' | 'paused' | 'empty';

/** 1 px dashed fg2 outline for a day changed by hand (PH3.10). `round` for discs, r10 for cells. */
export function ChangedOutline({ round }: { round?: boolean }) {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full fill-none text-fg2">
      {round ? (
        <circle cx="50%" cy="50%" r="calc(50% - 0.5px)" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
      ) : (
        <rect x="0.5" y="0.5" width="calc(100% - 1px)" height="calc(100% - 1px)" rx="9.5" stroke="currentColor" strokeWidth="1" strokeDasharray="4 3" />
      )}
    </svg>
  );
}

/**
 * design §12 Day disc: 34, 13/700. done = action fill · today = 2 px white ring (green when
 * live) · today done = action fill + canvas gap + blue ring · missed = 1 px orange ring · past
 * with nothing = surface · rest = fg3 · planned / future = white, no fill.
 */
export function DayDisc({ children, state, today, live, changed, className = '' }: { children: ReactNode; state: DayState; today?: boolean; live?: boolean; changed?: boolean; className?: string }) {
  const done = state === 'done';
  return (
    <i
      className={cx(
        'relative mx-auto flex h-8.5 w-8.5 items-center justify-center rounded-full text-footnote font-bold not-italic',
        done ? 'bg-action text-white' : state === 'past' ? 'bg-surface text-fg' : state === 'paused' ? 'bg-surface text-fg3' : state === 'rest' || state === 'empty' ? 'text-fg3' : state === 'moved' ? 'text-fg2' : 'text-fg',
        today && done && 'ring-2 ring-accent ring-offset-2 ring-offset-bg',
        today && !done && (live ? 'ring-2 ring-tip ring-inset' : 'ring-2 ring-fg ring-inset'),
        !today && state === 'missed' && 'ring-1 ring-warn ring-inset',
        className,
      )}
    >
      {changed && !done && !today && <ChangedOutline round />}
      {children}
    </i>
  );
}

/** design §12 Weekday letter over a strip or grid column: Caps 11 fg2, today white. */
export function Weekday({ children, today }: { children: ReactNode; today?: boolean }) {
  return <small className={cx('block text-caps', today ? 'text-fg' : 'text-fg2')}>{children}</small>;
}

/**
 * design §12 Day cell (month grid): h44, r10, pt 7, number Callout 14/600 on an 18 line, and a
 * 12 px marks row under it. Selected = action fill; today = 1.5 white ring (green when live);
 * missed = 1 px orange ring; changed = dashed outline, hidden when selected.
 */
export function DayCell({
  number,
  marks,
  selected,
  today,
  live,
  missed,
  changed,
  tone = 'fg',
  className = '',
  ...rest
}: {
  number: ReactNode;
  marks?: ReactNode;
  selected?: boolean;
  today?: boolean;
  live?: boolean;
  missed?: boolean;
  changed?: boolean;
  /** Number color when not selected: logged / today white, planned fg2, rest fg3. */
  tone?: 'fg' | 'fg2' | 'fg3';
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className'>) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'no-select relative flex h-11 min-w-0 flex-col items-center rounded-md pt-1.75 text-callout font-semibold active:opacity-70',
        selected ? 'bg-action text-white' : tone === 'fg3' ? 'text-fg3' : tone === 'fg2' ? 'text-fg2' : 'text-fg',
        !selected && today && (live ? 'ring-[1.5px] ring-tip ring-inset' : 'ring-[1.5px] ring-fg ring-inset'),
        !selected && !today && missed && 'ring-1 ring-warn ring-inset',
        className,
      )}
    >
      {changed && !selected && <ChangedOutline />}
      <span className="leading-4.5">{number}</span>
      <span className="flex h-3 max-w-full items-center justify-center gap-0.5">{marks}</span>
    </button>
  );
}

/** design §12 Marks row: up to 3 workout dots, 4 px, gap 2. White on a selected day. */
export function DayDots({ count, selected }: { count: number; selected?: boolean }) {
  return (
    <>
      {Array.from({ length: Math.min(count, 3) }, (_, i) => (
        <i key={i} className={cx('h-1 w-1 rounded-full', selected ? 'bg-white' : 'bg-accent')} />
      ))}
    </>
  );
}

/** design §12 Marks row: a planned routine's code, Micro 10. */
export function DayCode({ children, selected }: { children: ReactNode; selected?: boolean }) {
  return <span className={cx('flex max-w-full items-center truncate px-1 text-micro', !selected && 'text-plan-code')}>{children}</span>;
}

export type LegendItem = { label: string; mark: 'missed' | 'workout' | 'changed' | 'done' | 'today' };

/** design §12 Legend (PH3.2): Micro 10 fg2, swatches 10, dot 4, gap 8; labels have a 1 px optical offset to center their glyphs against the markers. */
export function CalendarLegend({ items, className = '' }: { items: LegendItem[]; className?: string }) {
  return (
    <div className={cx('flex flex-wrap items-center gap-x-2 gap-y-1 text-micro font-normal text-fg2', className)}>
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1 leading-none">
          {it.mark === 'workout' ? (
            <i aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-accent" />
          ) : (
            <i
              className={cx(
                'h-2.5 w-2.5 shrink-0 rounded-xs',
                it.mark === 'missed' ? 'border border-warn' : it.mark === 'changed' ? 'border border-dashed border-fg2' : it.mark === 'done' ? 'bg-action' : 'border border-fg',
              )}
            />
          )}
          <span className="relative top-px">{it.label}</span>
        </span>
      ))}
    </div>
  );
}

export interface RingDay {
  key: string;
  /** Screen-reader name, "Thu, Nov 5". */
  label?: string;
  letter: string;
  number: number;
  /** Calories against target, 0–1+ (no ring fill when undefined). */
  frac?: number;
  /** More than 3% over: orange ring and an orange dot under the day. */
  over?: boolean;
  today?: boolean;
  future?: boolean;
  selected?: boolean;
}

/**
 * design §12 Ring strip (Food day page, 10.1): seven columns of a Caps weekday over a Ring S
 * (36 / 3) with the date inside, 13/700. Today's ring is white on a line-strong track, past days
 * grey, days over target orange with an orange dot under them (color plus a mark). Future days
 * are an empty ring with a fg3 date. The selected day's weekday is white.
 */
export function RingStrip({ days, onPick, className = '' }: { days: RingDay[]; onPick: (key: string) => void; className?: string }) {
  return (
    <div className={cx('grid grid-cols-7 gap-1', className)}>
      {days.map((d) => (
        <button
          key={d.key}
          type="button"
          aria-label={d.label ?? d.key}
          aria-current={d.selected ? 'date' : undefined}
          onClick={() => onPick(d.key)}
          className="flex flex-col items-center gap-1.5 active:opacity-60"
        >
          <Weekday today={d.selected}>{d.letter}</Weekday>
          <Ring
            progress={d.future ? 0 : d.frac}
            color={d.over ? 'var(--og-warn)' : d.today ? 'var(--og-fg)' : 'var(--og-fg2)'}
            track={d.today ? 'var(--og-line-strong)' : undefined}
          >
            <span className={cx('text-footnote font-bold', d.future ? 'text-fg3' : 'text-fg')}>{d.number}</span>
          </Ring>
          <i className={cx('-mt-0.5 block h-1 w-1 rounded-full', d.over ? 'bg-warn' : 'bg-transparent')} aria-hidden />
        </button>
      ))}
    </div>
  );
}
