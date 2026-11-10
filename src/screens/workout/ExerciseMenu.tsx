import { useMemo, useState } from 'react';
import { ChevronRight } from '../../components/icons';
import { Sheet, SheetOption } from '../../components/overlays';
import { cx, Radio } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { variationList } from '../../lib/popularity';
import type { Exercise } from '../../db/types';
import { muscleLabel } from '../../db/types';
import { variationLabels } from '../../lib/variations';
import { useVariations } from '../progress/LiftViews';

/** 4.6: the exercise "•••" sheet, and the variation list it leads to. */
export function ExerciseMenu({
  exercise,
  open,
  onClose,
  onSwitch,
  onLinkVariations,
  onReplace,
  onLookback,
  onSettings,
  onRemove,
  superset,
}: {
  exercise: Exercise | undefined;
  open: boolean;
  onClose: () => void;
  onSwitch: (exerciseId: string) => void;
  onLinkVariations: () => void;
  onReplace: () => void;
  onLookback: () => void;
  onSettings: () => void;
  onRemove: () => void;
  /** 2.13: "Superset with…", or "Unlink superset" once it's in one. Leave out for cardio. */
  superset?: { tag?: string; onLink: () => void; onUnlink: () => void; canAdd: boolean };
}) {
  const [variationsOpen, setVariationsOpen] = useState(false);
  const variations = useVariations(exercise);
  const labels = useMemo(() => variationLabels(variations), [variations]);
  const { history } = useData();
  // Most popular first; rare ones you haven't logged trail, dimmed (B2).
  const { switchList, rare } = useMemo(() => {
    const l = variationList(variations, (id) => history.sessionsByExercise.get(id)?.length ?? 0);
    return { switchList: [...l.main, ...l.rare], rare: new Set(l.rare.map((e) => e.id)) };
  }, [variations, history]);
  if (!exercise) return null;
  const hasVariations = variations.length > 1;
  const label = hasVariations ? labels.get(exercise.id) : undefined;
  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };

  return (
    <>
      <Sheet open={open && !variationsOpen} onClose={onClose} title={exercise.name} subtitle={`${label ?? muscleLabel(exercise.muscle)} · options for this workout`}>
        {hasVariations ? (
          <SheetOption
            onClick={() => setVariationsOpen(true)}
            detail={
              <>
                {label}
                <ChevronRight size={12} />
              </>
            }
          >
            Switch variation
          </SheetOption>
        ) : (
          <SheetOption onClick={run(onLinkVariations)} detail={<ChevronRight size={12} />}>
            Link a variation…
          </SheetOption>
        )}
        {superset &&
          (superset.tag ? (
            <>
              {superset.canAdd && (
                <SheetOption onClick={run(superset.onLink)} detail={<ChevronRight size={12} />}>
                  Add to superset…
                </SheetOption>
              )}
              <SheetOption onClick={run(superset.onUnlink)} detail={superset.tag}>
                Unlink superset
              </SheetOption>
            </>
          ) : (
            <SheetOption onClick={run(superset.onLink)} detail={<ChevronRight size={12} />}>
              Superset with…
            </SheetOption>
          ))}
        <SheetOption onClick={run(onReplace)}>Replace exercise…</SheetOption>
        <SheetOption onClick={run(onLookback)} detail={<ChevronRight size={12} />}>
          History, charts & records
        </SheetOption>
        <SheetOption onClick={run(onSettings)} detail={<ChevronRight size={12} />}>
          Exercise settings
        </SheetOption>
        <SheetOption tone="danger" onClick={run(onRemove)}>
          Remove from workout
        </SheetOption>
      </Sheet>

      <Sheet
        open={open && variationsOpen}
        onClose={() => {
          setVariationsOpen(false);
          onClose();
        }}
        title="Switch variation"
        subtitle="Each variation keeps its own history. Unticked sets refill from the new one's last session."
      >
        {switchList.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => {
              setVariationsOpen(false);
              onClose();
              if (v.id !== exercise.id) onSwitch(v.id);
            }}
            className={cx('flex min-h-[52px] w-full items-center gap-3 border-b border-line text-left', rare.has(v.id) && 'opacity-55')}
          >
            <Radio on={v.id === exercise.id} />
            <span className="min-w-0 flex-1">
              <b className="block truncate text-input font-semibold">{labels.get(v.id)}</b>
              <span className="block truncate text-footnote text-fg2">{v.name}</span>
            </span>
          </button>
        ))}
        <SheetOption
          tone="accent"
          onClick={() => {
            setVariationsOpen(false);
            onClose();
            onLinkVariations();
          }}
        >
          Edit linked variations…
        </SheetOption>
      </Sheet>
    </>
  );
}
