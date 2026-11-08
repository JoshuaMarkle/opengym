# design/

Everything here is either the spec or generated from the app, so it can't drift. The one exception is `proposals/`: hand-made mockups of features, kept as the design intent (built ones point at their screens).

| Path | What | Made by |
| --- | --- | --- |
| `SPEC.md` | Rules, data model, design principles. Start here | Hand-written |
| `storyboard.html` | Every screen with its ID (1.1 … 9.8) and a caption. Open in a browser | `npm run screens` |
| `screens/<id>.png` | The screenshots, iPhone size at 2× | `npm run screens` |
| `brand/brand-board.png` | Logo, icon sizes, color tokens, tab icons, type | `npm run brand` |
| `brand/logos/` | Logo (square), app icon (rounded) and wordmark, dark and light | `npm run brand` |
| `brand/tabs/` | The five solid tab bar icons (`currentColor`) | Hand-made; match `src/components/icons.tsx` |
| `proposals/effort-rpe-rir.html` | RPE / RIR as a badge on the reps box, with an effort pad (A1–A6). Built: SPEC §12, screens 2.22, 4.25–4.26, 7.10–7.11, 9.7–9.8 | Hand-made mockup |
| `proposals/watch-sync-future.html` | Parked: watch workouts in History and plan export to the calendar, with what a PWA can and can't do. Not planned | Hand-made mockup |

Change the app first, then regenerate. Screens: `scripts/screens.ts` holds the catalog (IDs, titles, captions) and the steps that reach each screen. Logo: edit `src/lib/logo.ts`, then `npm run brand` (it also rewrites `public/` icons).
