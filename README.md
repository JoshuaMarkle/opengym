# OpenGym

A free lifting log that runs entirely on your phone. There's no account, no server, no ads and no subscription, and it works offline at the gym.

- Routines in folders. Home shows what's next in your rotation and starts it in one tap.
- Logging pre-fills each set from last time. A custom keypad, one-tap ✓, drop sets, warm-ups, swipes and hold menus cover the usual gym exceptions.
- History has month, 6-month, year and all-time calendars plus a searchable list. Past workouts can be edited.
- Progress shows est. 1RM, top-set and records charts for your pinned lifts, with linked variations (Flat / Incline / DB).
- Backups are one JSON file. You can also import from Strong or Hevy CSV and export your own CSV.

It's built with React, TypeScript, Vite, Tailwind and Dexie (IndexedDB), and ships as an installable PWA.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 (also on your LAN, for testing on a phone)
npm test           # unit tests for the logic in src/lib
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ locally
```

Requires Node 22.12 or newer.

## Deploy

`npm run build` produces a static site in `dist/` that works from any static host. It uses relative paths and hash routing, so a sub-path such as GitHub Pages `/<repo>/` works too.

- **Netlify / Cloudflare Pages / Vercel:** build command `npm run build`, output directory `dist`.
- **GitHub Pages:** publish the contents of `dist/` (for example with the `actions/deploy-pages` workflow).

The site must be served over **HTTPS**, or the service worker (offline support and install) won't run.

## Install on iPhone

1. Open the site in **Safari**.
2. Tap **Share**, then **Add to Home Screen**.
3. Open OpenGym from the Home Screen icon, not from Safari.

Installed, it runs full screen and offline, and iOS is much less likely to clear its storage. The app asks for persistent storage on first setup. **Settings → Back up now** saves a single file you can keep in iCloud Drive.

On Android/Chrome, use **Install app** from the browser menu.

## Where things are

| Path | What |
| --- | --- |
| `design/` | The spec (`SPEC.md`), storyboards and brand assets the app is built from |
| `src/db/` | Data model, Dexie schema, built-in exercise library |
| `src/lib/` | Pure logic with tests: 1RM, records, next-up, prefill, import parsing, CSV |
| `src/data/` | Reads and writes, history index, backup / restore / import |
| `src/components/` | Shared UI, overlays, keypad, gestures, charts, icons |
| `src/screens/` | One folder per area: onboarding, home, plans, workout, history, progress, exercises, settings |

Your data stays in the browser's IndexedDB on your device. Nothing is ever sent anywhere.
