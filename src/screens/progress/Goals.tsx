// Goals (training-logic §17–§18, proposal C1–C7). Screens 7.15–7.18 and the goal-done
// block on Summary (5.5). A goal is weight × reps on one lift, optionally by a date; it
// converts to an est. 1RM target so every set counts toward it.

import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { ForecastChart, type ChartPoint, type ForecastBand } from '../../components/charts';
import { CheckGlyph, MoreGlyph, TargetGlyph } from '../../components/icons';
import { Alert, Sheet, SheetOption } from '../../components/overlays';
import { BackButton, BarButton, Button, ChoiceTile, cx, EmptyState, fieldClass, FieldLabel, GoalBar, IconButton, Note, Screen, SectionLabel, Segmented, StatRow, TopBar, ValueBox } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { addGoal, canHaveGoal, deleteGoal, goalTargetOf, goalTrend, goalView, updateGoal, useGoals, type GoalView } from '../../data/goals';
import { liftTraining, type LiftTraining } from '../../data/training';
import type { Exercise, Units } from '../../db/types';
import { addMonths, fmtMonthDay, startOfMonth } from '../../lib/dates';
import {
  defaultStep,
  etaWeeks,
  likelyWeight,
  MONTH_DAYS,
  neededPerWeek,
  project,
  projectFast,
  projectSlow,
  rateLabel,
  verdict as verdictFor,
  wAt,
  WEEK,
  type TrendNow,
  type Verdict,
} from '../../lib/training';
import { formatNumber, fromDisplay, toDisplay, unitLabel } from '../../lib/units';
import { usePinned } from './Progress';
import { etaText, fmtGoal, fmtRate, fmtStrength, GoalRow, strengthNumber, VerdictTag, VERDICT_TONE } from './TrainingViews';

// ───────────────────────────── chart data

/** History dots, the projected curve and its slow–fast band, all in display units. */
function forecast(lift: LiftTraining, t: TrendNow, ex: Exercise, units: Units, untilWeeks: number, now = Date.now()) {
  const from = now - 12 * WEEK;
  const pts: ChartPoint[] = lift.points.filter((p) => p.date >= from && !p.comeback).map((p) => ({ date: p.date, value: strengthNumber(p.value, ex, units) }));
  const end = now + Math.max(8, untilWeeks) * WEEK;
  if (!t.canProject) return { pts, from, to: now + WEEK, curve: undefined, band: undefined };
  const steps = 24;
  const weeks = (end - now) / WEEK;
  const curve: ChartPoint[] = [];
  const band: ForecastBand[] = [];
  for (let i = 0; i <= steps; i++) {
    const w = (weeks * i) / steps;
    const date = now + w * WEEK;
    curve.push({ date, value: strengthNumber(project(t.E0, t.r0, t.tau, w), ex, units) });
    band.push({ date, lo: strengthNumber(projectSlow(t.E0, t.r0, t.tau, w), ex, units), hi: strengthNumber(projectFast(t.E0, t.r0, t.tau, w), ex, units) });
  }
  return { pts, from, to: end, curve, band };
}

const weeksTo = (date: number, now = Date.now()) => (date - now) / WEEK;

// ───────────────────────────── list (C7)

export function GoalsList({ views, loading, units }: { views: GoalView[]; loading: boolean; units: Units }) {
  const navigate = useNavigate();
  if (loading) return null;
  if (!views.length)
    return (
      <EmptyState icon={<TargetGlyph />} title="No goals yet" className="pt-20">
        A goal is a weight × reps on one lift, with or without a date. Every set counts toward it.
        <Button className="mt-5" onClick={() => navigate('/progress/goal/new')}>
          New goal
        </Button>
      </EmptyState>
    );
  return (
    <div className="mt-3">
      {views.map((v) => (
        <GoalRow key={v.goal.id} v={v} units={units} />
      ))}
    </div>
  );
}

// ───────────────────────────── new goal (C1, C2, C3)

