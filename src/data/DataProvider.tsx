import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { db } from '../db/db';
import { defaultSettings } from '../db/seed';
import type { Exercise, Settings, Workout, WorkoutExercise, WorkoutSet } from '../db/types';
import { orderSets } from '../lib/sets';
import { buildHistory, type HistoryIndex } from './history';
import { withDefaults } from './settings';

interface DataValue {
  settings: Settings;
  /** Every exercise ever (incl. deleted), so history always has names. */
  exerciseMap: Map<string, Exercise>;
  /** Live exercises, A–Z. */
  exercises: Exercise[];
  history: HistoryIndex;
}

const DataContext = createContext<DataValue | null>(null);

export interface ActiveExercise {
  we: WorkoutExercise;
  exercise: Exercise;
  sets: WorkoutSet[]; // display order
}

export interface ActiveWorkoutData {
  workout: Workout;
  exercises: ActiveExercise[];
}

/** undefined = still loading, null = no workout running. */
const ActiveContext = createContext<ActiveWorkoutData | null | undefined>(undefined);

const MISSING: Omit<Exercise, 'id'> = {
  name: 'Unknown exercise',
  type: 'weight',
  muscle: 'other',
  equipment: 'other',
  isCustom: true,
  archived: false,
  createdAt: 0,
  updatedAt: 0,
};

export function exerciseOrMissing(map: Map<string, Exercise>, id: string): Exercise {
  return map.get(id) ?? { ...MISSING, id };
}

function applyTheme(pref: Settings['theme']) {
  const resolve = () => (pref === 'auto' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : pref);
  const apply = () => {
    const t = resolve();
    document.documentElement.dataset.theme = t;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#ffffff' : '#000000');
  };
  apply();
  try {
    localStorage.setItem('og-theme', pref);
  } catch {
    /* private mode */
  }
  if (pref !== 'auto') return undefined;
  const mq = matchMedia('(prefers-color-scheme: light)');
  mq.addEventListener('change', apply);
  return () => mq.removeEventListener('change', apply);
}

export function DataProvider({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const settings = useLiveQuery(() => db.settings.get('settings'), [], null);
  const all = useLiveQuery(() => db.exercises.toArray(), []);
  const history = useLiveQuery(buildHistory, []);

  const theme = settings?.theme ?? 'dark';
  useEffect(() => applyTheme(theme), [theme]);

  const value = useMemo<DataValue | null>(() => {
    if (settings === null || !all || !history) return null;
    const exerciseMap = new Map(all.map((e) => [e.id, e]));
    const exercises = all.filter((e) => !e.deletedAt).sort((a, b) => a.name.localeCompare(b.name));
    return { settings: settings ? withDefaults(settings) : defaultSettings(), exerciseMap, exercises, history };
  }, [settings, all, history]);

  if (!value) return <>{fallback ?? null}</>;
  return (
    <DataContext.Provider value={value}>
      <ActiveWorkoutProvider>{children}</ActiveWorkoutProvider>
    </DataContext.Provider>
  );
}

function ActiveWorkoutProvider({ children }: { children: ReactNode }) {
  const { exerciseMap, settings } = useData();
  const raw = useLiveQuery(async () => {
    const workout = await db.workouts.where('status').equals('active').first();
    if (!workout) return null;
    const wes = await db.workoutExercises.where('workoutId').equals(workout.id).toArray();
    const sets = wes.length ? await db.workoutSets.where('workoutExerciseId').anyOf(wes.map((w) => w.id)).toArray() : [];
    return { workout, wes, sets };
  }, []);

  const value = useMemo<ActiveWorkoutData | null | undefined>(() => {
    if (raw === undefined) return undefined;
    if (raw === null) return null;
    const byWe = new Map<string, WorkoutSet[]>();
    for (const s of raw.sets) byWe.set(s.workoutExerciseId, [...(byWe.get(s.workoutExerciseId) ?? []), s]);
    const exercises = [...raw.wes]
      .sort((a, b) => a.order - b.order)
      .map((we) => ({ we, exercise: exerciseOrMissing(exerciseMap, we.exerciseId), sets: orderSets(byWe.get(we.id) ?? []) }));
    return { workout: raw.workout, exercises };
  }, [raw, exerciseMap]);

  useWakeLock(!!value && settings.keepScreenOn);

  return <ActiveContext.Provider value={value}>{children}</ActiveContext.Provider>;
}

/** Keep the screen on while a workout runs (Settings → Keep screen on). */
function useWakeLock(enabled: boolean) {
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } };
    if (!enabled || !nav.wakeLock) return;
    let lock: { release(): Promise<void> } | undefined;
    let cancelled = false;
    const acquire = async () => {
      try {
        if (document.visibilityState !== 'visible') return;
        const l = await nav.wakeLock!.request('screen');
        if (cancelled) void l.release();
        else lock = l;
      } catch {
        /* denied or unsupported: fine */
      }
    };
    void acquire();
    const onVis = () => {
      if (document.visibilityState === 'visible') void acquire();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release().catch(() => {});
    };
  }, [enabled]);
}

export function useData(): DataValue {
  const v = useContext(DataContext);
  if (!v) throw new Error('useData outside DataProvider');
  return v;
}

export const useSettings = () => useData().settings;
export const useActiveWorkout = () => useContext(ActiveContext);
