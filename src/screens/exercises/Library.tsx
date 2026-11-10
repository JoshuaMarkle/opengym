import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronRight } from '../../components/icons';
import { BackButton, BarButton, Chips, cx, Screen, SearchField, Segmented, Tag, TopBar } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import type { Exercise } from '../../db/types';
import { isShown, rankPopular, visibleAZ } from '../../lib/popularity';
import { TYPE_TAG } from '../../lib/sets';
import { FILTER_CHIPS, searchExercises, type MuscleFilter } from './ExercisePicker';
import { exerciseMeta, HiddenFooter, ListHead, sessionsText, useExerciseSort, useInRoutines } from './popular';

type Filter = MuscleFilter | 'custom';

/**
 * 8.1: every exercise, built-in and custom. Popular (A1): your 4 most-logged,
 * then the rest most popular first; rarely used ones (popularity ≤ 3) wait for
 * a search or Show hidden (A3). A–Z is one tap away and remembered.
 */
export function Library() {
  const navigate = useNavigate();
  const { exercises, history, settings } = useData();
  const inRoutines = useInRoutines();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useExerciseSort();
  const [showHidden, setShowHidden] = useState(false);
  const searching = query.trim().length > 0;
  const sessions = (id: string) => history.sessionsByExercise.get(id)?.length ?? 0;
  const keep = (id: string) => inRoutines.has(id);

  const list = useMemo(() => {
    const base = searchExercises(exercises, query, filter === 'all' || filter === 'custom' ? 'all' : filter);
    return filter === 'custom' ? base.filter((e) => e.isCustom) : base;
  }, [exercises, query, filter]);

  const ranked = useMemo(
    () => (searching || sort === 'popular' ? rankPopular(list, { sessions, keep, searching, showHidden }) : null),
    [list, searching, sort, showHidden, history, inRoutines], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const az = useMemo(() => (ranked ? null : visibleAZ(list, { sessions, keep, showHidden })), [ranked, list, showHidden, history, inRoutines]); // eslint-disable-line react-hooks/exhaustive-deps

  const letters: { letter: string; items: Exercise[] }[] = [];
  for (const e of az?.items ?? []) {
    const l = e.name[0].toUpperCase();
    const last = letters[letters.length - 1];
    if (last?.letter === l) last.items.push(e);
    else letters.push({ letter: l, items: [e] });
  }
  const filterLabel = filter === 'all' ? '' : ` · ${FILTER_CHIPS.find((c) => c.value === filter)?.label ?? 'Custom'}`;
  const hiddenCount = ranked?.hiddenCount ?? az?.hiddenCount ?? 0;
  const empty = ranked ? !ranked.youDo.length && !ranked.popular.length && !ranked.rare.length : !az?.items.length;

  const row = (e: Exercise, dim = false) => {
    const n = sessions(e.id);
    return (
      <button
        key={e.id}
        type="button"
        onClick={() => navigate(`/exercises/${e.id}`)}
        className={cx('flex min-h-[54px] w-full items-center gap-3 border-b border-line text-left active:bg-surface/60', dim && 'opacity-55')}
      >
        <span className="min-w-0 flex-1 py-1.5">
          <b className="block truncate text-[16px] font-semibold">
            {e.name}
            {TYPE_TAG[e.type] && <Tag>{TYPE_TAG[e.type]}</Tag>}
            {e.isCustom && <Tag>CUSTOM</Tag>}
          </b>
          <span className="block truncate text-[13px] text-fg2">
            {exerciseMeta(e, settings.units)}
            {n ? ` · ${sessionsText(n)}` : ''}
          </span>
        </span>
        <ChevronRight size={13} className="flex-none text-fg3" />
      </button>
    );
  };

  return (
    <Screen
      header={
        <>
          <TopBar
            left={<BackButton label="Settings" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/settings'))} />}
            title="Exercises"
            right={
              <BarButton aria-label="New exercise" className="text-[30px] leading-none font-normal" onClick={() => navigate('/exercises/new')}>
                +
              </BarButton>
            }
          />
          <div className="flex-none px-4 pb-2">
            <SearchField value={query} onChange={setQuery} placeholder={`Search ${exercises.length} exercises`} />
            <Chips
              className="mt-2.5"
              options={[...FILTER_CHIPS.map((c) => ({ value: c.value as Filter, label: c.label })), { value: 'custom' as Filter, label: 'Custom' }]}
              value={filter}
              onChange={setFilter}
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
      {ranked && (
        <>
          {ranked.youDo.length > 0 && (
            <>
              <ListHead tone="accent">You do</ListHead>
              {ranked.youDo.map((e) => row(e))}
            </>
          )}
          {ranked.popular.length > 0 && (
            <>
              <ListHead count={ranked.popular.length}>{searching ? `Most popular` : `Most popular${filterLabel}`}</ListHead>
              {ranked.popular.map((e) => row(e))}
            </>
          )}
          {ranked.rare.length > 0 && (
            <>
              <ListHead count={ranked.rare.length}>Rarely used</ListHead>
              {ranked.rare.map((e) => row(e, true))}
            </>
          )}
        </>
      )}
      {letters.map((g) => (
        <div key={g.letter}>
          <div className="sticky top-0 z-[1] bg-bg pt-3 pb-0.5 text-[12px] font-bold text-fg2">{g.letter}</div>
          {g.items.map((e) => row(e, !isShown(e, sessions, keep)))}
        </div>
      ))}
      {!searching && <HiddenFooter count={hiddenCount} shown={showHidden} onToggle={() => setShowHidden((v) => !v)} />}
      {empty && (
        <div className="py-10 text-center">
          <p className="text-[14px] text-fg2">{searching ? `No exercise called "${query.trim()}".` : 'Nothing here yet.'}</p>
          <button type="button" onClick={() => navigate(`/exercises/new${searching ? `?name=${encodeURIComponent(query.trim())}` : ''}`)} className="mt-2 h-11 px-3 text-[15px] font-semibold text-accent">
            + New exercise{searching ? ` "${query.trim()}"` : ''}
          </button>
        </div>
      )}
    </Screen>
  );
}
