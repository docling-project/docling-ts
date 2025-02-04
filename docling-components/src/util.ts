import {
  DocItem,
  DoclingDocument,
  PageItem,
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
  const items = Array.from(iterateDocumentItems(doc)) as [DocItem, number][];

  const pageToItems: Record<number, DocItem[]> = {};
  for (const p of pagesOf(doc)) {
    pageToItems[p.page_no] = [];
  }
  for (const [item] of items) {
    for (const p of item.prov ?? []) {
      pageToItems[p.page_no].push(item);
    }
  }

  return pageToItems;
}

export function pagedItems(
  doc?: DoclingDocument,
  filters: {
    items?: string | DocItem[];
  } = {}
): { page: PageItem; items: DocItem[]; trimmed: boolean }[] {
  const pages = pagesOf(doc);
  const items = Array.isArray(filters.items)
    ? filters.items
    : (Array.from(iterateDocumentItems(doc)).map(
        ([item]) => item
      ) as DocItem[]);

  // Filter by crop reference paths.
  let retainedItems = items;
  const cutPages = new Set<number>();
  if (typeof filters.items === 'string') {
    const cropPaths = new Set(filters.items.split(',').map(s => s.trim()));

    retainedItems = [];
    for (const item of items) {
      // Any scope in crop filters. For example: #/pictures and #/pictures/3
      const refParts = item.self_ref.split('/');
      const partialPaths: string[] = [];
      for (let i = 2; i < refParts.length; i++) {
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

  const pageToItems: Record<number, DocItem[]> = {};
  for (const p of pages) {
    pageToItems[p.page_no] = [];
  }
  for (const item of retainedItems) {
    for (const p of item.prov ?? []) {
      pageToItems[p.page_no].push(item);
    }
  }

  return pages.map(page => ({
    page,
    items: pageToItems[page.page_no],
    trimmed: cutPages.has(page.page_no),
  }));
}
