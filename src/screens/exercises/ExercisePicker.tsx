import { useMemo, useState, type ReactNode } from 'react';
import { FullScreen } from '../../components/overlays';
import { BarButton, Check, Chips, cx, Screen, SearchField, Tag, TopBar } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { equipmentLabel, MUSCLES, muscleLabel, type Exercise, type Muscle } from '../../db/types';
import { columnsLabel } from '../../lib/cardio';
import { TYPE_TAG } from '../../lib/sets';
import { ExerciseFormView } from './ExerciseFormView';

export interface PickerCurrent {
  exerciseId: string;
  /** Can't be unticked here (e.g. it has logged sets). */
  locked?: boolean;
  sub?: string;
}

export type MuscleFilter = Muscle | 'all' | 'cardio';

/** All, Cardio, then the muscles (8.6). */
export const FILTER_CHIPS: { value: MuscleFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'cardio', label: 'Cardio' },
  ...MUSCLES.map((m) => ({ value: m.id as MuscleFilter, label: m.label })),
];

export function searchExercises(list: Exercise[], query: string, muscle: MuscleFilter): Exercise[] {
  const q = query.trim().toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  const filtered = list.filter((e) => {
    if (e.archived) return false;
    if (muscle === 'cardio' ? e.type !== 'cardio' : muscle !== 'all' && (e.muscle !== muscle || e.type === 'cardio')) return false;
    if (!tokens.length) return true;
    const hay = (e.type === 'cardio' ? `${e.name} cardio` : `${e.name} ${muscleLabel(e.muscle)} ${equipmentLabel(e.equipment)}`).toLowerCase();
    return tokens.every((t) => hay.includes(t));
  });
  if (!q) return filtered;
  const rank = (e: Exercise) => {
    const n = e.name.toLowerCase();
    return n.startsWith(q) ? 0 : n.split(/\s+/).some((w) => w.startsWith(tokens[0])) ? 1 : 2;
  };
  return filtered.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

/**
 * The exercise picker (2.5, 2.6, 4.14). Multi: "In this routine/workout" (untick
 * to remove), "Added" in tick order, then A–Z. Single: tap one to pick it.
 */
export function ExercisePicker({
  open,
  mode = 'multi',
  title = 'Exercises',
  currentLabel = 'In this routine',
  current = [],
  excludeIds = [],
  onCancel,
  onDone,
  onPick,
}: {
  open: boolean;
  mode?: 'multi' | 'single';
  title?: string;
  currentLabel?: string;
  current?: PickerCurrent[];
  excludeIds?: string[];
  onCancel: () => void;
  onDone?: (r: { keep: string[]; added: string[] }) => void;
  onPick?: (id: string) => void;
}) {
  return (
    <FullScreen open={open}>
      {open && (
        <PickerBody
          mode={mode}
          title={title}
          currentLabel={currentLabel}
          current={current}
          excludeIds={excludeIds}
          onCancel={onCancel}
          onDone={onDone}
          onPick={onPick}
        />
      )}
    </FullScreen>
  );
}

function PickerBody({
  mode,
  title,
  currentLabel,
  current,
  excludeIds,
  onCancel,
  onDone,
  onPick,
}: {
  mode: 'multi' | 'single';
  title: string;
  currentLabel: string;
  current: PickerCurrent[];
  excludeIds: string[];
  onCancel: () => void;
  onDone?: (r: { keep: string[]; added: string[] }) => void;
  onPick?: (id: string) => void;
}) {
  const { exercises, exerciseMap, history, settings } = useData();
  const short = (e: Exercise) => (e.type === 'cardio' ? columnsLabel(e, settings.units) : muscleLabel(e.muscle));
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleFilter>('all');
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const currentIds = useMemo(() => new Set(current.map((c) => c.exerciseId)), [current]);
  const hidden = useMemo(() => new Set([...currentIds, ...added, ...excludeIds]), [currentIds, added, excludeIds]);
  const searching = query.trim().length > 0;
  const results = useMemo(() => searchExercises(exercises, query, muscle).filter((e) => !hidden.has(e.id)), [exercises, query, muscle, hidden]);

  const sessions = (id: string) => history.sessionsByExercise.get(id)?.length ?? 0;

  const tick = (id: string) => {
    if (mode === 'single') {
      onPick?.(id);
      return;
    }
    setAdded((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  };

  const keepCount = current.filter((c) => !removed.has(c.exerciseId)).length;
  const done = () => onDone?.({ keep: current.filter((c) => !removed.has(c.exerciseId)).map((c) => c.exerciseId), added });

  if (creating) {
    return (
      <ExerciseFormView
        initialName={query.trim().replace(/^\w/, (c) => c.toUpperCase())}
        onCancel={() => setCreating(false)}
        onSaved={(id) => {
          setCreating(false);
          setQuery('');
          if (mode === 'single') onPick?.(id);
          else setAdded((a) => [...a, id]);
        }}
      />
    );
  }

  const row = (e: Exercise, opts: { on?: boolean; struck?: boolean; locked?: boolean; sub?: ReactNode; onClick: () => void }) => (
    <button
      key={e.id}
      type="button"
      onClick={opts.onClick}
      disabled={opts.locked}
      className="grid min-h-[52px] w-full grid-cols-[1fr_28px] items-center gap-3 border-b border-line text-left"
    >
      <span className="min-w-0 py-1.5">
        <b className={cx('block truncate text-[16px] font-semibold', opts.struck && 'text-fg3 line-through')}>
          {e.name}
          {TYPE_TAG[e.type] && <Tag>{TYPE_TAG[e.type]}</Tag>}
        </b>
        <span className="block truncate text-[13px] text-fg2">{opts.sub}</span>
      </span>
      {mode === 'multi' ? <Check on={!!opts.on} disabled={opts.locked} /> : <span />}
    </button>
  );

  const groupLabel = (children: ReactNode, right?: ReactNode, tone?: 'accent') => (
    <div className={cx('mt-5 flex justify-between pb-1 text-[11px] font-bold tracking-[0.06em] uppercase', tone === 'accent' ? 'text-accent' : 'text-fg2')}>
      <span>{children}</span>
      {right !== undefined && <span className="font-semibold tracking-normal normal-case">{right}</span>}
    </div>
  );

  // A–Z with letter headers.
  const letters: { letter: string; items: Exercise[] }[] = [];
  if (!searching) {
    for (const e of results) {
      const l = e.name[0].toUpperCase();
      const last = letters[letters.length - 1];
      if (last?.letter === l) last.items.push(e);
      else letters.push({ letter: l, items: [e] });
    }
  }

  const sub = (e: Exercise) => {
    const n = sessions(e.id);
    if (e.type === 'cardio') return columnsLabel(e, settings.units);
    const base = searching ? `${muscleLabel(e.muscle)} · ${equipmentLabel(e.equipment).toLowerCase()}` : muscleLabel(e.muscle);
    return n ? `${base} · ${n} ${n === 1 ? 'session' : 'sessions'}` : base;
  };

  return (
    <Screen
      header={
        <>
          <TopBar
            left={
              <BarButton kind="muted" onClick={onCancel}>
                Cancel
              </BarButton>
            }
            title={title}
            right={
              mode === 'multi' ? (
                <BarButton kind="bold" onClick={done}>
                  Done
                </BarButton>
              ) : undefined
            }
          />
          <div className="flex-none px-4 pb-2">
            <SearchField value={query} onChange={setQuery} placeholder={`Search ${exercises.length} exercises`} />
            <Chips
              className="mt-2.5"
              options={FILTER_CHIPS}
              value={muscle}
              onChange={setMuscle}
            />
          </div>
        </>
      }
    >
      {mode === 'multi' && !searching && current.length > 0 && (
        <>
          {groupLabel(currentLabel, `${keepCount} of ${current.length} kept`)}
          {current.map((c) => {
            const e = exerciseMap.get(c.exerciseId);
            if (!e) return null;
            const off = removed.has(c.exerciseId);
            return row(e, {
              on: !off,
              struck: off,
              locked: c.locked,
              sub: off ? 'will be removed' : (c.sub ?? short(e)),
              onClick: () =>
                setRemoved((r) => {
                  const n = new Set(r);
                  if (n.has(c.exerciseId)) n.delete(c.exerciseId);
                  else n.add(c.exerciseId);
                  return n;
                }),
            });
          })}
        </>
      )}

      {mode === 'multi' && added.length > 0 && (
        <>
          {groupLabel('Added', added.length, 'accent')}
          {added.map((id) => {
            const e = exerciseMap.get(id);
            if (!e) return null;
            return row(e, { on: true, sub: short(e), onClick: () => tick(id) });
          })}
        </>
      )}

      {searching ? (
        <>
          {groupLabel(`Results for "${query.trim()}"`, results.length)}
          {results.map((e) => row(e, { sub: sub(e), onClick: () => tick(e.id) }))}
          {!results.length && <p className="py-6 text-center text-[14px] text-fg2">No exercise called "{query.trim()}" yet.</p>}
        </>
      ) : (
        <>
          {groupLabel('A – Z')}
          {letters.map((g) => (
            <div key={g.letter}>
              <div className="sticky top-0 z-[1] bg-bg pt-2 pb-0.5 text-[12px] font-bold text-fg2">{g.letter}</div>
              {g.items.map((e) => row(e, { sub: sub(e), onClick: () => tick(e.id) }))}
            </div>
          ))}
        </>
      )}

      <button type="button" onClick={() => setCreating(true)} className="flex h-[52px] w-full items-center gap-2.5 text-[16px] font-semibold text-accent">
        <span className="flex h-[24px] w-[24px] items-center justify-center rounded-full bg-accent text-[17px] leading-none text-white">+</span>
        New exercise{searching ? ` "${query.trim()}"` : ''}
      </button>
    </Screen>
  );
}
