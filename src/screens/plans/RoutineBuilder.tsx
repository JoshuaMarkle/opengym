import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { SwipeRow } from '../../components/gestures';
import { CheckGlyph, ChevronRight, Handle } from '../../components/icons';
import { EffortBadge, EffortPad } from '../../components/Effort';
import { Keypad, type KeypadTab } from '../../components/Keypad';
import { Alert, HoldMenu, Sheet, SheetOption, type MenuItem } from '../../components/overlays';
import { AddButton, BarButton, cx, Tag, TextField, TopBar } from '../../components/ui';
import { exerciseOrMissing, useData } from '../../data/DataProvider';
import { lastSession } from '../../data/history';
import { routineCodes } from '../../lib/schedule';
import { ASSIGN_KEY, type PendingAssign } from './ScheduleEditor';
import { defaultFolderForNewRoutine, loadRoutineDraft, saveRoutine, type DraftExercise, type DraftSet, type RoutineDraft } from '../../data/routines';
import { usePlans } from '../../data/usePlans';
import type { Exercise } from '../../db/types';
import { uuid } from '../../lib/id';
import { applyKey, parseWeightText, type KeypadKey } from '../../lib/keypad';
import { columnsLabel } from '../../lib/cardio';
import { applyEffortKey, EFFORT_LABEL, effortBadge, effortSpoken, type EffortMode } from '../../lib/effort';
import { formatRepRange, hasWeightColumn, orderSets, parseRepRange, setLabels, TYPE_TAG, weightColumnLabel } from '../../lib/sets';
import { groupOf, linkSuperset, MAX_SUPERSET, moveBlock, settleDrag, supersetBlocks, supersetTags, unlinkSuperset } from '../../lib/supersets';
import { fromDisplay, unitColumn, unitLabel } from '../../lib/units';
import { ExercisePicker } from '../exercises/ExercisePicker';
import { weightCellText, weightEditDisplay, weightEditText, weightFromEdit } from '../workout/SetTable';
import { SupersetSheet } from '../workout/SupersetSheet';
import { TagPill } from '../workout/WorkoutScreen';
import { NewFolderSheet } from './RoutineActions';
import { estimateMinutes } from './RoutineScreen';

/** 'effort' is the rpe / rir tab on a reps box: the set's optional effort target (A4). */
type Field = 'weight' | 'reps' | 'effort';
interface Editing {
  exKey: string;
  setKey: string;
  field: Field;
  text: string;
  fresh: boolean;
}

/** undefined = the default folder (active, or a new "My Routines"); null = no folder. */
type FolderChoice = string | null | undefined;

/** 2.3 / 2.4: build or edit a routine. Nothing is saved until Save. */
export function RoutineBuilder() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const loaded = useLiveQuery(async () => (id ? ((await loadRoutineDraft(id)) ?? null) : null), [id]);
  if (id && loaded === undefined) return null;
  return <Builder key={id ?? 'new'} initial={loaded ?? undefined} folderParam={params.get('folder') ?? undefined} slotParam={params.get('slot') ?? undefined} />;
}

