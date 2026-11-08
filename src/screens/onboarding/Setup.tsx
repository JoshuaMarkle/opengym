import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, FieldLabel, Segmented } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { markOnboarded } from '../../data/backup';
import { requestPersistentStorage, setUnits, updateSettings } from '../../data/settings';
import type { Settings } from '../../db/types';
import { EffortTargetPicker, ExperiencePicker } from '../settings/Training';

/**
 * 1.3, 1.5, 1.6: three short steps. Looks (units, week start, theme), how hard to train
 * (the effort target, training-logic §4) and how long you've been lifting (§14).
 * Every answer has a default, and all of them live in Settings later.
 */
export function Setup() {
  const navigate = useNavigate();
  const { settings } = useData();
  const [step, setStep] = useState(1);

  const done = async () => {
    void requestPersistentStorage();
    await markOnboarded();
    navigate('/', { replace: true, state: { onboarded: true } });
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 pt-8 pb-[max(20px,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-[0.07em] text-fg2 uppercase">Setup · {step} of 3</span>
        {step > 1 && (
          <button type="button" onClick={() => setStep(step - 1)} className="-mr-2 flex h-11 items-center px-2 text-[15px] font-semibold text-accent">
            Back
          </button>
        )}
      </div>

      {step === 1 && (
        <>
          <h1 className="mt-1 text-[28px] leading-tight font-bold tracking-[-0.02em]">Quick setup</h1>
          <p className="mt-2 text-[15px] text-fg2">You can change these later in Settings.</p>

          <FieldLabel className="mt-7">Units</FieldLabel>
          <Segmented
            className="mt-2"
            options={[
              { value: 'lb' as Settings['units'], label: 'lbs' },
              { value: 'kg' as Settings['units'], label: 'kg' },
            ]}
            value={settings.units}
            onChange={(v) => void setUnits(v)}
          />
          <FieldLabel>Week starts on</FieldLabel>
          <Segmented
            className="mt-2"
            options={[
              { value: 0 as 0 | 1, label: 'Sunday' },
              { value: 1 as 0 | 1, label: 'Monday' },
            ]}
            value={settings.weekStart}
            onChange={(v) => void updateSettings({ weekStart: v })}
          />
          <FieldLabel>Theme</FieldLabel>
          <Segmented
            className="mt-2"
            options={[
              { value: 'dark' as Settings['theme'], label: 'Dark' },
              { value: 'light' as Settings['theme'], label: 'Light' },
              { value: 'auto' as Settings['theme'], label: 'Auto' },
            ]}
            value={settings.theme}
            onChange={(v) => void updateSettings({ theme: v })}
          />
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="mt-1 text-[28px] leading-tight font-bold tracking-[-0.02em]">How close to failure do you want to train?</h1>
          <p className="mt-2 mb-3 text-[15px] leading-snug text-fg2">Reps in reserve (RIR) = how many more reps you could have done. The app picks weights that land you here.</p>
          <EffortTargetPicker
            value={settings.effortTarget}
            lastOnly={settings.failureLastSetOnly}
            onChange={(t, l) => void updateSettings({ effortTarget: t, failureLastSetOnly: l })}
          />
        </>
      )}

      {step === 3 && (
        <>
          <h1 className="mt-1 text-[28px] leading-tight font-bold tracking-[-0.02em]">How long have you been lifting?</h1>
          <p className="mt-2 mb-3 text-[15px] leading-snug text-fg2">Helps the first few weeks of suggestions. Once you've logged here for a couple of months, your own numbers take over.</p>
          <ExperiencePicker value={settings.experience} onChange={(v) => void updateSettings({ experience: v })} />
          <FieldLabel className="mt-6">Even better</FieldLabel>
          <button type="button" onClick={() => navigate('/settings/import')} className="mt-1 flex min-h-11 items-center text-[16px] font-semibold text-accent">
            Import from Strong or Hevy ›
          </button>
          <p className="text-[13px] leading-snug text-fg2">An import gives the app your real history, so pace, milestones and projections are right from day one.</p>
        </>
      )}

      <div className="min-h-6 flex-1" />
      {step < 3 ? <Button onClick={() => setStep(step + 1)}>Continue</Button> : <Button onClick={() => void done()}>Done</Button>}
    </div>
  );
}
