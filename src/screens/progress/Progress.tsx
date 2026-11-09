import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Sparkline } from '../../components/charts';
import { CheckGlyph, ChevronDown, ProgressIcon, WarnGlyph } from '../../components/icons';
import { Sheet, SheetOption } from '../../components/overlays';
import { cx, EmptyState, LabelAction, LargeHeader, Screen, SectionLabel, Segmented } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { defaultPinned, hasEnoughForProgress, liftPoints, liftTrend } from '../../data/lifts';
import type { Exercise, Units } from '../../db/types';
import { COMPOUND_IDS } from '../../db/seedExercises';
import { CHART_RANGES, RANGE_WORDS, type ChartRange } from '../../lib/chart';
import { formatNumber, formatWeight, toDisplay, unitLabel } from '../../lib/units';
import { CardioProgress } from './Cardio';
import { GoalsList } from './Goals';
import { NavRow, STATUS_TONE, statusText, useGoalViews, useLiftTrainings } from './TrainingViews';
import { useGoals } from '../../data/goals';
import { currentPhase } from '../../data/training';
import { PHASE_LABEL } from '../settings/Training';
import { addMonths, fmtMonthDay, MONTHS_LONG, startOfMonth } from '../../lib/dates';
import type { Status } from '../../lib/training';

const monthName = (ts: number) => MONTHS_LONG[new Date(ts).getMonth()];
import { effortIn1rm } from '../../lib/effort';

const RANGE_KEY = 'og-progress-range';
const FOCUS_DEFAULT = 4;
export const FOCUS_MAX = 5;
const VIEW_KEY = 'og-progress-view';
type View = 'lifts' | 'goals' | 'cardio';
const RANGE_LABEL: Record<ChartRange, string> = { '1M': 'Last month', '3M': 'Last 3 months', '6M': 'Last 6 months', '1Y': 'Last year', All: 'All time' };

function loadRange(): ChartRange {
  try {
    const v = localStorage.getItem(RANGE_KEY) as ChartRange | null;
    return v && CHART_RANGES.includes(v) ? v : '3M';
  } catch {
    return '3M';
  }
}

/**
 * Focus lifts (the pinned lifts), in your order. By default the 4 most-logged
 * compound lifts, topped up with your most frequent others (training-logic §21).
 */
export function usePinned(): Exercise[] {
  const { settings, history, exerciseMap } = useData();
  return useMemo(() => {
    const live = (id: string) => {
      const e = exerciseMap.get(id);
      return !!e && !e.deletedAt;
    };
    let ids: string[];
    if (settings.pinnedCustomized) ids = settings.pinnedExerciseIds.filter(live);
    else {
      const all = defaultPinned(history, live, (id) => exerciseMap.get(id)?.type, settings.oneRmFormula, Infinity);
      const compound = all.filter((id) => COMPOUND_IDS.has(id)).slice(0, FOCUS_DEFAULT);
      ids = [...compound, ...all.filter((id) => !compound.includes(id))].slice(0, FOCUS_DEFAULT);
    }
    return ids.map((id) => exerciseMap.get(id)!).filter(Boolean);
  }, [settings.pinnedCustomized, settings.pinnedExerciseIds, settings.oneRmFormula, history, exerciseMap]);
}

function valueText(v: number, ex: Exercise, units: Units): string {
  if (ex.type === 'bodyweight') return `${Math.round(v)} reps`;
  if (ex.type === 'bodyweight_plus') return v > 0 ? `+${formatWeight(v, units)} ${unitLabel(units)}` : 'BW';
  if (ex.type === 'assisted') return v < 0 ? `−${formatWeight(-v, units)} ${unitLabel(units)}` : v > 0 ? `+${formatWeight(v, units)} ${unitLabel(units)}` : 'BW';
  return `${formatNumber(Math.round(toDisplay(v, units)), 0)} ${unitLabel(units)}`;
}

