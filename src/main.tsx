import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { db } from './db/db';
import { ensureSeeded } from './db/seed';
import './index.css';

// Offline: cache the app shell; updates apply on next launch.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  registerSW({ immediate: true });
}

// Dev only: lets test scripts reach the database.
if (import.meta.env.DEV) Object.assign(window, { __og: { db } });

const root = createRoot(document.getElementById('root')!);

ensureSeeded()
  .catch((e) => console.error('Seeding failed', e))
  .finally(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
