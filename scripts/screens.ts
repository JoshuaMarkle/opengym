/**
 * `npm run screens`: screenshots every screen in the catalog below from the real app
 * and writes design/screens/<id>.png plus design/storyboard.html.
 *
 * Starts two dev servers itself: sample history (testing mode) and an empty
 * database (onboarding and empty states). The clock is frozen at Thu Nov 5 2026,
 * 5:30 pm and the user agent is iPhone Safari, so runs are repeatable.
 *
 *   npm run screens              all scenes
 *   npm run screens -- 4 2.1     only scenes that capture IDs starting with "4" or "2.1"
 *
 * Needs Chromium or Chrome (scripts/chrome.ts).
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Browser, Page, sleep } from './chrome.ts';

const root = new URL('..', import.meta.url).pathname;
const OUT = join(root, 'design/screens');
const NOW = new Date(2026, 10, 5, 17, 30);
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

// ───────────────────────────── catalog

type Entry = [id: string, title: string, caption: string];
type Section = { n: number; title: string; blurb: string; screens: Entry[] };

export const CATALOG: Section[] = [
  {
    n: 0,
    title: 'Components',
    blurb: 'Dev only. Every shared component in src/components/ui/ with its variants, to compare with design/proposals/design-system.html.',
    screens: [['0.1', 'Component gallery', '#/dev/ui. Tokens, then one group per design section (§5 headers to §12 calendars), each component in all its variants. Captured full length.']],
  },
  {
    n: 1,
    title: 'First launch',
    blurb: 'Seen once: what the app is, how to install it, three short setup steps.',
    screens: [
      ['1.1', 'Welcome', 'First launch only. The second button goes straight to restore or import (9.4, 9.5).'],
      ['1.2', 'Install guide', 'Only when opened in a browser tab, not from the Home Screen. Installed, iOS is far less likely to clear the data.'],
      ['1.3', 'Setup', 'Step 1 of 3: units, week start and theme. Defaults: lbs, Sunday, Dark.'],
      ['1.5', 'Setup: effort target', 'How close to failure to train. The fit zone picks weights that land each set here. "Close to failure" (RIR 0–2) is pre-selected.'],
      ['1.6', 'Setup: experience', 'Sets each lift\'s starting pace until about 8 weeks of your own log take over. An import counts fully.'],
      ['1.4', 'Home, empty', 'Before any routines exist. Both buttons work immediately.'],
    ],
  },
  {
    n: 2,
    title: 'Planning',
    blurb: 'Routines in folders; a folder with a schedule is a plan. Usually done at home.',
    screens: [
      ['2.1', 'Routines', 'Routines grouped in folders. The active folder (what Home shows) is on top; archived folders sit collapsed at the bottom.'],
      ['2.2', '"+" menu', 'New routine (into the active folder), new folder, or a blank workout.'],
      ['2.3', 'Routine builder', 'Each exercise with its set rows. LBS "last" reuses last session\'s weight; REPS is a number, a range or empty. Drag ≡ to reorder; swipe a set to delete it.'],
      ['2.4', 'Keypad, reps', 'The logging keypad. On reps the bottom-left key is the range dash (6 – 8) and the decimal is off.'],
      ['2.5', 'Exercise picker', 'In this routine (untick to remove), Added (in the order ticked), then Popular: You do (your 4 most-logged), then Most popular. A–Z is one tap away. Muscle chips filter, Cardio last.'],
      ['2.6', 'Picker, searching', 'While searching, "In this routine" folds away. Matches you\'ve logged first, then the most popular, then rarely used ones dimmed.'],
      ['2.7', 'Routines, edit mode', 'Drag routines within or between folders, drag folder headers to reorder. Red − deletes a routine; its history is kept.'],
      ['2.8', 'Hold a routine', 'Long-press shortcuts: start, edit, duplicate, move, delete.'],
      ['2.9', 'Folder options', 'Rename, make active, archive or delete. Deleting a folder never deletes its routines.'],
      ['2.10', 'Move to folder', 'The tap alternative to dragging. "+ New folder…" creates one and moves the routine in one go.'],
      ['2.11', 'Routine screen', 'Optically aligned back label and Edit. More sits beside Start workout and includes Edit routine. Every set with Previous and what it will start at. A superset shows as one bracket. Start is pinned at the bottom.'],
      ['2.12', 'Superset in the builder', 'Linked exercises sit in a blue bracket, tagged A1 / A2. Drag in or out of the bracket to link or unlink.'],
      ['2.13', 'Superset with…', 'From an exercise\'s "•••". Up to 3 exercises per group. The same menu later offers "Unlink superset".'],
      ['2.14', 'Routines, with a schedule', 'Every scheduled folder shows a code-only week strip. Rest is R, today has a ring, and each routine says when it is due.'],
      ['2.15', 'Plan screen', 'Tap a folder\'s name. Its schedule and base split, followed directly by the workouts.'],
      ['2.16', 'Schedule type', 'No schedule (the plain rotation), a repeating cycle or a weekly split.'],
      ['2.17', 'Repeating cycle', 'Days in order, each a routine or Rest. Pick which day today is and what happens on a miss: wait, or stick to dates.'],
      ['2.18', 'Weekly split', 'Seven rows in week order. A missed workout is skipped or moves to the next rest day.'],
      ['2.19', 'Assign a day', 'The same sheet for cycle days and weekdays: a routine, Rest, or a new routine made on the spot.'],
      ['2.20', 'Plan calendar', 'Four weeks of planned vs done, with small dates above larger routine codes (R for rest) and shared SVG checkmarks. Blue = done, orange outline = missed, ring = today. Tap a day from today on to change it.'],
      ['2.21', 'Change one day', 'One-off changes that leave the schedule alone: another routine, rest, move, swap, or back to plan.'],
      ['2.23', 'Calendar, dates', 'Brighter planned codes beneath dates on uncompleted days, without planned borders or completed fills, with tightly spaced dots per logged workout and orange missed outlines. Tap a day for its completed sessions or planned routine.'],
      ['2.24', 'Calendar, codes', 'Planned routine codes replace dates; rest days retain their dates and dots count logged workouts.'],
      ['PH3.1', 'Home, scheduled', 'Unfilled week-strip days with borderless rest days and a blue today outline, shared SVG completion checks, gray weekday-only week-strip labels, white routine-row date numbers except blue today, a blue Today label, a compact Start pill with its label aligned to the play glyph and extra space between them, and Blank workout at the bottom of the list.'],
      ['PH3.2', 'Calendar, dates', 'Tabs run Calendar, Routines, History. Compact rows align all date numbers above brighter planned codes or workout dots. Planned days have no borders, completed days have no fill, and dots sit close beneath dates; orange outlines mark missed days; today has a white outline when unselected. One dot per logged workout.'],
      ['PH3.3', 'Calendar, codes', 'Codes always mean the planned routine; rest days retain dates. Today keeps its white outline when unselected.'],
      ['PH3.4', 'History', 'The third view tab: search completed workouts within the merged Calendar tab.'],
      ['PH3.5', 'Routines', 'The second view tab: reusable templates, code-only schedule strips, and library actions.'],
      ['PH3.6', 'Calendar, today', 'Today\'s planned workout uses the same compact blue Start pill as Home, including its play glyph, spacing, and label alignment.'],
      ['4.36', 'Switch variation', 'From +N on the variation chips: every variation, most popular first, yours in blue, rarely used ones dimmed at the end. Tap to switch.'],
      ['4.35', 'Logging a missed workout', 'The header shows the chosen past date while the active timer runs normally.'],
      ['PH3.7', 'Missed day', 'Log a missed routine late, or keep it skipped.'],
      ['PH3.8', 'Future day', 'View a planned routine or change one day; no retrospective stats.'],
      ['PH3.10', 'Calendar, changed days', 'Gray dashed outlines mark one-off routine and rest changes, matching the routine editor, in Dates and Codes; selected days hide the dashed outline.'],
      ['PH3.11', 'Home, changed days', 'Changed week-strip days use the same gray dashed outline as both calendars; today retains its blue outline.'],
      ['PH3.15', 'Calendar, tap selected day', 'First tap focuses a day; tapping the selected editable day again opens its changes drawer. The visible Change this day action remains available.'],
      ['PH3.14', 'Calendar, live change', 'Moving a workout updates changed-day outlines without rebuilding or navigating away from the calendar.'],
      ['PH3.13', 'Clear draft changes', 'Clear changes immediately resets draft overrides without a dialog; only Save persists the result.'],
      ['PH3.12', 'Change a cycle workout', 'Separate skip and move actions; moving inserts rest days and pushes the cycle back. SVG chevron, neutral Edit this workout, no footer description.'],
      ['PH3.9', 'Change this day', 'Different routine, rest, move, swap, and edit routine.'],
      ['2.22', 'Effort target', 'With effort on, a working set\'s reps box gets an rpe tab for an optional target, shown as an outlined badge on the rep range. It prefills as a placeholder badge only, never as a logged value.'],
    ],
  },
  {
    n: 3,
    title: 'Starting',
    blurb: 'Opening the app at the gym.',
    screens: [
      ['3.1', 'Home', 'This week as a strip (blue = trained, ring = today); with a scheduled plan, the plan\'s week instead (3.4). Then the active folder, longest-ago first: ▶ starts a routine, tapping the name opens it. Once Food is set up, today\'s calories and macros sit under the routines with + Log food.'],
      ['3.2', 'Home, workout running', 'An unfinished workout leads Home: timer, where you were, Resume.'],
      ['3.3', 'Resume bar', 'On every other tab while a workout runs, one tap back to your sets.'],
      ['3.4', 'Home, scheduled', 'With a scheduled active folder, Home follows the plan: a blue Today label and compact Start pill, upcoming workouts without rest rows, and Blank workout at the bottom.'],
      ['3.5', 'Missed a day', 'A quiet note the day after a missed workout: do it today or skip it. Never shown for "Wait for me" cycles.'],
      ['3.7', 'Home, rest today', 'Rest today always has its own row, even beside a missed-workout note; future rest rows are omitted.'],
      ['3.6', 'Home: Lately', 'Shared SVG check for completed goals. At most one goal line and one trend line, only when something changed, each shown on one day. Priority: goal done, goal behind, a focus lift turning Climbing or Slipping. Milestones never show here.'],
    ],
  },
  {
    n: 4,
    title: 'During a workout',
    blurb: 'Logging sets. No tab bar; Prev / Next move between exercises.',
    screens: [
      ['4.1', 'Logging', 'Previous = last time\'s set at the same position; D = you dropped after it. Variation chips appear when variations are linked: this one, yours, then the most popular, up to 4, with +N pinned at the end (4.36). On the first exercise the left button becomes All exercises. The grey keyboard button floating bottom-right opens the keypad on the next open set.'],
      ['4.2', 'Keypad', '123 | Plates on the left, lbs | reps and one blue ✓ on the right: it moves to the next box, and on the last box completes the set. No text cursor; the blue outline marks the box. ± steps by the weight step.'],
      ['4.3', 'Drop sets', '"+ Drop" adds a row under the last completed set, prefilled 25% lighter (Settings).'],
      ['4.4', 'Swipes', 'Swipe right → warm-up (moves to the top as W). Swipe left → delete with 5 s Undo.'],
      ['4.5', 'Set menu', 'Tap the set number or hold the row: warm-up, move to top, duplicate, delete.'],
      ['4.6', 'Exercise "•••"', 'Switch or link a variation, replace, superset, look back, open the exercise, or remove it from today.'],
      ['4.7', 'Bodyweight', 'The weight column follows the exercise type: BW, + added, or − assisted.'],
      ['4.8', 'Look-back: Charts', 'The chart button beside "•••". A two-thirds-height sheet that opens on the Progress chart, shrunk: est. 1RM or top set.'],
      ['4.9', 'Look-back: Records', 'Best weight for 1–12 reps; today\'s rep count highlighted, blue = last 30 days.'],
      ['4.10', 'Look-back: History', 'Every past session of this lift, newest first, drops in orange.'],
      ['4.11', 'Last exercise', 'No next exercise, so the right button becomes All exercises. Ticked segments add the Σ row.'],
      ['4.12', 'All exercises', 'Replaces everything under the header; Finish stays. Progress rings, supersets as one bracket, tap to jump.'],
      ['4.13', 'All exercises, edit', '− and ▲▼. Removing one with logged sets asks first. Finish asks whether to save changes to the routine.'],
      ['4.14', 'Add mid-workout', 'The builder\'s picker; the first section is "In this workout".'],
      ['4.15', 'Keypad, last box', 'On the last box of a set the same ✓ completes the set and jumps to the next one.'],
      ['4.16', 'Plate pad', 'Tap a plate to add it to each side; tap one on the bar to take it off. Same height as the number keypad.'],
      ['4.17', 'Plate pad, full', 'When the stack doesn\'t fit it slides left so the outer plates stay in view. Ten plates a side at most.'],
      ['4.18', 'Bar picker', 'From "Bar 45 ▾". Remembered per exercise; "No bar" is for plate-loaded machines.'],
      ['4.19', 'Superset', 'The group shares one screen inside the bracket. The exercise you\'re on is highlighted.'],
      ['4.20', 'Superset, after ✓', 'Ticking A1 jumps to the same set of A2. A finished partner folds into one line.'],
      ['4.21', 'Cardio: treadmill', 'TIME plus up to two columns, no Previous. Empty boxes show last time in grey and ✓ accepts them. Σ only with 2+ segments.'],
      ['4.22', 'Cardio keypad', 'Field tabs follow the columns. In time the bottom-left key types ":" and ± steps a minute.'],
      ['4.23', 'Cardio: bike', 'Columns change per machine: Bike tracks level. One segment, so no Σ row.'],
      ['4.24', 'Cardio: rower', 'Split /500m is worked out from time and meters, never typed.'],
      ['4.25', 'Effort pad: RPE', 'With effort on, a working set\'s tabs read lbs · reps · rpe on either box. The effort pad takes the number keys\' place, same height and layout: each digit is a value with its word (≤5 Easy to 0 = 10 Max), "." is a ½ toggle that stays on for the next pick, ± a whole step, ⌫ clears. With "Ask on every set", ✓ on reps comes here before ✓ Done. The outlined badge is the routine\'s target.'],
      ['4.27', 'Suggestion bar', 'Suggest mode. Previous shows last time → today\'s target: a new weight is green going up, orange coming down; at the same weight the text is plain and only the reps go green when they rise; arrows lined up; tap the header to show Previous alone. Last time\'s drop keeps its orange D badge after the set. The bar only asks: ✓ fills LBS with the targets; reps are never touched. Set 1 leads; later sets share its weight when it still fits and are never heavier.'],
      ['4.28', 'Why: sets', 'Each set\'s zone (the weights that land it in the rep range at the effort target), its aim, and the last 3 sessions\' calls.'],
      ['4.29', 'Why: recent weeks', 'Est. 1RM for 6 weeks and set 1\'s reps against the range.'],
      ['4.30', 'Suggestion accepted', 'The LBS boxes now hold the suggested weights, in blue until you change one (type over it or use ±). Undo puts the old values back.'],
      ['4.31', 'Auto', 'Auto fills LBS when the exercise comes up, in blue until you change one. Ignore puts last time\'s weights back.'],
      ['4.34', 'Previous → Next, tight', 'Last time had a drop after set 3. The D badge stays after that set even when the column is tight; the target truncates instead. Tap PREVIOUS → NEXT to show Previous alone.'],
      ['4.32', 'Back after a break?', 'After 3+ weeks without a lift: a break, or sessions that weren\'t logged? Nothing changes until you pick. Off for now (Settings.askAboutGaps).'],
      ['4.33', 'Comeback ramp', '"I took a break": about 90% of last time (80% after 6 weeks), then back to the old weight over 3 sessions. Those sessions stay out of the trend.'],
      ['4.26', 'Effort pad: RIR', 'The same pad in RIR: 0 Failure to 5+ Easy, with 6–9 off so a quick thumb can\'t log an RIR of 6 or more. ± work from empty (starting at 0); + is off on 5+ and − on 0 Failure. ½ greys out on 5+ but still toggles, for the next pick. Badges carry an R (2R): black in a grey ring until the set is done, then faded blue in a blue ring; the one being picked has a blue ring and glow. Stored once as RPE, so switching modes never loses data.'],
    ],
  },
  {
    n: 5,
    title: 'Finishing',
    blurb: 'Saving the workout.',
    screens: [
      ['5.1', 'Unticked sets', 'Only when some sets with values weren\'t ticked. Empty sets are dropped silently.'],
      ['5.2', 'Update the routine?', 'Only when exercises, order or set counts changed. Weights and reps never count.'],
      ['5.3', 'Summary', 'Each lift\'s best set vs the last time you did this routine. Cardio gets its own section and a weekly total.'],
      ['5.4', 'Workout options', 'The pencil left of Finish: pause, rename, change start time, discard (confirms first).'],
      ['5.5', 'Goal reached', 'Shown once, on the summary of the workout that hit a goal, with a Likely and a Stretch next step. "Not now" leaves the lift without a goal.'],
    ],
  },
  {
    n: 6,
    title: 'History',
    blurb: 'Looking back. The calendar / list choice is remembered.',
    screens: [
      ['6.1', 'Calendar, month', 'Weeks follow Settings. The selected date shows its workouts or plan below the monthly stats.'],
      ['6.2', '6 months', 'Appears once history spans 6 months. Tap a month to open it.'],
      ['6.3', 'Year', 'Appears after a year of history. ‹ › between years.'],
      ['6.4', 'All time', 'One row per year, a bar per month.'],
      ['6.5', 'List', 'Weeks, search and routine filters.'],
      ['6.6', 'Workout detail', 'Optically aligned History, back chevron, and Edit with a wider back-label gap. Every set, drops included; cardio as a mini table. Repeat, Edit, or Delete in "•••".'],
      ['6.7', 'Edit past workout', 'Lower RIR badges with gray rings, black fill, and an outer background ring; blue editing state. Borderless header with the date close beneath the workout title; tight spacing before the first exercise, balanced spacing around Add Segment, and extra space below Drop/Set to match the next header inset. Fix typos and the date. Records and charts update on Save.'],
      ['6.8', 'History, empty', 'Completed sessions appear here once a workout is finished. Calendar and Routines remain one tap away.'],
    ],
  },
  {
    n: 7,
    title: 'Progress',
    blurb: 'Am I getting stronger?',
    screens: [
      ['7.1', 'Progress', 'Focus lifts first, then every other lift logged in the last 8 weeks (Train everything). Each gets a status from the last 8 weeks against its own pace, so one bad day never counts.'],
      ['7.2', 'Lift: est. 1RM', 'Epley from the best working set per session (no warm-ups, drops, or sets over 12 reps). White dots = new all-time highs.'],
      ['7.3', 'Lift: top set', 'The weight actually lifted, reps on each point.'],
      ['7.4', 'Lift: records', 'Best weight at each rep count, with dates. Blue = last 30 days.'],
      ['7.5', 'Focus lifts', 'Up to 5 lifts that go first and get the Home lines; by default the 4 most-logged compound lifts, nudged toward common lifts and one per variation group. Train everything off: only these get statuses, milestones and goals.'],
      ['7.6', 'Progress, empty', 'Until an exercise has two sessions.'],
      ['7.7', 'Cardio', 'How much, not how fast: minutes, miles or sessions per week. Ranges hide without enough history.'],
      ['7.8', 'Machine detail', 'The weekly chart for one machine, then recent sessions.'],
      ['7.9', 'Distance records', 'Fastest mile, 5K, 10K, half and full marathon from run-type exercises.'],
      ['7.10', 'Effort-adjusted 1RM', 'With "Use effort in est. 1RM", 155 × 10 @8 counts as 12 reps to failure. "Same weight, easier" appears when a weight × reps you did in the last 8 weeks now rates lower.'],
      ['7.12', 'Goals', 'Each goal with its state. Without a date it shows an estimate, or "not moving toward it yet" rather than a date that keeps sliding.'],
      ['7.13', 'Lift trend', 'From the trend row on a lift. The status, the 8-week line, pace, milestones (the round numbers lifters count in; Goal makes one a goal, and one that already is links to it) and its goal.'],
      ['7.14', 'Slipping', 'A real drop with most recent sessions under the trend. "What changed" lists facts from the log only: how often, how many sets, gaps.'],
      ['7.15', 'Month in review', 'Leads Progress for the first week of each month, then under Month in review. Counts, one best moment, every lift against the month before.'],
      ['7.16', 'New goal', 'Weight × reps; every set counts toward it, and the chart\'s goal line is labelled with the goal itself. Each date shows its verdict; the projection is a curve with a slow–fast band, and redraws as you pick.'],
      ['7.17', 'New goal, messy data', 'When recent sessions don\'t line up there\'s no projection. You pick a pace instead, read against this lift\'s own: slow, typical, focused or rare.'],
      ['7.18', 'Goal', 'The white tick is where steady gains would put you today. "This week" is a small number to beat; the plan points back to the workout suggestions.'],
      ['7.19', 'Goal behind', 'After 2 weeks behind and no longer Likely: a later date, a lighter target, or keep it. Plain, never scolding.'],
      ['7.11', 'History with effort', 'Each set is one unbreakable block (155 × 10 @8). A line that runs out of room wraps the whole block and never ends on a dot.'],
    ],
  },
  {
    n: 8,
    title: 'Exercises',
    blurb: 'The library, from Settings.',
    screens: [
      ['8.1', 'Library', 'Popular by default: You do (your 4 most-logged), then the most popular. Rarely used ones are hidden until you search. A–Z is one tap away and remembered.'],
      ['8.7', 'Library, Arms', 'Forearm exercises are Arms tagged Forearms. The footer counts what\'s hidden and offers Show hidden.'],
      ['8.2', 'Exercise screen', 'Stats, linked variations (this, yours, then the most popular; the rest behind All N), where it\'s used. Merge fixes duplicates.'],
      ['8.8', 'All variations', 'Every variation in the group, most popular first, yours with sessions in blue, rarely used ones dimmed under Rarely used.'],
      ['8.3', 'New / edit exercise', 'Name, type (sets the logging columns), muscle, equipment.'],
      ['8.4', 'Link variations', 'Linked exercises become the variation chips in 4.1 and the switch in Progress.'],
      ['8.5', 'Cardio setup', 'Time plus up to two columns, in order; the preview shows the row.'],
      ['8.6', 'Cardio in the picker', 'A Cardio filter in the normal picker, each preset with its columns.'],
    ],
  },
  {
    n: 9,
    title: 'Settings & data',
    blurb: 'Preferences, backups, import.',
    screens: [
      ['9.1', 'Settings', 'Rows open a picker. The Data header shows when you last backed up; no nagging.'],
      ['9.2', 'Setting picker', 'One pattern for units, theme, steps, bar weight, drop amount and 1RM formula.'],
      ['9.3', 'Backed up', 'Back up now makes one JSON file and opens the share sheet; the date updates.'],
      ['9.4', 'Restore', 'After picking a backup: both workout counts, and a chance to back up first.'],
      ['9.5', 'Import from Strong / Hevy', 'Their CSV export, matched to the library. Unsure matches are flagged orange.'],
      ['9.6', 'Delete all data', 'The only irreversible action, so it needs typing DELETE.'],
      ['9.7', 'Effort', 'Off by default. RPE or RIR, which sets Next on reps asks on, and whether est. 1RM counts reps in reserve. Warm-ups, drops and cardio never ask.'],
      ['9.9', 'Training', 'Every training option on one screen. Step size, matching and pace are worked out from the log, never asked.'],
      ['9.10', 'Training phase', 'Maintaining makes holding count as a win and keeps topped-out sets at their weight; Coming back ramps every lift. Ends on a date and falls back to Building.'],
      ['9.11', 'Effort target', 'The setup question, editable later. "Only the last set to failure" gives earlier sets one more rep in reserve.'],
      ['9.8', 'RPE and RIR', 'Opened from Settings › Effort, and the first time effort is turned on. Both terms, then one table mapping RPE, RIR and how a set feels.'],
    ],
  },
  {
    n: 10,
    title: 'Food',
    blurb: 'Calories, macros and micronutrients against your own targets (SPEC §14). Built from design/proposals/nutrition.html; the sample log is a 190 lb lifter on 2,700 kcal.',
    screens: [
      ['10.1', 'Day, lunchtime', 'Lunch opens itself between 11:00 and 4:00 pm. Rings in the strip fill toward the day\'s calories; orange with a dot means more than 3% over.'],
      ['10.2', 'Day, evening', 'Dinner is the meal now: open and empty, so just its Add row. The other meals read as four summary rows.'],
      ['10.3', 'Past day, over target', 'Every folder closed. Over by more than 3%: the number and "over" turn orange and the bar gets a canvas notch at the target. Protein is a floor, so it gets a check instead.'],
      ['10.4', 'Future day', 'Logged ahead. The strip ring stays grey and the day counts in the week only once it arrives.'],
      ['10.5', 'Before setup', 'The first time Food opens: Set targets, or Just log for totals without a target.'],
      ['10.6', 'Setup: about you', 'Sex, age, height and weight are typed on the keypad dock; the box being typed in gets the blue border. Activity is the day outside the gym, in steps.'],
      ['10.7', 'Setup: goal', 'Lose fat, maintain, build muscle, or just log. A goal weight is optional and only dates the pace.'],
      ['10.8', 'Setup: pace', 'kcal a day for each rate and when you\'d reach the goal weight. 0.5 lb a week is suggested for losing; the fastest says strength may drop. A pace under your safe minimum is disabled with the reason.'],
      ['10.9', 'Setup: result', 'Maintenance from Mifflin–St Jeor × activity, the pace, and the target rounded to 50. The ring shows the split; Change picks another diet.'],
      ['10.10', 'Targets', 'Calories (type a number, or Recalculate), the L ring, grams per macro, then the diets. Lifter: protein 1 g per lb, fat 27%, rest carbs.'],
      ['10.11', 'Targets: another diet', 'Picking a diet applies from today; past days keep the target they had. The active diet moves to the top.'],
      ['10.12', 'Targets: custom', '+ adds 2% to a macro and takes 1% from each of the others; no macro goes under 5%.'],
      ['10.14', 'Add food', 'The meal is the title (tap to switch). Search with the barcode, four shortcuts, then Usually at dinner (3+ times in 30 days) and Recent. + logs your last amount at once and turns into a check; the check takes it back off.'],
      ['10.15', 'Searching', 'Your foods and foods you log first, then the built-in USDA database (about 13,000 foods, offline), short names first. Open Food Facts results follow under Online when there are fewer than 8.'],
      ['10.16', 'Amount', 'Tapping a row opens the amount with the keypad up: g · serv · oz, ± 10 g / ¼ / 0.5 oz, and ½. The ring follows every key; ✓ Log logs it and goes back with the row checked.'],
      ['10.17', 'A logged food', 'Tap a food on the day page: the same screen with Save, Star and •••. Change the amount or move it to another meal. Every nutrient shows % of your own target; missing values are —.'],
      ['10.18', 'Meal sheet', 'The four meals. Fixed: they can\'t be renamed or reordered.'],
      ['10.19', 'New food', 'A nutrition label as rows: name, brand, the serving, then calories and macros per serving as the label prints them. More nutrients holds the rest. Stored per 100 g; a quiet note shows when calories are far from 4·P + 4·C + 9·F.'],
      ['10.20', 'Quick add', 'Calories plus optional protein, carbs and fat, logged straight into the meal. It never joins your foods.'],
      ['10.21', 'Saved meal', 'Built like the routine builder: the name, the ring, the foods with a delete disc, amount and drag handle, and Add food.'],
      ['10.22', 'Add food: Meals', '+ logs a whole saved meal into this meal, one entry per food, and turns into a check that takes it back off. Copy a day sits underneath.'],
      ['10.23', 'Copy a day', 'The last two weeks of logged days. + copies a whole day into the same meals, with one Undo.'],
      ['10.24', 'Meal options', 'The ••• on an open meal (and long-press on its row): Save as meal, Copy to today, Clear meal.'],
      ['10.25', 'Day nutrients', 'Every tracked nutrient for the day against your target: amount / target, a 4 px bar and the %. Macros in their colors; the rest neutral, orange only past a limit or upper limit, with "over". A floor reached gets a check.'],
      ['10.26', 'A nutrient\'s top foods', 'Where the day\'s sodium came from: the foods that gave the most, with their share.'],
      ['10.27', 'Missing data', 'A food with no value for a nutrient adds nothing, and is listed under Missing from. Totals are never guessed.'],
      ['10.28', 'Fill in missing nutrients', 'A packaged food lacking most vitamins and minerals borrows them from the closest built-in food. Only what\'s missing is copied; borrowed values show with "~".'],
      ['10.29', 'Scan', 'The camera fills the screen under a white top bar: Cancel, the meal, and the light when the phone has one. Two matching reads in a row look the code up. Type the number is always there; with no camera it\'s the whole screen.'],
      ['10.30', 'Scan result', 'Your own food for a barcode wins, then Open Food Facts. Nothing is logged until Log; the amount box opens the full amount screen. Wrong food? opens New food filled in from the scan, with the barcode.'],
      ['10.31', 'Settings: Food', 'Targets, and where foods come from. Look up foods online turns Open Food Facts search and barcode lookups on or off; the built-in USDA foods always work offline.'],
      ['10.32', 'Week', 'Average per day, days on target (90–103%) and days protein was hit, counting only past days with food. Stacked macro bars against the dashed target, an orange dot over days that went over; averages against target; then the seven days. Tap a bar or a day to open it.'],
      ['10.13', 'Nutrient targets', 'Every micronutrient from the US Dietary Reference Intakes for your sex and age. Limits say so; type your own number and Reset brings the DRI back.'],
    ],
  },
];

// ───────────────────────────── scenes

type Ctx = {
  p: Page;
  /** Navigate within the app (hash route). */
  go: (route: string) => Promise<void>;
  shot: (id: string) => Promise<void>;
  /** Capture the whole scrolling body, not just the first screen (0.1). */
  shotTall: (id: string) => Promise<void>;
  /** Tap the scrim above a sheet to close it. */
  dismiss: () => Promise<void>;
  /** Scroll so the element sits at the top of its scroller. */
  scrollTo: (text: string) => Promise<void>;
  scratch: string;
};
type Scene = { server: 'sample' | 'empty'; ids: string[]; run: (c: Ctx) => Promise<void>; clock?: Date };

