import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

const svg = (size: number, props: SVGProps<SVGSVGElement>) => ({
  width: size,
  height: size,
  'aria-hidden': true,
  focusable: false,
  ...props,
});

// ── Tab bar: the solid set from design/brand/nav/solid (SPEC §8 Icons)
export function HomeIcon({ size = 24, ...p }: P) {
  return (
    <svg viewBox="0 0 24 24" {...svg(size, p)}>
      <path fill="currentColor" d="M12 2.8 21 10.3V20a1.2 1.2 0 0 1-1.2 1.2H14.6v-6.2H9.4v6.2H4.2A1.2 1.2 0 0 1 3 20v-9.7z" />
    </svg>
  );
}

export function PlansIcon({ size = 24, ...p }: P) {
  return (
    <svg viewBox="0 0 24 24" {...svg(size, p)}>
      <path
        fill="currentColor"
        d="M4.6 4h14.8a1.6 1.6 0 0 1 1.6 1.6v1a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 6.6v-1A1.6 1.6 0 0 1 4.6 4zm0 6h10.8a1.6 1.6 0 0 1 1.6 1.6v1a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 12.6v-1A1.6 1.6 0 0 1 4.6 10zm0 6h6.3a1.6 1.6 0 0 1 1.6 1.6v1a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 18.6v-1A1.6 1.6 0 0 1 4.6 16z"
      />
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

export function SearchIcon({ size = 15, ...p }: P) {
  return (
    <svg viewBox="0 0 13 13" {...svg(size, p)}>
      <circle cx="5.5" cy="5.5" r="4.3" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <line x1="8.6" y1="8.6" x2="12" y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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

export function ShareGlyph({ size = 16, ...p }: P) {
  return (
    <svg viewBox="0 0 16 20" {...svg(size, { height: (size * 20) / 16, ...p })}>
      <path d="M8 1.5v11M4.2 5.2 8 1.5l3.8 3.7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.2 8.2H3.2a1.6 1.6 0 0 0-1.6 1.6v7.2a1.6 1.6 0 0 0 1.6 1.6h9.6a1.6 1.6 0 0 0 1.6-1.6V9.8a1.6 1.6 0 0 0-1.6-1.6h-2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/** → on the keypad's Next button */
export function ArrowGlyph({ size = 14, ...p }: P) {
  return (
    <svg viewBox="0 0 14 14" {...svg(size, p)}>
      <path d="M2 7h9.5M7.6 3 11.6 7l-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PlusGlyph({ size = 14, ...p }: P) {
  return (
    <svg viewBox="0 0 14 14" {...svg(size, p)}>
      <path d="M7 1.5v11M1.5 7h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** ≡ drag handle */
export function Handle({ className = '' }: { className?: string }) {
  return (
    <span className={`flex flex-col gap-[3px] ${className}`} aria-hidden>
      <i className="block h-[2px] w-[14px] rounded-[1px] bg-fg3" />
      <i className="block h-[2px] w-[14px] rounded-[1px] bg-fg3" />
      <i className="block h-[2px] w-[14px] rounded-[1px] bg-fg3" />
    </span>
  );
}

/** The OpenGym mark: bar, collar, two 45s and a smaller plate. */
export function LogoMark({ size = 40, rounded = true }: { size?: number; rounded?: boolean }) {
  return (
    <svg viewBox="0 0 1024 1024" width={size} height={size} aria-label="OpenGym">
      <defs>
        <clipPath id="og-logo-clip">
          <rect width="1024" height="1024" rx={rounded ? 224 : 0} />
        </clipPath>
      </defs>
      <g clipPath="url(#og-logo-clip)">
        {/* Brand logo: dark or light version follows the theme (brand/logos/opengym-logo-{dark,light}.svg). */}
        <rect width="1024" height="1024" fill="var(--og-bg)" />
        <rect x="-60" y="480" width="830" height="64" rx="32" fill="var(--og-logo-bar)" />
        <rect x="174" y="435" width="38" height="154" rx="14" fill="var(--og-logo-bar)" />
        <rect x="234" y="202" width="156" height="620" rx="30" fill="#2E8BFF" />
        <rect x="408" y="202" width="156" height="620" rx="30" fill="#2E8BFF" />
        <rect x="582" y="312" width="132" height="400" rx="30" fill="#2E8BFF" />
      </g>
    </svg>
  );
}

/** "opengym." wordmark */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`tracking-[-0.03em] ${className}`}>
      <span className="font-normal text-fg2">open</span>
      <span className="font-extrabold text-fg">gym</span>
      <span className="font-extrabold text-accent">.</span>
    </span>
  );
}
