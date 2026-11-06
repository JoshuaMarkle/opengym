import { db } from '../db/db';
import type { Folder, Routine, RoutineExercise, RoutineSet } from '../db/types';
import { uuid } from '../lib/id';
import { orderSets } from '../lib/sets';

const now = () => Date.now();

// ───────────────────────────── folders

async function liveFolders(): Promise<Folder[]> {
  return (await db.folders.toArray()).filter((f) => !f.deletedAt).sort((a, b) => a.order - b.order);
}

/** Keep the invariant: exactly one active folder among the non-archived ones (when any exist). */
async function ensureOneActive(): Promise<void> {
  const folders = await liveFolders();
  const open = folders.filter((f) => !f.archived);
  const active = open.filter((f) => f.active);
  const t = now();
  // Archived folders are never active.
  for (const f of folders) if (f.archived && f.active) await db.folders.update(f.id, { active: false, updatedAt: t });
  if (active.length === 1) return;
  const keep = active[0] ?? open[0];
  for (const f of open) if (f.active !== (f.id === keep?.id)) await db.folders.update(f.id, { active: f.id === keep?.id, updatedAt: t });
}

export async function createFolder(name: string): Promise<string> {
  return db.transaction('rw', db.folders, async () => {
    const folders = await liveFolders();
    const t = now();
    const f: Folder = {
      id: uuid(),
      createdAt: t,
      updatedAt: t,
      name: name.trim() || 'New folder',
      order: folders.length ? Math.max(...folders.map((x) => x.order)) + 1 : 0,
      active: !folders.some((x) => x.active && !x.archived),
      archived: false,
    };
    await db.folders.add(f);
    return f.id;
  });
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const n = name.trim();
  if (n) await db.folders.update(id, { name: n, updatedAt: now() });
}

export async function setActiveFolder(id: string): Promise<void> {
  await db.transaction('rw', db.folders, async () => {
    const t = now();
    for (const f of await liveFolders()) {
      const active = f.id === id;
      if (f.active !== active || (active && f.archived)) await db.folders.update(f.id, { active, archived: active ? false : f.archived, updatedAt: t });
    }
  });
}

export async function setFolderArchived(id: string, archived: boolean): Promise<void> {
  await db.transaction('rw', db.folders, async () => {
    const patch: Partial<Folder> = { archived, updatedAt: now() };
    if (archived) patch.active = false;
    await db.folders.update(id, patch);
    await ensureOneActive();
  });
}

/** Deleting a folder never deletes routines; they move to "No folder". */
export async function deleteFolder(id: string): Promise<void> {
  await db.transaction('rw', db.folders, db.routines, async () => {
    const t = now();
    const routines = await db.routines.where('folderId').equals(id).toArray();
    for (const r of routines) await db.routines.update(r.id, { folderId: undefined, updatedAt: t });
    await db.folders.update(id, { deletedAt: t, active: false, updatedAt: t });
    await ensureOneActive();
  });
}

/** Edit mode (2.7): persist folder order and where each routine sits. */
export async function saveLayout(folderOrder: string[], placement: { folderId?: string; routineIds: string[] }[]): Promise<void> {
  await db.transaction('rw', db.folders, db.routines, async () => {
    const t = now();
    await Promise.all(folderOrder.map((id, i) => db.folders.update(id, { order: i, updatedAt: t })));
    for (const p of placement) {
      await Promise.all(p.routineIds.map((id, i) => db.routines.update(id, { folderId: p.folderId, order: i, updatedAt: t })));
    }
  });
}

// ───────────────────────────── routines

async function nextOrderIn(folderId: string | undefined): Promise<number> {
  const all = (await db.routines.toArray()).filter((r) => !r.deletedAt && r.folderId === folderId);
  return all.length ? Math.max(...all.map((r) => r.order)) + 1 : 0;
}

export async function moveRoutine(routineId: string, folderId: string | undefined): Promise<void> {
  await db.transaction('rw', db.routines, async () => {
    const r = await db.routines.get(routineId);
    if (!r || r.folderId === folderId) return;
    await db.routines.update(routineId, { folderId, order: await nextOrderIn(folderId), updatedAt: now() });
  });
}

/** Soft delete: the routine disappears from Plans; its workouts stay in History. */
export async function deleteRoutine(routineId: string): Promise<void> {
  await db.routines.update(routineId, { deletedAt: now(), updatedAt: now() });
}

export interface DraftSet {
  key: string;
  kind: 'warmup' | 'working';
  weight: number | 'last';
  repsMin?: number;
  repsMax?: number;
}

export interface DraftExercise {
  key: string;
  exerciseId: string;
  sets: DraftSet[];
}

export interface RoutineDraft {
  id?: string;
  name: string;
  folderId?: string;
  notes?: string;
  exercises: DraftExercise[];
}