function changeText(change: number, pct: number | undefined, ex: Exercise, units: Units): string {
  if (ex.type === 'bodyweight') {
    const r = Math.round(change);
    return r === 0 ? '= 0 reps' : `${r > 0 ? '▲ +' : '▼ −'}${Math.abs(r)} ${Math.abs(r) === 1 ? 'rep' : 'reps'}`;
  }
  if (ex.type === 'weight' && pct !== undefined) {
    const p = Math.round(pct);
    return p === 0 ? '= 0%' : `${p > 0 ? '▲ +' : '▼ −'}${Math.abs(p)}%`;
  }
  const d = toDisplay(change, units);
  return Math.abs(d) < 0.05 ? `= 0 ${unitLabel(units)}` : `${d > 0 ? '▲ +' : '▼ −'}${formatNumber(Math.abs(d), 1)} ${unitLabel(units)}`;
}

/** 7.1 / 7.6 / 7.12: focus lifts first with a status each, every other lift, goals, cardio. */
export function Progress() {
  const navigate = useNavigate();
  const { history, settings, exerciseMap } = useData();
  const isCardio = (id: string) => exerciseMap.get(id)?.type === 'cardio';
  const anyCardio = [...history.sessionsByExercise.keys()].some(isCardio);
  const [viewRaw, setViewRaw] = useState<View>(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      return v === 'cardio' || v === 'goals' ? v : 'lifts';
    } catch {
      return 'lifts';
    }
  });
  const view: View = !anyCardio && viewRaw === 'cardio' ? 'lifts' : viewRaw;
  const setView = (v: View) => {
    setViewRaw(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  };
  const pinned = usePinned();
  const [range, setRangeState] = useState<ChartRange>(loadRange);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [othersOpen, setOthersOpen] = useState(false);
  const units = settings.units;
  const setRange = (r: ChartRange) => {
    setRangeState(r);
    try {
      localStorage.setItem(RANGE_KEY, r);
    } catch {
      /* ignore */
    }
  };

  const lifts = useLiftTrainings(pinned);
  const trainingOf = useMemo(() => new Map([...lifts.focus, ...lifts.others].map((l) => [l.exercise.id, l])), [lifts]);
  const rowsFor = (exs: Exercise[]) =>
    exs.map((ex) => {
      const pts = liftPoints(history, [ex.id], ex.type, settings.oneRmFormula, effortIn1rm(settings));
      return { ex, trend: liftTrend(pts, range), sessions: pts.length, hasMetric: pts.some((p) => p.metric), training: trainingOf.get(ex.id) };
    });
  const rows = useMemo(() => rowsFor(pinned), [pinned, history, range, settings, trainingOf]); // eslint-disable-line react-hooks/exhaustive-deps
  const otherRows = useMemo(() => rowsFor(lifts.others.map((l) => l.exercise)), [lifts, history, range, settings, trainingOf]); // eslint-disable-line react-hooks/exhaustive-deps

  const enough = hasEnoughForProgress(history, isCardio);
  const withChange = rows.filter((r) => r.trend.change !== undefined);
  // % only means something for est. 1RM. Added/assisted weight starts near 0, so its % would swamp the average.
  const pcts = withChange
    .filter((r) => r.ex.type === 'weight')
    .map((r) => r.trend.pct)
    .filter((p): p is number => p !== undefined && Number.isFinite(p));
  const avg = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : undefined;

  // D1: status counts over every lift that gets one (focus only with Train everything off).
  const tracked = settings.trainEverything ? [...lifts.focus, ...lifts.others] : lifts.focus;
  const count = (st: Status[]) => tracked.filter((l) => st.includes(l.trend.status)).length;
  const counts = [
    { n: count(['climbing']), label: 'climbing', tone: 'text-tip' },
    { n: count(['holding', 'steady']), label: 'holding', tone: 'text-fg' },
    { n: count(['maintained']), label: 'maintained', tone: 'text-accent' },
    { n: count(['slipping']), label: 'slipping', tone: 'text-warn' },
  ].filter((c) => c.n > 0);

  const goals = useGoals();
  const goalViews = useGoalViews(goals);
  const phase = currentPhase(settings);
  const now = Date.now();
  // B3: the recap leads Progress for the first week of each month.
  const lastMonth = addMonths(startOfMonth(now), -1);
  const recapFresh = new Date(now).getDate() <= 7 && history.workouts.some((w) => w.workout.startedAt >= lastMonth && w.workout.startedAt < startOfMonth(now));

  const liftRow = ({ ex, trend, sessions, hasMetric, training }: (typeof rows)[number], withStatus: boolean) => {
    const ch = trend.change;
    const dir = ch === undefined ? 'none' : ch > (ex.type === 'bodyweight' ? 0.5 : 0.25) ? 'up' : ch < -(ex.type === 'bodyweight' ? 0.5 : 0.25) ? 'down' : 'flat';
    const st = withStatus ? training?.trend : undefined;
    return (
      <button
        key={ex.id}
        type="button"
        onClick={() => navigate(`/progress/lift/${ex.id}`)}
        className="grid min-h-[60px] w-full grid-cols-[1fr_72px_76px] items-center gap-2.5 border-b border-line py-1.5 text-left active:bg-surface/60"
      >
        <span className="min-w-0">
          <b className="block truncate text-[16px] font-semibold">{ex.name}</b>
          <span className="block truncate text-[13px] text-fg2 tabular-nums">
            {trend.current !== undefined ? valueText(trend.current, ex, units) : sessions > 0 && ex.type === 'weight' && !hasMetric ? 'No sets of 12 reps or fewer' : 'No sessions in range'}
            {st && (
              <>
                {' · '}
                <span className={cx('font-semibold', STATUS_TONE[st.status])}>{statusText(st.status)}</span>
              </>
            )}
          </span>
        </span>
        <Sparkline values={trend.values} width={72} />
        <span className={cx('text-right text-[13.5px] font-bold whitespace-nowrap tabular-nums', dir === 'up' ? 'text-tip' : dir === 'down' ? 'text-danger' : 'text-fg2')}>
          {ch === undefined ? '—' : changeText(ch, trend.pct, ex, units)}
        </span>
      </button>
    );
  };

  return (
    <Screen
      header={
        <LargeHeader
          title="Progress"
          right={
            view === 'goals' ? (
              <button type="button" onClick={() => navigate('/progress/goal/new')} aria-label="New goal" className="flex h-11 w-11 items-center justify-center text-[28px] font-light text-accent">
                +
              </button>
            ) : (
              enough &&
              view === 'lifts' && (
                <button type="button" onClick={() => setRangeOpen(true)} aria-label={`Range: ${range}`} className="flex h-11 items-center">
                  <span className="flex h-[32px] items-center gap-1.5 rounded-[9px] border border-line-strong px-2.5 text-[14px] font-semibold text-accent">
                    {range}
                    <ChevronDown size={10} />
                  </span>
                </button>
              )
            )
          }
        />
      }
    >
      <Segmented
        className="mt-1"
        options={[
          { value: 'lifts' as const, label: 'Lifts' },
          { value: 'goals' as const, label: 'Goals' },
          ...(anyCardio ? [{ value: 'cardio' as const, label: 'Cardio' }] : []),
        ]}
        value={view}
        onChange={setView}
      />
      {view === 'cardio' ? (
        <CardioProgress />
      ) : view === 'goals' ? (
        <GoalsList views={goalViews} loading={!goals} units={units} />
      ) : !enough ? (
        <EmptyState icon={<ProgressIcon size={24} />} title="Not enough data yet" className="pt-24">
          Log an exercise in two different workouts and its trend shows up here.
        </EmptyState>
      ) : (
        <>
          <div className="mt-3">
            <div className="text-[30px] leading-tight font-bold tracking-[-0.02em] tabular-nums">
              {avg === undefined ? '—' : `${avg >= 0 ? '+' : '−'}${Math.abs(Math.round(avg))}%`}
              <small className="ml-1.5 text-[15px] font-semibold text-fg2">average {RANGE_WORDS[range]}</small>
            </div>
            <span className="text-[14px] font-bold tabular-nums">
              {counts.length ? (
                counts.map((c, i) => (
                  <span key={c.label} className={c.tone}>
                    {i > 0 && <span className="text-fg3"> · </span>}
                    {c.n} {c.label}
                  </span>
                ))
              ) : (
                <span className="inline-flex items-center gap-1.5 font-normal text-fg2">
                  <WarnGlyph size={14} className="flex-none text-warn" />
                  Statuses need 6 sessions in 8 weeks
                </span>
              )}
            </span>
            {phase !== 'build' && (
              <button type="button" onClick={() => navigate('/settings/phase')} className="flex min-h-11 items-center text-[13.5px] font-semibold text-accent">
                {PHASE_LABEL[phase]}
                {settings.phase?.until ? ` until ${fmtMonthDay(settings.phase.until)}` : ''} ›
              </button>
            )}
          </div>

          {recapFresh && (
            <div className="mt-3 border-t border-line">
              <NavRow title={`${monthName(lastMonth)} in review`} detail="Workouts, records and every lift against the month before" onClick={() => navigate('/progress/month')} tone="text-accent" />
            </div>
          )}

          <SectionLabel action={<LabelAction onClick={() => navigate('/progress/pinned')}>Edit</LabelAction>}>Focus</SectionLabel>
          {rows.map((r) => liftRow(r, true))}
          {!rows.length && (
            <button type="button" onClick={() => navigate('/progress/pinned')} className="block w-full py-6 text-center text-[14px] text-fg2">
              No focus lifts. <span className="font-semibold text-accent">Pick some</span>
            </button>
          )}

          {otherRows.length > 0 &&
            (settings.trainEverything ? (
              <>
                <SectionLabel>All other lifts</SectionLabel>
                {otherRows.map((r) => liftRow(r, true))}
              </>
            ) : (
              <>
                <SectionLabel>Other lifts</SectionLabel>
                <button
                  type="button"
                  aria-expanded={othersOpen}
                  onClick={() => setOthersOpen((o) => !o)}
                  className="flex min-h-[52px] w-full items-center justify-between border-b border-line text-left active:bg-surface/60"
                >
                  <span>
                    <b className="block text-[16px] font-semibold">{otherRows.length} other lifts</b>
                    <span className="text-[13px] text-fg2">Charts and records. Trends are on for focus lifts only.</span>
                  </span>
                  <ChevronDown size={11} className={cx('text-fg3 transition-transform', othersOpen && 'rotate-180')} />
                </button>
                {othersOpen && otherRows.map((r) => liftRow(r, false))}
              </>
            ))}

          <div className="mt-6 border-t border-line">
            <NavRow title="Month in review" detail="One month at a time, against the one before" onClick={() => navigate('/progress/month')} />
          </div>
          <p className="mt-4 text-[12.5px] leading-normal text-fg2">
            Status = the last 8 weeks against each lift's own pace, so one bad day never counts. Change = latest session vs the last one before the range.
          </p>
        </>
      )}

      <Sheet open={rangeOpen} onClose={() => setRangeOpen(false)} title="Range">
        {CHART_RANGES.map((r) => (
          <SheetOption
            key={r}
            onClick={() => {
              setRange(r);
              setRangeOpen(false);
            }}
            detail={range === r ? <CheckGlyph size={15} className="text-accent" /> : undefined}
          >
            {RANGE_LABEL[r]}
          </SheetOption>
        ))}
      </Sheet>
    </Screen>
  );
}
