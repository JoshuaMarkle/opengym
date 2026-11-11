import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useNumberPad, type PadField } from '../../components/useNumberPad';
import { BackButton, InlineValue, Note, Row, RowText, Screen, SectionLabel, TextButton, TopBar } from '../../components/ui';
import { updateTarget } from '../../data/food';
import { targetsOn, useFoodSettings, useTargetVersions } from '../../data/useFood';
import { fmtAmount, foodDayKey, GROUPS, MICROS, NUTRIENT, type NutrientId } from '../../lib/nutrition';

/**
 * 10.13 Nutrient targets (nutrition-plan §3.14): every micronutrient with its target from the
 * US Dietary Reference Intakes for your sex and age. Tap a number to type your own (keypad
 * dock); Reset puts the DRI value back. Saved as a new target version from today, so past days
 * keep theirs. Limits (sodium, saturated fat …) say so; floors with an upper limit show it.
 */
export function NutrientTargets() {
  const navigate = useNavigate();
  const fs = useFoodSettings();
  const versions = useTargetVersions();
  const cur = versions?.[versions.length - 1];
  const today = foodDayKey(Date.now());
  const t = targetsOn(versions, today, fs);
  const dri = targetsOn(versions && cur ? [...versions.slice(0, -1), { ...cur, overrides: {} }] : versions, today, fs);
  const overrides = cur?.overrides ?? {};
  const [text, setText] = useState<{ id: NutrientId; v: string } | null>(null);

  const save = (id: NutrientId, v: number | undefined) => {
    const next = { ...overrides };
    if (v == null) delete next[id];
    else next[id] = v;
    void updateTarget({ overrides: next });
  };
  const fields: PadField[] = MICROS.map((id) => ({
    id,
    label: NUTRIENT[id].name,
    value: text?.id === id ? text.v : t.micro[id] ? fmtAmount(t.micro[id]!.amount) : '',
    onChange: (v) => setText({ id, v }),
    step: t.micro[id] && t.micro[id]!.amount >= 100 ? 10 : 1,
    stepLabel: t.micro[id] && t.micro[id]!.amount >= 100 ? '10' : '1',
  }));
  const pad = useNumberPad(fields);
  // Leaving a field saves what was typed in it.
  useEffect(() => {
    if (!text || pad.active === text.id) return;
    const v = Number(text.v);
    if (text.v !== '' && Number.isFinite(v) && v >= 0 && v !== t.micro[text.id]?.amount) save(text.id, v);
    setText(null);
  }, [pad.active]);

  return (
    <Screen header={<TopBar left={<BackButton label="Targets" onClick={() => navigate(-1)} />} title="Nutrient targets" />} footer={pad.pad}>
      <Note className="mt-4">From the US Dietary Reference Intakes for your sex and age. Tap a number to use your own; changes apply from today.</Note>
      {GROUPS.filter((g) => MICROS.some((id) => NUTRIENT[id].group === g.id)).map((g) => (
        <section key={g.id}>
          <SectionLabel>{g.label}</SectionLabel>
          {MICROS.filter((id) => NUTRIENT[id].group === g.id).map((id) => {
            const n = NUTRIENT[id];
            const mt = t.micro[id];
            const mine = overrides[id] != null;
            const base = dri.micro[id];
            const sub = mine
              ? `Yours · ${base ? `DRI ${fmtAmount(base.amount)} ${n.unit}` : 'no DRI'}`
              : mt?.kind === 'limit'
                ? 'Limit'
                : mt?.ul
                  ? `Upper limit ${fmtAmount(mt.ul)} ${n.unit}`
                  : mt
                    ? undefined
                    : 'No target';
            return (
              <Row key={id} variant="dense">
                <RowText dense title={n.name} subtitle={sub} />
                {mine && (
                  <TextButton small onClick={() => save(id, undefined)}>
                    Reset
                  </TextButton>
                )}
                <InlineValue label={n.name} value={text?.id === id ? text.v : mt ? fmtAmount(mt.amount) : ''} unit={n.unit} on={pad.active === id} onClick={() => pad.open(id)} />
              </Row>
            );
          })}
        </section>
      ))}
    </Screen>
  );
}
