import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useLongPress } from '../../components/gestures';
import { ChevronRight } from '../../components/icons';
import { BackButton, BarButton, Check, cx, LabelAction, PlayButton, Screen, SectionLabel, TopBar } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { setActiveFolder } from '../../data/routines';
import { usePlanView } from '../../data/schedule';
import { usePlans } from '../../data/usePlans';
import { useGiveUp } from '../../hooks/useGiveUp';
import { useStartWorkout } from '../../hooks/StartWorkout';
import { dayKey, fmtDuration, fmtMonthDay, startOfWeek } from '../../lib/dates';
import { addDayKey, currentVersion, describeSchedule, parseDayKey, planSince, weekCounts, type PlanDay } from '../../lib/schedule';
import { DaySheet, dayLabel, PlanStrip } from './PlanParts';
import { FolderSheet } from './RoutineActions';

/** A2: a folder as a plan. Its schedule, this week's workouts, then its routines. */
export function PlanScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const plans = usePlans();
  const { history, settings } = useData();
  const start = useStartWorkout();
  const folder = plans?.folders.find((f) => f.id === id);
  const gaveUp = useGiveUp(!!plans && !folder);
  const today = dayKey(Date.now());
  const weekFrom = dayKey(startOfWeek(Date.now(), settings.weekStart));
  const view = usePlanView(folder, weekFrom, addDayKey(weekFrom, 13));
  const [editing, setEditing] = useState(false);
  const [sheetDay, setSheetDay] = useState<PlanDay | null>(null);

  // The finished workout behind each done day, for "done · 54 min".
  const byDay = useMemo(() => {
    const m = new Map<string, { routineId?: string; name: string; ms: number }[]>();
    for (const hw of history.workouts) {
      const w = hw.workout;
      const k = dayKey(w.startedAt);
      m.set(k, [...(m.get(k) ?? []), { routineId: w.routineId, name: w.name, ms: (w.endedAt ?? w.startedAt) - w.startedAt }]);
    }
    return m;
  }, [history]);

  if (!plans || !view) return null;
  if (!folder) {
    if (!gaveUp) return null;
    return (
      <Screen header={<TopBar left={<BackButton label="Plans" onClick={() => navigate('/plans')} />} />}>
        <p className="mt-10 text-center text-[15px] text-fg2">This plan was deleted.</p>
      </Screen>
    );
  }

  const routines = plans.byFolder.get(folder.id) ?? [];
  const version = currentVersion(folder.schedule, today);
  const desc = describeSchedule(view.scheduled ? version : undefined);
  const since = view.scheduled ? planSince(folder.schedule, today) : undefined;
  const week = view.days.slice(0, 7);
  const counts = weekCounts(week);
  const rows = week.filter((d) => d.planned || d.state === 'moved' || d.state === 'extra');
  const exCount = (rid: string) => plans.exercisesByRoutine.get(rid)?.length ?? 0;
  const firstUp = week.find((d) => d.state === 'today' || d.state === 'upcoming');

  const subtitle = [
    `${routines.length} ${routines.length === 1 ? 'routine' : 'routines'}`,
    folder.archived ? 'archived' : folder.active ? (view.scheduled ? 'active plan' : 'active folder') : undefined,
    since ? `since ${fmtMonthDay(parseDayKey(since))}` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen
      header={
        <TopBar
          border={false}
          left={<BackButton label="Plans" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/plans'))} />}
          right={<BarButton onClick={() => setEditing(true)}>Edit</BarButton>}
        />
      }
    >
      <h1 className="truncate text-[34px] leading-[1.1] font-bold tracking-[-0.02em]">{folder.name}</h1>
      <p className="mt-1 text-[13px] text-fg2 tabular-nums">{subtitle}</p>

      <SectionLabel action={<LabelAction onClick={() => navigate(`/plan/${folder.id}/schedule`)}>Change ›</LabelAction>}>Schedule</SectionLabel>
      <button type="button" onClick={() => navigate(view.scheduled ? `/plan/${folder.id}/calendar` : `/plan/${folder.id}/schedule`)} className="block w-full py-2.5 text-left active:opacity-70">
        <b className="block text-[19px] font-bold">{desc.title}</b>
        <span className="block text-[13px] text-fg2">{view.scheduled ? desc.detail : 'Whatever you did longest ago is next. Tap to set up a cycle or weekly split.'}</span>
      </button>
      {view.scheduled && <PlanStrip days={week} codes={view.codes} today={today} dense onTap={() => navigate(`/plan/${folder.id}/calendar`)} onHold={(d) => d.key >= today && setSheetDay(d)} className="pb-1" />}

      {!folder.active && !folder.archived && (
        <button type="button" onClick={() => void setActiveFolder(folder.id)} className="mt-2 flex h-11 w-full items-center border-y border-line text-[15px] font-semibold text-accent active:opacity-70">
          Make this the active plan
          <span className="ml-auto text-[13px] font-normal text-fg2">Home follows it</span>
        </button>
      )}

      {view.scheduled && (
        <>
          <SectionLabel action={<span className="text-[12px] font-semibold tracking-normal text-fg2 normal-case tabular-nums">{`${counts.done} of ${counts.total} done`}</span>}>This week</SectionLabel>
          {rows.map((d) => (
            <WeekRow
              key={d.key}
              day={d}
              today={today}
              name={rowName(d, view.routineName, byDay.get(d.key))}
              detail={rowDetail(d, today, exCount, byDay.get(d.key))}
              primary={d === firstUp}
              onOpen={() => d.planned && navigate(`/routine/${d.planned}`)}
              onHold={() => d.key >= today && setSheetDay(d)}
              onStart={d.planned && d.state !== 'done' && d.key >= today ? () => start.startRoutine(d.planned!, view.routineName(d.planned)) : undefined}
            />
          ))}
          {!rows.length && <p className="border-b border-line py-3 text-[13px] text-fg2">Nothing planned this week.</p>}
          <button type="button" onClick={() => navigate(`/plan/${folder.id}/calendar`)} className="flex h-11 w-full items-center text-[15px] font-semibold text-accent active:opacity-70">
            Calendar ›
          </button>
        </>
      )}

      <SectionLabel>Routines</SectionLabel>
      {routines.map((r) => (
        <button key={r.id} type="button" onClick={() => navigate(`/routine/${r.id}`)} className="flex min-h-[52px] w-full items-center gap-3 border-b border-line text-left active:bg-surface/60">
          <b className="min-w-0 flex-1 truncate text-[16px] font-semibold">{r.name}</b>
          <ChevronRight size={13} className="flex-none text-fg3" />
        </button>
      ))}
      <button type="button" onClick={() => navigate(`/routine/new?folder=${folder.id}`)} className="flex h-12 w-full items-center text-[15px] font-semibold text-accent active:opacity-70">
        + New routine
      </button>

      <FolderSheet folder={editing ? folder : null} count={routines.length} onClose={() => setEditing(false)} />
      {sheetDay && <DaySheet folder={folder} day={sheetDay} view={view} onClose={() => setSheetDay(null)} />}
    </Screen>
  );
}

