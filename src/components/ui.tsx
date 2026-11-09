import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { CheckGlyph, ChevronLeft, ChevronRight, PlayGlyph } from './icons';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

// ───────────────────────────── layout

/** A full-height screen: fixed header, scrolling body, optional fixed footer. */
export function Screen({
  header,
  footer,
  children,
  bodyClass = '',
  scrollRef,
  noPad = false,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  bodyClass?: string;
  scrollRef?: React.Ref<HTMLDivElement>;
  noPad?: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {header}
      <div ref={scrollRef} className={cx('scroll-y relative min-h-0 flex-1', !noPad && 'px-4', !footer && 'pb-safe', bodyClass)}>
        {children}
        {!footer && <div className="h-6" />}
      </div>
      {footer && <div data-dock className="flex-none">{footer}</div>}
    </div>
  );
}

/** Top bar (nh): Cancel / ‹ Back on the left, title, Save / Done on the right. */
export function TopBar({ left, title, right, border = true }: { left?: ReactNode; title?: ReactNode; right?: ReactNode; border?: boolean }) {
  return (
    <header className={cx('grid min-h-[52px] flex-none grid-cols-[1fr_auto_1fr] items-center gap-2 px-2', border && 'border-b border-line')}>
      <div className="flex min-w-0 justify-start">{left}</div>
      <div className="max-w-[200px] truncate text-center text-[17px] font-bold">{title}</div>
      <div className="flex min-w-0 justify-end">{right}</div>
    </header>
  );
}

type BarButtonKind = 'plain' | 'bold' | 'muted';

/** Text button for top bars, 44 px tall. */
export function BarButton({
  children,
  kind = 'plain',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: BarButtonKind }) {
  return (
    <button
      type="button"
      className={cx(
        'flex h-11 items-center gap-1 rounded-lg px-2 text-[17px] whitespace-nowrap active:opacity-60 disabled:opacity-35',
        kind === 'muted' ? 'font-normal text-fg2' : kind === 'bold' ? 'font-bold text-accent' : 'font-medium text-accent',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <BarButton onClick={onClick} className="pl-1" aria-label={`Back to ${label}`}>
      <ChevronLeft size={17} className="mr-0.5" />
      {label}
    </BarButton>
  );
}

/** Large title header (bh). */
export function LargeHeader({ title, subtitle, right }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <header className="flex-none px-4 pt-2 pb-2">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-[34px] leading-[1.1] font-bold tracking-[-0.02em]">{title}</h1>
        {right && <div className="-mr-1.5 flex flex-none items-center gap-1">{right}</div>}
      </div>
      {subtitle && <div className="text-[13px] text-fg2">{subtitle}</div>}
    </header>
  );
}

/** 10 px caps section label with an optional action on the right (lbl). */
export function SectionLabel({ children, action, className = '', tone }: { children: ReactNode; action?: ReactNode; className?: string; tone?: 'warn' | 'accent' }) {
  return (
    <div
      className={cx(
        'mt-5 flex items-end justify-between border-b border-line pb-1.5 text-[11px] font-bold tracking-[0.07em] uppercase',
        tone === 'warn' ? 'text-warn' : tone === 'accent' ? 'text-accent' : 'text-fg2',
        className,
      )}
    >
      <span className="min-w-0 truncate">{children}</span>
      {action}
    </div>
  );
}

export function LabelAction({ children, onClick, tone = 'accent' }: { children: ReactNode; onClick?: () => void; tone?: 'accent' | 'muted' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx('-my-3 -mr-2 flex h-11 items-center px-2 text-[13px] font-semibold tracking-normal normal-case active:opacity-60', tone === 'accent' ? 'text-accent' : 'text-fg2')}
    >
      {children}
    </button>
  );
}

// ───────────────────────────── buttons

type ButtonKind = 'primary' | 'secondary' | 'danger' | 'ghost' | 'white';

