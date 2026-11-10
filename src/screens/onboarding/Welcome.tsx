import { useState } from 'react';
import { useNavigate } from 'react-router';
import { CheckGlyph, LogoMark } from '../../components/icons';
import { Sheet, SheetOption } from '../../components/overlays';
import { Button, DiscFace } from '../../components/ui';
import { useRestoreFlow } from '../settings/RestoreFlow';

/** True when opened from the Home Screen (installed), not a browser tab. */
export function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** 1.1: what the app is (and isn't) in three lines. */
export function Welcome() {
  const navigate = useNavigate();
  const restore = useRestoreFlow();
  const [existing, setExisting] = useState(false);

  return (
    <div className="flex h-full flex-col px-6 pt-10 pb-[max(20px,env(safe-area-inset-bottom))]">
      <div className="anim-page">
        <LogoMark size={56} />
        <div className="mt-8 text-[12px] font-bold tracking-[0.12em] text-fg2">OPENGYM · LIFTING LOG</div>
        <h1 className="mt-2 text-[40px] leading-[1.05] font-bold tracking-[-0.03em]">
          Log your lifts.
          <br />
          Nothing else.
        </h1>
        <ul className="mt-7 flex flex-col gap-3.5 text-[16px]">
          {['Free. No account, no ads, no subscription.', 'Your data stays on this phone.', 'Works offline at the gym.'].map((t) => (
            <li key={t} className="flex items-start gap-3">
              <DiscFace size="s" className="-mt-px">
                <CheckGlyph size={12} />
              </DiscFace>
              {t}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex-1" />
      <div className="flex flex-col gap-2">
        <Button onClick={() => navigate(isStandalone() ? '/setup' : '/install')}>Get started</Button>
        <Button kind="ghost" onClick={() => setExisting(true)}>
          I have a backup or Strong / Hevy export
        </Button>
      </div>

      <Sheet open={existing} onClose={() => setExisting(false)} title="Bring your history">
        <SheetOption
          onClick={() => {
            setExisting(false);
            restore.pick();
          }}
          detail="a .json file"
        >
          Restore an OpenGym backup
        </SheetOption>
        <SheetOption
          onClick={() => {
            setExisting(false);
            navigate('/settings/import');
          }}
          detail="a .csv export"
        >
          Import from Strong / Hevy
        </SheetOption>
      </Sheet>
      {restore.element}
    </div>
  );
}
