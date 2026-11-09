import type { Exercise, Folder, Routine, RoutineExercise, RoutineSet, Workout, WorkoutExercise, WorkoutSet } from '../db/types';
import type { CardioValues } from './cardio';

/**
 * Sample data for testing mode (laptop dev server only, never production).
 * A push / pull / legs history from July 2024 to yesterday. Strength follows a
 * real body-composition trend: up through autumn 2024, a slow slide into
 * summer 2025, a second peak at the end of 2025, a dip to a low in July 2026,
 * then a fast climb back to today's numbers (the current plan).
 *
 * Seven weeks in Feb–Mar 2026 have nothing logged. Each session has a day form
 * (flat days, great days), lifts follow the trend more or less closely, isolations
 * wobble more and sometimes change dumbbell, and set counts and drops vary. Reps come
 * from strength on the day against the weight picked, and the last ~5 months are rated
 * as RIR from those same reps left in the tank.
 */

// ───────────────────────────── trend

/** [year, month (1–12), day, muscle mass lb] read off the reference chart. */
const TREND: [number, number, number, number][] = [
  [2024, 7, 1, 126.2],
  [2024, 8, 1, 129.3],
  [2024, 9, 1, 130.1],
  [2024, 10, 1, 133.6],
  [2024, 10, 31, 135.3],
  [2025, 1, 1, 132.2],
  [2025, 2, 1, 131.3],
  [2025, 3, 1, 130.7],
  [2025, 4, 1, 130.9],
  [2025, 5, 1, 131.3],
  [2025, 6, 1, 129.7],
  [2025, 7, 1, 129.7],
  [2025, 8, 1, 128.7],
  [2025, 9, 1, 130.3],
  [2025, 10, 1, 132.3],
  [2025, 11, 1, 134.3],
  [2025, 12, 1, 134.9],
  [2026, 1, 1, 132.9],
  [2026, 2, 1, 133.4],
  [2026, 3, 1, 129.3],
  [2026, 4, 1, 128.5],
  [2026, 5, 1, 126.9],
  [2026, 6, 1, 127.8],
  [2026, 7, 1, 124.8],
  [2026, 8, 1, 127.6],
  [2026, 9, 1, 131.7],
  [2026, 10, 1, 133.9],
  [2026, 11, 6, 133.5],
];

const NOW_MASS = 133.5;
const point = ([y, m, d, v]: (typeof TREND)[number]) => [new Date(y, m - 1, d).getTime(), v] as const;

/** Trend value at a time (linear between chart points, clamped at the ends). */
export function trendAt(t: number): number {
  const pts = TREND.map(point);
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [t1, v1] = pts[i];
    if (t <= t1) {
      const [t0, v0] = pts[i - 1];
      return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
  }
  return pts[pts.length - 1][1];
}

/** Strength relative to today: 1.0 now, ~0.83 at the July 2026 low, ~1.04 at the Oct 2024 peak. */
export function strengthAt(t: number): number {
  return 1 + (trendAt(t) - NOW_MASS) * 0.02;
}

// ───────────────────────────── plans

/**
 * One exercise in plan shorthand (as in the user's notes): space-separated sets,
 * `w` prefix = warm-up, `d` chains drops. `155x10 155x6d125x4`.
 */
interface PlanExercise {
  id: string;
  sets: string;
  /** Rounding step in lb. */
  step?: number;
  /** Superset letter (2.12): members sit next to each other. */
  superset?: string;
  /** How noisy the lift is day to day (1 = a steady barbell lift; isolations 1.5–2.2). */
  vary?: number;
  /** How hard the lift follows the strength trend (1 = fully; 0.5 = stuck most of the time; 1.5 = swings more). */
  curve?: number;
  /** Now and then grabs the next dumbbell / pin up or down and lets the reps follow. */
  swap?: boolean;
}

type CardioKind = 'treadmill' | 'bike' | 'rower';

interface Plan {
  name: 'Push' | 'Pull' | 'Legs';
  exercises: PlanExercise[];
  /** Cardio to finish (current plan only), most days. */
  cardio?: { id: string; kind: CardioKind; segments: number };
}

const MILE = 1609.344;

