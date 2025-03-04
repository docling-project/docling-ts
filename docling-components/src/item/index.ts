import { Component } from 'svelte';
import { DocItem, isDoclingDocItem } from '@docling/docling-core';
import ListItem from './ListItem.svelte';
import TextItem from './TextItem.svelte';
import SectionHeaderItem from './SectionHeaderItem.svelte';
import TableItem from './TableItem.svelte';

type DocItemKey = keyof typeof isDoclingDocItem;

const components: Partial<Record<DocItemKey, Component<{ item: any }>>> = {
  CodeItem: TextItem,
  ListItem: ListItem,
  SectionHeaderItem: SectionHeaderItem,
  TableItem: TableItem,
  TextItem: TextItem,
};

export function isDisplayableItem(item: DocItem): boolean {
  return Object.keys(components).some(k =>
    isDoclingDocItem[k as DocItemKey](item)
  );
}

export function componentOfItem(item: DocItem): Component<{ item: any }> | undefined {
  const match = Object.keys(components).find((validator) =>
    isDoclingDocItem[validator as DocItemKey](item)
  ) as DocItemKey;

  return components[match];
}
