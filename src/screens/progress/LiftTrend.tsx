// One lift's trend (training-logic §13–§19, proposal B2, D2, D3, F2, F3, F4). Screen 7.13.

import { useMemo, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ForecastChart, type ChartPoint, type ForecastBand } from '../../components/charts';
import { BackButton, Button, cx, EmptyState, Note, Screen, SectionLabel, StatRow, TopBar } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { canHaveGoal, useGoals } from '../../data/goals';
import { currentPhase, liftTraining } from '../../data/training';
import { updateSettings } from '../../data/settings';
import { fmtMonthDay } from '../../lib/dates';
import { DAY, milestoneList, milestoneRows, MONTH_DAYS, project, STATUS_LABEL, theilSen, WEEK, whatChanged, WINDOW_DAYS } from '../../lib/training';
import { formatNumber, unitLabel } from '../../lib/units';
import { ToggleRow } from '../settings/Training';
import { usePinned } from './Progress';
import { fmtStrength, GoalRow, MilestoneList, STATUS_TONE, statusText, strengthNumber, useGoalViews } from './TrainingViews';
import { ArrowGlyph } from '../../components/icons';

export function LiftTrend() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { history, settings, exerciseMap } = useData();
  const ex = exerciseMap.get(id);
  const focus = usePinned();
  const goals = useGoals();
  const lift = useMemo(() => (ex ? liftTraining(history, ex, settings) : undefined), [ex, history, settings]);
  const goalViews = useGoalViews(goals?.filter((g) => g.exerciseId === id));
  const units = settings.units;
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate(`/progress/lift/${id}`));

  if (!ex || !lift)
    return (
      <Screen header={<TopBar left={<BackButton label="Progress" onClick={() => navigate('/progress')} />} />}>
        <EmptyState icon="?" title="Exercise not found" className="pt-20" />
      </Screen>
    );

  const tracked = settings.trainEverything || focus.some((f) => f.id === ex.id);
  const t = lift.trend;
  const now = Date.now();
  const num = (v: number) => strengthNumber(v, ex, units);
  const unit = ex.type === 'bodyweight' ? 'reps' : unitLabel(units);
  const pts = t.points;
  const end = lift.points.length ? lift.points[lift.points.length - 1].date : now;
  const from = Math.min(end - WINDOW_DAYS * DAY, pts[0]?.date ?? end) - 7 * DAY;

  // Chart: every session in view, the Theil–Sen line through the window, the wobble band when flat.
  const chartPts: ChartPoint[] = lift.points.filter((p) => p.date >= from).map((p) => ({ date: p.date, value: num(p.value) }));
  let fit: ChartPoint[] | undefined;
  let band: ForecastBand[] | undefined;
  if (pts.length >= 2) {
    const xs = pts.map((p) => p.date / DAY);
    const { slope, intercept } = theilSen(
      xs,
      pts.map((p) => p.value),
    );
    fit = [pts[0], pts[pts.length - 1]].map((p) => ({ date: p.date, value: num(slope * (p.date / DAY) + intercept) }));
    if ((t.status === 'holding' || t.status === 'steady' || t.status === 'maintained') && t.median != null) {
      const w = Math.max(1, t.wobble ?? 2) / 100;
      band = [pts[0].date, pts[pts.length - 1].date].map((d) => ({ date: d, lo: num(t.median! * (1 - w)), hi: num(t.median! * (1 + w)) }));
    }
  }
  const gaps = lift.points
    .map((p, i, a) => (i > 0 && p.date >= from && p.date - a[i - 1].date >= 21 * DAY ? { from: a[i - 1].date, to: p.date, label: `${Math.round((p.date - a[i - 1].date) / DAY)}-day gap` } : null))
    .filter((g): g is { from: number; to: number; label: string } => !!g);

  // The line under the status.
  let sub = '';
  if (t.status === 'notSure') sub = `${t.n} ${t.n === 1 ? 'session' : 'sessions'} · needs ${t.needs} more`;
  else if (t.status === 'climbing' || t.status === 'slipping') {
    const d = (t.slope ?? 0) * ((pts[pts.length - 1].date - pts[0].date) / DAY);
    const v = Math.round(num(Math.abs(d)));
    sub = `${d >= 0 ? '+' : '−'}${v} ${unit} since ${fmtMonthDay(pts[0].date)}`;
  } else if (pts.length) {
    const vs = pts.map((p) => num(p.value));
    sub = `${formatNumber(Math.min(...vs), 0)}–${formatNumber(Math.max(...vs), 0)} since ${fmtMonthDay(pts[0].date)}`;
  }

  const sessions = (history.sessionsByExercise.get(ex.id) ?? []).slice().reverse();
  const changed = t.status === 'slipping' ? whatChanged(sessions.map((s) => ({ date: s.date, sets: s.sets.filter((x) => x.kind === 'working').length })), now) : undefined;

  const perMonth = lift.fit.n ? lift.fit.fitRate * (MONTH_DAYS / 7) : undefined;
  const in3 = lift.now.canProject ? project(lift.now.E0, lift.now.r0, lift.now.tau, 13) : undefined;
  const allSets = sessions.flatMap((s) => s.sets.filter((x) => x.kind === 'working' && x.reps != null).map((x) => ({ weight: x.weight, reps: x.reps!, date: s.date })));
  const lastWeight = sessions.length ? sessions[sessions.length - 1].sets.find((x) => x.kind === 'working')?.weight : undefined;
  const milestones = milestoneRows(milestoneList(ex.type, ex.equipment, units, lastWeight), allSets, lift.points.length ? lift.now : undefined);
  const phase = currentPhase(settings);

  const explain: Record<string, string> = {
    climbing: 'Clearly above zero over 8 weeks, more than this lift wobbles from day to day.',
    holding: `${Math.round((pts[pts.length - 1]?.date - pts[0]?.date) / WEEK || 0)} weeks inside a ±${formatNumber(Math.max(1, t.wobble ?? 2), 0)}% band. Holding after a run of gains is normal. It isn't a failure.`,
    steady: 'Small lifts move slowly, and the next weight up can be a big jump. Here, more reps at the same weight is progress.',
    maintained: 'Flat on purpose: you\'re Maintaining, so holding counts as a win.',
    slipping: `It isn't just one bad day: ${t.below ?? 0} of the last 5 sessions were under the trend.`,
    notSure: 'Weeks you didn\'t log are left blank, not counted as zero. With too little data the app says so instead of guessing.',
  };

  return (
    <Screen header={<TopBar left={<BackButton label={ex.name.length <= 12 ? ex.name : 'Back'} onClick={back} />} title="Trend" />}>
      <div className="mt-4 text-caps text-fg2">Trend · last 8 weeks</div>
      <div className={cx('text-title1 leading-tight font-bold', STATUS_TONE[t.status])}>{statusText(t.status)}</div>
      <div className="text-body font-semibold text-fg2 tabular-nums">{sub}</div>
      {!tracked && (
        <p className="mt-2 text-footnote text-fg2">
          Train everything is off, so this lift's status isn't shown on Progress.{' '}
          <button type="button" onClick={() => navigate('/progress/pinned')} className="font-semibold text-accent">
            Focus lifts
          </button>
        </p>
      )}

      <ForecastChart points={chartPts} from={from} to={end + 3 * DAY} fit={fit} band={band} gaps={gaps} label={`${ex.name} trend`} />
      <p className="mt-3 text-callout leading-snug">{explain[t.status]}</p>

      {t.status === 'holding' && (
        <>
          <SectionLabel>To get moving</SectionLabel>
          <p className="border-b border-line py-2.5 text-callout leading-snug">Use the rep hints in the workout. One extra rep a session is enough to restart the climb.</p>
        </>
      )}
      {(t.status === 'holding' || t.status === 'maintained') && (
        <ToggleRow
          label="Maintaining on purpose"
          detail="Holding shows as a success"
          on={phase === 'maintain'}
          onChange={(v) => void updateSettings({ phase: v ? { kind: 'maintain', since: Date.now() } : undefined })}
        />
      )}

      {changed && (
        <>
          <SectionLabel>What changed · from your log</SectionLabel>
          <FactRow label={`${ex.name} days a week`} value={<FromTo from={formatNumber(changed.perWeek[0], 1)} to={formatNumber(changed.perWeek[1], 1)} />} />
          <FactRow label="Working sets per session" value={<FromTo from={formatNumber(changed.setsPer[0], 1)} to={formatNumber(changed.setsPer[1], 1)} />} />
          {changed.longestGap && changed.longestGap.days >= 7 && (
            <FactRow label="Longest gap" value={`${changed.longestGap.days} days · ${fmtMonthDay(changed.longestGap.from)}–${fmtMonthDay(changed.longestGap.to)}`} />
          )}
        </>
      )}

      {t.status === 'notSure' && (
        <>
          <FactRow label="Last 8 weeks" value={`${t.n} ${t.n === 1 ? 'session' : 'sessions'}`} />
          <FactRow label="Needed for a status" value="6 sessions" />
        </>
      )}

      <SectionLabel>Pace</SectionLabel>
      <StatRow
        className="mt-1"
        items={[
          { label: 'Per month', value: perMonth != null ? `${perMonth >= 0 ? '+' : '−'}${formatNumber(Math.abs(num(perMonth)), Math.abs(num(perMonth)) < 10 ? 1 : 0)} ${unit}` : '—' },
          { label: 'Usual', value: `${lift.pace >= 0 ? '+' : '−'}${formatNumber(Math.abs(lift.pace), 1)}%/mo` },
          { label: 'In 3 months', value: in3 != null ? `~${formatNumber(num(in3), 0)} ${unit}` : '—' },
        ]}
      />
      <Note>
        Each lift is judged against its own usual pace, learned from your log{lift.sessions < 16 ? ' and a typical pace for its kind of lift until there are more sessions' : ''}. Gains slow down over time, so
        projections follow a curve, not a straight line.
      </Note>

      {tracked && (
        <>
          <SectionLabel>Milestones</SectionLabel>
          {milestones.length ? (
            <MilestoneList rows={milestones} exercise={ex} units={units} goals={goals?.filter((g) => g.exerciseId === ex.id)} onGoal={canHaveGoal(ex) ? (m) => navigate(`/progress/goal/new?ex=${ex.id}&w=${m.weight}&r=${m.reps}`) : undefined} />
          ) : (
            <p className="py-2 text-footnote text-fg2">No milestones for this lift.</p>
          )}

          {canHaveGoal(ex) && (
            <>
              <SectionLabel>Goal</SectionLabel>
              {goalViews.map((v) => (
                <GoalRow key={v.goal.id} v={v} units={units} />
              ))}
              {!goalViews.some((v) => !v.state.done) && (
                <Button kind="secondary" className="mt-3 w-full" onClick={() => navigate(`/progress/goal/new?ex=${ex.id}`)}>
                  + Set a goal
                </Button>
              )}
            </>
          )}
        </>
      )}
      <p className="mt-4 text-caption text-fg2 tabular-nums">
        {STATUS_LABEL[t.status]} · {lift.sessions} sessions logged · now {lift.points.length ? fmtStrength(lift.now.E0, ex, units) : '—'}
      </p>
    </Screen>
  );
}

/** "1.5 → 2" with a drawn arrow. */
function FromTo({ from, to }: { from: string; to: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {from}
      <ArrowGlyph size={10} className="text-fg2" />
      {to}
    </span>
  );
}

function FactRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-h-[48px] items-center justify-between gap-3 border-b border-line">
      <span className="text-body">{label}</span>
      <span className="text-body font-semibold tabular-nums">{value}</span>
    </div>
  );
}