const SCENES: Scene[] = [];
const scene = (server: Scene['server'], ids: string, run: Scene['run'], clock?: Date) => SCENES.push({ server, ids: ids.split(' '), run, clock });

scene('sample', '0.1', async ({ go, shotTall }) => {
  await go('/dev/ui');
  await shotTall('0.1');
});

scene('empty', '1.1 1.2 1.3 1.5 1.6 1.4 6.8 7.6', async ({ p, go, shot }) => {
  await go('/welcome');
  await shot('1.1');
  await p.click('Get started');
  await shot('1.2');
  await p.click('Continue in');
  await shot('1.3');
  await p.click('Continue');
  await shot('1.5');
  await p.click('Continue');
  await p.click('3+ years');
  await shot('1.6');
  await p.click('Done');
  await shot('1.4');
  await go('/history');
  await shot('6.8');
  await go('/progress');
  await shot('7.6');
});

scene('sample', 'PH3.1 PH3.2 PH3.3 PH3.4 PH3.5 PH3.6 PH3.7 PH3.8 PH3.9 4.35', async ({ p, go, shot }) => {
  await go('/calendar');
  if (await p.eval(`[...document.querySelectorAll('[role="tablist"][aria-label="Calendar views"] [role="tab"]')].map(e => e.getAttribute('aria-label')).join(',')`) !== 'Calendar,Routines,History') throw new Error('Calendar view tabs are out of order');
  await p.eval(`(async () => {
    const f = (await __og.db.folders.toArray()).find(f => f.active);
    const routines = (await __og.db.routines.toArray()).filter(r => r.folderId === f.id && !r.deletedAt).sort((a,b) => a.order-b.order);
    const ids = routines.map(r => r.id);
    await __og.db.folders.update(f.id, { schedule: { versions: [{ from: '2026-10-01', kind: 'weekly', days: [null,ids[0],ids[1],ids[0],ids[0],ids[2],null], onMiss: 'skip' }], overrides: {} } });
  })()`);
  await go('/');
  // PH3.1: capture weekday-only labels, borderless rest days and the blue today outline.
  await shot('PH3.1');
  if (!(await p.eval(`(() => {
    const today = [...document.querySelectorAll('small')].find(e => e.textContent === 'Today');
    const start = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === 'Start');
    const blank = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === '+ Blank workout');
    return today?.parentElement.classList.contains('text-accent') && start && blank && !!(start.compareDocumentPosition(blank) & Node.DOCUMENT_POSITION_FOLLOWING);
  })()`))) throw new Error('Home must label today in blue and place Blank workout below the scheduled workouts');
  await go('/calendar?day=2026-11-05');
  await shot('PH3.6');
  await go('/');
  await go('/calendar?day=2026-11-01');
  if (!(await p.eval(`(() => {
    const today = document.querySelector('button[aria-current="date"]');
    return today?.getAttribute('aria-pressed') === 'false' && getComputedStyle(today).boxShadow.includes('rgb(255, 255, 255)');
  })()`))) throw new Error('Unselected today must have a white calendar outline');
  // PH3.2: brighter planned codes, no planned borders or completed fills, and compact 44px rows with aligned date numbers above codes or dots.
  await shot('PH3.2');
  await p.click('Codes');
  if (!(await p.eval(`getComputedStyle(document.querySelector('button[aria-current="date"]')).boxShadow.includes('rgb(255, 255, 255)')`))) throw new Error('Today outline must remain visible with routine codes');
  await shot('PH3.3');
  await p.click('6M');
  await p.click({ sel: 'button[aria-label^="October 2026:"]' });
  if (!(await p.eval(`document.querySelector('[aria-label="Back to today"]')?.textContent?.includes('October 2026')`))) throw new Error('Month overview opened the wrong month');
  await p.click({ sel: '[role=tab]', text: 'History' });
  await shot('PH3.4');
  await p.click({ sel: '[role=tab]', text: 'Routines' });
  await shot('PH3.5');
  await go('/');
  await go('/calendar?day=2026-11-04');
  await shot('PH3.7');
  await p.click('Log it late');
  await shot('4.35');
  await p.eval(`(async () => { const w = (await __og.db.workouts.toArray()).find(w => w.status === 'active'); if (w) { const es = await __og.db.workoutExercises.where('workoutId').equals(w.id).toArray(); for (const e of es) await __og.db.workoutSets.where('workoutExerciseId').equals(e.id).delete(); await __og.db.workoutExercises.where('workoutId').equals(w.id).delete(); await __og.db.workouts.delete(w.id); } })()`);
  await go('/');
  await go('/calendar?day=2026-12-17');
  await shot('PH3.8');
  await p.click('Change this day');
  await shot('PH3.9');
  await go('/');
  await go('/calendar?day=2026-12-31');
  await p.click('Change this day');
  await p.click('Move workout to…');
  await p.find({ sel: 'button', text: 'Jan 1' });
});

