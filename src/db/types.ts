// Data model (SPEC §3). Weights are always stored in lb; convert at display.
// Every record has id (uuid), createdAt and updatedAt (epoch ms).

import type { EffortAsk, EffortMode } from '../lib/effort';
import type { Experience, PhaseKind } from '../lib/training';
import type { NutrientId, Nutrients } from '../lib/nutrition/nutrients';

export type ID = string;

export type ExerciseType = 'weight' | 'bodyweight' | 'bodyweight_plus' | 'assisted' | 'cardio';

/**
 * Cardio columns besides time (SPEC §10). Up to two per exercise. `split500`,
 * `pace` and `avgSpeed` are worked out from time and distance, never typed.
 */
export type CardioColumn = 'distance' | 'speed' | 'incline' | 'level' | 'calories' | 'steps' | 'split500' | 'pace' | 'avgSpeed';
/** How a cardio exercise's distance is shown: follow the units setting (mi / km), or meters (rowers). */
export type DistanceUnit = 'auto' | 'm';
export type Muscle = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core' | 'other';
/** A finer area inside a muscle: a word on the meta line and in search, never a filter chip. */
export type ExerciseArea = 'forearms' | 'lower back';
export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'other';
export type SetKind = 'warmup' | 'working' | 'drop';
export type RoutineSetKind = 'warmup' | 'working';

export interface BaseRecord {
  id: ID;
  createdAt: number;
  updatedAt: number;
}

export interface Exercise extends BaseRecord {
  name: string;
  type: ExerciseType;
  muscle: Muscle;
  equipment: Equipment;
  variationGroupId?: string;
  /** Built-ins only: 0–10, copied from the seed on every launch. Custom = unset (counts as 6). Never shown. */
  popularity?: number;
  area?: ExerciseArea;
  isCustom: boolean;
  archived: boolean;
  deletedAt?: number;
  /** Cardio only: the columns after TIME, in order (max 2). */
  cardioColumns?: CardioColumn[];
  /** Cardio only: distance shown in mi/km (auto) or meters. */
  distanceUnit?: DistanceUnit;
  /** Cardio only: segments count toward the running distance records (7.9). */
  isRun?: boolean;
  /** Plate pad: this exercise's bar in lb (0 = no bar, plate-loaded machine). Unset = the default bar. */
  barLb?: number;
  /** Plate pad: open the weight keypad on Plates (remembered per exercise). */
  platePad?: boolean;
}

export interface Folder extends BaseRecord {
  name: string;
  order: number;
  active: boolean; // exactly one non-archived folder is active (when any exist)
  archived: boolean;
  deletedAt?: number;
  /** A folder with a schedule is a plan (SPEC §11). */
  schedule?: PlanSchedule;
}

// ───────────────────────────── plan schedules (SPEC §11)

/** A routine id, or null for a rest day. */
export type ScheduleSlot = string | null;
export type ScheduleKind = 'none' | 'cycle' | 'weekly';
/** Cycles: wait (pause until you train) | stick (keep to dates). Weekly: skip | rest (slot into the next rest day). */
export type MissPolicy = 'wait' | 'stick' | 'skip' | 'rest';

/** One schedule, in force from `from` (a day key like "2026-11-05") until the next version starts. */
export interface ScheduleVersion {
  from: string;
  kind: ScheduleKind;
  /** Cycle: the days in order. Weekly: 7 slots indexed by weekday (0 = Sunday). */
  days: ScheduleSlot[];
  /** Cycle only: a day key that was day 1. */
  anchor?: string;
  onMiss: MissPolicy;
}

/** A one-off change to a single day (2.21). */
export interface DayOverride {
  /** Explicit cycle action: skip advances, delay holds the cycle for this day. */
  cycleAction?: 'skip' | 'delay';
  /** Shared origin for undoing all days of a cycle delay. */
  delayFrom?: string;
  routineId: ScheduleSlot;
  /** Part of a move or swap (shown grey-outlined; a moved-out day shows →). */
  moved?: boolean;
  /** The other day of a move or swap, so "Back to plan" undoes both. */
  pair?: string;
}

export interface PlanSchedule {
  /** Oldest first. Editing adds a version from today, so past days keep the plan they had. */
  versions: ScheduleVersion[];
  /** Day key → one-off change. */
  overrides: Record<string, DayOverride>;
  /** Missed days the user chose to skip (3.5), so the note goes away. */
  skipped?: string[];
}

export interface Routine extends BaseRecord {
  name: string;
  folderId?: ID;
  order: number;
  notes?: string;
  /** 1–3 letter label for plan strips (PA, PL…). Unset = derived from the name. */
  code?: string;
  deletedAt?: number;
}

