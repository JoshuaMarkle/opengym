import type { Equipment } from '../db/types';

const EQUIPMENT_SHORT: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'DB',
  machine: 'Machine',
  cable: 'Cable',
  bodyweight: 'Bodyweight',
  other: 'Other',
};

/**
 * Short labels for linked variations, shown as buttons while logging:
 * Bench Press / Incline Bench Press / DB Bench Press → "Flat" · "Incline" · "DB".
 * Words every name shares are dropped. The plain base exercise (nothing left)
 * is named by what sets it apart: "Flat" next to Incline/Decline, "Back" next
 * to Front, else its equipment. If that would clash, it keeps its full name.
 */
export function variationLabels(items: { id: string; name: string; equipment?: Equipment }[]): Map<string, string> {
  const tokens = items.map((i) => i.name.split(/\s+/).filter(Boolean));
  const lower = tokens.map((t) => t.map((x) => x.toLowerCase()));
  const common = new Set(lower[0] ?? []);
  for (const t of lower.slice(1)) for (const c of [...common]) if (!t.includes(c)) common.delete(c);
  const rests = tokens.map((t) => t.filter((x) => !common.has(x.toLowerCase())));
  const restWords = new Set(rests.flat().map((w) => w.toLowerCase()));
  const out = new Map<string, string>();
  items.forEach((item, i) => {
    if (items.length < 2) return out.set(item.id, item.name);
    if (rests[i].length) return out.set(item.id, rests[i].join(' '));
    const candidates = [
      restWords.has('incline') || restWords.has('decline') ? 'Flat' : undefined,
      restWords.has('front') ? 'Back' : undefined,
      item.equipment ? EQUIPMENT_SHORT[item.equipment] : undefined,
    ];
    const pick = candidates.find((c) => c && !restWords.has(c.toLowerCase()) && !rests.some((r) => r.join(' ').toLowerCase() === c.toLowerCase()));
    out.set(item.id, pick ?? item.name);
  });
  return out;
}
