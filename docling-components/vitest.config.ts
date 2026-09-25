import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.{test,spec}.{ts,mts}'],
    // Exclude Playwright e2e tests — those run via `npm run test:e2e`.
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
});
