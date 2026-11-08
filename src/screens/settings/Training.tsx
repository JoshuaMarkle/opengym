// Settings › Training (training-logic §22, proposal F6, D4). Screens 9.9–9.11.
// Every training option on one screen, all with defaults. Step size, matching and
// pace are inferred from the log, never asked.

import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { ChevronRight } from '../../components/icons';
import { BackButton, BarButton, Chips, cx, Note, Radio, Screen, SectionLabel, Toggle, TopBar } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { updateSettings } from '../../data/settings';
import { currentPhase, experienceOf } from '../../data/training';
import type { Settings, SuggestMode, TrainingPhase } from '../../db/types';
import { DAY_MS, fmtMonthDay } from '../../lib/dates';
import { EFFORT_LABEL } from '../../lib/effort';
import type { Experience, PhaseKind } from '../../lib/training';
import { usePinned } from '../progress/Progress';

export const SUGGEST_LABEL: Record<SuggestMode, string> = { off: 'Off', suggest: 'Suggest', auto: 'Auto' };
export const EXPERIENCE_LABEL: Record<Experience, string> = { new: 'Under a year', some: '1 to 3 years', lots: '3+ years' };
export const PHASE_LABEL: Record<PhaseKind, string> = { build: 'Building', maintain: 'Maintaining', return: 'Coming back' };

/** §4: four effort targets (RIR min–max). */
export const EFFORT_TARGETS: { value: string; target: [number, number]; label: string; detail: string }[] = [
  { value: '0-1', target: [0, 1], label: 'To failure', detail: 'RIR 0–1 · every rep you have' },
  { value: '0-2', target: [0, 2], label: 'Close to failure', detail: 'RIR 0–2 · recommended' },
  { value: '1-3', target: [1, 3], label: 'A few reps left', detail: 'RIR 1–3' },
  { value: '2-4', target: [2, 4], label: 'Comfortable', detail: 'RIR 2–4' },
];
export const targetKey = (t: [number, number]) => `${t[0]}-${t[1]}`;
export const targetLabel = (t: [number, number]) => EFFORT_TARGETS.find((o) => o.value === targetKey(t))?.label ?? `RIR ${t[0]}–${t[1]}`;

function phaseValue(s: Settings): string {
  const k = currentPhase(s);
  const p = s.phase;
  return k !== 'build' && p?.until ? `${PHASE_LABEL[k]} · ${fmtMonthDay(p.until)}` : PHASE_LABEL[k];
}

/** 9.9: Settings › Training. */
export function TrainingSettings() {
  const navigate = useNavigate();
  const { settings, history } = useData();
  const focus = usePinned();
  const exp = experienceOf(settings, history);
  return (
    <Screen header={<TopBar left={<BackButton label="Settings" onClick={() => navigate('/settings')} />} title="Training" />}>
      <SectionLabel className="mt-2">Workout</SectionLabel>
      <LinkRow label="Suggestions" detail="Next weights and rep hints during workouts" value={SUGGEST_LABEL[settings.suggestMode]} to="/settings/suggestMode" />
      <LinkRow label="Effort target" detail={settings.failureLastSetOnly ? 'Only the last set to failure' : undefined} value={targetLabel(settings.effortTarget)} to="/settings/effort-target" />
      <LinkRow label="Effort (RPE / RIR)" value={EFFORT_LABEL[settings.effort]} to="/settings/effort" />

      <SectionLabel>Progress</SectionLabel>
      <ToggleRow
        label="Train everything"
        detail="Trends, milestones and goals for every lift you log"
        on={settings.trainEverything}
        onChange={(v) => void updateSettings({ trainEverything: v })}
      />
      <LinkRow label="Focus lifts" value={focus.length} to="/progress/pinned" />
      <LinkRow label="Training phase" value={phaseValue(settings)} to="/settings/phase" />
      <LinkRow label="Lifting experience" detail={settings.experience ? undefined : 'Worked out from your log'} value={EXPERIENCE_LABEL[exp]} to="/settings/experience" />
      <Note className="mt-3">
        That's all of it. Nothing is set per exercise: the step comes from the equipment (barbell {settings.units === 'kg' ? '2.5 kg' : '5 lb'}, dumbbells to the next pair, machines one
        plate) and is then learned from what you log. The rep range comes from the routine.
      </Note>
    </Screen>
  );
}

