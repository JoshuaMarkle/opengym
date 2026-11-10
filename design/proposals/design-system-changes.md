# Design system: change list

What has to change in `src/` so that the app matches `design/proposals/design-system.html`, so that common widgets live in one place, and so that future agents get the same result every time. Section numbers (§) refer to the design doc.

The counts come from a pass over `src/` at commit `e74f0f9`. Work through the phases in order. Each phase should leave the app building and looking right.

---

## Phase 0: make the design machine-readable

The HTML doc is good for people to look at, but an agent can't hold 200 KB of HTML in its head. An agent also has no way to check its own output against it. Four changes fix that:

1. **`design/DESIGN.md`**: a short text version of the design doc, under about 400 lines. It holds the tokens, the type scale, the component catalog (one line per component: name, file, when to use it, its main props) and the rules from §13 and §17. It's the file agents read. The HTML stays as the visual reference for people. Neither file should hold anything the other contradicts.
2. **Tokens as Tailwind utilities**: put the type scale, radii and new colors in `@theme` in `src/index.css`. Screens then write `text-callout rounded-md bg-action` and never `text-[14px] rounded-[10px] bg-[#…]`. An agent can't drift off the scale if the scale is the only thing it has to type.
3. **A design lint**: add `npm run lint:design`, a small Node script in `scripts/`, and run it inside `npm run build`. It fails on any of these:
   - an arbitrary `text-[…]`, `rounded-[…]` or `tracking-[…]` value, and `h-[…]` or `min-h-[…]` heights not on the list in §4
   - a hex color in `.tsx` or `.ts` outside `index.css` and `lib/logo.ts`
   - a typed symbol from §3's "drawn instead" list (✓ → ▲ ▼ › ‹ ••• ▶ ≡ ▾ ⌄ ◎) in JSX text
   - a `rounded-full` disc that isn't 24 or 34

   Only existing exceptions, each with a reason, go in an allowlist inside the script: the effort badge (10.5 px, §7), keypad digits 23 / 19, and the bar drawing in PlatePad.
4. **A component gallery screen**: a dev-only route, `#/dev/ui`, that renders every component in `src/components/ui/` with its variants. Give it storyboard ID 0.1 in `scripts/screens.ts` so `npm run screens` captures it. Agents and reviewers then have one picture of the real components to compare against.

Then update `CLAUDE.md`:

- Replace the line "in-app controls use the glyphs ▶ + ✓ ••• ≡ W/D…" with: "Only + − × W D ✕ and — are typed; everything else is a glyph from `icons.tsx`."
- Add: "UI: build from `src/components/ui/`; no arbitrary Tailwind values; read `design/DESIGN.md` first."
- Point SPEC §8 at DESIGN.md.

---

## Phase 1: tokens (`src/index.css`)

| # | Now | Change to |
| --- | --- | --- |
| T1 | `--og-fg2` #8E8E8E, `--og-fg3` #555555, `--og-line` #1F1F1F, `--og-line-strong` #2C2C2C | #A1A1AA, #71717A, #222222, #38383B (§1) |
| T2 | accent #2E8BFF (typed as a literal 5 times inside `@theme`: accent, done, effort, effort-glow, accent-soft), tip #2EE66B, warn #FF8C1A, danger #FF3B3B | add `--og-accent` #007AFF, `--og-warn` #FF9500, `--og-danger` #FF453A and tip #32C66D, and build every mix from the variable |
| T3 | Filled controls use the same blue as text | add `--og-action` #0066D6, `--og-action-pressed` #0054B0 and `--og-danger-fill` #C9342B; every filled button, disc, Check, toggle, NEXT badge, Finish and selected day uses `bg-action` |
| T4 | no nutrition colors | add `--og-cyan` #2DAFC3 and `--og-gold` #EBC22D (protein uses accent) |
| T5 | `--og-input-edit` #0B1A2E literal | `--og-edit` and `--og-done` as color-mix of accent and bg (12% / 14%), plus `--og-accent-soft`, `--og-success-soft`, `--og-danger-soft` and `--og-effort` |
| T6 | `--og-chart-dot` #4A4A4A, `--og-bar` #3A3A3A | #66666F and #52525B |
| T7 | `#2e8bff` typed 7 times: charts.tsx ×5, workout/Ring.tsx, Home.tsx:134 | `var(--og-accent)` |
| T8 | gestures.tsx:165 `#2e2e2e` / `#4a4a4a` | `--og-swipe`, `--og-swipe-armed` |
| T9 | light theme | swap the neutrals the same way; keep the light values passing contrast |
| T10 | type scale is typed as px | `@theme` utilities: `text-hero` 40/44, `text-display` 34/40, `text-title1` 30/36, `text-title2` 22/28, `text-title3` 19/24, `text-headline` 17/22 700, `text-body-lg` 17/22, `text-input` 16/20, `text-body` 15/20, `text-callout` 14/19, `text-footnote` 13/18, `text-caption` 12/16, `text-caps` 11/14 700 +0.06em uppercase, `text-micro` 10/12 700 |
| T11 | 15 radii | `rounded-xs` 4 · `sm` 8 · `md` 10 · `lg` 14 · `xl` 18 · `full` |

