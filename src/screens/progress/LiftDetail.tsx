import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { CheckGlyph, ChevronDown } from '../../components/icons';
import { Sheet, SheetOption } from '../../components/overlays';
import { BackButton, EmptyState, Screen, Segmented, TopBar } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { variationLabels } from '../../lib/variations';
import { ChartsView, HistoryView, RecordsView, useVariations, type LiftMetric } from './LiftViews';

type Tab = 'e1rm' | 'top' | 'records' | 'history';

/** 7.2–7.4 (+ History): one lift. "Flat ▾" switches variation or combines them. */
export function LiftDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { exerciseMap } = useData();
  const exercise = exerciseMap.get(id);
  const variations = useVariations(exercise);
  const labels = useMemo(() => variationLabels(variations), [variations]);
  const [combined, setCombined] = useState(false);
  const [varOpen, setVarOpen] = useState(false);
  const [tab, setTab] = useState<Tab>(exercise?.type === 'weight' ? 'e1rm' : 'top');
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/progress'));

  if (!exercise)
    return (
      <Screen header={<TopBar left={<BackButton label="Progress" onClick={() => navigate('/progress')} />} />}>
        <EmptyState icon="?" title="Exercise not found" className="pt-20" />
      </Screen>
    );

  const hasVariations = variations.length > 1;
  const ids = combined ? variations.map((v) => v.id) : [exercise.id];
  const tabs: { value: Tab; label: string }[] = [
    ...(exercise.type === 'weight' ? [{ value: 'e1rm' as Tab, label: 'Est. 1RM' }] : []),
    { value: 'top', label: exercise.type === 'bodyweight' ? 'Reps' : 'Top set' },
    { value: 'records', label: 'Records' },
    { value: 'history', label: 'History' },
  ];

  return (
    <Screen
      header={
        <TopBar
          left={<BackButton label="Progress" onClick={back} />}
          title={exercise.name}
          right={
            hasVariations ? (
              <button type="button" onClick={() => setVarOpen(true)} className="flex h-11 items-center" aria-label="Variation">
                <span className="flex h-[30px] max-w-[110px] items-center gap-1 rounded-[9px] border border-line-strong px-2 text-[13px] font-semibold text-accent">
                  <span className="truncate">{combined ? 'All' : labels.get(exercise.id)}</span>
                  <ChevronDown size={9} className="flex-none" />
                </span>
              </button>
            ) : undefined
          }
        />
      }
    >
      <Segmented className="mt-3" options={tabs} value={tab} onChange={setTab} />
      {(tab === 'e1rm' || tab === 'top') && (
        <ChartsView key={`${ids.join()}-${tab}`} exercise={exercise} exerciseIds={ids} metric={tab as LiftMetric} showMetricChips={false} showStats defaultRange="6M" />
      )}
      {tab === 'records' && <RecordsView exercise={exercise} exerciseIds={ids} />}
      {tab === 'history' && <HistoryView exercise={exercise} onOpenWorkout={(wid) => navigate(`/history/${wid}`)} />}
      {tab !== 'history' && (
        <button type="button" onClick={() => navigate(`/exercises/${exercise.id}`)} className="mt-5 flex h-11 w-full items-center justify-center text-[15px] font-semibold text-accent">
          Exercise settings
        </button>
      )}

      <Sheet open={varOpen} onClose={() => setVarOpen(false)} title="Variation" subtitle="Each variation keeps its own history. Combined takes the best of each day.">
        {variations.map((v) => (
          <SheetOption
            key={v.id}
            onClick={() => {
              setVarOpen(false);
              setCombined(false);
              if (v.id !== exercise.id) navigate(`/progress/lift/${v.id}`, { replace: true });
            }}
            detail={!combined && v.id === exercise.id ? <CheckGlyph size={15} className="text-accent" /> : <span className="text-[13px]">{v.name}</span>}
          >
            {labels.get(v.id)}
          </SheetOption>
        ))}
        <SheetOption
          onClick={() => {
            setCombined(true);
            setVarOpen(false);
          }}
          detail={combined ? <CheckGlyph size={15} className="text-accent" /> : undefined}
        >
          All combined
        </SheetOption>
      </Sheet>
    </Screen>
  );
}