export function LinkRow({ label, detail, value, to, onClick }: { label: string; detail?: ReactNode; value?: ReactNode; to?: string; onClick?: () => void }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={onClick ?? (() => to && navigate(to))}
      className="flex min-h-[52px] w-full items-center justify-between gap-3 border-b border-line py-1.5 text-left active:bg-surface/60"
    >
      <span className="min-w-0">
        <span className="block text-[16px]">{label}</span>
        {detail && <span className="block text-[13px] leading-snug text-fg2">{detail}</span>}
      </span>
      <span className="flex flex-none items-center gap-2 text-[15px] text-fg2 tabular-nums">
        {value}
        <ChevronRight size={12} className="text-fg3" />
      </span>
    </button>
  );
}

export function ToggleRow({ label, detail, on, onChange }: { label: string; detail?: ReactNode; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-3 border-b border-line py-1.5">
      <span className="min-w-0">
        <span className="block text-[16px]">{label}</span>
        {detail && <span className="block text-[13px] leading-snug text-fg2">{detail}</span>}
      </span>
      <Toggle label={label} on={on} onChange={onChange} />
    </div>
  );
}

function ChoiceRow({ on, label, detail, onClick }: { on: boolean; label: string; detail?: string; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className="flex min-h-[56px] w-full items-center gap-3 border-b border-line py-1.5 text-left active:bg-surface/60">
      <span className="min-w-0 flex-1">
        <b className="block text-[16px] font-semibold">{label}</b>
        {detail && <span className="block text-[13px] leading-snug text-fg2">{detail}</span>}
      </span>
      <Radio on={on} />
    </button>
  );
}

/** The effort-target question: setup step 2 (1.5) and Settings (9.11). */
export function EffortTargetPicker({ value, lastOnly, onChange }: { value: [number, number]; lastOnly: boolean; onChange: (target: [number, number], lastOnly: boolean) => void }) {
  return (
    <div>
      {EFFORT_TARGETS.map((o) => (
        <ChoiceRow key={o.value} on={targetKey(value) === o.value} label={o.label} detail={o.detail} onClick={() => onChange(o.target, lastOnly)} />
      ))}
      <ToggleRow label="Only the last set to failure" detail="Earlier sets keep one more rep in reserve" on={lastOnly} onChange={(v) => onChange(value, v)} />
    </div>
  );
}

/** The experience question: setup step 3 (1.6) and Settings. */
export function ExperiencePicker({ value, onChange }: { value: Experience | undefined; onChange: (v: Experience) => void }) {
  const detail: Record<Experience, string> = { new: 'Faster jumps, add weight often', some: 'The usual pace', lots: 'Slower, smaller steps' };
  return (
    <div>
      {(['new', 'some', 'lots'] as Experience[]).map((e) => (
        <ChoiceRow key={e} on={value === e} label={e === 'new' ? 'New, under a year' : EXPERIENCE_LABEL[e]} detail={detail[e]} onClick={() => onChange(e)} />
      ))}
    </div>
  );
}

/** 9.11: Settings › Training › Effort target. */
export function EffortTargetScreen() {
  const navigate = useNavigate();
  const { settings } = useData();
  return (
    <Screen header={<TopBar left={<BackButton label="Training" onClick={() => navigate('/settings/training')} />} title="Effort target" />}>
      <p className="mt-3 mb-2 text-[14px] leading-snug text-fg2">How close to failure do you want to train? Reps in reserve (RIR) = how many more reps you could have done. Suggestions pick weights that land you here.</p>
      <EffortTargetPicker
        value={settings.effortTarget}
        lastOnly={settings.failureLastSetOnly}
        onChange={(t, l) => void updateSettings({ effortTarget: t, failureLastSetOnly: l })}
      />
      <Note className="mt-3">Without effort logged, every set counts as a hard one. That never overestimates you: weights go up when a set tops out the range and down when it falls under it.</Note>
    </Screen>
  );
}

