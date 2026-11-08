# OpenGym — Product Spec (v1)

The source of truth for what to build. Screens are in `storyboards/complete.html`; screen IDs like **4.1** below refer to it. Older storyboards (`v1`–`v8`) are history only. Where they disagree with this file or `complete.html`, this file wins.

## 1. What it is

A free, offline-first lifting log, built as a PWA and installed to the iPhone Home Screen. You plan routines, log sets fast, and see if you're getting stronger. There's no account, no server, no ads and no subscription. All data lives on the phone, with backup and export.

Cardio, supersets and the plate pad were added after the core phases (§10), then plan schedules (§11).

**Out of scope for v1:** goals, +weight hints, rest timer, volume/tonnage charts, timed (non-cardio) exercises, social features, training videos, diet plans.

## 2. Tech stack

| Layer | Choice |
| --- | --- |
| App | React + TypeScript + Vite |
| PWA | `vite-plugin-pwa` (Workbox): offline cache, manifest, icons |
| Storage | IndexedDB via Dexie.js (`useLiveQuery` for reactive UI) |
| Styling | Tailwind CSS, with tokens from §8 as CSS variables (dark + light) |
| Charts | Hand-rolled SVG or a tiny lib (uPlot). Charts are simple lines and dots |
| Drag & drop | dnd-kit (touch) |
| Gestures | Pointer events for swipe-to-act and long-press (no heavy gesture lib) |
| Tests | Vitest for logic (1RM, records, next-up, import parsing) |
| Hosting | Static build on the user's domain (Cloudflare Pages / GitHub Pages) |

Call `navigator.storage.persist()` on first launch. Use the Wake Lock API while a workout is active (setting: Keep screen on). The iOS Vibration API isn't available, so don't rely on haptics.

## 3. Data model (IndexedDB)

Every record has `id` (uuid), `createdAt` and `updatedAt`. Weights are stored in **lb** internally, as decimals. Convert for display when units = kg. Use soft delete (`deletedAt`) for routines, folders and exercises so history keeps working.

```ts
type ExerciseType = 'weight' | 'bodyweight' | 'bodyweight_plus' | 'assisted';
Exercise   { name, type, muscle, equipment, variationGroupId?, isCustom, archived }
Folder     { name, order, active: boolean, archived: boolean }   // exactly one active
Routine    { name, folderId?, order, notes? }
RoutineExercise { routineId, exerciseId, order }
RoutineSet { routineExerciseId, order, kind: 'warmup'|'working',
             weight: number | 'last', repsMin?: number, repsMax?: number }  // reps empty = no target
Workout    { routineId?, name, startedAt, endedAt?, status: 'active'|'done' }
WorkoutExercise { workoutId, exerciseId, order }
WorkoutSet { workoutExerciseId, order, kind: 'warmup'|'working'|'drop',
             parentSetId?,           // drops point at the set they follow
             weight?, reps?, completed: boolean }
Settings   { units:'lb'|'kg', theme:'dark'|'light'|'auto', weekStart:0|1,
             weightStep:5, barWeight:45, dropPercent:25, keepScreenOn:true,
             oneRmFormula:'epley', pinnedExerciseIds: string[],
             lastBackupAt?, historyView:'calendar'|'list' }
```

Variations: exercises sharing a `variationGroupId` are variations of each other (Flat / Incline / DB Bench). Each keeps its own history.

## 4. Core rules

**Prefill (4.1).** When a workout starts from a routine, each set's weight comes from the routine (`'last'` means the same set index from the most recent workout with that exercise; empty if none). Reps fill in from last time. If none, show the rep range as a grey placeholder.

**Previous column.** Match by set position within the exercise: working sets to working sets, drops to the drop that followed the same parent last time. Show a **D** badge after a previous value when you did a drop after that set last time.

**Session lines (look-back History, 4.8).** Sets in the order you did them, each drop right after the set it followed: `10 × 12 · 10 × 10 D 5 × 12 · 10 × 8 D 5 × 10`. Warm-ups are left out.