scene('sample', 'PH3.10 PH3.11', async ({ p, go, shot }) => {
  await go('/');
  await p.eval(`(async () => {
    const f = (await __og.db.folders.toArray()).find(f => f.active);
    const rs = (await __og.db.routines.toArray()).filter(r => r.folderId === f.id && !r.deletedAt).sort((a,b) => a.order-b.order);
    await __og.db.folders.update(f.id, { schedule: {
      versions: [{ from: '2026-11-01', kind: 'weekly', days: [null,rs[0].id,rs[1].id,rs[0].id,rs[0].id,rs[2].id,null], onMiss: 'skip' }],
      overrides: { '2026-11-05': { routineId: rs[1].id }, '2026-11-06': { routineId: null }, '2026-11-07': { routineId: rs[2].id } }
    } });
  })()`);
  await go('/calendar?day=2026-11-01');
  // PH3.10: selected inactive dates and rest-code dashes stay white on blue.
  await shot('PH3.10');
  await p.click('Codes');
  await go('/');
  await shot('PH3.11');
});

scene('sample', 'PH3.12 PH3.14 PH3.15', async ({ p, go, shot }) => {
  await go('/');
  await p.eval(`(async () => {
    const f = (await __og.db.folders.toArray()).find(f => f.active);
    const rs = (await __og.db.routines.toArray()).filter(r => r.folderId === f.id && !r.deletedAt).sort((a,b) => a.order-b.order);
    await __og.db.folders.update(f.id, { schedule: { versions: [{ from: '2026-11-05', anchor: '2026-11-05', kind: 'cycle', days: [...rs.map(r => r.id), null], onMiss: 'wait' }], overrides: {} } });
  })()`);
  await go('/calendar?day=2026-11-05');
  await p.click('Change this day');
  await shot('PH3.12');
  await p.click('Move workout to…');
  await p.click({ sel: 'button', text: 'Fri', start: true });
  await p.find({ sel: 'button[aria-label*="Nov 7"][aria-label*="changed"]' });
  await p.click({ sel: 'button[aria-label*="Nov 6"]' });
  if (!(await p.eval(`!!document.querySelector('button[aria-label*="Nov 7"] svg rect')`))) throw new Error('Changed border did not update without navigation');
  await shot('PH3.14');
  await p.click({ sel: 'button[aria-label*="Nov 7"]' });
  if (await p.eval(`!!document.querySelector('[role="dialog"]')`)) throw new Error('First tap should only select the day');
  await p.click({ sel: 'button[aria-label*="Nov 7"]' });
  await p.find('Skip this workout');
  await shot('PH3.15');
});

