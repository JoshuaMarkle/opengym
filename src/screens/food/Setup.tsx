import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { Sheet, SheetOption } from '../../components/overlays';
import { useNumberPad, type PadField } from '../../components/useNumberPad';
import { Badge, BackButton, BarButton, Button, Check, CompactSegmented, InfoRow, InfoTable, InlineValue, MacroRing, Row, RowText, Screen, SectionLabel, SegmentBar, TextButton, TopBar, type Step } from '../../components/ui';
import { useSettings } from '../../data/DataProvider';
import { saveTarget, updateFoodSettings } from '../../data/food';
import { useFoodSettings, useTargetVersions } from '../../data/useFood';
import type { Activity, DietId, FoodGoal, FoodSettings, Triple } from '../../db/types';
import { fmtMonthDay } from '../../lib/dates';
import { ACTIVITY, CM_PER_IN, DIET, DIETS, KG_PER_LB, dailyTarget, fmtInt, goalDate, lifterSplit, maintenance, paceAllowed, paceOptions, safetyFloor, splitFor, type Body } from '../../lib/nutrition';
import { formatNumber } from '../../lib/units';

/** The answers being edited; saved together on the last step, so Cancel changes nothing. */
interface Draft {
  sex?: 'm' | 'f';
  age: string;
  heightFt: string;
  heightIn: string;
  heightCm: string;
  weight: string;
  activity?: Activity;
  goal?: FoodGoal;
  goalWeight: string;
  paceLb?: number;
  /** Unset: keep the split you have (Lifter the first time). */
  diet?: DietId;
}

let draft: Draft | null = null;

function draftFrom(fs: FoodSettings, units: 'lb' | 'kg', now: number): Draft {
  const year = new Date(now).getFullYear();
  const lbToUnit = (lb?: number) => (lb == null ? '' : formatNumber(units === 'kg' ? lb * KG_PER_LB : lb, 1));
  return {
    sex: fs.sex,
    age: fs.birthYear ? String(year - fs.birthYear) : '',
    heightFt: fs.heightIn ? String(Math.floor(fs.heightIn / 12)) : '',
    heightIn: fs.heightIn ? String(Math.round(fs.heightIn % 12)) : '',
    heightCm: fs.heightIn ? String(Math.round(fs.heightIn * CM_PER_IN)) : '',
    weight: lbToUnit(fs.weightLb),
    activity: fs.activity,
    goal: fs.goal,
    goalWeight: lbToUnit(fs.goalWeightLb),
    paceLb: fs.paceLb,
  };
}

/**
 * 10.6–10.9 Food setup (design/proposals/nutrition.html S1–S4, nutrition-plan §3.4): about you,
 * goal, pace, result. One route with a step param, so Back works. "Recalculate" on Targets
 * reruns it with your answers filled in. Nothing saves until Start logging.
 */
export function FoodSetup() {
  const settings = useSettings();
  const fs = useFoodSettings();
  const [params] = useSearchParams();
  const step = Number(params.get('step') ?? 1);
  const units = settings.units;
  const [d, setD] = useState<Draft>(() => {
    if (step === 1 || !draft) draft = draftFrom(fs, units, Date.now());
    return draft;
  });
  const update = (patch: Partial<Draft>) =>
    setD((cur) => {
      draft = { ...cur, ...patch };
      return draft;
    });
  if (step === 2) return <GoalStep d={d} update={update} units={units} />;
  if (step === 3) return <PaceStep d={d} update={update} units={units} />;
  if (step === 4) return <ResultStep d={d} update={update} units={units} />;
  return <AboutStep d={d} update={update} units={units} />;
}

type StepProps = { d: Draft; update: (p: Partial<Draft>) => void; units: 'lb' | 'kg' };

/** History depth inside setup, so Cancel and the last step leave all of it at once. */
function useSteps() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const depth = (state as { depth?: number } | null)?.depth ?? 1;
  return {
    next: (step: number) => navigate(`/food/setup?step=${step}`, { state: { depth: depth + 1 } }),
    back: () => navigate(-1),
    leave: () => navigate(-depth),
  };
}

const bar = (n: number): Step[] => [1, 2, 3, 4].map((i) => (i < n ? 'done' : i === n ? 'current' : 'todo'));

/** The body in lb / in from the draft, when every answer is there. */
function bodyOf(d: Draft, units: 'lb' | 'kg'): Body | undefined {
  const age = Number(d.age);
  const w = Number(d.weight);
  const h = units === 'kg' ? Number(d.heightCm) / CM_PER_IN : Number(d.heightFt) * 12 + Number(d.heightIn || 0);
  if (!d.sex || !(age >= 13 && age <= 100) || !(w > 0) || !(h > 30)) return undefined;
  return { sex: d.sex, age, heightIn: h, weightLb: units === 'kg' ? w / KG_PER_LB : w };
}

