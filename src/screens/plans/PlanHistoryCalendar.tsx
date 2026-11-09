import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { CheckGlyph, ChevronRight } from '../../components/icons';
import { cx, LabelAction, Note, SectionLabel, Segmented, StatRow } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { workoutLine, type HistoryWorkout } from '../../data/history';
import { usePlanView, type PlanView } from '../../data/schedule';
import type { Folder } from '../../db/types';
import { useNow } from '../../hooks/useNow';
import {
  addDays,
  addMonths,
  dayKey,
  daysInMonth,
  fmtDay,
  fmtDuration,
  fmtMonthDay,
  fmtMonthYear,
  startOfMonth,
  startOfWeek,
  weekdayLetter,
  weekdayShort,
} from '../../lib/dates';
import { onPlan, weekOrder, type PlanDay } from '../../lib/schedule';
import { dayCode, DaySheet } from './PlanParts';

type Range = 'week' | 'month';

// Where you were, kept across visits to a workout and back (this session only).
const memory: { range: Range; month?: number; week?: number; day?: string } = { range: 'month' };

/** How far ahead the calendar goes: the plan only, so a year is plenty. */
const AHEAD_MONTHS = 12;

/**
 * 2.23 (prototype): History's calendar with the active plan drawn on it.
 * Past days show what you did (✓) or missed; today and later show what's planned.
 * Tap a day for its workouts or plan; from today on, "Change" edits just that day (2.21).
 */
