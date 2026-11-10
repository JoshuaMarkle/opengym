import { useState, type ReactNode } from 'react';
import { SwipeRow } from '../../components/gestures';
import { ChevronRight, TrendDown, TrendUp } from '../../components/icons';
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
          <h1 className="text-[22px] leading-tight font-bold tracking-[-0.01em]">Exercises</h1>
          <p className="mt-0.5 flex h-6 items-center text-[13px] text-fg2">{editing ? 'Remove or reorder for today.' : 'Plan order. Tap one to open it.'}</p>
        </div>
        <BarButton className="-mt-2 -mr-2" kind={editing ? 'muted' : 'plain'} disabled={editing} onClick={close}>
          Close
        </BarButton>
      </div>
      <div className="mt-1.5">
        {blocks.map((block, bi) => {
          const moves = (key: string) => (
            <span className="flex flex-none gap-1">
              <MoveButton label="Move up" disabled={bi === 0} onClick={() => void moveWorkoutExercise(key, -1)}>
                <TrendUp size={9} />
              </MoveButton>
              <MoveButton label="Move down" disabled={bi === blocks.length - 1} onClick={() => void moveWorkoutExercise(key, 1)}>
                <TrendDown size={9} />
              </MoveButton>
            </span>
          );
          const row = (e: ActiveExercise, inGroup: boolean) => {
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
                  <DeleteDisc label={`Remove ${e.exercise.name}`} onClick={() => void remove(e)} />
                  {body}
                  {!inGroup && moves(e.we.id)}
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
          if (!block.letter) return row(block.items[0].e, false);
          return (
            <div key={`ss-${block.items[0].key}`} className="mt-2 border-l-2 border-accent pl-3">
              <div className="flex min-h-9 items-center justify-between gap-2">
                <span className="text-[11px] font-bold tracking-[0.07em] text-accent uppercase">Superset {block.letter}</span>
                {editing && moves(block.items[0].key)}
              </div>
              {block.items.map((it) => row(it.e, true))}
            </div>
          );
        })}
      </div>
      {!exercises.length && <p className="py-8 text-center text-[14px] text-fg2">No exercises yet.</p>}
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

/** Drawn like a stepper button (design §10): 36 × 32 / r8 / surface-2, in a 44-tall target. */
function MoveButton({ children, label, disabled, onClick }: { children: ReactNode; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="flex h-11 w-9 items-center justify-center disabled:opacity-30">
      <span className="flex h-8 w-9 items-center justify-center rounded-sm bg-surface-2 text-fg">{children}</span>
    </button>
  );
}
