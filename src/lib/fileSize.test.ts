import { describe, expect, it } from 'vitest';
import { approxSize } from './fileSize';

describe('approxSize', () => {
  it('says under 1 MB for small files', () => {
    expect(approxSize(0)).toBe('<1 MB');
    expect(approxSize(999_999)).toBe('<1 MB');
  });
  it('rounds megabytes: a decimal under 10, whole above', () => {
    expect(approxSize(1_000_000)).toBe('~1 MB');
    expect(approxSize(1_420_000)).toBe('~1.4 MB');
    expect(approxSize(36_400_000)).toBe('~36 MB');
  });
  it('switches to gigabytes', () => {
    expect(approxSize(2_400_000_000)).toBe('~2.4 GB');
    expect(approxSize(12_600_000_000)).toBe('~13 GB');
  });
});
