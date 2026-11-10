import { useState } from 'react';
import { canHalf, canStep, EFFORT_SCALE, padDigit, padFromRpe, padKeyLabel, pressEffortPad } from '../lib/effort';
import type { KeypadKey } from '../lib/keypad';
import { BackspaceIcon, ChevronDown, CloseIcon } from './icons';
import { Key } from './Keypad';
import { Sheet } from './overlays';
import { cx, Disc } from './ui';

export type BadgeTone = 'logged' | 'active' | 'target' | 'add';

/**
 * The effort badge on the lower right corner of a reps box (A2–A4), V2B in
 * design/proposals/rir-badge-variations-v2.html: a round badge, black (the page
 * colour) with two rings, a thin state ring and a cut-out ring in the colour under
 * it, floating on a soft shadow. `logged`: a saved rating, grey ring; on a done set
 * a faded blue fill in a full blue ring · `active`: the one being picked, blue ring
 * and glow · `target`: the routine's target, grey text in a grey ring · `add`: a blue
 * + in a blue ring on an unrated set. Every state is the same size; only colours change.
 *
 * Its parent must be a box-sized, positioned overlay of the reps box. The badge hangs
 * off that box's corner, centred on its bottom edge and 8 px past its right edge
 * (where a one-digit badge's centre sits on the corner); wider ones grow left so they
 * never reach the ✓ box. `inset` keeps it inside the corner instead, for a reps box
 * that runs to the edge of the row (builder, edit). Its own button, so a tap goes
 * straight to the effort pad; the rpe tab on the keypad is the visible way there.
 */
export function EffortBadge({
  text,
  tone,
  label,
  onPress,
  inset,
  done,
  historyEdit = false,
}: {
  text?: string;
  tone: BadgeTone;
  label: string;
  onPress?: () => void;
  inset?: boolean;
  /** 6.7: lower badge with a page-colored cut-out and neutral logged state. */
  historyEdit?: boolean;
  /** The set is done: a logged badge turns blue and the cut-out ring takes the done row's colour. */
  done?: boolean;
}) {
  const plus = tone === 'add' || text === '+';
  // Picking effort on a set with none yet: a solid blue circle with a white +.
  const solid = plus && tone === 'active';
  const ring =
    tone === 'active' || tone === 'add' || (tone === 'logged' && done) ? 'var(--color-accent)' : 'var(--color-fg3)';
  // Inside the box the cut-out ring would just repeat the box's fill, so it's left clear.
  const ground = historyEdit ? 'var(--color-bg)' : inset ? 'transparent' : done ? 'var(--color-done)' : 'var(--color-bg)';
  const lift = tone === 'active' ? '0 0 10px var(--color-effort-glow)' : '0 3px 8px var(--color-badge-shadow)';
  const pill = (
    <span
      className={cx(
        'flex h-4 min-w-4 items-center justify-center rounded-full text-[10.5px] leading-none font-extrabold whitespace-nowrap tabular-nums',
        solid ? 'bg-accent' : tone === 'logged' && done ? 'bg-effort' : 'bg-bg',
        plus ? 'w-4' : 'px-[5px]',
        solid ? 'text-white' : plus ? 'text-accent' : tone === 'target' ? 'text-fg2' : 'text-fg',
      )}
      style={
        solid
          ? // The fill and a ring that only meets it leave an anti-aliased seam between
            // them; an outline that starts 1 px inside covers it, same outer edge.
            { boxShadow: `0 0 0 3.5px ${ground}, ${lift}`, outline: `2.5px solid ${ring}`, outlineOffset: '-1px' }
          : { boxShadow: `0 0 0 1.5px ${ring}, 0 0 0 3.5px ${ground}, ${lift}` }
      }
    >
      {plus ? (
        // Drawn, not typed: a "+" glyph sits on the text baseline and never quite centres.
        // A fixed 16 px circle, the same size as a one-digit badge.
        <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden>
          <path d="M4 1v6M1 4h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ) : (
        // Digits sit high in a line-height-1 box; drop them a pixel to look centred.
        <span className="translate-y-px">{text}</span>
      )}
    </span>
  );
  const place = historyEdit ? 'right-[4px] bottom-[-4px]' : inset ? 'right-[4px] bottom-[3px]' : 'right-[-8px] bottom-0 translate-y-1/2';
  if (!onPress)
    return (
      <span aria-hidden className={cx('pointer-events-none absolute z-[2] flex', place)}>
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
      // The visible pill is the button; ::before makes it a bigger, invisible target that
      // reaches up and left over the box, never right over the ✓.
      className={cx(
        "pointer-events-auto absolute z-[2] flex before:absolute before:-top-2 before:right-0 before:-bottom-2 before:-left-3 before:content-['']",
        place,
      )}
    >
      {pill}
    </button>
  );
}

