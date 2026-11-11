import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { EffortSheet } from '../../components/Effort';
import { CheckGlyph, ChevronRight } from '../../components/icons';
import { BackButton, Note, Screen, SectionLabel, Toggle, TopBar } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { updateSettings } from '../../data/settings';
import type { EffortAsk, EffortMode } from '../../lib/effort';

/**
 * 9.7 (A1): Settings › Effort. RIR by default (the effort target is set in RIR); RPE or
 * RIR (one stored value, two ways to show it), when Next on reps asks for it, and whether
 * est. 1RM counts it. The RPE and RIR sheet (9.8) opens only from its row.
 */
export function EffortSettings() {
  const navigate = useNavigate();
  const { settings } = useData();
  const [sheet, setSheet] = useState(false);
  const on = settings.effort !== 'off';

  const setMode = (effort: EffortMode) => {
    if (effort !== settings.effort) void updateSettings({ effort });
  };
  const setAsk = (effortAsk: EffortAsk) => void updateSettings({ effortAsk });

  return (
    <Screen header={<TopBar left={<BackButton label="Settings" onClick={() => navigate('/settings')} />} title="Effort" />}>
      <SectionLabel className="mt-2">Track effort as</SectionLabel>
      <Choice on={settings.effort === 'off'} onClick={() => setMode('off')} detail="Just weight and reps">
        Off
      </Choice>
      <Choice on={settings.effort === 'rpe'} onClick={() => setMode('rpe')} detail="How hard, 1 to 10">
        RPE
      </Choice>
      <Choice on={settings.effort === 'rir'} onClick={() => setMode('rir')} detail="Reps left in the tank, 0 to 5+">
        RIR
      </Choice>

      {on && (
        <>
          <SectionLabel>Ask on</SectionLabel>
          <Choice on={settings.effortAsk === 'every'} onClick={() => setAsk('every')}>
            Every working set
          </Choice>
          <Choice on={settings.effortAsk === 'last'} onClick={() => setAsk('last')} detail="Top-set style: one rating per exercise">
            Last working set only
          </Choice>
          <Choice on={settings.effortAsk === 'tap'} onClick={() => setAsk('tap')} detail="Done on reps finishes the set">
            Only when I tap the badge
          </Choice>

          <SectionLabel>More</SectionLabel>
          <div className="flex min-h-[60px] items-center justify-between gap-3 border-b border-line py-2">
            <span className="min-w-0">
              <span className="block text-input">Use effort in est. 1RM</span>
              <span className="block text-footnote text-fg2">185 × 8 {settings.effort === 'rir' ? 'with 2 RIR' : '@8'} counts as 10 reps to failure</span>
            </span>
            <Toggle label="Use effort in est. 1RM" on={settings.effortIn1rm} onChange={(v) => void updateSettings({ effortIn1rm: v })} />
          </div>
        </>
      )}
      <button type="button" onClick={() => setSheet(true)} className="flex min-h-[52px] w-full items-center justify-between gap-3 border-b border-line text-left active:bg-surface/60">
        <span className="text-input">What are RPE and RIR?</span>
        <ChevronRight size={12} className="text-fg3" />
      </button>
      <Note className="mt-3">
        {on
          ? 'Warm-ups, drops and cardio never ask. Effort is stored once, so switching between RPE and RIR never loses it.'
          : 'Turn it on to rate how hard each working set was, as a small badge on the reps box. Suggestions work best with it on.'}
      </Note>

      <EffortSheet open={sheet} onClose={() => setSheet(false)} mode={settings.effort} onSwitch={() => void updateSettings({ effort: settings.effort === 'rpe' ? 'rir' : 'rpe' })} />
    </Screen>
  );
}

function Choice({ on, onClick, detail, children }: { on: boolean; onClick: () => void; detail?: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="flex min-h-[52px] w-full items-center justify-between gap-3 border-b border-line py-1.5 text-left active:bg-surface/60"
    >
      <span className="min-w-0">
        <span className="block text-input">{children}</span>
        {detail && <span className="block text-footnote text-fg2">{detail}</span>}
      </span>
      <span className="w-4 flex-none">{on && <CheckGlyph size={16} className="text-accent" />}</span>
    </button>
  );
}
