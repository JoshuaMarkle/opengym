import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useLongPress } from '../../components/gestures';
import { ChevronRight, Handle } from '../../components/icons';
import { Alert, Sheet, SheetOption, useToast } from '../../components/overlays';
import { BarButton, cx, EmptyState, LabelAction, LargeHeader, Pill, Screen, Segmented } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { importRoutinesFromBackup, readBackup } from '../../data/backup';
import { deleteRoutine, saveLayout } from '../../data/routines';
import { usePlanView } from '../../data/schedule';
import { usePlans, type PlansData } from '../../data/usePlans';
import type { Folder, Routine } from '../../db/types';
import { useStartWorkout } from '../../hooks/StartWorkout';
import { dayKey, startOfWeek } from '../../lib/dates';
import { addDayKey, currentVersion, describeWhen, type PlanDay } from '../../lib/schedule';
import { DaySheet, PlanGrid, PlanStrip } from './PlanParts';
import { PlanHistoryCalendar } from './PlanHistoryCalendar';
import { FolderSheet, NewFolderSheet, useRoutineActions } from './RoutineActions';

const COLLAPSE_KEY = 'og-collapsed-folders';
const VIEW_KEY = 'og-plans-view';

type PlansTab = 'calendar' | 'routines';

function loadTab(): PlansTab {
  try {
    return localStorage.getItem(VIEW_KEY) === 'routines' ? 'routines' : 'calendar';
  } catch {
    return 'calendar';
  }
}

function loadCollapsed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(COLLAPSE_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

/** 2.1 Plans: folders of routines. Active folder first, archived collapsed at the bottom. */
export function Plans() {
  const plans = usePlans();
  const navigate = useNavigate();
  const start = useStartWorkout();
  const toast = useToast();
  const actions = useRoutineActions(plans);
  const [editing, setEditing] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [newFolder, setNewFolder] = useState(false);
  const [folderSheet, setFolderSheet] = useState<Folder | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsed);
  const [tab, setTabState] = useState<PlansTab>(loadTab);
  const setTab = (t: PlansTab) => {
    setTabState(t);
    try {
      localStorage.setItem(VIEW_KEY, t);
    } catch {
      /* ignore */
    }
  };
  const fileRef = useRef<HTMLInputElement>(null);

  const toggle = (id: string) =>
    setCollapsed((c) => {
      const n = new Set(c);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      try {
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...n]));
      } catch {
        /* ignore */
      }
      return n;
    });

  const importFile = async (file: File) => {
    try {
      const backup = await readBackup(file);
      const n = await importRoutinesFromBackup(backup);
      toast({ message: n ? `Imported ${n} ${n === 1 ? 'routine' : 'routines'}` : 'No new routines in that backup' });
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : "Couldn't read that file" });
    }
  };

  const activeFolder = plans?.activeFolder;
  const empty = plans && !plans.routines.length && !plans.folders.length;

  return (
    <Screen
      header={
        <LargeHeader
          title="Plans"
          right={
            editing ? (
              <BarButton kind="bold" onClick={() => setEditing(false)}>
                Done
              </BarButton>
            ) : (
              <>
                {!empty && tab === 'routines' && <BarButton onClick={() => setEditing(true)}>Edit</BarButton>}
                <BarButton aria-label="New" className="text-[30px] leading-none font-normal" onClick={() => setPlusOpen(true)}>
                  +
                </BarButton>
              </>
            )
          }
        />
      }
    >
      {!plans ? null : empty ? (
        <div className="pt-16">
          <EmptyState icon="+" title="No routines yet">
            A routine is a list of exercises with their sets. Build one once, start it in one tap.
          </EmptyState>
          <div className="mx-auto mt-6 max-w-[300px]">
            <button type="button" onClick={() => navigate('/routine/new')} className="h-[50px] w-full rounded-[13px] bg-accent text-[17px] font-bold text-white">
              Create a routine
            </button>
          </div>
        </div>
      ) : editing ? (
        <EditLayout plans={plans} onFolderMenu={setFolderSheet} onNewFolder={() => setNewFolder(true)} />
      ) : (
        <>
          {/* 2.23 (prototype): plan + history on one calendar. */}
          <Segmented
            className="mt-1"
            options={[
              { value: 'calendar' as const, label: 'Calendar' },
              { value: 'routines' as const, label: 'Routines' },
            ]}
            value={tab}
            onChange={setTab}
          />
          {tab === 'calendar' ? (
            <PlanHistoryCalendar folder={activeFolder} />
          ) : (
            <ViewLayout plans={plans} collapsed={collapsed} onToggle={toggle} onHold={actions.openMenu} onFolderMenu={setFolderSheet} />
          )}
        </>
      )}

      {/* 2.2 */}
      <Sheet open={plusOpen} onClose={() => setPlusOpen(false)} title="New">
        <SheetOption
          onClick={() => {
            setPlusOpen(false);
            navigate('/routine/new');
          }}
          tone="accent"
          detail={activeFolder ? `in ${activeFolder.name}` : undefined}
        >
          New routine
        </SheetOption>
        <SheetOption
          onClick={() => {
            setPlusOpen(false);
            setNewFolder(true);
          }}
        >
          New folder
        </SheetOption>
        <SheetOption
          onClick={() => {
            setPlusOpen(false);
            start.startBlank();
          }}
        >
          Start a blank workout
        </SheetOption>
        <SheetOption
          onClick={() => {
            setPlusOpen(false);
            fileRef.current?.click();
          }}
          detail="from an OpenGym backup"
        >
          Import routines
        </SheetOption>
      </Sheet>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void importFile(f);
        }}
      />
      <NewFolderSheet open={newFolder} onClose={() => setNewFolder(false)} />
      <FolderSheet folder={folderSheet ? (plans?.folders.find((f) => f.id === folderSheet.id) ?? null) : null} count={folderSheet ? (plans?.byFolder.get(folderSheet.id)?.length ?? 0) : 0} onClose={() => setFolderSheet(null)} />
      {actions.element}
    </Screen>
  );
}

