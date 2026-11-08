import type { ReactNode } from 'react';
import type { KeypadKey } from '../lib/keypad';
import { ArrowGlyph, BackspaceIcon, CheckGlyph, ChevronDown } from './icons';
import { cx } from './ui';

export interface KeypadTab {
  id: string;
  label: string;
}

/**
 * The 4×4 keypad (2.4, 4.2, 4.15, 4.22). Left three columns: 1–9, then the
 * bottom-left key (− sign, – range or : for time), 0 and the decimal point.
 * Right column: close · + step · − step · backspace.
 *
 * Header: on the left either the 123 | Plates mode tabs (with the bar picker beside
 * them on Plates) or a label ("Set 3 · Reps"); on the right the field tabs (lbs |
 * reps, or the cardio columns) and one blue icon button, the size of a field tab:
 * → Next on any box but the last in the row, ✓ Done on the last one.
 * Same spot, so the thumb never moves. `panel` swaps the grid for the plate pad.
 */
export function Keypad({
  left,
  tabs,
  tab,
  onTab,
  next,
  bottomLeft,
  decimal = true,
  stepLabel,
  onKey,
  onClose,
  panel,
}: {
  left: ReactNode;
  tabs?: KeypadTab[];
  tab?: string;
  onTab?: (id: string) => void;
  next?: { done: boolean; onPress: () => void };
  bottomLeft: { key: 'minus' | 'dash' | 'colon'; enabled: boolean };
  decimal?: boolean;
  stepLabel: string;
  onKey: (k: KeypadKey) => void;
  onClose: () => void;
  panel?: ReactNode;
}) {
  const key = (k: KeypadKey) => () => onKey(k);
  const digit = (d: string) => (
    <Key key={d} onPress={key({ type: 'digit', d })}>
      {d}
    </Key>
  );
  const small = (s: string) => <small className="mt-0.5 text-[10px] font-semibold text-fg2">{s}</small>;
  return (
    <div className="no-select flex-none border-t border-line-strong bg-kp px-2 pt-1.5 pb-[max(8px,env(safe-area-inset-bottom))]" role="group" aria-label="Keypad" data-dock>
      <div className="flex min-h-11 items-center justify-between gap-2 pb-1.5 pl-1.5">
        <div className="min-w-0 truncate text-[13px] font-semibold text-fg2">{left}</div>
        <div className="flex flex-none items-center gap-1.5">
          {tabs && tabs.length > 1 && onTab && <FieldTabs tabs={tabs} value={tab} onChange={onTab} />}
          {next && (
            <button
              type="button"
              aria-label={next.done ? 'Done: complete the set and go to the next one' : 'Next box'}
              onPointerDown={(e) => {
                e.preventDefault();
                next.onPress();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  next.onPress();
                }
              }}
              className="flex h-11 min-w-11 items-center justify-center active:opacity-80"
            >
              {/* Drawn the size of a selected field tab; the button around it keeps the 44 px target. */}
              <span className="flex h-[28px] items-center rounded-[7px] bg-accent px-2.5 text-white">
                {next.done ? <CheckGlyph size={14} /> : <ArrowGlyph size={14} />}
              </span>
            </button>
          )}
        </div>
      </div>
      {panel ?? (
        <div className="grid grid-cols-[1fr_1fr_1fr_72px] gap-1.5">
          {digit('1')}
          {digit('2')}
          {digit('3')}
          <Key fn onPress={onClose} label="Close keypad">
            <ChevronDown size={16} />
          </Key>
          {digit('4')}
          {digit('5')}
          {digit('6')}
          <Key fn onPress={key({ type: 'inc' })} label={`Plus ${stepLabel}`}>
            +{small(stepLabel)}
          </Key>
          {digit('7')}
          {digit('8')}
          {digit('9')}
          <Key fn onPress={key({ type: 'dec' })} label={`Minus ${stepLabel}`}>
            −{small(stepLabel)}
          </Key>
          {bottomLeft.key === 'dash' ? (
            <Key onPress={key({ type: 'dash' })} disabled={!bottomLeft.enabled} label="Range">
              –{small('range')}
            </Key>
          ) : bottomLeft.key === 'colon' ? (
            <Key onPress={key({ type: 'colon' })} disabled={!bottomLeft.enabled} label="Colon (minutes : seconds)" outlined>
              :{small('min:sec')}
            </Key>
          ) : (
            <Key onPress={key({ type: 'minus' })} disabled={!bottomLeft.enabled} label="Negative">
              −
            </Key>
          )}
          {digit('0')}
          <Key onPress={key({ type: 'dot' })} disabled={!decimal} label="Decimal point">
            .
          </Key>
          <Key fn onPress={key({ type: 'backspace' })} label="Backspace">
            <BackspaceIcon size={24} />
          </Key>
        </div>
      )}
    </div>
  );
}

