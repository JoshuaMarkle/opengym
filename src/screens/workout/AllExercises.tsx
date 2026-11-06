import { useState } from 'react';
import { ChevronRight } from '../../components/icons';
import { Alert } from '../../components/overlays';
import { BarButton, cx, Note, Tag } from '../../components/ui';
import { type ActiveExercise, useData } from '../../data/DataProvider';
import { lastSession } from '../../data/history';
import { moveWorkoutExercise, removeWorkoutExercise } from '../../data/workouts';
import { bestSet } from '../../lib/oneRm';
import { formatSet, TYPE_TAG } from '../../lib/sets';
import { Ring } from './Ring';

/**
 * 4.12 / 4.13: every exercise in today's workout; tap to jump, Edit to remove or reorder.
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

  const sub = (e: ActiveExercise) => {
    const done = e.sets.filter((s) => s.completed);
    const total = e.sets.length;
    if (total && done.length === total) {
      const best = bestSet(done, e.exercise.type, settings.oneRmFormula) ?? done[0];
      return `${total} ${total === 1 ? 'set' : 'sets'} · ${formatSet(best, e.exercise.type, units)}`;
    }
    if (done.length) return done.filter((s) => s.kind !== 'warmup').map((s) => formatSet(s, e.exercise.type, units)).join(', ') || `${done.length} warm-up${done.length === 1 ? '' : 's'}`;
    const last = lastSession(history, e.exercise.id);
    const best = last ? bestSet(last.sets, e.exercise.type, settings.oneRmFormula) : null;
    return best ? `Last: ${formatSet(best, e.exercise.type, units)}` : total ? `${total} ${total === 1 ? 'set' : 'sets'} · first time` : 'No sets yet';
  };

  const remove = (e: ActiveExercise) => {
    if (e.sets.some((s) => s.completed)) setConfirm(e);
    else void removeWorkoutExercise(e.we.id);
  };

  const close = () => {
    setEditing(false);
    onClose();
  };

  return (
    <div className="scroll-y anim-page min-h-0 flex-1 px-4 pb-safe">
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <h1 className="text-[22px] leading-tight font-bold tracking-[-0.01em]">Exercises</h1>
        <BarButton className="-mr-2" kind={editing ? 'muted' : 'plain'} disabled={editing} onClick={close}>
          Close
        </BarButton>
      </div>
      <Note className="mt-1">{editing ? 'Remove or reorder for today. Finish asks whether to keep the changes in the routine.' : 'Plan order. Tap one to open it.'}</Note>
      <div className="mt-1">
        {exercises.map((e, i) => {
          const done = e.sets.filter((s) => s.completed).length;
          const isCur = e.we.id === currentId;
          const body = (
            <>
              <Ring done={done} total={e.sets.length} />
              <span className="min-w-0 flex-1">
                <b className={cx('block truncate text-[16px] font-semibold', isCur && 'text-accent')}>
                  {e.exercise.name}
                  {TYPE_TAG[e.exercise.type] && <Tag>{TYPE_TAG[e.exercise.type]}</Tag>}
                </b>
                <span className="block truncate text-[13px] text-fg2">{sub(e)}</span>
              </span>
            </>
          );
          if (editing)
            return (
              <div key={e.we.id} className="flex min-h-[60px] items-center gap-3 border-b border-line">
                <button type="button" aria-label={`Remove ${e.exercise.name}`} onClick={() => remove(e)} className="-ml-2 flex h-11 w-11 flex-none items-center justify-center">
                  <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-danger">
                    <i className="block h-[2px] w-[10px] rounded-full bg-white" />
                  </span>
                </button>
                {body}
                <span className="flex flex-none gap-1">
                  <MoveButton label="Move up" disabled={i === 0} onClick={() => void moveWorkoutExercise(e.we.id, -1)}>
                    ▲
                  </MoveButton>
                  <MoveButton label="Move down" disabled={i === exercises.length - 1} onClick={() => void moveWorkoutExercise(e.we.id, 1)}>
                    ▼
                  </MoveButton>
                </span>
              </div>
            );
          return (
            <button
              key={e.we.id}
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
          );
        })}
      </div>
      {!exercises.length && <p className="py-8 text-center text-[14px] text-fg2">No exercises yet.</p>}
      <div className="mt-4 grid grid-cols-[1fr_100px] gap-2">
        <button
          type="button"
          onClick={onAdd}
          className="flex h-11 items-center justify-center rounded-[12px] border border-dashed border-line-strong text-[15px] font-semibold text-accent active:opacity-70"
        >
          + Add exercise
        </button>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          disabled={!exercises.length}
          className={cx('flex h-11 items-center justify-center rounded-[12px] text-[15px] font-semibold disabled:opacity-40', editing ? 'bg-accent text-white' : 'bg-surface-2')}
        >
          {editing ? 'Done' : 'Edit'}
        </button>
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

function MoveButton({ children, label, disabled, onClick }: { children: string; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="flex h-11 w-9 items-center justify-center disabled:opacity-30">
      <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] bg-surface-2 text-[11px] text-fg">{children}</span>
    </button>
  );
}
