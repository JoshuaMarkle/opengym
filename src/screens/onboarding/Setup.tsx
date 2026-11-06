import { useNavigate } from 'react-router';
import { Button, FieldLabel, Segmented } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { markOnboarded } from '../../data/backup';
import { requestPersistentStorage, setUnits, updateSettings } from '../../data/settings';
import type { Settings } from '../../db/types';

/** 1.3: three choices that change how everything looks. Defaults: lbs, Sunday, Dark. */
export function Setup() {
  const navigate = useNavigate();
  const { settings } = useData();

  const done = async () => {
    void requestPersistentStorage();
    await markOnboarded();
    navigate('/', { replace: true, state: { onboarded: true } });
  };

  return (
    <div className="flex h-full flex-col px-6 pt-8 pb-[max(20px,env(safe-area-inset-bottom))]">
      <h1 className="text-[28px] leading-tight font-bold tracking-[-0.02em]">Quick setup</h1>
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
      <div className="flex-1" />
      <Button onClick={() => void done()}>Done</Button>
    </div>
  );
}
