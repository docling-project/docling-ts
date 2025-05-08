import { BoundingBox, PageItem } from '@docling/docling-core';

export { customDoclingItemElement } from './registry';
export * from './ItemProvenance';
export * from './ItemElement';
export * from './ItemTable';
export * from './ItemTemplate';
export * from './ItemText';
export * from './ItemView';

export function normalBbox(bbox: BoundingBox, page: PageItem): BoundingBox {
  const { height = 1 } = page.size;
  return bbox.coord_origin === 'TOPLEFT'
    ? bbox
    : { ...bbox, t: height - bbox.t, b: height - bbox.b };
}
