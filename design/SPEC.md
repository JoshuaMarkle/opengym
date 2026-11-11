# OpenGym spec

What the app does and the rules behind it. Screen IDs like **4.1** refer to `design/storyboard.html`, a set of screenshots captured from the running app. When this file and the code disagree, fix one of them so they match.

## 1. What it is

A free, offline-first lifting log, built as a PWA and installed to the iPhone Home Screen. You plan routines, log sets fast, and see whether you're getting stronger. A Food tab logs what you eat against calorie, macro and micronutrient targets (§14). There's no account, no OpenGym server, no ads and no subscription. All data lives on the phone, with backup and export. The one outside service is Open Food Facts, for packaged-food search and barcodes, when you're online and haven't turned it off.

**Out of scope for v1:** rest timer, volume/tonnage charts, timed (non-cardio) exercises, social features, training videos, meal plans or diet coaching (and recipes, AI photo logging), gym profiles, intervals, in-app cardio timers, a warm-up ramp, routine sharing.

## 2. Stack

| Layer | Choice |
| --- | --- |
| App | React 19 + TypeScript + Vite, `HashRouter` (works from any static path) |
| PWA | `vite-plugin-pwa` (Workbox): offline cache, manifest, icons; updates apply on next launch |
| Storage | IndexedDB via Dexie (`useLiveQuery` for reactive UI) |
| Styling | Tailwind 4; tokens are CSS variables in `src/index.css` (dark + light) |
| Charts | Hand-rolled SVG (`src/components/charts.tsx`) |
| Drag & drop | dnd-kit |
| Gestures | Pointer events for swipe and long-press (`src/components/gestures.tsx`) |
| Tests | Vitest for everything in `src/lib/` |
| Hosting | Any static host over HTTPS; `wrangler.jsonc` deploys `dist/` to Cloudflare |

The app calls `navigator.storage.persist()` at setup, and holds a Wake Lock during a workout when the "Keep screen on" setting is on. iOS has no Vibration API, so nothing relies on haptics.

## 3. Data model

`src/db/types.ts` is the source of truth; `src/db/db.ts` is the Dexie schema. Every record has `id` (uuid), `createdAt` and `updatedAt`. Weights are stored in **lb** as decimals and converted at display. Routines, folders and exercises are soft-deleted (`deletedAt`) so history keeps working.

```ts
Exercise        { name, type: 'weight'|'bodyweight'|'bodyweight_plus'|'assisted'|'cardio', muscle, equipment,
                  variationGroupId?, popularity?, area?: 'forearms'|'lower back', isCustom, archived,
                  cardioColumns?, distanceUnit?, isRun?, barLb?, platePad? }
Folder          { name, order, active, archived, schedule? }   // exactly one non-archived folder is active
Routine         { name, folderId?, order, notes?, code? }
RoutineExercise { routineId, exerciseId, order, supersetGroup? }
RoutineSet      { routineExerciseId, order, kind: 'warmup'|'working', weight: number|'last', repsMin?, repsMax?, rpeTarget? }
Workout         { routineId?, name, startedAt, endedAt?, status: 'active'|'done', currentExerciseId? }
WorkoutExercise { workoutId, exerciseId, order, supersetGroup?, suggestion?, gapAnswer?: 'break'|'notLogged' }
WorkoutSet      { workoutExerciseId, order, kind: 'warmup'|'working'|'drop', parentSetId?, weight?, reps?,
                  completed, repsMin?, repsMax?, rpe?, rpeTarget?, durationSec?, distance?, speed?, incline?, level?, calories?, steps? }
Goal            { exerciseId, weight, reps, by?, startE1rm, startedAt, startRate, startTau, ownRate?, doneAt?, doneWorkoutId?, celebrated?, deletedAt? }
Settings        { units, theme, weekStart, weightStep, barWeight, dropPercent, keepScreenOn, oneRmFormula,
                  pinnedExerciseIds, pinnedCustomized, lastBackupAt?, historyView,
                  effort: 'off'|'rpe'|'rir', effortAsk: 'every'|'last'|'tap', effortIn1rm, effortExplained?, onboarded,
                  suggestMode: 'off'|'suggest'|'auto', effortTarget, failureLastSetOnly, trainEverything,
                  experience?, phase?, dismissedTips, suggestOnlyIds?, librarySeed?, latelySeen? }
```

Food (§14), Dexie schema version 3. Nutrients are a sparse map over one catalog (`src/lib/nutrition/nutrients.ts`: energy, macros, fiber and sugars, fats, vitamins, minerals); a missing key means unknown, never 0.

