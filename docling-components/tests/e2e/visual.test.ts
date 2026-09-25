/**
 * Visual regression tests.
 *
 * Every test navigates to /docling-components/tests/fixtures/local.html,
 * scrolls a specific component into view, and screenshots it clipped to
 * its bounding rect.  Baselines live in tests/snapshots/ and are committed
 * so CI can compare against them.
 *
 * To regenerate baselines: npm run test:e2e:update
 *
 * Coverage:
 *   Page images (docling-img)
 *     img-page-1    title page with Docling logo, authors table, abstract
 *     img-page-8    line-chart picture + two tables on one page
 *
 *   Augmented page-image variants
 *     img-backdrop  page 1 with faded backdrop image behind item rectangles
 *     img-pagenums  pages 1–3 stacked with page-number headers/footers
 *     img-gallery   all 9 pages tiled in a flex-wrap thumbnail strip
 *
 *   Single-table views (docling-table, one table per component)
 *     table-0       4×8 performance grid
 *     table-1       2×6 benchmark summary
 *     table-2       13×5 full benchmark detail
 *     table-prov    table[2] with provenance (crop) column alongside parsed
 *
 *   Multi-table views (all 3 tables in one docling-table via items list)
 *     table-all       tables 0+1+2 stacked, default two-column layout
 *     table-all-prov  tables 0+1+2 with explicit parsed + provenance columns
 *     table-pagenums  tables 0+1+2 with page-number headers between pages
 */

import { expect, test, type Page } from '@playwright/test';

const THRESHOLD = { maxDiffPixelRatio: 0.02 };
const SRC = '/docling-components/tests/fixtures/local.html';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wait for a Lit Task to reach the complete state (status === 2). */
async function waitForTask(page: Page, selector: string, timeout = 20_000) {
  await page.waitForFunction(
    ([sel, _t]: [string, number]) => {
      const el = document.querySelector(sel) as Record<string, unknown> | null;
      const task = el?.['fetchTask'] as Record<string, unknown> | undefined;
      return task?.['status'] === 2;
    },
    [selector, timeout] as [string, number],
    { timeout }
  );
}

/**
 * Scroll `hostSelector` into view and return the bounding rect of the
 * first `childSelector` found in its shadow root (one level deep).
 * Falls back to the host's own rect if childSelector is not given.
 */
async function rectOf(
  page: Page,
  hostSelector: string,
  childSelector?: string
): Promise<DOMRect> {
  await page.evaluate((sel: string) => {
    document.querySelector(sel)?.scrollIntoView({ block: 'start' });
  }, hostSelector);
  // brief settle after scroll
  await page.waitForTimeout(50);
  return page.evaluate(
    ([host, child]: [string, string | undefined]) => {
      const el = document.querySelector(host);
      const target = child ? el?.shadowRoot?.querySelector(child) : el;
      return target?.getBoundingClientRect().toJSON() as DOMRect;
    },
    [hostSelector, childSelector] as [string, string | undefined]
  );
}

/** Screenshot a clipped region of the page. */
async function shot(page: Page, name: string, clip: DOMRect) {
  expect(clip, `${name}: element should have non-zero size`).toBeTruthy();
  await expect(page).toHaveScreenshot(name, { ...THRESHOLD, clip });
}

// ---------------------------------------------------------------------------
// Visual tests
// ---------------------------------------------------------------------------