export interface RoutineExercise extends BaseRecord {
  routineId: ID;
  exerciseId: ID;
  order: number;
  /** Exercises sharing a letter (contiguous, 2–3 of them) are a superset. */
  supersetGroup?: string;
}

export interface RoutineSet extends BaseRecord {
  routineExerciseId: ID;
  order: number;
  kind: RoutineSetKind;
  /** A fixed weight (lb) or 'last' = same set from the most recent workout with this exercise. */
  weight: number | 'last';
  repsMin?: number;
  repsMax?: number; // reps empty = no target
  /** Optional effort target, stored as RPE (SPEC §12, A4). */
  rpeTarget?: number;
}

export interface Workout extends BaseRecord {
  /** PH3.7: backdate on finish while the active workout clock runs normally. */
  loggedFor?: string;
  routineId?: ID;
  name: string;
  startedAt: number;
  endedAt?: number;
  status: 'active' | 'done';
  /** WorkoutExercise the user is looking at, so Resume returns to the same place. */
  currentExerciseId?: ID;
}

export interface WorkoutExercise extends BaseRecord {
  workoutId: ID;
  exerciseId: ID;
  order: number;
  /** Exercises sharing a letter (contiguous, 2–3 of them) are a superset. */
  supersetGroup?: string;
  /** Training (training-logic §9): the next weights the app offered, and what you did with them. */
  suggestion?: WorkoutSuggestion;
  /** After a gap of 21+ days (§11): a real break, or training that wasn't logged. */
  gapAnswer?: 'break' | 'notLogged';
}

export interface WorkoutSuggestion {
  /** Next weight per working set (lb), in order. */
  weights: number[];
  /** accepted = ✓ in Suggest; dismissed = ✕; edited = a filled box changed in Auto. Unset = shown, no answer. */
  outcome?: 'accepted' | 'dismissed' | 'edited';
  /** Auto mode filled the boxes itself. */
  auto?: boolean;
  /** LBS before ✓ (or before Auto filled them), by set id, for Undo / Ignore. null = was empty. */
  prev?: Record<string, number | null>;
}

export interface WorkoutSet extends BaseRecord {
  workoutExerciseId: ID;
  order: number;
  kind: SetKind;
  /** Drops point at the set they follow. */
  parentSetId?: ID;
  weight?: number; // lb; BW+ = added, assisted = negative
  reps?: number;
  completed: boolean;
  /** Rep target copied from the routine, shown as a grey placeholder. */
  repsMin?: number;
  repsMax?: number;
  /** Effort, 1–10 in half steps; RIR is shown as 10 − RPE (SPEC §12). Working sets only. */
  rpe?: number;
  /** Effort target copied from the routine, shown as an outlined badge. Never a logged value. */
  rpeTarget?: number;
  // Cardio segments (kind 'working'). Stored in SI; converted at display like weights.
  durationSec?: number;
  /** meters */
  distance?: number;
  /** km/h */
  speed?: number;
  /** % grade */
  incline?: number;
  level?: number;
  calories?: number;
  /** stair climber steps */
  steps?: number;
}

export type Units = 'lb' | 'kg';
export type ThemePref = 'dark' | 'light' | 'auto';
export type OneRmFormula = 'epley' | 'brzycki';

