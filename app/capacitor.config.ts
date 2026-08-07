import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Written by hand against Capacitor's documented config shape — this sandbox
 * has no npm registry access, so `@capacitor/cli` itself can't be installed
 * here to validate this file or run `npx cap add ios` / `npx cap add
 * android`. Those two commands are the actual remaining step, and they're a
 * human-only one: see HANDOFF.md "Native build" for exactly what to run and
 * why it can't happen in this environment (no npm access, and iOS builds
 * specifically require a real Mac with Xcode regardless of that).
 *
 * Everything this config points at already exists and is real: `webDir`
 * is the same `dist/` produced by `npm run build`, already proven to render
 * correctly and pass the full e2e suite in a real browser.
 */
const config: CapacitorConfig = {
  appId: 'com.punchbuggy.app',
  appName: 'Punch Buggy',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
