import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useLongPress } from '../../components/gestures';
import { PlusGlyph } from '../../components/icons';
import { AttentionNote, Badge, Button, cx, DayDisc, DoneDisc, EmptyState, LabelAction, LargeHeader, LiveStatus, PlayButton, RowText, Screen, SectionLabel, StartPill, TextButton, Weekday } from '../../components/ui';
import { useActiveWorkout, useData, type ActiveWorkoutData } from '../../data/DataProvider';
import { changeDays, skipMissed, usePlanView, type PlanView } from '../../data/schedule';
import { usePlans } from '../../data/usePlans';
import type { Folder } from '../../db/types';
import { useStartWorkout } from '../../hooks/StartWorkout';
import { useNow } from '../../hooks/useNow';
import { addDays, dayKey, fmtClock, fmtHomeDate, fmtRelativeDay, startOfDay, startOfWeek, weekdayLetter } from '../../lib/dates';
import { pickNextUp } from '../../lib/nextUp';
import { addDayKey, doItTodayPatch, missedYesterday, type PlanDay } from '../../lib/schedule';
import { setLabels } from '../../lib/sets';
import { DaySheet, dayLabel, PlanStrip } from '../plans/PlanParts';
import { Lately } from './Lately';

/** 3.1 / 3.2 / 1.4: this week (the plan's week when it has a schedule, 3.4), the running workout, and the active folder one tap from starting. */
export function Home() {
  const navigate = useNavigate();
  const { history, settings, exerciseMap } = useData();
  const active = useActiveWorkout();
  const plans = usePlans();
  const start = useStartWorkout();
  const now = useNow(60_000);

  const folder = plans?.activeFolder;
  const folderRoutines = plans ? (folder ? (plans.byFolder.get(folder.id) ?? []) : (plans.byFolder.get('') ?? [])) : [];
  const runningId = active?.workout.routineId;
  // Rotation order: done longest ago first (never done counts as oldest), ties by folder order. NEXT leads.
  const shown = folderRoutines
    .filter((r) => r.id !== runningId)
    .map((r) => ({ r, t: history.lastDoneByRoutine.get(r.id) ?? -Infinity }))
    .sort((a, b) => a.t - b.t || a.r.order - b.r.order)
    .map((x) => x.r);
  const nextId = pickNextUp(shown, history.lastDoneByRoutine);
  const hasRoutines = !!plans && plans.routines.length > 0;

  const planView = usePlanView(folder, addDayKey(dayKey(startOfWeek(now, settings.weekStart)), -1), addDayKey(dayKey(now), 13));
  const scheduled = !!planView?.scheduled;
  const weekFrom = dayKey(startOfWeek(now, settings.weekStart));
  const weekView = usePlanView(folder, weekFrom, addDayKey(weekFrom, 6));

  const trained = useMemo(() => new Set(history.workouts.map((w) => dayKey(w.workout.startedAt))), [history]);

  return (
    <Screen header={<LargeHeader title="Home" subtitle={fmtHomeDate(now)} />}>
      {active && <LiveBlock data={active} />}

      {/* With a schedule, the plan's week (2.15): what's planned, done and missed. Otherwise the days you trained. */}
      {scheduled && folder && weekView?.days.length ? (
        <PlanStrip days={weekView.days} codes={weekView.codes} today={weekView.today} live={!!active} onTap={(d) => navigate(`/calendar?day=${d.key}`)} className="mt-3" />
      ) : (
        <WeekStrip now={now} weekStart={settings.weekStart} trained={trained} live={!!active} onOpen={() => navigate('/calendar')} />
      )}

      {!plans ? null : !hasRoutines ? (
        <div className="pt-12">
          <EmptyState icon={<PlusGlyph size={20} />} title="No routines yet">
            Build a routine once, then start it in one tap every time.
          </EmptyState>
          <div className="mx-auto mt-6 flex max-w-[300px] flex-col gap-2">
            <Button onClick={() => navigate('/routine/new')}>Create a routine</Button>
            <Button kind="secondary" onClick={start.startBlank}>
              Start a blank workout
            </Button>
          </div>
        </div>
      ) : (
        <>
          {scheduled && folder ? (
            <ScheduledList folder={folder} view={planView} runningId={runningId} />
          ) : (
            <>
              <SectionLabel action={<LabelAction chevron onClick={() => navigate('/plans')}>Routines</LabelAction>}>{folder?.name ?? 'Routines'}</SectionLabel>
              {shown.map((r) => {
                const last = history.lastDoneByRoutine.get(r.id);
                const isNext = r.id === nextId;
                const names = (plans.exercisesByRoutine.get(r.id) ?? []).map((id) => exerciseMap.get(id)?.name).filter(Boolean);
                return (
                  <div key={r.id} className="flex min-h-15 items-center gap-3 border-b border-line">
                    <button type="button" onClick={() => navigate(`/routine/${r.id}`)} className="flex min-w-0 flex-1 py-2 text-left active:opacity-70">
                      <RowText
                        title={r.name}
                        badge={isNext && <Badge variant="next">NEXT</Badge>}
                        subtitle={last ? `Last done ${fmtRelativeDay(last, now)}` : names.length ? `Never done · ${names.length} exercises` : 'Never done'}
                      />
                    </button>
                    <PlayButton primary={isNext} label={`Start ${r.name}`} onClick={() => start.startRoutine(r.id, r.name)} />
                  </div>
                );
              })}
              {!shown.length && folderRoutines.length > 0 && <p className="border-b border-line py-3 text-footnote text-fg2">Every routine in this folder is running.</p>}
              {!folderRoutines.length && (
                <button type="button" onClick={() => navigate('/plans')} className="block w-full border-b border-line py-3 text-left text-footnote text-fg2">
                  {folder ? `${folder.name} is empty. Add routines in Routines.` : 'No active folder. Pick one in Routines.'}
                </button>
              )}
            </>
          )}
          {!scheduled && (
            <TextButton onClick={start.startBlank} className="h-13 w-full text-body-lg">
              + Blank workout
            </TextButton>
          )}
          <Lately now={now} />
        </>
      )}
    </Screen>
  );
}

