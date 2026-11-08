import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Units } from '../db/types';
import { BAR_OPTIONS, barIdFor, canAddPlate, loadPlates, MAX_PLATES_PER_SIDE, PLATES, plateCounts, plateShape, plateTotal, removeAt, sum } from '../lib/plates';
import { formatNumber } from '../lib/units';
import { KEYPAD_GRID_HEIGHT } from './Keypad';
import { Sheet } from './overlays';
import { Button, cx, Radio } from './ui';

/**
 * A3–A4: the plate pad. Bar drawing on the left (the right half of a barbell, like
 * the logo), the total and the six plate buttons on the right, Undo / Clear / Done
 * below. A button adds that plate to each side (up to ten a side); tapping a
 * plate on the drawing takes it off. Same height as the number keypad. Values are in the display unit.
 */
export function PlatePad({
  units,
  bar,
  initialTotal,
  onTotal,
  onDone,
}: {
  units: Units;
  bar: number;
  initialTotal?: number;
  onTotal: (total: number) => void;
  onDone: () => void;
}) {
  const plates = PLATES[units];
  const [stack, setStack] = useState<number[]>(() => loadPlates(initialTotal, bar, plates).stack);
  const [history, setHistory] = useState<number[][]>([]);
  const counts = plateCounts(stack);
  const total = plateTotal(bar, stack);
  const newest = stack[stack.length - 1];
  const full = !canAddPlate(stack);
  const add = (p: number) => {
    if (!full) change([...stack, p]);
  };

  const change = (next: number[]) => {
    setHistory((h) => [...h, stack]);
    setStack(next);
    onTotal(plateTotal(bar, next));
  };

  // A different bar keeps the plates and changes the total.
  const firstBar = useRef(bar);
  useEffect(() => {
    if (bar === firstBar.current) return;
    firstBar.current = bar;
    onTotal(plateTotal(bar, stack));
  }, [bar]); // eslint-disable-line react-hooks/exhaustive-deps

  const lower = 44 + 6;
  return (
    <div style={{ height: KEYPAD_GRID_HEIGHT }} className="flex flex-col gap-1.5">
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)] gap-2" style={{ height: KEYPAD_GRID_HEIGHT - lower }}>
        <BarDrawing units={units} stack={stack} onRemove={(i) => change(removeAt(stack, i))} />
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex h-[34px] items-baseline justify-between gap-1 px-0.5" aria-live="polite">
            <span className="truncate">
              <b className="text-[26px] leading-none font-bold tracking-[-0.01em]">{formatNumber(total, 2)}</b>
              <small className="ml-0.5 text-[12px] font-semibold text-fg2">{units}</small>
            </span>
            <span className={cx('flex-none text-[12px]', full ? 'font-semibold text-warn' : 'text-fg2')}>
              {full ? `Max ${MAX_PLATES_PER_SIDE} / side` : `${formatNumber(sum(stack), 2)} / side`}
            </span>
          </div>
          <div className="grid flex-1 grid-cols-2 grid-rows-3 gap-[5px]">
            {plates.map((p) => {
              const n = counts.get(p) ?? 0;
              return (
                <button
                  key={p}
                  type="button"
                  aria-label={`Add ${formatNumber(p, 2)} ${units} to each side${n ? `, ${n} loaded` : ''}`}
                  aria-disabled={full}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    add(p);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      add(p);
                    }
                  }}
                  className={cx(
                    'flex items-center justify-between rounded-[10px] bg-key px-2.5 leading-none transition-[filter]',
                    full ? 'opacity-35' : 'active:brightness-125',
                    n > 0 && 'ring-[1.5px] ring-fg3 ring-inset',
                  )}
                >
                  <span className={cx('text-[17px] font-semibold', p === newest && 'text-accent')}>{formatNumber(p, 2)}</span>
                  {n > 0 && <small className="text-[11px] font-semibold text-fg2">×{n}</small>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="grid h-11 flex-none grid-cols-3 gap-1.5">
        <PadButton disabled={!history.length} onPress={() => {
          const prev = history[history.length - 1];
          setHistory((h) => h.slice(0, -1));
          setStack(prev);
          onTotal(plateTotal(bar, prev));
        }}>
          Undo
        </PadButton>
        <PadButton disabled={!stack.length} onPress={() => change([])}>
          Clear
        </PadButton>
        <PadButton primary onPress={onDone}>
          Done
        </PadButton>
      </div>
    </div>
  );
}

function PadButton({ children, onPress, primary, disabled }: { children: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
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
        'rounded-[10px] text-[16px] font-semibold active:brightness-125 disabled:opacity-35',
        primary ? 'bg-accent text-white' : 'bg-key-fn text-fg',
      )}
    >
      {children}
    </button>
  );
}

/**
 * The right half of a loaded bar. When the plates don't fit, the whole stack
 * slides left (shaft and inner plates go off the edge, a ‹ shows there's more)
 * so the outermost plates, the end you're loading, stay in view.
 */
