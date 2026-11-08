import { useMemo, useState, type ReactNode } from 'react';
import { LiftChart, type ChartPoint } from '../../components/charts';
import { cx, DropBadge, Segmented, StatRow, Tag } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import type { HistorySession } from '../../data/history';
import { liftPoints, type LiftPoint } from '../../data/lifts';
import { liftTraining } from '../../data/training';
import { MONTH_DAYS } from '../../lib/training';
import type { Exercise, Units } from '../../db/types';
import { availableChartRanges, rangeStart, RANGE_WORDS, type ChartRange } from '../../lib/chart';
import { fmtMonthDay, fmtMonthYear, weekdayShort } from '../../lib/dates';
import { effortIn1rm, effortText, sameWeightEasier } from '../../lib/effort';
import { computeRecords, isRecent } from '../../lib/records';
import { dropChains, formatSet, formatSetWeight } from '../../lib/sets';
import { formatNumber, formatWeight, toDisplay, unitLabel } from '../../lib/units';
import { variationLabels } from '../../lib/variations';
import { CardioMiniTable } from '../workout/CardioTable';

export type LiftMetric = 'e1rm' | 'top';

/** Every exercise in the same variation group (incl. itself), live ones only. */
export function useVariations(exercise: Exercise | undefined): Exercise[] {
  const { exercises } = useData();
  return useMemo(() => {
    if (!exercise) return [];
    if (!exercise.variationGroupId) return [exercise];
    const group = exercises.filter((e) => e.variationGroupId === exercise.variationGroupId);
    return group.some((e) => e.id === exercise.id) ? group : [exercise, ...group];
  }, [exercise, exercises]);
}

export function metricsFor(ex: Exercise): { value: LiftMetric; label: string }[] {
  if (ex.type === 'weight')
    return [
      { value: 'e1rm', label: 'Est. 1RM' },
      { value: 'top', label: 'Top set' },
    ];
  return [{ value: 'top', label: ex.type === 'bodyweight' ? 'Reps' : 'Top set' }];
}

function fmtMetric(v: number, ex: Exercise, units: Units): { big: string; unit: string } {
  if (ex.type === 'bodyweight') return { big: String(Math.round(v)), unit: 'reps' };
  if (ex.type === 'bodyweight_plus') return { big: v > 0 ? `+${formatWeight(v, units)}` : 'BW', unit: v > 0 ? unitLabel(units) : '' };
  if (ex.type === 'assisted') return { big: v < 0 ? `−${formatWeight(-v, units)}` : 'BW', unit: v < 0 ? unitLabel(units) : '' };
  return { big: formatNumber(Math.round(toDisplay(v, units)), 0), unit: unitLabel(units) };
}

export function Change({ value, pct, ex, units, words, className = '' }: { value: number; pct?: number; ex: Exercise; units: Units; words?: string; className?: string }) {
  const eps = ex.type === 'bodyweight' ? 0.5 : 0.25;
  const dir = value > eps ? 'up' : value < -eps ? 'down' : 'flat';
  const amount =
    ex.type === 'bodyweight'
      ? `${Math.abs(Math.round(value))} ${Math.abs(Math.round(value)) === 1 ? 'rep' : 'reps'}`
      : `${formatNumber(Math.abs(toDisplay(value, units)), ex.type === 'weight' ? 0 : 1)} ${unitLabel(units)}`;
  const text = dir === 'flat' ? `= no change` : `${dir === 'up' ? '▲' : '▼'} ${amount}${pct !== undefined && ex.type === 'weight' ? ` (${Math.abs(Math.round(pct))}%)` : ''}`;
  return (
    <span className={cx('text-[14px] font-bold', dir === 'up' ? 'text-tip' : dir === 'down' ? 'text-danger' : 'text-fg2', className)}>
      {text}
      {words ? ` ${words}` : ''}
    </span>
  );
}

// ───────────────────────────── History (4.8)

/** The "·" between sets in a history line, drawn in the gap before a block (see HistoryView). */
const SEP = "before:absolute before:-left-[8px] before:text-fg3 before:content-['·']";

