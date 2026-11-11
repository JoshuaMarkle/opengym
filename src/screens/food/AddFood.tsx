import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { BarcodeGlyph, BoltGlyph, ChevronDown, PencilGlyph, StackGlyph } from '../../components/icons';
import { useToast } from '../../components/overlays';
import { AddButton, BarButton, Chips, Note, Row, Screen, SearchField, SectionLabel, ShortcutTile, TopBar } from '../../components/ui';
import { copyEntries, deleteEntries, logFood, logSavedMeal, quickAmount, removeBatch, restoreEntries, searchLocal } from '../../data/food';
import { ensureFoodDb, useFoodDb } from '../../data/foodDb';
import { isOnline, searchOff } from '../../data/openFoodFacts';
import { useFoodSettings, useSavedMeals } from '../../data/useFood';
import { db } from '../../db/db';
import type { Food, FoodEntry, MealId, SavedMeal } from '../../db/types';
import { fmtInt, foodDayKey, MEAL_LABEL, mealForTime, mergeOnline, recentFoods, shiftDay, totalsFor, usuallyAt, wantsOnline, type Nutrients } from '../../lib/nutrition';
import { FoodRow, MealSheet, quickLabel } from './parts';

type Tab = 'recent' | 'saved' | 'mine' | 'meals';
const TABS: { value: Tab; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'saved', label: 'Saved' },
  { value: 'mine', label: 'My foods' },
  { value: 'meals', label: 'Meals' },
];

const isMeal = (m: string | null): m is MealId => m === 'breakfast' || m === 'lunch' || m === 'dinner' || m === 'snacks';

/** The day and meal an add screen logs into, from `?day=&meal=` (today and the meal of the moment by default). */
export function useAddTarget() {
  const [params] = useSearchParams();
  const now = Date.now();
  const day = params.get('day') ?? foodDayKey(now);
  const meal: MealId = isMeal(params.get('meal')) ? (params.get('meal') as MealId) : mealForTime(now);
  return { day, meal, query: `day=${day}&meal=${meal}` };
}

/**
 * 10.14–10.15, 10.22 Add food (design/proposals/nutrition.html C1, D5; nutrition-plan §3.5): the
 * meal picker is the title, then search with the barcode, four shortcuts and the filter chips.
 * The + disc logs your last amount right away and turns into a check; the check takes it back
 * off. Tapping a row opens the amount (10.16). Cancel turns into Done once something is added;
 * either way nothing is lost, because every add saves at once.
 */