export function Button({
  children,
  kind = 'primary',
  size = 'lg',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: ButtonKind; size?: 'lg' | 'md' }) {
  return (
    <button
      type="button"
      className={cx(
        'flex w-full items-center justify-center gap-2 font-bold transition-[transform,opacity] active:scale-[0.98] active:opacity-85 disabled:opacity-40 disabled:active:scale-100',
        size === 'lg' ? 'h-[50px] rounded-[13px] text-[17px]' : 'h-11 rounded-[11px] text-[15px]',
        kind === 'primary' && 'bg-accent text-white',
        kind === 'secondary' && 'bg-surface-2 text-fg',
        kind === 'danger' && 'bg-danger text-white',
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

/**
 * "+ Set", "+ Drop", "+ Segment": a text button with a dashed outline in its own
 * tone, so it reads as a placeholder for the row it adds (4.1, 4.3, 2.3, 6.7).
 */
export function AddButton({ children, tone = 'accent', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'accent' | 'warn' }) {
  return (
    <button
      type="button"
      className={cx(
        // Grey dashed edge, like "+ Add exercise"; the label keeps the colour.
        'flex h-11 items-center justify-center rounded-[10px] border border-dashed border-line-strong text-[15px] font-semibold active:opacity-60 disabled:opacity-40',
        tone === 'warn' ? 'text-warn' : 'text-accent',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Round ▶ start button (blue for Next, grey otherwise). */
export function PlayButton({ primary, onClick, label }: { primary?: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="-mr-2 flex h-11 w-11 flex-none items-center justify-center active:scale-95"
    >
      <span className={cx('flex h-[34px] w-[34px] items-center justify-center rounded-full', primary ? 'bg-accent text-white' : 'bg-surface-2 text-fg2')}>
        <PlayGlyph size={12} className="ml-[2px]" />
      </span>
    </button>
  );
}

/** A done day in a list (3.4, 2.15): the same 34 px disc and spot as PlayButton, so rows line up. */
export function DoneDisc() {
  return (
    <span aria-label="done" className="-mr-2 flex h-11 w-11 flex-none items-center justify-center">
      <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-accent text-white">
        <CheckGlyph size={15} />
      </span>
    </span>
  );
}

/** Bordered small icon button (ib) used in the exercise header. */
export function IconButton({ children, onClick, label, active }: { children: ReactNode; onClick: () => void; label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-11 min-w-11 items-center justify-center active:opacity-60"
    >
      <span
        className={cx(
          'flex h-[30px] min-w-[38px] items-center justify-center rounded-[9px] border px-2 text-[13px] font-semibold',
          active ? 'border-accent bg-accent text-white' : 'border-line-strong text-accent',
        )}
      >
        {children}
      </span>
    </button>
  );
}

// ───────────────────────────── rows

/** A flat list row with hairline divider; tappable when onClick is set. */
export function Row({
  children,
  onClick,
  className = '',
  chevron,
  as = 'div',
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  chevron?: boolean;
  as?: 'div' | 'li';
}) {
  const Tag = onClick ? 'button' : as;
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cx('flex min-h-[52px] w-full items-center gap-3 border-b border-line text-left', onClick && 'active:bg-surface/60', className)}
    >
      {children}
      {chevron && <ChevronRight size={13} className="flex-none text-fg3" />}
    </Tag>
  );
}

// ───────────────────────────── controls

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  variant = 'default',
  className = '',
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  variant?: 'default' | 'strong';
  className?: string;
}) {
  return (
    <div role="tablist" className={cx('flex rounded-[10px] bg-surface p-[2px]', className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cx(
              'h-9 min-w-0 flex-1 rounded-[8px] text-[13px] font-semibold transition-colors',
              on ? (variant === 'strong' ? 'bg-key-fn text-fg shadow-none' : 'bg-key-fn text-fg') : 'text-fg2',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
  wrap = false,
  className = '',
}: {
  options: { value: T; label: ReactNode }[];
  value: T | undefined;
  onChange: (v: T) => void;
  wrap?: boolean;
  className?: string;
}) {
  return (
    <div className={cx('flex gap-1.5', wrap ? 'flex-wrap' : 'no-scrollbar -mx-4 overflow-x-auto px-4', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'h-[34px] flex-none rounded-full px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors',
            o.value === value ? 'bg-fg text-bg' : 'bg-surface text-fg2',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cx('relative h-[31px] w-[51px] flex-none rounded-full transition-colors', on ? 'bg-accent' : 'bg-key-fn')}
    >
      <span className={cx('absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-sm transition-[left]', on ? 'left-[22px]' : 'left-[2px]')} />
    </button>
  );
}

export function Radio({ on }: { on: boolean }) {
  return <span aria-hidden className={cx('block h-[22px] w-[22px] flex-none rounded-full', on ? 'border-[7px] border-accent' : 'border-[1.5px] border-fg3')} />;
}

/** Round checkbox (cb). */
export function Check({ on, disabled }: { on: boolean; disabled?: boolean }) {
  return (
    <span
      aria-hidden
      className={cx(
        'flex h-[24px] w-[24px] flex-none items-center justify-center rounded-full border-[1.5px]',
        on ? 'border-accent bg-accent text-white' : 'border-fg3',
        disabled && 'opacity-50',
      )}
    >
      {on && <CheckGlyph size={13} />}
    </span>
  );
}

export function Pill({ children, tone = 'muted' }: { children: ReactNode; tone?: 'accent' | 'muted' }) {
  return (
    <span className={cx('rounded-[5px] px-1.5 py-[2px] text-[10.5px] font-bold', tone === 'accent' ? 'bg-accent text-white' : 'bg-surface-2 text-fg2')}>
      {children}
    </span>
  );
}

/** Orange D badge: you dropped after this set last time. */
export function DropBadge({ small }: { small?: boolean }) {
  return (
    <span
      aria-label="drop set after"
      className={cx('inline-flex flex-none items-center justify-center rounded-[4px] bg-warn font-extrabold text-black', small ? 'h-[14px] w-[14px] text-[9px]' : 'h-[16px] w-[16px] text-[10px]')}
    >
      D
    </span>
  );
}

/** Grey caps type tag next to exercise names: BW, BW +, ASSIST, INCLINE. */
export function Tag({ children }: { children: ReactNode }) {
  return <span className="ml-1.5 inline-block rounded-[4px] border border-line-strong px-1 align-[2px] text-[9.5px] font-bold text-fg2">{children}</span>;
}

export function EmptyState({ icon, title, children, className = '' }: { icon: ReactNode; title: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex flex-col items-center px-6 text-center', className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-[1.5px] border-dashed border-line-strong text-[24px] text-fg3">{icon}</div>
      <div className="mt-3.5 text-[19px] font-bold">{title}</div>
      {children && <p className="mt-1.5 text-[14px] leading-normal text-fg2">{children}</p>}
    </div>
  );
}

/** Three equal stat cells separated by hairlines (flatstats). */
export function StatRow({ items, className = '' }: { items: { label: string; value: ReactNode }[]; className?: string }) {
  return (
    <div className={cx('grid border-y border-line', className)} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))` }}>
      {items.map((it, i) => (
        <div key={it.label} className={cx('min-w-0 py-2.5', i > 0 && 'border-l border-line pl-3')}>
          <div className="truncate text-[10.5px] font-bold tracking-[0.04em] text-fg2 uppercase">{it.label}</div>
          <div className="truncate text-[17px] font-bold">{it.value}</div>
        </div>
      ))}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="mt-2.5 flex h-10 items-center gap-2 rounded-[10px] bg-surface-2 px-3 text-fg2">
      <svg viewBox="0 0 13 13" width="14" height="14" aria-hidden>
        <circle cx="5.5" cy="5.5" r="4.3" stroke="currentColor" strokeWidth="1.6" fill="none" />
        <line x1="8.6" y1="8.6" x2="12" y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        enterKeyHint="search"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-fg outline-none [&::-webkit-search-cancel-button]:hidden"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {value && (
        <button type="button" aria-label="Clear search" onClick={() => onChange('')} className="-mr-2 flex h-10 w-9 items-center justify-center text-fg2">
          <span className="flex h-[17px] w-[17px] items-center justify-center rounded-full bg-fg3 text-[10px] font-bold text-bg">✕</span>
        </button>
      )}
    </label>
  );
}

export function TextField({
  value,
  onChange,
  placeholder,
  autoFocus,
  onBlur,
  onEnter,
  className = '',
  maxLength = 60,
  inputMode,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onBlur?: () => void;
  onEnter?: () => void;
  className?: string;
  maxLength?: number;
  inputMode?: 'text' | 'decimal' | 'numeric';
  label?: string;
}) {
  return (
    <input
      type="text"
      inputMode={inputMode}
      aria-label={label}
      value={value}
      autoFocus={autoFocus}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
          onEnter?.();
        }
      }}
      placeholder={placeholder}
      enterKeyHint="done"
      className={cx(
        'mt-1.5 h-11 w-full rounded-[10px] border-[1.5px] border-transparent bg-surface-2 px-3 text-[16px] outline-none focus:border-accent',
        className,
      )}
    />
  );
}

export function FieldLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={cx('mt-5 text-[11px] font-bold tracking-[0.06em] text-fg2 uppercase', className)}>{children}</div>;
}

export function Note({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={cx('mt-2.5 text-[13px] leading-normal text-fg2', className)}>{children}</p>;
}
