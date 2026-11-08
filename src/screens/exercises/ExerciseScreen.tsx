import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { ChevronRight } from '../../components/icons';
import { Alert, FullScreen, useToast } from '../../components/overlays';
import { BackButton, BarButton, Check, cx, EmptyState, LabelAction, Note, Screen, SearchField, SectionLabel, StatRow, Tag, TopBar } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { deleteExercise, mergeExercise, routinesUsing, setVariations } from '../../data/exercises';
import { equipmentLabel, muscleLabel, type Exercise } from '../../db/types';
import { cardioTotals, columnsLabel, formatHours } from '../../lib/cardio';
import { fmtMonthDay } from '../../lib/dates';
import { computeRecords } from '../../lib/records';
import { TYPE_LABEL, TYPE_TAG } from '../../lib/sets';
import { formatNumber, toDisplay } from '../../lib/units';
import { variationLabels } from '../../lib/variations';
import { useVariations } from '../progress/LiftViews';
import { ExercisePicker } from './ExercisePicker';
import { effortIn1rm } from '../../lib/effort';

/** 8.2: stats, linked variations, where it's used, merge and delete. */
export function ExerciseScreen() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { exerciseMap, history, settings } = useData();
  const exercise = exerciseMap.get(id);
  const variations = useVariations(exercise);
  const labels = useMemo(() => variationLabels(variations), [variations]);
  const usedIn = useLiveQuery(() => routinesUsing(id), [id]);
  const [merging, setMerging] = useState(false);
  const [mergeInto, setMergeInto] = useState<Exercise | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const linkOpen = params.get('link') === '1';
  const setLinkOpen = (open: boolean) => setParams(open ? { link: '1' } : {}, { replace: true });

  const sessions = history.sessionsByExercise.get(id) ?? [];
  const rec = useMemo(() => (exercise ? computeRecords(sessions, exercise.type, settings.oneRmFormula, effortIn1rm(settings)) : null), [sessions, exercise, settings]);
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/exercises'));

  if (!exercise || exercise.deletedAt)
    return (
      <Screen header={<TopBar left={<BackButton label="Exercises" onClick={() => navigate('/exercises')} />} />}>
        <EmptyState icon="?" title="Exercise not found" className="pt-20">
          It may have been deleted or merged into another one.
        </EmptyState>
      </Screen>
    );

  const units = settings.units;
  const cardioTime = exercise.type === 'cardio' ? cardioTotals(sessions.flatMap((s) => s.sets)).durationSec : 0;
  const best =
    exercise.type === 'cardio'
      ? { label: 'Total time', value: formatHours(cardioTime) }
      : exercise.type === 'weight'
      ? { label: 'Best est. 1RM', value: rec?.bestE1rm ? formatNumber(Math.round(toDisplay(rec.bestE1rm.value, units)), 0) : '—' }
      : { label: 'Most reps', value: rec?.mostReps ? String(rec.mostReps.reps) : '—' };

  return (
    <Screen
      header={
        <TopBar
          border={false}
          left={<BackButton label="Exercises" onClick={back} />}
          right={<BarButton onClick={() => navigate(`/exercises/${id}/edit`)}>Edit</BarButton>}
        />
      }
    >
      <h1 className="mt-1 text-[30px] leading-tight font-bold tracking-[-0.02em]">
        {exercise.name}
        {TYPE_TAG[exercise.type] && <Tag>{TYPE_TAG[exercise.type]}</Tag>}
      </h1>
      <p className="mt-1 text-[13px] text-fg2">
        {exercise.type === 'cardio' ? `Cardio · ${columnsLabel(exercise, units)}` : `${muscleLabel(exercise.muscle)} · ${equipmentLabel(exercise.equipment)} · ${TYPE_LABEL[exercise.type]}`}
        {exercise.isCustom ? ' · custom' : ''}
      </p>

      <StatRow
        className="mt-3"
        items={[
          { label: 'Sessions', value: sessions.length },
          best,
          { label: 'Last', value: sessions[0] ? fmtMonthDay(sessions[0].date) : '—' },
        ]}
      />

      {exercise.type !== 'cardio' && (
        <>
      <SectionLabel action={<LabelAction onClick={() => setLinkOpen(true)}>{variations.length > 1 ? 'Edit links' : 'Link'}</LabelAction>}>Variations</SectionLabel>
      {variations.length > 1 ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {variations.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => v.id !== exercise.id && navigate(`/exercises/${v.id}`, { replace: true })}
              className={cx('h-8 rounded-[8px] border px-3 text-[13px] font-semibold', v.id === exercise.id ? 'border-accent bg-done text-fg' : 'border-line-strong text-fg2')}
            >
              {labels.get(v.id)}
              {v.id === exercise.id && <span className="ml-1 font-normal text-fg2">· this</span>}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-2.5 text-[14px] text-fg2">None linked.</p>
      )}
      <Note>Linked exercises show as buttons when logging. Each keeps its own history.</Note>
        </>
      )}

      <SectionLabel>More</SectionLabel>
      <button
        type="button"
        onClick={() => navigate(exercise.type === 'cardio' ? `/progress/cardio/${id}` : `/progress/lift/${id}`)}
        className="flex min-h-[52px] w-full items-center justify-between gap-3 border-b border-line text-left text-[16px]"
      >
        {exercise.type === 'cardio' ? 'Weekly totals & sessions' : 'History, charts & records'}
        <ChevronRight size={13} className="text-fg3" />
      </button>
      <div className="flex min-h-[52px] items-center justify-between gap-3 border-b border-line text-[16px]">
        <span className="flex-none">Used in</span>
        <span className="min-w-0 truncate text-right text-[14px] text-fg2">
          {usedIn === undefined ? '' : usedIn.length ? (
            usedIn.map((r, i) => (
              <span key={r.id}>
                {i > 0 && ', '}
                <button type="button" onClick={() => navigate(`/routine/${r.id}`)} className="text-accent">
                  {r.name}
                </button>
              </span>
            ))
          ) : (
            'No routines'
          )}
        </span>
      </div>
      <button type="button" onClick={() => setMerging(true)} className="flex min-h-[52px] w-full items-center justify-between gap-3 border-b border-line text-left text-[16px]">
        Merge into another exercise…
        <ChevronRight size={13} className="text-fg3" />
      </button>
      <button type="button" onClick={() => setConfirmDelete(true)} className="flex min-h-[52px] w-full items-center border-b border-line text-left text-[16px] text-danger">
        Delete exercise
      </button>
      <Note>Merge fixes duplicates (like an imported "Bench Press (Barbell)") by moving all its history into one exercise.</Note>

      <LinkVariations open={linkOpen} exercise={exercise} linked={variations.filter((v) => v.id !== exercise.id).map((v) => v.id)} onClose={() => setLinkOpen(false)} />

      <ExercisePicker
        open={merging}
        mode="single"
        title={`Merge ${exercise.name} into…`}
        excludeIds={[exercise.id]}
        onCancel={() => setMerging(false)}
        onPick={(tid) => {
          setMerging(false);
          setMergeInto(exerciseMap.get(tid) ?? null);
        }}
      />
      <Alert
        open={!!mergeInto}
        title={`Merge into ${mergeInto?.name ?? ''}?`}
        message={`All ${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'} of ${exercise.name} move to ${mergeInto?.name ?? ''}, and routines use it instead. ${exercise.name} is then removed.`}
        onClose={() => setMergeInto(null)}
        actions={[
          {
            label: 'Merge',
            kind: 'danger',
            onClick: async () => {
              const target = mergeInto;
              setMergeInto(null);
              if (!target) return;
              await mergeExercise(exercise.id, target.id);
              toast({ message: `Merged into ${target.name}` });
              navigate(`/exercises/${target.id}`, { replace: true });
            },
          },
          { label: 'Cancel', onClick: () => setMergeInto(null) },
        ]}
      />
      <Alert
        open={confirmDelete}
        title={`Delete ${exercise.name}?`}
        message={
          sessions.length || usedIn?.length
            ? `It disappears from the library${usedIn?.length ? ` and from ${usedIn.length} ${usedIn.length === 1 ? 'routine' : 'routines'}` : ''}. Past workouts keep their sets.`
            : 'It disappears from the library.'
        }
        onClose={() => setConfirmDelete(false)}
        actions={[
          {
            label: 'Delete exercise',
            kind: 'danger',
            onClick: async () => {
              setConfirmDelete(false);
              await deleteExercise(exercise.id);
              toast({ message: `${exercise.name} deleted` });
              navigate('/exercises', { replace: true });
            },
          },
          { label: 'Cancel', onClick: () => setConfirmDelete(false) },
        ]}
      />
    </Screen>
  );
}

