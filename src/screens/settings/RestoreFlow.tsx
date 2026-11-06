import { useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Alert, useToast } from '../../components/overlays';
import { backUpNow, BackupError, dataCounts, readBackup, restoreBackup, type BackupFile } from '../../data/backup';
import { fmtDay } from '../../lib/dates';

/**
 * 9.4: pick a backup file, compare counts, offer to back up this phone first,
 * then replace everything. Shared by Settings and Welcome.
 */
export function useRestoreFlow(): { pick: () => void; element: ReactNode } {
  const navigate = useNavigate();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ backup: BackupFile; here: number } | null>(null);
  const [error, setError] = useState('');
  const [backedUp, setBackedUp] = useState(false);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File) => {
    try {
      const backup = await readBackup(file);
      const here = (await dataCounts()).workouts;
      setBackedUp(false);
      setPending({ backup, here });
    } catch (e) {
      setError(e instanceof BackupError ? e.message : "Couldn't read that file.");
    }
  };

  const close = () => setPending(null);

  const element = (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void onFile(f);
        }}
      />
      <Alert
        open={!!pending}
        title={pending && pending.here === 0 ? 'Restore this backup?' : 'Replace everything?'}
        message={
          pending
            ? `Backup from ${fmtDay(pending.backup.exportedAt)} has ${pending.backup.counts.workouts} ${pending.backup.counts.workouts === 1 ? 'workout' : 'workouts'}. This phone has ${pending.here}.${pending.here ? ' Everything here will be replaced.' : ''}`
            : undefined
        }
        onClose={close}
        actions={[
          ...(pending && pending.here > 0
            ? [
                {
                  label: backedUp ? 'Backed up ✓' : 'Back up this phone first',
                  kind: 'bold' as const,
                  disabled: backedUp || busy,
                  onClick: async () => {
                    if (await backUpNow()) setBackedUp(true);
                  },
                },
              ]
            : []),
          {
            label: pending && pending.here === 0 ? 'Restore' : 'Replace',
            kind: 'danger' as const,
            disabled: busy,
            onClick: async () => {
              if (!pending) return;
              setBusy(true);
              try {
                await restoreBackup(pending.backup);
                toast({ message: `Restored ${pending.backup.counts.workouts} workouts` });
                setPending(null);
                navigate('/', { replace: true, state: { onboarded: true } });
              } finally {
                setBusy(false);
              }
            },
          },
          { label: 'Cancel', onClick: close },
        ]}
      />
      <Alert open={!!error} title="Can't restore" message={error} onClose={() => setError('')} actions={[{ label: 'OK', kind: 'bold', onClick: () => setError('') }]} />
    </>
  );

  return { pick: () => fileRef.current?.click(), element };
}
