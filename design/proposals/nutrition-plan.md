# Food tab: implementation plan

How the nutrition mockups in `design/proposals/nutrition.html` (Food v5) become a working Food tab. Screen IDs (A1, F1, S3, T2, C1, D5 …) are the board's. This doc covers what the tab does, how it behaves where the mockups leave a choice open, the data model, and the build order. No code has been written yet. The questions in §7 are optional: every one has a default in this doc, so the build can start without answers.

The mockups decide layout and styling; `design/DESIGN.md` decides the components. This doc decides behavior. Where they disagree, fix the one that's wrong so they match.

## 1. What this changes in the spec

- **SPEC §1 lists "diet plans" as out of scope, and ROADMAP "Not doing" lists "diet".** The Food tab is calorie and macro *logging* with targets. It still has no meal plans, no coaching, no recipes and no AI photo logging. SPEC §1 changes to "meal plans or diet coaching", and "diet" comes off ROADMAP "Not doing".
- **SPEC §5 tab bar** becomes Home · Calendar · **Food** · Progress · Settings. Five tabs fit because Plans and History are already merged into Calendar.
- **First network call.** Today the app never talks to a server. Food search and barcode lookups use Open Food Facts when online (§3.8). Everything you log is stored on the phone and works offline afterwards. SPEC §1's "no server" stays true: there is no OpenGym server and no account.
- A new **SPEC §14 Nutrition** holds the rules in §3 of this doc once they're built, and the data model goes into SPEC §3.

## 2. Features

Everything the v5 board shows, plus the pieces it implies but doesn't draw (marked *not drawn*).

**Food tab and day page (A1–A4)**
1. A fifth tab, Food, with its own solid tab icon (`design/brand/tabs/food.svg`, matching `icons.tsx`).
2. Large title "Food" with the date, and a + bar button that adds food to the meal for the time of day.
3. Week strip with a small calorie ring per day; an orange dot under days that went over.
4. Calorie target bar ("1,344 / 2,700 kcal · 1,356 left", or "160 over" in orange).
5. Three labeled macro bars: protein (blue), carbs (cyan), fat (gold), each "x / target g". Protein reaching its target gets a check, never orange.
6. Four meal folders: Breakfast, Lunch, Dinner, Snacks. A folder row shows its count and kcal total, opens and closes on tap, and the meal for the time of day opens on its own.
7. Logged foods as dense two-line rows under their meal; every open or empty meal ends in "+ Add".
8. Past days (A4): pick a day in the strip, or step with ‹ › in the header. All meals closed, so the folders read as a summary.

**Week (A5)**
9. Avg / day, On target (x of y), Protein hit (x of y).
10. Stacked macro bars per day with the dashed target line and orange dots on days over.
11. Averages table: protein, carbs and fat against target.

**Home (A6)**
12. A Food block under Next up: the target bar, inline macros, "+ Log food". Tapping the block opens the Food tab.

**Setup (S1–S4)**
13. About you: sex, age, height, weight, and daily activity in four step-count bands.
14. Goal: Lose fat, Maintain, Build muscle, or Just log (no target). Optional goal weight.
15. Pace: four rates with kcal / day and the date you'd reach the goal weight. One is marked Suggested, the fastest carries a warning.
16. Result: the daily target in Hero size, the math (maintenance, adjustment, target), the macro ring and the split with a Change button.

**Targets (T1–T3)**
17. Calories row (editable) with "Recalculate" to rerun setup.
18. The L ring with the active diet's name and split, and grams per macro.
19. A plain list of diets with small rings: Lifter (default), Balanced, High protein, Low carb, Keto, Endurance, Custom. The active one sits first with a blue check.
20. Custom: steppers under each macro. + adds 2% and takes 1% from each of the other two; − does the opposite.

