import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { SwipeRow } from '../../components/gestures';
import { ChevronRight } from '../../components/icons';
import { Keypad, type KeypadTab } from '../../components/Keypad';
import { Alert, HoldMenu, Sheet, SheetOption, type MenuItem } from '../../components/overlays';
import { AddButton, BarButton, Button, cx, FieldLabel, Tag, TopBar } from '../../components/ui';
import { exerciseOrMissing, useData } from '../../data/DataProvider';
import { stepLb } from '../../data/settings';
import { saveWorkoutEdits, type EditedExercise, type EditedSet } from '../../data/workouts';
import type { Exercise } from '../../db/types';
import { fmtDay, fmtTime, fromLocalInputValue, toLocalInputValue } from '../../lib/dates';
import { uuid } from '../../lib/id';
import {
  cardioColumns,
  cardioFields,
  columnHeader,
  columnText,
  editTextOf,
  FIELD_NAME,
  fieldPatch,
  fieldTab,
  fieldValue,
  formatField,
  isComputed,
  keypadFor,
  parseFieldText,
  type CardioField,
} from '../../lib/cardio';
import { applyKey, parseRepsText, parseWeightText, type KeypadKey, type KeypadOptions } from '../../lib/keypad';
import { dropWeight } from '../../lib/prefill';
import { hasWeightColumn, isEmptySet, setLabels, TYPE_TAG, weightColumnLabel } from '../../lib/sets';
import { moveBlock, normalizeSupersets, supersetBlocks, supersetTags, unlinkSuperset } from '../../lib/supersets';
import { fromDisplay, unitColumn, unitLabel } from '../../lib/units';
import { ExercisePicker } from '../exercises/ExercisePicker';
import { weightCellText, weightEditDisplay, weightEditText, weightFromEdit } from '../workout/SetTable';
import { TagPill } from '../workout/WorkoutScreen';
import { EffortBadge, EffortPad } from '../../components/Effort';
import { applyEffortKey, EFFORT_LABEL, effortBadge, effortSpoken } from '../../lib/effort';

/** 'weight' | 'reps', 'effort' (the rpe / rir tab on a reps box), or a cardio field. */
type Field = string;
interface Editing {
  exKey: string;
  setKey: string;
  field: Field;
  text: string;
  fresh: boolean;
}

/** 6.7: fix a finished workout. Same rows and keypad as the builder. Saved only on Save. */
export function EditWorkout() {
  const { id = '' } = useParams();
  const { history } = useData();
  const hw = history.byId.get(id);
  const [initial] = useState(() =>
    hw
      ? {
          name: hw.workout.name,
          startedAt: hw.workout.startedAt,
          endedAt: hw.workout.endedAt,
          exercises: hw.exercises.map<EditedExercise>((e) => ({
            key: e.we.id,
            exerciseId: e.we.exerciseId,
            supersetGroup: e.we.supersetGroup,
            sets: e.sets.map((s) => ({
              key: s.id,
              kind: s.kind,
              parentKey: s.parentSetId,
              weight: s.weight,
              reps: s.reps,
              ...(s.rpe != null && { rpe: s.rpe }),
              ...(s.durationSec != null && { durationSec: s.durationSec }),
              ...(s.distance != null && { distance: s.distance }),
              ...(s.speed != null && { speed: s.speed }),
              ...(s.incline != null && { incline: s.incline }),
              ...(s.level != null && { level: s.level }),
              ...(s.calories != null && { calories: s.calories }),
              ...(s.steps != null && { steps: s.steps }),
            })),
          })),
        }
      : null,
  );
  if (!initial) return <Navigate to="/history" replace />;
  return <Editor id={id} initial={initial} />;
}