function Builder({ initial: initialProp, folderParam, slotParam }: { initial?: RoutineDraft; folderParam?: string; slotParam?: string }) {
  // Freeze what we started from; later DB changes don't reset the form.
  const [initial] = useState(initialProp);
  const navigate = useNavigate();
  const { exerciseMap, history, settings } = useData();
  const plans = usePlans();
  const units = settings.units;

  const [name, setName] = useState(initial?.name ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [code, setCode] = useState(initial?.code ?? '');
  const [folder, setFolder] = useState<FolderChoice>(initial ? (initial.folderId ?? null) : folderParam);
  const [exercises, setExercises] = useState<DraftExercise[]>(initial?.exercises ?? []);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [overlay, setOverlay] = useState<'folder' | 'newFolder' | 'add' | 'discard' | 'superset' | 'supersetAdd' | null>(null);
  const [ssAnchor, setSsAnchor] = useState<string | null>(null);
  const [ssPre, setSsPre] = useState<string[]>([]);
  const [exMenu, setExMenu] = useState<string | null>(null);
  const [replacing, setReplacing] = useState<string | null>(null);
  const [setMenu, setSetMenu] = useState<{ exKey: string; setKey: string; rect: DOMRect } | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const snapshot = useMemo(() => JSON.stringify({ n: initial?.name ?? '', no: initial?.notes ?? '', c: initial?.code ?? '', f: initial ? (initial.folderId ?? null) : folderParam, e: initial?.exercises ?? [] }), [initial, folderParam]);
  const dirty = JSON.stringify({ n: name, no: notes, c: code, f: folder, e: exercises }) !== snapshot;

  const folderObj = typeof folder === 'string' ? plans?.folders.find((f) => f.id === folder) : undefined;
  const defaultFolder = plans?.activeFolder ?? plans?.folders.find((f) => !f.archived);
  // What the plan strips show when Short label is empty.
  const autoCode = useMemo(() => {
    if (!plans) return '';
    const fid = typeof folder === 'string' ? folder : folder === undefined ? defaultFolder?.id : undefined;
    const others = plans.routines.filter((r) => r.id !== initial?.id && (r.folderId ?? undefined) === fid);
    const me = { id: '__me', name: name.trim() || 'Routine' };
    return routineCodes([...others, me]).get('__me') ?? '';
  }, [plans, folder, defaultFolder, name, initial?.id]);
  const folderLabel = folder === null ? 'No folder' : folderObj ? `${folderObj.name} folder` : defaultFolder ? `${defaultFolder.name} folder` : 'My Routines folder';

  const setCount = exercises.reduce((n, e) => n + e.sets.length, 0);
  const workingCount = exercises.reduce((n, e) => n + e.sets.filter((s) => s.kind === 'working').length, 0);

  // ───── edits

  const updateEx = (exKey: string, fn: (e: DraftExercise) => DraftExercise) => setExercises((list) => list.map((e) => (e.key === exKey ? fn(e) : e)));
  const updateSet = (exKey: string, setKey: string, patch: Partial<DraftSet>) => updateEx(exKey, (e) => ({ ...e, sets: e.sets.map((s) => (s.key === setKey ? { ...s, ...patch } : s)) }));
  const sortWarmFirst = (sets: DraftSet[]) => [...sets.filter((s) => s.kind === 'warmup'), ...sets.filter((s) => s.kind === 'working')];

  const newSetsFor = (exerciseId: string): DraftSet[] => {
    const last = lastSession(history, exerciseId);
    if (exerciseMap.get(exerciseId)?.type === 'cardio') return Array.from({ length: Math.max(1, last?.sets.length ?? 1) }, () => ({ key: uuid(), kind: 'working' as const, weight: 'last' as const }));
    const sets = last ? orderSets(last.sets).filter((s) => s.kind !== 'drop') : [];
    if (!sets.length) return Array.from({ length: 3 }, () => ({ key: uuid(), kind: 'working' as const, weight: 'last' as const }));
    return sets.map((s) => ({ key: uuid(), kind: s.kind as 'warmup' | 'working', weight: 'last' as const }));
  };

  const addSet = (exKey: string) =>
    updateEx(exKey, (e) => {
      const work = e.sets.filter((s) => s.kind === 'working');
      const lastW = work[work.length - 1];
      return { ...e, sets: [...e.sets, { key: uuid(), kind: 'working', weight: lastW?.weight ?? 'last', repsMin: lastW?.repsMin, repsMax: lastW?.repsMax }] };
    });

  const toggleWarm = (exKey: string, setKey: string) =>
    updateEx(exKey, (e) => ({ ...e, sets: sortWarmFirst(e.sets.map((s) => (s.key === setKey ? { ...s, kind: s.kind === 'warmup' ? 'working' : 'warmup' } : s))) }));

  const removeSet = (exKey: string, setKey: string) => {
    if (editing?.setKey === setKey) setEditing(null);
    updateEx(exKey, (e) => ({ ...e, sets: e.sets.filter((s) => s.key !== setKey) }));
  };

  const duplicateSet = (exKey: string, setKey: string) =>
    updateEx(exKey, (e) => {
      const i = e.sets.findIndex((s) => s.key === setKey);
      const copy = { ...e.sets[i], key: uuid() };
      return { ...e, sets: sortWarmFirst([...e.sets.slice(0, i + 1), copy, ...e.sets.slice(i + 1)]) };
    });

  // A superset moves as one block.
  const moveEx = (exKey: string, delta: -1 | 1) => setExercises((list) => moveBlock(list, exKey, delta));
  const tags = supersetTags(exercises);
  const blocks = supersetBlocks(exercises);
  const blockIndex = (key: string) => blocks.findIndex((b) => b.items.some((x) => x.key === key));

  // ───── keypad

  const editingEx = editing ? exercises.find((e) => e.key === editing.exKey) : undefined;
  const editingSet = editingEx?.sets.find((s) => s.key === editing?.setKey);
  const editingExercise = editingEx ? exerciseOrMissing(exerciseMap, editingEx.exerciseId) : undefined;

  const startEdit = (exKey: string, set: DraftSet, field: Field, ex: Exercise) => {
    const text = field === 'effort' ? '' : field === 'weight' ? (set.weight === 'last' ? '' : weightEditText(set.weight, ex, units)) : formatRepRange(set.repsMin, set.repsMax);
    setEditing({ exKey, setKey: set.key, field, text, fresh: true });
  };

  const onKey = (k: KeypadKey) => {
    if (!editing || !editingSet || !editingExercise) return;
    if (editing.field === 'effort') {
      // Hardware keys reach the effort pad too: digits, "." for ½, ↑ ↓, backspace.
      if (settings.effort !== 'off') {
        const rpeTarget = applyEffortKey(editingSet.rpeTarget, k, settings.effort);
        if (rpeTarget !== editingSet.rpeTarget) updateSet(editing.exKey, editing.setKey, { rpeTarget });
      }
      return;
    }
    const ex = editingExercise;
    const allowNegative = editing.field === 'weight' && (ex.type === 'assisted' || ex.type === 'bodyweight_plus');
    const text = applyKey(editing.text, editing.fresh, k, { mode: editing.field, allowRange: true, allowNegative, step: settings.weightStep });
    setEditing({ ...editing, text, fresh: false });
    if (editing.field === 'weight') {
      const v = parseWeightText(text);
      const lb = v === undefined ? undefined : weightFromEdit(fromDisplay(v, units), ex);
      updateSet(editing.exKey, editing.setKey, { weight: v === undefined || lb === undefined ? 'last' : lb });
    } else {
      const r = parseRepRange(text);
      updateSet(editing.exKey, editing.setKey, { repsMin: r.repsMin, repsMax: r.repsMax });
    }
  };

  // Keep the box being typed into above the keypad.
  const editKey = editing ? `${editing.setKey}|${editing.field}` : '';
  useEffect(() => {
    if (!editKey) return;
    const id = requestAnimationFrame(() => document.querySelector('.bg-edit')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    return () => cancelAnimationFrame(id);
  }, [editKey]);

  // ───── save / leave

  const save = async () => {
    if (!name.trim()) {
      setError('Name the routine');
      nameRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      const folderId = folder === null ? undefined : (folder ?? (await defaultFolderForNewRoutine()));
      const rid = await saveRoutine({ id: initial?.id, name, notes, code, folderId, exercises });
      // 2.19 "+ New routine for this day": hand the routine back to the schedule editor.
      const [kind, index] = slotParam?.split(':') ?? [];
      if (!initial?.id && folderId && (kind === 'cycle' || kind === 'weekly')) {
        const pending: PendingAssign = { folderId, kind, index: Number(index), routineId: rid };
        sessionStorage.setItem(ASSIGN_KEY, JSON.stringify(pending));
        navigate(-1);
        return;
      }
      navigate(`/routine/${rid}`, { replace: true });
    } finally {
      setSaving(false);
    }
  };

  const leave = () => (initial?.id ? navigate(`/routine/${initial.id}`, { replace: true }) : window.history.length > 1 ? navigate(-1) : navigate('/plans'));
  const cancel = () => (dirty ? setOverlay('discard') : leave());

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    // Dropping inside a bracket joins that superset; dragging a member out unlinks it.
    setExercises((list) => settleDrag(list, arrayMove(list, list.findIndex((e) => e.key === active.id), list.findIndex((e) => e.key === over.id)), String(active.id)));
  };

  const exMenuItem = exercises.find((e) => e.key === exMenu);
  const menuSet = setMenu ? exercises.find((e) => e.key === setMenu.exKey)?.sets.find((s) => s.key === setMenu.setKey) : undefined;
  const setMenuItems: MenuItem[] =
    setMenu && menuSet
      ? [
          { label: menuSet.kind === 'warmup' ? 'Mark as working set' : 'Mark as warm-up', glyph: menuSet.kind === 'warmup' ? '1' : 'W', onClick: () => toggleWarm(setMenu.exKey, setMenu.setKey) },
          { label: 'Duplicate', glyph: '⧉', onClick: () => duplicateSet(setMenu.exKey, setMenu.setKey) },
          { label: 'Delete', glyph: '✕', tone: 'danger', onClick: () => removeSet(setMenu.exKey, setMenu.setKey) },
        ]
      : [];

  return (
    <div className="flex h-full flex-col">
      <TopBar
        left={
          <BarButton kind="muted" onClick={cancel}>
            Cancel
          </BarButton>
        }
        title={name.trim() || (initial ? 'Routine' : 'New routine')}
        right={
          <BarButton kind="bold" onClick={() => void save()} disabled={saving}>
            Save
          </BarButton>
        }
      />
      <div className="scroll-y min-h-0 flex-1 px-4 pb-8" onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
        <div className="mt-3 flex items-baseline gap-3 border-b border-line-strong pb-1.5">
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            onFocus={() => setEditing(null)}
            placeholder="Routine name"
            maxLength={60}
            autoFocus={!initial}
            enterKeyHint="done"
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="min-w-0 flex-1 bg-transparent text-[26px] font-bold tracking-[-0.01em] outline-none placeholder:text-fg3"
          />
          <button type="button" onClick={() => setOverlay('folder')} className="flex h-9 flex-none items-center gap-1 text-[13px] text-fg2 active:opacity-60">
            {folderLabel}
            <ChevronRight size={10} />
          </button>
        </div>
        {error && <p className="mt-1.5 text-[13px] font-semibold text-danger">{error}</p>}
        <div className="mt-1.5 flex justify-between text-[13px] text-fg2">
          <span>
            {exercises.length} {exercises.length === 1 ? 'exercise' : 'exercises'} · {workingCount} sets
          </span>
          {setCount > 0 && <span>~{estimateMinutes(history, initial?.id, setCount, exercises.filter((e) => tags.has(e.key)).reduce((n, e) => n + e.sets.length, 0))} min</span>}
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} onDragStart={() => setEditing(null)}>
          <SortableContext items={exercises.map((e) => e.key)} strategy={verticalListSortingStrategy}>
            {blocks.map((b) => {
              const section = (e: DraftExercise) => (
              <ExerciseSection
                key={e.key}
                tag={tags.get(e.key)}
                draft={e}
                exercise={exerciseOrMissing(exerciseMap, e.exerciseId)}
                units={units}
                effort={settings.effort}
                editing={editing?.exKey === e.key ? editing : null}
                onEdit={(set, field, ex) => startEdit(e.key, set, field, ex)}
                onMenu={() => {
                  setEditing(null);
                  setExMenu(e.key);
                }}
                onAddSet={() => addSet(e.key)}
                onToggleWarm={(s) => toggleWarm(e.key, s)}
                onDelete={(s) => removeSet(e.key, s)}
                onSetMenu={(s, rect) => setSetMenu({ exKey: e.key, setKey: s, rect })}
              />
              );
              if (!b.letter) return section(b.items[0]);
              return (
                <div key={`ss-${b.items[0].key}`} className="mt-3 border-l-2 border-accent pl-3">
                  <div className="flex items-baseline justify-between gap-2 pt-1">
                    <span className="text-[11px] font-bold tracking-[0.07em] text-accent uppercase">Superset {b.letter}</span>
                    <span className="text-[12px] text-fg2">alternate sets · ••• to unlink</span>
                  </div>
                  {b.items.map(section)}
                </div>
              );
            })}
          </SortableContext>
        </DndContext>

        <AddButton
          className="mt-4 w-full"
          onClick={() => {
            setEditing(null);
            setOverlay('add');
          }}
        >
          + Add exercises
        </AddButton>

        <div className="mt-6 text-[11px] font-bold tracking-[0.06em] text-fg2 uppercase">Notes</div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onFocus={() => setEditing(null)}
          placeholder="Optional. Shown on the routine screen."
          rows={3}
          maxLength={500}
          className="mt-1.5 w-full resize-none rounded-[10px] border-[1.5px] border-transparent bg-surface-2 px-3 py-2.5 text-[16px] outline-none focus:border-accent"
        />

        <div className="mt-5 text-[11px] font-bold tracking-[0.06em] text-fg2 uppercase">Short label</div>
        <div className="flex items-center gap-3">
          <div className="w-[88px] flex-none">
            <TextField
              value={code}
              onChange={(v) => setCode(v.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase())}
              placeholder={autoCode}
              maxLength={3}
              className="text-center font-bold tracking-[0.04em]"
            />
          </div>
          <p className="mt-1.5 min-w-0 flex-1 text-[13px] leading-snug text-fg2">1–3 letters for plan schedules. Leave empty to use {autoCode || 'one from the name'}.</p>
        </div>
      </div>

      {editing && editingSet && editingExercise && (() => {
        const labels = setLabels(editingEx!.sets.map((s, i) => ({ id: s.key, order: i, kind: s.kind })));
        const l = labels.get(editingSet.key);
        const who = l === 'W' ? 'Warm-up' : `Set ${l}`;
        const fields: Field[] = editingExercise.type === 'bodyweight' ? ['reps'] : ['weight', 'reps'];
        // A working set's boxes also have the rpe / rir tab, for an optional target (A4).
        const effortTab = settings.effort !== 'off' && editingSet.kind === 'working';
        const tabs: KeypadTab[] = [...fields, ...(effortTab ? (['effort'] as Field[]) : [])].map((f) => ({
          id: f,
          label: f === 'effort' ? EFFORT_LABEL[settings.effort].toLowerCase() : f === 'weight' ? (units === 'lb' ? 'lbs' : 'kg') : 'reps',
        }));
        const fi = editing.field === 'effort' ? fields.length - 1 : fields.indexOf(editing.field);
        const negative = editing.field === 'weight' && (editingExercise.type === 'assisted' || editingExercise.type === 'bodyweight_plus');
        const goNext = () => {
          if (fi < fields.length - 1) return startEdit(editing.exKey, editingSet, fields[fi + 1], editingExercise);
          // Done on reps moves to the next set's first box, or closes on the last set.
          const sets = editingEx!.sets;
          const nextSet = sets[sets.findIndex((x) => x.key === editingSet.key) + 1];
          if (nextSet) startEdit(editing.exKey, nextSet, fields[0], editingExercise);
          else setEditing(null);
        };
        if (editing.field === 'effort' && settings.effort !== 'off') {
          const mode = settings.effort;
          return (
            <Keypad
              left={`${who} · ${EFFORT_LABEL[mode]} target`}
              tabs={tabs}
              tab="effort"
              onTab={(f) => f !== 'effort' && startEdit(editing.exKey, editingSet, f as Field, editingExercise)}
              next={{ done: true, onPress: goNext }}
              bottomLeft={{ key: 'minus', enabled: false }}
              stepLabel=""
              onKey={onKey}
              onClose={() => setEditing(null)}
              panel={<EffortPad key={editing.setKey} mode={mode} value={editingSet.rpeTarget} onChange={(v) => updateSet(editing.exKey, editing.setKey, { rpeTarget: v })} onClose={() => setEditing(null)} />}
            />
          );
        }
        return (
          <Keypad
            left={editing.field === 'weight' ? `${who} · Weight (empty = last)` : `${who} · Reps (optional)`}
            tabs={tabs}
            tab={editing.field}
            onTab={(f) => f !== editing.field && startEdit(editing.exKey, editingSet, f as Field, editingExercise)}
            next={{ done: fi === fields.length - 1, onPress: goNext }}
            bottomLeft={editing.field === 'weight' ? { key: 'minus', enabled: negative } : { key: 'dash', enabled: true }}
            decimal={editing.field === 'weight'}
            stepLabel={editing.field === 'weight' ? `${settings.weightStep} ${unitLabel(units)}` : '1 rep'}
            onKey={onKey}
            onClose={() => setEditing(null)}
          />
        );
      })()}

      {/* folder picker */}
      <Sheet open={overlay === 'folder'} onClose={() => setOverlay(null)} title="Folder">
        {plans?.folders.map((f) => (
          <SheetOption
            key={f.id}
            onClick={() => {
              setFolder(f.id);
              setOverlay(null);
            }}
            detail={
              <>
                {f.archived && 'archived'}
                {(folder === f.id || (folder === undefined && defaultFolder?.id === f.id)) && <CheckGlyph size={15} className="text-accent" />}
              </>
            }
          >
            {f.name}
          </SheetOption>
        ))}
        <SheetOption
          onClick={() => {
            setFolder(null);
            setOverlay(null);
          }}
          detail={folder === null ? <CheckGlyph size={15} className="text-accent" /> : undefined}
        >
          No folder
        </SheetOption>
        <SheetOption tone="accent" onClick={() => setOverlay('newFolder')}>
          + New folder…
        </SheetOption>
      </Sheet>
      <NewFolderSheet
        open={overlay === 'newFolder'}
        onClose={() => setOverlay((o) => (o === 'newFolder' ? null : o))}
        onCreated={(fid) => {
          setFolder(fid);
          setOverlay(null);
        }}
      />

      {/* exercise ••• */}
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
            {exerciseOrMissing(exerciseMap, exMenuItem.exerciseId).type !== 'cardio' &&
              (tags.get(exMenuItem.key) ? (
                <>
                  {(groupOf(exercises, exMenuItem.key)?.items.length ?? 0) < MAX_SUPERSET && (
                    <SheetOption
                      onClick={() => {
                        setSsAnchor(exMenuItem.key);
                        setSsPre([]);
                        setExMenu(null);
                        setOverlay('superset');
                      }}
                      detail={<ChevronRight size={12} />}
                    >
                      Add to superset…
                    </SheetOption>
                  )}
                  <SheetOption
                    onClick={() => {
                      setExercises((l) => unlinkSuperset(l, exMenuItem.key));
                      setExMenu(null);
                    }}
                    detail={tags.get(exMenuItem.key)}
                  >
                    Unlink superset
                  </SheetOption>
                </>
              ) : (
                <SheetOption
                  onClick={() => {
                    setSsAnchor(exMenuItem.key);
                    setSsPre([]);
                    setExMenu(null);
                    setOverlay('superset');
                  }}
                  detail={<ChevronRight size={12} />}
                >
                  Superset with…
                </SheetOption>
              ))}
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
              Remove from routine
            </SheetOption>
          </>
        )}
      </Sheet>

      {(() => {
        const anchor = exercises.find((e) => e.key === ssAnchor);
        if (!anchor) return null;
        const group = groupOf(exercises, anchor.key);
        const inGroup = new Set((group?.items ?? [anchor]).map((x) => x.key));
        return (
          <SupersetSheet
            open={overlay === 'superset'}
            anchorName={exerciseOrMissing(exerciseMap, anchor.exerciseId).name}
            groupSize={inGroup.size}
            candidates={exercises
              .filter((e) => !inGroup.has(e.key) && exerciseOrMissing(exerciseMap, e.exerciseId).type !== 'cardio')
              .map((e) => ({
                key: e.key,
                name: exerciseOrMissing(exerciseMap, e.exerciseId).name,
                sub: ssPre.includes(e.key) ? 'just added' : tags.get(e.key) ? `in superset ${tags.get(e.key)![0]}` : 'in this routine',
              }))}
            preselect={ssPre}
            addLabel="adds it to the routine"
            onAddAnother={() => setOverlay('supersetAdd')}
            onClose={() => setOverlay(null)}
            onMake={(keys) => {
              setOverlay(null);
              setExercises((l) => linkSuperset(l, anchor.key, keys));
            }}
          />
        );
      })()}
      <ExercisePicker
        open={overlay === 'supersetAdd'}
        mode="single"
        title="Superset with…"
        excludeIds={exercises.map((e) => e.exerciseId)}
        onCancel={() => setOverlay('superset')}
        onPick={(exId) => {
          const key = uuid();
          setExercises((l) => [...l, { key, exerciseId: exId, sets: newSetsFor(exId) }]);
          setSsPre([key]);
          setOverlay('superset');
        }}
      />

      <HoldMenu open={!!setMenu} anchor={setMenu?.rect} items={setMenuItems} onClose={() => setSetMenu(null)} />

      <ExercisePicker
        open={overlay === 'add'}
        mode="multi"
        currentLabel="In this routine"
        current={exercises.map((e) => ({ exerciseId: e.exerciseId }))}
        onCancel={() => setOverlay(null)}
        onDone={({ keep, added }) => {
          setOverlay(null);
          setExercises((list) => [...list.filter((e) => keep.includes(e.exerciseId)), ...added.map((id) => ({ key: uuid(), exerciseId: id, sets: newSetsFor(id) }))]);
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
        message={initial ? `Your edits to ${initial.name} won't be saved.` : "This routine won't be saved."}
        onClose={() => setOverlay(null)}
        actions={[
          { label: 'Discard', kind: 'danger', onClick: leave },
          { label: 'Keep editing', kind: 'bold', onClick: () => setOverlay(null) },
        ]}
      />
    </div>
  );
}

