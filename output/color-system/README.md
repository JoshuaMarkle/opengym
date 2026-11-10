# OpenGym dark color system

Proposed design reference based on the current app and the selected nutrition palette. This package defines the palette and implementation mapping; it does not install it in the running app. All files are outside `design/`.

## The palette

| Role | Color | Meaning |
| --- | --- | --- |
| Canvas | `#000000` | Default page and tab-bar background |
| Primary text | `#FFFFFF` | Names, logged numbers, calorie totals |
| Secondary text | `#A1A1AA` | Dates, units, essential supporting copy |
| Blue | `#007AFF` | Actions, selected states, brand plates, strength trends, protein |
| Cyan | `#2DAFC3` | Carbs |
| Gold | `#EBC22D` | Fat |
| Green | `#32C66D` | Success, records, improvement, live indicator |
| Orange | `#FF9500` | Attention, missed days, drops, backup due, calorie overage |
| Red | `#FF453A` | Delete, errors, downward workout comparison |
| Filled primary action | `#0066D6` | White button text on a deeper version of the anchor blue |
| Filled destructive action | `#C9342B` | White button text on a deeper version of the danger red |

Protein, carbs and fat retain their category colors in every nutrition view. Category color is independent of state: a fat chart stays gold when over target, while the over-target note uses orange and explicit text. Protein above its floor gets a checkmark, not a warning. Calories stay white within target and turn orange above the existing tolerance.

Use the existing system typeface, tabular figures, 16px screen edges, 44px minimum targets, flat rows and hairlines. No decorative cards, gradients or shadows. Keep the existing effort-badge shadow and active glow as specific exceptions already present in the app. Charts use rounded bar tops, thin neutral grids and labeled targets.

## Files

- `../opengym-color-system.html`: visual design reference with component examples and the full token ledger.
- `tokens.css`: all 49 proposed dark-mode tokens, including aliases and derived states.
- `tokens.json`: machine-readable values, roles, current values where applicable, and usage descriptions.
- `tailwind-aliases.css`: aliases to merge into the existing Tailwind `@theme inline` block when implementing.
- `contrast.json`: calculated text and control contrast pairs.
- `source-audit.json`: current color literals and their locations in `src/`, captured during the audit.

The JSON data embedded in the visual reference is the source for this package. Regenerate the exports when changing it. CSS aliases intentionally preserve existing utility names such as `accent`, `tip`, `warn`, `danger`, `done`, `effort` and `edit`.

## Color roles throughout the app

| Area | Consistent treatment |
| --- | --- |
| Onboarding and installation | Black canvas, white titles, secondary instructions, deeper blue primary buttons |
| Home | Blue Start / Resume, neutral upcoming rows, green live indicator, orange missed or backup notes |
| Plans and routine builder | Blue actions and superset brackets, neutral schedule structure, orange warning and drop glyphs |
| Calendar | Blue workout dots; white today outline; orange missed outline; dashed neutral changed-day outline; selected date uses deeper blue with white text |
| Active workout | White logged values, blue focus and suggestions, 14% blue completed-row fill; W neutral and D orange |
| Keypad and plate pad | Charcoal keys, white digits, brighter function keys, blue completion key and selected plates; gray shaft and unloaded details |
| Effort badges | Blue active ring, 45% blue completed fill, existing badge-only shadow and focus glow |
| Workout summary | Green improvement, red downward comparison, neutral same, blue new; soft status fills behind labels |
| History | White titles, secondary metadata, blue recent records and selected periods, neutral earlier bars |
| Strength and cardio charts | Blue primary series and latest period, gray historic points and bars, thin neutral grids, white target and secondary average lines |
| Trends and goals | Green ready / likely / climbing; orange stretch / behind / slipping; red unlikely; neutral holding / steady / maintained |
| Exercise library and forms | White exercise names, secondary muscle and equipment labels, blue add/edit actions, neutral input fill and visible focus ring |
| Settings, backup and import | Blue navigation and normal actions, orange attention, red destructive actions and invalid input; labels remain explicit |
| Overlays and gestures | Existing charcoal sheet and alert layers, 60% black scrim, neutral swipe reveal and armed states, status color on meaningful actions |
| Nutrition prototype | Protein blue `#007AFF`, carbs cyan `#2DAFC3`, fat gold `#EBC22D`; no automatic category color changes based on status |
| Logo, PWA icons and browser chrome | Blue plates, original neutral shaft, black background; regenerate assets from the shared palette during implementation |