**Adding food (C1–C3, F1)**
21. Add food screen with the meal picker as the title, search, barcode button, and four shortcut tiles: Scan, Quick add, Meals, New food.
22. Filter chips: Recent, Saved, My foods, Meals.
23. "Usually at dinner" suggestions, then Recent.
24. Result rows with kcal and inline P / C / F, and a + disc that logs in one tap. The disc turns into a check, and the check takes it back off.
25. Amount screen (C2): ring card that updates as you type, Amount and Meal value boxes, the keypad dock with g / serv / oz and ± steps.
26. Food inspector (F1): name, source, ring card, Amount and Meal, full nutrient table with % daily value. Star to favorite, ••• for more.
27. Barcode scanner (C3) with a result sheet and "Wrong food? Fix the numbers".
28. Search Open Food Facts when online; show only your own foods offline.

**Other ways to log (D2–D5)**
29. Quick add: calories plus optional macros and a name (*not drawn in v5*; v1 D2).
30. New food / edit food: a nutrition label as rows, with servings (*not drawn in v5*; v1 D3).
31. Saved meals (D4): a name, the ring card, foods with drag handles, "+ Add food".
32. Meals tab (D5): + logs a whole saved meal into the current meal, ✓ takes it back off, toast with Undo.
33. Copy a day: yesterday's same meal, or all of a past day.

**Editing what you logged** (*not drawn*)
34. Tap a logged food to open it in the inspector: change amount or meal, or delete.
35. Swipe left on a logged food to delete it, with Undo.

**Data**
36. Food tables in backup and restore, and a food log in CSV export.
37. Sample food logs in the test database, and the new screens in the storyboard.

## 3. Behavior decisions

These are my calls where the mockups or earlier threads left something open. §7 lists the ones most worth a second opinion.

### 3.1 Days

- **A food day is the phone's calendar day** (`dayKey`, local midnight). Something eaten at 12:30 am counts toward the new day. Night owls can pick the previous day in the strip before adding.
- **You can log to today and any past day.** Future days are dimmed in the strip and can't be opened. Planning tomorrow's food is meal planning, which stays out of scope.
- The header + and Home's "+ Log food" always log to **today**. A meal's own "+ Add" logs to the day being shown.
- The strip shows the current week (starting on `settings.weekStart`). Swiping it, or ‹ › in the header, moves a day at a time. Today is one tap away: tapping the Food tab while it's already open jumps back to today.

### 3.2 Meals and folding

- **Four fixed meals** in v1: Breakfast, Lunch, Dinner, Snacks. No renaming, reordering or extra meals yet (§7 Q5).
- **Meal windows:** Breakfast before 11:00, Lunch 11:00–15:59, Dinner from 16:00. Snacks is never picked automatically. The same windows choose the meal for the header + and for "+ Log food" on Home.
- **Auto-open, today only:** on today's page the meal for the current window is open. A folder you open or close by hand stays that way until the window changes. Then the new window's meal opens, and your other choices are kept. This state lives in memory per day and isn't saved, so a relaunch starts fresh.
- **Past days open with every folder closed** (A4).
- Tapping a folder row only opens or closes it. It never navigates. An empty meal always shows "+ Add", open or closed.
- Foods within a meal are in the order you logged them. No reordering in v1.

### 3.3 Totals, over and under

- **Energy:** protein and carbs count 4 kcal/g and fat 9 kcal/g, but a food's calories are its own label value, not computed from macros. Totals add the logged calories.
- **Left / over:** the target row always shows the plain difference ("1,356 left", "40 over").
- **Orange only past 3%.** Calories or fat or carbs turn orange (number, bar and week dot) when they go more than 3% over target. Just over is still "40 over" in white. This stops a 2,720 day from looking like a failure. Orange always comes with the word "over", never color alone.
- **Protein is a floor:** at or over target it gets a check, and it never turns orange.
- **On target** (week stat): calories between 90% and 103% of target. **Protein hit:** protein at or over target.
- **Empty days don't count.** A past day with nothing logged is left out of averages and out of "x of y". The week's y is the number of days with anything logged, so "4 of 5" means 5 days were logged. An empty past day shows an empty grey ring in the strip.
- **Just log mode** (no target): the day page shows calorie and macro totals with no bars, no "left" and no orange. The week shows averages only.

