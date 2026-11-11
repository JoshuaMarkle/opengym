// Calorie target math (nutrition-plan §3.4, SPEC §14): Mifflin–St Jeor BMR × an activity
// factor for maintenance, a pace in lb a week, rounding to 50 and a safety floor.

import type { Activity, FoodGoal } from '../../db/types';
import type { Sex } from './dri';

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

/** Steps-a-day bands from setup S1. Training is not added on top: these already assume a few workouts a week. */
export const ACTIVITY: Record<Activity, { factor: number; title: string; detail: string }> = {
  1: { factor: 1.2, title: 'Mostly sitting', detail: 'Desk job · under 5k steps' },
  2: { factor: 1.375, title: 'Light', detail: 'Some walking · 5–8k steps' },
  3: { factor: 1.55, title: 'On your feet', detail: 'Standing, walking a lot · 8–12k steps' },
  4: { factor: 1.725, title: 'Physical work', detail: 'Labor all day · 12k+ steps' },
};

export interface Body {
  sex: Sex;
  age: number;
  heightIn: number;
  weightLb: number;
}

/** Mifflin–St Jeor resting energy, kcal a day. */
export function bmr({ sex, age, heightIn, weightLb }: Body): number {
  return 10 * weightLb * KG_PER_LB + 6.25 * heightIn * CM_PER_IN - 5 * age + (sex === 'm' ? 5 : -161);
}

/** Maintenance: BMR × activity factor, to the nearest 10 kcal. */
export function maintenance(body: Body, activity: Activity): number {
  return Math.round((bmr(body) * ACTIVITY[activity].factor) / 10) * 10;
}

/** 1 lb a week = 500 kcal a day. */
export const KCAL_PER_LB_WEEK = 500;

export interface PaceOption {
  lb: number;
  /** Signed daily adjustment. */
  kcal: number;
  suggested?: boolean;
  /** The fastest loss pace: "strength may drop". */
  warn?: boolean;
}

/** Paces offered on S3 for a goal. Maintain and Just log skip the step. */
export function paceOptions(goal: FoodGoal): PaceOption[] {
  if (goal === 'lose')
    return [0.25, 0.5, 1, 1.5].map((lb) => ({ lb, kcal: -lb * KCAL_PER_LB_WEEK, suggested: lb === 0.5, warn: lb === 1.5 }));
  if (goal === 'gain') return [0.25, 0.5, 1].map((lb) => ({ lb, kcal: lb * KCAL_PER_LB_WEEK, suggested: lb === 0.25 }));
  return [];
}

/** The lowest target setup offers: the larger of BMR and 1,200 kcal (women) / 1,500 kcal (men). */
export function safetyFloor(body: Body): number {
  return Math.max(bmr(body), body.sex === 'f' ? 1200 : 1500);
}

export const round50 = (kcal: number) => Math.round(kcal / 50) * 50;

/** Daily target: maintenance + pace, rounded to 50. */
export function dailyTarget(maint: number, paceKcal: number): number {
  return round50(maint + paceKcal);
}

/** A pace is offered only when its target stays at or above the floor. */
export function paceAllowed(body: Body, maint: number, paceKcal: number): boolean {
  return dailyTarget(maint, paceKcal) >= safetyFloor(body);
}

/**
 * When you'd reach the goal weight at a pace, straight-line from today's weight. Undefined when
 * there's no goal weight or the goal is the other way.
 */
export function goalDate(from: number, weightLb: number, goalLb: number | undefined, paceLbPerWeek: number, goal: FoodGoal): number | undefined {
  if (goalLb == null || !paceLbPerWeek) return undefined;
  const diff = goal === 'lose' ? weightLb - goalLb : goalLb - weightLb;
  if (diff <= 0) return undefined;
  const weeks = diff / paceLbPerWeek;
  return from + Math.round(weeks * 7) * 86_400_000;
}
