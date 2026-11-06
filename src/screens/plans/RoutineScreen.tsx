import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router';
import { Sheet, SheetOption } from '../../components/overlays';
import { BackButton, BarButton, Button, cx, DropBadge, EmptyState, Screen, Tag, TopBar } from '../../components/ui';
import { exerciseOrMissing, useData } from '../../data/DataProvider';
import type { HistoryIndex } from '../../data/history';
import { lastSession } from '../../data/history';
import { loadRoutineDraft } from '../../data/routines';
import { usePlans } from '../../data/usePlans';
import { useStartWorkout } from '../../hooks/StartWorkout';
import { fmtDay } from '../../lib/dates';
import { prefillFromRoutine } from '../../lib/prefill';
import { matchPrevious } from '../../lib/previous';
import { formatRepRange, formatSet, formatSetWeight, hasWeightColumn, setLabels, TYPE_TAG, weightColumnLabel } from '../../lib/sets';
import { unitColumn } from '../../lib/units';
import { useEffect, useRef, useState } from 'react';
import { useRoutineActions } from './RoutineActions';

/** "~55 min": the routine's own average if it has history, else ~3 min a set. */
export function estimateMinutes(history: HistoryIndex, routineId: string | undefined, sets: number): number {
  const past = routineId ? history.workouts.filter((w) => w.workout.routineId === routineId && w.workout.endedAt).slice(0, 5) : [];
  if (past.length) {
    const avg = past.reduce((n, w) => n + (w.workout.endedAt! - w.workout.startedAt), 0) / past.length / 60_000;
    return Math.max(5, Math.round(avg / 5) * 5);
  }
  return Math.max(5, Math.round((sets * 3) / 5) * 5);
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
      <Screen header={<TopBar left={<BackButton label="Plans" onClick={() => navigate('/plans')} />} />}>
        <EmptyState icon="?" title="Routine not found" className="pt-20">
          It may have been deleted. Its workouts are still in History.
        </EmptyState>
      </Screen>
    );

  const folder = plans.folders.find((f) => f.id === routine.folderId);
  const sets = draft.exercises.reduce((n, e) => n + e.sets.length, 0);
  const working = draft.exercises.reduce((n, e) => n + e.sets.filter((s) => s.kind === 'working').length, 0);
  const last = history.lastDoneByRoutine.get(routine.id);
  const meta = [
    folder?.name ?? 'No folder',
    `${draft.exercises.length} ${draft.exercises.length === 1 ? 'exercise' : 'exercises'}`,
    `${working} sets`,
    `~${estimateMinutes(history, routine.id, sets)} min`,
    last ? `last done ${fmtDay(last)}` : 'never done',
  ].join(' · ');

  return (
    <Screen
      header={
        <TopBar
          border={false}
          left={<BackButton label="Plans" onClick={back} />}
          right={
            <>
              <BarButton onClick={() => navigate(`/routine/${id}/edit`)}>Edit</BarButton>
              <BarButton aria-label="More" onClick={() => setMenu(true)} className="font-bold tracking-[1px]">
                •••
              </BarButton>
            </>
          }
        />
      }
      footer={
        <div className="flex-none border-t border-line px-4 pt-2.5 pb-[max(12px,env(safe-area-inset-bottom))]">
          <Button onClick={() => start.startRoutine(routine.id, routine.name)} disabled={!draft.exercises.length}>
            Start workout
          </Button>
        </div>
      }
    >
      <h1 className="mt-1 text-[30px] leading-tight font-bold tracking-[-0.02em]">{routine.name}</h1>
      <p className="mt-1 text-[13px] leading-snug text-fg2">{meta}</p>
      {routine.notes && <p className="mt-3 rounded-[10px] bg-surface px-3 py-2.5 text-[14px] leading-normal whitespace-pre-wrap text-fg/85">{routine.notes}</p>}

      {!draft.exercises.length && (
        <EmptyState icon="+" title="No exercises yet" className="pt-12">
          Tap Edit to add some.
        </EmptyState>
      )}

      {draft.exercises.map((e, i) => {
        const ex = exerciseOrMissing(exerciseMap, e.exerciseId);
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
        const cols = cx('grid items-center gap-1.5', showPrev ? (showW ? 'grid-cols-[28px_1fr_1fr_1fr]' : 'grid-cols-[28px_1fr_1fr]') : showW ? 'grid-cols-[28px_1fr_1fr]' : 'grid-cols-[28px_1fr]');
        return (
          <section key={e.key} className="border-b border-line py-3 last:border-b-0">
            <button type="button" onClick={() => navigate(`/exercises/${ex.id}`)} className="flex w-full items-baseline justify-between gap-3 text-left">
              <b className="min-w-0 truncate text-[16px] font-semibold">
                <span className="mr-2 text-fg2">{i + 1}</span>
                {ex.name}
                {TYPE_TAG[ex.type] && <Tag>{TYPE_TAG[ex.type]}</Tag>}
              </b>
              <span className="flex-none text-[13px] text-fg2">{warm ? `W + ${work} sets` : `${work} ${work === 1 ? 'set' : 'sets'}`}</span>
            </button>
            {e.sets.length > 0 && (
              <div className="mt-1.5 text-[14px]">
                <div className={cx(cols, 'h-5 text-center text-[10.5px] font-bold tracking-[0.05em] text-fg2')}>
                  <span>SET</span>
                  {showPrev && <span>PREVIOUS</span>}
                  {showW && <span>{weightColumnLabel(ex.type, unitColumn(units))}</span>}
                  <span>REPS</span>
                </div>
                {asLogged.map((s) => {
                  const p = prev.get(s.id);
                  const label = labels.get(s.id);
                  return (
                    <div key={s.id} className={cx(cols, 'h-[27px] text-center')}>
                      <span className={cx('text-[13px] font-bold', label === 'W' ? 'text-fg2' : 'text-fg2')}>{label}</span>
                      {showPrev && (
                        <span className="flex items-center justify-center gap-1 text-[13px] text-fg2">
                          {p?.prev ? formatSet(p.prev, ex.type, units) : '—'}
                          {p?.prevHadDrop && <DropBadge small />}
                        </span>
                      )}
                      {showW && <span className="font-semibold">{s.weight === undefined && ex.type === 'weight' ? <span className="text-fg3">—</span> : formatSetWeight(s.weight, ex.type, units)}</span>}
                      <span className={cx('font-semibold', !s.repsMin && !s.repsMax && 'text-fg3')}>{formatRepRange(s.repsMin, s.repsMax) || '—'}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      <Sheet open={menu} onClose={() => setMenu(false)} title={routine.name}>
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
          detail={`${folder?.name ?? 'No folder'} ›`}
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
