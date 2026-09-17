import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { iterateDocumentItems, resolveDocumentItem } from '../src/index';
import {
  type DoclingDocument,
  type FormItem,
  type KeyValueItem,
  type ListItem,
  type SectionHeaderItem,
  type TextItem,
  isDocling,
  isDoclingDocItem,
} from '../src/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadDocument(filename: string): DoclingDocument {
  const raw = readFileSync(resolve(__dirname, '../data', filename), 'utf-8');
  return JSON.parse(raw) as DoclingDocument;
}

const loadMinimalDocument = () => loadDocument('minimal-document.json');
const loadTestDocument = () => loadDocument('test-document.json');

// ---------------------------------------------------------------------------
// resolveDocumentItem
// ---------------------------------------------------------------------------

describe('resolveDocumentItem', () => {
  it('resolves a text reference', () => {
    const doc = loadMinimalDocument();
    const ref = doc.body!.children![0]; // #/texts/0
    const item = resolveDocumentItem(doc, ref);
    expect(item.self_ref).toBe('#/texts/0');
    expect((item as TextItem).label).toBe('title');
  });

  it('resolves a table reference', () => {
    const doc = loadMinimalDocument();
    const ref = doc.body!.children![2]; // #/tables/0
    const item = resolveDocumentItem(doc, ref);
    expect(item.self_ref).toBe('#/tables/0');
    expect(isDoclingDocItem.TableItem(item)).toBe(true);
  });

  it('resolves a picture reference', () => {
    const doc = loadMinimalDocument();
    const ref = doc.body!.children![3]; // #/pictures/0
    const item = resolveDocumentItem(doc, ref);
    expect(item.self_ref).toBe('#/pictures/0');
    expect(isDoclingDocItem.PictureItem(item)).toBe(true);
  });

  it('resolves a group reference', () => {
    const doc = loadMinimalDocument();
    const ref = doc.body!.children![4]; // #/groups/0
    const item = resolveDocumentItem(doc, ref);
    expect(item.self_ref).toBe('#/groups/0');
    expect(isDocling.GroupItem(item)).toBe(true);
  });

  it('resolves a top-level path (body)', () => {
    const doc = loadMinimalDocument();
    const ref = { $ref: '#/body' };
    const item = resolveDocumentItem(doc, ref);
    expect(item.self_ref).toBe('#/body');
  });
});

// ---------------------------------------------------------------------------
// iterateDocumentItems — minimal document
// ---------------------------------------------------------------------------

describe('iterateDocumentItems (minimal document)', () => {
  it('yields nothing for undefined document', () => {
    const items = [...iterateDocumentItems(undefined)];
    expect(items).toHaveLength(0);
  });

  it('yields content items from body in order', () => {
    const doc = loadMinimalDocument();
    const items = [...iterateDocumentItems(doc)];
    const selfRefs = items.map(([item]) => item.self_ref);

    expect(selfRefs).toContain('#/texts/0');
    expect(selfRefs).toContain('#/texts/1');
    expect(selfRefs).toContain('#/tables/0');
    expect(selfRefs).toContain('#/pictures/0');
    // groups/0 is not yielded by default (withGroups defaults to false)
    expect(selfRefs).not.toContain('#/groups/0');
  });

  it('yields group items when withGroups is true', () => {
    const doc = loadMinimalDocument();
    const items = [...iterateDocumentItems(doc, { withGroups: true })];
    const selfRefs = items.map(([item]) => item.self_ref);
    expect(selfRefs).toContain('#/groups/0');
  });

  it('does not traverse into picture children without traversePictures', () => {
    const doc = loadMinimalDocument();
    // Add a unique child ref that only exists via the picture
    doc.pictures![0].children = [{ $ref: '#/texts/1' }];
    // Remove texts/1 from body so it only appears if picture is traversed
    doc.body!.children = doc.body!.children!.filter(c => c.$ref !== '#/texts/1');
    const items = [...iterateDocumentItems(doc)];
    const refs = items.map(([item]) => item.self_ref);
    expect(refs).not.toContain('#/texts/1');
  });

  it('traverses into picture children with traversePictures', () => {
    const doc = loadMinimalDocument();
    doc.pictures![0].children = [{ $ref: '#/texts/1' }];
    // Remove texts/1 from body so it only appears via picture traversal
    doc.body!.children = doc.body!.children!.filter(c => c.$ref !== '#/texts/1');
    const items = [...iterateDocumentItems(doc, { traversePictures: true })];
    const refs = items.map(([item]) => item.self_ref);
    expect(refs).toContain('#/texts/1');
  });

  it('yields correct nesting levels', () => {
    // Dedicated inline fixture: body → [texts/0, groups/0 → [texts/1]]
    const doc: DoclingDocument = {
      schema_name: 'DoclingDocument',
      version: '1.0.0',
      name: 'Level Test',
      body: {
        self_ref: '#/body',
        children: [
          { $ref: '#/texts/0' },
          { $ref: '#/groups/0' },
        ],
      },
      texts: [
        { self_ref: '#/texts/0', label: 'title', orig: 'Title', text: 'Title' },
        { self_ref: '#/texts/1', label: 'text', orig: 'Nested', text: 'Nested' },
      ],
      groups: [
        { self_ref: '#/groups/0', children: [{ $ref: '#/texts/1' }], name: 'g', label: 'section' },
      ],
    };
    // Use first occurrence for each ref
    const seen = new Map<string, number>();
    for (const [item, level] of iterateDocumentItems(doc, { withGroups: true })) {
      if (!seen.has(item.self_ref)) seen.set(item.self_ref, level);
    }

    // body itself is the root at level 0; its direct children are at level 1
    expect(seen.get('#/texts/0')).toBe(1);
    expect(seen.get('#/groups/0')).toBe(1);
    // texts/1 is a child of groups/0 (level 1), so it's at level 2
    expect(seen.get('#/texts/1')).toBe(2);
  });

  it('filters by pageNo when provenance is present', () => {
    const doc = loadMinimalDocument();
    (doc.texts![0] as TextItem).prov = [
      { page_no: 1, bbox: { l: 0, t: 0, r: 100, b: 20 }, charspan: [0, 8] },
    ];
    (doc.texts![1] as TextItem).prov = [
      { page_no: 2, bbox: { l: 0, t: 0, r: 100, b: 20 }, charspan: [0, 15] },
    ];

    const page1Refs = [...iterateDocumentItems(doc, { pageNo: 1 })].map(([item]) => item.self_ref);
    expect(page1Refs).toContain('#/texts/0');
    expect(page1Refs).not.toContain('#/texts/1');

    const page2Refs = [...iterateDocumentItems(doc, { pageNo: 2 })].map(([item]) => item.self_ref);
    expect(page2Refs).not.toContain('#/texts/0');
    expect(page2Refs).toContain('#/texts/1');
  });

  it('allows iterating from a custom root', () => {
    const doc = loadMinimalDocument();
    const group = doc.groups![0]; // has child texts/0
    const items = [...iterateDocumentItems(doc, { root: group, withGroups: true })];
    const selfRefs = items.map(([item]) => item.self_ref);
    // group itself is the root, yielded at level 0
    expect(selfRefs).toContain('#/groups/0');
    // its child texts/0 is yielded at level 1
    expect(selfRefs).toContain('#/texts/0');
    // texts/1, tables/0, pictures/0 are NOT under this group
    expect(selfRefs).not.toContain('#/texts/1');
    expect(selfRefs).not.toContain('#/tables/0');
  });
});