/** design §12 Week strip (3.1): Caps weekday letters over day discs. Done blue, today a white ring (green while live). */
function WeekStrip({ now, weekStart, trained, live, onOpen }: { now: number; weekStart: 0 | 1; trained: Set<string>; live: boolean; onOpen: () => void }) {
  const first = startOfWeek(now, weekStart);
  const today = startOfDay(now);
  const days = Array.from({ length: 7 }, (_, i) => addDays(first, i));
  return (
    <button type="button" onClick={onOpen} aria-label="This week. Open History" className="mt-3 grid w-full grid-cols-7 gap-1 text-center">
      {days.map((d) => {
        const date = new Date(d);
        const isToday = d === today;
        return (
          <span key={d}>
            <Weekday today={isToday}>{weekdayLetter(date.getDay())}</Weekday>
            <DayDisc className="mt-1.5" state={trained.has(dayKey(d)) ? 'done' : d > today ? 'planned' : 'past'} today={isToday} live={live}>
              {date.getDate()}
            </DayDisc>
          </span>
        );
      })}
    </button>
  );
}

/** 3.2: the running workout leads Home. */
function LiveBlock({ data }: { data: ActiveWorkoutData }) {
  const navigate = useNavigate();
  const now = useNow(1000);
  const { workout, exercises } = data;
  const cur = exercises.find((e) => e.we.id === workout.currentExerciseId) ?? exercises[0];
  let where = 'No exercises yet';
  if (cur) {
    const next = cur.sets.find((s) => !s.completed);
    const working = cur.sets.filter((s) => s.kind === 'working');
    if (!next) where = `${cur.exercise.name} · done`;
    else if (next.kind === 'working') where = `${cur.exercise.name} · set ${setLabels(cur.sets).get(next.id)} of ${working.length}`;
    else where = `${cur.exercise.name} · ${next.kind === 'warmup' ? 'warm-up' : 'drop set'}`;
  }
  const [name, rest] = where.split(' · ');
  return (
    <LiveStatus
      title={workout.name}
      timer={fmtClock(now - workout.startedAt)}
      where={`${cur ? 'On: ' : ''}${name}`}
      detail={rest}
      steps={exercises.map((e) => (e.sets.length > 0 && e.sets.every((s) => s.completed) ? 'done' : e.we.id === cur?.we.id ? 'current' : 'todo'))}
      onResume={() => navigate('/workout')}
    />
  );
}

type HomeItem = { kind: 'workout'; day: PlanDay } | { kind: 'rest'; days: PlanDay[] };

