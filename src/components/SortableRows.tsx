import type { ReactNode } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DragHandle } from './ui';

/** Keyboard and touch accessible ordering for food and exercise rows (10.1, 4.13). */
export function SortableRows({ ids, onMove, children }: { ids: string[]; onMove: (from: number, to: number) => void; children: ReactNode }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { delay: 450, tolerance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => { if (over && active.id !== over.id) onMove(ids.indexOf(String(active.id)), ids.indexOf(String(over.id))); }}><SortableContext items={ids} strategy={verticalListSortingStrategy}>{children}</SortableContext></DndContext>;
}
export function SortableRow({ id, label, children, enabled = true }: { id: string; label: string; children: ReactNode; enabled?: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = useSortable({ id, disabled: !enabled });
  if (!enabled) return <>{children}</>;
  return <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className="flex items-center bg-bg"><DragHandle label={`Reorder ${label}`} handleRef={setActivatorNodeRef} {...attributes} {...listeners} /><div className="min-w-0 flex-1">{children}</div></div>;
}
