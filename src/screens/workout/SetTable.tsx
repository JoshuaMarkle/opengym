import { useMemo } from 'react';
import { SwipeRow } from '../../components/gestures';
import { CheckGlyph } from '../../components/icons';
import { cx, DropBadge } from '../../components/ui';
import type { Exercise, Units, WorkoutSet } from '../../db/types';
import { matchPrevious } from '../../lib/previous';
import { formatRepRange, formatSet, hasWeightColumn, setLabels, weightColumnLabel } from '../../lib/sets';
import { formatWeight, unitColumn } from '../../lib/units';

export type Field = 'weight' | 'reps';

export interface EditingCell {
  setId: string;
  field: Field;
  text: string;
}

/** What a weight cell shows when not being edited. */
export function weightCellText(weight: number | undefined, ex: Exercise, units: Units): string {
  if (ex.type === 'bodyweight_plus') return weight && weight > 0 ? `+${formatWeight(weight, units)}` : 'BW';
  if (ex.type === 'assisted') return weight && weight < 0 ? `−${formatWeight(-weight, units)}` : weight && weight > 0 ? `+${formatWeight(weight, units)}` : 'BW';
  return weight == null ? '' : formatWeight(weight, units);
}

/** Editable text for the weight keypad (assisted edits the assistance as a positive number). */
export function weightEditText(weight: number | undefined, ex: Exercise, units: Units): string {
  if (weight == null) return '';
  if (ex.type === 'assisted') return weight < 0 ? formatWeight(-weight, units) : weight === 0 ? '' : `-${formatWeight(weight, units)}`;
  if (ex.type === 'bodyweight_plus' && weight === 0) return '';
  return formatWeight(weight, units);
}

/**
 * The weight being typed, shown with its implied sign. Assisted weights are
 * typed as the assistance (stored negative); BW + added as the added weight.
 * The keypad's − key flips that default.
 */
export function weightEditDisplay(text: string, ex: Exercise): string {
  const neg = text.startsWith('-');
  const mag = neg ? text.slice(1) : text;
  if (ex.type === 'assisted') return mag ? `${neg ? '+' : '−'}${mag}` : neg ? '+' : '';
  if (ex.type === 'bodyweight_plus') return mag ? `${neg ? '−' : '+'}${mag}` : neg ? '−' : '';
  return neg ? `−${mag}` : text;
}

/** Turn typed weight text back into stored lb (see weightEditDisplay). */
export function weightFromEdit(value: number | undefined, ex: Exercise): number | undefined {
  if (value === undefined) return ex.type === 'bodyweight_plus' || ex.type === 'assisted' ? 0 : undefined;
  return ex.type === 'assisted' ? -value : value;
}