/** One finished cardio session's segments (stored SI: seconds, meters, km/h). */
function cardioSegments(kind: CardioKind, rand: () => number, fitness: number): CardioValues[] {
  const r1 = (x: number) => Math.round(x * 10) / 10;
  if (kind === 'treadmill') {
    const walk = r1(3.2 + rand() * 0.4);
    const run = r1((5.2 + rand() * 0.6) * fitness);
    const mins = 12 + Math.round(rand() * 3) * 4;
    const seg = (min: number, mph: number) => ({ durationSec: min * 60, distance: Math.round(((mph * MILE) / 60) * min) });
    return [seg(5, walk), seg(mins, run)];
  }
  if (kind === 'bike') {
    const min = 10 + Math.round(rand() * 2) * 5;
    const level = Math.max(4, Math.min(10, Math.round(6 + rand() * 3 * fitness)));
    return [{ durationSec: min * 60, level, distance: Math.round(min * 60 * (6.2 + level * 0.18)) }];
  }
  return Array.from({ length: 3 }, () => ({ durationSec: 120, distance: Math.round((495 + rand() * 35) * fitness) }));
}

export const CUSTOM_SAMPLE_EXERCISES = [
  { id: 'ex-sample-wide-grip-lat-pulldown', name: 'Wide-Grip Lat Pulldown', muscle: 'back', equipment: 'cable', group: 'vg-pulldown' },
  { id: 'ex-sample-seated-leg-press', name: 'Seated Leg Press', muscle: 'legs', equipment: 'machine', group: 'vg-leg-press' },
] as const;

/** Today's plan. Weights here are what you lift now; earlier sessions scale down by the trend. */
const CURRENT: Plan[] = [
  {
    name: 'Push',
    exercises: [
      { id: 'ex-bench-press', sets: 'w75x12 155x10 155x6 155x5', curve: 1.1 },
      { id: 'ex-machine-chest-press', sets: 'w75x12 185x8 185x7', curve: 0.8, vary: 1.2 },
      { id: 'ex-db-fly', sets: '25x5 20x7', step: 2.5, vary: 1.6, swap: true },
      { id: 'ex-db-shoulder-press', sets: '40x8 40x6d30x6', step: 2.5, curve: 0.45, vary: 1.3 },
      { id: 'ex-lateral-raise', sets: '10x12 10x10 10x6', step: 2.5, vary: 2, swap: true },
      { id: 'ex-db-overhead-extension', sets: '35x10 35x5', step: 2.5, superset: 'A', vary: 1.5, swap: true },
      { id: 'ex-rope-pushdown', sets: '42.5x8 42.5x6d35x4d27.5x3', step: 2.5, superset: 'A', vary: 1.5 },
      { id: 'ex-pec-deck', sets: '130x5 110x7 110x6', vary: 1.8, swap: true },
    ],
    cardio: { id: 'ex-treadmill', kind: 'treadmill', segments: 2 },
  },
  {
    name: 'Pull',
    exercises: [
      { id: 'ex-lat-pulldown', sets: 'w100x12 145x8 145x6 130x5', vary: 1.1 },
      { id: 'ex-sample-wide-grip-lat-pulldown', sets: 'w100x12 130x9 130x5 115x8', curve: 1.2 },
      { id: 'ex-seated-cable-row', sets: '120x10 120x7 120x6', curve: 0.6, vary: 1.3 },
      { id: 'ex-machine-preacher-curl', sets: '105x8 105x4d85x4', vary: 1.4 },
      { id: 'ex-hammer-curl', sets: '27.5x10 27.5x6', step: 2.5, superset: 'A', vary: 1.5, swap: true },
      { id: 'ex-wrist-curl', sets: '30x12 35x10', step: 2.5, superset: 'A', vary: 2 },
      { id: 'ex-machine-crunch', sets: '130x12 190x3d160x4', vary: 2.2, swap: true },
    ],
    cardio: { id: 'ex-rower', kind: 'rower', segments: 3 },
  },
  {
    name: 'Legs',
    exercises: [
      { id: 'ex-leg-press', sets: '360x12 540x12 720x12 720x12', step: 10, curve: 1.6, vary: 1.3 },
      { id: 'ex-leg-curl', sets: '130x13 145x8', vary: 1.3 },
      { id: 'ex-leg-extension', sets: '210x12 210x8d160x2', vary: 1.4, swap: true },
      { id: 'ex-calf-raise', sets: '160x13 160x13', vary: 2, swap: true },
      { id: 'ex-sample-seated-leg-press', sets: 'w130x12 220x12 310x12 310x3', step: 10, curve: 1.3 },
    ],
    cardio: { id: 'ex-bike', kind: 'bike', segments: 1 },
  },
];

/** Sunday runs outside, from this date on: the source of the distance records (7.9). */
const RUNS_FROM = new Date(2025, 8, 7).getTime();

