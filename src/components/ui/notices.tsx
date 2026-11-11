import type { ReactNode } from 'react';
import { CheckGlyph, TrendDown, TrendUp } from '../icons';
import { Button, Disc, TextButton } from './buttons';
import { cx } from './layout';
import { SegmentBar, type Step } from './progress';

// design §11 Inline notices: strips in the page with a hairline or a colored left rule. No
// boxes or fills. A notice only asks; it never changes what someone typed.

type Tone = 'tip' | 'warn' | 'fg';
const TONE: Record<Tone, string> = { tip: 'text-tip', warn: 'text-warn', fg: 'text-fg' };

/**
 * design §11 Offer bar: the suggestion bar (4.27), the "Back after a break?" question (4.32) and
 * the Tip line. Title Body 15/700 in its tone (TrendUp / TrendDown 10 in front), reason Caption
 * fg2, "Why", then the dismiss and accept discs (L 34). A `kicker` ("Tip") puts a blue Caps label
 * before plain Footnote text instead of a title.
 */
export function OfferBar({
  title,
  tone = 'fg',
  trend,
  reason,
  kicker,
  children,
  onWhy,
  onDismiss,
  dismissLabel = 'Dismiss',
  onAccept,
  acceptLabel = 'Accept',
  line = true,
  className = '',
}: {
  title?: ReactNode;
  tone?: Tone;
  trend?: 'up' | 'down';
  reason?: ReactNode;
  kicker?: string;
  children?: ReactNode;
  onWhy?: () => void;
  onDismiss?: () => void;
  dismissLabel?: string;
  onAccept?: () => void;
  acceptLabel?: string;
  /** Hairline under the bar; off when options follow (4.32). */
  line?: boolean;
  className?: string;
}) {
  return (
    <div className={cx('mt-2.5 flex items-center gap-1 pb-2', line && 'border-b border-line', className)}>
      <div className="min-w-0 flex-1">
        {kicker ? (
          <p className="text-footnote">
            <span className="mr-1.5 text-caps text-accent">{kicker}</span>
            {children}
          </p>
        ) : (
          <>
            <b className={cx('line-clamp-2 block text-body font-bold', TONE[tone])}>
              {trend && <span className="mr-1 inline-flex -translate-y-px align-middle">{trend === 'down' ? <TrendDown size={10} /> : <TrendUp size={10} />}</span>}
              {title}
            </b>
            {reason && <span className="block truncate text-caption text-fg2">{reason}</span>}
          </>
        )}
      </div>
      {onWhy && (
        <TextButton onClick={onWhy} className="px-2">
          Why
        </TextButton>
      )}
      {onDismiss && (
        <Disc tone="grey" label={dismissLabel} onClick={onDismiss} className={onAccept ? '' : '-mr-1.5'}>
          <span className="text-footnote font-bold">✕</span>
        </Disc>
      )}
      {onAccept && (
        <Disc tone={tone === 'warn' ? 'warn' : 'success'} label={acceptLabel} onClick={onAccept} className="-mr-1.5">
          <CheckGlyph size={14} />
        </Disc>
      )}
    </div>
  );
}

/** design §11 Confirmed: min-h 44, CheckGlyph 13 + Callout 14/600 in the tone, Undo on the right, hairline under. */
export function ConfirmedBar({ children, tone = 'tip', onUndo }: { children: ReactNode; tone?: Tone; onUndo: () => void }) {
  return (
    <div className="mt-2.5 flex min-h-11 items-center gap-2 border-b border-line">
      <span className={cx('flex min-w-0 flex-1 items-center gap-1.5 text-callout font-semibold', TONE[tone])}>
        <CheckGlyph size={13} className="flex-none" />
        <span className="truncate">{children}</span>
      </span>
      <TextButton onClick={onUndo} className="px-1">
        Undo
      </TextButton>
    </div>
  );
}

/**
 * design §11 Attention: 2 px orange left rule, pl 12. Callout 14 with an orange 600 `lead` and
 * the rest in fg2; text buttons below, gap 16.
 */
export function AttentionNote({ lead, children, actions, className = '' }: { lead?: ReactNode; children?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cx('mt-4 border-l-2 border-warn pl-3', className)}>
      <p className="text-callout">
        {lead && <b className="font-semibold text-warn">{lead}</b>}
        {lead && children ? ' ' : null}
        {children && <span className="text-fg2">{children}</span>}
      </p>
      {actions && <div className="flex gap-4">{actions}</div>}
    </div>
  );
}

/** design §11 / §15 Live dot: 7 px green, pulsing. The resume bar and Home's live block share it. */
export function LiveDot({ className = '' }: { className?: string }) {
  return <i aria-hidden data-volatile className={cx('anim-pulse block h-1.75 w-1.75 flex-none rounded-full bg-tip', className)} />;
}

/**
 * design §11 Live status (3.2): hairlines top and bottom, the live dot and Caps "In progress" in
 * green, the timer, Title 2 name, Callout "where", a segmented bar of exercises, Resume.
 */
export function LiveStatus({ title, timer, where, detail, steps, onResume }: { title: ReactNode; timer: ReactNode; where: ReactNode; detail?: ReactNode; steps: Step[]; onResume: () => void }) {
  return (
    <div className="mt-2 border-y border-line pt-2.5 pb-3">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-caps text-tip">
          <LiveDot />
          In progress
        </span>
        <span className="text-callout font-bold" data-volatile>
          {timer}
        </span>
      </div>
      <b className="mt-0.5 block truncate text-title2">{title}</b>
      <div className="mt-0.5 truncate text-callout">
        {where}
        {detail && <span className="text-fg2"> · {detail}</span>}
      </div>
      {steps.length > 0 && <SegmentBar steps={steps} className="mt-2.5" />}
      <Button className="mt-3" onClick={onResume}>
        Resume
      </Button>
    </div>
  );
}

/** design §3 / §10 Empty state: a dashed glyph box, Title 3, Callout fg2. */
export function EmptyState({ icon, title, children, className = '' }: { icon: ReactNode; title: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex flex-col items-center px-6 text-center', className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-lg border-[1.5px] border-dashed border-line-strong text-fg3">{icon}</div>
      <div className="mt-3.5 text-title3">{title}</div>
      {children && <p className="mt-1.5 text-callout text-fg2">{children}</p>}
    </div>
  );
}

/** A Footnote fg2 paragraph under a block. */
export function Note({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={cx('mt-2.5 text-footnote text-fg2', className)}>{children}</p>;
}
