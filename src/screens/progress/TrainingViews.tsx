// Shared pieces for trends, goals and milestones on Progress (training-logic §15–§21,
// proposal B, C, D, F).

import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { ChevronRight } from '../../components/icons';
import { cx } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { goalView, type GoalView } from '../../data/goals';
import { liftTraining, recentLifts, type LiftTraining } from '../../data/training';
import type { Exercise, Goal, Units } from '../../db/types';
import { fmtMonthDay, monthShort } from '../../lib/dates';
import { STATUS_LABEL, WEEK, type MilestoneRow, type Status, type TrendResult, type Verdict, VERDICT_LABEL } from '../../lib/training';
import { formatNumber, formatWeight, toDisplay, unitLabel } from '../../lib/units';

// ───────────────────────────── formatting

/** A strength value in the lift's own unit: est. 1RM, reps (bodyweight) or assist weight. */
export function fmtStrength(v: number, ex: Exercise, units: Units): string {
  if (ex.type === 'bodyweight') return `${Math.round(v)} reps`;
  if (ex.type === 'assisted') return v < 0 ? `−${formatWeight(-v, units)} ${unitLabel(units)}` : 'BW';
  const n = formatNumber(Math.round(toDisplay(v, units)), 0);
  return ex.type === 'bodyweight_plus' ? `+${n} ${unitLabel(units)}` : `${n} ${unitLabel(units)}`;
}

/** Strength value as a plain display number (charts). */
export const strengthNumber = (v: number, ex: Exercise, units: Units) => (ex.type === 'bodyweight' ? v : toDisplay(v, units));

/** Strength rate per week as "+1.2 lb/wk" (or reps). */
export function fmtRate(perWeek: number, ex: Exercise, units: Units): string {
  const v = ex.type === 'bodyweight' ? perWeek : toDisplay(perWeek, units);
  const unit = ex.type === 'bodyweight' ? 'reps' : unitLabel(units);
  return `${v >= 0 ? '+' : '−'}${formatNumber(Math.abs(v), Math.abs(v) < 10 ? 1 : 0)} ${unit}/wk`;
}

export function fmtGoal(g: Pick<Goal, 'weight' | 'reps'>, ex: Exercise, units: Units): string {
  if (ex.type === 'bodyweight') return `× ${g.reps}`;
  const w = formatWeight(g.weight, units);
  return `${ex.type === 'bodyweight_plus' ? '+' : ''}${w} × ${g.reps}`;
}

/** "~Mar" within a year, "~Mar 2028" past it. */
export function etaText(weeks: number, now = Date.now()): string {
  const d = new Date(now + weeks * WEEK);
  const sameYear = d.getFullYear() === new Date(now).getFullYear() || weeks < 40;
  return `~${monthShort(d.getMonth())}${sameYear ? '' : ` ${d.getFullYear()}`}`;
}

export const STATUS_TONE: Record<Status, string> = {
  climbing: 'text-tip',
  holding: 'text-fg',
  steady: 'text-fg2',
  slipping: 'text-warn',
  maintained: 'text-accent',
  notSure: 'text-fg2',
};

export function statusText(s: Status): string {
  return (s === 'climbing' ? '▲ ' : s === 'slipping' ? '▼ ' : '') + STATUS_LABEL[s];
}

/** "+4% · 8 wk", "+2 reps", or "6 sessions so far". */
export function changeText(t: TrendResult, ex: Exercise): string {
  if (t.status === 'notSure') return t.needs ? `needs ${t.needs} more` : '';
  if (t.change == null) return '';
  if (ex.type === 'bodyweight' && t.slope != null) {
    const reps = Math.round(t.slope * 56);
    return reps === 0 ? 'same reps · 8 wk' : `${reps > 0 ? '+' : '−'}${Math.abs(reps)} reps · 8 wk`;
  }
  const p = Math.round(t.change);
  return `${p > 0 ? '+' : p < 0 ? '−' : '±'}${Math.abs(p)}% · 8 wk`;
}

export const VERDICT_TONE: Record<Verdict, string> = { ready: 'text-tip', likely: 'text-tip', stretch: 'text-warn', unlikely: 'text-danger' };

export function VerdictTag({ v, className }: { v: Verdict; className?: string }) {
  return <span className={cx('text-[11px] font-bold tracking-[0.06em] uppercase', VERDICT_TONE[v], className)}>{VERDICT_LABEL[v]}</span>;
}

// ───────────────────────────── data

/** Focus lifts first, then (with Train everything on) every other lift logged in the last 8 weeks. */
export function useLiftTrainings(focus: Exercise[]): { focus: LiftTraining[]; others: LiftTraining[] } {
  const { history, settings, exerciseMap } = useData();
  return useMemo(() => {
    const ids = new Set(focus.map((e) => e.id));
    const others = recentLifts(history, exerciseMap).filter((e) => !ids.has(e.id));
    return {
      focus: focus.filter((e) => e.type !== 'cardio').map((e) => liftTraining(history, e, settings)),
      others: others.map((e) => liftTraining(history, e, settings)),
    };
  }, [focus, history, settings, exerciseMap]);
}

/** Live goals with where each stands today; done goals last. */
export function useGoalViews(goals: Goal[] | undefined): GoalView[] {
  const { history, settings, exerciseMap } = useData();
  return useMemo(() => {
    if (!goals) return [];
    const out: GoalView[] = [];
    for (const g of goals) {
      const ex = exerciseMap.get(g.exerciseId);
      if (ex) out.push(goalView(g, ex, history, settings));
    }
    return out.sort((a, b) => Number(a.state.done) - Number(b.state.done));
  }, [goals, history, settings, exerciseMap]);
}