scene('sample', 'PH3.13', async ({ p, go, shot }) => {
  await go('/');
  const folderId = await p.eval(`(async () => (await __og.db.folders.toArray()).find(f => f.active).id)()`);
  await go(`/plan/${folderId}/schedule`);
  await p.click('Clear changes');
  await shot('PH3.13');
});

scene('sample', '3.7', async ({ p, go, shot }) => {
  await go('/');
  await p.eval(`(async () => {
    const f = (await __og.db.folders.toArray()).find(f => f.active);
    const routines = (await __og.db.routines.toArray()).filter(r => r.folderId === f.id && !r.deletedAt).sort((a,b) => a.order-b.order);
    const ids = routines.map(r => r.id);
    await __og.db.folders.update(f.id, { schedule: { versions: [{ from: '2026-10-01', kind: 'weekly', days: [null,ids[0],ids[1],ids[0],null,null,ids[2]], onMiss: 'skip' }], overrides: {} } });
  })()`);
  await go('/calendar');
  await go('/');
  await p.find({ sel: 'span', text: 'Rest today' });
  await p.find({ sel: 'p', text: 'You missed Push yesterday. Today is a rest day.' });
  await shot('3.7');
  // Today stays visible without the missed note and even when every upcoming day is rest.
  await p.eval(`(async () => {
    const f = (await __og.db.folders.toArray()).find(f => f.active);
    await __og.db.folders.update(f.id, { schedule: { versions: [{ from: '2026-11-05', kind: 'weekly', days: [null,null,null,null,null,null,null], onMiss: 'skip' }], overrides: {} } });
  })()`);
  await go('/calendar');
  await go('/');
  await p.find({ sel: 'span', text: 'Rest today' });
  if (await p.eval(`document.body.textContent.includes('You missed')`)) throw new Error('Unexpected missed-workout note');
});

