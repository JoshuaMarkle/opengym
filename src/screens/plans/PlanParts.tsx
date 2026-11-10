import { useNavigate } from 'react-router';
import { useState, type ReactNode } from 'react';
import { useLongPress } from '../../components/gestures';
import { CheckGlyph, ChevronRight } from '../../components/icons';
import { Sheet, SheetOption } from '../../components/overlays';
import { cx, Note } from '../../components/ui';
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

/** What a day's box says: the routine's code, R / · for rest, → when moved away. */
export function dayCode(day: PlanDay, codes: Map<string, string>, rest = 'R'): string {
  // Done with a different routine than planned: show what you actually did.
  if (day.state === 'done' && day.planned && !day.doneIds.includes(day.planned)) {
    const id = day.doneIds.find((x) => x && codes.has(x));
    return id ? codes.get(id)! : '✓';
  }
  if (day.planned) return codes.get(day.planned) ?? '?';
  if (day.state === 'moved') return '→';
  if (day.state === 'extra') {
    const id = day.doneIds.find((x) => x && codes.has(x));
    return id ? codes.get(id)! : '✓';
  }
  return day.state === 'off' ? '' : rest;
}

/** Blue = done, orange outline = missed, ring = today, grey outline = changed by hand, outline = rest. */
export function boxClass(day: PlanDay, isToday: boolean, unfilled = false): string {
  // PH3.1 / 3.4: Home uses unfilled days and an accent outline for today.
  if (unfilled) {
    if (isToday) return 'text-fg ring-2 ring-inset ring-accent';
    if (day.changed) return day.state === 'done' || day.state === 'extra' ? 'text-accent' : 'text-fg';
    if (day.state === 'rest') return 'text-fg3';
    return boxClass(day, false).split(' ').filter((c) => !c.startsWith('bg-')).map((c) => c === 'text-white' ? 'text-accent' : c).join(' ');
  }
  const s = day.state;
  if (s === 'done' || s === 'extra') return cx('bg-accent text-white', isToday && 'ring-2 ring-fg ring-offset-2 ring-offset-bg');
  // Today keeps the planned-day shading under its ring; a rest day today is just the ring.
  if (isToday) return cx('text-fg ring-2 ring-inset ring-fg', (s === 'today' || s === 'upcoming') && day.planned && 'bg-surface-2');
  if (s === 'missed') return 'text-warn ring-[1.5px] ring-inset ring-warn';
  if (s === 'today' || s === 'upcoming') return day.changed ? 'text-fg ring-[1.5px] ring-inset ring-fg2' : 'bg-surface-2 text-fg';
  if (s === 'paused') return 'bg-surface text-fg3';
  if (s === 'moved') return 'text-fg2 ring-[1.5px] ring-inset ring-fg3';
  if (s === 'rest') return 'text-fg3 ring-1 ring-inset ring-line-strong';
  return 'text-fg3';
}

/** A one-week strip: weekday + date over a box with the day's code (2.14, 2.15, 2.17 preview). */
export function PlanStrip({
  days,
  codes,
  today,
  onTap,
  onHold,
  className = '',
  labelClassName = '',
  dense = false,
  hideDates = false,
  unfilled = false,
}: {
  days: PlanDay[];
  codes: Map<string, string>;
  today: string;
  onTap?: (d: PlanDay) => void;
  onHold?: (d: PlanDay) => void;
  className?: string;
  /** Home keeps the entire weekday/date label gray (PH3.1). */
  labelClassName?: string;
  /** Header shows "S1" instead of "S 1". */
  dense?: boolean;
  /** PH3.1 / 3.4: Home labels show only the weekday. */
  hideDates?: boolean;
  /** Home: no day fills, blue today outline (PH3.1 / 3.4). */
  unfilled?: boolean;
}) {
  return (
    <div className={cx('grid grid-cols-7 gap-1.5 text-center', className)}>
      {days.map((d) => (
        <StripCell key={d.key} day={d} code={dayCode(d, codes)} isToday={d.key === today} dense={dense} hideDates={hideDates} unfilled={unfilled} labelClassName={labelClassName} onTap={onTap} onHold={onHold} />
      ))}
    </div>
  );
}

function StripCell({
  day,
  code,
  isToday,
  dense,
  hideDates,
  unfilled,
  labelClassName,
  onTap,
  onHold,
}: {
  day: PlanDay;
  code: string;
  isToday: boolean;
  dense: boolean;
  hideDates: boolean;
  unfilled: boolean;
  labelClassName: string;
  onTap?: (d: PlanDay) => void;
  onHold?: (d: PlanDay) => void;
}) {
  const hold = useLongPress(() => onHold?.(day), !!onHold);
  const date = new Date(day.ts);
  const body = (
    <>
      <small className={cx('block text-[11px] font-bold tabular-nums', labelClassName || (isToday ? 'text-fg' : 'text-fg2'))}>
        {weekdayLetter(date.getDay())}
        {!hideDates && <>{dense ? '' : ' '}<span>{date.getDate()}</span></>}
      </small>
      <i className={cx('relative mt-1 flex h-[34px] items-center justify-center rounded-[9px] text-[12.5px] font-bold not-italic tabular-nums', boxClass(day, isToday, unfilled))}>{unfilled && day.changed && <ChangedDayOutline />}{/* PH3.1: use the shared SVG for completed days without a routine code. */}{code === '✓' ? <CheckGlyph size={15} /> : code}</i>
    </>
  );
  if (!onTap && !onHold) return <span className="block min-w-0">{body}</span>;
  return (
    <button
      type="button"
      {...hold}
      onClick={() => onTap?.(day)}
      aria-label={`${weekdayShort(date.getDay())} ${date.getDate()}: ${code || 'no plan'}`}
      className="no-select block min-h-11 min-w-0 active:opacity-70"
    >
      {body}
    </button>
  );
}

