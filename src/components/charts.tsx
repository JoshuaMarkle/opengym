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

/**
 * 7.7 / 7.8: one bar per week. The current week is blue (it isn't over yet); the
 * dashed line is the average. Month labels sit under the first week of each month.
 */
export function WeeklyBars({ weeks, values, avg, height = 170, format = (v: number) => formatNumber(v, 1) }: { weeks: number[]; values: number[]; avg?: number; height?: number; format?: (v: number) => string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const padL = 30;
  const padR = 4;
  const padT = 8;
  const padB = 20;
  const max = Math.max(0, ...values, avg ?? 0);
  const ticks = niceTicks(0, max > 0 ? max : 1, 3);
  const hi = ticks[ticks.length - 1] || 1;
  const iw = Math.max(1, width - padL - padR);
  const ih = height - padT - padB;
  const n = Math.max(1, values.length);
  const slot = iw / n;
  const bw = Math.max(2, Math.min(22, slot * 0.68));
  const y = (v: number) => padT + ih - (v / hi) * ih;
  // A label for the first week of each month, thinned so they don't collide.
  const labels: { i: number; text: string }[] = [];
  weeks.forEach((w, i) => {
    const m = new Date(w).getMonth();
    const prev = i > 0 ? new Date(weeks[i - 1]).getMonth() : -1;
    if (i === weeks.length - 1) labels.push({ i, text: 'Now' });
    else if (m !== prev && i > 0) labels.push({ i, text: monthShort(m) });
  });
  const spaced = labels.filter((l, k) => {
    const next = labels[k + 1];
    return !next || (next.i - l.i) * slot >= 30;
  });

  return (
    <div ref={ref} className="mt-2 w-full">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Weekly totals" className="block overflow-visible">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke="var(--og-chart-grid)" />
              <text x={0} y={y(t) + 3.5} fill="var(--og-fg2)" fontSize="11">
                {format(t)}
              </text>
            </g>
          ))}
          {values.map((v, i) => {
            const h = Math.max(v > 0 ? 2 : 0, (v / hi) * ih);
            return <rect key={i} x={padL + slot * i + (slot - bw) / 2} y={padT + ih - h} width={bw} height={h} rx={Math.min(3, bw / 3)} fill={i === values.length - 1 ? '#2e8bff' : 'var(--og-bar)'} />;
          })}
          {avg !== undefined && avg > 0 && <line x1={padL} x2={width - padR} y1={y(avg)} y2={y(avg)} stroke="var(--og-fg2)" strokeDasharray="3 3" strokeWidth="1" />}
          {spaced.map((l) => (
            <text key={l.i} x={padL + slot * l.i + slot / 2} y={height - 4} fill="var(--og-fg2)" fontSize="11" textAnchor={l.text === 'Now' ? 'end' : 'middle'} dx={l.text === 'Now' ? slot / 2 : 0}>
              {l.text}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}

export interface ForecastBand {
  date: number;
  lo: number;
  hi: number;
}

/**
 * Trend and projection chart (proposal C1, D2, D3, F3, F4). Grey session dots, the
 * fitted trend in blue, an optional shaded band (the projection's slow–fast edges, or
 * the ±wobble zone), a dashed projection, a dashed target line and a date marker.
 * Gaps of 3+ weeks are left blank with a label, never drawn as drops.
 */
export function ForecastChart({
  points,
  from,
  to,
  fit,
  band,
  curve,
  target,
  targetLabel,
  marker,
  markerTone = 'tip',
  gaps,
  height = 190,
  label = 'Trend chart',
}: {
  points: ChartPoint[];
  from: number;
  to: number;
  fit?: ChartPoint[];
  band?: ForecastBand[];
  curve?: ChartPoint[];
  target?: number;
  targetLabel?: string;
  marker?: number;
  markerTone?: 'tip' | 'warn' | 'fg2';
  gaps?: { from: number; to: number; label: string }[];
  height?: number;
  label?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const padL = 34;
  const padR = 10;
  const padT = 12;
  const padB = 20;
  const span = Math.max(1, to - from);
  const vals = [...points.map((p) => p.value), ...(fit ?? []).map((p) => p.value), ...(curve ?? []).map((p) => p.value), ...(band ?? []).flatMap((b) => [b.lo, b.hi]), ...(target != null ? [target] : [])];
  const ticks = vals.length ? niceTicks(Math.min(...vals), Math.max(...vals), 3) : [];
  const lo = ticks[0] ?? 0;
  const hi = ticks[ticks.length - 1] ?? 1;
  const iw = Math.max(1, width - padL - padR);
  const ih = height - padT - padB;
  const x = (d: number) => padL + ((Math.min(to, Math.max(from, d)) - from) / span) * iw;
  const y = (v: number) => padT + ih - ((v - lo) / Math.max(1e-9, hi - lo)) * ih;
  const months = monthTicks(from, to);
  const line = (ps: ChartPoint[]) => ps.map((p) => `${x(p.date)},${y(p.value)}`).join(' ');
  const toneVar = markerTone === 'tip' ? 'var(--og-tip)' : markerTone === 'warn' ? 'var(--color-warn)' : 'var(--og-fg2)';

  return (
    <div ref={ref} className="mt-2 w-full">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label} className="block overflow-visible">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke="var(--og-chart-grid)" />
              <text x={0} y={y(t) + 3.5} fill="var(--og-fg2)" fontSize="11">
                {formatNumber(t, 1)}
              </text>
            </g>
          ))}
          {months.map((m, i) => (
            <text key={m} x={x(m)} y={height - 4} fill="var(--og-fg2)" fontSize="11" textAnchor={i === 0 && x(m) - padL < 12 ? 'start' : 'middle'}>
              {monthShort(new Date(m).getMonth())}
            </text>
          ))}
          {band && band.length > 1 && (
            <polygon
              points={[...band.map((b) => `${x(b.date)},${y(b.hi)}`), ...[...band].reverse().map((b) => `${x(b.date)},${y(b.lo)}`)].join(' ')}
              fill="var(--color-accent-soft)"
            />
          )}
          {gaps?.map((g) => (
            <g key={g.from}>
              <rect x={x(g.from)} y={padT} width={Math.max(0, x(g.to) - x(g.from))} height={ih} fill="var(--og-surface)" opacity="0.7" />
              <text x={(x(g.from) + x(g.to)) / 2} y={padT + 12} fill="var(--og-fg2)" fontSize="10" fontWeight="700" textAnchor="middle">
                {g.label}
              </text>
            </g>
          ))}
          {target != null && (
            <g>
              <line x1={padL} x2={width - padR} y1={y(target)} y2={y(target)} stroke="var(--og-fg)" strokeWidth="1.2" strokeDasharray="4 4" />
              {targetLabel && (
                <text x={width - padR} y={y(target) - 5} fill="var(--og-fg)" fontSize="11" fontWeight="700" textAnchor="end">
                  {targetLabel}
                </text>
              )}
            </g>
          )}
          {fit && fit.length > 1 && <polyline points={line(fit)} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
          {curve && curve.length > 1 && <polyline points={line(curve)} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" />}
          {points.map((p, i) => (
            <circle key={i} cx={x(p.date)} cy={y(p.value)} r="2.6" fill="var(--og-chart-dot)" />
          ))}
          {points.length > 0 && <circle cx={x(points[points.length - 1].date)} cy={y(points[points.length - 1].value)} r="5" fill="var(--color-accent)" stroke="var(--og-bg)" strokeWidth="2" />}
          {marker != null && (
            <line x1={x(marker)} x2={x(marker)} y1={padT} y2={padT + ih} stroke={toneVar} strokeWidth="2" />
          )}
        </svg>
      )}
    </div>
  );
}