### 3.4 Targets

- **Maintenance** uses the Mifflin–St Jeor equation × an activity factor: under 5k steps 1.2, 5–8k 1.375, 8–12k 1.55, 12k+ 1.725. Training is not added on top. The S1 question is about the day outside the gym, and these factors already assume a few workouts a week, so adding logged workouts would count them twice. It also keeps the Food tab separate from workouts, as you asked in v2.
- **Pace:** 1 lb a week = 500 kcal a day, so 0.25 / 0.5 / 1 / 1.5 lb give −125 / −250 / −500 / −750. Build muscle offers +125 / +250 / +500 (0.25 / 0.5 / 1 lb a week), with 0.25 suggested. Lose fat suggests 0.5. Maintain skips the pace step.
- **Rounding:** the daily target rounds to the nearest 50 kcal.
- **Safety floor:** the target never goes below the larger of your BMR and 1,200 kcal (women) / 1,500 kcal (men). A pace that would cross it is disabled with a one-line reason. Typing a calorie target by hand on T1 can go lower, with a grey note under it.
- **Goal dates** on S3 are straight-line estimates from today's weight at that pace, and the note says so.
- **Macro split:** calories are the source of truth. Grams come from the split and round to the nearest 5 g. Rounding means the three macros can sum a few kcal off the calorie target; that's fine.
- **Lifter (default):** protein 1 g per lb of current bodyweight, fat 27% of calories, carbs the rest. Its percentages are shown as computed (28 / 45 / 27 for the mockup's 190 lb, 2,700 kcal). If protein alone would exceed 40% of calories (a small calorie target), it caps at 40%.
- **The other presets are fixed percentages:** Balanced 30/40/30, High protein 40/35/25, Low carb 35/25/40, Keto 25/5/70, Endurance 20/55/25.
- **Custom** starts from whatever was active. Steppers move 2% / 1% / 1% as drawn, no macro goes below 5%, and a stepper that would break that is disabled.
- **Picking a diet** on T1 applies right away; Done just closes the screen. The previous split isn't lost: picking it again restores it.
- **Changes apply from today.** Targets are saved as versions with a start day, like plan schedules. Past days keep the target they had, so history never re-judges an old day.
- **Weight changes:** Recalculate reruns setup with your answers filled in. When you save a new weight there, the app also updates Lifter's protein. The app doesn't nag you to weigh in.

### 3.5 Adding food

- **Two ways in, one screen:** a meal's "+ Add" opens C1 with that meal set; the header + opens C1 with the meal for the time of day. The title switches meals.
- **Search order:** your own foods and foods you've logged, ranked by how often you log them, then Open Food Facts results under an "Online" label. Built-in generic foods (§3.8) sit with your foods. With no search text, C1 shows "Usually at <meal>" (up to 3 foods you've logged at that meal at least 3 times in the last 30 days), then Recent (the last 20 distinct foods).
- **The + disc logs right away** with your last amount for that food, else its default serving. The disc becomes a check, a toast says "Added to Lunch · 330 kcal" with Undo, and you stay on C1 to add more. Tapping the check removes that entry. This is the D5 pattern used for every row, so one screen handles adding several foods at once.
- **Tapping the row** (not its disc) opens the amount screen (C2). Log adds it and returns to C1 with that row checked.
- **C1's top-left reads Cancel until something is added, then Done.** Either closes back to the day page. Nothing is lost on Cancel because each add saves immediately.
- **Amount keypad:** the field switch picks g / serv / oz (ml / serv / fl oz for liquids). ± steps 10 g, ¼ serving or 0.5 oz. The ring card updates with every key. "½" is a key for half servings. An amount of 0 disables Log.
- **Default unit:** the food's serving when it has one, else grams. The unit you pick for a food is remembered with its last amount.
- **The Meal box** on C2 and F1 opens a small sheet with the four meals.

### 3.6 Editing logged food