function Editor({ id, initial }: { id: string; initial: { name: string; startedAt: number; endedAt?: number; exercises: EditedExercise[] } }) {
  const navigate = useNavigate();
  const { exerciseMap, settings } = useData();
  const units = settings.units;
  const [name, setName] = useState(initial.name);
  const [startedAt, setStartedAt] = useState(initial.startedAt);
  const [endedAt, setEndedAt] = useState(initial.endedAt);
  const [exercises, setExercises] = useState(initial.exercises);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [overlay, setOverlay] = useState<'time' | 'add' | 'discard' | null>(null);
  const [exMenu, setExMenu] = useState<string | null>(null);
  const [replacing, setReplacing] = useState<string | null>(null);
  const [setMenu, setSetMenu] = useState<{ exKey: string; setKey: string; rect: DOMRect } | null>(null);
  const [saving, setSaving] = useState(false);

  const snapshot = useMemo(() => JSON.stringify(initial), [initial]);
  const dirty = JSON.stringify({ name, startedAt, endedAt, exercises }) !== snapshot;

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const updateEx = (exKey: string, fn: (e: EditedExercise) => EditedExercise) => setExercises((l) => l.map((e) => (e.key === exKey ? fn(e) : e)));
  const updateSet = (exKey: string, setKey: string, patch: Partial<EditedSet>) => updateEx(exKey, (e) => ({ ...e, sets: e.sets.map((s) => (s.key === setKey ? { ...s, ...patch } : s)) }));

  /** Warm-ups first, then each set followed by its drops. */
  const normalize = (sets: EditedSet[]) => {
    const tops = sets.filter((s) => s.kind !== 'drop' || !s.parentKey || !sets.some((p) => p.key === s.parentKey));
    const out: EditedSet[] = [];
    const push = (s: EditedSet) => {
      out.push(s);
      for (const d of sets.filter((x) => x.kind === 'drop' && x.parentKey === s.key)) push(d);
    };
    for (const s of [...tops.filter((s) => s.kind === 'warmup'), ...tops.filter((s) => s.kind !== 'warmup')]) push(s);
    return out;
  };

  const addSet = (exKey: string) =>
    updateEx(exKey, (e) => {
      const last = [...e.sets].reverse().find((s) => s.kind === 'working');
      // Copy the last set's numbers (weight/reps, or a cardio segment's values).
      return { ...e, sets: [...e.sets, { ...last, key: uuid(), kind: 'working', parentKey: undefined, rpe: undefined }] };
    });

  const addDrop = (exKey: string, ex: Exercise) =>
    updateEx(exKey, (e) => {
      const parent = [...e.sets].reverse().find((s) => s.kind !== 'warmup');
      if (!parent) return e;
      const root = parent.kind === 'drop' ? parent.parentKey : parent.key;
      const drop: EditedSet = { key: uuid(), kind: 'drop', parentKey: root, weight: dropWeight(parent.weight, ex.type, settings.dropPercent, stepLb(settings)), reps: parent.reps };
      return { ...e, sets: normalize([...e.sets, drop]) };
    });

  const toggleWarm = (exKey: string, setKey: string) =>
    updateEx(exKey, (e) => ({
      ...e,
      sets: normalize(e.sets.map((s) => (s.key === setKey && s.kind !== 'drop' ? { ...s, kind: s.kind === 'warmup' ? 'working' : 'warmup' } : s))),
    }));

  const removeSet = (exKey: string, setKey: string) => {
    if (editing?.setKey === setKey) setEditing(null);
    updateEx(exKey, (e) => ({ ...e, sets: e.sets.filter((s) => s.key !== setKey && s.parentKey !== setKey) }));
  };

  const duplicateSet = (exKey: string, setKey: string) =>
    updateEx(exKey, (e) => {
      const i = e.sets.findIndex((s) => s.key === setKey);
      return { ...e, sets: normalize([...e.sets.slice(0, i + 1), { ...e.sets[i], key: uuid() }, ...e.sets.slice(i + 1)]) };
    });

  // A superset moves as one block.
  const moveEx = (exKey: string, d: -1 | 1) => setExercises((l) => moveBlock(l, exKey, d));
  const tags = supersetTags(exercises);
  const blocks = supersetBlocks(exercises);
  const blockIndex = (key: string) => blocks.findIndex((b) => b.items.some((x) => x.key === key));

  // keypad
  const editingEx = editing ? exercises.find((e) => e.key === editing.exKey) : undefined;
  const editingSet = editingEx?.sets.find((s) => s.key === editing?.setKey);
  const editingExercise = editingEx ? exerciseOrMissing(exerciseMap, editingEx.exerciseId) : undefined;

  const textOf = (s: EditedSet, field: Field, ex: Exercise) =>
    field === 'effort'
      ? ''
      : field === 'weight' ? weightEditText(s.weight, ex, units) : field === 'reps' ? (s.reps != null ? String(s.reps) : '') : editTextOf(field as CardioField, fieldValue(s, field as CardioField), ex, units);
  const startEdit = (exKey: string, s: EditedSet, field: Field, ex: Exercise) => setEditing({ exKey, setKey: s.key, field, text: textOf(s, field, ex), fresh: true });
  const fieldsOf = (ex: Exercise): Field[] => (ex.type === 'cardio' ? cardioFields(ex) : ex.type === 'bodyweight' ? ['reps'] : ['weight', 'reps']);

  const optionsFor = (ex: Exercise, field: Field): KeypadOptions => {
    if (field === 'weight') return { mode: 'weight', allowNegative: ex.type === 'assisted' || ex.type === 'bodyweight_plus', step: settings.weightStep };
    if (field === 'reps') return { mode: 'reps', step: 1 };
    const k = keypadFor(field as CardioField, ex, units);
    return { mode: k.mode, step: k.step };
  };

  const onKey = (k: KeypadKey) => {
    if (!editing || !editingSet || !editingExercise) return;
    if (editing.field === 'effort') {
      // Hardware keys reach the effort pad too: digits, "." for ½, ↑ ↓, backspace.
      if (settings.effort !== 'off') {
        const rpe = applyEffortKey(editingSet.rpe, k, settings.effort);
        if (rpe !== editingSet.rpe) updateSet(editing.exKey, editing.setKey, { rpe });
      }
      return;
    }
    const ex = editingExercise;
    const text = applyKey(editing.text, editing.fresh, k, optionsFor(ex, editing.field));
    setEditing({ ...editing, text, fresh: false });
    if (editing.field === 'weight') {
      const v = parseWeightText(text);
      updateSet(editing.exKey, editing.setKey, { weight: weightFromEdit(v === undefined ? undefined : fromDisplay(v, units), ex) });
    } else if (editing.field === 'reps') updateSet(editing.exKey, editing.setKey, { reps: parseRepsText(text) });
    else {
      const f = editing.field as CardioField;
      updateSet(editing.exKey, editing.setKey, fieldPatch(f, parseFieldText(f, text, ex, units)));
    }
  };

  /** → Next walks the row's boxes, then the next row; ✓ Done on the last box of the last row closes. */
  const goNext = () => {
    if (!editing || !editingSet || !editingExercise || !editingEx) return;
    const fields = fieldsOf(editingExercise);
    const fi = editing.field === 'effort' ? fields.length - 1 : fields.indexOf(editing.field);
    if (fi < fields.length - 1) return startEdit(editing.exKey, editingSet, fields[fi + 1], editingExercise);
    const nextSet = editingEx.sets[editingEx.sets.findIndex((x) => x.key === editingSet.key) + 1];
    if (nextSet) startEdit(editing.exKey, nextSet, fields[0], editingExercise);
    else setEditing(null);
  };

  // Keep the box being typed into above the keypad.
  const editKey = editing ? `${editing.setKey}|${editing.field}` : '';
  useEffect(() => {
    if (!editKey) return;
    const id = requestAnimationFrame(() => document.querySelector('.bg-edit')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    return () => cancelAnimationFrame(id);
  }, [editKey]);

  const emptyCount = exercises.reduce((n, e) => n + e.sets.filter((s) => isEmptySet(s)).length, 0);

  const save = async () => {
    setSaving(true);
    try {
      await saveWorkoutEdits(id, { name, startedAt, endedAt, exercises: normalizeSupersets(exercises) });
      navigate(`/history/${id}`, { replace: true });
    } finally {
      setSaving(false);
    }
  };
  const leave = () => navigate(`/history/${id}`, { replace: true });

  const exMenuItem = exercises.find((e) => e.key === exMenu);
  const menuSet = setMenu ? exercises.find((e) => e.key === setMenu.exKey)?.sets.find((s) => s.key === setMenu.setKey) : undefined;
  const menuItems: MenuItem[] =
    setMenu && menuSet
      ? [
          ...(menuSet.kind !== 'drop' && exerciseOrMissing(exerciseMap, exercises.find((e) => e.key === setMenu.exKey)!.exerciseId).type !== 'cardio'
            ? [{ label: menuSet.kind === 'warmup' ? 'Mark as working set' : 'Mark as warm-up', glyph: menuSet.kind === 'warmup' ? '1' : 'W', onClick: () => toggleWarm(setMenu.exKey, setMenu.setKey) }]
            : []),
          { label: 'Duplicate', glyph: '⧉', onClick: () => duplicateSet(setMenu.exKey, setMenu.setKey) },
          { label: 'Delete', glyph: '✕', tone: 'danger' as const, onClick: () => removeSet(setMenu.exKey, setMenu.setKey) },
        ]
      : [];

  const exHeader = (e: EditedExercise, ex: Exercise) => (
    <div className="flex items-center gap-2">
      <b className="min-w-0 flex-1 truncate text-[16px] font-semibold">{ex.name}</b>
      <button
        type="button"
        onClick={() => {
          setEditing(null);
          setExMenu(e.key);
        }}
        aria-label={`${ex.name} options`}
        className="-mr-2 flex h-11 w-11 items-center justify-center text-[14px] font-bold tracking-[1px] text-accent"
      >
        •••
      </button>
    </div>
  );

  /** Cardio: # | TIME | the exercise's columns. Worked-out columns are grey. */
  const cardioSection = (e: EditedExercise, ex: Exercise) => {
    const cols = ['time' as const, ...cardioColumns(ex)];
    const grid = { gridTemplateColumns: `34px repeat(${cols.length}, minmax(0,1fr))` };
    return (
      <section key={e.key} className="border-b border-line pt-3 pb-2">
        {exHeader(e, ex)}
        {e.sets.length > 0 && (
          <div className="grid h-5 items-center gap-2 text-center text-[10.5px] font-bold tracking-[0.05em] text-fg2" style={grid}>
            <span>#</span>
            {cols.map((c) => (
              <span key={c} className="truncate">
                {columnHeader(c, ex, units)}
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-[2px]">
          {e.sets.map((s, i) => (
            <SwipeRow key={s.key} left={{ label: 'Delete', onTrigger: () => removeSet(e.key, s.key) }} onLongPress={(rect) => setSetMenu({ exKey: e.key, setKey: s.key, rect })}>
              <div className="grid h-10 items-center gap-2" style={grid}>
                <button
                  type="button"
                  aria-label={`Segment ${i + 1} options`}
                  onClick={(ev) => setSetMenu({ exKey: e.key, setKey: s.key, rect: (ev.currentTarget.parentElement as HTMLElement).getBoundingClientRect() })}
                  className="flex h-10 items-center justify-center text-[14px] font-bold"
                >
                  {i + 1}
                </button>
                {cols.map((c) => {
                  if (c !== 'time' && isComputed(c))
                    return (
                      <span key={c} className="truncate text-center text-[15px] font-medium text-fg3">
                        {columnText(c, s, ex, units) || '—'}
                      </span>
                    );
                  const f = c as CardioField;
                  const on = editing?.setKey === s.key && editing.field === f;
                  return (
                    <EditCell
                      key={c}
                      text={on ? editing!.text : formatField(f, fieldValue(s, f), ex, units)}
                      editing={on}
                      onClick={() => startEdit(e.key, s, f, ex)}
                      label={`Segment ${i + 1} ${FIELD_NAME[f]}`}
                    />
                  );
                })}
              </div>
            </SwipeRow>
          ))}
        </div>
        {/* 6.7: 12 px above and below the segment button, including section padding. */}
        <AddButton onClick={() => addSet(e.key)} className="mt-3 mb-1 w-full">
          + Segment
        </AddButton>
      </section>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <TopBar
        border={false}
        left={
          <BarButton kind="muted" onClick={() => (dirty ? setOverlay('discard') : leave())}>
            Cancel
          </BarButton>
        }
        title="Edit workout"
        right={
          <BarButton kind="bold" onClick={() => void save()} disabled={saving || !dirty}>
            Save
          </BarButton>
        }
      />
      <div className="scroll-y min-h-0 flex-1 px-4 pb-8">
        <div className="mt-1 flex items-baseline gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={() => setEditing(null)}
            maxLength={60}
            placeholder="Workout name"
            className="min-w-0 flex-1 bg-transparent text-[30px] leading-tight font-bold tracking-[-0.02em] outline-none placeholder:text-fg3"
          />
        </div>
        <button type="button" onClick={() => setOverlay('time')} className="-mb-3 flex h-11 w-full items-start justify-between pt-1 text-[13px] text-fg2">
          <span>
            {fmtDay(startedAt)} · {fmtTime(startedAt)}
            {endedAt ? ` – ${fmtTime(endedAt)}` : ''}
          </span>
          <ChevronRight size={11} className="mt-1" />
        </button>

        {blocks.map((b) => {
          const section = (e: EditedExercise) => {
          const ex = exerciseOrMissing(exerciseMap, e.exerciseId);
          if (ex.type === 'cardio') return cardioSection(e, ex);
          const labels = setLabels(e.sets.map((s, j) => ({ id: s.key, order: j, kind: s.kind, parentSetId: s.parentKey })));
          const showW = hasWeightColumn(ex.type);
          const cols = showW ? 'grid-cols-[34px_1fr_1fr]' : 'grid-cols-[34px_1fr]';
          return (
            <section key={e.key} className="border-b border-line pt-3 pb-6">
              <div className="flex items-center gap-2">
                <TagPill tag={tags.get(e.key)} on />
                <b className="min-w-0 flex-1 truncate text-[16px] font-semibold">
                  {ex.name}
                  {TYPE_TAG[ex.type] && <Tag>{TYPE_TAG[ex.type]}</Tag>}
                </b>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setExMenu(e.key);
                  }}
                  aria-label={`${ex.name} options`}
                  className="-mr-2 flex h-11 w-11 items-center justify-center text-[14px] font-bold tracking-[1px] text-accent"
                >
                  •••
                </button>
              </div>
              {e.sets.length > 0 && (
                <div className={cx('grid h-5 items-center gap-2 text-center text-[10.5px] font-bold tracking-[0.05em] text-fg2', cols)}>
                  <span>SET</span>
                  {showW && <span>{weightColumnLabel(ex.type, unitColumn(units))}</span>}
                  <span>REPS</span>
                </div>
              )}
              <div className="flex flex-col gap-[2px]">
                {e.sets.map((s) => {
                  const l = labels.get(s.key)!;
                  const editW = editing?.setKey === s.key && editing.field === 'weight';
                  const editR = editing?.setKey === s.key && editing.field === 'reps';
                  const editE = editing?.setKey === s.key && editing.field === 'effort';
                  const mode = settings.effort;
                  const badge =
                    mode === 'off' || s.kind !== 'working' ? null : editE ? (
                      <EffortBadge inset historyEdit tone="active" text={s.rpe != null ? effortBadge(s.rpe, mode) : '+'} label="Picking effort" />
                    ) : s.rpe != null ? (
                      <EffortBadge inset historyEdit tone="logged" text={effortBadge(s.rpe, mode)} label={`${effortSpoken(s.rpe, mode)}. Change effort`} onPress={() => startEdit(e.key, s, 'effort', ex)} />
                    ) : null;
                  const wText = editW ? weightEditDisplay(editing!.text, ex) : weightCellText(s.weight, ex, units);
                  return (
                    <SwipeRow
                      key={s.key}
                      className={cx(s.kind === 'drop' && 'ml-3.5')}
                      right={s.kind === 'drop' ? undefined : { label: s.kind === 'warmup' ? 'Working set' : 'Warm-up', onTrigger: () => toggleWarm(e.key, s.key) }}
                      left={{ label: 'Delete', onTrigger: () => removeSet(e.key, s.key) }}
                      onLongPress={(rect) => setSetMenu({ exKey: e.key, setKey: s.key, rect })}
                    >
                      <div className={cx('grid h-10 items-center gap-2', cols, s.kind === 'drop' && 'border-l-2 border-warn')}>
                        <button
                          type="button"
                          aria-label={`Set ${l} options`}
                          onClick={(ev) => setSetMenu({ exKey: e.key, setKey: s.key, rect: (ev.currentTarget.parentElement as HTMLElement).getBoundingClientRect() })}
                          className={cx('flex h-10 items-center justify-center text-[14px] font-bold', s.kind === 'warmup' && 'text-fg2', s.kind === 'drop' && 'text-warn')}
                        >
                          {l}
                        </button>
                        {showW && <EditCell text={wText} editing={editW} onClick={() => startEdit(e.key, s, 'weight', ex)} label={`Set ${l} weight`} />}
                        <EditCell text={editR ? editing!.text : s.reps != null ? String(s.reps) : ''} editing={editR} onClick={() => startEdit(e.key, s, 'reps', ex)} label={`Set ${l} reps`} badge={badge} />
                      </div>
                    </SwipeRow>
                  );
                })}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <AddButton tone="warn" onClick={() => addDrop(e.key, ex)} disabled={!e.sets.some((s) => s.kind !== 'warmup')}>
                  + Drop
                </AddButton>
                <AddButton onClick={() => addSet(e.key)}>+ Set</AddButton>
              </div>
            </section>
          );
          };
          if (!b.letter) return section(b.items[0]);
          return (
            <div key={`ss-${b.items[0].key}`} className="mt-3 border-l-2 border-accent pl-3">
              <div className="pt-1 text-[11px] font-bold tracking-[0.07em] text-accent uppercase">Superset {b.letter}</div>
              {b.items.map(section)}
            </div>
          );
        })}

        <AddButton
          className="mt-4 w-full"
          onClick={() => {
            setEditing(null);
            setOverlay('add');
          }}
        >
          + Add exercises
        </AddButton>
        <p className="mt-3 text-[12.5px] leading-normal text-fg2">
          {emptyCount ? `${emptyCount} empty ${emptyCount === 1 ? 'row' : 'rows'} will be removed on Save. ` : ''}
          Records and charts update on Save.
        </p>
      </div>

      {editing && editingSet && editingExercise && (() => {
        const ex = editingExercise;
        const cardio = ex.type === 'cardio';
        const fields = fieldsOf(ex);
        const fi = fields.indexOf(editing.field);
        const effortTab = settings.effort !== 'off' && !cardio && editingSet.kind === 'working';
        const tabs: KeypadTab[] = [...fields, ...(effortTab ? ['effort'] : [])].map((f) => ({
          id: f,
          label: f === 'effort' ? EFFORT_LABEL[settings.effort].toLowerCase() : cardio ? fieldTab(f as CardioField, ex, units) : f === 'weight' ? (units === 'lb' ? 'lbs' : 'kg') : 'reps',
        }));
        const who = (() => {
          const l = setLabels(editingEx!.sets.map((s, j) => ({ id: s.key, order: j, kind: s.kind, parentSetId: s.parentKey }))).get(editingSet.key);
          return l === 'W' ? 'Warm-up' : l === 'D' ? 'Drop set' : `Set ${l}`;
        })();
        if (editing.field === 'effort' && settings.effort !== 'off') {
          const mode = settings.effort;
          return (
            <Keypad
              left={`${who} · ${EFFORT_LABEL[mode]}`}
              tabs={tabs}
              tab="effort"
              onTab={(f) => f !== 'effort' && startEdit(editing.exKey, editingSet, f, ex)}
              next={{ done: true, onPress: goNext }}
              bottomLeft={{ key: 'minus', enabled: false }}
              stepLabel=""
              onKey={onKey}
              onClose={() => setEditing(null)}
              panel={<EffortPad key={editing.setKey} mode={mode} value={editingSet.rpe} onChange={(v) => updateSet(editing.exKey, editing.setKey, { rpe: v })} onClose={() => setEditing(null)} />}
            />
          );
        }
        const opts = optionsFor(ex, editing.field);
        return (
          <Keypad
            left={cardio ? FIELD_NAME[editing.field as CardioField] : `${who} · ${editing.field === 'weight' ? 'Weight' : 'Reps'}`}
            tabs={tabs}
            tab={editing.field}
            onTab={(f) => f !== editing.field && startEdit(editing.exKey, editingSet, f, ex)}
            next={{ done: fi === fields.length - 1, onPress: goNext }}
            bottomLeft={
              editing.field === 'weight'
                ? { key: 'minus', enabled: !!opts.allowNegative }
                : editing.field === 'reps'
                  ? { key: 'dash', enabled: false }
                  : opts.mode === 'time'
                    ? { key: 'colon', enabled: true }
                    : { key: 'minus', enabled: false }
            }
            decimal={editing.field === 'weight' || opts.mode === 'decimal'}
            stepLabel={editing.field === 'weight' ? `${settings.weightStep} ${unitLabel(units)}` : editing.field === 'reps' ? '1 rep' : keypadFor(editing.field as CardioField, ex, units).stepLabel}
            onKey={onKey}
            onClose={() => setEditing(null)}
          />
        );
      })()}

      <TimeSheet
        open={overlay === 'time'}
        startedAt={startedAt}
        endedAt={endedAt}
        onClose={() => setOverlay(null)}
        onSave={(a, b) => {
          setStartedAt(a);
          setEndedAt(b);
        }}
      />

      <Sheet open={!!exMenuItem} onClose={() => setExMenu(null)} title={exMenuItem ? exerciseOrMissing(exerciseMap, exMenuItem.exerciseId).name : ''}>
        {exMenuItem && (
          <>
            <SheetOption
              onClick={() => {
                setReplacing(exMenuItem.key);
                setExMenu(null);
              }}
            >
              Replace exercise…
            </SheetOption>
            {tags.get(exMenuItem.key) && (
              <SheetOption
                onClick={() => {
                  setExercises((l) => unlinkSuperset(l, exMenuItem.key));
                  setExMenu(null);
                }}
                detail={tags.get(exMenuItem.key)}
              >
                Unlink superset
              </SheetOption>
            )}
            <SheetOption
              disabled={blockIndex(exMenuItem.key) <= 0}
              onClick={() => {
                moveEx(exMenuItem.key, -1);
                setExMenu(null);
              }}
            >
              Move up
            </SheetOption>
            <SheetOption
              disabled={blockIndex(exMenuItem.key) === blocks.length - 1}
              onClick={() => {
                moveEx(exMenuItem.key, 1);
                setExMenu(null);
              }}
            >
              Move down
            </SheetOption>
            <SheetOption
              tone="danger"
              onClick={() => {
                setExercises((l) => unlinkSuperset(l, exMenuItem.key).filter((x) => x.key !== exMenuItem.key));
                setExMenu(null);
              }}
            >
              Remove from workout
            </SheetOption>
          </>
        )}
      </Sheet>
      <HoldMenu open={!!setMenu} anchor={setMenu?.rect} items={menuItems} onClose={() => setSetMenu(null)} />
      <ExercisePicker
        open={overlay === 'add'}
        mode="multi"
        currentLabel="In this workout"
        current={exercises.map((e) => ({ exerciseId: e.exerciseId }))}
        onCancel={() => setOverlay(null)}
        onDone={({ keep, added }) => {
          setOverlay(null);
          setExercises((l) => [
            ...l.filter((e) => keep.includes(e.exerciseId)),
            ...added.map((exId) => ({ key: uuid(), exerciseId: exId, sets: [{ key: uuid(), kind: 'working' as const }] })),
          ]);
        }}
      />
      <ExercisePicker
        open={!!replacing}
        mode="single"
        title="Replace exercise"
        excludeIds={exercises.map((e) => e.exerciseId)}
        onCancel={() => setReplacing(null)}
        onPick={(exId) => {
          if (replacing) updateEx(replacing, (e) => ({ ...e, exerciseId: exId }));
          setReplacing(null);
        }}
      />
      <Alert
        open={overlay === 'discard'}
        title="Discard changes?"
        message="Your edits to this workout won't be saved."
        onClose={() => setOverlay(null)}
        actions={[
          { label: 'Discard', kind: 'danger', onClick: leave },
          { label: 'Keep editing', kind: 'bold', onClick: () => setOverlay(null) },
        ]}
      />
    </div>
  );
}

function EditCell({ text, editing, onClick, label, badge }: { text: string; editing: boolean; onClick: () => void; label: string; badge?: ReactNode }) {
  const cell = (
    <button type="button" aria-label={label} onClick={onClick} className="flex h-10 w-full items-center">
      <span className={cx('flex h-[32px] w-full items-center justify-center rounded-[8px] text-[16px] font-semibold', editing ? 'border-2 border-accent bg-edit' : 'bg-surface-2')}>
        {text ? <span>{text}</span> : !editing && <span className="text-[14px] font-medium text-fg3">—</span>}
      </span>
    </button>
  );
  if (!badge) return cell;
  return (
    <div className="relative">
      {cell}
      {/* The box's outline (32 px in a 40 px row), for the badge to sit in. */}
      <span className="pointer-events-none absolute inset-x-0 inset-y-[4px]">{badge}</span>
    </div>
  );
}

function TimeSheet({
  open,
  startedAt,
  endedAt,
  onClose,
  onSave,
}: {
  open: boolean;
  startedAt: number;
  endedAt?: number;
  onClose: () => void;
  onSave: (start: number, end?: number) => void;
}) {
  const [a, setA] = useState(toLocalInputValue(startedAt));
  const [b, setB] = useState(endedAt ? toLocalInputValue(endedAt) : '');
  useEffect(() => {
    if (open) {
      setA(toLocalInputValue(startedAt));
      setB(endedAt ? toLocalInputValue(endedAt) : '');
    }
  }, [open, startedAt, endedAt]);
  const ta = fromLocalInputValue(a);
  const tb = b ? fromLocalInputValue(b) : undefined;
  const error = !ta ? 'Pick a start time.' : tb !== undefined && tb < ta ? 'The end is before the start.' : ta > Date.now() ? "That's in the future." : '';
  const input = 'mt-1.5 h-12 w-full rounded-[10px] bg-surface-2 px-3 text-[17px] text-fg outline-none focus:ring-2 focus:ring-accent';
  return (
    <Sheet open={open} onClose={onClose} title="Date & time">
      <FieldLabel className="mt-1">Started</FieldLabel>
      <input type="datetime-local" value={a} max={toLocalInputValue(Date.now())} onChange={(e) => setA(e.target.value)} className={input} />
      <FieldLabel>Finished</FieldLabel>
      <input type="datetime-local" value={b} onChange={(e) => setB(e.target.value)} className={input} />
      {error && <p className="mt-2 text-[13px] font-semibold text-danger">{error}</p>}
      <Button
        className="mt-4"
        disabled={!!error}
        onClick={() => {
          if (ta) onSave(ta, tb);
          onClose();
        }}
      >
        Done
      </Button>
    </Sheet>
  );
}