function ExerciseSection({
  tag,
  draft,
  exercise,
  units,
  effort,
  editing,
  onEdit,
  onMenu,
  onAddSet,
  onToggleWarm,
  onDelete,
  onSetMenu,
}: {
  tag?: string;
  draft: DraftExercise;
  exercise: Exercise;
  units: 'lb' | 'kg';
  effort: EffortMode;
  editing: Editing | null;
  onEdit: (set: DraftSet, field: Field, ex: Exercise) => void;
  onMenu: () => void;
  onAddSet: () => void;
  onToggleWarm: (setKey: string) => void;
  onDelete: (setKey: string) => void;
  onSetMenu: (setKey: string, rect: DOMRect) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: draft.key });
  const labels = setLabels(draft.sets.map((s, i) => ({ id: s.key, order: i, kind: s.kind })));
  const showW = hasWeightColumn(exercise.type);
  const cols = showW ? 'grid-cols-[34px_1fr_1fr]' : 'grid-cols-[34px_1fr]';

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cx('relative border-b border-line bg-bg pt-3 pb-2.5', isDragging && 'z-10 rounded-[10px] opacity-90 shadow-[0_8px_24px_rgba(0,0,0,0.6)] outline-[1.5px] outline-accent')}
    >
      <div className="flex items-center gap-2">
        <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={`Reorder ${exercise.name}`} className="-ml-2.5 flex h-11 w-10 flex-none touch-none items-center justify-center text-fg3">
          <Handle />
        </button>
        {tag && <TagPill tag={tag} on />}
        <b className="min-w-0 flex-1 truncate text-[16px] font-semibold">
          {exercise.name}
          {TYPE_TAG[exercise.type] && <Tag>{TYPE_TAG[exercise.type]}</Tag>}
        </b>
        <button type="button" onClick={onMenu} aria-label={`${exercise.name} options`} className="-mr-2 flex h-11 w-11 items-center justify-center text-[14px] font-bold tracking-[1px] text-accent">
          •••
        </button>
      </div>
      {exercise.type === 'cardio' ? (
        <CardioRows draft={draft} exercise={exercise} units={units} onDelete={onDelete} onSetMenu={onSetMenu} />
      ) : draft.sets.length > 0 && (
        <div className="mt-0.5">
          <div className={cx('grid h-5 items-center gap-2 text-center text-[10.5px] font-bold tracking-[0.05em] text-fg2', cols)}>
            <span>SET</span>
            {showW && <span>{weightColumnLabel(exercise.type, unitColumn(units))}</span>}
            <span>REPS</span>
          </div>
          <div className="flex flex-col gap-[2px]">
            {draft.sets.map((s) => {
              const label = labels.get(s.key)!;
              const editW = editing?.setKey === s.key && editing.field === 'weight';
              const editR = editing?.setKey === s.key && editing.field === 'reps';
              const editE = editing?.setKey === s.key && editing.field === 'effort';
              // A4: the target as an outlined badge on the rep range; blue while picking it.
              const badge =
                effort === 'off' || s.kind !== 'working' ? null : editE ? (
                  <EffortBadge inset tone="active" text={s.rpeTarget != null ? effortBadge(s.rpeTarget, effort) : '+'} label="Picking the effort target" />
                ) : s.rpeTarget != null ? (
                  <EffortBadge inset tone="target" text={effortBadge(s.rpeTarget, effort)} label={`Target ${effortSpoken(s.rpeTarget, effort)}. Change it`} onPress={() => onEdit(s, 'effort', exercise)} />
                ) : null;
              const wText = editW ? weightEditDisplay(editing!.text, exercise) : s.weight === 'last' ? '' : weightCellText(s.weight, exercise, units);
              const rText = editR ? editing!.text : formatRepRange(s.repsMin, s.repsMax);
              return (
                <SwipeRow
                  key={s.key}
                  right={{ label: s.kind === 'warmup' ? 'Working set' : 'Warm-up', onTrigger: () => onToggleWarm(s.key) }}
                  left={{ label: 'Delete', onTrigger: () => onDelete(s.key) }}
                  onLongPress={(rect) => onSetMenu(s.key, rect)}
                >
                  <div className={cx('grid h-10 items-center gap-2', cols)}>
                    <button
                      type="button"
                      onClick={(e) => onSetMenu(s.key, (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect())}
                      aria-label={`Set ${label} options`}
                      className={cx('flex h-10 items-center justify-center text-[14px] font-bold', s.kind === 'warmup' && 'text-fg2')}
                    >
                      {label}
                    </button>
                    {showW && <BuilderCell text={wText} placeholder="last" editing={editW} onClick={() => onEdit(s, 'weight', exercise)} label={`Set ${label} weight`} />}
                    <BuilderCell text={rText} placeholder="—" editing={editR} onClick={() => onEdit(s, 'reps', exercise)} label={`Set ${label} reps`} badge={badge} />
                  </div>
                </SwipeRow>
              );
            })}
          </div>
        </div>
      )}
      <AddButton onClick={onAddSet} className="mt-2 w-full">
        {exercise.type === 'cardio' ? '+ Segment' : '+ Set'}
      </AddButton>
    </section>
  );
}

