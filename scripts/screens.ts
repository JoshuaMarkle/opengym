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
    n: 1,
    title: 'First launch',
    blurb: 'Seen once: what the app is, how to install it, three settings.',
    screens: [
      ['1.1', 'Welcome', 'First launch only. The second button goes straight to restore or import (9.4, 9.5).'],
      ['1.2', 'Install guide', 'Only when opened in a browser tab, not from the Home Screen. Installed, iOS is far less likely to clear the data.'],
      ['1.3', 'Setup', 'Units, week start and theme. Defaults: lbs, Sunday, Dark.'],
      ['1.4', 'Home, empty', 'Before any routines exist. Both buttons work immediately.'],
    ],
  },
  {
    n: 2,
    title: 'Planning',
    blurb: 'Routines in folders; a folder with a schedule is a plan. Usually done at home.',
    screens: [
      ['2.1', 'Plans', 'Routines grouped in folders. The active folder (what Home shows) is on top; archived folders sit collapsed at the bottom.'],
      ['2.2', '"+" menu', 'New routine (into the active folder), new folder, or a blank workout.'],
      ['2.3', 'Routine builder', 'Each exercise with its set rows. LBS "last" reuses last session\'s weight; REPS is a number, a range or empty. Drag ≡ to reorder; swipe a set to delete it.'],
      ['2.4', 'Keypad, reps', 'The logging keypad. On reps the bottom-left key is the range dash (6 – 8) and the decimal is off.'],
      ['2.5', 'Exercise picker', 'In this routine (untick to remove), Added (in the order ticked), then A–Z. Muscle and Cardio chips filter.'],
      ['2.6', 'Picker, searching', 'While searching, "In this routine" folds away.'],
      ['2.7', 'Plans, edit mode', 'Drag routines within or between folders, drag folder headers to reorder. Red − deletes a routine; its history is kept.'],
      ['2.8', 'Hold a routine', 'Long-press shortcuts: start, edit, duplicate, move, delete.'],
      ['2.9', 'Folder options', 'Rename, make active, archive or delete. Deleting a folder never deletes its routines.'],
      ['2.10', 'Move to folder', 'The tap alternative to dragging. "+ New folder…" creates one and moves the routine in one go.'],
      ['2.11', 'Routine screen', 'Every set with Previous and what it will start at. A superset shows as one bracket. Start is pinned at the bottom.'],
      ['2.12', 'Superset in the builder', 'Linked exercises sit in a blue bracket, tagged A1 / A2. Drag in or out of the bracket to link or unlink.'],
      ['2.13', 'Superset with…', 'From an exercise\'s "•••". Up to 3 exercises per group. The same menu later offers "Unlink superset".'],
      ['2.14', 'Plans, with a schedule', 'A scheduled folder shows this week as a strip under its header, and each routine says when it\'s due.'],
      ['2.15', 'Plan screen', 'Tap a folder\'s name. Its schedule, this week with status and ▶, then the routines.'],
      ['2.16', 'Schedule type', 'No schedule (the plain rotation), a repeating cycle or a weekly split.'],
      ['2.17', 'Repeating cycle', 'Days in order, each a routine or Rest. Pick which day today is and what happens on a miss: wait, or stick to dates.'],
      ['2.18', 'Weekly split', 'Seven rows in week order. A missed workout is skipped or moves to the next rest day.'],
      ['2.19', 'Assign a day', 'The same sheet for cycle days and weekdays: a routine, Rest, or a new routine made on the spot.'],
      ['2.20', 'Plan calendar', 'Four weeks of planned vs done: blue = done, orange outline = missed. Tap a day from today on to change it.'],
      ['2.21', 'Change one day', 'One-off changes that leave the schedule alone: another routine, rest, move, swap, or back to plan.'],
      ['2.22', 'Effort target', 'With effort on, a working set\'s reps box gets an rpe tab for an optional target, shown as an outlined badge on the rep range. It prefills as a placeholder badge only, never as a logged value.'],
    ],
  },
  {
    n: 3,
    title: 'Starting',
    blurb: 'Opening the app at the gym.',
    screens: [
      ['3.1', 'Home', 'This week as a strip (blue = trained, ring = today). Then the active folder, longest-ago first: ▶ starts a routine, tapping the name opens it.'],
      ['3.2', 'Home, workout running', 'An unfinished workout leads Home: timer, where you were, Resume.'],
      ['3.3', 'Resume bar', 'On every other tab while a workout runs, one tap back to your sets.'],
      ['3.4', 'Home, scheduled', 'With a scheduled active folder, Home follows the plan: today, then the next few days, rest days collapsed.'],
      ['3.5', 'Missed a day', 'A quiet note the day after a missed workout: do it today or skip it. Never shown for "Wait for me" cycles.'],
    ],
  },
  {
    n: 4,
    title: 'During a workout',
    blurb: 'Logging sets. No tab bar; Prev / Next move between exercises.',
    screens: [
      ['4.1', 'Logging', 'Previous = last time\'s set at the same position; D = you dropped after it. Variation chips appear when variations are linked. On the first exercise the left button becomes All exercises.'],
      ['4.2', 'Keypad', '123 | Plates on the left, lbs | reps and one blue button on the right. → Next moves to the next box. ± steps by the weight step.'],
      ['4.3', 'Drop sets', '"+ Drop" adds a row under the last completed set, prefilled 25% lighter (Settings).'],
      ['4.4', 'Swipes', 'Swipe right → warm-up (moves to the top as W). Swipe left → delete with 5 s Undo.'],
      ['4.5', 'Set menu', 'Tap the set number or hold the row: warm-up, move to top, duplicate, delete.'],
      ['4.6', 'Exercise "•••"', 'Switch or link a variation, replace, superset, look back, open the exercise, or remove it from today.'],
      ['4.7', 'Bodyweight', 'The weight column follows the exercise type: BW, + added, or − assisted.'],
      ['4.8', 'Look-back: History', 'The chart button beside "•••". Every past session of this lift, newest first, drops in orange.'],
      ['4.9', 'Look-back: Charts', 'The Progress chart, shrunk: est. 1RM or top set.'],
      ['4.10', 'Look-back: Records', 'Best weight for 1–12 reps; today\'s rep count highlighted, blue = last 30 days.'],
      ['4.11', 'Last exercise', 'No next exercise, so the right button becomes All exercises. Ticked segments add the Σ row.'],
      ['4.12', 'All exercises', 'Replaces everything under the header; Finish stays. Progress rings, supersets as one bracket, tap to jump.'],
      ['4.13', 'All exercises, edit', '− and ▲▼. Removing one with logged sets asks first. Finish asks whether to save changes to the routine.'],
      ['4.14', 'Add mid-workout', 'The builder\'s picker; the first section is "In this workout".'],
      ['4.15', 'Keypad, last box', 'On the last box of a set the button reads ✓ Done: it completes the set and jumps to the next one.'],
      ['4.16', 'Plate pad', 'Tap a plate to add it to each side; tap one on the bar to take it off. Same height as the number keypad.'],
      ['4.17', 'Plate pad, full', 'When the stack doesn\'t fit it slides left so the outer plates stay in view. Ten plates a side at most.'],
      ['4.18', 'Bar picker', 'From "Bar 45 ▾". Remembered per exercise; "No bar" is for plate-loaded machines.'],
      ['4.19', 'Superset', 'The group shares one screen inside the bracket. The exercise you\'re on is highlighted.'],
      ['4.20', 'Superset, after ✓', 'Ticking A1 jumps to the same set of A2. A finished partner folds into one line.'],
      ['4.21', 'Cardio: treadmill', 'TIME plus up to two columns, no Previous. Empty boxes show last time in grey and ✓ accepts them. Σ only with 2+ segments.'],
      ['4.22', 'Cardio keypad', 'Field tabs follow the columns. In time the bottom-left key types ":" and ± steps a minute.'],
      ['4.23', 'Cardio: bike', 'Columns change per machine: Bike tracks level. One segment, so no Σ row.'],
      ['4.24', 'Cardio: rower', 'Split /500m is worked out from time and meters, never typed.'],
      ['4.25', 'Effort pad: RPE', 'With effort on, a reps box\'s tabs read lbs · reps · rpe. The effort pad takes the number keys\' place: Easy to Max, ½ for half steps. With "Ask on every set", Next on reps comes here before ✓ Done. The outlined badge is the routine\'s target.'],
      ['4.26', 'Effort pad: RIR', 'The same pad in RIR. Badges get an R (2R), and Previous shows last time\'s effort under the set. Stored once as RPE, so switching modes never loses data.'],
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
      ['5.4', 'Workout options', 'Tap the workout name: rename, change start time, discard (confirms first).'],
    ],
  },
  {
    n: 6,
    title: 'History',
    blurb: 'Looking back. The calendar / list choice is remembered.',
    screens: [
      ['6.1', 'Month', 'Weeks start on the Settings day. Tap a day to see its workout below.'],
      ['6.2', '6 months', 'Appears once history spans 6 months. Tap a month to open it.'],
      ['6.3', 'Year', 'Appears after a year of history. ‹ › between years.'],
      ['6.4', 'All time', 'One row per year, a bar per month.'],
      ['6.5', 'List', 'Weeks, search and routine filters.'],
      ['6.6', 'Workout detail', 'Every set, drops included; cardio as a mini table. Repeat, Edit, or Delete in "•••".'],
      ['6.7', 'Edit past workout', 'Fix typos and the date. Records and charts update on Save.'],
      ['6.8', 'History, empty', 'Only Month shows until history builds up.'],
    ],
  },
  {
    n: 7,
    title: 'Progress',
    blurb: 'Am I getting stronger?',
    screens: [
      ['7.1', 'Progress', 'Each pinned lift: est. 1RM, trend and change over the range.'],
      ['7.2', 'Lift: est. 1RM', 'Epley from the best working set per session (no warm-ups, drops, or sets over 12 reps). White dots = new all-time highs.'],
      ['7.3', 'Lift: top set', 'The weight actually lifted, reps on each point.'],
      ['7.4', 'Lift: records', 'Best weight at each rep count, with dates. Blue = last 30 days.'],
      ['7.5', 'Pinned lifts', 'Which lifts Progress shows, in order.'],
      ['7.6', 'Progress, empty', 'Until an exercise has two sessions.'],
      ['7.7', 'Cardio', 'How much, not how fast: minutes, miles or sessions per week. Ranges hide without enough history.'],
      ['7.8', 'Machine detail', 'The weekly chart for one machine, then recent sessions.'],
      ['7.9', 'Distance records', 'Fastest mile, 5K, 10K, half and full marathon from run-type exercises.'],
      ['7.10', 'Effort-adjusted 1RM', 'With "Use effort in est. 1RM", 155 × 10 @8 counts as 12 reps to failure. "Same weight, easier" appears when a weight × reps you did in the last 8 weeks now rates lower.'],
      ['7.11', 'History with effort', 'Each set is one unbreakable block (155 × 10 @8). A line that runs out of room wraps the whole block and never ends on a dot.'],
    ],
  },
  {
    n: 8,
    title: 'Exercises',
    blurb: 'The library, from Settings.',
    screens: [
      ['8.1', 'Library', 'Built-in and custom exercises with how often you\'ve done them.'],
      ['8.2', 'Exercise screen', 'Stats, linked variations, where it\'s used. Merge fixes duplicates.'],
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
      ['9.1', 'Settings', 'Rows open a picker. The Data header turns orange after 7 days without a backup.'],
      ['9.2', 'Setting picker', 'One pattern for units, theme, steps, bar weight, drop amount and 1RM formula.'],
      ['9.3', 'Backed up', 'Back up now makes one JSON file and opens the share sheet; the date updates.'],
      ['9.4', 'Restore', 'After picking a backup: both workout counts, and a chance to back up first.'],
      ['9.5', 'Import from Strong / Hevy', 'Their CSV export, matched to the library. Unsure matches are flagged orange.'],
      ['9.6', 'Delete all data', 'The only irreversible action, so it needs typing DELETE.'],
      ['9.7', 'Effort', 'Off by default. RPE or RIR, which sets Next on reps asks on, and whether est. 1RM counts reps in reserve. Warm-ups, drops and cardio never ask.'],
      ['9.8', 'RPE and RIR', 'Opened from Settings › Effort, and the first time effort is turned on. Both terms, then one table mapping RPE, RIR and how a set feels.'],
    ],
  },
];

