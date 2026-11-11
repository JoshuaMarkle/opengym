import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { MoreGlyph, StarGlyph } from '../../components/icons';
import { Sheet, SheetOption, useToast } from '../../components/overlays';
import { useNumberPad } from '../../components/useNumberPad';
import { AttentionNote, BackButton, BarButton, BarChip, Button, DetailTitle, FieldLabel, MacroRing, PickerBox, Screen, TextButton, TopBar, ValueButton } from '../../components/ui';
import { copyFood, deleteEntries, logFood, quickAmount, removeFromLibrary, restoreEntries, starFood, updateEntry, type LogAmount } from '../../data/food';
import { useDayTargets } from '../../data/useFood';
import { db } from '../../db/db';
import type { AmountUnit, Food, FoodEntry, FoodServing, MealId } from '../../db/types';
import { useGiveUp } from '../../hooks/useGiveUp';
import { formatNumber } from '../../lib/units';
import { fmtInt, fromGrams, MEAL_LABEL, needsFill, roundAmount, scaleNutrients, servingText, STEP, toGrams, totalsFor, unitLabel, type Nutrients } from '../../lib/nutrition';
import { useAddTarget } from './AddFood';
import { MealSheet, NutrientTable, sourceLabel } from './parts';

/** The servings without the leading "1 ": "cup", "bar", "medium (7" long)". */
const servingUnit = (s: FoodServing | undefined) => (s ? s.label.replace(/^1\s+/, '') : 'serving');

interface Amount {
  text: string;
  unit: AmountUnit;
  serving: number;
}

function amountFrom(a: LogAmount, basis: 'g' | 'ml', servings: FoodServing[]): Amount {
  const serving = a.serving ?? 0;
  const v = fromGrams(a.grams, a.unit, basis, servings[serving]?.grams);
  return { text: formatNumber(roundAmount(v, a.unit), 2), unit: a.unit, serving };
}

function gramsOf(a: Amount, basis: 'g' | 'ml', servings: FoodServing[]): number {
  return toGrams(Number(a.text) || 0, a.unit, basis, servings[a.serving]?.grams);
}

/**
 * 10.16–10.17 A food (design/proposals/nutrition.html C2 / F1): name and source, the macro ring
 * for the amount, Amount (typed on the keypad dock: g / serv / oz, ± steps, ½) and Meal, then
 * every nutrient with % of your own target. Adding: the keypad opens on Amount and its confirm
 * logs; the footer Log does the same once the keypad is closed. Star keeps it in Saved.
 */
export function FoodItem() {
  const { foodId = '' } = useParams();
  const location = useLocation();
  const passed = (location.state as { food?: Food } | null)?.food;
  const stored = useLiveQuery(async () => (await db.foods.get(foodId)) ?? null, [foodId]);
  const food = stored ?? (passed?.id === foodId ? passed : undefined);
  const gone = useGiveUp(stored === null && !food);
  const navigate = useNavigate();
  if (gone) {
    navigate(-1);
    return null;
  }
  if (!food) return null;
  return <AddMode food={food} saved={!!stored} />;
}

function AddMode({ food, saved }: { food: Food; saved: boolean }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { day, meal: startMeal } = useAddTarget();
  const [meal, setMeal] = useState<MealId>(startMeal);
  const [amount, setAmount] = useState<Amount>(() => amountFrom(quickAmount(food), food.basis, food.servings));
  const grams = gramsOf(amount, food.basis, food.servings);
  const log = async () => {
    if (!(grams > 0)) return;
    const e = await logFood(food, day, meal, { grams, unit: amount.unit, ...(amount.unit === 'serv' ? { serving: amount.serving } : {}) });
    toast({ message: `Added to ${MEAL_LABEL[meal]} · ${fmtInt(e.totals.kcal ?? 0)} kcal`, actionLabel: 'Undo', onAction: () => void deleteEntries([e.id]) });
    navigate(-1);
  };
  return (
    <FoodView
      day={day}
      food={food}
      saved={saved}
      per100={food.per100}
      estimated={food.estimated}
      meal={meal}
      setMeal={setMeal}
      amount={amount}
      setAmount={setAmount}
      startOpen
      onConfirm={log}
      confirmLabel="Log"
      left={<BackButton label="Back" onClick={() => navigate(-1)} />}
    />
  );
}

/**
 * 10.18 A logged food (nutrition-plan §3.6): the inspector in edit mode. Amount and Meal change
 * the entry (the snapshot scales; the food itself is never re-read), Save top right, ••• Delete.
 * A quick add has no amount: only its meal moves.
 */
export function EntryItem() {
  const { entryId = '' } = useParams();
  const entry = useLiveQuery(async () => (await db.foodEntries.get(entryId)) ?? null, [entryId]);
  const food = useLiveQuery(async () => (entry?.foodId ? ((await db.foods.get(entry.foodId)) ?? null) : null), [entry?.foodId]);
  const gone = useGiveUp(entry === null);
  const navigate = useNavigate();
  if (gone) {
    navigate(-1);
    return null;
  }
  if (!entry || food === undefined) return null;
  return <EditMode entry={entry} food={food} />;
}

