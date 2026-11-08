import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { WeeklyBars } from '../../components/charts';
import { ChevronRight } from '../../components/icons';
import { BackButton, Chips, cx, EmptyState, LabelAction, Screen, SectionLabel, Segmented, TopBar } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { cardioSessions } from '../../data/history';
import type { Exercise, Units } from '../../db/types';
import { cardioSummary, cardioTotals, distanceDisplay, distanceText, formatDuration, formatHours, longDistance, longDistanceWord } from '../../lib/cardio';
import {
  availableCardioRanges,
  cardioRangeStart,
  distanceRecords,
  isRecentDistanceRecord,
  machineTotals,
  RANGE_PHRASE,
  RANGE_SHORT,
  summarizeRange,
  type CardioMetric,
  type CardioRange,
  type CardioSession,
} from '../../lib/cardioStats';
import { fmtMonthDay, fmtRelativeDay, weekdayShort } from '../../lib/dates';
import { formatNumber } from '../../lib/units';

const RANGE_KEY = 'og-cardio-range';

function loadRange(): CardioRange {
  try {
    const v = localStorage.getItem(RANGE_KEY) as CardioRange | null;
    return v ?? '3M';
  } catch {
    return '3M';
  }
}

function useCardioRange(first: number | undefined, weekStart: 0 | 1) {
  const [raw, setRaw] = useState<CardioRange>(loadRange);
  const ranges = availableCardioRanges(first, weekStart);
  const range = ranges.includes(raw) ? raw : ranges.includes('3M') ? '3M' : 'All';
  const set = (r: CardioRange) => {
    setRaw(r);
    try {
      localStorage.setItem(RANGE_KEY, r);
    } catch {
      /* ignore */
    }
  };
  return [range, set, ranges] as const;
}

export function useCardioSessions(only?: string): CardioSession[] {
  const { history, exerciseMap } = useData();
  return useMemo(
    () => cardioSessions(history, (id) => exerciseMap.get(id)?.type === 'cardio', only ? (id) => id === only : undefined),
    [history, exerciseMap, only],
  );
}

const metricWord = (m: CardioMetric, units: Units, spec?: Exercise) =>
  m === 'minutes' ? 'min' : m === 'sessions' ? 'sessions' : spec && distanceDisplay(spec, units) === 'm' ? 'm' : longDistanceWord(units);

/** Long distance or meters, for one machine's chart. */
function metricValue(v: number, m: CardioMetric, units: Units, spec?: Exercise) {
  if (m === 'distance' && spec && distanceDisplay(spec, units) === 'm') return (v * (units === 'kg' ? 1000 : 1609.344));
  return v;
}

function fmtMetric(v: number, m: CardioMetric, units: Units, spec?: Exercise): string {
  const x = metricValue(v, m, units, spec);
  if (m === 'distance') return spec && distanceDisplay(spec, units) === 'm' ? Math.round(x).toLocaleString('en-US') : formatNumber(x, 1);
  if (m === 'sessions') return formatNumber(x, 1);
  return String(Math.round(x));
}

/** Big average, change line, bars and range chips. Shared by D2 and D3. */
function WeeklyChart({
  sessions,
  metric,
  range,
  setRange,
  ranges,
  spec,
}: {
  sessions: CardioSession[];
  metric: CardioMetric;
  range: CardioRange;
  setRange: (r: CardioRange) => void;
  ranges: CardioRange[];
  spec?: Exercise;
}) {
  const { settings } = useData();
  const units = settings.units;
  const sum = useMemo(() => summarizeRange(sessions, range, metric, units, settings.weekStart), [sessions, range, metric, units, settings.weekStart]);
  const word = metricWord(metric, units, spec);
  const ch = sum.change;
  const eps = metric === 'minutes' ? 0.5 : 0.05;
  return (
    <>
      <div className="mt-3">
        <div className="text-[30px] leading-tight font-bold tracking-[-0.02em]">
          {fmtMetric(sum.avg, metric, units, spec)} <small className="text-[15px] font-semibold text-fg2">{word} avg</small>
        </div>
        {ch !== undefined && (
          <span className={cx('text-[14px] font-bold', ch > eps ? 'text-tip' : ch < -eps ? 'text-danger' : 'text-fg2')}>
            {Math.abs(ch) <= eps ? '= same' : `${ch > 0 ? '▲' : '▼'} ${fmtMetric(Math.abs(ch), metric, units, spec)} ${word}`} vs the {RANGE_SHORT[range]} before
          </span>
        )}
      </div>
      <WeeklyBars
        weeks={sum.bins.map((b) => b.start)}
        values={sum.values.map((v) => metricValue(v, metric, units, spec))}
        avg={metricValue(sum.avg, metric, units, spec)}
        format={(v) => (spec && metric === 'distance' && distanceDisplay(spec, units) === 'm' ? (v >= 1000 ? `${formatNumber(v / 1000, 1)}k` : String(Math.round(v))) : formatNumber(v, 1))}
      />
      <Segmented className="mt-3" options={ranges.map((r) => ({ value: r, label: r }))} value={range} onChange={setRange} />
    </>
  );
}