```ts
Food        { name, detail?, brand?, barcode?, source: 'usda'|'off'|'custom', fdcId?, offCode?, basis: 'g'|'ml',
              per100: Nutrients, estimated?, filledFrom?, servings: { label, grams }[], defaultServing?,
              favorite?, mine?, last?: { grams, unit, serving? }, copiedFrom?, deletedAt? }
FoodWord    { word, foodId }                    // search index on name words; rebuilt, never backed up
FoodEntry   { day, meal: 'breakfast'|'lunch'|'dinner'|'snacks', order, loggedAt, foodId?, name, brand?,
              grams?, basis?, unit?: 'g'|'oz'|'serv', serving?, servings?, totals: Nutrients, estimated?,
              quick?, savedMealId?, batchId? }  // totals is a snapshot for the amount
SavedMeal   { name, order, items: { foodId, grams, unit, serving? }[], deletedAt? }
FoodTarget  { from, mode: 'target'|'log', kcal?, diet, pct: [p,c,f], grams: [p,c,f], overrides?, sex?, birthYear? }
Settings.food { sex?, birthYear?, heightIn?, weightLb?, activity?, goal?, paceLb?, goalWeightLb?, customPct?,
                online, setUp, usdaRelease? }
```

`WorkoutExercise.suggestion`, `gapAnswer`, `Goal` and the settings on the last two lines of the first block belong to Training (§13). Goals were added in Dexie schema version 2.

- **Weights by type:** bodyweight stores no weight; BW + added stores only the added weight; assisted stores the assist as a negative number.
- **Variations:** exercises sharing a `variationGroupId` (Flat / Incline / DB Bench) are variations of each other. Each keeps its own history.
- **Built-in library:** 209 exercises in `src/db/seedExercises.ts`, ids `ex-<slug>`, variation groups `vg-…`. A launch adds missing built-ins (unless a live exercise already has the name), copies each built-in's `popularity` and `area` from the seed, and applies regrouping once per library version (`Settings.librarySeed`), only to built-ins the user hasn't linked elsewhere.
- **Popularity** (`design/proposals/exercise-popularity.html`, `src/lib/popularity.ts`): every built-in has a hand-set score 0–10, how many lifters you'd expect to have it in a log; custom exercises count as 6. It is **never shown**: it only decides order, hiding and focus-lift ties.
  - **Hidden:** score ≤ 3 is left out of the Library and picker lists and of variation chips. It still shows when searched (dimmed, under Rarely used), whenever you've logged it or it's in a routine, in a group's All list, and with Show hidden. Derived, never stored.
  - **Order:** Library (8.1) and picker (2.5) open on Popular: You do (your 4 most-logged), then Most popular. A–Z is one tap away and remembered on the device. Search: matches you've logged first, then by score, then rarely used ones. Muscle chips filter; Cardio is the last one.
  - **Area:** Forearms / Lower back add a word to the meta line ("Arms · Forearms · dumbbell") and to search, never a chip.
  - **Variation chips** (8.2, 4.1): the ones you've logged (most sessions first, always a chip), then the most popular, up to 4. Selection does not reorder the chips, and only the selected variation is highlighted. If the selected variation is outside that list, append it. The rest sit behind "All N" (8.8) or "+N" while logging (4.36). Labels come from the whole group.
  - **Not built yet:** Farmer's Carry and its weight × time type (ROADMAP).

## 4. Core rules

**Prefill (4.1).** A workout started from a routine takes each set's weight from the routine. `'last'` means the same set position from the most recent workout with that exercise (empty if none). Reps fill in from last time; with no history the rep range shows as a grey placeholder.

**Previous column.** Matched by position within the exercise: working sets to working sets, drops to the drop that followed the same parent last time. A **D** badge after a previous value means you dropped after that set last time (orange reps instead when the column also shows Next and is too narrow, §13 Previous → Next).

**Session lines (4.10).** Sets in the order done, each drop right after its parent: `10 × 12 · 10 × 10 D 5 × 12`. Warm-ups are left out.

**Sets.** ✓ completes a set. "+ Set" appends a working set. "+ Drop" adds a drop under the last completed set at `weight × (1 − dropPercent)`, rounded to the weight step. Swipe right marks a warm-up (moves to the top as W). Swipe left deletes with a 5 s Undo. Tapping the set number or holding the row opens Mark as warm-up / Move to top / Duplicate / Delete.

**Estimated 1RM.** Epley `w × (1 + reps/30)` by default; Brzycki is a setting. Per session, from the best working set only: no warm-ups, no drops, nothing over 12 reps. With "Use effort in est. 1RM" (§12), a rated set counts its reps in reserve. Bodyweight charts reps, BW + added charts the added weight, assisted charts the negative weight (less assist = progress). Cardio is excluded.

**Records.** Best weight at each rep count 1–12 (working sets), plus the best est. 1RM and the heaviest set. "New" = set in the last 30 days.

**Next up (Home).** Within the active folder, the routine whose last finished workout is oldest (never done counts as oldest); ties go to folder order. A scheduled active folder follows its schedule instead (§11).

