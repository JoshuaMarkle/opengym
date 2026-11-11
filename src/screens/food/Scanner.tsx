import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { CheckGlyph, ChevronDown, FlashGlyph } from '../../components/icons';
import { Sheet, useToast } from '../../components/overlays';
import { BarButton, Button, MacroRing, Note, PickerBox, TextButton, TextField, cx } from '../../components/ui';
import { getDecoder } from '../../data/barcode';
import { foodByBarcode, logFood, quickAmount } from '../../data/food';
import { isOnline, lookupBarcode } from '../../data/openFoodFacts';
import { useFoodSettings } from '../../data/useFood';
import type { Food, MealId } from '../../db/types';
import { fmtInt, MEAL_LABEL, per100ToServing, totalsFor, validBarcode } from '../../lib/nutrition';
import { useAddTarget } from './AddFood';
import { MealSheet, quickLabel, sourceLabel } from './parts';

type Result = { code: string; food: Food } | { code: string; missing: 'unknown' | 'offline' | 'error' };

/**
 * 10.29–10.30 Scan (board C3, nutrition-plan §3.9): the camera fills the screen under a white top
 * bar (Cancel, the meal as the title, the torch). EAN-13, EAN-8, UPC-A and UPC-E. Your own food
 * for a barcode wins, then Open Food Facts. The result is a sheet: name and source, the ring, the
 * amount and Log. Nothing is logged until Log. "Wrong food? Fix the numbers" opens New food filled
 * in from the scan with the barcode attached. No camera (or it's denied): type the number.
 */
