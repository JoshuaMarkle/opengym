import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Alert, FullScreen, useToast } from '../../components/overlays';
import { useNumberPad } from '../../components/useNumberPad';
import { AddButton, BarButton, cx, DeleteDisc, DragHandle, InlineValue, MacroRing, Note, Screen, SearchField, SectionLabel, TextButton, TopBar } from '../../components/ui';
import { deleteSavedMeal, itemsFromEntries, quickAmount, saveSavedMeal, searchLocal } from '../../data/food';
import { db } from '../../db/db';
import type { Food, MealId, SavedMeal, SavedMealItem } from '../../db/types';
import { amountLabel, fmtInt, MEAL_LABEL, parseAmount, recentFoods, totalsFor, type Nutrients } from '../../lib/nutrition';
import { formatNumber } from '../../lib/units';
import { FoodRow } from './parts';

/**
 * 10.21 Saved meal (board D4), built like the routine builder: a Title 1 name, the ring card,
 * then the foods as dense rows with a delete disc and a drag handle, and a dashed "+ Add food".
 * Tap an amount to change it on the keypad. "Save as meal" from a day's meal folder opens this
 * filled with that meal's foods (`/food/meal/new?day&meal`).
 */
export function SavedMealScreen() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const day = params.get('day');
  const meal = params.get('meal') as MealId | null;
  const loaded = useLiveQuery(async () => {
    if (id && id !== 'new') return { meal: (await db.savedMeals.get(id)) ?? null, items: [] as SavedMealItem[] };
    const rows = day && meal ? await db.foodEntries.where('[day+meal]').equals([day, meal]).toArray() : [];
    return { meal: null, items: itemsFromEntries(rows) };
  }, [id, day, meal]);
  if (!loaded) return null;
  const name = loaded.meal?.name ?? (meal ? `My ${MEAL_LABEL[meal].toLowerCase()}` : '');
  return <Editor key={id ?? 'new'} saved={loaded.meal ?? undefined} initialName={name} initialItems={loaded.meal?.items ?? loaded.items} />;
}

interface Item extends SavedMealItem {
  key: string;
}

let keySeq = 0;
const withKey = (i: SavedMealItem): Item => ({ ...i, key: `i${++keySeq}` });

function Editor({ saved, initialName, initialItems }: { saved?: SavedMeal; initialName: string; initialItems: SavedMealItem[] }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState(initialName);
  const [items, setItems] = useState<Item[]>(() => initialItems.map(withKey));
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ids = [...new Set(items.map((i) => i.foodId))];
  const foods = useLiveQuery(async () => new Map((await db.foods.bulkGet(ids)).filter((f): f is Food => !!f).map((f) => [f.id, f])), [ids.join()], new Map<string, Food>());

  const sum: Nutrients = {};
  for (const it of items) {
    const f = foods.get(it.foodId);
    if (!f) continue;
    for (const [k, v] of Object.entries(totalsFor(f.per100, it.grams))) sum[k as keyof Nutrients] = (sum[k as keyof Nutrients] ?? 0) + (v ?? 0);
  }

  // Amounts on the keypad, in grams (or ml): the unit a saved meal is easiest to tune in.
  const pad = useNumberPad(
    items.map((it) => {
      const f = foods.get(it.foodId);
      return {
        id: it.key,
        label: `${f?.name ?? 'Food'} · ${f?.basis === 'ml' ? 'ml' : 'g'}`,
        value: formatNumber(it.grams, 1),
        step: 10,
        stepLabel: f?.basis === 'ml' ? '10 ml' : '10 g',
        onChange: (s: string) => {
          const g = parseAmount(s);
          setItems((cur) => cur.map((x) => (x.key === it.key ? { ...x, grams: g ?? 0, unit: 'g', serving: undefined } : x)));
        },
      };
    }),
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    setItems((cur) => arrayMove(cur, cur.findIndex((x) => x.key === e.active.id), cur.findIndex((x) => x.key === e.over!.id)));
  };

  const valid = items.filter((i) => i.grams > 0);
  const ok = !!name.trim() && valid.length > 0;
  const save = async () => {
    if (!ok) return;
    await saveSavedMeal({ id: saved?.id, name: name.trim(), items: valid.map(({ key: _, ...rest }) => rest) });
    toast({ message: saved ? `Saved ${name.trim()}` : `Saved ${name.trim()} · ${valid.length} ${valid.length === 1 ? 'food' : 'foods'}` });
    navigate(-1);
  };
  const remove = (key: string) => {
    const idx = items.findIndex((x) => x.key === key);
    const gone = items[idx];
    pad.close();
    setItems((cur) => cur.filter((x) => x.key !== key));
    toast({ message: `Removed ${foods.get(gone.foodId)?.name ?? 'food'}`, actionLabel: 'Undo', onAction: () => setItems((cur) => [...cur.slice(0, idx), gone, ...cur.slice(idx)]) });
  };

  return (
    <Screen
      header={
        <TopBar
          left={
            <BarButton kind="muted" onClick={() => navigate(-1)}>
              Cancel
            </BarButton>
          }
          title="Saved meal"
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
        onFocus={pad.close}
        placeholder="Meal name"
        aria-label="Meal name"
        maxLength={60}
        autoFocus={!name}
        enterKeyHint="done"
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="mt-5 w-full bg-transparent text-title1 font-bold outline-none placeholder:text-fg3"
      />
      <p className="mt-1 text-callout text-fg2">
        {items.length} {items.length === 1 ? 'food' : 'foods'}
      </p>
      <MacroRing kcal={sum.kcal ?? 0} grams={[sum.p ?? 0, sum.c ?? 0, sum.f ?? 0]} className="mt-4" />

      <SectionLabel>Foods</SectionLabel>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.key)} strategy={verticalListSortingStrategy}>
          {items.map((it) => (
            <ItemRow key={it.key} item={it} food={foods.get(it.foodId)} on={pad.active === it.key} onAmount={() => pad.open(it.key)} onRemove={() => remove(it.key)} />
          ))}
        </SortableContext>
      </DndContext>
      {!items.length && <Note className="mt-3">Add the foods you eat together. Logging the meal adds each one to the day, and you can change them there one by one.</Note>}
      <AddButton
        className="mt-3 w-full"
        onClick={() => {
          pad.close();
          setPicking(true);
        }}
      >
        Add food
      </AddButton>
      {saved && (
        <TextButton tone="danger" className="mt-6" onClick={() => setConfirmDelete(true)}>
          Delete meal
        </TextButton>
      )}

      <FullScreen open={picking}>
        <FoodPicker
          onClose={() => setPicking(false)}
          onPick={(f) => {
            const a = quickAmount(f);
            setItems((cur) => [...cur, withKey({ foodId: f.id, grams: a.grams, unit: a.unit, serving: a.serving })]);
            setPicking(false);
          }}
        />
      </FullScreen>
      <Alert
        open={confirmDelete}
        title={`Delete ${saved?.name}?`}
        message="Days you already logged it on keep their foods."
        onClose={() => setConfirmDelete(false)}
        actions={[
          {
            label: 'Delete',
            kind: 'danger',
            onClick: async () => {
              await deleteSavedMeal(saved!.id);
              setConfirmDelete(false);
              navigate(-1);
            },
          },
          { label: 'Cancel', onClick: () => setConfirmDelete(false) },
        ]}
      />
    </Screen>
  );
}

