import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { ChartIcon, ChevronDown, ChevronLeft } from '../../components/icons';
import { Keypad } from '../../components/Keypad';
import { Alert, HoldMenu, Sheet, SheetOption, useToast, type MenuItem } from '../../components/overlays';
import { Button, cx, EmptyState, IconButton, TextField } from '../../components/ui';
import { type ActiveExercise, type ActiveWorkoutData, useActiveWorkout, useData } from '../../data/DataProvider';
import { lastSession } from '../../data/history';
import {
  addDropSet,
  addExercisesToWorkout,
  addWorkingSet,
  checkUnticked,
  deleteSet,
  discardWorkout,
  duplicateSet,
  finishWorkout,
  moveSetToTop,
  removeWorkoutExercise,
  renameWorkout,
  replaceWorkoutExercise,
  restoreSets,
  routineChanges,
  setCurrentExercise,
  setWorkoutStart,
  toggleWarmup,
  updateSet,
  type FinishCheck,
} from '../../data/workouts';
import { db } from '../../db/db';
import { muscleLabel, type Exercise, type WorkoutSet } from '../../db/types';
import { useNow } from '../../hooks/useNow';
import { fmtClock, fmtDuration, fmtTime, fromLocalInputValue, toLocalInputValue } from '../../lib/dates';
import { applyKey, parseRepsText, parseWeightText, type KeypadKey } from '../../lib/keypad';
import { describeChange, type RoutineChange } from '../../lib/routineDiff';
import { setLabels } from '../../lib/sets';
import { fromDisplay, unitLabel } from '../../lib/units';
import { variationLabels } from '../../lib/variations';
import { useGiveUp } from '../../hooks/useGiveUp';
import { ExercisePicker } from '../exercises/ExercisePicker';
import { useVariations } from '../progress/LiftViews';
import { AllExercises } from './AllExercises';
import { ExerciseMenu } from './ExerciseMenu';
import { LookbackSheet } from './LookbackSheet';
import { SetTable, weightEditText, weightFromEdit, type Field } from './SetTable';

/** 4.x: the workout in progress. No tab bar; Prev / Next move between exercises. */
export function WorkoutScreen() {
  const active = useActiveWorkout();
  const finishing = useRef(false);
  const gaveUp = useGiveUp(active === null);
  if (active === undefined) return null;
  if (active === null) return finishing.current || !gaveUp ? null : <Navigate to="/" replace />;
  return <Workout data={active} finishingRef={finishing} />;
}

type Overlay = 'options' | 'rename' | 'start' | 'exercise' | 'lookback' | 'all' | 'add' | 'replace' | 'discard' | 'remove' | null;

type FinishState =
  | { step: 'empty' }
  | { step: 'unticked'; unticked: FinishCheck['unticked'] }
  | { step: 'routine'; changes: RoutineChange[]; count: boolean };

interface Editing {
  setId: string;
  field: Field;
  text: string;
  fresh: boolean;
}

const TYPE_HINT: Record<Exercise['type'], string> = {
  weight: '',
  bodyweight: ' · bodyweight',
  bodyweight_plus: ' · bodyweight + added',
  assisted: ' · assisted',
};

function setName(label: string) {
  return label === 'W' ? 'Warm-up' : label === 'D' ? 'Drop set' : `Set ${label}`;
}

