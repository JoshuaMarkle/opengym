import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { CheckGlyph, ChevronLeft, ChevronRight } from '../../components/icons';
import { cx, LabelAction, Note, SectionLabel, StartPill, StatRow } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { workoutLine, type HistoryWorkout } from '../../data/history';
import { skipMissed, usePlanView } from '../../data/schedule';
import type { Folder } from '../../db/types';
import { useStartWorkout } from '../../hooks/StartWorkout';
import { useNow } from '../../hooks/useNow';
import { addDays, addMonths, dayKey, fmtDay, fmtDuration, fmtMonthYear, startOfMonth, weekdayLetter } from '../../lib/dates';
import { currentStreak } from '../../lib/historyStats';
import { onPlan, routineCodes, weekOrder, type PlanDay } from '../../lib/schedule';
import { ChangedDayOutline, DaySheet } from './PlanParts';

// PH3.2, PH3.3, PH3.7–PH3.9: Dates adds a brighter planned code below uncompleted days; codes describe the plan; dots count actual sessions. Completed days have no fill, planned days have no border, and dots sit close beneath dates. Today keeps a foreground outline when unselected.
const memory: { day?: string; codes: boolean } = { codes: false };
export function PlanHistoryCalendar({ folder, month, onMonthChange }: { folder?: Folder; month: number; onMonthChange: (month: number) => void }) {
  const { history, settings } = useData();
  const [params] = useSearchParams();
  const requested = params.get('day');
  const requestedTs = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? new Date(requested + 'T12:00').getTime() : undefined;
  const now = useNow(60_000);
  const today = dayKey(now);
  const navigate = useNavigate();
  const start = useStartWorkout();
  const [selected, setSelected] = useState(requestedTs ? requested! : (memory.day ?? today));
  const [codes, setCodes] = useState(memory.codes);
  const [sheetDay, setSheetDay] = useState<PlanDay | null>(null);
  // Include the next week so moves/swaps at the end of a month have targets.
  const end = addDays(addMonths(month, 1), -1);
  const view = usePlanView(folder, dayKey(month), dayKey(addDays(end, 7)));
  const byDay = useMemo(() => {
    const map = new Map<string, HistoryWorkout[]>();
    for (const w of history.workouts) {
      const key = dayKey(w.workout.startedAt);
      map.set(key, [...(map.get(key) ?? []), w]);
    }
    return map;
  }, [history]);
  if (!view) return null;
  const planned = new Map(view.days.map((d) => [d.key, d]));
  const days: PlanDay[] = [];
  for (let ts = month; ts <= end; ts = addDays(ts, 1)) {
    const key = dayKey(ts);
    days.push(planned.get(key) ?? { key, ts, state: byDay.has(key) ? 'extra' : 'off', changed: false, doneIds: [] });
  }
  const sel = days.find((d) => d.key === selected) ?? days.find((d) => d.key === today) ?? days[0];
  const workouts = byDay.get(sel.key) ?? [];
  const counts = onPlan(days.filter((d) => d.key <= today));
  const logged = days.reduce((n, d) => n + (byDay.get(d.key)?.length ?? 0), 0);
  const changeMonth = (m: number) => {
    onMonthChange(m);
  };
  const select = (d: PlanDay) => {
    // PH3.15: tap once to focus; tap the focused editable day again to change it.
    if (d.key === sel.key && folder && view.scheduled && d.key >= today && d.state !== 'off') {
      setSheetDay(d);
      return;
    }
    memory.day = d.key;
    setSelected(d.key);
  };
  const canChange = !!folder && view.scheduled && sel.key >= today && sel.state !== 'off';
  return (
    <div>
      <div className="mt-3 mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          disabled={month <= startOfMonth(Math.min(history.firstDate ?? now, now))}
          onClick={() => changeMonth(addMonths(month, -1))}
          className="-ml-2 flex h-11 w-11 items-center justify-center text-accent disabled:text-fg3"
        >
          <ChevronLeft size={12} />
        </button>
        <button
          type="button"
          aria-label="Back to today"
          onClick={() => {
            changeMonth(startOfMonth(now));
            setSelected(today);
            memory.day = today;
          }}
          className="h-11 text-[17px] font-bold"
        >
          {fmtMonthYear(month)}
        </button>
        <button
          type="button"
          aria-label="Next month"
          disabled={month >= addMonths(startOfMonth(now), 12)}
          onClick={() => changeMonth(addMonths(month, 1))}
          className="-mr-2 flex h-11 w-11 items-center justify-center text-accent disabled:text-fg3"
        >
          <ChevronRight size={12} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {weekOrder(settings.weekStart).map((w) => (
          <div key={w} className="pb-1 text-[11px] font-bold text-fg2">
            {weekdayLetter(w)}
          </div>
        ))}
        {Array.from({ length: (new Date(month).getDay() - settings.weekStart + 7) % 7 }, (_, i) => (
          <div key={i} />
        ))}
        {days.map((d) => {
          const sessions = byDay.get(d.key) ?? [];
          const count = sessions.length;
          // PH3.3: the largest logged session supplies the day's actual workout code.
          const primary = sessions.reduce<HistoryWorkout | undefined>((best, w) => !best || w.setCount > best.setCount ? w : best, undefined);
          const loggedCode = primary && (
            (primary.workout.routineId && view.codes.get(primary.workout.routineId)) ||
            routineCodes([{ id: primary.workout.id, name: primary.workout.name }]).get(primary.workout.id)
          );
          const isSel = d.key === sel.key;
          const isToday = d.key === today;
          return (
            <button
              key={d.key}
              type="button"
              aria-pressed={isSel}
              aria-current={isToday ? 'date' : undefined}
              aria-label={`${fmtDay(d.ts)}, ${d.planned ? 'planned ' + view.routineName(d.planned) : 'rest'}${count ? `, ${count} logged workout${count === 1 ? '' : 's'}` : ''}${d.state === 'missed' ? ', missed' : ''}${d.movedTo ? ', moved to ' + d.movedTo : d.movedFrom ? ', moved from ' + d.movedFrom : d.changed ? ', changed' : ''}`}
              onClick={() => select(d)}
              className={cx(
                'relative flex h-11 min-w-0 flex-col items-center rounded-[9px] pt-[7px] text-[14px] font-semibold',
                isSel ? 'bg-accent text-white' : count ? 'text-fg' : 'text-fg2',
                !isSel && !isToday && d.state === 'missed' && 'ring-1 ring-inset ring-warn',
                !isSel && isToday && 'ring-[1.5px] ring-inset ring-accent',
              )}
            >
              {/* PH3.10: changed days match the routine editor; selection hides the dashed outline. */}
              {d.changed && !isSel && <ChangedDayOutline />}
              <span className={cx('leading-[18px]', isSel ? 'text-white' : codes && count ? 'text-fg' : !codes && isToday ? 'text-fg' : !d.planned && !count ? 'text-fg3' : isToday && 'text-fg')}>
                {codes ? (loggedCode ?? (d.planned ? view.codes.get(d.planned) : '-')) : new Date(d.ts).getDate()}
              </span>
              <span className="flex h-3 max-w-full items-center justify-center gap-[2px]">
                {!codes && d.planned && !count && (
                  <span className={cx('truncate px-1 text-[10px] leading-[12px]', !isSel && 'text-plan-code')}>
                    {view.codes.get(d.planned)}
                  </span>
                )}
                {Array.from({ length: count }, (_, i) => (
                  <i key={i} className={cx('h-1 w-1 rounded-full', isSel ? 'bg-white' : 'bg-accent')} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex min-h-11 items-center justify-between gap-1">
        <div className="flex items-center gap-2 text-[10px] leading-none text-fg2">
          <span className="flex items-center gap-1">
            <i className="h-2.5 w-2.5 rounded-[3px] border border-warn" />
            <span className="translate-y-px">Missed</span>
          </span>
          <span className="flex items-center gap-1">
            <i className="h-1 w-1 rounded-full bg-accent" />
            <span className="translate-y-px">Workout</span>
          </span>
          <span className="flex items-center gap-1">
            <i className="h-2.5 w-2.5 rounded-[3px] border border-dashed border-fg2" />
            <span className="translate-y-px">Changed</span>
          </span>
        </div>
        <div className="flex" aria-label="Day labels">
          {[false, true].map((v) => (
            <button
              key={String(v)}
              type="button"
              aria-pressed={codes === v}
              onClick={() => {
                memory.codes = v;
                setCodes(v);
              }}
              className={cx('h-11 px-2 text-[12px]', codes === v ? 'font-bold text-fg underline underline-offset-4' : 'text-fg2')}
            >
              {v ? 'Codes' : 'Dates'}
            </button>
          ))}
        </div>
      </div>
      {month <= startOfMonth(now) && (
        <StatRow
          className="mt-3"
          items={[
            { label: 'On plan', value: counts.due ? `${counts.done} of ${counts.due}` : '—' },
            { label: 'Workouts', value: logged },
            {
              label: 'Streak',
              value: `${currentStreak(
                history.workouts.map((w) => w.workout.startedAt),
                settings.weekStart,
                now,
              )} wks`,
            },
          ]}
        />
      )}
      <SectionLabel action={canChange && <LabelAction onClick={() => setSheetDay(sel)}>Change this day ›</LabelAction>}>
        {fmtDay(sel.ts)}
        {sel.state === 'missed' ? ' · Missed' : sel.key === today ? ' · Today' : ''}
      </SectionLabel>
      {workouts.map((w) => (
        <WorkoutRow key={w.workout.id} w={w} />
      ))}
      {!!sel.planned && !workouts.length && (
        <div className="flex min-h-[56px] items-center gap-3 border-b border-line">
          <button type="button" onClick={() => navigate(`/routine/${sel.planned}`)} className="min-h-11 min-w-0 flex-1 text-left">
            <b className="block text-[16px] font-semibold">{view.routineName(sel.planned)}</b>
            <span className="text-[13px] text-fg2">
              {view.plans.exercisesByRoutine.get(sel.planned)?.length ?? 0} exercises · {sel.state === 'missed' ? 'Planned, not logged' : 'Planned'}
            </span>
          </button>
          {sel.key === today ? (
            <StartPill label={`Start ${view.routineName(sel.planned)} today`} onClick={() => start.startRoutine(sel.planned!, view.routineName(sel.planned))} />
          ) : (
            <ChevronRight size={13} className="text-fg3" />
          )}
        </div>
      )}
      {!workouts.length && !sel.planned && (
        <p className="border-b border-line py-3.5 text-[13px] text-fg2">{sel.state === 'moved' ? `Moved to ${sel.movedTo}.` : sel.key < today ? 'Nothing logged.' : 'Rest · No workout planned.'}</p>
      )}
      {sel.state === 'missed' && sel.planned && folder && (
        <div className="mt-3 border-l-2 border-warn pl-3 text-[13px] text-fg2">
          <p>{folder.schedule?.skipped?.includes(sel.key) ? 'Kept skipped. Your next workout is unchanged.' : 'Planned workout was not logged. Your schedule continues.'}</p>
          <div className="flex gap-4">
            <button type="button" onClick={() => start.startRoutine(sel.planned!, view.routineName(sel.planned), sel.key)} className="min-h-11 font-semibold text-accent">
              Log it late
            </button>
            {!folder.schedule?.skipped?.includes(sel.key) && (
              <button type="button" onClick={() => void skipMissed(folder.id, sel.key)} className="min-h-11 text-accent">
                Keep skipped
              </button>
            )}
          </div>
        </div>
      )}
      {!view.scheduled && <Note className="mt-4">Give a folder a schedule to see what's planned.</Note>}
      {sheetDay && folder && <DaySheet folder={folder} day={sheetDay} view={view} onClose={() => setSheetDay(null)} />}
    </div>
  );
}

function WorkoutRow({ w }: { w: HistoryWorkout }) {
  const navigate = useNavigate();
  const { exerciseMap } = useData();
  return (
    <button type="button" onClick={() => navigate(`/history/${w.workout.id}`)} className="flex min-h-[56px] w-full items-center gap-3 border-b border-line text-left active:bg-surface/60">
      <CheckGlyph size={16} className="flex-none text-accent" />
      <span className="min-w-0 flex-1 py-2">
        <b className="block truncate text-[16px] font-semibold">{w.workout.name}</b>
        <span className="block truncate text-[13px] text-fg2">
          {w.workout.endedAt ? `${fmtDuration(w.workout.endedAt - w.workout.startedAt)} · ` : ''}
          {workoutLine(w, (id) => exerciseMap.get(id)?.type, false)}
        </span>
      </span>
      <ChevronRight size={13} className="flex-none text-fg3" />
    </button>
  );
}
