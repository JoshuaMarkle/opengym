import { db, TABLE_NAMES, type TableName } from '../db/db';
import { ensureSeeded, seedExerciseRecords } from '../db/seed';
import type { Exercise, ExerciseType, Folder, Food, FoodEntry, MealId, PlanSchedule, Routine, RoutineExercise, RoutineSet, Settings, Workout, WorkoutExercise, WorkoutSet } from '../db/types';
import { isoDate } from '../lib/dates';
import { uuid } from '../lib/id';
import type { ImportedWorkout, ParsedImport } from '../lib/importParser';
import { guessExerciseMeta } from '../lib/match';
import { orderSets } from '../lib/sets';
import { toCsv } from '../lib/csv';
import { amountLabel, keepInBackup, loggedDays, MEAL_LABEL, NUTRIENT, NUTRIENTS } from '../lib/nutrition';
import { formatWeight, fromDisplay } from '../lib/units';
import { foodSettingsOf, writeWords } from './food';
import { resetFoodDb } from './foodDb';
import { getSettings, updateSettings } from './settings';

/**
 * 2: cardio fields on sets, cardio columns on exercises, superset groups.
 * 3: training goals, suggestions on workout exercises, training settings.
 * 4: Food (SPEC §14): your foods, food entries, saved meals and target versions. Built-in USDA
 *    foods are left out unless you made them yours (they come back from the database file).
 * Older backups load as is, with empty food tables.
 */
export const SCHEMA_VERSION = 4;

export interface BackupFile {
  app: 'opengym';
  schemaVersion: number;
  appVersion: string;
  exportedAt: number;
  counts: { workouts: number; routines: number; exercises: number; foodDays?: number };
  tables: Record<TableName, unknown[]>;
}

export class BackupError extends Error {}

declare const __APP_VERSION__: string;
const appVersion = () => (typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev');

async function counts() {
  const [workouts, routines, exercises, foodDays] = await Promise.all([
    db.workouts.where('status').equals('done').count(),
    db.routines.filter((r) => !r.deletedAt).count(),
    db.exercises.filter((e) => !e.deletedAt).count(),
    db.foodEntries.orderBy('day').uniqueKeys().then((k) => k.length),
  ]);
  return { workouts, routines, exercises, foodDays };
}

export async function dataCounts() {
  return counts();
}

/** Fields the app keeps in step with the seed on every launch, plus timestamps: not your edits. */
const SEED_MANAGED = new Set(['createdAt', 'updatedAt', 'popularity', 'area']);

const yourFields = (e: object) =>
  JSON.stringify(
    Object.entries(e)
      .filter(([k, v]) => !SEED_MANAGED.has(k) && v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1)),
  );

/**
 * Built-in exercises you never touched are left out of a backup: restore puts any missing
 * built-in back from the library (ensureSeeded). Anything you changed (archived, deleted,
 * renamed, regrouped, bar weight, plate pad…) stays, so it comes back as you left it.
 */
export function stockBuiltIns(exercises: Exercise[]): Set<string> {
  const seeds = new Map(seedExerciseRecords(0).map((e) => [e.id, yourFields(e)]));
  return new Set(exercises.filter((e) => !e.isCustom && seeds.get(e.id) === yourFields(e)).map((e) => e.id));
}

/** Everything, as one JSON document (SPEC §4 Backup). */
export async function buildBackup(): Promise<BackupFile> {
  return db.transaction('r', db.allTables, async () => {
    const tables = {} as Record<TableName, unknown[]>;
    for (const name of TABLE_NAMES) tables[name] = name === 'foods' ? (await db.foods.toArray()).filter(keepInBackup) : await db.table(name).toArray();
    const stock = stockBuiltIns(tables.exercises as Exercise[]);
    tables.exercises = (tables.exercises as Exercise[]).filter((e) => !stock.has(e.id));
    return {
      app: 'opengym',
      schemaVersion: SCHEMA_VERSION,
      appVersion: appVersion(),
      exportedAt: Date.now(),
      counts: await counts(),
      tables,
    };
  });
}

