import type { ReactNode } from 'react';
import type { KeypadKey } from '../lib/keypad';
import { BackspaceIcon, CheckGlyph, ChevronDown } from './icons';
import { CompactSegmented, cx } from './ui';

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
 * reps, or the cardio columns) and one blue ✓ button, the size of a field tab. It is
 * always a ✓: on any box but the last it moves to the next box, on the last it ticks
 * the set. Same spot, same glyph, so the thumb never moves. `panel` swaps the grid for the plate pad.
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
  nextLabel,
  nextAria,
}: {
  left: ReactNode;
  tabs?: KeypadTab[];
  tab?: string;
  onTab?: (id: string) => void;
  next?: { done: boolean; onPress: () => void };
  bottomLeft: { key: 'minus' | 'dash' | 'colon' | 'half'; enabled: boolean };
  /** A word after the confirm's check ("Log" on the food amount, C2). */
  nextLabel?: string;
  /** Screen-reader label for the confirm outside a workout ("Next field", "Done"). */
  nextAria?: string;
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
  const small = (s: string) => <small className="mt-0.5 text-micro font-semibold text-fg2">{s}</small>;
  return (
    <div className="no-select flex-none border-t border-line-strong bg-kp px-2 pt-1.5 pb-[max(8px,env(safe-area-inset-bottom))]" role="group" aria-label="Keypad" data-dock>
      <div className="flex min-h-11 items-center justify-between gap-2 pb-1.5 pl-1.5">
        <div className="min-w-0 truncate text-footnote font-semibold text-fg2">{left}</div>
        <div className="flex flex-none items-center gap-1.5">
          {tabs && tabs.length > 1 && onTab && <FieldTabs tabs={tabs} value={tab} onChange={onTab} />}
          {next && (
            <button
              type="button"
              aria-label={nextAria ?? nextLabel ?? (next.done ? 'Done: complete the set and go to the next one' : 'Done with this box: go to the next one')}
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
              {/* design §13 Confirm: drawn the size of a selected field tab (28 / r8, action fill); the button keeps the 44 px target. */}
              <span className="flex h-7 items-center gap-1 rounded-sm bg-action px-2.5 text-white">
                <CheckGlyph size={14} />
                {nextLabel && <span className="text-footnote font-semibold">{nextLabel}</span>}
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
          {bottomLeft.key === 'half' ? (
            <Key onPress={key({ type: 'half' })} disabled={!bottomLeft.enabled} label="Half">
              ½
            </Key>
          ) : bottomLeft.key === 'dash' ? (
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

/** design §13 Mode switch: 123 | Plates on the left of the toolbar (4.2, 4.16). Key-fn when selected. */
export function ModeTabs({ value, onChange }: { value: 'numbers' | 'plates'; onChange: (v: 'numbers' | 'plates') => void }) {
  return (
    <CompactSegmented
      options={[
        { value: 'numbers', label: '123' },
        { value: 'plates', label: 'Plates' },
      ]}
      value={value}
      onChange={onChange}
      tone="neutral"
      label="Keypad mode"
      instant
    />
  );
}

/** design §13 Field switch: lbs | reps (or the cardio columns). Action fill on the box being typed. */
function FieldTabs({ tabs, value, onChange }: { tabs: KeypadTab[]; value?: string; onChange: (id: string) => void }) {
  return <CompactSegmented options={tabs.map((t) => ({ value: t.id, label: t.label }))} value={value} onChange={onChange} tone="action" label="Field" instant />;
}

export function Key({
  children,
  onPress,
  fn,
  disabled,
  label,
  outlined,
  pressed,
  className = '',
}: {
  children: ReactNode;
  onPress: () => void;
  fn?: boolean;
  disabled?: boolean;
  label?: string;
  outlined?: boolean;
  /** A toggle key (the effort pad's ½): announced as pressed / not pressed. */
  pressed?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
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
        // design §13 Number keys: h50 / r10; digits 23/500, function keys 19/600 on key-fn. No shadow (design §17).
        'flex h-12.5 flex-col items-center justify-center rounded-md leading-none transition-[filter] active:brightness-125',
        fn ? 'bg-key-fn text-[19px] font-semibold' : 'bg-key text-[23px] font-medium',
        outlined && !disabled && 'ring-[1.5px] ring-accent ring-inset',
        disabled && 'opacity-25',
        className,
      )}
    >
      {children}
    </button>
  );
}
