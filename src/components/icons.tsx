import type { SVGProps } from 'react';
import { LOGO_COLORS, LOGO_RECTS } from '../lib/logo';

type P = SVGProps<SVGSVGElement> & { size?: number };

const svg = (size: number, props: SVGProps<SVGSVGElement>) => ({
  width: size,
  height: size,
  'aria-hidden': true,
  focusable: false,
  ...props,
});

// ── Tab bar: the solid set in design/brand/tabs (SPEC §8 Icons)
export function HomeIcon({ size = 24, ...p }: P) {
  return (
    <svg viewBox="0 0 24 24" {...svg(size, p)}>
      <path fill="currentColor" d="M12 2.8 21 10.3V20a1.2 1.2 0 0 1-1.2 1.2H14.6v-6.2H9.4v6.2H4.2A1.2 1.2 0 0 1 3 20v-9.7z" />
    </svg>
  );
}

export function HistoryIcon({ size = 24, ...p }: P) {
  return (
    <svg viewBox="0 0 24 24" {...svg(size, p)}>
      <path
        fill="currentColor"
        d="M5 4h14a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM4.2 11h2.6A1.2 1.2 0 0 1 8 12.2v1.6A1.2 1.2 0 0 1 6.8 15H4.2A1.2 1.2 0 0 1 3 13.8v-1.6A1.2 1.2 0 0 1 4.2 11zm0 5.2h2.6A1.2 1.2 0 0 1 8 17.4V19a1.2 1.2 0 0 1-1.2 1.2H4.2A1.2 1.2 0 0 1 3 19v-1.6a1.2 1.2 0 0 1 1.2-1.2zm6.5-5.2h2.6a1.2 1.2 0 0 1 1.2 1.2v1.6a1.2 1.2 0 0 1-1.2 1.2h-2.6a1.2 1.2 0 0 1-1.2-1.2v-1.6a1.2 1.2 0 0 1 1.2-1.2zm0 5.2h2.6a1.2 1.2 0 0 1 1.2 1.2V19a1.2 1.2 0 0 1-1.2 1.2h-2.6A1.2 1.2 0 0 1 9.5 19v-1.6a1.2 1.2 0 0 1 1.2-1.2zm6.5-5.2h2.6a1.2 1.2 0 0 1 1.2 1.2v1.6a1.2 1.2 0 0 1-1.2 1.2h-2.6a1.2 1.2 0 0 1-1.2-1.2v-1.6a1.2 1.2 0 0 1 1.2-1.2zm0 5.2h2.6a1.2 1.2 0 0 1 1.2 1.2V19a1.2 1.2 0 0 1-1.2 1.2h-2.6A1.2 1.2 0 0 1 16 19v-1.6a1.2 1.2 0 0 1 1.2-1.2z"
      />
    </svg>
  );
}

export function ProgressIcon({ size = 24, ...p }: P) {
  return (
    <svg viewBox="0 0 24 24" {...svg(size, p)}>
      <path
        fill="currentColor"
        d="M4.7 14h2.1A1.2 1.2 0 0 1 8 15.2v4.6A1.2 1.2 0 0 1 6.8 21H4.7a1.2 1.2 0 0 1-1.2-1.2v-4.6A1.2 1.2 0 0 1 4.7 14zm6.25-4.5h2.1a1.2 1.2 0 0 1 1.2 1.2v9.1a1.2 1.2 0 0 1-1.2 1.2h-2.1a1.2 1.2 0 0 1-1.2-1.2v-9.1a1.2 1.2 0 0 1 1.2-1.2zM17.2 4h2.1a1.2 1.2 0 0 1 1.2 1.2v14.6a1.2 1.2 0 0 1-1.2 1.2h-2.1a1.2 1.2 0 0 1-1.2-1.2V5.2A1.2 1.2 0 0 1 17.2 4z"
      />
    </svg>
  );
}

export function SettingsIcon({ size = 24, ...p }: P) {
  return (
    <svg viewBox="0 0 24 24" {...svg(size, p)}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M19.42 10.34 21.92 10.7v2.6l-2.5.36-1 2.41 1.51 2.02-1.84 1.84-2.02-1.51-2.41 1-.36 2.5h-2.6l-.36-2.5-2.41-1-2.02 1.51-1.84-1.84 1.51-2.02-1-2.41-2.5-.36v-2.6l2.5-.36 1-2.41-1.51-2.02 1.84-1.84 2.02 1.51 2.41-1 .36-2.5h2.6l.36 2.5 2.41 1 2.02-1.51 1.84 1.84-1.51 2.02zM8.8 12a3.2 3.2 0 1 0 6.4 0 3.2 3.2 0 1 0-6.4 0z"
      />
    </svg>
  );
}

