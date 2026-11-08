import { useEffect, useState } from 'react';
import { Sheet } from '../../components/overlays';
import { Button, Check, cx } from '../../components/ui';
import { MAX_SUPERSET } from '../../lib/supersets';

export interface SupersetCandidate {
  key: string;
  name: string;
  /** "in this routine", "just added", "in superset B" */
  sub: string;
  disabled?: boolean;
}

/**
 * B2: "Superset Bench Press with…". Pick from the routine (or workout), or add a
 * new exercise. A superset holds up to three exercises; they alternate sets.
 */
export function SupersetSheet({
  open,
  anchorName,
  groupSize,
  candidates,
  preselect,
  addLabel,
  onAddAnother,
  onMake,
  onClose,
}: {
  open: boolean;
  anchorName: string;
  /** Members already in the anchor's superset (1 when it isn't in one). */
  groupSize: number;
  candidates: SupersetCandidate[];
  /** Keys to tick when the sheet opens (an exercise you just added). */
  preselect?: string[];
  addLabel: string;
  onAddAnother: () => void;
  onMake: (keys: string[]) => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const room = Math.max(0, MAX_SUPERSET - groupSize);
  const pre = (preselect ?? []).join('|');
  useEffect(() => {
    if (open) setPicked((preselect ?? []).slice(0, room));
  }, [open, pre]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (key: string) =>
    setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : room === 1 ? [key] : p.length < room ? [...p, key] : p));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Superset ${anchorName} with…`}
      subtitle={groupSize > 1 ? `Up to ${MAX_SUPERSET} exercises. They take turns, one set each.` : 'They’ll alternate: a set of one, then a set of the other.'}
    >
      {candidates.map((c) => {
        const on = picked.includes(c.key);
        return (
          <button
            key={c.key}
            type="button"
            disabled={c.disabled}
            onClick={() => toggle(c.key)}
            className="flex min-h-[52px] w-full items-center gap-3 border-b border-line text-left disabled:opacity-40"
          >
            <span className="min-w-0 flex-1 py-1.5">
              <b className="block truncate text-[16px] font-semibold">{c.name}</b>
              <span className={cx('block truncate text-[13px]', c.sub === 'just added' ? 'text-accent' : 'text-fg2')}>{c.sub}</span>
            </span>
            <Check on={on} />
          </button>
        );
      })}
      {!candidates.length && <p className="py-3 text-[14px] text-fg2">Nothing else to pair with yet.</p>}
      <button type="button" onClick={onAddAnother} className="flex min-h-[52px] w-full flex-col justify-center border-b border-line text-left">
        <b className="text-[16px] font-semibold text-accent">+ Another exercise…</b>
        <span className="text-[13px] text-fg2">{addLabel}</span>
      </button>
      <Button className="mt-4" disabled={!picked.length} onClick={() => onMake(picked)}>
        Make superset
      </Button>
    </Sheet>
  );
}
