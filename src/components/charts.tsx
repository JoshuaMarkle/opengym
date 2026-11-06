import { useLayoutEffect, useRef, useState } from 'react';
import { allTimeHighs, niceTicks, trend } from '../lib/chart';
import { monthShort } from '../lib/dates';
import { formatNumber } from '../lib/units';

export interface ChartPoint {
  date: number;
  value: number;
  /** Small label above the dot (reps, for the top-set chart). */
  label?: string;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function monthTicks(from: number, to: number, max = 6): number[] {
  const out: number[] = [];
  const d = new Date(from);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  if (d.getTime() < from) d.setMonth(d.getMonth() + 1);
  while (d.getTime() <= to) {
    out.push(d.getTime());
    d.setMonth(d.getMonth() + 1);
  }
  if (out.length <= max) return out;
  const step = Math.ceil(out.length / max);
  return out.filter((_, i) => i % step === 0);
}

/**
 * Progress chart (7.2 / 7.3 / 4.9). `style="trend"`: blue trend line through
 * session dots, white dots = new all-time highs, last session ringed in blue.
 * `style="top"`: the real top sets joined by a quiet line, reps written above.
 */
export function LiftChart({
  points,
  from,
  to = Date.now(),
  height = 190,
  style = 'trend',
  priorBest,
}: {
  points: ChartPoint[];
  from?: number;
  to?: number;
  height?: number;
  style?: 'trend' | 'top';
  /** Best value before the visible range, so "all-time high" stays all-time. */
  priorBest?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const padL = 34;
  const padR = 10;
  const padT = style === 'top' ? 18 : 10;
  const padB = 20;
  const start = from ?? points[0]?.date ?? to;
  const span = Math.max(1, to - start);
  const vals = points.map((p) => p.value);
  const ticks = vals.length ? niceTicks(Math.min(...vals), Math.max(...vals), 3) : [];
  const lo = ticks[0] ?? 0;
  const hi = ticks[ticks.length - 1] ?? 1;
  const iw = Math.max(1, width - padL - padR);
  const ih = height - padT - padB;
  const x = (d: number) => padL + ((d - start) / span) * iw;
  const y = (v: number) => padT + ih - ((v - lo) / Math.max(1e-9, hi - lo)) * ih;
  const highs = allTimeHighs(vals, priorBest);
  const smooth = trend(vals, 3);
  const months = monthTicks(start, to);

  return (
    <div ref={ref} className="mt-2 w-full">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Progress chart" className="block overflow-visible">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke="var(--og-chart-grid)" />
              <text x={0} y={y(t) + 3.5} fill="var(--og-fg2)" fontSize="11">
                {formatNumber(t, 1)}
              </text>
            </g>
          ))}
          {months.map((m, i) => (
            <text
              key={m}
              x={x(m)}
              y={height - 4}
              fill="var(--og-fg2)"
              fontSize="11"
              textAnchor={i === 0 && x(m) - padL < 12 ? 'start' : 'middle'}
            >
              {monthShort(new Date(m).getMonth())}
            </text>
          ))}
          {style === 'trend' ? (
            <>
              {points.length > 1 && (
                <polyline
                  points={points.map((p, i) => `${x(p.date)},${y(smooth[i])}`).join(' ')}
                  fill="none"
                  stroke="#2e8bff"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              {points.map((p, i) =>
                highs.has(i) ? (
                  <circle key={i} cx={x(p.date)} cy={y(p.value)} r="3.4" fill="var(--og-fg)" />
                ) : (
                  <circle key={i} cx={x(p.date)} cy={y(p.value)} r="2.2" fill="var(--og-chart-dot)" />
                ),
              )}
              {points.length > 0 && (
                <circle cx={x(points[points.length - 1].date)} cy={y(points[points.length - 1].value)} r="5.5" fill="#2e8bff" stroke="var(--og-bg)" strokeWidth="2" />
              )}
            </>
          ) : (
            <>
              {points.length > 1 && (
                <polyline points={points.map((p) => `${x(p.date)},${y(p.value)}`).join(' ')} fill="none" stroke="var(--og-line-strong)" strokeWidth="1.5" />
              )}
              {points.map((p, i) => (
                <g key={i}>
                  <circle cx={x(p.date)} cy={y(p.value)} r="3.6" fill={i === points.length - 1 ? '#2e8bff' : 'var(--og-fg)'} />
                  {p.label && points.length <= 40 && (
                    <text x={x(p.date)} y={y(p.value) - 8} fill="var(--og-fg2)" fontSize="10" fontWeight="700" textAnchor="middle">
                      {p.label}
                    </text>
                  )}
                </g>
              ))}
            </>
          )}
        </svg>
      )}
    </div>
  );
}

/** Tiny trend line for the pinned-lifts list (7.1). */
export function Sparkline({ values, width = 70, height = 26 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden>
        <line x1="0" x2={width} y1={height / 2} y2={height / 2} stroke="var(--og-line-strong)" strokeWidth="1.5" strokeDasharray="3 3" />
      </svg>
    );
  }
  const sm = trend(values, 3);
  const lo = Math.min(...sm);
  const hi = Math.max(...sm);
  const pts = sm.map((v, i) => `${(i / (sm.length - 1)) * width},${hi === lo ? height / 2 : height - 2 - ((v - lo) / (hi - lo)) * (height - 4)}`);
  return (
    <svg width={width} height={height} aria-hidden>
      <polyline points={pts.join(' ')} fill="none" stroke="#2e8bff" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