scene('sample', '2.1 2.2 2.7 2.8 2.10 2.9', async ({ p, go, shot, dismiss }) => {
  await go('/plans');
  await p.click({ sel: '[role=tab]', text: 'Routines' });
  await shot('2.1');
  await p.click('New');
  await shot('2.2');
  await dismiss();
  await p.hold({ sel: 'button', text: 'Pull' });
  await shot('2.8');
  await p.click('Move to folder…');
  await shot('2.10');
  await go('/');
  await go('/plans');
  await p.click('Edit');
  await shot('2.7');
  await p.click('PPL options');
  await shot('2.9');
});

scene('sample', '2.11 2.3 2.4 2.12 2.13 2.5 2.6', async ({ p, go, shot, dismiss, scrollTo }) => {
  await go('/plans');
  await p.click({ sel: '[role=tab]', text: 'Routines' });
  await p.click({ sel: 'button', text: 'Push' });
  await shot('2.11');
  await p.click('Edit');
  await shot('2.3');
  await p.click({ text: 'Set 1 reps', nth: 0 });
  await shot('2.4');
  await p.click('Close keypad');
  await scrollTo('Reorder DB Overhead Extension');
  await p.eval(`document.querySelector('main, [data-scroll], .overflow-y-auto')?.scrollBy(0, -60)`);
  await shot('2.12');
  await p.click('Lateral Raise options');
  await p.click('Superset with…');
  await shot('2.13');
  await dismiss();
  await dismiss();
  await p.click('Add exercise');
  await shot('2.5');
  await p.click({ sel: 'input[type=search], input[placeholder^=Search]' });
  await p.type('row');
  await shot('2.6');
});

scene('sample', '2.16 2.17 2.18 2.19 3.4 2.15 2.14 2.20 2.21 2.23 2.24 3.5', async ({ p, go, shot, dismiss }) => {
  await go('/plans');
  await p.click({ sel: '[role=tab]', text: 'Routines' });
  await p.click({ sel: 'button', text: 'PPL', nth: 0 });
  await p.click('No schedule');
  await p.click('Weekly split');
  await shot('2.16');
  await p.click('Repeating cycle');
  await p.click('Next');
  await shot('2.17');
  await p.click({ text: 'Back', nth: 0 });
  await p.click('Weekly split');
  await p.click('Next');
  const week = { Sun: 'Push', Mon: 'Pull', Tue: 'Legs', Wed: 'Push', Thu: 'Pull', Fri: 'Legs' };
  for (const [day, routine] of Object.entries(week)) {
    await p.click({ sel: 'button', text: day, start: true });
    if (day === 'Sun') await shot('2.19');
    await p.click({ sel: 'button', text: routine, start: true });
  }
  await shot('2.18');
  await p.click('Save', 800);
  await go('/');
  await shot('3.4');
  // Pretend the plan started on Sunday, so Wednesday's Push counts as missed.
  await p.eval(`(async () => {
    const f = (await __og.db.folders.toArray()).find((f) => f.schedule);
    f.schedule.versions[0].from = '2026-11-01';
    await __og.db.folders.put(f);
  })()`);
  await go('/plans');
  await go('/');
  await shot('3.5');
  await go('/plans');
  await shot('2.14');
  await p.click({ sel: 'button', text: 'PPL', nth: 0 });
  // 2.15: capture the stacked weekday/date list, including today's blue date.
  await shot('2.15');
  await p.click('Calendar');
  // 2.20: small dates over large codes, with SVG checkmarks on completed extra days.
  await shot('2.20');
  await p.click({ sel: 'button', text: 'Nov 6', start: false }).catch(() => p.click({ text: 'Fri', nth: 0 }));
  await shot('2.21');
  await dismiss();
  await go('/plans');
  await p.click({ sel: '[role=tab]', text: 'Calendar' });
  await shot('2.23');
  await p.click('Codes');
  await shot('2.24');
});

scene('sample', '4.1 4.36 4.2 4.15 4.16 4.17 4.18 4.3 4.5 4.4 4.6 4.8 4.9 4.10 4.12 4.13 4.19 4.20 4.21 4.22 4.11 4.14 4.7 5.4 3.2 3.3 5.1 5.2 5.3', async ({ p, go, shot, dismiss }) => {
  await go('/');
  await p.click('Start Push', 1500);
  await p.click('Complete set W');
  await p.click('Complete set 1');
  await shot('4.1');

  await p.click('Set 2 weight');
  await shot('4.2');
  await p.click('Done with this box');
  await shot('4.15');

  await p.click('Set 2 weight');
  await p.click('Plates');
  await shot('4.16');
  for (const plate of [45, 45, 45, 45, 45, 45, 45, 25, 10]) await p.click(`Add ${plate} lb`, 120);
  await shot('4.17');
  await p.click('Choose the bar');
  await shot('4.18');
  await dismiss();
  for (let i = 0; i < 9; i++) await p.click('Undo', 120);
  await p.click('Done');
  await p.click('Close keypad').catch(() => {});

  await p.click('Complete set 2');
  await p.click('+ Drop');
  await shot('4.3');
  await p.click('Close keypad').catch(() => {});

  await p.click('Set 3 options');
  await shot('4.5');
  await dismiss();

  const r = await p.find('Set 3 weight');
  await p.press(r.x, r.y);
  await p.moveTo(r.x - 150, r.y, 12, r.x, r.y);
  await shot('4.4');
  await p.moveTo(r.x, r.y, 12, r.x - 150, r.y);
  await p.release(r.x, r.y);
  await sleep(400);
  await p.click('Close keypad').catch(() => {});

  await p.click('Exercise options');
  await shot('4.6');
  await dismiss();

  await p.click('All 6 variations');
  await shot('4.36');
  await dismiss();

  await p.click('History, charts and records');
  await shot('4.8');
  await p.click('Records');
  await shot('4.9');
  await p.click('History');
  await shot('4.10');
  await dismiss();

  await p.click('Exercise 1 of 9');
  await shot('4.12');
  await p.click('Edit');
  await shot('4.13');
  await p.click('Done');

  await p.click({ sel: 'button', text: 'DB Overhead Extension' });
  await shot('4.19');
  await p.click({ text: 'Complete set 1', nth: 0 });
  await shot('4.20');

  await p.click({ text: 'All exercises', nth: 0 });
  await p.click({ sel: 'button', text: 'Treadmill' });
  await shot('4.21');
  await p.click('Segment 1 time');
  await shot('4.22');
  await p.click('Close keypad');
  await p.click('Complete segment 1');
  await p.click('Complete segment 2');
  await shot('4.11');

  await p.click('All exercises');
  await p.click('+ Add exercise');
  await p.click({ sel: 'input[placeholder^=Search]' });
  await p.type('chin');
  await p.click({ sel: 'button', text: 'Chin-up', start: true });
  await shot('4.14');
  await p.click('Done', 800);
  await shot('4.7');
  await p.click('Set 1 reps');
  await p.click({ sel: '[role=group] button', text: '8' });
  await p.click('Done: complete');
  await p.click('Close keypad');

  await p.click('Workout options');
  await shot('5.4');
  await dismiss();

  await go('/');
  await shot('3.2');
  await go('/history');
  await shot('3.3');
  await p.click('Resume');

  await p.click('Finish');
  await shot('5.1');
  await p.click('Count them and finish');
  await shot('5.2');
  await p.click('Just this time', 1500);
  await shot('5.3');
});

scene('sample', '3.1', async ({ go, shot }) => {
  await go('/');
  await shot('3.1');
});

scene('sample', '4.24', async ({ p, go, shot }) => {
  await go('/');
  await p.click('Start Pull', 1500);
  await p.click('All exercises');
  await p.click({ sel: 'button', text: 'Rower' });
  await p.click('Complete segment 1');
  await shot('4.24');
});

scene('sample', '4.23', async ({ p, go, shot }) => {
  await go('/');
  await p.click('Start Legs', 1500);
  await p.click('All exercises');
  await p.click({ sel: 'button', text: 'Bike' });
  await shot('4.23');
});

scene('sample', '6.1 6.2 6.3 6.4 6.5 6.6 6.7', async ({ p, go, shot }) => {
  await go('/calendar');
  await p.click({ sel: 'button', text: '3', start: true, nth: 0 }).catch(() => {});
  await shot('6.1');
  await p.click('6M');
  await shot('6.2');
  await p.click('Year');
  await shot('6.3');
  await p.click('All');
  await shot('6.4');
  await p.click('Month');
  await p.click({ sel: '[role=tab]', text: 'History' });
  await shot('6.5');
  await p.click({ sel: 'button', text: 'min cardio', nth: 0 });
  await shot('6.6');
  await p.click('Edit');
  await shot('6.7');
});

