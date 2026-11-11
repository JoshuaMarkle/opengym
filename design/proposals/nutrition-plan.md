# Food tab: implementation plan

How the nutrition mockups in `design/proposals/nutrition.html` (Food v5) become a working Food tab. Screen IDs (A1, F1, S3, T2, C1, D5 …) are the board's. This doc covers what the tab does, how it behaves where the mockups leave a choice open, the data model, and the build order. **Built** (Nov 2026): the rules now live in SPEC §14 and the screens are 10.1–10.32 in the storyboard; §9 records how the build went. Revision 2 (Nov 10) folds in your answers to the first round of questions (§7) and adds full micronutrient tracking (§3.14), which changes the food database and the data model. §8 has a few new optional questions; each has a default, so the build can start without answers.

The mockups decide layout and styling; `design/DESIGN.md` decides the components. This doc decides behavior. Where they disagree, fix the one that's wrong so they match.

## 1. What this changes in the spec

- **SPEC §1 lists "diet plans" as out of scope, and ROADMAP "Not doing" lists "diet".** The Food tab is calorie and macro *logging* with targets. It still has no meal plans, no coaching, no recipes and no AI photo logging. SPEC §1 changes to "meal plans or diet coaching", and "diet" comes off ROADMAP "Not doing".
- **SPEC §5 tab bar** becomes Home · Calendar · **Food** · Progress · Settings. Five tabs fit because Plans and History are already merged into Calendar.
- **Full nutrition, not just calories.** The tab tracks every macro and the common micronutrients (vitamins, minerals, fatty acids, fiber, sugars) against personal targets, the way Cronometer does (§3.14).
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
26. Food inspector (F1): name, source, ring card, Amount and Meal, the full nutrient table with % of your own targets. Star to favorite, ••• for more.
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

**Micronutrients** (*not drawn*; §3.14)
36. Day nutrients screen: every tracked nutrient for the day, grouped (General, Carbohydrates, Lipids, Protein, Vitamins, Minerals), each with amount / target, a thin bar and %.
37. Personal nutrient targets from your sex and age (the US Dietary Reference Intakes), with upper limits, and an override per nutrient.
38. A "missing data" mark on any total that leaves out foods with no value for it, listing those foods.
39. "Fill in missing nutrients" for packaged and custom foods: borrow the missing vitamins and minerals from a similar built-in food, marked as estimated.
40. A built-in food database with full micronutrient data (USDA, about 13,000 foods), working offline.

**Data**
41. Food tables in backup and restore, and a food log in CSV export (with every nutrient).
42. Sample food logs in the test database, and the new screens in the storyboard.

## 3. Behavior decisions

These are my calls where the mockups or earlier threads left something open. §7 records what you decided after the first draft.

### 3.1 Days

- **A food day runs 3:00 am to 2:59 am.** Something eaten at 1:30 am counts toward the day before, so a late snack lands on the night you ate it. The Food tab, the week strip and Home all use this food day (`foodDayKey(ts) = dayKey(ts − 3 h)`); the rest of the app keeps midnight.
- **You can log to any day: past, today or future.** Future days open like any other. Food logged ahead shows normally, but a future day doesn't count in week stats until it arrives, and its strip ring stays grey. The app never suggests what to eat; that's still out of scope.
- The header + and Home's "+ Log food" always log to **today** (the food day). A meal's own "+ Add" logs to the day being shown.
- The strip shows the current week (starting on `settings.weekStart`). Swiping it, or ‹ › in the header, moves a day at a time. Today is one tap away: tapping the Food tab while it's already open jumps back to today.

### 3.2 Meals and folding

- **Four fixed meals:** Breakfast, Lunch, Dinner, Snacks. They can't be renamed, reordered or added to.
- **Meal windows:** Breakfast 3:00–10:59, Lunch 11:00–15:59, Dinner 16:00 until the 3:00 am cut-off. Snacks is never picked automatically. The same windows choose the meal for the header + and for "+ Log food" on Home.
- **Auto-open, today only:** on today's page the meal for the current window is open. A folder you open or close by hand stays that way until the window changes. Then the new window's meal opens, and your other choices are kept. This state lives in memory per day and isn't saved, so a relaunch starts fresh.
- **Past and future days open with every folder closed** (A4).
- Tapping a folder row only opens or closes it. It never navigates. An empty meal always shows "+ Add", open or closed.
- Foods within a meal are in the order you logged them. No reordering in v1.

