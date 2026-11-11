# OpenGym design system

The short, text version of `design/proposals/design-system.html` ("the design doc"). Read this before building UI. The HTML is the visual reference for people; section numbers (§1–§17) are the same in both, and code comments cite them as `design §9 Disc`. Where SPEC §8 and this file disagree about colors, type, sizes or glyphs, this file wins; SPEC's behaviour rules still apply.

Checked by `npm run lint:design` (runs in `npm run build`). The gallery at `#/dev/ui` (dev only, screen 0.1) renders every component below with its variants.

## Five rules

1. **Flat and black.** Black canvas, flat rows, 1 px hairlines. No cards, shadows or gradients (exceptions: the effort badge and the lifted row while dragging). Grey fills only mark something you can tap or type into.
2. **Color means something and is never alone.** Blue = act / selected, green = better, orange = attention, red = delete / worse. Always next to a word or a drawn symbol.
3. **Numbers are the loudest thing.** Logged weights and reps are bold, white, tabular. Labels around them are small and grey.
4. **One size per job.** Only the values in this file. A new value needs a reason written next to it, and an allowlist entry in `scripts/lint-design.ts`.
5. **44 px to touch.** Every tappable thing has a 44 × 44 target, even when it draws smaller.

## 1 · Color (`src/index.css`)

Every color is a `--og-*` variable, exposed to Tailwind as `bg-*` / `text-*` / `border-*`. No hex in `.ts` / `.tsx` (only `src/lib/logo.ts`). Tinted fills are `color-mix` of a meaning color, never a separate literal.

| Utility | Dark value | Use |
| --- | --- | --- |
| `bg` | #000000 | Canvas, tab bar |
| `raised` | #101010 | Sheet background |
| `surface` | #161616 | Empty input cells, segmented track, chips, pressed rows (60%) |
| `surface-2` | #1C1C1C | Text fields, secondary buttons, toasts, hold menu, alert |
| `key` / `key-fn` | #1E1E1E / #2A2A2A | Keypad keys / function keys and the selected segment |
| `line` | #222222 | Hairline between rows and under headers. Never a control edge |
| `line-strong` | #38383B | Control outlines: bordered buttons, dashed add, menu dividers, grabber |
| `fg` | #FFFFFF | Names, logged numbers |
| `fg2` | #A1A1AA | Dates, units, supporting copy you need to read |
| `fg3` | #71717A | Chevrons, placeholders, unchecked rings, hints with no information |
| `disabled` | #55555B | Unavailable controls (or 40% opacity on the control) |
| `accent` | #007AFF | Blue for **text, lines, rings, marks**, chart lines, focus |
| `action` | #007AFF | Blue for **every filled surface with white on it**: buttons, discs, Check, toggle, NEXT badge, selected day, Finish, Start pill, field switch, keypad confirm |
| `action-pressed` | #0054B0 | Pressed filled blue |
| `tip` | #32C66D | Success, records, improvement, live, "Next" targets |
| `warn` | #FF9500 | Attention, missed, drops, backup due, over target |
| `danger` | #FF453A | Delete text, errors, worse |
| `danger-fill` | #C9342B | Filled destructive button and the edit-mode delete disc |
| `cyan` / `gold` | #2DAFC3 / #EBC22D | Carbs / fat. Nutrition only. Protein uses `accent` |
| `done` | accent 14% on bg | Completed set row, resume bar |
| `edit` | accent 12% on bg | The cell being typed into |
| `accent-soft` | accent 12% transparent | Highlighted table row, selected choice tile, "New" status |
| `effort` | accent 45% on bg | Logged effort badge |
| `success-soft` / `danger-soft` | tip / danger 18% on bg | Up / down status pills |
| `chart-grid` · `chart-dot` · `bar` | #1C1C1C · #66666F · #52525B | Chart gridlines, past points, past bars |
| `swipe` / `swipe-armed` | #2E2E2E / #4A4A4A | Swipe-reveal panel behind a row |

