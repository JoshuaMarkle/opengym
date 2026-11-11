import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useNumberPad, type PadField } from '../../components/useNumberPad';
import { BarButton, CompactSegmented, FieldLabel, FolderChevron, FolderLabel, InfoRow, InlineValue, Note, Row, Screen, SectionLabel, TextField, TopBar } from '../../components/ui';
import { saveFood } from '../../data/food';
import { db } from '../../db/db';
import type { Food } from '../../db/types';
import { formatNumber } from '../../lib/units';
import { fmtAmount, GROUPS, kcalMismatch, NUTRIENT, NUTRIENTS, parseAmount, per100ToServing, perServingTo100, sig3, type NutrientId, type Nutrients } from '../../lib/nutrition';

const MAIN: NutrientId[] = ['kcal', 'p', 'c', 'f'];
const MORE = NUTRIENTS.filter((n) => !MAIN.includes(n.id)).map((n) => n.id);

/**
 * 10.19 New / edit food (nutrition-plan §3.7, board D3 in v1): a nutrition label as rows. Name
 * and brand, the serving (label + grams), then calories and macros per serving as the label
 * prints them; "More nutrients" opens every other nutrient in the catalog. Stored per 100 g. A
 * quiet note when calories are more than 15% off 4·P + 4·C + 9·F; it never blocks saving.
 * From Add food, saving goes on to the amount (10.16) so the new food can be logged.
 */
export function FoodForm() {
  const { id } = useParams();
  const existing = useLiveQuery(async () => (id ? ((await db.foods.get(id)) ?? null) : null), [id]);
  if (id && existing === undefined) return null;
  return <Form key={id ?? 'new'} food={existing ?? undefined} />;
}

