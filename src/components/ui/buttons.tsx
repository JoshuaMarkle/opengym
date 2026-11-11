import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { CheckGlyph, ChevronLeft, ChevronRight, PlayGlyph } from '../icons';
import { cx } from './layout';

// design §9 Buttons. One filled size, two disc sizes, the dashed add, small bordered
// buttons, text buttons, nav cards and the floating button.

type ButtonKind = 'primary' | 'secondary' | 'danger' | 'ghost' | 'white';

/**
 * design §9 Filled button: one size, 44 / r10 / 15/700, full width or shared in a grid.
 * `compact` (36 / r10 / 15/600) is the live workout's Finish and nothing else.
 */
export function Button({ children, kind = 'primary', size, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: ButtonKind; size?: 'compact' }) {
  return (
    <button
      type="button"
      className={cx(
        'flex items-center justify-center gap-2 rounded-md text-body transition-[transform,opacity,background-color] active:scale-98 disabled:opacity-40 disabled:active:scale-100',
        size === 'compact' ? 'h-9 flex-none px-4 font-semibold' : 'h-11 w-full font-bold',
        kind === 'primary' && 'bg-action text-white active:bg-action-pressed disabled:active:bg-action',
        kind === 'secondary' && 'bg-surface-2 text-fg',
        kind === 'danger' && 'bg-danger-fill text-white',
        kind === 'ghost' && 'bg-transparent text-accent',
        kind === 'white' && 'bg-fg text-bg',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export type DiscTone = 'action' | 'grey' | 'success' | 'warn' | 'danger';

const DISC_TONE: Record<DiscTone, string> = {
  action: 'bg-action text-white',
  grey: 'bg-surface-2 text-fg2',
  success: 'bg-tip text-black',
  warn: 'bg-warn text-black',
  danger: 'bg-danger-fill text-white',
};

/** The drawn circle only: S 24 at the start of a row, L 34 when the disc is the button. */
export function DiscFace({ size = 'l', tone = 'action', children, className = '' }: { size?: 's' | 'l'; tone?: DiscTone; children?: ReactNode; className?: string }) {
  return <span className={cx('flex flex-none items-center justify-center rounded-full', size === 's' ? 'h-6 w-6' : 'h-8.5 w-8.5', DISC_TONE[tone], className)}>{children}</span>;
}

/**
 * design §9 Disc: a round one-tap answer (start, done, accept, dismiss, add, delete), always
 * in a 44 target. Glyph 12 in S, 14 in L. Fill = meaning. Without `onClick` it's a mark.
 */
export function Disc({
  size = 'l',
  tone = 'action',
  children,
  onClick,
  label,
  className = '',
  faceClassName = '',
  disabled,
}: {
  size?: 's' | 'l';
  tone?: DiscTone;
  children?: ReactNode;
  onClick?: () => void;
  label: string;
  /** On the 44 target, e.g. `-mr-2` to sit flush with the row's edge. */
  className?: string;
  faceClassName?: string;
  disabled?: boolean;
}) {
  const face = (
    <DiscFace size={size} tone={tone} className={faceClassName}>
      {children}
    </DiscFace>
  );
  if (!onClick)
    return (
      <span role="img" aria-label={label} className={cx('flex h-11 w-11 flex-none items-center justify-center', className)}>
        {face}
      </span>
    );
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cx('flex h-11 w-11 flex-none items-center justify-center active:scale-95 disabled:opacity-40', className)}
    >
      {face}
    </button>
  );
}

/** design §9 Disc L with PlayGlyph: blue for Next, grey otherwise. */
export function PlayButton({ primary, onClick, label }: { primary?: boolean; onClick: () => void; label: string }) {
  return (
    <Disc tone={primary ? 'action' : 'grey'} onClick={onClick} label={label} className="-mr-2">
      <PlayGlyph size={12} className="ml-0.5" />
    </Disc>
  );
}

/** design §9 Disc L with CheckGlyph: a done day in a list (3.4, 2.15), on the same spot as PlayButton so rows line up. */
export function DoneDisc() {
  return (
    <Disc label="done" className="-mr-2">
      <CheckGlyph size={14} />
    </Disc>
  );
}

/** design §9 Start pill (3.4 / PH3.1 / PH3.6): 34 full, 14/700, PlayGlyph 12, in a 44 target. */
export function StartPill({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="-mr-2 flex h-11 flex-none items-center px-1.5 active:scale-95">
      <span className="flex h-8.5 items-center gap-2 rounded-full bg-action px-3 text-callout font-bold text-white">
        <PlayGlyph size={12} />
        <span className="translate-y-px leading-none">Start</span>
      </span>
    </button>
  );
}

/**
 * design §9 Dashed add: "+ Set", "+ Drop", "+ Add exercise", "+ Segment". 44 / r10 / 15/600,
 * a grey dashed edge and the label in its tone, so it reads as a placeholder for the row it adds.
 */
export function AddButton({ children, tone = 'accent', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'accent' | 'warn' }) {
  return (
    <button
      type="button"
      className={cx(
        'flex h-11 items-center justify-center rounded-md border border-dashed border-line-strong text-body font-semibold active:opacity-60 disabled:opacity-40',
        tone === 'warn' ? 'text-warn' : 'text-accent',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** design §9 Bordered small: 32 / min-w 40 / r10 / 13/600 blue in a 44 target. Glyphs only (MoreGlyph, ChevronDown). On = action fill. */
export function IconButton({ children, onClick, label, active }: { children: ReactNode; onClick: () => void; label: string; active?: boolean }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="flex h-11 min-w-11 items-center justify-center active:opacity-60">
      <span
        className={cx(
          'flex h-8 min-w-10 items-center justify-center gap-1 rounded-md border px-2.5 text-footnote font-semibold',
          active ? 'border-action bg-action text-white' : 'border-line-strong text-accent',
        )}
      >
        {children}
      </span>
    </button>
  );
}

/** design §9 Text button: a low-weight action in content ("Why", "Undo", "Do it today"). 15/600 blue, 44 tall; `small` is 13/600. */
export function TextButton({ children, tone = 'accent', small, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'accent' | 'muted' | 'danger'; small?: boolean }) {
  return (
    <button
      type="button"
      className={cx(
        'flex h-11 flex-none items-center active:opacity-60 disabled:opacity-40',
        small ? 'text-footnote' : 'text-body',
        tone === 'muted' ? 'text-fg2' : tone === 'danger' ? 'font-semibold text-danger' : 'font-semibold text-accent',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * design §9 Nav card: Previous / Next between exercises (4.1). 52 tall (44 while the keypad is
 * open), r10, Caps 11 over Callout 14/600, drawn chevrons. The last one turns into the
 * action-filled "Finish".
 */
export function NavCard({
  children,
  small,
  onClick,
  side,
  tone,
  align,
  compact,
}: {
  children: ReactNode;
  small: string;
  onClick: () => void;
  side?: 'left' | 'right';
  tone?: 'action';
  align?: 'right';
  compact?: boolean;
}) {
  const right = side === 'right' || align === 'right';
  const action = tone === 'action';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex min-w-0 items-center gap-2 rounded-md px-3 transition-colors active:opacity-80',
        compact ? 'h-11' : 'h-13',
        right ? 'justify-end text-right' : 'text-left',
        action ? 'bg-action text-white' : 'bg-surface-2 text-fg',
      )}
    >
      {side === 'left' && <ChevronLeft size={13} className="flex-none text-fg2" />}
      <span className="min-w-0">
        <small className={cx('block text-caps', action ? 'text-white/75' : 'text-fg2')}>{small}</small>
        <span className="block truncate text-callout font-semibold">{children}</span>
      </span>
      {side === 'right' && <ChevronRight size={13} className={cx('flex-none', action ? 'text-white/80' : 'text-fg2')} />}
    </button>
  );
}

/** design §9 Floating button: 48 × 48 / r10 / surface-2. Opens the keypad; shares the toast's row (`data-dock-side`). */
export function Fab({ children, label, onClick, className = '' }: { children: ReactNode; label: string; onClick: () => void; className?: string }) {
  return (
    <button type="button" data-dock-side aria-label={label} onClick={onClick} className={cx('flex h-12 w-12 items-center justify-center rounded-md bg-surface-2 text-fg ring-2 ring-bg active:brightness-125', className)}>
      {children}
    </button>
  );
}

/**
 * design §9 Shortcut tile (Add food, 10.14): four in a row, gap 8. 60 / r10 / surface, a blue
 * 20 px glyph over a 12/600 label. A tap target, not a choice: it never shows a selected state.
 */
export function ShortcutTile({ icon, children, onClick }: { icon: ReactNode; children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex h-15 flex-col items-center justify-center gap-1.5 rounded-md bg-surface text-caption font-semibold active:opacity-60">
      <span className="flex text-accent">{icon}</span>
      {children}
    </button>
  );
}