// ───────────────────────────── scenes

type Ctx = {
  p: Page;
  /** Navigate within the app (hash route). */
  go: (route: string) => Promise<void>;
  shot: (id: string) => Promise<void>;
  /** Tap the scrim above a sheet to close it. */
  dismiss: () => Promise<void>;
  /** Scroll so the element sits at the top of its scroller. */
  scrollTo: (text: string) => Promise<void>;
  scratch: string;
};
type Scene = { server: 'sample' | 'empty'; ids: string[]; run: (c: Ctx) => Promise<void> };

const SCENES: Scene[] = [];
const scene = (server: Scene['server'], ids: string, run: Scene['run']) => SCENES.push({ server, ids: ids.split(' '), run });

scene('empty', '1.1 1.2 1.3 1.4 6.8 7.6', async ({ p, go, shot }) => {
  await go('/welcome');
  await shot('1.1');
  await p.click('Get started');
  await shot('1.2');
  await p.click('Continue in');
  await shot('1.3');
  await p.click('Done');
  await shot('1.4');
  await go('/history');
  await shot('6.8');
  await go('/progress');
  await shot('7.6');
});

scene('sample', '2.1 2.2 2.7 2.8 2.10 2.9', async ({ p, go, shot, dismiss }) => {
  await go('/plans');
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

scene('sample', '2.16 2.17 2.18 2.19 3.4 2.15 2.14 2.20 2.21 3.5', async ({ p, go, shot, dismiss }) => {
  await go('/plans');
  await p.click({ sel: 'button', text: 'PPL', nth: 0 });
  await p.click('Change ›');
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
  await shot('2.15');
  await p.click('Calendar ›');
  await shot('2.20');
  await p.click({ sel: 'button', text: 'Nov 6', start: false }).catch(() => p.click({ text: 'Fri', nth: 0 }));
  await shot('2.21');
});

scene('sample', '4.1 4.2 4.15 4.16 4.17 4.18 4.3 4.5 4.4 4.6 4.8 4.9 4.10 4.12 4.13 4.19 4.20 4.21 4.22 4.11 4.14 4.7 5.4 3.2 3.3 5.1 5.2 5.3', async ({ p, go, shot, dismiss }) => {
  await go('/');
  await p.click('Start Push', 1500);
  await p.click('Complete set W');
  await p.click('Complete set 1');
  await shot('4.1');

  await p.click('Set 2 weight');
  await shot('4.2');
  await p.click('Next box');
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

  await p.click('History, charts and records');
  await shot('4.8');
  await p.click('Charts');
  await shot('4.9');
  await p.click('Records');
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
  await go('/history');
  await p.click({ sel: 'button', text: '3', start: true, nth: 0 }).catch(() => {});
  await shot('6.1');
  await p.click('6M');
  await shot('6.2');
  await p.click('Year');
  await shot('6.3');
  await p.click('All');
  await shot('6.4');
  await p.click('Month');
  await p.click('List');
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

scene('sample', '8.1 8.2 8.4 8.3 8.5 8.6', async ({ p, go, shot }) => {
  await go('/exercises');
  await shot('8.1');
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
  await p.click('Next box');
  await p.click('7 RPE');
  await p.click('Done: complete');
  await p.click('Next box');
  await p.click('Next box');
  await p.click('8 RPE');
  await p.click('Add a half');
  await shot('4.25');

  await p.eval(`__og.db.settings.update('settings', { effort: 'rir' })`);
  await p.click('Done: complete');
  await p.click('Next box');
  await p.click('Next box');
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

async function main() {
  const filters = process.argv.slice(2);
  const wanted = (id: string) => !filters.length || filters.some((f) => id === f || id.startsWith(f.endsWith('.') ? f : `${f}.`) || id.startsWith(f + '.'));
  const scenes = SCENES.filter((s) => s.ids.some(wanted));
  mkdirSync(OUT, { recursive: true });
  const scratch = mkdtempSync(join(tmpdir(), 'og-screens-'));
  const ports = { sample: 5180, empty: 5181 };
  const servers = [startServer(ports.sample, true), startServer(ports.empty, false)];
  let failed = 0;
  try {
    await Promise.all(Object.values(ports).map((port) => waitFor(`http://localhost:${port}/`)));
    for (const s of scenes) {
      const b = await Browser.launch();
      try {
        const p = await b.newPage();
        await p.viewport(390, 844, 2);
        await p.send('Emulation.setUserAgentOverride', { userAgent: IPHONE, platform: 'iPhone' });
        await p.fixClock(NOW);
        const base = `http://localhost:${ports[s.server]}/`;
        await p.goto(base);
        await p.find({ sel: 'nav, h1' }, 20000); // seeded and rendered
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
h1{font-size:34px;letter-spacing:-.02em}.lead{color:#8e8e8e;max-width:760px;margin-top:8px}nav{display:flex;flex-wrap:wrap;gap:8px;margin:24px 0 8px}nav a{color:#2e8bff;text-decoration:none;border:1px solid #1f1f1f;border-radius:10px;padding:6px 12px}
section{margin-top:56px}h2{font-size:28px;letter-spacing:-.02em}h2 small{color:#555;font-size:28px;margin-right:10px}section>p{color:#8e8e8e;margin-top:4px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:36px 28px;margin-top:24px}
figure img{width:100%;border-radius:22px;border:1px solid #1f1f1f;display:block}figcaption{margin-top:10px;font-size:13px;color:#8e8e8e}figcaption b{display:block;color:#fff;font-size:15px}figcaption em{color:#2e8bff;font-style:normal;margin-right:6px}
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
