import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useActiveWorkout } from '../data/DataProvider';
import { useNow } from '../hooks/useNow';
import { fmtClock } from '../lib/dates';
import { HistoryIcon, HomeIcon, ProgressIcon, SettingsIcon } from './icons';
import { cx } from './ui';

const TABS = [
  { to: '/', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/calendar', label: 'Calendar', Icon: HistoryIcon },
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
            cx('flex h-[52px] flex-1 flex-col items-center justify-center gap-[3px] text-[10.5px] font-semibold transition-colors', isActive ? 'text-accent' : 'text-fg2')
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
      className="anim-fade mx-2.5 mb-1.5 flex h-12 flex-none items-center justify-between rounded-[13px] border border-accent/50 bg-[color-mix(in_srgb,#2e8bff_14%,var(--og-bg))] px-3.5 text-left active:opacity-80"
    >
      <span className="flex min-w-0 items-center gap-2">
        <i className="anim-pulse h-[7px] w-[7px] flex-none rounded-full bg-tip" />
        <b className="truncate text-[15px]">{active.workout.name}</b>
        <span className="flex-none text-[13px] text-fg2">{fmtClock(now - active.workout.startedAt)} · in progress</span>
      </span>
      <em className="flex-none text-[15px] font-bold text-accent not-italic">Resume ›</em>
    </button>
  );
}
