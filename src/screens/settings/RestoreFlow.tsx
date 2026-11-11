import { useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Alert, useToast } from '../../components/overlays';
import { backUpNow, BackupError, dataCounts, readBackup, restoreBackup, type BackupFile } from '../../data/backup';
import { fmtDay } from '../../lib/dates';
import { CheckGlyph } from '../../components/icons';

/**
 * 9.4: pick a backup file, compare counts, offer to back up this phone first,
 * then replace everything. Shared by Settings and Welcome.
 */
export function useRestoreFlow(): { pick: () => void; element: ReactNode } {
  const navigate = useNavigate();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ backup: BackupFile; here: number; hereFood: number } | null>(null);
  const [error, setError] = useState('');
  const [backedUp, setBackedUp] = useState(false);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File) => {
    try {
      const backup = await readBackup(file);
      const c = await dataCounts();
      setBackedUp(false);
      setPending({ backup, here: c.workouts + c.foodDays, hereFood: c.foodDays });
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
            ? restoreMessage(fmtDay(pending.backup.exportedAt), { workouts: pending.backup.counts.workouts, foodDays: pending.backup.counts.foodDays ?? 0 }, { workouts: pending.here - pending.hereFood, foodDays: pending.hereFood })
            : undefined
        }
        onClose={close}
        actions={[
          ...(pending && pending.here > 0
            ? [
                {
                  label: backedUp ? (
                    <span className="inline-flex items-center gap-1.5">
                      Backed up
                      <CheckGlyph size={13} />
                    </span>
                  ) : (
                    'Back up this phone first'
                  ),
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

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Backup from Nov 3 has 120 workouts and 28 days of food. This phone has 4 workouts. Everything here will be replaced." */
function restoreMessage(date: string, backup: { workouts: number; foodDays: number }, here: { workouts: number; foodDays: number }): string {
  const food = backup.foodDays > 0 || here.foodDays > 0;
  const what = (c: { workouts: number; foodDays: number }) => (food ? `${plural(c.workouts, 'workout', 'workouts')} and ${plural(c.foodDays, 'day', 'days')} of food` : plural(c.workouts, 'workout', 'workouts'));
  const any = here.workouts + here.foodDays > 0;
  return `Backup from ${date} has ${what(backup)}. This phone has ${any ? what(here) : 'nothing logged'}.${any ? ' Everything here will be replaced.' : ''}`;
}