function Workout({ data, finishingRef }: { data: ActiveWorkoutData; finishingRef: RefObject<boolean> }) {
  const { workout, exercises: list } = data;
  const { settings, history, exerciseMap } = useData();
  const units = settings.units;
  const navigate = useNavigate();
  const toast = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [overlay, setOverlay] = useState<Overlay>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [holdMenu, setHoldMenu] = useState<{ set: WorkoutSet; rect: DOMRect } | null>(null);
  const [finish, setFinish] = useState<FinishState | null>(null);
  const [busy, setBusy] = useState(false);

  let idx = list.findIndex((e) => e.we.id === workout.currentExerciseId);
  if (idx < 0) idx = 0;
  const cur: ActiveExercise | undefined = list[idx];
  const ex = cur?.exercise;
  const prevEx = list[idx - 1];
  const nextEx = list[idx + 1];

  const labels = useMemo(() => setLabels(cur?.sets ?? []), [cur?.sets]);
  const previous = useMemo(() => (ex ? lastSession(history, ex.id)?.sets : undefined), [history, ex]);
  const variations = useVariations(ex);
  const varLabels = useMemo(() => variationLabels(variations), [variations]);
  const routine = useLiveQuery(() => (workout.routineId ? db.routines.get(workout.routineId) : undefined), [workout.routineId]);

  const editingSet = editing ? cur?.sets.find((s) => s.id === editing.setId) : undefined;
  const activeEdit = editingSet ? editing : null;

  const doneCount = list.filter((e) => e.sets.length > 0 && e.sets.every((s) => s.completed)).length;
  const loggedCount = list.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0);
  const allDone = !!cur && cur.sets.length > 0 && cur.sets.every((s) => s.completed);

  // Scroll the row being edited above the keypad.
  useEffect(() => {
    if (!activeEdit) return;
    const el = scrollRef.current?.querySelector(`[data-set-id="${activeEdit.setId}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeEdit?.setId]); // eslint-disable-line react-hooks/exhaustive-deps

  const jump = useCallback(
    (weId: string) => {
      setEditing(null);
      void setCurrentExercise(workout.id, weId);
      scrollRef.current?.scrollTo({ top: 0 });
    },
    [workout.id],
  );

  // ───── keypad

  const startEdit = (set: WorkoutSet, field: Field) => {
    if (!ex) return;
    const text = field === 'weight' ? weightEditText(set.weight, ex, units) : set.reps != null ? String(set.reps) : '';
    setEditing({ setId: set.id, field, text, fresh: true });
  };

  const save = (set: WorkoutSet, field: Field, text: string) => {
    if (!ex) return;
    if (field === 'weight') {
      const v = parseWeightText(text);
      void updateSet(set.id, { weight: weightFromEdit(v === undefined ? undefined : fromDisplay(v, units), ex) });
    } else {
      void updateSet(set.id, { reps: parseRepsText(text) });
    }
  };

  const onKey = (k: KeypadKey) => {
    if (!activeEdit || !editingSet || !ex) return;
    const allowNegative = activeEdit.field === 'weight' && (ex.type === 'assisted' || ex.type === 'bodyweight_plus');
    const text = applyKey(activeEdit.text, activeEdit.fresh, k, { mode: activeEdit.field, allowNegative, step: settings.weightStep });
    setEditing({ ...activeEdit, text, fresh: false });
    save(editingSet, activeEdit.field, text);
  };

  // Hardware keyboard (iPad / desktop) mirrors the keypad.
  const onKeyRef = useRef(onKey);
  onKeyRef.current = onKey;
  useEffect(() => {
    if (!activeEdit) return;
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      let k: KeypadKey | null = null;
      if (/^[0-9]$/.test(e.key)) k = { type: 'digit', d: e.key };
      else if (e.key === '.' || e.key === ',') k = { type: 'dot' };
      else if (e.key === '-') k = { type: 'minus' };
      else if (e.key === 'Backspace') k = { type: 'backspace' };
      else if (e.key === 'ArrowUp') k = { type: 'inc' };
      else if (e.key === 'ArrowDown') k = { type: 'dec' };
      else if (e.key === 'Escape' || e.key === 'Enter') {
        setEditing(null);
        e.preventDefault();
        return;
      }
      if (k) {
        e.preventDefault();
        onKeyRef.current(k);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [!!activeEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  // ───── sets

  const onToggle = (set: WorkoutSet) => {
    if (!ex) return;
    setEditing(null);
    if (set.completed) {
      void updateSet(set.id, { completed: false });
      return;
    }
    if (set.reps == null || set.reps <= 0) {
      setEditing({ setId: set.id, field: 'reps', text: '', fresh: true });
      toast({ message: 'Add the reps to tick this set', duration: 2200 });
      return;
    }
    const patch: Partial<WorkoutSet> = { completed: true };
    if (ex.type === 'weight' && set.weight == null) {
      if (ex.equipment === 'barbell') patch.weight = fromDisplay(settings.barWeight, units);
      else {
        setEditing({ setId: set.id, field: 'weight', text: '', fresh: true });
        toast({ message: 'Add the weight to tick this set', duration: 2200 });
        return;
      }
    }
    void updateSet(set.id, patch);
  };

  const onDelete = async (set: WorkoutSet) => {
    const label = setName(labels.get(set.id) ?? '');
    if (editing?.setId === set.id) setEditing(null);
    const removed = await deleteSet(set.id);
    if (removed.length)
      toast({
        message: `${label} deleted`,
        actionLabel: 'Undo',
        onAction: () => void restoreSets(removed),
      });
  };

  const holdItems = (set: WorkoutSet): MenuItem[] => {
    const items: MenuItem[] = [];
    if (set.kind !== 'drop') {
      items.push(
        set.kind === 'warmup'
          ? { label: 'Mark as working set', glyph: '1', onClick: () => void toggleWarmup(set.id) }
          : { label: 'Mark as warm-up', glyph: 'W', onClick: () => void toggleWarmup(set.id) },
      );
      items.push({ label: 'Move to top', glyph: '⤒', onClick: () => void moveSetToTop(set.id) });
    }
    items.push({ label: 'Duplicate', glyph: '⧉', onClick: () => void duplicateSet(set.id) });
    items.push({ label: 'Delete', glyph: '✕', tone: 'danger', onClick: () => void onDelete(set) });
    return items;
  };

  const addDrop = async () => {
    if (!cur || !ex) return;
    setEditing(null);
    const id = await addDropSet(cur.we.id, ex.type);
    if (!id) toast({ message: 'Tick a set first. A drop goes under the last completed set.', duration: 3000 });
  };

  const addSet = async () => {
    if (!cur) return;
    setEditing(null);
    await addWorkingSet(cur.we.id);
    window.setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50);
  };

  // ───── finishing (5.1 → 5.2 → save → 5.3)

  const complete = async (count: boolean, update: boolean) => {
    setBusy(true);
    finishingRef.current = true;
    setFinish(null);
    try {
      await finishWorkout(workout.id, { countUnticked: count, updateRoutine: update });
      navigate(`/summary/${workout.id}`, { replace: true });
    } catch (e) {
      finishingRef.current = false;
      setBusy(false);
      throw e;
    }
  };

  const routineStep = async (count: boolean, untickedCount: number) => {
    if (!loggedCount && !(count && untickedCount)) {
      setFinish({ step: 'empty' });
      return;
    }
    const changes = await routineChanges(workout.id, count);
    if (changes.length) setFinish({ step: 'routine', changes, count });
    else await complete(count, false);
  };

  const startFinish = async () => {
    setEditing(null);
    const check = await checkUnticked(workout.id, (id) => exerciseMap.get(id)?.name ?? 'Exercise');
    if (!loggedCount && !check.unticked.length) setFinish({ step: 'empty' });
    else if (check.unticked.length) setFinish({ step: 'unticked', unticked: check.unticked });
    else await routineStep(false, 0);
  };

  const discard = async () => {
    finishingRef.current = true;
    setOverlay(null);
    setFinish(null);
    await discardWorkout(workout.id);
    navigate('/', { replace: true });
  };

  // ───── picker

  const pickerCurrent = list.map((e) => {
    const done = e.sets.filter((s) => s.completed).length;
    return {
      exerciseId: e.exercise.id,
      locked: done > 0,
      sub: done && done === e.sets.length ? 'done' : done ? 'in progress' : muscleLabel(e.exercise.muscle),
    };
  });

  const onPickerDone = async ({ keep, added }: { keep: string[]; added: string[] }) => {
    setOverlay(null);
    for (const e of list) if (!keep.includes(e.exercise.id) && !e.sets.some((s) => s.completed)) await removeWorkoutExercise(e.we.id);
    if (added.length) {
      const ids = await addExercisesToWorkout(workout.id, added);
      if (ids[0]) jump(ids[0]);
    }
  };

  // ───── render

  const header = (
    <header className="flex flex-none items-center gap-1 border-b border-line py-1 pr-4 pl-1">
      <button type="button" aria-label="Leave workout (it keeps running)" onClick={() => navigate('/')} className="flex h-11 w-9 flex-none items-center justify-center text-accent">
        <ChevronLeft size={18} />
      </button>
      <button type="button" onClick={() => setOverlay('options')} className="min-w-0 flex-1 py-1 text-left" aria-label="Workout options">
        <span className="flex items-center gap-1.5 text-[17px] font-bold">
          <span className="truncate">{workout.name}</span>
          <ChevronDown size={11} className="flex-none text-fg2" />
        </span>
        <span className="block text-[12.5px] text-fg2">
          <Clock since={workout.startedAt} /> · {doneCount} of {list.length} done
        </span>
      </button>
      <button
        type="button"
        onClick={() => void startFinish()}
        disabled={busy}
        className="h-9 flex-none rounded-[9px] bg-accent px-4 text-[15px] font-semibold text-white active:opacity-80 disabled:opacity-50"
      >
        Finish
      </button>
    </header>
  );

  return (
    <div className="flex h-full flex-col">
      {header}
      <div ref={scrollRef} className="scroll-y min-h-0 flex-1 px-4 pb-6">
        {!cur || !ex ? (
          <div className="pt-20">
            <EmptyState icon="+" title="Add your first exercise">
              Pick from the library or make your own. Sets fill in from last time.
            </EmptyState>
            <Button className="mx-auto mt-6 max-w-[260px]" onClick={() => setOverlay('add')}>
              + Add exercise
            </Button>
          </div>
        ) : (
          <div key={cur.we.id} className="anim-page">
            <div className="mt-3.5 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-[22px] leading-tight font-bold tracking-[-0.01em]">{ex.name}</h1>
                <button type="button" onClick={() => setOverlay('all')} className="mt-0.5 flex h-6 items-center gap-1 text-[13px] text-fg2">
                  Exercise {idx + 1} of {list.length}
                  {TYPE_HINT[ex.type]}
                  <ChevronDown size={9} />
                </button>
              </div>
              <div className="-mt-1 -mr-1.5 flex flex-none">
                <IconButton label="History, charts and records" onClick={() => setOverlay('lookback')}>
                  <ChartIcon size={15} />
                </IconButton>
                <IconButton label="Exercise options" onClick={() => setOverlay('exercise')}>
                  •••
                </IconButton>
              </div>
            </div>

            {variations.length > 1 && (
              <div className="no-scrollbar -mx-4 mt-2.5 flex gap-1.5 overflow-x-auto px-4" role="radiogroup" aria-label="Variation">
                {variations.map((v) => {
                  const on = v.id === ex.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => !on && void replaceWorkoutExercise(cur.we.id, v.id)}
                      className={cx(
                        'h-8 flex-none rounded-[8px] border px-3 text-[13px] font-semibold whitespace-nowrap transition-colors',
                        on ? 'border-accent bg-done text-fg' : 'border-line-strong text-fg2',
                      )}
                    >
                      {varLabels.get(v.id)}
                    </button>
                  );
                })}
              </div>
            )}

            <SetTable
              exercise={ex}
              sets={cur.sets}
              previous={previous}
              units={units}
              editing={activeEdit ? { setId: activeEdit.setId, field: activeEdit.field, text: activeEdit.text } : null}
              barPlaceholderLb={ex.equipment === 'barbell' ? fromDisplay(settings.barWeight, units) : undefined}
              onEdit={startEdit}
              onToggle={onToggle}
              onToggleWarmup={(s) => void toggleWarmup(s.id)}
              onDelete={(s) => void onDelete(s)}
              onMenu={(s, rect) => setHoldMenu({ set: s, rect })}
            />
            {!cur.sets.length && <p className="py-4 text-center text-[14px] text-fg2">No sets. Add one below.</p>}

            <div className="mt-2 grid grid-cols-2 gap-2">
              <QuickButton tone="warn" onClick={() => void addDrop()}>
                + Drop
              </QuickButton>
              <QuickButton onClick={() => void addSet()}>+ Set</QuickButton>
            </div>
          </div>
        )}
      </div>

      {activeEdit && editingSet && ex ? (
        <Keypad
          title={`${setName(labels.get(editingSet.id) ?? '')} · ${activeEdit.field === 'weight' ? 'Weight' : 'Reps'}`}
          mode={activeEdit.field}
          onModeChange={
            ex.type === 'bodyweight'
              ? undefined
              : (m) => {
                  if (m !== activeEdit.field) startEdit(editingSet, m);
                }
          }
          weightLabel={unitLabel(units) === 'lb' ? 'lbs' : 'kg'}
          stepLabel={`${settings.weightStep} ${unitLabel(units)}`}
          allowNegative={activeEdit.field === 'weight' && (ex.type === 'assisted' || ex.type === 'bodyweight_plus')}
          onKey={onKey}
          onClose={() => setEditing(null)}
        />
      ) : (
        cur && (
          <nav className="grid flex-none grid-cols-2 gap-2 border-t border-line px-3 pt-2.5 pb-[max(10px,env(safe-area-inset-bottom))]" aria-label="Exercises" data-dock>
            {prevEx ? (
              <NavButton small="Prev" onClick={() => jump(prevEx.we.id)} side="left">
                {prevEx.exercise.name}
              </NavButton>
            ) : (
              <NavButton small="No previous" onClick={() => setOverlay('all')} tone="white">
                All exercises
              </NavButton>
            )}
            {nextEx ? (
              <NavButton small="Next" onClick={() => jump(nextEx.we.id)} side="right" tone={allDone ? 'accent' : undefined}>
                {nextEx.exercise.name}
              </NavButton>
            ) : (
              <NavButton small="Last one" onClick={() => setOverlay('all')} tone="white" align="right">
                All exercises
              </NavButton>
            )}
          </nav>
        )
      )}

      {/* ───── overlays */}

      <HoldMenu open={!!holdMenu} anchor={holdMenu?.rect} items={holdMenu ? holdItems(holdMenu.set) : []} onClose={() => setHoldMenu(null)} />

      <WorkoutOptions
        open={overlay === 'options'}
        name={workout.name}
        startedAt={workout.startedAt}
        onClose={() => setOverlay(null)}
        onRename={() => setOverlay('rename')}
        onStart={() => setOverlay('start')}
        onDiscard={() => setOverlay('discard')}
      />
      <RenameSheet open={overlay === 'rename'} name={workout.name} onClose={() => setOverlay(null)} onSave={(n) => void renameWorkout(workout.id, n)} />
      <StartTimeSheet open={overlay === 'start'} startedAt={workout.startedAt} onClose={() => setOverlay(null)} onSave={(t) => void setWorkoutStart(workout.id, t)} />
      <Alert
        open={overlay === 'discard'}
        title={`Discard ${workout.name}?`}
        message={loggedCount ? `Delete ${loggedCount} logged ${loggedCount === 1 ? 'set' : 'sets'}? This can't be undone.` : 'Nothing has been logged yet.'}
        onClose={() => setOverlay(null)}
        actions={[
          { label: 'Discard workout', kind: 'danger', onClick: () => void discard() },
          { label: 'Cancel', onClick: () => setOverlay(null) },
        ]}
      />

      <ExerciseMenu
        exercise={ex}
        open={overlay === 'exercise'}
        onClose={() => setOverlay((o) => (o === 'exercise' ? null : o))}
        onSwitch={(id) => cur && void replaceWorkoutExercise(cur.we.id, id)}
        onLinkVariations={() => ex && navigate(`/exercises/${ex.id}?link=1`)}
        onReplace={() => setOverlay('replace')}
        onLookback={() => setOverlay('lookback')}
        onSettings={() => ex && navigate(`/exercises/${ex.id}`)}
        onRemove={() => {
          if (!cur) return;
          if (cur.sets.some((s) => s.completed)) setOverlay('remove');
          else void removeWorkoutExercise(cur.we.id);
        }}
      />
      <Alert
        open={overlay === 'remove'}
        title={`Remove ${ex?.name ?? 'exercise'}?`}
        message={(() => {
          const n = cur?.sets.filter((s) => s.completed).length ?? 0;
          return `${n} logged ${n === 1 ? 'set' : 'sets'} will be deleted from today's workout.`;
        })()}
        onClose={() => setOverlay(null)}
        actions={[
          {
            label: 'Remove',
            kind: 'danger',
            onClick: () => {
              setOverlay(null);
              if (cur) void removeWorkoutExercise(cur.we.id);
            },
          },
          { label: 'Cancel', onClick: () => setOverlay(null) },
        ]}
      />

      <LookbackSheet
        exercise={ex}
        open={overlay === 'lookback'}
        onClose={() => setOverlay(null)}
        currentReps={cur?.sets.find((s) => !s.completed && s.kind === 'working')?.reps}
      />

      <AllExercises open={overlay === 'all'} exercises={list} currentId={cur?.we.id} onClose={() => setOverlay(null)} onJump={jump} onAdd={() => setOverlay('add')} />

      <ExercisePicker
        open={overlay === 'add'}
        mode="multi"
        currentLabel="In this workout"
        current={pickerCurrent}
        onCancel={() => setOverlay(null)}
        onDone={(r) => void onPickerDone(r)}
      />
      <ExercisePicker
        open={overlay === 'replace'}
        mode="single"
        title={ex ? `Replace ${ex.name}` : 'Replace'}
        excludeIds={ex ? [ex.id] : []}
        onCancel={() => setOverlay(null)}
        onPick={(id) => {
          setOverlay(null);
          if (cur) void replaceWorkoutExercise(cur.we.id, id);
        }}
      />

      {/* 5.1 */}
      <Alert
        open={finish?.step === 'unticked'}
        title={(() => {
          const n = finish?.step === 'unticked' ? finish.unticked.length : 0;
          return n === 1 ? "1 set isn't ticked" : `${n} sets aren't ticked`;
        })()}
        message={finish?.step === 'unticked' ? untickedMessage(finish.unticked.map((u) => u.label)) : undefined}
        onClose={() => setFinish(null)}
        actions={[
          { label: 'Count them and finish', kind: 'bold', onClick: () => finish?.step === 'unticked' && void routineStep(true, finish.unticked.length) },
          { label: 'Drop them and finish', onClick: () => void routineStep(false, 0) },
          { label: 'Keep going', onClick: () => setFinish(null) },
        ]}
      />
      <Alert
        open={finish?.step === 'empty'}
        title="Nothing logged yet"
        message="Tick at least one set to save this workout, or discard it."
        onClose={() => setFinish(null)}
        actions={[
          { label: 'Keep going', kind: 'bold', onClick: () => setFinish(null) },
          { label: 'Discard workout', kind: 'danger', onClick: () => void discard() },
        ]}
      />
      {/* 5.2 */}
      <Sheet
        open={finish?.step === 'routine'}
        onClose={() => setFinish(null)}
        title={`Update ${routine?.name ?? 'routine'}?`}
        subtitle="You changed the routine during this workout."
      >
        {finish?.step === 'routine' && (
          <>
            {finish.changes.map((c, i) => {
              const d = describeChange(c, (id) => exerciseMap.get(id)?.name ?? 'Exercise');
              return (
                <div key={i} className="flex gap-3 border-b border-line py-2.5 text-[15px]">
                  <i className={cx('w-4 flex-none text-center font-extrabold not-italic', d.sign === '+' ? 'text-tip' : d.sign === '−' ? 'text-danger' : 'text-accent')}>{d.sign}</i>
                  <span className="min-w-0">{d.text}</span>
                </div>
              );
            })}
            <p className="mt-2.5 text-[13px] text-fg2">Weights and reps never count as changes. They always come from last time.</p>
            <div className="mt-4 flex flex-col gap-2">
              <Button disabled={busy} onClick={() => void complete(finish.count, true)}>
                Update {routine?.name ?? 'routine'}
              </Button>
              <Button kind="secondary" disabled={busy} onClick={() => void complete(finish.count, false)}>
                Just this time
              </Button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}

function untickedMessage(labels: string[]): string {
  const shown = labels.slice(0, 2);
  const more = labels.length - shown.length;
  const list = more > 0 ? `${shown.join(', ')} and ${more} more` : shown.join(' and ');
  const verb = labels.length === 1 ? 'still has numbers but wasn’t completed.' : 'still have numbers but weren’t completed.';
  return `${list.charAt(0).toUpperCase()}${list.slice(1)} ${verb}`;
}

function Clock({ since }: { since: number }) {
  const now = useNow(1000);
  return <span className="tabular-nums">{fmtClock(Math.max(0, now - since))}</span>;
}

function QuickButton({ children, onClick, tone }: { children: ReactNode; onClick: () => void; tone?: 'warn' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx('flex h-11 items-center justify-center rounded-[10px] bg-surface-2 text-[15px] font-semibold active:opacity-70', tone === 'warn' ? 'text-warn' : 'text-accent')}
    >
      {children}
    </button>
  );
}

function NavButton({
  children,
  small,
  onClick,
  side,
  tone,
  align,
}: {
  children: ReactNode;
  small: string;
  onClick: () => void;
  side?: 'left' | 'right';
  tone?: 'white' | 'accent';
  align?: 'right';
}) {
  const right = side === 'right' || align === 'right';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex h-[50px] min-w-0 items-center gap-2 rounded-[11px] px-3 transition-colors active:opacity-80',
        right ? 'justify-end text-right' : 'text-left',
        tone === 'white' ? 'bg-fg text-bg' : tone === 'accent' ? 'bg-accent text-white' : 'bg-surface-2 text-fg',
      )}
    >
      {side === 'left' && <span className="text-[19px] text-fg2">‹</span>}
      <span className="min-w-0">
        <small className={cx('block text-[10px] font-bold tracking-[0.05em] uppercase', tone === 'white' ? 'text-[#555]' : tone === 'accent' ? 'text-white/75' : 'text-fg2')}>{small}</small>
        <span className="block truncate text-[14px] font-semibold">{children}</span>
      </span>
      {side === 'right' && <span className={cx('text-[19px]', tone === 'accent' ? 'text-white/80' : 'text-fg2')}>›</span>}
    </button>
  );
}

