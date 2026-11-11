import { useNavigate } from 'react-router';
import { useNumberPad } from '../../components/useNumberPad';
import { BackButton, BarButton, Check, InlineValue, MacroLegend, Note, Ring, Row, RowText, Screen, SectionLabel, TopBar, macroSegments } from '../../components/ui';
import { updateFoodSettings, updateTarget } from '../../data/food';
import { useFoodSettings, useTargetVersions } from '../../data/useFood';
import type { DietId, FoodTarget, Triple } from '../../db/types';
import { canStep, DIET, DIETS, KG_PER_LB, fmtInt, safetyFloor, splitFor, stepPct } from '../../lib/nutrition';
import { formatNumber } from '../../lib/units';
import { useSettings } from '../../data/DataProvider';
import { useEffect, useState } from 'react';

/** The goal line under Calories: "Lose 0.5 lb a week", "Maintain", "Just log". */
function goalLine(goal: string | undefined, paceLb: number | undefined, units: 'lb' | 'kg'): string {
  const pace = paceLb ? (units === 'kg' ? `${formatNumber(Math.round(paceLb * KG_PER_LB * 10) / 10, 1)} kg` : `${formatNumber(paceLb, 2)} lb`) : '';
  if (goal === 'lose') return `Lose ${pace} a week`;
  if (goal === 'gain') return `Gain ${pace} a week`;
  if (goal === 'maintain') return 'Maintain';
  return 'Just log';
}

/**
 * 10.10–10.12 Targets (design/proposals/nutrition.html T1–T3, nutrition-plan §3.4): calories
 * (typed on the keypad dock, or Recalculate to rerun setup), the L ring with the split, then the
 * diets as a plain list with the active one first. Picking a diet applies right away, from today;
 * Done just closes. Custom adds steppers: + takes 2% and gives 1% back from each other macro.
 */
export function Targets() {
  const navigate = useNavigate();
  const settings = useSettings();
  const fs = useFoodSettings();
  const versions = useTargetVersions();
  const cur: FoodTarget | undefined = versions?.[versions.length - 1];
  const target = cur?.mode === 'target' ? cur.kcal : undefined;
  const [kcalText, setKcalText] = useState<string | null>(null);

  const apply = async (kcal: number, diet: DietId, custom = fs.customPct) => {
    const s = splitFor(diet, kcal, fs.weightLb, custom);
    await updateTarget({ mode: 'target', kcal, diet, pct: s.pct, grams: s.grams, sex: fs.sex, birthYear: fs.birthYear });
  };
  const commitKcal = () => {
    const v = Math.round(Number(kcalText));
    setKcalText(null);
    if (v > 0) void apply(v, cur?.diet ?? 'lifter');
  };
  const pad = useNumberPad([{ id: 'kcal', label: 'Calories', value: kcalText ?? String(target ?? ''), onChange: setKcalText, mode: 'int', step: 50, stepLabel: '50' }], { onDone: commitKcal });
  // Closing the pad any other way keeps what was typed too.
  useEffect(() => {
    if (!pad.active && kcalText != null) commitKcal();
  }, [pad.active]);

  if (!versions) return null;
  const kcal = target ?? 0;
  const diet = cur?.diet ?? 'lifter';
  const split = target ? splitFor(diet, kcal, fs.weightLb, fs.customPct) : undefined;
  const floor = fs.sex && fs.weightLb && fs.heightIn && fs.birthYear ? safetyFloor({ sex: fs.sex, age: new Date().getFullYear() - fs.birthYear, heightIn: fs.heightIn, weightLb: fs.weightLb }) : undefined;
  const order = [diet, ...DIETS.map((d) => d.id).filter((id) => id !== diet)];
  const custom = (pct: Triple) => {
    void updateFoodSettings({ customPct: pct });
    void apply(kcal, 'custom', pct);
  };

  return (
    <Screen
      header={
        <TopBar
          left={<BackButton label="Food" onClick={() => navigate(-1)} />}
          title="Targets"
          right={
            <BarButton kind="bold" onClick={() => navigate(-1)}>
              Done
            </BarButton>
          }
        />
      }
      footer={pad.pad}
    >
      <Row variant="two" className="mt-1">
        <span className="min-w-0 flex-1">
          <b className="block text-headline">Calories</b>
          <span className="mt-0.5 block text-callout text-fg2">
            {goalLine(fs.goal, fs.paceLb, settings.units)} ·{' '}
            <button type="button" onClick={() => navigate('/food/setup')} className="-my-3 inline-flex min-h-11 items-center text-accent">
              Recalculate
            </button>
          </span>
        </span>
        <InlineValue label="Calories" value={pad.active ? (kcalText ?? String(target ?? '')) : target ? fmtInt(target) : ''} unit="kcal" on={pad.active === 'kcal'} onClick={() => pad.open('kcal')} />
      </Row>
      {target && floor && target < floor && <Note className="mt-2">Below the usual safe minimum of {fmtInt(floor)} kcal for you.</Note>}

      {split ? (
        <>
          <div className="mt-5 flex justify-center">
            <Ring size="l" segments={macroSegments(split.grams, split.pct)}>
              <b className={DIET[diet].name.length > 8 ? 'text-headline' : 'text-title3'}>{DIET[diet].name}</b>
              <small className="text-caption text-fg2">{split.pct.join(' / ')}</small>
            </Ring>
          </div>
          <div className="mt-4 border-y border-line py-4">
            <MacroLegend
              grams={split.grams}
              pct={split.pct}
              steps={
                diet === 'custom'
                  ? {
                      canDown: (i) => canStep(split.pct, i, -1),
                      canUp: (i) => canStep(split.pct, i, 1),
                      onStep: (i, dir) => custom(stepPct(split.pct, i, dir)),
                    }
                  : undefined
              }
            />
          </div>
          {diet === 'custom' && <p className="mt-2.5 text-caption text-fg2">+ adds 2% to that macro and takes 1% from each of the others. − does the opposite.</p>}
        </>
      ) : (
        <Note className="mt-4">Just logging: totals without a target. Type a calorie target above to set one.</Note>
      )}

      <Row chevron onClick={() => navigate('/food/targets/nutrients')} className="mt-5 border-t">
        <span className="flex-1 text-body-lg">Nutrient targets</span>
      </Row>

      {split && (
        <>
          <SectionLabel action={<span className="text-caption font-normal tracking-normal text-fg2 normal-case">protein / carbs / fat</span>}>Diets</SectionLabel>
          {order.map((id) => {
            const s = splitFor(id, kcal, fs.weightLb, fs.customPct);
            const on = id === diet;
            return (
              <Row key={id} variant="dense" onClick={() => void apply(kcal, id)} aria-pressed={on}>
                <Ring size="row" segments={macroSegments(s.grams, s.pct)} />
                <RowText dense title={DIET[id].name} subtitle={`${s.pct.join(' / ')} · ${DIET[id].note}`} />
                <Check on={on} />
              </Row>
            );
          })}
        </>
      )}
    </Screen>
  );
}
