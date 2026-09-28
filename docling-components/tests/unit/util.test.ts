/**
 * Unit tests for util.ts helpers: pagesOf and itemsByPagesOf.
 * These run in Node via vitest — no browser required.
 */

import { describe, expect, it } from 'vitest';
import type { DoclingDocument } from '@docling/docling-core';
import { pagesOf, itemsByPagesOf } from '../../src/util';

// ---------------------------------------------------------------------------
// Minimal document fixture
// ---------------------------------------------------------------------------

const doc: DoclingDocument = {
  schema_name: 'DoclingDocument',
  version: '1.0.0',
  name: 'unit-test',
  body: {
    self_ref: '#/body',
    children: [{ $ref: '#/texts/0' }, { $ref: '#/texts/1' }],
  },
  texts: [
    {
      self_ref: '#/texts/0',
      label: 'title',
      orig: 'Hello',
      text: 'Hello',
      prov: [
        { page_no: 1, bbox: { l: 0, t: 0, r: 100, b: 20 }, charspan: [0, 5] },
      ],
    },
    {
      self_ref: '#/texts/1',
      label: 'paragraph',
      orig: 'World',
      text: 'World',
      prov: [
        { page_no: 2, bbox: { l: 0, t: 0, r: 100, b: 20 }, charspan: [0, 5] },
      ],
    },
  ],
  pages: {
    '1': { page_no: 1, size: { width: 200, height: 280 } },
    '2': { page_no: 2, size: { width: 200, height: 280 } },
  },
};

// ---------------------------------------------------------------------------
// pagesOf
// ---------------------------------------------------------------------------

describe('pagesOf', () => {
  it('returns pages sorted by page_no', () => {
    const pages = pagesOf(doc);
    expect(pages).toHaveLength(2);
    expect(pages[0].page_no).toBe(1);
    expect(pages[1].page_no).toBe(2);
  });

  it('returns empty array for undefined document', () => {
    expect(pagesOf(undefined)).toHaveLength(0);
  });

  it('returns empty array for document with no pages', () => {
    const empty: DoclingDocument = {
      name: 'empty',
      body: { self_ref: '#/body' },
    };
    expect(pagesOf(empty)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// itemsByPagesOf
// ---------------------------------------------------------------------------

describe('itemsByPagesOf', () => {
  it('maps each item to its page', () => {
    const map = itemsByPagesOf(doc);
    expect(map[1]).toHaveLength(1);
    expect(map[1][0].self_ref).toBe('#/texts/0');
    expect(map[2]).toHaveLength(1);
    expect(map[2][0].self_ref).toBe('#/texts/1');
  });

  it('produces an entry for every page even with no items', () => {
    const sparse: DoclingDocument = {
      name: 'sparse',
      body: { self_ref: '#/body', children: [{ $ref: '#/texts/0' }] },
      texts: [
        {
          self_ref: '#/texts/0',
          label: 'title',
          orig: 'Hi',
          text: 'Hi',
          prov: [
            {
              page_no: 1,
              bbox: { l: 0, t: 0, r: 100, b: 20 },
              charspan: [0, 2],
            },
          ],
        },
      ],
      pages: {
        '1': { page_no: 1, size: { width: 200, height: 280 } },
        '2': { page_no: 2, size: { width: 200, height: 280 } },
      },
    };
    const map = itemsByPagesOf(sparse);
    expect(map[1]).toHaveLength(1);
    expect(map[2]).toHaveLength(0);
  });
});