- Tapping a logged food opens the inspector (F1) in edit mode: Amount and Meal are editable, Save top right, and ••• has Delete. Changing the meal moves the entry.
- Swiping left on a logged food deletes it with a 5 s Undo, the same as sets. The inspector's Delete is the visible alternative.
- **Entries keep a snapshot of their nutrients.** Editing a food in your library later changes future logs only; days already logged don't move. This follows "never lose logged data".

### 3.7 Your foods, quick add, saved meals

- **Library:** a food enters your library when you create it, log it, star it or scan it. Search results from Open Food Facts that you only look at are not stored.
- **Star** (F1) marks a favorite; the Saved chip lists them.
- **••• on a food:** Edit (your own foods), "Make a copy to edit" (Open Food Facts and built-in foods, which stay read-only so a re-scan finds the same numbers), and Remove from my foods. Removing never touches logged days.
- **"Wrong food? Fix the numbers"** on a scan result opens New food filled in from the scan, with the barcode attached. Your copy wins over Open Food Facts for that barcode from then on.
- **New food** asks for name, optional brand, serving (label + grams), calories, protein, carbs, fat; fiber, sugar, saturated fat, sodium and the rest are optional under "More nutrients". Values are typed per serving (how labels print them) and stored per 100 g. A quiet note appears when the calories are more than 15% off 4·P + 4·C + 9·F, but it never blocks saving.
- **Quick add** is calories plus optional P / C / F and an optional name, logged straight into the meal. It shows as "Quick add" (or its name) in the day and never enters the library.
- **Saved meals** are built like routines (D4). The + in the Meals tab logs each food as its own entry, tagged with the saved meal so the check can take the whole group back off. After that they're ordinary entries you can edit one by one, the same idea as "Just this time".
- **Making a saved meal:** "New meal" at the bottom of the Meals tab, or "Save as meal" from a folder row's long-press menu (Save as meal · Copy to today · Clear meal), which also needs a visible way in: the same three items in a ••• on the open folder's last row.
- **Copy a day:** "Yesterday's lunch" adds yesterday's entries for the meal being added to. "All of yesterday" opens a list of recent logged days; picking one copies every entry into the same meals of the target day, with one Undo.

### 3.8 Where foods come from

- **Built-in generic foods.** A small seed of about 300 common whole foods (chicken breast, rice, oats, eggs, banana, olive oil …) from USDA FoodData Central, which is public domain. It ships in the app bundle like the exercise library (`src/db/seedFoods.ts`, ids `fd-<slug>`), so search works on first launch and offline.
- **Open Food Facts** for packaged foods: text search and barcode lookup, no key, open data. Requests carry an app name and nothing about the user. Their search API is rate-limited (about 10 searches a minute), so online search runs only after typing pauses for 500 ms, at 2+ characters, and only when local results are fewer than 8. Barcode lookups are a single product read and aren't affected.
- **Offline:** search shows your foods with a grey "Offline · showing your foods" line. Scanning works offline only for barcodes already in your library; otherwise it offers to type the numbers in (New food with the barcode).
- **A setting:** Settings › Food › "Look up foods online", on by default, explained in one line in setup. Off means the app never makes a network request.
- **Missing values** show "—", never 0, everywhere (F1 rule).

### 3.9 Barcode scanning

- Camera via `getUserMedia`. Decoding uses the browser's `BarcodeDetector` where it exists (Chrome on Android) and a lazily loaded ZXing WASM decoder elsewhere, including iOS Safari. The decoder only downloads the first time you scan, and is then cached for offline.
- EAN-13, EAN-8, UPC-A, UPC-E. A match logs nothing until you tap Log on the sheet.
- Camera denied or unavailable: the scanner shows a number field instead.

### 3.10 Daily values

- % daily value on F1 uses the standard US label values (2,000 kcal: protein 50 g, fat 78 g, carbs 275 g, fiber 28 g, sodium 2,300 mg …). They match the package label, and personal targets are already on the day page. Sugar has no DV and shows "—".

### 3.11 Home block (A6)

- Shows only once Food is set up (setup finished or Just log picked), under Next up and above the rest of Home.
- Today only. In Just log mode it shows the kcal total and inline macros, without the bar.
- Tapping the block opens the Food tab. "+ Log food" opens C1 for the meal of the moment.