export function PlanHistoryCalendar({ folder }: { folder?: Folder }) {
  const { history, settings } = useData();
  const now = useNow(60_000);
  const today = dayKey(now);
  const weekStart = settings.weekStart;

  const [range, setRangeState] = useState<Range>(memory.range);
  const [month, setMonthState] = useState(memory.month ?? startOfMonth(now));
  const [week, setWeekState] = useState(memory.week ?? startOfWeek(now, weekStart));
  const [selRaw, setSelState] = useState<string | undefined>(memory.day);
  const [sheetDay, setSheetDay] = useState<PlanDay | null>(null);

  const setRange = (r: Range) => {
    memory.range = r;
    setRangeState(r);
  };
  const setMonth = (m: number) => {
    memory.month = m;
    setMonthState(m);
  };
  const setWeek = (w: number) => {
    memory.week = w;
    setWeekState(w);
  };
  const setSel = (k: string) => {
    memory.day = k;
    setSelState(k);
  };

  const from = range === 'month' ? month : week;
  const to = range === 'month' ? addDays(addMonths(month, 1), -1) : addDays(week, 6);
  const view = usePlanView(folder, dayKey(from), dayKey(to));

  const byDay = useMemo(() => {
    const m = new Map<string, HistoryWorkout[]>();
    // Oldest first within a day, so a day reads in order.
    for (let i = history.workouts.length - 1; i >= 0; i--) {
      const w = history.workouts[i];
      const k = dayKey(w.workout.startedAt);
      m.set(k, [...(m.get(k) ?? []), w]);
    }
    return m;
  }, [history]);

  if (!view) return null;

  // Every day in range: the plan's view of it, or just what was logged when there's no plan that day.
  const planned = new Map(view.days.map((d) => [d.key, d]));
  const days: PlanDay[] = [];
  for (let ts = from; ts <= to; ts = addDays(ts, 1)) {
    const key = dayKey(ts);
    const done = byDay.get(key) ?? [];
    days.push(planned.get(key) ?? { key, ts, state: done.length ? 'extra' : 'off', changed: false, doneIds: done.map((w) => w.workout.routineId ?? '') });
  }

  const firstTs = Math.min(history.firstDate ?? now, now);
  const canBack = range === 'month' ? month > startOfMonth(firstTs) : week > startOfWeek(firstTs, weekStart);
  const last = addMonths(startOfMonth(now), AHEAD_MONTHS);
  const canFwd = range === 'month' ? month < last : addDays(week, 7) < last;

  // Selected day: what you tapped if it's on screen, else today, else the first day with something on it.
  const inRange = (k?: string) => !!k && days.some((d) => d.key === k);
  const sel = inRange(selRaw) ? selRaw! : inRange(today) ? today : (days.find((d) => byDay.has(d.key) || d.planned)?.key ?? days[0].key);
  const selDay = days.find((d) => d.key === sel)!;

  // Change one day (2.21) is for today on, inside a schedule.
  const canChange = (d: PlanDay) => !!folder && view.scheduled && d.key >= today && d.state !== 'off' && d.state !== 'extra';

  const pastDays = days.filter((d) => d.key <= today);
  const counts = onPlan(pastDays);
  const logged = days.reduce((n, d) => n + (byDay.get(d.key)?.length ?? 0), 0);
  const allAhead = days[0].key > today;
  const plannedAhead = days.filter((d) => d.key >= today && d.planned && d.state !== 'done').length;

  return (
    <div>
      <Segmented
        className="mt-3"
        options={[
          { value: 'week' as const, label: 'Week' },
          { value: 'month' as const, label: 'Month' },
        ]}
        value={range}
        onChange={(r) => {
          // Keep the selected day in view when switching.
          const at = selDay.ts;
          if (r === 'week') setWeek(startOfWeek(at, weekStart));
          else setMonth(startOfMonth(at));
          setRange(r);
        }}
      />

      <div className="mt-3 mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label={range === 'month' ? 'Previous month' : 'Previous week'}
          disabled={!canBack}
          onClick={() => (range === 'month' ? setMonth(addMonths(month, -1)) : setWeek(addDays(week, -7)))}
          className="-ml-2 flex h-11 w-11 items-center justify-center text-[22px] text-accent disabled:text-fg3"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => {
            setMonth(startOfMonth(now));
            setWeek(startOfWeek(now, weekStart));
            setSel(today);
          }}
          className="flex h-11 items-center px-2 text-[17px] font-bold tabular-nums"
          aria-label="Back to today"
        >
          {range === 'month' ? fmtMonthYear(month) : `${fmtMonthDay(week)} – ${fmtMonthDay(addDays(week, 6))}`}
        </button>
        <button
          type="button"
          aria-label={range === 'month' ? 'Next month' : 'Next week'}
          disabled={!canFwd}
          onClick={() => (range === 'month' ? setMonth(addMonths(month, 1)) : setWeek(addDays(week, 7)))}
          className="-mr-2 flex h-11 w-11 items-center justify-center text-[22px] text-accent disabled:text-fg3"
        >
          ›
        </button>
      </div>

      {range === 'month' ? (
        <>
          <MonthGrid month={month} days={days} codes={view.codes} today={today} sel={sel} weekStart={weekStart} onSelect={(d) => setSel(d.key)} />
          <Legend />
        </>
      ) : (
        <WeekList days={days} byDay={byDay} view={view} today={today} canChange={canChange} onChange={setSheetDay} />
      )}

      <StatRow
        className="mt-4"
        items={[
          allAhead ? { label: 'Planned', value: <span className="tabular-nums">{plannedAhead}</span> } : { label: 'Workouts', value: <span className="tabular-nums">{logged}</span> },
          { label: 'On plan', value: <span className="tabular-nums">{counts.due ? `${counts.done} of ${counts.due}` : '—'}</span> },
          { label: 'Missed', value: <span className={cx('tabular-nums', counts.missed > 0 && 'text-warn')}>{counts.missed}</span> },
        ]}
      />

      {range === 'week' && <Note>Tap a workout to open it. Tap a day from today on to change just that day.</Note>}

      {range === 'month' && (
        <DayDetail day={selDay} workouts={byDay.get(sel) ?? []} view={view} today={today} scheduled={view.scheduled} onChange={canChange(selDay) ? () => setSheetDay(selDay) : undefined} />
      )}

      {!view.scheduled && <Note className="mt-4">No active plan with a schedule, so this shows what you logged. Give a folder a schedule to see what's planned.</Note>}

      {sheetDay && folder && <DaySheet folder={folder} day={sheetDay} view={view} onClose={() => setSheetDay(null)} />}
    </div>
  );
}

// ───────────────────────────── month

function MonthGrid({
  month,
  days,
  codes,
  today,
  sel,
  weekStart,
  onSelect,
}: {
  month: number;
  days: PlanDay[];
  codes: Map<string, string>;
  today: string;
  sel: string;
  weekStart: 0 | 1;
  onSelect: (d: PlanDay) => void;
}) {
  const d = new Date(month);
  const lead = (d.getDay() - weekStart + 7) % 7;
  const count = daysInMonth(d.getFullYear(), d.getMonth());
  return (
    <div className="grid grid-cols-7 gap-1 text-center">
      {weekOrder(weekStart).map((wd) => (
        <div key={wd} className="pb-1 text-[11px] font-bold text-fg2">
          {weekdayLetter(wd)}
        </div>
      ))}
      {Array.from({ length: lead }, (_, i) => (
        <div key={`e${i}`} />
      ))}
      {days.slice(0, count).map((day) => (
        <DayCell key={day.key} day={day} code={dayCode(day, codes, '')} isToday={day.key === today} isSel={day.key === sel} future={day.key > today} onClick={() => onSelect(day)} />
      ))}
    </div>
  );
}

