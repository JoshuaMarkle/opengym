import { useState, type ReactNode } from 'react';
import { useLongPress } from '../../components/gestures';
import { CheckGlyph } from '../../components/icons';
import { Sheet, SheetOption } from '../../components/overlays';
import { cx, Note } from '../../components/ui';
import { changeDays, resetDay, type PlanView } from '../../data/schedule';
import type { Folder } from '../../db/types';
import { fmtMonthDay, weekdayLetter, weekdayShort } from '../../lib/dates';
import { addDayKey, moveDayPatch, parseDayKey, restTarget, setDayPatch, swapDaysPatch, swapTarget, versionOn, type PlanDay } from '../../lib/schedule';

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
export function boxClass(day: PlanDay, isToday: boolean): string {
  const s = day.state;
  if (s === 'done' || s === 'extra') return cx('bg-accent text-white', isToday && 'ring-2 ring-fg ring-offset-2 ring-offset-bg');
  if (isToday) return 'text-fg ring-2 ring-inset ring-fg';
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
  dense = false,
}: {
  days: PlanDay[];
  codes: Map<string, string>;
  today: string;
  onTap?: (d: PlanDay) => void;
  onHold?: (d: PlanDay) => void;
  className?: string;
  /** Header shows "S1" instead of "S 1". */
  dense?: boolean;
}) {
  return (
    <div className={cx('grid grid-cols-7 gap-1.5 text-center', className)}>
      {days.map((d) => (
        <StripCell key={d.key} day={d} code={dayCode(d, codes)} isToday={d.key === today} dense={dense} onTap={onTap} onHold={onHold} />
      ))}
    </div>
  );
}

function StripCell({
  day,
  code,
  isToday,
  dense,
  onTap,
  onHold,
}: {
  day: PlanDay;
  code: string;
  isToday: boolean;
  dense: boolean;
  onTap?: (d: PlanDay) => void;
  onHold?: (d: PlanDay) => void;
}) {
  const hold = useLongPress(() => onHold?.(day), !!onHold);
  const date = new Date(day.ts);
  const body = (
    <>
      <small className={cx('block text-[11px] font-bold tabular-nums', isToday ? 'text-fg' : 'text-fg2')}>
        {weekdayLetter(date.getDay())}
        {dense ? '' : ' '}
        {date.getDate()}
      </small>
      <i className={cx('mt-1 flex h-[34px] items-center justify-center rounded-[9px] text-[12.5px] font-bold not-italic tabular-nums', boxClass(day, isToday))}>{code}</i>
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
export function DaySheet({ folder, day, view, onClose }: { folder: Folder; day: PlanDay | null; view: PlanView; onClose: () => void }) {
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
  const restTo = day.planned && !waits ? restTarget(days, day.key) : undefined;
  const swap = day.planned && !waits ? swapTarget(days, day.key) : undefined;
  const own = plans.byFolder.get(folder.id) ?? [];
  const exCount = (id: string) => plans.exercisesByRoutine.get(id)?.length ?? 0;

  const apply = async (patch: Parameters<typeof changeDays>[1]) => {
    await changeDays(folder.id, patch);
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
            onClick={() => void apply(moveDayPatch(day.key, day.planned!, d.key))}
            detail={d.planned ? `replaces ${routineName(d.planned)}` : 'rest day'}
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
        <SheetOption onClick={() => setStep('routine')} detail="›">
          {day.planned ? 'Do a different routine' : 'Do a routine'}
        </SheetOption>
        {day.planned && (
          <SheetOption
            onClick={() => void apply(restTo ? moveDayPatch(day.key, day.planned!, restTo.key) : setDayPatch(day.key, null))}
            detail={waits ? `${name} waits` : restTo ? `${name} → ${dayLabel(restTo, today, false)}` : `skips ${name}`}
          >
            {isToday ? 'Rest today' : 'Rest this day'}
          </SheetOption>
        )}
        {day.planned && !waits && (
          <SheetOption onClick={() => setStep('move')} detail="›">
            Move {name} to…
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
              await resetDay(folder.id, day.key);
              onClose();
            }}
          >
            Back to plan
          </SheetOption>
        )}
        <Note>Long-press a day on Home, the plan screen or the calendar. To change every week, edit the schedule instead.</Note>
      </>
    );
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={step === 'routine' ? `${label} · pick a routine` : step === 'move' ? `Move ${name} to…` : title}
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
