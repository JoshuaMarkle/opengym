import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Alert, Sheet, SheetOption, useToast } from '../../components/overlays';
import { BackButton, BarButton, Button, cx, EmptyState, Screen, StatRow, Tag, TopBar } from '../../components/ui';
import { exerciseOrMissing, useData } from '../../data/DataProvider';
import { workoutTotals } from '../../data/history';
import { routineFromWorkout } from '../../data/routines';
import { deleteWorkout } from '../../data/workouts';
import { useStartWorkout } from '../../hooks/StartWorkout';
import { fmtDay, fmtDuration, fmtTime, fmtTimeRange } from '../../lib/dates';
import { sessionMetric } from '../../lib/oneRm';
import { recordSetIds } from '../../lib/records';
import { formatSet, setLabels, TYPE_TAG } from '../../lib/sets';
import { supersetBlocks, supersetTags } from '../../lib/supersets';
import { formatNumber, toDisplay } from '../../lib/units';
import { CardioMiniTable } from '../workout/CardioTable';
import { TagPill } from '../workout/WorkoutScreen';
import { effortIn1rm, effortText } from '../../lib/effort';

/** 6.6: every set, drops included. Repeat, Edit, Delete. */
export function WorkoutDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { history, exerciseMap, settings } = useData();
  const start = useStartWorkout();
  const toast = useToast();
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const units = settings.units;
  const hw = history.byId.get(id);

  const records = useMemo(() => {
    const flagged = new Set<string>();
    if (!hw) return flagged;
    for (const e of hw.exercises) {
      const ex = exerciseOrMissing(exerciseMap, e.we.exerciseId);
      for (const sid of recordSetIds(history.sessionsByExercise.get(ex.id) ?? [], ex.type, settings.oneRmFormula, effortIn1rm(settings))) flagged.add(sid);
    }
    return flagged;
  }, [hw, history, exerciseMap, settings]);

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/history'));

  if (!hw)
    return (
      <Screen header={<TopBar left={<BackButton iconSize={14} label="History" onClick={() => navigate('/history')} />} />}>
        <EmptyState icon="?" title="Workout not found" className="pt-20">
          It may have been deleted.
        </EmptyState>
      </Screen>
    );

  const w = hw.workout;
  const recordCount = hw.exercises.reduce((n, e) => n + e.sets.filter((s) => records.has(s.id)).length, 0);
  const totals = workoutTotals(hw, (eid) => exerciseMap.get(eid)?.type);
  const items = hw.exercises.map((e) => ({ key: e.we.id, supersetGroup: e.we.supersetGroup, e }));
  const tags = supersetTags(items);

  return (
    <Screen
      header={
        <TopBar
          border={false}
          // 6.6: center History and Edit with the chevron, with a wider back-label gap.
          left={<BackButton iconSize={14} label="History" onClick={back} className="gap-3 leading-none" />}
          right={<BarButton className="leading-none" onClick={() => navigate(`/history/${id}/edit`)}>Edit</BarButton>}
        />
      }
      footer={
        <div className="grid flex-none grid-cols-[1fr_50px] gap-2 border-t border-line px-4 pt-2.5 pb-[max(12px,env(safe-area-inset-bottom))]">
          <Button size="md" onClick={() => start.repeat(w.id, w.name)}>
            Repeat this workout
          </Button>
          <Button size="md" kind="secondary" aria-label="More" onClick={() => setMenu(true)} className="tracking-[1px]">
            •••
          </Button>
        </div>
      }
    >
      <h1 className="mt-1 text-[30px] leading-tight font-bold tracking-[-0.02em]">{w.name}</h1>
      <p className="mt-1 text-[13px] text-fg2">
        {fmtDay(w.startedAt)} · {w.endedAt ? fmtTimeRange(w.startedAt, w.endedAt) : fmtTime(w.startedAt)}
      </p>
      <StatRow
        className="mt-3"
        items={[
          { label: 'Time', value: w.endedAt ? fmtDuration(w.endedAt - w.startedAt) : '—' },
          ...(totals.liftCount || !totals.cardioCount ? [{ label: 'Sets', value: totals.liftSets }] : []),
          ...(totals.cardioCount
            ? [{ label: 'Cardio', value: `${Math.round(totals.cardioSec / 60)} min` }]
            : [{ label: 'Records', value: <span className={recordCount ? 'text-tip' : ''}>{recordCount}</span> }]),
        ]}
      />

      {supersetBlocks(items).map((b) => {
        const section = ({ e }: (typeof items)[number]) => {
        const ex = exerciseOrMissing(exerciseMap, e.we.exerciseId);
        const tag = tags.get(e.we.id);
        if (ex.type === 'cardio')
          return (
            <section key={e.we.id} className="mt-4">
              <button type="button" onClick={() => navigate(`/exercises/${ex.id}`)} className="mb-1 flex w-full items-baseline justify-between gap-3 text-left">
                <b className="min-w-0 truncate text-[16px] font-semibold">{ex.name}</b>
                <span className="flex-none text-[12.5px] text-fg2">cardio</span>
              </button>
              <CardioMiniTable exercise={ex} sets={e.sets} units={units} />
            </section>
          );
        const labels = setLabels(e.sets);
        const metric = ex.type === 'weight' ? sessionMetric(e.sets, ex.type, settings.oneRmFormula, effortIn1rm(settings)) : null;
        return (
          <section key={e.we.id} className="mt-4">
            <button type="button" onClick={() => navigate(`/exercises/${ex.id}`)} className="mb-1 flex w-full items-baseline justify-between gap-3 text-left">
              <b className="flex min-w-0 items-center gap-2 truncate text-[16px] font-semibold">
                <TagPill tag={tag} on />
                <span className="truncate">{ex.name}</span>
                {TYPE_TAG[ex.type] && <Tag>{TYPE_TAG[ex.type]}</Tag>}
              </b>
              {metric && <span className="flex-none text-[12.5px] text-fg2">est. 1RM {formatNumber(Math.round(toDisplay(metric.value, units)), 0)}</span>}
            </button>
            {e.sets.map((s) => {
              const l = labels.get(s.id);
              return (
                <div key={s.id} className={cx('grid h-7 grid-cols-[28px_1fr_auto] items-center text-[14.5px]', s.kind === 'drop' && 'ml-1 border-l-2 border-warn pl-2.5')}>
                  <span className={cx('text-[13px] font-bold', s.kind === 'drop' ? 'text-warn' : 'text-fg2')}>{l}</span>
                  <span>
                    {formatSet(s, ex.type, units)}
                    {settings.effort !== 'off' && s.kind === 'working' && s.rpe != null && <span className="text-fg2"> {effortText(s.rpe, settings.effort)}</span>}
                  </span>
                  {records.has(s.id) ? <span className="rounded-[5px] bg-[color-mix(in_srgb,var(--og-tip)_16%,var(--og-bg))] px-1.5 py-[1px] text-[11px] font-bold text-tip">record</span> : <span />}
                </div>
              );
            })}
          </section>
        );
        };
        if (!b.letter) return section(b.items[0]);
        return (
          <div key={`ss-${b.items[0].key}`} className="mt-4 border-l-2 border-accent pl-3">
            <div className="text-[11px] font-bold tracking-[0.07em] text-accent uppercase">Superset {b.letter}</div>
            <div className="-mt-2">{b.items.map(section)}</div>
          </div>
        );
      })}
      {!hw.exercises.length && <p className="py-10 text-center text-[14px] text-fg2">No sets in this workout.</p>}

      <Sheet open={menu} onClose={() => setMenu(false)} title={w.name}>
        <SheetOption
          onClick={async () => {
            setMenu(false);
            const rid = await routineFromWorkout(w.id);
            toast({ message: `Saved as a routine`, actionLabel: 'Open', onAction: () => navigate(`/routine/${rid}`) });
          }}
          detail="same exercises and sets"
        >
          Save as routine
        </SheetOption>
        <SheetOption
          onClick={() => {
            setMenu(false);
            navigate(`/history/${id}/edit`);
          }}
        >
          Edit workout
        </SheetOption>
        <SheetOption
          tone="danger"
          onClick={() => {
            setMenu(false);
            setConfirm(true);
          }}
        >
          Delete workout
        </SheetOption>
      </Sheet>
      <Alert
        open={confirm}
        title={`Delete ${w.name}?`}
        message={`${fmtDay(w.startedAt)} · ${hw.setCount} sets. Records and charts will update. This can't be undone.`}
        onClose={() => setConfirm(false)}
        actions={[
          {
            label: 'Delete workout',
            kind: 'danger',
            onClick: async () => {
              setConfirm(false);
              await deleteWorkout(w.id);
              navigate('/history', { replace: true });
            },
          },
          { label: 'Cancel', onClick: () => setConfirm(false) },
        ]}
      />
    </Screen>
  );
}