export function backupFileName(ts = Date.now()) {
  return `opengym-backup-${isoDate(ts)}.json`;
}

/** Hand files to the iPhone share sheet; fall back to downloads. Returns false if the user cancelled. */
export async function shareOrDownload(file: File | File[]): Promise<boolean> {
  const files = Array.isArray(file) ? file : [file];
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files })) {
    try {
      await nav.share({ files, title: files[0].name });
      return true;
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return false;
      // Some browsers refuse certain types: fall through to download.
    }
  }
  for (const f of files) {
    const url = URL.createObjectURL(f);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  return true;
}

/** 9.3 Back up now. Updates "last backup" when the file actually went somewhere. */
export async function backUpNow(): Promise<boolean> {
  const backup = await buildBackup();
  const file = new File([JSON.stringify(backup)], backupFileName(backup.exportedAt), { type: 'application/json' });
  const ok = await shareOrDownload(file);
  if (ok) await updateSettings({ lastBackupAt: backup.exportedAt });
  return ok;
}

export async function readBackup(file: File): Promise<BackupFile> {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new BackupError("That file isn't an OpenGym backup (it isn't valid JSON).");
  }
  const b = data as Partial<BackupFile>;
  if (!b || b.app !== 'opengym' || typeof b.schemaVersion !== 'number' || !b.tables) {
    throw new BackupError("That file isn't an OpenGym backup.");
  }
  if (b.schemaVersion > SCHEMA_VERSION) {
    throw new BackupError('This backup was made by a newer version of OpenGym. Update the app and try again.');
  }
  for (const name of TABLE_NAMES) if (!Array.isArray(b.tables[name])) b.tables[name] = [];
  const workouts = (b.tables.workouts as Workout[]).filter((w) => w.status === 'done').length;
  b.counts = { ...(b.counts ?? { routines: 0, exercises: 0 }), workouts, foodDays: loggedDays(b.tables.foodEntries as FoodEntry[]) } as BackupFile['counts'];
  return b as BackupFile;
}

/**
 * 9.4 Restore: replace everything with the backup. The built-in USDA foods already on this phone
 * stay (a backup doesn't carry them), stripped of your marks; the backup's foods go on top and the
 * search index is rebuilt for them.
 */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  await db.transaction('rw', [...db.allTables], async () => {
    const usdaRelease = foodSettingsOf(await getSettings()).usdaRelease;
    for (const name of TABLE_NAMES) if (name !== 'foods') await db.table(name).clear();
    // Foods: drop yours and their index words; keep the built-in rows but forget your marks on them.
    const mine = await db.foods.where('source').noneOf(['usda']).primaryKeys();
    await db.foods.bulkDelete(mine);
    await db.foodWords.where('foodId').anyOf(mine).delete();
    await db.foods
      .where('source')
      .equals('usda')
      .filter((f) => keepInBackup(f))
      .modify((f) => {
        delete f.mine;
        delete f.favorite;
        delete f.last;
        delete f.filledFrom;
        delete f.estimated;
      });
    for (const name of TABLE_NAMES) {
      if (name === 'settings') continue;
      await db.table(name).bulkPut(backup.tables[name]);
    }
    for (const f of backup.tables.foods as Food[]) await writeWords(f);
    const s = (backup.tables.settings as Settings[])[0];
    const t = Date.now();
    const base = await getSettings();
    const merged = { ...base, ...(s ?? {}), id: 'settings' as const, onboarded: true, updatedAt: t };
    // Whether the built-in database is loaded is about this phone, not the backup.
    if (merged.food || usdaRelease) merged.food = { ...foodSettingsOf(merged), usdaRelease };
    await db.settings.put(merged);
  });
  await ensureSeeded();
}

