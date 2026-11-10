import type { ReactNode } from 'react';
import { CheckGlyph, ChevronDown, ChevronRight, MinusGlyph, PlusGlyph, SearchGlyph } from '../icons';
import { cx } from './layout';

// design §10 Controls & inputs. A selected thing is either filled (filter chips, segmented,
// toggles, checkboxes, the field switch) or outlined in blue with a soft tint (variation chips,
// choice tiles, the cell being edited). Never both.

type Option<T> = { value: T; label: ReactNode; ariaLabel?: string };

/** design §10 Segmented: 2–4 views of the same content. Track 44 / r14 / p4, items 36 / r10, 13/600. */
export function Segmented<T extends string | number>({ options, value, onChange, className = '' }: { options: Option<T>[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cx('flex rounded-lg bg-surface p-1', className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="tab"
            aria-selected={on}
            aria-label={o.ariaLabel}
            onClick={() => onChange(o.value)}
            className={cx('h-9 min-w-0 flex-1 rounded-md text-footnote font-semibold transition-colors', on ? 'bg-key-fn text-fg' : 'text-fg2')}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** design §10 Icon segmented: the view switch in a large-title header. Track 44 / r14 / p4, items 40 × 36 / r10, glyph 18. */
export function IconSegmented<T extends string>({ options, value, onChange, label }: { options: Option<T>[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex rounded-lg bg-surface p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            aria-label={o.ariaLabel}
            onClick={() => onChange(o.value)}
            className={cx('flex h-9 w-10 items-center justify-center rounded-md', on ? 'bg-key-fn text-fg' : 'text-fg2')}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * design §10 Compact segmented: toolbars, form rows, legends. Track 32 / r10 / p2, items 28 / r8 /
 * px 10, 13/600, each in a 44-tall target. `neutral` selects with key-fn (a mode, "123 | Plates");
 * `action` fills blue (the field being typed, "lbs | reps"). `instant` picks on pointer-down
 * without taking focus, so the keypad's field keeps it.
 */
export function CompactSegmented<T extends string>({
  options,
  value,
  onChange,
  tone = 'neutral',
  label,
  instant = false,
  className = '',
}: {
  options: Option<T>[];
  value: T | undefined;
  onChange: (v: T) => void;
  tone?: 'neutral' | 'action';
  label: string;
  instant?: boolean;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cx('relative flex items-center px-0.5', className)}>
      <span aria-hidden className="absolute inset-x-0 top-1/2 h-8 -translate-y-1/2 rounded-md bg-surface" />
      {options.map((o) => {
        const on = o.value === value;
        const pick = () => {
          if (!on) onChange(o.value);
        };
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            aria-label={o.ariaLabel}
            {...(instant
              ? {
                  onPointerDown: (e: React.PointerEvent) => {
                    e.preventDefault();
                    pick();
                  },
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      pick();
                    }
                  },
                }
              : { onClick: pick })}
            className="relative flex h-11 items-center"
          >
            <span
              className={cx(
                'flex h-7 items-center rounded-sm px-2.5 text-footnote font-semibold whitespace-nowrap transition-colors',
                on ? (tone === 'action' ? 'bg-action text-white' : 'bg-key-fn text-fg') : 'text-fg2',
              )}
            >
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** design §10 Filter chips: 34 full / px 14 / 13/600, gap 6. On = white fill, black text. Scroll sideways to the screen edge. */
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
          className={cx('h-8.5 flex-none rounded-full px-3.5 text-footnote font-semibold whitespace-nowrap transition-colors', o.value === value ? 'bg-fg text-bg' : 'bg-surface text-fg2')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * design §10 Variation chip: 32 / r8 / px 12 / 13/600 / 1.5 border. Current = blue border +
 * done fill; has history = blue border; others = line-strong, fg2; `more` = the blue "All N" / "+N".
 */
export function VariationChip({ state, children, onClick, ariaLabel }: { state: 'current' | 'history' | 'other' | 'more'; children: ReactNode; onClick: () => void; ariaLabel?: string }) {
  const radio = state !== 'more';
  return (
    <button
      type="button"
      {...(radio ? { role: 'radio', 'aria-checked': state === 'current' } : {})}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cx(
        'flex h-8 flex-none items-center gap-1 rounded-sm border-[1.5px] px-3 text-footnote font-semibold whitespace-nowrap transition-colors',
        state === 'current' ? 'border-accent bg-done text-fg' : state === 'history' ? 'border-accent text-fg' : state === 'more' ? 'border-line-strong text-accent' : 'border-line-strong text-fg2',
      )}
    >
      {children}
    </button>
  );
}

/** "All 6" with its chevron, for a VariationChip of state `more`. */
export function MoreLabel({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ChevronRight size={9} />
    </>
  );
}

/** design §10 Choice tile: one of 2–6 options with a label and a value. 52 / r10 / 1.5 border; Micro caps label over Callout 14/600. Selected = blue border + accent-soft. */
export function ChoiceTile({ on, label, value, onClick }: { on: boolean; label: ReactNode; value: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx('flex h-13 flex-col items-center justify-center rounded-md border-[1.5px]', on ? 'border-accent bg-accent-soft' : 'border-line-strong')}
    >
      <span className="text-micro tracking-wider text-fg2 uppercase">{label}</span>
      <span className="mt-1 text-callout font-semibold">{value}</span>
    </button>
  );
}

/** design §10 Text field look, for native inputs (date, time) that can't use TextField: 44 / r10 / surface-2 / 16, blue border on focus. */
export const fieldClass = 'h-11 w-full rounded-md border-[1.5px] border-transparent bg-surface-2 px-3 text-input text-fg outline-none focus:border-accent';

/** design §10 Text field: names, notes, goal numbers. 44 / r10 / surface-2 / px 12 / 16/400; 1.5 border, blue on focus. */
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
      className={cx('mt-1.5', fieldClass, className)}
    />
  );
}

/**
 * design §10 Value box: a number with a unit. 44 / r10 / surface-2, centered 17/700 + unit
 * Footnote 13/600 fg2. Editing: 1.5 blue border + edit fill.
 */
export function ValueBox({
  value,
  onChange,
  unit,
  placeholder,
  label,
  inputMode = 'decimal',
  maxLength = 6,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  placeholder?: string;
  label: string;
  inputMode?: 'decimal' | 'numeric';
  maxLength?: number;
  className?: string;
}) {
  return (
    <label className={cx('mt-1.5 flex h-11 items-center justify-center gap-1 rounded-md border-[1.5px] border-transparent bg-surface-2 px-3 focus-within:border-accent focus-within:bg-edit', className)}>
      <input
        type="text"
        inputMode={inputMode}
        aria-label={label}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        enterKeyHint="done"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        // 17 px stays above iOS's 16 px zoom threshold.
        className="w-full min-w-0 bg-transparent text-center text-headline outline-none"
      />
      {unit && <span className="flex-none text-footnote font-semibold text-fg2">{unit}</span>}
    </label>
  );
}

/** design §10 Picker box: a value box that opens a sheet. Label 17/600, ChevronDown 9 fg2 12 from the right. */
export function PickerBox({ children, onClick, label }: { children: ReactNode; onClick: () => void; label: string }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="relative mt-1.5 flex h-11 w-full items-center justify-center rounded-md bg-surface-2 text-body-lg font-semibold active:opacity-70">
      {children}
      <ChevronDown size={9} className="absolute right-3 text-fg2" />
    </button>
  );
}

/** design §10 Inline input: a number at the end of a 52 row. 32 / r8 / min-w 80 / px 10, 16/600 right-aligned + unit 13 fg2. */
export function InlineInput({ value, onChange, unit, label }: { value: string; onChange: (v: string) => void; unit?: string; label: string }) {
  return (
    <label className="flex h-8 min-w-20 items-center justify-end gap-1 rounded-sm border-[1.5px] border-transparent bg-surface-2 px-2.5 focus-within:border-accent focus-within:bg-edit">
      <input
        type="text"
        inputMode="decimal"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-12 min-w-0 bg-transparent text-right text-input font-semibold outline-none"
      />
      {unit && <span className="text-footnote text-fg2">{unit}</span>}
    </label>
  );
}

/** design §10 Stepper: two 36 × 32 / r8 buttons with Minus / Plus 14 blue, the value (Input 16/600) between, gap 8. */
export function Stepper({ children, onDown, onUp, label }: { children: ReactNode; onDown: () => void; onUp: () => void; label: string }) {
  const btn = 'flex h-11 items-center';
  const face = 'flex h-8 w-9 items-center justify-center rounded-sm bg-surface-2 text-accent active:opacity-60';
  return (
    <span className="flex items-center gap-2">
      <button type="button" aria-label={`Less ${label}`} onClick={onDown} className={btn}>
        <span className={face}>
          <MinusGlyph size={14} />
        </span>
      </button>
      <span className="min-w-8 text-center text-input font-semibold">{children}</span>
      <button type="button" aria-label={`More ${label}`} onClick={onUp} className={btn}>
        <span className={face}>
          <PlusGlyph size={14} />
        </span>
      </button>
    </span>
  );
}

/** design §10 Search: 40 / r10 / surface-2, SearchGlyph 14 fg2, gap 8, 16/400. Clear is a ✕ in a 17 px fg3 circle. */
export function SearchField({ value, onChange, placeholder, autoFocus }: { value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean }) {
  return (
    <label className="mt-2.5 flex h-10 items-center gap-2 rounded-md bg-surface-2 px-3 text-fg2">
      <SearchGlyph size={14} />
      <input
        type="search"
        enterKeyHint="search"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent text-input text-fg outline-none [&::-webkit-search-cancel-button]:hidden"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {value && (
        <button type="button" aria-label="Clear search" onClick={() => onChange('')} className="-mr-2 flex h-10 w-9 items-center justify-center text-fg2">
          <span className="flex h-4.25 w-4.25 items-center justify-center rounded-full bg-fg3 text-micro text-bg">✕</span>
        </button>
      )}
    </label>
  );
}

/** design §10 Toggle: 51 × 31, knob 27. On = action blue, off = key-fn. Always trailing in a row. */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cx('relative h-7.75 w-12.75 flex-none rounded-full transition-colors', on ? 'bg-action' : 'bg-key-fn')}
    >
      <span className={cx('absolute top-0.5 h-6.75 w-6.75 rounded-full bg-white shadow-sm transition-[left]', on ? 'left-5.5' : 'left-0.5')} />
    </button>
  );
}

