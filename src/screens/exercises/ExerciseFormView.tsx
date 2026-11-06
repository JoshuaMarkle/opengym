import { useState } from 'react';
import { BarButton, Chips, cx, FieldLabel, Note, Radio, Screen, TextField, TopBar } from '../../components/ui';
import { createExercise, nameTaken, updateExercise } from '../../data/exercises';
import { EQUIPMENT, EXERCISE_TYPES, MUSCLES, type Equipment, type Exercise, type ExerciseType, type Muscle } from '../../db/types';

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
      if (exercise) {
        await updateExercise(exercise.id, { name: n, type, muscle, equipment });
        onSaved(exercise.id);
      } else {
        onSaved(await createExercise({ name: n, type, muscle, equipment }));
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
        <Note>Changing the type changes which columns the set table shows. Past sets keep their numbers.</Note>
      )}

      <FieldLabel>Muscle</FieldLabel>
      <Chips wrap className="mt-2" options={MUSCLES.map((m) => ({ value: m.id, label: m.label }))} value={muscle} onChange={setMuscle} />

      <FieldLabel>Equipment</FieldLabel>
      <Chips wrap className={cx('mt-2')} options={EQUIPMENT.map((m) => ({ value: m.id, label: m.label }))} value={equipment} onChange={setEquipment} />
    </Screen>
  );
}
