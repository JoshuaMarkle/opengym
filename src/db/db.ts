import Dexie, { type EntityTable } from 'dexie';
import type {
  Exercise,
  Folder,
  Goal,
  Routine,
  RoutineExercise,
  RoutineSet,
  Settings,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from './types';
import { TEST_MODE } from './testMode';

export class OpenGymDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  folders!: EntityTable<Folder, 'id'>;
  routines!: EntityTable<Routine, 'id'>;
  routineExercises!: EntityTable<RoutineExercise, 'id'>;
  routineSets!: EntityTable<RoutineSet, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  workoutExercises!: EntityTable<WorkoutExercise, 'id'>;
  workoutSets!: EntityTable<WorkoutSet, 'id'>;
  settings!: EntityTable<Settings, 'id'>;
  goals!: EntityTable<Goal, 'id'>;

  constructor(name = 'opengym') {
    super(name);
    this.version(1).stores({
      exercises: 'id, name, variationGroupId',
      folders: 'id, order',
      routines: 'id, folderId, order',
      routineExercises: 'id, routineId, exerciseId',
      routineSets: 'id, routineExerciseId',
      workouts: 'id, status, startedAt, routineId',
      workoutExercises: 'id, workoutId, exerciseId',
      workoutSets: 'id, workoutExerciseId',
      settings: 'id',
    });
    // Training goals (design/training-logic.html §18).
    this.version(2).stores({ goals: 'id, exerciseId' });
  }

  get allTables() {
    return [
      this.exercises,
      this.folders,
      this.routines,
      this.routineExercises,
      this.routineSets,
      this.workouts,
      this.workoutExercises,
      this.workoutSets,
      this.settings,
      this.goals,
    ];
  }
}

export const db = new OpenGymDB(TEST_MODE ? 'opengym-test' : 'opengym');

export const TABLE_NAMES = [
  'exercises',
  'folders',
  'routines',
  'routineExercises',
  'routineSets',
  'workouts',
  'workoutExercises',
  'workoutSets',
  'settings',
  'goals',
] as const;
export type TableName = (typeof TABLE_NAMES)[number];
