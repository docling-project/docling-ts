import {
  DocItem,
  DoclingDocument,
  PageItem,
  isDocling,
  iterateDocumentItems,
} from '@docling/docling-core';

export function pagesOf(doc?: DoclingDocument): PageItem[] {
  return Object.values(doc?.pages ?? {}).sort(
    (p1: PageItem, p2: PageItem) => p1.page_no - p2.page_no
  );
}

export function itemsByPagesOf(
  doc: DoclingDocument
): Record<number, DocItem[]> {
  const items = Array.from(iterateDocumentItems(doc, { traversePictures: true })) as [DocItem, number][];

  const pageToItems: Record<number, DocItem[]> = {};
  for (const p of pagesOf(doc)) {
    pageToItems[p.page_no] = [];
  }
  for (const [item] of items) {
    for (const p of item.prov ?? []) {
      // Deal with multiple provenances on a single page.
      if (pageToItems[p.page_no].at(-1) !== item) {
        pageToItems[p.page_no].push(item);
      }
    }
  }

  return pageToItems;
}

export async function loadItems(
  src?: string | DoclingDocument,
  filters: {
    items?: string | DocItem[];
  } = {}
): Promise<{ page: PageItem; items: DocItem[]; trimmed: boolean }[]> {
  let doc: DoclingDocument | undefined;
  if (typeof src === 'string') {
    const fetched = await fetch(src);
    doc = await fetched.json();
  } else if (typeof src === 'object' && isDocling.Document(src)) {
    doc = src;
  }

  const pages = pagesOf(doc);
  const allItems = Array.from(
    iterateDocumentItems(doc, { traversePictures: true })
  ).map(([item]) => item) as DocItem[];

  // Filter by crop reference paths.
  let retainedItems: DocItem[] = allItems;
  const cutPages = new Set<number>();
  if (typeof filters.items === 'string') {
    const cropPaths = new Set(
      filters.items
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)
    );

    if (cropPaths.size > 0) {
      retainedItems = [];
      for (const item of allItems) {
        // Any scope in crop filters. For example: #/pictures and #/pictures/3
        const refParts = item.self_ref.split('/');
        const partialPaths: string[] = [];
        for (let i = 2; i < refParts.length + 1; i++) {
          partialPaths.push(refParts.slice(0, i).join('/'));
        }

        // Allow pages in crop filters as well.
        item.prov?.forEach(p => partialPaths.push(`#/pages/${p.page_no}`));

        if (partialPaths.some(p => cropPaths.has(p))) {
          retainedItems.push(item);
        } else {
          item.prov?.forEach(p => cutPages.add(p.page_no));
        }
      }
    }
  } else if (Array.isArray(filters.items)) {
    retainedItems = [];
    const allowedItems = new Set(filters.items);

    for (const item of allItems) {
      if (allowedItems.has(item)) {
        retainedItems.push(item);
      } else {
        item.prov?.forEach(p => cutPages.add(p.page_no));
      }
    }
  }

  const pageToItems: Record<number, DocItem[]> = {};
  for (const p of pages) {
    pageToItems[p.page_no] = [];
  }
  for (const item of retainedItems) {
    for (const p of item.prov ?? []) {
      // Deal with multiple provenances on a single page.
      if (pageToItems[p.page_no].at(-1) !== item) {
        pageToItems[p.page_no].push(item);
      }
    }
  }

  return pages.map(page => ({
    page,
    items: pageToItems[page.page_no],
    trimmed: cutPages.has(page.page_no),
  }));
}