**Finishing (5.1–5.3).**
1. If any set with values is unticked: Count them / Drop them / Keep going. Empty sets are dropped silently.
2. If exercises, their order or set counts differ from the routine: **Update routine** or **Just this time**. Weights and reps never count as changes.
3. Save, then show the summary: each exercise's best set vs the last workout of the same routine.

**Workout lifecycle.** One active workout at a time, persisted on every change so it survives closing and reloading. Home leads with it (3.2) and other tabs show a Resume bar (3.3). Discard is in the workout options (5.4) and confirms first.

**History (6.1–6.5).** Month always shows; 6M, Year and All appear only when history spans that long. Calendar and the completed-workout History list share one tab with Routines. Month offers Dates / Codes: Dates uses compact 44px rows with all date numbers aligned above codes or dots. It shows a small planned code beneath uncompleted planned days, slightly brighter than the gray date; completed days keep their workout dots without codes or checkmarks. Codes always mean the planned routine, rest days keep dates, and one dot represents each logged workout. Planned days have no border, logged days have no background fill, and workout dots sit close beneath their date. Missed days have orange outlines; today has a white outline when unselected (foreground color in light mode). Future months omit retrospective stats. Missed days offer Log it late / Keep skipped (PH3.7). A late workout persists its selected date as `Workout.loggedFor` while active, then applies that date on finish while preserving the actual session duration. Weeks start on `settings.weekStart` (default Sunday). Streaks count weeks in a row with at least one workout. Two workouts on one day are allowed.

**Backup (9.3–9.6).** One JSON file with `schemaVersion` (currently 4: 2 added cardio and supersets, 3 added goals, suggestions and training settings, 4 added Food) and every table except the food search index; built-in USDA foods are left out unless you made them yours (logged, starred), because they come back from the database file, sent through the share sheet (`navigator.share` with a File, else a download). Restore replaces everything after a confirmation showing both workout counts (and logged food days, when either side has any); the built-in foods already on the phone stay and the search index is rebuilt; older backups still restore, and a newer one is refused with "Update the app". Import from Strong / Hevy parses their CSV, matches exercise names, flags unsure matches and adds to history without replacing anything. CSV export includes RPE, cardio and superset columns, plus a second file with the food log (date, meal, food, brand, amount, grams, one column per nutrient, blank when unknown, and which values were estimated); imports read the RPE column of Strong, Hevy and OpenGym files. Delete all data requires typing DELETE. The Settings Data header shows the last backup date in plain gray, never a warning.

## 5. Navigation and keypad

Tab bar: **Home · Calendar · Food · Progress · Settings**. Calendar contains Calendar / Routines / History views, in that order (PH3.2–PH3.5); the title follows the selected view and the active plan stays in its subtitle. The existing plan detail screen is unchanged. A workout has no tab bar; the bottom bar is Prev / Next exercise (grey). With no Prev or Next, that button becomes "All exercises" (4.1, 4.11); with no Next and every set in the workout ticked, it becomes a blue "Finish workout". All exercises (4.12–4.13) replaces everything under the workout header, so the header and Finish stay; Close returns to the exercise. Swiping an exercise row left removes it: logged sets ask first, otherwise a 5 s Undo. The chart button next to "•••" opens the two-thirds-height Charts / Records / History sheet (4.8–4.10).