- **One blue.** Accent and action both use `#007AFF`; filled blue surfaces use `bg-action`, with a darker pressed state.
- Colored fills with text on them (orange D, green / orange answer discs) use black text.
- Light theme swaps the neutrals only; meaning colors keep their role.

## 2 · Type

System font, `tabular-nums` on body. Line heights are fixed so rows line up. Weight and tracking are defaults; `font-*` overrides them.

| Utility | Size / line · weight · tracking | Use |
| --- | --- | --- |
| `text-hero` | 40/44 · 700 · −0.03em | Welcome title, a goal's target. One per screen |
| `text-display` | 34/40 · 700 · −0.02em | Large title on a tab root |
| `text-title1` | 30/36 · 700 · −0.02em | Detail-screen title, editable name fields, big stat numbers, onboarding questions |
| `text-title2` | 22/28 · 700 · −0.01em | Exercise name in a live workout, current workout on Home |
| `text-title3` | 19/24 · 700 | Sheet titles, empty-state titles |
| `text-headline` | 17/22 · 700 | Top-bar titles, row titles, stat values |
| `text-body-lg` | 17/22 · 400 | Sheet options, alert buttons, settings rows, bar buttons (500) |
| `text-input` | 16/20 | Set cells and values (600), text fields (400). 16 stops iOS zoom |
| `text-body` | 15/20 · 400 | Default copy, toasts, every filled button (700), dashed add (600) |
| `text-callout` | 14/19 · 400 | Row subtitles, option details, Previous column, notes |
| `text-footnote` | 13/18 · 400 | Header subtitles, meta lines, segmented labels, chips, label actions (600) |
| `text-caption` | 12/16 · 400 | Footnotes under charts and tables, status pills (700) |
| `text-caps` | 11/14 · 700 · +0.06em · UPPER | Section labels, column headers, stat labels. `normal-case font-normal tracking-normal` for chart axes |
| `text-micro` | 10/12 · 700 | Badges, tags, tab labels (600), calendar day codes, keypad sub-labels |

Keypad only (allowlisted px): digits 23/500, function keys 19/600. Effort badge: 10.5/800 (allowlisted, §7).

Weights: 700 titles, names, logged numbers, filled buttons, caps, badges · 600 labels inside controls, input values, label actions · 500 Back / plain bar buttons, keypad digits · 400 copy, subtitles, options · 800 only W / D badges.

Text: a set is `185 × 8` (`BW × 12`, `+25 × 8`, `−40 × 10`), real minus `−`. Units in the header or after the number in grey (`207 lb`). Dates `Thu, Oct 29`; inside a week the weekday. Empty is `—` in fg2. Sentence case except caps and badges. No trailing periods on labels or buttons. Truncate names on one line.

## 3 · Icons (`src/components/icons.tsx`)

Solid tab icons (`HomeIcon`, `HistoryIcon`, `FoodIcon`, `ProgressIcon`, `SettingsIcon`) are for the tab bar only, at 23 px. Everything else is a stroked glyph in `currentColor`.

**Only `+ − × W D ✕ —` are typed.** Everything else is a glyph: `CheckGlyph` (not ✓), `ArrowGlyph` (→), `TrendUp` / `TrendDown` (▲ ▼), `ChevronRight` / `ChevronLeft` (› ‹), `ChevronDown` (▾ ⌄), `MoreGlyph` (•••), `PlayGlyph` (▶), `Handle` (≡). Prose inside a string that can't hold a glyph is allowlisted with a reason.

