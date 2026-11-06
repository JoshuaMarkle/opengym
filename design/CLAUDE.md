# OpenGym

Offline-first lifting log PWA (React + TypeScript + Vite + Dexie + Tailwind). No backend.

## Read first
- `design/SPEC.md`: decisions, data model, rules, build order. It wins over everything else.
- `design/storyboards/complete.html`: every screen, with IDs like 4.1. Match its layout, copy and states.
- Ignore `design/storyboards/v1`–`v8` unless asked; they're superseded.

## Rules
- Build in the phase order from SPEC §7. Finish a phase so it's usable on a phone before starting the next.
- Store weights in lb internally; convert at display.
- Dark theme first; every color comes from the CSS variables in SPEC §8. Flat rows and hairlines, no cards or shadows.
- Use tabular numbers everywhere digits appear. Tap targets are at least 44 px.
- Gestures (swipe, long-press) must always have a visible alternative.
- Never lose logged data: persist the active workout on every change; confirm before any destructive action.
- Don't add anything listed under "Out of scope for v1" in SPEC §1.
- Put pure logic (1RM, records, next-up, prefill, import parsing) in `src/lib/` with Vitest tests.

## Commands
(fill in once scaffolded: `npm run dev`, `npm run build`, `npm test`)
