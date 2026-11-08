import { useState } from 'react';
import { BarButton, Chips, cx, FieldLabel, Note, Radio, Screen, TextField, Toggle, TopBar } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { createExercise, nameTaken, updateExercise } from '../../data/exercises';
import { EQUIPMENT, EXERCISE_TYPES, MUSCLES, type CardioColumn, type DistanceUnit, type Equipment, type Exercise, type ExerciseType, type Muscle } from '../../db/types';
import { CARDIO_COLUMN_INFO, cardioColumns, columnHeader, columnUnitHint, isComputed, MAX_CARDIO_COLUMNS } from '../../lib/cardio';

/** 8.3 New / edit exercise. Used as a page and inside the picker. */
export function ExerciseFormView({
  exercise,
  initialName = '',
  onCancel,
  onSaved,
}: {
  exercise?: Exercise;
  initialName?: string;
  onCancel: () => void;
  onSaved: (id: string) => void;
}) {
  const [name, setName] = useState(exercise?.name ?? initialName);
  const [type, setType] = useState<ExerciseType>(exercise?.type ?? 'weight');
  const [muscle, setMuscle] = useState<Muscle>(exercise?.muscle ?? 'chest');
  const [equipment, setEquipment] = useState<Equipment>(exercise?.equipment ?? 'barbell');
  const [columns, setColumns] = useState<CardioColumn[]>(exercise?.type === 'cardio' ? cardioColumns(exercise) : ['distance', 'speed']);
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>(exercise?.distanceUnit ?? 'auto');
  const [isRun, setIsRun] = useState(exercise?.isRun ?? false);
  const { settings } = useData();
  const units = settings.units;
  const cardio = type === 'cardio';
  const spec = { cardioColumns: columns, distanceUnit };
  // Split and pace are worked out from distance, so they need it.
  const toggleColumn = (c: CardioColumn) =>
    setColumns((cols) => {
      if (cols.includes(c)) return cols.filter((x) => x !== c && !(c === 'distance' && isComputed(x)));
      if (cols.length >= MAX_CARDIO_COLUMNS) return cols;
      if (isComputed(c) && !cols.includes('distance')) return cols.length + 2 > MAX_CARDIO_COLUMNS ? cols : [...cols, 'distance', c];
      return [...cols, c];
    });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const n = name.trim();
    if (!n) {
      setError('Give it a name.');
      return;
    }
    if (await nameTaken(n, exercise?.id)) {
      setError(`"${n}" is already in your library.`);
      return;
    }
    setSaving(true);
    try {
      const input = cardio
        ? { name: n, type, muscle: 'other' as Muscle, equipment: 'machine' as Equipment, cardioColumns: columns, distanceUnit, isRun: columns.includes('distance') && isRun }
        : { name: n, type, muscle, equipment };
      if (exercise) {
        await updateExercise(exercise.id, input);
        onSaved(exercise.id);
      } else {
        onSaved(await createExercise(input));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      header={
        <TopBar
          left={
            <BarButton kind="muted" onClick={onCancel}>
              Cancel
            </BarButton>
          }
          title={exercise ? 'Edit exercise' : 'New exercise'}
          right={
            <BarButton kind="bold" onClick={save} disabled={saving || !name.trim()}>
              Save
            </BarButton>
          }
        />
      }
    >
      <FieldLabel className="mt-4">Name</FieldLabel>
      <TextField
        value={name}
        onChange={(v) => {
          setName(v);
          setError('');
        }}
        placeholder="e.g. Landmine Press"
        autoFocus={!exercise}
      />
      {error && <p className="mt-1.5 text-[13px] font-semibold text-danger">{error}</p>}

      <FieldLabel>Type</FieldLabel>
      <div role="radiogroup" className="mt-1">
        {EXERCISE_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={type === t.id}
            onClick={() => setType(t.id)}
            className="grid min-h-[56px] w-full grid-cols-[22px_1fr_auto] items-center gap-3 border-b border-line py-2 text-left"
          >
            <Radio on={type === t.id} />
            <span>
              <b className="block text-[15px] font-semibold">{t.label}</b>
              <span className="text-[13px] text-fg2">{t.hint}</span>
            </span>
            <em className="rounded-[5px] bg-surface px-1.5 py-0.5 text-[12px] text-fg2 not-italic">{t.example}</em>
          </button>
        ))}
      </div>
      {exercise && exercise.type !== type && (
        <Note>
          {type === 'cardio' || exercise.type === 'cardio'
            ? "Switching between lifting and cardio changes what's logged. Past sets keep their numbers but may not show."
            : 'Changing the type changes which columns the set table shows. Past sets keep their numbers.'}
        </Note>
      )}

      {cardio ? (
        <>
          <FieldLabel>Columns · time + up to {MAX_CARDIO_COLUMNS}</FieldLabel>
          <div className="mt-1">
            <div className="flex min-h-[48px] items-center gap-3 border-b border-line text-[16px]">
              <span className="flex h-[24px] w-[24px] flex-none items-center justify-center rounded-full bg-surface-2 text-[12px] font-bold text-fg2">✓</span>
              <span className="flex-1">Time</span>
              <span className="text-[13px] text-fg2">always</span>
            </div>
            {CARDIO_COLUMN_INFO.map((c) => {
              const n = columns.indexOf(c.id);
              const full = n < 0 && columns.length >= MAX_CARDIO_COLUMNS;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="checkbox"
                  aria-checked={n >= 0}
                  disabled={full}
                  onClick={() => toggleColumn(c.id)}
                  className="flex min-h-[48px] w-full items-center gap-3 border-b border-line text-left text-[16px] disabled:opacity-40"
                >
                  <span
                    className={cx(
                      'flex h-[24px] w-[24px] flex-none items-center justify-center rounded-full text-[12px] font-bold',
                      n >= 0 ? 'bg-accent text-white' : 'border-[1.5px] border-fg3',
                    )}
                  >
                    {n >= 0 ? n + 1 : ''}
                  </span>
                  <span className="flex-1">{c.label}</span>
                  <span className="text-[13px] text-fg2">{columnUnitHint(c.id, spec, units)}</span>
                </button>
              );
            })}
          </div>

          <FieldLabel>Preview</FieldLabel>
          <div
            className="mt-1.5 grid h-10 items-center gap-1 rounded-[10px] bg-surface px-2 text-center text-[11px] font-bold tracking-[0.06em] text-fg2"
            style={{ gridTemplateColumns: `24px repeat(${columns.length + 1}, minmax(0,1fr)) 28px` }}
          >
            <span>#</span>
            {(['time', ...columns] as const).map((c) => (
              <span key={c} className="truncate">
                {columnHeader(c, spec, units)}
              </span>
            ))}
            <span>✓</span>
          </div>

          {columns.includes('distance') && (
            <>
              <FieldLabel>Distance in</FieldLabel>
              <Chips
                wrap
                className="mt-2"
                options={[
                  { value: 'auto' as const, label: units === 'kg' ? 'Kilometers' : 'Miles' },
                  { value: 'm' as const, label: 'Meters' },
                ]}
                value={distanceUnit}
                onChange={setDistanceUnit}
              />
              <Note>Miles or kilometers follow your units setting. Meters suit a rower.</Note>
              <div className="mt-4 flex min-h-[52px] items-center gap-3 border-y border-line">
                <span className="min-w-0 flex-1">
                  <b className="block text-[16px] font-semibold">Running</b>
                  <span className="text-[13px] text-fg2">Counts toward distance records (1 mile, 5K…)</span>
                </span>
                <Toggle on={isRun} onChange={setIsRun} label="Running" />
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <FieldLabel>Muscle</FieldLabel>
          <Chips wrap className="mt-2" options={MUSCLES.map((m) => ({ value: m.id, label: m.label }))} value={muscle} onChange={setMuscle} />

          <FieldLabel>Equipment</FieldLabel>
          <Chips wrap className={cx('mt-2')} options={EQUIPMENT.map((m) => ({ value: m.id, label: m.label }))} value={equipment} onChange={setEquipment} />
        </>
      )}
    </Screen>
  );
}
