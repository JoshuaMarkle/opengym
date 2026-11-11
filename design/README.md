# design/

Screens, the storyboard and brand assets are generated from the app, so they can't drift. The hand-written docs are `SPEC.md`, `ROADMAP.md`, the training logic, and `proposals/`: mockups of features not yet built, or still cited by code (Food). Built proposals are removed; find them in git history.

| Path | What | Made by |
| --- | --- | --- |
| `SPEC.md` | Rules, data model, design principles. Start here | Hand-written |
| `DESIGN.md` | The installed design system: tokens, type scale, glyphs, heights and radii, every shared component in `src/components/ui/` with its props, and the rules `npm run lint:design` checks | Hand-written |
| `ROADMAP.md` | Known bugs, friction points and what to build next, in priority order | Hand-written |
| `storyboard.html` | Every screen with its ID (0.1 … 10.32) and a caption. Open in a browser | `npm run screens` |
| `screens/<id>.png` | The screenshots, iPhone size at 2× | `npm run screens` |
| `brand/brand-board.png` | Logo, icon sizes, color tokens, tab icons, type | `npm run brand` |
| `brand/logos/` | Logo (square), app icon (rounded) and wordmark, dark and light | `npm run brand` |
| `brand/tabs/` | The five solid tab bar icons (`currentColor`) | Hand-made; match `src/components/icons.tsx` |
| `proposals/nutrition.html` | Food tab mockups (v5, built from the design system). Built: SPEC §14, screens 10.1–10.32 and 3.1. Day page with folding meals (A1–A4), week (A5), Home block (A6), food inspector (F1), setup (S1–S4), targets and diets (T1–T3), add food, amount and scan (C1–C3), saved meals (D4–D5). `nutrition.png` is a full-page screenshot | Hand-made mockup |
| `proposals/nutrition-plan.md` | Food tab implementation plan (built; §9 records how the build went): every feature, behavior decisions (days, meal windows, over-target rules, target math, logging flow, Open Food Facts and scanning), data model, build phases, decisions from review, and open questions. Covers full micronutrient tracking from a built-in USDA food database | Hand-written |
| `proposals/watch-sync-future.html` | Parked: watch workouts in History and plan export to the calendar, with what a PWA can and can't do. Not planned | Hand-made mockup |
| `proposals/exercise-popularity.html` | Not approved yet: a 0–10 popularity score for every built-in exercise. Popular-first Library and picker, hidden rare exercises, variation chips showing yours + the most popular with an All list (A1–B4), popularity in automatic focus lifts (C1), 52 new exercises (row and pulldown grips, forearms, lower back), the hidden list, variation groups, the full ranking and rules (D–H). `exercise-popularity.json` holds the scores for the seed | Generated from `proposals/exercise-popularity.py` |
| `training-logic.html` | Training spec, draft for tuning (revision 2): per-set fit zone and matching with 24 example sessions, effort target at setup, Suggest / Auto modes, gaps, exercise order (later), trends, missing and messy data, goal projection, milestones, tuning knobs, implementation map. Built in `src/lib/training/` (SPEC §13) | Generated from `training-logic-reference.py` |
| `training-logic-reference.py` | Reference implementation of the training rules (`decide_fit`, trends, projection). Ported to `src/lib/training/`; the doc's tables are its test fixtures (`decide.test.ts`) | Hand-written |

Change the app first, then regenerate. Screens: `scripts/screens.ts` holds the catalog (IDs, titles, captions) and the steps that reach each screen. Logo: edit `src/lib/logo.ts`, then `npm run brand` (it also rewrites `public/` icons).
