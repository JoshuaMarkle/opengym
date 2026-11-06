import { useMemo, useState } from 'react';
import { ChevronRight } from '../../components/icons';
import { Sheet, SheetOption } from '../../components/overlays';
import { Radio } from '../../components/ui';
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
}) {
  const [variationsOpen, setVariationsOpen] = useState(false);
  const variations = useVariations(exercise);
  const labels = useMemo(() => variationLabels(variations), [variations]);
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
        {variations.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => {
              setVariationsOpen(false);
              onClose();
              if (v.id !== exercise.id) onSwitch(v.id);
            }}
            className="flex min-h-[52px] w-full items-center gap-3 border-b border-line text-left"
          >
            <Radio on={v.id === exercise.id} />
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[16px] font-semibold">{labels.get(v.id)}</b>
              <span className="block truncate text-[13px] text-fg2">{v.name}</span>
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