/** One day: the date, then ✓ when trained, or the routine's code when planned (orange when missed). */
function DayCell({ day, code, isToday, isSel, future, onClick }: { day: PlanDay; code: string; isToday: boolean; isSel: boolean; future: boolean; onClick: () => void }) {
  const s = day.state;
  const done = s === 'done' || s === 'extra';
  const missed = s === 'missed';
  const plannedAhead = (s === 'today' || s === 'upcoming') && !!day.planned;
  const date = new Date(day.ts).getDate();

  let mark: ReactNode = null;
  if (done) mark = <CheckGlyph size={13} className={isSel ? 'text-white' : 'text-accent'} />;
  else if (missed) mark = <span className={isSel ? 'text-white' : 'text-warn'}>{code}</span>;
  else if (plannedAhead) mark = <span className={isSel ? 'text-white/85' : 'text-fg2'}>{code}</span>;
  else if (s === 'moved' || s === 'paused') mark = <span className={isSel ? 'text-white/70' : 'text-fg3'}>{s === 'moved' ? '→' : code}</span>;

  const label = done ? 'done' : missed ? `missed ${code}` : plannedAhead ? `planned ${code}` : s === 'rest' ? 'rest' : '';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${fmtDay(day.ts)}${label ? `: ${label}` : ''}`}
      aria-pressed={isSel}
      className={cx(
        'flex h-12 min-w-0 flex-col items-center justify-center rounded-[9px] tabular-nums active:opacity-70',
        isSel
          ? 'bg-accent text-white'
          : done
            ? 'bg-surface-2 text-fg'
            : missed
              ? 'text-fg2 shadow-[inset_0_0_0_1.5px_var(--color-warn)]'
              : plannedAhead
                ? 'text-fg'
                : future
                  ? 'text-fg3'
                  : 'text-fg2',
        isToday && !isSel && 'shadow-[inset_0_0_0_1.5px_var(--og-fg2)]',
      )}
    >
      <span className="text-[14px] leading-none font-semibold">{date}</span>
      <span className="mt-[3px] flex h-[13px] items-center text-[10.5px] leading-none font-bold">{mark}</span>
    </button>
  );
}

function Legend() {
  const item = (box: ReactNode, label: string) => (
    <span className="flex items-center gap-1.5">
      {box}
      {label}
    </span>
  );
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-fg2">
      {item(<CheckGlyph size={13} className="text-accent" />, 'done')}
      {item(<i className="block h-3 w-3 rounded-[4px] shadow-[inset_0_0_0_1.5px_var(--color-warn)]" />, 'missed')}
      {item(<b className="text-[10.5px] text-fg2">P</b>, 'planned')}
      {item(<i className="block h-3 w-3 rounded-[4px] shadow-[inset_0_0_0_1.5px_var(--og-fg2)]" />, 'today')}
    </div>
  );
}

/** Under the month: the selected day's workouts, or what's planned for it. */
function DayDetail({
  day,
  workouts,
  view,
  today,
  scheduled,
  onChange,
}: {
  day: PlanDay;
  workouts: HistoryWorkout[];
  view: PlanView;
  today: string;
  scheduled: boolean;
  onChange?: () => void;
}) {
  const s = day.state;
  const name = day.planned ? view.routineName(day.planned) : null;
  return (
    <>
      <SectionLabel action={onChange && <LabelAction onClick={onChange}>Change day</LabelAction>}>{day.key === today ? `Today · ${fmtDay(day.ts)}` : fmtDay(day.ts)}</SectionLabel>
      {workouts.map((w) => (
        <WorkoutRow key={w.workout.id} w={w} />
      ))}
      {day.planned && s !== 'done' && <PlannedRow routineId={day.planned} name={name!} status={s === 'missed' ? 'missed' : s === 'paused' ? 'waiting' : day.key === today ? 'today' : 'planned'} />}
      {!workouts.length && !day.planned && (
        <p className="border-b border-line py-3.5 text-[13px] text-fg2">
          {s === 'moved' && day.movedTo ? `Moved to ${fmtDay(new Date(day.movedTo + 'T12:00').getTime())}.` : s === 'rest' ? 'Rest day.' : day.key > today ? (scheduled ? 'Nothing planned.' : 'No plan.') : 'Nothing logged.'}
        </p>
      )}
    </>
  );
}

// ───────────────────────────── week

/** Seven rows, one per day: what you did, or what's planned. */
function WeekList({
  days,
  byDay,
  view,
  today,
  canChange,
  onChange,
}: {
  days: PlanDay[];
  byDay: Map<string, HistoryWorkout[]>;
  view: PlanView;
  today: string;
  canChange: (d: PlanDay) => boolean;
  onChange: (d: PlanDay) => void;
}) {
  const navigate = useNavigate();
  const { exerciseMap } = useData();
  return (
    <div>
      {days.map((d) => {
        const ws = byDay.get(d.key) ?? [];
        const isToday = d.key === today;
        if (ws.length)
          return ws.map((w, i) => (
            <WeekRow
              key={w.workout.id}
              ts={d.ts}
              showDate={i === 0}
              isToday={isToday}
              title={w.workout.name}
              sub={`${w.workout.endedAt ? `${fmtDuration(w.workout.endedAt - w.workout.startedAt)} · ` : ''}${workoutLine(w, (id) => exerciseMap.get(id)?.type, false)}`}
              status={<CheckGlyph size={16} className="text-accent" />}
              onClick={() => navigate(`/history/${w.workout.id}`)}
            />
          ));
        const s = d.state;
        const name = d.planned ? view.routineName(d.planned) : null;
        const change = canChange(d);
        return (
          <WeekRow
            key={d.key}
            ts={d.ts}
            showDate
            isToday={isToday}
            title={name ?? (s === 'moved' ? 'Moved' : s === 'rest' ? 'Rest' : '—')}
            muted={!name}
            sub={
              s === 'missed'
                ? 'Missed'
                : s === 'paused'
                  ? 'Waiting: the cycle picks up when you train'
                  : s === 'moved' && d.movedTo
                    ? `Moved to ${weekdayShort(new Date(d.movedTo + 'T12:00').getDay())}`
                    : d.movedFrom && name
                      ? `Moved from ${weekdayShort(new Date(d.movedFrom + 'T12:00').getDay())}`
                      : name
                        ? isToday
                          ? 'Planned for today'
                          : d.changed
                            ? 'Planned · changed for this day'
                            : 'Planned'
                        : undefined
            }
            subTone={s === 'missed' ? 'warn' : undefined}
            onClick={change ? () => onChange(d) : d.planned && s !== 'done' ? () => navigate(`/routine/${d.planned}`) : undefined}
          />
        );
      })}
    </div>
  );
}

function WeekRow({
  ts,
  showDate,
  isToday,
  title,
  muted,
  sub,
  subTone,
  status,
  onClick,
}: {
  ts: number;
  showDate: boolean;
  isToday: boolean;
  title: string;
  muted?: boolean;
  sub?: string;
  subTone?: 'warn';
  status?: ReactNode;
  onClick?: () => void;
}) {
  const d = new Date(ts);
  return (
    <button type="button" disabled={!onClick} onClick={onClick} className="flex min-h-[56px] w-full items-center gap-3 border-b border-line text-left active:bg-surface/60 disabled:active:bg-transparent">
      <span className={cx('w-10 flex-none text-center leading-[1.1] tabular-nums', !showDate && 'invisible')}>
        <small className={cx('block text-[10.5px] font-bold uppercase', isToday ? 'text-accent' : 'text-fg2')}>{isToday ? 'Today' : weekdayShort(d.getDay())}</small>
        <b className={cx('text-[19px]', isToday && 'text-accent')}>{d.getDate()}</b>
      </span>
      <span className="min-w-0 flex-1 py-2">
        <b className={cx('block truncate text-[16px]', muted ? 'font-normal text-fg2' : 'font-semibold')}>{title}</b>
        {sub && <span className={cx('block truncate text-[13px]', subTone === 'warn' ? 'text-warn' : 'text-fg2')}>{sub}</span>}
      </span>
      {status && <span className="flex-none">{status}</span>}
      {onClick && <ChevronRight size={13} className="flex-none text-fg3" />}
    </button>
  );
}

// ───────────────────────────── rows

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

function PlannedRow({ routineId, name, status }: { routineId: string; name: string; status: 'missed' | 'waiting' | 'today' | 'planned' }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(`/routine/${routineId}`)} className="flex min-h-[56px] w-full items-center gap-3 border-b border-line text-left active:bg-surface/60">
      <i className={cx('block h-4 w-4 flex-none rounded-[5px]', status === 'missed' ? 'shadow-[inset_0_0_0_1.5px_var(--color-warn)]' : 'shadow-[inset_0_0_0_1.5px_var(--og-fg3)]')} />
      <span className="min-w-0 flex-1 py-2">
        <b className="block truncate text-[16px] font-semibold">{name}</b>
        <span className={cx('block text-[13px]', status === 'missed' ? 'text-warn' : 'text-fg2')}>
          {status === 'missed' ? 'Missed' : status === 'waiting' ? 'Waiting for you' : status === 'today' ? 'Planned for today' : 'Planned'}
        </span>
      </span>
      <ChevronRight size={13} className="flex-none text-fg3" />
    </button>
  );
}
