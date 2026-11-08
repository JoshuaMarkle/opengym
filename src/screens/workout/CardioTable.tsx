import { useMemo } from 'react';
import { SwipeRow } from '../../components/gestures';
import { CheckGlyph } from '../../components/icons';
import { cx } from '../../components/ui';
import type { CardioColumn, Exercise, Units, WorkoutSet } from '../../db/types';
import {
  CARDIO_VALUE_KEYS,
  cardioColumns,
  cardioTotals,
  columnHeader,
  columnText,
  formatField,
  isComputed,
  segmentPlaceholders,
  totalText,
  type CardioField,
  type CardioValues,
} from '../../lib/cardio';
import { Cell, type EditingCell } from './SetTable';

const FIELD: Partial<Record<CardioColumn | 'time', CardioField>> = {
  time: 'time',
  distance: 'distance',
  speed: 'speed',
  incline: 'incline',
  level: 'level',
  calories: 'calories',
  steps: 'steps',
};

const valueOf = (v: CardioValues, f: CardioField) => (f === 'time' ? v.durationSec : v[f]);

/**
 * C1 / C3 / C4: cardio inside the row. `# | TIME | col2 | col3 | ✓`, no Previous
 * column. Empty boxes show last time's numbers in grey and ✓ accepts them;
 * worked-out columns (split, pace) are grey and not editable. A Σ row adds up
 * the ticked segments, only when there are two or more.
 */
export function CardioTable({
  exercise,
  sets,
  previous,
  units,
  editing,
  onEdit,
  onToggle,
  onDelete,
  onMenu,
}: {
  exercise: Exercise;
  sets: WorkoutSet[];
  previous?: CardioValues[];
  units: Units;
  editing: EditingCell | null;
  onEdit: (set: WorkoutSet, field: CardioField) => void;
  onToggle: (set: WorkoutSet) => void;
  onDelete: (set: WorkoutSet) => void;
  onMenu: (set: WorkoutSet, rect: DOMRect) => void;
}) {
  const cols: (CardioColumn | 'time')[] = ['time', ...cardioColumns(exercise)];
  const grid = { gridTemplateColumns: `30px repeat(${cols.length}, minmax(0,1fr)) 46px` };
  const placeholders = useMemo(() => segmentPlaceholders(sets, previous), [sets, previous]);
  const currentId = sets.find((s) => !s.completed)?.id;
  const done = sets.filter((s) => s.completed);
  const totals = cardioTotals(done);

  return (
    <div className="mt-3 text-[15px]" role="table" aria-label={`${exercise.name} segments`}>
      <div role="row" className="grid h-6 items-center gap-1 px-1 text-[11px] font-bold tracking-[0.06em] text-fg2" style={grid}>
        <span className="text-center">#</span>
        {cols.map((c) => (
          <span key={c} className="truncate text-center">
            {columnHeader(c, exercise, units)}
          </span>
        ))}
        <span className="text-center">✓</span>
      </div>
      <div className="flex flex-col gap-[3px]">
        {sets.map((s, i) => {
          const isCur = s.id === currentId;
          const ph = s.completed ? undefined : placeholders.get(s.id);
          const merged: CardioValues = { ...ph, ...strip(s) };
          const tone = s.completed ? 'done' : isCur ? 'current' : 'ghost';
          return (
            <SwipeRow key={s.id} left={{ label: 'Delete', onTrigger: () => onDelete(s) }} onLongPress={(rect) => onMenu(s, rect)}>
              <div
                role="row"
                data-set-id={s.id}
                className={cx('grid h-11 items-center gap-1 rounded-[9px] px-1 transition-colors', s.completed && 'bg-done', editing?.setId === s.id && !s.completed && 'bg-surface/50')}
                style={grid}
              >
                <button
                  type="button"
                  aria-label={`Segment ${i + 1} options`}
                  onClick={(e) => onMenu(s, (e.currentTarget.closest('[role=row]') as HTMLElement).getBoundingClientRect())}
                  className="flex h-11 items-center justify-center text-[14px] font-bold"
                >
                  {i + 1}
                </button>
                {cols.map((c) => {
                  const f = FIELD[c];
                  if (!f || (c !== 'time' && isComputed(c))) {
                    const text = columnText(c, merged, exercise, units);
                    return (
                      <span key={c} className={cx('truncate text-center text-[15px] font-medium', s.completed ? 'text-fg2' : 'text-fg3')}>
                        {text || '—'}
                      </span>
                    );
                  }
                  const isEdit = editing?.setId === s.id && editing.field === f;
                  const own = valueOf(s, f);
                  return (
                    <Cell
                      key={c}
                      editing={isEdit}
                      text={isEdit ? editing!.text : formatField(f, own, exercise, units)}
                      placeholder={own == null && ph ? formatField(f, valueOf(ph, f), exercise, units) : ''}
                      tone={tone}
                      onClick={() => onEdit(s, f)}
                      label={`Segment ${i + 1} ${f}`}
                    />
                  );
                })}
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={s.completed}
                  aria-label={`Complete segment ${i + 1}`}
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
      {sets.length >= 2 && (
        <div className="mt-1.5 grid h-10 items-center gap-1 border-t border-line px-1 text-[15px]" style={grid} aria-label="Totals">
          <span className="text-center text-[13px] font-bold text-fg2">Σ</span>
          {cols.map((c) => (
            <span key={c} className={cx('truncate text-center font-semibold', !done.length && 'text-fg3')}>
              {done.length ? totalText(c, totals, exercise, units) : '—'}
            </span>
          ))}
          <span />
        </div>
      )}
    </div>
  );
}

function strip(s: WorkoutSet): CardioValues {
  const out: CardioValues = {};
  for (const k of CARDIO_VALUE_KEYS) if (s[k] != null) out[k] = s[k];
  return out;
}

/** D5: a finished cardio session as a read-only mini table. Σ only with two or more segments. */
export function CardioMiniTable({ exercise, sets, units }: { exercise: Exercise; sets: CardioValues[]; units: Units }) {
  const cols: (CardioColumn | 'time')[] = ['time', ...cardioColumns(exercise)];
  const grid = { gridTemplateColumns: `28px repeat(${cols.length}, minmax(0,1fr))` };
  const totals = cardioTotals(sets);
  return (
    <div className="text-[14.5px]">
      <div className="grid h-5 items-center text-[10.5px] font-bold tracking-[0.05em] text-fg2" style={grid}>
        <span />
        {cols.map((c) => (
          <span key={c} className="truncate">
            {columnHeader(c, exercise, units)}
          </span>
        ))}
      </div>
      {sets.map((s, i) => (
        <div key={i} className="grid h-7 items-center" style={grid}>
          <span className="text-[13px] font-bold text-fg2">{i + 1}</span>
          {cols.map((c) => (
            <span key={c} className={cx('truncate', c !== 'time' && isComputed(c) && 'text-fg2')}>
              {columnText(c, s, exercise, units) || '—'}
            </span>
          ))}
        </div>
      ))}
      {sets.length >= 2 && (
        <div className="grid h-7 items-center border-t border-line font-semibold" style={grid}>
          <span className="text-[13px] font-bold text-fg2">Σ</span>
          {cols.map((c) => (
            <span key={c} className="truncate">
              {totalText(c, totals, exercise, units, false) || '—'}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