// ───────────────────────────── view mode

function ViewLayout({
  plans,
  collapsed,
  onToggle,
  onHold,
  onFolderMenu,
}: {
  plans: PlansData;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onHold: (r: Routine, rect: DOMRect) => void;
  onFolderMenu: (f: Folder) => void;
}) {
  const open = plans.folders.filter((f) => !f.archived);
  const ordered = [...open.filter((f) => f.active), ...open.filter((f) => !f.active)];
  const archived = plans.folders.filter((f) => f.archived);
  const unfiled = plans.byFolder.get('') ?? [];

  const active = ordered.find((f) => f.active);
  return (
    <div>
      {active && <ActiveCalendar folder={active} />}
      {ordered.map((f) => (
        <FolderGroup key={f.id} plans={plans} folder={f} collapsed={collapsed.has(f.id)} onToggle={() => onToggle(f.id)} onHold={onHold} onFolderMenu={() => onFolderMenu(f)} />
      ))}
      {unfiled.length > 0 && (
        <>
          <FolderHeader title="No folder" count={unfiled.length} collapsed={collapsed.has('none')} onToggle={() => onToggle('none')} />
          {!collapsed.has('none') && unfiled.map((r) => <RoutineRow key={r.id} plans={plans} routine={r} onHold={onHold} />)}
        </>
      )}
      {archived.map((f) => {
        const list = plans.byFolder.get(f.id) ?? [];
        const isOpen = collapsed.has(`a:${f.id}`);
        return (
          <div key={f.id} className={cx(!isOpen && 'opacity-60')}>
            <FolderHeader
              title={
                <>
                  ARCHIVED <small className="ml-1 font-semibold tracking-normal text-fg2 normal-case">{`${f.name} · ${list.length}`}</small>
                </>
              }
              collapsed={!isOpen}
              onToggle={() => onToggle(`a:${f.id}`)}
              onHold={() => onFolderMenu(f)}
            />
            {isOpen && list.map((r) => <RoutineRow key={r.id} plans={plans} routine={r} onHold={onHold} />)}
          </div>
        );
      })}
      {!plans.routines.length && <p className="mt-6 text-center text-[14px] text-fg2">No routines yet. Tap + to make one.</p>}
      <p className="mt-6 text-center text-[12.5px] text-fg3">Tap a folder name to open it as a plan with a schedule. Hold a routine for shortcuts. Edit to reorder or move.</p>
    </div>
  );
}

/**
 * 2.1: the active plan's last week, this week and two ahead, with status, above its folder.
 * Tap a day from today on to change just that day (2.21); the folder name opens the plan.
 */
function ActiveCalendar({ folder }: { folder: Folder }) {
  const { settings } = useData();
  const weekFrom = dayKey(startOfWeek(Date.now(), settings.weekStart));
  const view = usePlanView(folder, addDayKey(weekFrom, -7), addDayKey(weekFrom, 20));
  const [sheetDay, setSheetDay] = useState<PlanDay | null>(null);
  if (!view?.scheduled) return null;
  return (
    <div className="mt-3">
      <PlanGrid days={view.days} codes={view.codes} today={view.today} weekStart={settings.weekStart} onOpen={(d) => d.key >= view.today && d.state !== 'off' && setSheetDay(d)} />
      {sheetDay && <DaySheet folder={folder} day={sheetDay} view={view} onClose={() => setSheetDay(null)} />}
    </div>
  );
}

