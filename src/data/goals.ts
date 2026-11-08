// Goals (training-logic §18, proposal C1–C7): weight × reps on one lift, optionally by a date.

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Exercise, Goal, Settings } from '../db/types';
import { uuid } from '../lib/id';
import { goalState, goalTarget, WEEK, type GoalState, type TrendNow } from '../lib/training';
import type { HistoryIndex } from './history';
import { currentPhase, liftTraining, type LiftTraining } from './training';

/** Live goals, newest first (undefined while loading). */
export function useGoals(): Goal[] | undefined {
  return useLiveQuery(async () => (await db.goals.toArray()).filter((g) => !g.deletedAt).sort((a, b) => b.createdAt - a.createdAt), []);
}

export async function addGoal(g: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const t = Date.now();
  const id = uuid();
  await db.goals.add({ ...g, id, createdAt: t, updatedAt: t });
  return id;
}

export async function updateGoal(id: string, patch: Partial<Omit<Goal, 'id' | 'createdAt'>>): Promise<void> {
  await db.goals.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteGoal(id: string): Promise<void> {
  await db.goals.delete(id);
}

export interface GoalView {
  goal: Goal;
  exercise: Exercise;
  lift: LiftTraining;
  state: GoalState;
  /** Deadline moved by time spent Maintaining, when "Pause goal dates" is on (§20). */
  by?: number;
}

/** Lifts a goal can be set on: est. 1RM lifts and bodyweight reps (assisted gets milestones only). */
export const canHaveGoal = (ex: Exercise) => ex.type === 'weight' || ex.type === 'bodyweight' || ex.type === 'bodyweight_plus';

/** The goal in the lift's strength unit: est. 1RM, or reps for bodyweight. */
export const goalTargetOf = (ex: Exercise, weight: number, reps: number) => (ex.type === 'bodyweight' ? reps : goalTarget(weight, reps));

/** The trend a goal is judged on: the projection, or your own rate when the data was too messy (C3). */
export function goalTrend(goal: Pick<Goal, 'ownRate' | 'startRate'>, now: TrendNow): TrendNow {
  return !now.canProject && goal.ownRate ? { ...now, r0: goal.startRate, canProject: true } : now;
}

/** Where a goal stands today (C4, C5, C7). */
export function goalView(goal: Goal, exercise: Exercise, history: HistoryIndex, settings: Settings, now = Date.now()): GoalView {
  const lift = liftTraining(history, exercise, settings);
  const before = liftTraining(history, exercise, settings, now - 2 * WEEK);
  let by = goal.by;
  const p = settings.phase;
  if (by != null && p?.pauseGoals && currentPhase(settings, now) === 'maintain') by += Math.max(0, now - Math.max(p.since, goal.startedAt));
  const targetValue = exercise.type === 'bodyweight' ? goal.reps : undefined;
  const state = goalState({ ...goal, by, targetValue }, now, goalTrend(goal, lift.now), before.points.length ? goalTrend(goal, before.now) : undefined);
  return { goal, exercise, lift, state, by };
}
