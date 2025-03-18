import { DocItem, isDocling, PageItem } from '@docling/docling-core';
import { html } from 'lit';
import { customDoclingElement, DoclingItemElement } from './ItemElement';
import { customDoclingItemElements } from './registry';

@customDoclingElement('docling-item-view')
export class ItemView extends DoclingItemElement<DocItem> {
  renderItem(item: DocItem, page: PageItem) {
    return html`
      <div>
        ${customDoclingItemElements
          .filter(
            ({ template, cls }) => template && cls.prototype.canDraw(item)
          )
          .map(({ template }) => template!(item, page))}
      </div>
    `;
  }

  canDraw(item: object): item is DocItem {
    return (
      isDocling.DocItem(item) &&
      customDoclingItemElements.some(({ template, cls }) => template && cls.prototype.canDraw(item))
    );
  }
}