/** 8.4: pick exercises that replace each other. */
function LinkVariations({ open, exercise, linked, onClose }: { open: boolean; exercise: Exercise; linked: string[]; onClose: () => void }) {
  return <FullScreen open={open}>{open && <LinkBody exercise={exercise} linked={linked} onClose={onClose} />}</FullScreen>;
}

function LinkBody({ exercise, linked, onClose }: { exercise: Exercise; linked: string[]; onClose: () => void }) {
  const { exercises } = useData();
  const [picked, setPicked] = useState<string[]>(linked);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const list = useMemo(() => {
    const others = exercises.filter((e) => e.id !== exercise.id && !e.archived);
    const matches = q ? others.filter((e) => e.name.toLowerCase().includes(q)) : others;
    // Picked first, then the same muscle (most likely variations), then the rest.
    return matches.sort(
      (a, b) =>
        Number(picked.includes(b.id)) - Number(picked.includes(a.id)) ||
        Number(b.muscle === exercise.muscle) - Number(a.muscle === exercise.muscle) ||
        a.name.localeCompare(b.name),
    );
  }, [exercises, exercise, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const done = async () => {
    await setVariations(exercise.id, picked);
    onClose();
  };

  return (
    <Screen
      header={
        <>
          <TopBar
            left={
              <BarButton kind="muted" onClick={onClose}>
                Cancel
              </BarButton>
            }
            title={`Variations of ${exercise.name}`}
            right={
              <BarButton kind="bold" onClick={() => void done()}>
                Done
              </BarButton>
            }
          />
          <div className="flex-none px-4 pb-2">
            <Note>Pick exercises that replace each other, like Flat, Incline and DB bench. They become buttons when logging and a switch in Progress.</Note>
            <SearchField value={query} onChange={setQuery} placeholder="Search exercises" />
          </div>
        </>
      }
    >
      {list.map((e) => {
        const on = picked.includes(e.id);
        const elsewhere = !on && e.variationGroupId && e.variationGroupId !== exercise.variationGroupId;
        return (
          <button
            key={e.id}
            type="button"
            onClick={() => setPicked((p) => (on ? p.filter((x) => x !== e.id) : [...p, e.id]))}
            className="flex min-h-[54px] w-full items-center gap-3 border-b border-line text-left"
          >
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[16px] font-semibold">{e.name}</b>
              <span className="block truncate text-[13px] text-fg2">
                {muscleLabel(e.muscle)} · {equipmentLabel(e.equipment).toLowerCase()}
                {elsewhere ? ' · linked to others' : ''}
              </span>
            </span>
            <Check on={on} />
          </button>
        );
      })}
    </Screen>
  );
}