---

## Phase 2: one component library

Split `src/components/ui.tsx` (515 lines) into `src/components/ui/`, one file per family, with an `index.ts` that re-exports everything. Then move each inline copy listed below onto the shared component. **"Replaces"** lists every copy found today.

### Headers (§5): `ui/headers.tsx`

- `LargeHeader`, `TopBar`, `BarButton`, `BackButton` (these exist already).
- `DetailTitle`: Title 1 plus a Footnote meta line. Replaces the inline h1s in RoutineScreen, ExerciseScreen, Goals, WorkoutDetail and MonthReview. RoutineBuilder (26 px) and onboarding (28 px) also move to 30 px.
- `WorkoutBar`: extract it from WorkoutScreen (lines ~615–655).
  - Subline is Footnote 13; it was 12.5.
  - The past-date "Logging Nov 4" is orange 600; it was plain fg2.
  - Finish becomes `<Button size="compact">`.
- `SectionLabel` with an `action` prop: grey caps label, optional blue action with ChevronRight, and a hairline. This is the "THIS WEEK · Calendar ›" style.
  - Only 14 files use it today. About 45 inline `uppercase` labels sit in 20 files instead, the most in LiftViews (8), Training, TrainingViews, Goals, RoutineBuilder and Plans (4 each).
  - All of them move to `SectionLabel`, or to `FieldLabel` above an input.
- `SheetHeader`: always tight (subtitle mt 2). Remove the `tight` prop.

### Rows and folders (§6): `ui/rows.tsx`

- `Row` with variants `single` (52), `two` (60) and `dense` (52, 15/600 + 12).
  - Today's row heights are 48 (×8), 50, 54 (×6), 56 (×10) and 58 (×5). Each one moves to 52 or 60.
- `FolderRow`: the chevron, Caps label, count and trailing total or MoreGlyph, with children indented 24.
  - Replaces both folder headers in Plans.tsx (lines ~291–330). Those are 44 px with 12.5 px labels in white at 80%.
- `EditRow`, `DeleteDisc` and `DragHandle`.
  - Replaces Plans `ItemView` (54 px row, 22 px red disc) and the 22 px delete disc in AllExercises:130.
- `AddRow`: a 52 row with a 24 action disc and PlusGlyph.
  - Replaces the inline add rows in Plans:450, ScheduleEditor:311, ExerciseFormView:131/150 and ExercisePicker:319, all currently 24 px with a typed +.

### Tables (§7): `ui/tables.tsx`

- `SetTable` stays in `screens/workout`. Make sure its header uses `text-caps`.
- `PlanTable`: extract it from RoutineScreen. Header h24 (was h20, 10.5 px), rows h28 (was 27), and the set table's columns.
- `InfoTable`, `InfoRow`, `InfoSubRow`: new. Use them for long lists of facts:
  - LiftViews records
  - Training's "Why" sheet
  - TrainingViews
  - the nutrition tables, once nutrition is built
- `DataTable` with `InlineBar` (h8; LiftViews:368 is 7 today).
- `StatRow` exists. Label 11 / 0.06em (was 10.5 / 0.04em). Use it everywhere a row of stats appears.

### Bars and rings (§8): `ui/progress.tsx`

- `TargetBar` (h8), `LabeledBar` (h4), `GoalBar` (h8 + marker; extract it from Goals:446) and `SegmentBar` (h4; replaces the h5 bar at Home:180).
- `Ring`: move `screens/workout/Ring.tsx` here.
  - Sizes S 36/3 (28/3 in rows), M 104/8, L 144/10.
  - Props: `progress` or `segments`.
  - No literal color.

### Buttons (§9): `ui/buttons.tsx`

