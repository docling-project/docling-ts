import { DocItem, isDocling, PageItem } from '@docling/docling-core';
import { html } from 'lit';
import { DoclingItemElement } from './ItemElement';
import { customDoclingItemElements } from './registry';
import { customElement } from 'lit/decorators.js';

type ItemViewType = "tooltip";

abstract class ItemView extends DoclingItemElement<DocItem> {
  abstract type: ItemViewType;

  renderItem(item: DocItem, page: PageItem) {
    return html`
      <div .style=${this.style}>
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

@customElement('docling-tooltip')
export class ItemTooltip extends ItemView {
  type: ItemViewType = "tooltip";
}
