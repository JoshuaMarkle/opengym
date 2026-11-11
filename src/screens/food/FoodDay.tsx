import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useLongPress, SwipeRow } from '../../components/gestures';
import { ChevronLeft, ChevronRight, PlusGlyph } from '../../components/icons';
import { HoldMenu, useToast, type MenuItem } from '../../components/overlays';
import { BarButton, Button, EmptyState, FolderChevron, FolderLabel, FolderMenuButton, LargeHeader, MacroBars, Note, RingStrip, Row, Screen, TargetSummary, TextButton, cx, type RingDay } from '../../components/ui';
import { useSettings } from '../../data/DataProvider';
import { copyEntries, deleteEntries, removeBatch, restoreEntries, saveTarget, updateFoodSettings } from '../../data/food';
import { ensureFoodDb, useFoodDb } from '../../data/foodDb';
import { targetsOn, useDayEntries, useFoodSettings, useRangeEntries, useTargetVersions } from '../../data/useFood';
import type { FoodEntry, MealId } from '../../db/types';
import { useNow } from '../../hooks/useNow';
import { fmtDay } from '../../lib/dates';
import {
  amountLabel,
  ceilingStatus,
  dayNoon,
  floorStatus,
  fmtInt,
  foodDayKey,
  initialFold,
  lifterSplit,
  MEAL_LABEL,
  MEALS,
  mealForTime,
  shiftDay,
  sumEntries,
  syncFold,
  toggleFold,
  weekDays,
  type DayTargets,
  type FoldState,
} from '../../lib/nutrition';

const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Folder state per day, in memory only (nutrition-plan §3.2): a relaunch starts fresh. */
const folds = new Map<string, FoldState>();

/** "Thu, Nov 5" for a day key. */
export const fmtFoodDay = (day: string) => fmtDay(dayNoon(day));

/**
 * 10.1–10.4 Food day page (design/proposals/nutrition.html A1–A4, SPEC §14). Large title with
 * the date, the week of calorie rings, the target bar, macro bars, then the four meal folders.
 * Today opens the meal for the time of day; past and future days open with every folder closed.
 * Before setup it's the empty state (10.5).
 */
export function FoodDay() {
  const fs = useFoodSettings();
  if (!fs.setUp) return <FoodWelcome />;
  return <DayPage />;
}

