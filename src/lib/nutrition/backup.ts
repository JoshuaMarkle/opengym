// What a backup carries of the food tables (nutrition-plan Phase 10). The built-in USDA rows come
// back from the database file, so a backup keeps only the ones you've made yours (logged, starred,
// filled in); entries hold their own nutrient snapshot and never need the food row.

export interface BackupFood {
  source: string;
  mine?: boolean;
  favorite?: boolean;
  last?: unknown;
  filledFrom?: string;
}

/** Whether a food row goes into a backup. */
export function keepInBackup(f: BackupFood): boolean {
  return f.source !== 'usda' || !!f.mine || !!f.favorite || f.last != null || f.filledFrom != null;
}

/** Distinct logged days, for the restore confirmation. */
export function loggedDays(entries: { day: string }[]): number {
  return new Set(entries.map((e) => e.day)).size;
}
