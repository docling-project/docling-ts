import { PageItem } from '@docling/docling-core';
import { DoclingItemElement } from './ItemElement';
import { TemplateResult } from 'lit';

export const customDoclingItemElements: {
  cls: Omit<typeof DoclingItemElement, 'new'>;
  template?: (item: object, page: PageItem) => TemplateResult<1>;
}[] = [];
