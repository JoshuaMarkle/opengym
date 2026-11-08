import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronRight } from '../../components/icons';
import { BackButton, BarButton, Chips, Screen, SearchField, Tag, TopBar } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { equipmentLabel, muscleLabel } from '../../db/types';
import { columnsLabel } from '../../lib/cardio';
import { TYPE_TAG } from '../../lib/sets';
import { FILTER_CHIPS, searchExercises, type MuscleFilter } from './ExercisePicker';

type Filter = MuscleFilter | 'custom';

/** 8.1: every exercise, built-in and custom, with how often you've done it. */
export function Library() {
  const navigate = useNavigate();
  const { exercises, history, settings } = useData();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const searching = query.trim().length > 0;

  const list = useMemo(() => {
    const base = searchExercises(exercises, query, filter === 'all' || filter === 'custom' ? 'all' : filter);
    return filter === 'custom' ? base.filter((e) => e.isCustom) : base;
  }, [exercises, query, filter]);

  const groups: { letter: string; items: typeof list }[] = [];
  if (!searching) {
    for (const e of list) {
      const l = e.name[0].toUpperCase();
      const last = groups[groups.length - 1];
      if (last?.letter === l) last.items.push(e);
      else groups.push({ letter: l, items: [e] });
    }
  } else groups.push({ letter: '', items: list });

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
          </div>
        </>
      }
    >
      {groups.map((g) => (
        <div key={g.letter || 'results'}>
          {g.letter && <div className="sticky top-0 z-[1] bg-bg pt-3 pb-0.5 text-[12px] font-bold text-fg2">{g.letter}</div>}
          {g.items.map((e) => {
            const n = history.sessionsByExercise.get(e.id)?.length ?? 0;
            return (
              <button key={e.id} type="button" onClick={() => navigate(`/exercises/${e.id}`)} className="flex min-h-[54px] w-full items-center gap-3 border-b border-line text-left active:bg-surface/60">
                <span className="min-w-0 flex-1 py-1.5">
                  <b className="block truncate text-[16px] font-semibold">
                    {e.name}
                    {TYPE_TAG[e.type] && <Tag>{TYPE_TAG[e.type]}</Tag>}
                    {e.isCustom && <Tag>CUSTOM</Tag>}
                  </b>
                  <span className="block truncate text-[13px] text-fg2">
                    {e.type === 'cardio' ? `Cardio · ${columnsLabel(e, settings.units)}` : `${muscleLabel(e.muscle)} · ${equipmentLabel(e.equipment).toLowerCase()}`}
                    {n ? ` · ${n} ${n === 1 ? 'session' : 'sessions'}` : ''}
                  </span>
                </span>
                <ChevronRight size={13} className="flex-none text-fg3" />
              </button>
            );
          })}
        </div>
      ))}
      {!list.length && (
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
