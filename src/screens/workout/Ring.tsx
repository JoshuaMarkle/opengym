import { CheckGlyph } from '../../components/icons';
import { cx } from '../../components/ui';

/** Progress ring for the All exercises list (4.12): ✓ when done, "2/4" otherwise. */
export function Ring({ done, total, size = 32 }: { done: number; total: number; size?: number }) {
  const complete = total > 0 && done >= total;
  if (complete)
    return (
      <span className="flex flex-none items-center justify-center rounded-full bg-accent text-white" style={{ width: size, height: size }}>
        <CheckGlyph size={14} />
      </span>
    );
  const r = size / 2 - 2;
  const c = 2 * Math.PI * r;
  const frac = total ? done / total : 0;
  return (
    <span className="relative flex flex-none items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--og-line-strong)" strokeWidth="2.5" />
        {frac > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--og-accent)" strokeWidth="2.5" strokeDasharray={`${c * frac} ${c}`} strokeLinecap="round" />}
      </svg>
      <span className={cx('relative text-[10px] font-bold', frac > 0 ? 'text-fg' : 'text-fg2')}>
        {done}/{total}
      </span>
    </span>
  );
}
