import { db } from '../db/db';
import { defaultSettings } from '../db/seed';
import { DEFAULT_SETTINGS, type Settings, type Units } from '../db/types';
import { UNIT_DEFAULTS } from '../lib/units';

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('settings');
  return s ? withDefaults(s) : defaultSettings();
}

/** Settings saved before a field existed (e.g. effort) get its default. */
export function withDefaults(s: Settings): Settings {
  return { ...DEFAULT_SETTINGS, ...s };
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id' | 'createdAt'>>): Promise<void> {
  const cur = await getSettings();
  await db.settings.put({ ...cur, ...patch, updatedAt: Date.now() });
}

/**
 * Switching units also moves the weight step and bar weight to the new unit's
 * defaults (5 lb ↔ 2.5 kg, 45 lb ↔ 20 kg). Stored weights are always lb, so
 * nothing else changes.
 */
export async function setUnits(units: Units): Promise<void> {
  const cur = await getSettings();
  if (cur.units === units) return;
  await updateSettings({ units, ...UNIT_DEFAULTS[units] });
}

/** Ask the browser not to evict our storage (SPEC §2). Best effort. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

/** Weight step in lb, for rounding stored weights. */
export function stepLb(settings: Pick<Settings, 'weightStep' | 'units'>): number {
  return settings.units === 'kg' ? settings.weightStep / 0.45359237 : settings.weightStep;
}
