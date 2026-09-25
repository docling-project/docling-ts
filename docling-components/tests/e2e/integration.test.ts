/**
 * Integration tests for docling-components loaded from the local build.
 *
 * These tests verify:
 *  - Custom elements are registered by the module.
 *  - <docling-img> renders one page per document page.
 *  - <docling-img> renders one item-rect per DocItem provenance.
 *  - <docling-table> renders one row per item with correct text content.
 *  - <docling-img> respects the `items` filter attribute.
 */

import { expect, test, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wait for a Lit Task inside a shadow root to reach the complete state (2). */
async function waitForTask(page: Page, selector: string) {
  await page.waitForFunction(
    (sel: string) => {
      const el = document.querySelector(sel) as Record<string, unknown> | null;
      const task = el?.['fetchTask'] as Record<string, unknown> | undefined;
      return task?.['status'] === 2;
    },
    selector,
    { timeout: 10_000 }
  );
}

// ---------------------------------------------------------------------------
// Local-build tests
// ---------------------------------------------------------------------------

test.describe('local build', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/docling-components/tests/fixtures/local.html');
  });

  // ── Custom element registration ────────────────────────────────────────────

  test('custom elements are registered', async ({ page }) => {
    const tags = await page.evaluate(() =>
      [
        'docling-img',
        'docling-table',
        'docling-img-page',
        'docling-table-page',
        'docling-column',
        'docling-item-text',
        'docling-item-table',
        'docling-item-provenance',
        'docling-trace',
        'docling-overlay',
        'docling-tooltip',
        'docling-picture-classification',
        'docling-picture-description',
      ].map(tag => ({ tag, defined: !!customElements.get(tag) }))
    );

    for (const { tag, defined } of tags) {
      expect(defined, `${tag} should be defined`).toBe(true);
    }
  });

  // ── docling-img ─────────────────────────────────────────────────────────

  test('docling-img renders one page', async ({ page }) => {
    await waitForTask(page, '#img');
    const pages = await page.evaluate(
      () =>
        document
          .querySelector('#img')
          ?.shadowRoot?.querySelectorAll('docling-img-page').length
    );
    expect(pages).toBe(1);
  });

  test('docling-img page has SVG with item rects', async ({ page }) => {
    await waitForTask(page, '#img');
    const rects = await page.evaluate(() => {
      const imgPage = document
        .querySelector('#img')
        ?.shadowRoot?.querySelector('docling-img-page');
      return imgPage?.shadowRoot?.querySelectorAll('rect').length ?? 0;
    });
    // fixture has 3 texts + 1 table + 1 picture = 5 provenance entries on page 1
    expect(rects).toBe(5);
  });

  test('docling-img renders page image', async ({ page }) => {
    await waitForTask(page, '#img');
    const hasBg = await page.evaluate(() => {
      const imgPage = document
        .querySelector('#img')
        ?.shadowRoot?.querySelector('docling-img-page');
      const images = imgPage?.shadowRoot?.querySelectorAll('image');
      return (images?.length ?? 0) > 0;
    });
    expect(hasBg).toBe(true);
  });

  test('docling-img respects items filter', async ({ page }) => {
    await page.evaluate(() => {
      const el = document.querySelector('#img') as HTMLElement & {
        items: string;
      };
      el.items = '#/tables';
    });
    await waitForTask(page, '#img');
    // After filter, only the table item has provenance → 1 rect.
    const rects = await page.evaluate(() => {
      const imgPage = document
        .querySelector('#img')
        ?.shadowRoot?.querySelector('docling-img-page');
      return imgPage?.shadowRoot?.querySelectorAll('rect').length ?? 0;
    });
    expect(rects).toBe(1);
  });

  // ── docling-table ─────────────────────────────────────────────────────────

  test('docling-table renders one row per item', async ({ page }) => {
    await waitForTask(page, '#table');
    const rows = await page.evaluate(() => {
      const tbl = document
        .querySelector('#table')
        ?.shadowRoot?.querySelector('docling-table-page');
      return tbl?.shadowRoot?.querySelectorAll('tr').length ?? 0;
    });
    // The fixture items="#/tables/0" resolves to 1 DocItem → 1 row.
    expect(rows).toBe(1);
  });

  test('docling-table default column renders item-table', async ({ page }) => {
    await waitForTask(page, '#table');
    const hasTable = await page.evaluate(() => {
      const tbl = document
        .querySelector('#table')
        ?.shadowRoot?.querySelector('docling-table-page');
      const col = tbl?.shadowRoot?.querySelector('docling-column');
      const itemTbl = col?.shadowRoot?.querySelector('docling-item-table');
      return itemTbl !== null;
    });
    expect(hasTable).toBe(true);
  });

  test('docling-item-table renders correct cell text', async ({ page }) => {
    await waitForTask(page, '#table');
    const cells = await page.evaluate(() => {
      const tbl = document
        .querySelector('#table')
        ?.shadowRoot?.querySelector('docling-table-page');
      const col = tbl?.shadowRoot?.querySelector('docling-column');
      const itemTbl = col?.shadowRoot?.querySelector('docling-item-table');
      return Array.from(itemTbl?.shadowRoot?.querySelectorAll('td') ?? []).map(
        td => td.textContent?.trim()
      );
    });
    expect(cells).toContain('Alpha');
    expect(cells).toContain('Beta');
    expect(cells).toContain('1');
    expect(cells).toContain('2');
  });
});
