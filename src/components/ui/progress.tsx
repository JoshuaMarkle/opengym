import type { ReactNode } from 'react';
import { CheckGlyph, MinusGlyph, PlusGlyph, TrendDown, TrendUp } from '../icons';
import { cx } from './layout';

// design §8 Bars & rings. Two bar thicknesses (8 for a main bar, 4 under a label) and three
// ring sizes. A bar always has its number next to it in text.

const pct = (f: number) => `${Math.max(0, Math.min(1, f)) * 100}%`;

/**
 * design §8 Over target (Food, 10.3): past the target the bar is full; with `over` the part past
 * the target turns orange after a 2 px canvas notch, so the target stays visible. Always next to
 * the word "over".
 */
function OverFill({ frac, color }: { frac: number; color: string }) {
  const at = pct(1 / frac);
  return (
    <>
      <i className={cx('absolute inset-y-0 left-0 w-full rounded-full', color)} />
      <i className="absolute inset-y-0 z-10 -ml-px w-0.5 bg-bg" style={{ left: at }} />
      <i className="absolute inset-y-0 right-0 rounded-r-full bg-warn" style={{ left: at }} />
    </>
  );
}

const TARGET_TONE = { fg: 'bg-fg', tip: 'bg-tip', warn: 'bg-warn', accent: 'bg-accent' } as const;

/** design §8 Target bar: h8, the one main number on a screen against its target. Track surface-2. `over`: see OverFill. */
export function TargetBar({ frac, tone = 'fg', over, className = '' }: { frac: number; tone?: keyof typeof TARGET_TONE; over?: boolean; className?: string }) {
  return (
    <div className={cx('relative h-2 overflow-hidden rounded-full bg-surface-2', className)}>
      {over && frac > 1 ? <OverFill frac={frac} color={TARGET_TONE[tone]} /> : <i className={cx('absolute inset-y-0 left-0 rounded-full', TARGET_TONE[tone])} style={{ width: pct(frac) }} />}
    </div>
  );
}

/** design §8 Labeled bar: h4 under a Caps label, in the series color. Up to 3 side by side, gap 12. `over`: see OverFill. */
export function LabeledBar({ frac, color = 'bg-accent', over, className = '' }: { frac: number; color?: string; over?: boolean; className?: string }) {
  return (
    <div className={cx('relative mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2', className)}>
      {over && frac > 1 ? <OverFill frac={frac} color={color} /> : <i className={cx('absolute inset-y-0 left-0 rounded-full', color)} style={{ width: pct(frac) }} />}
    </div>
  );
}

/** design §8 Goal bar: h8, green ahead / orange behind, with a white 3 × 16 marker where steady gains would put you today. */
export function GoalBar({ frac, marker, behind, markerLabel, className = '' }: { frac: number; marker?: number; behind?: boolean; markerLabel?: string; className?: string }) {
  return (
    <div className={cx('relative h-2 rounded-full bg-surface-2', className)}>
      <div className={cx('absolute inset-y-0 left-0 rounded-full', behind ? 'bg-warn' : 'bg-tip')} style={{ width: pct(frac) }} />
      {marker != null && <div className="absolute -top-1 h-4 w-0.75 -translate-x-1/2 rounded-full bg-fg" style={{ left: pct(marker) }} aria-label={markerLabel} />}
    </div>
  );
}

export type Step = 'done' | 'current' | 'todo';

/** design §8 Segmented bar: h4, one segment per step, gap 4. Done blue, current white, to do surface-2. */
export function SegmentBar({ steps, className = '' }: { steps: Step[]; className?: string }) {
  return (
    <div className={cx('flex gap-1', className)} aria-hidden>
      {steps.map((s, i) => (
        <i key={i} className={cx('h-1 flex-1 rounded-full', s === 'done' ? 'bg-accent' : s === 'current' ? 'bg-fg' : 'bg-surface-2')} />
      ))}
    </div>
  );
}

export type RingSize = 's' | 'row' | 'm' | 'l';
const RING: Record<RingSize, { px: number; stroke: number }> = { s: { px: 36, stroke: 3 }, row: { px: 28, stroke: 3 }, m: { px: 104, stroke: 8 }, l: { px: 144, stroke: 10 } };

/**
 * design §8 Ring: S 36/3 (28/3 in rows), M 104/8, L 144/10. `progress` (0–1, blue from 12
 * o'clock) or `segments` (fractions in series order, round caps, a 3 px gap). Track surface-2.
 */
