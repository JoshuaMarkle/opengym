// Data model (SPEC §3). Weights are always stored in lb; convert at display.
// Every record has id (uuid), createdAt and updatedAt (epoch ms).

export type ID = string;

export type ExerciseType = 'weight' | 'bodyweight' | 'bodyweight_plus' | 'assisted';
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
}

export interface Folder extends BaseRecord {
  name: string;
  order: number;
  active: boolean; // exactly one non-archived folder is active (when any exist)
  archived: boolean;
  deletedAt?: number;
}

export interface Routine extends BaseRecord {
  name: string;
  folderId?: ID;
  order: number;
  notes?: string;
  deletedAt?: number;
}

export interface RoutineExercise extends BaseRecord {
  routineId: ID;
  exerciseId: ID;
  order: number;
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
];

export const muscleLabel = (m: Muscle) => MUSCLES.find((x) => x.id === m)?.label ?? 'Other';
export const equipmentLabel = (e: Equipment) => EQUIPMENT.find((x) => x.id === e)?.label ?? 'Other';