- `Button`: one size, 44 / r10 / 15/700, plus `size="compact"` (36 / r10 / 15/600).
  - Today the default is `lg`, 50 / r13 / 17. Only 10 of the 14 files that use Button pass `md`.
  - Remove `lg`.
  - Plans:114 has an inline 50 px primary button; replace it with `<Button>`.
- `Disc` with `size: 's' | 'l'` (24 / 34) and `tone: 'action' | 'grey' | 'success' | 'warn' | 'danger'`. Glyph 12 in S, 14 in L, always in a 44 target.

  | Copy today | Size today | Becomes |
  | --- | --- | --- |
  | `PlayButton`, `DoneDisc` (ui:200, 211) | 34 | wrap `Disc` |
  | Training `RoundButton` (:142) | 30 | `Disc l` |
  | Training back-after dismiss (:176) | 22 | `Disc l` |
  | LookbackSheet:46 | 30 | `Disc l` |
  | Effort:211 | 30 | `Disc l` |
  | Welcome:32 | 22 | `Disc s` |
  | Plans:450 / 540 | 24 / 22 | `Disc s` |
  | ScheduleEditor:311 | 24 | `Disc s` |
  | ExerciseFormView:131 / 150 | 24 | `Disc s` |
  | ExercisePicker:319 | 24 | `Disc s` |
  | AllExercises:130 | 22 | `Disc s` |

- `AddButton`: the dashed add. Replaces EditWorkout:463 and RoutineBuilder:326 (48 / r12 / 16) and AllExercises:171 (44 / r12).
- `IconButton`: 32 / r10 (was 30 / r9), with glyphs only.
- `NavCard`: extract `NavButton` from WorkoutScreen:1390.
  - 52 / 44 tall (was 50), r10 (was r11), Caps 11 (was 10 / 0.05em).
  - Drawn chevrons instead of typed ‹ ›.
- `Fab`: the keyboard button, 48 / r10 (was r11).

### Controls (§10): `ui/controls.tsx`

- `Segmented`: 44 track, p4, r14 track / r10 thumb (today p2, 40, r10 / r8).
- `CompactSegmented`: 32 / 28, r10 / r8, with `tone: 'neutral' | 'action'`.
  - Replaces `Pills` in Keypad (r9 / r7), the tablist in ExerciseFormView, and the Dates / Codes underlined text in PlanHistoryCalendar:178.
- `IconSegmented`: 44 track, 40 × 36 items, r14 / r10. Replaces the calendar view tabs in Plans:77 (a 48 track with 44 items, r10 / r8).
- `Chips` (filter) exists. `VariationChip` moves here, with a 1.5 border (was 1).
- `ChoiceTile`: from Goals `DateChip`. Label Micro 10 (was 9.5).
- `TextField`, `ValueBox`, `PickerBox`, `InlineInput`, `Stepper`.
  - The 48 px inputs with a 2 px ring and 17–18 px text in EditWorkout, WorkoutScreen and Goals:213/218/330 all become `TextField` or `ValueBox` (44).
- `Toggle`, `Radio`, `Check` exist.
- `Badge`, with variants `next | tag | muted | d | success`: merges `Pill`, `Tag` and `DropBadge`.
- `StatusPill`.
- `BarChip`: move it out of Keypad, 32 / r10 (was r9).

### Notices (§11): `ui/notices.tsx`

- `OfferBar`: one component for Training's suggestion bar, the Tip bar and the "Back after a break?" bar.
  - Discs are L 34.
  - Draw TrendUp / TrendDown instead of typing ▲ ▼ (Training:112).
  - The TIP label is Caps 11 (was 10.5 / 0.07em).
- `ConfirmedBar`: the "Using the suggested weights" row with Undo.
- `AttentionNote`: 2 px orange left rule. Replaces the copies in Home:227, PlanHistoryCalendar:228, Training:375 and Goals.
- `LiveStatus`: extract `LiveBlock` from Home. The live dot is one shared component with TabLayout:63.

### Calendars (§12): `ui/calendar.tsx`

- `DayDisc` and `WeekStrip`: from Home:120–150 and `PlanStrip`.
- `DayCell` and `MonthGrid`: from PlanHistoryCalendar. Cell r10 (was r9).
- `CalendarLegend`.
- **Today is always a white ring** (green while a workout is live). Right now the month grid uses a blue ring, and Home uses a literal `#2e8bff` ring when today is done.

### Keypad (§13)

