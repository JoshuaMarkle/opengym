import { useRef, useState, type ReactNode } from 'react';
import { cx } from './ui';

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE = 8;
const SWIPE_TRIGGER = 84;

/**
 * Press-and-hold (pointer events, no gesture lib). Moving cancels it. After a
 * hold fires, the click that follows is swallowed.
 */
export function useLongPress(onLongPress: (rect: DOMRect) => void, enabled = true) {
  const timer = useRef<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const cancel = () => {
    window.clearTimeout(timer.current);
    start.current = null;
  };
  if (!enabled) return {};
  return {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      const el = e.currentTarget;
      timer.current = window.setTimeout(() => {
        fired.current = true;
        start.current = null;
        onLongPress(el.getBoundingClientRect());
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!start.current) return;
      if (Math.abs(e.clientX - start.current.x) > MOVE_TOLERANCE || Math.abs(e.clientY - start.current.y) > MOVE_TOLERANCE) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onClickCapture: (e: React.MouseEvent) => {
      if (fired.current) {
        e.stopPropagation();
        e.preventDefault();
        fired.current = false;
      }
    },
  };
}

/**
 * A row you can swipe: right → `right` action (e.g. warm-up), left → `left`
 * action (e.g. delete). Holding opens `onLongPress`. Gestures are shortcuts
 * only; every action here must also exist in a visible menu.
 */
export function SwipeRow({
  children,
  left,
  right,
  onLongPress,
  className = '',
  disabled = false,
}: {
  children: ReactNode;
  left?: { label: ReactNode; onTrigger: () => void };
  right?: { label: ReactNode; onTrigger: () => void };
  onLongPress?: (rect: DOMRect) => void;
  className?: string;
  disabled?: boolean;
}) {
  const [dx, setDx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const st = useRef<{ x: number; y: number; mode: 'none' | 'h' | 'v'; id: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const suppressClick = useRef(false);
  const elRef = useRef<HTMLDivElement>(null);

  const reset = () => {
    setAnimating(true);
    setDx(0);
    window.setTimeout(() => setAnimating(false), 200);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return;
    suppressClick.current = false;
    st.current = { x: e.clientX, y: e.clientY, mode: 'none', id: e.pointerId };
    if (onLongPress) {
      timer.current = window.setTimeout(() => {
        if (st.current?.mode !== 'none') return;
        suppressClick.current = true;
        st.current = null;
        onLongPress(elRef.current!.getBoundingClientRect());
      }, LONG_PRESS_MS);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = st.current;
    if (!s) return;
    const mx = e.clientX - s.x;
    const my = e.clientY - s.y;
    if (s.mode === 'none') {
      if (Math.abs(mx) > MOVE_TOLERANCE && Math.abs(mx) > Math.abs(my) * 1.2) {
        s.mode = 'h';
        window.clearTimeout(timer.current);
        try {
          e.currentTarget.setPointerCapture(s.id);
        } catch {
          /* ignore */
        }
      } else if (Math.abs(my) > MOVE_TOLERANCE) {
        s.mode = 'v';
        window.clearTimeout(timer.current);
      }
    }
    if (s.mode === 'h') {
      let x = mx;
      if (x > 0 && !right) x = 0;
      if (x < 0 && !left) x = 0;
      // Rubber band past the trigger point.
      const lim = 140;
      if (Math.abs(x) > lim) x = Math.sign(x) * (lim + (Math.abs(x) - lim) * 0.25);
      setDx(x);
    }
  };

  const onPointerUp = () => {
    window.clearTimeout(timer.current);
    const s = st.current;
    st.current = null;
    if (!s || s.mode !== 'h') return;
    suppressClick.current = true;
    if (dx >= SWIPE_TRIGGER && right) {
      reset();
      right.onTrigger();
    } else if (dx <= -SWIPE_TRIGGER && left) {
      setAnimating(true);
      setDx(-(elRef.current?.offsetWidth ?? 400));
      window.setTimeout(() => {
        left.onTrigger();
        setDx(0);
        setAnimating(false);
      }, 160);
    } else reset();
  };

  const onPointerCancel = () => {
    window.clearTimeout(timer.current);
    st.current = null;
    if (dx !== 0) reset();
  };

  const armed = Math.abs(dx) >= SWIPE_TRIGGER;

  return (
    <div ref={elRef} className={cx('relative overflow-hidden rounded-[9px]', className)}>
      {dx > 0 && right && (
        <div className={cx('absolute inset-0 flex items-center pl-4 text-[14px] font-bold text-white transition-colors', armed ? 'bg-[#4a4a4a]' : 'bg-[#2e2e2e]')}>
          {right.label}
        </div>
      )}
      {dx < 0 && left && (
        <div className={cx('absolute inset-0 flex items-center justify-end pr-5 text-[14px] font-bold text-white transition-colors', armed ? 'bg-danger' : 'bg-danger/70')}>
          {left.label}
        </div>
      )}
      <div
        className={cx('no-select relative touch-pan-y bg-bg', animating && 'transition-transform duration-200')}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(e) => e.preventDefault()}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            e.stopPropagation();
            e.preventDefault();
            suppressClick.current = false;
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
