import { DEFAULT_CONTENT_LAYERS, isDocling } from './types';
import {
  BoundingBox,
  ContentLayer,
  DocItem,
  DoclingDocument,
  NodeItem,
  RefItem,
  Size,
} from './types';

export * from './types';

/**
 * Generates the parsed items of a document by traversing through its hierarchy in reading order.
 *
 * Only items in the `includedContentLayers` are yielded (default: `DEFAULT_CONTENT_LAYERS`,
 * i.e. `body`). Items without an explicit `content_layer` are considered to be in the `body` layer.
 */
export function* iterateDocumentItems(
  doc?: DoclingDocument,
  options: {
    root?: NodeItem;
    withGroups?: boolean;
    traversePictures?: boolean;
    pageNo?: number;
    includedContentLayers?: ContentLayer[];
  } = {}
): Generator<[NodeItem, number]> {
  const includedLayers = new Set<ContentLayer>(
    options.includedContentLayers ?? DEFAULT_CONTENT_LAYERS
  );

  if (doc) {
    yield* traverse(options.root ?? doc.body!);
  }

  function* traverse(
    item: NodeItem,
    level: number = 0
  ): Generator<[NodeItem, number]> {
    // Yield non-group items, and group items if withGroups, within the included content layers.
    if (
      (!isDocling.GroupItem(item) || options.withGroups) &&
      includedLayers.has(item.content_layer ?? 'body')
    ) {
      if (isDocling.DocItem(item)) {
        if (
          options.pageNo === undefined ||
          item.prov?.some(prov => prov.page_no === options.pageNo)
        ) {
          yield [item, level];
        }
      } else {
        yield [item, level];
      }
    }

    const rootIsPicture = isDocling.PictureItem(item);
    const allowedPicRefs = new Set(
      rootIsPicture ? (item.captions ?? []).map(r => r.$ref) : []
    );

    // Traverse children.
    for (const childRef of item.children ?? []) {
      if (
        rootIsPicture &&
        !options.traversePictures &&
        !allowedPicRefs.has(childRef.$ref)
      ) {
        continue;
      }

      const child = resolveDocumentItem(doc!, childRef);

      if (isDocling.NodeItem(child)) {
        yield* traverse(child, level + 1);
      }
    }
  }
}

/**
 * Generates `[pageNo, bbox]` for every bounding box anchored on a page: item
 * provenances, table cell bboxes of single-page tables, and key-value/form
 * graph cell provenances. Groups carry no provenance and are not visited.
 */
function* iteratePageBBoxes(
  doc: DoclingDocument
): Generator<[number, BoundingBox]> {
  const itemLists: DocItem[][] = [
    doc.texts ?? [],
    doc.pictures ?? [],
    doc.tables ?? [],
    doc.key_value_items ?? [],
    doc.form_items ?? [],
    doc.field_regions ?? [],
    doc.field_items ?? [],
  ];

  for (const item of itemLists.flat()) {
    const prov = item.prov ?? [];
    for (const p of prov) yield [p.page_no, p.bbox];
  }

  for (const table of doc.tables ?? []) {
    // Cell bboxes belong to a page only for single-page tables.
    const pageNos = new Set((table.prov ?? []).map(p => p.page_no));
    if (pageNos.size !== 1) continue;
    const [pageNo] = pageNos;
    for (const cell of table.data.table_cells ?? [])
      if (cell.bbox) yield [pageNo, cell.bbox];
  }

  for (const item of [
    ...(doc.key_value_items ?? []),
    ...(doc.form_items ?? []),
  ])
    for (const cell of item.graph.cells)
      if (cell.prov) yield [cell.prov.page_no, cell.prov.bbox];
}

/**
 * Get the smallest page size that contains all content, for every page with content.
 *
 * The size of a page is the largest horizontal and vertical coordinate over all
 * bounding boxes anchored on it: item provenances, table cell bboxes and
 * key-value/form graph cell provenances, in every content layer. Coordinates are
 * measured from `0`; negative coordinates are not accounted for.
 *
 * @returns A mapping from 1-based page number to minimum page size, for each page
 * that has at least one bounding box.
 */
export function getMinPageSizes(
  doc: DoclingDocument
): Map<number, Required<Size>> {
  const sizes = new Map<number, Required<Size>>();
  for (const [pageNo, bbox] of iteratePageBBoxes(doc)) {
    const size = sizes.get(pageNo) ?? { width: 0, height: 0 };
    size.width = Math.max(size.width, bbox.l, bbox.r);
    size.height = Math.max(size.height, bbox.t, bbox.b);
    sizes.set(pageNo, size);
  }
  return sizes;
}

/**
 * Get the smallest page size that contains all content of a page.
 *
 * See `getMinPageSizes`, which computes all pages in one pass.
 *
 * @param pageNo 1-based page number to measure.
 * @returns The minimum page size, `{ width: 0, height: 0 }` if the page has no
 * bounding boxes.
 */
export function getMinPageSize(
  doc: DoclingDocument,
  pageNo: number
): Required<Size> {
  return getMinPageSizes(doc).get(pageNo) ?? { width: 0, height: 0 };
}

/**
 * Resolve a given item reference, within a given document, to its full document item.
 */
export function resolveDocumentItem(
  doc: DoclingDocument,
  item: RefItem
): NodeItem {
  const parts = item.$ref.split('/').slice(1);

  return parts.reduce(
    (item: unknown, p) => (item as Record<string, NodeItem>)[p],
    doc
  ) as NodeItem;
}
