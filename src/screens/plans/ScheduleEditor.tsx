import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { CheckGlyph, ChevronLeft, ChevronRight, Handle } from '../../components/icons';
import { Sheet, SheetOption } from '../../components/overlays';
import { BackButton, BarButton, cx, Note, Radio, Screen, SectionLabel, Segmented, TopBar } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { saveSchedule, usePlanView, type PlanView } from '../../data/schedule';
import { usePlans } from '../../data/usePlans';
import type { Folder, MissPolicy, ScheduleSlot } from '../../db/types';
import { useGiveUp } from '../../hooks/useGiveUp';
import { dayKey, fmtDay, fmtMonthDay, startOfWeek, weekdayShort } from '../../lib/dates';
import { addDayKey, applyOverrides, resetDayPatch, currentVersion, DEFAULT_MISS, parseDayKey, planDays, suggestDays, trainedByDay, weekOrder, withScheduleFrom, type ScheduleDraft, type PlanDay, type OverridePatch } from '../../lib/schedule';
import { DaySheet, PlanGrid } from './PlanParts';

const LONG_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DRAFT_KEY = (folderId: string) => `og-schedule-draft:${folderId}`;
/** Written by the builder after "+ Add workout for this day" (2.19). */
export const ASSIGN_KEY = 'og-schedule-assign';

type Step = 'type' | 'cycle' | 'weekly';
type Kind = 'none' | 'cycle' | 'weekly';

interface CycleDay {
  key: string;
  slot: ScheduleSlot;
}

interface Draft {
  step: Step;
  kind: Kind;
  cycle: CycleDay[];
  weekly: ScheduleSlot[];
  todayIndex: number;
  missCycle: MissPolicy;
  missWeekly: MissPolicy;
  overrides?: OverridePatch;
}

export interface PendingAssign {
  folderId: string;
  kind: 'cycle' | 'weekly';
  index: number;
  routineId: string;
}

let keySeq = 0;
const newKey = () => `d${Date.now().toString(36)}${(keySeq++).toString(36)}`;

function readSession<T>(key: string): T | undefined {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

/** 2.16–2.19: pick no schedule, a repeating cycle or a weekly split, then lay it out. */
export function ScheduleEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const plans = usePlans();
  const folder = plans?.folders.find((f) => f.id === id);
  const view = usePlanView(folder, 0, 0);
  const gaveUp = useGiveUp(!!plans && !folder);
  if (!plans || !view) return null;
  if (!folder) {
    if (!gaveUp) return null;
    return (
      <Screen header={<TopBar left={<BackButton label="Plans" onClick={() => navigate('/plans')} />} />}>
        <p className="mt-10 text-center text-[15px] text-fg2">This plan was deleted.</p>
      </Screen>
    );
  }
  return <Editor key={folder.id} folder={folder} view={view} />;
}

function initialDraft(folder: Folder, view: PlanView): Draft {
  const saved = readSession<Draft>(DRAFT_KEY(folder.id));
  const pending = readSession<PendingAssign>(ASSIGN_KEY);
  if (saved) {
    if (pending?.folderId === folder.id) {
      if (pending.kind === 'cycle' && saved.cycle[pending.index]) saved.cycle[pending.index] = { ...saved.cycle[pending.index], slot: pending.routineId };
      if (pending.kind === 'weekly') saved.weekly[pending.index] = pending.routineId;
    }
    return { ...saved, overrides: saved.overrides ?? folder.schedule?.overrides ?? {} };
  }
  const v = view.scheduled ? currentVersion(folder.schedule, view.today) : undefined;
  const ids = (view.plans.byFolder.get(folder.id) ?? []).map((r) => r.id);
  return {
    step: 'type',
    overrides: folder.schedule?.overrides ?? {},
    kind: v?.kind ?? 'none',
    cycle: (v?.kind === 'cycle' ? v.days : suggestDays('cycle', ids)).map((slot) => ({ key: newKey(), slot })),
    weekly: v?.kind === 'weekly' ? [...v.days] : suggestDays('weekly', ids),
    todayIndex: v?.kind === 'cycle' ? (view.days[0]?.cycleDay ?? 0) : 0,
    missCycle: v?.kind === 'cycle' ? v.onMiss : DEFAULT_MISS.cycle,
    missWeekly: v?.kind === 'weekly' ? v.onMiss : DEFAULT_MISS.weekly,
  };
}

function toScheduleDraft(d: Draft, kind: Kind = d.kind): ScheduleDraft {
  if (kind === 'cycle') return { kind, days: d.cycle.map((c) => c.slot), todayIndex: Math.min(d.todayIndex, d.cycle.length - 1), onMiss: d.missCycle };
  if (kind === 'weekly') return { kind, days: d.weekly, todayIndex: 0, onMiss: d.missWeekly };
  return { kind: 'none', days: [], todayIndex: 0, onMiss: 'skip' };
}