/** 10.6 S1 About you: sex, age, height, weight (inline values on the keypad dock), then activity. */
function AboutStep({ d, update, units }: StepProps) {
  const steps = useSteps();
  const fields: PadField[] = [
    { id: 'age', label: 'Age', value: d.age, onChange: (age) => update({ age }), mode: 'int', step: 1, stepLabel: '1' },
    ...(units === 'kg'
      ? [{ id: 'cm', label: 'Height', value: d.heightCm, onChange: (heightCm: string) => update({ heightCm }), mode: 'int' as const, step: 1, stepLabel: '1 cm' }]
      : [
          { id: 'ft', label: 'Height · feet', value: d.heightFt, onChange: (heightFt: string) => update({ heightFt }), mode: 'int' as const, step: 1, stepLabel: '1 ft' },
          { id: 'in', label: 'Height · inches', value: d.heightIn, onChange: (heightIn: string) => update({ heightIn }), mode: 'int' as const, step: 1, stepLabel: '1 in' },
        ]),
    { id: 'weight', label: 'Weight', value: d.weight, onChange: (weight) => update({ weight }), step: 1, stepLabel: `1 ${units}` },
  ];
  const pad = useNumberPad(fields);
  const ready = !!bodyOf(d, units) && !!d.activity;
  const value = (id: string, unit: string) => {
    const f = fields.find((x) => x.id === id)!;
    return <InlineValue label={typeof f.label === 'string' ? f.label : id} value={f.value} unit={unit} on={pad.active === id} onClick={() => pad.open(id)} />;
  };
  return (
    <Screen
      header={<TopBar left={<BarButton kind="muted" onClick={steps.leave}>Cancel</BarButton>} title="About you" />}
      footer={
        pad.pad ?? (
          <div className="border-t border-line px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
            <Button className="w-full" disabled={!ready} onClick={() => steps.next(2)}>
              Next
            </Button>
          </div>
        )
      }
    >
      <SegmentBar steps={bar(1)} className="mt-4" />
      <p className="mt-4 text-callout text-fg2">Used only to estimate your calories. It stays on this phone.</p>
      <div className="mt-2 border-t border-line">
        <Row>
          <span className="flex-1 text-body-lg">Sex</span>
          <CompactSegmented
            label="Sex"
            value={d.sex}
            onChange={(sex) => update({ sex })}
            options={[
              { value: 'm', label: 'Male' },
              { value: 'f', label: 'Female' },
            ]}
          />
        </Row>
        <Row>
          <span className="flex-1 text-body-lg">Age</span>
          {value('age', '')}
        </Row>
        <Row>
          <span className="flex-1 text-body-lg">Height</span>
          {units === 'kg' ? (
            value('cm', 'cm')
          ) : (
            <span className="flex gap-2">
              {value('ft', 'ft')}
              {value('in', 'in')}
            </span>
          )}
        </Row>
        <Row>
          <span className="flex-1 text-body-lg">Weight</span>
          {value('weight', units)}
        </Row>
      </div>
      <SectionLabel action={<span className="text-caption font-normal tracking-normal text-fg2 normal-case">outside the gym</span>}>Day to day</SectionLabel>
      {([1, 2, 3, 4] as Activity[]).map((a) => (
        <Row key={a} variant="two" onClick={() => update({ activity: a })} aria-pressed={d.activity === a}>
          <RowText title={ACTIVITY[a].title} subtitle={ACTIVITY[a].detail} />
          <Check on={d.activity === a} />
        </Row>
      ))}
    </Screen>
  );
}

function Footer({ children, onClick, disabled }: { children: string; onClick: () => void; disabled?: boolean }) {
  return (
    <div className="border-t border-line px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
      <Button className="w-full" disabled={disabled} onClick={onClick}>
        {children}
      </Button>
    </div>
  );
}

const GOALS: { id: FoodGoal; title: string; detail: string }[] = [
  { id: 'lose', title: 'Lose fat', detail: 'Eat a little under, keep strength' },
  { id: 'maintain', title: 'Maintain', detail: 'Stay the same weight' },
  { id: 'gain', title: 'Build muscle', detail: 'Eat a little over' },
  { id: 'log', title: 'Just log, no target', detail: 'See totals only' },
];