export async function loadRoutineDraft(routineId: string): Promise<RoutineDraft | undefined> {
  const r = await db.routines.get(routineId);
  if (!r) return undefined;
  const res = (await db.routineExercises.where('routineId').equals(routineId).toArray()).sort((a, b) => a.order - b.order);
  const exercises: DraftExercise[] = [];
  for (const re of res) {
    const sets = (await db.routineSets.where('routineExerciseId').equals(re.id).toArray()).sort((a, b) => a.order - b.order);
    const warm = sets.filter((s) => s.kind === 'warmup');
    const work = sets.filter((s) => s.kind === 'working');
    exercises.push({
      key: re.id,
      exerciseId: re.exerciseId,
      sets: [...warm, ...work].map((s) => ({ key: s.id, kind: s.kind, weight: s.weight, repsMin: s.repsMin, repsMax: s.repsMax })),
    });
  }
  return { id: r.id, name: r.name, folderId: r.folderId, notes: r.notes, exercises };
}

/** Builder Save: write the routine and replace its exercises and sets. */
export async function saveRoutine(draft: RoutineDraft): Promise<string> {
  return db.transaction('rw', db.routines, db.routineExercises, db.routineSets, db.folders, async () => {
    const t = now();
    let folderId = draft.folderId;
    if (folderId) {
      const f = await db.folders.get(folderId);
      if (!f || f.deletedAt) folderId = undefined;
    }
    let id = draft.id;
    const existing = id ? await db.routines.get(id) : undefined;
    if (existing) {
      const order = existing.folderId === folderId ? existing.order : await nextOrderIn(folderId);
      await db.routines.update(existing.id, { name: draft.name.trim() || 'Routine', folderId, notes: draft.notes?.trim() || undefined, order, updatedAt: t });
      const old = await db.routineExercises.where('routineId').equals(existing.id).toArray();
      await db.routineSets.where('routineExerciseId').anyOf(old.map((o) => o.id)).delete();
      await db.routineExercises.where('routineId').equals(existing.id).delete();
    } else {
      id = uuid();
      const r: Routine = {
        id,
        createdAt: t,
        updatedAt: t,
        name: draft.name.trim() || 'Routine',
        folderId,
        notes: draft.notes?.trim() || undefined,
        order: await nextOrderIn(folderId),
      };
      await db.routines.add(r);
    }
    const res: RoutineExercise[] = [];
    const sets: RoutineSet[] = [];
    draft.exercises.forEach((ex, i) => {
      const re: RoutineExercise = { id: uuid(), createdAt: t, updatedAt: t, routineId: id!, exerciseId: ex.exerciseId, order: i };
      res.push(re);
      const ordered = [...ex.sets.filter((s) => s.kind === 'warmup'), ...ex.sets.filter((s) => s.kind === 'working')];
      ordered.forEach((s, j) =>
        sets.push({
          id: uuid(),
          createdAt: t,
          updatedAt: t,
          routineExerciseId: re.id,
          order: j,
          kind: s.kind,
          weight: s.weight,
          repsMin: s.repsMin,
          repsMax: s.repsMax,
        }),
      );
    });
    await db.routineExercises.bulkAdd(res);
    await db.routineSets.bulkAdd(sets);
    return id!;
  });
}

export async function duplicateRoutine(routineId: string): Promise<string | undefined> {
  const draft = await loadRoutineDraft(routineId);
  if (!draft) return undefined;
  const r = await db.routines.get(routineId);
  const newId = await saveRoutine({ ...draft, id: undefined, name: `${draft.name} copy` });
  // Place the copy right after the original.
  if (r) {
    await db.transaction('rw', db.routines, async () => {
      const siblings = (await db.routines.toArray())
        .filter((x) => !x.deletedAt && x.folderId === r.folderId && x.id !== newId)
        .sort((a, b) => a.order - b.order);
      const idx = siblings.findIndex((x) => x.id === r.id);
      const copy = (await db.routines.get(newId))!;
      siblings.splice(idx + 1, 0, copy);
      await Promise.all(siblings.map((x, i) => db.routines.update(x.id, { order: i })));
    });
  }
  return newId;
}

/** "Save as routine" from a finished workout (6.6 •••). */
export async function routineFromWorkout(workoutId: string, folderId?: string): Promise<string> {
  const w = await db.workouts.get(workoutId);
  const wes = (await db.workoutExercises.where('workoutId').equals(workoutId).toArray()).sort((a, b) => a.order - b.order);
  const exercises: DraftExercise[] = [];
  for (const we of wes) {
    const sets = orderSets(await db.workoutSets.where('workoutExerciseId').equals(we.id).toArray()).filter((s) => s.kind !== 'drop');
    exercises.push({
      key: we.id,
      exerciseId: we.exerciseId,
      sets: sets.map((s) => ({ key: s.id, kind: s.kind as 'warmup' | 'working', weight: 'last' as const })),
    });
  }
  if (!folderId) folderId = (await liveFolders()).find((f) => f.active)?.id;
  return saveRoutine({ name: w?.name ?? 'Routine', folderId, exercises });
}

/** Folder for new routines: the active one, creating "My Routines" the first time. */
export async function defaultFolderForNewRoutine(): Promise<string> {
  const folders = await liveFolders();
  const active = folders.find((f) => f.active && !f.archived);
  if (active) return active.id;
  const open = folders.find((f) => !f.archived);
  if (open) {
    await setActiveFolder(open.id);
    return open.id;
  }
  return createFolder('My Routines');
}
