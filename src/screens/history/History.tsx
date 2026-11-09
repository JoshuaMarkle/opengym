import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ChevronRight } from '../../components/icons';
import { Chips, cx, SearchField, Segmented, StatRow } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { workoutLine, type HistoryWorkout } from '../../data/history';
import { useNow } from '../../hooks/useNow';
import { addMonths, dayKey, daysInMonth, fmtDuration, fmtMonthYear, fmtWeekRange, monthLetter, monthShort, startOfDay, startOfMonth, startOfWeek, weekdayShort } from '../../lib/dates';
import { availableRanges, longestStreak, missedWeeks, monthCounts, perWeek, type HistoryRange } from '../../lib/historyStats';
import { formatNumber } from '../../lib/units';

const RANGE_LABEL: Record<HistoryRange, string> = { month: 'Month', '6m': '6M', year: 'Year', all: 'All' };

// Where you were, kept across visits to a workout and back (this session only).
const memory: { range: HistoryRange; month?: number; year?: number; query: string; routine: string } = {
  range: 'month',
  query: '',
  routine: 'all',
};

// 6.1–6.4 / PH3.2: retain the existing longer-range history views.
export function CalendarView({ monthContent }: { monthContent: (month: number, setMonth: (month: number) => void) => ReactNode }) {
  const { history, settings } = useData();
  const [params] = useSearchParams();
  const requested = params.get('day');
  const requestedTs = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? new Date(requested + 'T12:00').getTime() : undefined;
  const now = useNow(60_000);
  const ranges = availableRanges(history.firstDate, now);
  const [range, setRangeState] = useState<HistoryRange>(requestedTs ? 'month' : ranges.includes(memory.range) ? memory.range : 'month');
  const [month, setMonthState] = useState<number>(requestedTs ? startOfMonth(requestedTs) : (memory.month ?? startOfMonth(now)));
  const [year, setYearState] = useState<number>(memory.year ?? new Date(now).getFullYear());
  const setRange = (r: HistoryRange) => {
    memory.range = r;
    setRangeState(r);
  };
  const setMonth = (m: number) => {
    memory.month = m;
    setMonthState(m);
  };
  const setYear = (y: number) => {
    memory.year = y;
    setYearState(y);
  };
  const dates = useMemo(() => history.workouts.map((w) => w.workout.startedAt), [history]);
  const byDay = useMemo(() => {
    const m = new Map<string, HistoryWorkout[]>();
    for (const w of history.workouts) {
      const k = dayKey(w.workout.startedAt);
      m.set(k, [...(m.get(k) ?? []), w]);
    }
    return m;
  }, [history]);
  const counts = useMemo(() => monthCounts(dates), [dates]);

  return (
    <div>
      {ranges.length > 1 && <Segmented className="mt-1" options={ranges.map((r) => ({ value: r, label: RANGE_LABEL[r] }))} value={range} onChange={setRange} />}
      {range === 'month' ? (
        monthContent(month, setMonth)
      ) : range === '6m' ? (
        <SixMonths
          now={now}
          byDay={byDay}
          counts={counts}
          dates={dates}
          weekStart={settings.weekStart}
          onOpen={(m) => {
            setMonth(m);
            setRange('month');
          }}
          firstDate={history.firstDate}
        />
      ) : range === 'year' ? (
        <YearView
          year={year}
          setYear={setYear}
          now={now}
          byDay={byDay}
          counts={counts}
          weekStart={settings.weekStart}
          firstDate={history.firstDate}
          onOpen={(m) => {
            setMonth(m);
            setRange('month');
          }}
        />
      ) : (
        <AllView
          counts={counts}
          dates={dates}
          now={now}
          weekStart={settings.weekStart}
          firstDate={history.firstDate}
          onOpen={(y) => {
            setYear(y);
            setRange('year');
          }}
        />
      )}
    </div>
  );
}