### 3.12 First launch of the Food tab

- Before setup, the Food tab is an empty state: one line on what it does, a filled "Set targets" button (S1–S4) and a "Just log" text button. App onboarding doesn't change; nutrition setup happens the first time you open Food.
- Weight, height and units follow `settings.units` (lb + ft/in, or kg + cm). Weight is stored in lb and height in inches, like every other weight in the app.

### 3.13 Week view (A5)

- Mon–Sun or Sun–Sat per `settings.weekStart`, with ‹ › for other weeks. Opens from a "This week" row under Snacks on the day page (no Day / Week switch at the top). §7 Q1 asks whether you had something else in mind.

## 4. Data model

Dexie schema version 3; backup `schemaVersion` 4. Every record has `id`, `createdAt`, `updatedAt` as usual.

```ts
type MealId = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

/** Per 100 g (or 100 ml). Missing = unknown, shown as "—". */
interface Nutrients {
  kcal: number; p: number; c: number; f: number;
  fiber?: number; sugar?: number; satFat?: number; transFat?: number;
  cholesterolMg?: number; sodiumMg?: number; potassiumMg?: number;
}

Food        { name, brand?, barcode?, source: 'generic'|'off'|'custom', offCode?,
              basis: 'g'|'ml', per100: Nutrients,
              servings: { label: string; grams: number }[], defaultServing?: number,
              favorite?: boolean, last?: { grams: number; unit: 'g'|'oz'|'serv'; serving?: number },
              copiedFrom?: ID, deletedAt? }
FoodEntry   { day: dayKey, meal: MealId, order, loggedAt,
              foodId?, name, brand?, grams?, unit?, serving?,            // absent for quick add
              totals: Nutrients,                                         // snapshot for this amount
              quick?: boolean, savedMealId?, batchId? }                  // batchId groups a saved meal or a copied day for one Undo
SavedMeal   { name, order, items: { foodId: ID; grams: number; unit; serving? }[], deletedAt? }
FoodTarget  { from: dayKey, mode: 'target'|'log',
              kcal?, diet: 'lifter'|'balanced'|'highProtein'|'lowCarb'|'keto'|'endurance'|'custom',
              pct: [p, c, f], grams: [p, c, f] }                         // a version; the latest with from ≤ day applies
Settings.food?  { sex?: 'm'|'f', birthYear?, heightIn?, weightLb?, activity?: 1|2|3|4,
                  goal?: 'lose'|'maintain'|'gain'|'log', paceLb?, goalWeightLb?,
                  customPct?: [p, c, f], online: boolean, setUp: boolean }
```

Indexes: `foods: 'id, barcode, name, source'`, `foodEntries: 'id, day, foodId, [day+meal], batchId'`, `savedMeals: 'id, order'`, `foodTargets: 'id, from'`.

Notes:
- Age is stored as a birth year so it doesn't go stale.
- Recents, "Usually at", log counts for search ranking and week stats are derived from `foodEntries`, never stored.
- Body profile lives in Settings, not a bodyweight table. A bodyweight log is the ROADMAP §6 decision and stays separate (§7 Q8).

## 5. Implementation plan

One commit per phase. `npm run typecheck`, `npm test`, `npm run lint:design` and `npm run build` pass after each. New pure logic goes in `src/lib/nutrition/` with Vitest tests; new screens get a catalog entry and scene in `scripts/screens.ts` under a new section **10 Food**.

### Phase 0: docs and gaps

- SPEC §1, §3, §5 edits from §1 of this doc; ROADMAP "Not doing" edit. SPEC §14 is written at the end (Phase 8) from what shipped.
- Draw what the board is missing, in the v5 style, before their phases: Quick add (D2), New / edit food (D3), the Food empty state, the inspector in edit mode, and the meal sheet. These are small and can be one board, `design/proposals/nutrition-gaps.html`.
- Tab icon `design/brand/tabs/food.svg` and `FoodIcon` in `icons.tsx`.