// ---------------------------------------------------------------------------
// iterateDocumentItems — real test document
// ---------------------------------------------------------------------------

describe('iterateDocumentItems (test-document.json)', () => {
  const doc = loadTestDocument();

  it('parses the document as a DoclingDocument', () => {
    expect(isDocling.Document(doc)).toBe(true);
    expect(doc.name).toBe('2206.01062');
  });

  it('yields the expected total item count from body', () => {
    const items = [...iterateDocumentItems(doc)];
    expect(items.length).toBeGreaterThan(0);
    for (const [item] of items) {
      expect(isDocling.NodeItem(item)).toBe(true);
    }
  });

  it('yields groups when withGroups is true', () => {
    const withoutGroups = [...iterateDocumentItems(doc)].length;
    const withGroups = [...iterateDocumentItems(doc, { withGroups: true })].length;
    expect(withGroups).toBeGreaterThan(withoutGroups);
  });

  it('all items are non-group DocItems (withGroups false)', () => {
    for (const [item] of iterateDocumentItems(doc)) {
      expect(isDocling.DocItem(item)).toBe(true);
    }
  });

  it('item counts match expected document structure', () => {
    const items = [...iterateDocumentItems(doc)];
    const tables = items.filter(([item]) => isDoclingDocItem.TableItem(item));
    const pictures = items.filter(([item]) => isDoclingDocItem.PictureItem(item));

    expect(tables.length).toBe(doc.tables?.length ?? 0);
    expect(pictures.length).toBe(doc.pictures?.length ?? 0);
  });

  it('section headers are correctly identified', () => {
    const items = [...iterateDocumentItems(doc)];
    const headers = items.filter(([item]) => isDoclingDocItem.SectionHeaderItem(item));
    expect(headers.length).toBeGreaterThan(0);
    for (const [item] of headers) {
      expect((item as SectionHeaderItem).label).toBe('section_header');
    }
  });

  it('list items are correctly identified', () => {
    const items = [...iterateDocumentItems(doc)];
    const listItems = items.filter(([item]) => isDoclingDocItem.ListItem(item));
    expect(listItems.length).toBeGreaterThan(0);
    for (const [item] of listItems) {
      expect((item as ListItem).label).toBe('list_item');
    }
  });

  it('text items cover generic text labels', () => {
    const items = [...iterateDocumentItems(doc)];
    const textItems = items.filter(([item]) => isDoclingDocItem.TextItem(item));
    expect(textItems.length).toBeGreaterThan(0);
  });

  it('items at level 1 are direct body children', () => {
    // body is the root at level 0; its direct children are at level 1
    const level1 = [...iterateDocumentItems(doc, { withGroups: true })]
      .filter(([, level]) => level === 1)
      .map(([item]) => item.self_ref);

    const bodyChildRefs = new Set((doc.body?.children ?? []).map(ref => ref.$ref));
    for (const ref of new Set(level1)) {
      expect(bodyChildRefs.has(ref)).toBe(true);
    }
  });

  it('KeyValueItem / FormItem are identified when present', () => {
    const kv: KeyValueItem = {
      self_ref: '#/key_value_items/0',
      label: 'key_value_region',
      graph: { cells: [], links: [] },
    };
    const form: FormItem = {
      self_ref: '#/form_items/0',
      label: 'form',
      graph: { cells: [], links: [] },
    };
    expect(isDocling.DocItem(kv)).toBe(true);
    expect(isDocling.DocItem(form)).toBe(true);
  });
});
