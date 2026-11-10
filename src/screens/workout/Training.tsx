// In-workout training (design/training-logic.html §9–§11, §23; proposal A1–A9).
// The bar under the exercise header, the Why sheet, the break question and the tip line.
// Screens 4.27–4.33.

import { Fragment, useMemo, useState } from 'react';
import { LiftChart } from '../../components/charts';
import { TrendDown, TrendUp } from '../../components/icons';
import { Sheet } from '../../components/overlays';
import { Button, ConfirmedBar, cx, OfferBar, Radio, Row, Segmented } from '../../components/ui';
import type { HistoryIndex } from '../../data/history';
import { liftSeries, sessionSets, type WorkoutTraining } from '../../data/training';
import type { Exercise, Settings, Units, WorkoutSuggestion } from '../../db/types';
import { DAY_MS, fmtMonthDay } from '../../lib/dates';
import { effortText, type EffortMode } from '../../lib/effort';
import { formatSetWeight } from '../../lib/sets';
import { suggest, TIP_TEXT, type Move, type RepRange, type TipId, type TSet } from '../../lib/training';
import { toDisplay } from '../../lib/units';

type Ready = Extract<WorkoutTraining, { kind: 'ready' }>;

const fmtW = (w: number | undefined, ex: Exercise, units: Units) => formatSetWeight(w, ex.type, units);
const rangeText = (r?: RepRange) => (!r ? '' : r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`);

/** "R0" / "@10" after a set, in the effort mode you track (RIR when effort is off). */
export function effortTag(rir: number | undefined, mode: EffortMode): string {
  if (rir == null) return '';
  return effortText(10 - rir, mode === 'off' ? 'rir' : mode);
}

export function setLine(s: TSet, ex: Exercise, units: Units, mode: EffortMode): string {
  const e = effortTag(s.rir, mode);
  return `${ex.type === 'bodyweight' ? 'BW' : fmtW(s.weight, ex, units)} × ${s.reps}${e ? ` ${e}` : ''}`;
}

/** "205 · 205 · 180": the next weights, sets that share a weight written once each. */
export function weightsLine(t: Ready, ex: Exercise, units: Units): string {
  return t.sg.weights.map((w) => fmtW(w, ex, units)).join(' · ');
}

/** What the bar says and how it looks, given the mode and what you've done with it (§9 tables). */
export type BarState = 'offer' | 'accepted' | 'auto' | 'none';

export function barState(t: WorkoutTraining, s: WorkoutSuggestion | undefined, settings: Settings, ex: Exercise): BarState {
  if (t.kind !== 'ready' || !t.sg.changed) return 'none';
  if (s?.outcome === 'dismissed') return 'none';
  if (s?.outcome === 'accepted') return 'accepted';
  if (s?.auto) return 'auto';
  if (t.hideBar && !t.comeback) return 'none';
  const autoOk = settings.suggestMode === 'auto' && !t.comeback && !settings.suggestOnlyIds?.includes(ex.id);
  return autoOk ? 'none' : 'offer';
}

function weeksText(days: number) {
  return days < 14 ? `${days} days` : `${Math.round(days / 7)} weeks`;
}

// ───────────────────────────── the bar (A1, A2, D5, Auto)

export function TrainingBar({
  t,
  state,
  exercise,
  units,
  onAccept,
  onDismiss,
  onUndo,
  onWhy,
}: {
  t: Ready;
  state: BarState;
  exercise: Exercise;
  units: Units;
  onAccept: () => void;
  onDismiss: () => void;
  onUndo: () => void;
  onWhy: () => void;
}) {
  const down = t.sg.lead === 'down';
  const line = weightsLine(t, exercise, units);
  if (state === 'accepted')
    return (
      <ConfirmedBar tone={down ? 'warn' : 'tip'} onUndo={onUndo}>
        Using the suggested weights
      </ConfirmedBar>
    );
  let title: string;
  let sub: string;
  const cb = t.comeback;
  if (cb && cb.index === 0) {
    title = `Start at ${fmtW(t.sg.weights[0], exercise, units)}`;
    sub = `${weeksText(cb.days)} off · ${Math.round(cb.pct * 100)}% · back to ${fmtW(cb.ramp[cb.ramp.length - 1], exercise, units)} in ${cb.ramp.length - 1} sessions`;
  } else if (cb) {
    title = `Ramp: ${line}`;
    const left = cb.ramp.length - 1 - cb.index;
    sub = left > 0 ? `back after a break · ${fmtW(cb.ramp[cb.ramp.length - 1], exercise, units)} in ${left} ${left === 1 ? 'session' : 'sessions'}` : 'back after a break · last ramp session';
  } else if (state === 'auto') {
    title = 'Weights set for you';
    sub = `${line} from last session`;
  } else {
    // The numbers are in the Previous → Next column; the bar only asks.
    title = 'Use suggested weights?';
    sub = t.sg.reason + (t.sg.bigStep ? ' · big step' : '');
  }
  return (
    <OfferBar
      title={title}
      tone={down ? 'warn' : 'tip'}
      trend={state === 'auto' ? undefined : down ? 'down' : 'up'}
      reason={sub}
      onWhy={onWhy}
      onDismiss={state === 'offer' ? onDismiss : undefined}
      dismissLabel="Dismiss suggestion"
      onAccept={state === 'offer' ? onAccept : undefined}
      acceptLabel={`Use ${line}`}
    />
  );
}

// ───────────────────────────── break or missed logs? (§11)

export function GapPrompt({
  t,
  exercise,
  units,
  onAnswer,
  onDismiss,
}: {
  t: Extract<WorkoutTraining, { kind: 'gap' }>;
  exercise: Exercise;
  units: Units;
  onAnswer: (a: 'break' | 'notLogged') => void;
  onDismiss: () => void;
}) {
  const weighted = t.lastWeight != null && exercise.type !== 'bodyweight';
  return (
    <div>
      <OfferBar
        title={`Back after ${weeksText(t.days)}?`}
        tone="warn"
        reason={`${exercise.name} was last logged ${fmtMonthDay(t.lastDate)}`}
        onDismiss={onDismiss}
        dismissLabel="Not now"
        line={false}
        className="pb-0"
      />
      <GapOption
        title="I took a break"
        detail={weighted && t.start != null ? `Start at ${fmtW(t.start, exercise, units)} (${Math.round(t.pct * 100)}%) and build back over 3 sessions` : 'Ease back in over 3 sessions'}
        onClick={() => onAnswer('break')}
      />
      <GapOption
        title="I trained, just didn't log"
        detail={weighted ? `Keep normal suggestions from ${fmtW(t.lastWeight, exercise, units)}` : 'Keep normal suggestions'}
        onClick={() => onAnswer('notLogged')}
      />
    </div>
  );
}

function GapOption({ title, detail, onClick }: { title: string; detail: string; onClick: () => void }) {
  return (
    <Row variant="two" onClick={onClick} className="active:bg-surface/60">
      <span className="min-w-0 flex-1">
        <b className="block text-body font-semibold">{title}</b>
        <span className="block text-caption text-fg2">{detail}</span>
      </span>
      <Radio on={false} />
    </Row>
  );
}

// ───────────────────────────── tip (A9, §23)

export function TipLine({ tip, onDismiss }: { tip: TipId; onDismiss: () => void }) {
  return <OfferBar kicker="Tip" onDismiss={onDismiss} dismissLabel="Dismiss tip for good">{TIP_TEXT[tip]}</OfferBar>;
}

// ───────────────────────────── Why sheet (A3, A4, A8)

const MOVE_TONE: Record<Move, string> = { up: 'text-tip', keep: 'text-fg2', down: 'text-warn' };
const MOVE_WORD: Record<Move, string> = { up: 'UP', keep: 'KEEP', down: 'DOWN' };

export function WhySheet({
  open,
  onClose,
  t,
  state,
  exercise,
  history,
  settings,
  at,
  onUse,
  onIgnore,
  onSuggestOnly,
}: {
  open: boolean;
  onClose: () => void;
  t: Ready;
  state: BarState;
  exercise: Exercise;
  history: HistoryIndex;
  settings: Settings;
  at: number;
  onUse: () => void;
  onIgnore: () => void;
  onSuggestOnly: () => void;
}) {
  const [tab, setTab] = useState<'sets' | 'weeks'>('sets');
  const units = settings.units;
  const mode = settings.effort;
  const first = t.sg.weights.find((w, i) => w != null && t.sg.moves[i] !== 'keep') ?? t.sg.weights[0];
  const r0 = t.sg.ranges[0];
  const title = t.sg.changed && first != null ? `Why ${fmtW(first, exercise, units)}?` : 'Why these numbers?';
  const [tl, th] = settings.effortTarget;
  const targetText = `${tl}–${th} RIR`;

  // Recent sessions, each labelled with the call it would have got (A3).
  const sessions = useMemo(() => {
    const past = (history.sessionsByExercise.get(exercise.id) ?? []).filter((s) => s.date < at).slice(0, 3);
    return past.map((s) => {
      const sets = sessionSets(s);
      const ranges = s.sets.filter((x) => x.kind === 'working').map((x) => (x.repsMin != null || x.repsMax != null ? { min: x.repsMin ?? x.repsMax!, max: x.repsMax ?? x.repsMin! } : (t.sg.ranges[0] ?? undefined)));
      const call = sets.length ? suggest({ type: exercise.type, last: sets, ranges, step: t.step, target: settings.effortTarget, lastSetOnly: settings.failureLastSetOnly }) : null;
      return { s, sets, call: call?.lead };
    });
  }, [history, exercise, at, t, settings.effortTarget, settings.failureLastSetOnly]);

  const series = useMemo(() => liftSeries(history, exercise, at).filter((p) => p.date >= at - 42 * DAY_MS), [history, exercise, at]);
  const set1 = useMemo(
    () =>
      (history.sessionsByExercise.get(exercise.id) ?? [])
        .filter((s) => s.date < at)
        .slice(0, 6)
        .reverse()
        .map((s) => ({ date: s.date, set: sessionSets(s)[0] }))
        .filter((x) => x.set),
    [history, exercise, at],
  );

  const explain = (() => {
    const cb = t.comeback;
    if (cb) return `${cb.days} days off, so the usual rules wait. Start at ${Math.round(cb.pct * 100)}% and ramp back: ${cb.ramp.map((w) => fmtW(w, exercise, units)).join(' → ')}. These sessions stay out of your trend.`;
    if (t.sg.mode === 'reps') return exercise.type === 'bodyweight' ? 'Bodyweight lifts move in reps. Sets with reps left, or every set at the top, get one more rep.' : 'No rep range on this routine yet, so the app only asks you to beat last time by a rep where you had some left.';
    if (t.sg.mode === 'steps') return `Each set moves one step at a time: up when it topped out ${rangeText(r0)} at ${targetText}, down when it fell under the range at failure.`;
    return `Each set is judged on its own: the weight that lands it in ${rangeText(r0)} reps with ${targetText} left. Set 1 leads; later sets share its weight when it still fits them, and are never heavier.`;
  })();

  const footer =
    state === 'offer' ? (
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button kind="secondary" onClick={onClose}>
          Ignore
        </Button>
        <Button onClick={onUse}>
          Use {first != null ? fmtW(first, exercise, units) : 'these'}
        </Button>
      </div>
    ) : state === 'auto' ? (
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button kind="secondary" onClick={onIgnore}>
          Ignore
        </Button>
        <Button onClick={onClose}>
          Keep
        </Button>
      </div>
    ) : (
      <Button kind="secondary" className="mt-5" onClick={onClose}>
        Close
      </Button>
    );

  return (
    <Sheet open={open} onClose={onClose} title={title} subtitle={`${exercise.name}${r0 ? ` · ${rangeText(r0)} reps` : ''}`} tall>
      <Segmented
        className="mt-1"
        options={[
          { value: 'sets' as const, label: 'Sets' },
          { value: 'weeks' as const, label: 'Recent weeks' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'sets' ? (
        <>
          <p className="mt-3 text-footnote leading-snug text-fg2">{explain}</p>
          <div className="mt-2" role="table" aria-label="Next weights per set">
            {t.setIds.map((id, i) => {
              const last = t.sg.last[i];
              const fit = t.sg.decision?.fits[Math.min(i, (t.sg.decision?.fits.length ?? 1) - 1)];
              const r = t.sg.ranges[i];
              const w = t.sg.weights[i];
              const mv = t.sg.moves[i];
              const aim = t.sg.aims[i];
              const where = last && r ? (last.reps > r.max ? `past ${r.max}` : last.reps < r.min ? `${r.min - last.reps} under` : 'in range') : '';
              return (
                <div key={id} role="row" className="grid min-h-[50px] grid-cols-[44px_1fr_auto] items-center gap-2 border-b border-line py-1.5">
                  <span className="text-footnote font-bold text-fg2">Set {i + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-callout">{last ? setLine(last, exercise, units, mode) : '—'}</span>
                    <span className="block truncate text-caption text-fg2">
                      {[where, fit && !t.comeback ? `zone ${fmtW(Math.round(fit.zone[0]), exercise, units)}–${fmtW(Math.round(fit.zone[1]), exercise, units)}` : '', aim != null ? `aim ${aim}` : ''].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className={cx('text-right text-body font-bold', MOVE_TONE[mv])}>
                    {w != null ? (
                      <span className="inline-flex items-center gap-1">
                        {mv === 'up' ? <TrendUp size={10} /> : mv === 'down' ? <TrendDown size={10} /> : '='} {fmtW(w, exercise, units)}
                      </span>
                    ) : aim != null ? (
                      `${aim} reps`
                    ) : (
                      '='
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          {sessions.length > 0 && <div className="mt-4 text-caps text-fg2">Last sessions</div>}
          {sessions.map(({ s, sets, call }) => {
            const d = new Date(s.date);
            return (
              <div key={s.workoutId} className="grid grid-cols-[38px_1fr_auto] items-start gap-2 border-b border-line py-2">
                <span className="text-center leading-[1.1]">
                  <small className="block text-micro font-bold text-fg2 uppercase">{fmtMonthDay(s.date).split(' ')[0]}</small>
                  <b className="text-body-lg">{d.getDate()}</b>
                </span>
                <span className="text-footnote leading-snug">
                  {sets.map((x, j) => (
                    <Fragment key={j}>
                      {j > 0 && <span className="text-fg3"> · </span>}
                      <span className={cx('whitespace-nowrap', j === 0 && 'font-bold')}>{setLine(x, exercise, units, mode)}</span>
                    </Fragment>
                  ))}
                </span>
                {call ? <span className={cx('pt-0.5 text-caps normal-case tracking-normal font-bold', MOVE_TONE[call])}>{MOVE_WORD[call]}</span> : <span />}
              </div>
            );
          })}
          {t.autoMisses && (
            <div className="mt-4 border-l-2 border-warn pl-3">
              <p className="text-footnote leading-snug">Auto keeps missing here: you changed the weights in each of the last 3 sessions.</p>
              <button type="button" onClick={onSuggestOnly} className="flex h-11 items-center text-body font-semibold text-accent">
                Switch this lift to Suggest
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mt-4 text-caps text-fg2">Est. 1RM · last 6 weeks</div>
          {series.length > 1 ? (
            <LiftChart points={series.map((p) => ({ date: p.date, value: exercise.type === 'bodyweight' ? p.value : toDisplay(p.value, units) }))} from={at - 42 * DAY_MS} to={at} height={150} />
          ) : (
            <p className="py-6 text-footnote text-fg2">Not enough sessions in the last 6 weeks for a line.</p>
          )}
          {set1.length > 0 && (
            <>
              <div className="mt-4 text-caps text-fg2">Set 1 reps{r0 ? ` · range ${rangeText(r0)}` : ''}</div>
              <div className="mt-2 flex h-27.5 items-end gap-2">
                {set1.map(({ date, set }) => {
                  const inR = r0 ? set.reps >= r0.min && set.reps <= r0.max : false;
                  const max = Math.max(...set1.map((x) => x.set.reps), r0?.max ?? 0);
                  return (
                    <div key={date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                      <i className={cx('w-full max-w-[34px] rounded-t-xs', inR ? 'bg-tip' : 'bg-[var(--og-bar)]')} style={{ height: `${Math.max(6, (set.reps / max) * 70)}px` }} />
                      <b className="text-caption">{set.reps}</b>
                      <small className="truncate text-micro text-fg2">{fmtW(set.weight, exercise, units)}</small>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-footnote leading-snug text-fg2">Set 1 counts most because it's the freshest. Bars turn green once they're in range.</p>
            </>
          )}
        </>
      )}
      {footer}
    </Sheet>
  );
}
