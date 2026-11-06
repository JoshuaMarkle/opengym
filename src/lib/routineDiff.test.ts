import { describe, expect, it } from 'vitest';
import { describeChange, diffRoutine } from './routineDiff';

const item = (exerciseId: string, working = 3, warmups = 0) => ({ exerciseId, working, warmups });
const names: Record<string, string> = { lat: 'Lateral Raise', bench: 'Bench Press', incl: 'Incline DB Press', dips: 'Dips', fly: 'Cable Fly', face: 'Face Pull', inclBench: 'Incline Bench Press' };
const name = (id: string) => names[id] ?? id;

describe('diffRoutine', () => {
  const routine = [item('lat'), item('bench', 4, 1), item('incl'), item('dips'), item('fly')];

  it('finds nothing when only values changed', () => {
    expect(diffRoutine(routine, routine.map((r) => ({ ...r })))).toEqual([]);
  });

  it('describes the storyboard example (5.2)', () => {
    const workout = [item('lat'), item('incl'), item('bench', 5, 1), item('fly'), item('face')];
    const text = diffRoutine(routine, workout).map((c) => describeChange(c, name));
    expect(text).toContainEqual({ sign: '+', text: 'Added Face Pull (3 sets)' });
    expect(text).toContainEqual({ sign: '−', text: 'Removed Dips' });
    expect(text).toContainEqual({ sign: '↻', text: 'Bench Press: 4 → 5 sets' });
    expect(text).toContainEqual({ sign: '↻', text: 'Incline DB Press moved before Bench Press' });
    expect(text).toHaveLength(4);
  });

  it('treats a swap within a variation group as a replacement in place', () => {
    const group = (id: string) => (id === 'bench' || id === 'inclBench' ? 'vg-bench' : undefined);
    const workout = [item('lat'), item('inclBench', 4, 1), item('incl'), item('dips'), item('fly')];
    const changes = diffRoutine(routine, workout, group);
    expect(changes).toEqual([{ type: 'replaced', fromId: 'bench', toId: 'inclBench' }]);
  });

  it('notices warm-up count changes', () => {
    const workout = routine.map((r) => (r.exerciseId === 'bench' ? { ...r, warmups: 2 } : r));
    expect(diffRoutine(routine, workout)).toEqual([{ type: 'warmups', exerciseId: 'bench', from: 1, to: 2 }]);
  });
});
