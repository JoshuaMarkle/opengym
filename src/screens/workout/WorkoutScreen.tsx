import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { ChartIcon, CheckGlyph, ChevronDown, ChevronLeft } from '../../components/icons';
import { EffortPad, PadClose } from '../../components/Effort';
import { BarChip, Keypad, ModeTabs, type KeypadTab } from '../../components/Keypad';
import { Alert, HoldMenu, Sheet, SheetOption, useToast, type MenuItem } from '../../components/overlays';
import { BarPicker, PlatePad } from '../../components/PlatePad';
import { Button, cx, EmptyState, IconButton, TextField } from '../../components/ui';
import { type ActiveExercise, type ActiveWorkoutData, useActiveWorkout, useData } from '../../data/DataProvider';
import { setExercisePrefs } from '../../data/exercises';
import { updateSettings } from '../../data/settings';
import { tipForExercise, weightsBySet, workoutTraining } from '../../data/training';
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
  linkWorkoutSuperset,
  moveSetToTop,
  removeWorkoutExercise,
  renameWorkout,
  replaceWorkoutExercise,
  restoreSets,
  restoreWorkoutExercise,
  routineChanges,
  setCurrentExercise,
  setWorkoutStart,
  applySuggestion,
  revertSuggestion,
  setGapAnswer,
  setSuggestion,
  toggleWarmup,
  unlinkWorkoutSuperset,
  updateSet,
  type FinishCheck,
} from '../../data/workouts';
import { db } from '../../db/db';
import { muscleLabel, type Exercise, type WorkoutSet } from '../../db/types';
import { useNow } from '../../hooks/useNow';
import {
  CARDIO_VALUE_KEYS,
  cardioFields,
  cardioSummary,
  editTextOf,
  FIELD_NAME,
  fieldPatch,
  fieldTab,
  fieldValue,
  keypadFor,
  parseFieldText,
  segmentPlaceholders,
  type CardioField,
  type CardioValues,
} from '../../lib/cardio';
import { carryOver } from '../../lib/carryOver';
import { asksEffort, EFFORT_LABEL, takesEffort } from '../../lib/effort';
import { fmtClock, fmtDuration, fmtMonthDay, fmtTime, fromLocalInputValue, toLocalInputValue } from '../../lib/dates';
import { applyKey, parseRepsText, parseWeightText, type KeypadKey, type KeypadOptions } from '../../lib/keypad';
import { barShortLabel, hasPlatePad } from '../../lib/plates';
import { describeChange, type RoutineChange } from '../../lib/routineDiff';
import { formatSet, hasWeightColumn, setLabels, workingIndex } from '../../lib/sets';
import { isFolded, nextTarget, supersetBlocks, supersetRound, supersetTags, type MemberSets } from '../../lib/supersets';
import { displayWeight, formatNumber, fromDisplay, unitLabel } from '../../lib/units';
import { variationLabels } from '../../lib/variations';
import { useGiveUp } from '../../hooks/useGiveUp';
import { ExercisePicker } from '../exercises/ExercisePicker';
import { useVariations } from '../progress/LiftViews';
import { AllExercises } from './AllExercises';
import { CardioTable } from './CardioTable';
import { ExerciseMenu } from './ExerciseMenu';
import { LookbackSheet } from './LookbackSheet';
import { SetTable, weightEditText, weightFromEdit } from './SetTable';
import { SupersetSheet } from './SupersetSheet';
import { barState, GapPrompt, hintsFor, TipLine, TrainingBar, WhySheet } from './Training';

/** 4.x: the workout in progress. No tab bar; Prev / Next move between exercises. */
export function WorkoutScreen() {
  const active = useActiveWorkout();
  const finishing = useRef(false);
  const gaveUp = useGiveUp(active === null);
  if (active === undefined) return null;
  if (active === null) return finishing.current || !gaveUp ? null : <Navigate to="/" replace />;
  return <Workout data={active} finishingRef={finishing} />;
}

type Overlay =
  | 'options'
  | 'rename'
  | 'start'
  | 'exercise'
  | 'lookback'
  | 'add'
  | 'replace'
  | 'discard'
  | 'remove'
  | 'superset'
  | 'supersetAdd'
  | 'bar'
  | null;

type FinishState =
  | { step: 'empty' }
  | { step: 'unticked'; unticked: FinishCheck['unticked'] }
  | { step: 'routine'; changes: RoutineChange[]; count: boolean };

/** The box being typed into: 'weight' | 'reps' for lifts, a CardioField for cardio. */
interface Editing {
  setId: string;
  field: string;
  text: string;
  fresh: boolean;
}

const TYPE_HINT: Record<Exercise['type'], string> = {
  weight: '',
  bodyweight: ' · bodyweight',
  bodyweight_plus: ' · bodyweight + added',
  assisted: ' · assisted',
  cardio: ' · cardio',
};

function setName(label: string, cardio = false) {
  if (cardio) return `Segment ${label}`;
  return label === 'W' ? 'Warm-up' : label === 'D' ? 'Drop set' : `Set ${label}`;
}

/** The boxes in a row, left to right: what Next walks through. */
function fieldsOf(ex: Exercise): string[] {
  if (ex.type === 'cardio') return cardioFields(ex);
  return hasWeightColumn(ex.type) ? ['weight', 'reps'] : ['reps'];
}

const isCardioField = (f: string): f is CardioField => f !== 'weight' && f !== 'reps' && f !== 'effort';

function cardioOf(s: CardioValues): CardioValues {
  const out: CardioValues = {};
  for (const k of CARDIO_VALUE_KEYS) if (s[k] != null) out[k] = s[k];
  return out;
}