/** The older plan, used until July 2025. Its numbers are from the mid-2025 low. */
const OLD: Plan[] = [
  {
    name: 'Push',
    exercises: [
      { id: 'ex-bench-press', sets: 'w75x12 135x10 135x6 135x4' },
      { id: 'ex-machine-chest-press', sets: 'w75x12 185x7 185x7 185x6' },
      { id: 'ex-cable-fly', sets: '130x5 130x4', vary: 1.6, swap: true },
      { id: 'ex-db-shoulder-press', sets: '40x8 35x8 35x6', step: 2.5, curve: 0.45, vary: 1.3 },
      { id: 'ex-lateral-raise', sets: '10x10 10x9 10x6', step: 2.5, vary: 2, swap: true },
      { id: 'ex-reverse-pec-deck', sets: '75x9 75x8 75x5d55x4', vary: 1.6 },
      { id: 'ex-triceps-pushdown', sets: '57.5x12 50x9 50x6', step: 2.5, vary: 1.5 },
      { id: 'ex-overhead-cable-extension', sets: '32.5x10 32.5x8', step: 2.5 },
    ],
  },
  {
    name: 'Pull',
    exercises: [
      { id: 'ex-lat-pulldown', sets: '140x12 140x6 130x5' },
      { id: 'ex-seated-cable-row', sets: '120x12 120x11 120x5', curve: 0.6, vary: 1.3 },
      { id: 'ex-preacher-curl', sets: '75x8 70x8 70x8' },
      { id: 'ex-hammer-curl', sets: '25x10 20x6 20x6', step: 2.5, vary: 1.5, swap: true },
      { id: 'ex-db-shrug', sets: '40x12 40x12', step: 2.5 },
      { id: 'ex-machine-crunch', sets: '130x15 130x12 130x9', vary: 2.2, swap: true },
    ],
  },
  {
    name: 'Legs',
    exercises: [
      { id: 'ex-leg-press', sets: '180x12 360x12 540x12 720x8', step: 10, curve: 1.6, vary: 1.3 },
      { id: 'ex-leg-curl', sets: '115x12 115x8 100x6' },
      { id: 'ex-leg-extension', sets: '190x12 190x12 190x8d70x10', vary: 1.4, swap: true },
      { id: 'ex-seated-calf-raise', sets: '45x12 45x15 45x20', vary: 2 },
    ],
  },
];

const SWITCH_AT = new Date(2025, 6, 1).getTime();
const OLD_BASE = strengthAt(new Date(2025, 5, 15).getTime());

interface ParsedSet {
  kind: 'warmup' | 'working';
  weight: number;
  reps: number;
  drops: { weight: number; reps: number }[];
}

export function parsePlanSets(text: string): ParsedSet[] {
  return text
    .trim()
    .split(/\s+/)
    .map((tok) => {
      const warm = tok.startsWith('w');
      const [main, ...drops] = (warm ? tok.slice(1) : tok).split('d');
      const pair = (s: string) => {
        const [w, r] = s.split('x');
        return { weight: Number(w), reps: Math.round(Number(r)) };
      };
      return { kind: warm ? 'warmup' : 'working', ...pair(main), drops: drops.map(pair) };
    });
}

// ───────────────────────────── generator

/** Small seeded PRNG so the sample data is the same on every reset. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SampleData {
  exercises: Exercise[];
  folders: Folder[];
  routines: Routine[];
  routineExercises: RoutineExercise[];
  routineSets: RoutineSet[];
  workouts: Workout[];
  workoutExercises: WorkoutExercise[];
  workoutSets: WorkoutSet[];
}

const DAY = 86_400_000;
const START = new Date(2024, 6, 1).getTime();

/**
 * Breaks: holidays, a trip, a rough patch, and seven weeks in Feb–Mar 2026 with
 * nothing logged at all (the body-comp slide in the trend). [from, to] inclusive local dates.
 */
export const BREAKS: [number, number][] = [
  [new Date(2024, 11, 22).getTime(), new Date(2025, 0, 2).getTime()],
  [new Date(2025, 5, 7).getTime(), new Date(2025, 5, 18).getTime()],
  [new Date(2025, 11, 23).getTime(), new Date(2025, 11, 30).getTime()],
  [new Date(2026, 1, 9).getTime(), new Date(2026, 2, 29).getTime()],
  [new Date(2026, 5, 20).getTime(), new Date(2026, 6, 5).getTime()],
];

/**
 * How much lighter the first sessions back from a break are: ~1% per week off
 * (6% at most), fading out over four weeks. 0 outside a comeback.
 */