function BuilderCell({ text, placeholder, editing, onClick, label, badge }: { text: string; placeholder: string; editing: boolean; onClick: () => void; label: string; badge?: ReactNode }) {
  const cell = (
    <button type="button" aria-label={label} onClick={onClick} className="flex h-10 w-full items-center">
      <span
        className={cx(
          'flex h-[32px] w-full items-center justify-center rounded-[8px] text-[16px] font-semibold',
          editing ? 'border-2 border-accent bg-edit' : 'bg-surface-2',
        )}
      >
        {text ? <span>{text}</span> : !editing && <span className="text-[14px] font-medium text-fg3">{placeholder}</span>}
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

/** Cardio in a routine is just how many segments; the numbers always come from last time. */
function CardioRows({
  draft,
  exercise,
  units,
  onDelete,
  onSetMenu,
}: {
  draft: DraftExercise;
  exercise: Exercise;
  units: 'lb' | 'kg';
  onDelete: (setKey: string) => void;
  onSetMenu: (setKey: string, rect: DOMRect) => void;
}) {
  return (
    <div className="mt-0.5">
      <div className="grid h-5 grid-cols-[34px_1fr] items-center gap-2 text-center text-[10.5px] font-bold tracking-[0.05em] text-fg2">
        <span>#</span>
        <span className="uppercase">{columnsLabel(exercise, units)}</span>
      </div>
      <div className="flex flex-col gap-[2px]">
        {draft.sets.map((s, i) => (
          <SwipeRow key={s.key} left={{ label: 'Delete', onTrigger: () => onDelete(s.key) }} onLongPress={(rect) => onSetMenu(s.key, rect)}>
            <div className="grid h-10 grid-cols-[34px_1fr] items-center gap-2">
              <button
                type="button"
                onClick={(e) => onSetMenu(s.key, (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect())}
                aria-label={`Segment ${i + 1} options`}
                className="flex h-10 items-center justify-center text-[14px] font-bold"
              >
                {i + 1}
              </button>
              <span className="flex h-[32px] items-center justify-center rounded-[8px] bg-surface-2 text-[14px] font-medium text-fg3">from last time</span>
            </div>
          </SwipeRow>
        ))}
      </div>
    </div>
  );
}
