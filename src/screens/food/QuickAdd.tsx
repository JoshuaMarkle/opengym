import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useToast } from '../../components/overlays';
import { useNumberPad } from '../../components/useNumberPad';
import { BarButton, FieldLabel, InlineValue, MacroRing, Note, PickerBox, Row, Screen, TextField, TopBar } from '../../components/ui';
import { deleteEntries, quickAdd } from '../../data/food';
import type { MealId } from '../../db/types';
import { fmtInt, MEAL_LABEL, parseAmount, type Nutrients } from '../../lib/nutrition';
import { useAddTarget } from './AddFood';
import { MealSheet } from './parts';

/**
 * 10.20 Quick add (nutrition-plan §3.7, board D2 in v1): calories plus optional protein, carbs
 * and fat and an optional name, logged straight into the meal. It never enters your library.
 */
export function QuickAdd() {
  const navigate = useNavigate();
  const toast = useToast();
  const target = useAddTarget();
  const [meal, setMeal] = useState<MealId>(target.meal);
  const [mealSheet, setMealSheet] = useState(false);
  const [name, setName] = useState('');
  const [v, setV] = useState<Record<'kcal' | 'p' | 'c' | 'f', string>>({ kcal: '', p: '', c: '', f: '' });
  const set = (k: keyof typeof v) => (s: string) => setV((cur) => ({ ...cur, [k]: s }));
  const values: Nutrients = {};
  for (const k of ['kcal', 'p', 'c', 'f'] as const) {
    const n = parseAmount(v[k]);
    if (n != null) values[k] = n;
  }
  const ok = (values.kcal ?? 0) > 0;
  const log = async () => {
    if (!ok) return;
    const e = await quickAdd(target.day, meal, values, name);
    toast({ message: `Added to ${MEAL_LABEL[meal]} · ${fmtInt(values.kcal!)} kcal`, actionLabel: 'Undo', onAction: () => void deleteEntries([e.id]) });
    navigate(-1);
  };
  const pad = useNumberPad(
    [
      { id: 'kcal', label: 'Calories', value: v.kcal, onChange: set('kcal'), mode: 'int', step: 10, stepLabel: '10' },
      { id: 'p', label: 'Protein', value: v.p, onChange: set('p'), step: 1, stepLabel: '1 g' },
      { id: 'c', label: 'Carbs', value: v.c, onChange: set('c'), step: 1, stepLabel: '1 g' },
      { id: 'f', label: 'Fat', value: v.f, onChange: set('f'), step: 1, stepLabel: '1 g' },
    ],
    { onDone: () => void log(), doneLabel: 'Log', doneAria: 'Log this quick add' },
  );
  const [opened, setOpened] = useState(false);
  if (!opened) {
    setOpened(true);
    pad.open('kcal');
  }
  const row = (k: keyof typeof v, label: string, unit: string) => (
    <Row>
      <span className="flex-1 text-body-lg">
        {label}
        {k !== 'kcal' && <span className="text-fg2"> · optional</span>}
      </span>
      <InlineValue label={label} value={v[k]} unit={unit} on={pad.active === k} onClick={() => pad.open(k)} />
    </Row>
  );
  return (
    <Screen
      header={
        <TopBar
          left={
            <BarButton kind="muted" onClick={() => navigate(-1)}>
              Cancel
            </BarButton>
          }
          title="Quick add"
          right={
            <BarButton kind="bold" disabled={!ok} onClick={() => void log()}>
              Log
            </BarButton>
          }
        />
      }
      footer={pad.pad}
    >
      <MacroRing kcal={values.kcal ?? 0} grams={[values.p ?? 0, values.c ?? 0, values.f ?? 0]} className="mt-4" />
      <div className="mt-2">
        {row('kcal', 'Calories', 'kcal')}
        {row('p', 'Protein', 'g')}
        {row('c', 'Carbs', 'g')}
        {row('f', 'Fat', 'g')}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div>
          <FieldLabel className="mt-0">Name · optional</FieldLabel>
          <TextField label="Name" value={name} onChange={setName} placeholder="Quick add" />
        </div>
        <div>
          <FieldLabel className="mt-0">Meal</FieldLabel>
          <PickerBox label="Meal" onClick={() => setMealSheet(true)}>
            {MEAL_LABEL[meal]}
          </PickerBox>
        </div>
      </div>
      <Note className="mt-3">For a meal out or a snack you won't log again. It shows in the day but not in your foods.</Note>
      <MealSheet open={mealSheet} value={meal} onPick={setMeal} onClose={() => setMealSheet(false)} />
    </Screen>
  );
}
