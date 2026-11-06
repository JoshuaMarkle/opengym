import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Handle } from '../../components/icons';
import { BarButton, Check, cx, Screen, SearchField, TopBar } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { updateSettings } from '../../data/settings';
import type { Exercise } from '../../db/types';
import { usePinned } from './Progress';

/** 7.5: which lifts Progress shows, and in what order. */
export function PinnedLifts() {
  const navigate = useNavigate();
  const { exercises, history } = useData();
  const pinned = usePinned();
  const [query, setQuery] = useState('');
  const pinnedIds = pinned.map((e) => e.id);
  const sessions = (id: string) => history.sessionsByExercise.get(id)?.length ?? 0;

  const others = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises
      .filter((e) => !pinnedIds.includes(e.id) && (q ? e.name.toLowerCase().includes(q) : sessions(e.id) > 0))
      .sort((a, b) => sessions(b.id) - sessions(a.id) || a.name.localeCompare(b.name));
  }, [exercises, pinnedIds.join(','), query, history]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (ids: string[]) => void updateSettings({ pinnedExerciseIds: ids, pinnedCustomized: true });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    save(arrayMove(pinnedIds, pinnedIds.indexOf(String(active.id)), pinnedIds.indexOf(String(over.id))));
  };

  return (
    <Screen
      header={
        <TopBar
          title="Pinned lifts"
          right={
            <BarButton kind="bold" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/progress'))}>
              Done
            </BarButton>
          }
        />
      }
    >
      <div className="mt-4 flex justify-between pb-1 text-[11px] font-bold tracking-[0.06em] text-fg2 uppercase">
        <span>Pinned · drag to order</span>
        <span className="font-semibold tracking-normal">{pinned.length}</span>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={pinnedIds} strategy={verticalListSortingStrategy}>
          {pinned.map((e) => (
            <PinnedRow key={e.id} exercise={e} sessions={sessions(e.id)} onToggle={() => save(pinnedIds.filter((x) => x !== e.id))} />
          ))}
        </SortableContext>
      </DndContext>
      {!pinned.length && <p className="border-b border-line py-3 text-[13px] text-fg2">Nothing pinned. Tick lifts below.</p>}

      <div className="mt-6 pb-1 text-[11px] font-bold tracking-[0.06em] text-fg2 uppercase">Other exercises</div>
      <SearchField value={query} onChange={setQuery} placeholder="Search all exercises" />
      <div className="mt-1">
        {others.map((e) => (
          <button key={e.id} type="button" onClick={() => save([...pinnedIds, e.id])} className="flex min-h-[52px] w-full items-center gap-3 border-b border-line text-left active:bg-surface/60">
            <Check on={false} />
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[16px] font-semibold">{e.name}</b>
              <span className="text-[13px] text-fg2">{sessions(e.id) ? `${sessions(e.id)} sessions` : 'Not logged yet'}</span>
            </span>
          </button>
        ))}
        {!others.length && <p className="py-4 text-[13px] text-fg2">{query ? 'No matches.' : 'Everything you’ve logged is pinned.'}</p>}
      </div>
    </Screen>
  );
}

function PinnedRow({ exercise, sessions, onToggle }: { exercise: Exercise; sessions: number; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: exercise.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cx('relative flex min-h-[52px] items-center gap-3 border-b border-line bg-bg', isDragging && 'z-10 rounded-[10px] border-transparent bg-surface px-2 outline-[1.5px] outline-accent')}
    >
      <button type="button" onClick={onToggle} aria-label={`Unpin ${exercise.name}`} className="-ml-2 flex h-11 w-11 items-center justify-center">
        <Check on />
      </button>
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[16px] font-semibold">{exercise.name}</b>
        <span className="text-[13px] text-fg2">{sessions} sessions</span>
      </span>
      <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={`Reorder ${exercise.name}`} className="-mr-2 flex h-11 w-11 touch-none items-center justify-center text-fg3">
        <Handle />
      </button>
    </div>
  );
}