scene('sample', '7.1 7.2 7.3 7.4 7.5 7.7 7.8 7.9', async ({ p, go, shot }) => {
  await go('/progress');
  await shot('7.1');
  await p.click({ sel: 'button', text: 'Lat Pulldown', nth: 0 });
  await shot('7.2');
  await p.click('Top set');
  await shot('7.3');
  await p.click('Records');
  await shot('7.4');
  await go('/progress/pinned');
  await shot('7.5');
  await go('/progress');
  await p.click('Cardio');
  await shot('7.7');
  await p.click({ sel: 'button', text: 'Treadmill', nth: 0 });
  await shot('7.8');
  await go('/progress/cardio-records');
  await shot('7.9');
});

scene('sample', '8.1 8.7 8.8 8.2 8.4 8.3 8.5 8.6', async ({ p, go, shot, dismiss }) => {
  await p.eval(`localStorage.removeItem('og-exercise-sort')`);
  await go('/exercises');
  await shot('8.1');
  await p.click({ sel: 'button', text: 'Arms', nth: 0 });
  await p.find('Show hidden');
  await p.eval(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Show hidden')?.scrollIntoView({ block: 'end' })`);
  await sleep(400);
  await shot('8.7');
  await go('/settings');
  await go('/exercises');
  await p.click({ sel: 'button', text: 'Lat Pulldown', start: true, nth: 0 });
  await p.click('All 8 variations');
  await shot('8.8');
  await dismiss();
  await go('/exercises');
  await p.click({ sel: 'button', text: 'Bench Press', start: true, nth: 0 });
  await shot('8.2');
  await p.click('Edit links');
  await shot('8.4');
  await go('/exercises');
  await p.click({ sel: 'button', text: 'Bench Press', start: true, nth: 0 });
  await p.click('Edit');
  await shot('8.3');
  await go('/exercises');
  await p.click('New exercise');
  await p.click('Cardio');
  await shot('8.5');
  await go('/routine/new');
  await p.click('Add exercise');
  await p.click({ sel: 'button', text: 'Cardio', nth: 0 });
  await shot('8.6');
});

scene('sample', '9.1 9.2 9.6 9.5 9.3 9.4', async ({ p, go, shot, scratch }) => {
  await go('/settings');
  await shot('9.1');
  await p.click('Units');
  await shot('9.2');
  await go('/settings');
  await p.click('Delete all data');
  await p.click({ sel: 'input' });
  await p.type('DEL');
  await shot('9.6');
  await go('/settings/import');
  writeFileSync(join(scratch, 'strong.csv'), STRONG_CSV);
  await p.upload('input[type=file]', join(scratch, 'strong.csv'));
  await shot('9.5');
  await go('/settings');
  // A real backup file for the restore screen. (The share sheet itself is iOS, not the app.)
  const json = await p.eval<string>(`import('/src/data/backup.ts').then(async (m) => JSON.stringify(await m.buildBackup()))`);
  writeFileSync(join(scratch, 'opengym-backup.json'), json);
  await p.click('Back up now', 600);
  await p.eval('scrollTo(0, 0); document.querySelector("main *")?.scrollTo?.(0, 0)');
  await shot('9.3');
  await p.upload('input[type=file][accept*=json]', join(scratch, 'opengym-backup.json'));
  await shot('9.4');
});

// Effort (SPEC §12): settings, a routine target, the pad in both modes, then Progress.
scene('sample', '9.8 9.7 2.22 4.25 4.26 7.10 7.11', async ({ p, go, shot, dismiss }) => {
  await go('/settings/effort');
  await p.click({ sel: 'button', text: 'RPE', start: true });
  await shot('9.8');
  await dismiss();
  await p.click('Use effort in est. 1RM');
  await shot('9.7');

  await go('/plans');
  await p.click({ sel: '[role=tab]', text: 'Routines' });
  await p.click({ sel: 'button', text: 'Push' });
  await p.click('Edit');
  for (const [set, key] of [['Set 1 reps', '7 RPE'], ['Set 2 reps', '8 RPE'], ['Set 3 reps', '9 RPE']]) {
    await p.click({ text: set, nth: 0 });
    await p.click({ sel: '[role=tab]', text: 'rpe' });
    await p.click(key);
  }
  await p.click('Close keypad');
  await shot('2.22');
  await p.click('Save', 800);

  await go('/');
  await p.click('Start Push', 1500);
  await p.click('Complete set W');
  await p.click('Set 1 reps');
  await p.click('Done with this box');
  await p.click('7 RPE');
  await p.click('Done: complete');
  await p.click('Done with this box');
  await p.click('Done with this box');
  await p.click('8 RPE');
  await p.click('Add a half');
  await shot('4.25');

  await p.eval(`__og.db.settings.update('settings', { effort: 'rir' })`);
  await p.click('Done: complete');
  await p.click('Done with this box');
  await p.click('Done with this box');
  await p.click('1 RIR');
  await p.click('Add a half');
  await shot('4.26');
  await p.click('Close keypad');

  await p.eval(`__og.db.settings.update('settings', { effort: 'rpe' })`);
  await go('/progress/lift/ex-bench-press');
  await shot('7.10');
  await p.click({ sel: '[role=tab]', text: 'History' });
  await shot('7.11');
});

// Training (training-logic §9, proposal A1–A9): the bar, hints, Why, Auto, a gap.
/** Rewrite the newest session of a lift: [weight, reps, rpe] per working set. */
const setLastSession = (exerciseId: string, sets: [number, number, number][]) => `(async () => {
  const wes = await __og.db.workoutExercises.where('exerciseId').equals(${JSON.stringify(exerciseId)}).toArray();
  const ws = await __og.db.workouts.bulkGet(wes.map((w) => w.workoutId));
  const i = ws.reduce((b, w, k) => (w && (!ws[b] || w.startedAt > ws[b].startedAt) ? k : b), 0);
  const working = (await __og.db.workoutSets.where('workoutExerciseId').equals(wes[i].id).toArray()).filter((s) => s.kind === 'working').sort((a, b) => a.order - b.order);
  const next = ${JSON.stringify(sets)};
  for (let k = 0; k < working.length; k++) await __og.db.workoutSets.update(working[k].id, next[k] ? { weight: next[k][0], reps: next[k][1], rpe: next[k][2] } : { completed: false });
})()`;

scene('sample', '4.27 4.28 4.29 4.30', async ({ p, go, shot, dismiss }) => {
  await p.eval(setLastSession('ex-bench-press', [[155, 12, 8], [155, 10, 8.5], [155, 8, 9]]));
  await go('/');
  await p.click('Start Push', 1500);
  await shot('4.27');
  await p.click('Why');
  await shot('4.28');
  await p.click('Recent weeks');
  await shot('4.29');
  await dismiss();
  await p.click('Use ');
  await shot('4.30');
});

/** Remove a lift from every workout in the last `days`, so its last session is older (a gap). */
const dropRecent = (exerciseId: string, days: number) => `(async () => {
  const since = ${NOW.getTime()} - ${days} * 864e5;
  for (const we of await __og.db.workoutExercises.where('exerciseId').equals(${JSON.stringify(exerciseId)}).toArray()) {
    const w = await __og.db.workouts.get(we.workoutId);
    if (!w || w.startedAt < since) continue;
    await __og.db.workoutSets.where('workoutExerciseId').equals(we.id).delete();
    await __og.db.workoutExercises.delete(we.id);
  }
})()`;

/** Scale the working weights of a lift's last `n` sessions (to make a slip). */
const scaleRecent = (exerciseId: string, n: number, factor: number) => `(async () => {
  const wes = await __og.db.workoutExercises.where('exerciseId').equals(${JSON.stringify(exerciseId)}).toArray();
  const dated = await Promise.all(wes.map(async (we) => ({ we, at: (await __og.db.workouts.get(we.workoutId))?.startedAt ?? 0 })));
  dated.sort((a, b) => b.at - a.at);
  for (const { we } of dated.slice(0, ${n})) {
    for (const s of await __og.db.workoutSets.where('workoutExerciseId').equals(we.id).toArray()) {
      if (s.kind === 'working' && s.weight) await __og.db.workoutSets.update(s.id, { weight: Math.round((s.weight * ${factor}) / 5) * 5 });
    }
  }
})()`;

const addGoal = (g: Record<string, unknown>) => `__og.db.goals.add(${JSON.stringify({ id: `goal-${Math.random().toString(36).slice(2)}`, createdAt: NOW.getTime(), updatedAt: NOW.getTime(), startTau: 78, ...g })})`;

scene('sample', '4.31', async ({ p, go, shot }) => {
  await p.eval(setLastSession('ex-bench-press', [[155, 12, 8], [155, 10, 8.5], [155, 8, 9]]));
  await p.eval(`__og.db.settings.update('settings', { suggestMode: 'auto' })`);
  await go('/');
  await p.click('Start Push', 1500);
  await shot('4.31');
});

/** Add a drop after working set `n` (1-based) of a lift's newest session. */
const addLastDrop = (exerciseId: string, n: number, weight: number, reps: number) => `(async () => {
  const wes = await __og.db.workoutExercises.where('exerciseId').equals(${JSON.stringify(exerciseId)}).toArray();
  const ws = await __og.db.workouts.bulkGet(wes.map((w) => w.workoutId));
  const i = ws.reduce((b, w, k) => (w && (!ws[b] || w.startedAt > ws[b].startedAt) ? k : b), 0);
  const working = (await __og.db.workoutSets.where('workoutExerciseId').equals(wes[i].id).toArray()).filter((s) => s.kind === 'working').sort((a, b) => a.order - b.order);
  const parent = working[${n - 1}];
  await __og.db.workoutSets.add({ id: 'shot-drop', workoutExerciseId: wes[i].id, order: parent.order + 0.5, kind: 'drop', parentSetId: parent.id, weight: ${weight}, reps: ${reps}, completed: true, createdAt: ${NOW.getTime()}, updatedAt: ${NOW.getTime()} });
})()`;

scene('sample', '4.34', async ({ p, go, shot }) => {
  await p.eval(setLastSession('ex-bench-press', [[155, 12, 8], [155, 10, 8.5], [155, 8, 9]]));
  await p.eval(addLastDrop('ex-bench-press', 3, 115, 9));
  await go('/');
  await p.click('Start Push', 1500);
  await shot('4.34');
});

scene('sample', '4.32 4.33', async ({ p, go, shot }) => {
  await p.eval(dropRecent('ex-bench-press', 26));
  await p.eval(`__og.db.settings.update('settings', { askAboutGaps: true })`);
  await go('/');
  await p.click('Start Push', 1500);
  await shot('4.32');
  await p.click('I took a break');
  await shot('4.33');
});

scene('sample', '5.5', async ({ p, go, shot }) => {
  await p.eval(addGoal({ exerciseId: 'ex-bench-press', weight: 155, reps: 10, by: NOW.getTime() + 21 * 864e5, startE1rm: 215, startedAt: NOW.getTime() - 70 * 864e5, startRate: 1.5 }));
  await go('/');
  await p.click('Start Push', 1500);
  await p.click('Complete set W');
  await p.click('Complete set 1');
  await p.click('Finish');
  await p.click('Drop them and finish');
  await p.click('Just this time', 1500);
  await shot('5.5');
});

scene('sample', '7.13 7.16 7.18 7.17 7.19 7.12 7.14 3.6 7.15', async ({ p, go, shot }) => {
  await go('/progress/lift/ex-bench-press/trend');
  await shot('7.13');
  await go('/progress/goal/new?ex=ex-bench-press');
  await p.click({ sel: 'input[aria-label="Goal weight"]' });
  await p.type('245');
  await p.click({ sel: 'input[aria-label="Goal reps"]' });
  await p.eval(`document.querySelector('input[aria-label="Goal reps"]').select()`);
  await p.type('5');
  await p.eval('document.activeElement?.blur()');
  await shot('7.16');
  await p.click('Save', 800);
  await shot('7.18');
  await go('/progress/goal/new?ex=ex-preacher-curl');
  await p.click({ sel: 'input[aria-label="Goal weight"]' });
  await p.type('100');
  await p.click({ sel: 'input[aria-label="Goal reps"]' });
  await p.eval(`document.querySelector('input[aria-label="Goal reps"]').select()`);
  await p.type('8');
  await p.eval('document.activeElement?.blur()');
  await shot('7.17');
  await p.click('Cancel');
  // A goal set 10 weeks ago at a pace the lift didn't keep.
  await p.eval(addGoal({ exerciseId: 'ex-lat-pulldown', weight: 230, reps: 5, by: NOW.getTime() + 56 * 864e5, startE1rm: 180, startedAt: NOW.getTime() - 70 * 864e5, startRate: 3.5 }));
  await p.eval(addGoal({ exerciseId: 'ex-leg-curl', weight: 200, reps: 8, startE1rm: 190, startedAt: NOW.getTime() - 30 * 864e5, startRate: 1.5 }));
  await go('/progress');
  await p.click('Goals');
  await p.click({ sel: 'button', text: 'Lat Pulldown', start: true });
  await shot('7.19');
  await go('/progress');
  await shot('7.12');
  await p.eval(scaleRecent('ex-machine-chest-press', 5, 0.88));
  await sleep(1500);
  await go('/progress/lift/ex-machine-chest-press/trend');
  await shot('7.14');
  await p.eval(`__og.db.settings.update('settings', { pinnedCustomized: true, pinnedExerciseIds: ['ex-bench-press', 'ex-machine-chest-press', 'ex-lat-pulldown', 'ex-leg-press'] })`);
  await go('/');
  await p.eval(`document.querySelector('main, [data-scroll], .overflow-y-auto')?.scrollBy(0, 400)`);
  await shot('3.6');
  await go('/progress/month');
  await shot('7.15');
});

scene('sample', '9.9 9.11 9.10', async ({ p, go, shot }) => {
  await go('/settings/training');
  await shot('9.9');
  await p.click('Effort target');
  await shot('9.11');
  await go('/settings/training');
  await p.click('Training phase');
  await p.click('Maintaining');
  await shot('9.10');
});

// ───────────────────────────── 10 Food

/** Wait for the built-in food database to finish loading, so no progress line shows. */
const foodReady = async (p: Page) => {
  for (let i = 0; i < 120; i++) {
    if (await p.eval<boolean>(`(async () => !!(await __og.db.settings.get('settings'))?.food?.usdaRelease)()`)) return;
    await sleep(500);
  }
  throw new Error('food database did not load');
};

scene(
  'sample',
  '10.1',
  async ({ p, go, shot }) => {
    await go('/food');
    await foodReady(p);
    await shot('10.1');
  },
  new Date(2026, 10, 5, 12, 40),
);

scene('sample', '10.2 10.3 10.4', async ({ p, go, shot }) => {
  await go('/food');
  await foodReady(p);
  await shot('10.2');
  await go('/food/day/2026-11-04');
  await shot('10.3');
  await go('/food/day/2026-11-06');
  await shot('10.4');
});

scene('sample', '10.14 10.15 10.16 10.17 10.18', async ({ p, go, shot, dismiss }) => {
  await go('/food');
  await foodReady(p);
  await go('/food/add?day=2026-11-05&meal=dinner');
  await shot('10.14');
  await p.click('Search foods');
  await p.type('chicken');
  await sleep(900);
  await shot('10.15');
  await p.click('Chicken breast, grilled');
  await shot('10.16');
  await go('/food/day/2026-11-05');
  await p.click('Lunch');
  await p.click('Chicken breast, grilled');
  await shot('10.17');
  await p.click('Meal');
  await shot('10.18');
  await dismiss();
});

const padKeys = async (p: Page, keys: string) => {
  for (const k of keys) await p.click({ sel: '[aria-label="Keypad"] button', text: k, start: true });
};

scene('sample', '10.19 10.20 10.21 10.22 10.23 10.24', async ({ p, go, shot, dismiss }) => {
  await go('/food');
  await foodReady(p);
  await go('/food/new?day=2026-11-05&meal=breakfast&name=Overnight%20oats&kcal=410&p=24&c=52&f=11');
  await p.click('Serving size');
  await padKeys(p, '250');
  await shot('10.19');
  await go('/food/quick?day=2026-11-05&meal=dinner');
  await padKeys(p, '850');
  await p.click('Protein');
  await padKeys(p, '45');
  await shot('10.20');
  await go('/food/copy-day?day=2026-11-05');
  await shot('10.23');
  await go('/food/day/2026-11-04');
  await p.click('Lunch');
  await p.click('Lunch options');
  await shot('10.24');
  await dismiss();
  await go('/food/add?day=2026-11-05&meal=dinner');
  await p.click({ sel: 'button', text: 'Meals' });
  await p.click('Post-workout shake');
  await shot('10.21');
  await p.click('Cancel');
  await p.click('Add Chicken rice bowl');
  await sleep(300);
  await shot('10.22');
});

scene('sample', '10.25 10.26 10.27 10.28', async ({ p, go, shot }) => {
  await go('/food');
  await foodReady(p);
  await go('/food/nutrients/2026-11-05');
  await shot('10.25');
  await go('/food/nutrients/2026-11-05/sodium');
  await shot('10.26');
  await go('/food/nutrients/2026-11-05/vitD');
  await shot('10.27');
  await go('/food/fill/sample-bar');
  await sleep(600);
  await shot('10.28');
});

const OFF_MOCK = {
  search: [],
  products: {
    '5012345678900': {
      product_name: 'Oat & honey granola bar',
      brands: 'Field Day',
      serving_size: '1 bar (40 g)',
      serving_quantity: 40,
      nutriments: { 'energy-kcal_100g': 430, proteins_100g: 8.5, carbohydrates_100g: 62, fat_100g: 16, fiber_100g: 6, sugars_100g: 24, 'saturated-fat_100g': 3, sodium_100g: 0.18 },
    },
  },
};

scene('sample', '10.29 10.30 10.31', async ({ p, go, shot }) => {
  await go('/food');
  await foodReady(p);
  await p.eval(`__og.off = ${JSON.stringify(OFF_MOCK)}`);
  await go('/food/scan?day=2026-11-05&meal=dinner');
  await sleep(1500);
  await shot('10.29');
  await go('/food');
  await go('/food/scan?day=2026-11-05&meal=dinner&code=5012345678900');
  await sleep(1200);
  await shot('10.30');
  await go('/settings/food');
  await shot('10.31');
});

scene('sample', '10.32', async ({ p, go, shot }) => {
  await go('/food');
  await foodReady(p);
  await go('/food/week/2026-11-05');
  await shot('10.32');
});

scene('sample', '10.10 10.11 10.12 10.13', async ({ p, go, shot }) => {
  await go('/food/targets');
  await shot('10.10');
  await p.click('High protein');
  await shot('10.11');
  await p.click('Custom');
  await p.click('More protein');
  await shot('10.12');
  await p.click('Lifter');
  await p.click('Nutrient targets');
  await shot('10.13');
});

scene('empty', '10.5 10.6 10.7 10.8 10.9', async ({ p, go, shot }) => {
  await go('/welcome');
  await p.click('Get started');
  await p.click('Continue in');
  await p.click('Continue');
  await p.click('Continue');
  await p.click('3+ years');
  await p.click('Done');
  await go('/food');
  await shot('10.5');
  await p.click('Set targets');
  await p.click('Male');
  for (const [field, keys] of [['Age', '29'], ['Height · feet', '5'], ['Height · inches', '11'], ['Weight', '190']]) {
    await p.click(field);
    for (const k of keys) await p.click({ sel: '[aria-label="Keypad"] button', text: k, start: true });
  }
  await p.click('On your feet');
  await p.click('Weight');
  await shot('10.6');
  await p.click('Close keypad');
  await p.click('Next');
  await p.click('Lose fat');
  await p.click('Goal weight');
  for (const k of '180') await p.click({ sel: '[aria-label="Keypad"] button', text: k, start: true });
  await p.click('Close keypad');
  await shot('10.7');
  await p.click('Next');
  await shot('10.8');
  await p.click('Next');
  await shot('10.9');
});

const STRONG_CSV = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
2024-06-03 18:04:11,"Push A",1h 2m,"Bench Press (Barbell)",W,95.0,10,0,0,"","",
2024-06-03 18:04:11,"Push A",1h 2m,"Bench Press (Barbell)",1,135.0,8,0,0,"","",
2024-06-03 18:04:11,"Push A",1h 2m,"Bench Press (Barbell)",2,135.0,6,0,0,"","",
2024-06-03 18:04:11,"Push A",1h 2m,"Incline Bench Press (Dumbbell)",1,40,10,0,0,"","",
2024-06-03 18:04:11,"Push A",1h 2m,"Chest Fly (Cable)",1,30,12,0,0,"","",
2024-06-03 18:04:11,"Push A",1h 2m,"Triceps Pushdown (Cable - Straight Bar)",1,50,12,0,0,"","",
2024-06-05 07:30:00,"Legs",45m,"Squat (Barbell)",1,185,5,0,0,"","",
2024-06-05 07:30:00,"Legs",45m,"Leg Press",1,270,10,0,0,"","",
2024-06-05 07:30:00,"Legs",45m,"Bulgarian Split Squat",1,30,8,0,0,"","",
2024-06-07 07:30:00,"Pull",50m,"Lat Pulldown (Cable)",1,120,10,0,0,"","",
2024-06-07 07:30:00,"Pull",50m,"Seated Row (Cable)",1,110,10,0,0,"","",
2024-06-07 07:30:00,"Pull",50m,"Face Pull",1,40,15,0,0,"","",
`;

// ───────────────────────────── runner

function startServer(port: number, testMode: boolean): ChildProcess {
  return spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), '--port', String(port), '--strictPort'], {
    cwd: root,
    env: { ...process.env, VITE_TEST_MODE: testMode ? 'true' : 'false' },
    stdio: 'ignore',
  });
}

async function waitFor(url: string) {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(200);
  }
  throw new Error(`${url} didn't start`);
}

