import { useState, type ReactNode } from 'react';
import { SortableRow, SortableRows } from '../../components/SortableRows';
import { SwipeRow } from '../../components/gestures';
import { ChevronRight } from '../../components/icons';
import { Alert, useToast } from '../../components/overlays';
import { AddButton, BarButton, Button, CountRing, cx, DeleteDisc, Tag } from '../../components/ui';
import { type ActiveExercise, useData } from '../../data/DataProvider';
import { lastSession } from '../../data/history';
import { moveWorkoutExercise, removeWorkoutExercise, restoreWorkoutExercise } from '../../data/workouts';
import { cardioSummary } from '../../lib/cardio';
import { bestSet } from '../../lib/oneRm';
import { formatSet, TYPE_TAG } from '../../lib/sets';
import { supersetBlocks, supersetTags } from '../../lib/supersets';
import { TagPill } from './WorkoutScreen';

/**
 * 4.12 / 4.13: every exercise in today's workout; tap to jump, Edit to remove or reorder.
 * Swiping a row right to left removes it too (a shortcut for Edit → −).
 * Shown in place of the exercise view, under the workout header, so Finish stays in reach.
 */
export function AllExercises({
  exercises,
  currentId,
  onClose,
  onJump,
  onAdd,
}: {
  exercises: ActiveExercise[];
  currentId?: string;
  onClose: () => void;
  onJump: (weId: string) => void;
  onAdd: () => void;
}) {
  const { history, settings } = useData();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<ActiveExercise | null>(null);
  const units = settings.units;
  const toast = useToast();

  const items = exercises.map((e) => ({ key: e.we.id, supersetGroup: e.we.supersetGroup, e }));
  const blocks = supersetBlocks(items);
  const tags = supersetTags(items);

  const sub = (e: ActiveExercise) => {
    const done = e.sets.filter((s) => s.completed);
    const total = e.sets.length;
    if (e.exercise.type === 'cardio') {
      if (done.length) return cardioSummary(done, e.exercise, units);
      const last = lastSession(history, e.exercise.id);
      const line = last ? cardioSummary(last.sets, e.exercise, units) : '';
      return line ? `Last: ${line}` : 'First time';
    }
    if (tags.has(e.we.id) && done.length < total) return `${done.length} of ${total} sets`;
    if (total && done.length === total) {
      const best = bestSet(done, e.exercise.type, settings.oneRmFormula) ?? done[0];
      return `${total} ${total === 1 ? 'set' : 'sets'} · ${formatSet(best, e.exercise.type, units)}`;
    }
    if (done.length) return done.filter((s) => s.kind !== 'warmup').map((s) => formatSet(s, e.exercise.type, units)).join(', ') || `${done.length} warm-up${done.length === 1 ? '' : 's'}`;
    const last = lastSession(history, e.exercise.id);
    const best = last ? bestSet(last.sets, e.exercise.type, settings.oneRmFormula) : null;
    return best ? `Last: ${formatSet(best, e.exercise.type, units)}` : total ? `${total} ${total === 1 ? 'set' : 'sets'} · first time` : 'No sets yet';
  };

  /** Logged sets ask first; otherwise it goes at once with an Undo. */
  const remove = async (e: ActiveExercise) => {
    if (e.sets.some((s) => s.completed)) {
      setConfirm(e);
      return;
    }
    const removed = await removeWorkoutExercise(e.we.id);
    if (removed) toast({ message: `${e.exercise.name} removed`, actionLabel: 'Undo', onAction: () => void restoreWorkoutExercise(removed) });
  };

  /** Dragging a block from one position to another, one step at a time (moves skip whole supersets). */
  const move = async (from: number, to: number) => {
    const key = blocks[from].items[0].key;
    for (let i = 0; i < Math.abs(to - from); i++) await moveWorkoutExercise(key, to > from ? 1 : -1);
  };

  const close = () => {
    setEditing(false);
    onClose();
  };

  return (
    <div className="scroll-y anim-page min-h-0 flex-1 px-4 pb-safe">
      {/* Same title block as the exercise view (4.1), so switching between them doesn't jump.
          Close centres on the title line (-mt-2: 44 px button, 27.5 px line). */}
      <div className="mt-3.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-title2 leading-tight font-bold">Exercises</h1>
          <p className="mt-0.5 flex h-6 items-center text-footnote text-fg2">{editing ? 'Remove or reorder for today.' : 'Plan order. Tap one to open it.'}</p>
        </div>
        <BarButton className="-mt-2 -mr-2" kind={editing ? 'muted' : 'plain'} disabled={editing} onClick={close}>
          Close
        </BarButton>
      </div>
      <div className="mt-1.5">
        <SortableRows ids={blocks.map((b) => b.items[0].key)} onMove={(from, to) => void move(from, to)}>
          {blocks.map((block) => {
            const row = (e: ActiveExercise, handle: ReactNode) => {
              const done = e.sets.filter((s) => s.completed).length;
              const isCur = e.we.id === currentId;
              const tag = tags.get(e.we.id);
              const body = (
                <>
                  {tag ? (
                    <span className="flex w-[30px] flex-none justify-center">
                      <TagPill tag={tag} on={isCur} done={e.sets.length > 0 && done === e.sets.length} />
                    </span>
                  ) : (
                    <CountRing done={done} total={e.sets.length} />
                  )}
                  <span className="min-w-0 flex-1">
                    <b className={cx('block truncate text-input font-semibold', isCur && 'text-accent')}>
                      {e.exercise.name}
                      {TYPE_TAG[e.exercise.type] && <Tag>{TYPE_TAG[e.exercise.type]}</Tag>}
                    </b>
                    <span className="block truncate text-footnote text-fg2">{sub(e)}</span>
                  </span>
                </>
              );
              if (editing)
                return (
                  <div key={e.we.id} className="flex min-h-[60px] items-center gap-3 border-b border-line">
                    <DeleteDisc label={`Remove ${e.exercise.name}`} onClick={() => void remove(e)} />
                    {body}
                    {handle}
                  </div>
                );
              return (
                <SwipeRow key={e.we.id} rounded={false} left={{ label: 'Remove', onTrigger: () => void remove(e) }}>
                  <button
                    type="button"
                    onClick={() => {
                      onJump(e.we.id);
                      close();
                    }}
                    className="flex min-h-[60px] w-full items-center gap-3 border-b border-line text-left active:bg-surface/60"
                  >
                    {body}
                    <ChevronRight size={13} className="flex-none text-fg3" />
                  </button>
                </SwipeRow>
              );
            };
            const first = block.items[0];
            if (!block.letter)
              return (
                <SortableRow key={first.key} id={first.key} enabled={editing} label={first.e.exercise.name}>
                  {(handle) => row(first.e, handle)}
                </SortableRow>
              );
            // A superset moves as one block; its handle sits on the label line.
            return (
              <SortableRow key={first.key} id={first.key} enabled={editing} label={`Superset ${block.letter}`}>
                {(handle) => (
                  <div className="mt-2 border-l-2 border-accent pl-3">
                    <div className="flex min-h-9 items-center justify-between gap-2">
                      <span className="text-caps text-accent">Superset {block.letter}</span>
                      {handle}
                    </div>
                    {block.items.map((it) => row(it.e, null))}
                  </div>
                )}
              </SortableRow>
            );
          })}
        </SortableRows>
      </div>
      {!exercises.length && <p className="py-8 text-center text-callout text-fg2">No exercises yet.</p>}
      <div className="mt-4 grid grid-cols-[1fr_100px] gap-2">
        <AddButton onClick={onAdd}>+ Add exercise</AddButton>
        <Button kind={editing ? 'primary' : 'secondary'} onClick={() => setEditing((v) => !v)} disabled={!exercises.length}>
          {editing ? 'Done' : 'Edit'}
        </Button>
      </div>
      <div className="h-6" />
      <Alert
        open={!!confirm}
        title={`Remove ${confirm?.exercise.name ?? 'exercise'}?`}
        message={(() => {
          const n = confirm?.sets.filter((s) => s.completed).length ?? 0;
          return `${n} logged ${n === 1 ? 'set' : 'sets'} will be deleted from today's workout.`;
        })()}
        onClose={() => setConfirm(null)}
        actions={[
          {
            label: 'Remove',
            kind: 'danger',
            onClick: () => {
              if (confirm) void removeWorkoutExercise(confirm.we.id);
              setConfirm(null);
            },
          },
          { label: 'Cancel', onClick: () => setConfirm(null) },
        ]}
      />
    </div>
  );
}
