import { describe, expect, it } from 'vitest';
import { ImportError, parseDuration, parseImportCsv, parseImportDate } from './importParser';

const STRONG = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
2024-01-08 18:04:11,"Push A",1h 2m,"Bench Press (Barbell)",W,95.0,10,0,0,"","",
2024-01-08 18:04:11,"Push A",1h 2m,"Bench Press (Barbell)",1,185.0,8,0,0,"","",
2024-01-08 18:04:11,"Push A",1h 2m,"Bench Press (Barbell)",2,185.0,6,0,0,"","",
2024-01-08 18:04:11,"Push A",1h 2m,"Bench Press (Barbell)",D,135.0,9,0,0,"","",
2024-01-08 18:04:11,"Push A",1h 2m,"Chest Fly (Cable)",1,30,12,0,0,"","",
2024-01-08 18:04:11,"Push A",1h 2m,"Running",1,0,0,5,1800,"","",
2024-01-10 07:30:00,"Legs",45m,"Squat (Barbell)",1,225,5,0,0,"","",
2024-01-10 07:30:00,"Legs",45m,"Squat (Barbell)",Rest Timer,0,0,0,90,"","",
`;

const STRONG_SEMI = `Date;Workout Name;Duration;Exercise Name;Set Order;Weight;Reps;Distance;Seconds;Notes;Workout Notes;RPE
"2024-02-01 10:00:00";"Pull";"50m";"Pull Up";"1";"0";"10";"";"";"";"";""
`;

const HEVY = `"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"
"Push A","5 Nov 2026, 18:10","5 Nov 2026, 19:07","","Bench Press (Barbell)",,"",0,"warmup",40,10,,,
"Push A","5 Nov 2026, 18:10","5 Nov 2026, 19:07","","Bench Press (Barbell)",,"",1,"normal",80,8,,,
"Push A","5 Nov 2026, 18:10","5 Nov 2026, 19:07","","Bench Press (Barbell)",,"",2,"dropset",60,9,,,
"Push A","5 Nov 2026, 18:10","5 Nov 2026, 19:07","","Lat Pulldown (Cable)",,"",0,"failure",50,12,,,
"Run","6 Nov 2026, 07:00","6 Nov 2026, 07:30","","Running",,"",0,"normal",,,5,1800,
`;

describe('parseImportCsv: Strong', () => {
  const r = parseImportCsv(STRONG);
  it('detects the source and groups rows into workouts', () => {
    expect(r.source).toBe('strong');
    expect(r.workouts).toHaveLength(2);
    expect(r.workouts[0].name).toBe('Push A');
    expect(r.workouts[0].endedAt! - r.workouts[0].startedAt).toBe(62 * 60_000);
  });
  it('reads warm-ups, working sets and drops in order', () => {
    const bench = r.workouts[0].exercises[0];
    expect(bench.name).toBe('Bench Press (Barbell)');
    expect(bench.sets.map((s) => s.kind)).toEqual(['warmup', 'working', 'working', 'drop']);
    expect(bench.sets[1]).toEqual({ kind: 'working', weight: 185, reps: 8 });
  });
  it('skips cardio and rest-timer rows', () => {
    expect(r.exerciseNames).toEqual(['Bench Press (Barbell)', 'Chest Fly (Cable)', 'Squat (Barbell)']);
    expect(r.skippedRows).toBe(2);
  });
  it('handles semicolon-delimited exports', () => {
    const s = parseImportCsv(STRONG_SEMI);
    expect(s.workouts[0].exercises[0]).toEqual({ name: 'Pull Up', sets: [{ kind: 'working', weight: 0, reps: 10 }] });
  });
});

describe('parseImportCsv: Hevy', () => {
  const r = parseImportCsv(HEVY);
  it('detects Hevy, the weight unit and set types', () => {
    expect(r.source).toBe('hevy');
    expect(r.units).toBe('kg');
    expect(r.workouts).toHaveLength(1);
    const [bench, lat] = r.workouts[0].exercises;
    expect(bench.sets.map((s) => s.kind)).toEqual(['warmup', 'working', 'drop']);
    expect(lat.sets[0]).toEqual({ kind: 'working', weight: 50, reps: 12 });
  });
  it('reads start and end times', () => {
    const w = r.workouts[0];
    expect(new Date(w.startedAt).getHours()).toBe(18);
    expect((w.endedAt! - w.startedAt) / 60_000).toBe(57);
  });
});

describe('dates and durations', () => {
  it('parses the formats the apps use', () => {
    const want = new Date(2026, 10, 5, 18, 10).getTime();
    expect(parseImportDate('2026-11-05 18:10:00')).toBe(want);
    expect(parseImportDate('5 Nov 2026, 18:10')).toBe(want);
    expect(parseImportDate('Nov 5, 2026, 6:10 PM')).toBe(want);
    expect(parseImportDate('')).toBeUndefined();
  });
  it('parses durations', () => {
    expect(parseDuration('1h 2m')).toBe(62 * 60_000);
    expect(parseDuration('45m')).toBe(45 * 60_000);
    expect(parseDuration('90')).toBe(90_000);
    expect(parseDuration('')).toBeUndefined();
  });
});

it('rejects files that are not exports', () => {
  expect(() => parseImportCsv('a,b,c\n1,2,3\n')).toThrow(ImportError);
});