export function AddFood() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const fs = useFoodSettings();
  const { day, meal } = useAddTarget();
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) || 'recent');
  const [query, setQuery] = useState('');
  const [mealSheet, setMealSheet] = useState(false);
  const foodDb = useFoodDb();

  // Everything logged into this meal since the screen opened shows as added (survives a visit to 10.16).
  const since = (location.state as { since?: number } | null)?.since;
  useEffect(() => {
    if (since == null) navigate(`${location.pathname}${location.search}`, { replace: true, state: { since: Date.now() - 1 } });
    void ensureFoodDb();
  }, [since, navigate, location.pathname, location.search]);
  const added = useLiveQuery(async () => (since == null ? [] : (await db.foodEntries.where('[day+meal]').equals([day, meal]).toArray()).filter((e) => e.createdAt >= since)), [day, meal, since], []);
  const addedByFood = new Map(added.filter((e) => e.foodId && !e.batchId).map((e) => [e.foodId!, e]));
  const addedBatches = new Map<string, FoodEntry[]>();
  for (const e of added) if (e.batchId) addedBatches.set(e.batchId, [...(addedBatches.get(e.batchId) ?? []), e]);

  const recent = useLiveQuery(() => db.foodEntries.where('loggedAt').above(Date.now() - 60 * 86_400_000).toArray(), [], []);
  const usual = useMemo(() => usuallyAt(recent, meal, Date.now()), [recent, meal]);
  const recentIds = useMemo(() => recentFoods(recent).filter((id) => !usual.includes(id)), [recent, usual]);
  const listed = useLiveQuery(
    async (): Promise<Food[]> => {
      if (tab === 'saved') return (await db.foods.filter((f) => !!f.favorite && !f.deletedAt).toArray()).sort((a, b) => a.name.localeCompare(b.name));
      if (tab === 'mine') return (await db.foods.filter((f) => (!!f.mine || f.source === 'custom') && !f.deletedAt).toArray()).sort((a, b) => a.name.localeCompare(b.name));
      return (await db.foods.bulkGet([...usual, ...recentIds])).filter((f): f is Food => !!f && !f.deletedAt);
    },
    [tab, usual.join(), recentIds.join()],
    [],
  );

  // Search: local as you type, Open Food Facts after a 500 ms pause when local finds fewer than 8.
  const [local, setLocal] = useState<Food[]>([]);
  const [online, setOnline] = useState<{ q: string; foods: Food[]; failed?: boolean }>({ q: '', foods: [] });
  const q = query.trim();
  useEffect(() => {
    if (!q) return setLocal([]);
    let live = true;
    const t = window.setTimeout(() => void searchLocal(q).then((r) => live && setLocal(r)), 120);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [q, foodDb.status]);
  const wantOnline = !!q && fs.online && wantsOnline(q, local.length);
  useEffect(() => {
    if (!wantOnline) return;
    const ctl = new AbortController();
    const t = window.setTimeout(() => {
      if (!isOnline()) return setOnline({ q, foods: [], failed: true });
      searchOff(q, ctl.signal)
        .then((foods) => setOnline({ q, foods }))
        .catch(() => !ctl.signal.aborted && setOnline({ q, foods: [], failed: true }));
    }, 500);
    return () => {
      ctl.abort();
      window.clearTimeout(t);
    };
  }, [q, wantOnline]);
  const onlineFoods = online.q === q && wantOnline ? mergeOnline(local, online.foods) : [];
  const offline = !!q && fs.online && online.q === q && online.failed;

  const add = async (food: Food) => {
    const a = quickAmount(food);
    const e = await logFood(food, day, meal, a);
    toast({ message: `Added to ${MEAL_LABEL[meal]} · ${fmtInt(e.totals.kcal ?? 0)} kcal`, actionLabel: 'Undo', onAction: () => void deleteEntries([e.id]) });
  };
  const takeBack = async (rows: FoodEntry[], name: string) => {
    const gone = await deleteEntries(rows.map((r) => r.id));
    toast({ message: `Removed ${name}`, actionLabel: 'Undo', onAction: () => void restoreEntries(gone) });
  };
  const open = (food: Food) => {
    // Online results aren't stored until you log or star them; the amount screen gets them through state.
    navigate(`/food/item/${encodeURIComponent(food.id)}?day=${day}&meal=${meal}`, { state: food.source === 'off' ? { food } : undefined });
  };

  const row = (food: Food) => {
    const a = quickAmount(food);
    const e = addedByFood.get(food.id);
    return (
      <FoodRow
        key={food.id}
        title={food.name}
        detail={[food.brand, quickLabel(food, a)].filter(Boolean).join(' · ')}
        totals={totalsFor(food.per100, a.grams)}
        added={!!e}
        onOpen={() => open(food)}
        onDisc={() => void (e ? takeBack([e], food.name) : add(food))}
        discLabel={e ? `Remove ${food.name}` : `Add ${food.name}`}
      />
    );
  };

  const anyAdded = added.length > 0;
  const loading = foodDb.status === 'loading';

  return (
    <Screen
      header={
        <TopBar
          left={
            <BarButton kind={anyAdded ? 'bold' : 'muted'} onClick={() => navigate(-1)}>
              {anyAdded ? 'Done' : 'Cancel'}
            </BarButton>
          }
          title={
            <button type="button" onClick={() => setMealSheet(true)} className="-my-3 inline-flex min-h-11 items-center gap-1.5" aria-label={`Meal: ${MEAL_LABEL[meal]}`}>
              {MEAL_LABEL[meal]}
              <ChevronDown size={9} className="text-fg2" />
            </button>
          }
        />
      }
    >
      <div className="mt-4">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search foods"
          trailing={
            <button type="button" aria-label="Scan a barcode" onClick={() => navigate(`/food/scan?day=${day}&meal=${meal}`)} className="-mr-2 flex h-10 w-10 items-center justify-center text-accent">
              <BarcodeGlyph size={20} />
            </button>
          }
        />
      </div>
      {loading && <Note className="mt-2">Getting the food database ready{foodDb.total ? ` · ${Math.round((foodDb.done / foodDb.total) * 100)}%` : ''}. Your own foods work already.</Note>}

      {!q && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          <ShortcutTile icon={<BarcodeGlyph size={20} />} onClick={() => navigate(`/food/scan?day=${day}&meal=${meal}`)}>
            Scan
          </ShortcutTile>
          <ShortcutTile icon={<BoltGlyph size={20} />} onClick={() => navigate(`/food/quick?day=${day}&meal=${meal}`)}>
            Quick add
          </ShortcutTile>
          <ShortcutTile icon={<StackGlyph size={20} />} onClick={() => setTab('meals')}>
            Meals
          </ShortcutTile>
          <ShortcutTile icon={<PencilGlyph size={20} />} onClick={() => navigate(`/food/new?day=${day}&meal=${meal}`)}>
            New food
          </ShortcutTile>
        </div>
      )}

      {!q && (
        <Chips
          className="mt-3"
          options={TABS}
          value={tab}
          onChange={(t) => {
            setTab(t);
            setParams((p) => (p.set('tab', t), p), { replace: true, state: location.state });
          }}
        />
      )}

      {q ? (
        <>
          <SectionLabel>Results</SectionLabel>
          {local.map(row)}
          {!local.length && !onlineFoods.length && <Note className="mt-3">{loading ? 'Still loading the food database.' : `Nothing called "${q}" yet.`}</Note>}
          {offline && <Note className="mt-3">Offline · showing your foods</Note>}
          {onlineFoods.length > 0 && (
            <>
              <SectionLabel>Online</SectionLabel>
              {onlineFoods.map(row)}
            </>
          )}
          <AddButton className="mt-3 w-full" onClick={() => navigate(`/food/new?day=${day}&meal=${meal}&name=${encodeURIComponent(q)}`)}>
            New food "{q}"
          </AddButton>
        </>
      ) : tab === 'meals' ? (
        <MealsTab day={day} meal={meal} batches={addedBatches} onTakeBack={takeBack} />
      ) : tab === 'recent' ? (
        <>
          {usual.length > 0 && <SectionLabel>Usually at {MEAL_LABEL[meal].toLowerCase()}</SectionLabel>}
          {listed.filter((f) => usual.includes(f.id)).map(row)}
          <SectionLabel>Recent</SectionLabel>
          {listed.filter((f) => !usual.includes(f.id)).map(row)}
          {!listed.length && <Note className="mt-3">Foods you log show up here. Search, scan, or make your own.</Note>}
        </>
      ) : (
        <>
          <SectionLabel>{tab === 'saved' ? 'Saved' : 'My foods'}</SectionLabel>
          {listed.map(row)}
          {!listed.length && <Note className="mt-3">{tab === 'saved' ? 'Star a food to keep it here.' : 'Foods you make, scan or log show up here.'}</Note>}
        </>
      )}

      <MealSheet open={mealSheet} value={meal} onClose={() => setMealSheet(false)} onPick={(m) => setParams((p) => (p.set('meal', m), p), { replace: true, state: location.state })} />
    </Screen>
  );
}

