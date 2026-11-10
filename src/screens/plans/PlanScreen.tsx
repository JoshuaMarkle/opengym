import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ChevronRight } from '../../components/icons';
import { BackButton, BarButton, LabelAction, Screen, SectionLabel, TopBar } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { setActiveFolder } from '../../data/routines';
import { usePlanView } from '../../data/schedule';
import { usePlans } from '../../data/usePlans';
import { useGiveUp } from '../../hooks/useGiveUp';
import { dayKey, fmtMonthDay, startOfWeek } from '../../lib/dates';
import { addDayKey, currentVersion, describeSchedule, parseDayKey, planSince } from '../../lib/schedule';
import { ScheduleWeek } from './PlanParts';
import { FolderSheet } from './RoutineActions';

/** 2.15: a folder as a plan. Its schedule and base split, then its routines. The 4-week calendar lives on Plans (2.1). */
export function PlanScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const plans = usePlans();
  const { settings } = useData();
  const folder = plans?.folders.find((f) => f.id === id);
  const gaveUp = useGiveUp(!!plans && !folder);
  const today = dayKey(Date.now());
  const weekFrom = dayKey(startOfWeek(Date.now(), settings.weekStart));
  const view = usePlanView(folder, weekFrom, addDayKey(weekFrom, 13));
  const [editing, setEditing] = useState(false);

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

      {!folder.active && !folder.archived && (
        <button type="button" onClick={() => void setActiveFolder(folder.id)} className="mt-2 flex h-11 w-full items-center border-y border-line text-[15px] font-semibold text-accent active:opacity-70">
          Make this the active plan
          <span className="ml-auto text-[13px] font-normal text-fg2">Home follows it</span>
        </button>
      )}

      <SectionLabel action={<LabelAction onClick={() => navigate(`/plan/${folder.id}/calendar`)}>Calendar ›</LabelAction>}>Schedule</SectionLabel>
      <button type="button" onClick={() => navigate(view.scheduled ? `/plan/${folder.id}/calendar` : `/plan/${folder.id}/schedule`)} className="block w-full py-2.5 text-left active:opacity-70">
        <b className="block text-[19px] font-bold">{desc.title}</b>
        <span className="block text-[13px] text-fg2">{view.scheduled ? desc.detail : 'Whatever you did longest ago is next. Tap to set up a cycle or weekly split.'}</span>
      </button>
      {/* 2.15: show the base split without dates, completion states, or one-day overrides. */}
      {view.scheduled && version && (
        <ScheduleWeek days={week} version={version} codes={view.codes} onOpen={() => navigate(`/plan/${folder.id}/calendar`)} />
      )}


      <SectionLabel>Workouts</SectionLabel>
      {routines.map((r) => (
        <button key={r.id} type="button" onClick={() => navigate(`/routine/${r.id}`)} className="flex min-h-[52px] w-full items-center gap-3 border-b border-line text-left active:bg-surface/60">
          <b className="min-w-0 flex-1 truncate text-[16px] font-semibold">{r.name}</b>
          <ChevronRight size={13} className="flex-none text-fg3" />
        </button>
      ))}
      <button type="button" onClick={() => navigate(`/routine/new?folder=${folder.id}`)} className="flex h-12 w-full items-center text-[15px] font-semibold text-accent active:opacity-70">
        + Add workout
      </button>

      <FolderSheet folder={editing ? folder : null} count={routines.length} onClose={() => setEditing(false)} />
    </Screen>
  );
}