/** 2.2 "Import routines from a backup": adds its folders and routines next to yours. */
export async function importRoutinesFromBackup(backup: BackupFile): Promise<number> {
  const folders = (backup.tables.folders as Folder[]).filter((f) => !f.deletedAt);
  const routines = (backup.tables.routines as Routine[]).filter((r) => !r.deletedAt);
  const res = backup.tables.routineExercises as RoutineExercise[];
  const rsets = backup.tables.routineSets as RoutineSet[];
  // Built-ins you never changed aren't in the file; the library has them.
  const bExercises = new Map([...seedExerciseRecords(), ...(backup.tables.exercises as Exercise[])].map((e) => [e.id, e]));
  return db.transaction('rw', [db.folders, db.routines, db.routineExercises, db.routineSets, db.exercises], async () => {
    const t = Date.now();
    const existingFolders = (await db.folders.toArray()).filter((f) => !f.deletedAt);
    let order = existingFolders.length ? Math.max(...existingFolders.map((f) => f.order)) + 1 : 0;
    const hasActive = existingFolders.some((f) => f.active && !f.archived);
    const folderMap = new Map<string, string>();
    for (const f of folders.sort((a, b) => a.order - b.order)) {
      const id = uuid();
      folderMap.set(f.id, id);
      await db.folders.add({ ...f, id, order: order++, active: !hasActive && f.active && !f.archived, createdAt: t, updatedAt: t });
    }
    let n = 0;
    const routineMap = new Map<string, string>();
    for (const r of routines) {
      const rid = uuid();
      routineMap.set(r.id, rid);
      await db.routines.add({ ...r, id: rid, folderId: r.folderId ? folderMap.get(r.folderId) : undefined, createdAt: t, updatedAt: t });
      for (const re of res.filter((x) => x.routineId === r.id)) {
        if (!(await db.exercises.get(re.exerciseId))) {
          const e = bExercises.get(re.exerciseId);
          if (!e) continue;
          await db.exercises.add({ ...e, deletedAt: undefined, variationGroupId: undefined });
        }
        const reid = uuid();
        await db.routineExercises.add({ ...re, id: reid, routineId: rid, createdAt: t, updatedAt: t });
        for (const s of rsets.filter((x) => x.routineExerciseId === re.id)) {
          await db.routineSets.add({ ...s, id: uuid(), routineExerciseId: reid, createdAt: t, updatedAt: t });
        }
      }
      n++;
    }
    // Schedules point at routines by id: follow them to the new copies.
    const remap = (id: string | null) => (id ? (routineMap.get(id) ?? null) : null);
    for (const f of folders) {
      if (!f.schedule) continue;
      const schedule: PlanSchedule = {
        ...f.schedule,
        versions: f.schedule.versions.map((v) => ({ ...v, days: v.days.map(remap) })),
        overrides: Object.fromEntries(Object.entries(f.schedule.overrides ?? {}).map(([k, o]) => [k, { ...o, routineId: remap(o.routineId) }])),
      };
      await db.folders.update(folderMap.get(f.id)!, { schedule });
    }
    return n;
  });
}

/** 9.6 Delete all data, then put back the built-in library and default settings. The food database reloads on the next visit to Food. */
export async function deleteAllData(): Promise<void> {
  await db.transaction('rw', db.allTables, async () => {
    for (const t of db.allTables) await t.clear();
  });
  resetFoodDb();
  await ensureSeeded();
}