/** C3: pace choices as multiples of the lift's own pace, one per label (slow, typical, focused, rare). */
const RATE_MULTIPLES = [0.4, 1, 2, 3.5];
const niceRate = (x: number) => (x >= 1 ? Math.round(x * 2) / 2 : x >= 0.1 ? Math.round(x * 10) / 10 : Math.max(0.01, Math.round(x * 100) / 100));
const RATE_WORD = { slow: 'slow', typical: 'typical', focused: 'focused', rare: 'rare' } as const;

/** 7.15 / 7.16: new goal. The projection redraws as you pick a date; messy data picks a pace instead. */
export function NewGoal() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { history, settings, exerciseMap, exercises } = useData();
  const units = settings.units;
  const focus = usePinned();
  const lifts = useMemo(() => {
    const seen = new Set<string>();
    const out: Exercise[] = [];
    for (const e of [...focus, ...exercises.filter((x) => (history.sessionsByExercise.get(x.id)?.length ?? 0) > 0)]) {
      if (seen.has(e.id) || !canHaveGoal(e) || e.deletedAt) continue;
      seen.add(e.id);
      out.push(e);
    }
    return out;
  }, [focus, exercises, history]);
  const [exId, setExId] = useState(params.get('ex') ?? lifts[0]?.id ?? '');
  const ex = exerciseMap.get(exId);
  const lift = useMemo(() => (ex ? liftTraining(history, ex, settings) : undefined), [ex, history, settings]);
  const [weightText, setWeightText] = useState(() => {
    const w = Number(params.get('w'));
    return w ? formatNumber(toDisplay(w, units), 1) : '';
  });
  const [repsText, setRepsText] = useState(params.get('r') ?? '5');
  const now = useMemo(() => Date.now(), []);
  const dated = useMemo(() => [2, 4, 6, 9].map((m) => addMonths(startOfMonth(now), m)), [now]);
  const [by, setBy] = useState<number | null>(() => {
    const b = Number(params.get('by'));
    return b || dated[2];
  });
  const [customOpen, setCustomOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [rateIdx, setRateIdx] = useState(1);

  const weight = ex?.type === 'bodyweight' ? 0 : fromDisplay(Number(weightText.replace(',', '.')) || 0, units);
  const reps = Math.round(Number(repsText) || 0);
  const valid = !!ex && reps > 0 && reps <= 30 && (ex.type === 'bodyweight' || weight > 0);
  const target = ex && valid ? goalTargetOf(ex, weight, reps) : undefined;
  const messy = !!lift && !lift.now.canProject;
  // A lift going nowhere has no pace of its own to compare with: use the typical one for its kind.
  const paceRate = lift ? ((Math.max(lift.pace, lift.prior) / 100) * Math.abs(lift.now.E0)) / (MONTH_DAYS / 7) : 0;
  const toShown = (perWeek: number) => (ex?.type === 'bodyweight' ? perWeek : toDisplay(perWeek, units));
  const fromShown = (shown: number) => (ex?.type === 'bodyweight' ? shown : fromDisplay(shown, units));
  const rateOptions = RATE_MULTIPLES.map((k) => niceRate(toShown(k * paceRate)));
  const ownRate = fromShown(rateOptions[rateIdx]);
  const t: TrendNow | undefined = lift && (messy ? { ...lift.now, r0: ownRate, canProject: lift.points.length > 0 } : lift.now);

  const verdictAt = (date: number): Verdict | undefined => (t && target != null && t.canProject && !messy ? verdictFor(t.E0, t.r0, t.tau, target, weeksTo(date, now)) : undefined);
  const eta = t && target != null && t.canProject ? etaWeeks(t.E0, t.r0, t.tau, target) : null;
  const span = Math.max(by ? weeksTo(by, now) : 0, eta ?? 26) + 2;
  const fc = lift && ex && t ? forecast(lift, t, ex, units, Math.min(104, span), now) : undefined;

  const save = async () => {
    if (!ex || !lift || !valid) return;
    const id = await addGoal({
      exerciseId: ex.id,
      weight,
      reps,
      by: by ?? undefined,
      startE1rm: lift.now.E0,
      startedAt: Date.now(),
      startRate: messy ? ownRate : lift.now.r0,
      startTau: lift.now.tau,
      ownRate: messy || undefined,
    });
    navigate(`/progress/goal/${id}`, { replace: true });
  };
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/progress'));

  let sentence: React.ReactNode = null;
  if (ex && lift && target != null && t) {
    const v = by ? verdictAt(by) : undefined;
    if (t.E0 >= target) sentence = <>Ready now: your est. 1RM already covers it. Try it next session.</>;
    else if (messy && by) {
      const need = neededPerWeek(t.E0, target, weeksTo(by, now));
      sentence = (
        <>
          {fmtMonthDay(by)} would need {fmtRate(need, ex, units)}. {rateLabel(need, paceRate) === 'rare' ? 'Possible after a break or when you start training it hard. Rare otherwise.' : `That reads ${RATE_WORD[rateLabel(need, paceRate)]} for this lift.`}
        </>
      );
    } else if (v && by) {
      const need = neededPerWeek(t.E0, target, weeksTo(by, now));
      sentence = (
        <>
          <b className={VERDICT_TONE[v]}>{v === 'likely' ? 'Likely' : v === 'stretch' ? 'Stretch' : 'Unlikely'}.</b> Needs {fmtRate(need, ex, units).replace('+', '')}, you're doing {fmtRate(t.r0, ex, units).replace('+', '')}.
          {eta != null && <> Earliest likely {fmtMonthDay(now + eta * WEEK)}.</>}
        </>
      );
    } else if (!by) sentence = eta != null ? <>No deadline. At your pace, {etaText(eta, now)}.</> : <>No deadline. Not moving toward it yet, so no estimate.</>;
  }

  return (
    <Screen
      header={
        <TopBar
          left={<BarButton onClick={back}>Cancel</BarButton>}
          title="New goal"
          right={
            <BarButton kind="bold" disabled={!valid} onClick={() => void save()}>
              Save
            </BarButton>
          }
        />
      }
    >
      {!lifts.length ? (
        <EmptyState icon={<TargetGlyph />} title="Nothing to aim at yet" className="pt-20">
          Log a lift first. Goals use its est. 1RM.
        </EmptyState>
      ) : (
        <>
          <button type="button" onClick={() => setPickOpen(true)} className="mt-2 flex min-h-[56px] w-full items-center justify-between gap-3 border-b border-line text-left active:bg-surface/60">
            <span className="min-w-0">
              <b className="block truncate text-[17px] font-semibold">{ex?.name ?? 'Pick a lift'}</b>
              {ex && lift && <span className="text-[13px] text-fg2 tabular-nums">{ex.type === 'bodyweight' ? 'reps' : 'est. 1RM'} {lift.points.length ? fmtStrength(lift.now.E0, ex, units) : '—'}</span>}
            </span>
            <span className="text-[15px] font-semibold text-accent">Change</span>
          </button>

          <div className="mt-1 grid grid-cols-2 gap-3">
            {ex?.type !== 'bodyweight' && (
              <div>
                <FieldLabel className="mt-3">{ex?.type === 'bodyweight_plus' ? `Added ${unitLabel(units)}` : unitLabel(units) === 'kg' ? 'KG' : 'LBS'}</FieldLabel>
                <ValueBox value={weightText} onChange={setWeightText} inputMode="decimal" placeholder="225" label="Goal weight" maxLength={6} />
              </div>
            )}
            <div>
              <FieldLabel className="mt-3">Reps</FieldLabel>
              <ValueBox value={repsText} onChange={setRepsText} inputMode="numeric" placeholder="5" label="Goal reps" maxLength={2} />
            </div>
          </div>

          <FieldLabel>By</FieldLabel>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <DateChip on={by === null} top="Estimate" label="No date" onClick={() => setBy(null)} />
            {dated.map((d) => {
              const v = verdictAt(d);
              return <DateChip key={d} on={by === d} top={v ? <VerdictTag v={v} small /> : '—'} label={fmtMonthDay(d)} onClick={() => setBy(d)} />;
            })}
            <DateChip
              on={by !== null && !dated.includes(by)}
              top={by !== null && !dated.includes(by) && verdictAt(by) ? <VerdictTag v={verdictAt(by)!} small /> : 'Pick'}
              label={by !== null && !dated.includes(by) ? fmtMonthDay(by) : 'Custom…'}
              onClick={() => setCustomOpen(true)}
            />
          </div>

          {messy && ex && lift && (
            <>
              <p className="mt-4 text-[14px] leading-snug">
                <b>No projection.</b> <span className="text-fg2">{lift.fit.reason ? `${lift.fit.reason}.` : 'Too few sessions to draw a line.'} A line through this would be a guess, so choose a pace instead.</span>
              </p>
              <FieldLabel>If you focus on it, you'll gain</FieldLabel>
              <Segmented
                className="mt-2"
                options={rateOptions.map((r, i) => ({ value: i, label: `${formatNumber(r, 2)}${i === 3 ? '+' : ''}` }))}
                value={rateIdx}
                onChange={setRateIdx}
              />
              <div className="mt-1 grid grid-cols-4 text-center text-[11px] text-fg2">
                {rateOptions.map((r, i) => (
                  <span key={i}>{RATE_WORD[rateLabel(fromShown(r), paceRate)]}</span>
                ))}
              </div>
              <p className="mt-2 text-[14px] tabular-nums">
                {formatNumber(rateOptions[rateIdx], 2)} {ex.type === 'bodyweight' ? 'reps' : unitLabel(units)}/wk → <b>{eta != null ? fmtMonthDay(now + eta * WEEK) : 'past 2 years'}</b>
              </p>
            </>
          )}

          {fc && ex && (
            <ForecastChart
              points={fc.pts}
              from={fc.from}
              to={fc.to}
              curve={fc.curve}
              band={messy ? undefined : fc.band}
              target={target != null ? strengthNumber(target, ex, units) : undefined}
              targetLabel={target != null && valid ? (ex.type === 'bodyweight' ? formatNumber(target, 0) : fmtGoal({ weight, reps }, ex, units)) : undefined}
              marker={by ?? undefined}
              markerTone={by && verdictAt(by) ? (verdictAt(by) === 'unlikely' ? 'warn' : 'tip') : 'fg2'}
              label="Goal projection"
            />
          )}
          {sentence && <p className="mt-3 text-[14px] leading-snug tabular-nums">{sentence}</p>}
          <Note className="mt-3">
            {ex?.type === 'bodyweight'
              ? 'Progress is counted in reps, so every set counts.'
              : `Every set counts toward ${valid && ex ? fmtGoal({ weight, reps }, ex, units) : 'the goal'}, not only attempts at the goal weight: each set's weight and reps feed one strength trend.`}{' '}
            Gains slow down over time, so the projection is a curve, with a band for good and bad stretches.
          </Note>
        </>
      )}

      <Sheet open={pickOpen} onClose={() => setPickOpen(false)} title="Lift" tall>
        {lifts.map((e) => (
          <SheetOption
            key={e.id}
            onClick={() => {
              setExId(e.id);
              setPickOpen(false);
            }}
            detail={e.id === exId ? <CheckGlyph size={15} className="text-accent" /> : undefined}
          >
            {e.name}
          </SheetOption>
        ))}
      </Sheet>
      <CustomDateSheet open={customOpen} onClose={() => setCustomOpen(false)} value={by ?? dated[2]} verdictAt={verdictAt} onPick={(d) => setBy(d)} />
    </Screen>
  );
}