### Phase 1: data and pure logic

- `src/db/types.ts`, `src/db/db.ts` (version 3: `foods`, `foodEntries`, `savedMeals`, `foodTargets`), `TABLE_NAMES`, `DEFAULT_SETTINGS`.
- `src/db/seedFoods.ts` (generic foods) and seeding in `src/db/seed.ts`, versioned like `librarySeed`.
- `src/lib/nutrition/`, each with a test:
  - `energy.ts`: BMR, activity factors, maintenance, pace → kcal, floor, rounding, goal-date estimate.
  - `split.ts`: presets, Lifter's per-lb protein with the 40% cap, Custom ± with the 5% floor, pct → grams.
  - `amounts.ts`: g / oz / serving conversion, per-100 → totals, ± steps.
  - `totals.ts`: day and meal sums, left / over, the 3% orange rule, protein check, on-target and protein-hit, week averages skipping empty days.
  - `meals.ts`: meal windows, meal for a time, auto-open state across a window change.
  - `targets.ts`: pick the target version for a day.
  - `foodSearch.ts`: local ranking (match quality, log count, favorites), "Usually at", recents, merge with online results without duplicates (barcode / offCode).
  - `label.ts`: per-serving ↔ per-100 conversion, the 4·P + 4·C + 9·F check, % daily value.
- `src/data/food.ts`: reads and writes (log, edit, move, delete with undo, batch add and remove, copy day, saved meals, targets versions, library add / star / remove).

### Phase 2: tab and day page (A1–A4)