function Workout({ data, finishingRef }: { data: ActiveWorkoutData; finishingRef: RefObject<boolean> }) {
  const { workout, exercises: list } = data;
  const { settings, history, exerciseMap } = useData();
  const units = settings.units;
  const navigate = useNavigate();
  const toast = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [overlay, setOverlay] = useState<Overlay>(null);
  // 4.12: the exercise list replaces everything under the workout header.
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [holdMenu, setHoldMenu] = useState<{ member: ActiveExercise; set: WorkoutSet; rect: DOMRect } | null>(null);
  const [finish, setFinish] = useState<FinishState | null>(null);
  const [busy, setBusy] = useState(false);
  const [supersetPre, setSupersetPre] = useState<string[]>([]);
  // Plates vs 123, per exercise, ahead of the saved preference catching up.
  const [padPref, setPadPref] = useState<Record<string, boolean>>({});
  // Training (4.27–4.33): the Why sheet's exercise, and gap questions put off for today.
  const [whyId, setWhyId] = useState<string | null>(null);
  const [gapLater, setGapLater] = useState<string[]>([]);

  let idx = list.findIndex((e) => e.we.id === workout.currentExerciseId);
  if (idx < 0) idx = 0;
  const cur: ActiveExercise | undefined = list[idx];
  const ex = cur?.exercise;

  // Supersets: the exercise you're on and its partners share one screen.
  const items = useMemo(() => list.map((e) => ({ ...e, key: e.we.id, supersetGroup: e.we.supersetGroup })), [list]);
  const blocks = useMemo(() => supersetBlocks(items), [items]);
  const tags = useMemo(() => supersetTags(items), [items]);
  const bi = Math.max(
    0,
    blocks.findIndex((b) => b.items.some((x) => x.key === cur?.we.id)),
  );
  const block = blocks[bi];
  const members: ActiveExercise[] = block?.items ?? [];
  const isSuperset = !!block?.letter;
  const memberSets = (ticked?: string): MemberSets<WorkoutSet>[] =>
    members.map((m) => ({ key: m.we.id, sets: m.sets.map((s) => (s.id === ticked ? { ...s, completed: true } : s)) }));
  const round = isSuperset && cur ? supersetRound(memberSets(), cur.we.id) : { round: 1, rounds: 1 };

  // Training (design/training-logic.html §9): each exercise's suggestion from its last session.
  const training = useMemo(() => new Map(list.map((e) => [e.we.id, workoutTraining(e, history, settings, workout.startedAt)])), [list, history, settings, workout.startedAt]);
  const exerciseKey = list.map((e) => e.exercise.id).join();
  // §23: at most one tip per workout, on the first exercise it applies to.
  const tip = useMemo(() => {
    for (const e of list) {
      const t = tipForExercise(history, e.exercise, settings, workout.startedAt);
      if (t) return { weId: e.we.id, tip: t };
    }
    return null;
  }, [exerciseKey, history, settings, workout.startedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto (§9): LBS arrives filled with the next weights when the exercise comes up. Never after a gap.
  const autoFilled = useRef(new Set<string>());
  useEffect(() => {
    if (settings.suggestMode !== 'auto') return;
    for (const m of members) {
      const t = training.get(m.we.id);
      if (t?.kind !== 'ready' || t.comeback || t.hideBar || !t.sg.changed || m.we.suggestion || autoFilled.current.has(m.we.id)) continue;
      if (settings.suggestOnlyIds?.includes(m.exercise.id)) continue;
      const weights = weightsBySet(t, m.sets);
      if (!Object.keys(weights).length) continue;
      autoFilled.current.add(m.we.id);
      void applySuggestion(m.we.id, weights, { weights: t.sg.weights.map((w) => w ?? 0), auto: true });
    }
  }, [cur?.we.id, training, settings.suggestMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const variations = useVariations(ex);
  const varLabels = useMemo(() => variationLabels(variations), [variations]);
  const routine = useLiveQuery(() => (workout.routineId ? db.routines.get(workout.routineId) : undefined), [workout.routineId]);

  const editingMember = editing ? members.find((m) => m.sets.some((s) => s.id === editing.setId)) : undefined;
  const editingSet = editingMember?.sets.find((s) => s.id === editing?.setId);
  const activeEdit = editingSet ? editing : null;
  const editEx = editingMember?.exercise;
  const keypadOpen = !!(activeEdit && editEx);

  const doneCount = list.filter((e) => e.sets.length > 0 && e.sets.every((s) => s.completed)).length;
  const loggedCount = list.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0);
  const everyDone = list.length > 0 && doneCount === list.length;

  // Scroll the row being edited above the keypad.
  useEffect(() => {
    if (!activeEdit) return;
    const el = scrollRef.current?.querySelector(`[data-set-id="${activeEdit.setId}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeEdit?.setId]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollToSet = (setId: string) =>
    window.setTimeout(() => scrollRef.current?.querySelector(`[data-set-id="${setId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60);

  const jump = useCallback(
    (weId: string) => {
      setEditing(null);
      setShowAll(false);
      void setCurrentExercise(workout.id, weId);
      // After the exercise view is shown again (it's hidden behind the list).
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 0 }));
    },
    [workout.id],
  );

  /** Within a superset: switch the highlighted exercise without leaving the screen. */
  const focus = (m: ActiveExercise, setId?: string) => {
    if (m.we.id !== cur?.we.id) void setCurrentExercise(workout.id, m.we.id);
    const target = setId ?? m.sets.find((s) => !s.completed)?.id;
    if (target) scrollToSet(target);
  };

  const openAll = () => {
    setEditing(null);
    setShowAll(true);
  };

  const lastOf = (exerciseId: string) => lastSession(history, exerciseId);

  /** The bar the plate pad and the empty-bar placeholder use, in lb (undefined = none). */
  const barLbOf = (e: Exercise): number | undefined => {
    if (e.barLb != null) return e.barLb > 0 ? e.barLb : undefined;
    return e.equipment === 'barbell' ? fromDisplay(settings.barWeight, units) : undefined;
  };
  const barDisplayOf = (e: Exercise) => (e.barLb != null ? displayWeight(e.barLb, units) : e.equipment === 'barbell' ? settings.barWeight : 0);

  // Effort (SPEC §12): the rpe / rir tab on a reps box. With "Ask on" every (or the
  // last) working set, Next on reps goes on to the effort pad before Done.
  const rowFields = (m: ActiveExercise, set: WorkoutSet): string[] => {
    const f = fieldsOf(m.exercise);
    return settings.effort !== 'off' && m.exercise.type !== 'cardio' && asksEffort(settings.effortAsk, set, m.sets) ? [...f, 'effort'] : f;
  };

  // ───── keypad

  const startEdit = (m: ActiveExercise, set: WorkoutSet, field: string) => {
    const e = m.exercise;
    const text =
      field === 'effort'
        ? ''
        : field === 'weight'
        ? weightEditText(set.weight, e, units)
        : field === 'reps'
          ? set.reps != null
            ? String(set.reps)
            : ''
          : editTextOf(field as CardioField, fieldValue(set, field as CardioField), e, units);
    setEditing({ setId: set.id, field, text, fresh: true });
    if (m.we.id !== cur?.we.id) void setCurrentExercise(workout.id, m.we.id);
  };

  const keypadOptions = (e: Exercise, field: string): KeypadOptions => {
    if (field === 'weight') return { mode: 'weight', allowNegative: e.type === 'assisted' || e.type === 'bodyweight_plus', step: settings.weightStep };
    if (field === 'reps') return { mode: 'reps', step: 1 };
    const k = keypadFor(field as CardioField, e, units);
    return { mode: k.mode, step: k.step };
  };

  const save = (m: ActiveExercise, set: WorkoutSet, field: string, text: string) => {
    const e = m.exercise;
    if (field === 'weight') {
      const v = parseWeightText(text);
      const weight = weightFromEdit(v === undefined ? undefined : fromDisplay(v, units), e);
      void updateSet(set.id, { weight });
      // Auto (§9): overwriting a filled box turns it white and is remembered as an edit.
      const sg = m.we.suggestion;
      const i = m.sets.filter((x) => x.kind === 'working').findIndex((x) => x.id === set.id);
      if (sg?.auto && sg.outcome !== 'edited' && sg.outcome !== 'dismissed' && i >= 0 && weight !== sg.weights[i]) void setSuggestion(m.we.id, { ...sg, outcome: 'edited' });
    } else if (field === 'reps') {
      void updateSet(set.id, { reps: parseRepsText(text) });
    } else {
      const f = field as CardioField;
      void updateSet(set.id, fieldPatch(f, parseFieldText(f, text, e, units)));
    }
  };

  const onKey = (k: KeypadKey) => {
    if (!activeEdit || !editingSet || !editingMember) return;
    if (activeEdit.field === 'effort') {
      // The effort pad has its own keys; a hardware backspace clears it.
      if (k.type === 'backspace') void updateSet(editingSet.id, { rpe: undefined });
      return;
    }
    const text = applyKey(activeEdit.text, activeEdit.fresh, k, keypadOptions(editingMember.exercise, activeEdit.field));
    setEditing({ ...activeEdit, text, fresh: false });
    save(editingMember, editingSet, activeEdit.field, text);
  };

  // Hardware keyboard (iPad / desktop) mirrors the keypad.
  const onKeyRef = useRef(onKey);
  onKeyRef.current = onKey;
  const onNextRef = useRef(() => {});
  useEffect(() => {
    if (!activeEdit) return;
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      let k: KeypadKey | null = null;
      if (/^[0-9]$/.test(e.key)) k = { type: 'digit', d: e.key };
      else if (e.key === '.' || e.key === ',') k = { type: 'dot' };
      else if (e.key === ':') k = { type: 'colon' };
      else if (e.key === '-') k = { type: 'minus' };
      else if (e.key === 'Backspace') k = { type: 'backspace' };
      else if (e.key === 'ArrowUp') k = { type: 'inc' };
      else if (e.key === 'ArrowDown') k = { type: 'dec' };
      else if (e.key === 'Escape') {
        setEditing(null);
        e.preventDefault();
        return;
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        onNextRef.current();
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

  /**
   * Tick a set. Empty boxes take their grey value: the set above's numbers (or the
   * empty bar) for lifts, last time's segment for cardio. `typed` is the box being
   * edited, which may be ahead of the saved value. Returns false and opens the
   * missing box when there's nothing to log.
   */
  const tick = (m: ActiveExercise, set: WorkoutSet, typed?: { field: string; text: string }): boolean => {
    const e = m.exercise;
    if (e.type === 'cardio') {
      const own = cardioOf(set);
      if (typed && isCardioField(typed.field)) Object.assign(own, fieldPatch(typed.field, parseFieldText(typed.field, typed.text, e, units)));
      const ph = segmentPlaceholders(m.sets, lastOf(e.id)?.sets).get(set.id) ?? {};
      const patch: CardioValues & { completed: boolean } = { completed: true };
      for (const f of cardioFields(e)) {
        const v = fieldValue(own, f) ?? fieldValue(ph, f);
        if (v != null) Object.assign(patch, fieldPatch(f, v));
      }
      if (!patch.durationSec) {
        setEditing({ setId: set.id, field: 'time', text: '', fresh: true });
        toast({ message: 'Add the time to tick this segment', duration: 2200 });
        return false;
      }
      void updateSet(set.id, patch);
      return true;
    }
    const c = carryOver(m.sets).get(set.id);
    const typedReps = typed?.field === 'reps' ? parseRepsText(typed.text) : set.reps;
    const reps = typedReps != null && typedReps > 0 ? typedReps : c?.reps;
    if (reps == null) {
      setEditing({ setId: set.id, field: 'reps', text: '', fresh: true });
      toast({ message: 'Add the reps to tick this set', duration: 2200 });
      return false;
    }
    const patch: Partial<WorkoutSet> = { completed: true, reps };
    if (e.type === 'weight' && set.weight == null) {
      const weight = c?.weight ?? barLbOf(e);
      if (weight == null) {
        setEditing({ setId: set.id, field: 'weight', text: '', fresh: true });
        toast({ message: 'Add the weight to tick this set', duration: 2200 });
        return false;
      }
      patch.weight = weight;
    }
    void updateSet(set.id, patch);
    return true;
  };

  const setWord = (m: ActiveExercise, s: WorkoutSet) => {
    if (m.exercise.type === 'cardio') return `segment ${m.sets.indexOf(s) + 1}`;
    if (s.kind === 'warmup') return 'warm-up';
    if (s.kind === 'drop') return 'drop set';
    return `set ${workingIndex(m.sets, s.id)}`;
  };

  /**
   * Where you go after a set is ticked. In a superset: the partner's set (4.20).
   * Otherwise the next open set of the same exercise.
   */
  const advance = (m: ActiveExercise, set: WorkoutSet): { member: ActiveExercise; set: WorkoutSet } | null => {
    if (isSuperset) {
      const t = nextTarget(memberSets(set.id), m.we.id, set.id);
      if (!t) return null;
      const tm = members.find((x) => x.we.id === t.key)!;
      const ts = tm.sets.find((s) => s.id === t.setId)!;
      if (tm.we.id !== m.we.id) {
        void setCurrentExercise(workout.id, tm.we.id);
        scrollToSet(ts.id);
      }
      return { member: tm, set: ts };
    }
    const at = m.sets.findIndex((s) => s.id === set.id);
    const next = m.sets.slice(at + 1).find((s) => !s.completed);
    return next ? { member: m, set: next } : null;
  };

  const onToggle = (m: ActiveExercise, set: WorkoutSet) => {
    setEditing(null);
    if (set.completed) {
      void updateSet(set.id, { completed: false });
      return;
    }
    if (tick(m, set) && isSuperset) advance(m, set);
  };

  /** Keypad → Next walks the row's boxes; ✓ Done on the last box ticks the set and opens the next one. */
  const onNext = () => {
    if (!activeEdit || !editingSet || !editingMember) return;
    const fields = rowFields(editingMember, editingSet);
    const i = fields.indexOf(activeEdit.field);
    if (i >= 0 && i < fields.length - 1) {
      startEdit(editingMember, editingSet, fields[i + 1]);
      return;
    }
    if (!editingSet.completed && !tick(editingMember, editingSet, activeEdit)) return;
    const target = advance(editingMember, editingSet);
    if (target) startEdit(target.member, target.set, fieldsOf(target.member.exercise)[0]);
    else setEditing(null);
  };
  onNextRef.current = onNext;

  const onDelete = async (m: ActiveExercise, set: WorkoutSet) => {
    const label = m.exercise.type === 'cardio' ? `Segment ${m.sets.indexOf(set) + 1}` : setName(setLabels(m.sets).get(set.id) ?? '');
    if (editing?.setId === set.id) setEditing(null);
    const removed = await deleteSet(set.id);
    if (removed.length)
      toast({
        message: `${label} deleted`,
        actionLabel: 'Undo',
        onAction: () => void restoreSets(removed),
      });
  };

  const holdItems = (m: ActiveExercise, set: WorkoutSet): MenuItem[] => {
    const items: MenuItem[] = [];
    if (set.kind !== 'drop' && m.exercise.type !== 'cardio') {
      items.push(
        set.kind === 'warmup'
          ? { label: 'Mark as working set', glyph: '1', onClick: () => void toggleWarmup(set.id) }
          : { label: 'Mark as warm-up', glyph: 'W', onClick: () => void toggleWarmup(set.id) },
      );
      items.push({ label: 'Move to top', glyph: '⤒', onClick: () => void moveSetToTop(set.id) });
    }
    items.push({ label: 'Duplicate', glyph: '⧉', onClick: () => void duplicateSet(set.id) });
    items.push({ label: 'Delete', glyph: '✕', tone: 'danger', onClick: () => void onDelete(m, set) });
    return items;
  };

  const addDrop = async (m: ActiveExercise) => {
    setEditing(null);
    focus(m);
    const id = await addDropSet(m.we.id, m.exercise.type);
    if (!id) toast({ message: 'Tick a set first. A drop goes under the last completed set.', duration: 3000 });
  };

  const addSet = async (m: ActiveExercise) => {
    setEditing(null);
    focus(m);
    const id = await addWorkingSet(m.we.id);
    scrollToSet(id);
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
    const check = await checkUnticked(
      workout.id,
      (id) => exerciseMap.get(id)?.name ?? 'Exercise',
      (id) => exerciseMap.get(id)?.type === 'cardio',
    );
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

  // ───── prev / next (blocks: a superset counts as one stop)

  const openMember = (b: (typeof blocks)[number]) => b.items.find((m) => m.sets.some((s) => !s.completed)) ?? b.items[0];
  const stopLabel = (m: ActiveExercise) => (tags.get(m.we.id) ? `${tags.get(m.we.id)} · ${m.exercise.name}` : m.exercise.name);
  type Nav = { small: string; text: string; go: () => void };
  let prevNav: Nav | null = null;
  let nextNav: Nav | null = null;
  if (cur) {
    const mi = members.findIndex((m) => m.we.id === cur.we.id);
    if (isSuperset && mi > 0) {
      const m = members[mi - 1];
      prevNav = { small: 'Prev', text: stopLabel(m), go: () => focus(m) };
    } else if (bi > 0) {
      const m = openMember(blocks[bi - 1]);
      prevNav = { small: 'Prev', text: stopLabel(m), go: () => jump(m.we.id) };
    }
    if (isSuperset) {
      // The partner whose turn is next (4.19: "A2 · Row set 2").
      for (let k = 1; k < members.length && !nextNav; k++) {
        const m = members[(mi + k) % members.length];
        const s = m.sets.find((x) => !x.completed);
        if (s) nextNav = { small: `Next · ${setWord(m, s)}`, text: stopLabel(m), go: () => focus(m, s.id) };
      }
    }
    if (!nextNav && bi < blocks.length - 1) {
      const m = openMember(blocks[bi + 1]);
      nextNav = { small: 'Next', text: stopLabel(m), go: () => jump(m.we.id) };
    }
  }

  // ───── render

  const header = (
    <header className="flex flex-none items-center gap-1 border-b border-line py-1 pr-4 pl-1">
      <button
        type="button"
        aria-label={showAll ? 'Back to the exercise' : 'All exercises'}
        onClick={() => (showAll ? setShowAll(false) : openAll())}
        className="flex h-11 w-9 flex-none items-center justify-center text-accent"
      >
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

  const subtitle = (m: ActiveExercise) => {
    const e = m.exercise;
    if (e.type === 'cardio') {
      const last = lastOf(e.id);
      const line = last ? cardioSummary(last.sets, e, units) : '';
      if (line) return `Last: ${line} · ${fmtMonthDay(last!.date)}`;
    }
    return `Exercise ${list.indexOf(m) + 1} of ${list.length}${TYPE_HINT[e.type]}`;
  };

  const icons = (
    <div className="-mt-1 -mr-1.5 flex flex-none">
      <IconButton label="History, charts and records" onClick={() => setOverlay('lookback')}>
        <ChartIcon size={15} />
      </IconButton>
      <IconButton label="Exercise options" onClick={() => setOverlay('exercise')}>
        •••
      </IconButton>
    </div>
  );

  const variationChips = cur && ex && variations.length > 1 && (
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
  );

  const editingCell = (m: ActiveExercise) => (activeEdit && editingMember?.we.id === m.we.id ? { setId: activeEdit.setId, field: activeEdit.field, text: activeEdit.text } : null);

  /** Auto-filled LBS boxes still holding the app's weight (blue until edited). */
  const autoIdsOf = (m: ActiveExercise): Set<string> | undefined => {
    const sg = m.we.suggestion;
    if (!sg?.auto || sg.outcome === 'dismissed') return undefined;
    const ids = new Set<string>();
    m.sets.filter((x) => x.kind === 'working').forEach((x, i) => x.weight != null && sg.weights[i] === x.weight && ids.add(x.id));
    return ids;
  };

  /** 4.27–4.33: the training bar, the break question and the tip, under the exercise header. */
  const trainingBlock = (m: ActiveExercise) => {
    const t = training.get(m.we.id);
    const tipEl = tip?.weId === m.we.id && (
      <TipLine tip={tip.tip} onDismiss={() => void updateSettings({ dismissedTips: [...settings.dismissedTips, tip.tip] })} />
    );
    if (!t || t.kind === 'none') return tipEl;
    if (t.kind === 'gap')
      return gapLater.includes(m.we.id) ? (
        tipEl
      ) : (
        <GapPrompt t={t} exercise={m.exercise} units={units} onAnswer={(a) => void setGapAnswer(m.we.id, a)} onDismiss={() => setGapLater((g) => [...g, m.we.id])} />
      );
    const state = barState(t, m.we.suggestion, settings, m.exercise);
    return (
      <>
        {state !== 'none' && (
          <TrainingBar
            t={t}
            state={state}
            exercise={m.exercise}
            units={units}
            onAccept={() => acceptSuggestion(m)}
            onDismiss={() => void setSuggestion(m.we.id, { weights: t.sg.weights.map((w) => w ?? 0), outcome: 'dismissed' })}
            onUndo={() => void revertSuggestion(m.we.id, undefined)}
            onWhy={() => setWhyId(m.we.id)}
          />
        )}
        {tipEl}
      </>
    );
  };

  const acceptSuggestion = (m: ActiveExercise) => {
    const t = training.get(m.we.id);
    if (t?.kind !== 'ready') return;
    setEditing(null);
    void applySuggestion(m.we.id, weightsBySet(t, m.sets), { weights: t.sg.weights.map((w) => w ?? 0), outcome: 'accepted' });
  };

  const whyMember = whyId ? list.find((e) => e.we.id === whyId) : undefined;
  const whyTraining = whyMember ? training.get(whyMember.we.id) : undefined;

  const table = (m: ActiveExercise) =>
    m.exercise.type === 'cardio' ? (
      <CardioTable
        exercise={m.exercise}
        sets={m.sets}
        previous={lastOf(m.exercise.id)?.sets}
        units={units}
        editing={editingCell(m)}
        onEdit={(s, f) => startEdit(m, s, f)}
        onToggle={(s) => onToggle(m, s)}
        onDelete={(s) => void onDelete(m, s)}
        onMenu={(s, rect) => setHoldMenu({ member: m, set: s, rect })}
      />
    ) : (
      <SetTable
        exercise={m.exercise}
        sets={m.sets}
        previous={lastOf(m.exercise.id)?.sets}
        units={units}
        editing={editingCell(m)}
        barPlaceholderLb={m.exercise.type === 'weight' ? barLbOf(m.exercise) : undefined}
        effort={settings.effort}
        effortAsk={settings.effortAsk}
        narrow={isSuperset}
        hints={hintsFor(training.get(m.we.id) ?? { kind: 'none' }, m.we.suggestion, settings, m.exercise, units)}
        autoIds={autoIdsOf(m)}
        onEdit={(s, f) => startEdit(m, s, f)}
        onToggle={(s) => onToggle(m, s)}
        onToggleWarmup={(s) => void toggleWarmup(s.id)}
        onDelete={(s) => void onDelete(m, s)}
        onMenu={(s, rect) => setHoldMenu({ member: m, set: s, rect })}
      />
    );

  const addButtons = (m: ActiveExercise) =>
    m.exercise.type === 'cardio' ? (
      <>
        <div className="mt-2 grid">
          <QuickButton onClick={() => void addSet(m)}>+ Segment</QuickButton>
        </div>
        {m.sets.length === 1 && <p className="mt-3 text-[13px] leading-normal text-fg2">Most cardio is a single row. Segments are there for warm-up / main / cool-down if you want them.</p>}
      </>
    ) : (
      <div className="mt-2 grid grid-cols-2 gap-2">
        <QuickButton tone="warn" onClick={() => void addDrop(m)}>
          + Drop
        </QuickButton>
        <QuickButton onClick={() => void addSet(m)}>+ Set</QuickButton>
      </div>
    );

  const emptySets = (m: ActiveExercise) => !m.sets.length && <p className="py-4 text-center text-[14px] text-fg2">{m.exercise.type === 'cardio' ? 'No segments. Add one below.' : 'No sets. Add one below.'}</p>;

  /** 4.19–4.20: the superset on one screen, inside the blue bracket. */
  const supersetView = () => {
    if (!cur || !block?.letter) return null;
    const mi = members.findIndex((m) => m.we.id === cur.we.id);
    let partner: ActiveExercise | undefined;
    for (let k = 1; k < members.length && !partner; k++) {
      const m = members[(mi + k) % members.length];
      if (m.sets.some((s) => !s.completed)) partner = m;
    }
    return (
      <div key={`ss-${members[0].we.id}`} className="anim-page">
        <div className="mt-3.5 flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold tracking-[0.07em] text-accent uppercase">
            Superset {block.letter} · Round {round.round} of {round.rounds}
          </span>
          {partner && (
            <span className="text-[12px] font-semibold text-fg2">
              {tags.get(cur.we.id)} → {tags.get(partner.we.id)}
            </span>
          )}
        </div>
        <div className="mt-2 border-l-2 border-accent pl-3">
          {members.map((m) => {
            const focused = m.we.id === cur.we.id;
            const tag = tags.get(m.we.id);
            if (!focused && isFolded({ key: m.we.id, sets: m.sets }, cur.we.id, round.round)) {
              const done = m.sets.filter((s) => s.completed && s.kind === 'working');
              return (
                <button key={m.we.id} type="button" onClick={() => focus(m)} className="flex min-h-[52px] w-full items-center gap-2.5 border-b border-line text-left">
                  <TagPill tag={tag} done={allTicked(m.sets)} />
                  <b className="min-w-0 flex-1 truncate text-[16px] font-semibold">{m.exercise.name}</b>
                  <span className="max-w-[150px] flex-none truncate text-[13px] text-fg2">{done.map((s) => formatSet(s, m.exercise.type, units)).join(' · ')}</span>
                </button>
              );
            }
            return (
              <section key={m.we.id} className={cx('pb-3 transition-opacity', !focused && 'opacity-55')}>
                <div className="mt-1 flex items-start justify-between gap-2">
                  <button type="button" onClick={() => focus(m)} className="flex min-h-11 min-w-0 items-center gap-2.5 text-left" aria-label={`${tag} ${m.exercise.name}${focused ? ' (current)' : ''}`}>
                    <TagPill tag={tag} on={focused} done={allTicked(m.sets)} />
                    <span className={cx('min-w-0 truncate font-bold tracking-[-0.01em]', focused ? 'text-[20px]' : 'text-[17px]')}>{m.exercise.name}</span>
                  </button>
                  {focused && icons}
                </div>
                {focused && variationChips}
                {focused && trainingBlock(m)}
                {table(m)}
                {emptySets(m)}
                {focused && addButtons(m)}
              </section>
            );
          })}
        </div>
      </div>
    );
  };

  // Keypad for the box being edited.
  const keypad = (() => {
    if (!activeEdit || !editingSet || !editingMember || !editEx) return null;
    const field = activeEdit.field;
    const fields = rowFields(editingMember, editingSet);
    const fi = fields.indexOf(field);
    const cardio = editEx.type === 'cardio';
    const who = cardio ? '' : setName(setLabels(editingMember.sets).get(editingSet.id) ?? '');
    // Field tabs: lbs · reps, plus rpe / rir on a reps box of a working set (A2).
    const baseTabs = fieldsOf(editEx);
    const effortTab = settings.effort !== 'off' && !cardio && takesEffort(editingSet) && (field === 'reps' || field === 'effort');
    const tabIds = effortTab ? [...baseTabs, 'effort'] : baseTabs;
    const tabLabel = (f: string) =>
      f === 'effort' ? EFFORT_LABEL[settings.effort].toLowerCase() : cardio ? fieldTab(f as CardioField, editEx, units) : f === 'weight' ? (unitLabel(units) === 'lb' ? 'lbs' : 'kg') : 'reps';
    if (field === 'effort' && settings.effort !== 'off') {
      const mode = settings.effort;
      return (
        <Keypad
          left={<PadClose onPress={() => setEditing(null)}>{`${who} · ${EFFORT_LABEL[mode]}`}</PadClose>}
          tabs={tabIds.map((f) => ({ id: f, label: tabLabel(f) }))}
          tab={field}
          onTab={(f) => f !== field && startEdit(editingMember, editingSet, f)}
          next={{ done: true, onPress: onNext }}
          bottomLeft={{ key: 'minus', enabled: false }}
          stepLabel=""
          onKey={onKey}
          onClose={() => setEditing(null)}
          panel={<EffortPad mode={mode} value={editingSet.rpe} onChange={(v) => void updateSet(editingSet.id, { rpe: v })} />}
        />
      );
    }
    const plateOk = field === 'weight' && hasPlatePad(editEx.type, editEx.equipment);
    const platesOn = plateOk && (padPref[editEx.id] ?? editEx.platePad ?? false);
    const opts = keypadOptions(editEx, field);
    const label = cardio ? FIELD_NAME[field as CardioField] : `${who} · ${field === 'weight' ? 'Weight' : 'Reps'}`;
    const tabs: KeypadTab[] = tabIds.map((f) => ({ id: f, label: tabLabel(f) }));
    const stepLabel = field === 'weight' ? `${settings.weightStep} ${unitLabel(units)}` : field === 'reps' ? '1 rep' : keypadFor(field as CardioField, editEx, units).stepLabel;
    const setPad = (v: 'numbers' | 'plates') => {
      setPadPref((p) => ({ ...p, [editEx.id]: v === 'plates' }));
      void setExercisePrefs(editEx.id, { platePad: v === 'plates' });
    };
    return (
      <Keypad
        left={
          plateOk ? (
            <span className="flex items-center gap-1">
              <ModeTabs value={platesOn ? 'plates' : 'numbers'} onChange={setPad} />
              {platesOn && <BarChip label={barShortLabel(barDisplayOf(editEx))} onPress={() => setOverlay('bar')} />}
            </span>
          ) : (
            label
          )
        }
        tabs={tabs}
        tab={field}
        onTab={(f) => f !== field && startEdit(editingMember, editingSet, f)}
        next={{ done: fi === fields.length - 1, onPress: onNext }}
        bottomLeft={
          field === 'weight'
            ? { key: 'minus', enabled: !!opts.allowNegative }
            : field === 'reps'
              ? { key: 'dash', enabled: false }
              : opts.mode === 'time'
                ? { key: 'colon', enabled: true }
                : { key: 'minus', enabled: false }
        }
        decimal={field === 'weight' || opts.mode === 'decimal'}
        stepLabel={stepLabel}
        onKey={onKey}
        onClose={() => setEditing(null)}
        panel={
          platesOn ? (
            <PlatePad
              key={editingSet.id}
              units={units}
              bar={barDisplayOf(editEx)}
              initialTotal={editingSet.weight != null ? displayWeight(editingSet.weight, units) : undefined}
              onTotal={(t) => {
                const text = formatNumber(t, 2);
                setEditing((e) => (e ? { ...e, text, fresh: true } : e));
                save(editingMember, editingSet, 'weight', text);
              }}
              onDone={onNext}
            />
          ) : undefined
        }
      />
    );
  })();

  const supersetCandidates = cur
    ? list
        .filter((e) => !members.some((m) => m.we.id === e.we.id) && e.exercise.type !== 'cardio')
        .map((e) => ({
          key: e.we.id,
          name: e.exercise.name,
          sub: supersetPre.includes(e.we.id) ? 'just added' : tags.get(e.we.id) ? `in superset ${tags.get(e.we.id)![0]}` : 'in this workout',
        }))
    : [];

  return (
    <div className="flex h-full flex-col">
      {header}
      <div
        ref={scrollRef}
        // Tapping the blank space around the set table (e.g. under + Drop / + Set) closes the keypad.
        onClick={(e) => {
          if (activeEdit && e.target === e.currentTarget) setEditing(null);
        }}
        className={cx('scroll-y min-h-0 flex-1 px-4', activeEdit ? 'pb-24' : 'pb-6', showAll && 'hidden')}
      >
        {!cur || !ex ? (
          <div className="pt-20">
            <EmptyState icon="+" title="Add your first exercise">
              Pick from the library or make your own. Sets fill in from last time.
            </EmptyState>
            <Button className="mx-auto mt-6 max-w-[260px]" onClick={() => setOverlay('add')}>
              + Add exercise
            </Button>
          </div>
        ) : isSuperset ? (
          supersetView()
        ) : (
          <div key={cur.we.id} className="anim-page">
            <div className="mt-3.5 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-[22px] leading-tight font-bold tracking-[-0.01em]">{ex.name}</h1>
                <button type="button" onClick={openAll} className="mt-0.5 flex h-6 max-w-full items-center gap-1 text-[13px] text-fg2">
                  <span className="truncate">{subtitle(cur)}</span>
                  <ChevronDown size={9} className="flex-none" />
                </button>
              </div>
              {icons}
            </div>
            {variationChips}
            {trainingBlock(cur)}
            {table(cur)}
            {emptySets(cur)}
            {addButtons(cur)}
          </div>
        )}
      </div>

      {showAll && <AllExercises exercises={list} currentId={cur?.we.id} onClose={() => setShowAll(false)} onJump={jump} onAdd={() => setOverlay('add')} />}

      {/* Prev / Next stay above the keypad so you can move on without closing it first. */}
      {cur && !showAll && (
        <div className="relative flex-none" data-dock>
          <nav
            className={cx('grid grid-cols-2 gap-2 border-t border-line bg-bg px-3', keypadOpen ? 'py-2' : 'pt-2.5 pb-[max(10px,env(safe-area-inset-bottom))]')}
            aria-label="Exercises"
          >
            {prevNav ? (
              <NavButton small={prevNav.small} onClick={prevNav.go} side="left" compact={keypadOpen}>
                {prevNav.text}
              </NavButton>
            ) : (
              <NavButton small="No previous" onClick={openAll} compact={keypadOpen}>
                All exercises
              </NavButton>
            )}
            {nextNav ? (
              <NavButton small={nextNav.small} onClick={nextNav.go} side="right" compact={keypadOpen}>
                {nextNav.text}
              </NavButton>
            ) : everyDone ? (
              <NavButton small="All done" onClick={() => void startFinish()} tone="accent" align="right" compact={keypadOpen}>
                Finish workout
              </NavButton>
            ) : (
              <NavButton small="Last one" onClick={openAll} align="right" compact={keypadOpen}>
                All exercises
              </NavButton>
            )}
          </nav>
          {keypad}
        </div>
      )}

      {/* ───── overlays */}

      {whyMember && whyTraining?.kind === 'ready' && (
        <WhySheet
          open
          onClose={() => setWhyId(null)}
          t={whyTraining}
          state={barState(whyTraining, whyMember.we.suggestion, settings, whyMember.exercise)}
          exercise={whyMember.exercise}
          history={history}
          settings={settings}
          at={workout.startedAt}
          onUse={() => {
            setWhyId(null);
            acceptSuggestion(whyMember);
          }}
          onIgnore={() => {
            setWhyId(null);
            // Nothing written yet (Suggest): remember the dismissal. Filled (Auto, ✓): put the old weights back.
            if (whyMember.we.suggestion) void revertSuggestion(whyMember.we.id, 'dismissed');
            else void setSuggestion(whyMember.we.id, { weights: whyTraining.sg.weights.map((w) => w ?? 0), outcome: 'dismissed' });
          }}
          onSuggestOnly={() => {
            setWhyId(null);
            void updateSettings({ suggestOnlyIds: [...(settings.suggestOnlyIds ?? []), whyMember.exercise.id] });
            void revertSuggestion(whyMember.we.id, undefined).then(() => setSuggestion(whyMember.we.id, undefined));
          }}
        />
      )}

      <HoldMenu
        open={!!holdMenu}
        anchor={holdMenu?.rect}
        items={holdMenu ? holdItems(holdMenu.member, holdMenu.set) : []}
        onClose={() => setHoldMenu(null)}
      />

      <WorkoutOptions
        open={overlay === 'options'}
        name={workout.name}
        startedAt={workout.startedAt}
        onClose={() => setOverlay(null)}
        onPause={() => {
          setOverlay(null);
          navigate('/');
        }}
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
          if (cur.sets.some((s) => s.completed)) {
            setOverlay('remove');
            return;
          }
          const name = cur.exercise.name;
          void removeWorkoutExercise(cur.we.id).then((removed) => {
            if (removed) toast({ message: `${name} removed`, actionLabel: 'Undo', onAction: () => void restoreWorkoutExercise(removed) });
          });
        }}
        superset={
          cur && ex?.type !== 'cardio'
            ? {
                tag: tags.get(cur.we.id),
                canAdd: members.length < 3,
                onLink: () => {
                  setSupersetPre([]);
                  setOverlay('superset');
                },
                onUnlink: () => void unlinkWorkoutSuperset(cur.we.id),
              }
            : undefined
        }
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

      {cur && ex && (
        <SupersetSheet
          open={overlay === 'superset'}
          anchorName={ex.name}
          groupSize={isSuperset ? members.length : 1}
          candidates={supersetCandidates}
          preselect={supersetPre}
          addLabel="adds it to this workout"
          onAddAnother={() => setOverlay('supersetAdd')}
          onClose={() => setOverlay(null)}
          onMake={(keys) => {
            setOverlay(null);
            void linkWorkoutSuperset(cur.we.id, keys);
          }}
        />
      )}
      <ExercisePicker
        open={overlay === 'supersetAdd'}
        mode="single"
        title="Superset with…"
        excludeIds={list.map((e) => e.exercise.id)}
        onCancel={() => setOverlay('superset')}
        onPick={async (id) => {
          const ids = await addExercisesToWorkout(workout.id, [id]);
          setSupersetPre(ids.slice(0, 1));
          setOverlay('superset');
        }}
      />

      {editEx && (
        <BarPicker
          open={overlay === 'bar'}
          exerciseName={editEx.name}
          units={units}
          bar={barDisplayOf(editEx)}
          onClose={() => setOverlay(null)}
          onPick={(w) => void setExercisePrefs(editEx.id, { barLb: fromDisplay(w, units) })}
        />
      )}

      <LookbackSheet
        exercise={ex}
        open={overlay === 'lookback'}
        onClose={() => setOverlay(null)}
        currentReps={cur?.sets.find((s) => !s.completed && s.kind === 'working')?.reps}
      />

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

/**
 * A1 / A2 tag: blue on the exercise you're on, grey on its partners. Once every
 * set of that exercise is ticked (`done`) it turns into a ✓.
 */
export function TagPill({ tag, on, done }: { tag?: string; on?: boolean; done?: boolean }) {
  if (!tag) return null;
  return (
    <span
      aria-label={done ? `${tag}, done` : undefined}
      className={cx(
        'flex h-[20px] min-w-[26px] flex-none items-center justify-center rounded-[5px] px-1 text-[11px] font-extrabold',
        on ? 'bg-accent text-white' : done ? 'bg-done text-accent' : 'bg-surface-2 text-fg2',
      )}
    >
      {done ? <CheckGlyph size={11} /> : tag}
    </span>
  );
}

/** Every set ticked (and at least one set). */
const allTicked = (sets: WorkoutSet[]) => sets.length > 0 && sets.every((s) => s.completed);

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

/** + Set, + Drop, + Segment: text only, no fill, like every other add button in the app. 44 px tall. */
function QuickButton({ children, onClick, tone }: { children: ReactNode; onClick: () => void; tone?: 'warn' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx('flex h-11 items-center justify-center rounded-[10px] text-[15px] font-semibold active:opacity-60', tone === 'warn' ? 'text-warn' : 'text-accent')}
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
  compact,
}: {
  children: ReactNode;
  small: string;
  onClick: () => void;
  side?: 'left' | 'right';
  tone?: 'accent';
  align?: 'right';
  /** Shorter (still 44 px) while the keypad is open below. */
  compact?: boolean;
}) {
  const right = side === 'right' || align === 'right';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex min-w-0 items-center gap-2 rounded-[11px] px-3 transition-colors active:opacity-80',
        compact ? 'h-11' : 'h-[50px]',
        right ? 'justify-end text-right' : 'text-left',
        tone === 'accent' ? 'bg-accent text-white' : 'bg-surface-2 text-fg',
      )}
    >
      {side === 'left' && <span className="text-[19px] text-fg2">‹</span>}
      <span className="min-w-0">
        <small className={cx('block text-[10px] font-bold tracking-[0.05em] uppercase', tone === 'accent' ? 'text-white/75' : 'text-fg2')}>{small}</small>
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
  onPause,
  onRename,
  onStart,
  onDiscard,
}: {
  open: boolean;
  name: string;
  startedAt: number;
  onClose: () => void;
  onPause: () => void;
  onRename: () => void;
  onStart: () => void;
  onDiscard: () => void;
}) {
  const now = useNow(30_000);
  return (
    <Sheet open={open} onClose={onClose} title={name} subtitle={`Started ${fmtTime(startedAt)} · ${fmtDuration(now - startedAt)}`}>
      <SheetOption onClick={onPause} detail="resume from Home">
        Pause workout
      </SheetOption>
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
