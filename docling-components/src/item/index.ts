import { DocItem, isDoclingDocItem } from '@docling/docling-core';

const displayableTypes: (keyof typeof isDoclingDocItem)[] = [
  'TextItem',
  'SectionHeaderItem',
  'ListItem',
  'TableItem',
];

export function isDisplayable(item: DocItem): boolean {
  return displayableTypes.some(t => isDoclingDocItem[t](item));
}