function DayPage() {
  const { day: param } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const settings = useSettings();
  const fs = useFoodSettings();
  const now = useNow(60_000);
  const today = foodDayKey(now);
  const day = param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : today;
  const isToday = day === today;
  const nowMeal = mealForTime(now);

  const versions = useTargetVersions();
  const entries = useDayEntries(day);
  const week = weekDays(day, settings.weekStart);
  const weekEntries = useRangeEntries(week[0], week[6]);
  const db = useFoodDb();
  useEffect(() => {
    void ensureFoodDb();
  }, []);

  // Fold state: today follows the meal window; other days start closed.
  const [fold, setFold] = useState<FoldState>(() => folds.get(day) ?? initialFold(isToday, nowMeal));
  const [foldDay, setFoldDay] = useState(day);
  if (foldDay !== day) {
    setFoldDay(day);
    setFold(folds.get(day) ?? initialFold(isToday, nowMeal));
  }
  const synced = syncFold(fold, isToday, nowMeal);
  if (synced !== fold) setFold(synced);
  useEffect(() => {
    folds.set(day, fold);
  }, [day, fold]);

  const targets = useMemo(() => targetsOn(versions, day, fs), [versions, day, fs]);
  const sum = useMemo(() => sumEntries(entries ?? []), [entries]);
  const byMeal = useMemo(() => {
    const m = new Map<MealId, FoodEntry[]>(MEALS.map((x) => [x.id, []]));
    for (const e of entries ?? []) m.get(e.meal)!.push(e);
    return m;
  }, [entries]);

  const strip: RingDay[] = useMemo(() => {
    const kcal = new Map<string, number>();
    for (const e of weekEntries ?? []) kcal.set(e.day, (kcal.get(e.day) ?? 0) + (e.totals.kcal ?? 0));
    return week.map((k) => {
      const t = targetsOn(versions, k, fs).kcal;
      const v = kcal.get(k) ?? 0;
      const future = k > today;
      return {
        key: k,
        label: fmtFoodDay(k),
        letter: LETTERS[new Date(dayNoon(k)).getDay()],
        number: new Date(dayNoon(k)).getDate(),
        frac: t ? v / t : v > 0 ? 1 : 0,
        over: !future && !!t && ceilingStatus(v, t).over,
        today: k === today,
        future,
        selected: k === day,
      };
    });
  }, [week, weekEntries, versions, fs, today, day]);

  const goDay = (k: string) => navigate(k === today ? '/food' : `/food/day/${k}`, { replace: true });
  const add = (meal: MealId, d = day) => navigate(`/food/add?day=${d}&meal=${meal}`);

  const [menu, setMenu] = useState<{ meal: MealId; rect: DOMRect } | null>(null);

  const removeWithUndo = async (rows: FoodEntry[], message: string) => {
    const gone = await deleteEntries(rows.map((r) => r.id));
    toast({ message, actionLabel: 'Undo', onAction: () => void restoreEntries(gone) });
  };

  const menuItems = (meal: MealId): MenuItem[] => {
    const rows = byMeal.get(meal) ?? [];
    const items: MenuItem[] = [{ label: 'Save as meal', onClick: () => navigate(`/food/meal/new?day=${day}&meal=${meal}`) }];
    if (!isToday)
      items.push({
        label: 'Copy to today',
        onClick: async () => {
          const r = await copyEntries(rows, today, meal);
          toast({ message: `Copied to today · ${fmtInt(r.kcal)} kcal`, actionLabel: 'Undo', onAction: () => void removeBatch(r.batchId) });
        },
      });
    items.push({ label: 'Clear meal', tone: 'danger', onClick: () => void removeWithUndo(rows, `Cleared ${MEAL_LABEL[meal]}`) });
    return items;
  };

  return (
    <Screen
      header={
        <LargeHeader
          title="Food"
          subtitle={fmtFoodDay(day)}
          right={
            isToday ? (
              // A typed + at Title 1 (30), as on the board's large header.
              <button type="button" aria-label={`Add food to ${MEAL_LABEL[nowMeal]}`} onClick={() => add(nowMeal, today)} className="flex h-11 w-11 items-center justify-center text-title1 font-normal text-accent active:opacity-60">
                +
              </button>
            ) : (
              <>
                <BarButton aria-label="Previous day" onClick={() => goDay(shiftDay(day, -1))} className="w-11 justify-center px-0">
                  <ChevronLeft size={13} />
                </BarButton>
                <BarButton aria-label="Next day" onClick={() => goDay(shiftDay(day, 1))} className="w-11 justify-center px-0">
                  <ChevronRight size={13} />
                </BarButton>
              </>
            )
          }
        />
      }
    >
      <SwipeDays onSwipe={(dir) => goDay(shiftDay(day, dir))}>
        <RingStrip days={strip} onPick={goDay} className="mt-3" />
      </SwipeDays>

      {db.status === 'loading' && (
        <Note className="mt-2">
          Getting the food database ready{db.total ? ` · ${Math.round((db.done / db.total) * 100)}%` : ''}. Your own foods work already.
        </Note>
      )}

      <DayTotals totals={sum.totals} targets={targets} onOpen={() => navigate(`/food/nutrients/${day}`)} />

      <div className="mt-3">
        {MEALS.map(({ id }) => (
          <MealFolder
            key={id}
            meal={id}
            rows={byMeal.get(id) ?? []}
            open={fold.open.includes(id)}
            onToggle={() => setFold((f) => toggleFold(f, id))}
            onAdd={() => add(id)}
            onMenu={(rect) => setMenu({ meal: id, rect })}
            onOpenEntry={(e) => navigate(`/food/entry/${e.id}`)}
            onDelete={(e) => void removeWithUndo([e], `Deleted ${e.name}`)}
          />
        ))}
      </div>

      <Row chevron onClick={() => navigate(`/food/nutrients/${day}`)} className="mt-5 border-t">
        <span className="flex-1 text-body-lg">Nutrients</span>
      </Row>
      <Row chevron onClick={() => navigate(`/food/week/${day}`)}>
        <span className="flex-1 text-body-lg">This week</span>
      </Row>
      <Row chevron onClick={() => navigate('/food/targets')}>
        <span className="flex-1 text-body-lg">Targets</span>
        <span className="text-callout text-fg2">{targets.kcal ? `${fmtInt(targets.kcal)} kcal` : 'Just log'}</span>
      </Row>

      <HoldMenu open={!!menu} anchor={menu?.rect} items={menu ? menuItems(menu.meal) : []} onClose={() => setMenu(null)} />
    </Screen>
  );
}

