import { useMemo, useState } from 'react';
import { CloseIcon } from '../../components/icons';
import { Sheet } from '../../components/overlays';
import { Segmented } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import type { Exercise } from '../../db/types';
import { variationLabels } from '../../lib/variations';
import { ChartsView, HistoryView, RecordsView, useVariations, type LiftMetric } from '../progress/LiftViews';

type Tab = 'history' | 'charts' | 'records';

/** 4.8–4.10: History / Charts / Records for one lift, over the workout. */
export function LookbackSheet({
  exercise,
  open,
  onClose,
  currentReps,
}: {
  exercise: Exercise | undefined;
  open: boolean;
  onClose: () => void;
  currentReps?: number;
}) {
  const [tab, setTab] = useState<Tab>('history');
  const [metric, setMetric] = useState<LiftMetric>('e1rm');
  const { history } = useData();
  const variations = useVariations(exercise);
  const labels = useMemo(() => variationLabels(variations), [variations]);
  if (!exercise) return null;
  const sessions = history.sessionsByExercise.get(exercise.id)?.length ?? 0;
  const sub = [variations.length > 1 ? labels.get(exercise.id) : null, `${sessions} ${sessions === 1 ? 'session' : 'sessions'}`].filter(Boolean).join(' · ');

  return (
    <Sheet
      open={open}
      onClose={onClose}
      tall
      title={
        <span className="block leading-tight">
          {exercise.name}
          <small className="block text-[12px] font-medium text-fg2">{sub}</small>
        </span>
      }
      action={
        <button type="button" aria-label="Close" onClick={onClose} className="-mr-2 flex h-11 w-11 items-center justify-center">
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-key-fn text-fg2">
            <CloseIcon size={11} />
          </span>
        </button>
      }
    >
      <div className="sticky top-0 z-[2] -mx-4 bg-raised px-4 pt-2 pb-1">
        <Segmented
          options={[
            { value: 'history' as Tab, label: 'History' },
            { value: 'charts' as Tab, label: 'Charts' },
            { value: 'records' as Tab, label: 'Records' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>
      {tab === 'history' && <HistoryView exercise={exercise} />}
      {tab === 'charts' && <ChartsView exercise={exercise} metric={metric} onMetric={setMetric} />}
      {tab === 'records' && <RecordsView exercise={exercise} currentReps={currentReps} />}
    </Sheet>
  );
}
