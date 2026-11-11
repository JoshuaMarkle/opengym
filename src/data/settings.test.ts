import { afterEach, describe, expect, it, vi } from 'vitest';
import { isStoragePersistent } from './settings';

afterEach(() => vi.unstubAllGlobals());

describe('Settings storage status (9.1)', () => {
  it('reports persistence when the browser grants it', async () => {
    vi.stubGlobal('navigator', { storage: { persisted: async () => true } });
    expect(await isStoragePersistent()).toBe(true);
  });

  it('keeps denied storage checks from crashing Settings', async () => {
    vi.stubGlobal('navigator', {
      storage: { persisted: async () => { throw new DOMException('Storage access denied', 'SecurityError'); } },
    });
    expect(await isStoragePersistent()).toBe(false);
  });

  it('handles browsers without persistence support', async () => {
    vi.stubGlobal('navigator', {});
    expect(await isStoragePersistent()).toBe(false);
  });
});