/** Export CSV: one row per set, in the user's unit. Re-importable. */
export async function exportCsv(): Promise<File> {
  const settings = await getSettings();
  const units = settings.units;
  const workouts = (await db.workouts.where('status').equals('done').toArray()).sort((a, b) => a.startedAt - b.startedAt);
  const exercises = new Map((await db.exercises.toArray()).map((e) => [e.id, e]));
  const rows: unknown[][] = [];
  const iso = (ts?: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };
  for (const w of workouts) {
    const wes = (await db.workoutExercises.where('workoutId').equals(w.id).toArray()).sort((a, b) => a.order - b.order);
    for (const we of wes) {
      const ex = exercises.get(we.exerciseId);
      const sets = orderSets(await db.workoutSets.where('workoutExerciseId').equals(we.id).toArray());
      let n = 0;
      for (const s of sets) {
        if (s.kind === 'working') n++;
        rows.push([
          w.name,
          iso(w.startedAt),
          iso(w.endedAt),
          ex?.name ?? 'Unknown exercise',
          s.kind === 'warmup' ? 'Warm-up' : s.kind === 'drop' ? 'Drop' : 'Working',
          s.kind === 'working' ? n : '',
          s.weight == null ? '' : formatWeight(s.weight, units),
          s.reps ?? '',
          s.kind === 'working' && s.rpe != null ? s.rpe : '',
          s.durationSec ?? '',
          s.distance == null ? '' : Math.round(s.distance * 10) / 10,
          s.speed == null ? '' : Math.round(s.speed * 100) / 100,
          s.incline ?? '',
          s.level ?? '',
          s.calories ?? '',
          s.steps ?? '',
          we.supersetGroup ?? '',
        ]);
      }
    }
  }
  const csv = toCsv(
    ['Workout', 'Start', 'End', 'Exercise', 'Set Type', 'Set', `Weight (${units})`, 'Reps', 'RPE', 'Seconds', 'Distance (m)', 'Speed (km/h)', 'Incline (%)', 'Level', 'Calories', 'Steps', 'Superset'],
    rows,
  );
  return new File([csv], `opengym-workouts-${isoDate(Date.now())}.csv`, { type: 'text/csv' });
}

/**
 * Export CSV, food log (SPEC §14): one row per logged food, oldest first. Date, meal, food,
 * brand, amount as shown in the app, grams, then one column per nutrient for that amount. A
 * nutrient the food has no value for is blank, never 0; borrowed values are marked in Estimated.
 */
export async function exportFoodCsv(): Promise<File | undefined> {
  const entries = await db.foodEntries.toArray();
  if (!entries.length) return undefined;
  entries.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : MEAL_ORDER[a.meal] - MEAL_ORDER[b.meal] || a.order - b.order));
  const num = (v: number | undefined) => (v == null ? '' : Math.round(v * 100) / 100);
  const rows = entries.map((e) => [
    e.day,
    MEAL_LABEL[e.meal],
    e.name,
    e.brand ?? '',
    e.quick ? 'Quick add' : e.grams != null ? amountLabel(e.grams, e.unit, e.basis ?? 'g', e.servings, e.serving) : '',
    num(e.grams),
    ...NUTRIENTS.map((n) => num(e.totals[n.id])),
    (e.estimated ?? []).map((id) => NUTRIENT[id].name).join('; '),
  ]);
  const csv = toCsv(['Date', 'Meal', 'Food', 'Brand', 'Amount', 'Grams', ...NUTRIENTS.map((n) => `${n.id === 'kcal' ? 'Calories' : n.name} (${n.unit})`), 'Estimated'], rows);
  return new File([csv], `opengym-food-${isoDate(Date.now())}.csv`, { type: 'text/csv' });
}

const MEAL_ORDER: Record<MealId, number> = { breakfast: 0, lunch: 1, dinner: 2, snacks: 3 };

// ───────────────────────────── Strong / Hevy import (9.5)

export interface ImportDecision {
  /** Use this library exercise… */
  exerciseId?: string;
  /** …or create a new one with this name. */
  createName?: string;
}

function guessType(name: string, workouts: ImportedWorkout[]): ExerciseType {
  const n = name.toLowerCase();
  if (n.includes('assisted')) return 'assisted';
  if (n.includes('weighted')) return 'bodyweight_plus';
  const weights = workouts.flatMap((w) => w.exercises.filter((e) => e.name === name).flatMap((e) => e.sets.map((s) => s.weight ?? 0)));
  return weights.length && weights.every((w) => !w) ? 'bodyweight' : 'weight';
}

