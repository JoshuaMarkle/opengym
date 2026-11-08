# design/

Everything needed to build the app.

| Path | What it is |
| --- | --- |
| `SPEC.md` | **Start here.** Decisions, data model, rules and build order |
| `storyboards/complete.html` | **Source of truth for screens.** 60 screens with IDs (1.1 … 9.6) and design principles. Open it in a browser |
| `images/complete.png` | The same storyboard as one tall image (`storyboard-complete-part1–3.png` are the same image split into three) |
| `storyboards/v1` – `v8` | Earlier iterations, kept for history. **Superseded** wherever they differ from `complete.html` |
| `optional/final-features.html` | **Source of truth for the extra features:** plate pad, keypad Next/Done button, supersets, cardio (SPEC §10). The other files in `optional/` are earlier iterations |
| `optional/plan-schedules.html` | Plan schedules: repeating cycles, weekly splits, one-off day changes, missed days (SPEC §11) |
| `brand/brand-board-v2.html` | Logo (loaded bar, 3 variants still to pick from) and the icon mix: solid tab bar, outline everywhere else |
| `brand/logos/`, `brand/nav/solid/`, `brand/icons/outline/` | SVG source files for the logo, tab icons and in-app icons (`currentColor`). `brand/brand-board.html` holds the first round of options |
| `GETTING-STARTED.md` | How to start building with Claude Code, plus the first prompts |
| `CLAUDE.md` | Project instructions for Claude Code (copy to the repo root) |

Iteration history: v1 style & set layouts → v2 flexibility → v3 table refined → v4 nav & graphs → v5 history/settings/look-back → v6 history ranges, Plans, builder → v7 routines & folders → v8 Home → complete.