## Source changes to make when implementing

1. Merge `tokens.css` into the dark token definitions in `src/index.css`. Preserve the light theme until a corresponding light reference is defined. Replace hardcoded values in the existing `@theme inline` aliases with variable references from `tailwind-aliases.css`.
2. Use `bg-action text-white` for filled primary buttons and selected calendar dates. Keep `text-accent`, accent outlines, logo plates and chart marks at `#007AFF`. Filled danger buttons use `bg-danger-fill text-white`. Bright green, gold, cyan or orange fills need dark `on-color` text.
3. Update shared controls in `src/components/ui.tsx`, `Keypad.tsx`, and selected calendar states. Separate readable action fills from the brighter accent instead of using one literal for both.
4. Replace hardcoded blue in `src/components/charts.tsx`, `TabLayout.tsx`, `src/screens/workout/Ring.tsx`, `src/screens/home/Home.tsx`, and the `:focus-visible` rule with semantic tokens. Resume and completed states derive their fills from `--og-accent`.
5. Replace the literal red mixture in `src/screens/workout/Summary.tsx` with `--og-danger-soft`. Keep positive and negative meanings intact.
6. Move the two hardcoded swipe grays in `src/components/gestures.tsx` to `--og-swipe` and `--og-swipe-armed`.
7. Source the blue plate color in `src/lib/logo.ts` from the same canonical palette when updating generated assets. Keep browser theme colors in `src/data/DataProvider.tsx` tied to the black/white theme canvas.
8. Use macro aliases for the nutrition prototype, so it never depends directly on a status token. Every new essential label uses `fg` or `fg2`; `fg3` is for nonessential hints and control boundaries, and `disabled` is only for unavailable controls.
9. When the palette is installed, update the spec's old color literals, run the relevant UI checks and screen captures, and regenerate the brand assets. This reference does not modify the screen catalog or captured app screens.

## Contrast and state rules

- `#007AFF` on black: approximately 5.23:1. White on that blue: approximately 4.02:1, so it is not the default fill for normal-size white button labels.
- White on `#0066D6`: approximately 5.42:1. White on the destructive fill is also above 4.5:1.
- All tested primary, secondary, status and macro text pairs meet 4.5:1. Tested essential control boundaries meet 3:1. Exact calculated pairs are in `contrast.json`.
- Tertiary and disabled text do not carry essential information. The regular hairline is a separator, not an accessible control boundary.
- Keyboard focus is a 2px blue outline with 2px offset. Filled primary actions use a white focus outline so the ring remains distinguishable.
- Primary hover uses `--og-action-hover`; pressed uses `--og-action-pressed`. Avoid lowering text opacity in a way that makes enabled actions unreadable.
- Preserve visible labels or glyphs beside status colors. Selection, completion, today, missed days and changed days retain distinct shapes or labels.
- Existing semi-transparent structural fills retain their intended opacity. Derived colored fills use their parent semantic tokens rather than independent literals.

## Validation

The embedded token data parses, contains unique names, and resolves every alias. The visual reference renders its palette and token ledger in a JavaScript DOM harness; preview action feedback is checked. Contrast was calculated from sRGB relative luminance for 13 representative pairs.

Headless browser capture was attempted but Chromium is blocked in this environment by a socket permission failure. The visual layout has not been browser-inspected. No production source files were changed, so app tests and app screenshot regeneration were not needed for this reference-only change.
