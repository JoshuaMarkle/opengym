import type { ReactNode } from 'react';
import { canHalf, EFFORT_SCALE, padFromRpe, padKeyLabel, PAD_KEYS, rpeFromPad } from '../lib/effort';
import { ChevronDown, CloseIcon } from './icons';
import { Key } from './Keypad';
import { Sheet } from './overlays';
import { cx } from './ui';

export type BadgeTone = 'logged' | 'active' | 'target' | 'add';

/**
 * The effort badge clipped to the lower right of a reps box (A2–A4). `logged`: a
 * saved rating · `active`: the one being picked (blue) · `target`: the routine's
 * target, outlined grey · `add`: a small + on an unrated set. Its own button, beside
 * the box (never inside it), so a tap goes straight to the effort pad. The rpe tab on
 * the keypad is the visible way to the same place.
 */
export function EffortBadge({
  text,
  tone,
  label,
  onPress,
  inset,
}: {
  text?: string;
  tone: BadgeTone;
  label: string;
  onPress?: () => void;
  /** Inside the box's corner, for a reps box that runs to the edge of the row (builder, edit). */
  inset?: boolean;
}) {
  const pill = (
    <span
      className={cx(
        'flex h-[16px] min-w-[16px] items-center justify-center rounded-[5px] px-[4px] text-[10px] leading-none font-bold whitespace-nowrap tabular-nums',
        tone === 'logged' && 'bg-key-fn text-fg',
        tone === 'active' && 'bg-accent text-white',
        tone === 'target' && 'bg-bg text-fg2 ring-1 ring-fg3 ring-inset',
        tone === 'add' && 'rounded-full bg-bg px-0 text-[12px] font-semibold text-accent ring-1 ring-accent ring-inset',
      )}
    >
      {tone === 'add' ? '+' : text}
    </span>
  );
  if (!onPress)
    return (
      <span aria-hidden className={cx('pointer-events-none absolute flex', inset ? 'right-[5px] bottom-[8px]' : 'right-[-2px] bottom-[1px]')}>
        {pill}
      </span>
    );
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onPress();
      }}
      // The pill sits on the box's corner; the button around it is a bigger, invisible target.
      className={cx('absolute flex h-[28px] min-w-[30px] items-center justify-end', inset ? 'right-0 bottom-[2px] pr-[5px] pb-[6px]' : 'right-[-8px] bottom-[-6px] pr-[6px] pb-[7px]')}
    >
      {pill}
    </button>
  );
}

/**
 * The effort pad (A2, A3): in the keypad's place, two rows of normal-size keys
 * labelled Easy to Max, ½ for half steps and Clear. Shorter than the number grid.
 * Every press saves; the keypad's ✓ Done completes the set.
 */
export function EffortPad({ mode, value, onChange }: { mode: 'rpe' | 'rir'; value?: number; onChange: (rpe: number | undefined) => void }) {
  const state = padFromRpe(value, mode);
  const keys = PAD_KEYS[mode];
  const halfOk = canHalf(state.base, mode);
  const key = (i: number) => {
    const k = keys[i];
    const on = state.base === k.value;
    return (
      <Key
        key={k.value}
        label={`${k.label} ${mode === 'rpe' ? 'RPE' : 'RIR'}, ${k.word}`}
        onPress={() => onChange(rpeFromPad({ base: k.value, half: false }, mode))}
        className={cx('text-[21px]! tabular-nums', on && 'bg-accent! text-white')}
      >
        {padKeyLabel(k, state, mode)}
        <small className={cx('mt-1 text-[10px] font-semibold', on ? 'text-white/80' : 'text-fg2')}>{k.word}</small>
      </Key>
    );
  };
  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_72px] gap-1.5" role="group" aria-label={mode === 'rpe' ? 'RPE' : 'Reps in reserve'}>
      {key(0)}
      {key(1)}
      {key(2)}
      <Key fn outlined={state.half && halfOk} disabled={!halfOk} label="Add a half" onPress={() => onChange(rpeFromPad({ base: state.base, half: !state.half }, mode))} className={cx(state.half && halfOk && 'text-accent')}>
        ½
      </Key>
      {key(3)}
      {key(4)}
      {key(5)}
      <Key fn label="Clear effort" onPress={() => onChange(undefined)} className="text-[16px]!">
        Clear
      </Key>
    </div>
  );
}

/** The pad has no ⌄ key of its own, so the keypad header shows one top left (A2). Same size as a field tab. */
export function PadClose({ onPress, children }: { onPress: () => void; children?: ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Close keypad"
        onPointerDown={(e) => {
          e.preventDefault();
          onPress();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onPress();
          }
        }}
        className="-ml-1.5 flex h-11 min-w-11 flex-none items-center justify-center active:opacity-70"
      >
        <span className="flex h-[28px] items-center rounded-[7px] bg-key-fn px-2.5 text-fg">
          <ChevronDown size={13} />
        </span>
      </button>
      {children && <span className="truncate">{children}</span>}
    </span>
  );
}

/** A5: what RPE and RIR mean, and one table mapping both to how a set feels. */
export function EffortSheet({ open, onClose, mode, onSwitch }: { open: boolean; onClose: () => void; mode: 'off' | 'rpe' | 'rir'; onSwitch?: () => void }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="RPE and RIR"
      action={
        <button type="button" aria-label="Close" onClick={onClose} className="-mr-2 flex h-11 w-11 items-center justify-center">
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-key-fn text-fg2">
            <CloseIcon size={11} />
          </span>
        </button>
      }
    >
      <p className="text-[14px] leading-snug text-fg2">
        <b className="text-fg">RPE</b> = Rate of Perceived Exertion: how hard the set was, 1 to 10.
      </p>
      <p className="mt-1.5 text-[14px] leading-snug text-fg2">
        <b className="text-fg">RIR</b> = Reps in Reserve: how many more reps you could have done.
      </p>
      <div className="mt-4 text-[15px] tabular-nums" role="table" aria-label="RPE, RIR and how it feels">
        <div role="row" className="grid h-7 grid-cols-[56px_56px_1fr] items-center border-b border-line text-[11px] font-bold tracking-[0.06em] text-fg2">
          <span role="columnheader">RPE</span>
          <span role="columnheader">RIR</span>
          <span role="columnheader">FEELS LIKE</span>
        </div>
        {EFFORT_SCALE.map((r) => (
          <div key={r.rpe} role="row" className="grid min-h-11 grid-cols-[56px_56px_1fr] items-center border-b border-line">
            <b role="cell" className={cx(mode === 'rir' && 'font-medium text-fg2')}>
              {r.rpe}
            </b>
            <b role="cell" className={cx(mode !== 'rir' && 'font-medium text-fg2')}>
              {r.rir}
            </b>
            <span role="cell" className="text-[14px] text-fg2">
              {r.feels}
            </span>
          </div>
        ))}
      </div>
      {onSwitch && mode !== 'off' && (
        <button type="button" onClick={onSwitch} className="mt-2 flex h-11 items-center text-[16px] font-semibold text-accent active:opacity-60">
          Switch to {mode === 'rpe' ? 'RIR' : 'RPE'}
        </button>
      )}
    </Sheet>
  );
}
