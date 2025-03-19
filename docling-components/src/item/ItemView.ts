import { DocItem, isDocling, PageItem } from '@docling/docling-core';
import { html } from 'lit';
import { DoclingItemElement } from './ItemElement';
import { customDoclingItemElements } from './registry';
import { customElement } from 'lit/decorators.js';

type ItemViewType = 'tooltip';

export abstract class ItemView extends DoclingItemElement<DocItem> {
  abstract type: ItemViewType;

  renderItem(item: DocItem, page: PageItem) {
    const shadowChildren = Array.from(this.childNodes ?? []).filter(
      c => 'canDraw' in c
    );
    const children =
      shadowChildren.length > 0
        ? shadowChildren
            .filter((c: any) => c.canDraw?.(item))
            .map(c => c.cloneNode(true))
        : customDoclingItemElements
            .filter(c => c.prototype.canDraw(item))
            .map(c => new (c as any)());

    children.forEach(c => {
      c.item = item;
      c.page = page;
    });

    return html`<div>${children}</div> `;
  }

  canDraw(item: object): item is DocItem {
    const shadowChildren = Array.from(this.children ?? []);

    return (
      isDocling.DocItem(item) &&
      (shadowChildren.some(c => 'canDraw' in c)
        ? Array.from(this.childNodes ?? []).some((c: any) =>
            c.canDraw?.(item)
          )
        : customDoclingItemElements.some(el => el.prototype.canDraw(item)))
    );
  }
}

@customElement('docling-tooltip')
export class ItemTooltip extends ItemView {
  type: ItemViewType = 'tooltip';
}
