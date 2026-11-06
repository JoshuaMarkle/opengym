import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '../db/db';
import type { Folder, Routine } from '../db/types';

export interface PlansData {
  /** Live folders in order (archived included, flagged). */
  folders: Folder[];
  /** Live routines in order. */
  routines: Routine[];
  /** Routines per folder id ('' = no folder). */
  byFolder: Map<string, Routine[]>;
  /** Exercise ids per routine, in order. */
  exercisesByRoutine: Map<string, string[]>;
  /** Working-set count per routine. */
  setsByRoutine: Map<string, number>;
  activeFolder?: Folder;
}

/** Folders, routines and their exercise lists for Plans and Home, from one live query. */
export function usePlans(): PlansData | undefined {
  const raw = useLiveQuery(async () => {
    const [folders, routines, res, sets] = await Promise.all([db.folders.toArray(), db.routines.toArray(), db.routineExercises.toArray(), db.routineSets.toArray()]);
    return { folders, routines, res, sets };
  }, []);

  return useMemo(() => {
    if (!raw) return undefined;
    const folders = raw.folders.filter((f) => !f.deletedAt).sort((a, b) => a.order - b.order);
    const folderIds = new Set(folders.map((f) => f.id));
    const routines = raw.routines.filter((r) => !r.deletedAt).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
    const byFolder = new Map<string, Routine[]>();
    for (const r of routines) {
      const key = r.folderId && folderIds.has(r.folderId) ? r.folderId : '';
      byFolder.set(key, [...(byFolder.get(key) ?? []), r]);
    }
    const reByRoutine = new Map<string, { id: string; exerciseId: string; order: number }[]>();
    for (const re of raw.res) reByRoutine.set(re.routineId, [...(reByRoutine.get(re.routineId) ?? []), re]);
    const exercisesByRoutine = new Map<string, string[]>();
    const setsByRe = new Map<string, number>();
    for (const s of raw.sets) if (s.kind === 'working') setsByRe.set(s.routineExerciseId, (setsByRe.get(s.routineExerciseId) ?? 0) + 1);
    const setsByRoutine = new Map<string, number>();
    for (const [rid, list] of reByRoutine) {
      const sorted = list.sort((a, b) => a.order - b.order);
      exercisesByRoutine.set(rid, sorted.map((x) => x.exerciseId));
      setsByRoutine.set(rid, sorted.reduce((n, x) => n + (setsByRe.get(x.id) ?? 0), 0));
    }
    const activeFolder = folders.find((f) => f.active && !f.archived);
    return { folders, routines, byFolder, exercisesByRoutine, setsByRoutine, activeFolder };
  }, [raw]);
}
