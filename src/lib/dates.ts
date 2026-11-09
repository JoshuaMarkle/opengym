// Date helpers. All dates are epoch ms in the device's local time zone.
// Formatting is fixed English to match the design ("Thu, Oct 29", "6:10 pm").

export const DAY_MS = 86_400_000;

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const weekdayShort = (d: number) => WEEKDAYS_SHORT[d];
export const weekdayLetter = (d: number) => WEEKDAYS_SHORT[d][0];
export const monthShort = (m: number) => MONTHS_SHORT[m];
export const monthLetter = (m: number) => MONTHS_SHORT[m][0];

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addDays(ts: number, n: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

export function startOfWeek(ts: number, weekStart: 0 | 1): number {
  const d = new Date(startOfDay(ts));
  const diff = (d.getDay() - weekStart + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d.getTime();
}

export function startOfMonth(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

export function addMonths(ts: number, n: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth() + n, 1).getTime();
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Stable key for a calendar day, e.g. "2026-11-05". */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Whole calendar days between two timestamps (b − a). */
export function daysBetween(a: number, b: number): number {
  return Math.round((startOfDay(b) - startOfDay(a)) / DAY_MS);
}

/** Number of calendar months from a's month to b's month, inclusive of both. */
export function monthsSpanned(a: number, b: number): number {
  const da = new Date(a);
  const db = new Date(b);
  return (db.getFullYear() - da.getFullYear()) * 12 + (db.getMonth() - da.getMonth()) + 1;
}

/** "Thu, Oct 29" (adds the year when it isn't the current one). */
export function fmtDay(ts: number, now = Date.now()): string {
  const d = new Date(ts);
  const base = `${WEEKDAYS_SHORT[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === new Date(now).getFullYear() ? base : `${base}, ${d.getFullYear()}`;
}

/** "Oct 29" (adds the year when it isn't the current one: "Oct 29, 2025", or "Oct 29 '25" with `shortYear`). */
export function fmtMonthDay(ts: number, now = Date.now(), shortYear = false): string {
  const d = new Date(ts);
  const base = `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
  if (d.getFullYear() === new Date(now).getFullYear()) return base;
  return shortYear ? `${base} '${String(d.getFullYear() % 100).padStart(2, '0')}` : `${base}, ${d.getFullYear()}`;
}

/** Relative within a week: "Today", "Yesterday", "Mon"; otherwise "Thu, Oct 29". */
export function fmtRelativeDay(ts: number, now = Date.now()): string {
  const diff = daysBetween(ts, now);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff > 1 && diff < 7) return WEEKDAYS_SHORT[new Date(ts).getDay()];
  return fmtDay(ts, now);
}

/** "Thursday, Nov 5" */
export function fmtHomeDate(ts: number): string {
  const d = new Date(ts);
  return `${WEEKDAYS_LONG[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/** "6:10 pm" */
export function fmtTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'am' : 'pm'}`;
}

/** "6:10 – 7:07 pm" (or "11:40 am – 12:30 pm") */
export function fmtTimeRange(a: number, b: number): string {
  const ta = fmtTime(a);
  const tb = fmtTime(b);
  const sameHalf = ta.slice(-2) === tb.slice(-2);
  return `${sameHalf ? ta.slice(0, -3) : ta} – ${tb}`;
}

/** "57 min", "1 h 5 min" */
export function fmtDuration(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60_000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Workout clock: "04:10", "32:18", "1:02:18" */
export function fmtClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "November 2026" */
export function fmtMonthYear(ts: number): string {
  const d = new Date(ts);
  return `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Jan 2025" */
export function fmtMonthShortYear(ts: number): string {
  const d = new Date(ts);
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** Week label for the History list: "NOV 1 – 7", "OCT 25 – 31", "OCT 29 – NOV 4". */
export function fmtWeekRange(weekStartTs: number): string {
  const a = new Date(weekStartTs);
  const b = new Date(addDays(weekStartTs, 6));
  const left = `${MONTHS_SHORT[a.getMonth()]} ${a.getDate()}`;
  const right = a.getMonth() === b.getMonth() ? `${b.getDate()}` : `${MONTHS_SHORT[b.getMonth()]} ${b.getDate()}`;
  return `${left} – ${right}`.toUpperCase();
}

/** Value for <input type="datetime-local"> */
export function toLocalInputValue(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fromLocalInputValue(v: string): number | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v);
  if (!m) return undefined;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime();
}

/** "3 days ago", "today", "never" — for the backup line in Settings. */
export function fmtAgo(ts: number | undefined, now = Date.now()): string {
  if (!ts) return 'never';
  const d = daysBetween(ts, now);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d} days ago`;
  const months = Math.floor(d / 30);
  if (months < 12) return months === 1 ? '1 month ago' : `${months} months ago`;
  const years = Math.floor(d / 365);
  return years <= 1 ? '1 year ago' : `${years} years ago`;
}

/** ISO date "2026-11-05" for file names. */
export const isoDate = (ts: number) => dayKey(ts);
