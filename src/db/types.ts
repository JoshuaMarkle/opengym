// Data model (SPEC §3). Weights are always stored in lb; convert at display.
// Every record has id (uuid), createdAt and updatedAt (epoch ms).

export type ID = string;

export type ExerciseType = 'weight' | 'bodyweight' | 'bodyweight_plus' | 'assisted' | 'cardio';

/**
 * Cardio columns besides time (SPEC §10). Up to two per exercise. `split500`,
 * `pace` and `avgSpeed` are worked out from time and distance, never typed.
 */
export type CardioColumn = 'distance' | 'speed' | 'incline' | 'level' | 'calories' | 'split500' | 'pace' | 'avgSpeed';
/** How a cardio exercise's distance is shown: follow the units setting (mi / km), or meters (rowers). */
export type DistanceUnit = 'auto' | 'm';
export type Muscle = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core' | 'other';
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
  isCustom: boolean;
  archived: boolean;
  deletedAt?: number;
  /** Cardio only: the columns after TIME, in order (max 2). */
  cardioColumns?: CardioColumn[];
  /** Cardio only: distance shown in mi/km (auto) or meters. */
  distanceUnit?: DistanceUnit;
  /** Cardio only: segments count toward the running distance records (D4). */
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

/** A one-off change to a single day (C2). */
export interface DayOverride {
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
  /** Missed days the user chose to skip (C3), so the note goes away. */
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
}

export interface Workout extends BaseRecord {
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
  /** false = Progress picks your 6 most frequent lifts automatically. */
  pinnedCustomized: boolean;
  lastBackupAt?: number;
  historyView: 'calendar' | 'list';
  onboarded: boolean;
  createdAt: number;
  updatedAt: number;
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
  onboarded: false,
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

export const muscleLabel = (m: Muscle) => MUSCLES.find((x) => x.id === m)?.label ?? 'Other';
export const equipmentLabel = (e: Equipment) => EQUIPMENT.find((x) => x.id === e)?.label ?? 'Other';