function MiniMonth({ month, byDay, count, weekStart, today, onOpen }: { month: number; byDay: Map<string, HistoryWorkout[]>; count: number; weekStart: 0 | 1; today: number; onOpen?: () => void }) {
  const d = new Date(month);
  const days = daysInMonth(d.getFullYear(), d.getMonth());
  const lead = (d.getDay() - weekStart + 7) % 7;
  const future = month > today;
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={future || !onOpen}
      className={cx('block w-full self-start text-left', future && 'opacity-50')}
      aria-label={`${fmtMonthYear(month)}: ${count} workouts`}
    >
      <span className="mb-1 flex justify-between text-[11.5px] font-bold text-fg/80">
        {monthShort(d.getMonth())}
        <span className="font-semibold text-fg2">{count}</span>
      </span>
      <span className="grid grid-cols-7 gap-[2px]">
        {Array.from({ length: lead }, (_, i) => (
          <i key={`e${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const ts = new Date(d.getFullYear(), d.getMonth(), i + 1).getTime();
          const has = byDay.has(dayKey(ts));
          return <i key={i} className={cx('block aspect-square rounded-[2px]', has ? 'bg-accent' : ts > today ? 'shadow-[inset_0_0_0_1px_var(--og-surface-2)]' : 'bg-surface-2')} />;
        })}
      </span>
    </button>
  );
}

function SixMonths({
  now,
  byDay,
  counts,
  dates,
  weekStart,
  onOpen,
  firstDate,
}: {
  now: number;
  byDay: Map<string, HistoryWorkout[]>;
  counts: Map<string, number>;
  dates: number[];
  weekStart: 0 | 1;
  onOpen: (m: number) => void;
  firstDate?: number;
}) {
  const last = startOfMonth(now);
  const months = Array.from({ length: 6 }, (_, i) => addMonths(last, i - 5));
  const today = startOfDay(now);
  const from = months[0];
  const n = dates.filter((t) => t >= from).length;
  return (
    <div>
      <div className="mt-4 grid grid-cols-3 gap-x-3 gap-y-4">
        {months.map((m) => {
          const d = new Date(m);
          return <MiniMonth key={m} month={m} byDay={byDay} count={counts.get(`${d.getFullYear()}-${d.getMonth()}`) ?? 0} weekStart={weekStart} today={today} onOpen={() => onOpen(m)} />;
        })}
      </div>
      <StatRow
        className="mt-5"
        items={[
          { label: 'Workouts', value: n },
          { label: 'Per week', value: formatNumber(Math.round(perWeek(n, Math.max(from, firstDate ?? from), now) * 10) / 10, 1) },
          { label: 'Missed wks', value: missedWeeks(dates, from, now, weekStart, firstDate) },
        ]}
      />
      <p className="mt-3 text-[12.5px] text-fg2">Tap a month to open it.</p>
    </div>
  );
}

function YearView({
  year,
  setYear,
  now,
  byDay,
  counts,
  weekStart,
  firstDate,
  onOpen,
}: {
  year: number;
  setYear: (y: number) => void;
  now: number;
  byDay: Map<string, HistoryWorkout[]>;
  counts: Map<string, number>;
  weekStart: 0 | 1;
  firstDate?: number;
  onOpen: (m: number) => void;
}) {
  const today = startOfDay(now);
  const thisYear = new Date(now).getFullYear();
  const firstYear = firstDate ? new Date(firstDate).getFullYear() : thisYear;
  const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1).getTime());
  const per = months.map((m) => counts.get(`${year}-${new Date(m).getMonth()}`) ?? 0);
  const total = per.reduce((a, b) => a + b, 0);
  const best = per.reduce((bi, v, i) => (v > per[bi] ? i : bi), 0);
  const from = Math.max(new Date(year, 0, 1).getTime(), firstDate ?? 0);
  const to = Math.min(now, new Date(year + 1, 0, 1).getTime());
  return (
    <div>
      <div className="mt-3 mb-1 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous year"
          disabled={year <= firstYear}
          onClick={() => setYear(year - 1)}
          className="-ml-2 flex h-11 w-11 items-center justify-center text-[22px] text-accent disabled:text-fg3"
        >
          ‹
        </button>
        <b className="text-[17px]">{year}</b>
        <button
          type="button"
          aria-label="Next year"
          disabled={year >= thisYear}
          onClick={() => setYear(year + 1)}
          className="-mr-2 flex h-11 w-11 items-center justify-center text-[22px] text-accent disabled:text-fg3"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-4 gap-x-2.5 gap-y-3">
        {months.map((m, i) => (
          <MiniMonth key={m} month={m} byDay={byDay} count={per[i]} weekStart={weekStart} today={today} onOpen={() => onOpen(m)} />
        ))}
      </div>
      <StatRow
        className="mt-5"
        items={[
          { label: 'Workouts', value: total },
          { label: 'Per week', value: formatNumber(Math.round(perWeek(total, from, Math.max(from, to)) * 10) / 10, 1) },
          { label: 'Best month', value: total ? `${monthShort(best)} (${per[best]})` : '—' },
        ]}
      />
    </div>
  );
}

function AllView({
  counts,
  dates,
  now,
  weekStart,
  firstDate,
  onOpen,
}: {
  counts: Map<string, number>;
  dates: number[];
  now: number;
  weekStart: 0 | 1;
  firstDate?: number;
  onOpen: (y: number) => void;
}) {
  const thisYear = new Date(now).getFullYear();
  const firstYear = firstDate ? new Date(firstDate).getFullYear() : thisYear;
  const years = Array.from({ length: thisYear - firstYear + 1 }, (_, i) => thisYear - i);
  const max = Math.max(1, ...counts.values());
  const curMonth = new Date(now).getMonth();
  return (
    <div>
      <StatRow
        className="mt-4"
        items={[
          { label: 'Total', value: dates.length },
          { label: 'Per week', value: formatNumber(Math.round(perWeek(dates.length, firstDate ?? now, now) * 10) / 10, 1) },
          { label: 'Longest streak', value: `${longestStreak(dates, weekStart)} wks` },
        ]}
      />
      {years.map((y) => {
        const per = Array.from({ length: 12 }, (_, m) => counts.get(`${y}-${m}`) ?? 0);
        const total = per.reduce((a, b) => a + b, 0);
        return (
          <button key={y} type="button" onClick={() => onOpen(y)} className="mt-4 grid w-full grid-cols-[42px_1fr_36px] items-end gap-2 text-left" aria-label={`${y}: ${total} workouts`}>
            <span className="pb-4 text-[14px] font-bold">{y}</span>
            <span>
              <span className="grid h-[74px] grid-cols-12 items-end gap-[3px]">
                {per.map((c, m) => {
                  const future = y === thisYear && m > curMonth;
                  return (
                    <i
                      key={m}
                      className={cx('block rounded-t-[2px]', future ? 'border-b border-dashed border-line-strong' : c ? 'bg-accent' : 'bg-surface-2')}
                      style={{ height: future ? 2 : Math.max(2, (c / max) * 74) }}
                    />
                  );
                })}
              </span>
              <span className="mt-1 grid grid-cols-12 gap-[3px] text-center text-[9px] text-fg2">
                {per.map((_, m) => (
                  <span key={m}>{monthLetter(m)}</span>
                ))}
              </span>
            </span>
            <span className="pb-4 text-right text-[14px] font-bold">{total}</span>
          </button>
        );
      })}
      <p className="mt-4 text-[12.5px] text-fg2">Each bar is one month. Tap a year to open it.</p>
    </div>
  );
}

// ───────────────────────────── list (6.5)

const PAGE = 60;

export function ListView() {
  const { history, exerciseMap, settings } = useData();
  const navigate = useNavigate();
  const [query, setQueryState] = useState(memory.query);
  const [routine, setRoutineState] = useState(memory.routine);
  const [limit, setLimit] = useState(PAGE);
  const setQuery = (q: string) => {
    memory.query = q;
    setQueryState(q);
    setLimit(PAGE);
  };
  const setRoutine = (r: string) => {
    memory.routine = r;
    setRoutineState(r);
    setLimit(PAGE);
  };

  // Routine chips: the ones you've actually done, most frequent first.
  const chips = useMemo(() => {
    const n = new Map<string, { name: string; count: number }>();
    for (const w of history.workouts) {
      const id = w.workout.routineId;
      if (!id) continue;
      const cur = n.get(id);
      n.set(id, { name: cur?.name ?? w.workout.name, count: (cur?.count ?? 0) + 1 });
    }
    return [...n.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 12);
  }, [history]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      history.workouts.filter((w) => {
        if (routine !== 'all' && w.workout.routineId !== routine) return false;
        if (!q) return true;
        if (w.workout.name.toLowerCase().includes(q)) return true;
        return w.exercises.some((e) => exerciseMap.get(e.we.exerciseId)?.name.toLowerCase().includes(q));
      }),
    [history, routine, q, exerciseMap],
  );

  const shown = filtered.slice(0, limit);
  const weeks: { start: number; items: HistoryWorkout[] }[] = [];
  for (const w of shown) {
    const s = startOfWeek(w.workout.startedAt, settings.weekStart);
    const last = weeks[weeks.length - 1];
    if (last?.start === s) last.items.push(w);
    else weeks.push({ start: s, items: [w] });
  }
  const weekTotals = useMemo(() => {
    const m = new Map<number, number>();
    for (const w of filtered) {
      const s = startOfWeek(w.workout.startedAt, settings.weekStart);
      m.set(s, (m.get(s) ?? 0) + 1);
    }
    return m;
  }, [filtered, settings.weekStart]);

  return (
    <div>
      <SearchField value={query} onChange={setQuery} placeholder="Search exercise or routine" />
      {chips.length > 0 && <Chips className="mt-2.5" options={[{ value: 'all', label: 'All' }, ...chips.map(([id, c]) => ({ value: id, label: c.name }))]} value={routine} onChange={setRoutine} />}

      {weeks.map((wk) => (
        <div key={wk.start}>
          <div className="mt-4 flex justify-between pb-1 text-[11px] font-bold tracking-[0.05em] text-fg2">
            <span>{fmtWeekRange(wk.start)}</span>
            <span className="font-semibold tracking-normal">
              {weekTotals.get(wk.start)} {weekTotals.get(wk.start) === 1 ? 'workout' : 'workouts'}
            </span>
          </div>
          {wk.items.map((w) => (
            <ListRow key={w.workout.id} w={w} onClick={() => navigate(`/history/${w.workout.id}`)} />
          ))}
        </div>
      ))}
      {!filtered.length && <p className="py-10 text-center text-[14px] text-fg2">{q ? `No workouts with "${query.trim()}".` : history.workouts.length ? 'No workouts for this routine yet.' : 'Nothing logged yet. Finished workouts appear here.'}</p>}
      {filtered.length > limit && (
        <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="mt-2 flex h-11 w-full items-center justify-center text-[15px] font-semibold text-accent">
          Show more ({filtered.length - limit})
        </button>
      )}
    </div>
  );
}

function DateBlock({ ts }: { ts: number }) {
  const d = new Date(ts);
  return (
    <span className="w-10 flex-none text-center leading-[1.1]">
      <small className="block text-[10.5px] font-bold text-fg2 uppercase">{weekdayShort(d.getDay())}</small>
      <b className="text-[19px]">{d.getDate()}</b>
    </span>
  );
}

function ListRow({ w, onClick }: { w: HistoryWorkout; onClick: () => void }) {
  const { exerciseMap } = useData();
  return (
    <button type="button" onClick={onClick} className="flex min-h-[56px] w-full items-center gap-3 border-b border-line text-left active:bg-surface/60">
      <DateBlock ts={w.workout.startedAt} />
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[16px] font-semibold">{w.workout.name}</b>
        <span className="block truncate text-[13px] text-fg2">{workoutLine(w, (id) => exerciseMap.get(id)?.type)}</span>
      </span>
      <span className="flex-none text-[13px] text-fg2">{w.workout.endedAt ? fmtDuration(w.workout.endedAt - w.workout.startedAt) : ''}</span>
      <ChevronRight size={13} className="flex-none text-fg3" />
    </button>
  );
}
