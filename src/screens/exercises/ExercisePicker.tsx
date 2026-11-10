import { useMemo, useState, type ReactNode } from 'react';
import { FullScreen } from '../../components/overlays';
import { AddRow, BarButton, Check, Chips, cx, Screen, SearchField, Segmented, Tag, TopBar } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { areaLabel, equipmentLabel, MUSCLES, muscleLabel, type Exercise, type Muscle } from '../../db/types';
import { columnsLabel } from '../../lib/cardio';
import { TYPE_TAG } from '../../lib/sets';
import { isShown, rankPopular, visibleAZ } from '../../lib/popularity';
import { ExerciseFormView } from './ExerciseFormView';
import { exerciseMeta, HiddenFooter, sessionsText, useExerciseSort, useInRoutines } from './popular';

export interface PickerCurrent {
  exerciseId: string;
  /** Can't be unticked here (e.g. it has logged sets). */
  locked?: boolean;
  sub?: string;
}

export type MuscleFilter = Muscle | 'all' | 'cardio';

/** All, the muscles, then Cardio last (8.6, popularity A1). */
export const FILTER_CHIPS: { value: MuscleFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  ...MUSCLES.map((m) => ({ value: m.id as MuscleFilter, label: m.label })),
  { value: 'cardio', label: 'Cardio' },
];

export function searchExercises(list: Exercise[], query: string, muscle: MuscleFilter): Exercise[] {
  const q = query.trim().toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  const filtered = list.filter((e) => {
    if (e.archived) return false;
    if (muscle === 'cardio' ? e.type !== 'cardio' : muscle !== 'all' && (e.muscle !== muscle || e.type === 'cardio')) return false;
    if (!tokens.length) return true;
    // Area words ("forearms", "lower back") make search find them without a chip.
    const hay = (e.type === 'cardio' ? `${e.name} cardio` : `${e.name} ${muscleLabel(e.muscle)} ${e.area ? areaLabel(e.area) : ''} ${equipmentLabel(e.equipment)}`).toLowerCase();
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
 * to remove), "Added" in tick order, then Popular (You do, Most popular) or
 * A–Z; searching ranks yours first and dims rare matches (A2). Single: tap one to pick it.
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
  const skip = useMemo(() => new Set([...currentIds, ...added, ...excludeIds]), [currentIds, added, excludeIds]);
  const searching = query.trim().length > 0;
  const results = useMemo(() => searchExercises(exercises, query, muscle).filter((e) => !skip.has(e.id)), [exercises, query, muscle, skip]);
  const inRoutines = useInRoutines();
  const [sort, setSort] = useExerciseSort();
  const [showHidden, setShowHidden] = useState(false);
  const sessions = (id: string) => history.sessionsByExercise.get(id)?.length ?? 0;
  const keep = (id: string) => inRoutines.has(id);
  // Popular (A2): yours, then most popular, rare matches dimmed under Rarely used. A–Z hides the same ones.
  const ranked = useMemo(
    () => (searching || sort === 'popular' ? rankPopular(results, { sessions, keep, searching, showHidden }) : null),
    [results, searching, sort, showHidden, history, inRoutines], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const az = useMemo(() => (ranked ? null : visibleAZ(results, { sessions, keep, showHidden })), [ranked, results, showHidden, history, inRoutines]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const row = (e: Exercise, opts: { on?: boolean; struck?: boolean; locked?: boolean; dim?: boolean; sub?: ReactNode; onClick: () => void }) => (
    <button
      key={e.id}
      type="button"
      onClick={opts.onClick}
      disabled={opts.locked}
      className={cx('grid min-h-[52px] w-full grid-cols-[1fr_28px] items-center gap-3 border-b border-line text-left', opts.dim && 'opacity-55')}
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
  if (az) {
    for (const e of az.items) {
      const l = e.name[0].toUpperCase();
      const last = letters[letters.length - 1];
      if (last?.letter === l) last.items.push(e);
      else letters.push({ letter: l, items: [e] });
    }
  }

  const sub = (e: Exercise) => {
    const n = sessions(e.id);
    if (e.type === 'cardio') return columnsLabel(e, settings.units);
    const base = exerciseMeta(e, settings.units, !searching);
    return n ? `${base} · ${sessionsText(n)}` : base;
  };
  const pick = (e: Exercise, dim = false) => row(e, { sub: sub(e), dim, onClick: () => tick(e.id) });

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
            {!searching && (
              <Segmented
                className="mt-2.5"
                options={[
                  { value: 'popular', label: 'Popular' },
                  { value: 'az', label: 'A–Z' },
                ]}
                value={sort}
                onChange={setSort}
              />
            )}
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

      {ranked && (
        <>
          {ranked.youDo.length > 0 && (
            <>
              {groupLabel('You do', undefined, 'accent')}
              {ranked.youDo.map((e) => pick(e))}
            </>
          )}
          {ranked.popular.length > 0 && (
            <>
              {groupLabel('Most popular', ranked.popular.length)}
              {ranked.popular.map((e) => pick(e))}
            </>
          )}
          {ranked.rare.length > 0 && (
            <>
              {groupLabel('Rarely used', ranked.rare.length)}
              {ranked.rare.map((e) => pick(e, true))}
            </>
          )}
          {searching && !results.length && <p className="py-6 text-center text-[14px] text-fg2">No exercise called "{query.trim()}" yet.</p>}
        </>
      )}
      {az && (
        <>
          {groupLabel('A – Z')}
          {letters.map((g) => (
            <div key={g.letter}>
              <div className="sticky top-0 z-[1] bg-bg pt-2 pb-0.5 text-[12px] font-bold text-fg2">{g.letter}</div>
              {g.items.map((e) => pick(e, !isShown(e, sessions, keep)))}
            </div>
          ))}
        </>
      )}
      {!searching && <HiddenFooter count={ranked?.hiddenCount ?? az?.hiddenCount ?? 0} shown={showHidden} onToggle={() => setShowHidden((v) => !v)} />}

      <AddRow onClick={() => setCreating(true)} className="border-b-0">
        New exercise{searching ? ` "${query.trim()}"` : ''}
      </AddRow>
    </Screen>
  );
}
