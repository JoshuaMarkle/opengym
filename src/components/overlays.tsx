import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from './ui';

const LAYER = 'fixed inset-0 mx-auto max-w-[520px]';

function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}

function useEscape(onClose: (() => void) | undefined, active: boolean) {
  useEffect(() => {
    if (!active || !onClose) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, active]);
}

/** Drag the grab area down to dismiss. */
function useDragDismiss(onClose: () => void) {
  const [dy, setDy] = useState(0);
  const start = useRef<{ y: number; id: number; captured: boolean } | null>(null);
  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      // Buttons in the header (✕, actions) must keep their own clicks.
      if ((e.target as HTMLElement).closest('button, a, input')) return;
      start.current = { y: e.clientY, id: e.pointerId, captured: false };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = start.current;
      if (!s) return;
      const d = Math.max(0, e.clientY - s.y);
      // Only capture once it's clearly a drag, so a tap stays a tap.
      if (!s.captured && d > 6) {
        (e.currentTarget as HTMLElement).setPointerCapture(s.id);
        s.captured = true;
      }
      if (s.captured) setDy(d);
    },
    onPointerUp: () => {
      if (!start.current) return;
      start.current = null;
      if (dy > 70) onClose();
      setDy(0);
    },
    onPointerCancel: () => {
      start.current = null;
      setDy(0);
    },
  };
  return { dy, handlers };
}

// ───────────────────────────── Sheet (options)

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  action,
  children,
  tall = false,
  short = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  tall?: boolean;
  /** Fixed at two thirds of the screen plus a line, so switching tabs inside doesn't resize it (4.8). */
  short?: boolean;
}) {
  useEscape(onClose, open);
  const { dy, handlers } = useDragDismiss(onClose);
  if (!open) return null;
  return (
    <Portal>
      <div className={cx(LAYER, 'z-40')}>
        <div className="anim-fade absolute inset-0 bg-[var(--og-scrim)]" onClick={onClose} />
        <div
          role="dialog"
          aria-modal="true"
          className={cx(
            'anim-sheet absolute inset-x-0 bottom-0 flex flex-col rounded-t-xl border-t border-line-strong bg-raised pb-safe',
            tall ? 'top-[calc(env(safe-area-inset-top)+56px)]' : short ? 'h-[calc(200%/3+24px)]' : 'max-h-[86%]',
          )}
          style={{ transform: dy ? `translateY(${dy}px)` : undefined, transition: dy ? 'none' : 'transform .2s' }}
        >
          <div className="flex-none touch-none pt-2 pb-1" {...handlers}>
            <div className="mx-auto h-1.25 w-9 rounded-full bg-line-strong" />
            {(title || action) && (
              <div className="mt-2.5 flex items-center justify-between gap-3 px-4">
                <h2 className="min-w-0 truncate text-title3">{title}</h2>
                {action}
              </div>
            )}
            {/* design §14: the subtitle sits directly under the title (mt 2), like a screen header's meta line. */}
            {subtitle && <p className="mt-0.5 px-4 text-footnote text-fg2">{subtitle}</p>}
          </div>
          {/* design §14 O2: an option list ends the sheet with no padding under it, only the safe area. */}
          <div className="scroll-y min-h-0 flex-1 px-4 pb-4 has-[>[data-sheet-option]:last-child]:pb-0">{children}</div>
        </div>
      </div>
    </Portal>
  );
}

/**
 * design §14 Sheet option: min-h 52, 17/400, detail Callout fg2, whole row pressable. Runs the
 * sheet's full width with a hairline above it, so a list has one above the first, one between
 * each, and none after the last.
 */
export function SheetOption({
  children,
  detail,
  onClick,
  tone,
  disabled,
}: {
  children: ReactNode;
  detail?: ReactNode;
  onClick?: () => void;
  tone?: 'danger' | 'accent';
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      data-sheet-option
      disabled={disabled}
      onClick={onClick}
      className={cx(
        '-mx-4 flex min-h-13 w-[calc(100%+2rem)] items-center justify-between gap-3 border-t border-line px-4 text-left text-body-lg active:opacity-60 disabled:opacity-40',
        tone === 'danger' && 'text-danger',
        tone === 'accent' && 'font-semibold text-accent',
      )}
    >
      <span className="min-w-0 truncate">{children}</span>
      {detail !== undefined && <span className="flex flex-none items-center gap-2 text-callout font-normal text-fg2">{detail}</span>}
    </button>
  );
}

// ───────────────────────────── Alert (only to confirm data loss)