function DateChip({ on, top, label, onClick }: { on: boolean; top: React.ReactNode; label: string; onClick: () => void }) {
  return <ChoiceTile on={on} label={top} value={label} onClick={onClick} />;
}

/** C2, simplified: the normal date picker, with the verdict for the date you land on. */
function CustomDateSheet({ open, onClose, value, verdictAt, onPick }: { open: boolean; onClose: () => void; value: number; verdictAt: (d: number) => Verdict | undefined; onPick: (d: number) => void }) {
  const [text, setText] = useState(() => isoDay(value));
  const d = fromIso(text);
  const v = d ? verdictAt(d) : undefined;
  return (
    <Sheet open={open} onClose={onClose} title="Pick a date">
      <input
        type="date"
        value={text}
        min={isoDay(Date.now() + 7 * 86_400_000)}
        onChange={(e) => setText(e.target.value)}
        aria-label="Goal date"
        className={cx(fieldClass, 'mt-1 font-semibold')}
      />
      <p className="mt-3 min-h-[20px] text-[14px]">{v ? <VerdictTag v={v} /> : <span className="text-fg2">No verdict without a projection.</span>}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button kind="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={!d || d <= Date.now()}
          onClick={() => {
            if (d) onPick(d);
            onClose();
          }}
        >
          {d ? `Use ${fmtMonthDay(d)}` : 'Use'}
        </Button>
      </div>
    </Sheet>
  );
}

