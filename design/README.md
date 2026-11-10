# design/

Screens, the storyboard and brand assets are generated from the app, so they can't drift. The hand-written docs are `SPEC.md`, `ROADMAP.md`, the training logic, and `proposals/`: mockups of features, kept as the design intent (built ones point at their screens).

| Path | What | Made by |
| --- | --- | --- |
| `SPEC.md` | Rules, data model, design principles. Start here | Hand-written |
| `ROADMAP.md` | Known bugs, friction points and what to build next, in priority order | Hand-written |
| `storyboard.html` | Every screen with its ID (1.1 … 9.11) and a caption. Open in a browser | `npm run screens` |
| `screens/<id>.png` | The screenshots, iPhone size at 2× | `npm run screens` |
| `brand/brand-board.png` | Logo, icon sizes, color tokens, tab icons, type | `npm run brand` |
| `brand/logos/` | Logo (square), app icon (rounded) and wordmark, dark and light | `npm run brand` |
| `brand/tabs/` | The five solid tab bar icons (`currentColor`) | Hand-made; match `src/components/icons.tsx` |
| `proposals/design-system.html` | Draft design system: the new palette (blue #007AFF with a deeper #0066D6 for fills; protein uses the primary blue, carbs cyan, fat gold), a 12-step type scale, every icon in use (only + − × W D ✕ — stay typed), spacing, heights and radii, and the specs for headers, lists and tables, buttons, controls, popups and charts, in px, plus a Nutrition section (rings, five-tab bar, meal folders, nutrition tables, add-food tiles, value and picker boxes, scanner, week chart) with a list of fixes for `nutrition.html`, and screen patterns that turn nine busier screens (edit mode, routine screen, workout header, Home while running, plate pad, suggestion bar, month calendar, new goal, exercise screen) into recipes, with a guide to which small control to use. Ends with a cleanup list of where the app drifts from it. Not installed yet; once approved it replaces the colors and type in SPEC §8. `design-system.png` is a full-page screenshot | Hand-made |
| `proposals/effort-rpe-rir.html` | RPE / RIR as a badge on the reps box, with an effort pad (A1–A6; the built pad now uses the number keypad's 4×4 layout, see SPEC §12). Built: SPEC §12, screens 2.22, 4.25–4.26, 7.10–7.11, 9.7–9.8 | Hand-made mockup |
| `proposals/watch-sync-future.html` | Parked: watch workouts in History and plan export to the calendar, with what a PWA can and can't do. Not planned | Hand-made mockup |
| `proposals/progressive-overload.html` | Training: in-workout weight suggestions (accept / dismiss, Why sheet), goals with a feasibility check, per-lift trends, focus lifts and settings (A1–F6). Built: SPEC §13, screens 1.5–1.6, 3.6, 4.27–4.33, 5.5, 7.12–7.19, 9.9–9.11. Where it differs from `training-logic.html`, the logic doc wins | Hand-made mockup |
| `proposals/exercise-popularity.html` | Not approved yet: a 0–10 popularity score for every built-in exercise. Popular-first Library and picker, hidden rare exercises, variation chips showing yours + the most popular with an All list (A1–B4), popularity in automatic focus lifts (C1), 52 new exercises (row and pulldown grips, forearms, lower back), the hidden list, variation groups, the full ranking and rules (D–H). `exercise-popularity.json` holds the scores for the seed | Generated from `proposals/exercise-popularity.py` |
| `proposals/set-fit-zone.html` | Interactive sketch of the per-set fit zone (lbs × reps × RIR) that decides each set's next weight. Open in a browser | Hand-made mockup |
| `training-logic.html` | Training spec, draft for tuning (revision 2): per-set fit zone and matching with 24 example sessions, effort target at setup, Suggest / Auto modes, gaps, exercise order (later), trends, missing and messy data, goal projection, milestones, tuning knobs, implementation map. `training-logic.png` is a full-page screenshot. Built in `src/lib/training/` (SPEC §13) | Generated from `training-logic-reference.py` |
| `training-logic-reference.py` | Reference implementation of the training rules (`decide_fit`, trends, projection). Ported to `src/lib/training/`; the doc's tables are its test fixtures (`decide.test.ts`) | Hand-written |

Change the app first, then regenerate. Screens: `scripts/screens.ts` holds the catalog (IDs, titles, captions) and the steps that reach each screen. Logo: edit `src/lib/logo.ts`, then `npm run brand` (it also rewrites `public/` icons).