function FolderGroup({
  plans,
  folder,
  collapsed,
  onToggle,
  onHold,
  onFolderMenu,
}: {
  plans: PlansData;
  folder: Folder;
  collapsed: boolean;
  onToggle: () => void;
  onHold: (r: Routine, rect: DOMRect) => void;
  onFolderMenu: () => void;
}) {
  const navigate = useNavigate();
  const { settings } = useData();
  const weekFrom = dayKey(startOfWeek(Date.now(), settings.weekStart));
  const view = usePlanView(folder, weekFrom, addDayKey(weekFrom, 6));
  const list = plans.byFolder.get(folder.id) ?? [];
  const scheduled = !!view?.scheduled;
  const version = scheduled ? currentVersion(folder.schedule, view!.today) : undefined;
  const openPlan = () => navigate(`/plan/${folder.id}`);
  return (
    <div>
      <FolderHeader title={folder.name} count={list.length} active={folder.active} collapsed={collapsed} onToggle={onToggle} onOpen={openPlan} onHold={onFolderMenu} />
      {!collapsed && scheduled && view && !folder.active && (
        <div className="border-b border-line pt-3 pb-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-[0.07em] text-fg2 uppercase">Schedule · {version?.kind === 'cycle' ? 'Cycle' : 'Weekly'}</span>
            <LabelAction onClick={openPlan}>Edit plan ›</LabelAction>
          </div>
          <PlanStrip days={view.days} codes={view.codes} today={view.today} dense onTap={openPlan} />
        </div>
      )}
      {!collapsed &&
        list.map((r) => (
          <RoutineRow key={r.id} plans={plans} routine={r} onHold={onHold} when={scheduled ? (describeWhen(version, r.id, settings.weekStart) ?? 'Not scheduled') : undefined} />
        ))}
      {!collapsed && !list.length && <p className="border-b border-line py-3 text-[13px] text-fg2">Empty folder.</p>}
    </div>
  );
}

function FolderHeader({
  title,
  count,
  active,
  collapsed,
  onToggle,
  onOpen,
  onHold,
}: {
  title: ReactNode;
  count?: number;
  active?: boolean;
  collapsed: boolean;
  onToggle: () => void;
  /** Tapping the name opens the folder as a plan (2.15); the chevron still folds it. */
  onOpen?: () => void;
  onHold?: () => void;
}) {
  const hold = useLongPress(() => onHold?.(), !!onHold);
  // Centered on the name's caps (measured in 2.14). A down chevron's ink sits low in its box, so lift it.
  const chevron = <span className={cx('inline-block h-[7px] w-[7px] flex-none border-r-2 border-b-2 border-fg2 transition-transform', collapsed ? '-translate-x-[1px] -translate-y-[1px] -rotate-45' : '-translate-y-[3px] rotate-45')} />;
  const label = (
    <span className="flex min-w-0 items-center gap-2 text-[12.5px] font-bold tracking-[0.05em] text-fg/80 uppercase">
      <span className="truncate">{title}</span>
      {count !== undefined && <small className="font-semibold tracking-normal text-fg2">{count}</small>}
    </span>
  );
  if (!onOpen)
    return (
      <button type="button" onClick={onToggle} {...hold} aria-expanded={!collapsed} className="no-select mt-4 flex h-11 w-full items-center justify-between border-b border-line text-left">
        <span className="flex min-w-0 items-center gap-2">
          {chevron}
          {label}
        </span>
        {active && <Pill tone="accent">active</Pill>}
      </button>
    );
  return (
    <div className="mt-4 flex h-11 w-full items-center border-b border-line">
      <button type="button" onClick={onToggle} aria-expanded={!collapsed} aria-label={collapsed ? 'Expand' : 'Collapse'} className="flex h-11 w-[22px] flex-none items-center justify-start">
        {chevron}
      </button>
      <button type="button" onClick={onOpen} {...hold} className="no-select flex h-11 min-w-0 flex-1 items-center justify-between text-left active:opacity-70">
        {label}
        {active && <Pill tone="accent">active</Pill>}
      </button>
    </div>
  );
}