/**
 * The camera picture for the scanner (10.29): a package with an EAN-13 barcode on a dark counter,
 * as one landscape Y4M frame (Chrome loops it as the fake camera). The check digit is wrong on
 * purpose, so the capture shows the scanner waiting; 10.30 looks the code up through the URL.
 */
function writeCameraFrame(path: string, code = '5012345678901') {
  const W = 1280;
  const H = 720;
  const y = new Uint8Array(W * H).fill(52);
  const u = new Uint8Array((W / 2) * (H / 2)).fill(126);
  const v = new Uint8Array((W / 2) * (H / 2)).fill(131);
  const rect = (x0: number, y0: number, x1: number, y1: number, Y: number, U = 128, V = 128) => {
    for (let r = y0; r < y1; r++) for (let c = x0; c < x1; c++) y[r * W + c] = Y;
    for (let r = y0 >> 1; r < y1 >> 1; r++)
      for (let c = x0 >> 1; c < x1 >> 1; c++) {
        u[r * (W / 2) + c] = U;
        v[r * (W / 2) + c] = V;
      }
  };
  rect(470, 0, 810, 720, 150, 104, 150); // the package
  rect(530, 290, 750, 430, 236); // the white label
  const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
  const R = L.map((p) => [...p].map((b) => (b === '1' ? '0' : '1')).join(''));
  const G = R.map((p) => [...p].reverse().join(''));
  const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
  const d = [...code].map(Number);
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (PARITY[d[0]][i - 1] === 'L' ? L : G)[d[i]];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += R[d[i]];
  bits += '101';
  const m = 2;
  const x0 = (W - bits.length * m) >> 1;
  [...bits].forEach((b, i) => b === '1' && rect(x0 + i * m, 310, x0 + (i + 1) * m, 410, 18));
  writeFileSync(path, Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F30:1 Ip A1:1 C420jpeg\nFRAME\n`), y, u, v]));
}

async function main() {
  const filters = process.argv.slice(2);
  const wanted = (id: string) => !filters.length || filters.some((f) => id === f || id.startsWith(f.endsWith('.') ? f : `${f}.`) || id.startsWith(f + '.'));
  const scenes = SCENES.filter((s) => s.ids.some(wanted));
  mkdirSync(OUT, { recursive: true });
  const scratch = mkdtempSync(join(tmpdir(), 'og-screens-'));
  const camera = join(scratch, 'camera.y4m');
  writeCameraFrame(camera);
  const ports = { sample: 5180, empty: 5181 };
  const servers = [startServer(ports.sample, true), startServer(ports.empty, false)];
  let failed = 0;
  try {
    await Promise.all(Object.values(ports).map((port) => waitFor(`http://localhost:${port}/`)));
    for (const s of scenes) {
      const b = await Browser.launch({ camera });
      try {
        const p = await b.newPage();
        await p.viewport(390, 844, 2);
        await p.send('Emulation.setUserAgentOverride', { userAgent: IPHONE, platform: 'iPhone' });
        await p.fixClock(s.clock ?? NOW);
        const base = `http://localhost:${ports[s.server]}/`;
        await p.goto(base);
        await p.find({ sel: 'nav, h1' }, 20000); // seeded and rendered
        // Sample data turns effort on as RIR; captures show the default (off) unless a scene turns it on.
        if (s.server === 'sample') await p.eval(`__og.db.settings.update('settings', { effort: 'off', effortExplained: false })`);
        const ctx: Ctx = {
          p,
          scratch,
          go: async (route) => {
            await p.eval(`location.hash = ${JSON.stringify('#' + route)}`);
            await sleep(700);
          },
          dismiss: async () => {
            await p.tap(195, 30);
            await sleep(450);
          },
          scrollTo: async (text) => {
            await p.find(text);
            await p.eval(`[...document.querySelectorAll('[aria-label], button')].reverse().find((e) => (e.getAttribute('aria-label') || e.textContent.trim()) === ${JSON.stringify(text)})?.scrollIntoView({ block: 'start' })`);
            await sleep(400);
          },
          shot: async (id) => {
            await sleep(450); // let transitions settle
            await p.screenshot(join(OUT, `${id}.png`));
            console.log(`  ${id}`);
          },
          shotTall: async (id) => {
            await sleep(450);
            const h = await p.eval<number>(`(() => { const s = document.querySelector('.scroll-y'); return s ? s.scrollHeight + s.getBoundingClientRect().top : 844; })()`);
            await p.viewport(390, Math.ceil(h), 2);
            await sleep(450);
            await p.screenshot(join(OUT, `${id}.png`));
            await p.viewport(390, 844, 2);
            console.log(`  ${id}`);
          },
        };
        console.log(`scene ${s.ids.join(' ')}`);
        await s.run(ctx);
      } catch (e) {
        failed++;
        console.error(`  FAILED: ${(e as Error).message}`);
      } finally {
        await b.close();
      }
    }
  } finally {
    servers.forEach((s) => s.kill());
  }
  writeStoryboard();
  if (failed) {
    console.error(`${failed} scene(s) failed`);
    process.exit(1);
  }
}

