import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight, Handle, MinusGlyph, MoreGlyph, PlusGlyph } from '../icons';
import { DiscFace } from './buttons';
import { cx } from './layout';

// design §6 Rows & folders. A flat row on black with a hairline: a leading slot, a text block
// and one trailing slot. Folders and edit mode only change what sits in those slots.

export type RowVariant = 'single' | 'two' | 'dense';

const ROW_HEIGHT: Record<RowVariant, string> = { single: 'min-h-13', two: 'min-h-15 py-2', dense: 'min-h-13 py-2' };

/**
 * design §6 Row: min-h 52 (single line, or dense two lines) or 60 (two lines), hairline below,
 * pressed = surface 60%. Tappable when `onClick` is set; `chevron` adds ChevronRight 13 fg3.
 */
export function Row({
  children,
  onClick,
  className = '',
  chevron,
  variant = 'single',
  as = 'div',
  ...rest
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  chevron?: boolean;
  variant?: RowVariant;
  as?: 'div' | 'li';
} & Omit<React.HTMLAttributes<HTMLElement>, 'onClick' | 'className' | 'children'>) {
  const Tag = onClick ? 'button' : as;
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      {...rest}
      className={cx('flex w-full items-center gap-3 border-b border-line text-left', ROW_HEIGHT[variant], onClick && 'active:bg-surface/60', className)}
    >
      {children}
      {chevron && <ChevronRight size={13} className="flex-none text-fg3" />}
    </Tag>
  );
}

/**
 * design §6 Row text: Headline 17/700 + Callout 14 fg2 (two lines), or Body 15/600 + Caption 12
 * (dense). A badge sits 8 after the title.
 */
export function RowText({ title, subtitle, badge, dense, className = '' }: { title: ReactNode; subtitle?: ReactNode; badge?: ReactNode; dense?: boolean; className?: string }) {
  return (
    <span className={cx('block min-w-0 flex-1', className)}>
      <b className={cx('flex items-center', dense ? 'text-body font-semibold' : 'text-headline')}>
        <span className="truncate">{title}</span>
        {badge && <span className="ml-2 flex flex-none">{badge}</span>}
      </b>
      {subtitle !== undefined && <span className={cx('mt-0.5 block truncate text-fg2', dense ? 'text-caption' : 'text-callout')}>{subtitle}</span>}
    </span>
  );
}

/** The folder chevron: ChevronRight 12 closed, ChevronDown 12 open, fg2, in a 16 box. */
export function FolderChevron({ open }: { open: boolean }) {
  return <span className="flex w-4 flex-none items-center justify-center text-fg2">{open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>;
}

/**
 * design §6 Folder row: a section label you can tap. h52, Caps 11 (fg2 closed, white open) with a
 * Caps fg3 count, trailing total or MoreGlyph. Children indent 24 under it.
 */
export function FolderLabel({ label, count, open, note }: { label: ReactNode; count?: number; open: boolean; note?: ReactNode }) {
  return (
    <span className={cx('flex min-w-0 items-center gap-2 text-caps', open ? 'text-fg' : 'text-fg2')}>
      <span className="truncate">{label}</span>
      {count !== undefined && <span className="text-fg3">{count}</span>}
      {note && <span className="text-caption font-normal tracking-normal text-fg2 normal-case">{note}</span>}
    </span>
  );
}

/** design §6 Folder trailing menu: MoreGlyph 16 blue in a 44 target. */
export function FolderMenuButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="-mr-3 flex h-11 w-11 flex-none items-center justify-center text-accent active:opacity-60">
      <MoreGlyph size={16} />
    </button>
  );
}

/** design §6 Delete disc: Disc S in danger-fill with a white bar, in a 44 target, leading an edit row. */
export function DeleteDisc({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="-ml-2.5 flex h-11 w-11 flex-none items-center justify-center active:scale-95">
      <DiscFace size="s" tone="danger">
        <MinusGlyph size={12} />
      </DiscFace>
    </button>
  );
}

/** design §6 Handle: three bars in a 44 target, fg3. Spread the drag library's listeners onto it. */
export function DragHandle({ label, handleRef, className = '-mr-3', ...props }: { label: string; handleRef?: (el: HTMLElement | null) => void; className?: string } & Record<string, unknown>) {
  return (
    <button type="button" ref={handleRef} {...props} aria-label={label} className={cx('flex h-11 w-11 flex-none touch-none items-center justify-center', className)}>
      <Handle />
    </button>
  );
}

/**
 * design §6 Edit row: delete disc leading, Headline name, Handle trailing. h52. While lifted it
 * floats on surface with a 1.5 blue ring and the one allowed shadow.
 */
export function EditRow({ children, leading, trailing, lifted, className = '' }: { children: ReactNode; leading?: ReactNode; trailing?: ReactNode; lifted?: boolean; className?: string }) {
  return (
    <div className={cx('flex h-13 items-center gap-3 border-b border-line bg-bg', lifted && 'rounded-md border-transparent bg-surface px-3 shadow-[0_8px_20px_rgba(0,0,0,0.6)] ring-[1.5px] ring-accent', className)}>
      {leading}
      <span className="min-w-0 flex-1 truncate text-headline">{children}</span>
      {trailing}
    </div>
  );
}

/** design §6 Add row: h52, Disc S in action fill with PlusGlyph 12, 17/600 blue label. */
export function AddRow({ children, onClick, className = '' }: { children: ReactNode; onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cx('flex h-13 w-full items-center gap-3 border-b border-line text-left text-body-lg font-semibold text-accent active:opacity-60', className)}>
      <DiscFace size="s" tone="action">
        <PlusGlyph size={12} />
      </DiscFace>
      {children}
    </button>
  );
}