const isoDay = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fromIso = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : undefined;
};

// ───────────────────────────── one goal (C4, C5)

/** 7.17 / 7.18: where a goal stands, and (when behind) new dates and targets to pick from. */
export function GoalDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { history, settings, exerciseMap } = useData();
  const goals = useGoals();
  const goal = goals?.find((g) => g.id === id);
  const ex = goal ? exerciseMap.get(goal.exerciseId) : undefined;
  const view = useMemo(() => (goal && ex ? goalView(goal, ex, history, settings) : undefined), [goal, ex, history, settings]);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [kept, setKept] = useState(false);
  const units = settings.units;
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/progress'));

  if (!goals) return null;
  if (!goal || !ex || !view)
    return (
      <Screen header={<TopBar left={<BackButton label="Progress" onClick={() => navigate('/progress')} />} />}>
        <EmptyState icon="?" title="Goal not found" className="pt-20" />
      </Screen>
    );

  const { state, lift } = view;
  const t = goalTrend(goal, lift.now);
  const now = Date.now();
  const num = (v: number) => formatNumber(Math.round(strengthNumber(v, ex, units)), 0);
  // The goal as you'd lift it (225 × 1), not its internal trend number, which reads like a different weight.
  const goalLabel = ex.type === 'bodyweight' ? `${goal.reps} reps` : fmtGoal(goal, ex, units);
  const step = defaultStep(ex.equipment, ex.type, settings.weightStep, units);

  let status: string;
  let tone: string;
  if (state.done) [status, tone] = [`Done ${fmtMonthDay(goal.doneAt!)}`, 'text-accent'];
  else if (state.verdict === 'ready') [status, tone] = ['Ready · your est. 1RM covers it', 'text-tip'];
  else if (state.behind) [status, tone] = [`Behind · at your pace, ${state.eta != null ? fmtMonthDay(now + state.eta * WEEK) : 'not moving toward it yet'}`, 'text-warn'];
  else if (!t.canProject) [status, tone] = ['Not sure yet · too few sessions for a projection', 'text-fg2'];
  else if (view.by == null) [status, tone] = [state.eta != null ? `No date · ${etaText(state.eta)} at your pace` : 'No date · not moving toward it yet', state.eta != null ? 'text-tip' : 'text-fg2'];
  else {
    const weeksAhead = t.r0 > 0 ? (t.E0 - state.tick) / t.r0 : 0;
    const w = Math.round(Math.abs(weeksAhead));
    [status, tone] = [w < 1 ? 'On track' : weeksAhead > 0 ? `On track · ${w === 1 ? '1 week' : `${w} weeks`} ahead` : 'On track · just behind the line', weeksAhead > -0.5 ? 'text-tip' : 'text-fg'];
  }

  // "This week": what the expected curve says to beat by the end of the week.
  const thisWeek = project(goal.startE1rm, goal.startRate, goal.startTau, (now + WEEK - goal.startedAt) / WEEK);
  const best = (history.sessionsByExercise.get(ex.id) ?? [])
    .filter((s) => s.date >= goal.startedAt)
    .flatMap((s) => s.sets.filter((x) => x.kind === 'working' && (x.reps ?? 0) >= goal.reps))
    .reduce<{ weight?: number; reps?: number } | undefined>((a, x) => (!a || (x.weight ?? 0) > (a.weight ?? 0) ? x : a), undefined);
  const fc = forecast(lift, t, ex, units, Math.min(104, Math.max(view.by ? weeksTo(view.by, now) : 0, state.eta ?? 20) + 2), now);
  const target = state.target;
  const testAt = state.eta != null && state.eta > 0 ? now + state.eta * WEEK : undefined;

  // C5: once behind, offer a later date, a lighter target, or keep it.
  const adjust =
    state.behind && view.by != null && !kept
      ? {
          later: state.eta != null ? startOfWeekDay(now + state.eta * WEEK) : undefined,
          lower: likelyWeight(t, goal.reps, weeksTo(view.by, now), step),
          need: neededPerWeek(t.E0, target, weeksTo(view.by, now)),
        }
      : undefined;

  return (
    <Screen
      header={
        <TopBar
          left={<BackButton label="Progress" onClick={back} />}
          title={`${ex.name} goal`}
          right={
            <IconButton label="Goal options" onClick={() => setMenu(true)}>
              <MoreGlyph size={16} />
            </IconButton>
          }
        />
      }
    >
      <div className="mt-4 text-caps text-fg2">Goal · {view.by != null ? `by ${fmtMonthDay(view.by)}` : 'no date'}</div>
      <div className="text-hero tabular-nums">{fmtGoal(goal, ex, units)}</div>
      <div className={cx('text-[15px] font-bold tabular-nums', tone)}>{status}</div>

      {!state.done && (
        <div className="mt-5">
          <GoalBar frac={state.progress} behind={state.behind} marker={view.by != null ? state.tickProgress : undefined} markerLabel="Where steady gains would put you today" />
          <div className="mt-2 grid grid-cols-3 text-[12.5px] text-fg2 tabular-nums">
            <span>
              Start {num(goal.startE1rm)} · {fmtMonthDay(goal.startedAt)}
            </span>
            <span className="text-center font-semibold text-fg">Now {num(t.E0)}</span>
            <span className="text-right">{goalLabel}</span>
          </div>
        </div>
      )}

      <StatRow
        className="mt-5"
        items={[
          { label: 'This week', value: view.by != null && !state.done ? `≥ ${num(thisWeek)}` : '—' },
          { label: 'Weeks left', value: state.weeksLeft != null && !state.done ? Math.round(state.weeksLeft) : '—' },
          { label: 'Best try', value: best?.weight != null || best?.reps != null ? fmtGoal({ weight: best.weight ?? 0, reps: best.reps ?? 0 }, ex, units) : '—' },
        ]}
      />

      <ForecastChart
        points={fc.pts}
        from={fc.from}
        to={fc.to}
        curve={state.done ? undefined : fc.curve}
        band={state.done ? undefined : fc.band}
        target={strengthNumber(target, ex, units)}
        targetLabel={goalLabel}
        marker={view.by}
        markerTone={state.behind ? 'warn' : 'tip'}
        label="Goal projection"
      />

      {adjust ? (
        <>
          <SectionLabel>Adjust</SectionLabel>
          {adjust.later && (
            <AdjustRow title={`Move to ${fmtMonthDay(adjust.later)}`} detail="Likely at your current pace" onClick={() => void updateGoal(goal.id, { by: adjust.later })} />
          )}
          {ex.type !== 'bodyweight' && adjust.lower > 0 && adjust.lower < goal.weight && (
            <AdjustRow
              title={`Lower to ${fmtGoal({ weight: adjust.lower, reps: goal.reps }, ex, units)} by ${fmtMonthDay(view.by!)}`}
              detail="Likely"
              onClick={() => void updateGoal(goal.id, { weight: adjust.lower })}
            />
          )}
          <AdjustRow title="Keep it" detail={`Needs ${fmtRate(adjust.need, ex, units)} · ${state.verdict === 'stretch' ? 'Stretch' : 'Unlikely'}`} onClick={() => setKept(true)} />
          <button type="button" onClick={() => navigate(`/progress/lift/${ex.id}/trend`)} className="flex h-11 items-center text-[15px] font-semibold text-accent">
            See {ex.name} trend ›
          </button>
        </>
      ) : (
        !state.done && (
          <>
            <SectionLabel>How to get there</SectionLabel>
            <p className="border-b border-line py-2.5 text-[14px] leading-snug">
              Follow the workout suggestions for {ex.name}. Every set counts: progress is measured in {ex.type === 'bodyweight' ? 'reps' : 'est. 1RM'}, not only attempts at {fmtGoal(goal, ex, units)}.
            </p>
            {testAt && (
              <p className="border-b border-line py-2.5 text-[14px] leading-snug tabular-nums">
                Test {fmtGoal(goal, ex, units)} around <b>{fmtMonthDay(testAt)}</b>, when your trend says you can lift it.
              </p>
            )}
            {state.verdict === 'ready' && <p className="border-b border-line py-2.5 text-[14px] leading-snug">Your est. 1RM already covers it. Try it at your next session.</p>}
            <Note className="mt-3">The white tick is where you'd be today if gains were steady from the day you set the goal. Ahead of it is green, behind it is orange.</Note>
          </>
        )
      )}

      <Sheet open={menu} onClose={() => setMenu(false)} title={`${ex.name} ${fmtGoal(goal, ex, units)}`}>
        <SheetOption
          onClick={() => {
            setMenu(false);
            navigate(`/progress/lift/${ex.id}/trend`);
          }}
        >
          {ex.name} trend
        </SheetOption>
        {view.by != null && !state.done && (
          <SheetOption
            onClick={() => {
              setMenu(false);
              void updateGoal(goal.id, { by: undefined });
            }}
          >
            Remove the date
          </SheetOption>
        )}
        <SheetOption
          tone="danger"
          onClick={() => {
            setMenu(false);
            setConfirm(true);
          }}
        >
          Delete goal
        </SheetOption>
      </Sheet>
      <Alert
        open={confirm}
        title="Delete this goal?"
        message="Your sets and records stay. Only the goal goes."
        onClose={() => setConfirm(false)}
        actions={[
          {
            label: 'Delete goal',
            kind: 'danger',
            onClick: async () => {
              setConfirm(false);
              await deleteGoal(goal.id);
              navigate('/progress', { replace: true });
            },
          },
          { label: 'Cancel', onClick: () => setConfirm(false) },
        ]}
      />
    </Screen>
  );
}

