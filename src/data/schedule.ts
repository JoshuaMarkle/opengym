import { useMemo } from 'react';
import { db } from '../db/db';
import type { Folder, PlanSchedule } from '../db/types';
import { useNow } from '../hooks/useNow';
import { dayKey } from '../lib/dates';
import {
  addDayKey,
  applyOverrides,
  hasSchedule,
  planDays,
  resetDayPatch,
  routineCodes,
  trainedByDay,
  withScheduleFrom,
  type OverridePatch,
  type PlanDay,
  type ScheduleDraft,
} from '../lib/schedule';
import { useData } from './DataProvider';
import { usePlans, type PlansData } from './usePlans';

const todayKey = () => dayKey(Date.now());

async function updateSchedule(folderId: string, fn: (s: PlanSchedule | undefined) => PlanSchedule | undefined): Promise<void> {
  await db.transaction('rw', db.folders, async () => {
    const f = await db.folders.get(folderId);
    if (!f) return;
    await db.folders.update(folderId, { schedule: fn(f.schedule), updatedAt: Date.now() });
  });
}

/** 2.16–2.18 Save: the new schedule applies from today on. */
export async function saveSchedule(folderId: string, draft: ScheduleDraft, overrides?: OverridePatch): Promise<void> {
  await updateSchedule(folderId, (s) => {
    const schedule = withScheduleFrom(s, draft, todayKey());
    return schedule && overrides ? applyOverrides(schedule, overrides) : schedule;
  });
}

/** 2.21 / 3.5: change single days without touching the schedule. */
export async function changeDays(folderId: string, patch: OverridePatch): Promise<void> {
  await updateSchedule(folderId, (s) => (s ? applyOverrides(s, patch) : s));
}

export async function resetDay(folderId: string, key: string): Promise<void> {
  await updateSchedule(folderId, (s) => (s ? applyOverrides(s, resetDayPatch(s, key)) : s));
}

/** 3.5 "Skip it": the workout stays missed, the note goes away. */
export async function skipMissed(folderId: string, key: string): Promise<void> {
  await updateSchedule(folderId, (s) => (s ? { ...s, skipped: [...new Set([...(s.skipped ?? []), key])] } : s));
}

/** Short strip labels for a plan: its own routines first, then any other routine its schedule uses. */
export function planCodes(plans: PlansData, folder: Folder | undefined): Map<string, string> {
  const own = folder ? (plans.byFolder.get(folder.id) ?? []) : [];
  const ownIds = new Set(own.map((r) => r.id));
  return routineCodes([...own, ...plans.routines.filter((r) => !ownIds.has(r.id))]);
}

export interface PlanView {
  plans: PlansData;
  today: string;
  /** True when the folder has a cycle or weekly split right now. */
  scheduled: boolean;
  days: PlanDay[];
  codes: Map<string, string>;
  routineName: (id: string | null | undefined) => string;
}

/** Plan days for a folder between two day keys (relative to today when numbers are given). */
export function usePlanView(folder: Folder | undefined, from: string | number, to: string | number): PlanView | undefined {
  const { history, settings } = useData();
  const plans = usePlans();
  const now = useNow(60_000);
  const today = dayKey(now);
  const trained = useMemo(() => trainedByDay(history.workouts.map((w) => w.workout)), [history]);
  const fromKey = typeof from === 'number' ? addDayKey(today, from) : from;
  const toKey = typeof to === 'number' ? addDayKey(today, to) : to;

  return useMemo(() => {
    if (!plans) return undefined;
    const live = new Set(plans.routines.map((r) => r.id));
    const names = new Map(plans.routines.map((r) => [r.id, r.name]));
    const schedule = folder?.schedule;
    const days = schedule ? planDays({ schedule, trained, today, from: fromKey, to: toKey, weekStart: settings.weekStart, exists: (id) => live.has(id) }) : [];
    return {
      plans,
      today,
      scheduled: hasSchedule(schedule, today),
      days,
      codes: planCodes(plans, folder),
      routineName: (id) => (id ? (names.get(id) ?? 'Deleted routine') : 'Rest'),
    };
  }, [plans, folder, trained, today, fromKey, toKey, settings.weekStart]);
}

