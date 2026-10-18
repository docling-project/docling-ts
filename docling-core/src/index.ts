import { DEFAULT_CONTENT_LAYERS, isDocling } from './types';
import { ContentLayer, DoclingDocument, NodeItem, RefItem } from './types';

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