const startOfWeekDay = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

function AdjustRow({ title, detail, onClick }: { title: string; detail: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-[56px] w-full items-center justify-between gap-3 border-b border-line py-1.5 text-left active:bg-surface/60">
      <span className="min-w-0">
        <b className="block text-[16px] font-semibold tabular-nums">{title}</b>
        <span className="block text-[13px] text-fg2 tabular-nums">{detail}</span>
      </span>
      <span className="text-[15px] font-semibold text-accent">Use</span>
    </button>
  );
}

// ───────────────────────────── goal done (C6)

/** 5.5: shown once on the summary of the workout that hit a goal, with a Likely and a Stretch next step. */
export function GoalDoneBlock({ workoutId }: { workoutId: string }) {
  const navigate = useNavigate();
  const { history, settings, exerciseMap } = useData();
  const goals = useGoals();
  const goal = goals?.find((g) => g.doneWorkoutId === workoutId && !g.celebrated);
  const ex = goal ? exerciseMap.get(goal.exerciseId) : undefined;
  const lift = useMemo(() => (ex ? liftTraining(history, ex, settings) : undefined), [ex, history, settings]);
  if (!goal || !ex || !lift) return null;
  const units = settings.units;
  const now = Date.now();
  const early = goal.by != null ? Math.round((goal.by - goal.doneAt!) / WEEK) : 0;
  const by = addMonths(startOfMonth(now), 6);
  const weeks = weeksTo(by, now);
  const step = defaultStep(ex.equipment, ex.type, settings.weightStep, units);
  const t = lift.now;
  const next: { weight: number; reps: number; v: Verdict }[] = [];
  if (ex.type === 'bodyweight') {
    const likely = Math.max(goal.reps + 1, Math.floor(project(t.E0, t.r0, t.tau, weeks)));
    next.push({ weight: 0, reps: likely, v: 'likely' }, { weight: 0, reps: Math.max(likely + 1, Math.floor(projectFast(t.E0, t.r0, t.tau, weeks))), v: 'stretch' });
  } else if (t.canProject) {
    const likely = Math.max(goal.weight + step, likelyWeight(t, goal.reps, weeks, step));
    const stretch = Math.max(likely + step, Math.floor(wAt(projectFast(t.E0, t.r0, t.tau, weeks), 1, 0) / step) * step);
    next.push({ weight: likely, reps: goal.reps, v: verdictFor(t.E0, t.r0, t.tau, goalTargetOf(ex, likely, goal.reps), weeks) }, { weight: stretch, reps: 1, v: verdictFor(t.E0, t.r0, t.tau, goalTargetOf(ex, stretch, 1), weeks) });
  }
  const done = () => void updateGoal(goal.id, { celebrated: true });

  return (
    <div className="mt-5 border-y border-line py-3">
      <div className="text-[11px] font-bold tracking-[0.06em] text-tip uppercase">
        ✓ Goal done{early >= 1 ? ` · ${early === 1 ? '1 week' : `${early} weeks`} early` : ''}
      </div>
      <div className="text-[30px] leading-tight font-bold tracking-[-0.02em] tabular-nums">{fmtGoal(goal, ex, units)}</div>
      <p className="text-[14px] text-fg2 tabular-nums">
        {ex.name}, {fmtMonthDay(goal.doneAt!)}. {ex.type === 'bodyweight' ? 'Best' : 'Est. 1RM'} is now {fmtStrength(t.E0, ex, units)}.
      </p>
      {next.length > 0 && (
        <>
          <div className="mt-3 text-[11px] font-bold tracking-[0.06em] text-fg2 uppercase">Next goal?</div>
          {next.map((n) => (
            <button
              key={`${n.weight}-${n.reps}`}
              type="button"
              onClick={() => {
                done();
                navigate(`/progress/goal/new?ex=${ex.id}&w=${n.weight}&r=${n.reps}&by=${by}`);
              }}
              className="flex min-h-[52px] w-full items-center justify-between gap-3 border-b border-line text-left active:bg-surface/60"
            >
              <span>
                <b className="block text-[16px] font-semibold tabular-nums">
                  {fmtGoal(n, ex, units)} by {fmtMonthDay(by)}
                </b>
                <VerdictTag v={n.v} />
              </span>
              <span className="text-[15px] font-semibold text-accent">Set goal</span>
            </button>
          ))}
        </>
      )}
      <button type="button" onClick={done} className="flex h-11 w-full items-center justify-center text-[15px] font-semibold text-fg2">
        Not now
      </button>
    </div>
  );
}

