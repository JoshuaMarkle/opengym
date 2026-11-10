# Roadmap

What to fix and build next, in priority order. Written Nov 8 2026 from a pass over the code, the spec and every screen. Each item says where it lives. Delete an item once it ships, or move it into SPEC.md if it changes a rule.

State at the time of writing: typecheck clean, 295 tests passing, every screen in the storyboard.

## 1. Bugs (small, do first)

- **Sample data repeats a Sunday every November.** `generateSampleData` steps `day += DAY` (24 h), so on the fall-back Sunday the same date comes round twice (two "Run" workouts on Sun Nov 1 2026, which is why 6.1 says "Workouts 4" over three dotted days), and the spring-forward Sunday is skipped. Step by calendar date instead (`new Date(y, m, d + 1)`). Only the cardio stream changes. `src/lib/sampleData.ts`.

## 2. Friction at the gym

These touch principle 1, logging is the product.

1. **Notes where you need them.** Routine notes exist but only show on the routine screen (2.11), never during the workout. There's also nowhere to keep the thing every lifter writes down: machine settings ("seat 4, pin 6"). Add `Exercise.notes`: one line under the exercise name in 4.1, edited from "•••" and the exercise screen (8.2). Show routine notes folded under the workout header. A per-workout note ("slept badly") on 5.3 / 6.7 can wait.
2. **Time since the last set.** The header shows the workout clock but nothing tells you how long you've rested. A quiet "1:42 since last set" in the header (counting up from the last ✓, no alarm, no countdown) answers the question without building the rest timer that §1 rules out. Pure logic: last completed set's `updatedAt`.
3. **Name the records on the summary.** 5.3 counts records but never says which lift set one, and the count disappears entirely on a day with cardio (cardio takes its slot). Tag the row in green ("PR" or "Record"), and keep the count in all cases.
4. **"0 of 9 done" reads as sets.** With two sets ticked, the header still says 0 of 9. "0 of 9 exercises" is clearer.

5. **Bring back the gap question, smarter.** "Back after N weeks?" (4.32) is off (`Settings.askAboutGaps`). It looked at one lift alone, so Cable Fly asked "Back after 71 weeks?" mid-block while DB Fly, its variation sibling, was logged weekly; after a real break every lift would ask in turn. Before turning it back on: count the variation group (and probably any training at all) as recent activity, and ask once per workout, or once on Home, when the whole log has the gap. `src/data/training.ts`.

6. **Weight × time exercises (Farmer's Carry).** The popularity proposal (`design/proposals/exercise-popularity.html` §D, §H) adds Farmer's Carry with a new `weight_time` type: LBS and TIME columns, skipped by est. 1RM and records, Progress charts the heaviest weight with time as the tiebreak. Everything else in that proposal shipped; this was left out because the type touches the set table, keypad, Previous, routines, history, records, training and import. Add the seed entry (popularity 5, area forearms) when the type exists. Timed holds (dead hang, plank) could reuse it.

## 3. Progress that agrees with itself

1. **Status and % can contradict.** Rows on 7.1 read "Lat Pulldown · Holding" next to a green "▲ +14%": the status covers 8 weeks, the % follows the range picker (3M). The lift screen (7.2) has the same pair: "Holding ±0% · 8 wk" above "▲ 34 lb (22%) in 6 months". Show the range next to the % ("+14% · 3M"), or grey the % out when the status disagrees with it.
2. **The headline mixes scopes.** Under "FOCUS LIFTS · EST. 1RM +11%", "11 climbing · 9 holding" counts every tracked lift, not the 4 focus lifts. Label the counts ("All lifts: …") or move them next to "All other lifts". `src/screens/progress/Progress.tsx`.

## 4. Data safety

Principle 9 promises reminders; today the only one is an orange header on Settings, a tab people rarely open at the gym.

1. **Backup nudge where people look.** When the last backup is over 7 days old and there are workouts since, add one quiet line at the bottom of the summary (5.3): "Last backup 12 days ago · Back up now", one tap to the share sheet. Never an alert.
2. **Tests for the write paths.** `src/lib` is well tested; `src/data` has none, and it's where data could be lost: finishing (count / drop unticked, update routine), restore (every table, backups of version 1, 2 and 3), Strong / Hevy import, delete-all. `fake-indexeddb` is already a dev dependency and unused. Start with a backup → restore round trip.

## 5. Tooling

- **Lint for hooks.** There are 14 `eslint-disable-line react-hooks/exhaustive-deps` comments, but no ESLint in the project. Add `eslint` + `eslint-plugin-react-hooks` (stale closures are the usual bug with `useLiveQuery`), or drop the comments.
- **CI.** A GitHub Action that runs `npm run typecheck`, `npm test` and `npm run build` on push.
- **Split `WorkoutScreen.tsx`** (1,433 lines) when it's next touched: the keypad wiring, the training bar and the finish flow are separate concerns.

## 6. Decisions for you

These cut against something the spec decided on purpose, so they need a call before anyone builds them.

- **Rest timer.** Out of scope in §1, and the feature lifters ask for most. A PWA can't fire a notification while the phone is locked without a push server, so a real timer only works with the screen on (Keep screen on already does that). "Time since last set" (2.2) covers most of the need; decide after living with it.
- **Timed holds** (planks, dead hangs). Out of scope in §1. The cardio TIME column already exists; a "time" exercise type could reuse it.
- **Bodyweight.** BW and BW + added lifts chart reps or the added weight only, so a heavier lifter doing the same pull-ups looks flat. A bodyweight entry would let est. 1RM use the real load. It doesn't cross "diet plans", but it is a new thing to log.
- **Two workouts on one scheduled day** (§9 open question, the 2.19 toggle). Still open.
- **A cue when an exercise is finished.** After the last set, nothing changes; you press Next. The bottom bar is grey on purpose. A small "done here" in the Next button's label would help without adding colour.

## Not doing

Still out per §1 and principle 10: volume / tonnage charts, social, routine sharing, videos, diet, gym profiles, intervals, a warm-up ramp. Watch sync stays parked (`proposals/watch-sync-future.html`).