function Editor({ folder, view }: { folder: Folder; view: PlanView }) {
  const navigate = useNavigate();
  const { settings, history } = useData();
  const [draft, setDraft] = useState<Draft>(() => initialDraft(folder, view));
  const [assign, setAssign] = useState<{ kind: 'cycle' | 'weekly'; index: number } | null>(null);
  const [pickToday, setPickToday] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  const [sheetDay, setSheetDay] = useState<PlanDay | null>(null);
  const { today, plans } = view;
  const routines = plans.byFolder.get(folder.id) ?? [];
  const exCount = (rid: string) => plans.exercisesByRoutine.get(rid)?.length ?? 0;
  const name = view.routineName;

  // The round trip through the builder is over once we're back.
  useEffect(() => {
    sessionStorage.removeItem(DRAFT_KEY(folder.id));
    sessionStorage.removeItem(ASSIGN_KEY);
  }, [folder.id]);

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const leave = () => (window.history.length > 1 ? navigate(-1) : navigate(`/plan/${folder.id}`, { replace: true }));

  const save = async (kind: Kind) => {
    setSaving(true);
    try {
      await saveSchedule(folder.id, toScheduleDraft(draft, kind), draft.overrides);
      leave();
    } finally {
      setSaving(false);
    }
  };

  // 2.20 / 2.16–2.19: the calendar previews every unsaved schedule change.
  const trained = useMemo(() => trainedByDay(history.workouts.map((w) => w.workout)), [history]);
  const from = addDayKey(dayKey(startOfWeek(parseDayKey(today), settings.weekStart)), -7 + page * 28);
  const draftSchedule = useMemo(() => {
    const schedule = withScheduleFrom(folder.schedule, toScheduleDraft(draft), today);
    return schedule ? applyOverrides(schedule, draft.overrides ?? {}) : undefined;
  }, [folder.schedule, draft, today]);
  const preview = useMemo<PlanDay[]>(() => {
    const schedule = draftSchedule;
    const live = new Set(plans.routines.map((r) => r.id));
    if (schedule) return planDays({ schedule, trained, today, from, to: addDayKey(from, 34), weekStart: settings.weekStart, exists: (rid) => live.has(rid) });
    return Array.from({ length: 35 }, (_, i) => {
      const key = addDayKey(from, i);
      return { key, ts: parseDayKey(key), state: 'off' as const, changed: false, doneIds: [] };
    });
  }, [draftSchedule, today, from, trained, plans.routines, settings.weekStart]);

  const newRoutineFor = (kind: 'cycle' | 'weekly', index: number) => {
    sessionStorage.setItem(DRAFT_KEY(folder.id), JSON.stringify(draft));
    setAssign(null);
    navigate(`/routine/new?folder=${folder.id}&slot=${kind}:${index}`);
  };

  const setSlot = (slot: ScheduleSlot) => {
    if (!assign) return;
    if (assign.kind === 'cycle') patch({ cycle: draft.cycle.map((c, i) => (i === assign.index ? { ...c, slot } : c)) });
    else patch({ weekly: draft.weekly.map((s, i) => (i === assign.index ? slot : s)) });
    setAssign(null);
  };

  const assignSlot = assign ? (assign.kind === 'cycle' ? draft.cycle[assign.index]?.slot : draft.weekly[assign.index]) : undefined;

  const assignSheet = (
    <Sheet
      open={!!assign}
      onClose={() => setAssign(null)}
      title={assign ? (assign.kind === 'weekly' ? LONG_DAYS[assign.index] : `Day ${assign.index + 1}`) : ''}
      subtitle={assign ? (assign.kind === 'weekly' ? `Pick what to do on ${LONG_DAYS[assign.index]}s.` : `Pick what to do on day ${assign.index + 1}.`) : undefined}
    >
      {routines.map((r) => (
        <SheetOption
          key={r.id}
          onClick={() => setSlot(r.id)}
          detail={
            <>
              {exCount(r.id)} exercises
              <Radio on={assignSlot === r.id} />
            </>
          }
        >
          {r.name}
        </SheetOption>
      ))}
      {assignSlot && !routines.some((r) => r.id === assignSlot) && (
        <SheetOption onClick={() => setAssign(null)} detail={<Radio on />}>
          {name(assignSlot)}
        </SheetOption>
      )}
      <SheetOption onClick={() => setSlot(null)} detail={<Radio on={assignSlot === null} />}>
        <span className="text-fg2">Rest</span>
      </SheetOption>
      {assign && (
        <SheetOption tone="accent" onClick={() => newRoutineFor(assign.kind, assign.index)}>
          + Add workout for this day
        </SheetOption>
      )}
      {assign?.kind === 'cycle' && draft.cycle.length > 1 && (
        <SheetOption
          tone="danger"
          onClick={() => {
            const i = assign.index;
            patch({ cycle: draft.cycle.filter((_, j) => j !== i), todayIndex: Math.min(draft.todayIndex, draft.cycle.length - 2) });
            setAssign(null);
          }}
        >
          Remove this day
        </SheetOption>
      )}
    </Sheet>
  );

  const todayWd = new Date(parseDayKey(today)).getDay();
  const workouts = draft.weekly.filter(Boolean).length;
  const day1 = addDayKey(today, -Math.min(draft.todayIndex, draft.cycle.length - 1));
  return (
    <Screen header={<TopBar
      left={<BackButton iconSize={14} label={folder.name} onClick={leave} />}
      title="Schedule"
      right={<BarButton kind="bold" disabled={saving} onClick={() => void save(draft.kind)}>Save</BarButton>}
    />}>
      <div className="mt-3 flex items-center justify-between">
        <button type="button" aria-label="Earlier" onClick={() => setPage((p) => p - 1)} className="-ml-2 flex h-11 w-11 items-center justify-center text-accent"><ChevronLeft size={12} /></button>
        <b className="text-[16px] font-bold tabular-nums">{fmtMonthDay(preview[0].ts)} – {fmtMonthDay(preview[27].ts)}</b>
        <button type="button" aria-label="Later" onClick={() => setPage((p) => p + 1)} className="-mr-2 flex h-11 w-11 items-center justify-center text-accent"><ChevronRight size={12} /></button>
      </div>
      <PlanGrid days={preview.slice(0, 28)} codes={view.codes} today={today} weekStart={settings.weekStart} onOpen={(d) => {
        if (d.key >= today && draftSchedule) setSheetDay(d);
      }} />
      {sheetDay && draftSchedule && <DaySheet
        folder={{ ...folder, schedule: draftSchedule }}
        day={sheetDay}
        view={{ ...view, days: preview }}
        onClose={() => setSheetDay(null)}
        onApply={(changes) => patch({ overrides: applyOverrides(draftSchedule, changes).overrides })}
        onReset={(key) => patch({ overrides: applyOverrides(draftSchedule, resetDayPatch(draftSchedule, key)).overrides })}
      />}
      {/* PH3.13: clearing only updates the draft; Save commits it. */}
      <SectionLabel className="-mt-2!" action={
        <button type="button" onClick={() => patch({ overrides: Object.fromEntries(Object.entries(draft.overrides ?? {}).filter(([key]) => key < today)) })} className="flex min-h-11 items-end text-[13px] leading-[16px] font-semibold tracking-normal text-danger normal-case active:opacity-70">
          Clear changes
        </button>
      }>Schedule type</SectionLabel>
      <Segmented className="mt-3" options={[
        { value: 'none' as Kind, label: 'No schedule' },
        { value: 'weekly' as Kind, label: 'Weekly split' },
        { value: 'cycle' as Kind, label: 'Repeating cycle' },
      ]} value={draft.kind} onChange={(kind) => patch({ kind })} />
      {draft.kind === 'none' && <Note>Whatever you did longest ago is next. Train when you can.</Note>}
      {draft.kind === 'weekly' && <>
      <SectionLabel action={<span className="text-[12px] font-semibold tracking-normal text-fg2 normal-case">tap a day to change</span>}>Each week</SectionLabel>
        {weekOrder(settings.weekStart).map((wd) => {
          const slot = draft.weekly[wd];
          const isToday = wd === todayWd;
          return (
            <button key={wd} type="button" onClick={() => setAssign({ kind: 'weekly', index: wd })} className="flex min-h-[52px] w-full items-center gap-3 border-b border-line text-left active:bg-surface/60">
              <span className={cx('w-[52px] flex-none text-[15px] font-semibold', isToday ? 'text-accent' : 'text-fg')}>
                {weekdayShort(wd)}
                {isToday && <small className="block text-[11px] leading-none font-medium text-fg2">today</small>}
              </span>
              <span className={cx('min-w-0 flex-1 truncate text-[16px]', slot ? 'font-semibold' : 'text-fg2')}>{slot ? name(slot) : 'Rest'}</span>
              <ChevronRight size={13} className="flex-none text-fg3" />
            </button>
          );
        })}
        <SectionLabel>If you miss a day</SectionLabel>
        <Segmented
          className="mt-3"
          options={[
            { value: 'skip' as MissPolicy, label: 'Skip it' },
            { value: 'rest' as MissPolicy, label: 'Move to rest day' },
          ]}
          value={draft.missWeekly}
          onChange={(v) => patch({ missWeekly: v })}
        />
        <Note>
          {draft.missWeekly === 'skip' ? 'Skip: a missed workout stays missed. Home offers to do it the next day.' : 'Move: a missed workout slides into the next rest day that week.'}
        </Note>
        <Note className="tabular-nums">
          {workouts} {workouts === 1 ? 'workout' : 'workouts'} a week · weeks start {settings.weekStart === 1 ? 'Monday' : 'Sunday'} (Settings).
        </Note>
      </>}
      {draft.kind === 'cycle' && <>
      <SectionLabel action={<span className="text-[12px] font-semibold tracking-normal text-fg2 normal-case">drag to reorder</span>}>
        {`Cycle · ${draft.cycle.length} ${draft.cycle.length === 1 ? 'day' : 'days'}`}
      </SectionLabel>
      <CycleList
        days={draft.cycle}
        todayIndex={draft.todayIndex}
        name={name}
        onReorder={(cycle) => patch({ cycle })}
        onOpen={(index) => setAssign({ kind: 'cycle', index })}
      />
      <button
        type="button"
        onClick={() => patch({ cycle: [...draft.cycle, { key: newKey(), slot: null }] })}
        className="flex h-12 w-full items-center gap-2.5 border-b border-line text-[16px] font-semibold text-accent active:opacity-70"
      >
        <span className="flex h-[24px] w-[24px] items-center justify-center rounded-full bg-accent text-[17px] text-white">+</span>
        Add a day
      </button>

      <SectionLabel>Starts</SectionLabel>
      <button type="button" onClick={() => setPickToday(true)} className="flex min-h-[52px] w-full items-center gap-3 border-b border-line text-left active:bg-surface/60">
        <span className="flex-1 text-[16px] font-semibold">Day 1 is</span>
        <span className="text-[15px] text-fg2 tabular-nums">{day1 === today ? `Today, ${fmtDay(parseDayKey(day1)).replace(',', '')}` : fmtDay(parseDayKey(day1))}</span>
        <ChevronRight size={13} className="flex-none text-fg3" />
      </button>

      <SectionLabel>If you miss a day</SectionLabel>
      <Segmented
        className="mt-3"
        options={[
          { value: 'wait' as MissPolicy, label: 'Wait for me' },
          { value: 'stick' as MissPolicy, label: 'Stick to dates' },
        ]}
        value={draft.missCycle}
        onChange={(v) => patch({ missCycle: v })}
      />
      <Note>Wait: the cycle pauses until you train. Stick: missed days are skipped.</Note>

      </>}
      <Sheet open={pickToday} onClose={() => setPickToday(false)} title="Which day is today?" subtitle="Day 1 is counted back from your pick.">
        {draft.cycle.map((c, i) => (
          <SheetOption
            key={c.key}
            onClick={() => {
              patch({ todayIndex: i });
              setPickToday(false);
            }}
            detail={i === draft.todayIndex ? <CheckGlyph size={15} className="text-accent" /> : undefined}
          >
            Day {i + 1} · {c.slot ? name(c.slot) : 'Rest'}
          </SheetOption>
        ))}
      </Sheet>
      {assignSheet}
    </Screen>
  );
}