**Keypad (2.4, 4.2, 4.15, 4.22).** A 4×4 grid: `1 2 3 / 4 5 6 / 7 8 9 / − 0 .` on the left; close · + · − · backspace on the right. ± steps weight by `weightStep` and reps by 1. In reps mode the bottom-left key is the range dash and the decimal is off. Header: `123 | Plates` on the left (a label on reps boxes), field tabs and **one** blue button on the right: **→ Next** on any box but the last in the row, **✓ Done** on the last (completes the set and jumps to the next set's first box). With effort on, a working set's boxes (lbs and reps) add an `rpe` / `rir` tab whose effort pad takes the grid's place (§12). During a workout the keypad opens under the Prev / Next bar, and tapping the blank space under + Drop / + Set closes it.

## 6. Screens

`design/storyboard.html` shows every screen with its ID, captured by `npm run screens`. Sections: 0 Dev · 1 First launch · 2 Planning · 3 Starting · 4 During a workout · 5 Finishing · 6 History · 7 Progress · 8 Exercises · 9 Settings & data · 10 Food. When you add or change a screen, add or update its entry and scene in `scripts/screens.ts` and re-run it.

## 7. Tooling

- **Testing mode.** `npm run dev` on localhost uses a separate database (`opengym-test`) filled with sample push / pull / legs history from July 2024 (`src/lib/sampleData.ts`). A phone opening the dev server over the LAN, `npm run dev:real` and production builds use the real database. In dev, `window.__og.db` is the Dexie instance.
- **Screenshots.** `npm run screens` starts its own dev servers, freezes the clock at Thu Nov 5 2026, drives headless Chromium through every screen, and writes `design/screens/*.png` plus `design/storyboard.html`. `npm run screens -- 4 2.1` re-runs only matching IDs.
- **Brand.** `npm run brand` regenerates the logo SVGs, the PWA icons and the brand board from `src/lib/logo.ts` and `src/index.css`.

## 8. Design

A new screen or feature should pass all ten principles:

1. **Logging is the product.** One tap completes a set; values come pre-filled from last time; typing is the exception.
2. **The plan is a guide, not a script.** Any order, drops any time, swap or add exercises mid-workout; the app asks at the end whether to keep changes.
3. **Quiet, flat, black and white.** Hairlines, no cards, shadows or gradients. The numbers stand out.
4. **Color always means something,** and is never the only signal (always paired with text or a symbol).
5. **Numbers first.** Weights and reps are the biggest, boldest things on screen. A set is written `185 × 8` (`BW × 12`, `+25 × 8`, `−40 × 10`).
6. **Gestures are shortcuts, never the only way.**
7. **Thumbs at the bottom, decisions at the top.** ✓, + Set, Prev / Next, keypad and Start live low; Save / Done top right, Cancel / Back top left.
8. **Forgiving.** Undo after deletes, confirm before losing logged work, typing for the one irreversible action.
9. **Your data, on your phone.** Backup is first-class: visible date, reminders, one-tap export, imports.
10. **No bloat.** If it doesn't help you log or see progress, it isn't here.

Dates read `Thu, Oct 29`, or relative within a week ("Mon"). Units default to lbs, written "lb" after numbers.

- **Design system.** Colors, type, sizes, radii, glyphs and every shared component are in [`DESIGN.md`](DESIGN.md) (the installed form of `proposals/design-system.html`), built in `src/components/ui/` and checked by `npm run lint:design`, which runs in `npm run build`. Where this section and `DESIGN.md` differ on looks, `DESIGN.md` wins; the behavior rules here still apply.
- **Tokens.** Every color is a CSS variable in `src/index.css` (dark first; light swaps the neutrals). One blue, `#007AFF`: accent for text, lines, rings and marks; action for every filled surface with white on it. Pressed actions use `#0054B0`. Tip green (up, records, live), warning `#FF9500` (drops, backup due), danger `#FF453A` (delete, down).
- **Type.** System font, tabular numbers everywhere digits appear, twelve sizes from Hero 40 to Micro 10 (`text-hero` … `text-micro`), no arbitrary sizes.
- **Layout.** Flat rows with hairline dividers (52 single, 60 two-line); no cards, no shadows. 16 px edges, 8 px grid, 44 px minimum tap target.
- **Bars and overlays.** Cancel/Back on the left, Save/Done on the right. Sheets are for options; their table-style option separators are inset 16 px on both sides, aligned with the row text, while the whole row stays pressable. Alerts only confirm data loss. Alerts look like iOS: centered, 270 wide, hairline-separated buttons.
- **Gestures** are shortcuts only; everything they do is also reachable from a visible control.
- **Logo.** The right half of a loaded bar, drawn like the plate pad at 5× scale: grey bar off the left edge, a collar, two 45s (the second centered) and a 10, all plates blue. Geometry lives in `src/lib/logo.ts`.
- **Icons.** Only the tab bar uses the solid icons in `design/brand/tabs/`. Only + − × W D ✕ and — are typed; everything else (check, chevrons, arrows, trends, more, play, handle, the workout-options pencil (5.4), the orange warning triangle for "not enough data" (7.1)) is a drawn glyph from `src/components/icons.tsx`.

## 9. Open questions

- Should Home allow two scheduled workouts in one day? The data model and History allow it, but the "Two workouts this day" toggle (2.19) isn't built.
- Watch sync (Garmin, Apple Watch, calendar export): parked; notes and mockups in `design/proposals/watch-sync-future.html`.

## 10. Plate pad, supersets, cardio

**Plate pad (4.16–4.18).** Offered for weight × reps lifts on a barbell or plate-loaded machine.
- The bar drawing (the right half of a barbell) is on the left; the total and "x / side" sit top right over a 2 × 3 grid of plate buttons (45 / 35 / 25 / 10 / 5 / 2.5 lb, or 25 / 20 / 15 / 10 / 5 / 2.5 kg), each showing how many are loaded per side. Bottom row: Undo / Clear / Done. The panel is the keypad's height.
- A plate button adds that plate to **each** side, up to 10 a side (then the buttons dim and "Max 10 / side" shows). Tapping a plate on the drawing removes it. Total = bar + 2 × plates. When the stack doesn't fit, it slides left and a ‹ hint appears.
- "Bar 45 ▾" picks Barbell / Light / EZ / Trap / Custom / No bar (machine). The pad starts on 123; choosing Plates and the bar are remembered per exercise (`Exercise.platePad`, `barLb`).

**Supersets (2.12–2.13, 4.19–4.20).**
- Exercises sharing a `supersetGroup` letter form a superset, up to **3** per group. Create one with "•••" → "Superset with…" or by dragging into the bracket; unlink the same ways.
- Logging: the group shares one screen with tags A1 / A2. After ✓ the app jumps to the same set number of the next partner (a warm-up or drop stays put). Finished partners fold into one line and their tag becomes ✓. Uneven set counts just continue on their own.
- Everywhere else the group shows as one blue bracket and moves as one block.

**Cardio (4.21–4.24, 5.3, 6.6, 7.7–7.9, 8.5–8.6).**
- Exercise type `cardio` with `cardioColumns`: `time` plus up to 2 of `distance | speed | incline | level | calories | steps | split500 | pace | avgSpeed`. Split, pace and average speed are calculated from time and distance, never typed. Distance follows units (mi / km) unless `distanceUnit` is `m`. `isRun` marks runs for distance records. Stored values are SI: seconds, meters, km/h.
- Logging: rows are segments ("+ Segment"), columns `# | TIME | col2 | col3 | ✓`, no Previous column. Last session is one line under the name. Empty boxes show last time's values in grey and ✓ accepts them. A Σ row appears only with 2 or more segments. In time mode the keypad's bottom-left key is ":" and ± steps a minute.
- Presets: Treadmill, Bike, Rower, Stair climber, Elliptical, Run / walk outside, Jump rope, Generic, under a Cardio filter in the normal picker.
- Summary: cardio gets its own section and a "Cardio this week" line, no faster / slower verdict, and doesn't count toward lift stats.
- Progress: a Lifts / Cardio switch. Cardio charts amount, not speed: minutes / miles / sessions per week over 4W · 3M · 6M · 1Y · All (ranges without enough history hide), a dashed average line, per-machine totals, and a machine detail screen. Distance records: fastest 1 mile, 5K, 10K, half and full marathon from run-type segments that covered the distance, time scaled to the exact distance.

## 11. Plan schedules (2.14–2.21, 3.4–3.5)

A folder with a `schedule` is a plan. Folders without one work as a plain rotation. Logic: `src/lib/schedule.ts`.

**Data.** `Folder.schedule = { versions, overrides, skipped? }` and `Routine.code?` (1–3 letters).
- `versions`: `{ from: dayKey, kind: 'none'|'cycle'|'weekly', days, anchor?, onMiss }`. Weekly `days` has 7 slots by weekday (0 = Sunday); cycle `days` are in order and `anchor` is a day that was day 1. A slot is a routine id or `null` (rest). Saving adds a version from today (replacing one that starts today), so past days keep their plan and one-off changes from today on are dropped.
- `overrides`: day key → `{ routineId, moved?, pair? }`. `pair` links both days of a move or swap so "Back to plan" undoes both.
- `skipped`: missed days the user chose to skip, which hides the note.

**Rules.**
- Any finished workout on a planned day counts as doing it. A workout on a rest day is an extra. A deleted routine's slots count as rest.
- Missed days: cycles default to **Wait for me** (the cycle pauses; no misses, no note) or **Stick to dates**. Weekly splits default to **Skip it** or **Move to rest day** (the workout slides to the next plain rest day that week). Today and later assume you train as planned.
- Strip labels come from the routine name (Push A → PA, then Pull A → PL on a clash); `Routine.code` overrides them.

**Screens.**
- Routines (2.14, PH3.5): every scheduled folder shows a code-only week strip (no dates or workout dots) and when each routine is due. Tapping the folder name opens the plan screen (2.15); the chevron folds it.
- Home (3.4, PH3.1): completed planned days from this week, then today and up to 3 upcoming workouts, future rest rows omitted. Today always has its own row: a blue "Today" label for a workout, or "Rest today" (3.7), including when a missed-workout note is shown. Blank workout sits at the bottom of the list; today has Start and upcoming routines have play controls. 3.5 adds a note the day after a miss ("Do it today" / "Skip it"), only when the same skip-type schedule was in force yesterday and today.
- Change one day (2.21, from long-press on Home or the plan screen, or tapping a calendar day): a different routine, rest (the workout moves to the next rest day, or waits in a Wait cycle), move to one of the next 7 days, swap with the next workout day, or back to plan. Cycles offer explicit Skip this workout (advances past the slot) and Move workout to… (inserts rest days up to the chosen date and pushes subsequent cycle days back, including Wait cycles). Weekly moves replace the target day. Wait cycles do not offer swaps. The sheet uses a neutral Edit this workout action and no footer description (PH3.12).
- "+ New routine for this day" (2.19) opens the builder and hands the new routine back to the schedule editor.
- Backups carry the schedule inside the folder record. "Import routines" remaps schedule routine ids to the imported copies.

## 12. Effort: RPE and RIR (2.22, 4.25–4.26, 7.10–7.11, 9.7–9.8)

An optional effort rating per working set. Mockups: `design/proposals/effort-rpe-rir.html` (A1–A6).

- **Stored once** as `WorkoutSet.rpe`, 1–10 in half steps. RIR is only a way of showing it (`10 − RPE`, "5+" for RPE ≤ 5), so switching modes never loses data. With effort Off nothing shows, but logged ratings are kept.
- **Settings › Effort (9.7).** RIR by default (onboarding sets the effort target in RIR). Track as RPE or RIR, or Off. Ask on: every working set, the last working set only, or only when you tap the badge. "Use effort in est. 1RM" (off by default). "What are RPE and RIR?" opens the sheet (9.8); it never opens on its own.
- **Badge, not a column.** A small round badge on the reps box's bottom-right corner (V2B in `design/proposals/rir-badge-variations-v2.html`): the number for RPE (`8`, `8.5`), with R for RIR (`2R`, `1.5R`; halves drop the R in superset rows). Black with a thin ring and a cut-out ring in the row's colour, floating on a soft shadow. Logged: a grey ring, then a faded blue fill in a full blue ring once the set is done; picking: a blue ring with a glow; a routine target: grey text in a grey ring; a blue `+` in a blue ring on unrated sets where effort is asked for. In RIR mode a done set left unrated counts as 0 and shows a grey `0R` (never the done blue), so it reads as assumed, not logged; tap to rate it. Every state is the same size; only colours change. Its centre sits on the box's bottom edge; a one-digit badge's centre is on the corner, wider ones grow left so they never reach the ✓. Tapping the badge opens the pad; the keypad tab is the visible way to it. Warm-ups, drops and cardio never get one.
- **Effort pad (4.25, 4.26).** On a working set's lbs or reps box the field tabs read `lbs · reps · rpe`. The pad replaces the number grid with the same 4×4 layout and height, so a quick thumb lands in the same place: each digit is its own value with a word under it (RIR `0` Failure to `5+` Easy, with 6–9 off so nobody logs an RIR of 6 or more; RPE `≤5` to `9`, with `0` standing for 10 Max and 1–4 off). `.` is `½` for half steps (shown on the picked key: 8 + ½ = 8.5, RIR 1 + ½ = 1.5; on an empty RIR it picks ½, and again makes it 0), ± move a whole step, ⌫ clears, ⌄ closes. Hardware keys work the same way. Every press saves; ✓ Done completes the set, with or without a rating. With "Ask on" every (or the last) working set, → Next on reps goes to the pad before ✓ Done.
- **Targets (2.22).** `RoutineSet.rpeTarget`, set from the rpe tab in the builder, shown as an outlined badge. A workout copies it to `WorkoutSet.rpeTarget` as a placeholder badge only, never as a logged value.
- **Previous** shows last time's rating under the set (`185 × 8` over `@7`). History lines write each set as one unbreakable block (`185 × 8 @8`); a wrapped line never ends on a dot (7.11). Workout detail (6.6) and Edit past workout (6.7) show and edit it too.
- **Est. 1RM with effort (7.10).** Epley / Brzycki on reps + RIR (185 × 8 @8 counts as 10 reps). The 12-rep cap still applies to the reps done. The chart label reads "Estimated 1RM · effort-adjusted".
- **Same weight, easier (7.10).** When the newest session has a rated set whose weight and reps (or more) you did in the last 8 weeks at a higher RPE: "185 × 8 went from @9 to @8 since Oct 12. Ready for more weight."

## 13. Training: suggestions, trends and goals (1.5–1.6, 3.6, 4.27–4.34, 5.5, 7.1, 7.5, 7.12–7.19, 9.9–9.11)

The rules, constants and worked examples are in `design/training-logic.html` (revision 2), and they win over the mockups in `design/proposals/progressive-overload.html` where the two differ (the mockups' 60% set-1 weighting and back-off rule are superseded by the fit zone). The pure logic is `src/lib/training/`, ported from `design/training-logic-reference.py`; the doc's 24 example sessions are its test fixtures.

- **Fit zone per set (§6–§8).** E = w × (1 + (reps + RIR) / 30); the zone is the weights that land the set in its rep range at the effort target. Topped out → one step up; in the zone → keep; otherwise move to the estimate. Set 1 leads; later sets share its weight when it still fits them and are never heavier. Missing RIR counts as 0. BW + added and assisted move one step at a time; bodyweight gets rep hints only. No rep range: last 5 sessions' set-1 reps ± 1 (once there are 3).
- **Step (§5).** Barbell = the weight step; dumbbells 5 lb / 2 kg; machines and cables 10 lb / 5 kg; then learned from the weights you actually log.
- **Modes (§9).** Settings › Training › Suggestions: Off, Suggest (default) or Auto. Suggest shows a bar above the sets ("▲ Use suggested weights?", orange ▼ when lighter) with Why, ✕ and ✓; ✓ writes LBS on unticked working sets, in blue until you change one (type over it or use ±), and Undo puts the old values back. Reps are never touched. Auto fills LBS when the exercise comes up, in blue until you change one (an edit is remembered). Two dismissals in a row of the same weights hide the bar until the numbers change. Three Auto sessions in a row edited → the Why sheet offers "Switch this lift to Suggest". Stored per exercise as `WorkoutExercise.suggestion`.
- **Previous → Next (4.27, 4.34).** The Previous column also shows each working set's target after an arrow, "155 × 12 → 160 × 12", in green (orange when lighter). Every row's previous gets the same width, so the arrows and targets line up. When the widest previous with its D badge, the arrow and the widest target don't fit, the D badges go and last time's reps on those sets turn orange instead. Tap the header (`PREVIOUS → NEXT`) to show Previous alone; stored as `Settings.showNext`.
- **Gaps (§11, 4.32–4.33).** 21+ days since a lift: "Back after N weeks?" — a break (start at 90%, 80% after 42 days, and ramp back over 3 sessions) or sessions that weren't logged (normal suggestions). Answer stored as `WorkoutExercise.gapAnswer`. Ramp sessions stay out of trends. The Coming back phase answers it for every lift. **Off for now** (hidden setting `askAboutGaps`, no UI): asked per lift, it fired on a variation you'd rotated back to while logging its sibling every week. Unasked, a gap gets normal suggestions; the Coming back phase still ramps every lift.
- **Effort target (§4).** Asked in setup (1.5), editable in Settings (9.11): RIR 0–1, 0–2 (default), 1–3, 2–4, plus "Only the last set to failure".
- **Status (§15).** Per lift over the last 8 weeks, from set 1's effort-adjusted est. 1RM (reps for bodyweight, weight for assisted): Climbing, Holding, Steady (a slow lift), Slipping (a real drop with most recent sessions under the trend), Maintained, or Not sure yet (< 6 sessions). Judged against each lift's own wobble and pace (blended with a prior by lift type and experience); a new status needs two evaluations in a row. Shown on Progress (7.1) and the trend screen (7.13–7.14) with milestones and, for slipping, "What changed" from the log only.
- **Focus lifts and Train everything (§21, 7.5).** Up to 5 focus lifts (the pinned lifts; default the 4 most-logged compound lifts, ranked by sessions × (0.6 + 0.04 × popularity), at most one per variation group) go first and feed Home "Lately". The same weighting orders the other lifts on 7.1 and 7.5; with nothing logged, 7.5 lists compound lifts by score. Train everything (on) gives every lift logged in the last 8 weeks a status; off, other lifts collapse to one row.
- **Goals (§17–§18, 7.12, 7.16–7.19, 5.5).** `Goal { exerciseId, weight, reps, by?, startE1rm, startedAt, startRate, startTau, ownRate?, doneAt? }`, converted to an est. 1RM target so every set counts. Projection follows E₀ + r₀·τ·(1 − e^(−t/τ)) with a slow–fast band; verdicts Ready / Likely / Stretch / Unlikely. Only projected when the last 12 weeks look like a trend; otherwise you pick a pace. Behind = below the "should be here" tick for 2 weeks and not Likely, which offers a later date, a lighter target or keep it. A goal is done when a finished workout has a set at or above it; the summary shows it once with a Likely and a Stretch next step. Deleting a goal confirms first.
- **Milestones (§19).** Plate numbers per equipment (barbell 135–495 × 1/5/10, …): the last 2 reached and the next 3, the highest "Ready" one when the est. 1RM covers it. Milestones are only a ladder to look at: they never prompt on Home. Goal turns one into a goal, and a milestone that already is a goal links to it (`goalForMilestone`).
- **Phase (§20, 9.10).** Building, Maintaining (topped-out sets keep their weight, Holding reads Maintained, slip threshold × 5/3, goal dates can pause) or Coming back, with an optional end date.
- **Home "Lately" (3.6).** At most one goal line and one trend line, each shown on the day it first appears (`Settings.latelySeen`). Priority: goal done > goal behind > a focus lift turning Climbing or Slipping. Milestones never show here. A 21-day gap in all training offers Coming back.
- **Month in review (7.15).** Workouts, records, lifts up, one best moment and every lift against the month before. Leads Progress in the first week of a month.
- **Tips (§23).** At most one per workout, dismissed for good from its ✕.


Changed-day indicators (PH3.10–PH3.11): one-off schedule overrides use the same gray dashed outline in the main calendar, routine editor calendar, and Home week strip. The main calendar legend vertically centers each marker with its label; a square calendar-icon button immediately left of Dates / Codes returns to the current month and selects today (PH3.2–PH3.3). The main calendar includes a Changed legend; today keeps its blue outline.

Calendar day taps (PH3.15): first tap focuses a day; tapping the selected editable day again opens the change-day drawer. Past and unscheduled days stay read-only. The visible Change this day action remains available.

## 14. Nutrition: the Food tab (10.1–10.32, 3.1)

Logging what you eat against your own targets: calories, protein, carbs, fat and the common micronutrients. No meal plans, coaching or recipes (§1). The plan and its decisions are `design/proposals/nutrition-plan.md`; the mockups are `proposals/nutrition.html` (Food v5). Pure logic is `src/lib/nutrition/`, reads and writes `src/data/food.ts`, screens `src/screens/food/`.

- **Days and meals (10.1–10.4).** A food day runs 3 am to 3 am. Four fixed meals; the meal for the time of day (breakfast to 11:00, lunch to 4 pm, then dinner; snacks by choice) opens on its own today, other days open with every folder closed. ‹ › and the ring strip move between days; swiping the strip does too. You can log ahead; future days count only once they arrive. The + in the header adds to the meal of the moment.
- **Over and under.** Calories, carbs and fat are ceilings: orange only past 3% over, and always with the word "over". Protein is a floor: reaching it gets a check, never a color. Micronutrients are floors with an upper limit (orange only past the upper limit) or limits (sodium, saturated fat, added sugars, trans fat, cholesterol: orange past the limit).
- **Targets (10.6–10.13).** Setup asks sex, age, height, weight, activity, goal and pace. Maintenance is Mifflin–St Jeor × activity, ± the pace (500 kcal a day per lb a week), rounded to 50, never under a safety floor. Diets set the split: Lifter (protein 1 g per lb, capped at 40%; fat 27%; carbs the rest, default), Balanced, High protein, Low carb, Keto, Endurance, or Custom (+ adds 2% to a macro and takes 1% from each of the others, none under 5%). "Just log" keeps totals without a target. Micronutrient targets come from the US Dietary Reference Intakes for sex and age (fiber 14 g per 1,000 kcal); any one can be overridden and Reset brings the DRI back. Every change saves a target version that applies from today, so past days keep theirs.
- **Adding food (10.14–10.18).** The meal is the title. Search finds your foods and foods you log first, then the built-in USDA foods (short names first), then Open Food Facts under Online when local results are fewer than 8 (500 ms after typing stops, 2+ characters). With no search: Usually at <meal> (3+ times in 30 days), then Recent. + logs your last amount for that food (else its default serving) and turns into a check that takes it back off; tapping the row opens the amount (g · serv · oz on the keypad dock). Anything added since the screen opened stays checked, and Cancel becomes Done.
- **Entries keep a snapshot** of every nutrient for their amount (and which were estimated), so editing or deleting a food never changes a logged day. Tap an entry to change its amount or meal, or delete it; swipe left deletes with a 5 s Undo.
- **Your foods (10.19–10.24).** A food joins your library when you make, log, star or scan it. New food takes the label as printed (per serving) and stores per 100 g; a note shows when calories are more than 15% off 4·P + 4·C + 9·F, without blocking. USDA and Open Food Facts foods are read-only: "Make a copy to edit". Quick add is calories with optional macros and a name, never a library food. Saved meals are built like routines (drag handles, delete discs); + in the Meals tab logs each food as its own entry, tagged so the check takes the group back off. Copy a day copies yesterday's meal, or a whole past day into the same meals, with one Undo. A meal folder's long-press menu (Save as meal · Copy to today · Clear meal) is also behind the ••• on its Add row.
- **Micronutrients (10.25–10.28).** Day nutrients lists every catalog nutrient: amount / target, a 4 px bar and the %. A food with no value for a nutrient adds nothing, and the row says "Missing from N foods" with the not-enough-data glyph; totals are never guessed. A nutrient's screen lists the day's top foods and the foods missing it. A packaged or custom food missing most micronutrients offers "Fill in missing nutrients": the closest built-in foods by name (rare words weigh more), copying only what's missing per 100 g, marked "~".
- **Where foods come from.** The built-in database is USDA FoodData Central (SR Legacy, Foundation, FNDDS; about 13,000 foods), built by `npm run foods` into `public/foods/usda-<release>.json`, loaded into IndexedDB in batches the first time Food opens (resumable), and cached for offline. Open Food Facts adds packaged foods; requests carry the app name and the query or barcode only. Settings › Food (10.31) turns online lookups off.
- **Scanning (10.29–10.30).** The camera reads EAN-13, EAN-8, UPC-A and UPC-E: `BarcodeDetector` where the browser has it, else ZXing compiled to WebAssembly, downloaded on the first scan and cached. Two matching reads look the code up: your own food for that barcode first, then Open Food Facts. Nothing is logged until Log. "Wrong food? Fix the numbers" opens New food filled in from the scan with the barcode, and your copy wins from then on. No camera: type the number.
- **Week (10.32).** Mon–Sun or Sun–Sat per Week starts on. Average per day, days on target (90–103%) and days protein was hit count only past days with food. Stacked macro bars against the dashed target, averages against target, and the seven days.
- **Home (3.1).** Once Food is set up, today's calories and macros sit under the routines with "+ Log food".