/** 10.7 S2 Goal. Just log finishes here; Maintain skips the pace. */
function GoalStep({ d, update, units }: StepProps) {
  const steps = useSteps();
  const finish = useFinish();
  const pad = useNumberPad([{ id: 'goal', label: 'Goal weight', value: d.goalWeight, onChange: (goalWeight) => update({ goalWeight }), step: 1, stepLabel: `1 ${units}` }]);
  const go = () => {
    if (d.goal === 'log') void finish(d, units).then(steps.leave);
    else steps.next(d.goal === 'maintain' ? 4 : 3);
  };
  return (
    <Screen
      header={<TopBar left={<BackButton label="Back" onClick={steps.back} />} title="Goal" />}
      footer={
        pad.pad ?? (
          <Footer disabled={!d.goal} onClick={go}>
            {d.goal === 'log' ? 'Start logging' : 'Next'}
          </Footer>
        )
      }
    >
      <SegmentBar steps={bar(2)} className="mt-4" />
      <h1 className="mt-5 text-title1">What are you going for?</h1>
      <div className="mt-2">
        {GOALS.map((g) => (
          <Row key={g.id} variant="two" onClick={() => update({ goal: g.id })} aria-pressed={d.goal === g.id}>
            <RowText title={g.title} subtitle={g.detail} />
            <Check on={d.goal === g.id} />
          </Row>
        ))}
      </div>
      {(d.goal === 'lose' || d.goal === 'gain') && (
        <Row className="mt-5 border-t">
          <span className="flex-1 text-body-lg">
            Goal weight <span className="text-fg2">· optional</span>
          </span>
          <InlineValue label="Goal weight" value={d.goalWeight} unit={units} on={pad.active === 'goal'} onClick={() => pad.open('goal')} />
        </Row>
      )}
    </Screen>
  );
}

const paceText = (lb: number, units: 'lb' | 'kg') => (units === 'kg' ? `${formatNumber(Math.round(lb * KG_PER_LB * 10) / 10, 1)} kg a week` : `${formatNumber(lb, 2)} lb a week`);

/** 10.8 S3 Pace: each rate with its kcal a day and, with a goal weight, the date you'd get there. */
function PaceStep({ d, update, units }: StepProps) {
  const steps = useSteps();
  const body = bodyOf(d, units);
  const goal = d.goal ?? 'lose';
  const maint = body && d.activity ? maintenance(body, d.activity) : 0;
  const goalLb = d.goalWeight ? (units === 'kg' ? Number(d.goalWeight) / KG_PER_LB : Number(d.goalWeight)) : undefined;
  const opts = paceOptions(goal);
  const now = Date.now();
  const pick = d.paceLb ?? opts.find((o) => o.suggested)?.lb;
  const anyDate = opts.some((o) => body && goalDate(now, body.weightLb, goalLb, o.lb, goal));
  return (
    <Screen header={<TopBar left={<BackButton label="Back" onClick={steps.back} />} title="Pace" />} footer={<Footer disabled={pick == null || !body} onClick={() => (update({ paceLb: pick }), steps.next(4))}>Next</Footer>}>
      <SegmentBar steps={bar(3)} className="mt-4" />
      <h1 className="mt-5 text-title1">How fast?</h1>
      <p className="mt-0.5 text-callout text-fg2">{goal === 'lose' ? 'Slower keeps more strength.' : 'Slower adds less fat.'}</p>
      <div className="mt-2">
        {opts.map((o) => {
          const ok = !body || paceAllowed(body, maint, o.kcal);
          const date = body ? goalDate(now, body.weightLb, goalLb, o.lb, goal) : undefined;
          const kcal = `${o.kcal < 0 ? '−' : '+'}${fmtInt(Math.abs(o.kcal))} kcal`;
          return (
            <Row key={o.lb} variant="two" onClick={ok ? () => update({ paceLb: o.lb }) : undefined} aria-pressed={pick === o.lb} className={ok ? '' : 'opacity-40'}>
              <RowText
                title={paceText(o.lb, units)}
                badge={o.suggested ? <Badge variant="next">SUGGESTED</Badge> : undefined}
                subtitle={!ok ? `Below your safe minimum of ${fmtInt(body ? safetyFloor(body) : 0)} kcal` : o.warn ? <span className="text-warn">{kcal} · strength may drop</span> : `${kcal} a day`}
              />
              {date && <span className="flex-none text-callout text-fg2">{fmtMonthDay(date, now, true)}</span>}
              <Check on={pick === o.lb} disabled={!ok} />
            </Row>
          );
        })}
      </div>
      {anyDate && goalLb && (
        <p className="mt-2.5 text-caption text-fg2">
          Dates are when you'd reach {formatNumber(units === 'kg' ? goalLb * KG_PER_LB : goalLb, 1)} {units}. Real weight moves around day to day, so treat them as estimates.
        </p>
      )}
    </Screen>
  );
}

