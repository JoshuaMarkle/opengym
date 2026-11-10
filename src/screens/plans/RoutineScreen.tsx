import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router';
import { Sheet, SheetOption } from '../../components/overlays';
import { ChevronRight, MoreGlyph } from '../../components/icons';
import { BackButton, BarButton, Button, Dash, DetailTitle, DropBadge, EmptyState, PlanTable, Screen, Tag, TopBar } from '../../components/ui';
import { exerciseOrMissing, useData } from '../../data/DataProvider';
import type { HistoryIndex } from '../../data/history';
import { lastSession } from '../../data/history';
import { loadRoutineDraft } from '../../data/routines';
import { usePlans } from '../../data/usePlans';
import { useStartWorkout } from '../../hooks/StartWorkout';
import { cardioSummary } from '../../lib/cardio';
import { fmtDay, fmtMonthDay } from '../../lib/dates';
import { prefillFromRoutine } from '../../lib/prefill';
import { matchPrevious } from '../../lib/previous';
import { formatRepRange, formatSet, formatSetWeight, hasWeightColumn, setLabels, TYPE_TAG, weightColumnLabel } from '../../lib/sets';
import { supersetBlocks, supersetTags } from '../../lib/supersets';
import { unitColumn } from '../../lib/units';
import { TagPill } from '../workout/WorkoutScreen';
import { useEffect, useRef, useState } from 'react';
import { useRoutineActions } from './RoutineActions';

/**
 * "~55 min": the routine's own average if it has history, else ~3 min a set.
 * Sets inside a superset share the rest, so they count ~2 min.
 */
export function estimateMinutes(history: HistoryIndex, routineId: string | undefined, sets: number, supersetSets = 0): number {
  const past = routineId ? history.workouts.filter((w) => w.workout.routineId === routineId && w.workout.endedAt).slice(0, 5) : [];
  if (past.length) {
    const avg = past.reduce((n, w) => n + (w.workout.endedAt! - w.workout.startedAt), 0) / past.length / 60_000;
    return Math.max(5, Math.round(avg / 5) * 5);
  }
  return Math.max(5, Math.round((sets * 3 - supersetSets) / 5) * 5);
}