export function SetTable({
  exercise,
  sets,
  previous,
  units,
  editing,
  barPlaceholderLb,
  onEdit,
  onToggle,
  onToggleWarmup,
  onDelete,
  onMenu,
}: {
  exercise: Exercise;
  sets: WorkoutSet[];
  previous?: WorkoutSet[];
  units: Units;
  editing: EditingCell | null;
  barPlaceholderLb?: number;
  onEdit: (set: WorkoutSet, field: Field) => void;
  onToggle: (set: WorkoutSet) => void;
  onToggleWarmup: (set: WorkoutSet) => void;
  onDelete: (set: WorkoutSet) => void;
  onMenu: (set: WorkoutSet, rect: DOMRect) => void;
}) {
  const showWeight = hasWeightColumn(exercise.type);
  const labels = useMemo(() => setLabels(sets), [sets]);
  const prev = useMemo(() => matchPrevious(sets, previous), [sets, previous]);
  const currentId = sets.find((s) => !s.completed)?.id;
  const cols = showWeight ? 'grid-cols-[34px_minmax(0,1fr)_74px_58px_46px]' : 'grid-cols-[34px_minmax(0,1fr)_74px_46px]';

  return (
    <div className="mt-3 text-[15px]" role="table" aria-label={`${exercise.name} sets`}>
      <div role="row" className={cx('grid h-6 items-center px-1 text-[11px] font-bold tracking-[0.06em] text-fg2', cols)}>
        <span className="text-center">SET</span>
        <span className="pl-1">PREVIOUS</span>
        {showWeight && <span className="text-center">{weightColumnLabel(exercise.type, unitColumn(units))}</span>}
        <span className="text-center">REPS</span>
        <span className="text-center">✓</span>
      </div>
      <div className="flex flex-col gap-[3px]">
        {sets.map((s) => {
          const label = labels.get(s.id)!;
          const p = prev.get(s.id);
          const isDrop = s.kind === 'drop';
          const isCur = s.id === currentId;
          const ghost = !s.completed && !isCur;
          const editW = editing?.setId === s.id && editing.field === 'weight';
          const editR = editing?.setId === s.id && editing.field === 'reps';
          const wText = weightCellText(s.weight, exercise, units);
          const wPlaceholder = !wText && barPlaceholderLb != null && exercise.type === 'weight' ? formatWeight(barPlaceholderLb, units) : '';
          const range = formatRepRange(s.repsMin, s.repsMax);
          return (
            <SwipeRow
              key={s.id}
              className={cx(isDrop && 'ml-3.5')}
              right={
                isDrop
                  ? undefined
                  : {
                      label: (
                        <span className="flex items-center gap-2">
                          <span className="flex h-[19px] w-[19px] items-center justify-center rounded-[5px] bg-white text-[11px] font-extrabold text-black">{s.kind === 'warmup' ? '1' : 'W'}</span>
                          {s.kind === 'warmup' ? 'Working set' : 'Warm-up'}
                        </span>
                      ),
                      onTrigger: () => onToggleWarmup(s),
                    }
              }
              left={{ label: 'Delete', onTrigger: () => onDelete(s) }}
              onLongPress={(rect) => onMenu(s, rect)}
            >
              <div
                role="row"
                data-set-id={s.id}
                className={cx(
                  'grid h-11 items-center rounded-[9px] px-1 transition-colors',
                  cols,
                  s.completed && 'bg-done',
                  isDrop && 'rounded-l-none border-l-2 border-warn',
                  (editW || editR) && !s.completed && 'bg-surface/50',
                )}
              >
                <button
                  type="button"
                  aria-label={`Set ${label} options`}
                  onClick={(e) => onMenu(s, (e.currentTarget.closest('[role=row]') as HTMLElement).getBoundingClientRect())}
                  className={cx('flex h-11 items-center justify-center text-[14px] font-bold', s.kind === 'warmup' && 'text-fg2', isDrop && 'text-warn')}
                >
                  {label}
                </button>
                <span className="flex min-w-0 items-center gap-1.5 pl-1 text-[13.5px] whitespace-nowrap text-fg2">
                  <span className="truncate">{p?.prev ? formatSet(p.prev, exercise.type, units) : '—'}</span>
                  {p?.prevHadDrop && <DropBadge />}
                </span>
                {showWeight && (
                  <Cell
                    editing={editW}
                    text={editW ? weightEditDisplay(editing!.text, exercise) : wText}
                    placeholder={wPlaceholder}
                    tone={s.completed ? 'done' : isCur ? 'current' : ghost ? 'ghost' : 'current'}
                    onClick={() => onEdit(s, 'weight')}
                    label={`Set ${label} weight`}
                  />
                )}
                <Cell
                  editing={editR}
                  text={editR ? editing!.text : s.reps != null ? String(s.reps) : ''}
                  placeholder={range}
                  tone={s.completed ? 'done' : isCur ? 'current' : 'ghost'}
                  onClick={() => onEdit(s, 'reps')}
                  label={`Set ${label} reps`}
                />
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={s.completed}
                  aria-label={`Complete set ${label}`}
                  onClick={() => onToggle(s)}
                  className="flex h-11 items-center justify-center active:scale-90"
                >
                  <span
                    className={cx(
                      'flex h-[28px] w-[28px] items-center justify-center rounded-[8px] border-[1.5px] transition-colors',
                      s.completed ? 'border-accent bg-accent text-white' : isCur ? 'border-fg3' : 'border-line-strong',
                    )}
                  >
                    {s.completed && <CheckGlyph size={15} />}
                  </span>
                </button>
              </div>
            </SwipeRow>
          );
        })}
      </div>
    </div>
  );
}

function Cell({
  text,
  placeholder,
  editing,
  tone,
  onClick,
  label,
}: {
  text: string;
  placeholder?: string;
  editing: boolean;
  tone: 'done' | 'current' | 'ghost';
  onClick: () => void;
  label: string;
}) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="flex h-11 items-center justify-center px-[3px]">
      <span
        className={cx(
          'flex h-[32px] w-full items-center justify-center rounded-[7px] text-[16px] font-semibold',
          editing ? 'border-2 border-accent bg-edit text-fg' : tone === 'done' ? 'bg-transparent' : 'bg-surface',
          !editing && tone === 'current' && 'ring-[1.5px] ring-accent/70 ring-inset',
          !editing && tone === 'ghost' && 'text-fg2',
        )}
      >
        {text ? (
          <span className="truncate">{text}</span>
        ) : editing ? null : (
          <span className="truncate text-[13px] font-medium text-fg2">{placeholder}</span>
        )}
        {editing && <span className="ml-[1px] h-[17px] w-[1.5px] animate-pulse bg-accent" />}
      </span>
    </button>
  );
}
