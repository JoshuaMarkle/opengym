import { useNavigate } from 'react-router';
import { useState, type ReactNode } from 'react';
import { useLongPress } from '../../components/gestures';
import { ArrowGlyph, CheckGlyph, ChevronRight } from '../../components/icons';
import { Sheet, SheetOption } from '../../components/overlays';
import { CalendarLegend, CompactSegmented, cx, DayCell, DayCode, DayDisc, DayDots, Note, Weekday, type DayState, type LegendItem } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { changeDays, resetDay, type PlanView } from '../../data/schedule';
import type { Folder, ScheduleVersion } from '../../db/types';
import { daysBetween, fmtMonthDay, weekdayLetter, weekdayShort } from '../../lib/dates';
import { addDayKey, delayCyclePatch, skipDayPatch, moveDayPatch, parseDayKey, routineCodes, setDayPatch, swapDaysPatch, swapTarget, versionOn, weekOrder, type PlanDay } from '../../lib/schedule';

/** "Today", "Fri 6" (or "Fri" when short). */
export function dayLabel(day: { key: string }, today: string, withDate = true): string {
  if (day.key === today) return 'Today';
  const d = new Date(parseDayKey(day.key));
  return withDate ? `${weekdayShort(d.getDay())} ${d.getDate()}` : weekdayShort(d.getDay());
}

/** What a day's mark says: the routine's code, R for rest, a check when done off-plan, an arrow when moved away. */
export type DayMark = { text: string; glyph?: 'check' | 'arrow' };

export function dayCode(day: PlanDay, codes: Map<string, string>, rest = 'R'): DayMark {
  const logged = () => {
    const id = day.doneIds.find((x) => x && codes.has(x));
    return id ? { text: codes.get(id)! } : { text: '', glyph: 'check' as const };
  };
  // Done with a different routine than planned: show what you actually did.
  if (day.state === 'done' && day.planned && !day.doneIds.includes(day.planned)) return logged();
  if (day.planned) return { text: codes.get(day.planned) ?? '?' };
  if (day.state === 'moved') return { text: '', glyph: 'arrow' };
  if (day.state === 'extra') return logged();
  return { text: day.state === 'off' ? '' : rest };
}

function markLabel(m: DayMark): string {
  return m.text || (m.glyph === 'check' ? 'done' : m.glyph === 'arrow' ? 'moved' : 'no plan');
}

function MarkContent({ mark }: { mark: DayMark }) {
  if (mark.glyph === 'check') return <CheckGlyph size={14} />;
  if (mark.glyph === 'arrow') return <ArrowGlyph size={10} />;
  return <>{mark.text}</>;
}

/** design §12: a plan day's state as a day mark. */
export function dayState(day: PlanDay): DayState {
  const s = day.state;
  if (s === 'done' || s === 'extra') return 'done';
  if (s === 'missed' || s === 'moved' || s === 'paused' || s === 'rest') return s;
  if (s === 'today' || s === 'upcoming') return day.planned ? 'planned' : 'rest';
  return 'empty';
}

/** design §12 Week strip of a plan (3.4, PH3.1): weekday letters over day discs with each day's code. */
export function PlanStrip({
  days,
  codes,
  today,
  live,
  onTap,
  onHold,
  className = '',
}: {
  days: PlanDay[];
  codes: Map<string, string>;
  today: string;
  live?: boolean;
  onTap?: (d: PlanDay) => void;
  onHold?: (d: PlanDay) => void;
  className?: string;
}) {
  return (
    <div className={cx('grid grid-cols-7 gap-1 text-center', className)}>
      {days.map((d) => (
        <StripCell key={d.key} day={d} mark={dayCode(d, codes)} isToday={d.key === today} live={live} onTap={onTap} onHold={onHold} />
      ))}
    </div>
  );
}

function StripCell({ day, mark, isToday, live, onTap, onHold }: { day: PlanDay; mark: DayMark; isToday: boolean; live?: boolean; onTap?: (d: PlanDay) => void; onHold?: (d: PlanDay) => void }) {
  const hold = useLongPress(() => onHold?.(day), !!onHold);
  const date = new Date(day.ts);
  const body = (
    <>
      <Weekday today={isToday}>{weekdayLetter(date.getDay())}</Weekday>
      <DayDisc className="mt-1.5" state={dayState(day)} today={isToday} live={live} changed={day.changed}>
        <MarkContent mark={mark} />
      </DayDisc>
    </>
  );
  if (!onTap && !onHold) return <span className="block min-w-0">{body}</span>;
  return (
    <button type="button" {...hold} onClick={() => onTap?.(day)} aria-label={`${weekdayShort(date.getDay())} ${date.getDate()}: ${markLabel(mark)}`} className="no-select block min-h-11 min-w-0 active:opacity-70">
      {body}
    </button>
  );
}

/** design §12 legend under every month grid. */
export const MONTH_LEGEND: LegendItem[] = [
  { label: 'Missed', mark: 'missed' },
  { label: 'Workout', mark: 'workout' },
  { label: 'Changed', mark: 'changed' },
];