function CycleList({
  days,
  todayIndex,
  name,
  onReorder,
  onOpen,
}: {
  days: CycleDay[];
  todayIndex: number;
  name: (id: string | null | undefined) => string;
  onReorder: (days: CycleDay[]) => void;
  onOpen: (index: number) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onReorder(arrayMove(days, days.findIndex((d) => d.key === active.id), days.findIndex((d) => d.key === over.id)));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={days.map((d) => d.key)} strategy={verticalListSortingStrategy}>
        {days.map((d, i) => (
          <CycleRow key={d.key} day={d} index={i} isToday={i === todayIndex} label={d.slot ? name(d.slot) : 'Rest'} onOpen={() => onOpen(i)} />
        ))}
      </SortableContext>
    </DndContext>
  );
}

function CycleRow({ day, index, isToday, label, onOpen }: { day: CycleDay; index: number; isToday: boolean; label: string; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: day.key });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={cx('flex min-h-[52px] items-center gap-2 border-b border-line bg-bg', isDragging && 'relative z-10 opacity-80')}>
      <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={`Reorder day ${index + 1}`} className="-ml-2 flex h-11 w-11 flex-none touch-none items-center justify-center text-fg3">
        <Handle />
      </button>
      <button type="button" onClick={onOpen} className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 text-left active:opacity-70">
        <span className="w-[48px] flex-none text-[11px] font-bold tracking-[0.06em] text-fg2 tabular-nums">DAY {index + 1}</span>
        <span className={cx('min-w-0 flex-1 truncate text-[16px]', day.slot ? 'font-semibold' : 'text-fg2')}>
          {label}
          {isToday && <small className="ml-2 text-[12px] font-medium text-accent">today</small>}
        </span>
        <ChevronRight size={13} className="flex-none text-fg3" />
      </button>
    </div>
  );
}