export function Scanner() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const target = useAddTarget();
  const fs = useFoodSettings();
  const [meal, setMeal] = useState<MealId>(target.meal);
  const [mealSheet, setMealSheet] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<'starting' | 'on' | 'off'>('starting');
  const [torch, setTorch] = useState<{ on: boolean; track: MediaStreamTrack } | null>(null);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const paused = useRef(false);
  paused.current = !!result || busy || typing || mealSheet;

  // The camera loop is set up once; it calls the latest `look` through this ref.
  const lookRef = useRef<(code: string) => Promise<void>>(async () => {});
  const look = async (code: string) => {
    setBusy(true);
    try {
      const mine = await foodByBarcode(code);
      if (mine) return setResult({ code, food: mine });
      if (!fs.online || !isOnline()) return setResult({ code, missing: 'offline' });
      const f = await lookupBarcode(code);
      setResult(f ? { code, food: f } : { code, missing: 'unknown' });
    } catch {
      setResult({ code, missing: isOnline() ? 'error' : 'offline' });
    } finally {
      setBusy(false);
    }
  };

  lookRef.current = look;

  // A code in the URL (typed elsewhere, or the screenshots) looks up straight away.
  const initial = params.get('code');
  useEffect(() => {
    if (initial && validBarcode(initial)) void look(initial);
    // Once per code; `look` reads the latest settings when it runs.
  }, [initial]);

  // Camera and decoding loop.
  useEffect(() => {
    let stream: MediaStream | undefined;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('no camera');
        // 1080p: thin bars stay sharp enough to read from further away.
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (stop) return stream.getTracks().forEach((t) => t.stop());
        const v = video.current!;
        v.srcObject = stream;
        await v.play().catch(() => undefined);
        setCamera('on');
        const track = stream.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as { torch?: boolean; focusMode?: string[] };
        if (caps.torch) setTorch({ on: false, track });
        // Keep refocusing as the phone moves in (Android; iOS does this already).
        if (caps.focusMode?.includes('continuous')) await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => undefined);
        const decode = await getDecoder();
        let last = '';
        const tick = async () => {
          if (stop) return;
          if (!paused.current && v.readyState >= 2) {
            const code = await decode(v);
            // Two reads in a row agree before a lookup: cuts misreads on a shaky phone.
            if (code && code === last && !paused.current) {
              navigator.vibrate?.(30);
              last = '';
              await lookRef.current(code);
            } else last = code ?? '';
          }
          timer = setTimeout(() => void tick(), 120);
        };
        void tick();
      } catch {
        if (!stop) {
          setCamera('off');
          setTyping(true);
        }
      }
    })();
    return () => {
      stop = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const toggleTorch = async () => {
    if (!torch) return;
    const on = !torch.on;
    await torch.track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }).catch(() => undefined);
    setTorch({ ...torch, on });
  };

  const logIt = async (food: Food) => {
    const a = quickAmount(food);
    const e = await logFood(food, target.day, meal, a);
    toast({ message: `Added to ${MEAL_LABEL[meal]} · ${fmtInt(e.totals.kcal ?? 0)} kcal` });
    navigate(-1);
  };
  const fixNumbers = (code: string, food?: Food) => {
    const q = new URLSearchParams({ day: target.day, meal, barcode: code });
    if (food) {
      const s = food.servings[food.defaultServing ?? 0];
      const per = per100ToServing(food.per100, s?.grams ?? 100);
      q.set('name', food.name);
      if (s) q.set('grams', String(s.grams));
      if (s) q.set('serving', s.label);
      for (const k of ['kcal', 'p', 'c', 'f'] as const) if (per[k] != null) q.set(k, String(Math.round(per[k]! * 10) / 10));
    }
    navigate(`/food/new?${q}`, { replace: true });
  };
  const submitTyped = () => {
    const code = typed.replace(/\D/g, '');
    if (!validBarcode(code)) return toast({ message: 'That number isn’t a valid barcode' });
    setTyping(false);
    void look(code);
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-bg pt-safe">
      <video ref={video} playsInline muted className={cx('absolute inset-0 h-full w-full object-cover', camera !== 'on' && 'hidden')} />
      {camera === 'on' && <Viewfinder />}

      {/* Top bar in white over the camera. */}
      <div className="relative z-10 grid h-11 grid-cols-3 items-center px-4 bg-bg/70 text-fg">
        <BarButton kind="muted" className="justify-self-start text-fg" onClick={() => navigate(-1)}>
          Cancel
        </BarButton>
        <button type="button" onClick={() => setMealSheet(true)} aria-label={`Meal: ${MEAL_LABEL[meal]}`} className="flex h-11 items-center justify-center gap-1.5 justify-self-center text-headline">
          {MEAL_LABEL[meal]}
          <ChevronDown size={12} />
        </button>
        <span className="justify-self-end">
          {torch && (
            <button type="button" onClick={() => void toggleTorch()} aria-label={torch.on ? 'Turn off the light' : 'Turn on the light'} aria-pressed={torch.on} className={cx('flex h-11 w-11 items-center justify-center', torch.on && 'text-gold')}>
              <FlashGlyph size={20} />
            </button>
          )}
        </span>
      </div>

      <div className="relative z-10 mt-auto px-4 pb-safe">
        {camera === 'on' && !typing && (
          <div className="mx-auto mb-4 flex w-fit flex-col items-center rounded-xl bg-bg/70 px-5 pt-2 text-fg">
            <span className="text-callout">{busy ? 'Looking it up…' : 'Point at the barcode'}</span>
            <TextButton onClick={() => setTyping(true)}>Type the number</TextButton>
          </div>
        )}
        {camera === 'starting' && <p className="mb-6 text-center text-callout text-fg2">Starting the camera…</p>}
      </div>

      {/* No camera (or typing): the number field. */}
      {typing && (
        <div className="absolute inset-x-0 top-24 z-10 px-4">
          {camera === 'off' && <p className="mb-3 text-callout text-fg2">No camera here, or it isn't allowed. Type the number under the barcode instead.</p>}
          <TextField label="Barcode" value={typed} onChange={setTyped} placeholder="Barcode number" inputMode="numeric" autoFocus onEnter={submitTyped} maxLength={14} />
          <div className="mt-3 flex items-center gap-3">
            <Button className="flex-1" disabled={typed.replace(/\D/g, '').length < 8 || busy} onClick={submitTyped}>
              {busy ? 'Looking it up…' : 'Look up'}
            </Button>
            {camera === 'on' && (
              <TextButton tone="muted" onClick={() => setTyping(false)}>
                Use the camera
              </TextButton>
            )}
          </div>
        </div>
      )}

      <Sheet open={!!result} onClose={() => setResult(null)}>
        {result && 'food' in result && <FoundSheet food={result.food} onLog={() => void logIt(result.food)} onAmount={() => navigate(`/food/item/${encodeURIComponent(result.food.id)}?day=${target.day}&meal=${meal}`, { replace: true, state: result.food.source === 'off' ? { food: result.food } : undefined })} onFix={() => fixNumbers(result.code, result.food)} />}
        {result && 'missing' in result && (
          <div className="pb-2">
            <h2 className="text-title3">{result.missing === 'unknown' ? 'Not in Open Food Facts' : result.missing === 'offline' ? 'Can’t look it up offline' : 'Couldn’t look it up'}</h2>
            <p className="mt-0.5 text-footnote tabular-nums text-fg2">Barcode {result.code}</p>
            <Note className="mt-3">
              {result.missing === 'unknown'
                ? 'Add it from the label once and it’s yours: the next scan finds it.'
                : result.missing === 'offline'
                  ? fs.online
                    ? 'You’re offline. Add it from the label now, or scan again when you’re back online.'
                    : 'Looking up foods online is off (Settings, Food). Add it from the label instead.'
                  : 'Open Food Facts didn’t answer. Try again, or add it from the label.'}
            </Note>
            <Button className="mt-4 w-full" onClick={() => fixNumbers(result.code)}>
              Add from the label
            </Button>
            <TextButton tone="muted" className="mx-auto" onClick={() => setResult(null)}>
              Scan again
            </TextButton>
          </div>
        )}
      </Sheet>
      <MealSheet open={mealSheet} value={meal} onPick={setMeal} onClose={() => setMealSheet(false)} />
    </div>
  );
}

