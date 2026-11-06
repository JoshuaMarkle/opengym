import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Button, cx, EmptyState, LabelAction, LargeHeader, PlayButton, Screen, SectionLabel } from '../../components/ui';
import { useActiveWorkout, useData, type ActiveWorkoutData } from '../../data/DataProvider';
import { usePlans } from '../../data/usePlans';
import { useStartWorkout } from '../../hooks/StartWorkout';
import { useNow } from '../../hooks/useNow';
import { addDays, dayKey, fmtClock, fmtHomeDate, fmtRelativeDay, startOfDay, startOfWeek, weekdayLetter } from '../../lib/dates';
import { pickNextUp } from '../../lib/nextUp';
import { setLabels } from '../../lib/sets';

/** 3.1 / 3.2 / 1.4: this week, the running workout, and the active folder one tap from starting. */
export function Home() {
  const navigate = useNavigate();
  const { history, settings, exerciseMap } = useData();
  const active = useActiveWorkout();
  const plans = usePlans();
  const start = useStartWorkout();
  const now = useNow(60_000);

  const folder = plans?.activeFolder;
  const folderRoutines = plans ? (folder ? (plans.byFolder.get(folder.id) ?? []) : (plans.byFolder.get('') ?? [])) : [];
  const runningId = active?.workout.routineId;
  // Rotation order: done longest ago first (never done counts as oldest), ties by folder order. NEXT leads.
  const shown = folderRoutines
    .filter((r) => r.id !== runningId)
    .map((r) => ({ r, t: history.lastDoneByRoutine.get(r.id) ?? -Infinity }))
    .sort((a, b) => a.t - b.t || a.r.order - b.r.order)
    .map((x) => x.r);
  const nextId = pickNextUp(shown, history.lastDoneByRoutine);
  const hasRoutines = !!plans && plans.routines.length > 0;

  const trained = useMemo(() => new Set(history.workouts.map((w) => dayKey(w.workout.startedAt))), [history]);

  return (
    <Screen header={<LargeHeader eyebrow={fmtHomeDate(now)} title="Home" />}>
      {active && <LiveBlock data={active} />}

      <WeekStrip now={now} weekStart={settings.weekStart} trained={trained} live={!!active} onOpen={() => navigate('/history')} />

      {!plans ? null : !hasRoutines ? (
        <div className="pt-12">
          <EmptyState icon="+" title="No routines yet">
            Build a routine once, then start it in one tap every time.
          </EmptyState>
          <div className="mx-auto mt-6 flex max-w-[300px] flex-col gap-2">
            <Button onClick={() => navigate('/routine/new')}>Create a routine</Button>
            <Button kind="secondary" onClick={start.startBlank}>
              Start a blank workout
            </Button>
          </div>
        </div>
      ) : (
        <>
          <SectionLabel action={<LabelAction onClick={() => navigate('/plans')}>Plans ›</LabelAction>}>{folder?.name ?? 'Routines'}</SectionLabel>
          {shown.map((r) => {
            const last = history.lastDoneByRoutine.get(r.id);
            const isNext = r.id === nextId;
            const names = (plans.exercisesByRoutine.get(r.id) ?? []).map((id) => exerciseMap.get(id)?.name).filter(Boolean);
            return (
              <div key={r.id} className="flex min-h-[58px] items-center gap-3 border-b border-line">
                <button type="button" onClick={() => navigate(`/routine/${r.id}`)} className="min-w-0 flex-1 py-2 text-left active:opacity-70">
                  <b className="flex items-center text-[16px] font-semibold">
                    <span className="truncate">{r.name}</span>
                    {isNext && <span className="ml-2 flex-none rounded-[4px] bg-accent px-[5px] py-[1px] text-[10px] font-bold text-white">NEXT</span>}
                  </b>
                  <span className="block truncate text-[13px] text-fg2">
                    {last ? `Last done ${fmtRelativeDay(last, now)}` : names.length ? `Never done · ${names.length} exercises` : 'Never done'}
                  </span>
                </button>
                <PlayButton primary={isNext} label={`Start ${r.name}`} onClick={() => start.startRoutine(r.id, r.name)} />
              </div>
            );
          })}
          {!shown.length && folderRoutines.length > 0 && <p className="border-b border-line py-3 text-[13px] text-fg2">Every routine in this folder is running.</p>}
          {!folderRoutines.length && (
            <button type="button" onClick={() => navigate('/plans')} className="block w-full border-b border-line py-3 text-left text-[13px] text-fg2">
              {folder ? `${folder.name} is empty. Add routines in Plans.` : 'No active folder. Pick one in Plans.'}
            </button>
          )}
          <button type="button" onClick={start.startBlank} className="flex h-[54px] w-full items-center text-[16px] font-semibold text-accent active:opacity-70">
            + Blank workout
          </button>
        </>
      )}
    </Screen>
  );
}