function ItemRow({ item, food, on, onAmount, onRemove }: { item: Item; food?: Food; on: boolean; onAmount: () => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.key });
  const t = food ? totalsFor(food.per100, item.grams) : {};
  const name = food?.name ?? 'Missing food';
  const amount = food ? amountLabel(item.grams, item.unit, food.basis, food.servings, item.serving) : '';
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cx('relative flex min-h-13 items-center gap-3 border-b border-line bg-bg py-1', isDragging && 'z-10 rounded-md border-transparent bg-surface px-2 ring-[1.5px] ring-accent')}
    >
      <DeleteDisc label={`Remove ${name}`} onClick={onRemove} />
      <span className="min-w-0 flex-1">
        <b className="block truncate text-body font-semibold">{name}</b>
        <span className="block truncate text-caption text-fg2">
          {amount} · {fmtInt(t.kcal ?? 0)} kcal
        </span>
      </span>
      <InlineValue label={`Amount of ${name}`} value={formatNumber(item.grams, 1)} unit={food?.basis === 'ml' ? 'ml' : 'g'} on={on} onClick={onAmount} />
      <DragHandle label={`Reorder ${name}`} handleRef={setActivatorNodeRef} {...attributes} {...listeners} />
    </div>
  );
}

/** Add food to a saved meal: search your foods and the built-in database; recent ones first. */
function FoodPicker({ onPick, onClose }: { onPick: (f: Food) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Food[]>([]);
  const recent = useLiveQuery(async () => {
    const entries = await db.foodEntries.orderBy('loggedAt').reverse().limit(400).toArray();
    const ids = recentFoods(entries.filter((e) => e.foodId).map((e) => ({ foodId: e.foodId!, meal: e.meal, loggedAt: e.loggedAt })), 20);
    return (await db.foods.bulkGet(ids)).filter((f): f is Food => !!f);
  }, [], [] as Food[]);
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    let live = true;
    const t = setTimeout(() => void searchLocal(q).then((r) => live && setFound(r)), 120);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query]);
  const list = query.trim() ? found : recent;
  return (
    <Screen
      header={
        <TopBar
          left={
            <BarButton kind="muted" onClick={onClose}>
              Cancel
            </BarButton>
          }
          title="Add food"
        />
      }
    >
      <div className="mt-3">
        <SearchField value={query} onChange={setQuery} placeholder="Search foods" autoFocus />
      </div>
      <SectionLabel>{query.trim() ? 'Results' : 'Recent'}</SectionLabel>
      {list.map((f) => {
        const a = quickAmount(f);
        return (
          <FoodRow
            key={f.id}
            title={f.name}
            detail={amountLabel(a.grams, a.unit, f.basis, f.servings, a.serving)}
            totals={totalsFor(f.per100, a.grams)}
            added={false}
            onOpen={() => onPick(f)}
            onDisc={() => onPick(f)}
            discLabel={`Add ${f.name}`}
          />
        );
      })}
      {!list.length && <Note className="mt-3">{query.trim() ? 'No foods match.' : 'Search for a food to add.'}</Note>}
    </Screen>
  );
}