function FoundSheet({ food, onLog, onAmount, onFix }: { food: Food; onLog: () => void; onAmount: () => void; onFix: () => void }) {
  const a = quickAmount(food);
  const t = totalsFor(food.per100, a.grams);
  const s = food.servings[food.defaultServing ?? 0];
  return (
    <div className="pb-1">
      <h2 className="text-title3">{food.name}</h2>
      <p className="mt-0.5 text-footnote text-fg2">{[sourceLabel(food), s ? `${s.label} = ${fmtInt(s.grams)} ${food.basis === 'ml' ? 'ml' : 'g'}` : undefined].filter(Boolean).join(' · ')}</p>
      <MacroRing kcal={t.kcal ?? 0} grams={[t.p ?? 0, t.c ?? 0, t.f ?? 0]} className="mt-3" />
      <div className="mt-4 grid grid-cols-5 gap-2">
        <div className="col-span-2">
          <PickerBox label="Amount" onClick={onAmount}>
            {quickLabel(food, a)}
          </PickerBox>
        </div>
        <Button className="col-span-3" onClick={onLog}>
          <CheckGlyph size={14} /> Log
        </Button>
      </div>
      <TextButton className="mx-auto" onClick={onFix}>
        Wrong food? Fix the numbers
      </TextButton>
    </div>
  );
}

/** Four corners, centered: where to hold the barcode. */
function Viewfinder() {
  const corner = 'absolute h-6 w-6 border-white';
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
      <div className="relative h-40 w-72">
        <i className={cx(corner, 'top-0 left-0 rounded-tl-md border-t-4 border-l-4')} />
        <i className={cx(corner, 'top-0 right-0 rounded-tr-md border-t-4 border-r-4')} />
        <i className={cx(corner, 'bottom-0 left-0 rounded-bl-md border-b-4 border-l-4')} />
        <i className={cx(corner, 'right-0 bottom-0 rounded-br-md border-r-4 border-b-4')} />
      </div>
    </div>
  );
}
