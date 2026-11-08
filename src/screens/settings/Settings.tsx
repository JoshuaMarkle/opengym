import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { ChevronRight, LogoMark } from '../../components/icons';
import { Alert, useToast } from '../../components/overlays';
import { cx, LargeHeader, Screen, SectionLabel, TextField, Toggle } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { backUpNow, dataCounts, deleteAllData, exportCsv, shareOrDownload } from '../../data/backup';
import { updateSettings } from '../../data/settings';
import { TEST_MODE } from '../../db/testMode';
import { DAY_MS, fmtAgo } from '../../lib/dates';
import { formatNumber } from '../../lib/units';
import { usePinned } from '../progress/Progress';
import { useRestoreFlow } from './RestoreFlow';

declare const __APP_VERSION__: string;

export const THEME_LABEL = { dark: 'Dark', light: 'Light', auto: 'Match iPhone' } as const;

/** 9.1: a plain list; rows open a picker (9.2). Data header turns orange after 7 days without a backup. */
export function Settings() {
  const navigate = useNavigate();
  const toast = useToast();
  const { settings, exercises } = useData();
  const pinned = usePinned();
  const restore = useRestoreFlow();
  const counts = useLiveQuery(dataCounts, []);
  const persisted = useLiveQuery(async () => (navigator.storage?.persisted ? navigator.storage.persisted() : false), []);
  const [deleting, setDeleting] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);

  const overdue = !settings.lastBackupAt || Date.now() - settings.lastBackupAt > 7 * DAY_MS;
  const unit = settings.units;

  const backup = async () => {
    setBusy(true);
    try {
      if (await backUpNow()) toast({ message: 'Backup saved' });
    } finally {
      setBusy(false);
    }
  };

  const csv = async () => {
    const file = await exportCsv();
    await shareOrDownload(file);
  };

  const closeDelete = () => {
    setDeleting(false);
    setTyped('');
  };

  return (
    <Screen header={<LargeHeader title="Settings" />}>
      <SectionLabel className="mt-2">General</SectionLabel>
      <Item label="Units" value={unit === 'lb' ? 'lbs' : 'kg'} to="/settings/units" />
      <Item label="Theme" value={THEME_LABEL[settings.theme]} to="/settings/theme" />
      <Item label="Week starts on" value={settings.weekStart === 0 ? 'Sunday' : 'Monday'} to="/settings/weekStart" />

      <SectionLabel>Workout</SectionLabel>
      <Item label="Weight step" value={`${formatNumber(settings.weightStep)} ${unit}`} to="/settings/weightStep" />
      <Item label="Bar weight" value={`${formatNumber(settings.barWeight)} ${unit}`} to="/settings/barWeight" />
      <Item label="Drop set amount" value={`−${settings.dropPercent}%`} to="/settings/dropPercent" />
      <div className="flex min-h-[52px] items-center justify-between gap-3 border-b border-line">
        <span className="text-[16px]">Keep screen on</span>
        <Toggle label="Keep screen on during workouts" on={settings.keepScreenOn} onChange={(v) => void updateSettings({ keepScreenOn: v })} />
      </div>

      <SectionLabel>Progress & exercises</SectionLabel>
      <Item label="1RM formula" value={settings.oneRmFormula === 'epley' ? 'Epley' : 'Brzycki'} to="/settings/oneRmFormula" />
      <Item label="Pinned lifts" value={pinned.length} to="/progress/pinned" />
      <Item label="Exercise library" value={exercises.length} to="/exercises" />

      <SectionLabel tone={overdue ? 'warn' : undefined}>Data · last backup {fmtAgo(settings.lastBackupAt)}</SectionLabel>
      <button type="button" disabled={busy} onClick={() => void backup()} className="flex min-h-[52px] w-full items-center border-b border-line text-left text-[16px] font-semibold text-accent disabled:opacity-50">
        Back up now
      </button>
      <Item label="Restore from backup" onClick={restore.pick} />
      <Item label="Import from Strong / Hevy" to="/settings/import" />
      <Item label="Export CSV" onClick={() => void csv()} />
      <button type="button" onClick={() => setDeleting(true)} className="flex min-h-[52px] w-full items-center border-b border-line text-left text-[16px] text-danger">
        Delete all data
      </button>
      <p className="mt-2.5 text-[13px] leading-normal text-fg2">
        Everything lives on this phone. A backup is one file; save it to iCloud Drive with "Save to Files".
        {overdue && <span className="font-semibold text-warn"> It's been a while. Back up now.</span>}
      </p>

      {import.meta.env.DEV && TEST_MODE && (
        <>
          <SectionLabel tone="warn">Testing mode · this laptop only</SectionLabel>
          <Item label="Reset sample data" onClick={() => setResetting(true)} />
          <p className="mt-2.5 text-[13px] leading-normal text-fg2">
            The dev server on localhost uses a separate test database filled with workouts from July 2024. Production and your phone never see it. Run{' '}
            <code>npm run dev:real</code> to turn it off.
          </p>
        </>
      )}

      <div className="mt-10 flex flex-col items-center gap-2 text-center">
        <LogoMark size={36} />
        <div className="text-[13px] text-fg2">
          OpenGym {typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : ''}
          <br />
          Free, no account, works offline.
          {persisted !== undefined && (
            <>
              <br />
              <span className={cx(persisted ? 'text-fg2' : 'text-warn')}>{persisted ? 'Storage: protected from clean-up' : 'Storage: may be cleared by the browser. Install to Home Screen.'}</span>
            </>
          )}
        </div>
      </div>

      {restore.element}
      {import.meta.env.DEV && TEST_MODE && (
        <Alert
          open={resetting}
          title="Reset sample data?"
          message="Workouts and routines in the test database are replaced with fresh sample history."
          onClose={() => setResetting(false)}
          actions={[
            {
              label: 'Reset',
              kind: 'danger',
              onClick: async () => {
                setResetting(false);
                const m = await import('../../data/sampleData');
                await m.resetSampleData();
                toast({ message: 'Sample data reset' });
              },
            },
            { label: 'Cancel', onClick: () => setResetting(false) },
          ]}
        />
      )}
      <Alert
        open={deleting}
        title="Delete all data?"
        message={`${counts?.workouts ?? 0} workouts, ${counts?.routines ?? 0} routines and all records will be gone from this phone. Type DELETE to confirm.`}
        onClose={closeDelete}
        actions={[
          {
            label: 'Back up first',
            kind: 'bold',
            onClick: () => void backup(),
          },
          {
            label: 'Delete everything',
            kind: 'danger',
            disabled: typed.trim().toUpperCase() !== 'DELETE',
            onClick: async () => {
              closeDelete();
              await deleteAllData();
              navigate('/welcome', { replace: true });
            },
          },
          { label: 'Cancel', onClick: closeDelete },
        ]}
      >
        <TextField value={typed} onChange={setTyped} placeholder="DELETE" className="mt-3 text-center font-semibold tracking-[0.1em]" maxLength={10} />
      </Alert>
    </Screen>
  );
}

function Item({ label, value, to, onClick }: { label: string; value?: ReactNode; to?: string; onClick?: () => void }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={onClick ?? (() => to && navigate(to))}
      className="flex min-h-[52px] w-full items-center justify-between gap-3 border-b border-line text-left active:bg-surface/60"
    >
      <span className="text-[16px]">{label}</span>
      <span className="flex items-center gap-2 text-[15px] text-fg2">
        {value}
        <ChevronRight size={12} className="text-fg3" />
      </span>
    </button>
  );
}
