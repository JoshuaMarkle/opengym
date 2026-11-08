import type { CardioColumn, DistanceUnit, Equipment, ExerciseType, Muscle } from './types';

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
  /** Cardio presets (C6): the columns after time. */
  cardio?: CardioColumn[];
  distanceUnit?: DistanceUnit;
  isRun?: boolean;
}


export const SEED_EXERCISES: SeedExercise[] = [
  // ── Chest
  { name: 'Bench Press', muscle: 'chest', equipment: 'barbell', group: 'vg-bench' },
  { name: 'Incline Bench Press', muscle: 'chest', equipment: 'barbell', group: 'vg-bench' },
  { name: 'DB Bench Press', muscle: 'chest', equipment: 'dumbbell', group: 'vg-bench' },
  { name: 'Decline Bench Press', muscle: 'chest', equipment: 'barbell' },
  { name: 'Smith Machine Bench Press', muscle: 'chest', equipment: 'machine' },
  { name: 'Incline DB Press', muscle: 'chest', equipment: 'dumbbell', group: 'vg-incline' },
  { name: 'Incline Machine Press', muscle: 'chest', equipment: 'machine', group: 'vg-incline' },
  { name: 'Smith Machine Incline Press', muscle: 'chest', equipment: 'machine', group: 'vg-incline' },
  { name: 'Decline DB Press', muscle: 'chest', equipment: 'dumbbell' },
  { name: 'Machine Chest Press', muscle: 'chest', equipment: 'machine' },
  { name: 'Floor Press', muscle: 'chest', equipment: 'barbell' },
  { name: 'Cable Fly', muscle: 'chest', equipment: 'cable', group: 'vg-fly' },
  { name: 'DB Fly', muscle: 'chest', equipment: 'dumbbell', group: 'vg-fly' },
  { name: 'Pec Deck', muscle: 'chest', equipment: 'machine', group: 'vg-fly' },
  { name: 'Incline DB Fly', muscle: 'chest', equipment: 'dumbbell' },
  { name: 'Low-to-High Cable Fly', muscle: 'chest', equipment: 'cable' },
  { name: 'High-to-Low Cable Fly', muscle: 'chest', equipment: 'cable' },
  { name: 'Push-up', muscle: 'chest', equipment: 'bodyweight', type: 'bodyweight' },
  { name: 'Weighted Push-up', muscle: 'chest', equipment: 'bodyweight', type: 'bodyweight_plus' },
  { name: 'Dips', muscle: 'chest', equipment: 'bodyweight', type: 'bodyweight_plus', group: 'vg-dips' },
  { name: 'Assisted Dips', muscle: 'chest', equipment: 'machine', type: 'assisted', group: 'vg-dips' },
  { name: 'DB Pullover', muscle: 'chest', equipment: 'dumbbell' },

  // ── Back
  { name: 'Deadlift', muscle: 'back', equipment: 'barbell', group: 'vg-deadlift' },
  { name: 'Sumo Deadlift', muscle: 'back', equipment: 'barbell', group: 'vg-deadlift' },
  { name: 'Trap Bar Deadlift', muscle: 'back', equipment: 'barbell', group: 'vg-deadlift' },
  { name: 'Deficit Deadlift', muscle: 'back', equipment: 'barbell' },
  { name: 'Rack Pull', muscle: 'back', equipment: 'barbell' },
  { name: 'Pull-up', muscle: 'back', equipment: 'bodyweight', type: 'bodyweight', group: 'vg-pullup' },
  { name: 'Weighted Pull-up', muscle: 'back', equipment: 'bodyweight', type: 'bodyweight_plus', group: 'vg-pullup' },
  { name: 'Assisted Pull-up', muscle: 'back', equipment: 'machine', type: 'assisted', group: 'vg-pullup' },
  { name: 'Chin-up', muscle: 'back', equipment: 'bodyweight', type: 'bodyweight', group: 'vg-chinup' },
  { name: 'Weighted Chin-up', muscle: 'back', equipment: 'bodyweight', type: 'bodyweight_plus', group: 'vg-chinup' },
  { name: 'Lat Pulldown', muscle: 'back', equipment: 'cable', group: 'vg-pulldown' },
  { name: 'Close-Grip Lat Pulldown', muscle: 'back', equipment: 'cable', group: 'vg-pulldown' },
  { name: 'Single-Arm Lat Pulldown', muscle: 'back', equipment: 'cable', group: 'vg-pulldown' },
  { name: 'Barbell Row', muscle: 'back', equipment: 'barbell', group: 'vg-row' },
  { name: 'Pendlay Row', muscle: 'back', equipment: 'barbell', group: 'vg-row' },
  { name: 'DB Row', muscle: 'back', equipment: 'dumbbell', group: 'vg-row' },
  { name: 'T-Bar Row', muscle: 'back', equipment: 'barbell', group: 'vg-row' },
  { name: 'Chest-Supported Row', muscle: 'back', equipment: 'dumbbell', group: 'vg-row' },
  { name: 'Seated Cable Row', muscle: 'back', equipment: 'cable', group: 'vg-cable-row' },
  { name: 'Machine Row', muscle: 'back', equipment: 'machine', group: 'vg-cable-row' },
  { name: 'Single-Arm Cable Row', muscle: 'back', equipment: 'cable', group: 'vg-cable-row' },
  { name: 'Inverted Row', muscle: 'back', equipment: 'bodyweight', type: 'bodyweight' },
  { name: 'Straight-Arm Pulldown', muscle: 'back', equipment: 'cable' },
  { name: 'Cable Pullover', muscle: 'back', equipment: 'cable' },
  { name: 'Barbell Shrug', muscle: 'back', equipment: 'barbell', group: 'vg-shrug' },
  { name: 'DB Shrug', muscle: 'back', equipment: 'dumbbell', group: 'vg-shrug' },
  { name: 'Back Extension', muscle: 'back', equipment: 'bodyweight', type: 'bodyweight_plus' },
  { name: 'Good Morning', muscle: 'back', equipment: 'barbell' },
  { name: 'Meadows Row', muscle: 'back', equipment: 'barbell' },

  // ── Legs
  { name: 'Squat', muscle: 'legs', equipment: 'barbell', group: 'vg-squat' },
  { name: 'Front Squat', muscle: 'legs', equipment: 'barbell', group: 'vg-squat' },
  { name: 'Safety Bar Squat', muscle: 'legs', equipment: 'barbell', group: 'vg-squat' },
  { name: 'Pause Squat', muscle: 'legs', equipment: 'barbell', group: 'vg-squat' },
  { name: 'Box Squat', muscle: 'legs', equipment: 'barbell' },
  { name: 'Goblet Squat', muscle: 'legs', equipment: 'dumbbell' },
  { name: 'Hack Squat', muscle: 'legs', equipment: 'machine', group: 'vg-machine-squat' },
  { name: 'Smith Machine Squat', muscle: 'legs', equipment: 'machine', group: 'vg-machine-squat' },
  { name: 'Pendulum Squat', muscle: 'legs', equipment: 'machine', group: 'vg-machine-squat' },
  { name: 'Belt Squat', muscle: 'legs', equipment: 'machine' },
  { name: 'Leg Press', muscle: 'legs', equipment: 'machine', group: 'vg-leg-press' },
  { name: 'Single-Leg Press', muscle: 'legs', equipment: 'machine', group: 'vg-leg-press' },
  { name: 'Romanian Deadlift', muscle: 'legs', equipment: 'barbell', group: 'vg-rdl' },
  { name: 'DB Romanian Deadlift', muscle: 'legs', equipment: 'dumbbell', group: 'vg-rdl' },
  { name: 'Stiff-Leg Deadlift', muscle: 'legs', equipment: 'barbell', group: 'vg-rdl' },
  { name: 'Single-Leg RDL', muscle: 'legs', equipment: 'dumbbell' },
  { name: 'Bulgarian Split Squat', muscle: 'legs', equipment: 'dumbbell', group: 'vg-split-squat' },
  { name: 'Split Squat', muscle: 'legs', equipment: 'dumbbell', group: 'vg-split-squat' },
  { name: 'Walking Lunge', muscle: 'legs', equipment: 'dumbbell', group: 'vg-lunge' },
  { name: 'Reverse Lunge', muscle: 'legs', equipment: 'dumbbell', group: 'vg-lunge' },
  { name: 'Barbell Lunge', muscle: 'legs', equipment: 'barbell', group: 'vg-lunge' },
  { name: 'Step-up', muscle: 'legs', equipment: 'dumbbell' },
  { name: 'Leg Extension', muscle: 'legs', equipment: 'machine' },
  { name: 'Leg Curl', muscle: 'legs', equipment: 'machine', group: 'vg-leg-curl' },
  { name: 'Seated Leg Curl', muscle: 'legs', equipment: 'machine', group: 'vg-leg-curl' },
  { name: 'Nordic Curl', muscle: 'legs', equipment: 'bodyweight', type: 'bodyweight' },
  { name: 'Hip Thrust', muscle: 'legs', equipment: 'barbell', group: 'vg-hip-thrust' },
  { name: 'Machine Hip Thrust', muscle: 'legs', equipment: 'machine', group: 'vg-hip-thrust' },
  { name: 'Glute Bridge', muscle: 'legs', equipment: 'barbell' },
  { name: 'Cable Kickback', muscle: 'legs', equipment: 'cable' },
  { name: 'Hip Abduction', muscle: 'legs', equipment: 'machine' },
  { name: 'Hip Adduction', muscle: 'legs', equipment: 'machine' },
  { name: 'Calf Raise', muscle: 'legs', equipment: 'machine', group: 'vg-calf' },
  { name: 'Seated Calf Raise', muscle: 'legs', equipment: 'machine', group: 'vg-calf' },
  { name: 'Leg Press Calf Raise', muscle: 'legs', equipment: 'machine', group: 'vg-calf' },
  { name: 'Pistol Squat', muscle: 'legs', equipment: 'bodyweight', type: 'bodyweight' },

  // ── Shoulders
  { name: 'Overhead Press', muscle: 'shoulders', equipment: 'barbell', group: 'vg-ohp' },
  { name: 'DB Shoulder Press', muscle: 'shoulders', equipment: 'dumbbell', group: 'vg-ohp' },
  { name: 'Machine Shoulder Press', muscle: 'shoulders', equipment: 'machine', group: 'vg-ohp' },
  { name: 'Seated Barbell Press', muscle: 'shoulders', equipment: 'barbell', group: 'vg-ohp' },
  { name: 'Smith Machine Shoulder Press', muscle: 'shoulders', equipment: 'machine', group: 'vg-ohp' },
  { name: 'Push Press', muscle: 'shoulders', equipment: 'barbell' },
  { name: 'Arnold Press', muscle: 'shoulders', equipment: 'dumbbell' },
  { name: 'Landmine Press', muscle: 'shoulders', equipment: 'barbell' },
  { name: 'Lateral Raise', muscle: 'shoulders', equipment: 'dumbbell', group: 'vg-lateral' },
  { name: 'Cable Lateral Raise', muscle: 'shoulders', equipment: 'cable', group: 'vg-lateral' },
  { name: 'Machine Lateral Raise', muscle: 'shoulders', equipment: 'machine', group: 'vg-lateral' },
  { name: 'Front Raise', muscle: 'shoulders', equipment: 'dumbbell' },
  { name: 'Rear Delt Fly', muscle: 'shoulders', equipment: 'dumbbell', group: 'vg-rear-delt' },
  { name: 'Reverse Pec Deck', muscle: 'shoulders', equipment: 'machine', group: 'vg-rear-delt' },
  { name: 'Cable Rear Delt Fly', muscle: 'shoulders', equipment: 'cable', group: 'vg-rear-delt' },
  { name: 'Face Pull', muscle: 'shoulders', equipment: 'cable' },
  { name: 'Upright Row', muscle: 'shoulders', equipment: 'barbell' },
  { name: 'Handstand Push-up', muscle: 'shoulders', equipment: 'bodyweight', type: 'bodyweight' },

  // ── Arms
  { name: 'Barbell Curl', muscle: 'arms', equipment: 'barbell', group: 'vg-curl' },
  { name: 'EZ-Bar Curl', muscle: 'arms', equipment: 'barbell', group: 'vg-curl' },
  { name: 'DB Curl', muscle: 'arms', equipment: 'dumbbell', group: 'vg-curl' },
  { name: 'Cable Curl', muscle: 'arms', equipment: 'cable', group: 'vg-curl' },
  { name: 'Hammer Curl', muscle: 'arms', equipment: 'dumbbell', group: 'vg-hammer' },
  { name: 'Cable Hammer Curl', muscle: 'arms', equipment: 'cable', group: 'vg-hammer' },
  { name: 'Incline DB Curl', muscle: 'arms', equipment: 'dumbbell' },
  { name: 'Preacher Curl', muscle: 'arms', equipment: 'barbell', group: 'vg-preacher' },
  { name: 'Machine Preacher Curl', muscle: 'arms', equipment: 'machine', group: 'vg-preacher' },
  { name: 'Concentration Curl', muscle: 'arms', equipment: 'dumbbell' },
  { name: 'Spider Curl', muscle: 'arms', equipment: 'dumbbell' },
  { name: 'Reverse Curl', muscle: 'arms', equipment: 'barbell' },
  { name: 'Wrist Curl', muscle: 'arms', equipment: 'dumbbell' },
  { name: 'Triceps Pushdown', muscle: 'arms', equipment: 'cable', group: 'vg-pushdown' },
  { name: 'Rope Pushdown', muscle: 'arms', equipment: 'cable', group: 'vg-pushdown' },
  { name: 'Single-Arm Pushdown', muscle: 'arms', equipment: 'cable', group: 'vg-pushdown' },
  { name: 'Overhead Cable Extension', muscle: 'arms', equipment: 'cable', group: 'vg-overhead-ext' },
  { name: 'DB Overhead Extension', muscle: 'arms', equipment: 'dumbbell', group: 'vg-overhead-ext' },
  { name: 'Skull Crusher', muscle: 'arms', equipment: 'barbell' },
  { name: 'Close-Grip Bench Press', muscle: 'arms', equipment: 'barbell' },
  { name: 'JM Press', muscle: 'arms', equipment: 'barbell' },
  { name: 'Triceps Kickback', muscle: 'arms', equipment: 'dumbbell' },
  { name: 'Bench Dips', muscle: 'arms', equipment: 'bodyweight', type: 'bodyweight' },
  { name: 'Diamond Push-up', muscle: 'arms', equipment: 'bodyweight', type: 'bodyweight' },

  // ── Core
  { name: 'Crunch', muscle: 'core', equipment: 'bodyweight', type: 'bodyweight' },
  { name: 'Cable Crunch', muscle: 'core', equipment: 'cable' },
  { name: 'Machine Crunch', muscle: 'core', equipment: 'machine' },
  { name: 'Sit-up', muscle: 'core', equipment: 'bodyweight', type: 'bodyweight' },
  { name: 'Decline Sit-up', muscle: 'core', equipment: 'bodyweight', type: 'bodyweight_plus' },
  { name: 'Hanging Leg Raise', muscle: 'core', equipment: 'bodyweight', type: 'bodyweight', group: 'vg-leg-raise' },
  { name: 'Hanging Knee Raise', muscle: 'core', equipment: 'bodyweight', type: 'bodyweight', group: 'vg-leg-raise' },
  { name: 'Lying Leg Raise', muscle: 'core', equipment: 'bodyweight', type: 'bodyweight', group: 'vg-leg-raise' },
  { name: 'Ab Wheel Rollout', muscle: 'core', equipment: 'other', type: 'bodyweight' },
  { name: 'Russian Twist', muscle: 'core', equipment: 'other', type: 'bodyweight_plus' },
  { name: 'Pallof Press', muscle: 'core', equipment: 'cable' },
  { name: 'Cable Woodchopper', muscle: 'core', equipment: 'cable' },
  { name: 'DB Side Bend', muscle: 'core', equipment: 'dumbbell' },
  { name: 'Dead Bug', muscle: 'core', equipment: 'bodyweight', type: 'bodyweight' },

  // ── Full body / other
  { name: 'Power Clean', muscle: 'other', equipment: 'barbell' },
  { name: 'Hang Clean', muscle: 'other', equipment: 'barbell' },
  { name: 'Clean and Jerk', muscle: 'other', equipment: 'barbell' },
  { name: 'Snatch', muscle: 'other', equipment: 'barbell' },
  { name: 'Thruster', muscle: 'other', equipment: 'barbell' },
  { name: 'Kettlebell Swing', muscle: 'other', equipment: 'other' },
  { name: 'Turkish Get-up', muscle: 'other', equipment: 'other' },

  // ── Cardio presets (C6): ordinary cardio exercises with their columns picked
  { name: 'Treadmill', muscle: 'other', equipment: 'machine', type: 'cardio', cardio: ['distance', 'pace'], isRun: true },
  { name: 'Bike', muscle: 'other', equipment: 'machine', type: 'cardio', cardio: ['distance', 'level'] },
  { name: 'Rower', muscle: 'other', equipment: 'machine', type: 'cardio', cardio: ['distance', 'split500'], distanceUnit: 'm' },
  { name: 'Stair Climber', muscle: 'other', equipment: 'machine', type: 'cardio', cardio: ['steps'] },
  { name: 'Elliptical', muscle: 'other', equipment: 'machine', type: 'cardio', cardio: ['distance', 'level'] },
  { name: 'Run / Walk Outside', muscle: 'other', equipment: 'other', type: 'cardio', cardio: ['distance', 'pace'], isRun: true },
  { name: 'Jump Rope', muscle: 'other', equipment: 'other', type: 'cardio', cardio: [] },
  { name: 'Generic Cardio', muscle: 'other', equipment: 'other', type: 'cardio', cardio: [] },
];


export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export const seedExerciseId = (name: string) => `ex-${slugify(name)}`;
