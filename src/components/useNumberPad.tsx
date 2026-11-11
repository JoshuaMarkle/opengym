import { useEffect, useState, type ReactNode } from 'react';
import { applyKey } from '../lib/keypad';
import { Keypad, type KeypadTab } from './Keypad';

/** One number typed on the keypad dock (design §13), shown in an InlineValue or ValueButton. */
export interface PadField {
  id: string;
  /** The keypad's left label: "Weight", "Amount". */
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  mode?: 'decimal' | 'int';
  /** ± step and its label under the key ("1 lb", "10 g"). */
  step: number;
  stepLabel: string;
  /** The ½ key in the bottom-left (food amounts, nutrition-plan §3.5). */
  half?: boolean;
  /** A field switch in the toolbar (g · serv · oz): the selected tab is drawn in action fill. */
  tabs?: KeypadTab[];
  tab?: string;
  onTab?: (id: string) => void;
}

/**
 * The keypad dock for screens outside a workout (Food setup, targets, amounts). Tapping a field
 * opens the dock on it; the first key replaces the value, like a selected field. The confirm
 * moves to the next field and closes after the last (or runs `onDone`, e.g. Log). Render `pad`
 * where the screen's footer goes: it carries `data-dock`, so toasts sit above it.
 */
export function useNumberPad(fields: PadField[], opts: { onDone?: () => void; doneLabel?: string; doneAria?: string } = {}) {
  const [active, setActive] = useState<string | null>(null);
  const [fresh, setFresh] = useState(true);
  const i = fields.findIndex((f) => f.id === active);
  const f = i >= 0 ? fields[i] : undefined;

  const open = (id: string) => {
    setActive(id);
    setFresh(true);
  };
  const close = () => setActive(null);

  // Keep the field being typed in above the dock.
  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => document.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60);
    return () => window.clearTimeout(t);
  }, [active]);

  const last = i === fields.length - 1;
  const pad = f ? (
    <Keypad
      left={f.label}
      tabs={f.tabs}
      tab={f.tab}
      onTab={f.onTab}
      next={{
        done: last,
        onPress: () => {
          if (!last) open(fields[i + 1].id);
          else {
            close();
            opts.onDone?.();
          }
        },
      }}
      nextLabel={last ? opts.doneLabel : undefined}
      nextAria={last ? (opts.doneAria ?? opts.doneLabel ?? 'Done') : 'Next field'}
      bottomLeft={{ key: f.half ? 'half' : 'minus', enabled: !!f.half }}
      decimal={f.mode !== 'int'}
      stepLabel={f.stepLabel}
      onKey={(k) => {
        f.onChange(applyKey(f.value, fresh, k, { mode: f.mode ?? 'decimal', step: f.step }));
        setFresh(false);
      }}
      onClose={close}
    />
  ) : null;

  return { active, open, close, pad };
}
