import { useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { BarButton, cx, Screen, StatRow, TopBar } from '../../components/ui';
import { exerciseOrMissing, useData } from '../../data/DataProvider';
import type { HistoryIndex } from '../../data/history';
import { fmtDay, fmtDuration } from '../../lib/dates';
import { recordSetIds } from '../../lib/records';
import { compareBest, type Comparison } from '../../lib/summary';
import { useGiveUp } from '../../hooks/useGiveUp';

interface Row {
  key: string;
  name: string;
  cmp: Comparison;
}

/** Which earlier session each exercise is compared with (SPEC §4: the last workout of the same routine). */
function baselineFor(history: HistoryIndex, workoutId: string) {
  const hw = history.byId.get(workoutId);
  if (!hw) return null;
  const w = hw.workout;
  const older = history.workouts.filter((x) => x.workout.startedAt < w.startedAt);
  const sameRoutine = w.routineId ? older.find((x) => x.workout.routineId === w.routineId) : undefined;
  return { hw, sameRoutine, older };
}

/** 5.3: each exercise's best set vs last time. The workout is already saved. */
export function Summary() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { history, exerciseMap, settings } = useData();
  const units = settings.units;

  const data = useMemo(() => {
    const b = baselineFor(history, id);
    if (!b) return null;
    const { hw, sameRoutine, older } = b;
    const rows: Row[] = [];
    let records = 0;
    for (const e of hw.exercises) {
      const ex = exerciseOrMissing(exerciseMap, e.we.exerciseId);
      const fromRoutine = sameRoutine?.exercises.filter((x) => x.we.exerciseId === ex.id).flatMap((x) => x.sets);
      const fallback = older.find((x) => x.exercises.some((y) => y.we.exerciseId === ex.id));
      const prevSets = fromRoutine?.length ? fromRoutine : fallback?.exercises.filter((y) => y.we.exerciseId === ex.id).flatMap((y) => y.sets);
      const cmp = compareBest(e.sets, prevSets, ex.type, units, settings.oneRmFormula);
      if (cmp && !rows.some((r) => r.key === ex.id)) rows.push({ key: ex.id, name: ex.name, cmp });
      const sessions = history.sessionsByExercise.get(ex.id) ?? [];
      const flagged = recordSetIds(sessions, ex.type, settings.oneRmFormula);
      records += e.sets.filter((s) => flagged.has(s.id)).length;
    }
    return { hw, sameRoutine, rows, records };
  }, [history, id, exerciseMap, units, settings.oneRmFormula]);

  // Just finished: the history query may not have caught up with the save yet.
  const gaveUp = useGiveUp(!data);
  if (!data) return gaveUp ? <Navigate to="/" replace /> : null;
  const { hw, sameRoutine, rows, records } = data;
  const w = hw.workout;
  const compared = rows.filter((r) => r.cmp.direction !== 'new');
  const up = rows.filter((r) => r.cmp.direction === 'up').length;

  let headline: string;
  if (!compared.length) headline = rows.length ? 'First one logged' : 'Workout saved';
  else if (up === 0) headline = compared.every((r) => r.cmp.direction === 'same') ? 'Matched last time' : 'Workout saved';
  else headline = up === compared.length ? `Stronger on all ${up}` : `Stronger on ${up} of ${compared.length}`;

  const sub = sameRoutine
    ? `${w.name} vs your last ${sameRoutine.workout.name} (${fmtDay(sameRoutine.workout.startedAt)})`
    : compared.length
      ? 'Each exercise vs the last time you did it'
      : 'Next time you do these, you’ll see how you compare.';

  return (
    <Screen
      header={
        <TopBar
          title="Summary"
          right={
            <BarButton kind="bold" onClick={() => navigate('/', { replace: true })}>
              Done
            </BarButton>
          }
        />
      }
    >
      <div className="anim-pop mt-6 text-center">
        <div className="text-[28px] leading-tight font-bold tracking-[-0.01em]">{headline}</div>
        <div className="mt-1.5 text-[13px] text-fg2">{sub}</div>
      </div>

      <div className="mt-5">
        {rows.map((r) => (
          <div key={r.key} className="grid min-h-[54px] grid-cols-[minmax(0,1fr)_auto_minmax(64px,auto)] items-center gap-2.5 border-b border-line py-1.5">
            <div className="min-w-0">
              <b className="block truncate text-[15px] font-semibold">{r.name}</b>
              <small className="block truncate text-[12.5px] text-fg2">{r.cmp.detail}</small>
            </div>
            <span className={cx('text-[13px]', dirColor(r.cmp.direction))}>{r.cmp.direction === 'up' ? '▲' : r.cmp.direction === 'down' ? '▼' : r.cmp.direction === 'same' ? '=' : ''}</span>
            <span className="text-right">
              <span
                className={cx(
                  'inline-block rounded-[6px] px-2 py-[3px] text-[12px] font-bold whitespace-nowrap',
                  r.cmp.direction === 'up' && 'bg-[color-mix(in_srgb,var(--og-tip)_18%,var(--og-bg))] text-tip',
                  r.cmp.direction === 'down' && 'bg-[color-mix(in_srgb,#ff3b3b_18%,var(--og-bg))] text-danger',
                  r.cmp.direction === 'same' && 'bg-surface-2 text-fg2',
                  r.cmp.direction === 'new' && 'bg-accent-soft text-accent',
                )}
              >
                {r.cmp.label}
              </span>
            </span>
          </div>
        ))}
      </div>

      <StatRow
        className="mt-4"
        items={[
          { label: 'Time', value: w.endedAt ? fmtDuration(w.endedAt - w.startedAt) : '—' },
          { label: 'Sets', value: hw.setCount },
          { label: 'Records', value: <span className={records ? 'text-tip' : ''}>{records}</span> },
        ]}
      />
      <button type="button" onClick={() => navigate(`/history/${w.id}`)} className="mt-4 flex h-11 w-full items-center justify-center text-[15px] font-semibold text-accent">
        View workout
      </button>
    </Screen>
  );
}

function dirColor(d: Comparison['direction']) {
  return d === 'up' ? 'text-tip' : d === 'down' ? 'text-danger' : 'text-fg2';
}
