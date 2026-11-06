/** "Nice" round tick values covering [min, max], about `count` of them. */
export function niceTicks(min: number, max: number, count = 3): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.05);
    min -= pad;
    max += pad;
  }
  const span = max - min;
  const rough = span / Math.max(1, count - 1);
  const mag = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(6)));
  return ticks;
}

/** Trailing moving average, the "trend" line drawn through session dots. */
export function trend(values: number[], window = 3): number[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

/** Indices of points that set a new all-time high (relative to everything before them). */
export function allTimeHighs(values: number[], priorBest = -Infinity): Set<number> {
  const out = new Set<number>();
  let best = priorBest;
  values.forEach((v, i) => {
    if (v > best) {
      out.add(i);
      best = v;
    }
  });
  return out;
}

export type ChartRange = '1M' | '3M' | '6M' | '1Y' | 'All';
export const CHART_RANGES: ChartRange[] = ['1M', '3M', '6M', '1Y', 'All'];
const RANGE_MONTHS: Record<Exclude<ChartRange, 'All'>, number> = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12 };

/** Start timestamp of a range ending now (undefined = all time). */
export function rangeStart(range: ChartRange, now = Date.now()): number | undefined {
  if (range === 'All') return undefined;
  const d = new Date(now);
  d.setMonth(d.getMonth() - RANGE_MONTHS[range]);
  return d.getTime();
}

/** Ranges hide when there isn't that much history; All always shows. */
export function availableChartRanges(firstSession: number | undefined, now = Date.now()): ChartRange[] {
  if (firstSession === undefined) return ['All'];
  return CHART_RANGES.filter((r) => r === 'All' || (rangeStart(r, now) ?? 0) >= firstSession);
}

export const RANGE_WORDS: Record<ChartRange, string> = {
  '1M': 'in 1 month',
  '3M': 'in 3 months',
  '6M': 'in 6 months',
  '1Y': 'in a year',
  All: 'all time',
};