export function Ring({
  size = 's',
  progress,
  segments,
  color = 'var(--og-accent)',
  track = 'var(--og-surface-2)',
  children,
  className = '',
}: {
  size?: RingSize;
  progress?: number;
  segments?: { frac: number; color: string }[];
  color?: string;
  /** The empty ring: surface-2, or line-strong for today in the Food strip (10.1). */
  track?: string;
  children?: ReactNode;
  className?: string;
}) {
  const { px, stroke } = RING[size];
  const r = px / 2 - stroke / 2;
  const c = 2 * Math.PI * r;
  const gap = segments && segments.filter((s) => s.frac > 0).length > 1 ? 3 + stroke : 0;
  let at = 0;
  return (
    <span className={cx('relative flex flex-none items-center justify-center', className)} style={{ width: px, height: px }}>
      <svg width={px} height={px} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={px / 2} cy={px / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {progress != null && progress > 0 && <circle cx={px / 2} cy={px / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={`${c * Math.min(1, progress)} ${c}`} strokeLinecap="round" />}
        {segments?.map((s, i) => {
          if (s.frac <= 0) return null;
          const len = Math.max(0, c * s.frac - gap);
          const el = <circle key={i} cx={px / 2} cy={px / 2} r={r} fill="none" stroke={s.color} strokeWidth={stroke} strokeDasharray={`${len} ${c}`} strokeDashoffset={-at} strokeLinecap="round" />;
          at += c * s.frac;
          return el;
        })}
      </svg>
      {children !== undefined && <span className="relative flex flex-col items-center justify-center text-center">{children}</span>}
    </span>
  );
}

/** A Ring S in a row (4.12): "2/4" while going, a full ring with a check once every set is done. */
export function CountRing({ done, total }: { done: number; total: number }) {
  const complete = total > 0 && done >= total;
  return (
    <Ring size="row" progress={total ? done / total : 0}>
      {complete ? <CheckGlyph size={12} className="text-accent" /> : <span className={cx('text-micro', done > 0 ? 'text-fg' : 'text-fg2')}>{`${done}/${total}`}</span>}
    </Ring>
  );
}

/** A trend number or word with TrendUp / TrendDown 9 in front (design §3: never a typed ▲ ▼). No `dir`: the text alone. */
export function TrendText({ dir, children, className = '' }: { dir?: 'up' | 'down'; children: ReactNode; className?: string }) {
  if (!dir) return <span className={className}>{children}</span>;
  return (
    <span className={cx('inline-flex items-center gap-1', className)}>
      {dir === 'up' ? <TrendUp size={9} className="flex-none" /> : <TrendDown size={9} className="flex-none" />}
      <span>{children}</span>
    </span>
  );
}

const int = (v: number) => Math.round(v).toLocaleString('en-US');

/**
 * design §8 Target summary (Food 10.1, Home 3.8): the day's main number in Title 1 with
 * "/ target unit" in Callout fg2 and "1,356 left" / "160 over" on the right, then the target
 * bar. Orange (number, word count, bar past the notch) only when `over`. No target: the number
 * alone with its unit.
 */
export function TargetSummary({ value, target, unit, over, className = '' }: { value: number; target?: number; unit: string; over?: boolean; className?: string }) {
  if (!target)
    return (
      <div className={cx('mt-4', className)}>
        <span className="text-title1">{int(value)}</span> <span className="text-callout text-fg2">{unit}</span>
      </div>
    );
  const d = Math.round(target - value);
  return (
    <div className={cx('mt-4', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate">
          <span className={cx('text-title1', over && 'text-warn')}>{int(value)}</span>{' '}
          <span className="text-callout text-fg2">
            / {int(target)} {unit}
          </span>
        </span>
        <span className="flex-none text-callout text-fg2">
          <b className={over ? 'text-warn' : 'text-fg'}>{int(Math.abs(d))}</b> {d >= 0 ? 'left' : 'over'}
        </span>
      </div>
      <TargetBar frac={value / target} over={over} className="mt-2" />
    </div>
  );
}

export interface MacroBar {
  label: string;
  value: number;
  target?: number;
  /** Fill class: bg-accent (protein), bg-cyan (carbs), bg-gold (fat). */
  color: string;
  /** Past a ceiling (3% grace): orange number and notch. */
  over?: boolean;
  /** A floor reached (protein): a green check after the label, never a color change. */
  met?: boolean;
  unit?: string;
}

/**
 * design §8 Macro bars (Food 10.1): three labeled bars side by side, gap 12. Caps label, then
 * Headline value with "/ target g" in Footnote fg2, then a 4 px bar in the macro's own color.
 * Without targets (Just log) the bars go and the values stay.
 */
export function MacroBars({ items, className = '' }: { items: MacroBar[]; className?: string }) {
  return (
    <div className={cx('grid grid-cols-3 gap-3', className)}>
      {items.map((m) => (
        <div key={m.label} className="min-w-0 text-left">
          <div className="flex items-center gap-1 text-caps text-fg2">
            {m.label}
            {m.met && <CheckGlyph size={10} className="text-tip" aria-label="reached" />}
          </div>
          <div className="truncate">
            <b className={cx('text-headline', m.over && 'text-warn')}>{int(m.value)}</b>{' '}
            <span className="text-footnote text-fg2">{m.target ? `/ ${int(m.target)} ${m.unit ?? 'g'}` : (m.unit ?? 'g')}</span>
          </div>
          {m.target ? <LabeledBar frac={m.value / m.target} color={m.color} over={m.over} /> : null}
        </div>
      ))}
    </div>
  );
}

const MACRO_RING = ['var(--og-accent)', 'var(--og-cyan)', 'var(--og-gold)'];
const MACRO_TEXT = ['text-accent', 'text-cyan', 'text-gold'];
const MACRO_NAME = ['Protein', 'Carbs', 'Fat'];

/** Shares of calories from protein, carbs and fat (4 / 4 / 9 kcal per g), whole percent. */
function shares(g: [number, number, number]): [number, number, number] {
  const k = [g[0] * 4, g[1] * 4, g[2] * 9];
  const t = k[0] + k[1] + k[2];
  return t ? (k.map((x) => Math.round((x / t) * 100)) as [number, number, number]) : [0, 0, 0];
}

/**
 * design §8 Macro legend: three centered columns, each the share in 12/700 in the macro's color,
 * grams in Title 3 + "g" Footnote fg2, the name in Caption fg2. `steps` adds a Stepper-style pair
 * of 36 × 32 buttons under each column (Custom split, 10.12).
 */
export function MacroLegend({
  grams,
  pct,
  steps,
  className = '',
}: {
  grams: [number, number, number];
  pct?: [number, number, number];
  steps?: { canDown: (i: 0 | 1 | 2) => boolean; canUp: (i: 0 | 1 | 2) => boolean; onStep: (i: 0 | 1 | 2, dir: 1 | -1) => void };
  className?: string;
}) {
  const share = pct ?? shares(grams);
  return (
    <div className={cx('grid flex-1 grid-cols-3 text-center', className)}>
      {([0, 1, 2] as const).map((i) => (
        <div key={i}>
          <em className={cx('block text-caption font-bold not-italic', MACRO_TEXT[i])}>{share[i]}%</em>
          <div>
            <b className="text-title3">{int(grams[i])}</b>
            <span className="text-footnote text-fg2">g</span>
          </div>
          <small className="mt-0.5 block text-caption text-fg2">{MACRO_NAME[i]}</small>
          {steps && (
            <span className="mt-1 flex justify-center gap-2">
              {([-1, 1] as const).map((dir) => (
                <button
                  key={dir}
                  type="button"
                  aria-label={`${dir > 0 ? 'More' : 'Less'} ${MACRO_NAME[i].toLowerCase()}`}
                  disabled={dir > 0 ? !steps.canUp(i) : !steps.canDown(i)}
                  onClick={() => steps.onStep(i, dir)}
                  className="flex h-11 items-center disabled:opacity-40"
                >
                  <span className="flex h-8 w-9 items-center justify-center rounded-sm bg-surface-2 text-accent active:opacity-60">
                    {dir > 0 ? <PlusGlyph size={14} /> : <MinusGlyph size={14} />}
                  </span>
                </button>
              ))}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Ring segments for a macro split, by share of calories. */
export function macroSegments(grams: [number, number, number], pct?: [number, number, number]) {
  const s = pct ?? shares(grams);
  const t = s[0] + s[1] + s[2] || 1;
  return s.map((v, i) => ({ frac: v / t, color: MACRO_RING[i] }));
}

/**
 * design §8 Ring with legend (Food 10.16, 10.9, 10.21): Ring M (104 / 8) split by each macro's
 * share of calories, the kcal in Title 2 with "kcal" Caption inside, and the macro legend beside
 * it. Hairlines above and below, py 16.
 */
export function MacroRing({ kcal, grams, className = '' }: { kcal: number; grams: [number, number, number]; className?: string }) {
  return (
    <div className={cx('flex items-center gap-4 border-y border-line py-4', className)}>
      <Ring size="m" segments={macroSegments(grams)}>
        <b className="text-title2">{int(kcal)}</b>
        <small className="text-caption text-fg2">kcal</small>
      </Ring>
      <MacroLegend grams={grams} />
    </div>
  );
}
