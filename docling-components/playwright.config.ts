import { defineConfig, devices } from '@playwright/test';

/**
 * Two projects:
 *  - local  : served from the built dist/index.js (fast, no network)
 *  - cdn    : loads cdn.html, which injects a <script> pointing at unpkg.
 *             By default unpkg requests are intercepted and served from the
 *             local dist build (no network, no published release needed).
 *             Set REAL_CDN=1 to hit the real unpkg CDN instead.
 *
 * The built-in static server serves the repo root so both
 * /docling-components/dist/ and /docling-components/tests/fixtures/
 * are reachable under a single origin.
 */
export default defineConfig({
  testDir: './tests/e2e',
  snapshotDir: './tests/snapshots',
  // Re-run flaky tests once in CI.
  retries: process.env.CI ? 1 : 0,
  // Serial in CI to keep memory low; parallel locally.
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    // All tests share this base URL (repo root).
    baseURL: 'http://localhost:4400',
    // Capture traces on first retry.
    trace: 'on-first-retry',
  },

  // Serve the repo root so /docling-components/** is reachable.
  webServer: {
    command: 'npx serve -l 4400 --no-clipboard ../',
    url: 'http://localhost:4400',
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },

  projects: [
    {
      name: 'local',
      // Runs integration + visual tests against the local dist build.
      // Excludes cdn.test.ts (that belongs to the cdn project).
      testIgnore: '**/cdn.test.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'cdn',
      // Only runs cdn.test.ts — the CDN fixture intercepts unpkg requests
      // and serves dist/index.js locally by default (REAL_CDN=1 to disable).
      testMatch: '**/cdn.test.ts',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