/** Calories against target, then the three macro bars. Tapping the macros opens Nutrients (10.25). */
export function DayTotals({ totals, targets, onOpen }: { totals: { kcal?: number; p?: number; c?: number; f?: number }; targets: DayTargets; onOpen?: () => void }) {
  const kcal = totals.kcal ?? 0;
  const macro = (k: 'p' | 'c' | 'f') => {
    const v = totals[k] ?? 0;
    const t = targets[k];
    const st = t ? (k === 'p' ? floorStatus(v, t) : ceilingStatus(v, t)) : undefined;
    return { label: k === 'p' ? 'Protein' : k === 'c' ? 'Carbs' : 'Fat', value: v, target: t, color: k === 'p' ? 'bg-accent' : k === 'c' ? 'bg-cyan' : 'bg-gold', over: st?.over, met: st?.met };
  };
  const bars = <MacroBars items={[macro('p'), macro('c'), macro('f')]} />;
  return (
    <>
      <TargetSummary value={kcal} target={targets.kcal} unit="kcal" over={!!targets.kcal && ceilingStatus(kcal, targets.kcal).over} />
      {onOpen ? (
        <button type="button" onClick={onOpen} aria-label="Nutrients" className="mt-4 block w-full active:opacity-60">
          {bars}
        </button>
      ) : (
        <div className="mt-4">{bars}</div>
      )}
    </>
  );
}

/** Swipe the week strip sideways to move a day; ‹ › and tapping a day are the visible ways. */
function SwipeDays({ children, onSwipe }: { children: React.ReactNode; onSwipe: (dir: 1 | -1) => void }) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return (
    <div
      className="touch-pan-y"
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        const s = start.current;
        start.current = null;
        if (!s) return;
        const dx = e.clientX - s.x;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(e.clientY - s.y) * 1.5) onSwipe(dx < 0 ? 1 : -1);
      }}
    >
      {children}
    </div>
  );
}

/**
 * A meal folder (design §6 folder row): h52, chevron, Caps label (white when open) with its count,
 * the kcal total on the right ("—" when empty). Open: the foods as dense rows indented 24, then
 * "+ Add" with a ••• for Save as meal · Copy to today · Clear meal (the long-press menu's visible
 * way in). An empty meal always shows "+ Add".
 */