/** Adds imported workouts to history; never replaces anything. Skips workouts already here. */
export async function importWorkouts(
  parsed: ParsedImport,
  decisions: Map<string, ImportDecision>,
  fileUnits: 'lb' | 'kg',
): Promise<{ added: number; skipped: number; newExercises: number }> {
  return db.transaction('rw', [db.exercises, db.workouts, db.workoutExercises, db.workoutSets], async () => {
    const t = Date.now();
    const idFor = new Map<string, string>();
    let newExercises = 0;
    for (const name of parsed.exerciseNames) {
      const d = decisions.get(name);
      if (d?.exerciseId && (await db.exercises.get(d.exerciseId))) {
        idFor.set(name, d.exerciseId);
        continue;
      }
      const clean = (d?.createName ?? name).trim() || name;
      const existing = (await db.exercises.toArray()).find((e) => !e.deletedAt && e.name.toLowerCase() === clean.toLowerCase());
      if (existing) {
        idFor.set(name, existing.id);
        continue;
      }
      const meta = guessExerciseMeta(name);
      const e: Exercise = {
        id: uuid(),
        createdAt: t,
        updatedAt: t,
        name: clean,
        type: guessType(name, parsed.workouts),
        muscle: meta.muscle,
        equipment: meta.equipment,
        isCustom: true,
        archived: false,
      };
      await db.exercises.add(e);
      idFor.set(name, e.id);
      newExercises++;
    }
    const types = new Map((await db.exercises.toArray()).map((e) => [e.id, e.type]));

    const existing = await db.workouts.toArray();
    const seen = new Set(existing.map((w) => `${Math.round(w.startedAt / 60_000)}|${w.name.toLowerCase()}`));
    let added = 0;
    let skipped = 0;
    for (const iw of parsed.workouts) {
      const key = `${Math.round(iw.startedAt / 60_000)}|${iw.name.toLowerCase()}`;
      if (seen.has(key)) {
        skipped++;
        continue;
      }
      seen.add(key);
      const workout: Workout = {
        id: uuid(),
        createdAt: t,
        updatedAt: t,
        name: iw.name,
        startedAt: iw.startedAt,
        endedAt: iw.endedAt && iw.endedAt > iw.startedAt ? iw.endedAt : undefined,
        status: 'done',
      };
      await db.workouts.add(workout);
      let order = 0;
      for (const ie of iw.exercises) {
        const exerciseId = idFor.get(ie.name)!;
        const type = types.get(exerciseId) ?? 'weight';
        const we: WorkoutExercise = { id: uuid(), createdAt: t, updatedAt: t, workoutId: workout.id, exerciseId, order: order++ };
        await db.workoutExercises.add(we);
        let parent: string | undefined;
        const sets: WorkoutSet[] = ie.sets.map((s, i) => {
          let weight = s.weight == null ? undefined : fromDisplay(s.weight, fileUnits);
          if (type === 'bodyweight') weight = undefined;
          if (type === 'assisted' && weight != null && weight > 0) weight = -weight;
          const id = uuid();
          const kind = s.kind === 'drop' && !parent ? 'working' : s.kind;
          if (kind !== 'drop') parent = id;
          return {
            id,
            createdAt: t,
            updatedAt: t,
            workoutExerciseId: we.id,
            order: i,
            kind,
            parentSetId: kind === 'drop' ? parent : undefined,
            weight,
            reps: s.reps,
            ...(kind === 'working' && s.rpe != null ? { rpe: s.rpe } : {}),
            completed: true,
          };
        });
        // Drops point at the last non-drop set before them.
        let lastTop: string | undefined;
        for (const s of sets) {
          if (s.kind === 'drop') s.parentSetId = lastTop;
          else lastTop = s.id;
        }
        await db.workoutSets.bulkAdd(sets);
      }
      added++;
    }
    return { added, skipped, newExercises };
  });
}

export async function markOnboarded(): Promise<void> {
  const s = await getSettings();
  if (!s.onboarded) await updateSettings({ onboarded: true });
}
