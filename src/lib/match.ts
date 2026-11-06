import type { Equipment, Muscle } from '../db/types';

/**
 * Matching imported exercise names (Strong / Hevy) to the library.
 * "sure" = exact after normalization; "unsure" = close enough to suggest, flagged
 * orange for a look; "new" = nothing close, becomes a new exercise.
 */
export type MatchConfidence = 'sure' | 'unsure' | 'new';

export interface MatchCandidate {
  id: string;
  name: string;
  equipment: Equipment;
}

export interface MatchResult {
  exerciseId?: string;
  confidence: MatchConfidence;
}

const EQUIPMENT_WORDS: Record<string, { prefix: string; equipment?: Equipment }> = {
  barbell: { prefix: '', equipment: 'barbell' },
  dumbbell: { prefix: 'db', equipment: 'dumbbell' },
  dumbbells: { prefix: 'db', equipment: 'dumbbell' },
  db: { prefix: 'db', equipment: 'dumbbell' },
  cable: { prefix: 'cable', equipment: 'cable' },
  machine: { prefix: 'machine', equipment: 'machine' },
  'smith machine': { prefix: 'smith machine', equipment: 'machine' },
  smith: { prefix: 'smith machine', equipment: 'machine' },
  bodyweight: { prefix: '', equipment: 'bodyweight' },
  weighted: { prefix: 'weighted', equipment: 'bodyweight' },
  assisted: { prefix: 'assisted', equipment: 'machine' },
  'ez bar': { prefix: 'ez bar', equipment: 'barbell' },
  kettlebell: { prefix: 'kettlebell', equipment: 'other' },
  band: { prefix: 'band', equipment: 'other' },
  'trap bar': { prefix: 'trap bar', equipment: 'barbell' },
  plate: { prefix: '', equipment: 'other' },
  other: { prefix: '', equipment: 'other' },
};

const SYNONYMS: [RegExp, string][] = [
  [/\bdumbbells?\b/g, 'db'],
  [/\bbarbell\b/g, ''],
  [/\bbiceps? curl\b/g, 'curl'],
  [/\btricep\b/g, 'triceps'],
  [/\boverhead triceps extension\b/g, 'overhead extension'],
  [/\btriceps extension\b/g, 'overhead extension'],
  [/\bohp\b/g, 'overhead press'],
  [/\bmilitary press\b/g, 'overhead press'],
  [/\bstrict press\b/g, 'overhead press'],
  [/\brdl\b/g, 'romanian deadlift'],
  [/\bskullcrushers?\b/g, 'skull crusher'],
  [/\bstanding calf raise\b/g, 'calf raise'],
  [/\blying leg curl\b/g, 'leg curl'],
  [/\bflat bench press\b/g, 'bench press'],
  [/\bchest fly\b/g, 'fly'],
  [/\bflye\b/g, 'fly'],
  [/\bpec deck\b/g, 'pec deck'],
  [/\bseated row\b/g, 'seated cable row'],
  [/\bbent over row\b/g, 'barbell row'],
  [/\bhip thrusts?\b/g, 'hip thrust'],
];

/** Lowercase, unify compounds (pull-up / pull up / pullup), synonyms, light plural stripping. */
export function normalizeName(name: string): string {
  let s = name.toLowerCase().replace(/[’']/g, '').replace(/[-_/]+/g, ' ');
  s = s.replace(/\b(pull|chin|push|sit|step|get) ?ups?\b/g, '$1up');
  s = s.replace(/\b(pull|push) ?downs?\b/g, '$1down');
  s = s.replace(/[^a-z0-9 ]+/g, ' ');
  for (const [re, rep] of SYNONYMS) s = s.replace(re, rep);
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t))
    .join(' ');
}

const tokens = (s: string) => new Set(s.split(' ').filter(Boolean));

function dice(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return (2 * inter) / (ta.size + tb.size);
}

/** Split "Bench Press (Dumbbell)" → base "Bench Press", equipment hint "dumbbell". */
export function splitEquipment(name: string): { base: string; hint?: string } {
  const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(name.trim());
  if (!m) return { base: name.trim() };
  return { base: m[1].trim(), hint: m[2].trim().toLowerCase() };
}

export function matchExerciseName(name: string, library: MatchCandidate[]): MatchResult {
  const norm = library.map((e) => ({ e, n: normalizeName(e.name) }));
  const whole = normalizeName(name);
  const exact = norm.find((x) => x.n === whole);
  if (exact) return { exerciseId: exact.e.id, confidence: 'sure' };

  const { base, hint } = splitEquipment(name);
  const nb = normalizeName(base);
  const eq = hint ? EQUIPMENT_WORDS[hint] : undefined;
  const candidates: string[] = [];
  if (eq?.prefix) candidates.push(normalizeName(`${eq.prefix} ${base}`));
  candidates.push(nb);

  // The base name with matching equipment, e.g. "Lateral Raise (Dumbbell)" → Lateral Raise (dumbbell).
  const sameEquipment = norm.find((x) => x.n === nb && (!eq?.equipment || x.e.equipment === eq.equipment));
  if (sameEquipment) return { exerciseId: sameEquipment.e.id, confidence: 'sure' };
  for (const c of candidates) {
    const hit = norm.find((x) => x.n === c);
    if (hit) return { exerciseId: hit.e.id, confidence: hit.n === nb && eq?.prefix ? 'unsure' : 'sure' };
  }

  let best: { id: string; score: number } | undefined;
  for (const c of [whole, ...candidates]) {
    for (const x of norm) {
      let score = dice(c, x.n);
      if (eq?.equipment && x.e.equipment === eq.equipment) score += 0.05;
      if (!best || score > best.score) best = { id: x.e.id, score };
    }
  }
  if (best && best.score >= 0.66) return { exerciseId: best.id, confidence: 'unsure' };
  return { confidence: 'new' };
}

/** Best guess at muscle/equipment for a brand-new exercise from its imported name. */
export function guessExerciseMeta(name: string): { muscle: Muscle; equipment: Equipment } {
  const n = normalizeName(name);
  const { hint } = splitEquipment(name);
  const equipment = (hint && EQUIPMENT_WORDS[hint]?.equipment) || (/\bdb\b/.test(n) ? 'dumbbell' : /\bcable\b/.test(n) ? 'cable' : /\bmachine\b/.test(n) ? 'machine' : 'other');
  const has = (re: RegExp) => re.test(n);
  const muscle = has(/bench|chest|fly|pec|pushup|dip/)
    ? 'chest'
    : has(/row|pulldown|pullup|chinup|deadlift|lat|shrug|back/)
      ? 'back'
      : has(/squat|leg|lunge|calf|glute|hip|hamstring|quad/)
        ? 'legs'
        : has(/shoulder|lateral|overhead press|delt|raise|face pull|arnold/)
          ? 'shoulders'
          : has(/curl|triceps|bicep|pushdown|extension|skull/)
            ? 'arms'
            : has(/crunch|ab|plank|sit|core|oblique|twist/)
              ? 'core'
              : 'other';
  return { muscle, equipment };
}
