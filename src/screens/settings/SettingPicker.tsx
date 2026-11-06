import type { ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { CheckGlyph } from '../../components/icons';
import { BackButton, Note, Screen, TopBar } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { setUnits, updateSettings } from '../../data/settings';
import type { Settings } from '../../db/types';
import { BAR_WEIGHT_OPTIONS, formatNumber, WEIGHT_STEP_OPTIONS } from '../../lib/units';

interface Option {
  value: string | number;
  label: ReactNode;
  detail?: ReactNode;
}

interface PickerDef {
  title: string;
  note: string;
  options: (s: Settings) => Option[];
  current: (s: Settings) => string | number;
  apply: (v: string | number, s: Settings) => Promise<void>;
}

const PICKERS: Record<string, PickerDef> = {
  units: {
    title: 'Units',
    note: "Weights are stored exactly; this only changes how they're shown. Weight step and bar weight switch to the new unit's defaults.",
    options: () => [
      { value: 'lb', label: 'Pounds', detail: 'lbs' },
      { value: 'kg', label: 'Kilograms', detail: 'kg' },
    ],
    current: (s) => s.units,
    apply: (v) => setUnits(v as Settings['units']),
  },
  theme: {
    title: 'Theme',
    note: 'Dark is easiest on the eyes at the gym. "Match iPhone" follows your system setting.',
    options: () => [
      { value: 'dark', label: 'Dark' },
      { value: 'light', label: 'Light' },
      { value: 'auto', label: 'Match iPhone' },
    ],
    current: (s) => s.theme,
    apply: (v) => updateSettings({ theme: v as Settings['theme'] }),
  },
  weekStart: {
    title: 'Week starts on',
    note: 'Changes the Home week strip, the History calendar and how weeks are counted in stats.',
    options: () => [
      { value: 0, label: 'Sunday' },
      { value: 1, label: 'Monday' },
    ],
    current: (s) => s.weekStart,
    apply: (v) => updateSettings({ weekStart: v as 0 | 1 }),
  },
  weightStep: {
    title: 'Weight step',
    note: 'How much the + and − keys on the keypad add or take away, and what drop sets round to.',
    options: (s) => WEIGHT_STEP_OPTIONS[s.units].map((n) => ({ value: n, label: `${formatNumber(n)} ${s.units}` })),
    current: (s) => s.weightStep,
    apply: (v) => updateSettings({ weightStep: Number(v) }),
  },
  barWeight: {
    title: 'Bar weight',
    note: 'Used for barbell lifts you have no numbers for yet, and when you tick a barbell set with no weight.',
    options: (s) => BAR_WEIGHT_OPTIONS[s.units].map((n) => ({ value: n, label: `${formatNumber(n)} ${s.units}`, detail: barNote(n, s.units) })),
    current: (s) => s.barWeight,
    apply: (v) => updateSettings({ barWeight: Number(v) }),
  },
  dropPercent: {
    title: 'Drop set amount',
    note: '"+ Drop" fills in the last completed set this much lighter, rounded to your weight step.',
    options: () => [10, 15, 20, 25, 30, 40, 50].map((n) => ({ value: n, label: `−${n}%` })),
    current: (s) => s.dropPercent,
    apply: (v) => updateSettings({ dropPercent: Number(v) }),
  },
  oneRmFormula: {
    title: '1RM formula',
    note: 'How the estimated one-rep max is worked out from your best working set (up to 12 reps). Both agree closely around 5 reps.',
    options: () => [
      { value: 'epley', label: 'Epley', detail: 'w × (1 + reps / 30)' },
      { value: 'brzycki', label: 'Brzycki', detail: 'w × 36 / (37 − reps)' },
    ],
    current: (s) => s.oneRmFormula,
    apply: (v) => updateSettings({ oneRmFormula: v as Settings['oneRmFormula'] }),
  },
};

function barNote(n: number, units: Settings['units']) {
  if (units === 'lb') return n === 45 ? 'standard' : n === 35 ? "women's bar" : n <= 25 ? 'EZ / training bar' : '';
  return n === 20 ? 'standard' : n === 15 ? "women's bar" : n <= 10 ? 'EZ / training bar' : '';
}

/** 9.2: a short list, tap to choose. Same pattern for every setting. */
export function SettingPicker() {
  const { key = '' } = useParams();
  const navigate = useNavigate();
  const { settings } = useData();
  const def = PICKERS[key];
  if (!def) return <Navigate to="/settings" replace />;
  const cur = def.current(settings);

  return (
    <Screen header={<TopBar left={<BackButton label="Settings" onClick={() => navigate('/settings')} />} title={def.title} />}>
      <div className="mt-2">
        {def.options(settings).map((o) => (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => void def.apply(o.value, settings)}
            className="flex min-h-[52px] w-full items-center justify-between gap-3 border-b border-line text-left active:bg-surface/60"
            aria-pressed={o.value === cur}
          >
            <span className="text-[16px]">{o.label}</span>
            <span className="flex items-center gap-3 text-[14px] text-fg2">
              {o.detail}
              <span className="w-4">{o.value === cur && <CheckGlyph size={16} className="text-accent" />}</span>
            </span>
          </button>
        ))}
      </div>
      <Note className="mt-3">{def.note}</Note>
    </Screen>
  );
}