function EditMode({ entry, food }: { entry: FoodEntry; food: Food | null }) {
  const navigate = useNavigate();
  const toast = useToast();
  const servings = entry.servings ?? food?.servings ?? [];
  const basis = entry.basis ?? food?.basis ?? 'g';
  const [meal, setMeal] = useState<MealId>(entry.meal);
  const [amount, setAmount] = useState<Amount>(() => amountFrom({ grams: entry.grams ?? 100, unit: entry.unit ?? 'g', serving: entry.serving }, basis, servings));
  // The entry's own snapshot per 100 g: editing the food later never rewrites this day.
  const per100: Nutrients = entry.grams ? scaleNutrients(entry.totals, 100 / entry.grams) : entry.totals;
  const save = async () => {
    const grams = gramsOf(amount, basis, servings);
    await updateEntry(entry.id, { meal, ...(entry.grams && grams > 0 ? { amount: { grams, unit: amount.unit, ...(amount.unit === 'serv' ? { serving: amount.serving } : {}) } } : {}) });
    navigate(-1);
  };
  const remove = async () => {
    const gone = await deleteEntries([entry.id]);
    toast({ message: `Deleted ${entry.name}`, actionLabel: 'Undo', onAction: () => void restoreEntries(gone) });
    navigate(-1);
  };
  const shown: Food = food ?? { id: '', createdAt: 0, updatedAt: 0, name: entry.name, brand: entry.brand, source: 'custom', basis, per100, servings };
  return (
    <FoodView
      day={entry.day}
      food={{ ...shown, name: entry.name }}
      saved={!!food}
      per100={per100}
      estimated={entry.estimated}
      meal={meal}
      setMeal={setMeal}
      amount={entry.grams ? amount : undefined}
      setAmount={setAmount}
      servingsOverride={servings}
      quick={entry.quick}
      left={<BackButton label={MEAL_LABEL[entry.meal]} onClick={() => navigate(-1)} />}
      save={save}
      onDelete={remove}
    />
  );
}