/** 3.4 / 3.7 / PH3.1: always show today; omit future rest rows. Blank workout follows the list. */
function ScheduledList({ folder, view, runningId }: { folder: Folder; view: PlanView; runningId?: string }) {
  const navigate = useNavigate();
  const start = useStartWorkout();
  const [sheetDay, setSheetDay] = useState<PlanDay | null>(null);
  const { settings, history } = useData();
  const { today, days, plans } = view;
  const missed = folder.schedule ? missedYesterday(days, today, folder.schedule) : undefined;
  const ahead = days.filter((d) => d.key >= today);
  const todayDay = ahead[0];

  const items: HomeItem[] = [];
  let workouts = 0;
  // PH3.1: show completed sessions earlier this week alongside upcoming quick starts.
  const weekStart = dayKey(startOfWeek(Date.now(), settings.weekStart));
  for (const d of days.filter((d) => d.key >= weekStart && d.key < today && d.state === 'done' && d.planned)) items.push({ kind: 'workout', day: d });
  for (const d of ahead) {
    if (workouts >= 3) break;
    if (d.planned) {
      items.push({ kind: 'workout', day: d });
      workouts++;
    } else if (d.key === today) {
      items.push({ kind: 'rest', days: [d] });
    }
  }
  const exCount = (rid: string) => plans.exercisesByRoutine.get(rid)?.length ?? 0;
  const restLabel = (ds: PlanDay[]) => {
    const names = ds.map((d) => dayLabel(d, today, false));
    return names.length <= 2 ? names.join(' · ') : `${names[0]} – ${names[names.length - 1]}`;
  };

  return (
    <>
      {missed && (
        <AttentionNote
          lead={`You missed ${view.routineName(missed.planned)} yesterday.`}
          actions={
            <>
              <TextButton onClick={() => void changeDays(folder.id, doItTodayPatch(missed, today))}>Do it today</TextButton>
              <TextButton tone="muted" onClick={() => void skipMissed(folder.id, missed.key)}>
                Skip it
              </TextButton>
            </>
          }
        >
          {todayDay?.planned ? `Today is ${view.routineName(todayDay.planned)}.` : 'Today is a rest day.'}
        </AttentionNote>
      )}
      <SectionLabel action={<LabelAction chevron onClick={() => navigate('/calendar')}>Calendar</LabelAction>}>{`${folder.name} · This week`}</SectionLabel>
      {items.map((it) =>
        it.kind === 'rest' ? (
          <HomeRestRow key={it.days[0].key} label={restLabel(it.days)} isToday={it.days[0].key === today} onHold={() => setSheetDay(it.days[0])} />
        ) : (
          <HomeDayRow
            key={it.day.key}
            day={it.day}
            today={today}
            name={view.routineName(it.day.planned)}
            detail={
              it.day.state === 'done'
                ? `${exCount(it.day.planned!)} exercises · Done`
                : it.day.planned === runningId
                  ? 'in progress'
                  : it.day.movedFrom
                    ? `moved from ${dayLabel({ key: it.day.movedFrom }, today, false)}`
                    : `${exCount(it.day.planned!)} exercises`
            }
            primary={it.day.key === today}
            onOpen={() => {
              const done = history.workouts.find((w) => dayKey(w.workout.startedAt) === it.day.key);
              navigate(it.day.state === 'done' && done ? `/history/${done.workout.id}` : `/routine/${it.day.planned}`);
            }}
            onHold={() => setSheetDay(it.day)}
            onStart={() => start.startRoutine(it.day.planned!, view.routineName(it.day.planned))}
          />
        ),
      )}
      {!items.length && <p className="border-b border-line py-3 text-footnote text-fg2">Nothing planned in the next two weeks.</p>}
      <TextButton onClick={start.startBlank} className="h-13 w-full text-body-lg">
        + Blank workout
      </TextButton>
      {sheetDay && <DaySheet folder={folder} day={sheetDay} view={view} onClose={() => setSheetDay(null)} />}
    </>
  );
}

function HomeDayRow({
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
  detail: string;
  primary: boolean;
  onOpen: () => void;
  onHold: () => void;
  onStart: () => void;
}) {
  const hold = useLongPress(onHold);
  return (
    <div className="flex min-h-15 items-center gap-3 border-b border-line">
      <button type="button" {...hold} onClick={onOpen} className="no-select flex min-w-0 flex-1 items-center gap-3 py-2 text-left active:opacity-70">
        <span className={cx('w-[52px] flex-none text-center', day.key === today ? 'text-accent' : 'text-fg2')}>
          <small className="block text-caps">{dayLabel(day, today, false)}</small>
          {/* PH3.1: routine dates stay bright, with today in blue. */}
          <b className={cx('text-title3', day.key === today ? 'text-accent' : 'text-fg')}>{new Date(day.ts).getDate()}</b>
        </span>
        <span className="min-w-0 flex-1">
          <b className="block truncate text-input font-semibold">{name}</b>
          <span className="block truncate text-footnote text-fg2">{detail}</span>
        </span>
      </button>
      {day.state === 'done' ? (
        <DoneDisc />
      ) : primary ? (
        <StartPill label={`Start ${name} today`} onClick={onStart} />
      ) : (
        <PlayButton label={`Start ${name}`} onClick={onStart} />
      )}
    </div>
  );
}

function HomeRestRow({ label, isToday, onHold }: { label: string; isToday: boolean; onHold: () => void }) {
  const hold = useLongPress(onHold);
  return (
    <div {...hold} className="no-select flex min-h-11 items-center gap-3 border-b border-line text-footnote text-fg2">
      {isToday ? (
        <span className="flex-1 text-accent">Rest today</span>
      ) : (
        <>
          <span className="min-w-[52px] flex-none whitespace-nowrap">{label}</span>
          <span className="flex-1">Rest</span>
        </>
      )}
      <button type="button" onClick={onHold} className="min-h-11 px-2 text-accent">
        Change day
      </button>
    </div>
  );
}
