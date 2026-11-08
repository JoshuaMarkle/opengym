/**
 * Testing mode: the dev server on this laptop (`npm run dev`, opened at localhost)
 * uses its own database, `opengym-test`, filled with sample history from July 2024.
 * Never on in a production build, and never when a phone opens the dev server over
 * the network, so real data is untouched. `npm run dev:real` turns it off.
 */
export const TEST_MODE: boolean =
  import.meta.env.DEV &&
  import.meta.env.VITE_TEST_MODE !== 'false' &&
  typeof location !== 'undefined' &&
  ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