**Sets.** ✓ completes a set. "+ Set" appends a working set. "+ Drop" adds a drop under the last completed set, prefilled at `weight × (1 − dropPercent)`, rounded to the weight step. Swipe right marks a warm-up (moves to the top as W). Swipe left deletes, with 5 s Undo. Long-press opens a menu: Mark as warm-up / Move to top / Duplicate / Delete.

**Estimated 1RM.** Epley: `w × (1 + reps/30)`. Per session, use the best working set only: no warm-ups, no drops, no sets over 12 reps. Bodyweight type charts reps. BW+added charts the added weight. Assisted charts the negative weight (less assist = progress).

**Records.** Best weight for each rep count from 1 to 12 (working sets only), plus the best est. 1RM and the heaviest single set. "New" means set in the last 30 days.

**Next up (Home).** Within the active folder, the routine whose last completed workout is oldest (never done counts as oldest). Ties go to folder order. When the active folder has a schedule, Home follows the schedule instead (§11).

**Finishing (5.1–5.3).**
1. If any non-empty set is unticked, ask: Count them / Drop them / Keep going. Empty sets are dropped silently.
2. If the exercises, their order or the set counts differ from the routine, ask **Update routine** or **Just this time**. Weight and rep values never count as changes.
3. Save, then show the summary: per exercise, the best set vs the last workout of the same routine.

**Workout lifecycle.** Only one active workout at a time. It survives app close and reload because it's persisted on every change. Home shows the in-progress block (3.2) while one is active. Discard is in the header menu (5.4) and confirms first.

**History ranges (6.1–6.4).** Month is always shown. 6M, Year and All only appear when history spans that long. The calendar/list toggle choice is remembered. Weeks start on `settings.weekStart`. The default is Sunday.

**Backup (9.3–9.6).** Backup is one JSON file with `schemaVersion` and all tables, sent through the share sheet (`navigator.share` with a File, falling back to a download). Restore replaces everything after a confirmation showing both workout counts. Import from Strong/Hevy parses their CSV, matches exercise names, flags unsure matches, and adds to history without replacing anything. Delete all data requires typing DELETE. The Settings Data header turns orange when `lastBackupAt` is more than 7 days old.

## 5. Navigation

Tab bar: **Home · Plans · History · Progress · Settings**. Inside a workout there is no tab bar. The bottom nav is Prev / Next exercise. When there is no Prev or Next, that button becomes "All exercises" (4.11). All exercises (4.12–4.13) replaces everything under the workout header, so the header and Finish stay on screen; Close returns to the exercise. Swiping an exercise row left removes it (same as Edit → −): logged sets ask first, otherwise there's a 5 s Undo. The Prev / Next buttons are always grey. The chart button next to "•••" opens the History / Charts / Records sheet (4.8–4.10).

## 6. Screens (see `storyboards/complete.html`)

1. **First launch:** 1.1 Welcome · 1.2 Install guide (only when not running standalone) · 1.3 Setup · 1.4 Empty Home
2. **Planning:** 2.1 Plans · 2.2 "+" menu · 2.3 Builder · 2.4 Keypad (reps, "–" = range) · 2.5–2.6 Picker · 2.7 Edit mode · 2.8 Hold menu · 2.9 Folder options · 2.10 Move to folder · 2.11 Routine screen
3. **Starting:** 3.1 Home · 3.2 Home with a workout running · 3.3 Resume bar on other tabs (**proposed, not decided**)
4. **During:** 4.1 Logging · 4.2 Keypad · 4.3 Drops · 4.4 Swipes · 4.5 Hold menu · 4.6 Exercise menu · 4.7 Bodyweight · 4.8–4.10 Look-back sheet · 4.11 First exercise · 4.12–4.13 All exercises · 4.14 Add mid-workout
5. **Finishing:** 5.1 Unticked sets · 5.2 Update routine? · 5.3 Summary · 5.4 Workout options
6. **History:** 6.1 Month · 6.2 6M · 6.3 Year · 6.4 All · 6.5 List · 6.6 Workout detail · 6.7 Edit past workout · 6.8 Empty
7. **Progress:** 7.1 Overview · 7.2 Est. 1RM · 7.3 Top set · 7.4 Records · 7.5 Pinned lifts · 7.6 Empty
8. **Exercises:** 8.1 Library · 8.2 Exercise screen · 8.3 New/edit (type) · 8.4 Link variations
9. **Settings & data:** 9.1 Settings · 9.2 Picker · 9.3 Backup · 9.4 Restore · 9.5 Import · 9.6 Delete all

