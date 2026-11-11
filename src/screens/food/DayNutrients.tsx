import { useNavigate, useParams } from 'react-router';
import { CheckGlyph, WarnGlyph } from '../../components/icons';
import { BackButton, DetailTitle, LabeledBar, Note, Screen, SectionLabel, TopBar, cx } from '../../components/ui';
import { useDayEntries, useDayTargets } from '../../data/useFood';
import { fmtAmount, fmtInt, GROUPS, MACRO_BG, NUTRIENT, NUTRIENTS, nutrientStatus, pctOfTarget, sumEntries, targetAmount, type DayTargets, type NutrientId, type Sum } from '../../lib/nutrition';
import { fmtFoodDay } from './FoodDay';

const MAIN: NutrientId[] = ['kcal', 'p', 'c', 'f'];

/** "1,234" for calories, "2.4" / "180" for the rest. */
export const fmtValue = (id: NutrientId, v: number) => (id === 'kcal' ? fmtInt(v) : fmtAmount(v));
export const nutrientName = (id: NutrientId) => (id === 'kcal' ? 'Calories' : NUTRIENT[id].name);
/** In a sentence: "sodium", "vitamin D" (a name like "B12" stays as it is). */
export const nutrientWord = (id: NutrientId) => nutrientName(id).replace(/^[A-Z](?=[a-z])/, (m) => m.toLowerCase());

/**
 * 10.25 Day nutrients (nutrition-plan §3.14): every tracked nutrient for a day, grouped. Each row is
 * the name, "amount / target unit", a 4 px labeled bar and the %. Calories and macros come first
 * in their colors; the rest use the neutral bar, orange only past a limit or an upper limit, always
 * with the word "over". A floor reached gets a check. A food with no value for a nutrient adds
 * nothing and the row says so with the not-enough-data glyph. Tap a row for its top foods (10.26).
 */
export function DayNutrients() {
  const navigate = useNavigate();
  const { day = '' } = useParams();
  const entries = useDayEntries(day);
  const targets = useDayTargets(day);
  if (!entries || !targets) return null;
  const sum = sumEntries(entries);
  const open = (id: NutrientId) => navigate(`/food/nutrients/${day}/${id}`);
  const rest = GROUPS.map((g) => ({ ...g, ids: NUTRIENTS.filter((n) => n.group === g.id && !MAIN.includes(n.id)).map((n) => n.id) })).filter((g) => g.ids.length);
  return (
    <Screen header={<TopBar left={<BackButton label="Food" onClick={() => navigate(-1)} />} title="Nutrients" />}>
      <DetailTitle title={fmtFoodDay(day)} meta={entries.length ? `${entries.length} ${entries.length === 1 ? 'food' : 'foods'} logged` : 'Nothing logged'} className="mt-5" />
      <SectionLabel>Calories and macros</SectionLabel>
      {MAIN.map((id) => (
        <NutrientRow key={id} id={id} sum={sum} targets={targets} onOpen={() => open(id)} />
      ))}
      {rest.map((g) => (
        <section key={g.id}>
          <SectionLabel>{g.label}</SectionLabel>
          {g.ids.map((id) => (
            <NutrientRow key={id} id={id} sum={sum} targets={targets} onOpen={() => open(id)} />
          ))}
        </section>
      ))}
      <Note className="mt-4">Targets are the US Dietary Reference Intakes for your sex and age, or your own numbers from Targets. "~" means some of the amount was borrowed from a similar food.</Note>
    </Screen>
  );
}

function NutrientRow({ id, sum, targets, onOpen }: { id: NutrientId; sum: Sum; targets: DayTargets; onOpen: () => void }) {
  const def = NUTRIENT[id];
  const v = sum.totals[id];
  const target = targetAmount(id, targets);
  const st = v != null ? nutrientStatus(id, v, targets) : undefined;
  const pct = pctOfTarget(id, v ?? 0, targets);
  const missing = sum.missing[id]?.length ?? 0;
  const limit = targets.micro[id]?.kind === 'limit';
  const amount = v == null ? '—' : `${sum.estimated.has(id) ? '~' : ''}${fmtValue(id, v)}`;
  const color = id === 'p' || id === 'c' || id === 'f' ? MACRO_BG[id] : id === 'kcal' ? 'bg-fg' : 'bg-fg2';
  return (
    <button type="button" onClick={onOpen} className={cx('block w-full border-b border-line py-2.5 text-left active:opacity-60', def.sub && 'pl-4')}>
      <span className="flex items-baseline gap-2">
        <b className={cx('min-w-0 flex-1 truncate', def.sub ? 'text-body font-normal' : 'text-body font-semibold')}>
          {nutrientName(id)}
          {st?.met && <CheckGlyph size={12} className="ml-1.5 inline text-tip" />}
        </b>
        <span className="tabular-nums text-callout">
          <span className={st?.over ? 'text-warn' : v == null ? 'text-fg2' : ''}>{amount}</span>
          <span className="text-fg2">
            {target ? ` / ${fmtValue(id, target)}` : ''} {def.unit}
          </span>
        </span>
        <span className={cx('w-16 text-right tabular-nums text-callout', st?.over ? 'font-semibold text-warn' : 'text-fg2')}>{st?.over ? 'over' : pct != null ? `${pct}%` : '—'}</span>
      </span>
      {target ? <LabeledBar frac={st?.frac ?? 0} color={st?.over && !limit && id !== 'kcal' && id !== 'c' && id !== 'f' ? 'bg-warn' : color} over={st?.over} /> : null}
      {(missing > 0 || limit) && (
        <span className="mt-1 flex items-center gap-1.5 text-caption text-fg2">
          {missing > 0 && (
            <>
              <WarnGlyph size={14} className="text-warn" />
              Missing from {missing} {missing === 1 ? 'food' : 'foods'}
            </>
          )}
          {missing > 0 && limit && ' · '}
          {limit && 'A limit, not a goal'}
        </span>
      )}
    </button>
  );
}
