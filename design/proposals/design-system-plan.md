# Design system: install plan

How `design/proposals/design-system-changes.md` gets carried out, phase by phase. One commit per phase. `npm run typecheck`, `npm test` and `npm run build` pass after each phase. This is a visual refactor: no behaviour, data, gesture, persistence or routing changes.

Census at the start (commit `942762d`): 582 `text-[…]`, 85 `rounded-[…]`, 96 `tracking-[…]`, 142 `h-[…]` / `min-h-[…]`, 9 hex literals in `.tsx/.ts` (outside `logo.ts`), and typed symbols in about 40 files. Named Tailwind radii appear only twice (`rounded-lg` in BarButton, `rounded-2xl` in EmptyState), so the radius scale can be redefined safely once those two move.

## Phase 0: machine-readable design

- `design/DESIGN.md`: tokens, type scale, heights, radii, component catalog (name · file · use · main props), rules from §13 and §17. Under 400 lines.
- `src/index.css` `@theme`: type scale as `--text-*` with line height, weight and tracking (`text-hero` … `text-micro`), radii `--radius-xs/sm/md/lg/xl`. `text-caps` also gets `uppercase` through a components-layer rule, so `normal-case` can still undo it (chart axes use 11/400 without caps). The palette waits for Phase 1.
- `scripts/lint-design.ts` (`npm run lint:design`): arbitrary `text-[…]`, `rounded-[…]`, `tracking-[…]`; `h-[…]` / `min-h-[…]` not on the §4 list; hex colors outside `index.css` and `lib/logo.ts`; typed ✓ → ▲ ▼ › ‹ ••• ▶ ≡ ▾ ⌄ ◎ in code (comments stripped); `rounded-full` discs whose size isn't 24 or 34. Allowlist entries carry a reason. Not wired into `build` until the end of Phase 3.
- Gallery: `#/dev/ui` (dev only, lazy-loaded so it stays out of the production bundle), screen 0.1 in `scripts/screens.ts`. Starts with today's `ui.tsx`; grows with Phase 2.
- Files: `design/DESIGN.md`, `src/index.css`, `scripts/lint-design.ts`, `package.json`, `src/App.tsx`, `src/screens/dev/Gallery.tsx`, `scripts/screens.ts`, `src/components/ui.tsx` (`rounded-lg` → `rounded-sm`). CLAUDE.md waits for Phase 4, when its rules are true of the code.

## Phase 1: tokens

- `src/index.css`: T1–T9. Add `--og-accent`, `--og-action`, `--og-action-pressed`, `--og-danger-fill`, `--og-cyan`, `--og-gold`, `--og-disabled`, `--og-swipe`, `--og-swipe-armed`, and derive `done`, `edit`, `effort`, `effort-glow`, `accent-soft`, `success-soft`, `danger-soft` from the variables. Light theme gets matching values.
- T7 / T8 / C1: replace the hex literals in `charts.tsx`, `workout/Ring.tsx`, `Home.tsx`, `gestures.tsx` and the `:focus-visible` rule. `DataProvider.tsx` keeps its two `theme-color` meta values (a browser API string, not a UI color); allowlisted. `lib/logo.ts` plate color moves to #007AFF.
- Files: `src/index.css`, `charts.tsx`, `gestures.tsx`, `workout/Ring.tsx`, `home/Home.tsx`, `lib/logo.ts`, `TabLayout.tsx` (resume bar).

## Phase 2: one component library

`src/components/ui.tsx` becomes `src/components/ui/{headers,rows,tables,progress,buttons,controls,notices,calendar,layout}.tsx` + `index.ts`. Export names stay; imports change from `components/ui` to `components/ui/index` only by path (`../../components/ui` keeps resolving to the folder index, so most imports don't change at all). Each component: token classes only, a `// design §N Name` comment, a gallery entry with its variants. Inline copies named in the change list move onto the shared component and are deleted. Keypad / PlatePad / overlays / icons get the §13, §14 and glyph changes.

Files: everything under `src/components/`, plus the screens that held the copies (Plans, ScheduleEditor, ExerciseFormView, ExercisePicker, AllExercises, EditWorkout, RoutineBuilder, Training, LookbackSheet, Effort, Welcome, Home, PlanParts, PlanHistoryCalendar, Goals, LiftViews, RoutineScreen, WorkoutScreen, TabLayout, Keypad, PlatePad).

## Phase 3: sweep the screens

S1–S12, file by file, with `npm run lint:design` as the to-do list. Most of S1–S3 is mechanical (px → token); a scratch codemod does the unambiguous ones and the rest is by hand. At the end, `lint:design` runs inside `npm run build`.

## Phase 4: docs and screenshots

`npm run screens`, `npm run brand`; compare 0.1, 4.1, 4.16, 4.27, 3.2, 6.1, 7.16, 8.2 against the doc and fix; SPEC §8 points at `DESIGN.md`; CLAUDE.md rules; README marks the doc installed; §16 items marked done.

## Where the change list and the code disagree

- **ExerciseFormView:131 / 150** are tick discs (a typed ✓ in a 24 px disc, grey or blue), not add rows. They become `Disc s` with `CheckGlyph`, which is what the Disc table asks for anyway.
- **Disc S tones:** the doc's ExerciseFormView discs are "selected / not selected" marks, closer to `Check` than an add disc. Kept as `Disc s` (tone action / grey) so the size rule holds.
- **WorkoutScreen NavButton** is at ~1390 as stated; `WorkoutBar` lines ~615–655 hold (`header` at 618).
- **`text-input` weight:** T10 gives no weight; the doc says 600 for values, 400 for text. The token sets no weight, and set cells keep their explicit `font-semibold`, so text fields don't turn bold.
- **`text-caps` and chart axes:** the doc's axes are 11/400 without caps, but 11 px only exists as Caps. Axes use `text-caps normal-case font-normal tracking-normal` rather than a thirteenth size.
- **Bare 11 px non-caps text** (e.g. previous effort "2 RIR" under the Previous column, §7) is handled the same way.
- **Lint scope for `h-[…]`:** the change list only covers arbitrary heights. Spacing-scale heights such as `h-14` (56) aren't linted; rows at 56 are fixed by hand in Phase 3.
- **Typed `→` in `lib/routineDiff.ts`** builds sentences for the "Update the routine?" alert (5.2). It's prose inside a string, and an alert message can't hold a glyph without changing the alert API. Allowlisted as prose.
- **Typed `→` in ImportScreen's "Settings → Export"** is a menu path in prose, same treatment.

## Not done

(Filled in as phases land: anything that would need a behaviour change.)