export interface Settings {
  id: 'settings';
  units: Units;
  theme: ThemePref;
  weekStart: 0 | 1;
  /** Keypad ± step, in the current display unit (5 lb / 2.5 kg). */
  weightStep: number;
  /** Empty-bar weight, in the current display unit. Used as the starting weight for new barbell lifts. */
  barWeight: number;
  dropPercent: number;
  keepScreenOn: boolean;
  oneRmFormula: OneRmFormula;
  pinnedExerciseIds: string[];
  /** false = focus lifts are picked automatically: the 4 most-logged compound lifts (SPEC §13). */
  pinnedCustomized: boolean;
  lastBackupAt?: number;
  historyView: 'calendar' | 'list';
  /** Effort per set (SPEC §12): off, or shown as RPE or RIR. */
  effort: EffortMode;
  /** Which sets Next on reps goes on to the effort pad for. */
  effortAsk: EffortAsk;
  /** Est. 1RM counts reps in reserve: 185 × 8 @8 → 10 reps to failure. */
  effortIn1rm: boolean;
  /** The "RPE and RIR" sheet (A5) has been shown once. */
  effortExplained?: boolean;
  onboarded: boolean;
  // ── Training (design/training-logic.html §22)
  /** How next weights reach the LBS boxes: off, a bar to accept (default), or filled in. */
  suggestMode: SuggestMode;
  /** Effort target as RIR min–max (default 0–2, "Close to failure"). */
  effortTarget: [number, number];
  /** Only the last set to failure: earlier sets aim one rep further. */
  failureLastSetOnly: boolean;
  /** Statuses, milestones and goals for every lift (on) or focus lifts only. */
  trainEverything: boolean;
  /** Lifting experience from setup; unset = inferred from history, else "some". */
  experience?: Experience;
  /** Training phase; falls back to Building after `until`. */
  phase?: TrainingPhase;
  /** Coaching tips dismissed for good. */
  dismissedTips: string[];
  /** Lifts switched from Auto to Suggest ("Auto keeps missing here"). */
  suggestOnlyIds?: string[];
  /**
   * Ask "Back after N weeks?" when one lift hasn't been logged in 3+ weeks (4.32, §11).
   * Off for now, no UI: it asked per lift with no regard for the rest of your training,
   * so a variation you rotated back to after months of the sibling got the question.
   */
  askAboutGaps?: boolean;
  /** The Previous column also shows today's target, "185 × 8 → 190 × 8" (4.27). Unset = on. */
  showNext?: boolean;
  /** Library updates already applied to existing rows (regrouping, seed.ts). Unset = 0. */
  librarySeed?: number;
  /** Home "Lately" lines already shown (so slipping shows once). */
  latelySeen?: string[];
  /** The Food tab (SPEC §14): body profile and setup answers. Unset until Food is first opened. */
  food?: FoodSettings;
  createdAt: number;
  updatedAt: number;
}

export type SuggestMode = 'off' | 'suggest' | 'auto';

// ───────────────────────────── food (SPEC §14, design/proposals/nutrition-plan.md)

export type MealId = 'breakfast' | 'lunch' | 'dinner' | 'snacks';
export type FoodSource = 'usda' | 'off' | 'custom';
/** The unit an amount was typed in. With an ml basis, g reads as ml and oz as fl oz. */
export type AmountUnit = 'g' | 'oz' | 'serv';
export type Activity = 1 | 2 | 3 | 4;
export type FoodGoal = 'lose' | 'maintain' | 'gain' | 'log';
export type DietId = 'lifter' | 'balanced' | 'highProtein' | 'lowCarb' | 'keto' | 'endurance' | 'custom';
/** Protein / carbs / fat, in that order. */
export type Triple = [number, number, number];

export interface FoodServing {
  /** "1 cup, chopped", "1 bar", "1 scoop". */
  label: string;
  grams: number;
}

export interface Food extends BaseRecord {
  name: string;
  /** Second line: USDA's full description, or a label note. */
  detail?: string;
  brand?: string;
  barcode?: string;
  source: FoodSource;
  fdcId?: number;
  offCode?: string;
  /** Per 100 g, or per 100 ml for liquids. */
  basis: 'g' | 'ml';
  per100: Nutrients;
  /** Nutrients borrowed from a similar USDA food ("Fill in missing nutrients", shown with ~). */
  estimated?: NutrientId[];
  filledFrom?: ID;
  servings: FoodServing[];
  /** Index into `servings`. */
  defaultServing?: number;
  /** Starred (the Saved chip). */
  favorite?: boolean;
  /** In your library (you made, logged, starred or scanned it). USDA rows are only in it once used. */
  mine?: boolean;
  /** The amount you logged last time, so the + disc repeats it. `grams` is in the basis unit. */
  last?: { grams: number; unit: AmountUnit; serving?: number };
  /** A copy made to edit a USDA or Open Food Facts food. */
  copiedFrom?: ID;
  deletedAt?: number;
}

export interface FoodEntry extends BaseRecord {
  /** The food day (3 am to 3 am, foodDayKey). */
  day: string;
  meal: MealId;
  order: number;
  loggedAt: number;
  /** Absent for quick add. */
  foodId?: ID;
  name: string;
  brand?: string;
  /** Amount in the food's basis unit (g or ml). Absent for quick add. */
  grams?: number;
  basis?: 'g' | 'ml';
  unit?: AmountUnit;
  serving?: number;
  /** The food's servings when logged, so the amount can be edited later without the food. */
  servings?: FoodServing[];
  /** Snapshot for this amount: editing the food later never changes a logged day. */
  totals: Nutrients;
  estimated?: NutrientId[];
  quick?: boolean;
  savedMealId?: ID;
  /** Groups a saved meal or a copied day, for one Undo. */
  batchId?: ID;
}

export interface SavedMealItem {
  foodId: ID;
  grams: number;
  unit: AmountUnit;
  serving?: number;
}

