import { closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useLongPress } from '../../components/gestures';
import { CalendarIcon, ChevronRight, ClipboardIcon, ListIcon, PlusGlyph } from '../../components/icons';
import { Alert, Sheet, SheetOption, useToast } from '../../components/overlays';
import { AddRow, Badge, BarButton, Button, cx, DeleteDisc, DragHandle, EditRow, EmptyState, FolderChevron, FolderLabel, FolderMenuButton, IconSegmented, LargeHeader, RowText, Screen } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { deleteRoutine, saveLayout } from '../../data/routines';
import { usePlanView } from '../../data/schedule';
import { usePlans, type PlansData } from '../../data/usePlans';
import type { Folder, Routine } from '../../db/types';
import { dayKey, startOfWeek } from '../../lib/dates';
import { addDayKey, currentVersion, describeWhen } from '../../lib/schedule';
import { CalendarView, ListView } from '../history/History';
import { ScheduleWeek } from './PlanParts';
import { PlanHistoryCalendar } from './PlanHistoryCalendar';
import { FolderSheet, NewFolderSheet, useRoutineActions } from './RoutineActions';

/** 2.1 Plans: folders of routines. Active folder first, archived collapsed at the bottom. */
export function Plans() {
  const plans = usePlans();
  const navigate = useNavigate();
  const actions = useRoutineActions(plans);
  const [editing, setEditing] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [newFolder, setNewFolder] = useState(false);
  const [folderSheet, setFolderSheet] = useState<Folder | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [params, setParams] = useSearchParams();
  const tab = params.get('view') === 'routines' ? 'routines' : params.get('view') === 'history' ? 'history' : 'calendar';
  const setTab = (view: string) => {
    setEditing(false);
    setParams(view === 'calendar' ? {} : { view }, { replace: true });
  };

  const toggle = (id: string) =>
    setCollapsed((c) => {
      const n = new Set(c);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const activeFolder = plans?.activeFolder;
  const empty = plans && !plans.routines.length && !plans.folders.length;

  return (
    <Screen
      header={
        <LargeHeader
          title={tab === 'calendar' ? 'Calendar' : tab === 'history' ? 'History' : 'Routines'}
          subtitle={
            activeFolder && (
              <>
                {activeFolder.name} ·{' '}
                {currentVersion(activeFolder.schedule, dayKey(Date.now()))?.kind === 'weekly'
                  ? 'Weekly split'
                  : currentVersion(activeFolder.schedule, dayKey(Date.now()))?.kind === 'cycle'
                    ? 'Repeating cycle'
                    : 'Rotation'}{' '}
                <button type="button" onClick={() => navigate(`/plan/${activeFolder.id}`)} className="-my-3 inline-flex min-h-11 items-center gap-1 text-accent">
                  · Plan <ChevronRight size={10} />
                </button>
              </>
            )
          }
          right={
            editing ? (
              <BarButton kind="bold" onClick={() => setEditing(false)}>
                Done
              </BarButton>
            ) : (
              <>
                {/* PH3.2–PH3.5: Calendar, Routines, History in that order. */}
                <IconSegmented
                  label="Calendar views"
                  value={tab}
                  onChange={setTab}
                  options={[
                    { value: 'calendar', ariaLabel: 'Calendar', label: <CalendarIcon size={16} /> },
                    { value: 'routines', ariaLabel: 'Routines', label: <ClipboardIcon size={18} /> },
                    { value: 'history', ariaLabel: 'History', label: <ListIcon size={16} /> },
                  ]}
                />
              </>
            )
          }
        />
      }
    >
      {!plans ? null : empty && tab === 'routines' ? (
        <div className="pt-16">
          <EmptyState icon={<PlusGlyph size={20} />} title="No routines yet">
            A routine is a list of exercises with their sets. Build one once, start it in one tap.
          </EmptyState>
          <div className="mx-auto mt-6 max-w-[300px]">
            <Button onClick={() => navigate('/routine/new')}>Create a routine</Button>
          </div>
        </div>
      ) : editing ? (
        <EditLayout plans={plans} onFolderMenu={setFolderSheet} onNewFolder={() => setNewFolder(true)} />
      ) : (
        <>
          {tab === 'routines' && (
            <div className="flex min-h-11 items-center justify-between">
              <span className="text-caps text-fg2">Your library</span>
              <div className="flex">
                <BarButton onClick={() => setEditing(true)}>Edit</BarButton>
                <BarButton aria-label="New" className="font-normal" onClick={() => setPlusOpen(true)}>
                  <span className="translate-y-px text-title1 leading-none font-normal">+</span>
                </BarButton>
              </div>
            </div>
          )}
          {/* PH3.2–PH3.5: one destination, preserving LargeHeader spacing. */}
          {tab === 'calendar' ? (
            <CalendarView monthContent={(month, setMonth) => <PlanHistoryCalendar folder={activeFolder} month={month} onMonthChange={setMonth} />} />
          ) : tab === 'history' ? (
            <ListView />
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
          detail={activeFolder ? `in ${activeFolder.name}` : undefined}
        >
          Add workout
        </SheetOption>
        <SheetOption
          onClick={() => {
            setPlusOpen(false);
            setNewFolder(true);
          }}
        >
          Add routine
        </SheetOption>
      </Sheet>
      <NewFolderSheet open={newFolder} onClose={() => setNewFolder(false)} />
      <FolderSheet
        folder={folderSheet ? (plans?.folders.find((f) => f.id === folderSheet.id) ?? null) : null}
        count={folderSheet ? (plans?.byFolder.get(folderSheet.id)?.length ?? 0) : 0}
        onClose={() => setFolderSheet(null)}
      />
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

  return (
    <div>
      {ordered.map((f) => (
        <FolderGroup key={f.id} plans={plans} folder={f} collapsed={f.active ? collapsed.has(f.id) : !collapsed.has(`i:${f.id}`)} onToggle={() => onToggle(f.active ? f.id : `i:${f.id}`)} onHold={onHold} onFolderMenu={() => onFolderMenu(f)} />
      ))}
      {unfiled.length > 0 && (
        <>
          <FolderHeader title="No folder" count={unfiled.length} collapsed={!collapsed.has('none')} onToggle={() => onToggle('none')} />
          {collapsed.has('none') && unfiled.map((r) => <RoutineRow key={r.id} plans={plans} routine={r} onHold={onHold} />)}
        </>
      )}
      {archived.map((f) => {
        const list = plans.byFolder.get(f.id) ?? [];
        const isOpen = collapsed.has(`a:${f.id}`);
        return (
          <div key={f.id} className={cx(!isOpen && 'opacity-60')}>
            <FolderHeader
              title="Archived"
              note={`${f.name} · ${list.length}`}
              collapsed={!isOpen}
              onToggle={() => onToggle(`a:${f.id}`)}
              onHold={() => onFolderMenu(f)}
            />
            {isOpen && list.map((r) => <RoutineRow key={r.id} plans={plans} routine={r} onHold={onHold} />)}
          </div>
        );
      })}
      {!plans.routines.length && <p className="mt-6 text-center text-callout text-fg2">No routines yet. Tap + to make one.</p>}
      <p className="mt-6 text-center text-caption text-fg3">Tap a folder name to open it as a plan with a schedule. Hold a routine for shortcuts. Edit to reorder or move.</p>
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
      {/* PH3.5: the same base-split strip as the routine detail page (2.15). */}
      {!collapsed && scheduled && view && version && (
        <ScheduleWeek days={view.days} version={version} codes={view.codes} onOpen={openPlan} className="py-5" />
      )}
      {!collapsed &&
        list.map((r) => <RoutineRow key={r.id} plans={plans} routine={r} onHold={onHold} when={scheduled ? (describeWhen(version, r.id, settings.weekStart) ?? 'Not scheduled') : undefined} />)}
      {!collapsed && !list.length && <p className="border-b border-line py-3 pl-6 text-footnote text-fg2">Empty folder.</p>}
    </div>
  );
}

/** design §6 Folder row: h52, chevron, Caps label (white when open) and count; tap the name to open the folder as a plan (2.15). */
function FolderHeader({
  title,
  note,
  count,
  active,
  collapsed,
  onToggle,
  onOpen,
  onHold,
}: {
  title: ReactNode;
  note?: string;
  count?: number;
  active?: boolean;
  collapsed: boolean;
  onToggle: () => void;
  /** Tapping the name opens the folder as a plan (2.15); the chevron still folds it. */
  onOpen?: () => void;
  onHold?: () => void;
}) {
  const hold = useLongPress(() => onHold?.(), !!onHold);
  const label = <FolderLabel label={title} count={count} open={!collapsed} note={note} />;
  const badge = active && <Badge variant="next">active</Badge>;
  if (!onOpen)
    return (
      <button type="button" onClick={onToggle} {...hold} aria-expanded={!collapsed} className="no-select mt-2 flex h-13 w-full items-center gap-2 border-b border-line text-left">
        <FolderChevron open={!collapsed} />
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
          {label}
          {badge}
        </span>
      </button>
    );
  return (
    <div className="mt-2 flex h-13 w-full items-center gap-2 border-b border-line">
      <button type="button" onClick={onToggle} aria-expanded={!collapsed} aria-label={collapsed ? 'Expand' : 'Collapse'} className="-ml-3.5 flex h-11 w-11 flex-none items-center justify-end pr-0.5">
        <FolderChevron open={!collapsed} />
      </button>
      <button type="button" onClick={onOpen} {...hold} className="no-select flex h-11 min-w-0 flex-1 items-center justify-between gap-2 text-left active:opacity-70">
        {label}
        {badge}
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
    <button
      type="button"
      {...hold}
      onClick={() => navigate(`/routine/${routine.id}`)}
      className="no-select flex min-h-13 w-full items-center gap-3 border-b border-line py-2 pl-6 text-left active:bg-surface/60"
    >
      <RowText dense title={routine.name} subtitle={`${when ? `${when} · ` : ''}${names.length ? names.join(', ') : 'No exercises yet'}`} />
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
  const signature = useMemo(
    () =>
      buildItems(plans)
        .map((i) => i.id + (i.kind === 'folder' ? i.folder.name + i.folder.archived : ''))
        .join('|'),
    [plans],
  );
  useEffect(() => {
    if (!dragging) setItems(buildItems(plans));
  }, [signature]); // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

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
      {ids.length <= 1 && <p className="py-4 text-footnote text-fg2">Nothing to arrange yet.</p>}
      <AddRow onClick={onNewFolder} className="mt-2">
        Add routine
      </AddRow>
      <p className="mt-4 text-caption text-fg2">
        Drag a handle to reorder routines or move them between folders. Drag a folder to reorder folders. − deletes a routine; its workouts stay in History.
      </p>
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

/** design §6 Edit mode (2.7): folders lead with the handle; routines get the delete disc in front and the handle at the end. */
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
  if (item.kind === 'none')
    return (
      <div className="mt-2 flex h-13 items-center border-b border-line">
        <FolderLabel label="No folder" open={false} />
      </div>
    );
  if (item.kind === 'folder')
    return (
      <div className={cx('mt-2 flex h-13 items-center gap-2 border-b border-line', overlay && 'rounded-md border-transparent bg-surface px-3 shadow-[0_8px_20px_rgba(0,0,0,0.6)] ring-[1.5px] ring-accent', item.folder.archived && !overlay && 'opacity-60')}>
        <DragHandle label={`Reorder ${item.folder.name}`} handleRef={handleRef} {...handleProps} className="-ml-3" />
        <span className="flex min-w-0 flex-1">
          <FolderLabel label={item.folder.name} open={false} note={item.folder.archived ? 'archived' : undefined} />
        </span>
        {onFolderMenu && <FolderMenuButton onClick={() => onFolderMenu(item.folder)} label={`${item.folder.name} options`} />}
      </div>
    );
  return (
    <EditRow lifted={overlay} leading={<DeleteDisc label={`Delete ${item.routine.name}`} onClick={() => onDelete?.(item.routine)} />} trailing={<DragHandle label={`Move ${item.routine.name}`} handleRef={handleRef} {...handleProps} />}>
      {item.routine.name}
    </EditRow>
  );
}
