import type { ReactNode } from 'react';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

/** design §4 Layout: a full-height screen with a fixed header, a scrolling body (16 px edges) and an optional pinned footer. */
export function Screen({
  header,
  footer,
  children,
  bodyClass = '',
  scrollRef,
  noPad = false,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  bodyClass?: string;
  scrollRef?: React.Ref<HTMLDivElement>;
  noPad?: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {header}
      <div ref={scrollRef} className={cx('scroll-y relative min-h-0 flex-1', !noPad && 'px-4', !footer && 'pb-safe', bodyClass)}>
        {children}
        {!footer && <div className="h-6" />}
      </div>
      {footer && (
        <div data-dock className="flex-none">
          {footer}
        </div>
      )}
    </div>
  );
}
