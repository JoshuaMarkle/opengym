import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ChevronLeft, ChevronRight, PencilGlyph } from '../icons';
import { Button } from './buttons';
import { cx } from './layout';

// design §5 Headers. Large title for tab roots, a top bar for anything pushed, a detail
// title under the bar, the workout bar, and section labels.

/** design §5B Top bar: Cancel / Back left, Headline title, Save / Done right. min-h 52, hairline. */
export function TopBar({ left, title, right, border = true }: { left?: ReactNode; title?: ReactNode; right?: ReactNode; border?: boolean }) {
  return (
    <header className={cx('grid min-h-13 flex-none grid-cols-[1fr_auto_1fr] items-center gap-2 px-2', border && 'border-b border-line')}>
      <div className="flex min-w-0 justify-start">{left}</div>
      <div className="max-w-50 truncate text-center text-headline">{title}</div>
      <div className="flex min-w-0 justify-end">{right}</div>
    </header>
  );
}

type BarButtonKind = 'plain' | 'bold' | 'muted';

/** design §9 Bar button: top-bar text button, 44 tall, 17. Back 500 · Done 700 · Cancel 400 fg2. */
export function BarButton({ children, kind = 'plain', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: BarButtonKind }) {
  return (
    <button
      type="button"
      className={cx(
        'flex h-11 items-center gap-1 rounded-sm px-2 text-body-lg leading-none whitespace-nowrap active:opacity-60 disabled:opacity-40',
        kind === 'muted' ? 'font-normal text-fg2' : kind === 'bold' ? 'font-bold text-accent' : 'font-medium text-accent',
        className,
      )}
      {...rest}
    >
      {/* Optically center the cap height on the 44 px row. */}
      {typeof children === 'string' ? <span className="translate-y-0.5">{children}</span> : children}
    </button>
  );
}

/** design §5B Back: ChevronLeft 17 + label 17/500 blue, gap 12. */
export function BackButton({ label, onClick, className = '' }: { label: string; onClick: () => void; className?: string }) {
  return (
    <BarButton onClick={onClick} className={cx('gap-3 pl-1', className)} aria-label={`Back to ${label}`}>
      <ChevronLeft size={17} className="mr-0.5" />
      {/* 6.6 / 2.11: optically align the text with the centered chevron. */}
      <span className="translate-y-0.5">{label}</span>
    </BarButton>
  );
}

/** design §5A Large title: tab roots only. Display 34, Footnote subtitle, at most 2 controls on the right. */
export function LargeHeader({ title, subtitle, right }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <header className="flex-none px-4 pt-2 pb-2">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-display">{title}</h1>
        {right && <div className="-mr-1.5 flex flex-none items-center gap-1">{right}</div>}
      </div>
      {subtitle && <div className="text-footnote text-fg2">{subtitle}</div>}
    </header>
  );
}

/** design §5C Detail title: Title 1 under a top bar, wraps to 2 lines, Callout meta under it. */
export function DetailTitle({ title, meta, right, className = '' }: { title: ReactNode; meta?: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cx('mt-1 flex items-start gap-3', className)}>
      <div className="min-w-0 flex-1">
        <h1 className="line-clamp-2 text-title1">{title}</h1>
        {meta && <div className="mt-0.5 text-callout text-fg2">{meta}</div>}
      </div>
      {right && <div className="flex flex-none items-center">{right}</div>}
    </div>
  );
}

/**
 * design §5D Workout bar (4.1): back to All exercises, name 17/700 over a Footnote meta line,
 * the pencil (5.4) and the compact Finish. A past date shows as "Logging Nov 4" in orange 600.
 */
export function WorkoutBar({
  name,
  meta,
  pastDate,
  backLabel,
  onBack,
  onOptions,
  onFinish,
  finishing,
}: {
  name: ReactNode;
  meta: ReactNode;
  pastDate?: string;
  backLabel: string;
  onBack: () => void;
  onOptions: () => void;
  onFinish: () => void;
  finishing?: boolean;
}) {
  return (
    <header className="flex min-h-15 flex-none items-center gap-1 border-b border-line pr-4 pl-1">
      <button type="button" aria-label={backLabel} onClick={onBack} className="flex h-11 w-9 flex-none items-center justify-center text-accent">
        <ChevronLeft size={17} />
      </button>
      <div className="min-w-0 flex-1 py-1">
        <span className="block truncate text-headline">{name}</span>
        <span className="block truncate text-footnote text-fg2">
          {meta}
          {/* 4.35 / PH3.7: the timer stays live while the finished session uses this date. */}
          {pastDate && <span className="font-semibold text-warn"> · Logging {pastDate}</span>}
        </span>
      </div>
      {/* 5.4: pause, rename, start time, discard. */}
      <button type="button" aria-label="Workout options" onClick={onOptions} className="flex h-11 w-11 flex-none items-center justify-center text-accent active:opacity-60">
        <PencilGlyph size={18} />
      </button>
      <Button size="compact" onClick={onFinish} disabled={finishing}>
        Finish
      </Button>
    </header>
  );
}

/** design §5E Section label: Caps 11 fg2, optional action on the right, hairline under. Every list starts with one. */
export function SectionLabel({ children, action, className = '', tone }: { children: ReactNode; action?: ReactNode; className?: string; tone?: 'warn' | 'accent' }) {
  return (
    <div className={cx('mt-5 flex items-end justify-between border-b border-line pb-1.5 text-caps', tone === 'warn' ? 'text-warn' : tone === 'accent' ? 'text-accent' : 'text-fg2', className)}>
      <span className="min-w-0 truncate">{children}</span>
      {action}
    </div>
  );
}

/** design §5E Label action: 13/600 blue, sentence case, 44 tall, with ChevronRight 10 when it opens somewhere. */
export function LabelAction({ children, onClick, tone = 'accent', chevron = false }: { children: ReactNode; onClick?: () => void; tone?: 'accent' | 'muted'; chevron?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx('-my-3 -mr-2 flex h-11 items-center gap-1 px-2 text-footnote font-semibold tracking-normal normal-case active:opacity-60', tone === 'accent' ? 'text-accent' : 'text-fg2')}
    >
      {children}
      {chevron && <ChevronRight size={10} />}
    </button>
  );
}

/** design §10 Field label: the section label without its hairline, above an input (gap 6). */
export function FieldLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={cx('mt-5 text-caps text-fg2', className)}>{children}</div>;
}
