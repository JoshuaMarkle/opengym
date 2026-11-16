import type { ReactNode } from 'react';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cx, DragHandle } from './ui';

/** A drag-to-reorder list for food and exercise rows (10.33, 4.13). Touch drags from the handle; arrows work too. */
export function SortableRows({ ids, onMove, children }: { ids: string[]; onMove: (from: number, to: number) => void; children: ReactNode }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) onMove(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

/**
 * One sortable row. `children` gets the Handle to place trailing in the row (design §6 edit row),
 * so the row's own hairline runs under it. Lifted while dragging. With `enabled` off the handle
 * is null and nothing moves.
 */
export function SortableRow({ id, label, children, enabled = true }: { id: string; label: string; children: (handle: ReactNode) => ReactNode; enabled?: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !enabled });
  if (!enabled) return <>{children(null)}</>;
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={cx('relative bg-bg', isDragging && 'z-10 rounded-md bg-surface ring-[1.5px] ring-accent')}>
      {children(<DragHandle label={`Reorder ${label}`} handleRef={setActivatorNodeRef} className="-mr-3 text-fg3" {...attributes} {...listeners} />)}
    </div>
  );
}