/** 2.11: every set with last time (Previous) and what it will start at. Start pinned at the bottom. */
export function RoutineScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { history, exerciseMap, settings } = useData();
  const plans = usePlans();
  const start = useStartWorkout();
  const actions = useRoutineActions(plans);
  const [menu, setMenu] = useState(false);
  const draft = useLiveQuery(() => loadRoutineDraft(id), [id]);
  const routine = plans?.routines.find((r) => r.id === id);
  const units = settings.units;

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/plans'));

  // Deleted from the ••• menu: go back to Plans.
  const seen = useRef(false);
  if (routine) seen.current = true;
  useEffect(() => {
    if (plans && !routine && seen.current) navigate('/plans', { replace: true });
  }, [plans, routine, navigate]);

  if (draft === undefined || !plans) return null;
  if (!draft || !routine)
    return (
      <Screen header={<TopBar left={<BackButton label="Routines" onClick={() => navigate('/plans')} />} />}>
        <EmptyState icon="?" title="Routine not found" className="pt-20">
          It may have been deleted. Its workouts are still in History.
        </EmptyState>
      </Screen>
    );

  const folder = plans.folders.find((f) => f.id === routine.folderId);
  const sets = draft.exercises.reduce((n, e) => n + e.sets.length, 0);
  const working = draft.exercises.reduce((n, e) => n + e.sets.filter((s) => s.kind === 'working').length, 0);
  const last = history.lastDoneByRoutine.get(routine.id);
  const blocks = supersetBlocks(draft.exercises);
  const tags = supersetTags(draft.exercises);
  const supersets = blocks.filter((b) => b.letter).length;
  const supersetSets = draft.exercises.filter((e) => tags.has(e.key)).reduce((n, e) => n + e.sets.length, 0);
  const meta = [
    folder?.name ?? 'No folder',
    `${draft.exercises.length} ${draft.exercises.length === 1 ? 'exercise' : 'exercises'}${supersets ? ` (${supersets} ${supersets === 1 ? 'superset' : 'supersets'})` : ''}`,
    `${working} sets`,
    `~${estimateMinutes(history, routine.id, sets, supersetSets)} min`,
    last ? `last done ${fmtDay(last)}` : 'never done',
  ].join(' · ');

  return (
    <Screen
      header={
        <TopBar
          border={false}
          left={<BackButton label="Routines" onClick={back} />}
          right={<BarButton onClick={() => navigate(`/routine/${id}/edit`)}>Edit</BarButton>}
        />
      }
      footer={
        <div className="grid flex-none grid-cols-[1fr_50px] gap-2 border-t border-line px-4 pt-2.5 pb-[max(12px,env(safe-area-inset-bottom))]">
          <Button onClick={() => start.startRoutine(routine.id, routine.name)} disabled={!draft.exercises.length}>
            Start workout
          </Button>
          {/* 2.11: match the History detail footer (6.6). */}
          <Button kind="secondary" aria-label="More" onClick={() => setMenu(true)}>
            <MoreGlyph size={16} />
          </Button>
        </div>
      }
    >
      <DetailTitle title={routine.name} meta={meta} />
      {routine.notes && <p className="mt-3 rounded-md bg-surface px-3 py-2.5 text-callout leading-normal whitespace-pre-wrap text-fg/85">{routine.notes}</p>}

      {!draft.exercises.length && (
        <EmptyState icon="+" title="No exercises yet" className="pt-12">
          Tap Edit to add some.
        </EmptyState>
      )}

      {blocks.map((block, bi) => {
        const section = (e: (typeof draft.exercises)[number]) => {
        const ex = exerciseOrMissing(exerciseMap, e.exerciseId);
        const tag = tags.get(e.key);
        if (ex.type === 'cardio') {
          const lastC = lastSession(history, ex.id);
          const line = lastC ? cardioSummary(lastC.sets, ex, units) : '';
          return (
            <section key={e.key} className="border-b border-line py-3 last:border-b-0">
              <button type="button" onClick={() => navigate(`/exercises/${ex.id}`)} className="flex w-full items-baseline justify-between gap-3 text-left">
                <b className="min-w-0 truncate text-input font-semibold">
                  <span className="mr-2 text-fg2">{bi + 1}</span>
                  {ex.name}
                </b>
                <span className="flex-none text-footnote text-fg2">{e.sets.length > 1 ? `${e.sets.length} segments` : 'cardio'}</span>
              </button>
              <p className="mt-1 text-footnote text-fg2">{line ? `Last: ${line} · ${fmtMonthDay(lastC!.date)}` : 'First time. Numbers fill in from here on.'}</p>
            </section>
          );
        }
        const prevSets = lastSession(history, ex.id)?.sets;
        const rsets = e.sets.map((s, j) => ({ id: s.key, order: j, kind: s.kind, weight: s.weight, repsMin: s.repsMin, repsMax: s.repsMax }));
        const start = prefillFromRoutine(rsets, prevSets);
        const asLogged = start.map((s, j) => ({ ...s, id: rsets[j].id, order: j, kind: s.kind }));
        const labels = setLabels(asLogged);
        const prev = matchPrevious(asLogged, prevSets);
        const warm = e.sets.filter((s) => s.kind === 'warmup').length;
        const work = e.sets.length - warm;
        const showPrev = !!prevSets?.length;
        const showW = hasWeightColumn(ex.type);
        return (
          <section key={e.key} className="border-b border-line py-3 last:border-b-0">
            <button type="button" onClick={() => navigate(`/exercises/${ex.id}`)} className="flex w-full items-baseline justify-between gap-3 text-left">
              <b className="min-w-0 truncate text-input font-semibold">
                {tag ? (
                  <span className="mr-2 inline-flex align-[2px]">
                    <TagPill tag={tag} on />
                  </span>
                ) : (
                  <span className="mr-2 text-fg2">{bi + 1}</span>
                )}
                {ex.name}
                {TYPE_TAG[ex.type] && <Tag>{TYPE_TAG[ex.type]}</Tag>}
              </b>
              <span className="flex-none text-footnote text-fg2">
                {tag && !warm && e.sets[0] && (e.sets[0].repsMin || e.sets[0].repsMax) ? `${work} × ${formatRepRange(e.sets[0].repsMin, e.sets[0].repsMax)}` : warm ? `W + ${work} sets` : `${work} ${work === 1 ? 'set' : 'sets'}`}
              </span>
            </button>
            {e.sets.length > 0 && (
              <PlanTable
                showPrev={showPrev}
                weightLabel={showW ? weightColumnLabel(ex.type, unitColumn(units)) : undefined}
                rows={asLogged.map((s) => {
                  const p = prev.get(s.id);
                  return {
                    id: s.id,
                    label: labels.get(s.id),
                    prev: (
                      <>
                        {p?.prev ? formatSet(p.prev, ex.type, units) : '—'}
                        {p?.prevHadDrop && <DropBadge small />}
                      </>
                    ),
                    weight: s.weight === undefined && ex.type === 'weight' ? <Dash /> : formatSetWeight(s.weight, ex.type, units),
                    reps: formatRepRange(s.repsMin, s.repsMax) || <Dash />,
                  };
                })}
              />
            )}
          </section>
        );
        };
        if (!block.letter) return section(block.items[0]);
        const rounds = Math.max(...block.items.map((x) => x.sets.filter((s) => s.kind === 'working').length));
        return (
          <div key={`ss-${block.items[0].key}`} className="mt-3 border-b border-line border-l-2 border-l-accent pb-1 pl-3 last:border-b-0">
            <div className="pt-1 text-caps text-accent">
              Superset {block.letter} · {rounds} {rounds === 1 ? 'round' : 'rounds'}
            </div>
            {block.items.map(section)}
          </div>
        );
      })}

      <Sheet open={menu} onClose={() => setMenu(false)} title={routine.name}>
        <SheetOption onClick={() => {
          setMenu(false);
          navigate(`/routine/${id}/edit`);
        }}>
          Edit routine
        </SheetOption>
        <SheetOption
          onClick={() => {
            setMenu(false);
            void actions.duplicate(routine).then((nid) => nid && navigate(`/routine/${nid}`, { replace: true }));
          }}
        >
          Duplicate
        </SheetOption>
        <SheetOption
          onClick={() => {
            setMenu(false);
            actions.move(routine);
          }}
          detail={
            <span className="inline-flex items-center gap-1">
              {folder?.name ?? 'No folder'}
              <ChevronRight size={10} />
            </span>
          }
        >
          Move to folder…
        </SheetOption>
        <SheetOption
          tone="danger"
          onClick={() => {
            setMenu(false);
            actions.remove(routine);
          }}
        >
          Delete routine
        </SheetOption>
      </Sheet>
      {actions.element}
    </Screen>
  );
}
