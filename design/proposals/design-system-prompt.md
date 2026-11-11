# Prompt for Claude Code: install the design system

Copy everything below the line into Claude Code, run from the repo root.

---

You're bringing OpenGym's UI in line with its new design system. Three files in this repo define the work:

- `design/proposals/design-system.html`: the design system. It covers palette, type scale, icons, spacing and radii, and every component with its px sizes (§1–§15). Open it in a browser or read the HTML. `design-system.png` is a full-page screenshot.
- `design/proposals/design-system-changes.md`: the change list. It has Phase 0 (making the design machine-readable), Phase 1 (tokens), Phase 2 (one component library), Phase 3 (sweeping the screens) and Phase 4 (docs and screenshots), with file and line references from an audit.
- `CLAUDE.md` and `design/SPEC.md`: the project rules. Where the design doc and SPEC §8 disagree about colors, type, sizes or glyphs, the design doc wins. SPEC's behavior rules still apply.

## How to work

1. Read `CLAUDE.md`, then the design doc, then the change list. Before you edit anything, write a short plan in `design/proposals/design-system-plan.md`. List the phases, the files each one touches, and anything in the change list you think is wrong or missing in the code. If the code disagrees with an audit line (a count or a line number moved), trust the code and note it.
2. Do the phases in order, **one commit per phase**. Each commit message names the phase. After each phase, `npm run typecheck`, `npm test` and `npm run build` must pass. Don't move to the next phase with a failing check.
3. This is a visual refactor. **Don't change behavior, data, or what any screen does.** Logged data, gestures, persistence and routing all stay as they are. If a fix looks like it needs a behavior change, leave it and list it under "Not done" in the plan file.
4. Phase 0 comes first so you can check yourself as you go:
   - Write `design/DESIGN.md` as the short text version of the design doc: tokens, the type scale, the component catalog with file and props, and the rules.
   - Add the `@theme` utilities.
   - Add `scripts/lint-design.ts`, run as `npm run lint:design`, using the rules and the allowlist from the change list.
   - Add the dev-only gallery route `#/dev/ui`, screen 0.1.

   The lint will fail at first. That failure is the to-do list for Phases 2 and 3. Wire it into `npm run build` only at the end of Phase 3, once it passes.
5. Phase 2: build `src/components/ui/` with one file per family (headers, rows, tables, progress, buttons, controls, notices, calendar) and an `index.ts`. Keep the export names the screens already use, so imports change from `../../components/ui` to the folder index and nothing else. Move every inline copy named in the change list onto the shared component, and delete the copy. Each component should:
   - take only token classes, never arbitrary values
   - have a one-line doc comment naming its section in the design doc (`// design §9 Disc`)
   - appear in the gallery with all its variants
6. Phase 3: sweep the screens file by file, using tokens and components only. Use `npm run lint:design` and the greps in "Done when" to find what's left.
7. Phase 4:
   - Run `npm run screens` and `npm run brand`, then look at the new screenshots. Compare the gallery and three or four busy screens with the matching sections of the design doc: workout (4.1, 4.16, 4.27), Home (3.2), Calendar (6.1), New goal (7.16) and Exercise (8.2).
   - Fix anything that doesn't match.
   - Update SPEC §8 so it points at `design/DESIGN.md`. Update `CLAUDE.md` with the new rules (Phase 0, step 4 of the change list). Mark the design doc as installed in `design/README.md`.

## Rules that are easy to miss

- **One blue.** `accent` #007AFF is for text, lines, rings and marks. `action` #007AFF is for every filled surface with white on it: buttons, discs, Check, toggle, NEXT badge, selected day and Finish.
- **One filled button size** (44 / r10 / 15/700), plus `compact` (36) for Finish only.
- **Discs come in two sizes only**: S 24 at the start of a row, L 34 when the disc is the button. Both sit in a 44 target.
- **Bars come in two thicknesses**: 8 for a main bar, 4 under a label.
- **Only + − × W D ✕ and — are typed.** Every other symbol is a glyph from `icons.tsx`.
- **Selected things are filled or outlined, never both.** Filled means filter chips, segmented, toggles and discs. Outlined means a blue border with a soft blue tint: variation chips, choice tiles, the held row and the cell being edited.
- **Today in any calendar is a white ring.** It turns green while a workout is live. Blue means done or selected, nothing else.
- **The effort (RIR / RPE) badge stays exactly as built**, including its 10.5 px text and shadow. Allowlist it.
- **Rows are 52 or 60**, data-table rows 32, and plan-table rows 28.
- **No cards, shadows or gradients**, apart from the effort badge and the lifted row while dragging.

## Finish

When all phases pass, reply with:

- the commits
- what `lint:design` reports
- anything in "Not done" in the plan file
- the screens whose look changed beyond the new palette, with their IDs