/** 2.20: match the main calendar's compact Dates / Codes styling. */
export function PlanGrid({ days, codes, today, weekStart, onOpen }: { days: PlanDay[]; codes: Map<string, string>; today: string; weekStart: 0 | 1; onOpen: (d: PlanDay) => void }) {
  const [showCodes, setShowCodes] = useState(false);
  const { history } = useData();
  return (
    <>
      <div className="mt-1 grid grid-cols-7 gap-1 text-center">
        {weekOrder(weekStart).map((wd) => (
          <small key={wd} className="pb-1 text-[11px] font-bold text-fg2">
            {weekdayLetter(wd)}
          </small>
        ))}
        {days.map((d) => {
          const sessions = history.workouts.filter((w) => {
            const date = new Date(w.workout.startedAt);
            const day = new Date(d.ts);
            return date.getFullYear() === day.getFullYear() && date.getMonth() === day.getMonth() && date.getDate() === day.getDate();
          });
          const primary = sessions.reduce<(typeof sessions)[number] | undefined>((best, w) => !best || w.setCount > best.setCount ? w : best, undefined);
          const loggedCode = primary && ((primary.workout.routineId && codes.get(primary.workout.routineId)) || routineCodes([{ id: primary.workout.id, name: primary.workout.name }]).get(primary.workout.id));
          return <CalCell key={d.key} day={d} code={d.planned ? codes.get(d.planned) ?? '?' : '-'} loggedCode={loggedCode} count={sessions.length} showCodes={showCodes} isToday={d.key === today} onOpen={() => onOpen(d)} />;
        })}
      </div>
      <div className="flex min-h-11 items-center justify-between gap-1">
        <div className="flex items-center gap-2 text-[10px] leading-none text-fg2">
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-[3px] border border-warn" /><span className="translate-y-px">Missed</span></span>
          <span className="flex items-center gap-1"><i className="h-1 w-1 rounded-full bg-accent" /><span className="translate-y-px">Workout</span></span>
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-[3px] border border-dashed border-fg2" /><span className="translate-y-px">Changed</span></span>
        </div>
        <div className="flex">
          {[false, true].map((v) => <button key={String(v)} type="button" aria-pressed={showCodes === v} onClick={() => setShowCodes(v)} className={cx('h-11 px-2 text-[12px]', showCodes === v ? 'font-bold text-fg underline underline-offset-4' : 'text-fg2')}>{v ? 'Codes' : 'Dates'}</button>)}
        </div>
      </div>
    </>
  );
}

function CalCell({ day, code, loggedCode, count, showCodes, isToday, onOpen }: { day: PlanDay; code: string; loggedCode: string | undefined; count: number; showCodes: boolean; isToday: boolean; onOpen: () => void }) {
  const hold = useLongPress(onOpen);
  return (
    <button
      type="button"
      {...hold}
      onClick={onOpen}
      aria-label={`${fmtMonthDay(day.ts)}: ${loggedCode ?? code}${count ? `, ${count} logged workouts` : ''}${day.movedTo ? ', moved to ' + day.movedTo : day.movedFrom ? ', moved from ' + day.movedFrom : day.changed ? ', changed' : ''}`}
      aria-current={isToday ? 'date' : undefined}
      className={cx(
        'no-select relative flex h-11 min-w-0 flex-col items-center rounded-[9px] pt-[7px] text-[14px] font-semibold tabular-nums active:opacity-70',
        count || isToday ? 'text-fg' : day.planned ? 'text-fg2' : 'text-fg3',
        isToday && 'ring-[1.5px] ring-inset ring-accent',
        !isToday && day.state === 'missed' && 'ring-1 ring-inset ring-warn',
      )}
    >
      {day.changed && (
        <ChangedDayOutline />
      )}
      <span className="leading-[18px]">{showCodes ? loggedCode ?? (day.movedTo ? '→' : code) : new Date(day.ts).getDate()}</span>
      <span className="flex h-3 max-w-full items-center justify-center gap-[2px]">
        {!showCodes && day.movedTo && !count && <span className="text-[12px] leading-[12px] text-plan-code">→</span>}
        {!showCodes && day.planned && !count && <span className="truncate px-1 text-[10px] leading-[12px] text-plan-code">{day.movedFrom ? '→ ' : ''}{code}</span>}
        {showCodes && day.movedFrom && !count && <span className="text-[10px] leading-[12px] text-plan-code">→</span>}
        {Array.from({ length: count }, (_, i) => <i key={i} className="h-1 w-1 rounded-full bg-accent" />)}
      </span>
    </button>
  );
}

/** PH3.10 / PH3.11: shared changed-day treatment across calendars and Home. */
export function ChangedDayOutline() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full fill-none text-fg3">
      <rect x="0.75" y="0.75" width="calc(100% - 1.5px)" height="calc(100% - 1.5px)" rx="8.25" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
    </svg>
  );
}

/** Small grey caps row for legends and hints. */
export function Legend({ items }: { items: { label: string; box: string }[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-fg2">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          <i className={cx('block h-3 w-3 rounded-[4px]', it.box)} />
          {it.label}
        </span>
      ))}
    </div>
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
          <button type="button" onClick={() => setStep('main')} className="-mr-2 flex h-11 items-center px-2 text-[15px] font-medium text-accent">
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
                <small className="text-[11px] font-bold text-fg2">{weekdayLetter(weekday)}</small>
                <span className={cx('mt-1 max-w-full truncate text-[14px] leading-[18px] font-semibold', routineId ? 'text-plan-code' : 'text-fg3')}>{routineId ? codes.get(routineId) ?? '?' : '-'}</span>
              </span>
            );
          })}
        </button>
  );
}
