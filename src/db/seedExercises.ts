import type { CardioColumn, DistanceUnit, Equipment, ExerciseArea, ExerciseType, Muscle } from './types';

/**
 * Built-in exercise library. IDs are deterministic (`ex-<slug>`) so backups,
 * imports and re-seeding always agree on which exercise is which.
 * Variation groups (`vg-…`) link exercises that replace each other.
 */
export interface SeedExercise {
  name: string;
  muscle: Muscle;
  equipment: Equipment;
  type?: ExerciseType;
  group?: string;
  /**
   * How many lifters you'd expect to have it in a log, 0–10 (design/proposals/exercise-popularity.html).
   * Orders lists, hides ≤ 3 until searched, breaks focus-lift ties. Never shown.
   */
  popularity: number;
  /** Adds "Forearms" / "Lower back" to the meta line and search; not a filter chip. */
  area?: ExerciseArea;
  /** Cardio presets (8.6): the columns after time. */
  cardio?: CardioColumn[];
  distanceUnit?: DistanceUnit;
  isRun?: boolean;
}


export const SEED_EXERCISES: SeedExercise[] = [
  // ── Chest
  { name: 'Bench Press', muscle: 'chest', equipment: 'barbell', group: 'vg-bench', popularity: 10 },
  { name: 'Incline Bench Press', muscle: 'chest', equipment: 'barbell', group: 'vg-bench', popularity: 7 },
  { name: 'DB Bench Press', muscle: 'chest', equipment: 'dumbbell', group: 'vg-bench', popularity: 8 },
  { name: 'Decline Bench Press', muscle: 'chest', equipment: 'barbell', popularity: 4 },
  { name: 'Smith Machine Bench Press', muscle: 'chest', equipment: 'machine', popularity: 5 },
  { name: 'Incline DB Press', muscle: 'chest', equipment: 'dumbbell', group: 'vg-incline', popularity: 8 },
  { name: 'Incline Machine Press', muscle: 'chest', equipment: 'machine', group: 'vg-incline', popularity: 6 },
  { name: 'Smith Machine Incline Press', muscle: 'chest', equipment: 'machine', group: 'vg-incline', popularity: 6 },
  { name: 'Decline DB Press', muscle: 'chest', equipment: 'dumbbell', popularity: 3 },
  { name: 'Machine Chest Press', muscle: 'chest', equipment: 'machine', popularity: 7 },
  { name: 'Floor Press', muscle: 'chest', equipment: 'barbell', popularity: 2 },
  { name: 'Cable Fly', muscle: 'chest', equipment: 'cable', group: 'vg-fly', popularity: 7 },
  { name: 'DB Fly', muscle: 'chest', equipment: 'dumbbell', group: 'vg-fly', popularity: 6 },
  { name: 'Pec Deck', muscle: 'chest', equipment: 'machine', group: 'vg-fly', popularity: 7 },
  { name: 'Incline DB Fly', muscle: 'chest', equipment: 'dumbbell', popularity: 5 },
  { name: 'Low-to-High Cable Fly', muscle: 'chest', equipment: 'cable', popularity: 5 },
  { name: 'High-to-Low Cable Fly', muscle: 'chest', equipment: 'cable', popularity: 4 },
  { name: 'Push-up', muscle: 'chest', equipment: 'bodyweight', type: 'bodyweight', popularity: 7 },
  { name: 'Weighted Push-up', muscle: 'chest', equipment: 'bodyweight', type: 'bodyweight_plus', popularity: 3 },
  { name: 'Dips', muscle: 'chest', equipment: 'bodyweight', type: 'bodyweight_plus', group: 'vg-dips', popularity: 7 },
  { name: 'Assisted Dips', muscle: 'chest', equipment: 'machine', type: 'assisted', group: 'vg-dips', popularity: 5 },
  { name: 'DB Pullover', muscle: 'chest', equipment: 'dumbbell', popularity: 4 },
  // Added with popularity (design/proposals/exercise-popularity.html §D)
  { name: 'Neutral-Grip DB Press', muscle: 'chest', equipment: 'dumbbell', group: 'vg-bench', popularity: 3 },
  { name: 'Wide-Grip Bench Press', muscle: 'chest', equipment: 'barbell', group: 'vg-bench', popularity: 2 },
  { name: 'Reverse-Grip Bench Press', muscle: 'chest', equipment: 'barbell', group: 'vg-bench', popularity: 1 },

  // ── Back
  { name: 'Deadlift', muscle: 'back', equipment: 'barbell', group: 'vg-deadlift', popularity: 9 },
  { name: 'Sumo Deadlift', muscle: 'back', equipment: 'barbell', group: 'vg-deadlift', popularity: 5 },
  { name: 'Trap Bar Deadlift', muscle: 'back', equipment: 'barbell', group: 'vg-deadlift', popularity: 6 },
  { name: 'Deficit Deadlift', muscle: 'back', equipment: 'barbell', popularity: 2 },
  { name: 'Rack Pull', muscle: 'back', equipment: 'barbell', popularity: 4 },
  { name: 'Pull-up', muscle: 'back', equipment: 'bodyweight', type: 'bodyweight', group: 'vg-pullup', popularity: 8 },
  { name: 'Weighted Pull-up', muscle: 'back', equipment: 'bodyweight', type: 'bodyweight_plus', group: 'vg-pullup', popularity: 5 },
  { name: 'Assisted Pull-up', muscle: 'back', equipment: 'machine', type: 'assisted', group: 'vg-pullup', popularity: 7 },
  { name: 'Chin-up', muscle: 'back', equipment: 'bodyweight', type: 'bodyweight', group: 'vg-chinup', popularity: 7 },
  { name: 'Weighted Chin-up', muscle: 'back', equipment: 'bodyweight', type: 'bodyweight_plus', group: 'vg-chinup', popularity: 3 },
  { name: 'Lat Pulldown', muscle: 'back', equipment: 'cable', group: 'vg-pulldown', popularity: 9 },
  { name: 'Close-Grip Lat Pulldown', muscle: 'back', equipment: 'cable', group: 'vg-pulldown', popularity: 7 },
  { name: 'Single-Arm Lat Pulldown', muscle: 'back', equipment: 'cable', group: 'vg-pulldown', popularity: 5 },
  { name: 'Barbell Row', muscle: 'back', equipment: 'barbell', group: 'vg-row', popularity: 8 },
  { name: 'Pendlay Row', muscle: 'back', equipment: 'barbell', group: 'vg-row', popularity: 4 },
  { name: 'DB Row', muscle: 'back', equipment: 'dumbbell', group: 'vg-row', popularity: 8 },
  { name: 'T-Bar Row', muscle: 'back', equipment: 'barbell', group: 'vg-row', popularity: 7 },
  { name: 'Chest-Supported Row', muscle: 'back', equipment: 'dumbbell', group: 'vg-row', popularity: 6 },
  { name: 'Seated Cable Row', muscle: 'back', equipment: 'cable', group: 'vg-cable-row', popularity: 8 },
  { name: 'Machine Row', muscle: 'back', equipment: 'machine', group: 'vg-cable-row', popularity: 7 },
  { name: 'Single-Arm Cable Row', muscle: 'back', equipment: 'cable', group: 'vg-cable-row', popularity: 5 },
  { name: 'Inverted Row', muscle: 'back', equipment: 'bodyweight', type: 'bodyweight', popularity: 4 },
  { name: 'Straight-Arm Pulldown', muscle: 'back', equipment: 'cable', popularity: 6 },
  { name: 'Cable Pullover', muscle: 'back', equipment: 'cable', popularity: 4 },
  { name: 'Barbell Shrug', muscle: 'back', equipment: 'barbell', group: 'vg-shrug', popularity: 6 },
  { name: 'DB Shrug', muscle: 'back', equipment: 'dumbbell', group: 'vg-shrug', popularity: 7 },
  { name: 'Back Extension', muscle: 'back', equipment: 'bodyweight', type: 'bodyweight_plus', group: 'vg-back-ext', area: 'lower back', popularity: 6 },
  { name: 'Good Morning', muscle: 'back', equipment: 'barbell', group: 'vg-good-morning', area: 'lower back', popularity: 3 },
  { name: 'Meadows Row', muscle: 'back', equipment: 'barbell', group: 'vg-row', popularity: 2 },
  // Added with popularity (design/proposals/exercise-popularity.html §D)
  { name: 'Neutral-Grip Lat Pulldown', muscle: 'back', equipment: 'cable', group: 'vg-pulldown', popularity: 6 },
  { name: 'Wide-Grip Cable Row', muscle: 'back', equipment: 'cable', group: 'vg-cable-row', popularity: 6 },
  { name: 'Wide-Grip Lat Pulldown', muscle: 'back', equipment: 'cable', group: 'vg-pulldown', popularity: 6 },
  { name: 'Chest-Supported T-Bar Row', muscle: 'back', equipment: 'machine', group: 'vg-row', popularity: 5 },
  { name: 'High Row', muscle: 'back', equipment: 'machine', group: 'vg-cable-row', popularity: 5 },
  { name: 'Low Row', muscle: 'back', equipment: 'machine', group: 'vg-cable-row', popularity: 5 },
  { name: 'Machine Back Extension', muscle: 'back', equipment: 'machine', group: 'vg-back-ext', area: 'lower back', popularity: 5 },
  { name: 'Machine Lat Pulldown', muscle: 'back', equipment: 'machine', group: 'vg-pulldown', popularity: 5 },
  { name: 'Neutral-Grip Pull-up', muscle: 'back', equipment: 'bodyweight', type: 'bodyweight', group: 'vg-pullup', popularity: 5 },
  { name: 'Reverse-Grip Lat Pulldown', muscle: 'back', equipment: 'cable', group: 'vg-pulldown', popularity: 5 },
  { name: 'Underhand Barbell Row', muscle: 'back', equipment: 'barbell', group: 'vg-row', popularity: 5 },
  { name: 'Single-Arm Machine Row', muscle: 'back', equipment: 'machine', group: 'vg-cable-row', popularity: 4 },
  { name: 'Wide-Grip Machine Row', muscle: 'back', equipment: 'machine', group: 'vg-cable-row', popularity: 4 },
  { name: 'Wide-Grip Pull-up', muscle: 'back', equipment: 'bodyweight', type: 'bodyweight', group: 'vg-pullup', popularity: 4 },
  { name: 'Reverse Hyperextension', muscle: 'back', equipment: 'machine', group: 'vg-back-ext', area: 'lower back', popularity: 3 },
  { name: 'Roman Chair Back Extension', muscle: 'back', equipment: 'bodyweight', type: 'bodyweight_plus', group: 'vg-back-ext', area: 'lower back', popularity: 3 },
  { name: 'Seal Row', muscle: 'back', equipment: 'barbell', group: 'vg-row', popularity: 3 },
  { name: 'Smith Machine Row', muscle: 'back', equipment: 'machine', group: 'vg-row', popularity: 3 },
  { name: 'Superman', muscle: 'back', equipment: 'bodyweight', type: 'bodyweight', group: 'vg-back-ext', area: 'lower back', popularity: 3 },
  { name: 'Underhand Cable Row', muscle: 'back', equipment: 'cable', group: 'vg-cable-row', popularity: 3 },
  { name: 'Wide-Grip Barbell Row', muscle: 'back', equipment: 'barbell', group: 'vg-row', popularity: 3 },
  { name: 'Jefferson Curl', muscle: 'back', equipment: 'barbell', area: 'lower back', popularity: 2 },
  { name: 'Kroc Row', muscle: 'back', equipment: 'dumbbell', group: 'vg-row', popularity: 2 },
  { name: 'Rope Cable Row', muscle: 'back', equipment: 'cable', group: 'vg-cable-row', popularity: 2 },
  { name: 'Snatch-Grip Deadlift', muscle: 'back', equipment: 'barbell', group: 'vg-deadlift', area: 'lower back', popularity: 2 },
  { name: 'Yates Row', muscle: 'back', equipment: 'barbell', group: 'vg-row', popularity: 2 },
  { name: 'Behind-the-Neck Pulldown', muscle: 'back', equipment: 'cable', group: 'vg-pulldown', popularity: 1 },
  { name: 'Helms Row', muscle: 'back', equipment: 'dumbbell', group: 'vg-row', popularity: 1 },
  { name: 'Seated Good Morning', muscle: 'back', equipment: 'barbell', group: 'vg-good-morning', area: 'lower back', popularity: 1 },

  // ── Legs
  { name: 'Squat', muscle: 'legs', equipment: 'barbell', group: 'vg-squat', popularity: 9 },
  { name: 'Front Squat', muscle: 'legs', equipment: 'barbell', group: 'vg-squat', popularity: 5 },
  { name: 'Safety Bar Squat', muscle: 'legs', equipment: 'barbell', group: 'vg-squat', popularity: 3 },
  { name: 'Pause Squat', muscle: 'legs', equipment: 'barbell', group: 'vg-squat', popularity: 2 },
  { name: 'Box Squat', muscle: 'legs', equipment: 'barbell', popularity: 2 },
  { name: 'Goblet Squat', muscle: 'legs', equipment: 'dumbbell', popularity: 6 },
  { name: 'Hack Squat', muscle: 'legs', equipment: 'machine', group: 'vg-machine-squat', popularity: 7 },
  { name: 'Smith Machine Squat', muscle: 'legs', equipment: 'machine', group: 'vg-machine-squat', popularity: 6 },
  { name: 'Pendulum Squat', muscle: 'legs', equipment: 'machine', group: 'vg-machine-squat', popularity: 4 },
  { name: 'Belt Squat', muscle: 'legs', equipment: 'machine', popularity: 3 },
  { name: 'Leg Press', muscle: 'legs', equipment: 'machine', group: 'vg-leg-press', popularity: 9 },
  { name: 'Single-Leg Press', muscle: 'legs', equipment: 'machine', group: 'vg-leg-press', popularity: 3 },
  { name: 'Romanian Deadlift', muscle: 'legs', equipment: 'barbell', group: 'vg-rdl', popularity: 8 },
  { name: 'DB Romanian Deadlift', muscle: 'legs', equipment: 'dumbbell', group: 'vg-rdl', popularity: 6 },
  { name: 'Stiff-Leg Deadlift', muscle: 'legs', equipment: 'barbell', group: 'vg-rdl', popularity: 4 },
  { name: 'Single-Leg RDL', muscle: 'legs', equipment: 'dumbbell', popularity: 4 },
  { name: 'Bulgarian Split Squat', muscle: 'legs', equipment: 'dumbbell', group: 'vg-split-squat', popularity: 7 },
  { name: 'Split Squat', muscle: 'legs', equipment: 'dumbbell', group: 'vg-split-squat', popularity: 5 },
  { name: 'Walking Lunge', muscle: 'legs', equipment: 'dumbbell', group: 'vg-lunge', popularity: 6 },
  { name: 'Reverse Lunge', muscle: 'legs', equipment: 'dumbbell', group: 'vg-lunge', popularity: 5 },
  { name: 'Barbell Lunge', muscle: 'legs', equipment: 'barbell', group: 'vg-lunge', popularity: 3 },
  { name: 'Step-up', muscle: 'legs', equipment: 'dumbbell', popularity: 4 },
  { name: 'Leg Extension', muscle: 'legs', equipment: 'machine', popularity: 8 },
  { name: 'Leg Curl', muscle: 'legs', equipment: 'machine', group: 'vg-leg-curl', popularity: 8 },
  { name: 'Seated Leg Curl', muscle: 'legs', equipment: 'machine', group: 'vg-leg-curl', popularity: 8 },
  { name: 'Nordic Curl', muscle: 'legs', equipment: 'bodyweight', type: 'bodyweight', popularity: 3 },
  { name: 'Hip Thrust', muscle: 'legs', equipment: 'barbell', group: 'vg-hip-thrust', popularity: 7 },
  { name: 'Machine Hip Thrust', muscle: 'legs', equipment: 'machine', group: 'vg-hip-thrust', popularity: 5 },
  { name: 'Glute Bridge', muscle: 'legs', equipment: 'barbell', popularity: 5 },
  { name: 'Cable Kickback', muscle: 'legs', equipment: 'cable', popularity: 5 },
  { name: 'Hip Abduction', muscle: 'legs', equipment: 'machine', popularity: 6 },
  { name: 'Hip Adduction', muscle: 'legs', equipment: 'machine', popularity: 6 },
  { name: 'Calf Raise', muscle: 'legs', equipment: 'machine', group: 'vg-calf', popularity: 7 },
  { name: 'Seated Calf Raise', muscle: 'legs', equipment: 'machine', group: 'vg-calf', popularity: 6 },
  { name: 'Leg Press Calf Raise', muscle: 'legs', equipment: 'machine', group: 'vg-calf', popularity: 5 },
  { name: 'Pistol Squat', muscle: 'legs', equipment: 'bodyweight', type: 'bodyweight', popularity: 2 },
  // Added with popularity (design/proposals/exercise-popularity.html §D)
  { name: 'Cable Pull-through', muscle: 'legs', equipment: 'cable', area: 'lower back', popularity: 4 },
  { name: 'Glute-Ham Raise', muscle: 'legs', equipment: 'bodyweight', type: 'bodyweight_plus', area: 'lower back', popularity: 3 },

  // ── Shoulders
  { name: 'Overhead Press', muscle: 'shoulders', equipment: 'barbell', group: 'vg-ohp', popularity: 8 },
  { name: 'DB Shoulder Press', muscle: 'shoulders', equipment: 'dumbbell', group: 'vg-ohp', popularity: 8 },
  { name: 'Machine Shoulder Press', muscle: 'shoulders', equipment: 'machine', group: 'vg-ohp', popularity: 7 },
  { name: 'Seated Barbell Press', muscle: 'shoulders', equipment: 'barbell', group: 'vg-ohp', popularity: 4 },
  { name: 'Smith Machine Shoulder Press', muscle: 'shoulders', equipment: 'machine', group: 'vg-ohp', popularity: 5 },
  { name: 'Push Press', muscle: 'shoulders', equipment: 'barbell', popularity: 3 },
  { name: 'Arnold Press', muscle: 'shoulders', equipment: 'dumbbell', popularity: 5 },
  { name: 'Landmine Press', muscle: 'shoulders', equipment: 'barbell', popularity: 3 },
  { name: 'Lateral Raise', muscle: 'shoulders', equipment: 'dumbbell', group: 'vg-lateral', popularity: 9 },
  { name: 'Cable Lateral Raise', muscle: 'shoulders', equipment: 'cable', group: 'vg-lateral', popularity: 7 },
  { name: 'Machine Lateral Raise', muscle: 'shoulders', equipment: 'machine', group: 'vg-lateral', popularity: 5 },
  { name: 'Front Raise', muscle: 'shoulders', equipment: 'dumbbell', popularity: 5 },
  { name: 'Rear Delt Fly', muscle: 'shoulders', equipment: 'dumbbell', group: 'vg-rear-delt', popularity: 6 },
  { name: 'Reverse Pec Deck', muscle: 'shoulders', equipment: 'machine', group: 'vg-rear-delt', popularity: 7 },
  { name: 'Cable Rear Delt Fly', muscle: 'shoulders', equipment: 'cable', group: 'vg-rear-delt', popularity: 5 },
  { name: 'Face Pull', muscle: 'shoulders', equipment: 'cable', popularity: 7 },
  { name: 'Upright Row', muscle: 'shoulders', equipment: 'barbell', popularity: 4 },
  { name: 'Handstand Push-up', muscle: 'shoulders', equipment: 'bodyweight', type: 'bodyweight', popularity: 1 },

  // ── Arms
  { name: 'Barbell Curl', muscle: 'arms', equipment: 'barbell', group: 'vg-curl', popularity: 8 },
  { name: 'EZ-Bar Curl', muscle: 'arms', equipment: 'barbell', group: 'vg-curl', popularity: 7 },
  { name: 'DB Curl', muscle: 'arms', equipment: 'dumbbell', group: 'vg-curl', popularity: 9 },
  { name: 'Cable Curl', muscle: 'arms', equipment: 'cable', group: 'vg-curl', popularity: 7 },
  { name: 'Hammer Curl', muscle: 'arms', equipment: 'dumbbell', group: 'vg-hammer', popularity: 8 },
  { name: 'Cable Hammer Curl', muscle: 'arms', equipment: 'cable', group: 'vg-hammer', popularity: 5 },
  { name: 'Incline DB Curl', muscle: 'arms', equipment: 'dumbbell', popularity: 6 },
  { name: 'Preacher Curl', muscle: 'arms', equipment: 'barbell', group: 'vg-preacher', popularity: 6 },
  { name: 'Machine Preacher Curl', muscle: 'arms', equipment: 'machine', group: 'vg-preacher', popularity: 5 },
  { name: 'Concentration Curl', muscle: 'arms', equipment: 'dumbbell', popularity: 4 },
  { name: 'Spider Curl', muscle: 'arms', equipment: 'dumbbell', popularity: 3 },
  { name: 'Reverse Curl', muscle: 'arms', equipment: 'barbell', group: 'vg-reverse-curl', area: 'forearms', popularity: 4 },
  { name: 'Wrist Curl', muscle: 'arms', equipment: 'dumbbell', group: 'vg-wrist-curl', area: 'forearms', popularity: 4 },
  { name: 'Triceps Pushdown', muscle: 'arms', equipment: 'cable', group: 'vg-pushdown', popularity: 8 },
  { name: 'Rope Pushdown', muscle: 'arms', equipment: 'cable', group: 'vg-pushdown', popularity: 8 },
  { name: 'Single-Arm Pushdown', muscle: 'arms', equipment: 'cable', group: 'vg-pushdown', popularity: 4 },
  { name: 'Overhead Cable Extension', muscle: 'arms', equipment: 'cable', group: 'vg-overhead-ext', popularity: 7 },
  { name: 'DB Overhead Extension', muscle: 'arms', equipment: 'dumbbell', group: 'vg-overhead-ext', popularity: 6 },
  { name: 'Skull Crusher', muscle: 'arms', equipment: 'barbell', popularity: 7 },
  { name: 'Close-Grip Bench Press', muscle: 'arms', equipment: 'barbell', popularity: 5 },
  { name: 'JM Press', muscle: 'arms', equipment: 'barbell', popularity: 1 },
  { name: 'Triceps Kickback', muscle: 'arms', equipment: 'dumbbell', popularity: 4 },
  { name: 'Bench Dips', muscle: 'arms', equipment: 'bodyweight', type: 'bodyweight', popularity: 4 },
  { name: 'Diamond Push-up', muscle: 'arms', equipment: 'bodyweight', type: 'bodyweight', popularity: 3 },
  // Added with popularity (design/proposals/exercise-popularity.html §D)
  { name: 'Bayesian Curl', muscle: 'arms', equipment: 'cable', group: 'vg-curl', popularity: 5 },
  { name: 'V-Bar Pushdown', muscle: 'arms', equipment: 'cable', group: 'vg-pushdown', popularity: 5 },
  { name: 'Barbell Wrist Curl', muscle: 'arms', equipment: 'barbell', group: 'vg-wrist-curl', area: 'forearms', popularity: 4 },
  { name: 'Cross-Body Hammer Curl', muscle: 'arms', equipment: 'dumbbell', group: 'vg-hammer', popularity: 4 },
  { name: 'Reverse EZ-Bar Curl', muscle: 'arms', equipment: 'barbell', group: 'vg-reverse-curl', area: 'forearms', popularity: 4 },
  { name: 'Reverse Wrist Curl', muscle: 'arms', equipment: 'dumbbell', group: 'vg-wrist-curl', area: 'forearms', popularity: 4 },
  { name: 'Wrist Roller', muscle: 'arms', equipment: 'other', area: 'forearms', popularity: 4 },
  { name: 'Behind-the-Back Wrist Curl', muscle: 'arms', equipment: 'barbell', group: 'vg-wrist-curl', area: 'forearms', popularity: 3 },
  { name: 'Cable Reverse Curl', muscle: 'arms', equipment: 'cable', group: 'vg-reverse-curl', area: 'forearms', popularity: 3 },
  { name: 'DB Reverse Curl', muscle: 'arms', equipment: 'dumbbell', group: 'vg-reverse-curl', area: 'forearms', popularity: 3 },
  { name: 'Hand Gripper', muscle: 'arms', equipment: 'other', type: 'bodyweight', area: 'forearms', popularity: 3 },
  { name: 'Reverse-Grip Pushdown', muscle: 'arms', equipment: 'cable', group: 'vg-pushdown', popularity: 3 },
  { name: 'Zottman Curl', muscle: 'arms', equipment: 'dumbbell', group: 'vg-reverse-curl', area: 'forearms', popularity: 3 },
  { name: 'Cable Wrist Curl', muscle: 'arms', equipment: 'cable', group: 'vg-wrist-curl', area: 'forearms', popularity: 2 },
  { name: 'DB Wrist Rotation', muscle: 'arms', equipment: 'dumbbell', area: 'forearms', popularity: 1 },
  { name: 'Radial Deviation', muscle: 'arms', equipment: 'dumbbell', area: 'forearms', popularity: 0 },

  // ── Core
  { name: 'Crunch', muscle: 'core', equipment: 'bodyweight', type: 'bodyweight', popularity: 6 },
  { name: 'Cable Crunch', muscle: 'core', equipment: 'cable', popularity: 6 },
  { name: 'Machine Crunch', muscle: 'core', equipment: 'machine', popularity: 5 },
  { name: 'Sit-up', muscle: 'core', equipment: 'bodyweight', type: 'bodyweight', popularity: 5 },
  { name: 'Decline Sit-up', muscle: 'core', equipment: 'bodyweight', type: 'bodyweight_plus', popularity: 4 },
  { name: 'Hanging Leg Raise', muscle: 'core', equipment: 'bodyweight', type: 'bodyweight', group: 'vg-leg-raise', popularity: 6 },
  { name: 'Hanging Knee Raise', muscle: 'core', equipment: 'bodyweight', type: 'bodyweight', group: 'vg-leg-raise', popularity: 5 },
  { name: 'Lying Leg Raise', muscle: 'core', equipment: 'bodyweight', type: 'bodyweight', group: 'vg-leg-raise', popularity: 4 },
  { name: 'Ab Wheel Rollout', muscle: 'core', equipment: 'other', type: 'bodyweight', popularity: 5 },
  { name: 'Russian Twist', muscle: 'core', equipment: 'other', type: 'bodyweight_plus', popularity: 4 },
  { name: 'Pallof Press', muscle: 'core', equipment: 'cable', popularity: 3 },
  { name: 'Cable Woodchopper', muscle: 'core', equipment: 'cable', popularity: 3 },
  { name: 'DB Side Bend', muscle: 'core', equipment: 'dumbbell', popularity: 3 },
  { name: 'Dead Bug', muscle: 'core', equipment: 'bodyweight', type: 'bodyweight', popularity: 3 },
  // Added with popularity (design/proposals/exercise-popularity.html §D)
  { name: 'Bird Dog', muscle: 'core', equipment: 'bodyweight', type: 'bodyweight', area: 'lower back', popularity: 2 },

  // ── Full body / other
  { name: 'Power Clean', muscle: 'other', equipment: 'barbell', popularity: 3 },
  { name: 'Hang Clean', muscle: 'other', equipment: 'barbell', popularity: 2 },
  { name: 'Clean and Jerk', muscle: 'other', equipment: 'barbell', popularity: 1 },
  { name: 'Snatch', muscle: 'other', equipment: 'barbell', popularity: 1 },
  { name: 'Thruster', muscle: 'other', equipment: 'barbell', popularity: 2 },
  { name: 'Kettlebell Swing', muscle: 'other', equipment: 'other', popularity: 4 },
  { name: 'Turkish Get-up', muscle: 'other', equipment: 'other', popularity: 1 },

  // ── Cardio presets (8.6): ordinary cardio exercises with their columns picked
  { name: 'Treadmill', muscle: 'other', equipment: 'machine', type: 'cardio', cardio: ['distance', 'pace'], isRun: true, popularity: 9 },
  { name: 'Bike', muscle: 'other', equipment: 'machine', type: 'cardio', cardio: ['distance', 'level'], popularity: 7 },
  { name: 'Rower', muscle: 'other', equipment: 'machine', type: 'cardio', cardio: ['distance', 'split500'], distanceUnit: 'm', popularity: 6 },
  { name: 'Stair Climber', muscle: 'other', equipment: 'machine', type: 'cardio', cardio: ['steps'], popularity: 7 },
  { name: 'Elliptical', muscle: 'other', equipment: 'machine', type: 'cardio', cardio: ['distance', 'level'], popularity: 6 },
  { name: 'Run / Walk Outside', muscle: 'other', equipment: 'other', type: 'cardio', cardio: ['distance', 'pace'], isRun: true, popularity: 7 },
  { name: 'Jump Rope', muscle: 'other', equipment: 'other', type: 'cardio', cardio: [], popularity: 3 },
  { name: 'Generic Cardio', muscle: 'other', equipment: 'other', type: 'cardio', cardio: [], popularity: 5 },
];


