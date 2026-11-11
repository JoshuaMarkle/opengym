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
 * Progress chart (7.2 / 7.3 / 4.8). `style="trend"`: blue trend line through
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
                  stroke="var(--og-accent)"
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
                <circle cx={x(points[points.length - 1].date)} cy={y(points[points.length - 1].value)} r="5.5" fill="var(--og-accent)" stroke="var(--og-bg)" strokeWidth="2" />
              )}
            </>
          ) : (
            <>
              {points.length > 1 && (
                <polyline points={points.map((p) => `${x(p.date)},${y(p.value)}`).join(' ')} fill="none" stroke="var(--og-line-strong)" strokeWidth="1.5" />
              )}
              {points.map((p, i) => (
                <g key={i}>
                  <circle cx={x(p.date)} cy={y(p.value)} r="3.6" fill={i === points.length - 1 ? 'var(--og-accent)' : 'var(--og-fg)'} />
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
      <polyline points={pts.join(' ')} fill="none" stroke="var(--og-accent)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
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
            return <rect key={i} x={padL + slot * i + (slot - bw) / 2} y={padT + ih - h} width={bw} height={h} rx={Math.min(3, bw / 3)} fill={i === values.length - 1 ? 'var(--og-accent)' : 'var(--og-bar)'} />;
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

export interface MacroDay {
  key: string;
  /** Weekday letter under the bar. */
  letter: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
  /** More than 3% over the day's target: an orange dot over the bar (with "over" in the day list). */
  over?: boolean;
  today?: boolean;
  future?: boolean;
}

/**
 * Week of calories as stacked macro bars (board A5, design §15): 28 wide, top rounded r4, protein ·
 * carbs · fat from the bottom in accent · cyan · gold, sized by their calories and scaled to the
 * day's total. Calories without macros (a quick add) stack on top in the plain bar color. The
 * target is the dashed white line; days over it get an orange dot. Tap a bar to open the day.
 */
export function MacroWeekBars({ days, target, onPick, height = 160 }: { days: MacroDay[]; target?: number; onPick?: (key: string) => void; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const padL = 36;
  const padT = 14;
  const padB = 20;
  const max = Math.max(1, ...days.map((d) => d.kcal), (target ?? 0) * 1.1);
  const ticks = niceTicks(0, max, 3).filter((t) => t > 0);
  const hi = Math.max(max, ticks[ticks.length - 1] ?? 1);
  const iw = Math.max(1, width - padL);
  const ih = height - padT - padB;
  const slot = iw / Math.max(1, days.length);
  const bw = Math.min(28, slot * 0.7);
  const y = (v: number) => padT + ih - (v / hi) * ih;
  const kLabel = (v: number) => (v >= 1000 ? `${formatNumber(v / 1000, 1)}k` : formatNumber(v, 0));
  return (
    <div ref={ref} className="mt-4 w-full">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Calories by day, split into protein, carbs and fat" className="block overflow-visible">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={width} y1={y(t)} y2={y(t)} stroke="var(--og-chart-grid)" />
              <text x={0} y={y(t) + 4} fill="var(--og-fg2)" fontSize="11">
                {kLabel(t)}
              </text>
            </g>
          ))}
          {days.map((d, i) => {
            const x = padL + slot * i + (slot - bw) / 2;
            const parts = [d.p * 4, d.c * 4, d.f * 9];
            const fromMacros = parts.reduce((a, b) => a + b, 0);
            const sc = fromMacros > d.kcal && fromMacros > 0 ? d.kcal / fromMacros : 1;
            const segs = [...parts.map((v) => v * sc), Math.max(0, d.kcal - fromMacros * sc)];
            const colors = ['var(--og-accent)', 'var(--og-cyan)', 'var(--og-gold)', 'var(--og-bar)'];
            const total = (d.kcal / hi) * ih;
            const top = padT + ih - total;
            let acc = padT + ih;
            const id = `mwb-${d.key}`;
            return (
              <g key={d.key} onClick={onPick ? () => onPick(d.key) : undefined} className={onPick ? 'cursor-pointer' : undefined}>
                <rect x={padL + slot * i} y={0} width={slot} height={height} fill="transparent" />
                {total > 0 && (
                  <>
                    <clipPath id={id}>
                      <path d={`M${x} ${padT + ih}V${top + Math.min(4, total)}Q${x} ${top} ${x + 4} ${top}H${x + bw - 4}Q${x + bw} ${top} ${x + bw} ${top + Math.min(4, total)}V${padT + ih}Z`} />
                    </clipPath>
                    {/* Logged ahead: faded until the day comes. */}
                    <g clipPath={`url(#${id})`} opacity={d.future ? 0.4 : 1}>
                      {segs.map((v, j) => {
                        const h = (v / hi) * ih;
                        acc -= h;
                        return h > 0 ? <rect key={j} x={x} y={acc} width={bw} height={h + 0.5} fill={colors[j]} /> : null;
                      })}
                    </g>
                  </>
                )}
                {d.over && <circle cx={x + bw / 2} cy={top - 8} r={3} fill="var(--og-warn)" />}
                <text x={x + bw / 2} y={height - 4} fill={d.today ? 'var(--og-fg)' : 'var(--og-fg2)'} fontSize="10" fontWeight="700" textAnchor="middle">
                  {d.letter}
                </text>
              </g>
            );
          })}
          {target ? <line x1={padL} x2={width} y1={y(target)} y2={y(target)} stroke="var(--og-fg)" strokeWidth="1.2" strokeDasharray="4 4" /> : null}
        </svg>
      )}
    </div>
  );
}