| Glyph | Size | Where |
| --- | --- | --- |
| `ChevronLeft` | 17 in bars, 13 for month arrows | Back, month ‹ |
| `ChevronRight` | 13 in rows (fg3), 10 in label actions and inline links | Disclosure |
| `ChevronDown` | 9–12 | Dropdowns, open folders |
| `CheckGlyph` | 11 header · 13–14 discs and checkboxes · 16 leading | Ticks |
| `PlayGlyph` | 12 | Start pill, play discs |
| `PlusGlyph` / `MinusGlyph` | 12 in S discs and add rows · 14 in steppers | Add / remove |
| `CloseIcon` | 11 | Sheet close, effort pad |
| `ArrowGlyph` | 10 | Previous → Next, Next key, moved days |
| `TrendUp` / `TrendDown` | 9–10 | Before a trend number or status word |
| `MoreGlyph` | 16 wide | ••• buttons |
| `SearchGlyph` | 14 | Search fields |
| `ChartIcon`, `CalendarIcon`, `ListIcon`, `ClipboardIcon` | 15–18 | Look-back, view switches |
| `PencilGlyph` | 18 | Workout options |
| `WarnGlyph` | 14, always orange | "Not enough data" notes |
| `KeyboardGlyph` | 22 | Floating keypad button |
| `BackspaceIcon` | 24 | Keypad, effort pad |
| `Handle` | 14 × 12, fg3, in a 44 target | Drag to reorder |
| `BarcodeGlyph` | 20 | Scan a barcode (Food) |
| `BoltGlyph` | 20 | Quick add (Food) |
| `StackGlyph` | 20 | Saved meals (Food) |
| `StarGlyph` | 20, gold fill when on | Star a food |
| `FlashGlyph` | 20, a flashlight (not the bolt) | The scanner's light |

No emoji, no icon fonts.

## 4 · Layout

- Spacing: 4 px base, 8 px rhythm. Values 2 · 4 · 6 · 8 · 12 · 16 · 20 · 24 · 32. Screen edge 16; above a section label 20; label to field 6; icon to text 12.
- **Heights** (the only px heights the lint accepts): 16 badge · 24 table header, checkbox, Disc S · 32 small bordered button, set cell, data-table row, compact segmented · 34 chips, Start pill, Disc L, day disc · 36 segmented item, compact button · 40 search · 44 tap target, filled button, text field, dashed add, set row, bar button, segmented track · 46 hold-menu item · 48 toast, resume bar, Fab · 50 keypad keys · 52 single row, top bar, tab bar, sheet option · 60 two-line row. Plan-table rows 28 (not tappable).
- **Radii**: `rounded-xs` 4 badges, tags · `rounded-sm` 8 cells, highlighted rows, compact segment thumb · `rounded-md` 10 buttons, fields, keys, set rows, segment thumb · `rounded-lg` 14 alerts, menus, toasts, segmented track · `rounded-xl` 18 sheet top · `rounded-full` chips, pills, discs, toggles, bars. 2–3 px only inside drawings (PlatePad, charts).
- Lines: hairline `border-line` under every row and section label. Control outline `border-line-strong` (1.5 for radios, checkboxes, chips that select). Dashed only for add buttons and empty-state icons. Focus: 2 px blue outline, 2 px offset. Drop sets: 2 px orange left border, indent 14.
- Max width 520. Bottom of a scrolling screen with no footer: 24.

## Components (`src/components/ui/`)