test.describe('visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(SRC);
  });

  // ── Single-page image renders ────────────────────────────────────────────

  test('img — page 1 (title, logo, authors)', async ({ page }) => {
    await waitForTask(page, '#visual-img-p1');
    const box = await rectOf(page, '#visual-img-p1', 'docling-img-page');
    await shot(page, 'img-page-1.png', box);
  });

  test('img — page 8 (line-chart picture + two tables)', async ({ page }) => {
    await waitForTask(page, '#visual-img-p8');
    const box = await rectOf(page, '#visual-img-p8', 'docling-img-page');
    await shot(page, 'img-page-8.png', box);
  });

  // ── Augmented variants ───────────────────────────────────────────────────

  test('img — backdrop: faded page image behind item rects', async ({
    page,
  }) => {
    await waitForTask(page, '#visual-backdrop');
    const box = await rectOf(page, '#visual-backdrop', 'docling-img-page');
    await shot(page, 'img-backdrop.png', box);
  });

  test('img — page numbers: three pages stacked with headers/footers', async ({
    page,
  }) => {
    await waitForTask(page, '#visual-pagenums');
    const box = await rectOf(page, '#visual-pagenums');
    await shot(page, 'img-pagenums.png', box);
  });

  test('img — gallery: all 9 pages in flex-wrap thumbnail strip', async ({
    page,
  }) => {
    await waitForTask(page, '#visual-gallery');
    await page.evaluate(() => {
      document
        .querySelector('#visual-gallery')
        ?.scrollIntoView({ block: 'start' });
    });
    await page.waitForTimeout(100);
    const box = await page.evaluate(() => {
      return document
        .querySelector('#visual-gallery')
        ?.getBoundingClientRect()
        .toJSON() as DOMRect;
    });
    await shot(page, 'img-gallery.png', box);
  });

  // ── Table views ──────────────────────────────────────────────────────────

  /**
   * Navigate through the shadow-DOM chain inside docling-table to reach the
   * docling-item-table that renders the HTML grid.
   */
  async function itemTableBox(page: Page, hostId: string): Promise<DOMRect> {
    await page.evaluate((id: string) => {
      document.querySelector(id)?.scrollIntoView({ block: 'start' });
    }, hostId);
    await page.waitForTimeout(50);
    return page.evaluate((id: string) => {
      const tbl = document
        .querySelector(id)
        ?.shadowRoot?.querySelector('docling-table-page');
      const col = tbl?.shadowRoot?.querySelector('docling-column');
      const itemTbl = col?.shadowRoot?.querySelector('docling-item-table');
      return itemTbl?.getBoundingClientRect().toJSON() as DOMRect;
    }, hostId);
  }

  test('table — table[0]: 4×8 performance grid', async ({ page }) => {
    await waitForTask(page, '#visual-table-0');
    const box = await itemTableBox(page, '#visual-table-0');
    await shot(page, 'table-0.png', box);
  });

  test('table — table[1]: 2×6 benchmark summary', async ({ page }) => {
    await waitForTask(page, '#visual-table-1');
    const box = await itemTableBox(page, '#visual-table-1');
    await shot(page, 'table-1.png', box);
  });

  test('table — table[2]: 13×5 full benchmark detail', async ({ page }) => {
    await waitForTask(page, '#visual-table-2');
    const box = await itemTableBox(page, '#visual-table-2');
    await shot(page, 'table-2.png', box);
  });

  test('table — table[2] with provenance column', async ({ page }) => {
    await waitForTask(page, '#visual-table-prov');
    // For the provenance-column variant, screenshot the whole host element
    // so both columns (parsed + provenance crop) are visible.
    const box = await rectOf(page, '#visual-table-prov');
    await shot(page, 'table-prov.png', box);
  });

  // ── Multi-table views ────────────────────────────────────────────────

  test('table — all tables (0+1+2) stacked in one component', async ({
    page,
  }) => {
    await waitForTask(page, '#visual-table-all');
    const box = await rectOf(page, '#visual-table-all');
    await shot(page, 'table-all.png', box);
  });

  test('table — all tables (0+1+2) with provenance column', async ({
    page,
  }) => {
    await waitForTask(page, '#visual-table-all-prov');
    const box = await rectOf(page, '#visual-table-all-prov');
    await shot(page, 'table-all-prov.png', box);
  });

  test('table — all tables (0+1+2) with page-number headers', async ({
    page,
  }) => {
    await waitForTask(page, '#visual-table-pagenums');
    const box = await rectOf(page, '#visual-table-pagenums');
    await shot(page, 'table-pagenums.png', box);
  });
});
