import {
  BoundingBox,
  DocItem,
  isDoclingDocItem,
  PageItem,
} from '@docling/docling-core';

const displayableTypes: (keyof typeof isDoclingDocItem)[] = [
  'TextItem',
  'SectionHeaderItem',
  'ListItem',
  'TableItem',
];

export function isDisplayable(item: DocItem): boolean {
  return displayableTypes.some(t => isDoclingDocItem[t](item));
}

export function normalBbox(bbox: BoundingBox, page: PageItem): BoundingBox {
  const { height = 1 } = page.size;
  return bbox.coord_origin === 'TOPLEFT'
    ? bbox
    : { ...bbox, t: height - bbox.t, b: height - bbox.b };
}
