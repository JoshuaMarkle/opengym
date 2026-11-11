import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useActiveWorkout } from '../data/DataProvider';
import { useNow } from '../hooks/useNow';
import { fmtClock } from '../lib/dates';
import { ChevronRight, FoodIcon, HistoryIcon, HomeIcon, ProgressIcon, SettingsIcon } from './icons';
import { cx, LiveDot } from './ui';

const TABS = [
  { to: '/', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/calendar', label: 'Calendar', Icon: HistoryIcon },
  // SPEC §5 / §14: Food sits between Calendar and Progress. Tapping it on a past day goes back to today.
  { to: '/food', label: 'Food', Icon: FoodIcon },
  { to: '/progress', label: 'Progress', Icon: ProgressIcon },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon },
];

export function TabLayout() {
  const { pathname } = useLocation();
  return (
    <div className="flex h-full flex-col">
      <main key={pathname.split('/')[1] || 'home'} className="anim-fade min-h-0 flex-1">
        <Outlet />
      </main>
      <div data-dock className="flex flex-none flex-col">
        {pathname !== '/' && <ResumeBar />}
        <TabBar />
      </div>
    </div>
  );
}

export function TabBar() {
  return (
    <nav className="flex flex-none border-t border-line bg-bg pb-safe" aria-label="Main">
      {TABS.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cx('flex h-[52px] flex-1 flex-col items-center justify-center gap-0.75 text-micro font-semibold transition-colors', isActive ? 'text-accent' : 'text-fg2')
          }
        >
          <Icon size={23} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

/** 3.3: while a workout runs, a slim bar above the tabs is one tap from your sets. */
function ResumeBar() {
  const active = useActiveWorkout();
  const navigate = useNavigate();
  const now = useNow();
  if (!active) return null;
  return (
    <button
      type="button"
      onClick={() => navigate('/workout')}
      className="anim-fade mx-2.5 mb-1.5 flex h-12 flex-none items-center justify-between rounded-lg border border-accent/50 bg-done px-3.5 text-left active:opacity-80"
    >
      <span className="flex min-w-0 items-center gap-2">
        <LiveDot />
        <b className="truncate text-body">{active.workout.name}</b>
        <span className="flex-none text-footnote text-fg2">
          <span data-volatile>{fmtClock(now - active.workout.startedAt)}</span> · in progress
        </span>
      </span>
      <em className="flex flex-none items-center gap-1 text-body font-bold text-accent not-italic">
        Resume
        <ChevronRight size={11} />
      </em>
    </button>
  );
}