export function HistoryView({ exercise, onOpenWorkout }: { exercise: Exercise; onOpenWorkout?: (id: string) => void }) {
  const { history, settings, exerciseMap } = useData();
  const effortMode = settings.effort;
  const variations = useVariations(exercise);
  const labels = useMemo(() => variationLabels(variations), [variations]);
  const sessions = useMemo(() => {
    const all: HistorySession[] = [];
    for (const v of variations) all.push(...(history.sessionsByExercise.get(v.id) ?? []));
    return all.sort((a, b) => b.date - a.date);
  }, [variations, history]);

  if (!sessions.length) return <p className="py-10 text-center text-[14px] text-fg2">No sessions yet. They'll show up here after you finish a workout with {exercise.name}.</p>;

  let lastMonth = '';
  return (
    <div>
      {sessions.map((s) => {
        const month = fmtMonthYear(s.date);
        const header = month !== lastMonth ? month : null;
        lastMonth = month;
        const ex = exerciseMap.get(s.exerciseId) ?? exercise;
        const chains = dropChains(s.sets);
        const d = new Date(s.date);
        const Body = onOpenWorkout ? 'button' : 'div';
        if (ex.type === 'cardio')
          return (
            <div key={`${s.workoutId}-${s.exerciseId}`}>
              {header && <div className="mt-4 pb-1 text-[11px] font-bold tracking-[0.06em] text-fg2 uppercase">{header}</div>}
              <Body
                {...(onOpenWorkout ? { type: 'button' as const, onClick: () => onOpenWorkout(s.workoutId) } : {})}
                className="grid w-full grid-cols-[42px_1fr] items-start gap-3 border-b border-line py-2.5 text-left"
              >
                <span className="pt-1 text-center leading-[1.1]">
                  <small className="block text-[10.5px] font-bold text-fg2 uppercase">{weekdayShort(d.getDay())}</small>
                  <b className="text-[19px]">{d.getDate()}</b>
                </span>
                <CardioMiniTable exercise={ex} sets={s.sets} units={settings.units} />
              </Body>
            </div>
          );
        return (
          <div key={`${s.workoutId}-${s.exerciseId}`}>
            {header && <div className="mt-4 pb-1 text-[11px] font-bold tracking-[0.06em] text-fg2 uppercase">{header}</div>}
            <Body
              {...(onOpenWorkout ? { type: 'button' as const, onClick: () => onOpenWorkout(s.workoutId) } : {})}
              className="grid w-full grid-cols-[42px_1fr] items-center gap-3 border-b border-line py-2.5 text-left"
            >
              <span className="text-center leading-[1.1]">
                <small className="block text-[10.5px] font-bold text-fg2 uppercase">{weekdayShort(d.getDay())}</small>
                <b className="text-[19px]">{d.getDate()}</b>
              </span>
              {/*
                Each set is one unbreakable block ("185 × 8 @8"). The "·" before a block sits in
                the gap and is clipped when the block starts a line, so no dot is left hanging (A6).
                A set's drops stay in its block, in the order you did them.
              */}
              <span className="flex min-w-0 flex-wrap gap-x-[12px] overflow-hidden text-[14px] leading-[1.6]">
                {chains.length ? (
                  chains.map((c) => (
                    <span key={c.set.id} className={cx('relative whitespace-nowrap', SEP)}>
                      {[c.set, ...c.drops].map((x, j) =>
                        x.kind === 'drop' ? (
                          <span key={x.id} className="text-warn">
                            {j > 0 && ' '}
                            <DropBadge small /> {formatSet(x, ex.type, settings.units)}
                          </span>
                        ) : (
                          <span key={x.id}>
                            {formatSet(x, ex.type, settings.units)}
                            {effortMode !== 'off' && x.kind === 'working' && x.rpe != null && <span className="text-fg2"> {effortText(x.rpe, effortMode)}</span>}
                          </span>
                        ),
                      )}
                    </span>
                  ))
                ) : (
                  <span className="text-fg2">Warm-ups only</span>
                )}
                {s.exerciseId !== exercise.id && <Tag>{(labels.get(s.exerciseId) ?? ex.name).toUpperCase()}</Tag>}
              </span>
            </Body>
          </div>
        );
      })}
    </div>
  );
}

// ───────────────────────────── Charts (4.9, 7.2, 7.3)