const UNTIL: { value: string; label: string; days?: number }[] = [
  { value: 'none', label: 'No end' },
  { value: '14', label: '2 weeks', days: 14 },
  { value: '28', label: '4 weeks', days: 28 },
  { value: '56', label: '8 weeks', days: 56 },
];

/** 9.10 (D4): one setting so a planned maintenance block or comeback isn't judged as failure. */
export function PhaseScreen() {
  const navigate = useNavigate();
  const { settings } = useData();
  const cur = currentPhase(settings);
  const p = settings.phase;
  const [kind, setKind] = useState<PhaseKind>(cur);
  const [until, setUntil] = useState<string>(() => {
    if (cur === 'build' || !p?.until) return cur === 'build' ? '28' : 'none';
    const days = Math.round((p.until - p.since) / DAY_MS);
    return UNTIL.find((u) => u.days === days)?.value ?? 'none';
  });
  const [pause, setPause] = useState(p?.pauseGoals ?? false);
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/settings/training'));
  const save = async () => {
    if (kind === 'build') await updateSettings({ phase: undefined });
    else {
      const since = kind === cur && p ? p.since : Date.now();
      const days = UNTIL.find((u) => u.value === until)?.days;
      const phase: TrainingPhase = { kind, since, until: days ? since + days * DAY_MS : undefined, pauseGoals: kind === 'maintain' ? pause : undefined };
      await updateSettings({ phase });
    }
    back();
  };
  const days = UNTIL.find((u) => u.value === until)?.days;
  const ends = days ? (kind === cur && p ? p.since : Date.now()) + days * DAY_MS : undefined;

  return (
    <Screen
      header={
        <TopBar
          left={<BarButton onClick={back}>Cancel</BarButton>}
          title="Training phase"
          right={
            <BarButton kind="bold" onClick={() => void save()}>
              Save
            </BarButton>
          }
        />
      }
    >
      <SectionLabel className="mt-2">Right now I'm</SectionLabel>
      <ChoiceRow on={kind === 'build'} label="Building" detail="Suggestions push for more" onClick={() => setKind('build')} />
      <ChoiceRow on={kind === 'maintain'} label="Maintaining" detail="Busy, cutting, travelling. Holding counts as a win" onClick={() => setKind('maintain')} />
      <ChoiceRow on={kind === 'return'} label="Coming back" detail="After time off. Start lighter, ramp up" onClick={() => setKind('return')} />
      {kind !== 'build' && (
        <>
          <SectionLabel>Until</SectionLabel>
          <Chips options={UNTIL.map((u) => ({ value: u.value, label: u.label }))} value={until} onChange={setUntil} />
          <p className="mt-2 text-[13px] text-fg2">{ends ? `Ends ${fmtMonthDay(ends)}, then back to Building.` : 'Stays on until you change it.'}</p>
        </>
      )}
      {kind === 'maintain' && (
        <div className="mt-3">
          <ToggleRow label="Pause goal dates" detail="Deadlines move by the time spent here" on={pause} onChange={setPause} />
        </div>
      )}
      <Note className={cx('mt-4')}>
        {kind === 'maintain'
          ? 'Topped-out sets keep their weight, and Holding shows as Maintained, a success. Sets that fall under the range still get lighter weights.'
          : kind === 'return'
            ? 'Every lift you haven\'t done for 3 weeks starts lighter and ramps back over 3 sessions. Those sessions stay out of your trends.'
            : 'The trend math never changes. Only the labels and suggestions do.'}
      </Note>
    </Screen>
  );
}