// ───────────────────────────── 5.4 workout options

function WorkoutOptions({
  open,
  name,
  startedAt,
  onClose,
  onRename,
  onStart,
  onDiscard,
}: {
  open: boolean;
  name: string;
  startedAt: number;
  onClose: () => void;
  onRename: () => void;
  onStart: () => void;
  onDiscard: () => void;
}) {
  const now = useNow(30_000);
  return (
    <Sheet open={open} onClose={onClose} title={name} subtitle={`Started ${fmtTime(startedAt)} · ${fmtDuration(now - startedAt)}`}>
      <SheetOption onClick={onRename}>Rename this workout</SheetOption>
      <SheetOption onClick={onStart} detail={fmtTime(startedAt)}>
        Change start time
      </SheetOption>
      <SheetOption tone="danger" onClick={onDiscard} detail="asks first">
        Discard workout
      </SheetOption>
    </Sheet>
  );
}

function RenameSheet({ open, name, onClose, onSave }: { open: boolean; name: string; onClose: () => void; onSave: (n: string) => void }) {
  const [value, setValue] = useState(name);
  useEffect(() => {
    if (open) setValue(name);
  }, [open, name]);
  const submit = () => {
    if (value.trim()) onSave(value.trim());
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Rename workout">
      <TextField value={value} onChange={setValue} autoFocus onEnter={submit} placeholder="Workout name" />
      <p className="mt-2 text-[13px] text-fg2">Only this workout. The routine keeps its name.</p>
      <Button className="mt-4" onClick={submit} disabled={!value.trim()}>
        Save
      </Button>
    </Sheet>
  );
}

function StartTimeSheet({ open, startedAt, onClose, onSave }: { open: boolean; startedAt: number; onClose: () => void; onSave: (t: number) => void }) {
  const [value, setValue] = useState(toLocalInputValue(startedAt));
  useEffect(() => {
    if (open) setValue(toLocalInputValue(startedAt));
  }, [open, startedAt]);
  const ts = fromLocalInputValue(value);
  const invalid = !ts || ts > Date.now();
  return (
    <Sheet open={open} onClose={onClose} title="Change start time" subtitle="For when you forgot to press start. The clock counts from here.">
      <input
        type="datetime-local"
        value={value}
        max={toLocalInputValue(Date.now())}
        onChange={(e) => setValue(e.target.value)}
        className="mt-2 h-12 w-full rounded-[10px] bg-surface-2 px-3 text-[17px] text-fg outline-none focus:ring-2 focus:ring-accent"
      />
      {ts && ts > Date.now() && <p className="mt-1.5 text-[13px] font-semibold text-danger">That's in the future.</p>}
      <Button
        className="mt-4"
        disabled={invalid}
        onClick={() => {
          if (ts) onSave(ts);
          onClose();
        }}
      >
        Save
      </Button>
    </Sheet>
  );
}