/** design §12 View switch under a month grid: Dates / Codes. */
export function CodesSwitch({ codes, onChange }: { codes: boolean; onChange: (codes: boolean) => void }) {
  return (
    <CompactSegmented
      label="Day labels"
      options={[
        { value: 'dates', label: 'Dates' },
        { value: 'codes', label: 'Codes' },
      ]}
      value={codes ? 'codes' : 'dates'}
      onChange={(v) => onChange(v === 'codes')}
    />
  );
}

/** 2.20: the schedule editor's four weeks, with the main calendar's day cells, legend and Dates / Codes switch. */
export function PlanGrid({ days, codes, today, weekStart, onOpen }: { days: PlanDay[]; codes: Map<string, string>; today: string; weekStart: 0 | 1; onOpen: (d: PlanDay) => void }) {
  const [showCodes, setShowCodes] = useState(false);
  const { history } = useData();
  return (
    <>
      <div className="mt-1 grid grid-cols-7 gap-1 text-center">
        {weekOrder(weekStart).map((wd) => (
          <span key={wd} className="pb-1">
            <Weekday>{weekdayLetter(wd)}</Weekday>
          </span>
        ))}
        {days.map((d) => {
          const sessions = history.workouts.filter((w) => {
            const date = new Date(w.workout.startedAt);
            const day = new Date(d.ts);
            return date.getFullYear() === day.getFullYear() && date.getMonth() === day.getMonth() && date.getDate() === day.getDate();
          });
          const primary = sessions.reduce<(typeof sessions)[number] | undefined>((best, w) => (!best || w.setCount > best.setCount ? w : best), undefined);
          const loggedCode = primary && ((primary.workout.routineId && codes.get(primary.workout.routineId)) || routineCodes([{ id: primary.workout.id, name: primary.workout.name }]).get(primary.workout.id));
          return <CalCell key={d.key} day={d} code={d.planned ? (codes.get(d.planned) ?? '?') : '-'} loggedCode={loggedCode} count={sessions.length} showCodes={showCodes} isToday={d.key === today} onOpen={() => onOpen(d)} />;
        })}
      </div>
      <div className="flex min-h-11 items-center justify-between gap-1">
        <CalendarLegend items={MONTH_LEGEND} />
        <CodesSwitch codes={showCodes} onChange={setShowCodes} />
      </div>
    </>
  );
}

function CalCell({ day, code, loggedCode, count, showCodes, isToday, onOpen }: { day: PlanDay; code: string; loggedCode: string | undefined; count: number; showCodes: boolean; isToday: boolean; onOpen: () => void }) {
  const hold = useLongPress(onOpen);
  const arrow = <ArrowGlyph size={10} className="text-plan-code" />;
  return (
    <DayCell
      {...hold}
      onClick={onOpen}
      aria-label={`${fmtMonthDay(day.ts)}: ${loggedCode ?? code}${count ? `, ${count} logged workouts` : ''}${day.movedTo ? ', moved to ' + day.movedTo : day.movedFrom ? ', moved from ' + day.movedFrom : day.changed ? ', changed' : ''}`}
      aria-current={isToday ? 'date' : undefined}
      today={isToday}
      missed={day.state === 'missed'}
      changed={day.changed}
      tone={count || isToday ? 'fg' : day.planned ? 'fg2' : 'fg3'}
      number={showCodes ? (loggedCode ?? (day.movedTo ? arrow : code)) : new Date(day.ts).getDate()}
      marks={
        <>
          {!showCodes && day.movedTo && !count && arrow}
          {!showCodes && day.planned && !count && (
            <DayCode>
              {day.movedFrom && <ArrowGlyph size={8} className="mr-0.5" />}
              {code}
            </DayCode>
          )}
          {showCodes && day.movedFrom && !count && arrow}
          <DayDots count={count} />
        </>
      }
    />
  );
}

// ───────────────────────────── 2.21: change one day

/**
 * One-off changes to a single day: do another routine, rest (and say where
 * the workout goes), move it, or swap with the next workout day. The schedule
 * itself never changes here.
 */