/** Save the answers and the target version (from today). */
function useFinish() {
  return async (d: Draft, units: 'lb' | 'kg', target?: { kcal: number; diet: DietId; pct: Triple; grams: Triple }) => {
    const body = bodyOf(d, units);
    const year = new Date().getFullYear();
    const profile: Partial<FoodSettings> = {
      sex: d.sex,
      birthYear: d.age ? year - Number(d.age) : undefined,
      heightIn: body?.heightIn,
      weightLb: body?.weightLb,
      activity: d.activity,
      goal: d.goal,
      paceLb: d.goal === 'lose' || d.goal === 'gain' ? d.paceLb : undefined,
      goalWeightLb: d.goalWeight ? (units === 'kg' ? Number(d.goalWeight) / KG_PER_LB : Number(d.goalWeight)) : undefined,
      setUp: true,
    };
    if (target) await saveTarget({ mode: 'target', ...target, sex: d.sex, birthYear: profile.birthYear });
    else {
      const s = lifterSplit(2000, body?.weightLb ?? 170);
      await saveTarget({ mode: 'log', diet: 'lifter', pct: s.pct, grams: s.grams, sex: d.sex, birthYear: profile.birthYear });
    }
    await updateFoodSettings(profile);
    draft = null;
  };
}

/** 10.9 S4 Result: the daily target in Hero, the math, the macro ring and the split. */
function ResultStep({ d, update, units }: StepProps) {
  const steps = useSteps();
  const finish = useFinish();
  const fs = useFoodSettings();
  const [picking, setPicking] = useState(false);
  const versions = useTargetVersions();
  const current = versions?.[versions.length - 1];
  const dietId: DietId = d.diet ?? (current?.mode === 'target' ? current.diet : 'lifter');
  const body = bodyOf(d, units);
  const goal = d.goal ?? 'maintain';
  const maint = body && d.activity ? maintenance(body, d.activity) : 0;
  const pace = goal === 'lose' || goal === 'gain' ? paceOptions(goal).find((o) => o.lb === d.paceLb) : undefined;
  const kcal = dailyTarget(maint, pace?.kcal ?? 0);
  const split = useMemo(() => splitFor(dietId, kcal, body?.weightLb, fs.customPct), [dietId, kcal, body?.weightLb, fs.customPct]);
  const diet = DIET[dietId];
  if (!body) return null;
  return (
    <Screen
      header={<TopBar left={<BackButton label="Back" onClick={steps.back} />} title="Your targets" />}
      footer={<Footer onClick={() => void finish(d, units, { kcal, diet: dietId, pct: split.pct, grams: split.grams }).then(steps.leave)}>Start logging</Footer>}
    >
      <SegmentBar steps={bar(4)} className="mt-4" />
      <div className="mt-10 mb-8 text-center">
        <div className="text-hero">{fmtInt(kcal)}</div>
        <div className="mt-1 text-footnote text-fg2">kcal a day</div>
      </div>
      <InfoTable title="Daily target" className="mt-0">
        <InfoRow label={<span className="text-fg2">Maintenance (estimated)</span>} value={fmtInt(maint)} strong />
        {pace && <InfoRow label={<span className="text-fg2">{`${goal === 'lose' ? 'Lose' : 'Gain'} ${paceText(pace.lb, units)}`}</span>} value={`${pace.kcal < 0 ? '−' : '+'}${fmtInt(Math.abs(pace.kcal))}`} strong />}
        <InfoRow label="Target" value={fmtInt(kcal)} strong className="border-b-0" />
      </InfoTable>
      <MacroRing kcal={kcal} grams={split.grams} />
      <Row variant="two">
        <RowText title={`Split · ${diet.name}`} subtitle={dietId === 'lifter' ? 'Protein 1 g per lb, fat 27%, rest carbs' : `${split.pct.join(' / ')} · ${diet.note}`} />
        <TextButton onClick={() => setPicking(true)}>Change</TextButton>
      </Row>
      <Sheet open={picking} onClose={() => setPicking(false)} title="Split" subtitle="protein / carbs / fat">
        {DIETS.map((x) => {
          const s = splitFor(x.id, kcal, body.weightLb, fs.customPct);
          return (
            <SheetOption
              key={x.id}
              onClick={() => {
                update({ diet: x.id });
                setPicking(false);
              }}
              detail={
                <>
                  {s.pct.join(' / ')}
                  <Check on={dietId === x.id} />
                </>
              }
            >
              {x.name}
            </SheetOption>
          );
        })}
      </Sheet>
    </Screen>
  );
}