**Keypad (4.2):** a 4×4 grid. Left three columns: `1 2 3 / 4 5 6 / 7 8 9 / − 0 .`. Right column: close · + · − · backspace. ± steps weight by `weightStep` and reps by 1. A lbs/reps toggle sits on top. In reps mode the bottom-left key is the range dash and the decimal is disabled. During a workout the keypad opens under the Prev / Next bar (the bar stays visible, 44 px tall), and tapping the blank space under + Drop / + Set closes it.

## 7. Build order

Each phase should be usable on a phone before starting the next.

1. **Skeleton:** Vite + React + TS + Tailwind + PWA. Tokens and dark/light theme, tab bar, routing. Installs to the iPhone Home Screen and works offline.
2. **Data layer:** Dexie schema (§3), a seed library of about 150 exercises, settings store, and unit helpers. Tests for unit conversion.
3. **Logging (section 4):** start a blank workout, the set table, keypad, ✓, + Set / + Drop, swipes, hold menu, Prev/Next, All exercises, the picker, and persistence across reloads.
4. **Finishing (section 5)** plus the workout detail and editing (6.6–6.7).
5. **Plans (section 2):** folders, the builder, the routine screen, starting from a routine, the Previous column and the D badge.
6. **Home (3.1–3.2)** with the next-up logic.
7. **History (6.1–6.5)** with ranges and the toggle.
8. **Progress (7.x)** and the look-back sheet (4.8–4.10): 1RM, records, charts. Tests for 1RM and records.
9. **Exercises (section 8)** and **Settings & data (section 9)**, including backup/restore/import. Tests for the import parser.
10. **First launch (section 1)**, empty states, light-mode pass, polish.

## 8. Design tokens & principles

See the "Design principles" section at the bottom of `storyboards/complete.html`. In short:

- **Colors.** Dark: bg `#000`, surface `#161616`, divider `#1F1F1F`, text 2 `#8E8E8E`, text `#FFF`. Light: `#FFF / #F5F5F5 / #E5E5E5 / #6B6B6B / #000`.
- **Meaning colors.** Accent `#2E8BFF` (actions, done) · Tip `#2EE66B` (up, records, live) · Warning `#FF8C1A` (drops, backup due) · Caution `#FF3B3B` (delete, down).
- **Type.** System font with tabular numbers. Sizes: 34/28 titles, 22/20 exercise names, 17/15 rows, 12–13 meta, 10 caps labels.
- **Layout.** Flat rows with hairline dividers, no cards, no shadows. 16 px edges, 8 px grid, 44 px minimum tap target.
- **Top bar.** Cancel/Back on the left, Save/Done on the right. Sheets are for options; alerts are only for confirming data loss. Alerts look like iOS alerts: centered, 270 wide, hairline-separated buttons, two short actions side by side (the way out on the left).
- **Gestures** are shortcuts only. Everything they do must also be reachable from a visible control.

