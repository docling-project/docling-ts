/**
 * CDN integration tests — validates that the component bundle registers the
 * same custom elements and renders the same content regardless of how it is
 * loaded.
 *
 * The fixture (cdn.html) injects a <script type="module"> pointing at
 * https://unpkg.com/@docling/docling-components@{version}.  By default every
 * request to that URL is intercepted and served from the local
 * dist/index.js build so the test exercises the current code without
 * requiring a published npm release or any network access.
 *
 * Set REAL_CDN=1 to disable the interception and hit the real unpkg CDN
 * (requires a published release and an internet connection).
 * Set CDN_VERSION to pin the version passed in the query-string (default: "latest").
 */

import { expect, test, type Page } from '@playwright/test';

const useRealCdn = !!process.env.REAL_CDN;
const LOCAL_DIST = '/docling-components/dist/index.js';

async function waitForTask(page: Page, selector: string) {
  await page.waitForFunction(
    (sel: string) => {
      const el = document.querySelector(sel) as Record<string, unknown> | null;
      const task = el?.['fetchTask'] as Record<string, unknown> | undefined;
      return task?.['status'] === 2;
    },
    selector,
    { timeout: 30_000 }
  );
}

test.describe('cdn build', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    // Intercept all unpkg requests for this package and serve the local
    // dist build instead, unless REAL_CDN=1 is set.
    if (!useRealCdn) {
      // Intercept the unpkg request and serve the local dist file instead.
      // route.fulfill with a URL fetch lets Playwright retrieve the local
      // file from the already-running webserver without needing fs access.
      await page.route(
        /unpkg\.com\/@docling\/docling-components/,
        async route => {
          const response = await route.fetch({
            url: `${baseURL}${LOCAL_DIST}`,
          });
          await route.fulfill({ response });
        }
      );
    }

    const version = process.env.CDN_VERSION ?? 'latest';
    await page.goto(
      `/docling-components/tests/fixtures/cdn.html?version=${version}`
    );
    // Wait for the dynamically injected module script to load and register elements.
    await page.waitForFunction(() => !!customElements.get('docling-img'), {
      timeout: 30_000,
    });
  });

  test('docling-img and docling-table are defined from CDN', async ({
    page,
  }) => {
    const defined = await page.evaluate(() => ({
      img: !!customElements.get('docling-img'),
      table: !!customElements.get('docling-table'),
    }));
    expect(defined.img).toBe(true);
    expect(defined.table).toBe(true);
  });

  test('docling-img renders at least one page from CDN', async ({ page }) => {
    await waitForTask(page, '#img');
    const pages = await page.evaluate(
      () =>
        document
          .querySelector('#img')
          ?.shadowRoot?.querySelectorAll('docling-img-page').length
    );
    expect(pages).toBeGreaterThanOrEqual(1);
  });

  test('docling-table renders rows from CDN', async ({ page }) => {
    await waitForTask(page, '#table');
    const rows = await page.evaluate(() => {
      const tbl = document
        .querySelector('#table')
        ?.shadowRoot?.querySelector('docling-table-page');
      return tbl?.shadowRoot?.querySelectorAll('tr').length ?? 0;
    });
    expect(rows).toBeGreaterThanOrEqual(1);
  });
});
