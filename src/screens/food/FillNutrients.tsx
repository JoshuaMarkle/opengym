import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useToast } from '../../components/overlays';
import { BarButton, DetailTitle, Note, Row, RowText, Screen, SearchField, SectionLabel, TopBar } from '../../components/ui';
import { fillCandidates, fillFood, searchLocal, unfillFood } from '../../data/food';
import { db } from '../../db/db';
import type { Food } from '../../db/types';
import { fillMissing, missingMicros } from '../../lib/nutrition';

/**
 * 10.28 Fill in missing nutrients (nutrition-plan §3.14): a packaged or custom food that lacks most
 * vitamins and minerals borrows them from the closest built-in USDA food. Only missing values are
 * copied, per 100 g; label values always win. Borrowed values are marked estimated ("~").
 */
export function FillNutrients() {
  const navigate = useNavigate();
  const toast = useToast();
  const { id = '' } = useParams();
  const food = useLiveQuery(() => db.foods.get(id), [id]);
  const closest = useLiveQuery(async () => (food ? fillCandidates(food) : []), [food?.id]);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Food[]>([]);
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    let live = true;
    const t = setTimeout(() => void searchLocal(q).then((r) => live && setFound(r.filter((f) => f.source === 'usda'))), 120);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query]);
  if (!food) return null;
  const lacking = missingMicros(food.per100).length;

  const pick = async (from: Food) => {
    const before = { per100: food.per100, estimated: food.estimated, filledFrom: food.filledFrom };
    const n = await fillFood(food.id, from.id);
    toast({ message: n ? `Filled in ${n} nutrients from ${from.name}` : `${from.name} had nothing to add`, actionLabel: n ? 'Undo' : undefined, onAction: n ? () => void unfillFood(food.id, before) : undefined });
    navigate(-1);
  };
  const row = (f: Food) => {
    const adds = fillMissing(food, f).filled.length;
    return (
      <Row key={f.id} onClick={adds ? () => void pick(f) : undefined} chevron={!!adds}>
        <RowText title={f.name} subtitle={[f.detail && f.detail !== f.name ? f.detail : undefined, adds ? `Adds ${adds} nutrients` : 'Adds nothing'].filter(Boolean).join(' · ')} dense />
      </Row>
    );
  };
  const list = query.trim() ? found : (closest ?? []);
  return (
    <Screen
      header={
        <TopBar
          left={
            <BarButton kind="muted" onClick={() => navigate(-1)}>
              Cancel
            </BarButton>
          }
          title="Fill in nutrients"
        />
      }
    >
      <DetailTitle title={food.name} meta={`Missing ${lacking} vitamins and minerals`} className="mt-5" />
      <Note className="mt-3">Pick the built-in food most like it. Only what's missing is copied, scaled per 100 g; the label's own numbers stay. Borrowed values show with "~".</Note>
      <div className="mt-4">
        <SearchField value={query} onChange={setQuery} placeholder="Search built-in foods" />
      </div>
      <SectionLabel>{query.trim() ? 'Results' : 'Closest built-in foods'}</SectionLabel>
      {list.map(row)}
      {closest && !list.length && <Note className="mt-3">{query.trim() ? 'No built-in foods match.' : 'Nothing close by name. Search for a similar food.'}</Note>}
    </Screen>
  );
}