/** D2: Progress → Cardio. How much, not how fast. */
export function CardioProgress() {
  const navigate = useNavigate();
  const { settings, exerciseMap } = useData();
  const units = settings.units;
  const sessions = useCardioSessions();
  const first = sessions.length ? sessions[sessions.length - 1].date : undefined;
  const [range, setRange, ranges] = useCardioRange(first, settings.weekStart);
  const hasDistance = sessions.some((s) => cardioTotals(s.sets).distance);
  const [metricRaw, setMetric] = useState<CardioMetric>('minutes');
  const metric = metricRaw === 'distance' && !hasDistance ? 'minutes' : metricRaw;
  const machines = useMemo(() => machineTotals(sessions, cardioRangeStart(range, settings.weekStart)), [sessions, range, settings.weekStart]);
  const runs = sessions.some((s) => exerciseMap.get(s.exerciseId)?.isRun);

  if (!sessions.length)
    return (
      <EmptyState icon="♥" title="No cardio yet" className="pt-20">
        Add a treadmill, bike or rower to any workout. Minutes and distance per week show up here.
      </EmptyState>
    );

  return (
    <>
      <Chips
        className="mt-1"
        options={[
          { value: 'minutes' as const, label: 'Minutes' },
          ...(hasDistance ? [{ value: 'distance' as const, label: units === 'kg' ? 'Kilometers' : 'Miles' }] : []),
          { value: 'sessions' as const, label: 'Sessions' },
        ]}
        value={metric}
        onChange={setMetric}
      />
      <div className="mt-4 text-[11px] font-bold tracking-[0.07em] text-fg2 uppercase">Per week · {RANGE_PHRASE[range]}</div>
      <WeeklyChart sessions={sessions} metric={metric} range={range} setRange={setRange} ranges={ranges} />

      <SectionLabel action={runs ? <LabelAction onClick={() => navigate('/progress/cardio-records')}>Records ›</LabelAction> : undefined}>
        By machine · {RANGE_SHORT[range]}
      </SectionLabel>
      {machines.map((m) => {
        const ex = exerciseMap.get(m.exerciseId);
        const meters = ex && distanceDisplay(ex, units) === 'm';
        return (
          <button
            key={m.exerciseId}
            type="button"
            onClick={() => navigate(`/progress/cardio/${m.exerciseId}`)}
            className="grid min-h-[58px] w-full grid-cols-[minmax(0,1fr)_auto_auto_14px] items-center gap-3 border-b border-line text-left active:bg-surface/60"
          >
            <span className="min-w-0">
              <b className="block truncate text-[16px] font-semibold">{ex?.name ?? 'Cardio'}</b>
              <span className="text-[13px] text-fg2">
                {m.sessions} {m.sessions === 1 ? 'session' : 'sessions'}
              </span>
            </span>
            <span className="text-right text-[14px] font-semibold">{formatHours(m.durationSec)}</span>
            <span className="min-w-[58px] text-right text-[14px] text-fg2">
              {m.distance ? (meters ? `${Math.round(m.distance).toLocaleString('en-US')} m` : `${formatNumber(longDistance(m.distance, units), 1)} ${longDistanceWord(units)}`) : '—'}
            </span>
            <ChevronRight size={12} className="text-fg3" />
          </button>
        );
      })}
      {!machines.length && <p className="py-5 text-center text-[14px] text-fg2">No cardio in this range.</p>}
      <p className="mt-4 text-[12.5px] leading-normal text-fg2">This week is still going, so it's left out of the average.</p>
    </>
  );
}

