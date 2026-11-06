import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Alert } from '../components/overlays';
import { useActiveWorkout } from '../data/DataProvider';
import { ActiveWorkoutExistsError, discardWorkout, repeatWorkout, startBlankWorkout, startFromRoutine } from '../data/workouts';

type Starter = () => Promise<string>;

interface StartApi {
  startRoutine: (routineId: string, name?: string) => void;
  startBlank: () => void;
  repeat: (workoutId: string, name?: string) => void;
}

const Ctx = createContext<StartApi | null>(null);

/**
 * Starting a workout from anywhere. Only one can run at a time (SPEC §4), so
 * if one is running we offer to resume it, or discard it (confirmed) and start.
 */
export function StartWorkoutProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const active = useActiveWorkout();
  const [pending, setPending] = useState<{ run: Starter; name: string } | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const go = useCallback(
    async (run: Starter, name: string) => {
      try {
        await run();
        navigate('/workout');
      } catch (e) {
        if (e instanceof ActiveWorkoutExistsError) setPending({ run, name });
        else throw e;
      }
    },
    [navigate],
  );

  const api: StartApi = {
    startRoutine: (id, name = 'this routine') => void go(() => startFromRoutine(id), name),
    startBlank: () => void go(startBlankWorkout, 'a blank workout'),
    repeat: (id, name = 'this workout') => void go(() => repeatWorkout(id), name),
  };

  const logged = active ? active.exercises.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0) : 0;
  const close = () => {
    setPending(null);
    setConfirmDiscard(false);
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      <Alert
        open={!!pending && !confirmDiscard && !!active}
        title={`${active?.workout.name ?? 'A workout'} is still running`}
        message="Only one workout can run at a time."
        onClose={close}
        actions={[
          {
            label: `Resume ${active?.workout.name ?? ''}`.trim(),
            kind: 'bold',
            onClick: () => {
              close();
              navigate('/workout');
            },
          },
          { label: `Discard it, start ${pending?.name ?? ''}`.trim(), kind: 'danger', onClick: () => setConfirmDiscard(true) },
          { label: 'Cancel', onClick: close },
        ]}
      />
      <Alert
        open={!!pending && confirmDiscard && !!active}
        title={`Discard ${active?.workout.name ?? 'workout'}?`}
        message={logged ? `${logged} logged ${logged === 1 ? 'set' : 'sets'} will be deleted.` : 'Nothing has been logged yet.'}
        onClose={close}
        actions={[
          {
            label: 'Discard and start',
            kind: 'danger',
            onClick: async () => {
              const p = pending;
              close();
              if (active) await discardWorkout(active.workout.id);
              if (p) void go(p.run, p.name);
            },
          },
          { label: 'Cancel', onClick: close },
        ]}
      />
    </Ctx.Provider>
  );
}

export function useStartWorkout(): StartApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStartWorkout outside provider');
  return v;
}