export interface AlertAction {
  label: ReactNode;
  onClick: () => void;
  kind?: 'bold' | 'danger' | 'plain';
  disabled?: boolean;
}

/** Two short actions sit side by side (iOS does the same); anything longer stacks. */
const SIDE_BY_SIDE_MAX_CHARS = 12;

/**
 * iOS-style alert: centered, 270 wide, translucent, hairline-separated buttons.
 * Callers list the main action first and the way out (Cancel, Keep editing) last;
 * side by side that order flips, so the way out sits on the left like on iOS.
 */
export function Alert({
  open,
  title,
  message,
  actions,
  children,
  onClose,
}: {
  open: boolean;
  title: ReactNode;
  message?: ReactNode;
  actions: AlertAction[];
  children?: ReactNode;
  onClose?: () => void;
}) {
  useEscape(onClose, open);
  if (!open) return null;
  const row = actions.length === 2 && actions.every((a) => typeof a.label === 'string' && a.label.length <= SIDE_BY_SIDE_MAX_CHARS);
  const shown = row ? [...actions].reverse() : actions;
  return (
    <Portal>
      <div className={cx(LAYER, 'z-50 flex items-center justify-center px-6 pt-safe pb-safe')}>
        <div className="anim-fade absolute inset-0 bg-[var(--og-scrim)]" onClick={onClose} />
        <div
          role="alertdialog"
          aria-modal="true"
          className="anim-alert relative max-h-full w-67.5 overflow-y-auto rounded-lg bg-[color-mix(in_srgb,var(--og-surface-2)_92%,transparent)] text-center backdrop-blur-xl"
        >
          <div className="px-4 pt-5 pb-[18px]">
            <div className="text-body-lg leading-snug font-semibold">{title}</div>
            {message && <div className="mt-1 text-footnote text-fg">{message}</div>}
            {children}
          </div>
          <div className={cx('border-t border-line-strong', row && 'grid grid-cols-2')}>
            {shown.map((a, i) => (
              <button
                key={i}
                type="button"
                disabled={a.disabled}
                onClick={a.onClick}
                className={cx(
                  'flex min-h-11 w-full items-center justify-center px-3 py-2.5 text-body-lg leading-tight active:bg-key-fn disabled:opacity-40',
                  row ? i > 0 && 'border-l border-line-strong' : i > 0 && 'border-t border-line-strong',
                  a.kind === 'danger' ? 'text-danger' : 'text-accent',
                  a.kind === 'bold' && 'font-semibold',
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Portal>
  );
}

// ───────────────────────────── Hold menu

export interface MenuItem {
  label: ReactNode;
  glyph?: ReactNode;
  onClick: () => void;
  tone?: 'danger' | 'accent';
}

/**
 * Long-press menu (4.5, 2.8). The held row stays lit: the scrim is cut around
 * it and it gets an accent outline, so you can see what the menu acts on.
 */
export function HoldMenu({ open, anchor, items, onClose }: { open: boolean; anchor?: DOMRect | null; items: MenuItem[]; onClose: () => void }) {
  useEscape(onClose, open);
  if (!open) return null;
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const height = items.length * 46;
  // design §14 O3: the ring sits 4 px above and below the held row and 8 px at the sides.
  const a = anchor
    ? { top: anchor.top - 4, bottom: anchor.bottom + 4, left: Math.max(4, anchor.left - 8), right: Math.min(vw - 4, anchor.right + 8) }
    : { top: vh / 2, bottom: vh / 2, left: 0, right: vw };
  const below = a.bottom + 6;
  const top = below + height < vh - 24 ? below : Math.max(64, a.top - 6 - height);
  const scrim = 'absolute bg-[var(--og-scrim)] anim-fade';
  return (
    <Portal>
      <div className={cx(LAYER, 'z-40')} onClick={onClose}>
        {anchor ? (
          <>
            <div className={cx(scrim, 'inset-x-0 top-0')} style={{ height: Math.max(0, a.top) }} />
            <div className={cx(scrim, 'inset-x-0 bottom-0')} style={{ top: a.bottom }} />
            <div className={cx(scrim, 'left-0')} style={{ top: a.top, height: a.bottom - a.top, width: Math.max(0, a.left) }} />
            <div className={cx(scrim, 'right-0')} style={{ top: a.top, height: a.bottom - a.top, left: a.right }} />
            <div className="pointer-events-none absolute rounded-lg ring-[1.5px] ring-accent" style={{ top: a.top, left: a.left, width: a.right - a.left, height: a.bottom - a.top }} />
          </>
        ) : (
          <div className={cx(scrim, 'inset-0')} />
        )}
        <div role="menu" className="anim-pop absolute right-4 left-4 overflow-hidden rounded-lg border border-line-strong bg-surface-2" style={{ top }} onClick={(e) => e.stopPropagation()}>
          {items.map((it, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              onClick={() => {
                onClose();
                it.onClick();
              }}
              className={cx(
                'flex h-11.5 w-full items-center justify-between border-b border-line-strong px-4 text-left text-input last:border-b-0 active:bg-key-fn',
                it.tone === 'danger' && 'text-danger',
                it.tone === 'accent' && 'font-semibold text-accent',
              )}
            >
              <span>{it.label}</span>
              {it.glyph && <span className={cx('flex items-center text-callout', it.tone === 'accent' ? 'text-accent' : 'text-fg2')}>{it.glyph}</span>}
            </button>
          ))}
        </div>
      </div>
    </Portal>
  );
}

// ───────────────────────────── Full-screen modal (picker, all exercises, forms)

export function FullScreen({ open, children, z = 'z-30' }: { open: boolean; children: ReactNode; z?: string }) {
  if (!open) return null;
  return (
    <Portal>
      <div className={cx(LAYER, z, 'anim-sheet flex flex-col bg-bg pt-safe')}>{children}</div>
    </Portal>
  );
}

// ───────────────────────────── Toast with Undo

interface ToastData {
  id: number;
  message: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  /** No outline: the workout's exercise view (4.4) floats its Undo toasts beside the borderless keyboard button. */
  borderless?: boolean;
}

const ToastContext = createContext<(t: Omit<ToastData, 'id'> & { duration?: number }) => void>(() => {});

/** Distance from the bottom of the screen to the top of whatever is docked there (tab bar, keypad, footer). */
function dockedHeight(): number {
  let h = 0;
  for (const el of document.querySelectorAll<HTMLElement>('[data-dock]')) {
    const r = el.getBoundingClientRect();
    if (r.height > 0) h = Math.max(h, window.innerHeight - r.top);
  }
  return h;
}

/**
 * A floating button marked `data-dock-side` (the workout's keyboard button) shares the
 * toast's row: the toast lines up with it and stops short of it instead of moving up.
 */
function dockedSide(): DOMRect | undefined {
  for (const el of document.querySelectorAll<HTMLElement>('[data-dock-side]')) {
    const r = el.getBoundingClientRect();
    if (r.height > 0) return r;
  }
  return undefined;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const [place, setPlace] = useState<{ bottom: number; right?: number }>({ bottom: 0 });
  const box = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  // Sit just above the tab bar / keypad / pinned buttons, and follow them if they change.
  useEffect(() => {
    if (!toast) return;
    const measure = () => {
      const side = dockedSide();
      const edge = box.current?.getBoundingClientRect().right;
      const next = side && edge != null ? { bottom: window.innerHeight - side.bottom - 10, right: Math.max(12, edge - side.left + 10) } : { bottom: dockedHeight() };
      setPlace((p) => (p.bottom === next.bottom && p.right === next.right ? p : next));
    };
    measure();
    const t = window.setInterval(measure, 120);
    return () => window.clearInterval(t);
  }, [toast]);
  const show = useCallback((t: Omit<ToastData, 'id'> & { duration?: number }) => {
    window.clearTimeout(timer.current);
    const id = Date.now();
    setToast({ ...t, id });
    timer.current = window.setTimeout(() => setToast((cur) => (cur?.id === id ? null : cur)), t.duration ?? 5000);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <Portal>
          <div
            ref={box}
            className="pointer-events-none fixed inset-x-0 z-[35] mx-auto max-w-[520px] px-3 transition-[bottom] duration-150"
            style={{ bottom: place.bottom > 0 ? place.bottom + 10 : 'calc(env(safe-area-inset-bottom) + 16px)', paddingRight: place.right }}
          >
            <div
              key={toast.id}
              role="status"
              className={cx(
                'anim-toast pointer-events-auto flex h-12 items-center justify-between rounded-lg bg-surface-2 pr-1 pl-4 text-body',
                !toast.borderless && 'border border-line-strong',
              )}
            >
              <span className="truncate">{toast.message}</span>
              {toast.actionLabel && (
                <button
                  type="button"
                  className="h-11 px-3 font-bold text-accent active:opacity-60"
                  onClick={() => {
                    toast.onAction?.();
                    setToast(null);
                  }}
                >
                  {toast.actionLabel}
                </button>
              )}
            </div>
          </div>
        </Portal>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