export function DaySheet({ folder, day, view, onClose, onApply, onReset }: { folder: Folder; day: PlanDay | null; view: PlanView; onClose: () => void; onApply?: (patch: Parameters<typeof changeDays>[1]) => void; onReset?: (key: string) => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<'main' | 'routine' | 'move'>('main');
  const [lastKey, setLastKey] = useState(day?.key);
  if (day?.key !== lastKey) {
    setLastKey(day?.key);
    setStep('main');
  }
  if (!day) return null;

  const { today, days, plans, routineName } = view;
  const v = versionOn(folder.schedule, day.key);
  const waits = v?.kind === 'cycle' && v.onMiss === 'wait';
  const isToday = day.key === today;
  const name = day.planned ? routineName(day.planned) : null;
  const ov = folder.schedule?.overrides[day.key];
  const label = dayLabel(day, today);
  const isCycle = v?.kind === 'cycle';
  const swap = day.planned && !waits ? swapTarget(days, day.key) : undefined;
  const own = plans.byFolder.get(folder.id) ?? [];
  const exCount = (id: string) => plans.exercisesByRoutine.get(id)?.length ?? 0;

  const apply = async (patch: Parameters<typeof changeDays>[1]) => {
    if (onApply) onApply(patch);
    else await changeDays(folder.id, patch);
    onClose();
  };

  const title = `${label} · ${day.state === 'moved' ? 'Moved' : (name ?? 'Rest')}`;
  const subtitle = isToday ? 'Just for today. Your schedule stays the same.' : 'Just for this day. Your schedule stays the same.';

  let content: ReactNode;
  if (step === 'routine') {
    content = (
      <>
        {own.map((r) => (
          <SheetOption
            key={r.id}
            onClick={() => void apply(setDayPatch(day.key, r.id))}
            detail={
              <>
                {exCount(r.id)} exercises
                {day.planned === r.id && <CheckGlyph size={15} className="text-accent" />}
              </>
            }
          >
            {r.name}
          </SheetOption>
        ))}
        {!own.length && <Note>This plan has no routines yet.</Note>}
      </>
    );
  } else if (step === 'move') {
    const targets = days.filter((d) => d.key > day.key && d.key <= addDayKey(day.key, 7) && d.key >= today);
    content = (
      <>
        {targets.map((d) => (
          <SheetOption
            key={d.key}
            onClick={() => void apply(isCycle ? delayCyclePatch(day.key, d.key) : moveDayPatch(day.key, day.planned!, d.key))}
            detail={isCycle ? 'Pushes cycle back' : d.planned ? `replaces ${routineName(d.planned)}` : 'rest day'}
          >
            <span className="tabular-nums">
              {dayLabel(d, today)} · {fmtMonthDay(d.ts)}
            </span>
          </SheetOption>
        ))}
      </>
    );
  } else {
    content = (
      <>
        <SheetOption onClick={() => setStep('routine')} detail={<ChevronRight size={13} />}>
          {day.planned ? 'Do a different routine' : 'Do a routine'}
        </SheetOption>
        {day.planned && (
          <SheetOption
            onClick={() => void apply(skipDayPatch(day.key))}
            detail="Continue the schedule"
          >
            Skip this workout
          </SheetOption>
        )}
        {day.planned && (
          <SheetOption onClick={() => setStep('move')} detail={<ChevronRight size={13} />}>
            Move workout to…
          </SheetOption>
        )}
        {day.planned && swap && (
          <SheetOption onClick={() => void apply(swapDaysPatch(day.key, day.planned!, swap.key, swap.planned!))}>
            Swap with {dayLabel(swap, today, false)} · {routineName(swap.planned)}
          </SheetOption>
        )}
        {ov && (
          <SheetOption
            tone="accent"
            onClick={async () => {
              if (onReset) onReset(day.key);
              else await resetDay(folder.id, day.key);
              onClose();
            }}
          >
            Back to plan
          </SheetOption>
        )}
        {day.planned && <SheetOption onClick={() => { onClose(); navigate(`/routine/${day.planned}/edit`); }}>Edit this workout</SheetOption>}
      </>
    );
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={step === 'routine' ? `${label} · pick a routine` : step === 'move' ? 'Move workout to…' : title}
      subtitle={step === 'main' ? subtitle : undefined}
      action={
        step !== 'main' ? (
          <button type="button" onClick={() => setStep('main')} className="-mr-2 flex h-11 items-center px-2 text-body font-medium text-accent">
            Back
          </button>
        ) : undefined
      }
    >
      {content}
    </Sheet>
  );
}

/** 2.15 / PH3.5: the base split, shared by the routine page and library. */
export function ScheduleWeek({ days, version, codes, onOpen, className = '' }: { days: PlanDay[]; version: ScheduleVersion; codes: Map<string, string>; onOpen: () => void; className?: string }) {
  return (
        <button type="button" onClick={onOpen} aria-label="Open schedule calendar" className={cx('grid min-h-11 w-full grid-cols-7 gap-1 pb-1 text-center active:opacity-70', className)}>
          {days.map((d) => {
            const weekday = new Date(d.ts).getDay();
            const offset = daysBetween(parseDayKey(version.anchor ?? version.from), d.ts);
            const index = version.kind === 'weekly' ? weekday : ((offset % version.days.length) + version.days.length) % version.days.length;
            const routineId = version.days[index];
            return (
              <span key={d.key} className="flex min-w-0 flex-col items-center justify-center">
                <small className="text-caps normal-case tracking-normal font-bold text-fg2">{weekdayLetter(weekday)}</small>
                <span className={cx('mt-1 max-w-full truncate text-callout leading-[18px] font-semibold', routineId ? 'text-plan-code' : 'text-fg3')}>{routineId ? codes.get(routineId) ?? '?' : '-'}</span>
              </span>
            );
          })}
        </button>
  );
}