// ───────────────────────────── rows

/** C7: one goal, with its state on the right. */
export function GoalRow({ v, units }: { v: GoalView; units: Units }) {
  const navigate = useNavigate();
  const { goal, exercise, state } = v;
  let sub: string;
  let tag: string;
  let tone: string;
  if (state.done) {
    sub = `Done ${fmtMonthDay(goal.doneAt!)}`;
    tag = 'Done';
    tone = 'text-accent';
  } else if (v.by != null) {
    const w = Math.round(state.weeksLeft ?? 0);
    sub = `by ${fmtMonthDay(v.by)} · ${w === 1 ? '1 week' : `${w} weeks`} left`;
    if (state.verdict === 'ready') [tag, tone] = ['Ready', 'text-tip'];
    else if (state.behind) [tag, tone] = ['Behind', 'text-warn'];
    else if (state.verdict) [tag, tone] = ['On track', 'text-tip'];
    else [tag, tone] = ['Not sure', 'text-fg2'];
    if (goal.ownRate) sub += ' · your pace';
  } else if (state.verdict === 'ready') {
    sub = 'no date · your est. 1RM covers it';
    [tag, tone] = ['Ready', 'text-tip'];
  } else if (state.eta != null) {
    sub = `no date · ${etaText(state.eta)} at current pace`;
    [tag, tone] = [`Est. ${etaText(state.eta).slice(1)}`, 'text-fg'];
  } else {
    sub = 'no date · not moving toward it yet';
    [tag, tone] = ['No est.', 'text-fg3'];
  }
  return (
    <button type="button" onClick={() => navigate(`/progress/goal/${goal.id}`)} className="flex min-h-[60px] w-full items-center gap-3 border-b border-line py-1.5 text-left active:bg-surface/60">
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[16px] font-semibold">
          {exercise.name} <span className="tabular-nums">{fmtGoal(goal, exercise, units)}</span>
        </b>
        <span className="block truncate text-[13px] text-fg2 tabular-nums">{sub}</span>
      </span>
      <span className={cx('flex-none text-[11px] font-bold tracking-[0.06em] uppercase', tone)}>{tag}</span>
    </button>
  );
}

/** B2: the last 2 milestones reached and the next 3, with Ready and ETA. */
export function MilestoneList({ rows, exercise, units, onGoal }: { rows: MilestoneRow[]; exercise: Exercise; units: Units; onGoal?: (m: MilestoneRow) => void }) {
  const label = (m: MilestoneRow) =>
    m.weight == null ? `${m.reps} reps` : exercise.type === 'assisted' ? (m.weight === 0 ? `Bodyweight × ${m.reps}` : `−${formatWeight(-m.weight, units)} × ${m.reps}`) : fmtGoal({ weight: m.weight, reps: m.reps }, exercise, units);
  return (
    <div>
      {rows.map((m) => (
        <div key={`${m.weight}-${m.reps}`} className="flex min-h-[52px] items-center gap-3 border-b border-line py-1.5">
          <span className={cx('w-5 flex-none text-center text-[14px] font-bold', m.state === 'done' ? 'text-tip' : m.state === 'ready' ? 'text-warn' : 'text-fg3')}>
            {m.state === 'done' ? '✓' : m.state === 'ready' ? '!' : '·'}
          </span>
          <span className="min-w-0 flex-1">
            <b className={cx('block text-[16px] font-semibold tabular-nums', m.state === 'done' && 'text-fg2')}>{label(m)}</b>
            <span className="block text-[13px] text-fg2 tabular-nums">
              {m.state === 'done'
                ? fmtMonthDay(m.date!)
                : m.state === 'ready'
                  ? 'est. 1RM covers it'
                  : m.state === 'eta'
                    ? `${etaText(m.weeks!)} at your pace`
                    : exercise.type === 'bodyweight'
                      ? 'not moving toward it yet'
                      : `needs est. ${fmtStrength(m.target, exercise, units)}`}
            </span>
          </span>
          {m.state === 'ready' && <span className="text-[11px] font-bold tracking-[0.06em] text-warn uppercase">Ready</span>}
          {m.state !== 'done' && m.state !== 'ready' && onGoal && m.weight != null && exercise.type !== 'assisted' && (
            <button type="button" onClick={() => onGoal(m)} className="flex h-11 flex-none items-center px-1 text-[14px] font-semibold text-accent active:opacity-60">
              Goal
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/** A tappable row with a chevron (trend, goal, month review links). */
export function NavRow({ title, detail, right, onClick, tone }: { title: React.ReactNode; detail?: React.ReactNode; right?: React.ReactNode; onClick: () => void; tone?: string }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-[56px] w-full items-center gap-3 border-b border-line py-1.5 text-left active:bg-surface/60">
      <span className="min-w-0 flex-1">
        <b className={cx('block truncate text-[16px] font-semibold', tone)}>{title}</b>
        {detail && <span className="block text-[13px] leading-snug text-fg2 tabular-nums">{detail}</span>}
      </span>
      {right && <span className="flex-none text-[14px] font-semibold tabular-nums">{right}</span>}
      <ChevronRight size={12} className="flex-none text-fg3" />
    </button>
  );
}
