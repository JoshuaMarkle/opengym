import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { BarButton, cx, Screen, StatRow, TopBar } from '../../components/ui';
import { exerciseOrMissing, useData } from '../../data/DataProvider';
import { db } from '../../db/db';
import { cardioSessions, workoutTotals, type HistoryIndex } from '../../data/history';
import { cardioSummary, cardioTotals, longDistance, longDistanceWord } from '../../lib/cardio';
import { fmtDay, fmtDuration, startOfWeek } from '../../lib/dates';
import { formatNumber } from '../../lib/units';
import { recordSetIds } from '../../lib/records';
import { compareBest, type Comparison } from '../../lib/summary';
import { useGiveUp } from '../../hooks/useGiveUp';
import { effortIn1rm } from '../../lib/effort';

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
    const cardio: { key: string; name: string; text: string }[] = [];
    let records = 0;
    for (const e of hw.exercises) {
      const ex = exerciseOrMissing(exerciseMap, e.we.exerciseId);
      // Cardio shows what you did, not a faster / slower verdict (5.3).
      if (ex.type === 'cardio') {
        cardio.push({ key: e.we.id, name: ex.name, text: cardioSummary(e.sets, ex, units) });
        continue;
      }
      const fromRoutine = sameRoutine?.exercises.filter((x) => x.we.exerciseId === ex.id).flatMap((x) => x.sets);
      const fallback = older.find((x) => x.exercises.some((y) => y.we.exerciseId === ex.id));
      const prevSets = fromRoutine?.length ? fromRoutine : fallback?.exercises.filter((y) => y.we.exerciseId === ex.id).flatMap((y) => y.sets);
      const cmp = compareBest(e.sets, prevSets, ex.type, units, settings.oneRmFormula);
      if (cmp && !rows.some((r) => r.key === ex.id)) rows.push({ key: ex.id, name: ex.name, cmp });
      const sessions = history.sessionsByExercise.get(ex.id) ?? [];
      const flagged = recordSetIds(sessions, ex.type, settings.oneRmFormula, effortIn1rm(settings));
      records += e.sets.filter((s) => flagged.has(s.id)).length;
    }
    const totals = workoutTotals(hw, (eid) => exerciseMap.get(eid)?.type);
    // Running total for the week this workout falls in.
    const weekFrom = startOfWeek(hw.workout.startedAt, settings.weekStart);
    const week = cardioSessions(history, (eid) => exerciseMap.get(eid)?.type === 'cardio').filter((c) => c.date >= weekFrom && c.date < weekFrom + 7 * 86_400_000);
    const weekT = cardioTotals(week.flatMap((c) => c.sets));
    return { hw, sameRoutine, rows, records, cardio, totals, weekT };
  }, [history, id, exerciseMap, units, settings]);

  // Just finished: the history index may not have caught up with the save yet. With
  // a lot of history that can take a while, so only give up once the workout itself is gone.
  const saved = useLiveQuery(() => db.workouts.get(id).then((w) => w?.status === 'done'), [id]);
  const gaveUp = useGiveUp(!data && saved === false);
  if (!data) return gaveUp ? <Navigate to="/" replace /> : null;
  const { hw, sameRoutine, rows, records, cardio, totals, weekT } = data;
  const w = hw.workout;
  const compared = rows.filter((r) => r.cmp.direction !== 'new');
  const up = rows.filter((r) => r.cmp.direction === 'up').length;

  let headline: string;
  if (!compared.length) headline = rows.length ? 'First one logged' : cardio.length ? 'Cardio logged' : 'Workout saved';
  else if (up === 0) headline = compared.every((r) => r.cmp.direction === 'same') ? 'Matched last time' : 'Workout saved';
  else headline = up === compared.length ? `Stronger on all ${up}` : `Stronger on ${up} of ${compared.length}`;

  const sub = sameRoutine
    ? `${w.name} vs your last ${sameRoutine.workout.name} (${fmtDay(sameRoutine.workout.startedAt)})`
    : compared.length
      ? 'Each exercise vs the last time you did it'
      : rows.length
        ? 'Next time you do these, you’ll see how you compare.'
        : cardio.length
          ? `${w.name} · ${fmtDay(w.startedAt)}`
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

      {cardio.length > 0 && (
        <>
          <div className="mt-5 text-[11px] font-bold tracking-[0.07em] text-fg2 uppercase">Cardio</div>
          {cardio.map((c) => (
            <div key={c.key} className="flex min-h-[48px] items-center justify-between gap-3 border-b border-line">
              <b className="min-w-0 truncate text-[15px] font-semibold">{c.name}</b>
              <span className="flex-none text-[14px] text-fg2">{c.text || '—'}</span>
            </div>
          ))}
          <div className="flex min-h-[44px] items-center justify-between gap-3 text-[14px]">
            <span className="text-fg2">Cardio this week</span>
            <b className="font-semibold">
              {Math.round(weekT.durationSec / 60)} min
              {weekT.distance ? ` · ${formatNumber(longDistance(weekT.distance, units), 1)} ${longDistanceWord(units)}` : ''}
            </b>
          </div>
        </>
      )}

      <StatRow
        className="mt-4"
        items={[
          { label: 'Time', value: w.endedAt ? fmtDuration(w.endedAt - w.startedAt) : '—' },
          ...(totals.liftCount || !totals.cardioCount ? [{ label: 'Sets', value: totals.liftSets }] : []),
          ...(!totals.liftCount && totals.cardioMeters ? [{ label: longDistanceWord(units) === 'mi' ? 'Miles' : 'Km', value: formatNumber(longDistance(totals.cardioMeters, units), 1) }] : []),
          ...(totals.cardioCount ? [{ label: 'Cardio', value: `${Math.round(totals.cardioSec / 60)} min` }] : []),
          // Three across fits a phone: with cardio, its minutes take the Records slot (5.3).
          ...(!totals.cardioCount ? [{ label: 'Records', value: <span className={records ? 'text-tip' : ''}>{records}</span> }] : []),
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
