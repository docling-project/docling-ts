import { isDocling } from './types';
import { DoclingDocument, NodeItem, RefItem } from './types';

export * from './types';

export function* iterateDocumentItems(
  doc?: DoclingDocument,
  options: {
    root?: NodeItem;
    withGroups?: boolean;
    traversePictures?: boolean;
    pageNo?: number;
  } = {}
): Generator<[NodeItem, number]> {
  if (doc) {
    yield* traverse(options.root ?? doc.body!);
  }

  function* traverse(
    item: NodeItem,
    level: number = 0
  ): Generator<[NodeItem, number]> {
    // Yield non-group items, and group items if withGroups.
    if (!isDocling.GroupItem(item) || options.withGroups) {
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

    // Handle picture traversal - only traverse children if requested
    if (isDocling.PictureItem(item) && !options.traversePictures) {
      return;
    }

    // Traverse children.
    for (const childRef of item.children ?? []) {
      const child = resolveDocumentItem(doc!, childRef);

      if (isDocling.NodeItem(child)) {
        yield* traverse(child, level + 1);
      }
    }
  }
}

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