function RoutineRow({ plans, routine, onHold, when }: { plans: PlansData; routine: Routine; onHold: (r: Routine, rect: DOMRect) => void; when?: string }) {
  const navigate = useNavigate();
  const { exerciseMap } = useData();
  const names = (plans.exercisesByRoutine.get(routine.id) ?? []).map((id) => exerciseMap.get(id)?.name ?? 'Unknown');
  const hold = useLongPress((rect) => onHold(routine, rect));
  return (
    <button type="button" {...hold} onClick={() => navigate(`/routine/${routine.id}`)} className="no-select flex min-h-[58px] w-full items-center gap-3 border-b border-line text-left active:bg-surface/60">
      <span className="min-w-0 flex-1 py-2">
        <b className="block truncate text-[16px] font-semibold">{routine.name}</b>
        <span className="block truncate text-[13px] text-fg2">
          {when && `${when} · `}
          {names.length ? names.join(', ') : 'No exercises yet'}
        </span>
      </span>
      <ChevronRight size={13} className="flex-none text-fg3" />
    </button>
  );
}

// ───────────────────────────── edit mode (2.7)

type Item = { id: string; kind: 'folder'; folder: Folder } | { id: string; kind: 'none' } | { id: string; kind: 'routine'; routine: Routine };

function buildItems(plans: PlansData): Item[] {
  const out: Item[] = [];
  for (const f of plans.folders) {
    out.push({ id: `f:${f.id}`, kind: 'folder', folder: f });
    for (const r of plans.byFolder.get(f.id) ?? []) out.push({ id: `r:${r.id}`, kind: 'routine', routine: r });
  }
  out.push({ id: 'f:none', kind: 'none' });
  for (const r of plans.byFolder.get('') ?? []) out.push({ id: `r:${r.id}`, kind: 'routine', routine: r });
  return out;
}

/** Split a flat list back into groups, each header followed by its routines. */
function groups(items: Item[]) {
  const out: { header: Item; routines: Item[] }[] = [];
  for (const it of items) {
    if (it.kind === 'routine') {
      if (!out.length) out.push({ header: items.find((x) => x.kind !== 'routine')!, routines: [] });
      out[out.length - 1].routines.push(it);
    } else out.push({ header: it, routines: [] });
  }
  return out;
}

function EditLayout({ plans, onFolderMenu, onNewFolder }: { plans: PlansData; onFolderMenu: (f: Folder) => void; onNewFolder: () => void }) {
  const [items, setItems] = useState<Item[]>(() => buildItems(plans));
  const [dragging, setDragging] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Routine | null>(null);
  const toast = useToast();

  // Pick up outside changes (new folder, rename, delete) when not dragging.
  const signature = useMemo(() => buildItems(plans).map((i) => i.id + (i.kind === 'folder' ? i.folder.name + i.folder.archived : '')).join('|'), [plans]);
  useEffect(() => {
    if (!dragging) setItems(buildItems(plans));
  }, [signature]); // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const persist = (next: Item[]) => {
    const g = groups(next);
    const folderOrder = g.filter((x) => x.header.kind === 'folder').map((x) => (x.header as Extract<Item, { kind: 'folder' }>).folder.id);
    const placement = g.map((x) => ({
      folderId: x.header.kind === 'folder' ? x.header.folder.id : undefined,
      routineIds: x.routines.map((r) => (r as Extract<Item, { kind: 'routine' }>).routine.id),
    }));
    void saveLayout(folderOrder, placement);
  };

  const onDragStart = (e: DragStartEvent) => setDragging(String(e.active.id));

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    let to = items.findIndex((i) => i.id === over.id);
    if (from < 0 || to < 0) return;
    const moved = items[from];
    let next: Item[];
    if (moved.kind === 'folder') {
      // Folders move with their routines; "No folder" stays last.
      const g = groups(items);
      const folderGroups = g.filter((x) => x.header.kind === 'folder');
      const none = g.find((x) => x.header.kind === 'none')!;
      const order = arrayMove(items, from, to).filter((i) => i.kind === 'folder');
      next = [...order.flatMap((h) => [h, ...folderGroups.find((x) => x.header.id === h.id)!.routines]), none.header, ...none.routines];
    } else {
      if (to === 0) to = 1;
      next = arrayMove(items, from, to);
    }
    setItems(next);
    persist(next);
  };

  const ids = items.map((i) => i.id);
  const draggingItem = items.find((i) => i.id === dragging);
  // While dragging a folder, hide routines so groups are easy to reorder.
  const visible = draggingItem?.kind === 'folder' ? items.filter((i) => i.kind !== 'routine') : items;

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <SortableContext items={visible.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {visible.map((it) => (
            <SortableItem key={it.id} item={it} onFolderMenu={onFolderMenu} onDelete={setDeleting} />
          ))}
        </SortableContext>
        <DragOverlay>{draggingItem ? <ItemView item={draggingItem} overlay /> : null}</DragOverlay>
      </DndContext>
      {ids.length <= 1 && <p className="py-4 text-[13px] text-fg2">Nothing to arrange yet.</p>}
      <button type="button" onClick={onNewFolder} className="mt-2 flex h-12 w-full items-center gap-2.5 border-b border-line text-[16px] font-semibold text-accent">
        <span className="flex h-[24px] w-[24px] items-center justify-center rounded-full bg-accent text-[17px] text-white">+</span>
        New folder
      </button>
      <p className="mt-4 text-[12.5px] leading-normal text-fg2">Drag ≡ to reorder routines or move them between folders. Drag a folder to reorder folders. − deletes a routine; its workouts stay in History.</p>
      <Alert
        open={!!deleting}
        title={`Delete ${deleting?.name ?? 'routine'}?`}
        message="Its workouts stay in History."
        onClose={() => setDeleting(null)}
        actions={[
          {
            label: 'Delete routine',
            kind: 'danger',
            onClick: async () => {
              const r = deleting;
              setDeleting(null);
              if (r) {
                await deleteRoutine(r.id);
                toast({ message: `${r.name} deleted` });
              }
            },
          },
          { label: 'Cancel', onClick: () => setDeleting(null) },
        ]}
      />
    </div>
  );
}