function FoodView({
  food,
  saved,
  per100,
  estimated,
  meal,
  setMeal,
  amount,
  setAmount,
  startOpen,
  onConfirm,
  confirmLabel,
  left,
  save,
  onDelete,
  servingsOverride,
  quick,
  day,
}: {
  day: string;
  food: Food;
  saved: boolean;
  per100: Nutrients;
  estimated?: Food['estimated'];
  meal: MealId;
  setMeal: (m: MealId) => void;
  amount?: Amount;
  setAmount: (a: Amount) => void;
  startOpen?: boolean;
  onConfirm?: () => void;
  confirmLabel?: string;
  left: React.ReactNode;
  save?: () => void;
  onDelete?: () => void;
  servingsOverride?: FoodServing[];
  quick?: boolean;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const targets = useDayTargets(day);
  const [mealSheet, setMealSheet] = useState(false);
  const [more, setMore] = useState(false);
  const [servingSheet, setServingSheet] = useState(false);
  const servings = servingsOverride ?? food.servings;
  const basis = food.basis;
  const grams = amount ? gramsOf(amount, basis, servings) : 0;
  const totals = amount ? totalsFor(per100, grams) : per100;
  const units: AmountUnit[] = servings.length ? ['g', 'serv', 'oz'] : ['g', 'oz'];

  const pad = useNumberPad(
    amount
      ? [
          {
            id: 'amount',
            label:
              amount.unit === 'serv' && servings.length > 1 ? (
                <BarChip label={servings[amount.serving]?.label ?? 'Serving'} onPress={() => setServingSheet(true)} ariaLabel="Serving size" />
              ) : (
                'Amount'
              ),
            value: amount.text,
            onChange: (text) => setAmount({ ...amount, text }),
            step: STEP[amount.unit],
            stepLabel: amount.unit === 'serv' ? '¼' : `${STEP[amount.unit]} ${unitLabel(amount.unit, basis)}`,
            half: amount.unit === 'serv',
            tabs: units.map((u) => ({ id: u, label: unitLabel(u, basis) })),
            tab: amount.unit,
            onTab: (u) => {
              const unit = u as AmountUnit;
              const g = gramsOf(amount, basis, servings);
              const v = fromGrams(g, unit, basis, servings[amount.serving]?.grams);
              setAmount({ ...amount, unit, text: g > 0 ? formatNumber(roundAmount(v, unit), 2) : '' });
            },
          },
        ]
      : [],
    { onDone: onConfirm ?? (() => undefined), doneLabel: confirmLabel, doneAria: confirmLabel ? `${confirmLabel} this food` : 'Done' },
  );
  // C2: adding opens straight on the amount.
  const [opened, setOpened] = useState(false);
  if (startOpen && !opened && amount) {
    setOpened(true);
    pad.open('amount');
  }

  const kcal = totals.kcal ?? 0;
  const gramsTriple: [number, number, number] = [totals.p ?? 0, totals.c ?? 0, totals.f ?? 0];
  const meta = [sourceLabel(food), food.source === 'usda' ? food.detail : undefined].filter(Boolean).join(' · ');
  const editable = food.source === 'custom' && saved;

  const menu: { label: string; onClick: () => void; tone?: 'danger' }[] = [];
  if (food.id && saved) {
    if (editable) menu.push({ label: 'Edit food', onClick: () => navigate(`/food/edit/${food.id}`) });
    else
      menu.push({
        label: 'Make a copy to edit',
        onClick: async () => {
          const id = await copyFood(food.id);
          if (id) navigate(`/food/edit/${id}`);
        },
      });
    if (food.mine || food.source === 'custom')
      menu.push({
        label: 'Remove from my foods',
        onClick: async () => {
          await removeFromLibrary(food.id);
          toast({ message: `Removed ${food.name} from your foods` });
        },
      });
  }
  if (onDelete) menu.push({ label: 'Delete', tone: 'danger', onClick: onDelete });

  const favorite = !!food.favorite;
  return (
    <Screen
      header={
        <TopBar
          left={left}
          right={
            <span className="flex items-center">
              {food.id && !quick && (
                <button type="button" aria-label={favorite ? 'Unstar' : 'Star'} aria-pressed={favorite} onClick={() => void starFood(food, !favorite)} className="flex h-11 w-11 items-center justify-center text-accent active:opacity-60">
                  <StarGlyph size={20} filled={favorite} />
                </button>
              )}
              {menu.length > 0 && (
                <button type="button" aria-label="More" onClick={() => setMore(true)} className="flex h-11 w-11 items-center justify-center text-accent active:opacity-60">
                  <MoreGlyph size={20} />
                </button>
              )}
              {save && (
                <BarButton kind="bold" onClick={save}>
                  Save
                </BarButton>
              )}
            </span>
          }
        />
      }
      footer={
        pad.pad ??
        (onConfirm ? (
          <div className="border-t border-line px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
            <Button className="w-full" disabled={!(grams > 0)} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        ) : undefined)
      }
    >
      <DetailTitle title={food.name} meta={quick ? 'Quick add' : meta} className="mt-5" />
      <MacroRing kcal={kcal} grams={gramsTriple} className="mt-4" />
      <div className="mt-4 grid grid-cols-2 gap-2">
        {amount ? (
          <div>
            <FieldLabel className="mt-0">Amount</FieldLabel>
            <ValueButton
              label="Amount"
              value={amount.text}
              unit={amount.unit === 'serv' ? servingUnit(servings[amount.serving]) : unitLabel(amount.unit, basis)}
              on={pad.active === 'amount'}
              onClick={() => pad.open('amount')}
            />
          </div>
        ) : (
          <div />
        )}
        <div>
          <FieldLabel className="mt-0">Meal</FieldLabel>
          <PickerBox label="Meal" onClick={() => setMealSheet(true)}>
            {MEAL_LABEL[meal]}
          </PickerBox>
        </div>
      </div>
      {amount?.unit === 'serv' && servings[amount.serving] && <p className="mt-2 text-caption text-fg2">{`${servingText(Number(amount.text) || 0, servings[amount.serving].label)} · ${fmtInt(grams)} ${basis === 'ml' ? 'ml' : 'g'}`}</p>}

      {saved && needsFill(food) && (
        <AttentionNote lead="Missing most vitamins and minerals." className="mt-5" actions={<TextButton small onClick={() => navigate(`/food/fill/${food.id}`)}>Fill in missing nutrients</TextButton>}>
          Borrow them from a similar built-in food. They're marked ~.
        </AttentionNote>
      )}

      {targets && <NutrientTable totals={totals} estimated={estimated} targets={targets} />}

      <MealSheet open={mealSheet} value={meal} onPick={setMeal} onClose={() => setMealSheet(false)} />
      <Sheet open={more} onClose={() => setMore(false)} title={food.name}>
        {menu.map((m) => (
          <SheetOption
            key={m.label}
            tone={m.tone}
            onClick={() => {
              setMore(false);
              m.onClick();
            }}
          >
            {m.label}
          </SheetOption>
        ))}
      </Sheet>
      <Sheet open={servingSheet} onClose={() => setServingSheet(false)} title="Serving">
        {servings.map((s, i) => (
          <SheetOption
            key={s.label}
            detail={`${formatNumber(s.grams, 1)} ${basis === 'ml' ? 'ml' : 'g'}`}
            onClick={() => {
              if (amount) setAmount({ ...amount, unit: 'serv', serving: i, text: '1' });
              setServingSheet(false);
            }}
          >
            {s.label}
          </SheetOption>
        ))}
      </Sheet>
    </Screen>
  );
}