- Leave `Keypad.tsx` and `PlatePad.tsx` in `components/`.
- Use `CompactSegmented`, `BarChip` and the `Disc`-style confirm.
- Plate keys: gap 6 (was 5). Total `text-title2` (was 26). Action row 15/600, with Done at 15/700 (was 16/600).

### Overlays (§14): `overlays.tsx`

- Sheet options run full width, with a hairline above the first and no bottom padding after the list (O2).
- Hold-menu ring: 4 px above and below, 8 px at the sides, r14 (O3).
- Toast and floating button: r14 / r10 (were 13 / 11).

### Glyphs: `icons.tsx`

- Add `MoreGlyph`, `TrendUp`, `TrendDown`, `PlusGlyph`, `MinusGlyph`, `ArrowGlyph`, `SearchGlyph` and `ClipboardIcon`. Search is inline today; the clipboard is inline in Plans:95.
- Delete `PlansIcon` and `brand/tabs/plans.svg`.
- Rows use ChevronRight 13.

---

## Phase 3: sweep the screens

After Phase 2, these are what's still off. Fix each file using tokens and components only.

| # | What | Where (count) | Fix |
| --- | --- | --- | --- |
| S1 | Half-pixel and off-scale font sizes: 12.5 (×25), 10.5 (×18), 13.5 (×10), 14.5 (×5), 9.5 (×4), 9 (×2), 11.5, 26 (×3), 28 (×6), 21 (×2), 20 (×2), 18 (×2), 38, 24 | all screens | map to §2: 12.5 → caption 12, 10.5 → caps 11, 13.5 → footnote 13, 14.5 → callout 14, 9 / 9.5 → micro 10, 26 / 28 → title1 30, 20 / 21 → title2 22, 18 → headline 17, 38 → hero 40, 24 → title2 22 |
| S2 | 10 letter-spacing values: 0.04, 0.05, 0.06, 0.07, 0.1, 0.12em, 1px, −0.01, −0.02, −0.03em | everywhere | only through the type utilities |
| S3 | Off-scale radii: 9 px (×13), 13 (×4), 12 (×4), 11 (×3), 7 (×4), 5 (×5), 6, 3, 2, 1 | everywhere | 4 · 8 · 10 · 14 · 18 · full; 2–3 px only inside chart and bar drawings |
| S4 | Typed ✓ | 14 files (Effort, Keypad, EditWorkout, WorkoutScreen, Ring, SetTable, CardioTable, TrainingViews, Goals, Lately, RestoreFlow, SettingPicker, PlanParts, ExerciseFormView) | `CheckGlyph` |
| S5 | Typed → | 12 files | `ArrowGlyph` (prose in labels may keep "to") |
| S6 | Typed ▲ ▼ | 9 files (AllExercises, Training, Summary, TrainingViews, Progress, LiftViews, MonthReview, Cardio, Lately) | `TrendUp` / `TrendDown` |
| S7 | Typed › and ‹ | 17 + 4 files | `ChevronRight` / `ChevronLeft` (9 in label actions, 13 in rows) |
| S8 | Typed ••• | 9 files | `MoreGlyph` |
| S9 | Typed ▶ ≡ ▾ ⌄ ◎ | ui, RoutineActions, Plans, Keypad, LiftDetail, Effort, Goals / Lately empty states | PlayGlyph, Handle, ChevronDown; give the empty state a real glyph |
| S10 | Section labels written inline | 20 files | `SectionLabel` / `FieldLabel` |
| S11 | Today ring differs between Home and Calendar | Home, PlanHistoryCalendar, PlanParts | `DayDisc` / `DayCell` |
| S12 | `size="lg"` buttons | Home, Plans, onboarding, Summary, Goals | one size |

---

## Phase 4: docs and screenshots

1. Run `npm run screens` and `npm run brand`. Check the gallery (0.1) and the storyboard.
2. Update SPEC §8 and the CLAUDE.md rules (Phase 0). Delete the stale glyph rule.
3. Close each item in §16 of the design doc; mark it done in the doc or remove it.
4. In `design/README.md`, mark `proposals/design-system.html` as installed and add `DESIGN.md` to the table.

## Done when

- `npm run build` passes, and `npm run lint:design` reports 0 issues outside the allowlist.
- `npm test` passes, because no logic changed.
- Every screen in the storyboard was re-captured and looks like the design doc. The one known look change is the new palette.
- `grep -rE "text-\[|rounded-\[|#[0-9a-fA-F]{6}" src --include=*.tsx` finds only allowlisted lines.