/**
 * 10.22 Meals (board D5): + logs a whole saved meal into this meal as one entry per food; the
 * check takes the group back off. Then Copy a day: yesterday's same meal in one tap, or a whole
 * past day (10.23).
 */
function MealsTab({ day, meal, batches, onTakeBack }: { day: string; meal: MealId; batches: Map<string, FoodEntry[]>; onTakeBack: (rows: FoodEntry[], name: string) => Promise<void> }) {
  const navigate = useNavigate();
  const toast = useToast();
  const meals = useSavedMeals() ?? [];
  const foods = useLiveQuery(async () => new Map((await db.foods.bulkGet([...new Set(meals.flatMap((m) => m.items.map((i) => i.foodId)))])).filter((f): f is Food => !!f).map((f) => [f.id, f])), [meals], new Map<string, Food>());
  const yesterday = shiftDay(day, -1);
  const prev = useLiveQuery(() => db.foodEntries.where('[day+meal]').equals([yesterday, meal]).sortBy('order'), [yesterday, meal], []);

  const totalsOf = (m: SavedMeal): Nutrients => {
    const t: Nutrients = {};
    for (const it of m.items) {
      const f = foods.get(it.foodId);
      if (!f) continue;
      for (const [k, v] of Object.entries(totalsFor(f.per100, it.grams))) t[k as keyof Nutrients] = (t[k as keyof Nutrients] ?? 0) + (v ?? 0);
    }
    return t;
  };
  const batchFor = (pred: (rows: FoodEntry[]) => boolean) => [...batches.values()].find(pred);
  const sumRows = (rows: FoodEntry[]): Nutrients => rows.reduce<Nutrients>((t, r) => {
    for (const [k, v] of Object.entries(r.totals)) t[k as keyof Nutrients] = (t[k as keyof Nutrients] ?? 0) + (v ?? 0);
    return t;
  }, {});

  const prevBatch = batchFor((rows) => rows.every((r) => !r.savedMealId) && rows.length === prev.length);
  return (
    <>
      <SectionLabel>Saved meals</SectionLabel>
      {meals.map((m) => {
        const b = batchFor((rows) => rows[0]?.savedMealId === m.id);
        return (
          <FoodRow
            key={m.id}
            title={m.name}
            detail={`${m.items.length} ${m.items.length === 1 ? 'food' : 'foods'}`}
            totals={totalsOf(m)}
            added={!!b}
            onOpen={() => navigate(`/food/meal/${m.id}`)}
            onDisc={async () => {
              if (b) {
                await removeBatch(b[0].batchId!);
                toast({ message: `Removed ${m.name}`, actionLabel: 'Undo', onAction: () => void restoreEntries(b) });
              } else {
                const r = await logSavedMeal(m, day, meal);
                toast({ message: `Added to ${MEAL_LABEL[meal]} · ${fmtInt(r.kcal)} kcal`, actionLabel: 'Undo', onAction: () => void removeBatch(r.batchId) });
              }
            }}
            discLabel={b ? `Remove ${m.name}` : `Add ${m.name}`}
          />
        );
      })}
      {!meals.length && <Note className="mt-3">Save foods you eat together as a meal, then log them in one tap.</Note>}
      <AddButton className="mt-3 w-full" onClick={() => navigate('/food/meal/new')}>
        New meal
      </AddButton>

      <SectionLabel>Copy a day</SectionLabel>
      {prev.length > 0 && (
        <FoodRow
          title={`Yesterday's ${MEAL_LABEL[meal].toLowerCase()}`}
          detail={`${prev.length} ${prev.length === 1 ? 'food' : 'foods'}`}
          totals={sumRows(prev)}
          added={!!prevBatch}
          onDisc={async () => {
            if (prevBatch) await onTakeBack(prevBatch, `yesterday's ${MEAL_LABEL[meal].toLowerCase()}`);
            else {
              const r = await copyEntries(prev, day, meal);
              toast({ message: `Added to ${MEAL_LABEL[meal]} · ${fmtInt(r.kcal)} kcal`, actionLabel: 'Undo', onAction: () => void removeBatch(r.batchId) });
            }
          }}
          discLabel={prevBatch ? `Remove yesterday's ${MEAL_LABEL[meal]}` : `Add yesterday's ${MEAL_LABEL[meal]}`}
        />
      )}
      <Row chevron onClick={() => navigate(`/food/copy-day?day=${day}`)}>
        <span className="flex-1 text-body-lg">All of a past day</span>
      </Row>
    </>
  );
}