- **Logo.** `brand/logos/opengym-logo-dark.svg` (light version alongside): a thick grey bar running off the left edge, a collar, then two equal 45s (the second centered) and a smaller plate, all plates blue (#2E8BFF), short overhang on the right, on black.
- **Icons.** Only the tab bar uses the new icons: the **solid** set in `brand/nav/solid/`. In-app controls keep the storyboard glyphs (▶, +, ✓, •••, ≡, W / D letters); ignore `brand/icons/`.

## 9. Open questions

- Resume bar on non-Home tabs during a workout (3.3)?
- Streak definition: weeks in a row with at least N workouts. What is N?
- Allow two workouts in one day? (The data model already allows it.)

Resolved for §10:
- Supersets auto-jump to the partner after ✓ (a warm-up or drop stays put). Up to **3** exercises per group.
- Cardio distance follows units (lbs → mi, kg → km). Each cardio exercise can switch to meters instead (the Rower preset does).
- The plate pad starts on 123. Switching to Plates on an exercise is remembered for that exercise.

## 10. Extra features (build after the core phases)

Screens: `optional/final-features.html`. It supersedes `optional/optional-features.html`, `optional/plate-pad-and-supersets.html` and `optional/cardio.html`. Gym profiles, intervals, in-app cardio timers, the warm-up ramp and routine sharing are **not** planned.

**Keypad header (A1–A2).** Applies to the core keypad too:
- Left: `123 | Plates` mode tabs, with the "Bar 45 ▾" picker beside them on Plates. On a reps box this becomes a label instead, because plates only apply to weight.
- Right: field tabs (`lbs | reps`, or the cardio columns), then **one** blue button, on Plates too. On any box except the last in the row it reads **→ Next** and moves to the next box. On the last box it reads **✓ Done**, which completes the set and jumps to the next set's first box. Same position, so the thumb never moves.

**Plate pad (A3–A5).**
- The bar drawing is on the left, showing the right half of a barbell like the logo. The total and "x per side" sit top right, with a 2 × 3 grid of plate buttons (45 / 35 / 25 / 10 / 5 / 2.5) below. Each button shows how many are loaded per side. Bottom row: Undo / Clear / Done.
- Tapping a plate button adds that plate to **each** side, up to **10 plates a side** (then the buttons dim and "Max 10 / side" shows). Tapping a plate on the drawing removes it. Total = bar + 2 × plates.
- When the stack doesn't fit, it slides left and a ‹ hint appears, so the outermost plates always stay visible.
- "Bar 45 ▾" picks Barbell 45 / Light 35 / EZ 25 / Trap 60 / Custom / No bar (machine). The choice is remembered per exercise.
- The panel is the same height as the number keypad.

**Supersets (B1–B6).**
- Data: add `RoutineExercise.supersetGroup` and `WorkoutExercise.supersetGroup` (a letter). Exercises sharing a group are a superset.
- Create one with "•••" → "Superset with…", or by dragging an exercise into the bracket. Unlink the same way.
- Logging: the group shares one screen with tags A1 / A2. After ✓ the app jumps to the same set number of the partner exercise (no banner); finished partners fold into one line, and a finished exercise's tag turns into ✓. If set counts differ, the extra sets just continue on their own.
- Everywhere else (exercise list, routine screen, history) the group shows as one blue bracket and moves as one block.

**Cardio (C1–C6, D1–D4).**
- New exercise type `cardio`. Data: `Exercise.cardioColumns`, which is `time` plus up to 2 of `distance | speed | incline | level | calories | steps | split500 | pace | avgSpeed`. Split, pace and average speed are calculated from time and distance, never entered. `Exercise.distanceUnit` is `auto` (mi / km by units) or `m`; `Exercise.isRun` marks runs for distance records. Stored values are SI: seconds, meters, km/h. `WorkoutSet` gets the fields `durationSec`, `distance`, `speed`, `incline`, `level`, `calories` and `steps`.
- Logging uses the set table with no Previous column. Columns: `# | TIME | col2 | col3 | ✓`. Last session appears as one line under the exercise name. Empty boxes show last time's values in grey, and ✓ accepts them. Rows are "segments" (the button is "+ Segment"). A Σ row (total time and distance, average speed) appears **only with 2 or more segments**, both while logging and in History.
- Keypad: the field tabs follow the exercise's columns. In time mode, ":" is the bottom-left key and ± steps by 1 minute.
- Presets: Treadmill (time · mi · /mi pace, worked out from time ÷ distance, like Run/walk outside), Bike (time · mi · level), Rower (time · m · /500m), Stair climber (time · steps), Elliptical, Run/walk outside, Jump rope (time only), Generic (time only). They're found under a "Cardio" filter in the normal picker.
- Finish summary: cardio gets its own small section listing what you did, plus a "Cardio this week: X min · Y mi" line. There's no faster/slower comparison, and it does **not** count toward "Stronger on X of Y". Cardio minutes are added to the stats row.
- Progress tracks **amount, not speed**. A Lifts / Cardio switch at the top. The cardio graph shows Minutes / Miles / Sessions per week with ranges **4W · 3M · 6M · 1Y · All**, hiding any range there isn't enough history for. A dashed line shows the average. Per-machine rows show totals (time, distance, sessions) for the range. Machine detail shows the same weekly chart for one machine plus recent sessions. There are no speed charts and no "best" per machine.
- Distance records (opened from "Records ›"): fastest **1 mile, 5K, 10K, half marathon and marathon**. They come from run-type exercises (outside or treadmill) where one segment covered at least that distance, with the time scaled to the exact distance. Distances not reached yet show "—", plus your longest so far.
- History: cardio is shown as a mini table with the same columns plus a Σ row.
- Cardio is excluded from est. 1RM, records and lift stats.
- Backups carry schema version 2 (cardio fields, superset groups); version 1 backups still restore. CSV export adds Seconds, Distance (m), Speed (km/h), Incline, Level, Calories, Steps and Superset columns.

## 11. Plan schedules

Screens: `optional/plan-schedules.html` (A1–A3, B1–B4, C1–C3). A folder can have a schedule, which makes it a plan. Folders without one work exactly as before.

**Data.** `Folder.schedule?: { versions, overrides, skipped? }` and `Routine.code?` (1–3 letters).
- `versions`: each is `{ from: dayKey, kind: 'none'|'cycle'|'weekly', days, anchor?, onMiss }`. Weekly `days` has 7 slots indexed by weekday (0 = Sunday); cycle `days` are in order and `anchor` is a day that was day 1. A slot is a routine id or `null` (rest). Saving adds a version from today (replacing one that already starts today), so past days keep the plan they had, and one-off changes from today on are dropped.
- `overrides`: day key → `{ routineId, moved?, pair? }`, for single-day changes. `pair` links the two days of a move or swap so "Back to plan" undoes both.
- `skipped`: missed days the user chose to skip, which hides the note.

**Rules** (`src/lib/schedule.ts`):
- Any finished workout on a planned day counts as doing it. A workout on a rest day is an extra.
- Missed days: cycles default to **Wait for me** (the cycle pauses; there are no misses and no note) or **Stick to dates**. Weekly splits default to **Skip it** or **Move to rest day** (a missed workout slides into the next plain rest day of the same week). Today and later assume you train as planned.
- A deleted routine's slots count as rest.
- Strip labels come from the routine name (Push A → PA, then Pull A → PL on a clash); `Routine.code` overrides them.
- One workout per day. The "Two workouts this day" toggle (B4) is not built.

**Screens.**
- Plans (A1): a scheduled folder shows this week's strip under its header, and each routine says when it's due. Tapping a folder's name opens the plan screen (A2); the chevron still folds it.
- Home (A3): with a scheduled active folder, Home lists today, then upcoming days up to 3 workouts, with rest runs collapsed into one line. The day strip stays plain. C3 adds a note on the day after a miss ("Do it today" / "Skip it"). The note only appears when the same skip-type schedule was in force yesterday and today.
- C2 (long-press a day on Home, the plan screen or the calendar; tapping a day in the calendar does the same): do a different routine, rest (the workout goes to the next rest day, or waits in a Wait cycle), move to one of the next 7 days, swap with the next workout day, or go back to plan. Wait cycles don't offer move or swap.
- "+ New routine for this day" (B4) opens the builder and hands the new routine back to the schedule editor.
- Backups carry the schedule inside the folder record (no schema version change). "Import routines" remaps schedule routine ids to the imported copies.