function Form({ food }: { food?: Food }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const day = params.get('day');
  const meal = params.get('meal');
  const si = food?.servings[food.defaultServing ?? 0] ? (food.defaultServing ?? 0) : 0;
  const s0 = food?.servings[si];
  const [name, setName] = useState(food?.name ?? params.get('name') ?? '');
  const [brand, setBrand] = useState(food?.brand ?? '');
  const [basis, setBasis] = useState<'g' | 'ml'>(food?.basis ?? 'g');
  const [servingLabel, setServingLabel] = useState(s0?.label ?? params.get('serving') ?? '1 serving');
  const [servingGrams, setServingGrams] = useState(s0 ? formatNumber(s0.grams, 1) : food ? '100' : (params.get('grams') ?? ''));
  const barcode = food?.barcode ?? params.get('barcode') ?? undefined;
  const [values, setValues] = useState<Partial<Record<NutrientId, string>>>(() => {
    if (!food) {
      const pre: Partial<Record<NutrientId, string>> = {};
      for (const k of MAIN) if (params.get(k)) pre[k] = params.get(k)!;
      return pre;
    }
    const per = per100ToServing(food.per100, s0?.grams ?? 100);
    return Object.fromEntries(Object.entries(per).map(([k, v]) => [k, fmtAmount(v!)])) as Partial<Record<NutrientId, string>>;
  });
  const [more, setMore] = useState(() => !!food && MORE.some((k) => food.per100[k] != null));

  const unit = basis === 'ml' ? 'ml' : 'g';
  const set = (k: NutrientId) => (v: string) => setValues((cur) => ({ ...cur, [k]: v }));
  const fields: PadField[] = [
    { id: 'grams', label: `Serving · ${unit}`, value: servingGrams, onChange: setServingGrams, step: 5, stepLabel: `5 ${unit}` },
    ...(more ? [...MAIN, ...MORE] : MAIN).map((k) => ({ id: k, label: k === 'kcal' ? 'Calories' : NUTRIENT[k].name, value: values[k] ?? '', onChange: set(k), step: k === 'kcal' ? 10 : 1, stepLabel: k === 'kcal' ? '10' : '1' })),
  ];
  const pad = useNumberPad(fields);

  const perServing: Nutrients = {};
  for (const [k, v] of Object.entries(values)) {
    const n = parseAmount(v ?? '');
    if (n != null) perServing[k as NutrientId] = n;
  }
  const grams = parseAmount(servingGrams) ?? 0;
  const ok = name.trim() && grams > 0 && perServing.kcal != null;
  const mismatch = kcalMismatch(perServing);

  const save = async () => {
    if (!ok) return;
    const per100: Nutrients = {};
    for (const [k, v] of Object.entries(perServingTo100(perServing, grams))) per100[k as NutrientId] = sig3(v!);
    const serving = { label: servingLabel.trim() || '1 serving', grams };
    const id = await saveFood({
      ...(food ?? {}),
      id: food?.id,
      name: name.trim(),
      brand: brand.trim() || undefined,
      source: 'custom',
      basis,
      per100,
      // Your own numbers: anything borrowed before is now yours.
      estimated: food?.estimated?.filter((k) => per100[k] != null && !(k in perServing)),
      // Editing changes the serving the numbers were typed against and keeps any others.
      servings: food?.servings.length ? food.servings.map((sv, i) => (i === si ? serving : sv)) : [serving],
      defaultServing: food?.servings.length ? si : 0,
      mine: true,
      ...(barcode ? { barcode } : {}),
    });
    if (!food && day && meal) navigate(`/food/item/${id}?day=${day}&meal=${meal}`, { replace: true });
    else navigate(-1);
  };

  // Labels print "Calories"; the catalog calls it Energy.
  const nameOf = (k: NutrientId) => (k === 'kcal' ? 'Calories' : NUTRIENT[k].name);
  const valueRow = (k: NutrientId, sub = false) => (
    <Row key={k} className={sub ? 'pl-4' : ''}>
      <span className={sub ? 'flex-1 text-body text-fg2' : 'flex-1 text-body-lg'}>{nameOf(k)}</span>
      <InlineValue label={nameOf(k)} value={values[k] ?? ''} unit={NUTRIENT[k].unit} on={pad.active === k} onClick={() => pad.open(k)} />
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
          title={food ? 'Edit food' : 'New food'}
          right={
            <BarButton kind="bold" disabled={!ok} onClick={() => void save()}>
              Save
            </BarButton>
          }
        />
      }
      footer={pad.pad}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Food name"
        aria-label="Food name"
        maxLength={80}
        autoFocus={!food && !name}
        enterKeyHint="done"
        onFocus={pad.close}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="mt-5 w-full bg-transparent text-title1 font-bold outline-none placeholder:text-fg3"
      />
      <FieldLabel>Brand · optional</FieldLabel>
      <TextField label="Brand" value={brand} onChange={setBrand} placeholder="None" />

      <SectionLabel>Serving</SectionLabel>
      <Row>
        <span className="flex-1 text-body-lg">Measured in</span>
        <CompactSegmented
          label="Measured in"
          value={basis}
          onChange={setBasis}
          options={[
            { value: 'g', label: 'Grams' },
            { value: 'ml', label: 'ml' },
          ]}
        />
      </Row>
      <Row>
        <input
          value={servingLabel}
          onChange={(e) => setServingLabel(e.target.value)}
          onFocus={pad.close}
          aria-label="Serving name"
          placeholder="1 serving"
          maxLength={40}
          enterKeyHint="done"
          className="min-w-0 flex-1 bg-transparent text-body-lg outline-none placeholder:text-fg3"
        />
        <InlineValue label="Serving size" value={servingGrams} unit={unit} on={pad.active === 'grams'} onClick={() => pad.open('grams')} />
      </Row>

      <SectionLabel action={<span className="text-caption font-normal tracking-normal text-fg2 normal-case">per serving, as on the label</span>}>Nutrition</SectionLabel>
      {MAIN.map((k) => valueRow(k))}
      {mismatch && <Note className="mt-2">Protein, carbs and fat add up to about {formatNumber(mismatch.fromMacros, 0)} kcal. Labels round, so check the numbers if this looks off.</Note>}

      <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className="mt-5 flex h-13 w-full items-center gap-2 border-y border-line text-left">
        <FolderChevron open={more} />
        <FolderLabel label="More nutrients" open={more} note="optional" />
      </button>
      {more &&
        GROUPS.map((g) => {
          const ids = MORE.filter((k) => NUTRIENT[k].group === g.id);
          if (!ids.length) return null;
          return (
            <section key={g.id}>
              <SectionLabel>{g.label}</SectionLabel>
              {ids.map((k) => valueRow(k, !!NUTRIENT[k].sub))}
            </section>
          );
        })}
      {barcode && (
        <div className="mt-5">
          <InfoRow label="Barcode" value={barcode} />
        </div>
      )}
    </Screen>
  );
}