/** What the row is called: the workout you did when it differs from the plan. */
function rowName(d: PlanDay, routineName: (id: string | null | undefined) => string, done: { routineId?: string; name: string }[] | undefined): string {
  if ((d.state === 'done' || d.state === 'extra') && done?.length && !done.some((w) => w.routineId === d.planned)) return done[0].name;
  if (d.state === 'moved') return 'Moved';
  return d.planned ? routineName(d.planned) : 'Rest';
}

function rowDetail(d: PlanDay, today: string, exCount: (id: string) => number, done: { routineId?: string; name: string; ms: number }[] | undefined): { text: string; tone?: 'warn' } {
  if (d.state === 'done' || d.state === 'extra') {
    const w = done?.find((x) => x.routineId === d.planned) ?? done?.[0];
    return { text: w ? `done · ${fmtDuration(w.ms)}` : 'done' };
  }
  if (d.state === 'missed') return { text: 'missed', tone: 'warn' };
  if (d.state === 'paused') return { text: 'waiting' };
  if (d.state === 'moved') return { text: d.movedTo ? `moved to ${dayLabel({ key: d.movedTo }, today, false)}` : 'moved' };
  if (d.movedFrom) return { text: `moved from ${dayLabel({ key: d.movedFrom }, today, false)}` };
  const base = d.planned ? `${exCount(d.planned)} exercises` : '';
  return { text: d.changed ? `${base} · changed` : base };
}

function WeekRow({
  day,
  today,
  name,
  detail,
  primary,
  onOpen,
  onHold,
  onStart,
}: {
  day: PlanDay;
  today: string;
  name: string;
  detail: { text: string; tone?: 'warn' };
  primary: boolean;
  onOpen: () => void;
  onHold: () => void;
  onStart?: () => void;
}) {
  const hold = useLongPress(onHold);
  const done = day.state === 'done' || day.state === 'extra';
  return (
    <div className="flex min-h-[58px] items-center gap-3 border-b border-line">
      <button type="button" {...hold} onClick={onOpen} className="no-select flex min-w-0 flex-1 items-center gap-3 py-2 text-left active:opacity-70">
        <span className={cx('w-[58px] flex-none text-[13px] tabular-nums', day.key === today ? 'font-bold text-fg' : 'text-fg2')}>{dayLabel(day, today)}</span>
        <span className="min-w-0 flex-1">
          <b className={cx('block truncate text-[16px] font-semibold', day.state === 'moved' && 'text-fg2')}>{name}</b>
          <span className={cx('block truncate text-[13px]', detail.tone === 'warn' ? 'text-warn' : 'text-fg2')}>{detail.text}</span>
        </span>
      </button>
      {done ? (
        <span className="flex h-11 w-11 flex-none items-center justify-center" aria-label="done">
          <Check on />
        </span>
      ) : onStart ? (
        <PlayButton primary={primary} label={`Start ${name}`} onClick={onStart} />
      ) : null}
    </div>
  );
}