// ───────────────────────────── storyboard

function writeStoryboard() {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OpenGym storyboard</title><style>
*{box-sizing:border-box;margin:0}body{background:#000;color:#fff;font:15px/1.45 -apple-system,'SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif;padding:40px 32px 80px;max-width:1500px;margin:auto}
h1{font-size:34px;letter-spacing:-.02em}.lead{color:#a1a1aa;max-width:760px;margin-top:8px}nav{display:flex;flex-wrap:wrap;gap:8px;margin:24px 0 8px}nav a{color:#007aff;text-decoration:none;border:1px solid #222222;border-radius:10px;padding:6px 12px}
section{margin-top:56px}h2{font-size:28px;letter-spacing:-.02em}h2 small{color:#71717a;font-size:28px;margin-right:10px}section>p{color:#a1a1aa;margin-top:4px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:36px 28px;margin-top:24px}
figure img{width:100%;border-radius:22px;border:1px solid #222222;display:block}figcaption{margin-top:10px;font-size:13px;color:#a1a1aa}figcaption b{display:block;color:#fff;font-size:15px}figcaption em{color:#007aff;font-style:normal;margin-right:6px}
</style></head><body>
<h1>OpenGym storyboard</h1>
<p class="lead">Every screen, captured from the running app by <code>npm run screens</code> (sample data, Thursday Nov 5 2026, iPhone size). IDs like 4.1 are what code comments and SPEC.md refer to. Rules and data live in SPEC.md.</p>
<nav>${CATALOG.map((s) => `<a href="#s${s.n}">${s.n} · ${esc(s.title)}</a>`).join('')}</nav>
${CATALOG.map(
  (s) => `<section id="s${s.n}"><h2><small>${s.n}</small>${esc(s.title)}</h2><p>${esc(s.blurb)}</p><div class="grid">
${s.screens.map(([id, title, cap]) => `<figure id="${id}"><img src="screens/${id}.png" loading="lazy" alt="${id} ${esc(title)}"><figcaption><b><em>${id}</em>${esc(title)}</b>${esc(cap)}</figcaption></figure>`).join('\n')}
</div></section>`,
).join('\n')}
</body></html>
`;
  writeFileSync(join(root, 'design/storyboard.html'), html);
}

await main();