- `TabLayout.tsx` (fifth tab), `App.tsx` routes: `/food`, `/food/day/:day`.
- `src/screens/food/FoodDay.tsx`: header, week strip, target bar, macro bars, meal folders with auto-open, entry rows, swipe delete, "This week" row, empty state.
- Components reused from `ui/`: `LargeHeader`, `TargetBar`, `LabeledBar`, `Ring`, `FolderChevron` / `FolderLabel`, `RowText`, `AddRow`. A `WeekStrip` and a `MacroBars` likely join `ui/` (they'll be used again on Home); add them to the gallery (0.1).
- Screens: 10.1 lunchtime, 10.2 evening, 10.3 past day over target, 10.4 empty state.

### Phase 3: setup and targets (S1–S4, T1–T3)

- `src/screens/food/Setup.tsx` (four steps, one route with a step param so Back works), `Targets.tsx`.
- Inline inputs use the keypad dock (`decimal` / `int` modes); height gets ft + in or cm.
- Screens 10.5–10.11.

### Phase 4: add food from your library (C1, C2, F1, editing)

- `AddFood.tsx` (C1: search, tiles, chips, Usually at, Recent, disc add / remove with toasts, Cancel → Done), `FoodAmount.tsx` (C2 with the keypad dock: unit switch, ± steps, ½ key; `src/lib/keypad.ts` gains the ½ key and unit-aware steps), `FoodInspector.tsx` (F1, view and edit modes), meal sheet.
- Works fully offline against generic foods and your library.
- Screens 10.12–10.16.

### Phase 5: your foods, quick add, saved meals, copy a day (D2–D5)

- `FoodForm.tsx` (new / edit / copy, servings), `QuickAdd.tsx`, `SavedMeal.tsx` (D4, dnd-kit like the routine builder), Meals chip content (D5), Copy a day list, folder long-press menu and its ••• alternative.
- Screens 10.17–10.22.

### Phase 6: online foods and scanning (C3)

- `src/data/openFoodFacts.ts`: search and product lookup, mapping to `Food` (per-100 nutrients, servings from `serving_size`), timeouts, offline detection, debounce, the "fewer than 8 local results" rule.
- `Scanner.tsx`: camera, `BarcodeDetector` or lazy ZXing WASM, result sheet, number-entry fallback, "Fix the numbers".
- Settings › Food › "Look up foods online"; Workbox runtime caching for the decoder file.
- The screens script uses canned responses so screenshots never hit the network.
- Screens 10.23–10.25.

### Phase 7: week and Home (A5, A6)

- `FoodWeek.tsx` with a stacked-bar chart added to `components/charts.tsx` (the design-system §15 spec: 28 wide, top rounded, dashed target).
- Home Food block in `Home.tsx`.
- Screens 10.26, and 3.x updates for Home.

### Phase 8: data, sample data, docs

- `backup.ts`: schemaVersion 4, new tables in backup and restore (older backups restore with empty food tables), the restore confirmation also counts logged days. A food log CSV in export: date, meal, food, brand, amount, kcal, protein, carbs, fat.
- `src/lib/sampleData.ts`: a few weeks of food logs for the test database, including an over-target day.
- `fake-indexeddb` round-trip test for the food tables (ROADMAP §4.2 asks for this anyway).
- SPEC §14 Nutrition, SPEC §3 data model, `design/README.md` row, `CLAUDE.md` layout line for `src/screens/food/` and `src/lib/nutrition/`, `npm run screens`.

### Size and order

Phases 1–4 make a usable Food tab with no network: about half the work. 5 and 6 add the convenience and packaged foods; 7 and 8 finish it. Phase 6 is the riskiest (iOS camera in a Home Screen PWA, decoder size, Open Food Facts data quality), which is why it comes after the offline core works.

## 6. Risks

- **Open Food Facts data quality** varies: missing macros, odd serving sizes, duplicates. Missing values stay "—", "Fix the numbers" is always one tap away, and your copy wins from then on.
- **iOS camera in a standalone PWA** has had permission quirks across iOS versions. The typed-number fallback means scanning failing never blocks logging.
- **Bundle size:** the generic food seed (~300 foods) is small; the ZXing WASM decoder (~1 MB) loads only on first scan.
- **Storage:** a year of daily logging is roughly 2,000 entries, which is tiny for IndexedDB.

## 7. Follow-up questions (optional)

Each has a default above; answer only the ones you want changed.

1. **How should the week view open?** Default: a "This week" row under Snacks on the day page. Alternatives: tapping the week strip a second time, a link in Progress, or a Food view inside Progress.
2. **Should Progress get a Food view** (weekly average calories, protein days hit, a longer chart)? Default: no, the week view is enough for v1.
3. **Midnight or a later day cut-off?** Default: the day ends at midnight. A "day ends at 3 am" setting would help late eaters.
4. **Logging to future days?** Default: not allowed (that's meal planning).
5. **Fixed four meals?** Default: Breakfast, Lunch, Dinner, Snacks, not editable in v1. Later: rename, hide, reorder, or add one (e.g. Pre-workout).
6. **Are the meal windows right?** Default: Breakfast before 11:00, Lunch until 4:00 pm, Dinner after.
7. **Does the 3% grace before orange feel right?** Default: just over shows "40 over" in white; orange starts past 3%. The alternative is orange the moment you pass the target.
8. **Bodyweight log?** Setup asks your weight once. A small weigh-in log (and a line on the week view) would keep protein and targets current, but it's a new thing to log (ROADMAP §6). Default: not in v1.
9. **Adjust targets on training days?** You dropped the lifting-day target in v2. Default: one target every day, and nothing on the Food tab links to workouts except the dot under trained days in the strip.
10. **Online lookups on by default?** Default: on, with a setting to turn them off. Off by default would keep the app's no-network promise strict, at the cost of no packaged foods until you turn it on.
11. **Ship a built-in generic food list?** Default: yes, about 300 USDA foods, so search works on day one and offline.
12. **% daily value: label values or your targets?** Default: standard label values (protein 50 g = 100%), which is why the mockup shows chicken at 124% protein. Using your own targets would show 33% for the same food.
13. **Should editing a food change days already logged?** Default: no, entries keep the numbers they were logged with.
14. **Is the safety floor right?** Default: setup won't suggest below your BMR or 1,200 / 1,500 kcal; you can still type a lower number on Targets.
15. **Water, fiber or micronutrient targets?** Default: none; fiber and the rest show on the inspector only.
