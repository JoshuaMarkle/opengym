# OpenGym

Offline-first lifting log PWA (React + TypeScript + Vite + Dexie + Tailwind). No backend.

## Read first
- `design/SPEC.md`: decisions, data model, rules, build order. It wins over everything else.
- `design/storyboards/complete.html`: every screen, with IDs like 4.1. Match its layout, copy and states.
- Ignore `design/storyboards/v1`–`v8` unless asked; they're superseded.

## Rules
- Store weights in lb internally; convert at display.
- Dark theme first; every color comes from the CSS variables in `src/index.css` (SPEC §8). Flat rows and hairlines, no cards or shadows.
- Use tabular numbers everywhere digits appear. Tap targets are at least 44 px.
- Gestures (swipe, long-press) must always have a visible alternative.
- Never lose logged data: persist the active workout on every change; confirm before any destructive action.
- Don't add anything listed under "Out of scope for v1" in SPEC §1.
- Put pure logic (1RM, records, next-up, prefill, import parsing) in `src/lib/` with Vitest tests.
- Icons: only the tab bar uses the solid nav icons (`design/brand/nav/solid`). In-app controls keep the storyboard glyphs (▶ + ✓ ••• ≡ W/D).

## Commands
- `npm run dev`: dev server (http://localhost:5173). In dev, `window.__og.db` exposes the Dexie database.
- `npm run build`: type-check, then build the PWA into `dist/`.
- `npm run preview`: serve the built `dist/` locally.
- `npm test`: run the Vitest unit tests (`src/**/*.test.ts`).
- `npm run typecheck`: `tsc -b` only.

## Layout
- `src/db/`: Dexie schema, types, built-in exercise library (`ex-<slug>` ids, `vg-…` variation groups).
- `src/lib/`: pure logic plus tests (no React, no Dexie).
- `src/data/`: reads and writes (workouts, routines, exercises, history index, backup/import, settings) and `DataProvider`.
- `src/components/`: shared UI (`ui.tsx`), overlays (Sheet, Alert, HoldMenu, Toast), Keypad, gestures, charts, icons.
- `src/screens/<area>/`: one folder per storyboard section (onboarding, home, plans, workout, history, progress, exercises, settings).
- Routing is a HashRouter so the build works from any static host or sub-path.

## Gotchas
- Live queries lag a navigation by a frame. Screens that open right after a write (workout, summary) wait briefly via `useGiveUp` before deciding their record is missing.
- Toasts dock above anything marked `data-dock` (tab bar, keypad, pinned footers).
- Assisted weights are stored negative; bodyweight + added stores only the added weight.
