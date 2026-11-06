import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ShareGlyph } from '../../components/icons';
import { Button } from '../../components/ui';
import { isStandalone } from './Welcome';

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** 1.2: only when opened in a browser tab. Installed, iPhone keeps the data much safer. */
export function InstallGuide() {
  const navigate = useNavigate();
  useEffect(() => {
    if (isStandalone()) navigate('/setup', { replace: true });
  }, [navigate]);

  const ios = isIOS();
  const steps = ios
    ? [
        {
          t: (
            <>
              Tap Share <ShareGlyph size={15} className="ml-1 inline-block align-[-2px] text-accent" />
            </>
          ),
          s: 'In the bar at the bottom of Safari',
        },
        { t: 'Choose "Add to Home Screen"', s: "Scroll down in the share menu if you don't see it" },
        { t: 'Open it from your Home Screen', s: "Not from Safari. That's where your data lives" },
      ]
    : [
        { t: 'Open the browser menu', s: 'The ⋮ or share button, or the install icon in the address bar' },
        { t: 'Choose "Install app" or "Add to Home screen"', s: 'Names differ a little between browsers' },
        { t: 'Open it from your Home Screen', s: "Not from the browser tab. That's where your data lives" },
      ];

  return (
    <div className="flex h-full flex-col px-6 pt-8 pb-[max(20px,env(safe-area-inset-bottom))]">
      <h1 className="text-[28px] leading-tight font-bold tracking-[-0.02em]">Add it to your Home Screen</h1>
      <p className="mt-2 text-[15px] leading-normal text-fg2">It's a web app. Installed, it opens full screen, works offline, and {ios ? 'iPhone' : 'your phone'} keeps its data safer.</p>
      <ol className="mt-6">
        {steps.map((st, i) => (
          <li key={i} className="flex items-start gap-3.5 border-b border-line py-3.5">
            <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-surface-2 text-[14px] font-bold">{i + 1}</span>
            <span>
              <b className="block text-[16px] font-semibold">{st.t}</b>
              <span className="text-[14px] text-fg2">{st.s}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="flex-1" />
      <Button kind="ghost" className="text-fg2" onClick={() => navigate('/setup')}>
        Continue in {ios ? 'Safari' : 'the browser'} anyway
      </Button>
    </div>
  );
}
