# OpenGym

Offline-first lifting log PWA (React + TypeScript + Vite + Dexie + Tailwind). No backend; all data is in IndexedDB on the phone.

## Read first
- `design/SPEC.md`: rules, data model, design principles. Code comments cite it as `SPEC §4`.
- `design/DESIGN.md`: tokens, type scale, sizes, glyphs and the component catalog. Component comments cite the design doc as `design §9`; `#/dev/ui` (screen 0.1, dev only) shows every component.
- `design/storyboard.html` + `design/screens/<id>.png`: every screen, captured from the app. Comments cite screen IDs like `4.1`.
- Food work: SPEC §14, then `design/proposals/nutrition-plan.md` (behavior, and §9 for what the build chose) and `design/proposals/nutrition.html` (board IDs like C1, D4).
- Training work (suggestions, trends, goals): `design/training-logic.html`. Comments cite it as `§9` or `training-logic §9`; it wins over `design/proposals/progressive-overload.html`.
- `design/ROADMAP.md`: known bugs, friction points and what to build next.

## Commands
- `npm run dev`: dev server at http://localhost:5173 with sample history in a separate test database. `npm run dev:real` uses the real one.
- `npm test`: Vitest (`src/**/*.test.ts`). `npm run typecheck`: `tsc -b` (app and scripts). `npm run lint:design`: checks `src/` against DESIGN.md (`-- --files` for a count per file). `npm run build`: typecheck + design lint + PWA build into `dist/`.
- `npm run screens [-- 4 2.1]`: re-screenshot screens into `design/` (needs Chromium/Chrome). Run after UI changes.
- `npm run brand`: regenerate logo SVGs, PWA icons and the brand board from `src/lib/logo.ts` and `src/index.css`.
- `npm run foods`: rebuild `public/foods/usda-<release>.json` from USDA FoodData Central CSVs (short names in `scripts/food-names.json`). Rarely needed; bump `USDA_RELEASE` in `src/data/foodDb.ts` with it.

## Layout
- `src/db/`: Dexie schema, types, built-in exercise library (`ex-<slug>` ids, `vg-…` variation groups).
- `src/lib/`: pure logic with tests (no React, no Dexie): 1RM, records, prefill, next-up, schedules, supersets, cardio, plates, effort, import parsing.
- `src/lib/nutrition/`: the nutrient catalog, DRI targets, energy and macro splits, food days and meals, totals and over/under rules, search ranking, label math, fill-in, Open Food Facts mapping.
- `src/lib/training/`: fit-zone suggestions, trends, goals, milestones, tips. A port of `design/training-logic-reference.py`; the doc's example sessions are the fixtures in `decide.test.ts`.
- `src/data/`: reads and writes (workouts, routines, exercises, schedule, history index, goals, training, food, backup/import, settings) and `DataProvider`. Food also has `foodDb.ts` (loads the USDA file into IndexedDB), `openFoodFacts.ts`, `barcode.ts` (decoder) and `useFood.ts` (hooks).
- `src/components/`: shared UI (`ui/`, one file per design family), overlays (Sheet, Alert, HoldMenu, Toast), Keypad, PlatePad, `useNumberPad` (keypad dock for forms), gestures, charts, icons.
- `src/screens/<area>/`: onboarding, home, plans, workout, history, progress, exercises, food, settings.
- `scripts/`: `screens.ts`, `brand.ts`, `foods.ts` / `usda.ts` (food database build) and a small headless-Chrome driver (`chrome.ts`). Plain Node, no build step.

## Rules
- Store weights in lb; convert at display. Assisted weights are negative; BW + added stores only the added weight.
- Every color comes from the CSS variables in `src/index.css`. Flat rows and hairlines, no cards or shadows.
- Tabular numbers wherever digits appear. Tap targets ≥ 44 px.
- Gestures (swipe, long-press) always have a visible alternative.
- Never lose logged data: persist the active workout on every change; confirm before destructive actions.
- Nothing from SPEC §1 "Out of scope".
- New pure logic goes in `src/lib/` with a Vitest test.
- Only the tab bar uses the solid icons. Only + − × W D ✕ and — are typed; everything else is a glyph from `icons.tsx`.
- UI: build from `src/components/ui/`; no arbitrary Tailwind values; read `design/DESIGN.md` first.
- New or changed screen: add its catalog entry and scene in `scripts/screens.ts`, re-run it, and cite its ID in comments.

## Gotchas
- Live queries lag a navigation by a frame. Screens opened right after a write (workout, summary) wait briefly via `useGiveUp` before deciding their record is missing.
- Toasts dock above anything marked `data-dock` (tab bar, keypad, pinned footers). A floating button marked `data-dock-side` shares the toast's row instead; the toast leaves room for it on the right.
- Routing is a `HashRouter`; in dev, `window.__og.db` is the Dexie instance and `window.__og.off = { search, products }` replaces Open Food Facts calls (the screens script uses it).
- Food entries keep a nutrient snapshot; never recompute a logged day from the food. Weights in Food settings are lb, height in inches. A food day runs 3 am to 3 am (`foodDayKey`).
- The USDA database loads on the first Food visit; screens that need it wait for `settings.food.usdaRelease` (see `foodReady` in `scripts/screens.ts`).