function SortableItem({ item, onFolderMenu, onDelete }: { item: Item; onFolderMenu: (f: Folder) => void; onDelete: (r: Routine) => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: item.kind === 'none' });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={cx(isDragging && 'opacity-30')}>
      <ItemView item={item} handleRef={setActivatorNodeRef} handleProps={{ ...attributes, ...listeners }} onFolderMenu={onFolderMenu} onDelete={onDelete} />
    </div>
  );
}

function ItemView({
  item,
  overlay,
  handleRef,
  handleProps,
  onFolderMenu,
  onDelete,
}: {
  item: Item;
  overlay?: boolean;
  handleRef?: (el: HTMLElement | null) => void;
  handleProps?: Record<string, unknown>;
  onFolderMenu?: (f: Folder) => void;
  onDelete?: (r: Routine) => void;
}) {
  const handle = (label: string) => (
    <button type="button" ref={handleRef} {...handleProps} aria-label={label} className="-m-2 flex h-11 w-11 flex-none touch-none items-center justify-center text-fg3">
      <Handle />
    </button>
  );
  if (item.kind === 'none')
    return (
      <div className="mt-4 flex h-10 items-end border-b border-line pb-2 text-[12.5px] font-bold tracking-[0.05em] text-fg2 uppercase">
        No folder
      </div>
    );
  if (item.kind === 'folder')
    return (
      <div className={cx('mt-4 flex h-11 items-center gap-2 border-b border-line', overlay && 'rounded-[10px] bg-surface px-3 outline-[1.5px] outline-accent', item.folder.archived && !overlay && 'opacity-60')}>
        {handle(`Reorder ${item.folder.name}`)}
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold tracking-[0.05em] text-fg/80 uppercase">
          {item.folder.name}
          {item.folder.archived && <small className="ml-1.5 font-semibold tracking-normal text-fg2 normal-case">archived</small>}
        </span>
        {onFolderMenu && (
          <button type="button" onClick={() => onFolderMenu(item.folder)} aria-label={`${item.folder.name} options`} className="-mr-2 flex h-11 w-11 items-center justify-center text-[14px] font-bold tracking-[1px] text-accent">
            •••
          </button>
        )}
      </div>
    );
  return (
    <div className={cx('flex h-[54px] items-center gap-3 border-b border-line bg-bg', overlay && 'rounded-[10px] border-transparent bg-surface px-3 outline-[1.5px] outline-accent')}>
      <button type="button" aria-label={`Delete ${item.routine.name}`} onClick={() => onDelete?.(item.routine)} className="-ml-2 flex h-11 w-11 flex-none items-center justify-center">
        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-danger">
          <i className="block h-[2px] w-[10px] rounded-full bg-white" />
        </span>
      </button>
      <b className="min-w-0 flex-1 truncate text-[16px] font-semibold">{item.routine.name}</b>
      {handle(`Move ${item.routine.name}`)}
    </div>
  );
}