/** D3: one machine. Distance (or minutes) per week, then recent sessions. */
export function CardioMachine() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { settings, exerciseMap } = useData();
  const units = settings.units;
  const ex = exerciseMap.get(id);
  const sessions = useCardioSessions(id);
  const first = sessions.length ? sessions[sessions.length - 1].date : undefined;
  const [range, setRange, ranges] = useCardioRange(first, settings.weekStart);
  const hasDistance = sessions.some((s) => cardioTotals(s.sets).distance);
  const [metricRaw, setMetric] = useState<CardioMetric>('distance');
  const metric = metricRaw === 'distance' && !hasDistance ? 'minutes' : metricRaw;
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/progress'));

  if (!ex)
    return (
      <Screen header={<TopBar left={<BackButton label="Cardio" onClick={() => navigate('/progress')} />} />}>
        <EmptyState icon="?" title="Exercise not found" className="pt-20" />
      </Screen>
    );

  const dist = distanceDisplay(ex, units);
  const distLabel = dist === 'm' ? 'Meters' : units === 'kg' ? 'Kilometers' : 'Miles';
  return (
    <Screen
      header={
        <TopBar
          left={<BackButton label="Cardio" onClick={back} />}
          title={ex.name}
        />
      }
    >
      {!sessions.length ? (
        <EmptyState icon="♥" title={`No ${ex.name} yet`} className="pt-20">
          Log it in a workout and its weekly totals show up here.
        </EmptyState>
      ) : (
        <>
          {hasDistance && (
            <Segmented
              className="mt-3"
              options={[
                { value: 'distance' as const, label: distLabel },
                { value: 'minutes' as const, label: 'Minutes' },
              ]}
              value={metric}
              onChange={setMetric}
            />
          )}
          <div className="mt-4 text-[11px] font-bold tracking-[0.07em] text-fg2 uppercase">
            {ex.name} · {metric === 'distance' ? distLabel.toLowerCase() : 'minutes'} per week
          </div>
          <WeeklyChart sessions={sessions} metric={metric} range={range} setRange={setRange} ranges={ranges} spec={ex} />
          <SectionLabel>Recent</SectionLabel>
          {sessions.slice(0, 20).map((s) => {
            const d = new Date(s.date);
            const n = s.sets.length;
            return (
              <button
                key={`${s.workoutId}-${s.date}`}
                type="button"
                onClick={() => navigate(`/history/${s.workoutId}`)}
                className="flex min-h-[56px] w-full items-center gap-3 border-b border-line text-left active:bg-surface/60"
              >
                <span className="w-10 flex-none text-center leading-[1.1]">
                  <small className="block text-[10.5px] font-bold text-fg2 uppercase">{weekdayShort(d.getDay())}</small>
                  <b className="text-[19px]">{d.getDate()}</b>
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[16px] font-semibold">{cardioSummary(s.sets, ex, units) || '—'}</b>
                  <span className="block truncate text-[13px] text-fg2">
                    {n} {n === 1 ? 'segment' : 'segments'}
                    {/^(Today|Yesterday)$/.test(fmtRelativeDay(s.date)) ? ` · ${fmtRelativeDay(s.date).toLowerCase()}` : ''}
                  </span>
                </span>
                <ChevronRight size={12} className="flex-none text-fg3" />
              </button>
            );
          })}
          <p className="mt-4 text-[12.5px] leading-normal text-fg2">Speed is in each session's numbers, it just isn't charted.</p>
        </>
      )}
    </Screen>
  );
}

/** D4: fastest times at classic race distances. The only cardio "bests". */
export function DistanceRecords() {
  const navigate = useNavigate();
  const { settings, exerciseMap } = useData();
  const units = settings.units;
  const all = useCardioSessions();
  const runs = useMemo(() => all.filter((s) => exerciseMap.get(s.exerciseId)?.isRun), [all, exerciseMap]);
  const { records, longest } = useMemo(() => distanceRecords(runs), [runs]);
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/progress'));

  return (
    <Screen header={<TopBar left={<BackButton label="Cardio" onClick={back} />} title="Distance records" />}>
      <SectionLabel className="mt-3">Fastest times</SectionLabel>
      {records.map((r) => {
        const b = r.best;
        const recent = b && isRecentDistanceRecord(b.date);
        return (
          <div key={r.id} className="flex min-h-[58px] items-center justify-between gap-3 border-b border-line">
            <span className="min-w-0">
              <b className="block text-[16px] font-semibold">{r.label}</b>
              <span className="block truncate text-[13px] text-fg2">
                {b
                  ? `${fmtMonthDay(b.date)} · ${exerciseMap.get(b.exerciseId)?.name ?? 'Run'}`
                  : longest
                    ? `longest so far: ${distanceText(longest.meters, units === 'kg' ? 'km' : 'mi')}`
                    : 'not yet'}
              </span>
            </span>
            <b className={cx('flex-none text-[19px] font-bold', recent ? 'text-accent' : b ? 'text-fg' : 'text-fg3')}>{b ? formatDuration(Math.round(b.timeSec)) : '—'}</b>
          </div>
        );
      })}
      <p className="mt-4 text-[12.5px] leading-normal text-fg2">
        Counts runs (outside or treadmill) where one segment covered at least that distance; the time is scaled to the exact distance. Blue = set in the last 60 days.
      </p>
    </Screen>
  );
}
