import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useLongPress } from '../../components/gestures';
import { ChevronLeft, ChevronRight } from '../../components/icons';
import { BackButton, BarButton, cx, Note, Screen, Segmented, StatRow, TopBar } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { usePlanView } from '../../data/schedule';
import { usePlans } from '../../data/usePlans';
import { useGiveUp } from '../../hooks/useGiveUp';
import { dayKey, fmtMonthDay, startOfWeek } from '../../lib/dates';
import { addDayKey, onPlan, weekCounts, type PlanDay } from '../../lib/schedule';
import { DaySheet, dayLabel, PlanGrid } from './PlanParts';

const WEEKS = 4;

/** 2.20: four weeks of planned vs done. Tap a day from today on to change just that day (2.21). */
export function PlanCalendar() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings } = useData();
  const plans = usePlans();
  const folder = plans?.folders.find((f) => f.id === id);
  const gaveUp = useGiveUp(!!plans && !folder);
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState<'list' | 'calendar'>('calendar');
  const [sheetDay, setSheetDay] = useState<PlanDay | null>(null);

  const thisWeek = dayKey(startOfWeek(Date.now(), settings.weekStart));
  // The current week sits second, so last week stays in view.
  const from = addDayKey(thisWeek, -7 + page * WEEKS * 7);
  const to = addDayKey(from, WEEKS * 7 - 1);
  const view = usePlanView(folder, from, to);
  const week = usePlanView(folder, thisWeek, addDayKey(thisWeek, 6));

  if (!plans || !view || !week) return null;
  if (!folder) {
    if (!gaveUp) return null;
    return (
      <Screen header={<TopBar left={<BackButton label="Plans" onClick={() => navigate('/plans')} />} />}>
        <p className="mt-10 text-center text-[15px] text-fg2">This plan was deleted.</p>
      </Screen>
    );
  }

  const { today, days, codes } = view;
  const past = onPlan(days.filter((d) => d.key <= today));
  const wk = weekCounts(week.days);
  const open = (d: PlanDay) => d.key >= today && d.state !== 'off' && setSheetDay(d);

  return (
    <Screen
      header={
        <TopBar
          left={<BackButton label={folder.name} onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(`/plan/${folder.id}`))} />}
          title="Schedule"
          right={<BarButton onClick={() => navigate(`/plan/${folder.id}/schedule`)}>Edit</BarButton>}
        />
      }
    >
      <Segmented
        className="mt-3"
        options={[
          { value: 'list' as const, label: 'List' },
          { value: 'calendar' as const, label: 'Calendar' },
        ]}
        value={mode}
        onChange={setMode}
      />

      <div className="mt-3 flex items-center justify-between">
        <button type="button" aria-label="Earlier" onClick={() => setPage((p) => p - 1)} className="-ml-2 flex h-11 w-11 items-center justify-center text-accent">
          <ChevronLeft size={15} />
        </button>
        <b className="text-[16px] font-bold tabular-nums">
          {fmtMonthDay(days[0].ts)} – {fmtMonthDay(days[days.length - 1].ts)}
        </b>
        <button type="button" aria-label="Later" onClick={() => setPage((p) => p + 1)} className="-mr-2 flex h-11 w-11 items-center justify-center text-accent">
          <ChevronRight size={15} />
        </button>
      </div>

      {mode === 'calendar' ? (
        <PlanGrid days={days} codes={codes} today={today} weekStart={settings.weekStart} onOpen={open} />
      ) : (
        <div className="mt-1">
          {days
            .filter((d) => d.state !== 'off' || d.doneIds.length)
            .map((d) => (
              <ListRow key={d.key} day={d} today={today} name={d.state === 'moved' ? 'Moved' : d.planned ? view.routineName(d.planned) : d.state === 'extra' ? 'Extra workout' : 'Rest'} onOpen={() => open(d)} />
            ))}
        </div>
      )}

      <StatRow
        className="mt-4"
        items={[
          { label: 'On plan', value: <span className="tabular-nums">{past.due ? `${past.done} of ${past.due}` : '—'}</span> },
          { label: 'This week', value: <span className="tabular-nums">{`${wk.done} of ${wk.total}`}</span> },
          { label: 'Missed', value: <span className={cx('tabular-nums', past.missed > 0 && 'text-warn')}>{past.missed}</span> },
        ]}
      />
      <Note>Tap a day from today on to change just that day. To change every week, tap Edit.</Note>

      {sheetDay && <DaySheet folder={folder} day={sheetDay} view={view} onClose={() => setSheetDay(null)} />}
    </Screen>
  );
}

const STATE_TEXT: Partial<Record<PlanDay['state'], string>> = {
  done: 'done',
  extra: 'done',
  missed: 'missed',
  paused: 'waiting',
  moved: 'moved',
  today: 'today',
};

function ListRow({ day, today, name, onOpen }: { day: PlanDay; today: string; name: string; onOpen: () => void }) {
  const hold = useLongPress(onOpen);
  const text = STATE_TEXT[day.state] ?? (day.changed ? 'changed' : '');
  return (
    <button type="button" {...hold} onClick={onOpen} className="no-select flex min-h-[48px] w-full items-center gap-3 border-b border-line text-left active:bg-surface/60">
      <span className={cx('w-[64px] flex-none text-[13px] tabular-nums', day.key === today ? 'font-bold text-fg' : 'text-fg2')}>{dayLabel(day, today)}</span>
      <span className={cx('min-w-0 flex-1 truncate text-[15px]', day.planned ? 'font-semibold' : 'text-fg2')}>{name}</span>
      <span className={cx('text-[13px]', day.state === 'missed' ? 'text-warn' : day.state === 'done' || day.state === 'extra' ? 'text-accent' : 'text-fg2')}>{text}</span>
    </button>
  );
}
