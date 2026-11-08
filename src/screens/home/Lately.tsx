// Home "Lately" (training-logic §21, proposal D6). Screen 3.6. The only place trends show
// up uninvited: at most one goal line and one trend line, and nothing when nothing changed.

import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import { ChevronRight } from '../../components/icons';
import { cx, SectionLabel } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { goalView, useGoals } from '../../data/goals';
import { updateSettings } from '../../data/settings';
import { currentPhase, liftTraining } from '../../data/training';
import { DAY_MS, dayKey, startOfWeek } from '../../lib/dates';
import { markSeen, milestoneList, milestoneRows, pickLately, type LatelyCandidate } from '../../lib/training';
import { fmtGoal } from '../progress/TrainingViews';
import { usePinned } from '../progress/Progress';

interface Line extends LatelyCandidate {
  glyph: string;
  tone: string;
  text: string;
  to: string;
}

export function Lately({ now }: { now: number }) {
  const navigate = useNavigate();
  const { history, settings, exerciseMap } = useData();
  const focus = usePinned();
  const goals = useGoals();
  const units = settings.units;
  const today = dayKey(now);

  const candidates = useMemo<Line[] | undefined>(() => {
    if (!goals) return undefined;
    const out: Line[] = [];
    const week = dayKey(startOfWeek(now, settings.weekStart));
    for (const ex of focus) {
      if (ex.type === 'cardio') continue;
      const lift = liftTraining(history, ex, settings, now);
      const st = lift.trend.status;
      if (st === 'climbing' || st === 'slipping') {
        const before = liftTraining(history, ex, settings, now - 7 * DAY_MS).trend.status;
        if (before !== st) {
          const pct = Math.round(Math.abs(lift.trend.change ?? 0));
          out.push({
            key: `status:${ex.id}:${st}:${week}`,
            kind: 'status',
            weight: pct,
            glyph: st === 'climbing' ? '▲' : '▼',
            tone: st === 'climbing' ? 'text-tip' : 'text-warn',
            text: st === 'climbing' ? `${ex.name} is climbing · +${pct}% in 8 weeks` : `${ex.name} is slipping · see what changed`,
            to: `/progress/lift/${ex.id}/trend`,
          });
        }
      }
      {
        const sessions = history.sessionsByExercise.get(ex.id) ?? [];
        const sets = sessions.flatMap((s) => s.sets.filter((x) => x.kind === 'working' && x.reps != null).map((x) => ({ weight: x.weight, reps: x.reps!, date: s.date })));
        const ready = lift.points.length ? milestoneRows(milestoneList(ex.type, ex.equipment, units), sets, lift.now).find((m) => m.state === 'ready') : undefined;
        if (ready && ready.weight != null)
          out.push({
            key: `milestone:${ex.id}:${ready.weight}x${ready.reps}`,
            kind: 'milestone',
            glyph: '!',
            tone: 'text-warn',
            text: `${ex.name} ${fmtGoal({ weight: ready.weight, reps: ready.reps }, ex, units)} is ready · est. 1RM covers it`,
            to: `/progress/lift/${ex.id}/trend`,
          });
      }
    }
    for (const g of goals) {
      const lift = exerciseMap.get(g.exerciseId);
      if (!lift) continue;
      if (g.doneAt && now - g.doneAt < 7 * DAY_MS) {
        out.push({ key: `goalDone:${g.id}`, kind: 'goalDone', glyph: '✓', tone: 'text-tip', text: `${lift.name} ${fmtGoal(g, lift, units)} goal done`, to: `/progress/goal/${g.id}` });
        continue;
      }
      if (g.doneAt) continue;
      const v = goalView(g, lift, history, settings, now);
      if (v.state.behind) out.push({ key: `goalBehind:${g.id}`, kind: 'goalBehind', glyph: '◎', tone: 'text-warn', text: `${lift.name} ${fmtGoal(g, lift, units)} goal is behind · new dates to pick`, to: `/progress/goal/${g.id}` });
    }
    return out;
  }, [goals, focus, history, settings, units, now, exerciseMap]);

  // Frozen at first render with data, then remembered, so the same news never shows on two days.
  const shown = useRef<Line[] | null>(null);
  if (!shown.current && candidates) shown.current = pickLately(candidates, settings.latelySeen ?? [], today);
  const lines = shown.current ?? [];
  useEffect(() => {
    if (!lines.length) return;
    const next = markSeen(settings.latelySeen ?? [], lines, today);
    if (next !== (settings.latelySeen ?? [])) void updateSettings({ latelySeen: next });
  }, [lines.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // §20: a 21-day gap across every lift offers "Coming back" (until the next workout).
  const last = history.workouts[0]?.workout.startedAt;
  const gapDays = last ? Math.floor((now - last) / DAY_MS) : 0;
  const offerComeback = gapDays >= 21 && currentPhase(settings, now) === 'build';

  if (!lines.length && !offerComeback) return null;
  return (
    <>
      <SectionLabel>Lately</SectionLabel>
      {offerComeback && (
        <LatelyRow glyph="↺" tone="text-warn" text={`Back after ${Math.round(gapDays / 7)} weeks? Start lighter and ramp up`} onClick={() => navigate('/settings/phase')} />
      )}
      {lines.map((l) => (
        <LatelyRow key={l.key} glyph={l.glyph} tone={l.tone} text={l.text} onClick={() => navigate(l.to)} />
      ))}
    </>
  );
}

function LatelyRow({ glyph, tone, text, onClick }: { glyph: string; tone: string; text: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-[48px] w-full items-center gap-2.5 border-b border-line py-1.5 text-left active:bg-surface/60">
      <span className={cx('w-4 flex-none text-center text-[13px] font-bold', tone)}>{glyph}</span>
      <span className="min-w-0 flex-1 text-[14.5px] leading-snug tabular-nums">{text}</span>
      <ChevronRight size={12} className="flex-none text-fg3" />
    </button>
  );
}