export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export const seedExerciseId = (name: string) => `ex-${slugify(name)}`;

/**
 * Compound lifts in the built-in library (training-logic §14): they set each lift's
 * pace prior, and the default focus lifts come from them. Everything else is isolation;
 * custom exercises count as "DB / machine compound".
 */
export const COMPOUND_NAMES = [
  'Bench Press', 'Incline Bench Press', 'DB Bench Press', 'Decline Bench Press', 'Smith Machine Bench Press', 'Incline DB Press', 'Incline Machine Press',
  'Smith Machine Incline Press', 'Decline DB Press', 'Machine Chest Press', 'Floor Press', 'Push-up', 'Weighted Push-up', 'Dips', 'Assisted Dips',
  'Deadlift', 'Sumo Deadlift', 'Trap Bar Deadlift', 'Deficit Deadlift', 'Rack Pull', 'Pull-up', 'Weighted Pull-up', 'Assisted Pull-up', 'Chin-up',
  'Weighted Chin-up', 'Lat Pulldown', 'Close-Grip Lat Pulldown', 'Single-Arm Lat Pulldown', 'Barbell Row', 'Pendlay Row', 'DB Row', 'T-Bar Row',
  'Chest-Supported Row', 'Seated Cable Row', 'Machine Row', 'Single-Arm Cable Row', 'Inverted Row', 'Good Morning', 'Meadows Row', 'Squat', 'Front Squat',
  'Safety Bar Squat', 'Pause Squat', 'Box Squat', 'Goblet Squat', 'Hack Squat', 'Smith Machine Squat', 'Pendulum Squat', 'Belt Squat', 'Leg Press',
  'Single-Leg Press', 'Romanian Deadlift', 'DB Romanian Deadlift', 'Stiff-Leg Deadlift', 'Single-Leg RDL', 'Bulgarian Split Squat', 'Split Squat',
  'Walking Lunge', 'Reverse Lunge', 'Barbell Lunge', 'Step-up', 'Hip Thrust', 'Machine Hip Thrust', 'Pistol Squat', 'Overhead Press', 'DB Shoulder Press',
  'Machine Shoulder Press', 'Seated Barbell Press', 'Smith Machine Shoulder Press', 'Push Press', 'Arnold Press', 'Landmine Press', 'Handstand Push-up',
  'Close-Grip Bench Press', 'JM Press', 'Power Clean', 'Hang Clean', 'Clean and Jerk', 'Snatch', 'Thruster',
  // Grip variations added with popularity: back and chest presses, pulls and rows.
  'Underhand Barbell Row', 'Wide-Grip Barbell Row', 'Chest-Supported T-Bar Row', 'Seal Row', 'Smith Machine Row', 'Kroc Row', 'Yates Row',
  'Helms Row', 'Wide-Grip Cable Row', 'Underhand Cable Row', 'Rope Cable Row', 'High Row', 'Low Row', 'Wide-Grip Machine Row', 'Single-Arm Machine Row',
  'Wide-Grip Lat Pulldown', 'Neutral-Grip Lat Pulldown', 'Reverse-Grip Lat Pulldown', 'Machine Lat Pulldown', 'Behind-the-Neck Pulldown',
  'Neutral-Grip Pull-up', 'Wide-Grip Pull-up', 'Neutral-Grip DB Press', 'Wide-Grip Bench Press', 'Reverse-Grip Bench Press',
];