function MealFolder({
  meal,
  rows,
  open,
  onToggle,
  onAdd,
  onMenu,
  onOpenEntry,
  onDelete,
}: {
  meal: MealId;
  rows: FoodEntry[];
  open: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onMenu: (rect: DOMRect) => void;
  onOpenEntry: (e: FoodEntry) => void;
  onDelete: (e: FoodEntry) => void;
}) {
  const kcal = rows.reduce((s, r) => s + (r.totals.kcal ?? 0), 0);
  const hold = useLongPress((rect) => onMenu(rect), rows.length > 0);
  const addRef = useRef<HTMLDivElement>(null);
  return (
    <section aria-label={MEAL_LABEL[meal]}>
      <button type="button" onClick={onToggle} aria-expanded={open} {...hold} className="flex h-13 w-full items-center gap-2 border-b border-line text-left active:bg-surface/60">
        <FolderChevron open={open} />
        <FolderLabel label={MEAL_LABEL[meal]} count={rows.length || undefined} open={open} />
        <span className="ml-auto">
          {rows.length ? (
            <>
              <b className="text-body font-semibold">{fmtInt(kcal)}</b> <span className="text-caption text-fg2">kcal</span>
            </>
          ) : (
            <span className="text-body text-fg2">—</span>
          )}
        </span>
      </button>
      {open &&
        rows.map((e) => (
          <SwipeRow key={e.id} rounded={false} left={{ label: 'Delete', onTrigger: () => onDelete(e) }}>
            <button type="button" onClick={() => onOpenEntry(e)} className="flex min-h-13 w-full items-center gap-3 border-b border-line py-2 pl-6 text-left active:bg-surface/60">
              <span className="min-w-0 flex-1">
                <b className="block truncate text-body font-semibold">{e.name}</b>
                <span className="block truncate text-caption text-fg2">{entryDetail(e)}</span>
              </span>
              <b className="flex-none text-body font-semibold">{fmtInt(e.totals.kcal ?? 0)}</b>
            </button>
          </SwipeRow>
        ))}
      {(open || !rows.length) && (
        <div ref={addRef} className="flex h-11 items-center border-b border-line pl-6">
          <button type="button" onClick={onAdd} className="flex h-11 flex-1 items-center gap-1.5 text-body font-semibold text-accent active:opacity-60">
            <PlusGlyph size={12} />
            Add
          </button>
          {rows.length > 0 && <FolderMenuButton label={`${MEAL_LABEL[meal]} options`} onClick={() => onMenu(addRef.current!.getBoundingClientRect())} />}
        </div>
      )}
    </section>
  );
}

/** The grey line under a logged food: "1.5 cup · 280 g", "Quick add · P 20 C 30 F 5", brand first. */
export function entryDetail(e: FoodEntry): string {
  if (e.quick) {
    const m = (['p', 'c', 'f'] as const).filter((k) => e.totals[k] != null).map((k) => `${k.toUpperCase()} ${fmtInt(e.totals[k]!)}`);
    return ['Quick add', m.join(' ')].filter(Boolean).join(' · ');
  }
  const amt = e.grams != null ? amountLabel(e.grams, e.unit, e.basis ?? 'g', e.servings, e.serving) : '';
  return [e.brand, amt].filter(Boolean).join(' · ');
}

/**
 * 10.5 Before setup: what the tab does, "Set targets" (setup, 10.6–10.9) or "Just log" (totals
 * only, no target). App onboarding doesn't change; this is the first time Food opens.
 */
function FoodWelcome() {
  const navigate = useNavigate();
  const justLog = async () => {
    const split = lifterSplit(2000, 170);
    await saveTarget({ mode: 'log', diet: 'lifter', pct: split.pct, grams: split.grams });
    await updateFoodSettings({ setUp: true, goal: 'log' });
  };
  return (
    <Screen header={<LargeHeader title="Food" />}>
      <div className="pt-16">
        <EmptyState icon={<PlusGlyph size={20} />} title="Log what you eat">
          Calories, protein, carbs and fat against a target that fits your goal, plus vitamins and minerals. It all stays on this phone.
        </EmptyState>
        <div className={cx('mx-auto mt-6 flex max-w-75 flex-col items-center gap-2')}>
          <Button className="w-full" onClick={() => navigate('/food/setup')}>
            Set targets
          </Button>
          <TextButton onClick={() => void justLog()}>Just log</TextButton>
        </div>
      </div>
    </Screen>
  );
}