export interface SavedMeal extends BaseRecord {
  name: string;
  order: number;
  items: SavedMealItem[];
  deletedAt?: number;
}

/** A target version: the latest with `from` ≤ a day applies to it (like plan schedules). */
export interface FoodTarget extends BaseRecord {
  from: string;
  mode: 'target' | 'log';
  kcal?: number;
  diet: DietId;
  pct: Triple;
  grams: Triple;
  /** Per-nutrient target overrides; everything else comes from the DRI tables. */
  overrides?: Partial<Record<NutrientId, number>>;
  /** Sex and birth year when saved, so past days keep their micronutrient targets. */
  sex?: 'm' | 'f';
  birthYear?: number;
}

export interface FoodSettings {
  sex?: 'm' | 'f';
  birthYear?: number;
  heightIn?: number;
  weightLb?: number;
  activity?: Activity;
  goal?: FoodGoal;
  paceLb?: number;
  goalWeightLb?: number;
  /** The last Custom split, so picking Custom again restores it. */
  customPct?: Triple;
  /** Look up foods on Open Food Facts (Settings › Food). */
  online: boolean;
  /** Setup finished, or Just log picked. */
  setUp: boolean;
  /** USDA database release fully loaded into `foods`. */
  usdaRelease?: string;
}

export interface TrainingPhase {
  kind: PhaseKind;
  since: number;
  until?: number;
  /** Maintaining: goal deadlines move by the time spent here. */
  pauseGoals?: boolean;
}

/** A goal: weight × reps on one lift, optionally by a date (training-logic §18, proposal C). */
export interface Goal extends BaseRecord {
  exerciseId: ID;
  /** lb */
  weight: number;
  reps: number;
  by?: number;
  /** Trend value, rate (per week) and τ when the goal was set: the "should be here" curve. */
  startE1rm: number;
  startedAt: number;
  startRate: number;
  startTau: number;
  /** Set with your own rate (C3) because the data was too messy to project. */
  ownRate?: boolean;
  doneAt?: number;
  doneWorkoutId?: ID;
  /** The goal-done screen (C6) has been shown. */
  celebrated?: boolean;
  deletedAt?: number;
}

export const DEFAULT_SETTINGS: Omit<Settings, 'createdAt' | 'updatedAt'> = {
  id: 'settings',
  units: 'lb',
  theme: 'dark',
  weekStart: 0,
  weightStep: 5,
  barWeight: 45,
  dropPercent: 25,
  keepScreenOn: true,
  oneRmFormula: 'epley',
  pinnedExerciseIds: [],
  pinnedCustomized: false,
  historyView: 'calendar',
  effort: 'rir',
  effortAsk: 'every',
  effortIn1rm: false,
  onboarded: false,
  suggestMode: 'suggest',
  effortTarget: [0, 2],
  failureLastSetOnly: false,
  trainEverything: true,
  dismissedTips: [],
};

export const MUSCLES: { id: Muscle; label: string }[] = [
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'legs', label: 'Legs' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'arms', label: 'Arms' },
  { id: 'core', label: 'Core' },
  { id: 'other', label: 'Other' },
];

export const EQUIPMENT: { id: Equipment; label: string }[] = [
  { id: 'barbell', label: 'Barbell' },
  { id: 'dumbbell', label: 'Dumbbell' },
  { id: 'machine', label: 'Machine' },
  { id: 'cable', label: 'Cable' },
  { id: 'bodyweight', label: 'Bodyweight' },
  { id: 'other', label: 'Other' },
];

export const EXERCISE_TYPES: { id: ExerciseType; label: string; hint: string; example: string }[] = [
  { id: 'weight', label: 'Weight × reps', hint: 'Barbell, dumbbell, machine, cable', example: '185 × 8' },
  { id: 'bodyweight', label: 'Bodyweight', hint: 'Reps only', example: '12' },
  { id: 'bodyweight_plus', label: 'Bodyweight + added', hint: 'Dips or pull-ups with a belt', example: '+25 × 8' },
  { id: 'assisted', label: 'Assisted', hint: 'Assisted pull-up machine', example: '−40 × 10' },
  { id: 'cardio', label: 'Cardio', hint: 'Time plus up to two columns', example: '20:00 · 1.7 mi' },
];

export const areaLabel = (a: ExerciseArea) => (a === 'forearms' ? 'Forearms' : 'Lower back');
export const muscleLabel = (m: Muscle) => MUSCLES.find((x) => x.id === m)?.label ?? 'Other';
export const equipmentLabel = (e: Equipment) => EQUIPMENT.find((x) => x.id === e)?.label ?? 'Other';