### 3.3 Totals, over and under

- **Energy:** protein and carbs count 4 kcal/g and fat 9 kcal/g, but a food's calories are its own label value, not computed from macros. Totals add the logged calories.
- **Left / over:** the target row always shows the plain difference ("1,356 left", "40 over").
- **Orange only past 3%.** Calories or fat or carbs turn orange (number, bar and week dot) when they go more than 3% over target. Just over is still "40 over" in white. This stops a 2,720 day from looking like a failure. Orange always comes with the word "over", never color alone.
- **Protein is a floor:** at or over target it gets a check, and it never turns orange.
- **On target** (week stat): calories between 90% and 103% of target. **Protein hit:** protein at or over target.
- **Empty days don't count.** A past day with nothing logged (and any future day) is left out of averages and out of "x of y". The week's y is the number of days with anything logged, so "4 of 5" means 5 days were logged. An empty past day shows an empty grey ring in the strip.
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
- **Search order:** your own foods and foods you've logged first, ranked by how often you log them; then the built-in USDA foods (§3.8), short names first; then Open Food Facts results under an "Online" label. With no search text, C1 shows "Usually at <meal>" (up to 3 foods you've logged at that meal at least 3 times in the last 30 days), then Recent (the last 20 distinct foods).
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

- **Built-in food database, with micronutrients.** Built from USDA FoodData Central, which is public domain and is where Cronometer's whole-food data comes from too:
  - **SR Legacy** (about 7,800 basic foods: meats, grains, produce, dairy, oils), with complete vitamin and mineral data.
  - **FNDDS** (about 5,400 foods "as eaten": dishes, sandwiches, cereals with milk), with all 65 of its nutrients.
  - **Foundation Foods** replace their SR Legacy twin where USDA has newer analysis.
  - A build script (`scripts/foods.ts`) turns USDA's CSV downloads into one compact file (`public/foods/usda-<release>.json`, roughly 1 MB gzipped), with only the nutrients in §3.14 and USDA's household portions ("1 cup, chopped = 160 g") as servings.
  - USDA names read like "Chicken, broilers or fryers, breast, meat only, cooked, roasted". The script keeps that as the detail line and gives the most-logged ~1,000 foods a short hand-written name ("Chicken breast, roasted"), from a list kept in the repo.
  - The file isn't in the main bundle. The first time Food opens, it downloads once, goes into IndexedDB (`foods`, `source: 'usda'`) and is cached by the service worker, so search works offline from then on. A new release replaces the USDA rows but never touches your foods or anything logged.
- **Open Food Facts** for packaged foods: text search and barcode lookup, no key, open data. Requests carry an app name and nothing about the user. Open Food Facts has macros for most products but micronutrients only when the label lists them (§3.14 covers filling the gaps). Their search API is rate-limited (about 10 searches a minute), so online search runs only after typing pauses for 500 ms, at 2+ characters, and only when local results are fewer than 8. Barcode lookups are a single product read and aren't affected.
- **Offline:** search shows your foods with a grey "Offline · showing your foods" line. Scanning works offline only for barcodes already in your library; otherwise it offers to type the numbers in (New food with the barcode).
- **A setting:** Settings › Food › "Look up foods online", on by default, explained in one line in setup. Off means no Open Food Facts requests; the built-in database still works.
- **Missing values** show "—", never 0, everywhere (F1 rule).

### 3.9 Barcode scanning

- Camera via `getUserMedia`. Decoding uses the browser's `BarcodeDetector` where it exists (Chrome on Android) and a lazily loaded ZXing WASM decoder elsewhere, including iOS Safari. The decoder only downloads the first time you scan, and is then cached for offline.
- EAN-13, EAN-8, UPC-A, UPC-E. A match logs nothing until you tap Log on the sheet.
- Camera denied or unavailable: the scanner shows a number field instead.

### 3.10 Daily values

