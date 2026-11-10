import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type ReactNode } from 'react';
import { ChevronRight } from '../../components/icons';
import { Sheet } from '../../components/overlays';
import { cx, Tag } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { db } from '../../db/db';
import { areaLabel, equipmentLabel, muscleLabel, type Exercise, type Units } from '../../db/types';
import { columnsLabel } from '../../lib/cardio';
import { variationList } from '../../lib/popularity';
import { TYPE_TAG } from '../../lib/sets';

/** Exercises in a live routine: always shown, even when rarely used (§E). */
export function useInRoutines(): Set<string> {
  return (
    useLiveQuery(async () => {
      const live = new Set((await db.routines.toArray()).filter((r) => !r.deletedAt).map((r) => r.id));
      return new Set((await db.routineExercises.toArray()).filter((re) => live.has(re.routineId)).map((re) => re.exerciseId));
    }, []) ?? EMPTY
  );
}
const EMPTY = new Set<string>();

export type ExerciseSort = 'popular' | 'az';
const SORT_KEY = 'og-exercise-sort';

/** Popular (default) or A–Z, remembered on this device (A1). */
export function useExerciseSort(): [ExerciseSort, (s: ExerciseSort) => void] {
  const [sort, setSort] = useState<ExerciseSort>(() => {
    try {
      return localStorage.getItem(SORT_KEY) === 'az' ? 'az' : 'popular';
    } catch {
      return 'popular';
    }
  });
  const set = (s: ExerciseSort) => {
    setSort(s);
    try {
      localStorage.setItem(SORT_KEY, s);
    } catch {
      /* private mode */
    }
  };
  return [sort, set];
}

/** "Arms · Forearms · dumbbell" (A3); cardio shows its columns. `short` drops the equipment. */
export function exerciseMeta(e: Exercise, units: Units, short = false): string {
  if (e.type === 'cardio') return `Cardio · ${columnsLabel(e, units)}`;
  const parts = [muscleLabel(e.muscle), e.area ? areaLabel(e.area) : undefined, short ? undefined : equipmentLabel(e.equipment).toLowerCase()];
  return parts.filter(Boolean).join(' · ');
}

export const sessionsText = (n: number) => `${n} ${n === 1 ? 'session' : 'sessions'}`;

/** List section header: YOU DO, MOST POPULAR, RARELY USED (A1, A2). */
export function ListHead({ children, count, tone }: { children: ReactNode; count?: ReactNode; tone?: 'accent' }) {
  return (
    <div className={cx('mt-5 flex justify-between pb-1 text-[11px] font-bold tracking-[0.06em] uppercase', tone === 'accent' ? 'text-accent' : 'text-fg2')}>
      <span>{children}</span>
      {count !== undefined && <span className="font-semibold tracking-normal normal-case tabular-nums">{count}</span>}
    </div>
  );
}

/** A3 footer: how many are hidden, and the only way to browse them without searching. */
export function HiddenFooter({ count, shown, onToggle }: { count: number; shown: boolean; onToggle: () => void }) {
  if (!count && !shown) return null;
  return (
    <p className="mt-4 text-[13px] leading-snug text-fg2">
      {shown ? 'Rarely used exercises are shown.' : `${count} rarely used ${count === 1 ? 'exercise is' : 'exercises are'} hidden. They still show when you search, and anything you've logged always shows.`}{' '}
      <button type="button" onClick={onToggle} className="inline-flex min-h-11 items-center font-semibold text-accent">
        {shown ? 'Hide them' : 'Show hidden'}
      </button>
    </p>
  );
}

/**
 * B2 / B4: every variation in the group, most popular first (no score shown),
 * yours marked with sessions in blue, rare ones under Rarely used. Tapping a
 * row opens it (B2) or switches to it (B4).
 */
export function VariationsSheet({
  open,
  current,
  members,
  title,
  note,
  onPick,
  onEditLinks,
  onClose,
}: {
  open: boolean;
  current: Exercise;
  members: Exercise[];
  title: string;
  note?: string;
  onPick: (id: string) => void;
  onEditLinks?: () => void;
  onClose: () => void;
}) {
  const { history } = useData();
  const sessions = (id: string) => history.sessionsByExercise.get(id)?.length ?? 0;
  const { main, rare } = variationList(members, sessions);
  const row = (e: Exercise, dim: boolean) => {
    const n = sessions(e.id);
    const me = e.id === current.id;
    return (
      <button
        key={e.id}
        type="button"
        onClick={() => onPick(e.id)}
        className={cx('flex min-h-[52px] w-full items-center gap-3 border-b border-line text-left active:bg-surface/60', dim && 'opacity-55')}
      >
        <span className="min-w-0 flex-1 py-1.5">
          <b className="block truncate text-[16px] font-semibold">
            {e.name}
            {TYPE_TAG[e.type] && <Tag>{TYPE_TAG[e.type]}</Tag>}
          </b>
          <span className={cx('block truncate text-[13px]', n ? 'text-accent' : 'text-fg2')}>
            {me ? `this${n ? ` · ${sessionsText(n)}` : ''}` : n ? sessionsText(n) : equipmentLabel(e.equipment).toLowerCase()}
          </span>
        </span>
        <ChevronRight size={13} className="flex-none text-fg3" />
      </button>
    );
  };
  return (
    <Sheet open={open} onClose={onClose} tall title={title} subtitle={note}>
      {main.map((e) => row(e, false))}
      {rare.length > 0 && (
        <>
          <ListHead count={rare.length}>Rarely used</ListHead>
          {rare.map((e) => row(e, true))}
        </>
      )}
      {onEditLinks && (
        <div className="mt-3 flex items-center justify-between text-[13px] text-fg2">
          <button type="button" onClick={onEditLinks} className="min-h-11 font-semibold text-accent">
            Edit links
          </button>
          <span>Most popular first</span>
        </div>
      )}
    </Sheet>
  );
}
