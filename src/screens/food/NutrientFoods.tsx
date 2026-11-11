import { useNavigate, useParams } from 'react-router';
import { WarnGlyph } from '../../components/icons';
import { BackButton, DetailTitle, LabeledBar, Note, Screen, SectionLabel, TargetSummary, TopBar } from '../../components/ui';
import { useDayEntries, useDayTargets } from '../../data/useFood';
import type { FoodEntry } from '../../db/types';
import { isNutrientId, MEAL_LABEL, NUTRIENT, nutrientStatus, sumEntries, targetAmount, topContributors } from '../../lib/nutrition';
import { fmtValue, nutrientName, nutrientWord } from './DayNutrients';
import { entryDetail, fmtFoodDay } from './FoodDay';

/**
 * 10.26 A nutrient's foods ("where did my sodium come from", nutrition-plan §3.14): the day's
 * total against target, then the foods that gave the most of it with their share. 10.27: foods
 * with no value for it are listed under "Missing from", each one tap from Fill in missing
 * nutrients on its food.
 */
export function NutrientFoods() {
  const navigate = useNavigate();
  const { day = '', nid = '' } = useParams();
  const entries = useDayEntries(day);
  const targets = useDayTargets(day);
  if (!isNutrientId(nid)) return null;
  if (!entries || !targets) return null;
  const def = NUTRIENT[nid];
  const sum = sumEntries(entries);
  const total = sum.totals[nid] ?? 0;
  const target = targetAmount(nid, targets);
  const st = nutrientStatus(nid, total, targets);
  const top = topContributors(entries, nid);
  const missing = (sum.missing[nid] ?? []) as FoodEntry[];

  const row = (e: FoodEntry, right: React.ReactNode, frac?: number) => (
    <button
      key={e.id}
      type="button"
      onClick={() => navigate(missing.includes(e) && e.foodId ? `/food/item/${e.foodId}` : `/food/entry/${e.id}`)}
      className="block w-full border-b border-line py-2.5 text-left active:opacity-60"
    >
      <span className="flex items-baseline gap-3">
        <b className="min-w-0 flex-1 truncate text-body font-semibold">{e.name}</b>
        {right}
      </span>
      <span className="mt-0.5 block truncate text-caption text-fg2">{[MEAL_LABEL[e.meal], entryDetail(e)].filter(Boolean).join(' · ')}</span>
      {frac != null && <LabeledBar frac={frac} color="bg-fg2" />}
    </button>
  );

  return (
    <Screen header={<TopBar left={<BackButton label="Nutrients" onClick={() => navigate(-1)} />} title={nutrientName(nid)} />}>
      <DetailTitle title={nutrientName(nid)} meta={fmtFoodDay(day)} className="mt-5" />
      <div className="mt-4">
        <TargetSummary value={total} target={target} unit={def.unit} over={!!st?.over} />
      </div>
      {targets.micro[nid]?.kind === 'limit' && <Note className="mt-2">A limit, not a goal: less is fine.</Note>}

      <SectionLabel action={top.length ? <span className="text-caption font-normal tracking-normal text-fg2 normal-case">share of the day</span> : undefined}>Top foods</SectionLabel>
      {top.map(({ entry, amount, share }) =>
        row(
          entry,
          <span className="tabular-nums text-callout">
            {fmtValue(nid, amount)} <span className="text-fg2">{def.unit}</span>
            <span className="ml-2 inline-block w-11 text-right text-fg2">{Math.round(share * 100)}%</span>
          </span>,
          share,
        ),
      )}
      {!top.length && <Note className="mt-3">Nothing logged this day has any {nutrientWord(nid)}.</Note>}

      {missing.length > 0 && (
        <>
          <SectionLabel>
            <WarnGlyph size={14} className="mr-1.5 inline align-text-bottom text-warn" />
            Missing from
          </SectionLabel>
          {missing.map((e) => row(e, <span className="text-callout text-fg2">—</span>))}
          <Note className="mt-2">These foods have no {nutrientWord(nid)} value, so they add nothing to the total. Open one to fill in its missing nutrients from a similar food.</Note>
        </>
      )}
    </Screen>
  );
}
