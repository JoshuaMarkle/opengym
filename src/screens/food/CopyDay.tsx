import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useToast } from '../../components/overlays';
import { BarButton, Note, Screen, SectionLabel, TopBar } from '../../components/ui';
import { copyEntries, removeBatch } from '../../data/food';
import { db } from '../../db/db';
import type { FoodEntry } from '../../db/types';
import { MEALS, foodDayKey, fmtInt, shiftDay, sumEntries } from '../../lib/nutrition';
import { fmtFoodDay } from './FoodDay';
import { FoodRow } from './parts';

const DAYS_BACK = 14;

/**
 * 10.23 Copy a day (nutrition-plan §3.7): the last two weeks of logged days. + copies every food
 * of that day into the same meals of the day you're adding to, as one batch with one Undo; the
 * check takes it back off.
 */
export function CopyDay() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const day = params.get('day') ?? foodDayKey(Date.now());
  const [added, setAdded] = useState<Map<string, string>>(new Map());
  const days = useLiveQuery(async () => {
    const from = shiftDay(day, -DAYS_BACK);
    const rows = await db.foodEntries.where('day').between(from, day, true, false).toArray();
    const by = new Map<string, FoodEntry[]>();
    for (const r of rows) by.set(r.day, [...(by.get(r.day) ?? []), r]);
    return [...by].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [day]);

  return (
    <Screen
      header={
        <TopBar
          left={
            <BarButton kind="muted" onClick={() => navigate(-1)}>
              {added.size ? 'Done' : 'Cancel'}
            </BarButton>
          }
          title="Copy a day"
        />
      }
    >
      <SectionLabel>Into {fmtFoodDay(day)}</SectionLabel>
      {days?.map(([d, rows]) => {
        const batch = added.get(d);
        return (
          <div key={d}><FoodRow
            title={d === shiftDay(day, -1) ? `Yesterday · ${fmtFoodDay(d)}` : fmtFoodDay(d)}
            detail={`${rows.length} ${rows.length === 1 ? 'food' : 'foods'}`}
            totals={sumEntries(rows).totals}
            added={!!batch}
            discLabel={batch ? `Remove ${fmtFoodDay(d)}'s foods` : `Copy ${fmtFoodDay(d)}`}
            onDisc={async () => {
              if (batch) {
                const gone = await removeBatch(batch);
                setAdded((m) => (m.delete(d), new Map(m)));
                toast({ message: `Removed ${gone.length} ${gone.length === 1 ? 'food' : 'foods'}` });
                return;
              }
              const r = await copyEntries(rows, day);
              setAdded((m) => new Map(m).set(d, r.batchId));
              toast({
                message: `Copied ${r.count} ${r.count === 1 ? 'food' : 'foods'} · ${fmtInt(r.kcal)} kcal`,
                actionLabel: 'Undo',
                onAction: () => {
                  void removeBatch(r.batchId);
                  setAdded((m) => (m.delete(d), new Map(m)));
                },
              });
            }}
          /><div className="flex gap-2">{MEALS.filter((m) => rows.some((r) => r.meal === m.id && r.foodId)).map((m) => <BarButton key={m.id} onClick={() => navigate(`/food/meal/new?day=${d}&meal=${m.id}`)}>{m.label}</BarButton>)}</div></div>
        );
      })}
      {days && !days.length && <Note className="mt-3">Nothing logged in the last two weeks.</Note>}
      {days && days.length > 0 && <Note className="mt-3">Each food goes into the same meal it was in. You can change or remove any of them afterward.</Note>}
    </Screen>
  );
}