export function ChartsView({
  exercise,
  exerciseIds,
  metric,
  onMetric,
  showMetricChips = true,
  showStats = false,
  defaultRange = '6M',
}: {
  exercise: Exercise;
  exerciseIds?: string[];
  metric: LiftMetric;
  onMetric?: (m: LiftMetric) => void;
  showMetricChips?: boolean;
  showStats?: boolean;
  defaultRange?: ChartRange;
}) {
  const { history, settings } = useData();
  const units = settings.units;
  const ids = exerciseIds ?? [exercise.id];
  const points = useMemo(() => liftPoints(history, ids, exercise.type, settings.oneRmFormula, effortIn1rm(settings)), [history, ids.join(','), exercise.type, settings]); // eslint-disable-line react-hooks/exhaustive-deps
  const ranges = availableChartRanges(points[0]?.date);
  const [rangeSel, setRange] = useState<ChartRange>(defaultRange);
  const range = ranges.includes(rangeSel) ? rangeSel : ranges.includes('6M') ? '6M' : ranges[ranges.length - 1];
  const start = rangeStart(range);
  const inRange = points.filter((p) => start === undefined || p.date >= start);
  const before = points.filter((p) => start !== undefined && p.date < start);
  const m = exercise.type === 'weight' ? metric : 'top';

  const valueOf = (p: LiftPoint): number | undefined => {
    if (m === 'e1rm') return p.metric ? p.metric.value : undefined;
    if (!p.top) return undefined;
    return exercise.type === 'bodyweight' ? p.top.reps : (p.top.weight ?? 0);
  };
  const chartPoints: ChartPoint[] = inRange
    .map((p): ChartPoint | null => {
      const v = valueOf(p);
      if (v === undefined) return null;
      const disp = exercise.type === 'bodyweight' ? v : toDisplay(v, units);
      return { date: p.date, value: disp, label: m === 'top' && exercise.type !== 'bodyweight' ? String(p.top?.reps ?? '') : undefined };
    })
    .filter((p): p is ChartPoint => !!p);
  const priorVals = before.map(valueOf).filter((v): v is number => v !== undefined);
  const priorBest = priorVals.length ? Math.max(...priorVals.map((v) => (exercise.type === 'bodyweight' ? v : toDisplay(v, units)))) : undefined;

  const last = inRange[inRange.length - 1];
  const baseline = before.length ? before[before.length - 1] : inRange.length > 1 ? inRange[0] : undefined;

  let hero: ReactNode = null;
  if (!last) {
    hero = <p className="py-6 text-[14px] text-fg2">No sessions in this range.</p>;
  } else if (m === 'e1rm') {
    const cur = last.metric?.value ?? 0;
    const f = fmtMetric(cur, exercise, units);
    const base = baseline?.metric?.value;
    hero = (
      <div className="mt-3">
        <div className="text-[11px] font-bold tracking-[0.05em] text-fg2 uppercase">Estimated 1RM{effortIn1rm(settings) ? ' · effort-adjusted' : ''}</div>
        <div className="text-[34px] leading-[1.1] font-bold tracking-[-0.02em]">
          {f.big}
          <small className="ml-1 text-[16px] font-semibold text-fg2">{f.unit}</small>
        </div>
        {base !== undefined ? <Change value={cur - base} pct={base ? ((cur - base) / base) * 100 : undefined} ex={exercise} units={units} words={RANGE_WORDS[range]} /> : <span className="text-[14px] font-bold text-fg2">First session</span>}
      </div>
    );
  } else {
    const t = last.top!;
    const isBW = exercise.type === 'bodyweight';
    const bt = baseline?.top;
    const cmp = bt ? (isBW ? t.reps - bt.reps : (t.weight ?? 0) - (bt.weight ?? 0) || (t.reps - bt.reps) / 1000) : 0;
    const dir = cmp > 0 ? 'up' : cmp < 0 ? 'down' : 'flat';
    const f = isBW ? { big: String(t.reps), unit: 'reps' } : { big: formatSetWeight(t.weight, exercise.type, units), unit: `${exercise.type === 'weight' || (t.weight ?? 0) !== 0 ? unitLabel(units) + ' ' : ''}× ${t.reps}` };
    hero = (
      <div className="mt-3">
        <div className="text-[11px] font-bold tracking-[0.05em] text-fg2 uppercase">{isBW ? 'Most reps, last session' : 'Heaviest set, last session'}</div>
        <div className="text-[34px] leading-[1.1] font-bold tracking-[-0.02em]">
          {f.big}
          <small className="ml-1 text-[16px] font-semibold text-fg2">{f.unit}</small>
        </div>
        {bt && baseline ? (
          <span className={cx('text-[14px] font-bold', dir === 'up' ? 'text-tip' : dir === 'down' ? 'text-danger' : 'text-fg2')}>
            {dir === 'up' ? '▲' : dir === 'down' ? '▼' : '='} from {formatSet(bt, exercise.type, units)} in {fmtMonthDay(baseline.date)}
          </span>
        ) : (
          <span className="text-[14px] font-bold text-fg2">First session</span>
        )}
      </div>
    );
  }

  const perMonth = useMemo(() => {
    if (!showStats || exercise.type === 'cardio') return '—';
    const fit = liftTraining(history, exercise, settings).fit;
    if (!fit.n) return '—';
    const v = fit.fitRate * (MONTH_DAYS / 7);
    const d = exercise.type === 'bodyweight' ? v : toDisplay(v, units);
    const unit = exercise.type === 'bodyweight' ? '' : ` ${unitLabel(units)}`;
    return `${d >= 0 ? '+' : '−'}${formatNumber(Math.abs(d), Math.abs(d) < 10 ? 1 : 0)}${unit}`;
  }, [showStats, exercise, history, settings, units]);
  const best = points.reduce<LiftPoint | undefined>((a, p) => (p.metric && (!a?.metric || p.metric.value > a.metric.value) ? p : a), undefined);
  const metrics = metricsFor(exercise);
  // A6: the same weight × reps at a lower effort than a few weeks ago.
  const easier = settings.effort !== 'off' && exercise.type === 'weight' && m === 'e1rm' ? sameWeightEasier(points) : null;

  return (
    <div>
      {showMetricChips && metrics.length > 1 && onMetric && (
        <Segmented className="mt-3" options={metrics} value={m} onChange={onMetric} />
      )}
      {hero}
      {easier && settings.effort !== 'off' && (
        <div className="mt-3">
          <div className="text-[11px] font-bold tracking-[0.05em] text-tip uppercase">Same weight, easier</div>
          <p className="mt-0.5 text-[14px] leading-snug">
            {formatSet(easier, exercise.type, units)} went from {effortText(easier.fromRpe, settings.effort)} to {effortText(easier.toRpe, settings.effort)} since {fmtMonthDay(easier.since)}.{' '}
            <span className="text-fg2">Ready for more weight.</span>
          </p>
        </div>
      )}
      {chartPoints.length > 0 && <LiftChart points={chartPoints} from={start ?? points[0]?.date} style={m === 'e1rm' || exercise.type === 'bodyweight' ? 'trend' : 'top'} priorBest={priorBest} />}
      {m === 'top' && exercise.type !== 'bodyweight' && chartPoints.length > 0 && <p className="mt-1 text-[12.5px] text-fg2">Each dot = that day's top set · number = reps</p>}
      {ranges.length > 1 && (
        <Segmented className="mt-3" options={ranges.map((r) => ({ value: r, label: r }))} value={range} onChange={setRange} />
      )}
      {showStats && (
        <StatRow
          className="mt-4"
          items={[
            // B1: the trend's slope as one number, the one most lifters want.
            { label: 'Per month', value: perMonth },
            { label: 'Best set', value: best?.metric ? formatSet({ weight: best.metric.weight, reps: best.metric.reps }, exercise.type, units) : '—' },
            { label: 'Sessions', value: points.length },
          ]}
        />
      )}
    </div>
  );
}

// ───────────────────────────── Records (4.10, 7.4)

export function RecordsView({ exercise, exerciseIds, currentReps }: { exercise: Exercise; exerciseIds?: string[]; currentReps?: number }) {
  const { history, settings } = useData();
  const units = settings.units;
  const ids = exerciseIds ?? [exercise.id];
  const rec = useMemo(() => {
    const sessions = ids.flatMap((id) => history.sessionsByExercise.get(id) ?? []);
    return computeRecords(sessions, exercise.type, settings.oneRmFormula, effortIn1rm(settings));
  }, [history, ids.join(','), exercise.type, settings]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!rec.mostReps) return <p className="py-10 text-center text-[14px] text-fg2">No records yet. Finish a workout with {exercise.name} to set some.</p>;

  const pair = (label: string, big: ReactNode, sub: ReactNode) => (
    <div className="min-w-0 py-2.5 [&+&]:border-l [&+&]:border-line [&+&]:pl-3">
      <small className="block text-[10.5px] font-bold tracking-[0.04em] text-fg2 uppercase">{label}</small>
      <b className="block text-[20px]">{big}</b>
      <span className="block truncate text-[12px] text-fg2">{sub}</span>
    </div>
  );

  if (exercise.type === 'bodyweight') {
    const sessions = ids.flatMap((id) => history.sessionsByExercise.get(id) ?? []);
    const totals = sessions.map((s) => ({ date: s.date, total: s.sets.filter((x) => x.kind === 'working').reduce((n, x) => n + (x.reps ?? 0), 0) }));
    const bestTotal = totals.reduce((a, b) => (b.total > a.total ? b : a), totals[0]);
    return (
      <div className="mt-3 grid grid-cols-2 border-y border-line">
        {pair('Most reps', `${rec.mostReps.reps} reps`, fmtMonthDay(rec.mostReps.date))}
        {pair('Most in a session', `${bestTotal.total} reps`, fmtMonthDay(bestTotal.date))}
      </div>
    );
  }

  const rows = Array.from({ length: 12 }, (_, i) => i + 1).map((r) => ({ reps: r, entry: rec.byReps.get(r) }));
  const weights = rows.filter((r) => r.entry).map((r) => r.entry!.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const width = (w: number) => (max === min ? 100 : 18 + (82 * (w - min)) / (max - min));
  const fw = (w: number) => (exercise.type === 'weight' ? formatWeight(w, units) : formatSetWeight(w, exercise.type, units));

  return (
    <div>
      <div className="mt-3 grid grid-cols-2 border-y border-line">
        {exercise.type === 'weight' && rec.bestE1rm
          ? pair('Best est. 1RM', `${formatNumber(Math.round(toDisplay(rec.bestE1rm.value, units)), 0)} ${unitLabel(units)}`, `${formatSet(rec.bestE1rm, exercise.type, units)} · ${fmtMonthDay(rec.bestE1rm.date)}`)
          : pair('Most reps', `${rec.mostReps.reps} reps`, `${formatSet(rec.mostReps, exercise.type, units)} · ${fmtMonthDay(rec.mostReps.date)}`)}
        {rec.heaviest && pair('Heaviest', `${fw(rec.heaviest.weight)} ${unitLabel(units)}`, `× ${rec.heaviest.reps} · ${fmtMonthDay(rec.heaviest.date)}`)}
      </div>
      <div className="mt-2 text-[14px]">
        <div className="grid h-6 grid-cols-[46px_1fr_52px_60px] items-center gap-2.5 text-[10.5px] font-bold tracking-[0.05em] text-fg2">
          <span>REPS</span>
          <span />
          <span className="text-right">{unitLabel(units).toUpperCase()}</span>
          <span className="text-right">DATE</span>
        </div>
        {rows.map(({ reps, entry }) => {
          const recent = entry && isRecent(entry.date);
          return (
            <div
              key={reps}
              className={cx(
                'grid h-[30px] grid-cols-[46px_1fr_52px_60px] items-center gap-2.5 border-b border-line whitespace-nowrap',
                currentReps === reps && '-mx-1.5 rounded-[7px] border-transparent bg-accent-soft px-1.5',
              )}
            >
              <span className="font-bold">{reps} RM</span>
              <span className="relative h-[7px] rounded-full bg-surface-2">
                {entry && <i className={cx('absolute inset-y-0 left-0 rounded-full', recent ? 'bg-accent' : 'bg-[var(--og-bar)]')} style={{ width: `${width(entry.weight)}%` }} />}
              </span>
              <span className="text-right font-bold">{entry ? fw(entry.weight) : '—'}</span>
              <span className={cx('text-right text-[12px]', recent ? 'font-bold text-accent' : 'text-fg2')}>{entry ? fmtMonthDay(entry.date) : ''}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-2.5 text-[12.5px] text-fg2">Best weight for 1–12 reps from working sets. Blue = set in the last 30 days.</p>
    </div>
  );
}