function WeekStrip({ now, weekStart, trained, live, onOpen }: { now: number; weekStart: 0 | 1; trained: Set<string>; live: boolean; onOpen: () => void }) {
  const first = startOfWeek(now, weekStart);
  const today = startOfDay(now);
  const days = Array.from({ length: 7 }, (_, i) => addDays(first, i));
  return (
    <button type="button" onClick={onOpen} aria-label="This week. Open History" className="mt-3 grid w-full grid-cols-7 gap-1 text-center">
      {days.map((d) => {
        const date = new Date(d);
        const isToday = d === today;
        const done = trained.has(dayKey(d));
        const future = d > today;
        return (
          <span key={d}>
            <small className={cx('block text-[11px] font-bold', isToday ? 'text-fg' : 'text-fg2')}>{weekdayLetter(date.getDay())}</small>
            <i
              className={cx(
                'mx-auto mt-1.5 flex h-[34px] w-[34px] items-center justify-center rounded-full text-[13.5px] font-bold not-italic',
                done ? 'bg-accent text-white' : future ? 'text-fg3' : 'bg-surface text-fg2',
                isToday && !done && 'bg-transparent text-fg',
                isToday && (live ? 'shadow-[inset_0_0_0_2px_var(--og-tip)]' : done ? 'shadow-[0_0_0_2px_var(--og-bg),0_0_0_4px_#2e8bff]' : 'shadow-[inset_0_0_0_2px_var(--og-fg)]'),
              )}
            >
              {date.getDate()}
            </i>
          </span>
        );
      })}
    </button>
  );
}

/** 3.2: the running workout leads Home. */
function LiveBlock({ data }: { data: ActiveWorkoutData }) {
  const navigate = useNavigate();
  const now = useNow(1000);
  const { workout, exercises } = data;
  const cur = exercises.find((e) => e.we.id === workout.currentExerciseId) ?? exercises[0];
  let where = 'No exercises yet';
  if (cur) {
    const next = cur.sets.find((s) => !s.completed);
    const working = cur.sets.filter((s) => s.kind === 'working');
    if (!next) where = `${cur.exercise.name} · done`;
    else if (next.kind === 'working') where = `${cur.exercise.name} · set ${setLabels(cur.sets).get(next.id)} of ${working.length}`;
    else where = `${cur.exercise.name} · ${next.kind === 'warmup' ? 'warm-up' : 'drop set'}`;
  }
  const [name, rest] = where.split(' · ');
  return (
    <div className="mt-2 border-y border-line pt-2.5 pb-3">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.07em] text-tip">
          <i className="anim-pulse h-[7px] w-[7px] rounded-full bg-tip" />
          IN PROGRESS
        </span>
        <span className="text-[14px] font-bold tabular-nums">{fmtClock(now - workout.startedAt)}</span>
      </div>
      <b className="mt-0.5 block truncate text-[22px] font-bold">{workout.name}</b>
      <div className="mt-0.5 truncate text-[14px] text-fg/80">
        {cur ? 'On: ' : ''}
        {name}
        {rest && <span className="text-fg2"> · {rest}</span>}
      </div>
      {exercises.length > 0 && (
        <div className="mt-2.5 flex gap-1" aria-hidden>
          {exercises.map((e) => {
            const done = e.sets.length > 0 && e.sets.every((s) => s.completed);
            return <i key={e.we.id} className={cx('h-[5px] flex-1 rounded-full', done ? 'bg-accent' : e.we.id === cur?.we.id ? 'bg-fg' : 'bg-surface-2')} />;
          })}
        </div>
      )}
      <Button size="md" className="mt-3" onClick={() => navigate('/workout')}>
        Resume
      </Button>
    </div>
  );
}
