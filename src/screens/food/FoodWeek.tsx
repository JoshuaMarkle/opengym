import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { MacroWeekBars, type MacroDay } from '../../components/charts';
import { ChevronLeft, ChevronRight } from '../../components/icons';
import { BarButton, cx, InfoRow, InfoTable, LargeHeader, Note, Row, Screen, SectionLabel, StatRow } from '../../components/ui';
import { useRangeEntries, useTargetVersions, targetsOn, useFoodSettings } from '../../data/useFood';
import { useSettings } from '../../data/DataProvider';
import { ceilingStatus, dayNoon, fmtInt, foodDayKey, leftOver, MACRO_TEXT, shiftDay, sumEntries, weekDays, weekStats, type Macro, type WeekDay } from '../../lib/nutrition';
import { fmtFoodDay } from './FoodDay';
import { useNow } from '../../hooks/useNow';

const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Nov 1 – 7", "Oct 26 – Nov 1". */
function weekLabel(from: string, to: string): string {
  const a = new Date(dayNoon(from));
  const b = new Date(dayNoon(to));
  return a.getMonth() === b.getMonth() ? `${MONTHS[a.getMonth()]} ${a.getDate()} – ${b.getDate()}` : `${MONTHS[a.getMonth()]} ${a.getDate()} – ${MONTHS[b.getMonth()]} ${b.getDate()}`;
}

/**
 * 10.32 Week (board A5, nutrition-plan §3.13): ‹ › for other weeks. Average per day, days on
 * target and days protein was hit (only past days with food count), the stacked macro bars
 * against the dashed target, then average grams against target, and the seven days (tap one,
 * or its bar, to open it).
 */
export function FoodWeek() {
  const navigate = useNavigate();
  const { day: param } = useParams();
  const settings = useSettings();
  const fs = useFoodSettings();
  const today = foodDayKey(useNow(60_000));
  const day = param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : today;
  const week = weekDays(day, settings.weekStart);
  const entries = useRangeEntries(week[0], week[6]);
  const versions = useTargetVersions();

  const weekKey = week.join();
  const days: WeekDay[] = useMemo(
    () =>
      weekKey.split(',').map((k) => {
        const rows = (entries ?? []).filter((e) => e.day === k);
        return { day: k, totals: sumEntries(rows).totals, count: rows.length, targets: targetsOn(versions, k, fs) };
      }),
    [entries, versions, fs, weekKey],
  );
  if (!entries || !versions) return null;
  const stats = weekStats(days, today);
  const bars: MacroDay[] = days.map((d) => ({
    key: d.day,
    letter: LETTERS[new Date(dayNoon(d.day)).getDay()],
    kcal: d.totals.kcal ?? 0,
    p: d.totals.p ?? 0,
    c: d.totals.c ?? 0,
    f: d.totals.f ?? 0,
    over: d.day <= today && !!d.targets.kcal && ceilingStatus(d.totals.kcal ?? 0, d.targets.kcal).over,
    today: d.day === today,
    future: d.day > today,
  }));
  const target = stats.target?.kcal ?? targetsOn(versions, day, fs).kcal;
  const go = (k: string) => navigate(`/food/week/${k}`, { replace: true });
  const openDay = (k: string) => navigate(k === today ? '/food' : `/food/day/${k}`);
  const avg = (m: Macro, label: string) => {
    const v = stats.avg[m];
    const t = stats.target?.[m];
    const over = t != null && m !== 'p' && ceilingStatus(v, t).over;
    return (
      <InfoRow
        key={m}
        label={<b className={MACRO_TEXT[m]}>{label}</b>}
        value={
          <span className="tabular-nums">
            <b className={over ? 'text-warn' : 'text-fg'}>{fmtInt(v)}</b>
            <span className="text-fg2">{t ? ` / ${fmtInt(t)} g` : ' g'}</span>
            {over && <span className="text-warn"> · over</span>}
          </span>
        }
      />
    );
  };

  return (
    <Screen
      header={
        <LargeHeader
          title="Food"
          subtitle={weekLabel(week[0], week[6])}
          right={
            <>
              <BarButton aria-label="Previous week" onClick={() => go(shiftDay(week[0], -7))} className="w-11 justify-center px-0">
                <ChevronLeft size={13} />
              </BarButton>
              <BarButton aria-label="Next week" onClick={() => go(shiftDay(week[0], 7))} className="w-11 justify-center px-0">
                <ChevronRight size={13} />
              </BarButton>
            </>
          }
        />
      }
    >
      <StatRow
        className="mt-2"
        items={[
          { label: 'Avg / day', value: stats.days ? fmtInt(stats.avg.kcal) : '—' },
          { label: 'On target', value: stats.onTarget.of ? <>{stats.onTarget.n} <span className="text-footnote font-normal text-fg2">of {stats.onTarget.of}</span></> : '—' },
          { label: 'Protein hit', value: stats.proteinHit.of ? <>{stats.proteinHit.n} <span className="text-footnote font-normal text-fg2">of {stats.proteinHit.of}</span></> : '—' },
        ]}
      />
      <MacroWeekBars days={bars} target={target} onPick={openDay} />
      <div className="mt-2 flex flex-wrap items-center gap-3 text-caption text-fg2">
        {(['p', 'c', 'f'] as const).map((m) => (
          <span key={m} className="flex items-center gap-1.5">
            <i className={cx('h-2 w-2 rounded-xs', m === 'p' ? 'bg-accent' : m === 'c' ? 'bg-cyan' : 'bg-gold')} />
            {m === 'p' ? 'Protein' : m === 'c' ? 'Carbs' : 'Fat'}
          </span>
        ))}
        {target ? (
          <span className="flex items-center gap-1.5">
            <i className="w-3 border-t border-dashed border-fg" />
            Target
          </span>
        ) : null}
      </div>

      {stats.days > 0 && (
        <InfoTable title="Averages" note="avg · target" className="mt-5">
          {avg('p', 'Protein')}
          {avg('c', 'Carbs')}
          {avg('f', 'Fat')}
        </InfoTable>
      )}
      {!stats.days && <Note className="mt-4">Nothing logged this week yet.</Note>}

      <SectionLabel>Days</SectionLabel>
      {days.map((d) => {
        const k = d.totals.kcal ?? 0;
        const t = d.targets.kcal;
        const lo = t && d.count ? leftOver(k, t) : undefined;
        const over = !!t && d.day <= today && ceilingStatus(k, t).over;
        return (
          <Row key={d.day} chevron onClick={() => openDay(d.day)}>
            <span className={cx('flex-1 text-body-lg', d.day === today && 'font-semibold')}>{d.day === today ? `Today · ${fmtFoodDay(d.day)}` : fmtFoodDay(d.day)}</span>
            <span className="text-callout tabular-nums">
              {d.count ? (
                <>
                  <span className={over ? 'text-warn' : ''}>{fmtInt(k)}</span>
                  <span className="text-fg2"> kcal</span>
                  {lo && d.day <= today && <span className={over ? 'text-warn' : 'text-fg2'}>{` · ${fmtInt(lo.n)} ${lo.word}`}</span>}
                </>
              ) : (
                <span className="text-fg2">—</span>
              )}
            </span>
          </Row>
        );
      })}
    </Screen>
  );
}