/** Height of the number grid: the plate pad matches it exactly. */
export const KEYPAD_GRID_HEIGHT = 4 * 50 + 3 * 6;

/** 123 | Plates on the left of the header (4.2, 4.16). */
export function ModeTabs({ value, onChange }: { value: 'numbers' | 'plates'; onChange: (v: 'numbers' | 'plates') => void }) {
  return (
    <Pills
      options={[
        { id: 'numbers', label: '123' },
        { id: 'plates', label: 'Plates' },
      ]}
      value={value}
      onChange={(v) => onChange(v as 'numbers' | 'plates')}
      tone="neutral"
      label="Keypad mode"
    />
  );
}

/** "Bar 45 ▾" beside the mode tabs on Plates (4.16, 4.18). Drawn like a pill; 44 px tall to tap. */
export function BarChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <button
      type="button"
      aria-label={`${label}. Choose the bar`}
      // A click, not pointerdown: it opens a sheet, and the tap must not land on its scrim.
      onClick={onPress}
      className="flex h-11 flex-none items-center active:opacity-70"
    >
      <span className="flex h-[32px] items-center gap-1 rounded-[9px] bg-surface px-2.5 text-[13px] font-semibold whitespace-nowrap text-fg">
        {label}
        <ChevronDown size={9} />
      </span>
    </button>
  );
}

function FieldTabs({ tabs, value, onChange }: { tabs: KeypadTab[]; value?: string; onChange: (id: string) => void }) {
  return <Pills options={tabs} value={value} onChange={onChange} tone="accent" label="Field" />;
}

/** A small segmented pill group. Each button is 44 px tall; the grey track is drawn behind them. */
function Pills({ options, value, onChange, tone, label }: { options: KeypadTab[]; value?: string; onChange: (id: string) => void; tone: 'accent' | 'neutral'; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="relative flex items-center px-[2px]">
      <span aria-hidden className="absolute inset-x-0 top-1/2 h-[32px] -translate-y-1/2 rounded-[9px] bg-surface" />
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={on}
            onPointerDown={(e) => {
              e.preventDefault();
              if (!on) onChange(o.id);
            }}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !on) {
                e.preventDefault();
                onChange(o.id);
              }
            }}
            className="relative flex h-11 items-center"
          >
            <span
              className={cx(
                'flex h-[28px] items-center rounded-[7px] px-2.5 text-[13px] font-semibold whitespace-nowrap transition-colors',
                on ? (tone === 'accent' ? 'bg-accent text-white' : 'bg-key-fn text-fg') : 'text-fg2',
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

export function Key({
  children,
  onPress,
  fn,
  disabled,
  label,
  outlined,
  className = '',
}: {
  children: ReactNode;
  onPress: () => void;
  fn?: boolean;
  disabled?: boolean;
  label?: string;
  outlined?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      // pointerdown keeps typing snappy and avoids the 300 ms click delay on older iOS.
      onPointerDown={(e) => {
        if (disabled) return;
        e.preventDefault();
        onPress();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPress();
        }
      }}
      className={cx(
        'flex h-[50px] flex-col items-center justify-center rounded-[10px] leading-none transition-[filter] active:brightness-125',
        fn ? 'bg-key-fn text-[19px] font-semibold' : 'bg-key text-[23px] font-medium',
        outlined && !disabled && 'ring-[1.5px] ring-accent ring-inset',
        disabled && 'opacity-25',
        '[&:not(:disabled)]:shadow-[0_1px_0_rgba(0,0,0,0.25)]',
        className,
      )}
    >
      {children}
    </button>
  );
}