/** design §10 Radio: 22, 1.5 fg3 ring; on = a 7 px blue ring. */
export function Radio({ on }: { on: boolean }) {
  return <span aria-hidden className={cx('block h-5.5 w-5.5 flex-none rounded-full', on ? 'border-7 border-accent' : 'border-[1.5px] border-fg3')} />;
}

/** design §10 Checkbox: 24 round, 1.5 fg3 ring; on = action fill + CheckGlyph 13. */
export function Check({ on, disabled }: { on: boolean; disabled?: boolean }) {
  return (
    <span
      aria-hidden
      className={cx('flex h-6 w-6 flex-none items-center justify-center rounded-full border-[1.5px]', on ? 'border-action bg-action text-white' : 'border-fg3', disabled && 'opacity-50')}
    >
      {on && <CheckGlyph size={13} />}
    </span>
  );
}

export type BadgeVariant = 'next' | 'tag' | 'muted' | 'd' | 'success';

/**
 * design §10 Badge: 16 / r4 / px 5 / 10/700. `next` action blue · `tag` outlined (BW, ASSIST) ·
 * `muted` grey · `d` orange with black text (W / D badges are 800) · `success` green.
 */
export function Badge({ variant = 'muted', children, className = '', label }: { variant?: BadgeVariant; children: ReactNode; className?: string; label?: string }) {
  return (
    <span
      aria-label={label}
      className={cx(
        'inline-flex flex-none items-center justify-center rounded-xs text-micro leading-none whitespace-nowrap',
        variant === 'tag' ? 'h-3.75 border border-line-strong px-1 text-fg2' : 'h-4 px-1.25',
        variant === 'next' && 'bg-action text-white',
        variant === 'muted' && 'bg-surface-2 text-fg2',
        variant === 'd' && 'w-4 bg-warn px-0 font-extrabold text-black',
        variant === 'success' && 'bg-tip text-black',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Badge preset kept for existing call sites: `accent` = NEXT style, `muted` = grey. */
export function Pill({ children, tone = 'muted' }: { children: ReactNode; tone?: 'accent' | 'muted' }) {
  return <Badge variant={tone === 'accent' ? 'next' : 'muted'}>{children}</Badge>;
}

/** Orange D badge: you dropped after this set last time. `small` (14) fits the Previous column. */
export function DropBadge({ small }: { small?: boolean }) {
  return (
    <Badge variant="d" label="drop set after" className={small ? 'h-3.5 w-3.5' : undefined}>
      D
    </Badge>
  );
}

/** Grey outlined type tag next to exercise names: BW, BW +, ASSIST, INCLINE. */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <Badge variant="tag" className="ml-1.5 -translate-y-0.5 align-middle">
      {children}
    </Badge>
  );
}

/** design §10 Status pill: up / down / same / new on the summary. 22 / full / px 8 / 12/700, soft fill of its color. */
export function StatusPill({ tone, children }: { tone: 'up' | 'down' | 'same' | 'new'; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex h-5.5 flex-none items-center gap-1 rounded-full px-2 text-caption font-bold whitespace-nowrap',
        tone === 'up' ? 'bg-success-soft text-tip' : tone === 'down' ? 'bg-danger-soft text-danger' : tone === 'new' ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-fg2',
      )}
    >
      {children}
    </span>
  );
}

/** design §10 / §13 Bar chip: opens a picker sheet from a toolbar ("Bar 45"). 32 / r10 / surface, 13/600 + ChevronDown 9, in a 44 target. */
export function BarChip({ label, onPress, ariaLabel }: { label: ReactNode; onPress: () => void; ariaLabel?: string }) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      // A click, not pointerdown: it opens a sheet, and the tap must not land on its scrim.
      onClick={onPress}
      className="flex h-11 flex-none items-center active:opacity-70"
    >
      <span className="flex h-8 items-center gap-1 rounded-md bg-surface px-2.5 text-footnote font-semibold whitespace-nowrap text-fg">
        {label}
        <ChevronDown size={9} />
      </span>
    </button>
  );
}
