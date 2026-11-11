import { useNavigate } from 'react-router';
import { SectionLabel, TargetSummary, TextButton } from '../../components/ui';
import { useDayEntries, useDayTargets, useFoodSettings } from '../../data/useFood';
import { ceilingStatus, fmtInt, foodDayKey, MACRO_TEXT, mealForTime, sumEntries, type Macro } from '../../lib/nutrition';

/**
 * Home's Food block (3.1, board A6, nutrition-plan §3.11): today's calories against target and the
 * macros in Caption, then "+ Log food" for the meal of the moment. Only once Food is set up (or
 * Just log was picked); in Just log mode it's the total and macros without the bar. Tapping the
 * block opens the Food tab.
 */
export function FoodBlock({ now }: { now: number }) {
  const navigate = useNavigate();
  const fs = useFoodSettings();
  const today = foodDayKey(now);
  const entries = useDayEntries(today);
  const targets = useDayTargets(today);
  if (!fs.setUp || !entries || !targets) return null;
  const t = sumEntries(entries).totals;
  const kcal = t.kcal ?? 0;
  const macro = (m: Macro) => (
    <span key={m} className="whitespace-nowrap">
      <b className={MACRO_TEXT[m]}>{m.toUpperCase()}</b> <span className="text-fg">{fmtInt(t[m] ?? 0)}</span>
      {targets[m] ? <span className="text-fg2"> / {fmtInt(targets[m]!)}</span> : null}
    </span>
  );
  return (
    <>
      <SectionLabel>Food</SectionLabel>
      <button type="button" onClick={() => navigate('/food')} aria-label="Open Food" className="block w-full text-left active:opacity-60">
        <TargetSummary value={kcal} target={targets.kcal} unit="kcal" over={!!targets.kcal && ceilingStatus(kcal, targets.kcal).over} className="mt-3" />
        <span className="mt-2 flex flex-wrap gap-x-3 text-caption tabular-nums">
          {macro('p')}
          {macro('c')}
          {macro('f')}
        </span>
      </button>
      <TextButton onClick={() => navigate(`/food/add?day=${today}&meal=${mealForTime(now)}`)} className="mt-1">
        + Log food
      </TextButton>
    </>
  );
}