- The % column on F1, C2 and the day nutrients screen is **% of your own daily target**, headed "% of your target". Calories and macros use your Food targets (chicken's 62 g protein is 33% of 190 g). Every other nutrient uses its target from §3.14.
- In Just log mode calories and macros have no target, so their % shows "—"; micronutrients still have theirs.
- A nutrient with no target (sugars, for example) shows "—".

### 3.11 Home block (A6)

- Shows only once Food is set up (setup finished or Just log picked), under Next up and above the rest of Home.
- Today only. In Just log mode it shows the kcal total and inline macros, without the bar.
- Tapping the block opens the Food tab. "+ Log food" opens C1 for the meal of the moment.

### 3.12 First launch of the Food tab

- Before setup, the Food tab is an empty state: one line on what it does, a filled "Set targets" button (S1–S4) and a "Just log" text button. App onboarding doesn't change; nutrition setup happens the first time you open Food.
- Weight, height and units follow `settings.units` (lb + ft/in, or kg + cm). Weight is stored in lb and height in inches, like every other weight in the app.

### 3.13 Week view (A5)

- Mon–Sun or Sun–Sat per `settings.weekStart`, with ‹ › for other weeks. Opens from a "This week" row under Snacks on the day page (no Day / Week switch at the top). Progress gets no Food view.

### 3.14 Micronutrients

The goal is Cronometer-level tracking: every macro and the common micronutrients, with personal targets, inside OpenGym's look.

**Tracked nutrients** (one catalog in `src/lib/nutrition/nutrients.ts`: id, name, unit, group, USDA nutrient number, Open Food Facts key, target rule):
- **General:** Energy (kcal), Alcohol (g), Caffeine (mg).
- **Carbohydrates:** Carbs, Fiber, Starch, Sugars, Added sugars (g).
- **Lipids:** Fat, Saturated, Monounsaturated, Polyunsaturated, Trans (g), Omega-3, Omega-6 (g), Cholesterol (mg).
- **Protein:** Protein (g). Amino acids are left out: USDA has them for few foods and they're rarely useful to a lifter.
- **Vitamins:** A (µg RAE), B1 Thiamine, B2 Riboflavin, B3 Niacin, B5 Pantothenic acid, B6, B12, Folate (µg DFE), C, D, E, K, Choline.
- **Minerals:** Calcium, Copper, Iron, Magnesium, Manganese, Phosphorus, Potassium, Selenium, Sodium, Zinc.
- Water is not tracked.

**Targets:**
- From sex and age (setup S1), using the US Dietary Reference Intakes: the RDA where one exists, else the Adequate Intake. Pregnancy and lactation values are not offered.
- Fiber follows calories (14 g per 1,000 kcal), as the guidelines do.
- **Limits:** sodium (2,300 mg), saturated fat (10% of calories), added sugars (10% of calories), trans fat and cholesterol are shown as limits: the bar fills toward the limit and goes orange past it, with the word "over".
- **Upper limits:** nutrients with a tolerable upper intake (vitamin A, D, E, B6, niacin, folate, calcium, iron, zinc, selenium, magnesium from supplements …) turn orange only past that limit, never for passing the target. Going past a vitamin target is good, the same as protein.
- **Your own numbers:** Targets gets a "Nutrient targets" row that lists every nutrient with its target; any one can be overridden, and Reset puts the DRI value back. Overrides are versioned with the rest of the target, so past days keep theirs.

**Day nutrients screen** (new; needs a mockup in the v5 style):
- Opens by tapping the macro bars on the day page, and from a "Nutrients" row next to "This week".
- A top bar with the day, then one section per group above. Each row: name, "amount / target unit", a 4 px labeled bar and the %. Calories and macros come first in their own colors; everything else uses the neutral bar, orange only for the rules above.
- Tapping a nutrient lists the day's foods that contributed most to it, which answers "where did my sodium come from".

**Missing data** (the hard part, and the reason to have a good database):
- A logged food that has no value for a nutrient adds nothing to that total. The row then shows the design system's not-enough-data glyph with "Missing from 2 foods", and tapping lists them. Totals are never guessed silently.
- **Fill in missing nutrients.** On F1, a packaged or custom food missing most micronutrients shows "Fill in missing nutrients". It offers the closest built-in USDA foods by name (Greek yogurt → "Yogurt, Greek, plain, low fat"); picking one copies only the nutrients the food lacks, scaled per 100 g. Label values always win. Borrowed values are marked estimated and show with a "~" in the nutrient table. The food is saved to your library with them, so you do it once per food.
- New food (D3) shows the macro rows first and a "More nutrients" section with every nutrient in the catalog, for people copying a full label.

**Data per entry:** each log keeps a snapshot of every known nutrient for its amount, plus which ones were estimated, so the day screen never has to look up the food again and edits to the food never rewrite history.

## 4. Data model

Dexie schema version 3; backup `schemaVersion` 4. Every record has `id`, `createdAt`, `updatedAt` as usual.

```ts
type MealId = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

/** Ids from the nutrient catalog (§3.14), e.g. 'kcal' | 'p' | 'c' | 'f' | 'fiber' | 'sodium' | 'vitD' | 'omega3' … */
type NutrientId = string;
/** Amounts in each nutrient's own unit (g, mg or µg). Missing = unknown, shown as "—". */
type Nutrients = { kcal: number; p: number; c: number; f: number } & Partial<Record<NutrientId, number>>;

Food        { name, detail?, brand?, barcode?, source: 'usda'|'off'|'custom', fdcId?, offCode?,
              basis: 'g'|'ml', per100: Nutrients, estimated?: NutrientId[], filledFrom?: ID,
              servings: { label: string; grams: number }[], defaultServing?: number,
              favorite?: boolean, last?: { grams: number; unit: 'g'|'oz'|'serv'; serving?: number },
              copiedFrom?: ID, deletedAt? }
FoodEntry   { day: dayKey, meal: MealId, order, loggedAt,
              foodId?, name, brand?, grams?, unit?, serving?,            // absent for quick add
              totals: Nutrients, estimated?: NutrientId[],               // snapshot for this amount
              quick?: boolean, savedMealId?, batchId? }                  // batchId groups a saved meal or a copied day for one Undo
SavedMeal   { name, order, items: { foodId: ID; grams: number; unit; serving? }[], deletedAt? }
FoodTarget  { from: dayKey, mode: 'target'|'log',
              kcal?, diet: 'lifter'|'balanced'|'highProtein'|'lowCarb'|'keto'|'endurance'|'custom',
              pct: [p, c, f], grams: [p, c, f],
              overrides?: Partial<Record<NutrientId, number>> }           // a version; the latest with from ≤ day applies
Settings.food?  { sex?: 'm'|'f', birthYear?, heightIn?, weightLb?, activity?: 1|2|3|4,
                  goal?: 'lose'|'maintain'|'gain'|'log', paceLb?, goalWeightLb?,
                  customPct?: [p, c, f], online: boolean, setUp: boolean, usdaRelease?: string }
```

Indexes: `foods: 'id, barcode, name, source, fdcId'`, `foodEntries: 'id, day, foodId, [day+meal], batchId'`, `savedMeals: 'id, order'`, `foodTargets: 'id, from'`.

Notes:
- Age is stored as a birth year so it doesn't go stale.
- Recents, "Usually at", log counts for search ranking and week stats are derived from `foodEntries`, never stored.
- Body profile lives in Settings, not a bodyweight table. A weigh-in log is on the ROADMAP for later.
- Micronutrient targets aren't stored: they're computed from sex, age and calories, and only overrides are saved.
- USDA rows are about 13,000 records with ~45 numbers each, a few MB in IndexedDB. Search over them needs a name index: a prefix index on lowercased name words (`foodWords: '[word+foodId]'`) keeps typing fast on a phone.

## 5. Implementation plan

One commit per phase. `npm run typecheck`, `npm test`, `npm run lint:design` and `npm run build` pass after each. New pure logic goes in `src/lib/nutrition/` with Vitest tests; new screens get a catalog entry and scene in `scripts/screens.ts` under a new section **10 Food**.

### Phase 0: docs and gaps

- SPEC §1, §3, §5 edits from §1 of this doc; ROADMAP "Not doing" edit. SPEC §14 is written at the end (Phase 10) from what shipped.
- Draw what the board is missing, in the v5 style, before their phases. These can be one board, `design/proposals/nutrition-gaps.html`:
  - Quick add (D2), New / edit food with "More nutrients" (D3), the Food empty state, the inspector in edit mode, the meal sheet.
  - The day nutrients screen, a nutrient's top-foods list, the nutrient targets editor, the missing-data mark, and "Fill in missing nutrients".
- Tab icon `design/brand/tabs/food.svg` and `FoodIcon` in `icons.tsx`.

### Phase 1: data and pure logic

- `src/db/types.ts`, `src/db/db.ts` (version 3: `foods`, `foodWords`, `foodEntries`, `savedMeals`, `foodTargets`), `TABLE_NAMES`, `DEFAULT_SETTINGS`.
- `src/lib/nutrition/`, each with a test:
  - `nutrients.ts`: the catalog (§3.14), units, groups, USDA and Open Food Facts mappings.
  - `dri.ts`: targets by sex and age, limits, upper limits, fiber from calories, overrides.
  - `energy.ts`: BMR, activity factors, maintenance, pace → kcal, floor, rounding, goal-date estimate.
  - `split.ts`: presets, Lifter's per-lb protein with the 40% cap, Custom ± with the 5% floor, pct → grams.
  - `amounts.ts`: g / oz / serving conversion, per-100 → totals, ± steps.
  - `totals.ts`: day and meal sums over every nutrient with missing-data tracking, left / over, the 3% orange rule, protein and vitamin floors, limits, on-target and protein-hit, week averages skipping empty and future days.
  - `days.ts`: the 3 am food day, meal windows, meal for a time, auto-open state across a window change.
  - `targets.ts`: pick the target version for a day.
  - `foodSearch.ts`: tokenizing names for `foodWords`, local ranking (match quality, log count, favorites, short names before USDA long names), "Usually at", recents, merging online results without duplicates (barcode / offCode).
  - `label.ts`: per-serving ↔ per-100 conversion, the 4·P + 4·C + 9·F check, % of target.
  - `fill.ts`: similar-food matching and copying only missing nutrients, marked estimated.
- `src/data/food.ts`: reads and writes (log, edit, move, delete with undo, batch add and remove, copy day, saved meals, target versions, library add / star / remove / fill in).

### Phase 2: built-in food database

- `scripts/foods.ts` (plain Node, like `scripts/brand.ts`): reads the USDA SR Legacy, FNDDS and Foundation CSVs from a local download folder (not committed), keeps the catalog's nutrients and household portions, applies `scripts/food-names.json` (the short names), and writes `public/foods/usda-<release>.json`. `npm run foods`.
- `src/data/foodDb.ts`: first-open download into `foods` + `foodWords` in batches with a progress line on the Food tab, resumable if the app closes, replaced on a new release. Workbox caches the file.
- A test that a small fixture CSV produces the expected records.

### Phase 3: tab and day page (A1–A4)

- `TabLayout.tsx` (fifth tab), `App.tsx` routes: `/food`, `/food/day/:day`.
- `src/screens/food/FoodDay.tsx`: header with ‹ ›, week strip (past, today, future), target bar, macro bars, meal folders with auto-open, entry rows, swipe delete, "Nutrients" and "This week" rows, empty state.
- Components reused from `ui/`: `LargeHeader`, `TargetBar`, `LabeledBar`, `Ring`, `FolderChevron` / `FolderLabel`, `RowText`, `AddRow`. A `WeekStrip` and a `MacroBars` likely join `ui/` (Home uses them too); add them to the gallery (0.1).
- Screens: 10.1 lunchtime, 10.2 evening, 10.3 past day over target, 10.4 future day, 10.5 empty state.

### Phase 4: setup and targets (S1–S4, T1–T3)

- `src/screens/food/Setup.tsx` (four steps, one route with a step param so Back works), `Targets.tsx`, `NutrientTargets.tsx` (the per-nutrient list with overrides).
- Inline inputs use the keypad dock (`decimal` / `int` modes); height gets ft + in or cm.
- Screens 10.6–10.13.

### Phase 5: add food (C1, C2, F1, editing)

- `AddFood.tsx` (C1: search, tiles, chips, Usually at, Recent, disc add / remove with toasts, Cancel → Done), `FoodAmount.tsx` (C2 with the keypad dock: unit switch, ± steps, ½ key; `src/lib/keypad.ts` gains the ½ key and unit-aware steps), `FoodInspector.tsx` (F1, view and edit modes, full nutrient table with % of target, "~" for estimated), meal sheet.
- Works fully offline against the USDA database and your library.
- Screens 10.14–10.18.

### Phase 6: your foods, quick add, saved meals, copy a day (D2–D5)

- `FoodForm.tsx` (new / edit / copy, servings, More nutrients), `QuickAdd.tsx`, `SavedMeal.tsx` (D4, dnd-kit like the routine builder), Meals chip content (D5), Copy a day list, folder long-press menu and its ••• alternative.
- Screens 10.19–10.24.

### Phase 7: micronutrients

- `DayNutrients.tsx` (grouped rows, bars, missing-data marks), `NutrientFoods.tsx` (top contributors), "Fill in missing nutrients" on F1.
- Screens 10.25–10.28.

### Phase 8: online foods and scanning (C3)

- `src/data/openFoodFacts.ts`: search and product lookup, mapping every catalog nutrient the product has (per-100 nutrients, servings from `serving_size`), timeouts, offline detection, debounce, the "fewer than 8 local results" rule.
- `Scanner.tsx`: camera, `BarcodeDetector` or lazy ZXing WASM, result sheet, number-entry fallback, "Fix the numbers".
- Settings › Food › "Look up foods online"; Workbox runtime caching for the decoder file.
- The screens script uses canned responses so screenshots never hit the network.
- Screens 10.29–10.31.

### Phase 9: week and Home (A5, A6)

- `FoodWeek.tsx` with a stacked-bar chart added to `components/charts.tsx` (the design-system §15 spec: 28 wide, top rounded, dashed target).
- Home Food block in `Home.tsx`.
- Screens 10.32, and 3.x updates for Home.

### Phase 10: data, sample data, docs

- `backup.ts`: schemaVersion 4. Backups carry your foods, entries, saved meals and targets, but not the USDA rows (they come back from the database file); entries referring to a USDA food keep working because entries hold their own snapshot. Older backups restore with empty food tables. The restore confirmation also counts logged days.
- CSV export adds a food log: date, meal, food, brand, amount, then one column per nutrient.
- `src/lib/sampleData.ts`: a few weeks of food logs for the test database, including an over-target day, a future day and a packaged food with missing micronutrients.
- `fake-indexeddb` round-trip test for the food tables (ROADMAP §4.2 asks for this anyway).
- SPEC §14 Nutrition, SPEC §3 data model, `design/README.md` row, `CLAUDE.md` layout lines for `src/screens/food/` and `src/lib/nutrition/`, `npm run screens`.

### Size and order

Phases 1–5 make a usable Food tab with full nutrient data and no Open Food Facts: a bit over half the work. Phases 6 and 7 add the convenience and the micronutrient screens; 8–10 finish it. Two phases carry most of the risk: Phase 2 (getting USDA data small, well named and fast to search on a phone) and Phase 8 (iOS camera in a Home Screen PWA, decoder size, Open Food Facts data quality). Phase 2 comes early because everything else searches it.

## 6. Risks

- **Open Food Facts data quality** varies: missing macros, odd serving sizes, duplicates, and micronutrients only when the label lists them. Missing values stay "—" and get the missing-data mark, "Fix the numbers" and "Fill in missing nutrients" are always one tap away, and your copy wins from then on.
- **USDA names and search.** Thousands of near-identical long names ("Beef, ground, 85% lean meat / 15% fat, patty, cooked, broiled") make search noisy. The short-name list, ranking your own logged foods first, and a cooked/raw word in the detail line handle most of it; the rest is tuning after real use.
- **First download** of about 1 MB on a phone. It happens once, shows progress, and the tab still works for your own foods and quick add while it runs.
- **iOS camera in a standalone PWA** has had permission quirks across iOS versions. The typed-number fallback means scanning failing never blocks logging.
- **Storage:** USDA rows are a few MB; a year of daily logging is about 2,000 entries. Both are small for IndexedDB, and `navigator.storage.persist()` already protects them.

## 7. Decisions from review (Nov 10)

| # | Question | Decided |
| --- | --- | --- |
| 1 | How the week view opens | A "This week" row under Snacks |
| 2 | A Food view in Progress | No, not for now |
| 3 | Day cut-off | 3:00 am (§3.1) |
| 4 | Logging to future days | Allowed; future days don't count in stats until they arrive (§3.1) |
| 5 | Editing the meal list | No: Breakfast, Lunch, Dinner, Snacks, fixed |
| 6 | Meal windows | Breakfast until 11, Lunch until 4 pm, Dinner after |
| 7 | 3% grace before orange | Yes |
| 8 | Weigh-in log | Not now; added to `design/ROADMAP.md` |
| 9 | Training-day targets | No, one target every day |
| 10 | Online lookups | On by default |
| 11 | Built-in food database | Yes, and with full micronutrients from USDA (§3.8) |
| 12 | What % on the inspector means | % of your own targets (§3.10) |
| 13 | Editing a food changes past days | No, history never changes |
| 14 | Calorie safety floor | Yes, as written |
| 15 | Water tracking | No |
| — | Micronutrients | Track every macro and the common micronutrients, like Cronometer (§3.14) |

## 8. New questions (optional)

These came from adding micronutrients. Each has a default above.

1. **Amino acids and other extras?** Default: no amino acids, no individual omega-3s (EPA / DHA / ALA), no vitamin breakdowns (retinol vs carotene). Cronometer has them; USDA covers few foods for them.
2. **Borrowing nutrients from a similar food:** offered as a button, never automatic, and marked "~". Default as written. The stricter option is to never estimate and only show missing-data marks.
3. **Where Nutrients opens:** tapping the macro bars and a "Nutrients" row under Snacks. Default as written. Alternatively, nutrients could be a section on the day page itself, under the meals.
4. **Supplements** (a multivitamin, creatine, fish oil): default is to log them as your own foods in Snacks. A separate Supplements meal would break the fixed four.
5. **Weekly nutrient averages:** default is the day screen only; the week view stays calories and macros.

All five defaults above were built as written.

## 9. How the build went

Every phase in §5 is built; `npm run typecheck`, `npm test`, `npm run lint:design` and `npm run build` pass. Board IDs map to storyboard screens as follows: A1–A4 → 10.1–10.4, A5 → 10.32, A6 → 3.1, S1–S4 → 10.6–10.9, T1–T3 → 10.10–10.12, C1 → 10.14–10.15, C2 → 10.16, F1 → 10.17, C3 → 10.29–10.30, D4 → 10.21, D5 → 10.22. The pieces the board didn't draw are 10.5, 10.13, 10.18–10.20, 10.23–10.28 and 10.31; `nutrition-gaps.html` shows them with notes.

Where the build chose something this plan left open, or changed it:

- **Food database.** 13,224 foods (SR Legacy, Foundation over its SR twin, FNDDS), 3.7 MB raw and about 1 MB gzipped. 335 common foods get short names (`scripts/food-names.json`: "Chicken breast, grilled" over USDA's description, which becomes the second line). Up to 6 household servings per food; the default serving prefers "1 medium", then whole units, then spoons for dense foods and cups for the rest (milk defaults to a cup, oil to a tablespoon). Search gives built-in foods with a short name a boost, so "chicken" finds chicken breast before chicken broth.
- **Fill in missing nutrients** ranks candidates by the share of the name's words they cover, with rarer words weighing more (inverse frequency over the candidates), a small bonus for leading with one of them, and shorter names breaking ties. "Protein bar, chocolate" finds the protein bars before chocolate cookies. A search field covers the cases where the closest name isn't the closest food. Fill has an Undo.
- **Saved meals.** Amounts are tuned in grams on the keypad dock (the routine-builder pattern has no amount sheet); foods are added from a search inside the editor, not through Add food, so nothing is logged by accident. Deleting a saved meal confirms first; logged days keep their foods.
- **Copy a day** lists the last 14 days with food, each with its food count and totals.
- **Scanning.** Two identical reads in a row before a lookup, to cut misreads. The ZXing decoder is a separate 38 KB chunk plus a 947 KB WebAssembly file, fetched on the first scan and cached (Workbox CacheFirst). The prompt and top bar sit on a translucent backing so they read over any camera picture, in both themes. The amount box on the result sheet opens the full amount screen (10.16) instead of a second keypad inside the sheet.
- **Week.** A list of the seven days under the averages, so there's a visible way back to any day besides tapping its bar; future days' bars are faded.
- **Settings › Food** is a row under General, with Targets, Nutrient targets, the online toggle and the database status.
- **Backup.** USDA rows you've made yours (logged, starred) are kept in the backup so their last amount and star survive; plain ones are left out. Restore keeps the phone's built-in foods and the "database loaded" flag, and rebuilds the search index. Delete all data also resets a half-finished database load.
- **Screenshots** use a canned Open Food Facts (`window.__og.off`) and a generated camera frame (a package with an EAN-13 barcode), so `npm run screens` never touches the network.

Not done: the weigh-in log (ROADMAP §7), and a test of the scanner on a real iPhone Home Screen install.