export function comebackAt(t: number): number {
  for (const [a, b] of BREAKS) {
    const since = t - b;
    if (since <= 0 || since > 28 * DAY) continue;
    const drop = Math.min(0.06, ((b - a) / (7 * DAY)) * 0.01);
    return drop * (1 - since / (28 * DAY));
  }
  return 0;
}

/** Effort (SPEC §12) is logged as RIR for the last ~5 months, so it looks turned on in early summer. */
const EFFORT_DAYS = 150;

/**
 * What someone logging RIR writes down for a set with `trueRir` reps left: whole
 * numbers mostly, a half now and then; far from failure they underrate it, and
 * 5+ is the top key. Returned as the stored RPE (RIR = 10 − RPE).
 */
export function sampleRir(trueRir: number, rand: () => number): number {
  const felt = Math.min(trueRir, 3 + (trueRir - 3) * 0.6) + (rand() - 0.5) * 1.5;
  const rir = rand() < 0.2 ? Math.round(felt * 2) / 2 : Math.round(felt);
  return 10 - Math.min(5, Math.max(0, rir));
}

/** Training days per week (0 = Sun): Mon, Tue, Thu, Fri, Sat. */
const TRAINING_DAYS = new Set([1, 2, 4, 5, 6]);

export function generateSampleData(opts: { now?: number; newId?: () => string; seed?: number } = {}): SampleData {
  const now = opts.now ?? Date.now();
  let n = 0;
  const newId = opts.newId ?? (() => `sample-${(++n).toString(36)}`);
  const rand = mulberry32(opts.seed ?? 20240701);
  const today = new Date(now);
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime(); // midnight today: only past days

  const exercises: Exercise[] = CUSTOM_SAMPLE_EXERCISES.map((e) => ({
    id: e.id,
    name: e.name,
    type: 'weight',
    muscle: e.muscle,
    equipment: e.equipment,
    variationGroupId: e.group,
    isCustom: true,
    archived: false,
    createdAt: START,
    updatedAt: START,
  }));

  // Folders + routines: current PPL (active), the 2024 one archived.
  const folders: Folder[] = [];
  const routines: Routine[] = [];
  const routineExercises: RoutineExercise[] = [];
  const routineSets: RoutineSet[] = [];
  const routineIds = new Map<Plan[], Map<string, string>>();
  const addFolder = (name: string, plans: Plan[], order: number, active: boolean, created: number) => {
    const folder: Folder = { id: newId(), name, order, active, archived: !active, createdAt: created, updatedAt: created };
    folders.push(folder);
    const ids = new Map<string, string>();
    plans.forEach((p, i) => {
      const r: Routine = { id: newId(), name: p.name, folderId: folder.id, order: i, createdAt: created, updatedAt: created };
      routines.push(r);
      ids.set(p.name, r.id);
      p.exercises.forEach((pe, j) => {
        const re: RoutineExercise = { id: newId(), routineId: r.id, exerciseId: pe.id, order: j, supersetGroup: pe.superset, createdAt: created, updatedAt: created };
        routineExercises.push(re);
        const sets = parsePlanSets(pe.sets);
        const warm = sets.filter((s) => s.kind === 'warmup');
        const work = sets.filter((s) => s.kind === 'working');
        [...warm, ...work].forEach((s, k) =>
          routineSets.push({
            id: newId(),
            routineExerciseId: re.id,
            order: k,
            kind: s.kind,
            weight: 'last',
            repsMin: s.kind === 'working' ? 6 : undefined,
            repsMax: s.kind === 'working' ? 12 : undefined,
            createdAt: created,
            updatedAt: created,
          }),
        );
      });
      if (p.cardio) {
        const re: RoutineExercise = { id: newId(), routineId: r.id, exerciseId: p.cardio.id, order: p.exercises.length, createdAt: created, updatedAt: created };
        routineExercises.push(re);
        for (let k = 0; k < p.cardio.segments; k++)
          routineSets.push({ id: newId(), routineExerciseId: re.id, order: k, kind: 'working', weight: 'last', createdAt: created, updatedAt: created });
      }
    });
    routineIds.set(plans, ids);
  };
  addFolder('PPL', CURRENT, 0, true, SWITCH_AT);
  addFolder('PPL 2024', OLD, 1, false, START);

  const workouts: Workout[] = [];
  const workoutExercises: WorkoutExercise[] = [];
  const workoutSets: WorkoutSet[] = [];
  let rotation = 0;
  // Cardio has its own stream so adding it didn't reshuffle the lifting history.
  const crand = mulberry32((opts.seed ?? 20240701) + 7);

  const addCardio = (workout: Workout, exerciseId: string, order: number, sets: CardioValues[], at: number): number => {
    const we: WorkoutExercise = { id: newId(), workoutId: workout.id, exerciseId, order, createdAt: workout.createdAt, updatedAt: workout.createdAt };
    workoutExercises.push(we);
    let t = at;
    sets.forEach((v, k) => {
      t += (v.durationSec ?? 0) * 1000 + 30_000;
      workoutSets.push({ id: newId(), workoutExerciseId: we.id, order: k, kind: 'working', completed: true, createdAt: Math.round(t), updatedAt: Math.round(t), ...v });
    });
    return t;
  };

  for (let day = START; day < end; day += DAY) {
    const date = new Date(day);
    // DST: re-anchor to local midnight.
    const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    if (date.getDay() === 0 && midnight >= RUNS_FROM && !BREAKS.some(([a, b]) => midnight >= a && midnight <= b) && crand() < 0.55) {
      const startedAt = Math.round(midnight + (8 + crand() * 2) * 3_600_000);
      const workout: Workout = { id: newId(), name: 'Run', startedAt, status: 'done', createdAt: startedAt, updatedAt: startedAt };
      // Mostly 5K-ish, now and then a 10K; pace improves with the trend.
      const miles = crand() < 0.2 ? 6.3 + crand() * 0.6 : crand() < 0.15 ? 1.05 : 3.15 + crand() * 1.2;
      // Running fitness builds steadily from the first run: ~9:50 /mi down to ~8:20 by now.
      const pace = (9.85 - Math.min(1.5, ((midnight - RUNS_FROM) / (365 * DAY)) * 1.25) + (crand() - 0.5) * 0.45) * 60; // sec per mile
      const end2 = addCardio(workout, 'ex-run-walk-outside', 0, [{ durationSec: Math.round(miles * pace), distance: Math.round(miles * MILE) }], startedAt + 120_000);
      workout.endedAt = Math.round(end2 + 60_000);
      workout.updatedAt = workout.endedAt;
      workouts.push(workout);
    }
    if (!TRAINING_DAYS.has(date.getDay())) continue;
    if (BREAKS.some(([a, b]) => midnight >= a && midnight <= b)) continue;
    // Show up less while the trend is falling.
    const slope = trendAt(midnight + 14 * DAY) - trendAt(midnight - 14 * DAY);
    const attend = slope < -0.5 ? 0.55 : slope > 0.5 ? 0.85 : 0.72;
    if (rand() > attend) continue;

    const plans = midnight < SWITCH_AT ? OLD : CURRENT;
    const plan = plans[rotation++ % 3];
    const scale = midnight < SWITCH_AT ? strengthAt(midnight) / OLD_BASE : strengthAt(midnight);
    const back = comebackAt(midnight);
    // How the day feels: mostly ±2%, now and then a flat day or a great one.
    const feel = rand();
    const form = (feel < 0.08 ? 0.95 : feel > 0.94 ? 1.03 : 1) * (1 + (rand() - 0.5) * 0.04);
    const startedAt = midnight + (16.5 + rand() * 3) * 3_600_000;
    const workout: Workout = {
      id: newId(),
      name: plan.name,
      routineId: routineIds.get(plans)!.get(plan.name),
      startedAt: Math.round(startedAt),
      status: 'done',
      createdAt: Math.round(startedAt),
      updatedAt: Math.round(startedAt),
    };
    let clock = startedAt + 4 * 60_000;
    // Occasionally skip the last exercise when short on time.
    const count = rand() < 0.15 ? plan.exercises.length - 1 : plan.exercises.length;
    const done = plan.exercises.slice(0, count);
    // A superset only counts when both partners made it in.
    const pairs = new Map<string, number>();
    for (const pe of done) if (pe.superset) pairs.set(pe.superset, (pairs.get(pe.superset) ?? 0) + 1);
    done.forEach((pe, i) => {
      const group = pe.superset && (pairs.get(pe.superset) ?? 0) >= 2 ? pe.superset : undefined;
      const we: WorkoutExercise = { id: newId(), workoutId: workout.id, exerciseId: pe.id, order: i, supersetGroup: group, createdAt: workout.createdAt, updatedAt: workout.createdAt };
      workoutExercises.push(we);
      const step = pe.step ?? 5;
      const vary = pe.vary ?? 1;
      const round = (w: number) => Math.max(step, Math.round(w / step) * step);
      // The lift's own scale: how hard it follows the trend, then the comeback.
      const liftScale = Math.pow(scale, pe.curve ?? 1) * (1 - back);
      // Strength on the day vs. what the weights were picked for.
      const strength = liftScale * form * (1 + (rand() - 0.5) * 0.02 * vary) * (1 + back * 0.2);
      const pick = 1 + (rand() - 0.5) * 0.03 * vary;
      const shift = pe.swap && rand() < 0.22 ? (rand() < 0.5 ? step : -step) : 0;
      let order = 0;
      const push = (s: Omit<WorkoutSet, 'id' | 'createdAt' | 'updatedAt' | 'order' | 'workoutExerciseId' | 'completed'>) => {
        clock += (s.kind === 'drop' ? 0.5 : 2 + rand() * 1.5) * 60_000;
        const t = Math.round(clock);
        const rec: WorkoutSet = { id: newId(), workoutExerciseId: we.id, order: order++, completed: true, createdAt: t, updatedAt: t, ...s };
        workoutSets.push(rec);
        return rec.id;
      };

      const all = parsePlanSets(pe.sets);
      const warm = all.filter((s) => s.kind === 'warmup');
      let work = all.filter((s) => s.kind === 'working');
      // Now and then a set more or a set less; drops skipped, or one tacked on.
      if (work.length >= 3 && rand() < 0.08) work = work.slice(0, -1);
      else if (rand() < 0.07) {
        const last = work[work.length - 1];
        work = [...work, { ...last, reps: Math.max(3, last.reps - 2), drops: [] }];
      }
      const skipDrops = rand() < 0.15;
      const addDrop = vary >= 1.4 && !work.some((s) => s.drops.length) && rand() < 0.08;

      if (rand() > 0.15) for (const s of warm) push({ kind: 'warmup', weight: s.weight, reps: s.reps });
      // Capacity (est. 1RM) per set at today's plan, ~2 reps in reserve. Ramp-up sets
      // before the heaviest one are fresh (the top set's capacity); back-offs are tired.
      const top = Math.max(...work.map((s) => s.weight));
      const topAt = work.findIndex((s) => s.weight === top);
      const cap = (s: ParsedSet) => s.weight * (1 + (s.reps + 2) / 30);
      work.forEach((s, wi) => {
        const capacity = (wi < topAt ? cap(work[topAt]) : cap(s)) * strength;
        // A light dumbbell where one step is a big jump (10 → 12.5) stays put; only the reps move.
        const coarse = step / s.weight > 0.12;
        const weight = coarse ? s.weight : Math.max(step, round(s.weight * liftScale * pick) + shift);
        const most = Math.max(1, 30 * (capacity / weight - 1)); // reps to failure
        const lastSet = wi === work.length - 1;
        const rir = 2 - (lastSet && rand() < 0.4 ? 1 : 0) + (rand() - 0.5) * 0.8;
        const target = wi < topAt ? Math.min(s.reps + Math.round((rand() - 0.5) * 2), most - 1) : most - rir + (rand() - 0.5) * 1.4 * vary;
        // Epley is harsh on high-rep isolation work: never under half the planned reps.
        const reps = Math.max(1, Math.round(s.reps / 2), Math.min(Math.floor(most), Math.round(target)));
        const rated = midnight >= end - EFFORT_DAYS * DAY && rand() < 0.9;
        let parent = push({ kind: 'working', weight, reps, ...(rated ? { rpe: sampleRir(Math.max(0, most - reps), rand) } : {}) });
        const drops = skipDrops ? [] : addDrop && lastSet ? [{ weight: s.weight * 0.75, reps: Math.max(3, Math.round(s.reps * 0.6)) }] : s.drops;
        for (const d of drops) parent = push({ kind: 'drop', parentSetId: parent, weight: round(d.weight * liftScale), reps: Math.max(1, d.reps + Math.round((rand() - 0.5) * 2 * vary)) });
      });
      clock += 2 * 60_000;
    });
    if (plan.cardio && crand() < 0.65) clock = addCardio(workout, plan.cardio.id, done.length, cardioSegments(plan.cardio.kind, crand, strengthAt(midnight)), clock);
    workout.endedAt = Math.round(clock + rand() * 5 * 60_000);
    workout.updatedAt = workout.endedAt;
    workouts.push(workout);
  }

  return { exercises, folders, routines, routineExercises, routineSets, workouts, workoutExercises, workoutSets };
}