Import from `src/components/ui` (the folder's `index.ts`). Each component's comment names its design section. Build screens from these; don't restyle inline.

### §5 Headers · `ui/headers.tsx`

| Component | Use | Props |
| --- | --- | --- |
| `Screen` (`ui/layout.tsx`) | Full-height screen: header, scrolling body, pinned footer | `header`, `footer`, `bodyClass`, `noPad`, `scrollRef` |
| `LargeHeader` | Tab roots only (Home, Calendar, Food, Progress, Settings; the Food week too). Display 34, subtitle Footnote fg2 | `title`, `subtitle`, `right` (≤ 2 controls) |
| `TopBar` | Pushed screens. min-h 52, Headline title, hairline | `left`, `title`, `right`, `border` |
| `BarButton` | Top-bar text button, 44 tall, 17 | `kind: 'plain' \| 'bold' \| 'muted'` |
| `BackButton` | ChevronLeft 17 + label | `label`, `onClick` |
| `DetailTitle` | Title 1 under a top bar + Callout meta | `title`, `meta`, `right` |
| `WorkoutBar` | Live-workout header: back, name, Footnote meta, orange past date, pencil, Finish (compact) | `name`, `meta`, `pastDate`, `backLabel`, `onBack`, `onOptions`, `onFinish`, `finishing` |
| `SectionLabel` | Caps label, optional action, hairline. Every list starts with one | `action`, `tone: 'warn' \| 'accent'`, `line` |
| `LabelAction` | Blue 13/600 action with ChevronRight 10 for a SectionLabel | `onClick`, `chevron`, `tone` |
| `FieldLabel` | Caps label above an input (no hairline) | — |

### §6 Rows · `ui/rows.tsx`

| Component | Use | Props |
| --- | --- | --- |
| `Row` | Flat row with hairline. 52 single · 60 two lines · 52 dense | `variant: 'single' \| 'two' \| 'dense'`, `onClick`, `chevron`, `as` |
| `RowText` | Title + subtitle for a row (Headline + Callout, or 15/600 + 12 dense) | `title`, `subtitle`, `dense`, `badge` |
| `FolderChevron` / `FolderLabel` / `FolderMenuButton` | Parts of a folder row (h52): ChevronRight / ChevronDown 12, Caps label (fg2 closed, white open) + fg3 count + Caption note, MoreGlyph in a 44 target. Children indent 24 | `open` / `label`, `count`, `open`, `note` / `onClick`, `label` |
| `EditRow` | Edit-mode row: leading DeleteDisc, content, trailing DragHandle. `lifted` while dragging (the one shadow besides the effort badge) | `leading`, `trailing`, `lifted`, `children` |
| `DeleteDisc` | Disc S, danger-fill, white bar | `onClick`, `label` |
| `DragHandle` | Handle in a 44 target; dnd-kit listeners spread onto it | `label`, `handleRef`, `className`, …listeners |
| `AddRow` | 52 row: Disc S action + PlusGlyph + 17/600 blue label | `onClick`, `className` |

### §7 Tables · `ui/tables.tsx`

| Component | Use | Props |
| --- | --- | --- |
| `SetTable` | (stays in `screens/workout/SetTable.tsx`) the logging table. Columns 34 · 1fr · 74 · 58 · 46, header Caps h24, rows 44 r10 | — |
| `PlanTable` | Read-only copy of the set table: header h24, rows h28, same columns minus the tick (`planColumns`). `Dash` is the empty cell | `rows: PlanRow[]`, `showPrev`, `weightLabel` (omit for no weight column) |
| `InfoTable` / `InfoRow` / `InfoSubRow` | Many facts about one thing: header Caps + note, rows h32 Callout | `title`, `note` / `label`, `value`, `tone` |
| `DataHeader` / `DataRow` | Read-only comparison table: header Caps h24, rows h32, gap 10; highlighted row accent-soft r8 | `cols` (grid template), `highlight` |
| `InlineBar` | h8 bar in a data table | `frac`, `recent` |
| `StatRow` | Equal stat cells: Caps label, Headline value, Caption detail | `items: { label, value, detail? }[]` |

### §8 Bars and rings · `ui/progress.tsx`

| Component | Use | Props |
| --- | --- | --- |
| `TargetBar` | h8, the one main number against its target. `over`: past the target it fills to the end, with a canvas notch at the target and orange after it | `frac`, `tone`, `over` |
| `LabeledBar` | h4 under a Caps label, ≤ 3 side by side. `over` as TargetBar | `frac`, `color`, `over` |
| `GoalBar` | h8, green ahead / orange behind, white 3 × 16 marker | `frac`, `marker`, `behind`, `markerLabel` |
| `SegmentBar` | h4 steps, gap 4: done blue, current white, to do surface-2 | `steps: ('done' \| 'current' \| 'todo')[]` |
| `Ring` | S 36/3 (28/3 in rows), M 104/8, L 144/10. Progress or segments | `size: 's' \| 'row' \| 'm' \| 'l'`, `progress`, `segments`, `color`, `track`, `children` |
| `CountRing` | Row ring with "2/4" inside; full ring + CheckGlyph when complete (All exercises) | `done`, `total` |
| `TargetSummary` | Food's main number: Title 1 value + "/ target unit", "N left" / "N over" (orange, with the word), then a TargetBar. No target: just the value | `value`, `target`, `unit`, `over` |
| `MacroBars` | Three LabeledBars for protein · carbs · fat: Caps name (CheckGlyph when a floor is met), "value / target g", bars in the macro colors | `items: MacroBar[]` |
| `MacroRing` | Ring L split by macro calories with kcal inside, and a legend of % · grams · name per macro. Hairlines above and below | `kcal`, `grams: [p, c, f]` |
| `MacroLegend` | MacroRing's legend with − + steppers per macro (custom split) | `grams`, `pct`, `steps` |
| `macroSegments` | The Ring segments for a split | `grams`, `pct` |

### §9 Buttons · `ui/buttons.tsx`

| Component | Use | Props |
| --- | --- | --- |
| `Button` | The one filled size: 44 / r10 / 15/700. `compact` 36 / r10 / 15/600 is Finish only | `kind: 'primary' \| 'secondary' \| 'danger' \| 'ghost' \| 'white'`, `size?: 'compact'` |
| `Disc` | Round one-tap answer. S 24 (glyph 12) at a row start, L 34 (glyph 14) as the button. Always in a 44 target; without `onClick` it's a mark | `size: 's' \| 'l'`, `tone: 'action' \| 'grey' \| 'success' \| 'warn' \| 'danger'`, `onClick`, `label`, `disabled` |
| `DiscFace` | The drawn circle alone, for a disc inside a bigger button or a list mark | `size`, `tone` |
| `PlayButton` / `DoneDisc` | Disc L with PlayGlyph / CheckGlyph | `primary`, `onClick`, `label` |
| `StartPill` | Today's Start: 34 full, 14/700, PlayGlyph 12 | `onClick`, `label` |
| `AddButton` | Dashed add, 44 / r10 / 15/600 | `tone: 'accent' \| 'warn'` |
| `IconButton` | Bordered small: 32 / r10 / 13/600 blue, glyphs only; on = action fill | `active`, `label`, `onClick` |
| `TextButton` | Low-weight action in content: 15/600 (or 13/600 `small`) blue, 44 tall | `tone`, `small` |
| `NavCard` | Previous / Next card: 52 (44 with keypad), r10, Caps 11 over Callout 14/600, drawn chevrons | `small` (caps line), `children` (name), `side`, `tone?: 'action'`, `align`, `compact` |
| `Fab` | Floating 48 / r10 surface-2, `data-dock-side` | `label`, `onClick`, `className` |
| `ShortcutTile` | 60 r10 surface tile: glyph 20 in accent over a Caption 12/600 label; four in a row (Add food) | `icon`, `onClick` |

### §10 Controls · `ui/controls.tsx`

| Component | Use | Props |
| --- | --- | --- |
| `Segmented` | 2–4 views. Track 44 r14 p4, items 36 r10 13/600 | `options`, `value`, `onChange` |
| `CompactSegmented` | Toolbars, form rows: track 32 r10 p2, items 28 r8. `instant` answers on pointer-down (keypad) | `options`, `value`, `onChange`, `label`, `tone: 'neutral' \| 'action'`, `instant` |
| `IconSegmented` | View switch in a large header: 44 / 40 × 36 | `options` (glyph labels + `ariaLabel`), `value`, `onChange`, `label` |
| `Chips` | Filters: 34 full, on = white fill | `options`, `value`, `wrap` |
| `VariationChip` / `MoreLabel` | 32 r8 1.5 border; current = blue border + done fill; `more` is the blue "All N" chip (`MoreLabel` adds its chevron) | `state: 'current' \| 'history' \| 'other' \| 'more'`, `onClick`, `ariaLabel` |
| `ChoiceTile` | 52 r10 1.5 border, Micro label + Callout 600 value; selected blue border + accent-soft | `label`, `value`, `on` |
| `TextField` | 44 r10 surface-2 16/400, 1.5 border blue on focus | `value`, `onChange`, … |
| `fieldClass` | The text-field look as a class string, for native date / time inputs | — |
| `ValueBox` | 44 r10 surface-2, centered 17/700 + Footnote unit; focused blue border + edit fill. It is a `<label>`, so don't nest it in one | `value`, `onChange`, `unit`, `label`, `inputMode`, `maxLength` |
| `PickerBox` | Value box that opens a sheet, ChevronDown 9 | `label`, `onClick` |
| `InlineInput` | 32 r8 min-w 80, 16/600 right + unit | `value`, `unit` |
| `Stepper` | Two 36 × 32 r8 buttons with Minus / Plus 14 | `onDown`, `onUp`, `children` |
| `SearchField` | 40 r10 surface-2, SearchGlyph 14; `trailing` puts one blue glyph button (40, glyph 20) at the end: the barcode on Add food | `value`, `onChange`, `placeholder`, `trailing` |
| `InlineValue` | A number typed on the keypad dock, in a row: 32 r8 min-w 80 surface-2, 16/600 right + Footnote unit, in a 44 target; editing = blue border + edit fill. "—" in fg3 when empty | `value`, `unit`, `placeholder`, `on`, `onClick`, `label` |
| `ValueButton` | The value-box look as a button that opens the keypad (Food's Amount) | `value`, `unit`, `on`, `onClick`, `label` |
| `Toggle` / `Radio` / `Check` | 51 × 31 action · 22 ring · 24 round action | `on` |
| `Badge` | 16 r4 10/700: `next` (action), `tag` (outline), `muted`, `d` (orange, black), `success` | `variant` |
| `Pill` / `Tag` / `DropBadge` | Badge presets kept for existing call sites | — |
| `StatusPill` | 22 full 12/700, soft fill: up / down / same / new | `tone` |
| `BarChip` | 32 r10 surface, 13/600 + ChevronDown 9 | `label`, `onPress`, `ariaLabel` |

### §11 Notices · `ui/notices.tsx`

| Component | Use | Props |
| --- | --- | --- |
| `OfferBar` | Suggestion / Tip / Back-after: title in its tone (TrendUp / TrendDown before it), reason Caption, Why, dismiss + accept Disc L. `kicker` makes the Tip line | `tone`, `trend`, `title`, `reason`, `kicker`, `onWhy`, `onDismiss`, `onAccept`, `dismissLabel`, `acceptLabel`, `line` |
| `ConfirmedBar` | "Using the suggested weights" with Undo | `children`, `onUndo`, `tone` |
| `AttentionNote` | 2 px orange left rule, lead in orange 600 + fg2, text buttons below | `lead`, `children`, `actions` |
| `LiveDot` | 7 px green pulse | — |
| `LiveStatus` | Home's running-workout block | `title`, `timer`, `where`, `detail`, `steps`, `onResume` |
| `EmptyState` | Dashed glyph box, Title 3, Callout | `icon`, `title` |
| `Note` | Footnote fg2 paragraph | — |

### §12 Calendars · `ui/calendar.tsx`

| Component | Use | Props |
| --- | --- | --- |
| `Weekday` | Caps weekday letter over a strip column; white on today | `today` |
| `DayDisc` | 34 week-strip disc (Home, plan strip) | `state: DayState`, `today`, `live`, `changed` |
| `DayCell` | Month-grid cell: h44 r10, Callout 14/600 number, 12 px marks row | `number`, `marks`, `selected`, `today`, `live`, `missed`, `changed`, `tone` |
| `DayDots` / `DayCode` | Marks under a DayCell number: workout dots, or a routine code | `count`, `selected` / `selected` |
| `ChangedOutline` | The 1 px dashed fg2 outline of a changed day | `round` |
| `CalendarLegend` | Micro 10 legend with swatches, markers and labels vertically centered | `items: LegendItem[]` |
| `RingStrip` | Food's week: Caps letters over Ring S (36/3) per day, filled toward the day's calories (fg2, white for today on a line-strong track); orange with a 4 px dot under it past 3% over; the selected day's letter is white; future days empty with an fg3 number | `days: RingDay[]`, `onPick` |

`PlanStrip`, `PlanGrid`, `CodesSwitch` and `MONTH_LEGEND` live in `screens/plans/PlanParts.tsx` and are built from these.

Day marks are the same everywhere: done / selected = action fill · **today = white ring** (2 on discs, 1.5 on cells), green while a workout is live · today done = action fill + canvas gap + blue ring · missed = 1 px orange ring · changed = 1 px dashed fg2 · past nothing = surface disc / fg2 number · rest = fg3. Blue means done or selected, nothing else.

### §13 Keypad (`src/components/Keypad.tsx`, `PlatePad.tsx`)

`useNumberPad(fields, { onDone })` (`src/components/useNumberPad.tsx`) docks the keypad under a form of `InlineValue` / `ValueButton` fields (Food): the field switch, ± steps, ½, and confirm move between fields.

Dock: kp fill, line-strong top, px 8 pt 6 pb 8 + safe area. Toolbar min-h 44, gap 6: `CompactSegmented` mode switch (neutral), field switch (action), `BarChip`, confirm 28 r8 action + CheckGlyph 14. Body 218 for every pad (4 × 50 + 3 × 6). Keys h50 r10 gap 6. Plate keys gap 6, total Title 2, action row 15/600 with Done 15/700.

### §14 Popups (`src/components/overlays.tsx`)

`Sheet` (raised, r18 top, title Title 3 + Footnote subtitle mt 2, options full width with hairlines inset 16 px on both sides, aligned with the row text; one above the first, between rows, and none after the last) · `SheetOption` (min-h 52, 17/400, detail Callout fg2) · `Alert` (270, r14, only before losing data) · `HoldMenu` (ring 4 above and below, 8 at the sides, r14; items 46) · Toast (48, r14) · `FullScreen`. One overlay at a time; every overlay closes with Esc and a visible control.

### §15 Charts (`src/components/charts.tsx`)

Main line accent 2.5 · past points chart-dot r2.2 · latest accent r5.5 with 2 px canvas ring · grid chart-grid, ≤ 4 lines · axis labels 11/400 fg2 · target white 1.2 dash 4 4, labelled with the target · bars `bar`, latest accent, r4 top · macros accent · cyan · gold. `MacroWeekBars` (Food week): 28 wide stacked protein · carbs · fat by their calories, r4 top, calories without macros in `bar`, future days at 40%, an orange r3 dot over days past 3% over, weekday Micro 10/700 (today white).

## Rules (§17)

Do:
- Logging is the product: one tap completes a set; values come pre-filled.
- Thumbs low, decisions high: tick, + Set, Prev / Next, keypad, Start at the bottom; Save / Done top right, Cancel / Back top left.
- Start from a pattern: large title or top bar → section labels → rows or a table → one bottom action.
- Pair every color with a word or symbol, every gesture with a visible control.
- Forgive: Undo toast after deletes; alert only before losing logged work.
- Use the components in `src/components/ui/`.

Don't:
- Cards, shadows, gradients, colored section backgrounds.
- A second filled button on a screen, or a filled button in a top bar (Finish is the exception).
- Values not in this file; half-pixel font sizes; arbitrary Tailwind values.
- Status colors as decoration; macro colors that change with state.
- Grey text for logged numbers, white for meta.
- Alerts for information, toasts for errors, a hold menu as the only way in.
- **Selected things are filled or outlined, never both.** Filled: filter chips, segmented, toggles, discs, checkboxes, the field switch. Outlined (blue border + soft blue tint): variation chips, choice tiles, the held row, the cell being edited.

Calendar month controls (PH3.2–PH3.3): a 32 × 32 square calendar-icon surface inside a 44 × 44 tap target immediately left of Dates / Codes returns to the current month and selects today. Match the Dates / Codes track height: surface background, 15 px fg2 calendar glyph, and r10 corners. Legend labels use a 1 px downward optical offset to align the visible text with their markers.