// ── In-app glyphs (storyboard style: thin, quiet)
export function ChartIcon({ size = 16, ...p }: P) {
  return (
    <svg viewBox="0 0 16 12" {...svg(size, { height: (size * 12) / 16, ...p })}>
      <polyline points="1,10 5,6 8,8 14,2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CalendarIcon({ size = 15, ...p }: P) {
  return (
    <svg viewBox="0 0 14 14" {...svg(size, p)}>
      <rect x="1" y="2" width="12" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="1" y1="5.5" x2="13" y2="5.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function ListIcon({ size = 15, ...p }: P) {
  return (
    <svg viewBox="0 0 14 14" {...svg(size, p)}>
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <line x1="2" y1="3" x2="12" y2="3" />
        <line x1="2" y1="7" x2="12" y2="7" />
        <line x1="2" y1="11" x2="12" y2="11" />
      </g>
    </svg>
  );
}

export function ChevronLeft({ size = 12, ...p }: P) {
  return (
    <svg viewBox="0 0 10 16" {...svg(size, { width: (size * 10) / 16, ...p })}>
      <path d="M8.5 1.5 2 8l6.5 6.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronRight({ size = 12, ...p }: P) {
  return (
    <svg viewBox="0 0 10 16" {...svg(size, { width: (size * 10) / 16, ...p })}>
      <path d="M1.5 1.5 8 8l-6.5 6.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronDown({ size = 12, ...p }: P) {
  return (
    <svg viewBox="0 0 16 10" {...svg(size, { height: (size * 10) / 16, ...p })}>
      <path d="M1.5 1.5 8 8l6.5-6.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CloseIcon({ size = 12, ...p }: P) {
  return (
    <svg viewBox="0 0 12 12" {...svg(size, p)}>
      <path d="M2 2l8 8M10 2 2 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function BackspaceIcon({ size = 26, ...p }: P) {
  return (
    <svg viewBox="0 0 26 18" {...svg(size, { height: (size * 18) / 26, ...p })}>
      <path d="M8 1h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H8L1 9z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 5.5l7 7M19 5.5l-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function PlayGlyph({ size = 12, ...p }: P) {
  return (
    <svg viewBox="0 0 10 12" {...svg(size, p)}>
      <path d="M1.2 1.1v9.8a.6.6 0 0 0 .9.5l7.6-4.9a.6.6 0 0 0 0-1L2.1.6a.6.6 0 0 0-.9.5z" fill="currentColor" />
    </svg>
  );
}

export function CheckGlyph({ size = 14, ...p }: P) {
  return (
    <svg viewBox="0 0 14 14" {...svg(size, p)}>
      <path d="M2.5 7.4 5.6 10.4 11.6 3.6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Pencil left of Finish in the workout header: opens the workout options (4.1, 5.4). */
export function PencilGlyph({ size = 16, ...p }: P) {
  return (
    <svg viewBox="0 0 16 16" {...svg(size, p)}>
      <path d="M10.6 2.4a1.6 1.6 0 0 1 2.3 0l.7.7a1.6 1.6 0 0 1 0 2.3L5.4 13.6l-3.4.8.8-3.4z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9.2 3.8l3 3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/** Orange warning triangle for "not enough data" notes (7.1). */
export function WarnGlyph({ size = 14, ...p }: P) {
  return (
    <svg viewBox="0 0 16 16" {...svg(size, p)}>
      <path d="M8 1.6 15 14H1L8 1.6z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 6.2v3.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="8" cy="11.9" r="0.95" fill="currentColor" />
    </svg>
  );
}

export function ShareGlyph({ size = 16, ...p }: P) {
  return (
    <svg viewBox="0 0 16 20" {...svg(size, { height: (size * 20) / 16, ...p })}>
      <path d="M8 1.5v11M4.2 5.2 8 1.5l3.8 3.7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.2 8.2H3.2a1.6 1.6 0 0 0-1.6 1.6v7.2a1.6 1.6 0 0 0 1.6 1.6h9.6a1.6 1.6 0 0 0 1.6-1.6V9.8a1.6 1.6 0 0 0-1.6-1.6h-2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/** Keyboard on the floating "open the keypad" button (4.1). */
export function KeyboardGlyph({ size = 20, ...p }: P) {
  return (
    <svg viewBox="0 0 20 14" {...svg(size, { height: (size * 14) / 20, ...p })}>
      <rect x="1" y="1" width="18" height="12" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <g fill="currentColor">
        <rect x="4" y="4" width="2" height="2" rx="0.5" />
        <rect x="7.33" y="4" width="2" height="2" rx="0.5" />
        <rect x="10.67" y="4" width="2" height="2" rx="0.5" />
        <rect x="14" y="4" width="2" height="2" rx="0.5" />
        <rect x="6" y="9" width="8" height="1.8" rx="0.6" />
      </g>
    </svg>
  );
}

/** Drag handle: three bars 14 × 2, gap 3, fg3 (design §6). */
export function Handle({ size = 14, ...p }: P) {
  return (
    <svg viewBox="0 0 14 12" {...svg(size, { height: (size * 12) / 14, className: 'text-fg3', ...p })}>
      <g fill="currentColor">
        <rect x="0" y="0" width="14" height="2" rx="1" />
        <rect x="0" y="5" width="14" height="2" rx="1" />
        <rect x="0" y="10" width="14" height="2" rx="1" />
      </g>
    </svg>
  );
}

/** ••• in bordered buttons and menus, 16 wide (design §3). */
export function MoreGlyph({ size = 16, ...p }: P) {
  return (
    <svg viewBox="0 0 16 4" {...svg(size, { height: (size * 4) / 16, ...p })}>
      <g fill="currentColor">
        <circle cx="2" cy="2" r="1.7" />
        <circle cx="8" cy="2" r="1.7" />
        <circle cx="14" cy="2" r="1.7" />
      </g>
    </svg>
  );
}

/** Up / down triangle before a trend number or word, 9–10 px (design §3). */
export function TrendUp({ size = 9, ...p }: P) {
  return (
    <svg viewBox="0 0 10 9" {...svg(size, { height: (size * 9) / 10, ...p })}>
      <path d="M5 .6 9.6 8.4H.4z" fill="currentColor" strokeLinejoin="round" />
    </svg>
  );
}

export function TrendDown({ size = 9, ...p }: P) {
  return (
    <svg viewBox="0 0 10 9" {...svg(size, { height: (size * 9) / 10, ...p })}>
      <path d="M5 8.4 9.6.6H.4z" fill="currentColor" strokeLinejoin="round" />
    </svg>
  );
}

/** + inside discs, steppers and add rows, 12–14 px. */
export function PlusGlyph({ size = 12, ...p }: P) {
  return (
    <svg viewBox="0 0 12 12" {...svg(size, p)}>
      <path d="M6 1.2v9.6M1.2 6h9.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** − inside steppers and the delete disc, 12–14 px. */
export function MinusGlyph({ size = 12, ...p }: P) {
  return (
    <svg viewBox="0 0 12 12" {...svg(size, p)}>
      <path d="M1.2 6h9.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** → between Previous and Next, on the Next key and moved days, 10 px. Drawn so it centers. */
export function ArrowGlyph({ size = 10, ...p }: P) {
  return (
    <svg viewBox="0 0 12 10" {...svg(size, { height: (size * 10) / 12, ...p })}>
      <path d="M1 5h9.4M6.8 1.2 10.6 5l-3.8 3.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Magnifier in search fields, 14 px. */
export function SearchGlyph({ size = 14, ...p }: P) {
  return (
    <svg viewBox="0 0 13 13" {...svg(size, p)}>
      <circle cx="5.5" cy="5.5" r="4.3" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <line x1="8.6" y1="8.6" x2="12" y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** A target: the goals empty states (was a typed ◎). */
export function TargetGlyph({ size = 22, ...p }: P) {
  return (
    <svg viewBox="0 0 22 22" {...svg(size, p)}>
      <circle cx="11" cy="11" r="9" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <circle cx="11" cy="11" r="4.5" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <circle cx="11" cy="11" r="1.4" fill="currentColor" />
    </svg>
  );
}

/** Routines view toggle in the Calendar tab (PH3.5), 18 px. */
export function ClipboardIcon({ size = 18, ...p }: P) {
  return (
    <svg viewBox="0 0 24 24" {...svg(size, p)}>
      <g fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M8 5H5v16h14V5h-3M8 11h8M8 15h8" />
        <rect x="8" y="3" width="8" height="4" rx="1" />
      </g>
    </svg>
  );
}

/** The OpenGym logo (src/lib/logo.ts). Bar and background follow the theme. */
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 1024 1024" width={size} height={size} aria-label="OpenGym">
      <defs>
        <clipPath id="og-logo-clip">
          <rect width="1024" height="1024" rx="224" />
        </clipPath>
      </defs>
      <g clipPath="url(#og-logo-clip)">
        <rect width="1024" height="1024" fill="var(--og-bg)" />
        {LOGO_RECTS.map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx={r.r} fill={r.part === 'plate' ? LOGO_COLORS.plate : 'var(--og-logo-bar)'} />
        ))}
      </g>
    </svg>
  );
}