/**
 * The effort pad (A2, A3): in the keypad's place and laid out exactly like it, so the
 * thumb finds the same keys at the same height. Digits are effort values with a word
 * under them (RIR 0 Failure … 5+ Easy; RPE ≤5 … 9, and 0 is 10 Max); the others are off,
 * so no RIR of 6 or more. "." is a sticky ½: always pressable, it stays on between picks
 * and applies to the next one; on the top key (RIR 5+, RPE 10) it shows greyed but can
 * still be flipped. + / − move a whole step (empty RIR starts at 0), off at the ends.
 * ⌫ clears, ⌄ closes. Every press saves; the keypad's ✓ Done completes the set.
 * Key it by set so the ½ toggle starts from each set's own value.
 */
export function EffortPad({ mode, value, onChange, onClose }: { mode: 'rpe' | 'rir'; value?: number; onChange: (rpe: number | undefined) => void; onClose: () => void }) {
  const [half, setHalf] = useState(() => padFromRpe(value, mode).half);
  // A value changed elsewhere (hardware keys) brings the toggle along, where it can show.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    const st = padFromRpe(value, mode);
    if (st.base != null && canHalf(st.base, mode) && st.half !== half) setHalf(st.half);
  }
  const state = padFromRpe(value, mode);
  const halfApplies = canHalf(state.base, mode);
  const unit = mode === 'rpe' ? 'RPE' : 'RIR';
  const press = (k: KeypadKey) => () => {
    const next = pressEffortPad({ rpe: value, half }, k, mode);
    if (next.half !== half) setHalf(next.half);
    if (next.rpe !== value) {
      setSeen(next.rpe);
      onChange(next.rpe);
    }
  };
  const digit = (d: number) => {
    const k = padDigit(d, mode);
    if (!k)
      return (
        <Key key={d} disabled onPress={() => {}} label={`${d} (not used for ${unit})`}>
          {d}
        </Key>
      );
    const on = state.base === k.value;
    return (
      <Key
        key={d}
        label={`${k.label} ${unit}, ${k.word}`}
        onPress={press({ type: 'digit', d: String(d) })}
        className={cx('text-[21px]! tabular-nums', on && 'bg-accent! text-white')}
      >
        {padKeyLabel(k, state, mode)}
        <small className={cx('mt-1 text-[10px] font-semibold', on ? 'text-white/80' : 'text-fg2')}>{k.word}</small>
      </Key>
    );
  };
  const small = (s: string) => <small className="mt-0.5 text-[10px] font-semibold text-fg2">{s}</small>;
  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_72px] gap-1.5" role="group" aria-label={mode === 'rpe' ? 'RPE' : 'Reps in reserve'}>
      {digit(1)}
      {digit(2)}
      {digit(3)}
      <Key fn onPress={onClose} label="Close keypad">
        <ChevronDown size={16} />
      </Key>
      {digit(4)}
      {digit(5)}
      {digit(6)}
      <Key fn disabled={!canStep(value, 'inc', mode)} onPress={press({ type: 'inc' })} label={`Plus 1 ${unit}`}>
        +{small(`1 ${unit}`)}
      </Key>
      {digit(7)}
      {digit(8)}
      {digit(9)}
      <Key fn disabled={!canStep(value, 'dec', mode)} onPress={press({ type: 'dec' })} label={`Minus 1 ${unit}`}>
        −{small(`1 ${unit}`)}
      </Key>
      <Key disabled onPress={() => {}} label="Negative">
        −
      </Key>
      {digit(0)}
      {/* Greyed on the top key (nothing to halve) but still a toggle, for the next pick. */}
      <Key
        outlined={half}
        pressed={half}
        label={half ? 'Half on' : 'Add a half'}
        onPress={press({ type: 'dot' })}
        className={cx('text-[21px]!', half && 'text-accent', state.base != null && !halfApplies && 'opacity-25')}
      >
        ½
      </Key>
      <Key fn onPress={press({ type: 'backspace' })} label="Clear effort">
        <BackspaceIcon size={24} />
      </Key>
    </div>
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
        <Disc tone="grey" label="Close" onClick={onClose} className="-mr-2">
          <CloseIcon size={11} />
        </Disc>
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
