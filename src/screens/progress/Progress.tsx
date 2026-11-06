import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Sparkline } from '../../components/charts';
import { CheckGlyph, ChevronDown, ProgressIcon } from '../../components/icons';
import { Sheet, SheetOption } from '../../components/overlays';
import { cx, EmptyState, LabelAction, LargeHeader, Screen, SectionLabel } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { defaultPinned, hasEnoughForProgress, liftPoints, liftTrend } from '../../data/lifts';
import type { Exercise, Units } from '../../db/types';
import { CHART_RANGES, RANGE_WORDS, type ChartRange } from '../../lib/chart';
import { formatNumber, formatWeight, toDisplay, unitLabel } from '../../lib/units';

const RANGE_KEY = 'og-progress-range';
const RANGE_LABEL: Record<ChartRange, string> = { '1M': 'Last month', '3M': 'Last 3 months', '6M': 'Last 6 months', '1Y': 'Last year', All: 'All time' };

function loadRange(): ChartRange {
  try {
    const v = localStorage.getItem(RANGE_KEY) as ChartRange | null;
    return v && CHART_RANGES.includes(v) ? v : '3M';
  } catch {
    return '3M';
  }
}

/** The pinned lifts, in your order (or your 6 most frequent by default). */
export function usePinned(): Exercise[] {
  const { settings, history, exerciseMap } = useData();
  return useMemo(() => {
    const live = (id: string) => {
      const e = exerciseMap.get(id);
      return !!e && !e.deletedAt;
    };
    const ids = settings.pinnedCustomized ? settings.pinnedExerciseIds.filter(live) : defaultPinned(history, live, (id) => exerciseMap.get(id)?.type, settings.oneRmFormula);
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

/** 7.1 / 7.6: pinned lifts at a glance. */
export function Progress() {
  const navigate = useNavigate();
  const { history, settings } = useData();
  const pinned = usePinned();
  const [range, setRangeState] = useState<ChartRange>(loadRange);
  const [rangeOpen, setRangeOpen] = useState(false);
  const units = settings.units;
  const setRange = (r: ChartRange) => {
    setRangeState(r);
    try {
      localStorage.setItem(RANGE_KEY, r);
    } catch {
      /* ignore */
    }
  };

  const rows = useMemo(
    () =>
      pinned.map((ex) => {
        const pts = liftPoints(history, [ex.id], ex.type, settings.oneRmFormula);
        return { ex, trend: liftTrend(pts, range), sessions: pts.length, hasMetric: pts.some((p) => p.metric) };
      }),
    [pinned, history, range, settings.oneRmFormula],
  );

  const enough = hasEnoughForProgress(history);
  const withChange = rows.filter((r) => r.trend.change !== undefined);
  const up = withChange.filter((r) => (r.trend.change ?? 0) > (r.ex.type === 'bodyweight' ? 0.5 : 0.25)).length;
  // % only means something for est. 1RM. Added/assisted weight starts near 0, so its % would swamp the average.
  const pcts = withChange
    .filter((r) => r.ex.type === 'weight')
    .map((r) => r.trend.pct)
    .filter((p): p is number => p !== undefined && Number.isFinite(p));
  const avg = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : undefined;

  return (
    <Screen
      header={
        <LargeHeader
          title="Progress"
          right={
            enough && (
              <button
                type="button"
                onClick={() => setRangeOpen(true)}
                aria-label={`Range: ${range}`}
                className="flex h-11 items-center"
              >
                <span className="flex h-[32px] items-center gap-1.5 rounded-[9px] border border-line-strong px-2.5 text-[14px] font-semibold text-accent">
                  {range}
                  <ChevronDown size={10} />
                </span>
              </button>
            )
          }
        />
      }
    >
      {!enough ? (
        <EmptyState icon={<ProgressIcon size={24} />} title="Not enough data yet" className="pt-24">
          Log an exercise in two different workouts and its trend shows up here.
        </EmptyState>
      ) : (
        <>
          <div className="mt-1">
            <div className="text-[11px] font-bold tracking-[0.05em] text-fg2 uppercase">Pinned lifts · est. 1RM</div>
            <div className="text-[30px] leading-tight font-bold tracking-[-0.02em]">
              {avg === undefined ? '—' : `${avg >= 0 ? '+' : '−'}${Math.abs(Math.round(avg))}%`}
              <small className="ml-1.5 text-[15px] font-semibold text-fg2">average {RANGE_WORDS[range]}</small>
            </div>
            <span className={cx('text-[14px] font-bold', up ? 'text-tip' : 'text-fg2')}>
              {withChange.length ? `${up} of ${withChange.length} went up` : 'Not enough sessions in this range'}
            </span>
          </div>

          <SectionLabel action={<LabelAction onClick={() => navigate('/progress/pinned')}>Edit</LabelAction>}>Lifts</SectionLabel>
          {rows.map(({ ex, trend, sessions, hasMetric }) => {
            const ch = trend.change;
            const dir = ch === undefined ? 'none' : ch > (ex.type === 'bodyweight' ? 0.5 : 0.25) ? 'up' : ch < -(ex.type === 'bodyweight' ? 0.5 : 0.25) ? 'down' : 'flat';
            return (
              <button
                key={ex.id}
                type="button"
                onClick={() => navigate(`/progress/lift/${ex.id}`)}
                className="grid min-h-[60px] w-full grid-cols-[1fr_72px_76px] items-center gap-2.5 border-b border-line text-left active:bg-surface/60"
              >
                <span className="min-w-0">
                  <b className="block truncate text-[16px] font-semibold">{ex.name}</b>
                  <span className="text-[13px] text-fg2">{trend.current !== undefined ? valueText(trend.current, ex, units) : sessions > 0 && ex.type === 'weight' && !hasMetric ? 'No sets of 12 reps or fewer' : 'No sessions in range'}</span>
                </span>
                <Sparkline values={trend.values} width={72} />
                <span className={cx('text-right text-[13.5px] font-bold whitespace-nowrap', dir === 'up' ? 'text-tip' : dir === 'down' ? 'text-danger' : 'text-fg2')}>
                  {ch === undefined ? '—' : changeText(ch, trend.pct, ex, units)}
                </span>
              </button>
            );
          })}
          {!rows.length && (
            <button type="button" onClick={() => navigate('/progress/pinned')} className="block w-full py-6 text-center text-[14px] text-fg2">
              No lifts pinned. <span className="font-semibold text-accent">Pick some</span>
            </button>
          )}
          <p className="mt-4 text-[12.5px] leading-normal text-fg2">Change = latest session vs the last one before the range. Bodyweight lifts count reps; added or assisted weight counts the weight.</p>
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