/**
 * Built-ins that joined a variation group in a library update. Applied once
 * (`Settings.librarySeed`), and only to rows the user hasn't linked elsewhere.
 */
export const REGROUPED: { version: number; ids: string[] }[] = [
  { version: 1, ids: ['Meadows Row', 'Back Extension', 'Good Morning', 'Reverse Curl', 'Wrist Curl'].map(seedExerciseId) },
];
export const LIBRARY_SEED_VERSION = 1;
export const COMPOUND_IDS = new Set(COMPOUND_NAMES.map(seedExerciseId));

/** Names of the built-in variation groups, for the "All N" sheet (B2). */
export const GROUP_LABELS: Record<string, string> = {
  'vg-row': 'Rows (free weight)',
  'vg-cable-row': 'Rows (cable and machine)',
  'vg-pulldown': 'Lat pulldowns',
  'vg-bench': 'Bench press',
  'vg-back-ext': 'Back extensions',
  'vg-curl': 'Curls',
  'vg-ohp': 'Overhead press',
  'vg-pullup': 'Pull-ups',
  'vg-pushdown': 'Pushdowns',
  'vg-reverse-curl': 'Reverse curls',
  'vg-wrist-curl': 'Wrist curls',
  'vg-deadlift': 'Deadlifts',
  'vg-squat': 'Squats',
  'vg-calf': 'Calf raises',
  'vg-fly': 'Flys',
  'vg-hammer': 'Hammer curls',
  'vg-incline': 'Incline press',
  'vg-lateral': 'Lateral raises',
  'vg-leg-raise': 'Leg raises',
  'vg-lunge': 'Lunges',
  'vg-machine-squat': 'Machine squats',
  'vg-rdl': 'Romanian deadlifts',
  'vg-rear-delt': 'Rear delts',
  'vg-chinup': 'Chin-ups',
  'vg-dips': 'Dips',
  'vg-good-morning': 'Good mornings',
  'vg-hip-thrust': 'Hip thrusts',
  'vg-leg-curl': 'Leg curls',
  'vg-leg-press': 'Leg press',
  'vg-overhead-ext': 'Overhead extensions',
  'vg-preacher': 'Preacher curls',
  'vg-shrug': 'Shrugs',
  'vg-split-squat': 'Split squats',
};
