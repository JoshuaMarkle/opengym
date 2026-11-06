import type { ReactNode } from 'react';
import type { KeypadKey } from '../lib/keypad';
import { BackspaceIcon, ChevronDown } from './icons';
import { cx } from './ui';

/**
 * The 4×4 keypad (4.2 / 2.4). Left: 1–9, then − (or – range in reps mode), 0, decimal.
 * Right column: close · + step · − step · backspace. A lbs / reps toggle sits on top.
 */
export function Keypad({
  title,
  mode,
  onModeChange,
  weightLabel,
  stepLabel,
  allowRange,
  allowNegative,
  onKey,
  onClose,
}: {
  title: ReactNode;
  mode: 'weight' | 'reps';
  onModeChange?: (m: 'weight' | 'reps') => void;
  weightLabel: string;
  stepLabel: string;
  allowRange?: boolean;
  allowNegative?: boolean;
  onKey: (k: KeypadKey) => void;
  onClose: () => void;
}) {
  const key = (k: KeypadKey) => () => onKey(k);
  const digit = (d: string) => (
    <Key key={d} onPress={key({ type: 'digit', d })}>
      {d}
    </Key>
  );
  const reps = mode === 'reps';
  return (
    <div className="no-select flex-none border-t border-line-strong bg-kp px-2 pt-2 pb-[max(8px,env(safe-area-inset-bottom))]" role="group" aria-label="Keypad" data-dock>
      <div className="flex items-center justify-between px-1.5 pb-2 text-[13px] font-semibold text-fg2">
        <span className="truncate">{title}</span>
        {onModeChange && (
          <div className="flex gap-1" role="tablist">
            {(['weight', 'reps'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => onModeChange(m)}
                className={cx('h-8 rounded-[8px] border px-3 text-[13px] font-semibold', mode === m ? 'border-accent bg-accent text-white' : 'border-line-strong text-fg2')}
              >
                {m === 'weight' ? weightLabel : 'reps'}
              </button>
            ))}
          </div>
        )}
      </div>
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
        <Key fn onPress={key({ type: 'inc' })} label={`Plus ${reps ? '1 rep' : stepLabel}`}>
          +<small className="mt-0.5 text-[10px] font-semibold text-fg2">{reps ? '1 rep' : stepLabel}</small>
        </Key>
        {digit('7')}
        {digit('8')}
        {digit('9')}
        <Key fn onPress={key({ type: 'dec' })} label={`Minus ${reps ? '1 rep' : stepLabel}`}>
          −<small className="mt-0.5 text-[10px] font-semibold text-fg2">{reps ? '1 rep' : stepLabel}</small>
        </Key>
        {reps ? (
          <Key onPress={key({ type: 'dash' })} disabled={!allowRange} label="Range">
            –<small className="mt-0.5 text-[10px] font-semibold text-fg2">range</small>
          </Key>
        ) : (
          <Key onPress={key({ type: 'minus' })} disabled={!allowNegative} label="Negative">
            −
          </Key>
        )}
        {digit('0')}
        <Key onPress={key({ type: 'dot' })} disabled={reps} label="Decimal point">
          .
        </Key>
        <Key fn onPress={key({ type: 'backspace' })} label="Backspace">
          <BackspaceIcon size={24} />
        </Key>
      </div>
    </div>
  );
}

function Key({ children, onPress, fn, disabled, label }: { children: ReactNode; onPress: () => void; fn?: boolean; disabled?: boolean; label?: string }) {
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
        disabled && 'opacity-25',
        '[&:not(:disabled)]:shadow-[0_1px_0_rgba(0,0,0,0.25)]',
      )}
    >
      {children}
    </button>
  );
}
