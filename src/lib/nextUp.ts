/**
 * Next up (SPEC §4): within the active folder, the routine whose last completed
 * workout is oldest. Never done counts as oldest. Ties go to folder order.
 * A routine that's running right now is skipped.
 */
export function pickNextUp(
  routines: { id: string; order: number }[],
  lastDone: Map<string, number>,
  excludeId?: string,
): string | undefined {
  let best: { id: string; order: number; t: number } | undefined;
  for (const r of routines) {
    if (r.id === excludeId) continue;
    const t = lastDone.get(r.id) ?? -Infinity;
    if (!best || t < best.t || (t === best.t && r.order < best.order)) best = { id: r.id, order: r.order, t };
  }
  return best?.id;
}
