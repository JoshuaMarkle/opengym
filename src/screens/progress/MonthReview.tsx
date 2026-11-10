// Month in review (proposal B3). Screen 7.14. Computed on the phone: counts, one best
// moment and every lift against the month before. No notifications, nothing shared.

import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ChevronLeft, ChevronRight } from '../../components/icons';
import { BackButton, cx, DetailTitle, EmptyState, Screen, SectionLabel, StatRow, TopBar, TrendText } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { liftSeries, recentLifts, sessionSets } from '../../data/training';
import { addMonths, fmtMonthDay, MONTHS_LONG, startOfMonth } from '../../lib/dates';
import { monthReview, type MonthLiftInput } from '../../lib/training';
import { formatNumber } from '../../lib/units';
import { usePinned } from './Progress';
import { fmtGoal, fmtStrength, strengthNumber } from './TrainingViews';

const monthKey = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const fromKey = (k: string | null) => {
  const m = k && /^(\d{4})-(\d{2})$/.exec(k);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, 1).getTime() : undefined;
};

export function MonthReview() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { history, settings, exerciseMap } = useData();
  const focus = usePinned();
  const units = settings.units;
  const thisMonth = startOfMonth(Date.now());
  // Default: last month during the first week, else this month so far.
  const from = fromKey(params.get('m')) ?? (new Date().getDate() <= 7 ? addMonths(thisMonth, -1) : thisMonth);
  const to = addMonths(from, 1);
  const prevFrom = addMonths(from, -1);
  const first = history.firstDate ? startOfMonth(history.firstDate) : thisMonth;

  const review = useMemo(() => {
    const ids = new Set(focus.map((e) => e.id));
    const lifts = [...focus, ...(settings.trainEverything ? recentLifts(history, exerciseMap, 400, to).filter((e) => !ids.has(e.id)) : [])].filter((e) => e.type !== 'cardio');
    const inputs: MonthLiftInput[] = lifts.map((ex) => {
      const series = new Map(liftSeries(history, ex).map((p) => [p.date, p.value]));
      const sessions = (history.sessionsByExercise.get(ex.id) ?? [])
        .slice()
        .reverse()
        .map((s) => ({ date: s.date, sets: ex.type === 'weight' ? sessionSets(s) : [], strength: series.get(s.date) }))
        .filter((s) => s.strength !== undefined);
      return { exerciseId: ex.id, sessions };
    });
    return monthReview(
      history.workouts.map((w) => w.workout.startedAt),
      inputs,
      prevFrom,
      from,
      to,
    );
  }, [focus, history, exerciseMap, settings.trainEverything, from, to, prevFrom]);

  const go = (ts: number) => setParams({ m: monthKey(ts) }, { replace: true });
  const name = MONTHS_LONG[new Date(from).getMonth()];
  const prevName = MONTHS_LONG[new Date(prevFrom).getMonth()];
  const best = review.best;
  const bestEx = best ? exerciseMap.get(best.exerciseId) : undefined;
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/progress'));

  return (
    <Screen
      header={
        <TopBar
          left={<BackButton label="Progress" onClick={back} />}
          title="Month"
          right={
            <span className="flex">
              <button type="button" aria-label="Previous month" disabled={from <= first} onClick={() => go(addMonths(from, -1))} className="flex h-11 w-10 items-center justify-center text-accent disabled:text-fg3">
                <ChevronLeft size={14} />
              </button>
              <button type="button" aria-label="Next month" disabled={to > Date.now()} onClick={() => go(to)} className="flex h-11 w-10 items-center justify-center text-accent disabled:text-fg3">
                <ChevronRight size={14} />
              </button>
            </span>
          }
        />
      }
    >
      <div className="mt-4 text-caps text-fg2">{new Date(from).getFullYear()}</div>
      <DetailTitle className="mt-0" title={name} meta={from === thisMonth ? 'Your month so far' : 'Your month in lifting'} />

      {review.workouts === 0 ? (
        <EmptyState icon="·" title="No workouts this month" className="pt-12" />
      ) : (
        <>
          <StatRow
            className="mt-4"
            items={[
              { label: 'Workouts', value: review.workouts },
              { label: 'Records', value: review.records },
              { label: 'Lifts up', value: review.liftsCompared ? `${review.liftsUp} of ${review.liftsCompared}` : '—' },
            ]}
          />

          {best && bestEx && (
            <>
              <SectionLabel>Best moment</SectionLabel>
              <p className="border-b border-line pb-3 text-input leading-snug tabular-nums">
                <b>
                  {bestEx.name} {fmtGoal(best, bestEx, units)}
                </b>
                , {fmtMonthDay(best.date)}. <span className="text-fg2">{best.firstTime ? 'First time at that weight for that many reps.' : 'A new best est. 1RM.'}</span>
              </p>
            </>
          )}

          <SectionLabel>vs {prevName}</SectionLabel>
          {review.lifts.map((l) => {
            const ex = exerciseMap.get(l.exerciseId);
            if (!ex) return null;
            const d = l.delta !== undefined ? strengthNumber(l.delta, ex, units) : undefined;
            const r = d !== undefined ? Math.round(d) : undefined;
            return (
              <button
                key={l.exerciseId}
                type="button"
                onClick={() => navigate(`/progress/lift/${ex.id}`)}
                className="flex min-h-15 w-full items-center justify-between gap-3 border-b border-line text-left active:bg-surface/60"
              >
                <span className="min-w-0">
                  <b className="block truncate text-input font-semibold">{ex.name}</b>
                  <span className="text-footnote text-fg2 tabular-nums">
                    {ex.type === 'bodyweight' ? 'best set' : ex.type === 'assisted' ? 'assist' : 'est. 1RM'} {fmtStrength(l.now, ex, units)}
                  </span>
                </span>
                <span className={cx('text-callout font-bold tabular-nums', r === undefined || r === 0 ? 'text-fg2' : r > 0 ? 'text-tip' : 'text-warn')}>
                  {r === undefined ? 'new' : r === 0 ? 'same' : <TrendText dir={r > 0 ? 'up' : 'down'}>{formatNumber(Math.abs(r), 0)}</TrendText>}
                </span>
              </button>
            );
          })}
          <p className="mt-4 text-caption leading-normal text-fg2">Each lift's best session this month against its best in {prevName}. Records = sessions with a new best est. 1RM.</p>
        </>
      )}
    </Screen>
  );
}
