import { describe, expect, it } from 'vitest';
import { variationLabels } from './variations';

describe('variationLabels', () => {
  it('drops the shared words', () => {
    const l = variationLabels([
      { id: 'a', name: 'Bench Press', equipment: 'barbell' },
      { id: 'b', name: 'Incline Bench Press', equipment: 'barbell' },
      { id: 'c', name: 'DB Bench Press', equipment: 'dumbbell' },
    ]);
    expect([...l.values()]).toEqual(['Flat', 'Incline', 'DB']);
  });
  it('names the plain base by equipment when nothing else fits', () => {
    const l = variationLabels([
      { id: 'a', name: 'Lateral Raise', equipment: 'dumbbell' },
      { id: 'b', name: 'Cable Lateral Raise', equipment: 'cable' },
      { id: 'c', name: 'Machine Lateral Raise', equipment: 'machine' },
    ]);
    expect([...l.values()]).toEqual(['DB', 'Cable', 'Machine']);
  });
  it('keeps the full name when the short one would clash', () => {
    const l = variationLabels([
      { id: 'a', name: 'Row', equipment: 'cable' },
      { id: 'b', name: 'Cable Row', equipment: 'cable' },
    ]);
    expect([...l.values()]).toEqual(['Row', 'Cable']);
  });
  it('uses Back next to Front', () => {
    const l = variationLabels([
      { id: 'a', name: 'Squat', equipment: 'barbell' },
      { id: 'b', name: 'Front Squat', equipment: 'barbell' },
    ]);
    expect([...l.values()]).toEqual(['Back', 'Front']);
  });
  it('keeps full names when nothing is shared', () => {
    const l = variationLabels([
      { id: 'a', name: 'Pull-up' },
      { id: 'b', name: 'Lat Pulldown' },
    ]);
    expect([...l.values()]).toEqual(['Pull-up', 'Lat Pulldown']);
  });
});