function BarDrawing({ units, stack, onRemove }: { units: Units; stack: number[]; onRemove: (index: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState(0);
  useLayoutEffect(() => {
    const b = box.current;
    const r = row.current;
    if (!b || !r) return;
    const over = r.scrollWidth - b.clientWidth;
    setShift(over > 0 ? -over : 0);
  }, [stack]);

  const H = 124;
  return (
    <div ref={box} className="relative h-full overflow-hidden rounded-[10px] bg-surface" aria-label={`Bar drawing: ${stack.length ? stack.map((p) => formatNumber(p, 2)).join(', ') : 'empty'}. Tap a plate to take it off.`}>
      <div ref={row} className="absolute inset-y-0 left-0 flex items-center transition-transform duration-200" style={{ transform: `translateX(${shift}px)` }}>
        {/* shaft running off the left edge, collar, sleeve under the plates, short overhang */}
        <span className="h-[7px] w-[22px] flex-none bg-[var(--og-chart-dot)]" />
        <span className="h-[34px] w-[7px] flex-none rounded-[2px] bg-[var(--og-chart-dot)]" />
        <span className="relative flex items-center gap-[2px] pr-[22px] pl-[3px]">
          <span aria-hidden className="absolute inset-x-0 top-1/2 h-[9px] -translate-y-1/2 rounded-r-[2px] bg-[var(--og-bar)]" />
          {stack.map((p, i) => {
            const s = plateShape(p, units);
            const last = i === stack.length - 1;
            return (
              <button
                key={i}
                type="button"
                aria-label={`Take off ${formatNumber(p, 2)}`}
                onClick={() => onRemove(i)}
                className="relative flex h-[136px] items-center justify-center"
                style={{ width: Math.round(24 * s.w) }}
              >
                <span
                  className={cx('block w-full rounded-[3px]', last ? 'bg-accent' : 'bg-[var(--og-chart-dot)]')}
                  style={{ height: Math.round(H * s.h) }}
                />
              </button>
            );
          })}
        </span>
      </div>
      {shift < 0 && (
        <span aria-hidden className="absolute inset-y-0 left-0 flex w-5 items-center justify-center bg-gradient-to-r from-[var(--og-surface)] to-transparent text-[15px] font-bold text-fg2">
          ‹
        </span>
      )}
      {!stack.length && <span className="absolute inset-x-0 bottom-2 text-center text-[11px] text-fg3">Empty bar</span>}
    </div>
  );
}

/** A5: which bar this exercise uses. Remembered per exercise. */
export function BarPicker({
  open,
  exerciseName,
  units,
  bar,
  onPick,
  onClose,
}: {
  open: boolean;
  exerciseName: string;
  units: Units;
  bar: number;
  onPick: (weight: number) => void;
  onClose: () => void;
}) {
  const [custom, setCustom] = useState(false);
  const [text, setText] = useState('');
  useEffect(() => {
    if (open) {
      setCustom(barIdFor(bar, units) === 'custom');
      setText(barIdFor(bar, units) === 'custom' ? formatNumber(bar, 2) : '');
    }
  }, [open, bar, units]);
  const current = barIdFor(bar, units);
  const value = Number(text);
  const valid = text !== '' && Number.isFinite(value) && value >= 0 && value < 200;
  return (
    <Sheet open={open} onClose={onClose} title={`Bar for ${exerciseName}`} subtitle="Remembered per exercise. Plates are added on top of this.">
      {BAR_OPTIONS[units].map((b) => (
        <button
          key={b.id}
          type="button"
          onClick={() => {
            onPick(b.weight);
            onClose();
          }}
          className="flex min-h-[48px] w-full items-center gap-3 border-b border-line text-left text-[16px]"
        >
          <span className="min-w-0 flex-1 truncate">{b.label}</span>
          <span className="text-[13px] text-fg2">
            {formatNumber(b.weight, 2)} {units}
          </span>
          <Radio on={!custom && current === b.id} />
        </button>
      ))}
      <button type="button" onClick={() => setCustom(true)} className="flex min-h-[48px] w-full items-center gap-3 text-left text-[16px]">
        <span className="min-w-0 flex-1">Custom…</span>
        <Radio on={custom} />
      </button>
      {custom && (
        <div className="flex items-center gap-2 pb-1">
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))}
            placeholder={`Bar weight (${units})`}
            className="h-11 min-w-0 flex-1 rounded-[10px] border-[1.5px] border-transparent bg-surface-2 px-3 text-[16px] outline-none focus:border-accent"
          />
          <Button
            size="md"
            className="w-[90px]"
            disabled={!valid}
            onClick={() => {
              onPick(value);
              onClose();
            }}
          >
            Use
          </Button>
        </div>
      )}
    </Sheet>
  );
}
